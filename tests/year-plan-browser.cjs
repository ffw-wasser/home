// Local application resources and synthetic calendar only; no production writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.stack));
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});}if(url.hostname==='test.example.workers.dev')return route.fulfill({json:{year:Number(url.searchParams.get('year')),configured:true,stale:false,fetchedAt:Date.now(),events:[]}});return route.abort();});
  await page.goto('https://ffw-wasser.github.io/home/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.locator('[id]').evaluateAll(nodes=>{const seen=new Set();return nodes.map(n=>n.id).filter(id=>seen.has(id)||!seen.add(id));}),[],'unique DOM identifiers');
  await page.locator('#menuToggleButton').click();assert.deepEqual(await page.locator('#compactMenu button').allTextContents(),['Jahresplan','Pläne & Pegel','Veranstaltungen','🔒 Verwaltung','Infos']);
  await page.locator('#plansTab').click();assert.equal(await page.locator('#plansView #hydrants-ipad-open').isVisible(),true);assert.equal(await page.locator('#helpView #hydrants-ipad-open').count(),0);assert.match(await page.locator('#plansView').textContent(),/Pegel Gutach/);assert.equal(await page.locator('#plansTab').getAttribute('aria-current'),'page');
  await page.locator('#menuToggleButton').click();await page.locator('#eventsTab').click();assert.equal(await page.locator('#eventsView').isVisible(),true);assert.equal(await page.locator('#theaterView').isVisible(),false);
  await page.locator('#menuToggleButton').click();
  await page.locator('#settingsTab').click();assert.equal(await page.locator('#adminLoginView').isVisible(),true);assert.equal(await page.locator('#settingsView').isVisible(),false);
  await page.locator('#cancelLoginButton').click();
  await page.evaluate(()=>{oneDriveAdministrationReady=()=>true;adminUnlocked=true;resetAdminTimeout();showView('settingsView');});
  assert.equal(await page.locator('#settingsView .administration-card').count(),5);
  for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'administration overflow '+width);}
  await page.evaluate(()=>{
   window.oneDriveReadState=async()=>({members:[]});DrinksCentral.connection=async()=>({origin:'https://test.example.workers.dev',source:'test-source'});DrinksStore.sourceKey=()=> 'test-source';
   DrinksPush.request=async(c,p,data)=>{if(!p.endsWith('/year'))return {events:[],groups:[],members:[],configured:true};const y=data.year;return {year:y,configured:true,fetchedAt:Date.now(),events:[{id:'past',title:'Probe Jahresbeginn',start:Date.parse(y+'-01-02T18:30:00Z'),end:Date.parse(y+'-01-02T20:00:00Z'),kind:'probe',location:'Gerätehaus',clothing:'Tagesdienst'},{id:'birthday',title:'Geburtstag Testperson',start:Date.parse(y+'-02-01T23:00:00Z'),end:Date.parse(y+'-02-02T23:00:00Z'),allDay:true,kind:'birthday'},{id:'other',title:'Veranstaltung',start:Date.parse(y+'-06-10T16:00:00Z'),end:Date.parse(y+'-06-10T18:00:00Z'),kind:'other'}]};};showView('yearPlanView');
  });
  await page.locator('#year-plan-status').filter({hasText:'Vollständiger Jahresplan'}).waitFor().catch(async e=>{console.error(await page.locator('#year-plan-status').textContent(),errors);throw e;});
  assert.equal(await page.locator('.year-plan-month').count(),12);assert.equal(await page.locator('.year-plan-event').count(),3);
  assert.match(await page.locator('#year-plan-month-0').textContent(),/19:30 Uhr · Probe Jahresbeginn/);
  assert.match(await page.locator('.is-birthday').textContent(),/Ganztägig/);assert.doesNotMatch(await page.locator('.is-birthday').textContent(),/Uhr/);
  await page.locator('#year-plan-filter').selectOption('probe');assert.equal(await page.locator('.year-plan-event').count(),2,'birthdays are independent of appointment filter');
  await page.locator('#year-plan-birthdays').uncheck();assert.equal(await page.locator('.is-birthday').count(),0);
  await page.locator('#year-plan-filter').selectOption('all');await page.locator('#year-plan-birthdays').check();
  for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'annual plan overflow '+width);}
  await page.locator('#year-plan-year').fill('2026');await page.locator('#year-plan-year').dispatchEvent('change');await page.locator('#year-plan-status').filter({hasText:'Vollständiger Jahresplan'}).waitFor();
  assert.match(await page.locator('#year-plan-month-0').textContent(),/Weihnachtsferien/);assert.match(await page.locator('#year-plan-month-11').textContent(),/Weihnachtsferien/);
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-desktop.png')});await page.pdf({path:path.join(process.env.QA_OUTPUT,'jahresplan-test.pdf'),preferCSSPageSize:true,printBackground:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'jahresplan-handy.png')});}
  await page.evaluate(()=>{lockAdministration();});assert.equal(await page.locator('.year-plan-event').count(),0);assert.doesNotMatch(await page.locator('#yearPlanView').textContent(),/Testperson/);
  await page.evaluate(()=>{showView('settingsView');});assert.equal(await page.locator('#settingsView').isVisible(),false);
  await page.evaluate(()=>{
   adminUnlocked=true;resetAdminTimeout();window.qaBirthday={id:'birthday-test',seriesId:'series-test',title:'Geburtstag Testperson',start:Date.now()+86400000,end:Date.now()+90000000,kind:'birthday',memberId:null};window.qaBirthday2={...qaBirthday,id:'birthday-second',seriesId:'series-second',title:'Geburtstag Zweite Testperson'};window.qaBirthdayVersion=0;
   window.oneDriveReadState=async()=>({members:[{id:'test-person',lastName:'Testperson',firstName:'Anna'}]});
   DrinksPush.request=async(c,p,data)=>{if(p.endsWith('/classify')){if(data.expectedVersion!==qaBirthdayVersion)throw Error('Version conflict');qaBirthdayVersion++;[qaBirthday,qaBirthday2].find(e=>e.id===data.eventId).memberId=data.memberId;return {version:qaBirthdayVersion};}return {rulesVersion:qaBirthdayVersion,events:[qaBirthday,qaBirthday2],stale:false};};showView('settingsRewardsView');
  });
  await page.locator('#birthday-assignments-load').click();await page.locator('#birthday-assignments-list select').nth(0).selectOption('test-person');await page.locator('#birthday-assignments-list select').nth(1).selectOption('test-person');await page.getByRole('button',{name:'Zuordnung speichern',exact:true}).nth(0).click();
  await page.locator('#birthday-assignments-status').filter({hasText:'Zuordnung gespeichert.'}).waitFor();assert.equal(await page.evaluate(()=>qaBirthday.memberId),'test-person');
  assert.equal(await page.locator('#birthday-assignments-list select').nth(1).inputValue(),'test-person','saving one birthday retains the other unsaved assignment');assert.equal(await page.evaluate(()=>qaBirthday2.memberId),null);
  await page.getByRole('button',{name:'Zuordnung speichern',exact:true}).nth(1).click();await page.locator('#birthday-assignments-status').filter({hasText:'Zuordnung gespeichert.'}).waitFor();assert.equal(await page.evaluate(()=>qaBirthday2.memberId),'test-person');
  await page.evaluate(()=>lockAdministration());assert.equal(await page.locator('#birthday-assignments-list').textContent(),'');
  assert.deepEqual(errors,[]);console.log('PASS navigation, protected overview, cancellation, 12 months, past dates, Berlin time, all-day birthday, independent filters, holidays, 320–1024 px, private-content removal');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
