<?php
declare(strict_types=1);
require __DIR__.'/../api/direct_sales.php';
$product=['id'=>1,'code'=>'P1','name'=>'Test pan','price'=>3290,'billingPrice'=>2590,'deliveryCost'=>550,'packagingCost'=>150,'stock'=>20];
$state=['products'=>[$product]];$actor=['id'=>1,'role'=>'admin'];
function ensure(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
foreach(['', '   ',null,0,'0'] as $discount){
 $line=ds_lines(['items'=>[['productId'=>1,'qty'=>2,'pricingMethod'=>'catalogue','includeDelivery'=>false,'includePackaging'=>false,'discountType'=>'none','discountValue'=>$discount]]],$state,$actor)[0];
 ensure($line['discountValue']===0.0&&$line['finalUnitPrice']===2590.0&&$line['lineTotal']===5180.0,'Blank / zero optional discount must mean no discount');
}
foreach(['fixed','percent'] as $type){$line=ds_lines(['items'=>[['productId'=>1,'qty'=>1,'pricingMethod'=>'billing','includeDelivery'=>false,'includePackaging'=>false,'discountType'=>$type,'discountValue'=>'']]],$state,$actor)[0];ensure($line['discountPerUnit']===0.0,'Cleared discount must not fail saving');}
foreach([-1,'bad',[],INF,'NaN'] as $discount){try{ds_lines(['items'=>[['productId'=>1,'qty'=>1,'pricingMethod'=>'billing','discountType'=>'fixed','discountValue'=>$discount]]],$state,$actor);throw new RuntimeException('Invalid discount accepted');}catch(DirectSaleFailure $e){ensure(str_contains($e->getMessage(),'Test pan'),'Error must identify the affected product');}}
$line=ds_lines(['items'=>[['productId'=>1,'qty'=>2,'pricingMethod'=>'billing','includeDelivery'=>false,'includePackaging'=>false,'discountType'=>'fixed','discountValue'=>190,'priceReason'=>'Offer']]],$state,$actor)[0];ensure($line['lineTotal']===4800.0,'Valid discount changed');
echo "PASS: empty/whitespace/null/zero discounts save as zero, cleared fixed/percent discounts work, invalid discounts still fail with product name, valid discounts retain correct prices.\n";
