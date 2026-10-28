// First scan with a locally plausible but server-revoked session; no production accounts or services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..'),base='https://ffw-wasser.github.io/home/deckel.html',storage='h2o-portal-identity-v1';
(async()=>{const f=await fixture(),browser=await chromium.launch({headless:true});try{
 const person=f.people[0],token='s'.repeat(43),expiresAt=Date.now()+86400000;
 f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),person.alias,person.revision,'fixture-'+person.alias,Date.now(),expiresAt);
 const fresh=(await f.call('identity-ticket',{alias:person.alias,revision:person.revision,reset:true},null,true)).value;
 const context=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',serviceWorkers:'block'}),errors=[],requests=[];
 await context.addInitScript(({storage,session})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(storage,JSON.stringify(session));sessionStorage.setItem('seeded','1');}},{storage,session:{scope:'portal',token,alias:person.alias,revision:person.revision,expiresAt}});
 const routeApp=async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname.endsWith('workers.dev')){requests.push(u.pathname);const response=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}:{})}),f.env);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();};await context.route('**/*',routeApp);
 const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#setup='+fresh.code);await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.waitForFunction(()=>!DeckelReload.isLoading());
 assert.equal(await page.evaluate(storage=>localStorage.getItem(storage),storage),null,'the revoked session is removed');
 assert.equal(await page.locator('#h2o-onboarding').count(),1,'first scan must open the wizard after rejecting the old session');
 assert.equal(await page.locator('#h2o-onboarding').evaluate(n=>n.open),true);assert.equal(await page.locator('#h2o-onboarding-title').innerText(),'Zugang einrichten');
 assert.equal(await page.locator('#identity-code').inputValue(),fresh.code);assert.equal(await page.evaluate(()=>location.hash),'');assert.equal(await page.locator('#h2o-onboarding #identity-register').isVisible(),true);
 assert.equal(requests.some(p=>p.includes('/enroll/')),false,'opening a link never enrolls by itself');assert.equal(await page.locator('#portal-section').isVisible(),false);
 // Safari may reuse a page and change only its fragment when another QR is opened.
 await page.getByRole('button',{name:'Benutzername und Passwort',exact:true}).click();await page.locator('#identity-new-username').fill('previous.member');await page.locator('#identity-new-password').fill('synthetic previous draft');
 const next=(await f.call('identity-ticket',{alias:person.alias,revision:person.revision},null,true)).value;
 await page.evaluate(code=>{window.sameDocumentMarker='kept';location.hash='setup='+code;},next.code);
 await page.waitForFunction(code=>document.getElementById('identity-code').value===code,next.code);assert.equal(await page.evaluate(()=>window.sameDocumentMarker),'kept');assert.equal(await page.locator('#h2o-onboarding-title').innerText(),'Zugang einrichten');
 assert.equal(await page.locator('#identity-new-password').inputValue(),'');assert.equal(await page.locator('#identity-new-username').inputValue(),'');assert.equal(await page.evaluate(()=>location.hash),'');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#h2o-onboarding').evaluate(n=>n.open),false);
 const reopened=(await f.call('identity-ticket',{alias:person.alias,revision:person.revision},null,true)).value;
 await page.evaluate(code=>location.hash='setup='+code,reopened.code);await page.waitForFunction(()=>document.getElementById('h2o-onboarding').open);
 assert.equal(await page.locator('#identity-code').inputValue(),reopened.code);assert.equal(await page.locator('#h2o-onboarding').count(),1,'reuse the existing wizard instead of creating a second dialog');
 // A delayed rejected check for the old token must never remove a newer valid session.
 let releaseOld,oldStarted;const oldGate=new Promise(r=>releaseOld=r),started=new Promise(r=>oldStarted=r);
 await page.route('**/portal/passkey/session',async route=>{if(route.request().headers().authorization==='Bearer '+token){oldStarted();await oldGate;return route.fulfill({status:401,json:{error:'synthetic revoked session'}});}return route.fallback();});
 await page.evaluate(({storage,session})=>{localStorage.setItem(storage,JSON.stringify(session));window.oldCheck=H2OIdentity.prepare();},{storage,session:{scope:'portal',token,alias:person.alias,revision:person.revision,expiresAt}});await started;
 const other=f.people[1],newToken='n'.repeat(43);f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+newToken).digest('base64url'),other.alias,other.revision,'fixture-'+other.alias,Date.now(),expiresAt);
 await page.evaluate(async({storage,session})=>{localStorage.setItem(storage,JSON.stringify(session));await H2OIdentity.prepare();},{storage,session:{scope:'portal',token:newToken,alias:other.alias,revision:other.revision,expiresAt}});
 releaseOld();await page.evaluate(()=>window.oldCheck);assert.equal(await page.evaluate(()=>H2OIdentity.session().token),newToken);assert.equal(await page.evaluate(()=>H2OIdentity.credentials().alias),other.alias);
 // A slow later script must not force a second scan or lose the invitation.
 const earlyContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await earlyContext.addInitScript(({storage,session})=>localStorage.setItem(storage,JSON.stringify(session)),{storage,session:{scope:'portal',token,alias:person.alias,revision:person.revision,expiresAt}});await earlyContext.route('**/*',routeApp);
 const early=await earlyContext.newPage();early.on('pageerror',e=>errors.push(e.message));let releaseScript;const scriptGate=new Promise(r=>releaseScript=r);
 await early.route('**/portal-regulations.js*',async route=>{await scriptGate;return routeApp(route);});
 await early.goto(base+'#setup='+fresh.code,{waitUntil:'commit'});await early.waitForFunction(()=>window.H2OIdentity&&!H2OIdentity.session());assert.equal(await early.locator('#h2o-onboarding-title').innerText(),'Zugang einrichten','the wizard is ready even while another script is still pending');
 releaseScript();await early.waitForLoadState('domcontentloaded');await early.locator('#h2oStartup').waitFor({state:'hidden'});assert.equal(await early.locator('#h2o-onboarding-title').innerText(),'Zugang einrichten');assert.equal(await early.locator('#identity-code').inputValue(),fresh.code);await earlyContext.close();
 assert.deepEqual(errors,[]);console.log('PASS: first QR after revocation, same-document QR with fresh fields, reopening a closed wizard and delayed-old-session race; no second scan or automatic enrollment');
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
