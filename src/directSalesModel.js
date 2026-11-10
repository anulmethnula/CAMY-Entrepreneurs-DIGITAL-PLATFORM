import { downloadWorkbook } from './reports.js'
export const dsMoney = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const dsToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
export function directLine(product, input) {
  const billing = Number(product.billingPrice ?? product.price ?? 0), delivery = Number(product.deliveryCost || 0), packaging = Number(product.packagingCost || 0)
  const catalogue = round(Number(product.price || 0) + (product.freeDelivery === false ? delivery : 0))
  const mode = input.pricingMethod === 'discount' ? input.baseMode : input.pricingMethod
  let base = mode === 'catalogue' ? catalogue - delivery - packaging : mode === 'billing' ? billing : Number(input.customPrice || 0)
  base = round(base + (input.includeDelivery ? Number(input.deliveryCharge ?? delivery) : 0) + (input.includePackaging ? Number(input.packagingCharge ?? packaging) : 0))
  const discount = input.discountType === 'fixed' ? Number(input.discountValue || 0) : input.discountType === 'percent' ? round(base * Number(input.discountValue || 0) / 100) : 0
  const final = round(base - discount)
  return { baseUnitPrice: base, discountPerUnit: discount, finalUnitPrice: final, lineTotal: round(final * Number(input.qty || 0)), catalogueUnitPrice: catalogue }
}
export const newDirectItem = (p, delivery = false) => ({ productId: p.id, qty: 1, pricingMethod: 'catalogue', baseMode: 'catalogue', customPrice: '', discountType: 'none', discountValue: 0, includeDelivery: delivery, includePackaging: true, deliveryCharge: p.deliveryCost || 0, packagingCharge: p.packagingCost || 0, priceReason: '' })
const c = (key, label, type = 'text') => ({ key, label, type }), C = (key, label) => c(key, label, 'currency')
export const directSummaryColumns = [c('id','Direct Sale ID'),c('saleDate','Sale Date','date'),c('customerType','Customer Type'),c('entrepreneurId','Member ID'),c('customer','Customer Name'),c('phone','Phone'),c('products','Products'),c('qty','Total Quantity','number'),C('catalogueTotal','Original Catalogue Total'),C('originalTotal','Base Price Total'),C('discountTotal','Discount Total'),C('total','Final Sale Total'),C('amountReceived','Verified Amount Received'),C('refundTotal','Refunds'),C('balance','Balance Due'),c('paymentMethod','Payment Method'),c('paymentStatus','Payment Status'),c('fulfilmentStatus','Fulfilment Status'),c('createdByName','Created By')]
export const directSummary = sales => sales.map(s => ({ ...s, catalogueTotal:s.catalogueTotal??s.items.reduce((n,i)=>n+Number(i.catalogueUnitPrice||0)*Number(i.qty||0),0), customer: s.buyer.name, phone: s.buyer.phone, products: s.items.map(i => `${i.name} x ${i.qty}`).join('\n') }))
export function directSaleSheets(sales) { return [
  { name: 'Direct Sale Summary', columns: directSummaryColumns, rows: directSummary(sales) },
  { name: 'Direct Sale Items', columns: [c('saleId','Sale ID'),c('saleDate','Sale Date','date'),c('code','Product Code'),c('name','Product Name'),c('qty','Quantity','number'),C('catalogueUnitPrice','Original Catalogue Unit'),C('baseUnitPrice','Base Unit Price'),C('discountPerUnit','Discount per Unit'),C('finalUnitPrice','Final Unit Price'),C('lineTotal','Line Total'),C('deliveryCharge','Delivery per Unit'),C('packagingCharge','Packaging per Unit'),c('pricingMethod','Pricing Method'),c('priceReason','Price Reason')], rows: sales.flatMap(s => s.items.map(i => ({ ...i, saleId: s.id, saleDate: s.saleDate }))) },
  { name: 'Direct Sale Payments', columns: [c('saleId','Sale ID'),c('id','Payment ID'),c('date','Payment Date','date'),c('method','Method'),C('amount','Payment Amount'),C('tendered','Tendered'),C('change','Change'),c('status','Verification Status'),c('reference','Reference'),c('verifiedBy','Verified By'),c('verifiedAt','Verified Date','date'),c('receipt','Authorized Receipt Reference')], rows: sales.flatMap(s => s.payments.map(p => ({ ...p, saleId: s.id, receipt: p.receipts?.at(-1)?.receipt || '' }))) },
  { name: 'Direct Sale Refunds', columns: [c('saleId','Sale ID'),c('date','Refund Date','date'),C('amount','Refund Amount'),c('method','Method'),c('reference','Reference'),c('reason','Reason'),c('by','Recorded By')], rows: sales.flatMap(s => (s.refunds || []).map(r => ({ ...r, saleId: s.id }))) }
] }
export const downloadDirectSales = sales => downloadWorkbook('CAMY-Direct-Sales.xlsx', directSaleSheets(sales).map(s => ({ ...s, title: `CAMY - ${s.name}`, showTotals: false })))
export function directFinance(sales, within = () => true) {
  const payments = sales.flatMap(s => s.payments.filter(p => p.status === 'Verified' && within(p.date)))
  const sum = list => round(list.reduce((a, p) => a + Number(p.amount), 0)), refunds = sales.flatMap(s => (s.refunds || []).filter(r => within(r.date)))
  const active = sales.filter(s => within(s.saleDate) && s.businessStatus !== 'Draft' && !['Cancelled','Returned'].includes(s.fulfilmentStatus))
  return [['Direct sales count', sales.filter(s => within(s.saleDate)).length, 'count'], ['Direct cash received', sum(payments.filter(p => p.method === 'cash'))], ['Direct verified bank transfers', sum(payments.filter(p => p.method === 'bank'))], ['Direct awaiting balance', round(active.reduce((a,s) => a + Number(s.balance),0))], ['Direct discounts', round(active.reduce((a,s) => a + Number(s.discountTotal),0))], ['Direct refunds paid', sum(refunds)], ['Direct net cash received', round(sum(payments) - sum(refunds))], ['Direct released sale revenue', round(sales.filter(s => s.releasedAt && within(s.releasedAt)).reduce((a,s) => a + Number(s.total),0) - sales.filter(s=>s.returnedAt&&within(s.returnedAt)).reduce((a,s)=>a+Number(s.total),0))], ['Direct returned sale count', sales.filter(s => s.returnedAt && within(s.returnedAt)).length, 'count']]
}
export function filterDirectSales(sales, f = {}) { return sales.filter(s => {
  const text = `${s.id} ${s.entrepreneurId} ${s.buyer.name} ${s.buyer.phone} ${s.buyer.phone2||''} ${s.items.map(i => i.name+' '+i.code).join(' ')}`.toLowerCase()
  return (!f.search || text.includes(f.search.toLowerCase())) && (!f.from || s.saleDate >= f.from) && (!f.to || s.saleDate <= f.to) && (!f.customerType || s.customerType === f.customerType) && (!f.entrepreneur || s.entrepreneurId === f.entrepreneur) && (!f.paymentMethod || s.payments.some(p => p.method === f.paymentMethod)) && (!f.paymentStatus || s.paymentStatus === f.paymentStatus) && (!f.fulfilmentStatus || s.fulfilmentStatus === f.fulfilmentStatus)
}) }
export const directPaymentStatuses = ['Awaiting Payment','Verification Pending','Partially Paid','Paid','Rejected','Partially Refunded','Refunded']
export const directFulfilmentStatuses = ['Not released','Handed Over','Dispatched','Completed','Cancelled','Returned']
