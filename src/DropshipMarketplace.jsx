import { useEffect, useMemo, useState } from 'react'
import { customerProductPrice, deliveryLabel, fullProductCost, payableDeliveryCost } from './productCosts'
import { AlertCircle, ArrowRight, BadgeDollarSign, Banknote, CalendarDays, Check, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Download, Eye, FileSpreadsheet, FileText, ListFilter, LockKeyhole, PackageCheck, PackageOpen, RefreshCw, Search, ShieldCheck, ShoppingCart, Trash2, Truck, UserRound, X } from 'lucide-react'
import { api } from './api'
import { creditProgression } from './creditRules'
import { PortalOverlay } from './Dialog'
import { exportReport } from './reports'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`
const districts = ['Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle','Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle','Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala','Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura','Trincomalee','Vavuniya']
const blankClient = { name: '', phone: '', district: 'Colombo', address: '', notes: '' }

const productFeatures = product => {
  if (Array.isArray(product?.specs)) return product.specs.filter(Boolean)
  if (typeof product?.specs === 'string') return product.specs.split(/[,\n]/).map(spec => spec.trim()).filter(Boolean)
  return []
}

const requestDate = value => {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
}

const repaymentDays = request => Number(request?.repaymentDays || 10)

const creditRepaymentCountdown = request => {
  if (request?.status !== 'Dispatched' || request?.creditRepaymentStatus === 'Paid') return null
  const issued = request.dispatchedAt || request.creditIssuedAt
  const due = request.creditDueAt ? new Date(request.creditDueAt) : issued ? new Date(new Date(issued).getTime() + repaymentDays(request) * 86400000) : null
  if (!due || Number.isNaN(due.getTime())) return null
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000)
  return { due, days, label: days > 1 ? `${days} days left to pay` : days === 1 ? '1 day left to pay' : days === 0 ? 'Payment due today' : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` }
}

const creditRequestNextStep = request => {
  if (request?.status === 'Pending') return 'CAMY approval'
  if (request?.status === 'Approved') return 'CAMY dispatch'
  if (request?.status === 'Dispatched') {
    const countdown = creditRepaymentCountdown(request)
    if (!countdown) return request?.creditRepaymentStatus === 'Paid' ? 'Payment completed' : 'Countdown starts after dispatch'
    return `${countdown.label} · Due ${requestDate(countdown.due)}`
  }
  return request?.status === 'Cancelled' ? 'No action required' : 'Request closed'
}

const creditRequestMessage = status => ({
  Pending: 'CAMY is reviewing this request. No credit has been issued yet.',
  Approved: 'CAMY approved the request and reserved the stock. It is waiting for dispatch.',
  Dispatched: 'CAMY dispatched the stock. This value is now included in your outstanding credit.',
  Rejected: 'CAMY closed this request without issuing credit.',
  Cancelled: 'You cancelled this request before CAMY approval. No credit was used.'
}[status] || 'CAMY will update this request as it moves through the stock process.')

const payoutLabel = order => {
  if (order.payoutStatus === 'paid') return 'Entrepreneur paid'
  if (order.payoutStatus === 'pending_transfer') return 'CAMY transfer pending'
  if (order.payoutStatus === 'reversal_required') return 'Payout reversal required'
  if (order.payoutStatus === 'cancelled' || order.payoutStatus === 'not_required') return 'No payout due'
  return 'Waiting for successful delivery'
}

function statusHelp(order) {
  if (order.status === 'Processing') return 'CAMY received this COD order and is preparing the parcel.'
  if (order.status === 'Dispatched') return order.trackingNumber ? `Dispatched · Tracking: ${order.trackingNumber}${order.courier ? ` · ${order.courier}` : ''}` : 'Dispatched by CAMY.'
  if (order.status === 'Delivered') return `Delivery completed and CAMY collected the client cash. ${payoutLabel(order)}.`
  if (order.status === 'Returned') return order.payoutStatus === 'reversal_required' ? 'This order was returned after payout. CAMY Admin must reconcile the paid margin.' : 'This order was returned. No entrepreneur payout is due.'
  return 'CAMY is reviewing this order.'
}

function CreditSensor({ person, tiers = [], orders = [] }) {
  const sales = Number(person?.sales || 0)
  const progression = creditProgression(tiers, sales)
  const credit = progression.credit
  const next = progression.next
  const remaining = progression.remaining
  const phase = credit > 0 ? 'Phase 2 · Dropship + credit stock' : 'Phase 1 · Trial drop-shipping'
  return <section className="shop-home-stats">
    <article><small>CURRENT CAMY STAGE</small><strong className="phase-value">{phase}</strong><p>{credit > 0 ? 'You can keep drop-shipping and also request CAMY stock on credit. You choose which method suits each sale.' : 'Build verified delivered sales to unlock optional credit stock.'}</p></article>
    <article><small>VERIFIED SELLING VALUE</small><strong>{money(sales)}</strong><p>Total product selling value from successfully delivered orders</p></article>
    <article><small>CURRENT CREDIT LIMIT</small><strong>{credit > 0 ? money(credit) : 'Not unlocked'}</strong><p>{next ? `${money(remaining)} more delivered product sales unlocks ${money(next.credit)} credit` : 'Credit milestone unavailable'}</p><div className="credit-sensor-progress"><i style={{ width: `${progression.progress}%` }}/></div></article>
  </section>
}

export function DropshipOrderPage({ products = [], person, notify, catalogueLive, orders = [], tiers = [], setPage, workspaceView = 'catalogue', setWorkspaceView }) {
  const cartStorageKey = `camy-dropship-cart-${person?.id || 'current'}`
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(cartStorageKey)) || [] } catch { return [] }
  })
  const [client, setClient] = useState(blankClient)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All products')
  const [catalogueQuery, setCatalogueQuery] = useState('')
  const [detailProduct, setDetailProduct] = useState(null)
  const mobileCheckout = workspaceView === 'cart'
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [addedProductId, setAddedProductId] = useState(null)
  const [mobileOverviewOpen, setMobileOverviewOpen] = useState(false)

  const categories = useMemo(() => ['All products', ...Array.from(new Set(products.map(product => product.category).filter(Boolean)))], [products])
  const visibleProducts = useMemo(() => products.filter(product => (category === 'All products' || product.category === category) && `${product.name} ${product.code||''} ${product.category||''} ${product.description||''}`.toLowerCase().includes(catalogueQuery.trim().toLowerCase())), [products, category, catalogueQuery])

  const selected = useMemo(() => cart.map(item => {
    const product = products.find(product => String(product.id) === String(item.productId))
    return product ? { ...item, product } : null
  }).filter(Boolean), [cart, products])

  useEffect(() => {
    try { sessionStorage.setItem(cartStorageKey, JSON.stringify(cart)) } catch { /* The order remains usable if browser storage is unavailable. */ }
  }, [cart, cartStorageKey])

  const productSubtotal = selected.reduce((sum, item) => sum + customerProductPrice(item.product) * Number(item.qty), 0)
  const deliveryTotal = selected.reduce((sum, item) => sum + payableDeliveryCost(item.product) * Number(item.qty), 0)
  const camyCost = productSubtotal + deliveryTotal
  const clientTotal = selected.reduce((sum, item) => sum + Number(item.sellPrice) * Number(item.qty), 0) + deliveryTotal
  const estimatedMargin = clientTotal - camyCost
  const lowPriceItem = selected.find(item => Number(item.sellPrice) < Number(item.product.price))
  const cleanPhone = client.phone.replace(/[\s()-]/g, '')
  const validPhone = /^(?:0\d{9}|\+94\d{9})$/.test(cleanPhone)
  const validationError = (
    !client.name.trim() ? 'Enter the client name before placing the order.'
      : !validPhone ? 'Enter a Sri Lankan phone number as 10 digits starting with 0, or use +94 followed by 9 digits.'
      : !client.address.trim() ? 'Enter the client delivery address before placing the order.'
        : lowPriceItem ? `The client price for ${lowPriceItem.product.name} cannot be lower than the CAMY price.`
          : ''
  )
  const formError = submitAttempted ? validationError || submitError : ''

  const refresh = () => {
    setRefreshing(true)
    window.dispatchEvent(new Event('camy-business-updated'))
    window.setTimeout(() => setRefreshing(false), 800)
  }

  const add = product => {
    setCart(old => {
      const found = old.find(item => String(item.productId) === String(product.id))
      return found
        ? old.map(item => item === found ? { ...item, qty: item.qty + 1 } : item)
        : [...old, { productId: product.id, qty: 1, sellPrice: Number(product.price) }]
    })
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(current => String(current) === String(product.id) ? null : current), 1100)
  }

  const update = (productId, patch) => setCart(old => old.map(item => String(item.productId) === String(productId) ? { ...item, ...patch } : item))

  const updateSellPrice = (productId, value) => {
    const numericText = value.replace(/[^\d.]/g, '')
    const [whole = '', ...decimalParts] = numericText.split('.')
    const cleanWhole = whole.replace(/^0+(?=\d)/, '')
    const cleanValue = decimalParts.length
      ? `${cleanWhole || '0'}.${decimalParts.join('').slice(0, 2)}`
      : cleanWhole
    update(productId, { sellPrice: cleanValue })
  }

  const submit = async () => {
    setSubmitAttempted(true)
    setSubmitError('')
    if (!catalogueLive) return notify?.('CAMY catalogue is not active yet.')
    if (!selected.length) return notify?.('Add at least one product.')
    if (!client.name.trim() || !validPhone || !client.address.trim() || lowPriceItem) return
    setBusy(true)
    try {
      const result = await api('/marketplace/dropship-orders', {
        method: 'POST',
        body: JSON.stringify({
          customer: client,
          paymentMethod: 'cod',
          items: selected.map(item => ({ productId: item.product.id, qty: Number(item.qty), sellPrice: Number(item.sellPrice) }))
        })
      })
      notify?.(`${result.order.id} sent to CAMY as Cash on Delivery. Your profit is ${money(result.order.entrepreneurMargin)} and is transferred after successful delivery and collection.`)
      setCart([])
      setClient(blankClient)
      setSubmitAttempted(false)
      setSubmitError('')
      setWorkspaceView?.('catalogue')
      window.dispatchEvent(new Event('camy-business-updated'))
      window.setTimeout(() => setPage?.('orders'), 1400)
    } catch (error) {
      setSubmitError(error.message || 'The order could not be submitted. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const itemCount = selected.reduce((sum, item) => sum + Number(item.qty), 0)
  const canSubmit = catalogueLive && selected.length > 0 && !validationError && !busy
  const continueMessage = !selected.length ? 'Add a product to continue' : validationError || ''
  const showMobileCheckout = () => {
    setWorkspaceView?.('cart')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const showMobileCatalogue = () => {
    setWorkspaceView?.('catalogue')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('camy-order-cart-count', { detail: itemCount }))
  }, [itemCount])

  useEffect(() => {
    const openOrderCart = () => {
      showMobileCheckout()
    }
    window.addEventListener('camy-open-order-cart', openOrderCart)
    return () => window.removeEventListener('camy-open-order-cart', openOrderCart)
  }, [])

  return <div className={`content-page market-page stock-buy-page dropship-order-page ${mobileCheckout ? 'mobile-checkout-page' : ''}`}>
    <section className={`order-workspace-head ${mobileOverviewOpen ? 'mobile-overview-open' : ''}`}>
      <div className="order-title-copy"><small>CAMY ENTREPRENEURS</small><h1>New client order</h1><p>Create a customer order using CAMY products.</p></div>
      <button className="order-overview-toggle" type="button" aria-expanded={mobileOverviewOpen} aria-controls="order-workflow" onClick={()=>setMobileOverviewOpen(open=>!open)}>Details <ChevronDown size={16}/></button>
      <button className="order-history-link" type="button" onClick={()=>setPage?.('orders')}><ClipboardList size={17}/> My orders <b>{orders.length}</b></button>
    </section>
    <nav id="order-workflow" className={`order-progress ${mobileOverviewOpen ? 'mobile-overview-open' : ''}`} aria-label="Order workflow">
      <span className={selected.length ? 'done' : 'active'}><i>{selected.length ? <Check/> : 1}</i>Select products</span>
      <span className={selected.length && !validationError ? 'done' : selected.length ? 'active' : ''}><i>{selected.length && !validationError ? <Check/> : 2}</i>Client details</span>
      <span className={selected.length && !validationError ? 'active' : ''}><i>3</i>Review order</span>
      <span><i>4</i>Place COD order</span>
    </nav>

    {!catalogueLive && <div className="market-warning">CAMY Admin must activate the verified catalogue before entrepreneurs can submit orders.</div>}

    {selected.length > 0 && !mobileCheckout && (
      <button className="mobile-order-cart" type="button" onClick={showMobileCheckout}>
        <ShoppingCart size={19}/>
        <span>
          <small>{itemCount} item{itemCount === 1 ? '' : 's'} · Profit {money(Math.max(0,estimatedMargin))}</small>
          <strong>View current order</strong>
        </span>
        <b>{money(clientTotal)}</b>
        <ArrowRight size={19}/>
      </button>
    )}

    <div className={`stock-buy-layout ${mobileCheckout ? 'cart-only-layout' : ''}`}>
      {!mobileCheckout && <section>
        <div className="stock-catalogue-title"><div><small>PRODUCT SELECTION</small><h2>Choose products</h2><p>Browse the CAMY catalogue and add products to this client order.</p></div><span><PackageCheck size={16}/> {visibleProducts.filter(product => Number(product.stock) > 0).length} available</span></div>
        <div className="catalogue-browser"><label><Search/><input value={catalogueQuery} onChange={event=>setCatalogueQuery(event.target.value)} placeholder="Search products..." aria-label="Search products"/></label><div>{categories.map(item=><button type="button" className={category===item?'active':''} onClick={()=>setCategory(item)} key={item}>{item === 'All products' ? 'All' : item}</button>)}</div></div>
        <div className="stock-product-grid">{visibleProducts.map(product => {
          const inCart = cart.find(item => String(item.productId) === String(product.id))
          const available = Number(product.stock) > 0
          return <article className="stock-product-card" key={product.id}>
            <button className="stock-product-image" type="button" onClick={()=>setDetailProduct(product)}><img src={product.image} alt={product.name}/><span>{product.category}</span></button>
            <div className="stock-product-copy"><small>{product.code || product.category}</small><h3>{product.name}</h3><p>{product.description || 'CAMY product available for entrepreneur sales.'}</p><div className={`stock-product-delivery ${product.freeDelivery===false?'has-charge':''}`}><Truck size={13}/><span>{deliveryLabel(product)}</span></div>
              <div className="stock-product-meta"><span className={available ? 'available' : 'unavailable'}><i/> {available ? 'Available' : 'Unavailable'}</span><strong>{money(customerProductPrice(product))}</strong></div>
              <div className="stock-product-actions"><button className="stock-details" type="button" onClick={()=>setDetailProduct(product)}>View details</button><button className={`market-primary ${String(addedProductId)===String(product.id)?'added':''}`} disabled={!available} onClick={() => add(product)}>{String(addedProductId)===String(product.id) ? <><Check size={15}/> Added</> : <>{inCart ? `Add another (${inCart.qty})` : 'Add to order'} <ArrowRight size={15}/></>}</button></div>
            </div>
          </article>
        })}</div>{!visibleProducts.length&&<div className="catalogue-no-results">No products found. Try another category or search term.</div>}
      </section>}

      <aside className={`market-checkout stock-request-card dropship-checkout ${mobileCheckout ? 'mobile-open' : ''}`}>
        <header><span><ShoppingCart size={19}/></span><div><small>CUSTOMER ORDER CART</small><h2>Your cart <b>{itemCount}</b></h2></div><button className="cart-back-to-products" type="button" onClick={showMobileCatalogue} aria-label="Back to products"><ArrowRight size={17}/> Continue shopping</button></header>
        {selected.length ? <div className="current-order-items">{selected.map(item => <div className="market-line dropship-order-line" key={item.productId}>
          <div className="dropship-line-heading"><img src={item.product.image} alt=""/><div className="dropship-line-product"><strong>{item.product.name}</strong><small>{item.product.code || item.product.category}</small><small>Product: {money(customerProductPrice(item.product))} each</small>{item.product.freeDelivery===false&&<small className="cart-delivery-charge">Delivery: {money(payableDeliveryCost(item.product))} each</small>}<small className="cart-line-full">Full CAMY total: {money(fullProductCost(item.product))} each</small></div><button className="dropship-remove" type="button" onClick={() => setCart(old => old.filter(entry => String(entry.productId) !== String(item.productId)))} aria-label={`Remove ${item.product.name}`} title="Remove item"><Trash2 size={16}/></button></div>
          <div className="dropship-line-controls"><label className="dropship-selling-price">Your client price per item<span className="dropship-price-input"><b>Rs.</b><input type="text" inputMode="decimal" autoComplete="off" value={item.sellPrice} onChange={event => updateSellPrice(item.productId,event.target.value)} onBlur={() => { if (item.sellPrice === '') update(item.productId,{sellPrice:String(item.product.price)}) }} aria-label={`Client selling price for ${item.product.name}`}/></span><small className="dropship-price-help">My profit: <strong>{money(Math.max(0,(Number(item.sellPrice)-Number(item.product.price))*Number(item.qty)))}</strong></small></label>
          <label className="dropship-quantity">Quantity<span className="dropship-stepper"><button type="button" aria-label={`Reduce quantity for ${item.product.name}`} disabled={Number(item.qty)<=1} onClick={()=>update(item.productId,{qty:Math.max(1,Number(item.qty)-1)})}>−</button><input aria-label={`Quantity for ${item.product.name}`} type="number" min="1" value={item.qty} onChange={event => update(item.productId, { qty: Math.max(1, Number(event.target.value) || 1) })}/><button type="button" aria-label={`Increase quantity for ${item.product.name}`} onClick={()=>update(item.productId,{qty:Number(item.qty)+1})}>+</button></span></label></div>
        </div>)}</div> : <div className="stock-cart-empty"><span><ShoppingCart size={24}/></span><strong>Your order is empty</strong><p>Select a product from the catalogue to start creating this client order.</p></div>}

        {selected.length > 0 && <><div className="checkout-section-heading"><span><UserRound/></span><div><h3>Client details</h3><p>Who should CAMY deliver this order to?</p></div></div><div className="customer-fields">
          <label>Client name<input className={submitAttempted&&!client.name.trim()?'field-invalid':''} aria-invalid={submitAttempted&&!client.name.trim()} required value={client.name} onChange={event => setClient(old => ({...old, name:event.target.value}))} placeholder="Full name"/>{submitAttempted&&!client.name.trim()&&<small className="field-validation-message">Enter the client name.</small>}</label>
          <div><label>Phone number<input className={submitAttempted&&!validPhone?'field-invalid':''} aria-invalid={submitAttempted&&!validPhone} inputMode="tel" value={client.phone} onChange={event => setClient(old => ({...old, phone:event.target.value}))} placeholder="0771234567 or +94771234567"/>{submitAttempted&&!validPhone&&<small className="field-validation-message">Use 10 digits starting with 0, or +94 followed by 9 digits.</small>}</label>
          <label>District<select value={client.district} onChange={event => setClient(old => ({...old, district:event.target.value}))}>{districts.map(district => <option key={district}>{district}</option>)}</select></label></div>
          <label>Delivery address<textarea className={submitAttempted&&!client.address.trim()?'field-invalid':''} aria-invalid={submitAttempted&&!client.address.trim()} required rows="3" value={client.address} onChange={event => setClient(old => ({...old, address:event.target.value}))} placeholder="House number, street, town"/>{submitAttempted&&!client.address.trim()&&<small className="field-validation-message">Enter the client's delivery address.</small>}</label>
          <label>Order note (optional)<textarea rows="2" value={client.notes} onChange={event => setClient(old => ({...old, notes:event.target.value}))} placeholder="Colour, preferred call time, delivery note..."/></label>
        </div>

        <details className="payment-fulfilment"><summary><span><Truck/></span><div><strong>Payment &amp; fulfilment</strong><small>Cash on Delivery only</small></div></summary><p>No client bank receipt is needed. CAMY collects the full client amount when delivery succeeds.</p><p>CAMY keeps the product cost. After successful delivery and COD collection, CAMY transfers your profit to your saved bank account and records the transfer receipt.</p></details>
        <section className="order-totals"><h3>Full order total</h3><div><span>Product subtotal</span><strong>{money(productSubtotal)}</strong></div><div className={deliveryTotal>0?'delivery-total':''}><span>Delivery charges</span><strong>{deliveryTotal>0?money(deliveryTotal):'Free'}</strong></div><div className="camy-full-total"><span>Full CAMY total</span><strong>{money(camyCost)}</strong></div><div><span>Client COD total</span><strong>{money(clientTotal)}</strong></div><div className="profit"><span>Your profit</span><strong>{money(Math.max(0,estimatedMargin))}</strong></div></section>
        {formError&&<div className="dropship-submit-error" role="alert"><AlertCircle/><span><strong>Check the order details</strong><small>{formError}</small></span></div>}
        <button className="market-primary place-order-cta" disabled={!canSubmit} onClick={submit}>{busy ? 'Sending to CAMY…' : 'Place COD order with CAMY'} <ArrowRight size={17}/></button>
        {!canSubmit && !busy && <p className="order-continue-hint">{!catalogueLive ? 'The CAMY catalogue must be active to continue.' : continueMessage}</p>}
        <footer><Truck size={15}/> CAMY handles fulfilment, delivery and cash collection.</footer>
        </>}
      </aside>
    </div>

    {detailProduct&&<PortalOverlay className="catalogue-detail-layer" onClose={()=>setDetailProduct(null)} label={`${detailProduct.name} details`}><article><button type="button" className="catalogue-detail-close" onClick={()=>setDetailProduct(null)} aria-label="Close product details"><X/></button><img src={detailProduct.image} alt={detailProduct.name}/><div><small>{detailProduct.category} · {detailProduct.code||'CAMY product'}</small><h2>{detailProduct.name}</h2><strong>{money(customerProductPrice(detailProduct))}</strong><p className={`stock-product-delivery ${detailProduct.freeDelivery===false?'has-charge':''}`}><Truck size={16}/>{deliveryLabel(detailProduct)}</p><p>{detailProduct.description||'CAMY product available for entrepreneur sales.'}</p><div className="catalogue-detail-meta"><span><b>Product code</b>{detailProduct.code||'Not set'}</span><span><b>Warranty</b>{detailProduct.warranty||'Ask CAMY'}</span><span><b>Availability</b>{Number(detailProduct.stock)>0?`${detailProduct.stock} in stock`:'Currently unavailable'}</span></div><h3>Product features</h3><ul>{(productFeatures(detailProduct).length?productFeatures(detailProduct):['CAMY quality assured','Available through CAMY']).map(spec=><li key={spec}>{spec}</li>)}</ul><button className="market-primary" disabled={Number(detailProduct.stock)<=0} onClick={()=>{add(detailProduct);setDetailProduct(null)}}>{Number(detailProduct.stock)>0?'Add to client order':'Currently unavailable'} <ArrowRight/></button></div></article></PortalOverlay>}
    <section className="market-history stock-request-history">
      <div><small>DELIVERY UPDATES</small><h2>My CAMY orders</h2><button className="market-primary" onClick={refresh} disabled={refreshing}><RefreshCw size={15}/> {refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      {orders.length ? [...orders].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date))).map(order => <article className="stock-tracker-entry dropship-money-entry" key={order.id}>
        <div><strong>{order.id} · {order.customer}</strong><small>{(order.items || []).map(item => `${item.name} × ${item.qty}`).join(', ')}</small><p>{statusHelp(order)}</p><div className="order-money-mini"><span>Client COD <b>{money(order.amount)}</b></span><span>CAMY cost <b>{money(order.camyCost ?? order.amount)}</b></span><span>My profit <b>{money(order.entrepreneurMargin)}</b></span><span>Payment <b>COD</b></span><span>Payout <b>{payoutLabel(order)}</b></span>{order.payoutReceipt&&<a href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View CAMY transfer receipt</a>}</div></div>
        <span className={`market-status ${String(order.status).toLowerCase()}`}>{order.status}</span>
      </article>) : <p>No client orders yet. Your submitted orders and CAMY delivery updates will appear here automatically.</p>}
    </section>
  </div>
}

function CreditRequestCentre({ requests, products, cancellingId, cancelRequest, requestExtension, onPayRequest, setPage }) {
  const [selected,setSelected]=useState(null), [status,setStatus]=useState('All'), [query,setQuery]=useState(''), [from,setFrom]=useState(''), [to,setTo]=useState('')
  const [datePreset,setDatePreset]=useState('all')
  const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false)
  const [extensionDate,setExtensionDate]=useState(''), [extensionReason,setExtensionReason]=useState(''), [extensionBusy,setExtensionBusy]=useState(false)
  const [,setCountdownTick]=useState(0)
  useEffect(()=>{const timer=setInterval(()=>setCountdownTick(value=>value+1),60000);return()=>clearInterval(timer)},[])
  const statuses=['All','Pending','Approved','Dispatched','Cancelled','Rejected']
  const statusCounts=useMemo(()=>statuses.reduce((counts,item)=>({...counts,[item]:item==='All'?requests.length:requests.filter(request=>request.status===item).length}),{}),[requests])
  const visible=useMemo(()=>[...requests].filter(request=>(status==='All'||request.status===status)&&(!from||String(request.createdAt||'').slice(0,10)>=from)&&(!to||String(request.createdAt||'').slice(0,10)<=to)&&`${request.id} ${request.status}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),[requests,status,query,from,to])
  const clear=()=>{setStatus('All');setQuery('');setFrom('');setTo('');setDatePreset('all')}
  const setDateRange=range=>{const today=new Date(),iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;setDatePreset(range);if(range==='all'){setFrom('');setTo('');return}const start=new Date(today);if(range==='week')start.setDate(start.getDate()-6);if(range==='month')start.setDate(1);setFrom(range==='today'?iso(today):iso(start));setTo(iso(today))}
  const filterSummary=[status!=='All'&&status,query.trim()&&`Search: ${query.trim()}`,from&&`From ${from}`,to&&`To ${to}`].filter(Boolean).join(' · ')||'All requests'
  const sendExtension=async request=>{if(!extensionDate||extensionReason.trim().length<10)return;setExtensionBusy(true);try{if(await requestExtension?.(request.id,extensionDate,extensionReason.trim())){setExtensionDate('');setExtensionReason('')}}finally{setExtensionBusy(false)}}
  if(selected){
    const request=requests.find(item=>item.id===selected.id)||selected
    const cancelled=['Cancelled','Rejected'].includes(request.status)
    const items=(request.items||[]).map(item=>({item,product:products.find(product=>String(product.id)===String(item.productId))}))
    const units=items.reduce((sum,{item})=>sum+Number(item.qty||0),0), approved=['Approved','Dispatched'].includes(request.status), dispatched=request.status==='Dispatched', countdown=creditRepaymentCountdown(request)
    return <section className="credit-request-detail-page"><header><button type="button" onClick={()=>setSelected(null)}>← All credit requests</button><div><small>REQUEST NUMBER</small><h2>{request.id}</h2><p>Submitted {requestDate(request.createdAt)}</p></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></header>
      {cancelled?<div className="credit-request-closed"><X/><div><small>REQUEST CLOSED</small><h3>{request.status==='Cancelled'?'Cancelled by you':'Rejected by CAMY'}</h3><p>{creditRequestMessage(request.status)}</p><span>Original request value <strong>{money(request.total)}</strong></span><span>Closed {requestDate(request.updatedAt||request.reviewedAt)}</span></div></div>:<>
        <div className="credit-detail-kpis"><span><small>REQUEST VALUE</small><strong>{money(request.total)}</strong></span><span><small>PRODUCTS</small><strong>{items.length}</strong></span><span><small>TOTAL UNITS</small><strong>{units}</strong></span><span><small>LAST UPDATED</small><strong>{requestDate(request.updatedAt||request.reviewedAt||request.createdAt)}</strong></span></div>
        <div className="credit-request-products"><div className="credit-request-product-head"><span>Product</span><span>Unit price</span><span>Quantity</span><span>Line total</span></div>{items.map(({item,product},index)=><div className="credit-request-product" key={item.productId||index}><span><img src={product?.image||'/products/classic-set.png'} alt=""/><span><strong>{product?.name||'CAMY product'}</strong><small>{product?.code||item.productId}</small></span></span><span>{money(item.price??product?.price)}</span><span>{item.qty}</span><strong>{money(Number(item.price??product?.price??0)*Number(item.qty||0))}</strong></div>)}</div>
        <div className="credit-request-progress"><span className="done"><i><CheckCircle2/></i><b>Requested</b><small>{requestDate(request.createdAt)}</small></span><hr className={approved?'done':''}/><span className={approved?'done':''}><i>{approved?<CheckCircle2/>:'2'}</i><b>Approved</b><small>{approved?requestDate(request.approvedAt||request.reviewedAt):'Waiting for CAMY'}</small></span><hr className={dispatched?'done':''}/><span className={dispatched?'done':''}><i>{dispatched?<CheckCircle2/>:'3'}</i><b>Dispatched</b><small>{dispatched?requestDate(request.dispatchedAt||request.creditIssuedAt):'Not dispatched yet'}</small></span></div>
        {dispatched&&<section className="credit-repayment-detail"><header><span><CalendarDays/></span><div><small>{repaymentDays(request)}-DAY CREDIT REPAYMENT</small><h3>Pay by {request.creditDueAt?requestDate(request.creditDueAt):`${repaymentDays(request)} days after dispatch`}</h3><p>{money(request.creditIssuedAmount??request.total)} was added to your outstanding credit when CAMY dispatched this stock.</p></div></header><div><article><Banknote/><span><strong>Bank transfer</strong><small>Transfer the amount to CAMY, enter the transaction reference and upload the bank receipt. CAMY verifies it before reducing your balance.</small></span></article><article><PackageCheck/><span><strong>Cash at CAMY store</strong><small>Pay at a CAMY store. A CAMY administrator records and verifies the cash payment in the system.</small></span></article></div><button type="button" onClick={()=>{const openPayment=onPayRequest||globalThis.__camyOpenCreditPayment;if(openPayment)openPayment(request.id);else setPage?.('credit')}}>Pay this credit order <ArrowRight/></button>{request.extensionRequest?.status==='Pending'?<div className="credit-extension-status"><strong>Extra-time request under review</strong><span>Requested until {requestDate(request.extensionRequest.requestedDueAt)}</span><p>{request.extensionRequest.reason}</p></div>:request.extensionRequest?.status==='Approved'?<div className="credit-extension-status approved"><strong>Extra payment time approved</strong><span>New deadline: {requestDate(request.creditDueAt)}</span>{request.extensionRequest.adminNote&&<p>{request.extensionRequest.adminNote}</p>}</div>:<form className="credit-extension-form" onSubmit={event=>{event.preventDefault();sendExtension(request)}}><strong>Need more time?</strong><p>Request a later payment date. CAMY Admin will review and approve or reject it.</p>{request.extensionRequest?.status==='Rejected'&&<small>Previous request rejected{request.extensionRequest.adminNote?`: ${request.extensionRequest.adminNote}`:'. You may submit another request.'}</small>}<label>Requested payment date<input type="date" min={String(request.creditDueAt||'').slice(0,10)} required value={extensionDate} onChange={event=>setExtensionDate(event.target.value)}/></label><label>Reason<textarea required minLength="10" maxLength="1000" rows="3" value={extensionReason} onChange={event=>setExtensionReason(event.target.value)} placeholder="Explain why you need additional time..."/></label><button type="submit" disabled={extensionBusy||!extensionDate||extensionReason.trim().length<10}>{extensionBusy?'Sending…':'Request more time'}</button></form>}</section>}
        <footer className="credit-detail-footer"><div><strong>{request.status==='Pending'?'Waiting for CAMY approval':request.status==='Approved'?'Approved — CAMY is preparing dispatch':'Credit stock issued'}</strong><p>{creditRequestMessage(request.status)}</p></div>{request.status==='Pending'&&<button type="button" className="credit-request-cancel" disabled={cancellingId===request.id} onClick={()=>cancelRequest(request)}>{cancellingId===request.id?'Cancelling…':'Cancel request'}</button>}</footer>
      </>}
    </section>
  }
  return <section className="credit-request-centre">
    <button type="button" className="credit-request-mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="credit-order-filter-panel" onClick={()=>setMobileFiltersOpen(open=>!open)}><span><ListFilter/><span><small>FILTER ORDERS</small><strong>{filterSummary}</strong></span></span><span>{visible.length} result{visible.length===1?'':'s'} <ChevronDown/></span></button>
    <section id="credit-order-filter-panel" className={`credit-request-filter-panel${mobileFiltersOpen?' mobile-open':''}`} aria-label="Credit order filters">
      <div className="credit-request-filter-heading"><div><small>FILTER BY STATUS</small><strong>Choose an order stage</strong></div><span>{visible.length} matching request{visible.length===1?'':'s'}</span></div>
      <div className="credit-request-status-filters" role="group" aria-label="Filter requests by status">{statuses.map(item=><button type="button" className={`${item.toLowerCase()}${status===item?' active':''}`} aria-pressed={status===item} key={item} onClick={()=>{setStatus(item);setMobileFiltersOpen(false)}}><span><i/>{item}</span><strong>{statusCounts[item]}</strong></button>)}</div>
      <div className="credit-request-tools"><label className="credit-request-search"><span>Search request</span><div><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Enter request number"/></div></label><label>From date<input type="date" value={from} onChange={event=>{setFrom(event.target.value);setDatePreset('custom')}}/></label><label>To date<input type="date" min={from} value={to} onChange={event=>{setTo(event.target.value);setDatePreset('custom')}}/></label><button type="button" onClick={clear}>Clear all</button></div>
      <div className="credit-request-date-shortcuts"><span>Quick date</span>{[['all','All dates'],['today','Today'],['week','Last 7 days'],['month','This month']].map(([value,label])=><button type="button" className={datePreset===value?'active':''} aria-pressed={datePreset===value} key={value} onClick={()=>setDateRange(value)}>{label}</button>)}</div>
    </section>
    <div className="credit-request-export"><span><FileSpreadsheet/></span><div><strong>Export filtered credit orders</strong><small>{visible.length} of {requests.length} requests · {filterSummary}</small></div><button type="button" disabled={!visible.length} onClick={()=>exportReport(`camy-credit-requests-${from||'all'}-${to||'dates'}.xlsx`,visible.map(request=>({request:request.id,status:request.status,requestedAt:request.createdAt,lastUpdated:request.updatedAt||request.reviewedAt,total:Number(request.total||0),products:(request.items||[]).length,units:(request.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0),dispatchedAt:request.creditIssuedAt||'',paymentDue:request.creditDueAt||''})))}><FileSpreadsheet/> Download Excel</button></div>
    {visible.length?<div className="credit-request-compact-list">{visible.map(request=>{const units=(request.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0),countdown=creditRepaymentCountdown(request);return <article className={`${String(request.status).toLowerCase()} ${countdown&&countdown.days<0?'credit-overdue':countdown?.days===0?'credit-due-today':''}`.trim()} key={request.id}><span><PackageCheck/></span><div><small>REQUEST</small><strong>{request.id}</strong><p>{requestDate(request.createdAt)}</p></div><div><small>VALUE</small><strong>{money(request.total)}</strong><p>{(request.items||[]).length} products · {units} units</p></div><div><small>STATUS</small><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></div><div className="credit-request-row-note"><small>{request.status==='Dispatched'?'REPAYMENT COUNTDOWN':'NEXT STEP'}</small><strong>{creditRequestNextStep(request)}</strong></div><button type="button" onClick={()=>setSelected(request)}><Eye/> View request</button></article>})}</div>:<div className="credit-request-empty"><PackageOpen/><h3>No matching requests</h3><p>Change the status, search or date filters.</p></div>}
  </section>
}

export function CreditStockPage({ products = [], person, tiers = [], requests = [], inventory = [], submit, cancel, requestExtension, onPayRequest, notify, catalogueLive, requestsOnly = false, setPage }) {
  tiers=tiers.length?tiers:(globalThis.__camyCreditTiers||[])
  const [cart,setCart]=useState([])
  const [busy,setBusy]=useState(false)
  const [submittedId,setSubmittedId]=useState('')
  const [cancellingId,setCancellingId]=useState('')
  const [catalogueQuery,setCatalogueQuery]=useState('')
  const [category,setCategory]=useState('All products')
  const [sort,setSort]=useState('Recommended')
  const [selectedProduct,setSelectedProduct]=useState(null)
  const [mobileCreditOverviewOpen,setMobileCreditOverviewOpen]=useState(false)
  const mine=requests.filter(request=>String(request.entrepreneurId)===String(person?.id) && request.creditMode===true)
  const configuredCredit=tiers.length?creditProgression(tiers,person?.sales).credit:Number(person?.credit||0)
  const creditEligible=configuredCredit>0 && person?.stage!=='Departed' && person?.active!==false
  const used=Number(person?.used||0)
  const eligible=creditEligible
  const unpaidCreditOrder=mine.find(request=>request.status==='Dispatched'&&request.creditRepaymentStatus!=='Paid')
  const requestBlocked=Boolean(unpaidCreditOrder)
  const activeCommitment=mine.filter(request=>['Pending','Approved'].includes(request.status)).reduce((sum,request)=>sum+Number(request.total||0),0)
  const available=Math.max(0,configuredCredit-used-activeCommitment)
  const selected=cart.map(item=>({...item,product:products.find(product=>String(product.id)===String(item.productId))})).filter(item=>item.product)
  const total=selected.reduce((sum,item)=>sum+Number(item.product.price)*Number(item.qty),0)
  const myInventory=inventory.filter(item=>String(item.entrepreneurId)===String(person?.id) && Number(item.qty)>0)
  const requestableProducts=useMemo(()=>products.filter(product=>Number(product.stock)>0&&Number(product.price)<=available),[products,available])
  const categories=useMemo(()=>['All products',...Array.from(new Set(requestableProducts.map(product=>product.category||'Other'))).sort()], [requestableProducts])
  const visibleProducts=useMemo(()=>{
    const term=catalogueQuery.trim().toLowerCase()
    const filtered=requestableProducts.filter(product=>(category==='All products'||(product.category||'Other')===category)&&`${product.name||''} ${product.code||''} ${product.category||''} ${product.description||''}`.toLowerCase().includes(term))
    if(sort==='Price: low to high')return [...filtered].sort((a,b)=>Number(a.price)-Number(b.price))
    if(sort==='Price: high to low')return [...filtered].sort((a,b)=>Number(b.price)-Number(a.price))
    if(sort==='Available first')return [...filtered].sort((a,b)=>Number(b.stock>0)-Number(a.stock>0))
    return filtered
  },[requestableProducts,category,catalogueQuery,sort])

  const add=product=>setCart(old=>{
    const found=old.find(item=>String(item.productId)===String(product.id))
    return found?old.map(item=>item===found?{...item,qty:item.qty+1}:item):[...old,{productId:product.id,qty:1}]
  })
  const send=async()=>{
    if(!eligible)return notify?.('Credit stock unlocks after you become Credit eligible.')
    if(requestBlocked)return notify?.(`Pay credit order ${unpaidCreditOrder.id} before requesting more credit items.`)
    if(!selected.length)return notify?.('Choose at least one product.')
    if(total>available+0.009)return notify?.(`This request exceeds your available credit by ${money(total-available)}.`)
    setBusy(true)
    try{
      const created=await submit({items:selected.map(item=>({productId:item.product.id,qty:Number(item.qty)})),creditMode:true})
      if(created){
        setCart([])
        setSubmittedId(created.id)
        window.dispatchEvent(new Event('camy-business-updated'))
        setPage?.('credit-requests')
      }
    }finally{setBusy(false)}
  }
  const cancelRequest=async request=>{
    if(cancellingId||!window.confirm(`Cancel credit request ${request.id}? This cannot be undone.`))return
    setCancellingId(request.id)
    try{await cancel?.(request.id)}finally{setCancellingId('')}
  }

  return <div className={`content-page market-page stock-buy-page ${requestsOnly?'credit-requests-only':'credit-catalogue-page'} ${mobileCreditOverviewOpen?'credit-overview-open':''}`}>
    {requestsOnly&&<section className="credit-requests-page-head"><button type="button" onClick={()=>setPage?.('credit-stock')}>← Back to credit stock</button><div><small>CREDIT STOCK</small><h1>Credit orders</h1><p>Review every credit order, approval, dispatch, due date and payment update in one place.</p></div></section>}
    {!requestsOnly&&<button className="credit-mobile-details-toggle" type="button" aria-expanded={mobileCreditOverviewOpen} aria-controls="credit-mobile-overview" onClick={()=>setMobileCreditOverviewOpen(open=>!open)}><span><small>CREDIT ITEMS</small><strong>{mobileCreditOverviewOpen?'Hide credit details':'View credit details'}</strong></span><ChevronDown size={18}/></button>}
    <div id="credit-mobile-overview" className="credit-mobile-overview">
    <section className="stock-buy-hero credit-stock-hero"><div><small>PHASE 2 · OPTIONAL CREDIT STOCK</small><h1>Use credit when it<br/><em>fits your business.</em></h1><p>Credit-eligible entrepreneurs can choose either method at any time: keep placing normal CAMY drop-ship COD orders, or request physical CAMY stock on credit. Using credit stock does not disable drop-shipping.</p><button className="credit-stock-hero-action" type="button" onClick={()=>setPage?.('credit-inventory')}><PackageOpen/> View my stock <ArrowRight/></button></div><div className="stock-buy-steps"><span><i>1</i>Choose stock</span><span><i>2</i>CAMY approves</span><span><i>3</i>Credit balance starts on dispatch</span></div></section>
    <section className="shop-home-stats"><article><small>CREDIT LIMIT</small><strong>{money(person?.credit)}</strong><p>Your current CAMY limit</p></article><article><small>OUTSTANDING</small><strong>{money(used)}</strong><p>Credit already issued to you</p></article><article><small>AVAILABLE FOR NEW REQUESTS</small><strong>{money(available)}</strong><p>{money(activeCommitment)} temporarily reserved by pending/approved requests</p></article></section>
    </div>

    {!creditEligible&&<section className="credit-stock-lock"><LockKeyhole/><div><h2>Credit stock is not unlocked yet</h2><p>You can continue using drop-shipping normally. Once your verified CAMY product selling value reaches the first credit tier, this page unlocks automatically.</p></div></section>}
    {!catalogueLive&&<div className="market-warning">CAMY Admin must activate the real catalogue before credit stock requests can be submitted.</div>}
    {eligible&&requestBlocked&&!requestsOnly&&<div className="market-warning"><ShieldCheck size={18}/><span><strong>New credit requests are paused.</strong> Pay credit order {unpaidCreditOrder.id} before requesting more items. You can continue browsing Credit items and viewing your current stock.</span><button type="button" className="market-primary" onClick={()=>setPage?.('credit')}>Go to Credit payments</button></div>}
    {submittedId&&<section className="credit-request-success"><CheckCircle2/><div><strong>Credit request {submittedId} was sent successfully</strong><p>The request basket has been cleared. Open Credit orders from the main menu to follow approval, dispatch, and payment updates.</p></div><button type="button" onClick={()=>setSubmittedId('')}>Dismiss</button></section>}
    {eligible&&selected.length>0&&<button className="mobile-credit-request" type="button" onClick={()=>document.querySelector('.credit-catalogue-layout .stock-request-card')?.scrollIntoView({behavior:'smooth',block:'start'})}><ShoppingCart size={19}/><span><small>{selected.reduce((sum,item)=>sum+Number(item.qty||0),0)} units selected</small><strong>View credit request</strong></span><b>{money(total)}</b></button>}

    {eligible&&<div className="stock-buy-layout credit-catalogue-layout"><section><div className="stock-catalogue-title"><div><small>CAMY CREDIT CATALOGUE</small><h2>Choose stock to receive</h2></div><span><CircleDollarSign size={16}/> {money(available)} available</span></div><div className="credit-catalogue-tools"><label><Search/><input type="search" value={catalogueQuery} onChange={event=>setCatalogueQuery(event.target.value)} placeholder="Search product name, code or category"/></label><select aria-label="Sort credit products" value={sort} onChange={event=>setSort(event.target.value)}><option>Recommended</option><option>Available first</option><option>Price: low to high</option><option>Price: high to low</option></select><span>{visibleProducts.length} of {products.length} products</span></div><nav className="credit-category-tabs" aria-label="Credit product categories">{categories.map(item=><button type="button" className={category===item?'active':''} aria-pressed={category===item} key={item} onClick={()=>setCategory(item)}>{item}</button>)}</nav><div className="stock-product-grid">{visibleProducts.map(product=>{
      const inCart=cart.find(item=>String(item.productId)===String(product.id))
      const availableStock=Number(product.stock)>0
      return <article className="stock-product-card credit-product-card" key={product.id}><button className="stock-product-image" type="button" onClick={()=>setSelectedProduct(product)}><img src={product.image} alt={product.name}/><span>{product.category}</span><i><Eye size={16}/></i></button><div className="stock-product-copy"><small>{product.code||product.category}</small><h3>{product.name}</h3><p>{product.description||'CAMY product available for credit supply.'}</p><div className="credit-product-facts"><span><small>STOCK</small><strong>{availableStock?product.stock:'0'} units</strong></span>{product.warranty&&<span><small>WARRANTY</small><strong>{product.warranty}</strong></span>}</div><div className="stock-product-meta"><span className={availableStock?'available':'unavailable'}><i/> {availableStock?'Available at CAMY':'Unavailable'}</span><strong>{money(product.price)}</strong></div><div className="credit-product-actions"><button className="stock-details" type="button" onClick={()=>setSelectedProduct(product)}>View details</button><button className="market-primary" disabled={requestBlocked||!availableStock||Number(product.price)>available} onClick={()=>add(product)}>{requestBlocked?'Payment required':inCart?`Add another (${inCart.qty})`:'Add to request'} <ArrowRight size={15}/></button></div></div></article>
    })}</div></section><aside className="market-checkout stock-request-card"><header><span><PackageCheck size={19}/></span><div><small>CREDIT STOCK REQUEST</small><h2>Request summary</h2></div></header>{selected.length?selected.map(item=><div className="market-line" key={item.productId}><span><strong>{item.product.name}</strong><small>{money(item.product.price)} each</small></span><input type="number" min="1" value={item.qty} onChange={event=>setCart(old=>old.map(entry=>String(entry.productId)===String(item.productId)?{...entry,qty:Math.max(1,Number(event.target.value)||1)}:entry))}/><button onClick={()=>setCart(old=>old.filter(entry=>String(entry.productId)!==String(item.productId)))}><X size={15}/></button></div>):<div className="stock-cart-empty"><PackageOpen size={23}/><p>{requestBlocked?'Pay your outstanding credit order to start a new request.':'Choose products for your credit request.'}</p></div>}<div className="market-total"><span>Credit request</span><strong>{money(total)}</strong></div><div className={requestBlocked||total>available?'market-warning':'credit-safe-note'}><ShieldCheck size={15}/>{requestBlocked?` Pay ${unpaidCreditOrder.id} before sending another credit request.`:total>available?` Reduce this request by ${money(total-available)} to stay within your available credit.`:' No payment or receipt is required now. Your outstanding credit increases only when CAMY dispatches the approved stock.'}</div><button className="market-primary" disabled={requestBlocked||!catalogueLive||!selected.length||busy||total>available} onClick={send}>{busy?'Sending…':requestBlocked?'Payment required':'Send credit request'} <ArrowRight size={17}/></button></aside></div>}

    {selectedProduct&&<PortalOverlay className="credit-product-dialog-overlay" onClose={()=>setSelectedProduct(null)} label={`${selectedProduct.name} details`}><section className="credit-product-dialog"><button className="credit-product-dialog-close" type="button" onClick={()=>setSelectedProduct(null)} aria-label="Close product details"><X/></button><div className="credit-product-dialog-image"><img src={selectedProduct.image} alt={selectedProduct.name}/><span>{selectedProduct.category}</span></div><div className="credit-product-dialog-copy"><small>{selectedProduct.code||selectedProduct.category}</small><h2>{selectedProduct.name}</h2><p>{selectedProduct.description||'CAMY product available for credit supply.'}</p><div className="credit-product-dialog-stats"><span><small>CAMY PRICE</small><strong>{money(selectedProduct.price)}</strong></span><span><small>AVAILABLE STOCK</small><strong>{Number(selectedProduct.stock)>0?`${selectedProduct.stock} units`:'Out of stock'}</strong></span>{selectedProduct.warranty&&<span><small>WARRANTY</small><strong>{selectedProduct.warranty}</strong></span>}</div>{selectedProduct.specs?.length>0&&<div className="credit-product-specs"><h3>Product details</h3><ul>{selectedProduct.specs.map((spec,index)=><li key={index}><CheckCircle2/>{spec}</li>)}</ul></div>}<button className="market-primary" type="button" disabled={requestBlocked||Number(selectedProduct.stock)<=0||Number(selectedProduct.price)>available} onClick={()=>{add(selectedProduct);setSelectedProduct(null)}}>{requestBlocked?'Payment required':'Add to credit request'} <ArrowRight/></button></div></section></PortalOverlay>}

    <section className="market-history stock-request-history credit-request-history"><div className="credit-request-history-heading"><div><small>CREDIT REQUEST HISTORY</small><h2>My requests</h2><p>Every credit-stock request, its products, value and current progress.</p></div><b>{mine.length} request{mine.length===1?'':'s'}</b></div>{mine.length?<div className="credit-request-list">{[...mine].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(request=>{
      const items=(request.items||[]).map(item=>({item,product:products.find(product=>String(product.id)===String(item.productId))}))
      const units=items.reduce((sum,{item})=>sum+Number(item.qty||0),0)
      const approved=['Approved','Dispatched'].includes(request.status)
      const dispatched=request.status==='Dispatched'
      return <article className="credit-request-card" key={request.id}>
        <header><div><small>REQUEST NUMBER</small><h3>{request.id}</h3><p>Requested {requestDate(request.createdAt)}</p></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></header>
        <div className="credit-request-summary"><span><small>REQUEST VALUE</small><strong>{money(request.total)}</strong></span><span><small>PRODUCTS</small><strong>{items.length}</strong></span><span><small>TOTAL UNITS</small><strong>{units}</strong></span><span><small>LAST UPDATED</small><strong>{requestDate(request.updatedAt||request.reviewedAt||request.createdAt)}</strong></span></div>
        <div className="credit-request-products"><div className="credit-request-product-head"><span>Product</span><span>Unit price</span><span>Quantity</span><span>Line total</span></div>{items.map(({item,product},index)=><div className="credit-request-product" key={item.productId||index}><span><img src={product?.image||'/products/classic-set.png'} alt=""/><span><strong>{product?.name||'CAMY product'}</strong><small>{product?.code||item.productId}</small></span></span><span>{money(item.price??product?.price)}</span><span>{item.qty}</span><strong>{money(Number(item.price??product?.price??0)*Number(item.qty||0))}</strong></div>)}</div>
        <div className="credit-request-progress" aria-label={`Request status: ${request.status}`}><span className="done"><i><CheckCircle2/></i><b>Requested</b><small>{requestDate(request.createdAt)}</small></span><hr className={approved?'done':''}/><span className={approved?'done':['Rejected','Cancelled'].includes(request.status)?'rejected':''}><i>{approved?<CheckCircle2/>:'2'}</i><b>{request.status==='Rejected'?'Rejected':request.status==='Cancelled'?'Cancelled':'Approved'}</b><small>{['Rejected','Cancelled'].includes(request.status)?'Request closed':approved?requestDate(request.approvedAt||request.reviewedAt):'Waiting for CAMY'}</small></span><hr className={dispatched?'done':''}/><span className={dispatched?'done':''}><i>{dispatched?<CheckCircle2/>:'3'}</i><b>Dispatched</b><small>{dispatched?requestDate(request.creditIssuedAt||request.updatedAt):'Not dispatched yet'}</small></span></div>
        <footer><div><strong>{request.status==='Pending'?'Approval pending':request.status==='Approved'?'Approved — preparing dispatch':request.status==='Dispatched'?'Stock and credit issued':request.status==='Rejected'?'Request rejected':request.status==='Cancelled'?'Cancelled by you':request.status}</strong><p>{creditRequestMessage(request.status)}</p>{request.status==='Dispatched'&&<button type="button" className="credit-payment-link" onClick={()=>setPage?.('credit')}>Choose repayment method <ArrowRight size={14}/></button>}</div>{request.status==='Pending'&&<button type="button" className="credit-request-cancel" disabled={cancellingId===request.id} onClick={()=>cancelRequest(request)}>{cancellingId===request.id?'Cancelling…':'Cancel request'}</button>}{request.status==='Dispatched'&&<span><small>PAY WITHIN {repaymentDays(request)} DAYS</small><strong>{request.creditDueAt?requestDate(request.creditDueAt):`${repaymentDays(request)} days after dispatch`}</strong><small>{money(request.creditIssuedAmount??request.total)} issued</small></span>}</footer>
      </article>
    })}</div>:<div className="credit-request-empty"><PackageOpen/><h3>No credit stock requests yet</h3><p>Products you submit for CAMY credit will appear here with approval and dispatch updates.</p></div>}</section>
    {requestsOnly&&<CreditRequestCentre requests={mine} products={products} cancellingId={cancellingId} cancelRequest={cancelRequest} requestExtension={requestExtension} onPayRequest={onPayRequest} setPage={setPage}/>}
  </div>
}

export function CreditInventoryPage({ products=[], person, inventory=[], setPage }) {
  const rows=inventory.filter(item=>String(item.entrepreneurId)===String(person?.id)&&Number(item.qty)>0).map(item=>({item,product:products.find(product=>String(product.id)===String(item.productId))})).sort((a,b)=>String(a.product?.name||a.item.productId).localeCompare(String(b.product?.name||b.item.productId)))
  const units=rows.reduce((sum,{item})=>sum+Number(item.qty||0),0)
  const value=rows.reduce((sum,{item,product})=>sum+Number(item.qty||0)*Number(product?.price||0),0)
  return <div className="content-page credit-inventory-page"><header><button type="button" onClick={()=>setPage?.('credit-stock')}>← Back to credit stock</button><div><small>MY CREDIT STOCK</small><h1>Products currently issued to me</h1><p>Each CAMY product received through approved credit-stock orders is shown separately.</p></div></header><section className="credit-inventory-summary"><article><small>PRODUCTS</small><strong>{rows.length}</strong><p>Different CAMY products</p></article><article><small>TOTAL UNITS</small><strong>{units}</strong><p>Units currently recorded</p></article><article><small>CAMY STOCK VALUE</small><strong>{money(value)}</strong><p>Based on current CAMY prices</p></article></section>{rows.length?<section className="credit-inventory-products">{rows.map(({item,product})=><article key={item.productId}><div className="credit-inventory-image">{product?.image?<img src={product.image} alt={product.name}/>:<PackageOpen/>}</div><div><small>{product?.code||item.productId} · {product?.category||'CAMY product'}</small><h2>{product?.name||'CAMY product'}</h2><p>{product?.description||'Product issued through CAMY business credit.'}</p></div><dl><span><dt>Quantity in stock</dt><dd>{item.qty} units</dd></span><span><dt>CAMY unit price</dt><dd>{money(product?.price)}</dd></span><span><dt>Recorded value</dt><dd>{money(Number(item.qty||0)*Number(product?.price||0))}</dd></span></dl></article>)}</section>:<section className="credit-inventory-empty"><PackageOpen/><h2>No credit stock issued yet</h2><p>Products appear here after CAMY approves and dispatches a credit-stock order.</p></section>}</div>
}

function RejectedCreditRequestEditor({ requests, products, review }) {
  const [requestId,setRequestId]=useState(requests[0]?.id||'')
  const request=requests.find(item=>String(item.id)===String(requestId))||requests[0]
  const [items,setItems]=useState(()=>request?.items?.map(item=>({...item}))||[])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{setItems(request?.items?.map(item=>({...item}))||[]);setError('')},[request?.id])
  if(!request)return null
  const total=items.reduce((sum,item)=>sum+Number(item.qty||0)*Number(products.find(product=>String(product.id)===String(item.productId))?.price??item.price??0),0)
  const save=async()=>{setBusy(true);setError('');try{await review(request.id,'Edited',undefined,items)}catch(failure){setError(failure.message||'The request could not be updated.')}finally{setBusy(false)}}
  return <section className="rejected-credit-editor"><header><div><small>CORRECT REJECTED REQUEST</small><h2>Edit and reopen for review</h2><p>Update quantities, then return the request to Pending for a fresh approval decision.</p></div><label>Rejected request<select value={request.id} onChange={event=>setRequestId(event.target.value)}>{requests.map(item=><option key={item.id} value={item.id}>{item.id} · {item.entrepreneurName||item.entrepreneurId}</option>)}</select></label></header><div className="rejected-credit-editor-items">{items.map((item,index)=>{const product=products.find(entry=>String(entry.id)===String(item.productId));return <article key={item.productId}><div>{product?.image&&<img src={product.image} alt=""/>}<span><strong>{product?.name||item.productId}</strong><small>{money(product?.price??item.price)} each</small></span></div><label>Quantity<input aria-label={`${product?.name||item.productId} quantity`} type="number" min="1" step="1" value={item.qty} onChange={event=>setItems(old=>old.map((entry,position)=>position===index?{...entry,qty:Math.max(1,Number(event.target.value)||1)}:entry))}/></label><button type="button" disabled={busy||items.length===1} onClick={()=>setItems(old=>old.filter((_,position)=>position!==index))}><Trash2/> Remove</button></article>})}</div>{error&&<p className="market-error" role="alert">{error}</p>}<footer><div><small>UPDATED REQUEST VALUE</small><strong>{money(total)}</strong><p>Live CAMY prices, stock and available credit are checked again when saved.</p></div><button type="button" className="market-primary" disabled={busy||!items.length} onClick={save}>{busy?'Saving…':'Save and return to review'} <ArrowRight/></button></footer></section>
}

export function AdminCreditStockPage({ requests = [], products = [], entrepreneurs = [], inventory = [], review, reviewExtension, catalogueLive }) {
  const [filter,setFilter]=useState('Active')
  const [query,setQuery]=useState('')
  const [busyId,setBusyId]=useState('')
  const [openId,setOpenId]=useState('')
  const [actionErrors,setActionErrors]=useState({})
  const [actionMessage,setActionMessage]=useState('')
  const [extensionReviewId,setExtensionReviewId]=useState('')
  const [extensionReviewNote,setExtensionReviewNote]=useState('')
  const creditRequests=requests.filter(request=>request.creditMode===true)
  const pendingExtensions=creditRequests.filter(request=>request.extensionRequest?.status==='Pending')
  const requestCounts={Pending:creditRequests.filter(item=>item.status==='Pending').length,Approved:creditRequests.filter(item=>item.status==='Approved').length,Dispatched:creditRequests.filter(item=>item.status==='Dispatched').length,Rejected:creditRequests.filter(item=>item.status==='Rejected').length}
  const activeValue=creditRequests.filter(item=>['Pending','Approved'].includes(item.status)).reduce((sum,item)=>sum+Number(item.total||0),0)
  const visible=creditRequests.filter(request=>{
    const person=entrepreneurs.find(person=>String(person.id)===String(request.entrepreneurId))
    const text=`${request.id} ${person?.name||''} ${request.entrepreneurId||''}`.toLowerCase()
    const matchText=text.includes(query.trim().toLowerCase())
    const matchFilter=filter==='All'||(filter==='Extensions'&&request.extensionRequest?.status==='Pending')||(filter==='Active'?['Pending','Approved'].includes(request.status):request.status===filter)
    return matchText&&matchFilter
  }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))

  const act=async(id,status)=>{
    setBusyId(id)
    setActionMessage('')
    setActionErrors(old=>({...old,[id]:''}))
    try{
      await review(id,status)
      setActionMessage(`${id} was ${status.toLowerCase()} successfully.`)
    }catch(error){
      setActionErrors(old=>({...old,[id]:error.message||'The request could not be completed. Please try again.'}))
    }finally{setBusyId('')}
  }
  const decideExtension=async(id,decision)=>{setBusyId(id);try{if(await reviewExtension?.(id,decision,extensionReviewNote.trim())){setActionMessage(`${id} payment extension ${decision.toLowerCase()}.`);setExtensionReviewId('');setExtensionReviewNote('')}}finally{setBusyId('')}}

  const extensionOrder=creditRequests.find(request=>request.id===extensionReviewId)
  if(extensionOrder){
    const extension=extensionOrder.extensionRequest||{}
    const person=entrepreneurs.find(item=>String(item.id)===String(extensionOrder.entrepreneurId))
    const extensionItems=(extensionOrder.items||[]).map(item=>({item,product:products.find(product=>String(product.id)===String(item.productId))}))
    const currentDue=new Date(extensionOrder.creditDueAt), requestedDue=new Date(extension.requestedDueAt)
    const extraDays=!Number.isNaN(currentDue.getTime())&&!Number.isNaN(requestedDue.getTime())?Math.max(0,Math.ceil((requestedDue-currentDue)/86400000)):0
    return <div className="content-page market-page credit-extension-review-page">
      <header className="extension-review-heading"><button type="button" onClick={()=>{setExtensionReviewId('');setExtensionReviewNote('')}}>← Back to credit stock</button><div><small>PAYMENT EXTENSION REVIEW</small><h1>Review extra-time request</h1><p>Check the complete credit order and repayment history before making a decision.</p></div><span className="market-status pending">Pending review</span></header>
      <section className="extension-review-hero"><div><small>CREDIT ORDER</small><h2>{extensionOrder.id}</h2><p>{person?.name||extensionOrder.entrepreneurName} · {extensionOrder.entrepreneurId}</p></div><div><small>ORDER VALUE</small><strong>{money(extensionOrder.creditIssuedAmount??extensionOrder.total)}</strong><span>Dispatched {requestDate(extensionOrder.creditIssuedAt)}</span></div><div><small>EXTRA TIME REQUESTED</small><strong>{extraDays} day{extraDays===1?'':'s'}</strong><span>Submitted {requestDate(extension.requestedAt)}</span></div></section>
      <div className="extension-review-grid"><section><header><small>DEADLINE COMPARISON</small><h2>Requested payment schedule</h2></header><div className="extension-date-comparison"><article><CalendarDays/><span><small>CURRENT DEADLINE</small><strong>{requestDate(extensionOrder.creditDueAt)}</strong><p>{repaymentDays(extensionOrder)}-day standard repayment term</p></span></article><ArrowRight/><article className="requested"><CalendarDays/><span><small>REQUESTED DEADLINE</small><strong>{requestDate(extension.requestedDueAt)}</strong><p>{extraDays} additional day{extraDays===1?'':'s'}</p></span></article></div><div className="extension-reason"><small>ENTREPRENEUR'S REASON</small><p>{extension.reason}</p></div><label className="extension-admin-note">Admin note (optional)<textarea rows="4" maxLength="1000" value={extensionReviewNote} onChange={event=>setExtensionReviewNote(event.target.value)} placeholder="Add a reason or instructions for the entrepreneur..."/></label></section><aside><header><small>ENTREPRENEUR CREDIT</small><h2>{person?.name||'Entrepreneur'}</h2></header><dl><div><dt>Credit limit</dt><dd>{money(person?.credit)}</dd></div><div><dt>Currently outstanding</dt><dd>{money(person?.used)}</dd></div><div><dt>This credit order</dt><dd>{money(extensionOrder.total)}</dd></div><div><dt>Current tier</dt><dd>{repaymentDays(extensionOrder)===21?'First tier':'Higher tier'}</dd></div></dl></aside></div>
      <section className="extension-review-products"><header><div><small>ORDER CONTENTS</small><h2>Products issued on credit</h2></div><b>{extensionItems.reduce((sum,{item})=>sum+Number(item.qty||0),0)} units</b></header>{extensionItems.map(({item,product},index)=><article key={item.productId||index}>{product?.image?<img src={product.image} alt=""/>:<PackageOpen/>}<div><strong>{product?.name||'CAMY product'}</strong><small>{product?.code||item.productId}</small></div><span><small>Quantity</small><strong>{item.qty}</strong></span><span><small>Unit price</small><strong>{money(item.price)}</strong></span><b>{money(Number(item.qty||0)*Number(item.price||0))}</b></article>)}</section>
      <footer className="extension-review-actions"><div><AlertCircle/><span><strong>Review before deciding</strong><small>Approval replaces the current repayment deadline with the requested date.</small></span></div><button type="button" disabled={busyId===extensionOrder.id} onClick={()=>decideExtension(extensionOrder.id,'Rejected')}>Reject request</button><button type="button" className="market-primary" disabled={busyId===extensionOrder.id} onClick={()=>decideExtension(extensionOrder.id,'Approved')}>{busyId===extensionOrder.id?'Saving…':'Approve new deadline'}</button></footer>
    </div>
  }

  return <div className="content-page market-page">
    <div className="market-heading credit-stock-heading"><div><small>CREDIT STOCK REQUESTS</small><h1>Review and issue stock</h1><p>Check the entrepreneur's credit and product availability, reserve approved items, then record dispatch when the stock leaves CAMY.</p></div><div className="credit-stock-heading-actions"><button type="button" className={filter==='Extensions'?'active':''} onClick={()=>setFilter('Extensions')}><CalendarDays/> Extra-time requests{pendingExtensions.length>0&&<b aria-label={`${pendingExtensions.length} pending extra-time requests`}>{pendingExtensions.length}</b>}</button><div className="credit-stock-flow"><span><b>1</b> Review request</span><span><b>2</b> Reserve stock</span><span><b>3</b> Dispatch and issue credit</span></div></div></div>
    {!catalogueLive&&<div className="market-warning">The CAMY catalogue is not active. Activate and verify warehouse stock before dispatching credit stock.</div>}
    <section className="credit-stock-overview">
      <button type="button" className={filter==='Pending'?'active':''} onClick={()=>setFilter('Pending')}><span><AlertCircle/></span><div><small>NEEDS A DECISION</small><strong>{requestCounts.Pending}</strong><p>Requests waiting for approval</p></div></button>
      <button type="button" className={filter==='Approved'?'active':''} onClick={()=>setFilter('Approved')}><span><PackageCheck/></span><div><small>READY TO DISPATCH</small><strong>{requestCounts.Approved}</strong><p>Approved with stock reserved</p></div></button>
      <button type="button" className={filter==='Dispatched'?'active':''} onClick={()=>setFilter('Dispatched')}><span><Truck/></span><div><small>STOCK ISSUED</small><strong>{requestCounts.Dispatched}</strong><p>Credit is now outstanding</p></div></button>
      <button type="button" className={filter==='Active'?'active':''} onClick={()=>setFilter('Active')}><span><CircleDollarSign/></span><div><small>ACTIVE REQUEST VALUE</small><strong>{money(activeValue)}</strong><p>Pending and approved requests</p></div></button>
    </section>
    <div className="credit-stock-admin-filters"><input placeholder="Search request, entrepreneur or member ID" value={query} onChange={event=>setQuery(event.target.value)}/><select value={filter} onChange={event=>setFilter(event.target.value)}><option>Active</option><option value="Extensions">Extra-time requests</option><option>Pending</option><option>Approved</option><option>Dispatched</option><option>Rejected</option><option>All</option></select></div>
    {busyId&&<div className="credit-admin-action-status"><RefreshCw/><span><strong>Updating {busyId}</strong><small>Please wait while CAMY verifies credit and reserves warehouse stock.</small></span></div>}
    {actionMessage&&!busyId&&<div className="credit-admin-action-status success"><CheckCircle2/><span><strong>{actionMessage}</strong><small>The request list and warehouse stock have been refreshed.</small></span><button type="button" onClick={()=>setActionMessage('')}>Dismiss</button></div>}
    {filter==='Rejected'&&<RejectedCreditRequestEditor requests={visible} products={products} review={review}/>}
    <section className="credit-stock-admin-list">{visible.length?visible.map(request=>{
      const person=entrepreneurs.find(person=>String(person.id)===String(request.entrepreneurId))
      const committed=creditRequests.filter(entry=>entry.id!==request.id&&String(entry.entrepreneurId)===String(request.entrepreneurId)&&['Pending','Approved'].includes(entry.status)).reduce((sum,entry)=>sum+Number(entry.total||0),0)
      const available=Math.max(0,Number(person?.credit||0)-Number(person?.used||0)-committed)
      const items=request.items||[]
      const units=items.reduce((sum,item)=>sum+Number(item.qty||0),0)
      const stockReady=items.every(item=>{const product=products.find(product=>String(product.id)===String(item.productId));return product&&Number(product.stock||0)>=Number(item.qty||0)})
      const creditReady=Number(request.total||0)<=available
      const afterApproval=Math.max(0,available-Number(request.total||0))
      const memberHistory=creditRequests.filter(entry=>String(entry.entrepreneurId)===String(request.entrepreneurId)).sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')))
      const countdown=creditRepaymentCountdown(request)
      return <article className={`card credit-stock-admin-card ${openId===request.id?'details-open':''} ${countdown&&countdown.days<0?'credit-overdue':''}`} key={request.id}><header><div className="credit-request-identity"><span><PackageOpen/></span><div><small>REQUEST {request.id}</small><h3>{person?.name||request.entrepreneurName||request.entrepreneurId}</h3><p>{request.entrepreneurId} · {person?.stage||'Credit status unavailable'} · Submitted {requestDate(request.createdAt||request.date)}</p></div></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></header>{request.extensionRequest?.status==='Pending'&&<section className="order-extension-alert"><div><CalendarDays/><span><strong>Extra-time request</strong><small>{requestDate(request.creditDueAt)} → {requestDate(request.extensionRequest.requestedDueAt)}</small></span><b aria-label="1 pending extra-time request">1</b></div><button type="button" onClick={()=>setExtensionReviewId(request.id)}><Eye/> View extra-time request</button></section>}<div className="credit-request-quick-view"><span><small>Requested</small><strong>{money(request.total)}</strong></span><span><small>Products</small><strong>{items.length} type{items.length===1?'':'s'} · {units} unit{units===1?'':'s'}</strong></span><span><small>Available credit</small><strong>{money(available)}</strong></span><span className={creditReady&&stockReady?'ready':'blocked'}><small>Checks</small><strong>{creditReady&&stockReady?'Ready for review':'Attention needed'}</strong></span><button type="button" onClick={()=>setOpenId(current=>current===request.id?'':request.id)}>{openId===request.id?'Hide details':'View all details'} <Eye/></button></div>{countdown&&<section className={`admin-credit-countdown compact ${countdown.days<0?'overdue':countdown.days===0?'today':''}`}><CalendarDays/><div><small>PAYMENT COUNTDOWN · {money(request.creditIssuedAmount??request.total)}</small><strong>{countdown.label}</strong><span>Pay by {requestDate(countdown.due)}</span></div></section>}{openId===request.id&&<><div className="credit-stock-admin-metrics"><span><small>REQUEST AMOUNT</small><strong>{money(request.total)}</strong><em>{items.length} product type{items.length===1?'':'s'} · {units} unit{units===1?'':'s'}</em></span><span><small>ENTREPRENEUR CREDIT LIMIT</small><strong>{money(person?.credit)}</strong><em>Maximum CAMY credit</em></span><span><small>ALREADY OWED TO CAMY</small><strong>{money(person?.used)}</strong><em>Current outstanding balance</em></span><span className={creditReady?'available':'blocked'}><small>AVAILABLE FOR THIS REQUEST</small><strong>{money(available)}</strong><em>{creditReady?`${money(afterApproval)} left after approval`:`Short by ${money(Number(request.total||0)-available)}`}</em></span></div><section className={`credit-request-check ${creditReady&&stockReady?'ready':'blocked'}`}><div><strong>{creditReady?<CheckCircle2/>:<AlertCircle/>}{creditReady?'Credit check passed':'Not enough available credit'}</strong><small>{creditReady?'This request fits within the entrepreneur’s available credit.':'Do not approve until enough credit becomes available.'}</small></div><div><strong>{stockReady?<CheckCircle2/>:<AlertCircle/>}{stockReady?'Warehouse stock available':'Warehouse stock is insufficient'}</strong><small>{stockReady?'Every requested product can be reserved now.':'Update warehouse stock before approving this request.'}</small></div></section><div className="credit-request-products"><header><div><small>PRODUCTS REQUESTED</small><strong>Check quantities and warehouse availability</strong></div><b>{units} total unit{units===1?'':'s'}</b></header>{items.map((item,index)=>{const product=products.find(product=>String(product.id)===String(item.productId));const enough=product&&Number(product.stock||0)>=Number(item.qty||0);return <article key={item.productId||index}>{product?.image?<img src={product.image} alt=""/>:<span><PackageOpen/></span>}<div><strong>{product?.name||item.productId}</strong><small>{product?.code||'Product code unavailable'}</small></div><dl><span><dt>Requested</dt><dd>{item.qty}</dd></span><span><dt>At CAMY</dt><dd>{product?.stock??0}</dd></span><span><dt>Unit price</dt><dd>{money(item.price)}</dd></span><span><dt>Line total</dt><dd>{money(Number(item.price||0)*Number(item.qty||0))}</dd></span></dl><b className={enough?'ready':'blocked'}>{enough?'In stock':'Not enough stock'}</b></article>})}</div><section className="entrepreneur-stock-history"><header><div><small>ENTREPRENEUR STOCK HISTORY</small><strong>Previous and current credit-stock requests</strong></div><b>{memberHistory.length} request{memberHistory.length===1?'':'s'}</b></header><div>{memberHistory.slice(0,6).map(entry=><article className={entry.id===request.id?'current':''} key={entry.id}><span><strong>{entry.id}</strong><small>{requestDate(entry.createdAt||entry.date)}</small></span><span><small>Amount</small><strong>{money(entry.total)}</strong></span><span><small>Products / units</small><strong>{entry.items?.length||0} / {entry.items?.reduce((sum,item)=>sum+Number(item.qty||0),0)||0}</strong></span><span className={`market-status ${String(entry.status).toLowerCase()}`}>{entry.status}</span></article>)}</div></section>{actionErrors[request.id]&&<p className="market-warning" role="alert">{actionErrors[request.id]}</p>}<footer><div><strong>{request.status==='Pending'?'Decision required':request.status==='Approved'?'Next: dispatch the reserved stock':request.status==='Dispatched'?'Stock issued successfully':'Request closed'}</strong><small>{request.status==='Pending'?'Approval reserves these units but does not create debt until dispatch.':request.status==='Approved'?'Dispatch adds the request amount to the entrepreneur’s outstanding credit.':request.status==='Dispatched'?'The products are in the entrepreneur inventory and repayment is being tracked.':'No stock or credit was issued.'}</small></div>{request.status==='Pending'&&<><button className="market-primary" disabled={busyId===request.id||!creditReady||!stockReady} onClick={()=>act(request.id,'Approved')}><CheckCircle2/> Approve and reserve</button><button disabled={busyId===request.id} onClick={()=>act(request.id,'Rejected')}>Reject request</button></>}{request.status==='Approved'&&<><button className="market-primary" disabled={busyId===request.id||!catalogueLive} onClick={()=>act(request.id,'Dispatched')}><Truck/> Confirm dispatch</button><button disabled={busyId===request.id} onClick={()=>act(request.id,'Rejected')}>Cancel approval</button></>}{request.status==='Dispatched'&&<span><CheckCircle2/> Credit and inventory recorded</span>}{request.status==='Rejected'&&<span>Closed without issuing credit</span>}</footer></>}</article>
    }):<div className="market-empty"><PackageOpen/><h2>No matching credit requests</h2><p>New Phase 2 requests will appear here.</p></div>}</section>
  </div>
}

function LegacyDropshipHome({ person, orders = [], tiers = [], setPage }) {
  const myOrders = orders.filter(order => String(order.entrepreneurId) === String(person?.id))
  const inProgress = myOrders.filter(order => !['Delivered','Returned'].includes(order.status))
  const delivered = myOrders.filter(order => order.status === 'Delivered')
  const paidMargin = myOrders.filter(order=>order.payoutStatus==='paid').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const pendingMargin = myOrders.filter(order=>order.payoutStatus==='pending_transfer').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const lifetimeMargin = delivered.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const creditEligible=Number(person?.credit||0)>0
  return <div className="content-page market-page">
    <div className="market-heading"><div><small>CAMY ENTREPRENEUR PANEL</small><h1>Welcome back, {person?.name?.split(' ')[0] || 'Entrepreneur'}.</h1><p>Drop-shipping always stays available. After you become credit eligible, you can also choose to request physical CAMY stock on credit whenever that works better for you.</p></div></div>
    <div className="shop-home-grid phase-choice-grid">
      <button onClick={() => setPage('products')}><ShoppingCart/><strong>Drop-ship COD order</strong><small>CAMY delivers to your client and collects cash on delivery</small><ArrowRight/></button>
      <button onClick={() => setPage('credit-stock')}><PackageCheck/><strong>Credit stock {creditEligible?'':'· Locked'}</strong><small>{creditEligible?'Optional Phase 2 stock using your CAMY credit limit':'Unlocks after your verified sales reach a credit tier'}</small><ArrowRight/></button>
      <button onClick={() => setPage('orders')}><Truck/><strong>Delivery tracking</strong><small>{inProgress.length} active · {delivered.length} delivered</small><ArrowRight/></button>
      <button onClick={() => setPage('credit')}><BadgeDollarSign/><strong>Credit, earnings & settlements</strong><small>Track eligibility, outstanding credit and CAMY payouts</small><ArrowRight/></button>
    </div>
    <CreditSensor person={person} tiers={tiers} orders={myOrders}/>
    <section className="shop-home-stats payout-home-stats"><article><small>TOTAL ENTREPRENEUR MARGIN</small><strong>{money(lifetimeMargin)}</strong><p>Margin from successfully delivered drop-ship client orders</p></article><article><small>TRANSFERRED BY CAMY</small><strong>{money(paidMargin)}</strong><p>Recorded payouts with CAMY bank transfer receipts</p></article><article><small>WAITING FOR TRANSFER</small><strong>{money(pendingMargin)}</strong><p>Delivered orders awaiting CAMY payout</p></article></section>
    <section className="market-history"><h2>Recent client orders</h2>{myOrders.length ? myOrders.slice(0,5).map(order => <article key={order.id}><div><strong>{order.id} · {order.customer}</strong><small>{money(order.amount)} · {statusHelp(order)}</small></div><span className="market-status">{order.status}</span></article>) : <p>Create your first COD client order from New client order.</p>}</section>
  </div>
}

export function DropshipHome({ person, orders = [], setPage, openOrders }) {
  const [mobileToolsOpen,setMobileToolsOpen]=useState(false)
  const myOrders=orders.filter(order=>String(order.entrepreneurId)===String(person?.id))
  const inProgress=myOrders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status))
  const delivered=myOrders.filter(order=>order.status==='Delivered')
  const paidMargin=myOrders.filter(order=>order.payoutStatus==='paid').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const pendingMargin=myOrders.filter(order=>order.payoutStatus==='pending_transfer').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const lifetimeMargin=delivered.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const creditEligible=Number(person?.credit||0)>0
  const availableCredit=Math.max(0,Number(person?.credit||0)-Number(person?.used||0))
  const firstName=person?.name?.split(' ')[0]||'Partner'
  const closedOrders=myOrders.filter(order=>['Delivered','Returned'].includes(order.status))
  const deliveryRate=closedOrders.length?Math.round((delivered.length/closedOrders.length)*100):100
  const nextAction=inProgress.length
    ? { icon: Truck, label: 'Follow active deliveries', detail: `${inProgress.length} order${inProgress.length===1?' is':'s are'} moving through fulfilment`, action: ()=>openOrders?.('Active') }
    : { icon: ShoppingCart, label: 'Create your next sale', detail: 'The live catalogue is ready for your next client', action: ()=>setPage('products') }
  const NextActionIcon=nextAction.icon
  return <div className="content-page entrepreneur-overview">
    <section className="home-welcome"><div><small>YOUR CAMY BUSINESS</small><h1>Good to see you, <em>{firstName}.</em></h1><p>Everything you need to sell, track orders and grow your CAMY business — all in one place.</p><span className="home-live-pill"><i/> Business overview is up to date</span></div><button type="button" onClick={()=>setPage('products')}><ShoppingCart/> Create client order <ArrowRight/></button></section>
    <nav className="home-quick-actions" aria-label="Quick actions">
      <button type="button" onClick={()=>setPage('products')}><ShoppingCart/><span>New order</span></button>
      <button type="button" onClick={()=>openOrders?.('Active')}><Truck/><span>Track</span>{inProgress.length>0&&<b>{inProgress.length}</b>}</button>
      <button type="button" onClick={()=>setPage('earnings')}><BadgeDollarSign/><span>Earnings</span></button>
      <button type="button" onClick={()=>setPage('credit')}><PackageCheck/><span>Credit</span></button>
    </nav>
    <section className="home-essential-stats">
      <button type="button" onClick={()=>openOrders?.('Active')}><span><Truck/></span><div><small>ACTIVE ORDERS</small><strong>{inProgress.length}</strong><p>{delivered.length} successfully delivered</p></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('earnings')}><span><BadgeDollarSign/></span><div><small>YOUR VERIFIED EARNINGS</small><strong>{money(lifetimeMargin)}</strong><p>{money(paidMargin)} transferred by CAMY</p></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('credit')}><span><PackageCheck/></span><div><small>AVAILABLE CREDIT</small><strong>{money(availableCredit)}</strong><p>{creditEligible?'View your credit balance and repayments':'Unlocks through verified earnings'}</p></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('earnings')}><span><CircleDollarSign/></span><div><small>RECEIVABLE COMMISSION</small><strong>{money(pendingMargin)}</strong><p>Commission ready for transfer</p></div><ArrowRight/></button>
    </section>
    <section className="home-business-pulse">
      <header><div><small>BUSINESS PULSE</small><h2>Your progress at a glance</h2></div><span>{deliveryRate}% delivery success</span></header>
      <div className="home-pulse-progress"><i style={{width:`${deliveryRate}%`}}/></div>
      <button type="button" onClick={nextAction.action}><span><NextActionIcon/></span><div><small>NEXT BEST ACTION</small><strong>{nextAction.label}</strong><p>{nextAction.detail}</p></div><ArrowRight/></button>
    </section>
    {pendingMargin>0&&<section className="home-attention"><span><BadgeDollarSign/></span><div><small>PAYMENT UPDATE</small><strong>{money(pendingMargin)} is waiting for CAMY transfer</strong><p>Open Your Earnings to see each order and payment status.</p></div><button type="button" onClick={()=>setPage('earnings')}>View your earnings <ArrowRight/></button></section>}
    <button type="button" className="home-tools-toggle" aria-expanded={mobileToolsOpen} aria-controls="home-business-tools" onClick={()=>setMobileToolsOpen(open=>!open)}><span><PackageOpen/></span><div><strong>More business tools</strong><small>Credit stock, growth and order shortcuts</small></div><ArrowRight/></button>
    <section id="home-business-tools" className={`home-destinations ${mobileToolsOpen?'mobile-open':''}`}><header><small>GO TO</small><h2>What would you like to do?</h2></header><div>
      <button type="button" onClick={()=>setPage('products')}><span><ShoppingCart/></span><div><strong>Place a client order</strong><small>Choose products and send a COD order to CAMY</small></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('orders')}><span><Truck/></span><div><strong>Track your orders</strong><small>View delivery status, invoices and commission receipts</small></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('credit-stock')}><span><PackageCheck/></span><div><strong>Manage credit stock</strong><small>Choose products and create a credit-stock request</small></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('growth')}><span><CircleDollarSign/></span><div><strong>See your growth</strong><small>Check earnings, network position and next milestone</small></div><ArrowRight/></button>
    </div></section>
  </div>
}

export function DropshipInventoryPage({ person, products = [], orders = [] }) {
  const mine = orders.filter(order => String(order.entrepreneurId) === String(person?.id))
  return <div className="content-page market-page">
    <div className="market-heading"><div><small>CAMY FULFILMENT OPTIONS</small><h1>Choose the right fulfilment path</h1><p>Use drop-shipping for direct client fulfilment. Once credit eligible, you can also request CAMY stock on credit while keeping drop-shipping available.</p></div></div>
    <section className="shop-home-stats"><article><small>CATALOGUE PRODUCTS</small><strong>{products.length}</strong><p>Products available to sell</p></article><article><small>MY DROP-SHIP ORDERS</small><strong>{mine.length}</strong><p>Orders submitted to CAMY</p></article><article><small>DELIVERED</small><strong>{mine.filter(order=>order.status==='Delivered').length}</strong><p>Successfully completed COD deliveries</p></article></section>
    <div className="market-empty"><PackageOpen/><h2>CAMY supports both paths</h2><p>Drop-ship client orders remain available even after you unlock Phase 2 credit stock.</p></div>
  </div>
}
