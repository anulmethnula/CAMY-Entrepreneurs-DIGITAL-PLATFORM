<?php
declare(strict_types=1);
require __DIR__.'/../api/config.php';
require __DIR__.'/../api/security.php';
session_save_path(__DIR__.'/../private/sessions');
if(!is_dir(session_save_path()))mkdir(session_save_path(),0700,true);
session_start();
function valid_password(string $password): void {if(strlen($password)<8||!preg_match('/[A-Za-z]/',$password)||!preg_match('/\d/',$password))response(['message'=>'Invalid password'],422);}
final class ApiResult extends RuntimeException {public function __construct(public array $data,public int $status){parent::__construct('API result');}}
function response(array $data,int $status=200): never {throw new ApiResult($data,$status);}
function input(): array {return $GLOBALS['payload'] ?? [];}
function current_user(PDO $pdo): ?array {return $GLOBALS['actor'] ?? null;}
function require_admin(PDO $pdo): array {$user=current_user($pdo);if(!$user||!in_array($user['role'],['admin','manager'],true))response(['message'=>'Forbidden'],403);return $user;}
require __DIR__.'/../api/marketplace.php';

function endpoint(PDO $pdo,string $path,string $method,array $data=[],int $expected=200): array {
    $GLOBALS['payload']=$data;
    try{market_route($pdo,$path,$method);throw new RuntimeException('No API response');}
    catch(ApiResult $result){if($pdo->inTransaction())$pdo->rollBack();if($result->status!==$expected)throw new RuntimeException($path.' returned '.$result->status.': '.json_encode($result->data));return $result->data;}
}
function assert_that(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}

$pdo=new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$name='camy_dropship_test_'.bin2hex(random_bytes(5));$receiptIds=[];
try{
    $pdo->exec("CREATE DATABASE `$name`");$pdo->exec("USE `$name`");$pdo->exec(file_get_contents(__DIR__.'/../database/schema.sql'));
    $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES(1,'CE-TEST','Test Entrepreneur','seller@example.com','unused','entrepreneur','active')");
    $state=['products'=>[['id'=>1,'code'=>'TEST','name'=>'Test product','category'=>'Test','description'=>'Test','price'=>100,'stock'=>10]],'entrepreneurs'=>[['id'=>'CE-TEST','name'=>'Test Entrepreneur','city'=>'Colombo','sales'=>0,'credit'=>0,'used'=>0]],'tiers'=>[['id'=>'tier-1','name'=>'Starter','sales'=>100,'credit'=>10]],'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true];
    $pdo->exec("INSERT INTO marketplace_state(id,state_json) VALUES(1,'{}')");market_save($pdo,$state);
    $admin=['id'=>2,'role'=>'admin','member_id'=>null,'full_name'=>'CAMY Admin'];$seller=['id'=>1,'role'=>'entrepreneur','member_id'=>'CE-TEST','full_name'=>'Test Entrepreneur'];
    $camyBank=['bank'=>'CAMY Bank','branch'=>'Head Office','holder'=>'CAMY','account'=>'111111'];
    $sellerBank=['bank'=>'Seller Bank','branch'=>'Colombo','holder'=>'Test Entrepreneur','account'=>'222222'];
    $GLOBALS['actor']=$admin;endpoint($pdo,'/marketplace/bank','POST',$camyBank);
    $GLOBALS['actor']=$seller;endpoint($pdo,'/marketplace/bank','POST',$sellerBank);endpoint($pdo,'/marketplace/shop-price','POST',['productId'=>1,'price'=>120]);
    $_GET['shop']='CE-TEST';$public=endpoint($pdo,'/marketplace/public','GET');$_GET=[];
    assert_that(count($public['entrepreneurs'])===1&&count($public['inventory'])===1,'Private shop listing was not generated from CAMY stock.');
    assert_that((float)$public['inventory'][0]['price']===120.0,'Entrepreneur price override was not published.');

    $GLOBALS['actor']=null;$buyer=['name'=>'Test Buyer','phone'=>'0771234567','district'=>'Colombo','address'=>'123 Test Street'];
    endpoint($pdo,'/customer/register','POST',$buyer+['email'=>'buyer@example.com','password'=>'Buyer1234'],201);
    $bankOrder=endpoint($pdo,'/marketplace/orders','POST',['requestKey'=>'bank-order-test-0001','customer'=>$buyer,'paymentMethod'=>'bank_transfer','items'=>[['shopId'=>'CE-TEST','productId'=>1,'qty'=>2,'expectedPrice'=>120]]],201);
    $bankId=$bankOrder['ids'][0];$bankToken=$bankOrder['tracking'][0]['token'];$receiptIds[]=$bankId;
    $created=market_state($pdo)['orders'][0];
    assert_that($created['amount']===240.0&&$created['camyAmount']===200.0&&$created['commissionAmount']===40.0,'Order economics were not frozen correctly.');
    assert_that(market_state($pdo)['products'][0]['stock']===8,'CAMY warehouse stock was not reserved at checkout.');
    $GLOBALS['actor']=$seller;endpoint($pdo,"/marketplace/orders/$bankId/status",'POST',['status'=>'Awaiting payment'],403);
    $GLOBALS['actor']=$admin;$approved=endpoint($pdo,"/marketplace/orders/$bankId/status",'POST',['status'=>'Awaiting payment']);
    $approvedOrder=array_values(array_filter($approved['orders'],fn($order)=>$order['id']===$bankId))[0];
    assert_that($approvedOrder['bankDetails']['account']==='111111','Customer was not given the CAMY payment account.');
    $receipt=['reference'=>'CAMY-PAY-001','receipt'=>'data:application/pdf;base64,'.base64_encode("%PDF-1.4\nTest receipt"),'receiptName'=>'test.pdf','token'=>$bankToken];
    $GLOBALS['actor']=null;endpoint($pdo,"/marketplace/orders/$bankId/receipt",'POST',$receipt);
    $GLOBALS['actor']=$seller;endpoint($pdo,"/marketplace/orders/$bankId/status",'POST',['status'=>'Processing'],403);
    $GLOBALS['actor']=$admin;endpoint($pdo,"/marketplace/orders/$bankId/status",'POST',['status'=>'Processing']);
    $verified=array_values(array_filter(market_state($pdo)['orders'],fn($order)=>$order['id']===$bankId))[0];
    assert_that($verified['paymentStatus']==='Collected'&&$verified['commissionStatus']==='Payable','Verified CAMY payment did not create payable commission.');
    $due=strtotime($verified['commissionDueAt']);assert_that($due>=time()+6*86400&&$due<=time()+8*86400,'Commission deadline is not seven days from collection.');
    endpoint($pdo,"/marketplace/orders/$bankId/pay-commission",'POST',['reference'=>'PAYOUT-001']);
    $paid=array_values(array_filter(market_state($pdo)['orders'],fn($order)=>$order['id']===$bankId))[0];
    assert_that($paid['commissionStatus']==='Paid'&&$paid['commissionBank']['account']==='222222','Commission payout was not recorded against the entrepreneur account.');
    endpoint($pdo,"/marketplace/orders/$bankId/status",'POST',['status'=>'Dispatched','courier'=>'CAMY Courier','trackingNumber'=>'TRACK-001']);
    endpoint($pdo,"/marketplace/orders/$bankId/status",'POST',['status'=>'Delivered']);

    $GLOBALS['actor']=$seller;endpoint($pdo,'/marketplace/shop-price','POST',['productId'=>1,'price'=>90]);
    $GLOBALS['actor']=null;$cod=endpoint($pdo,'/marketplace/orders','POST',['requestKey'=>'cod-order-test-00001','customer'=>$buyer,'paymentMethod'=>'cash_on_delivery','items'=>[['shopId'=>'CE-TEST','productId'=>1,'qty'=>1,'expectedPrice'=>90]]],201);
    $codId=$cod['ids'][0];$GLOBALS['actor']=$admin;endpoint($pdo,"/marketplace/orders/$codId/status",'POST',['status'=>'Processing']);endpoint($pdo,"/marketplace/orders/$codId/status",'POST',['status'=>'Dispatched','trackingNumber'=>'TRACK-COD']);endpoint($pdo,"/marketplace/orders/$codId/status",'POST',['status'=>'Delivered']);
    endpoint($pdo,"/marketplace/orders/$codId/collect-cod",'POST',['reference'=>'COD-REMIT-001']);
    endpoint($pdo,"/marketplace/orders/$codId/collect-cod",'POST',['reference'=>'COD-REMIT-002'],409);
    $afterCod=market_state($pdo);$codOrder=array_values(array_filter($afterCod['orders'],fn($order)=>$order['id']===$codId))[0];$person=array_values(array_filter($afterCod['entrepreneurs'],fn($entry)=>$entry['id']==='CE-TEST'))[0];
    assert_that($codOrder['paymentStatus']==='Collected'&&$codOrder['commissionStatus']==='Not applicable','COD collection state is incorrect.');
    assert_that((float)$person['used']===10.0,'Below-base seller contribution did not protect CAMY amount.');
    assert_that($afterCod['products'][0]['stock']===7,'Warehouse reservations are inconsistent across bank and COD orders.');

    session_destroy();
    echo "API integration passed: isolated shop, CAMY warehouse reservation, CAMY-only payment control, bank transfer, COD, frozen margins, seven-day commission payout, and below-base contribution.\n";
}finally{
    if($pdo->inTransaction())$pdo->rollBack();
    foreach($receiptIds as $id)foreach(glob(__DIR__.'/../private/receipts/'.$id.'-*') ?: [] as $file)unlink($file);
    $pdo->exec("DROP DATABASE `$name`");
}
