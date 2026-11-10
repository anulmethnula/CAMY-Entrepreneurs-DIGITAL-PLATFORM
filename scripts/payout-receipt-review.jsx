// Isolated UI QA props only. This harness is excluded from production builds.
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {DropshipPayoutPanel} from '../src/App'
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


window.__requests=[];window.__streams=[];window.__done=[];
const order={id:'QA-PAYOUT',orderMode:'dropship',status:'Delivered',payoutStatus:'pending_transfer',entrepreneurMargin:100,camyCost:200,amount:300};
window.fetch=async(url,options={})=>{const data=options.body?JSON.parse(options.body):{};window.__requests.push({url,data});let result={};if(String(url).endsWith('/payout-upload'))result={uploadId:'a'.repeat(48)};else if(data.action==='status')result={offset:0};else if(data.action==='chunk')result={offset:data.offset+atob(data.bytes).length};else if(data.action==='finish')result={ready:true};else if(String(url).endsWith('/payout')){await new Promise(r=>setTimeout(r,150));result={order:{...order,payoutStatus:'paid',payoutReference:data.reference}}}return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}})};
const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async opts=>{const stream=await getMedia(opts);window.__streams.push(stream);return stream};
createRoot(document.getElementById('root')).render(<main style={{maxWidth:900,margin:'20px auto'}}><DropshipPayoutPanel order={order} admin entrepreneur={{name:'QA seller',bankDetails:{bank:'QA Bank',branch:'QA Branch',holder:'QA holder',account:'00123'}}} onDone={(...args)=>window.__done.push(args)}/></main>);
