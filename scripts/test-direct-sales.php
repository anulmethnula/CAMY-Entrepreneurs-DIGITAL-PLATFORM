<?php
declare(strict_types=1);
$worker=($argv[1] ?? '')==='--worker';
$testStorage=$worker?$argv[3]:__DIR__.'/../.artifacts/direct-sale-test-'.bin2hex(random_bytes(6));
if(!$worker)mkdir($testStorage,0700,true);putenv('CAMY_PRIVATE_PATH='.$testStorage);
require __DIR__.'/../api/config.php';
final class ApiResult extends RuntimeException {public function __construct(public array $data,public int $status){parent::__construct('API response');}}
function response(array $data,int $status=200): never {throw new ApiResult($data,$status);}
function input(): array {return $GLOBALS['payload'] ?? [];}
function current_user(PDO $pdo): ?array {return $GLOBALS['actor'] ?? null;}
function require_admin(PDO $pdo): array {$u=current_user($pdo);if(!$u||!in_array($u['role'],['admin','manager'],true))response(['message'=>'Forbidden'],403);return $u;}
require __DIR__.'/../api/marketplace.php';
function connect_test(?string $db=null): PDO {return new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.($db?';dbname='.$db:'').';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function endpoint(PDO $pdo,string $path,string $method='GET',array $payload=[],int $expected=200): array {
 $GLOBALS['payload']=$payload;
 try {market_route($pdo,$path,$method);throw new RuntimeException('No response');}
 catch(ApiResult $r){if($pdo->inTransaction())$pdo->rollBack();if($expected!==-1&&$r->status!==$expected)throw new RuntimeException("$method $path expected $expected got {$r->status}: ".json_encode($r->data));return ['http'=>$r->status]+$r->data;}
}
function ensure(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$GLOBALS['actor']=['id'=>2,'role'=>'admin','full_name'=>'Finance Test'];
if($worker){$pdo=connect_test($argv[2]);echo json_encode(endpoint($pdo,'/admin/direct-sales','POST',json_decode(file_get_contents($argv[4]),true),-1));exit;}
$server=connect_test();$db='camy_direct_test_'.bin2hex(random_bytes(5));
function action(PDO $pdo,array $sale,string $name,array $data=[],int $status=200): array {$r=endpoint($pdo,'/admin/direct-sales/'.$sale['id'].'/'.$name,'POST',['version'=>$sale['version']]+$data,$status);return $r['sale'] ?? $sale;}
function sale_payload(array $changes=[]): array {return array_replace_recursive(['idempotencyKey'=>bin2hex(random_bytes(16)),'customerType'=>'other','buyer'=>['name'=>'Walk-in Test','phone'=>'0771234567'],'fulfilmentMethod'=>'collection','items'=>[['productId'=>1,'qty'=>1,'pricingMethod'=>'billing','includeDelivery'=>false,'includePackaging'=>false]],'payment'=>['method'=>'cash','amount'=>0,'date'=>'2026-11-10']],$changes);}
function stock(PDO $pdo,int $id): int {foreach(market_state($pdo)['products'] as $p)if((int)$p['id']===$id)return (int)$p['stock'];throw new RuntimeException('Missing stock');}
try {
 $server->exec("CREATE DATABASE `$db`");$pdo=connect_test($db);$pdo->exec(file_get_contents(__DIR__.'/../database/schema.sql'));
 $pdo->exec("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES(1,'E1','Registered Buyer','buyer@test.invalid','unused','entrepreneur','active'),(2,NULL,'Finance Test','admin@test.invalid','unused','admin','active')");
 $pdo->exec("INSERT INTO entrepreneurs(user_id,member_id,nic,phone,address,city,joined_date) VALUES(1,'E1','TEST-NIC','0771234567','Test address','Colombo',CURDATE())");
 $products=[['id'=>1,'code'=>'P1','name'=>'4 Pcs Set','category'=>'Cookware','billingPrice'=>2590,'deliveryCost'=>550,'packagingCost'=>150,'freeDelivery'=>true,'price'=>3290,'stock'=>20],['id'=>2,'code'=>'P2','name'=>'Small Product','category'=>'Test','billingPrice'=>100,'deliveryCost'=>50,'packagingCost'=>20,'freeDelivery'=>true,'price'=>170,'stock'=>15],['id'=>3,'code'=>'P3','name'=>'Separate delivery','category'=>'Test','billingPrice'=>200,'deliveryCost'=>40,'packagingCost'=>10,'freeDelivery'=>false,'price'=>210,'stock'=>10],['id'=>4,'code'=>'P4','name'=>'Fourth product','category'=>'Test','billingPrice'=>300,'deliveryCost'=>0,'packagingCost'=>0,'freeDelivery'=>true,'price'=>300,'stock'=>10],['id'=>5,'code'=>'P5','name'=>'Last unit','category'=>'Test','billingPrice'=>100,'deliveryCost'=>0,'packagingCost'=>0,'freeDelivery'=>true,'price'=>100,'stock'=>1]];
 $state=['products'=>$products,'entrepreneurs'=>[['id'=>'E1','name'=>'Registered Buyer','sales'=>0,'credit'=>0,'used'=>0]],'tiers'=>[],'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true];market_save($pdo,$state);
 $baseline=market_state($pdo);$pdf='data:application/pdf;base64,'.base64_encode("%PDF-1.4\nDirect sale test proof");
 $GLOBALS['actor']=null;endpoint($pdo,'/admin/direct-sales','GET',[],401);
 $GLOBALS['actor']=['id'=>1,'role'=>'entrepreneur','member_id'=>'E1'];endpoint($pdo,'/admin/direct-sales','POST',sale_payload(),403);
 $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'[]'];endpoint($pdo,'/admin/direct-sales','GET',[],403);
 $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'["direct-sales"]'];
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['pricingMethod'=>'custom','customPrice'=>2000,'priceReason'=>'Negotiated']]]),403);
 $GLOBALS['actor']=['id'=>2,'role'=>'admin','full_name'=>'Finance Test'];
 $payload=sale_payload(['customerType'=>'entrepreneur','entrepreneurId'=>'E1','reserve'=>true,'items'=>[['productId'=>1,'qty'=>2,'pricingMethod'=>'discount','baseMode'=>'billing','discountType'=>'fixed','discountValue'=>190,'includeDelivery'=>false,'includePackaging'=>false,'priceReason'=>'Entrepreneur offer'],['productId'=>2,'qty'=>1,'pricingMethod'=>'catalogue','includeDelivery'=>false,'includePackaging'=>true]],'payment'=>['method'=>'cash','amount'=>5000,'confirmed'=>true,'date'=>'2026-11-10']]);
 $cash=endpoint($pdo,'/admin/direct-sales','POST',$payload,201)['sale'];ensure($cash['total']===4920.0&&$cash['amountReceived']===4920.0&&$cash['payments'][0]['change']===80.0,'Cash pricing or change incorrect');
 ensure(stock($pdo,1)===18&&stock($pdo,2)===14,'Reservation not applied');
 $duplicate=endpoint($pdo,'/admin/direct-sales','POST',$payload)['sale'];ensure($duplicate['id']===$cash['id']&&stock($pdo,1)===18,'Duplicate sale or reservation created');
 $cash=action($pdo,$cash,'fulfilment',['status'=>'Handed Over','date'=>'2026-11-10','collectedBy'=>'Registered Buyer']);ensure(stock($pdo,1)===18,'Handover deducted reserved stock twice');
 action($pdo,$cash,'fulfilment',['status'=>'Handed Over','date'=>'2026-11-10','collectedBy'=>'Buyer'],409);
 $cash=action($pdo,$cash,'fulfilment',['status'=>'Completed']);ensure(stock($pdo,1)===18,'Completion deducted stock twice');
 ensure((int)$pdo->query("SELECT quantity FROM direct_purchase_inventory WHERE entrepreneur_member_id='E1' AND product_code='P1'")->fetchColumn()===2,'Purchased ownership missing');
 $bank=endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['customerType'=>'entrepreneur','entrepreneurId'=>'E1','items'=>[['productId'=>3,'qty'=>1,'pricingMethod'=>'custom','customPrice'=>220,'priceReason'=>'Special price','includeDelivery'=>false,'includePackaging'=>false]],'fulfilmentMethod'=>'delivery','payment'=>['method'=>'bank','amount'=>220,'reference'=>'TXN-001','date'=>'2026-11-10','receipt'=>$pdf]]),201)['sale'];
 ensure($bank['paymentStatus']==='Verification Pending'&&$bank['amountReceived']===0.0&&stock($pdo,3)===10,'Proof was treated as paid or stock released');
 action($pdo,$bank,'fulfilment',['status'=>'Dispatched','courier'=>'Courier','trackingNumber'=>'000123','date'=>'2026-11-10'],409);
 $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'["direct-sales"]'];action($pdo,$bank,'verify',['paymentId'=>$bank['payments'][0]['id'],'decision'=>'Verified','confirmed'=>true],403);
 $safe=endpoint($pdo,'/admin/direct-sales/'.$bank['id'])['sale'];ensure(!isset($safe['payments'][0]['receipts'])&&!str_contains(json_encode($safe),'storage_name'),'Private proof leaked to sales-only staff');
 $GLOBALS['actor']=['id'=>2,'role'=>'admin','full_name'=>'Finance Test'];
 $bank=action($pdo,$bank,'verify',['paymentId'=>$bank['payments'][0]['id'],'decision'=>'Verified','confirmed'=>true]);ensure($bank['paymentStatus']==='Paid','Bank verification failed');
 $bank=action($pdo,$bank,'fulfilment',['status'=>'Dispatched','courier'=>'Courier','trackingNumber'=>'000123','date'=>'2026-11-10']);ensure(stock($pdo,3)===9&&$bank['shipment']['trackingNumber']==='000123','Dispatch stock or leading-zero tracking lost');
 $oldProof=$bank['payments'][0]['receipts'][0]['id'];
 $bank=action($pdo,$bank,'receipt',['paymentId'=>$bank['payments'][0]['id'],'receipt'=>$pdf,'reason'=>'Corrected proof']);ensure(count($bank['payments'][0]['receipts'])===2&&$bank['amountReceived']===220.0,'Correction lost history or confirmed funds');
 $q=$pdo->prepare('SELECT storage_name FROM direct_sale_receipts WHERE sale_id=?');$q->execute([$bank['id']]);foreach($q as $r)ensure(is_file(private_path('receipts/'.$r['storage_name'])),'Permanent proof missing');
 $reload=endpoint($pdo,'/admin/direct-sales/'.$bank['id'])['sale'];ensure(count($reload['payments'][0]['receipts'])===2,'Receipt history lost after reload');
 $partial=endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['payment'=>['method'=>'cash','amount'=>1000,'confirmed'=>true,'date'=>'2026-11-10']]),201)['sale'];ensure($partial['paymentStatus']==='Partially Paid'&&$partial['balance']===1590.0,'Partial cash wrongly fully paid');
 action($pdo,$partial,'fulfilment',['status'=>'Handed Over','date'=>'2026-11-10','collectedBy'=>'Buyer'],409);
 $partial=action($pdo,$partial,'payments',['method'=>'cash','amount'=>1590,'date'=>'2026-11-10','confirmed'=>true]);ensure($partial['paymentStatus']==='Paid','Second cash payment failed');
 $partial=action($pdo,$partial,'fulfilment',['status'=>'Handed Over','date'=>'2026-11-10','collectedBy'=>'Walk-in Buyer']);ensure(!$partial['entrepreneurId'],'Walk-in got a fake member');
 $reserve=endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['reserve'=>true]),201)['sale'];$before=stock($pdo,1);$reserve=action($pdo,$reserve,'cancel',['reason'=>'Buyer cancelled']);ensure(stock($pdo,1)===$before+1,'Cancellation did not release reservation');action($pdo,$reserve,'cancel',[],409);
 $cash=action($pdo,$cash,'return',['reason'=>'All goods physically returned','physicalReturnConfirmed'=>true]);ensure(stock($pdo,1)===$before+3&&stock($pdo,2)===15,'Physical return did not restore exact stock');action($pdo,$cash,'return',['physicalReturnConfirmed'=>true,'reason'=>'Duplicate'],409);
 $cash=action($pdo,$cash,'refund',['amount'=>4920,'method'=>'cash','date'=>'2026-11-10','reason'=>'Returned goods refund','confirmed'=>true]);ensure($cash['paymentStatus']==='Refunded'&&$cash['netReceived']===0.0,'Refund ledger incorrect');
 $draft=endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['draft'=>true]),201)['sale'];$draft=action($pdo,$draft,'prices',['items'=>[['productId'=>2,'qty'=>2,'pricingMethod'=>'billing','includePackaging'=>false]]]);ensure($draft['total']===200.0,'Draft repricing incorrect');$draft=action($pdo,$draft,'confirm',['reserve'=>true]);ensure($draft['businessStatus']==='Confirmed','Draft not confirmed');
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['qty'=>0]]]),422);
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['qty'=>999]]]),409);
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['pricingMethod'=>'discount','discountType'=>'percent','discountValue'=>101,'priceReason'=>'Invalid']]]),422);
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['pricingMethod'=>'custom','customPrice'=>-1,'priceReason'=>'Invalid']]]),422);
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['payment'=>['method'=>'cash','amount'=>2590,'confirmed'=>false]]),422);
 $rowsBefore=(int)$pdo->query('SELECT COUNT(*) FROM direct_sales')->fetchColumn();
 endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['payment'=>['method'=>'bank','amount'=>100,'reference'=>'BAD','receipt'=>'data:image/png;base64,YmFk']]),422);ensure((int)$pdo->query('SELECT COUNT(*) FROM direct_sales')->fetchColumn()===$rowsBefore,'Failed upload persisted sale');
 putenv('CAMY_DIRECT_MAX_DISCOUNT_PERCENT=10');endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['pricingMethod'=>'custom','customPrice'=>100,'priceReason'=>'Below threshold']]]),403);putenv('CAMY_DIRECT_MAX_DISCOUNT_PERCENT');
 // Trigger a DB failure after receipt storage; the entire sale and uploaded file must roll back.
 $pdo->exec("CREATE TRIGGER fail_direct_sale BEFORE UPDATE ON direct_sales FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Forced save failure'");$filesBefore=count(glob(private_path('receipts/*')));
 try{endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['payment'=>['method'=>'bank','amount'=>100,'reference'=>'DBFAIL','receipt'=>$pdf]]),201);throw new RuntimeException('DB failure not triggered');}catch(PDOException $expected){}
 $pdo->exec('DROP TRIGGER fail_direct_sale');ensure(count(glob(private_path('receipts/*')))===$filesBefore,'Failed save left an orphan file');
 // Mixed pricing across four products, with independent stock deductions.
 $multiItems=[['productId'=>1,'qty'=>1,'pricingMethod'=>'billing','discountType'=>'fixed','discountValue'=>90,'priceReason'=>'Bulk offer','includeDelivery'=>false,'includePackaging'=>false],['productId'=>2,'qty'=>2,'pricingMethod'=>'catalogue','includeDelivery'=>true,'includePackaging'=>true],['productId'=>3,'qty'=>1,'pricingMethod'=>'discount','baseMode'=>'billing','discountType'=>'percent','discountValue'=>10,'priceReason'=>'Seasonal offer','includeDelivery'=>true,'includePackaging'=>false],['productId'=>4,'qty'=>3,'pricingMethod'=>'custom','customPrice'=>275,'priceReason'=>'Agreed price','includeDelivery'=>false,'includePackaging'=>false]];
 $multi=endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>$multiItems,'payment'=>['method'=>'cash','amount'=>4000,'confirmed'=>true]]),201)['sale'];ensure($multi['total']===3881.0&&$multi['qty']===7,'Four-product pricing incorrect');
 $beforeStocks=[];foreach($multi['items'] as $i)$beforeStocks[$i['productId']]=stock($pdo,(int)$i['productId']);$multi=action($pdo,$multi,'fulfilment',['status'=>'Handed Over','collectedBy'=>'Four-product buyer','date'=>'2026-11-10']);foreach($multi['items'] as $i)ensure(stock($pdo,(int)$i['productId'])===$beforeStocks[$i['productId']]-$i['qty'],'Multi-product stock did not deduct exactly once');
 try{ds_catalogue_guard($pdo,array_values(array_filter(market_state($pdo)['products'],fn($p)=>(int)$p['id']!==1)));throw new RuntimeException('Product removal was allowed');}catch(DirectSaleFailure $e){ensure($e->status===409,'Wrong product relationship guard');}
 $GLOBALS['actor']=['id'=>3,'role'=>'manager','permissions_json'=>'["entrepreneurs"]'];$_GET=['entrepreneurId'=>'E1'];$profile=endpoint($pdo,'/admin/direct-sales');ensure(!$profile['access']['create']&&!$profile['access']['finance']&&count($profile['sales'])===2,'Profile-only access is incorrect');$_GET=[];endpoint($pdo,'/admin/direct-sales/'.$partial['id'],'GET',[],403);
 $GLOBALS['actor']=['id'=>2,'role'=>'admin','full_name'=>'Finance Test'];
 $financeSale=endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['items'=>[['productId'=>4,'qty'=>1,'pricingMethod'=>'billing']],'payment'=>['method'=>'bank','amount'=>300,'reference'=>'FIN-ONLY','receipt'=>$pdf]]),201)['sale'];
 $GLOBALS['actor']=['id'=>4,'role'=>'manager','permissions_json'=>'["direct-sales-finance"]'];$financeView=endpoint($pdo,'/admin/direct-sales');ensure(!$financeView['access']['create']&&$financeView['access']['finance'],'Finance-only access expanded creation rights');$financeSale=action($pdo,$financeSale,'verify',['paymentId'=>$financeSale['payments'][0]['id'],'decision'=>'Verified','confirmed'=>true]);ensure($financeSale['paymentStatus']==='Paid','Finance-only verifier denied');endpoint($pdo,'/admin/direct-sales','POST',sale_payload(),403);
 $GLOBALS['actor']=['id'=>2,'role'=>'admin','full_name'=>'Finance Test'];
 putenv('CAMY_DIRECT_RECEIPT_MAX_MB=1');endpoint($pdo,'/admin/direct-sales','POST',sale_payload(['payment'=>['method'=>'bank','amount'=>100,'reference'=>'OVERSIZED','receipt'=>'data:application/pdf;base64,'.base64_encode('%PDF-'.str_repeat('x',1024*1024))]]),413);putenv('CAMY_DIRECT_RECEIPT_MAX_MB');
 // Two separate processes compete for the same last warehouse unit.
 $race=sale_payload(['reserve'=>true,'items'=>[['productId'=>5,'qty'=>1,'pricingMethod'=>'billing','includeDelivery'=>false,'includePackaging'=>false]]]);
 $workers=[];foreach([1,2] as $i){$payload=$race;$payload['idempotencyKey']=bin2hex(random_bytes(16));$file=$testStorage.'/race-'.$i.'.json';file_put_contents($file,json_encode($payload));$pipes=[];$proc=proc_open([PHP_BINARY,__FILE__,'--worker',$db,$testStorage,$file],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);fclose($pipes[0]);$workers[]=[$proc,$pipes];}
 $codes=[];foreach($workers as [$proc,$pipes]){$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);proc_close($proc);$result=json_decode($out,true);ensure(is_array($result),'Race worker failed: '.$err.$out);$codes[]=$result['http'];}sort($codes);ensure($codes===[201,409]&&stock($pdo,5)===0,'Concurrent sales oversold warehouse stock');
 $after=market_state($pdo);ensure($after['entrepreneurs']===$baseline['entrepreneurs']&&$after['inventory']===$baseline['inventory']&&$after['orders']===$baseline['orders']&&$after['requests']===$baseline['requests']&&$after['settlements']===$baseline['settlements'],'COD, credit, commission or entrepreneur financial records changed');
 foreach($products as $original)foreach($after['products'] as $p)if($p['id']===$original['id'])foreach(['price','billingPrice','deliveryCost','packagingCost'] as $key)ensure((float)$p[$key]===(float)$original[$key],'Catalogue price was modified');
 ensure((int)$pdo->query('SELECT COUNT(*) FROM entrepreneur_payouts')->fetchColumn()===0,'Direct sale created a commission');
 $report=endpoint($pdo,'/admin/reports/data');ensure(count($report['directSales'])>0&&count($report['directStockMovements'])>0,'Direct reports missing');
 echo "PASS: cash / bank / walk-in / partial payments, price snapshots, discounts, approvals, secure receipt versions, reload persistence, failed-upload and DB rollback, draft repricing, reservations, handover exactly once, cancellation, physical returns, refunds, concurrent last-unit sales, profile ownership, reports and unchanged COD/credit/commission/catalogue pricing.\n";
} finally {
 if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();
 $server->exec("DROP DATABASE IF EXISTS `$db`");
 foreach(glob($testStorage.'/receipts/*') ?: [] as $file)unlink($file);if(is_dir($testStorage.'/receipts'))rmdir($testStorage.'/receipts');foreach(glob($testStorage.'/*') ?: [] as $file)if(is_file($file))unlink($file);rmdir($testStorage);
}
