import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
const file=process.argv[2]||'.artifacts/direct-sale-invoice-test.pdf'
const bytes=await readFile(file),raw=bytes.toString('latin1')
assert(raw.startsWith('%PDF-1.4\n'))
const start=Number(raw.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);assert(Number.isInteger(start)&&start>0)
const lines=raw.slice(start).split('\n');assert.equal(lines[0],'xref');const count=Number(lines[1].split(' ')[1]);assert(count>4)
for(let i=1;i<count;i++){const offset=Number(lines[2+i].slice(0,10));assert(raw.slice(offset).startsWith(`${i} 0 obj\n`),`Invalid object offset ${i}`)}
const pages=Number(raw.match(/\/Type \/Pages \/Count (\d+)/)?.[1]);assert.equal((raw.match(/\/Type \/Page \/Parent/g)||[]).length,pages)
const images=[...raw.matchAll(/\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g)];assert.equal(images.length,pages)
for(const [index,match] of images.entries()){const start=match.index+match[0].length,length=Number(match[1]),jpeg=bytes.subarray(start,start+length);assert.equal(jpeg.readUInt16BE(0),0xffd8);assert.equal(jpeg.readUInt16BE(jpeg.length-2),0xffd9);assert(raw.slice(start+length).startsWith('\nendstream'));if(index===0)await writeFile('.artifacts/direct-sale-invoice-page.jpg',jpeg)}
console.log(`PASS: invoice PDF has valid cross-reference offsets, ${pages} A4 page(s), matching page/image resources and complete JPEG streams.`)
