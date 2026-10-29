// Real portal markup and touch handlers; no production accounts or services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),pw=require('playwright');
const root=path.resolve(__dirname,'..'),engine=process.env.BROWSER_ENGINE||'chromium';
(async()=>{const browser=await pw[engine].launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
 await page.evaluate(()=>{document.getElementById('h2o-onboarding')?.dispatchEvent(new Event('cancel',{cancelable:true}));DeckelMobile.show(true);DeckelMobile.jump('more-security');window.refreshLoads=0;window.qaClock=0;window.originalNow=Date.now.bind(Date);Date.now=()=>originalNow()+qaClock;window.DeckelReload=async()=>{refreshLoads++;if(window.holdRefresh)await new Promise(resolve=>window.releaseRefresh=resolve);};DeckelReload.isLoading=()=>false;});
 assert.equal(await page.locator('#refresh,.portal-manual-refresh').count(),0);
 async function touch(type,x,y,{selector='#deckel-main',count=1}={}){return page.evaluate(({type,x,y,selector,count})=>{const e=new Event(type,{bubbles:true,cancelable:true}),point={identifier:1,clientX:x,clientY:y};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:Array.from({length:count},(_,i)=>({...point,identifier:i+1}))},changedTouches:{value:[point]}});document.querySelector(selector).dispatchEvent(e);return e.defaultPrevented;},{type,x,y,selector,count});}
 async function swipe(x,y,{cancel=false,selector}={}){await touch('touchstart',170,170,{selector});await touch('touchmove',x,y,{selector});await touch(cancel?'touchcancel':'touchend',x,y,{selector});}
 const count=async()=>{await page.waitForTimeout(30);return page.evaluate(()=>refreshLoads);};
 await page.waitForTimeout(250);
 await swipe(174,220);assert.equal(await count(),0,'short pulls do not refresh');
 await swipe(170,309);assert.equal(await count(),0,'139px does not refresh');
 await touch('touchstart',170,170);await touch('touchmove',170,310);assert.match(await page.locator('#deckel-pull-refresh').innerText(),/Loslassen/);await touch('touchcancel',170,310);assert.equal(await count(),0,'140px arms the gesture but cancel does not refresh');
 await swipe(300,180);assert.equal(await count(),0,'horizontal swipes do not refresh');
 await page.evaluate(()=>DeckelMobile.jump('more-security'));
 await swipe(172,90);assert.equal(await count(),0,'upward scrolling does not refresh');
 await swipe(172,320,{cancel:true});assert.equal(await count(),0,'cancel does not refresh');
 await touch('touchstart',170,170);await touch('touchmove',170,320);await touch('touchmove',170,200);await touch('touchend',170,200);assert.equal(await count(),0,'pulling back below the threshold cancels');
 await touch('touchstart',170,170);await touch('touchmove',170,320,{count:2});await touch('touchend',170,320);assert.equal(await count(),0,'pinch zoom cancels');
 await page.evaluate(()=>{const n=document.createElement('div');n.id='nested-test';n.style='height:40px;overflow:auto';n.innerHTML='<p style="min-height:200px">Nested list</p>';document.getElementById('more-security').prepend(n);});
 await swipe(170,320,{selector:'#nested-test p'});assert.equal(await count(),0,'nested lists retain scrolling');await page.locator('#nested-test').evaluate(n=>n.remove());
 await swipe(170,320,{selector:'#identity-username'});assert.equal(await count(),0,'input fields retain their actions');
 await page.evaluate(()=>{document.getElementById('more-security').style.minHeight='2000px';document.getElementById('deckel-main').scrollTo({top:180,behavior:'instant'});});
 await swipe(170,320);assert.equal(await count(),0,'a gesture starting below the top never refreshes');
 await page.evaluate(()=>{document.getElementById('deckel-main').scrollTo({top:0,behavior:'instant'});window.holdRefresh=true;});
 await touch('touchstart',170,170);assert.equal(await touch('touchmove',170,320),true,'a downward pull owns scrolling only after direction detection');
 await page.locator('#deckel-pull-refresh').filter({hasText:'Loslassen zum Aktualisieren'}).waitFor();
 if(process.env.CAPTURE_PULL_HELP){const out=path.join(root,'assets/help/guide'),hint=page.locator('#deckel-pull-refresh');await page.screenshot({path:path.join(out,'h2o-aktualisieren.jpg'),type:'jpeg',quality:80,animations:'disabled'});const sizes=JSON.parse(fs.readFileSync(path.join(out,'screens.json'),'utf8'));sizes['h2o-aktualisieren']={width:390,height:844};fs.writeFileSync(path.join(out,'screens.json'),JSON.stringify(sizes,null,2)+'\n');assert.equal(await hint.isVisible(),true);}
 await touch('touchend',170,320);await page.waitForFunction(()=>refreshLoads===1);assert.match(await page.locator('#deckel-pull-refresh').innerText(),/Wird aktualisiert/);
 await swipe(170,320);assert.equal(await count(),1,'in-flight refresh cannot be duplicated');
 await page.evaluate(()=>releaseRefresh());await page.locator('#deckel-pull-refresh').waitFor({state:'hidden'});
 await page.evaluate(()=>{window.holdRefresh=false;DeckelMobile.jump('portal-section');});await swipe(170,320);assert.equal(await count(),1,'recent refresh is throttled');assert.match(await page.locator('#deckel-pull-refresh').innerText(),/Bitte kurz warten/);await page.evaluate(()=>qaClock+=11000);await swipe(170,320);await page.waitForFunction(()=>refreshLoads===2);assert.equal(await page.locator('#portal-page-terms').isVisible(),true,'refresh does not change the current page');
 if(engine==='chromium'){
  await page.evaluate(()=>{qaClock+=11000;DeckelMobile.jump('deckel-more');document.getElementById('deckel-main').scrollTo({top:0,behavior:'instant'});});
  const tile=await page.locator('#portal-more-grid [data-portal-tile="more-year-plan"]').boundingBox(),x=tile.x+tile.width/2,y=tile.y+20;
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+i*25}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>refreshLoads===3);assert.equal(await page.locator('#portal-page-more').isVisible(),true,'pulling a tile refreshes without opening it');
 }
 assert.deepEqual(errors,[]);console.log('PASS '+engine+': pull at top, threshold/reversal, cancel/pinch/nested controls/scroll, horizontal coexistence, busy guard and current page');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
