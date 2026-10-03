import { useState } from 'react'

const consentKey = 'camy-cookie-consent-v1'

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(consentKey) } catch { return true }
  })

  const choose = value => {
    try { localStorage.setItem(consentKey, value) } catch { /* The banner can still be dismissed for this page. */ }
    setVisible(false)
  }

  if (!visible) return null
  return <aside className="cookie-consent" role="dialog" aria-label="Cookie choices" aria-live="polite">
    <div><strong>Cookies on CAMY</strong><p>CAMY uses essential secure cookies to keep admin, entrepreneur, and customer accounts signed in. We do not use advertising or tracking cookies.</p></div>
    <div className="cookie-consent-actions"><button type="button" className="cookie-secondary" onClick={() => choose('necessary')}>Necessary only</button><button type="button" className="cookie-primary" onClick={() => choose('accepted')}>Allow cookies</button></div>
  </aside>
}
