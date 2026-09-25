<?php
declare(strict_types=1);

require __DIR__.'/../api/config.php';

$pdo=database();
$errors=[];$warnings=[];$info=[];

function check_fail(array &$errors,bool $condition,string $message): void {
    if($condition)$errors[]=$message;
}
function check_warn(array &$warnings,bool $condition,string $message): void {
    if($condition)$warnings[]=$message;
}

$expectedTables=[
    'users','entrepreneurs','products','marketplace_state','stock_supply_requests',
    'entrepreneur_shop_items','customer_order_groups','shop_orders','shop_order_items',
    'entrepreneur_payouts','credit_tiers','credit_settlement_requests','entrepreneur_directory'
];
$tables=array_map('strval',array_column($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_NUM),0));
foreach($expectedTables as $table)check_fail($errors,!in_array($table,$tables,true),"Missing required table: $table");

$expectedIndexes=[
    'users'=>['users_role_status_member'],
    'stock_supply_requests'=>['supply_member_status_created'],
    'shop_orders'=>['shop_orders_member_status_delivery'],
    'entrepreneur_payouts'=>['payout_member_status'],
    'credit_settlement_requests'=>['settlement_member_status'],
];
foreach($expectedIndexes as $table=>$names){
    if(!in_array($table,$tables,true))continue;
    $have=array_column($pdo->query("SHOW INDEX FROM `$table`")->fetchAll(),'Key_name');
    foreach($names as $name)check_fail($errors,!in_array($name,$have,true),"Missing performance index: $table.$name");
}

$stateCount=(int)$pdo->query('SELECT COUNT(*) FROM marketplace_state WHERE id=1')->fetchColumn();
check_fail($errors,$stateCount!==1,'marketplace_state row id=1 is missing.');

$counts=[];
foreach(['users','entrepreneurs','products','shop_orders','stock_supply_requests','entrepreneur_payouts','credit_settlement_requests'] as $table){
    if(in_array($table,$tables,true))$counts[$table]=(int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
}
$info[]='Rows: '.implode(', ',array_map(static fn($table,$count)=>"$table=$count",array_keys($counts),array_values($counts)));

$entrepreneurs=[];
if(in_array('entrepreneurs',$tables,true)){
    foreach($pdo->query('SELECT member_id,credit_limit,outstanding,total_sales FROM entrepreneurs')->fetchAll() as $row)$entrepreneurs[(string)$row['member_id']]=$row;
}
foreach($entrepreneurs as $member=>$row){
    $credit=(float)$row['credit_limit'];$used=(float)$row['outstanding'];
    check_fail($errors,$used<0,"Negative outstanding credit for $member.");
    check_warn($warnings,$used>$credit+0.009,"$member has outstanding ".number_format($used,2)." above current limit ".number_format($credit,2).". This can happen if Admin lowered a limit after credit was issued; review it.");
}

$creditCommitments=[];
if(in_array('stock_supply_requests',$tables,true)){
    foreach($pdo->query('SELECT id,entrepreneur_member_id,total,status,record_json FROM stock_supply_requests WHERE record_json IS NOT NULL')->fetchAll() as $row){
        $record=json_decode((string)$row['record_json'],true);
        if(!is_array($record)||($record['creditMode'] ?? false)!==true)continue;
        $member=(string)$row['entrepreneur_member_id'];$status=(string)$row['status'];
        check_fail($errors,!isset($entrepreneurs[$member]),"Credit request {$row['id']} points to missing entrepreneur $member.");
        check_fail($errors,!in_array($status,['Pending','Approved','Dispatched','Rejected'],true),"Credit request {$row['id']} has invalid active-flow status $status.");
        if(in_array($status,['Pending','Approved'],true))$creditCommitments[$member]=($creditCommitments[$member] ?? 0)+(float)$row['total'];
        if($status==='Dispatched')check_warn($warnings,empty($record['creditIssuedAt']),"Dispatched credit request {$row['id']} has no creditIssuedAt marker.");
    }
}
foreach($creditCommitments as $member=>$committed){
    if(!isset($entrepreneurs[$member]))continue;
    $credit=(float)$entrepreneurs[$member]['credit_limit'];$used=(float)$entrepreneurs[$member]['outstanding'];
    check_fail($errors,$used+$committed>$credit+0.009,"Active credit commitments for $member exceed available limit: outstanding ".number_format($used,2)." + committed ".number_format($committed,2)." > limit ".number_format($credit,2).".");
}

$payoutByOrder=[];
if(in_array('entrepreneur_payouts',$tables,true)){
    foreach($pdo->query('SELECT order_id,client_payment_method,collection_status,payout_status,payout_amount FROM entrepreneur_payouts')->fetchAll() as $row)$payoutByOrder[(string)$row['order_id']]=$row;
}
$legacyBank=0;$dropshipOrders=0;
if(in_array('shop_orders',$tables,true)){
    foreach($pdo->query('SELECT id,status,record_json FROM shop_orders WHERE record_json IS NOT NULL')->fetchAll() as $row){
        $record=json_decode((string)$row['record_json'],true);
        if(!is_array($record)||($record['orderMode'] ?? '')!=='dropship')continue;
        $dropshipOrders++;$id=(string)$row['id'];
        check_fail($errors,!isset($payoutByOrder[$id]),"Dropship order $id has no entrepreneur payout ledger row.");
        if(!isset($payoutByOrder[$id]))continue;
        $payout=$payoutByOrder[$id];
        if($payout['client_payment_method']==='bank')$legacyBank++;
        if((string)$row['status']==='Delivered'){
            check_fail($errors,$payout['collection_status']!=='collected',"Delivered dropship order $id is not marked collected.");
            check_fail($errors,!in_array($payout['payout_status'],['pending_transfer','paid','reversal_required','cancelled'],true),"Delivered dropship order $id has inconsistent payout status {$payout['payout_status']}.");
        }
    }
}
if($legacyBank>0)$warnings[]="$legacyBank historical dropship payout record(s) use the retired client bank-payment method. New orders are COD-only; legacy rows are preserved intentionally.";
$info[]="Dropship orders checked: $dropshipOrders";

$invalidSessions=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE session_version<1")->fetchColumn();
check_fail($errors,$invalidSessions>0,'One or more users have an invalid session_version.');

echo "CAMY database health check\n";
echo "Database: ".DB_NAME." @ ".DB_HOST.":".DB_PORT."\n";
foreach($info as $line)echo "[INFO] $line\n";
foreach($warnings as $line)echo "[WARN] $line\n";
if($errors){
    foreach($errors as $line)echo "[ERROR] $line\n";
    echo "Result: FAILED with ".count($errors)." critical issue(s).\n";
    exit(1);
}
echo "Result: PASS";
if($warnings)echo " with ".count($warnings)." warning(s)";
echo ". No destructive changes were made.\n";
