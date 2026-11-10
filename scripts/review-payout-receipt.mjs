import { spawn, execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const profile = await mkdtemp(path.join(tmpdir(), 'camy-browser-smoke-'))
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] })
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
    if(message.method==='Network.loadingFailed')errors.push(message.params.errorText);
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


try {
 const target=await send('Target.createTarget',{url:'about:blank'});sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8080/.artifacts/payout-receipt-review.html'});
 const until=async(expression,message)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(70)}throw Error(message)};
 await until("!!document.querySelector('.payout-form-v3')",'Payout form missing');
 const click=async text=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await pause(80)};
 await click('Use camera');await until("!!document.querySelector('video')?.videoWidth",'Camera not ready');
 await click('Capture photo');await until("!!document.querySelector('.camy-invoice-captured')",'Capture preview missing');
 await click('Retake');await click('Capture photo');await click('Use photo');
 check(await evaluate("!!document.querySelector('.camy-invoice-file-preview img')&&window.__done.length===0&&window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))"),'Capture auto saved or camera remained active');
 await evaluate("(()=>{const e=document.querySelector('.payout-form-v3 input:not([type=file])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'QA-CAMERA');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await pause(70);
 await evaluate("document.querySelector('.payout-form-v3').requestSubmit()");await until('window.__done.length===1','Camera payout did not save');
 check(await evaluate("window.__requests.find(r=>r.url.endsWith('/payout-upload')).data.mime==='image/jpeg'&&window.__requests.find(r=>r.url.endsWith('/payout')).data.reference==='QA-CAMERA'"),'Camera did not use shared upload/save flow');
 await evaluate('window.__done=[];window.__requests=[]');
 await click('Retake');await click('Cancel');
 await evaluate("window.__workingMedia=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}");
 await click('Use camera');await until("document.body.innerText.includes('Camera access is unavailable. Please upload the receipt instead.')",'Receipt camera fallback missing');await click('Close and upload receipt');await evaluate('navigator.mediaDevices.getUserMedia=window.__workingMedia');
 await evaluate("document.querySelector('[aria-label=\"Remove receipt attachment\"]').click()");await pause(80);
 for(const [type,name] of [['image/jpeg','WhatsApp photo (1).jpeg'],['image/png','receipt.png'],['image/webp','receipt.webp'],['application/pdf','large receipt.pdf']]){
 await evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(${type==='application/pdf'?'12*1024*1024':'100'})],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));const i=document.querySelector('input[type=file]');i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(90);
 check(await evaluate(`document.querySelector('.camy-invoice-file-preview').textContent.includes(${JSON.stringify(name)})&&!document.querySelector('.camy-invoice-attachment [role=alert]')`),'Supported receipt rejected');
 }
 await evaluate("(()=>{const e=document.querySelector('.payout-form-v3 input:not([type=file])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'QA-TXN');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await pause(70);
 await writeFile('.artifacts/payout-receipt-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await pause(100);
 check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');
 await writeFile('.artifacts/payout-receipt-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('.payout-form-v3').requestSubmit();document.querySelector('.payout-form-v3').requestSubmit()");
 await until('window.__done.length===1','Payout did not finish');
 check(await evaluate("window.__requests.filter(r=>r.url.endsWith('/payout')).length===1&&window.__requests.filter(r=>r.data.action==='chunk').length===48&&window.__requests.every(r=>JSON.stringify(r.data).length<400000)&&window.__done[0][0].payoutReference==='QA-TXN'&&window.__done[0][0].entrepreneurMargin===100"),'Chunk sizing, duplicate guard or payout values failed');
 console.log('PASS: receipt camera capture/retake/remove and track cleanup; supported file chooser; 12 MB PDF in 48 small requests; reference/amount preserved; duplicate submission guard; desktop/mobile layout.');
}finally{browser.kill();await pause(300);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
