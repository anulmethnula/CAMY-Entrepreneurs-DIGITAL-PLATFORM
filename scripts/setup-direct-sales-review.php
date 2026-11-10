<?php
declare(strict_types=1);
require __DIR__.'/../api/config.php';require __DIR__.'/../api/marketplace.php';
$db=$argv[1] ?? '';if(!preg_match('/^camy_ds_browser_[a-f0-9]{12}$/',$db))throw new RuntimeException('Invalid isolated browser database');
$p=new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
if(($argv[2] ?? '')==='cleanup'){$p->exec("DROP DATABASE IF EXISTS `$db`");exit;}
$p->exec("CREATE DATABASE `$db`");$p->exec("USE `$db`");$p->exec(file_get_contents(__DIR__.'/../database/schema.sql'));
$insert=$p->prepare("INSERT INTO users(id,member_id,full_name,email,password_hash,role,status) VALUES(?,?,?,?,?,?,'active')");
$insert->execute([1,'E1','QA Entrepreneur','qa-buyer@example.invalid',password_hash('BuyerTest!1234',PASSWORD_DEFAULT),'entrepreneur']);$insert->execute([2,null,'QA Administrator','qa-admin@example.invalid',password_hash('DirectSales!1234',PASSWORD_DEFAULT),'admin']);
$p->exec("INSERT INTO entrepreneurs(user_id,member_id,nic,phone,address,city,joined_date) VALUES(1,'E1','QA-NIC','0771234567','QA address','Colombo',CURDATE())");
$products=[['id'=>1,'code'=>'QA-SET','name'=>'QA 4 Pcs Set','category'=>'Cookware','billingPrice'=>2590,'deliveryCost'=>550,'packagingCost'=>150,'freeDelivery'=>true,'price'=>3290,'stock'=>20,'image'=>'/products/classic-set.png'],['id'=>2,'code'=>'QA-MULTI','name'=>'QA Multi Cooker','category'=>'Appliances','billingPrice'=>1000,'deliveryCost'=>150,'packagingCost'=>50,'freeDelivery'=>true,'price'=>1200,'stock'=>15,'image'=>'/products/ac-12000.png'],['id'=>3,'code'=>'QA-AC','name'=>'QA Air Conditioner','category'=>'Appliances','billingPrice'=>2000,'deliveryCost'=>400,'packagingCost'=>100,'freeDelivery'=>false,'price'=>2100,'stock'=>10,'image'=>'/products/ac-18000.png'],['id'=>4,'code'=>'QA-FOUR','name'=>'QA Fourth Product','category'=>'Cookware','billingPrice'=>300,'deliveryCost'=>0,'packagingCost'=>0,'freeDelivery'=>true,'price'=>300,'stock'=>10,'image'=>'/products/classic-set.png']];
$state=['products'=>$products,'entrepreneurs'=>[['id'=>'E1','name'=>'QA Entrepreneur','sales'=>0,'credit'=>0,'used'=>0]],'tiers'=>[],'requests'=>[],'inventory'=>[],'orders'=>[],'settlements'=>[],'catalogue_live'=>true,'catalogue_seeded'=>true,'companySettings'=>['name'=>'QA Invoice Company','address'=>'Test address only','phone'=>'0771234567']];market_save($p,$state);
echo json_encode(['database'=>$db,'products'=>count($products)]);
