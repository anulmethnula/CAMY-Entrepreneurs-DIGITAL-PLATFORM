import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

let openDialogs = 0
let originalOverflow = ''

export function PortalOverlay({ children, className, onClose, label = 'Details' }) {
  const container = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement
    if (openDialogs++ === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const controls = () => [...container.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); return }
      if (event.key !== 'Tab') return
      const elements = controls(), first = elements[0], last = elements.at(-1)
      if (!first) { event.preventDefault(); container.current.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !container.current.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !container.current.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    ;(controls()[0] || container.current).focus()
    document.addEventListener('keydown', keyboard)
    return () => {
      if (--openDialogs === 0) document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', keyboard)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return createPortal(<div className={className} ref={container} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>{children}</div>, document.body)
}
