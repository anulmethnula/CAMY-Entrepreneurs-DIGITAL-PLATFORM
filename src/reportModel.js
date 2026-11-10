import { directSaleSheets, directFinance, filterDirectSales } from './directSalesModel.js'
// Explicit business columns are shared by the preview and workbook. No raw records are exported.
export const reportTypes = [
 ['direct','Direct Sales','Direct purchases, payments, discounts, fulfilment and separate item/payment ledgers.'],
 ['finance','Finance Summary','COD collections, retained amounts, commission and credit balances.'],
 ['pending','Pending Commission Payouts','Delivered commissions ready for CAMY Finance to transfer.'],
 ['history','Commission Payment History','Commission register, payment dates and transfer references.'],
 ['orders','Orders & Sales','Order summaries and individual product lines, without duplicate totals.'],
 ['credit','Credit & Entrepreneur Accounts','Verified sales, credit balances and settlement details.'],
 ['products','Products & Stock','Catalogue prices, delivery charges and current warehouse stock.'],
]
export const payoutLabels={pending_delivery:'Waiting for Delivery',pending_transfer:'Ready to Pay',paid:'Paid',reversal_required:'Reversal Required',cancelled:'Cancelled',not_required:'No Payout Due'}
export const label=value=>payoutLabels[value]||String(value||'Not recorded').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
export const money=value=>`Rs. ${Number(value||0).toLocaleString('en-LK',{maximumFractionDigits:2})}`
export function dateKey(value){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function dateRange(preset,now=new Date()){
 const today=dateKey(now),[y,m,d]=today.split('-').map(Number),iso=(year,month,day)=>new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)
 if(preset==='today')return [today,today]
 if(preset==='week')return [iso(y,m,d-6),today]
 if(preset==='month')return [iso(y,m,1),iso(y,m+1,0)]
 if(preset==='lastMonth')return [iso(y,m-1,1),iso(y,m,0)]
 if(preset==='year')return [iso(y,1,1),iso(y,12,31)]
 return ['','']
}
const n=value=>Number(value||0),sum=(rows,key)=>rows.reduce((s,r)=>s+n(r[key]),0)
const c=(key,label,type='text')=>({key,label,type})
const C=(key,label)=>c(key,label,'currency'),D=(key,label)=>c(key,label,'date')
const base=[c('id','Order ID'),D('deliveredAt','Delivered Date'),c('entrepreneurId','Member ID'),c('entrepreneur','Entrepreneur')]
export function buildReport(kind,data,filters={}){
 const people=data.entrepreneurs||[],products=data.products||[],settlements=data.settlements||[]
 if(kind==='direct'){const sales=filterDirectSales(data.directSales||[],filters),sheets=directSaleSheets(sales);return {rows:sheets[0].rows,columns:sheets[0].columns,extra:sheets.slice(1),kpis:[['Direct sales',sales.length],['Sale total',money(sales.reduce((n,s)=>n+Number(s.total),0))],['Verified received',money(sales.reduce((n,s)=>n+Number(s.amountReceived),0))],['Balance due',money(sales.reduce((n,s)=>n+Number(s.balance),0))]],orders:[],directSales:sales}}
 const dates=(value)=>{const key=dateKey(value);return (!filters.from&&!filters.to)||!!key&&(!filters.from||key>=filters.from)&&(!filters.to||key<=filters.to)}
 const matches=row=>(!filters.entrepreneur||String(row.entrepreneurId||row.id)===filters.entrepreneur)&&(!filters.search||Object.values(row).filter(v=>typeof v!=='object').join(' ').toLowerCase().includes(filters.search.toLowerCase()))
 const orders=(data.orders||[]).map(order=>{
  const person=people.find(p=>String(p.id)===String(order.entrepreneurId))
  const commission=order.orderMode==='dropship'?n(order.entrepreneurMargin):0
  return {...order,commission,retained:n(order.amount)-commission,products:(order.items||[]).map(i=>`${i.name||'Product'} x ${i.qty}`).join('\n')||order.product||'',payoutLabel:label(order.payoutStatus),bank:person?.bankDetails?.bank||'',branch:person?.bankDetails?.branch||'',holder:person?.bankDetails?.holder||'',account:String(person?.bankDetails?.account||'')}
 })
 const orderDate=o=>kind==='orders'?o.createdAt||o.date:kind==='history'&&o.payoutPaidAt?o.payoutPaidAt:kind==='pending'&&filters.dateBasis==='due'?o.payoutDueAt:o.deliveredAt
 let rows=[],columns=[],extra=[],kpis=[]
 const filteredOrders=orders.filter(o=>matches(o)&&(!filters.status||[o.status,o.payoutStatus].includes(filters.status))&&(!filters.product||(o.items||[]).some(i=>String(i.productId||i.id)===filters.product))&&dates(orderDate(o)))
 if(kind==='pending'||kind==='history'){
  rows=filteredOrders.filter(o=>kind==='pending'?o.status==='Delivered'&&o.payoutStatus==='pending_transfer'&&o.commission>0:o.orderMode==='dropship'&&o.commission>0)
  columns=[...base,...(kind==='pending'?[c('products','Product(s)'),c('customer','Client')]:[]),C('amount','Client COD'),C('retained','CAMY Retained Amount'),C('commission',kind==='pending'?'Commission To Pay':'Commission Amount'),...(kind==='pending'?[D('payoutDueAt','Payout Due Date')]:[D('payoutPaidAt','Paid Date'),c('payoutReference','Payment Reference')]),c('bank','Bank Name'),...(kind==='pending'?[c('branch','Bank Branch')]:[]),c('holder','Account Holder'),c('account','Account Number'),c('payoutLabel','Payout Status')]
  kpis=kind==='pending'?[['Orders Ready',rows.length],['Commission To Pay',money(sum(rows,'commission'))],['Client COD',money(sum(rows,'amount'))],['CAMY Retained Amount',money(sum(rows,'retained'))]]:[['Paid',rows.filter(o=>o.payoutStatus==='paid').length],['Ready to Pay',rows.filter(o=>o.payoutStatus==='pending_transfer').length],['Total Paid',money(sum(rows.filter(o=>o.payoutStatus==='paid'||o.payoutPaidAt),'commission'))],['Total Pending',money(sum(rows.filter(o=>o.payoutStatus==='pending_transfer'),'commission'))]]
 }else if(kind==='orders'){
  const summary=filteredOrders
  rows=summary.flatMap(o=>(o.items?.length?o.items:[{name:o.product,qty:o.qty,price:null}]).map((item,index)=>{const p=products.find(p=>String(p.id)===String(item.productId||item.id));const qty=n(item.qty);return {id:o.id,createdAt:o.createdAt||o.date,entrepreneurId:o.entrepreneurId,entrepreneur:o.entrepreneur,customer:o.customer,phone:String(o.phone||''),district:o.district,address:o.address,source:label(o.source||o.orderMode),code:p?.code||'',product:item.name||p?.name||'',qty,camyPrice:item.camyPrice??null,clientPrice:item.price??null,lineTotal:item.price==null?null:n(item.price)*qty,lineCommission:!data.access?.finance||item.camyPrice==null||item.price==null?null:(n(item.price)-n(item.camyPrice))*qty,status:label(o.status),deliveredAt:o.deliveredAt,returnStatus:o.status==='Returned'?'Returned':'',detailId:o.id,lineKey:`${o.id}-${index}`}}))
  columns=[c('id','Order ID'),D('createdAt','Order Date'),c('entrepreneurId','Member ID'),c('entrepreneur','Entrepreneur'),c('customer','Customer'),c('phone','Customer Phone'),c('district','District'),c('address','Delivery Address'),c('source','Order Source'),c('code','Product Code'),c('product','Product Name'),c('qty','Quantity','number'),C('camyPrice','CAMY Unit Price'),C('clientPrice','Client Unit Price'),C('lineTotal','Client Line Total'),...(data.access?.finance?[C('lineCommission','Line Commission')]:[]),c('status','Order Status'),D('deliveredAt','Delivered Date'),c('returnStatus','Return Status')]
  extra=[{name:'Order Summary',columns:[c('id','Order ID'),D('createdAt','Order Date'),c('customer','Customer'),c('entrepreneurId','Member ID'),C('amount','Full Client COD Total'),...(data.access?.finance?[C('camyCost','Full CAMY Value'),C('commission','Full Commission')]:[]),c('status','Current Status'),D('deliveredAt','Delivered Date')],rows:summary.map(o=>({...o,createdAt:o.createdAt||o.date}))}]
  kpis=[['Total Orders',summary.length],['Delivered',summary.filter(o=>o.status==='Delivered').length],['Returned',summary.filter(o=>o.status==='Returned').length],['COD Total',money(sum(summary,'amount'))]]
 }else if(kind==='credit'){
  rows=people.filter(p=>matches(p)&&(filters.dateBasis==='joined'?dates(p.joined):(!filters.from&&!filters.to)||settlements.some(s=>String(s.entrepreneurId)===String(p.id)&&dates(s.verifiedAt||s.reviewedAt||s.submittedAt||s.createdAt)))).map(p=>{const records=settlements.filter(s=>String(s.entrepreneurId)===String(p.id)&&dates(s.verifiedAt||s.reviewedAt||s.submittedAt||s.createdAt));const verified=records.filter(s=>['Verified','Approved'].includes(s.status));return {...p,status:p.active===false?'Inactive':'Active',available:Math.max(0,n(p.credit)-n(p.used)),pending:sum(records.filter(s=>['Pending','Pending verification','Payment review'].includes(s.status)),'amount'),settled:sum(verified,'amount'),latest:verified.map(s=>s.verifiedAt||s.reviewedAt).filter(Boolean).sort().at(-1)||null,settlements:records}}).filter(p=>(!filters.creditStatus||(filters.creditStatus==='outstanding'?n(p.used)>0:n(p.used)<=0))&&(!filters.status||p.status===filters.status))
  columns=[c('id','Member ID'),c('name','Entrepreneur'),c('status','Account Status'),D('joined','Joined Date'),C('sales','Verified Sales'),C('credit','Credit Limit'),C('used','Outstanding Credit'),C('available','Available Credit'),C('pending','Pending Settlement'),C('settled','Total Settled'),D('latest','Latest Settlement'),c('stage','Credit Stage')]
  extra=[{name:'Settlements',columns:[c('id','Settlement ID'),c('entrepreneurId','Member ID'),C('amount','Amount'),c('status','Status'),D('createdAt','Submitted Date'),D('reviewedAt','Verified Date'),c('reference','Reference')],rows:settlements.filter(s=>rows.some(p=>String(p.id)===String(s.entrepreneurId))&&dates(s.verifiedAt||s.reviewedAt||s.submittedAt||s.createdAt))}]
  kpis=[['Accounts',rows.length],['Credit Limit',money(sum(rows,'credit'))],['Outstanding',money(sum(rows,'used'))],['Available',money(sum(rows,'available'))]]
 }else if(kind==='products'){
  rows=products.map(p=>({...p,status:p.published===false?'Hidden':'Published',free:p.freeDelivery===false?'No':'Yes'})).filter(p=>matches(p)&&(!filters.category||p.category===filters.category)&&(!filters.status||p.status===filters.status)&&(!filters.stock||(filters.stock==='out'?n(p.stock)<=0:filters.stock==='low'?n(p.stock)>0&&n(p.stock)<=5:n(p.stock)>0)))
  columns=[c('code','Product Code'),c('name','Product Name'),c('category','Category'),c('status','Product Status'),C('price','CAMY Product Price'),C('billingPrice','Billing Price'),C('deliveryCost','Delivery Charge'),C('packagingCost','Packaging Cost'),c('free','Free Delivery'),c('stock','Warehouse Stock','number')]
  kpis=[['Products',rows.length],['In Stock',rows.filter(p=>n(p.stock)>0).length],['Low Stock (1-5)',rows.filter(p=>n(p.stock)>0&&n(p.stock)<=5).length],['Out of Stock',rows.filter(p=>n(p.stock)<=0).length]]
  extra=[{name:'Direct Stock Movements',columns:[c('saleId','Direct Sale ID'),D('at','Movement Date'),c('code','Product Code'),c('name','Product Name'),c('qty','Quantity','number'),c('type','Movement Type'),c('stockBefore','Available Before','number'),c('stockAfter','Available After','number'),c('availabilityDelta','Availability Change','number'),c('by','Processed By')],rows:(data.directStockMovements||[]).filter(m=>dates(m.at)&&(!filters.search||`${m.saleId} ${m.code} ${m.name}`.toLowerCase().includes(filters.search.toLowerCase())))}]
 }else{
  const delivered=orders.filter(o=>o.status==='Delivered'&&matches(o)&&dates(o.deliveredAt));const returned=orders.filter(o=>o.status==='Returned'&&matches(o)&&dates(o.statusHistory?.filter(h=>h.status==='Returned').at(-1)?.at));const paid=orders.filter(o=>(o.payoutStatus==='paid'||o.payoutPaidAt)&&matches(o)&&dates(o.payoutPaidAt));const pending=delivered.filter(o=>o.payoutStatus==='pending_transfer');
  rows=[['Client COD collected',sum(delivered.filter(o=>o.clientPaymentStatus==='Collected by CAMY'),'amount')],['CAMY Retained Amount',sum(delivered.filter(o=>o.clientPaymentStatus==='Collected by CAMY'),'retained')],['Entrepreneur commissions earned',sum(delivered,'commission')],['Commission paid',sum(paid,'commission')],['Commission waiting to pay',sum(pending,'commission')],['Credit outstanding (current)',data.access?.credit?sum(people.filter(matches),'used'):null],['Delivered order value',sum(delivered,'amount')],['Returned order value',sum(returned,'amount')],['Delivered order count',delivered.length],['Returned order count',returned.length]].map(([metric,value])=>({metric,amount:metric.endsWith('count')?null:value,count:metric.endsWith('count')?value:null}))
  columns=[c('metric','Metric'),C('amount','Amount (LKR)'),c('count','Order Count','number')];kpis=rows.slice(0,4).map(r=>[r.metric,money(r.amount)])
 }
 if(kind==='finance'&&data.access?.directFinance){extra=[{name:'Direct Sales Finance',columns:[c('metric','Direct Sales Metric'),C('amount','Amount (LKR)'),c('count','Sale Count','number')],rows:directFinance(data.directSales||[],dates).map(([metric,value,type])=>({metric,amount:type==='count'?null:value,count:type==='count'?value:null}))}]}
 return {rows,columns,extra,kpis,orders}
}
