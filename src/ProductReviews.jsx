import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { api } from './api'

export function Stars({ rating = 0, onChange }) {
  return <span className="review-stars" aria-label={`${rating} out of 5 stars`}>{[1,2,3,4,5].map(value => onChange ? <button key={value} type="button" aria-label={`Rate ${value} stars`} aria-pressed={rating === value} onClick={() => onChange(value)}><Star size={22} fill={value <= rating ? 'currentColor' : 'none'}/></button> : <Star key={value} size={15} fill={value <= Math.round(rating) ? 'currentColor' : 'none'}/>)}</span>
}
export function ProductReviews({ productId, shopId, preview }) {
  const [reviews, setReviews] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true); setReviews([]); setError('')
    if (preview) { setLoading(false); return }
    api(`/marketplace/reviews?productId=${encodeURIComponent(productId)}&shopId=${encodeURIComponent(shopId)}`).then(result => { if (active) setReviews(result.reviews) }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [productId, shopId, preview])
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
  return <section className="product-reviews"><h3>Customer ratings & feedback</h3>{reviews.length > 0 && <div className="review-average"><strong>{average.toFixed(1)}</strong><Stars rating={average}/><span>{reviews.length} verified reviews</span></div>}{error && <p role="alert">{error}</p>}{loading ? <p>Loading feedback…</p> : !reviews.length && <p>No published reviews yet. Delivered buyers can leave feedback in My orders.</p>}{reviews.map(review => <article key={review.id}><header><strong>{review.name}</strong><Stars rating={review.rating}/></header><p>{review.comment}</p>{review.admin_reply && <blockquote><strong>CAMY response</strong><p>{review.admin_reply}</p></blockquote>}</article>)}</section>
}
export function ProductReviewForm({ orderId, product, existing, onDone }) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(existing?.rating || 5)
  const [comment, setComment] = useState(existing?.comment || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setRating(existing?.rating || 5); setComment(existing?.comment || '') }, [existing?.id, existing?.updated_at])
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { await api('/customer/reviews', { method: 'POST', body: JSON.stringify({ orderId, productId: product.id || product.productId, rating, comment }) }); await onDone?.(); setEditing(false) }
    catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <section className="purchase-review"><div><strong>{product.name}</strong>{existing && <span className="review-state">{existing.status}</span>}<button type="button" className="shop-secondary" onClick={() => setEditing(old => !old)}>{existing ? 'Edit feedback' : 'Rate & review'}</button></div>{existing && !editing && <><Stars rating={existing.rating}/><p>{existing.comment}</p>{existing.admin_reply && <p className="review-admin-reply"><b>CAMY response:</b> {existing.admin_reply}</p>}</>}{editing && <form onSubmit={submit}><Stars rating={rating} onChange={setRating}/><label>Your feedback<textarea required minLength={3} maxLength={2000} rows={3} value={comment} disabled={busy} onChange={event => setComment(event.target.value)} placeholder="How was the product? Share your experience."/></label><small>Feedback is checked by CAMY before it appears publicly. Editing sends it for review again.</small>{error && <p role="alert" className="shop-alert">{error}</p>}<button className="shop-primary" disabled={busy}>{busy ? 'Saving…' : 'Submit feedback'}</button></form>}</section>
}
