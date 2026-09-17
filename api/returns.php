<?php
declare(strict_types=1);

function return_route(PDO $pdo,string $path,string $method): void {
    if(!preg_match('#^/marketplace/orders/([^/]+)/return/(request|approve|reject|ship|receive|refund)$#',$path,$match)||$method!=='POST')return;
    $action=$match[2];$data=input();
    $customer=in_array($action,['request','ship'],true)?customer_required($pdo):null;
    $user=$customer?null:current_user($pdo);
    if(!$customer&&!$user)response(['message'=>'Seller login required.'],401);
    $pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
    foreach($state['orders'] as $key=>$entry)if($entry['id']===$match[1]){$index=$key;break;}
    if($index===null)response(['message'=>'Order not found.'],404);
    $order=&$state['orders'][$index];
    if($customer&&(int)($order['customerId']??0)!==(int)$customer['id'])response(['message'=>'This order belongs to another customer.'],403);
    if($user)workflow_owner($user,(string)$order['entrepreneurId']);
    $return=$order['return']??[];$stage=$return['status']??'';
    $text=static function(string $key,int $min,int $max)use($data):string{$value=trim((string)($data[$key]??''));if(strlen($value)<$min||strlen($value)>$max||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value))response(['message'=>'Enter valid '.str_replace('_',' ',$key).' ('.$min.'–'.$max.' characters).'],422);return $value;};
    if($action==='request'){
        if($order['status']!=='Delivered'||$stage!=='')response(['message'=>'A delivered order can have one return request.'],409);
        $return=['status'=>'Requested','reason'=>$text('reason',8,1000),'requestedAt'=>date(DATE_ATOM)];
    }elseif($action==='approve'||$action==='reject'){
        if($stage!=='Requested')response(['message'=>'This return has already been reviewed.'],409);
        $return['status']=$action==='approve'?'Approved':'Rejected';$return['reviewedAt']=date(DATE_ATOM);
        $return[$action==='approve'?'instructions':'decisionReason']=$text($action==='approve'?'instructions':'reason',8,2000);
    }elseif($action==='ship'){
        if($stage!=='Approved')response(['message'=>'Wait for return approval before sending the parcel.'],409);
        $return['trackingNumber']=$text('trackingNumber',1,120);$return['courier']=$text('courier',1,120);
        $return['status']='Shipped';$return['shippedAt']=date(DATE_ATOM);
    }elseif($action==='receive'){
        if($stage!=='Shipped'||$order['status']!=='Delivered')response(['message'=>'Only a shipped return can be confirmed received.'],409);
        if($order['reserved']??true){workflow_release($state,$order['items'],(string)$order['entrepreneurId']);$order['reserved']=false;}
        $return['status']='Received';$return['receivedAt']=date(DATE_ATOM);$return['refundStatus']='Pending';$return['refundAmount']=(float)$order['amount'];
        $order['status']='Returned';$pdo->prepare("UPDATE shop_orders SET status='Returned' WHERE id=?")->execute([$order['id']]);
        $sales=0;foreach($state['orders'] as $entry)if($entry['entrepreneurId']===$order['entrepreneurId']&&$entry['status']==='Delivered')$sales+=(float)$entry['amount'];
        $credit=0;foreach($state['tiers'] as $tier)if((float)$tier['sales']<=$sales)$credit=max($credit,(float)$tier['credit']);
        foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===(string)$order['entrepreneurId']){$person['sales']=$sales;$person['credit']=$credit;$person['stage']=$credit>0?'Credit eligible':'Trial seller';break;}unset($person);
    }else{
        if($stage!=='Received'||($return['refundStatus']??'')!=='Pending')response(['message'=>'This return is not awaiting a refund.'],409);
        $return['refundReference']=$text('reference',1,120);$return['refundStatus']='Refunded';$return['refundedAt']=date(DATE_ATOM);
    }
    $order['return']=$return;$order['updatedAt']=date(DATE_ATOM);$result=$order;unset($order);
    market_save($pdo,$state);$pdo->commit();if($customer&&!empty($result['receipt']))$result['receipt'].='?token='.rawurlencode((string)$result['trackingToken']);unset($result['trackingToken'],$result['receiptPath']);
    response(['order'=>$result]);
}
