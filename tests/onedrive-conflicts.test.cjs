const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/core/onedrive-sync.js'),'utf8');
function fixture(){
 const store=new Map(),calls=[];
 const c=vm.createContext({window:{},navigator:{onLine:true},Headers,localStorage:{getItem:k=>store.get(k)||'',setItem:(k,v)=>store.set(k,v)},console:{error(){}},setTimeout:()=>1,clearTimeout(){},members:[{id:'synthetic-member'}],entries:[],csvArchive:[],byId:()=>null});
 vm.runInContext(source,c);
 Object.assign(c,{oneDriveResolveSharedRoot:async()=>({driveId:'test-drive',id:'test-root'}),oneDriveSignedIn:()=>true,oneDriveStatus(){},renderOneDriveDialog(){},applyOneDrivePayload(){throw Error('must preserve local data');},odFetch:async(url,options={})=>{calls.push({url,options});if(url.endsWith('/content')&&options.method==='PUT')return {json:async()=>({eTag:'new'})};if(url.endsWith('/content'))return {json:async()=>({members:[],entries:[],updatedAt:'2026-10-21T10:00:00Z'})};return {json:async()=>({id:'state-file',eTag:'v1'})};}});
 return {c,store,calls};
}
test('OneDrive-Zustand wird konsistent gelesen und ausschließlich mit erwarteter Version geschrieben',async()=>{
 const f=fixture(),state=await f.c.oneDriveReadState({versioned:true});
 assert.equal(state.eTag,'v1');assert.match(state.url,/items\/state-file$/);
 assert.equal(f.calls[1].options.headers['If-Match'],'v1');
 await f.c.oneDriveWriteState(state);
 const write=f.calls.at(-1);assert.equal(write.options.method,'PUT');assert.equal(write.options.headers['If-Match'],'v1');
 assert.ok(!JSON.parse(write.options.body).eTag);
});
test('Geänderte Dateiversion während des Lesens wird verworfen',async()=>{
 const f=fixture();let n=0;f.c.odFetch=async(url)=>({json:async()=>url.endsWith('/content')?{members:[],entries:[]}:({id:'state-file',eTag:++n===1?'v1':'v2'})});
 await assert.rejects(f.c.oneDriveReadState({versioned:true}),e=>e.status===412);
});
test('Konflikt und ungewisser Schreibausgang bestätigen keine Speicherung und bewahren lokale Daten',async()=>{
 for(const status of [412,503]){
  const f=fixture();f.c.scheduleCloudSync();f.c.odFetch=async(url,options={})=>{
   if(options.method==='PUT')throw Object.assign(Error('test-write-error'),{status});
   return {json:async()=>url.endsWith('/content')?{members:[],entries:[],updatedAt:'2020-01-01'}:{id:'state-file',eTag:'v1'}};
  };
  await f.c.syncOneDrive();assert.equal(f.c.getAppStorageState().kind,'error');assert.equal(f.c.members[0].id,'synthetic-member');assert.equal(f.store.get('fw_onedrive_state_dirty'),'1');
 }
});
test('Nach Neustart verhindert die gespeicherte Basis das Überschreiben paralleler Änderungen',async()=>{
 const f=fixture();f.store.set('fw_onedrive_state_dirty','1');f.store.set('fw_onedrive_local_updated','2099-01-01');
 f.store.set('fw_onedrive_state_base',JSON.stringify({source:'test-drive:test-root',updatedAt:'2026-10-20'}));
 await f.c.syncOneDrive();assert.equal(f.c.getAppStorageState().kind,'error');assert.equal(f.calls.some(x=>x.options.method==='PUT'),false);assert.equal(f.c.members[0].id,'synthetic-member');
});
test('Erstmaliges Anlegen verwendet die bestehende projektspezifische Nullversion statt blindem Überschreiben',async()=>{
 const f=fixture();await f.c.oneDriveWriteState(null);assert.equal(f.calls.at(-1).options.headers['If-Match'],'"0"');
});
test('Verlorene PUT-Antwort wird anhand identischen Inhalts bestätigt, ohne zweiten Schreibvorgang',async()=>{
 const f=fixture();let disk={schemaVersion:3,members:[],entries:[],updatedAt:'2020-01-01'},writes=0;
 f.c.applyOneDrivePayload=data=>{f.c.members=data.members;f.c.entries=data.entries;};
 f.c.odFetch=async(url,options={})=>{
  if(options.method==='PUT'){writes++;disk=JSON.parse(options.body);throw new TypeError('lost-response');}
  return {json:async()=>url.endsWith('/content')?disk:{id:'state-file',eTag:'v'+writes}};
 };
 f.c.scheduleCloudSync();await f.c.syncOneDrive();assert.equal(f.c.getAppStorageState().kind,'error');assert.equal(writes,1);
 await f.c.syncOneDrive();assert.equal(f.c.getAppStorageState().kind,'cloud');assert.equal(writes,1);assert.equal(f.store.get('fw_onedrive_state_dirty'),'0');
});


test('Startfreigabe wartet auf Daten UND Historie und bleibt bei Fehler gesperrt',async()=>{
 for(const historyOk of [false,true]){
  const f=fixture(),states=[];let finish;
  f.c.window.AppStartup={update:state=>states.push({...state})};
  f.c.applyOneDrivePayload=()=>{};
  f.c.window.loadOneDriveHistory=()=>new Promise(resolve=>{finish=()=>resolve(historyOk);});
  const syncing=f.c.syncOneDrive({refreshHistory:true});
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(states.at(-1).ready,false,'data alone is insufficient');
  finish();await syncing;
  assert.equal(states.at(-1).ready,historyOk);
  if(historyOk){f.c.scheduleCloudSync();assert.equal(states.at(-1).ready,true,'editing does not reopen the start screen');}
 }
});
test('Ein späterer erfolgreicher vollständiger Abruf gibt die Startansicht frei',async()=>{
 const f=fixture(),states=[];f.c.window.AppStartup={update:state=>states.push({...state})};f.c.applyOneDrivePayload=()=>{};
 f.c.window.loadOneDriveHistory=async()=>false;await f.c.syncOneDrive({refreshHistory:true});assert.equal(states.at(-1).ready,false);
 f.c.window.loadOneDriveHistory=async()=>true;await f.c.syncOneDrive({refreshHistory:true});assert.equal(states.at(-1).ready,true);
});

test('Startstatus verwendet die tatsächlichen OneDrive-Phasen',()=>{
 const states=[],c=vm.createContext({window:{AppStartup:{update:state=>states.push(state)}},navigator:{onLine:true},localStorage:{getItem:()=>'{"access_token":"synthetic"}'},byId:()=>null});
 vm.runInContext(source,c);
 for(const [label,expected] of [['Verbindet','OneDrive-Anmeldung'],['Synchronisiert','Gemeinsame Daten'],['Lädt Historie','Berichte und Historie']]){
  c.oneDriveStatus(label,'syncing');assert.ok(states.at(-1).stage.startsWith(expected));assert.equal(states.at(-1).ready,false);
 }
});
