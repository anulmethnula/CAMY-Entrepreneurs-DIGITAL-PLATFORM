<?php
declare(strict_types=1);
function response(array $data,int $status=200): never {throw new RuntimeException($data['message'] ?? '',$status);}
require __DIR__.'/../api/workflow.php';
function check(bool $condition,string $label): void {if(!$condition)throw new RuntimeException($label);}
function blocked(callable $fn,int $code): void {try{$fn();}catch(RuntimeException $e){check($e->getCode()===$code,'Unexpected rejection: '.$e->getMessage());return;}throw new RuntimeException('Invalid action was accepted.');}
workflow_transition('Pending','Awaiting payment',false);
blocked(fn()=>workflow_transition('Pending','Dispatched',false),409);
blocked(fn()=>workflow_transition('Awaiting payment','Processing',false),409);
workflow_transition('Payment review','Processing',false);
workflow_transition('Payment review','Awaiting payment',false);
workflow_transition('Processing','Dispatched',false);
blocked(fn()=>workflow_transition('Rejected','Awaiting payment',false),409);
workflow_transition('Pending','Approved',true);
blocked(fn()=>workflow_transition('Pending','Dispatched',true),409);
workflow_transition('Approved','Dispatched',true);
workflow_transition('Approved','Rejected',true);
blocked(fn()=>workflow_transition('Dispatched','Rejected',true),409);
$state=['products'=>[['id'=>1,'stock'=>5]],'inventory'=>[['entrepreneurId'=>'CE-1','productId'=>1,'qty'=>4]]];
$items=workflow_items([['productId'=>1,'qty'=>2],['productId'=>1,'qty'=>1]]);check(count($items)===1&&$items[0]['qty']===3,'Duplicate items must merge.');
workflow_reserve($state,$items,null);check($state['products'][0]['stock']===2,'Approval must reserve stock.');
blocked(function()use(&$state,$items){workflow_reserve($state,$items,null);},409);
workflow_release($state,$items,null);check($state['products'][0]['stock']===5,'Cancellation must release warehouse stock.');
workflow_reserve($state,[['id'=>1,'qty'=>3]],'CE-1');check($state['inventory'][0]['qty']===1,'Shop stock reserved.');
workflow_release($state,[['id'=>1,'qty'=>3]],'CE-1');check($state['inventory'][0]['qty']===4,'Shop stock restored.');
blocked(fn()=>workflow_items([['productId'=>1,'qty'=>1.5]]),422);
blocked(fn()=>workflow_bank_required([]),422);
blocked(fn()=>workflow_owner(['role'=>'entrepreneur','member_id'=>'CE-2'],'CE-1'),403);
blocked(fn()=>workflow_receipt(['reference'=>'test','receipt'=>'data:application/pdf;base64,'.base64_encode('fake')],'TEST'),422);
echo "Workflow checks passed: stage gates, stock reservation/release, duplicate items, ownership, bank details and invalid receipts.\n";
