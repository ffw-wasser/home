// Synthetic sessions and PDF; no live member or plan data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture(),person=f.people[0],session=f.sql.prepare('SELECT * FROM portal_identity_sessions WHERE alias=?').get(person.alias);
 // The fixture session tokens are deliberately inaccessible; create a browser-only synthetic session.
 const token='test-hydrants-browser-'.padEnd(43,'x');f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),person.alias,person.revision,session.credential,Date.now(),Date.now()+86400000);
 const bytes=Buffer.from('%PDF-1.5\n% synthetic PDF test\n%%EOF'),sha256=createHash('sha256').update(bytes).digest('hex');
 const plan=(await f.call('hydrants/begin',{size:bytes.length,sha256},null,true)).value.plan;
 await f.call('hydrants/chunk',{version:plan.version,part:0,bytes:bytes.toString('base64')},null,true);await f.call('hydrants/publish',{version:plan.version},null,true);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,768]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(session=>localStorage.setItem('h2o-portal-identity-v1',JSON.stringify(session)),{scope:'portal',alias:person.alias,revision:person.revision,token,expiresAt:Date.now()+86400000});
   await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname.endsWith('workers.dev')){const res=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()});}
    if(u.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});}
    return route.abort();
   });
   await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.waitForFunction(()=>!document.querySelector('#portal-section').hidden);
   await page.evaluate(()=>DeckelMobile.jump('deckel-more'));await page.locator('[data-more-target="more-hydrants"]').click();
   await page.waitForFunction(()=>!document.querySelector('#hydrants-open').hidden);
   assert.match(await page.locator('#hydrants-open').getAttribute('href'),/^blob:/);
   assert.equal(await page.locator('#hydrants-frame').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#more-hydrants [data-more-target="deckel-more"]').click();
   assert.equal(await page.locator('#hydrants-open').getAttribute('href'),null);
   await page.evaluate(()=>DeckelMobile.jump('more-hydrants'));await page.waitForFunction(()=>!document.querySelector('#hydrants-open').hidden);
   await page.evaluate(()=>H2OPortal.clear());assert.equal(await page.locator('#hydrants-frame').getAttribute('src'),null);
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Hydrantenplan: mobile/tablet navigation, protected load, overflow and logout cleanup passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
