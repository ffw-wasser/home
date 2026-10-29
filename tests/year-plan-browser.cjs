// Local application resources and synthetic calendar only; no production writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.stack));
  let publicRequests=0;
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});}if(url.pathname==='/calendar/public')publicRequests++;return route.abort();});
  await page.goto('https://ffw-wasser.github.io/home/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.locator('[id]').evaluateAll(nodes=>{const seen=new Set();return nodes.map(n=>n.id).filter(id=>seen.has(id)||!seen.add(id));}),[],'unique DOM identifiers');
  await page.locator('#menuToggleButton').click();assert.deepEqual(await page.locator('#compactMenu button').allTextContents(),['Historie','Statistik','Jahresplan','Pläne & Pegel','Veranstaltungen','🔒 Verwaltung','Infos']);
  await page.locator('#plansTab').click();assert.equal(await page.locator('#plansView #hydrants-ipad-open').isVisible(),true);assert.equal(await page.locator('#helpView #hydrants-ipad-open').count(),0);assert.match(await page.locator('#plansView').textContent(),/Pegel Gutach/);assert.equal(await page.locator('#plansTab').getAttribute('aria-current'),'page');
  await page.locator('#menuToggleButton').click();await page.locator('#eventsTab').click();assert.equal(await page.locator('#eventsView').isVisible(),true);assert.equal(await page.locator('#theaterView').isVisible(),false);
  await page.locator('#menuToggleButton').click();
  await page.locator('#settingsTab').click();assert.equal(await page.locator('#adminLoginView').isVisible(),true);assert.equal(await page.locator('#settingsView').isVisible(),false);
  await page.locator('#cancelLoginButton').click();
  await page.evaluate(()=>{oneDriveAdministrationReady=()=>true;adminUnlocked=true;resetAdminTimeout();showView('settingsView');});
  assert.equal(await page.locator('#settingsView .administration-card').count(),6);assert.equal(await page.locator('#settingsView [data-settings-page="settingsBacklogView"]').count(),1);
  for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'administration overflow '+width);}
  await page.evaluate(()=>{
   window.oneDriveReadState=async()=>({members:[]});DrinksCentral.connection=async()=>({origin:'https://test.example.workers.dev',source:'test-source'});DrinksStore.sourceKey=()=> 'test-source';window.qaYearCalls=[];window.qaYearFailures=1;
   DrinksPush.request=async(c,p,data)=>{if(!p.endsWith('/year'))return {events:[],groups:[],members:[],configured:true};qaYearCalls.push({path:p,year:data.year});if(qaYearFailures){qaYearFailures--;throw new TypeError('Load failed');}const y=data.year;return {year:y,configured:true,fetchedAt:Date.now(),events:[{id:'past',title:'Probe Jahresbeginn',start:Date.parse(y+'-01-02T18:30:00Z'),end:Date.parse(y+'-01-02T20:00:00Z'),kind:'probe',approved:false,recipientIds:['anderes-mitglied'],location:'Gerätehaus',clothing:'Tagesdienst'},{id:'birthday',title:'Geburtstag Testperson',start:Date.parse(y+'-02-01T23:00:00Z'),end:Date.parse(y+'-02-02T23:00:00Z'),allDay:true,kind:'birthday'},{id:'other',title:'Veranstaltung',start:Date.parse(y+'-06-10T16:00:00Z'),end:Date.parse(y+'-06-10T18:00:00Z'),kind:'other'}]};};lockAdministration();showView('yearPlanView');
  });
  await page.locator('#year-plan-status').filter({hasText:'Vollständiger Jahresplan'}).waitFor().catch(async e=>{console.error(await page.locator('#year-plan-status').textContent(),errors);throw e;});
  assert.equal(await page.locator('.year-plan-month').count(),12);assert.equal(await page.locator('.year-plan-event').count(),2);
  assert.equal(await page.locator('.year-plan-holiday').count(),6,'one label at each holiday start, plus the ongoing holiday on January 1');
  assert.equal(await page.locator('.year-plan-day.is-holiday').count(),88,'all 88 school-holiday days in 2026 remain highlighted');
  assert.equal(await page.locator('.year-plan-public-holiday').count(),12);assert.match(await page.locator('#year-plan-month-0').textContent(),/Heilige Drei Könige/);
  const currentMonth=await page.evaluate(()=>Number(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',month:'2-digit'}).format(new Date()))-1);
  const atMonth=month=>page.waitForFunction(month=>{const n=document.querySelector('#year-plan-month-'+month),r=n.getBoundingClientRect();return document.querySelector('#year-plan-month').value===String(month)&&r.top>=0&&r.top<innerHeight;},month);
  await atMonth(currentMonth);await page.locator('#year-plan-month').selectOption('0');await atMonth(0);const beforeToday=await page.evaluate(()=>qaYearCalls.length);await page.locator('#year-plan-today').click();await atMonth(currentMonth);assert.equal(await page.evaluate(()=>qaYearCalls.length),beforeToday,'Today is navigation, not another fetch');
  assert.equal(await page.evaluate(()=>adminUnlocked),false,'all appointments without administration PIN');assert.equal(await page.locator('#year-plan-unlock').count(),0);assert.equal(await page.evaluate(()=>qaYearCalls.length),2,'one failed read is retried');assert.equal(publicRequests,0,'never use the reduced public calendar');
  assert.match(await page.locator('#year-plan-month-0').textContent(),/19:30 Uhr · Probe Jahresbeginn/);
  assert.equal(await page.locator('.is-birthday').count(),0,'Main annual plan excludes birthdays');assert.equal(await page.locator('#year-plan-birthdays').count(),0);assert.doesNotMatch(await page.locator('#yearPlanView').textContent(),/Geburtstag/);
  await page.locator('#year-plan-filter').selectOption('probe');assert.equal(await page.locator('.year-plan-event').count(),1);await page.locator('#year-plan-filter').selectOption('all');
  for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'annual plan overflow '+width);if(width<=600){const today=await page.locator('#year-plan-today').boundingBox();assert.ok(today.width>=100&&today.height>=48,'large Today target '+width);}await page.evaluate(()=>document.getElementById('year-plan-month-11').scrollIntoView());const tools=await page.locator('#yearPlanView>.year-plan-controls').boundingBox(),nav=await page.locator('.top-nav').boundingBox();assert.ok(tools.y>=nav.y+nav.height-2&&tools.y<=nav.y+nav.height+2,'year plan controls stick below navigation '+width);for(const id of ['year-plan-year','year-plan-month','year-plan-today','year-plan-filter','year-plan-holidays']){const r=await page.locator('#'+id).boundingBox();assert.ok(r.y>=tools.y&&r.y+r.height<=tools.y+tools.height+1,'sticky control stays inside toolbar '+id+' '+width);}}
  await page.locator('#year-plan-year').fill('2026');await page.locator('#year-plan-year').dispatchEvent('change');await page.locator('#year-plan-status').filter({hasText:'Vollständiger Jahresplan'}).waitFor();
  assert.match(await page.locator('#year-plan-month-0').textContent(),/Weihnachtsferien/);assert.match(await page.locator('#year-plan-month-11').textContent(),/Weihnachtsferien/);
  await page.locator('#year-plan-year').fill('2025');await page.locator('#year-plan-year').dispatchEvent('change');await page.locator('#year-plan-heading-year').filter({hasText:'2025'}).waitFor();await page.locator('#year-plan-today').click();await page.locator('#year-plan-status').filter({hasText:'Vollständiger Jahresplan'}).waitFor();await atMonth(currentMonth);
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-desktop.png')});await page.pdf({path:path.join(process.env.QA_OUTPUT,'jahresplan-test.pdf'),preferCSSPageSize:true,printBackground:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-handy.png')});}
  await page.evaluate(()=>{lockAdministration();});assert.equal(await page.locator('.year-plan-event').count(),2,'administration lock keeps the read-only annual view available');
  await page.evaluate(()=>{qaYearFailures=2;});await page.locator('#year-plan-reload').click();await page.locator('#year-plan-status').filter({hasText:'Die Verbindung wurde unterbrochen'}).waitFor();assert.equal(await page.locator('.year-plan-event').count(),0);assert.doesNotMatch(await page.locator('#year-plan-status').textContent(),/Load failed/);
  await page.locator('#year-plan-month').selectOption('0');await atMonth(0);const failedCalls=await page.evaluate(()=>qaYearCalls.length);await page.locator('#year-plan-today').click();await atMonth(currentMonth);assert.equal(await page.evaluate(()=>qaYearCalls.length),failedCalls);
  await page.locator('#year-plan-reload').click();await page.locator('#year-plan-status').filter({hasText:'Vollständiger Jahresplan'}).waitFor();assert.equal(await page.locator('.year-plan-event').count(),2);
  await page.locator('#year-plan-print').click();await page.locator('#year-plan-pdf-dialog').waitFor();assert.equal(await page.locator('#year-plan-pdf-dialog').isVisible(),true,'shared PDF available without administration PIN');await page.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.evaluate(()=>endOneDriveSession());assert.equal(await page.locator('.year-plan-event').count(),0,'disconnect removes the full annual data immediately');assert.doesNotMatch(await page.locator('#yearPlanView').textContent(),/Testperson/);
  await page.evaluate(()=>{oneDriveAdministrationReady=()=>false;});await page.locator('#year-plan-reload').click();await page.locator('#year-plan-status').filter({hasText:'Eine Verwaltungs-PIN ist nicht erforderlich'}).waitFor();assert.equal(publicRequests,0);assert.equal(await page.locator('#adminLoginView').isVisible(),false);
  await page.evaluate(()=>{oneDriveAdministrationReady=()=>true;});
  await page.evaluate(()=>{showView('settingsView');});assert.equal(await page.locator('#settingsView').isVisible(),false);
  // Production is paused: the old entry opens the protected backlog, not the bonus form.
  await page.evaluate(()=>{adminUnlocked=true;resetAdminTimeout();showView('settingsRewardsView');});
  assert.equal(await page.locator('#settingsBacklogView').isVisible(),true);
  assert.equal(await page.locator('#birthday-assignments-load').isVisible(),false);
  // Isolated synthetic future-rollout scenario keeps the retained birthday editor covered.
  await page.evaluate(()=>{globalThis.H2OFeatures=Object.freeze({rewards:true,challenge:true});delete document.documentElement.dataset.loyalty;});
  await page.evaluate(()=>{
   adminUnlocked=true;resetAdminTimeout();window.qaBirthday={id:'birthday-test',seriesId:'series-test',title:'Geburtstag Testperson',start:Date.now()+86400000,end:Date.now()+90000000,kind:'birthday',memberId:null};window.qaBirthday2={...qaBirthday,id:'birthday-second',seriesId:'series-second',title:'Geburtstag Zweite Testperson'};window.qaBirthdayVersion=0;
   window.oneDriveReadState=async()=>({members:[{id:'test-person',lastName:'Testperson',firstName:'Anna'}]});
   DrinksPush.request=async(c,p,data)=>{if(p.endsWith('/classify')){if(data.expectedVersion!==qaBirthdayVersion)throw Error('Version conflict');qaBirthdayVersion++;[qaBirthday,qaBirthday2].find(e=>e.id===data.eventId).memberId=data.memberId;return {version:qaBirthdayVersion};}return {rulesVersion:qaBirthdayVersion,events:[qaBirthday,qaBirthday2],stale:false};};showView('settingsRewardsView');
  });
  await page.locator('#birthday-assignments-load').click();await page.locator('#birthday-assignments-list select').nth(0).selectOption('test-person');await page.locator('#birthday-assignments-list select').nth(1).selectOption('test-person');await page.getByRole('button',{name:'Zuordnung speichern',exact:true}).nth(0).click();
  await page.locator('#birthday-assignments-status').filter({hasText:'Zuordnung gespeichert.'}).waitFor();assert.equal(await page.evaluate(()=>qaBirthday.memberId),'test-person');
  assert.equal(await page.locator('#birthday-assignments-list select').nth(1).inputValue(),'test-person','saving one birthday retains the other unsaved assignment');assert.equal(await page.evaluate(()=>qaBirthday2.memberId),null);
  page.once('dialog',d=>d.dismiss());await page.evaluate(()=>showView('settingsDrinksView'));assert.equal(await page.locator('#settingsRewardsView').isVisible(),true);assert.equal(await page.locator('#birthday-assignments-list select').nth(1).inputValue(),'test-person');
  page.once('dialog',d=>d.accept());await page.evaluate(()=>showView('settingsDrinksView'));assert.equal(await page.locator('#birthday-assignments-list select').count(),0,'confirmed discard removes stale form values');
  await page.evaluate(()=>showView('settingsRewardsView'));await page.locator('#birthday-assignments-load').click();assert.equal(await page.locator('#birthday-assignments-list select').nth(1).inputValue(),'');await page.locator('#birthday-assignments-list select').nth(1).selectOption('test-person');
  await page.getByRole('button',{name:'Zuordnung speichern',exact:true}).nth(1).click();await page.locator('#birthday-assignments-status').filter({hasText:'Zuordnung gespeichert.'}).waitFor();assert.equal(await page.evaluate(()=>qaBirthday2.memberId),'test-person');
  await page.evaluate(()=>lockAdministration());assert.equal(await page.locator('#birthday-assignments-list').textContent(),'');
  assert.deepEqual(errors,[]);console.log('PASS navigation, protected overview, cancellation, 12 months, past dates, Berlin time, hidden main birthdays, appointment filters, holidays, 320–1024 px, private-content removal');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
