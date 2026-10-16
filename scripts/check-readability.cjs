// Local-only typography/contrast inventory; no production data or requests.
// Admin views are exposed only in this isolated test to inspect their layout;
// check-browser.cjs separately exercises real navigation and access protection.
// QA_TEXT_SCALE=200 tests root-relative text resizing, not a physical device's zoom.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
function inspect(){
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),over=(a,b)=>{const alpha=a.length===4?a[3]:1;return a.slice(0,3).map((v,i)=>v*alpha+b[i]*(1-alpha));};
 const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const findings=[];
 for(const e of document.querySelectorAll('body *')){
  if(!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||e.closest('[hidden],button:disabled,input:disabled')||['SCRIPT','STYLE','OPTION','SVG','PATH'].includes(e.tagName))continue;
  const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();if(!text||!/[a-zäöüß]/i.test(text))continue;
  const s=getComputedStyle(e),size=parseFloat(s.fontSize),chain=[];let n=e;while(n){chain.unshift(n);n=n.parentElement;}let bg=[255,255,255],image=false;for(const a of chain){const style=getComputedStyle(a);bg=over(rgb(style.backgroundColor),bg);if(rgb(style.backgroundColor).length===3||rgb(style.backgroundColor)[3]===1)image=false;if(style.backgroundImage!=='none')image=true;}
  const fg=over(rgb(s.color),bg),l=[lum(fg),lum(bg)].sort((a,b)=>b-a),ratio=(l[0]+.05)/(l[1]+.05),min=size>=24||size>=18.66&&parseInt(s.fontWeight)>=700?3:4.5;
  if(size>0&&(size<14-.01||ratio<min&&!image))findings.push({selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'),text:text.slice(0,70),size,ratio:+ratio.toFixed(2),color:s.color,bg:bg.map(Math.round),image});
 }
 const overflow=document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('main')].some(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1);
 const overflowElements=overflow?[...document.querySelectorAll('body *')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,classes:e.className,text:e.textContent.slice(0,60),width:e.getBoundingClientRect().width})).slice(-20):[];return {findings,overflow,overflowElements};
}
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER||'msedge'});const results=[],errors=[];try{
 const page=await browser.newPage({serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,'.'+u.pathname);if(u.hostname!=='localhost'||!file.startsWith(root+path.sep))return route.abort();if(!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:'Missing'});return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'}[path.extname(file)]||'application/octet-stream'});});
 await page.goto('http://localhost/index.html');await page.locator('#appStartup').waitFor({state:'detached'});if(process.env.QA_TEXT_SCALE)await page.evaluate(scale=>document.documentElement.style.setProperty('font-size',scale+'%','important'),process.env.QA_TEXT_SCALE);await page.evaluate(()=>{oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;adminUnlocked=true;resetAdminTimeout();});
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});for(const view of ['attendanceView','settingsView','settingsDrinksView','settingsMembersView','settingsHistoryView','settingsStatisticsView','settingsSecurityView','settingsFilesView','settingsGoalsView','settingsRemindersView','settingsRewardsView','settingsMobileView','helpView']){await page.evaluate(id=>{document.querySelectorAll('main.app-shell>.view').forEach(view=>view.hidden=view.id!==id);},view);assert.equal(await page.locator('#'+view).isVisible(),true,view+' visible');results.push({page:view,width,...await page.evaluate(inspect)});if(process.env.QA_SCREENSHOT&&view==='settingsView'&&width===768)await page.screenshot({path:process.env.QA_SCREENSHOT.replace('.png','-settings.png')});}}
 await page.goto('http://localhost/deckel.html');if(process.env.QA_TEXT_SCALE)await page.evaluate(scale=>document.documentElement.style.setProperty('font-size',scale+'%','important'),process.env.QA_TEXT_SCALE);await page.waitForFunction(()=>document.getElementById('refresh').getAttribute('aria-busy')!=='true');
 await page.route('https://test.account.workers.dev/**',route=>route.fulfill({json:{configured:true,uncertainReplies:true,fetchedAt:Date.now(),stale:false,leader:false,evidence:{version:1,medical:{g262:'2030-12-31',g263:''},breathing:null,driver:null},syncedAt:Date.now(),events:[{id:'qa-next',title:'Allgemeine Probe – technische Hilfeleistung',location:'Feuerwehrgerätehaus Wasser',start:Date.now()+3600000,end:Date.now()+7200000,sessionType:'Probe',status:'maybe',version:1},{id:'qa-open',title:'Sonderprobe Atemschutz',start:Date.now()+86400000,end:Date.now()+90000000,sessionType:'Sonderprobe',status:'open',version:0},{id:'qa-later',title:'Nächste Probe',start:Date.now()+172800000,end:Date.now()+176400000,sessionType:'Probe',status:'yes',version:0}]}}));
 await page.evaluate(async()=>{history.replaceState(null,'','#a='+'1'.repeat(32));await H2OPortal.render({actions:{central:true,origin:'https://test.account.workers.dev',capability:'a'.repeat(43),revision:'qa'}});document.querySelector('#account').hidden=false;document.querySelector('#phone-menu').hidden=false;DeckelMobile.show(true);document.getElementById('status').textContent='';});
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});for(const target of ['portal-section','portal-evidence','account','portal-points','deckel-more']){await page.evaluate(id=>DeckelMobile.jump(id),target);await page.waitForFunction(()=>!document.getElementById('portal-refresh').disabled);if(target==='portal-section'){
 for(const height of [600,900]){await page.setViewportSize({width,height});await page.evaluate(()=>document.getElementById('deckel-main').scrollTo({top:0,behavior:'instant'}));
 const positions=await page.evaluate(()=>{const cards=document.querySelectorAll('#portal-events article'),main=document.getElementById('deckel-main');return {second:cards[1].getBoundingClientRect().top,bottom:main.getBoundingClientRect().bottom};});
 assert.ok(positions.second>=positions.bottom-1,'first appointment alone: '+width+'x'+height);
 await page.locator('#portal-events article').nth(1).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.getElementById('deckel-main').scrollTop>0),'next appointment reachable by scrolling');
 }
 await page.evaluate(()=>document.getElementById('deckel-main').scrollTo({top:0,behavior:'instant'}));
 }results.push({page:target,width,...await page.evaluate(inspect)});if(process.env.QA_SCREENSHOT&&[320,390].includes(width)&&target==='portal-section')await page.screenshot({path:width===390?process.env.QA_SCREENSHOT:process.env.QA_SCREENSHOT.replace('.png','-320.png')});}}
 assert.equal(await page.locator('#portal-section > h2,#portal-section > .eyebrow,#portal-events > h3').count(),0,'no redundant calendar headings');
 assert.equal(await page.locator('#portal-events article').count(),3,'all cards remain visible in chronological order');
 assert.equal(await page.locator('#portal-later-events').count(),0,'answered appointments are never collapsed');
 const out=process.env.QA_REPORT||path.join(root,'../readability-results.json');fs.writeFileSync(out,JSON.stringify({results,errors},null,2));
 console.log('Readability inventory:',out);console.log(JSON.stringify({screens:results.length,overflow:results.filter(r=>r.overflow).map(r=>[r.page,r.width]),uniqueFindings:[...new Map(results.flatMap(r=>r.findings).map(f=>[f.selector+f.color+f.size,f])).values()],errors},null,2));
 if(process.env.QA_STRICT){assert.deepEqual(errors,[]);assert.equal(results.some(r=>r.overflow),false,'horizontal overflow');assert.equal(results.some(r=>r.findings.length),false,'font size or contrast findings');}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
