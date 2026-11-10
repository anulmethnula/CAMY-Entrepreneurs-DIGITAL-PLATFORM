const communityUrl = 'https://chat.whatsapp.com/JH4pur7k4QN3YbWFv7GZY3'

export function WhatsAppIcon({ className = '' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.6a8.5 8.5 0 1 1 16.1-4.2Z"/><path d="m8.2 7.2 1.4-.2 1.1 2.6-1.1 1.1a10 10 0 0 0 3.6 3.6l1.1-1.1 2.6 1.1-.2 1.4c-.1.8-1 1.3-1.8 1.2-4.1-.7-7.4-4-8.1-8.1-.1-.8.4-1.5 1.4-1.6Z"/></svg>
}

export function WhatsAppCommunity({ compact = false }) {
  return <section className={`camy-community ${compact ? 'camy-community-profile' : 'camy-community-banner'}`} aria-label="WhatsApp Community">
    <span className="camy-community-icon"><WhatsAppIcon/></span>
    <div className="camy-community-copy"><h3>{compact ? 'Join our WhatsApp Community' : 'Join the CAMY WhatsApp Community'}</h3><p>{compact ? 'Get CAMY updates, support, announcements and connect with other entrepreneurs.' : 'Get important updates, announcements, support and connect with other CAMY entrepreneurs.'}</p></div>
    <button type="button" className="btn secondary camy-community-join" onClick={() => window.open(communityUrl, '_blank', 'noopener,noreferrer')}><WhatsAppIcon/> Join Community</button>
  </section>
}
