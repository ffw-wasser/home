// Real mobile UI; synthetic responses only. Never access a production account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,360,390,412,768]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.stack||e.message));
   await page.addInitScript(()=>{window.testPdfBlobs=new Map();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);testPdfBlobs.set(url,blob);return url;};URL.revokeObjectURL=url=>{testPdfBlobs.delete(url);revoke(url);};});
   await page.addInitScript(()=>localStorage.setItem('h2o_portal_layout_v1',JSON.stringify({main:['portal-section','portal-evidence','account','portal-points'],more:['more-water','more-hydrants','more-help']})));
   await page.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});}
    if(url.hostname==='test.example.workers.dev'){
     if(url.pathname==='/portal/evidence')return route.fulfill({json:{evidence:{version:1,medical:{g262:'',g263:''},breathing:null,driver:null},syncedAt:Date.now()}});
     if(url.pathname==='/portal/year'){const {year}=req.postDataJSON();return route.fulfill({json:{year,configured:true,stale:false,fetchedAt:Date.now(),events:[{id:'long-name',kind:'probe',title:'Sonderprobe Atemschutz und Maschinistenausbildung für die gesamte Mannschaft mit ausführlichem Themennamen',start:Date.parse(year+'-01-02T18:30:00Z'),end:Date.parse(year+'-01-02T20:00:00Z'),location:'Gerätehaus Wasser',clothing:'Einsatzkleidung'},{id:'birthday',kind:'birthday',title:'Dein Geburtstag',allDay:true,start:Date.parse(year+'-02-02T00:00:00+01:00'),end:Date.parse(year+'-02-03T00:00:00+01:00')}]}});}
     return route.fulfill({json:{events:[],configured:true,leader:false,fetchedAt:Date.now(),stale:false}});
    }return route.abort();
   });
   await page.goto('https://ffw-wasser.github.io/home/deckel.html');
   await page.evaluate(async()=>{history.replaceState(null,'','#a='+'1'.repeat(32));await H2OPortal.render({actions:{central:true,origin:'https://test.example.workers.dev',capability:'synthetic-session',revision:'revision-test'}});DeckelMobile.show(true);DeckelMobile.jump('deckel-more');});
   const tile=page.locator('[data-portal-tile="more-year-plan"]');assert.equal(await tile.isVisible(),true);assert.equal(await tile.locator('strong').textContent(),'Jahresplan');
   assert.deepEqual((await page.locator('#portal-more-grid [data-portal-tile]').evaluateAll(ns=>ns.map(n=>n.dataset.portalTile))).slice(0,3),['more-water','more-hydrants','more-help'],'existing custom order is preserved');
   await tile.click();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();
   assert.equal(await page.locator('.year-plan-month').count(),12);assert.equal(await page.locator('.year-plan-event').count(),2);assert.equal(await page.locator('#year-plan-unlock').isVisible(),false);
   await page.locator('#year-plan-month').selectOption('0');
   if(width<=600)assert.equal(await page.evaluate(()=>document.querySelector('#year-plan-month-0').getBoundingClientRect().top>=document.querySelector('#more-year-plan>.year-plan-tools').getBoundingClientRect().bottom),true,'month heading stays below the sticky controls');
   assert.match(await page.locator('#year-plan-month-0').textContent(),/19:30 Uhr/);assert.match(await page.locator('#year-plan-month-0').textContent(),/ausführlichem\s+Themennamen/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+width);assert.equal(await page.locator('#more-year-plan').evaluate(n=>n.scrollWidth>n.clientWidth),false,'plan overflow '+width);
   await page.locator('.year-plan-event summary').first().click();assert.match(await page.locator('.year-plan-event').first().textContent(),/Gerätehaus Wasser/);
   await page.locator('.year-plan-display>summary').click();await page.locator('#year-plan-birthdays').uncheck();assert.equal(await page.locator('.is-birthday').count(),0);await page.locator('#year-plan-birthdays').check();
   // A real PDF uses the same filtered personal projection, with both halves.
   await page.locator('#year-plan-birthdays').uncheck();
   await page.getByRole('button',{name:'Als PDF ansehen',exact:true}).click();
   const pdfDialog=page.locator('#year-plan-pdf-dialog');await pdfDialog.locator('canvas').waitFor().catch(async e=>{console.error(await pdfDialog.innerText(),errors,await pdfDialog.locator('.year-plan-pdf-map').evaluate(n=>({width:n.clientWidth,height:n.clientHeight,html:n.innerHTML})));throw e;});
   assert.equal(await pdfDialog.isVisible(),true);assert.equal(await pdfDialog.evaluate(n=>n.scrollWidth>n.clientWidth),false);
   const pdfText=await page.evaluate(async()=>{const lib=await import('./js/vendor/pdfjs/pdf-5.4.624.min.mjs'),bytes=new Uint8Array(await testPdfBlobs.get(document.querySelector('#year-plan-pdf-dialog a').href).arrayBuffer()),doc=await lib.getDocument({data:bytes,isEvalSupported:false,useWasm:false}).promise,text=[];for(let i=1;i<=doc.numPages;i++)text.push((await(await doc.getPage(i)).getTextContent()).items.map(n=>n.str).join(' '));await doc.destroy();return text;});
   assert.equal(pdfText.length,2);assert.match(pdfText[0],/Januar/);assert.match(pdfText[1],/Dezember/);assert.match(pdfText.join(' '),/Sonderprobe Atemschutz/);assert.match(pdfText.join(' '),/ausführlichem\s+Themennamen/);assert.match(pdfText.join(' '),/Gerätehaus\s+Wasser/);assert.ok(!pdfText.join(' ').includes('Dein Geburtstag'));
   await page.getByRole('button',{name:'Nächste PDF-Seite',exact:true}).click();await page.getByText('Seite 2 / 2',{exact:true}).waitFor();await pdfDialog.locator('canvas').waitFor();
   if(width===390&&process.env.QA_OUTPUT){const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await testPdfBlobs.get(document.querySelector('#year-plan-pdf-dialog a').href).arrayBuffer())));fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.QA_OUTPUT,'jahresplan-test.pdf'),Buffer.from(bytes));await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-pdf-handy.png')});}
   await pdfDialog.getByRole('button',{name:'Schließen',exact:true}).click();await page.locator('#year-plan-birthdays').check();
   if(width===390&&process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.locator('#more-year-plan .portal-more-back').click();await page.screenshot({path:path.join(process.env.QA_OUTPUT,'h2o-mehr.png')});await tile.click();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();await page.locator('#year-plan-month').selectOption('0');await page.screenshot({path:path.join(process.env.QA_OUTPUT,'h2o-jahresplan.png')});}
   // Moving the short title into the five-slot phone navigation must also fit.
   await page.evaluate(()=>DeckelMobile.jump('deckel-more'));await page.locator('#portal-layout-open').click();await page.locator('#portal-layout-item').selectOption('more-year-plan');await page.locator('#portal-layout-transfer').click();await page.locator('#portal-layout-close').click();
   assert.equal(await page.locator('#deckel-nav [data-portal-tile="more-year-plan"]').count(),1);assert.equal(await tile.evaluate(n=>n.scrollWidth>n.clientWidth),false,'tile overflow '+width);
   await tile.click();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();
   await page.getByRole('button',{name:'Als PDF ansehen',exact:true}).click();await pdfDialog.locator('canvas').waitFor();
   const pdfUrl=await pdfDialog.locator('a').first().getAttribute('href');
   await page.evaluate(()=>H2OPortal.clear());assert.equal(await page.locator('.year-plan-event').count(),0,'logout clears personal annual data');assert.equal(await pdfDialog.isVisible(),false);assert.equal(await pdfDialog.locator('a').first().getAttribute('href'),null);assert.equal(await page.evaluate(url=>testPdfBlobs.has(url),pdfUrl),false,'logout revokes PDF bytes');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS H2O Jahresplan: saved layouts, short tile in Mehr and navigation, 320/360/390/412/768 px, long titles, 12 months, Berlin time, filters, details and logout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
