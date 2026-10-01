export function productCosts(product) {
  const billingPrice = Number(product.billingPrice ?? product.price ?? 0)
  const deliveryCost = Number(product.deliveryCost ?? 0)
  const packagingCost = Number(product.packagingCost ?? 0)
  const price = Math.round((billingPrice + deliveryCost + packagingCost) * 100) / 100
  return { billingPrice, deliveryCost, packagingCost, price, freeDelivery: product.freeDelivery !== false }
}

export function deliveryLabel(product) {
  return product.freeDelivery === false ? 'Delivery included in total' : 'Free delivery'
}
