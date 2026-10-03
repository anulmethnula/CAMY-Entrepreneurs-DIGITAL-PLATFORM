<?php
declare(strict_types=1);

function security_headers(): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cache-Control: no-store');
}
function security_request(string $method): void {
    if(!in_array($method,['GET','POST','PATCH','DELETE'],true))response(['message'=>'Method not allowed.'],405);
    if($method==='GET')return;
    if(($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')==='cross-site')response(['message'=>'Cross-site requests are not allowed.'],403);
    if(($_SERVER['HTTP_X_CAMY_REQUEST'] ?? '')!=='1')response(['message'=>'Refresh CAMY and submit this action from the app.'],403);
    if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE'] ?? '')[0]))!=='application/json')response(['message'=>'Send a JSON request.'],415);
    $requestPath=(string)parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
    $largeUpload=in_array($requestPath,['/api/admin/product-media','/admin/product-media','/api/auth/register','/auth/register'],true);
    $limit=$largeUpload?14*1024*1024:8*1024*1024;
    if((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>$limit)response(['message'=>'The upload is too large. Maximum request size is '.($limit/1024/1024).' MB.'],413);
}
function security_client_data(array $data): array {
    unset($data['trackingToken'],$data['receiptPath']);
    foreach($data as $key=>$value)if(is_array($value))$data[$key]=security_client_data($value);
    return $data;
}
function security_login_limit(PDO $pdo,string $email,string $ip): void {
    $query=$pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE succeeded=0 AND attempted_at>DATE_SUB(NOW(),INTERVAL 15 MINUTE) AND (email=? OR ip_address=?)');
    $query->execute([$email,$ip]);
    if((int)$query->fetchColumn()>=10){header('Retry-After: 900');response(['message'=>'Too many sign-in attempts. Try again in 15 minutes.'],429);}
}
function security_audit(PDO $pdo,string $path,string $method,int $status): void {
    if(!in_array($method,['POST','PATCH','DELETE'],true)||str_starts_with($path,'/auth/'))return;
    $query=$pdo->prepare('INSERT INTO audit_logs(user_id,action,resource,status_code,ip_address) VALUES(?,?,?,?,?)');
    $query->execute([$_SESSION['user_id'] ?? null,$method,substr($path,0,255),$status,substr($_SERVER['REMOTE_ADDR'] ?? '',0,45)]);
}
