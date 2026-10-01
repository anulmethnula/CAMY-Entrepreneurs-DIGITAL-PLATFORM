import React from 'react'
import { createRoot } from 'react-dom/client'
import { CommissionPayouts } from '../src/App'
import camyLogo from '../camy-logo-official.png'

const base={orderMode:'dropship',phone:'0771234567',date:'2026-09-29',clientPaymentStatus:'Collect on delivery'}
const orders=[
  {...base,id:'CMY-e3fcdbe356',entrepreneur:'Anul Methnula',entrepreneurId:'CE-0201',customer:'Kasun Perera',product:'18,000 BTU Air Conditioner',amount:275000,camyCost:175000,entrepreneurMargin:100000,status:'Delivered',payoutStatus:'pending_transfer',deliveredAt:'2026-10-01'},
  {...base,id:'CMY-eca7b55981',entrepreneur:'Kosala Fernando',entrepreneurId:'CE-0202',customer:'Dinushi Silva',product:'2 CAMY products',amount:6000,camyCost:3700,entrepreneurMargin:2300,status:'Dispatched',payoutStatus:'pending_delivery'},
  {...base,id:'CMY-a4bf22018',entrepreneur:'Nimali Perera',entrepreneurId:'CE-0188',customer:'Bhagya Silva',product:'Classic Cookware Collection',amount:34000,camyCost:25000,entrepreneurMargin:9000,status:'Delivered',payoutStatus:'paid',payoutReference:'BANK-92840',payoutPaidAt:'2026-09-30'},
  {...base,id:'CMY-d8ce91731',entrepreneur:'Sahan Jayawardena',entrepreneurId:'CE-0193',customer:'Tharindu Senanayake',product:'Family Casserole',amount:18000,camyCost:12000,entrepreneurMargin:6000,status:'Returned',payoutStatus:'reversal_required'},
]
const nav=['Overview','Entrepreneurs','Orders','Products','Commission payouts','Credit stock','Credit control','Reports','Users & access']

function Shell(){return <div className="app-v2 admin-shell" data-page="payouts"><aside className="sidebar-v2"><div className="side-brand"><div className="brand"><img src={camyLogo} alt="CAMY"/></div></div><div className="workspace-card"><span>⚙</span><div><strong>CAMY Admin</strong><small>Management workspace</small></div></div><p className="side-label">Management</p><nav className="side-links">{nav.map(label=><button className={label==='Commission payouts'?'active':''} key={label}><span>{label}</span></button>)}</nav><button className="logout">Sign out <small>admin@camy.lk</small></button></aside><main><header className="topbar-v2"><div className="topbar-left"><div><small>CAMY Management</small><strong>Commission payouts</strong></div></div><div className="topbar-actions"><label className="top-search"><input placeholder="Search management records…"/></label><button className="icon-btn">◌</button><div className="user-chip"><span>AD</span><div><strong>CAMY Administrator</strong><small>Super Admin</small></div></div></div></header><CommissionPayouts orders={orders} openOrder={()=>{}}/></main></div>}
export function mountCommissionPayoutsFixture(){document.body.replaceChildren(Object.assign(document.createElement('div'),{id:'payout-review-root'}));createRoot(document.getElementById('payout-review-root')).render(<Shell/>)}
