// Synthetic link configuration only; no network access or installation action.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [device,ua] of [['apple','Mozilla/5.0 (iPhone)'],['android','Mozilla/5.0 (Linux; Android 14)'],['desktop','Mozilla/5.0']]){
   const page=await browser.newPage({viewport:{width:360,height:800},userAgent:ua}),errors=[];page.on('pageerror',e=>errors.push(e.message));let ios=null,android=null;
   await page.route('**/*',route=>{
    const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));
    if(['apps.apple.com','play.google.com'].includes(u.hostname))return route.fulfill({contentType:'text/html',body:'<p>Synthetic store destination</p>'});
    if(u.origin!=='https://ffw-wasser.github.io')return route.abort();
    // A stale browser cache entry must not replace the versioned installation script.
    if(u.pathname.endsWith('/js/install.js')&&!u.search)return route.fulfill({contentType:'text/javascript',body:'/* Synthetic old cached script */'});
    if(u.pathname.endsWith('/native/store/install-links.json'))return route.fulfill({json:{ios,android}});
    return file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
   });
   await page.goto('https://ffw-wasser.github.io/home/install.html');
   assert.equal(await page.locator('#apple-install').isVisible(),device!=='android');assert.equal(await page.locator('#android-install').isVisible(),device!=='apple');assert.equal(await page.locator('#apple-store').isVisible(),false);
   assert.equal(await page.locator('img[src="assets/install/h2o-install.svg"]').count(),0,'public installation page does not display the administrative QR');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const out=path.join(root,'qa/ios-store');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'installation-'+device+'.png'),animations:'disabled'});
   ios='https://evil.example/install';await page.reload();assert.equal(await page.locator('#apple-store').getAttribute('href'),null);
   ios='https://apps.apple.com/de/app/h2o-portal/id1234567890';android='https://play.google.com/apps/internaltest/1234567890';await page.reload();
   if(device==='desktop'){await page.locator('#apple-store[href]').waitFor({state:'attached'});assert.equal(await page.locator('#apple-store').getAttribute('href'),ios);assert.equal(await page.locator('#android-store').getAttribute('href'),android);}
   else await page.waitForURL(device==='apple'?ios:android);
   assert.deepEqual(errors,[]);await page.close();
  }
  const admin=await browser.newPage({viewport:{width:768,height:1024},serviceWorkers:'block'});
  await admin.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
  await admin.goto('https://ffw-wasser.github.io/home/index.html');await admin.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});await admin.locator('#appStartup').waitFor({state:'hidden'});
  assert.equal(await admin.locator('#portal-admin-installation').isVisible(),false);
  await admin.evaluate(async()=>{requireAdmin=()=>true;adminUnlocked=true;resetAdminTimeout();oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;oneDriveReadState=async()=>({members:[]});PortalSubscriptionAdmin.load=async()=>{};showView('settingsPortalView');await PortalAdmin.load();});
  await admin.locator('#portal-admin-installation-show').click();await admin.waitForFunction(()=>document.getElementById('portal-admin-installation-qr').naturalWidth>0);
  assert.equal(await admin.locator('#portal-admin-installation-qr').getAttribute('src'),'assets/install/h2o-install.svg');
  await admin.locator('#portal-admin-installation').screenshot({path:path.join(root,'qa/ios-store/installation-geraetehaus-ipad.png'),animations:'disabled'});
  await admin.evaluate(()=>PortalAdmin.lock());assert.equal(await admin.locator('#portal-admin-installation').isVisible(),false);assert.equal(await admin.locator('#portal-admin-installation-qr').getAttribute('src'),null);await admin.close();
  console.log('PASS common installation: correct platform, no dead Apple link, approved store hosts only and mobile redirect, 360px layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
