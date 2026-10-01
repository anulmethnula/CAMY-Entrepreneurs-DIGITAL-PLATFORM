export function productCosts(product) {
  const billingPrice = Number(product.billingPrice ?? product.price ?? 0)
  const deliveryCost = Number(product.deliveryCost ?? 0)
  const packagingCost = Number(product.packagingCost ?? 0)
  const freeDelivery = product.freeDelivery !== false
  const price = Math.round((billingPrice + packagingCost + (freeDelivery ? deliveryCost : 0)) * 100) / 100
  return { billingPrice, deliveryCost, packagingCost, price, freeDelivery }
}

export function deliveryLabel(product) {
  if (product.freeDelivery !== false) return 'Free delivery'
  const charge = Number(product.deliveryCost || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `Delivery charge: Rs. ${charge}`
}

export function customerProductPrice(product) {
  return Number(product.price || 0)
}

export function payableDeliveryCost(product) {
  return product.freeDelivery === false ? Number(product.deliveryCost || 0) : 0
}

export function fullProductCost(product) {
  return customerProductPrice(product) + payableDeliveryCost(product)
}
