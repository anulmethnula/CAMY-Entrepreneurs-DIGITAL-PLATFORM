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
$db='camy_payout_test_'.bin2hex(random_bytes(5));$receiptFiles=[];
try {
    $server->exec("CREATE DATABASE `$db`");$server->exec("USE `$db`");$server->exec((string)file_get_contents(__DIR__.'/../database/schema.sql'));$pdo=$server;
    $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES
      (1,'CE-PAYOUT','Payout Seller','seller@camy.test','unused','entrepreneur','active'),
      (2,NULL,'CAMY Admin','admin@camy.test','unused','admin','active')");
    $pdo->exec("INSERT INTO entrepreneurs(user_id,member_id,nic,phone,address,city,joined_date,bank_name,bank_branch,account_holder,account_number)
      VALUES(1,'CE-PAYOUT','200012345678','0771234567','10 Test Road','Colombo',CURDATE(),'Test Bank','Colombo','Payout Seller','123456789')");

    $state=[
      'products'=>[['id'=>1,'code'=>'CAMY-TEST','name'=>'CAMY Test Product','category'=>'Test','description'=>'Test','price'=>100.0,'stock'=>12,'image'=>'']],
      'entrepreneurs'=>[['id'=>'CE-PAYOUT','name'=>'Payout Seller','email'=>'seller@camy.test','phone'=>'0771234567','city'=>'Colombo','joined'=>date('Y-m-d'),'active'=>true,'stage'=>'Trial seller','sales'=>0,'credit'=>0,'used'=>0,'bankDetails'=>['bank'=>'Test Bank','branch'=>'Colombo','holder'=>'Payout Seller','account'=>'123456789']]],
      'tiers'=>[['id'=>'tier-1','name'=>'Tier 1','sales'=>200.0,'credit'=>250.0]],
      'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true
    ];
    market_save($pdo,$state);

    $seller=['id'=>1,'role'=>'entrepreneur','member_id'=>'CE-PAYOUT','full_name'=>'Payout Seller'];
    $admin=['id'=>2,'role'=>'admin','member_id'=>null,'full_name'=>'CAMY Admin'];

    // Phase 1: client orders are COD only.
    $GLOBALS['actor']=$seller;
    endpoint($pdo,'/marketplace/dropship-orders','POST',[
      'customer'=>['name'=>'Bank Attempt','phone'=>'0774444444','district'=>'Colombo','address'=>'1 Test Road'],
      'paymentMethod'=>'bank',
      'items'=>[['productId'=>1,'qty'=>1,'sellPrice'=>150]]
    ],422);

    $created=endpoint($pdo,'/marketplace/dropship-orders','POST',[
      'customer'=>['name'=>'Client One','phone'=>'0775555555','district'=>'Colombo','address'=>'20 Client Road','notes'=>'COD test'],
      'paymentMethod'=>'cod',
      'items'=>[['productId'=>1,'qty'=>2,'sellPrice'=>150]]
    ],201)['order'];
    $id=$created['id'];
    if(($created['clientPaymentMethod']??'')!=='cod'||isset($created['receipt'])||isset($created['clientPaymentReference']))throw new RuntimeException('Dropship order is not clean COD-only.');
    if((float)$created['amount']!==300.0||(float)$created['camyCost']!==200.0||(float)$created['entrepreneurMargin']!==100.0)throw new RuntimeException('Dropship price split is incorrect.');
    $ledger=$pdo->prepare('SELECT * FROM entrepreneur_payouts WHERE order_id=?');$ledger->execute([$id]);$row=$ledger->fetch();
    if(!$row||$row['client_payment_method']!=='cod'||(float)$row['payout_amount']!==100.0||$row['payout_status']!=='pending_delivery')throw new RuntimeException('COD payout ledger was not created correctly.');

    $GLOBALS['actor']=$admin;
    endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Dispatched','courier'=>'QA Courier','trackingNumber'=>'QA-123']);
    $delivered=endpoint($pdo,"/marketplace/orders/$id/status",'POST',['status'=>'Delivered']);
    $order=array_values(array_filter($delivered['orders'],fn($item)=>$item['id']===$id))[0];
    if($order['payoutStatus']!=='pending_transfer'||$order['clientPaymentStatus']!=='Collected by CAMY')throw new RuntimeException('Delivered COD order did not enter payout queue.');
    $person=array_values(array_filter($delivered['entrepreneurs'],fn($item)=>$item['id']==='CE-PAYOUT'))[0];
    if((float)$person['sales']!==200.0||(float)$person['credit']!==250.0||$person['stage']!=='Credit eligible')throw new RuntimeException('Trial completion / credit eligibility did not use verified CAMY product value.');

    // Record CAMY -> entrepreneur margin transfer with receipt.
    $receipt='data:application/pdf;base64,'.base64_encode("%PDF-1.4\nCAMY payout test");
    $paid=endpoint($pdo,"/marketplace/orders/$id/payout",'POST',['reference'=>'CAMY-PAYOUT-001','receipt'=>$receipt]);
    if(($paid['order']['payoutStatus']??'')!=='paid')throw new RuntimeException('Entrepreneur payout was not recorded.');
    $ledger->execute([$id]);$row=$ledger->fetch();$receiptFiles[]=(string)$row['payout_receipt_path'];

    // Phase 2: eligible entrepreneur may request credit stock; no payment receipt is required.
    $GLOBALS['actor']=$seller;
    $request=endpoint($pdo,'/marketplace/requests','POST',['creditMode'=>true,'items'=>[['productId'=>1,'qty'=>2]]],201)['request'];
    if(($request['creditMode']??false)!==true||$request['status']!=='Pending'||(float)$request['total']!==200.0)throw new RuntimeException('Credit stock request was not created correctly.');

    // Pending request reserves available credit, so a second request that would overcommit is blocked.
    endpoint($pdo,'/marketplace/requests','POST',['creditMode'=>true,'items'=>[['productId'=>1,'qty'=>1]]],422);

    $GLOBALS['actor']=$admin;
    $approved=endpoint($pdo,"/marketplace/requests/{$request['id']}/approve",'POST')['state'];
    $approvedRequest=array_values(array_filter($approved['requests'],fn($item)=>$item['id']===$request['id']))[0];
    $approvedPerson=array_values(array_filter($approved['entrepreneurs'],fn($item)=>$item['id']==='CE-PAYOUT'))[0];
    if($approvedRequest['status']!=='Approved'||(float)$approvedPerson['used']!==0.0)throw new RuntimeException('Approval should reserve stock without issuing credit yet.');

    $dispatched=endpoint($pdo,"/marketplace/requests/{$request['id']}/dispatch",'POST')['state'];
    $phase2Person=array_values(array_filter($dispatched['entrepreneurs'],fn($item)=>$item['id']==='CE-PAYOUT'))[0];
    $phase2Inventory=array_values(array_filter($dispatched['inventory'],fn($item)=>$item['entrepreneurId']==='CE-PAYOUT'&&(string)$item['productId']==='1'))[0]??null;
    if((float)$phase2Person['used']!==200.0||!$phase2Inventory||(int)$phase2Inventory['qty']!==2)throw new RuntimeException('Phase 2 dispatch did not issue credit and inventory together.');

    // Credit repayment reduces outstanding only after CAMY verifies it.
    $GLOBALS['actor']=$seller;
    $settlement=endpoint($pdo,'/marketplace/credit/settlements','POST',['amount'=>100,'reference'=>'SETTLE-100'],201)['settlement'];
    $GLOBALS['actor']=$admin;
    $settled=endpoint($pdo,"/marketplace/credit/settlements/{$settlement['id']}/verify",'POST')['state'];
    $settledPerson=array_values(array_filter($settled['entrepreneurs'],fn($item)=>$item['id']==='CE-PAYOUT'))[0];
    if((float)$settledPerson['used']!==100.0)throw new RuntimeException('Verified credit settlement did not reduce outstanding.');

    // Phase 2 never disables dropshipping: the same entrepreneur can still place COD orders.
    $GLOBALS['actor']=$seller;
    $secondDropship=endpoint($pdo,'/marketplace/dropship-orders','POST',[
      'customer'=>['name'=>'Client Two','phone'=>'0776666666','district'=>'Gampaha','address'=>'30 Client Road'],
      'paymentMethod'=>'cod',
      'items'=>[['productId'=>1,'qty'=>1,'sellPrice'=>175]]
    ],201)['order'];
    if(($secondDropship['orderMode']??'')!=='dropship'||($secondDropship['clientPaymentMethod']??'')!=='cod')throw new RuntimeException('Credit-eligible entrepreneur could not continue dropshipping.');

    // Admin-managed return/refund: customer portal is retired, so CAMY records the
    // client's return request and controls the entire return lifecycle.
    $GLOBALS['actor']=$admin;
    endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/status",'POST',['status'=>'Dispatched','courier'=>'QA Courier','trackingNumber'=>'QA-RETURN-1']);
    endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/status",'POST',['status'=>'Delivered']);
    endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/return/request",'POST',['reason'=>'Client requested a return after delivery.']);
    endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/return/approve",'POST',['instructions'=>'Send the complete parcel back to CAMY warehouse.']);
    endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/return/ship",'POST',['courier'=>'QA Return Courier','trackingNumber'=>'RET-1001']);
    $received=endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/return/receive",'POST')['order'];
    if(($received['status']??'')!=='Returned'||($received['payoutStatus']??'')!=='cancelled'||($received['return']['refundStatus']??'')!=='Pending')throw new RuntimeException('Admin return receipt did not restore the active COD return state.');
    $refunded=endpoint($pdo,"/marketplace/orders/{$secondDropship['id']}/return/refund",'POST',['reference'=>'CLIENT-REFUND-001'])['order'];
    if(($refunded['return']['refundStatus']??'')!=='Refunded'||($refunded['return']['refundReference']??'')!=='CLIENT-REFUND-001')throw new RuntimeException('Client refund record was not completed.');

    echo "CAMY flow integration passed: registration-ready database, COD-only client orders, admin fulfilment, entrepreneur margin payout, trial-to-credit transition, optional Phase 2 credit stock, credit-limit protection, issued inventory, settlement verification, continued dropshipping, and admin-managed returns/refunds.\n";
} finally {
    foreach($receiptFiles as $name){$file=__DIR__.'/../private/receipts/'.basename($name);if(is_file($file))unlink($file);}
    if(isset($server))$server->exec("DROP DATABASE IF EXISTS `$db`");
}
