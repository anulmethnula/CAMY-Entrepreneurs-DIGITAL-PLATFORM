import { filterCustomerOrders } from './customerOrdersExport.js'

const num = v => Number(v || 0)
const text = v => String(v ?? '')
export function codCommission(order) {
  if(order.payoutStatus==='paid')return {label:'Paid',tone:'success',detail:'Commission transferred'}
  if(order.payoutStatus==='reversal_required')return {label:'Review required',tone:'danger',detail:'Commission reconciliation'}
  if(order.payoutStatus==='not_required')return {label:'No payout due',tone:'neutral',detail:'No commission due'}
  if(order.payoutStatus==='cancelled'||['Cancelled','Rejected','Returned'].includes(order.status))return {label:'Cancelled',tone:'neutral',detail:'No commission payable'}
  return {label:'Not paid',tone:'warning',detail:order.payoutStatus==='pending_transfer'?'Ready for transfer':'After delivery'}
}
export function salesWorkflow(row) {
  if(row.kind==='direct')return {label:'Direct sale',tone:'direct',detail:'Cash / bank purchase',payment:{label:row.paymentStatus,tone:row.paymentStatus==='Paid'?'success':['Rejected','Refunded','Partially Refunded'].includes(row.paymentStatus)?'neutral':'warning',detail:row.paymentMethod==='bank'?'Bank transfer':row.paymentMethod==='cash'?'Cash':row.paymentMethod}}
  const status=row.original.status||'Pending'
  return {label:status,tone:status==='Delivered'?'success':status==='Dispatched'?'info':['Pending','Awaiting approval','Awaiting payment','Payment review'].includes(status)?'warning':['Returned','Cancelled','Rejected'].includes(status)?'danger':'info',detail:({Pending:'Awaiting approval',Processing:'Approved / preparing',Dispatched:'On the way',Delivered:'Delivery complete',Returned:'Returned to CAMY',Rejected:'Order rejected',Cancelled:'Order cancelled'})[status]||'COD order',payment:codCommission(row.original)}
}
export function salesRows(orders = [], directSales = []) {
  return [
    ...orders.map(o => ({kind:'cod',type:o.createdBy==='CAMY Admin'||o.createdByUserId?'assisted':'dropship',id:o.id,date:text(o.date||o.createdAt).slice(0,10),createdAt:o.createdAt,customer:o.customer,phone:o.phone,phone2:o.phone2,seller:o.entrepreneur,member:o.entrepreneurId,customerType:'entrepreneur',address:o.address,district:o.district,items:o.items||[],qty:o.qty??(o.items||[]).reduce((n,i)=>n+num(i.qty),0),total:num(o.amount),paymentMethod:o.clientPaymentMethod||'cod',paymentStatus:codCommission(o).label,status:o.status,original:o})),
    ...directSales.map(s => ({kind:'direct',type:'direct',id:s.id,date:text(s.saleDate).slice(0,10),createdAt:s.createdAt,customer:s.buyer?.name,phone:s.buyer?.phone,phone2:s.buyer?.phone2,seller:s.customerType==='entrepreneur'?s.buyer?.name:'Walk-in customer',member:s.entrepreneurId,customerType:s.customerType,address:s.buyer?.address,district:s.buyer?.district,items:s.items||[],qty:s.qty,total:num(s.total),paymentMethod:s.paymentMethod||s.preferredPaymentMethod||'cash',paymentStatus:s.paymentStatus,status:s.businessStatus==='Draft'?'Draft':s.fulfilmentStatus,original:s})),
  ].sort((a,b)=>b.date.localeCompare(a.date)||text(b.createdAt).localeCompare(text(a.createdAt))||b.id.localeCompare(a.id))
}
export function filterSales(rows, f = {}) {
  const query=text(f.search).trim().toLowerCase()
  return rows.filter(r=>{
    if(f.type&&f.type!=='all'&&r.type!==f.type)return false
    if(f.from&&r.date<f.from||f.to&&(!r.date||r.date>f.to))return false
    if(f.customerType&&r.customerType!==f.customerType)return false
    if(f.paymentMethod&&!text(r.paymentMethod).split(' / ').includes(f.paymentMethod))return false
    if(f.paymentStatus&&r.paymentStatus!==f.paymentStatus)return false
    if(f.status&&f.status!=='All'){
      if(r.kind==='cod'){if(!filterCustomerOrders([r.original],{status:f.status}).length)return false}
      else if(f.status==='In progress'){if(['Completed','Returned','Cancelled'].includes(r.status))return false}
      else if(r.status!==f.status)return false
    }
    return [r.id,r.original.invoiceNumber,r.customer,r.phone,r.phone2,r.seller,r.member,r.address,r.district,...r.items.flatMap(i=>[i.name,i.code,i.productCode])].map(text).join(' ').toLowerCase().includes(query)
  })
}
export function salesSummarySheet(rows) {
  const column=(key,label,type='text')=>({key,label,type})
  return {name:'All Sales',title:'CAMY - All Sales',showTotals:false,columns:[column('id','Sale ID'),column('date','Sale Date','date'),column('type','Sale Type'),column('customer','Customer'),column('phone','Phone'),column('member','Member ID'),column('seller','Entrepreneur / Buyer'),column('products','Products'),column('qty','Quantity','number'),column('total','Sale Total','currency'),column('paymentMethod','Payment Method'),column('paymentStatus','Payment / Commission'),column('status','Fulfilment')],rows:rows.map(r=>({...r,type:({direct:'Direct sale',assisted:'Assisted COD',dropship:'COD dropship'})[r.type],products:r.items.map(i=>`${i.name} x ${i.qty}`).join('\n')}))}
}
