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



const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','8086'],{windowsHide:true,stdio:'ignore'});
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8086/.artifacts/sales-directory-review.html')).ok)break}catch{}await pause(100)}
 const target=await send('Target.createTarget',{url:'about:blank'});sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:8086/.artifacts/sales-directory-review.html'});
 const until=async(expression,message)=>{for(let i=0;i<80;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(100)}throw Error(message+' '+await evaluate('document.body.innerText.slice(-3000)'))};
 const count=()=>evaluate("document.querySelectorAll('.sales-directory-table tbody tr').length");
 const select=async(label,value)=>{await evaluate(`(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(100)};
 const input=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await pause(100)};
 await until("document.querySelectorAll('.sales-directory-table tbody tr').length===3",'Mixed sales missing');check(await evaluate('document.querySelectorAll("table").length===1'),'More than one sales table');
 await evaluate(`document.querySelector('[aria-label="Manage CMY-1005"]').click()`);check(await evaluate('window.__codOpened===true'),'COD Manage did not open the original workflow');check(await evaluate("[...document.querySelectorAll('[data-sale-kind=cod]')].every(row=>!row.textContent.includes('Awaiting Payment'))"),'COD incorrectly uses direct-sale payment statuses');check(await evaluate("document.querySelector('[data-sale-kind=direct]').textContent.includes('Paid')&&!document.querySelector('[data-sale-kind=direct]').textContent.includes('Handed Over')"),'Direct sale status is not simplified');check(await evaluate("document.querySelector('[aria-label=\"Manage CMY-1005\"]').closest('tr').textContent.includes('Awaiting approval')"),'Pending COD must show awaiting approval');
 await pause(1000);await mkdir('.artifacts/sales-directory-review',{recursive:true});await writeFile('.artifacts/sales-directory-review/desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
 for(const width of [1160,900]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await pause(150);check(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'Page overflow at '+width);check(await evaluate("[...document.querySelectorAll('.sales-row-actions')].every(e=>e.getBoundingClientRect().right>=e.lastElementChild.getBoundingClientRect().right-1)"),'Actions overflow at '+width);check(await evaluate("[...document.querySelectorAll('.sales-id')].every(e=>e.scrollWidth<=e.clientWidth+1)"),'Sale ID clipped at '+width)}await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await select('Sale type','direct');check(await count()===1,'Direct filter failed');await select('Sale type','all');await select('Payment method','cash');check(await count()===1,'Cash filter failed');await select('Payment method','');await select('Fulfilment status','Pending');check(await count()===1,'Status filter failed');await select('Fulfilment status','All');await input('#admin-order-search','Water Filter');check(await count()===1,'Search failed');await input('#admin-order-search','');
 await evaluate(`document.querySelector('[aria-label="Edit DS-94545727EBD457"]').click()`);await until("document.querySelector('.sale-correction input[type=date]')",'Edit form missing');check(await evaluate('document.querySelector(".sale-correction").textContent.includes("Recorded payments")'),'Payment correction missing');await pause(500);await writeFile('.artifacts/sales-directory-review/edit.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
 await input('.sale-edit-items input[type=number]','2');await input('.sale-payment-edit input[type=number]','40040');await evaluate("(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Correct quantity mistake');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await pause(100);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save correction').click()");await until("document.querySelector('.sales-directory-table')",'Return from edit failed');check(await evaluate("window.__correctionMethod==='PATCH'&&window.__correctionPayload.items[0].qty==='2'&&window.__correctionPayload.payments[0].amount==='40040'&&window.__correctionPayload.token==='fixture-token'"),'Edit payload incorrect');
 await evaluate(`document.querySelector('[aria-label="Delete DS-94545727EBD457"]').click()`);await until("document.querySelector('.sale-delete-warning input')",'Delete confirmation missing');check(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Permanently delete sale').disabled"),'Delete must require confirmation');await input('.sale-delete-warning input','DS-94545727EBD457');await evaluate("(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Duplicate recording');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await pause(100);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Permanently delete sale').click()");await until("document.querySelectorAll('.sales-directory-table tbody tr').length===2",'Delete did not refresh table');check(await evaluate("window.__correctionMethod==='DELETE'&&window.__correctionPayload.confirmId==='DS-94545727EBD457'"),'Delete payload incorrect');
 await evaluate("document.querySelector('#viewer-toggle').click()");await pause(150);check(await evaluate("!document.querySelector('[aria-label^=Edit]')&&!document.querySelector('[aria-label^=Delete]')"),'Viewer has correction actions');
 check(await evaluate("!!document.querySelector('[aria-label=\"View CMY-1005\"]')&&!document.querySelector('[aria-label^=Manage]')"),'Viewer must have View rather than Manage');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await writeFile('.artifacts/sales-directory-review/mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'Mobile page overflows');
 check(errors.length===0,errors.join('\n'));console.log('PASS: one mixed sales table, filtering/search, edit form, guarded DELETE and refresh, viewer actions hidden, desktop and mobile screenshots; no browser errors.');
} finally {await send('Browser.close').catch(()=>{});browser.kill();child.kill();await pause(250);if(profile.startsWith(path.join(tmpdir(),'camy-browser-smoke-')))await rm(profile,{recursive:true,force:true,maxRetries:4}).catch(()=>{});}
