import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {DropshipOrderPage} from '../src/DropshipMarketplace'
import {OrderInvoicePanel} from '../src/App'
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

const data=window.__erpReviewData
window.__invoiceWrites=[]
const realFetch=window.fetch.bind(window)
window.fetch=async(url,options={})=>{
 if(String(url).includes('/invoice')&&options.method==='POST'){
  const payload=JSON.parse(options.body);window.__invoiceWrites.push(payload)
  if(window.__failInvoice)return new Response(JSON.stringify({message:'Simulated save failure'}),{status:500})
  window.__invoiceOrder={...window.__invoiceOrder,invoiceNumber:payload.invoiceNumber,invoiceVersion:String(Date.now())}
  return new Response(JSON.stringify({order:window.__invoiceOrder,message:'Invoice updated successfully.'}),{status:200})
 }
 if(String(url).endsWith('/invoice'))return new Response('%PDF-1.4 fixture',{headers:{'Content-Type':'application/pdf'}})
 return realFetch(url,options)
}
function Review(){
 const [view,setView]=useState('products'),[workspace,setWorkspace]=useState('catalogue')
 const [order,setOrder]=useState({...data.orders[0],id:'invoice-browser-fixture',invoiceNumber:'QA-ORIGINAL',invoice:'/api/marketplace/orders/invoice-browser-fixture/invoice',invoiceVersion:'original'})
 window.__invoiceOrder=order
 return <div className="entrepreneur-shell" data-page={view}><header className="topbar-v2" style={{position:'sticky',top:0,height:78,zIndex:120}}>CAMY layout review <button onClick={()=>setView('products')}>Products fixture</button><button onClick={()=>setView('invoice')}>Invoice fixture</button></header>{view==='products'?<DropshipOrderPage products={data.products} orders={[]} person={{id:'invoice-products-review'}} catalogueLive workspaceView={workspace} setWorkspaceView={setWorkspace}/>:<OrderInvoicePanel order={order} admin onDone={setOrder}/>}</div>
}
createRoot(document.getElementById('root')).render(<Review/>);
