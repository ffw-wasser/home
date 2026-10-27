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
test('Einstellungen: aktives Push bleibt unabhängig von der gemeinsamen Anmeldung',async()=>{
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

test('Terminseite bleibt als persönlicher H₂O-Link ohne WhatsApp-Rückkehr nutzbar',()=>{const html=read('termin.html');assert.doesNotMatch(html,/id="back-to-whatsapp"/);assert.match(html,/id="back-to-h2o"/);assert.doesNotMatch(html,/id="back-to-h2o" hidden/);});
