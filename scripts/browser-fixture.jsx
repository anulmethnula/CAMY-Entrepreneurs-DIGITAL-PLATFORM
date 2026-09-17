import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminSupplyPage } from '../src/Marketplace'
import { PublicMarketplace } from '../src/PublicMarketplace'
import { OrderReview } from '../src/Workflow'
import { AdminCustomerReviews } from '../src/AdminCustomerReviews'
import { OrderReturns } from '../src/OrderReturns'
import { EntrepreneurCustomers } from '../src/EntrepreneurCustomers'
let activeFixtureRoot

export function mountReturnFixture() {
  activeFixtureRoot?.unmount()
  let order = { ...window.shopFixtureOrders[0], customerId: 1, status: 'Delivered', return: undefined }
  const previousFetch = window.fetch
  window.fetch = async (url, options = {}) => {
    if (!String(url).includes('/return/')) return previousFetch(url, options)
    const action = String(url).split('/').pop(), body = JSON.parse(options.body)
    const record = { ...order.return }
    if (action === 'request') Object.assign(record, { status: 'Requested', reason: body.reason })
    if (action === 'approve') Object.assign(record, { status: 'Approved', instructions: body.instructions })
    if (action === 'ship') Object.assign(record, { status: 'Shipped', trackingNumber: body.trackingNumber, courier: body.courier })
    if (action === 'receive') { Object.assign(record, { status: 'Received', refundStatus: 'Pending', refundAmount: order.amount }); order.status = 'Returned' }
    if (action === 'refund') Object.assign(record, { refundStatus: 'Refunded', refundReference: body.reference })
    order = { ...order, return: record }
    return new Response(JSON.stringify({ order }), { headers: { 'Content-Type': 'application/json' } })
  }
  function Fixture() {
    const [value, setValue] = useState(order)
    const [seller, setSeller] = useState(false)
    return <main className="shop-page" style={{padding:20}}><button onClick={() => setSeller(!seller)}>{seller ? 'Customer view' : 'Seller view'}</button><OrderReturns key={String(seller) + value.return?.status} order={value} seller={seller} onDone={setValue}/><EntrepreneurCustomers orders={[value, {...value, id:'SECOND-PURCHASE', return:undefined, status:'Delivered'}, {...value,id:'GUEST-PURCHASE',customerId:null,customer:'Guest buyer'}]}/></main>
  }
  const root = document.createElement('div'); document.body.replaceChildren(root); activeFixtureRoot = createRoot(root); activeFixtureRoot.render(<Fixture/>)
}

export function mountShopFixture() {
  activeFixtureRoot?.unmount()
  const customer={id:1,name:'Test Customer',email:'buyer@example.invalid',phone:'0771234567',district:'Colombo',address:'123 Test Street, Colombo'}
  const products=[{id:1,code:'CK-01',name:'Classic Cookware Collection',category:'Cookware',image:'/products/classic-set.png',price:12000,description:'Everyday cooking essentials with a durable finish.',warranty:'1 year',specs:['Durable cooking surface','Easy to clean','Original CAMY collection']},{id:2,code:'FP-24',name:'Non-stick Fry Pan · 24 cm',category:'Cookware',image:'/products/frypan-24.png',price:3400,specs:['Comfortable handle','Non-stick finish']},{id:3,code:'CS-01',name:'Family Casserole',category:'Kitchen essentials',image:'/products/casserole.png',price:5500}]
  const entrepreneurs=[{id:'CE-ONE',name:'Nimali Home Essentials',city:'Colombo'},{id:'CE-TWO',name:'Sahan Living',city:'Gampaha'}]
  const inventory=[{entrepreneurId:'CE-ONE',productId:1,qty:999999,price:12000},{entrepreneurId:'CE-ONE',productId:2,qty:999999,price:3400},{entrepreneurId:'CE-TWO',productId:1,qty:999999,price:12500},{entrepreneurId:'CE-TWO',productId:3,qty:999999,price:5500}]
  const orders=[];const requests=new Map();let lostResponse=true
  const favourites=[],reviews=[],addresses=[]
  window.shopFixtureReviews=reviews
  window.deliverShopFixtureOrders=()=>orders.forEach(order=>{order.status='Delivered'})
  window.shopFixtureOrders=orders
  window.approveShopFixtureOrders=()=>orders.forEach(order=>{order.status='Awaiting payment';order.bankDetails={bank:order.entrepreneurId==='CE-ONE'?'First Bank':'Second Bank',branch:'Main',holder:order.entrepreneur,account:order.entrepreneurId==='CE-ONE'?'111111':'222222'}})
  const originalFetch=window.fetch.bind(window)
  window.fetch=async (url,options={})=>{
    const path=String(url);let data={};let status=200;const body=options.body?JSON.parse(options.body):{}
    if(path==='/api/marketplace/public')data={products,entrepreneurs,inventory}
    else if(path.startsWith('/api/marketplace/reviews?')){const params=new URL(path,location.origin).searchParams;data={reviews:reviews.filter(review=>review.status==='Published'&&String(review.product_id)===params.get('productId')&&review.shop_id===params.get('shopId')).map(review=>({...review,name:'Test · Verified buyer'}))}}
    else if(path==='/api/customer/favourites'&&options.method==='POST'){const index=favourites.findIndex(item=>item.shopId===body.shopId&&String(item.productId)===String(body.productId));if(body.saved&&index<0){const product=products.find(product=>String(product.id)===String(body.productId));const shop=entrepreneurs.find(shop=>shop.id===body.shopId);favourites.push({shopId:body.shopId,productId:body.productId,product,shop,available:true,price:inventory.find(item=>item.entrepreneurId===body.shopId&&String(item.productId)===String(body.productId)).price})}else if(!body.saved&&index>=0)favourites.splice(index,1);data={ok:true}}
    else if(path==='/api/customer/favourites')data={favourites}
    else if(path==='/api/customer/reviews'&&options.method==='POST'){const order=orders.find(order=>order.id===body.orderId);const product=order.items.find(item=>String(item.id)===String(body.productId));const previous=reviews.find(review=>String(review.product_id)===String(body.productId)&&review.shop_id===order.entrepreneurId);const value={id:'REVIEW-UI-1',product_id:body.productId,shop_id:order.entrepreneurId,product_name:product.name,order_id:order.id,rating:body.rating,comment:body.comment,status:'Pending',customer_name:customer.name,customer_email:customer.email,updated_at:'2026-09-17 10:00:00'};if(previous)Object.assign(previous,value);else reviews.push(value);data={ok:true}}
    else if(path==='/api/customer/reviews')data={reviews}
    else if(path==='/api/customer/addresses'&&options.method==='POST'){if(body.action==='delete'){const index=addresses.findIndex(address=>String(address.id)===String(body.id));if(index>=0)addresses.splice(index,1)}else if(body.id){Object.assign(addresses.find(address=>String(address.id)===String(body.id)),body)}else addresses.push({...body,id:addresses.length+1});data={ok:true}}
    else if(path==='/api/customer/addresses')data={addresses}
    else if(path==='/api/admin/customer-reviews'&&options.method==='POST'){const review=reviews.find(review=>review.id===body.id);Object.assign(review,{status:body.status,admin_reply:body.reply,updated_at:'2026-09-17 11:00:00'});data={ok:true}}
    else if(path==='/api/admin/customer-reviews')data={reviews}
    else if(path==='/api/customer/me')data={customer}
    else if(path==='/api/customer/orders')data={tracking:orders.map(order=>({id:order.id,token:order.token,status:order.status,amount:order.amount,shop:order.entrepreneur,shopId:order.entrepreneurId,date:order.date,items:order.items.map(item=>({...products.find(product=>product.id===item.id),...item}))}))}
    else if(path==='/api/customer/profile'){Object.assign(customer,body);data={customer}}
    else if(path==='/api/marketplace/orders'){
      if(requests.has(body.requestKey))data=requests.get(body.requestKey)
      else{
        const tracking=[]
        for(const shopId of new Set(body.items.map(item=>item.shopId))){const person=entrepreneurs.find(person=>person.id===shopId);const selected=body.items.filter(item=>item.shopId===shopId).map(item=>({...item,id:item.productId,name:products.find(product=>product.id===item.productId).name,price:item.expectedPrice}));const id='CMY-UI-'+(orders.length+1);const token='private-'+id;orders.push({id,token,entrepreneurId:shopId,entrepreneur:person.name,items:selected,amount:selected.reduce((sum,item)=>sum+item.qty*item.price,0),status:'Pending',address:customer.address,phone:customer.phone,customer:customer.name,date:'2026-09-17'});tracking.push({id,token})}
        data={ids:tracking.map(item=>item.id),tracking};requests.set(body.requestKey,data)
        if(lostResponse){lostResponse=false;throw new TypeError('Simulated lost checkout response')}
      }
      status=201
    }else if(path.includes('/tracking?')){const id=path.split('/')[4];data={order:orders.find(order=>order.id===id)}}
    else if(path.endsWith('/receipt')&&options.method==='POST'){const id=path.split('/')[4];const order=orders.find(order=>order.id===id);order.status='Payment review';order.reference=body.reference;order.receipt='/fixture-receipt';data={order}}
    else if(path==='/fixture-receipt')return originalFetch('/products/classic-set.png')
    else if(path.endsWith('/status')&&options.method==='POST'){const id=path.split('/')[4];const order=orders.find(order=>order.id===id);Object.assign(order,{status:body.status,trackingNumber:body.trackingNumber,courier:body.courier});data={orders}}
    else return originalFetch(url,options)
    return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
  }
  const root=document.createElement('div');document.body.replaceChildren(root);activeFixtureRoot=createRoot(root);activeFixtureRoot.render(<PublicMarketplace/>)
}

export function mountDispatchFixture() {
  function DispatchFixture() {
    const [order,setOrder]=useState({...window.shopFixtureOrders[0],status:'Processing'})
    return <main className="shop-page" style={{padding:24}}><OrderReview key={order.status} order={order} onDone={(status,updated)=>setOrder(updated || {...order,status})}/></main>
  }
  activeFixtureRoot?.unmount()
  const root=document.createElement('div');document.body.replaceChildren(root);activeFixtureRoot=createRoot(root);activeFixtureRoot.render(<DispatchFixture/>)
}
export function mountFeedbackAdminFixture() {
  activeFixtureRoot?.unmount()
  const root=document.createElement('div');document.body.replaceChildren(root);activeFixtureRoot=createRoot(root);activeFixtureRoot.render(<AdminCustomerReviews/>)
}

export function mountFixture() {
  const root = document.createElement('div')
  root.id = 'smoke-fixture'
  document.body.replaceChildren(root)
  const initial = { id: 'SUP-UI-TEST', entrepreneurId: 'CE-UI-TEST', entrepreneurName: 'Test Entrepreneur', status: 'Pending', createdAt: new Date().toISOString(), total: 2000, items: [{ productId: 1, qty: 2, price: 1000 }] }
  function Fixture() {
    const [requests, setRequests] = useState([initial])
    const review = async (id, status, reason, items) => setRequests(old => old.map(request => status === 'Edited' ? { ...request, items, total: items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0), updatedAt: new Date().toISOString() } : { ...request, status }))
    return <AdminSupplyPage requests={requests} products={[{ id: 1, code: 'TEST-01', name: 'Test CAMY Product', category: 'Appliances', stock: 20, price: 1000, image: '/products/classic-set.png' }]} entrepreneurs={[{ id: 'CE-UI-TEST', name: 'Test Entrepreneur', phone: '0771234567', email: 'test@example.invalid', nic: '199512345678', address: 'Test delivery address', city: 'Colombo' }]} inventory={[]} catalogueLive bank={{ bank: 'Test Bank', branch: 'Test Branch', holder: 'CAMY Test', account: '000001' }} review={review}/>
  }
  activeFixtureRoot=createRoot(root);activeFixtureRoot.render(<Fixture/>)
}
