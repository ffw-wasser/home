const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1024,height:900},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
 const year=await page.evaluate(()=>{
  const year=new Date().getFullYear(),date=days=>MemberEvidence.day(Date.now()+days*86400000),base=(id,roles,extra={})=>({id,firstName:id,lastName:'Beispiel',roles,...extra}),as={breathingQualified:true,g263ValidUntil:date(365),ffiValidUntil:date(365),agtInstructionValidUntil:date(365)};
  members=[base('Anna',['GF','ATF','ATM','WTF'],{...as,machinistVehicles:['LF'],driverLicenseCheckedOn:date(0)}),base('Ben',['ATF','Melder'],{...as,ffiValidUntil:date(20)}),base('Clara',['ATF','STF'],{...as,g263ValidUntil:date(-1)}),base('Daniel',['ATM'],{...as,ffiValidUntil:''}),base('Eva',['STF','STM','Melder'],{breathingQualified:false}),base('Fritz',[],{machinistVehicles:['TSF'],driverLicenseCheckedOn:date(1)}),base('Alt',['GF'],{...as,ageDepartment:true})];
  const row=(id,status,role='')=>[year+'-01-10','18:00','Beispiel, '+id,'',status,role,'Technik'];
  const report=(id,type,rows,y=year)=>({id,createdAt:y+'-01-10',sessionType:type,content:CsvEngine.serialize(rows.map(r=>[y+'-01-10',r[1],r[2],type,r[4],r[5],r[6]]))});
  csvArchive=[report('general','Allgemeine Probe',[row('Anna','Anwesend','GF'),row('Ben','Entschuldigt'),row('Clara','Fehlt')]),report('special','Sonderprobe',[row('Anna','Betrifft nicht'),row('Ben','Anwesend')]),report('lesson','Unterricht',[row('Anna','Anwesend')]),report('committee','Ausschuss Sitzung',[row('Anna','Anwesend')]),report('operation','Einsatz',[row('Anna','Anwesend','GF')]),report('last-year','Allgemeine Probe',[row('Anna','Fehlt')],year-1)];
  const op=csvArchive.find(item=>item.id==='operation');op.operationData={type:'Brand',date:year+'-01-10'};csvArchive.push({...op,id:'operation2',operationData:{type:' brand  ',date:year+'-01-10'}},{...op,id:'operation3',operationData:{type:'Technische Hilfe',date:year+'-01-10'}});
  const fest=report('festival','Veranstaltung',[row('Anna','Anwesend'),row('Ben','Anwesend'),row('Ben','Anwesend')]);fest.topic='Sommerfest';csvArchive.push(fest,{...fest,id:'festival2',topic:' sommerfest '},report('fellowship','Kameradschaftspflege',[row('Ben','Anwesend')]));
  saveRoleTargets({GF:2,ATF:1});window.loadOneDriveHistory=async()=>true;window.qaStatisticsOriginal=JSON.stringify({members,csvArchive});showView('settingsStatisticsView');return year;
 });
 assert.equal(await page.locator('#yearProbeCount').textContent(),'3');assert.equal(await page.locator('#averageAttendance').textContent(),'3');assert.equal(await page.locator('#yearAttendanceRate').textContent(),'60,0 %');
 assert.equal(await page.locator('[data-command-operation-types] .commander-personnel-row').count(),2);assert.equal(await page.locator('[data-command-operation-types] .commander-personnel-row').filter({hasText:'Brand'}).locator('strong').textContent(),'2');
 const readiness=page.locator('[data-command-readiness] svg');assert.match(await readiness.nth(0).getAttribute('aria-label'),/2 von 4 aktuell gültig/);assert.match(await readiness.nth(1).getAttribute('aria-label'),/1 von 2 aktuell gültig/);
 assert.equal(await page.locator('[data-command-crew] .commander-personnel-row').count(),6);
 assert.equal(await page.locator('[data-command-crew] .commander-personnel-row').filter({hasText:'Angriffstrupp'}).locator('strong').textContent(),'2');
 assert.equal(await page.locator('[data-command-crew] .commander-personnel-row').filter({hasText:'Schlauchtrupp'}).locator('strong').textContent(),'2');
 assert.match(await page.locator('#topVisitors .commander-rank-row').first().textContent(),/Anna/);
 assert.ok(await page.evaluate(()=>{const nodes=[...document.getElementById('statisticsCommanderDashboard').children],crew=document.querySelector('.commander-crew'),ranking=document.querySelector('[data-command-ranking]'),goals=document.querySelector('.commander-goals');return nodes.indexOf(crew)<nodes.indexOf(ranking)&&nodes.indexOf(ranking)<nodes.indexOf(goals);}),'crew, ranking, goals order');
 assert.equal(await page.locator('#statisticsFurtherDetails').getAttribute('open'),null);
 await page.locator('#statisticsYearSelect').selectOption(String(year-1));assert.equal(await page.locator('#yearProbeCount').textContent(),'1');assert.match(await readiness.first().getAttribute('aria-label'),/2 von 4 aktuell gültig/,'readiness remains current');
 await page.locator('#statisticsYearSelect').selectOption(String(year));await page.evaluate(()=>renderStatistics());assert.equal(await page.locator('#statisticsFellowshipEvents').count(),1);assert.equal(await page.locator('#statisticsCommanderDashboard').count(),1);assert.equal(await page.locator('#topVisitors').count(),1);
 assert.equal(await page.evaluate(()=>JSON.stringify({members,csvArchive})===qaStatisticsOriginal),true,'rendering is read-only');
 for(const width of [320,390,768,1280])for(const scale of [100,200]){
  await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+width+'/'+scale);
  if(process.env.QA_OUTPUT&&scale===100){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'statistik-'+width+'.png'),fullPage:true});}
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 await page.locator('#statisticsFurtherDetails>summary').click();assert.equal(await page.locator('.drinks-consumption-panel').isVisible(),false,'fellowship is separate and closed');
 assert.equal(await page.locator('#statisticsFurtherDetails .drinks-consumption-panel').count(),0);
 assert.equal(await page.locator('#statisticsFellowshipDetails>summary').textContent(),'Kameradschaftspflege');
 await page.locator('#statisticsFellowshipDetails>summary').click();assert.equal(await page.locator('.drinks-consumption-panel').isVisible(),true);
 assert.match(await page.locator('[data-fellowship-summary]').textContent(),/3 Veranstaltungen · 5 Teilnahmen/);
 assert.equal(await page.locator('[data-fellowship-chart] .statistics-bar-row').filter({hasText:'Sommerfest'}).locator('strong').textContent(),'2');
 assert.doesNotMatch(await page.locator('#probeTypes').textContent(),/Veranstaltung|Kameradschaft/);
 assert.doesNotMatch(await page.locator('#probeTopics').textContent(),/Sommerfest/i);
 assert.equal(await page.locator('.age-statistics-kpis>.stat-kpi').count(),3,'no duplicate age average');
 assert.equal(await page.locator('#agePresentCount').count(),0);
 assert.equal(await page.locator('.commander-month small').filter({hasText:'0 · 0'}).count(),0,'no zero-only month labels');
 assert.equal(await page.locator('[data-chart-months],[data-chart-types],[data-chart-operations],#statisticsOperationSummary').count(),0,'old overview duplicates removed');
 for(const selector of ['#statisticsVisualDashboard','.individual-statistics-panel','.age-statistics-section'])assert.equal(await page.locator(selector+' > .statistics-collapsible').getAttribute('open'),null,'details start closed '+selector);
 assert.equal(await page.locator('#statisticsVisualDashboard [data-chart-roles]').count(),1,'actual function usage retained');
 assert.equal(await page.locator('#drinksStatisticsYear').textContent(),String(year),'consumption year survives compact heading');
 assert.equal(await page.locator('#ageStatisticsTitle').count(),1,'age section keeps its accessible heading');
 await page.evaluate(()=>document.querySelectorAll('#statisticsFurtherDetails .statistics-collapsible').forEach(details=>details.open=true));
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'expanded details fit '+width+'/'+scale);}
 await page.evaluate(()=>{document.documentElement.style.fontSize='100%';document.querySelectorAll('#statisticsFurtherDetails .statistics-collapsible').forEach(details=>details.open=false);});

 if(process.env.QA_OUTPUT){await page.setViewportSize({width:1024,height:900});await page.locator('#statisticsAdditionalTopics').screenshot({path:path.join(process.env.QA_OUTPUT,'weitere-auswertungen.png')});}

 await page.evaluate(()=>{window.qaPrint=0;window.print=()=>{qaPrint++;};});await page.locator('#statisticsPdfButton').click();await page.waitForFunction(()=>qaPrint===1);
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('#statisticsCommanderDashboard').isVisible(),true,'dashboard prints');assert.equal(await page.locator('.drinks-consumption-panel').isVisible(),true,'annual PDF opens fellowship');
 if(process.env.QA_OUTPUT)await page.pdf({path:path.join(process.env.QA_OUTPUT,'statistik.pdf'),format:'A4',printBackground:true});
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});assert.equal(await page.evaluate(()=>document.body.classList.contains('printing-statistics')),false);
 assert.equal(await page.locator('.individual-statistics-panel > .statistics-collapsible').getAttribute('open'),null,'annual PDF restores individual disclosure');
 await page.locator('.individual-statistics-panel > .statistics-collapsible > summary').click();
 await page.waitForTimeout(1600);assert.equal(await page.locator('.individual-statistics-panel > .statistics-collapsible').getAttribute('open'),'','late print cleanup does not close newly opened details');
 await page.locator('#individualMemberSelect').selectOption('Anna');
 assert.equal(await page.locator('#individualVisualDashboard').count(),0,'no duplicate graphic overview');
 assert.equal(await page.locator('#individualRoleUsage .statistics-bars').count(),1,'functions displayed once as bars');
 assert.equal(await page.locator('#individualProbeTypes .statistics-donut').count(),1,'types displayed once as donut');
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'personal charts fit '+width+'/'+scale);}
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 if(process.env.QA_OUTPUT){await page.setViewportSize({width:1024,height:900});await page.locator('.individual-statistics-panel').screenshot({path:path.join(process.env.QA_OUTPUT,'teilnehmer.png')});}
 await page.locator('#statisticsFellowshipDetails>summary').click();
 await page.locator('#individualStatisticsPdfButton').click();await page.waitForFunction(()=>qaPrint===2);
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.individual-statistics-panel').isVisible(),true,'individual report prints through further-details ancestor');assert.equal(await page.locator('#statisticsCommanderDashboard').isVisible(),false,'individual report excludes dashboard');assert.equal(await page.locator('#statisticsFellowshipDetails').isVisible(),false,'individual PDF excludes fellowship');
 if(process.env.QA_OUTPUT)await page.pdf({path:path.join(process.env.QA_OUTPUT,'teilnehmer.pdf'),format:'A4',printBackground:true});
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
 await page.evaluate(()=>{csvArchive=[];renderStatistics();});assert.equal(await page.locator('#yearAttendanceRate').textContent(),'–');assert.equal(await page.locator('#topVisitors .commander-rank-row').count(),0);assert.equal(await page.locator('.commander-months').count(),0,'no empty month chart');assert.match(await page.locator('[data-fellowship-summary]').textContent(),/0 Veranstaltungen/);assert.equal(await page.locator('#topVisitorsEmpty').isVisible(),true);
 await page.locator('#statisticsFellowshipDetails>summary').click();await page.locator('#statisticsFellowshipEvents button').click();assert.equal(await page.locator('#eventsView').isVisible(),true,'event link opens existing event area');
 assert.deepEqual(errors,[]);console.log('PASS commander dashboard: real fixture counts, qualifications, fair ranking, years, empty state, read-only data, 320–1280px at 100/200%, PDF lifecycle');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
