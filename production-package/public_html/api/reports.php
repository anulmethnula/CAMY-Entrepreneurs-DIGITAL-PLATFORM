<?php
declare(strict_types=1);

function report_pick(array $record,array $keys): array {
    return array_intersect_key($record,array_flip($keys));
}
function reports_route(PDO $pdo,string $path,string $method): void {
    if($path!=='/admin/reports/data'||$method!=='GET')return;
    $user=current_user($pdo);
    if(!$user)response(['message'=>'Authentication required.'],401);
    if(!in_array($user['role'],['admin','manager'],true))response(['message'=>'Management reports access required.'],403);
    $permissions=json_decode($user['permissions_json'] ?? 'null',true);
    if($user['role']==='manager' && !in_array('reports',is_array($permissions)?$permissions:[],true))response(['message'=>'Your staff role does not allow reports.'],403);
    $finance=$user['role']==='admin'||in_array('payouts',$permissions ?? [],true);
    $credit=$user['role']==='admin'||in_array('credit-control',$permissions ?? [],true)||in_array('credit-settlements',$permissions ?? [],true);
    $state=market_state($pdo);
    $people=[];
    foreach($state['entrepreneurs'] as $person){
        $safe=report_pick($person,['id','name','active','joined','stage']);
        if($credit)$safe+=report_pick($person,['sales','credit','used']);
        if($finance)$safe['bankDetails']=report_pick($person['bankDetails'] ?? [],['bank','branch','holder','account']);
        $people[]=$safe;
    }
    $orders=[];
    foreach($state['orders'] as $order){
        $safe=report_pick($order,['id','date','createdAt','deliveredAt','updatedAt','cancelledAt','status','entrepreneurId','entrepreneur','customer','phone','phone2','district','address','source','orderMode','product','qty','amount','courier','trackingNumber','dispatchedAt','statusHistory']);
        $safe['items']=array_map(static fn($item)=>report_pick($item,['id','productId','name','qty','price','camyPrice','deliveryCost']),$order['items'] ?? []);
        if($finance)$safe+=report_pick($order,['camyCost','entrepreneurMargin','payoutAmount','payoutStatus','payoutPaidAt','payoutDueAt','payoutReference','clientPaymentStatus']);
        $orders[]=$safe;
    }
    $products=array_map(static fn($product)=>report_pick($product,['id','code','name','category','published','price','billingPrice','deliveryCost','packagingCost','freeDelivery','stock']),$state['products']);
    $settlements=$credit?array_map(static fn($entry)=>report_pick($entry,['id','entrepreneurId','amount','status','createdAt','submittedAt','reviewedAt','verifiedAt','reference']),$state['settlements'] ?? []):[];
    response(['orders'=>$orders,'entrepreneurs'=>$people,'products'=>$products,'settlements'=>$settlements,'access'=>['finance'=>$finance,'credit'=>$credit]]);
}
