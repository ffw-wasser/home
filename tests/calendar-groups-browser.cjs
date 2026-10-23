// Real admin DOM and Worker, synthetic members, no Microsoft or production writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture(),members=f.people.map((p,i)=>({id:p.memberId,firstName:'Testperson',lastName:String(i+1),roles:i===0?['GF']:[],breathingQualified:i<2,committeeMember:i===2,ageDepartment:i===4}));
 f.env.ADMIN_TOKEN='b'.repeat(64);
 // Treat the upcoming appointment as a new import, so automatic membership needs no approval.
 f.sql.prepare('DELETE FROM portal_rules').run();const row=f.sql.prepare('SELECT * FROM portal_calendar').get(),cal=await f.L.open(f.env,row.payload,'portal-calendar');cal.events[0].title='Sonderprobe Atemschutz';f.sql.prepare('UPDATE portal_calendar SET payload=?').run(await f.L.seal(f.env,cal,'portal-calendar'));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
   if(u.hostname.endsWith('workers.dev')){const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
   if(u.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});}return route.abort();
  });
  await page.goto('https://ffw-wasser.github.io/home/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
  await page.evaluate(({members,token})=>{
   window.requireAdmin=()=>true;oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;adminUnlocked=true;resetAdminTimeout();
   window.oneDriveReadState=async()=>({members});DrinksCentral.connection=async()=>({origin:'https://test.account.workers.dev',source:'test-source',token});DrinksStore.sourceKey=()=> 'test-source';showView('settingsCalendarView');
  },{members,token:f.env.ADMIN_TOKEN});
await page.locator('.portal-keyword-card').first().waitFor({state:'attached'}).catch(async e=>{console.error(await page.locator('#settingsCalendarView').textContent(),errors);throw e;});
  await page.locator('.calendar-google-help').first().locator(':scope > summary').click();await page.locator('.calendar-help-reference > summary').click();assert.match(await page.locator('.calendar-google-help').first().innerText(),/aus eindeutigen Titeln erkannt/);assert.match(await page.locator('#calendar-help-groups').innerText(),/Atemschutz/);assert.match(await page.locator('#calendar-help-groups').innerText(),/AGT/);for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'keyword help overflow '+width);if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.locator('.calendar-google-help').first().screenshot({path:path.join(process.env.QA_OUTPUT,'kalender-hilfe-'+width+'.png')});}}await page.setViewportSize({width:390,height:844});await page.locator('.calendar-google-help').first().locator(':scope > summary').click();
  const card=page.locator('#portal-admin-review-events .portal-event').first();
  assert.equal(await card.locator('h4').textContent(),'Sonderprobe Atemschutz');
  await card.locator('.portal-event-people summary').click();assert.equal(await card.locator('.portal-name-list li').count(),2);
  await card.getByRole('button',{name:'Bearbeiten',exact:true}).click();
  assert.equal(await card.locator('.portal-recipient-list input:checked').count(),2);assert.match(await card.textContent(),/automatisch/);
  const recipients=card.locator('.portal-recipient-list input');await recipients.nth(2).check();
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/admin/portal/classify')),card.getByRole('button',{name:'Speichern',exact:true}).click()]);
  await card.locator('.portal-event-feedback').filter({hasText:'Änderungen gespeichert.'}).waitFor();
  assert.equal((await f.call('list',{},null,true)).value.events[0].recipientMode,'manual');
  await page.getByRole('button',{name:'Gruppen',exact:true}).click();const groups=page.locator('#portal-calendar-groups');
  const groupCard=name=>groups.locator('.portal-keyword-card').filter({has:page.getByRole('heading',{name,exact:true})});
  const committee=groupCard('Ausschuss');await committee.locator('summary').click();
  assert.match(await committee.textContent(),/Zugeordnete Personen \(1\)/);assert.equal(await committee.locator('.portal-name-list li').count(),1);assert.match(await committee.locator('.portal-name-list').textContent(),/Testperson/);
  const agt=groupCard('Atemschutz');assert.equal(await agt.getAttribute('open'),null);await agt.locator('summary').click();assert.equal(await agt.locator('.portal-name-list li').count(),2);assert.equal(await agt.locator('.portal-name-list').isVisible(),true,'Automatic group names visible without editing');await agt.locator('summary').click();assert.equal(await agt.locator('.portal-name-list').isVisible(),false);await agt.locator('summary').click();assert.equal(await agt.locator('.portal-name-list').isVisible(),true);
  await committee.getByRole('button',{name:'Gruppe bearbeiten'}).click();assert.equal(await committee.getByLabel('Personen zuordnen über').inputValue(),'committee');
  await committee.getByLabel('Gruppenname',{exact:true}).fill('Ausschuss Entwurf');
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Termine',exact:true}).click();assert.equal(await groups.isVisible(),true);assert.equal(await committee.count(),0);
  const draft=groupCard('Ausschuss Entwurf');assert.equal(await draft.getByLabel('Gruppenname',{exact:true}).inputValue(),'Ausschuss Entwurf');
  page.once('dialog',d=>d.accept());await draft.getByRole('button',{name:'Abbrechen',exact:true}).click();assert.equal(await committee.count(),1);
  await groups.getByRole('button',{name:'Neue Gruppe',exact:true}).click();const custom=groupCard('Neue Gruppe');
  await custom.locator('textarea').fill('Maschinisten\nMA-Probe');await custom.locator('.portal-recipient-list input').nth(1).check();await custom.getByLabel('Gruppenname',{exact:true}).fill('Maschinisten');
  const maschinisten=groupCard('Maschinisten');
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/admin/portal/groups')&&!!r.request().postDataJSON()?.groups),maschinisten.getByRole('button',{name:'Gruppe speichern',exact:true}).click()]);
  await maschinisten.getByRole('button',{name:'Gruppe bearbeiten'}).waitFor();
  assert.equal((await f.call('groups',{},null,true)).value.groups.at(-1).name,'Maschinisten');assert.match(await page.locator('#calendar-help-groups').textContent(),/MA-Probe/,'help follows saved custom group keywords');assert.equal((await f.call('list',{},null,true)).value.events[0].recipientMode,'manual');
  const tester=groups.locator('.portal-group-tester');await tester.getByLabel('Termintitel').fill('Atemschutz Maschinisten');await tester.getByRole('button',{name:'Zuordnung anzeigen'}).click();assert.equal(await tester.locator('.portal-name-list li').count(),2,'Overlapping members shown once');
  for(const width of [320,390,412,768,1024]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Group page fits '+width);
   await page.getByRole('button',{name:'Termine',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Events fit '+width);
   await card.getByRole('button',{name:'Bearbeiten',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Editor fits '+width);
   await card.getByRole('button',{name:'Abbrechen',exact:true}).click();await page.getByRole('button',{name:'Verbindung',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Connection fits '+width);
   await page.getByRole('button',{name:'Gruppen',exact:true}).click();
  }
  await page.setViewportSize({width:390,height:844});await agt.screenshot({path:path.join(require('node:os').tmpdir(),'calendar-group-new-mobile.png')});
  await page.getByRole('button',{name:'Termine',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(require('node:os').tmpdir(),'calendar-new-mobile.png'),fullPage:true});
  await card.getByRole('button',{name:'Bearbeiten',exact:true}).click();const auto=card.getByRole('button',{name:'Automatische Gruppenauswahl erneut übernehmen'});await auto.click();assert.equal(await card.locator('.portal-recipient-list input:checked').count(),2);
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/admin/portal/classify')),card.getByRole('button',{name:'Speichern',exact:true}).click()]);await card.getByRole('button',{name:'Bearbeiten',exact:true}).waitFor();
  assert.equal((await f.call('list',{},null,true)).value.events[0].recipientMode,'automatic');assert.equal((await f.call('list',{},null,true)).value.events[0].approved,false,'Audience never approves event');
  await page.setViewportSize({width:1024,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(require('node:os').tmpdir(),'calendar-new-tablet.png'),fullPage:true});
  await card.getByRole('button',{name:'Google-Angaben übernehmen',exact:true}).click();await card.locator('.portal-google-source').filter({hasText:'Angaben aus Google Kalender'}).waitFor();assert.equal((await f.call('list',{},null,true)).value.events[0].googleManaged,true);await page.getByRole('button',{name:'Gruppen',exact:true}).click();await page.evaluate(()=>PortalAdmin.lock());assert.equal(await groups.locator('.portal-name-list li').count(),0,'Lock removes private names');assert.equal(await tester.count(),0,'Lock removes title test and results');
  assert.deepEqual(errors,[]);console.log('Calendar browser OK: visible automatic names, effective audience, group/term editing, draft guards, resolver, tabs, privacy, 320/390/412/768/1024.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
