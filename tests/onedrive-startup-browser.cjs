// Real startup gate and state synchronization; synthetic data and no external services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const stateFails of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
   page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin!=='https://ffw-wasser.github.io')return route.abort();
    const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
    if(u.pathname.endsWith('/js/core/onedrive-sync.js')){
     const stub=`\noneDriveSignedIn=()=>true;oneDriveHandleCallback=async()=>false;oneDriveAccessToken=async()=>"synthetic-token";oneDriveResolveSharedRoot=async()=>({driveId:"synthetic-drive",id:"synthetic-root"});oneDriveReadState=async()=>{${stateFails?'throw new Error("Synthetischer Datenkonflikt");':'return {data:{schemaVersion:3,members:[],entries:[],updatedAt:"2026-11-12T12:00:00Z"},eTag:"synthetic-tag"};'}};`;
     return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(file,'utf8')+stub});
    }
    if(u.pathname.endsWith('/js/features/history/onedrive-history-live.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(file,'utf8')+'\nwindow.loadOneDriveHistory=()=>{window.syntheticHistoryPending=true;return new Promise(()=>{});};'});
    return route.fulfill({path:file});
   });
   await page.goto('https://ffw-wasser.github.io/home/index.html');
   await page.waitForFunction(()=>window.syntheticHistoryPending===true);
   if(stateFails){
    await page.waitForFunction(()=>document.getElementById('appStartupStatus').textContent.includes('Synthetischer Datenkonflikt'));
    const text=await page.locator('#appStartupStatus').textContent();
    assert.match(text,/Version /);assert.equal(await page.locator('#appStartup').isVisible(),true);
    assert.equal(await page.locator('#protectedAppContent').getAttribute('aria-busy'),'true');
   }else{
    await page.locator('#appStartup').waitFor({state:'hidden'});
    assert.equal(await page.locator('#protectedAppContent').getAttribute('aria-busy'),null);
    assert.equal(await page.evaluate(()=>oneDriveBusy),true,'history is still pending');
    await page.evaluate(()=>endOneDriveSession());await page.locator('#appStartup').waitFor({state:'visible'});
    assert.equal(await page.locator('#protectedAppContent').getAttribute('aria-busy'),'true');
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS real OneDrive startup: pending history does not block confirmed data; state errors remain locked and show details/version; logout relocks.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
