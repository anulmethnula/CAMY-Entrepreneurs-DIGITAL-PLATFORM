import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createWorkbook, reportSheets } from '../src/reports.js'

const people = [{ id: 'CE-TEST', name: '\u0d9a\u0db8\u0dd2 Test <&>', nic: '199512345678', phone: '0771234567', joined: '2026-09-16', sales: 25000.5, credit: 10000, used: 1250, trackingToken: 'DO-NOT-EXPORT', password_hash: 'DO-NOT-EXPORT' }]
const orders = [{ id: 'CMY-TEST', date: '2026-09-16', customer: '=HYPERLINK("https://invalid.example")', phone: '0770000001', entrepreneurId: 'CE-TEST', entrepreneur: 'Test member', qty: 3, amount: 12500.5, status: 'Pending', items: [{ id: 1, name: 'Product A', qty: 2, price: 5000 }, { id: 2, name: 'Product B', qty: 1, price: 2500.5 }] }]
const sheets = [...reportSheets(people, 'Entrepreneurs'), ...reportSheets(orders, 'Orders'), ...reportSheets([], 'Empty results')]
assert.equal(sheets[0].rows[0].available, 8750)
assert.equal(sheets[2].rows.length, 2)
assert.equal(sheets[2].rows[1].lineTotal, 2500.5)
assert(!sheets[0].columns.some(column => column.key === 'trackingToken' || column.key === 'password_hash'))
const workbook = createWorkbook(sheets, new Date('2026-09-16T10:00:00Z'))
assert.equal(new DataView(workbook.buffer).getUint32(0, true), 0x04034b50)
const content = new TextDecoder().decode(workbook)
assert(content.includes('t="inlineStr"'))
assert(!content.includes('<f>'))
assert(!content.includes('DO-NOT-EXPORT'))
assert(content.includes('0771234567'))
assert(content.includes('frozen') && content.includes('autoFilter'))
assert(content.includes('TOTAL'))
assert(content.includes('FF174D7D'))
assert(content.includes('&lt;&amp;&gt;'))
await mkdir('private/review', { recursive: true })
await writeFile('private/review/report-format-test.xlsx', workbook)
console.log('PASS: Genuine XLSX package, styled reports, totals, item sheet, empty results, typed numbers/dates, identifiers, Unicode, and safe text cells.')
