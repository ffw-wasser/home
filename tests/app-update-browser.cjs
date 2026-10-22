// Synthetic release rollout; no production APIs or user data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));
  const next=release.build.replace(/\.(\d+)$/,(_,n)=>'.'+(Number(n)+1));let remote=release.build;
  await page.route('**/*',route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin!=='http://localhost')return route.abort();
   if(u.pathname==='/app-release.json')return route.fulfill({json:{...release,build:remote}});
   const file=path.resolve(root,'.'+u.pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Missing'});
   if(u.pathname==='/index.html'){
    let html=fs.readFileSync(file,'utf8');
    if(!request.isNavigationRequest()||u.searchParams.has('_ffw_refresh'))html=html.replace('content="'+release.build+'"','content="'+remote+'"');
    return route.fulfill({contentType:'text/html',body:html});
   }
   return route.fulfill({path:file});
  });
  await page.goto('http://localhost/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
  assert.equal(await page.locator('#app-update-banner').isVisible(),false);
  await page.locator('#menuToggleButton').click();await page.locator('#app-update-check').click();
  await page.waitForFunction(()=>document.querySelector('#app-update-message').textContent.includes('neuesten Stand'));
  remote=next;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.locator('#app-update-now').waitFor({state:'visible'});
  for(const width of [320,390,768,1024]){
   await page.setViewportSize({width,height:844});
   const bounds=await page.locator('#app-update-banner').boundingBox();
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'banner fits '+width);
  }
  await page.screenshot({path:'/tmp/ffw-update-browser.png'});
  await page.evaluate(()=>currentSessionId='synthetic-active-session');await page.locator('#app-update-now').click();
  assert.match(await page.locator('#app-update-message').textContent(),/laufenden Termin/);assert.ok(!page.url().includes('_ffw_refresh'));
  await page.evaluate(()=>{currentSessionId='';window.qaUpdateGuard=e=>e.preventDefault();window.addEventListener('beforeunload',qaUpdateGuard);});
  await page.locator('#app-update-now').click();assert.match(await page.locator('#app-update-message').textContent(),/offene Änderungen/);
  await page.evaluate(()=>window.removeEventListener('beforeunload',qaUpdateGuard));
  await page.locator('#app-update-now').click();await page.waitForURL(/_ffw_refresh=/);
  await page.locator('#appStartup').waitFor({state:'detached'});
  assert.equal(await page.locator('meta[name="ffw-build"]').getAttribute('content'),next);
  assert.equal(await page.locator('#app-update-banner').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('FFW update browser OK: manual/automatic checks, responsive banner, active-work guards, new release reload.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
