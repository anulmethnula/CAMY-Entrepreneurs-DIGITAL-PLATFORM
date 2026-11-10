import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { PortalOverlay } from './Dialog'

export function ReceiptPreview({ href, name = 'Bank receipt', className = '', allowLargeFile = false, inline = false }) {
  const documentLabel = name.toLowerCase().includes('invoice') ? 'Invoice document' : 'Bank receipt'
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    let active = true, objectUrl
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    setFile(null); setError('')
    fetch(href, { credentials: 'same-origin', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`${documentLabel} could not be opened. Refresh your order or sign in again.`)
      const blob = await response.blob()
      if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(blob.type) || (!allowLargeFile && blob.size > 5 * 1024 * 1024)) throw new Error('This document cannot be previewed.')
      if (!active) return
      objectUrl = URL.createObjectURL(blob); setFile({ url: objectUrl, type: blob.type })
    }).catch(failure => { if (active) setError(failure.name === 'AbortError' ? 'Opening the receipt took too long. Please try again.' : failure.message) }).finally(() => clearTimeout(timeout))
    return () => { active = false; clearTimeout(timeout); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [open, href, documentLabel, allowLargeFile])
  const Frame = inline ? 'div' : PortalOverlay
  return <><button type="button" className={`receipt-view-button ${className}`} onClick={() => setOpen(true)}>{name}</button>{open && <Frame className={inline ? 'receipt-preview-inline' : 'receipt-preview-overlay'} {...(inline ? {} : { label: `${documentLabel} preview`, onClose: () => setOpen(false) })}><section className="receipt-preview-dialog"><header><h2>{documentLabel}</h2><button type="button" aria-label="Close receipt preview" onClick={() => setOpen(false)}><X/></button></header>{error ? <p role="alert">{error}</p> : !file ? <p role="status">Opening receipt…</p> : <div className="receipt-preview-content">{file.type === 'application/pdf' ? <iframe src={file.url} title={`${documentLabel} PDF`}/> : <img src={file.url} alt={`Uploaded ${documentLabel.toLowerCase()}`}/>}</div>}<footer>{inline ? <a href={`${href}${href.includes('?')?'&':'?'}download=1`}>Download receipt</a> : <a href={href} target="_blank" rel="noreferrer">Open in a new tab</a>}<button type="button" onClick={() => setOpen(false)}>Close</button></footer></section></Frame>}</>
}
