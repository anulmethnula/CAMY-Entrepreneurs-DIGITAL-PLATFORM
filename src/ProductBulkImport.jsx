import { useRef, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Download, FileCheck2, FileSpreadsheet, Info, Upload, X } from 'lucide-react'
import { PortalOverlay } from './Dialog'
import { downloadWorkbook } from './reports'
import { productCosts } from './productCosts'

const requiredHeaders = ['code', 'name', 'category', 'stock']
const aliases = {
  code: ['code', 'product code', 'model', 'model code', 'sku'],
  name: ['name', 'product name'],
  category: ['category', 'product category'],
  price: ['price', 'price lkr', 'unit price'],
  billingPrice: ['billing price', 'billing price lkr', 'billingprice'],
  deliveryCost: ['delivery cost', 'delivery cost lkr', 'deliverycost'],
  packagingCost: ['packaging cost', 'packaging cost lkr', 'packagingcost'],
  freeDelivery: ['free delivery', 'free delivery yes no', 'freedelivery'],
  stock: ['stock', 'opening stock', 'warehouse stock', 'quantity'],
  description: ['description'], tag: ['tag'], rating: ['rating', 'rating 0 5'], warranty: ['warranty'],
  specifications: ['specifications', 'specs', 'specifications separate with'],
  main_image_url: ['main image url', 'image', 'image url'],
  additional_media_urls: ['additional media urls', 'other image video urls separate with', 'media urls'],
  published: ['published', 'published yes no', 'live'],
}

const clean = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const headerKey = value => Object.entries(aliases).find(([, names]) => names.includes(clean(value)))?.[0] || ''
const splitValues = value => String(value ?? '').split(/[|\n]/).map(item => item.trim()).filter(Boolean)
const mediaType = src => /\.(mp4|webm)(?:[?#]|$)/i.test(src) ? 'video' : 'image'
const publishedValue = value => value === '' || value == null || !['no', 'false', '0', 'hidden'].includes(String(value).trim().toLowerCase())

function validMediaUrl(value) {
  if (!value) return true
  if (value.startsWith('/')) return true
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch { return false }
}

function parseCsv(text) {
  const rows = [[]]
  let value = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index++ }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { rows.at(-1).push(value); value = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++
      rows.at(-1).push(value); value = ''; rows.push([])
    } else value += character
  }
  rows.at(-1).push(value)
  return rows
}

function excelValue(value) {
  if (value && typeof value === 'object') return value.text ?? value.result ?? value.hyperlink ?? ''
  return value ?? ''
}

async function fileMatrix(file) {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text())
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('This workbook does not contain a worksheet.')
  const matrix = []
  worksheet.eachRow({ includeEmpty: true }, row => matrix.push(row.values.slice(1).map(excelValue)))
  return matrix
}

export async function parseFile(file, products, categories) {
  const matrix = await fileMatrix(file)
  const headerIndex = matrix.findIndex(row => requiredHeaders.every(required => row.some(cell => headerKey(cell) === required)) && row.some(cell => ['price', 'billingPrice'].includes(headerKey(cell))))
  if (headerIndex < 0) throw new Error('Include Product code, Product name, Category, Billing price and Opening stock. Legacy Price sheets are also supported.')

  const keys = matrix[headerIndex].map(headerKey)
  const categoryMap = new Map(categories.map(category => [category.toLowerCase(), category]))
  const existingByCode = new Map(products.map(product => [clean(product.code), product]))
  const seenCodes = new Set()

  return matrix.slice(headerIndex + 1).map((cells, index) => {
    const source = Object.fromEntries(keys.map((key, column) => [key, cells[column]]).filter(([key]) => key))
    const code = String(source.code ?? '').trim()
    const name = String(source.name ?? '').trim()
    const requestedCategory = String(source.category ?? '').trim()
    const category = categoryMap.get(requestedCategory.toLowerCase()) || ''
    const amount = value => Number(String(value ?? '').replace(/(?:Rs\.?|\s|,)/gi, ''))
    const hasBreakdown = keys.includes('billingPrice')
    const existing = existingByCode.get(clean(code))
    const billingPrice = amount(hasBreakdown ? source.billingPrice : source.price)
    const deliveryCost = hasBreakdown ? amount(source.deliveryCost ?? 0) : 0
    const packagingCost = hasBreakdown ? amount(source.packagingCost ?? 0) : 0
    const deliverySetting = String(source.freeDelivery ?? '').trim().toLowerCase()
    const freeDelivery = deliverySetting ? ['yes', 'true', '1', 'free'].includes(deliverySetting) : existing?.freeDelivery !== false
    const price = productCosts({ billingPrice, deliveryCost, packagingCost, freeDelivery }).price
    const stock = Number(String(source.stock ?? '').replace(/[^0-9.-]/g, ''))
    const rating = source.rating == null || source.rating === '' ? 5 : Number(source.rating)
    const mainImage = String(source.main_image_url ?? '').trim()
    const mediaUrls = [mainImage, ...splitValues(source.additional_media_urls)].filter(Boolean)
    const errors = []

    if (!code) errors.push('Product code is required')
    if (!name) errors.push('Product name is required')
    if (!requestedCategory) errors.push('Category is required')
    else if (!category) errors.push(`Unknown category: ${requestedCategory}`)
    if (!Number.isFinite(price) || price <= 0) errors.push('Price must be greater than 0')
    if (hasBreakdown && (source.billingPrice == null || String(source.billingPrice).trim() === '')) errors.push('Billing price is required')
    if ([billingPrice, deliveryCost, packagingCost].some(value => !Number.isFinite(value) || value < 0)) errors.push('All costs must be valid nonnegative numbers')
    if (deliverySetting && !['yes', 'no', 'true', 'false', '1', '0', 'free', 'included'].includes(deliverySetting)) errors.push('Free delivery must be Yes or No')
    if (!Number.isInteger(stock) || stock < 0) errors.push('Stock must be a whole number, 0 or more')
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) errors.push('Rating must be between 0 and 5')
    if (code && seenCodes.has(clean(code))) errors.push('Duplicate product code in this sheet')
    if (mediaUrls.length > 12) errors.push('Use no more than 12 media URLs')
    if (mediaUrls.some(url => !validMediaUrl(url))) errors.push('One or more media URLs are invalid')
    if (code) seenCodes.add(clean(code))

    const media = mediaUrls.map((src, mediaIndex) => ({ type: mediaType(src), src, name: mediaIndex ? `Imported media ${mediaIndex + 1}` : 'Main image' }))
    const product = {
      ...(existing || {}), code, name, category, price, billingPrice, deliveryCost, packagingCost, freeDelivery, stock, rating,
      description: String(source.description ?? '').trim(),
      tag: String(source.tag ?? '').trim(),
      warranty: String(source.warranty ?? '').trim(),
      specs: splitValues(source.specifications),
      published: publishedValue(source.published),
      ...(mediaUrls.length ? { image: mainImage || mediaUrls.find(url => mediaType(url) === 'image') || '', media } : {}),
      ...(!existing && !mediaUrls.length ? { image: '/products/classic-set.png', media: [] } : {}),
    }
    return { rowNumber: headerIndex + index + 2, action: existing ? 'Update' : 'New', errors, product }
  }).filter(row => row.product.code || row.product.name || row.product.category)
}

function downloadTemplate(categories) {
  const definitions = [
    ['code', 'Product code'], ['name', 'Product name'], ['category', 'Category'],
    ['billingPrice', 'Billing price (LKR)'], ['deliveryCost', 'Delivery cost (LKR)'], ['packagingCost', 'Packaging cost (LKR)'], ['freeDelivery', 'Free delivery (Yes/No)'],
    ['stock', 'Opening stock'], ['description', 'Description'], ['tag', 'Tag'], ['rating', 'Rating (0-5)'],
    ['warranty', 'Warranty'], ['specifications', 'Specifications (separate with |)'], ['main_image_url', 'Main image URL'],
    ['additional_media_urls', 'Other image/video URLs (separate with |)'], ['published', 'Published (Yes/No)'],
  ]
  downloadWorkbook('camy-product-import-template.xlsx', [
    {
      name: 'Products', title: 'CAMY Bulk Product Import Template',
      columns: definitions.map(([key, label]) => ({ key, label, type: ['billingPrice', 'deliveryCost', 'packagingCost'].includes(key) ? 'currency' : 'text' })),
      rows: [{ code: 'EXAMPLE-001', name: 'Example product', category: categories[0] || 'Cookware', billingPrice: 2000, deliveryCost: 750, packagingCost: 450, freeDelivery: 'Yes', stock: 10, description: 'Total cost is calculated automatically: Rs. 3,200. Replace or delete this row.', tag: 'New', rating: 5, warranty: '1 year', specifications: 'Durable finish | Easy to clean', main_image_url: 'https://example.com/main.jpg', additional_media_urls: 'https://example.com/second.jpg | https://example.com/demo.mp4', published: 'Yes' }],
    },
    { name: 'Valid categories', title: 'Use one of these categories', columns: [{ key: 'category', label: 'Valid category', type: 'text' }], rows: categories.map(category => ({ category })) },
  ])
}

export function ProductBulkImport({ products, categories, onImport, onClose }) {
  const input = useRef(null)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const validRows = rows.filter(row => !row.errors.length)

  const chooseFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true); setError(''); setFileName(file.name)
    try { setRows(await parseFile(file, products, categories)) }
    catch (reason) { setRows([]); setError(reason.message || 'Could not read this spreadsheet.') }
    finally { setBusy(false) }
  }

  return <PortalOverlay className="product-import-overlay" onClose={onClose} label="Import products from Excel">
    <section className="product-import-dialog">
      <header><i><FileSpreadsheet /></i><div><span>CATALOGUE IMPORT</span><h2>Import products from a file</h2><p>Download the CAMY template, add your products, and review every row before importing.</p></div><button onClick={onClose} aria-label="Close import dialog"><X /></button></header>
      <div className="product-import-steps" aria-label="Import steps"><span className="active"><b>1</b> Download template</span><ArrowRight/><span className={fileName?'active':''}><b>2</b> Select file</span><ArrowRight/><span className={rows.length?'active':''}><b>3</b> Review & import</span></div>
      <div className="product-import-actions"><button className="template" onClick={() => downloadTemplate(categories)}><i><Download /></i><span><strong>Download CAMY template</strong><small>Excel workbook with the correct columns</small></span></button><button className="primary" disabled={busy} onClick={() => input.current?.click()}><i>{busy?<FileSpreadsheet/>:<Upload />}</i><span><strong>{busy ? 'Reading your file...' : fileName ? 'Choose another file' : 'Choose Excel or CSV'}</strong><small>{fileName||'XLSX or CSV files supported'}</small></span></button><input ref={input} type="file" accept=".xlsx,.csv" onChange={chooseFile} hidden /></div>
      <aside><Info/><div><strong>Before you upload</strong><p>Use an existing category name exactly as shown in the template. Enter billing, packaging, and delivery costs separately.</p><p>Public image or video links can be included. Local media files can still be uploaded later through <b>Edit product</b>.</p></div></aside>
      {error && <p className="product-import-error"><AlertCircle />{error}</p>}
      {!!rows.length && <section className="product-import-preview"><div className="product-import-summary"><div><FileCheck2/><span><strong>File review</strong><small>{fileName}</small></span></div><span><b>{rows.length}</b> total rows</span><span className="valid"><b>{validRows.length}</b> ready</span><span className="invalid"><b>{rows.length - validRows.length}</b> need attention</span></div><div className="product-import-table"><div className="head"><span>Row</span><span>Product & cost</span><span>Category</span><span>Action</span><span>Validation</span></div>{rows.map(row => <div key={row.rowNumber} className={row.errors.length ? 'invalid' : 'valid'}><span>{row.rowNumber}</span><span><strong>{row.product.name || 'Missing name'}</strong><small>{row.product.code || 'Missing code'}</small><small>Billing {row.product.billingPrice} + packaging {row.product.packagingCost}{row.product.freeDelivery ? ` + delivery ${row.product.deliveryCost}` : ''} = Rs. {row.product.price.toLocaleString('en-LK')}</small><small>{row.product.freeDelivery ? 'Free delivery' : 'Delivery charged separately'}</small></span><span>{row.product.category || 'Not matched'}</span><span><b className={`import-action ${row.action.toLowerCase()}`}>{row.action}</b></span><span>{row.errors.length ? <><AlertCircle />{row.errors.join(' · ')}</> : <><CheckCircle2 />Ready to import</>}</span></div>)}</div></section>}
      <footer><p><strong>Safe import:</strong> matching product codes are updated, new codes create products, and invalid rows are skipped.</p><button onClick={onClose}>Cancel</button><button className="primary" disabled={!validRows.length || busy} onClick={() => { onImport(validRows.map(row => row.product)); onClose() }}><Upload/> Import {validRows.length || ''} valid product{validRows.length === 1 ? '' : 's'}</button></footer>
    </section>
  </PortalOverlay>
}
