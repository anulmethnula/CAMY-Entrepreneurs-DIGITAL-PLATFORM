<?php
declare(strict_types=1);

function profile_clean(array $data): array {
    $fields=['name'=>150,'phone'=>30,'nic'=>30,'address'=>2000,'city'=>100,'bank'=>120,'branch'=>120,'accountName'=>150,'accountNumber'=>80];$clean=[];
    foreach($fields as $key=>$length){$clean[$key]=trim((string)($data[$key] ?? ''));if(strlen($clean[$key])>$length)response(['message'=>"$key is too long."],422);}
    if(!$clean['name']||!preg_match('/^(?:\+94|0)7\d{8}$/',preg_replace('/[\s-]/','',$clean['phone']))||!preg_match('/^(?:\d{9}[VvXx]|\d{12})$/',$clean['nic']))response(['message'=>'Enter your name, a valid Sri Lankan mobile number and NIC number.'],422);
    $image=(string)($data['image'] ?? '');
    if($image && str_starts_with($image,'data:')){
        if(strlen($image)>2800000||!preg_match('#^data:image/(jpeg|png|webp);base64,(.+)$#s',$image,$parts))response(['message'=>'Use a JPG, PNG or WebP profile image up to 2 MB.'],422);
        $bytes=base64_decode($parts[2],true);if(!$bytes||strlen($bytes)>2*1024*1024||!getimagesizefromstring($bytes))response(['message'=>'Invalid profile image.'],422);
    }elseif($image && !preg_match('#^(?:https://|/[^/])#',$image))response(['message'=>'Invalid image address.'],422);
    $clean['image']=$image;return $clean;
}
function profile_has_obligations(array $state,string $id): bool {
    foreach($state['entrepreneurs'] as $person)if((string)$person['id']===$id && (float)($person['used'] ?? 0)>0)return true;
    foreach($state['orders'] as $order)if((string)$order['entrepreneurId']===$id && (!in_array($order['status'],['Delivered','Returned','Rejected'],true)||in_array($order['return']['status']??'', ['Requested','Approved','Shipped'],true)||(($order['return']['refundStatus']??'')==='Pending')))return true;
    foreach($state['requests'] as $request)if((string)$request['entrepreneurId']===$id && !in_array($request['status'],['Dispatched','Rejected'],true))return true;
    return false;
}
function profile_is_training_demo(array $state,string $id): bool {
    if(!in_array($id,['DEMO-101','DEMO-102','DEMO-103'],true))return false;
    foreach($state['orders'] as $order)if((string)$order['entrepreneurId']===$id&&(($order['source']??'')!=='training'||!empty($order['customerId'])||!empty($order['return'])))return false;
    foreach(['requests','settlements'] as $list)foreach($state[$list]??[] as $record)if((string)$record['entrepreneurId']===$id)return false;
    return true;
}
function profiles_route(PDO $pdo,string $path,string $method): void {
    if(preg_match('#^/admin/entrepreneurs/([^/]+)/exit/(approve|reject)$#',$path,$exit) && $method==='POST'){
        require_admin($pdo);$pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
        foreach($state['entrepreneurs'] as $key=>$person)if((string)$person['id']===$exit[1]){$index=$key;break;}
        if($index===null)response(['message'=>'Entrepreneur not found.'],404);
        if(($state['entrepreneurs'][$index]['exitRequest']['status'] ?? '')!=='Pending')response(['message'=>'This closure request has already been reviewed or does not exist.'],409);
        if($exit[2]==='approve' && profile_has_obligations($state,$exit[1]))response(['message'=>'Clear outstanding credit, active orders and stock requests first.'],409);
        $state['entrepreneurs'][$index]['exitRequest']['status']=$exit[2]==='approve'?'Approved':'Rejected';
        $state['entrepreneurs'][$index]['exitRequest']['reviewedAt']=date(DATE_ATOM);
        if($exit[2]==='approve'){$state['entrepreneurs'][$index]['active']=false;$state['entrepreneurs'][$index]['stage']='Departed';$pdo->prepare("UPDATE users SET status='inactive',session_version=session_version+1 WHERE member_id=?")->execute([$exit[1]]);}
        market_save($pdo,$state);$pdo->commit();response(['person'=>$state['entrepreneurs'][$index]]);
    }
    $own=$path==='/account/profile' && $method==='PATCH';
    $admin=preg_match('#^/admin/entrepreneurs/([^/]+)$#',$path,$matches) && in_array($method,['PATCH','DELETE'],true);
    if(!$own&&!$admin)return;
    $user=$own?current_user($pdo):require_admin($pdo);if(!$user)response(['message'=>'Sign in to edit this profile.'],401);
    if($own && ($user['role']!=='entrepreneur'||!$user['member_id']))response(['message'=>'Entrepreneur access is required.'],403);
    $id=$own?(string)$user['member_id']:$matches[1];$data=input();
    $pdo->beginTransaction();$state=market_state($pdo,true);$index=null;foreach($state['entrepreneurs'] as $key=>$person)if((string)$person['id']===$id){$index=$key;break;}
    if($index===null)response(['message'=>'Entrepreneur not found.'],404);
    if($method==='DELETE'){
        $trainingDemo=profile_is_training_demo($state,$id);
        if($trainingDemo){$query=$pdo->prepare('SELECT COUNT(*) FROM users WHERE member_id=?');$query->execute([$id]);$trainingDemo=(int)$query->fetchColumn()===0;}
        if(!$trainingDemo&&profile_has_obligations($state,$id))response(['message'=>'Clear outstanding credit, active orders and stock requests before archiving this account.'],409);
        if($trainingDemo)$state['entrepreneurs'][$index]['demoArchived']=true;
        $state['entrepreneurs'][$index]['active']=false;$state['entrepreneurs'][$index]['stage']='Departed';
        $pdo->prepare("UPDATE users SET status='inactive',session_version=session_version+1 WHERE member_id=?")->execute([$id]);
    }else{
        $clean=profile_clean($data);$previous=$state['entrepreneurs'][$index];
        $pdo->prepare("UPDATE users SET full_name=? WHERE member_id=? AND role='entrepreneur'")->execute([$clean['name'],$id]);
        $pdo->prepare('UPDATE entrepreneurs SET nic=?,phone=?,address=?,city=?,profile_image=?,bank_name=?,bank_branch=?,account_holder=?,account_number=? WHERE member_id=?')->execute([$clean['nic'],$clean['phone'],$clean['address'],$clean['city'],$clean['image'],$clean['bank'],$clean['branch'],$clean['accountName'],$clean['accountNumber'],$id]);
        $state['entrepreneurs'][$index]=array_merge($previous,$clean,['bankDetails'=>['bank'=>$clean['bank'],'branch'=>$clean['branch'],'holder'=>$clean['accountName'],'account'=>$clean['accountNumber']]]);
        if($own && ($data['exitRequest']['status'] ?? '')==='Pending'){
            if(profile_has_obligations($state,$id))response(['message'=>'Clear credit, active orders and stock requests before requesting closure.'],409);
            if(($previous['exitRequest']['status'] ?? '')==='Pending')response(['message'=>'Your closure request is already awaiting review.'],409);
            $state['entrepreneurs'][$index]['exitRequest']=['status'=>'Pending','createdAt'=>date(DATE_ATOM)];
        }
        foreach($state['orders'] as &$order)if((string)$order['entrepreneurId']===$id)$order['entrepreneur']=$clean['name'];unset($order);
    }
    market_save($pdo,$state);$pdo->commit();response(['person'=>$state['entrepreneurs'][$index]]);
}
