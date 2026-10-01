import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { productCosts, deliveryLabel, fullProductCost, payableDeliveryCost } from '../src/productCosts.js'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { parseFile } = await server.ssrLoadModule('/src/ProductBulkImport.jsx')
  const file = text => ({ name: 'costs.csv', text: async () => text })
  const headers = 'Product code,Product name,Category,Billing price,Delivery cost,Packaging cost,Free delivery,Opening stock\n'
  const rows = await parseFile(file(headers + 'MIX-1,Mixer,Cookware,2000,750,450,Yes,10\nPAN-1,Pan,Cookware,1500,550,350,No,5'), [], ['Cookware'])
  assert.deepEqual(rows.map(row => row.errors), [[], []])
  assert.equal(rows[0].product.price, 3200)
  assert.equal(rows[1].product.price, 1850)
  assert.equal(deliveryLabel(rows[0].product), 'Free delivery')
  assert.equal(deliveryLabel(rows[1].product), 'Delivery charge: Rs. 550.00')
  const legacy = await parseFile(file('Product code,Product name,Category,Price,Opening stock\nOLD,Old product,Cookware,2500,4'), [], ['Cookware'])
  assert.equal(legacy[0].product.price, 2500)
  assert.equal(legacy[0].product.billingPrice, 2500)
  const invalid = await parseFile(file(headers + 'BAD,Invalid,Cookware,2000,-5,100,Maybe,3'), [], ['Cookware'])
  assert.ok(invalid[0].errors.some(error => error.includes('nonnegative')))
  assert.ok(invalid[0].errors.some(error => error.includes('Yes or No')))
  const decimals = await parseFile(file(headers + 'DEC,Decimals,Cookware,2000.25,750.5,450.25,Yes,1'), [], ['Cookware'])
  assert.equal(decimals[0].product.price, 3201)
  assert.equal(productCosts({ price: 5000 }).price, 5000)
  assert.equal(productCosts({ billingPrice: 2000, deliveryCost: 500, packagingCost: 500, freeDelivery: true }).price, 3000)
  assert.equal(productCosts({ billingPrice: 2000, deliveryCost: 500, packagingCost: 500, freeDelivery: false }).price, 2500)
  assert.equal(payableDeliveryCost({ deliveryCost: 500, freeDelivery: true }), 0)
  assert.equal(payableDeliveryCost({ deliveryCost: 500, freeDelivery: false }), 500)
  assert.equal(fullProductCost({ price: 2500, deliveryCost: 500, freeDelivery: false }), 3000)
  console.log('Product costs passed: totals, delivery labels, legacy import, decimals and invalid rows.')
} finally {
  await server.close()
}
