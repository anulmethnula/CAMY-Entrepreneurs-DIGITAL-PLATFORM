import { PackageOpen, Pencil, Plus, Search, Download, Eye, EyeOff, Minus, Settings, Grid2X2, Boxes, PackageCheck, Warehouse, Upload } from 'lucide-react'
import { productCosts, deliveryLabel } from './productCosts'
import './inventory.css'

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK')}`

export function AdminInventory({ products, visible, categories, allCategories, categoryFilter, setCategoryFilter, search, setSearch, openAdd, openAddCategory, openImport, openProduct, stock, togglePublished, manageCategory, exportProducts }) {
  const filtered = visible.filter(product => categories.includes(product.category))
  const units = products.reduce((total, product) => total + Number(product.stock || 0), 0)
  const published = products.filter(product => product.published !== false).length
  return <div className="inventory-workspace">
    <header className="inventory-heading"><div className="inventory-heading-copy"><span>PRODUCT CATALOGUE</span><h1>Inventory command centre</h1><p>Manage product costs, warehouse stock, catalogue visibility, and categories from one workspace.</p></div><div className="inventory-actions"><button onClick={openImport}><Upload size={17}/> Import from file</button><button onClick={openAddCategory}><Grid2X2 size={17}/> Add category</button><button className="primary" onClick={openAdd}><Plus size={18}/> Add product</button></div></header>
    <section className="inventory-overview" aria-label="Catalogue overview"><article><i><Boxes/></i><div><small>Catalogue products</small><strong>{products.length}</strong><span>Across {allCategories.length} categor{allCategories.length===1?'y':'ies'}</span></div></article><article><i><Warehouse/></i><div><small>Warehouse units</small><strong>{units.toLocaleString()}</strong><span>Available stock on hand</span></div></article><article><i><PackageCheck/></i><div><small>Published products</small><strong>{published}</strong><span>{products.length-published} currently hidden</span></div></article></section>
    <div className="inventory-tools"><div className="inventory-search"><label><Search size={19}/><input aria-label="Search inventory" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product name, model code, or category"/>{search&&<button type="button" className="inventory-search-clear" onClick={()=>setSearch('')} aria-label="Clear product search">×</button>}</label><button className="inventory-export" onClick={exportProducts}><Download size={17}/> Export catalogue</button><span><b>{filtered.length}</b> shown</span></div>
      <nav className="product-category-bar" aria-label="Product categories"><button type="button" className={categoryFilter==='All'?'active':''} onClick={()=>setCategoryFilter('All')}><Grid2X2/><span>All products</span><b>{products.length}</b></button>{allCategories.map(category=><button type="button" className={categoryFilter===category?'active':''} key={category} onClick={()=>setCategoryFilter(category)}><PackageOpen/><span>{category}</span><b>{products.filter(product=>product.category===category).length}</b></button>)}</nav>
    </div>
    <div className="inventory-categories">{categories.map(category => {
      const items = filtered.filter(product => product.category === category)
      return <section key={category} className="inventory-category"><header><div><i><PackageOpen size={19}/></i><span><small>PRODUCT CATEGORY</small><h2>{category}</h2></span><b>{items.length}</b></div><button aria-label={`Manage ${category}`} onClick={() => manageCategory(category)}><Settings size={17}/> Manage category</button></header>
        <div className="inventory-table"><div className="inventory-table-head"><span>Product</span><span>Billing</span><span>Delivery</span><span>Packaging</span><span>Total cost</span><span>Stock & visibility</span><span>Edit</span></div>
          {items.map(product => {
            const costs = productCosts(product)
            const totalCost = costs.billingPrice + costs.deliveryCost + costs.packagingCost
            const published = product.published !== false
            return <article key={product.id} className={`inventory-row ${published ? '' : 'is-hidden'}`}>
              <div className="inventory-product"><img src={product.image} alt=""/><div><small>{product.code}</small><strong>{product.name}</strong><span className={product.freeDelivery===false?'delivery-paid':''}>{deliveryLabel(product)}</span></div></div>
              <div className="inventory-amount"><small>Billing</small>{money(costs.billingPrice)}</div><div className="inventory-amount"><small>Delivery</small>{money(costs.deliveryCost)}</div><div className="inventory-amount"><small>Packaging</small>{money(costs.packagingCost)}</div><div className="inventory-amount inventory-total"><small>Total cost</small>{money(totalCost)}</div>
              <div className="inventory-controls"><div className="inventory-stock"><button disabled={Number(product.stock) <= 0} aria-label={`Decrease ${product.name} stock`} onClick={() => stock(product.id, -1)}><Minus size={14}/></button><strong>{product.stock}</strong><button aria-label={`Increase ${product.name} stock`} onClick={() => stock(product.id, 1)}><Plus size={14}/></button></div><button className={`inventory-visibility ${published ? 'live' : ''}`} aria-pressed={published} onClick={() => togglePublished(product)}>{published ? <Eye size={14}/> : <EyeOff size={14}/>} {published ? 'Live' : 'Hidden'}</button></div>
              <button className="inventory-edit" onClick={() => openProduct(product)} aria-label={`Edit ${product.name}`}><Pencil size={17}/><span>Edit</span></button>
            </article>
          })}
        </div>{!items.length && <p className="inventory-empty">No matching products in this category.</p>}
      </section>
    })}</div>
  </div>
}
