import { useMemo, useState } from 'react'
import { ArrowRight, BadgeDollarSign, CheckCircle2, CircleDollarSign, FileText, LockKeyhole, PackageCheck, PackageOpen, RefreshCw, ShieldCheck, ShoppingCart, Truck, X } from 'lucide-react'
import { api } from './api'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`
const districts = ['Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle','Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle','Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala','Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura','Trincomalee','Vavuniya']
const blankClient = { name: '', phone: '', district: 'Colombo', address: '', notes: '' }

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
  const sales = delivered.reduce((sum, order) => sum + Number(order.camyCost ?? order.amount ?? 0), 0)
  const sorted = [...tiers].sort((a, b) => Number(a.sales) - Number(b.sales))
  const active = [...sorted].reverse().find(tier => Number(tier.sales) <= sales)
  const next = sorted.find(tier => Number(tier.sales) > sales)
  const credit = Number(person?.credit ?? active?.credit ?? 0)
  const remaining = next ? Math.max(0, Number(next.sales) - sales) : 0
  const phase = credit > 0 ? 'Phase 2 · Dropship + credit stock' : 'Phase 1 · Trial drop-shipping'
  return <section className="shop-home-stats">
    <article><small>CURRENT CAMY STAGE</small><strong className="phase-value">{phase}</strong><p>{credit > 0 ? 'You can keep drop-shipping and also request CAMY stock on credit. You choose which method suits each sale.' : 'Build verified delivered sales to unlock optional credit stock.'}</p></article>
    <article><small>VERIFIED CAMY SALES</small><strong>{money(sales)}</strong><p>Uses CAMY product value from successfully delivered orders, not your markup</p></article>
    <article><small>CREDIT / NEXT TARGET</small><strong>{credit > 0 ? money(credit) : next ? money(remaining) : 'Not configured'}</strong><p>{credit > 0 ? 'Credit stock is optional; drop-shipping remains available' : next ? `${money(remaining)} more verified CAMY sales to unlock ${money(next.credit)} credit` : 'CAMY Admin must configure a credit tier'}</p></article>
  </section>
}

export function DropshipOrderPage({ products = [], person, notify, catalogueLive, orders = [], tiers = [] }) {
  const [cart, setCart] = useState([])
  const [client, setClient] = useState(blankClient)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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
      window.dispatchEvent(new Event('camy-business-updated'))
    } catch (error) {
      notify?.(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="content-page market-page stock-buy-page">
    <section className="stock-buy-hero">
      <div><small>CAMY DROPSHIP ORDER DESK</small><h1>You sell it.<br/><em>CAMY delivers it.</em></h1><p>Take the order from your client, choose your selling price, and send the client details to CAMY. All client orders are Cash on Delivery. CAMY handles delivery and cash collection.</p></div>
      <div className="stock-buy-steps"><span><i>1</i>Choose product</span><span><i>2</i>Add client details</span><span><i>3</i>CAMY delivers & collects COD</span></div>
    </section>

    {!catalogueLive && <div className="market-warning">CAMY Admin must activate the verified catalogue before entrepreneurs can submit orders.</div>}

    <CreditSensor person={person} tiers={tiers} orders={orders}/>

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
        <header><span><ShoppingCart size={19}/></span><div><small>COD CLIENT ORDER</small><h2>Order summary</h2></div></header>
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

        <div className="cod-only-notice"><Truck/><div><strong>Cash on Delivery only</strong><p>No client bank receipt is needed. CAMY collects the full client amount when the delivery succeeds.</p></div></div>
        <div className="dropship-money-rule"><BadgeDollarSign/><div><strong>You choose the client price.</strong><p>CAMY keeps the CAMY product cost. After successful delivery and COD collection, CAMY transfers the difference to your saved bank account and records the transfer receipt.</p></div></div>
        <div className="market-total"><span>CAMY product cost</span><strong>{money(camyCost)}</strong></div>
        <div className="market-total"><span>Client COD total</span><strong>{money(clientTotal)}</strong></div>
        <div className="market-total"><span>Estimated entrepreneur margin</span><strong>{money(estimatedMargin)}</strong></div>
        <button className="market-primary" disabled={!catalogueLive || !selected.length || !validClient || busy} onClick={submit}>{busy ? 'Sending to CAMY…' : 'Place COD order with CAMY'} <ArrowRight size={17}/></button>
        <footer><Truck size={15}/> CAMY handles fulfilment, delivery and cash collection.</footer>
      </aside>
    </div>

    <section className="market-history stock-request-history">
      <div><small>DELIVERY UPDATES</small><h2>My CAMY orders</h2><button className="market-primary" onClick={refresh} disabled={refreshing}><RefreshCw size={15}/> {refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      {orders.length ? [...orders].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date))).map(order => <article className="stock-tracker-entry dropship-money-entry" key={order.id}>
        <div><strong>{order.id} · {order.customer}</strong><small>{(order.items || []).map(item => `${item.name} × ${item.qty}`).join(', ')}</small><p>{statusHelp(order)}</p><div className="order-money-mini"><span>Client COD <b>{money(order.amount)}</b></span><span>CAMY cost <b>{money(order.camyCost ?? order.amount)}</b></span><span>Your margin <b>{money(order.entrepreneurMargin)}</b></span><span>Payment <b>COD</b></span><span>Payout <b>{payoutLabel(order)}</b></span>{order.payoutReceipt&&<a href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View CAMY transfer receipt</a>}</div></div>
        <span className={`market-status ${String(order.status).toLowerCase()}`}>{order.status}</span>
      </article>) : <p>No client orders yet. Your submitted orders and CAMY delivery updates will appear here automatically.</p>}
    </section>
  </div>
}

export function CreditStockPage({ products = [], person, requests = [], inventory = [], submit, notify, catalogueLive }) {
  const [cart,setCart]=useState([])
  const [busy,setBusy]=useState(false)
  const mine=requests.filter(request=>String(request.entrepreneurId)===String(person?.id) && (request.creditMode ?? true))
  const eligible=Number(person?.credit||0)>0 && person?.stage!=='Departed'
  const used=Number(person?.used||0)
  const activeCommitment=mine.filter(request=>['Pending','Approved'].includes(request.status)).reduce((sum,request)=>sum+Number(request.total||0),0)
  const available=Math.max(0,Number(person?.credit||0)-used-activeCommitment)
  const selected=cart.map(item=>({...item,product:products.find(product=>String(product.id)===String(item.productId))})).filter(item=>item.product)
  const total=selected.reduce((sum,item)=>sum+Number(item.product.price)*Number(item.qty),0)
  const myInventory=inventory.filter(item=>String(item.entrepreneurId)===String(person?.id) && Number(item.qty)>0)

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
      const ok=await submit({items:selected.map(item=>({productId:item.product.id,qty:Number(item.qty)})),creditMode:true})
      if(ok){setCart([]);window.dispatchEvent(new Event('camy-business-updated'))}
    }finally{setBusy(false)}
  }

  return <div className="content-page market-page stock-buy-page">
    <section className="stock-buy-hero credit-stock-hero"><div><small>PHASE 2 · OPTIONAL CREDIT STOCK</small><h1>Use credit when it<br/><em>fits your business.</em></h1><p>Credit-eligible entrepreneurs can choose either method at any time: keep placing normal CAMY drop-ship COD orders, or request physical CAMY stock on credit. Using credit stock does not disable drop-shipping.</p></div><div className="stock-buy-steps"><span><i>1</i>Choose stock</span><span><i>2</i>CAMY approves</span><span><i>3</i>Credit balance starts on dispatch</span></div></section>

    <section className="shop-home-stats"><article><small>CREDIT LIMIT</small><strong>{money(person?.credit)}</strong><p>Your current CAMY limit</p></article><article><small>OUTSTANDING</small><strong>{money(used)}</strong><p>Credit already issued to you</p></article><article><small>AVAILABLE FOR NEW REQUESTS</small><strong>{money(available)}</strong><p>{money(activeCommitment)} temporarily reserved by pending/approved requests</p></article></section>

    {!eligible&&<section className="credit-stock-lock"><LockKeyhole/><div><h2>Credit stock is not unlocked yet</h2><p>You can continue using drop-shipping normally. Once your verified CAMY sales reach the first configured credit tier, this page unlocks automatically.</p></div></section>}
    {!catalogueLive&&<div className="market-warning">CAMY Admin must activate the real catalogue before credit stock requests can be submitted.</div>}

    {eligible&&<div className="stock-buy-layout"><section><div className="stock-catalogue-title"><div><small>CAMY CREDIT CATALOGUE</small><h2>Choose stock to receive</h2></div><span><CircleDollarSign size={16}/> {money(available)} available</span></div><div className="stock-product-grid">{products.map(product=>{
      const inCart=cart.find(item=>String(item.productId)===String(product.id))
      const availableStock=Number(product.stock)>0
      return <article className="stock-product-card" key={product.id}><button className="stock-product-image" type="button"><img src={product.image} alt={product.name}/><span>{product.category}</span></button><div className="stock-product-copy"><small>{product.code||product.category}</small><h3>{product.name}</h3><p>{product.description||'CAMY product available for credit supply.'}</p><div className="stock-product-meta"><span className={availableStock?'available':'unavailable'}><i/> {availableStock?`${product.stock} at CAMY`:'Unavailable'}</span><strong>{money(product.price)}</strong></div><button className="market-primary" disabled={!availableStock||Number(product.price)>available} onClick={()=>add(product)}>{inCart?`Add another (${inCart.qty})`:'Add to credit request'} <ArrowRight size={15}/></button></div></article>
    })}</div></section><aside className="market-checkout stock-request-card"><header><span><PackageCheck size={19}/></span><div><small>CREDIT STOCK REQUEST</small><h2>Request summary</h2></div></header>{selected.length?selected.map(item=><div className="market-line" key={item.productId}><span><strong>{item.product.name}</strong><small>{money(item.product.price)} each</small></span><input type="number" min="1" max={item.product.stock} value={item.qty} onChange={event=>setCart(old=>old.map(entry=>String(entry.productId)===String(item.productId)?{...entry,qty:Math.max(1,Number(event.target.value)||1)}:entry))}/><button onClick={()=>setCart(old=>old.filter(entry=>String(entry.productId)!==String(item.productId)))}><X size={15}/></button></div>):<div className="stock-cart-empty"><PackageOpen size={23}/><p>Choose products for your credit request.</p></div>}<div className="market-total"><span>Credit request</span><strong>{money(total)}</strong></div><div className={total>available?'market-warning':'credit-safe-note'}><ShieldCheck size={15}/>{total>available?` Reduce this request by ${money(total-available)} to stay within your available credit.`:' No payment or receipt is required now. Your outstanding credit increases only when CAMY dispatches the approved stock.'}</div><button className="market-primary" disabled={!catalogueLive||!selected.length||busy||total>available} onClick={send}>{busy?'Sending…':'Send credit request'} <ArrowRight size={17}/></button></aside></div>}

    <section className="market-history stock-request-history"><div><small>MY CREDIT STOCK</small><h2>Stock currently issued to me</h2></div>{myInventory.length?<div className="credit-inventory-grid">{myInventory.map(item=>{const product=products.find(product=>String(product.id)===String(item.productId));return <article key={item.productId}><strong>{product?.name||'CAMY product'}</strong><span>{item.qty} units</span><small>{product?.code||item.productId}</small></article>})}</div>:<p>No credit stock has been dispatched to you yet.</p>}</section>

    <section className="market-history stock-request-history"><div><small>CREDIT REQUEST HISTORY</small><h2>My requests</h2></div>{mine.length?[...mine].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(request=><article className="stock-tracker-entry" key={request.id}><div><strong>{request.items?.map(item=>`${products.find(product=>String(product.id)===String(item.productId))?.name||'Product'} × ${item.qty}`).join(', ')}</strong><small>{request.id} · {money(request.total)}</small><p>{request.status==='Pending'?'Waiting for CAMY approval.':request.status==='Approved'?'Approved and stock reserved. Waiting for CAMY dispatch.':request.status==='Dispatched'?'Stock dispatched. The request value is now part of your outstanding CAMY credit.':'Request rejected. No credit was used.'}</p></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></article>):<p>No credit stock requests yet.</p>}</section>
  </div>
}

export function AdminCreditStockPage({ requests = [], products = [], entrepreneurs = [], inventory = [], review, catalogueLive }) {
  const [filter,setFilter]=useState('Active')
  const [query,setQuery]=useState('')
  const [busyId,setBusyId]=useState('')
  const creditRequests=requests.filter(request=>request.creditMode ?? true)
  const visible=creditRequests.filter(request=>{
    const person=entrepreneurs.find(person=>String(person.id)===String(request.entrepreneurId))
    const text=`${request.id} ${person?.name||''} ${request.entrepreneurId||''}`.toLowerCase()
    const matchText=text.includes(query.trim().toLowerCase())
    const matchFilter=filter==='All'||(filter==='Active'?['Pending','Approved'].includes(request.status):request.status===filter)
    return matchText&&matchFilter
  }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))

  const act=async(id,status)=>{
    setBusyId(id)
    try{await review(id,status)}finally{setBusyId('')}
  }

  return <div className="content-page market-page">
    <div className="market-heading"><div><small>PHASE 2 · CREDIT STOCK CONTROL</small><h1>Credit stock requests</h1><p>Approve only eligible requests within the entrepreneur's available limit. Approval reserves CAMY warehouse stock; dispatch issues the credit and increases the entrepreneur's outstanding balance.</p></div></div>
    {!catalogueLive&&<div className="market-warning">The CAMY catalogue is not active. Activate and verify warehouse stock before dispatching credit stock.</div>}
    <div className="credit-stock-admin-filters"><input placeholder="Search request, entrepreneur or member ID" value={query} onChange={event=>setQuery(event.target.value)}/><select value={filter} onChange={event=>setFilter(event.target.value)}><option>Active</option><option>Pending</option><option>Approved</option><option>Dispatched</option><option>Rejected</option><option>All</option></select></div>
    <section className="credit-stock-admin-list">{visible.length?visible.map(request=>{
      const person=entrepreneurs.find(person=>String(person.id)===String(request.entrepreneurId))
      const available=Math.max(0,Number(person?.credit||0)-Number(person?.used||0))
      const items=request.items||[]
      return <article className="card credit-stock-admin-card" key={request.id}><header><div><small>{request.id}</small><h3>{person?.name||request.entrepreneurName||request.entrepreneurId}</h3><p>{request.entrepreneurId} · {person?.stage||'Unknown stage'}</p></div><span className={`market-status ${String(request.status).toLowerCase()}`}>{request.status}</span></header><div className="credit-stock-admin-metrics"><span><small>REQUEST</small><strong>{money(request.total)}</strong></span><span><small>CREDIT LIMIT</small><strong>{money(person?.credit)}</strong></span><span><small>OUTSTANDING</small><strong>{money(person?.used)}</strong></span><span><small>CURRENT AVAILABLE</small><strong>{money(available)}</strong></span></div><div className="credit-stock-admin-items">{items.map((item,index)=>{const product=products.find(product=>String(product.id)===String(item.productId));return <span key={item.productId||index}><b>{product?.name||item.productId}</b> × {item.qty} <small>{money(item.price)}</small></span>})}</div><footer>{request.status==='Pending'&&<><button className="market-primary" disabled={busyId===request.id} onClick={()=>act(request.id,'Approved')}><CheckCircle2/> Approve & reserve stock</button><button disabled={busyId===request.id} onClick={()=>act(request.id,'Rejected')}>Reject</button></>}{request.status==='Approved'&&<><button className="market-primary" disabled={busyId===request.id} onClick={()=>act(request.id,'Dispatched')}><Truck/> Dispatch & issue credit</button><button disabled={busyId===request.id} onClick={()=>act(request.id,'Rejected')}>Cancel approval</button></>}{request.status==='Dispatched'&&<span><CheckCircle2/> Credit stock issued and recorded in entrepreneur inventory.</span>}{request.status==='Rejected'&&<span>Request closed without using credit.</span>}</footer></article>
    }):<div className="market-empty"><PackageOpen/><h2>No matching credit requests</h2><p>New Phase 2 requests will appear here.</p></div>}</section>
  </div>
}

export function DropshipHome({ person, orders = [], tiers = [], setPage }) {
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

export function DropshipInventoryPage({ person, products = [], orders = [] }) {
  const mine = orders.filter(order => String(order.entrepreneurId) === String(person?.id))
  return <div className="content-page market-page">
    <div className="market-heading"><div><small>CAMY FULFILMENT OPTIONS</small><h1>Choose the right fulfilment path</h1><p>Use drop-shipping for direct client fulfilment. Once credit eligible, you can also request CAMY stock on credit while keeping drop-shipping available.</p></div></div>
    <section className="shop-home-stats"><article><small>CATALOGUE PRODUCTS</small><strong>{products.length}</strong><p>Products available to sell</p></article><article><small>MY DROP-SHIP ORDERS</small><strong>{mine.length}</strong><p>Orders submitted to CAMY</p></article><article><small>DELIVERED</small><strong>{mine.filter(order=>order.status==='Delivered').length}</strong><p>Successfully completed COD deliveries</p></article></section>
    <div className="market-empty"><PackageOpen/><h2>CAMY supports both paths</h2><p>Drop-ship client orders remain available even after you unlock Phase 2 credit stock.</p></div>
  </div>
}
