// Local synthetic access only; every external request is blocked or mocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER?{channel:process.env.QA_BROWSER}:{})});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let status='open',version=0,supported=true,replies=0,reads=0,many=false,holdReply=false,releaseReply,onReplyReceived;
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='test.account.workers.dev'){
  if(u.pathname==='/portal/reply'){const body=route.request().postDataJSON();assert.equal(body.expectedVersion,version);status=body.status;version++;replies++;const answer={ok:true,status,version};if(holdReply)return new Promise(resolve=>{releaseReply=()=>resolve(route.fulfill({json:answer}));onReplyReceived?.();});return route.fulfill({json:answer});}
  reads++;return route.fulfill({json:{configured:true,uncertainReplies:supported,stale:false,fetchedAt:Date.now(),events:many?Array.from({length:7},(_,i)=>({id:i===4?'test-event':'other-'+i,title:i===4?'Testprobe':'Weiterer Testtermin '+i,start:Date.now()+(i+1)*3600000,end:Date.now()+(i+2)*3600000,status:i===4?status:'open',version:i===4?version:0})):[{id:'test-event',title:'Testprobe',start:Date.now()+3600000,end:Date.now()+7200000,status,version}]}});
 }const file=path.resolve(root,'.'+u.pathname);if(u.hostname!=='localhost'||!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream'});});
 await page.addInitScript(()=>{const create=URL.createObjectURL.bind(URL);window.qaCalendarBlobs=new Map();URL.createObjectURL=blob=>{const url=create(blob);qaCalendarBlobs.set(url,blob);return url;};});await page.goto('http://localhost/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('refresh').getAttribute('aria-busy')!=='true');
 await page.evaluate(async()=>{history.replaceState(null,'','#a='+'1'.repeat(32));await H2OPortal.render({actions:{central:true,origin:'https://test.account.workers.dev',capability:'a'.repeat(43),revision:'test'}});document.getElementById('h2o-onboarding')?.dispatchEvent(new Event('cancel',{cancelable:true}));DeckelMobile.show(true);});
 const ready=()=>page.waitForFunction(()=>!document.getElementById('portal-refresh').disabled);
 await ready();const initialReads=reads;await page.locator('[data-reply="maybe"]').click();await page.waitForFunction(()=>document.querySelector('.portal-event').dataset.status==='maybe');await ready();assert.equal(replies,1);
 assert.equal(await page.locator('.portal-answer').textContent(),'✓ Rückmeldung gespeichert.');assert.equal(await page.locator('.portal-event').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(238, 247, 241)');assert.equal(await page.locator('.is-event-day strong').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(104, 65, 139)');
 await page.locator('[data-reply="yes"]').click();await page.waitForFunction(()=>document.querySelector('.portal-event').dataset.status==='yes');await ready();assert.equal(reads,initialReads,'Antworten laden Termine und Nachweise nicht erneut');supported=false;await page.evaluate(()=>DeckelMobile.jump('portal-section'));await ready();await page.locator('[data-reply="maybe"]').click();assert.equal(replies,2);assert.match(await page.locator('#portal-status').textContent(),/Cloudflare-Dienst aktualisieren/);
 await page.locator('.portal-event-date').click();const calendar=page.getByRole('dialog');assert.equal(await calendar.isVisible(),true);assert.match(await calendar.getByRole('link',{name:'Tag im Kalender öffnen'}).getAttribute('href'),/^https:\/\/calendar.google.com/);
 const exportLink=calendar.getByRole('link',{name:'Termin übernehmen',exact:false});assert.match(await exportLink.evaluate(async e=>await window.qaCalendarBlobs.get(e.href).text()),/SUMMARY:Testprobe/);const download=page.waitForEvent('download');await calendar.getByRole('link',{name:'Termin übernehmen',exact:false}).click();const file=await download;assert.equal(file.suggestedFilename(),'Feuerwehr-Termin.ics');assert.equal(replies,2,'Kalender verändert keine Rückmeldung');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await calendar.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'../portal-calendar-menu.png')});await calendar.getByRole('button',{name:'Schließen'}).click();assert.equal(await calendar.isVisible(),false);
 // Loading timestamps may change length after every swipe; cards must keep their top position.
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});for(const [target,anchor,statusId] of [['portal-section','.portal-first-event','portal-status'],['portal-evidence','#portal-evidence-details','portal-evidence-status']]){await page.evaluate(id=>DeckelMobile.jump(id),target);await ready();const stable=await page.evaluate(({anchor,statusId})=>{const main=document.getElementById('deckel-main'),status=document.getElementById(statusId),global=document.getElementById('status'),saved=status.textContent,savedGlobal=global.textContent;main.scrollTo({top:0,behavior:'instant'});status.textContent='Wird aktualisiert …';global.textContent='';const before=document.querySelector(anchor).getBoundingClientRect().top;status.textContent='Datenstand: 16.10.2026, 17:30 Uhr. Zuletzt aktualisiert: 16.10.2026. Angezeigt bleibt der zuletzt geladene Stand. Bitte Verbindung prüfen.';global.textContent='Kontostand wird aktualisiert. Bitte kurz warten …';const after=document.querySelector(anchor).getBoundingClientRect().top;status.textContent=saved;global.textContent=savedGlobal;return Math.abs(after-before)<1;},{anchor,statusId});assert.ok(stable,'kein Kartensprung bei Statuswechsel: '+target+' / '+width);}}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>DeckelMobile.jump('portal-section'));await ready();
 const cdp=await page.context().newCDPSession(page);
 async function swipe(x1,y1,x2,y2){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/5,y:y1+(y2-y1)*i/5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await swipe(300,210,100,210);assert.equal(await page.locator('#portal-page-evidence').isVisible(),true);await ready();await swipe(100,210,300,210);assert.equal(await page.locator('#portal-page-terms').isVisible(),true);await ready();
 await swipe(200,450,205,250);assert.equal(await page.locator('#portal-page-terms').isVisible(),true);
 await page.evaluate(()=>document.getElementById('deckel-main').scrollTo({top:0,behavior:'instant'}));
 const dateBox=await page.locator('.portal-event-date').boundingBox(),touch={x:dateBox.x+dateBox.width*.7,y:dateBox.y+dateBox.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x-52,y:touch.y+10}]});assert.equal(await page.locator('#portal-page-evidence').isVisible(),true,'kurzer Wisch über Datum reagiert vor Loslassen');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x+60,y:touch.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('#portal-page-evidence').isVisible(),true,'keine Umkehr oder zweiter Wechsel');assert.equal(await calendar.isVisible(),false,'Wischen öffnet keinen Kalender');assert.equal(replies,2);
 // Saving a later card must retain the actual focused node and scroll position.
 many=true;supported=true;await page.evaluate(()=>DeckelMobile.jump('portal-section'));await ready();
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  for(const answer of ['maybe','open','yes','excused']){
   const value=answer==='open'?'maybe':answer,button=page.locator('#portal-event-test-event [data-reply="'+value+'"]');
   await button.scrollIntoViewIfNeeded();await button.focus();
   await page.evaluate(value=>{window.qaReplyButton=document.querySelector('#portal-event-test-event [data-reply="'+value+'"]');window.qaReplyCard=document.getElementById('portal-event-test-event');window.qaOtherCards=[...document.querySelectorAll('.portal-event')].filter(n=>n!==qaReplyCard);},value);
   const beforeReplies=replies,arrived=new Promise(resolve=>onReplyReceived=resolve);holdReply=true;releaseReply=null;
   await button.click();await arrived;
   assert.equal(await page.evaluate(()=>document.activeElement===qaReplyButton),true,'focus stays on reply while saving');
   assert.equal(await button.getAttribute('aria-disabled'),'true');await button.evaluate(b=>b.click());assert.equal(replies,beforeReplies+1,'busy click cannot submit twice');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const before=await page.evaluate(()=>({scroll:document.getElementById('deckel-main').scrollTop,top:qaReplyCard.getBoundingClientRect().top}));
   releaseReply();await ready();holdReply=false;
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const after=await page.evaluate(()=>({scroll:document.getElementById('deckel-main').scrollTop,top:qaReplyCard.getBoundingClientRect().top,focus:document.activeElement===qaReplyButton,button:qaReplyButton.isConnected,card:document.getElementById('portal-event-test-event')===qaReplyCard,others:qaOtherCards.every(n=>n.isConnected)}));
   assert.equal(after.focus,true,'saved reply retains focus '+width+'/'+answer);assert.equal(after.button&&after.card&&after.others,true,'saved reply does not replace any cards or buttons');assert.ok(Math.abs(after.scroll-before.scroll)<2&&Math.abs(after.top-before.top)<2,'no scroll jump on saved reply '+JSON.stringify({width,answer,before,after}));
   assert.equal(await page.locator('#portal-event-test-event').getAttribute('data-status'),answer);
  }
 }
 assert.deepEqual(errors,[]);console.log('Portal: ? speichern/zurücknehmen, neutrale Karte mit violettem Zahlenfenster, alter Worker, echte Touch-Wischgesten sowie stabiler Fokus und Scrollposition beim Speichern späterer Karten geprüft.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

