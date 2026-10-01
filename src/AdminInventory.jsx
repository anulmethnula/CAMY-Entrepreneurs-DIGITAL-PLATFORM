import { PackageOpen, Pencil, Plus, Search, Download, Eye, EyeOff, Minus, Settings, Grid2X2 } from 'lucide-react'
import { productCosts, deliveryLabel } from './productCosts'
import './inventory.css'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`

export function AdminInventory({ products, visible, categories, search, setSearch, openAdd, openAddCategory, openProduct, stock, togglePublished, manageCategory, exportProducts }) {
  const filtered = visible.filter(product => categories.includes(product.category))
  const units = products.reduce((total, product) => total + Number(product.stock || 0), 0)
  return <div className="inventory-workspace">
    <header className="inventory-heading"><div><span>CAMY INVENTORY</span><h1>Products & pricing</h1><p>Review costs, manage warehouse stock, and publish products for your resellers.</p></div><div className="inventory-actions"><button onClick={openAddCategory}><Grid2X2 size={17}/> Add category</button><button className="primary" onClick={openAdd}><Plus size={18}/> Add product</button></div></header>
    <section className="inventory-overview"><article><small>Catalogue products</small><strong>{products.length}</strong></article><article><small>Warehouse units</small><strong>{units.toLocaleString()}</strong></article><article><small>Published products</small><strong>{products.filter(product => product.published !== false).length}</strong></article></section>
    <div className="inventory-search"><label><Search size={19}/><input aria-label="Search inventory" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product name, code or category"/></label><button onClick={exportProducts}><Download size={17}/> Export catalogue</button><span>{filtered.length} products shown</span></div>
    <div className="inventory-categories">{categories.map(category => {
      const items = filtered.filter(product => product.category === category)
      return <section key={category} className="inventory-category"><header><div><PackageOpen size={20}/><h2>{category}</h2><b>{items.length}</b></div><button aria-label={`Manage ${category}`} onClick={() => manageCategory(category)}><Settings size={17}/> Manage category</button></header>
        <div className="inventory-table"><div className="inventory-table-head"><span>Product</span><span>Billing</span><span>Delivery</span><span>Packaging</span><span>Total cost</span><span>Stock & visibility</span><span>Edit</span></div>
          {items.map(product => {
            const costs = productCosts(product)
            const published = product.published !== false
            return <article key={product.id} className={`inventory-row ${published ? '' : 'is-hidden'}`}>
              <div className="inventory-product"><img src={product.image} alt=""/><div><small>{product.code}</small><strong>{product.name}</strong><span>{deliveryLabel(product)}</span></div></div>
              <div className="inventory-amount"><small>Billing</small>{money(costs.billingPrice)}</div><div className="inventory-amount"><small>Delivery</small>{money(costs.deliveryCost)}</div><div className="inventory-amount"><small>Packaging</small>{money(costs.packagingCost)}</div><div className="inventory-amount inventory-total"><small>Total cost</small>{money(costs.price)}</div>
              <div className="inventory-controls"><div className="inventory-stock"><button disabled={Number(product.stock) <= 0} aria-label={`Decrease ${product.name} stock`} onClick={() => stock(product.id, -1)}><Minus size={14}/></button><strong>{product.stock}</strong><button aria-label={`Increase ${product.name} stock`} onClick={() => stock(product.id, 1)}><Plus size={14}/></button></div><button className={`inventory-visibility ${published ? 'live' : ''}`} aria-pressed={published} onClick={() => togglePublished(product)}>{published ? <Eye size={14}/> : <EyeOff size={14}/>} {published ? 'Live' : 'Hidden'}</button></div>
              <button className="inventory-edit" onClick={() => openProduct(product)} aria-label={`Edit ${product.name}`}><Pencil size={17}/><span>Edit</span></button>
            </article>
          })}
        </div>{!items.length && <p className="inventory-empty">No matching products in this category.</p>}
      </section>
    })}</div>
  </div>
}
