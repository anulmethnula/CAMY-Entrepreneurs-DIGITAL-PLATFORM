<?php
declare(strict_types=1);
require __DIR__.'/../../api/staff.php';
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
check(staff_is_viewer(['role'=>'manager','access_role'=>'Viewer']), 'Viewer must be read-only');
check(!staff_is_viewer(['role'=>'admin','access_role'=>'Super Admin']), 'Admin must retain write access');
check(!staff_is_viewer(['role'=>'manager','access_role'=>'Operations']), 'Existing staff roles must retain write access');
foreach(['/admin/users','/marketplace/catalog','/marketplace/orders/ORD-1','/admin/product-media','/direct-sales','/customer/orders','/unknown-route'] as $path){
    check(staff_viewer_request_allowed($path,'GET'), 'Viewer reads must be allowed');
    foreach(['POST','PATCH','DELETE','PUT'] as $method)check(!staff_viewer_request_allowed($path,$method), "$method $path must be blocked");
}
foreach(['/auth/logout','/auth/change-password'] as $path){
    check(staff_viewer_request_allowed($path,'POST'), 'Viewer must be able to manage their own session');
    check(!staff_viewer_request_allowed($path,'PATCH'), 'Auth exception must use exact method');
}
check(!staff_viewer_request_allowed('/auth/change-password/other','POST'), 'Auth exception must use exact path');
$permissions=staff_templates()['Viewer'];
check(in_array('reports',$permissions,true), 'Viewer must be able to read reports');
check(!in_array('user-access',$permissions,true), 'Viewer cannot manage accounts');
check(!in_array('direct-sales-finance',$permissions,true), 'Viewer cannot perform finance operations');
echo "Viewer authorization checks passed.\n";
