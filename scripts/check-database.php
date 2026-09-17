<?php
declare(strict_types=1);
require __DIR__.'/../api/config.php';
require __DIR__.'/../api/marketplace.php';
function response(array $data,int $status=200): never {throw new RuntimeException($data['message'] ?? 'Validation failure',$status);}
$pdo=database();$state=market_state($pdo);
$issues=[];
foreach($state['products'] as $product)if((int)$product['stock']<0||(float)$product['price']<0)$issues[]='Invalid warehouse product quantity or price.';
foreach($state['inventory'] as $item)if((int)$item['qty']<0||(float)$item['price']<=0)$issues[]='Invalid shop quantity or price.';
foreach($state['requests'] as $request){
    $total=0;foreach($request['items'] as $item)$total+=(float)$item['price']*(int)$item['qty'];
    if(abs($total-(float)$request['total'])>0.01)$issues[]='Supply request total differs from its items.';
}
foreach($state['orders'] as $order){
    $total=0;foreach($order['items'] ?? [] as $item)$total+=(float)$item['price']*(int)$item['qty'];
    if(abs($total-(float)$order['amount'])>0.01)$issues[]='Customer order total differs from its items.';
}
$summary=['products'=>count($state['products']),'entrepreneurs'=>count($state['entrepreneurs']),'stock_requests'=>count($state['requests']),'shop_inventory_records'=>count($state['inventory']),'customer_orders'=>count($state['orders']),'settlements'=>count($state['settlements']),'issues'=>$issues];
echo json_encode($summary,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";
if($issues)exit(1);
