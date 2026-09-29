import { useMemo, useState } from 'react'
import { ArrowRight, BadgeDollarSign, Banknote, CalendarDays, CheckCircle2, CircleDollarSign, Download, Eye, FileText, LockKeyhole, PackageCheck, PackageOpen, RefreshCw, Search, ShieldCheck, ShoppingCart, Trash2, Truck, X } from 'lucide-react'
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
  const delivered = orders.filter(order => order.status === 'Delivered')
  const sales = delivered.reduce((sum, order) => sum + Number(order.entrepreneurMargin ?? Math.max(0, Number(order.amount || 0) - Number(order.camyCost ?? order.amount ?? 0))), 0)
  const progression = creditProgression(tiers, sales)
  const credit = progression.credit
  const next = progression.next
  const remaining = progression.remaining
  const phase = credit > 0 ? 'Phase 2 · Dropship + credit stock' : 'Phase 1 · Trial drop-shipping'
  return <section className="shop-home-stats">
    <article><small>CURRENT CAMY STAGE</small><strong className="phase-value">{phase}</strong><p>{credit > 0 ? 'You can keep drop-shipping and also request CAMY stock on credit. You choose which method suits each sale.' : 'Build verified delivered sales to unlock optional credit stock.'}</p></article>
    <article><small>VERIFIED PROFIT</small><strong>{money(sales)}</strong><p>Uses your margin from successfully delivered orders</p></article>
    <article><small>CURRENT CREDIT LIMIT</small><strong>{credit > 0 ? money(credit) : 'Not unlocked'}</strong><p>{next ? `${money(remaining)} more delivered profit unlocks ${money(next.credit)} credit` : 'Credit milestone unavailable'}</p><div className="credit-sensor-progress"><i style={{ width: `${progression.progress}%` }}/></div></article>
  </section>
}

export function DropshipOrderPage({ products = [], person, notify, catalogueLive, orders = [], tiers = [], setPage }) {
  const [cart, setCart] = useState([])
  const [client, setClient] = useState(blankClient)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All products')
  const [catalogueQuery, setCatalogueQuery] = useState('')
  const [detailProduct, setDetailProduct] = useState(null)
  const [mobileCheckout, setMobileCheckout] = useState(false)

  const categories = useMemo(() => ['All products', ...Array.from(new Set(products.map(product => product.category).filter(Boolean)))], [products])
  const visibleProducts = useMemo(() => products.filter(product => (category === 'All products' || product.category === category) && `${product.name} ${product.code||''} ${product.category||''} ${product.description||''}`.toLowerCase().includes(catalogueQuery.trim().toLowerCase())), [products, category, catalogueQuery])

  const selected = useMemo(() => cart.map(item => {
    const product = products.find(product => String(product.id) === String(item.productId))
    return product ? { ...item, product } : null
  }).filter(Boolean), [cart, products])

  const camyCost = selected.reduce((sum, item) => sum + Number(item.product.price) * Number(item.qty), 0)
  const clientTotal = selected.reduce((sum, item) => sum + Number(item.sellPrice) * Number(item.qty), 0)
  const estimatedMargin = clientTotal - camyCost
  const validClient = client.name.trim() && /^(?:\+94|0)7\d{8}$/.test(client.phone.replace(/[\s-]/g, '')) && client.address.trim()

  const refresh = () => {
    setRefreshing(true)
    window.dispatchEvent(new Event('camy-business-updated'))
    window.setTimeout(() => setRefreshing(false), 800)
  }

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
      notify?.(`${result.order.id} sent to CAMY as Cash on Delivery. Your margin is ${money(result.order.entrepreneurMargin)} and is transferred after successful delivery and collection.`)
      setCart([])
      setClient(blankClient)
      setMobileCheckout(false)
      window.dispatchEvent(new Event('camy-business-updated'))
    } catch (error) {
      notify?.(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="content-page market-page stock-buy-page dropship-order-page">
    <section className="stock-buy-hero">
      <div><small>CAMY DROPSHIP ORDER DESK</small><h1>You sell it.<br/><em>CAMY delivers it.</em></h1><p>Take the order from your client, choose your selling price, and send the client details to CAMY. All client orders are Cash on Delivery. CAMY handles delivery and cash collection.</p></div>
      <div className="stock-buy-steps"><span><i>1</i>Choose product</span><span><i>2</i>Add client details</span><span><i>3</i>CAMY delivers & collects COD</span></div>
    </section>
    <section className="client-order-shortcut"><div><PackageCheck/><span><strong>Looking for an existing client order?</strong><small>Open the order centre to search, filter and view full delivery details.</small></span></div><button type="button" onClick={()=>setPage?.('orders')}>View my orders <b>{orders.length}</b><ArrowRight/></button></section>

    {!catalogueLive && <div className="market-warning">CAMY Admin must activate the verified catalogue before entrepreneurs can submit orders.</div>}

    <CreditSensor person={person} tiers={tiers} orders={orders}/>

    <div className="stock-buy-layout">
      <section>
        <div className="stock-catalogue-title"><div><small>CAMY CATALOGUE</small><h2>Products you can sell</h2></div><span><PackageCheck size={16}/> {visibleProducts.filter(product => Number(product.stock) > 0).length} available</span></div>
        <div className="catalogue-browser"><label><Search/><input value={catalogueQuery} onChange={event=>setCatalogueQuery(event.target.value)} placeholder="Search product, model or category"/></label><div>{categories.map(item=><button type="button" className={category===item?'active':''} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</div></div>
        <div className="stock-product-grid">{visibleProducts.map(product => {
          const inCart = cart.find(item => String(item.productId) === String(product.id))
          const available = Number(product.stock) > 0
          return <article className="stock-product-card" key={product.id}>
            <button className="stock-product-image" type="button" onClick={()=>setDetailProduct(product)}><img src={product.image} alt={product.name}/><span>{product.category}</span></button>
            <div className="stock-product-copy"><small>{product.code || product.category}</small><h3>{product.name}</h3><p>{product.description || 'CAMY product available for entrepreneur sales.'}</p>
              <div className="stock-product-meta"><span className={available ? 'available' : 'unavailable'}><i/> {available ? 'Available' : 'Unavailable'}</span><strong>{money(product.price)}</strong></div>
              <div className="stock-product-actions"><button className="stock-details" type="button" onClick={()=>setDetailProduct(product)}>View details</button><button className="market-primary" disabled={!available} onClick={() => add(product)}>{inCart ? `Add another (${inCart.qty})` : 'Add to order'} <ArrowRight size={15}/></button></div>
            </div>
          </article>
        })}</div>{!visibleProducts.length&&<div className="catalogue-no-results">No products found. Try another category or search term.</div>}
      </section>

      <aside className={`market-checkout stock-request-card dropship-checkout ${mobileCheckout ? 'mobile-open' : ''}`}>
        <header><span><ShoppingCart size={19}/></span><div><small>COD CLIENT ORDER</small><h2>Order summary</h2></div><button className="mobile-checkout-back" type="button" onClick={() => setMobileCheckout(false)} aria-label="Back to products"><X size={19}/></button></header>
        {selected.length ? selected.map(item => <div className="market-line dropship-order-line" key={item.productId}>
          <div className="dropship-line-heading"><div className="dropship-line-product"><strong>{item.product.name}</strong><small>CAMY cost: {money(item.product.price)} each</small></div><button className="dropship-remove" type="button" onClick={() => setCart(old => old.filter(entry => String(entry.productId) !== String(item.productId)))} aria-label={`Remove ${item.product.name}`} title="Remove item"><Trash2 size={16}/></button></div>
          <div className="dropship-line-controls"><label className="dropship-selling-price">Your client price per item<span className="dropship-price-input"><b>Rs.</b><input type="number" min={item.product.price} step="0.01" value={item.sellPrice} onChange={event => update(item.productId, { sellPrice: Number(event.target.value) || 0 })}/></span><small className="dropship-price-help">Your margin: <strong>{money(Math.max(0,(Number(item.sellPrice)-Number(item.product.price))*Number(item.qty)))}</strong></small></label>
          <label className="dropship-quantity">Quantity<span className="dropship-stepper"><button type="button" aria-label={`Reduce quantity for ${item.product.name}`} disabled={Number(item.qty)<=1} onClick={()=>update(item.productId,{qty:Math.max(1,Number(item.qty)-1)})}>−</button><input aria-label={`Quantity for ${item.product.name}`} type="number" min="1" value={item.qty} onChange={event => update(item.productId, { qty: Math.max(1, Number(event.target.value) || 1) })}/><button type="button" aria-label={`Increase quantity for ${item.product.name}`} onClick={()=>update(item.productId,{qty:Number(item.qty)+1})}>+</button></span></label></div>
        </div>) : <div className="stock-cart-empty"><ShoppingCart size={23}/><p>Add products for your client's order.</p></div>}

        <div className="customer-fields"><h3>Client delivery details</h3>
          <label>Client name<input value={client.name} onChange={event => setClient(old => ({...old, name:event.target.value}))} placeholder="Full name"/></label>
          <div><label>Mobile number<input value={client.phone} onChange={event => setClient(old => ({...old, phone:event.target.value}))} placeholder="07X XXX XXXX"/></label>
          <label>District<select value={client.district} onChange={event => setClient(old => ({...old, district:event.target.value}))}>{districts.map(district => <option key={district}>{district}</option>)}</select></label></div>
          <label>Delivery address<textarea rows="3" value={client.address} onChange={event => setClient(old => ({...old, address:event.target.value}))} placeholder="House number, street, town"/></label>
          <label>Order note (optional)<textarea rows="2" value={client.notes} onChange={event => setClient(old => ({...old, notes:event.target.value}))} placeholder="Colour, preferred call time, delivery note..."/></label>
        </div>

        <div className="cod-only-notice"><Truck/><div><strong>Cash on Delivery only</strong><p>No client bank receipt is needed. CAMY collects the full client amount when the delivery succeeds.</p></div></div>
        <div className="dropship-money-rule"><BadgeDollarSign/><div><strong>You choose the client price.</strong><p>CAMY keeps the CAMY product cost. After successful delivery and COD collection, CAMY transfers the difference to your saved bank account and records the transfer receipt.</p></div></div>
        <div className="market-total"><span>CAMY product cost</span><strong>{money(camyCost)}</strong></div>
        <div className="market-total"><span>Client COD total</span><strong>{money(clientTotal)}</strong></div>
        <div className="market-total"><span>Estimated entrepreneur margin</span><strong>{money(estimatedMargin)}</strong></div>
        <button className="market-primary" disabled={!catalogueLive || !selected.length || !validClient || busy} onClick={submit}>{busy ? 'Sending to CAMY…' : 'Place COD order with CAMY'} <ArrowRight size={17}/></button>
        <footer><Truck size={15}/> CAMY handles fulfilment, delivery and cash collection.</footer>
      </aside>
    </div>

    {detailProduct&&<PortalOverlay className="catalogue-detail-layer" onClose={()=>setDetailProduct(null)} label={`${detailProduct.name} details`}><article><button type="button" className="catalogue-detail-close" onClick={()=>setDetailProduct(null)} aria-label="Close product details"><X/></button><img src={detailProduct.image} alt={detailProduct.name}/><div><small>{detailProduct.category} · {detailProduct.code||'CAMY product'}</small><h2>{detailProduct.name}</h2><strong>{money(detailProduct.price)}</strong><p>{detailProduct.description||'CAMY product available for entrepreneur sales.'}</p><div className="catalogue-detail-meta"><span><b>Product code</b>{detailProduct.code||'Not set'}</span><span><b>Warranty</b>{detailProduct.warranty||'Ask CAMY'}</span><span><b>Availability</b>{Number(detailProduct.stock)>0?`${detailProduct.stock} in stock`:'Currently unavailable'}</span></div><h3>Product features</h3><ul>{(productFeatures(detailProduct).length?productFeatures(detailProduct):['CAMY quality assured','Available through CAMY']).map(spec=><li key={spec}>{spec}</li>)}</ul><button className="market-primary" disabled={Number(detailProduct.stock)<=0} onClick={()=>{add(detailProduct);setDetailProduct(null)}}>{Number(detailProduct.stock)>0?'Add to client order':'Currently unavailable'} <ArrowRight/></button></div></article></PortalOverlay>}
    {selected.length > 0 && (
      <button className="mobile-order-cart" type="button" onClick={() => setMobileCheckout(true)}>
        <ShoppingCart size={19}/>
        <span>
          <small>{selected.reduce((sum, item) => sum + Number(item.qty), 0)} item{selected.length === 1 ? '' : 's'} selected</small>
          <strong>View order cart</strong>
        </span>
        <b>{money(clientTotal)}</b>
        <ArrowRight size={19}/>
      </button>
    )}

    <section className="market-history stock-request-history">
      <div><small>DELIVERY UPDATES</small><h2>My CAMY orders</h2><button className="market-primary" onClick={refresh} disabled={refreshing}><RefreshCw size={15}/> {refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      {orders.length ? [...orders].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date))).map(order => <article className="stock-tracker-entry dropship-money-entry" key={order.id}>
        <div><strong>{order.id} · {order.customer}</strong><small>{(order.items || []).map(item => `${item.name} × ${item.qty}`).join(', ')}</small><p>{statusHelp(order)}</p><div className="order-money-mini"><span>Client COD <b>{money(order.amount)}</b></span><span>CAMY cost <b>{money(order.camyCost ?? order.amount)}</b></span><span>Your margin <b>{money(order.entrepreneurMargin)}</b></span><span>Payment <b>COD</b></span><span>Payout <b>{payoutLabel(order)}</b></span>{order.payoutReceipt&&<a href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View CAMY transfer receipt</a>}</div></div>
        <span className={`market-status ${String(order.status).toLowerCase()}`}>{order.status}</span>
      </article>) : <p>No client orders yet. Your submitted orders and CAMY delivery updates will appear here automatically.</p>}
    </section>
  </div>
}

function CreditRequestCentre({ requests, products, cancellingId, cancelRequest, setPage }) {
  const [selected,setSelected]=useState(null), [status,setStatus]=useState('All'), [query,setQuery]=useState(''), [from,setFrom]=useState(''), [to,setTo]=useState('')
  const statuses=['All','Pending','Approved','Dispatched','Cancelled','Rejected']
  const visible=useMemo(()=>[...requests].filter(request=>(status==='All'||request.status===status)&&(!from||String(request.createdAt||'').slice(0,10)>=from)&&(!to||String(request.createdAt||'').slice(0,10)<=to)&&`${request.id} ${request.status}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),[requests,status,query,from,to])
  const clear=()=>{setStatus('All');setQuery('');setFrom('');setTo('')}
  if(selected){
    const request=requests.find(item=>item.id===selected.id)||selected
    const cancelled=['Cancelled','Rejected'].includes(request.status)
    const items=(request.items||[]).map(item=>({item,product:products.find(product=>String(product.id)===String(item.productId))}))
    const units=items.reduce((sum,{item})=>sum+Number(item.qty||0),0), approved=['Approved','Dispatched'].includes(request.status), dispatched=request.status==='Dispatched'
    return <section className="credit-request-detail-page"><header><button type="button" onClick={()=>setSelected(null)}>← All credit requests</button><div><small>REQUEST NUMBER</small><h2>{request.id}</h2><p>Submitted {requestDate(request.createdAt)}</p></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></header>
      {cancelled?<div className="credit-request-closed"><X/><div><small>REQUEST CLOSED</small><h3>{request.status==='Cancelled'?'Cancelled by you':'Rejected by CAMY'}</h3><p>{creditRequestMessage(request.status)}</p><span>Original request value <strong>{money(request.total)}</strong></span><span>Closed {requestDate(request.updatedAt||request.reviewedAt)}</span></div></div>:<>
        <div className="credit-detail-kpis"><span><small>REQUEST VALUE</small><strong>{money(request.total)}</strong></span><span><small>PRODUCTS</small><strong>{items.length}</strong></span><span><small>TOTAL UNITS</small><strong>{units}</strong></span><span><small>LAST UPDATED</small><strong>{requestDate(request.updatedAt||request.reviewedAt||request.createdAt)}</strong></span></div>
        <div className="credit-request-products"><div className="credit-request-product-head"><span>Product</span><span>Unit price</span><span>Quantity</span><span>Line total</span></div>{items.map(({item,product},index)=><div className="credit-request-product" key={item.productId||index}><span><img src={product?.image||'/products/classic-set.png'} alt=""/><span><strong>{product?.name||'CAMY product'}</strong><small>{product?.code||item.productId}</small></span></span><span>{money(item.price??product?.price)}</span><span>{item.qty}</span><strong>{money(Number(item.price??product?.price??0)*Number(item.qty||0))}</strong></div>)}</div>
        <div className="credit-request-progress"><span className="done"><i><CheckCircle2/></i><b>Requested</b><small>{requestDate(request.createdAt)}</small></span><hr className={approved?'done':''}/><span className={approved?'done':''}><i>{approved?<CheckCircle2/>:'2'}</i><b>Approved</b><small>{approved?requestDate(request.approvedAt||request.reviewedAt):'Waiting for CAMY'}</small></span><hr className={dispatched?'done':''}/><span className={dispatched?'done':''}><i>{dispatched?<CheckCircle2/>:'3'}</i><b>Dispatched</b><small>{dispatched?requestDate(request.creditIssuedAt||request.updatedAt):'Not dispatched yet'}</small></span></div>
        {dispatched&&<section className="credit-repayment-detail"><header><span><CalendarDays/></span><div><small>10-DAY CREDIT REPAYMENT</small><h3>Pay by {request.creditDueAt?requestDate(request.creditDueAt):'10 days after dispatch'}</h3><p>{money(request.creditIssuedAmount??request.total)} was added to your outstanding credit when CAMY dispatched this stock.</p></div></header><div><article><Banknote/><span><strong>Bank transfer</strong><small>Transfer the amount to CAMY, enter the transaction reference and upload the bank receipt. CAMY verifies it before reducing your balance.</small></span></article><article><PackageCheck/><span><strong>Cash at CAMY store</strong><small>Pay at a CAMY store. A CAMY administrator records and verifies the cash payment in the system.</small></span></article></div><button type="button" onClick={()=>setPage?.('credit')}>Open repayment centre <ArrowRight/></button></section>}
        <footer className="credit-detail-footer"><div><strong>{request.status==='Pending'?'Waiting for CAMY approval':request.status==='Approved'?'Approved — CAMY is preparing dispatch':'Credit stock issued'}</strong><p>{creditRequestMessage(request.status)}</p></div>{request.status==='Pending'&&<button type="button" className="credit-request-cancel" disabled={cancellingId===request.id} onClick={()=>cancelRequest(request)}>{cancellingId===request.id?'Cancelling…':'Cancel request'}</button>}</footer>
      </>}
    </section>
  }
  return <section className="credit-request-centre"><header><div><small>CREDIT REQUEST HISTORY</small><h2>My credit requests</h2><p>Open a request to view products, CAMY progress and repayment details.</p></div><b>{requests.length} request{requests.length===1?'':'s'}</b></header>
    <div className="credit-request-tools"><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search request number"/></label><select value={status} onChange={event=>setStatus(event.target.value)}>{statuses.map(item=><option key={item}>{item}</option>)}</select><label>From<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>To<input type="date" min={from} value={to} onChange={event=>setTo(event.target.value)}/></label><button type="button" onClick={clear}>Clear</button></div>
    <div className="credit-request-export"><span><Download/></span><div><strong>Download filtered requests</strong><small>{visible.length} request{visible.length===1?'':'s'} · {from||'All dates'} {to?`to ${to}`:''}</small></div><button type="button" disabled={!visible.length} onClick={()=>exportReport(`camy-credit-requests-${from||'all'}-${to||'dates'}.xlsx`,visible.map(request=>({request:request.id,status:request.status,requestedAt:request.createdAt,lastUpdated:request.updatedAt||request.reviewedAt,total:Number(request.total||0),products:(request.items||[]).length,units:(request.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0),dispatchedAt:request.creditIssuedAt||'',paymentDue:request.creditDueAt||''})))}><Download/> Download Excel</button></div>
    {visible.length?<div className="credit-request-compact-list">{visible.map(request=>{const units=(request.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0);return <article className={String(request.status).toLowerCase()} key={request.id}><span><PackageCheck/></span><div><small>REQUEST</small><strong>{request.id}</strong><p>{requestDate(request.createdAt)}</p></div><div><small>VALUE</small><strong>{money(request.total)}</strong><p>{(request.items||[]).length} products · {units} units</p></div><div><small>STATUS</small><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></div><div className="credit-request-row-note"><small>NEXT STEP</small><strong>{request.status==='Pending'?'CAMY approval':request.status==='Approved'?'CAMY dispatch':request.status==='Dispatched'?'Repay within 10 days':request.status==='Cancelled'?'No action required':'Request closed'}</strong></div><button type="button" onClick={()=>setSelected(request)}><Eye/> View request</button></article>})}</div>:<div className="credit-request-empty"><PackageOpen/><h3>No matching requests</h3><p>Change the status, search or date filters.</p></div>}
  </section>
}

export function CreditStockPage({ products = [], person, requests = [], inventory = [], submit, cancel, notify, catalogueLive, requestsOnly = false, setPage }) {
  const [cart,setCart]=useState([])
  const [busy,setBusy]=useState(false)
  const [submittedId,setSubmittedId]=useState('')
  const [cancellingId,setCancellingId]=useState('')
  const [catalogueQuery,setCatalogueQuery]=useState('')
  const [category,setCategory]=useState('All products')
  const [sort,setSort]=useState('Recommended')
  const mine=requests.filter(request=>String(request.entrepreneurId)===String(person?.id) && request.creditMode===true)
  const eligible=Number(person?.credit||0)>0 && person?.stage!=='Departed'
  const used=Number(person?.used||0)
  const activeCommitment=mine.filter(request=>['Pending','Approved'].includes(request.status)).reduce((sum,request)=>sum+Number(request.total||0),0)
  const available=Math.max(0,Number(person?.credit||0)-used-activeCommitment)
  const selected=cart.map(item=>({...item,product:products.find(product=>String(product.id)===String(item.productId))})).filter(item=>item.product)
  const total=selected.reduce((sum,item)=>sum+Number(item.product.price)*Number(item.qty),0)
  const myInventory=inventory.filter(item=>String(item.entrepreneurId)===String(person?.id) && Number(item.qty)>0)
  const categories=useMemo(()=>['All products',...Array.from(new Set(products.map(product=>product.category||'Other'))).sort()], [products])
  const visibleProducts=useMemo(()=>{
    const term=catalogueQuery.trim().toLowerCase()
    const filtered=products.filter(product=>(category==='All products'||(product.category||'Other')===category)&&`${product.name||''} ${product.code||''} ${product.category||''} ${product.description||''}`.toLowerCase().includes(term))
    if(sort==='Price: low to high')return [...filtered].sort((a,b)=>Number(a.price)-Number(b.price))
    if(sort==='Price: high to low')return [...filtered].sort((a,b)=>Number(b.price)-Number(a.price))
    if(sort==='Available first')return [...filtered].sort((a,b)=>Number(b.stock>0)-Number(a.stock>0))
    return filtered
  },[products,category,catalogueQuery,sort])

  const add=product=>setCart(old=>{
    const found=old.find(item=>String(item.productId)===String(product.id))
    return found?old.map(item=>item===found?{...item,qty:item.qty+1}:item):[...old,{productId:product.id,qty:1}]
  })
  const send=async()=>{
    if(!eligible)return notify?.('Credit stock unlocks after you become Credit eligible.')
    if(!selected.length)return notify?.('Choose at least one product.')
    if(total>available+0.009)return notify?.(`This request exceeds your available credit by ${money(total-available)}.`)
    setBusy(true)
    try{
      const created=await submit({items:selected.map(item=>({productId:item.product.id,qty:Number(item.qty)})),creditMode:true})
      if(created){
        setCart([])
        setSubmittedId(created.id)
        window.dispatchEvent(new Event('camy-business-updated'))
      }
    }finally{setBusy(false)}
  }
  const cancelRequest=async request=>{
    if(cancellingId||!window.confirm(`Cancel credit request ${request.id}? This cannot be undone.`))return
    setCancellingId(request.id)
    try{await cancel?.(request.id)}finally{setCancellingId('')}
  }

  return <div className={`content-page market-page stock-buy-page ${requestsOnly?'credit-requests-only':'credit-catalogue-page'}`}>
    {requestsOnly&&<section className="credit-requests-page-head"><button type="button" onClick={()=>setPage?.('credit-stock')}>← Back to credit catalogue</button><div><small>CREDIT STOCK</small><h1>My credit requests</h1><p>Review request details, approval, dispatch, due dates and payment progress in one place.</p></div></section>}
    <section className="stock-buy-hero credit-stock-hero"><div><small>PHASE 2 · OPTIONAL CREDIT STOCK</small><h1>Use credit when it<br/><em>fits your business.</em></h1><p>Credit-eligible entrepreneurs can choose either method at any time: keep placing normal CAMY drop-ship COD orders, or request physical CAMY stock on credit. Using credit stock does not disable drop-shipping.</p></div><div className="stock-buy-steps"><span><i>1</i>Choose stock</span><span><i>2</i>CAMY approves</span><span><i>3</i>Credit balance starts on dispatch</span></div></section>
    <section className="credit-request-shortcut"><div><PackageCheck/><span><strong>Need to check an existing request?</strong><small>Open request status, products, dispatch and payment details on a separate page.</small></span></div><button type="button" onClick={()=>setPage?.('credit-requests')}>View my requests <b>{mine.length}</b><ArrowRight/></button></section>

    <section className="shop-home-stats"><article><small>CREDIT LIMIT</small><strong>{money(person?.credit)}</strong><p>Your current CAMY limit</p></article><article><small>OUTSTANDING</small><strong>{money(used)}</strong><p>Credit already issued to you</p></article><article><small>AVAILABLE FOR NEW REQUESTS</small><strong>{money(available)}</strong><p>{money(activeCommitment)} temporarily reserved by pending/approved requests</p></article></section>

    {!eligible&&<section className="credit-stock-lock"><LockKeyhole/><div><h2>Credit stock is not unlocked yet</h2><p>You can continue using drop-shipping normally. Once your verified CAMY sales reach the first configured credit tier, this page unlocks automatically.</p></div></section>}
    {!catalogueLive&&<div className="market-warning">CAMY Admin must activate the real catalogue before credit stock requests can be submitted.</div>}
    {submittedId&&<section className="credit-request-success"><CheckCircle2/><div><strong>Credit request {submittedId} was sent successfully</strong><p>The request basket has been cleared. Stay on this page to see CAMY approval and dispatch updates in My requests below.</p></div><button type="button" onClick={()=>setSubmittedId('')}>Dismiss</button></section>}
    {eligible&&selected.length>0&&<button className="mobile-credit-request" type="button" onClick={()=>document.querySelector('.credit-catalogue-layout .stock-request-card')?.scrollIntoView({behavior:'smooth',block:'start'})}><ShoppingCart size={19}/><span><small>{selected.reduce((sum,item)=>sum+Number(item.qty||0),0)} units selected</small><strong>View credit request</strong></span><b>{money(total)}</b></button>}

    {eligible&&<div className="stock-buy-layout credit-catalogue-layout"><section><div className="stock-catalogue-title"><div><small>CAMY CREDIT CATALOGUE</small><h2>Choose stock to receive</h2></div><span><CircleDollarSign size={16}/> {money(available)} available</span></div><div className="credit-catalogue-tools"><label><Search/><input type="search" value={catalogueQuery} onChange={event=>setCatalogueQuery(event.target.value)} placeholder="Search product name, code or category"/></label><select aria-label="Sort credit products" value={sort} onChange={event=>setSort(event.target.value)}><option>Recommended</option><option>Available first</option><option>Price: low to high</option><option>Price: high to low</option></select><span>{visibleProducts.length} of {products.length} products</span></div><nav className="credit-category-tabs" aria-label="Credit product categories">{categories.map(item=><button type="button" className={category===item?'active':''} aria-pressed={category===item} key={item} onClick={()=>setCategory(item)}>{item}</button>)}</nav><div className="stock-product-grid">{visibleProducts.map(product=>{
      const inCart=cart.find(item=>String(item.productId)===String(product.id))
      const availableStock=Number(product.stock)>0
      return <article className="stock-product-card" key={product.id}><button className="stock-product-image" type="button"><img src={product.image} alt={product.name}/><span>{product.category}</span></button><div className="stock-product-copy"><small>{product.code||product.category}</small><h3>{product.name}</h3><p>{product.description||'CAMY product available for credit supply.'}</p><div className="stock-product-meta"><span className={availableStock?'available':'unavailable'}><i/> {availableStock?'Available at CAMY':'Unavailable'}</span><strong>{money(product.price)}</strong></div><button className="market-primary" disabled={!availableStock||Number(product.price)>available} onClick={()=>add(product)}>{inCart?`Add another (${inCart.qty})`:'Add to credit request'} <ArrowRight size={15}/></button></div></article>
    })}</div></section><aside className="market-checkout stock-request-card"><header><span><PackageCheck size={19}/></span><div><small>CREDIT STOCK REQUEST</small><h2>Request summary</h2></div></header>{selected.length?selected.map(item=><div className="market-line" key={item.productId}><span><strong>{item.product.name}</strong><small>{money(item.product.price)} each</small></span><input type="number" min="1" value={item.qty} onChange={event=>setCart(old=>old.map(entry=>String(entry.productId)===String(item.productId)?{...entry,qty:Math.max(1,Number(event.target.value)||1)}:entry))}/><button onClick={()=>setCart(old=>old.filter(entry=>String(entry.productId)!==String(item.productId)))}><X size={15}/></button></div>):<div className="stock-cart-empty"><PackageOpen size={23}/><p>Choose products for your credit request.</p></div>}<div className="market-total"><span>Credit request</span><strong>{money(total)}</strong></div><div className={total>available?'market-warning':'credit-safe-note'}><ShieldCheck size={15}/>{total>available?` Reduce this request by ${money(total-available)} to stay within your available credit.`:' No payment or receipt is required now. Your outstanding credit increases only when CAMY dispatches the approved stock.'}</div><button className="market-primary" disabled={!catalogueLive||!selected.length||busy||total>available} onClick={send}>{busy?'Sending…':'Send credit request'} <ArrowRight size={17}/></button></aside></div>}

    <section className="market-history stock-request-history"><div><small>MY CREDIT STOCK</small><h2>Stock currently issued to me</h2></div>{myInventory.length?<div className="credit-inventory-grid">{myInventory.map(item=>{const product=products.find(product=>String(product.id)===String(item.productId));return <article key={item.productId}><strong>{product?.name||'CAMY product'}</strong><span>{item.qty} units</span><small>{product?.code||item.productId}</small></article>})}</div>:<p>No credit stock has been dispatched to you yet.</p>}</section>

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
        <footer><div><strong>{request.status==='Pending'?'Approval pending':request.status==='Approved'?'Approved — preparing dispatch':request.status==='Dispatched'?'Stock and credit issued':request.status==='Rejected'?'Request rejected':request.status==='Cancelled'?'Cancelled by you':request.status}</strong><p>{creditRequestMessage(request.status)}</p>{request.status==='Dispatched'&&<button type="button" className="credit-payment-link" onClick={()=>setPage?.('credit')}>Choose repayment method <ArrowRight size={14}/></button>}</div>{request.status==='Pending'&&<button type="button" className="credit-request-cancel" disabled={cancellingId===request.id} onClick={()=>cancelRequest(request)}>{cancellingId===request.id?'Cancelling…':'Cancel request'}</button>}{request.status==='Dispatched'&&<span><small>PAY WITHIN 10 DAYS</small><strong>{request.creditDueAt?requestDate(request.creditDueAt):'10 days after dispatch'}</strong><small>{money(request.creditIssuedAmount??request.total)} issued</small></span>}</footer>
      </article>
    })}</div>:<div className="credit-request-empty"><PackageOpen/><h3>No credit stock requests yet</h3><p>Products you submit for CAMY credit will appear here with approval and dispatch updates.</p></div>}</section>
    {requestsOnly&&<CreditRequestCentre requests={mine} products={products} cancellingId={cancellingId} cancelRequest={cancelRequest} setPage={setPage}/>}
  </div>
}

export function AdminCreditStockPage({ requests = [], products = [], entrepreneurs = [], inventory = [], review, catalogueLive }) {
  const [filter,setFilter]=useState('Active')
  const [query,setQuery]=useState('')
  const [busyId,setBusyId]=useState('')
  const [actionErrors,setActionErrors]=useState({})
  const [actionMessage,setActionMessage]=useState('')
  const creditRequests=requests.filter(request=>request.creditMode===true)
  const visible=creditRequests.filter(request=>{
    const person=entrepreneurs.find(person=>String(person.id)===String(request.entrepreneurId))
    const text=`${request.id} ${person?.name||''} ${request.entrepreneurId||''}`.toLowerCase()
    const matchText=text.includes(query.trim().toLowerCase())
    const matchFilter=filter==='All'||(filter==='Active'?['Pending','Approved'].includes(request.status):request.status===filter)
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

  return <div className="content-page market-page">
    <div className="market-heading"><div><small>PHASE 2 · CREDIT STOCK CONTROL</small><h1>Credit stock requests</h1><p>Approve only eligible requests within the entrepreneur's available limit. Approval reserves CAMY warehouse stock; dispatch issues the credit and increases the entrepreneur's outstanding balance.</p></div></div>
    {!catalogueLive&&<div className="market-warning">The CAMY catalogue is not active. Activate and verify warehouse stock before dispatching credit stock.</div>}
    <div className="credit-stock-admin-filters"><input placeholder="Search request, entrepreneur or member ID" value={query} onChange={event=>setQuery(event.target.value)}/><select value={filter} onChange={event=>setFilter(event.target.value)}><option>Active</option><option>Pending</option><option>Approved</option><option>Dispatched</option><option>Rejected</option><option>All</option></select></div>
    {busyId&&<div className="credit-admin-action-status"><RefreshCw/><span><strong>Updating {busyId}</strong><small>Please wait while CAMY verifies credit and reserves warehouse stock.</small></span></div>}
    {actionMessage&&!busyId&&<div className="credit-admin-action-status success"><CheckCircle2/><span><strong>{actionMessage}</strong><small>The request list and warehouse stock have been refreshed.</small></span><button type="button" onClick={()=>setActionMessage('')}>Dismiss</button></div>}
    <section className="credit-stock-admin-list">{visible.length?visible.map(request=>{
      const person=entrepreneurs.find(person=>String(person.id)===String(request.entrepreneurId))
      const committed=creditRequests.filter(entry=>entry.id!==request.id&&String(entry.entrepreneurId)===String(request.entrepreneurId)&&['Pending','Approved'].includes(entry.status)).reduce((sum,entry)=>sum+Number(entry.total||0),0)
      const available=Math.max(0,Number(person?.credit||0)-Number(person?.used||0)-committed)
      const items=request.items||[]
      return <article className="card credit-stock-admin-card" key={request.id}><header><div><small>{request.id}</small><h3>{person?.name||request.entrepreneurName||request.entrepreneurId}</h3><p>{request.entrepreneurId} · {person?.stage||'Unknown stage'}</p></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></header><div className="credit-stock-admin-metrics"><span><small>REQUEST</small><strong>{money(request.total)}</strong></span><span><small>CREDIT LIMIT</small><strong>{money(person?.credit)}</strong></span><span><small>OUTSTANDING</small><strong>{money(person?.used)}</strong></span><span><small>CURRENT AVAILABLE</small><strong>{money(available)}</strong></span></div><div className="credit-stock-admin-items">{items.map((item,index)=>{const product=products.find(product=>String(product.id)===String(item.productId));return <span key={item.productId||index}><b>{product?.name||item.productId}</b> × {item.qty} <small>{money(item.price)}</small></span>})}</div>{actionErrors[request.id]&&<p className="market-warning" role="alert">{actionErrors[request.id]}</p>}<footer>{request.status==='Pending'&&<><button className="market-primary" disabled={busyId===request.id} onClick={()=>act(request.id,'Approved')}><CheckCircle2/> Approve & reserve stock</button><button disabled={busyId===request.id} onClick={()=>act(request.id,'Rejected')}>Reject</button></>}{request.status==='Approved'&&<><button className="market-primary" disabled={busyId===request.id} onClick={()=>act(request.id,'Dispatched')}><Truck/> Dispatch & issue credit</button><button disabled={busyId===request.id} onClick={()=>act(request.id,'Rejected')}>Cancel approval</button></>}{request.status==='Dispatched'&&<span><CheckCircle2/> Credit stock issued and recorded in entrepreneur inventory.</span>}{request.status==='Rejected'&&<span>Request closed without using credit.</span>}</footer></article>
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

export function DropshipHome({ person, orders = [], setPage }) {
  const myOrders=orders.filter(order=>String(order.entrepreneurId)===String(person?.id))
  const inProgress=myOrders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status))
  const delivered=myOrders.filter(order=>order.status==='Delivered')
  const paidMargin=myOrders.filter(order=>order.payoutStatus==='paid').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const pendingMargin=myOrders.filter(order=>order.payoutStatus==='pending_transfer').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const lifetimeMargin=delivered.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const creditEligible=Number(person?.credit||0)>0
  const availableCredit=Math.max(0,Number(person?.credit||0)-Number(person?.used||0))
  const firstName=person?.name?.split(' ')[0]||'Partner'
  return <div className="content-page entrepreneur-overview">
    <section className="home-welcome"><div><small>YOUR CAMY BUSINESS</small><h1>Good to see you, {firstName}.</h1><p>Here is the important picture today. Open a section below when you need its full details.</p></div><button type="button" onClick={()=>setPage('products')}><ShoppingCart/> Create client order <ArrowRight/></button></section>
    <section className="home-essential-stats">
      <button type="button" onClick={()=>setPage('orders')}><span><Truck/></span><div><small>ACTIVE ORDERS</small><strong>{inProgress.length}</strong><p>{delivered.length} successfully delivered</p></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('credit')}><span><BadgeDollarSign/></span><div><small>YOUR VERIFIED EARNINGS</small><strong>{money(lifetimeMargin)}</strong><p>{money(paidMargin)} transferred by CAMY</p></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('credit-stock')}><span><PackageCheck/></span><div><small>AVAILABLE CREDIT</small><strong>{money(availableCredit)}</strong><p>{creditEligible?'Ready for optional stock requests':'Unlocks through verified earnings'}</p></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('credit')}><span><CircleDollarSign/></span><div><small>WAITING FOR CAMY</small><strong>{money(pendingMargin)}</strong><p>Commission ready for transfer</p></div><ArrowRight/></button>
    </section>
    {pendingMargin>0&&<section className="home-attention"><span><BadgeDollarSign/></span><div><small>PAYMENT UPDATE</small><strong>{money(pendingMargin)} is waiting for CAMY transfer</strong><p>Open Your Earnings to see each order and payment status.</p></div><button type="button" onClick={()=>setPage('credit')}>View your earnings <ArrowRight/></button></section>}
    <section className="home-destinations"><header><small>GO TO</small><h2>What would you like to do?</h2></header><div>
      <button type="button" onClick={()=>setPage('products')}><span><ShoppingCart/></span><div><strong>Place a client order</strong><small>Choose products and send a COD order to CAMY</small></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('orders')}><span><Truck/></span><div><strong>Track your orders</strong><small>View delivery status, invoices and commission receipts</small></div><ArrowRight/></button>
      <button type="button" onClick={()=>setPage('credit-stock')}><span><PackageCheck/></span><div><strong>Manage credit stock</strong><small>Request stock or review existing credit requests</small></div><ArrowRight/></button>
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
