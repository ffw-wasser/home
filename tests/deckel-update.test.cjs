const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture(options={}){const nodes={'deckel-pull-refresh':{hidden:true,textContent:''}},events={},calls=[];let reloads=0,unsaved=false;const ctx=vm.createContext({Date,URL,AbortSignal,DeckelActions:{hasUnsaved:()=>unsaved},H2OPortal:{hasUnsaved:()=>options.portalPending===true},document:{readyState:'loading',hidden:false,getElementById:id=>nodes[id],querySelector:()=>null,addEventListener:(k,fn)=>events[k]=fn},AppRelease:{error:'',check:async()=>options.offline?'':options.build==='20261013.9'?'':'20261013.10',apply:async({guard})=>{ctx.AppRelease.error=guard();if(ctx.AppRelease.error)return false;reloads++;return true;}}});vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/deckel-update.js'),'utf8'),ctx);events.DOMContentLoaded();return {nodes,ctx,events,calls,get reloads(){return reloads;},unsaved:v=>unsaved=v};}
test('Kein Update-Hinweis beim Initialisieren oder einer stillen Prüfung',async()=>{const f=await fixture();assert.equal(f.reloads,0);assert.equal(await f.ctx.DeckelUpdate.check(),true);assert.equal(f.nodes['deckel-pull-refresh'].hidden,true);});
test('Vorgemerkte oder unbestätigte Aktionen verhindern den Versionswechsel',async()=>{const f=await fixture();f.unsaved(true);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,0);assert.match(f.nodes['deckel-pull-refresh'].textContent,/zuerst speichern/);f.unsaved(false);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,1);});
test('Unbestätigte Portal-Rückmeldung verhindert Versionswechsel',async()=>{const f=await fixture({portalPending:true});await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,0);assert.match(f.nodes['deckel-pull-refresh'].textContent,/Termin-Rückmeldungen/);});
test('Offene Theaterbestellung wird richtig erklärt',async()=>{const f=await fixture({portalPending:true});f.ctx.TheaterPhone={hasUnsaved:()=>true};await f.ctx.DeckelUpdate.refresh();assert.match(f.nodes['deckel-pull-refresh'].textContent,/Theater:/);assert.doesNotMatch(f.nodes['deckel-pull-refresh'].textContent,/Termin-Rückmeldungen/);});

test('Ein Aktualisieren lädt bei aktueller Version oder Offline-Prüfung die Daten ohne Seitenwechsel',async()=>{
 for(const options of [{build:'20261013.9'},{offline:true}]){
  const f=await fixture(options);let dataLoads=0;f.ctx.DeckelReload=async()=>dataLoads++;
  f.unsaved(true);await f.ctx.DeckelUpdate.refresh();
  assert.equal(dataLoads,1);assert.equal(f.reloads,0);assert.equal(f.ctx.DeckelUpdate.isRefreshing(),false);
 }
});
test('Ein Aktualisieren übernimmt eine neue Version und verhindert dabei Datenverlust',async()=>{
 const f=await fixture();let dataLoads=0;f.ctx.DeckelReload=async()=>dataLoads++;
 f.unsaved(true);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,0);assert.equal(dataLoads,0);
 f.unsaved(false);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,1);assert.equal(dataLoads,0);
});

test('Manuelle Aktualisierung wartet zehn Sekunden nach Abschluss und startet nie parallel',async()=>{
 const f=await fixture({build:'20261013.9'});vm.runInContext('let testNow=100000;Date.now=()=>testNow;',f.ctx);
 let loads=0,release;f.ctx.DeckelReload=async()=>{loads++;await new Promise(resolve=>release=resolve);};
 const first=f.ctx.DeckelUpdate.refresh();await flush();assert.equal(loads,1);
 vm.runInContext('testNow+=30000',f.ctx);await f.ctx.DeckelUpdate.refresh();assert.equal(loads,1);
 release();await first;await f.ctx.DeckelUpdate.refresh();assert.equal(loads,1,'cooldown starts after completion');
 vm.runInContext('testNow+=9999',f.ctx);await f.ctx.DeckelUpdate.refresh();assert.equal(loads,1);
 vm.runInContext('testNow+=1',f.ctx);f.ctx.DeckelReload=async()=>loads++;await f.ctx.DeckelUpdate.refresh();assert.equal(loads,2);
});
