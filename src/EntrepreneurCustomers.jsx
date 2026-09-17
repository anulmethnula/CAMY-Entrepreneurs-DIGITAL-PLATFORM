import { useMemo, useState } from 'react'

export function EntrepreneurCustomers({ orders }) {
  const [search, setSearch] = useState('')
  const customers = useMemo(() => {
    const groups = new Map()
    for (const order of orders) {
      // Registered accounts share a stable ID. Legacy guests remain separate records.
      const key = order.customerId ? `customer-${order.customerId}` : `guest-${order.id}`
      const group = groups.get(key) || { key, orders: [] }
      group.orders.push(order); groups.set(key, group)
    }
    return [...groups.values()].map(group => ({ ...group, latest: [...group.orders].sort((a,b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0] }))
  }, [orders])
  const visible = customers.filter(({ orders, latest }) => `${latest.customer} ${latest.phone} ${latest.address} ${orders.map(order => order.id).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="entrepreneur-customers"><h3>Customers of this shop <span>({customers.length})</span></h3><p>View customer contact details and their purchases from this entrepreneur.</p><label>Find a customer or order<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, phone or order number" /></label>
    {visible.map(({ key, orders, latest }) => <details key={key} className="entrepreneur-customer"><summary><span><strong>{latest.customer || 'Guest customer'}</strong><small>{latest.customerId ? 'Registered customer' : 'Legacy guest order'} · {latest.phone}</small></span><b>{orders.length} order{orders.length === 1 ? '' : 's'}</b></summary><div><p><b>Delivery address:</b> {latest.address || 'Not provided'}</p><p><b>Delivered purchases:</b> Rs. {orders.filter(order => order.status === 'Delivered').reduce((sum, order) => sum + Number(order.amount || 0), 0).toLocaleString('en-LK')}</p>{orders.map(order => <article key={order.id}><strong>{order.id} · {order.date}</strong><span>{order.status}{order.return ? ` · Return ${order.return.status}${order.return.refundStatus ? ` / ${order.return.refundStatus}` : ''}` : ''}</span><p>{order.items?.map(item => `${item.name} × ${item.qty}`).join(', ') || order.product}</p><b>Rs. {Number(order.amount || 0).toLocaleString('en-LK')}</b></article>)}</div></details>)}
    {!visible.length && <p>No matching customers for this shop.</p>}
  </section>
}
