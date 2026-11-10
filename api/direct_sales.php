<?php
declare(strict_types=1);

final class DirectSaleFailure extends RuntimeException {
    public function __construct(string $message,public int $status=422){parent::__construct($message);}
}
function ds_fail(string $message,int $status=422): never {throw new DirectSaleFailure($message,$status);}
function ds_permission(array $user,string $permission): bool {
    return ($user['role'] ?? '')==='admin'||(($user['role'] ?? '')==='manager'&&in_array($permission,json_decode($user['permissions_json'] ?? '[]',true) ?: [],true));
}
function ds_authorize(PDO $pdo,string $permission='direct-sales'): array {
    $user=current_user($pdo);if(!$user)ds_fail('Sign in to continue.',401);
    if(!ds_permission($user,$permission))ds_fail('Your role does not allow this direct-sale action.',403);return $user;
}
function ds_amount($value,string $label='Amount'): float {
    if(!is_numeric($value)||!is_finite((float)$value)||(float)$value<0||(float)$value>1000000000)ds_fail($label.' must be a valid non-negative amount.');
    if(abs((float)$value*100-round((float)$value*100))>0.00001)ds_fail($label.' may have at most two decimal places.');
    return round((float)$value,2);
}
function ds_text($value,int $max=500): string {if(!is_scalar($value)&&$value!==null)ds_fail('Invalid text field.');$text=trim((string)$value);if(strlen($text)>$max)ds_fail('A text field exceeds its allowed length.');return $text;}
function ds_date($value): string {
    $date=ds_text($value,10);$parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);if(!$parsed||$parsed->format('Y-m-d')!==$date)ds_fail('Enter a valid payment or fulfilment date.');return $date;
}
function ds_audit(array &$sale,string $action,array $user,array $details=[]): void {
    $sale['history'][]=['action'=>$action,'at'=>date(DATE_ATOM),'by'=>$user['id'],'name'=>$user['full_name'] ?? '', 'details'=>$details];
}
function ds_lines(array $data,array $state,array $user): array {
    if(!is_array($data['items'] ?? null)||!count($data['items'])||count($data['items'])>100)ds_fail('Choose between 1 and 100 products.');
    $lines=[];$seen=[];
    foreach($data['items'] as $input){
        if(!is_array($input))ds_fail('Invalid sale item.');$id=(string)($input['productId'] ?? '');
        if(isset($seen[$id]))ds_fail('Combine duplicate products into a single quantity.');$seen[$id]=true;
        $product=null;foreach($state['products'] as $p)if((string)$p['id']===$id){$product=$p;break;}
        if(!$product)ds_fail('A selected product no longer exists.');
        $qty=filter_var($input['qty'] ?? null,FILTER_VALIDATE_INT);if($qty===false||$qty<1||$qty>1000000)ds_fail('Enter a whole product quantity greater than zero.');
        $method=$input['pricingMethod'] ?? 'catalogue';if(!in_array($method,['catalogue','billing','custom','discount'],true))ds_fail('Invalid pricing method.');
        $baseMode=$method==='discount'?($input['baseMode'] ?? 'catalogue'):$method;if(!in_array($baseMode,['catalogue','billing','custom'],true))ds_fail('Invalid discount base.');
        $billing=ds_amount($product['billingPrice'] ?? $product['price']);$delivery=ds_amount($product['deliveryCost'] ?? 0);$packaging=ds_amount($product['packagingCost'] ?? 0);
        $catalogue=round((float)$product['price']+(($product['freeDelivery'] ?? true)===false?$delivery:0),2);
        $base=$baseMode==='catalogue'?$catalogue:($baseMode==='billing'?$billing:ds_amount($input['customPrice'] ?? null,'Custom price'));
        // Catalogue totals already contain services. Remove those components before
        // selecting replacement charges, so delivery and packaging never occur twice.
        if($baseMode==='catalogue')$base=round($base-$delivery-$packaging,2);
        $deliveryIncluded=($input['includeDelivery'] ?? false)===true;$packagingIncluded=($input['includePackaging'] ?? ($baseMode==='catalogue'))===true;
        $chosenDelivery=$deliveryIncluded?ds_amount($input['deliveryCharge'] ?? $delivery,'Delivery charge'):0;
        $chosenPackaging=$packagingIncluded?ds_amount($input['packagingCharge'] ?? $packaging,'Packaging charge'):0;
        $base=ds_amount(round($base+$chosenDelivery+$chosenPackaging,2),'Base price');
        $type=$input['discountType'] ?? 'none';if(!in_array($type,['none','fixed','percent'],true))ds_fail('Invalid discount type.');
        $value=ds_amount($input['discountValue'] ?? 0,'Discount');if($type==='percent'&&$value>100)ds_fail('Percentage discount cannot exceed 100.');
        $discount=$type==='fixed'?$value:($type==='percent'?round($base*$value/100,2):0);if($discount>$base)ds_fail('Discount cannot exceed the base price.');
        $final=round($base-$discount,2);$reason=ds_text($input['priceReason'] ?? '',1000);
        if(($baseMode==='custom'||$discount>0||$chosenDelivery!==($deliveryIncluded?$delivery:0)||$chosenPackaging!==($packagingIncluded?$packaging:0))){
            if(!ds_permission($user,'direct-sales-pricing'))ds_fail('Price and discount permission is required.',403);
            if($reason==='')ds_fail('Record a reason for a negotiated price or discount.');
        }
        $limit=getenv('CAMY_DIRECT_MAX_DISCOUNT_PERCENT');$minimum=$product['directSaleMinimumPrice'] ?? null;
        $effective=$catalogue>0?max(0,($catalogue-$final)*100/$catalogue):0;
        if(($limit!==false&&$limit!==''&&$effective>(float)$limit)||($minimum!==null&&$final<(float)$minimum)){
            if(!ds_permission($user,'direct-sales-approve')||($data['approvePricing'] ?? false)!==true)ds_fail('This offer requires an authorized price approver to explicitly approve it.',403);
            if($reason==='')ds_fail('An approval reason is required.');
        }
        $lines[]=['productId'=>$product['id'],'code'=>$product['code'] ?? $id,'name'=>$product['name'],'image'=>$product['image'] ?? '', 'qty'=>$qty,'catalogueUnitPrice'=>$catalogue,'billingPrice'=>$billing,'originalDelivery'=>$delivery,'originalPackaging'=>$packaging,'pricingMethod'=>$method,'baseMode'=>$baseMode,'baseUnitPrice'=>$base,'discountType'=>$type,'discountValue'=>$value,'discountPerUnit'=>$discount,'finalUnitPrice'=>$final,'lineTotal'=>round($final*$qty,2),'includeDelivery'=>$deliveryIncluded,'includePackaging'=>$packagingIncluded,'deliveryCharge'=>$chosenDelivery,'packagingCharge'=>$chosenPackaging,'priceReason'=>$reason];
    }
    return $lines;
}
function ds_totals(array &$sale): void {
    $sale['qty']=array_sum(array_column($sale['items'],'qty'));$sale['total']=0;$sale['originalTotal']=0;$sale['discountTotal']=0;
    foreach($sale['items'] as $item){$sale['total']+=$item['lineTotal'];$sale['originalTotal']+=$item['baseUnitPrice']*$item['qty'];$sale['discountTotal']+=$item['discountPerUnit']*$item['qty'];}
    foreach(['total','originalTotal','discountTotal'] as $key)$sale[$key]=round($sale[$key],2);
    $sale['amountReceived']=0;$sale['refundTotal']=0;$pending=false;$rejected=false;
    foreach($sale['payments'] ?? [] as $p){if($p['status']==='Verified')$sale['amountReceived']+=$p['amount'];elseif($p['status']==='Verification Pending')$pending=true;elseif($p['status']==='Rejected')$rejected=true;}
    foreach($sale['refunds'] ?? [] as $p)$sale['refundTotal']+=$p['amount'];
    $sale['amountReceived']=round($sale['amountReceived'],2);$sale['refundTotal']=round($sale['refundTotal'],2);
    $sale['balance']=round(max(0,$sale['total']-$sale['amountReceived']),2);
    $sale['netReceived']=round($sale['amountReceived']-$sale['refundTotal'],2);
    $sale['paymentStatus']=$sale['refundTotal']>0?($sale['netReceived']<=0?'Refunded':'Partially Refunded'):($sale['balance']<=0?'Paid':($sale['amountReceived']>0?'Partially Paid':($pending?'Verification Pending':($rejected?'Rejected':'Awaiting Payment'))));
    $sale['paymentMethod']=implode(' / ',array_values(array_unique(array_column($sale['payments'] ?? [],'method')))) ?: ($sale['preferredPaymentMethod'] ?? 'cash');
}
function ds_save(PDO $pdo,array &$sale): void {
    ds_totals($sale);$sale['updatedAt']=date(DATE_ATOM);$sale['version']=(int)($sale['version'] ?? 0)+1;
    $pdo->prepare('INSERT INTO direct_sales(id,idempotency_key,entrepreneur_member_id,customer_phone,sale_date,payment_status,fulfilment_status,version,record_json) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE payment_status=VALUES(payment_status),fulfilment_status=VALUES(fulfilment_status),version=VALUES(version),record_json=VALUES(record_json)')->execute([$sale['id'],$sale['idempotencyKey'],$sale['entrepreneurId'] ?: null,$sale['buyer']['phone'],$sale['saleDate'],$sale['paymentStatus'],$sale['fulfilmentStatus'],$sale['version'],storage_json($sale)]);
}
function ds_public(array $sale,bool $finance=true): array {
    unset($sale['idempotencyKey']);
    if(!$finance){foreach($sale['payments'] ?? [] as &$payment){unset($payment['reference'],$payment['bankName'],$payment['note'],$payment['receipts']);}unset($payment);unset($sale['history']);}
    return $sale;
}
function ds_list(PDO $pdo,?string $member=null,bool $finance=true): array {
    $query=$pdo->prepare('SELECT record_json FROM direct_sales'.($member!==null?' WHERE entrepreneur_member_id=?':'').' ORDER BY created_at DESC,id DESC');$query->execute($member!==null?[$member]:[]);
    return array_map(static fn($row)=>ds_public(storage_decode($row['record_json']),$finance),$query->fetchAll());
}
function ds_receipt(PDO $pdo,array &$sale,array &$payment,array $data,array $user,array &$newFiles): void {
    if(empty($data['receipt']))return;
    $raw=(string)$data['receipt'];$max=max(1,min(50,(int)(getenv('CAMY_DIRECT_RECEIPT_MAX_MB') ?: 20)))*1024*1024;
    if(strlen($raw)>(int)ceil($max*4/3)+128)ds_fail('Receipt exceeds the configured '.($max/1024/1024).' MB limit.',413);
    $reason=ds_text($data['reason'] ?? '',1000);if(!empty($payment['receipts'])&&$reason==='')ds_fail('Enter a reason for replacing the receipt.');
    $file=workflow_invoice_document($raw,$sale['id'].'-payment');$newFiles[]=$file;
    $id=bin2hex(random_bytes(12));$meta=['id'=>$id,'by'=>$user['id'],'name'=>$user['full_name'] ?? '', 'at'=>date(DATE_ATOM),'reason'=>$reason,'receipt'=>'/api/admin/direct-sales/'.$sale['id'].'/receipts/'.$id];
    $pdo->prepare('INSERT INTO direct_sale_receipts(id,sale_id,payment_id,storage_name,record_json) VALUES(?,?,?,?,?)')->execute([$id,$sale['id'],$payment['id'],$file,storage_json($meta)]);
    $payment['receipts'][]=$meta;ds_audit($sale,'Receipt uploaded',$user,['paymentId'=>$payment['id'],'receiptId'=>$id,'reason'=>$reason]);
}
function ds_add_payment(PDO $pdo,array &$sale,array $data,array $user,array &$newFiles): void {
    if($sale['businessStatus']==='Draft'||in_array($sale['fulfilmentStatus'],['Cancelled','Returned'],true))ds_fail('Confirm an active sale before recording payment.',409);
    $method=$data['method'] ?? 'cash';if(!in_array($method,['cash','bank'],true))ds_fail('Choose cash or bank transfer.');
    $amount=ds_amount($data['amount'] ?? 0);if($amount<=0)ds_fail('Payment amount must be greater than zero.');
    ds_totals($sale);if($sale['balance']<=0)ds_fail('This sale is already paid.',409);
    $date=ds_date($data['date'] ?? '');$reference=ds_text($data['reference'] ?? '',150);
    if($method==='cash'&&($data['confirmed'] ?? false)!==true)ds_fail('Confirm that the cash has actually been collected.');
    if($method==='bank'&&($reference===''||empty($data['receipt'])))ds_fail('Provide the bank transfer reference and payment receipt.');
    if($method==='bank'&&$amount>$sale['balance'])ds_fail('Bank amount exceeds the remaining payable balance.');
    $applied=min($amount,$sale['balance']);$id=bin2hex(random_bytes(12));
    $payment=['id'=>$id,'method'=>$method,'amount'=>$applied,'tendered'=>$amount,'change'=>round($amount-$applied,2),'date'=>$date,'reference'=>$reference,'bankName'=>ds_text($data['bankName'] ?? '',150),'note'=>ds_text($data['note'] ?? '',1000),'status'=>$method==='cash'?'Verified':'Verification Pending','receivedBy'=>$user['id'],'recordedAt'=>date(DATE_ATOM),'receipts'=>[]];
    if($method==='cash'){$payment['verifiedBy']=$user['id'];$payment['verifiedAt']=date(DATE_ATOM);}
    ds_receipt($pdo,$sale,$payment,$data,$user,$newFiles);$sale['payments'][]=$payment;ds_audit($sale,'Payment recorded',$user,['paymentId'=>$id,'amount'=>$applied,'method'=>$method]);ds_totals($sale);
}
function ds_stock(PDO $pdo,array &$sale,array &$state,array $user,string $kind): void {
    foreach($sale['items'] as $item){
        $index=null;foreach($state['products'] as $i=>$p)if((string)$p['id']===(string)$item['productId']){$index=$i;break;}
        if($index===null)ds_fail('A sale product is missing from the warehouse catalogue.',409);
        $before=(int)$state['products'][$index]['stock'];$delta=0;
        if($kind==='Reserved'||($kind==='Direct Sale - Outgoing'&&empty($sale['reserved'])))$delta=-$item['qty'];
        if($kind==='Reservation Released'||$kind==='Physical Return')$delta=$item['qty'];
        if($before+$delta<0)ds_fail('Insufficient warehouse stock for '.$item['name'].'.',409);
        $state['products'][$index]['stock']=$before+$delta;
        $movement=['saleId'=>$sale['id'],'productId'=>$item['productId'],'code'=>$item['code'],'name'=>$item['name'],'qty'=>$item['qty'],'stockBefore'=>$before,'stockAfter'=>$before+$delta,'type'=>$kind,'at'=>date(DATE_ATOM),'by'=>$user['id'],'nameOfStaff'=>$user['full_name'] ?? '', 'availabilityDelta'=>$delta];
        $pdo->prepare('INSERT INTO direct_sale_stock_movements(sale_id,product_code,movement_type,quantity,stock_before,stock_after,processed_by,record_json) VALUES(?,?,?,?,?,?,?,?)')->execute([$sale['id'],$item['code'],$kind,$item['qty'],$before,$before+$delta,$user['id'],storage_json($movement)]);
        if($sale['entrepreneurId']&&in_array($kind,['Direct Sale - Outgoing','Physical Return'],true)){
            // Purchased ownership is separate from credit-financed/public shop inventory.
            $pdo->prepare('INSERT IGNORE INTO direct_purchase_inventory(entrepreneur_member_id,product_code,quantity) VALUES(?,?,0)')->execute([$sale['entrepreneurId'],$item['code']]);
            if($kind==='Direct Sale - Outgoing')$pdo->prepare('UPDATE direct_purchase_inventory SET quantity=quantity+? WHERE entrepreneur_member_id=? AND product_code=?')->execute([$item['qty'],$sale['entrepreneurId'],$item['code']]);
            else {$q=$pdo->prepare('UPDATE direct_purchase_inventory SET quantity=quantity-? WHERE entrepreneur_member_id=? AND product_code=? AND quantity>=?');$q->execute([$item['qty'],$sale['entrepreneurId'],$item['code'],$item['qty']]);if(!$q->rowCount())ds_fail('Purchased stock ownership could not be reversed.',409);}
        }
    }
    $sale['reserved']=$kind==='Reserved';
}
function ds_company(array $state): array {
    $configured=is_array($state['companySettings'] ?? null)?$state['companySettings']:[];
    $out=[];foreach(['name','address','phone','email','taxNumber'] as $key){$env=getenv('CAMY_COMPANY_'.strtoupper($key));$value=$configured[$key] ?? ($env!==false?$env:'');if($value!=='')$out[$key]=(string)$value;}return $out;
}
function direct_sales_route(PDO $pdo,string $path,string $method): void {
    if(!str_starts_with($path,'/admin/direct-sales'))return;
    $newFiles=[];$result=[];$status=200;
    try {
        $actor=ds_authorize($pdo);
        $finance=ds_permission($actor,'direct-sales-finance');
        if($path==='/admin/direct-sales'&&$method==='GET'){
            $state=market_state($pdo);$result=['sales'=>ds_list($pdo,null,$finance),'access'=>['create'=>true,'pricing'=>ds_permission($actor,'direct-sales-pricing'),'finance'=>$finance,'approve'=>ds_permission($actor,'direct-sales-approve')],'company'=>ds_company($state),'receiptMaxMb'=>max(1,min(50,(int)(getenv('CAMY_DIRECT_RECEIPT_MAX_MB') ?: 20)))];
        }elseif(preg_match('#^/admin/direct-sales/([^/]+)/receipts/([a-f0-9]{24})$#',$path,$match)&&$method==='GET'){
            if(!$finance)ds_fail('Finance permission is required to view payment receipts.',403);
            $q=$pdo->prepare('SELECT storage_name FROM direct_sale_receipts WHERE sale_id=? AND id=?');$q->execute([$match[1],$match[2]]);$name=$q->fetchColumn();$file=private_path('receipts/'.basename((string)$name));if(!$name||!is_file($file))ds_fail('Receipt not found.',404);
            header('Content-Type: '.(mime_content_type($file) ?: 'application/octet-stream'));header('Cache-Control: no-store');header('Content-Disposition: '.(isset($_GET['download'])?'attachment':'inline').'; filename="payment-receipt.'.pathinfo($file,PATHINFO_EXTENSION).'"');readfile($file);exit;
        }elseif($path==='/admin/direct-sales'&&$method==='POST'){
            $data=input();$key=ds_text($data['idempotencyKey'] ?? '',96);if(!preg_match('/^[a-zA-Z0-9-]{16,96}$/',$key))ds_fail('A valid sale submission key is required.');
            $pdo->beginTransaction();$state=market_state($pdo,true);
            $query=$pdo->prepare('SELECT record_json FROM direct_sales WHERE idempotency_key=?');$query->execute([$key]);$prior=$query->fetchColumn();
            if($prior){$result=['sale'=>ds_public(storage_decode($prior),$finance),'message'=>'Existing sale returned; no duplicate created.'];$pdo->commit();}
            else {
                $type=$data['customerType'] ?? 'other';if(!in_array($type,['entrepreneur','other'],true))ds_fail('Choose a valid customer type.');$member='';$buyer=[];
                if($type==='entrepreneur'){
                    $member=ds_text($data['entrepreneurId'] ?? '',40);$q=$pdo->prepare("SELECT u.full_name,e.phone,e.address,e.city,u.status FROM users u JOIN entrepreneurs e ON e.user_id=u.id WHERE u.member_id=? AND u.role='entrepreneur'");$q->execute([$member]);$person=$q->fetch();
                    if(!$person||$person['status']!=='active')ds_fail('Choose an active registered entrepreneur.');
                    $buyer=['name'=>$person['full_name'],'phone'=>$person['phone'],'address'=>$person['address'] ?? '', 'district'=>$person['city'] ?? '', 'accountStatus'=>$person['status']];
                }else{foreach(['name','phone','phone2','address','district','notes'] as $field)$buyer[$field]=ds_text($data['buyer'][$field] ?? '',$field==='notes'?1000:500);}
                if(empty($buyer['name'])||empty($buyer['phone'])||!preg_match('/^[+0-9 ()-]{7,30}$/',$buyer['phone']))ds_fail('Buyer name and a valid contact number are required.');
                if(!empty($buyer['phone2'])&&!preg_match('/^[+0-9 ()-]{7,30}$/',$buyer['phone2']))ds_fail('Invalid alternative phone number.');
                $mode=$data['fulfilmentMethod'] ?? 'collection';if(!in_array($mode,['collection','delivery'],true))ds_fail('Choose collection or courier delivery.');
                $draft=($data['draft'] ?? false)===true;$sale=['id'=>'DS-'.strtoupper(bin2hex(random_bytes(7))),'idempotencyKey'=>$key,'orderType'=>'direct','customerType'=>$type,'entrepreneurId'=>$member,'buyer'=>$buyer,'saleDate'=>ds_date($data['saleDate'] ?? date('Y-m-d')),'createdAt'=>date(DATE_ATOM),'createdBy'=>$actor['id'],'createdByName'=>$actor['full_name'] ?? '', 'items'=>ds_lines($data,$state,$actor),'payments'=>[],'refunds'=>[],'history'=>[],'businessStatus'=>$draft?'Draft':'Confirmed','fulfilmentMethod'=>$mode,'fulfilmentStatus'=>'Not released','reserved'=>false,'preferredPaymentMethod'=>$data['payment']['method'] ?? 'cash'];
                ds_totals($sale);ds_audit($sale,'Sale created',$actor,['pricingApproved'=>($data['approvePricing'] ?? false)===true]);ds_save($pdo,$sale);
                if(!$draft){if(($data['reserve'] ?? false)===true)ds_stock($pdo,$sale,$state,$actor,'Reserved');if((float)($data['payment']['amount'] ?? 0)>0)ds_add_payment($pdo,$sale,$data['payment'],$actor,$newFiles);}
                ds_save($pdo,$sale);if($sale['reserved'])market_save($pdo,$state);$pdo->commit();$status=201;$result=['sale'=>ds_public($sale,$finance),'message'=>'Direct sale saved. Payment verification and handover are separate actions.'];
            }
        }elseif(preg_match('#^/admin/direct-sales/([^/]+)(?:/(confirm|payments|verify|receipt|fulfilment|cancel|return|refund|prices))?$#',$path,$match)){
            $id=$match[1];$action=$match[2] ?? '';
            if($method==='GET'&&$action===''){$q=$pdo->prepare('SELECT record_json FROM direct_sales WHERE id=?');$q->execute([$id]);$raw=$q->fetchColumn();if(!$raw)ds_fail('Direct sale not found.',404);$result=['sale'=>ds_public(storage_decode($raw),$finance)];}
            elseif($method==='POST'&&$action!==''){
                $data=input();$pdo->beginTransaction();$state=market_state($pdo,true);$q=$pdo->prepare('SELECT record_json FROM direct_sales WHERE id=? FOR UPDATE');$q->execute([$id]);$raw=$q->fetchColumn();if(!$raw)ds_fail('Direct sale not found.',404);$sale=storage_decode($raw);
                if((int)($data['version'] ?? -1)!==(int)$sale['version'])ds_fail('This sale changed in another session. Reload before continuing.',409);
                $stockChanged=false;
                if($action==='confirm'){
                    if($sale['businessStatus']!=='Draft')ds_fail('This sale is already confirmed.',409);$sale['businessStatus']='Confirmed';
                    if(($data['reserve'] ?? false)===true){ds_stock($pdo,$sale,$state,$actor,'Reserved');$stockChanged=true;}
                }elseif($action==='prices'){
                    if($sale['businessStatus']!=='Draft'||!empty($sale['payments'])||!empty($sale['reserved']))ds_fail('Only an unpaid, unreserved draft can be repriced.',409);
                    $old=$sale['items'];$sale['items']=ds_lines($data,$state,$actor);ds_audit($sale,'Prices changed',$actor,['before'=>$old,'after'=>$sale['items']]);
                }elseif($action==='payments')ds_add_payment($pdo,$sale,$data,$actor,$newFiles);
                elseif(in_array($action,['verify','receipt'],true)){
                    if(!$finance)ds_fail('Direct-sale Finance permission is required.',403);
                    $index=null;foreach($sale['payments'] as $i=>$payment)if($payment['id']===($data['paymentId'] ?? '')){$index=$i;break;}if($index===null)ds_fail('Payment not found.',404);
                    $payment=&$sale['payments'][$index];
                    if($action==='verify'){
                        if($payment['method']!=='bank'||$payment['status']!=='Verification Pending')ds_fail('This bank payment is not awaiting verification.',409);
                        if(in_array($sale['fulfilmentStatus'],['Cancelled','Returned'],true))ds_fail('A closed sale cannot accept payment verification.',409);
                        if(($data['confirmed'] ?? false)!==true)ds_fail('Confirm that you checked the actual bank records.');
                        $decision=$data['decision'] ?? '';if(!in_array($decision,['Verified','Rejected'],true))ds_fail('Choose Verify or Reject.');
                        if($decision==='Verified'&&$payment['amount']>$sale['balance'])ds_fail('This payment exceeds the unpaid balance. Reconcile it before verification.',409);
                        $payment['status']=$decision;$payment['verificationNote']=ds_text($data['reason'] ?? '',1000);$payment['verifiedBy']=$actor['id'];$payment['verifiedAt']=date(DATE_ATOM);
                    }else{
                        if(empty($data['receipt']))ds_fail('Select a replacement receipt.');
                        ds_receipt($pdo,$sale,$payment,$data,$actor,$newFiles);
                        // A corrected proof does not silently retain a previous verification.
                        if($payment['method']==='bank'&&$payment['status']==='Verified'){$payment['status']='Verification Pending';unset($payment['verifiedBy'],$payment['verifiedAt']);}
                    }
                    unset($payment);
                }elseif($action==='fulfilment'){
                    $next=$data['status'] ?? '';
                    if($next==='Completed'){
                        if(!in_array($sale['fulfilmentStatus'],['Handed Over','Dispatched'],true))ds_fail('Record handover or dispatch before completion.',409);
                        $sale['fulfilmentStatus']='Completed';$sale['completedAt']=date(DATE_ATOM);
                    }else{
                        if($sale['businessStatus']!=='Confirmed'||$sale['fulfilmentStatus']!=='Not released'||$sale['paymentStatus']!=='Paid')ds_fail('A confirmed, fully paid sale is required before stock release.',409);
                        if($sale['fulfilmentMethod']==='collection'){
                            if($next!=='Handed Over')ds_fail('Use collection handover for this sale.');$name=ds_text($data['collectedBy'] ?? '',150);if(!$name)ds_fail('Record who collected the goods.');
                            $sale['collection']=['collectedBy'=>$name,'date'=>ds_date($data['date'] ?? ''),'note'=>ds_text($data['note'] ?? '',1000)];
                        }else{
                            if($next!=='Dispatched')ds_fail('Use courier dispatch for this sale.');$courier=ds_text($data['courier'] ?? '',150);$tracking=ds_text($data['trackingNumber'] ?? '',150);if(!$courier||!$tracking)ds_fail('Courier and tracking number are required.');
                            $sale['shipment']=['courier'=>$courier,'trackingNumber'=>$tracking,'date'=>ds_date($data['date'] ?? ''),'deliveryStatus'=>'Dispatched','note'=>ds_text($data['note'] ?? '',1000)];
                        }
                        ds_stock($pdo,$sale,$state,$actor,'Direct Sale - Outgoing');$stockChanged=true;$sale['fulfilmentStatus']=$next;$sale['releasedAt']=date(DATE_ATOM);
                    }
                }elseif($action==='cancel'){
                    if($sale['fulfilmentStatus']!=='Not released')ds_fail('Only unreleased sales can be cancelled. Record a physical return for released stock.',409);
                    if(!empty($sale['reserved'])){ds_stock($pdo,$sale,$state,$actor,'Reservation Released');$stockChanged=true;}$sale['fulfilmentStatus']='Cancelled';$sale['businessStatus']='Cancelled';
                }elseif($action==='return'){
                    if(!in_array($sale['fulfilmentStatus'],['Handed Over','Dispatched','Completed'],true)||($data['physicalReturnConfirmed'] ?? false)!==true)ds_fail('Confirm the actual physical return of all goods from a released sale.',409);
                    $reason=ds_text($data['reason'] ?? '',1000);if(!$reason)ds_fail('Record the return reason.');ds_stock($pdo,$sale,$state,$actor,'Physical Return');$stockChanged=true;$sale['fulfilmentStatus']='Returned';$sale['returnedAt']=date(DATE_ATOM);$sale['returnReason']=$reason;
                }elseif($action==='refund'){
                    if(!$finance)ds_fail('Finance permission is required for refunds.',403);
                    if(!in_array($sale['fulfilmentStatus'],['Cancelled','Returned'],true))ds_fail('Cancel the unreleased sale or record physical return before refunding.',409);
                    $amount=ds_amount($data['amount'] ?? 0);$reason=ds_text($data['reason'] ?? '',1000);$method=$data['method'] ?? '';if($amount<=0||$amount>$sale['netReceived']||!$reason||($data['confirmed'] ?? false)!==true||!in_array($method,['cash','bank'],true))ds_fail('Record a valid amount, method, reason and actual refund confirmation.');
                    $reference=ds_text($data['reference'] ?? '',150);if($method==='bank'&&!$reference)ds_fail('A bank refund reference is required.');
                    $sale['refunds'][]=['id'=>bin2hex(random_bytes(12)),'amount'=>$amount,'method'=>$method,'reference'=>$reference,'reason'=>$reason,'date'=>ds_date($data['date'] ?? ''),'by'=>$actor['id'],'at'=>date(DATE_ATOM)];
                }
                ds_audit($sale,ucfirst($action),$actor,array_diff_key($data,array_flip(['receipt','version','items'])));ds_save($pdo,$sale);if($stockChanged)market_save($pdo,$state);$pdo->commit();$result=['sale'=>ds_public($sale,$finance),'message'=>'Direct sale updated successfully.'];
            }else ds_fail('Method not allowed.',405);
        }else ds_fail('Direct-sale endpoint not found.',404);
    }catch(DirectSaleFailure $failure){if($pdo->inTransaction())$pdo->rollBack();foreach($newFiles as $file)@unlink(private_path('receipts/'.basename($file)));response(['message'=>$failure->getMessage()],$failure->status);}
    catch(Throwable $failure){if($pdo->inTransaction())$pdo->rollBack();foreach($newFiles as $file)@unlink(private_path('receipts/'.basename($file)));throw $failure;}
    response($result,$status);
}
