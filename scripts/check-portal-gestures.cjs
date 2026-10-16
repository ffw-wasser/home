// Local synthetic access only; every external request is blocked or mocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER||'msedge'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let status='open',version=0,supported=true,replies=0,reads=0;
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='test.account.workers.dev'){
  if(u.pathname==='/portal/reply'){const body=route.request().postDataJSON();assert.equal(body.expectedVersion,version);status=body.status;version++;replies++;return route.fulfill({json:{ok:true,status,version}});}
  reads++;return route.fulfill({json:{configured:true,uncertainReplies:supported,stale:false,fetchedAt:Date.now(),events:[{id:'test-event',title:'Testprobe',start:Date.now()+3600000,end:Date.now()+7200000,status,version}]}});
 }const file=path.resolve(root,'.'+u.pathname);if(u.hostname!=='localhost'||!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream'});});
 await page.goto('http://localhost/deckel.html');await page.waitForFunction(()=>document.getElementById('refresh').getAttribute('aria-busy')!=='true');
 await page.evaluate(async()=>{history.replaceState(null,'','#a='+'1'.repeat(32));await H2OPortal.render({actions:{central:true,origin:'https://test.account.workers.dev',capability:'a'.repeat(43),revision:'test'}});DeckelMobile.show(true);});
 const ready=()=>page.waitForFunction(()=>!document.getElementById('portal-refresh').disabled);
 await ready();const initialReads=reads;await page.locator('[data-reply="maybe"]').click();await page.waitForFunction(()=>document.querySelector('.portal-event').dataset.status==='maybe');await ready();assert.equal(replies,1);
 assert.equal(await page.locator('.portal-answer').textContent(),'Gesehen · noch unsicher');assert.equal(await page.locator('.portal-event').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(243, 236, 251)');
 await page.locator('[data-reply="open"]').click();await page.waitForFunction(()=>document.querySelector('.portal-event').dataset.status==='open');await ready();assert.equal(reads,initialReads,'Antworten laden Termine und Nachweise nicht erneut');supported=false;await page.evaluate(()=>DeckelMobile.jump('portal-section'));await ready();await page.locator('[data-reply="maybe"]').click();assert.equal(replies,2);assert.match(await page.locator('#portal-status').textContent(),/Cloudflare-Dienst aktualisieren/);
 const cdp=await page.context().newCDPSession(page);
 async function swipe(x1,y1,x2,y2){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/5,y:y1+(y2-y1)*i/5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await swipe(300,210,100,210);assert.equal(await page.locator('#portal-page-evidence').isVisible(),true);await ready();await swipe(100,210,300,210);assert.equal(await page.locator('#portal-page-terms').isVisible(),true);await ready();
 await swipe(200,450,205,250);assert.equal(await page.locator('#portal-page-terms').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('Portal: ? speichern/zurücknehmen, violette Karte, alter Worker und echte Touch-Wischgesten geprüft.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
