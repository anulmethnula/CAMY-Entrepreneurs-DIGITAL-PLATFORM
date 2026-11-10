import {AdminOrders} from '../src/App'
// Read-only QA entry point; excluded from production builds.
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import ReportsWorkspace from '../src/ReportsWorkspace'
import {DropshipOrderPage} from '../src/DropshipMarketplace'
import {ProductMediaGallery} from '../src/ProductMedia'
import {OrderReview} from '../src/Workflow'
import '../src/styles.css'
import '../src/shop.css'
import '../src/polish.css'
import '../src/inventory.css'
import '../src/credit-payments.css'
import '../src/commission-ui.css'
import '../src/orders-ui.css'
import '../src/credit-stock-ui.css'
import '../src/credit-orders-ui.css'
import '../src/entrepreneurs-ui.css'
import '../src/admin-orders-ui.css'
import '../src/shell-fixes.css'
import '../src/mobile-app.css'
import '../src/search-ui.css'
import '../src/erp-improvements.css'
const data=window.__erpReviewData
window.__reviewSetStatus=null
const realFetch=window.fetch.bind(window)
window.fetch=(url,options)=>String(url).endsWith('/admin/direct-sales')?Promise.resolve(new Response(JSON.stringify({sales:[],access:{},company:{}}),{status:200,headers:{'Content-Type':'application/json'}})):String(url).endsWith('/admin/reports/data')?Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})):String(url).endsWith('/status')&&options?.method==='POST'?Promise.resolve(new Response(JSON.stringify({orders:[{...data.orders[0],...JSON.parse(options.body)}]}),{status:200,headers:{'Content-Type':'application/json'}})):realFetch(url,options)
function Review(){const [view,setView]=useState('reports'),[workspace,setWorkspace]=useState('catalogue'),[order,setOrder]=useState(data.orders.find(o=>o.status==='Dispatched')||data.orders[0]);window.__reviewSetStatus=status=>setOrder(o=>({...o,status}));return <div className={view==='catalogue'?'entrepreneur-shell':'admin-shell'} data-page={view==='catalogue'?'catalogue':'reports'}><nav style={{padding:12,display:'flex',gap:12}}>{['reports','catalogue','gallery','fulfilment','orders'].map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav>{view==='orders'?<AdminOrders orders={data.orders} products={data.products} entrepreneurs={data.entrepreneurs} openOrder={()=>{}} onManualOrder={()=>false}/>:view==='reports'?<ReportsWorkspace/>:view==='catalogue'?<DropshipOrderPage products={data.products} orders={[]} person={{id:'read-only-review'}} catalogueLive catalogueMode notify={console.info} workspaceView={workspace} setWorkspaceView={setWorkspace}/>:view==='gallery'?<div style={{maxWidth:600,margin:'auto'}}><ProductMediaGallery product={data.products[0]} promotional/></div>:<div style={{maxWidth:850,margin:'auto',padding:20}}><OrderReview order={order} onDone={(_,updated)=>updated&&setOrder(updated)}/></div>}</div>}
createRoot(document.getElementById('root')).render(<Review/>);
