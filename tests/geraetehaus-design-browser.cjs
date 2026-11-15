// Read-only browser QA with local assets and synthetic state; all network blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa','geraetehaus-design',(process.env.BROWSER_ENGINE||'chromium')+(process.env.DESKTOP_REVIEW==='1'?'-desktop':''));
fs.mkdirSync(out,{recursive:true});
(async()=>{const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:process.env.DESKTOP_REVIEW!=='1',serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/index.html');await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});await page.locator('#appStartup').waitFor({state:'hidden'});
 await page.evaluate(async()=>{oneDriveAdministrationReady=()=>true;oneDriveReadState=async()=>({members:[]});DrinksCentral.connection=async()=>({source:'test-source',origin:'https://test.example.workers.dev'});DrinksStore.sourceKey=()=> 'test-source';const event={id:'design-test',title:'Allgemeine Probe · Technische Hilfe',attendanceType:'Allgemeine Probe',sessionType:'Probe',kind:'probe',approved:true,location:'Gerätehaus Wasser',start:Date.parse(new Date(Date.now()+86400000).toISOString().slice(0,10)+'T18:30Z'),end:Date.parse(new Date(Date.now()+86400000).toISOString().slice(0,10)+'T20:00Z')};DrinksPush.request=async(c,p,data)=>p.endsWith('/replies')?{event,replies:[]}:p.endsWith('/year')?{year:data.year,configured:true,events:[event]}:{events:[event],groups:[],members:[],configured:true,fetchedAt:Date.now()};await PortalAdmin.refreshAttendance(true);CalendarSidebar.refresh();adminUnlocked=true;resetAdminTimeout();});
 await page.locator('.calendar-sidebar-event').first().waitFor();
 for(const [width,height] of [[1024,768],[1180,820],[1194,834],[1366,1024],[1920,1080]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  assert.match(await page.locator('.home-session-type-panel').evaluate(n=>getComputedStyle(n).backgroundImage),/gradient/,'term card gradient survives legacy rules '+width);
  const start=page.locator('#continueToAttendanceButton');
  assert.match(await start.evaluate(n=>getComputedStyle(n).backgroundImage),/gradient/,'start button gradient survives legacy rules '+width);
  assert.match(await start.evaluate(n=>getComputedStyle(n).boxShadow),/inset/,'start button has raised highlight '+width);
  await start.hover();
  assert.match(await start.evaluate(n=>getComputedStyle(n).backgroundImage),/gradient/,'hover retains the start button finish '+width);
  await page.mouse.move(0,0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits '+width);
  const scroller=page.locator('.calendar-sidebar-scroll');assert.equal(await scroller.evaluate(n=>getComputedStyle(n).overflowY),'auto');
  assert.ok(await scroller.evaluate(n=>{n.scrollTop=80;return n.scrollTop>0;}),'calendar scrolls '+width);
  await page.screenshot({path:path.join(out,'start-'+width+'.png')});
  await page.getByRole('button',{name:'Kalender vergrößern',exact:true}).click();
  assert.equal(await scroller.locator(':scope > section').count(),3,'three months');
  const rects=await scroller.locator(':scope > section').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  assert.ok(rects[1].x>rects[0].x&&rects[2].x>rects[1].x,'months side by side '+width);
  assert.ok(rects.every(r=>r.bottom<=height+1&&r.right<=width+1),'months fit '+width);
  await page.screenshot({path:path.join(out,'drei-monate-'+width+'.png')});
  await page.getByRole('button',{name:'Kalender zuklappen',exact:true}).click();
  await page.locator('#menuToggleButton').click();
  const menu=page.locator('#compactMenu');assert.ok(await menu.evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),'menu fits '+width);
  await page.screenshot({path:path.join(out,'menue-'+width+'.png')});
  await page.locator('#settingsTab').click();await page.locator('#settingsView').waitFor({state:'visible'});
  await page.screenshot({path:path.join(out,'verwaltung-'+width+'.png')});
  await page.locator('[data-settings-page="settingsOptionsView"]').click();await page.locator('#settingsOptionsView').waitFor({state:'visible'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'submenu fits '+width);
  await page.screenshot({path:path.join(out,'untermenue-'+width+'.png')});
  await page.evaluate(()=>showView('attendanceView'));
 }
 for(const [width,height] of [[320,800],[1024,768]]){await page.setViewportSize({width,height});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';showView('settingsView');});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1;}).slice(0,15).map(n=>({tag:n.tagName,id:n.id,cls:n.className,width:n.getBoundingClientRect().width,text:n.textContent.slice(0,70)}))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'large text fits '+width);await page.evaluate(()=>showView('settingsOptionsView'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'submenu large text fits '+width);}
 assert.deepEqual(errors,[]);console.log('PASS '+(process.env.BROWSER_ENGINE||'chromium')+': '+(process.env.DESKTOP_REVIEW==='1'?'mouse':'touch')+', 1024/1180/1194/1366/1920, rendered gradients, scrolling, three months, menus, 200% type');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
