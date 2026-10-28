// Model the iOS Home Screen's separate storage and Safari-less UA. Synthetic passkeys/services only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..'),base='https://ffw-wasser.github.io/home/deckel.html';
const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
(async()=>{const f=await fixture({authenticated:false}),browser=await chromium.launch({headless:true});try{
 const errors=[];
 async function context(home){const c=await browser.newContext({viewport:{width:390,height:844},userAgent:ios+(home?'':' Version/26.0 Safari/604.1'),serviceWorkers:'block'}),calls=[];
  if(home)await c.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
  c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await c.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname.endsWith('workers.dev')){calls.push({path:u.pathname,body:req.postDataJSON()});const r=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()});}const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
  const p=await c.newPage();p.setDefaultTimeout(12000);const client=await c.newCDPSession(p);await client.send('WebAuthn.enable');const {authenticatorId}=await client.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});return {c,p,calls,client,authenticatorId};
 }
 // Set up and sign in once in Safari with the genuine UI and server grant flow.
 const person=f.people[0],ticket=(await f.call('identity-ticket',{alias:person.alias,revision:person.revision},null,true)).value;
 const safari=await context(false);await safari.p.goto(base+'#setup='+ticket.code);await safari.p.locator('#h2oStartup').waitFor({state:'hidden'});
 await safari.p.locator('#identity-register').click();await safari.p.locator('#identity-message').filter({hasText:'Passkey gespeichert'}).waitFor();await safari.p.locator('#identity-login').click();await safari.p.getByRole('button',{name:'Später · im Browser weiter',exact:true}).click();await safari.p.getByRole('button',{name:'H₂O öffnen',exact:true}).click();await safari.p.locator('#portal-section').waitFor({state:'visible'});
 let credential=(await safari.client.send('WebAuthn.getCredentials',{authenticatorId:safari.authenticatorId})).credentials[0];assert.ok(credential);
 await safari.c.close();
 // Each app launch starts with EMPTY storage; only the device's existing passkey is present.
 for(const fragment of ['', '#setup='+ticket.code, '#setup='+'x'.repeat(43)]){
  const home=await context(true);await home.client.send('WebAuthn.addCredential',{authenticatorId:home.authenticatorId,credential});
  await home.p.goto(base+fragment);await home.p.locator('#h2oStartup').waitFor({state:'hidden'});
  assert.equal(await home.p.evaluate(()=>localStorage.getItem('h2o-portal-identity-v1')),null);
  assert.equal(await home.p.evaluate(()=>location.hash),'');assert.equal(await home.p.locator('#h2o-onboarding-title').innerText(),'Anmelden');
  assert.equal(await home.p.locator('#h2o-onboarding #identity-login').isVisible(),true);assert.equal(await home.p.locator('#h2o-onboarding #identity-register').count(),0);
  assert.equal(await home.p.getByRole('button',{name:'Zurück',exact:true}).isVisible(),false,'the Home start does not lead back into the setup chooser');
  assert.equal(await home.p.getByRole('button',{name:'Einladungslink kopieren',exact:true}).count(),0,'Home app is never sent back to Safari');
  if(process.env.CAPTURE_HOME_LOGIN_HELP&&!fragment){const folder=path.join(root,'assets/help/guide'),target=home.p.locator('#h2o-onboarding');await target.screenshot({path:path.join(folder,'h2o-home-anmeldung.jpg'),type:'jpeg',quality:80});const box=await target.boundingBox(),sizes=JSON.parse(fs.readFileSync(path.join(folder,'screens.json'),'utf8'));sizes['h2o-home-anmeldung']={width:Math.round(box.width),height:Math.round(box.height)};fs.writeFileSync(path.join(folder,'screens.json'),JSON.stringify(sizes,null,2)+'\n');}
  await home.p.locator('#identity-login').click();await home.p.locator('#portal-section').waitFor({state:'visible'});
  assert.equal(await home.p.locator('#h2o-onboarding').evaluate(n=>n.open),false);assert.equal(await home.p.locator('#installSection').isVisible(),false);
  assert.equal(home.calls.some(v=>v.path.includes('/enroll/')),false,'existing passkey needs no enrollment');
  const login=home.calls.find(v=>v.path.endsWith('/portal/login/verify'));assert.ok(login);assert.equal(Object.hasOwn(login.body,'code'),false,'stale tickets must not accompany an existing-account assertion');
  assert.equal(await home.p.evaluate(()=>H2OIdentity.session().alias),person.alias);
  await home.p.reload();await home.p.locator('#portal-section').waitFor({state:'visible'});assert.equal(await home.p.locator('#h2o-onboarding').count(),0,'session persists in the Home app');
  credential=(await home.client.send('WebAuthn.getCredentials',{authenticatorId:home.authenticatorId})).credentials[0];await home.c.close();
 }
 // A genuinely new member can still deliberately use a fresh invitation in the installed app.
 const newPerson=f.people[1],newTicket=(await f.call('identity-ticket',{alias:newPerson.alias,revision:newPerson.revision},null,true)).value,firstHome=await context(true);
 await firstHome.p.goto(base+'#setup='+newTicket.code);await firstHome.p.locator('#h2oStartup').waitFor({state:'hidden'});
 await firstHome.p.getByText('Brauchst du Hilfe?',{exact:true}).click();await firstHome.p.getByRole('button',{name:'Mit Einladung erstmals einrichten',exact:true}).click();
 assert.equal(await firstHome.p.locator('#h2o-onboarding-title').innerText(),'Zugang einrichten');await firstHome.p.locator('#identity-register').click();await firstHome.p.locator('#identity-message').filter({hasText:'Passkey gespeichert'}).waitFor();await firstHome.p.locator('#identity-login').click();await firstHome.p.getByRole('button',{name:'Weiter',exact:true}).click();await firstHome.p.getByRole('button',{name:'H₂O öffnen',exact:true}).click();await firstHome.p.locator('#portal-section').waitFor({state:'visible'});await firstHome.c.close();
 assert.deepEqual(errors,[]);console.log('PASS: Safari enrollment -> separate Home app storage, Safari-less UA, existing-passkey login with clean/consumed/invalid setup URLs, no re-enrollment, reload keeps the session, fresh invitations still allow first setup');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
