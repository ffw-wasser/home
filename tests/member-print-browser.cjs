// Browser- und Druckansichtsprüfung ausschließlich mit synthetischen Mitgliederdaten.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),PDFLib=require('../js/vendor/pdf-lib.min.js');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await (process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true,...(process.env.BROWSER_ENGINE==='webkit'?{}:{args:['--no-sandbox']})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin==='https://ffw-wasser.github.io'){
    const file=path.resolve(root,url.pathname.replace(/^\/home\//,''));
    if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   }
   return route.abort();
  });
  await page.goto('https://ffw-wasser.github.io/home/index.html');
  await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});
  await page.locator('#appStartup').waitFor({state:'hidden'});
  await page.evaluate(()=>{
   window.requireAdmin=()=>true;oneDriveAdministrationReady=()=>true;adminUnlocked=true;resetAdminTimeout();
   window.Drinks.loadPinStatus=()=>{};
   window.printCalls=0;window.print=()=>window.printCalls++;
   members=[
    {id:'person-a',firstName:'Anna',lastName:'Muster',roles:['GF'],machinistVehicles:['LF'],driverLicenseCheckedOn:'2026-08-01',joinedOn:'2001-03-17',
     careerEntries:[{type:'course',title:'Truppführer',date:'2024-03-01',notes:''},{type:'rank',title:'Oberfeuerwehrfrau',date:'2023-01-01',notes:''},{type:'award',title:'Feuerwehr-Leistungsabzeichen Gold',date:'2024-06-01'},{type:'award',title:'Leistungsspange der Deutschen Jugendfeuerwehr',date:'2020-05-01'},{type:'award',title:'Feuerwehr-Ehrenzeichen in Bronze',date:'2024-05-17'}],
     whatsappPhone:'+49123456',drinkPin:'9876',g263ValidUntil:'2028-02'},
    {id:'person-b',firstName:'Ben',lastName:'Beispiel',roles:[],careerEntries:[{type:'award',title:'Leistungsabzeichen Silber',date:'2024-05-01',notes:''}]},
    {id:'guest-c',firstName:'Cora',lastName:'Fitness',fitnessTrainer:true,roles:[],careerEntries:[{type:'course',title:'Fortbildung',date:'2024-03-01',notes:''}]}
   ];
   // Exakt die bereits abgeschlossene Berichts-Historie, die die Statistik auswertet.
   window.statisticsArchiveData=()=>[
    {date:'2024-01-01',item:{id:'drill-1',sessionType:'Probe'},rows:[{name:'Muster, Anna',sessionType:'Probe',status:'Anwesend'}]},
    {date:'2024-02-01',item:{id:'drill-2',sessionType:'Sonderprobe'},rows:[{name:'Anna Muster',sessionType:'Sonderprobe',status:'Entschuldigt'}]},
    {date:'2024-03-01',item:{id:'operation-1',sessionType:'Einsatz'},operation:true,rows:[{name:'Muster, Anna',sessionType:'Einsatz',status:'Anwesend'}]},
    {date:'2024-04-01',item:{id:'operation-2',sessionType:'Einsatz'},operation:true,rows:[{name:'Beispiel, Ben',sessionType:'Einsatz',status:'Anwesend'}]}
   ];
   renderAdmin();showView('settingsMembersView');
  });
  const scope=page.locator('#memberPrintScope'),year=page.locator('#memberPrintYear'),button=page.locator('[data-print-submit]');
  assert.equal(await button.isDisabled(),false,'Bereits die automatisch gewählte Akte ist druckbar');
  await page.locator('[data-record-choice="person-a"]').click();
  const honors=page.locator('article[data-member-id="person-a"] [data-record-honors]');
  assert.equal(await honors.locator('img').count(),4);
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-record-honors] img')].every(img=>img.complete&&img.naturalWidth>0));
  for(const width of [390,768,1100]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await honors.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'Abzeichen passen bei '+width+'px');
   if(width===1100&&process.env.CAPTURE_MEMBER_HONORS_HELP){fs.mkdirSync(path.join(root,'qa/member-honors'),{recursive:true});await page.locator('.person-record-main').screenshot({path:path.join(root,'qa/member-honors/overview.png')});}
  }
  await page.setViewportSize({width:390,height:844});
  await scope.selectOption('selected');
  assert.match(await page.locator('#memberPrintResult').innerText(),/1 Person/);
  await button.click();
  const preview=page.locator('#memberPrintRoot');
  assert.equal(await preview.isVisible(),true,'Sichtbare Vorschau auch ohne Druckdialog');
  assert.equal(await page.evaluate(()=>window.printCalls),0,'PDF-Erstellung benötigt keinen nativen Druckdialog');
  await preview.locator('[data-member-pdf-save]').waitFor({state:'visible'});
  const [download]=await Promise.all([page.waitForEvent('download'),preview.locator('[data-member-pdf-save]').click()]);
  const bytes=fs.readFileSync(await download.path()),doc=await PDFLib.PDFDocument.load(bytes);
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(doc.getPageCount()>0);
  const raw=doc.getPages().flatMap(p=>p.node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1'))).join(' ').replace(/<([0-9A-F]+)>/g,(_,hex)=>Buffer.from(hex,'hex').toString('latin1'));
  for(const value of ['Anna Muster','17.03.2001','Ehrungen','Proben & Unterricht','Feuerwehr-Ehrenzeichen'])assert.ok(raw.includes(value),value);
  for(const value of ['+49123456','9876','2028-02'])assert.ok(!raw.includes(value),'Private Daten auch in echter PDF ausgeschlossen');
  await preview.locator('[data-member-native-print]').click();
  assert.equal(await page.evaluate(()=>window.printCalls),1);
  assert.equal(await preview.isVisible(),true,'Vorschau bleibt bei lautlosem Druckaufruf geöffnet');
  assert.equal(await preview.locator('.member-print-person').count(),1);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Anna Muster/);
  assert.equal(await page.locator('#memberPrintRoot .member-print-ring').count(),2,'je Person zwei Kreisdiagramme');
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Proben & Unterricht/);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Nicht als Teilnehmer erfasst/);
  assert.equal(await page.locator('#memberPrintRoot .member-print-ring text').first().textContent(),'50 %');
  assert.equal(await page.locator('#memberPrintRoot .member-insignia').count(),4,'Erworbene Abzeichen werden mitgedruckt');
  const html=await page.locator('#memberPrintRoot').innerHTML();
  for(const value of ['+49123456','9876','2028-02'])assert.ok(!html.includes(value),'Vertrauliche Daten nicht drucken: '+value);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/17.03.2001/);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Ehrungen/);
  if(process.env.CAPTURE_MEMBER_HONORS_HELP){await preview.screenshot({path:path.join(root,'qa/member-honors/visible-preview.png')});}
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#memberPrintRoot').evaluate(el=>getComputedStyle(el).display),'block');
  assert.equal(await preview.locator('.member-print-toolbar').evaluate(el=>getComputedStyle(el).display),'none');
  assert.equal(await page.locator('#appStartup').evaluate(el=>getComputedStyle(el).display),'none');
  if(process.env.CAPTURE_MEMBER_HONORS_HELP){fs.mkdirSync(path.join(root,'qa/member-honors'),{recursive:true});await download.saveAs(path.join(root,'qa/member-honors/member-records.pdf'));await page.setViewportSize({width:794,height:1800});await page.screenshot({path:path.join(root,'qa/member-honors/print.png'),fullPage:true});await page.setViewportSize({width:390,height:844});}
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await preview.isVisible(),true,'Nach Drucken kann die PDF weiter geöffnet werden');
  await preview.locator('[data-member-preview-close]').click();
  await page.waitForFunction(()=>!document.getElementById('memberPrintRoot').innerHTML);
  await scope.selectOption('all');assert.match(await page.locator('#memberPrintResult').innerText(),/2 Personen/);
  await button.click();
  assert.equal(await page.locator('#memberPrintRoot .member-print-person').count(),2);
  await preview.locator('[data-member-pdf-save]').waitFor({state:'visible'});
  await preview.locator('[data-member-preview-close]').click();
  await page.waitForFunction(()=>!document.getElementById('memberPrintRoot').innerHTML);
  await scope.selectOption('year');await year.fill('2024');
  assert.match(await page.locator('#memberPrintResult').innerText(),/1 Person/);
  await button.click();
  await preview.locator('[data-member-pdf-save]').waitFor({state:'visible'});
  assert.equal(await page.locator('#memberPrintRoot .member-print-person').count(),1);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Im Jahr 2024 erreicht/);
  assert.doesNotMatch(await page.locator('#memberPrintRoot').innerText(),/Ben Beispiel|Cora Fitness/);
  await preview.locator('[data-member-preview-close]').click();
  await page.waitForFunction(()=>!document.getElementById('memberPrintRoot').innerHTML);
  await year.fill('2022');assert.equal(await button.isDisabled(),true);
  await year.fill('2024');
  await page.locator('[data-record-choice="person-a"]').click();
  await page.locator('[data-member-id="person-a"] [data-record-tab="master"]').click();
  await page.locator('[data-member-id="person-a"] [data-first-name]').fill('Anna geändert');
  await button.click();
  assert.equal(await preview.isVisible(),false,'Offene Änderungen verhindern einen veralteten Ausdruck');
  assert.match(await page.locator('#memberPrintResult').textContent(),/offene Mitgliederänderungen/);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#membersDiscardAll').click();
  await button.click();await preview.locator('[data-member-pdf-save]').waitFor({state:'visible'});
  const oldUrl=await preview.locator('[data-member-pdf-save]').getAttribute('href');
  await page.evaluate(()=>lockAdministration());
  await page.waitForFunction(()=>!document.getElementById('memberPrintRoot').innerHTML);
  assert.equal(await preview.isVisible(),false,'Sperren entfernt die geschützte Vorschau');
  assert.equal(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},oldUrl),true,'PDF-URL wird beim Sperren widerrufen');
  await page.evaluate(()=>{adminUnlocked=true;resetAdminTimeout();showView('settingsMembersView');});
  await scope.selectOption('selected');
  await page.evaluate(()=>{window.savedPdfCreate=StatisticsPdf.create;StatisticsPdf.create=async()=>{throw Error('Synthetischer PDF-Fehler');};});
  await button.click();
  await page.waitForFunction(()=>document.querySelector('[data-member-pdf-status]').textContent.includes('Synthetischer PDF-Fehler'));
  assert.equal(await preview.locator('[data-member-pdf-save]').isVisible(),false);
  await preview.locator('[data-member-preview-close]').click();
  await page.waitForFunction(()=>!document.getElementById('memberPrintRoot').innerHTML);
  await page.evaluate(()=>{StatisticsPdf.create=()=>new Promise(resolve=>window.finishMemberPdf=resolve);});
  await button.click();await preview.locator('[data-member-preview-close]').click();
  await page.waitForFunction(()=>!document.getElementById('memberPrintRoot').innerHTML);
  await page.evaluate(()=>window.finishMemberPdf(new Blob(['synthetic'],{type:'application/pdf'})));
  assert.equal(await preview.locator('[data-member-pdf-open]').count(),0,'Verspätete PDF-Erstellung öffnet keine verworfene Vorschau erneut');
  await page.evaluate(()=>{StatisticsPdf.create=window.savedPdfCreate;});
  assert.deepEqual(errors,[]);
  console.log('Personalakten-Druck: Einzeln, alle, Jahresfilter, PDF-Druckansicht, Privatsphäre und Entwurfssperre OK.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
