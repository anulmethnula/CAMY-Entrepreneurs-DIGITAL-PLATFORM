import { useEffect, useState } from 'react'
import { ChevronDown, ListFilter } from 'lucide-react'
import { createRoot } from 'react-dom/client'

const filterSelector = [
  '.catalog-controls',
  '.table-toolbar',
  '.management-filters',
  '.application-filters',
  '.overview-filters',
  '.credit-filters',
  '.order-filter-shell',
  '.orders-date-export',
  '.money-history-filter',
  '.money-list-tools',
  '.commission-filter-panel',
  '.commission-workspace-tools',
  '.credit-stock-admin-filters',
  '.credit-catalogue-tools',
  '.inventory-tools',
  '.admin-feedback-filters',
  '.account-order-filters',
  '.shop-search-row',
  '.shop-product-filters',
  '.customer-shop-filters',
  '.customer-product-tools',
  '.public-filters',
  '[aria-label="Filter credit orders"]'
].join(',')

const labelFor = panel => {
  if (panel.matches('.catalog-controls,.credit-catalogue-tools,.shop-product-filters,.customer-product-tools,.public-filters')) return 'Filter products'
  if (panel.matches('.inventory-tools')) return 'Search and filter products'
  if (panel.matches('.shop-search-row,.customer-shop-filters')) return 'Find a shop'
  if (panel.matches('.admin-feedback-filters')) return 'Filter feedback'
  if (panel.matches('.application-filters')) return 'Filter applications'
  if (panel.matches('[aria-label="Filter credit orders"]')) return 'Filter credit orders'
  if (panel.matches('.commission-filter-panel,.commission-workspace-tools,.money-history-filter,.money-list-tools,.credit-filters')) return 'Filter payments'
  return 'Filter records'
}

function Toggle({ panel }) {
  const [open,setOpen]=useState(false)
  const toggle = () => {
    setOpen(value=>{
      panel.classList.toggle('mobile-filter-open',!value)
      return !value
    })
  }
  return <button type="button" className="mobile-filter-toggle" aria-expanded={open} onClick={toggle}>
    <span><ListFilter/><span><small>FILTERS &amp; SEARCH</small><strong>{labelFor(panel)}</strong></span></span>
    <span>{open?'Close':'Open'} <ChevronDown className={open?'rotated':''}/></span>
  </button>
}

export default function MobileFilterEnhancer() {
  useEffect(() => {
    const roots = new Map()
    const enhance = () => {
      roots.forEach(({ root, mount }, panel) => {
        if (panel.isConnected) return
        root.unmount()
        mount.remove()
        roots.delete(panel)
      })
      document.querySelectorAll(filterSelector).forEach(panel => {
        if (panel.matches('.credit-request-filter-panel') || panel.dataset.mobileFilterReady) return
        const parentFilter = panel.parentElement?.closest(filterSelector)
        if (parentFilter) return
        panel.dataset.mobileFilterReady = 'true'
        panel.classList.add('mobile-collapsible-filter')
        const mount = document.createElement('div')
        mount.className = 'mobile-filter-toggle-mount'
        panel.before(mount)
        const root = createRoot(mount)
        root.render(<Toggle panel={panel}/>)
        roots.set(panel, { root, mount })
      })
    }
    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.getElementById('root'), { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      roots.forEach(({ root, mount }, panel) => {
        root.unmount()
        mount.remove()
        panel.classList.remove('mobile-collapsible-filter','mobile-filter-open')
        delete panel.dataset.mobileFilterReady
      })
    }
  }, [])
  return null
}
