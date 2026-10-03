<?php
declare(strict_types=1);

function catalogue_demo_data(): array {
    $legacy=json_decode((string)file_get_contents(__DIR__.'/../database/demo_catalog.json'),true,64,JSON_THROW_ON_ERROR);
    $rows=json_decode((string)file_get_contents(__DIR__.'/../database/camy_price_list.json'),true,64,JSON_THROW_ON_ERROR);
    $categoryNames=['AC'=>'Air Conditioners','COOK WARE'=>'Cookware','TV'=>'Televisions','NATIONAL MIXER GRINDER'=>'Mixer Grinders','MIXER GRINDER-CAMY'=>'Mixer Grinders','CAMY MIXER GRINDER NEW'=>'Mixer Grinders'];
    $products=[];
    foreach($rows as $index=>$row){
        $airConditioner=$row['category']==='AC';$article=(string)$row['article'];
        $category=$categoryNames[$row['category']] ?? ucwords(strtolower((string)$row['category']));
        $name=ucwords(strtolower($article));$name=preg_replace('/\bBtu\b/i','BTU',$name);
        $slug=trim((string)preg_replace('/[^A-Z0-9]+/','-',strtoupper($article)),'-');
        $prefix=$airConditioner?'AC':substr((string)preg_replace('/[^A-Z0-9]/','',strtoupper((string)$row['category'])),0,5);
        $image='/products/classic-set.png';
        if($row['category']==='WALL CLOCK')$image='/products/wall-clock.png';
        elseif($row['category']==='HELMET')$image='/products/helmet.png';
        elseif($airConditioner)$image='/products/air-conditioner.png';
        elseif($row['category']==='FAN')$image='/products/stand-fan.png';
        elseif($row['category']==='GAS COOKER')$image='/products/gas-cooker.png';
        elseif($row['category']==='TV')$image='/products/smart-tv.png';
        elseif($row['category']==='WATER FILTER')$image='/products/water-filter.png';
        elseif($row['category']==='MINI FRIDGE')$image='/products/mini-fridge.jpeg';
        elseif($row['category']==='DOUBLE DOOR FRIDGE')$image='/products/double-door-fridge.jpeg';
        elseif($row['category']==='PRESSURE COOKER')$image='/products/pressure-cooker.png';
        elseif($row['category']==='KETTLE')$image='/products/kettle.png';
        elseif($row['category']==='COOK WARE'){
            if(str_contains($article,'HOPPER'))$image='/products/hopper-pan.png';elseif(str_contains($article,'FRY PAN'))$image='/products/frypan-range.png';elseif(str_contains($article,'CASSEROLE'))$image='/products/casserole.png';elseif(str_contains($article,'SET'))$image='/products/cookware-set.png';
        }
        $billing=round((float)$row['rrp'],2);$delivery=round((float)$row['delivery'],2);$packaging=round((float)$row['packaging'],2);
        $products[]=['id'=>$index+1,'name'=>$name,'category'=>$category,'price'=>$airConditioner?$billing:round($billing+$delivery+$packaging,2),'billingPrice'=>$billing,'deliveryCost'=>$delivery,'packagingCost'=>$packaging,'freeDelivery'=>!$airConditioner,'deliveryChargeVisible'=>$airConditioner,'image'=>$image,'tag'=>'','stock'=>0,'code'=>$prefix.'-'.$slug.'-'.str_pad((string)($index+1),3,'0',STR_PAD_LEFT),'rating'=>5,'warranty'=>'Ask CAMY','description'=>$airConditioner?'Air conditioner supplied without installation. Delivery is charged separately.':'CAMY quality product available for entrepreneur sales.','specs'=>[(string)($row['remarks'] ?: 'CAMY quality assured')],'published'=>true];
    }
    return ['products'=>$products,'tiers'=>$legacy['tiers'] ?? []];
}

function catalogue_products(array $products): array {
    $ids=[];$codes=[];$clean=[];
    if(count($products)>1000)response(['message'=>'A catalogue can contain up to 1,000 products.'],422);
    foreach($products as $product){
        if(!is_array($product))response(['message'=>'Invalid product record.'],422);
        $id=(string)($product['id'] ?? '');$code=trim((string)($product['code'] ?? ''));$name=trim((string)($product['name'] ?? ''));$category=trim((string)($product['category'] ?? ''));
        $price=filter_var($product['price'] ?? null,FILTER_VALIDATE_FLOAT);$stock=filter_var($product['stock'] ?? null,FILTER_VALIDATE_INT);
        if(!$id||strlen($id)>40||!$code||strlen($code)>60||!$name||strlen($name)>190||!$category||strlen($category)>100||$price===false||!is_finite($price)||$price<=0||$price>100000000||$stock===false||$stock<0||$stock>1000000)response(['message'=>'Each product needs a unique code, name, category, positive price and whole stock quantity.'],422);
        if(isset($ids[$id])||isset($codes[strtolower($code)]))response(['message'=>'Product IDs and codes must be unique.'],422);
        $ids[$id]=true;$codes[strtolower($code)]=true;
        $image=(string)($product['image'] ?? '');
        if($image&&!preg_match('#^(?:https://|/[^/]|data:image/(?:jpeg|png|webp);base64,)#',$image))response(['message'=>'Use a valid product image.'],422);
        if(strlen($image)>2800000||strlen((string)($product['description'] ?? ''))>10000)response(['message'=>'Product image or description is too large.'],422);
        if(array_key_exists('billingPrice',$product)||array_key_exists('deliveryCost',$product)||array_key_exists('packagingCost',$product)){
            $billing=filter_var($product['billingPrice'] ?? null,FILTER_VALIDATE_FLOAT);$delivery=filter_var($product['deliveryCost'] ?? 0,FILTER_VALIDATE_FLOAT);$packaging=filter_var($product['packagingCost'] ?? 0,FILTER_VALIDATE_FLOAT);
            if($billing===false||$delivery===false||$packaging===false||!is_finite($billing)||!is_finite($delivery)||!is_finite($packaging)||$billing<0||$delivery<0||$packaging<0)response(['message'=>'Product billing, delivery and packaging costs must be valid nonnegative amounts.'],422);
            $product['billingPrice']=round((float)$billing,2);$product['deliveryCost']=round((float)$delivery,2);$product['packagingCost']=round((float)$packaging,2);$product['freeDelivery']=($product['freeDelivery'] ?? true)===true;$price=round($billing+$packaging+($product['freeDelivery']?$delivery:0),2);
        }
        $product['code']=$code;$product['name']=$name;$product['category']=$category;$product['price']=round($price,2);$product['stock']=$stock;$product['published']=($product['published'] ?? true)===true;
        if(isset($product['media'])){
            if(!is_array($product['media'])||count($product['media'])>12)response(['message'=>'Use up to 12 media files per product.'],422);
            foreach($product['media'] as $entry){
                if(!is_array($entry)||!in_array($entry['type']??'', ['image','video'],true))response(['message'=>'Invalid product media.'],422);
                $src=(string)($entry['src']??'');
                if(($entry['type']==='video'&&!preg_match('#^/api/product-media/[a-f0-9]{32}\.(mp4|webm)$#',$src))||($entry['type']==='image'&&(!preg_match('#^(?:https://|/[^/]|data:image/(?:jpeg|png|webp);base64,)#',$src)||strlen($src)>2800000)))response(['message'=>'Invalid product media address.'],422);
                if(str_starts_with($src,'/api/product-media/')&&!is_file(__DIR__.'/../private/product-media/'.basename($src)))response(['message'=>'An uploaded media file is missing. Upload it again.'],422);
            }
        }
        $clean[]=$product;
    }
    return $clean;
}
function catalogue_tiers(array $tiers): array {
    $clean=[];$seen=[];
    foreach($tiers as $index=>$tier){
        if(!is_array($tier))response(['message'=>'Invalid credit tier.'],422);
        $sales=filter_var($tier['sales'] ?? null,FILTER_VALIDATE_FLOAT);$credit=filter_var($tier['credit'] ?? null,FILTER_VALIDATE_FLOAT);
        if($sales===false||$credit===false||!is_finite($sales)||!is_finite($credit)||$sales<0||$credit<0||$sales>1000000000||$credit>100000000)response(['message'=>'Credit tiers need valid nonnegative sales and credit amounts.'],422);
        $sales=round($sales,2);if(isset($seen[(string)$sales]))response(['message'=>'Each tier must have a different sales requirement.'],422);$seen[(string)$sales]=true;
        $clean[]=['id'=>(string)($tier['id'] ?? 'tier-'.$index),'sales'=>$sales,'credit'=>round($credit,2),'name'=>(string)($tier['name'] ?? 'Tier '.($index+1))];
    }
    usort($clean,static fn($a,$b)=>$a['sales']<=>$b['sales']);return $clean;
}
function catalogue_credit_progression(array $tiers, float $sales): array {
    // The saved admin tiers are the complete policy; do not invent tiers above them.
    $sales=max(0.0,$sales);$credit=0.0;$nextSales=null;$nextCredit=null;
    usort($tiers,static fn($a,$b)=>(float)($a['sales']??0)<=>(float)($b['sales']??0));
    foreach($tiers as $tier){
        $required=max(0.0,(float)($tier['sales']??0));
        if($sales+0.00001>=$required)$credit=max(0.0,(float)($tier['credit']??0));
        else{$nextSales=$required;$nextCredit=max(0.0,(float)($tier['credit']??0));break;}
    }
    return ['credit'=>$credit,'nextSales'=>$nextSales,'nextCredit'=>$nextCredit];
}
function catalogue_credit_for_sales(array $tiers, float $sales): float {
    return round((float)catalogue_credit_progression($tiers, $sales)['credit'], 2);
}
function catalogue_order_sales_value(array $order): float {
    // Credit tiers are earned from the products' actual client selling value,
    // not from the entrepreneur's profit and not from delivery charges.
    if(!empty($order['items'])&&is_array($order['items'])){
        $value=0.0;
        foreach($order['items'] as $item)$value+=max(0.0,(float)($item['price']??0))*max(0,(int)($item['qty']??0));
        return round($value,2);
    }
    // Historical records may not contain line items. Their stored order total is
    // the safest available selling-value snapshot.
    return max(0.0,round((float)($order['amount']??0),2));
}
function catalogue_credit(array &$state): void {
    foreach($state['entrepreneurs'] as &$person){
        $sales=0;foreach($state['orders'] as $order)if((string)$order['entrepreneurId']===(string)$person['id']&&$order['status']==='Delivered')$sales+=catalogue_order_sales_value($order);
        $credit = catalogue_credit_for_sales($state['tiers'], $sales);
        $person['sales']=round($sales,2);$person['credit']=$credit;
        if(($person['stage'] ?? '')!=='Departed')$person['stage']=$credit>0?'Credit eligible':'Trial seller';
    }unset($person);
}
function catalogue_route(PDO $pdo,string $path,string $method): void {
    if(preg_match('#^/product-media/([a-f0-9]{32}\.(?:jpg|png|webp|mp4|webm))$#',$path,$match)&&$method==='GET'){
        $file=__DIR__.'/../private/product-media/'.$match[1];if(!is_file($file))response(['message'=>'Media not found.'],404);
        $size=filesize($file);$start=0;$end=$size-1;
        if(isset($_SERVER['HTTP_RANGE'])){
            if(!preg_match('/^bytes=(\d*)-(\d*)$/',$_SERVER['HTTP_RANGE'],$range)||($range[1]===''&&$range[2]==='')){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
            if($range[1]==='')$start=max(0,$size-(int)$range[2]);else{$start=(int)$range[1];if($range[2]!=='')$end=min($end,(int)$range[2]);}
            if($start>$end){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
            http_response_code(206);header("Content-Range: bytes $start-$end/$size");
        }
        header('Content-Type: '.['jpg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp','mp4'=>'video/mp4','webm'=>'video/webm'][pathinfo($file,PATHINFO_EXTENSION)]);
        header('Accept-Ranges: bytes');header('Content-Length: '.($end-$start+1));header('Cache-Control: public, max-age=31536000, immutable');session_write_close();
        $stream=fopen($file,'rb');fseek($stream,$start);$remaining=$end-$start+1;while($remaining>0&&!feof($stream)){$chunk=fread($stream,min(65536,$remaining));echo $chunk;$remaining-=strlen($chunk);}fclose($stream);exit;
    }
    if($path==='/admin/product-media'&&$method==='POST'){
        require_admin($pdo);$data=input();$raw=(string)($data['data']??'');
        if(strlen($raw)>14000000||!preg_match('#^data:(image/(?:jpeg|png|webp)|video/(?:mp4|webm));base64,(.+)$#s',$raw,$match))response(['message'=>'Choose a supported image or video up to 10 MB.'],422);
        $bytes=base64_decode($match[2],true);if(!$bytes||strlen($bytes)>10*1024*1024)response(['message'=>'File exceeds 10 MB or is invalid.'],422);
        $info=new finfo(FILEINFO_MIME_TYPE);if($info->buffer($bytes)!==$match[1])response(['message'=>'File content does not match its media type.'],422);
        $extension=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm'][$match[1]];
        $directory=__DIR__.'/../private/product-media';if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('Could not create media storage.');
        $name=bin2hex(random_bytes(16)).'.'.$extension;if(file_put_contents($directory.'/'.$name,$bytes)===false)throw new RuntimeException('Could not save media.');
        response(['media'=>['type'=>str_starts_with($match[1],'image/')?'image':'video','src'=>'/api/product-media/'.$name,'name'=>substr(basename((string)($data['name']??'Media')),0,190)]]);
    }
    if($path==='/admin/credit-settlements' && $method==='POST'){
        $actor=require_admin($pdo);$data=input();$amount=filter_var($data['amount'] ?? null,FILTER_VALIDATE_FLOAT);$reference=trim((string)($data['reference'] ?? ''));$member=(string)($data['memberId'] ?? '');$requestId=trim((string)($data['requestId']??''));
        if($amount===false||!is_finite($amount)||$amount<=0||!$reference||strlen($reference)>100||!$requestId)response(['message'=>'Choose a credit order and enter its full payment amount and reference.'],422);
        $pdo->beginTransaction();$state=market_state($pdo,true);$index=null;
        foreach($state['entrepreneurs'] as $key=>$person)if((string)$person['id']===$member){$index=$key;break;}
        if($index===null)response(['message'=>'Entrepreneur not found.'],404);
        $requestIndex=null;foreach($state['requests']??[] as $key=>$request)if((string)($request['id']??'')===$requestId){$requestIndex=$key;break;}
        if($requestIndex===null||(string)($state['requests'][$requestIndex]['entrepreneurId']??'')!==$member||($state['requests'][$requestIndex]['creditMode']??false)!==true||($state['requests'][$requestIndex]['status']??'')!=='Dispatched')response(['message'=>'Choose an unpaid dispatched credit order for this entrepreneur.'],422);
        $request=$state['requests'][$requestIndex];if(($request['creditRepaymentStatus']??'')==='Paid')response(['message'=>'This credit order has already been paid.'],409);
        foreach($state['settlements']??[] as $entry)if((string)($entry['requestId']??'')===$requestId&&($entry['status']??'')!=='Rejected')response(['message'=>'This credit order already has a recorded payment.'],409);
        $required=round((float)($request['creditIssuedAmount']??$request['total']??0),2);if(abs((float)$amount-$required)>0.009)response(['message'=>'Record the full credit-order payment of Rs. '.number_format($required,2,'.',',').'.'],422);
        if($required>(float)($state['entrepreneurs'][$index]['used'] ?? 0)+0.009)response(['message'=>'The outstanding balance changed. Review this order before recording payment.'],409);
        foreach($state['settlements'] as $entry)if((string)$entry['entrepreneurId']===$member && $entry['reference']===$reference && $entry['status']!=='Rejected')response(['message'=>'This payment reference has already been recorded or is awaiting verification.'],409);
        $amount=$required;$state['entrepreneurs'][$index]['used']=max(0,round((float)$state['entrepreneurs'][$index]['used']-$amount,2));
        $settlementId='SET-'.bin2hex(random_bytes(5));$state['settlements'][]=['id'=>$settlementId,'requestId'=>$requestId,'entrepreneurId'=>$member,'amount'=>$amount,'reference'=>$reference,'method'=>'cash','collectionStatus'=>'collected','status'=>'Verified','recordedBy'=>$actor['id'],'createdAt'=>date(DATE_ATOM),'reviewedAt'=>date(DATE_ATOM)];
        $state['requests'][$requestIndex]['creditRepaymentStatus']='Paid';$state['requests'][$requestIndex]['creditPaidAt']=date(DATE_ATOM);$state['requests'][$requestIndex]['creditSettlementId']=$settlementId;
        market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
    }
    if($path!=='/admin/credit-tiers'||$method!=='POST')return;
    require_admin($pdo);$data=input();$tiers=catalogue_tiers($data['tiers'] ?? []);
    $pdo->beginTransaction();$state=market_state($pdo,true);$state['tiers']=$tiers;catalogue_credit($state);market_save($pdo,$state);$pdo->commit();response(['state'=>$state]);
}
