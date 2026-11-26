// Isolated UI QA props only. This harness is excluded from production builds.
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ProfilePage,OrderInvoicePanel} from '../src/App'
import {DropshipHome} from '../src/DropshipMarketplace'
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

const person={id:'QA',name:'Read-only preview',joined:'2026-10-01',credit:0,used:0}
window.__invoiceSubmissions=[]
window.__openedCommunity=[]
window.open=(...args)=>window.__openedCommunity.push(args)
window.fetch=async(url,options)=>{if(String(url).endsWith('/invoice')&&options?.method==='POST'){window.__invoiceSubmissions.push({url,payload:JSON.parse(options.body)});return new Response(JSON.stringify({order:{id:'QA-INVOICE',invoiceNumber:JSON.parse(options.body).invoiceNumber},message:'Invoice submitted successfully.'}),{status:200,headers:{'Content-Type':'application/json'}})}throw Error('Unexpected network request in isolated UI test')}
function Preview(){const [view,setView]=useState('home'),[profile,setProfile]=useState({name:person.name,joined:person.joined});return <div className="entrepreneur-shell" data-page={view}><nav>{['home','profile','invoice'].map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav>{view==='home'?<DropshipHome person={person} orders={[]} setPage={()=>{}} openOrders={()=>{}}/>:view==='profile'?<ProfilePage profile={profile} setProfile={setProfile} person={person} orders={[]} entrepreneurs={[person]} notify={()=>{}}/>:<div style={{maxWidth:1050,margin:'20px auto',padding:16}}><OrderInvoicePanel order={{id:'QA-INVOICE'}} admin onDone={()=>{}}/></div>}</div>}
createRoot(document.getElementById('root')).render(<Preview/>);
