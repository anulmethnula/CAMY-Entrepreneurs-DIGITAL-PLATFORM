<?php
declare(strict_types=1);

$testStorage=__DIR__.'/../.artifacts/invoice-store-'.bin2hex(random_bytes(6));
mkdir($testStorage,0700,true);putenv('CAMY_PRIVATE_PATH='.$testStorage);
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
function notification_send_email(string $to,string $subject,string $html,?string $attachment=null): bool { $GLOBALS['mailDocument']=file_get_contents($attachment);return $GLOBALS['mailAccepted'] ?? true; }
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
$db='camy_invoice_test_'.bin2hex(random_bytes(5));
function ensure(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
try {
 $server->exec("CREATE DATABASE `$db`");$server->exec("USE `$db`");$server->exec(file_get_contents(__DIR__.'/../database/schema.sql'));$pdo=$server;
 $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES(1,'E1','Test','e@test.invalid','unused','entrepreneur','active')");
 $state=['products'=>[['id'=>1,'code'=>'P1','name'=>'Product','category'=>'Test','price'=>100,'stock'=>8]],'entrepreneurs'=>[['id'=>'E1','name'=>'Test','sales'=>0,'credit'=>0,'used'=>0,'bankDetails'=>['bank'=>'Bank','account'=>'0000123']]],'tiers'=>[],'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true];market_save($pdo,$state);

 $GLOBALS['actor']=['id'=>1,'member_id'=>'E1','role'=>'entrepreneur','full_name'=>'Test'];
 $created=endpoint($pdo,'/marketplace/dropship-orders','POST',['customer'=>['name'=>'Test buyer','phone'=>'0771234567','phone2'=>'0712345678','district'=>'Colombo','address'=>'Test address'],'items'=>[['productId'=>1,'qty'=>1,'sellPrice'=>150]]],201)['order'];$id=$created['id'];$route="/marketplace/orders/$id/invoice";
 endpoint($pdo,$route,'POST',['invoiceNumber'=>'NO'],403);
 $GLOBALS['actor']=['id'=>2,'role'=>'admin','full_name'=>'Admin'];
 $original=market_state($pdo)['orders'][0];
 $pdf='data:application/pdf;base64,'.base64_encode("%PDF-1.4\ninvoice fixture");
 $first=endpoint($pdo,$route,'POST',['invoiceNumber'=>'INV-1','invoice'=>$pdf])['order'];
 $old=market_state($pdo)['orders'][0]['invoicePath'];
 ensure(is_file(private_path('receipts/'.$old)),'Initial attachment missing');
 endpoint($pdo,$route,'POST',['invoiceNumber'=>'','invoice'=>$pdf],422);
 endpoint($pdo,$route,'POST',['invoiceNumber'=>'BAD','invoice'=>'data:image/png;base64,'.base64_encode('bad image')],422);
 ensure(market_state($pdo)['orders'][0]['invoiceNumber']==='INV-1'&&is_file(private_path('receipts/'.$old)),'Failed validation damaged original');
 $pdo->exec("CREATE TRIGGER invoice_failure BEFORE UPDATE ON shop_orders FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Simulated invoice save failure'");
 $filesBefore=glob(private_path('receipts/'.$id.'-invoice-*'));
 try{endpoint($pdo,$route,'POST',['invoiceNumber'=>'FAIL','invoice'=>$pdf]);throw new RuntimeException('Save failure not triggered');}catch(PDOException $expected){}
 $pdo->exec('DROP TRIGGER invoice_failure');
 ensure(market_state($pdo)['orders'][0]['invoiceNumber']==='INV-1'&&is_file(private_path('receipts/'.$old)),'Save failure damaged original');
 ensure(count(glob(private_path('receipts/'.$id.'-invoice-*')))===count($filesBefore),'Failed save left replacement file');
 $second=endpoint($pdo,$route,'POST',['invoiceNumber'=>'INV-2','invoice'=>$pdf,'expectedInvoiceVersion'=>$first['invoiceVersion']]);
 ensure($second['message']==='Invoice updated successfully.','Wrong success message');
 $new=market_state($pdo)['orders'][0];ensure(!is_file(private_path('receipts/'.$old))&&is_file(private_path('receipts/'.$new['invoicePath'])),'Replacement cleanup failed');
 ensure($new['invoiceHistory'][0]['reference']==='INV-1'&&$new['invoiceHistory'][0]['changedBy']===2,'Audit missing');
 foreach($original as $key=>$value)if(!str_starts_with($key,'invoice'))ensure(($new[$key]??null)===$value,'Unrelated order field changed: '.$key);
 endpoint($pdo,$route,'POST',['invoiceNumber'=>'STALE','expectedInvoiceVersion'=>$first['invoiceVersion']],409);
 $third=endpoint($pdo,$route,'POST',['invoiceNumber'=>'INV-3','expectedInvoiceVersion'=>$new['invoiceVersion']])['order'];
 ensure(market_state($pdo)['orders'][0]['invoicePath']===$new['invoicePath'],'Reference-only edit changed document');
 endpoint($pdo,$route.'/notify','POST',['email'=>'invalid'],422);
 $sent=endpoint($pdo,$route.'/notify','POST',['email'=>'buyer@example.invalid'])['order'];
 ensure($sent['invoiceNotifications'][0]['status']==='accepted_by_mail_server'&&str_starts_with($GLOBALS['mailDocument'],'%PDF-'),'Email did not use current attachment');
 $GLOBALS['mailAccepted']=false;$failed=endpoint($pdo,$route.'/notify','POST',['email'=>'buyer@example.invalid']);
 ensure(str_contains($failed['message'],'did not accept')&&is_file(private_path('receipts/'.$new['invoicePath'])),'Notification failure damaged invoice');
 $GLOBALS['actor']=['id'=>1,'member_id'=>'E1','role'=>'entrepreneur'];endpoint($pdo,$route.'/notify','POST',['email'=>'buyer@example.invalid'],403);
 echo "PASS: authorization, reference editing, replacement, original preservation on validation and DB failure, orphan cleanup, audit, stale edits, order/finance invariance, current-document notification and failed email preservation. No email sent.\n";
}finally{
 if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();
 if(isset($id))foreach(glob(private_path('receipts/'.$id.'-invoice-*')) as $file)unlink($file);
 if(is_dir(private_path('receipts')))rmdir(private_path('receipts'));rmdir($testStorage);
 $server->exec("DROP DATABASE IF EXISTS `$db`");
}
