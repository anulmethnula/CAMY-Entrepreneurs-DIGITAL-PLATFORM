<?php
declare(strict_types=1);

function workflow_owner(array $user, string $member): void {
    if(!in_array($user['role'],['admin','manager'],true)&&($user['role']!=='entrepreneur'||(string)$user['member_id']!==$member))response(['message'=>'You cannot review another shop order.'],403);
}
function workflow_transition(string $old,string $next,bool $supply): void {
    $allowed=['Pending'=>['Awaiting payment','Rejected'],'Awaiting payment'=>['Rejected'],'Payment review'=>['Processing','Awaiting payment'],'Processing'=>['Dispatched'],'Dispatched'=>['Delivered','Returned'],'Delivered'=>['Returned']];
    if($supply){$allowed['Payment review']=['Approved','Awaiting payment'];$allowed['Approved']=['Dispatched'];}
    if(!in_array($next,$allowed[$old] ?? [],true))response(['message'=>'This action is not available at the current stage.'],409);
}
function workflow_bank_required(array $bank): void {
    foreach(['bank','branch','holder','account'] as $key)if(empty($bank[$key]))response(['message'=>'Save complete bank details before approving requests.'],422);
}
function workflow_items($items,bool $shops=false): array {
    if(!is_array($items))return [];if(count($items)>100)response(['message'=>'Use up to 100 products per request.'],422);$clean=[];
    foreach($items as $item){if(!is_array($item))response(['message'=>'Invalid item.'],422);$qty=filter_var($item['qty'] ?? null,FILTER_VALIDATE_INT);if(!$qty||$qty<1||$qty>1000000)response(['message'=>'Quantities must be positive whole numbers.'],422);$key=($shops?(string)($item['shopId'] ?? '').':':'').(string)($item['productId'] ?? '');if(isset($clean[$key]))$clean[$key]['qty']+=$qty;else{$item['qty']=$qty;$clean[$key]=$item;}}
    return array_values($clean);
}
function workflow_reserve(array &$state,array $items,?string $shop): void {
    foreach($items as $item){$id=(string)($item['productId'] ?? $item['id']);$found=false;
        if($shop===null){foreach($state['products'] as &$slot)if((string)$slot['id']===$id){if($slot['stock']<$item['qty'])response(['message'=>'Insufficient CAMY stock to approve this request.'],409);$slot['stock']-=$item['qty'];$found=true;break;}unset($slot);}
        else{foreach($state['inventory'] as &$slot)if((string)$slot['entrepreneurId']===$shop&&(string)$slot['productId']===$id){if($slot['qty']<$item['qty'])response(['message'=>'Insufficient shop stock to approve this order.'],409);$slot['qty']-=$item['qty'];$found=true;break;}unset($slot);}
        if(!$found)response(['message'=>'Requested product is unavailable.'],409);
    }
}
function workflow_release(array &$state,array $items,?string $shop): void {
    foreach($items as $item){$id=(string)($item['productId'] ?? $item['id']);if($shop===null){foreach($state['products'] as &$slot)if((string)$slot['id']===$id){$slot['stock']+=$item['qty'];break;}unset($slot);}else{foreach($state['inventory'] as &$slot)if((string)$slot['entrepreneurId']===$shop&&(string)$slot['productId']===$id){$slot['qty']+=$item['qty'];break;}unset($slot);}}
}
function workflow_receipt(array $data,string $id): string {
    $raw=(string)($data['receipt'] ?? '');$ref=trim((string)($data['reference'] ?? ''));
    if(!$ref||strlen($ref)>120||strlen($raw)>7500000||!preg_match('#^data:(image/(?:png|jpeg|webp)|application/pdf);base64,(.+)$#s',$raw,$parts))response(['message'=>'Enter a reference and upload a JPG, PNG, WebP or PDF receipt up to 5 MB.'],422);
    $bytes=base64_decode($parts[2],true);if(!$bytes||strlen($bytes)>5*1024*1024)response(['message'=>'Invalid receipt or file exceeds 5 MB.'],422);
    if((str_starts_with($parts[1],'image/')&&((getimagesizefromstring($bytes)['mime'] ?? '')!==$parts[1]))||($parts[1]==='application/pdf'&&!str_starts_with($bytes,'%PDF-')))response(['message'=>'Receipt content does not match the file type.'],422);
    $dir=__DIR__.'/../private/receipts';if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Could not create receipt storage.');
    $file=$id.'-'.bin2hex(random_bytes(8)).'.'.['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp','application/pdf'=>'pdf'][$parts[1]];
    if(file_put_contents($dir.'/'.$file,$bytes)===false)throw new RuntimeException('Could not save receipt.');return $file;
}
function workflow_route(PDO $pdo,string $path,string $method): void {
    if(preg_match('#^/marketplace/orders/([^/]+)/confirm-delivery$#',$path,$match)&&$method==='POST'){
        $customer=customer_required($pdo);$pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
        foreach($state['orders'] as $key=>$order)if($order['id']===$match[1]){$index=$key;break;}
        if($index===null)response(['message'=>'Order not found.'],404);
        $order=$state['orders'][$index];
        if((int)($order['customerId']??0)!==(int)$customer['id'])response(['message'=>'This order belongs to another customer.'],403);
        if(!in_array($order['status'],['Dispatched','Delivered'],true)||!empty($order['return']))response(['message'=>'Only dispatched or delivered orders without a return can be confirmed.'],409);
        if(empty($order['deliveryConfirmations']['customer'])){
            $state['orders'][$index]['deliveryConfirmations']['customer']=['id'=>(int)$customer['id'],'name'=>$customer['name'],'at'=>date(DATE_ATOM)];
            $state['orders'][$index]['status']='Delivered';$state['orders'][$index]['updatedAt']=date(DATE_ATOM);
            $pdo->prepare("UPDATE shop_orders SET status='Delivered' WHERE id=?")->execute([$order['id']]);
            $shop=$order['entrepreneurId'];$sales=0;foreach($state['orders'] as $entry)if($entry['entrepreneurId']===$shop&&$entry['status']==='Delivered')$sales+=(float)$entry['amount'];
            $credit=0;foreach($state['tiers'] as $tier)if((float)$tier['sales']<=$sales)$credit=max($credit,(float)$tier['credit']);
            foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$shop){$person['sales']=$sales;$person['credit']=$credit;$person['stage']=$credit>0?'Credit eligible':'Trial seller';break;}unset($person);
            market_save($pdo,$state);
        }
        $result=$state['orders'][$index];$token=(string)($result['trackingToken']??'');unset($result['trackingToken'],$result['receiptPath']);
        if(!empty($result['receipt']))$result['receipt'].='?token='.rawurlencode($token);
        $pdo->commit();response(['order'=>$result]);
    }
    if($path==='/marketplace/shop-contact'&&$method==='POST'){
        $user=current_user($pdo);
        if(!$user||$user['role']!=='entrepreneur'||!$user['member_id'])response(['message'=>'Entrepreneur access is required.'],403);
        $data=input();$raw=trim((string)($data['phone']??''));$phone=preg_replace('/[\s-]/','',$raw);
        if(strlen($raw)>30||!preg_match('/^(?:\+94|0)7\d{8}$/',$phone))response(['message'=>'Enter a valid Sri Lankan mobile number, such as 0771234567.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
        foreach($state['entrepreneurs'] as $key=>$person)if((string)$person['id']===(string)$user['member_id']){$index=$key;break;}
        if($index===null){$pdo->rollBack();response(['message'=>'Your shop could not be found.'],404);}
        $pdo->prepare('UPDATE entrepreneurs SET phone=? WHERE user_id=? AND member_id=?')->execute([$phone,$user['id'],$user['member_id']]);
        $state['entrepreneurs'][$index]['phone']=$phone;market_save($pdo,$state);$pdo->commit();response(['phone'=>$phone]);
    }
    if($path==='/marketplace/credit/settlements' && $method==='POST'){
        $user=current_user($pdo);if(!$user||$user['role']!=='entrepreneur'||!$user['member_id'])response(['message'=>'Entrepreneur access is required.'],403);
        $data=input();$amount=filter_var($data['amount'] ?? null,FILTER_VALIDATE_FLOAT);$reference=trim((string)($data['reference'] ?? ''));
        if($amount===false||!is_finite($amount)||$amount<=0||$amount>100000000||!$reference||strlen($reference)>100)response(['message'=>'Enter a valid settlement amount and payment reference.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);$personIndex=null;foreach($state['entrepreneurs'] as $index=>$person)if((string)$person['id']===(string)$user['member_id']){$personIndex=$index;break;}
        if($personIndex===null)response(['message'=>'Your entrepreneur account could not be found.'],404);$outstanding=(float)($state['entrepreneurs'][$personIndex]['used'] ?? 0);if($outstanding<=0)response(['message'=>'There is no outstanding credit balance to settle.'],409);if($amount>$outstanding+0.009)response(['message'=>'Settlement cannot exceed the current outstanding balance.'],422);
        $pending=0;foreach($state['settlements'] as $entry)if((string)$entry['entrepreneurId']===(string)$user['member_id']){
            if($entry['reference']===$reference && $entry['status']!=='Rejected')response(['message'=>'This payment reference has already been submitted.'],409);
            if($entry['status']==='Pending verification')$pending+=(float)$entry['amount'];
        }
        if($amount+$pending>$outstanding+0.009)response(['message'=>'This amount plus pending settlements exceeds your outstanding balance. Wait for pending payments to be verified.'],422);
        $record=['id'=>'SET-'.bin2hex(random_bytes(5)),'entrepreneurId'=>(string)$user['member_id'],'amount'=>round($amount,2),'reference'=>$reference,'status'=>'Pending verification','createdAt'=>date(DATE_ATOM)];$state['settlements'][]=$record;market_save($pdo,$state);$pdo->commit();response(['settlement'=>$record],201);
    }
    if(preg_match('#^/marketplace/credit/settlements/([^/]+)/(verify|reject)$#',$path,$matches)&&$method==='POST'){
        require_admin($pdo);$pdo->beginTransaction();$state=market_state($pdo,true);$index=null;foreach($state['settlements'] ?? [] as $key=>$item)if($item['id']===$matches[1]){$index=$key;break;}if($index===null)response(['message'=>'Settlement not found.'],404);$settlement=$state['settlements'][$index];if($settlement['status']!=='Pending verification')response(['message'=>'Settlement has already been reviewed.'],409);
        $next=$matches[2]==='verify'?'Verified':'Rejected';$state['settlements'][$index]['status']=$next;$state['settlements'][$index]['reviewedAt']=date(DATE_ATOM);if($next==='Verified')foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$settlement['entrepreneurId']){if((float)$settlement['amount']>(float)($person['used'] ?? 0)+0.009)response(['message'=>'The outstanding balance changed. Review this payment before verification.'],409);$person['used']=max(0,round((float)($person['used'] ?? 0)-(float)$settlement['amount'],2));break;}unset($person);
        market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if($path==='/marketplace/bank'&&$method==='POST'){
        $user=current_user($pdo);if(!$user)response(['message'=>'Authentication required.'],401);$data=input();$bank=[];foreach(['bank','branch','holder','account'] as $key){$bank[$key]=trim((string)($data[$key] ?? ''));if(strlen($bank[$key])>120)response(['message'=>'Bank detail is too long.'],422);}workflow_bank_required($bank);
        $pdo->beginTransaction();$state=market_state($pdo,true);
        if(in_array($user['role'],['admin','manager'],true))$state['camyBank']=$bank;
        elseif($user['role']==='entrepreneur'&&$user['member_id']){foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$user['member_id']){$person['bankDetails']=$bank;break;}unset($person);$pdo->prepare('UPDATE entrepreneurs SET bank_name=?,bank_branch=?,account_holder=?,account_number=? WHERE user_id=?')->execute([$bank['bank'],$bank['branch'],$bank['holder'],$bank['account'],$user['id']]);}
        else response(['message'=>'Seller access required.'],403);
        market_save($pdo,$state);$pdo->commit();response(['bank'=>$bank]);
    }
    if(preg_match('#^/marketplace/(orders|requests)/([^/]+)/(tracking|receipt|verify|retry)$#',$path,$m)){
        $supply=$m[1]==='requests';$action=$m[3];$data=$method==='POST'?input():[];$user=current_user($pdo);
        $pdo->beginTransaction();$state=market_state($pdo,true);$list=$supply?'requests':'orders';$index=null;foreach($state[$list] as $i=>$row)if($row['id']===$m[2]){$index=$i;break;}if($index===null)response(['message'=>'Order not found.'],404);
        $row=$state[$list][$index];$token=(string)($data['token'] ?? $_GET['token'] ?? '');$customer=!$supply&&!empty($row['trackingToken'])&&hash_equals($row['trackingToken'],$token);
        if(!$customer){if(!$user)response(['message'=>'A private tracking link or seller login is required.'],401);workflow_owner($user,(string)$row['entrepreneurId']);}
        if($action==='tracking'&&$method==='GET'){
            if(!$supply){
                $row['sellerPhone']='';
                foreach($state['entrepreneurs'] as $person)if((string)$person['id']===(string)$row['entrepreneurId']){$row['sellerPhone']=(string)($person['phone']??'');break;}
            }
            unset($row['trackingToken'],$row['receiptPath']);if($customer&&!empty($row['receipt']))$row['receipt'].='?token='.rawurlencode($token);$pdo->commit();response(['order'=>$row]);
        }
        if($action==='receipt'&&$method==='GET'){
            $receiptPath=$row['receiptPath'] ?? '';if(!$receiptPath&&$supply){$q=$pdo->prepare('SELECT receipt_path FROM stock_supply_requests WHERE id=?');$q->execute([$row['id']]);$receiptPath=$q->fetchColumn() ?: '';}
            $file=__DIR__.'/../private/receipts/'.basename((string)$receiptPath);if(!is_file($file))response(['message'=>'Receipt not found.'],404);$pdo->commit();header('Content-Type: '.(mime_content_type($file) ?: 'application/octet-stream'));header('Content-Disposition: inline; filename="'.basename($file).'"');header('Content-Length: '.filesize($file));readfile($file);exit;
        }
        if($method!=='POST')response(['message'=>'Method not allowed.'],405);
        if($action==='receipt'){
            if(!$supply&&!$customer)response(['message'=>'Use the customer tracking link to upload payment proof.'],403);
            if($supply&&(!$user||$user['role']!=='entrepreneur'||(string)$user['member_id']!==(string)$row['entrepreneurId']))response(['message'=>'Only the buyer may upload the receipt.'],403);
            if($row['status']!=='Awaiting payment')response(['message'=>'Wait for approval before paying and uploading a receipt.'],409);
            $file=workflow_receipt($data,$row['id']);$state[$list][$index]['receiptPath']=$file;$state[$list][$index]['receipt']='/api/marketplace/'.$m[1].'/'.$row['id'].'/receipt';$state[$list][$index]['receiptName']=basename((string)($data['receiptName'] ?? 'receipt'));$state[$list][$index]['reference']=trim((string)$data['reference']);$state[$list][$index]['status']='Payment review';$state[$list][$index]['receiptUploadedAt']=date(DATE_ATOM);$state[$list][$index]['paymentNote']='';
            if($supply)$pdo->prepare('UPDATE stock_supply_requests SET payment_reference=?,receipt_path=? WHERE id=?')->execute([trim((string)$data['reference']),$file,$row['id']]);
        }elseif(in_array($action,['verify','retry'],true)){
            if(!$user)response(['message'=>'Seller login required.'],401);workflow_owner($user,(string)$row['entrepreneurId']);if($supply&&!in_array($user['role'],['admin','manager'],true))response(['message'=>'CAMY Admin must verify stock payments.'],403);
            if($action==='verify'&&empty($row['receipt']))response(['message'=>'A payment receipt is required before verification.'],409);$next=$action==='verify'?($supply?'Approved':'Processing'):'Awaiting payment';workflow_transition($row['status'],$next,$supply);if($supply&&$action==='verify'&&!array_key_exists('reserved',$row)){workflow_reserve($state,$row['items'],null);$state[$list][$index]['reserved']=true;}if($action==='retry'){$reason=trim((string)($data['reason'] ?? ''));if(!$reason||strlen($reason)>500)response(['message'=>'Enter a receipt correction reason up to 500 characters.'],422);$state[$list][$index]['paymentNote']=$reason;}$state[$list][$index]['status']=$next;
        }else response(['message'=>'Invalid action.'],422);
        $state[$list][$index]['updatedAt']=date(DATE_ATOM);$table=$supply?'stock_supply_requests':'shop_orders';$pdo->prepare("UPDATE $table SET status=? WHERE id=?")->execute([$state[$list][$index]['status'],$row['id']]);market_save($pdo,$state);$pdo->commit();$row=$state[$list][$index];unset($row['trackingToken'],$row['receiptPath']);if($customer&&!empty($row['receipt']))$row['receipt'].='?token='.rawurlencode($token);response(['order'=>$row]);
    }
}
