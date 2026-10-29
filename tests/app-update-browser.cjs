// Synthetic rollout for both applications; no private APIs, cookies or production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8')),next=release.build.replace(/\.(\d+)$/,(_,n)=>'.'+(Number(n)+1));
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const portal of [false,true])for(const mode of ['current','new','offline','stale','loop','slow','resume']){
  const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const file=portal?'deckel.html':'index.html',parameter=portal?'_h2o_refresh':'_ffw_refresh',meta=portal?'deckel-build':'ffw-build';let remote=['new','stale','loop'].includes(mode)?next:release.build,unblock;const hold=new Promise(resolve=>unblock=resolve);
  await page.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());if(u.origin!=='http://localhost')return route.abort();if(u.pathname==='/app-release.json'){requests.push({url:request.url(),headers:request.headers()});if(mode==='offline')return route.abort();if(mode==='slow')await hold;return route.fulfill({json:{...release,build:remote}});}const target=path.resolve(root,'.'+u.pathname);if(!target.startsWith(root+path.sep)||!fs.existsSync(target))return route.fulfill({status:404,body:'Missing'});if(u.pathname==='/'+file){let html=fs.readFileSync(target,'utf8');if((!request.isNavigationRequest()||u.searchParams.has(parameter))&&mode!=='stale'&&mode!=='loop')html=html.replace('name="'+meta+'" content="'+release.build+'"','name="'+meta+'" content="'+remote+'"');return route.fulfill({body:html,contentType:'text/html'});}return route.fulfill({path:target});});
  await page.goto('http://localhost/'+file+(mode==='loop'?'?'+parameter+'='+next:'')+'#private-local-access');
  if(mode==='slow'){
   if(!portal)await page.evaluate(()=>AppStartup.update({ready:true}));
   await page.locator(portal?'#h2oStartup':'#appStartup').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>AppRelease.pending),true,'splash holds the ready app during the version check');unblock();
  }
  if(mode==='new')await page.waitForURL(new RegExp(parameter+'='+next.replaceAll('.','\\.')));
  await page.waitForFunction(()=>!AppRelease.pending);
  if(!portal)await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});
  await page.locator(portal?'#h2oStartup':'#appStartup').waitFor({state:'hidden'});
  assert.equal(await page.locator('#app-update-banner,#app-update-now,#deckel-update-banner,#deckel-update-now').count(),0);
  assert.equal(await page.locator('meta[name="'+meta+'"]').getAttribute('content'),mode==='new'?next:release.build);
  assert.equal(new URL(page.url()).hash,'#private-local-access');assert.ok(requests.every(r=>!r.url.includes('private')&&!r.headers.referer&&!r.headers.authorization));
  if(mode==='current'){
   remote=next;
   await page.evaluate(portal=>{window.qaUpdateDocument='preserved';if(portal)DeckelActions.hasUnsaved=()=>true;else currentSessionId='synthetic-running-term';},portal);
   assert.equal(await page.evaluate(portal=>portal?DeckelUpdate.check():FFWUpdate.check(),portal),true);
   assert.equal(await page.evaluate(portal=>portal?DeckelUpdate.reload():FFWUpdate.apply(),portal),false);
   assert.equal(await page.evaluate(()=>qaUpdateDocument),'preserved');assert.equal(new URL(page.url()).searchParams.has(parameter),false);
   await page.evaluate(portal=>{if(portal)DeckelActions.hasUnsaved=()=>false;else currentSessionId='';},portal);
   await page.evaluate(portal=>{void(portal?DeckelUpdate.reload():FFWUpdate.apply());},portal);await page.waitForURL(new RegExp(parameter+'='+next.replaceAll('.','\\.')));await page.waitForFunction(()=>!AppRelease.pending);assert.equal(await page.locator('meta[name="'+meta+'"]').getAttribute('content'),next);
  }
  if(mode==='resume'){
   remote=next;await page.evaluate(portal=>{if(portal)DeckelActions.hasUnsaved=()=>true;else currentSessionId='synthetic-running-term';document.dispatchEvent(new Event('visibilitychange'));},portal);
   assert.equal(new URL(page.url()).searchParams.has(parameter),false,'open work defers resume updates');
   await page.evaluate(portal=>{if(portal)DeckelActions.hasUnsaved=()=>false;else currentSessionId='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.dispatchEvent(new Event('visibilitychange'));},portal);
   await page.waitForURL(new RegExp(parameter+'='+next.replaceAll('.','\\.')));await page.waitForFunction(()=>!AppRelease.pending);assert.equal(await page.locator('meta[name="'+meta+'"]').getAttribute('content'),next);
  }
  assert.deepEqual(errors,[]);console.log('PASS startup update: '+file+' / '+mode);await page.close();
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
