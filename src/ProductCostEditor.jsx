import { fullProductCost, productCosts } from './productCosts'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function ProductCostEditor({ product, onChange }) {
  const costs = productCosts(product)
  const fullTotal = fullProductCost(costs)
  const update = (key, value) => {
    const next = { ...product, ...costs, [key]: value }
    onChange({ ...next, price: productCosts(next).price })
  }
  return <section className="product-cost-editor">
    <header><small>ADMIN COST BREAKDOWN</small><h3>Build the product price</h3></header>
    <div className="cost-inputs">
      {[['billingPrice', 'Billing price'], ['deliveryCost', 'Delivery cost'], ['packagingCost', 'Packaging cost']].map(([key, label]) =>
        <label key={key}>{label}<input required type="number" min="0" step="0.01" value={product[key] ?? costs[key]} onChange={event => update(key, event.target.value)} onBlur={() => window.dispatchEvent(new Event('camy-product-cost-commit'))} /></label>
      )}
    </div>
    <div className="delivery-display-setting">
      <label className="delivery-check"><input type="checkbox" checked={costs.freeDelivery} onChange={event => { update('freeDelivery', event.target.checked); window.setTimeout(() => window.dispatchEvent(new Event('camy-product-cost-commit')), 0) }} /><span aria-hidden="true">✓</span><div><strong>Free delivery</strong><small>Tick this when the reseller should see delivery as free.</small></div></label>
      <div className={`delivery-charge-preview ${costs.freeDelivery ? 'is-free' : ''}`}><small>Delivery shown to reseller</small><strong>{costs.freeDelivery ? 'Free delivery' : `Delivery charge: ${money(costs.deliveryCost)}`}</strong></div>
    </div>
    <div className="cost-total"><span><strong>Full total</strong><small>Billing + packaging + delivery</small></span><output>{money(fullTotal)}</output></div>
  </section>
}
