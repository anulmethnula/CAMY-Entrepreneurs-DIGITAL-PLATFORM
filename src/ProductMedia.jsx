import { zip } from './reports'
import { PortalOverlay } from './Dialog'
import { Download, ZoomIn, ZoomOut, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
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

const safeName=value=>String(value||'CAMY-product').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,90)
async function originalImage(product,item){
  if(!productMedia(product).some(m=>m.type!=='video'&&m.src===item.src))throw new Error('This image is not attached to the product.')
  const url=new URL(item.src,window.location.origin)
  const inline=/^data:image\/(?:png|jpeg|webp);base64,/i.test(item.src)
  if(!inline&&(url.origin!==window.location.origin||!/^\/(?:products\/|api\/product-media\/)/.test(url.pathname)))throw new Error('Original download is unavailable for this media address. Contact CAMY.')
  const response=await fetch(item.src,{credentials:'same-origin',redirect:'error'})
  if(!response.ok)throw new Error('The original image could not be downloaded.')
  const blob=await response.blob(),types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}
  const extension=types[blob.type.split(';')[0]]
  if(!extension)throw new Error('The server did not return a supported original image.')
  return {blob,extension}
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
export async function downloadProductImage(product,item=productMedia(product).find(m=>m.type!=='video')){
 if(!item)throw new Error('No product image is available.')
 const {blob,extension}=await originalImage(product,item);saveBlob(blob,`${safeName(product.code||product.id)}-01.${extension}`)
}
export function ProductMediaGallery({ product, promotional=false }) {
 const media=productMedia(product),images=media.filter(m=>m.type!=='video')
 const [selected,setSelected]=useState(0),[zoomIndex,setZoomIndex]=useState(null),[scale,setScale]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const current=media[selected]||media[0],zoomed=zoomIndex==null?null:images[zoomIndex]
 useEffect(()=>{setSelected(0);setZoomIndex(null);setScale(1);setError('')},[product.id])
 const move=direction=>{setZoomIndex(i=>(i+direction+images.length)%images.length);setScale(1)}
 useEffect(()=>{if(zoomIndex==null)return;const key=e=>{if(e.key==='ArrowRight'){e.preventDefault();move(1)}if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[zoomIndex,images.length])
 const download=async(all=false,item=current)=>{if(busy)return;setBusy(true);setError('');try{
  if(all){const files={};for(const [i,image] of images.entries()){const {blob,extension}=await originalImage(product,image);files[`${safeName(product.code||product.id)}-${String(i+1).padStart(2,'0')}.${extension}`]=new Uint8Array(await blob.arrayBuffer())}saveBlob(new Blob([zip(files)],{type:'application/zip'}),`${safeName(product.code||product.id)}-${safeName(product.name)}-images.zip`)}
  else await downloadProductImage(product,item)
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 if(!current)return <p>No product media is available.</p>
 return <div className="product-media-gallery erp-media-gallery"><div className="product-media-main">{current.type==='video'?<video key={current.src} src={current.src} controls playsInline preload="metadata"/>:<button className="erp-image-open" onClick={()=>{setZoomIndex(images.findIndex(m=>m.src===current.src));setScale(1)}} aria-label="Zoom product image"><img loading="lazy" src={current.src} alt={product.name}/><span><ZoomIn size={16}/> View full image</span></button>}</div>{media.length>1&&<div className="product-media-thumbs">{media.map((item,index)=><button type="button" key={item.src} aria-label={`View ${item.type} ${index+1}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{item.type==='video'?<span>Video {index+1}</span>:<img loading="lazy" src={item.src} alt=""/>}</button>)}</div>}
 {promotional&&<section className="erp-media-download"><h3>Product Media</h3><p>Use CAMY product images for your customer promotions.</p><button disabled={busy||current.type==='video'} onClick={()=>download()}><Download size={16}/> Download Selected Image</button><button disabled={busy||!images.length} onClick={()=>download(true)}>{busy?'Preparing original files...':'Download All Images'}</button></section>}
 {error&&<p role="alert" className="market-error">{error}</p>}
 {zoomed&&<PortalOverlay className="erp-lightbox" label="Product image zoom" onClose={()=>setZoomIndex(null)}><header><strong>{product.name}</strong><div><button aria-label="Zoom in" onClick={()=>setScale(s=>Math.min(4,s+.25))}><ZoomIn/></button><button aria-label="Zoom out" onClick={()=>setScale(s=>Math.max(.5,s-.25))}><ZoomOut/></button><button aria-label="Reset zoom" onClick={()=>setScale(1)}><RotateCcw/></button><button disabled={busy} onClick={()=>download(false,zoomed)}><Download/> Download Original</button><button aria-label="Close image" onClick={()=>setZoomIndex(null)}><X/></button></div></header><div className="erp-lightbox-image"><img src={zoomed.src} alt={product.name} style={{width:`${scale*100}%`,height:`${scale*100}%`}}/></div><footer><button disabled={images.length<2} onClick={()=>move(-1)}><ChevronLeft/> Previous image</button><span>{zoomIndex+1} / {images.length} | {Math.round(scale*100)}%</span><button disabled={images.length<2} onClick={()=>move(1)}>Next image <ChevronRight/></button></footer>{error&&<p role="alert">{error}</p>}</PortalOverlay>}
 </div>
}
