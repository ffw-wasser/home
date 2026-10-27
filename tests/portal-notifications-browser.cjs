// Synthetic PushManager only: never request notification permission or send a real message.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  class MockNotification{static permission='default';static requestPermission(){throw Error('subscribe must be called directly');}}
  Object.defineProperty(window,'Notification',{value:MockNotification,configurable:true});
  let sub=null;const reg={active:{postMessage(){}},pushManager:{getSubscription:async()=>sub,subscribe(){window.pushWasDirect=navigator.userActivation.isActive;MockNotification.permission='granted';sub={endpoint:'https://web.push.apple.com/synthetic-endpoint',unsubscribe:async()=>{sub=null;return true;}};return Promise.resolve(sub);}},getNotifications:async()=>[]};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg),addEventListener(){}}});
 });
 await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(root,url.pathname.replace(/^\/home\//,''));if(url.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});if(url.hostname==='push.example.workers.dev'){if(url.pathname==='/health')return route.fulfill({json:{portalVersion:1,publicKey:Buffer.from(Uint8Array.from({length:65},(_,i)=>i?1:4)).toString('base64url')}});return route.fulfill({json:{ok:true}});}return route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
 await page.evaluate(async()=>{H2OIdentity.session=()=>({session:true});H2OPortal.api=async()=>({ok:true});DeckelMobile.show(true);DeckelMobile.jump('more-security');await DeckelPush.render({alias:'a'.repeat(32),revision:'synthetic-revision',capability:'b'.repeat(43),origin:'https://push.example.workers.dev'});});
 await page.getByRole('button',{name:'Aktivieren',exact:true}).click();await page.locator('#portal-push-state').filter({hasText:'Aktiv'}).waitFor();assert.equal(await page.evaluate(()=>pushWasDirect),true,'subscribe retains the real click activation');assert.equal(await page.evaluate(async()=>new URL((await DeckelDevice.read()).url).hash),'','passkey mode stores no legacy link');
 await page.getByRole('button',{name:'Deaktivieren',exact:true}).click();await page.locator('#portal-push-status').filter({hasText:'Mitteilungen deaktiviert.'}).waitFor();assert.equal(await page.evaluate(()=>DeckelDevice.read()),null);
 for(const width of [320,390,768])for(const scale of [100,200]){
  await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);
  const fit=await page.locator('.portal-manual-refresh').evaluate(n=>{const r=n.getBoundingClientRect(),button=n.querySelector('button').getBoundingClientRect(),heading=n.querySelector('h3').getBoundingClientRect(),text=n.querySelector('p').getBoundingClientRect();return {inside:button.left>=r.left+10&&button.right<=r.right-10,ordered:heading.bottom<=text.top&&text.bottom<button.top,overflow:n.scrollWidth>n.clientWidth+1};});assert.equal(fit.inside&&fit.ordered&&!fit.overflow,true,JSON.stringify({width,scale,fit}));
 }
 await page.evaluate(async()=>{Object.defineProperty(navigator,'userAgent',{get:()=> 'iPhone H2ONative/1 iOS',configurable:true});DeckelInstall.refresh();await DeckelPush.render({alias:'a'.repeat(32),revision:'synthetic-revision',capability:'b'.repeat(43),origin:'https://push.example.workers.dev'});});
 assert.equal(await page.locator('#installSection').isVisible(),false);assert.equal(await page.locator('#portal-push-enable').isVisible(),false);assert.equal(await page.locator('#portal-push-disable').isVisible(),false);assert.match(await page.locator('#portal-push-note').innerText(),/Server-Mitteilungen.*noch nicht eingerichtet/);
 assert.deepEqual(errors,[]);console.log('PASS direct-click push activation and passkey-safe deactivation; settings card at 320/390/768 px and 100/200%.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
