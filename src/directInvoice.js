import { dsMoney } from './directSalesModel.js'
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
export function directInvoiceHtml(sale, company = {}) {
  company = sale.company || company
  return `<html><head><title>${esc(sale.id)} sales invoice</title><style>body{font:14px Arial,sans-serif;color:#15354d;margin:35px}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}p{line-height:1.7}h1{font-size:25px}footer{margin-top:30px;font-size:12px}button{padding:12px}@media print{button{display:none}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${esc(company.name || 'Sales invoice')}</h1><p>${Object.entries(company).filter(([key])=>key!=='name').map(([key,value])=>esc(key)+': '+esc(value)).join('<br>')}</p><h2>Sales invoice ${esc(sale.id)}</h2><p>Date: ${esc(sale.saleDate)}<br>${esc(sale.buyer.name)} ${esc(sale.entrepreneurId)}<br>${esc(sale.buyer.phone)}<br>${esc(sale.buyer.address || '')}</p><table><thead><tr><th>Product / code</th><th>Qty</th><th>Base unit</th><th>Discount / unit</th><th>Final unit</th><th>Total</th></tr></thead><tbody>${sale.items.map(i=>`<tr><td>${esc(i.code)}<br>${esc(i.name)}</td><td>${i.qty}</td><td>${dsMoney(i.baseUnitPrice)}</td><td>${dsMoney(i.discountPerUnit)}</td><td>${dsMoney(i.finalUnitPrice)}</td><td>${dsMoney(i.lineTotal)}</td></tr>`).join('')}</tbody></table><p>Total payable: <b>${dsMoney(sale.total)}</b><br>Verified paid: ${dsMoney(sale.amountReceived)}<br>Refunded: ${dsMoney(sale.refundTotal)}<br>Balance due: ${dsMoney(sale.balance)}<br>Payment: ${esc(sale.paymentMethod)} / ${esc(sale.paymentStatus)}</p><footer>A sales invoice is separate from payment proof. Bank receipt submission does not confirm payment.</footer></body></html>`
}
export function printDirectInvoice(sale, company) {
  const frame = document.createElement('iframe')
  frame.title = 'Print sales invoice'
  Object.assign(frame.style, { position:'fixed', width:'1px', height:'1px', right:'0', bottom:'0', border:'0', opacity:'0', pointerEvents:'none' })
  frame.onload = () => {
    const target = frame.contentWindow
    if (!target) { frame.remove(); return }
    target.addEventListener('afterprint', () => frame.remove(), { once:true })
    target.focus(); target.print()
  }
  frame.srcdoc = directInvoiceHtml(sale, company)
  document.body.appendChild(frame)
}
// Raster pages retain Unicode customer/product names using the browser's fonts.
export async function directInvoicePdf(sale, company = {}) {
  company = sale.company || company
  await document.fonts.ready
  const pages = [], canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('PDF rendering is unavailable. Use Print / Save as PDF instead.')
  let y = 80
  const page = () => { if (y > 80) pages.push(canvas.toDataURL('image/jpeg', .94)); ctx.fillStyle='#fff'; ctx.fillRect(0,0,1240,1754); ctx.fillStyle='#15354d'; ctx.font='22px Arial'; y=80 }
  const line = (value,bold=false) => {
    let current=''; const words=String(value).split(/\s+/)
    const draw = () => { if(y>1650)page(); ctx.font=`${bold?'bold ':''}22px Arial`;ctx.fillText(current,80,y);y+=36 }
    ctx.font=`${bold?'bold ':''}22px Arial`
    for(const word of words){if(ctx.measureText(current+' '+word).width>1080 && current){draw();current=word}else current+=(current?' ':'')+word}draw()
  }
  page(); if(company.name)line(company.name,true)
  for(const [key,value] of Object.entries(company))if(key!=='name')line(`${key}: ${value}`)
  line(`SALES INVOICE ${sale.id}`,true);line(`Date: ${sale.saleDate}`);line(`Customer: ${sale.buyer.name} ${sale.entrepreneurId}`);line(`Phone: ${sale.buyer.phone}`)
  if(sale.buyer.address)line(sale.buyer.address); y+=20
  for(const i of sale.items){line(`${i.code} | ${i.name}`,true);line(`Qty ${i.qty} | Base ${dsMoney(i.baseUnitPrice)} | Discount/unit ${dsMoney(i.discountPerUnit)}`);line(`Final unit ${dsMoney(i.finalUnitPrice)} | Total ${dsMoney(i.lineTotal)}`);y+=12}
  for(const [key,value] of [['Total payable',sale.total],['Verified paid',sale.amountReceived],['Refunded',sale.refundTotal],['Balance due',sale.balance]])line(`${key}: ${dsMoney(value)}`,true)
  line(`Payment: ${sale.paymentMethod} | ${sale.paymentStatus}`);line('Sales invoice. Payment proof is a separate document.');pages.push(canvas.toDataURL('image/jpeg',.94))
  const enc=new TextEncoder(),objects=[],push=value=>objects.push(typeof value==='string'?enc.encode(value):value)
  const join=parts=>{const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length}return result}
  push('<< /Type /Catalog /Pages 2 0 R >>');push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`)
  pages.forEach((url,i)=>{const id=3+i*3,raw=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),content='q 595 0 0 842 0 0 cm /Im0 Do Q'
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`)
    push(join([enc.encode(`<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${raw.length} >>\nstream\n`),raw,enc.encode('\nendstream')]))
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  const parts=[enc.encode('%PDF-1.4\n')],offsets=[];let size=parts[0].length
  objects.forEach((obj,i)=>{offsets.push(size);const chunk=join([enc.encode(`${i+1} 0 obj\n`),obj,enc.encode('\nendobj\n')]);parts.push(chunk);size+=chunk.length})
  parts.push(enc.encode(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`))
  return new Blob(parts,{type:'application/pdf'})
}
export async function downloadDirectInvoice(sale,company){const blob=await directInvoicePdf(sale,company),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${sale.id}-invoice.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
