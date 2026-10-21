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
test('Einstellungen: aktives Push bleibt unabhängig, WhatsApp verwendet die gemeinsame Anmeldung',async()=>{
 const f=settingsFixture({sessions:2,saved:{portal:true,alias:'a'.repeat(32),revision:'revision-test',endpoint:'https://test.invalid/push'}});
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.dom['portal-push-state'].textContent,'Aktiv');
 assert.equal(f.dom['portal-push-enable'].hidden,true);assert.equal(f.dom['portal-push-disable'].hidden,false);
 assert.equal(f.dom['portal-browser-state'],undefined);
 assert.deepEqual(f.calls,[]);
});
test('Einstellungen: veraltete Push-Revision lässt sich erneut aktivieren',async()=>{
 const f=settingsFixture({saved:{portal:true,alias:'a'.repeat(32),revision:'old-revision',endpoint:'https://test.invalid/push'}});
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.dom['portal-push-enable'].hidden,false);assert.equal(f.dom['portal-push-enable'].disabled,false);
 assert.equal(f.dom['portal-push-enable'].textContent,'Erneut aktivieren');assert.equal(f.dom['portal-push-disable'].hidden,true);
});
