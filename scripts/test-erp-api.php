<?php
declare(strict_types=1);

require __DIR__.'/../api/config.php';

final class ApiResult extends RuntimeException {
    public function __construct(public array $data, public int $status){ parent::__construct('API result'); }
}
function response(array $data,int $status=200): never { throw new ApiResult($data,$status); }
function input(): array { return $GLOBALS['payload'] ?? []; }
function current_user(PDO $pdo): ?array { return $GLOBALS['actor'] ?? null; }
function require_admin(PDO $pdo): array {
    $user=current_user($pdo);
    if(!$user||!in_array($user['role'],['admin','manager'],true))response(['message'=>'Forbidden'],403);
    return $user;
}
function valid_password(string $password): void {}
require __DIR__.'/../api/marketplace.php';

function endpoint(PDO $pdo,string $path,string $method,array $payload=[],int $expected=200): array {
    $GLOBALS['payload']=$payload;
    try {
        market_route($pdo,$path,$method);
        throw new RuntimeException("No response for $method $path");
    } catch(ApiResult $result) {
        if($pdo->inTransaction())$pdo->rollBack();
        if($result->status!==$expected)throw new RuntimeException("$method $path expected $expected, got {$result->status}: ".json_encode($result->data));
        return $result->data;
    }
}

$server=new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db='camy_erp_test_'.bin2hex(random_bytes(5));
function ensure(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
try {
 $server->exec("CREATE DATABASE `$db`");$server->exec("USE `$db`");$server->exec(file_get_contents(__DIR__.'/../database/schema.sql'));$pdo=$server;
 $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES(1,'E1','Test','e@test.invalid','unused','entrepreneur','active')");
 $state=['products'=>[['id'=>1,'code'=>'P1','name'=>'Product','category'=>'Test','price'=>100,'stock'=>8]],'entrepreneurs'=>[['id'=>'E1','name'=>'Test','sales'=>0,'credit'=>0,'used'=>0,'bankDetails'=>['bank'=>'Bank','account'=>'0000123']]],'tiers'=>[],'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true];market_save($pdo,$state);
 $GLOBALS['actor']=null;endpoint($pdo,'/admin/reports/data','GET',[],401);
 $admin=['id'=>2,'role'=>'admin','full_name'=>'Admin'];$seller=['id'=>1,'member_id'=>'E1','role'=>'entrepreneur','full_name'=>'Test'];$GLOBALS['actor']=$seller;
 endpoint($pdo,'/admin/reports/data','GET',[],403);
 $created=endpoint($pdo,'/marketplace/dropship-orders','POST',['customer'=>['name'=>'Test buyer','phone'=>'0771234567','phone2'=>'0712345678','district'=>'Colombo','address'=>'Test address'],'items'=>[['productId'=>1,'qty'=>1,'sellPrice'=>150]]],201)['order'];$id=$created['id'];
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','trackingNumber'=>'00123'],403);
 $GLOBALS['actor']=$admin;
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Processing']);
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','trackingNumber'=>''],422);
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','trackingNumber'=>'00123','courier'=>"Bad\nCourier"],422);
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','trackingNumber'=>'00123','courier'=>'Courier']);
 $before=market_state($pdo);$first=array_values(array_filter($before['orders'],fn($o)=>$o['id']===$id))[0];$dispatched=$first['dispatchedAt'];
 ensure(count($first['statusHistory'])===2,'Dispatch history missing');
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','trackingNumber'=>'0000456','courier'=>'New Courier']);
 $after=market_state($pdo);$order=array_values(array_filter($after['orders'],fn($o)=>$o['id']===$id))[0];ensure($order['trackingNumber']==='0000456','Leading zeros lost');ensure($order['dispatchedAt']===$dispatched,'Tracking edit rewrote dispatch time');ensure(count($order['statusHistory'])===2,'Tracking edit created duplicate status history');
 $deliveredResult=endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Delivered']);ensure(count($deliveredResult['orders'][0]['statusHistory'])===3,'Immediate history response missing');
 endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','trackingNumber'=>'change'],409);
 $report=endpoint($pdo,'/admin/reports/data','GET');ensure($report['access']['finance'],'Admin finance denied');ensure(count($report['orders'][0]['statusHistory'])===3,'Delivered history missing');ensure($report['entrepreneurs'][0]['bankDetails']['account']==='0000123','Bank account lost');ensure(!str_contains(json_encode($report),'password_hash')&&!str_contains(json_encode($report),'trackingToken'),'Secret fields leaked');
 $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'[]'];endpoint($pdo,'/admin/reports/data','GET',[],403);
 $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'["reports"]'];$limited=endpoint($pdo,'/admin/reports/data','GET');ensure(!$limited['access']['finance']&&!$limited['access']['credit'],'Report access expanded permissions');ensure(!isset($limited['entrepreneurs'][0]['bankDetails'])&&!isset($limited['orders'][0]['entrepreneurMargin']),'Finance data leaked');
 echo "PASS: report authorization, bank redaction, dispatch validation, leading zeros, tracking correction, preserved timestamps, delivered lock and actual status history.\n";
}finally{$server->exec("DROP DATABASE IF EXISTS `$db`");}
