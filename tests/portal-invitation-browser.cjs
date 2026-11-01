// Real account invitation UI and Worker; synthetic OneDrive only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture();f.env.ADMIN_TOKEN='b'.repeat(64);
 const source='a1b2c3d4e5f60718:root';f.sql.prepare('UPDATE ledger_meta SET source=?').run(source);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:768},serviceWorkers:'block'}),errors=[],github=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
   if(u.hostname.endsWith('workers.dev')){const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
   if(u.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});}
   if(u.hostname==='api.github.com')github.push(req.url());return route.abort();
  });
  await page.goto('https://ffw-wasser.github.io/home/index.html');await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});await page.locator('#appStartup').waitFor({state:'hidden'});
  await page.evaluate(async({token,record,source})=>{
   oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;adminUnlocked=true;resetAdminTimeout();
   window.qaMembers=[{id:record.memberId,firstName:'Anna',lastName:'Testperson'},{id:'new-member',firstName:'Ben',lastName:'Testperson'}];
   window.oneDriveReadState=async()=>({members:qaMembers});
   oneDriveSignedIn=()=>true;oneDriveResolveSharedRoot=async()=>({driveId:'A1B2C3D4E5F60718',id:'root'});
   window.qaFiles=new Map([[await DrinksStore.mobileFileName(record.memberId),{data:record,item:{eTag:'synthetic-1'}}]]);
   qaFiles.set('konten-zentrale.json',{data:{version:1,source,state:'active'},item:{eTag:'synthetic-marker'}});
   qaFiles.set('push-verbindung.json',{data:{origin:'https://test.account.workers.dev',token},item:{eTag:'synthetic-push'}});
   window.odFetch=async(url,options={})=>{
    const p=decodeURIComponent(new URL(url).pathname),reply=value=>({json:async()=>value});
    if(p.endsWith('/root:/Getraenke'))return reply({id:'qa-folder',folder:{}});
    const named=p.match(/\/qa-folder:\/([^/]+?)(?::\/content)?$/),identified=p.match(/\/qa-file-([^/]+?)(?:\/content)?$/),name=named?.[1]||identified?.[1];
    if(!name)throw Error('Unexpected synthetic Graph request');
    if(options.method==='PUT'){qaFiles.set(name,{data:JSON.parse(options.body),item:{eTag:'synthetic-new'}});return reply({id:'qa-file-'+name});}
    const saved=qaFiles.get(name);if(!saved)throw Object.assign(Error('Synthetic missing file'),{status:404});
    return reply(p.endsWith('/content')?saved.data:{id:'qa-file-'+name,eTag:saved.item.eTag,file:{}});
   };
   showView('attendanceView');
  },{token:f.env.ADMIN_TOKEN,record:f.people[0],source});
  await page.locator('#calendar-sidebar .calendar-sidebar-event').first().waitFor({state:'attached'});
  assert.match(await page.locator('#calendar-sidebar .calendar-sidebar-load-status').innerText(),/Stand/);
  assert.equal(await page.evaluate(()=>DrinksStore.sourceKey()),source,'uppercase Microsoft drive ID uses the original lowercase service source');
  await page.evaluate(()=>showView('settingsPortalView'));
  await page.locator('#portal-admin-member option').nth(2).waitFor({state:'attached'});
  async function invite(id){
   await page.locator('#portal-admin-member').selectOption(id);page.once('dialog',d=>d.accept());await page.locator('#portal-admin-show-qr').click();
   await page.locator('#portal-admin-link').waitFor({state:'visible'}).catch(async e=>{console.error(await page.locator('#portal-admin-qr-status').innerText(),await page.locator('#portal-admin-status').innerText(),errors);throw e;});
   const result=await page.evaluate(()=>({href:document.getElementById('portal-admin-link').href,code:document.getElementById('portal-admin-identity-code').value}));
   assert.equal(new URL(result.href).hash,'#setup='+result.code);assert.equal(new URL(result.href).search,'');assert.equal(await page.locator('#portal-admin-qr').isVisible(),true,'personal one-use QR is displayed');
   assert.doesNotMatch(result.href,/github_pat_|[?#&]k=/);assert.equal(await page.locator('#portal-admin-show-qr').isEnabled(),true);
   return result;
  }
  await invite(f.people[0].memberId);await invite('new-member');assert.equal(github.length,0,'Passkey invitation never needs legacy GitHub publishing');
  assert.equal(await page.evaluate(()=>qaFiles.has('handy-verbindung.json')),false);
  for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});await page.locator('#portal-admin-link').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('#portal-admin-link').isVisible(),true);}
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:1024,height:900});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'mitglied-einladung.png')});}
  await page.locator('#portal-admin-member').selectOption(f.people[0].memberId);assert.equal(await page.locator('#portal-admin-qr').isVisible(),false,'member change clears the invitation');
  await page.evaluate(()=>{DrinksCentral.register=async()=>{throw Error('Synthetischer Dienstfehler');};});page.once('dialog',d=>d.accept());await page.locator('#portal-admin-show-qr').click();
  await page.locator('#portal-admin-qr-status').filter({hasText:'Synthetischer Dienstfehler'}).waitFor();assert.equal(await page.locator('#portal-admin-qr').isVisible(),false);assert.equal(await page.locator('#portal-admin-show-qr').isEnabled(),true);assert.equal(await page.locator('#portal-admin-show-qr').getAttribute('aria-busy'),'false');
  assert.deepEqual(errors,[]);console.log('PASS existing/new member invitation without legacy config, real Store/connection and uppercase Graph ID, calendar, real Worker ticket, personal one-use QR and link, visible errors, member switch and 320–1024 px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
