// Synthetic response page regression tests: no production accounts or messages.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
for(const width of [320,390,412,768]){
 const page=await browser.newPage({viewport:{width,height:844}}),id='a'.repeat(43),jobs=[];
 let mode='offline',event={id,title:'Test Sonderprobe',sessionType:'Sonderprobe',start:Date.parse('2030-06-12T22:00Z'),allDay:true,location:'GH Wasser',clothing:'Uniform',status:'open',version:0};
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
 if(u.hostname.endsWith('workers.dev')){if(u.pathname.endsWith('/reply')){const job=JSON.parse(r.postData());jobs.push(job);if(mode==='success'){event={...event,status:job.status,version:event.version+1};return route.fulfill({json:{ok:true,status:event.status,version:event.version}});}return route.fulfill({status:mode==='offline'?503:409,json:{error:mode==='offline'?'Verbindung unterbrochen.':'Antwort inzwischen geändert.'}});}return route.fulfill({json:{memberName:'Test Anna',events:[event],stale:false}});}
 if(u.pathname.endsWith('/portal-identity.js'))return route.fulfill({contentType:'application/javascript',body:"window.H2OIdentity={session:()=>({scope:'portal',expiresAt:Date.now()+86400000,alias:'test',revision:'test',token:'synthetic'})};"});
 if(u.pathname.endsWith('/push-device.js')||u.pathname.endsWith('/passkeys-browser.js'))return route.fulfill({contentType:'application/javascript',body:''});
 const file=path.resolve(u.pathname.replace(/^\/home\//,''));return fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
 await page.goto('https://example.test/home/termin.html?event='+id);await page.locator('#chosen').waitFor({state:'visible'});
 assert.match(await page.locator('#event-when').innerText(),/ganztägig/);assert.match(await page.locator('#event-clothing').innerText(),/Uniform/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByRole('button',{name:'Zurück zu WhatsApp',exact:true}).click();assert.ok(!(await page.locator('#back-to-h2o-status').innerText()).includes('gespeichert'));
 await page.getByRole('button',{name:'Bin dabei',exact:true}).click();await page.getByRole('button',{name:'Speicherung prüfen',exact:true}).waitFor();
 await page.getByRole('button',{name:'Zurück zu WhatsApp',exact:true}).click();assert.ok(!(await page.locator('#back-to-h2o-status').innerText()).includes('gespeichert'));
 mode='success';await page.getByRole('button',{name:'Speicherung prüfen',exact:true}).click();await page.getByText('✓ Gespeichert!',{exact:true}).waitFor();assert.equal(jobs[0].requestId,jobs[1].requestId);
 // A second tap still withdraws the selected answer.
 await page.getByRole('button',{name:'✓ Bin dabei',exact:true}).click();await page.getByText('Deine Rückmeldung fehlt noch',{exact:false}).waitFor();assert.equal(jobs.at(-1).status,'open');
 mode='conflict';await page.getByRole('button',{name:'Noch unsicher',exact:true}).click();await page.getByRole('button',{name:'Termin neu laden',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Bin dabei',exact:true}).isDisabled(),true);
 event={...event,status:'excused',version:9};await page.getByRole('button',{name:'Termin neu laden',exact:true}).click();await page.getByRole('button',{name:'✓ Entschuldigt',exact:true}).waitFor();
 mode='success';await page.getByRole('button',{name:'Bin dabei',exact:true}).click();await page.getByText('✓ Gespeichert!',{exact:true}).waitFor();assert.equal(jobs.at(-1).expectedVersion,9);
 await page.screenshot({path:'/tmp/whatsapp-reply-'+width+'.png',fullPage:true});await page.close();console.log('WhatsApp reply recovery and compact card: '+width+'px');
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
