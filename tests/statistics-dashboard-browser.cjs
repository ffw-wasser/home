const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1024,height:900},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
 const year=await page.evaluate(()=>{
  const today=MemberEvidence.day(Date.now()),year=Number(today.slice(0,4)),noon=Date.parse(today+'T12:00:00Z'),date=days=>MemberEvidence.day(noon+days*86400000),base=(id,roles,extra={})=>({id,firstName:id,lastName:'Beispiel',roles,...extra}),as={breathingQualified:true,g263ValidUntil:date(365),ffiValidUntil:date(365),agtInstructionValidUntil:date(365)};
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
 const activeDrinkExport=await page.evaluate(()=>JSON.stringify(StatisticsPdf.collect(document.querySelector('.drinks-consumption-panel'))));assert.doesNotMatch(activeDrinkExport,/Treuepunkte|Challenge/,'paused points stay out of active statistics PDFs');
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

 await page.evaluate(()=>{window.print=()=>{throw Error('Native printing is unavailable');};window.qaDrinksLoad=DrinksConsumption.load;window.qaPdfCloudCalls=0;DrinksConsumption.load=()=>{qaPdfCloudCalls++;return new Promise(()=>{});};window.qaPdfDetails=[...document.querySelectorAll('#settingsStatisticsView details')].map(d=>d.open);window.qaPdfTitle=document.title;});
 await page.locator('#statisticsPdfButton').click();await page.locator('#statisticsPdfDialog [data-pdf-status]').filter({hasText:'PDF ist fertig'}).waitFor();
 assert.equal(await page.evaluate(()=>qaPdfCloudCalls),0,'cloud cannot block PDF creation');
 assert.equal(await page.evaluate(()=>document.title===qaPdfTitle&&JSON.stringify([...document.querySelectorAll('#settingsStatisticsView details')].map(d=>d.open))===JSON.stringify(qaPdfDetails)),true,'PDF does not change page title or disclosures');
 assert.equal(await page.locator('[data-pdf-open]').getAttribute('target'),'_blank');assert.match(await page.locator('[data-pdf-open]').getAttribute('href'),/^blob:/);
 const annualDownload=page.waitForEvent('download');await page.locator('[data-pdf-save]').click();const annualFile=await annualDownload;assert.equal(annualFile.suggestedFilename(),'Feuerwehr-Wasser_Statistik_'+year+'.pdf');
 const annualBytes=fs.readFileSync(await annualFile.path()),PDFLib=require('../js/vendor/pdf-lib.min.js');
 const annualDoc=await PDFLib.PDFDocument.load(annualBytes);assert.ok(annualDoc.getPageCount()>=2,'real multi-page PDF generated');
 const pdfText=doc=>doc.getPages().flatMap(p=>p.node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1'))).join(' ').replace(/<([0-9A-F]+)>/g,(_,hex)=>Buffer.from(hex,'hex').toString('latin1'));
 const annualText=pdfText(annualDoc);for(const expected of ['Feuerwehr','Kameradschaftspflege','Sommerfest','3 Veranstaltungen','Mögliche Funktionsbesetzung'])assert.ok(annualText.includes(expected),expected+' present in actual PDF');
 assert.ok(!annualText.includes('Teilnehmerstatistik'),'annual report excludes selected personal report');
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'PDF dialog fits '+width+'/'+scale);}
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 if(process.env.QA_OUTPUT){await annualFile.saveAs(path.join(process.env.QA_OUTPUT,'statistik.pdf'));await page.setViewportSize({width:390,height:900});await page.locator('#statisticsPdfDialog').screenshot({path:path.join(process.env.QA_OUTPUT,'pdf-dialog.png')});}
 await page.locator('[data-pdf-close]').click();await page.evaluate(()=>{DrinksConsumption.load=qaDrinksLoad;});
 await page.locator('.individual-statistics-panel > .statistics-collapsible > summary').click();
 await page.locator('#individualMemberSelect').selectOption('Anna');
 assert.equal(await page.locator('#individualVisualDashboard').count(),0,'no duplicate graphic overview');assert.equal(await page.locator('#individualRoleUsage .statistics-bars').count(),1);assert.equal(await page.locator('#individualProbeTypes .statistics-donut').count(),1);
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'personal charts fit '+width+'/'+scale);}
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 await page.locator('#individualStatisticsPdfButton').click();await page.locator('#statisticsPdfDialog [data-pdf-status]').filter({hasText:'PDF ist fertig'}).waitFor();
 const personalDownload=page.waitForEvent('download');await page.locator('[data-pdf-save]').click();const personalFile=await personalDownload;assert.match(personalFile.suggestedFilename(),/Anna.*Statistik_.*\.pdf$/);
 const personalDoc=await PDFLib.PDFDocument.load(fs.readFileSync(await personalFile.path())),personalText=pdfText(personalDoc);assert.ok(personalText.includes('Anna'));assert.ok(personalText.includes('Funktionsziele'));for(const expected of ['Freigabe erteilt','G26.3','FFI'])assert.ok(personalText.includes(expected),expected+' in personal PDF');for(const other of ['Clara','Daniel'])assert.ok(!personalText.includes(other),'no other member '+other);assert.ok(!personalText.includes('Kameradschaftspflege'),'personal report excludes general dashboard');
 if(process.env.QA_OUTPUT)await personalFile.saveAs(path.join(process.env.QA_OUTPUT,'teilnehmer.pdf'));
 await page.locator('[data-pdf-close]').click();assert.equal(await page.evaluate(()=>JSON.stringify({members,csvArchive})===qaStatisticsOriginal),true,'PDF export does not change stored data');
 await page.evaluate(()=>{window.qaPdfLibrary=PDFLib;globalThis.PDFLib=null;});await page.locator('#statisticsPdfButton').click();await page.locator('#statisticsPdfDialog [data-pdf-status]').filter({hasText:'PDF konnte nicht erstellt werden'}).waitFor();assert.equal(await page.locator('.statistics-pdf-actions').isVisible(),false,'no stale file links on failure');await page.locator('[data-pdf-close]').click();await page.evaluate(()=>globalThis.PDFLib=qaPdfLibrary);
 await page.evaluate(()=>{csvArchive=[];renderStatistics();});assert.equal(await page.locator('#yearAttendanceRate').textContent(),'–');assert.equal(await page.locator('#topVisitors .commander-rank-row').count(),0);assert.equal(await page.locator('.commander-months').count(),0,'no empty month chart');assert.match(await page.locator('[data-fellowship-summary]').textContent(),/0 Veranstaltungen/);assert.equal(await page.locator('#topVisitorsEmpty').isVisible(),true);
 await page.evaluate(()=>document.getElementById('statisticsFellowshipDetails').open=true);await page.locator('#statisticsFellowshipEvents button').click();assert.equal(await page.locator('#eventsView').isVisible(),true,'event link opens existing event area');
 assert.deepEqual(errors,[]);console.log('PASS commander dashboard: real fixture counts, qualifications, fair ranking, years, empty state, read-only data, 320–1280px at 100/200%, real PDF downloads, unavailable native print, missing PDF module');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
