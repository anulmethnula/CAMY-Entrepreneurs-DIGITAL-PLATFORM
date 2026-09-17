import { useState } from 'react'
import { api } from './api'

export function productMedia(product) {
  const media = Array.isArray(product.media) ? product.media : []
  return product.image && !media.some(item => item.src === product.image) ? [{ type: 'image', src: product.image, name: 'Main image' }, ...media] : media
}

export function ProductMediaEditor({ product, onChange, onBusyChange = () => {} }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const media = productMedia(product)
  const upload = async event => {
    const files = Array.from(event.target.files || []); event.target.value = ''
    if (!files.length || busy) return
    if (media.length + files.length > 12) return setError('Use up to 12 images and videos per product.')
    if (files.some(file => !['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type) || file.size > 10 * 1024 * 1024)) return setError('Choose JPG, PNG, WebP, MP4 or WebM files up to 10 MB each.')
    setBusy(true); onBusyChange(true); setError('')
    let next = [...media]
    try {
      for (const file of files) {
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read file.')); reader.readAsDataURL(file) })
        const result = await api('/admin/product-media', { method: 'POST', body: JSON.stringify({ data, name: file.name }) })
        next = [...next, result.media]; onChange({ media: next, image: product.image || next.find(item => item.type === 'image')?.src || '' })
      }
    } catch (failure) { setError(failure.message) } finally { setBusy(false); onBusyChange(false) }
  }
  return <section className="product-media-editor"><h3>Product images &amp; videos</h3><p>Add up to 12 files. JPG, PNG, WebP, MP4 or WebM, up to 10 MB each.</p><label className="product-media-upload">{busy ? 'Uploading media...' : 'Add images or videos'}<input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy} onChange={upload}/></label><div className="product-media-grid">{media.map((item, index) => <div key={item.src}>{item.type === 'video' ? <video src={item.src} controls preload="metadata"/> : <img src={item.src} alt={item.name || `Image ${index + 1}`}/>}<small>{item.name || `Media ${index + 1}`}</small><div>{item.type === 'image' && <button type="button" disabled={busy} onClick={() => onChange({ media, image: item.src })}>{product.image === item.src ? 'Main image' : 'Set as main'}</button>}<button type="button" disabled={busy} onClick={() => { const next = media.filter((_, i) => i !== index); onChange({ media: next, image: product.image === item.src ? next.find(entry => entry.type === 'image')?.src || '' : product.image }) }}>Remove</button></div></div>)}</div>{busy && <p role="status">Wait for uploads to finish before saving.</p>}{error && <p role="alert">{error}</p>}</section>
}

export function ProductMediaGallery({ product }) {
  const media = productMedia(product)
  const [selected, setSelected] = useState(0)
  const current = media[selected] || media[0]
  if (!current) return null
  return <div className="product-media-gallery"><div className="product-media-main">{current.type === 'video' ? <video key={current.src} src={current.src} controls playsInline preload="metadata"/> : <img src={current.src} alt={product.name}/>}</div>{media.length > 1 && <div className="product-media-thumbs">{media.map((item, index) => <button type="button" key={item.src} aria-label={`View ${item.type} ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.type === 'video' ? <span>▶ Video {index + 1}</span> : <img src={item.src} alt=""/>}</button>)}</div>}</div>
}
