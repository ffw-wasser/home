const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/features/drinks/deckel-push.js'),'utf8');
function fixture({failure=false,saved=null,permission='default'}={}){
 const nodes=new Map(),calls=[],state={saved,sub:saved?{endpoint:saved.endpoint,unsubscribe:async()=>{state.sub=null;calls.push('unsubscribe');return true;}}:null,failure,permission,pending:null};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,setAttribute(){}});return nodes.get(id);};
 const reg={active:{},pushManager:{getSubscription:async()=>state.sub,subscribe(){calls.push('subscribe');if(state.pending)return state.pending;state.permission='granted';return Promise.resolve(state.sub={endpoint:'https://web.push.apple.com/test',unsubscribe:async()=>{calls.push('unsubscribe');state.sub=null;return true;}});}}};
 const c=vm.createContext({console,URL,Uint8Array,atob,setTimeout,clearTimeout,AbortSignal,
  document:{readyState:'complete',hidden:false,getElementById:node,addEventListener(){}},location:{href:'https://ffw-wasser.github.io/home/deckel.html'},
  navigator:{userAgent:'test',serviceWorker:{getRegistration:async()=>reg}},PushManager:function(){},Notification:{get permission(){return state.permission;},requestPermission(){throw Error('must not precede subscribe');}},
  DeckelDevice:{read:async()=>state.saved,write:async value=>{calls.push('write');state.saved=value;},clear:async()=>{state.saved=null;},saveLink:async url=>{assert.ok(new URL(url).hash,'passkey URL is not an old personal link');}},
  H2OIdentity:{session:()=>({})},H2OPortal:{api:async path=>{if(path==='push-devices')return {ok:true,count:state.saved?1:0,limit:5,registered:!!state.saved};calls.push('api');return {ok:true};}},
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
