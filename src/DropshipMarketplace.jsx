import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeDollarSign, Banknote, CheckCircle2, Clock3, FileText, PackageCheck, PackageOpen, RefreshCw, ShoppingCart, Truck, X } from 'lucide-react'
import { api } from './api'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`
const districts = ['Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle','Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle','Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala','Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura','Trincomalee','Vavuniya']
const blankClient = { name: '', phone: '', district: 'Colombo', address: '', notes: '' }
const fileAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('Could not read the receipt file.'))
  reader.readAsDataURL(file)
})
const payoutLabel = order => {
  if (order.payoutStatus === 'paid') return 'Entrepreneur paid'
  if (order.payoutStatus === 'pending_transfer') return 'CAMY transfer pending'
  if (order.payoutStatus === 'reversal_required') return 'Payout reversal required'
  if (order.payoutStatus === 'cancelled' || order.payoutStatus === 'not_required') return 'No payout due'
  return 'Waiting for successful delivery'
}

function statusHelp(order) {
  if (order.status === 'Processing') return order.clientPaymentMethod === 'bank' ? 'CAMY received the order and client bank receipt. CAMY is preparing fulfilment.' : 'CAMY received this order. Payment will be collected from the client on delivery.'
  if (order.status === 'Dispatched') return order.trackingNumber ? `Dispatched · Tracking: ${order.trackingNumber}${order.courier ? ` · ${order.courier}` : ''}` : 'Dispatched by CAMY.'
  if (order.status === 'Delivered') return `Delivery completed. CAMY collected the client payment. ${payoutLabel(order)}.`
  if (order.status === 'Returned') return order.payoutStatus === 'reversal_required' ? 'This order was returned after payout. CAMY Admin must reconcile the paid margin.' : 'This order was returned. No entrepreneur payout is due.'
  return 'CAMY is reviewing this order.'
}

function CreditSensor({ person, tiers = [], orders = [] }) {
  const delivered = orders.filter(order => order.status === 'Delivered')
  const sales = delivered.reduce((sum, order) => sum + Number(order.camyCost ?? order.amount ?? 0), 0)
  const sorted = [...tiers].sort((a, b) => Number(a.sales) - Number(b.sales))
  const active = [...sorted].reverse().find(tier => Number(tier.sales) <= sales)
  const next = sorted.find(tier => Number(tier.sales) > sales)
  const credit = Number(person?.credit ?? active?.credit ?? 0)
  const remaining = next ? Math.max(0, Number(next.sales) - sales) : 0
  const phase = credit > 0 ? 'Phase 2 · Credit-based stock' : 'Phase 1 · Trial drop-shipping'
  return <section className="shop-home-stats">
    <article><small>CURRENT CAMY STAGE</small><strong className="phase-value">{phase}</strong><p>{credit > 0 ? 'Trial completed — your sales unlocked CAMY credit.' : 'Complete the first configured sales milestone to finish the trial stage.'}</p></article>
    <article><small>VERIFIED CAMY SALES</small><strong>{money(sales)}</strong><p>Uses CAMY product value from successfully delivered orders, not your markup</p></article>
    <article><small>CREDIT / NEXT TARGET</small><strong>{credit > 0 ? money(credit) : next ? money(remaining) : 'Not configured'}</strong><p>{credit > 0 ? 'Current eligible credit limit' : next ? `${money(remaining)} more verified CAMY sales to unlock ${money(next.credit)} credit` : 'CAMY Admin must configure a credit tier'}</p></article>
  </section>
}

export function DropshipOrderPage({ products = [], person, notify, catalogueLive }) {
  const [cart, setCart] = useState([])
  const [client, setClient] = useState(blankClient)
  const [orders, setOrders] = useState([])
  const [tiers, setTiers] = useState([])
  const [self, setSelf] = useState(person)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [bankReference, setBankReference] = useState('')
  const [bankReceipt, setBankReceipt] = useState(null)

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true)
    try {
      const state = await api('/marketplace/state')
      setOrders(state.orders || [])
      setTiers(state.tiers || [])
      setSelf(state.self || person)
    } catch (error) {
      if (!quiet) notify?.(error.message)
    } finally {
      if (!quiet) setRefreshing(false)
    }
  }, [notify, person])

  useEffect(() => {
    refresh(true)
    const timer = window.setInterval(() => refresh(true), 10000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const selected = useMemo(() => cart.map(item => {
    const product = products.find(product => String(product.id) === String(item.productId))
    return product ? { ...item, product } : null
  }).filter(Boolean), [cart, products])

  const camyCost = selected.reduce((sum, item) => sum + Number(item.product.price) * Number(item.qty), 0)
  const clientTotal = selected.reduce((sum, item) => sum + Number(item.sellPrice) * Number(item.qty), 0)
  const estimatedMargin = clientTotal - camyCost
  const validClient = client.name.trim() && /^(?:\+94|0)7\d{8}$/.test(client.phone.replace(/[\s-]/g, '')) && client.address.trim()

  const add = product => setCart(old => {
    const found = old.find(item => String(item.productId) === String(product.id))
    return found
      ? old.map(item => item === found ? { ...item, qty: item.qty + 1 } : item)
      : [...old, { productId: product.id, qty: 1, sellPrice: Number(product.price) }]
  })

  const update = (productId, patch) => setCart(old => old.map(item => String(item.productId) === String(productId) ? { ...item, ...patch } : item))

  const submit = async () => {
    if (!catalogueLive) return notify?.('CAMY catalogue is not active yet.')
    if (!selected.length) return notify?.('Add at least one product.')
    if (!validClient) return notify?.('Enter the client name, valid Sri Lankan mobile number and delivery address.')
    if (selected.some(item => Number(item.sellPrice) < Number(item.product.price))) return notify?.('Client selling price cannot be lower than the CAMY price.')
    if (paymentMethod === 'bank' && (!bankReceipt || !bankReference.trim())) return notify?.('Upload the client bank receipt and enter its reference.')
    if (bankReceipt && (!['image/jpeg','image/png','image/webp','application/pdf'].includes(bankReceipt.type) || bankReceipt.size > 5 * 1024 * 1024)) return notify?.('Use a JPG, PNG, WebP or PDF bank receipt up to 5 MB.')
    setBusy(true)
    try {
      const clientPaymentReceipt = paymentMethod === 'bank' ? await fileAsDataUrl(bankReceipt) : ''
      const result = await api('/marketplace/dropship-orders', {
        method: 'POST',
        body: JSON.stringify({
          customer: client,
          paymentMethod,
          clientPaymentReference: paymentMethod === 'bank' ? bankReference.trim() : '',
          clientPaymentReceipt,
          clientPaymentReceiptName: bankReceipt?.name || '',
          items: selected.map(item => ({ productId: item.product.id, qty: Number(item.qty), sellPrice: Number(item.sellPrice) }))
        })
      })
      notify?.(`${result.order.id} sent to CAMY. Your margin is ${money(result.order.entrepreneurMargin)} and is transferred only after successful delivery.`)
      setCart([])
      setClient(blankClient)
      setPaymentMethod('cod')
      setBankReference('')
      setBankReceipt(null)
      await refresh(true)
    } catch (error) {
      notify?.(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="content-page market-page stock-buy-page">
    <section className="stock-buy-hero">
      <div><small>CAMY DROPSHIP ORDER DESK</small><h1>You sell it.<br/><em>CAMY delivers it.</em></h1><p>Take the order from your client yourself, enter the delivery details here, and send it to CAMY. There is no customer account or customer portal in this system.</p></div>
      <div className="stock-buy-steps"><span><i>1</i>Choose product</span><span><i>2</i>Add client details</span><span><i>3</i>CAMY packs & delivers</span></div>
    </section>

    {!catalogueLive && <div className="market-warning">CAMY Admin must activate the verified catalogue before entrepreneurs can submit orders.</div>}

    <CreditSensor person={self} tiers={tiers} orders={orders}/>

    <div className="stock-buy-layout">
      <section>
        <div className="stock-catalogue-title"><div><small>CAMY CATALOGUE</small><h2>Products you can sell</h2></div><span><PackageCheck size={16}/> {products.filter(product => Number(product.stock) > 0).length} available</span></div>
        <div className="stock-product-grid">{products.map(product => {
          const inCart = cart.find(item => String(item.productId) === String(product.id))
          const available = Number(product.stock) > 0
          return <article className="stock-product-card" key={product.id}>
            <button className="stock-product-image" type="button"><img src={product.image} alt={product.name}/><span>{product.category}</span></button>
            <div className="stock-product-copy"><small>{product.code || product.category}</small><h3>{product.name}</h3><p>{product.description || 'CAMY product available for entrepreneur sales.'}</p>
              <div className="stock-product-meta"><span className={available ? 'available' : 'unavailable'}><i/> {available ? 'Available' : 'Unavailable'}</span><strong>{money(product.price)}</strong></div>
              <button className="market-primary" disabled={!available} onClick={() => add(product)}>{inCart ? `Add another (${inCart.qty})` : 'Add to client order'} <ArrowRight size={15}/></button>
            </div>
          </article>
        })}</div>
      </section>

      <aside className="market-checkout stock-request-card">
        <header><span><ShoppingCart size={19}/></span><div><small>CLIENT ORDER</small><h2>Order summary</h2></div></header>
        {selected.length ? selected.map(item => <div className="market-line" key={item.productId}>
          <span><strong>{item.product.name}</strong><small>CAMY: {money(item.product.price)}</small></span>
          <input aria-label={`Quantity for ${item.product.name}`} type="number" min="1" value={item.qty} onChange={event => update(item.productId, { qty: Math.max(1, Number(event.target.value) || 1) })}/>
          <button onClick={() => setCart(old => old.filter(entry => String(entry.productId) !== String(item.productId)))} aria-label="Remove"><X size={15}/></button>
          <label style={{gridColumn:'1 / -1'}}>Your client selling price<input type="number" min={item.product.price} step="0.01" value={item.sellPrice} onChange={event => update(item.productId, { sellPrice: Number(event.target.value) || 0 })}/></label>
        </div>) : <div className="stock-cart-empty"><ShoppingCart size={23}/><p>Add products for your client's order.</p></div>}

        <div className="customer-fields"><h3>Client delivery details</h3>
          <label>Client name<input value={client.name} onChange={event => setClient(old => ({...old, name:event.target.value}))} placeholder="Full name"/></label>
          <div><label>Mobile number<input value={client.phone} onChange={event => setClient(old => ({...old, phone:event.target.value}))} placeholder="07X XXX XXXX"/></label>
          <label>District<select value={client.district} onChange={event => setClient(old => ({...old, district:event.target.value}))}>{districts.map(district => <option key={district}>{district}</option>)}</select></label></div>
          <label>Delivery address<textarea rows="3" value={client.address} onChange={event => setClient(old => ({...old, address:event.target.value}))} placeholder="House number, street, town"/></label>
          <label>Order note (optional)<textarea rows="2" value={client.notes} onChange={event => setClient(old => ({...old, notes:event.target.value}))} placeholder="Colour, preferred call time, delivery note..."/></label>
        </div>

        <section className="dropship-payment-choice">
          <h3>How will the client pay CAMY?</h3>
          <div><button type="button" className={paymentMethod==='cod'?'active':''} onClick={()=>setPaymentMethod('cod')}><Truck/><span><strong>Cash on delivery</strong><small>CAMY collects the full client total when delivery succeeds.</small></span></button><button type="button" className={paymentMethod==='bank'?'active':''} onClick={()=>setPaymentMethod('bank')}><Banknote/><span><strong>Bank transfer to CAMY</strong><small>Upload the client's payment receipt with this order.</small></span></button></div>
          {paymentMethod==='bank'&&<div className="dropship-bank-proof"><label>Client bank payment reference<input maxLength="120" value={bankReference} onChange={event=>setBankReference(event.target.value)} placeholder="Bank reference / slip number"/></label><label>Client payment receipt<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>setBankReceipt(event.target.files?.[0]||null)}/><small>{bankReceipt?bankReceipt.name:'JPG, PNG, WebP or PDF · max 5 MB'}</small></label></div>}
        </section>

        <div className="dropship-money-rule"><BadgeDollarSign/><div><strong>You choose the client price.</strong><p>CAMY keeps only the CAMY product cost. After a successful delivery and collection, CAMY transfers the difference to your saved bank account and uploads the transfer receipt.</p></div></div>
        <div className="market-total"><span>CAMY product cost</span><strong>{money(camyCost)}</strong></div>
        <div className="market-total"><span>Client order total</span><strong>{money(clientTotal)}</strong></div>
        <div className="market-total"><span>Estimated entrepreneur margin</span><strong>{money(estimatedMargin)}</strong></div>
        <button className="market-primary" disabled={!catalogueLive || !selected.length || !validClient || busy} onClick={submit}>{busy ? 'Sending to CAMY…' : 'Place order with CAMY'} <ArrowRight size={17}/></button>
        <footer><Truck size={15}/> CAMY handles fulfilment and delivery to the client.</footer>
      </aside>
    </div>

    <section className="market-history stock-request-history">
      <div><small>LIVE DELIVERY UPDATES</small><h2>My CAMY orders</h2><button className="market-primary" onClick={() => refresh()} disabled={refreshing}><RefreshCw size={15}/> {refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      {orders.length ? [...orders].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date))).map(order => <article className="stock-tracker-entry dropship-money-entry" key={order.id}>
        <div><strong>{order.id} · {order.customer}</strong><small>{(order.items || []).map(item => `${item.name} × ${item.qty}`).join(', ')}</small><p>{statusHelp(order)}</p><div className="order-money-mini"><span>Client total <b>{money(order.amount)}</b></span><span>CAMY cost <b>{money(order.camyCost ?? order.amount)}</b></span><span>Your margin <b>{money(order.entrepreneurMargin)}</b></span><span>Payment <b>{order.clientPaymentMethod==='bank'?'Bank transfer':'COD'}</b></span><span>Payout <b>{payoutLabel(order)}</b></span>{order.payoutReceipt&&<a href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View CAMY transfer receipt</a>}</div></div>
        <span className={`market-status ${String(order.status).toLowerCase()}`}>{order.status}</span>
      </article>) : <p>No client orders yet. Your submitted orders and CAMY delivery updates will appear here automatically.</p>}
    </section>
  </div>
}

export function DropshipHome({ person, orders = [], tiers = [], setPage }) {
  const myOrders = orders.filter(order => String(order.entrepreneurId) === String(person?.id))
  const inProgress = myOrders.filter(order => !['Delivered','Returned'].includes(order.status))
  const delivered = myOrders.filter(order => order.status === 'Delivered')
  const paidMargin = myOrders.filter(order=>order.payoutStatus==='paid').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const pendingMargin = myOrders.filter(order=>order.payoutStatus==='pending_transfer').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const lifetimeMargin = delivered.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  return <div className="content-page market-page">
    <div className="market-heading"><div><small>CAMY ENTREPRENEUR PANEL</small><h1>Welcome back, {person?.name?.split(' ')[0] || 'Entrepreneur'}.</h1><p>Sell CAMY products directly to your own clients. You collect the order; CAMY receives it here, packs it, dispatches it and updates the delivery status.</p></div></div>
    <div className="shop-home-grid">
      <button onClick={() => setPage('products')}><ShoppingCart/><strong>Create client order</strong><small>Choose products and send client delivery details to CAMY</small><ArrowRight/></button>
      <button onClick={() => setPage('orders')}><Truck/><strong>Delivery tracking</strong><small>{inProgress.length} active · {delivered.length} delivered</small><ArrowRight/></button>
      <button onClick={() => setPage('credit')}><BadgeDollarSign/><strong>Credit & settlements</strong><small>Track your credit eligibility and balance</small><ArrowRight/></button>
    </div>
    <CreditSensor person={person} tiers={tiers} orders={myOrders}/>
    <section className="shop-home-stats payout-home-stats"><article><small>TOTAL ENTREPRENEUR MARGIN</small><strong>{money(lifetimeMargin)}</strong><p>Margin from successfully delivered client orders</p></article><article><small>TRANSFERRED BY CAMY</small><strong>{money(paidMargin)}</strong><p>Recorded payouts with CAMY bank transfer receipts</p></article><article><small>WAITING FOR TRANSFER</small><strong>{money(pendingMargin)}</strong><p>Delivered orders awaiting CAMY payout</p></article></section>
    <section className="market-history"><h2>Recent client orders</h2>{myOrders.length ? myOrders.slice(0,5).map(order => <article key={order.id}><div><strong>{order.id} · {order.customer}</strong><small>{money(order.amount)} · {statusHelp(order)}</small></div><span className="market-status">{order.status}</span></article>) : <p>Create your first client order from the Products page.</p>}</section>
  </div>
}

export function DropshipInventoryPage({ person, products = [], orders = [] }) {
  const mine = orders.filter(order => String(order.entrepreneurId) === String(person?.id))
  return <div className="content-page market-page">
    <div className="market-heading"><div><small>NO STOCKHOLDING REQUIRED</small><h1>Dropship fulfilment</h1><p>Entrepreneurs no longer need a public CAMY shop or customer-facing inventory. Use the CAMY catalogue to sell directly, then place the client's order for CAMY fulfilment.</p></div></div>
    <section className="shop-home-stats"><article><small>CATALOGUE PRODUCTS</small><strong>{products.length}</strong><p>Products available to sell</p></article><article><small>MY ORDERS</small><strong>{mine.length}</strong><p>Orders submitted to CAMY</p></article><article><small>DELIVERED</small><strong>{mine.filter(order=>order.status==='Delivered').length}</strong><p>Successfully completed deliveries</p></article></section>
    <div className="market-empty"><PackageOpen/><h2>CAMY holds and dispatches the stock</h2><p>Your job is to find the client and place the order. CAMY Admin handles the next fulfilment steps and delivery tracking.</p></div>
  </div>
}
