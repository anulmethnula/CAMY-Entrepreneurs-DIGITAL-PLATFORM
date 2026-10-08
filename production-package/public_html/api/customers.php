<?php
declare(strict_types=1);
require_once __DIR__.'/customer_features.php';

function customer_user(PDO $pdo): ?array {
    if(empty($_SESSION['customer_id']))return null;
    if(time()-(int)($_SESSION['customer_activity'] ?? 0)>1800 || time()-(int)($_SESSION['customer_signed_in'] ?? 0)>28800){
        unset($_SESSION['customer_id']);return null;
    }
    $query=$pdo->prepare('SELECT id,name,email,phone,district,address,session_version FROM customers WHERE id=?');
    $query->execute([$_SESSION['customer_id']]);
    $row=$query->fetch();
    if(!$row||(int)$row['session_version']!==(int)($_SESSION['customer_version'] ?? 1)){unset($_SESSION['customer_id']);return null;}
    unset($row['session_version']);$_SESSION['customer_activity']=time();
    return $row;
}
function customer_required(PDO $pdo): array {
    $customer=customer_user($pdo);
    if(!$customer)response(['message'=>'Sign in or register as a customer before ordering.'],401);
    return $customer;
}
function customer_details(array $data): array {
    $clean=[];
    foreach(['name','phone','district','address'] as $key)$clean[$key]=trim((string)($data[$key] ?? ''));
    $clean['phone']=preg_replace('/[\s-]/','',$clean['phone']);
    if(!$clean['name']||strlen($clean['name'])>150||!preg_match('/^(?:\+94|0)7\d{8}$/',$clean['phone'])||!$clean['district']||strlen($clean['district'])>80||strlen($clean['address'])<8||strlen($clean['address'])>2000)
        response(['message'=>'Enter your name, Sri Lankan mobile number, district and complete delivery address.'],422);
    return $clean;
}
function customer_save(PDO $pdo,int $id,array $details): void {
    $pdo->prepare('UPDATE customers SET name=?,phone=?,district=?,address=? WHERE id=?')->execute([$details['name'],$details['phone'],$details['district'],$details['address'],$id]);
}
function customer_route(PDO $pdo,string $path,string $method): void {
    customer_features_route($pdo,$path,$method);
    if(!str_starts_with($path,'/customer/'))return;
    if($path==='/customer/me' && $method==='GET')response(['customer'=>customer_user($pdo)]);
    if($path==='/customer/logout' && $method==='POST'){
        unset($_SESSION['customer_id'],$_SESSION['customer_activity'],$_SESSION['customer_signed_in'],$_SESSION['customer_version']);
        session_regenerate_id(true);response(['ok'=>true]);
    }
    if(in_array($path,['/customer/register','/customer/login'],true) && $method==='POST'){
        $data=input();$email=strtolower(trim((string)($data['email'] ?? '')));$password=(string)($data['password'] ?? '');
        if(strlen($email)>190||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)>1024)response(['message'=>'Enter a valid email and password.'],422);
        $ip=$_SERVER['REMOTE_ADDR'] ?? 'unknown';security_login_limit($pdo,$email,$ip);
        if($path==='/customer/register'){
            $details=customer_details($data);valid_password($password);
            try{$pdo->prepare('INSERT INTO customers(name,email,password_hash,phone,district,address) VALUES(?,?,?,?,?,?)')->execute([$details['name'],$email,password_hash($password,PASSWORD_DEFAULT),$details['phone'],$details['district'],$details['address']]);}
            catch(PDOException $error){if($error->getCode()==='23000')response(['message'=>'This customer email is already registered. Please sign in.'],409);throw $error;}
            $id=(int)$pdo->lastInsertId();
        }else{
            $query=$pdo->prepare('SELECT id,password_hash FROM customers WHERE email=?');$query->execute([$email]);$row=$query->fetch();
            $valid=password_verify($password,$row['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
            $pdo->prepare('INSERT INTO login_attempts(email,ip_address,succeeded) VALUES(?,?,?)')->execute([$email,$ip,$row&&$valid?1:0]);
            if(!$row||!$valid)response(['message'=>'Incorrect email or password.'],401);
            $id=(int)$row['id'];
        }
        session_regenerate_id(true);$_SESSION['customer_id']=$id;
        $q=$pdo->prepare('SELECT session_version FROM customers WHERE id=?');$q->execute([$id]);$_SESSION['customer_version']=(int)$q->fetchColumn();
        $_SESSION['customer_signed_in']=$_SESSION['customer_activity']=time();
        response(['customer'=>customer_user($pdo)],$path==='/customer/register'?201:200);
    }
    if($path==='/customer/profile' && $method==='POST'){
        $customer=customer_required($pdo);customer_save($pdo,(int)$customer['id'],customer_details(input()));response(['customer'=>customer_user($pdo)]);
    }
    if($path==='/customer/orders' && $method==='GET'){
        $customer=customer_required($pdo);$state=market_state($pdo);$tracking=[];
        foreach($state['orders'] as $order)if((int)($order['customerId'] ?? 0)===(int)$customer['id']){
            $items=[];foreach($order['items'] as $item){$product=[];foreach($state['products'] as $candidate)if((string)$candidate['id']===(string)($item['id'] ?? $item['productId'])){$product=$candidate;break;}$items[]=array_merge(['image'=>$product['image'] ?? '', 'category'=>$product['category'] ?? 'Other'],$item);}
            $tracking[]=['id'=>$order['id'],'token'=>$order['trackingToken'],'status'=>$order['status'],'amount'=>$order['amount'],'shop'=>$order['entrepreneur'],'shopId'=>$order['entrepreneurId'],'date'=>$order['date'] ?? '', 'createdAt'=>$order['createdAt'] ?? ($order['date'] ?? ''), 'items'=>$items,'return'=>$order['return']??null];
        }
        response(['tracking'=>$tracking]);
    }
}
