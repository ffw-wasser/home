// Exercise slow personal-link requests using synthetic data and local assets only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER||'msedge'});try{
 const page=await browser.newPage({serviceWorkers:'block'}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,'.'+u.pathname);if(u.hostname!=='localhost'||!file.startsWith(root+path.sep))return route.abort();if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){missing.push(u.pathname);return route.fulfill({status:404,body:'Missing'});}return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'}[path.extname(file)]||'application/octet-stream'});});
 await page.goto('http://localhost/index.html');
 await page.evaluate(async()=>{
  oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;adminUnlocked=true;resetAdminTimeout();
  const people=[{id:'qa-1',firstName:'Anna',lastName:'Test',roles:[]},{id:'qa-2',firstName:'Bert',lastName:'Fiktiv',roles:[]}];
  window.qaPeople=people;oneDriveReadState=async()=>({members:people});
  DrinksCentral.connection=async()=>({origin:'https://test.account.workers.dev/',source:'qa-source'});
  DrinksStore.sourceKey=()=> 'qa-source';DrinksPush.request=async()=>({evidenceVersion:1});
  showView('settingsPortalView');
 });
 await page.waitForFunction(()=>document.querySelector('#portal-admin-member').options.length===3);
 await page.locator('#portal-admin-member').selectOption('qa-1');
 await page.evaluate(()=>{
  window.qaCalls=0;oneDriveReadState=()=>new Promise(resolve=>window.qaRoster=()=>resolve({members:qaPeople}));
  DrinksMobile.adminLink=()=>{qaCalls++;return new Promise((resolve,reject)=>{window.qaResolve=()=>resolve('https://example.invalid/deckel.html#synthetic-access');window.qaReject=()=>reject(Error('Test: keine Verbindung'));});};
 });
 const button=page.locator('#portal-admin-show-qr'),status=page.locator('#portal-admin-qr-status'),guide=page.locator('#portal-admin-install-guide');
 await button.click();assert.equal(await button.isDisabled(),true);assert.equal(await button.getAttribute('aria-busy'),'true');assert.match(await status.textContent(),/Mitglieder.*Bitte kurz warten/);assert.equal(await guide.isVisible(),false);
 await page.evaluate(()=>document.querySelector('#portal-admin-show-qr').click());assert.equal(await page.evaluate(()=>qaCalls),0);
 await page.evaluate(()=>qaRoster());await page.waitForFunction(()=>qaCalls===1);assert.match(await status.textContent(),/Portalzugang wird vorbereitet/);
 await page.evaluate(()=>qaResolve());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);
 assert.equal(await button.getAttribute('aria-busy'),'false');assert.equal(await page.locator('#portal-admin-qr').isVisible(),true);assert.equal(await guide.isVisible(),true);assert.match(await status.textContent(),/Test Anna/);
 for(const width of [320,390,768,1024,1280]){
  await page.setViewportSize({width,height:1000});
  for(const img of await guide.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(n=>n.decode());}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'QR guide overflow '+width);
 }
 await page.setViewportSize({width:1024,height:1100});await guide.scrollIntoViewIfNeeded();
 if(process.env.QA_SCREENSHOT)await page.screenshot({path:process.env.QA_SCREENSHOT,fullPage:true});
 await page.evaluate(()=>{oneDriveReadState=async()=>({members:qaPeople});});
 await button.click();await page.waitForFunction(()=>qaCalls===2);await page.evaluate(()=>qaReject());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);
 assert.match(await status.textContent(),/konnte nicht geladen.*erneut versuchen/);assert.equal(await guide.isVisible(),false);assert.equal(await page.locator('#portal-admin-qr').isVisible(),false);
 await button.click();await page.waitForFunction(()=>qaCalls===3);await page.locator('#portal-admin-member').selectOption('qa-2');await page.evaluate(()=>qaResolve());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);
 assert.equal(await page.locator('#portal-admin-qr').isVisible(),false);assert.equal(await guide.isVisible(),false);assert.equal(await status.textContent(),'');assert.equal(await page.locator('#portal-admin-link').getAttribute('href'),null);
 await button.click();await page.waitForFunction(()=>qaCalls===4);await page.locator('#portal-admin-back').click();await page.evaluate(()=>qaReject());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);
 assert.equal(await status.textContent(),'');assert.equal(await guide.isVisible(),false);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log('QR: sofortige Ladeanzeige, Doppelklickschutz, Erfolg, Fehler, Wiederholen, Mitgliederwechsel, Verlassen, Bilder und Layout 320–1280 px OK.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
