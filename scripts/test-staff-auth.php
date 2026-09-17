<?php
declare(strict_types=1);
require __DIR__.'/../api/config.php';

// Exercise the actual HTTP routes against a disposable database and session directory.
$pdo=new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$name='camy_staff_test_'.bin2hex(random_bytes(5));
$directory=sys_get_temp_dir().'/'.$name;
mkdir($directory);mkdir($directory.'/sessions');
$process=null;
function check(bool $condition,string $message): void { if(!$condition)throw new RuntimeException($message); }
function request(string $path,string $method,array $data,int $expected,string &$cookie,bool $safe=true,string $extraHeaders=''): array {
    global $port;
    $headers="Content-Type: application/json\r\n".($safe?"X-CAMY-Request: 1\r\n":'').$extraHeaders.($cookie?"Cookie: $cookie\r\n":'');
    $context=stream_context_create(['http'=>['method'=>$method,'header'=>$headers,'content'=>json_encode($data),'ignore_errors'=>true,'timeout'=>5]]);
    $body=file_get_contents("http://127.0.0.1:$port/api$path",false,$context);
    $status=0;
    foreach($http_response_header ?? [] as $header){
        if(preg_match('#^HTTP/\S+ (\d+)#',$header,$match))$status=(int)$match[1];
        if(preg_match('#^Set-Cookie: (camy_session=[^;]+)#i',$header,$match))$cookie=$match[1];
    }
    check($status===$expected,"$path: expected $expected, received $status");
    return json_decode((string)$body,true,512,JSON_THROW_ON_ERROR);
}
try {
    $pdo->exec("CREATE DATABASE `$name`");$pdo->exec("USE `$name`");$pdo->exec(file_get_contents(__DIR__.'/../database/schema.sql'));
    $insert=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status) VALUES('Test admin','admin@test.invalid',?,'admin','active')");$insert->execute([password_hash('AdminTest!123',PASSWORD_DEFAULT)]);
    $source=file_get_contents(__DIR__.'/../api/index.php');
    foreach(['config.php','marketplace.php','staff.php','security.php','profiles.php','catalogue.php'] as $file)$source=str_replace("__DIR__ . '/$file'",var_export(realpath(__DIR__.'/../api/'.$file),true),$source);
    $source=str_replace("__DIR__.'/../private/sessions'",var_export($directory.'/sessions',true),$source);
    $connection="new PDO(".var_export('mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.$name.';charset=utf8mb4',true).','.var_export(DB_USER,true).','.var_export(DB_PASS,true).',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC])';
    $source=str_replace('$pdo = database();','$pdo = '.$connection.';',$source);
    file_put_contents($directory.'/router.php',$source);
    $socket=stream_socket_server('tcp://127.0.0.1:0');$port=(int)substr(strrchr(stream_socket_get_name($socket,false),':'),1);fclose($socket);
    $process=proc_open([PHP_BINARY,'-S',"127.0.0.1:$port",$directory.'/router.php'],[0=>['pipe','r'],1=>['file',$directory.'/server.log','a'],2=>['file',$directory.'/server.log','a']],$pipes);
    check(is_resource($process),'Test server failed to start');fclose($pipes[0]);
    for($attempt=0;$attempt<40;$attempt++){ $ready=@fsockopen('127.0.0.1',$port);if($ready){fclose($ready);break;}usleep(100000); }
    $adminCookie='';$staffCookie='';$anonymous='';
    request('/admin/users','GET',[],401,$anonymous);
    request('/auth/login','POST',[],403,$anonymous,false);
    request('/auth/login','POST',[],403,$anonymous,true,"Sec-Fetch-Site: cross-site\r\n");
    request('/auth/login','POST',['email'=>'admin@test.invalid','password'=>'AdminTest!123'],200,$adminCookie);
    $created=request('/admin/users','POST',['name'=>'New admin','email'=>'new@test.invalid','role'=>'Super Admin'],201,$adminCookie);
    $temporary=$created['temporaryPassword'];$id=$created['user']['id'];
    $row=$pdo->query("SELECT password_hash,must_change_password FROM users WHERE id=".(int)$id)->fetch(PDO::FETCH_ASSOC);
    check($row['password_hash']!==$temporary && password_verify($temporary,$row['password_hash']),'Temporary password must be hashed');
    check((int)$row['must_change_password']===1,'First login must require password change');
    $directoryResult=request('/admin/users','GET',[],200,$adminCookie);
    check(!str_contains(json_encode($directoryResult),$temporary),'Directory must not reveal temporary password');
    request('/admin/users','POST',['name'=>'Duplicate','email'=>'new@test.invalid','role'=>'Super Admin'],409,$adminCookie);
    request('/auth/login','POST',['email'=>'new@test.invalid','password'=>'WrongPassword123'],401,$staffCookie);
    $login=request('/auth/login','POST',['email'=>'new@test.invalid','password'=>$temporary],200,$staffCookie);
    $otherSession='';request('/auth/login','POST',['email'=>'new@test.invalid','password'=>$temporary],200,$otherSession);
    check($login['passwordResetRequired']===true,'Temporary login must require password change');
    check(request('/auth/me','GET',[],200,$staffCookie)['passwordResetRequired']===true,'Reload must preserve required change');
    request('/admin/users','GET',[],403,$staffCookie);
    request('/auth/change-password','POST',['currentPassword'=>'WrongPassword123','newPassword'=>'PrivatePassword!123'],422,$staffCookie);
    request('/auth/change-password','POST',['currentPassword'=>$temporary,'newPassword'=>$temporary],422,$staffCookie);
    request('/auth/change-password','POST',['currentPassword'=>$temporary,'newPassword'=>'PrivatePassword!123'],200,$staffCookie);
    request('/auth/me','GET',[],401,$otherSession);
    check(request('/auth/me','GET',[],200,$staffCookie)['passwordResetRequired']===false,'Password change must clear required flag');
    request('/admin/users','GET',[],200,$staffCookie);
    request('/auth/logout','POST',[],200,$staffCookie);
    request('/auth/login','POST',['email'=>'new@test.invalid','password'=>$temporary],401,$staffCookie);
    $login=request('/auth/login','POST',['email'=>'new@test.invalid','password'=>'PrivatePassword!123'],200,$staffCookie);
    check($login['passwordResetRequired']===false,'Private password login should open workspace');
    $viewer=request('/admin/users','POST',['name'=>'Read-only user','email'=>'viewer@test.invalid','role'=>'Viewer'],201,$adminCookie);
    $viewerCookie='';request('/auth/login','POST',['email'=>'viewer@test.invalid','password'=>$viewer['temporaryPassword']],200,$viewerCookie);
    request('/auth/change-password','POST',['currentPassword'=>$viewer['temporaryPassword'],'newPassword'=>'ViewerPrivate!123'],200,$viewerCookie);
    request('/admin/users','GET',[],403,$viewerCookie);
    request('/marketplace/catalog','POST',['products'=>[]],403,$viewerCookie);
    request('/admin/credit-tiers','POST',['tiers'=>[]],403,$viewerCookie);
    request('/admin/users/'.$viewer['user']['id'],'PATCH',['role'=>'Finance','active'=>false,'permissions'=>['overview','credit-control','reports']],200,$adminCookie);
    request('/auth/me','GET',[],401,$viewerCookie);
    request('/auth/login','POST',['email'=>'viewer@test.invalid','password'=>'ViewerPrivate!123'],403,$viewerCookie);
    $pdo->exec("INSERT INTO login_attempts(email,ip_address,succeeded) VALUES ".implode(',',array_fill(0,10,"('locked@test.invalid','127.0.0.1',0)")));
    request('/auth/login','POST',['email'=>'admin@test.invalid','password'=>'AdminTest!123'],429,$anonymous);
    check((int)$pdo->query('SELECT COUNT(*) FROM audit_logs')->fetchColumn()>0,'Management changes must be audited');
    echo "PASS: Staff accounts, password change and session revocation, cross-site protection, role restrictions, suspended accounts, audit log, and sign-in lockout.\n";
} finally {
    if(is_resource($process)){proc_terminate($process);proc_close($process);}
    $pdo->exec("DROP DATABASE IF EXISTS `$name`");
    foreach(glob($directory.'/sessions/*') ?: [] as $file)unlink($file);
    rmdir($directory.'/sessions');
    foreach(glob($directory.'/*') ?: [] as $file)unlink($file);
    rmdir($directory);
}
