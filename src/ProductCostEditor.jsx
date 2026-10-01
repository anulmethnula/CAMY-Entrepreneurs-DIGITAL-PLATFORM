import { productCosts } from './productCosts'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`

export function ProductCostEditor({ product, onChange }) {
  const costs = productCosts(product)
  const update = (key, value) => {
    const next = { ...product, ...costs, [key]: value }
    onChange({ ...next, price: productCosts(next).price })
  }
  return <section className="product-cost-editor">
    <header><small>ADMIN COST BREAKDOWN</small><h3>Build the product price</h3></header>
    <div className="cost-inputs">
      {[['billingPrice', 'Billing price'], ['deliveryCost', 'Delivery cost'], ['packagingCost', 'Packaging cost']].map(([key, label]) =>
        <label key={key}>{label}<input required type="number" min="0" step="0.01" value={product[key] ?? costs[key]} onChange={event => update(key, event.target.value)} /></label>
      )}
    </div>
    <label>Delivery shown to reseller<select value={costs.freeDelivery ? 'free' : 'included'} onChange={event => update('freeDelivery', event.target.value === 'free')}><option value="free">Free delivery</option><option value="included">Delivery included in total</option></select></label>
    <div className="cost-total"><span><strong>Total product cost</strong><small>Billing + delivery + packaging · Resellers see this total only</small></span><output>{money(costs.price)}</output></div>
  </section>
}
