import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const profile = await mkdtemp(path.join(tmpdir(), 'camy-browser-smoke-'))
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] })
let sessionId, next = 0
const pending = new Map(), errors = []
let buffer = ''
browser.stdio[4].on('data', chunk => {
  buffer += chunk.toString()
  let boundary
  while((boundary=buffer.indexOf('\0')) >= 0){
    const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+1);if(!frame)continue
    const message=JSON.parse(frame)
    if(message.id && pending.has(message.id)){
      const task=pending.get(message.id);pending.delete(message.id)
      if(message.error)task.reject(Error(message.error.message));else task.resolve(message.result)
    }
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text)
  }
})
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++next
  const timeout = setTimeout(() => { pending.delete(id); reject(Error(`Timeout: ${method}`)) }, 15000)
  pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject })
  browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId&&!method.startsWith('Browser.')&&!method.startsWith('Target.')?{sessionId}:{}) })+'\0')
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw Error(result.exceptionDetails.text + ': ' + (result.exceptionDetails.exception?.description || ''))
  return result.result.value
}
const check = (condition, message) => { if (!condition) throw Error(message) }
try {
  const target = await send('Target.createTarget', { url: 'about:blank' })
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId
  await send('Runtime.enable'); await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:8080/' })
  await pause(1200)
  await evaluate(`(async () => {
    const source = await (await fetch('/src/main.jsx')).text()
    const reactUrl = source.split('from "').map(part=>part.split('"')[0]).find(part=>part.includes('/react.js?'))
    const rootUrl = source.split('from "').map(part=>part.split('"')[0]).find(part=>part.includes('/react-dom_client.js?'))
    const React = (await import(reactUrl)).default
    const { createRoot } = (await import(rootUrl)).default
    const { AdminInventory } = await import('/src/AdminInventory.jsx')
    const { ProductCostEditor } = await import('/src/ProductCostEditor.jsx')
    const h = React.createElement
    const products = [
      { id:1, code:'MIX-1', name:'CAMY Mixer Grinder', category:'Home Appliances', image:'/products/classic-set.png', billingPrice:2000, deliveryCost:750, packagingCost:450, price:3200, freeDelivery:true, stock:10 },
      { id:2, code:'PAN-1', name:'Single Cookware', category:'Cookware', image:'/products/frypan-24.png', billingPrice:1500, deliveryCost:550, packagingCost:350, price:2400, freeDelivery:false, stock:5 }
    ]
    function Fixture() {
      const [product, setProduct] = React.useState(products[0])
      const [search, setSearch] = React.useState('')
      return h('div', { className:'admin-shell' },
        h(AdminInventory, { products, visible: products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())), categories:['Home Appliances','Cookware'], search, setSearch, openAdd:()=>{}, openAddCategory:()=>{}, openProduct:()=>{}, stock:()=>{}, togglePublished:()=>{}, manageCategory:()=>{}, exportProducts:()=>{} }),
        h('form', { id:'cost-fixture', style:{maxWidth:'700px',margin:'20px auto',padding:'16px'} }, h(ProductCostEditor, {product,onChange:setProduct})))
    }
    const fixture = document.createElement('div')
    document.body.replaceChildren(fixture)
    createRoot(fixture).render(h(Fixture))
  })()`)
  await pause(400)
  check(await evaluate("document.querySelector('.inventory-total').textContent.includes('3,200')"), 'Inventory total missing')
  check(await evaluate("document.querySelector('#cost-fixture output').textContent.includes('3,200')"), 'Manual cost editor total incorrect')
  await evaluate("(()=>{const input=document.querySelector('#cost-fixture .cost-inputs input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2100');input.dispatchEvent(new Event('input',{bubbles:true}));})()")
  await pause(150)
  check(await evaluate("document.querySelector('#cost-fixture output').textContent.includes('3,300')"), 'Manual price edit did not recalculate')
  await mkdir('artifacts', {recursive:true})
  await writeFile('artifacts/inventory-costs-desktop.png', Buffer.from((await send('Page.captureScreenshot', {format:'png'})).data,'base64'))
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
  await pause(150)
  check(await evaluate("document.documentElement.scrollWidth <= innerWidth"), 'Mobile inventory overflows viewport')
  await writeFile('artifacts/inventory-costs-mobile.png', Buffer.from((await send('Page.captureScreenshot', {format:'png'})).data,'base64'))
  check(!errors.length, errors.join('\n'))
  console.log('Inventory browser checks passed: desktop/mobile layout and live manual price calculation.')
} finally {
  browser.kill()
}
