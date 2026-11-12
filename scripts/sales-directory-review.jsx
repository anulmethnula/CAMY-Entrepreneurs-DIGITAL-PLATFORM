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

const orders=[{id:'CMY-1004',date:'2026-11-10',createdAt:'2026-11-10T09:00:00',customer:'Mari Priyanka',phone:'0754166981',entrepreneurId:'CE-1252',entrepreneur:'K.B.M.Thushara',district:'Kaluthara',address:'103 Winewelketiyagama',items:[{productId:1,name:'Fry Pan 18 Cm',qty:1,price:2000,camyPrice:1500,deliveryCost:0}],amount:2000,qty:1,entrepreneurMargin:500,status:'Delivered',payoutStatus:'paid',clientPaymentMethod:'cod',orderMode:'dropship'},{id:'CMY-1005',date:'2026-11-11',customer:'Piyumali Fonseka',phone:'0773357968',entrepreneur:'K.B.M.Thushara',entrepreneurId:'CE-1252',items:[{productId:2,name:'Water Filter 16 Ltr',qty:1,price:8200,camyPrice:6200,deliveryCost:0}],amount:8200,qty:1,status:'Pending',createdBy:'CAMY Admin',clientPaymentMethod:'cod'}]
const sale={id:'DS-94545727EBD457',saleDate:'2026-11-12',createdAt:'2026-11-12T10:00:00',customerType:'entrepreneur',entrepreneurId:'CE-1245',buyer:{name:'K.I.d.Tharindi Srinath halpe',phone:'0751113356',district:'Gampaha'},items:[{productId:1,code:'P1',name:'4 Pcs Set',qty:1,finalUnitPrice:10000},{productId:2,code:'P2',name:'5 Pcs Set',qty:1,finalUnitPrice:8000},{productId:3,code:'P3',name:'Multi Cooker',qty:1,finalUnitPrice:7000},{productId:4,code:'P4',name:'Stand Fan',qty:1,finalUnitPrice:5040}],qty:4,total:30040,amountReceived:30040,discountTotal:0,paymentMethod:'cash',paymentStatus:'Paid',fulfilmentStatus:'Handed Over',businessStatus:'Confirmed',payments:[{id:'pay1',method:'cash',amount:30040,date:'2026-11-12',status:'Verified',reference:''}],version:1}
const products=[{id:1,name:'4 Pcs Set',code:'P1',stock:20,price:30040},{id:2,name:'Water Filter 16 Ltr',code:'P2',stock:10,price:8200}]
let deleted=false
window.fetch=async (url,options={})=>{const path=String(url);if(path.includes('/admin/sales/')){if(options.method==='PATCH'||options.method==='DELETE'){window.__correctionPayload=JSON.parse(options.body);window.__correctionMethod=options.method;if(options.method==='DELETE')deleted=true;return new Response(JSON.stringify({ok:true}),{status:200})}return new Response(JSON.stringify({record:sale,token:'fixture-token'}),{status:200})}return new Response(JSON.stringify({sales:deleted?[]:[sale],access:{create:true,pricing:true,finance:true,approve:true},company:{},receiptMaxMb:20}),{status:200})}
function Review(){const [viewer,setViewer]=useState(false);return <div className="admin-shell" data-page="admin-orders"><button id="viewer-toggle" onClick={()=>setViewer(!viewer)}>Toggle viewer fixture</button><AdminOrders orders={orders} products={products} entrepreneurs={[]} canCorrect={!viewer} readOnly={viewer} openOrder={()=>{window.__codOpened=true}} onManualOrder={()=>false}/></div>}
createRoot(document.getElementById('root')).render(<Review/>);
