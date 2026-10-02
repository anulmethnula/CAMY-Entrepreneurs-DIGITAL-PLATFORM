const encoder = new TextEncoder()
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 32767).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const columnName = index => { let label = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label; return label }
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => { let n = index; for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }

// A standards-compliant ZIP package using stored entries; no network or external library.
function zip(files) {
  const parts = [], directory = []
  let offset = 0, directorySize = 0
  for (const [filename, value] of Object.entries(files)) {
    const name = encoder.encode(filename), data = encoder.encode(value), crc = crc32(data)
    const local = new Uint8Array(30 + name.length), header = new DataView(local.buffer)
    header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x800, true)
    header.setUint16(12, 33, true); header.setUint32(14, crc, true); header.setUint32(18, data.length, true); header.setUint32(22, data.length, true); header.setUint16(26, name.length, true); local.set(name, 30)
    const central = new Uint8Array(46 + name.length), entry = new DataView(central.buffer)
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x800, true); entry.setUint16(14, 33, true)
    entry.setUint32(16, crc, true); entry.setUint32(20, data.length, true); entry.setUint32(24, data.length, true); entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true); central.set(name, 46)
    parts.push(local, data); directory.push(central); offset += local.length + data.length; directorySize += central.length
  }
  const end = new Uint8Array(22), footer = new DataView(end.buffer)
  footer.setUint32(0, 0x06054b50, true); footer.setUint16(8, directory.length, true); footer.setUint16(10, directory.length, true); footer.setUint32(12, directorySize, true); footer.setUint32(16, offset, true)
  const result = new Uint8Array(offset + directorySize + end.length)
  let cursor = 0; for (const part of [...parts, ...directory, end]) { result.set(part, cursor); cursor += part.length }
  return result
}

const labels = { id: 'Record ID', name: 'Name', entrepreneurId: 'Member ID', entrepreneur: 'Entrepreneur', customer: 'Customer name', phone: 'Contact number', email: 'Email address', nic: 'NIC number', city: 'City / district', address: 'Delivery address', joined: 'Joined date', date: 'Order date', deliveredAt: 'Delivered date', payoutDueAt: 'Payout due date', payoutPaidAt: 'Payout paid date', sales: 'Verified sales', credit: 'Credit limit', used: 'Outstanding balance', available: 'Available credit', stage: 'Membership stage', active: 'Account active', amount: 'Client COD total', camyCost: 'CAMY product value', entrepreneurMargin: 'Entrepreneur commission', payoutAmount: 'Payout amount', payoutStatus: 'Payout status', payoutReference: 'Transfer reference', qty: 'Quantity', reference: 'Payment reference', code: 'Product code', category: 'Category', price: 'Unit price', stock: 'Warehouse stock', warranty: 'Warranty', description: 'Description', status: 'Order status', orderId: 'Order ID', productId: 'Product ID', lineTotal: 'Line total', limit: 'Credit limit', outstanding: 'Outstanding balance', metric: 'Metric', value: 'Value', product: 'Product', rating: 'Rating' }
const monetary = new Set(['billingPrice', 'deliveryCost', 'packagingCost', 'sales', 'credit', 'used', 'available', 'amount', 'price', 'lineTotal', 'limit', 'outstanding', 'total', 'camyCost', 'entrepreneurMargin', 'payoutAmount', 'clientCod', 'camyGrossProfit', 'commission'])
const dates = new Set(['joined', 'date', 'createdAt', 'updatedAt', 'reviewedAt', 'deliveredAt', 'payoutDueAt', 'payoutPaidAt', 'paidAt'])
const textKeys = new Set(['id', 'entrepreneurId', 'orderId', 'productId', 'groupId', 'nic', 'phone', 'code', 'reference', 'account', 'accountNumber'])
const secretKeys = new Set(['image', 'avatar', 'receipt', 'receiptPath', 'trackingToken', 'token', 'password', 'password_hash', 'temporaryPassword', 'permissions_json', 'nic_image_path', 'bankDetails', 'exitRequest'])
const niceLabel = key => labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())

export function reportSheets(rows, title = 'Report') {
  let keys
  if (rows.some(row => 'customer' in row)) keys = ['id', 'date', 'deliveredAt', 'entrepreneurId', 'entrepreneur', 'customer', 'phone', 'address', 'product', 'qty', 'amount', 'camyCost', 'entrepreneurMargin', 'payoutStatus', 'payoutDueAt', 'payoutPaidAt', 'payoutReference', 'status']
  else if (rows.some(row => 'stock' in row && 'price' in row)) keys = ['id', 'code', 'name', 'category', ...(rows.some(row => 'billingPrice' in row) ? ['billingPrice', 'deliveryCost', 'packagingCost', 'freeDelivery'] : []), 'price', 'stock', 'warranty', 'description']
  else if (rows.some(row => 'sales' in row && 'name' in row)) keys = ['id', 'name', 'email', 'nic', 'phone', 'city', 'joined', 'stage', 'active', 'sales', 'credit', 'used', 'available']
  else keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => !secretKeys.has(key) && key !== 'items')
  if (!keys.length) keys = ['id', 'name', 'status']
  const columns = keys.map(key => ({ key, label: niceLabel(key), type: monetary.has(key) ? 'currency' : dates.has(key) ? 'date' : textKeys.has(key) ? 'text' : 'auto' }))
  const normalized = rows.map(row => keys.includes('available') ? { ...row, available: Math.max(0, Number(row.credit || 0) - Number(row.used || 0)) } : row)
  const sheets = [{ name: title, title: `CAMY Entrepreneurs - ${title}`, columns, rows: normalized }]
  if (rows.some(row => row.items?.length)) sheets.push({ name: 'Order items', title: 'CAMY Entrepreneurs - Order line items', columns: ['orderId', 'productId', 'name', 'qty', 'price', 'lineTotal'].map(key => ({ key, label: niceLabel(key), type: monetary.has(key) ? 'currency' : textKeys.has(key) ? 'text' : 'auto' })), rows: rows.flatMap(row => (row.items || []).map(item => ({ orderId: row.id, productId: item.id || item.productId, name: item.name || item.productId, qty: Number(item.qty), price: Number(item.price), lineTotal: Number(item.qty) * Number(item.price) }))) })
  return sheets
}

function text(value) {
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '')
}
function cell(reference, value, type, style) {
  if (type === 'date' && value && !Number.isNaN(Date.parse(value))) {
    const serial = (Date.parse(String(value).slice(0, 10)) - Date.UTC(1899, 11, 30)) / 86400000
    return `<c r="${reference}" s="${style === 4 ? 8 : style >= 9 ? style : 7}"><v>${serial}</v></c>`
  }
  if (value !== '' && value != null && (type === 'currency' || (type !== 'text' && typeof value === 'number')) && Number.isFinite(Number(value))) return `<c r="${reference}" s="${type === 'currency' ? style === 4 ? 6 : style >= 9 ? style : 5 : style}"><v>${Number(value)}</v></c>`
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(text(value))}</t></is></c>`
}
const styles = `${declaration}<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;Rs. &quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd mmm yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><color rgb="FF17324D"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="20"/><color rgb="FF164F7E"/><name val="Aptos Display"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF164F7E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F8FC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEAF5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border/><border><left style="thin"><color rgb="FFD6E2EC"/></left><right style="thin"><color rgb="FFD6E2EC"/></right><top style="thin"><color rgb="FFD6E2EC"/></top><bottom style="thin"><color rgb="FFD6E2EC"/></bottom></border><border><top style="medium"><color rgb="FF164F7E"/></top><bottom style="thin"><color rgb="FF9CB8CE"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1" indent="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1" indent="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top" indent="1"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top" indent="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="164" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const longTextKeys = new Set(['address', 'description', 'note', 'products', 'adminNote', 'joinReason'])
function columnWidth(column, rows) {
  const sample = rows.slice(0, 200).map(row => text(row[column.key]).replace(/\r?\n/g, ' '))
  const longest = Math.max(column.label.length, ...sample.map(value => value.length))
  if (column.type === 'currency') return 20
  if (column.type === 'date') return 16
  if (longTextKeys.has(column.key)) return Math.min(42, Math.max(28, Math.ceil(longest * 0.62)))
  if (textKeys.has(column.key)) return Math.min(24, Math.max(14, longest + 2))
  return Math.min(30, Math.max(14, longest + 2))
}
function rowHeight(row, columns, widths) {
  const lines = Math.max(1, ...columns.map((column, index) => text(row[column.key]).split(/\r?\n/).reduce((count, part) => count + Math.max(1, Math.ceil(part.length / Math.max(8, Math.floor(widths[index] * 1.25)))), 0)))
  return Math.min(96, Math.max(28, 10 + lines * 17))
}

export function createWorkbook(sheets, generatedAt = new Date()) {
  if (!sheets.length) throw new Error('At least one report sheet is required.')
  const files = {}, relationships = [], workbookSheets = [], contentTypes = []
  const usedNames = new Set()
  sheets.forEach((sheet, index) => {
    let name = String(sheet.name || `Report ${index + 1}`).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 27) || 'Report'
    if (usedNames.has(name.toLowerCase())) name += ` ${index + 1}`
    usedNames.add(name.toLowerCase())
    const id = index + 1, columns = sheet.columns, last = columnName(columns.length - 1), end = Math.max(4, sheet.rows.length + 4)
    const columnWidths = columns.map(column => columnWidth(column, sheet.rows))
    const rows = [`<row r="1" ht="38" customHeight="1">${cell('A1', sheet.title || name, 'text', 1)}</row>`, `<row r="2" ht="24" customHeight="1">${cell('A2', `Generated ${generatedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC  •  ${sheet.rows.length} records  •  Currency: LKR`, 'text', 0)}</row>`, `<row r="4" ht="38" customHeight="1">${columns.map((column, position) => cell(columnName(position) + '4', column.label, 'text', 2)).join('')}</row>`]
    sheet.rows.forEach((row, rowIndex) => {
      const height = rowHeight(row, columns, columnWidths)
      rows.push(`<row r="${rowIndex + 5}" ht="${height}" customHeight="1">${columns.map((column, position) => cell(columnName(position) + (rowIndex + 5), row[column.key], column.type || 'auto', rowIndex % 2 ? 4 : 3)).join('')}</row>`)
    })
    const totalKeys = new Set(['qty', 'stock', 'sales', 'credit', 'used', 'available', 'amount', 'lineTotal', 'limit', 'outstanding', 'total', 'clientCod', 'camyGrossProfit', 'commission', 'daysOverdue'])
    const hasTotals = sheet.showTotals !== false && sheet.rows.length > 0 && columns.some(column => totalKeys.has(column.key))
    if (hasTotals) rows.push(`<row r="${end + 2}" ht="32" customHeight="1">${columns.map((column, position) => position === 0 ? cell(`A${end + 2}`, 'TOTAL', 'text', 9) : totalKeys.has(column.key) ? cell(columnName(position) + (end + 2), sheet.rows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0), column.type, column.type === 'currency' ? 10 : 11) : cell(columnName(position) + (end + 2), '', 'text', 9)).join('')}</row>`)
    const widths = columnWidths.map((width, position) => `<col min="${position + 1}" max="${position + 1}" width="${width}" customWidth="1"/>`).join('')
    files[`xl/worksheets/sheet${id}.xml`] = `${declaration}<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${hasTotals ? end + 2 : end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${widths}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A4:${last}${end}"/>${columns.length > 1 ? `<mergeCells count="2"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/></mergeCells>` : ''}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
    workbookSheets.push(`<sheet name="${xml(name)}" sheetId="${id}" r:id="rId${id}"/>`)
    relationships.push(`<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`)
    contentTypes.push(`<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
  })
  files['xl/styles.xml'] = styles
  files['xl/workbook.xml'] = `${declaration}<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets.join('')}</sheets></workbook>`
  files['xl/_rels/workbook.xml.rels'] = `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  files['_rels/.rels'] = `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  files['[Content_Types].xml'] = `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentTypes.join('')}</Types>`
  return zip(files)
}

export function downloadWorkbook(filename, sheets) {
  const bytes = createWorkbook(sheets)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename.replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx'
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportReport(filename, rows) {
  const title = filename.replace(/^camy-/, '').replace(/\.[^.]+$/, '').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  downloadWorkbook(filename, reportSheets(rows, title))
}
