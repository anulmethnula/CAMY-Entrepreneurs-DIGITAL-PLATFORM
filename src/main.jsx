import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './shop.css'

class AppBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="auth-loading"><strong>This page could not open</strong><p>Your saved records remain in the database. Reload to reopen CAMY.</p><button className="btn" onClick={() => window.location.reload()}>Reload CAMY</button></div>
    return this.props.children
  }
}

if (window.location.pathname === '/shops' || window.location.pathname.startsWith('/customer')) {
  window.history.replaceState({}, '', '/')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppBoundary><App /></AppBoundary>
  </React.StrictMode>,
)
