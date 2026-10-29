// Exercise slow personal-link requests using synthetic data and local assets only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER?{channel:process.env.QA_BROWSER}:{})});try{
 const page=await browser.newPage({serviceWorkers:'block'}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,'.'+u.pathname);if(u.hostname!=='localhost'||!file.startsWith(root+path.sep))return route.abort();if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){missing.push(u.pathname);return route.fulfill({status:404,body:'Missing'});}return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'}[path.extname(file)]||'application/octet-stream'});});
 await page.goto('http://localhost/index.html');await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});await page.locator('#appStartup').waitFor({state:'hidden'});
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
  window.qaCalls=0;DrinksMobile.preparePortalAccess=async id=>{qaCalls++;return {memberId:id,alias:'synthetic',revision:'r1'};};
  DrinksPush.request=async(c,p)=>p.endsWith('/identity-ticket')?new Promise((resolve,reject)=>{window.qaResolve=()=>resolve({code:'SYNTHETIC-CODE',expiresAt:Date.now()+300000});window.qaReject=()=>reject(Error('Test: keine Verbindung'));}):({evidenceVersion:1});
 });
 page.on('dialog',d=>d.accept());
 const button=page.locator('#portal-admin-show-qr'),status=page.locator('#portal-admin-qr-status'),result=page.locator('#portal-admin-identity-result');
 await button.click();await page.waitForFunction(()=>window.qaResolve);assert.equal(await button.isDisabled(),true);assert.equal(await result.isVisible(),false);
 await page.evaluate(()=>document.querySelector('#portal-admin-show-qr').click());assert.equal(await page.evaluate(()=>qaCalls),1);
 await page.evaluate(()=>qaResolve());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);
 assert.equal(await result.isVisible(),true);assert.equal(await page.locator('#portal-admin-identity-code').inputValue(),'SYNTHETIC-CODE');assert.match(await page.locator('#portal-admin-link').getAttribute('href'),/#setup=SYNTHETIC-CODE$/);assert.equal(await page.locator('#portal-admin-qr').isVisible(),true);
 for(const width of [320,390,768,1024,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'identity guide overflow '+width);}
 await button.click();await page.waitForFunction(()=>qaCalls===2);await page.evaluate(()=>qaReject());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);assert.match(await status.textContent(),/keine Verbindung/);assert.equal(await result.isVisible(),false);assert.equal(await page.locator('#portal-admin-qr').isVisible(),false);
 await button.click();await page.waitForFunction(()=>qaCalls===3);await page.locator('#portal-admin-member').selectOption('qa-2');await page.evaluate(()=>qaResolve());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);assert.equal(await result.isVisible(),false);assert.equal(await page.locator('#portal-admin-link').getAttribute('href'),null);
 await button.click();await page.waitForFunction(()=>qaCalls===4);await page.locator('#portal-admin-back').click();await page.evaluate(()=>qaReject());await page.waitForFunction(()=>!document.querySelector('#portal-admin-show-qr').disabled);assert.equal(await status.textContent(),'');assert.equal(await result.isVisible(),false);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log('Passkey-Einrichtung: Doppelklickschutz, bestätigter Code, QR, Fehler, Wiederholen, Mitgliederwechsel, Verlassen und Layout 320–1280 px OK.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
