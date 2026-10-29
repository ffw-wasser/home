// Synthetic member/admin sessions; exercises the real UI and Worker without production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomBytes,createHash}=require('node:crypto');
const {chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs'),E=require('../js/features/portal/member-evidence.js');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture(),person=f.people[0],now=Date.now(),token=randomBytes(32).toString('base64url'),credential='synthetic-evidence-browser';
 f.env.ADMIN_TOKEN='b'.repeat(64);
 const roster=await f.call('roster',{agtSource:'member-checkbox',members:f.people.map((p,i)=>({id:p.memberId,name:'Testperson '+(i+1),leader:i===0,agt:i===0,evidence:E.project({breathingQualified:i===0,machinistVehicles:i===0?['LF']:[],driverLicenseCheckedOn:'2020-01-01',driverLicenseIntervalMonths:12})}))},null,true);assert.equal(roster.status,200);
 f.sql.prepare('INSERT INTO portal_passkeys(id,alias,revision,public_key,counter,user_id) VALUES(?,?,?,?,0,?)').run(credential,person.alias,person.revision,'synthetic-public-key',credential);
 f.sql.prepare('INSERT INTO portal_identity_grants(id,alias) VALUES(?,?)').run(credential,person.alias);
 f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),person.alias,person.revision,credential,now,now+30*86400000);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];let dropReply=true,failOverview=false,holdOverview=false,releaseOverview,overviewHeld;const overviewHoldReady=new Promise(resolve=>overviewHeld=resolve);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(session=>localStorage.setItem('h2o-portal-identity-v1',JSON.stringify(session)),{scope:'portal',alias:person.alias,revision:person.revision,token,expiresAt:now+30*86400000});
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname.endsWith('workers.dev')){
    if(u.pathname==='/admin/portal/evidence/overview'&&failOverview)return route.fulfill({status:503,json:{error:'Künstlicher Ladefehler'}});
    const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);
    if(u.pathname==='/admin/portal/evidence/overview'&&holdOverview){holdOverview=false;overviewHeld();await new Promise(resolve=>releaseOverview=resolve);}
    if(dropReply&&u.pathname==='/portal/evidence/report'){dropReply=false;return route.abort();}
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   if(u.origin==='https://ffw-wasser.github.io'){
    const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   }
   return route.abort();
  });
  const url='https://ffw-wasser.github.io/home/';
  await page.goto(url+'deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('#portal-section').hidden);
  assert.equal(await page.locator('#bookings,.booking-history,.privacy-note').count(),0,'no personal booking history or repeated link footer');
  await page.locator('#portal-priority-text p').first().waitFor({state:'attached'});
  assert.match(await page.locator('#portal-priority-text').textContent(),/Abgelaufen|Nachweis fehlt/);
  assert.equal(await page.locator('#portal-priority').isVisible(),false,'evidence warnings stay hidden on the initial appointment page');
  for(const target of ['portal-evidence','portal-section','account','more-training','deckel-more']){await page.evaluate(target=>DeckelMobile.jump(target),target);assert.equal(await page.locator('#portal-priority').isVisible(),target==='portal-evidence','evidence warning visibility follows its own page: '+target);}
  await page.evaluate(()=>DeckelMobile.jump('portal-section'));await page.evaluate(()=>H2OPortal.refreshEvidence());assert.equal(await page.locator('#portal-priority').isVisible(),false,'background evidence refresh cannot reveal warnings over appointments');
  await page.evaluate(()=>DeckelMobile.jump('portal-evidence'));
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-status').textContent.includes('Vorwarnung:'));
  assert.match(await page.locator('#portal-evidence-status').textContent(),/Datenstand: [^\n]+\nVorwarnung: 60 Tage\./);
  assert.equal(await page.locator('#portal-evidence-status').evaluate(n=>getComputedStyle(n).whiteSpace),'pre-line','data status preserves the line break');
  await page.getByRole('button',{name:'FFI aktualisieren',exact:true}).click();
  const today=E.day(now);
  await page.locator('#self-evidence-checkedOn').fill(today);await page.locator('#self-evidence-responsibility').check();
  await page.getByRole('button',{name:'Eigenangabe speichern',exact:true}).click();
  await page.getByRole('button',{name:'Speicherung erneut prüfen',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>{const button=[...document.querySelectorAll('button')].find(n=>n.textContent==='Speicherung erneut prüfen');return button&&!button.disabled;});
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,1);
  await page.getByRole('button',{name:'Speicherung erneut prüfen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-status').textContent.includes('Eigenangabe gespeichert'));
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,1,'retry does not duplicate audit');
  assert.match(await page.locator('#portal-evidence-details').textContent(),/Eigenangabe/);
  await page.getByRole('button',{name:'G26.3 aktualisieren',exact:true}).click();await page.locator('#self-evidence-checkedOn').fill(today);
  const month=E.due(today,12).slice(0,7);await page.locator('#self-evidence-validMonth').fill(month);await page.locator('#self-evidence-responsibility').check();await page.getByRole('button',{name:'Eigenangabe speichern',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-status').textContent.includes('Eigenangabe gespeichert'));
  await page.getByRole('button',{name:'Führerscheinkontrolle aktualisieren',exact:true}).click();await page.locator('#self-evidence-checkedOn').fill(today);await page.locator('#self-evidence-controller').fill('Test-Kontrollperson');await page.locator('#self-evidence-responsibility').check();await page.getByRole('button',{name:'Eigenangabe speichern',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-status').textContent.includes('wartet auf Bestätigung'));
  let result=(await f.call('evidence')).value;assert.equal(result.entries.driver.status,'pending');assert.equal(result.evidence.driver.checkedOn,'2020-01-01');
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'self evidence fits '+width);}
  await page.screenshot({path:'/tmp/h2o-self-evidence.png',fullPage:true});
  await page.goto(url+'index.html');await page.evaluate(()=>AppStartup.update({ready:true}));await page.locator('#appStartup').waitFor({state:'hidden'});
  await page.evaluate(({adminToken,id})=>{
   window.requireAdmin=()=>true;oneDriveAdministrationReady=()=>true;adminUnlocked=true;resetAdminTimeout();
   window.oneDriveReadState=async()=>({members:[{id,firstName:'Testperson',lastName:'1'}]});
   DrinksCentral.connection=async()=>({origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',source:'test-source',token:adminToken});DrinksStore.sourceKey=()=> 'test-source';
   showView('settingsPortalView');
  },{adminToken:f.env.ADMIN_TOKEN,id:person.memberId});
  await page.locator('#portal-admin-member option[value="'+person.memberId+'"]').waitFor({state:'attached'});
  await page.locator('.portal-evidence-overview-item').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.portal-evidence-overview-item').count(),3,'all existing self reports appear without selecting a member');
  assert.match(await page.locator('#portal-evidence-overview').textContent(),/Ungeprüfte Nachweisänderungen \(3\)/);
  for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:844});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.equal(await page.locator('#portal-evidence-overview').evaluate(n=>n.scrollWidth<=n.clientWidth),true,'central evidence overview fits '+width+'/'+scale);}
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:390,height:844});await page.locator('#portal-evidence-overview').screenshot({path:'/tmp/h2o-evidence-overview-mobile.png'});
  failOverview=true;await page.getByRole('button',{name:'Übersicht aktualisieren',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#portal-evidence-overview').textContent.includes('Übersicht nicht geladen.'));
  assert.ok(!(await page.locator('#portal-evidence-overview').textContent()).includes('Keine ungeprüften Nachweisänderungen'),'load failures do not claim an empty review queue');
  failOverview=false;await page.getByRole('button',{name:'Übersicht aktualisieren',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.portal-evidence-overview-item').length===3);
  holdOverview=true;const heldResponse=page.waitForResponse(response=>response.url().endsWith('/admin/portal/evidence/overview'));
  await page.getByRole('button',{name:'Übersicht aktualisieren',exact:true}).click();await overviewHoldReady;await page.evaluate(()=>showView('settingsMembersView'));releaseOverview();await (await heldResponse).finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.portal-evidence-overview-item').count(),0,'late overview response cannot refill private data after leaving');
  await page.evaluate(()=>showView('settingsPortalView'));await page.waitForFunction(()=>document.querySelectorAll('.portal-evidence-overview-item').length===3);
  await page.getByRole('button',{name:'Testperson 1 · Führerscheinkontrolle prüfen',exact:true}).click();
  const card=page.locator('.portal-evidence-review-card').filter({has:page.getByRole('heading',{name:'Führerscheinkontrolle',exact:true})});await card.waitFor({state:'visible'}).catch(async error=>{console.error('Admin evidence:',await page.locator('#portal-evidence-admin').textContent(),errors);await page.screenshot({path:'/tmp/evidence-admin-debug.png',fullPage:true});throw error;});
  await card.getByRole('button',{name:'Nach Prüfung bestätigen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-admin').textContent.includes('Nachweisänderung gespeichert'));
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-overview h3').textContent.includes('(2)'));
  assert.equal(await page.getByRole('button',{name:'Testperson 1 · Führerscheinkontrolle prüfen',exact:true}).count(),0,'confirmed item leaves central overview');
  result=(await f.call('evidence')).value;assert.equal(result.entries.driver.status,'confirmed');assert.equal(result.evidence.driver.checkedOn,today);
  await page.getByRole('button',{name:'Testperson 1 · FFI prüfen',exact:true}).click();
  const ffiCard=page.locator('.portal-evidence-review-card[data-evidence-field="ffi"]');page.once('dialog',dialog=>dialog.accept());await ffiCard.getByRole('button',{name:'Eigenangabe ablehnen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-overview h3').textContent.includes('(1)'));
  await page.getByRole('button',{name:'Testperson 1 · G26.3 prüfen',exact:true}).click();
  await page.locator('.portal-evidence-review-card[data-evidence-field="g263"]').getByRole('button',{name:'Nach Prüfung bestätigen',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#portal-evidence-overview').textContent.includes('Keine ungeprüften Nachweisänderungen vorhanden.'));
  await page.evaluate(()=>showView('settingsMembersView'));assert.equal(await page.locator('.portal-evidence-overview-item').count(),0,'leaving the view clears private overview data');
  await page.goto(url+'deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('#portal-section').hidden);await page.evaluate(()=>DeckelMobile.jump('portal-evidence'));
  await page.locator('.portal-evidence-group[data-group="Führerscheinkontrolle"] .portal-evidence-item[data-state="valid"]').waitFor({state:'visible'});
  assert.match(await page.locator('.portal-evidence-group[data-group="Führerscheinkontrolle"] .portal-evidence-source').textContent(),/Verwaltung/);
  assert.deepEqual(errors,[]);console.log('Evidence browser OK: own FFI/G26, consent, lost-response retry, pending driver report, administrative confirmation and updated status.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
