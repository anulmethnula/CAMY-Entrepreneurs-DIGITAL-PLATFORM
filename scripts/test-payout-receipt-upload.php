<?php
declare(strict_types=1);

$fixtureRoot=__DIR__.'/../.artifacts/payout-receipt-test-'.bin2hex(random_bytes(5));mkdir($fixtureRoot,0700,true);putenv('CAMY_PRIVATE_PATH='.$fixtureRoot);
require __DIR__.'/../api/config.php';
require __DIR__.'/../api/security.php';

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

function ensure(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
function receiptCall(PDO $pdo,string $path,array $payload=[],int $expected=200): array {
    $_SERVER['REQUEST_URI']='/api'.$path;$_SERVER['CONTENT_TYPE']='application/json';$_SERVER['HTTP_X_CAMY_REQUEST']='1';$_SERVER['CONTENT_LENGTH']=strlen(json_encode($payload));
    security_request('POST');return endpoint($pdo,$path,'POST',$payload,$expected);
}
$server=new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db='camy_receipt_test_'.bin2hex(random_bytes(5));
try{
    $server->exec("CREATE DATABASE `$db`");$server->exec("USE `$db`");$server->exec(file_get_contents(__DIR__.'/../database/schema.sql'));$pdo=$server;
    $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES(1,'QA-RECEIPT','Seller','seller@qa.invalid','unused','entrepreneur','active'),(2,NULL,'Admin','admin@qa.invalid','unused','admin','active')");
    $state=['products'=>[['id'=>1,'code'=>'QA','name'=>'QA product','price'=>100,'stock'=>20]],'entrepreneurs'=>[['id'=>'QA-RECEIPT','name'=>'Seller','sales'=>0,'credit'=>0,'used'=>0,'bankDetails'=>['bank'=>'Bank','branch'=>'Branch','holder'=>'Holder','account'=>'000123']]],'tiers'=>[],'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true];
    market_save($pdo,$state);
    $admin=['id'=>2,'role'=>'admin','full_name'=>'Admin'];$GLOBALS['actor']=$admin;
    $jpeg=file_get_contents(__DIR__.'/../public/products/mini-fridge.jpeg');$png=file_get_contents(__DIR__.'/../public/products/ac-12000.png');
    $webp=base64_decode('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA');
    ensure((getimagesizefromstring($webp)['mime'] ?? '')==='image/webp','WebP fixture invalid');
    $formats=[['Small receipt.jpg','image/jpeg',$jpeg],['WhatsApp Image 2026-10-27 at 2.47.08 PM (1).jpeg','image/jpeg',$jpeg.str_repeat("\0",12*1024*1024)],['receipt.png','image/png',$png],['receipt.webp','image/webp',$webp],['receipt [October].pdf','application/pdf',"%PDF-1.4\n".str_repeat('receipt ',900000)]];
    if(function_exists('imagecreatetruecolor')){$image=imagecreatetruecolor(6000,4000);ob_start();imagejpeg($image,null,95);$photo=ob_get_clean();imagedestroy($image);$formats[]=['High resolution phone photo.jpeg','image/jpeg',$photo];}
    foreach($formats as $i=>[$name,$mime,$bytes]){
        $id='CMY-'.(2000+$i);$state=market_state($pdo);$state['orders'][]=['id'=>$id,'entrepreneurId'=>'QA-RECEIPT','entrepreneur'=>'Seller','customer'=>'QA customer','amount'=>300,'camyCost'=>200,'entrepreneurMargin'=>100,'qty'=>2,'items'=>[['id'=>1,'name'=>'QA product','qty'=>2,'price'=>150,'camyPrice'=>100]],'orderMode'=>'dropship','status'=>'Delivered','date'=>date('Y-m-d'),'deliveredAt'=>date(DATE_ATOM)];market_save($pdo,$state);market_state($pdo);
        $base='/marketplace/orders/'.$id.'/payout-upload';$upload=receiptCall($pdo,$base,['name'=>$name,'mime'=>$mime,'size'=>strlen($bytes)]);$token=$upload['uploadId'];$path=$base.'/'.$token;
        $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'["payouts"]'];receiptCall($pdo,$path,['action'=>'status'],403);$GLOBALS['actor']=$admin;
        receiptCall($pdo,$path,['action'=>'finish'],409);
        $chunkSize=256*1024;
        for($offset=0;$offset<strlen($bytes);$offset+=$chunkSize){$chunk=substr($bytes,$offset,$chunkSize);$payload=['action'=>'chunk','offset'=>$offset,'bytes'=>base64_encode($chunk)];$part=receiptCall($pdo,$path,$payload);if($offset===0){$retried=receiptCall($pdo,$path,$payload);ensure($retried['offset']===$part['offset'],'Chunk retry duplicated bytes');}ensure($part['offset']===min(strlen($bytes),$offset+$chunkSize),'Wrong upload offset');}
        if($i===2){rename($fixtureRoot.'/receipts',$fixtureRoot.'/saved-receipts');file_put_contents($fixtureRoot.'/receipts','storage unavailable');receiptCall($pdo,$path,['action'=>'finish'],503);unlink($fixtureRoot.'/receipts');rename($fixtureRoot.'/saved-receipts',$fixtureRoot.'/receipts');}
        $finished=receiptCall($pdo,$path,['action'=>'finish']);ensure($finished['ready'],'Upload not finalized');
        $meta=json_decode(file_get_contents($fixtureRoot.'/payout-uploads/'.$token.'.json'),true);$stored=$fixtureRoot.'/receipts/'.$meta['receipt'];ensure(hash_file('sha256',$stored)===hash('sha256',$bytes),'Stored receipt bytes changed');ensure(strlen($meta['receipt'])<255,'Stored path exceeds ledger field');
        ensure($pdo->query("SELECT payout_status FROM entrepreneur_payouts WHERE order_id='$id'")->fetchColumn()==='pending_transfer','Upload prematurely paid commission');
        if($i===0){$pdo->exec("CREATE TRIGGER qa_receipt_fail BEFORE UPDATE ON entrepreneur_payouts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA forced save failure'");$failed=receiptCall($pdo,'/marketplace/orders/'.$id.'/payout',['reference'=>'TXN-001','receiptUpload'=>$token],500);ensure(str_contains($failed['message'],'receipt was uploaded'),'Payment failure not explained');ensure($pdo->query("SELECT payout_status FROM entrepreneur_payouts WHERE order_id='$id'")->fetchColumn()==='pending_transfer','Failed save changed paid status');ensure(is_file($stored),'Retry receipt lost');$pdo->exec('DROP TRIGGER qa_receipt_fail');}
        $paid=receiptCall($pdo,'/marketplace/orders/'.$id.'/payout',['reference'=>'TXN-001','receiptUpload'=>$token]);ensure($paid['order']['payoutStatus']==='paid','Payment not saved');ensure((float)$paid['order']['payoutAmount']===100.0,'Payout calculation changed');ensure($paid['order']['payoutReference']==='TXN-001','Reference changed');ensure($paid['order']['payoutReceipt']==='/api/marketplace/orders/'.$id.'/payout-receipt','Receipt not linked');
        receiptCall($pdo,'/marketplace/orders/'.$id.'/payout',['reference'=>'TXN-001','receiptUpload'=>$token],409);
        $row=$pdo->query("SELECT payout_receipt_path,payout_amount FROM entrepreneur_payouts WHERE order_id='$id'")->fetch();ensure($row['payout_receipt_path']===$meta['receipt']&&(float)$row['payout_amount']===100.0,'Ledger mismatch');ensure((int)$pdo->query("SELECT COUNT(*) FROM entrepreneur_payouts WHERE order_id='$id'")->fetchColumn()===1,'Duplicate payout created');
        echo 'PASS: '.$name.' ('.strlen($bytes).' bytes), stored proof, linked payment and duplicate protection.'.PHP_EOL;
    }
    echo "PASS: chunk middleware, resumable retries, private upload ownership, storage failure, atomic payment rollback/retry, original receipt bytes and unchanged commission amounts.\n";
}finally{
    if(preg_match('/^camy_receipt_test_[a-f0-9]{10}$/',$db))$server->exec("DROP DATABASE IF EXISTS `$db`");
    $resolved=realpath($fixtureRoot);$allowed=realpath(__DIR__.'/../.artifacts').DIRECTORY_SEPARATOR;
    if($resolved&&str_starts_with($resolved,$allowed)){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST) as $entry){$entry->isDir()?rmdir($entry->getPathname()):unlink($entry->getPathname());}rmdir($resolved);}
}
