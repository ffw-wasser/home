// Both real info areas, synthetic data only; all external services are blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 for(const file of ['index.html','deckel.html']){
  await page.goto('https://ffw-wasser.github.io/home/'+file);
  if(file==='index.html'){
   await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});await page.locator('#appStartup').waitFor({state:'hidden'});await page.evaluate(()=>showView('helpView'));
   assert.equal(await page.locator('#helpView .info-menu-card').count(),2);assert.equal(await page.locator('#help-guide').isVisible(),false);
   await page.locator('[data-info-view="contactsView"]').click();assert.equal(await page.locator('#contactsView').isVisible(),true);assert.equal(await page.locator('#helpTab').evaluate(n=>n.classList.contains('active')),true);
   await page.locator('#contactsView [data-info-view="helpView"]').click();await page.locator('[data-info-view="privacyHelpView"]').click();
   assert.equal(await page.locator('#privacyHelpView').isVisible(),true);assert.equal(await page.locator('#contactsView').isVisible(),false);
  }else{
   await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.keyboard.press('Escape');
   await page.evaluate(()=>{window.contactLoads=0;H2OPortal.api=async()=>{contactLoads++;return {};};DeckelMobile.show(true);DeckelMobile.jump('deckel-more');});
   assert.equal(await page.locator('#portal-more-grid [data-portal-tile="more-contacts"]').count(),1);
   await page.locator('#portal-more-grid [data-more-target="more-help"]').click();assert.equal(await page.locator('#contacts-list').isVisible(),false);assert.equal(await page.evaluate(()=>contactLoads),0,'opening help does not request private contacts');
   assert.equal(await page.locator('#portal-menu-title').innerText(),'Datenschutz & Hilfe');
  }
  const guide=page.locator('#help-guide');assert.equal(await guide.isVisible(),true);assert.equal(await guide.locator('.guide-privacy-grid>section').count(),6);assert.equal(await guide.locator('.guide-lesson').count(),file==='deckel.html'?9:7);
  assert.equal(await guide.locator('.contacts-pane').count(),0);assert.equal(await guide.locator('a[href^="#"]').count(),0);
  assert.match(await guide.locator('.guide-privacy').innerText(),/Passkey|Passwort/);assert.match(await guide.locator('.guide-privacy').innerText(),/OneDrive/);assert.match(await guide.locator('.guide-privacy').innerText(),/Cloudflare/);const privacyText=await guide.locator('.guide-privacy').innerText();if(file==='deckel.html'){assert.match(privacyText,/Portal-Konto löschen/);assert.match(privacyText,/Dauer der Mitgliedschaft/);assert.equal(await guide.locator('img[src="assets/help/guide/h2o-konto-loeschen.jpg"]').count(),1);}else assert.match(privacyText,/keine bestätigten Feuerwehrdaten/);
  if(file==='index.html')assert.equal(await guide.locator('img[src="assets/help/guide/geraetehaus-backlog.jpg"]').count(),1,'Backlog is illustrated in the main administration guide');
  const before=await page.evaluate(()=>location.hash);
  for(const width of [320,390,768,1280])for(const scale of [100,200]){
   await page.setViewportSize({width,height:900});await page.evaluate(scale=>{document.documentElement.style.fontSize=scale+'%';document.querySelectorAll('#help-guide details').forEach(d=>d.open=true);},scale);
   const manualLength=(await guide.locator('.guide-manual').innerText()).length;assert.ok(manualLength<4500,'daily instructions remain concise alongside the explicit data inventory: '+manualLength);
   assert.ok(await guide.locator('.guide-data-fields dt').count()>=6,'privacy enumerates the actual data fields');
   assert.doesNotMatch(await guide.innerText(),/TestFlight|Google-Gruppenschnittstelle|zertifiziert|APK/);
   assert.equal(await guide.locator('img').count(),file==='index.html'?9:13);
   await guide.locator('img').evaluateAll(async images=>{for(const img of images){img.loading='eager';await img.decode();}});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,file+' overflow '+width+'/'+scale);
   assert.deepEqual(await guide.locator('.guide-lesson-body,.guide-privacy-grid').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[]);
   assert.equal(await guide.locator('img').evaluateAll(ns=>ns.every(n=>n.naturalWidth>0&&n.getAttribute('width')&&n.getAttribute('height'))),true);
   if(file==='deckel.html'){assert.equal(await guide.locator('#guide-main').count(),0);assert.doesNotMatch(await guide.locator('.guide-manual').innerText(),/Anwesenheit erfassen|Termin abschließen/);}
  }
  assert.equal(await page.evaluate(()=>location.hash),before);assert.equal(await guide.locator('a[target="_blank"]').evaluateAll(ns=>ns.every(n=>n.rel.includes('noopener'))),true);
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:file==='index.html'?1180:390,height:900});await page.evaluate(()=>{document.documentElement.style.fontSize='100%';document.querySelectorAll('#help-guide details').forEach(d=>d.open=false);});await guide.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.QA_OUTPUT,file+'-help.png')});}
 }
 assert.deepEqual(errors,[]);console.log('PASS separate contacts/help, Infos parent retained, no private contact request from help, concise current content, safe images and 320–1280 px at 100/200%');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
