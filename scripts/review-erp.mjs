import { spawn, execFileSync } from 'node:child_process'
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

// Read existing records for QA. No login, API writes, or data seeding.
const phpCode=`require 'api/config.php';require 'api/marketplace.php';$s=market_state(database());$out=['orders'=>[],'products'=>$s['products'],'entrepreneurs'=>[],'settlements'=>[],'access'=>['finance'=>true,'credit'=>true]];foreach($s['orders'] as $o)$out['orders'][]=report_pick($o,['id','customer','phone','district','address','status','createdAt','date','deliveredAt','dispatchedAt','courier','trackingNumber','entrepreneurId','entrepreneur','orderMode','amount','camyCost','entrepreneurMargin','payoutStatus','payoutPaidAt','items','statusHistory','clientPaymentStatus']);foreach($s['entrepreneurs'] as $p)$out['entrepreneurs'][]=report_pick($p,['id','name','joined','sales','credit','used','stage']);echo json_encode($out,JSON_THROW_ON_ERROR);`;
const data=JSON.parse(execFileSync('D:/Software/Xammp/php/php.exe',['-r',phpCode],{encoding:'utf8'}));
try{
 const target=await send('Target.createTarget',{url:'about:blank'});sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Log.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__erpReviewData=${JSON.stringify(data)};`});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8080/.artifacts/erp-review.html'});
 for(let i=0;i<200;i++){if(await evaluate("document.querySelectorAll('.erp-report-cards article').length===7"))break;await pause(100)}
 if(!await evaluate("document.querySelectorAll('.erp-report-cards article').length===7"))console.log('Browser diagnostics',errors,await evaluate('JSON.stringify({body:document.body.innerText.slice(0,1500),url:location.href,state:document.readyState,scripts:[...document.scripts].map(s=>s.src)})'));
 check(await evaluate("document.querySelectorAll('.erp-report-cards article').length===7"),'Seven report cards missing');
 await evaluate("document.querySelector('.erp-report-cards article:nth-child(2) button').click()");await pause(100);
 check(await evaluate("document.querySelector('.erp-report-heading h1').textContent==='Pending Commission Payouts'"),'Report view failed');
 check(await evaluate("!!document.querySelector('.erp-report-filters input[type=date]')"),'Date filters missing');
 await writeFile('.artifacts/reports-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 for(const width of [1440,1100,800,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await pause(100);
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Report overflow at '+width);
 }
 await writeFile('.artifacts/reports-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("[...document.querySelectorAll('nav>button')].find(b=>b.textContent==='catalogue').click()");await pause(150);
 check(await evaluate("document.querySelectorAll('.stock-product-card').length>0"),'Catalogue missing');
 for(const width of [1440,1100,800,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await pause(100);
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Catalogue overflow at '+width);
  if(width===1440)await writeFile('.artifacts/catalogue-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await evaluate("document.querySelector('.stock-details').click()");await pause(150);
 check(await evaluate("!!document.querySelector('.erp-catalogue-detail')"),'Product modal missing');
 check(await evaluate("document.querySelector('.erp-catalogue-detail>article').getBoundingClientRect().width<=innerWidth"),'Product modal overflow');
 await evaluate("document.querySelector('.erp-image-open').click()");await pause(100);
 check(await evaluate("!!document.querySelector('.erp-lightbox')"),'Zoom lightbox missing');
 await evaluate("document.querySelector('[aria-label=\"Zoom in\"]').click()");
 check(await evaluate("document.querySelector('.erp-lightbox-image img').style.width==='125%'"),'Zoom control failed');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await pause(80);
 check(await evaluate("!document.querySelector('.erp-lightbox')&&!!document.querySelector('.erp-catalogue-detail')"),'Escape closed wrong dialog');
 await writeFile('.artifacts/product-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await pause(80);
 check(await evaluate("!document.querySelector('.erp-catalogue-detail')"),'Product dialog did not close');
 await evaluate("[...document.querySelectorAll('nav>button')].find(b=>b.textContent==='fulfilment').click()");await pause(120);
 check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Tracking overflow');

 await evaluate("window.__reviewSetStatus('Dispatched')");await pause(80);
 check(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit Shipment Details')"),'Dispatched edit missing');
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Edit Shipment Details').click()");await pause(50);
 check(await evaluate("document.querySelectorAll('.erp-shipment-form input').length===2"),'Shipment editor missing');
 await evaluate("[...document.querySelectorAll('.workflow-actions button')].find(b=>b.textContent==='Cancel').click()");await pause(50);
 check(await evaluate("!document.querySelector('.erp-shipment-form')"),'Cancel left shipment editor open');
 await evaluate("window.__reviewSetStatus('Delivered')");await pause(60);
 check(await evaluate("![...document.querySelectorAll('button')].some(b=>b.textContent==='Edit Shipment Details')"),'Delivered edit visible');
 await writeFile('.artifacts/fulfilment-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await pause(60);
 await writeFile('.artifacts/fulfilment-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const originalBytes=await evaluate(`(async()=>{
  const {downloadProductImage}=await import('/src/ProductMedia.jsx');
  const realCreate=URL.createObjectURL,realRevoke=URL.revokeObjectURL,realClick=HTMLAnchorElement.prototype.click;
  let captured;URL.createObjectURL=blob=>{captured=blob;return 'blob:qa-capture'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};
  try{for(const src of ['/products/ac-12000.png','/products/mini-fridge.jpeg']){
   const before=new Uint8Array(await (await fetch(src)).arrayBuffer());await downloadProductImage({id:'read-only',image:src});
   const after=new Uint8Array(await captured.arrayBuffer());if(before.length!==after.length||before.some((v,i)=>v!==after[i]))return false;
  }return true}finally{URL.createObjectURL=realCreate;URL.revokeObjectURL=realRevoke;HTMLAnchorElement.prototype.click=realClick}
 })()`);
 check(originalBytes,'Original PNG/JPEG download changed bytes');
 check(errors.length===0,errors.join('\n'));
 console.log('PASS: real-data reports/cards/preview, responsive widths 1440/1100/800/390, catalogue, product modal, zoom, nested Escape, tracking layout, and no runtime exceptions.');
}finally{await send('Browser.close').catch(()=>{});browser.kill();await rm(profile,{recursive:true,force:true}).catch(()=>{})}
