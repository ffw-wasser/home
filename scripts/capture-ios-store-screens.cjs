// Actual portal UI, synthetic in-memory backend, all external traffic denied.
// These are preparation images; verify them against the final native build before submission.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto'),{webkit}=require('playwright');
const {fixture}=require('../tests/helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.IOS_STORE_OUTPUT||path.join(root,'qa/ios-store'));
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await webkit.launch({headless:true}),manifest=[];
 try{
  for(const device of [{name:'iphone',width:402,height:874,scale:3},{name:'ipad',width:1032,height:1376,scale:2}]){
   const f=await fixture({features:{rewards:false,challenge:false}}),person=f.people[0],token=randomBytes(32).toString('base64url');
   f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),person.alias,person.revision,'fixture-'+person.alias,Date.now(),Date.now()+86400000);
   const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.scale,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone) H2ONative/1 iOS'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
   await page.addInitScript(session=>{
    localStorage.setItem('h2o-portal-identity-v1',JSON.stringify(session));localStorage.setItem('h2o-portal-identity-mode','1');localStorage.setItem('h2o_onboarding_complete','1');localStorage.setItem('h2o-first-options-v1:native:'+session.alias,'done');
   },{scope:'portal',alias:person.alias,revision:person.revision,token,expiresAt:Date.now()+86400000});
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin==='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'){
     const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}:{})}),f.env);
     return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    }
    const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));
    if(url.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
    return route.abort();
   });
   await page.goto('https://ffw-wasser.github.io/home/deckel.html?nativePage=terms');await page.locator('#h2oStartup').waitFor({state:'hidden'});
   await page.addScriptTag({url:'https://ffw-wasser.github.io/home/native/shared/ios-entry.js'});
   await page.locator('.portal-event').first().waitFor({state:'visible'});
   for(const target of ['portal-section','more-training','deckel-more']){
    await page.evaluate(id=>DeckelMobile.jump(id),target);
    await page.evaluate(()=>{document.getElementById('deckel-main')?.scrollTo(0,0);window.scrollTo(0,0);});
    const name=device.name+'-'+target+'.png';await page.screenshot({path:path.join(out,name),animations:'disabled'});
    manifest.push({file:name,width:device.width*device.scale,height:device.height*device.scale,source:'actual portal UI with synthetic in-memory backend',nativeDeviceVerified:false});
   }
   assert.deepEqual(errors,[]);assert.equal(f.sends.length,0);await context.close();
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Prepared '+manifest.length+' iPhone/iPad screenshots. No production data or services used.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
