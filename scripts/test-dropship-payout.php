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
$db='camy_payout_test_'.bin2hex(random_bytes(5));
$receiptFiles=[];
try {
    $server->exec("CREATE DATABASE `$db`");
    $server->exec("USE `$db`");
    $server->exec((string)file_get_contents(__DIR__.'/../database/schema.sql'));
    $pdo=$server;

    $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES
      (1,'CE-PAYOUT','Payout Seller','seller@camy.test','unused','entrepreneur','active'),
      (2,NULL,'CAMY Admin','admin@camy.test','unused','admin','active')");
    $pdo->exec("INSERT INTO entrepreneurs(user_id,member_id,nic,phone,address,city,joined_date,bank_name,bank_branch,account_holder,account_number)
      VALUES(1,'CE-PAYOUT','200012345678','0771234567','10 Test Road','Colombo',CURDATE(),'Test Bank','Colombo','Payout Seller','123456789')");

    $state=[
      'products'=>[['id'=>1,'code'=>'CAMY-TEST','name'=>'CAMY Test Product','category'=>'Test','description'=>'Test','price'=>100.0,'stock'=>10,'image'=>'']],
      'entrepreneurs'=>[['id'=>'CE-PAYOUT','name'=>'Payout Seller','email'=>'seller@camy.test','phone'=>'0771234567','city'=>'Colombo','joined'=>date('Y-m-d'),'active'=>true,'stage'=>'Trial seller','sales'=>0,'credit'=>0,'used'=>0,'bankDetails'=>['bank'=>'Test Bank','branch'=>'Colombo','holder'=>'Payout Seller','account'=>'123456789']]],
      'tiers'=>[['id'=>'tier-1','name'=>'Tier 1','sales'=>200.0,'credit'=>50.0]],
      'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true
    ];
    $pdo->exec("INSERT INTO marketplace_state(id,state_json) VALUES(1,'{}')");
    market_save($pdo,$state);

    $seller=['id'=>1,'role'=>'entrepreneur','member_id'=>'CE-PAYOUT','full_name'=>'Payout Seller'];
    $admin=['id'=>2,'role'=>'admin','member_id'=>null,'full_name'=>'CAMY Admin'];

    $GLOBALS['actor']=$seller;
    $created=endpoint($pdo,'/marketplace/dropship-orders','POST',[
      'customer'=>['name'=>'Client One','phone'=>'0775555555','district'=>'Colombo','address'=>'20 Client Road','notes'=>'COD test'],
      'paymentMethod'=>'cod',
      'items'=>[['productId'=>1,'qty'=>2,'sellPrice'=>150]]
    ],201)['order'];
    $id=$created['id'];
    if((float)$created['amount']!==300.0||(float)$created['camyCost']!==200.0||(float)$created['entrepreneurMargin']!==100.0)throw new RuntimeException('Dropship price split is incorrect.');
    $ledger=$pdo->prepare('SELECT * FROM entrepreneur_payouts WHERE order_id=?');$ledger->execute([$id]);$row=$ledger->fetch();
    if(!$row||(float)$row['payout_amount']!==100.0||$row['payout_status']!=='pending_delivery')throw new RuntimeException('Payout ledger was not created correctly.');

    $GLOBALS['actor']=$admin;
    endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','courier'=>'QA Courier','trackingNumber'=>'QA-123']);
    $delivered=endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Delivered']);
    $order=array_values(array_filter($delivered['orders'],fn($item)=>$item['id']===$id))[0];
    if($order['payoutStatus']!=='pending_transfer'||$order['clientPaymentStatus']!=='Collected by CAMY')throw new RuntimeException('Delivered order did not enter payout queue.');
    $person=array_values(array_filter($delivered['entrepreneurs'],fn($item)=>$item['id']==='CE-PAYOUT'))[0];
    if((float)$person['sales']!==200.0||(float)$person['credit']!==50.0||$person['stage']!=='Credit eligible')throw new RuntimeException('Credit stage did not use verified CAMY product value.');

    $receipt='data:application/pdf;base64,'.base64_encode("%PDF-1.4\nCAMY payout test");
    $paid=endpoint($pdo,"/marketplace/orders/$id/payout",'POST',['reference'=>'CAMY-PAYOUT-001','receipt'=>$receipt]);
    if(($paid['order']['payoutStatus']??'')!=='paid'||($paid['order']['payoutReference']??'')!=='CAMY-PAYOUT-001')throw new RuntimeException('Payout was not recorded as paid.');
    $ledger->execute([$id]);$row=$ledger->fetch();
    if($row['payout_status']!=='paid'||!$row['payout_receipt_path']||!$row['paid_at'])throw new RuntimeException('Paid payout ledger fields are incomplete.');
    $receiptFiles[]=(string)$row['payout_receipt_path'];

    endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Returned']);
    $ledger->execute([$id]);$row=$ledger->fetch();
    if($row['payout_status']!=='reversal_required')throw new RuntimeException('Returned paid order did not flag payout reconciliation.');

    $GLOBALS['actor']=$seller;
    $clientReceipt='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2K7sAAAAASUVORK5CYII=';
    $bankOrder=endpoint($pdo,'/marketplace/dropship-orders','POST',[
      'customer'=>['name'=>'Client Two','phone'=>'0776666666','district'=>'Gampaha','address'=>'30 Client Road'],
      'paymentMethod'=>'bank',
      'clientPaymentReference'=>'CLIENT-BANK-001',
      'clientPaymentReceipt'=>$clientReceipt,
      'clientPaymentReceiptName'=>'client.png',
      'items'=>[['productId'=>1,'qty'=>1,'sellPrice'=>175]]
    ],201)['order'];
    if(($bankOrder['clientPaymentMethod']??'')!=='bank'||($bankOrder['clientPaymentReference']??'')!=='CLIENT-BANK-001'||empty($bankOrder['receipt']))throw new RuntimeException('Client bank receipt was not recorded.');
    $q=$pdo->prepare('SELECT client_payment_receipt_path FROM entrepreneur_payouts WHERE order_id=?');$q->execute([$bankOrder['id']]);$clientPath=(string)$q->fetchColumn();
    if(!$clientPath)throw new RuntimeException('Client bank receipt path missing from payout ledger.');
    $receiptFiles[]=$clientPath;

    echo "Dropship payout integration passed: flexible sell price, CAMY cost split, COD collection, bank proof, post-delivery entrepreneur transfer, receipt ledger, return reconciliation, and credit-stage transition.\n";
} finally {
    foreach($receiptFiles as $name){$file=__DIR__.'/../private/receipts/'.basename($name);if(is_file($file))unlink($file);}
    if(isset($server)){$server->exec("DROP DATABASE IF EXISTS `$db`");}
}
