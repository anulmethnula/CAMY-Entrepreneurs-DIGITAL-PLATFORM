<?php
declare(strict_types=1);

require_once __DIR__.'/storage.php';
require_once __DIR__.'/catalogue.php';
require_once __DIR__.'/customers.php';
require_once __DIR__.'/returns.php';

function market_ensure_order_schema(PDO $pdo): void {
    static $ready=false;if($ready)return;
    foreach(['shop_orders'=>['camy_amount'=>'DECIMAL(14,2) NOT NULL DEFAULT 0','commission_amount'=>'DECIMAL(14,2) NOT NULL DEFAULT 0','payment_method'=>"VARCHAR(30) NOT NULL DEFAULT 'bank_transfer'",'payment_status'=>"VARCHAR(40) NOT NULL DEFAULT 'Awaiting payment'",'payment_collected_at'=>'DATETIME NULL','commission_status'=>"VARCHAR(40) NOT NULL DEFAULT 'Not eligible'",'commission_due_at'=>'DATETIME NULL','commission_paid_at'=>'DATETIME NULL','commission_reference'=>'VARCHAR(120) NULL'],'shop_order_items'=>['camy_unit_price'=>'DECIMAL(14,2) NOT NULL DEFAULT 0','commission_amount'=>'DECIMAL(14,2) NOT NULL DEFAULT 0']] as $table=>$fields){
        foreach($fields as $field=>$definition)if(!$pdo->query("SHOW COLUMNS FROM $table LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE $table ADD COLUMN $field $definition");
    }
    $ready=true;
}
function market_state(PDO $pdo, bool $lock = false): array {
    market_ensure_order_schema($pdo);
    $ownsTransaction=!$pdo->inTransaction();if($ownsTransaction)$pdo->beginTransaction();
    try {
    $pdo->exec("INSERT IGNORE INTO marketplace_state (id,state_json) VALUES (1,'{\"products\":[],\"entrepreneurs\":[],\"tiers\":[],\"requests\":[],\"inventory\":[],\"orders\":[]}')");
    $query = $pdo->query('SELECT state_json FROM marketplace_state WHERE id = 1' . ' FOR UPDATE');
    $snapshot=(string)$query->fetchColumn();
    $stored=storage_read($pdo);
    $state=$stored ?? json_decode($snapshot,true,64,JSON_THROW_ON_ERROR);
    $changed=$stored===null;
    if(!is_array($state)){$state=['products'=>[], 'entrepreneurs'=>[], 'tiers'=>[], 'requests'=>[], 'inventory'=>[], 'orders'=>[], 'settlements'=>[]];$changed=true;}
    if(!isset($state['settlements'])||!is_array($state['settlements'])){$state['settlements']=[];$changed=true;}
    if(empty($state['products'])&&empty($state['catalogue_seeded'])){
        $rows=$pdo->query("SELECT id,code,name,category,description,price,stock,image FROM products WHERE status='active' ORDER BY id")->fetchAll();
        if($rows){$state['products']=array_map(static fn($row)=>['id'=>(int)$row['id'],'code'=>$row['code'],'name'=>$row['name'],'category'=>$row['category'],'description'=>$row['description'],'price'=>(float)$row['price'],'stock'=>(int)$row['stock'],'image'=>$row['image'] ?: '/products/classic-set.png','specs'=>[]],$rows);$state['catalogue_live']=true;}
        else{$demo=json_decode((string)file_get_contents(__DIR__.'/../database/demo_catalog.json'),true);$state['products']=$demo['products'] ?? [];$state['tiers']=$demo['tiers'] ?? [];$state['catalogue_live']=false;}
        $state['catalogue_seeded']=true;$changed=true;
    }
    if(!array_key_exists('catalogue_live',$state)){$state['catalogue_live']=!empty($state['inventory'])||!empty($state['requests'])||!empty($state['orders'])||(int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn()>0;$changed=true;}
    $members=$pdo->query("SELECT u.member_id,u.full_name,u.email,u.status,e.nic,e.phone,e.address,e.city,e.joined_date,e.profile_image,e.bank_name,e.bank_branch,e.account_holder,e.account_number FROM users u LEFT JOIN entrepreneurs e ON e.user_id=u.id WHERE u.role='entrepreneur' AND u.member_id IS NOT NULL")->fetchAll();
    foreach($members as $member){$found=false;foreach($state['entrepreneurs'] ?? [] as $person)if((string)$person['id']===(string)$member['member_id']){$found=true;break;}if(!$found){$state['entrepreneurs'][]=['id'=>(string)$member['member_id'],'name'=>(string)$member['full_name'],'city'=>(string)($member['city'] ?: 'Sri Lanka'),'stage'=>'Trial seller','sales'=>0,'credit'=>0,'used'=>0];$changed=true;}}
    foreach($members as $member)if(!empty($member['account_number']))foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$member['member_id']&&!isset($person['bankDetails'])){$person['bankDetails']=['bank'=>$member['bank_name'],'branch'=>$member['bank_branch'],'holder'=>$member['account_holder'],'account'=>$member['account_number']];$changed=true;}unset($person);
    foreach($members as $member)foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$member['member_id']){
        $before=$person;
        $person['name']=$member['full_name'];$person['email']=$member['email'];$person['active']=$member['status']==='active';
        foreach(['nic','phone','address','city'] as $field)if($member[$field]!==null)$person[$field]=$member[$field];
        if($member['joined_date'])$person['joined']=$member['joined_date'];
        if($member['profile_image'])$person['image']=$member['profile_image'];
        if($member['status']!=='active')$person['stage']='Departed';
        $person['initials']=implode('',array_map(static fn($word)=>substr($word,0,1),array_slice(explode(' ',$person['name']),0,2)));
        if($before!==$person)$changed=true;
        break;
    }unset($person);
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
function market_listings(array $state, ?string $member = null): array {
    $overrides=[];
    foreach($state['inventory'] ?? [] as $item)$overrides[(string)$item['entrepreneurId'].':'.(string)$item['productId']]=$item;
    $listings=[];
    foreach($state['entrepreneurs'] ?? [] as $person){
        $shop=(string)($person['id'] ?? '');
        if($member!==null&&$shop!==$member)continue;
        if(!($person['active'] ?? true)||($person['stage'] ?? '')==='Departed')continue;
        foreach($state['products'] ?? [] as $product){
            $key=$shop.':'.(string)$product['id'];$item=$overrides[$key] ?? [];
            $listings[]=['entrepreneurId'=>$shop,'productId'=>$product['id'],'qty'=>(int)($product['stock'] ?? 0),'price'=>(float)($item['price'] ?? $product['price']),'visible'=>(bool)($item['visible'] ?? true)];
        }
    }
    return $listings;
}
function market_commission_due_at(): string {return date(DATE_ATOM,time()+7*86400);}
function market_collect_payment(array &$order, string $method, string $reference = ''): void {
    if(($order['paymentStatus'] ?? '')==='Collected')return;
    $order['paymentStatus']='Collected';$order['paymentCollectedAt']=date(DATE_ATOM);$order['paymentMethod']=$method;
    if($reference!=='')$order['paymentReference']=$reference;
    $commission=max(0,round((float)($order['commissionAmount'] ?? 0),2));
    $order['commissionStatus']=$commission>0?'Payable':'Not applicable';
    $order['commissionDueAt']=$commission>0?market_commission_due_at():null;
}
function market_apply_payment(array &$state, int $orderIndex, string $method, string $reference = ''): void {
    if(($state['orders'][$orderIndex]['paymentStatus'] ?? '')==='Collected')return;
    market_collect_payment($state['orders'][$orderIndex],$method,$reference);
    $contribution=max(0,round((float)($state['orders'][$orderIndex]['sellerContribution'] ?? 0),2));
    if($contribution>0&&!($state['orders'][$orderIndex]['sellerContributionApplied'] ?? false)){
        $shop=(string)$state['orders'][$orderIndex]['entrepreneurId'];
        foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===$shop){$person['used']=round((float)($person['used'] ?? 0)+$contribution,2);break;}unset($person);
        $state['orders'][$orderIndex]['sellerContributionApplied']=true;
    }
}
function market_public(array $state): array {
    $realEntrepreneurs=array_values(array_filter($state['entrepreneurs'] ?? [],static fn($person)=>($person['active'] ?? true) && !str_starts_with((string)($person['id'] ?? ''),'DEMO-')&&!str_contains(strtolower((string)($person['name'] ?? '')),'(demo)')));
    $realIds=array_map(static fn($person)=>(string)$person['id'],$realEntrepreneurs);
    $publicInventory=array_values(array_filter(market_listings($state),static fn($item)=>($item['visible'] ?? true)===true&&in_array((string)$item['entrepreneurId'],$realIds,true)&&($item['qty'] ?? 0)>0));
    return ['products'=>array_map(static fn($product)=>array_merge($product,['stock'=>($product['stock'] ?? 0)>0?1:0]),$state['products'] ?? []), 'entrepreneurs'=>array_map(static fn($person)=>['id'=>$person['id'],'name'=>$person['name'],'city'=>$person['city'] ?? 'Sri Lanka','stage'=>$person['stage'] ?? 'Trial seller'], $realEntrepreneurs), 'inventory'=>array_map(static fn($item)=>['entrepreneurId'=>$item['entrepreneurId'],'productId'=>$item['productId'],'qty'=>$item['qty']>0?999999:0,'price'=>$item['price'] ?? null],$publicInventory)];
}
require_once __DIR__.'/workflow.php';
function market_route(PDO $pdo, string $path, string $method): void {
    market_ensure_order_schema($pdo);
    customer_route($pdo,$path,$method);
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
        $shop=trim((string)($_GET['shop'] ?? ''));
        if($shop===''){$public['entrepreneurs']=[];$public['inventory']=[];}
        else{
            $public['entrepreneurs']=array_values(array_filter($public['entrepreneurs'],static fn($person)=>(string)$person['id']===$shop));
            $public['inventory']=array_values(array_filter($public['inventory'],static fn($item)=>(string)$item['entrepreneurId']===$shop));
            if(!$public['entrepreneurs'])response(['message'=>'This entrepreneur shop is unavailable. Ask the entrepreneur for an updated link.'],404);
        }
        $public['ratingSummary']=$pdo->query("SELECT product_id AS productId,shop_id AS shopId,AVG(rating) AS average,COUNT(*) AS count FROM customer_reviews WHERE status='Published' GROUP BY product_id,shop_id")->fetchAll();
        if($shop!=='')$public['ratingSummary']=array_values(array_filter($public['ratingSummary'],static fn($entry)=>(string)$entry['shopId']===$shop));
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
            $state['inventory']=market_listings($state);
            response($state);
        }
        $member=(string) $user['member_id'];
        $self=null;foreach($state['entrepreneurs'] ?? [] as $person)if((string)$person['id']===$member){$self=$person;break;}
        // Entrepreneurs receive the complete CAMY product information, but never the
        // warehouse quantity. `stock` is deliberately reduced to an availability flag.
        $entrepreneurProducts=array_map(static fn($product)=>array_merge($product,['stock'=>(($product['stock'] ?? 0)>0?1:0)]),$state['products'] ?? []);
        response(['products'=>$entrepreneurProducts,'catalogue_live'=>$state['catalogue_live'] ?? false,'entrepreneurs'=>market_public($state)['entrepreneurs'],'self'=>$self,'tiers'=>$state['tiers'] ?? [],'inventory'=>market_listings($state,$member),'requests'=>array_values(array_filter($state['requests'] ?? [],static fn($item)=>$item['entrepreneurId']===$member)),'orders'=>array_values(array_filter($state['orders'] ?? [],static fn($item)=>$item['entrepreneurId']===$member)),'settlements'=>array_values(array_filter($state['settlements'] ?? [],static fn($item)=>(string)$item['entrepreneurId']===$member))]);
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
        if($base===null){$pdo->rollBack();response(['message'=>'This CAMY product could not be found.'],404);}
        if($itemIndex===null&&$base!==null){$state['inventory'][]=['entrepreneurId'=>(string)$user['member_id'],'productId'=>$productId,'qty'=>0,'price'=>round((float)$price,2),'visible'=>(bool)($data['visible'] ?? true)];}
        else{$state['inventory'][$itemIndex]['price']=round((float)$price,2);if(array_key_exists('visible',$data))$state['inventory'][$itemIndex]['visible']=(bool)$data['visible'];}
        market_save($pdo,$state);$listings=market_listings($state,(string)$user['member_id']);$pdo->commit();response(['inventory'=>$listings]);
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
        $data=input();$items=workflow_items($data['items'] ?? []);$reference='';
        if(!$items)response(['message'=>'Choose stock for your request.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);if(empty($state['catalogue_live'])){$pdo->rollBack();response(['message'=>'CAMY Admin must verify and activate the real product catalogue before stock can be purchased.'],409);}$clean=[];$total=0;
        foreach($items as $item){$product=null;foreach($state['products'] as $candidate)if((string)$candidate['id']===(string)($item['productId'] ?? '')){$product=$candidate;break;}$qty=(int)($item['qty'] ?? 0);if(!$product||$qty<1||$qty>(int)$product['stock']){$pdo->rollBack();response(['message'=>'A requested product is unavailable at CAMY.'],409);}$clean[]=['productId'=>$product['id'],'qty'=>$qty,'price'=>$product['price']];$total+=$product['price']*$qty;}
        $request=['id'=>'SUP-'.bin2hex(random_bytes(5)),'entrepreneurId'=>(string)$user['member_id'],'entrepreneurName'=>(string)$user['full_name'],'items'=>$clean,'total'=>$total,'reference'=>$reference,'receipt'=>'','receiptName'=>basename((string)($data['receiptName'] ?? 'receipt')),'status'=>'Pending','createdAt'=>date(DATE_ATOM)];
        $file='';
        $pdo->prepare('INSERT INTO stock_supply_requests(id,entrepreneur_member_id,payment_reference,receipt_path,total) VALUES(?,?,?,?,?)')->execute([$request['id'],$request['entrepreneurId'],$reference,$file,$total]);foreach($clean as $item){$code='';foreach($state['products'] as $product)if((string)$product['id']===(string)$item['productId']){$code=(string)($product['code'] ?? $product['id']);break;}$pdo->prepare('INSERT INTO stock_supply_request_items(request_id,product_code,quantity,purchase_price) VALUES(?,?,?,?)')->execute([$request['id'],$code,$item['qty'],$item['price']]);}
        array_unshift($state['requests'],$request);market_save($pdo,$state);$pdo->commit();response(['request'=>$request],201);
    }
    if (preg_match('#^/marketplace/requests/([^/]+)/edit$#',$path,$matches) && $method==='POST') {
        require_admin($pdo);$data=input();$pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
        foreach($state['requests'] as $key=>$request)if($request['id']===$matches[1]){$index=$key;break;}
        if($index===null)response(['message'=>'Request not found.'],404);
        $request=$state['requests'][$index];
        if($request['status']!=='Pending')response(['message'=>'Only pending requests can be edited. Approved requests already have a payment amount and reserved stock.'],409);
        $items=workflow_items($data['items'] ?? []);if(!$items)response(['message'=>'Keep at least one product in the request.'],422);
        $clean=[];$total=0;
        foreach($items as $item){
            $original=null;$product=null;
            foreach($request['items'] as $candidate)if((string)$candidate['productId']===(string)$item['productId']){$original=$candidate;break;}
            foreach($state['products'] as $candidate)if((string)$candidate['id']===(string)$item['productId']){$product=$candidate;break;}
            $price=filter_var($item['price'] ?? null,FILTER_VALIDATE_FLOAT);
            if(!$original||!$product||$item['qty']>(int)$product['stock']||$price===false||!is_finite($price)||$price<=0||$price>100000000)response(['message'=>'Use available quantities and a valid positive unit price.'],422);
            $price=round($price,2);$clean[]=['productId'=>$original['productId'],'qty'=>$item['qty'],'price'=>$price];$total+=$price*$item['qty'];
        }
        $state['requests'][$index]['items']=$clean;$state['requests'][$index]['total']=round($total,2);$state['requests'][$index]['updatedAt']=date(DATE_ATOM);
        $pdo->prepare('UPDATE stock_supply_requests SET total=? WHERE id=?')->execute([round($total,2),$request['id']]);
        $pdo->prepare('DELETE FROM stock_supply_request_items WHERE request_id=?')->execute([$request['id']]);
        foreach($clean as $item){$code='';foreach($state['products'] as $product)if((string)$product['id']===(string)$item['productId']){$code=(string)($product['code'] ?? $product['id']);break;}$pdo->prepare('INSERT INTO stock_supply_request_items(request_id,product_code,quantity,purchase_price) VALUES(?,?,?,?)')->execute([$request['id'],$code,$item['qty'],$item['price']]);}
        market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if (preg_match('#^/marketplace/requests/([^/]+)/(approve|reject|dispatch)$#',$path,$matches) && $method==='POST') {
        require_admin($pdo);$pdo->beginTransaction();$state=market_state($pdo,true);$found=null;
        foreach($state['requests'] as $index=>$request)if($request['id']===$matches[1]){$found=$index;break;}
        if($found===null){$pdo->rollBack();response(['message'=>'Stock request not found.'],404);}
        $request=$state['requests'][$found];$action=$matches[2];$next=['approve'=>'Awaiting payment','reject'=>'Rejected','dispatch'=>'Dispatched'][$action];
        workflow_transition($request['status'],$next,true);
        if($action==='approve'){$bank=$state['camyBank'] ?? [];workflow_bank_required($bank);workflow_reserve($state,$request['items'],null);$state['requests'][$found]['reserved']=true;$state['requests'][$found]['bankDetails']=$bank;}
        if($action==='reject'&&!empty($request['reserved'])){workflow_release($state,$request['items'],null);$state['requests'][$found]['reserved']=false;}
        if($action==='dispatch'&&!array_key_exists('reserved',$request))workflow_reserve($state,$request['items'],null);
        if($action==='dispatch')foreach($request['items'] as $item){$foundInventory=false;foreach($state['inventory'] as &$inventory)if((string)$inventory['entrepreneurId']===(string)$request['entrepreneurId']&&(string)$inventory['productId']===(string)$item['productId']){$inventory['qty']+=$item['qty'];$foundInventory=true;break;}unset($inventory);if(!$foundInventory)$state['inventory'][]=['entrepreneurId'=>$request['entrepreneurId'],'productId'=>$item['productId'],'qty'=>$item['qty'],'price'=>$item['price']];}
        $state['requests'][$found]['status']=$next;$state['requests'][$found]['reviewedAt']=date(DATE_ATOM);$pdo->prepare('UPDATE stock_supply_requests SET status=?,reviewed_at=NOW() WHERE id=?')->execute([$next,$request['id']]);market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if ($path === '/marketplace/orders' && $method === 'POST') {
        $account=customer_required($pdo);
        $data=input();if(!is_array($data['customer'] ?? null))response(['message'=>'Enter delivery details.'],422);
        $customer=customer_details($data['customer']);$items=workflow_items($data['items'] ?? [],true);$name=$customer['name'];$phone=$customer['phone'];$district=$customer['district'];$address=$customer['address'];
        $requestKey=(string)($data['requestKey'] ?? '');
        if($requestKey!==''&&!preg_match('/^[a-zA-Z0-9-]{16,64}$/',$requestKey))response(['message'=>'Invalid checkout reference. Refresh and try again.'],422);
        $paymentMethod=(string)($data['paymentMethod'] ?? 'bank_transfer');
        if(!in_array($paymentMethod,['bank_transfer','cash_on_delivery'],true))response(['message'=>'Choose bank transfer or cash on delivery.'],422);
        $payloadHash=hash('sha256',storage_json([$customer,$items,$paymentMethod]));
        if(!$name||!preg_match('/^(?:\+94|0)7\d{8}$/',$phone)||!$district||!$address||!is_array($items)||!$items) response(['message'=>'Enter a valid name, Sri Lankan mobile number, district, address and cart.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);$groups=[];
        if($requestKey!==''){
            $query=$pdo->prepare('SELECT payload_hash,response_json FROM customer_checkout_requests WHERE customer_id=? AND request_key=?');$query->execute([$account['id'],$requestKey]);$previous=$query->fetch();
            if($previous){
                if(!hash_equals($previous['payload_hash'],$payloadHash))response(['message'=>'This checkout reference belongs to a different cart. Review your cart and try again.'],409);
                $pdo->commit();response(json_decode($previous['response_json'],true,64,JSON_THROW_ON_ERROR),201);
            }
        }
        foreach($items as $item){$shop=(string)($item['shopId'] ?? '');$productId=(string)($item['productId'] ?? '');$qty=(int)($item['qty'] ?? 0);$person=null;$product=null;$listing=null;foreach($state['entrepreneurs'] as $candidate)if((string)$candidate['id']===$shop){$person=$candidate;break;}foreach($state['products'] as $candidate)if((string)$candidate['id']===$productId){$product=$candidate;break;}foreach(market_listings($state,$shop) as $candidate)if((string)$candidate['productId']===$productId){$listing=$candidate;break;}if(!$person||!($person['active'] ?? true)||($person['stage'] ?? '')==='Departed'||!$product||!$listing||!($listing['visible'] ?? true)||$qty<1||$qty>(int)$product['stock']){$pdo->rollBack();response(['message'=>'A cart item is no longer available from CAMY.'],409);}$sellPrice=(float)$listing['price'];if(!isset($item['expectedPrice'])||abs((float)$item['expectedPrice']-$sellPrice)>0.009){$pdo->rollBack();response(['message'=>'A shop price changed. Refresh the page and review your cart before ordering.'],409);}$groups[$shop]['person']=$person;$groups[$shop]['items'][]=['id'=>$product['id'],'name'=>$product['name'],'qty'=>$qty,'price'=>$sellPrice,'basePrice'=>(float)$product['price'],'image'=>$product['image'] ?? '', 'category'=>$product['category'] ?? 'Other'];}
        if(count($groups)!==1){$pdo->rollBack();response(['message'=>'Use one entrepreneur shop link per order. Products from other shops cannot be combined.'],409);}
        $ids=[];$tracking=[];$groupId='SHOP-'.bin2hex(random_bytes(5));$pdo->prepare('INSERT INTO customer_order_groups(id,customer_name,customer_phone,district,delivery_address) VALUES(?,?,?,?,?)')->execute([$groupId,$name,$phone,$district,$address]);foreach($groups as $shop=>$group){$selected=$group['items'];workflow_reserve($state,$selected,null);$total=0;$camyAmount=0;$count=0;foreach($selected as $item){$total+=$item['price']*$item['qty'];$camyAmount+=$item['basePrice']*$item['qty'];$count+=$item['qty'];}$commission=round($total-$camyAmount,2);$id='CMY-'.bin2hex(random_bytes(5));$ids[]=$id;$token=bin2hex(random_bytes(24));$tracking[]=['id'=>$id,'token'=>$token];$state['orders'][]=['id'=>$id,'groupId'=>$groupId,'customerId'=>(int)$account['id'],'customer'=>$name,'phone'=>$phone,'district'=>$district,'address'=>$address.', '.$district,'product'=>count($selected)===1?$selected[0]['name']:count($selected).' CAMY products','items'=>$selected,'qty'=>$count,'amount'=>round($total,2),'camyAmount'=>round($camyAmount,2),'commissionAmount'=>$commission,'sellerContribution'=>max(0,-$commission),'commissionStatus'=>'Not eligible','paymentMethod'=>$paymentMethod,'paymentStatus'=>$paymentMethod==='cash_on_delivery'?'COD pending':'Awaiting payment','date'=>date('Y-m-d'),'createdAt'=>date(DATE_ATOM),'status'=>'Pending','trackingToken'=>$token,'reserved'=>true,'entrepreneur'=>$group['person']['name'],'entrepreneurId'=>$shop,'source'=>'shop'];$pdo->prepare("INSERT INTO shop_orders(id,group_id,entrepreneur_member_id,total,camy_amount,commission_amount,payment_method,payment_status,commission_status,status) VALUES(?,?,?,?,?,?,?,?,?,'Pending')")->execute([$id,$groupId,$shop,round($total,2),round($camyAmount,2),$commission,$paymentMethod,$paymentMethod==='cash_on_delivery'?'COD pending':'Awaiting payment','Not eligible']);foreach($selected as $item){$code='';foreach($state['products'] as $product)if((string)$product['id']===(string)$item['id']){$code=(string)($product['code'] ?? $item['id']);break;}$pdo->prepare('INSERT INTO shop_order_items(order_id,product_code,quantity,sell_price,camy_unit_price,commission_amount) VALUES(?,?,?,?,?,?)')->execute([$id,$code,$item['qty'],$item['price'],$item['basePrice'],round(($item['price']-$item['basePrice'])*$item['qty'],2)]);}}
        $result=['ids'=>$ids,'tracking'=>$tracking];
        if($requestKey!=='')$pdo->prepare('INSERT INTO customer_checkout_requests(customer_id,request_key,payload_hash,response_json) VALUES(?,?,?,?)')->execute([$account['id'],$requestKey,$payloadHash,storage_json($result)]);
        customer_save($pdo,(int)$account['id'],$customer);market_save($pdo,$state);$pdo->commit();response($result,201);
    }
    if (preg_match('#^/marketplace/orders/([^/]+)/status$#',$path,$matches) && $method==='POST') {
        $user=current_user($pdo);if(!$user)response(['message'=>'Authentication required.'],401);$data=input();$status=(string)($data['status'] ?? '');
        $pdo->beginTransaction();$state=market_state($pdo,true);$index=null;foreach($state['orders'] as $key=>$order)if($order['id']===$matches[1]){$index=$key;break;}if($index===null){$pdo->rollBack();response(['message'=>'Shop order not found.'],404);}
        $order=$state['orders'][$index];if(!in_array($user['role'],['admin','manager'],true))response(['message'=>'CAMY Operations manages payment, stock and delivery updates.'],403);if($status==='Returned'&&!empty($order['return']))response(['message'=>'Complete the return review and receipt flow first.'],409);
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
        if($status==='Awaiting payment'){$bank=$state['camyBank'] ?? [];workflow_bank_required($bank);if(($order['paymentMethod'] ?? 'bank_transfer')!=='bank_transfer')response(['message'=>'Cash-on-delivery orders do not require bank payment.'],409);$state['orders'][$index]['bankDetails']=$bank;}
        if($order['status']==='Pending'&&$status==='Processing'&&($order['paymentMethod'] ?? '')!=='cash_on_delivery')response(['message'=>'Only cash-on-delivery orders can be approved without a receipt.'],409);
        if($order['status']==='Payment review'&&$status==='Processing')market_apply_payment($state,$index,'bank_transfer',(string)($order['reference'] ?? ''));
        if(in_array($status,['Rejected','Returned'],true)&&($order['reserved'] ?? true)){workflow_release($state,$order['items'],null);$state['orders'][$index]['reserved']=false;}
        if($order['status']==='Payment review'&&$status==='Awaiting payment'){$reason=trim((string)($data['reason'] ?? ''));if(!$reason)response(['message'=>'Explain why the receipt was rejected.'],422);$state['orders'][$index]['paymentNote']=$reason;}
        $state['orders'][$index]['updatedAt']=date(DATE_ATOM);
        $state['orders'][$index]['status']=$status;$pdo->prepare('UPDATE shop_orders SET status=? WHERE id=?')->execute([$status,$matches[1]]);$shop=$state['orders'][$index]['entrepreneurId'];$sales=0;foreach($state['orders'] as $entry)if($entry['entrepreneurId']===$shop&&$entry['status']==='Delivered')$sales+=(float)$entry['amount'];$credit=0;foreach($state['tiers'] as $tier)if((float)$tier['sales']<=$sales&&$tier['credit']>$credit)$credit=(float)$tier['credit'];foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$shop){$person['sales']=$sales;$person['credit']=$credit;$person['stage']=$credit>0?'Credit eligible':'Trial seller';break;}unset($person);
        market_save($pdo,$state);$pdo->commit();response(['orders'=>array_values(array_filter($state['orders'],static fn($entry)=>in_array($user['role'],['admin','manager'],true)||(string)$entry['entrepreneurId']===(string)$user['member_id'])),'inventory'=>in_array($user['role'],['admin','manager'],true)?market_listings($state):market_listings($state,(string)$user['member_id']),'entrepreneurs'=>array_values(array_filter($state['entrepreneurs'],static fn($entry)=>in_array($user['role'],['admin','manager'],true)||(string)$entry['id']===(string)$user['member_id']))]);
    }
    if(preg_match('#^/marketplace/orders/([^/]+)/(collect-cod|pay-commission)$#',$path,$matches)&&$method==='POST'){
        $admin=require_admin($pdo);$data=input();$pdo->beginTransaction();$state=market_state($pdo,true);$index=null;foreach($state['orders'] as $key=>$order)if($order['id']===$matches[1]){$index=$key;break;}if($index===null)response(['message'=>'Order not found.'],404);$order=$state['orders'][$index];
        if($matches[2]==='collect-cod'){
            if(($order['paymentMethod'] ?? '')!=='cash_on_delivery'||$order['status']!=='Delivered'||($order['paymentStatus'] ?? '')==='Collected')response(['message'=>'COD can be collected once, after delivery.'],409);
            $reference=trim((string)($data['reference'] ?? ''));if(!$reference||strlen($reference)>120)response(['message'=>'Enter the courier remittance or cash collection reference.'],422);market_apply_payment($state,$index,'cash_on_delivery',$reference);
        }else{
            if(($order['commissionStatus'] ?? '')!=='Payable')response(['message'=>'This commission is not currently payable.'],409);$bank=[];foreach($state['entrepreneurs'] as $person)if((string)$person['id']===(string)$order['entrepreneurId']){$bank=$person['bankDetails'] ?? [];break;}workflow_bank_required($bank);$reference=trim((string)($data['reference'] ?? ''));if(!$reference||strlen($reference)>120)response(['message'=>'Enter the bank transfer reference.'],422);$state['orders'][$index]['commissionStatus']='Paid';$state['orders'][$index]['commissionPaidAt']=date(DATE_ATOM);$state['orders'][$index]['commissionReference']=$reference;$state['orders'][$index]['commissionPaidBy']=(int)$admin['id'];$state['orders'][$index]['commissionBank']=$bank;
        }
        $state['orders'][$index]['updatedAt']=date(DATE_ATOM);market_save($pdo,$state);$pdo->commit();response(['order'=>$state['orders'][$index],'state'=>$state]);
    }
}
