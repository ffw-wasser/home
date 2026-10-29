// Real admin UI + local Worker, synthetic members, no external service access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture(),members=f.people.map((p,i)=>({id:p.memberId,firstName:['Anna','Ben','Clara','Daniel','Eva'][i],lastName:'Beispiel',roles:i===0?['GF']:[]}));f.env.ADMIN_TOKEN='b'.repeat(64);
 const sub=(await f.call('calendar-subscription')).value;await f.c.worker.fetch(new Request(sub.subscriptionUrl),f.env);
 f.sql.prepare('INSERT INTO devices(id,alias,revision,endpoint) VALUES(?,?,?,?)').run('test-device',f.people[0].alias,f.people[0].revision,'https://fcm.googleapis.com/test-device');
 const browser=await(process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});try{
  let fail=0,hold=false,release,started;const errors=[],page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='test.account.workers.dev'){
    if(u.pathname==='/admin/portal/subscriptions'&&fail)return route.fulfill({status:fail,json:{error:'Künstlicher Statusfehler'}});
    const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}:{})}),f.env);
    if(u.pathname==='/admin/portal/subscriptions'&&hold){hold=false;started();await new Promise(resolve=>release=resolve);}
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   if(u.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});}
   return route.abort();
  });
  await page.goto('https://ffw-wasser.github.io/home/index.html');await page.evaluate(()=>AppStartup.update({ready:true}));await page.locator('#appStartup').waitFor({state:'hidden'});
  await page.evaluate(({members,token})=>{window.requireAdmin=()=>true;window.members=members;adminUnlocked=true;resetAdminTimeout();oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;oneDriveReadState=async()=>({members});DrinksCentral.connection=async()=>({origin:'https://test.account.workers.dev',source:'test-source',token});DrinksStore.sourceKey=()=> 'test-source';showView('settingsPortalView');},{members,token:f.env.ADMIN_TOKEN});
  const panel=page.locator('#portal-subscriptions'),status=page.locator('#portal-subscriptions-status'),items=panel.locator('.portal-subscription-item');
  await page.waitForFunction(()=>document.querySelectorAll('.portal-subscription-item').length===5);
  assert.match(await status.textContent(),/5 Mitglieder · Push angemeldet: 1 · Kalender abgerufen: 1/);
  const anna=panel.locator('[data-member-id="member-1"]');assert.match(await anna.innerText(),/Angemeldet · 1 Gerät/);assert.match(await anna.innerText(),/Abgerufen ·/);
  assert.match(await panel.locator('[data-member-id="member-2"]').innerText(),/Nicht angemeldet[\s\S]*Noch kein Abruf erfasst/);
  assert.ok(!(await panel.innerHTML()).includes(sub.subscriptionUrl));
  await page.locator('#portal-subscriptions-filter').selectOption('no-push');assert.equal(await items.count(),4);
  await page.locator('#portal-subscriptions-search').fill('Ben');assert.equal(await items.count(),1);assert.match(await items.innerText(),/Ben/);
  await page.locator('#portal-subscriptions-filter').selectOption('no-calendar');assert.equal(await items.count(),1);
  await page.locator('#portal-subscriptions-search').fill('Anna');assert.equal(await items.count(),0);
  await page.locator('#portal-subscriptions-filter').selectOption('all');await page.locator('#portal-subscriptions-search').fill('');
  for(const width of [320,390,768,1180])for(const scale of [100,200]){await page.setViewportSize({width,height:1000});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width+'/'+scale);assert.equal(await panel.evaluate(n=>n.scrollWidth>n.clientWidth+1),false);}
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');
  if(process.env.CAPTURE_SUBSCRIPTIONS_HELP){const out=path.join(root,'assets/help/guide'),sizes=JSON.parse(fs.readFileSync(path.join(out,'screens.json'),'utf8'));await page.setViewportSize({width:768,height:1300});await page.locator('#portal-subscriptions-search').blur();await panel.screenshot({path:path.join(out,'geraetehaus-abos.jpg'),type:'jpeg',quality:80,animations:'disabled',style:'.top-nav,#headerProbeSummary{visibility:hidden!important}'});const box=await panel.boundingBox();sizes['geraetehaus-abos']={width:Math.round(box.width),height:Math.round(box.height)};fs.writeFileSync(path.join(out,'screens.json'),JSON.stringify(sizes,null,2)+'\n');}
  await page.evaluate(async token=>{PortalSubscriptionAdmin.clear();let initialized=false;DrinksStore.sourceKey=()=>initialized?'test-source':'';DrinksCentral.connection=async()=>{initialized=true;return {origin:'https://test.account.workers.dev',source:'test-source',token};};await PortalSubscriptionAdmin.load();},f.env.ADMIN_TOKEN);
  assert.equal(await items.count(),5,'first connection establishes an initially empty source context');
  const stored=await page.evaluate(()=>JSON.stringify([Object.fromEntries(Object.entries(localStorage)),Object.fromEntries(Object.entries(sessionStorage))]));assert.ok(!stored.includes('Anna'));assert.ok(!stored.includes('calendarLastFetchedAt'));
  for(const code of [503,403]){fail=code;await panel.getByRole('button',{name:'Abo-Status aktualisieren'}).click();await status.getByText(/Übersicht nicht geladen\. Künstlicher Statusfehler/).waitFor();assert.equal(await items.count(),0);}
  fail=0;await panel.getByRole('button',{name:'Abo-Status aktualisieren'}).click();await items.nth(4).waitFor();
  for(const mode of ['lock','source','logout']){
   hold=true;const ready=new Promise(resolve=>started=resolve);await panel.getByRole('button',{name:'Abo-Status aktualisieren'}).click();await ready;
   await page.evaluate(mode=>{if(mode==='lock')PortalAdmin.lock();else if(mode==='source'){DrinksStore.sourceKey=()=> 'other-source';PortalSubscriptionAdmin.storageChanged();}else{oneDriveAdministrationReady=()=>false;PortalSubscriptionAdmin.storageChanged();}},mode);
   release();await page.waitForTimeout(50);assert.equal(await items.count(),0,'late reply after '+mode);
   await page.evaluate(()=>{DrinksStore.sourceKey=()=> 'test-source';oneDriveAdministrationReady=()=>true;});await panel.getByRole('button',{name:'Abo-Status aktualisieren'}).click();await items.nth(4).waitFor();
  }
  await page.evaluate(()=>PortalAdmin.lock());assert.equal(await items.count(),0);assert.deepEqual(errors,[]);
  console.log('PASS private status from Worker + names from OneDrive, filters, unknown calendar state, no browser persistence, errors, late replies after lock/source/logout, 320–1180 px at 100/200%');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
