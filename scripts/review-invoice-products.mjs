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

// Read existing records for QA. No login, API writes, or data seeding.
const phpCode=`require 'api/config.php';require 'api/marketplace.php';$s=market_state(database());$out=['orders'=>[],'products'=>$s['products'],'entrepreneurs'=>[],'settlements'=>[],'access'=>['finance'=>true,'credit'=>true]];foreach($s['orders'] as $o)$out['orders'][]=report_pick($o,['id','customer','phone','district','address','status','createdAt','date','deliveredAt','dispatchedAt','courier','trackingNumber','entrepreneurId','entrepreneur','orderMode','amount','camyCost','entrepreneurMargin','payoutStatus','payoutPaidAt','items','statusHistory','clientPaymentStatus']);foreach($s['entrepreneurs'] as $p)$out['entrepreneurs'][]=report_pick($p,['id','name','joined','sales','credit','used','stage']);echo json_encode($out,JSON_THROW_ON_ERROR);`;
const data=JSON.parse(execFileSync('D:/Software/Xammp/php/php.exe',['-r',phpCode],{encoding:'utf8'}));

try{
 const target=await send('Target.createTarget',{url:'about:blank'});sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Log.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__erpReviewData=${JSON.stringify(data)};`});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8080/.artifacts/invoice-products-review.html'});
 for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('.stock-product-card')"))break;await pause(100)}
 check(await evaluate("!!document.querySelector('.stock-product-card')"),'Catalogue did not render: '+errors.join('\n'));
 await evaluate("document.querySelector('.catalogue-card-quantity button:last-child').click()");await pause(60);
 check(await evaluate("document.querySelector('.catalogue-card-quantity input').value==='2'"),'Catalogue quantity failed');
 await evaluate("document.querySelector('.stock-product-actions .market-primary').click()");await pause(150);
 check(await evaluate("document.querySelector('.dropship-quantity input').value==='2'"),'Add to cart quantity failed');
 await evaluate("document.querySelector('.dropship-stepper button:last-child').click()");await pause(60);
 check(await evaluate("document.querySelector('.dropship-quantity input').value==='3'"),'Cart quantity failed');
 for(const width of [1440,1280,1100,800,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await pause(100);
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Horizontal overflow at '+width);
  check(await evaluate("document.querySelector('.stock-catalogue-title h2').getBoundingClientRect().top>=document.querySelector('.topbar-v2').getBoundingClientRect().bottom"),'Heading under header at '+width);
  check(await evaluate("[...document.querySelectorAll('.stock-product-actions')].every(row=>{const [a,b]=row.children;return Math.abs(a.getBoundingClientRect().top-b.getBoundingClientRect().top)<1&&Math.abs(a.getBoundingClientRect().height-b.getBoundingClientRect().height)<1})"),'Card button alignment at '+width);
  check(await evaluate("getComputedStyle(document.querySelector('.dropship-checkout')).position==='static'"),'Cart stuck at '+width);
  if(width===1440||width===390)await writeFile('.artifacts/products-updated-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 }
 await evaluate("document.querySelector('.mobile-order-cart').click()");await pause(120);
 check(await evaluate("document.querySelector('.dropship-checkout').getBoundingClientRect().width<=innerWidth"),'Mobile cart overflow');
 await evaluate(`(()=>{const input=document.querySelector('.customer-fields input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'QA Buyer');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);await pause(80);
 check(await evaluate("document.querySelector('.customer-fields input').value==='QA Buyer'"),'Client details input failed');
 await writeFile('.artifacts/cart-updated-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Invoice fixture').click();window.scrollTo(0,0)");await pause(100);
 const click=async text=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)}).click()`);await pause(100)};
 await click('Edit / replace invoice');
 const setReference=async value=>{await evaluate(`(()=>{const input=document.querySelector('.invoice-reference-field input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`);await pause(60)};
 await setReference('QA-CANCELLED');
 await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4 QA attachment'],'corrected.pdf',{type:'application/pdf'}));const input=document.querySelector('.camy-invoice-upload input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(50);
 check(await evaluate("document.querySelector('.camy-invoice-file-preview').textContent.includes('corrected.pdf')"),'Replacement selection missing');await click('Cancel');
 check(await evaluate("window.__invoiceWrites.length===0&&window.__invoiceOrder.invoiceNumber==='QA-ORIGINAL'"),'Cancel wrote changes');
 await click('Edit / replace invoice');await setReference('QA-CORRECTED');
 await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4 QA corrected'],'corrected.pdf',{type:'application/pdf'}));const input=document.querySelector('.camy-invoice-upload input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(50);await click('Update invoice');
 check(await evaluate("window.__invoiceWrites[0].invoice.startsWith('data:application/pdf;base64,')"),'Replacement document not submitted');
 check(await evaluate("window.__invoiceOrder.invoiceNumber==='QA-CORRECTED'&&document.body.textContent.includes('Invoice updated successfully.')"),'Invoice save failed');
 await click('Edit / replace invoice');await setReference('QA-FAILED');await evaluate('window.__failInvoice=true');await click('Update invoice');
 check(await evaluate("window.__invoiceOrder.invoiceNumber==='QA-CORRECTED'&&document.body.textContent.includes('Simulated save failure')"),'Failed save did not preserve invoice');
 await click('Cancel');await click('View invoice document');await pause(150);
 check(await evaluate("!!document.querySelector('.receipt-preview-dialog iframe')&&document.querySelector('.receipt-preview-dialog h2').textContent==='Invoice document'"),'Corrected document preview missing');
 check(errors.length===0,errors.join('\n'));
 console.log('PASS: widths 1440/1280/1100/800/390, no overflow/heading overlap, aligned card actions, catalogue and cart quantities, Add to Cart, client entry, mobile cart, invoice cancel/save/failure and corrected PDF preview. Invoice writes mocked.');
}finally{await send('Browser.close').catch(()=>{});browser.kill();await rm(profile,{recursive:true,force:true}).catch(()=>{})}
