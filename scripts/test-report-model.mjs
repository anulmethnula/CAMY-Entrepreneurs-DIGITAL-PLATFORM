import assert from 'node:assert/strict'
import {buildReport,dateRange,dateKey} from '../src/reportModel.js'
import {createWorkbook,zip} from '../src/reports.js'
// Isolated test records, never seeded into application data.
const data={access:{finance:true,credit:true},entrepreneurs:[{id:'E1',name:'Test',credit:100,used:150,joined:'2026-10-01',bankDetails:{account:'0000123'}}],products:[{id:1,code:'P1',name:'Product',stock:0}],settlements:[],orders:[{id:'O1',createdAt:'2026-10-01',deliveredAt:'2026-10-20',status:'Delivered',orderMode:'dropship',entrepreneurId:'E1',amount:500,camyCost:300,entrepreneurMargin:200,payoutStatus:'pending_transfer',clientPaymentStatus:'Collected by CAMY',items:[{id:1,name:'A',qty:1,price:200,camyPrice:100},{id:2,name:'B',qty:2,price:150,camyPrice:100}]},{id:'O2',createdAt:'2026-09-01',deliveredAt:'2026-09-03',payoutPaidAt:'2026-10-22',status:'Delivered',orderMode:'dropship',amount:100,entrepreneurMargin:20,payoutStatus:'paid',items:[]}]}
const pending=buildReport('pending',data);assert.equal(pending.rows.length,1);assert.equal(pending.rows[0].commission,200);assert.equal(pending.rows[0].account,'0000123');assert(pending.rows[0].products.includes('B x 2'))
const sales=buildReport('orders',data,{status:'Delivered',entrepreneur:'E1'});assert.equal(sales.rows.length,2);assert.equal(sales.extra[0].rows.length,1);assert(!sales.columns.some(c=>c.key==='amount'));assert.equal(sales.rows.reduce((s,r)=>s+r.lineCommission,0),200)
assert.equal(buildReport('pending',data,{from:'2026-10-19',to:'2026-10-21'}).rows.length,1)
assert.equal(buildReport('pending',data,{from:'2026-10-19',to:'2026-10-21',dateBasis:'due'}).rows.length,0)
assert.equal(buildReport('history',data,{status:'paid',from:'2026-10-21',to:'2026-10-23'}).rows.length,1)
assert.equal(buildReport('orders',data,{search:'missing'}).rows.length,0)
assert.equal(buildReport('credit',data).rows[0].available,0)
assert.deepEqual(dateRange('lastMonth',new Date('2026-01-03T12:00:00Z')),['2025-12-01','2025-12-31'])
assert.deepEqual(dateRange('month',new Date('2026-10-23T12:00:00Z')),['2026-10-01','2026-10-31'])
assert.deepEqual(dateRange('week',new Date('2026-10-03T12:00:00Z')),['2026-09-27','2026-10-03'])
assert.equal(dateKey('2026-10-22T20:00:00Z'),'2026-10-23')
const book=createWorkbook([{name:'Pending',title:'CAMY',subtitle:'From 2026-10-01 | Delivered',columns:pending.columns,rows:pending.rows,showTotals:false}]);const xml=new TextDecoder().decode(book);assert(xml.includes('0000123'));assert(xml.includes('From 2026-10-01'));assert(!xml.includes('<f>'))
const bytes=new Uint8Array([0,255,137,80,78,71]);const archive=zip({'original.png':bytes});assert.deepEqual([...archive.slice(42,48)],[...bytes])
const reversed=structuredClone(data);reversed.orders[1].payoutStatus='reversal_required';reversed.orders[1].status='Returned';assert.equal(buildReport('finance',reversed,{from:'2026-10-21',to:'2026-10-23'}).rows.find(r=>r.metric==='Commission paid').amount,20);
console.log('PASS: date boundaries, Colombo timezone, payout eligibility, multi-product totals, text accounts, empty filters, credit clamp, export metadata and binary ZIP bytes.')
