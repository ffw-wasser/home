// Synthetic responses only; the official PDF request is intercepted, never downloaded.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const width of [320,390,768]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});const pdfRequests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});if(u.origin==='https://www.lfs-bw.de'){pdfRequests.push(route.request());return route.fulfill({body:'Synthetic PDF placeholder',contentType:'text/plain'});}return route.abort();});
  await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
  await page.evaluate(()=>{H2OPortal.api=async()=>({items:RegulationsModel.defaults(),version:0});DeckelMobile.show(true);DeckelMobile.jump('deckel-more');});
  const tile=page.locator('[data-portal-tile="more-regulations"]');assert.equal(await tile.locator('.portal-more-icon').innerText(),'§');await tile.click();await page.getByText('Quelle: Landesfeuerwehrschule Baden-Württemberg.',{exact:false}).waitFor();
  assert.equal(await page.locator('#regulations-list .regulation-card').count(),6);assert.equal(pdfRequests.length,0,'catalogue does not contact the PDF provider');
  await page.locator('#regulations-search').fill('atemSCHUTZ');assert.equal(await page.locator('#regulations-list .regulation-card').count(),1);await page.locator('#regulations-list h3').filter({hasText:'Atemschutz'}).waitFor();
  await page.locator('#regulations-search').fill('FwDV 3');assert.equal(await page.locator('#regulations-list .regulation-card').count(),1);
  await page.locator('#regulations-search').fill('nichtvorhanden');await page.getByText('Keine passende Dienstvorschrift gefunden.',{exact:false}).waitFor();assert.equal(await page.locator('#regulations-list .regulation-card').count(),0);
  await page.locator('#regulations-search').fill('');assert.equal(await page.locator('#regulations-list .regulation-card').count(),6);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('deckel-main').scrollWidth<=innerWidth),true);
  await page.locator('#regulations-list button').first().click();await page.locator('#regulations-reader').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('regulations-frame').contentDocument===null||document.getElementById('regulations-frame').contentDocument?.readyState==='complete');
  assert.match(await page.locator('#regulations-frame').getAttribute('src'),/^https:\/\/www\.lfs-bw\.de\/fileadmin\/LFS-BW\/.+\.pdf#view=FitH$/);assert.equal(await page.locator('#regulations-frame').getAttribute('referrerpolicy'),'no-referrer');
  await page.locator('#regulations-back').click();assert.equal(await page.locator('#regulations-frame').getAttribute('src'),null);
  await page.locator('#regulations-list button').first().click();await page.evaluate(()=>DeckelMobile.jump('account'));assert.equal(await page.locator('#regulations-frame').getAttribute('src'),null,'leaving removes the external document');
  for(const request of pdfRequests){assert.equal(request.headers()['authorization'],undefined);assert.equal(request.headers()['referer'],undefined);}
  assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage();const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),section=html.match(/<section class="panel regulations-administration"[\s\S]*?<\/section>/)[0];
 await page.setContent(section);await page.addScriptTag({path:path.join(root,'js/features/portal/regulations-model.js')});
 await page.evaluate(()=>{window.allowed=false;window.requireAdmin=()=>allowed;window.DrinksCentral={connection:async()=>({source:'synthetic'})};window.saved=null;window.DrinksPush={request:async(c,p,data)=>{if(data.items){saved=data;return {version:1};}return {items:RegulationsModel.defaults(),version:0};}};});
 await page.addScriptTag({path:path.join(root,'js/features/portal/portal-regulations.js')});await page.locator('#regulations-admin-load').click();assert.equal(await page.locator('#regulations-admin-editor').isVisible(),false);
 await page.evaluate(()=>allowed=true);await page.locator('#regulations-admin-load').click();await page.locator('#regulations-admin-editor').waitFor();assert.equal(await page.locator('fieldset').count(),6);
 await page.locator('fieldset').first().getByRole('button',{name:'Nach unten',exact:true}).click();await page.locator('fieldset').first().getByLabel('Vollständiger Titel',{exact:true}).fill('Beispieltitel');await page.locator('#regulations-admin-save').click();await page.getByText('Dienstvorschriften und Reihenfolge zentral gespeichert.').waitFor();
 assert.deepEqual(await page.evaluate(()=>({label:saved.items[0].label,title:saved.items[0].title,version:saved.expectedVersion})),{label:'FwDV 1',title:'Beispieltitel',version:0});await page.close();
 console.log('Dienstvorschriften: 320/390/768px, navigation, PDF lifecycle, privacy and administration passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
