const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture(options={}){const nodes=Object.fromEntries(['deckel-update-banner','deckel-update-message','deckel-update-now','refresh'].map(id=>[id,{hidden:true,textContent:''}])),events={},calls=[];let reloads=0,unsaved=false;const ctx=vm.createContext({Date,URL,AbortSignal,location:{href:'https://example.test/deckel.html#private-access',hash:'#private-access',replace:url=>{const target=new URL(url);assert.equal(target.hash,'#private-access');assert.ok(target.searchParams.has('_h2o_refresh'));assert.ok(!target.search.includes('private'));reloads++;}},DeckelActions:{hasUnsaved:()=>unsaved},H2OPortal:{hasUnsaved:()=>options.portalPending===true},setInterval:fn=>events.interval=fn,document:{readyState:'loading',hidden:false,getElementById:id=>nodes[id],querySelector:()=>({content:'20261013.9'}),addEventListener:(k,fn)=>events[k]=fn},fetch:async(url,settings)=>{calls.push({url,settings});if(options.offline)throw Error('Offline');return {ok:true,json:async()=>({build:options.build||'20261013.10'})};}});vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/deckel-update.js'),'utf8'),ctx);events.DOMContentLoaded();await flush();return {nodes,ctx,events,calls,get reloads(){return reloads;},unsaved:v=>unsaved=v};}
test('Neue Ansicht wird erkannt; Versionsabfrage sendet weder privaten Hash noch Anmeldedaten',async()=>{const f=await fixture();assert.equal(f.nodes['deckel-update-banner'].hidden,false);assert.ok(f.calls[0].url.startsWith('app-release.json?'));assert.ok(!f.calls[0].url.includes('private'));assert.equal(f.calls[0].settings.credentials,'omit');assert.equal(f.calls[0].settings.referrerPolicy,'no-referrer');f.nodes['deckel-update-now'].onclick();assert.equal(f.reloads,1);assert.equal(f.ctx.location.hash,'#private-access');});
test('Vorgemerkte oder unbestätigte Aktionen verhindern das Neuladen der Oberfläche',async()=>{const f=await fixture();f.unsaved(true);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,0);assert.match(f.nodes['deckel-update-message'].textContent,/zuerst speichern/);f.unsaved(false);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,1);});
test('Aktuelle Ansicht und fehlende Internetverbindung zeigen keinen falschen Update-Hinweis',async()=>{for(const options of [{build:'20261013.9'},{build:'20261013.8'},{build:'invalid'},{offline:true}]){const f=await fixture(options);assert.equal(f.nodes['deckel-update-banner'].hidden,true);const count=f.calls.length;f.ctx.document.hidden=true;f.events.interval();assert.equal(f.calls.length,count);}});

test('Unbestätigte Portal-Rückmeldung verhindert Versionswechsel',async()=>{const f=await fixture({portalPending:true});await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,0);assert.match(f.nodes['deckel-update-message'].textContent,/Termin-Rückmeldungen/);});

test('Wiederöffnen ersetzt einen alten Sperrhinweis auch ohne Netz',async()=>{const f=await fixture({offline:true});f.unsaved(true);f.nodes['deckel-update-now'].onclick();assert.match(f.nodes['deckel-update-message'].textContent,/zuerst speichern/);f.events.visibilitychange();await flush();assert.doesNotMatch(f.nodes['deckel-update-message'].textContent,/zuerst speichern/);assert.equal(f.reloads,0);});
test('Offene Theaterbestellung wird als Theater statt als Getränkebuchung erklärt',async()=>{const f=await fixture({portalPending:true});f.ctx.TheaterPhone={hasUnsaved:()=>true};await f.ctx.DeckelUpdate.refresh();assert.match(f.nodes['deckel-update-message'].textContent,/Theater:/);assert.doesNotMatch(f.nodes['deckel-update-message'].textContent,/Termin-Rückmeldungen/);assert.equal(f.reloads,0);});

test('Ein Aktualisieren lädt bei aktueller Version oder Offline-Prüfung die Daten ohne Seitenwechsel',async()=>{
 for(const options of [{build:'20261013.9'},{offline:true}]){
  const f=await fixture(options);let dataLoads=0;f.ctx.DeckelReload=async()=>dataLoads++;
  f.unsaved(true);await f.ctx.DeckelUpdate.refresh();
  assert.equal(dataLoads,1);assert.equal(f.reloads,0);assert.equal(f.nodes.refresh.disabled,false);
 }
});
test('Ein Aktualisieren übernimmt eine neue Version und verhindert dabei Datenverlust',async()=>{
 const f=await fixture();let dataLoads=0;f.ctx.DeckelReload=async()=>dataLoads++;
 f.unsaved(true);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,0);assert.equal(dataLoads,0);
 f.unsaved(false);await f.ctx.DeckelUpdate.refresh();assert.equal(f.reloads,1);assert.equal(dataLoads,0);
});
