import { useEffect, useState } from 'react'
import { MessageSquare, Search, Star } from 'lucide-react'
import { api } from './api'
import { Stars } from './ProductReviews'

function ReviewModeration({ review, reload }) {
  const [reply,setReply]=useState(review.admin_reply || '')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const save=async status=>{setBusy(true);setError('');try{await api('/admin/customer-reviews',{method:'POST',body:JSON.stringify({id:review.id,status,reply})});await reload()}catch(error){setError(error.message)}finally{setBusy(false)}}
  return <article className="admin-feedback-card"><header><div><strong>{review.product_name}</strong><small>{review.shop_id} · Order {review.order_id}</small></div><span className="review-state">{review.status}</span></header><Stars rating={review.rating}/><p>{review.comment}</p><small>{review.customer_name} · {review.customer_email} · {review.updated_at}</small><label>CAMY reply<textarea maxLength={2000} value={reply} disabled={busy} onChange={event=>setReply(event.target.value)} placeholder="Reply to this customer's feedback"/></label><footer><button disabled={busy} onClick={()=>save('Published')}>Publish & save reply</button><button disabled={busy} onClick={()=>save('Hidden')}>Hide</button><button disabled={busy} onClick={()=>save('Pending')}>Keep pending</button></footer>{error && <p role="alert">{error}</p>}</article>
}
export function AdminCustomerReviews() {
  const [reviews,setReviews]=useState([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [status,setStatus]=useState('All')
  const [search,setSearch]=useState('')
  const reload=async()=>{try{const result=await api('/admin/customer-reviews');setReviews(result.reviews);setError('')}catch(error){setError(error.message)}finally{setLoading(false)}}
  useEffect(()=>{reload()},[])
  const visible=reviews.filter(review=>(status==='All'||review.status===status)&&`${review.product_name} ${review.customer_name} ${review.shop_id} ${review.order_id} ${review.comment}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="content-page admin-feedback"><header><span>VERIFIED CUSTOMER FEEDBACK</span><h1>Product ratings & comments</h1><p>Review delivered buyers’ feedback, publish genuine reviews and respond as CAMY.</p></header><div className="admin-feedback-metrics"><span><MessageSquare/> {reviews.filter(review=>review.status==='Pending').length} pending</span><span><Star/> {reviews.filter(review=>review.status==='Published').length} published</span><button onClick={reload}>Refresh feedback</button></div><div className="admin-feedback-filters"><label><Search size={18}/><input aria-label="Search customer feedback" placeholder="Search product, customer, order or comment" value={search} onChange={event=>setSearch(event.target.value)}/></label><select aria-label="Filter feedback status" value={status} onChange={event=>setStatus(event.target.value)}>{['All','Pending','Published','Hidden'].map(item=><option key={item}>{item}</option>)}</select></div>{error && <p role="alert">{error}</p>}{loading && <p>Loading feedback…</p>}{!loading && !visible.length && <div className="shop-empty"><MessageSquare/><h2>No matching feedback</h2><p>Customer feedback appears here after delivered buyers submit a review.</p></div>}{visible.map(review=><ReviewModeration key={`${review.id}-${review.updated_at}-${review.status}`} review={review} reload={reload}/>)}</div>
}
