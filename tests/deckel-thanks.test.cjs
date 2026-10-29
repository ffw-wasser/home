const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(){
 const nodes=new Map(),events={},timers=new Map();let now=0,next=0;
 const element=()=>({hidden:false,disabled:false,textContent:'',addEventListener(name,fn){this['on'+name]=fn;},parentElement:{style:{setProperty(){}}},style:{setProperty(){}},children:[],classList:{toggle(){}},replaceChildren(){this.children=[];},removeAttribute(){},append(n){this.children.push(n);}});
 const url=new URL('https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/deckel-daten&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64));
 const data={balance:0,credit:0,needed:300,bonusCents:300,bookings:[],updatedAt:'2026-10-09T16:00:00Z'},ctx=vm.createContext({URL,URLSearchParams,Date,AbortController,Promise,
  setTimeout:(fn,delay)=>{timers.set(++next,{fn,at:now+delay});return next;},clearTimeout:id=>timers.delete(id),location:{href:url.href,hash:url.hash},
  document:{hidden:false,getElementById:id=>nodes.get(id)||nodes.set(id,element()).get(id),createElement:element,addEventListener:(name,fn)=>events[name]=fn},addEventListener:(name,fn)=>events[name]=fn,
  H2OIdentity:{onboarding:()=>false,prepare:async()=>{},credentials:()=>({alias:'a'.repeat(32),key:'b'.repeat(64)})},DeckelLive:{load:async()=>{if(ctx.failedLoad)throw new TypeError('Failed to fetch');return {};}},
  DeckelCrypto:{access(){},open:async()=>structuredClone(data)},fetch:async()=>{if(ctx.failedLoad)throw new TypeError('Failed to fetch');return {ok:true,text:async()=> '{}'};}});
 vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/deckel-view.js'),'utf8'),ctx);await flush();
 return {ctx,data,nodes,events,async reload(){ctx.DeckelReload();await flush();},advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
}
test('Danke auf dem Handy verschwindet automatisch, während Kontostand und Buchungen sichtbar bleiben',async()=>{
 const f=await fixture();assert.equal(f.nodes.get('thanks').hidden,false);f.advance(2999);assert.equal(f.nodes.get('thanks').hidden,false);
 f.advance(1);assert.equal(f.nodes.get('thanks').hidden,true);assert.equal(f.nodes.get('account').hidden,false);assert.match(f.nodes.get('balance').textContent,/0,00/);
 await f.reload();assert.equal(f.nodes.get('thanks').hidden,true);
});
test('Handy bedankt sich nach einer neuen Begleichung erneut und entfernt den Hinweis beim Verbergen',async()=>{
 const f=await fixture();f.data.balance=150;await f.reload();assert.equal(f.nodes.get('thanks').hidden,true);
 f.data.balance=0;await f.reload();assert.equal(f.nodes.get('thanks').hidden,false);
 f.ctx.document.hidden=true;f.events.visibilitychange();assert.equal(f.nodes.get('thanks').hidden,true);
 f.ctx.document.hidden=false;f.events.visibilitychange();await flush();assert.equal(f.nodes.get('thanks').hidden,true);assert.equal(f.nodes.get('account').hidden,false);
});

test('Aktualisieren hält den geprüften Kontostand sichtbar; Netzfehler zeigen Alter statt leerer Ansicht',async()=>{
 const f=await fixture();f.data.balance=450;await f.reload();const balance=f.nodes.get('balance').textContent;f.ctx.failedLoad=true;
 const loading=f.ctx.DeckelReload();assert.equal(f.nodes.get('account').hidden,false);await loading;assert.equal(f.nodes.get('balance').textContent,balance);assert.equal(f.nodes.get('account').hidden,false);assert.match(f.nodes.get('status').textContent,/Angezeigt bleibt der Stand/);assert.match(f.nodes.get('status').textContent,/Verbindung prüfen/);
 f.ctx.document.hidden=true;f.events.visibilitychange();assert.equal(f.nodes.get('account').hidden,true);assert.equal(f.nodes.get('balance').textContent,'');
});




test('Direkter Ladeversuch erscheint nach Netzfehler und verschwindet nach erfolgreicher Wiederholung',async()=>{
 const f=await fixture();assert.equal(f.nodes.get('deckel-load-retry').hidden,true);f.ctx.failedLoad=true;await f.reload();assert.equal(f.nodes.get('deckel-load-retry').hidden,false);f.ctx.failedLoad=false;await f.nodes.get('deckel-load-retry').onclick();await flush();assert.equal(f.nodes.get('deckel-load-retry').hidden,true);assert.equal(f.nodes.get('account').hidden,false);
});

test('Wiederaufnahme löst eine aktive alte Ladeansicht auch bei schon geladenem Kontostand neu auf',async()=>{
 const f=await fixture(),finished=[];let starts=0;f.ctx.DeckelStartup={isActive:()=>true,begin:()=>{starts++;return 55;},stage(){},finish:token=>finished.push(token)};
 await f.reload();assert.equal(starts,1);assert.ok(finished.includes(55));assert.equal(f.nodes.get('account').hidden,false);
});

test('Deckel ist eine reine Kontostandsanzeige ohne Tipp- oder Tastaturaktion',async()=>{
 const f=await fixture();await f.reload();assert.equal(f.nodes.get('coaster').onclick,undefined);assert.equal(f.nodes.get('coaster').onkeydown,undefined);assert.equal(f.nodes.get('account').hidden,false);assert.ok(f.nodes.get('balance').textContent);
});
