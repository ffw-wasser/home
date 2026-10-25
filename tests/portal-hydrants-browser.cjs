// Synthetic sessions and PDF; no live member or plan data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium}=require('playwright'),{fixture}=require('./helpers/portal-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const f=await fixture(),person=f.people[0],session=f.sql.prepare('SELECT * FROM portal_identity_sessions WHERE alias=?').get(person.alias);
 // The fixture session tokens are deliberately inaccessible; create a browser-only synthetic session.
 const token='test-hydrants-browser-'.padEnd(43,'x');f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),person.alias,person.revision,session.credential,Date.now(),Date.now()+86400000);
 const {PDFDocument,rgb}=require('../js/vendor/pdf-lib.min.js'),doc=await PDFDocument.create(),sheet=doc.addPage([1900,2300]);sheet.drawRectangle({x:100,y:100,width:1500,height:1800,color:rgb(.6,.8,1)});sheet.drawLine({start:{x:0,y:0},end:{x:1900,y:2300},thickness:4,color:rgb(1,0,0)});
 const bytes=process.env.HYDRANTS_PDF_TEST?fs.readFileSync(process.env.HYDRANTS_PDF_TEST):Buffer.from(await doc.save()),sha256=createHash('sha256').update(bytes).digest('hex');
 const plan=(await f.call('hydrants/begin',{size:bytes.length,sha256},null,true)).value.plan;
 for(let part=0;part<plan.parts;part++)await f.call('hydrants/chunk',{version:plan.version,part,bytes:bytes.subarray(part*plan.chunkSize,(part+1)*plan.chunkSize).toString('base64')},null,true);await f.call('hydrants/publish',{version:plan.version},null,true);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,768]){
   const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,serviceWorkers:'block'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(session=>localStorage.setItem('h2o-portal-identity-v1',JSON.stringify(session)),{scope:'portal',alias:person.alias,revision:person.revision,token,expiresAt:Date.now()+86400000});
   await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname.endsWith('workers.dev')){const res=await f.c.worker.fetch(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),f.env);return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()});}
    if(u.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});}
    return route.abort();
   });
   await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('#portal-section').hidden);
   await page.evaluate(()=>DeckelMobile.jump('deckel-more'));await page.locator('[data-more-target="more-hydrants"]').click();
   await page.waitForFunction(()=>!document.querySelector('#hydrants-open').hidden);
   assert.match(await page.locator('#hydrants-open').getAttribute('href'),/^blob:/);
   await page.waitForFunction(()=>document.querySelector('#hydrants-map canvas'));
   assert.equal(await page.locator('#hydrants-map').isVisible(),true);
   await page.locator('#hydrants-map').scrollIntoViewIfNeeded();
   const rect=await page.locator('#hydrants-map').boundingBox(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2,cdp=await page.context().newCDPSession(page);
   const touch=(type,half)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:cx-half,y:cy,id:1},{x:cx+half,y:cy,id:2}]});
   await touch('touchStart',15);await touch('touchMove',35);await touch('touchMove',100);await touch('touchEnd',0);
   await page.waitForFunction(()=>Number(document.querySelector('#hydrants-map').dataset.zoom)>4);
   await page.waitForFunction(()=>document.querySelector('#hydrants-map')._planRendered?.scale>0);
   const panBefore=await page.locator('#hydrants-map').evaluate(h=>h._planRendered.x);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+35,y:cy+20,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(before=>document.querySelector('#hydrants-map')._planRendered.x!==before,panBefore);
   if(process.env.HYDRANTS_PDF_TEST&&width===390)await page.locator('#hydrants-map').screenshot({path:'/tmp/plan-pinch-zoom.png'});
   assert.equal(await page.locator('#portal-page-more-hydrants').isVisible(),true,'pinch must not change portal page');
   const canvasSize=await page.locator('#hydrants-map canvas').evaluate(c=>[c.width,c.height]);assert.ok(canvasSize[0]<=rect.width*2+2&&canvasSize[1]<=rect.height*2+2,'zoom keeps canvas bounded by screen size');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#more-hydrants [data-more-target="deckel-more"]').click();
   assert.equal(await page.locator('#hydrants-open').getAttribute('href'),null);
   assert.equal(await page.locator('#hydrants-map canvas').count(),0);
   await page.evaluate(()=>DeckelMobile.jump('more-hydrants'));await page.waitForFunction(()=>!document.querySelector('#hydrants-open').hidden);
   await page.evaluate(()=>H2OPortal.clear());assert.equal(await page.locator('#hydrants-frame').getAttribute('src'),null);
   assert.deepEqual(errors,[]);await page.close();
  }
  const tablet=await browser.newPage({viewport:{width:1024,height:768}});
  const app=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=app.indexOf('<section class="water-info hydrants-plan-card" aria-labelledby="hydrants-admin-title">'),end=app.indexOf('</section>',start)+10;
  assert.ok(start>=0);await tablet.route('https://ffw-wasser.github.io/home/**',route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.endsWith('/tablet-test.html'))return route.fulfill({body:app.slice(start,end),contentType:'text/html'});return route.fulfill({path:path.join(root,pathname.replace(/^\/home\//,'')),contentType:'text/javascript'});});await tablet.goto('https://ffw-wasser.github.io/home/tablet-test.html');await tablet.addStyleTag({path:path.join(root,'css/features/portal.css')});
  await tablet.evaluate(data=>{window.oneDriveReadHydrants=async()=>new Uint8Array(data);},Array.from(bytes));
  await tablet.addScriptTag({path:path.join(root,'js/features/portal/plan-zoom.js')});
  await tablet.addScriptTag({path:path.join(root,'js/features/portal/portal-hydrants.js')});
  await tablet.locator('#hydrants-ipad-open').click();await tablet.waitForFunction(()=>document.querySelector('#hydrants-ipad-dialog').open);
  await tablet.waitForFunction(()=>document.querySelector('#hydrants-ipad-map canvas'));
  assert.equal(await tablet.locator('#hydrants-ipad-map').isVisible(),true);
  await tablet.locator('#hydrants-ipad-close').click();assert.equal(await tablet.locator('#hydrants-ipad-frame').getAttribute('src'),null);
  await tablet.locator('#hydrants-ipad-open').click();await tablet.waitForFunction(()=>document.querySelector('#hydrants-ipad-dialog').open);await tablet.evaluate(()=>PortalHydrantsView.clearIpad());
  assert.equal(await tablet.locator('#hydrants-ipad-dialog').evaluate(e=>e.open),false);assert.equal(await tablet.locator('#hydrants-ipad-large').getAttribute('href'),null);
  await tablet.close();
  console.log('Hydrantenplan: mobile/tablet navigation, protected load, overflow and logout cleanup passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
