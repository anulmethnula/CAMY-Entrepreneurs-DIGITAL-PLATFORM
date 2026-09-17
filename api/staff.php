<?php
declare(strict_types=1);

function staff_templates(): array {
    return ['Viewer'=>['overview','reports'],'Operations'=>['overview','entrepreneurs','admin-orders','admin-products','stock-supply','reports'],'Finance'=>['overview','credit-control','reports'],'Super Admin'=>['overview','entrepreneurs','admin-orders','admin-products','stock-supply','credit-control','reports','user-access']];
}
function staff_record(array $row): array {
    $role=$row['access_role'] ?: ($row['role']==='admin'?'Super Admin':($row['role']==='manager'?'Operations':'Viewer'));
    return ['id'=>(string)$row['id'],'name'=>$row['full_name'],'email'=>$row['email'],'role'=>$role,'active'=>$row['status']==='active','lastAccess'=>$row['last_login_at'] ?: 'Not signed in yet','permissions'=>json_decode($row['permissions_json'] ?? '',true) ?? (staff_templates()[$role] ?? []),'passwordChangeRequired'=>!empty($row['must_change_password'])];
}
function staff_route(PDO $pdo,string $path,string $method): void {
    if($path!=='/admin/users' && !preg_match('#^/admin/users/(\d+)(/reset-password)?$#',$path,$matches))return;
    $actor=require_admin($pdo);
    if($actor['role']!=='admin')response(['message'=>'Only a Super Admin can manage staff accounts.'],403);
    if($path==='/admin/users' && $method==='GET'){
        $rows=$pdo->query("SELECT * FROM users WHERE role<>'entrepreneur' AND status<>'inactive' ORDER BY id")->fetchAll();response(['users'=>array_map('staff_record',$rows)]);
    }
    if($path==='/admin/users' && $method==='POST'){
        $data=input();$name=trim((string)($data['name'] ?? ''));$email=strtolower(trim((string)($data['email'] ?? '')));$role=(string)($data['role'] ?? 'Viewer');
        if(!$name||strlen($name)>150||strlen($email)>190||!filter_var($email,FILTER_VALIDATE_EMAIL)||!isset(staff_templates()[$role]))response(['message'=>'Enter a valid name, email and staff role.'],422);
        $query=$pdo->prepare('SELECT id FROM users WHERE email=?');$query->execute([$email]);if($query->fetch())response(['message'=>'An account already exists with this email.'],409);
        $password='Camy!'.bin2hex(random_bytes(9)).'7';
        $insert=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status,must_change_password,access_role,permissions_json) VALUES(?,?,?,?,'active',1,?,?)");
        $insert->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$role==='Super Admin'?'admin':'manager',$role,json_encode(staff_templates()[$role])]);
        $query=$pdo->prepare('SELECT * FROM users WHERE id=?');$query->execute([$pdo->lastInsertId()]);
        response(['user'=>staff_record($query->fetch()),'temporaryPassword'=>$password],201);
    }
    if(!isset($matches[1]))response(['message'=>'Method not allowed.'],405);
    $id=(int)$matches[1];$query=$pdo->prepare("SELECT * FROM users WHERE id=? AND role<>'entrepreneur'");$query->execute([$id]);$row=$query->fetch();if(!$row)response(['message'=>'Staff account not found.'],404);
    $primary=(int)$pdo->query("SELECT MIN(id) FROM users WHERE role='admin'")->fetchColumn();
    if($id===$primary||$id===(int)$actor['id'])response(['message'=>'Your own account and the primary Super Admin are protected.'],409);
    if(($matches[2] ?? '')==='/reset-password' && $method==='POST'){
        $password='Camy!'.bin2hex(random_bytes(9)).'7';
        $pdo->prepare('UPDATE users SET password_hash=?,must_change_password=1,session_version=session_version+1 WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$id]);
        $query->execute([$id]);response(['user'=>staff_record($query->fetch()),'temporaryPassword'=>$password]);
    }
    if(!empty($matches[2]))response(['message'=>'Method not allowed.'],405);
    if($method==='PATCH'){
        $data=input();$role=(string)($data['role'] ?? staff_record($row)['role']);$templates=staff_templates();
        if(!isset($templates[$role]))response(['message'=>'Invalid staff role.'],422);
        $permissions=$data['permissions'] ?? $templates[$role];if(!is_array($permissions)||array_diff($permissions,$templates['Super Admin']))response(['message'=>'Invalid page permissions.'],422);
        if($role==='Super Admin')$permissions=$templates['Super Admin'];
        $pdo->prepare('UPDATE users SET role=?,access_role=?,permissions_json=?,status=? WHERE id=?')->execute([$role==='Super Admin'?'admin':'manager',$role,json_encode(array_values($permissions)),($data['active'] ?? ($row['status']==='active'))?'active':'suspended',$id]);
        $query->execute([$id]);response(['user'=>staff_record($query->fetch())]);
    }
    if($method==='DELETE'){
        $pdo->prepare("UPDATE users SET status='inactive' WHERE id=?")->execute([$id]);response(['ok'=>true]);
    }
    response(['message'=>'Method not allowed.'],405);
}
