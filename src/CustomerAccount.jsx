import { useState } from 'react'
import { api } from './api'
import { PortalOverlay } from './Dialog'
import { CustomerPassword } from './CustomerPassword'

export function CustomerAccount({ account, details, districts, onAccount, onClose }) {
  const [draft, setDraft] = useState({ ...details })
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await api(`/customer/${account ? 'profile' : mode}`, { method: 'POST', body: JSON.stringify({ ...draft, email, password }) })
      onAccount(result.customer); onClose()
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <PortalOverlay className="customer-account-overlay" onClose={onClose} label="Customer account"><section className="customer-account-card"><button className="market-close" onClick={onClose} aria-label="Close account">×</button><h2>{account ? 'Saved delivery details' : mode === 'login' ? 'Customer sign in' : 'Create your customer account'}</h2><p>Save your address and mobile number, see shop approvals, and follow your orders and payments.</p><form className="customer-delivery" onSubmit={submit}>
    {!account && <><label>Email<input type="email" required maxLength={190} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></label><label>Password<input type="password" required minLength={mode === 'register' ? 8 : undefined} maxLength={1024} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)}/></label>{mode === 'register' && <small>Use at least 8 characters with letters and numbers.</small>}</>}
    {(account || mode === 'register') && <>{[['name', 'Full name', 'name'], ['phone', 'Mobile number', 'tel']].map(([key, label, autoComplete]) => <label key={key}>{label}<input required autoComplete={autoComplete} maxLength={key === 'name' ? 150 : 30} value={draft[key]} onChange={event => setDraft(old => ({ ...old, [key]: event.target.value }))}/></label>)}<label>Delivery district<select required value={draft.district} onChange={event => setDraft(old => ({ ...old, district: event.target.value }))}><option value="">Choose district</option>{districts.map(district => <option key={district}>{district}</option>)}</select></label><label>Delivery address<textarea required minLength={8} maxLength={2000} autoComplete="street-address" value={draft.address} onChange={event => setDraft(old => ({ ...old, address: event.target.value }))}/></label></>}
    {error && <p className="customer-form-error" role="alert">{error}</p>}<button className="customer-place-order" disabled={busy}>{busy ? 'Please wait…' : account ? 'Save details' : mode === 'login' ? 'Sign in' : 'Register'}</button>
  </form>{account && <CustomerPassword/>}{!account && <div className="customer-auth-footer"><span>{mode === 'login' ? 'New to CAMY?' : 'Already have an account?'}</span><button type="button" className="customer-auth-switch" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button></div>}</section></PortalOverlay>
}
