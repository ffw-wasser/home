const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const {fixture}=require('./helpers/portal-fixture.cjs');
const {chromium}=require('playwright');
(async()=>{
 const f=await fixture({authenticated:false}),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:320,height:740}}),errors=[];
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname.endsWith('workers.dev')){
   const r=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);
   return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()});
  }
  if(u.origin==='https://ffw-wasser.github.io'){
   const file=path.join(root,u.pathname.replace(/^\/home\//,''));
   if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  }
  return route.abort();
 });
 const client=await page.context().newCDPSession(page);await client.send('WebAuthn.enable');await client.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 const event=(await f.call('list',{},null,true)).value.events[0];
 const person=f.people[0];
 const ticket=(await f.call('identity-ticket',{alias:person.alias,revision:person.revision},null,true)).value;
 await page.goto('https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/test&a='+person.alias+'&k='+person.key);
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Passkey anmelden'));
 assert.equal(await page.locator('#identity-panel').evaluate(e=>e.parentElement.id),'identity-entry');
 assert.equal(await page.locator('#deckel-nav').isVisible(),false);
 assert.equal(await page.locator('#account').isVisible(),false);
 assert.equal(await page.evaluate(()=>location.hash),'');
 await page.goto('about:blank');
 console.log('Browser: onboarding');
 await page.goto('https://ffw-wasser.github.io/home/deckel.html#setup='+ticket.code);
 assert.equal(await page.locator('#identity-code').inputValue(),ticket.code);assert.equal(await page.evaluate(()=>location.hash),'');
 console.log('Browser: registering');
 await page.locator('#identity-register').click();
 await page.waitForFunction(()=>document.querySelector('#identity-message').textContent.includes('Passkey gespeichert'));
 console.log('Browser: signing in');
 await page.locator('#identity-login').click();
 await page.waitForFunction(()=>document.querySelector('#identity-state').textContent==='Mit Passkey angemeldet');
 await page.waitForFunction(()=>!document.querySelector('#portal-section').hidden);
 assert.equal(await page.evaluate(()=>location.hash),'');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/h2o-portal-identity.png'});
 console.log('Browser: WhatsApp');
 await page.goto('https://ffw-wasser.github.io/home/termin.html?event='+event.id);
 await page.locator('#chosen').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Bin dabei',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Rückmeldung gespeichert'));
 const centralSession=await page.evaluate(()=>H2OIdentity.session());
 const list=await page.evaluate(async s=>(await fetch('https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev/portal/list',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({alias:s.alias,revision:s.revision})})).json(),centralSession);assert.equal(list.events[0].status,'yes');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();await page.locator('#chosen').waitFor({state:'visible'});
 await page.evaluate(()=>localStorage.removeItem('h2o-portal-identity-v1'));await page.reload();await page.locator('#pairing').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Mit Passkey anmelden',exact:true}).click();await page.locator('#chosen').waitFor({state:'visible'});
 assert.equal(await page.locator('#event-title').textContent(),event.title);
 await page.getByRole('button',{name:'Entschuldigt',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Rückmeldung gespeichert'));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_passkeys').get().n,1);

 await page.goto('https://ffw-wasser.github.io/home/deckel.html');
 await page.waitForFunction(()=>!document.querySelector('#portal-section').hidden);
 await page.evaluate(()=>DeckelMobile.jump('deckel-more'));
 await page.locator('[data-more-target="more-security"]').click();
 await page.locator('#identity-account').waitFor({state:'visible'});
 assert.equal(await page.locator('#identity-entry').textContent(),'');
 assert.equal(await page.locator('#identity-panel').evaluate(e=>e.parentElement.id),'identity-security-slot');
 await page.locator('#identity-logout').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Passkey anmelden'));
 assert.equal(await page.locator('#identity-panel').evaluate(e=>e.parentElement.id),'identity-entry');
 assert.equal(await page.locator('#deckel-nav').isVisible(),false);
 assert.equal(await page.locator('#account').isVisible(),false);
 await f.call('identity-ticket',{alias:person.alias,revision:person.revision,reset:true},null,true);await page.goto('https://ffw-wasser.github.io/home/termin.html?event='+event.id);await page.locator('#pairing').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('Browser E2E OK: central onboarding, portal session, WhatsApp with/without existing session, reply and later correction, reload, admin recovery; no overflow at 320px.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
