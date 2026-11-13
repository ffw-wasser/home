// Actual browser transport + actual Worker/D1/R2 fixture. No production data or traffic.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),JSZip=require('../js/vendor/jszip.min.js');
const {fixture}=require('./helpers/storage-fixture.cjs'),{activate}=require('../scripts/activate-cloudflare-storage.cjs');
const root=path.resolve(__dirname,'..'),ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
(async()=>{
 const cleanup=[],f=fixture({after:fn=>cleanup.push(fn)}),directory=await fsp.mkdtemp(path.join(os.tmpdir(),'h2o-browser-cloud-'));cleanup.push(()=>fsp.rm(directory,{recursive:true,force:true}));
 let browser;
 try{
  const source=path.join(directory,'source');await fsp.mkdir(path.join(source,'Getraenke'),{recursive:true});await fsp.mkdir(path.join(source,'Berichte/Terminpakete'),{recursive:true});
  await fsp.writeFile(path.join(source,'Getraenke/push-verbindung.json'),JSON.stringify({origin:ORIGIN,token:f.env.ADMIN_TOKEN}));await fsp.writeFile(path.join(source,'Getraenke/konten-zentrale.json'),JSON.stringify({source:'drive-fixture:root-fixture',state:'active'}));
  await fsp.writeFile(path.join(source,'feuerwehr-wasser-daten.json'),JSON.stringify({schemaVersion:3,members:[{id:'synthetic',firstName:'Anna',lastName:'Beispiel',roles:[]}],entries:[],updatedAt:'2026-11-13T10:00:00Z',careerCatalog:[],roleTargets:{},functionEntryEnabled:true,csvArchive:[]}));
  const zip=new JSZip();zip.file('bericht.csv','Datum;Uhrzeit;Name;Terminart;Status;Funktion / Status;Thema\r\n2026-10-10;18:00;Beispiel, Anna;Sonderprobe;Anwesend;;Technische Hilfe');zip.file('bericht.pdf','%PDF-synthetic-original');zip.file('paket-info.json',JSON.stringify({format:'FFW-Wasser-Terminpaket',type:'Probe',csvName:'bericht.csv',pdfName:'bericht.pdf',createdAt:'2026-11-13T10:00:00Z'}));
  await fsp.writeFile(path.join(source,'Berichte/Terminpakete/original.zip'),await zip.generateAsync({type:'nodebuffer'}));
  let url;const activated=await activate(source,{fetcher:f.fetcher,checkpointRoot:path.join(directory,'copies'),log:()=>{},openBrowser:async value=>url=value});
  browser=await(process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});const page=await browser.newPage({viewport:{width:1024,height:900},serviceWorkers:'block'}),errors=[],requests=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());requests.push(u.href);
   if(u.origin===ORIGIN){const response=await f.fetcher(request.url(),{method:request.method(),headers:request.headers(),...(request.method()==='POST'?{body:request.postDataBuffer()}:{})});return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});}
   if(u.origin==='https://ffw-wasser.github.io'){const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});}
   return route.abort();
  });
  await page.goto(url);await page.locator('#appStartup').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>location.hash),'','credential fragment removed');
  assert.equal(await page.evaluate(()=>members[0].firstName),'Anna');assert.equal(await page.evaluate(()=>oneDriveAdministrationReady()),true);assert.equal(await page.evaluate(()=>csvArchive[0].originalReportDate),'2026-10-10');assert.equal(await page.evaluate(()=>getAppStorageState().kind),'cloud');
  assert.equal(requests.some(value=>/microsoftonline|graph\.microsoft/.test(value)),false,'no Microsoft requests');assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('a'.repeat(64))),false,'root credential never reaches browser storage');
  await page.evaluate(async()=>{members[0].firstName='Geändert';saveMembers();await syncOneDrive();});
  const row=f.db.prepare('SELECT * FROM storage_states WHERE run=?').get(activated.run),saved=await f.context.CentralLedger.open(f.env,row.payload,'storage-state/v1:'+activated.run);assert.equal(saved.members[0].firstName,'Geändert');
  await page.evaluate(async()=>{await oneDriveUploadTerminPackage(new Blob(['synthetic report'],{type:'application/zip'}),'2026-11-13_Probe_abcdefg.zip');});
  assert.ok(f.db.prepare('SELECT id FROM storage_files WHERE id=?').get(require('./helpers/storage-fixture.cjs').sha('Berichte/Terminpakete/2026-11-13_Probe_abcdefg.zip')));
  // Actual QR creation and local PDF do not depend on Microsoft or the root key.
  await page.evaluate(()=>{adminUnlocked=true;resetAdminTimeout();showView('settingsPushView');});await page.locator('#pushSetupStatus').filter({hasText:'Verbunden'}).waitFor();await page.locator('#cloudPairDevice').click();await page.locator('#cloudPairQR canvas').waitFor();await page.locator('#cloudPairDialog button[aria-label="Schließen"]').click();
  const pdf=await page.evaluate(async()=>{const blob=await operationPdfBlob({date:'2026-11-13',members:['Beispiel, Anna'],assignments:{'Beispiel, Anna':'Reserve Gerätehaus'},type:'Gerätehausbesetzung',stationOnly:true,times:{},situation:'Synthetische Lage',actions:'Vollständig lokal erstellt.'});return {size:blob.size,pages:(await PDFLib.PDFDocument.load(await blob.arrayBuffer())).getPageCount()};});assert.ok(pdf.size>1000);assert.equal(pdf.pages,2);
  if(process.env.CAPTURE_CLOUD_CONNECTION_HELP){const out=path.join(root,'assets/help/guide'),sizes=JSON.parse(fs.readFileSync(path.join(out,'screens.json'),'utf8'));await page.locator('#cloudSyncButton').click();await page.locator('#cloudSyncDialog').screenshot({path:path.join(out,'geraetehaus-cloudflare.jpg'),type:'jpeg',quality:85,animations:'disabled'});const box=await page.locator('#cloudSyncDialog').boundingBox();sizes['geraetehaus-cloudflare']={width:Math.round(box.width),height:Math.round(box.height)};fs.writeFileSync(path.join(out,'screens.json'),JSON.stringify(sizes,null,2)+'\n');await page.locator('#cloudSyncClose').click();}
  const credential=await page.evaluate(()=>CloudStorage.config());await f.fetcher(ORIGIN+'/admin/storage-runtime/revoke',{method:'POST',headers:{Authorization:'Bearer '+f.env.ADMIN_TOKEN},body:JSON.stringify({deviceId:credential.deviceId})});
  assert.equal(await page.evaluate(async()=>{try{await CloudStorage.readState();return false;}catch(error){return error.status===401;}}),true);assert.equal(await page.evaluate(()=>oneDriveAdministrationReady()),false);await page.locator('#appStartup').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);console.log('Production Cloudflare browser: source/identities, actual sync, file upload, pairing, local PDF and immediate revocation verified.');
 }finally{if(browser)await browser.close();for(const fn of cleanup.reverse())await fn();}
})().catch(error=>{console.error(error);process.exitCode=1;});
