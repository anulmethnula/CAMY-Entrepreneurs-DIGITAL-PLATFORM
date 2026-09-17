import { ProductMediaGallery } from './ProductMedia'
import { ReturnAttention } from './OrderReturns'
import { PortalOverlay } from './Dialog'
import { ReceiptPreview } from './ReceiptPreview'
import { BankDetails, BankEditor, ShopContactEditor, ReceiptUpload, SupplyReview } from './Workflow'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Eye, PackageCheck, PackageOpen, Search, ShieldCheck, ShoppingCart, Sparkles, Store, X } from 'lucide-react'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`

function CamyProductDetails({ product, onClose }) {
  if (!product) return null
  return <PortalOverlay className="market-modal" onClose={onClose} label="Product details"><div onClick={event=>event.stopPropagation()}><button className="market-close" onClick={onClose} aria-label="Close product details"><X/></button><ProductMediaGallery key={product.id} product={product}/><div><small>{product.category} · Original CAMY product</small><h2>{product.name}</h2><p>{product.description || 'Product information is maintained by CAMY.'}</p><strong>{money(product.price)}</strong><p><b>Product code:</b> {product.code || 'Not set'}<br/><b>Warranty:</b> {product.warranty || 'Ask CAMY'}</p><h3>Product features</h3><ul>{(product.specs?.length ? product.specs : ['Contact CAMY for complete product specifications.']).map(spec=><li key={spec}>{spec}</li>)}</ul></div></div></PortalOverlay>
}

export function StockSupplyPage({ products, person, requests, submit, notify, catalogueLive, receiptDone }) {
  const [cart, setCart] = useState([])
  const [busy, setBusy] = useState(false)
  const [details, setDetails] = useState(null)
  const selected = cart.map(item => ({ ...item, product: products.find(product => String(product.id) === String(item.productId)) })).filter(item => item.product)
  const total = selected.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0)
  const mine = requests.filter(request => request.entrepreneurId === person.id)
  const categories = [...new Set(products.map(product => product.category || 'Other products'))]
  const scrollToCategory = category => document.getElementById(`stock-category-${String(category).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const add = product => setCart(old => { const found = old.find(item => String(item.productId) === String(product.id)); return found ? old.map(item => item === found ? { ...item, qty: item.qty + 1 } : item) : [...old, { productId: product.id, qty: 1 }] })
  const send = async () => { if (!selected.length || busy) return; setBusy(true); try { const done = await submit({ items: selected.map(item => ({ productId: item.product.id, qty: item.qty })) }); if (done) { setCart([]) } } finally { setBusy(false) } }
  return <div className="content-page market-page stock-buy-page">
    <section className="stock-buy-hero"><div><small><Sparkles size={14}/> CAMY PARTNER SUPPLY</small><h1>Stock your business<br/><em>with confidence.</em></h1><p>Every product card uses the live CAMY catalogue. Product information, prices, features and warranty update when CAMY Admin makes a change.</p></div><div className="stock-buy-steps"><span><i>1</i>Choose products</span><span><i>2</i>Request approval</span><span><i>3</i>Pay, upload receipt, dispatch</span></div></section>
    {!catalogueLive && <div className="market-warning">This catalogue is being verified by CAMY Admin. You can browse it now; stock requests open once it is activated.</div>}
    <div className="stock-buy-layout"><section><div className="stock-catalogue-title"><div><small>LIVE CATALOGUE</small><h2>Choose CAMY products</h2></div><span><PackageCheck size={16}/> {products.filter(product => product.stock > 0).length} products available</span></div><nav className="stock-category-nav" aria-label="Product categories">{categories.map(category => <button type="button" onClick={() => scrollToCategory(category)} key={category}>{category}<b>{products.filter(product => (product.category || 'Other products') === category).length}</b></button>)}</nav><div className="stock-category-sections">{categories.map(category => { const categoryProducts = products.filter(product => (product.category || 'Other products') === category); const categoryId = `stock-category-${String(category).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`; return <section className="stock-category-section" id={categoryId} key={category}><header><div><small>PRODUCT CATEGORY</small><h3>{category}</h3></div><span>{categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'}</span></header><div className="stock-product-grid">{categoryProducts.map(product => { const inCart = cart.find(item => String(item.productId) === String(product.id)); return <article className="stock-product-card" key={product.id}><button className="stock-product-image" onClick={() => setDetails(product)} aria-label={`View ${product.name} details`}><img src={product.image} alt={product.name}/><span>{product.tag || product.category}</span><i><Eye size={16}/></i></button><div className="stock-product-copy"><small>{product.category} · {product.code}</small><h3>{product.name}</h3><p>{product.description || 'Original CAMY product, supplied directly by CAMY.'}</p><div className="stock-product-meta"><span className={product.stock > 0 ? 'available' : 'unavailable'}><i/> {product.stock > 0 ? 'Available to order' : 'Currently unavailable'}</span><strong>{money(product.price)}</strong></div><div className="stock-product-actions"><button className="stock-details" onClick={() => setDetails(product)}>View details</button><button className="market-primary" disabled={product.stock < 1} onClick={() => add(product)}>{inCart ? `Add another (${inCart.qty})` : 'Add to request'} <ArrowRight size={15}/></button></div></div></article> })}</div></section> })}</div></section>
      <aside className="market-checkout stock-request-card"><header><span><ShoppingCart size={19}/></span><div><small>YOUR REQUEST</small><h2>Purchase summary</h2></div></header>{selected.length ? selected.map(item => <div className="market-line" key={item.productId}><span><strong>{item.product.name}</strong><small>{money(item.product.price)} each</small></span><input aria-label={`Quantity for ${item.product.name}`} type="number" min="1" value={item.qty} onChange={event => setCart(old => old.map(entry => entry.productId === item.productId ? { ...entry, qty: Math.max(1, Number(event.target.value) || 1) } : entry))}/><button onClick={() => setCart(old => old.filter(entry => entry.productId !== item.productId))} aria-label={`Remove ${item.product.name}`}><X size={15}/></button></div>) : <div className="stock-cart-empty"><ShoppingCart size={23}/><p>Your selected products will appear here.</p></div>}<div className="market-total"><span>Total to pay</span><strong>{money(total)}</strong></div><p>Send your request first. After CAMY approves, pay the approved amount and upload your receipt in the tracker below.</p><button className="market-primary" disabled={!catalogueLive || !selected.length || busy} onClick={send}>{busy ? 'Sending request…' : 'Send for CAMY approval'} <ArrowRight size={17}/></button><footer><ShieldCheck size={15}/> Approval comes before payment. Receipt verification comes before dispatch.</footer></aside></div>
    <section className="market-history stock-request-history"><div><small>REQUEST TRACKER</small><h2>My stock requests</h2></div>{mine.length ? mine.map(request => <article className="stock-tracker-entry" key={request.id}><div><strong>{request.items.map(item => `${products.find(product => String(product.id) === String(item.productId))?.name || 'Product'} × ${item.qty}`).join(', ')}</strong><small>{request.id} · {request.reference ? `Payment ${request.reference}` : 'Awaiting approval'} · {money(request.total)}</small></div><span className={`market-status ${request.status.toLowerCase()}`}>{request.status === 'Approved' ? 'Payment verified' : request.status}</span>{request.status === 'Awaiting payment' && <ReceiptUpload order={request} onDone={receiptDone}/ >}{request.status === 'Payment review' && <p>Receipt received. Waiting for CAMY payment verification.</p>}</article>) : <p>No stock requests yet. Add products above to begin your first purchase.</p>}</section>
    <CamyProductDetails product={details} onClose={() => setDetails(null)}/>
  </div>
}

export function ShopHome({ person, inventory, products, requests, orders, setPage }) {
  const mine=inventory.filter(item=>item.entrepreneurId===person.id&&item.qty>0); const pending=requests.filter(request=>request.entrepreneurId===person.id&&['Pending','Awaiting payment','Payment review','Approved'].includes(request.status));const myOrders=orders.filter(order=>String(order.entrepreneurId)===String(person.id));const delivered=myOrders.filter(order=>order.status==='Delivered');const sales=delivered.reduce((sum,order)=>sum+Number(order.amount||0),0)
  return <div className="content-page market-page"><div className="market-heading"><div><small>YOUR CAMY SHOP</small><h1>Welcome back, {person.name?.split(' ')[0]||'Entrepreneur'}.</h1><p>Buy stock from CAMY, follow your payment and dispatch requests, then let customers order from your public shop.</p></div><a href="/shops" target="_blank" rel="noreferrer"><Store size={17}/> View public shops</a></div><ReturnAttention orders={myOrders} onOpen={()=>setPage('orders')}/><div className="shop-home-grid"><button onClick={()=>setPage('products')}><ShoppingCart/><strong>Buy CAMY stock</strong><small>Request stock, then pay after approval</small><ArrowRight/></button><button onClick={()=>setPage('inventory')}><PackageOpen/><strong>My inventory</strong><small>Manage your shop listings and prices</small><ArrowRight/></button><button onClick={()=>setPage('orders')}><Check/><strong>Customer orders</strong><small>{myOrders.length} orders · {delivered.length} delivered</small><ArrowRight/></button></div><div className="shop-home-stats"><article><small>VERIFIED SALES</small><strong>{money(sales)}</strong><p>Only successfully delivered orders count</p></article><article><small>STOCK REQUESTS WAITING</small><strong>{pending.length}</strong><p>Payment review or dispatch pending</p></article><article><small>PRODUCTS IN MY SHOP</small><strong>{mine.length}</strong><p>From approved, dispatched CAMY stock</p></article></div><section className="market-history"><h2>My shop products</h2>{mine.length?mine.map(item=>{const product=products.find(entry=>String(entry.id)===String(item.productId));return <article key={`${item.entrepreneurId}-${item.productId}`}><div><strong>{product?.name||'CAMY product'}</strong><small>{product?.code||''} · {money(product?.price)}</small></div><b>{item.qty>0?"In stock":"Unavailable"}</b></article>}):<p>Your shop opens to customers when CAMY dispatches your first stock request.</p>}</section></div>
}

export function MyInventoryPage({ person, inventory, products, orders, savePrice, notify }) {
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState('')
  const [details, setDetails] = useState(null)
  const mine = inventory.filter(item => item.entrepreneurId === person.id && item.qty > 0)
  const updatePrice = async item => {
    const price = Number(drafts[item.productId] ?? item.price ?? products.find(product => String(product.id) === String(item.productId))?.price)
    if (!Number.isFinite(price) || price <= 0) return notify('Enter a valid selling price.')
    setSaving(String(item.productId))
    try { await savePrice(item.productId, price) } finally { setSaving('') }
  }
  return <div className="content-page market-page">
    <div className="market-heading"><div><small>MY SHOP</small><h1>My inventory</h1><p>Only stock that CAMY has dispatched is available to your customers. Customer orders reduce these quantities.</p></div></div>
    <ShopContactEditor initial={person.phone} notify={notify}/><BankEditor initial={person.bankDetails} notify={notify}/><div className="market-products">{mine.length ? mine.map(item => {
      const product = products.find(entry => String(entry.id) === String(item.productId))
      if (!product) return null
      const price = drafts[item.productId] ?? item.price ?? product.price
      return <article className="market-product" key={`${item.entrepreneurId}-${item.productId}`}>
        <img src={product.image} alt={product.name}/>
        <div><small>{product.category} · {product.code}</small><h3>{product.name}</h3><p>CAMY purchase price: {money(product.price)} · {item.qty} units in stock</p>
          <button className="product-details-link" onClick={() => setDetails(product)}>View original CAMY details</button>
          <label className="shop-price">My shop selling price<input type="number" min="1" step="0.01" value={price} onChange={event => setDrafts(old => ({...old, [item.productId]: event.target.value}))}/></label>
          <button className="market-primary" disabled={saving === String(item.productId)} onClick={() => updatePrice(item)}>Save shop price</button>
          <button className="shop-visibility" onClick={() => savePrice(item.productId, Number(price), !(item.visible ?? true))}>{item.visible ?? true ? 'Hide from customers' : 'Show in my shop'}</button>
        </div>
      </article>
    }) : <div className="market-empty"><PackageOpen/><h2>Your shop has no stock yet</h2><p>Buy stock from CAMY and wait for approval and dispatch.</p></div>}</div>
    <section className="market-history"><h2>Customer orders from my shop</h2>{orders.filter(order => order.entrepreneurId === person.id).map(order => <article key={order.id}><div><strong>{order.id} · {order.customer}</strong><small>{order.items.map(item => `${item.name} × ${item.qty}`).join(', ')} · {money(order.amount)}</small></div><span className="market-status">{order.status}</span></article>)}</section>
    <CamyProductDetails product={details} onClose={() => setDetails(null)}/>
  </div>
}

const supplyStatus = status => status === 'Approved' ? 'Payment verified' : status
const supplyDate = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('en-LK') : 'Not recorded'

function SupplyRequestEditor({ request, products, review }) {
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState(request.items)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (request.status !== 'Pending') return <p>Editing is available before acceptance. This request has already been {request.status === 'Awaiting payment' ? 'accepted and is waiting for payment' : 'processed'}.</p>
  const update = (index, key, value) => setItems(old => old.map((item, position) => position === index ? { ...item, [key]: value } : item))
  const save = async () => {
    setBusy(true); setError('')
    try { await review(request.id, 'Edited', undefined, items); setEditing(false) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  if (!editing) return <button className="market-primary" onClick={() => { setItems(request.items.map(item => ({ ...item }))); setEditing(true) }}>Edit quantities and prices</button>
  return <section className="workflow-panel"><h3>Edit pending request</h3>{items.map((item, index) => <div className="supply-edit-row" key={item.productId}><strong>{products.find(product => String(product.id) === String(item.productId))?.name || item.productId}</strong><label>Quantity<input type="number" min="1" step="1" value={item.qty} onChange={event => update(index, 'qty', event.target.value)}/></label><label>Unit price<input type="number" min="0.01" step="0.01" value={item.price} onChange={event => update(index, 'price', event.target.value)}/></label><button disabled={busy || items.length === 1} onClick={() => setItems(old => old.filter((_, position) => position !== index))}>Remove</button></div>)}<p>Updated total: <strong>{money(items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0))}</strong></p>{error && <p className="market-error" role="alert">{error}</p>}<div className="workflow-actions"><button className="market-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</button><button disabled={busy} onClick={() => setEditing(false)}>Cancel editing</button></div><p>Save your changes before accepting the request.</p></section>
}

function SupplyDialog({children,close}) {return <PortalOverlay className="supply-detail-overlay" onClose={close} label="Stock purchase request">{children}</PortalOverlay>}

export function AdminSupplyPage({ requests, products, entrepreneurs, review, inventory, catalogueLive, activate, bank }) {
  const [tab, setTab] = useState('All requests')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const groups = {
    'All requests': requests,
    Approval: requests.filter(item => item.status === 'Pending'),
    'Awaiting payment': requests.filter(item => item.status === 'Awaiting payment'),
    'Payment review': requests.filter(item => item.status === 'Payment review'),
    Dispatch: requests.filter(item => item.status === 'Approved'),
    Complete: requests.filter(item => ['Dispatched', 'Rejected'].includes(item.status)),
  }
  const personFor = request => entrepreneurs.find(person => String(person.id) === String(request.entrepreneurId)) || {}
  const productFor = item => products.find(product => String(product.id) === String(item.productId)) || {}
  const visible = (groups[tab] || []).filter(request => {
    const person = personFor(request)
    return [request.id, request.entrepreneurName, request.entrepreneurId, person.phone, person.email, request.reference, ...request.items.map(item => productFor(item).name)].join(' ').toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const selected = requests.find(request => request.id === selectedId)
  const person = selected ? personFor(selected) : {}
  return <div className="content-page market-page stock-admin-page">
    <section className="stock-admin-hero"><div><small>CAMY SUPPLY OPERATIONS</small><h1>Every request. <em>Every detail.</em></h1><p>Review requested products and entrepreneur details, approve the purchase, verify payment, and dispatch stock from one workspace.</p></div><div className="stock-admin-flow"><span><b>1</b>Approve request</span><span><b>2</b>Verify bank payment</span><span><b>3</b>Dispatch stock</span></div></section>
    {!catalogueLive && <div className="market-warning">Verify the catalogue prices and warehouse stock before accepting purchases. <button className="market-primary" onClick={activate}>Activate verified catalogue</button></div>}
    <section className="supply-kpis">{[['Approval','New requests'],['Awaiting payment','Waiting for payment'],['Payment review','Receipts to check'],['Dispatch','Ready to dispatch']].map(([id,label]) => <button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><strong>{groups[id].length}</strong><span>{label}</span></button>)}</section>
    <section className="stock-request-board"><header><div><small>STOCK REQUESTS</small><h2>{tab}</h2><p>Open a request to inspect all items, contact details, payment information, and available actions.</p></div><b>{visible.length} request{visible.length === 1 ? '' : 's'}</b></header>
      <div className="supply-toolbar"><nav aria-label="Request stages">{Object.keys(groups).map(id => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{id} <b>{groups[id].length}</b></button>)}</nav><label><Search size={18}/><input aria-label="Search stock requests" placeholder="Search request, entrepreneur, product or payment reference" value={query} onChange={event=>setQuery(event.target.value)}/></label></div>
      {visible.length ? visible.map(request => <article className="supply-request-card" key={request.id}><div className="supply-request-main"><div className="supply-request-id"><span>{request.id}</span><b>{supplyStatus(request.status)}</b></div><h3>{request.entrepreneurName || personFor(request).name || request.entrepreneurId}</h3><small>{request.entrepreneurId} | {supplyDate(request.createdAt)}</small><div className="supply-items">{request.items.map(item => <span key={item.productId}>{productFor(item).name || item.name || item.productId} <b>Qty: {item.qty}</b></span>)}</div></div><div className="supply-request-total"><small>REQUEST TOTAL</small><strong>{money(request.total)}</strong><span>{request.items.reduce((sum,item)=>sum+Number(item.qty),0)} units / {request.items.length} products</span></div><div className="supply-request-actions"><button className="market-primary" onClick={()=>setSelectedId(request.id)}>View full request <Eye size={15}/></button></div></article>) : <div className="market-empty"><Check/><h2>{query?'No matching requests':'No requests in this queue'}</h2><p>{query?'Try another name, product or request number.':'Requests appear here as entrepreneurs submit stock purchases.'}</p></div>}
    </section>
    <details className="supply-bank-settings"><summary>CAMY payment bank account</summary><BankEditor initial={bank}/></details>
    <section className="market-history stock-at-shops"><h2>Dispatched stock in entrepreneur shops</h2>{inventory.filter(item=>item.qty>0).map(item=>{const owner=entrepreneurs.find(entry=>String(entry.id)===String(item.entrepreneurId));return <article key={item.entrepreneurId+'-'+item.productId}><div><strong>{owner?.name||item.entrepreneurId} / {productFor(item).name||item.productId}</strong><small>{owner?.city||'Sri Lanka'}</small></div><b>{item.qty} units</b></article>})}</section>
    {selected && <SupplyDialog close={()=>setSelectedId(null)}><section className="supply-detail" role="dialog" aria-modal="true" aria-labelledby="supply-detail-title"><header><div><small>STOCK PURCHASE REQUEST</small><h2 id="supply-detail-title">{selected.id}</h2><span className="market-status">{supplyStatus(selected.status)}</span></div><button className="icon-btn" aria-label="Close request details" onClick={()=>setSelectedId(null)}><X/></button></header>
      <div className="supply-detail-grid"><section><h3>Entrepreneur details</h3><dl>{[['Name',selected.entrepreneurName||person.name],['Member ID',selected.entrepreneurId],['Phone',person.phone],['Email',person.email],['NIC',person.nic],['Delivery address',person.address||person.city],['City',person.city]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not provided'}</dd></div>)}</dl></section><section><h3>Request progress</h3><dl>{[['Submitted',supplyDate(selected.createdAt)],['Last updated',supplyDate(selected.updatedAt||selected.reviewedAt)],['Current stage',supplyStatus(selected.status)],['Stock reservation',selected.status==='Dispatched'?'Dispatched to shop':selected.reserved?'Reserved for this request':'Not reserved'],['Payment reference',selected.reference||'Not submitted']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>
      <h3>Requested products</h3><div className="supply-table-wrap"><table className="supply-detail-table"><thead><tr><th>Product</th><th>Unit price</th><th>Quantity</th><th>Line total</th><th>Warehouse stock</th></tr></thead><tbody>{selected.items.map(item=>{const product=productFor(item);return <tr key={item.productId}><td><div className="supply-product-cell">{product.image&&<img src={product.image} alt=""/>}<span><strong>{product.name||item.name||item.productId}</strong><small>{product.code||item.productId} / {product.category||'CAMY product'}</small></span></div></td><td>{money(item.price)}</td><td>{item.qty}</td><td>{money(Number(item.price)*Number(item.qty))}</td><td>{product.stock??'Unavailable'}</td></tr>})}</tbody></table></div><div className="supply-detail-total"><span>Request total</span><strong>{money(selected.total)}</strong></div>
      <section className="supply-payment"><h3>Payment details</h3>{selected.bankDetails?<BankDetails bank={selected.bankDetails}/>:<p>Bank details are attached when the request is approved.</p>}{selected.receipt?<ReceiptPreview className="receipt-preview" href={selected.receipt} name={`View payment receipt: ${selected.receiptName || 'Bank receipt'}`}/>:<p>No payment receipt submitted yet.</p>}{selected.paymentNote&&<p className="market-error">Receipt correction: {selected.paymentNote}</p>}</section>
      <section className="supply-next-action"><h3>Edit request</h3><SupplyRequestEditor key={selected.id+selected.updatedAt} request={selected} products={products} review={review}/><h3>Accept or reject request</h3><SupplyReview key={selected.id+'-'+selected.status} request={selected} review={review}/>{selected.status==='Dispatched'&&<p>This request is complete. Stock has been added to the entrepreneur shop.</p>}{selected.status==='Rejected'&&<p>This request has been rejected and requires no further action.</p>}</section>
    </section></SupplyDialog>}
  </div>
}

export { PublicMarketplace } from './PublicMarketplace'
