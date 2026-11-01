// Actual portal/Worker with synthetic membership and bridges. No external traffic.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomBytes,createHash}=require('node:crypto'),{chromium,webkit}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await (process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});
 try{for(const platform of ['ios','android']){
  const f=await fixture(),person=f.people[0],other=f.people[1],session=randomBytes(32).toString('base64url');
  Object.assign(f.env,{H2O_APNS_TEAM_ID:'VKL57X3H6F',H2O_APNS_KEY_ID:'SYNTHKEY01',H2O_APNS_PRIVATE_KEY:'-----BEGIN PRIVATE KEY----- synthetic',H2O_FCM_PROJECT_ID:'synthetic-h2o',H2O_FCM_CLIENT_EMAIL:'h2o@synthetic-h2o.iam.gserviceaccount.com',H2O_FCM_PRIVATE_KEY:'-----BEGIN PRIVATE KEY----- synthetic'});
  const token=n=>platform==='ios'?n.toString(16).repeat(64):'synthetic-android-device-'+String(n).repeat(50);
  for(let i=1;i<=5;i++)assert.equal((await f.call('native-push',{platform,action:'subscribe',deviceToken:token(i)})).value.registered,true);
  assert.equal((await f.call('native-push',{platform,action:'subscribe',deviceToken:token(6)},other)).value.registered,true);
  f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+session).digest('base64url'),person.alias,person.revision,'fixture-'+person.alias,Date.now(),Date.now()+86400000);
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(data=>{
   Object.defineProperty(navigator,'userAgent',{value:data.platform==='android'?'Mozilla/5.0 (Android) H2ONative/1 Android':'Mozilla/5.0 (iPhone) H2ONative/1 iOS'});
   localStorage.setItem('h2o-portal-identity-v1',JSON.stringify(data.identity));localStorage.setItem('h2o-portal-identity-mode','1');localStorage.setItem('h2o-first-options-v1:native:'+data.identity.alias,'done');
   window.syntheticPushToken=data.deviceToken;window.nativeRequests=[];
   window.webkit={messageHandlers:{h2oNotifications:{postMessage(message){nativeRequests.push(message.action);setTimeout(()=>dispatchEvent(new CustomEvent('h2o-native-notifications',{detail:{id:message.id,permission:'granted',deviceToken:syntheticPushToken}})),0);}}}};
  },{platform,deviceToken:token(7),identity:{scope:'portal',alias:person.alias,revision:person.revision,token:session,expiresAt:Date.now()+86400000}});
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin==='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'){
    const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}:{})}),f.env);
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));
   return url.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
  });
  await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.evaluate(()=>DeckelMobile.jump('more-security'));
  const enable=page.getByRole('button',{name:'Mitteilungen erlauben',exact:true}),reset=page.getByRole('button',{name:'Push-Verbindungen zurücksetzen',exact:true});
  await enable.click();await page.locator('#portal-push-state').filter({hasText:'Gerätelimit erreicht'}).waitFor();
  assert.equal(await reset.isVisible(),true);assert.equal(await enable.isVisible(),false);
  assert.equal((await f.call('push-devices')).value.count,5,'limit never deletes devices automatically');
  if(process.env.CAPTURE_NATIVE_PUSH_HELP&&platform==='ios'){
   await page.setViewportSize({width:390,height:1000});
   const folder=path.join(root,'assets/help/guide'),target=page.locator('#portal-notification-settings'),name='h2o-konto-sicherheit',sizes=JSON.parse(fs.readFileSync(path.join(folder,'screens.json'),'utf8'));
   await target.screenshot({path:path.join(folder,name+'.jpg'),type:'jpeg',quality:80,animations:'disabled'});const box=await target.boundingBox();sizes[name]={width:Math.round(box.width),height:Math.round(box.height)};fs.writeFileSync(path.join(folder,'screens.json'),JSON.stringify(sizes,null,2)+'\n');
  }
  page.once('dialog',dialog=>dialog.dismiss());await reset.click();assert.equal((await f.call('push-devices')).value.count,5,'cancel keeps all registrations');
  page.once('dialog',dialog=>dialog.accept());await reset.click();await enable.waitFor({state:'visible'});
  assert.equal((await f.call('push-devices')).value.count,0);assert.equal((await f.call('push-devices',{},other)).value.count,1,'another member is unaffected');
  assert.equal(await page.evaluate(()=>H2OIdentity.session()?.alias),person.alias,'identity remains signed in');
  assert.equal(await page.evaluate(alias=>localStorage.getItem('h2o-native-push-opt-in:'+alias),person.alias),null,'reset requires a fresh opt-in');
  await enable.click();await page.locator('#portal-push-state').filter({hasText:'Aktiv'}).waitFor();assert.equal((await f.call('push-devices')).value.count,1);
  // A replacement native token during an automatic foreground refresh has the same recovery path.
  for(let i=1;i<=4;i++)await f.call('native-push',{platform,action:'subscribe',deviceToken:token(i)});
  await page.evaluate(value=>{syntheticPushToken=value;document.dispatchEvent(new Event('visibilitychange'));},token(8));
  await page.locator('#portal-push-state').filter({hasText:'Gerätelimit erreicht'}).waitFor();assert.equal(await reset.isVisible(),true);
  assert.equal((await f.call('push-devices')).value.count,5);assert.equal(f.sends.length,0,'no real push is sent');assert.deepEqual(errors,[]);
  console.log('PASS '+platform+': device limit, cancel/confirm own reset, other member preserved, fresh activation and foreground token replacement.');await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
