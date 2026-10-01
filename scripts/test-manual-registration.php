<?php
declare(strict_types=1);
require __DIR__.'/../api/config.php';

// Exercise the actual HTTP routes against a disposable database and session directory.
$pdo=new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$name='camy_manual_test_'.bin2hex(random_bytes(5));
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
    if(str_starts_with((string)$body,'<br'))throw new RuntimeException(strip_tags(substr((string)$body,0,strpos((string)$body,'{') ?: 600)));
    return json_decode((string)$body,true,512,JSON_THROW_ON_ERROR);
}
try {
    $pdo->exec("CREATE DATABASE `$name`");$pdo->exec("USE `$name`");$pdo->exec(file_get_contents(__DIR__.'/../database/schema.sql'));
    $pdo->prepare('UPDATE marketplace_state SET state_json=? WHERE id=1')->execute([json_encode(['orders'=>[],'products'=>[],'requests'=>[],'inventory'=>[],'entrepreneurs'=>[],'settlements'=>[],'tiers'=>[]])]);
    $insert=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status) VALUES('Test admin','admin@test.invalid',?,'admin','active')");$insert->execute([password_hash('AdminTest!123',PASSWORD_DEFAULT)]);
    $source=file_get_contents(__DIR__.'/../api/index.php');
    foreach(['config.php','marketplace.php','staff.php','security.php','profiles.php','catalogue.php'] as $file)$source=str_replace("__DIR__ . '/$file'",var_export(realpath(__DIR__.'/../api/'.$file),true),$source);
    $source=str_replace("__DIR__.'/../private/sessions'",var_export($directory.'/sessions',true),$source);
    $source=str_replace("__DIR__.'/../private/nic'",var_export($directory.'/nic',true),$source);
    $connection="new PDO(".var_export('mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.$name.';charset=utf8mb4',true).','.var_export(DB_USER,true).','.var_export(DB_PASS,true).',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC])';
    $source=str_replace('$pdo = database();','$pdo = '.$connection.';',$source);
    file_put_contents($directory.'/router.php',$source);
    $socket=stream_socket_server('tcp://127.0.0.1:0');$port=(int)substr(strrchr(stream_socket_get_name($socket,false),':'),1);fclose($socket);
    $process=proc_open([PHP_BINARY,'-S',"127.0.0.1:$port",$directory.'/router.php'],[0=>['pipe','r'],1=>['file',$directory.'/server.log','a'],2=>['file',$directory.'/server.log','a']],$pipes);
    check(is_resource($process),'Test server failed to start');fclose($pipes[0]);
    for($attempt=0;$attempt<40;$attempt++){ $ready=@fsockopen('127.0.0.1',$port);if($ready){fclose($ready);break;}usleep(100000); }
    $adminCookie='';$staffCookie='';$anonymous='';
    $image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
    $form=['name'=>'Manual entrepreneur','email'=>'manual@test.invalid','password'=>'Temporary123','phone'=>'0771234567','nic'=>'200012345678','address'=>'1 Test Road','city'=>'Colombo','joined'=>'2026-10-01','occupation'=>'Business owner','hasOnlineBusiness'=>'yes','onlineBusinessProducts'=>'Homeware / kitchen','onlineBusinessDuration'=>'Less than 3 months','monthlyIncome'=>'Less than Rs. 25,000','socialMediaUrl'=>'https://example.com/shop','followersCount'=>'250','facebookMarketing'=>'a_little','joinReason'=>'Grow my existing online business','agreementAccepted'=>true,'nicFrontImage'=>$image,'nicBackImage'=>$image];
    request('/admin/entrepreneurs','POST',$form,401,$anonymous);
    request('/auth/login','POST',['email'=>'admin@test.invalid','password'=>'AdminTest!123'],200,$adminCookie);
    foreach(['occupation'=>'','agreementAccepted'=>false,'nicFrontImage'=>'','nicBackImage'=>'','onlineBusinessProducts'=>'','facebookMarketing'=>'invalid','joinReason'=>'','socialMediaUrl'=>'bad-url','followersCount'=>'-1','password'=>'lettersOnly'] as $key=>$value){
        request('/admin/entrepreneurs','POST',array_replace($form,[$key=>$value]),422,$adminCookie);
    }
    check((int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='entrepreneur'")->fetchColumn()===0,'Invalid submissions must not create accounts');
    $created=request('/admin/entrepreneurs','POST',$form,201,$adminCookie);$id=$created['entrepreneur']['id'];
    $application=$pdo->query("SELECT * FROM registration_requests WHERE email='manual@test.invalid'")->fetch(PDO::FETCH_ASSOC);
    check($application['status']==='approved' && (int)$application['agreement_accepted']===1 && $application['reviewed_by']!==null,'Manual registration must keep approved history and consent');
    foreach(['occupation'=>'occupation','hasOnlineBusiness'=>'has_online_business','onlineBusinessProducts'=>'online_business_products','onlineBusinessDuration'=>'online_business_duration','monthlyIncome'=>'monthly_income','socialMediaUrl'=>'social_media_url','followersCount'=>'followers_count','facebookMarketing'=>'facebook_marketing','joinReason'=>'join_reason'] as $key=>$column)check((string)$application[$column]===(string)$form[$key],"Answer was not persisted: $key");
    check(is_file($directory.'/nic/'.$application['nic_front_path']) && is_file($directory.'/nic/'.$application['nic_back_path']),'Both NIC photos must be stored');
    $details=request('/admin/entrepreneurs/'.$id,'GET',[],200,$adminCookie);
    check((int)$details['application']['id']===(int)$application['id'],'Member profile must expose saved registration history');
    request('/admin/entrepreneurs','POST',$form,409,$adminCookie);
    request('/admin/entrepreneurs','POST',array_replace($form,['email'=>'other@test.invalid']),409,$adminCookie);
    $login=request('/auth/login','POST',['email'=>$form['email'],'password'=>$form['password']],200,$staffCookie);
    check($login['passwordResetRequired']===true,'Manual accounts must retain first-login password change');
    echo "PASS: required fields, NIC uploads, saved business answers, consent, approved history, member profile, duplicate protection and first-login password change.\n";
} finally {
    if(is_resource($process)){proc_terminate($process);proc_close($process);}
    $pdo->exec("DROP DATABASE IF EXISTS `$name`");
    foreach(glob($directory.'/sessions/*') ?: [] as $file)unlink($file);rmdir($directory.'/sessions');
    foreach(glob($directory.'/nic/*') ?: [] as $file)unlink($file);if(is_dir($directory.'/nic'))rmdir($directory.'/nic');
    foreach(glob($directory.'/*') ?: [] as $file)unlink($file);rmdir($directory);
}

