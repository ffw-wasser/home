// Synthetic camera frames and tickets; no remote services or real camera access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await(process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
 await page.addInitScript(()=>{Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone) H2ONative/1 iOS'});});
 await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
 const wizard=page.locator('#h2o-onboarding');
 assert.equal(await wizard.getByRole('button',{name:'Erstmals einrichten',exact:true}).isVisible(),true,'first enrollment is directly on normal login screen');
 await wizard.getByRole('button',{name:'Erstmals einrichten',exact:true}).click();
 await page.evaluate(()=>{
  window.scanTest={requests:0,stops:0,qr:'',deny:false,delay:false};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async constraints=>{scanTest.requests++;scanTest.constraints=constraints;if(scanTest.deny)throw Error('denied');if(scanTest.delay)await new Promise(resolve=>scanTest.resolve=resolve);return {getTracks:()=>[{stop(){scanTest.stops++;}}]};}}});
  Object.defineProperties(HTMLVideoElement.prototype,{videoWidth:{get:()=>640},videoHeight:{get:()=>480},readyState:{get:()=>4},srcObject:{set(){}}});HTMLVideoElement.prototype.play=async()=>{};
  HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)})});
  window.jsQR=()=>scanTest.qr?{data:scanTest.qr}:null;
 });
 assert.equal(await page.evaluate(()=>scanTest.requests),0,'camera starts only after button press');
 const scanner=page.locator('#identity-release-scanner');await page.locator('#identity-scan-release').click();await scanner.getByText('Persönlichen QR-Code der Verwaltung in die Kamera halten.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>scanTest.constraints),{audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}});
 await page.evaluate(()=>scanTest.qr='https://foreign.invalid/home/deckel.html#setup='+'a'.repeat(43));await scanner.getByText(/Das ist keine persönliche/).waitFor();assert.equal(await page.locator('#identity-code').inputValue(),'');
 await page.evaluate(()=>scanTest.qr='https://ffw-wasser.github.io/home/deckel.html#setup='+'a'.repeat(43));await scanner.waitFor({state:'detached'});assert.equal(await page.locator('#identity-code').inputValue(),'a'.repeat(43));assert.equal(await page.evaluate(()=>scanTest.stops),1);
 assert.equal(await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes('a'.repeat(43))),false);
 await wizard.getByRole('button',{name:'Weiter',exact:true}).click();await wizard.getByRole('heading',{name:'Zugang einrichten',exact:true}).waitFor();await wizard.getByRole('button',{name:'Zurück',exact:true}).click();
 await page.evaluate(()=>{scanTest.qr='';scanTest.deny=true;});await page.locator('#identity-scan-release').click();await scanner.getByText(/Kamera nicht verfügbar/).waitFor();await scanner.getByRole('button',{name:'Zurück zur Eingabe'}).click();await page.locator('#identity-code').fill('b'.repeat(43));
 await page.evaluate(()=>{scanTest.deny=false;scanTest.delay=true;});await page.locator('#identity-scan-release').click();await scanner.getByRole('button',{name:'Abbrechen'}).click();await page.evaluate(()=>scanTest.resolve());await page.waitForFunction(()=>scanTest.stops===2);assert.equal(await page.locator('#identity-code').inputValue(),'b'.repeat(43));
 await page.evaluate(()=>{scanTest.delay=false;});await page.locator('#identity-scan-release').click();await scanner.getByText('Persönlichen QR-Code der Verwaltung in die Kamera halten.',{exact:true}).waitFor();await page.keyboard.press('Escape');await scanner.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>scanTest.stops),3);
 assert.deepEqual(errors,[]);console.log('PASS release scan: user gesture, rear camera only, trusted QR, same manual field, no secret persistence, permission denial, cancellation and delayed stream cleanup');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
