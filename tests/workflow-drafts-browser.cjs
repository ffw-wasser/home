// Synthetic local state only. All remote services are blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1180,height:900},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 async function ready(){await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});await page.locator('#appStartup').waitFor({state:'hidden'});await page.evaluate(()=>{PortalAdmin.refreshAttendance=async()=>{};});}
 await page.goto('https://ffw-wasser.github.io/home/index.html');await ready();
 await page.evaluate(()=>{members=[{id:'draft-a',firstName:'Anna',lastName:'Muster',roles:['GF'],committeeMember:true},{id:'draft-b',firstName:'Ben',lastName:'Beispiel',roles:[]}];safeStorage.setItem(KEYS.members,JSON.stringify(members));chooseSessionType('Unterricht');continueToAttendance();saveQuickMemberStatus('draft-a','Anwesend');commitPendingMemberStatuses();saveQuickMemberStatus('draft-b','Entschuldigt');});
 await page.locator('#attendanceOptions>summary').click();await page.locator('#probeDateInput').fill('2026-12-10');await page.locator('#probeDateInput').dispatchEvent('change');
 await page.evaluate(()=>openProbeTopicDialog());await page.locator('#probeTopicInput').fill('Funk und Gerätekunde');await page.keyboard.press('Escape');
 const id=await page.evaluate(()=>currentSessionId);await page.reload();await ready();
 assert.deepEqual(await page.evaluate(()=>({id:currentSessionId,type:sessionType,date:today(),topic:currentClosingTopic,pending:[...pendingMemberStatuses],entries:todayEntries().length})),{id,type:'Unterricht',date:'2026-12-10',topic:'Funk und Gerätekunde',pending:[['draft-b','Entschuldigt']],entries:1});
 assert.match(await page.locator('#attendanceStartSummary').textContent(),/1 noch zu übernehmen/);
 await page.getByRole('button',{name:'Erfassung fortsetzen',exact:true}).click();assert.equal(await page.locator('[data-quick-member="draft-b"][data-quick-status="Entschuldigt"]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{window.confirm=()=>true;discardCurrentAttendanceSession();});assert.equal(await page.evaluate(()=>safeStorage.getItem(attendanceDraftKey)),null);
 await page.evaluate(()=>{beginOperationFromHome();saveQuickMemberStatus('draft-a','Anwesend');commitPendingMemberStatuses();operationAssignments={'Muster, Anna':'Reserve Gerätehaus'};operationAssignmentRoles={'Muster, Anna':'Reserve'};persistAttendanceDraft();openOperationReportForm();});
 await page.locator('#opLocation').fill('Musterstraße 1');await page.locator('#opSituation').fill('Künstlicher Testbericht');
 // Flush before the existing debounce: backgrounding must retain the final keystroke.
 await page.evaluate(()=>flushAttendanceDraft());const operationId=await page.evaluate(()=>currentOperationId);
 await page.reload();await ready();assert.equal(await page.evaluate(()=>sessionType),'Einsatz');assert.equal(await page.evaluate(()=>currentOperationId),operationId);
 assert.deepEqual(await page.evaluate(()=>operationAssignments),{'Muster, Anna':'Reserve Gerätehaus'});await page.evaluate(()=>openOperationReportForm());assert.equal(await page.locator('#opSituation').inputValue(),'Künstlicher Testbericht');assert.equal(await page.locator('#opLocation').inputValue(),'Musterstraße 1');
 await page.evaluate(()=>{safeStorage.setItem('fw_onedrive_shared_folder_url','https://example.invalid/other-folder');});await page.reload();await ready();assert.equal(await page.evaluate(()=>pendingMemberStatuses.size),0);assert.equal(await page.evaluate(()=>currentClosingTopic),'');
 await page.evaluate(()=>{window.confirm=()=>true;discardCurrentAttendanceSession();adminUnlocked=true;resetAdminTimeout();showView('settingsView');});
 assert.match(await page.locator('#smartTasks').innerText(),/Kalender prüfen/);assert.match(await page.locator('#smartTasks').innerText(),/Speicherstand prüfen/);
 for(const width of [320,390,768,1180]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'settings overflow '+width);}
 await page.evaluate(()=>lockAdministration());assert.equal(await page.locator('#smartTasks').textContent(),'');
 assert.deepEqual(errors,[]);console.log('PASS reload restores pending attendance, type/date/topic, operation assignments and last keystroke; discard clears; changed source ignores draft; private tasks clear on lock; 320–1180 px');
 if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:1180,height:900});await page.evaluate(()=>{adminUnlocked=true;resetAdminTimeout();showView('settingsView');});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'verwaltung.png')});}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
