// Synthetic browser-only fixture. Never contacts WhatsApp or production accounts.
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const width of [320,390,412,768]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<500,hasTouch:true});
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div>'}));
  await page.goto('https://example.test/home/deckel.html#private-key');
  await page.addStyleTag({content:fs.readFileSync('css/features/portal.css','utf8')});
  await page.addScriptTag({content:fs.readFileSync('js/features/portal/portal-reminders.js','utf8')});
  await page.evaluate(()=>{
   window.events=[{id:'event1',title:'Testprobe',start:Date.now()+86400000,sessionType:'Probe',location:'GH Wasser',clothing:'Uniform'}, {id:'event2',title:'Unterricht',start:Date.now()+172800000,clothing:'Zivil'}, {id:'restricted',title:'Kleine Sonderprobe',start:Date.now()+172800000,audienceRestricted:true}];
   window.people=[{id:'a',name:'Test Anna',firstName:'Anna',status:'open',phone:'4915100000000'},{id:'b',name:'Test Bea',firstName:'Bea',status:'maybe',phone:'4915100000001'},{id:'c',name:'Test Clara',status:'yes',phone:null},{id:'d',name:'Test Dora',status:'excused',phone:null},{id:'e',name:'Test Eva',status:'open',phone:null}];
   window.calls=[];window.fail=false;window.req=async(path,data)=>{calls.push({path,data});if(fail)throw Error('Rolle nicht mehr berechtigt');if(path==='whatsapp-events')return {events:structuredClone(events)};if(path==='whatsapp-prepare'){const p=people.find(p=>p.id===data.memberId);return {event:structuredClone(events[0]),eligible:['open','maybe'].includes(p.status),phone:p.phone};}return {event:structuredClone(events[0]),members:structuredClone(people)};};
   window.mount=()=>H2OReminders.mount(document.getElementById('host'),{eventId:'event1',scope:'synthetic',request:req});mount();
  });
  const row=name=>page.locator('.portal-reminder-person').filter({hasText:name});
  await page.getByText('2 Erinnerungen vorgesehen', {exact:false}).waitFor();
  assert.equal(await page.locator('input:checked').count(),2);assert.equal(await row('Test Clara').locator('input').isDisabled(),true);assert.equal(await row('Test Eva').locator('input').isChecked(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await row('Test Anna').getByRole('button',{name:'Vorbereiten',exact:true}).click();
  assert.ok((await page.locator('textarea').inputValue()).includes('Hallo Anna'));
  assert.ok(!(await page.locator('textarea').inputValue()).includes('private-key'));
  await page.evaluate(()=>people[0].status='yes');await page.getByRole('button',{name:'Prüfen & WhatsApp öffnen'}).click();
  await page.getByText('Rückmeldung geändert. Keine Erinnerung mehr vorgesehen.').waitFor();
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.path==='whatsapp-prepare').length),1);
  await row('Test Bea').getByRole('button',{name:'Vorbereiten',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('h2o-whatsapp-progress:synthetic:event1')||'{"done":[]}').done.length),0,'preparation is not delivery');
  await page.getByRole('button',{name:'Manuell als bearbeitet markieren'}).click();await page.getByText('1 manuell bearbeitet',{exact:false}).waitFor();
  await page.evaluate(()=>mount());await page.getByText('1 manuell bearbeitet',{exact:false}).waitFor();assert.equal(await row('Test Bea').getByRole('button').count(),0);
  await row('Test Eva').getByRole('button',{name:'Text kopieren',exact:true}).click();await page.locator('textarea').fill('Bearbeiteter Text');
  await page.evaluate(()=>{people[4].status='excused';});await page.getByRole('button',{name:'Prüfen & Text kopieren'}).click();await page.getByText('Rückmeldung geändert. Keine Erinnerung mehr vorgesehen.').waitFor();
  await page.getByRole('button',{name:'Gruppeninfo',exact:true}).click();await page.getByRole('button',{name:'Gruppeninfo teilen'}).waitFor();
  assert.equal(await page.locator('input:checked').count(),1);assert.ok(!(await page.locator('textarea').inputValue()).includes('Test Anna'));
  await page.locator('label').filter({hasText:'Unterricht'}).locator('input').check();assert.ok((await page.locator('textarea').inputValue()).includes('Unterricht'));
  page.once('dialog',d=>d.dismiss());await page.locator('label').filter({hasText:'Kleine Sonderprobe'}).locator('input').click();assert.equal(await page.locator('label').filter({hasText:'Kleine Sonderprobe'}).locator('input').isChecked(),false);
  page.once('dialog',d=>d.accept());await page.locator('label').filter({hasText:'Kleine Sonderprobe'}).locator('input').click();assert.ok((await page.locator('textarea').inputValue()).includes('Kleine Sonderprobe'));
  await page.evaluate(()=>{window.shared=null;Object.defineProperty(navigator,'share',{configurable:true,value:async x=>{window.shared=x;}});});await page.locator('textarea').fill('Bearbeitete Gruppeninfo');await page.getByRole('button',{name:'Gruppeninfo teilen'}).click();assert.equal(await page.evaluate(()=>shared.text),'Bearbeitete Gruppeninfo');
  await page.evaluate(()=>fail=true);await page.getByRole('button',{name:'Einzeln erinnern',exact:true}).click();await page.getByText('Rolle nicht mehr berechtigt').waitFor();assert.equal(await page.locator('.portal-reminder-person').count(),0);
  await page.close();console.log('WhatsApp preparation, return, selection, role failure and group UI passed at '+width+'px');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
