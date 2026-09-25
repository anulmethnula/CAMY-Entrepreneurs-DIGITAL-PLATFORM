import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { ArrowRight, CheckCircle2, CircleDollarSign, Clock3, PackageCheck, PackagePlus, Plus, RefreshCw, Search, ShieldCheck, Trash2, Truck, UserRound, WalletCards, X } from 'lucide-react'
import './direct-orders.css'

const money = value => 'Rs. ' + Number(value || 0).toLocaleString('en-LK')
const activeStatuses = ['Pending', 'Processing', 'Dispatched']
const channels = ['WhatsApp', 'Phone call', 'Facebook / Instagram', 'In person', 'Other']

function creditState(person) {
  const limit=Math.max(0,Number(person?.credit||0)), used=Math.max(0,Number(person?.used||0)), available=Math.max(0,limit-used)
  if(!limit)return{label:'Building eligibility',tone:'building',detail:'Delivered sales build your CAMY credit eligibility.',limit,used,available}
  const ratio=used/limit
  if(ratio>=.9)return{label:'High usage',tone:'high',detail:'Most of your approved credit is currently used.',limit,used,available}
  if(ratio>=.6)return{label:'Watch usage',tone:'watch',detail:'Credit usage is above 60%.',limit,used,available}
  return{label:'Healthy',tone:'healthy',detail:'Your CAMY credit position has comfortable available capacity.',limit,used,available}
}

function CreditSensor({person}) {
  const state=creditState(person)
  return <article className={'direct-credit-sensor '+state.tone}><div><span><WalletCards/> CREDIT SENSOR</span><strong>{state.label}</strong><p>{state.detail}</p></div><dl><div><dt>Limit</dt><dd>{money(state.limit)}</dd></div><div><dt>Used</dt><dd>{money(state.used)}</dd></div><div><dt>Available</dt><dd>{money(state.available)}</dd></div></dl></article>
}

function OrderComposer({products,close,created,notify}) {
  const available=products.filter(product=>Number(product.stock||0)>0)
  const [client,setClient]=useState({name:'',phone:'',district:'',address:''})
  const [salesChannel,setSalesChannel]=useState('WhatsApp')
  const [clientReference,setClientReference]=useState('')
  const [notes,setNotes]=useState('')
  const [lines,setLines]=useState(()=>available[0]?[{productId:String(available[0].id),qty:1,sellPrice:Number(available[0].price||0)}]:[])
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const productFor=line=>products.find(product=>String(product.id)===String(line.productId))
  const addLine=()=>{const next=available.find(product=>!lines.some(line=>String(line.productId)===String(product.id)));if(next)setLines(old=>[...old,{productId:String(next.id),qty:1,sellPrice:Number(next.price||0)}])}
  const updateLine=(index,key,value)=>setLines(old=>old.map((line,i)=>{if(i!==index)return line;if(key==='productId'){const product=products.find(item=>String(item.id)===String(value));return{...line,productId:String(value),sellPrice:Number(product?.price||0),qty:1}}return{...line,[key]:value}}))
  const total=lines.reduce((sum,line)=>sum+Number(line.qty||0)*Number(line.sellPrice||0),0)
  const base=lines.reduce((sum,line)=>sum+Number(line.qty||0)*Number(productFor(line)?.price||0),0)
  const submit=async event=>{
    event.preventDefault();if(busy)return;setError('')
    const phone=client.phone.trim().replace(/[\s-]/g,'')
    if(!client.name.trim()||!/^(?:\+94|0)7\d{8}$/.test(phone)||!client.district.trim()||!client.address.trim())return setError('Enter the client name, valid Sri Lankan mobile number, district and delivery address.')
    if(!lines.length)return setError('Add at least one CAMY product.')
    setBusy(true)
    try{
      const result=await api('/marketplace/entrepreneur-orders',{method:'POST',body:JSON.stringify({customer:{...client,phone},salesChannel,clientReference:clientReference.trim(),notes:notes.trim(),items:lines.map(line=>({productId:line.productId,qty:Number(line.qty),sellPrice:Number(line.sellPrice)}))})})
      notify?.(result.message||'Order sent to CAMY Operations.');created?.(result.order);close()
    }catch(reason){setError(reason.message)}finally{setBusy(false)}
  }
  return <div className="direct-order-overlay" onMouseDown={close}><form className="direct-order-composer" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}><header><div><span>ENTREPRENEUR SALES ORDER</span><h2>Send a client order to CAMY</h2><p>You take the order from your client. CAMY checks stock, packs it, dispatches it, and updates delivery progress here.</p></div><button type="button" className="direct-icon" onClick={close}><X/></button></header>
    <section><h3><UserRound/> 1. Client details</h3><div className="direct-grid"><label>Client name<input required value={client.name} onChange={event=>setClient(old=>({...old,name:event.target.value}))}/></label><label>Mobile number<input required placeholder="0771234567" value={client.phone} onChange={event=>setClient(old=>({...old,phone:event.target.value}))}/></label><label>District<input required value={client.district} onChange={event=>setClient(old=>({...old,district:event.target.value}))}/></label><label>Sales channel<select value={salesChannel} onChange={event=>setSalesChannel(event.target.value)}>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label></div><label>Full delivery address<textarea required rows="3" value={client.address} onChange={event=>setClient(old=>({...old,address:event.target.value}))}/></label></section>
    <section><h3><PackagePlus/> 2. Products and selling price</h3>{lines.map((line,index)=>{const product=productFor(line);const margin=(Number(line.sellPrice||0)-Number(product?.price||0))*Number(line.qty||0);return <div className="direct-line" key={index}><label>CAMY product<select value={line.productId} onChange={event=>updateLine(index,'productId',event.target.value)}>{available.map(item=><option disabled={lines.some((entry,i)=>i!==index&&String(entry.productId)===String(item.id))} value={item.id} key={item.id}>{item.name} · {money(item.price)}</option>)}</select></label><label>Qty<input min="1" max="1000" type="number" value={line.qty} onChange={event=>updateLine(index,'qty',Math.max(1,Number(event.target.value)||1))}/></label><label>Your client price<input min="1" step="0.01" type="number" value={line.sellPrice} onChange={event=>updateLine(index,'sellPrice',event.target.value)}/></label><div className={margin>=0?'direct-margin positive':'direct-margin negative'}><small>{margin>=0?'Your margin':'Below CAMY base'}</small><strong>{money(Math.abs(margin))}</strong></div><button type="button" className="direct-icon danger" disabled={lines.length===1} onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))}><Trash2/></button></div>})}<button type="button" className="direct-add-line" disabled={lines.length>=available.length} onClick={addLine}><Plus/> Add another product</button></section>
    <section><h3><ShieldCheck/> 3. CAMY fulfilment</h3><div className="direct-grid"><label>Client reference / your order no.<input maxLength="120" value={clientReference} onChange={event=>setClientReference(event.target.value)} placeholder="Optional"/></label><label>Payment method<input value="Cash on delivery — CAMY collects" readOnly/></label></div><label>Delivery notes<textarea rows="3" maxLength="1000" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Landmark, preferred call time, fragile item note, etc."/></label><div className="direct-total"><span><small>CAMY base</small><b>{money(base)}</b></span><span><small>Client total</small><b>{money(total)}</b></span><span><small>Estimated margin</small><b>{money(total-base)}</b></span></div><p className="direct-help">Submitting reserves CAMY warehouse stock. CAMY Operations can confirm or reject the order. Rejected or returned orders restore reserved stock.</p></section>
    {error&&<p className="direct-error">{error}</p>}<footer><button type="button" className="direct-secondary" onClick={close}>Cancel</button><button className="direct-primary" disabled={busy||!lines.length}>{busy?'Sending to CAMY…':'Send order to CAMY'} <ArrowRight/></button></footer>
  </form></div>
}

function statusMeta(order){
  if(order.status==='Pending')return['Waiting for CAMY confirmation',Clock3]
  if(order.status==='Processing')return['CAMY is confirming / packing',PackageCheck]
  if(order.status==='Dispatched')return['Parcel is on the way',Truck]
  if(order.status==='Delivered')return['Delivered to client',CheckCircle2]
  return[order.status,Clock3]
}

export function DirectOrdersPage({orders=[],products=[],person,openOrder,refresh,notify}){
  const [composer,setComposer]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[lastRefresh,setLastRefresh]=useState(new Date())
  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible'){refresh?.();setLastRefresh(new Date())}},20000);return()=>window.clearInterval(timer)},[refresh])
  const visible=useMemo(()=>[...orders].filter(order=>(filter==='All'||order.status===filter)&&(String(order.id)+' '+String(order.customer)+' '+String(order.phone)+' '+String(order.trackingNumber||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date))),[orders,filter,query])
  const active=orders.filter(order=>activeStatuses.includes(order.status)).length,delivered=orders.filter(order=>order.status==='Delivered'),sales=delivered.reduce((sum,order)=>sum+Number(order.amount||0),0)
  const manualRefresh=()=>{refresh?.();setLastRefresh(new Date())}
  return <div className="content-page direct-orders-page"><section className="direct-orders-hero"><div><span>CLIENT ORDER CENTRE</span><h1>You sell. CAMY fulfils.</h1><p>Take orders from WhatsApp, phone, social media, or in person. Enter the client details here and CAMY handles packing, dispatch, courier tracking, and delivery updates.</p><div className="direct-hero-actions"><button className="direct-primary" onClick={()=>setComposer(true)}><Plus/> New client order</button><button className="direct-secondary" onClick={manualRefresh}><RefreshCw/> Refresh updates</button></div></div><div className="direct-live"><i/><strong>Live delivery updates</strong><small>Auto-refresh every 20 seconds</small><em>Last checked {lastRefresh.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</em></div></section>
    <section className="direct-kpis"><article><span><PackagePlus/></span><div><small>Total orders</small><strong>{orders.length}</strong><em>Entered by you</em></div></article><article><span><Truck/></span><div><small>Active deliveries</small><strong>{active}</strong><em>Pending to dispatched</em></div></article><article><span><CheckCircle2/></span><div><small>Delivered</small><strong>{delivered.length}</strong><em>{money(sales)} verified sales</em></div></article><article><span><CircleDollarSign/></span><div><small>Current margin</small><strong>{money(delivered.reduce((sum,order)=>sum+Number(order.commissionAmount||0),0))}</strong><em>Before CAMY settlement</em></div></article></section>
    <CreditSensor person={person}/>
    <section className="direct-workspace"><header><div><span>MY CLIENT ORDERS</span><h2>Track every order from CAMY confirmation to delivery</h2></div><div className="direct-filters"><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Order, client, phone or tracking"/></label><select value={filter} onChange={event=>setFilter(event.target.value)}><option>All</option><option>Pending</option><option>Processing</option><option>Dispatched</option><option>Delivered</option><option>Rejected</option><option>Returned</option></select></div></header>{visible.length?<div className="direct-order-list">{visible.map(order=>{const [label,Icon]=statusMeta(order);return <button className="direct-order-card" key={order.id} onClick={()=>openOrder?.(order)}><div className="direct-order-id"><span><Icon/></span><div><small>{order.id}</small><strong>{order.customer||'Client'}</strong><em>{order.phone||'No phone'} · {order.salesChannel||'Direct sale'}</em></div></div><div className="direct-order-products"><strong>{order.items?.map(item=>(item.name||'CAMY product')+' × '+item.qty).join(', ')||order.product}</strong><small>{order.address}</small></div><div className="direct-order-status"><span className={'direct-status '+String(order.status).toLowerCase().replaceAll(' ','-')}>{order.status}</span><strong>{label}</strong>{order.trackingNumber?<small>Tracking: {order.trackingNumber}</small>:<small>Open for full details</small>}</div><div className="direct-order-money"><strong>{money(order.amount)}</strong><small>Margin {money(order.commissionAmount||0)}</small><ArrowRight/></div></button>})}</div>:<div className="direct-empty"><PackagePlus/><h3>No matching client orders</h3><p>Create your first client order and CAMY Operations will receive it immediately.</p><button className="direct-primary" onClick={()=>setComposer(true)}><Plus/> New client order</button></div>}</section>
    {composer&&<OrderComposer products={products} close={()=>setComposer(false)} notify={notify} created={manualRefresh}/>}
  </div>
}
