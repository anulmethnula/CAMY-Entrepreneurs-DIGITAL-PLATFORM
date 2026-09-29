<?php
declare(strict_types=1);

function staff_templates(): array {
    return ['Super Admin'=>['overview','entrepreneurs','admin-orders','admin-products','payouts','stock-supply','credit-control','reports','user-access']];
}
function staff_assignable_permissions(): array { return array_values(array_filter(staff_templates()['Super Admin'],fn($item)=>$item!=='user-access')); }
function staff_ensure_roles(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS staff_access_roles (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(40) NOT NULL UNIQUE,permissions_json TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function staff_role_catalog(PDO $pdo): array {
    staff_ensure_roles($pdo);$roles=[];
    foreach(staff_templates() as $name=>$permissions)$roles[]=['id'=>'system-'.strtolower(str_replace(' ','-',$name)),'name'=>$name,'permissions'=>$permissions,'system'=>true];
    foreach($pdo->query('SELECT id,name,permissions_json FROM staff_access_roles ORDER BY name')->fetchAll() as $row)$roles[]=['id'=>'custom-'.$row['id'],'name'=>$row['name'],'permissions'=>json_decode($row['permissions_json'],true) ?: [],'system'=>false];
    return $roles;
}
function staff_role_map(PDO $pdo): array { $map=[];foreach(staff_role_catalog($pdo) as $role)$map[$role['name']]=$role;return $map; }
function staff_record(array $row,?array $roleMap=null): array {
    $role=$row['access_role'] ?: ($row['role']==='admin'?'Super Admin':'Unassigned');
    $fallback=$roleMap[$role]['permissions'] ?? (staff_templates()[$role] ?? []);
    return ['id'=>(string)$row['id'],'name'=>$row['full_name'],'email'=>$row['email'],'role'=>$role,'active'=>$row['status']==='active','lastAccess'=>$row['last_login_at'] ?: 'Not signed in yet','permissions'=>json_decode($row['permissions_json'] ?? '',true) ?? $fallback,'passwordChangeRequired'=>!empty($row['must_change_password'])];
}
function staff_validate_permissions($permissions,bool $superAdmin=false): array {
    $allowed=$superAdmin?staff_templates()['Super Admin']:staff_assignable_permissions();
    if(!is_array($permissions)||array_diff($permissions,$allowed))response(['message'=>'Invalid page permissions.'],422);
    return array_values(array_unique($permissions));
}
function staff_route(PDO $pdo,string $path,string $method): void {
    $isUsers=$path==='/admin/users'||preg_match('#^/admin/users/(\d+)(/reset-password)?$#',$path,$userMatches);
    $isRoles=$path==='/admin/access-roles'||preg_match('#^/admin/access-roles/(\d+)$#',$path,$roleMatches);
    if(!$isUsers&&!$isRoles)return;
    $actor=require_admin($pdo);if($actor['role']!=='admin')response(['message'=>'Only a Super Admin can manage staff accounts and access roles.'],403);
    $roleMap=staff_role_map($pdo);
    if($isRoles){
        if($path==='/admin/access-roles'&&$method==='GET')response(['roles'=>staff_role_catalog($pdo)]);
        if($path==='/admin/access-roles'&&$method==='POST'){
            $data=input();$name=trim((string)($data['name'] ?? ''));$permissions=staff_validate_permissions($data['permissions'] ?? []);
            if(strlen($name)<2||strlen($name)>40||isset($roleMap[$name]))response(['message'=>'Use a unique role name between 2 and 40 characters.'],422);
            $query=$pdo->prepare('SELECT id FROM staff_access_roles WHERE LOWER(name)=LOWER(?)');$query->execute([$name]);if($query->fetch())response(['message'=>'A role with this name already exists.'],409);
            $pdo->prepare('INSERT INTO staff_access_roles(name,permissions_json) VALUES(?,?)')->execute([$name,json_encode($permissions)]);response(['roles'=>staff_role_catalog($pdo)],201);
        }
        if(!isset($roleMatches[1]))response(['message'=>'Method not allowed.'],405);
        $id=(int)$roleMatches[1];$query=$pdo->prepare('SELECT * FROM staff_access_roles WHERE id=?');$query->execute([$id]);$existing=$query->fetch();if(!$existing)response(['message'=>'Custom role not found.'],404);
        if($method==='PATCH'){
            $data=input();$name=trim((string)($data['name'] ?? $existing['name']));$permissions=staff_validate_permissions($data['permissions'] ?? json_decode($existing['permissions_json'],true));
            if(strlen($name)<2||strlen($name)>40||isset(staff_templates()[$name]))response(['message'=>'Use a unique role name between 2 and 40 characters.'],422);
            $duplicate=$pdo->prepare('SELECT id FROM staff_access_roles WHERE LOWER(name)=LOWER(?) AND id<>?');$duplicate->execute([$name,$id]);if($duplicate->fetch())response(['message'=>'A role with this name already exists.'],409);
            $pdo->beginTransaction();$pdo->prepare('UPDATE staff_access_roles SET name=?,permissions_json=? WHERE id=?')->execute([$name,json_encode($permissions),$id]);$pdo->prepare("UPDATE users SET access_role=?,permissions_json=? WHERE access_role=? AND role<>'admin'")->execute([$name,json_encode($permissions),$existing['name']]);$pdo->commit();response(['roles'=>staff_role_catalog($pdo)]);
        }
        if($method==='DELETE'){
            $count=$pdo->prepare("SELECT COUNT(*) FROM users WHERE access_role=? AND status<>'inactive'");$count->execute([$existing['name']]);if((int)$count->fetchColumn()>0)response(['message'=>'Reassign users from this role before deleting it.'],409);
            $pdo->prepare('DELETE FROM staff_access_roles WHERE id=?')->execute([$id]);response(['roles'=>staff_role_catalog($pdo)]);
        }
        response(['message'=>'Method not allowed.'],405);
    }
    if($path==='/admin/users'&&$method==='GET'){
        $rows=$pdo->query("SELECT * FROM users WHERE role<>'entrepreneur' AND status<>'inactive' ORDER BY id")->fetchAll();response(['users'=>array_map(fn($row)=>staff_record($row,$roleMap),$rows),'roles'=>staff_role_catalog($pdo)]);
    }
    if($path==='/admin/users'&&$method==='POST'){
        $data=input();$name=trim((string)($data['name'] ?? ''));$email=strtolower(trim((string)($data['email'] ?? '')));$role=(string)($data['role'] ?? '');
        if(!$name||strlen($name)>150||strlen($email)>190||!filter_var($email,FILTER_VALIDATE_EMAIL)||!isset($roleMap[$role])||$roleMap[$role]['system'])response(['message'=>'Enter a valid name, email and a custom staff role.'],422);
        $query=$pdo->prepare('SELECT id FROM users WHERE email=?');$query->execute([$email]);if($query->fetch())response(['message'=>'An account already exists with this email.'],409);
        $password='Camy!'.bin2hex(random_bytes(9)).'7';$permissions=$roleMap[$role]['permissions'];$insert=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status,must_change_password,access_role,permissions_json) VALUES(?,?,?,?,'active',1,?,?)");$insert->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$role==='Super Admin'?'admin':'manager',$role,json_encode($permissions)]);
        $query=$pdo->prepare('SELECT * FROM users WHERE id=?');$query->execute([$pdo->lastInsertId()]);response(['user'=>staff_record($query->fetch(),$roleMap),'temporaryPassword'=>$password],201);
    }
    if(!isset($userMatches[1]))response(['message'=>'Method not allowed.'],405);
    $id=(int)$userMatches[1];$query=$pdo->prepare("SELECT * FROM users WHERE id=? AND role<>'entrepreneur'");$query->execute([$id]);$row=$query->fetch();if(!$row)response(['message'=>'Staff account not found.'],404);
    $primary=(int)$pdo->query("SELECT MIN(id) FROM users WHERE role='admin'")->fetchColumn();if($id===$primary||$id===(int)$actor['id'])response(['message'=>'Your own account and the primary Super Admin are protected.'],409);
    if(($userMatches[2] ?? '')==='/reset-password'&&$method==='POST'){
        $password='Camy!'.bin2hex(random_bytes(9)).'7';$pdo->prepare('UPDATE users SET password_hash=?,must_change_password=1,session_version=session_version+1 WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$id]);$query->execute([$id]);response(['user'=>staff_record($query->fetch(),$roleMap),'temporaryPassword'=>$password]);
    }
    if(!empty($userMatches[2]))response(['message'=>'Method not allowed.'],405);
    if($method==='PATCH'){
        $data=input();$current=staff_record($row,$roleMap);$role=(string)($data['role'] ?? $current['role']);if(!isset($roleMap[$role]))response(['message'=>'Invalid staff role.'],422);
        $permissions=staff_validate_permissions($data['permissions'] ?? $roleMap[$role]['permissions'],$role==='Super Admin');if($role==='Super Admin')$permissions=staff_templates()['Super Admin'];
        $pdo->prepare('UPDATE users SET role=?,access_role=?,permissions_json=?,status=? WHERE id=?')->execute([$role==='Super Admin'?'admin':'manager',$role,json_encode($permissions),($data['active'] ?? ($row['status']==='active'))?'active':'suspended',$id]);$query->execute([$id]);response(['user'=>staff_record($query->fetch(),$roleMap)]);
    }
    if($method==='DELETE'){$pdo->prepare("UPDATE users SET status='inactive' WHERE id=?")->execute([$id]);response(['ok'=>true]);}
    response(['message'=>'Method not allowed.'],405);
}
