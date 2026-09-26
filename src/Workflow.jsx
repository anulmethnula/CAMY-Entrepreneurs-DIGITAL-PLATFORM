import { OrderReturns } from './OrderReturns'
import { api } from './api'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Phone, Store } from 'lucide-react'
import { ReceiptPreview } from './ReceiptPreview'
import { ProductReviewForm } from './ProductReviews'
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`

const call = (path, data) => api('/marketplace/' + path, data ? { method: 'POST', body: JSON.stringify(data) } : {})

export function BankDetails({ bank }) {
  return bank?.account ? <div className="bank-details"><strong>Bank transfer / deposit details</strong><dl>{[['Bank', bank.bank], ['Branch', bank.branch], ['Account holder', bank.holder], ['Account number', bank.account]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><small>Pay only after your request is approved. Use your order number as the payment reference.</small></div> : <p>Bank details have not been configured yet. Please wait for approval before paying.</p>
}

export function BankEditor({ initial, notify = () => {} }) {
  const [bank, setBank] = useState(initial || { bank: '', branch: '', holder: '', account: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { if (initial) setBank(initial) }, [JSON.stringify(initial)])
  const save = async () => { setBusy(true); try { await call('bank', bank); setMessage('Bank details saved. New approvals use these details.'); notify('Bank details saved.') } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  return <section className="workflow-panel"><h2>Bank account for buyer payments</h2><p>Buyers pay this account outside the platform. Your shop displays these details; approved requests keep a copy of the account to pay.</p><div className="bank-editor">{[['bank', 'Bank'], ['branch', 'Branch'], ['holder', 'Account holder'], ['account', 'Account number']].map(([key, label]) => <label key={key}>{label}<input maxLength={120} value={bank[key] || ''} onChange={event => setBank({ ...bank, [key]: event.target.value })}/></label>)}</div><button className="market-primary" disabled={busy} onClick={save}>Save bank details</button>{message && <p role="status">{message}</p>}</section>
}

export function ShopContactEditor({ initial = '', notify = () => {} }) {
  const [phone, setPhone] = useState(initial || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setPhone(initial || '') }, [initial])
  const save = async event => {
    event.preventDefault()
    if (busy) return
    const cleaned = phone.trim().replace(/[\s-]/g, '')
    setMessage(''); setError('')
    if (!/^(?:\+94|0)7\d{8}$/.test(cleaned)) return setError('Enter a valid Sri Lankan mobile number, such as 0771234567.')
    setBusy(true)
    try { const result = await call('shop-contact', { phone: cleaned }); setPhone(result.phone); setMessage('Phone number saved. Customers can call you from their order details.'); notify('Shop phone number saved.') }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <section className="workflow-panel"><h2>Shop contact number</h2><p>Add the mobile number customers should use for order, delivery and return questions. This also updates the phone number in your profile.</p><form onSubmit={save}><label>Seller phone number<input type="tel" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="0771234567" value={phone} disabled={busy} onChange={event => { setPhone(event.target.value); setMessage(''); setError('') }}/></label><button className="market-primary" disabled={busy || !phone.trim()}>{busy ? 'Saving...' : 'Save phone number'}</button></form>{message && <p role="status">{message}</p>}{error && <p className="market-error" role="alert">{error}</p>}</section>
}

export function ReceiptUpload({ order, type = 'requests', token, onDone = () => {} }) {
  const [reference, setReference] = useState(order.id)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const upload = async () => {
    if (!file || !reference.trim() || busy) return
    if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type) || file.size > 5 * 1024 * 1024) return setError('Choose a JPG, PNG, WebP or PDF receipt up to 5 MB.')
    setBusy(true); setError('')
    try { const receipt = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read receipt.')); reader.readAsDataURL(file) }); const result = await call(`${type}/${order.id}/receipt`, { receipt, receiptName: file.name, reference: reference.trim(), token }); onDone(result.order) } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <div className="workflow-panel"><BankDetails bank={order.bankDetails}/><p><strong>Approved amount: {money(order.total ?? order.amount)}</strong></p>{order.paymentNote && <p className="market-error">Receipt needs correction: {order.paymentNote}</p>}<p>After making your bank payment, upload the receipt below. The seller will verify the payment before dispatch.</p><label>Payment reference<input maxLength={120} value={reference} onChange={event => setReference(event.target.value)}/></label><label>Bank receipt (up to 5 MB)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event => setFile(event.target.files?.[0] || null)}/></label><button className="market-primary" disabled={busy || !file || !reference.trim()} onClick={upload}>{busy ? 'Uploading…' : 'Submit receipt for verification'}</button>{error && <p className="market-error">{error}</p>}</div>
}

function DeliveryConfirmation({ order, canConfirm = false, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const confirmations = order.deliveryConfirmations || {}
  if (!['Dispatched', 'Delivered', 'Returned'].includes(order.status)) return null
  const confirm = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { const result = await call(`orders/${encodeURIComponent(order.id)}/confirm-delivery`, {}); onDone?.(result.order) }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <section className="delivery-confirmation"><h3>Delivery confirmation</h3>{['seller', 'customer'].map(party => { const record = confirmations[party]; return <p key={party}><b>{party === 'seller' ? 'Seller' : 'Customer'}:</b> {record ? <>Confirmed by {record.name} <time dateTime={record.at}>{new Date(record.at).toLocaleString()}</time></> : 'Confirmation not recorded'}</p> })}{confirmations.seller && confirmations.customer && <p role="status">Delivery confirmed by both parties.</p>}{canConfirm && !confirmations.customer && !order.return && ['Dispatched', 'Delivered'].includes(order.status) && <><p>Confirm only after you have received all items in this order.</p><button className="market-primary" disabled={busy} onClick={confirm}>{busy ? 'Confirming...' : 'Mark order delivered'}</button></>}{error && <p className="market-error" role="alert">{error}</p>}</section>
}

export function OrderReview({ order, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
  const [courier, setCourier] = useState(order.courier || '')
  const dropship = order.orderMode === 'dropship'
  const legacyActions = { Pending: [['Awaiting payment','Approve order'],['Cancelled','Cancel order'],['Rejected','Reject request']], 'Awaiting payment': [['Cancelled','Cancel order'],['Rejected','Reject unpaid order']], 'Payment review': [['Processing','Verify payment'],['Awaiting payment','Request corrected receipt'],['Cancelled','Cancel order']], Processing: [['Dispatched','Dispatch order'],['Cancelled','Cancel before dispatch']], Dispatched: [['Delivered','Mark delivered'],['Cancelled','Cancel before delivery'],['Returned','Mark returned']], Delivered: [...(!order.deliveryConfirmations?.seller ? [['Delivered','Confirm delivery as seller']] : []),['Returned','Mark returned']] }[order.status] || []
  const dropshipActions = { Processing: [['Dispatched','Dispatch COD order'],['Cancelled','Cancel before dispatch']], Dispatched: [['Delivered','Mark delivered / COD collected'],['Returned','Mark failed / returned delivery'],['Cancelled','Cancel before delivery']], Delivered: [] }[order.status] || []
  const actions = dropship ? dropshipActions : legacyActions
  const act = async status => { if (busy) return; if (status === 'Cancelled' && !window.confirm('Cancel this order before delivery? Reserved stock will be returned and this cannot be undone.')) return; if (status === 'Returned' && dropship && order.status === 'Dispatched' && !window.confirm('Mark this delivery as returned/failed? Warehouse stock will be restored and no entrepreneur payout will be due.')) return; if (status === 'Dispatched' && !trackingNumber.trim()) return setError('Add the courier tracking number before dispatching.'); setBusy(true); setError(''); try { const result = await call(`orders/${order.id}/status`, { status, reason, trackingNumber: trackingNumber.trim(), courier: courier.trim() }); onDone(status, result.orders?.find(item => item.id === order.id)) } catch (error) { setError(error.message) } finally { setBusy(false) } }
  return <section className="workflow-panel"><h3>{dropship?'COD fulfilment':'Order approval and payment'}</h3><p>Current stage: <strong>{order.status}</strong></p>{!dropship&&order.receipt && <p><ReceiptPreview href={order.receipt} name="View bank receipt"/> · Reference: {order.reference}</p>}{!dropship&&order.status === 'Payment review' && <><p>Check the receipt against your bank account and the order total before confirming payment.</p><label>Reason if receipt needs correction<input value={reason} onChange={event => setReason(event.target.value)}/></label></>}{order.status === 'Processing' && <div className="dispatch-fields"><h3>Delivery tracking</h3><p>{dropship?'Enter the courier details before CAMY dispatches this COD parcel. The client pays only on successful delivery.':'Enter the parcel tracking number so your customer can follow the delivery.'}</p><label>Courier / delivery company (optional)<input maxLength={120} value={courier} disabled={busy} onChange={event => setCourier(event.target.value)} placeholder="Courier company"/></label><label>Tracking number (required)<input required maxLength={120} value={trackingNumber} disabled={busy} onChange={event => setTrackingNumber(event.target.value)} placeholder="Parcel tracking number"/></label></div>}{order.trackingNumber && <p><b>Courier:</b> {order.courier || 'Not specified'}<br/><b>Tracking number:</b> <span className="tracking-number">{order.trackingNumber}</span></p>}<div className="workflow-actions">{actions.filter(([status]) => status !== 'Returned' || !order.return).map(([status,label]) => <button className={status==='Cancelled'||status==='Returned'?'':'market-primary'} key={status} disabled={busy || (status === 'Dispatched' && !trackingNumber.trim())} onClick={() => act(status)}>{label}</button>)}</div>{dropship&&order.status==='Delivered'&&!order.return&&<p className="workflow-note">COD is recorded as collected. If the client later returns the delivered order, record the return below instead of changing the delivery status directly.</p>}{error && <p className="market-error">{error}</p>}{!dropship&&<DeliveryConfirmation order={order}/>}<OrderReturns order={order} seller onDone={value => onDone(value.status,value)}/></section>
}

export function SupplyReview({ request, review }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const act = async (status, note) => {
    if (busy) return
    setBusy(true)
    setError('')
    try { await review(request.id, status, note) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const actions = {
    Pending: [['Awaiting payment', 'Accept request'], ['Rejected', 'Reject request']],
    'Awaiting payment': [['Rejected', 'Reject / cancel request']],
    'Payment review': [['Approved', 'Verify payment'], ['Awaiting payment', 'Request corrected receipt']],
    Approved: [['Dispatched', 'Dispatch stock']],
  }[request.status] || []
  return <div className="workflow-panel">
    {request.status === 'Awaiting payment' && <p>Waiting for the entrepreneur to pay and upload their bank receipt.</p>}
    {request.status === 'Payment review' && <><p>Open the receipt and confirm the reference and full amount in the CAMY bank account before verifying payment.</p><label>Reason for receipt correction<input maxLength={500} value={reason} onChange={event => setReason(event.target.value)}/></label></>}
    {request.status === 'Pending' && <p>Check warehouse availability and entrepreneur delivery details before approving. Approval reserves the requested stock.</p>}
    {request.status === 'Approved' && <p>Payment is verified. Dispatch transfers the reserved units to the entrepreneur shop.</p>}
    {error && <p className="market-error" role="alert">{error}</p>}
    <div className="workflow-actions">{actions.map(([status,label]) => {
      const correction = request.status === 'Payment review' && status === 'Awaiting payment'
      return <button key={status} className={status==='Rejected'||correction?'':'market-primary'} disabled={busy||(correction&&!reason.trim())} onClick={()=>act(status,correction?reason.trim():undefined)}>{busy?'Processing...':label}</button>
    })}</div>
  </div>
}

export function CustomerTracker({ tracking, canReview = false, reviews = [], onReview, onOrderUpdate }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(tracking.status === 'Awaiting payment' || !tracking.status)
  const generation = useRef(0)
  const refresh = async () => {
    const version = ++generation.current
    try { const result = await call(`orders/${encodeURIComponent(tracking.id)}/tracking?token=${encodeURIComponent(tracking.token)}`); if (generation.current === version) { setOrder(result.order); setError('') } }
    catch (error) { if (generation.current === version) setError(error.message) }
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => { clearInterval(timer); generation.current++ } }, [tracking.id, tracking.token])
  useEffect(() => { if (order?.status === 'Awaiting payment') setExpanded(true) }, [order?.status])
  const link = `/shops?order=${encodeURIComponent(tracking.id)}&token=${encodeURIComponent(tracking.token)}`
  const status = order?.status || tracking.status || 'Loading'
  const steps = ['Request sent', 'Shop approved', 'Receipt sent', 'Payment verified', 'Dispatched', 'Delivered']
  const stage = { Pending: 0, 'Awaiting payment': 1, 'Payment review': 2, Processing: 3, Dispatched: 4, Delivered: 5 }[status] ?? -1
  const sellerPhone = String(order?.sellerPhone || '').trim()
  const dialNumber = sellerPhone.replace(/[\s().-]/g, '')
  const canCallSeller = /^\+?\d{7,15}$/.test(dialNumber)
  const receiveOrder = value => { generation.current++; setOrder(previous => ({ ...value, sellerPhone: value.sellerPhone ?? previous?.sellerPhone })); setError(''); onOrderUpdate?.(value) }
  return <details className="shop-order-card" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary className="shop-order-summary"><div className="shop-order-identity"><strong><Store size={15}/> {order?.entrepreneur || tracking.shop || 'Shop order'}</strong><small>{tracking.id} {order?.date ? `· ${order.date}` : ''}</small></div><span className={`shop-order-status ${status === 'Awaiting payment' ? 'needs-payment' : ''}`}>{order?.return && order.return.status !== 'Rejected' ? `Return ${order.return.status}${order.return.refundStatus === 'Refunded' ? ' · Refunded' : ''}` : status === 'Processing' ? 'Payment verified' : status === 'Awaiting payment' ? 'Ready to pay' : status}</span><strong>{money(order?.amount ?? tracking.amount)}</strong><ChevronRight size={20}/></summary><div className="shop-order-body">
    {error && <p className="market-error" role="alert">{error}</p>}{order && <>
      {stage >= 0 && <ol className="shop-order-progress" aria-label="Order progress">{steps.map((step, index) => <li key={step} className={index <= stage ? 'done' : ''} aria-current={index === stage ? 'step' : undefined}>{step}</li>)}</ol>}
      <div className="shop-order-items">{(order.items || []).map(item => <div key={item.id || item.productId}><span>{item.name} × {item.qty}</span><strong>{money(item.price * item.qty)}</strong></div>)}</div>
      {order.address && <p><b>Deliver to:</b> {order.customer} · {order.phone}<br/>{order.address}</p>}
      <div className="shop-seller-contact"><div><h3>Contact seller</h3><p>{order.entrepreneur || tracking.shop || 'Your shop'}</p>{canCallSeller ? <span>{sellerPhone}</span> : <small>The shop has not provided a valid contact number yet.</small>}</div>{canCallSeller && <a className="shop-secondary" href={`tel:${dialNumber}`} aria-label={`Call seller ${order.entrepreneur || tracking.shop || ''} at ${sellerPhone}`}><Phone size={17}/>Call seller</a>}</div>
      {status === 'Pending' && <p>This shop is reviewing your request. Its bank details appear here after approval. Please wait before paying.</p>}
      {status === 'Awaiting payment' && <><p><b>Pay {money(order.amount)} to {order.entrepreneur} only.</b> Use this order number as your reference. Payments and receipts for other shops belong on their own orders.</p><ReceiptUpload order={order} type="orders" token={tracking.token} onDone={receiveOrder}/></>}
      {status === 'Payment review' && <p>Your receipt is with this shop for verification. You don’t need to pay again. Other shops continue processing their own orders separately.</p>}
      {status === 'Processing' && <p>Payment verified. This shop is preparing your items for dispatch.</p>}
      {status === 'Dispatched' && <p>Your items have been dispatched. The shop will update this order when delivery is complete.</p>}
      {order.trackingNumber && <div className="shop-parcel-tracking"><h3>Delivery tracking</h3>{order.courier && <p>{order.courier}</p>}<span>Tracking number</span><strong className="tracking-number">{order.trackingNumber}</strong><small>Use this number on your courier’s tracking service.</small></div>}
      {status === 'Delivered' && <p>Your order has been delivered. Thank you for supporting a local entrepreneur.</p>}
      {status === 'Delivered' && canReview && <div className="shop-delivered-reviews"><h3>Rate your purchased products</h3>{(order.items || []).map(item => <ProductReviewForm key={item.id || item.productId} product={item} orderId={order.id} existing={reviews.find(review => String(review.product_id) === String(item.id || item.productId) && review.shop_id === order.entrepreneurId)} onDone={onReview}/>)}</div>}
      <DeliveryConfirmation order={order} canConfirm={canReview} onDone={receiveOrder}/>
      <OrderReturns key={order.id + (order.return?.status || '')} order={order} readOnly={!canReview} onDone={receiveOrder}/>
      {status === 'Rejected' && <p>This shop could not fulfil this request. Do not pay for this order. Your orders with other shops are unaffected.</p>}
      {order.receipt && <p className="shop-receipt-link"><ReceiptPreview href={order.receipt} name="View submitted receipt"/> · Reference: {order.reference}</p>}
    </>}<button className="shop-secondary" onClick={refresh}>Refresh this order</button><p className="shop-order-private-link"><a href={link}>Private tracking link</a> · Keep this link private.</p></div></details>
}
