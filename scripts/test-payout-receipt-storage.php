<?php
require __DIR__.'/../api/payout_upload.php';
$root=__DIR__.'/../.artifacts/receipt-store-'.bin2hex(random_bytes(5));mkdir($root,0700,true);
try{
    $source=$root.'/staged.part';$destination=$root.'/receipt.jpg';file_put_contents($source,str_repeat('receipt',1000000));
    payout_upload_store($source,$destination);
    if(hash_file('sha256',$source)!==hash_file('sha256',$destination)||!is_file($source))throw new RuntimeException('Verified copy or staged retry failed');
    try{payout_upload_store($source,$destination);throw new RuntimeException('Existing proof overwritten');}catch(PayoutUploadFailure $error){if(!str_contains($error->getMessage(),'RU-DEST'))throw $error;}
    try{payout_upload_store($source,$root.'/missing/receipt.jpg');throw new RuntimeException('Unwritable destination accepted');}catch(PayoutUploadFailure $error){if(!str_contains($error->getMessage(),'RU-DEST'))throw $error;}
    echo "PASS: verified storage without rename, staged source retained, existing proof protected, destination write failure distinguished.\n";
}finally{foreach(glob($root.'/*') as $file)unlink($file);rmdir($root);}
