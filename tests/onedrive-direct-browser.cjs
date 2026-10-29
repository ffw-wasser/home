// Direct-folder conversion against synthetic Microsoft responses; no production traffic.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),folder={id:'0123456789abcdef!s1234',name:'Testordner',folder:{},parentReference:{driveId:'0123456789abcdef'}};
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({serviceWorkers:'block'}),calls=[],errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));
  if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  if(u.origin==='https://graph.microsoft.com'){calls.push({url:u.href,method:req.method(),auth:req.headers().authorization});return route.fulfill({json:u.href.includes(':/feuerwehr-wasser-daten.json?')?{id:'test-state',file:{}}:folder});}
  return route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/index.html');await page.evaluate(()=>AppStartup.update({ready:true}));await page.locator('#appStartup').waitFor({state:'hidden'});
 await page.evaluate(()=>{localStorage.setItem(OD_CLIENT_KEY,'test-client');localStorage.setItem(OD_SHARE_KEY,'https://example.test/old-share');localStorage.setItem(OD_TOKEN_KEY,JSON.stringify({access_token:'TEST-TOKEN',obtained_at:Date.now(),expires_in:3600,id_token:'a.'+btoa(JSON.stringify({iss:'test-issuer',sub:'test-owner'}))+'.b'}));oneDriveAccessConfirmed=true;adminUnlocked=true;resetAdminTimeout();currentSessionId='test-session';currentClosingTopic='Testthema';persistAttendanceDraft();});
 await page.locator('#cloudSyncButton').click();
 assert.equal(await page.getByRole('button',{name:'Direkten Ordnerzugriff einrichten',exact:true}).isVisible(),true);
 for(const width of [320,390,768,1024])for(const scale of [100,200]){
  await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);
  const button=page.locator('#oneDriveDirect');await button.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+width+'/'+scale);
  const fits=await button.evaluate(el=>{const r=el.getBoundingClientRect();return {fits:r.width<=innerWidth&&r.height>=40&&el.scrollWidth<=el.clientWidth+1,width:r.width,height:r.height,scroll:el.scrollWidth,client:el.clientWidth,inner:innerWidth,white:getComputedStyle(el).whiteSpace,min:getComputedStyle(el).minWidth};});assert.equal(fits.fits,true,'button '+width+'/'+scale+' '+JSON.stringify(fits));
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.getByRole('button',{name:'Direkten Ordnerzugriff einrichten',exact:true}).click();
 await page.getByRole('button',{name:'Direkten Ordnerzugriff prüfen',exact:true}).waitFor();
 const saved=await page.evaluate(async()=>{oneDriveSharedRoot=null;const root=await oneDriveResolveSharedRoot();return {address:localStorage.getItem(OD_SHARE_KEY),draft:JSON.parse(safeStorage.getItem(attendanceDraftKey)),source:root.driveId+':'+root.id};});
 assert.equal(saved.source,folder.parentReference.driveId+':'+folder.id);assert.equal(new URL(saved.address).hostname,'onedrive.live.com');assert.equal(saved.draft.topic,'Testthema');assert.equal(JSON.parse(saved.draft.source)[1],saved.address);
 assert.ok(calls.length>=4);assert.ok(calls.every(x=>x.method==='GET'&&x.auth==='Bearer TEST-TOKEN'));assert.equal(calls.filter(x=>x.url.includes('/shares/')).length,1);
 await page.evaluate(()=>{adminUnlocked=false;renderOneDriveDialog();});assert.equal(await page.locator('#oneDriveDirect').isVisible(),false);assert.equal(await page.locator('#oneDriveDirectStatus').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS direct-folder conversion, stable source and draft, authenticated GET-only calls, admin-only UI, 320–1024 px at 100/200%');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
