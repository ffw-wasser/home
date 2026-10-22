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
  const card=page.locator('#portal-admin-review-events .portal-event').first();await card.getByRole('button',{name:'Auswahl bearbeiten'}).click();
  assert.equal(await card.locator('.portal-recipient-list input:checked').count(),2);assert.match(await card.textContent(),/Auswahl: automatisch/);
  const recipients=card.locator('.portal-recipient-list input');await recipients.nth(2).check();await Promise.all([page.waitForResponse(r=>r.url().endsWith('/admin/portal/classify')),card.getByRole('button',{name:'Einordnung speichern',exact:true}).click()]);
  await page.waitForFunction(()=>document.querySelector('#portal-calendar-admin-status').textContent.includes('gespeichert'));
  assert.equal((await f.call('list',{},null,true)).value.events[0].recipientMode,'manual');
  const groups=page.locator('.portal-keyword-management');await groups.locator(':scope > summary').click();
  const committee=groups.locator('.portal-keyword-card').filter({has:page.locator('summary').filter({hasText:/^Ausschuss ·/})});
  await committee.locator(':scope > summary').click();assert.equal(await committee.locator('select').inputValue(),'committee');assert.match(await committee.textContent(),/1 zugeordnete Mitglieder/);
  await groups.getByRole('button',{name:'Neue Gruppe',exact:true}).click();const custom=groups.locator('.portal-keyword-card').last();
  await custom.locator('input.text-input').fill('Maschinisten');await custom.locator('textarea').fill('Maschinisten\nMA-Probe');await custom.locator('.portal-recipient-list input').nth(1).check();
  await groups.getByRole('button',{name:'Gruppen zentral speichern',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#portal-keyword-groups').textContent.includes('Zentral gespeichert · Stand 1'));
  assert.equal((await f.call('groups',{},null,true)).value.groups.at(-1).name,'Maschinisten');assert.equal((await f.call('list',{},null,true)).value.events[0].recipientMode,'manual');
  const legend=groups.locator('details').filter({has:page.locator('summary').filter({hasText:'Welche Schlagwörter wählen welche Mitglieder aus?'})}).last();await legend.locator(':scope > summary').click();assert.match(await legend.textContent(),/Maschinisten, MA-Probe → 1 Mitglieder/);
  if(await card.getByRole('button',{name:'Auswahl bearbeiten'}).isVisible())await card.getByRole('button',{name:'Auswahl bearbeiten'}).click();const auto=card.getByRole('button',{name:'Automatische Gruppenauswahl erneut übernehmen'});if(!await auto.isVisible())await card.getByRole('button',{name:'Termin bearbeiten',exact:false}).click();await auto.click();assert.equal(await card.locator('.portal-recipient-list input:checked').count(),2);
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/admin/portal/classify')),card.getByRole('button',{name:'Einordnung speichern',exact:true}).click()]);await page.waitForFunction(()=>document.querySelector('#portal-calendar-admin-status').textContent.includes('gespeichert'));
  assert.equal((await f.call('list',{},null,true)).value.events[0].recipientMode,'automatic');assert.equal((await f.call('list',{},null,true)).value.events[0].approved,false,'audience never approves event');
  for(const width of [320,390,412,768,1024]){await page.setViewportSize({width,height:900});await groups.locator('.portal-keyword-card').first().evaluate(n=>n.open=true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page overflow '+width);}
  await page.setViewportSize({width:390,height:844});await groups.screenshot({path:'/tmp/calendar-groups-mobile.png'});assert.deepEqual(errors,[]);console.log('Groups browser OK: flag-based committee, automatic import, manual correction, central save, dynamic legend, auto reapply, 320/390/412/768/1024.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
