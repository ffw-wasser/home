// Synthetic responses only; the official PDF request is intercepted, never downloaded.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const {PDFDocument,rgb}=require('../js/vendor/pdf-lib.min.js');
(async()=>{const doc=await PDFDocument.create();for(let n=1;n<=3;n++){const page=doc.addPage([595,842]);page.drawText('FwDV Beispiel - Seite '+n,{x:50,y:760,size:22});page.drawRectangle({x:50,y:180,width:480,height:450,color:rgb(.15*n,.2,.3)});}const pdf=Array.from(await doc.save());const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const width of [320,390,768]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});const pdfRequests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});if(u.origin==='https://www.lfs-bw.de'){pdfRequests.push(route.request());return route.fulfill({body:'Synthetic PDF placeholder',contentType:'text/plain'});}return route.abort();});
  await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
  await page.evaluate(pdf=>{window.pdfCalls=[];H2OPortal.api=async(path,data)=>{if(path==='regulations/pdf'){pdfCalls.push(data);if(window.pdfFailure)throw Error('Beispiel: offline');return new Uint8Array(pdf);}return {items:RegulationsModel.defaults(),version:0};};DeckelMobile.show(true);DeckelMobile.jump('deckel-more');},pdf);
  const tile=page.locator('[data-portal-tile="more-regulations"]');assert.equal(await tile.locator('.portal-more-icon').innerText(),'§');await tile.click();await page.getByText('Quelle: Landesfeuerwehrschule Baden-Württemberg.',{exact:false}).waitFor();
  assert.equal(await page.locator('#regulations-list .regulation-card').count(),6);assert.equal(pdfRequests.length,0,'catalogue does not contact the PDF provider');
  await page.locator('#regulations-search').fill('atemSCHUTZ');assert.equal(await page.locator('#regulations-list .regulation-card').count(),1);await page.locator('#regulations-list h3').filter({hasText:'Atemschutz'}).waitFor();
  await page.locator('#regulations-search').fill('FwDV 3');assert.equal(await page.locator('#regulations-list .regulation-card').count(),1);
  await page.locator('#regulations-search').fill('nichtvorhanden');await page.getByText('Keine passende Dienstvorschrift gefunden.',{exact:false}).waitFor();assert.equal(await page.locator('#regulations-list .regulation-card').count(),0);
  await page.locator('#regulations-search').fill('');assert.equal(await page.locator('#regulations-list .regulation-card').count(),6);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('deckel-main').scrollWidth<=innerWidth),true);
  await page.locator('#regulations-search').fill('FwDV 3');
  await page.locator('#regulations-list button').first().click();await page.locator('#regulations-book-map canvas').waitFor();
  assert.equal(await page.locator('#regulations-reader').evaluate(n=>n.open),true);assert.equal(await page.locator('#regulations-page').inputValue(),'1');assert.equal(await page.locator('#regulations-prev').isDisabled(),true);
  await page.locator('#regulations-next').click();await page.waitForFunction(()=>document.getElementById('regulations-page').value==='2');
  await page.locator('#regulations-next').click();await page.waitForFunction(()=>document.getElementById('regulations-page').value==='3');assert.equal(await page.locator('#regulations-next').isDisabled(),true);
  await page.locator('#regulations-page').fill('1');await page.locator('#regulations-page').press('Tab');await page.waitForFunction(()=>document.getElementById('regulations-page').value==='1');
  await page.locator('#regulations-zoom-in').click();await page.waitForFunction(()=>Number(document.getElementById('regulations-book-map').dataset.zoom)>1.4);
  if(width===390){
   const map=page.locator('#regulations-book-map'),r=await map.boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,cdp=await page.context().newCDPSession(page);
   const touch=(type,half)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:cx-half,y:cy,id:1},{x:cx+half,y:cy,id:2}]});
   await touch('touchStart',20);await touch('touchMove',65);await touch('touchEnd',0);await page.waitForFunction(()=>Number(document.getElementById('regulations-book-map').dataset.zoom)>3);
   assert.equal(await page.locator('#regulations-page').inputValue(),'1','pinch never flips the page');
   const before=await map.evaluate(h=>h._planRendered?.x);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+35,y:cy+20,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(before=>document.getElementById('regulations-book-map')._planRendered?.x!==before,before);assert.equal(await page.locator('#regulations-page').inputValue(),'1','zoomed pan never flips the page');
   await page.locator('#regulations-zoom-fit').click();await page.waitForFunction(()=>Number(document.getElementById('regulations-book-map').dataset.zoom)===1);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx+70,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-70,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>document.getElementById('regulations-page').value==='2');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(pdfRequests.length,0,'original provider receives no direct browser requests');
  await page.locator('#regulations-back').click();assert.equal(await page.locator('#regulations-book-map canvas').count(),0);assert.equal(await page.locator('#regulations-search').inputValue(),'FwDV 3');
  await page.locator('#regulations-list button').first().click();await page.locator('#regulations-book-map canvas').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('regulations-reader').hidden);assert.equal(await page.locator('#regulations-book-map canvas').count(),0);
  await page.evaluate(()=>window.pdfFailure=true);await page.locator('#regulations-list button').first().click();await page.locator('#regulations-retry').waitFor();assert.equal(await page.locator('#regulations-original').getAttribute('referrerpolicy'),'no-referrer');await page.evaluate(()=>window.pdfFailure=false);await page.locator('#regulations-retry').click();await page.locator('#regulations-book-map canvas').waitFor();
  await page.evaluate(()=>DeckelMobile.jump('account'));assert.equal(await page.locator('#regulations-book-map canvas').count(),0,'leaving destroys the document');
  assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage();const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),section=html.match(/<section class="panel regulations-administration"[\s\S]*?<\/section>/)[0];
 await page.setContent(section);await page.addScriptTag({path:path.join(root,'js/features/portal/regulations-model.js')});
 await page.evaluate(()=>{window.allowed=false;window.requireAdmin=()=>allowed;window.DrinksCentral={connection:async()=>({source:'synthetic'})};window.saved=null;window.DrinksPush={request:async(c,p,data)=>{if(data.items){saved=data;return {version:1};}return {items:RegulationsModel.defaults(),version:0};}};});
 await page.addScriptTag({path:path.join(root,'js/features/portal/portal-regulations.js')});await page.locator('#regulations-admin-load').click();assert.equal(await page.locator('#regulations-admin-editor').isVisible(),false);
 await page.evaluate(()=>allowed=true);await page.locator('#regulations-admin-load').click();await page.locator('#regulations-admin-editor').waitFor();assert.equal(await page.locator('fieldset').count(),6);
 await page.locator('fieldset').first().getByRole('button',{name:'Nach unten',exact:true}).click();await page.locator('fieldset').first().getByLabel('Vollständiger Titel',{exact:true}).fill('Beispieltitel');await page.locator('#regulations-admin-save').click();await page.getByText('Dienstvorschriften und Reihenfolge zentral gespeichert.').waitFor();
 assert.deepEqual(await page.evaluate(()=>({label:saved.items[0].label,title:saved.items[0].title,version:saved.expectedVersion})),{label:'FwDV 1',title:'Beispieltitel',version:0});await page.close();
 console.log('Dienstvorschriften: 320/390/768px, book paging, pinch/pan, search, failure/retry, PDF lifecycle and administration passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
