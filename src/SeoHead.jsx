import { useEffect } from 'react'

const SITE_URL = String(import.meta.env.VITE_PUBLIC_URL || 'https://camymarket.com').replace(/\/+$/, '')

const setMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
}

const setLink = (rel, href) => {
  let element = document.head.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.appendChild(element)
  }
  element.href = href
}

export default function SeoHead() {
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    const isRegistration = path === '/register'
    const title = isRegistration
      ? 'CAMY Market | Become a CAMY Entrepreneur in Sri Lanka'
      : 'CAMY Market | Entrepreneur Platform Sri Lanka'
    const description = isRegistration
      ? 'Apply online to become a CAMY entrepreneur in Sri Lanka. Build your business with CAMY products, order fulfilment, commissions, business credit and practical support.'
      : 'CAMY Market is the official CAMY entrepreneur platform in Sri Lanka. Apply online, manage customer orders, track deliveries and grow your business.'
    const canonical = `${SITE_URL}${isRegistration ? '/register' : '/'}`
    const image = `${SITE_URL}/camy-logo-tight.png`

    document.title = title
    document.documentElement.lang = 'en-LK'
    setMeta('meta[name="description"]', { name: 'description', content: description })
    setMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' })
    setMeta('meta[name="googlebot"]', { name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' })
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
    setMeta('meta[name="application-name"]', { name: 'application-name', content: 'CAMY Market' })
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'CAMY Market' })
    setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'en_LK' })
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    setMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'CAMY Entrepreneurs Sri Lanka' })
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    setLink('canonical', canonical)

    document.querySelectorAll('script[data-camy-seo]').forEach(element => element.remove())
    if (isRegistration) {
      const graph = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${SITE_URL}/#organization`,
            name: 'CAMY Entrepreneurs',
            alternateName: ['CAMY Market', 'camymarket'],
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: image, width: 430, height: 205 },
            telephone: '+94-77-716-5336',
            areaServed: { '@type': 'Country', name: 'Sri Lanka' },
          },
          {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            url: SITE_URL,
            name: 'CAMY Market',
            alternateName: 'CAMY Entrepreneurs',
            publisher: { '@id': `${SITE_URL}/#organization` },
            inLanguage: 'en-LK',
          },
          {
            '@type': 'WebPage',
            '@id': `${canonical}#webpage`,
            url: canonical,
            name: title,
            description,
            isPartOf: { '@id': `${SITE_URL}/#website` },
            about: { '@id': `${SITE_URL}/#organization` },
            inLanguage: 'en-LK',
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: 'Who can apply to become a CAMY entrepreneur?', acceptedAnswer: { '@type': 'Answer', text: 'Adults in Sri Lanka who want to build a product-selling business can submit the online application for CAMY review.' } },
              { '@type': 'Question', name: 'Does submitting an application give immediate account access?', acceptedAnswer: { '@type': 'Answer', text: 'No. CAMY reviews every entrepreneur application before activating access to the secure business platform.' } },
              { '@type': 'Question', name: 'What information is needed for the application?', acceptedAnswer: { '@type': 'Answer', text: 'Applicants provide contact and address details, selling experience, their main business goal, and clear front and back images of their NIC.' } },
            ],
          },
        ],
      }
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.camySeo = 'true'
      script.textContent = JSON.stringify(graph)
      document.head.appendChild(script)
    }
  }, [])

  return null
}
