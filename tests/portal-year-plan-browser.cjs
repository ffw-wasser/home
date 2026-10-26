// Real mobile UI; synthetic responses only. Never access a production account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,360,390,412,768,1024,1366]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.stack||e.message));
   await page.addInitScript(()=>{window.testPdfBlobs=new Map();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);testPdfBlobs.set(url,blob);return url;};URL.revokeObjectURL=url=>{testPdfBlobs.delete(url);revoke(url);};});
   await page.addInitScript(()=>localStorage.setItem('h2o_portal_layout_v1',JSON.stringify({main:['portal-section','portal-evidence','account','portal-points'],more:['more-water','more-hydrants','more-help']})));
   let yearMode='wait',yearCalls=0,releaseYear,enteredYear;const firstYear=new Promise(resolve=>enteredYear=resolve);
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});}
    if(url.hostname==='test.example.workers.dev'){
     if(url.pathname==='/portal/evidence')return route.fulfill({json:{evidence:{version:1,medical:{g262:'',g263:''},breathing:null,driver:null},syncedAt:Date.now()}});
     if(url.pathname==='/portal/year'){yearCalls++;if(yearMode==='wait'){enteredYear();await new Promise(resolve=>releaseYear=resolve);}if(yearMode==='offline')return route.abort('failed');const {year}=req.postDataJSON();return route.fulfill({json:{year,configured:true,stale:false,fetchedAt:Date.now(),events:[{id:'long-name',kind:'probe',title:'Sonderprobe Atemschutz und Maschinistenausbildung für die gesamte Mannschaft mit ausführlichem Themennamen',start:Date.parse(year+'-01-02T18:30:00Z'),end:Date.parse(year+'-01-02T20:00:00Z'),location:'Gerätehaus Wasser',clothing:'Einsatzkleidung',note:'Google Zusatzinfo mit langem Text. '.repeat(12)+'Anhang Ende'},{id:'birthday',kind:'birthday',title:'Dein Geburtstag',allDay:true,start:Date.parse(year+'-02-02T00:00:00+01:00'),end:Date.parse(year+'-02-03T00:00:00+01:00')}]}});}
     return route.fulfill({json:{events:[],configured:true,leader:false,fetchedAt:Date.now(),stale:false}});
    }return route.abort();
   });
   await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
   await page.evaluate(async()=>{history.replaceState(null,'','#a='+'1'.repeat(32));await H2OPortal.render({actions:{central:true,origin:'https://test.example.workers.dev',capability:'synthetic-session',revision:'revision-test'}});DeckelMobile.show(true);DeckelMobile.jump('deckel-more');});
   const tile=page.locator('[data-portal-tile="more-year-plan"]');assert.equal(await tile.isVisible(),true);assert.equal(await tile.locator('strong').textContent(),'Jahresplan');
   assert.deepEqual((await page.locator('#portal-more-grid [data-portal-tile]').evaluateAll(ns=>ns.map(n=>n.dataset.portalTile))).slice(0,3),['more-water','more-hydrants','more-help'],'existing custom order is preserved');
   const pdfDialog=page.locator('#year-plan-pdf-dialog');
   await tile.click();await firstYear;
   assert.equal(await page.locator('#year-plan-filter').isVisible(),false,'no intermediate calendar during loading');assert.equal(yearCalls,1);
   yearMode='success';releaseYear();await pdfDialog.locator('canvas').waitFor();
   assert.equal(await pdfDialog.isVisible(),true);assert.equal(await pdfDialog.evaluate(n=>n.scrollWidth>n.clientWidth),false);
   const pdfText=await page.evaluate(async()=>{const lib=await import('./js/vendor/pdfjs/pdf-5.4.624.min.mjs'),bytes=new Uint8Array(await testPdfBlobs.get(document.querySelector('#year-plan-pdf-dialog a').href).arrayBuffer()),doc=await lib.getDocument({data:bytes,isEvalSupported:false,useWasm:false}).promise,text=[];for(let i=1;i<=doc.numPages;i++)text.push((await(await doc.getPage(i)).getTextContent()).items.map(n=>n.str).join(' '));await doc.destroy();return text;});
   assert.equal(pdfText.length,2);assert.match(pdfText[0],/Januar/);assert.match(pdfText.join(' '),/Dezember/);assert.match(pdfText.join(' '),/Sonderprobe\s+Atemschutz/);assert.match(pdfText.join(' '),/Heilige Drei Könige/);
   await page.getByRole('button',{name:'Nächste PDF-Seite',exact:true}).click();await page.getByText('Seite 2 / 2',{exact:true}).waitFor();
   if(width===390&&process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-pdf-handy.png')});}
   const firstUrl=await pdfDialog.locator('a').first().getAttribute('href');await pdfDialog.getByRole('button',{name:'Schließen',exact:true}).click();
   assert.equal(await page.locator('#deckel-more').isVisible(),true,'close returns directly to More');assert.equal(await page.locator('#more-year-plan').isVisible(),false,'no intermediate view after closing');assert.equal(await page.evaluate(url=>testPdfBlobs.has(url),firstUrl),false,'closing releases personal PDF');
   // Escape uses the same return route; a pinned tile returns to the actual source page.
   await tile.click();await pdfDialog.locator('canvas').waitFor();await page.keyboard.press('Escape');await page.locator('#deckel-more').waitFor();
   await page.locator('#portal-layout-open').click();await page.locator('#portal-layout-item').selectOption('more-year-plan');await page.locator('#portal-layout-transfer').click();await page.locator('#portal-layout-close').click();
   await page.evaluate(()=>DeckelMobile.jump('portal-section'));await tile.click();await pdfDialog.locator('canvas').waitFor();await pdfDialog.getByRole('button',{name:'Schließen',exact:true}).click();assert.equal(await page.locator('#portal-section').isVisible(),true,'pinned annual plan returns to appointments');
   // Leaving during a delayed response must not reopen a personal PDF.
   yearMode='wait';const before=yearCalls;await tile.click();await page.waitForTimeout(50);assert.equal(yearCalls,before+1);await page.evaluate(()=>DeckelMobile.jump('deckel-more'));yearMode='success';releaseYear();await page.waitForTimeout(50);assert.equal(await pdfDialog.isVisible(),false);
   await tile.click();await pdfDialog.locator('canvas').waitFor();const pdfUrl=await pdfDialog.locator('a').first().getAttribute('href');
   await page.evaluate(()=>H2OPortal.clear());assert.equal(await page.locator('.year-plan-event').count(),0,'logout clears personal annual data');assert.equal(await pdfDialog.isVisible(),false);assert.equal(await pdfDialog.locator('a').first().getAttribute('href'),null);assert.equal(await page.evaluate(url=>testPdfBlobs.has(url),pdfUrl),false,'logout revokes PDF bytes');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS direct personal annual PDF: seven widths, content, paging, Close/Escape return routes, pinned tile, delayed navigation and logout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
