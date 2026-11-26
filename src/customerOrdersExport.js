import { dateKey, dateRange, label } from './reportModel.js'
import { downloadWorkbook } from './reports.js'

const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const round = value => value == null ? null : Math.round((value + Number.EPSILON) * 100) / 100
const text = value => value == null ? '' : String(value)
const column = (key, title, type = 'text') => ({ key, label: title, type })
const currency = (key, title) => column(key, title, 'currency')
const date = (key, title) => column(key, title, 'date')
const numeric = (key, title) => column(key, title, 'number')
const hasValue = value => value !== '' && value != null
const optional = (rows, columns) => columns.filter(c => rows.some(row => hasValue(row[c.key])))
const sumKnown = (rows, key) => rows.every(row => number(row[key]) != null) ? round(rows.reduce((total, row) => total + row[key], 0)) : null
const recordedItems = order => Array.isArray(order.items) ? order.items.filter(item => item && typeof item === 'object') : []

export const customerOrderDate = order => dateKey(order.date || order.createdAt)
export function customerOrderDateRange(preset, now = new Date()) {
  const [from, to] = dateRange(preset, now)
  return [from, preset === 'month' ? dateKey(now) : to]
}

// The directory uses this selector once; the exporter receives its exact result,
// including its ordering, and never refilters or fetches a different record set.
export function filterCustomerOrders(orders, { status = 'All', search = '', from = '', to = '' } = {}) {
  const query = search.trim().toLowerCase()
  return orders.filter(order => {
    const matchesStatus = status === 'All'
      || (status === 'In progress' && !['Delivered', 'Returned', 'Rejected', 'Cancelled'].includes(order.status))
      || (status === 'Payouts pending' && ['pending_delivery', 'pending_transfer'].includes(order.payoutStatus))
      || order.status === status
    const day = customerOrderDate(order)
    const searchable = [order.id, order.invoiceNumber, order.customer, order.phone, order.phone2, order.entrepreneurId, order.entrepreneur, order.product,
      ...recordedItems(order).flatMap(item => [item.name, item.code, item.productCode])].filter(hasValue).join(' ').toLowerCase()
    return matchesStatus && (!from || day >= from) && (!to || (!!day && day <= to)) && searchable.includes(query)
  }).sort((a, b) => (Date.parse(b.createdAt || b.date || '') || 0) - (Date.parse(a.createdAt || a.date || '') || 0)
    || Number(text(b.id).match(/(\d+)$/)?.[1] || 0) - Number(text(a.id).match(/(\d+)$/)?.[1] || 0))
}

function productDescription(item, products) {
  const recordedCode = item.code || item.productCode
  const itemId = item.productId ?? item.id
  const product = products.find(p => (itemId != null && text(p.id) === text(itemId)) || (recordedCode && text(p.code) === text(recordedCode)))
  return {
    code: text(recordedCode || product?.code),
    name: text(item.name || item.productName || product?.name),
    category: text(item.category || product?.category),
  }
}

export function customerOrdersWorkbook(visibleOrders, products = [], filters = {}, generatedAt = new Date()) {
  const summary = [], lines = []
  for (const order of visibleOrders) {
    const items = recordedItems(order)
    const descriptions = items.map(item => productDescription(item, products))
    const quantities = items.map(item => ({ qty: number(item.qty) }))
    const units = items.length ? sumKnown(quantities, 'qty') : number(order.qty)
    summary.push({
      id: text(order.id), orderDate: customerOrderDate(order) || null, status: label(order.status),
      entrepreneurId: text(order.entrepreneurId), entrepreneur: text(order.entrepreneur), customer: text(order.customer),
      phone: text(order.phone), phone2: text(order.phone2), district: text(order.district), address: text(order.address),
      source: [order.source ? label(order.source) : '', text(order.createdBy)].filter(Boolean).join(' - '),
      productTypes: items.length ? new Set(items.map((item, i) => text(item.productId ?? item.id ?? item.code ?? item.productCode ?? descriptions[i].name) || `line-${i}`)).size : null,
      units, products: items.length ? items.map((item, i) => `${descriptions[i].name || 'Name not recorded'}${number(item.qty) == null ? '' : ` \u00d7 ${number(item.qty)}`}`).join('\n') : text(order.product),
      clientCod: number(order.amount), camyValue: number(order.camyCost), commission: number(order.entrepreneurMargin),
      courier: text(order.courier), tracking: text(order.trackingNumber), deliveredAt: dateKey(order.deliveredAt) || null,
      payoutStatus: order.payoutStatus ? label(order.payoutStatus) : '', payoutDueAt: dateKey(order.payoutDueAt) || null,
      payoutPaidAt: dateKey(order.payoutPaidAt) || null, payoutReference: text(order.payoutReference),
      returnStatus: order.return?.status ? label(order.return.status) : order.status === 'Returned' ? 'Returned' : '',
    })
    items.forEach((item, index) => {
      // Prices and delivery charges come ONLY from the historical order line.
      // A missing CAMY price is unknown, never the catalogue's current price.
      const qty = number(item.qty), clientPrice = number(item.price), camyPrice = number(item.camyPrice)
      lines.push({ id: text(order.id), orderDate: customerOrderDate(order) || null,
        entrepreneurId: text(order.entrepreneurId), entrepreneur: text(order.entrepreneur), customer: text(order.customer),
        ...descriptions[index], qty, camyPrice, clientPrice,
        lineTotal: qty == null || clientPrice == null ? null : round(qty * clientPrice),
        lineCommission: qty == null || clientPrice == null || camyPrice == null ? null : round((clientPrice - camyPrice) * qty),
        deliveryCharge: number(item.deliveryCost), status: label(order.status), deliveredAt: dateKey(order.deliveredAt) || null,
      })
    })
  }
  const range = filters.from || filters.to ? `${filters.from || 'Beginning'} to ${filters.to || 'Present'}` : 'All Dates'
  const generated = generatedAt.toLocaleString('en-LK', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' })
  const metadata = `Order date: ${range} | Status: ${filters.status || 'All'} | Search: ${filters.search?.trim() || 'None'} | Generated: ${generated} (Asia/Colombo)`
  const orderColumns = [column('id', 'Order ID'), date('orderDate', 'Order Date'), column('status', 'Current Status'),
    column('entrepreneurId', 'Entrepreneur Member ID'), column('entrepreneur', 'Entrepreneur Name'), column('customer', 'Customer Name'),
    column('phone', 'Primary Phone'), ...optional(summary, [column('phone2', 'Alternative Phone')]), column('district', 'District'),
    column('address', 'Delivery Address'), column('source', 'Order Source'), numeric('productTypes', 'Number of Product Types'),
    numeric('units', 'Total Units'), column('products', 'Products'), currency('clientCod', 'Client COD Total'),
    ...optional(summary, [currency('camyValue', 'CAMY Order Value'), currency('commission', 'Entrepreneur Commission')]),
    column('courier', 'Courier'), column('tracking', 'Tracking Number'), date('deliveredAt', 'Delivered Date'),
    ...optional(summary, [column('payoutStatus', 'Commission / Payout Status'), date('payoutDueAt', 'Payout Due Date'),
      date('payoutPaidAt', 'Payout Paid Date'), column('payoutReference', 'Payout Reference'), column('returnStatus', 'Return Status')])]
  const itemColumns = [column('id', 'Order ID'), date('orderDate', 'Order Date'), column('entrepreneurId', 'Entrepreneur Member ID'),
    column('entrepreneur', 'Entrepreneur Name'), column('customer', 'Customer Name'), column('code', 'Product Code'), column('name', 'Product Name'),
    ...optional(lines, [column('category', 'Category')]), numeric('qty', 'Quantity'), currency('camyPrice', 'CAMY Unit Price'),
    currency('clientPrice', 'Client Unit Price'), currency('lineTotal', 'Client Line Total'), currency('lineCommission', 'Entrepreneur Line Commission'),
    ...optional(lines, [currency('deliveryCharge', 'Delivery Charge Per Unit')]), column('status', 'Order Status'), date('deliveredAt', 'Delivered Date')]
  const totals = [
    { metric: 'Total Orders', count: summary.length },
    { metric: 'Total Units', count: sumKnown(summary, 'units') },
    { metric: 'Delivered Orders', count: visibleOrders.filter(o => o.status === 'Delivered').length },
    { metric: 'Returned Orders', count: visibleOrders.filter(o => o.status === 'Returned').length },
    { metric: 'Cancelled Orders', count: visibleOrders.filter(o => o.status === 'Cancelled').length },
    { metric: 'Client COD Total (all exported order statuses)', amount: sumKnown(summary, 'clientCod') },
    { metric: 'Entrepreneur Commission (recorded order values)', amount: sumKnown(summary, 'commission') },
    { metric: 'Delivered Order Value Only', amount: sumKnown(summary.filter(o => o.status === 'Delivered'), 'clientCod') },
    { metric: 'Delivered Entrepreneur Commission Only', amount: sumKnown(summary.filter(o => o.status === 'Delivered'), 'commission') },
    { metric: 'Orders Without Recorded Item Lines', count: visibleOrders.filter(o => !recordedItems(o).length).length },
  ]
  const sheets = [
    { name: 'Order Summary', title: 'CAMY Customer Orders - Order Summary', columns: orderColumns, rows: summary },
    { name: 'Order Items', title: 'CAMY Customer Orders - Order Items', columns: itemColumns, rows: lines },
    { name: 'Export Summary', title: 'CAMY Customer Orders - Export Summary', columns: [column('metric', 'Metric'), numeric('count', 'Count / Units'), currency('amount', 'Amount (LKR)')], rows: totals },
  ].map(sheet => ({ ...sheet, subtitle: metadata, currency: 'LKR', showTotals: false }))
  const suffix = filters.from || filters.to ? `${filters.from || 'Beginning'}-to-${filters.to || 'Present'}` : `All-${dateKey(generatedAt)}`
  return { filename: `CAMY-Customer-Orders-${suffix}.xlsx`, sheets, generatedAt }
}

export function downloadCustomerOrders(visibleOrders, products, filters) {
  const { filename, sheets, generatedAt } = customerOrdersWorkbook(visibleOrders, products, filters)
  downloadWorkbook(filename, sheets, generatedAt)
}
