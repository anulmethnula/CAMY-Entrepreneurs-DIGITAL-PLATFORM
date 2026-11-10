import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {AdminOrders} from '../src/App'
import ReportsWorkspace from '../src/ReportsWorkspace'
import {DirectPurchases} from '../src/DirectSales'
import {api} from '../src/api'
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
import '../src/camy-additions.css'
import '../src/invoice-products.css'
function Review(){
 const [data,setData]=useState(null),[view,setView]=useState('orders'),[error,setError]=useState('')
 const load=async()=>{try{setData(await api('/marketplace/state'))}catch(e){setError(e.message)}}
 useEffect(()=>{api('/auth/login',{method:'POST',body:JSON.stringify({email:'qa-admin@example.invalid',password:'DirectSales!1234'})}).then(load).catch(e=>setError(e.message));window.addEventListener('camy-business-updated',load);return()=>window.removeEventListener('camy-business-updated',load)},[])
 return <div className="admin-shell" data-page={view==='reports'?'reports':'admin-orders'}><nav style={{padding:12,display:'flex',gap:12}}>{['orders','reports','profile'].map(v=><button key={v} onClick={()=>setView(v)}>{v} fixture</button>)}</nav>{error&&<p role="alert">{error}</p>}{!data?<p>Loading test session...</p>:view==='reports'?<ReportsWorkspace/>:view==='profile'?<DirectPurchases member="E1"/>:<AdminOrders products={data.products} entrepreneurs={data.entrepreneurs} orders={data.orders} onManualOrder={()=>false} openOrder={()=>{}}/>}</div>
}
createRoot(document.getElementById('root')).render(<Review/>);
