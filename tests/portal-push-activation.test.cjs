const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/features/drinks/deckel-push.js'),'utf8');
function fixture({failure=false,saved=null,permission='default'}={}){
 const nodes=new Map(),calls=[],state={saved,sub:saved?{endpoint:saved.endpoint,unsubscribe:async()=>{state.sub=null;calls.push('unsubscribe');return true;}}:null,failure,permission,pending:null};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,setAttribute(){}});return nodes.get(id);};
 const reg={active:{},pushManager:{getSubscription:async()=>state.sub,subscribe(){calls.push('subscribe');if(state.pending)return state.pending;state.permission='granted';return Promise.resolve(state.sub={endpoint:'https://web.push.apple.com/test',unsubscribe:async()=>{calls.push('unsubscribe');state.sub=null;return true;}});}}};
 const c=vm.createContext({console,URL,Uint8Array,atob,setTimeout,clearTimeout,AbortSignal,
  document:{readyState:'complete',hidden:false,getElementById:node,addEventListener(){}},location:{href:'https://ffw-wasser.github.io/home/deckel.html'},
  navigator:{userAgent:'test',serviceWorker:{getRegistration:async()=>reg}},PushManager:function(){},Notification:{get permission(){return state.permission;},requestPermission(){throw Error('must not precede subscribe');}},
  DeckelDevice:{read:async()=>state.saved,write:async value=>{calls.push('write');if(state.writeFailure)throw Error('local storage unavailable');state.saved=value;},clear:async()=>{state.saved=null;},saveLink:async url=>{assert.ok(new URL(url).hash,'passkey URL is not an old personal link');}},
  H2OIdentity:{session:()=>({})},H2OPortal:{api:async path=>{if(path==='push-devices'){if(state.authFailure)throw Object.assign(Error('Bitte erneut anmelden.'),{status:401});return {ok:true,count:state.count??(state.saved?1:0),limit:5,registered:state.registered??!!state.saved,renewable:state.renewable??false};}calls.push('api');return {ok:true};}},
  fetch:async()=>{calls.push('health');if(state.failure)throw Error('offline');return {ok:true,json:async()=>({portalVersion:1,publicKey:Buffer.from(Uint8Array.from({length:65},(_,i)=>i?1:4)).toString('base64url')})};}
 });vm.runInContext(source,c);
 const access={alias:'a'.repeat(32),revision:'revision-test',origin:'https://test.example.workers.dev',capability:'b'.repeat(43)};
 return {c,state,calls,access,node:id=>node('portal-push-'+id)};
}
test('Push-Anmeldung startet unmittelbar im Klick; Datenzugriffe sind vorbereitet',async()=>{
 const f=fixture();await f.c.DeckelPush.render(f.access);assert.equal(f.node('enable').textContent,'Aktivieren');f.calls.length=0;
 const pending=f.node('enable').onclick();assert.equal(f.calls[0],'subscribe');await pending;
 assert.deepEqual(f.calls,['subscribe','api','write']);assert.equal(f.node('state').textContent,'Aktiv');assert.equal(f.state.saved.url,'https://ffw-wasser.github.io/home/deckel.html');
 await f.node('disable').onclick();assert.equal(f.state.saved,null);assert.equal(f.node('status').textContent,'Mitteilungen deaktiviert.');
});
test('Fehlgeschlagene Vorbereitung löst keine Berechtigungsabfrage aus und lässt sich erneut prüfen',async()=>{
 const f=fixture({failure:true});await f.c.DeckelPush.render(f.access);assert.match(f.node('status').textContent,/offline/);assert.equal(f.node('enable').textContent,'Erneut prüfen');assert.ok(!f.calls.includes('subscribe'));
 f.state.failure=false;await f.node('enable').onclick();assert.equal(f.node('enable').textContent,'Aktivieren');assert.ok(!f.calls.includes('subscribe'));await f.node('enable').onclick();assert.equal(f.node('state').textContent,'Aktiv');
});
test('Abmeldung während der Berechtigungsabfrage verwirft die Aktivierung und räumt das neue Abo auf',async()=>{
 const f=fixture();await f.c.DeckelPush.render(f.access);let release;f.state.pending=new Promise(resolve=>release=resolve);const activation=f.node('enable').onclick();f.c.DeckelPush.clear();
 release({endpoint:'https://web.push.apple.com/test',unsubscribe:async()=>{f.calls.push('unsubscribe');return true;}});await activation;
 assert.ok(!f.calls.includes('api'));assert.ok(!f.calls.includes('write'));assert.ok(f.calls.includes('unsubscribe'));assert.equal(f.node('enable').disabled,true);
});
test('Abgelehnte Mitteilungen zeigen eine verständliche Rückmeldung',async()=>{
 const f=fixture();await f.c.DeckelPush.render(f.access);f.state.pending=Promise.reject(Object.assign(Error('denied'),{name:'NotAllowedError'}));await f.node('enable').onclick();assert.match(f.node('status').textContent,/Mitteilungseinstellungen/);assert.ok(!f.calls.includes('api'));
});

test('Bestehendes eigenes Gerät erneuert sich bei vollem Limit ohne Zurücksetzen',async()=>{const f=fixture({saved:{portal:true,alias:'a'.repeat(32),revision:'old-revision',endpoint:'https://web.push.apple.com/test'}});Object.assign(f.state,{count:5,registered:false,renewable:true});await f.c.DeckelPush.render(f.access);assert.equal(f.node('reset').hidden,true);assert.equal(f.node('enable').hidden,false);assert.equal(f.node('enable').textContent,'Erneut aktivieren');await f.node('enable').onclick();assert.equal(f.node('state').textContent,'Aktiv');});

const savedDevice=()=>({portal:true,url:'https://ffw-wasser.github.io/home/deckel.html',origin:'https://test.example.workers.dev',alias:'a'.repeat(32),revision:'revision-test',endpoint:'https://web.push.apple.com/test',capability:'old-session'.padEnd(43,'x')});
test('Erneute Anmeldung aktualisiert den Hintergrundzugang eines aktiven Push-Geräts ohne neues Abo',async()=>{
 const saved=savedDevice(),f=fixture({saved,permission:'granted'});f.state.count=5;
 await f.c.DeckelPush.render(f.access);
 assert.equal(f.node('state').textContent,'Aktiv');assert.deepEqual({...f.state.saved},{...saved,capability:f.access.capability});
 assert.deepEqual(f.calls,['write'],'no subscribe, permission prompt or health request is needed');
 await f.c.DeckelPush.render(f.access);assert.deepEqual(f.calls,['write'],'unchanged access is not repeatedly written');
 const next={...f.access,capability:'c'.repeat(43)};await f.c.DeckelPush.render(next);
 assert.equal(f.state.saved.capability,next.capability);assert.deepEqual(f.calls,['write','write']);
});
test('Hintergrundzugang wird bei abgelehnter Anmeldung und fremdem Konto nicht überschrieben',async()=>{
 const saved=savedDevice(),f=fixture({saved,permission:'granted'});f.state.authFailure=true;
 await f.c.DeckelPush.render(f.access);assert.equal(f.state.saved,saved);assert.ok(!f.calls.includes('write'));assert.notEqual(f.node('state').textContent,'Aktiv');
 f.state.authFailure=false;await f.c.DeckelPush.render({...f.access,alias:'d'.repeat(32)});
 assert.equal(f.state.saved,saved);assert.ok(!f.calls.includes('write'));assert.equal(f.node('state').textContent,'Anderes Konto');
});
test('Fehler beim Speichern des aktuellen Hintergrundzugangs wird sichtbar und kann erneut geprüft werden',async()=>{
 const saved=savedDevice(),f=fixture({saved,permission:'granted'});f.state.writeFailure=true;
 await f.c.DeckelPush.render(f.access);assert.equal(f.state.saved,saved);assert.equal(f.node('state').textContent,'Prüfung fehlgeschlagen');
 assert.match(f.node('status').textContent,/local storage unavailable/);f.state.writeFailure=false;
 await f.c.DeckelPush.render(f.access);assert.equal(f.node('state').textContent,'Aktiv');assert.equal(f.state.saved.capability,f.access.capability);
});
