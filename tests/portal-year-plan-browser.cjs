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
   await tile.click();await firstYear;
   const currentMonth=await page.evaluate(()=>Number(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',month:'2-digit'}).format(new Date()))-1);
   const atMonth=month=>page.waitForFunction(month=>{const n=document.querySelector('#year-plan-month-'+month),tools=document.querySelector('#more-year-plan>.year-plan-controls'),r=n.getBoundingClientRect();return document.querySelector('#year-plan-month').value===String(month)&&r.top>=tools.getBoundingClientRect().bottom-1&&r.top<innerHeight;},month).catch(async e=>{console.error({width,month,...await page.evaluate(month=>({value:document.querySelector('#year-plan-month').value,top:document.querySelector('#year-plan-month-'+month).getBoundingClientRect().top,tools:document.querySelector('#more-year-plan>.year-plan-controls').getBoundingClientRect().bottom,scroll:document.querySelector('#deckel-main').scrollTop}),month)});throw e;});
   await atMonth(currentMonth);await page.locator('#year-plan-month').selectOption('0');await atMonth(0);await page.locator('#year-plan-today').click();await atMonth(currentMonth);assert.equal(yearCalls,1,'Today scrolls during a pending request without starting another');
   yearMode='success';releaseYear();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();await atMonth(currentMonth);
   assert.equal(await page.locator('#more-year-plan>.year-plan-controls').count(),1);
   if(width<=600){const today=await page.locator('#year-plan-today').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize),fits:n.scrollWidth<=n.clientWidth}));assert.ok(today.width>=100&&today.height>=48&&today.font>=16&&today.fits,'Today is readable and easy to tap '+width);}
   assert.equal(await page.locator('#year-plan-filter').isVisible(),true,'filters are visible as in the main application');
   assert.equal(await page.locator('.year-plan-legend').isVisible(),true,'shared colour legend remains visible');
   const columns=await page.locator('.year-plan-half').first().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);assert.equal(columns,width<=600?1:width<=1000?2:3);
   assert.equal(await page.locator('.year-plan-month').count(),12);assert.equal(await page.locator('.year-plan-event').count(),2);assert.equal(await page.locator('#year-plan-unlock').isVisible(),false);
   assert.equal(await page.locator('.year-plan-holiday').count(),6,'one label at each holiday start, plus the ongoing holiday on January 1');
   assert.equal(await page.locator('.year-plan-day.is-holiday').count(),88,'all 88 school-holiday days in 2026 remain highlighted');
   assert.equal(await page.locator('.year-plan-public-holiday').count(),12);assert.match(await page.locator('#year-plan-month-0').textContent(),/Heilige Drei Könige/);
   await page.locator('#year-plan-month').selectOption('0');await atMonth(0);
   if(width<=600)assert.equal(await page.evaluate(()=>document.querySelector('#year-plan-month-0').getBoundingClientRect().top>=document.querySelector('#more-year-plan>.year-plan-controls').getBoundingClientRect().bottom),true,'month heading stays below the sticky controls');
   assert.match(await page.locator('#year-plan-month-0').textContent(),/19:30 Uhr/);assert.match(await page.locator('#year-plan-month-0').textContent(),/ausführlichem\s+Themennamen/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+width);assert.equal(await page.locator('#more-year-plan').evaluate(n=>n.scrollWidth>n.clientWidth),false,'plan overflow '+width);
   await page.locator('.year-plan-event summary').first().click();assert.match(await page.locator('.year-plan-event').first().textContent(),/Gerätehaus Wasser/);
   await page.locator('#year-plan-birthdays').uncheck();assert.equal(await page.locator('.is-birthday').count(),0);await page.locator('#year-plan-birthdays').check();
   await page.locator('#year-plan-holidays').uncheck();assert.equal(await page.locator('.year-plan-public-holiday').count(),12,'public holidays do not depend on the school-holiday filter');await page.locator('#year-plan-holidays').check();
   // A real PDF uses the same filtered personal projection, with both halves.
   await page.locator('#year-plan-birthdays').uncheck();
   await page.getByRole('button',{name:'Als PDF ansehen',exact:true}).click();
   const pdfDialog=page.locator('#year-plan-pdf-dialog');await pdfDialog.locator('canvas').waitFor().catch(async e=>{console.error(await pdfDialog.innerText(),errors,await pdfDialog.locator('.year-plan-pdf-map').evaluate(n=>({width:n.clientWidth,height:n.clientHeight,html:n.innerHTML})));throw e;});
   assert.equal(await pdfDialog.isVisible(),true);assert.equal(await pdfDialog.evaluate(n=>n.scrollWidth>n.clientWidth),false);
   const pdfText=await page.evaluate(async()=>{const lib=await import('./js/vendor/pdfjs/pdf-5.4.624.min.mjs'),bytes=new Uint8Array(await testPdfBlobs.get(document.querySelector('#year-plan-pdf-dialog a').href).arrayBuffer()),doc=await lib.getDocument({data:bytes,isEvalSupported:false,useWasm:false}).promise,text=[];for(let i=1;i<=doc.numPages;i++)text.push((await(await doc.getPage(i)).getTextContent()).items.map(n=>n.str).join(' '));await doc.destroy();return text;});
   assert.equal(pdfText.length,2);assert.match(pdfText[0],/Januar/);assert.ok(pdfText.some(t=>t.includes('Dezember')));assert.doesNotMatch(pdfText.join(' '),/Zusatzinformationen zum Jahresplan/);assert.match(pdfText.join(' '),/vollständige Angaben im Kalender/);assert.doesNotMatch(pdfText.join(' '),/Google Zusatzinfo/);assert.match(pdfText.join(' '),/Sonderprobe\s+Atemschutz/);assert.match(pdfText.join(' '),/ausführlichem\s+Themennamen/);assert.doesNotMatch(pdfText.join(' '),/Gerätehaus\s+Wasser/);assert.ok(!pdfText.join(' ').includes('Dein Geburtstag'));
   assert.match(pdfText.join(' '),/Heilige Drei Könige/);assert.match(pdfText.join(' '),/Fronleichnam/);
   await page.getByRole('button',{name:'Nächste PDF-Seite',exact:true}).click();await page.getByText('Seite 2 / '+pdfText.length,{exact:true}).waitFor();await pdfDialog.locator('canvas').waitFor();
   if(width===390&&process.env.QA_OUTPUT){const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await testPdfBlobs.get(document.querySelector('#year-plan-pdf-dialog a').href).arrayBuffer())));fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.QA_OUTPUT,'jahresplan-test.pdf'),Buffer.from(bytes));await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-pdf-handy.png')});}
   await pdfDialog.getByRole('button',{name:'Schließen',exact:true}).click();await page.locator('#year-plan-birthdays').check();
   if(width===390&&process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.locator('#more-year-plan .portal-more-back').click();await page.screenshot({path:path.join(process.env.QA_OUTPUT,'h2o-mehr.png')});await tile.click();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();await page.locator('#year-plan-month').selectOption('0');await page.screenshot({path:path.join(process.env.QA_OUTPUT,'h2o-jahresplan.png')});}
   // Moving the short title into the five-slot phone navigation must also fit.
   await page.evaluate(()=>DeckelMobile.jump('deckel-more'));await page.locator('#portal-layout-open').click();await page.locator('#portal-layout-item').selectOption('more-year-plan');await page.locator('#portal-layout-transfer').click();await page.locator('#portal-layout-close').click();
   assert.equal(await page.locator('#deckel-nav [data-portal-tile="more-year-plan"]').count(),1);assert.equal(await tile.evaluate(n=>n.scrollWidth>n.clientWidth),false,'tile overflow '+width);
   await tile.click();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();
   yearMode='offline';await page.locator('#year-plan-reload').click();await page.locator('#year-plan-status').filter({hasText:'Die Verbindung wurde unterbrochen'}).waitFor();await page.locator('#year-plan-month').selectOption('0');await atMonth(0);const failedCalls=yearCalls;await page.locator('#year-plan-today').click();await atMonth(currentMonth);assert.equal(yearCalls,failedCalls,'Today also works after a failed request');
   yearMode='success';await page.locator('#year-plan-reload').click();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();
   const currentYear=new Date().getFullYear();await page.locator('#year-plan-year').fill(String(currentYear-1));await page.locator('#year-plan-year').dispatchEvent('change');await page.locator('#year-plan-heading-year').filter({hasText:String(currentYear-1)}).waitFor();await page.locator('#year-plan-today').click();await page.locator('#year-plan-heading-year').filter({hasText:String(currentYear)}).waitFor();await page.locator('#year-plan-status').filter({hasText:'Deine freigegebenen Proben'}).waitFor();await atMonth(currentMonth);
   await page.getByRole('button',{name:'Als PDF ansehen',exact:true}).click();await pdfDialog.locator('canvas').waitFor();
   const pdfUrl=await pdfDialog.locator('a').first().getAttribute('href');
   await page.evaluate(()=>H2OPortal.clear());assert.equal(await page.locator('.year-plan-event').count(),0,'logout clears personal annual data');assert.equal(await pdfDialog.isVisible(),false);assert.equal(await pdfDialog.locator('a').first().getAttribute('href'),null);assert.equal(await page.evaluate(url=>testPdfBlobs.has(url),pdfUrl),false,'logout revokes PDF bytes');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS H2O Jahresplan: saved layouts, short tile in Mehr and navigation, 320/360/390/412/768 px, long titles, 12 months, Berlin time, filters, details and logout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
