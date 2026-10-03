import priceRows from '../database/camy_price_list.json'

const titleCase = value => String(value).toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const categoryNames = { AC: 'Air Conditioners', 'COOK WARE': 'Cookware', TV: 'Televisions', 'NATIONAL MIXER GRINDER': 'Mixer Grinders', 'MIXER GRINDER-CAMY': 'Mixer Grinders', 'CAMY MIXER GRINDER NEW': 'Mixer Grinders' }

const productCode = (row, index) => {
  const prefix = row.category === 'AC' ? 'AC' : row.category.replace(/[^A-Z0-9]/g, '').slice(0, 5)
  const item = row.article.replace(/[^A-Z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()
  return `${prefix}-${item}-${String(index + 1).padStart(3, '0')}`
}

const productImage = row => {
  if (row.category === 'AC') {
    if (row.article.includes('12000')) return '/products/ac-12000.png'
    if (row.article.includes('18000')) return '/products/ac-18000.png'
    return '/products/ac-24000.png'
  }
  if (row.category === 'COOK WARE') {
    if (row.article.includes('HOPPER')) return '/products/hopper-pan.png'
    if (row.article.includes('FRY PAN 22')) return '/products/frypan-22.png'
    if (row.article.includes('FRY PAN 24')) return '/products/frypan-24.png'
    if (row.article.includes('CASSEROLE')) return '/products/casserole.png'
    if (row.article.includes('SET')) return '/products/cookware-set.png'
  }
  if (row.category === 'TV') return '/products/smart-tv.png'
  return '/products/classic-set.png'
}

export const camyPriceProducts = priceRows.map((row, index) => {
  const isAirConditioner = row.category === 'AC'
  const total = Math.round((Number(row.rrp) + Number(row.delivery) + Number(row.packaging)) * 100) / 100
  return {
    id: index + 1,
    name: titleCase(row.article).replace(/Btu\b/gi, 'BTU').replace(/\bCm\b/g, 'cm').replace(/\bLtr\b/g, 'L'),
    category: categoryNames[row.category] || titleCase(row.category),
    price: isAirConditioner ? Number(row.rrp) : total,
    billingPrice: Number(row.rrp), deliveryCost: Number(row.delivery), packagingCost: Number(row.packaging),
    freeDelivery: !isAirConditioner, deliveryChargeVisible: isAirConditioner,
    image: productImage(row), tag: '', stock: 0, code: productCode(row, index), rating: 5, warranty: 'Ask CAMY',
    description: isAirConditioner ? 'Air conditioner supplied without installation. Delivery is charged separately.' : 'CAMY quality product available for entrepreneur sales.',
    specs: [row.remarks || 'CAMY quality assured'], published: true,
  }
})
