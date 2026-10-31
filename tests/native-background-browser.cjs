// Real portal and Worker with synthetic membership; every external request is blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomBytes,createHash}=require('node:crypto'),{chromium,webkit}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture(),person=f.people[0],token=randomBytes(32).toString('base64url'),nativeCalls=[];
 Object.assign(f.env,{H2O_APNS_TEAM_ID:'VKL57X3H6F',H2O_APNS_KEY_ID:'SYNTHKEY01',H2O_APNS_PRIVATE_KEY:'-----BEGIN PRIVATE KEY----- synthetic'});
 f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),person.alias,person.revision,'fixture-'+person.alias,Date.now(),Date.now()+86400000);
 const browser=await (process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(session=>{
   Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone) H2ONative/1 iOS'});
   window.syntheticHidden=false;Object.defineProperty(document,'hidden',{get:()=>window.syntheticHidden,configurable:true});
   localStorage.setItem('h2o-portal-identity-v1',JSON.stringify(session));localStorage.setItem('h2o-portal-identity-mode','1');localStorage.setItem('h2o_onboarding_complete','1');localStorage.setItem('h2o-first-options-v1:native:'+session.alias,'done');
   window.widgetMessages=[];window.webkit={messageHandlers:{h2oWidget:{postMessage:message=>widgetMessages.push(message)},h2oNotifications:{postMessage(message){setTimeout(()=>dispatchEvent(new CustomEvent('h2o-native-notifications',{detail:{id:message.id,permission:'granted',deviceToken:'a'.repeat(64)}})),0);}}}};
  },{scope:'portal',alias:person.alias,revision:person.revision,token,expiresAt:Date.now()+86400000});
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin==='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'){
    if(url.pathname==='/portal/native-push')nativeCalls.push(JSON.parse(req.postData()).action);
    const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}:{})}),f.env);
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));
   return url.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
  });
  const eventId=(await f.call('list')).value.events[0].id;
  await page.goto('https://ffw-wasser.github.io/home/deckel.html?nativePage=terms&event='+eventId);await page.locator('#h2oStartup').waitFor({state:'hidden'});
  // Native Swift maps the Calendar URL to this destination; inject the actual
  // bundled entry script and exercise navigation, reply and widget together.
  await page.addScriptTag({url:'https://ffw-wasser.github.io/home/native/shared/ios-entry.js'});
  assert.equal(new URL(page.url()).searchParams.get('event'),eventId);
  assert.equal(new URL(page.url()).searchParams.has('nativePage'),false);
  const card=page.locator('#portal-event-'+eventId);
  await card.getByRole('button',{name:'Bin dabei',exact:true}).click();
  await page.waitForFunction(()=>widgetMessages.at(-1)?.event?.status==='yes');
  assert.equal((await f.call('list')).value.events[0].status,'yes');
  await page.evaluate(()=>DeckelMobile.jump('deckel-more'));
  await page.locator('#portal-page-more').waitFor({state:'visible'});
  await page.evaluate(()=>DeckelMobile.jump('portal-section'));
  await card.waitFor({state:'visible'});
  await page.waitForFunction(()=>widgetMessages.at(-1)?.action==='update');
  await page.evaluate(()=>DeckelMobile.jump('more-security'));
  await page.getByRole('button',{name:'Mitteilungen erlauben',exact:true}).click();await page.locator('#portal-push-state').filter({hasText:'Aktiv'}).waitFor();
  const before=await page.evaluate(()=>widgetMessages.length),unsubscribed=nativeCalls.filter(x=>x==='unsubscribe').length;
  await page.evaluate(()=>{syntheticHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
  assert.deepEqual(await page.evaluate(start=>widgetMessages.slice(start),before),[],'backgrounding must preserve the confirmed native snapshot');
  assert.equal(nativeCalls.filter(x=>x==='unsubscribe').length,unsubscribed,'backgrounding must not unsubscribe native push');
  assert.equal(await page.locator('#portal-section').isVisible(),false,'private calendar UI is still cleared in background');
  assert.equal(await page.locator('#account').isVisible(),false,'private account UI is still cleared in background');
  assert.equal(await page.locator('#portal-events').textContent(),'');
  assert.equal(await page.evaluate(alias=>localStorage.getItem('h2o-native-push-opt-in:'+alias),person.alias),'yes');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM devices WHERE alias=?').get(person.alias).n,1);
  await page.evaluate(()=>{syntheticHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(start=>widgetMessages.length>start&&widgetMessages.at(-1)?.action==='update',before);
  await page.locator('#portal-push-state').filter({hasText:'Aktiv'}).waitFor({state:'attached'});
  const removed=page.waitForResponse(r=>new URL(r.url()).pathname==='/portal/native-push'&&JSON.parse(r.request().postData()).action==='unsubscribe');
  await page.evaluate(()=>H2OPortal.clear());
  await removed;
  assert.equal(await page.evaluate(()=>widgetMessages.at(-1).action),'clear','explicit identity clearing must still clear the widget');
  await page.waitForFunction(()=>localStorage.getItem('h2o-native-push-opt-in:'+H2OIdentity.session().alias)!=='yes');
  assert.ok(nativeCalls.filter(x=>x==='unsubscribe').length>unsubscribed,'explicit identity clearing still unregisters native push');
  assert.deepEqual(errors,[]);assert.equal(f.sends.length,0,'no real push is sent');
  console.log('PASS native calendar reply preserves portal navigation and updates widget; widget and push survive Home-screen switch; private UI clears; foreground refreshes; explicit logout still clears and unsubscribes.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
