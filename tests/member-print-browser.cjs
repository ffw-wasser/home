// Browser- und Druckansichtsprüfung ausschließlich mit synthetischen Mitgliederdaten.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
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
    {id:'person-a',firstName:'Anna',lastName:'Muster',roles:['GF'],machinistVehicles:['LF'],driverLicenseCheckedOn:'2026-08-01',
     careerEntries:[{type:'course',title:'Truppführer',date:'2024-03-01',notes:''},{type:'rank',title:'Oberfeuerwehrfrau',date:'2023-01-01',notes:''}],
     whatsappPhone:'+49123456',drinkPin:'9876',g263ValidUntil:'2028-02'},
    {id:'person-b',firstName:'Ben',lastName:'Beispiel',roles:[],careerEntries:[{type:'award',title:'Leistungsabzeichen Silber',date:'2024-05-01',notes:''}]},
    {id:'guest-c',firstName:'Cora',lastName:'Fitness',fitnessTrainer:true,roles:[],careerEntries:[{type:'course',title:'Fortbildung',date:'2024-03-01',notes:''}]}
   ];
   renderAdmin();showView('settingsMembersView');MemberRecordsPrint.updateForm();
  });
  const scope=page.locator('#memberPrintScope'),year=page.locator('#memberPrintYear'),button=page.locator('[data-print-submit]');
  await page.locator('[data-record-choice="person-a"]').click();
  await scope.selectOption('selected');
  assert.match(await page.locator('#memberPrintResult').innerText(),/1 Person/);
  await button.click();
  assert.equal(await page.evaluate(()=>window.printCalls),1);
  assert.equal(await page.locator('#memberPrintRoot .member-print-person').count(),1);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Anna Muster/);
  const html=await page.locator('#memberPrintRoot').innerHTML();
  for(const value of ['+49123456','9876','2028-02'])assert.ok(!html.includes(value),'Vertrauliche Daten nicht drucken: '+value);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#memberPrintRoot').evaluate(el=>getComputedStyle(el).display),'block');
  assert.equal(await page.locator('#appStartup').evaluate(el=>getComputedStyle(el).display),'none');
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('#memberPrintRoot').innerHTML(),'');
  await scope.selectOption('all');assert.match(await page.locator('#memberPrintResult').innerText(),/2 Personen/);
  await button.click();
  assert.equal(await page.locator('#memberPrintRoot .member-print-person').count(),2);
  assert.equal(await page.evaluate(()=>window.printCalls),2);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await scope.selectOption('year');await year.fill('2024');
  assert.match(await page.locator('#memberPrintResult').innerText(),/1 Person/);
  await button.click();
  assert.equal(await page.evaluate(()=>window.printCalls),3);
  assert.equal(await page.locator('#memberPrintRoot .member-print-person').count(),1);
  assert.match(await page.locator('#memberPrintRoot').innerText(),/Im Jahr 2024 erreicht/);
  assert.doesNotMatch(await page.locator('#memberPrintRoot').innerText(),/Ben Beispiel|Cora Fitness/);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await year.fill('2022');assert.equal(await button.isDisabled(),true);
  await year.fill('2024');
  await page.locator('[data-record-choice="person-a"]').click();
  await page.locator('[data-record-tab="master"]').click();
  await page.locator('[data-member-id="person-a"] [data-first-name]').fill('Anna geändert');
  await button.click();
  assert.equal(await page.evaluate(()=>window.printCalls),3,'Offene Änderungen verhindern veralteten Ausdruck');
  assert.deepEqual(errors,[]);
  console.log('Personalakten-Druck: Einzeln, alle, Jahresfilter, PDF-Druckansicht, Privatsphäre und Entwurfssperre OK.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
