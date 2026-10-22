// Current WhatsApp preparation UI; synthetic contacts, no external messages.
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const width of [320,390,412,768]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<500,hasTouch:true});
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div>'}));
  await page.goto('https://example.test/home/deckel.html#private-key');
  for(const file of ['deckel','portal'])await page.addStyleTag({content:fs.readFileSync('css/features/'+file+'.css','utf8')});
  await page.addScriptTag({content:fs.readFileSync('js/features/portal/portal-reminders.js','utf8')});
  await page.evaluate(()=>{
   window.events=[{id:'event1',title:'Testprobe',start:Date.now()+86400000,sessionType:'Probe',location:'GH Wasser',clothing:'Uniform'}];
   window.people=[{id:'a',name:'Test Anna',firstName:'Anna',status:'open',phone:'4915100000000'},{id:'b',name:'Test Bea',firstName:'Bea',status:'maybe',phone:'4915100000001'},{id:'c',name:'Test Clara',status:'yes',phone:null},{id:'d',name:'Test Dora',status:'excused',phone:null},{id:'e',name:'Test Eva',status:'open',phone:null}];
   window.calls=[];window.fail=false;window.req=async(path,data)=>{calls.push({path,data});if(fail)throw Error('Rolle nicht mehr berechtigt');if(path==='whatsapp-prepare'){const p=people.find(p=>p.id===data.memberId);return {event:structuredClone(events[0]),eligible:p.id!==data.organizerMemberId&&['open','maybe'].includes(p.status),phone:p.phone};}return {event:structuredClone(events[0]),members:structuredClone(people).map(p=>({...p,eligible:p.id!==data.organizerMemberId&&['open','maybe'].includes(p.status)}))};};
   window.mount=(admin=false)=>H2OReminders.mount(document.getElementById('host'),{eventId:'event1',scope:'synthetic',request:req,admin});mount();
  });
  const row=name=>page.locator('.portal-reminder-person').filter({hasText:name});
  await page.getByText('2 Personen für WhatsApp ausgewählt',{exact:false}).waitFor();
  for(const name of ['Test Anna','Test Bea']){const box=await row(name).getByRole('button',{name:'WhatsApp vorbereiten',exact:true}).boundingBox();assert.ok(box.height>=44);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const answered=page.locator('details').filter({hasText:'Keine Erinnerung nötig'});await answered.locator('summary').click();
  assert.equal(await row('Test Clara').getByRole('button').count(),0);assert.equal(await row('Test Dora').getByRole('button').count(),0);
  await row('Test Anna').getByRole('button',{name:'WhatsApp vorbereiten',exact:true}).click();
  assert.match(await page.locator('textarea').inputValue(),/Hallo Anna/);assert.ok(!(await page.locator('textarea').inputValue()).includes('private-key'));
  await page.evaluate(()=>people[0].status='yes');await page.getByRole('button',{name:'WhatsApp öffnen',exact:true}).click();
  await page.getByText('Rückmeldung geändert. Keine Erinnerung mehr vorgesehen.').waitFor();assert.equal(await page.evaluate(()=>calls.filter(c=>c.path==='whatsapp-prepare').length),1);
  await row('Test Bea').getByRole('button',{name:'WhatsApp vorbereiten',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('h2o-whatsapp-progress:synthetic:event1')||'{"done":[]}').done.length),0,'preparation is not delivery');
  await page.getByRole('button',{name:'Als erledigt markieren',exact:true}).click();await page.getByText('1 erledigt',{exact:false}).waitFor();
  await page.evaluate(()=>mount());await page.getByText('1 erledigt',{exact:false}).waitFor();assert.equal(await row('Test Bea').getByRole('button').count(),0);
  const missing=page.locator('details').filter({hasText:'WhatsApp-Kontakt fehlt oder nicht freigegeben'});if(await missing.getAttribute('open')===null)await missing.locator('summary').click();
  await row('Test Eva').getByRole('button',{name:'WhatsApp vorbereiten',exact:true}).click();await page.locator('textarea').fill('Bearbeiteter Text');
  await page.evaluate(()=>people[4].status='excused');await page.getByRole('button',{name:'Text kopieren',exact:true}).click();await page.getByText('Rückmeldung geändert. Keine Erinnerung mehr vorgesehen.').waitFor();
  await page.evaluate(()=>{people[0].status='open';people[4].status='open';mount(true);});
  await page.getByText('Bitte zuerst deinen Namen auswählen.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'WhatsApp vorbereiten',exact:true}).count(),0);
  await page.locator('select').selectOption('a');await page.getByText('1 Person für WhatsApp ausgewählt',{exact:false}).waitFor();
  assert.equal(await row('Test Anna').getByRole('button').count(),0,'organizer is never reminded');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.path==='whatsapp-recipients').at(-1).data.organizerMemberId),'a');
  await page.evaluate(()=>fail=true);await page.getByRole('button',{name:'Rückmeldungen neu laden',exact:true}).click();await page.getByText('Rolle nicht mehr berechtigt').waitFor();assert.equal(await page.locator('.portal-reminder-person').count(),0);
  await page.close();console.log('WhatsApp current UI passed: preparation, fresh replies, missing contact, persistent progress, organizer exclusion and role failure at '+width+'px');
 }
const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'}));
 await page.goto('https://example.test/home/deckel.html');
 for(const file of ['deckel','portal'])await page.addStyleTag({content:fs.readFileSync('css/features/'+file+'.css','utf8')});
 await page.addScriptTag({content:fs.readFileSync('js/features/portal/portal-reminders.js','utf8')});
 const memberSource=fs.readFileSync('js/features/portal/portal-member.js','utf8');
 await page.addScriptTag({content:`const g=window;let overviewDialog,overviewRequest=0,generation=0;const access={origin:'https://example.test',alias:'test'};const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};const event={id:'e',title:'Testprobe',start:Date.now()+86400000};async function api(){return {event,members:[{id:'a',name:'Test Anna',status:'open',phone:'4915100000000'}]};}function closeOverview(){overviewDialog.close();}function shareEvent(){};window.fetch=async()=>new Response(JSON.stringify({browserPairVersion:1}));`+memberSource.slice(memberSource.indexOf(' async function showOverview('),memberSource.indexOf(' function paint('))+`;showOverview(event);`});
 await page.getByRole('button',{name:'Personen erinnern',exact:true}).click();
 await page.getByText('1 Person für WhatsApp ausgewählt',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Terminlink teilen',exact:true}).isVisible(),false);
 assert.equal(await page.getByRole('heading',{name:'Zugesagt (0)',exact:true}).isVisible(),false);
 await page.screenshot({path:'/tmp/whatsapp-clear-dialog.png'});
 await page.getByRole('button',{name:'← Rückmeldungen',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Terminlink teilen',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('heading',{name:'Zugesagt (0)',exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'Schließen',exact:true}).click();assert.equal(await page.locator('dialog').isVisible(),false);
 await page.close();console.log('Reply dialog separates link sharing, reminder selection and return navigation');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
