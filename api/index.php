<?php
declare(strict_types=1);

require __DIR__ . '/config.php';
require __DIR__ . '/marketplace.php';
require __DIR__ . '/staff.php';
require __DIR__ . '/security.php';
require __DIR__ . '/profiles.php';
require_once __DIR__ . '/catalogue.php';

ini_set('session.use_strict_mode','1');
ini_set('session.use_only_cookies','1');
session_name('camy_session');
$sessionDirectory=__DIR__.'/../private/sessions';
if(!is_dir($sessionDirectory))mkdir($sessionDirectory,0700,true);
session_save_path($sessionDirectory);
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'path' => '/']);
session_start();
header('Content-Type: application/json; charset=utf-8');
security_headers();

function response(array $data, int $status = 200): never {
    global $pdo,$path,$method;
    if(isset($pdo) && $pdo instanceof PDO){
        if($pdo->inTransaction())$pdo->rollBack();
        if(isset($path,$method))security_audit($pdo,$path,$method,$status);
    }
    http_response_code($status);echo json_encode(security_client_data($data),JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);exit;
}
function input(): array {
    try{$data=json_decode(file_get_contents('php://input') ?: '{}',true,64,JSON_THROW_ON_ERROR);}
    catch(JsonException $error){response(['message'=>'Invalid JSON request.'],400);}
    if(!is_array($data))response(['message'=>'Send a JSON object.'],400);
    return $data;
}
function current_user(PDO $pdo): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $query = $pdo->prepare("SELECT u.id,u.member_id,u.full_name,u.email,u.role,u.status,u.must_change_password,u.session_version,u.access_role,u.permissions_json,u.last_login_at,e.nic,e.phone,e.address,e.city,e.joined_date,e.profile_image,e.bank_name,e.bank_branch,e.account_holder,e.account_number,e.credit_limit,e.outstanding,e.total_sales FROM users u LEFT JOIN entrepreneurs e ON e.user_id=u.id WHERE u.id = ? AND u.status='active' LIMIT 1");
    $query->execute([$_SESSION['user_id']]);
    $user=$query->fetch() ?: null;
    if(!$user)return null;
    $now=time();
    if((int)($_SESSION['session_version'] ?? 0)!==(int)$user['session_version'] || $now-(int)($_SESSION['last_activity'] ?? 0)>1800 || $now-(int)($_SESSION['signed_in_at'] ?? 0)>28800){$_SESSION=[];return null;}
    $_SESSION['last_activity']=$now;
    return $user;
}
function require_admin(PDO $pdo): array {
    $user = current_user($pdo);
    if (!$user) response(['message' => 'Authentication required.'], 401);
    if (!in_array($user['role'], ['admin', 'manager'], true)) response(['message' => 'Administrator access is required.'], 403);
    return $user;
}
function member_id(PDO $pdo): string {
    $pdo->exec("INSERT IGNORE INTO marketplace_state(id,state_json) VALUES(1,'{}')");
    $pdo->query('SELECT id FROM marketplace_state WHERE id=1 FOR UPDATE')->fetch();
    $next = (int) $pdo->query('SELECT COALESCE(MAX(id), 0) + 201 FROM entrepreneurs')->fetchColumn();
    return 'CE-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
}
function valid_registration(array $data): array {
    $clean = [
        'full_name' => trim((string) ($data['fullName'] ?? $data['name'] ?? '')),
        'email' => strtolower(trim((string) ($data['email'] ?? ''))),
        'password' => (string) ($data['password'] ?? ''),
        'phone' => trim((string) ($data['phone'] ?? '')),
        'nic' => trim((string) ($data['nic'] ?? '')),
        'city' => trim((string) ($data['city'] ?? '')),
        'address' => trim((string) ($data['address'] ?? '')),
        'occupation' => trim((string) ($data['occupation'] ?? '')),
        'online_business' => (string)($data['onlineBusiness'] ?? ''),
        'products' => trim((string)($data['products'] ?? '')),
        'business_duration' => trim((string)($data['businessDuration'] ?? '')),
        'monthly_income' => trim((string)($data['monthlyIncome'] ?? '')),
        'social_link' => trim((string)($data['socialLink'] ?? '')),
        'followers' => trim((string)($data['followers'] ?? '')),
        'marketing_knowledge' => trim((string)($data['marketingKnowledge'] ?? '')),
        'reason' => trim((string)($data['reason'] ?? '')),
        'agreement' => !empty($data['agreement']),
    ];
    if (!$clean['full_name'] || !filter_var($clean['email'], FILTER_VALIDATE_EMAIL) || !$clean['phone'] || !$clean['nic'] || !$clean['address'] || !$clean['city'] || !$clean['occupation'] || !in_array($clean['online_business'],['Yes','No'],true) || !$clean['marketing_knowledge'] || !$clean['reason'] || !$clean['agreement']) response(['message' => 'Complete the required registration details and agreement.'], 422);
    foreach(['full_name'=>150,'address'=>2000,'occupation'=>120,'products'=>500,'business_duration'=>80,'monthly_income'=>80,'social_link'=>500,'followers'=>80,'marketing_knowledge'=>80,'reason'=>1000] as $field=>$max)if(strlen($clean[$field])>$max)response(['message'=>'One of the registration answers is too long.'],422);
    if (strlen($clean['password']) < 8 || !preg_match('/[A-Za-z]/', $clean['password']) || !preg_match('/\d/', $clean['password'])) response(['message' => 'Password must contain at least 8 characters, including letters and numbers.'], 422);
    return $clean;
}
function save_nic_image(string $image): string {
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,(.+)$#s', $image, $matches)) response(['message'=>'Take or upload a JPG, PNG or WebP photo of your NIC.'],422);
    $bytes=base64_decode($matches[2],true);
    if ($bytes===false || strlen($bytes)>5*1024*1024 || !getimagesizefromstring($bytes)) response(['message'=>'The NIC image is not a valid photo.'],422);
    $directory=__DIR__.'/../private/nic';
    if(!is_dir($directory) && !mkdir($directory,0700,true)) throw new RuntimeException('Could not store NIC image.');
    $name=bin2hex(random_bytes(16)).'.'.$matches[1];
    if(file_put_contents($directory.'/'.$name,$bytes)===false) throw new RuntimeException('Could not store NIC image.');
    return $name;
}
function valid_password(string $password): void {
    if (strlen($password)>1024 || strlen($password) < 8 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) response(['message' => 'Password must contain at least 8 characters, including letters and numbers.'], 422);
}
function ensure_registration_fields(PDO $pdo): void {
    foreach(['address'=>'TEXT NULL','details_json'=>'LONGTEXT NULL'] as $field=>$definition)if(!$pdo->query("SHOW COLUMNS FROM registration_requests LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE registration_requests ADD COLUMN $field $definition");
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    security_request($method);
    $pdo = database();
    ensure_registration_fields($pdo);
    $path = '/' . trim((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
    $path = preg_replace('#^/api#', '', $path) ?: '/';
    $method = $_SERVER['REQUEST_METHOD'];
    $sessionUser=current_user($pdo);
    if($sessionUser && !empty($sessionUser['must_change_password']) && !in_array($path,['/auth/me','/auth/logout','/auth/change-password'],true))response(['message'=>'Set your own password before accessing CAMY.'],403);
    if($sessionUser && $sessionUser['role']==='manager' && $sessionUser['permissions_json']!==null){
        $permissions=json_decode($sessionUser['permissions_json'],true) ?: [];
        $required=null;
        if(str_starts_with($path,'/admin/customer-reviews'))$required='admin-orders';
        elseif($path==='/admin/product-media')$required='admin-products';
        elseif(str_starts_with($path,'/admin/users'))$required='user-access';
        elseif(str_starts_with($path,'/admin/registrations') || str_starts_with($path,'/admin/entrepreneurs'))$required='entrepreneurs';
        elseif(str_starts_with($path,'/marketplace/credit/') || in_array($path,['/admin/credit-tiers','/admin/credit-settlements'],true))$required='credit-control';
        elseif(str_starts_with($path,'/marketplace/requests/'))$required='stock-supply';
        elseif(str_starts_with($path,'/marketplace/orders/'))$required='admin-orders';
        elseif(in_array($path,['/marketplace/catalog','/marketplace/activate-catalogue'],true))$required='admin-products';
        elseif($path==='/marketplace/bank')$required='stock-supply';
        if($required && !in_array($required,$permissions,true))response(['message'=>'Your staff role does not allow this action.'],403);
    }

    if ($path === '/health' && $method === 'GET') response(['ok' => true, 'database' => DB_NAME]);
    if ($path === '/auth/login' && $method === 'POST') {
        $data = input();
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
        if(strlen($email)>190 || strlen((string)($data['password'] ?? ''))>1024)response(['message'=>'Incorrect email or password.'],401);
        security_login_limit($pdo,$email,$ip);
        $query = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $query->execute([$email]);
        $user = $query->fetch();
        $password = (string) ($data['password'] ?? '');
        $valid = $user && password_verify($password, $user['password_hash']);
        $resetRequired = $user && !empty($user['must_change_password']);
        $pdo->prepare('INSERT INTO login_attempts (email, ip_address, succeeded) VALUES (?, ?, ?)')->execute([$email, $ip, $valid ? 1 : 0]);
        if (!$valid) response(['message' => 'Incorrect email or password.'], 401);
        if ($user['status'] !== 'active') response(['message' => 'This account is not active. Contact CAMY Admin.'], 403);
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['session_version'] = (int)$user['session_version'];
        $_SESSION['signed_in_at'] = $_SESSION['last_activity'] = time();
        $_SESSION['password_reset_required'] = $resetRequired;
        $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
        response(['user' => current_user($pdo), 'passwordResetRequired' => $resetRequired]);
    }
    if ($path === '/auth/register' && $method === 'POST') {
        $payload=input();$data = valid_registration($payload);
        if(empty($payload['nicImage'])) response(['message'=>'Upload or take a photo of your NIC before registering.'],422);
        $duplicate = $pdo->prepare("SELECT (SELECT COUNT(*) FROM users WHERE email = ?) + (SELECT COUNT(*) FROM entrepreneurs WHERE nic = ?) + (SELECT COUNT(*) FROM registration_requests WHERE (email = ? OR nic = ?) AND status = 'pending')");
        $duplicate->execute([$data['email'], $data['nic'], $data['email'], $data['nic']]);
        if ((int) $duplicate->fetchColumn() > 0) response(['message' => 'An account or pending request already exists for this email or NIC.'], 409);
        $imagePath=save_nic_image((string)$payload['nicImage']);
        $details=['occupation'=>$data['occupation'],'onlineBusiness'=>$data['online_business'],'products'=>$data['products'],'businessDuration'=>$data['business_duration'],'monthlyIncome'=>$data['monthly_income'],'socialLink'=>$data['social_link'],'followers'=>$data['followers'],'marketingKnowledge'=>$data['marketing_knowledge'],'reason'=>$data['reason']];
        $insert = $pdo->prepare('INSERT INTO registration_requests (full_name,email,password_hash,phone,nic,address,city,nic_image_path,details_json) VALUES (?,?,?,?,?,?,?,?,?)');
        $insert->execute([$data['full_name'],$data['email'],password_hash($data['password'], PASSWORD_DEFAULT),$data['phone'],$data['nic'],$data['address'],$data['city'],$imagePath,json_encode($details,JSON_UNESCAPED_SLASHES)]);
        response(['message' => 'Registration sent. CAMY Admin must approve your account before you can sign in.'], 201);
    }
    if ($path === '/auth/logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) { $params = session_get_cookie_params(); setcookie(session_name(), '', time() - 42000, $params['path'], '', false, true); }
        session_destroy();
        response(['ok' => true]);
    }
    if ($path === '/auth/me' && $method === 'GET') {
        $user = current_user($pdo);
        if (!$user) response(['message' => 'Authentication required.'], 401);
        response(['user' => $user, 'passwordResetRequired' => !empty($user['must_change_password'])]);
    }
    if ($path === '/auth/change-password' && $method === 'POST') {
        $user = current_user($pdo);
        if (!$user) response(['message' => 'Authentication required.'], 401);
        $data = input(); $newPassword = (string) ($data['newPassword'] ?? '');
        valid_password($newPassword);
        $hash = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $hash->execute([$user['id']]);$currentHash=(string)$hash->fetchColumn();
        if(!password_verify((string)($data['currentPassword'] ?? ''),$currentHash))response(['message'=>'Your temporary or current password is incorrect.'],422);
        if(password_verify($newPassword,$currentHash))response(['message'=>'Choose a password different from your temporary or current password.'],422);
        $update = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0, session_version=session_version+1 WHERE id = ?');
        $update->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);
        $_SESSION['session_version']=(int)$user['session_version']+1;
        session_regenerate_id(true);
        unset($_SESSION['password_reset_required']);
        response(['message' => 'Password updated successfully.']);
    }
    if ($path === '/admin/registrations' && $method === 'GET') {
        require_admin($pdo);
        $rows = $pdo->query("SELECT id,full_name,email,phone,nic,address,city,status,created_at,nic_image_path,details_json FROM registration_requests WHERE status = 'pending' ORDER BY created_at ASC")->fetchAll();
        foreach($rows as &$row)$row['details']=json_decode((string)($row['details_json'] ?? '{}'),true) ?: [];unset($row);
        response(['registrations' => $rows]);
    }
    if (preg_match('#^/admin/registrations/(\d+)/nic$#',$path,$matches) && $method==='GET') {
        require_admin($pdo);$query=$pdo->prepare('SELECT nic_image_path FROM registration_requests WHERE id=?');$query->execute([(int)$matches[1]]);$name=$query->fetchColumn();
        if(!$name) response(['message'=>'NIC image not found.'],404);
        $file=__DIR__.'/../private/nic/'.basename((string)$name);if(!is_file($file)) response(['message'=>'NIC image not found.'],404);
        header('Content-Type: '.(mime_content_type($file) ?: 'image/jpeg'));header('Content-Length: '.filesize($file));readfile($file);exit;
    }
    if (preg_match('#^/admin/entrepreneurs/([^/]+)/nic$#',$path,$matches) && $method==='GET') {
        require_admin($pdo);$query=$pdo->prepare('SELECT nic_image_path FROM entrepreneurs WHERE member_id=?');$query->execute([$matches[1]]);$name=$query->fetchColumn();
        if(!$name) response(['message'=>'NIC image not found.'],404);
        $file=__DIR__.'/../private/nic/'.basename((string)$name);if(!is_file($file)) response(['message'=>'NIC image not found.'],404);
        header('Content-Type: '.(mime_content_type($file) ?: 'image/jpeg'));header('Content-Length: '.filesize($file));readfile($file);exit;
    }
    if (preg_match('#^/admin/registrations/(\d+)/(approve|reject)$#', $path, $matches) && $method === 'POST') {
        $admin = require_admin($pdo); $id = (int) $matches[1]; $decision = $matches[2];
        $pdo->beginTransaction();
        $query = $pdo->prepare("SELECT * FROM registration_requests WHERE id = ? AND status = 'pending' FOR UPDATE"); $query->execute([$id]); $request = $query->fetch();
        if (!$request) { $pdo->rollBack(); response(['message' => 'This registration was already reviewed or does not exist.'], 404); }
        if ($decision === 'reject') {
            $pdo->prepare("UPDATE registration_requests SET status='rejected',reviewed_by=?,reviewed_at=NOW() WHERE id=?")->execute([$admin['id'],$id]); $pdo->commit(); response(['message' => 'Registration rejected.']);
        }
        $check = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?'); $check->execute([$request['email']]);
        if ((int)$check->fetchColumn()) { $pdo->rollBack(); response(['message' => 'A user already exists with this email.'], 409); }
        $memberId = member_id($pdo);
        $userInsert = $pdo->prepare("INSERT INTO users(member_id,full_name,email,password_hash,role,status) VALUES(?,?,?,?, 'entrepreneur','active')");
        $userInsert->execute([$memberId,$request['full_name'],$request['email'],$request['password_hash']]); $userId=(int)$pdo->lastInsertId();
        $entrepreneurInsert=$pdo->prepare('INSERT INTO entrepreneurs(user_id,member_id,nic,nic_image_path,phone,address,city,joined_date) VALUES(?,?,?,?,?,?,?,CURDATE())');
        $entrepreneurInsert->execute([$userId,$memberId,$request['nic'],$request['nic_image_path'],$request['phone'],$request['address'],$request['city']]);
        $pdo->prepare("UPDATE registration_requests SET status='approved',reviewed_by=?,reviewed_at=NOW() WHERE id=?")->execute([$admin['id'],$id]);
        $pdo->commit(); response(['message'=>'Registration approved. The entrepreneur can now sign in.','memberId'=>$memberId]);
    }
    if ($path === '/admin/entrepreneurs' && $method === 'POST') {
        require_admin($pdo); $data=valid_registration(input());
        $check=$pdo->prepare('SELECT COUNT(*) FROM users WHERE email=?'); $check->execute([$data['email']]);
        if((int)$check->fetchColumn()) response(['message'=>'An account already exists with this email.'],409);
        $pdo->beginTransaction(); $memberId=member_id($pdo);
        $userInsert=$pdo->prepare("INSERT INTO users(member_id,full_name,email,password_hash,role,status,must_change_password) VALUES(?,?,?,?, 'entrepreneur','active',1)");
        $userInsert->execute([$memberId,$data['full_name'],$data['email'],password_hash($data['password'],PASSWORD_DEFAULT)]); $userId=(int)$pdo->lastInsertId();
        $entrepreneurInsert=$pdo->prepare('INSERT INTO entrepreneurs(user_id,member_id,nic,phone,city,joined_date) VALUES(?,?,?,?,?,CURDATE())');
        $entrepreneurInsert->execute([$userId,$memberId,$data['nic'],$data['phone'],$data['city']]); $pdo->commit();
        response(['entrepreneur'=>['id'=>$memberId,'name'=>$data['full_name'],'email'=>$data['email'],'phone'=>$data['phone'],'nic'=>$data['nic'],'city'=>$data['city'],'joined'=>date('Y-m-d'),'sales'=>0,'credit'=>0,'used'=>0,'stage'=>'Trial seller','initials'=>strtoupper(substr($data['full_name'],0,1))]],201);
    }

    staff_route($pdo, $path, $method);
    profiles_route($pdo, $path, $method);
    catalogue_route($pdo, $path, $method);
    market_route($pdo, $path, $method);
    response(['message' => 'API route not found.'], 404);
} catch (Throwable $error) {
    if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();
    error_log($error->getMessage());
    if($error instanceof PDOException && $error->getCode()==='23000')response(['message'=>'This record conflicts with an existing record. Refresh and check the details.'],409);
    response(['message' => 'CAMY could not save this request. Please retry or contact the administrator.'], 500);
}
