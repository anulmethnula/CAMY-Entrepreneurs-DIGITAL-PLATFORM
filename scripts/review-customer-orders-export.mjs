import ExcelJS from 'exceljs'
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
const phpCode=`require 'api/config.php';require 'api/marketplace.php';$s=market_state(database());$out=['orders'=>[],'products'=>$s['products'],'entrepreneurs'=>[],'settlements'=>[],'access'=>['finance'=>true,'credit'=>true]];foreach($s['orders'] as $o)$out['orders'][]=report_pick($o,['id','customer','phone','phone2','qty','source','createdBy','payoutDueAt','payoutReference','district','address','status','createdAt','date','deliveredAt','dispatchedAt','courier','trackingNumber','entrepreneurId','entrepreneur','orderMode','amount','camyCost','entrepreneurMargin','payoutStatus','payoutPaidAt','items','statusHistory','clientPaymentStatus']);foreach($s['entrepreneurs'] as $p)$out['entrepreneurs'][]=report_pick($p,['id','name','joined','sales','credit','used','stage']);echo json_encode($out,JSON_THROW_ON_ERROR);`;
const data=JSON.parse(execFileSync('D:/Software/Xammp/php/php.exe',['-r',phpCode],{encoding:'utf8'}));
try{
 const target=await send('Target.createTarget',{url:'about:blank'});sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Log.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__erpReviewData=${JSON.stringify(data)};`});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8080/.artifacts/erp-review.html'});
 for(let i=0;i<100;i++){if(await evaluate("!![...document.querySelectorAll('nav>button')].find(b=>b.textContent==='orders')"))break;await pause(100)}
 await evaluate("[...document.querySelectorAll('nav>button')].find(b=>b.textContent==='orders').click()");await pause(120);
 check(await evaluate("!!document.querySelector('#admin-order-search')"),'Order directory did not load');
 await evaluate("URL.createObjectURL=blob=>{window.__capturedWorkbook=blob;return 'blob:qa-export'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};");
 const exportAndCompare=async description=>{
  const ids=await evaluate("[...document.querySelectorAll('.order-row .order-id-cell strong')].map(e=>e.textContent)");
  await evaluate("window.__capturedWorkbook=null;[...document.querySelectorAll('button')].find(b=>b.textContent==='Download Excel').click()");
  const bytes=await evaluate("window.__capturedWorkbook.arrayBuffer().then(buffer=>Array.from(new Uint8Array(buffer)))");
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(Uint8Array.from(bytes));
  const sheet=wb.getWorksheet('Order Summary'),exported=[];for(let row=5;row<=sheet.rowCount;row++)exported.push(sheet.getCell(row,1).value);
  check(JSON.stringify(ids)===JSON.stringify(exported),description+': exported IDs differ from visible directory');
  const expectedLines=data.orders.filter(o=>ids.includes(o.id)).reduce((n,o)=>n+(o.items||[]).length,0);
  check(wb.getWorksheet('Order Items').rowCount-4===expectedLines,description+': item rows differ');
  check(wb.worksheets.every(s=>s.views[0].state==='frozen'&&s.autoFilter),description+': frozen headers/filter missing');
  console.log('PASS:',description,'directory and workbook match ('+ids.length+' orders).');
 };
 const reset=async()=>{await evaluate("document.querySelector('.order-filter-heading .clear-order-filters').click()");await pause(50)};
 const status=async value=>{await evaluate(`(()=>{const e=document.querySelector('[aria-label="Filter by order status"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(50)};
 const input=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await pause(50)};
 await exportAndCompare('All orders');
 for(const value of ['Delivered','Processing','Returned','Cancelled']){await reset();await status(value);await exportAndCompare(value+' only')}
 for(const text of ['Today','Last 7 days','This month']){await reset();await evaluate(`[...document.querySelectorAll('.date-quick-filters button')].find(b=>b.textContent===${JSON.stringify(text)}).click()`);await pause(50);await exportAndCompare(text)}
 await reset();const first=data.orders[0];const day=first.date||first.createdAt.slice(0,10);
 await input('[aria-label="Orders from date"]',day);await input('[aria-label="Orders to date"]',day);await exportAndCompare('Custom range');
 await reset();await input('#admin-order-search',first.id);await exportAndCompare('Search');
 await status(first.status);await input('[aria-label="Orders from date"]',day);await input('[aria-label="Orders to date"]',day);await exportAndCompare('Search + status + date');
 await reset();
 for(const width of [1440,1100,800,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<500});await pause(80);check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Directory overflow at '+width)}
 check(errors.length===0,errors.join('\n'));
 console.log('PASS: actual Customer Orders download button, filter combinations, exact visible IDs and product rows, responsive directory and no browser exceptions.');
}finally{await send('Browser.close').catch(()=>{});browser.kill();await rm(profile,{recursive:true,force:true}).catch(()=>{})}
