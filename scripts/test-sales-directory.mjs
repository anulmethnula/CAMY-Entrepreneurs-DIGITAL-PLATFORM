import assert from 'node:assert/strict'
import { salesRows, filterSales, salesSummarySheet, codCommission, salesWorkflow } from '../src/salesDirectoryModel.js'
const orders=[{id:'CMY-1',date:'2026-11-10',customer:'COD Client',phone:'0771234567',entrepreneurId:'E1',entrepreneur:'Partner',items:[{name:'Pan',qty:1,price:100}],amount:100,status:'Delivered',payoutStatus:'paid',clientPaymentMethod:'cod',qty:1},{id:'CMY-2',date:'2026-11-11',customer:'Assisted Client',createdBy:'CAMY Admin',status:'Processing',amount:200}]
const direct=[{id:'DS-1',saleDate:'2026-11-12',customerType:'other',buyer:{name:'Walk-in buyer',phone:'0712345678'},items:[{name:'Kettle',code:'K1',qty:2}],qty:2,total:300,paymentMethod:'cash',paymentStatus:'Paid',fulfilmentStatus:'Handed Over'},{id:'DS-2',saleDate:'2026-11-09',customerType:'entrepreneur',entrepreneurId:'E2',buyer:{name:'Member buyer'},items:[],qty:0,total:10,paymentMethod:'bank',paymentStatus:'Verification Pending',businessStatus:'Draft',fulfilmentStatus:'Not released'}]
const rows=salesRows(orders,direct)
assert.equal(rows.length,4);assert.equal(rows[0].id,'DS-1')
assert.equal(filterSales(rows,{type:'direct'}).length,2)
assert.equal(filterSales(rows,{type:'assisted'})[0].id,'CMY-2')
assert.equal(filterSales(rows,{search:'  k1  '})[0].id,'DS-1')
assert.equal(filterSales(rows,{from:'2026-11-10',to:'2026-11-11'}).length,2)
assert.equal(filterSales(rows,{paymentMethod:'cash',paymentStatus:'Paid'})[0].id,'DS-1')
assert.equal(filterSales(rows,{paymentStatus:'Paid'}).length,2)
assert.equal(filterSales(rows,{customerType:'other'}).length,1)
assert.equal(filterSales(rows,{status:'In progress'}).length,3)
assert.equal(filterSales(rows,{status:'Delivered'}).length,1)
assert.equal(filterSales(rows,{status:'Draft'})[0].id,'DS-2')
assert.equal(filterSales(rows,{paymentMethod:'bank',from:'2026-11-10'}).length,0)
assert.equal(salesSummarySheet(filterSales(rows,{paymentStatus:'Paid'})).rows.length,2)
assert.equal(rows[0].original,direct[0])
console.log('PASS: mixed sorting, sale type, search, date, customer, payment and fulfilment filters; export matches filtered rows.')

assert.equal(codCommission({status:'Delivered',payoutStatus:'pending_transfer'}).label,'Not paid')
assert.equal(codCommission({status:'Delivered',payoutStatus:'paid'}).label,'Paid')
assert.equal(codCommission({status:'Pending'}).detail,'After delivery')
assert.equal(salesWorkflow(salesRows([{id:'WAIT',status:'Pending'}],[])[0]).detail,'Awaiting approval')
assert.equal(salesWorkflow(rows.find(r=>r.kind==='direct')).label,'Direct sale')
assert.equal(filterSales(rows,{paymentStatus:'Not paid'}).length,1)
