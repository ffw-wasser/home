const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const {fixture}=require('./helpers/portal-fixture.cjs');
const {chromium}=require('playwright');
(async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:320,height:740}}),errors=[];
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
 const event=(await f.call('list')).value.events[0];
 await page.goto('https://ffw-wasser.github.io/home/termin.html?event='+event.id);
 const options=(await f.call('passkey/register/options')).value;
 const response=await page.evaluate(async options=>H2OPasskeys.startRegistration({optionsJSON:options}),options.options);
 const verified=await f.call('passkey/register/verify',{id:options.id,response});assert.equal(verified.status,200,JSON.stringify(verified));
 await page.getByRole('button',{name:'Mit Passkey anmelden',exact:true}).click();
 await page.locator('#chosen').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Bin dabei',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Rückmeldung gespeichert'));
 assert.equal((await f.call('list')).value.events[0].status,'yes');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();await page.locator('#chosen').waitFor({state:'visible'});
 await f.call('browser/revoke');await page.reload();await page.locator('#pairing').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('Browser E2E OK: resident passkey registration, login, reply, reload, revocation; no overflow at 320px.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
