import { ProductMediaGallery } from './ProductMedia'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BadgeCheck, Check, ChevronRight, Heart, MapPin, Minus, PackageOpen, Plus, Search, ShieldCheck, ShoppingCart, Star, Store, Truck, X, ZoomIn, ZoomOut } from 'lucide-react'
import { api } from './api'
import { PortalOverlay } from './Dialog'
import { CustomerAccount } from './CustomerAccount'
import { CustomerTracker } from './Workflow'
import camyLogo from '../camylogo.png'
import { accountTabs, CustomerAddressBook, CustomerFeedback, CustomerOverview, CustomerPurchaseHistory } from './CustomerFeatures'
import { ProductReviews } from './ProductReviews'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`
const districts = ['Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle','Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle','Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala','Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura','Trincomalee','Vavuniya']
const emptyDetails = { name: '', phone: '', district: '', address: '' }

function ProductDetails({ item, close, add, preview }) {
  const [zoom, setZoom] = useState(1)
  const viewport = useRef(null)
  const drag = useRef(null)
  const pinch = useRef(null)
  const changeZoom = delta => setZoom(old => Math.max(1, Math.min(3, old + delta)))
  const product = item.product
  return <PortalOverlay className="shop-product-overlay" onClose={close} label={product.name}>
    <section className="shop-product-dialog"><button className="shop-dialog-close" onClick={close} aria-label="Close product details"><X/></button>
      <div className="shop-image-panel">{product.media?.length > 1 || product.media?.some(entry => entry.type === 'video') ? <ProductMediaGallery key={product.id} product={product}/> : <><div className="shop-image-viewport" ref={viewport}
        onPointerDown={event => { if (event.pointerType === 'touch' || zoom === 1) return; drag.current = { x: event.clientX, y: event.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={event => { if (!drag.current) return; viewport.current.scrollLeft = drag.current.left - event.clientX + drag.current.x; viewport.current.scrollTop = drag.current.top - event.clientY + drag.current.y }}
        onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        onTouchStart={event => { if (event.touches.length === 2) pinch.current = { distance: Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY), zoom } }}
        onTouchMove={event => { if (event.touches.length === 2 && pinch.current) { const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY); setZoom(Math.max(1, Math.min(3, pinch.current.zoom * distance / pinch.current.distance))) } }}
        onTouchEnd={() => { pinch.current = null }}>
        <div className="shop-image-stage" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><img src={product.image} alt={product.name} draggable="false"/></div>
      </div><div className="shop-zoom-controls"><button onClick={() => changeZoom(-.5)} disabled={zoom <= 1} aria-label="Zoom out"><ZoomOut/></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => changeZoom(.5)} disabled={zoom >= 3} aria-label="Zoom in"><ZoomIn/></button><button onClick={() => { setZoom(1); viewport.current.scrollTo(0, 0) }}>Reset</button></div><p>Zoom to see the details. Drag or swipe the enlarged image.</p></>}</div>
      <div className="shop-product-copy"><span className="shop-eyebrow">{product.category} · {product.code}</span><h2>{product.name}</h2><p>{product.description || 'Original CAMY product.'}</p><strong className="shop-detail-price">{money(item.price ?? product.price)}</strong><span className="shop-detail-seller"><Store size={18}/> {item.person.name} · {item.person.city}</span><h3>Product details</h3><ul>{(product.specs?.length ? product.specs : ['Contact the shop for full specifications.']).map(spec => <li key={spec}><Check size={17}/>{spec}</li>)}</ul><p><b>Warranty:</b> {product.warranty || 'Ask the shop for warranty details'}</p><button className="shop-primary" disabled={item.qty < 1} onClick={() => { add(item); close() }}><ShoppingCart size={18}/> Add to cart</button><small>Send a request first. Pay this shop after approval.</small><ProductReviews productId={product.id} shopId={item.entrepreneurId} preview={preview}/></div>
    </section>
  </PortalOverlay>
}

export function PublicMarketplace() {
  const [remote, setRemote] = useState(null)
  const [loadingError, setLoadingError] = useState('')
  const [shopSearch, setShopSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [district, setDistrict] = useState('')
  const [shop, setShop] = useState(() => new URLSearchParams(location.search).get('shop') || '')
  const [category, setCategory] = useState('All')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [productSort, setProductSort] = useState('recommended')
  const [favourites, setFavourites] = useState([])
  const [reviews, setReviews] = useState([])
  const [addresses, setAddresses] = useState([])
  const [savingFavourite, setSavingFavourite] = useState('')
  const previewChoice = useRef((() => { try { return localStorage.getItem('camy-preview-collection') || 'auto' } catch { return 'auto' } })())
  const [cart, setCart] = useState([])
  const [detail, setDetail] = useState(null)
  const [customer, setCustomer] = useState(emptyDetails)
  const [account, setAccount] = useState(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountOpen, setAccountOpen] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [accountError, setAccountError] = useState('')
  const [orderError, setOrderError] = useState('')
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState([])
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).has('order') ? 'orders' : 'shop')
  const [tracking, setTracking] = useState(() => { const params = new URLSearchParams(location.search); return params.get('order') && params.get('token') ? [{ id: params.get('order'), token: params.get('token') }] : [] })
  const accountId = useRef(null)
  const checkoutKey = useRef(null)
  const ordering = useRef(false)
  const acceptAccount = value => {
    accountId.current = value?.id ?? null
    setAccount(value); setAccountError(''); setMyOrders([]); setFavourites([]); setReviews([]); setAddresses([])
    setCustomer(value ? { name: value.name, phone: value.phone, district: value.district, address: value.address } : emptyDetails)
  }
  const loadOrders = async () => {
    const id = accountId.current
    if (!id) return
    try { const result = await api('/customer/orders'); if (accountId.current === id) { setMyOrders(result.tracking || []); setAccountError('') } }
    catch (error) { if (accountId.current !== id) return; setAccountError(error.message); if (error.status === 401) { acceptAccount(null); setAccountError('Your session ended. Sign in again to see your orders.') } }
  }
  const loadFeatures = async () => {
    const id = accountId.current
    if (!id) return
    const results = await Promise.allSettled([api('/customer/favourites'), api('/customer/reviews'), api('/customer/addresses')])
    if (accountId.current !== id) return
    const [saved, feedback, book] = results
    if (saved.status === 'fulfilled') setFavourites(saved.value.favourites)
    if (feedback.status === 'fulfilled') setReviews(feedback.value.reviews)
    if (book.status === 'fulfilled') setAddresses(book.value.addresses)
    const failure = results.find(result => result.status === 'rejected')
    if (failure) setAccountError(failure.reason.message)
  }
  const toggleFavourite = async item => {
    if (!account) { setAccountOpen(true); return }
    if (savingFavourite) return
    if (item.entrepreneurId.startsWith('PREVIEW-')) { setAccountError('Preview products cannot be saved to a real account. Switch to live shops first.'); return }
    const key = `${item.entrepreneurId}:${item.productId}`
    const saved = !favourites.some(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId))
    setSavingFavourite(key)
    try { await api('/customer/favourites', { method:'POST', body:JSON.stringify({ shopId:item.entrepreneurId, productId:item.productId, saved }) }); await loadFeatures() }
    catch (error) { setAccountError(error.message) } finally { setSavingFavourite('') }
  }
  const refresh = async () => {
    try {
      const live = await api('/marketplace/public')
      const hasLiveStock = live.inventory?.some(item => item.qty > 0)
      if (previewChoice.current === 'preview' || (previewChoice.current === 'auto' && !hasLiveStock)) setRemote(await api('/marketplace/preview'))
      else setRemote(live)
      setLoadingError('')
    }
    catch (error) { setLoadingError(error.message) }
  }
  const switchData = async mode => { if(ordering.current)return; previewChoice.current=mode; try {localStorage.setItem('camy-preview-collection',mode)} catch {} setCart([]); setShop(''); setCategory('All'); await refresh() }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer) }, [])
  useEffect(() => { let active = true; api('/customer/me').then(result => { if (active) acceptAccount(result.customer) }).catch(error => { if (active) setAccountError(error.message) }).finally(() => { if (active) setAccountLoading(false) }); return () => { active = false } }, [])
  useEffect(() => { if (!account) return; loadOrders(); loadFeatures(); const timer = setInterval(loadOrders, 15000); return () => clearInterval(timer) }, [account?.id])
  useEffect(() => { checkoutKey.current = null }, [cart, customer, account?.id])
  const logout = async () => {
    if (ordering.current) return
    try { await api('/customer/logout', { method: 'POST', body: '{}' }); acceptAccount(null); setTracking([]); setCompleted([]); const url = new URL(location.href); url.searchParams.delete('order'); url.searchParams.delete('token'); history.replaceState({}, '', url) }
    catch (error) { setAccountError(error.message) }
  }
  const people = remote?.entrepreneurs || []
  const stock = remote?.inventory || []
  const catalogue = remote?.products || []
  const liveShops = people.filter(person => person.stage !== 'Departed' && stock.some(item => item.entrepreneurId === person.id && item.qty > 0))
  useEffect(() => { if (remote && shop && !liveShops.some(person => person.id === shop)) setShop('') }, [remote, shop])
  useEffect(() => { const url = new URL(location.href); if (shop) url.searchParams.set('shop', shop); else url.searchParams.delete('shop'); history.replaceState({}, '', url) }, [shop])
  const visibleShops = liveShops.filter(person => (!district || person.city === district) && `${person.name} ${person.city || ''}`.toLowerCase().includes(shopSearch.toLowerCase()))
  const selectedShop = liveShops.find(person => person.id === shop)
  const baseListings = tab === 'saved' ? favourites.map(entry => ({entrepreneurId:entry.shopId,productId:entry.productId,product:entry.product || catalogue.find(product=>String(product.id)===String(entry.productId)),person:entry.shop || people.find(person=>person.id===entry.shopId),price:entry.price,qty:entry.available === false ? 0 : 999999})).filter(item=>item.person&&item.product) : stock.map(item => ({ ...item, person: liveShops.find(person => person.id === item.entrepreneurId), product: catalogue.find(product => String(product.id) === String(item.productId)) })).filter(item => item.qty > 0 && item.person && item.product && (!shop || item.entrepreneurId === shop))
  const categories = ['All', ...new Set(baseListings.map(item => item.product.category || 'Other'))]
  useEffect(() => { if (!categories.includes(category)) setCategory('All') }, [remote, shop, category])
  const listings = baseListings.filter(item => (category === 'All' || (item.product.category || 'Other') === category) && (minPrice === '' || Number(item.price ?? item.product.price) >= Number(minPrice)) && (maxPrice === '' || Number(item.price ?? item.product.price) <= Number(maxPrice)) && (tab !== 'saved' || favourites.some(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId))) && `${item.product.name} ${item.product.code || ''} ${item.product.description || ''}`.toLowerCase().includes(productSearch.toLowerCase())).sort((a,b) => productSort === 'low' ? (a.price ?? a.product.price) - (b.price ?? b.product.price) : productSort === 'high' ? (b.price ?? b.product.price) - (a.price ?? a.product.price) : productSort === 'name' ? a.product.name.localeCompare(b.product.name) : 0)
  const groups = [...new Set(cart.map(item => item.shopId))].map(id => { const items = cart.filter(item => item.shopId === id); return { id, name: items[0].shopName, items, total: items.reduce((sum, item) => sum + item.price * item.qty, 0) } })
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const awaiting = myOrders.filter(order => order.status === 'Awaiting payment').length
  const add = (item, quantity = 1) => {
    if (ordering.current) return
    if(item.qty < 1){setAccountError('This saved product is currently unavailable. Please choose another product.');return}
    setOrderError('')
    setCart(old => { const match = old.find(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId)); return match ? old.map(entry => entry === match ? { ...entry, qty: Math.min(1000000, entry.qty + quantity) } : entry) : [...old, { shopId: item.entrepreneurId, shopName: item.person.name, productId: item.productId, name: item.product.name, image: item.product.image, price: Number(item.price ?? item.product.price), qty: Math.min(1000000,quantity) }] })
  }
  const changeQty = (item, delta) => { if (!ordering.current) setCart(old => old.map(entry => entry === item ? { ...entry, qty: Math.min(1000000, Math.max(0, entry.qty + delta)) } : entry).filter(entry => entry.qty > 0)) }
  const chooseShop = id => { setShop(id); setCategory('All'); setProductSearch(''); document.getElementById('shop-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const checkout = async event => {
    event.preventDefault()
    if (ordering.current || !cart.length || accountLoading) return
    if (remote?.preview) { setOrderError('These are temporary preview products. Orders and payments are available only from live shops.'); return }
    if (!account) { setAccountOpen(true); return }
    setOrderError('')
    if (!customer.name.trim() || !/^(?:\+94|0)7\d{8}$/.test(customer.phone.replace(/[\s-]/g, '')) || !customer.district || customer.address.trim().length < 8) return setOrderError('Enter your name, a valid mobile number, district and complete address.')
    ordering.current = true; setBusy(true)
    checkoutKey.current ||= crypto.randomUUID()
    try {
      const result = await api('/marketplace/orders', { method: 'POST', body: JSON.stringify({ requestKey: checkoutKey.current, items: cart.map(item => ({ shopId: item.shopId, productId: item.productId, qty: item.qty, expectedPrice: item.price })), customer }) })
      setCompleted(result.ids || []); setTracking(result.tracking || []); setCart([]); setTab('orders')
      setAccount(old => ({ ...old, ...customer })); checkoutKey.current = null
      await loadOrders(); await refresh(); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setOrderError(error.message)
      if (error.status === 401) { acceptAccount(null); setAccountOpen(true) }
      if (error.status === 409) await refresh()
    } finally { ordering.current = false; setBusy(false) }
  }
  const reconcileCart = () => setCart(old => old.flatMap(item => { const slot = stock.find(entry => entry.entrepreneurId === item.shopId && String(entry.productId) === String(item.productId) && entry.qty > 0); const product = catalogue.find(entry => String(entry.id) === String(item.productId)); return slot && product ? [{ ...item, price: Number(slot.price ?? product.price) }] : [] }))
  const changeTab = value => { setTab(value); if (value === 'saved') { setShop(''); setCategory('All'); setProductSearch(''); setMinPrice(''); setMaxPrice(''); if(remote?.preview){previewChoice.current='live';refresh()} } }
  const useAddress = address => { setCustomer({name:address.name,phone:address.phone,district:address.district,address:address.address}); setTab('shop'); requestAnimationFrame(() => document.getElementById('shop-cart')?.scrollIntoView({behavior:'smooth'})) }
  const reorder = order => {
    let added = 0
    for (const item of order.items || []) { const slot = stock.find(entry => entry.entrepreneurId === order.shopId && String(entry.productId) === String(item.id || item.productId) && entry.qty > 0); const product = catalogue.find(entry => String(entry.id) === String(item.id || item.productId)); const person = people.find(entry => entry.id === order.shopId); if (slot && product && person) { add({...slot,product,person},item.qty); added++ } }
    setTab('shop'); setAccountError(added ? 'Available items were added using current shop prices. Review quantities before requesting again.' : 'These products are no longer available from this shop. Browse the collection for alternatives.')
  }

  return <main className="shop-page">
    <header className="shop-header"><a className="shop-brand" href="/shops"><span className="shop-logo"><img src={camyLogo} alt="CAMY"/></span><span>Shops<small>From local entrepreneurs</small></span></a><nav aria-label="Customer navigation"><button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>Explore shops</button><button className={tab !== 'shop' ? 'active' : ''} onClick={() => changeTab('account')}>My account{awaiting > 0 && <b>{awaiting}</b>}</button></nav><div className="shop-header-actions">{account ? <><button className="shop-account-button" disabled={busy} onClick={() => setAccountOpen(true)}>{account.name.split(' ')[0]}<small>My details</small></button><button className="shop-signout" disabled={busy} onClick={logout}>Sign out</button></> : <button className="shop-signin" disabled={accountLoading} onClick={() => setAccountOpen(true)}>{accountLoading ? 'Loading…' : 'Sign in'}</button>}<button className="shop-cart-button" aria-label={`View cart, ${cartCount} items`} onClick={() => { setTab('shop'); requestAnimationFrame(() => document.getElementById('shop-cart')?.scrollIntoView({ behavior: 'smooth' })) }}><ShoppingCart size={20}/><b>{cartCount}</b></button></div></header>
    {tab === 'shop' && <section className="shop-hero"><div><span className="shop-eyebrow">THE LOCAL CAMY COLLECTION</span><h1>Good products.<br/><em>Closer to home.</em></h1><p>Discover original CAMY products from independent entrepreneurs. Find your shop, send a request, and pay once it’s approved.</p><a className="shop-primary" href="#shop-products">Explore the collection <ArrowRight size={19}/></a><div className="shop-trust"><span><BadgeCheck/>{remote?.preview ? 'Sample shops' : 'Verified shops'}</span><span><ShieldCheck/>Original CAMY</span><span><Truck/>Local delivery</span></div></div><div className="shop-hero-visual"><img src="/products/classic-set.png" alt="CAMY cookware collection"/><span className="shop-hero-caption">Everyday essentials, thoughtfully chosen.</span><div className="shop-hero-note"><Store/><span><strong>Shop with a local entrepreneur</strong><small>One cart. A clear order for every shop.</small></span></div></div></section>}
    <div className="shop-shell">
      {remote?.preview && tab === 'shop' && <div className="shop-preview-banner"><span><strong>Temporary sample collection</strong>Realistic preview products and sample shops for trying the layout. These are not live stock or sellers; sample requests, payments and reviews are disabled.</span><button className="shop-secondary" onClick={()=>switchData('live')}>Remove preview / view live shops</button></div>}
      {accountError && <div className="shop-alert" role="alert">{accountError}<button onClick={() => setAccountOpen(true)}>Open account</button></div>}
      {completed.length > 0 && <div className="shop-success" role="status"><Check/><div><strong>{completed.length === 1 ? 'Your request is with the shop' : `${completed.length} shop requests sent`}</strong><p>Each shop approves its own order. Bank details appear on that order after approval. Pay each shop separately and upload its receipt.</p></div><button aria-label="Dismiss confirmation" onClick={() => setCompleted([])}><X/></button></div>}
      {tab !== 'shop' && <nav className="customer-account-tabs" aria-label="Account sections">{accountTabs.map(([value,label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => changeTab(value)}>{label}</button>)}</nav>}
      {tab === 'account' || tab === 'reviews' || tab === 'addresses' ? !account ? <div className="shop-empty"><PackageOpen/><h2>Your customer account</h2><p>Sign in to manage purchases, saved products, reviews and delivery addresses.</p><button className="shop-primary" onClick={() => setAccountOpen(true)}>Sign in / Register</button></div> : tab === 'account' ? <CustomerOverview account={account} orders={myOrders} favourites={favourites} reviews={reviews} onTab={changeTab} editAccount={() => setAccountOpen(true)}/> : tab === 'reviews' ? <CustomerFeedback reviews={reviews} onOrders={() => changeTab('history')}/> : <CustomerAddressBook account={account} addresses={addresses} districts={districts} onReload={loadFeatures} onAccount={value => {setAccount(value); setCustomer({name:value.name,phone:value.phone,district:value.district,address:value.address})}} useAddress={useAddress}/> : tab === 'orders' || tab === 'history' ? <section className="shop-orders"><div className="shop-section-heading"><div><span className="shop-eyebrow">YOUR CUSTOMER ACCOUNT</span><h1>{tab === 'history' ? 'Purchase history' : 'My orders'}</h1><p>{tab === 'history' ? 'Explore purchased items, find previous orders and review delivered products.' : 'A separate order, approval and payment for every shop.'}</p></div>{account && <button className="shop-secondary" onClick={loadOrders}>Refresh orders</button>}</div>{awaiting > 0 && <div className="shop-payment-notice"><ShieldCheck/><span><strong>{awaiting} {awaiting === 1 ? 'order is' : 'orders are'} ready for payment.</strong> Open the approved order below. Transfer only its amount to its shop’s account.</span></div>}{!account && <div className="shop-empty"><PackageOpen/><h2>Your orders, all in one place</h2><p>Sign in to see your requests, approvals, receipts and delivery updates.</p><button className="shop-primary" disabled={accountLoading} onClick={() => setAccountOpen(true)}>Sign in / Register</button></div>}{account && <CustomerPurchaseHistory orders={myOrders} history={tab === 'history'} reviews={reviews} onReview={loadFeatures} reorder={reorder} onOrderUpdate={loadOrders}/ >}{tracking.filter(item => !myOrders.some(order => order.id === item.id)).map(item => <CustomerTracker key={item.id} tracking={item}/>)}</section> : <>
        {tab === 'shop' && <section className="shop-directory"><div className="shop-section-heading"><div><span className="shop-eyebrow">01 / FIND YOUR SHOP</span><h2>Meet your local entrepreneurs</h2><p>Select a shop, or explore products from all shops.</p></div><button className={!shop ? 'shop-secondary active' : 'shop-secondary'} onClick={() => chooseShop('')}>All shops</button></div><div className="shop-search-row"><label className="shop-search"><Search size={19}/><input aria-label="Search shops" value={shopSearch} onChange={event => setShopSearch(event.target.value)} placeholder="Search by shop or town"/></label><select aria-label="Filter shops by district" value={district} onChange={event => setDistrict(event.target.value)}><option value="">All districts</option>{districts.map(item => <option key={item}>{item}</option>)}</select></div><div className="shop-directory-grid">{visibleShops.map(person => <button className={shop === person.id ? 'selected' : ''} onClick={() => chooseShop(person.id)} key={person.id}><span className="shop-store-icon"><Store/></span><span><small><BadgeCheck size={13}/> {remote?.preview ? 'SAMPLE SHOP' : 'CAMY ENTREPRENEUR'}</small><strong>{person.name}</strong><span><MapPin size={14}/>{person.city || 'Sri Lanka'}</span></span>{shop === person.id ? <Check size={21}/> : <ChevronRight size={21}/>}</button>)}</div>{!remote && !loadingError && <p className="shop-loading" role="status">Loading local shops…</p>}{loadingError && <div className="shop-alert" role="alert">{loadingError}<button onClick={refresh}>Try again</button></div>}{remote && !visibleShops.length && <div className="shop-empty"><Store/><h3>No shops found</h3><p>Try another district or clear your search.</p><button className="shop-secondary" onClick={() => { setDistrict(''); setShopSearch('') }}>Clear filters</button>{!liveShops.length && <button className="shop-secondary shop-account-empty-action" onClick={() => switchData('preview')}>View temporary sample collection</button>}</div>}</section>}
        <div className="shop-buy-layout"><section id="shop-products" className="shop-products"><div className="shop-section-heading"><div><span className="shop-eyebrow">02 / CHOOSE YOUR PRODUCTS</span><h2>{tab === 'saved' ? 'Your saved products' : selectedShop ? selectedShop.name : 'The CAMY collection'}</h2><p>{selectedShop ? `Available from ${selectedShop.city || 'your local shop'}.` : 'Shop everyday essentials from our entrepreneur community.'}</p></div><span className="shop-result-count">{listings.length} products</span></div><label className="shop-search"><Search size={19}/><input aria-label="Search products" placeholder="Search products or model code" value={productSearch} onChange={event => setProductSearch(event.target.value)}/></label><div className="shop-product-filters"><label>Min price<input type="number" min="0" aria-label="Minimum product price" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="Rs. 0"/></label><label>Max price<input type="number" min="0" aria-label="Maximum product price" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Any price"/></label><label>Sort products<select value={productSort} onChange={event => setProductSort(event.target.value)}><option value="recommended">Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name: A to Z</option></select></label><button className="shop-secondary" onClick={() => { setMinPrice(''); setMaxPrice(''); setProductSort('recommended') }}>Reset</button></div><nav className="shop-categories" aria-label="Product categories">{categories.map(item => <button className={category === item ? 'active' : ''} aria-pressed={category === item} key={item} onClick={() => setCategory(item)}>{item}</button>)}</nav><div className="shop-product-grid">{listings.map(item => <article className="shop-product-card" key={`${item.entrepreneurId}-${item.productId}`}><button className="shop-product-image" onClick={() => setDetail(item)} aria-label={`View ${item.product.name} details`}><img loading="lazy" src={item.product.image} alt={item.product.name}/><span>{item.product.category}</span></button><button className="shop-favourite" disabled={!!savingFavourite} aria-label={`Save ${item.product.name}`} aria-pressed={favourites.some(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId))} onClick={() => toggleFavourite(item)}><Heart size={19} fill={favourites.some(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId)) ? 'currentColor' : 'none'}/></button><div className="shop-product-body"><button className="shop-product-title" onClick={() => setDetail(item)}>{item.product.name}</button><button className="shop-seller" onClick={() => chooseShop(item.entrepreneurId)}><Store size={14}/>{item.person.name}</button><div className="shop-product-rating">{(() => { const summary = remote?.ratingSummary?.find(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId)); return summary ? <><Star size={13} fill="currentColor"/>{Number(summary.average).toFixed(1)} <span>({summary.count})</span></> : <span>No reviews yet</span> })()}</div><div className="shop-product-price"><strong>{money(item.price ?? item.product.price)}</strong><span>{item.qty > 0 ? 'Available' : 'Unavailable'}</span></div><button className="shop-add" disabled={busy || item.qty < 1} onClick={() => add(item)}><Plus size={18}/>Add to cart{cart.some(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId)) && <b>{cart.find(entry => entry.shopId === item.entrepreneurId && String(entry.productId) === String(item.productId)).qty}</b>}</button></div></article>)}</div>{remote && !listings.length && <div className="shop-empty"><PackageOpen/><h3>No matching products</h3><p>Try another shop or change your filters.</p><button className="shop-secondary" onClick={() => { setCategory('All'); setProductSearch(''); setShop(''); setMinPrice(''); setMaxPrice('') }}>Reset product filters</button></div>}</section>
          <aside id="shop-cart" className="shop-cart"><div className="shop-cart-heading"><ShoppingCart/><div><span className="shop-eyebrow">03 / YOUR REQUEST</span><h2>Your cart <b>{cartCount}</b></h2></div></div>{!cart.length ? <div className="shop-empty"><ShoppingCart/><h3>A little something for home?</h3><p>Tap a product to explore its details, then add your favourites.</p></div> : <><div className="shop-cart-groups">{groups.map(group => <section className="shop-cart-group" key={group.id}><header><span><Store size={16}/>{group.name}</span><strong>{money(group.total)}</strong></header>{group.items.map(item => <article key={item.productId}><img src={item.image} alt=""/><div><strong>{item.name}</strong><small>{money(item.price)} each</small><div className="shop-quantity"><button disabled={busy} onClick={() => changeQty(item, -1)} aria-label={`Decrease ${item.name} quantity`}><Minus size={15}/></button><span>{item.qty}</span><button disabled={busy} onClick={() => changeQty(item, 1)} aria-label={`Increase ${item.name} quantity`}><Plus size={15}/></button><button className="shop-remove" disabled={busy} onClick={() => changeQty(item, -item.qty)} aria-label={`Remove ${item.name}`}><X size={15}/></button></div></div></article>)}</section>)}</div><div className="shop-cart-total"><span>Estimated total<small>{groups.length} {groups.length === 1 ? 'shop order' : 'separate shop orders'}</small></span><strong>{money(total)}</strong></div><div className="shop-split-note"><ShieldCheck size={20}/><p>{groups.length > 1 ? 'One request per shop. Each shop approves independently and provides its own bank account. Pay and upload a separate receipt for each approved order.' : 'No payment now. This shop confirms availability and shares its bank details after approval.'}</p></div><form className="shop-checkout" onSubmit={checkout} noValidate><fieldset disabled={busy}><h3>Delivery details</h3>{account ? <p>Your saved details are ready. Any changes will be saved with this request.</p> : <p>Sign in or register to save your address and track your orders.</p>}{account && <>{addresses.length > 0 && <label>Saved delivery address<select aria-label="Choose saved delivery address" defaultValue="" onChange={event => { const address = addresses.find(entry => String(entry.id) === event.target.value); if(address) setCustomer({name:address.name,phone:address.phone,district:address.district,address:address.address}) }}><option value="">Use current details</option>{addresses.map(address => <option key={address.id} value={address.id}>{address.label} · {address.district}</option>)}</select></label>}{[['name','Full name','name'],['phone','Mobile number','tel']].map(([key,label,autoComplete]) => <label key={key}>{label}<input maxLength={key === 'name' ? 150 : 30} autoComplete={autoComplete} inputMode={key === 'phone' ? 'tel' : 'text'} value={customer[key]} onChange={event => setCustomer(old => ({ ...old, [key]: event.target.value }))}/></label>)}<label>District<select value={customer.district} onChange={event => setCustomer(old => ({ ...old, district: event.target.value }))}><option value="">Choose district</option>{districts.map(item => <option key={item}>{item}</option>)}</select></label><label>Full delivery address<textarea maxLength={2000} autoComplete="street-address" rows={3} value={customer.address} onChange={event => setCustomer(old => ({ ...old, address: event.target.value }))}/></label></>}{orderError && <div className="shop-alert" role="alert">{orderError}<button type="button" onClick={reconcileCart}>Update cart with current prices</button></div>}<button className="shop-primary" disabled={busy || accountLoading}>{busy ? 'Sending requests…' : account ? `Send ${groups.length > 1 ? `${groups.length} shop requests` : 'order request'}` : 'Sign in to continue'}<ArrowRight size={18}/></button><small className="shop-checkout-footnote">Approval first. Bank payment second. Delivery after payment verification.</small></fieldset></form></>}</aside>
        </div></>}
    </div>{tab === 'shop' && cartCount > 0 && <button className="shop-mobile-cart" onClick={() => document.getElementById('shop-cart')?.scrollIntoView({ behavior: 'smooth' })}><ShoppingCart size={20}/><span>{cartCount} items · {groups.length} {groups.length === 1 ? 'shop' : 'shops'}</span><strong>{money(total)}</strong><ArrowRight size={18}/></button>}<footer className="shop-footer"><span className="shop-logo"><img src={camyLogo} alt="CAMY"/></span><p>Original products. Local entrepreneurs. A clear path from request to delivery.</p><a href="/">Entrepreneur & staff portal <ArrowRight size={15}/></a></footer>
    {accountOpen && <CustomerAccount account={account} details={customer} districts={districts} onAccount={acceptAccount} onClose={() => setAccountOpen(false)}/>}
    {detail && <ProductDetails preview={remote?.preview} item={detail} close={() => setDetail(null)} add={add}/>}
  </main>
}
