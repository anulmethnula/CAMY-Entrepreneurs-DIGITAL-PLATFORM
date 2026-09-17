import { useState } from 'react'
import { api } from './api'

export function ReturnAttention({ orders, onOpen }) {
  const waiting = orders.filter(order => ['Requested','Approved','Shipped'].includes(order.return?.status) || order.return?.refundStatus === 'Pending')
  if (!waiting.length) return null
  return <section className="return-attention"><div><strong>{waiting.length} return{waiting.length === 1 ? '' : 's'} need attention</strong><p>Review requests, returned parcels and bank refunds from the order details.</p></div><button className="market-primary" onClick={onOpen}>View returns</button></section>
}

export function OrderReturns({ order, seller = false, readOnly = false, onDone }) {
  const [reason, setReason] = useState('')
  const [instructions, setInstructions] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [courier, setCourier] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const record = order.return
  if (!record && (seller || readOnly || order.status !== 'Delivered') && order.status !== 'Returned') return null
  const refunded = record?.refundStatus === 'Refunded'
  const stage = refunded ? 4 : { Requested: 0, Approved: 1, Shipped: 2, Received: 3 }[record?.status]
  const steps = ['Return requested', 'Shop approved', 'Parcel sent', 'Shop received', 'Refund completed']
  const act = async action => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await api(`/marketplace/orders/${encodeURIComponent(order.id)}/return/${action}`, { method: 'POST', body: JSON.stringify({ reason, instructions, trackingNumber, courier, reference }) })
      onDone?.(result.order)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <section className="order-return-panel"><h3>Returns &amp; refunds</h3>
    {!record && order.status === 'Returned' && <p role="status">The shop marked this order as returned. Detailed return stages and refund confirmation have not been recorded. Contact the shop for a refund update.</p>}
    {!record && order.status === 'Delivered' && !readOnly && <><p>Request a return of this entire shop order, including all its items. Wait for the shop’s approval and return address before sending anything.</p><label>Why would you like to return this order?<textarea rows={3} minLength={8} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label><button className="market-primary" disabled={busy || reason.trim().length < 8} onClick={() => act('request')}>Request return</button></>}
    {stage !== undefined && <ol className="shop-order-progress return-progress" aria-label="Return progress">{steps.map((step, index) => <li key={step} className={index <= stage ? 'done' : ''} aria-current={index === stage ? 'step' : undefined}>{step}{index === stage && <small>{index === 4 ? 'Completed' : 'Current stage'}</small>}</li>)}</ol>}
    {record && <><p><strong>Return: {record.status}</strong></p><p><b>Customer’s reason:</b> {record.reason}</p>
      {record.status === 'Requested' && <p>The shop is reviewing this request. Keep the items until the return is approved.</p>}
      {record.instructions && <div className="return-instructions"><b>Return address &amp; instructions</b><p>{record.instructions}</p></div>}
      {record.status === 'Rejected' && <p><b>Shop’s decision:</b> {record.decisionReason}</p>}
      {record.status === 'Approved' && readOnly && <p>The return is approved. Sign in to your customer account to add the courier and tracking number after sending the parcel.</p>}
      {record.trackingNumber && <p><b>Return courier:</b> {record.courier}<br /><b>Return tracking number:</b> {record.trackingNumber}</p>}
      {record.status === 'Shipped' && <p>Return parcel sent. The shop will confirm receipt after checking the items.</p>}
      {record.status === 'Received' && <p><b>Refund: {record.refundStatus}</b> · Rs. {Number(record.refundAmount).toLocaleString('en-LK')}<br />{record.refundReference ? `Bank refund reference: ${record.refundReference}` : 'The shop must arrange the refund by bank transfer outside this platform.'}</p>}
      {seller && record.status === 'Requested' && <><label>Return address &amp; instructions<textarea rows={3} maxLength={2000} value={instructions} onChange={event => setInstructions(event.target.value)} /></label><button className="market-primary" disabled={busy || instructions.trim().length < 8} onClick={() => act('approve')}>Approve return</button><label>Reason if declining<textarea rows={2} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label><button disabled={busy || reason.trim().length < 8} onClick={() => act('reject')}>Decline return</button></>}
      {!seller && !readOnly && record.status === 'Approved' && <><p>Follow the instructions above. Add these details after sending the complete order back.</p><label>Return courier<input maxLength={120} value={courier} onChange={event => setCourier(event.target.value)} /></label><label>Return parcel tracking number<input maxLength={120} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} /></label><button className="market-primary" disabled={busy || !trackingNumber.trim() || !courier.trim()} onClick={() => act('ship')}>Confirm return parcel sent</button></>}
      {seller && record.status === 'Shipped' && <><p>Confirm only after receiving and checking all items. This restores stock and reverses this order’s verified sales.</p><button className="market-primary" disabled={busy} onClick={() => act('receive')}>Confirm return received</button></>}
      {seller && record.status === 'Received' && record.refundStatus === 'Pending' && <><label>Bank refund reference<input maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label><button className="market-primary" disabled={busy || !reference.trim()} onClick={() => act('refund')}>Record completed bank refund</button></>}
    </>}
    {busy && <p role="status">Saving return…</p>}{error && <p className="market-error" role="alert">{error}</p>}
  </section>
}
