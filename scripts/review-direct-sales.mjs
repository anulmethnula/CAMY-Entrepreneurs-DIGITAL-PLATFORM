import {randomBytes} from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const profile = await mkdtemp(path.join(tmpdir(), 'camy-browser-smoke-'))
const browser = spawn(chrome, ['--headless=new', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] })
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
    if(message.method==='Network.responseReceived'&&message.params.response.status>=400)errors.push(message.params.response.status+' '+message.params.response.url);
    if(message.method==='Network.loadingFailed'&&message.params.errorText!=='net::ERR_ABORTED')errors.push(message.params.errorText);
    if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);
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


const php='D:/Software/Xammp/php/php.exe',reviewDb='camy_ds_browser_'+randomBytes(6).toString('hex')
const root=await mkdtemp(path.join(path.resolve('.artifacts'),'ds-browser-')),env={...process.env,DB_NAME:reviewDb,CAMY_PRIVATE_PATH:path.join(root,'private'),CAMY_ENV:'development'}
const children=[];const log=[]
const run=(file,args)=>{const child=spawn(file,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>log.push(b.toString()));child.stderr.on('data',b=>log.push(b.toString()));children.push(child);return child}
try{
 execFileSync(php,['scripts/setup-direct-sales-review.php',reviewDb],{env,encoding:'utf8'})
 const config=path.join(root,'vite.config.mjs')
 await writeFile(config,`import base from '../../vite.config.js';export default {...base,server:{...base.server,host:'127.0.0.1',port:8082,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8002',changeOrigin:true}}}}`)
 run(php,['-S','127.0.0.1:8002','-t','api','api/index.php']);run(process.execPath,['node_modules/vite/bin/vite.js','--config',config])
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8082/.artifacts/direct-sales-review.html')).ok){ready=true;break}}catch{}await pause(100)}
 check(ready,'Test servers did not start: '+log.join(''))
 const target=await send('Target.createTarget',{url:'about:blank'});sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Log.enable')
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await send('Page.navigate',{url:'http://127.0.0.1:8082/.artifacts/direct-sales-review.html'})
 const until=async(expression,message)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw Error(message+'\n'+await evaluate('document.body.innerText.slice(0,1800)')+'\n'+errors.join('\n'))}
 await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='New Direct Sale'&&!b.disabled)",'Direct Sale button unavailable')
 const click=async text=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)throw Error('Button not found: '+${JSON.stringify(text)});b.click()})()`);await pause(100)}
 const field=async(label,value,index=0)=>{await evaluate(`(()=>{const labels=[...document.querySelectorAll('.ds-dialog .ds-field')].filter(l=>l.querySelector('span')?.textContent===${JSON.stringify(label)}),input=labels[${index}]?.querySelector('input,select,textarea');if(!input)throw Error('Field not found: '+${JSON.stringify(label)});const cls=input.tagName==='SELECT'?HTMLSelectElement:input.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(cls.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`);await pause(80)}
 await click('New Direct Sale');await until("!!document.querySelector('.ds-quick-layout')",'Inline sale page missing')
 await evaluate("window.__salePopups=0;window.open=()=>{window.__salePopups++;return null}")
 for(const width of [1440,1100,800,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await pause(80);check(await evaluate("document.querySelector('.ds-page').scrollWidth<=document.querySelector('.ds-page').clientWidth+1&&document.documentElement.scrollWidth<=innerWidth"),'Inline sale overflow at '+width);check(await evaluate("!document.querySelector('.ds-layer,.ds-steps,[role=dialog]')"),'Sale opened a popup or wizard')}
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await field('Find entrepreneur','E1');await evaluate("document.querySelector('.ds-picker button').click()");await pause(60)
 await field('Add product','QA-SET');await evaluate("document.querySelector('.ds-quick-results button').click()");await pause(60)
 await field('Add product','QA-MULTI');await evaluate("document.querySelector('.ds-quick-results button').click()");await pause(60)
 await field('Price','discount');await field('Base price','billing');await field('Quantity','2');await field('Discount','fixed');await field('Discount value','190');await field('Price reason','QA negotiated purchase')
 check(await evaluate("document.querySelector('.ds-line-total strong').textContent.includes('4,800.00')"),'Per-item discount preview incorrect')
 await writeFile('.artifacts/direct-sale-pricing-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))
 await field('Amount received','6000');await evaluate("document.querySelector('.ds-compact-payment .ds-check input').click()");await click('Save sale')
 await until("!!document.querySelector('.ds-detail')&&document.body.textContent.includes('Paid')",'Cash sale not created')
 const cashId=await evaluate("document.querySelector('.ds-dialog-header h2').textContent")
 check(await evaluate("document.body.textContent.includes('Rs. 5,850.00')"),'Unexpected total for two-product cash sale')
 await click('Record handover');await click('Save action');await until("document.querySelector('.ds-info-grid').textContent.includes('Handed Over')",'Stock handover failed')
 await click('Mark completed');await until("document.querySelector('.ds-info-grid').textContent.includes('Completed')",'Completion failed')
 const saved=await evaluate(`fetch('/api/admin/direct-sales/${cashId}',{credentials:'same-origin'}).then(r=>r.json()).then(r=>r.sale)`)
 check(saved.entrepreneurId==='E1'&&saved.qty===3&&saved.amountReceived===5850,'Saved cash sale incorrect')
 const state=await evaluate("fetch('/api/marketplace/state').then(r=>r.json())")
 check(state.products.find(p=>p.id===1).stock===18&&state.products.find(p=>p.id===2).stock===14,'Warehouse quantities incorrect')
 check(state.orders.length===0&&state.entrepreneurs.find(p=>p.id==='E1').sales===0,'Direct purchase polluted COD sales')
 // Export the actual invoice PDF and workbook from saved API records.
 const pdf=await evaluate(`(async()=>{const {directInvoicePdf}=await import('/src/directInvoice.js');const blob=await directInvoicePdf(${JSON.stringify(saved)},{name:'QA Invoice Company'});return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()).subarray(0,8)))})()`)
 check(atob(pdf).startsWith('%PDF-1.4'),'PDF output invalid')
 const pdfData=await evaluate(`(async()=>{const {directInvoicePdf}=await import('/src/directInvoice.js');const blob=await directInvoicePdf(${JSON.stringify(saved)},{});return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)})})()`);await writeFile('.artifacts/direct-sale-invoice-test.pdf',Buffer.from(pdfData.split(',')[1],'base64'))
 const workbook=await evaluate(`(async()=>{const {directSaleSheets}=await import('/src/directSalesModel.js');const {createWorkbook}=await import('/src/reports.js');const sheets=directSaleSheets([${JSON.stringify(saved)}]);return {names:sheets.map(s=>s.name),counts:sheets.map(s=>s.rows.length)}})()`)
 check(workbook.counts[0]===1&&workbook.counts[1]===2&&workbook.counts[2]===1,'Export sale totals duplicated across item lines')
 await evaluate("document.querySelector('[aria-label=\"Close sale details\"]').click()");await click('New Direct Sale');await click('Walk-in customer');await field('Customer name','QA Walk-in Buyer');await field('Phone','0712345678')
 await field('Add product','QA-AC');await evaluate("document.querySelector('.ds-quick-results button').click()");await pause(70);await field('Unit price','2300');await field('Price reason','QA special offer');await field('Payment method','bank');await field('Transfer amount','2300');await field('Transfer reference','QA-TXN-001')
 await click('Use camera');await until("!!document.querySelector('.camy-invoice-camera video')&& ![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Capture photo'))?.disabled",'Camera not ready')
 await click('Capture photo');await until("!!document.querySelector('.camy-invoice-captured')",'Captured preview missing');await click('Retake');await click('Capture photo');await click('Use photo')
 check(await evaluate("!!document.querySelector('.camy-invoice-file-preview img')"),'Camera receipt not selected')
 await click('Save sale');await until("!!document.querySelector('.ds-detail')&&document.querySelector('.ds-payment-record')?.textContent.includes('Verification Pending')",'Bank proof was not pending')
 const bankId=await evaluate("document.querySelector('.ds-dialog-header h2').textContent");await click('Payments')
 check(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Record handover').disabled"),'Unverified bank proof enabled stock release')
 await evaluate("document.querySelector('.ds-bank-review input[type=checkbox]').click()");await click('Verify bank payment');await until("document.querySelector('.ds-payment-record').textContent.includes('Verified')&&!document.querySelector('.ds-bank-review')",'Verification failed')
 await click('Record handover');await click('Save action');await until("document.querySelector('.ds-info-grid').textContent.includes('Handed Over')",'Bank sale handover failed')
 await click('Replace payment receipt');await field('Reason for correction (required)','QA corrected bank proof')
 await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4 QA corrected bank proof'],'corrected.pdf',{type:'application/pdf'}));const input=document.querySelector('.ds-action-form .camy-invoice-upload input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(80);await click('Save action');await until("document.querySelectorAll('.ds-receipt-version').length===2",'Receipt versions not preserved')
 await click('Refresh sale');check(await evaluate("document.querySelectorAll('.ds-receipt-version').length===2"),'Receipt versions lost after reload')
 const proof=await evaluate("fetch(document.querySelector('.ds-receipt-version:last-child a').href).then(async r=>({status:r.status,type:r.headers.get('Content-Type'),text:await r.text()}))")
 check(proof.status===200&&proof.type==='application/pdf'&&proof.text.startsWith('%PDF-'),'Secure corrected receipt unavailable')
 for(const width of [1440,800,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await pause(100);check(await evaluate("document.querySelector('.ds-dialog').scrollWidth<=document.querySelector('.ds-dialog').clientWidth+1"),'Detail overflow at '+width);if(width===390)await writeFile('.artifacts/direct-sale-detail-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))}
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('[aria-label=\"Close sale details\"]').click()");await click('reports fixture');await until("[...document.querySelectorAll('.erp-report-cards h2')].some(h=>h.textContent==='Direct Sales')",'Direct Sales report card missing')
 await evaluate("[...document.querySelectorAll('.erp-report-cards article')].find(a=>a.querySelector('h2').textContent==='Direct Sales').querySelector('button').click()");await pause(100)
 check(await evaluate("document.querySelector('.erp-report-table').textContent.includes('QA Walk-in Buyer')"),'Direct report rows missing')
 await click('profile fixture');await until("document.querySelector('.ds-profile-summary')?.textContent.includes('Rs. 5,850.00')",'Entrepreneur direct purchase history missing')
 check(await evaluate("document.querySelectorAll('.ds-profile tbody tr').length===1"),'Walk-in linked to entrepreneur profile')
 const receiptPath=proof.text?await evaluate(`fetch('/api/admin/direct-sales/${bankId}').then(r=>r.json()).then(r=>r.sale.payments[0].receipts.at(-1).receipt)`):''
 check((await fetch('http://127.0.0.1:8002'+receiptPath)).status===401,'Private receipt exposed without authentication')
 const denied=await evaluate(`(async()=>{const {api}=await import('/src/api.js');await api('/auth/logout',{method:'POST',body:'{}'});await api('/auth/login',{method:'POST',body:JSON.stringify({email:'qa-sales@example.invalid',password:'SalesTest!1234'})});return (await fetch(${JSON.stringify('PLACEHOLDER_RECEIPT')})).status})()`.replace(JSON.stringify('PLACEHOLDER_RECEIPT'),JSON.stringify(receiptPath)))
 check(denied===403,'Sales-only staff could read a private bank receipt')

 check(await evaluate('window.__salePopups===0'),'Direct Sales opened a new browser window')
 const realErrors=errors.filter(e=>!e.includes('net::ERR_ABORTED')&&!e.includes('403 ')&&!e.includes('403 (Forbidden)'));check(realErrors.length===0,realErrors.join('\n'))
 console.log('PASS: real HTTP login, order integration, two-product discounted entrepreneur cash sale, stock handover, bank camera capture/retake, pending proof, Finance verification, receipt correction/reload/download, profile separation, reports, PDF bytes, export row grains and responsive 1440/1100/800/390 inline UI with no wizard or popups. Temporary database only.')
}catch(error){console.log('BROWSER FAILURE STATE',await evaluate('document.body.innerText.slice(-8000)'));await writeFile('.artifacts/direct-sale-browser-failure.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));throw error}finally{
 await send('Browser.close').catch(()=>{});browser.kill()
 for(const child of children)child.kill()
 await pause(300)
 execFileSync(php,['scripts/setup-direct-sales-review.php',reviewDb,'cleanup'],{env,encoding:'utf8'})
 if(root.startsWith(path.resolve('.artifacts')+path.sep))await rm(root,{recursive:true,force:true,maxRetries:5}).catch(()=>{})
 if(profile.startsWith(path.join(tmpdir(),'camy-browser-smoke-')))await rm(profile,{recursive:true,force:true,maxRetries:5}).catch(()=>{})
}
