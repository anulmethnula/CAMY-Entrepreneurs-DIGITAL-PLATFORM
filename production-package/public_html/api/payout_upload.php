<?php
declare(strict_types=1);

final class PayoutUploadFailure extends RuntimeException {
    public function __construct(string $message,public int $httpStatus=422){parent::__construct($message);}
}
function payout_upload_admin(PDO $pdo): array {
    $user=require_admin($pdo);
    if(($user['role'] ?? '')==='manager' && ($user['permissions_json'] ?? null)!==null && !in_array('payouts',json_decode($user['permissions_json'],true) ?: [],true))throw new PayoutUploadFailure('Your staff role does not allow payout receipts.',403);
    return $user;
}
function payout_upload_eligible(PDO $pdo,string $orderId): void {
    $query=$pdo->prepare('SELECT s.status,s.record_json,p.payout_status,p.payout_amount FROM shop_orders s JOIN entrepreneur_payouts p ON p.order_id=s.id WHERE s.id=?');$query->execute([$orderId]);$row=$query->fetch();
    if(!$row)throw new PayoutUploadFailure('Payout record not found.',404);
    $order=json_decode($row['record_json'] ?? '{}',true) ?: [];
    if(($order['orderMode'] ?? '')!=='dropship'||$row['status']!=='Delivered')throw new PayoutUploadFailure('This order is not ready for a commission payment.',409);
    if($row['payout_status']==='paid')throw new PayoutUploadFailure('This entrepreneur payout is already recorded as paid.',409);
    if((float)$row['payout_amount']<=0)throw new PayoutUploadFailure('No entrepreneur commission is due for this order.',409);
}
function payout_upload_directory(): string {
    $directory=private_path('payout-uploads');
    if(!is_dir($directory)&&!@mkdir($directory,0700,true)&&!is_dir($directory))throw new PayoutUploadFailure('Receipt storage is unavailable. Please try again.',503);
    return $directory;
}
function payout_upload_write($handle,array $meta): void {
    $raw=json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE|JSON_THROW_ON_ERROR);rewind($handle);
    if(!@ftruncate($handle,0)||@fwrite($handle,$raw)!==strlen($raw)||!@fflush($handle))throw new PayoutUploadFailure('Receipt upload failed. Please try again.',503);
}
function payout_upload_locked(string $token,string $orderId,array $admin): array {
    if(!preg_match('/^[a-f0-9]{48}$/',$token))throw new PayoutUploadFailure('Receipt upload not found. Please select the receipt again.',404);
    $file=payout_upload_directory().'/'.$token.'.json';$handle=@fopen($file,'r+');
    if(!$handle||!@flock($handle,LOCK_EX)){if(is_resource($handle))fclose($handle);throw new PayoutUploadFailure('Receipt upload not found. Please select the receipt again.',404);}
    $meta=json_decode(stream_get_contents($handle) ?: '{}',true);
    if(!is_array($meta)||($meta['orderId'] ?? '')!==$orderId||(int)($meta['owner'] ?? 0)!==(int)$admin['id']){flock($handle,LOCK_UN);fclose($handle);throw new PayoutUploadFailure('You cannot use this receipt upload.',403);}
    return [$handle,$meta];
}
function payout_upload_close($handle): void {if(is_resource($handle)){flock($handle,LOCK_UN);fclose($handle);}}
function payout_upload_receipt(string $token,string $orderId,array $admin): array {
    [$handle,$meta]=payout_upload_locked($token,$orderId,$admin);
    if(empty($meta['receipt'])||!is_file(private_path('receipts/'.basename($meta['receipt'])))){payout_upload_close($handle);throw new PayoutUploadFailure('Receipt upload is incomplete. Please upload the receipt again.',409);}
    return ['handle'=>$handle,'receipt'=>basename($meta['receipt']),'token'=>$token];
}
// Keep the staged upload intact until the final proof has been written and
// verified. Some shared hosts reject rename() across private storage folders.
function payout_upload_store(string $source,string $destination): void {
    $input=@fopen($source,'rb');
    if(!$input)throw new PayoutUploadFailure('The staged receipt could not be read. Please select the receipt again. (RU-READ)',503);
    $output=@fopen($destination,'x+b');
    if(!$output){fclose($input);throw new PayoutUploadFailure('The final receipt folder is not writable by PHP. Ask your hosting provider to check ownership and write access on the configured private receipts folder. (RU-DEST)',503);}
    try{
        $expected=fstat($input)['size'];
        $written=@stream_copy_to_stream($input,$output);
        if($written!==$expected||!@fflush($output))throw new PayoutUploadFailure('Receipt storage could not complete the file. Check hosting disk quota and write access, then retry. (RU-COPY)',507);
        rewind($input);rewind($output);
        $original=hash_init('sha256');$stored=hash_init('sha256');
        hash_update_stream($original,$input);hash_update_stream($stored,$output);
        if(!hash_equals(hash_final($original),hash_final($stored)))throw new PayoutUploadFailure('Receipt storage verification failed. Please retry. (RU-VERIFY)',503);
    }catch(Throwable $failure){fclose($input);fclose($output);@unlink($destination);throw $failure;}
    fclose($input);fclose($output);
}
function payout_upload_work(PDO $pdo,string $orderId,?string $token,array $data,array $admin): array {
    $types=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','application/pdf'=>'pdf'];
    if($token===null){
        payout_upload_eligible($pdo,$orderId);
        $mime=(string)($data['mime'] ?? '');$size=filter_var($data['size'] ?? null,FILTER_VALIDATE_INT);
        if(!isset($types[$mime]))throw new PayoutUploadFailure('Please upload a JPG, PNG, WebP or PDF receipt.');
        if($size===false||$size<=0)throw new PayoutUploadFailure('The receipt file is empty or could not be read.');
        $directory=payout_upload_directory();$space=false;
        // Shared hosts may disable this optional PHP function. Actual writes
        // still enforce the available storage capacity and return clear failures.
        if(function_exists('disk_free_space')){try{$space=@disk_free_space($directory);}catch(Throwable $ignored){$space=false;}}
        if($space!==false&&$size>$space)throw new PayoutUploadFailure('This receipt is larger than the storage service can process. Please upload another copy.',507);
        $token=bin2hex(random_bytes(24));$file=$directory.'/'.$token.'.json';$handle=@fopen($file,'x+');
        if(!$handle)throw new PayoutUploadFailure('Receipt storage cannot create an upload. Please ask the hosting administrator to check private storage write access. (RU-CREATE)',503);
        try{payout_upload_write($handle,['orderId'=>$orderId,'owner'=>(int)$admin['id'],'size'=>$size,'mime'=>$mime,'name'=>substr(preg_replace('/[\x00-\x1F\x7F]/','',(string)($data['name'] ?? 'Receipt')),0,190),'createdAt'=>date(DATE_ATOM)]);}finally{fclose($handle);}
        return ['uploadId'=>$token,'offset'=>0,'ready'=>false];
    }
    [$handle,$meta]=payout_upload_locked($token,$orderId,$admin);$directory=payout_upload_directory();$part=$directory.'/'.$token.'.part';
    try{
        $action=(string)($data['action'] ?? 'status');
        if($action==='cancel'){
            if(!empty($meta['receipt'])){$check=$pdo->prepare('SELECT 1 FROM entrepreneur_payouts WHERE payout_receipt_path=?');$check->execute([$meta['receipt']]);if(!$check->fetchColumn())@unlink(private_path('receipts/'.basename($meta['receipt'])));}
            @unlink($part);@unlink($directory.'/'.$token.'.json');return ['cancelled'=>true];
        }
        payout_upload_eligible($pdo,$orderId);
        if(!empty($meta['receipt']))return ['uploadId'=>$token,'offset'=>(int)$meta['size'],'ready'=>true];
        clearstatcache(true,$part);$received=is_file($part)?filesize($part):0;
        if($action==='status')return ['uploadId'=>$token,'offset'=>$received,'ready'=>false];
        if($action==='chunk'){
            $offset=filter_var($data['offset'] ?? null,FILTER_VALIDATE_INT);$bytes=base64_decode((string)($data['bytes'] ?? ''),true);
            if($offset===false||$offset<0||$bytes===false||$bytes===''||$offset+strlen($bytes)>(int)$meta['size'])throw new PayoutUploadFailure('The receipt upload was interrupted. Please try again.',409);
            $output=@fopen($part,'c+b');if(!$output)throw new PayoutUploadFailure('Receipt storage cannot write the file. Please ask the hosting administrator to check private storage write access. (RU-WRITE)',503);
            try{
                if($offset<$received){fseek($output,$offset);$existing=fread($output,strlen($bytes));if($offset+strlen($bytes)>$received||!hash_equals(hash('sha256',$bytes),hash('sha256',$existing)))throw new PayoutUploadFailure('The receipt upload changed. Please select the receipt again.',409);}
                elseif($offset!==$received)throw new PayoutUploadFailure('The receipt upload was interrupted. Please try again.',409);
                else{fseek($output,$offset);$written=@fwrite($output,$bytes);if($written!==strlen($bytes)||!@fflush($output)){@ftruncate($output,$offset);throw new PayoutUploadFailure('Receipt storage could not complete the upload. Please try again.',507);}$received+=strlen($bytes);}
            }finally{fclose($output);}
            @touch($directory.'/'.$token.'.json');return ['uploadId'=>$token,'offset'=>$received,'ready'=>false];
        }
        if($action!=='finish')throw new PayoutUploadFailure('Invalid receipt upload action.');
        if($received!==(int)$meta['size'])throw new PayoutUploadFailure('Receipt upload is incomplete. Please try again.',409);
        $mime=$meta['mime'];
        if(str_starts_with($mime,'image/')){$info=@getimagesize($part);if(($info['mime'] ?? '')!==$mime)throw new PayoutUploadFailure('Please upload a valid JPG, PNG, WebP or PDF receipt.');}
        else{$input=fopen($part,'rb');$header=fread($input,5);fclose($input);if($header!=='%PDF-')throw new PayoutUploadFailure('Please upload a valid JPG, PNG, WebP or PDF receipt.');}
        $receipts=private_path('receipts');if(!is_dir($receipts)&&!@mkdir($receipts,0700,true)&&!is_dir($receipts))throw new PayoutUploadFailure('Receipt storage is unavailable. Please try again.',503);
        $filename=substr(preg_replace('/[^a-zA-Z0-9_-]/','_',$orderId),0,64).'-payout-'.bin2hex(random_bytes(8)).'.'.$types[$mime];
        payout_upload_store($part,$receipts.'/'.$filename);
        if(function_exists('chmod'))@chmod($receipts.'/'.$filename,0600);$meta['receipt']=$filename;$meta['uploadedAt']=date(DATE_ATOM);$meta['sha256']=hash_file('sha256',$receipts.'/'.$filename);
        try{payout_upload_write($handle,$meta);}catch(Throwable $failure){@unlink($receipts.'/'.$filename);throw $failure;}
        @unlink($part);
        return ['uploadId'=>$token,'offset'=>$received,'ready'=>true];
    }finally{payout_upload_close($handle);}
}
function payout_upload_route(PDO $pdo,string $path,string $method): void {
    if($method!=='POST'||!preg_match('#^/marketplace/orders/([^/]+)/payout-upload(?:/([a-f0-9]{48}))?$#',$path,$match))return;
    $admin=require_admin($pdo);$data=input();$orderId=$match[1];
    $stage=empty($match[2])?'START':strtoupper((string)($data['action'] ?? 'status'));
    if(!in_array($stage,['START','STATUS','CHUNK','FINISH','CANCEL'],true))$stage='ACTION';
    try{$admin=payout_upload_admin($pdo);$result=payout_upload_work($pdo,$orderId,$match[2] ?? null,$data,$admin);}
    catch(PayoutUploadFailure $failure){error_log('[CAMY payout upload] order='.$orderId.' admin='.$admin['id'].' status='.$failure->httpStatus.' reason='.$failure->getMessage());response(['message'=>$failure->getMessage()],$failure->httpStatus);}
    catch(Throwable $failure){error_log('[CAMY payout upload] order='.$orderId.' admin='.$admin['id'].' stage='.$stage.' exception='.get_class($failure).' code='.$failure->getCode().' reason='.$failure->getMessage());response(['message'=>'Receipt upload failed at '.strtolower($stage).'. Please try again. If it continues, ask the hosting administrator to check the CAMY payout upload log. (RU-'.$stage.')'],503);}
    if(!empty($result['cancelled'])&&!empty($match[2]))@unlink(payout_upload_directory().'/'.$match[2].'.json');
    response($result);
}
