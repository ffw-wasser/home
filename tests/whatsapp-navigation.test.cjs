const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
class Node {
 constructor(){this.hidden=false;this.disabled=false;this.href='';this.textContent='';this.value='';this.events={};}
 addEventListener(name,fn){this.events[name]=fn;}
 focus(){}
 select(){this.selected=true;}
 querySelectorAll(){return [];}
 removeAttribute(name){delete this[name];}
 setAttribute(name,value){this[name]=value;}
}
const elements=html=>Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new Node()]));
test('WhatsApp-Einstellungen haben keine separate Verbindung oder Registrierung mehr',()=>{
 const html=read('deckel.html');
 for(const id of ['portal-browser-start','portal-browser-copy','portal-browser-revoke','portal-browser-legacy'])assert.ok(!html.includes('id="'+id+'"'));
 assert.ok(html.includes('id="identity-login"'));
});
function responseContext({standalone=false,from='',historyLength=1,savedURL=null,search='',userAgent='',platform='',maxTouchPoints=0,blocked=false,connected=false,replyFails=false,closeBlocked=false,initialStatus='open'}={}){
 const dom=elements(read('termin.html')),assigned=[],back=[],closes=[],listeners=new Set(),timers=new Map();let timerId=0;
 const event={id:'a'.repeat(43),start:Date.now()+86400000,title:'Synthetische Probe',status:initialStatus,version:0};
 const replies=['yes','excused','maybe'].map(value=>{const n=new Node();n.dataset={reply:value};return n;});dom.chosen.querySelectorAll=()=>replies;
 const document={hidden:false,referrer:from,getElementById:id=>dom[id],createElement:()=>new Node(),addEventListener:(type,fn)=>{if(type==='visibilitychange')listeners.add(fn);},removeEventListener:(type,fn)=>listeners.delete(fn)};
 const location={href:'https://ffw-wasser.github.io/home/termin.html',origin:'https://ffw-wasser.github.io',pathname:'/home/termin.html',search,hash:'',assign:url=>{assigned.push(url);if(blocked)throw Error('blocked');}};
 const history={length:historyLength,replaceState(){},back:()=>back.push(true)};
 const c=vm.createContext({
  console,URL,URLSearchParams,Intl,Date,location,history,
  navigator:{standalone,userAgent,platform,maxTouchPoints},
  document,AbortController,
  H2OIdentity:{session:()=>connected?{scope:'portal',expiresAt:Date.now()+86400000,alias:'synthetic',revision:'test',token:'synthetic'}:null},
  fetch:async(url,options)=>{if(url.endsWith('/reply')){if(replyFails)throw Error('offline');const body=JSON.parse(options.body);event.status=body.status;event.version++;return {ok:true,json:async()=>({ok:true,status:event.status,version:event.version})};}return {ok:true,json:async()=>({events:[event],stale:false})};},
  close:()=>{closes.push(true);if(closeBlocked)throw Error('browser blocked closing');},
  matchMedia:()=>({matches:standalone}),localStorage:{getItem:()=>null,removeItem(){}},
  DeckelDevice:{read:async()=>savedURL?{url:savedURL}:null,readLink:async()=>null},
  confirm:()=>true,
  crypto:{randomUUID:()=> 'request-test-id'},
  setTimeout:(fn)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)
 });
 vm.runInContext(read('js/features/portal/portal-whatsapp.js'),c);
 return {dom,assigned,back,closes,replies,listeners,hidePage(){document.hidden=true;for(const fn of [...listeners])fn();},showPage(){document.hidden=false;for(const fn of [...listeners])fn();},expire(){for(const fn of [...timers.values()])fn();}};
}
test('WhatsApp öffnet auf Handys und iPad erst beim Tippen ohne Termindaten',()=>{
 for(const device of [{userAgent:'iPhone'},{userAgent:'Android'},{userAgent:'iPad'},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}]){
  const run=responseContext({...device,search:'?event=private-event&token=private-token'});
  assert.deepEqual(run.assigned,[]);
  run.dom['back-to-whatsapp'].events.click();
  assert.deepEqual(run.assigned,['whatsapp://app']);
  assert.match(run.dom['back-to-h2o-status'].textContent,/App-Umschalter/);
  assert.ok(!run.dom['back-to-h2o-status'].textContent.includes('gespeichert'));
 }
});
test('Desktop öffnet WhatsApp Web; nur ein echter HTTPS-WhatsApp-Verlauf geht zurück',()=>{
 const desktop=responseContext();desktop.dom['back-to-whatsapp'].events.click();assert.deepEqual(desktop.assigned,['https://web.whatsapp.com/']);
 const web=responseContext({from:'https://web.whatsapp.com/',historyLength:2});
 assert.equal(web.back.length,0);web.dom['back-to-whatsapp'].events.click();assert.equal(web.back.length,1);assert.deepEqual(web.assigned,[]);
 for(const from of ['https://fakewhatsapp.com/','https://whatsapp.com.evil.test/','http://web.whatsapp.com/','']){
  const fake=responseContext({from,historyLength:2,userAgent:'Android'});fake.dom['back-to-whatsapp'].events.click();assert.equal(fake.back.length,0);assert.deepEqual(fake.assigned,['whatsapp://app']);
 }
});
test('Blockierter App-Aufruf behält einen verständlichen manuellen Rückweg',()=>{
 const run=responseContext({userAgent:'iPhone',blocked:true});
 assert.doesNotThrow(()=>run.dom['back-to-whatsapp'].events.click());
 assert.match(run.dom['back-to-h2o-status'].textContent,/App-Umschalter/);
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('Nur der bestätigte Rückmelde-Tab erhält nach dem expliziten App-Wechsel einen Schließversuch',async()=>{
 const run=responseContext({connected:true,userAgent:'iPhone',search:'?event='+'a'.repeat(43)});await settle();
 run.dom['back-to-whatsapp'].events.click();run.hidePage();assert.equal(run.closes.length,0,'not saved yet');run.showPage();
 run.replies[0].events.click();await settle();assert.equal(run.dom.status.textContent,'✓ Gespeichert!');assert.equal(run.closes.length,0,'saving alone never closes');
 run.dom['back-to-whatsapp'].events.click();assert.equal(run.closes.length,0,'leave time for the app-opening prompt');assert.match(run.dom['back-to-h2o-status'].textContent,/Rückmeldung gespeichert. Du kannst diese Seite schließen./);
 run.showPage();assert.equal(run.closes.length,0);run.hidePage();assert.equal(run.closes.length,1);assert.equal(run.listeners.size,0);run.hidePage();assert.equal(run.closes.length,1,'attempt only once');
});
test('Geladene Antwort, unbestätigte Speicherung und abgelaufener App-Wechsel schließen keinen Tab',async()=>{
 const loaded=responseContext({connected:true,initialStatus:'yes',userAgent:'Android',search:'?event='+'a'.repeat(43)});await settle();loaded.dom['back-to-whatsapp'].events.click();loaded.hidePage();assert.equal(loaded.closes.length,0);
 const pending=responseContext({connected:true,replyFails:true,userAgent:'iPhone',search:'?event='+'a'.repeat(43)});await settle();pending.replies[0].events.click();await settle();pending.dom['back-to-whatsapp'].events.click();pending.hidePage();assert.deepEqual(pending.assigned,[]);assert.equal(pending.closes.length,0);assert.match(pending.dom['back-to-h2o-status'].textContent,/noch nicht bestätigt/);
 const expired=responseContext({connected:true,userAgent:'Android',search:'?event='+'a'.repeat(43)});await settle();expired.replies[0].events.click();await settle();expired.dom['back-to-whatsapp'].events.click();expired.expire();expired.hidePage();assert.equal(expired.closes.length,0);
});
test('Neue Speicherung oder blockierter WhatsApp-Aufruf verwirft den vorherigen Schließversuch',async()=>{
 const run=responseContext({connected:true,userAgent:'iPhone',search:'?event='+'a'.repeat(43)});await settle();run.replies[0].events.click();await settle();run.dom['back-to-whatsapp'].events.click();run.replies[1].events.click();run.hidePage();await settle();assert.equal(run.closes.length,0);assert.equal(run.listeners.size,0);
 const blocked=responseContext({connected:true,blocked:true,userAgent:'Android',search:'?event='+'a'.repeat(43)});await settle();blocked.replies[0].events.click();await settle();blocked.dom['back-to-whatsapp'].events.click();blocked.hidePage();assert.equal(blocked.closes.length,0);assert.equal(blocked.listeners.size,0);assert.match(blocked.dom['back-to-h2o-status'].textContent,/Du kannst diese Seite schließen/);
});
test('Blockiertes Schließen lässt die bestätigte Rückmeldung und den Hinweis stehen',async()=>{
 const run=responseContext({connected:true,closeBlocked:true,userAgent:'iPhone',search:'?event='+'a'.repeat(43)});await settle();run.replies[0].events.click();await settle();run.dom['back-to-whatsapp'].events.click();assert.doesNotThrow(()=>run.hidePage());assert.equal(run.closes.length,1);assert.equal(run.dom.status.textContent,'✓ Gespeichert!');assert.match(run.dom['back-to-h2o-status'].textContent,/Du kannst diese Seite schließen/);
});
test('Terminseite enthält keine überflüssigen Zugangs- und H2O-Buttons',()=>{
 const html=read('termin.html');
 assert.match(html,/id="back-to-h2o" hidden/);
 assert.match(html,/id="remove" hidden/);
 assert.ok(!html.includes('Bisherige Verbindung während der Umstellung'));
});

function settingsFixture({clipboardFails=false,saved=null,permission='granted',sessions=0}={}){
 const dom=elements(read('deckel.html')),calls=[],copied=[],clock={now:Date.now()};
 const c=vm.createContext({console,URL,AbortSignal,atob,setTimeout,clearTimeout,Date:class extends Date{static now(){return clock.now;}},
  location:{href:'https://ffw-wasser.github.io/home/deckel.html#a='+'a'.repeat(32),hash:'#a='+'a'.repeat(32)},
  document:{hidden:false,readyState:'complete',getElementById:id=>dom[id],addEventListener(){}},
  navigator:{serviceWorker:{getRegistration:async()=>({active:{},pushManager:{getSubscription:async()=>saved?{endpoint:saved.endpoint}:null}})},clipboard:{writeText:async value=>{if(clipboardFails)throw Error('denied');copied.push(value);}}},
  PushManager:{},Notification:{permission},DeckelDevice:{read:async()=>saved},
  H2OPortal:{api:async path=>{calls.push(path);return path==='push-devices'?{ok:true,count:saved?1:0,limit:5,registered:!!saved}:path==='browser/status'?{sessions}:path==='browser/revoke'?{ok:true}:{code:'B'.repeat(24),expiresAt:clock.now+300000};}},
  confirm:()=>true,fetch:async()=>({ok:true,json:async()=>({browserPairVersion:1,portalVersion:1,publicKey:'B'.repeat(87)})})
 });
 vm.runInContext(read('js/features/drinks/deckel-push.js'),c);
 const access={alias:'a'.repeat(32),revision:'revision-test',origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'};
 return {dom,c,calls,copied,clock,access};
}
test('Einstellungen: aktives Push bleibt unabhängig, WhatsApp verwendet die gemeinsame Anmeldung',async()=>{
 const f=settingsFixture({sessions:2,saved:{portal:true,alias:'a'.repeat(32),revision:'revision-test',endpoint:'https://test.invalid/push'}});
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.dom['portal-push-state'].textContent,'Aktiv');
 assert.equal(f.dom['portal-push-enable'].hidden,true);assert.equal(f.dom['portal-push-disable'].hidden,false);
 assert.equal(f.dom['portal-browser-state'],undefined);
 assert.deepEqual(f.calls,['push-devices']);
});
test('Einstellungen: veraltete Push-Revision lässt sich erneut aktivieren',async()=>{
 const f=settingsFixture({saved:{portal:true,alias:'a'.repeat(32),revision:'old-revision',endpoint:'https://test.invalid/push'}});
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.dom['portal-push-enable'].hidden,false);assert.equal(f.dom['portal-push-enable'].disabled,false);
 assert.equal(f.dom['portal-push-enable'].textContent,'Erneut aktivieren');assert.equal(f.dom['portal-push-disable'].hidden,true);
});
