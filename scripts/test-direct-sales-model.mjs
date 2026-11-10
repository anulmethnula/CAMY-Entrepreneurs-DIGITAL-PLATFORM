import assert from 'node:assert/strict'
import {directLine,newDirectItem,directSaleSheets,directFinance,filterDirectSales} from '../src/directSalesModel.js'
import {buildReport} from '../src/reportModel.js'
import {createWorkbook} from '../src/reports.js'
const product={id:1,code:'00123',name:'QA <Product>',price:3290,billingPrice:2590,deliveryCost:550,packagingCost:150,freeDelivery:true}
let item=newDirectItem(product,false)
assert.equal(directLine(product,item).finalUnitPrice,2740,'Collection must omit delivery exactly once')
item.includeDelivery=true;assert.equal(directLine(product,item).finalUnitPrice,3290,'Catalogue services must not double charge')
item={...item,pricingMethod:'discount',baseMode:'billing',includeDelivery:false,includePackaging:false,discountType:'fixed',discountValue:190,qty:2}
for(let i=0;i<10;i++)assert.equal(directLine(product,item).lineTotal,4800,'Discount compounded on recomputation')
item.discountType='percent';item.discountValue=10;assert.equal(directLine(product,item).finalUnitPrice,2331)
item={...item,pricingMethod:'custom',customPrice:2400,discountType:'none',includeDelivery:true,deliveryCharge:200};assert.equal(directLine(product,item).finalUnitPrice,2600)
const ac={...product,price:2740,freeDelivery:false};assert.equal(directLine(ac,newDirectItem(ac,true)).finalUnitPrice,3290)
const line={...directLine(product,{...newDirectItem(product),pricingMethod:'billing',includePackaging:false,qty:2}),productId:1,code:'00123',name:'=HYPERLINK("invalid")',qty:2,pricingMethod:'billing'}
const sale={id:'DS-QA',saleDate:'2026-11-10',customerType:'entrepreneur',entrepreneurId:'E1',buyer:{name:'QA Buyer',phone:'0771234567'},businessStatus:'Confirmed',fulfilmentStatus:'Completed',releasedAt:'2026-11-10T10:00:00+05:30',items:[line],qty:2,originalTotal:5180,discountTotal:0,total:5180,balance:0,amountReceived:5180,refundTotal:0,paymentStatus:'Paid',paymentMethod:'cash',payments:[{id:'PAY-1',method:'cash',amount:5180,status:'Verified',date:'2026-11-10',reference:'000123'}],refunds:[],createdByName:'QA Admin'}
const pending={...sale,id:'DS-PENDING',fulfilmentStatus:'Not released',releasedAt:null,paymentMethod:'bank',paymentStatus:'Verification Pending',amountReceived:0,balance:5180,payments:[{id:'PAY-2',method:'bank',amount:5180,status:'Verification Pending',date:'2026-11-10'}]}
const cancelled={...sale,id:'DS-CANCELLED',releasedAt:null,fulfilmentStatus:'Cancelled',refunds:[{amount:5180,date:'2026-11-10',method:'cash'}]}
const metrics=Object.fromEntries(directFinance([sale,pending,cancelled]).map(([k,v])=>[k,v]))
assert.equal(metrics['Direct verified bank transfers'],0)
assert.equal(metrics['Direct released sale revenue'],5180,'A pre-handover cancellation refund must not reverse unrelated sale revenue')
assert.equal(metrics['Direct cash received'],10360)
assert.equal(metrics['Direct net cash received'],5180)
assert.equal(metrics['Direct awaiting balance'],5180)
const returned={...sale,id:'DS-RETURNED',fulfilmentStatus:'Returned',returnedAt:'2026-11-10T11:00:00+05:30',refunds:[]}
assert.equal(Object.fromEntries(directFinance([returned]).map(([k,v])=>[k,v]))['Direct released sale revenue'],0,'Physical return must reverse revenue even before cash refund')
const sheets=directSaleSheets([sale,pending]);assert.equal(sheets[0].rows.length,2);assert.equal(sheets[1].rows.length,2);assert.equal(sheets[2].rows.length,2);assert(!sheets[1].columns.some(c=>c.key==='total'||c.key==='amountReceived'))
assert.equal(filterDirectSales([sale,pending],{paymentStatus:'Verification Pending'}).length,1)
assert.equal(filterDirectSales([sale,pending],{search:'0771234567',from:'2026-11-10',to:'2026-11-10'}).length,2)
const data={orders:[],entrepreneurs:[],products:[],settlements:[],directSales:[sale,pending],directStockMovements:[{saleId:sale.id,type:'Direct Sale - Outgoing',at:'2026-11-10',qty:2}],access:{finance:true,directSales:true,directFinance:true}}
assert.equal(buildReport('pending',data).rows.length,0);assert.equal(buildReport('credit',data).rows.length,0);assert.equal(buildReport('orders',data).rows.length,0)
const direct=buildReport('direct',data);assert.equal(direct.rows.length,2);assert.equal(direct.extra.length,3)
assert.equal(buildReport('finance',data).extra[0].rows.find(r=>r.metric==='Direct verified bank transfers').amount,0)
assert.equal(buildReport('products',data).extra[0].rows.length,1)
const workbook=createWorkbook(sheets.map(s=>({...s,showTotals:false}))),xml=new TextDecoder().decode(workbook)
assert.equal(new DataView(workbook.buffer).getUint32(0,true),0x04034b50);assert(!xml.includes('<f>'));assert(xml.includes('0771234567'));assert(xml.includes('00123'));assert(xml.includes('Direct Sale Payments'))
console.log('PASS: non-compounding pricing, catalogue service de-duplication, negotiated prices, financial cash/revenue/return separation, unverified bank exclusion, report filters, no COD/credit/commission pollution, XLSX row grains and safe identifiers/formula text.')
