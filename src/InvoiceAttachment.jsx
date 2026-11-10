import { useEffect, useRef, useState } from 'react'
import { Camera, Check, FileText, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { PortalOverlay } from './Dialog'

export const invoiceFileTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const cameraUnavailable = kind => `Camera access is unavailable. Please upload the ${kind} instead.`

function usePreview(file) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setUrl(''); return }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

function InvoiceCamera({ onAccept, onClose, kind = 'invoice', inline = false }) {
  const video = useRef(null)
  const stream = useRef(null)
  const mounted = useRef(false)
  const [photo, setPhoto] = useState(null)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  const preview = usePreview(photo)
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }
  useEffect(() => {
    let active = true
    mounted.current = true
    if (!navigator.mediaDevices?.getUserMedia) setError(cameraUnavailable(kind))
    else navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(next => {
      if (!active) { next.getTracks().forEach(track => track.stop()); return }
      stream.current = next
      if (video.current) { video.current.srcObject = next; video.current.play().catch(() => { if (active) { stop(); setError(cameraUnavailable(kind)) } }) }
    }).catch(() => { if (active) setError(cameraUnavailable(kind)) })
    return () => { active = false; mounted.current = false; stop(); if (video.current) video.current.srcObject = null }
  }, [])
  const close = () => { stop(); onClose() }
  const capture = async () => {
    const source = video.current
    if (!source?.videoWidth || !source?.videoHeight || capturing) return
    setCapturing(true); setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = source.videoWidth; canvas.height = source.videoHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error(`Could not capture the photo. Please try again or upload the ${kind}.`)
      context.drawImage(source, 0, 0)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95))
      if (!blob) throw new Error(`Could not capture the photo. Please try again or upload the ${kind}.`)
      if (mounted.current) setPhoto(new File([blob], `${kind}-photo.jpg`, { type: 'image/jpeg' }))
    } catch (failure) { if (mounted.current) setError(failure.message) }
    finally { if (mounted.current) setCapturing(false) }
  }
  const Frame = inline ? 'div' : PortalOverlay
  return <Frame className={inline ? 'camy-invoice-inline-camera' : 'camy-invoice-camera-layer'} {...(inline ? {} : { label: `${kind === 'receipt' ? 'Receipt' : 'Invoice'} camera`, onClose: close })}><section className="camy-invoice-camera"><header><div><h2>{photo ? `Review ${kind} photo` : `Photograph ${kind}`}</h2><p>{photo ? 'Use this photo or retake it before attaching.' : `Keep the complete ${kind} in view and make sure the text is readable.`}</p></div><button type="button" onClick={close} aria-label={`Close ${kind} camera`}><X/></button></header>
    {!error && !ready && <p role="status">Requesting camera access...</p>}
    <video ref={video} autoPlay muted playsInline hidden={Boolean(photo) || Boolean(error)} onLoadedMetadata={() => setReady(Boolean(video.current?.videoWidth))}/>
    {photo && preview && <img className="camy-invoice-captured" src={preview} alt={`Captured ${kind} for review`}/>}
    {error && <p className="market-error" role="alert">{error}</p>}
    <footer>{photo ? <><button type="button" className="btn secondary" onClick={() => { setPhoto(null); setError('') }}><RotateCcw/> Retake</button><button type="button" className="btn primary" onClick={() => { stop(); onAccept(photo); onClose() }}><Check/> Use photo</button></> : <><button type="button" className="btn secondary" onClick={close}>{error ? kind === 'receipt' ? 'Close and upload receipt' : 'Close and upload document' : 'Cancel'}</button><button type="button" className="btn primary" disabled={!ready || capturing || Boolean(error)} onClick={capture}><Camera/>{capturing ? 'Capturing...' : 'Capture photo'}</button></>}</footer>
  </section></Frame>
}

export function InvoiceAttachment({ file, onChange, disabled = false, kind = 'invoice', inlineCamera = false }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [fromCamera, setFromCamera] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)
  const preview = usePreview(file)
  const choose = (next, captured = false) => {
    if (!next) return
    if (!invoiceFileTypes.includes(next.type)) { setError(`Use a JPG, JPEG, PNG, WebP or PDF ${kind}.`); return }
    setError(''); setFromCamera(captured); onChange(next)
  }
  return <div className={`invoice-file-field camy-invoice-attachment ${file ? 'selected' : ''}`}>
    <span>{kind === 'receipt' ? 'Payment proof' : <>Invoice document <em>Optional</em></>}</span>
    <div className="camy-invoice-methods"><label className={`camy-invoice-upload ${disabled ? 'disabled' : ''}`}><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={disabled} onChange={event => { choose(event.target.files?.[0]); event.target.value = '' }}/><Upload/><span><strong>{file ? kind === 'receipt' ? 'Replace' : 'Replace document' : kind === 'receipt' ? 'Upload receipt' : 'Upload document'}</strong><small>JPG, JPEG, PNG, WebP or PDF</small></span></label><button type="button" className="camy-invoice-camera-button" disabled={disabled} onClick={() => { setError(''); setCameraOpen(true) }}><Camera/> Use camera</button></div>
    {file && <div className="camy-invoice-file-preview">{preview ? <img src={preview} alt={`Selected ${kind} preview`}/> : <FileText/>}<div><strong>{file.name}</strong><small>{file.type === 'application/pdf' ? 'PDF document' : 'Image attached for review'}</small></div><button type="button" disabled={disabled} aria-label={`Remove ${kind} attachment`} onClick={() => { onChange(null); setError(''); if (input.current) input.current.value = '' }}><Trash2/> Remove</button></div>}
    {error && <p className="market-error" role="alert">{error}</p>}
    {kind === 'receipt' && file && fromCamera && <button type="button" className="camy-receipt-retake" disabled={disabled} onClick={() => setCameraOpen(true)}><RotateCcw/> Retake</button>}
    {cameraOpen && <InvoiceCamera inline={inlineCamera} kind={kind} onClose={() => setCameraOpen(false)} onAccept={next => choose(next, true)}/>}
  </div>
}
