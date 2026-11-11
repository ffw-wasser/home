const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/year-plan.js','utf8');
const tick=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(portal=false){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'0',classList:{toggle(){},remove(){}}});return nodes.get(id);};
 let allowed=true,currentSource='synthetic-source',request;const calls=[],paints=[];
 const c=vm.createContext({Intl,Date,portal,year:2026,events:[],generation:0,privateData:false,loaded:false,loadedYear:null,source:'',message:'',colors:{},$:get,dayKey:ms=>new Date(ms).toISOString().slice(0,10),format:ms=>String(ms),authorized:()=>allowed,accessCurrent:()=>allowed&&(portal||c.source===currentSource),render:()=>paints.push({year:c.year,titles:Array.from(c.events,e=>e.title),loaded:c.loaded,message:c.message}),jump(){},openPdf:async()=>{},document:{getElementById:()=>null},g:{CalendarPresentation:{defaults:()=>({})},DrinksStore:{sourceKey:()=>currentSource},DrinksCentral:{connection:async()=>({source:currentSource})},DrinksPush:{request:async(_c,_path,data)=>{calls.push(data);return request(data);}},H2OPortal:{api:async(_path,data)=>{calls.push(data);return request(data);}}}});
 vm.runInContext(source.slice(source.indexOf(' async function load('),source.indexOf(' function afterView(')),c);
 return {c,calls,paints,get,setRequest:fn=>request=fn,deny:()=>allowed=false,changeSource:()=>currentSource='other-source'};
}
const result=(year=2026,title='Vorhandener Termin',extra={})=>({year,configured:true,events:[{title,start:Date.parse(year+'-06-15T12:00Z'),end:Date.parse(year+'-06-15T13:00Z')}],...extra});
for(const portal of [false,true]){
 test(`Jahresplan zeigt gespeicherte Termine vor dem langsamen Google-Abgleich, Portal=${portal}`,async()=>{
  const f=fixture(portal),gate=deferred();f.setRequest(data=>data.background?result(2026,'Gespeichert',{refreshing:true,stale:true}):gate.promise);
  const load=f.c.load();await tick();assert.equal(f.calls.length,2);assert.equal(f.calls[0].background,true);assert.equal(f.calls[1].background,false);
  assert.deepEqual(Array.from(f.c.events,e=>e.title),['Gespeichert']);assert.match(f.get('status').textContent,/Google-Kalender wird aktualisiert/);
  gate.resolve(result(2026,'Neu von Google'));await load;assert.deepEqual(Array.from(f.c.events,e=>e.title),['Neu von Google']);
 });
 test(`Aktualisieren behält den Stand bei Netzfehler, Portal=${portal}`,async()=>{
  const f=fixture(portal);f.setRequest(()=>result());await f.c.load();const gate=deferred();f.setRequest(()=>gate.promise);
  const load=f.c.load();await tick();assert.equal(f.c.loaded,true);assert.equal(f.c.events.length,1);
  gate.reject(Error('Synthetischer Netzfehler'));await load;assert.equal(f.c.events.length,1);assert.match(f.get('status').textContent,/Zuletzt geladene Termine/);
 });
 test(`Jahreswechsel ignoriert die verspätete Antwort des alten Jahres, Portal=${portal}`,async()=>{
  const f=fixture(portal),gate=deferred();f.setRequest(data=>data.year===2026?gate.promise:result(2027,'Neues Jahr'));
  const old=f.c.load();await tick();f.c.year=2027;await f.c.load();gate.resolve(result(2026,'Altes Jahr'));await old;
  assert.equal(f.c.loadedYear,2027);assert.deepEqual(Array.from(f.c.events,e=>e.title),['Neues Jahr']);
 });
 test(`Abmeldung während Google lädt entfernt den gespeicherten Stand, Portal=${portal}`,async()=>{
  const f=fixture(portal),gate=deferred();f.setRequest(data=>data.background?result(2026,'Gespeichert',{refreshing:true}):gate.promise);
  const load=f.c.load();await tick();assert.equal(f.c.events.length,1);f.deny();f.c.lock();gate.resolve(result());await load;assert.equal(f.c.events.length,0);assert.equal(f.c.loaded,false);
 });
 test(`Serverseitige Zugriffssperre verwirft auch vorhandene Termine, Portal=${portal}`,async()=>{
  const f=fixture(portal);f.setRequest(()=>result());await f.c.load();f.setRequest(()=>{throw Object.assign(Error('Zugang gesperrt'),{status:403});});
  await f.c.load();assert.equal(f.c.events.length,0);assert.equal(f.c.loaded,false);
 });
}
test('Datenordnerwechsel verhindert die Übernahme des alten Google-Abrufs',async()=>{
 const f=fixture(),gate=deferred();f.setRequest(data=>data.background?result(2026,'Gespeichert',{refreshing:true}):gate.promise);
 const load=f.c.load();await tick();f.changeSource();gate.resolve(result());await load;assert.equal(f.c.events.length,0);assert.equal(f.c.loaded,false);
});
