// Only synthetic members; real member form, validation and responsive styles.
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
  await page.goto('https://ffw-wasser.github.io/home/index.html');await page.evaluate(()=>AppStartup.update({ready:true}));await page.locator('#appStartup').waitFor({state:'hidden'});
  await page.evaluate(()=>{
   window.requireAdmin=()=>true;oneDriveAdministrationReady=()=>true;adminUnlocked=true;resetAdminTimeout();
   window.Drinks.loadPinStatus=()=>{};
   members=[{id:'synthetic-a',firstName:'Ada',lastName:'Musterfrau',roles:[],breathingQualified:true,machinistVehicles:['LF'],driverLicenseCheckedOn:'2026-10-01'},
    {id:'synthetic-b',firstName:'Ben',lastName:'Beispiel',roles:[],breathingQualified:false,machinistVehicles:[]}];
   window.memberSaveCalls=0;window.memberSaved=[];saveMembers=()=>{window.memberSaveCalls++;window.memberSaved=structuredClone(members);};
   renderAdmin();showView('settingsMembersView');
  });
  const row=id=>page.locator('[data-member-id="synthetic-'+id+'"]');
  await row('a').locator(':scope > summary').click();await row('a').locator('[data-first-name]').fill('Ada geändert');
  await row('b').locator(':scope > summary').click();await row('b').locator('[data-first-name]').fill('Ben geändert');
  await page.locator('#memberSearch').fill('Musterfrau');assert.equal(await row('b').isVisible(),false);
  assert.match(await page.locator('#membersSaveStatus').textContent(),/2 Mitglieder/);
  await page.locator('#membersSaveAll').click();
  assert.equal(await page.evaluate(()=>memberSaveCalls),1);assert.equal(await page.evaluate(()=>memberSaved.find(m=>m.id==='synthetic-a').firstName),'Ada geändert');assert.equal(await page.evaluate(()=>memberSaved.find(m=>m.id==='synthetic-b').firstName),'Ben geändert');
  await page.locator('#memberSearch').fill('');
  await row('a').locator(':scope > summary').click();
  await row('a').locator('[data-first-name]').fill('Nicht übernehmen');
  // Invalid driver setting on another member must block the entire batch.
  await row('b').locator(':scope > summary').click();await row('b').locator('[data-first-name]').fill('Auch offen');
  await row('b').locator('.ux-member-section').filter({hasText:'Funktionen und Fahrberechtigungen'}).locator(':scope > summary').click();
  await row('b').locator('[data-machinist-vehicle="LF"]').check();
  await page.locator('#membersSaveAll').click();assert.equal(await page.evaluate(()=>memberSaveCalls),1);assert.equal(await row('a').locator('[data-first-name]').inputValue(),'Nicht übernehmen');
  await row('b').locator('[data-driver-license-checked]').fill('2026-10-01');await page.locator('#membersSaveAll').click();assert.equal(await page.evaluate(()=>memberSaveCalls),2);
  // A failed independent PIN does not undo member data or discard another draft.
  await row('a').locator(':scope > summary').click();await row('a').locator('[data-first-name]').fill('Mitglied gespeichert');await row('a').locator('[data-dr-new-pin]').fill('1234');
  await page.evaluate(()=>{window.Drinks.saveAdminPin=async button=>{const box=button.closest('.dr-pin-editor');box.querySelector('input').value='';delete box.dataset.dirty;box.querySelector('[data-dr-pin-status]').textContent='Synthetischer Verbindungsfehler';return false;};});
  await page.locator('#membersSaveAll').click();await page.waitForFunction(()=>document.querySelector('#membersSaveStatus').textContent.includes('PIN nicht gespeichert'));
  assert.equal(await page.evaluate(()=>memberSaveCalls),3);assert.equal(await row('a').locator('[data-dr-new-pin]').inputValue(),'');
  await row('a').locator('[data-first-name]').fill('Entwurf verwerfen');page.once('dialog',d=>d.accept());await page.locator('#membersDiscardAll').click();assert.equal(await row('a').locator('[data-first-name]').inputValue(),'Mitglied gespeichert');
  if(await row('a').getAttribute('open')===null)await row('a').locator(':scope > summary').click();
  for(const detail of await row('a').locator('.ux-member-section').all()){if(await detail.getAttribute('open')===null)await detail.locator(':scope > summary').click();}
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});
   const overflow=await row('a').evaluate(el=>[...el.querySelectorAll('input,fieldset,label,button')].filter(n=>n.getClientRects().length).filter(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(n=>n.outerHTML.slice(0,130)));
   assert.deepEqual(overflow,[],'Member card controls fit at '+width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page overflow at '+width);
  }
  await page.setViewportSize({width:390,height:844});await row('a').screenshot({path:'/tmp/members-editor-mobile.png'});
  assert.deepEqual(errors,[]);console.log('Members editor browser OK: batch across collapsed/filtered rows, validation before writes, independent PIN failure, discard, responsive 320/390/768.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
