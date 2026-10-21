<?php
declare(strict_types=1);

function customer_review_record(array $row): array {
    $row['id']=(string)$row['id'];$row['rating']=(int)$row['rating'];
    return $row;
}
function customer_features_route(PDO $pdo,string $path,string $method): void {
    if($path==='/marketplace/reviews' && $method==='GET'){
        $productId=trim((string)($_GET['productId'] ?? ''));$shopId=trim((string)($_GET['shopId'] ?? ''));
        if(!$productId||!$shopId)response(['message'=>'Choose a product and shop.'],422);
        $query=$pdo->prepare("SELECT r.id,r.rating,r.comment,r.admin_reply,r.updated_at,c.name FROM customer_reviews r JOIN customers c ON c.id=r.customer_id WHERE r.product_id=? AND r.shop_id=? AND r.status='Published' ORDER BY r.updated_at DESC LIMIT 100");$query->execute([$productId,$shopId]);$rows=$query->fetchAll();
        foreach($rows as &$row){$row['name']=explode(' ',trim($row['name']))[0].' · Verified buyer';$row['rating']=(int)$row['rating'];}unset($row);
        response(['reviews'=>$rows]);
    }
    if($path==='/admin/customer-reviews'){
        require_admin($pdo);
        if($method==='GET'){
            $rows=$pdo->query('SELECT r.*,c.name AS customer_name,c.email AS customer_email FROM customer_reviews r JOIN customers c ON c.id=r.customer_id ORDER BY r.updated_at DESC')->fetchAll();response(['reviews'=>array_map('customer_review_record',$rows)]);
        }
        if($method==='POST'){
            $data=input();$status=(string)($data['status'] ?? '');$reply=trim((string)($data['reply'] ?? ''));
            if(!in_array($status,['Pending','Published','Hidden'],true)||strlen($reply)>2000)response(['message'=>'Choose a valid review status and a reply up to 2,000 characters.'],422);
            $query=$pdo->prepare('SELECT id FROM customer_reviews WHERE id=?');$query->execute([$data['id'] ?? '']);if(!$query->fetch())response(['message'=>'Review not found.'],404);
            $pdo->prepare('UPDATE customer_reviews SET status=?,admin_reply=? WHERE id=?')->execute([$status,$reply,$data['id']]);response(['ok'=>true]);
        }
    }
    if(!in_array($path,['/customer/favourites','/customer/reviews','/customer/addresses','/customer/password'],true))return;
    $customer=customer_required($pdo);
    if($path==='/customer/favourites'){
        if($method==='GET'){
            $q=$pdo->prepare('SELECT shop_id AS shopId,product_id AS productId FROM customer_favourites WHERE customer_id=? ORDER BY created_at DESC');$q->execute([$customer['id']]);$saved=$q->fetchAll();$state=market_state($pdo);
            foreach($saved as &$entry){$product=null;$shop=null;$slot=null;foreach($state['products'] as $candidate)if((string)$candidate['id']===$entry['productId'])$product=$candidate;foreach($state['entrepreneurs'] as $candidate)if((string)$candidate['id']===$entry['shopId'])$shop=$candidate;foreach($state['inventory'] as $candidate)if((string)$candidate['entrepreneurId']===$entry['shopId']&&(string)$candidate['productId']===$entry['productId'])$slot=$candidate;
                $entry['product']=$product?array_intersect_key($product,array_flip(['id','name','category','code','image','description','specs','warranty','price'])):['id'=>$entry['productId'],'name'=>'Unavailable saved product','category'=>'Unavailable','image'=>'/products/classic-set.png'];
                $entry['shop']=['id'=>$entry['shopId'],'name'=>$shop['name'] ?? 'Unavailable shop','city'=>$shop['city'] ?? ''];$entry['price']=$slot['price'] ?? $product['price'] ?? 0;
                $entry['available']=$slot&&($slot['qty'] ?? 0)>0&&($slot['visible'] ?? true)&&$shop&&($shop['active'] ?? true)&&($shop['stage'] ?? '')!=='Departed';
            }unset($entry);response(['favourites'=>$saved]);
        }
        if($method==='POST'){
            $data=input();$shop=(string)($data['shopId'] ?? '');$product=(string)($data['productId'] ?? '');$saved=($data['saved'] ?? false)===true;
            if(strlen($shop)>30||strlen($product)>80||!$shop||!$product)response(['message'=>'Choose a valid shop product.'],422);
            if(!$saved){$pdo->prepare('DELETE FROM customer_favourites WHERE customer_id=? AND shop_id=? AND product_id=?')->execute([$customer['id'],$shop,$product]);response(['ok'=>true]);}
            $state=market_state($pdo);$exists=false;foreach($state['inventory'] as $item)if((string)$item['entrepreneurId']===$shop&&(string)$item['productId']===$product)$exists=true;
            if(!$exists)response(['message'=>'This shop product is no longer available.'],404);
            $pdo->beginTransaction();$q=$pdo->prepare('SELECT id FROM customers WHERE id=? FOR UPDATE');$q->execute([$customer['id']]);
            $q=$pdo->prepare('SELECT product_id FROM customer_favourites WHERE customer_id=? AND shop_id=? AND product_id=?');$q->execute([$customer['id'],$shop,$product]);if($q->fetch()){$pdo->commit();response(['ok'=>true]);}
            $q=$pdo->prepare('SELECT COUNT(*) FROM customer_favourites WHERE customer_id=?');$q->execute([$customer['id']]);if((int)$q->fetchColumn()>=200)response(['message'=>'Save up to 200 favourites. Remove one first.'],422);
            $pdo->prepare('INSERT IGNORE INTO customer_favourites(customer_id,shop_id,product_id) VALUES(?,?,?)')->execute([$customer['id'],$shop,$product]);$pdo->commit();response(['ok'=>true]);
        }
    }
    if($path==='/customer/reviews'){
        if($method==='GET'){$q=$pdo->prepare('SELECT * FROM customer_reviews WHERE customer_id=? ORDER BY updated_at DESC');$q->execute([$customer['id']]);response(['reviews'=>array_map('customer_review_record',$q->fetchAll())]);}
        if($method==='POST'){
            $data=input();$rating=filter_var($data['rating'] ?? null,FILTER_VALIDATE_INT);$comment=trim((string)($data['comment'] ?? ''));$product=(string)($data['productId'] ?? '');
            if($rating===false||$rating<1||$rating>5||strlen($comment)<3||strlen($comment)>2000)response(['message'=>'Choose 1–5 stars and write feedback between 3 and 2,000 characters.'],422);
            $pdo->beginTransaction();$state=market_state($pdo,true);$order=null;$item=null;
            foreach($state['orders'] as $candidate)if($candidate['id']===($data['orderId'] ?? '')&&(int)($candidate['customerId'] ?? 0)===(int)$customer['id']){$order=$candidate;break;}
            if(!$order||$order['status']!=='Delivered')response(['message'=>'You can review only your own delivered purchases.'],403);
            foreach($order['items'] as $candidate)if((string)($candidate['id'] ?? $candidate['productId'])===$product){$item=$candidate;break;}
            if(!$item)response(['message'=>'This product is not in your delivered order.'],403);
            $pdo->prepare("INSERT INTO customer_reviews(customer_id,order_id,shop_id,product_id,product_name,rating,comment) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE order_id=VALUES(order_id),rating=VALUES(rating),comment=VALUES(comment),status='Pending',admin_reply=NULL")->execute([$customer['id'],$order['id'],$order['entrepreneurId'],$product,$item['name'],$rating,$comment]);
            $pdo->commit();response(['ok'=>true,'message'=>'Your feedback is saved for admin review.']);
        }
    }
    if($path==='/customer/addresses'){
        if($method==='GET'){$q=$pdo->prepare('SELECT id,label,name,phone,district,address FROM customer_addresses WHERE customer_id=? ORDER BY id DESC');$q->execute([$customer['id']]);response(['addresses'=>$q->fetchAll()]);}
        if($method==='POST'){
            $data=input();$id=(int)($data['id'] ?? 0);
            if(($data['action'] ?? '')==='delete'){$pdo->prepare('DELETE FROM customer_addresses WHERE id=? AND customer_id=?')->execute([$id,$customer['id']]);response(['ok'=>true]);}
            $details=customer_details($data);$label=trim((string)($data['label'] ?? 'Home'));if(!$label||strlen($label)>60)response(['message'=>'Use an address label up to 60 characters.'],422);
            if($id){$q=$pdo->prepare('SELECT id FROM customer_addresses WHERE id=? AND customer_id=?');$q->execute([$id,$customer['id']]);if(!$q->fetch())response(['message'=>'Address not found.'],404);$pdo->prepare('UPDATE customer_addresses SET label=?,name=?,phone=?,district=?,address=? WHERE id=? AND customer_id=?')->execute([$label,$details['name'],$details['phone'],$details['district'],$details['address'],$id,$customer['id']]);}
            else{$pdo->beginTransaction();$q=$pdo->prepare('SELECT id FROM customers WHERE id=? FOR UPDATE');$q->execute([$customer['id']]);$q=$pdo->prepare('SELECT COUNT(*) FROM customer_addresses WHERE customer_id=?');$q->execute([$customer['id']]);if((int)$q->fetchColumn()>=10)response(['message'=>'Save up to 10 delivery addresses.'],422);$pdo->prepare('INSERT INTO customer_addresses(customer_id,label,name,phone,district,address) VALUES(?,?,?,?,?,?)')->execute([$customer['id'],$label,$details['name'],$details['phone'],$details['district'],$details['address']]);$pdo->commit();}
            response(['ok'=>true]);
        }
    }
    if($path==='/customer/password' && $method==='POST'){
        $data=input();$password=(string)($data['newPassword'] ?? '');valid_password($password);
        $q=$pdo->prepare('SELECT password_hash FROM customers WHERE id=?');$q->execute([$customer['id']]);$hash=$q->fetchColumn();
        if(!password_verify((string)($data['currentPassword'] ?? ''),$hash))response(['message'=>'Current password is incorrect.'],422);
        if(password_verify($password,$hash))response(['message'=>'Choose a different new password.'],422);
        $pdo->prepare('UPDATE customers SET password_hash=?,session_version=session_version+1 WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$customer['id']]);
        $q=$pdo->prepare('SELECT session_version FROM customers WHERE id=?');$q->execute([$customer['id']]);$_SESSION['customer_version']=(int)$q->fetchColumn();
        session_regenerate_id(true);response(['ok'=>true]);
    }
}
