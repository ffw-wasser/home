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
test('WhatsApp-Verbindung: die H2O-App bleibt offen und kann privaten Link nur kopieren',async()=>{
 const html=read('deckel.html'),dom=elements(html),copied=[];
 assert.match(html,/Push & WhatsApp/);
 assert.doesNotMatch(html,/id="portal-browser-open"/,'kein Link, der die installierte App verlässt');
 const link='https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/test&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64);
 const apiCalls=[];
 const c=vm.createContext({
   console,URL,AbortSignal,location:{href:link,hash:link.split('#')[1],search:''},
   document:{hidden:false,readyState:'complete',getElementById:id=>dom[id],addEventListener(){}},
   navigator:{clipboard:{writeText:async value=>copied.push(value)}},
   DeckelDevice:{read:async()=>null,readLink:async()=>null},
   H2OPortal:{api:async path=>{apiCalls.push(path);return {code:'B'.repeat(24),expiresAt:Date.now()+300000};}},
   fetch:async()=>({ok:true,json:async()=>({browserPairVersion:1})})
 });
 vm.runInContext(read('js/features/drinks/deckel-push.js'),c);
 await c.DeckelPush.render({alias:'a'.repeat(32),revision:'revision-test',origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'});
 await dom['portal-browser-start'].onclick();
 assert.deepEqual(apiCalls,['browser/status','browser/start']);
 assert.equal(dom['portal-browser-link-box'].hidden,false);
 await dom['portal-browser-copy'].onclick();
 assert.equal(copied.length,1);
 assert.equal(copied[0],'https://ffw-wasser.github.io/home/termin.html#pair='+'b'.repeat(24));
 assert.ok(!copied[0].includes('ffw-wasser/test')&&!copied[0].includes('&k='));
});
function responseContext({standalone=false,from='',historyLength=1,savedURL=null}={}){
 const dom=elements(read('termin.html')),assigned=[],back=[];
 const location={href:'https://ffw-wasser.github.io/home/termin.html',origin:'https://ffw-wasser.github.io',pathname:'/home/termin.html',search:'',hash:'',assign:url=>assigned.push(url)};
 const history={length:historyLength,replaceState(){},back:()=>back.push(true)};
 const c=vm.createContext({
  console,URL,URLSearchParams,Intl,Date,location,history,
  navigator:{standalone},
  document:{referrer:from,getElementById:id=>dom[id],createElement:()=>new Node()},
  matchMedia:()=>({matches:standalone}),localStorage:{getItem:()=>null,removeItem(){}},
  DeckelDevice:{read:async()=>savedURL?{url:savedURL}:null,readLink:async()=>null},
  confirm:()=>true,
  crypto:{randomUUID:()=> 'request-test-id'},
  setTimeout:()=>1,clearTimeout(){}
 });
 vm.runInContext(read('js/features/portal/portal-whatsapp.js'),c);
 return {dom,assigned,back};
}
test('Zurück: installierte H2O-App wird nur mit gespeichertem privaten Link geöffnet',async()=>{
 const personal='https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/test&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64);
 const run=responseContext({standalone:true,savedURL:personal});
 await run.dom['back-to-h2o'].events.click();
 assert.deepEqual(run.assigned,[personal]);assert.equal(run.back.length,0);
});
test('Zurück: gültige Verlaufshistorie funktioniert; sonst erfolgt keine QR-Umleitung',async()=>{
 const from=responseContext({from:'https://ffw-wasser.github.io/home/deckel.html',historyLength:3});
 await from.dom['back-to-h2o'].events.click();
 assert.equal(from.back.length,1);
 const unknown=responseContext({});
 await unknown.dom['back-to-h2o'].events.click();
 assert.equal(unknown.assigned.length,0);
 assert.equal(unknown.back.length,0);
 assert.match(unknown.dom['back-to-h2o-status'].textContent,/Home-Bildschirm/);
});

function settingsFixture({clipboardFails=false,saved=null,permission='granted',sessions=0}={}){
 const dom=elements(read('deckel.html')),calls=[],copied=[],clock={now:Date.now()};
 const c=vm.createContext({console,URL,AbortSignal,Date:class extends Date{static now(){return clock.now;}},
  location:{href:'https://ffw-wasser.github.io/home/deckel.html#a='+'a'.repeat(32),hash:'#a='+'a'.repeat(32)},
  document:{hidden:false,readyState:'complete',getElementById:id=>dom[id],addEventListener(){}},
  navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>saved?{endpoint:saved.endpoint}:null}})},clipboard:{writeText:async value=>{if(clipboardFails)throw Error('denied');copied.push(value);}}},
  PushManager:{},Notification:{permission},DeckelDevice:{read:async()=>saved},
  H2OPortal:{api:async path=>{calls.push(path);return path==='browser/status'?{sessions}:path==='browser/revoke'?{ok:true}:{code:'B'.repeat(24),expiresAt:clock.now+300000};}},
  confirm:()=>true,fetch:async()=>({ok:true,json:async()=>({browserPairVersion:1})})
 });
 vm.runInContext(read('js/features/drinks/deckel-push.js'),c);
 const access={alias:'a'.repeat(32),revision:'revision-test',origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'};
 return {dom,c,calls,copied,clock,access};
}
test('Einstellungen: aktives Push zeigt nur Deaktivieren, Browserstatus kommt vom Dienst',async()=>{
 const f=settingsFixture({sessions:2,saved:{portal:true,alias:'a'.repeat(32),revision:'revision-test',endpoint:'https://test.invalid/push'}});
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.dom['portal-push-state'].textContent,'Aktiv');
 assert.equal(f.dom['portal-push-enable'].hidden,true);assert.equal(f.dom['portal-push-disable'].hidden,false);
 assert.equal(f.dom['portal-browser-state'].textContent,'2 Browser verbunden');
 assert.deepEqual(f.calls,['browser/status']);
});
test('Einstellungen: Clipboard-Fehler bietet echten Kopiertext; abgelaufener Link wird gelöscht',async()=>{
 const f=settingsFixture({clipboardFails:true});await f.c.DeckelPush.render(f.access);
 await f.dom['portal-browser-start'].onclick();assert.equal(f.dom['portal-browser-start'].hidden,true);
 await f.dom['portal-browser-copy'].onclick();
 assert.equal(f.dom['portal-browser-manual'].hidden,false);assert.match(f.dom['portal-browser-link'].value,/#pair=b{24}$/);
 assert.equal(f.dom['portal-browser-link'].selected,true);
 f.clock.now+=300001;await f.dom['portal-browser-copy'].onclick();
 assert.equal(f.dom['portal-browser-link-box'].hidden,true);assert.equal(f.dom['portal-browser-link'].value,'');
 assert.equal(f.dom['portal-browser-start'].hidden,false);assert.match(f.dom['portal-browser-status'].textContent,/abgelaufen/);
});
test('Einstellungen: Kontowechsel entfernt privaten Link; Sperrbestätigung setzt Status zurück',async()=>{
 const f=settingsFixture({sessions:1});await f.c.DeckelPush.render(f.access);await f.dom['portal-browser-start'].onclick();
 await f.c.DeckelPush.render({...f.access,alias:'c'.repeat(32)});
 assert.equal(f.dom['portal-browser-link-box'].hidden,true);assert.equal(f.dom['portal-browser-copy'].disabled,true);
 await f.dom['portal-browser-revoke'].onclick();assert.equal(f.dom['portal-browser-state'].textContent,'Nicht verbunden');
 assert.equal(f.calls.at(-1),'browser/revoke');
});

test('Einstellungen: veraltete Push-Revision lässt sich erneut aktivieren',async()=>{
 const f=settingsFixture({saved:{portal:true,alias:'a'.repeat(32),revision:'old-revision',endpoint:'https://test.invalid/push'}});
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.dom['portal-push-enable'].hidden,false);assert.equal(f.dom['portal-push-enable'].disabled,false);
 assert.equal(f.dom['portal-push-enable'].textContent,'Erneut aktivieren');assert.equal(f.dom['portal-push-disable'].hidden,true);
});
