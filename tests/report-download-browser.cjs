// Real report panel and ZIP implementation. Synthetic storage; all remote traffic blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),JSZip=require('../js/vendor/jszip.min.js');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await(process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});try{
 const page=await browser.newPage({acceptDownloads:true,serviceWorkers:'block',viewport:{width:768,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/index.html');
 await page.evaluate(async()=>{
  AppStartup.update({ready:true});AppStartup.update=()=>{};adminUnlocked=true;resetAdminTimeout();oneDriveAdministrationReady=()=>true;
  const zip=new JSZip();zip.file('probe.csv','Datum;Name\r\n2025-12-31;Anna Beispiel');zip.file('probe.pdf','%PDF-Beispiel');zip.file('anlagen/notiz.txt','Anlage vollständig');zip.file('paket-info.json',JSON.stringify({csvName:'probe.csv',pdfName:'probe.pdf',createdAt:'2026-02-01',correctedAt:'2026-03-01'}));
  const files=[{path:'Berichte/Terminpakete/alt.zip',version:2,bytes:await zip.generateAsync({type:'uint8array'})},{path:'Berichte/CSV/2026-01-01_Probe.csv',version:1,bytes:new TextEncoder().encode('Datum;Name\n2026-01-01;Ben Beispiel')},{path:'Berichte/PDF/ohne-datum.pdf',version:1,bytes:new TextEncoder().encode('%PDF-Beispiel')}];
  window.CloudStorage={connected:true,sourceHash:'synthetic-source',deviceId:'synthetic-device',walk:async()=>files,readFile:async(path,version)=>files.find(file=>file.path===path&&file.version===version).bytes};
  showView('settingsFilesView');
 });
 const panel=page.locator('#reportZipDownload'),year=panel.locator('#reportZipYear'),month=panel.locator('#reportZipMonth'),save=panel.locator('#reportZipSave'),status=panel.locator('#reportZipStatus');
 await panel.waitFor({state:'visible'});assert.equal(await month.isDisabled(),true);assert.equal(await save.isDisabled(),true);
 await panel.locator('#reportZipRefresh').click();await status.getByText(/3 Berichtsdateien geladen/).waitFor();assert.match(await status.innerText(),/1 ohne Termindatum/);
 assert.deepEqual(await year.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),['','2026','2025']);
 await year.selectOption('2025');assert.equal(await month.isEnabled(),true);await month.selectOption('12');
 if(process.env.CAPTURE_REPORT_DOWNLOAD_HELP){const out=path.join(root,'assets/help/guide'),sizes=JSON.parse(fs.readFileSync(path.join(out,'screens.json'),'utf8'));await panel.screenshot({path:path.join(out,'geraetehaus-berichte-download.jpg'),type:'jpeg',quality:85,animations:'disabled'});const box=await panel.boundingBox();sizes['geraetehaus-berichte-download']={width:Math.round(box.width),height:Math.round(box.height)};fs.writeFileSync(path.join(out,'screens.json'),JSON.stringify(sizes,null,2)+'\n');}
 async function download(expected,count){
  const event=page.waitForEvent('download');await save.click();const item=await event;assert.equal(item.suggestedFilename(),expected);
  const bytes=fs.readFileSync(await item.path()),zip=await JSZip.loadAsync(bytes),originals=Object.values(zip.files).filter(entry=>!entry.dir&&entry.name.startsWith('Originale/'));
  assert.equal(originals.length,count);return zip;
 }
 const selected=await download('H2O-Berichte-2025-12.zip',1);assert.ok(selected.file('PDF/Berichte/Terminpakete/alt.zip/probe.pdf'));
 await month.selectOption('01');assert.equal(await save.isDisabled(),true);await month.selectOption('');await download('H2O-Berichte-2025.zip',1);
 await year.selectOption('');assert.equal(await month.isDisabled(),true);assert.equal(await month.inputValue(),'');await download('H2O-Berichte-Komplett.zip',3);
 for(const width of [320,390,768,1280])for(const scale of [100,200]){await page.setViewportSize({width,height:1000});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);assert.equal(await panel.evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'panel overflow '+width+'/'+scale);}
 await page.evaluate(()=>{CloudStorage.connected=false;window.dispatchEvent(new Event('h2o-storage-lock'));});assert.equal(await save.isDisabled(),true);assert.equal(await year.locator('option').count(),1);assert.match(await status.innerText(),/abgemeldet/);
 await panel.locator('#reportZipRefresh').click();await status.getByText(/zuerst dieses Verwaltungsgerät/).waitFor();assert.equal(await save.isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('ZIP-Download: Jahr, Monat, Gesamtexport, Originale, Gerätesperre und mobile Darstellung geprüft.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
