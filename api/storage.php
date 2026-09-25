<?php
declare(strict_types=1);

function storage_json(array $value): string {return json_encode($value,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function storage_decode(?string $value): array {return $value?json_decode($value,true,64,JSON_THROW_ON_ERROR):[];}

function storage_read(PDO $pdo): ?array {
    $query=$pdo->query("SELECT value_json FROM platform_settings WHERE setting_key='marketplace'");$raw=$query->fetchColumn();
    if($raw===false)return null;
    $state=storage_decode((string)$raw);
    $state['tiers']=[];
    foreach($pdo->query('SELECT * FROM credit_tiers ORDER BY sort_order,id')->fetchAll() as $row){
        $tier=storage_decode($row['record_json']);$tier['id']=$tier['id'] ?? 'tier-'.$row['id'];$tier['sales']=(float)$row['sales_required'];$tier['credit']=(float)$row['credit_limit'];$state['tiers'][]=$tier;
    }
    $state['products']=[];$byCode=[];
    foreach($pdo->query('SELECT * FROM products WHERE record_json IS NOT NULL ORDER BY id')->fetchAll() as $row){
        $product=storage_decode($row['record_json']);$product['price']=(float)$row['price'];$product['stock']=(int)$row['stock'];$byCode[$row['code']]=$product;$state['products'][]=$product;
    }
    $state['entrepreneurs']=array_map(static fn($row)=>storage_decode($row['record_json']),$pdo->query('SELECT record_json FROM entrepreneur_directory ORDER BY member_id')->fetchAll());
    $state['inventory']=[];
    foreach($pdo->query('SELECT * FROM entrepreneur_shop_items')->fetchAll() as $row){
        if(!isset($byCode[$row['product_code']]))continue;
        $state['inventory'][]=['entrepreneurId'=>$row['entrepreneur_member_id'],'productId'=>$byCode[$row['product_code']]['id'],'qty'=>(int)$row['quantity'],'price'=>(float)$row['sell_price'],'visible'=>(bool)$row['visible']];
    }
    foreach(['requests'=>'stock_supply_requests','orders'=>'shop_orders','settlements'=>'credit_settlement_requests'] as $key=>$table){
        $state[$key]=[];
        foreach($pdo->query("SELECT * FROM $table WHERE record_json IS NOT NULL ORDER BY created_at DESC,id")->fetchAll() as $row){
            $record=storage_decode($row['record_json']);$record['status']=$row['status'];
            if($key==='requests'){$record['total']=(float)$row['total'];if($row['receipt_path'])$record['receiptPath']=$row['receipt_path'];}
            if($key==='orders'){$record['amount']=(float)$row['total'];if(!empty($row['delivered_at']))$record['deliveredAt']=date(DATE_ATOM,strtotime((string)$row['delivered_at']));}
            if($key==='settlements')$record['amount']=(float)$row['amount'];
            $state[$key][]=$record;
        }
    }
    return $state;
}

function storage_write(PDO $pdo,array $state): void {
    $products=[];
    // Preserve platform IDs in product metadata; relational auto-increment IDs may differ.
    $productWrite=$pdo->prepare("INSERT INTO products(code,name,category,description,price,stock,image,status,record_json) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),description=VALUES(description),price=VALUES(price),stock=VALUES(stock),image=VALUES(image),status=VALUES(status),record_json=VALUES(record_json)");
    foreach($state['products'] ?? [] as $product){
        $code=(string)($product['code'] ?? $product['id']);$products[(string)$product['id']]=$code;
        $productWrite->execute([$code,$product['name'],$product['category'] ?? 'Other',$product['description'] ?? '',$product['price'],max(0,(int)$product['stock']),$product['image'] ?? '',empty($state['catalogue_live'])?'inactive':'active',storage_json($product)]);
    }
    $codes=array_values($products);
    if($codes){$placeholders=implode(',',array_fill(0,count($codes),'?'));$pdo->prepare("UPDATE products SET status='inactive',record_json=NULL WHERE record_json IS NOT NULL AND code NOT IN ($placeholders)")->execute($codes);}
    else $pdo->exec("UPDATE products SET status='inactive',record_json=NULL WHERE record_json IS NOT NULL");
    $directory=$pdo->prepare('INSERT INTO entrepreneur_directory(member_id,record_json) VALUES(?,?) ON DUPLICATE KEY UPDATE record_json=VALUES(record_json)');
    $financial=$pdo->prepare('UPDATE entrepreneurs SET total_sales=?,credit_limit=?,outstanding=? WHERE member_id=?');
    foreach($state['entrepreneurs'] ?? [] as $person){$directory->execute([$person['id'],storage_json($person)]);$financial->execute([max(0,(float)($person['sales'] ?? 0)),max(0,(float)($person['credit'] ?? 0)),max(0,(float)($person['used'] ?? 0)),$person['id']]);}
    $prices=[];foreach($state['products'] ?? [] as $product)$prices[(string)$product['id']]=$product['price'];
    $inventory=$pdo->prepare('INSERT INTO entrepreneur_shop_items(entrepreneur_member_id,product_code,quantity,sell_price,visible) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),sell_price=VALUES(sell_price),visible=VALUES(visible)');
    foreach($state['inventory'] ?? [] as $item){$code=$products[(string)$item['productId']] ?? null;if(!$code)continue;$inventory->execute([$item['entrepreneurId'],$code,max(0,(int)$item['qty']),$item['price'] ?? $prices[(string)$item['productId']],($item['visible'] ?? true)?1:0]);}
    $requestWrite=$pdo->prepare("INSERT INTO stock_supply_requests(id,entrepreneur_member_id,payment_reference,receipt_path,total,status,record_json) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE payment_reference=VALUES(payment_reference),receipt_path=IF(VALUES(receipt_path)='',receipt_path,VALUES(receipt_path)),total=VALUES(total),status=VALUES(status),record_json=VALUES(record_json)");
    $requestItem=$pdo->prepare('INSERT INTO stock_supply_request_items(request_id,product_code,quantity,purchase_price) VALUES(?,?,?,?)');
    foreach($state['requests'] ?? [] as $request){
        $requestWrite->execute([$request['id'],$request['entrepreneurId'],$request['reference'] ?? '',$request['receiptPath'] ?? '',$request['total'],$request['status'],storage_json($request)]);
        $pdo->prepare('DELETE FROM stock_supply_request_items WHERE request_id=?')->execute([$request['id']]);
        foreach($request['items'] as $item)$requestItem->execute([$request['id'],$products[(string)$item['productId']] ?? (string)$item['productId'],$item['qty'],$item['price']]);
    }
    $groupWrite=$pdo->prepare('INSERT INTO customer_order_groups(id,customer_name,customer_phone,district,delivery_address) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE customer_name=VALUES(customer_name),customer_phone=VALUES(customer_phone),district=VALUES(district),delivery_address=VALUES(delivery_address)');
    $orderWrite=$pdo->prepare('INSERT INTO shop_orders(id,group_id,entrepreneur_member_id,total,status,delivered_at,record_json) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE total=VALUES(total),status=VALUES(status),delivered_at=COALESCE(VALUES(delivered_at),delivered_at),record_json=VALUES(record_json)');
    $orderItem=$pdo->prepare('INSERT INTO shop_order_items(order_id,product_code,quantity,sell_price) VALUES(?,?,?,?)');
    foreach($state['orders'] ?? [] as $order){
        $groupId=$order['groupId'] ?? $order['id'];$groupWrite->execute([$groupId,$order['customer'] ?? '',$order['phone'] ?? '',$order['district'] ?? '',$order['address'] ?? '']);
        $deliveredAt=!empty($order['deliveredAt'])?date('Y-m-d H:i:s',strtotime((string)$order['deliveredAt'])):null;
        $orderWrite->execute([$order['id'],$groupId,$order['entrepreneurId'],$order['amount'],$order['status'],$deliveredAt,storage_json($order)]);
        $pdo->prepare('DELETE FROM shop_order_items WHERE order_id=?')->execute([$order['id']]);
        foreach($order['items'] ?? [] as $item)$orderItem->execute([$order['id'],$products[(string)($item['id'] ?? $item['productId'])] ?? (string)($item['id'] ?? $item['productId']),$item['qty'],$item['price']]);
    }
    $settlementWrite=$pdo->prepare('INSERT INTO credit_settlement_requests(id,entrepreneur_member_id,amount,reference,status,record_json) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),record_json=VALUES(record_json)');
    foreach($state['settlements'] ?? [] as $record)$settlementWrite->execute([$record['id'],$record['entrepreneurId'],$record['amount'],$record['reference'],$record['status'],storage_json($record)]);
    $pdo->exec('DELETE FROM credit_tiers');
    $tierWrite=$pdo->prepare('INSERT INTO credit_tiers(name,sales_required,credit_limit,sort_order,record_json) VALUES(?,?,?,?,?)');
    foreach($state['tiers'] ?? [] as $index=>$tier){$tier['id']=$tier['id'] ?? 'tier-'.$index;$tierWrite->execute([$tier['name'] ?? 'Tier '.($index+1),$tier['sales'],$tier['credit'],$index,storage_json($tier)]);}
    $settings=$state;foreach(['products','entrepreneurs','inventory','requests','orders','settlements'] as $key)unset($settings[$key]);
    $pdo->prepare("INSERT INTO platform_settings(setting_key,value_json) VALUES('marketplace',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)")->execute([storage_json($settings)]);
}
