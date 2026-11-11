// Nur synthetische Mitglieder; reale Personenseite, Laufbahn, Speichern und mobile Darstellung.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='https://ffw-wasser.github.io'){
   const file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  }return route.abort();});
  await page.goto('https://ffw-wasser.github.io/home/index.html');
  await page.evaluate(()=>{AppStartup.update({ready:true});AppStartup.update=()=>{};});
  await page.locator('#appStartup').waitFor({state:'hidden'});
  await page.evaluate(()=>{
   window.requireAdmin=()=>true;oneDriveAdministrationReady=()=>true;adminUnlocked=true;resetAdminTimeout();
   window.Drinks.loadPinStatus=()=>{};
   members=[{id:'synthetic-a',firstName:'Ada',lastName:'Musterfrau',roles:[],breathingQualified:true,machinistVehicles:['LF'],driverLicenseCheckedOn:'2026-10-01'},
    {id:'synthetic-b',firstName:'Ben',lastName:'Beispiel',roles:[],breathingQualified:false,machinistVehicles:[]}];
   window.memberSaveCalls=0;window.memberSaved=[];saveMembers=()=>{window.memberSaveCalls++;window.memberSaved=structuredClone(members);};
   renderAdmin();showView('settingsMembersView');
  });
  const row=id=>page.locator('article.ux-member[data-member-id="synthetic-'+id+'"]');
  const choose=async(id,tab='master')=>{
    await page.locator('[data-record-choice="synthetic-'+id+'"]').click();
    await row(id).locator('[data-record-tab="'+tab+'"]').click();
  };
  await choose('a');await row('a').locator('[data-first-name]').fill('Ada geändert');
  await choose('b');await row('b').locator('[data-first-name]').fill('Ben geändert');
  await page.locator('#memberSearch').fill('Musterfrau');assert.equal(await row('b').isVisible(),false);
  assert.match(await page.locator('#membersSaveStatus').textContent(),/2 Mitglieder/);
  await page.locator('#membersSaveAll').click();
  assert.equal(await page.evaluate(()=>memberSaveCalls),1);
  assert.equal(await page.evaluate(()=>memberSaved.find(m=>m.id==='synthetic-a').firstName),'Ada geändert');
  assert.equal(await page.evaluate(()=>memberSaved.find(m=>m.id==='synthetic-b').firstName),'Ben geändert');
  await page.locator('#memberSearch').fill('');
  await choose('a');await row('a').locator('[data-first-name]').fill('Nicht übernehmen');
  // Eine ungültige Maschinistenberechtigung eines anderen Mitglieds verhindert den ganzen Stapel.
  await choose('b','roles');await row('b').locator('[data-first-name]').fill('Auch offen',{force:true}).catch(async()=>{
    await row('b').locator('[data-record-tab="master"]').click();
    await row('b').locator('[data-first-name]').fill('Auch offen');
    await row('b').locator('[data-record-tab="roles"]').click();
  });
  await row('b').locator('[data-machinist-vehicle="LF"]').check();
  await page.locator('#membersSaveAll').click();
  assert.equal(await page.evaluate(()=>memberSaveCalls),1);
  await choose('a');assert.equal(await row('a').locator('[data-first-name]').inputValue(),'Nicht übernehmen');
  await choose('b','roles');await row('b').locator('[data-driver-license-checked]').fill('2026-10-01');
  await page.locator('#membersSaveAll').click();assert.equal(await page.evaluate(()=>memberSaveCalls),2);
  // Personengebundene Laufbahneinträge über den neuen Editor anlegen und speichern.
  await choose('a','career');await row('a').locator('[data-career-add="course"]').click();
  const dialog=page.locator('#memberCareerDialog');
  await dialog.locator('[name="title"]').fill('Truppführer');
  await dialog.locator('[name="date"]').fill('2024-05-17');
  await dialog.locator('button[type="submit"]').click();
  assert.match(await row('a').locator('.career-entry-list').textContent(),/Truppführer/);
  await page.locator('#membersSaveAll').click();
  assert.equal(await page.evaluate(()=>memberSaveCalls),3);
  assert.equal(await page.evaluate(()=>memberSaved.find(m=>m.id==='synthetic-a').careerEntries[0].title),'Truppführer');
  // Fehlgeschlagene unabhängige PIN-Speicherung darf sonstige Stammdaten nicht zurücksetzen.
  await choose('a');await row('a').locator('[data-first-name]').fill('Mitglied gespeichert');
  await row('a').locator('[data-record-tab="account"]').click();await row('a').locator('[data-dr-new-pin]').fill('1234');
  await page.evaluate(()=>{window.Drinks.saveAdminPin=async button=>{const box=button.closest('.dr-pin-editor');box.querySelector('input').value='';delete box.dataset.dirty;box.querySelector('[data-dr-pin-status]').textContent='Synthetischer Verbindungsfehler';return false;};});
  await page.locator('#membersSaveAll').click();
  await page.waitForFunction(()=>document.querySelector('#membersSaveStatus').textContent.includes('PIN nicht gespeichert'));
  assert.equal(await page.evaluate(()=>memberSaveCalls),4);
  await row('a').locator('[data-record-tab="master"]').click();
  await row('a').locator('[data-first-name]').fill('Entwurf verwerfen');
  page.once('dialog',d=>d.accept());await page.locator('#membersDiscardAll').click();
  await choose('a');assert.equal(await row('a').locator('[data-first-name]').inputValue(),'Mitglied gespeichert');
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});
   for(const tab of ['master','career','roles','evidence','account']){
    await row('a').locator('[data-record-tab="'+tab+'"]').click();
    const overflow=await row('a').evaluate(el=>[...el.querySelectorAll('input,fieldset,label,button')].filter(n=>n.getClientRects().length).filter(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(n=>n.outerHTML.slice(0,130)));
    assert.deepEqual(overflow,[],'Personenakte '+tab+' bei '+width+' px');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Keine Seitenüberbreite bei '+width);
   }
  }
  await page.setViewportSize({width:390,height:844});await row('a').screenshot({path:'/tmp/members-editor-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('Personenakten-Browsertest erfolgreich: Mehrfachspeicherung, Laufbahn, Validierung, PIN, Verwerfen und 320/390/768 px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
