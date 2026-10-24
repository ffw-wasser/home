// Local screenshots and real guide DOM; all remote requests blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 for(const file of ['index.html','deckel.html']){
  await page.goto('https://ffw-wasser.github.io/home/'+file);
  if(file==='index.html'){await page.locator('#appStartup').waitFor({state:'detached'});await page.evaluate(()=>showView('helpView'));}
  else await page.evaluate(()=>{DeckelMobile.show(true);DeckelMobile.jump('more-help');});
  const guide=page.locator('#help-guide');assert.equal(await guide.count(),1);assert.equal(await guide.locator(':scope > :first-child').getAttribute('class'),'guide-privacy');assert.equal(await guide.locator('.guide-privacy-grid section').count(),6);
  assert.equal(await guide.evaluate(n=>n.previousElementSibling?.classList.contains('contacts-pane')),true,'privacy and instructions follow the existing contacts');
  assert.equal(await page.locator(file==='index.html'?'#helpView .help-document':'#more-help .portal-help').count(),0,'old help texts are replaced');
  assert.match(await guide.locator('.guide-privacy').innerText(),/Passkey/);assert.match(await guide.locator('.guide-privacy').innerText(),file==='index.html'?/dadurch nicht gelöscht/:/löscht keine bestätigten/);assert.match(await guide.locator('.guide-privacy').innerText(),/keine ärztlichen Befunde/);
  assert.equal(await guide.locator('a[href^="#"]').count(),0,'help links cannot replace the portal access fragment');
  assert.equal(await guide.locator('.guide-lesson').count(),file==='index.html'?10:5);if(file==='deckel.html'){assert.equal(await guide.locator('#guide-main').count(),0);assert.doesNotMatch(await guide.locator('.guide-manual').innerText(),/Hauptanwendung|Anwesenheit erfassen|Termin abschließen/);}const before=await page.evaluate(()=>location.hash);
  for(const width of [320,390,768,1280])for(const scale of [100,200]){
   await page.setViewportSize({width,height:900});await page.evaluate(scale=>{document.documentElement.style.fontSize=scale+'%';document.querySelectorAll('#help-guide details').forEach(d=>d.open=true);},scale);
   await guide.locator('img').evaluateAll(async images=>{for(const img of images){img.loading='eager';await img.decode();}});
   assert.equal(await guide.locator('img').count(),file==='index.html'?15:6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,file+' page overflow '+width+'/'+scale);
   assert.deepEqual(await guide.locator('.guide-lesson-body,.guide-privacy-grid').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[],file+' guide overflow '+width+'/'+scale);
   assert.equal(await guide.locator('img').evaluateAll(ns=>ns.every(n=>n.naturalWidth>0&&n.getAttribute('width')&&n.getAttribute('height'))),true);
  }
  assert.equal(await page.evaluate(()=>location.hash),before);
  assert.equal(await guide.locator('a[target="_blank"]').evaluateAll(ns=>ns.every(n=>n.rel.includes('noopener'))),true);
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:file==='index.html'?1180:390,height:900});await page.evaluate(()=>{document.documentElement.style.fontSize='100%';document.querySelectorAll('#help-guide details').forEach(d=>d.open=false);});await guide.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.QA_OUTPUT,file+'-privacy.png')});await page.locator(file==='index.html'?'#guide-main>summary':'#guide-portal>summary').click();await page.locator(file==='index.html'?'#guide-main .guide-lesson>summary':'#guide-portal .guide-lesson>summary').first().click();await guide.locator('.guide-manual').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.QA_OUTPUT,file+'-manual.png')});}
 }
 assert.deepEqual(errors,[]);console.log('PASS privacy first, 10 main-guide lessons, 5 portal-only lessons, 15 original images, safe image links, tablet/phone 320–1280 px at 100%/200%, portal fragment preserved');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
