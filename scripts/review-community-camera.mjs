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
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Log.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8080/.artifacts/community-camera-review.html'});
 const until=async(expression,message)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(60)}throw Error(message)};
 await until("!!document.querySelector('.camy-community-banner')",'Home community missing');
 check(await evaluate("document.querySelector('.home-essential-stats').nextElementSibling.classList.contains('camy-community-banner')"),'Banner not immediately after existing KPIs');
 check(await evaluate("document.querySelectorAll('.home-essential-stats>button').length===4&&!!document.querySelector('.home-welcome')&&!!document.querySelector('.home-destinations')"),'Existing home sections changed');
 const verifyJoin=async()=>{
  check(await evaluate("!document.body.innerText.includes('chat.whatsapp.com')"),'Raw community URL displayed');
  await evaluate("document.querySelector('.camy-community-join').click()");
  check(await evaluate("JSON.stringify(window.__openedCommunity.at(-1))===JSON.stringify(['https://chat.whatsapp.com/JH4pur7k4QN3YbWFv7GZY3','_blank','noopener,noreferrer'])"),'Community target or isolation wrong');
 };
 await verifyJoin();
 await writeFile('.artifacts/community-home-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const nav=async name=>{await evaluate(`[...document.querySelectorAll('nav>button')].find(b=>b.textContent===${JSON.stringify(name)}).click()`);await pause(70)};
 for(const view of ['home','profile','invoice']){
  await nav(view);
  if(view==='profile'){check(await evaluate("document.querySelector('.camy-profile-support-number').textContent==='+94 77 716 5336'&&!!document.querySelector('.camy-community-profile')"),'Profile support/community missing');await verifyJoin()}
  for(const width of [1440,1024,768,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await pause(60);check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Overflow '+view+' '+width)}
  if(view==='profile')await writeFile('.artifacts/community-profile-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await evaluate(`window.__cameraStreams=[];window.__cameraMode='ok';window.__originalMedia=navigator.mediaDevices;window.__originalGetMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{if(window.__cameraMode==='denied')throw new DOMException('Permission denied','NotAllowedError');if(window.__cameraMode==='missing')throw new DOMException('No camera','NotFoundError');const stream=await window.__originalGetMedia(options);window.__cameraStreams.push(stream);if(window.__cameraMode==='delayed')return new Promise(resolve=>window.__releaseCamera=()=>resolve(stream));return stream;};window.__createdUrls=[];window.__revokedUrls=[];const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);window.__createdUrls.push(url);return url};URL.revokeObjectURL=url=>{window.__revokedUrls.push(url);revoke(url)};`);
 const click=async text=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await pause(70)};
 const ended="window.__cameraStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))";
 await click('Use camera');await until("!!document.querySelector('.camy-invoice-camera video')?.videoWidth",'Camera preview unavailable');
 await click('Capture photo');await until("!!document.querySelector('.camy-invoice-captured')",'Captured photo preview missing');
 check(await evaluate('window.__invoiceSubmissions.length===0'),'Photo capture auto-submitted');
 await click('Retake');check(await evaluate("!document.querySelector('.camy-invoice-captured')&&!document.querySelector('.camy-invoice-camera video').hidden"),'Retake did not return to camera');
 await click('Capture photo');await until("!!document.querySelector('.camy-invoice-captured')",'Retake capture failed');
 await click('Use photo');await until("!document.querySelector('.camy-invoice-camera-layer')&&!!document.querySelector('.camy-invoice-file-preview img')",'Photo not attached');
 check(await evaluate(ended),'Camera remained active after accepting photo');
 check(await evaluate('window.__invoiceSubmissions.length===0'),'Use photo auto-submitted');
 await writeFile('.artifacts/invoice-photo-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("(()=>{const e=document.querySelector('.invoice-reference-field input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'QA-INVOICE-REFERENCE');e.dispatchEvent(new Event('input',{bubbles:true}))})()");await pause(60);
 await click('Submit invoice');await until('window.__invoiceSubmissions.length===1','Existing invoice submission not used');
 check(await evaluate("window.__invoiceSubmissions[0].url==='/api/marketplace/orders/QA-INVOICE/invoice'&&window.__invoiceSubmissions[0].payload.invoiceNumber==='QA-INVOICE-REFERENCE'&&window.__invoiceSubmissions[0].payload.invoice.startsWith('data:image/jpeg;base64,')"),'Invoice payload or reference changed');
 const upload=async(type,name,large=false)=>{await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([${large?"'%PDF-1.4\\n',new Uint8Array(12*1024*1024)":"'invoice QA bytes'"}],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));const input=document.querySelector('.camy-invoice-upload input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(80)};
 await upload('application/pdf','large-invoice.pdf',true);
 check(await evaluate("document.querySelector('.camy-invoice-file-preview').textContent.includes('large-invoice.pdf')&&document.querySelector('.camy-invoice-file-preview').textContent.includes('PDF document')&&!document.querySelector('.camy-invoice-attachment .market-error')"),'Large PDF rejected or not previewed');
 check(await evaluate("!/maximum|max\\s*\\d|\\d\\s*mb/i.test(document.querySelector('.invoice-admin-form').textContent)"),'Invoice UI exposes artificial size restriction');
 await upload('text/plain','not-an-invoice.txt');check(await evaluate("!!document.querySelector('.camy-invoice-attachment [role=alert]')"),'Unsupported file type not rejected');
 await evaluate("document.querySelector('[aria-label=\"Remove invoice attachment\"]').click()");await pause(60);check(await evaluate("!document.querySelector('.camy-invoice-file-preview')"),'Remove attachment failed');
 await evaluate("(()=>{const input=document.querySelector('.camy-invoice-upload input');const dt=new DataTransfer();const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;canvas.toBlob(blob=>{dt.items.add(new File([blob],'replacement.webp',{type:'image/webp'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))},'image/webp')})()");
 await until("!!document.querySelector('.camy-invoice-file-preview img')",'Replacement image preview missing');
 await click('Use camera');await until("!!document.querySelector('.camy-invoice-camera video')?.videoWidth",'Second camera did not start');await evaluate("document.querySelector('[aria-label=\"Close invoice camera\"]').click()");await until(ended,'Camera close leaked stream');
 for(const mode of ['denied','missing']){await evaluate(`window.__cameraMode=${JSON.stringify(mode)}`);await click('Use camera');await until("document.querySelector('.camy-invoice-camera [role=alert]')?.textContent==='Camera access is unavailable. Please upload the invoice instead.'",'Camera failure not handled: '+mode);await click('Close and upload document')}
 await evaluate("Object.defineProperty(navigator,'mediaDevices',{value:undefined,configurable:true})");await click('Use camera');await until("!!document.querySelector('.camy-invoice-camera [role=alert]')",'Unsupported browser not handled');await click('Close and upload document');await evaluate("Object.defineProperty(navigator,'mediaDevices',{value:window.__originalMedia,configurable:true});window.__cameraMode='delayed'");
 await click('Use camera');await until("typeof window.__releaseCamera==='function'",'Delayed stream not acquired');await evaluate("document.querySelector('[aria-label=\"Close invoice camera\"]').click();window.__releaseCamera()");await until(ended,'Late camera permission leaked stream');
 await evaluate("window.__cameraMode='ok'");await click('Use camera');await until("!!document.querySelector('.camy-invoice-camera video')?.videoWidth",'Unmount test camera unavailable');await nav('home');await until(ended,'Unmount leaked camera stream');
 await until('window.__createdUrls.every(url=>window.__revokedUrls.includes(url))','Preview object URL leaked');
 check(errors.length===0,errors.join('\n'));
 console.log('PASS: both WhatsApp links/placement/no visible URL, unchanged home sections, desktop/tablet/mobile fit; webcam capture/retake/review/attach, explicit existing submission, large PDF, file type errors, replacement/removal, permission/no-device/unsupported fallback, close/unmount/late-permission cleanup and object URL cleanup.');
} finally {await send('Browser.close').catch(()=>{});browser.kill();await rm(profile,{recursive:true,force:true}).catch(()=>{})}
