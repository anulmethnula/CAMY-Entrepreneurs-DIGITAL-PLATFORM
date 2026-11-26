<?php
declare(strict_types=1);

// Corrections intentionally require Super Admin: these can change booked money
// and permanently remove a sale. Routine staff fulfilment permissions are unchanged.
function sale_correction_text(array $data,string $key,int $max=500): string {return ds_text($data[$key] ?? '',$max);}
function sale_correction_quantities(array $items): array {
    $out=[];foreach($items as $item){$key=(string)($item['productId'] ?? $item['id']);$out[$key]=($out[$key] ?? 0)+(int)$item['qty'];}return $out;
}
function sale_correction_input_items(array $data): array {
    $items=$data['items'] ?? null;if(!is_array($items)||!count($items)||count($items)>100)ds_fail('Keep between 1 and 100 products.');$seen=[];
    foreach($items as $item){if(!is_array($item))ds_fail('Invalid product line.');$id=ds_text($item['productId'] ?? '',40);$qty=filter_var($item['qty'] ?? null,FILTER_VALIDATE_INT);if(!$id||isset($seen[$id])||$qty===false||$qty<1||$qty>1000000)ds_fail('Use distinct products and positive whole quantities.');$seen[$id]=true;ds_amount($item['price'] ?? null,'Unit selling price');}return $items;
}
function sale_correction_buyer(array $data): array {
    $buyer=[];foreach(['name','phone','phone2','address','district','notes'] as $key)$buyer[$key]=sale_correction_text($data,$key,$key==='notes'?1000:($key==='name'?150:500));
    if(!$buyer['name']||!preg_match('/^[+0-9 ()-]{7,30}$/',$buyer['phone'])||($buyer['phone2']!==''&&!preg_match('/^[+0-9 ()-]{7,30}$/',$buyer['phone2'])))ds_fail('Enter a customer name and valid contact numbers.');return $buyer;
}
function sale_correction_recalculate_member(array &$state,string $member): void {
    $sales=0;foreach($state['orders'] as $order)if((string)$order['entrepreneurId']===$member&&$order['status']==='Delivered')$sales+=catalogue_order_sales_value($order);
    foreach($state['entrepreneurs'] as &$person)if((string)$person['id']===$member){$person['sales']=round($sales,2);$person['credit']=catalogue_credit_for_sales($state['tiers'],$sales);if(($person['stage'] ?? '')!=='Departed')$person['stage']=$person['credit']>0?'Credit eligible':'Trial seller';break;}unset($person);
}
function sale_correction_cod_stock(array &$state,array $old,array $newItems): void {
    // Delivered orders still consume stock; cancelled/returned orders already released it.
    $active=!in_array($old['status'],['Cancelled','Returned','Rejected'],true)&&($old['reserved'] ?? true);
    if(!$active)return;
    $shop=($old['orderMode'] ?? '')==='dropship'?null:(string)$old['entrepreneurId'];
    workflow_release($state,$old['items'] ?? [],$shop);if($newItems)workflow_reserve($state,$newItems,$shop);
}
function sale_correction_direct_stock(PDO $pdo,array &$state,array $old,?array $next,array $actor): void {
    // Movement deltas reflect both reservations and actual releases. Reverse the
    // recorded net effect rather than guessing from the sale's current status.
    $query=$pdo->prepare('SELECT product_code,record_json FROM direct_sale_stock_movements WHERE sale_id=? ORDER BY id');$query->execute([$old['id']]);$net=[];
    foreach($query->fetchAll() as $row){$move=storage_decode($row['record_json']);$code=$row['product_code'];$net[$code]=($net[$code] ?? 0)+(int)($move['availabilityDelta'] ?? (($move['stockAfter'] ?? 0)-($move['stockBefore'] ?? 0)));}
    $active=$next&&(!empty($next['reserved'])||in_array($next['fulfilmentStatus'],['Handed Over','Dispatched','Completed'],true));$desired=[];
    if($active)foreach($next['items'] as $item)$desired[$item['code']]=($desired[$item['code']] ?? 0)-(int)$item['qty'];
    foreach(array_unique(array_merge(array_keys($net),array_keys($desired))) as $code){
        $delta=($desired[$code] ?? 0)-($net[$code] ?? 0);if(!$delta)continue;$found=false;
        foreach($state['products'] as &$product)if((string)($product['code'] ?? $product['id'])===(string)$code){$before=(int)$product['stock'];if($before+$delta<0)ds_fail('Insufficient stock for this correction.',409);$product['stock']=$before+$delta;$found=true;
            if($next){$move=['saleId'=>$old['id'],'productId'=>$product['id'],'code'=>$code,'name'=>$product['name'],'qty'=>abs($delta),'stockBefore'=>$before,'stockAfter'=>$before+$delta,'type'=>'Correction v'.((int)$old['version']+1),'availabilityDelta'=>$delta,'at'=>ds_now(),'by'=>$actor['id']];$pdo->prepare('INSERT INTO direct_sale_stock_movements(sale_id,product_code,movement_type,quantity,stock_before,stock_after,processed_by,record_json) VALUES(?,?,?,?,?,?,?,?)')->execute([$old['id'],$code,$move['type'],abs($delta),$before,$before+$delta,$actor['id'],storage_json($move)]);}break;
        }unset($product);if(!$found)ds_fail('A product required for stock correction is missing.',409);
    }
    $released=in_array($old['fulfilmentStatus'],['Handed Over','Dispatched','Completed'],true);$newReleased=$next&&in_array($next['fulfilmentStatus'],['Handed Over','Dispatched','Completed'],true);
    if(!empty($old['entrepreneurId'])){
        $ownership=[];if($released)foreach($old['items'] as $item)$ownership[$item['code']]=($ownership[$item['code']] ?? 0)-(int)$item['qty'];if($newReleased)foreach($next['items'] as $item)$ownership[$item['code']]=($ownership[$item['code']] ?? 0)+(int)$item['qty'];
        foreach($ownership as $code=>$delta)if($delta){$pdo->prepare('INSERT IGNORE INTO direct_purchase_inventory(entrepreneur_member_id,product_code,quantity) VALUES(?,?,0)')->execute([$old['entrepreneurId'],$code]);$q=$pdo->prepare('UPDATE direct_purchase_inventory SET quantity=quantity+? WHERE entrepreneur_member_id=? AND product_code=? AND quantity+?>=0');$q->execute([$delta,$old['entrepreneurId'],$code,$delta]);if(!$q->rowCount())ds_fail('Purchased stock ownership cannot be reversed; reconcile the dependent stock first.',409);$pdo->prepare('DELETE FROM direct_purchase_inventory WHERE entrepreneur_member_id=? AND product_code=? AND quantity=0')->execute([$old['entrepreneurId'],$code]);}
    }
}
function sale_correction_direct_items(array $data,array $old,array $state,array $actor,string $reason): array {
    $lines=[];$oldById=[];foreach($old['items'] as $item)$oldById[(string)$item['productId']]=$item;
    foreach(sale_correction_input_items($data) as $input){$id=(string)$input['productId'];$qty=(int)$input['qty'];$price=ds_amount($input['price']);$prior=$oldById[$id] ?? null;
        if($prior&&abs($price-(float)$prior['finalUnitPrice'])<0.001){$line=$prior;$line['qty']=$qty;$line['lineTotal']=round($price*$qty,2);}
        else{$generated=ds_lines(['items'=>[['productId'=>$id,'qty'=>$qty,'pricingMethod'=>'custom','customPrice'=>$price,'includeDelivery'=>false,'includePackaging'=>false,'priceReason'=>$reason]],'approvePricing'=>true],$state,$actor);$line=$generated[0];}
        $lines[]=$line;
    }return $lines;
}
function sale_correction_route(PDO $pdo,string $path,string $method): void {
    if(!preg_match('#^/admin/sales/(cod|direct)/([^/]+)$#',$path,$matches))return;
    $actor=require_admin($pdo);if($actor['role']!=='admin')response(['message'=>'Only a Super Admin can correct or permanently delete sales.'],403);
    if(!in_array($method,['GET','PATCH','DELETE'],true))response(['message'=>'Method not allowed.'],405);
    $kind=$matches[1];$id=rawurldecode($matches[2]);$files=[];
    try{
        $pdo->beginTransaction();$state=market_state($pdo,true);$table=$kind==='direct'?'direct_sales':'shop_orders';$q=$pdo->prepare("SELECT record_json FROM $table WHERE id=? FOR UPDATE");$q->execute([$id]);$raw=$q->fetchColumn();if(!$raw)ds_fail('Sale not found. It may already have been deleted.',404);$stored=storage_decode($raw);$ledger=[];if($kind==='cod'){$ledgerQuery=$pdo->prepare('SELECT payout_status,payout_amount,payout_reference,paid_at,updated_at FROM entrepreneur_payouts WHERE order_id=? FOR UPDATE');$ledgerQuery->execute([$id]);$ledger=$ledgerQuery->fetch() ?: [];}$token=hash('sha256',(string)$raw.storage_json($ledger));
        if($method==='GET'){$pdo->commit();response(['record'=>$stored,'token'=>$token]);}
        $data=input();if(!is_string($data['token'] ?? null)||!hash_equals($token,$data['token']))ds_fail('This sale changed in another session. Close this form and reopen it before continuing.',409);
        $reason=sale_correction_text($data,'reason',1000);if(strlen($reason)<5)ds_fail('Explain the recording mistake (5 to 1000 characters).');
        if($method==='DELETE'&&($data['confirmId'] ?? '')!==$id)ds_fail('Type the exact sale ID to confirm permanent deletion.');
        if($kind==='direct'){
            if($method==='DELETE'){
                sale_correction_direct_stock($pdo,$state,$stored,null,$actor);
                $q=$pdo->prepare('SELECT storage_name FROM direct_sale_receipts WHERE sale_id=?');$q->execute([$id]);$files=array_column($q->fetchAll(),'storage_name');
                $pdo->prepare('DELETE FROM direct_sale_receipts WHERE sale_id=?')->execute([$id]);$pdo->prepare('DELETE FROM direct_sale_stock_movements WHERE sale_id=?')->execute([$id]);$pdo->prepare('DELETE FROM direct_sales WHERE id=?')->execute([$id]);
            }else{
                $buyer=sale_correction_buyer($data);$next=$stored;$next['buyer']=array_merge($stored['buyer'],$buyer);$next['saleDate']=ds_date($data['date'] ?? '');
                // Price validation must include stock already consumed by this sale.
                $available=$state;foreach($stored['items'] as $item)if(!empty($stored['reserved'])||in_array($stored['fulfilmentStatus'],['Handed Over','Dispatched','Completed'],true))foreach($available['products'] as &$p)if((string)$p['id']===(string)$item['productId']){$p['stock']+=(int)$item['qty'];break;}unset($p);
                $next['items']=sale_correction_direct_items($data,$stored,$available,$actor,$reason);
                if(!is_array($data['payments'] ?? null)||count($data['payments'])!==count($stored['payments']))ds_fail('Keep the recorded payment entries. Use View to record a new payment.');
                foreach($stored['payments'] as $i=>$payment){$incoming=$data['payments'][$i];if(!is_array($incoming))ds_fail('Invalid payment entry.');if(($incoming['id'] ?? '')!==$payment['id'])ds_fail('Payment entries changed. Reload this form.',409);$next['payments'][$i]['amount']=ds_amount($incoming['amount'] ?? null,'Payment amount');$next['payments'][$i]['date']=ds_date($incoming['date'] ?? '');$next['payments'][$i]['reference']=ds_text($incoming['reference'] ?? '',150);$next['payments'][$i]['tendered']=max($next['payments'][$i]['amount'],(float)($payment['tendered'] ?? 0));$next['payments'][$i]['change']=round($next['payments'][$i]['tendered']-$next['payments'][$i]['amount'],2);}
                ds_totals($next);if($next['refundTotal']>$next['amountReceived']+0.009)ds_fail('Corrected payments cannot be less than recorded refunds.',409);
                if(in_array($next['fulfilmentStatus'],['Handed Over','Dispatched','Completed'],true)&&$next['amountReceived']+0.009<$next['total'])ds_fail('A released sale must stay fully paid. Correct its recorded payment amount too.',409);
                sale_correction_direct_stock($pdo,$state,$stored,$next,$actor);ds_audit($next,'Sale corrected',$actor,['reason'=>$reason,'previousDate'=>$stored['saleDate'],'previousBuyer'=>$stored['buyer'],'previousItems'=>$stored['items'],'previousPayments'=>array_map(static fn($p)=>array_intersect_key($p,array_flip(['id','amount','date','reference'])),$stored['payments'])]);ds_save($pdo,$next);
            }
        }else{
            $index=null;foreach($state['orders'] as $i=>$order)if((string)$order['id']===$id){$index=$i;break;}if($index===null)ds_fail('Order not found.',404);$old=$state['orders'][$index];
            if($method==='DELETE'){
                if(preg_match('/^CMY-(\d+)$/',$id,$number))$state['orderSequence']=max((int)($state['orderSequence'] ?? 999),(int)$number[1]);
                sale_correction_cod_stock($state,$old,[]);$state['orders']=array_values(array_filter($state['orders'],static fn($o)=>(string)$o['id']!==$id));
                foreach(['invoicePath','receiptPath'] as $key)if(!empty($old[$key]))$files[]=$old[$key];
                $q=$pdo->prepare('SELECT payout_receipt_path,client_payment_receipt_path FROM entrepreneur_payouts WHERE order_id=?');$q->execute([$id]);$proof=$q->fetch() ?: [];foreach($proof as $file)if($file)$files[]=$file;
                $pdo->prepare('DELETE FROM order_status_history WHERE order_id=?')->execute([$id]);$pdo->prepare('DELETE FROM shop_order_items WHERE order_id=?')->execute([$id]);$pdo->prepare('DELETE FROM entrepreneur_payouts WHERE order_id=?')->execute([$id]);$pdo->prepare('DELETE FROM shop_orders WHERE id=?')->execute([$id]);$group=$old['groupId'] ?? $id;$pdo->prepare('DELETE FROM customer_order_groups WHERE id=? AND NOT EXISTS(SELECT 1 FROM shop_orders WHERE group_id=?)')->execute([$group,$group]);
            }else{
                $buyer=sale_correction_buyer($data);$next=$old;$next['date']=ds_date($data['date'] ?? '');foreach(['customer'=>'name','phone'=>'phone','phone2'=>'phone2','address'=>'address','district'=>'district','notes'=>'notes'] as $field=>$key)$next[$field]=$buyer[$key];
                $lines=[];$total=0;$base=0;$oldLines=[];foreach($old['items'] ?? [] as $item)$oldLines[(string)($item['productId'] ?? $item['id'])]=$item;
                foreach(sale_correction_input_items($data) as $input){$product=null;foreach($state['products'] as $p)if((string)$p['id']===(string)$input['productId']){$product=$p;break;}$prior=$oldLines[(string)$input['productId']] ?? null;if(!$product&&!$prior)ds_fail('A selected product no longer exists.');$price=ds_amount($input['price']);$camy=ds_amount($input['camyPrice'] ?? null,'CAMY unit value');$delivery=ds_amount($input['deliveryCost'] ?? 0,'Delivery cost');if($price<$camy)ds_fail('Selling price cannot be below the CAMY value.');$qty=(int)$input['qty'];$line=$prior ?? ['id'=>$product['id'],'productId'=>$product['id'],'name'=>$product['name'],'code'=>$product['code'],'image'=>$product['image'] ?? ''];$line=array_merge($line,['qty'=>$qty,'price'=>$price,'camyPrice'=>$camy,'deliveryCost'=>$delivery]);$lines[]=$line;$total+=($price+$delivery)*$qty;$base+=($camy+$delivery)*$qty;}
                $next['items']=$lines;$next['qty']=array_sum(array_column($lines,'qty'));$next['product']=count($lines)===1?$lines[0]['name']:count($lines).' CAMY products';$next['amount']=ds_amount(round($total,2),'Sale total');$next['camyCost']=round($base,2);$next['entrepreneurMargin']=round($total-$base,2);$next['payoutAmount']=$next['entrepreneurMargin'];$next['updatedAt']=ds_now();$next['corrections'][]=['by'=>$actor['id'],'at'=>ds_now(),'reason'=>$reason,'previousAmount'=>$old['amount']];
                sale_correction_cod_stock($state,$old,$lines);$state['orders'][$index]=$next;
                // A paid commission is a real transfer. Retain its amount; a changed
                // commission is flagged for finance reconciliation, never silently repaid.
                $payout=($ledger['payout_status'] ?? '')==='paid'&&abs((float)($ledger['payout_amount'] ?? 0)-$next['entrepreneurMargin'])>0.009?'reversal_required':($ledger['payout_status'] ?? $old['payoutStatus'] ?? 'pending_delivery');
                if(!in_array($payout,['paid','reversal_required'],true))$payout=in_array($old['status'],['Cancelled','Returned','Rejected'],true)?'cancelled':($next['entrepreneurMargin']>0?($old['status']==='Delivered'?'pending_transfer':'pending_delivery'):'cancelled');
                $pdo->prepare('UPDATE entrepreneur_payouts SET client_total=?,camy_cost=?,payout_amount=IF(payout_status IN (\'paid\',\'reversal_required\'),payout_amount,?),payout_status=? WHERE order_id=?')->execute([$next['amount'],$next['camyCost'],$next['entrepreneurMargin'],$payout,$id]);$state['orders'][$index]['payoutStatus']=$payout;if(in_array($payout,['paid','reversal_required'],true))$state['orders'][$index]['payoutAmount']=(float)($ledger['payout_amount'] ?? 0);
            }
            sale_correction_recalculate_member($state,(string)$old['entrepreneurId']);
        }
        market_save($pdo,$state);$pdo->commit();
        // File deletion follows a successful database commit. No active row can
        // reference these sale-specific documents once the sale has been removed.
        foreach(array_unique($files) as $file){$name=basename((string)$file);if($name&&$name===$file)@unlink(private_path('receipts/'.$name));}
        response(['ok'=>true,'message'=>$method==='DELETE'?'Sale permanently deleted from the database and reports.':'Sale correction saved.']);
    }catch(DirectSaleFailure $error){if($pdo->inTransaction())$pdo->rollBack();response(['message'=>$error->getMessage()],$error->status);}
    catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
