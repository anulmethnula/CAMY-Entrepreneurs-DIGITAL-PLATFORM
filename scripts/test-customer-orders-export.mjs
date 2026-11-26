import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {mkdir,writeFile} from 'node:fs/promises'
import {customerOrdersWorkbook,filterCustomerOrders,customerOrderDateRange} from '../src/customerOrdersExport.js'
import {createWorkbook} from '../src/reports.js'

// Isolated regression fixtures; never seeded into CAMY application data.
const now=new Date('2026-10-23T07:00:00Z')
const products=Array.from({length:5},(_,i)=>({id:i+1,code:`P-${i+1}`,name:`Current name ${i+1}`,category:'Current Category',price:99999,billingPrice:99999}))
const items=count=>Array.from({length:count},(_,i)=>({productId:i+1,name:`Historical product ${i+1}`,category:'Recorded Category',qty:i+1,price:100+i*10,camyPrice:80+i*10,deliveryCost:i===0?25:0}))
const order=(id,status,date,count)=>{const lines=items(count),commission=lines.reduce((s,i)=>s+(i.price-i.camyPrice)*i.qty,0),amount=lines.reduce((s,i)=>s+(i.price+i.deliveryCost)*i.qty,0);return {id,status,date,createdAt:date+'T08:00:00Z',customer:'Anul',phone:'0770000001',phone2:'0710000002',entrepreneurId:'CE-001',entrepreneur:'Seller',district:'Colombo',address:'Very long address '.repeat(15),source:'shop',items:lines,product:count+' CAMY products',amount,camyCost:amount-commission,entrepreneurMargin:commission,trackingNumber:'00192345678',courier:'Courier',deliveredAt:status==='Delivered'?date+'T12:00:00Z':null,payoutStatus:status==='Delivered'?'pending_transfer':'pending_delivery',payoutReference:'000012345678901234567890',trackingToken:'DO-NOT-EXPORT',password_hash:'DO-NOT-EXPORT',record_json:'DO-NOT-EXPORT',permissions_json:'DO-NOT-EXPORT',receipt:'data:image/png;base64,DO-NOT-EXPORT'}}
const orders=[order('CMY-1001','Delivered','2026-10-23',1),order('CMY-1002','Processing','2026-10-22',2),order('CMY-1003','Returned','2026-10-18',5),order('CMY-1004','Cancelled','2026-09-01',1)]
for(const status of ['Delivered','Processing','Returned','Cancelled'])assert.equal(filterCustomerOrders(orders,{status}).length,1)
for(const [preset,count] of [['all',4],['today',1],['week',3],['month',3]]){const [from,to]=customerOrderDateRange(preset,now);assert.equal(filterCustomerOrders(orders,{from,to}).length,count)}
assert.equal(filterCustomerOrders(orders,{from:'2026-10-18',to:'2026-10-22'}).length,2)
assert.equal(filterCustomerOrders(orders,{search:'Historical product 5'}).length,1)
assert.equal(filterCustomerOrders(orders,{search:'CE-001'}).length,4)
assert.equal(filterCustomerOrders(orders,{search:'Anul',status:'Delivered',from:'2026-10-01',to:'2026-10-31'}).length,1)
const selected=filterCustomerOrders(orders,{search:'Anul',from:'2026-10-01',to:'2026-10-31'})
const result=customerOrdersWorkbook(selected,products,{search:'Anul',from:'2026-10-01',to:'2026-10-31',status:'All'},now)
const [summary,lines,totals]=result.sheets
assert.deepEqual(summary.rows.map(r=>r.id),selected.map(o=>o.id));assert.equal(summary.rows.length,3);assert.equal(lines.rows.length,8)
assert.equal(summary.rows[2].productTypes,5);assert.equal(summary.rows[2].units,15)
assert(summary.rows[2].products.includes('Historical product 5'));assert(summary.rows[2].products.includes('\n'))
assert.equal(lines.rows[0].qty,1);assert.equal(lines.rows[0].clientPrice,100);assert.equal(lines.rows[0].camyPrice,80);assert.equal(lines.rows[0].lineTotal,100);assert.equal(lines.rows[0].lineCommission,20);assert.equal(lines.rows[0].code,'P-1');assert.equal(lines.rows[0].category,'Recorded Category')
assert.equal(summary.rows[0].clientCod,125);assert.equal(summary.rows[0].commission,20);assert.equal(lines.rows[0].deliveryCharge,25)
assert(!lines.columns.some(c=>['clientCod','camyValue','commission'].includes(c.key)))
assert.equal(totals.rows.find(r=>r.metric==='Delivered Order Value Only').amount,125)
assert.equal(totals.rows.find(r=>r.metric==='Total Units').count,19)
assert.equal(result.filename,'CAMY-Customer-Orders-2026-10-01-to-2026-10-31.xlsx')
assert.equal(customerOrdersWorkbook([],products,{},now).filename,'CAMY-Customer-Orders-All-2026-10-23.xlsx')
const missing=structuredClone(orders[0]);delete missing.items[0].camyPrice;delete missing.items[0].price;delete missing.items[0].deliveryCost
const unknown=customerOrdersWorkbook([missing],products,{},now).sheets[1];assert.equal(unknown.rows[0].camyPrice,null);assert.equal(unknown.rows[0].clientPrice,null);assert.equal(unknown.rows[0].lineCommission,null);assert(!unknown.columns.some(c=>c.key==='deliveryCharge'))
const noItems={id:'OLD',date:'2026-10-01',product:'3 CAMY products',qty:3,status:'Returned'};const legacy=customerOrdersWorkbook([noItems],products,{},now);assert.equal(legacy.sheets[1].rows.length,0);assert.equal(legacy.sheets[2].rows.at(-1).count,1)
const bytes=createWorkbook(result.sheets,now),xml=new TextDecoder().decode(bytes)
assert(!xml.includes('DO-NOT-EXPORT'));assert(!xml.includes('<f>'));assert(xml.includes('frozen'));assert(xml.includes('autoFilter'));assert(xml.includes('Asia/Colombo'))
const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes)
assert.deepEqual(workbook.worksheets.map(s=>s.name),['Order Summary','Order Items','Export Summary'])
const ws=workbook.getWorksheet('Order Summary'),col=key=>summary.columns.findIndex(c=>c.key===key)+1
assert(ws.getCell(5,col('clientCod')).numFmt.includes('LKR'));assert.equal(ws.getCell(5,col('tracking')).value,'00192345678');assert.equal(ws.getCell(5,col('phone')).value,'0770000001');assert.equal(ws.getCell(5,col('payoutReference')).value,'000012345678901234567890')
assert(ws.getCell(5,col('orderDate')).value instanceof Date);assert.equal(ws.views[0].state,'frozen');assert(ws.autoFilter);assert(ws.getRow(7).height>80);assert(ws.getCell(7,col('products')).alignment.wrapText)
const itemSheet=workbook.getWorksheet('Order Items');assert.equal(typeof itemSheet.getCell(5,lines.columns.findIndex(c=>c.key==='qty')+1).value,'number')
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/customer-orders-export-test.xlsx',bytes)
console.log('PASS: all/status/date/search/combined filters; 1/2/5 product lines; recorded prices, quantities, delivery, commission; safe totals; identifiers; secrets excluded; XLSX opens, dates, frozen headers, filters and wrapping.')
