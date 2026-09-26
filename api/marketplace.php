<?php
declare(strict_types=1);

require_once __DIR__.'/storage.php';
require_once __DIR__.'/catalogue.php';
require_once __DIR__.'/customers.php';
require_once __DIR__.'/returns.php';

function market_state(PDO $pdo, bool $lock = false): array {
    $ownsTransaction=!$pdo->inTransaction();if($ownsTransaction)$pdo->beginTransaction();
    try {
    $pdo->exec("INSERT IGNORE INTO marketplace_state (id,state_json) VALUES (1,'{\"products\":[],\"entrepreneurs\":[],\"tiers\":[],\"requests\":[],\"inventory\":[],\"orders\":[]}')");
    $query = $pdo->query('SELECT state_json FROM marketplace_state WHERE id = 1' . ($lock ? ' FOR UPDATE' : ''));
    $snapshot=(string)$query->fetchColumn();
    $stored=storage_read($pdo);
    $state=$stored ?? json_decode($snapshot,true,64,JSON_THROW_ON_ERROR);
    $changed=$stored===null;
    if(!is_array($state)){$state=['products'=>[], 'entrepreneurs'=>[], 'tiers'=>[], 'requests'=>[], 'inventory'=>[], 'orders'=>[], 'settlements'=>[]];$changed=true;}
    if(!isset($state['settlements'])||!is_array($state['settlements'])){$state['settlements']=[];$changed=true;}
    // Hydrate the dropship payout ledger in bulk. This avoids the previous N+1
    // INSERT + SELECT pair for every order on every 10-second dashboard refresh.
    $payoutRows=$pdo->query("SELECT order_id,client_payment_method,payout_status,payout_reference,payout_receipt_path,paid_at,collection_status FROM entrepreneur_payouts")->fetchAll();
    $payoutByOrder=[];foreach($payoutRows as $row)$payoutByOrder[(string)$row['order_id']]=$row;
    $insertPayout=$pdo->prepare("INSERT IGNORE INTO entrepreneur_payouts(order_id,entrepreneur_member_id,client_payment_method,client_total,camy_cost,payout_amount,collection_status,payout_status,collected_at) VALUES(?,?,?,?,?,?,?,?,?)");
    foreach($state['orders'] ?? [] as &$ledgerOrder){
        if(($ledgerOrder['orderMode'] ?? '')!=='dropship')continue;
        $orderId=(string)$ledgerOrder['id'];$clientTotal=round((float)($ledgerOrder['amount'] ?? 0),2);$camyCost=round((float)($ledgerOrder['camyCost'] ?? $clientTotal),2);$margin=round((float)($ledgerOrder['entrepreneurMargin'] ?? max(0,$clientTotal-$camyCost)),2);
        $delivered=($ledgerOrder['status'] ?? '')==='Delivered';$ledgerRow=$payoutByOrder[$orderId] ?? null;
        if(!$ledgerRow){
            // New active orders are COD-only. A historical bank value is preserved only
            // when an older record already contains it.
            $method=(($ledgerOrder['clientPaymentMethod'] ?? 'cod')==='bank')?'bank':'cod';$defaultPayout=$delivered?($margin>0?'pending_transfer':'cancelled'):'pending_delivery';
            $insertPayout->execute([$orderId,$ledgerOrder['entrepreneurId'],$method,$clientTotal,$camyCost,$margin,$delivered?'collected':'pending',$defaultPayout,$delivered?date('Y-m-d H:i:s',strtotime((string)($ledgerOrder['deliveredAt'] ?? 'now'))):null]);
            $ledgerRow=['client_payment_method'=>$method,'payout_status'=>$defaultPayout,'payout_reference'=>null,'payout_receipt_path'=>null,'paid_at'=>null,'collection_status'=>$delivered?'collected':'pending'];$payoutByOrder[$orderId]=$ledgerRow;
        }
        $ledgerOrder['payoutAmount']=$margin;$ledgerOrder['payoutStatus']=$ledgerRow['payout_status']==='cancelled'&&$margin<=0?'not_required':$ledgerRow['payout_status'];
        $ledgerOrder['clientPaymentStatus']=$ledgerRow['collection_status']==='collected'?'Collected by CAMY':'Collect on delivery';
        if($ledgerRow['payout_reference'])$ledgerOrder['payoutReference']=$ledgerRow['payout_reference'];
        if($ledgerRow['payout_receipt_path'])$ledgerOrder['payoutReceipt']='/api/marketplace/orders/'.$orderId.'/payout-receipt';
        if($ledgerRow['paid_at'])$ledgerOrder['payoutPaidAt']=date(DATE_ATOM,strtotime((string)$ledgerRow['paid_at']));
    }unset($ledgerOrder);
    if(empty($state['products'])&&empty($state['catalogue_seeded'])){
        $rows=$pdo->query("SELECT id,code,name,category,description,price,stock,image FROM products WHERE status='active' ORDER BY id")->fetchAll();
        if($rows){$state['products']=array_map(static fn($row)=>['id'=>(int)$row['id'],'code'=>$row['code'],'name'=>$row['name'],'category'=>$row['category'],'description'=>$row['description'],'price'=>(float)$row['price'],'stock'=>(int)$row['stock'],'image'=>$row['image'] ?: '/products/classic-set.png','specs'=>[]],$rows);$state['catalogue_live']=true;}
        else{$demo=json_decode((string)file_get_contents(__DIR__.'/../database/demo_catalog.json'),true);$state['products']=$demo['products'] ?? [];$state['tiers']=$demo['tiers'] ?? [];$state['catalogue_live']=false;}
        $state['catalogue_seeded']=true;$changed=true;
    }
    if(!array_key_exists('catalogue_live',$state)){$state['catalogue_live']=!empty($state['inventory'])||!empty($state['requests'])||!empty($state['orders'])||(int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn()>0;$changed=true;}
    // CAMY rule: no successful sale for 90 days deactivates the account. Run this
    // maintenance once per calendar day instead of on every state poll.
    $today=date('Y-m-d');
    if(($state['maintenance']['inactiveCheckDate'] ?? '')!==$today){
        $pdo->exec("UPDATE users u JOIN entrepreneurs e ON e.user_id=u.id SET u.status='inactive',u.session_version=u.session_version+1 WHERE u.role='entrepreneur' AND u.status='active' AND e.joined_date<=DATE_SUB(CURDATE(),INTERVAL 90 DAY) AND COALESCE(e.outstanding,0)<=0 AND NOT EXISTS (SELECT 1 FROM shop_orders s WHERE s.entrepreneur_member_id=e.member_id AND s.status='Delivered' AND COALESCE(s.delivered_at,s.created_at)>=DATE_SUB(NOW(),INTERVAL 90 DAY)) AND NOT EXISTS (SELECT 1 FROM shop_orders a WHERE a.entrepreneur_member_id=e.member_id AND a.status NOT IN ('Delivered','Returned','Rejected','Cancelled')) AND NOT EXISTS (SELECT 1 FROM stock_supply_requests r WHERE r.entrepreneur_member_id=e.member_id AND r.status IN ('Pending','Approved'))");
        $state['maintenance']['inactiveCheckDate']=$today;$changed=true;
    }
    $members=$pdo->query("SELECT u.member_id,u.full_name,u.email,u.status,e.nic,e.phone,e.address,e.city,e.joined_date,e.profile_image,e.bank_name,e.bank_branch,e.account_holder,e.account_number FROM users u LEFT JOIN entrepreneurs e ON e.user_id=u.id WHERE u.role='entrepreneur' AND u.member_id IS NOT NULL")->fetchAll();
    $personIndex=[];foreach($state['entrepreneurs'] ?? [] as $index=>$person)$personIndex[(string)$person['id']]=$index;
    foreach($members as $member){
        $memberId=(string)$member['member_id'];
        if(!array_key_exists($memberId,$personIndex)){$state['entrepreneurs'][]=['id'=>$memberId,'name'=>(string)$member['full_name'],'city'=>(string)($member['city'] ?: 'Sri Lanka'),'stage'=>'Trial seller','sales'=>0,'credit'=>0,'used'=>0];$personIndex[$memberId]=array_key_last($state['entrepreneurs']);$changed=true;}
        $index=$personIndex[$memberId];$before=$state['entrepreneurs'][$index];$person=&$state['entrepreneurs'][$index];
        $person['name']=$member['full_name'];$person['email']=$member['email'];$person['active']=$member['status']==='active';
        foreach(['nic','phone','address','city'] as $field)if($member[$field]!==null)$person[$field]=$member[$field];
        if($member['joined_date'])$person['joined']=$member['joined_date'];if($member['profile_image'])$person['image']=$member['profile_image'];
        if(!empty($member['account_number']))$person['bankDetails']=['bank'=>$member['bank_name'],'branch'=>$member['bank_branch'],'holder'=>$member['account_holder'],'account'=>$member['account_number']];
        if($member['status']!=='active')$person['stage']='Departed';
        $person['initials']=implode('',array_map(static fn($word)=>substr($word,0,1),array_slice(explode(' ',$person['name']),0,2)));
        if($before!==$person)$changed=true;unset($person);
    }
    foreach($state['requests'] as &$request)if($request['status']==='Pending'&&!empty($request['receipt'])){$request['status']='Payment review';$pdo->prepare('UPDATE stock_supply_requests SET status=? WHERE id=?')->execute(['Payment review',$request['id']]);$changed=true;}unset($request);
    if($changed)market_save($pdo,$state);
    if($ownsTransaction)$pdo->commit();
    return $state;
    } catch(Throwable $error){if($ownsTransaction&&$pdo->inTransaction())$pdo->rollBack();throw $error;}
}
function market_save(PDO $pdo, array &$state): void {
    $ownsTransaction=!$pdo->inTransaction();if($ownsTransaction)$pdo->beginTransaction();
    try {
        $state['revision']=(int)($state['revision'] ?? 0)+1;
        storage_write($pdo,$state);
        $query=$pdo->prepare('UPDATE marketplace_state SET state_json=? WHERE id=1');
        $query->execute([storage_json($state)]);
        if($ownsTransaction)$pdo->commit();
    } catch(Throwable $error){if($ownsTransaction&&$pdo->inTransaction())$pdo->rollBack();throw $error;}
}
function market_public(array $state): array {
    $realEntrepreneurs=array_values(array_filter($state['entrepreneurs'] ?? [],static fn($person)=>($person['active'] ?? true) && !str_starts_with((string)($person['id'] ?? ''),'DEMO-')&&!str_contains(strtolower((string)($person['name'] ?? '')),'(demo)')));
    $realIds=array_map(static fn($person)=>(string)$person['id'],$realEntrepreneurs);
    $publicInventory=array_values(array_filter($state['inventory'] ?? [],static fn($item)=>($item['visible'] ?? true)===true&&in_array((string)$item['entrepreneurId'],$realIds,true)));
    $publishedProducts=array_values(array_filter($state['products'] ?? [],static fn($product)=>($product['published'] ?? true)===true));
    return ['products'=>array_map(static fn($product)=>array_merge($product,['stock'=>($product['stock'] ?? 0)>0?1:0]),$publishedProducts), 'entrepreneurs'=>array_map(static fn($person)=>['id'=>$person['id'],'name'=>$person['name'],'city'=>$person['city'] ?? 'Sri Lanka','stage'=>$person['stage'] ?? 'Trial seller'], $realEntrepreneurs), 'inventory'=>array_map(static fn($item)=>['entrepreneurId'=>$item['entrepreneurId'],'productId'=>$item['productId'],'qty'=>$item['qty']>0?999999:0,'price'=>$item['price'] ?? null],$publicInventory)];
}
require_once __DIR__.'/workflow.php';
function market_route(PDO $pdo, string $path, string $method): void {
    if(str_starts_with($path,'/customer/')||in_array($path,['/marketplace/public','/marketplace/preview'],true)||($path==='/marketplace/orders'&&$method==='POST')) {
        response(['message'=>'The customer portal has been retired. Orders are now entered by CAMY entrepreneurs.'],410);
    }
    return_route($pdo,$path,$method);
    workflow_route($pdo,$path,$method);
    if($path==='/marketplace/preview' && $method==='GET'){
        $catalogue=json_decode((string)file_get_contents(__DIR__.'/../database/demo_catalog.json'),true,64,JSON_THROW_ON_ERROR);
        $shops=[['id'=>'PREVIEW-COLOMBO','name'=>'Colombo Home Essentials · Sample','city'=>'Colombo','stage'=>'Preview'],['id'=>'PREVIEW-KANDY','name'=>'Kandy Living · Sample','city'=>'Kandy','stage'=>'Preview']];
        $inventory=[];foreach($catalogue['products'] as $index=>$product){$inventory[]=['entrepreneurId'=>$shops[$index%2]['id'],'productId'=>$product['id'],'qty'=>999999,'price'=>$product['price']];if($index<3)$inventory[]=['entrepreneurId'=>$shops[($index+1)%2]['id'],'productId'=>$product['id'],'qty'=>999999,'price'=>round($product['price']*1.03,2)];}
        response(['preview'=>true,'products'=>$catalogue['products'],'entrepreneurs'=>$shops,'inventory'=>$inventory,'ratingSummary'=>[]]);
    }
    if ($path === '/marketplace/public' && $method === 'GET') {
        $public=market_public(market_state($pdo));
        $public['ratingSummary']=$pdo->query("SELECT product_id AS productId,shop_id AS shopId,AVG(rating) AS average,COUNT(*) AS count FROM customer_reviews WHERE status='Published' GROUP BY product_id,shop_id")->fetchAll();
        response($public);
    }
    if ($path === '/marketplace/state' && $method === 'GET') {
        $user=current_user($pdo); if (!$user) response(['message'=>'Authentication required.'],401);
        $state=market_state($pdo);
        if (in_array($user['role'], ['admin','manager'], true)) {
            // Contact details are returned only to authenticated management users.
            $contacts=$pdo->query("SELECT u.member_id,u.full_name,u.email,e.nic,e.phone,e.address,e.city FROM users u LEFT JOIN entrepreneurs e ON e.user_id=u.id WHERE u.role='entrepreneur' AND u.member_id IS NOT NULL")->fetchAll();
            foreach($contacts as $contact) foreach($state['entrepreneurs'] as &$person) {
                if((string)$person['id']===(string)$contact['member_id']) {
                    foreach(['email','nic','phone','address','city'] as $field) $person[$field]=$contact[$field] ?? '';
                    $person['name']=$contact['full_name'];
                    break;
                }
            }
            unset($person);
            response($state);
        }
        $member=(string) $user['member_id'];
        $self=null;foreach($state['entrepreneurs'] ?? [] as $person)if((string)$person['id']===$member){$self=$person;break;}
        // Entrepreneurs receive the complete CAMY product information, but never the
        // warehouse quantity. `stock` is deliberately reduced to an availability flag.
        $entrepreneurProducts=array_map(static fn($product)=>array_merge($product,['stock'=>(($product['stock'] ?? 0)>0?1:0)]),array_values(array_filter($state['products'] ?? [],static fn($product)=>($product['published'] ?? true)===true)));
        response(['products'=>$entrepreneurProducts,'catalogue_live'=>$state['catalogue_live'] ?? false,'entrepreneurs'=>market_public($state)['entrepreneurs'],'self'=>$self,'tiers'=>$state['tiers'] ?? [],'inventory'=>array_values(array_filter($state['inventory'] ?? [],static fn($item)=>$item['entrepreneurId']===$member)),'requests'=>array_values(array_filter($state['requests'] ?? [],static fn($item)=>$item['entrepreneurId']===$member)),'orders'=>array_values(array_filter($state['orders'] ?? [],static fn($item)=>$item['entrepreneurId']===$member)),'settlements'=>array_values(array_filter($state['settlements'] ?? [],static fn($item)=>(string)$item['entrepreneurId']===$member))]);
    }
    if (preg_match('#^/marketplace/requests/([^/]+)/receipt$#',$path,$matches) && $method==='GET') {
        $user=current_user($pdo);if(!$user) response(['message'=>'Authentication required.'],401);
        $query=$pdo->prepare('SELECT entrepreneur_member_id,receipt_path FROM stock_supply_requests WHERE id=?');$query->execute([$matches[1]]);$row=$query->fetch();if(!$row||(!in_array($user['role'],['admin','manager'],true)&&(string)$row['entrepreneur_member_id']!==(string)$user['member_id'])) response(['message'=>'Receipt not found.'],404);
        $file=__DIR__.'/../private/receipts/'.basename((string)$row['receipt_path']);if(!is_file($file)) response(['message'=>'Receipt not found.'],404);
        header('Content-Type: '.(mime_content_type($file) ?: 'application/octet-stream'));header('Content-Disposition: inline; filename="'.basename($file).'"');header('Content-Length: '.filesize($file));readfile($file);exit;
    }
    if ($path === '/marketplace/profile' && $method === 'POST') {
        $user=current_user($pdo);if(!$user||$user['role']!=='entrepreneur'||!$user['member_id']) response(['message'=>'Entrepreneur access is required.'],403);
        $pdo->beginTransaction();$state=market_state($pdo,true);$found=false;
        foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$user['member_id']){$person['name']=$user['full_name'];$person['city']=$user['city'] ?: ($person['city'] ?? 'Sri Lanka');$found=true;break;}unset($person);
        if(!$found)$state['entrepreneurs'][]=['id'=>(string)$user['member_id'],'name'=>(string)$user['full_name'],'city'=>(string)($user['city'] ?: 'Sri Lanka'),'stage'=>'Trial seller','sales'=>0,'credit'=>0,'used'=>0];
        market_save($pdo,$state);$pdo->commit();response(['ok'=>true]);
    }
    if ($path === '/marketplace/shop-price' && $method === 'POST') {
        $user=current_user($pdo);if(!$user||$user['role']!=='entrepreneur'||!$user['member_id']) response(['message'=>'Entrepreneur access is required.'],403);
        $data=input();$productId=(string)($data['productId'] ?? '');$price=filter_var($data['price'] ?? null,FILTER_VALIDATE_FLOAT);
        if($price===false||!is_finite($price)||$price<=0||$price>100000000) response(['message'=>'Enter a valid selling price.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);$itemIndex=null;$base=null;
        foreach($state['products'] as $product)if((string)$product['id']===$productId){$base=(float)$product['price'];break;}
        foreach($state['inventory'] as $index=>$item)if((string)$item['entrepreneurId']===(string)$user['member_id']&&(string)$item['productId']===$productId){$itemIndex=$index;break;}
        if($itemIndex===null||$base===null){$pdo->rollBack();response(['message'=>'This product is not in your shop.'],404);}
        $state['inventory'][$itemIndex]['price']=round((float)$price,2);if(array_key_exists('visible',$data))$state['inventory'][$itemIndex]['visible']=(bool)$data['visible'];market_save($pdo,$state);$pdo->commit();response(['inventory'=>array_values(array_filter($state['inventory'],static fn($item)=>(string)$item['entrepreneurId']===(string)$user['member_id']))]);
    }
    if ($path === '/marketplace/activate-catalogue' && $method === 'POST') {
        require_admin($pdo);$pdo->beginTransaction();$state=market_state($pdo,true);if(empty($state['products'])){$pdo->rollBack();response(['message'=>'Add products before activating the catalogue.'],422);}foreach($state['products'] as $product)if(!isset($product['code'],$product['name'],$product['price'],$product['stock'])){$pdo->rollBack();response(['message'=>'Complete all product details before activation.'],422);}$state['products']=catalogue_products($state['products']);$state['catalogue_live']=true;market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if ($path === '/marketplace/catalog' && $method === 'POST') {
        require_admin($pdo); $data=input();
        if (!is_array($data['products'] ?? null)) response(['message'=>'Invalid catalogue.'],422);
        $pdo->beginTransaction(); $state=market_state($pdo,true);
        $data['products']=catalogue_products($data['products']);
        if(isset($data['revision'])&&(int)$data['revision']!==(int)($state['revision'] ?? 0))response(['message'=>'The catalogue changed in another session. Reload the latest data before saving.'],409);
        $incomingIds=array_map('strval',array_column($data['products'],'id'));
        foreach($state['inventory'] ?? [] as $item)if((int)$item['qty']>0){if(!in_array((string)$item['productId'],$incomingIds,true)){$pdo->rollBack();response(['message'=>'A product still exists in an entrepreneur shop and cannot be removed.'],409);}foreach($state['products'] as $oldProduct)if((string)$oldProduct['id']===(string)$item['productId'])foreach($data['products'] as $newProduct)if((string)$newProduct['id']===(string)$item['productId']&&(string)($newProduct['code'] ?? '')!==(string)($oldProduct['code'] ?? '')){$pdo->rollBack();response(['message'=>'A stocked product code cannot be changed.'],409);}}
        foreach($state['requests'] ?? [] as $request)if(in_array($request['status'],['Pending','Awaiting payment','Payment review','Approved'],true))foreach($request['items'] as $item)if(!in_array((string)$item['productId'],$incomingIds,true)){$pdo->rollBack();response(['message'=>'A product is in a pending stock request and cannot be removed.'],409);}
        foreach($state['orders'] ?? [] as $order)if(!in_array($order['status'],['Rejected','Returned'],true))foreach($order['items'] as $item)if(!in_array((string)$item['id'],$incomingIds,true))response(['message'=>'A product belongs to an existing customer order and cannot be removed.'],409);
        $serverStock=[];foreach($state['products'] as $product)$serverStock[(string)$product['id']]=(int)$product['stock'];
        $baseStock=is_array($data['baseStock'] ?? null)?$data['baseStock']:[];
        $incomingProducts=array_values($data['products']);foreach($incomingProducts as &$product){$id=(string)$product['id'];if(isset($serverStock[$id])){$base=array_key_exists($id,$baseStock)?(int)$baseStock[$id]:(int)$product['stock'];$product['stock']=max(0,$serverStock[$id]+((int)$product['stock']-$base));}}unset($product);
        $state['products']=$incomingProducts;
        $state['catalogue_seeded']=true;
        market_save($pdo,$state);$pdo->commit();response(['ok'=>true,'state'=>$state]);
    }
    if ($path === '/marketplace/requests' && $method === 'POST') {
        $user=current_user($pdo);if (!$user || $user['role']!=='entrepreneur' || !$user['member_id']) response(['message'=>'Entrepreneur access is required.'],403);
        $data=input();$items=workflow_items($data['items'] ?? []);
        if(!$items)response(['message'=>'Choose stock for your credit request.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);
        if(empty($state['catalogue_live'])){$pdo->rollBack();response(['message'=>'CAMY Admin must verify and activate the real product catalogue before credit stock can be requested.'],409);}
        $personIndex=null;foreach($state['entrepreneurs'] as $index=>$person)if((string)$person['id']===(string)$user['member_id']){$personIndex=$index;break;}
        if($personIndex===null){$pdo->rollBack();response(['message'=>'Your entrepreneur profile could not be found.'],404);}
        $person=$state['entrepreneurs'][$personIndex];$credit=round((float)($person['credit'] ?? 0),2);$used=round((float)($person['used'] ?? 0),2);
        if($credit<=0||($person['stage'] ?? '')==='Departed'||($person['active'] ?? true)===false){$pdo->rollBack();response(['message'=>'Credit stock is available only after you become Credit eligible. Drop-shipping remains available.'],403);}
        $clean=[];$total=0;
        foreach($items as $item){
            $product=null;foreach($state['products'] as $candidate)if((string)$candidate['id']===(string)($item['productId'] ?? '')){$product=$candidate;break;}
            $qty=(int)($item['qty'] ?? 0);
            if(!$product||($product['published'] ?? true)!==true||$qty<1||$qty>(int)$product['stock']){$pdo->rollBack();response(['message'=>'A requested product is hidden or unavailable in the requested quantity.'],409);}
            $price=round((float)$product['price'],2);$clean[]=['productId'=>$product['id'],'qty'=>$qty,'price'=>$price];$total+=$price*$qty;
        }
        $total=round($total,2);$committed=0;
        foreach($state['requests'] as $entry)if((string)($entry['entrepreneurId'] ?? '')===(string)$user['member_id']&&($entry['creditMode'] ?? false)===true&&in_array($entry['status'],['Pending','Approved'],true))$committed+=(float)($entry['total'] ?? 0);
        $available=max(0,round($credit-$used-$committed,2));
        if($total>$available+0.009){$pdo->rollBack();response(['message'=>'This request exceeds your available CAMY credit. Available: Rs. '.number_format($available,2,'.',',').'.'],422);}
        $request=['id'=>'SUP-'.bin2hex(random_bytes(5)),'entrepreneurId'=>(string)$user['member_id'],'entrepreneurName'=>(string)$user['full_name'],'items'=>$clean,'total'=>$total,'creditMode'=>true,'creditLimitAtRequest'=>$credit,'outstandingAtRequest'=>$used,'availableCreditAtRequest'=>$available,'status'=>'Pending','createdAt'=>date(DATE_ATOM)];
        $pdo->prepare('INSERT INTO stock_supply_requests(id,entrepreneur_member_id,payment_reference,receipt_path,total,status) VALUES(?,?,?,?,?,?)')->execute([$request['id'],$request['entrepreneurId'],'','',$total,'Pending']);
        foreach($clean as $item){$code='';foreach($state['products'] as $product)if((string)$product['id']===(string)$item['productId']){$code=(string)($product['code'] ?? $product['id']);break;}$pdo->prepare('INSERT INTO stock_supply_request_items(request_id,product_code,quantity,purchase_price) VALUES(?,?,?,?)')->execute([$request['id'],$code,$item['qty'],$item['price']]);}
        array_unshift($state['requests'],$request);market_save($pdo,$state);$pdo->commit();response(['request'=>$request],201);
    }
    if (preg_match('#^/marketplace/requests/([^/]+)/edit$#',$path,$matches) && $method==='POST') {
        require_admin($pdo);$data=input();$pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
        foreach($state['requests'] as $key=>$request)if($request['id']===$matches[1]){$index=$key;break;}
        if($index===null){$pdo->rollBack();response(['message'=>'Credit stock request not found.'],404);}
        $request=$state['requests'][$index];
        if(($request['creditMode'] ?? false)!==true){$pdo->rollBack();response(['message'=>'Legacy paid stock requests can no longer be edited in the active CAMY flow.'],409);}
        if($request['status']!=='Pending'){$pdo->rollBack();response(['message'=>'Only pending credit requests can be edited.'],409);}
        $items=workflow_items($data['items'] ?? []);if(!$items){$pdo->rollBack();response(['message'=>'Keep at least one product in the request.'],422);}
        $clean=[];$total=0;
        foreach($items as $item){
            $product=null;foreach($state['products'] as $candidate)if((string)$candidate['id']===(string)$item['productId']){$product=$candidate;break;}
            if(!$product||($product['published'] ?? true)!==true||$item['qty']>(int)$product['stock']){$pdo->rollBack();response(['message'=>'Use currently live CAMY products and available warehouse quantities.'],422);}
            $price=round((float)$product['price'],2);$clean[]=['productId'=>$product['id'],'qty'=>$item['qty'],'price'=>$price];$total+=$price*$item['qty'];
        }
        $person=null;foreach($state['entrepreneurs'] as $candidate)if((string)$candidate['id']===(string)$request['entrepreneurId']){$person=$candidate;break;}
        if(!$person|| (float)($person['credit'] ?? 0)<=0){$pdo->rollBack();response(['message'=>'This entrepreneur is no longer credit eligible.'],409);}
        $committed=0;foreach($state['requests'] as $entry)if($entry['id']!==$request['id']&&(string)($entry['entrepreneurId'] ?? '')===(string)$request['entrepreneurId']&&($entry['creditMode'] ?? false)===true&&in_array($entry['status'],['Pending','Approved'],true))$committed+=(float)($entry['total'] ?? 0);
        $available=max(0,(float)$person['credit']-(float)($person['used'] ?? 0)-$committed);$total=round($total,2);
        if($total>$available+0.009){$pdo->rollBack();response(['message'=>'Edited request exceeds the entrepreneur\'s available credit.'],422);}
        $state['requests'][$index]['items']=$clean;$state['requests'][$index]['total']=$total;$state['requests'][$index]['updatedAt']=date(DATE_ATOM);
        $pdo->prepare('UPDATE stock_supply_requests SET total=? WHERE id=?')->execute([$total,$request['id']]);
        $pdo->prepare('DELETE FROM stock_supply_request_items WHERE request_id=?')->execute([$request['id']]);
        foreach($clean as $item){$code='';foreach($state['products'] as $product)if((string)$product['id']===(string)$item['productId']){$code=(string)($product['code'] ?? $product['id']);break;}$pdo->prepare('INSERT INTO stock_supply_request_items(request_id,product_code,quantity,purchase_price) VALUES(?,?,?,?)')->execute([$request['id'],$code,$item['qty'],$item['price']]);}
        market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if (preg_match('#^/marketplace/requests/([^/]+)/(approve|reject|dispatch)$#',$path,$matches) && $method==='POST') {
        $admin=require_admin($pdo);$pdo->beginTransaction();$state=market_state($pdo,true);$found=null;
        foreach($state['requests'] as $index=>$request)if($request['id']===$matches[1]){$found=$index;break;}
        if($found===null){$pdo->rollBack();response(['message'=>'Credit stock request not found.'],404);}
        $request=$state['requests'][$found];$action=$matches[2];
        if(($request['creditMode'] ?? false)!==true){$pdo->rollBack();response(['message'=>'This is a legacy paid stock request and is not part of the active Phase 2 flow.'],409);}
        $next=['approve'=>'Approved','reject'=>'Rejected','dispatch'=>'Dispatched'][$action];workflow_transition($request['status'],$next,true);
        $personIndex=null;foreach($state['entrepreneurs'] as $index=>$person)if((string)$person['id']===(string)$request['entrepreneurId']){$personIndex=$index;break;}
        if($personIndex===null){$pdo->rollBack();response(['message'=>'Entrepreneur record not found.'],404);}
        $person=&$state['entrepreneurs'][$personIndex];$credit=(float)($person['credit'] ?? 0);$used=(float)($person['used'] ?? 0);
        if($credit<=0||($person['stage'] ?? '')==='Departed'){unset($person);$pdo->rollBack();response(['message'=>'This entrepreneur is not currently credit eligible.'],409);}
        if($action==='approve'){
            $otherCommitted=0;foreach($state['requests'] as $entry)if($entry['id']!==$request['id']&&(string)($entry['entrepreneurId'] ?? '')===(string)$request['entrepreneurId']&&($entry['creditMode'] ?? false)===true&&in_array($entry['status'],['Pending','Approved'],true))$otherCommitted+=(float)($entry['total'] ?? 0);
            $available=max(0,$credit-$used-$otherCommitted);
            if((float)$request['total']>$available+0.009){unset($person);$pdo->rollBack();response(['message'=>'The entrepreneur no longer has enough available credit for this request.'],409);}
            workflow_reserve($state,$request['items'],null);$state['requests'][$found]['reserved']=true;$state['requests'][$found]['approvedAt']=date(DATE_ATOM);$state['requests'][$found]['approvedBy']=$admin['id'];
        }
        if($action==='reject'&&!empty($request['reserved'])){workflow_release($state,$request['items'],null);$state['requests'][$found]['reserved']=false;}
        if($action==='dispatch'){
            if(empty($request['reserved'])){unset($person);$pdo->rollBack();response(['message'=>'Approve this request before dispatching it.'],409);}
            if($used+(float)$request['total']>$credit+0.009){unset($person);$pdo->rollBack();response(['message'=>'Dispatch would exceed the entrepreneur\'s current credit limit. Review outstanding settlements or credit rules first.'],409);}
            foreach($request['items'] as $item){$foundInventory=false;foreach($state['inventory'] as &$inventory)if((string)$inventory['entrepreneurId']===(string)$request['entrepreneurId']&&(string)$inventory['productId']===(string)$item['productId']){$inventory['qty']+=$item['qty'];$foundInventory=true;break;}unset($inventory);if(!$foundInventory)$state['inventory'][]=['entrepreneurId'=>$request['entrepreneurId'],'productId'=>$item['productId'],'qty'=>$item['qty'],'price'=>$item['price'],'visible'=>false];}
            $person['used']=round($used+(float)$request['total'],2);$state['requests'][$found]['creditIssuedAt']=date(DATE_ATOM);$state['requests'][$found]['creditIssuedAmount']=round((float)$request['total'],2);$state['requests'][$found]['dispatchedBy']=$admin['id'];
        }
        unset($person);
        $state['requests'][$found]['status']=$next;$state['requests'][$found]['reviewedAt']=date(DATE_ATOM);$state['requests'][$found]['updatedAt']=date(DATE_ATOM);
        $pdo->prepare('UPDATE stock_supply_requests SET status=?,reviewed_at=NOW() WHERE id=?')->execute([$next,$request['id']]);market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if ($path === '/marketplace/orders' && $method === 'POST') {
        $account=customer_required($pdo);
        $data=input();if(!is_array($data['customer'] ?? null))response(['message'=>'Enter delivery details.'],422);
        $customer=customer_details($data['customer']);$items=workflow_items($data['items'] ?? [],true);$name=$customer['name'];$phone=$customer['phone'];$district=$customer['district'];$address=$customer['address'];
        $requestKey=(string)($data['requestKey'] ?? '');
        if($requestKey!==''&&!preg_match('/^[a-zA-Z0-9-]{16,64}$/',$requestKey))response(['message'=>'Invalid checkout reference. Refresh and try again.'],422);
        $payloadHash=hash('sha256',storage_json([$customer,$items]));
        if(!$name||!preg_match('/^(?:\+94|0)7\d{8}$/',$phone)||!$district||!$address||!is_array($items)||!$items) response(['message'=>'Enter a valid name, Sri Lankan mobile number, district, address and cart.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);$groups=[];
        if($requestKey!==''){
            $query=$pdo->prepare('SELECT payload_hash,response_json FROM customer_checkout_requests WHERE customer_id=? AND request_key=?');$query->execute([$account['id'],$requestKey]);$previous=$query->fetch();
            if($previous){
                if(!hash_equals($previous['payload_hash'],$payloadHash))response(['message'=>'This checkout reference belongs to a different cart. Review your cart and try again.'],409);
                $pdo->commit();response(json_decode($previous['response_json'],true,64,JSON_THROW_ON_ERROR),201);
            }
        }
        foreach($items as $item){$shop=(string)($item['shopId'] ?? '');$productId=(string)($item['productId'] ?? '');$qty=(int)($item['qty'] ?? 0);$person=null;$product=null;$slot=null;foreach($state['entrepreneurs'] as $candidate)if($candidate['id']===$shop){$person=$candidate;break;}foreach($state['products'] as $candidate)if((string)$candidate['id']===$productId){$product=$candidate;break;}foreach($state['inventory'] as $index=>$candidate)if($candidate['entrepreneurId']===$shop&&(string)$candidate['productId']===$productId){$slot=$index;break;}if(!$person||!($person['active'] ?? true)||($person['stage'] ?? '')==='Departed'||!$product||$slot===null||($state['inventory'][$slot]['visible'] ?? true)===false||$qty<1||$qty>$state['inventory'][$slot]['qty']){$pdo->rollBack();response(['message'=>'A cart item is no longer in stock at its shop.'],409);}$sellPrice=(float)($state['inventory'][$slot]['price'] ?? $product['price']);if(!isset($item['expectedPrice'])||abs((float)$item['expectedPrice']-$sellPrice)>0.009){$pdo->rollBack();response(['message'=>'A shop price changed. Refresh the page and review your cart before ordering.'],409);}$state['inventory'][$slot]['qty']-=$qty;$groups[$shop]['person']=$person;$groups[$shop]['items'][]=['id'=>$product['id'],'name'=>$product['name'],'qty'=>$qty,'price'=>$sellPrice,'image'=>$product['image'] ?? '', 'category'=>$product['category'] ?? 'Other'];}
        $ids=[];$tracking=[];foreach($groups as $shop=>$group)workflow_release($state,$group['items'],(string)$shop);$groupId='SHOP-'.bin2hex(random_bytes(5));$pdo->prepare('INSERT INTO customer_order_groups(id,customer_name,customer_phone,district,delivery_address) VALUES(?,?,?,?,?)')->execute([$groupId,$name,$phone,$district,$address]);foreach($groups as $shop=>$group){$selected=$group['items'];$total=0;$count=0;foreach($selected as $item){$total+=$item['price']*$item['qty'];$count+=$item['qty'];}$id='CMY-'.bin2hex(random_bytes(5));$ids[]=$id;$token=bin2hex(random_bytes(24));$tracking[]=['id'=>$id,'token'=>$token];$state['orders'][]=['id'=>$id,'groupId'=>$groupId,'customerId'=>(int)$account['id'],'customer'=>$name,'phone'=>$phone,'district'=>$district,'address'=>$address.', '.$district,'product'=>count($selected)===1?$selected[0]['name']:count($selected).' CAMY products','items'=>$selected,'qty'=>$count,'amount'=>$total,'date'=>date('Y-m-d'),'createdAt'=>date(DATE_ATOM),'status'=>'Pending','trackingToken'=>$token,'reserved'=>false,'entrepreneur'=>$group['person']['name'],'entrepreneurId'=>$shop,'source'=>'shop'];$pdo->prepare("INSERT INTO shop_orders(id,group_id,entrepreneur_member_id,total,status) VALUES(?,?,?,?,'Pending')")->execute([$id,$groupId,$shop,$total]);foreach($selected as $item){$code='';foreach($state['products'] as $product)if((string)$product['id']===(string)$item['id']){$code=(string)($product['code'] ?? $item['id']);break;}$pdo->prepare('INSERT INTO shop_order_items(order_id,product_code,quantity,sell_price) VALUES(?,?,?,?)')->execute([$id,$code,$item['qty'],$item['price']]);}}
        $result=['ids'=>$ids,'tracking'=>$tracking];
        if($requestKey!=='')$pdo->prepare('INSERT INTO customer_checkout_requests(customer_id,request_key,payload_hash,response_json) VALUES(?,?,?,?)')->execute([$account['id'],$requestKey,$payloadHash,storage_json($result)]);
        customer_save($pdo,(int)$account['id'],$customer);market_save($pdo,$state);$pdo->commit();response($result,201);
    }
    if (preg_match('#^/marketplace/orders/([^/]+)/status$#',$path,$matches) && $method==='POST') {
        $user=current_user($pdo);if(!$user)response(['message'=>'Authentication required.'],401);$data=input();$status=(string)($data['status'] ?? '');
        $pdo->beginTransaction();$state=market_state($pdo,true);$index=null;foreach($state['orders'] as $key=>$order)if($order['id']===$matches[1]){$index=$key;break;}if($index===null){$pdo->rollBack();response(['message'=>'Shop order not found.'],404);}
        $order=$state['orders'][$index];
        if(($order['orderMode'] ?? '')==='dropship'&&!in_array($user['role'],['admin','manager'],true))response(['message'=>'CAMY Admin controls dropship fulfilment updates.'],403);
        workflow_owner($user,(string)$order['entrepreneurId']);if($status==='Returned'&&!empty($order['return']))response(['message'=>'Complete the return review and receipt flow first.'],409);
        if(!($status==='Delivered'&&$order['status']==='Delivered'))workflow_transition($order['status'],$status,false);
        if($status==='Delivered'&&empty($order['deliveryConfirmations']['seller']))$state['orders'][$index]['deliveryConfirmations']['seller']=['id'=>(int)$user['id'],'name'=>$user['full_name'],'at'=>date(DATE_ATOM)];
        if($status==='Dispatched'){
            $trackingNumber=trim((string)($data['trackingNumber'] ?? ''));
            $courier=trim((string)($data['courier'] ?? ''));
            if(!$trackingNumber||strlen($trackingNumber)>120||preg_match('/[\x00-\x1F\x7F]/',$trackingNumber)||strlen($courier)>120)response(['message'=>'Enter the courier tracking number (up to 120 characters) before dispatching.'],422);
            $state['orders'][$index]['trackingNumber']=$trackingNumber;
            $state['orders'][$index]['courier']=$courier;
            $state['orders'][$index]['dispatchedAt']=date(DATE_ATOM);
        }
        if($status==='Awaiting payment'){$bank=[];foreach($state['entrepreneurs'] as $person)if((string)$person['id']===(string)$order['entrepreneurId'])$bank=$person['bankDetails'] ?? [];workflow_bank_required($bank);if($order['status']==='Pending'){workflow_reserve($state,$order['items'],(string)$order['entrepreneurId']);$state['orders'][$index]['reserved']=true;$state['orders'][$index]['bankDetails']=$bank;}}
        if(in_array($status,['Rejected','Returned','Cancelled'],true)&&($order['reserved'] ?? true)){$releaseShop=(($order['orderMode'] ?? '')==='dropship')?null:(string)$order['entrepreneurId'];workflow_release($state,$order['items'],$releaseShop);$state['orders'][$index]['reserved']=false;}
        if($order['status']==='Payment review'&&$status==='Awaiting payment'){$reason=trim((string)($data['reason'] ?? ''));if(!$reason)response(['message'=>'Explain why the receipt was rejected.'],422);$state['orders'][$index]['paymentNote']=$reason;}
        $state['orders'][$index]['updatedAt']=date(DATE_ATOM);
        if($status==='Delivered'&&empty($state['orders'][$index]['deliveredAt']))$state['orders'][$index]['deliveredAt']=date(DATE_ATOM);
        $state['orders'][$index]['status']=$status;
        $pdo->prepare("UPDATE shop_orders SET status=?,delivered_at=IF(?='Delivered',COALESCE(delivered_at,NOW()),delivered_at) WHERE id=?")->execute([$status,$status,$matches[1]]);
        if(($state['orders'][$index]['orderMode'] ?? '')==='dropship'){
            if($status==='Delivered'){
                $margin=round((float)($state['orders'][$index]['entrepreneurMargin'] ?? 0),2);
                $state['orders'][$index]['clientPaymentStatus']='Collected by CAMY';
                $state['orders'][$index]['payoutStatus']=$margin>0?'pending_transfer':'not_required';
                $pdo->prepare("UPDATE entrepreneur_payouts SET collection_status='collected',collected_at=COALESCE(collected_at,NOW()),payout_status=IF(payout_amount>0 AND payout_status<>'paid','pending_transfer',IF(payout_status='paid','paid','cancelled')) WHERE order_id=?")->execute([$matches[1]]);
            }elseif(in_array($status,['Returned','Rejected','Cancelled'],true)){
                $paid=$pdo->prepare("SELECT payout_status FROM entrepreneur_payouts WHERE order_id=?");$paid->execute([$matches[1]]);$paidStatus=(string)($paid->fetchColumn() ?: '');
                $nextPayout=$paidStatus==='paid'?'reversal_required':'cancelled';
                $state['orders'][$index]['payoutStatus']=$nextPayout;
                $pdo->prepare("UPDATE entrepreneur_payouts SET payout_status=? WHERE order_id=?")->execute([$nextPayout,$matches[1]]);
                if($status==='Cancelled')$state['orders'][$index]['clientPaymentStatus']='Cancelled before delivery';
            }
        }
        $shop=$state['orders'][$index]['entrepreneurId'];$sales=0;foreach($state['orders'] as $entry)if($entry['entrepreneurId']===$shop&&$entry['status']==='Delivered')$sales+=(float)($entry['camyCost'] ?? $entry['amount']);$credit=0;foreach($state['tiers'] as $tier)if((float)$tier['sales']<=$sales&&$tier['credit']>$credit)$credit=(float)$tier['credit'];foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$shop){$person['sales']=$sales;$person['credit']=$credit;$person['stage']=$credit>0?'Credit eligible':'Trial seller';break;}unset($person);
        market_save($pdo,$state);
        $management=in_array($user['role'],['admin','manager'],true);
        $responseProducts=$management?$state['products']:array_map(static fn($product)=>array_merge($product,['stock'=>(($product['stock'] ?? 0)>0?1:0)]),$state['products']);
        $pdo->commit();response(['orders'=>array_values(array_filter($state['orders'],static fn($entry)=>in_array($user['role'],['admin','manager'],true)||(string)$entry['entrepreneurId']===(string)$user['member_id'])),'inventory'=>array_values(array_filter($state['inventory'],static fn($entry)=>in_array($user['role'],['admin','manager'],true)||(string)$entry['entrepreneurId']===(string)$user['member_id'])),'entrepreneurs'=>array_values(array_filter($state['entrepreneurs'],static fn($entry)=>in_array($user['role'],['admin','manager'],true)||(string)$entry['id']===(string)$user['member_id'])),'products'=>$responseProducts,'revision'=>$state['revision']]);
    }
}
