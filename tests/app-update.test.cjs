const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/app/app-update.js'),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture(options={}){
 const nodes=Object.fromEntries(['app-update-banner','app-update-message','app-update-now','app-update-check'].map(id=>[id,{hidden:true,textContent:'',disabled:false}]));
 const events={},calls=[],target=new EventTarget();let reloads=0,swUpdates=0;
 const c=vm.createContext({Date,URL,AbortSignal,Event,console,currentSessionId:'',currentOperationId:'',oneDriveBusy:false,
  navigator:{serviceWorker:{getRegistration:async()=>({update:async()=>swUpdates++})}},
  location:{href:'https://example.test/home/index.html#local-fragment',replace(url){const u=new URL(url);assert.equal(u.hash,'#local-fragment');assert.ok(u.searchParams.has('_ffw_refresh'));reloads++;}},
  addEventListener:(k,f)=>{events[k]=f;target.addEventListener(k,f);},dispatchEvent:e=>target.dispatchEvent(e),setInterval:f=>events.interval=f,
  document:{hidden:false,readyState:'loading',getElementById:id=>nodes[id],querySelector:s=>s.startsWith('meta')?{content:'20261022.6'}:null,addEventListener:(k,f)=>events[k]=f},
  fetch:async(url,settings)=>{calls.push({url,settings});if(options.offline)throw Error('offline');if(url.startsWith('index.html')){options.duringDownload?.(c);return {ok:true,text:async()=>'<meta name="ffw-build" content="'+(options.htmlBuild||'20261022.7')+'"/>'};}return {ok:true,json:async()=>({build:options.remote||'20261022.7'})};}
 });
 vm.runInContext(source,c);events.DOMContentLoaded();await flush();
 return {nodes,c,events,calls,target,get reloads(){return reloads;},get swUpdates(){return swUpdates;}};
}
test('FFW: newer release is visible without reloading, credentials or private URLs',async()=>{
 const f=await fixture();assert.equal(f.nodes['app-update-banner'].hidden,false);assert.equal(f.nodes['app-update-now'].hidden,false);assert.equal(f.reloads,0);
 assert.equal(f.calls[0].settings.credentials,'omit');assert.equal(f.calls[0].settings.referrerPolicy,'no-referrer');assert.equal(f.calls[0].settings.cache,'no-store');assert.ok(!f.calls[0].url.includes('fragment'));
 await f.c.FFWUpdate.apply();assert.equal(f.reloads,1);assert.equal(f.swUpdates,1);
});
test('FFW: current, older, invalid and offline releases never trigger update',async()=>{
 for(const options of [{remote:'20261022.6'},{remote:'20261022.5'},{remote:'bad'},{offline:true}]){
  const f=await fixture(options);assert.equal(f.nodes['app-update-banner'].hidden,true);await f.c.FFWUpdate.apply();assert.equal(f.reloads,0);
 }
});
test('FFW: manual checks explain current version and network errors',async()=>{
 const current=await fixture({remote:'20261022.6'});await current.c.FFWUpdate.check(true);assert.match(current.nodes['app-update-message'].textContent,/neuesten Stand/);
 const offline=await fixture({offline:true});await offline.c.FFWUpdate.check(true);assert.match(offline.nodes['app-update-message'].textContent,/Internetverbindung/);assert.equal(offline.nodes['app-update-check'].disabled,false);
});
test('FFW: ongoing attendance, operations, cloud sync and theater changes block reload',async()=>{
 for(const [key,value] of [['currentSessionId','session-test'],['currentOperationId','operation-test'],['oneDriveBusy',true],['TheaterAdmin',{hasUnsaved:()=>true}]]){
  const f=await fixture();f.c[key]=value;await f.c.FFWUpdate.apply();assert.equal(f.reloads,0,key);assert.equal(f.swUpdates,0);
 }
});
test('FFW: existing unsaved-change guards block update without discarding edits',async()=>{
 const f=await fixture();const guard=e=>{e.preventDefault();e.returnValue='';};f.target.addEventListener('beforeunload',guard);
 await f.c.FFWUpdate.apply();assert.equal(f.reloads,0);assert.match(f.nodes['app-update-message'].textContent,/offene Änderungen/);
 f.target.removeEventListener('beforeunload',guard);await f.c.FFWUpdate.apply();assert.equal(f.reloads,1);
});
test('FFW: work started during downloading also blocks reload',async()=>{
 const f=await fixture({duringDownload:c=>c.currentSessionId='new-session'});await f.c.FFWUpdate.apply();assert.equal(f.reloads,0);assert.match(f.nodes['app-update-message'].textContent,/laufenden Termin/);
});
test('FFW: stale HTML during rollout and offline download do not reload',async()=>{
 const f=await fixture({htmlBuild:'20261022.6'});await f.c.FFWUpdate.apply();assert.equal(f.reloads,0);assert.match(f.nodes['app-update-message'].textContent,/bereitgestellt/);
});
test('FFW: hidden app pauses checks; return and network recovery resume checking',async()=>{
 const f=await fixture();let count=f.calls.length;f.c.document.hidden=true;f.events.interval();await flush();assert.equal(f.calls.length,count);
 f.c.document.hidden=false;for(const event of ['visibilitychange','online','pageshow']){f.events[event]();await flush();assert.ok(f.calls.length>count);count=f.calls.length;}
});
test('FFW: release comparison handles sequence 9 to 10 and year changes',async()=>{
 for(const remote of ['20261022.10','20270101.1']){const f=await fixture({remote});assert.equal(f.nodes['app-update-now'].hidden,false);}
});
