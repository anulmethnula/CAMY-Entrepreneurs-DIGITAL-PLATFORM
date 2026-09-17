import { useState } from 'react'
import { api } from './api'

export function CustomerPassword() {
  const [currentPassword,setCurrentPassword]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const submit=async event=>{event.preventDefault();if(busy)return;setMessage('');setError('');if(newPassword!==confirm)return setError('The new passwords do not match.');setBusy(true);try{await api('/customer/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});setMessage('Password updated. Other sessions have been signed out.');setCurrentPassword('');setNewPassword('');setConfirm('')}catch(error){setError(error.message)}finally{setBusy(false)}}
  return <details className="customer-password"><summary>Change password</summary><form className="customer-delivery" onSubmit={submit}><label>Current password<input type="password" required maxLength={1024} autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label><label>New password<input type="password" required minLength={8} maxLength={1024} autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></label><label>Confirm new password<input type="password" required minLength={8} maxLength={1024} autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)}/></label><small>At least 8 characters with letters and numbers.</small>{error && <p className="customer-form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}<button className="customer-place-order" disabled={busy}>{busy?'Updating…':'Update password'}</button></form></details>
}
