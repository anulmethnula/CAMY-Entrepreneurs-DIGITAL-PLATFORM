import { districts, occupations, businessCategories, businessDurations, incomeRanges, followerRanges, joinReasons } from './registration-options'
import { ProductCostEditor } from './ProductCostEditor'
import { AdminInventory } from './AdminInventory'
import { productCosts, deliveryLabel, customerProductPrice, payableDeliveryCost } from './productCosts'
import { ProductMediaEditor, ProductMediaGallery } from './ProductMedia'
import { ProductBulkImport } from './ProductBulkImport'
import { EntrepreneurCustomers } from './EntrepreneurCustomers'
import { exportReport, downloadWorkbook, reportSheets } from './reports'
import { PortalOverlay } from './Dialog'
import { api } from './api'
import { creditForSales, creditProgression, visibleCreditLadder } from './creditRules'
import { BankDetails, OrderReview } from './Workflow'
import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Banknote, Bell, Box, CalendarDays, Check, ChevronDown,
  ChevronRight, CircleDollarSign, ClipboardList, CreditCard, Download, Eye, EyeOff, FileBarChart,
  FileSpreadsheet, FileText, Gift, Grid2X2, Headphones, Heart, Home, LayoutDashboard, LogOut, MapPin,
  Menu, Minus, PackageCheck, PackageOpen, PackageSearch, Pencil, Phone, Plus,
  ReceiptText, RotateCcw, Search, Settings, ShoppingBag, ShoppingCart, Sparkles, Star, Store,
  Target, Trash2, TrendingUp, Trophy, Truck, UserPlus, UserRound, UsersRound,
  WalletCards, X, Copy, ExternalLink, QrCode,
} from 'lucide-react'
import { initialEntrepreneurs, initialNotifications, initialOrders, initialProducts, initialTiers } from './data'
import { AdminCreditStockPage, CreditInventoryPage, CreditStockPage, ShopHome, StockSupplyPage } from './Marketplace'

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`
const SUPPORT_PHONE_DISPLAY = '+94 77 716 5336'
const SUPPORT_PHONE_DIAL = '+94777165336'
const shortMoney = (value) => value >= 1000000 ? `Rs. ${(value / 1000000).toFixed(2)}M` : value >= 1000 ? `Rs. ${(value / 1000).toFixed(0)}K` : money(value)
const displayDate = (value) => !value || Number.isNaN(new Date(value).getTime()) ? 'Not provided' : new Intl.DateTimeFormat('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
const avatarFor = person => person?.avatar || person?.image || ''
const initialsFor = person => person?.initials || String(person?.name||'CE').split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase()
const readImageFile = (event, update) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update('image', String(reader.result)); reader.readAsDataURL(file) }
const readReceiptFile = file => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read the receipt file.'));reader.readAsDataURL(file)})
const userPermissions = user => {
  if (!user || user.role === 'admin' || user.permissions_json == null) return null
  try {
    const parsed = JSON.parse(user.permissions_json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
const applicationWhatsAppUrl = request => {
  let number = String(request?.phone || '').replace(/\D/g, '')
  if (number.startsWith('0')) number = '94' + number.slice(1)
  const member = request?.member_id ? ` Member ID: ${request.member_id}.` : ''
  const message = `Hello ${request?.full_name || 'CAMY Entrepreneur'}, your CAMY entrepreneur account has been approved. Your login username is ${request?.email || ''}. Please use the password you created during registration to sign in.${member}`
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : ''
}
const publicRegistrationUrl = () => new URL('/register', String(import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '') + '/').toString()
const registrationLocationActive = () => window.location.pathname.replace(/\/+$/, '') === '/register' || new URLSearchParams(window.location.search).get('apply') === '1'

const pageTitles = {
  home: 'Business Dashboard',
  products: 'Create Customer Order',
  orders: 'Orders',
  earnings: 'Commissions',
  commissions: 'Commissions',
  'commission-detail': 'Commission Details',
  'credit-stock': 'Credit Items',
  'credit-requests': 'Credit Orders',
  'credit-inventory': 'Credit Inventory',
  credit: 'Credit Payments',
  repayments: 'Repayment History',
  'repayment-detail': 'Repayment Details',
  growth: 'Business Growth',
  profile: 'My Profile',
  overview: 'Admin Dashboard',
  entrepreneurs: 'Entrepreneurs',
  'admin-orders': 'Customer Orders',
  'admin-products': 'Products and Stock',
  'stock-supply': 'Stock Requests',
  'credit-settlements': 'Credit Payments',
  'credit-control': 'Credit Control',
  reports: 'Reports',
  'user-access': 'Users and Access',
}

function setMeta(name, content, property = false) {
  const key = property ? 'property' : 'name'
  let element = document.head.querySelector(`meta[${key}="${name}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(key, name)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

function updateSeo({ title, description, index = false, path = window.location.pathname }) {
  const fullTitle = title.includes('CAMY') ? title : `${title} | CAMY Entrepreneurs`
  const canonicalUrl = new URL(path, window.location.origin).toString()
  document.title = fullTitle
  setMeta('description', description)
  setMeta('robots', index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive')
  setMeta('og:title', fullTitle, true)
  setMeta('og:description', description, true)
  setMeta('og:url', canonicalUrl, true)
  setMeta('og:image', new URL('/camy-logo-transparent.png', window.location.origin).toString(), true)
  setMeta('twitter:title', fullTitle)
  setMeta('twitter:description', description)

  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = canonicalUrl
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Preferences remain usable if storage is full. */ } }, [key, value])
  useEffect(() => { const sync = event => { if (event.key !== key || event.newValue === null) return; try { setValue(JSON.parse(event.newValue)) } catch {} }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync) }, [key])
  return [value, setValue]
}

function Brand({ inverse = false }) {
  return <div className={`brand ${inverse ? 'inverse' : ''}`}><img src="/camy-logo-tight.png" width="430" height="205" alt="CAMY" decoding="async" /><span>ENTREPRENEURS</span></div>
}

const entrepreneurNav = [
  ['home', 'Home', Home], ['products', 'New client order', ShoppingBag],
  ['orders', 'Drop-shipping orders', PackageSearch], ['earnings', 'Commission', WalletCards],
  ['credit-stock', 'Credit items', PackageCheck], ['credit-requests', 'My credit orders', ClipboardList], ['credit', 'Credit payments', CreditCard],
  ['growth', 'My growth', TrendingUp], ['profile', 'My profile', UserRound],
]
const adminNav = [
  ['overview', 'Overview', LayoutDashboard], ['entrepreneurs', 'Entrepreneurs', UsersRound],
  ['admin-products', 'Products', PackageOpen], ['admin-orders', 'Customer orders', ClipboardList],
  ['payouts', 'Commission payouts', Banknote], ['stock-supply', 'Credit stock', PackageCheck],
  ['credit-control', 'Credit control', CreditCard], ['credit-settlements', 'Credit settlements', ReceiptText],
  ['reports', 'Reports', FileBarChart], ['user-access', 'Users & access', Settings],
]

const initialSystemUsers = [
  { id:'USR-001', name:'CAMY Admin', email:'admin@camy.lk', role:'Super Admin', active:true, lastAccess:'Today, 3:05 PM', permissions:['overview','entrepreneurs','admin-orders','admin-products','payouts','credit-settlements','credit-control','reports','user-access'] },
  { id:'USR-002', name:'Operations Manager', email:'operations@camy.lk', role:'Operations', active:true, lastAccess:'Today, 1:42 PM', permissions:['overview','entrepreneurs','admin-orders','admin-products','reports'] },
  { id:'USR-003', name:'Accounts Officer', email:'accounts@camy.lk', role:'Finance', active:true, lastAccess:'Yesterday, 4:18 PM', permissions:['overview','payouts','credit-settlements','credit-control','reports'] },
]

function Sidebar({ mode, setMode, page, setPage, open, setOpen, notify, onLogout, onChangePassword, user, creditEligible }) {
  const allowed = userPermissions(user)
  const hasCreditAccess=creditEligible??globalThis.__camyCreditEligible??false
  const nav = mode === 'admin' ? adminNav.filter(([id]) => allowed === null || allowed.includes(id) || (id==='credit-settlements'&&allowed.includes('credit-control'))) : entrepreneurNav.filter(([id])=>id!=='products')
  return <>
    <aside className={`sidebar-v2 ${open ? 'open' : ''}`}>
      <div className="side-brand"><Brand /><button className="mobile-only icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
      <div className="workspace-card account-workspace-card">
        <span>{mode === 'admin' ? <Settings /> : <Store />}</span>
        <div><strong>{mode === 'admin' ? 'CAMY Admin' : 'My business'}</strong><small>{mode === 'admin' ? 'Management workspace' : user?.full_name||user?.name||'CAMY Entrepreneur'}</small></div>
        <BadgeCheck />
      </div>
      <p className="side-label">{mode === 'admin' ? 'Management' : 'Workspace'}</p>
      <nav className="side-links">
        {nav.map(([id, label, Icon]) => {const creditLocked=mode!=='admin'&&!hasCreditAccess&&['credit-stock','credit-requests','credit'].includes(id);return <button key={id} disabled={creditLocked} title={creditLocked?'Unlocks after you become credit eligible':''} className={`${page === id || (id==='credit-stock'&&page==='credit-inventory') || (id==='credit'&&['repayments','repayment-detail'].includes(page)) || (id==='earnings'&&['commissions','commission-detail'].includes(page)) ? 'active' : ''}${creditLocked?' credit-locked':''}`} onClick={() => {if(creditLocked)return;setPage(id);setOpen(false)}}><Icon /><span>{label}</span>{creditLocked&&<small>LOCKED</small>}</button>})}
      </nav>
      <button className="logout" onClick={onLogout}><LogOut /> Sign out <small>{user?.email}</small></button>
    </aside>
    {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close menu" />}
  </>
}

function Topbar({ mode, page, setPage, onMenu, onNewOrder, onCart, cartCount, notifications, setNotifications, onSearch, query, setQuery, profile, user }) {
  const labels = Object.fromEntries([...entrepreneurNav, ...adminNav].map(([id, label]) => [id, label]))
  labels['credit-requests']='My credit orders'
  labels['credit-inventory']='My credit stock'
  labels.earnings='Commission'
  labels.commissions='Commission payments'
  labels['commission-detail']='Commission details'
  labels.repayments='Credit repayments'
  labels['repayment-detail']='Repayment details'
  const activeProfile = profile || (()=>{try{return JSON.parse(localStorage.getItem('camy-profile-v2')||'null')}catch{return null}})()
  const activeNotificationCount=notifications.filter(notification=>!notification.read).length
  const runSearch = (event) => {
    if (event.key !== 'Enter' || !query.trim()) return
    onSearch(query.trim())
  }
  return <header className="topbar-v2">
    <div className="topbar-left"><button className="desktop-hidden icon-btn" onClick={onMenu}><Menu /></button><div><small>{mode === 'admin' ? 'CAMY Management' : 'CAMY Entrepreneurs'}</small><strong>{labels[page] || 'Dashboard'}</strong></div></div>
    <div className="topbar-actions">
      <label className="top-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={runSearch} placeholder={mode === 'admin' ? 'Search management records…' : 'Search products or orders…'} /></label>
      <button className="icon-btn notify-btn" onClick={() => setNotifications(true)} aria-label={`Notifications${activeNotificationCount?`, ${activeNotificationCount} active`:''}`}><Bell />{activeNotificationCount>0&&<b aria-hidden="true">{activeNotificationCount>99?'99+':activeNotificationCount}</b>}</button>
      {mode === 'entrepreneur' && <div className="topbar-commerce"><button className="cart-top new-order-top" type="button" onClick={onNewOrder}><ShoppingBag /><span>New order</span></button><button className="topbar-cart" type="button" onClick={onCart} aria-label={`Open cart with ${cartCount} item${cartCount===1?'':'s'}`} title="Open cart"><ShoppingCart/><span>Cart</span>{cartCount>0&&<b>{cartCount>99?'99+':cartCount}</b>}</button></div>}
      {mode==='entrepreneur'?<button type="button" className="user-chip user-chip-button" onClick={()=>setPage('profile')} aria-label="Open my profile"><span className="user-chip-avatar">{activeProfile?.image ? <img src={activeProfile.image} alt="" /> : (activeProfile?.name||'CE').split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase()}</span><div><strong>{activeProfile?.name||'CAMY Entrepreneur'}</strong><small>My profile</small></div></button>:<div className="user-chip"><span>AD</span><div><strong>{user?.full_name||'CAMY Admin'}</strong><small>{user?.access_role||(user?.role==='admin'?'Super Admin':'Staff')}</small></div></div>}
      <button type="button" className="icon-btn topbar-signout" onClick={()=>globalThis.__camyLogout?.()} aria-label="Sign out" title="Sign out"><LogOut/></button>
    </div>
  </header>
  }

function PageTitle({ eyebrow, title, text, children }) {
  return <div className="page-title"><div className="page-title-copy"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{children && <div className="page-actions">{children}</div>}</div>
}

function Button({ children, variant = 'primary', icon: Icon, ...props }) {
  const reviewablePending=children==='Request pending'; return <button className={`btn ${variant}`} {...props} disabled={reviewablePending?false:props.disabled}>{Icon && <Icon />}{children}</button>
}

function Status({ value }) { const label=String(value || 'Unknown'); const css=label.toLowerCase().replace(/[^a-z0-9]+/g,'-'); return <span className={`status-pill ${css}`}><i />{label}</span> }

function Metric({ icon: Icon, label, value, detail, tone = 'coral', onClick }) {
  const content=<><div className={`metric-icon ${tone}`}><Icon /></div><div><span>{label}</span><strong>{value}</strong><small><TrendingUp />{detail}</small></div>{onClick&&<ChevronRight className="metric-arrow"/>}</>
  return onClick?<button type="button" className="metric-v2 metric-link" onClick={onClick} aria-label={`Open ${label}`}>{content}</button>:<article className="metric-v2">{content}</article>
}

function SalesBars({ values = [42, 61, 48, 76, 68, 88, 79, 96], labels = ['W1','W2','W3','W4','W5','W6','W7','W8'], amounts }) {
  return <div className="chart-v2"><div className="chart-lines"><i /><i /><i /><i /></div><div className="chart-bars">{values.map((v, i) => <div key={labels[i]}><span style={{ height: `${v}%` }} className={i === values.length - 1 ? 'latest' : ''}><em>{shortMoney(amounts?.[i] ?? v * 480)}</em></span><small>{labels[i]}</small></div>)}</div></div>
}

function LegacyEntrepreneurHome({ setPage, orders, products, openProduct }) {
  return <div className="content-page">
    <section className="welcome-hero">
      <div><span className="hero-label"><Sparkles /> THURSDAY, 10 SEPTEMBER</span><h1>Build your business.<br /><em>We’ll power the growth.</em></h1><p>You’re only <strong>Rs. 21,500</strong> away from unlocking a Rs. 40,000 credit limit.</p><div><Button variant="white" icon={ShoppingBag} onClick={() => setPage('products')}>Start a customer order</Button><Button variant="ghost" onClick={() => setPage('growth')}>See my progress <ArrowRight /></Button></div></div>
      <div className="tier-hero"><div><span>LEVEL 2</span><BadgeCheck /></div><h3>Growth Partner</h3><p>Rs. 378,500 of Rs. 400,000</p><div className="progress"><i style={{ width: '84%' }} /></div><small><Target /> 84% complete · Keep going!</small></div>
    </section>
    <section className="metric-row"><Metric icon={CircleDollarSign} label="Sales this month" value="Rs. 186,400" detail="18.2% from last month" /><Metric icon={WalletCards} label="Available credit" value="Rs. 18,650" detail="Rs. 11,350 currently used" tone="purple" /><Metric icon={PackageOpen} label="Active orders" value={String(orders.filter(o => !['Delivered','Returned'].includes(o.status)).length).padStart(2,'0')} detail="3 ready for delivery" tone="green" /><Metric icon={PackageCheck} label="Delivery success" value="96.8%" detail="2.1% improvement" tone="gold" /></section>
    <section className="dashboard-grid"><article className="card chart-card"><div className="card-head"><div><span>SALES OVERVIEW</span><h2>Rs. 186,400 <small>this month</small></h2></div><button>This month <ChevronDown /></button></div><SalesBars /></article><article className="card"><div className="card-head"><div><span>RECENT ACTIVITY</span><h2>Latest orders</h2></div><button onClick={() => setPage('orders')}>View all <ArrowRight /></button></div><div className="recent-orders">{orders.slice(0,4).map(o => <button key={o.id} onClick={() => setPage('orders')}><span><Box /></span><div><strong>{o.id}</strong><small>{o.customer} · {o.product}</small></div><div><b>{money(o.amount)}</b><Status value={o.status} /></div></button>)}</div></article></section>
    <section className="card journey"><div className="card-head"><div><span>YOUR CAMY JOURNEY</span><h2>Growing with every sale</h2></div><b className="streak">🔥 47-day selling streak</b></div><div className="journey-track"><div className="done"><i><Check /></i><span><small>STAGE 1</small><strong>Trial seller</strong><em>Drop-shipping completed</em></span></div><hr /><div className="current"><i><TrendingUp /></i><span><small>STAGE 2 · CURRENT</small><strong>Credit eligible</strong><em>Building your credit limit</em></span></div><hr /><div><i><Trophy /></i><span><small>STAGE 3</small><strong>Growth leader</strong><em>Unlock premium benefits</em></span></div></div></section>
    <section className="section-block"><div className="section-title"><div><span>CURATED FOR YOU</span><h2>Products moving fast this week</h2></div><button onClick={() => setPage('products')}>Browse full catalogue <ArrowRight /></button></div><div className="quick-products">{products.slice(2,6).map(p => <button key={p.id} onClick={() => openProduct(p)}><div><img src={p.image} alt={p.name} />{p.tag && <span>{p.tag}</span>}</div><small>{p.category}</small><strong>{p.name}</strong><b>{money(p.price)}</b></button>)}</div></section>
  </div>
}

function EntrepreneurHome({ setPage, orders, products, openProduct, person, tiers }) {
  const validOrders=orders.filter(order=>order.status!=='Returned'); const today=new Date(); const monthKey=today.toISOString().slice(0,7); const monthOrders=validOrders.filter(order=>String(order.date).startsWith(monthKey)); const monthSales=monthOrders.reduce((sum,order)=>sum+Number(order.amount||0),0); const active=orders.filter(order=>!['Delivered','Returned','Rejected'].includes(order.status)); const delivered=orders.filter(order=>order.status==='Delivered').length; const returned=orders.filter(order=>order.status==='Returned').length; const success=delivered+returned?delivered/(delivered+returned)*100:100; const credit=Number(person?.credit||0); const used=Number(person?.used||0); const creditProgress=creditProgression(tiers,person?.sales); const nextTier=creditProgress.next; const progress=creditProgress.progress; const gap=creditProgress.remaining; const customers=new Set(orders.map(order=>order.phone)).size; const weekly=[0,0,0,0];monthOrders.forEach(order=>{const week=Math.min(3,Math.floor((new Date(order.date).getDate()-1)/7));weekly[week]+=Number(order.amount||0)});const maxWeek=Math.max(...weekly,1);const chart=weekly.map(value=>Math.max(7,Math.round(value/maxWeek*100))); const fastProducts=products.filter(product=>product.stock>0).sort((a,b)=>b.rating-a.rating).slice(0,4)
  return <div className="content-page entrepreneur-home"><section className="entrepreneur-hero"><div><span><Sparkles /> YOUR CAMY BUSINESS</span><h1>Welcome back, <em>{person?.name?.split(' ')[0]||'Partner'}.</em></h1><p>{nextTier?<>You are <strong>{money(gap)}</strong> in sales away from unlocking {money(nextTier.credit)} business credit.</>:<>You have reached the highest CAMY credit milestone. Keep building your customer network.</>}</p><div><Button variant="white" icon={ShoppingBag} onClick={()=>setPage('products')}>Create customer order</Button><Button variant="ghost" onClick={()=>setPage('orders')}>Track my orders <ArrowRight /></Button></div></div><div className="entrepreneur-level"><header><span>{person?.stage||'Trial seller'}</span><BadgeCheck /></header><small>CURRENT BUSINESS SALES</small><strong>{money(person?.sales||0)}</strong><div><i style={{width:`${nextTier?progress:100}%`}} /></div><p><Target /> {nextTier?`${Math.round(progress)}% toward next tier`:'All milestones completed'}</p></div></section><section className="metric-row entrepreneur-metrics"><Metric icon={CircleDollarSign} label="Sales this month" value={money(monthSales)} detail={`${monthOrders.length} customer orders`} /><Metric icon={WalletCards} label="Available credit" value={money(Math.max(0,credit-used))} detail={`${money(used)} currently used`} tone="purple" /><Metric icon={PackageOpen} label="Active orders" value={String(active.length).padStart(2,'0')} detail={`${active.filter(order=>order.status==='Dispatched').length} dispatched`} tone="green" /><Metric icon={PackageCheck} label="Delivery success" value={`${success.toFixed(1)}%`} detail={`${delivered} successfully delivered`} tone="gold" /></section><section className="dashboard-grid"><article className="card chart-card"><div className="card-head"><div><span>LIVE SALES OVERVIEW</span><h2>{money(monthSales)} <small>this month</small></h2></div><b className="positive">{customers} customers</b></div><SalesBars values={chart} labels={['Week 1','Week 2','Week 3','Week 4']} /></article><article className="card"><div className="card-head"><div><span>MY RECENT ACTIVITY</span><h2>Latest orders</h2></div><button onClick={()=>setPage('orders')}>View all <ArrowRight /></button></div><div className="recent-orders">{orders.slice(0,4).map(order=><button key={order.id} onClick={()=>setPage('orders')}><span><Box /></span><div><strong>{order.id}</strong><small>{order.customer} · {order.product}</small></div><div><b>{money(order.amount)}</b><Status value={order.status} /></div></button>)}{!orders.length&&<Empty icon={PackageSearch} title="No orders yet" text="Create your first customer order from the product catalogue." />}</div></article></section><section className="entrepreneur-action-grid"><button onClick={()=>setPage('products')}><span><ShoppingBag /></span><div><strong>Start selling</strong><small>Browse live stock and create a customer order</small></div><ArrowRight /></button><button onClick={()=>setPage('credit')}><span><WalletCards /></span><div><strong>Manage credit</strong><small>Check available credit and settlements</small></div><ArrowRight /></button><button onClick={()=>setPage('growth')}><span><Trophy /></span><div><strong>View my growth</strong><small>See rank, performance, and milestones</small></div><ArrowRight /></button></section><section className="section-block"><div className="section-title"><div><span>AVAILABLE NOW</span><h2>Products ready for your next customer</h2></div><button onClick={()=>setPage('products')}>Browse full catalogue <ArrowRight /></button></div><div className="quick-products">{fastProducts.map(product=><button key={product.id} onClick={()=>openProduct(product)}><div><img src={product.image} alt={product.name} />{product.tag&&<span>{product.tag}</span>}</div><small>{product.category} · {product.stock} available</small><strong>{product.name}</strong><b>{money(product.price)}</b></button>)}</div></section></div>
}

function ProductCard({ product, liked, toggleLike, openProduct, addToCart }) {
  return <article className="product-v2"><div className="product-photo" onClick={() => openProduct(product)}><img src={product.image} alt={product.name} />{product.tag && <span>{product.tag}</span>}<button className={liked ? 'liked' : ''} onClick={e => { e.stopPropagation(); toggleLike(product.id) }}><Heart fill={liked ? 'currentColor' : 'none'} /></button></div><div className="product-body"><div><span>{product.category}</span><small><Star fill="currentColor" /> {product.rating}</small></div><h3 onClick={() => openProduct(product)}>{product.name}</h3><p><i className={product.stock < 8 ? 'low' : ''} /> {product.stock} available · {product.code}</p>{product.freeDelivery===false&&<span className="free-shipping-note has-charge"><Truck /> {deliveryLabel(product)}</span>}<footer><strong>{money(customerProductPrice(product))}</strong><button onClick={() => addToCart(product)}><ShoppingCart /> Add</button></footer></div></article>
}

function ProductsPage({ products, globalQuery, setGlobalQuery, favourites, setFavourites, openProduct, addToCart }) {
  const [category, setCategory] = useState('All products'); const [sort, setSort] = useState('Featured')
  const categories = ['All products', ...new Set(products.map(p => p.category))]
  const visible = useMemo(() => {
    let list = products.filter(p => (category === 'All products' || p.category === category) && `${p.name} ${p.code}`.toLowerCase().includes(globalQuery.toLowerCase()))
    if (sort === 'Price: low to high') list = [...list].sort((a,b) => a.price-b.price)
    if (sort === 'Price: high to low') list = [...list].sort((a,b) => b.price-a.price)
    if (sort === 'Stock availability') list = [...list].sort((a,b) => b.stock-a.stock)
    return list
  }, [products, category, sort, globalQuery])
  const toggleLike = id => setFavourites(old => old.includes(id) ? old.filter(x => x !== id) : [...old,id])
  return <div className="content-page"><PageTitle eyebrow="CAMY 2026 COLLECTION" title="Products your customers will love" text="Live stock, clear details, and a customer order in a few easy steps."><a className="btn secondary" href="https://heyzine.com/flip-book/6302349cfd.html#page/21" target="_blank" rel="noreferrer"><FileText /> View catalogue</a></PageTitle><div className="catalog-controls"><label><Search /><input value={globalQuery} onChange={e => setGlobalQuery(e.target.value)} placeholder="Search product or model number" /></label><div>{categories.map(c => <button key={c} className={category===c?'active':''} onClick={() => setCategory(c)}>{c}</button>)}</div><select value={sort} onChange={e => setSort(e.target.value)}><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option><option>Stock availability</option></select></div><div className="result-line"><span><strong>{visible.length}</strong> products found</span><span><BadgeCheck /> Stock updated now</span></div><div className="product-grid-v2">{visible.map(p => <ProductCard key={p.id} product={p} liked={favourites.includes(p.id)} toggleLike={toggleLike} openProduct={openProduct} addToCart={addToCart} />)}</div>{visible.length===0 && <Empty icon={Search} title="No products found" text="Try a different search or category." />}</div>
}

function LegacyOrdersPage({ orders, setOrders, openOrder, setPage }) {
  const [filter, setFilter] = useState('All'); const filters = ['All','Processing','Dispatched','Delivered','Returned']
  const visible = filter==='All' ? orders : orders.filter(o => o.status===filter)
  return <div className="content-page"><PageTitle eyebrow="ORDER CENTRE" title="Every order, clearly tracked" text="Follow each customer delivery from placement to completion."><Button icon={Plus} onClick={() => setPage('products')}>Create new order</Button></PageTitle><section className="mini-stat-row">{[['All orders',orders.length,ReceiptText],['In progress',orders.filter(o=>!['Delivered','Returned'].includes(o.status)).length,Truck],['Delivered',orders.filter(o=>o.status==='Delivered').length,Check],['Returned',orders.filter(o=>o.status==='Returned').length,PackageOpen]].map(([label,value,Icon]) => <article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section><article className="card table-card"><div className="table-toolbar"><div>{filters.map(f => <button className={filter===f?'active':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div><Button variant="soft" icon={Download} onClick={() => exportReport('camy-my-orders.xlsx', orders)}>Export orders</Button></div><OrderTable orders={visible} onOpen={openOrder} /></article></div>
}

function OrdersPage({ orders, openOrder, setPage, initialFilter = 'All' }) {
  const [filter,setFilter]=useState(initialFilter), [search,setSearch]=useState(''), [fromDate,setFromDate]=useState(''), [toDate,setToDate]=useState(''), [sort,setSort]=useState('Newest first'), [dateRange,setDateRangeState]=useState('all')
  const filters=['All','Active','Processing','Dispatched','Delivered','Returned']
  const active=orders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status)), delivered=orders.filter(order=>order.status==='Delivered'), returned=orders.filter(order=>order.status==='Returned')
  const processing=orders.filter(order=>order.status==='Processing'), dispatched=orders.filter(order=>order.status==='Dispatched')
  const revenue=orders.filter(order=>!['Returned','Cancelled'].includes(order.status)).reduce((sum,order)=>sum+Number(order.amount||0),0)
  const visible=useMemo(()=>{const list=orders.filter(order=>(filter==='All'||filter==='Active'&&!['Delivered','Returned','Rejected','Cancelled'].includes(order.status)||order.status===filter)&&(!fromDate||order.date>=fromDate)&&(!toDate||order.date<=toDate)&&`${order.id} ${order.customer} ${order.phone} ${order.product}`.toLowerCase().includes(search.toLowerCase()));return [...list].sort((a,b)=>sort==='Oldest first'?String(a.date).localeCompare(String(b.date)):sort==='Highest value'?Number(b.amount)-Number(a.amount):String(b.date).localeCompare(String(a.date)))},[orders,filter,search,fromDate,toDate,sort])
  const clear=()=>{setFilter('All');setSearch('');setFromDate('');setToDate('');setSort('Newest first');setDateRangeState('all')}
  const setDateRange=range=>{setDateRangeState(range);const today=new Date(), iso=date=>date.toISOString().slice(0,10);if(range==='all'){setFromDate('');setToDate('');return}const end=iso(today);const start=new Date(today);if(range==='week')start.setDate(start.getDate()-6);if(range==='month')start.setDate(1);setFromDate(range==='today'?end:iso(start));setToDate(end)}
  const exportLabel=fromDate||toDate?`${fromDate||'Start'} to ${toDate||'Today'}`:'All dates'
  const exportFile=`camy-orders-${fromDate||'all'}-${toDate||'dates'}.xlsx`
  const summaries=[['All',orders.length,ReceiptText],['Active',active.length,Truck],['Processing',processing.length,CalendarDays],['Dispatched',dispatched.length,PackageOpen],['Delivered',delivered.length,PackageCheck],['Returned',returned.length,ReceiptText]]
  return <div className="content-page orders-page-v2">
    <PageTitle eyebrow="DROP-SHIPPING ORDERS" title="Customer orders and earnings" text="Track your customer orders, delivery progress, and commission from one clear workspace."><Button className="new-order-gold" icon={Plus} onClick={()=>setPage('products')}>New order</Button></PageTitle>
    <article className="card order-workspace order-filter-workspace">
      <header className="orders-workspace-head"><div><span>ORDER DIRECTORY</span><h2>Find and manage orders</h2><p>Use the search and filters below to quickly find any customer order.</p></div><button type="button" className="clear-order-filters" onClick={clear}>Reset all filters</button></header>
      <section className="orders-date-export"><div className="orders-filter-selects"><label className="order-select-field"><span>Status</span><select aria-label="Order status" value={filter} onChange={event=>setFilter(event.target.value)}>{filters.map(status=><option key={status}>{status}</option>)}</select></label><label className="order-select-field"><span>Sort by</span><select aria-label="Order sorting" value={sort} onChange={event=>setSort(event.target.value)}><option>Newest first</option><option>Oldest first</option><option>Highest value</option></select></label></div><div className="orders-date-group"><span className="control-caption">Date range</span><div className="date-quick-filters">{[['all','All dates'],['today','Today'],['week','Last 7 days'],['month','This month']].map(([value,label])=><button type="button" className={dateRange===value?'active':''} key={value} onClick={()=>setDateRange(value)}>{label}</button>)}</div></div><div className="order-date-fields"><label><span>From</span><input type="date" value={fromDate} onChange={event=>{setDateRangeState('custom');setFromDate(event.target.value)}}/></label><label><span>To</span><input type="date" min={fromDate} value={toDate} onChange={event=>{setDateRangeState('custom');setToDate(event.target.value)}}/></label></div><div className="orders-export-action"><span><FileSpreadsheet/></span><div><strong>Export current view</strong><small>{exportLabel} · {visible.length} orders</small></div><Button variant="excel" icon={FileSpreadsheet} disabled={!visible.length} onClick={()=>exportReport(exportFile,visible)}>Export Excel</Button></div></section>
    </article>
    <section className="orders-summary-strip" aria-label="Order status summary">{summaries.map(([label,count,Icon])=><button type="button" className={filter===label?'active':''} aria-pressed={filter===label} key={label} onClick={()=>setFilter(label)}><span><Icon/></span><div><small>{label}</small><strong>{count}</strong></div></button>)}</section>
    <article className="card order-workspace order-results-workspace">
      <div className="order-result-bar"><span><strong>{visible.length}</strong> of {orders.length} order{orders.length===1?'':'s'} shown</span><small>{active.length} active · {money(revenue)} order value</small></div>
      {visible.length?<OrderTable orders={visible} onOpen={openOrder}/>:<Empty icon={PackageSearch} title="No matching orders" text="Try a different status, date range, customer name, or product."/>}
    </article>
  </div>
}

function LegacyOrderTable({ orders, onOpen, admin = false, updateStatus }) {
  return <div className={`data-table order-table ${admin ? 'admin-order-table' : ''}`}><div className="data-row head"><span>Order</span>{admin && <span>Entrepreneur</span>}<span>Customer & item</span><span>Date</span><span>Amount</span><span>Status</span><span>View</span></div>{orders.map(o => <div className="data-row" key={o.id}><span><strong>{o.id}</strong><small>{o.phone}</small></span>{admin && <span><strong>{o.entrepreneur}</strong></span>}<span><strong>{o.customer}</strong><small>{o.product} × {o.qty}</small></span><span>{displayDate(o.date)}</span><span><strong>{money(o.amount)}</strong></span><span>{admin ? <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)}><option>Processing</option><option>Dispatched</option><option>Delivered</option><option>Returned</option></select> : <Status value={o.status} />}</span><button className="view-order-btn" onClick={()=>onOpen(o)} aria-label={`View ${o.id} details`}><PackageSearch /><span>View</span></button></div>)}</div>
}

function LegacyOrderTableV2({ orders, onOpen, admin=false, updateStatus }) {
  const steps=['Processing','Dispatched','Delivered'];
  return <div className={`data-table order-table ${admin?'admin-order-table':''}`}><div className="data-row head"><span>Order</span>{admin&&<span>Entrepreneur</span>}<span>Customer & product</span><span>Placed</span><span>Value</span><span>Progress</span><span>Details</span></div>{orders.map(order=>{const step=steps.indexOf(order.status);const days=Math.max(0,Math.floor((Date.now()-new Date(order.date).getTime())/86400000));return <div className={`data-row order-row status-${order.status.toLowerCase()}`} key={order.id}><span className="order-id-cell"><i><PackageOpen/></i><span><strong>{order.id}</strong><small>{order.source||'Online order'}</small></span></span>{admin&&<span><strong>{order.entrepreneur}</strong><small>CAMY entrepreneur</small></span>}<span className="order-customer-cell"><strong>{order.customer}</strong><small>{order.product} × {order.qty}</small><em><Phone/> {order.phone}</em></span><span><strong>{displayDate(order.date)}</strong><small>{days===0?'Today':`${days} day${days===1?'':'s'} ago`}</small></span><span><strong>{money(order.amount)}</strong><small>{Number(order.qty||0)} unit{Number(order.qty||0)===1?'':'s'}</small></span><span>{admin?<select value={order.status} onChange={event=>updateStatus(order.id,event.target.value)}><option>Pending</option><option>Awaiting payment</option><option>Payment review</option><option>Rejected</option><option>Processing</option><option>Dispatched</option><option>Delivered</option><option disabled={!!order.return}>Returned</option></select>:<div className="compact-progress"><Status value={order.status}/>{order.status!=='Returned'&&<div>{steps.map((item,index)=><i className={step>=index?'done':''} key={item}/>)}</div>}</div>}{order.return&&<small className="return-table-status">Return {order.return.status}{order.return.refundStatus?` · ${order.return.refundStatus}`:''}</small>}</span><button className="view-order-btn" onClick={()=>onOpen(order)} aria-label={`View ${order.id} details`}><PackageSearch/><span>View order</span></button></div>})}</div>
}

function OldGrowthOverview({ entrepreneurs }) {
  const leaders = [...entrepreneurs].sort((a,b)=>b.sales-a.sales)
  return <div className="content-page"><PageTitle eyebrow="PERFORMANCE" title="Your momentum is building" text="Understand the habits moving your CAMY business forward."><Button variant="secondary" icon={Download} onClick={() => exportReport('camy-growth-report.xlsx', leaders)}>Download report</Button></PageTitle><section className="rank-hero"><div><span><Trophy /> ISLAND-WIDE LEADERBOARD</span><h2>You climbed <em>3 places</em> this month</h2><p>You’re now among the top 8% of CAMY entrepreneurs.</p></div><div><small>YOUR RANK</small><strong>#3</strong><span><TrendingUp /> Top 8%</span></div></section><section className="dashboard-grid"><article className="card chart-card"><div className="card-head"><div><span>12-MONTH SALES</span><h2>Rs. 1.24M <small>total sales</small></h2></div><b className="positive">+28.4%</b></div><SalesBars values={[32,44,39,58,51,63,72,67,79,74,88,96]} labels={['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep']} /></article><article className="card leaderboard"><div className="card-head"><div><span>TOP PERFORMERS</span><h2>Leaderboard</h2></div></div>{leaders.map((p,i)=><div className={p.name==='Supun Kumara'?'me':''} key={p.id}><b>{i+1}</b><i>{p.initials}</i><span><strong>{p.name}{p.name==='Supun Kumara'&&<em>YOU</em>}</strong><small>{p.city}</small></span><strong>{shortMoney(p.sales)}</strong></div>)}</article></section><section className="achievement-row">{[[Gift,'47 days','Selling streak'],[UsersRound,'114','Happy customers'],[Star,'Cookware','Best category'],[Target,'82%','Monthly target']].map(([Icon,value,label])=><article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section></div>
}

function LegacyGrowthPage({ entrepreneurs, person, orders }) {
  const leaders=[...entrepreneurs].sort((a,b)=>b.sales-a.sales);const rank=Math.max(1,leaders.findIndex(item=>item.id===person?.id)+1);const delivered=orders.filter(order=>order.status==='Delivered');const customers=new Set(orders.map(order=>order.phone)).size;const bestProduct=Object.entries(orders.reduce((map,order)=>({...map,[order.product]:(map[order.product]||0)+Number(order.qty||0)}),{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Start selling';const sales=Number(person?.sales||0);const target=Math.ceil((sales+1)/100000)*100000;const progress=Math.min(100,sales/target*100)
  return <div className="content-page"><PageTitle eyebrow="MY PERFORMANCE" title="Your business growth, clearly measured" text="Live ranking, customer activity, delivery results, and your next target."><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-my-growth.xlsx',orders)}>Download my report</Button></PageTitle><section className="rank-hero"><div><span><Trophy /> CAMY ENTREPRENEUR LEADERBOARD</span><h2>You are currently <em>#{rank}</em></h2><p>{rank===1?'You are leading the CAMY entrepreneur network.':`${rank-1} entrepreneur${rank>2?'s are':' is'} currently ahead of you.`}</p></div><div><small>YOUR RANK</small><strong>#{rank}</strong><span><TrendingUp /> {leaders.length?`Top ${Math.max(1,Math.round(rank/leaders.length*100))}%`:'Getting started'}</span></div></section><section className="achievement-row">{[[CircleDollarSign,money(sales),'Lifetime sales'],[UsersRound,customers,'Customers served'],[PackageCheck,delivered.length,'Orders delivered'],[Star,bestProduct,'Best-selling item']].map(([Icon,value,label])=><article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section><section className="dashboard-grid"><article className="card growth-target-card"><div className="card-head"><div><span>NEXT SALES TARGET</span><h2>{money(target)}</h2></div><b className="positive">{Math.round(progress)}%</b></div><div className="growth-progress"><i style={{width:`${progress}%`}} /></div><p><strong>{money(Math.max(0,target-sales))}</strong> remaining to reach your next Rs. 100,000 milestone.</p></article><article className="card leaderboard"><div className="card-head"><div><span>LIVE NETWORK</span><h2>Top performers</h2></div></div>{leaders.slice(0,6).map((item,index)=><div className={item.id===person?.id?'me':''} key={item.id}><b>{index+1}</b><i>{item.initials}</i><span><strong>{item.name}{item.id===person?.id&&<em>YOU</em>}</strong><small>{item.city}</small></span><strong>{shortMoney(item.sales)}</strong></div>)}</article></section></div>
}

function LegacyGrowthPageV3({ entrepreneurs, person, orders, tiers=initialTiers }) {
  const delivered=orders.filter(order=>order.status==='Delivered'); const returned=orders.filter(order=>order.status==='Returned'); const active=orders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status)); const verifiedSales=delivered.reduce((sum,order)=>sum+((order.items||[]).reduce((total,item)=>total+Number(item.price||0)*Number(item.qty||0),0)||Number(order.amount||0)),0); const sales=Math.max(Number(person?.sales||0),verifiedSales); const current={...(person||{}),id:person?.id||'CE-0194',name:person?.name||'CAMY Entrepreneur',initials:person?.initials||'CE',city:person?.city||'Sri Lanka',sales}; const network=entrepreneurs.some(item=>item.id===current.id)?entrepreneurs.map(item=>item.id===current.id?{...item,sales}:item):[...entrepreneurs,current]; const leaders=[...network].filter(item=>item.stage!=='Departed').sort((a,b)=>Number(b.sales||0)-Number(a.sales||0)); const rank=leaders.findIndex(item=>item.id===current.id)+1; const customers=new Set(orders.map(order=>order.phone||order.customer)).size; const success=delivered.length+returned.length?delivered.length/(delivered.length+returned.length)*100:100; const bestProduct=Object.entries(delivered.reduce((map,order)=>({...map,[order.product]:(map[order.product]||0)+Number(order.qty||0)}),{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'No delivered sales yet'; const tierProgress=creditProgression(tiers,sales); const nextTier=tierProgress.next; const progress=tierProgress.progress; const gap=tierProgress.remaining; const monthKeys=Array.from({length:6},(_,index)=>{const date=new Date();date.setMonth(date.getMonth()-(5-index));return date.toISOString().slice(0,7)}); const monthValues=monthKeys.map(key=>delivered.filter(order=>String(order.date).startsWith(key)).reduce((sum,order)=>sum+Number(order.camyCost??order.amount??0),0)); const maxMonth=Math.max(...monthValues,1); const monthLabels=monthKeys.map(key=>new Intl.DateTimeFormat('en-LK',{month:'short'}).format(new Date(`${key}-01`)))
  return <div className="content-page growth-page-v2"><PageTitle eyebrow="MY GROWTH" title="Turn every sale into momentum" text="Your live CAMY performance, customer reach, delivery quality, ranking, and next credit opportunity."><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-my-growth.xlsx',orders)}>Download growth report</Button></PageTitle><section className="growth-rank-hero"><div><span><Trophy/> CAMY NETWORK RANKING</span><h2>{rank===1?'You are leading the network':<>You are ranked <em>#{rank||'—'}</em></>}</h2><p>{rank===1?'Outstanding work—keep building repeat customers to protect your lead.':rank>1?`${rank-1} entrepreneur${rank===2?' is':'s are'} ahead. Your next sales target can move you higher.`:'Complete your first verified sale to enter the leaderboard.'}</p><div className="growth-hero-tags"><b><TrendingUp/> {money(sales)} lifetime sales</b><b><UsersRound/> {customers} customers</b></div></div><aside><small>YOUR POSITION</small><strong>{rank?`#${rank}`:'—'}</strong><span>{leaders.length?`Top ${Math.max(1,Math.round(rank/leaders.length*100))}% of ${leaders.length}`:'Building profile'}</span><div><i style={{width:`${leaders.length?Math.max(8,100-rank/leaders.length*100+100/leaders.length):8}%`}}/></div></aside></section><section className="growth-kpis">{[[CircleDollarSign,money(sales),'Verified lifetime sales','sales'],[UsersRound,customers,'Unique customers served','customers'],[PackageCheck,delivered.length,`${success.toFixed(0)}% delivery success`,'delivery'],[Star,bestProduct,'Best-selling product','product']].map(([Icon,value,label,tone])=><article className={`card ${tone}`} key={label}><span><Icon/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section><section className="growth-main-grid"><article className="card growth-sales-chart"><div className="card-head"><div><span>SALES TREND</span><h2>Last six months</h2></div><b>{money(monthValues.reduce((sum,value)=>sum+value,0))}</b></div><div className="growth-chart-v2">{monthValues.map((value,index)=><div key={monthKeys[index]}><span><i style={{height:`${Math.max(value?12:3,value/maxMonth*100)}%`}}><em>{money(value)}</em></i></span><small>{monthLabels[index]}</small></div>)}</div></article><article className="card growth-target-v2"><div className="card-head"><div><span>NEXT MILESTONE</span><h2>{nextTier?`${money(nextTier.credit)} credit tier`:'Top tier achieved'}</h2></div><b>{Math.round(progress)}%</b></div><div className="target-ring" style={{'--progress':`${progress*3.6}deg`}}><span><strong>{Math.round(progress)}%</strong><small>complete</small></span></div><p>{nextTier?<><strong>{money(gap)}</strong> more verified sales to reach {money(nextTier.sales)}.</>:<>You have unlocked every configured sales-to-credit milestone.</>}</p></article></section><section className="growth-lower-grid"><article className="card performance-score"><div className="card-head"><div><span>BUSINESS HEALTH</span><h2>Performance signals</h2></div></div><div><label><span>Delivery success <b>{success.toFixed(0)}%</b></span><i><em style={{width:`${success}%`}}/></i></label><label><span>Order completion <b>{orders.length?Math.round((delivered.length+returned.length)/orders.length*100):0}%</b></span><i><em style={{width:`${orders.length?(delivered.length+returned.length)/orders.length*100:0}%`}}/></i></label><label><span>Tier progress <b>{Math.round(progress)}%</b></span><i><em style={{width:`${progress}%`}}/></i></label></div><footer><BadgeCheck/><p><strong>{active.length} active order{active.length===1?'':'s'}</strong><small>Keep customers updated until delivery is completed.</small></p></footer></article><article className="card leaderboard growth-leaderboard"><div className="card-head"><div><span>LIVE NETWORK</span><h2>Top performers</h2></div><b>{leaders.length} active</b></div>{leaders.slice(0,6).map((item,index)=><div className={item.id===current.id?'me':''} key={item.id}><b>{index+1}</b><i>{item.initials}</i><span><strong>{item.name}{item.id===current.id&&<em>YOU</em>}</strong><small>{item.city}</small></span><strong>{shortMoney(item.sales)}</strong></div>)}</article></section><section className="growth-insights"><article><span><Target/></span><div><small>NEXT BEST ACTION</small><strong>{nextTier?`Close ${money(gap)} in verified sales`:'Maintain your top-tier performance'}</strong><p>Focus on available best-selling products and customers ready to purchase.</p></div></article><article><span><PackageCheck/></span><div><small>CUSTOMER EXPERIENCE</small><strong>{active.length?`Follow up on ${active.length} active order${active.length===1?'':'s'}`:'All current orders are completed'}</strong><p>Fast updates and successful deliveries improve repeat business.</p></div></article><article><span><UsersRound/></span><div><small>NETWORK GROWTH</small><strong>{customers?`${customers} customer relationships`:'Build your first customer relationship'}</strong><p>Use My Orders to track every customer and their purchase history.</p></div></article></section></div>
}

function GrowthPage({ entrepreneurs, person, orders, tiers=initialTiers }) {
  const delivered=orders.filter(order=>order.status==='Delivered')
  const returned=orders.filter(order=>order.status==='Returned')
  const earnings=delivered.reduce((sum,order)=>sum+Number(order.entrepreneurMargin??Math.max(0,Number(order.amount||0)-Number(order.camyCost??order.amount??0))),0)
  const current={...(person||{}),id:person?.id||'CAMY-MEMBER',name:person?.name||'CAMY Partner',initials:person?.initials||'CP',city:person?.city||'Sri Lanka',sales:Math.max(Number(person?.sales||0),earnings)}
  const network=entrepreneurs.some(item=>item.id===current.id)?entrepreneurs.map(item=>item.id===current.id?current:item):[...entrepreneurs,current]
  const leaders=network.filter(item=>item.stage!=='Departed').sort((a,b)=>Number(b.sales||0)-Number(a.sales||0))
  const topFive=leaders.slice(0,5), rank=Math.max(1,leaders.findIndex(item=>item.id===current.id)+1), leaderValue=Math.max(1,...topFive.map(item=>Number(item.sales||0)))
  const customers=new Set(delivered.map(order=>order.phone||order.customer).filter(Boolean)).size
  const success=delivered.length+returned.length?Math.round(delivered.length/(delivered.length+returned.length)*100):100
  const tierProgress=creditProgression(tiers,current.sales), nextTier=tierProgress.next, currentTier=tierProgress.active, progress=tierProgress.progress, gap=tierProgress.remaining
  const currentTierNumber=currentTier?tierProgress.configured.findIndex(tier=>tier.id===currentTier.id)+1:0
  const firstName=current.name.split(' ')[0]
  return <div className="content-page growth-focus-page">
    <section className="growth-welcome"><div><small>YOUR CAMY PROGRESS</small><h1>{firstName}, here’s how your business is growing.</h1><p>See your total sales, network position and the next milestone worth focusing on.</p></div><Button variant="white" icon={Download} onClick={()=>exportReport('camy-my-growth.xlsx',orders)}>Download your report</Button></section>
    <section className="growth-focus-kpis">
      <article className="earnings"><span><WalletCards/></span><div><small>TOTAL SALES</small><strong>{money(current.sales)}</strong><p>From successfully delivered CAMY orders</p></div></article>
      <article><span><PackageCheck/></span><div><small>DROP-SHIPPING ORDERS</small><strong>{orders.length}</strong><p>{success}% successful delivery rate</p></div></article>
      <article><span><UsersRound/></span><div><small>MY CUSTOMERS</small><strong>{customers}</strong><p>Unique customers successfully served</p></div></article>
      <article className="position"><span><Trophy/></span><div><small>YOUR NETWORK POSITION</small><strong>#{rank}</strong><p>Out of {leaders.length} active CAMY partner{leaders.length===1?'':'s'}</p></div></article>
    </section>
    <section className="growth-focus-grid">
      <article className="growth-top-five">
        <header><div><small>CAMY NETWORK</small><h2>Top five performers</h2><p>Based on total sales from delivered orders.</p></div><span>Your position <strong>#{rank}</strong></span></header>
        <div className="top-five-chart">{topFive.map((item,index)=>{const isMe=item.id===current.id;return <article className={isMe?'me':''} key={item.id}><b>{index+1}</b><i>{item.initials||String(item.name).split(' ').map(word=>word[0]).slice(0,2).join('')}</i><div><span><strong>{item.name}</strong>{isMe&&<em>YOU</em>}<small>{item.city||'CAMY partner'}</small></span><div><i style={{width:`${Math.max(6,Number(item.sales||0)/leaderValue*100)}%`}}/></div></div><strong>{shortMoney(item.sales)}</strong></article>})}</div>
        {!topFive.some(item=>item.id===current.id)&&<footer><span><strong>Your current position</strong><small>{current.name} · {current.city}</small></span><b>#{rank}</b><strong>{shortMoney(current.sales)}</strong></footer>}
      </article>
      <aside className="growth-next-step">
        <header><span><Target/></span><div><small>YOUR NEXT MILESTONE</small><h2>{nextTier?`${money(nextTier.credit)} credit limit`:'Highest tier reached'}</h2></div></header>
        <div className="growth-current-tier"><small>CURRENT TIER</small><strong>{currentTierNumber?`Tier ${currentTierNumber}`:'Not qualified yet'}</strong><span>{currentTier?`${money(currentTier.credit)} credit limit`:'Complete the first sales milestone to unlock a tier'}</span></div>
        <div className="growth-milestone-ring" role="progressbar" aria-label="Progress toward the next credit milestone" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)} style={{'--growth':`${Math.min(100,progress)*3.6}deg`}}><span><strong>{Math.round(progress)}%</strong><small>complete</small></span></div>
        {nextTier?<><p>Earn <strong>{money(gap)}</strong> more from verified sales to reach the {money(nextTier.sales)} milestone.</p><div className="growth-next-bar" role="progressbar" aria-label="Sales progress toward the next credit milestone" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}><i style={{width:`${progress}%`}}/></div><small>{money(current.sales)} earned · {money(nextTier.sales)} target</small></>:<p>You have unlocked every configured CAMY credit milestone. Keep building repeat customers and successful deliveries.</p>}
      </aside>
    </section>
  </div>
}

function LegacyCreditPage({ tiers, settlements, onSettlement, person }) {
  const used=person?.used||0; const credit=person?.credit||0; const outstanding=used; const available=Math.max(0,credit-used)
  return <div className="content-page"><PageTitle eyebrow="CREDIT & SETTLEMENTS" title="Business credit, made simple" text="Live credit, settlement, and performance figures for your CAMY business."><Button icon={Banknote} onClick={onSettlement}>Record settlement</Button></PageTitle><section className="credit-grid"><article className="business-card"><div><Brand inverse /><span>BUSINESS CREDIT</span></div><small>AVAILABLE TO USE</small><h2>{money(available)}</h2><div className="credit-progress"><i style={{width:`${credit?used/credit*100:0}%`}} /></div><section><div><small>CREDIT LIMIT</small><strong>{money(credit)}</strong></div><div><small>CURRENTLY USED</small><strong>{money(used)}</strong></div></section><footer>{person?.name?.toUpperCase()} <BadgeCheck /></footer></article><article className="due-panel"><span><CalendarDays /></span><div><small>NEXT SETTLEMENT</small><h2>{money(Math.min(used,8700))}</h2><p>{used?'Record a payment to reduce your balance.':'No payment is currently due.'}</p></div><b>{used?'Open balance':'Up to date'}</b><Button variant="secondary" disabled={!used} onClick={onSettlement}>Make a settlement <ArrowRight /></Button></article><article className="credit-stats"><div><span>Credit limit</span><strong>{money(credit)}</strong><small>Approved amount</small></div><div><span>Total settled</span><strong>{money(settlements.reduce((s,x)=>s+x.amount,0))}</strong><small>Payments recorded</small></div><div><span>Outstanding</span><strong>{money(outstanding)}</strong><small>Current balance</small></div></article></section><section className="card tier-card"><div className="card-head"><div><span>CREDIT MILESTONES</span><h2>Your tier ladder</h2></div><b className="positive">{person?.stage||'Trial seller'}</b></div><div className="tier-row">{tiers.map((t,i)=><div className={t.sales<=(person?.sales||0)?'done':t.sales>(person?.sales||0)&&!tiers.some(x=>x.sales>(person?.sales||0)&&x.sales<t.sales)?'current':''} key={t.id}><i>{t.sales<=(person?.sales||0)?<Check />:i+1}</i><strong>{shortMoney(t.sales)} sales</strong><small>{shortMoney(t.credit)} credit</small></div>)}</div></section></div>
}

function LegacyProfilePage({ profile, setProfile, joined, notify }) {
  const [editing,setEditing]=useState(false); const [draft,setDraft]=useState(profile)
  const save=()=>{setProfile(draft);setEditing(false);notify('Profile changes saved')}
  const updatePhoto=event=>readImageFile(event,(key,value)=>setDraft(old=>({...old,[key]:value})))
    return <div className="content-page"><PageTitle eyebrow="ACCOUNT" title="My business profile" text="Keep your identity, contact, and settlement details up to date."><Button variant={editing?'primary':'secondary'} icon={editing?Check:Pencil} onClick={editing?save:()=>setEditing(true)}>{editing?'Save changes':'Edit profile'}</Button></PageTitle><section className="profile-layout"><article className="profile-summary"><div className="profile-cover"><div className="profile-avatar">{draft.image ? <img src={draft.image} alt={draft.name} /> : <span style={{ display: 'grid' }}>SK</span>}{editing&&<label className="profile-photo-action" title="Change profile photo"><Pencil /><input type="file" accept="image/*" onChange={updatePhoto} /></label>}</div></div><h2>{draft.name} <BadgeCheck /></h2><p>CAMY Entrepreneur · CE-0194</p><small className="profile-joined"><CalendarDays /> Joined {joined ? displayDate(joined) : 'Date unavailable'}</small><b><TrendingUp /> Credit eligible</b><div><span><strong>47</strong><small>Days active</small></span><span><strong>114</strong><small>Customers</small></span><span><strong>#3</strong><small>Current rank</small></span></div><Button variant="soft" icon={Headphones} onClick={()=>notify('CAMY Support: +94 77 755 4477')}>Contact support</Button></article><div className="form-stack"><ProfileForm title="Personal details" icon={UserRound} editing={editing} draft={draft} setDraft={setDraft} fields={[['name','Full name'],['nic','NIC number'],['phone','Contact number'],['email','Email address'],['address','Home address']]} /><ProfileForm title="Bank account" icon={CreditCard} editing={editing} draft={draft} setDraft={setDraft} fields={[['bank','Bank'],['branch','Branch'],['accountName','Account holder'],['account','Account number']]} secure /></div></section></div>
}

function LegacyCreditPageV2({ tiers, settlements, onSettlement, person, orders=[] }) {
  const sales=Number(person?.sales||0)
  const tierProgress=creditProgression(tiers,sales)
  const ordered=visibleCreditLadder(tiers,sales)
  const credit=tierProgress.credit
  const used=Number(person?.used||0)
  const available=Math.max(0,credit-used)
  const usage=credit?Math.min(100,Math.round(used/credit*100)):0
  const next=tierProgress.next
  const achieved=tierProgress.active
  const gap=tierProgress.remaining
  const totalSettled=settlements.filter(item=>item.status==='Verified').reduce((sum,item)=>sum+Number(item.amount||0),0)
  const dropshipOrders=orders.filter(order=>order.orderMode==='dropship')
  const paidPayouts=dropshipOrders.filter(order=>order.payoutStatus==='paid')
  const pendingPayouts=dropshipOrders.filter(order=>order.payoutStatus==='pending_transfer')
  const paidMargin=paidPayouts.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const pendingMargin=pendingPayouts.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const phase=credit>0?'Phase 2 · Credit-based stock':'Phase 1 · Trial drop-shipping'
  return <div className="content-page credit-page-v2">
    <PageTitle eyebrow="CREDIT, EARNINGS & SETTLEMENTS" title="Your CAMY money centre" text="Track client-order earnings, CAMY transfers, credit eligibility and any credit you need to settle."><Button icon={Banknote} disabled={!used} onClick={onSettlement}>{used?'Record credit settlement':'No credit balance due'}</Button></PageTitle>
    {!person&&<article className="card credit-alert"><WalletCards/><div><strong>Entrepreneur account could not be matched</strong><p>Open My profile and save your correct registered name or contact CAMY Admin.</p></div></article>}
    <section className="phase-banner card"><div><span>CURRENT PROGRAM STAGE</span><h2>{phase}</h2><p>{credit>0?'You are credit eligible. Drop-shipping remains available, and you can optionally request CAMY stock on credit when it suits your business.':next?`Your trial stage completes when you reach the first configured credit milestone. You need ${money(gap)} more verified CAMY product sales.`:'CAMY Admin has not configured a credit milestone yet.'}</p></div><BadgeCheck/></section>
    <section className="credit-overview-v2"><article className="business-card credit-wallet"><header><div><Brand inverse/><span>CAMY BUSINESS CREDIT</span></div><b>{person?.stage||'Account review'}</b></header><small>AVAILABLE CREDIT</small><h2>{money(available)}</h2><div className="credit-progress"><i style={{width:`${usage}%`}}/></div><div className="credit-usage-label"><span>{usage}% used</span><span>{money(used)} of {money(credit)}</span></div><section><div><small>APPROVED LIMIT</small><strong>{money(credit)}</strong></div><div><small>AVAILABLE NOW</small><strong>{money(available)}</strong></div></section><footer>{person?.name?.toUpperCase()||'CAMY ENTREPRENEUR'} <BadgeCheck/></footer></article><div className="credit-side-stack"><article className={`due-panel ${used?'has-balance':'is-clear'}`}><span><CalendarDays/></span><div><small>{used?'PAYMENT REQUIRED':'ACCOUNT STATUS'}</small><h2>{used?money(used):'All clear'}</h2><p>{used?'Make a full or partial credit settlement. Your available credit updates after CAMY verifies the payment.':'You have no outstanding CAMY credit balance.'}</p></div><b>{used?'Outstanding':'Up to date'}</b><Button variant="secondary" disabled={!used} onClick={onSettlement}>{used?'Make a settlement':'Nothing due'} <ArrowRight/></Button></article><section className="credit-stats"><div><span>Credit limit</span><strong>{money(credit)}</strong><small>Approved amount</small></div><div><span>Total settled</span><strong>{money(totalSettled)}</strong><small>{settlements.length} credit payment{settlements.length===1?'':'s'}</small></div><div><span>Outstanding</span><strong className={used?'danger':''}>{money(used)}</strong><small>Credit balance</small></div></section></div></section>
    <section className="earnings-overview"><article><small>CAMY TRANSFERRED TO YOU</small><strong>{money(paidMargin)}</strong><p>Entrepreneur margins with recorded transfer receipts</p></article><article><small>WAITING FOR CAMY TRANSFER</small><strong>{money(pendingMargin)}</strong><p>Delivered orders where your margin is still pending</p></article><article><small>PAYOUTS COMPLETED</small><strong>{paidPayouts.length}</strong><p>Successful entrepreneur bank transfers</p></article></section>
    <section className="credit-progress-card card"><div className="card-head"><div><span>YOUR NEXT OPPORTUNITY</span><h2>{next?`Unlock ${money(next.credit)} credit`:'Credit ladder not configured'}</h2></div><b className="positive">{achieved?`${shortMoney(achieved.sales)} tier`:'Building eligibility'}</b></div><p>{next?<><strong>{money(gap)}</strong> more verified CAMY product sales are required to reach the next tier.</>:<>Ask CAMY Admin to configure the sales-to-credit ladder.</>}</p><div className="growth-progress"><i style={{width:`${tierProgress.progress}%`}}/></div><div className="credit-progress-label"><span>Verified CAMY sales: <strong>{money(sales)}</strong></span><span>{next?`Target: ${money(next.sales)}`:'No target configured'}</span></div></section>
    <section className="card payout-history"><div className="card-head"><div><span>ENTREPRENEUR EARNINGS</span><h2>CAMY margin transfers</h2></div><b>{dropshipOrders.filter(order=>['paid','pending_transfer'].includes(order.payoutStatus)).length} payout records</b></div>{dropshipOrders.filter(order=>['paid','pending_transfer','reversal_required'].includes(order.payoutStatus)).length?<div>{dropshipOrders.filter(order=>['paid','pending_transfer','reversal_required'].includes(order.payoutStatus)).sort((a,b)=>String(b.payoutPaidAt||b.deliveredAt||b.createdAt).localeCompare(String(a.payoutPaidAt||a.deliveredAt||a.createdAt))).map(order=><article key={order.id}><span><Banknote/></span><div><strong>{money(order.entrepreneurMargin)}</strong><small>{order.id} · Client {money(order.amount)} · CAMY {money(order.camyCost??order.amount)}</small></div><time>{displayDate(order.payoutPaidAt||order.deliveredAt)}</time><div className="payout-history-actions"><Status value={order.payoutStatus==='paid'?'Paid':order.payoutStatus==='reversal_required'?'Review required':'Pending transfer'}/>{order.payoutReceipt&&<a href={order.payoutReceipt} target="_blank" rel="noreferrer">Receipt</a>}</div></article>)}</div>:<Empty icon={ReceiptText} title="No entrepreneur payouts yet" text="After a client order is delivered, CAMY will transfer your margin and the receipt will appear here."/>}</section>
    <section className="card tier-card"><div className="card-head"><div><span>CREDIT MILESTONES</span><h2>Sales-to-credit ladder</h2></div><small>Only tiers saved by CAMY Admin are used</small></div><div className="tier-row">{ordered.map((tier,index)=><div className={Number(tier.sales)<=sales?'done':Number(tier.sales)===Number(next?.sales)?'current':''} key={`${tier.id}-${tier.sales}`}><i>{Number(tier.sales)<=sales?<Check/>:index+1}</i><strong>{shortMoney(tier.sales)} CAMY sales</strong><small>{shortMoney(tier.credit)} credit</small></div>)}</div></section>
    <section className="card settlement-history"><div className="card-head"><div><span>CREDIT PAYMENT HISTORY</span><h2>My credit settlements</h2></div><b>{settlements.length} records</b></div>{settlements.length?<div>{settlements.map(item=><article key={item.id}><span><Banknote/></span><div><strong>{money(item.amount)}</strong><small>{item.reference||'No reference supplied'}</small></div><time>{displayDate(item.date||item.createdAt)}</time><Status value={item.status==='Verified'?'Paid':item.status||'Pending'}/></article>)}</div>:<Empty icon={ReceiptText} title="No credit settlements recorded" text="Credit repayments you submit will appear here after your credit stage begins."/>}</section>
  </div>
}

function CreditPage({ tiers, settlements, onSettlement, person, orders=[], openCommissions, openRepayments }) {
  const [payoutFilter,setPayoutFilter]=useState('All'), [repaymentFilter,setRepaymentFilter]=useState('All'), [historyFrom,setHistoryFrom]=useState(''), [historyTo,setHistoryTo]=useState('')
  const sales=Number(person?.sales||0), progression=creditProgression(tiers,sales), credit=progression.credit
  const outstanding=Math.max(0,Number(person?.used||0)), available=Math.max(0,credit-outstanding), utilization=credit?Math.min(100,outstanding/credit*100):0
  const dropshipOrders=orders.filter(order=>order.orderMode==='dropship')
  const paidOrders=dropshipOrders.filter(order=>order.payoutStatus==='paid'), pendingOrders=dropshipOrders.filter(order=>order.payoutStatus==='pending_transfer')
  const earned=dropshipOrders.filter(order=>order.status==='Delivered').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const transferred=paidOrders.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0), waiting=pendingOrders.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const verifiedSettlements=settlements.filter(item=>item.status==='Verified'), pendingSettlements=settlements.filter(item=>item.status!=='Verified')
  const currentThreshold=progression.active?.sales||0, next=progression.next, intervalProgress=progression.progress
  const payoutRows=dropshipOrders.filter(order=>['paid','pending_transfer','reversal_required'].includes(order.payoutStatus)).filter(order=>(payoutFilter==='All'||(payoutFilter==='Paid'?order.payoutStatus==='paid':payoutFilter==='Waiting'?order.payoutStatus==='pending_transfer':order.payoutStatus==='reversal_required'))&&(!historyFrom||String(order.payoutPaidAt||order.deliveredAt||order.date).slice(0,10)>=historyFrom)&&(!historyTo||String(order.payoutPaidAt||order.deliveredAt||order.date).slice(0,10)<=historyTo)).sort((a,b)=>String(b.payoutPaidAt||b.deliveredAt||b.createdAt).localeCompare(String(a.payoutPaidAt||a.deliveredAt||a.createdAt)))
  const repaymentRows=[...settlements].filter(item=>(repaymentFilter==='All'||(repaymentFilter==='Verified'?item.status==='Verified':item.status!=='Verified'))&&(!historyFrom||String(item.createdAt||item.date).slice(0,10)>=historyFrom)&&(!historyTo||String(item.createdAt||item.date).slice(0,10)<=historyTo)).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))
  const firstName=person?.name?.split(' ')[0]||'Partner'
  return <div className="content-page money-centre-page">
    <section className="money-welcome"><div><small>YOUR MONEY CENTRE</small><h1>{firstName}, your earnings and credit in one place.</h1><p>CAMY records every commission transfer and verifies every credit repayment.</p></div>{outstanding>0?<Button icon={Banknote} onClick={onSettlement}>Pay credit balance</Button>:<span><BadgeCheck/> Credit account up to date</span>}</section>
    {!person&&<article className="card credit-alert"><WalletCards/><div><strong>Your CAMY profile could not be matched</strong><p>Contact CAMY support before making a payment.</p></div></article>}
    <section className="money-summary-grid">
      <article className="clickable" role="button" tabIndex="0" onClick={openCommissions} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCommissions()}}}><span><CircleDollarSign/></span><div><small>TOTAL PROFIT</small><strong>{money(earned)}</strong><p>From delivered orders</p></div></article>
      <article className="paid clickable" role="button" tabIndex="0" onClick={openCommissions} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCommissions()}}}><span><BadgeCheck/></span><div><small>RECEIVED</small><strong>{money(transferred)}</strong><p>{paidOrders.length} payment{paidOrders.length===1?'':'s'} received</p></div></article>
      <article className="waiting clickable" role="button" tabIndex="0" onClick={openCommissions} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCommissions()}}}><span><CalendarDays/></span><div><small>PROFIT PENDING</small><strong>{money(waiting)}</strong><p>{pendingOrders.length} payment{pendingOrders.length===1?'':'s'} waiting</p></div></article>
      <article className={`${outstanding?'due':'clear'} clickable`} role="button" tabIndex="0" onClick={openRepayments} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openRepayments()}}}><span><CreditCard/></span><div><small>NEED TO PAY CAMY</small><strong>{money(outstanding)}</strong><p>{outstanding?'Check each credit order for its payment deadline':'Nothing to pay'}</p></div></article>
    </section>
    <section className="money-credit-grid">
      <article className="credit-balance-card"><header><div><small>MY CREDIT</small><h2>{money(available)} available</h2></div><b>{person?.stage||'Trial stage'}</b></header><div className="credit-balance-bar"><i style={{width:`${utilization}%`}}/></div><div className="credit-balance-labels"><span><small>Credit limit</small><strong>{money(credit)}</strong></span><span><small>Credit used</small><strong>{money(outstanding)}</strong></span><span><small>Credit left</small><strong>{money(available)}</strong></span></div>{outstanding>0&&<footer><CalendarDays/><p><strong>Credit payment needed</strong><small>Pay by bank transfer and upload the receipt, or pay cash at a CAMY store.</small></p><button type="button" onClick={onSettlement}>Pay credit <ArrowRight/></button></footer>}</article>
      <article className="money-next-tier"><header><span><Target/></span><div><small>NEXT CREDIT LEVEL</small><h2>{next?`Get ${money(next.credit)} credit`:'Highest level reached'}</h2></div></header>{next?<><strong>{money(progression.remaining)} more needed</strong><p>Your delivered product selling value is {money(sales)}. Reach {money(next.sales)} for the next credit level.</p><div><i style={{width:`${intervalProgress}%`}}/></div><footer><span>{money(currentThreshold)}</span><b>{Math.round(intervalProgress)}%</b><span>{money(next.sales)}</span></footer></>:<p>You have reached every credit tier configured by CAMY Admin.</p>}</article>
    </section>
    <section className="money-route-grid">
      <button type="button" onClick={openCommissions}><span><Banknote/></span><div><small>YOUR EARNINGS</small><h2>View commission payments</h2><p>Open every order commission, its current payment stage, transfer reference and CAMY receipt.</p><b>{paidOrders.length} paid · {pendingOrders.length} waiting</b></div><ArrowRight/></button>
      <button type="button" onClick={openRepayments}><span><CreditCard/></span><div><small>YOUR CREDIT</small><h2>View credit repayments</h2><p>Review repayment deadlines, submit a bank receipt, and follow CAMY verification.</p><b>{verifiedSettlements.length} verified · {pendingSettlements.length} under review</b></div><ArrowRight/></button>
    </section>
    <section className="money-history-filter"><div><small>FILTER FINANCIAL HISTORY</small><strong>Find a payment by status or date</strong></div><label>From<input type="date" value={historyFrom} onChange={event=>setHistoryFrom(event.target.value)}/></label><label>To<input type="date" min={historyFrom} value={historyTo} onChange={event=>setHistoryTo(event.target.value)}/></label><button type="button" onClick={()=>{setHistoryFrom('');setHistoryTo('');setPayoutFilter('All');setRepaymentFilter('All')}}>Clear filters</button></section>
    <section className="money-register">
      <article className="money-history-panel commission-register"><header><div><small>YOUR EARNINGS</small><h2>CAMY commission payments</h2><p>Every delivered-order commission and CAMY transfer proof.</p></div><div><select value={payoutFilter} onChange={event=>setPayoutFilter(event.target.value)}><option>All</option><option>Paid</option><option>Waiting</option><option>Review</option></select><b>{payoutRows.length} shown</b></div></header>{payoutRows.length?<div>{payoutRows.map(order=><article key={order.id}><div className="money-record-main"><span><Banknote/></span><div><small>YOUR COMMISSION</small><strong>{money(order.entrepreneurMargin)}</strong><p>{order.id}</p></div></div><dl><span><dt>Client paid</dt><dd>{money(order.amount)}</dd></span><span><dt>CAMY value</dt><dd>{money(order.camyCost??order.amount)}</dd></span><span><dt>Delivered</dt><dd>{displayDate(order.deliveredAt||order.date)}</dd></span><span><dt>Transfer reference</dt><dd>{order.payoutReference||'Not recorded yet'}</dd></span><span><dt>Paid date</dt><dd>{order.payoutPaidAt?displayDate(order.payoutPaidAt):'Waiting for CAMY'}</dd></span></dl><div className="money-record-action"><Status value={order.payoutStatus==='paid'?'Paid':order.payoutStatus==='reversal_required'?'Review required':'Waiting for CAMY'}/>{order.payoutReceipt?<a href={order.payoutReceipt} target="_blank" rel="noreferrer"><ReceiptText/> View receipt</a>:<small>{order.payoutStatus==='paid'?'Receipt not attached':'Receipt appears after payment'}</small>}</div></article>)}</div>:<Empty icon={Banknote} title="No matching commissions" text="Change the status or date filters to find another payment."/>}</article>
      <article className="money-history-panel repayment-register"><header><div><small>CREDIT REPAYMENTS</small><h2>Your repayment records</h2><p>Bank receipts and CAMY store cash payments.</p></div><div><select value={repaymentFilter} onChange={event=>setRepaymentFilter(event.target.value)}><option>All</option><option>Verified</option><option>Pending</option></select><b>{repaymentRows.length} shown</b></div></header>{outstanding>0&&<section className="repayment-callout"><CalendarDays/><div><strong>{money(outstanding)} must be repaid</strong><p>Pay the full order value by its tier-based deadline. Transfer to CAMY and upload the receipt, or pay cash at a CAMY store.</p></div><button type="button" onClick={onSettlement}>Make credit payment <ArrowRight/></button></section>}{repaymentRows.length?<div>{repaymentRows.map(item=>{const cash=(item.method||item.paymentMethod)==='cash', verifiedAt=item.verifiedAt||item.reviewedAt;return <article key={item.id}><div className="money-record-main"><span><ReceiptText/></span><div><small>AMOUNT PAID</small><strong>{money(item.amount)}</strong><p>{item.id}</p></div></div><dl><span><dt>Payment method</dt><dd>{cash?'Cash at CAMY store':'Bank transfer'}</dd></span><span><dt>Reference</dt><dd>{item.reference||'Recorded by CAMY'}</dd></span><span><dt>Submitted</dt><dd>{displayDate(item.createdAt||item.date)}</dd></span><span><dt>Verified</dt><dd>{verifiedAt?displayDate(verifiedAt):item.status==='Verified'?'Verified by CAMY':'Waiting for CAMY'}</dd></span></dl><div className="money-record-action"><Status value={item.status==='Verified'?'Verified':item.status||'Pending verification'}/>{item.receipt?<a href={item.receipt} target="_blank" rel="noreferrer"><ReceiptText/> View receipt</a>:<small>{cash?'Cash recorded by CAMY':'Receipt under review'}</small>}</div></article>})}</div>:<Empty icon={ReceiptText} title={outstanding?'No repayment submitted yet':'No credit repayments'} text={outstanding?'Use Make credit payment to submit a bank transfer receipt. CAMY Admin records cash payments.':'Your verified repayment history will appear here when you use credit stock.'}/>}<footer><span><BadgeCheck/> {verifiedSettlements.length} verified</span>{pendingSettlements.length>0&&<span><CalendarDays/> {pendingSettlements.length} awaiting CAMY</span>}</footer></article>
    </section>
  </div>
}

function MoneyPageHeader({ back, eyebrow, title, text, action }) {
  return <header className="money-page-head"><button type="button" onClick={back}>← Money centre</button><div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>{action}</header>
}

function CreditPaymentOrderDetail({ request, settlements=[], close, onPayRequest }) {
  const attempts=settlements.filter(item=>String(item.requestId)===String(request.id)).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))
  const active=attempts.find(item=>item.status!=='Rejected')
  const state=active?.status==='Verified'?'Paid':active?'Under review':attempts.some(item=>item.status==='Rejected')?'Rejected':request.status==='Dispatched'?'Unpaid':'Not due'
  const canChangeCash=active?.status==='Pending verification'&&active.method==='cash'&&(active.collectionStatus||'awaiting_collection')==='awaiting_collection'
  const units=(request.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0)
  return <Modal onClose={close} wide className="credit-payment-detail-dialog"><div className="credit-order-detail-modal">
    <header><div><span className="modal-kicker">CREDIT ORDER</span><h2>{request.id}</h2><p>Submitted {displayDate(request.createdAt||request.date)} · {units} unit{units===1?'':'s'}</p></div><Status value={state}/></header>
    <section className="credit-order-detail-summary"><span><small>ORDER VALUE</small><strong>{money(request.creditIssuedAmount??request.total)}</strong></span><span><small>ORDER STATUS</small><strong>{request.status}</strong></span><span><small>PAYMENT DUE</small><strong>{request.creditDueAt?displayDate(request.creditDueAt):'After dispatch'}</strong></span></section>
    <section className="credit-order-detail-items"><h3>Products in this order</h3>{(request.items||[]).map((item,index)=><article key={item.productId||item.id||index}><span><strong>{item.name||item.productName||item.product||`Product ${index+1}`}</strong><small>{item.code||item.productId||'CAMY product'}</small></span><b>{item.qty||0} × {money(item.price||item.unitPrice)}</b><strong>{money(Number(item.qty||0)*Number(item.price||item.unitPrice||0))}</strong></article>)}</section>
    <section className="credit-payment-attempts"><header><div><small>PAYMENT HISTORY</small><h3>{attempts.length?`${attempts.length} payment attempt${attempts.length===1?'':'s'}`:'No payment submitted'}</h3></div></header>{attempts.length?<div>{attempts.map(item=>{const cash=item.method==='cash'||item.method==='cash_at_camy';return <article className={item.status==='Rejected'?'rejected':''} key={item.id}><span><Status value={item.status==='Verified'?'Paid':item.status}/><small>{displayDate(item.createdAt||item.date)}</small></span><span><small>METHOD</small><strong>{cash?'Cash at CAMY':'Bank transaction'}</strong></span><span><small>REFERENCE</small><strong>{item.reference||'Not provided'}</strong></span>{item.status==='Rejected'&&<p><b>Rejected reason:</b> {item.rejectionReason||'Payment evidence was not accepted.'}</p>}</article>})}</div>:<p className="workflow-note">No payment has been submitted for this order yet.</p>}</section>
    {(['Unpaid','Rejected'].includes(state)||canChangeCash)&&<footer><button type="button" className="btn primary" onClick={()=>{close();onPayRequest(request.id)}}>{canChangeCash?'Change payment method & pay':state==='Rejected'?'Change payment method & pay':'Choose payment method & pay'} <ArrowRight/></button></footer>}
  </div></Modal>
}

function CreditOnlyPage({ tiers, settlements=[], requests=[], person, onSettlement, onPayRequest }) {
  const [orderFilter,setOrderFilter]=useState('All')
  const [viewRequest,setViewRequest]=useState(null)
  const sales=Number(person?.sales||0), progression=creditProgression(tiers,sales)
  const credit=Number(progression.credit||0), outstanding=Math.max(0,Number(person?.used||0)), available=Math.max(0,credit-outstanding)
  const utilization=credit?Math.min(100,outstanding/credit*100):0, next=progression.next
  const verified=settlements.filter(item=>item.status==='Verified')
  const settled=verified.reduce((sum,item)=>sum+Number(item.amount||0),0)
  const myRequests=requests.filter(item=>item.creditMode===true&&String(item.entrepreneurId)===String(person?.id))
  globalThis.__camyCreditRequests=myRequests
  const settlementFor=request=>settlements.find(item=>String(item.requestId)===String(request.id)&&item.status!=='Rejected')
  const rejectedFor=request=>settlements.find(item=>String(item.requestId)===String(request.id)&&item.status==='Rejected')
  const paymentState=request=>{const payment=settlementFor(request);if(payment?.status==='Verified')return 'Paid';if(payment)return 'Under review';if(rejectedFor(request))return 'Rejected';if(request.status==='Dispatched')return 'Unpaid';return 'Not due'}
  const repaymentCountdown=request=>{if(request.status!=='Dispatched')return null;const issued=request.creditIssuedAt||request.dispatchedAt||request.updatedAt;const due=request.creditDueAt?new Date(request.creditDueAt):issued?new Date(new Date(issued).getTime()+10*86400000):null;if(!due||Number.isNaN(due.getTime()))return null;const days=Math.ceil((due.getTime()-Date.now())/86400000);return {due,days,label:days>1?`${days} days left to pay`:days===1?'1 day left to pay':days===0?'Payment due today':`${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`}}
  const creditOrders=[...myRequests].filter(request=>orderFilter==='All'||paymentState(request)===orderFilter).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))
  return <div className="content-page money-centre-page credit-payments-page">
    <section className="money-welcome"><div><small>BUSINESS CREDIT</small><h1>Your credit account, clearly explained.</h1><p>See your limit, available balance, repayments, credit orders, and next eligibility milestone.</p></div>{outstanding>0?<Button icon={Banknote} onClick={onSettlement}>Pay credit balance</Button>:<span><BadgeCheck/> Credit account up to date</span>}</section>
    <section className="money-summary-grid">
      <article><span><CreditCard/></span><div><small>CREDIT LIMIT</small><strong>{money(credit)}</strong><p>Your approved CAMY credit</p></div></article>
      <article className="paid"><span><WalletCards/></span><div><small>AVAILABLE CREDIT</small><strong>{money(available)}</strong><p>Ready for credit orders</p></div></article>
      <article className={outstanding?'due':'clear'}><span><CalendarDays/></span><div><small>CREDIT USED</small><strong>{money(outstanding)}</strong><p>{outstanding?'Balance to repay':'Nothing to repay'}</p></div></article>
      <article><span><BadgeCheck/></span><div><small>TOTAL REPAID</small><strong>{money(settled)}</strong><p>{verified.length} verified payment{verified.length===1?'':'s'}</p></div></article>
    </section>
    <section className="money-credit-grid">
      <article className="credit-balance-card"><header><div><small>CREDIT BALANCE</small><h2>{money(available)} available</h2></div><b>{person?.stage||'Trial stage'}</b></header><div className="credit-balance-bar" role="progressbar" aria-label="Credit limit used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(utilization)}><i style={{width:`${utilization}%`}}/></div><div className="credit-balance-labels"><span><small>Approved limit</small><strong>{money(credit)}</strong></span><span><small>Currently used</small><strong>{money(outstanding)}</strong></span><span><small>Available now</small><strong>{money(available)}</strong></span></div></article>
      <article className="money-next-tier"><header><span><Target/></span><div><small>NEXT CREDIT LEVEL</small><h2>{next?`${money(next.credit)} credit`:'Highest level reached'}</h2></div></header>{next?<><strong>{money(progression.remaining)} more needed</strong><p>Reach {money(next.sales)} in verified delivered product selling value to unlock this limit.</p><div><i style={{width:`${progression.progress}%`}}/></div><footer><span>{money(sales)}</span><b>{Math.round(progression.progress)}%</b><span>{money(next.sales)}</span></footer></>:<p>You have reached every configured credit milestone.</p>}</article>
    </section>
    <section className="credit-order-register">
      <header><div><small>CREDIT STOCK ORDERS</small><h2>Orders and payment status</h2><p>Pay each dispatched credit-stock order separately and follow CAMY verification.</p></div></header>
      <nav aria-label="Filter credit orders">{['All','Unpaid','Rejected','Under review','Paid','Not due'].map(value=><button type="button" className={orderFilter===value?'active':''} aria-pressed={orderFilter===value} onClick={()=>setOrderFilter(value)} key={value}>{value}<b>{value==='All'?myRequests.length:myRequests.filter(item=>paymentState(item)===value).length}</b></button>)}</nav>
      {creditOrders.length?<div>{creditOrders.map(request=>{const state=paymentState(request),payment=settlementFor(request),rejected=rejectedFor(request),paymentRecord=payment||rejected,countdown=repaymentCountdown(request),units=(request.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0),paymentMethod=paymentRecord?(['cash','cash_at_camy'].includes(paymentRecord.method)?'Cash at CAMY':'Bank transaction'):'Not selected',canChangeCash=payment?.status==='Pending verification'&&payment?.method==='cash'&&(payment.collectionStatus||'awaiting_collection')==='awaiting_collection';return <article className={`credit-payment-order ${state.toLowerCase().replaceAll(' ','-')} ${countdown&&countdown.days<0&&state!=='Paid'?'overdue':''}`} key={request.id}><span><PackageCheck/></span><div><small>CREDIT ORDER</small><strong>{request.id}</strong><p>{displayDate(request.createdAt||request.date)} · {(request.items||[]).length} products · {units} units</p></div><div><small>ORDER VALUE</small><strong>{money(request.creditIssuedAmount??request.total)}</strong><p>{request.status}{countdown?` · Due ${displayDate(countdown.due)}`:''}</p>{countdown&&state!=='Paid'&&<p className={`credit-due-countdown ${countdown.days<0?'overdue':countdown.days===0?'today':''}`}><CalendarDays/>{countdown.label}</p>}</div><div><small>PAYMENT STATUS</small><Status value={state}/>{payment?.reference&&<p>Ref: {payment.reference}</p>}{state==='Rejected'&&rejected&&<p className="credit-rejection-reason"><b>Reason:</b> {rejected.rejectionReason||'Payment evidence was not accepted.'}</p>}</div><div className="credit-payment-method"><small>PAYMENT TYPE</small><strong>{paymentMethod}</strong></div><div className="credit-order-actions"><button type="button" className="view-credit-order" onClick={()=>setViewRequest(request)}><Eye/> View details</button>{['Unpaid','Rejected'].includes(state)?<button type="button" className={state==='Rejected'?'retry-payment':''} onClick={()=>onPayRequest(request.id)}>{state==='Rejected'?<RotateCcw/>:<Banknote/>} {state==='Rejected'?'Change method':'Choose method'}</button>:canChangeCash?<button type="button" className="change-payment-method" onClick={()=>onPayRequest(request.id)}><RotateCcw/> Change method</button>:state==='Paid'?<b className="credit-paid-mark"><BadgeCheck/> Payment verified</b>:state==='Under review'?<b className="credit-review-mark"><Banknote/> Verification pending</b>:<b className="credit-not-due">Available after dispatch</b>}</div></article>})}</div>:<Empty icon={ReceiptText} title="No matching credit orders" text="Choose another payment filter to see your credit-stock orders."/>}
    </section>
    {viewRequest&&<CreditPaymentOrderDetail request={viewRequest} settlements={settlements} close={()=>setViewRequest(null)} onPayRequest={onPayRequest}/>}
  </div>
}

function CommissionHistoryPage({ orders=[], back, open }) {
  const [status,setStatus]=useState('All'),[from,setFrom]=useState(''),[to,setTo]=useState('')
  const rows=orders.filter(order=>order.orderMode==='dropship'&&order.entrepreneurMargin>0&&!['Cancelled','Returned','Rejected'].includes(order.status)).filter(order=>(status==='All'||(status==='Paid'?order.payoutStatus==='paid':status==='Waiting'?order.payoutStatus==='pending_transfer':!['paid','pending_transfer'].includes(order.payoutStatus)))&&(!from||String(order.payoutPaidAt||order.deliveredAt||order.date).slice(0,10)>=from)&&(!to||String(order.payoutPaidAt||order.deliveredAt||order.date).slice(0,10)<=to)).sort((a,b)=>String(b.payoutPaidAt||b.deliveredAt||b.date).localeCompare(String(a.payoutPaidAt||a.deliveredAt||a.date)))
  const commissionStatus=order=>order.payoutStatus==='paid'?'Paid':order.payoutStatus==='pending_transfer'?'Waiting for CAMY':'In progress'
  return <div className="content-page standalone-money-page"><MoneyPageHeader back={back} eyebrow="COMMISSION PAYMENTS" title="Your CAMY commissions" text="One clear record for every client order, from fulfilment through CAMY payment."/><section className="money-list-tools"><select value={status} onChange={e=>setStatus(e.target.value)}><option>All</option><option>Paid</option><option>Waiting</option><option>Review</option></select><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label><button onClick={()=>{setStatus('All');setFrom('');setTo('')}}>Clear</button></section><section className="standalone-money-list earnings-list">{rows.length?rows.map(order=><article className={`earnings-row payout-${String(order.payoutStatus||'in-progress').replaceAll('_','-')}`} key={order.id}><span><Banknote/></span><div><small>ORDER {order.id}</small><h2>{money(order.entrepreneurMargin)}</h2><p>{order.customer||'Client'} · {displayDate(order.deliveredAt||order.date)}</p></div><dl><span><dt>Order status</dt><dd><Status value={order.status}/></dd></span><span><dt>Commission status</dt><dd><Status value={commissionStatus(order)}/></dd></span><span><dt>Reference</dt><dd>{order.payoutReference||'Not recorded'}</dd></span></dl><button type="button" onClick={()=>open(order.id)}>View full details <ArrowRight/></button></article>):<Empty icon={Banknote} title="No matching commissions" text="Change the filters to find another commission record."/>}</section></div>
}

function CommissionWalletPage({ orders=[], back, open }) {
  const [status,setStatus]=useState('All'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[search,setSearch]=useState('')
  const selectStatus=item=>{
    setStatus(item)
    // A shorter filtered list can leave the scrollable app shell clamped near
    // its old bottom position, which hides the hero underneath the sticky
    // header. Start each status view from a stable, fully aligned position.
    requestAnimationFrame(()=>{
      const main=document.querySelector('.app-v2 > main')
      if(main)main.scrollTo({top:0,left:0,behavior:'instant'})
    })
  }
  const safeOrders=Array.isArray(orders)?orders.filter(Boolean):[]
  const relevant=safeOrders.filter(order=>order.orderMode==='dropship'&&Number(order.entrepreneurMargin||0)>0&&!['Cancelled','Returned','Rejected'].includes(order.status))
  const commissionStatus=order=>order?.payoutStatus==='paid'?'Paid':order?.payoutStatus==='pending_transfer'?'Waiting':'Review'
  const query=search.trim().toLowerCase()
  const rows=relevant.filter(order=>{const orderDate=String(order.payoutPaidAt||order.deliveredAt||order.date||'').slice(0,10);return (status==='All'||commissionStatus(order)===status)&&(!from||orderDate>=from)&&(!to||orderDate<=to)&&(!query||[order.id,order.customer,order.payoutReference].some(value=>String(value||'').toLowerCase().includes(query)))}).sort((a,b)=>String(b.payoutPaidAt||b.deliveredAt||b.date||'').localeCompare(String(a.payoutPaidAt||a.deliveredAt||a.date||'')))
  const total=relevant.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0), paidOrders=relevant.filter(order=>commissionStatus(order)==='Paid'), paid=paidOrders.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const clearFilters=()=>{setStatus('All');setFrom('');setTo('');setSearch('')}
  const hasFilters=status!=='All'||from||to||search
  const statusFilters=[['All','All','Every commission',Grid2X2],['Paid','Received','Transferred to you',BadgeCheck],['Waiting','Waiting','Payment pending',CalendarDays],['Review','Review','Needs attention',Search]]
  return <div className="content-page commission-ledger-page">
    <section className="commission-ledger-hero">
      <div className="commission-hero-top"><button className="commission-back" type="button" onClick={back}><ArrowLeft/> Money centre</button><span className="commission-hero-badge"><BadgeCheck/> Secure earnings record</span></div>
      <div className="commission-hero-layout"><div className="commission-hero-copy"><span>MY EARNINGS</span><h1>Your commission wallet</h1><p>A simple view of every commission—from customer delivery to the money reaching you.</p></div><div className="commission-balance"><small>TOTAL COMMISSION EARNED</small><strong>{money(total)}</strong><span><BadgeCheck/> {paidOrders.length} payment{paidOrders.length===1?'':'s'} completed</span></div></div>
      <div className="commission-summary-grid"><article><span className="commission-summary-icon earned"><TrendingUp/></span><div><small>All-time earned</small><strong>{money(total)}</strong><p>{relevant.length} eligible client order{relevant.length===1?'':'s'}</p></div></article><article><span className="commission-summary-icon received"><BadgeCheck/></span><div><small>Received</small><strong>{money(paid)}</strong><p>{paidOrders.length} confirmed transfer{paidOrders.length===1?'':'s'}</p></div></article><article><span className="commission-summary-icon pending"><WalletCards/></span><div><small>Still in progress</small><strong>{money(Math.max(0,total-paid))}</strong><p>Delivery or transfer pending</p></div></article></div>
    </section>
    <section className="commission-ledger-panel">
      <header className="commission-ledger-toolbar"><div><span>PAYMENT HISTORY</span><h2>Commission activity</h2><p>Find a payment quickly and open it for complete details.</p></div><strong>{rows.length} <small>of {relevant.length} shown</small></strong></header>
      <div className="commission-filter-boxes" aria-label="Filter by payment status">{statusFilters.map(([item,label,description,Icon])=>{const count=item==='All'?relevant.length:relevant.filter(order=>commissionStatus(order)===item).length;return <button type="button" className={`${status===item?'active ':''}${item.toLowerCase()}`.trim()} key={item} onClick={event=>{event.preventDefault();event.stopPropagation();selectStatus(item)}} aria-pressed={status===item}><span><Icon/></span><span><strong>{label}</strong><small>{description}</small></span><b>{count}</b></button>})}</div>
      <div className="commission-filter-panel"><label className="commission-search-filter"><span>Search records</span><div><Search/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Order, client or reference"/></div></label><label><span>From date</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>To date</span><input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label><button type="button" onClick={clearFilters} disabled={!hasFilters}><X/> Reset</button></div>
      <div className="commission-ledger-list">{rows.length?rows.map(order=>{const label=commissionStatus(order),received=label==='Paid';return <button type="button" className={`commission-ledger-row ${label.toLowerCase()}`} key={order.id} onClick={()=>open(order.id)}><span className="commission-row-icon">{received?<Check/>:<Banknote/>}</span><span className="commission-row-main"><small>ORDER {order.id}</small><strong>{order.customer||'Client'}</strong><em>{displayDate(order.deliveredAt||order.date)}</em></span><span className="commission-row-state"><small>Commission received?</small><Status value={received?'Received':'Not received'}/></span><span className="commission-row-reference"><small>Transfer reference</small><strong>{order.payoutReference||'Not available yet'}</strong></span><span className="commission-row-amount"><small>Your commission</small><strong>{money(order.entrepreneurMargin)}</strong></span><span className="commission-row-action" aria-hidden="true"><ArrowRight/></span></button>}):<div className="commission-empty"><span><Search/></span><h3>No commissions found</h3><p>Adjust the status, search, or date range to see more results.</p><button type="button" onClick={clearFilters}>Reset all filters</button></div>}</div>
    </section>
  </div>
}

function CommissionDetailPage({ order, products=[], back }) {
  if(!order)return <div className="content-page"><Empty icon={Banknote} title="Commission not found" text="This commission record is no longer available."/></div>
  const items=order.items||[], margin=Number(order.entrepreneurMargin||0), paid=order.payoutStatus==='paid'
  return <div className="content-page standalone-money-page"><MoneyPageHeader back={back} eyebrow="COMMISSION DETAIL" title={`Commission for ${order.customer||'Client'}`} text="The full client order and CAMY payment record in one place."/><section className="money-detail-hero"><div><small>YOUR COMMISSION</small><strong>{money(margin)}</strong><Status value={paid?'Paid':order.payoutStatus==='pending_transfer'?'Waiting for CAMY':'In progress'}/></div><dl><span><dt>Client paid</dt><dd>{money(order.amount)}</dd></span><span><dt>CAMY product value</dt><dd>{money(order.camyCost??order.amount)}</dd></span><span><dt>Delivered</dt><dd>{displayDate(order.deliveredAt||order.date)}</dd></span><span><dt>Paid</dt><dd>{order.payoutPaidAt?displayDate(order.payoutPaidAt):'Not paid yet'}</dd></span></dl></section><section className="money-detail-card"><header><div><small>CLIENT ORDER</small><h2>{order.customer||'Client order'}</h2></div><Status value={order.status}/></header><div className="money-detail-client"><span><small>Phone</small><strong>{order.phone||'Not provided'}</strong></span><span><small>Delivery address</small><strong>{order.address||'Not provided'}</strong></span><span><small>Order placed</small><strong>{displayDate(order.date)}</strong></span></div><div className="money-detail-product-head"><span>Product</span><span>CAMY unit price</span><span>Your unit price</span><span>Quantity</span><span>Profit</span><span>Line total</span></div><div className="money-detail-products">{items.map((item,index)=>{const product=products.find(p=>String(p.id)===String(item.id||item.productId));const camyPrice=Number(item.camyPrice??product?.price??item.price);const entrepreneurPrice=Number(item.price||0);const qty=Number(item.qty||0);const productProfit=(entrepreneurPrice-camyPrice)*qty;return <article key={item.id||index}>{product?.image&&<img src={product.image} alt=""/>}<div><strong>{item.name||product?.name||'CAMY product'}</strong><small>{product?.code||'CAMY product'}</small></div><span><small>CAMY price</small><strong>{money(camyPrice)}</strong></span><span><small>Your price</small><strong>{money(entrepreneurPrice)}</strong></span><span><small>Qty</small><strong>{qty}</strong></span><span className={`money-product-profit ${productProfit<0?'loss':''}`}><small>Profit</small><strong>{money(productProfit)}</strong></span><b>{money(entrepreneurPrice*qty)}</b></article>})}</div></section><section className={`money-payment-proof ${paid?'paid':'waiting'}`}><span>{paid?<BadgeCheck/>:<CalendarDays/>}</span><div><small>{paid?'PAYMENT CONFIRMED':'CURRENT PROCESS'}</small><h2>{paid?'CAMY transferred your commission':'Waiting for CAMY commission payment'}</h2><p>{paid?`Transfer reference: ${order.payoutReference||'Recorded by CAMY'}`:'CAMY pays your commission after successful delivery and client collection.'}</p></div>{order.payoutReceipt?<a className="btn secondary" href={order.payoutReceipt} target="_blank" rel="noreferrer"><ReceiptText/> View commission receipt</a>:<em>{paid?'Receipt not attached':'Receipt will appear after payment'}</em>}</section></div>
}

function RepaymentHistoryPage({ settlements=[], outstanding=0, back, open, pay }) {
  const [status,setStatus]=useState('All'),[from,setFrom]=useState(''),[to,setTo]=useState('')
  const rows=[...settlements].filter(item=>(status==='All'||(status==='Verified'?item.status==='Verified':item.status!=='Verified'))&&(!from||String(item.createdAt||item.date).slice(0,10)>=from)&&(!to||String(item.createdAt||item.date).slice(0,10)<=to)).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))
  return <div className="content-page standalone-money-page"><MoneyPageHeader back={back} eyebrow="CREDIT REPAYMENTS" title="Your credit payment records" text="Follow each order’s 21-day Tier 1 or 10-day higher-tier deadline and CAMY verification here." action={outstanding>0?<Button icon={Banknote} onClick={pay}>Make a payment</Button>:<span className="money-clear"><BadgeCheck/> Nothing due</span>}/><section className="repayment-guide"><strong>{money(outstanding)} outstanding</strong><p>Bank transfer: send the amount to CAMY and upload the receipt. Cash: pay at a CAMY store and CAMY Admin records it.</p></section><section className="money-list-tools"><select value={status} onChange={e=>setStatus(e.target.value)}><option>All</option><option>Verified</option><option>Pending</option></select><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label><button onClick={()=>{setStatus('All');setFrom('');setTo('')}}>Clear</button></section><section className="standalone-money-list">{rows.length?rows.map(item=><article key={item.id}><span><ReceiptText/></span><div><small>PAYMENT {item.id}</small><h2>{money(item.amount)}</h2><p>{(item.method||item.paymentMethod)==='cash'?'Cash at CAMY store':'Bank transfer'} · {displayDate(item.createdAt||item.date)}</p></div><dl><span><dt>Status</dt><dd>{item.status}</dd></span><span><dt>Reference</dt><dd>{item.reference||'CAMY recorded'}</dd></span></dl><button type="button" onClick={()=>open(item.id)}>View full details <ArrowRight/></button></article>):<Empty icon={ReceiptText} title="No matching repayments" text={outstanding?'Make a payment or change the filters.':'You have no credit repayment records yet.'}/>}</section></div>
}

function RepaymentDetailPage({ item, back }) {
  if(!item)return <div className="content-page"><Empty icon={ReceiptText} title="Payment not found" text="This repayment record is no longer available."/></div>
  const cash=(item.method||item.paymentMethod)==='cash', reviewed=item.verifiedAt||item.reviewedAt
  return <div className="content-page standalone-money-page"><MoneyPageHeader back={back} eyebrow="CREDIT PAYMENT DETAIL" title={item.id} text="Complete repayment submission and CAMY verification history."/><section className="money-detail-hero repayment"><div><small>AMOUNT PAID</small><strong>{money(item.amount)}</strong><Status value={item.status}/></div><dl><span><dt>Method</dt><dd>{cash?'Cash at CAMY store':'Bank transfer'}</dd></span><span><dt>{cash?'Cash collection':'Reference'}</dt><dd>{cash?(item.collectionStatus==='collected'?'Collected by CAMY':'Not collected yet'):(item.reference||'Recorded by CAMY')}</dd></span><span><dt>Submitted</dt><dd>{displayDate(item.createdAt||item.date)}</dd></span><span><dt>CAMY review</dt><dd>{reviewed?displayDate(reviewed):'Waiting for CAMY'}</dd></span></dl></section>{cash&&item.status==='Pending verification'&&<section className="store-payment-instructions detail"><header><Store/><div><small>HOW TO COMPLETE THIS PAYMENT</small><strong>{item.collectionStatus==='collected'?'Cash received—waiting for final verification':'Visit a CAMY store to pay'}</strong></div></header>{item.collectionStatus!=='collected'&&<ol><li>Call CAMY at <a href={`tel:${SUPPORT_PHONE_DIAL}`}>{SUPPORT_PHONE_DISPLAY}</a> first to confirm the nearest store and opening hours.</li><li>Bring your member ID and show payment ID <b>{item.id}</b>.</li><li>Pay exactly <b>{money(item.amount)}</b> and collect your store receipt.</li><li>Your balance changes only after CAMY marks the cash collected and verifies it.</li></ol>}<p>{item.collectionStatus==='collected'?'CAMY has recorded the store collection. No further action is required unless CAMY contacts you.':'This request is only a payment intention; cash has not yet been received.'}</p>{item.collectionStatus!=='collected'&&<button type="button" className="btn primary" onClick={()=>globalThis.__camyOpenCreditPayment?.(item.requestId)}>Change to bank transfer and upload receipt</button>}</section>}<section className="money-payment-proof"><span><ReceiptText/></span><div><small>PAYMENT EVIDENCE</small><h2>{cash?'CAMY store cash record':'Bank transfer receipt'}</h2><p>{item.status==='Verified'?'CAMY has verified this credit repayment.':cash&&item.collectionStatus!=='collected'?'CAMY is waiting to receive your cash at the store.':'CAMY is reviewing this repayment. Your available credit updates only after verification.'}</p></div>{item.receipt?<a className="btn secondary" href={item.receipt} target="_blank" rel="noreferrer"><ReceiptText/> View uploaded receipt</a>:<em>{cash?(item.collectionStatus==='collected'?'Cash collected by CAMY':'Store payment pending'):'Receipt unavailable'}</em>}</section></div>
}

function ProfilePage({ profile, setProfile, savePhoto, person, orders, entrepreneurs, notify, openPassword }) {
  const [editing,setEditing]=useState(false); const [draft,setDraft]=useState(profile); const [leaveOpen,setLeaveOpen]=useState(false); const [saving,setSaving]=useState(false)
  useEffect(()=>setDraft(profile),[profile])
  const joined=person?.joined||profile.joined||'2026-03-21'; const joinedDate=new Date(joined); const daysActive=Math.max(1,Math.floor((Date.now()-joinedDate.getTime())/86400000)); const customers=new Set(orders.map(order=>order.phone||order.customer)).size; const leaders=[...entrepreneurs].sort((a,b)=>Number(b.sales||0)-Number(a.sales||0)); const rank=Math.max(1,leaders.findIndex(item=>item.id===person?.id)+1); const activeOrders=orders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status)); const outstanding=Number(person?.used||0); const canLeave=outstanding===0&&activeOrders.length===0; const exitStatus=person?.exitRequest?.status||profile.exitRequest?.status; const pending=exitStatus==='Pending'
  const save = async () => {
    if (saving) return

    const phone = String(draft.phone || '').replace(/[\s-]/g, '')
    const nic = String(draft.nic || '').trim()

    if (!draft.name?.trim()) {
      notify('Enter your full name before saving.')
      return
    }

    if (!/^(?:\+94|0)7\d{8}$/.test(phone)) {
      notify('Enter a valid mobile number, for example 0771234567.')
      return
    }

    if (!/^(?:\d{9}[VvXx]|\d{12})$/.test(nic)) {
      notify('Enter a valid 10-character old NIC or 12-digit new NIC number.')
      return
    }

    setSaving(true)
    try {
      if (await setProfile({ ...draft, phone, nic, joined })) {
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const beginEdit = () => setEditing(true)
    const saveEdit = () => {
      if (!saving) save()
    }

    window.addEventListener('camy-edit-profile', beginEdit)
    window.addEventListener('camy-save-profile', saveEdit)

    return () => {
      window.removeEventListener('camy-edit-profile', beginEdit)
      window.removeEventListener('camy-save-profile', saveEdit)
    }
  })
  const saveProfilePhoto = async image => {
    if (saving) return

    const nextDraft = { ...draft, image }
    setDraft(nextDraft)
    setSaving(true)

    try {
      const saved = await savePhoto(image)

      if (saved) {
        setEditing(false)
        notify(image ? 'Profile photo saved to your account.' : 'Profile photo removed from your account.')
      }
    } finally {
      setSaving(false)
    }
  }

  const updatePhoto = event => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      notify('Use a JPG, PNG or WebP profile photo up to 8 MB.')
      return
    }

    const reader = new FileReader()
    reader.onerror = () => notify('The selected photo could not be read. Please choose another image.')
    reader.onload = () => {
      const source=String(reader.result), image=new Image()
      image.onerror=()=>notify('The selected file is not a readable image.')
      image.onload=()=>{
        const max=1024, scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)), canvas=document.createElement('canvas')
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height)
        saveProfilePhoto(canvas.toDataURL('image/webp',.86))
      }
      image.src=source
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = () => saveProfilePhoto('')
  const requestExit=async()=>{if(saving||!canLeave)return;setSaving(true);try{if(await setProfile({...draft,joined,exitRequest:{status:'Pending',createdAt:new Date().toISOString()}}))setLeaveOpen(false)}finally{setSaving(false)}}
  return <div className="content-page"><PageTitle eyebrow="ACCOUNT" title="My business profile" text="Manage your identity, settlement details, membership, and account status."><Button variant={editing?'primary':'secondary'} icon={editing?Check:Pencil} disabled={saving} onClick={editing?save:()=>setEditing(true)}>{editing?'Save changes':'Edit profile'}</Button></PageTitle><section className="profile-layout"><article className="profile-summary"><div className="profile-cover"><div className="profile-avatar">{draft.image?<img src={draft.image} alt={draft.name}/>:<span>{(draft.name||'SK').split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase()}</span>}<label className="profile-photo-action" title="Upload a new profile photo"><Pencil/><input type="file" accept="image/png,image/jpeg,image/webp" onChange={updatePhoto}/></label></div></div><div className="profile-photo-tools"><label><Pencil/> Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={updatePhoto}/></label>{draft.image&&<button type="button" onClick={removePhoto}><Trash2/> Remove</button>}</div><h2>{draft.name} <BadgeCheck/></h2><p>CAMY Entrepreneur · {person?.id||'CE-0194'}</p><small className="profile-joined"><CalendarDays/> Member since {displayDate(joined)}</small><b><TrendingUp/> {person?.stage||'CAMY member'}</b><div className="profile-live-stats"><span><strong>{daysActive}</strong><small>Days active</small></span><span><strong>{customers}</strong><small>Customers</small></span><span><strong>#{rank}</strong><small>Current rank</small></span></div><Button variant="soft" icon={Headphones} onClick={()=>notify('CAMY Support: +94 77 755 4477')}>Contact support</Button></article><div className="form-stack"><Button variant="secondary" icon={Settings} onClick={()=>window.dispatchEvent(new Event('camy-change-password'))}>Change password</Button><ProfileForm title="Personal details" icon={UserRound} editing={editing} draft={draft} setDraft={setDraft} fields={[["name","Full name"],["nic","NIC number"],["phone","Contact number"],["email","Email address"],["address","Home address"]]}/><article className="card membership-card"><div className="card-head"><div><span>CAMY MEMBERSHIP</span><h2>Account information</h2></div><BadgeCheck/></div><div><span><small>Membership ID</small><strong>{person?.id||'CE-0194'}</strong></span><span><small>Joined CAMY</small><strong>{displayDate(joined)}</strong></span><span><small>Membership period</small><strong>{daysActive} days</strong></span><span><small>Account status</small><strong>{pending?'Exit review pending':'Active'}</strong></span></div></article><ProfileForm title="Bank account" icon={CreditCard} editing={editing} draft={draft} setDraft={setDraft} fields={[["bank","Bank"],["branch","Branch"],["accountName","Account holder"],["account","Account number"]]} secure/><article className="card leave-company-card"><div><span>ACCOUNT & MEMBERSHIP</span><h2>{pending?'Exit request under review':'Planning to leave CAMY?'}</h2><p>{pending?'CAMY Admin will review your account and contact you before it is closed.':canLeave?'You can submit a request for CAMY Admin to review and close your membership.':'Your account must have no outstanding credit and no active orders before an exit request can be submitted.'}</p></div><div className="leave-checks"><span className={outstanding===0?'clear':'blocked'}><WalletCards/><small>Outstanding credit</small><strong>{money(outstanding)}</strong></span><span className={activeOrders.length===0?'clear':'blocked'}><PackageOpen/><small>Active orders</small><strong>{activeOrders.length}</strong></span></div><Button variant="secondary" icon={LogOut} disabled={pending} onClick={()=>setLeaveOpen(true)}>{pending?'Request pending':'Request to leave CAMY'}</Button></article></div></section>{leaveOpen&&<Modal onClose={()=>setLeaveOpen(false)}><div className="form-modal exit-request-modal"><span className="exit-modal-icon"><LogOut/></span><h2>{canLeave?'Request membership closure':'Account cannot be closed yet'}</h2><p>{canLeave?'This sends a request to CAMY Admin. Your account remains active until an administrator completes the final review.':'To protect CAMY and your customers, resolve all outstanding credit and complete or return every active order first.'}</p><div className="leave-checks"><span className={outstanding===0?'clear':'blocked'}><WalletCards/><small>Outstanding credit</small><strong>{money(outstanding)}</strong></span><span className={activeOrders.length===0?'clear':'blocked'}><PackageOpen/><small>Active orders</small><strong>{activeOrders.length}</strong></span></div>{canLeave?<Button icon={Check} disabled={saving} onClick={requestExit}>Send exit request</Button>:<Button variant="secondary" onClick={()=>setLeaveOpen(false)}>I understand</Button>}</div></Modal>}</div>
}

function ProfileSecurityCard() {
  const empty = { currentPassword:'', newPassword:'', confirmPassword:'' }
  const [expanded,setExpanded] = useState(false)
  const [form,setForm] = useState(empty)
  const [visible,setVisible] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState('')
  const update = (key,value) => setForm(current=>({...current,[key]:value}))
  const close = () => { if (busy) return; setExpanded(false); setVisible(false); setError(''); setSuccess(''); setForm(empty) }
  const submit = async event => {
    event.preventDefault(); setError(''); setSuccess('')
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) { setError('Use at least 8 characters with both letters and numbers.'); return }
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return }
    if (form.currentPassword === form.newPassword) { setError('Your new password must be different from the current password.'); return }
    setBusy(true)
    try {
      const result = await api('/auth/change-password',{method:'POST',body:JSON.stringify(form)})
      setSuccess(result.message || 'Your password was changed successfully.')
      setForm(empty)
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  return <article className={`card profile-security-card ${expanded?'is-open':''}`}>
    <header className="profile-security-head">
      <span className="profile-security-icon"><Settings/></span>
      <div><small>ACCOUNT SECURITY</small><h2>Password & sign-in</h2><p>Update your password here to keep your CAMY business account protected.</p></div>
      {!expanded&&<button type="button" className="btn secondary" onClick={()=>{setExpanded(true);setSuccess('')}}><Settings/> Change password</button>}
    </header>
    {success&&<p className="profile-security-message success"><Check/>{success}</p>}
    {expanded&&<form className="profile-security-form" onSubmit={submit}>
      {error&&<p className="profile-security-message error">{error}</p>}
      <label className="current-password">Current password<div className="profile-security-input"><input autoFocus required type={visible?'text':'password'} autoComplete="current-password" value={form.currentPassword} onChange={event=>update('currentPassword',event.target.value)}/><button type="button" className="password-visibility" onClick={()=>setVisible(value=>!value)} aria-label={visible?'Hide passwords':'Show passwords'}>{visible?<EyeOff/>:<Eye/>}</button></div></label>
      <label>New password<div className="profile-security-input"><input required minLength="8" type={visible?'text':'password'} autoComplete="new-password" value={form.newPassword} onChange={event=>update('newPassword',event.target.value)}/></div><small>8+ characters with letters and numbers</small></label>
      <label>Confirm new password<div className="profile-security-input"><input required minLength="8" type={visible?'text':'password'} autoComplete="new-password" value={form.confirmPassword} onChange={event=>update('confirmPassword',event.target.value)}/></div></label>
      <div className="profile-security-actions"><button type="button" className="btn secondary" onClick={close}>Cancel</button><button type="submit" className="btn primary" disabled={busy}><Check/>{busy?'Saving…':'Save new password'}</button></div>
    </form>}
  </article>
}

function ProfileForm({ title, icon:Icon, editing, draft, setDraft, fields, secure }) { return <article className={`card profile-form ${editing?'is-editing':''}`}><div className="card-head"><div><span>{secure?'PAYMENT DETAILS':'YOUR INFORMATION'}</span><h2>{title}</h2></div><div className="profile-card-actions"><Icon/><button type="button" onClick={()=>window.dispatchEvent(new Event(editing?'camy-save-profile':'camy-edit-profile'))}>{editing?<><Check/> Save changes</>:<><Pencil/> Edit details</>}</button></div></div><div>{fields.map(([key,label])=>{const phoneInvalid=key==='phone'&&editing&&draft.phone&&!/^(?:\+94|0)7\d{8}$/.test(String(draft.phone).replace(/[\s-]/g,''));const nicInvalid=key==='nic'&&editing&&draft.nic&&!/^(?:\d{9}[VvXx]|\d{12})$/.test(String(draft.nic).trim());return <label className={`${key==='address'?'wide ':''}${phoneInvalid||nicInvalid?'field-invalid':''}`} key={key}>{label}<input disabled={!editing||key==='email'} inputMode={key==='phone'?'tel':undefined} placeholder={key==='phone'?'0771234567':undefined} value={draft[key]||''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>{phoneInvalid&&<small>Use a Sri Lankan mobile number such as 0771234567.</small>}{nicInvalid&&<small>Use a 10-character old NIC or a 12-digit new NIC.</small>}</label>})}</div>{secure&&<p className="secure"><BadgeCheck/><span><strong>Your details are protected.</strong> CAMY uses this account to transfer your recorded entrepreneur earnings.</span></p>}</article> }

function LegacyAdminOverview({ entrepreneurs, orders, products, tiers = [], requests = [], setPage, openEntrepreneur }) {
  const active=entrepreneurs.filter(person=>person.active!==false&&person.stage!=='Departed')
  const delivered=orders.filter(order=>order.status==='Delivered')
  const networkSales=delivered.reduce((sum,order)=>sum+Number(order.camyCost??order.amount??0),0)
  const clientCollections=delivered.reduce((sum,order)=>sum+Number(order.amount||0),0)
  const entrepreneurCommissions=delivered.filter(order=>order.orderMode==='dropship').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const paidCommissions=delivered.filter(order=>order.orderMode==='dropship'&&order.payoutStatus==='paid').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const pendingCommissions=delivered.filter(order=>order.orderMode==='dropship'&&order.payoutStatus==='pending_transfer').reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const camyGrossProfit=Math.max(0,clientCollections-entrepreneurCommissions)
  const outstanding=entrepreneurs.reduce((sum,person)=>sum+Number(person.used||0),0)
  const inProgress=orders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status))
  const now=new Date(), month=now.toISOString().slice(0,7)
  const readyPayouts=orders.filter(order=>order.orderMode==='dropship'&&order.payoutStatus==='pending_transfer')
  const monthSales=delivered.filter(order=>String(order.date).startsWith(month)).reduce((sum,order)=>sum+Number(order.camyCost??order.amount??0),0)
  const monthly=Array.from({length:6},(_,index)=>{const date=new Date(now.getFullYear(),now.getMonth()-5+index,1);const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');return {label:date.toLocaleDateString('en-LK',{month:'short'}),amount:delivered.filter(order=>String(order.date).startsWith(key)).reduce((sum,order)=>sum+Number(order.camyCost??order.amount??0),0)}})
  const max=Math.max(1,...monthly.map(item=>item.amount))
  const [stageFilter,setStageFilter]=useState('All'), [startDate,setStartDate]=useState(''), [endDate,setEndDate]=useState('')
  const top=active.filter(person=>(stageFilter==='All'||person.stage===stageFilter)&&(!startDate||person.joined>=startDate)&&(!endDate||person.joined<=endDate)).sort((a,b)=>Number(b.sales||0)-Number(a.sales||0)).slice(0,4)
  const tasks=[[WalletCards,readyPayouts.length,'Entrepreneur commissions ready','Transfer at any time and save the payment receipt','payouts'],[PackageOpen,requests.filter(item=>item.status==='Pending').length,'Credit stock requests to approve','Check eligibility, credit and warehouse stock','stock-supply'],[PackageCheck,requests.filter(item=>item.status==='Approved').length,'Approved credit stock to dispatch','Dispatching issues credit and increases outstanding balance','stock-supply'],[Truck,orders.filter(item=>item.status==='Processing').length,'COD client orders ready to dispatch','CAMY will collect the client payment on delivery','admin-orders'],[WalletCards,active.filter(person=>Number(person.used||0)>0).length,'Accounts with outstanding credit',money(outstanding)+' outstanding','credit-control']]
  return <div className="content-page"><section className="admin-hero"><div><span><BadgeCheck/> CAMY MANAGEMENT</span><h1>Your network. <em>One clear view.</em></h1><p>Live figures from saved accounts, verified orders, and warehouse stock.</p></div></section><section className="metric-row"><Metric icon={UsersRound} label="Active entrepreneurs" value={active.length} detail={active.filter(person=>String(person.joined||'').startsWith(month)).length+' joined this month'} tone="purple"/><Metric icon={CircleDollarSign} label="Verified network sales" value={shortMoney(networkSales)} detail={delivered.length+' delivered orders'}/><Metric icon={WalletCards} label="Credit outstanding" value={money(outstanding)} detail={active.filter(person=>Number(person.used||0)>0).length+' accounts with a balance'} tone="gold"/><Metric icon={Truck} label="Orders in progress" value={inProgress.length} detail={orders.filter(order=>order.status==='Dispatched').length+' dispatched'} tone="green"/></section><section className="overview-finance-summary"><header><div><span>DELIVERED COD FINANCE SUMMARY</span><h2>CAMY revenue and entrepreneur commissions</h2></div><button type="button" onClick={()=>setPage('payouts')}>Open payouts <ArrowRight/></button></header><div><article><span><CircleDollarSign/></span><small>CLIENT COD COLLECTED</small><strong>{money(clientCollections)}</strong><p>{delivered.length} successful delivery{delivered.length===1?'':'ies'}</p></article><article className="camy-profit"><span><Banknote/></span><small>CAMY GROSS PROFIT</small><strong>{money(camyGrossProfit)}</strong><p>After entrepreneur commission · before stock and operating costs</p></article><article className="entrepreneur-commission"><span><WalletCards/></span><small>ENTREPRENEUR COMMISSION</small><strong>{money(entrepreneurCommissions)}</strong><p>{money(paidCommissions)} paid · {money(pendingCommissions)} waiting to pay</p></article></div></section><section className="dashboard-grid"><article className="card chart-card"><div className="card-head"><div><span>VERIFIED SALES</span><h2>{money(monthSales)} <small>this month</small></h2></div><button onClick={()=>setPage('reports')}>View reports <ArrowRight/></button></div><SalesBars values={monthly.map(item=>100*item.amount/max)} labels={monthly.map(item=>item.label)} amounts={monthly.map(item=>item.amount)}/></article><article className="card action-centre"><div className="card-head"><div><span>NEEDS ATTENTION</span><h2>Action centre</h2></div><b>{tasks.reduce((sum,task)=>sum+task[1],0)}</b></div>{tasks.map(([Icon,count,title,text,target])=><button key={title} onClick={()=>setPage(target)}><span><Icon/></span><div><strong>{count} {title.toLowerCase()}</strong><small>{text}</small></div><ChevronRight/></button>)}</article></section><article className="card admin-preview"><div className="card-head"><div><span>ENTREPRENEUR ACTIVITY</span><h2>Top verified sellers</h2></div><button onClick={()=>setPage('entrepreneurs')}>Manage all <ArrowRight/></button></div><div className="overview-filters"><select value={stageFilter} onChange={event=>setStageFilter(event.target.value)}><option value="All">All stages</option><option>Trial seller</option><option>Credit eligible</option></select><label>From<input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></label><label>To<input type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label><button onClick={()=>{setStartDate('');setEndDate('');setStageFilter('All')}}>Clear</button></div><EntrepreneurTable people={top} onOpen={openEntrepreneur} readOnly/>{!top.length&&<Empty icon={UsersRound} title="No matching entrepreneurs" text="Saved active accounts appear here."/>}</article><section className="admin-snapshot"><article className="card"><div className="card-head"><div><span>SAVED CREDIT RULES</span><h2>Sales tier summary</h2></div><button onClick={()=>setPage('credit-control')}>Manage <Settings/></button></div><div className="snapshot-rules">{tiers.map((tier,index)=><span key={tier.id||index}><small>{money(tier.sales)} verified sales</small><strong>{money(tier.credit)} credit</strong></span>)}</div>{!tiers.length&&<p>No credit tiers configured.</p>}</article><article className="card"><div className="card-head"><div><span>WAREHOUSE STOCK</span><h2>Stock snapshot</h2></div><button onClick={()=>setPage('admin-products')}>Manage <ArrowRight/></button></div><div className="stock-snapshot"><span><i className="good"/><strong>{products.filter(product=>product.stock>8).length}</strong> healthy</span><span><i className="low"/><strong>{products.filter(product=>product.stock>0&&product.stock<=8).length}</strong> low stock</span><span><i className="out"/><strong>{products.filter(product=>product.stock===0).length}</strong> unavailable</span></div></article></section></div>
}

function EntrepreneurTable({ people, onOpen, onRemove, readOnly=false }) { return <div className={`data-table people-table ${readOnly?'read-only-table':''}`}><div className="data-row head"><span>Entrepreneur</span><span>Stage</span><span>Sales</span><span>Credit limit</span><span>Outstanding</span><span>View</span>{!readOnly&&<span>Remove</span>}</div>{people.map((p,index)=><div className="data-row" style={{'--row-index':index}} key={p.id}><span className="person"><b className="member-number">{p.id}</b><i className="person-avatar">{avatarFor(p)?<img src={avatarFor(p)} alt="" onError={event=>{event.currentTarget.style.display='none';event.currentTarget.nextElementSibling.style.display='grid'}} />:null}<span style={{display:avatarFor(p)?undefined:'grid'}}>{initialsFor(p)}</span></i><div><strong>{p.name}</strong><small><MapPin />{p.city}</small></div></span><span><Status value={p.stage} /></span><span><strong>{money(p.sales)}</strong></span><span>{money(p.credit)}</span><span className={p.used?'balance-warning':''}>{money(p.used)}</span><button className="row-action view-action" aria-label={`View ${p.name}`} title={`View ${p.name}`} onClick={()=>onOpen?.(p)}><ChevronRight /></button>{!readOnly&&<button className="row-action remove-action" aria-label={`Remove ${p.name}`} title={`Remove ${p.name}`} onClick={()=>onRemove?.(p)}><Trash2 /></button>}</div>)}</div> }

function ExitRequestQueue({ entrepreneurs, orders, setEntrepreneurs, notify }) {
  const requests=entrepreneurs.filter(person=>person.exitRequest?.status==='Pending')
  const review=async(person,decision)=>{try{const result=await api('/admin/entrepreneurs/'+encodeURIComponent(person.id)+'/exit/'+(decision==='Approved'?'approve':'reject'),{method:'POST',body:'{}'});setEntrepreneurs(old=>old.map(item=>item.id===person.id?result.person:item));notify('Closure request '+decision.toLowerCase())}catch(reason){notify(reason.message)}}
  if(!requests.length)return <article className="card exit-inbox empty-exit-inbox"><span><Check/></span><div><strong>No exit requests waiting</strong><small>New entrepreneur requests will appear here for admin review.</small></div></article>
  return <section className="exit-request-section"><div className="section-title"><div><span>ADMIN ACTION REQUIRED</span><h2>Entrepreneur exit requests</h2></div><b>{requests.length} pending</b></div><div className="exit-request-grid">{requests.map(person=>{const active=orders.filter(order=>order.entrepreneur===person.name&&!['Delivered','Returned'].includes(order.status)).length;const blocked=Number(person.used||0)>0||active>0;return <article className="card exit-inbox" key={person.id}><header><div className="person"><i>{person.initials}</i><div><strong>{person.name}</strong><small>{person.id} · Requested {displayDate(person.exitRequest.requestedAt)}</small></div></div><Status value="Exit requested"/></header><div className="leave-checks"><span className={Number(person.used||0)===0?'clear':'blocked'}><WalletCards/><small>Outstanding credit</small><strong>{money(person.used)}</strong></span><span className={active===0?'clear':'blocked'}><PackageOpen/><small>Active orders</small><strong>{active}</strong></span></div>{blocked&&<p>Approval is locked until all financial and order obligations are cleared.</p>}<footer><Button variant="secondary" onClick={()=>review(person,'Rejected')}>Reject request</Button><Button icon={Check} disabled={blocked} onClick={()=>review(person,'Approved')}>Approve & archive</Button></footer></article>})}</div></section>
}

function RegistrationApplicationModal({ request, close, review, reviewing }) {
  if (!request) return null
  const field=(label,value)=><span><small>{label}</small><strong>{value || 'Not provided'}</strong></span>
  const marketing={yes:'Yes',a_little:'A little',no:'No'}[request.facebook_marketing] || request.facebook_marketing
  return <Modal onClose={close} wide><div className="application-detail">
    <header className="application-detail-head"><div><span className="modal-kicker">ENTREPRENEUR APPLICATION · #{request.id}</span><h2>{request.full_name}</h2><p>{request.email} · {request.phone}</p></div><Status value={request.status}/></header>
    <section><h3>Personal & login details</h3><div className="application-detail-grid">{field('Full name',request.full_name)}{field('NIC number',request.nic)}{field('Home address',request.address)}{field('City / district',request.city)}{field('WhatsApp number',request.phone)}{field('Login username',request.email)}{field('Current occupation',request.occupation)}{field('Applied',displayDate(request.created_at))}</div></section>
    <section><h3>NIC verification</h3><div className="nic-review-links"><a className="btn secondary" href={`/api/admin/registrations/${request.id}/nic/front`} target="_blank" rel="noreferrer">View NIC front</a><a className="btn secondary" href={`/api/admin/registrations/${request.id}/nic/back`} target="_blank" rel="noreferrer">View NIC back</a></div></section>
    <section><h3>Business background</h3><div className="application-detail-grid">{field('Currently doing an online business',request.has_online_business==='yes'?'Yes':'No')}{field('What they sell',request.online_business_products)}{field('How long',request.online_business_duration)}{field('Average monthly online income',request.monthly_income)}{field('Social-media page',request.social_media_url ? <a href={request.social_media_url} target="_blank" rel="noreferrer">Open page</a> : 'Not provided')}{field('Approx. followers',request.followers_count ?? 'Not provided')}{field('Facebook marketing / boosting',marketing)}</div></section>
    <section><h3>Why CAMY?</h3><p className="application-reason">{request.join_reason || 'Not provided'}</p><p className="application-agreement"><Check/> {request.agreement_accepted ? 'Applicant confirmed the information is correct and CAMY may review it.' : 'Agreement was not recorded.'}</p></section>
    {request.admin_note&&<section className="application-admin-note"><h3>Admin decision note</h3><p>{request.admin_note}</p></section>}
    <footer className="application-detail-actions">
      {request.status==='pending'&&<><Button variant="secondary" disabled={reviewing===request.id} onClick={()=>review(request,'reject')}>Reject application</Button><Button icon={Check} disabled={reviewing===request.id} onClick={()=>review(request,'approve')}>{reviewing===request.id?'Saving…':'Approve account'}</Button></>}
      {request.status==='approved'&&<a className="btn primary" href={applicationWhatsAppUrl(request)} target="_blank" rel="noreferrer"><Phone/> Message activation on WhatsApp</a>}
      <Button variant="soft" onClick={close}>Close</Button>
    </footer>
  </div></Modal>
}

function AdminEntrepreneurs({ entrepreneurs, orders, setEntrepreneurs, openEntrepreneur, openAdd, notify }) {
  const [showApplications,setShowApplications]=useState(false)
  const [search,setSearch]=useState('')
  const [stage,setStage]=useState('All')
  const [registrations,setRegistrations]=useState([])
  const [registrationSearch,setRegistrationSearch]=useState('')
  const [registrationStatus,setRegistrationStatus]=useState('pending')
  const [businessFilter,setBusinessFilter]=useState('All')
  const [reviewing,setReviewing]=useState(null)
  const [selectedApplication,setSelectedApplication]=useState(null)
  const [registrationShareOpen,setRegistrationShareOpen]=useState(false)
  const loadRegistrations=()=>api('/admin/registrations').then(result=>setRegistrations(result.registrations||[])).catch(reason=>notify(reason.message))
  useEffect(()=>{loadRegistrations();window.addEventListener('camy-business-updated',loadRegistrations);return()=>window.removeEventListener('camy-business-updated',loadRegistrations)},[])
  const reviewRegistration=async(request,decision)=>{
    let note=''
    if(decision==='reject'){
      const answer=window.prompt('Why are you rejecting this application? This note will be kept in the admin history.')
      if(answer===null)return
      note=answer.trim()
      if(note.length<3){notify('Add a short rejection reason.');return}
    } else if(!window.confirm(`Approve ${request.full_name} and activate their CAMY login?`)) return
    setReviewing(request.id)
    try{
      const result=await api(`/admin/registrations/${request.id}/${decision}`,{method:'POST',body:JSON.stringify({note})})
      const updated={...request,status:decision==='approve'?'approved':'rejected',admin_note:note||request.admin_note,reviewed_at:new Date().toISOString(),member_id:result.memberId||request.member_id}
      setRegistrations(old=>old.map(item=>item.id===request.id?updated:item))
      setSelectedApplication(old=>old?.id===request.id?updated:old)
      if(decision==='approve'){
        setEntrepreneurs(old=>old.some(item=>item.id===result.memberId)?old:[...old,{id:result.memberId,name:request.full_name,email:request.email,phone:request.phone,nic:request.nic,address:request.address,city:request.city,joined:new Date().toISOString().slice(0,10),sales:0,credit:0,used:0,stage:'Trial seller',initials:String(request.full_name).split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase()}])
      }
      notify(result.message)
    }catch(reason){notify(reason.message)}finally{setReviewing(null)}
  }
  const removeEntrepreneur=async person=>{if(!window.confirm('Archive '+person.name+' and disable sign-in? All order and application history will be kept.'))return;try{const result=await api('/admin/entrepreneurs/'+encodeURIComponent(person.id),{method:'DELETE'});setEntrepreneurs(old=>old.map(item=>item.id===person.id?result.person:item));notify('Entrepreneur archived. History is retained.')}catch(reason){notify(reason.message)}}
  const visible=entrepreneurs.filter(p=>{const archived=p.active===false||p.stage==='Departed';const stageOk=stage==='Archived'?archived:!archived&&(stage==='All'||p.stage===stage);return !p.demoArchived&&stageOk&&`${p.name||''} ${p.id||''} ${p.nic||''} ${p.city||''}`.toLowerCase().includes(search.toLowerCase())})
  const pendingCount=registrations.filter(item=>item.status==='pending').length
  const approvedCount=registrations.filter(item=>item.status==='approved').length
  const rejectedCount=registrations.filter(item=>item.status==='rejected').length
  const applicationRows=registrations.filter(item=>{
    const statusOk=registrationStatus==='all'||item.status===registrationStatus
    const businessOk=businessFilter==='All'||(businessFilter==='Online business' ? item.has_online_business==='yes' : item.has_online_business!=='yes')
    const haystack=`${item.full_name||''} ${item.email||''} ${item.phone||''} ${item.nic||''} ${item.city||''} ${item.occupation||''} ${item.online_business_products||''}`.toLowerCase()
    return statusOk&&businessOk&&haystack.includes(registrationSearch.toLowerCase())
  })
  const openMessage=request=>{const url=applicationWhatsAppUrl(request);if(!url){notify('This application does not have a usable WhatsApp number.');return}window.open(url,'_blank','noopener,noreferrer')}
  const registrationUrl=publicRegistrationUrl()
  const registrationLinkIsLocal=/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(registrationUrl)
  const copyRegistrationLink=async()=>{try{await navigator.clipboard.writeText(registrationUrl);notify('Public CAMY registration link copied.')}catch{window.prompt('Copy this CAMY registration link:',registrationUrl)}}
  const downloadRegistrationQr=()=>{const source=document.querySelector('#camy-registration-qr');if(!source)return;const svg=source.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});const href=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=href;anchor.download='camy-entrepreneur-registration-qr.svg';anchor.click();URL.revokeObjectURL(href);notify('Registration QR code downloaded.')}
  return <div className="content-page admin-entrepreneurs-page camy-entrepreneurs-workspace">
    <PageTitle eyebrow="ENTREPRENEUR CRM" title={showApplications?'Signup requests':'Entrepreneur accounts'} text={showApplications?'Review new signups and access approved or rejected application history.':'Manage your CAMY network, member accounts and business performance.'}><div className="page-title-actions">{showApplications?<Button variant="secondary" icon={ArrowLeft} onClick={()=>setShowApplications(false)}>Back to entrepreneurs</Button>:<><Button variant="secondary" icon={Copy} onClick={copyRegistrationLink}>Copy registration link</Button><Button variant="secondary" icon={QrCode} onClick={()=>setRegistrationShareOpen(true)}>Registration QR</Button><Button icon={UserPlus} onClick={openAdd}>Add entrepreneur manually</Button></>}</div></PageTitle>
    {showApplications?<section className="application-workspace card">
      <div className="section-title"><div><span>REGISTRATION DESK</span><h2>Entrepreneur applications</h2></div><b>{pendingCount} waiting for review</b></div>
      <div className="application-kpis"><span><small>Pending</small><strong>{pendingCount}</strong></span><span><small>Approved</small><strong>{approvedCount}</strong></span><span><small>Rejected</small><strong>{rejectedCount}</strong></span><span><small>Total received</small><strong>{registrations.length}</strong></span></div>
      <div className="application-filters"><label><Search/><input value={registrationSearch} onChange={event=>setRegistrationSearch(event.target.value)} placeholder="Search name, NIC, phone, email, city or occupation"/></label><select value={registrationStatus} onChange={event=>setRegistrationStatus(event.target.value)}><option value="pending">Pending approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All applications</option></select><select value={businessFilter} onChange={event=>setBusinessFilter(event.target.value)}><option>All</option><option>Online business</option><option>No online business</option></select><Button variant="soft" icon={Download} onClick={()=>exportReport('camy-registration-applications.xlsx',applicationRows.map(item=>({id:item.id,status:item.status,name:item.full_name,nic:item.nic,address:item.address,city:item.city,whatsapp:item.phone,email:item.email,occupation:item.occupation,onlineBusiness:item.has_online_business,products:item.online_business_products,duration:item.online_business_duration,monthlyIncome:item.monthly_income,socialMedia:item.social_media_url,followers:item.followers_count,facebookMarketing:item.facebook_marketing,whyJoin:item.join_reason,applied:item.created_at,reviewed:item.reviewed_at,adminNote:item.admin_note,memberId:item.member_id})))}>Download filtered applications</Button></div>
      <div className="application-table-wrap"><div className="application-table application-table-head"><span>Applicant</span><span>Contact</span><span>Business</span><span>Applied</span><span>Status</span><span>Actions</span></div>{applicationRows.map(request=><div className="application-table application-table-row" key={request.id}><span className="person"><i>{String(request.full_name||'CE').split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase()}</i><div><strong>{request.full_name}</strong><small>{request.nic} · {request.city}</small></div></span><span><strong>{request.phone}</strong><small>{request.email}</small></span><span><strong>{request.has_online_business==='yes'?'Online seller':'New / not selling online'}</strong><small>{request.occupation||'Occupation not provided'}</small></span><span><strong>{displayDate(request.created_at)}</strong><small>{request.reviewed_at?`Reviewed ${displayDate(request.reviewed_at)}`:'Waiting for CAMY'}</small></span><span><Status value={request.status}/></span><span className="application-row-actions"><button className="btn soft" onClick={()=>setSelectedApplication(request)}>View</button>{request.status==='pending'&&<><button className="btn secondary" disabled={reviewing===request.id} onClick={()=>reviewRegistration(request,'reject')}>Reject</button><button className="btn primary" disabled={reviewing===request.id} onClick={()=>reviewRegistration(request,'approve')}>Approve</button></>}{request.status==='approved'&&<button className="btn secondary" onClick={()=>openMessage(request)}><Phone/> Message</button>}</span></div>)}</div>
      {!applicationRows.length&&<Empty icon={FileText} title="No matching applications" text="Change the application filters or wait for new registrations."/>}
    </section>:<>
      <section className="signup-request-entry" aria-label="Signup requests">
        <span className="signup-request-icon"><FileText aria-hidden="true"/></span>
        <div className="signup-request-copy"><h2>Signup requests <span className={pendingCount?'request-count has-pending':'request-count'}>{pendingCount} pending</span></h2><p>{pendingCount?'New applications are ready for your review.':'No new signups waiting. View application history at any time.'}</p></div>
        <Button icon={ArrowRight} onClick={()=>setShowApplications(true)}>View requests</Button>
      </section>
      <ExitRequestQueue entrepreneurs={entrepreneurs} orders={orders} setEntrepreneurs={setEntrepreneurs} notify={notify}/>
      <section className="entrepreneur-directory-section"><header><div><span>ENTREPRENEUR DIRECTORY</span><h2>Active accounts and business performance</h2><p>Search, review, export, or open a member profile to manage their CAMY account.</p></div><b>{visible.length} shown</b></header><div className="management-filters"><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search active entrepreneurs by name, ID, NIC, or city"/></label><select value={stage} onChange={e=>setStage(e.target.value)}><option>All</option><option>Trial seller</option><option>Credit eligible</option><option>Archived</option></select><Button variant="soft" icon={Download} disabled={!visible.length} onClick={()=>exportReport('camy-entrepreneurs.xlsx',visible)}>Download filtered report</Button></div><article className="card table-card"><EntrepreneurTable people={visible} onOpen={openEntrepreneur} onRemove={removeEntrepreneur}/>{!visible.length&&<Empty icon={UsersRound} title="No matching entrepreneurs" text="Change the search or account-stage filter."/>}</article></section>
    </>}
    {selectedApplication&&<RegistrationApplicationModal request={selectedApplication} close={()=>setSelectedApplication(null)} review={reviewRegistration} reviewing={reviewing}/>}
    {registrationShareOpen&&<Modal onClose={()=>setRegistrationShareOpen(false)} className="registration-share-modal"><div className="registration-share"><span className="modal-kicker">PUBLIC APPLICATION ACCESS</span><h2>CAMY registration link</h2><p>Entrepreneurs can scan this code or open the link to start the same secure application form.</p>{registrationLinkIsLocal&&<div className="registration-link-warning">This QR currently contains a localhost address. It will work on this computer only. Set <b>VITE_PUBLIC_URL</b> to the deployed CAMY website address before sharing it with phones.</div>}<div className="registration-qr"><QRCodeSVG id="camy-registration-qr" value={registrationUrl} size={256} level="H" marginSize={2} title="CAMY entrepreneur registration QR code"/></div><label>Shareable registration URL<div><input readOnly value={registrationUrl}/><button type="button" onClick={copyRegistrationLink} aria-label="Copy registration link"><Copy/></button></div></label><div className="registration-share-actions"><Button variant="secondary" icon={Download} onClick={downloadRegistrationQr}>Download QR</Button><a className="btn primary" href={registrationUrl} target="_blank" rel="noreferrer"><ExternalLink/>Open form</a></div><small>The QR automatically uses this website's configured public domain.</small></div></Modal>}
  </div>
}

function AdminOverview({ entrepreneurs, orders, requests = [], setPage }) {
  const activeEntrepreneurs = entrepreneurs.filter(
    person => person.active !== false && person.stage !== 'Departed',
  )
  const deliveredOrders = orders.filter(order => order.status === 'Delivered')
  const openOrders = orders.filter(
    order => !['Delivered', 'Returned', 'Rejected', 'Cancelled'].includes(order.status),
  )
  const dropshipOrders = deliveredOrders.filter(order => order.orderMode === 'dropship')
  const customerPayments = deliveredOrders.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0,
  )
  const commissions = dropshipOrders.reduce(
    (sum, order) => sum + Number(order.entrepreneurMargin || 0),
    0,
  )
  const paidCommissions = dropshipOrders
    .filter(order => order.payoutStatus === 'paid')
    .reduce((sum, order) => sum + Number(order.entrepreneurMargin || 0), 0)
  const pendingCommissions = dropshipOrders
    .filter(order => order.payoutStatus === 'pending_transfer')
    .reduce((sum, order) => sum + Number(order.entrepreneurMargin || 0), 0)
  const camyEarnings = Math.max(0, customerPayments - commissions)
  const creditInUse = activeEntrepreneurs.reduce(
    (sum, person) => sum + Number(person.used || 0),
    0,
  )
  const accountsUsingCredit = activeEntrepreneurs.filter(
    person => Number(person.used || 0) > 0,
  ).length
  const dispatchedOrders = orders.filter(order => order.status === 'Dispatched').length

  const tasks = [
    {
      Icon: WalletCards,
      count: orders.filter(order => order.orderMode === 'dropship' && order.payoutStatus === 'pending_transfer').length,
      title: 'Commission payments ready',
      description: 'Pay entrepreneur commissions and add payment proof.',
      page: 'payouts',
    },
    {
      Icon: PackageOpen,
      count: requests.filter(item => item.status === 'Pending').length,
      title: 'Stock requests to review',
      description: 'Check the account credit and available stock.',
      page: 'stock-supply',
    },
    {
      Icon: PackageCheck,
      count: requests.filter(item => item.status === 'Approved').length,
      title: 'Stock ready to send',
      description: 'Send the approved stock requests.',
      page: 'stock-supply',
    },
    {
      Icon: Truck,
      count: orders.filter(item => item.status === 'Processing').length,
      title: 'Orders to prepare',
      description: 'Prepare customer orders for delivery.',
      page: 'admin-orders',
    },
  ].filter(task => task.count > 0)
  const taskCount = tasks.reduce((sum, task) => sum + task.count, 0)

  return <div className="content-page admin-overview-clean">
    <section className="overview-welcome">
      <div>
        <span>ADMIN DASHBOARD</span>
        <h1>Today at CAMY</h1>
        <p>See the latest totals and tasks that need your attention.</p>
      </div>
      <button type="button" onClick={() => setPage('admin-orders')}>
        View orders <ArrowRight />
      </button>
    </section>
    <section className="metric-row overview-shortcuts">
      <Metric icon={UsersRound} label="Active entrepreneurs" value={activeEntrepreneurs.length} detail="Active entrepreneur accounts" tone="purple" onClick={() => setPage('entrepreneurs')} />
      <Metric icon={CircleDollarSign} label="Customer payments" value={shortMoney(customerPayments)} detail={`From ${deliveredOrders.length} delivered orders`} onClick={() => setPage('reports')} />
      <Metric icon={WalletCards} label="Credit in use" value={money(creditInUse)} detail={`${accountsUsingCredit} accounts are using credit`} tone="gold" onClick={() => setPage('credit-control')} />
      <Metric icon={Truck} label="Open orders" value={openOrders.length} detail={`${dispatchedOrders} sent for delivery`} tone="green" onClick={() => setPage('admin-orders')} />
    </section>
    <section className="overview-essential-grid">
      <article className="overview-money-card">
        <header>
          <div><span>DELIVERED ORDER PAYMENTS</span><h2>Payment summary</h2></div>
          <button onClick={() => setPage('payouts')}>Pay commissions <ArrowRight /></button>
        </header>
        <div>
          <button onClick={() => setPage('reports')}><small>CUSTOMER PAYMENTS RECEIVED</small><strong>{money(customerPayments)}</strong><span>View report <ChevronRight /></span></button>
          <button onClick={() => setPage('reports')}><small>CAMY EARNINGS</small><strong>{money(camyEarnings)}</strong><span>After commissions <ChevronRight /></span></button>
          <button onClick={() => setPage('payouts')}><small>ENTREPRENEUR COMMISSIONS</small><strong>{money(commissions)}</strong><span>{money(paidCommissions)} paid · {money(pendingCommissions)} to pay <ChevronRight /></span></button>
        </div>
      </article>
      <article className="card overview-tasks">
        <header><div><span>TASKS TO DO</span><h2>What needs your attention</h2></div><b>{taskCount}</b></header>
        {tasks.length ? tasks.map(({ Icon, count, title, description, page: targetPage }) => (
          <button type="button" key={title} onClick={() => setPage(targetPage)}>
            <i><Icon /></i>
            <span><strong>{count} {title}</strong><small>{description}</small></span>
            <ChevronRight />
          </button>
        )) : <div className="overview-all-clear"><Check /><span><strong>Everything is up to date</strong><small>There are no tasks waiting for you.</small></span></div>}
      </article>
    </section>
  </div>
}

function LegacyAdminOrders({ orders, setOrders, openOrder, onUpdateStatus, products, entrepreneurs, onManualOrder }) {
  const [search,setSearch]=useState(''); const [filter,setFilter]=useState('All'); const [fromDate,setFromDate]=useState(''); const [toDate,setToDate]=useState(''); const [quickDate,setQuickDate]=useState('all'); const [manualOrder,setManualOrder]=useState(false)
  useEffect(()=>{const done=()=>setManualOrder(false);window.addEventListener('camy-manual-order-created',done);return()=>window.removeEventListener('camy-manual-order-created',done)},[])
  const dateValue=date=>date.toISOString().slice(0,10)
  const applyQuickDate=range=>{const today=new Date(); const end=dateValue(today); let start=''; if(range==='today')start=end; if(range==='week'){const week=new Date(today);week.setDate(today.getDate()-6);start=dateValue(week)} if(range==='month')start=dateValue(new Date(today.getFullYear(),today.getMonth(),1));setFromDate(start);setToDate(range==='all'?'':end);setQuickDate(range)}
  const visible=orders.filter(o=>(filter==='All'||o.status===filter)&&(!fromDate||o.date>=fromDate)&&(!toDate||o.date<=toDate)&&`${o.id} ${o.invoiceNumber||''} ${o.customer} ${o.phone||''} ${o.entrepreneur} ${o.product}`.toLowerCase().includes(search.trim().toLowerCase()))
  const updateStatus=(id,status)=>onUpdateStatus?onUpdateStatus(id,status):setOrders(old=>old.map(o=>o.id===id?{...o,status}:o))
  const clearFilters=()=>{setSearch('');setFilter('All');setFromDate('');setToDate('');setQuickDate('all')}
  return <div className="content-page admin-orders-page"><PageTitle eyebrow="OPERATIONS" title="Manage every customer order" text="Search, inspect product details, and update fulfilment from one clear workspace."><><Button icon={Plus} onClick={()=>setManualOrder(true)}>Create assisted order</Button><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-admin-orders.xlsx',visible)}>Download Excel</Button></></PageTitle><ReturnAttention orders={orders} onOpen={()=>setFilter('Return requests')}/><div className="order-filter-shell"><div className="management-filters"><label><Search /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Order, invoice reference, customer, or product" /></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="All">All statuses</option><option>Pending</option><option>Awaiting payment</option><option>Payment review</option><option>Rejected</option><option>Processing</option><option>Dispatched</option><option>Delivered</option><option>Returned</option><option>Return requests</option></select></div><div className="date-filter-row"><div className="date-quick-filters">{[['all','All dates'],['today','Today'],['week','Last 7 days'],['month','This month']].map(([value,label])=><button className={quickDate===value?'active':''} key={value} onClick={()=>applyQuickDate(value)}>{label}</button>)}</div><div className="date-inputs"><label>From<input type="date" value={fromDate} onChange={e=>{setFromDate(e.target.value);setQuickDate('custom')}} /></label><label>To<input type="date" value={toDate} onChange={e=>{setToDate(e.target.value);setQuickDate('custom')}} /></label><button className="clear-order-filters" onClick={clearFilters}>Clear filters</button></div></div><div className="order-filter-summary"><span><strong>{visible.length}</strong> of {orders.length} orders shown</span><span>Open an order to manage payment, dispatch, delivery, returns, and payouts.</span></div></div><article className="card table-card"><OrderTable orders={visible} admin updateStatus={updateStatus} onOpen={openOrder} />{!visible.length&&<Empty icon={PackageSearch} title={orders.length?'No orders match these filters':'No customer orders yet'} text={orders.length?'Clear the filters or try another search.':'Create an assisted order, or wait for an entrepreneur to place a client order.'} />}</article>{manualOrder&&<ManualOrderModal products={products} entrepreneurs={entrepreneurs} close={()=>setManualOrder(false)} submit={form=>{if(onManualOrder(form)!==false)setManualOrder(false)}} />}</div>
}

function AdminOrders({ orders, openOrder, products, entrepreneurs, onManualOrder }) {
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('All')
  const [fromDate,setFromDate]=useState('')
  const [toDate,setToDate]=useState('')
  const [quickDate,setQuickDate]=useState('all')
  const [manualOrder,setManualOrder]=useState(false)
  const [creating,setCreating]=useState(false)
  const dateValue=date=>date.toISOString().slice(0,10)
  const applyQuickDate=range=>{
    const today=new Date(); const end=dateValue(today); let start=''
    if(range==='today')start=end
    if(range==='week'){const week=new Date(today);week.setDate(today.getDate()-6);start=dateValue(week)}
    if(range==='month')start=dateValue(new Date(today.getFullYear(),today.getMonth(),1))
    setFromDate(start);setToDate(range==='all'?'':end);setQuickDate(range)
  }
  const matchesOrderFilter=order=>filter==='All'
    || (filter==='In progress'&&!['Delivered','Returned','Rejected','Cancelled'].includes(order.status))
    || (filter==='Payouts pending'&&['pending_delivery','pending_transfer'].includes(order.payoutStatus))
    || order.status===filter
  const visible=orders.filter(order=>matchesOrderFilter(order)&&(!fromDate||order.date>=fromDate)&&(!toDate||order.date<=toDate)&&`${order.id} ${order.invoiceNumber||''} ${order.customer} ${order.phone||''} ${order.entrepreneur} ${order.product}`.toLowerCase().includes(search.trim().toLowerCase()))
  const filtersActive=Boolean(search||filter!=='All'||fromDate||toDate||quickDate!=='all')
  const clearFilters=()=>{setSearch('');setFilter('All');setFromDate('');setToDate('');setQuickDate('all')}
  const createOrder=async form=>{
    if(creating)return
    setCreating(true)
    try { if(await onManualOrder(form))setManualOrder(false) }
    finally { setCreating(false) }
  }
  return <div className="content-page admin-orders-page">
    <PageTitle eyebrow="ORDER OPERATIONS" title="Orders" text="Manage COD orders, delivery, payments, and entrepreneur payouts from one workspace."><><Button icon={Plus} onClick={()=>setManualOrder(true)}>New assisted order</Button><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-admin-orders.xlsx',visible)}>Download Excel</Button></></PageTitle>
    <section className="admin-order-summary">
      {[[ReceiptText,orders.length,'All orders','Complete history','All'],[Truck,orders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status)).length,'In progress','Needs follow-up','In progress'],[PackageCheck,orders.filter(order=>order.status==='Delivered').length,'Delivered','Completed successfully','Delivered'],[CircleDollarSign,orders.filter(order=>['pending_delivery','pending_transfer'].includes(order.payoutStatus)).length,'Payouts pending','After COD collection','Payouts pending']].map(([Icon,value,label,detail,valueFilter])=><article className={filter===valueFilter?'active':''} key={label} role="button" tabIndex="0" aria-label={`Show ${label.toLowerCase()}`} aria-pressed={filter===valueFilter} onClick={()=>setFilter(valueFilter)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setFilter(valueFilter)}}}><span><Icon/></span><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></article>)}
    </section>
    <div className="order-filter-shell">
      <header className="order-filter-heading"><div><span>ORDER DIRECTORY</span><h2>Find and manage orders</h2><p>Search by invoice reference, customer, seller, product, or order information.</p></div><button type="button" className="clear-order-filters" disabled={!filtersActive} onClick={clearFilters}><X/> Reset filters</button></header>
      <div className="management-filters">
        <div className="order-filter-field order-search-field"><label htmlFor="admin-order-search">Search orders</label><div className={search?'has-value':''}><span className="order-search-icon"><Search/></span><input id="admin-order-search" type="search" autoComplete="off" aria-label="Search orders by order, invoice reference, customer, phone, entrepreneur, or product" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Try an order ID, customer, phone, or product"/>{search&&<button type="button" className="order-search-clear" aria-label="Clear order search" onClick={()=>setSearch('')}><X/></button>}</div></div>
        <label className="order-filter-field"><span>Status</span><select aria-label="Filter by order status" value={filter} onChange={event=>setFilter(event.target.value)}><option value="All">All statuses</option><option>In progress</option><option>Processing</option><option>Dispatched</option><option>Delivered</option><option>Returned</option><option>Rejected</option><option>Payouts pending</option></select></label>
      </div>
      <div className="date-filter-row"><div className="date-range-shortcuts"><span>Date range</span><div className="date-quick-filters">{[['all','All dates'],['today','Today'],['week','Last 7 days'],['month','This month']].map(([value,label])=><button type="button" className={quickDate===value?'active':''} aria-pressed={quickDate===value} key={value} onClick={()=>applyQuickDate(value)}>{label}</button>)}</div></div><div className="date-inputs"><label>From<input aria-label="Orders from date" type="date" value={fromDate} onChange={event=>{setFromDate(event.target.value);setQuickDate('custom')}}/></label><label>To<input aria-label="Orders to date" type="date" min={fromDate} value={toDate} onChange={event=>{setToDate(event.target.value);setQuickDate('custom')}}/></label></div></div>
      <div className="order-filter-summary"><span><strong>{visible.length}</strong> of {orders.length} orders shown</span><span>Status changes are guided inside each order to prevent fulfilment mistakes.</span></div>
    </div>
    <article className="card table-card"><header className="order-directory-heading"><div><span>ORDER DIRECTORY</span><h2>Customer orders</h2></div><b>{visible.length} {visible.length===1?'order':'orders'}</b></header><OrderTable orders={visible} admin onOpen={openOrder}/>{!visible.length&&<Empty icon={PackageSearch} title={orders.length?'No orders match these filters':'No customer orders yet'} text={orders.length?'Clear the filters or try another search.':'Create an assisted order, or wait for an entrepreneur to place a client order.'}/>}</article>
    {manualOrder&&<ManualOrderModal products={products} entrepreneurs={entrepreneurs} close={()=>!creating&&setManualOrder(false)} submit={createOrder} saving={creating}/>}
  </div>
}

function LegacyManualOrderModal({ products, entrepreneurs, close, submit }) {
  const available=products.filter(product=>product.stock>0); const [form,setForm]=useState({entrepreneurId:entrepreneurs[0]?.id||'',productId:available[0]?.id||'',qty:1,unitPrice:available[0]?.price||0,customer:'',phone:'',address:'',district:'Kurunegala',source:'Phone call',notes:''}); const product=products.find(item=>String(item.id)===String(form.productId)); const update=(key,value)=>setForm(old=>({...old,[key]:value})); const selectProduct=value=>{const chosen=products.find(item=>String(item.id)===String(value));setForm(old=>({...old,productId:value,unitPrice:chosen?.price||0,qty:1}))}; const total=Number(form.qty||0)*Number(form.unitPrice||0); const discount=product?Math.max(0,product.price*Number(form.qty||0)-total):0
  return <Modal onClose={close} wide><form className="form-modal manual-order-form" onSubmit={event=>{event.preventDefault();submit({...form,qty:Number(form.qty),unitPrice:Number(form.unitPrice)})}}><div className="manual-order-heading"><span><Headphones /></span><div><small>ADMIN ASSISTED ORDER</small><h2>Record a phone or walk-in order</h2><p>Use this when a customer or entrepreneur cannot place the order online.</p></div></div><section><h3>1. Order owner and product</h3><div className="two-fields"><label>CAMY entrepreneur<select required value={form.entrepreneurId} onChange={event=>update('entrepreneurId',event.target.value)}>{entrepreneurs.map(person=><option value={person.id} key={person.id}>{person.name} · {person.id}</option>)}</select></label><label>Order source<select value={form.source} onChange={event=>update('source',event.target.value)}><option>Phone call</option><option>WhatsApp</option><option>Walk-in</option><option>Admin assisted</option></select></label></div><label>Product<select required value={form.productId} onChange={event=>selectProduct(event.target.value)}>{available.map(item=><option value={item.id} key={item.id}>{item.name} · {item.stock} in stock</option>)}</select></label><div className="manual-product-summary">{product&&<><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.code} · Standard price {money(product.price)}</small></span><b>{product.stock} available</b></>}</div><div className="two-fields"><label>Quantity<input required min="1" max={product?.stock||1} type="number" value={form.qty} onFocus={event=>event.target.select()} onChange={event=>update('qty',event.target.value)} /></label><label>Price per item / special price<input required min="0" type="number" value={form.unitPrice} onFocus={event=>event.target.select()} onChange={event=>update('unitPrice',event.target.value)} /></label></div></section><section><h3>2. Customer and delivery</h3><div className="two-fields"><label>Customer name<input required value={form.customer} onChange={event=>update('customer',event.target.value)} /></label><label>Phone number<input required value={form.phone} onChange={event=>update('phone',event.target.value)} placeholder="07X XXX XXXX" /></label></div><div className="two-fields"><label>District<input required value={form.district} onChange={event=>update('district',event.target.value)} /></label><label>Delivery address<input required value={form.address} onChange={event=>update('address',event.target.value)} /></label></div><label>Internal notes<textarea rows="2" value={form.notes} onChange={event=>update('notes',event.target.value)} placeholder="Call instructions, preferred delivery time, or other notes" /></label></section><footer className="manual-order-total"><div><small>ORDER TOTAL</small><strong>{money(total)}</strong>{discount>0&&<span>Special discount: {money(discount)}</span>}</div><button type="button" onClick={close}>Cancel</button><Button type="submit" disabled={!available.length||!form.customer||!form.phone||!form.address} icon={Check}>Confirm manual order</Button></footer></form></Modal>
}

function SingleManualOrderModal({ products, entrepreneurs, close, submit }) {
  const available=products.filter(item=>item.stock>0); const [entrepreneurSearch,setEntrepreneurSearch]=useState(''); const [showPeople,setShowPeople]=useState(true); const [productSearch,setProductSearch]=useState(''); const [form,setForm]=useState({entrepreneurId:'',productId:'',qty:'1',unitPrice:'',customer:'',phone:'',address:'',district:'Kurunegala',source:'Phone call',notes:''}); const update=(key,value)=>setForm(old=>({...old,[key]:value})); const entrepreneur=entrepreneurs.find(person=>person.id===form.entrepreneurId); const product=products.find(item=>String(item.id)===String(form.productId)); const people=entrepreneurs.filter(person=>`${person.name} ${person.id} ${person.phone} ${person.nic} ${person.city}`.toLowerCase().includes(entrepreneurSearch.toLowerCase())).slice(0,8); const productResults=available.filter(item=>`${item.name} ${item.code} ${item.category}`.toLowerCase().includes(productSearch.toLowerCase())).slice(0,8); const choosePerson=person=>{update('entrepreneurId',person.id);setEntrepreneurSearch(`${person.name} · ${person.id}`);setShowPeople(false)}; const chooseProduct=item=>{setForm(old=>({...old,productId:item.id,unitPrice:String(item.price),qty:'1'}));setProductSearch(`${item.name} · ${item.code}`)}; const quantity=Number(form.qty||0); const price=Number(form.unitPrice||0); const total=quantity*price; const standardTotal=(product?.price||0)*quantity; const discount=Math.max(0,standardTotal-total); const valid=entrepreneur&&product&&quantity>0&&quantity<=product.stock&&price>=0&&form.customer.trim()&&form.phone.trim()&&form.address.trim()
  return <Modal onClose={close} wide><form className="manual-order-v2" onSubmit={async event=>{event.preventDefault();if(valid)await submit({...form,qty:quantity,unitPrice:price})}}><header className="manual-order-heading"><span><Headphones /></span><div><small>CAMY COD ORDER</small><h2>Create an assisted order</h2><p>CAMY collects the full client price on delivery, then transfers the entrepreneur's margin with recorded proof.</p></div></header><div className="manual-order-progress"><span className={entrepreneur?'done':'active'}><i>{entrepreneur?<Check />:1}</i> Entrepreneur</span><span className={product?'done':entrepreneur?'active':''}><i>{product?<Check />:2}</i> Product & margin</span><span className={valid?'done':product?'active':''}><i>{valid?<Check />:3}</i> Customer</span></div><section className="manual-step"><div className="manual-step-title"><i>1</i><div><h3>Find the entrepreneur who made the sale</h3><p>The calculated margin belongs to this entrepreneur.</p></div></div><div className="smart-picker"><label><Search /><input value={entrepreneurSearch} onFocus={()=>setShowPeople(true)} onChange={event=>{setEntrepreneurSearch(event.target.value);setShowPeople(true);update('entrepreneurId','')}} placeholder="Type name, CE-0194, phone, NIC, or city..." /></label>{showPeople&&entrepreneurSearch&&<div className="smart-results">{people.map(person=><button type="button" key={person.id} onClick={()=>choosePerson(person)}><i>{person.initials}</i><span><strong>{person.name}</strong><small>{person.id} · {person.phone} · {person.city}</small></span><Status value={person.stage}/></button>)}{!people.length&&<p>No registered entrepreneur found.</p>}</div>}</div>{entrepreneur&&<div className="selected-entrepreneur"><span>{entrepreneur.initials}</span><div><small>COMMISSION WILL BE PAID TO</small><strong>{entrepreneur.name}</strong><p>{entrepreneur.id} · {entrepreneur.phone} · {entrepreneur.city}</p></div><BadgeCheck /></div>}</section><section className="manual-step"><div className="manual-step-title"><i>2</i><div><h3>Select the product and client selling price</h3><p>The entrepreneur may choose any selling price at or above the fixed CAMY product price.</p></div></div><div className="smart-picker"><label><Search /><input value={productSearch} onChange={event=>{setProductSearch(event.target.value);update('productId','')}} placeholder="Search product name, model code, or category..." /></label>{productSearch&&!product&&<div className="smart-results product-results">{productResults.map(item=><button type="button" key={item.id} onClick={()=>chooseProduct(item)}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.code} · CAMY price {money(item.price)}</small></span><b>{item.stock} in stock</b></button>)}{!productResults.length&&<p>No available product found.</p>}</div>}</div>{product&&<div className="selected-product"><img src={product.image} alt={product.name} /><div><small>{product.category} · {product.code}</small><strong>{product.name}</strong><p>CAMY price {money(product.price)} · {product.stock} available</p></div><button type="button" onClick={()=>{update('productId','');setProductSearch('')}}>Change</button></div>}<div className="manual-price-grid"><label>Quantity<input min="1" max={product?.stock||1} type="number" value={form.qty} onFocus={event=>event.target.select()} onChange={event=>update('qty',event.target.value)} /></label><label>Client selling price / item<input min={product?.price||0} type="number" value={form.unitPrice} onFocus={event=>event.target.select()} onChange={event=>update('unitPrice',event.target.value)} /></label><label>Order source<select value={form.source} onChange={event=>update('source',event.target.value)}><option>Phone call</option><option>WhatsApp</option><option>Walk-in</option><option>Admin assisted</option></select></label></div>{product&&price<Number(product.price)&&<p className="form-error">Client price cannot be lower than the CAMY price of {money(product.price)}.</p>}{product&&quantity>product.stock&&<p className="form-error">Only {product.stock} units are currently available.</p>} {product&&price>=Number(product.price)&&<div className="manual-money-preview"><span><small>CAMY product cost</small><strong>{money(Number(product.price)*quantity)}</strong></span><span><small>Client COD total</small><strong>{money(total)}</strong></span><span><small>Entrepreneur commission</small><strong>{money((price-Number(product.price))*quantity)}</strong></span></div>}</section><section className="manual-step"><div className="manual-step-title"><i>3</i><div><h3>Customer and delivery details</h3><p>CAMY collects the full selling price from this client through Cash on Delivery.</p></div></div><div className="manual-customer-grid"><label>Customer name<input required value={form.customer} onChange={event=>update('customer',event.target.value)} placeholder="Full name" /></label><label>Phone number<input required value={form.phone} onChange={event=>update('phone',event.target.value)} placeholder="07X XXX XXXX" /></label><label>District<input required value={form.district} onChange={event=>update('district',event.target.value)} /></label><label>Delivery address<input required value={form.address} onChange={event=>update('address',event.target.value)} placeholder="House number, street, town" /></label><label className="wide">Internal notes<textarea rows="2" value={form.notes} onChange={event=>update('notes',event.target.value)} placeholder="Call instructions, preferred delivery time, or special notes" /></label></div></section><footer className="manual-order-total"><div><small>CLIENT PAYS CAMY BY COD</small><strong>{money(total)}</strong>{product&&price>=Number(product.price)&&<span>Entrepreneur earns {money((price-Number(product.price))*quantity)} after successful delivery</span>}</div><button type="button" onClick={close}>Cancel</button><Button type="submit" disabled={!valid||price<Number(product?.price||0)} icon={Check}>Create COD order</Button></footer></form></Modal>
}

function AdminProducts(props) {
  const { products, setProducts, notify } = props
  const [showImport, setShowImport] = useState(false)
  const [categoryFilter,setCategoryFilter]=useState('All')
  const categories = [...new Set([
    ...JSON.parse(localStorage.getItem('camy-product-categories-v2') || '[]'),
    ...products.map(product => product.category),
  ].filter(Boolean))]

  const importProducts = imported => {
    setProducts(current => {
      const next = [...current]
      let nextId = Math.max(999, ...current.map(product => Number(product.id) || 0)) + 1

      for (const product of imported) {
        const index = next.findIndex(item => String(item.code).trim().toLowerCase() === String(product.code).trim().toLowerCase())
        if (index >= 0) next[index] = { ...next[index], ...product, id: next[index].id }
        else next.push({ ...product, id: nextId++ })
      }
      return next
    })
    notify(`${imported.length} product${imported.length === 1 ? '' : 's'} imported. Review them, then click Save catalogue changes.`)
  }

  return <div className="admin-products-shell">
    <AdminProductsCatalogue {...props} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} allCategories={categories} openImport={() => setShowImport(true)} />
    {showImport && <ProductBulkImport products={products} categories={categories} onImport={importProducts} onClose={() => setShowImport(false)} />}
  </div>
}

function AdminProductsCatalogue({ products, setProducts, openProduct, openAdd, openAddCategory, notify, categoryFilter='All', setCategoryFilter, allCategories=[], openImport }) {
  const [search,setSearch]=useState(''); const [categoryList,setCategoryList]=useStoredState('camy-product-categories-v2',['Cookware','Home Appliances','Electronics']); const [categoryEditor,setCategoryEditor]=useState(null); const visible=products.filter(p=>`${p.name} ${p.code} ${p.category}`.toLowerCase().includes(search.toLowerCase()))
  useEffect(() => { const refresh=()=>setCategoryList(JSON.parse(localStorage.getItem('camy-product-categories-v2')||'[]')); window.addEventListener('camy-categories-updated',refresh); return () => window.removeEventListener('camy-categories-updated',refresh) }, [setCategoryList])
  const stock=(id,delta)=>setProducts(old=>old.map(p=>p.id===id?{...p,stock:Math.max(0,p.stock+delta)}:p))
  const togglePublished=product=>{const published=(product.published??true)===true;setProducts(old=>old.map(item=>item.id===product.id?{...item,published:!published}:item));notify(`${product.name} marked ${published?'Hidden':'Live'}. Save catalogue changes to publish this update.`)}
  const categories=[...new Set([...categoryList,...products.map(p=>p.category)].filter(Boolean))].filter(category=>categoryFilter==='All'||category===categoryFilter)
  const saveCategoryName=(category,nextName)=>{const next=nextName.trim();if(!next){notify('Enter a category name');return false}if(next.toLowerCase()!==category.toLowerCase()&&categories.some(item=>item.toLowerCase()===next.toLowerCase())){notify('That category already exists');return false}setCategoryList(old=>[...new Set([...old.filter(item=>item!==category),next])]);setProducts(old=>old.map(product=>product.category===category?{...product,category:next}:product));notify(`${category} renamed to ${next}`);setCategoryEditor(null);return true}
  const deleteCategory=(category,moveTo)=>{const affected=products.filter(product=>product.category===category);if(affected.length&&!moveTo){notify('Choose a destination for the products first');return}setProducts(old=>old.map(product=>product.category===category?{...product,category:moveTo}:product));setCategoryList(old=>old.filter(item=>item!==category));notify(affected.length?`${category} deleted · ${affected.length} product${affected.length===1?'':'s'} moved to ${moveTo}`:`${category} deleted`);setCategoryEditor(null)}
  return <><AdminInventory products={products} visible={visible} categories={categories} allCategories={allCategories} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} search={search} setSearch={setSearch} openAdd={openAdd} openAddCategory={openAddCategory} openImport={openImport} openProduct={openProduct} stock={stock} togglePublished={togglePublished} manageCategory={setCategoryEditor} exportProducts={()=>exportReport('camy-products.xlsx',products.map(product=>({...product,...productCosts(product)})))}/>{categoryEditor&&<CategoryManagerModal category={categoryEditor} categories={categories} products={products} close={()=>setCategoryEditor(null)} rename={saveCategoryName} remove={deleteCategory}/>}</>
}

function OrderTable({ orders, onOpen, admin=false }) {
  const steps=['Processing','Dispatched','Delivered']
  return <div className={`data-table order-table ${admin?'admin-order-table':''}`}>
    {admin
      ? <div className="data-row head"><span>Order</span><span>Entrepreneur</span><span>Client</span><span>Delivery</span><span>Money</span><span>Fulfilment</span><span>Commission</span><span>Action</span></div>
      : <div className="data-row head"><span>Order</span><span>Customer & product</span><span>Placed</span><span>Value</span><span>Your profit</span><span>Progress</span><span>Details</span></div>}
    {orders.map(order=>{
      const step=steps.indexOf(order.status)
      const days=Math.max(0,Math.floor((Date.now()-new Date(order.date).getTime())/86400000))
      const terminal=['Returned','Rejected','Cancelled'].includes(order.status)
      const commissionAmount=Number(order.entrepreneurMargin||0)
      const commissionStatus=order.status==='Delivered'?(order.payoutStatus==='paid'?`Commission paid · ${money(commissionAmount)}`:order.payoutStatus==='not_required'?'No commission due':`Commission pending · ${money(commissionAmount)}`):''
      const adminCommission=order.payoutStatus==='paid'
        ? {key:'paid',label:'Paid'}
        : {key:'waiting',label:'Not paid'}
      if(admin)return <div className={`data-row order-row status-${String(order.status||'').toLowerCase().replaceAll(' ','-')}`} key={order.id}>
        <span className="order-id-cell"><i><PackageOpen/></i><span><strong>{order.id}</strong><small>{order.orderMode==='dropship'?'COD dropship':'CAMY order'} · {displayDate(order.date)}</small></span></span>
        <span className="admin-order-person"><strong>{order.entrepreneur||'Not assigned'}</strong><small>{order.entrepreneurId||'No member ID'}</small></span>
        <span className="admin-order-client"><strong>{order.customer||'Client not provided'}</strong><small><Phone/> {order.phone||'No phone'}</small><em>{order.product} × {order.qty}</em></span>
        <span className="admin-order-delivery"><strong>{order.district||'District not provided'}</strong><small><MapPin/> {order.address||'Delivery address not provided'}</small></span>
        <span className="admin-order-money"><strong>{money(order.amount)}</strong><small>CAMY {money(order.camyCost??order.amount)}</small><em>Margin {money(order.entrepreneurMargin||0)}</em></span>
        <span><div className="admin-order-status"><Status value={order.status}/>{order.status==='Returned'&&<small>Profit cancelled</small>}</div></span>
        <span className={`admin-commission-cell ${adminCommission.key}`}><strong><i/>{adminCommission.label}</strong></span>
        <button className="view-order-btn" onClick={()=>onOpen(order)} aria-label={`Manage ${order.id}`}><PackageSearch/><span>Manage</span></button>
      </div>
      return <div className={`data-row order-row status-${String(order.status||'').toLowerCase().replaceAll(' ','-')}`} key={order.id}>
        <span className="order-id-cell"><i><PackageOpen/></i><span><strong>{order.id}</strong><small>{order.source||'CAMY order'}</small></span></span>
        <span className="order-customer-cell"><strong>{order.customer}</strong><small>{order.product} × {order.qty}</small><em><Phone/> {order.phone}</em></span>
        <span className="order-date-cell"><strong>{displayDate(order.date)}</strong><small>{days===0?'Today':`${days} day${days===1?'':'s'} ago`}</small></span>
        <span className="order-value-cell"><strong>{money(order.amount)}</strong><small>{Number(order.qty||0)} unit{Number(order.qty||0)===1?'':'s'}</small></span>
        <span className={`order-profit-cell ${terminal?'not-earned':''}`}><strong>{terminal?'—':money(commissionAmount)}</strong><em className={`profit-status ${terminal?'not-eligible':order.status==='Delivered'?(order.payoutStatus==='paid'?'paid':'pending'):'delivery-pending'}`}><i/>{terminal?'No commission':order.status==='Delivered'?(order.payoutStatus==='paid'?'Commission paid':'Commission pending'):'Pending delivery'}</em></span>
        <span className="order-progress-cell"><div className="compact-progress"><Status value={order.status}/>{!terminal&&<div>{steps.map((item,index)=><i className={step>=index?'done':''} key={item}/>)}</div>}{commissionStatus&&<small className={`commission-table-status ${order.payoutStatus==='paid'?'paid':'pending'}`}>{commissionStatus}</small>}</div>{order.return&&<small className="return-table-status">Return {order.return.status}{order.return.refundStatus?` · ${order.return.refundStatus}`:''}</small>}</span>
        <button className="view-order-btn" onClick={()=>onOpen(order)} aria-label={`Open ${order.id}`}><PackageSearch/><span>{order.orderMode==='dropship'&&['Pending','Processing'].includes(order.status)?'View / edit':'View order'}</span></button>
      </div>
    })}
  </div>
}

function ManualOrderModal({ products, entrepreneurs, close, submit, saving=false }) {
  const available=products.filter(item=>item.stock>0&&(item.published??true)===true)
  const [entrepreneurId,setEntrepreneurId]=useState('')
  const [entrepreneurSearch,setEntrepreneurSearch]=useState('')
  const [productSearch,setProductSearch]=useState('')
  const [items,setItems]=useState([])
  const [customer,setCustomer]=useState({name:'',phone:'',district:'Kurunegala',address:'',notes:'',source:'Phone call'})
  const entrepreneur=entrepreneurs.find(person=>person.id===entrepreneurId)
  const people=entrepreneurs.filter(person=>person.active!==false&&person.stage!=='Departed'&&`${person.name} ${person.id} ${person.phone||''} ${person.city||''}`.toLowerCase().includes(entrepreneurSearch.toLowerCase())).slice(0,8)
  const results=available.filter(product=>!items.some(item=>String(item.productId)===String(product.id))&&`${product.name} ${product.code} ${product.category}`.toLowerCase().includes(productSearch.toLowerCase())).slice(0,8)
  const addProduct=product=>{setItems(old=>[...old,{productId:product.id,name:product.name,code:product.code,image:product.image,camyPrice:Number(product.price),deliveryCost:payableDeliveryCost(product),sellPrice:Number(product.price),qty:1,stock:Number(product.stock)}]);setProductSearch('')}
  const updateItem=(id,key,value)=>setItems(old=>old.map(item=>String(item.productId)===String(id)?{...item,[key]:value}:item))
  const removeItem=id=>setItems(old=>old.filter(item=>String(item.productId)!==String(id)))
  const productSubtotal=items.reduce((sum,item)=>sum+Number(item.camyPrice)*Number(item.qty||0),0)
  const deliveryTotal=items.reduce((sum,item)=>sum+Number(item.deliveryCost||0)*Number(item.qty||0),0)
  const camyCost=productSubtotal+deliveryTotal
  const clientTotal=items.reduce((sum,item)=>sum+Number(item.sellPrice||0)*Number(item.qty||0),0)+deliveryTotal
  const margin=clientTotal-camyCost
  const validItems=items.length&&items.every(item=>Number(item.qty)>0&&Number(item.qty)<=item.stock&&Number(item.sellPrice)>=item.camyPrice)
  const valid=entrepreneur&&validItems&&customer.name.trim()&&/^(?:\+94|0)7\d{8}$/.test(customer.phone.replace(/[\s-]/g,''))&&customer.district.trim()&&customer.address.trim()
  const save=event=>{event.preventDefault();if(!valid||saving)return;submit({entrepreneurId,items:items.map(({productId,qty,sellPrice})=>({productId,qty:Number(qty),sellPrice:Number(sellPrice)})),...customer})}
  return <Modal onClose={close} wide className="multi-order-modal admin-assisted-order"><form className="manual-order-v2 multi-order-form" onSubmit={save}>
    <header className="manual-order-heading"><span><ShoppingCart/></span><div><small>CAMY MULTI-PRODUCT COD ORDER</small><h2>Create an assisted client order</h2><p>Add multiple products, set the entrepreneur's selling price for each item, and confirm the combined commission before saving.</p></div></header>
    <section className="manual-step"><div className="manual-step-title"><i>1</i><div><h3>Select the entrepreneur</h3><p>All commission from this order will be transferred to the selected entrepreneur after delivery.</p></div></div><div className="smart-picker"><label><Search/><input value={entrepreneurSearch} onChange={event=>{setEntrepreneurSearch(event.target.value);setEntrepreneurId('')}} placeholder="Search member name, ID, phone, or city"/></label>{entrepreneurSearch&&!entrepreneur&&<div className="smart-results">{people.map(person=><button type="button" key={person.id} onClick={()=>{setEntrepreneurId(person.id);setEntrepreneurSearch(`${person.name} · ${person.id}`)}}><i>{person.initials||'CE'}</i><span><strong>{person.name}</strong><small>{person.id} · {person.phone||person.city}</small></span></button>)}</div>}</div>{entrepreneur&&<div className="selected-entrepreneur"><span>{entrepreneur.initials||'CE'}</span><div><small>COMMISSION RECIPIENT</small><strong>{entrepreneur.name}</strong><p>{entrepreneur.id} · {entrepreneur.phone||entrepreneur.city}</p></div><BadgeCheck/></div>}</section>
    <section className="manual-step"><div className="manual-step-title"><i>2</i><div><h3>Build the product basket</h3><p>Add as many available products as needed. Each product can have its own quantity and client selling price.</p></div></div><div className="smart-picker"><label><Search/><input value={productSearch} onChange={event=>setProductSearch(event.target.value)} placeholder="Search and add another product"/></label>{productSearch&&<div className="smart-results product-results">{results.map(product=><button type="button" key={product.id} onClick={()=>addProduct(product)}><img src={product.image} alt=""/><span><strong>{product.name}</strong><small>{product.code} · CAMY {money(product.price)}</small></span><b><Plus/> Add</b></button>)}{!results.length&&<p>No additional matching product.</p>}</div>}</div><div className="multi-order-items">{items.map(item=><article key={item.productId}><img src={item.image} alt=""/><div><strong>{item.name}</strong><small>{item.code} · CAMY {money(item.camyPrice)} each{Number(item.deliveryCost)>0?` + ${money(item.deliveryCost)} delivery`:''}</small></div><label>Quantity<input type="number" min="1" max={item.stock} value={item.qty} onChange={event=>updateItem(item.productId,'qty',event.target.value)}/><small>{item.stock} available</small></label><label>Client price / item<input type="number" min={item.camyPrice} value={item.sellPrice} onChange={event=>updateItem(item.productId,'sellPrice',event.target.value)}/><small>{Number(item.sellPrice)<item.camyPrice?'Below CAMY price':`Margin ${money((Number(item.sellPrice)-item.camyPrice)*Number(item.qty||0))}`}</small></label><strong>{money((Number(item.sellPrice||0)+Number(item.deliveryCost||0))*Number(item.qty||0))}</strong><button type="button" onClick={()=>removeItem(item.productId)} aria-label={`Remove ${item.name}`}><Trash2/></button></article>)}{!items.length&&<div className="multi-order-empty"><PackageSearch/><strong>No products added yet</strong><span>Search above to start the order.</span></div>}</div><div className="manual-money-preview"><span><small>Product subtotal</small><strong>{money(productSubtotal)}</strong></span><span><small>Delivery charges</small><strong>{deliveryTotal?money(deliveryTotal):'Free'}</strong></span><span><small>CAMY total</small><strong>{money(camyCost)}</strong></span><span><small>Client COD total</small><strong>{money(clientTotal)}</strong></span><span><small>Entrepreneur commission</small><strong>{money(Math.max(0,margin))}</strong></span></div></section>
    <section className="manual-step"><div className="manual-step-title"><i>3</i><div><h3>Customer and delivery</h3><p>CAMY collects the complete order total from this customer through Cash on Delivery.</p></div></div><div className="manual-customer-grid"><label>Customer name<input required value={customer.name} onChange={event=>setCustomer({...customer,name:event.target.value})}/></label><label>Phone number<input required value={customer.phone} onChange={event=>setCustomer({...customer,phone:event.target.value})} placeholder="07X XXX XXXX"/></label><label>District<input required value={customer.district} onChange={event=>setCustomer({...customer,district:event.target.value})}/></label><label>Delivery address<input required value={customer.address} onChange={event=>setCustomer({...customer,address:event.target.value})}/></label><label>Order source<select value={customer.source} onChange={event=>setCustomer({...customer,source:event.target.value})}><option>Phone call</option><option>WhatsApp</option><option>Walk-in</option><option>Admin assisted</option></select></label><label className="wide">Internal notes<textarea rows="2" value={customer.notes} onChange={event=>setCustomer({...customer,notes:event.target.value})}/></label></div></section>
    <footer className="manual-order-total"><div><small>CLIENT PAYS CAMY BY COD</small><strong>{money(clientTotal)}</strong><span>{items.length} product{items.length===1?'':'s'} · Entrepreneur earns {money(Math.max(0,margin))}</span></div><button type="button" disabled={saving} onClick={close}>Cancel</button><Button type="submit" disabled={!valid||saving} icon={Check}>{saving?'Creating order…':'Create COD order'}</Button></footer>
  </form></Modal>
}

function CategoryManagerModal({ category, categories, products, close, rename, remove }) {
  const [name,setName]=useState(category)
  const alternatives=categories.filter(item=>item!==category)
  const [destination,setDestination]=useState(alternatives[0]||'')
  const affected=products.filter(product=>product.category===category)
  return <Modal onClose={close}><div className="category-manager"><span className="modal-kicker">CATEGORY SETTINGS</span><h2>Manage {category}</h2><p>Rename this category or remove it without losing product records.</p><section><label>Category name<input autoFocus value={name} onChange={event=>setName(event.target.value)} /></label><Button icon={Check} disabled={!name.trim()||name.trim()===category} onClick={()=>rename(category,name)}>Save new name</Button></section><section className="category-delete-zone"><div><span><Trash2/></span><div><strong>Delete this category</strong><p>{affected.length?`${affected.length} product${affected.length===1?' is':'s are'} currently assigned here. Choose where to move ${affected.length===1?'it':'them'} first.`:'This category is empty and can be removed safely.'}</p></div></div>{affected.length>0&&alternatives.length>0&&<label>Move products to<select value={destination} onChange={event=>setDestination(event.target.value)}>{alternatives.map(item=><option key={item}>{item}</option>)}</select></label>}{affected.length>0&&!alternatives.length&&<p className="category-blocked-note">Create another category before deleting this one.</p>}<Button variant="secondary" icon={Trash2} disabled={affected.length>0&&!destination} onClick={()=>remove(category,destination)}>Delete category{affected.length>0?' and move products':''}</Button></section><button className="category-cancel" onClick={close}>Cancel</button></div></Modal>
}

function SettlementReviewModal({ item, person, request, settlements, products, close, review, updateCollection }) {
  const history=settlements.filter(entry=>String(entry.entrepreneurId||entry.memberId||entry.member_id)===String(item.entrepreneurId||item.memberId||item.member_id)&&String(entry.id)!==String(item.id)).sort((a,b)=>String(b.createdAt||b.created_at||b.date).localeCompare(String(a.createdAt||a.created_at||a.date)))
  const stockItems=request?.items||[]
  const units=stockItems.reduce((sum,entry)=>sum+Number(entry.qty||0),0)
  const orderAmount=Number(request?.creditIssuedAmount??request?.total??0)
  const amountMatches=Boolean(request)&&Math.abs(Number(item.amount||0)-orderAmount)<.01
  const cash=item.method==='cash'
  const cashCollected=item.collectionStatus==='collected'
  const availableProducts=products.length?products:(globalThis.__camyProducts||[])
  const productFor=entry=>availableProducts.find(product=>String(product.id)===String(entry.productId||entry.id)||String(product.code)===String(entry.productCode||entry.code))
  const act=action=>{review(item.id,action);close()}
  return <Modal onClose={close} wide className="settlement-review-modal"><div className="settlement-review-shell">
    <header className="settlement-review-hero"><span><ReceiptText/></span><div><small>PAYMENT VERIFICATION</small><h2>Review everything before approval</h2><p>Confirm the receipt, stock supplied, amount due, and the entrepreneur's previous repayment activity.</p></div><b>{item.status}</b></header>
    <section className="settlement-review-summary"><div className="settlement-review-person"><i>{initialsFor(person||{name:item.entrepreneurId})}</i><span><small>ENTREPRENEUR</small><strong>{person?.name||'Unknown entrepreneur'}</strong><p>{person?.id||item.entrepreneurId||'No member ID'}{person?.phone?` · ${person.phone}`:''}</p></span></div><dl><span><dt>Payment submitted</dt><dd>{money(item.amount)}</dd></span><span><dt>Current outstanding</dt><dd>{money(person?.used)}</dd></span><span><dt>Submitted on</dt><dd>{displayDate(item.createdAt||item.created_at||item.date)}</dd></span><span><dt>Payment method</dt><dd>{cash?'CAMY store cash':'Bank transfer'}</dd></span><span><dt>{cash?'Cash status':'Transfer reference'}</dt><dd>{cash?(cashCollected?'Collected at store':'Not collected yet'):(item.reference||'Not provided')}</dd></span><span><dt>Receipt</dt><dd>{item.receipt?<a href={item.receipt} target="_blank" rel="noreferrer"><ExternalLink/> Open receipt</a>:cash?'Store receipt issued after payment':'No attachment'}</dd></span></dl></section>
    {cash&&<section className={`admin-cash-collection ${cashCollected?'collected':'waiting'}`}><Store/><div><small>CAMY STORE CASH COLLECTION</small><strong>{cashCollected?'Cash collected':'Cash has not been collected'}</strong><p>{cashCollected?`The store confirmed receipt of ${money(item.amount)}${item.cashCollectedAt?` on ${displayDate(item.cashCollectedAt)}`:''}. You may now verify the repayment.`:`Do not verify yet. Receive exactly ${money(item.amount)}, check the member ID and payment ID ${item.id}, then mark it collected.`}</p></div><Button variant={cashCollected?'secondary':'primary'} onClick={()=>updateCollection(item.id,!cashCollected)}>{cashCollected?'Edit: mark not collected':'Mark cash collected'}</Button></section>}
    <div className="settlement-review-columns"><section className="settlement-stock-detail"><header><div><small>STOCK BEING PAID FOR</small><h3>{request?.id||item.requestId||item.request_id||'Stock request not found'}</h3><p>{request?`${stockItems.length} product${stockItems.length===1?'':'s'} · ${units} unit${units===1?'':'s'} · Dispatched ${displayDate(request.dispatchedAt||request.updatedAt||request.date)}`:'The linked stock request is unavailable. Do not verify until it is confirmed.'}</p></div><span className={amountMatches?'match':'warning'}>{amountMatches?<><BadgeCheck/> Amount matches</>:<><X/> Check amount</>}</span></header>
      {stockItems.length?<div className="settlement-stock-items">{stockItems.map((entry,index)=>{const product=productFor(entry);const qty=Number(entry.qty||0),price=Number(entry.price??entry.purchasePrice??product?.price??0);return <article key={`${entry.productId||entry.id||index}-${index}`}><img src={entry.image||product?.image||'/products/classic-set.png'} alt=""/><div><strong>{entry.name||product?.name||entry.productCode||entry.productId||'CAMY product'}</strong><small>{entry.code||product?.code||entry.productCode||'Product code unavailable'}</small></div><span><small>Quantity</small><strong>{qty}</strong></span><span><small>Unit price</small><strong>{money(price)}</strong></span><b>{money(qty*price)}</b></article>})}</div>:<div className="settlement-stock-empty"><PackageSearch/><p>No product lines are available for this request.</p></div>}
      <footer><span><small>Credit issued</small><strong>{money(orderAmount)}</strong></span><span><small>Payment submitted</small><strong>{money(item.amount)}</strong></span><span><small>Due date</small><strong>{displayDate(request?.creditDueAt||item.creditDueAt)}</strong></span></footer></section>
      <section className="settlement-past-history"><header><div><small>PAST PAYMENT HISTORY</small><h3>{history.length} earlier record{history.length===1?'':'s'}</h3></div><span>{history.filter(entry=>entry.status==='Verified').length} verified</span></header>{history.length?<div>{history.map(entry=><article key={entry.id}><span><strong>{money(entry.amount)}</strong><small>{entry.requestId||entry.request_id||'General settlement'}</small></span><span><Status value={entry.status==='Verified'?'Paid':entry.status||'Pending'}/><small>{displayDate(entry.createdAt||entry.created_at||entry.date)}</small></span>{entry.status==='Rejected'&&<p>{entry.rejectionReason||'Payment evidence was not accepted.'}</p>}</article>)}</div>:<div className="settlement-history-empty"><BadgeCheck/><strong>No previous repayments</strong><p>This is the entrepreneur's first payment submission.</p></div>}</section></div>
    <footer className="settlement-review-footer"><div><strong>Final check</strong><p>{cash?'Verify only after the store cash is marked collected and the stock total is confirmed.':'Verify only after the bank receipt and stock total are confirmed.'}</p></div><Button variant="secondary" onClick={()=>act('reject')}>Reject payment</Button><Button icon={Check} disabled={!request||!amountMatches||(cash&&!cashCollected)} onClick={()=>act('verify')}>Verify {money(item.amount)}</Button></footer>
  </div></Modal>
}

function CreditSettlements({ entrepreneurs, setEntrepreneurs, settlements=[], requests=[], products=[], reviewSettlement=()=>{}, updateCashCollection=()=>{}, notify }) {
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('All')
  const [settlementPerson,setSettlementPerson]=useState(null)
  const [payment,setPayment]=useState({requestId:'',amount:'',reference:''})
  const [paymentBusy,setPaymentBusy]=useState(false)
  const [paymentError,setPaymentError]=useState('')
  const [reviewItem,setReviewItem]=useState(null)
  const pending=settlements.filter(item=>item.status==='Pending verification')
  const verified=settlements.filter(item=>item.status==='Verified')
  const rejected=settlements.filter(item=>item.status==='Rejected')
  const personFor=item=>entrepreneurs.find(person=>String(person.id)===String(item.entrepreneurId||item.memberId||item.member_id))
  const unpaidOrders=person=>requests.filter(request=>String(request.entrepreneurId)===String(person.id)&&request.creditMode===true&&request.status==='Dispatched'&&request.creditRepaymentStatus!=='Paid'&&!settlements.some(item=>String(item.requestId||item.request_id)===String(request.id)&&item.status!=='Rejected'))
  const settle=person=>{const order=unpaidOrders(person)[0];setSettlementPerson(person);setPayment({requestId:order?.id||'',amount:String(order?.creditIssuedAmount??order?.total??''),reference:''});setPaymentError('')}
  const selectPaymentOrder=requestId=>{const order=unpaidOrders(settlementPerson).find(item=>String(item.id)===String(requestId));setPayment(current=>({...current,requestId,amount:String(order?.creditIssuedAmount??order?.total??'')}))}
  const recordPayment=async event=>{event.preventDefault();setPaymentBusy(true);setPaymentError('');try{const result=await api('/admin/credit-settlements',{method:'POST',body:JSON.stringify({...payment,memberId:settlementPerson.id})});setEntrepreneurs(result.state.entrepreneurs);setSettlementPerson(null);window.dispatchEvent(new Event('camy-business-updated'));notify('CAMY-store cash payment recorded and credit balance updated')}catch(reason){setPaymentError(reason.message)}finally{setPaymentBusy(false)}}
  const history=[...settlements].filter(item=>{const person=personFor(item);const haystack=`${person?.name||''} ${person?.id||''} ${item.reference||''} ${item.requestId||item.request_id||''}`.toLowerCase();return (status==='All'||item.status===status)&&haystack.includes(search.toLowerCase())}).sort((a,b)=>String(b.createdAt||b.created_at||b.date).localeCompare(String(a.createdAt||a.created_at||a.date)))
  const settledTotal=verified.reduce((sum,item)=>sum+Number(item.amount||0),0)
  const outstanding=entrepreneurs.reduce((sum,person)=>sum+Number(person.used||0),0)
  return <div className="content-page credit-settlements-page">
    {reviewItem&&<SettlementReviewModal item={reviewItem} person={personFor(reviewItem)} request={requests.find(request=>String(request.id)===String(reviewItem.requestId||reviewItem.request_id))} settlements={settlements} products={products} close={()=>setReviewItem(null)} review={reviewSettlement} updateCollection={async(id,collected)=>{const updated=await updateCashCollection(id,collected);if(updated)setReviewItem(updated)}}/>}
    {settlementPerson&&<Modal onClose={()=>{if(!paymentBusy)setSettlementPerson(null)}}><form className="form-modal" onSubmit={recordPayment}><span className="modal-kicker">VERIFIED CREDIT PAYMENT</span><h2>Settle a credit order</h2><p>{settlementPerson.name}: {money(settlementPerson.used)} outstanding. Record the full payment against the exact credit order.</p>{paymentError&&<p className="market-error" role="alert">{paymentError}</p>}{unpaidOrders(settlementPerson).length?<><label>Credit order<select required value={payment.requestId} onChange={event=>selectPaymentOrder(event.target.value)}>{unpaidOrders(settlementPerson).map(order=><option key={order.id} value={order.id}>{order.id} · {money(order.creditIssuedAmount??order.total)} · due {displayDate(order.creditDueAt)}</option>)}</select></label><label>Full amount received<input readOnly value={money(payment.amount)}/><small>Partial settlement is not allowed; this closes the selected credit order.</small></label><label>Bank or cash payment reference<input required maxLength={100} value={payment.reference} onChange={event=>setPayment({...payment,reference:event.target.value})}/></label><Button type="submit" disabled={paymentBusy||!payment.requestId}>{paymentBusy?'Recording...':'Confirm full payment'}</Button></>:<p className="workflow-note">No dispatched credit order is currently available to settle.</p>}</form></Modal>}
    <PageTitle eyebrow="CREDIT SETTLEMENTS" title="Credit repayment centre" text="Accept or reject submitted payments, record store payments, and review every entrepreneur's complete settlement history."><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-credit-settlements.xlsx',history)}>Export settlement history</Button></PageTitle>
    <section className="credit-health-grid settlement-metrics"><article><span><ReceiptText/></span><div><small>AWAITING REVIEW</small><strong>{pending.length}</strong><p>Payments requiring a decision</p></div></article><article><span><BadgeCheck/></span><div><small>VERIFIED SETTLEMENTS</small><strong>{money(settledTotal)}</strong><p>{verified.length} approved payment{verified.length===1?'':'s'}</p></div></article><article className="outstanding"><span><CalendarDays/></span><div><small>CREDIT OUTSTANDING</small><strong>{money(outstanding)}</strong><p>Across all entrepreneur accounts</p></div></article><article><span><X/></span><div><small>REJECTED SUBMISSIONS</small><strong>{rejected.length}</strong><p>Kept in the permanent history</p></div></article></section>
    <section className={`credit-review-panel ${pending.length?'has-pending':'clear'}`}><header><div><span>PAYMENT VERIFICATION</span><h2>Repayments awaiting a decision</h2><p>Open the full details to check payment evidence, stock items, and past repayment history before verifying.</p></div><b>{pending.length} pending</b></header>{pending.length?<div className="credit-review-list">{pending.map(item=>{const person=personFor(item);return <article key={item.id}><div className="credit-review-person"><i>{initialsFor(person||{name:item.entrepreneurId})}</i><span><strong>{person?.name||item.entrepreneurId}</strong><small>{person?.id||item.entrepreneurId} · Submitted {displayDate(item.createdAt||item.created_at||item.date)}</small></span></div><dl><span><dt>Amount</dt><dd>{money(item.amount)}</dd></span><span><dt>Method</dt><dd>{item.method==='cash'?`CAMY store cash · ${item.collectionStatus==='collected'?'Collected':'Not collected'}`:'Bank transfer'}</dd></span><span><dt>Reference</dt><dd>{item.reference||'Not provided'}</dd></span><span><dt>Stock request</dt><dd>{item.requestId||item.request_id||'General settlement'}</dd></span></dl><div className="credit-review-actions">{item.receipt&&<a className="btn soft" href={item.receipt} target="_blank" rel="noreferrer"><ReceiptText/> Receipt</a>}<Button variant="secondary" icon={Eye} onClick={()=>setReviewItem(item)}>View all details</Button><Button icon={Check} onClick={()=>setReviewItem(item)}>Review & verify</Button></div></article>})}</div>:<div className="credit-review-empty"><BadgeCheck/><div><strong>No repayments waiting</strong><p>New settlement submissions will appear here automatically.</p></div></div>}</section>
    <section className="credit-settlement-history"><header><div><span>COMPLETE AUDIT HISTORY</span><h2>Entrepreneur settlement history</h2><p>Every pending, accepted, and rejected credit payment is retained here.</p></div><b>{history.length} records</b></header><div className="credit-ledger-filters"><label><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search entrepreneur, member ID, reference, or order"/></label><select value={status} onChange={event=>setStatus(event.target.value)}><option>All</option><option>Pending verification</option><option>Verified</option><option>Rejected</option></select></div>{history.length?<div className="settlement-history-table"><div className="settlement-history-row head"><span>Entrepreneur</span><span>Payment</span><span>Order / reference</span><span>Submitted</span><span>Status</span><span>Evidence</span></div>{history.map(item=>{const person=personFor(item);return <article className="settlement-history-row" key={item.id}><div className="person"><i>{initialsFor(person||{name:item.entrepreneurId})}</i><span><strong>{person?.name||'Unknown entrepreneur'}</strong><small>{person?.id||item.entrepreneurId||'No member ID'}</small></span></div><span><strong>{money(item.amount)}</strong><small>{item.method==='cash'?'CAMY store cash':'Bank transfer'}</small></span><span><strong>{item.requestId||item.request_id||'General settlement'}</strong><small>{item.reference||'No reference'}</small></span><time>{displayDate(item.createdAt||item.created_at||item.date)}</time><Status value={item.status==='Verified'?'Paid':item.status||'Pending'}/><span>{item.receipt?<a href={item.receipt} target="_blank" rel="noreferrer"><ReceiptText/> Receipt</a>:<small>No attachment</small>}</span></article>})}</div>:<Empty icon={ReceiptText} title="No matching settlements" text="Change the search or status filter to view other records."/>}</section>
    <section className="credit-settlement-accounts"><header><div><span>RECORD STORE PAYMENT</span><h2>Entrepreneurs with outstanding credit</h2><p>Record a payment received directly by CAMY against its exact credit-stock order.</p></div></header><div>{entrepreneurs.filter(person=>Number(person.used||0)>0).map(person=><article key={person.id}><div className="person"><i>{initialsFor(person)}</i><span><strong>{person.name}</strong><small>{person.id} · {unpaidOrders(person).length} payable order{unpaidOrders(person).length===1?'':'s'}</small></span></div><b>{money(person.used)}</b><Button variant="soft" disabled={!unpaidOrders(person).length} onClick={()=>settle(person)}>{unpaidOrders(person).length?'Record payment':'Payment submitted'}</Button></article>)}</div></section>
  </div>
}

function CreditControl({ entrepreneurs, setEntrepreneurs, tiers, setTiers, settlements, requests, reviewSettlement, notify, onSave }) {
  return <EnhancedCreditControl entrepreneurs={entrepreneurs} setEntrepreneurs={setEntrepreneurs} tiers={tiers} setTiers={setTiers} settlements={settlements} requests={requests} reviewSettlement={reviewSettlement} notify={notify} onSave={onSave} />
}

function EnhancedCreditControl({ entrepreneurs, setEntrepreneurs, tiers, setTiers, settlements=[], requests=[], reviewSettlement=()=>{}, notify, onSave }) {
  const [settlementPerson,setSettlementPerson]=useState(null)
  const [accountTier,setAccountTier]=useState(null)
  const [payment,setPayment]=useState({requestId:'',amount:'',reference:''})
  const [paymentBusy,setPaymentBusy]=useState(false)
  const [paymentError,setPaymentError]=useState('')
  const unpaidOrders=person=>requests.filter(request=>String(request.entrepreneurId)===String(person.id)&&request.creditMode===true&&request.status==='Dispatched'&&request.creditRepaymentStatus!=='Paid'&&!settlements.some(item=>String(item.requestId)===String(request.id)&&item.status!=='Rejected'))
  const settle=person=>{const order=unpaidOrders(person)[0];setSettlementPerson(person);setPayment({requestId:order?.id||'',amount:String(order?.creditIssuedAmount??order?.total??''),reference:''});setPaymentError('')}
  const selectPaymentOrder=requestId=>{const order=unpaidOrders(settlementPerson).find(item=>String(item.id)===String(requestId));setPayment(current=>({...current,requestId,amount:String(order?.creditIssuedAmount??order?.total??'')}))}
  const recordPayment=async event=>{event.preventDefault();setPaymentBusy(true);setPaymentError('');try{const result=await api('/admin/credit-settlements',{method:'POST',body:JSON.stringify({...payment,memberId:settlementPerson.id})});setEntrepreneurs(result.state.entrepreneurs);setSettlementPerson(null);window.dispatchEvent(new Event('camy-business-updated'));notify('CAMY-store cash payment recorded and credit balance updated')}catch(reason){setPaymentError(reason.message)}finally{setPaymentBusy(false)}}
  const [search,setSearch]=useState(''); const [filter,setFilter]=useState('All'); const ordered=[...tiers].sort((a,b)=>Number(a.sales)-Number(b.sales))
  useEffect(()=>{const selectZero=event=>{if(event.target.matches?.('.tier-rule input[type="number"]')&&Number(event.target.value)===0)requestAnimationFrame(()=>event.target.select())};document.addEventListener('focusin',selectZero);return()=>document.removeEventListener('focusin',selectZero)},[])
  const update=(id,key,value)=>{if(value===''){setTiers(old=>old.map(t=>t.id===id?{...t,[key]:''}:t));return}const amount=Number(value);if(!Number.isFinite(amount)||amount<0)return;setTiers(old=>old.map(t=>t.id===id?{...t,[key]:amount}:t))}
  const add=()=>{const last=ordered.length?ordered[ordered.length-1]:{sales:0,credit:0};const nextSales=Number(last.sales)+100000;const nextCredit=Number(last.credit)+10000;setTiers(old=>[...old,{id:`tier-${Date.now()}-${old.length}`,sales:nextSales,credit:nextCredit}]);notify(`Tier added: ${money(nextSales)} sales / ${money(nextCredit)} credit`)}
  const remove=id=>{if(tiers.length<2){notify('Keep at least one tier');return}if(window.confirm('Delete this credit tier?')){setTiers(old=>old.filter(t=>t.id!==id));notify('Credit tier deleted')}}
  const pending=settlements.filter(item=>item.status==='Pending verification')
  const activeEntrepreneurs=entrepreneurs.filter(p=>p.active!==false&&p.stage!=='Departed'); const visible=activeEntrepreneurs.filter(p=>(filter==='All'||(filter==='Credit eligible'&&Number(p.credit)>0)||(filter==='No credit yet'&&Number(p.credit)<=0)||(filter==='Outstanding'&&Number(p.used)>0)||(filter==='High risk'&&Number(p.credit)>0&&Number(p.used)/Number(p.credit)>=.8))&&`${p.name||''} ${p.id||''} ${p.city||''}`.toLowerCase().includes(search.toLowerCase())); const limit=activeEntrepreneurs.reduce((s,p)=>s+Number(p.credit||0),0); const owed=activeEntrepreneurs.reduce((s,p)=>s+Number(p.used||0),0)
  const available=Math.max(0,limit-owed)
  const utilization=limit?Math.round(owed/limit*100):0
  const creditAccounts=activeEntrepreneurs.filter(person=>Number(person.credit||0)>0)
  const followUps=creditAccounts.filter(person=>Number(person.used||0)>0)
  const highRisk=creditAccounts.filter(person=>Number(person.used||0)/Number(person.credit||1)>=.8)
  const tierFor=person=>[...ordered].reverse().find(tier=>Number(person.sales||0)>=Number(tier.sales||0))
  const tierAccounts=accountTier?creditAccounts.filter(person=>tierFor(person)?.id===accountTier.id):[]
  const accountTierNumber=accountTier?ordered.findIndex(tier=>tier.id===accountTier.id)+1:0
  return <div className="content-page credit-control-page">
    {accountTier&&<Modal onClose={()=>setAccountTier(null)} wide className="tier-accounts-modal"><div className="tier-accounts-shell">
      <header><span><UsersRound/></span><div><small>CREDIT TIER {accountTierNumber}</small><h2>Accounts in this tier</h2><p>{money(accountTier.sales)} verified sales required · {money(accountTier.credit)} credit-stock limit</p></div><b>{tierAccounts.length} account{tierAccounts.length===1?'':'s'}</b></header>
      {tierAccounts.length?<div className="tier-account-list"><div className="tier-account-row head"><span>Entrepreneur</span><span>Verified sales</span><span>Credit limit</span><span>Outstanding</span><span>Available</span><span>Usage</span></div>{tierAccounts.map(person=>{const used=Number(person.used||0),credit=Number(person.credit||0),usage=credit?Math.round(used/credit*100):0;return <article className={usage>=80?'high-risk':''} key={person.id}><div className="person"><i>{initialsFor(person)}</i><span><strong>{person.name}</strong><small>{person.id} · {person.city||'No city'}</small></span></div><span><strong>{money(person.sales)}</strong><small>verified</small></span><span><strong>{money(credit)}</strong><small>approved</small></span><span><strong>{money(used)}</strong><small>{used?'to collect':'clear'}</small></span><span><strong>{money(Math.max(0,credit-used))}</strong><small>remaining</small></span><div className="tier-account-usage"><div><i style={{width:`${Math.min(100,usage)}%`}}/></div><strong>{usage}%</strong></div></article>})}</div>:<div className="tier-accounts-empty"><UsersRound/><h3>No accounts in Tier {accountTierNumber}</h3><p>No active entrepreneur currently qualifies for this exact tier.</p></div>}
      <footer><span>Account membership updates automatically from verified delivered sales.</span><Button variant="secondary" onClick={()=>setAccountTier(null)}>Close</Button></footer>
    </div></Modal>}
    {settlementPerson&&<Modal onClose={()=>{if(!paymentBusy)setSettlementPerson(null)}}><form className="form-modal" onSubmit={recordPayment}>
      <span className="modal-kicker">VERIFIED CREDIT PAYMENT</span><h2>Settle a credit order</h2><p>{settlementPerson.name}: {money(settlementPerson.used)} outstanding. Record the full payment against the exact credit order.</p>
      {paymentError&&<p className="market-error" role="alert">{paymentError}</p>}
      {unpaidOrders(settlementPerson).length?<><label>Credit order<select required value={payment.requestId} onChange={event=>selectPaymentOrder(event.target.value)}>{unpaidOrders(settlementPerson).map(order=><option key={order.id} value={order.id}>{order.id} · {money(order.creditIssuedAmount??order.total)} · due {displayDate(order.creditDueAt)}</option>)}</select></label><label>Full amount received<input readOnly value={money(payment.amount)}/><small>Partial settlement is not allowed; this closes the selected credit order.</small></label><label>Bank or cash payment reference<input required maxLength={100} value={payment.reference} onChange={event=>setPayment({...payment,reference:event.target.value})}/></label><Button type="submit" disabled={paymentBusy||!payment.requestId}>{paymentBusy?'Recording...':'Confirm full payment'}</Button></>:<p className="workflow-note">No dispatched credit order is currently available to settle.</p>}
    </form></Modal>}
    <PageTitle eyebrow="CREDIT CONTROL" title="Credit limits and portfolio" text="Maintain sales-based limits and monitor every entrepreneur's approved credit and current exposure."><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-credit-report.xlsx',entrepreneurs)}>Export credit ledger</Button></PageTitle>
    <section className="credit-health-grid">
      <article><span><WalletCards/></span><div><small>TOTAL APPROVED LIMIT</small><strong>{money(limit)}</strong><p>{creditAccounts.length} active credit account{creditAccounts.length===1?'':'s'}</p></div></article>
      <article className="outstanding"><span><CalendarDays/></span><div><small>CURRENTLY OUTSTANDING</small><strong>{money(owed)}</strong><p>{followUps.length} account{followUps.length===1?'':'s'} requiring follow-up</p></div></article>
      <article><span><BadgeCheck/></span><div><small>AVAILABLE CAPACITY</small><strong>{money(available)}</strong><p>Approved limit not currently used</p></div></article>
      <article className={utilization>=80?'risk':''}><span><TrendingUp/></span><div><small>PORTFOLIO UTILIZATION</small><strong>{utilization}%</strong><p>{highRisk.length} account{highRisk.length===1?'':'s'} above 80% usage</p></div></article>
    </section>
    <section className="credit-policy-panel">
      <header><div><span>LIMIT POLICY</span><h2>Verified-sales credit tiers</h2><p>Entrepreneurs automatically receive the highest limit reached by their verified delivered sales.</p></div><div><Button variant="secondary" icon={Plus} onClick={add}>Add tier</Button><Button icon={Check} onClick={onSave}>Save and apply rules</Button></div></header>
      <div className="credit-tier-table"><div className="credit-tier-row head"><span>Tier</span><span>Verified sales required</span><span></span><span>Credit-stock limit</span><span>Accounts</span><span>Action</span></div>{ordered.map((tier,index)=>{const accountCount=creditAccounts.filter(person=>tierFor(person)?.id===tier.id).length;return <div className="credit-tier-row" key={tier.id}><b aria-label={`Tier ${index+1}`}>{index+1}</b><label><small>Sales required (LKR)</small><input aria-label={`Tier ${index+1} verified sales required in LKR`} inputMode="numeric" min="0" type="number" value={tier.sales} onChange={event=>update(tier.id,'sales',event.target.value)}/></label><ArrowRight aria-hidden="true"/><label><small>Credit limit (LKR)</small><input aria-label={`Tier ${index+1} credit limit in LKR`} inputMode="numeric" min="0" type="number" value={tier.credit} onChange={event=>update(tier.id,'credit',event.target.value)}/></label><button type="button" className="tier-account-count" onClick={()=>setAccountTier(tier)} aria-label={`View ${accountCount} accounts in tier ${index+1}`}><strong>{accountCount}</strong><small>current</small><Eye/></button><button className="tier-delete-button" type="button" onClick={()=>remove(tier.id)} title={`Delete tier ${index+1}`} aria-label={`Delete tier ${index+1}`}><Trash2/></button></div>})}</div>
    </section>
    <section className="credit-ledger-panel">
      <header><div><span>ACCOUNT LEDGER</span><h2>Entrepreneur credit balances</h2><p>Available balance and risk are calculated live from the approved limit and outstanding amount.</p></div><b>{visible.length} of {activeEntrepreneurs.length}</b></header>
      <div className="credit-ledger-filters"><label><Search/><input aria-label="Search credit accounts" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, member ID, or city"/></label><select aria-label="Filter credit accounts" value={filter} onChange={event=>setFilter(event.target.value)}><option>All</option><option>Credit eligible</option><option>No credit yet</option><option>Outstanding</option><option>High risk</option></select></div>
      <div className="credit-ledger-table"><div className="credit-ledger-row head"><span>Entrepreneur</span><span>Verified sales / tier</span><span>Limit</span><span>Outstanding</span><span>Available</span><span>Usage</span><span>Action</span></div>{visible.map(person=>{const usage=Number(person.credit||0)?Math.round(Number(person.used||0)/Number(person.credit)*100):0;const currentTier=tierFor(person);return <div className={`credit-ledger-row ${usage>=80?'high-risk':''}`} key={person.id}><div className="person"><i>{initialsFor(person)}</i><div><strong>{person.name}</strong><small>{person.id} · {person.city||'No city'}</small></div></div><span><strong>{money(person.sales)}</strong><small>{currentTier?`Tier ${ordered.findIndex(tier=>tier.id===currentTier.id)+1}`:'Not eligible yet'}</small></span><span><strong>{money(person.credit)}</strong><small>approved</small></span><span><strong className={person.used?'danger':''}>{money(person.used)}</strong><small>{person.used?'to collect':'clear'}</small></span><span><strong>{money(Math.max(0,Number(person.credit||0)-Number(person.used||0)))}</strong><small>remaining</small></span><div className="credit-usage-cell"><div><i style={{width:`${Math.min(100,usage)}%`}}/></div><span>{usage}%</span></div><Button variant="soft" disabled={!person.used} onClick={()=>settle(person)}>{person.used?'Record payment':'No balance'}</Button></div>})}</div>
      {!visible.length&&<Empty icon={WalletCards} title="No matching credit accounts" text="Change the search or balance filter to see other entrepreneurs."/>}
    </section>
  </div>
}

function UserAccessPage({ users, setUsers, notify, currentUser }) {
  const permissionOptions=adminNav.map(([id,label])=>({id,label})); const defaultRoles=[{id:'system-super-admin',name:'Super Admin',permissions:permissionOptions.map(item=>item.id),system:true}]
  const [selectedId,setSelectedId]=useState(users[0]?.id||''); const [search,setSearch]=useState(''); const [adding,setAdding]=useState(false); const [form,setForm]=useState({name:'',email:'',role:''}); const selected=users.find(user=>user.id===selectedId)||users[0]
  const [roles,setRoles]=useState(defaultRoles)
  const [roleEditor,setRoleEditor]=useState(null)
  const [busy,setBusy]=useState(false)
  const [credentials,setCredentials]=useState(null)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;api('/admin/users').then(result=>{if(active){setUsers(result.users);setRoles(result.roles||defaultRoles);const firstCustom=(result.roles||[]).find(role=>!role.system);setForm(old=>({...old,role:firstCustom?.name||''}))}}).catch(reason=>{if(active)setError(reason.message)});return()=>{active=false}},[])
  const updateUser=async changes=>{setBusy(true);setError('');try{const result=await api('/admin/users/'+selected.id,{method:'PATCH',body:JSON.stringify({...selected,...changes})});setUsers(old=>old.map(user=>user.id===result.user.id?result.user:user));notify('Staff access saved')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const changeRole=role=>updateUser({role,permissions:roles.find(item=>item.name===role)?.permissions||[]})
  const togglePermission=id=>{if(selected.role==='Super Admin'){notify('Super Admin always has full system access');return}updateUser({permissions:selected.permissions.includes(id)?selected.permissions.filter(item=>item!==id):[...selected.permissions,id]})}
  const createUser=async event=>{event.preventDefault();if(!form.role){setError('Create a custom access role before adding a staff user.');return}setBusy(true);setError('');setCredentials(null);try{const result=await api('/admin/users',{method:'POST',body:JSON.stringify(form)});setUsers(old=>[...old,result.user]);setSelectedId(result.user.id);setCredentials({email:result.user.email,password:result.temporaryPassword});setForm({name:'',email:'',role:roles.find(role=>!role.system)?.name||''});setAdding(false);notify('Staff account created with a temporary password')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const removeUser=async()=>{if(!window.confirm('Remove system access for '+selected.name+'?'))return;setBusy(true);setError('');try{await api('/admin/users/'+selected.id,{method:'DELETE'});setUsers(old=>old.filter(user=>user.id!==selected.id));setSelectedId('');notify('Staff access removed')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const resetPassword=async()=>{setBusy(true);setError('');setCredentials(null);try{const result=await api('/admin/users/'+selected.id+'/reset-password',{method:'POST',body:'{}'});setUsers(old=>old.map(user=>user.id===result.user.id?result.user:user));setCredentials({email:result.user.email,password:result.temporaryPassword});notify('New temporary password issued. Previous sign-ins have been revoked.')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const saveRole=async event=>{event.preventDefault();setBusy(true);setError('');try{const editing=roleEditor.id?.startsWith('custom-');const path=editing?`/admin/access-roles/${roleEditor.id.replace('custom-','')}`:'/admin/access-roles';const result=await api(path,{method:editing?'PATCH':'POST',body:JSON.stringify({name:roleEditor.name,permissions:roleEditor.permissions})});setRoles(result.roles);if(editing){const refreshed=await api('/admin/users');setUsers(refreshed.users)}setRoleEditor(null);notify(editing?'Access role updated':'New access role created')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const deleteRole=async role=>{if(!window.confirm(`Delete the ${role.name} role?`))return;setBusy(true);setError('');try{const result=await api(`/admin/access-roles/${role.id.replace('custom-','')}`,{method:'DELETE'});setRoles(result.roles);notify('Access role deleted')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const protectedUser=selected?.role==='Super Admin' && selected?.id===users.find(user=>user.role==='Super Admin')?.id || String(selected?.id)===String(currentUser?.id)
  const visible=users.filter(user=>`${user.name} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase()))
  const editablePermissions=permissionOptions.filter(item=>item.id!=='user-access')
  return <div className="content-page user-access-page">{roleEditor&&<Modal onClose={()=>!busy&&setRoleEditor(null)}><form className="role-builder" onSubmit={saveRole}><span className="modal-kicker">CUSTOM ACCESS ROLE</span><h2>{roleEditor.id?'Edit role':'Create a new role'}</h2><p>Name the role, then choose exactly which work areas its staff members can access.</p>{error&&<div className="market-error" role="alert">{error}</div>}<label className="role-name">Role name<input autoFocus required minLength="2" maxLength="80" value={roleEditor.name} onChange={event=>setRoleEditor({...roleEditor,name:event.target.value})} placeholder="Example: Customer Support" /></label><div className="role-builder-heading"><strong>Page access</strong><span>{roleEditor.permissions.length} selected</span></div><div className="role-builder-grid">{editablePermissions.map(item=><label className={roleEditor.permissions.includes(item.id)?'selected':''} key={item.id}><span><strong>{item.label}</strong><small>{roleEditor.permissions.includes(item.id)?'Included in this role':'No access'}</small></span><input type="checkbox" checked={roleEditor.permissions.includes(item.id)} onChange={()=>setRoleEditor({...roleEditor,permissions:roleEditor.permissions.includes(item.id)?roleEditor.permissions.filter(id=>id!==item.id):[...roleEditor.permissions,item.id]})}/></label>)}</div><p className="role-security-note"><BadgeCheck/> Users &amp; access remains Super Admin-only for account security.</p><footer><button type="button" onClick={()=>setRoleEditor(null)}>Cancel</button><Button type="submit" icon={Check} disabled={busy||roleEditor.name.trim().length<2}>{busy?'Saving...':'Save access role'}</Button></footer></form></Modal>}<PageTitle eyebrow="SECURITY & ACCESS" title="Team access control" text="Create clear staff roles and give every person only the access they need."><div className="page-title-actions"><Button variant="secondary" icon={Settings} onClick={()=>window.dispatchEvent(new Event('camy-change-password'))}>Change password</Button><Button variant="secondary" icon={Plus} onClick={()=>setRoleEditor({name:'',permissions:['overview']})}>Create role</Button><Button icon={UserPlus} onClick={()=>setAdding(!adding)}>Add user</Button></div></PageTitle><section className="access-overview"><article><span><UsersRound /></span><div><small>TEAM MEMBERS</small><strong>{users.length}</strong><p>{users.filter(user=>user.active).length} currently active</p></div></article><article><span><BadgeCheck /></span><div><small>ACTIVE ACCOUNTS</small><strong>{users.filter(user=>user.active).length}</strong><p>Protected staff access</p></div></article><article><span><Settings /></span><div><small>ACCESS ROLES</small><strong>{roles.length}</strong><p>{roles.filter(role=>!role.system).length} custom roles</p></div></article></section>{error&&!roleEditor&&<div className="market-error" role="alert">{error}</div>}<section className="card role-library"><div className="card-head"><div><span>ROLE LIBRARY</span><h2>Access profiles</h2><p>Assign a ready-made role or create one for your own workflow.</p></div><Button variant="secondary" icon={Plus} onClick={()=>setRoleEditor({name:'',permissions:['overview']})}>New role</Button></div><div className="role-cards">{roles.map(role=><article key={role.id}><div><i><Settings/></i><span><strong>{role.name}</strong><small>{role.system?'CAMY system role':'Custom role'}</small></span></div><p>{role.permissions.length} page{role.permissions.length===1?'':'s'} enabled</p>{role.system?<em>Protected</em>:<footer><button onClick={()=>setRoleEditor({...role,permissions:[...role.permissions]})}><Pencil/> Edit</button><button onClick={()=>deleteRole(role)}><Trash2/> Delete</button></footer>}</article>)}</div></section>{credentials&&<section className="card staff-credentials"><h2>Staff account ready</h2><p>Share these sign-in details with the staff member. The temporary password is shown once and must be changed after signing in.</p><label>Email address<input readOnly value={credentials.email}/></label><label>Temporary password<input readOnly value={credentials.password} autoComplete="off"/></label><Button variant="secondary" onClick={()=>setCredentials(null)}>Dismiss credentials</Button></section>}{adding&&<form className="card add-access-user" onSubmit={createUser}><div><span>NEW SYSTEM USER</span><h2>Create staff access</h2></div><label>Full name<input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})} /></label><label>Email address<input required type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})} /></label><label>Starting role<select value={form.role} onChange={event=>setForm({...form,role:event.target.value})}>{roles.map(role=><option key={role.id}>{role.name}</option>)}</select></label><Button type="submit" icon={Check} disabled={busy}>{busy?'Creating...':'Create user'}</Button><button type="button" onClick={()=>setAdding(false)}>Cancel</button></form>}<section className="access-layout"><article className="card access-users"><div className="card-head"><div><span>TEAM DIRECTORY</span><h2>System users</h2></div><b>{visible.length}</b></div><label className="access-search"><Search /><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, email, or role" /></label>{visible.map(user=><button className={selected?.id===user.id?'selected':''} key={user.id} onClick={()=>setSelectedId(user.id)}><i>{user.name.split(' ').map(word=>word[0]).slice(0,2).join('')}</i><span><strong>{user.name}</strong><small>{user.role} · {user.email}</small></span><em className={user.active?'active':''}>{user.active?'Active':'Suspended'}</em></button>)}</article>{selected&&<article className="card permission-panel"><header><div><span>ACCESS PROFILE · {selected.id}</span><h2>{selected.name}</h2>{selected.passwordChangeRequired&&<p className="temporary-note">Temporary password issued — change required at next sign-in.</p>}<p>{selected.email} · Last access: {selected.lastAccess}</p></div><label className="access-status"><input type="checkbox" checked={selected.active} disabled={protectedUser||busy} onChange={event=>updateUser({active:event.target.checked})} /><span>{selected.active?'Access enabled':'Access suspended'}</span></label></header><section className="role-selector"><div><small>ASSIGNED ROLE</small><strong>{selected.role}</strong><p>Changing this applies the role's saved permissions.</p></div><select value={selected.role} disabled={protectedUser||busy} onChange={event=>changeRole(event.target.value)}>{roles.map(role=><option key={role.id}>{role.name}</option>)}</select></section><div className="permission-title"><div><span>INDIVIDUAL ACCESS</span><h3>Pages this user can view and manage</h3></div><b>{selected.permissions.length}/{permissionOptions.length} enabled</b></div><div className="permission-grid">{permissionOptions.map(item=><label className={selected.permissions.includes(item.id)?'enabled':''} key={item.id}><span><strong>{item.label}</strong><small>{item.id==='user-access'?'Super Admin security area':selected.permissions.includes(item.id)?'Access allowed':'No access'}</small></span><input type="checkbox" checked={selected.permissions.includes(item.id)} disabled={protectedUser||busy||selected.role==='Super Admin'||item.id==='user-access'} onChange={()=>togglePermission(item.id)} /></label>)}</div><footer><p><BadgeCheck /> Changes are securely saved immediately.</p><div><Button variant="secondary" disabled={protectedUser||busy} onClick={resetPassword}>Reset password</Button><button disabled={protectedUser||busy} onClick={removeUser}><Trash2 /> Remove user</button></div></footer></article>}</section></div>
}

export function CommissionPayouts({ orders, openOrder }) {
  const [filter,setFilter]=useState('Ready to pay')
  const [search,setSearch]=useState('')
  const payoutOrders=orders.filter(order=>order.orderMode==='dropship'&&Number(order.entrepreneurMargin||0)>0)
  const ready=payoutOrders.filter(order=>order.status==='Delivered'&&order.payoutStatus==='pending_transfer')
  const waiting=payoutOrders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status)&&order.payoutStatus==='pending_delivery')
  const paid=payoutOrders.filter(order=>order.payoutStatus==='paid')
  const review=payoutOrders.filter(order=>order.payoutStatus==='reversal_required')
  const matchesStatus=order=>filter==='All'||(filter==='Ready to pay'&&ready.includes(order))||(filter==='Waiting for delivery'&&waiting.includes(order))||(filter==='Paid'&&paid.includes(order))||(filter==='Needs review'&&review.includes(order))
  const visible=payoutOrders.filter(order=>matchesStatus(order)&&`${order.id} ${order.entrepreneur} ${order.entrepreneurId} ${order.customer} ${order.phone}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>String(b.deliveredAt||b.updatedAt||b.date).localeCompare(String(a.deliveredAt||a.updatedAt||a.date)))
  const statusFor=order=>order.payoutStatus==='paid'?'Paid':order.payoutStatus==='reversal_required'?'Needs review':order.payoutStatus==='pending_transfer'?'Ready to pay':'Waiting for delivery'
  return <div className="content-page commission-page">
    <PageTitle eyebrow="ENTREPRENEUR PAYMENTS" title="Pay entrepreneur commissions" text="See what CAMY must pay for each order, record the payment, and keep its receipt and reference together."><Button variant="secondary" icon={Download} onClick={()=>exportReport('camy-commission-payouts.xlsx',visible)}>Download payment list</Button></PageTitle>
    <section className="commission-simple-guide" aria-label="Commission payment process"><div><small>PAYMENT PROCESS</small><strong>How commission payment works</strong></div><span><i>1</i><em>Customer receives the order</em></span><b><ArrowRight/></b><span><i>2</i><em>CAMY collects the payment</em></span><b><ArrowRight/></b><span><i>3</i><em>CAMY pays the entrepreneur</em></span></section>
    <section className="commission-kpis">
      <article className={`ready ${filter==='Ready to pay'?'active':''}`} role="button" tabIndex="0" aria-pressed={filter==='Ready to pay'} onClick={()=>setFilter('Ready to pay')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setFilter('Ready to pay')}}}><span><Banknote/></span><div><small>PAY NOW</small><strong>{money(ready.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0))}</strong><p>{ready.length} entrepreneur payment{ready.length===1?'':'s'} ready</p></div><ChevronRight/></article>
      <article className={filter==='Waiting for delivery'?'active':''} role="button" tabIndex="0" aria-pressed={filter==='Waiting for delivery'} onClick={()=>setFilter('Waiting for delivery')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setFilter('Waiting for delivery')}}}><span><Truck/></span><div><small>PAY AFTER DELIVERY</small><strong>{money(waiting.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0))}</strong><p>{waiting.length} order{waiting.length===1?' is':'s are'} not delivered yet</p></div><ChevronRight/></article>
      <article className={`paid ${filter==='Paid'?'active':''}`} role="button" tabIndex="0" aria-pressed={filter==='Paid'} onClick={()=>setFilter('Paid')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setFilter('Paid')}}}><span><BadgeCheck/></span><div><small>ALREADY PAID</small><strong>{money(paid.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0))}</strong><p>{paid.length} payment{paid.length===1?'':'s'} completed</p></div><ChevronRight/></article>
      <article className={`review ${filter==='Needs review'?'active':''}`} role="button" tabIndex="0" aria-pressed={filter==='Needs review'} onClick={()=>setFilter('Needs review')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setFilter('Needs review')}}}><span><ReceiptText/></span><div><small>CHECK RETURNS</small><strong>{review.length}</strong><p>Paid orders that were later returned</p></div><ChevronRight/></article>
    </section>
    <article className="card commission-workspace">
      <header className="commission-workspace-heading"><div><small>PAYMENT REGISTER</small><h2>Commission payment queue</h2><p>Open a record to verify the order, payment destination, and transfer proof.</p></div><b><strong>{visible.length}</strong> of {payoutOrders.length} payments</b></header>
      <div className="commission-workspace-tools"><label><span>Search payments</span><div><Search/><input aria-label="Search commission payments" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Order, entrepreneur, customer, or phone"/></div></label><nav aria-label="Filter commission payments">{['Ready to pay','Waiting for delivery','Paid','Needs review','All'].map(item=><button type="button" className={filter===item?'active':''} aria-pressed={filter===item} key={item} onClick={()=>setFilter(item)}><span>{item==='Ready to pay'?'Pay now':item==='Waiting for delivery'?'Pay after delivery':item==='Paid'?'Already paid':item==='Needs review'?'Check returns':'All payments'}</span><b>{item==='Ready to pay'?ready.length:item==='Waiting for delivery'?waiting.length:item==='Paid'?paid.length:item==='Needs review'?review.length:payoutOrders.length}</b></button>)}</nav></div>
      <div className="commission-list" aria-live="polite">{visible.map(order=><article className={`commission-row ${statusFor(order).toLowerCase().replaceAll(' ','-')}`} key={order.id}>
        <div className="commission-order"><span><ReceiptText/></span><div><small>ORDER</small><strong>{order.id}</strong><p>{displayDate(order.deliveredAt||order.date)} · {order.product}</p></div></div>
        <div><small>ENTREPRENEUR</small><strong>{order.entrepreneur}</strong><p>{order.entrepreneurId}</p></div>
        <div><small>CUSTOMER PAID CAMY</small><strong>{money(order.amount)}</strong><p>{order.clientPaymentStatus||'Cash on delivery'}</p></div>
        <div><small>CAMY PRODUCT AMOUNT</small><strong>{money(order.camyCost)}</strong><p>Amount CAMY keeps</p></div>
        <div className="commission-amount"><small>PAY ENTREPRENEUR</small><strong>{money(order.entrepreneurMargin)}</strong>{order.payoutStatus==='pending_transfer'&&<p>Ready to pay now</p>}<Status value={statusFor(order)}/></div>
        <button type="button" className="commission-open" onClick={()=>openOrder(order)}><span>{order.payoutStatus==='pending_transfer'?'Record payment':'View details'}</span><ArrowRight/></button>
      </article>)}</div>
      {!visible.length&&<Empty icon={Banknote} title={payoutOrders.length?'No payouts match this view':'No commission records yet'} text={payoutOrders.length?'Choose another status or clear the search.':'Delivered COD orders with entrepreneur commission will appear here automatically.'}/>}
    </article>
  </div>
}

function ReportsPage({ entrepreneurs, orders, products }) {
  const deliveredOrders=orders.filter(order=>order.status==='Delivered')
  const delivered=deliveredOrders.length
  const returned=orders.filter(order=>order.status==='Returned').length
  const deliverySuccess=delivered+returned?Math.round(delivered/(delivered+returned)*1000)/10:100
  const commissionRows=deliveredOrders.filter(order=>order.orderMode==='dropship'&&Number(order.entrepreneurMargin||0)>0).map(order=>{
    return {orderId:order.id,deliveredAt:order.deliveredAt||order.date,entrepreneur:order.entrepreneur,entrepreneurId:order.entrepreneurId,customer:order.customer,clientCod:Number(order.amount||0),camyGrossProfit:Math.max(0,Number(order.amount||0)-Number(order.entrepreneurMargin||0)),commission:Number(order.entrepreneurMargin||0),payoutStatus:order.payoutStatus||'pending_delivery',paidAt:order.payoutPaidAt||null,payoutReference:order.payoutReference||''}
  })
  const clientCodCollected=deliveredOrders.reduce((sum,order)=>sum+Number(order.amount||0),0)
  const totalCommission=commissionRows.reduce((sum,row)=>sum+row.commission,0)
  const paidCommission=commissionRows.filter(row=>row.payoutStatus==='paid').reduce((sum,row)=>sum+row.commission,0)
  const pendingCommission=commissionRows.filter(row=>row.payoutStatus==='pending_transfer').reduce((sum,row)=>sum+row.commission,0)
  const grossProfit=Math.max(0,clientCodCollected-totalCommission)
  const financeColumns=[{key:'metric',label:'Metric',type:'text'},{key:'amount',label:'Amount (LKR)',type:'currency'},{key:'note',label:'Calculation / note',type:'text'}]
  const commissionColumns=[{key:'orderId',label:'Order ID',type:'text'},{key:'deliveredAt',label:'Delivered date',type:'date'},{key:'entrepreneur',label:'Entrepreneur',type:'text'},{key:'entrepreneurId',label:'Member ID',type:'text'},{key:'customer',label:'Customer',type:'text'},{key:'clientCod',label:'Client COD (LKR)',type:'currency'},{key:'camyGrossProfit',label:'CAMY gross profit (LKR)',type:'currency'},{key:'commission',label:'Entrepreneur commission (LKR)',type:'currency'},{key:'payoutStatus',label:'Payout status',type:'text'},{key:'paidAt',label:'Paid date',type:'date'},{key:'payoutReference',label:'Transfer reference',type:'text'}]
  const financialSummary=[{metric:'Client COD collected',amount:clientCodCollected,note:'Delivered customer orders only'},{metric:'CAMY gross profit',amount:grossProfit,note:'Client COD less entrepreneur commission; before stock and operating costs'},{metric:'Entrepreneur commission',amount:totalCommission,note:'Total commission earned from delivered dropship orders'},{metric:'Commission paid',amount:paidCommission,note:'Transfer proof recorded by CAMY'},{metric:'Commission waiting to pay',amount:pendingCommission,note:'Available for CAMY to transfer at any time'}]
  const grossProfitRows=deliveredOrders.map(order=>{const commission=order.orderMode==='dropship'?Number(order.entrepreneurMargin||0):0;const clientCod=Number(order.amount||0);return {orderId:order.id,deliveredAt:order.deliveredAt||order.date,entrepreneur:order.entrepreneur||'CAMY direct order',clientCod,commission,camyGrossProfit:Math.max(0,clientCod-commission)}})
  const grossProfitColumns=[{key:'orderId',label:'Order ID',type:'text'},{key:'deliveredAt',label:'Delivered date',type:'date'},{key:'entrepreneur',label:'Entrepreneur',type:'text'},{key:'clientCod',label:'Client COD (LKR)',type:'currency'},{key:'commission',label:'Entrepreneur commission (LKR)',type:'currency'},{key:'camyGrossProfit',label:'CAMY gross profit (LKR)',type:'currency'}]
  const pendingPayoutRows=commissionRows.filter(row=>row.payoutStatus==='pending_transfer')
  const pendingPayoutColumns=commissionColumns.filter(column=>['orderId','deliveredAt','entrepreneur','entrepreneurId','commission','payoutStatus'].includes(column.key))
  const financialWorkbook=()=>downloadWorkbook('camy-financial-summary.xlsx',[{name:'Financial summary',title:'CAMY Entrepreneurs - Financial Summary',columns:financeColumns,rows:financialSummary,showTotals:false},{name:'CAMY gross profit',title:'CAMY Entrepreneurs - Gross Profit by Order',columns:grossProfitColumns,rows:grossProfitRows},{name:'Commissions',title:'CAMY Entrepreneurs - Commission Register',columns:commissionColumns,rows:commissionRows},{name:'Pending payouts',title:'CAMY Entrepreneurs - Pending Commission Payouts',columns:pendingPayoutColumns,rows:pendingPayoutRows}])
  const reports=[
    ['Financial summary','Client COD, CAMY gross profit, paid commission, and pending commission amounts.',Banknote,financialWorkbook],
    ['CAMY gross profit','Gross profit by delivered order after entrepreneur commission, before stock and operating costs.',CircleDollarSign,()=>downloadWorkbook('camy-gross-profit.xlsx',[{name:'Gross profit',title:'CAMY Entrepreneurs - Gross Profit by Order',columns:grossProfitColumns,rows:grossProfitRows}])],
    ['Entrepreneur commissions','Complete commission register with transfer status and payment proof reference.',WalletCards,()=>downloadWorkbook('camy-entrepreneur-commissions.xlsx',[{name:'Commission register',title:'CAMY Entrepreneurs - Entrepreneur Commission Register',columns:commissionColumns,rows:commissionRows}])],
    ['Pending commission payouts','Delivered commissions that CAMY can transfer at any time.',CalendarDays,()=>downloadWorkbook('camy-pending-payouts.xlsx',[{name:'Pending payouts',title:'CAMY Entrepreneurs - Pending Commission Payouts',columns:pendingPayoutColumns,rows:pendingPayoutRows}])],
    ['Entrepreneur performance','Registration, sales, rank, stages, and credit limits.',UsersRound,()=>exportReport('entrepreneur-performance.xlsx',entrepreneurs)],
    ['Order and delivery report','All processing, dispatched, delivered, and returned orders.',Truck,()=>exportReport('order-delivery-report.xlsx',orders)],
    ['Credit and settlements','Issued credit, current use, and entrepreneur balances.',CreditCard,()=>exportReport('credit-settlement-report.xlsx',entrepreneurs.map(p=>({id:p.id,name:p.name,limit:p.credit,outstanding:p.used})))],
    ['Product and stock report','Catalogue prices, model numbers, categories, and live stock.',PackageOpen,()=>exportReport('product-stock-report.xlsx',products)]
  ]
  return <div className="content-page"><PageTitle eyebrow="MANAGEMENT REPORTS" title="Reports for every CAMY decision" text="Finance, commission, payout, delivery, credit, entrepreneur, and stock reports—ready for Excel."><Button icon={Download} onClick={financialWorkbook}>Download finance summary</Button></PageTitle><section className="report-finance-note"><span><Banknote/></span><div><small>FINANCE REPORTING RULE</small><strong>CAMY gross profit = delivered client COD − entrepreneur commission</strong><p>Gross profit is shown before warehouse product cost and operating expenses, which are not yet recorded in the platform.</p></div></section><div className="report-grid">{reports.map(([title,text,Icon,download])=><article className="card" key={title}><span><Icon /></span><h2>{title}</h2><p>{text}</p><Button variant="secondary" icon={Download} onClick={download}>Download Excel</Button></article>)}</div><article className="card report-summary"><div><span>DELIVERED ORDER SUMMARY</span><h2>CAMY financial and operational snapshot</h2><p>Use the finance reports to reconcile collections, CAMY gross profit, commissions, and completed transfers.</p></div><section><span><strong>{money(grossProfit)}</strong> CAMY gross profit</span><span><strong>{money(pendingCommission)}</strong> commission waiting</span><span><strong>{money(paidCommission)}</strong> commission paid</span><span><strong>{deliverySuccess}%</strong> delivery success</span></section></article></div>
}

function Empty({ icon:Icon,title,text }) { return <div className="empty"><span><Icon /></span><h2>{title}</h2><p>{text}</p></div> }

function Modal({ children, onClose, wide=false, className='' }) { return <PortalOverlay className="modal-layer" onClose={onClose} label="CAMY details"><div className={`modal-v2 ${wide?'wide':''} ${className}`.trim()}><button className="modal-x" onClick={onClose} aria-label="Close dialog"><X/></button>{children}</div></PortalOverlay> }

function ProductEditor({ product, close, setProducts, saveProduct, notify }) {
  const [mediaBusy,setMediaBusy]=useState(false)
  const [saving,setSaving]=useState(false)
  const [categories]=useStoredState('camy-product-categories-v2',['Cookware','Home Appliances','Electronics']); const [draft,setDraft]=useState({...product,...productCosts(product),specs:Array.isArray(product.specs)?product.specs.join(', '):product.specs||''})
  const update=(key,value)=>setDraft(old=>({...old,[key]:value}))
  const save=async()=>{if(saving)return;setSaving(true);const saved=await saveProduct({...draft,...productCosts(draft),stock:Number(draft.stock),rating:Number(draft.rating),specs:String(draft.specs).split(',').map(s=>s.trim()).filter(Boolean)});setSaving(false);if(saved)close()}
  const remove=()=>{if(!window.confirm(`Delete ${product.name} from the catalogue?`))return;setProducts(old=>old.filter(p=>p.id!==product.id));notify('Product deleted from catalogue');close()}
  return <div className="admin-product-editor"><div className="editor-preview"><div className="editor-image"><img src={draft.image} alt={draft.name} onError={event=>{event.currentTarget.style.display='none'}} /></div>{draft.image && <a className="editor-original-image" href={draft.image} target="_blank" rel="noopener noreferrer">View original image ?</a>}<span>LIVE PREVIEW</span><h3>{draft.name||'Product name'}</h3><p>{draft.category||'Category'} · {draft.code||'Model code'}</p><strong>{money(productCosts(draft).price)}</strong></div><form className="editor-fields" onSubmit={event=>{event.preventDefault();if(!mediaBusy)save()}}><div className="editor-heading"><div><span>CATALOGUE ITEM</span><h2>Edit product</h2></div><button type="button" className="editor-delete" onClick={remove}><Trash2 /> Delete</button></div><label>Product name<input required value={draft.name} onChange={event=>update('name',event.target.value)} /></label><div className="two-fields"><label>Category<select value={draft.category} onChange={event=>update('category',event.target.value)}>{categories.map(category=><option key={category}>{category}</option>)}</select></label><label>Model / code<input required value={draft.code} onChange={event=>update('code',event.target.value)} /></label></div><ProductCostEditor product={draft} onChange={setDraft}/><div className="two-fields"><label>Stock<input required min="0" type="number" value={draft.stock} onChange={event=>update('stock',event.target.value)} /></label></div><div className="two-fields"><label>Tag<input value={draft.tag||''} onChange={event=>update('tag',event.target.value)} placeholder="Best seller" /></label><label>Rating<input min="0" max="5" step="0.1" type="number" value={draft.rating||0} onChange={event=>update('rating',event.target.value)} /></label></div><ProductMediaEditor onBusyChange={setMediaBusy} product={draft} onChange={changes=>setDraft(old=>({...old,...changes}))}/><label>Description<textarea rows="3" value={draft.description||''} onChange={event=>update('description',event.target.value)} placeholder="Describe the product for customers" /></label><label>Specifications <small>Separate each item with a comma</small><textarea rows="3" value={draft.specs} onChange={event=>update('specs',event.target.value)} placeholder="Durable finish, Easy to clean, 1-year warranty" /></label><label>Warranty<input value={draft.warranty||''} onChange={event=>update('warranty',event.target.value)} placeholder="1 year" /></label><Button type="submit" disabled={mediaBusy} icon={Check}>Save product changes</Button></form></div>
}

function ProductModal({ product, close, addToCart, admin, setProducts, notify }) {
  const [draft,setDraft]=useState(product); const [faq,setFaq]=useState(false)
  const save=()=>{setProducts(old=>old.map(p=>p.id===product.id?draft:p));notify('Product changes saved');close()}
  const saveProduct=async updated=>{try{const result=await api('/marketplace/product',{method:'POST',body:JSON.stringify({product:updated,baseStock:Number(product.stock)})});setProducts(old=>old.map(item=>String(item.id)===String(result.product.id)?result.product:item));window.dispatchEvent(new CustomEvent('camy-catalogue-saved',{detail:result.revision}));notify('Product price and details saved to MySQL');return true}catch(reason){notify(reason.message);return false}}
  return <Modal onClose={close} wide>{admin?<ProductEditor product={product} close={close} setProducts={setProducts} saveProduct={saveProduct} notify={notify}/>:<div className="product-modal-v2"><div className="modal-photo"><img src={draft.image} alt={draft.name}/>{draft.tag&&<span>{draft.tag}</span>}</div><div className="modal-copy"><small>{draft.category} · {draft.code}</small><h2>{draft.name}</h2><p className="rating"><Star fill="currentColor" /> {draft.rating} <i /> {draft.stock} at CAMY</p><h3>{money(customerProductPrice(draft))}</h3>{draft.freeDelivery===false&&<span className="free-shipping-note detail has-charge"><Truck /> {deliveryLabel(draft)}</span>}<p>{draft.description}</p><div className="product-detail-meta"><span><b>Product code</b>{draft.code||'Not set'}</span><span><b>Warranty</b>{draft.warranty||'Ask CAMY'}</span></div><h4 className="product-features-title">Product features</h4><ul>{(draft.specs?.length?draft.specs:['Contact CAMY for complete product specifications.']).map(s=><li key={s}><Check />{s}</li>)}</ul><button className="faq" onClick={()=>setFaq(!faq)}><span><FileText /> Product FAQ</span><ChevronDown /></button>{faq&&<p className="faq-answer">Warranty coordination is handled by CAMY. Delivery dates are confirmed after stock and customer details are verified.</p>}<Button icon={ShoppingBag} onClick={()=>{close();window.dispatchEvent(new Event('camy-open-stock-supply'))}}>Buy stock from CAMY</Button></div></div>}</Modal>
}

function CartDrawer({ cart, setCart, close, placeOrder }) {
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    district: 'Kurunegala',
  })

  const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle',
    'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
    'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
    'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
    'Trincomalee', 'Vavuniya',
  ]

  const productSubtotal = cart.reduce((sum, product) => sum + customerProductPrice(product) * product.qty, 0)
  const deliveryTotal = cart.reduce((sum, product) => sum + (product.freeDelivery === false ? Number(product.deliveryCost || 0) * product.qty : 0), 0)
  const total = productSubtotal + deliveryTotal
  const itemCount = cart.reduce((sum, product) => sum + product.qty, 0)
  const valid = cart.length > 0 && customer.name && customer.phone && customer.address

  const changeQuantity = (id, change) => {
    setCart(current => current
      .map(item => item.id === id
        ? { ...item, qty: Math.min(item.stock, Math.max(0, item.qty + change)) }
        : item)
      .filter(item => item.qty > 0))
  }

  return (
    <div className="drawer-layer cart-page-layer" onMouseDown={close}>
      <aside className="drawer cart-drawer" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <small>CUSTOMER ORDER</small>
            <h2>Order cart <span>{itemCount}</span></h2>
          </div>
          <button className="icon-btn" aria-label="Close order cart" onClick={close}><X /></button>
        </header>

        {!cart.length ? (
          <Empty icon={ShoppingCart} title="Your cart is empty" text="Add a product to begin a customer order." />
        ) : (
          <>
            <div className="drawer-items">
              {cart.map(item => (
                <article key={item.id}>
                  <img src={item.image} alt="" />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{money(customerProductPrice(item))} per item</small>
                    {item.freeDelivery===false&&<small className="cart-item-delivery charged">{Number(item.deliveryCost||0)>0?`${money(Number(item.deliveryCost))} delivery per item`:'Delivery charge applies'}</small>}
                    <span>
                      <button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><Minus /></button>
                      {item.qty}
                      <button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.id, 1)}><Plus /></button>
                    </span>
                  </div>
                  <b>{money((customerProductPrice(item) + (item.freeDelivery === false ? Number(item.deliveryCost || 0) : 0)) * item.qty)}</b>
                </article>
              ))}
            </div>

            <div className="customer-fields">
              <h3>Customer delivery details</h3>
              <label>
                Customer name
                <input value={customer.name} onChange={event => setCustomer({ ...customer, name: event.target.value })} placeholder="Full name" />
              </label>
              <div>
                <label>
                  Phone number
                  <input value={customer.phone} onChange={event => setCustomer({ ...customer, phone: event.target.value })} placeholder="07X XXX XXXX" inputMode="tel" />
                </label>
                <label>
                  District
                  <select value={customer.district} onChange={event => setCustomer({ ...customer, district: event.target.value })}>
                    {districts.map(district => <option key={district} value={district}>{district}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Delivery address
                <textarea value={customer.address} onChange={event => setCustomer({ ...customer, address: event.target.value })} placeholder="House number, street and town" rows="3" />
              </label>
            </div>

            <footer>
              <div className="cart-cost-table"><div><span>Product subtotal</span><strong>{money(productSubtotal)}</strong></div>{deliveryTotal>0&&<div className="delivery-fee-row"><span>AC delivery</span><strong>{money(deliveryTotal)}</strong></div>}<div className="cart-grand-total"><span>Order total</span><strong>{money(total)}</strong></div></div>
              <Button disabled={!valid} onClick={() => placeOrder(customer, total)}>Place customer order <ArrowRight /></Button>
              <small><BadgeCheck /> CAMY confirms stock before processing.</small>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

function NotificationsDrawer({ notifications, setNotifications, close, openNotification = target => window.dispatchEvent(new CustomEvent('camy-open-admin-notification', { detail: target })) }) {
  const icons={delivery:Truck,growth:TrendingUp,credit:CalendarDays,catalogue:Gift}
  const deleteNotification=(event,id)=>{event.stopPropagation();setNotifications(old=>old.filter(item=>item.id!==id))}
  const clearNotifications=()=>{if(window.confirm('Delete all notifications? This cannot be undone.'))setNotifications([])}
  return <div className="drawer-layer" onMouseDown={close}><aside className="drawer notifications" onMouseDown={e=>e.stopPropagation()}><header><div><small>YOUR UPDATES</small><h2>Notifications <span>{notifications.filter(n=>!n.read).length}</span></h2></div><button className="icon-btn" onClick={close} aria-label="Close notifications"><X /></button></header><div>{notifications.length?notifications.map(n=>{const Icon=icons[n.type]||Bell;return <article className={`${!n.read?'unread ':''}${n.target?'actionable':''}`.trim()} role={n.target?'button':undefined} tabIndex={n.target?0:undefined} key={n.id} onClick={()=>{setNotifications(old=>old.map(item=>item.id===n.id?{...item,read:true}:item));if(n.target)openNotification?.(n.target)}} onKeyDown={event=>{if(n.target&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setNotifications(old=>old.map(item=>item.id===n.id?{...item,read:true}:item));openNotification?.(n.target)}}}><span><Icon /></span><div><strong>{n.title}</strong><p>{n.body}</p><small>{n.time}{n.target?` · ${n.actionLabel||'Open page'}`:''}</small></div><button type="button" className="notification-delete" onClick={event=>deleteNotification(event,n.id)} onKeyDown={event=>event.stopPropagation()} aria-label={`Delete notification: ${n.title}`} title="Delete notification"><Trash2 /></button></article>}):<div className="notification-empty"><Bell/><strong>You are all caught up</strong><p>New order, delivery, payout, and credit updates will appear here.</p></div>}</div>{notifications.length>0&&<footer className="notification-actions"><Button variant="secondary" icon={Check} onClick={()=>setNotifications(old=>old.map(n=>({...n,read:true})))}>Mark all as read</Button><button type="button" className="notification-clear" onClick={clearNotifications}><Trash2 />Delete all</button></footer>}</aside></div>
}

function LegacyDropshipPayoutPanel({ order, admin, onDone }) {
  const [reference,setReference]=useState(order.payoutReference||'')
  const [file,setFile]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const margin=Number(order.entrepreneurMargin||0)
  const canTransfer=admin&&order.status==='Delivered'&&margin>0&&order.payoutStatus!=='paid'&&order.payoutStatus!=='reversal_required'
  const upload=async event=>{
    event.preventDefault()
    if(busy)return
    if(!reference.trim()){
      setError('Enter the bank transfer reference before confirming the payout.')
      return
    }
    if(!file){
      setError('Attach the bank transfer receipt before confirming the payout.')
      return
    }
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>5*1024*1024){setError('Choose a JPG, PNG, WebP or PDF CAMY transfer receipt up to 5 MB.');return}
    setBusy(true);setError('')
    try{
      const receipt=await readReceiptFile(file)
      const result=await api('/marketplace/orders/'+encodeURIComponent(order.id)+'/payout',{method:'POST',body:JSON.stringify({reference:reference.trim(),receipt})})
      onDone?.(result.order,result.message)
    }catch(reason){setError(reason.message)}finally{setBusy(false)}
  }
  if(order.orderMode!=='dropship')return null
  const paymentMethod='Cash on delivery'
  return <section className="dropship-admin-money">
    <div className="member-section-title"><div><span>DROPSHIP MONEY FLOW</span><h3>Client collection & entrepreneur payout</h3></div><Banknote/></div>
    <div className="dropship-admin-money-grid">
      <span><small>Client payment</small><strong>{paymentMethod}</strong></span>
      <span><small>Client total</small><strong>{money(order.amount)}</strong></span>
      <span><small>CAMY product value</small><strong>{money(order.camyCost??order.amount)}</strong></span>
      <span><small>Entrepreneur margin</small><strong>{money(margin)}</strong></span>
      <span><small>CAMY collection</small><strong>{order.clientPaymentStatus|| (order.status==='Delivered'?'Collected by CAMY':'Pending')}</strong></span>
      <span><small>Entrepreneur payout</small><strong>{order.payoutStatus==='paid'?'Transferred':order.payoutStatus==='pending_transfer'?'Transfer pending':order.payoutStatus==='reversal_required'?'Reversal required':order.payoutStatus==='not_required'?'No payout due':'Waiting for delivery'}</strong></span>
    </div>
    {order.payoutStatus==='paid'&&<div className="money-receipt-row paid"><span><strong>CAMY paid the entrepreneur</strong><small>Transfer reference: {order.payoutReference||'Recorded'} · {displayDate(order.payoutPaidAt)}</small></span>{order.payoutReceipt&&<a className="btn secondary" href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View CAMY transfer receipt</a>}</div>}
    {order.payoutStatus==='reversal_required'&&<div className="login-error">This order was returned after the entrepreneur margin had already been transferred. Finance reconciliation is required before closing this order.</div>}
    {canTransfer&&<form className="dropship-transfer-form" onSubmit={upload}><div><strong>Transfer {money(margin)} to the entrepreneur's saved bank account</strong><p>Do this only after the delivery is successful and CAMY has collected the client's full payment.</p></div><label>CAMY bank transfer reference<input required maxLength="120" value={reference} onChange={event=>setReference(event.target.value)} placeholder="Transfer reference / transaction ID"/></label><label>Transfer receipt<input required type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>setFile(event.target.files?.[0]||null)}/><small>{file?file.name:'JPG, PNG, WebP or PDF · max 5 MB'}</small></label>{error&&<p className="market-error">{error}</p>}<Button type="submit" disabled={busy||!file||!reference.trim()} icon={Banknote}>{busy?'Recording transfer…':'Record entrepreneur payout'}</Button></form>}
    {admin&&order.status!=='Delivered'&&margin>0&&<p className="dropship-payout-note">Payout unlocks only after CAMY marks this order as successfully delivered.</p>}
  </section>
}

function LegacyOrderModal({ order, products = [], admin = false, entrepreneur, openEntrepreneur, close, onUpdated }) {
  const items=order.items?.length?order.items:[{name:order.product,qty:order.qty,price:order.qty?Number(order.amount)/Number(order.qty):Number(order.amount)}]
  const progress=['Pending','Awaiting payment','Payment review','Processing','Dispatched','Delivered'], current=progress.indexOf(order.status)
  const dropship=order.orderMode==='dropship'
  return <Modal onClose={close} wide><div className="detail-modal order-detail-modal"><header className="order-modal-heading"><div><span className="modal-kicker">{dropship?'CAMY DROPSHIP ORDER':'CUSTOMER ORDER'}</span><h2>{order.id}</h2><small>Placed {displayDate(order.date)}</small></div><Status value={order.status}/></header><section className="order-customer-card"><h3>Customer and delivery</h3><div><span><small>Customer</small><strong>{order.customer||'Not provided'}</strong></span><span><small>Phone</small><strong>{order.phone||'Not provided'}</strong></span><span><small>Delivery address</small><strong>{order.address||'Not provided'}</strong></span><span><small>Entrepreneur</small><strong>{order.entrepreneur} / {order.entrepreneurId}</strong>{admin&&<button className="btn secondary" onClick={openEntrepreneur}>View entrepreneur</button>}</span></div></section><h3>All ordered products</h3><div className="supply-table-wrap"><table className="supply-detail-table"><thead><tr><th>Product</th>{dropship&&<th>CAMY price</th>}<th>Client price</th><th>Quantity</th><th>Client line total</th>{dropship&&<th>Margin</th>}</tr></thead><tbody>{items.map((item,index)=>{const product=products.find(entry=>String(entry.id)===String(item.id||item.productId));const camyPrice=Number(item.camyPrice??product?.price??item.price);const sell=Number(item.price);return <tr key={(item.id||item.productId||index)}><td><div className="supply-product-cell">{product?.image&&<img src={product.image} alt=""/>}<span><strong>{item.name||product?.name||'CAMY product'}</strong><small>{product?.code||''}</small></span></div></td>{dropship&&<td>{money(camyPrice)}</td>}<td>{money(sell)}</td><td>{item.qty}</td><td>{money(sell*Number(item.qty))}</td>{dropship&&<td>{money((sell-camyPrice)*Number(item.qty))}</td>}</tr>})}</tbody></table></div><div className="supply-detail-total"><span>{dropship?'Client total':'Order total'}</span><strong>{money(order.amount)}</strong></div>{!dropship&&<section className="supply-payment"><h3>Payment information</h3><p>Payment reference: <strong>{order.reference||'Not submitted'}</strong></p>{order.bankDetails&&<BankDetails bank={order.bankDetails}/ >}{!order.receipt&&<p>No payment receipt submitted yet.</p>}</section>}{dropship&&<DropshipPayoutPanel order={order} admin={admin} entrepreneur={entrepreneur} onEditEntrepreneur={openEntrepreneur} onDone={(updated,message)=>{message&&window.dispatchEvent(new CustomEvent('camy-finance-message',{detail:message}));onUpdated?.(updated);close()}}/>}<OrderReview key={order.id+order.status} order={order} onDone={()=>{onUpdated?.();close()}}/><section className="order-progress"><div className="timeline">{progress.map((step,index)=><div className={current>=index?'done':''} key={step}><i>{index+1}</i><span>{dropship&&step==='Processing'?'CAMY processing':step==='Processing'?'Payment verified':step}</span></div>)}</div>{['Rejected','Returned'].includes(order.status)&&<p>This order is {order.status.toLowerCase()}. Any reserved stock has been restored.</p>}</section></div></Modal>
}

function SettlementModal({ close, submit, requests=[], settlements=[] }) {
  requests=requests.length?requests:(globalThis.__camyCreditRequests||[])
  settlements=settlements.length?settlements:(globalThis.__camyCreditSettlements||[])
  const changeableCashIds=new Set(settlements.filter(item=>item.status==='Pending verification'&&item.method==='cash'&&(item.collectionStatus||'awaiting_collection')==='awaiting_collection'&&item.requestId).map(item=>String(item.requestId)))
  const paidIds=new Set(settlements.filter(item=>item.status!=='Rejected'&&item.requestId&&!changeableCashIds.has(String(item.requestId))).map(item=>String(item.requestId)))
  const payable=requests.filter(item=>item.creditMode===true&&item.status==='Dispatched'&&!paidIds.has(String(item.id)))
  const [requestId,setRequestId]=useState(payable[0]?.id||'')
  const [method,setMethod]=useState('bank_transfer')
  const [reference,setReference]=useState('')
  const [receipt,setReceipt]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const selected=payable.find(item=>String(item.id)===String(requestId))
  const changingCash=settlements.find(item=>String(item.requestId)===String(requestId)&&item.status==='Pending verification'&&item.method==='cash'&&(item.collectionStatus||'awaiting_collection')==='awaiting_collection')
  const amount=Number(selected?.creditIssuedAmount??selected?.total??0)
  const cash=method==='cash_at_camy'
  const choose=event=>{const file=event.target.files?.[0];if(!file){setReceipt(null);return}if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>5*1024*1024){event.target.value='';setReceipt(null);setError('Use a JPG, PNG, WebP or PDF receipt up to 5 MB.');return}setReceipt(file);setError('')}
  const save=async event=>{event.preventDefault();if(!selected)return setError('Choose the credit-stock purchase you are paying.');if(!cash&&!reference.trim())return setError('Enter the bank transfer reference.');if(!cash&&!receipt)return setError(changingCash?'Upload a new receipt to change from store cash to bank transfer.':'Upload your bank-transfer receipt.');setBusy(true);setError('');try{const data=receipt?await readReceiptFile(receipt):'';if(await submit(selected.id,amount,reference.trim(),data,receipt?.name||'',method,changingCash?.id))close()}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  return <Modal onClose={close}><form className="form-modal" onSubmit={save}>
    <span className="modal-kicker">CREDIT STOCK PAYMENT</span><h2>{changingCash?'Change to bank transfer':'Pay for credit stock'}</h2><p>{changingCash?'Submit the transaction reference and a new receipt to replace your CAMY-store cash choice.':'Choose how you will settle the full amount for this dispatched credit-stock order.'}</p>
    {error&&<p className="market-error" role="alert">{error}</p>}
    {payable.length?<>
      <label>Credit-stock purchase<select required value={requestId} onChange={event=>setRequestId(event.target.value)}>{payable.map(item=><option key={item.id} value={item.id}>{item.id} · {money(item.total)} · due {displayDate(item.creditDueAt)}</option>)}</select></label>
      <label>Amount to pay<input readOnly value={money(amount)}/><small>This is the exact price of the stock issued on credit.</small></label>
      {changingCash&&<p className="workflow-note">You previously selected CAMY-store cash. Choose bank transfer below, enter the transaction reference, and upload the new receipt.</p>}
      <div className="settlement-method-options" role="radiogroup" aria-label="Payment method"><button type="button" role="radio" aria-checked={method==='bank_transfer'} className={method==='bank_transfer'?'active':''} onClick={()=>{setMethod('bank_transfer');setError('')}}><Banknote/><span><b>Bank transfer</b><small>Enter the transaction reference and upload the receipt.</small></span><Check/></button><button type="button" role="radio" aria-checked={cash} className={cash?'active':''} disabled={Boolean(changingCash)} onClick={()=>{setMethod('cash_at_camy');setReference('');setReceipt(null);setError('')}}><Store/><span><b>Cash at CAMY store</b><small>{changingCash?'Current choice—select bank transfer to change it.':'Visit a CAMY store and pay the exact amount in cash.'}</small></span><Check/></button></div>
      {cash?<section className="store-payment-instructions"><header><Store/><div><small>HOW TO PAY AT A CAMY STORE</small><strong>Bring the exact amount and your payment details</strong></div></header><ol><li>Call CAMY at <a href={`tel:${SUPPORT_PHONE_DIAL}`}>{SUPPORT_PHONE_DISPLAY}</a> before visiting to confirm the nearest store and opening hours.</li><li>At the store, show your member ID and credit order <b>{selected?.id}</b>.</li><li>Pay exactly <b>{money(amount)}</b> in cash and collect the store receipt.</li><li>CAMY Admin will mark the cash as collected, then verify the repayment and update your credit balance.</li></ol><p>Choosing this option does not mean CAMY has received the money yet.</p></section>:<><label>Bank transfer reference<input required maxLength="100" value={reference} onChange={event=>setReference(event.target.value)} placeholder="Bank slip or transfer reference"/></label><label className="settlement-receipt-upload">Payment receipt<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={choose}/><span>{receipt?`Selected: ${receipt.name}`:'Choose receipt (JPG, PNG, WebP or PDF)'}</span></label></>}
      <Button type="submit" disabled={busy||!selected||(!cash&&(!reference.trim()||!receipt))} icon={cash?Store:Check}>{busy?'Submitting…':cash?`Mark ${money(amount)} for cash payment`:changingCash?'Change to bank transaction and submit receipt':`Mark ${money(amount)} as paid by bank`}</Button>
    </>:<p className="workflow-note">There are no dispatched credit-stock purchases waiting for payment.</p>}
  </form></Modal>
}

function OrderInvoicePanel({ order, admin, onDone }) {
  const [number,setNumber]=useState(order.invoiceNumber||'')
  const [file,setFile]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  const issued=Boolean(order.invoiceNumber)
  const changed=number.trim()!==String(order.invoiceNumber||'').trim()||Boolean(file)
  useEffect(()=>{setNumber(order.invoiceNumber||'');setFile(null)},[order.id,order.invoiceNumber,order.invoice])
  const changeNumber=event=>{setNumber(event.target.value);setSaved(false);setError('')}
  const chooseFile=event=>{setFile(event.target.files?.[0]||null);setSaved(false);setError('')}
  const issue=async event=>{event.preventDefault();if(!number.trim())return setError('Enter the invoice reference number.');if(file&&!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))return setError('Use a JPG, PNG, WebP or PDF document.');setBusy(true);setSaved(false);setError('');try{const payload={invoiceNumber:number.trim()};if(file)payload.invoice=await readReceiptFile(file);const result=await api(`/marketplace/orders/${encodeURIComponent(order.id)}/invoice`,{method:'POST',body:JSON.stringify(payload)});setSaved(true);setFile(null);onDone?.(result.order,result.message||'Invoice submitted successfully.')}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  const title=issued?'Client invoice':'Create client invoice'
  const description=issued?`Invoice ${order.invoiceNumber} was submitted on ${displayDate(order.invoiceIssuedAt)}.`:(admin?'Add a reference number and optionally attach the invoice document.':'CAMY has not submitted an invoice for this order yet.')
  return <section className={`order-invoice-panel invoice-redesign ${issued?'issued':'waiting'} ${admin?'invoice-admin':'invoice-viewer'}`}>
    <div className="invoice-status-rail"><span className="invoice-status-icon">{issued?<BadgeCheck/>:<ReceiptText/>}</span><small>INVOICE STATUS</small><strong>{issued?'Submitted':'Not submitted'}</strong><p>{issued?'The invoice is saved to this order.':'Complete the details to issue this invoice.'}</p>{issued&&<div className="invoice-saved-meta"><span>Reference</span><b>{order.invoiceNumber}</b><span>Submitted</span><b>{displayDate(order.invoiceIssuedAt)}</b></div>}</div>
    <div className="invoice-workspace"><header><div><small>{admin?'CLIENT BILLING':'INVOICE & RECEIPT'}</small><h3>{title}</h3><p>{description}</p></div>{order.invoice&&<a className="btn secondary" href={order.invoice} target="_blank" rel="noreferrer"><FileText/> View document</a>}</header>
      {saved&&<div className="invoice-inline-success" role="status" aria-live="polite"><BadgeCheck/><span><strong>Invoice submitted successfully</strong><small>The invoice details are now saved to this order.</small></span></div>}
      {admin&&<form className="invoice-admin-form" onSubmit={issue}><label className="invoice-reference-field"><span>Invoice reference <strong>Required</strong></span><input required maxLength={100} value={number} onChange={changeNumber} placeholder="e.g. INV-2026-001"/></label><label className={`invoice-file-field ${file?'selected':''}`}><span>Invoice document <em>Optional</em></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={chooseFile}/><b><FileText/><span><strong>{file?file.name:order.invoice?'Replace current document':'Choose a document'}</strong><small>{file?'Ready to upload':'JPG, PNG, WebP or PDF'}</small></span></b></label>{error&&<p className="market-error" role="alert">{error}</p>}<div className="invoice-form-footer"><span>{issued&&!changed?<><Check/> All invoice details are saved</>:changed?'Unsaved changes':'Enter a reference to continue'}</span><button className="btn primary invoice-save-button" disabled={busy||!number.trim()||(issued&&!changed)}>{busy?'Submitting…':issued?'Update invoice':'Submit invoice'}</button></div></form>}
    </div>
  </section>
}

function DropshipPayoutPanel({ order, admin, entrepreneur, onEditEntrepreneur, onDone, onViewCommission, compact=false }) {
  const [reference,setReference]=useState(order.payoutReference||'')
  const [file,setFile]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const margin=Number(order.entrepreneurMargin||0)
  const camyCost=Number(order.camyCost??order.amount)
  const clientTotal=Number(order.amount||0)
  const entrepreneurName=entrepreneur?.name||order.entrepreneur||'Entrepreneur'
  const bank={
    bank:entrepreneur?.bank||entrepreneur?.bankDetails?.bank||'',
    branch:entrepreneur?.branch||entrepreneur?.bankDetails?.branch||'',
    holder:entrepreneur?.accountName||entrepreneur?.bankDetails?.holder||'',
    account:entrepreneur?.accountNumber||entrepreneur?.account||entrepreneur?.bankDetails?.account||''
  }
  const bankComplete = ['bank', 'branch', 'holder', 'account'].every(key => (
    String(bank[key] || '').trim()
  ))
  const canTransfer = (
    admin
    && order.status === 'Delivered'
    && margin > 0
    && order.payoutStatus === 'pending_transfer'
  )
  const payoutNeedsBank = canTransfer && !bankComplete
  const payoutLabel=order.payoutStatus==='paid'?'Paid':order.payoutStatus==='pending_transfer'?'Ready to transfer':order.payoutStatus==='reversal_required'?'Reversal required':order.payoutStatus==='not_required'?'No payout due':'Waiting for delivery'
  const chooseReceipt=event=>{const selected=event.target.files?.[0]||null;if(!selected){setFile(null);return}if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(selected.type)){event.target.value='';setFile(null);setError('Choose a JPG, PNG, WebP or PDF bank receipt.');return}setFile(selected);setError('')}
  const upload=async event=>{
    event.preventDefault()
    if(busy)return
    if(!reference.trim()){
      setError('Enter the bank transfer reference before confirming the payout.')
      return
    }
    if(!file){
      setError('Attach the bank transfer receipt before confirming the payout.')
      return
    }
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>5*1024*1024){setError('Choose a JPG, PNG, WebP or PDF receipt up to 5 MB.');return}
    setBusy(true);setError('')
    try{const receipt=await readReceiptFile(file);const result=await api('/marketplace/orders/'+encodeURIComponent(order.id)+'/payout',{method:'POST',body:JSON.stringify({reference:reference.trim(),receipt})});onDone?.(result.order,result.message)}
    catch(reason){setError(reason.message)}finally{setBusy(false)}
  }
  if(order.orderMode!=='dropship')return null
  if(!admin){
    const paid=order.payoutStatus==='paid'
    const delivered=order.status==='Delivered'||paid||order.payoutStatus==='pending_transfer'
    const dispatched=['Dispatched','Delivered'].includes(order.status)||delivered
    return <section className={`entrepreneur-commission-card ${order.payoutStatus||'waiting'}`}>
      <header><span><WalletCards/></span><div><small>MY PROFIT</small><h3>{money(margin)}</h3><p>{paid?'CAMY has transferred your profit to you.':order.payoutStatus==='pending_transfer'?'Delivery is complete and your profit is ready for CAMY payment.':order.payoutStatus==='reversal_required'?'CAMY Finance is reviewing this profit after the return.':'CAMY manages delivery and pays your profit after successful collection.'}</p></div><b className={`commission-state-chip ${paid?'paid':delivered?'ready':'waiting'}`}><i/>{paid?'Paid':delivered?'Payment pending':'Awaiting delivery'}</b></header>
      {paid?<div className="entrepreneur-commission-proof"><span><BadgeCheck/></span><div><small>PAYMENT CONFIRMED</small><strong>{order.payoutReference||'CAMY transfer recorded'}</strong><p>Paid {displayDate(order.payoutPaidAt)}</p></div><div className="commission-proof-actions">{order.payoutReceipt?<a className="btn secondary" href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View payment receipt</a>:<em>Receipt not attached</em>}{onViewCommission&&<button className="commission-detail-link" type="button" onClick={()=>onViewCommission(order.id)}>Commission details <ArrowRight/></button>}</div></div>:<div className="commission-journey"><div className="commission-track"><i className="complete"/><i className={dispatched?'complete':''}/><i className={delivered?'complete':''}/><i className={paid?'complete':''}/></div><div className="commission-steps"><span className="complete"><b><Check/></b><strong>Order placed</strong><small>Submitted to CAMY</small></span><span className={dispatched?'complete current':'current'}><b><Truck/></b><strong>{dispatched?'Dispatched':'CAMY processing'}</strong><small>{dispatched?'On the way to client':'Preparing the order'}</small></span><span className={delivered?'complete current':''}><b><PackageCheck/></b><strong>Delivered</strong><small>CAMY collects COD</small></span><span className={paid?'complete current':''}><b><Banknote/></b><strong>Commission paid</strong><small>Receipt appears here</small></span></div></div>}
    </section>
  }
  return <section className="payout-panel-v3">
    {!compact&&<><header><span><Banknote/></span><div><small>COD MONEY FLOW</small><h3>Collection and entrepreneur payout</h3><p>See exactly what CAMY keeps and what must be transferred to the entrepreneur.</p></div><Status value={payoutLabel}/></header>
    <div className="money-flow-v3"><article className="client"><small>Customer pays CAMY</small><strong>{money(clientTotal)}</strong><span>Cash on delivery</span></article><ArrowRight/><article className="camy"><small>CAMY product value</small><strong>{money(camyCost)}</strong><span>Company collection</span></article><b className="money-plus">+</b><article className="profit"><small>{entrepreneurName}'s profit</small><strong>{money(margin)}</strong><span>{payoutLabel}</span></article></div>
    <div className="collection-state-v3"><span><Check/> Client collection</span><strong>{order.clientPaymentStatus||(order.status==='Delivered'?'Collected by CAMY':'Collect on delivery')}</strong></div>
    {order.payoutStatus==='pending_transfer'&&<div className="payout-deadline-v3"><CalendarDays/><span><strong>Commission ready for payment</strong><small>No fixed payment date. CAMY can transfer this commission at any time.</small></span></div>}</>}
    {order.payoutStatus==='paid'&&<div className="payout-complete-v3"><span><BadgeCheck/></span><div><strong>Entrepreneur payout recorded</strong><small>Reference {order.payoutReference||'Recorded'} · {displayDate(order.payoutPaidAt)}</small></div>{order.payoutReceipt&&<a className="btn secondary" href={order.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> View receipt</a>}</div>}
    {order.payoutStatus==='reversal_required'&&<div className="login-error">This order was returned after the margin was transferred. Finance reconciliation is required.</div>}
    {payoutNeedsBank&&<div className="payout-bank-blocker-v3"><span><CreditCard/></span><div><small>BANK DETAILS NOT SAVED</small><strong>You can still record this payout</strong><p>Confirm the payment destination separately, then enter the transfer reference and attach proof below.</p></div><button type="button" className="btn secondary" onClick={onEditEntrepreneur}>Add bank details</button></div>}
    {canTransfer && <>
      <div className={`payout-bank-ready-v3 ${bankComplete ? '' : 'details-missing'}`}>
        <span>
          {bankComplete ? <><BadgeCheck/> Transfer to</> : <><CreditCard/> Payment destination</>}
        </span>
        <strong>{bankComplete ? `${bank.bank} · ${bank.branch}` : 'Confirm directly with entrepreneur'}</strong>
        <small>{bankComplete ? `${bank.holder} · ${bank.account}` : 'No bank account is saved on this profile'}</small>
      </div>

      <form className="payout-form-v3" onSubmit={upload}>
        <div className="payout-form-copy">
          <span><WalletCards/></span>
          <div>
            <small>FINAL FINANCE STEP</small>
            <h4>Record payment of {money(margin)}</h4>
            <p>Complete the transfer using the confirmed payment destination, then attach proof below.</p>
          </div>
        </div>

        <div className="payout-form-fields">
          <label>
            Transfer reference
            <input
              required
              maxLength="120"
              value={reference}
              onChange={event => setReference(event.target.value)}
              placeholder="Example: TXN-2026-001"
            />
          </label>

          <label className={`receipt-upload-v3 ${file ? 'selected' : ''}`}>
            <input
              required
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={chooseReceipt}
            />
            <FileText/>
            <span>
              <strong>{file ? 'Receipt selected' : 'Choose transfer receipt'}</strong>
              <small>{file ? file.name : 'JPG, PNG, WebP or PDF · maximum 5 MB'}</small>
            </span>
          </label>
        </div>

        {error && <p className="market-error">{error}</p>}
        <Button
          type="submit"
          disabled={busy}
          icon={Banknote}
        >
          {busy ? 'Saving payout…' : 'Confirm payout and save proof'}
        </Button>
      </form>
    </>}
    {admin&&order.status!=='Delivered'&&margin>0&&<div className="payout-locked-v3"><Truck/><span><strong>Payout is locked</strong><small>It becomes available after this order is marked delivered.</small></span></div>}
  </section>
}

function PendingClientDetailsEditor({ order, onDone, admin=false }) {
  const suffix=String(order.district||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const originalAddress=order.deliveryAddress??String(order.address||'').replace(new RegExp(`,?\\s*${suffix}$`),'')
  const [draft,setDraft]=useState({name:order.customer||'',phone:order.phone||'',district:order.district||'',address:originalAddress,notes:order.notes||''})
  const [editing,setEditing]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const save=async event=>{event.preventDefault();const clean=draft.phone.replace(/[\s()-]/g,'');if(!draft.name.trim())return setError('Enter the client name.');if(!/^(?:0\d{9}|\+94\d{9})$/.test(clean))return setError('Use 10 digits starting with 0, or +94 followed by 9 digits.');if(!draft.district.trim())return setError('Enter the delivery district.');if(!draft.address.trim())return setError('Enter the client delivery address.');setBusy(true);setError('');try{const result=await api(`/marketplace/orders/${encodeURIComponent(order.id)}/client-details`,{method:'PATCH',body:JSON.stringify(draft)});onDone?.(result.order,result.message)}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  if(!editing)return <section className="pending-client-edit"><div><small>BEFORE DISPATCH</small><strong>Client details can still be changed</strong><p>{admin?'Update the client and delivery information before this order is dispatched.':'Update the phone, address, or other delivery information before CAMY dispatches the order.'}</p></div><button type="button" onClick={()=>setEditing(true)}><Pencil/> Edit client details</button></section>
  return <form className="pending-client-form" onSubmit={save}><header><div><small>EDIT BEFORE DISPATCH</small><h3>Client delivery details</h3></div><button type="button" onClick={()=>{setEditing(false);setError('')}}>Cancel</button></header><div><label>Client name<input required maxLength="150" value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label><label>Phone number<input required inputMode="tel" value={draft.phone} onChange={event=>setDraft({...draft,phone:event.target.value})}/></label><label>District<input required maxLength="80" value={draft.district} onChange={event=>setDraft({...draft,district:event.target.value})}/></label><label className="wide">Delivery address<textarea required rows="3" maxLength="500" value={draft.address} onChange={event=>setDraft({...draft,address:event.target.value})}/></label><label className="wide">Order note (optional)<textarea rows="2" maxLength="1000" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label></div>{error&&<p className="market-error" role="alert">{error}</p>}<Button type="submit" disabled={busy} icon={Check}>{busy?'Saving…':'Save client details'}</Button></form>
}

function CommissionPaymentHistory({ order, orders=[] }) {
  const history=orders.filter(item=>item.orderMode==='dropship'&&String(item.entrepreneurId)===String(order.entrepreneurId)&&item.payoutStatus==='paid'&&item.id!==order.id).sort((a,b)=>String(b.payoutPaidAt||b.updatedAt||b.date).localeCompare(String(a.payoutPaidAt||a.updatedAt||a.date)))
  const total=history.reduce((sum,item)=>sum+Number(item.entrepreneurMargin||0),0)
  return <section className="admin-commission-history">
    <header><div><small>ENTREPRENEUR PAYMENT HISTORY</small><h3>Previous commission payments</h3><p>Use the member ID, references, and receipts to confirm this entrepreneur before paying.</p></div><span><strong>{history.length}</strong><small>PAST PAYMENTS</small></span></header>
    <div className="admin-commission-identity"><span><UserRound/></span><div><small>ENTREPRENEUR</small><strong>{order.entrepreneur||'Not assigned'}</strong><p>Member ID: {order.entrepreneurId||'Not available'}</p></div><b>{money(total)}<small>TOTAL PREVIOUSLY PAID</small></b></div>
    {history.length?<div className="admin-commission-history-list">{history.map(item=><article key={item.id}><span><BadgeCheck/></span><div><small>ORDER</small><strong>{item.id}</strong><p>Paid {displayDate(item.payoutPaidAt||item.updatedAt||item.date)}</p></div><div><small>TRANSFER REFERENCE</small><strong>{item.payoutReference||'Recorded without reference'}</strong></div><b>{money(item.entrepreneurMargin)}</b>{item.payoutReceipt?<a href={item.payoutReceipt} target="_blank" rel="noreferrer"><FileText/> Receipt</a>:<em>No receipt</em>}</article>)}</div>:<p className="admin-commission-history-empty">No previous commission payments are recorded for this entrepreneur.</p>}
  </section>
}

function OrderModal({ order: initialOrder, orders = [], products = [], admin = false, entrepreneur, openEntrepreneur, close, onUpdated, onViewCommission, onManageDeliveries }) {
  const [order,setOrder]=useState(initialOrder)
  const returnToSource=()=>{close();window.dispatchEvent(new Event('camy-return-from-order'))}
  const [savedMessage,setSavedMessage]=useState('')
  useEffect(()=>setOrder(initialOrder),[initialOrder])
  const keepOrderOpen=(updated,message='Changes saved successfully.')=>{
    if(updated)setOrder(current=>({...updated,...(current.payoutOnly?{payoutOnly:true}:{})}))
    setSavedMessage(message)
    message&&window.dispatchEvent(new CustomEvent('camy-finance-message',{detail:message}))
    onUpdated?.(updated)
  }
  const items=order.items?.length?order.items:[{name:order.product,qty:order.qty,price:order.qty?Number(order.amount)/Number(order.qty):Number(order.amount)}]
  const dropship=order.orderMode==='dropship'
  const cancelled=order.status==='Cancelled'
  const returned=order.status==='Returned'
  const closed=cancelled||returned
  const camyCost=Number(order.camyCost??order.amount)
  const margin=Number(order.entrepreneurMargin||0)
  const entrepreneurName=entrepreneur?.name||order.entrepreneur||'Entrepreneur'
  const profitLabel=admin?`${entrepreneurName}'s profit`:'My profit'
  const paymentBank={
    bank:entrepreneur?.bank||entrepreneur?.bankDetails?.bank||'',
    branch:entrepreneur?.branch||entrepreneur?.bankDetails?.branch||'',
    holder:entrepreneur?.accountName||entrepreneur?.bankDetails?.holder||'',
    account:entrepreneur?.accountNumber||entrepreneur?.account||entrepreneur?.bankDetails?.account||''
  }
  const paymentBankComplete=Object.values(paymentBank).every(value=>String(value||'').trim())
  const progress=['Processing','Dispatched','Delivered']
  const current=progress.indexOf(order.status)
  if(order.payoutOnly)return <Modal onClose={returnToSource} wide className="commission-payment-modal"><div className="commission-payment-dialog">
    <div className="commission-payment-nav">
      <button type="button" className="order-modal-back" onClick={returnToSource}><ArrowLeft/> Back to commission payments</button>
      {admin&&<button type="button" className="manage-deliveries-button" onClick={()=>onManageDeliveries?.(order.id)}><Truck/> Manage delivery <ArrowRight/></button>}
    </div>
    {savedMessage&&<div className="order-save-confirmation" role="status"><BadgeCheck/><span><strong>Saved successfully</strong><small>{savedMessage} You can review the updated details below.</small></span></div>}
    <header><span><Banknote/></span><div><small>COMMISSION PAYMENT</small><h2>Pay {entrepreneur?.name||order.entrepreneur||'entrepreneur'}</h2><p>Order {order.id} · Delivered {displayDate(order.deliveredAt||order.date)}</p></div></header>
    <section className="commission-order-review">
      <header><div><small>WHY THIS PAYMENT IS DUE</small><h3>Delivered COD order details</h3></div><Status value={order.status}/></header>
      <div className="commission-order-meta">
        <span><small>Order reference</small><strong>{order.id}</strong></span>
        <span><small>Client</small><strong>{order.customer||'Not provided'}</strong><em>{order.phone||'No phone number'}</em></span>
        <span><small>Delivery location</small><strong>{order.district||'Not provided'}</strong><em>{order.address||'No delivery address'}</em></span>
      </div>
      <div className="commission-products">{items.map((item,index)=>{
        const product=products.find(entry=>String(entry.id)===String(item.id||item.productId))
        const qty=Number(item.qty||0)
        const clientPrice=Number(item.price||0)
        const basePrice=Number(item.camyPrice??product?.price??clientPrice)
        return <article key={item.id||item.productId||index}><div>{product?.image?<img src={product.image} alt=""/>:<span><PackageOpen/></span>}<p><strong>{item.name||product?.name||'CAMY product'}</strong><small>{product?.code||item.category||'Product item'}</small></p></div><dl><span><dt>Qty</dt><dd>{qty}</dd></span><span><dt>Client price</dt><dd>{money(clientPrice)}</dd></span><span><dt>CAMY price</dt><dd>{money(basePrice)}</dd></span><span><dt>Margin</dt><dd>{money((clientPrice-basePrice)*qty)}</dd></span></dl></article>
      })}</div>
    </section>
    <section className="commission-payment-summary"><div><small>Client COD collected</small><strong>{money(order.amount)}</strong></div><div><small>Less: CAMY product value</small><strong>{money(camyCost)}</strong></div><div><small>Equals: commission to transfer</small><strong>{money(margin)}</strong></div></section>
    <section className={`commission-bank-card ${paymentBankComplete?'':'missing'}`}>
      <header><span><CreditCard/></span><div><small>PAYMENT DESTINATION</small><h3>Entrepreneur bank account</h3></div>{paymentBankComplete?<b><BadgeCheck/> Complete details</b>:<b>Details incomplete</b>}</header>
      <div><span><small>Bank</small><strong>{paymentBank.bank||'Not provided'}</strong></span><span><small>Branch</small><strong>{paymentBank.branch||'Not provided'}</strong></span><span><small>Account holder</small><strong>{paymentBank.holder||'Not provided'}</strong></span><span><small>Account number</small><strong>{paymentBank.account||'Not provided'}</strong></span></div>
      {!paymentBankComplete&&<button type="button" onClick={openEntrepreneur}><Pencil/> Complete bank details before transfer</button>}
    </section>
    {admin&&<CommissionPaymentHistory order={order} orders={orders}/>}
    <DropshipPayoutPanel compact order={order} admin={admin} entrepreneur={entrepreneur} onEditEntrepreneur={openEntrepreneur} onDone={keepOrderOpen}/>
  </div></Modal>
  return <Modal onClose={returnToSource} wide className={`order-detail-shell ${admin ? 'admin-order-detail' : 'entrepreneur-order-detail'}`}><div className="detail-modal order-detail-v3">
    {savedMessage&&<div className="order-save-confirmation" role="status"><BadgeCheck/><span><strong>Saved successfully</strong><small>{savedMessage} This order remains open so you can verify the update.</small></span></div>}
    <header className="order-hero-v3"><div><span className="modal-kicker">{dropship?'CAMY COD ORDER':'CUSTOMER ORDER'}</span><h2>{order.id}</h2><p>Placed {displayDate(order.date)} · {items.length} product{items.length===1?'':'s'} · {Number(order.qty||0)} unit{Number(order.qty||0)===1?'':'s'}</p></div><Status value={order.status}/></header>
    <section className={`order-glance-v3 ${admin?'':'entrepreneur-glance'}`}><article><span><UserRound/></span><div><small>Client</small><strong>{order.customer||'Not provided'}</strong><a href={order.phone?`tel:${order.phone}`:undefined}>{order.phone||'No phone number'}</a></div></article><article><span><MapPin/></span><div><small>Client delivery</small><strong>{order.district||'District not provided'}</strong><p>{order.address||'Delivery address not provided'}</p></div></article>{admin&&<article><span><Store/></span><div><small>Entrepreneur who placed the sale</small><strong>{order.entrepreneur||'Not assigned'}</strong><p>{order.entrepreneurId||'No member ID'}</p><button type="button" onClick={openEntrepreneur}>Open entrepreneur profile <ArrowRight/></button></div></article>}</section>{dropship&&<section className="order-client-meta-v3 concise"><span><small>Payment</small><strong>Cash on Delivery</strong></span><span><small>Order note</small><strong>{order.notes||'No special note'}</strong></span></section>}
    {dropship&&['Pending','Awaiting payment','Payment review','Approved','Processing'].includes(order.status)&&<PendingClientDetailsEditor order={order} admin={admin} onDone={keepOrderOpen}/>}
    <section className="ordered-products-v3"><header><div><small>{returned?'RETURNED PRODUCTS':'ORDER BASKET'}</small><h3>{returned?'Products returned in this order':'Products in this order'}</h3></div><b>{items.length} item{items.length===1?'':'s'}</b></header><div>{items.map((item,index)=>{const product=products.find(entry=>String(entry.id)===String(item.id||item.productId));const base=Number(item.camyPrice??product?.price??item.price);const sell=Number(item.price);const qty=Number(item.qty||0);return <article key={item.id||item.productId||index}><div className="product-main-v3">{product?.image?<img src={product.image} alt=""/>:<span><PackageOpen/></span>}<div><small>{product?.code||item.category||'CAMY PRODUCT'}</small><strong>{item.name||product?.name||'CAMY product'}</strong></div></div>{dropship&&!closed&&<dl><div><dt>CAMY price</dt><dd>{money(base)}</dd></div><div><dt>Client price</dt><dd>{money(sell)}</dd></div><div><dt>Quantity</dt><dd>{qty}</dd></div><div><dt>{profitLabel}</dt><dd className="positive">{money((sell-base)*qty)}</dd></div></dl>}{closed&&<dl><div><dt>Quantity</dt><dd>{qty}</dd></div></dl>}<strong className="line-total-v3"><small>{returned?'Returned value':cancelled?'Cancelled order value':'Line total'}</small>{money(sell*qty)}</strong></article>})}</div></section>
    <section className={`order-total-v3 ${closed?'cancelled-total':''}`}><div><small>{returned?'RETURNED ORDER VALUE':cancelled?'CANCELLED ORDER VALUE':'CLIENT ORDER TOTAL'}</small><strong>{money(order.amount)}</strong></div>{dropship&&!closed&&<><span><small>CAMY value</small><strong>{money(camyCost)}</strong></span><span className="profit"><small>{profitLabel}</small><strong>{money(margin)}</strong></span></>}</section>
    {dropship&&!closed&&<OrderInvoicePanel order={order} admin={admin} onDone={keepOrderOpen}/>}
    {!dropship&&<section className="supply-payment"><h3>Payment information</h3><p>Payment reference: <strong>{order.reference||'Not submitted'}</strong></p>{order.bankDetails&&<BankDetails bank={order.bankDetails}/>} {!order.receipt&&<p>No payment receipt submitted yet.</p>}</section>}
    {dropship&&!closed&&<DropshipPayoutPanel order={order} admin={admin} entrepreneur={entrepreneur} onEditEntrepreneur={openEntrepreneur} onViewCommission={!admin?onViewCommission:undefined} onDone={keepOrderOpen}/>}
    <section className="fulfilment-panel-v3"><header><div><small>FULFILMENT</small><h3>{returned?'Return status':dropship&&!admin?'Order tracking':'Next order action'}</h3></div>{!closed&&<div className="mini-progress-v3">{progress.map((step,index)=><span className={current>=index?'done':''} key={step}><i>{current>index?<Check/>:index+1}</i>{step}</span>)}</div>}</header><OrderReview key={order.id+order.status} order={order} readOnly={dropship&&!admin} onDone={(status,updated)=>keepOrderOpen(updated,`Order updated to ${status}.`)}/></section>
    {returned?<div className="order-terminal-v3">This order was returned. Warehouse stock was restored and the profit for this order was cancelled.</div>:['Rejected','Cancelled'].includes(order.status)&&<div className="order-terminal-v3">This order is {order.status.toLowerCase()}. Reserved warehouse stock has been restored.</div>}
  </div></Modal>
}

function RegistrationBusinessFields({ form, update }) { return <div className="registration-grid"><label className="wide">Current occupation<select required value={form.occupation} onChange={e=>update('occupation',e.target.value)}><option value="">Select your occupation</option>{occupations.map(occupation=><option key={occupation}>{occupation}</option>)}</select></label><label>Are you currently doing an online business?<select required value={form.hasOnlineBusiness} onChange={e=>update('hasOnlineBusiness',e.target.value)}><option value="">Choose one</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>Facebook marketing / boosting knowledge<select required value={form.facebookMarketing} onChange={e=>update('facebookMarketing',e.target.value)}><option value="">Choose one</option><option value="yes">Yes, confident</option><option value="a_little">A little</option><option value="no">No, I need help</option></select></label>{form.hasOnlineBusiness==='yes'&&<><label>What do you mainly sell?<select required value={form.onlineBusinessProducts} onChange={e=>update('onlineBusinessProducts',e.target.value)}><option value="">Select a category</option>{businessCategories.map(category=><option key={category}>{category}</option>)}</select></label><label>How long have you been selling online?<select required value={form.onlineBusinessDuration} onChange={e=>update('onlineBusinessDuration',e.target.value)}><option value="">Select your experience</option>{businessDurations.map(duration=><option key={duration}>{duration}</option>)}</select></label><label>Average monthly online income<select required value={form.monthlyIncome} onChange={e=>update('monthlyIncome',e.target.value)}><option value="">Select a range</option>{incomeRanges.map(range=><option key={range}>{range}</option>)}</select></label></>}<label className="wide">Social-media page link <small>Optional · Facebook, Instagram, or TikTok</small><input type="url" value={form.socialMediaUrl} onChange={e=>update('socialMediaUrl',e.target.value)} placeholder="https://facebook.com/yourpage"/></label><label>Followers on your main page<select value={form.followersCount} onChange={e=>update('followersCount',e.target.value)}><option value="">Select a range (optional)</option>{followerRanges.map(range=><option key={range.value} value={range.value}>{range.label}</option>)}</select></label></div> }

function AddEntrepreneurModal({ close, submit }) {
  const [form,setForm]=useState({name:'',email:'',password:'',confirmPassword:'',phone:'',nic:'',address:'',city:'',joined:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Colombo'}),occupation:'',hasOnlineBusiness:'',onlineBusinessProducts:'',onlineBusinessDuration:'',monthlyIncome:'',socialMediaUrl:'',followersCount:'',facebookMarketing:'',joinReason:'',agreementAccepted:false,nicFrontImage:'',nicBackImage:''})
  const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  const [reading,setReading]=useState(0)
  const update=(key,value)=>setForm(old=>({...old,[key]:value}))
  const uploadNic=(key,event)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Use a JPG, PNG or WebP NIC photo up to 5 MB.');return}setError('');setReading(count=>count+1);const reader=new FileReader();reader.onload=()=>update(key,String(reader.result));reader.onerror=()=>setError('Could not read the NIC photo. Please try again.');reader.onloadend=()=>setReading(count=>count-1);reader.readAsDataURL(file)}
  const save=async event=>{event.preventDefault();setError('');if(!form.nicFrontImage||!form.nicBackImage){setError('Upload both the front and back of the entrepreneur’s NIC.');return}if(form.password!==form.confirmPassword){setError('The two passwords do not match.');return}if(!form.agreementAccepted){setError('Confirm the entrepreneur’s information and consent before creating the account.');return}setBusy(true);try{const {confirmPassword,...payload}=form;const created=await submit(payload);if(created!==false)close()}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  return <Modal onClose={()=>!busy&&close()} wide className="manual-registration-modal"><form className="form-modal entrepreneur-create-form manual-registration-form" onSubmit={save}>
    <header className="entrepreneur-create-head"><span><UserPlus/></span><div><small>ADMIN-CREATED ACCOUNT</small><h2>Add an entrepreneur</h2><p>Create the member profile and a secure temporary login in one step.</p></div></header>
    {error&&<div className="login-error" role="alert">{error}</div>}
    <fieldset disabled={busy}>
    <section className="manual-registration-section"><header><span>01 · PERSONAL & LOGIN DETAILS</span><h3>Member information</h3><p>Use the same details and NIC photos required for a registration.</p></header>
    <div className="entrepreneur-field-grid">
      <label className="wide">Full name<input required autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter the entrepreneur's full name"/></label>
      <label className="wide">Login email<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label>
      <label>WhatsApp number<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="07X XXX XXXX"/></label>
      <label>NIC number<input required value={form.nic} onChange={e=>setForm({...form,nic:e.target.value})} placeholder="NIC number"/></label>
      <label className="wide">Home address<textarea required rows="3" autoComplete="street-address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="House number, street and area"/></label>
      <label>City / district<select required autoComplete="address-level2" value={form.city} onChange={e=>update('city',e.target.value)}><option value="">Select your district</option>{districts.map(district=><option key={district}>{district}</option>)}</select></label>
      <label>Joined date<input required type="date" value={form.joined} onChange={e=>setForm({...form,joined:e.target.value})}/></label>
      <label className="wide entrepreneur-password-field">Temporary password<input required minLength="8" type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/><small>The entrepreneur will change this after first sign-in.</small></label>
      <label className="wide">Confirm temporary password<input required minLength="8" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e=>update('confirmPassword',e.target.value)} placeholder="Enter password again"/></label>
    </div>
    <div className="nic-upload-grid">{[['nicFrontImage','front'],['nicBackImage','back']].map(([key,side])=><label className={form[key]?'ready':''} key={key}><strong>NIC {side} photo</strong><small>Clear JPG, PNG or WebP · max 5 MB</small>{form[key]&&<img src={form[key]} alt={`Selected NIC ${side}`}/>}<span>{form[key]?'Photo ready · choose to replace':`Choose ${side} photo`}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event=>uploadNic(key,event)}/></label>)}</div>
    </section>
    <section className="manual-registration-section"><header><span>02 · BUSINESS BACKGROUND</span><h3>Business & marketing experience</h3><p>Record the entrepreneur’s answers to the registration questions.</p></header><RegistrationBusinessFields form={form} update={update}/></section>
    <section className="manual-registration-section"><header><span>03 · FINAL CONFIRMATION</span><h3>Goals & consent</h3></header><label>What is your main reason for joining CAMY?<select required value={form.joinReason} onChange={event=>update('joinReason',event.target.value)}><option value="">Select your main goal</option>{joinReasons.map(reason=><option key={reason}>{reason}</option>)}</select></label><label className="registration-agreement"><input required type="checkbox" checked={form.agreementAccepted} onChange={event=>update('agreementAccepted',event.target.checked)}/><span>I confirm that the entrepreneur provided these details, confirmed they are correct, and consented to CAMY reviewing their information and NIC photos.</span></label><p className="manual-registration-note"><Check/>This account activates immediately. The entrepreneur must change the temporary password after first sign-in.</p></section>
    </fieldset>
    <footer className="entrepreneur-create-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><Button type="submit" disabled={busy||reading>0} icon={UserPlus}>{busy?'Creating account…':reading?'Reading NIC photos…':'Create account'}</Button></footer>
  </form></Modal>
}

function LegacyEntrepreneurModal({ person, orders, close, setEntrepreneurs, notify, readOnly=false }) {
  const memberOrders=orders.filter(order=>String(order.entrepreneurId)===String(person.id))
  const delivered=memberOrders.filter(order=>order.status==='Delivered').length
  const active=memberOrders.filter(order=>!['Delivered','Returned'].includes(order.status)).length
  const change=()=>{setEntrepreneurs(old=>old.map(p=>p.id===person.id?{...p,stage:p.stage==='Trial seller'?'Credit eligible':'Trial seller',credit:p.stage==='Trial seller'?10000:0}:p));notify('Entrepreneur stage updated');close()}
  return <Modal onClose={close} wide><div className="detail-modal person-modal"><div className="member-detail-head"><div className="large-avatar"><img src={avatarFor(person)} alt={person.name} onError={event=>{event.currentTarget.style.display='none';event.currentTarget.nextElementSibling.style.display='grid'}} /><span>{person.initials}</span></div><div><span className="modal-kicker">MEMBER PROFILE · {person.id}</span><h2>{person.name}</h2><Status value={person.stage}/></div></div><div className="member-contact"><span><small>NIC number</small><strong>{person.nic}</strong></span><span><small>Contact number</small><strong>{person.phone}</strong></span><span><small>Location</small><strong>{person.city}</strong></span><span><small>Joined</small><strong>{displayDate(person.joined)}</strong></span></div><section className="member-summary"><div><small>Total sales</small><strong>{money(person.sales)}</strong><span>Lifetime sales</span></div><div><small>Credit limit</small><strong>{money(person.credit)}</strong><span>Approved limit</span></div><div><small>Outstanding</small><strong className={person.used?'danger':''}>{money(person.used)}</strong><span>Current balance</span></div><div><small>Orders</small><strong>{memberOrders.length}</strong><span>{active} active</span></div></section><section className="member-orders"><div className="member-section-title"><h3>Order activity</h3><span>{delivered} delivered</span></div>{memberOrders.length?<div>{memberOrders.map(order=><article key={order.id}><span><strong>{order.id}</strong><small>{order.product} · {displayDate(order.date)}</small></span><b>{money(order.amount)}</b><Status value={order.status}/></article>)}</div>:<p>No orders recorded for this entrepreneur.</p>}</section><EntrepreneurCustomers orders={memberOrders}/>{!readOnly&&<div className="member-detail-actions"><Button variant="secondary" icon={Settings} onClick={change}>{person.stage==='Trial seller'?'Approve credit eligibility':'Move to trial stage'}</Button></div>}</div></Modal>
}

function EntrepreneurModal({ person, orders, requests=[], settlements=[], tiers=[], setOrders, close, setEntrepreneurs, notify, openOrder, readOnly=false }) {
  const baseDraft=value=>({...value,bank:value.bank||value.bankDetails?.bank||'',branch:value.branch||value.bankDetails?.branch||'',accountName:value.accountName||value.bankDetails?.holder||value.name||'',accountNumber:value.accountNumber||value.bankDetails?.account||''})
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState(()=>baseDraft(person))
  const [application,setApplication]=useState(null)
  const [summary,setSummary]=useState(null)
  const [loading,setLoading]=useState(true)
  const [resetOpen,setResetOpen]=useState(false)
  const [tempPassword,setTempPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [view,setView]=useState(()=>{const initial=globalThis.__camyEntrepreneurInitialView||'profile';globalThis.__camyEntrepreneurInitialView='profile';return initial})
  const [selectedRequest,setSelectedRequest]=useState(null)
  const memberOrders=orders.filter(order=>String(order.entrepreneurId)===String(person.id))
  const memberRequests=(requests.length?requests:(globalThis.__camyCreditRequests||[])).filter(request=>String(request.entrepreneurId)===String(person.id))
  const commissionOrders=memberOrders.filter(order=>order.orderMode==='dropship'&&Number(order.entrepreneurMargin||0)>0)
  const paidCommissions=commissionOrders.filter(order=>order.payoutStatus==='paid')
  const commissionPaidTotal=paidCommissions.reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const commissionPendingTotal=commissionOrders.filter(order=>['pending_delivery','pending_transfer'].includes(order.payoutStatus)).reduce((sum,order)=>sum+Number(order.entrepreneurMargin||0),0)
  const sortedTiers=[...(tiers.length?tiers:(globalThis.__camyCreditTiers||[]))].sort((a,b)=>Number(a.sales||0)-Number(b.sales||0))
  openOrder=openOrder||globalThis.__camyOpenAdminOrder
  const delivered=memberOrders.filter(order=>order.status==='Delivered').length
  const active=memberOrders.filter(order=>!['Delivered','Returned','Rejected'].includes(order.status)).length
  const totalUnits=memberOrders.reduce((sum,order)=>sum+Number(order.qty||0),0)
  const update=(key,value)=>setDraft(old=>({...old,[key]:value}))

  useEffect(()=>{
    let live=true
    api('/admin/entrepreneurs/'+encodeURIComponent(person.id)).then(result=>{
      if(!live)return
      const next=baseDraft({...person,...result.person})
      setDraft(next);setApplication(result.application||null);setSummary(result.summary||null)
      setEntrepreneurs(old=>old.map(item=>item.id===person.id?{...item,...result.person}:item))
    }).catch(reason=>notify(reason.message)).finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[person.id])

  const save=async()=>{
    setBusy(true)
    try{
      const result=await api('/admin/entrepreneurs/'+encodeURIComponent(person.id),{method:'PATCH',body:JSON.stringify(draft)})
      const next=baseDraft({...draft,...result.person})
      setDraft(next);setEntrepreneurs(old=>old.map(item=>item.id===person.id?{...item,...result.person}:item));setEditing(false)
      notify('Entrepreneur account details saved.')
      close()
    }catch(reason){notify(reason.message)}finally{setBusy(false)}
  }
  const remove=async()=>{
    if(!window.confirm(`Remove ${draft.name} from the active CAMY system? Their login will be disabled. Order and application history will be retained for records.`))return
    setBusy(true)
    try{
      const result=await api('/admin/entrepreneurs/'+encodeURIComponent(person.id),{method:'DELETE',body:'{}'})
      setEntrepreneurs(old=>old.map(item=>item.id===person.id?{...item,...result.person,active:false}:item))
      notify('Entrepreneur removed from the active system. Login access is disabled.')
      close()
    }catch(reason){notify(reason.message)}finally{setBusy(false)}
  }
  const reactivate=async()=>{
    setBusy(true)
    try{
      const result=await api('/admin/entrepreneurs/'+encodeURIComponent(person.id)+'/reactivate',{method:'POST',body:'{}'})
      const next=baseDraft({...draft,...result.person,accountStatus:'active',active:true})
      setDraft(next);setEntrepreneurs(old=>old.map(item=>item.id===person.id?{...item,...result.person,active:true}:item));notify(result.message)
    }catch(reason){notify(reason.message)}finally{setBusy(false)}
  }
  const resetPassword=async event=>{
    event.preventDefault()
    if(tempPassword.length<8||!/[A-Za-z]/.test(tempPassword)||!/\d/.test(tempPassword)){notify('Temporary password needs at least 8 characters with letters and numbers.');return}
    setBusy(true)
    try{
      const result=await api('/admin/entrepreneurs/'+encodeURIComponent(person.id)+'/reset-password',{method:'POST',body:JSON.stringify({password:tempPassword})})
      setTempPassword('');setResetOpen(false);notify(result.message)
    }catch(reason){notify(reason.message)}finally{setBusy(false)}
  }
  const appValue=value=>value===null||value===undefined||value===''?'Not provided':value
  const marketing={yes:'Yes',a_little:'A little',no:'No'}[application?.facebook_marketing]||application?.facebook_marketing
  const accountActive=draft.active!==false&&draft.accountStatus!=='inactive'&&draft.accountStatus!=='suspended'&&draft.stage!=='Departed'

  return <Modal onClose={close} wide className="entrepreneur-record-modal"><div className={`detail-modal entrepreneur-record admin-entrepreneur-record view-${view}`}>
    <header className="entrepreneur-record-head">
      <div className="editable-avatar">{avatarFor(draft)?<img src={avatarFor(draft)} alt={draft.name}/>:<span className="editable-avatar-initials">{initialsFor(draft)}</span>}{editing&&<label title="Change profile photo"><Pencil/><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>readImageFile(event,update)}/></label>}</div>
      <div><span className="modal-kicker">MEMBER PROFILE · {draft.id}</span>{editing?<input className="member-name-input" value={draft.name||''} onChange={event=>update('name',event.target.value)}/>:<h2>{draft.name}</h2>}<div className="member-status-line"><Status value={draft.stage||'Trial seller'}/><span className={accountActive?'account-state active':'account-state inactive'}>{accountActive?'Login active':'Login disabled'}</span></div></div>
      <div className="record-head-actions">{editing?<><Button icon={Check} disabled={busy} onClick={save}>{busy?'Saving…':'Save all changes'}</Button><button disabled={busy} onClick={()=>{setDraft(baseDraft(person));setEditing(false)}}>Cancel</button></>:<Button variant="secondary" icon={Pencil} onClick={()=>setEditing(true)}>Edit all details</Button>}</div>
    </header>

    {loading&&<div className="admin-record-loading">Loading complete entrepreneur record…</div>}

    <nav className="entrepreneur-record-nav" aria-label="Entrepreneur record sections">
      {[['profile','Profile',UserRound],['orders','Orders',ShoppingBag],['commissions','Commissions',WalletCards],['stock','Stock requests',PackageOpen]].map(([id,label,Icon])=><button type="button" className={view===id?'active':''} key={id} onClick={()=>setView(id)}><Icon/><span>{label}</span><b>{id==='orders'?memberOrders.length:id==='commissions'?commissionOrders.length:id==='stock'?memberRequests.length:''}</b></button>)}
    </nav>

    {view==='profile'&&<>
    <section className="admin-account-section">
      <div className="member-section-title"><div><span>PERSONAL & ACCOUNT</span><h3>Identity, contact and membership</h3></div><UserRound/></div>
      <div className="admin-profile-grid">
        {[
          ['email','Login email','email'],
          ['nic','NIC number','text'],
          ['phone','WhatsApp / contact','text'],
          ['city','City / district','text'],
          ['joined','Joined date','date'],
        ].map(([key,label,type])=><label key={key}><small>{label}</small>{editing?<input type={type} value={draft[key]||''} onChange={event=>update(key,event.target.value)}/>:<strong>{key==='joined'?displayDate(draft[key]):appValue(draft[key])}</strong>}</label>)}
        <label className="wide"><small>Home address</small>{editing?<textarea rows="2" value={draft.address||''} onChange={event=>update('address',event.target.value)}/>:<strong>{appValue(draft.address)}</strong>}</label>
      </div>
      <div className="account-audit-grid">
        <span><small>Account created</small><strong>{displayDate(draft.accountCreated)}</strong></span>
        <span><small>Last login</small><strong>{draft.lastLogin?displayDate(draft.lastLogin):'Never signed in'}</strong></span>
        <span><small>Account status</small><strong>{draft.accountStatus|| (accountActive?'active':'inactive')}</strong></span>
        <span><small>90-day sale rule</small><strong>{summary?.lastDeliveredAt?`Last delivered ${displayDate(summary.lastDeliveredAt)}`:'No delivered sale recorded'}</strong></span>
      </div>
      <div className="account-access-actions">
        {resetOpen?<form className="inline-password-reset" onSubmit={resetPassword}><label>New temporary password<input autoFocus type="password" minLength="8" value={tempPassword} onChange={event=>setTempPassword(event.target.value)} placeholder="8+ characters, letters & numbers"/></label><Button type="submit" disabled={busy}>Set temporary password</Button><Button type="button" variant="soft" onClick={()=>{setResetOpen(false);setTempPassword('')}}>Cancel</Button></form>:<Button variant="soft" icon={Settings} onClick={()=>setResetOpen(true)}>Reset login password</Button>}
        {application?.id&&<><a className="btn secondary" href={`/api/admin/registrations/${application.id}/nic/front`} target="_blank" rel="noreferrer">NIC front</a><a className="btn secondary" href={`/api/admin/registrations/${application.id}/nic/back`} target="_blank" rel="noreferrer">NIC back</a></>}
        {!application?.id&&draft.nic&&<a className="btn secondary" href={`/api/admin/entrepreneurs/${draft.id}/nic`} target="_blank" rel="noreferrer">View NIC</a>}
      </div>
    </section>

    <section className="member-summary">
      <div><small>Total verified sales</small><strong>{money(draft.sales)}</strong><span>Delivered orders only</span></div>
      <div><small>Credit limit</small><strong>{money(draft.credit)}</strong><span>Rule-based limit</span></div>
      <div><small>Outstanding</small><strong className={draft.used?'danger':''}>{money(draft.used)}</strong><span>Current balance</span></div>
      <div><small>Orders / units</small><strong>{memberOrders.length} / {totalUnits}</strong><span>{active} active · {delivered} delivered</span></div>
    </section>

    {application&&<section className="admin-application-history">
      <div className="member-section-title"><div><span>ORIGINAL APPLICATION</span><h3>Entrepreneur registration answers</h3></div><FileText/></div>
      <div className="application-history-grid">
        <span><small>Occupation</small><strong>{appValue(application.occupation)}</strong></span>
        <span><small>Online business</small><strong>{application.has_online_business==='yes'?'Yes':'No'}</strong></span>
        <span><small>What they sell</small><strong>{appValue(application.online_business_products)}</strong></span>
        <span><small>Business duration</small><strong>{appValue(application.online_business_duration)}</strong></span>
        <span><small>Average monthly income</small><strong>{appValue(application.monthly_income)}</strong></span>
        <span><small>Followers</small><strong>{appValue(application.followers_count)}</strong></span>
        <span><small>Facebook marketing</small><strong>{appValue(marketing)}</strong></span>
        <span><small>Applied</small><strong>{displayDate(application.created_at)}</strong></span>
        <span className="wide"><small>Social-media page</small><strong>{application.social_media_url?<a href={application.social_media_url} target="_blank" rel="noreferrer">{application.social_media_url}</a>:'Not provided'}</strong></span>
        <span className="wide"><small>Why they joined CAMY</small><strong>{appValue(application.join_reason)}</strong></span>
        {application.admin_note&&<span className="wide"><small>Admin approval / rejection note</small><strong>{application.admin_note}</strong></span>}
      </div>
    </section>}

    <section className="bank-record"><div className="member-section-title"><div><span>BANKING DETAILS</span><h3>Settlement account</h3></div><BadgeCheck/></div><div>{[['bank','Bank name'],['branch','Branch'],['accountName','Account holder'],['accountNumber','Account number']].map(([key,label])=><label key={key}><small>{label}</small>{editing?<input value={draft[key]||''} onChange={event=>update(key,event.target.value)} placeholder={`Enter ${label.toLowerCase()}`}/>:<strong>{draft[key]||'Not provided'}</strong>}</label>)}</div></section>
    </>}

    {view==='orders'&&<section className="purchase-history"><div className="member-section-title"><div><span>COMPLETE ORDER HISTORY</span><h3>Orders handled by this entrepreneur</h3></div><b>{delivered} delivered · {totalUnits} units</b></div>{memberOrders.length?<div className="purchase-table"><div className="purchase-row head"><span>Date / aging</span><span>Order</span><span>Products</span><span>Qty</span><span>Amount</span><span>Status</span></div>{memberOrders.map(order=>{const days=Math.max(0,Math.floor((Date.now()-new Date(order.date).getTime())/86400000));return <button type="button" className="purchase-row" key={order.id} onClick={()=>openOrder?.(order)}><span><strong>{displayDate(order.date)}</strong><small>{days} days ago</small></span><span><strong>{order.id}</strong><small>{order.customer}</small></span><span><strong>{order.product}</strong><small>{order.items?.map(item=>`${item.name} × ${item.qty}`).join(', ')||'Catalogue item'}</small></span><span><strong>{order.qty}</strong></span><span><strong>{money(order.amount)}</strong></span><Status value={order.status}/></button>})}</div>:<Empty icon={PackageSearch} title="No order history" text="Client orders placed by this entrepreneur will appear here."/ >}</section>}

    {view==='commissions'&&<section className="record-activity-page commission-record-page"><div className="record-view-heading"><div><span>COMMISSION LEDGER</span><h3>Commission payment history</h3><p>Profit earned from customer orders and proof of every CAMY transfer.</p></div><div><strong>{money(commissionPaidTotal)}</strong><small>Total paid</small></div><div><strong>{money(commissionPendingTotal)}</strong><small>Pending</small></div></div><div className="commission-record-list">{commissionOrders.map(order=><article role="button" tabIndex="0" key={order.id} onClick={()=>openOrder?.(order,true)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openOrder?.(order,true)}}}><span className={`commission-record-icon ${order.payoutStatus==='paid'?'paid':''}`}>{order.payoutStatus==='paid'?<Check/>:<WalletCards/>}</span><div><strong>{order.id}</strong><small>{order.customer||'Customer'} · {displayDate(order.deliveredAt||order.date)}</small></div><span><small>Order value</small><strong>{money(order.amount)}</strong></span><span><small>Commission</small><strong>{money(order.entrepreneurMargin)}</strong></span><Status value={order.payoutStatus==='paid'?'Paid':order.payoutStatus==='pending_transfer'?'Ready to pay':'Waiting'}/>{order.payoutStatus==='paid'?<div className="commission-proof"><strong>{order.payoutReference||'Transfer recorded'}</strong>{order.payoutReceipt?<a href={order.payoutReceipt} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>View receipt</a>:<small>No receipt attached</small>}</div>:<small className="commission-waiting">{order.status==='Delivered'?'Ready for CAMY transfer':'Paid after successful delivery'}</small>}</article>)}</div>{!commissionOrders.length&&<Empty icon={WalletCards} title="No commission records" text="Drop-shipping commission activity will appear here."/>}</section>}

    {view==='stock'&&<section className="record-activity-page stock-request-record-page"><div className="record-view-heading"><div><span>CREDIT STOCK</span><h3>{selectedRequest?'Stock request details':'Stock request history'}</h3><p>{selectedRequest?'Review every product, quantity, value and the current request status.':'All credit-stock requests submitted by this entrepreneur and their current CAMY status.'}</p></div><div><strong>{money(draft.credit)}</strong><small>Current stock limit</small></div><div><strong>{money(Math.max(0,Number(draft.credit||0)-Number(draft.used||0)))}</strong><small>Available limit</small></div></div><section className="member-credit-tiers"><header><div><small>STOCK LIMIT TIERS</small><strong>Verified sales determine the credit-stock limit</strong></div><b>{money(draft.sales)} verified sales</b></header><div>{sortedTiers.map((tier,index)=>{const reached=Number(draft.sales||0)>=Number(tier.sales||0);const current=Number(draft.credit||0)===Number(tier.credit||0);return <article className={`${reached?'reached':''} ${current?'current':''}`} key={tier.id||index}><span>{current?<Check/>:index+1}</span><div><small>Verified sales</small><strong>{money(tier.sales)}</strong></div><ArrowRight/><div><small>Stock limit</small><strong>{money(tier.credit)}</strong></div>{current&&<b>Current tier</b>}</article>})}</div>{!sortedTiers.length&&<p>No stock-limit tiers have been configured.</p>}</section>{selectedRequest?<section className="stock-request-detail"><button type="button" onClick={()=>setSelectedRequest(null)}><ArrowLeft/> Back to all requests</button><header><div><small>REQUEST NUMBER</small><h3>{selectedRequest.id}</h3><p>Submitted {displayDate(selectedRequest.date||selectedRequest.createdAt)}</p></div><Status value={selectedRequest.status}/></header><div className="stock-request-detail-items">{(selectedRequest.items||[]).map((item,index)=><article key={item.productId||item.id||index}><div><strong>{item.name||item.productName||item.product||`Product ${index+1}`}</strong><small>{item.code||item.productId||''}</small></div><span><small>Quantity</small><strong>{item.qty||0}</strong></span><span><small>Unit price</small><strong>{money(item.price||item.unitPrice)}</strong></span><b>{money(Number(item.qty||0)*Number(item.price||item.unitPrice||0))}</b></article>)}</div><footer><span><small>Total units</small><strong>{selectedRequest.items?.reduce((sum,item)=>sum+Number(item.qty||0),0)||selectedRequest.qty||0}</strong></span><span><small>Request value</small><strong>{money(selectedRequest.total||selectedRequest.amount)}</strong></span>{selectedRequest.reason&&<span><small>Admin note</small><strong>{selectedRequest.reason}</strong></span>}</footer></section>:<><div className="stock-request-record-list">{memberRequests.map(request=><article role="button" tabIndex="0" key={request.id} onClick={()=>setSelectedRequest(request)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedRequest(request)}}}><span><PackageOpen/></span><div><strong>{request.id}</strong><small>{displayDate(request.date||request.createdAt)} · {request.items?.length||1} product type{(request.items?.length||1)===1?'':'s'}</small></div><div><small>Units</small><strong>{request.items?.reduce((sum,item)=>sum+Number(item.qty||0),0)||request.qty||0}</strong></div><div><small>Request value</small><strong>{money(request.total||request.amount)}</strong></div><Status value={request.status}/></article>)}</div>{!memberRequests.length&&<Empty icon={PackageOpen} title="No stock requests" text="Credit-stock requests submitted by this entrepreneur will appear here."/>}</>}</section>}

    <section className="admin-danger-zone">
      <div><span>ACCOUNT CONTROL</span><h3>{accountActive?'Remove entrepreneur from active CAMY':'Entrepreneur is currently inactive'}</h3><p>{accountActive?'This disables the entrepreneur login and removes them from the active entrepreneur list. Historical orders, application records and audit information stay available.':'You can reactivate the login if CAMY wants this entrepreneur to return.'}</p>{summary&&!summary.canRemove&&accountActive&&<small>Removal is locked until active orders, stock requests and outstanding credit are cleared.</small>}</div>
      {accountActive?<Button variant="secondary" icon={Trash2} disabled={busy||summary?.canRemove===false} onClick={remove}>Remove from system</Button>:<Button icon={Check} disabled={busy} onClick={reactivate}>Reactivate account</Button>}
    </section>
  </div></Modal>
}

function AddProductModal({ close, submit }) { const [mediaBusy,setMediaBusy]=useState(false); const [categories,setCategories]=useState(()=>JSON.parse(localStorage.getItem('camy-product-categories-v2')||'[]')); const [form,setForm]=useState({name:'',category:categories[0]||'Cookware',price:'',billingPrice:'',deliveryCost:0,packagingCost:0,freeDelivery:true,stock:'',code:'',image:'',tag:'',rating:'5',description:'',specs:'',warranty:'1 year'}); useEffect(()=>{const refresh=()=>setCategories(JSON.parse(localStorage.getItem('camy-product-categories-v2')||'[]'));window.addEventListener('camy-categories-updated',refresh);return()=>window.removeEventListener('camy-categories-updated',refresh)},[]); const update=(key,value)=>setForm(old=>({...old,[key]:value})); return <Modal onClose={close} wide><form className="form-modal add-product-form" onSubmit={e=>{e.preventDefault();if(mediaBusy)return;submit({...form,...productCosts(form),stock:Number(form.stock),rating:Number(form.rating),image:form.image||'/products/classic-set.png',specs:form.specs.split(',').map(s=>s.trim()).filter(Boolean)});close()}}><span className="modal-kicker">CATALOGUE</span><h2>Add a product</h2><p>Create a complete customer-ready item and place it in the right category.</p><label>Product name<input required value={form.name} onChange={e=>update('name',e.target.value)} placeholder="e.g. 24cm Non-stick Fry Pan" /></label><div className="two-fields"><label>Category<select value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(category=><option key={category}>{category}</option>)}</select></label><label>Model / code<input required value={form.code} onChange={e=>update('code',e.target.value)} placeholder="FP024" /></label></div><ProductCostEditor product={form} onChange={setForm}/><div className="two-fields"><label>Opening stock<input required min="0" type="number" value={form.stock} onChange={e=>update('stock',e.target.value)} /></label></div><div className="two-fields"><label>Tag<input value={form.tag} onChange={e=>update('tag',e.target.value)} placeholder="New or Best seller" /></label><label>Rating<input min="0" max="5" step="0.1" type="number" value={form.rating} onChange={e=>update('rating',e.target.value)} /></label></div><ProductMediaEditor onBusyChange={setMediaBusy} product={form} onChange={changes=>setForm(old=>({...old,...changes}))}/><label>Description<textarea rows="3" value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Describe the product for customers" /></label><label>Specifications <small>Separate each item with a comma</small><textarea rows="3" value={form.specs} onChange={e=>update('specs',e.target.value)} placeholder="Durable finish, Easy to clean" /></label><label>Warranty<input value={form.warranty} onChange={e=>update('warranty',e.target.value)} /></label><Button type="submit" disabled={mediaBusy} icon={Plus}>Add product</Button></form></Modal> }

function AddCategoryModal({ close, submit }) { const [name,setName]=useState(''); return <Modal onClose={close}><form className="form-modal" onSubmit={event=>{event.preventDefault();const value=name.trim();if(value)submit(value)}}><span className="modal-kicker">CATALOGUE STRUCTURE</span><h2>Add main category</h2><p>Create a new section for related products. You can assign products to it when adding or editing an item.</p><label>Category name<input required autoFocus value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Furniture" /></label><Button type="submit" icon={Grid2X2}>Create category</Button></form></Modal> }

function ChangePasswordModal({ required=false, close, done }) {
  const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''}); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  const submit=async event=>{event.preventDefault();setError('');if(form.newPassword!==form.confirmPassword){setError('New passwords do not match.');return}setBusy(true);try{const result=await api('/auth/change-password',{method:'POST',body:JSON.stringify(form)});done(result.message)}catch(reason){setError(reason.message)}finally{setBusy(false)}}
  return <Modal onClose={required?()=>{}:close} className="password-change-modal"><form className="form-modal password-change-form" onSubmit={submit}><header><span><Settings/></span><div><small>ACCOUNT SECURITY</small><h2>{required?'Set your new password':'Change password'}</h2></div></header><p>{required?'Sign in with your temporary password, then choose your own password before continuing.':'Use a strong password with at least 8 characters, including letters and numbers.'}</p>{error&&<div className="login-error">{error}</div>}<label>{required?'Temporary password':'Current password'}<input autoFocus required type="password" autoComplete="current-password" value={form.currentPassword} onChange={event=>setForm({...form,currentPassword:event.target.value})}/></label><div className="password-change-grid"><label>New password<input autoFocus={required} required minLength="8" type="password" autoComplete="new-password" value={form.newPassword} onChange={event=>setForm({...form,newPassword:event.target.value})}/><small>8+ characters with letters and numbers</small></label><label>Confirm new password<input required minLength="8" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={event=>setForm({...form,confirmPassword:event.target.value})}/></label></div><footer>{!required&&<button type="button" className="password-back" onClick={close}><ArrowRight/> Back to users &amp; access</button>}<Button type="submit" icon={Check} disabled={busy}>{busy?'Saving…':'Save new password'}</Button></footer></form></Modal>
}

function LoginScreen({ onLogin }) {
  const emptyForm={email:'',password:'',remember:false,confirmPassword:'',fullName:'',phone:'',nic:'',address:'',city:'',occupation:'',hasOnlineBusiness:'',onlineBusinessProducts:'',onlineBusinessDuration:'',monthlyIncome:'',socialMediaUrl:'',followersCount:'',facebookMarketing:'',joinReason:'',agreementAccepted:false,nicFrontImage:'',nicBackImage:''}
  const [view,setView]=useState(()=>registrationLocationActive()?'register':'login')
  const [step,setStep]=useState(1)
  const [form,setForm]=useState(emptyForm)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [busy,setBusy]=useState(false)
  const [showLoginPassword,setShowLoginPassword]=useState(false)
  useEffect(() => {
    if (view === 'register') {
      updateSeo({
        title: 'Become a CAMY Entrepreneur in Sri Lanka',
        description: 'Apply online to become a CAMY entrepreneur. Build your business, place customer orders, earn commissions and unlock business credit as you grow.',
        index: true,
        path: '/register',
      })
      return
    }

    updateSeo({
      title: 'Sign In',
      description: 'Secure sign in for CAMY entrepreneurs and staff.',
      index: false,
      path: '/',
    })
  }, [view])
  useEffect(()=>{const syncLocation=()=>{setView(registrationLocationActive()?'register':'login');setStep(1);setError('')};window.addEventListener('popstate',syncLocation);return()=>window.removeEventListener('popstate',syncLocation)},[])
  const update=(key,value)=>setForm(old=>({...old,[key]:value}))
  const uploadNic=(key,event)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Use a JPG, PNG or WebP NIC photo up to 5 MB.');return}const reader=new FileReader();reader.onload=()=>update(key,String(reader.result));reader.onerror=()=>setError('Could not read the NIC photo.');reader.readAsDataURL(file)}
  const validateStep=current=>{
    setError('')
    if(current===1){
      if(!form.fullName.trim()||!form.nic.trim()||!form.address.trim()||!form.city.trim()||!form.phone.trim()||!form.email.trim())return setError('Complete all personal and contact details.'),false
      if(!form.nicFrontImage||!form.nicBackImage)return setError('Upload both the front and back of your NIC.'),false
      if(form.password.length<8||!/[A-Za-z]/.test(form.password)||!/\d/.test(form.password))return setError('Create a password with at least 8 characters, including letters and numbers.'),false
      if(form.password!==form.confirmPassword)return setError('The two passwords do not match.'),false
    }
    if(current===2){
      if(!form.occupation.trim()||!form.hasOnlineBusiness||!form.facebookMarketing)return setError('Complete your occupation, online-business status and Facebook marketing experience.'),false
      if(form.hasOnlineBusiness==='yes'&&(!form.onlineBusinessProducts.trim()||!form.onlineBusinessDuration.trim()||!form.monthlyIncome.trim()))return setError('Complete the online-business questions before continuing.'),false
    }
    if(current===3){
      if(form.joinReason.trim().length<5)return setError('Tell us briefly why you want to join CAMY.'),false
      if(!form.agreementAccepted)return setError('Confirm that your information is correct and CAMY can review it.'),false
    }
    return true
  }
  const next=()=>{if(validateStep(step))setStep(old=>Math.min(3,old+1))}
  const submit=async event=>{
    event.preventDefault()
    setError('');setSuccess('')
    if(view==='register'&&step<3){next();return}
    if(view==='register'&&!validateStep(3))return
    setBusy(true)
    try{
      if(view==='register'){
        const result=await api('/auth/register',{method:'POST',body:JSON.stringify(form)})
        setSuccess(result.message)
        const email=form.email
        setForm({...emptyForm,email})
        setStep(1)
        setView('login')
        window.history.replaceState({},'','/')
        return
      }
      const result=await api('/auth/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password,remember:form.remember})})
      onLogin(result.user,result.passwordResetRequired)
    }catch(reason){setError(reason.message.includes('fetch')?'Cannot reach the CAMY API. Confirm MySQL is running, then restart npm.cmd run dev.':reason.message)}finally{setBusy(false)}
  }
  const switchView=()=>{const next=view==='login'?'register':'login';setView(next);setStep(1);setError('');setSuccess('');window.history.pushState({},'',next==='register'?'/register':'/')}
  return <main className="login-page">
    <section className="login-brand-panel"><div className="login-brand"><Brand/><span>ENTREPRENEUR BUSINESS PLATFORM</span></div><div><span className="login-eyebrow"><Sparkles/> CAMY DIGITAL WORKSPACE</span><h1>Start small.<br/><em>Grow with CAMY.</em></h1><p>Register once, let CAMY review your application, then use your own secure account to place client orders and follow deliveries.</p><div className="login-benefits"><span><Check/> Simple entrepreneur application</span><span><Check/> Admin approval before access</span><span><Check/> Your orders and growth in one place</span></div></div><small>CAMY Entrepreneurs · Sri Lanka</small></section>
    <section className="login-form-panel"><form className={`login-card ${view==='register'?'registration-card registration-wizard':''}`} onSubmit={submit}>
      <span className="login-kicker">{view==='login'?'WELCOME TO CAMY':'BECOME A CAMY ENTREPRENEUR'}</span>
      <h2>{view==='login'?'Sign in to your account':'Entrepreneur application'}</h2>
      <p>{view==='login'?'Use the email and password you created for your CAMY account.':'Complete the three short steps. CAMY Admin will review each application before activating the account.'}</p>
      {error&&<div className="login-error" role="alert">{error}</div>}{success&&<div className="login-success" role="status">{success}</div>}
      {view==='login'?<>
        <label>Email address<input type="email" required autoComplete="username" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="name@example.com"/></label>
        <label>Password<div className="login-password-field"><input type={showLoginPassword?'text':'password'} required autoComplete="current-password" value={form.password} onChange={e=>update('password',e.target.value)} placeholder="Enter your password"/><button type="button" onClick={()=>setShowLoginPassword(value=>!value)} aria-label={showLoginPassword?'Hide password':'Show password'} aria-pressed={showLoginPassword} title={showLoginPassword?'Hide password':'Show password'}>{showLoginPassword?<EyeOff/>:<Eye/>}</button></div></label>
        <label className="remember-option"><input type="checkbox" checked={form.remember} onChange={e=>update('remember',e.target.checked)}/><span>Remember me on this device for 30 days</span></label>
        <button className="login-submit" disabled={busy}>{busy?'Signing in…':'Sign in securely'}<ArrowRight/></button>
      </>:<>
        <div className="registration-steps"><button type="button" className={step>=1?'active':''} onClick={()=>step>1&&setStep(1)}><b>1</b><span>Personal</span></button><i/><button type="button" className={step>=2?'active':''} onClick={()=>step>2&&setStep(2)}><b>2</b><span>Business</span></button><i/><button type="button" className={step>=3?'active':''}><b>3</b><span>Confirm</span></button></div>
        {step===1&&<section className="registration-step-panel"><div className="registration-section-head"><span>STEP 1 OF 3</span><h3>Your details & login</h3><p>Only your personal details need typing. Choose your district from the list to finish faster.</p></div><div className="registration-grid"><label>Full name<input required autoComplete="name" value={form.fullName} onChange={e=>update('fullName',e.target.value)} placeholder="Your full name"/></label><label>NIC number<input required value={form.nic} onChange={e=>update('nic',e.target.value)} placeholder="NIC number"/></label><label className="wide">Home address<textarea rows="2" required autoComplete="street-address" value={form.address} onChange={e=>update('address',e.target.value)} placeholder="House number and street"/></label><label>City / district<select required value={form.city} onChange={e=>update('city',e.target.value)}><option value="">Select your district</option>{districts.map(district=><option key={district}>{district}</option>)}</select></label><label>WhatsApp number<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="07XXXXXXXX"/></label><label>Email address <small>Login username</small><input type="email" required autoComplete="username" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="name@example.com"/></label><label>Password<input type="password" minLength="8" required autoComplete="new-password" value={form.password} onChange={e=>update('password',e.target.value)} placeholder="8+ characters, letters & numbers"/></label><label>Confirm password<input type="password" minLength="8" required autoComplete="new-password" value={form.confirmPassword} onChange={e=>update('confirmPassword',e.target.value)} placeholder="Enter password again"/></label></div><div className="nic-upload-grid"><label className={form.nicFrontImage?'ready':''}><strong>NIC front photo</strong><small>Clear JPG, PNG or WebP · max 5 MB</small><span>{form.nicFrontImage?'✓ Front photo ready':'Choose front photo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>uploadNic('nicFrontImage',e)}/></label><label className={form.nicBackImage?'ready':''}><strong>NIC back photo</strong><small>Clear JPG, PNG or WebP · max 5 MB</small><span>{form.nicBackImage?'✓ Back photo ready':'Choose back photo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>uploadNic('nicBackImage',e)}/></label></div></section>}
        {step===2&&<section className="registration-step-panel"><div className="registration-section-head"><span>STEP 2 OF 3</span><h3>Your selling experience</h3><p>Choose the closest answer. These questions help CAMY give the right support—there is no wrong answer.</p></div><RegistrationBusinessFields form={form} update={update}/></section>}
        {step===3&&<section className="registration-step-panel"><div className="registration-section-head"><span>STEP 3 OF 3</span><h3>Final confirmation</h3><p>Choose your main goal, confirm the details, and CAMY Admin will review your application and NIC.</p></div><label>What is your main reason for joining CAMY?<select required value={form.joinReason} onChange={e=>update('joinReason',e.target.value)}><option value="">Select your main goal</option>{joinReasons.map(reason=><option key={reason}>{reason}</option>)}</select></label><label className="registration-agreement"><input type="checkbox" checked={form.agreementAccepted} onChange={e=>update('agreementAccepted',e.target.checked)}/><span>My information is correct and CAMY can review my application.</span></label><div className="registration-summary"><Check/><div><strong>Your login is saved securely.</strong><p>After approval, sign in using <b>{form.email||'your email'}</b> and the password you created. CAMY Admin cannot see your password.</p></div></div></section>}
        <div className="registration-nav">{step>1&&<button className="btn secondary" type="button" onClick={()=>{setError('');setStep(old=>old-1)}}>Back</button>}<button className="login-submit" type="submit" disabled={busy}>{busy?'Sending application…':step<3?'Continue':'Send application'}<ArrowRight/></button></div>
      </>}
      <button className="login-switch" type="button" onClick={switchView}>{view==='login'?'New entrepreneur? Apply to CAMY':'Already applied or approved? Return to sign in'}</button>
    </form></section>
    {view==='register'&&<section className="registration-seo-content" aria-labelledby="camy-entrepreneur-heading">
      <div className="registration-seo-intro"><span>START YOUR BUSINESS JOURNEY</span><h2 id="camy-entrepreneur-heading">Become a CAMY entrepreneur in Sri Lanka</h2><p>CAMY helps aspiring and growing entrepreneurs sell useful products with a structured digital workspace. Apply online, complete CAMY's review process and, once approved, manage customer orders, delivery progress, earnings and business growth from one secure account.</p></div>
      <div className="registration-seo-benefits">
        <article><PackageCheck/><h3>Products and fulfilment</h3><p>Browse the CAMY catalogue, create customer orders and follow each order through preparation, dispatch and delivery.</p></article>
        <article><WalletCards/><h3>Clear earnings</h3><p>See delivered sales and commission information in one place, with records that help you understand your progress.</p></article>
        <article><TrendingUp/><h3>Room to grow</h3><p>Build a verified sales history and follow the CAMY growth path, including eligible business-credit features.</p></article>
      </div>
      <div className="registration-seo-steps"><h2>How the CAMY entrepreneur application works</h2><ol><li><b>Apply online.</b> Add your personal details, contact information and secure login.</li><li><b>Tell us about your goals.</b> Share your current selling experience so CAMY can understand the support you need.</li><li><b>Wait for review.</b> CAMY verifies each application before activating platform access.</li><li><b>Start selling.</b> Approved entrepreneurs can sign in, create customer orders and track their business activity.</li></ol></div>
      <div className="registration-seo-faq"><h2>Frequently asked questions</h2><details><summary>Who can apply to become a CAMY entrepreneur?</summary><p>Adults in Sri Lanka who want to build a product-selling business can submit an application. CAMY reviews each application before approval.</p></details><details><summary>What do I need to apply?</summary><p>Have your contact and address details, information about your selling experience, and clear front and back images of your NIC ready.</p></details><details><summary>Will I get access immediately after applying?</summary><p>No. Application submission is the first step. CAMY reviews your information and activates your secure account only after approval.</p></details><details><summary>How can I contact CAMY about my application?</summary><p>Call CAMY support on <a href={`tel:${SUPPORT_PHONE_DIAL}`}>{SUPPORT_PHONE_DISPLAY}</a> for help with the entrepreneur application.</p></details></div>
    </section>}
  </main>
}

export default function App() {
  const [authUser,setAuthUser]=useState(null); const [authLoading,setAuthLoading]=useState(true); const [passwordModal,setPasswordModal]=useState(false); const [passwordResetRequired,setPasswordResetRequired]=useState(false)
  const [marketReady,setMarketReady]=useState(false)
  const [syncError,setSyncError]=useState('')
  const [refreshVersion,setRefreshVersion]=useState(0)
  const [mode,setMode]=useState('entrepreneur'); const [page,setPage]=useState('home'); const [menu,setMenu]=useState(false)
  const [orderInitialFilter,setOrderInitialFilter]=useState('All')
  const [orderViewKey,setOrderViewKey]=useState(0)
  const [products,setProducts]=useState([]); const [orders,setOrders]=useState([]); const [entrepreneurs,setEntrepreneurs]=useState([]); const [tiers,setTiers]=useState([]); const [notifications,setNotifications]=useState([]); const [systemUsers,setSystemUsers]=useState([]); const [profile,setProfile]=useState({id:'',name:'',nic:'',phone:'',email:'',address:'',bank:'',branch:'',accountName:'',account:'',joined:new Date().toISOString().slice(0,10),image:'',exitRequest:null})
  const [favourites,setFavourites]=useStoredState('camy-favourites-v2',[]); const [settlements,setSettlements]=useState([]); const [cart,setCart]=useState([]); const [cartOpen,setCartOpen]=useState(false); const [notifyOpen,setNotifyOpen]=useState(false); const [globalQuery,setGlobalQuery]=useState(''); const [productModal,setProductModal]=useState(null); const [orderModal,setOrderModal]=useState(null); const [settlementModal,setSettlementModal]=useState(false); const [addEntrepreneur,setAddEntrepreneur]=useState(false); const [personModal,setPersonModal]=useState(null); const orderReturnRef=useRef(null); const [addProduct,setAddProduct]=useState(false); const [addCategory,setAddCategory]=useState(false); const [toast,setToast]=useState('')
  const [orderCartCount,setOrderCartCount]=useState(0)
  const [orderWorkspaceView,setOrderWorkspaceView]=useState('catalogue')
  const [selectedCommission,setSelectedCommission]=useState(null); const [selectedRepayment,setSelectedRepayment]=useState(null)
  useEffect(() => {
    if (!authUser) return

    const accountArea = mode === 'admin' ? 'Admin' : 'Entrepreneur'
    const pageTitle = pageTitles[page] || 'Dashboard'

    updateSeo({
      title: `${pageTitle} – ${accountArea}`,
      description: 'Private CAMY Entrepreneurs account page.',
      index: false,
      path: window.location.pathname,
    })
  }, [authUser, mode, page])
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});document.querySelector('.app-v2>main')?.scrollTo?.({top:0,left:0,behavior:'instant'})},[page,mode])
  const [stockRequests,setStockRequests]=useState([]); const [shopInventory,setShopInventory]=useState([]); globalThis.__camyCreditRequests=stockRequests; globalThis.__camyCreditSettlements=settlements; globalThis.__camyProducts=products
  const [catalogueLive,setCatalogueLive]=useState(false)
  const [camyBank,setCamyBank]=useState(null)
  const catalogueBaseStock=useRef({})
  const catalogueRevision=useRef(0)
  const productDraft=useRef(false); const tierDraft=useRef(false)
  const editProducts=update=>{productDraft.current=true;setProducts(update)}
  const editTiers=update=>{tierDraft.current=true;setTiers(update)}
  useEffect(()=>{const saved=event=>{productDraft.current=false;catalogueRevision.current=Number(event.detail||catalogueRevision.current)};window.addEventListener('camy-catalogue-saved',saved);return()=>window.removeEventListener('camy-catalogue-saved',saved)},[])
  const syncLiveProducts=(serverProducts=[],revision=0)=>{
    if(authUser?.role==='entrepreneur'){setProducts(serverProducts);return}
    const nextBase=Object.fromEntries(serverProducts.map(product=>[String(product.id),Number(product.stock)]))
    if(!productDraft.current){setProducts(serverProducts)}else{
      setProducts(current=>current.map(product=>{const server=serverProducts.find(item=>String(item.id)===String(product.id));if(!server)return product;const previous=Number(catalogueBaseStock.current[String(product.id)]??server.stock);const delta=Number(server.stock)-previous;return delta?{...product,stock:Math.max(0,Number(product.stock)+delta)}:product}))
    }
    catalogueBaseStock.current=nextBase
    catalogueRevision.current=Number(revision||catalogueRevision.current)
  }
  const notify = message => {
    const supportRequest = String(message).startsWith('CAMY Support:')
    const shownMessage = supportRequest
      ? `CAMY Support: ${SUPPORT_PHONE_DISPLAY}`
      : message

    if (supportRequest) {
      window.location.href = `tel:${SUPPORT_PHONE_DIAL}`
    }

    setToast(shownMessage)
    window.clearTimeout(window.__camyToast)
    window.__camyToast = window.setTimeout(() => setToast(''), 2600)
  }
  const applySession=(user,resetRequired=false)=>{setProducts([]);setOrders([]);setEntrepreneurs([]);setTiers([]);setSettlements([]);setStockRequests([]);setShopInventory([]);setSyncError('');productDraft.current=false;tierDraft.current=false;setAuthUser(user);setMarketReady(false);setCatalogueLive(false);setPasswordResetRequired(resetRequired);const admin=user.role!=='entrepreneur';setMode(admin?'admin':'entrepreneur');setPage(admin?'overview':'home');if(!admin)setProfile(old=>({...old,id:user.member_id,name:user.full_name,email:user.email,nic:user.nic||'',phone:user.phone||'',address:user.address||'',joined:user.joined_date||old.joined,image:user.profile_image||'',bank:user.bank_name||'',branch:user.bank_branch||'',accountName:user.account_holder||'',account:user.account_number||'',exitRequest:null}))}
  useEffect(()=>{api('/auth/me').then(({user,passwordResetRequired})=>applySession(user,passwordResetRequired)).catch(()=>setAuthUser(null)).finally(()=>setAuthLoading(false))},[])
  useEffect(()=>{const refreshed=()=>setRefreshVersion(old=>old+1);window.addEventListener('camy-business-updated',refreshed);const expired=()=>{setAuthUser(null);setMarketReady(false);setProducts([]);setOrders([]);setEntrepreneurs([]);setStockRequests([]);setShopInventory([]);setPasswordModal(false);setPasswordResetRequired(false);setOrderModal(null);setPersonModal(null);setCart([]);setCartOpen(false);setNotifyOpen(false);setSystemUsers([])};window.addEventListener('camy-session-expired',expired);const open=()=>setPasswordModal(true);window.addEventListener('camy-change-password',open);return()=>{window.removeEventListener('camy-change-password',open);window.removeEventListener('camy-session-expired',expired);window.removeEventListener('camy-business-updated',refreshed)}},[])
  useEffect(()=>{const open=event=>{const product=products.find(item=>item.name===event.detail?.name);if(product)setProductModal(product)};window.addEventListener('camy-view-order-product',open);return()=>window.removeEventListener('camy-view-order-product',open)},[products])
  useEffect(()=>{const show=event=>notify(event.detail||'Finance record updated');window.addEventListener('camy-finance-message',show);return()=>window.removeEventListener('camy-finance-message',show)},[])
  useEffect(()=>{const open=()=>setPage('credit-stock');window.addEventListener('camy-open-stock-supply',open);return()=>window.removeEventListener('camy-open-stock-supply',open)},[])
  useEffect(()=>{const open=event=>{if(!event.detail)return;const target=typeof event.detail==='string'?{page:event.detail}:event.detail;setNotifyOpen(false);if(target.page==='orders'){setOrderInitialFilter(target.filter||'All');setOrderViewKey(value=>value+1)}setPage(target.page)};window.addEventListener('camy-open-admin-notification',open);return()=>window.removeEventListener('camy-open-admin-notification',open)},[])
  useEffect(()=>{const update=event=>setOrderCartCount(Number(event.detail)||0);window.addEventListener('camy-order-cart-count',update);return()=>window.removeEventListener('camy-order-cart-count',update)},[])
  useEffect(()=>{
    /* `instant` is not consistently supported by browsers. Reset the actual
       scrolling shell directly whenever the user changes workspace. */
    const main=document.querySelector('.app-v2 > main')
    if(main){main.scrollTop=0;main.scrollLeft=0}
  },[page,mode])
  useEffect(()=>{if(!authUser||passwordResetRequired)return;let active=true;let profileSynced=false;const refresh=async()=>{try{if(authUser.role==='entrepreneur'&&!profileSynced){await api('/marketplace/profile',{method:'POST',body:'{}'});profileSynced=true}let state=await api('/marketplace/state');if(!active)return;syncLiveProducts(state.products||[],state.revision);setCatalogueLive(Boolean(state.catalogue_live));setCamyBank(state.camyBank || null);if(!tierDraft.current)setTiers(old=>JSON.stringify(old)===JSON.stringify(state.tiers||[])?old:state.tiers||[]);if(authUser.role!=='entrepreneur')setEntrepreneurs(old=>JSON.stringify(old)===JSON.stringify(state.entrepreneurs||[])?old:state.entrepreneurs||[]);if(authUser.role==='entrepreneur'){const network=state.entrepreneurs||[];const merged=state.self?network.map(person=>String(person.id)===String(state.self.id)?{...person,...state.self}:person):network;const complete=state.self&&!merged.some(person=>String(person.id)===String(state.self.id))?[...merged,state.self]:merged;setEntrepreneurs(old=>JSON.stringify(old)===JSON.stringify(complete)?old:complete)}setSettlements(state.settlements||[]);setStockRequests(state.requests||[]);setShopInventory(state.inventory||[]);setOrders(state.orders||[]);setSyncError('');setMarketReady(true)}catch(reason){if(active)setSyncError(reason.message)}};refresh();const tick=()=>{if(!document.hidden)refresh()};const timer=setInterval(tick,15000);const visible=()=>{if(!document.hidden)refresh()};document.addEventListener('visibilitychange',visible);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[authUser?.id,passwordResetRequired,refreshVersion])
  const [savingCatalogue,setSavingCatalogue]=useState(false)
  const saveCatalogue=async()=>{setSavingCatalogue(true);try{const result=await api('/marketplace/catalog',{method:'POST',body:JSON.stringify({products,baseStock:catalogueBaseStock.current,revision:catalogueRevision.current})});productDraft.current=false;setProducts(result.state.products);catalogueRevision.current=result.state.revision;catalogueBaseStock.current=Object.fromEntries(result.state.products.map(product=>[String(product.id),Number(product.stock)]));notify('Catalogue saved to MySQL')}catch(reason){notify(reason.message)}finally{setSavingCatalogue(false)}}
  const saveCreditRules=async()=>{try{const result=await api('/admin/credit-tiers',{method:'POST',body:JSON.stringify({tiers})});tierDraft.current=false;setTiers(result.state.tiers);setEntrepreneurs(result.state.entrepreneurs);if(!productDraft.current)catalogueRevision.current=result.state.revision;notify('Credit rules saved and verified sales recalculated')}catch(reason){notify(reason.message)}}
  const login=(user,resetRequired)=>applySession(user,resetRequired)
  const logout=async()=>{try{await api('/auth/logout',{method:'POST'})}catch{/* Clear the local session view even if the API is stopping. */}setAuthUser(null);setMarketReady(false);setCatalogueLive(false);setPasswordResetRequired(false);setMenu(false)}
  globalThis.__camyLogout=logout
  const addToCart=(p)=>{if(p.stock<1){notify(`${p.name} is currently out of stock`);return}setCart(old=>{const found=old.find(x=>x.id===p.id);if(found?.qty>=p.stock){notify(`Only ${p.stock} units of ${p.name} are available`);return old}return found?old.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...old,{...p,qty:1}]});notify(`${p.name} added to your cart`)}
  const placeOrder=(customer,total)=>{const unavailable=cart.find(item=>(products.find(product=>product.id===item.id)?.stock||0)<item.qty);if(unavailable){notify(`${unavailable.name} does not have enough stock. Please update the cart.`);return}const itemText=cart.length===1?cart[0].name:`${cart.length} CAMY products`;const next={id:`CMY-${String(2850+orders.length)}`,customer:customer.name,phone:customer.phone,product:itemText,items:cart.map(item=>({id:item.id,name:item.name,qty:item.qty,price:item.price})),qty:cart.reduce((s,x)=>s+x.qty,0),amount:total,date:new Date().toISOString().slice(0,10),status:'Processing',entrepreneur:profile.name,address:`${customer.address}, ${customer.district}`};setOrders(old=>[next,...old]);setProducts(old=>old.map(product=>{const item=cart.find(entry=>entry.id===product.id);return item?{...product,stock:product.stock-item.qty}:product}));setCart([]);setCartOpen(false);setPage('orders');notify('Customer order placed. Sales and credit progress update after successful delivery.')}
  const placeManualOrder=async form=>{try{const result=await api('/admin/manual-order',{method:'POST',body:JSON.stringify(form)});setOrders(result.state.orders||[]);syncLiveProducts(result.state.products||[],result.state.revision);notify(`${result.order.id} created · CAMY will collect ${money(result.order.amount)} by COD and transfer ${money(result.order.entrepreneurMargin)} after delivery.`);return true}catch(reason){notify(reason.message);return false}}
  const submitSettlement=async(requestId,amount,reference,receipt,receiptName,method='bank_transfer')=>{try{const result=await api('/marketplace/credit/settlements',{method:'POST',body:JSON.stringify({requestId,amount,reference,receipt,receiptName,method})});setSettlements(old=>[result.settlement,...old.filter(item=>item.id!==result.settlement.id)]);notify(result.changedFromCash?`${requestId} changed from cash to bank transaction; receipt submitted for verification`:method==='cash_at_camy'?`${money(amount)} for ${requestId} marked for cash payment at a CAMY store`:`${money(amount)} payment for ${requestId} submitted for CAMY verification`);return true}catch(reason){notify(reason.message);return false}}
  const reviewSettlement = async (id, action) => {
    const reason=action==='reject'?window.prompt('Why is this repayment being rejected? The entrepreneur will see this reason.',''):''
    if(action==='reject'&&!reason?.trim()){notify('A rejection reason is required.');return}
    try {
      const { state } = await api(`/marketplace/credit/settlements/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify({reason:reason.trim()}) })
      setSettlements(state.settlements)
      setEntrepreneurs(state.entrepreneurs)
      notify(`${id} ${action === 'verify' ? 'verified' : 'rejected'}`)
    } catch (reason) {
      notify(reason.message)
    }
  }
  const updateOrderStatus=async(id,status)=>{
    const order=orders.find(item=>item.id===id);if(!order||order.status===status)return
    if(order.source==='shop' && status==='Dispatched'){setOrderModal(order);notify('Add the courier tracking number in the order details before dispatching.');return}
    const creditFor=sales=>creditForSales(tiers,sales)
    if(order.source==='shop'){
      try{const result=await api(`/marketplace/orders/${encodeURIComponent(id)}/status`,{method:'POST',body:JSON.stringify({status})});setShopInventory(result.inventory);if(result.products)syncLiveProducts(result.products,result.revision);setOrders(old=>[...old.filter(item=>item.source!=='shop'),...result.orders]);setEntrepreneurs(old=>old.map(person=>{if(person.id!==order.entrepreneurId)return person;const sales=result.orders.filter(item=>item.entrepreneurId===person.id&&item.status==='Delivered').reduce((sum,item)=>sum+((item.items||[]).reduce((total,line)=>total+Number(line.price||0)*Number(line.qty||0),0)||Number(item.amount||0)),0);const credit=creditFor(sales);return {...person,sales,credit,stage:credit>0?'Credit eligible':'Trial seller'}}));notify(`${id} updated to ${status}. Warehouse and entrepreneur stock recalculated.`)}catch(reason){notify(reason.message)}
      return
    }
    setOrders(old=>old.map(item=>item.id===id?{...item,status}:item))
    if(status==='Delivered'){setEntrepreneurs(old=>old.map(person=>{if(person.name!==order.entrepreneur)return person;const sellingValue=(order.items||[]).reduce((sum,item)=>sum+Number(item.price||0)*Number(item.qty||0),0)||Number(order.amount||0);const sales=Number(person.sales||0)+sellingValue;const credit=creditFor(sales);return {...person,sales,credit,stage:credit>0?'Credit eligible':'Trial seller'}}));notify(`${id} delivered: verified product selling value updated`);return}
    if(status==='Returned'){const items=order.items||products.filter(product=>product.name===order.product).map(product=>({id:product.id,qty:order.qty}));setProducts(old=>old.map(product=>{const item=items.find(entry=>entry.id===product.id);return item?{...product,stock:product.stock+item.qty}:product}));if(order.status==='Delivered')setEntrepreneurs(old=>old.map(person=>{if(person.name!==order.entrepreneur)return person;const sellingValue=(order.items||[]).reduce((sum,item)=>sum+Number(item.price||0)*Number(item.qty||0),0)||Number(order.amount||0);const sales=Math.max(0,Number(person.sales||0)-sellingValue);const credit=creditFor(sales);return {...person,sales,credit,stage:credit>0?'Credit eligible':'Trial seller'}}));notify(`${id} returned: stock and credit recalculated`);return}
    notify(`${id} updated to ${status}`)
  }
  const updateOrderDetails=(id,quantity,unitPrice)=>{const order=orders.find(item=>item.id===id);const product=products.find(item=>item.name===order?.product);if(!order||!product||quantity<1||unitPrice<0)return;const stockChange=quantity-order.qty;if(stockChange>product.stock){notify(`Only ${product.stock} more units are available`);return}const amount=quantity*unitPrice;setOrders(old=>old.map(item=>item.id===id?{...item,qty:quantity,amount,entrepreneurMargin:Math.max(0,amount-Number(item.camyCost||0)),items:[{id:product.id,name:product.name,qty:quantity,price:unitPrice}]}:item));setProducts(old=>old.map(item=>item.id===product.id?{...item,stock:item.stock-stockChange}:item));if(order.status==='Delivered')setEntrepreneurs(old=>old.map(person=>{if(person.name!==order.entrepreneur)return person;const previousSellingValue=(order.items||[]).reduce((sum,item)=>sum+Number(item.price||0)*Number(item.qty||0),0)||Number(order.amount||0);const sales=Math.max(0,Number(person.sales||0)+amount-previousSellingValue);const credit=creditForSales(tiers,sales);return {...person,sales,credit,stage:credit>0?'Credit eligible':'Trial seller'}}));notify(`${id} price, quantity, and stock updated${order.status==='Delivered'?', with verified sales recalculated':''}`)}
  const updateBusinessProfile = async nextProfile => {
    try {
      const payload = {
        ...nextProfile,
        city: nextProfile.city || currentEntrepreneur?.city || '',
        accountNumber: nextProfile.account ?? nextProfile.accountNumber ?? '',
      }

      const result = await api('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      const savedProfile = result.person || {}
      const canonicalProfile = {
        ...nextProfile,
        ...savedProfile,
        name: savedProfile.name ?? nextProfile.name,
        email: savedProfile.email ?? nextProfile.email,
        nic: savedProfile.nic ?? nextProfile.nic,
        phone: savedProfile.phone ?? nextProfile.phone,
        address: savedProfile.address ?? nextProfile.address,
        bank: savedProfile.bank ?? savedProfile.bankDetails?.bank ?? nextProfile.bank,
        branch: savedProfile.branch ?? savedProfile.bankDetails?.branch ?? nextProfile.branch,
        accountName: savedProfile.accountName ?? savedProfile.bankDetails?.holder ?? nextProfile.accountName,
        account: savedProfile.accountNumber ?? savedProfile.bankDetails?.account ?? payload.accountNumber,
        image: savedProfile.image ?? nextProfile.image,
        joined: savedProfile.joined ?? nextProfile.joined,
        exitRequest: savedProfile.exitRequest || null,
      }

      setProfile(canonicalProfile)
      setEntrepreneurs(current => current.map(person => (
        person.id === savedProfile.id ? { ...person, ...savedProfile } : person
      )))
      setRefreshVersion(current => current + 1)

      notify(
        nextProfile.exitRequest?.status === 'Pending'
          ? 'Exit request sent to CAMY Admin'
          : 'Profile details saved successfully',
      )
      return true
    } catch (reason) {
      notify(reason.message)
      return false
    }
  }
  const updateCashCollection=async(id,collected)=>{
    try{const result=await api(`/marketplace/credit/settlements/${encodeURIComponent(id)}/collection`,{method:'POST',body:JSON.stringify({collected})});setSettlements(result.state.settlements);notify(collected?`${id} cash marked as collected`:`${id} cash collection status reopened`);return result.settlement}catch(reason){notify(reason.message);return null}
  }
  const updateProfilePhoto = async image => {
    try {
      const result=await api('/account/profile/photo',{method:'PATCH',body:JSON.stringify({image})})
      setProfile(current=>({...current,image:result.image||''}))
      setEntrepreneurs(current=>current.map(person=>String(person.id)===String(currentEntrepreneur?.id||profile.id)?{...person,image:result.image||''}:person))
      setAuthUser(current=>current?{...current,profile_image:result.image||''}:current)
      return true
    } catch(reason) {
      notify(reason.message)
      return false
    }
  }
  const createEntrepreneur=async(form)=>{try{const result=await api('/admin/entrepreneurs',{method:'POST',body:JSON.stringify(form)});setEntrepreneurs(old=>[...old,result.entrepreneur]);window.dispatchEvent(new Event('camy-business-updated'));notify(`${result.entrepreneur.name} account created · ${result.entrepreneur.id}`);return true}catch(reason){notify(reason.message);throw reason}}
  const createProduct=(form)=>{editProducts(old=>[...old,{...form,id:Date.now(),published:true,price:Number(form.price),stock:Number(form.stock),image:form.image||'/products/classic-set.png',tag:form.tag||'New',rating:Number(form.rating||5),warranty:form.warranty||'1 year',description:form.description||'New CAMY catalogue product.',specs:form.specs?.length?form.specs:['CAMY quality assured','Ready for entrepreneur orders']}]);notify('Product added to catalogue')}
  const createCategory=(name)=>{const key='camy-product-categories-v2';const existing=JSON.parse(localStorage.getItem(key)||'[]');if(existing.some(category=>category.toLowerCase()===name.toLowerCase())){notify('That category already exists');return}localStorage.setItem(key,JSON.stringify([...existing,name]));window.dispatchEvent(new Event('camy-categories-updated'));setAddCategory(false);notify(`${name} category created`)}
  const submitStockRequest=async request=>{
    try{
      const result=await api('/marketplace/requests',{method:'POST',body:JSON.stringify(request)})
      setStockRequests(old=>[result.request,...old])
      notify(`${result.request.id} sent to CAMY for approval`)
      return result.request
    }catch(reason){
      notify(reason.message)
      return false
    }
  }
  const cancelStockRequest=async id=>{
    try{
      const result=await api(`/marketplace/requests/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'})
      setStockRequests(old=>old.map(request=>request.id===id?result.request:request))
      notify(`${id} cancelled. Your available credit has been restored.`)
      return true
    }catch(reason){notify(reason.message);return false}
  }
  const requestCreditExtension=async(id,requestedDueAt,reason)=>{
    try{const result=await api(`/marketplace/requests/${encodeURIComponent(id)}/extension`,{method:'POST',body:JSON.stringify({requestedDueAt,reason})});setStockRequests(old=>old.map(request=>request.id===id?result.request:request));notify(`${id} payment extension sent to CAMY for review`);return true}catch(reason){notify(reason.message);return false}
  }
  const reviewCreditExtension=async(id,decision,note='')=>{
    try{const result=await api(`/marketplace/requests/${encodeURIComponent(id)}/extension-review`,{method:'POST',body:JSON.stringify({decision,note})});setStockRequests(result.state.requests);notify(`${id} payment extension ${decision.toLowerCase()}`);return true}catch(reason){notify(reason.message);return false}
  }
  const reviewStockRequest=async(id,status,reason,items)=>{try{const action=status==='Edited'?'edit':{Approved:'approve',Rejected:'reject',Dispatched:'dispatch'}[status];if(!action)throw new Error('Unsupported credit stock action');let result=await api(`/marketplace/requests/${encodeURIComponent(id)}/${action}`,{method:'POST',body:JSON.stringify({reason,items})});if(!result.state)result={state:await api('/marketplace/state')};setStockRequests(result.state.requests);setShopInventory(result.state.inventory);setEntrepreneurs(result.state.entrepreneurs||entrepreneurs);syncLiveProducts(result.state.products||[],result.state.revision);notify(`${id} ${status.toLowerCase()}${status==='Approved'?': warehouse stock reserved automatically':status==='Dispatched'?': entrepreneur stock and outstanding credit updated automatically':''}`)}catch(reason){notify(reason.message);throw reason}}
  const saveShopPrice=async(productId,price,visible)=>{try{const result=await api('/marketplace/shop-price',{method:'POST',body:JSON.stringify({productId,price,...(visible===undefined?{}:{visible})})});setShopInventory(result.inventory);notify('Shop listing updated.')}catch(reason){notify(reason.message)}}
  const activateCatalogue=async()=>{if(!window.confirm('Confirm these are real CAMY products with verified prices and warehouse stock quantities? Entrepreneurs will be able to place COD drop-ship orders and eligible entrepreneurs can request credit stock.'))return;try{const result=await api('/marketplace/activate-catalogue',{method:'POST',body:'{}'});setCatalogueLive(Boolean(result.state.catalogue_live));notify('CAMY catalogue activated for COD orders and credit stock requests.')}catch(reason){notify(reason.message)}}
  const registeredEntrepreneur=entrepreneurs.find(person=>person.id===profile.id)||entrepreneurs.find(person=>person.name===profile.name); const currentEntrepreneur=registeredEntrepreneur||{...profile,id:profile.id,name:profile.name,sales:Number(authUser?.total_sales||0),credit:Number(authUser?.credit_limit||0),used:Number(authUser?.outstanding||0),city:authUser?.city||'',stage:'Trial seller'}
  const configuredCredit=tiers.length?creditForSales(tiers,Number(currentEntrepreneur?.sales||0)):Number(currentEntrepreneur?.credit||0)
  const creditEligible=configuredCredit>0&&currentEntrepreneur?.stage!=='Departed'&&currentEntrepreneur?.active!==false
  globalThis.__camyCreditEligible=creditEligible
  globalThis.__camyCreditTiers=tiers
  globalThis.__camyOpenAdminOrder=(order,payoutOnly=false)=>{orderReturnRef.current=personModal?{profile:personModal,view:payoutOnly?'commissions':'orders'}:null;setPersonModal(null);setOrderModal(payoutOnly?{...order,payoutOnly:true}:order)}
  useEffect(()=>{const restore=()=>{const target=orderReturnRef.current;orderReturnRef.current=null;if(!target)return;globalThis.__camyEntrepreneurInitialView=target.view;setPersonModal(target.profile)};window.addEventListener('camy-return-from-order',restore);return()=>window.removeEventListener('camy-return-from-order',restore)},[])
  useEffect(()=>{if(!orderModal)orderReturnRef.current=null},[orderModal])
  useEffect(()=>{if(mode!=='admin'&&!creditEligible&&['credit-stock','credit-inventory','credit-requests','credit','repayments','repayment-detail'].includes(page))setPage('home')},[mode,creditEligible,page])
  const liveOrders=orders.filter(order=>order.source==='shop');const myOrders=liveOrders.filter(order=>String(order.entrepreneurId)===String(currentEntrepreneur?.id||profile.id))
  useEffect(()=>{
    if(!authUser)return
    const relevantOrders=mode==='admin'?liveOrders:myOrders
    const next=[]
    if(mode==='admin'){
      const readyPayouts=relevantOrders.filter(order=>order.payoutStatus==='pending_transfer')
      if(readyPayouts.length)next.push({id:'payout-ready',type:'credit',title:'Commission payouts ready',body:`${readyPayouts.length} delivered order${readyPayouts.length===1?' has':'s have'} an entrepreneur commission available to transfer at any time.`,time:'Finance update',target:'payouts',actionLabel:'Open commission payouts'})
      const pendingOrders=relevantOrders.filter(order=>order.status==='Pending')
      if(pendingOrders.length)next.push({id:'orders-pending-approval',type:'delivery',title:'New orders need approval',body:`${pendingOrders.length} order${pendingOrders.length===1?' is':'s are'} waiting for CAMY review.`,time:'Approval request',target:'admin-orders',actionLabel:'Open customer orders'})
      const paymentReviews=relevantOrders.filter(order=>order.status==='Payment review')
      if(paymentReviews.length)next.push({id:'order-payments-review',type:'credit',title:'Payment receipts need review',body:`${paymentReviews.length} order payment receipt${paymentReviews.length===1?' is':'s are'} waiting for verification.`,time:'Approval request',target:'admin-orders',actionLabel:'Open customer orders'})
      const returnRequests=relevantOrders.filter(order=>order.return&&['Pending','Requested','Under review'].includes(order.return.status))
      if(returnRequests.length)next.push({id:'returns-pending-review',type:'delivery',title:'Return requests need review',body:`${returnRequests.length} customer return request${returnRequests.length===1?' is':'s are'} waiting for a decision.`,time:'Approval request',target:'admin-orders',actionLabel:'Open customer orders'})
      const pendingStock=stockRequests.filter(request=>request.status==='Pending')
      if(pendingStock.length)next.push({id:'credit-stock-pending',type:'credit',title:'Credit-stock requests need approval',body:`${pendingStock.length} entrepreneur credit-stock request${pendingStock.length===1?' is':'s are'} waiting for review.`,time:'Approval request',target:'stock-supply',actionLabel:'Open credit stock'})
      const pendingExtensions=stockRequests.filter(request=>request.extensionRequest?.status==='Pending')
      if(pendingExtensions.length)next.push({id:'credit-extension-pending',type:'credit',title:'Payment extensions need approval',body:`${pendingExtensions.length} entrepreneur request${pendingExtensions.length===1?' needs':'s need'} extra repayment time reviewed.`,time:'Approval request',target:'stock-supply',actionLabel:'Open extra-time requests'})
      const pendingSettlements=settlements.filter(item=>item.status==='Pending verification')
      if(pendingSettlements.length)next.push({id:'credit-payment-pending',type:'credit',title:'Credit payments need verification',body:`${pendingSettlements.length} entrepreneur credit payment${pendingSettlements.length===1?' is':'s are'} waiting for verification.`,time:'Approval request',target:'credit-settlements',actionLabel:'Open credit settlements'})
      const pendingExits=entrepreneurs.filter(person=>person.exitRequest?.status==='Pending')
      if(pendingExits.length)next.push({id:'exit-request-pending',type:'growth',title:'Account exit requests need review',body:`${pendingExits.length} entrepreneur account exit request${pendingExits.length===1?' is':'s are'} waiting for a decision.`,time:'Approval request',target:'entrepreneurs',actionLabel:'Open entrepreneurs'})
      const active=relevantOrders.filter(order=>['Processing','Dispatched'].includes(order.status))
      if(active.length)next.push({id:'orders-active',type:'delivery',title:'Orders need fulfilment',body:`${active.length} order${active.length===1?' is':'s are'} currently processing or dispatched.`,time:'Operations update',target:'admin-orders',actionLabel:'Open customer orders'})
    }else{
      const delivered=relevantOrders.filter(order=>order.status==='Delivered')
      if(delivered.length)next.push({id:'delivered-orders',type:'delivery',title:'Customer orders delivered',body:`${delivered.length} of your order${delivered.length===1?' is':'s are'} marked delivered.`,time:'Delivery update',target:{page:'orders',filter:'Delivered'},actionLabel:'View delivered orders'})
      const active=relevantOrders.filter(order=>!['Delivered','Returned','Rejected','Cancelled'].includes(order.status))
      if(active.length)next.push({id:'orders-in-progress',type:'delivery',title:'Orders in progress',body:`${active.length} customer order${active.length===1?' is':'s are'} still being fulfilled.`,time:'Live update',target:{page:'orders',filter:'Active'},actionLabel:'View active orders'})
    }
    setNotifications(old=>next.map(item=>({...item,read:old.find(previous=>previous.id===item.id)?.read??false})))
  },[authUser?.id,mode,orders,stockRequests,settlements,entrepreneurs,currentEntrepreneur?.id,profile.id])
  const runGlobalSearch=(term)=>{
    const searchTerm=term.toLowerCase()
    const nav=(mode==='admin'?adminNav:entrepreneurNav).find(([,label])=>label.toLowerCase().includes(searchTerm))
    if(nav){setPage(nav[0]);setGlobalQuery('');notify(`Opened ${nav[1]}`);return}
    const matchingOrder=(mode==='admin'?liveOrders:myOrders).find(order=>`${order.id} ${order.customer} ${order.phone} ${order.product}`.toLowerCase().includes(searchTerm))
    if(matchingOrder){setOrderModal(matchingOrder);setGlobalQuery('');notify(`Opened order ${matchingOrder.id}`);return}
    if(mode==='admin'){
      const person=entrepreneurs.find(item=>`${item.name} ${item.id} ${item.email||''} ${item.phone||''}`.toLowerCase().includes(searchTerm))
      if(person){setPersonModal({person,readOnly:false});setGlobalQuery('');notify(`Opened entrepreneur ${person.name}`);return}
    }
    const product=products.find(item=>`${item.name} ${item.code||''} ${item.category||''}`.toLowerCase().includes(searchTerm))
    if(product){setProductModal(product);setGlobalQuery('');notify(`Opened product ${product.name}`);return}
    notify(`No records found for “${term}”`)
  }
  const openCommission=id=>{setSelectedCommission(id);setOrderModal(null);setPage('commission-detail')}
  const openRepayment=id=>{setSelectedRepayment(id);setPage('repayment-detail')}
  const openCreditPayment=id=>{setStockRequests(old=>[...old].sort((a,b)=>String(a.id)===String(id)?-1:String(b.id)===String(id)?1:0));setSettlementModal(id)}
  globalThis.__camyOpenCreditPayment=openCreditPayment
  const openOrdersPage=(filter='All')=>{setOrderInitialFilter(filter);setOrderViewKey(value=>value+1);setPage('orders')}
  const openNewOrder=()=>{setOrderWorkspaceView('catalogue');setPage('products')}
  const navigateFromMenu=id=>{if(mode!=='admin'&&id==='orders'){openOrdersPage('All');return}if(mode!=='admin'&&id==='products'){openNewOrder();return}setPage(id)}
  const openOrderCart=()=>{
    setOrderWorkspaceView('cart')
    setPage('products')
  }
  const customerPages={home:<ShopHome person={currentEntrepreneur} inventory={shopInventory} products={products} requests={stockRequests} orders={myOrders} tiers={tiers} setPage={setPage} openOrders={openOrdersPage}/>,products:<StockSupplyPage products={products} person={currentEntrepreneur} orders={myOrders} tiers={tiers} notify={notify} catalogueLive={catalogueLive} setPage={setPage} workspaceView={orderWorkspaceView} setWorkspaceView={setOrderWorkspaceView}/>, 'credit-stock':<CreditStockPage products={products} person={currentEntrepreneur} requests={stockRequests} inventory={shopInventory} submit={submitStockRequest} cancel={cancelStockRequest} requestExtension={requestCreditExtension} notify={notify} catalogueLive={catalogueLive} setPage={setPage}/>, 'credit-requests':<CreditStockPage products={products} person={currentEntrepreneur} requests={stockRequests} inventory={shopInventory} cancel={cancelStockRequest} requestExtension={requestCreditExtension} notify={notify} catalogueLive={catalogueLive} requestsOnly setPage={setPage}/>,orders:<OrdersPage key={orderViewKey} orders={myOrders} setOrders={setOrders} openOrder={setOrderModal} setPage={setPage} initialFilter={orderInitialFilter}/>,growth:<GrowthPage entrepreneurs={entrepreneurs} person={currentEntrepreneur} orders={myOrders} tiers={tiers}/>,credit:<CreditOnlyPage tiers={tiers} settlements={settlements} requests={stockRequests} person={currentEntrepreneur} onSettlement={()=>setSettlementModal(true)} onPayRequest={openCreditPayment} openRepayments={()=>setPage('repayments')}/>,earnings:<CommissionWalletPage orders={myOrders} back={()=>setPage('home')} open={openCommission}/>,commissions:<CommissionWalletPage orders={myOrders} back={()=>setPage('earnings')} open={openCommission}/>, 'commission-detail':<CommissionDetailPage order={myOrders.find(order=>order.id===selectedCommission)} products={products} back={()=>setPage('earnings')}/>,repayments:<RepaymentHistoryPage settlements={settlements} outstanding={Number(currentEntrepreneur?.used||0)} back={()=>setPage('credit')} open={openRepayment} pay={()=>setSettlementModal(true)}/>, 'repayment-detail':<RepaymentDetailPage item={settlements.find(item=>item.id===selectedRepayment)} back={()=>setPage('repayments')}/>,profile:<ProfilePage profile={profile} setProfile={updateBusinessProfile} savePhoto={updateProfilePhoto} person={currentEntrepreneur} orders={myOrders} entrepreneurs={entrepreneurs} notify={notify}/>} 
  customerPages['credit-inventory']=<CreditInventoryPage products={products} person={currentEntrepreneur} inventory={shopInventory} setPage={setPage}/>
  const adminPages={overview:<AdminOverview entrepreneurs={entrepreneurs} orders={liveOrders} products={products} tiers={tiers} requests={stockRequests} setPage={setPage} openEntrepreneur={person=>setPersonModal({person,readOnly:true})}/>,entrepreneurs:<AdminEntrepreneurs entrepreneurs={entrepreneurs} orders={liveOrders} setEntrepreneurs={setEntrepreneurs} openEntrepreneur={person=>setPersonModal({person,readOnly:false})} openAdd={()=>setAddEntrepreneur(true)} notify={notify}/>, 'admin-orders':<AdminOrders orders={liveOrders} setOrders={setOrders} products={products} entrepreneurs={entrepreneurs} onManualOrder={placeManualOrder} onUpdateStatus={updateOrderStatus} openOrder={setOrderModal}/>, 'admin-products':<>{!catalogueLive&&<div className="market-warning">Sample catalogue: verify real CAMY prices and warehouse stock before activating orders. <button className="market-primary" onClick={activateCatalogue}>Verify and activate catalogue</button></div>}<div className="catalogue-save-bar"><p>Save your catalogue changes to make them available to entrepreneurs.</p><Button disabled={savingCatalogue} onClick={saveCatalogue}>{savingCatalogue?'Saving...':'Save catalogue changes'}</Button></div><AdminProducts products={products} setProducts={editProducts} openProduct={setProductModal} openAdd={()=>setAddProduct(true)} openAddCategory={()=>setAddCategory(true)} notify={notify}/></>, 'stock-supply':<AdminCreditStockPage requests={stockRequests} products={products} entrepreneurs={entrepreneurs} inventory={shopInventory} review={reviewStockRequest} reviewExtension={reviewCreditExtension} catalogueLive={catalogueLive}/>, 'credit-settlements':<CreditSettlements entrepreneurs={entrepreneurs} setEntrepreneurs={setEntrepreneurs} settlements={settlements} requests={stockRequests} reviewSettlement={reviewSettlement} updateCashCollection={updateCashCollection} notify={notify}/>, 'credit-control':<CreditControl entrepreneurs={entrepreneurs} setEntrepreneurs={setEntrepreneurs} tiers={tiers} setTiers={editTiers} settlements={settlements} requests={stockRequests} reviewSettlement={reviewSettlement} notify={notify} onSave={saveCreditRules}/>,reports:<ReportsPage entrepreneurs={entrepreneurs} orders={liveOrders} products={products}/>, 'user-access':<UserAccessPage users={systemUsers} setUsers={setSystemUsers} notify={notify} currentUser={authUser}/>}
  adminPages.payouts=<CommissionPayouts orders={liveOrders} openOrder={order=>setOrderModal({...order,payoutOnly:true})}/>
  const mobilePageIds = mode === 'admin'
    ? ['overview', 'entrepreneurs', 'admin-orders', 'payouts', 'reports']
    : creditEligible?['home', 'orders', 'products', 'credit', 'profile']:['home', 'orders', 'products', 'growth', 'profile']
  const mobileNavigation = (mode === 'admin' ? adminNav : entrepreneurNav)
    .filter(([id]) => mobilePageIds.includes(id))
    .filter(([id]) => mode !== 'admin' || userPermissions(authUser) === null || userPermissions(authUser).includes(id) || (id==='credit-settlements'&&userPermissions(authUser).includes('credit-control')))
    .sort(([firstId],[secondId]) => mobilePageIds.indexOf(firstId) - mobilePageIds.indexOf(secondId))
  const mobileNavActive = id => id === page || (
    mode !== 'admin' && id === 'credit' && ['credit-stock', 'credit-requests', 'credit-inventory', 'repayments', 'repayment-detail'].includes(page)
  )
  if(authLoading)return <div className="auth-loading"><span></span><strong>Opening CAMY securely…</strong></div>
  if(registrationLocationActive())return <LoginScreen onLogin={login}/>
  if(!authUser)return <LoginScreen onLogin={login}/>
  if(passwordResetRequired||passwordModal)return <ChangePasswordModal required={passwordResetRequired} close={()=>setPasswordModal(false)} done={message=>{setPasswordResetRequired(false);setPasswordModal(false);notify(message)}}/>
  if(!marketReady)return <div className="auth-loading">{syncError?<><strong>Business data could not load</strong><p>{syncError}</p><Button onClick={()=>setRefreshVersion(old=>old+1)}>Retry loading</Button><Button variant="secondary" onClick={logout}>Sign out</Button></>:<><span/><strong>Loading your business data...</strong></>}</div>
  return <div className={`app-v2 ${mode==='admin'?'admin-shell':'entrepreneur-shell'}`} data-page={page}><Sidebar mode={mode} setMode={setMode} page={page} setPage={navigateFromMenu} open={menu} setOpen={setMenu} notify={notify} onLogout={logout} user={authUser}/><main><Topbar mode={mode} page={page} setPage={setPage} onMenu={()=>setMenu(true)} onNewOrder={openNewOrder} onCart={openOrderCart} cartCount={orderCartCount} notifications={notifications} setNotifications={setNotifyOpen} onSearch={runGlobalSearch} query={globalQuery} setQuery={setGlobalQuery} profile={profile} user={authUser}/>{mode==='admin'?(userPermissions(authUser)===null||userPermissions(authUser).includes(page)||(page==='credit-settlements'&&userPermissions(authUser).includes('credit-control'))?adminPages[page]||adminPages.overview:<Empty icon={Settings} title="Access restricted" text="Choose an available page from your menu."/>):customerPages[page]||customerPages.home}</main><nav className="mobile-nav-v2" aria-label="Primary navigation">{mobileNavigation.map(([id,label,Icon])=>{const orderAction=mode!=='admin'&&id==='products';return <button className={`${mobileNavActive(id)?'active ':''}${orderAction?'mobile-order-action':''}`.trim()} aria-current={mobileNavActive(id)?'page':undefined} aria-label={orderAction?'Create new order':undefined} key={id} onClick={()=>navigateFromMenu(id)}><Icon/><span>{orderAction?'Order':label}</span></button>})}</nav>{productModal&&<ProductModal product={productModal} close={()=>setProductModal(null)} addToCart={addToCart} admin={mode==='admin'} setProducts={editProducts} notify={notify}/>} {orderModal&&<OrderModal key={`${orderModal.id}-${orderModal.payoutOnly?'payment':'fulfilment'}`} onUpdated={()=>setRefreshVersion(old=>old+1)} order={orderModal} orders={liveOrders} products={products} admin={mode==='admin'} entrepreneur={entrepreneurs.find(item=>String(item.id)===String(orderModal.entrepreneurId))} onViewCommission={openCommission} onManageDeliveries={orderId=>{const target=liveOrders.find(item=>String(item.id)===String(orderId));if(target)setOrderModal({...target,payoutOnly:false});else notify(`Order ${orderId} could not be found`)}} updateOrderStatus={updateOrderStatus} updateOrderDetails={updateOrderDetails} openEntrepreneur={()=>{const person=entrepreneurs.find(item=>String(item.id)===String(orderModal.entrepreneurId));if(person){setOrderModal(null);setPersonModal({person,readOnly:false})}else notify('Entrepreneur profile was not found')}} close={()=>setOrderModal(null)}/>} {cartOpen&&<CartDrawer cart={cart} setCart={setCart} close={()=>setCartOpen(false)} placeOrder={placeOrder}/>} {notifyOpen&&<NotificationsDrawer notifications={notifications} setNotifications={setNotifications} close={()=>setNotifyOpen(false)}/>} {settlementModal&&<SettlementModal close={()=>setSettlementModal(false)} submit={submitSettlement}/>} {addEntrepreneur&&<AddEntrepreneurModal close={()=>setAddEntrepreneur(false)} submit={createEntrepreneur}/>} {personModal&&<EntrepreneurModal person={personModal.person} readOnly={personModal.readOnly} orders={liveOrders} setOrders={setOrders} close={()=>setPersonModal(null)} setEntrepreneurs={setEntrepreneurs} notify={notify}/>} {addProduct&&<AddProductModal close={()=>setAddProduct(false)} submit={createProduct}/>} {addCategory&&<AddCategoryModal close={()=>setAddCategory(false)} submit={createCategory}/>} {toast&&<div className="toast-v2" role="status" aria-live="polite" aria-atomic="true"><span><Check/></span>{toast}</div>}</div>
}
