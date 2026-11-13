const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const source=fs.readFileSync(require.resolve('../js/core/cloud-sync.js'),'utf8');
function store(seed={}){const values=new Map(Object.entries(seed));return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),values};}
function setup({legacy=false}={}){
 const member={id:'synthetic',firstName:'Anna',lastName:'Beispiel'},initial={members:[member],entries:[],careerCatalog:[],roleTargets:{},functionEntryEnabled:true,updatedAt:'2026-11-13T10:00:00Z',legacyArchive:[]},local=store(legacy?{'fw_onedrive_state_dirty':'1','fw_onedrive_state_base':JSON.stringify({source:'drive:root',updatedAt:initial.updatedAt})}:{'fw_cloud_state_base':JSON.stringify({source:'drive:root',version:1})});
 let remote=structuredClone(initial),version=1,writes=0,choice='cancel',choices=0,onRead,onWrite;const files=new Map(),events=[];
 const c=vm.createContext({localStorage:local,sessionStorage:store(),safeStorage:local,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Blob,Response,Headers,JSON,Date,navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},members:structuredClone(initial.members),entries:[],csvArchive:[],careerCatalog:[],KEYS:{members:'fw_members',entries:'fw_entries',careerCatalog:'fw_courses',functionEntry:'fw_function',roleTargets:'fw_targets'},byId:()=>null,addEventListener(){},showToast(){}});c.window=c;c.CloudStorage={connected:true,source:'drive:root',legacyArchive:[],ensureFresh:async()=>true,readState:async()=>{if(onRead)await onRead();return {value:structuredClone(remote),version};},writeState:async(value,expected)=>{writes++;const captured=structuredClone(value);if(onWrite)await onWrite();if(expected!==version)throw Object.assign(Error('CAS conflict'),{status:409});remote=captured;return {version:++version};},root:()=>({driveId:'drive',id:'root'}),ensureFolder:async()=>{},writeFile:async(path,bytes)=>{files.set(path,bytes);return {version:1};},stat:async()=>({version:1}),readFile:async path=>files.get(path),digest:async bytes=>createHash('sha256').update(bytes).digest('hex')};c.loadOneDriveHistory=async()=>{events.push('history');return true;};vm.runInContext(source,c);c.cloudConflictChoice=async()=>{choices++;return choice;};
 return {c,local,files,events,get remote(){return remote;},get version(){return version;},get writes(){return writes;},get choices(){return choices;},choice:value=>choice=value,read:fn=>onRead=fn,write:fn=>onWrite=fn,update:fn=>{fn(remote);version++;}};
}
test('Cloud sync first loads confirmed state/history without Microsoft; unknown state fields survive later edits',async()=>{
 const f=setup();f.update(value=>value.additional={must:'remain'});assert.equal(await f.c.syncOneDrive({refreshHistory:true}),true);assert.equal(f.c.oneDriveAdministrationReady(),true);assert.equal(vm.runInContext('oneDriveStartupConfirmed',f.c),true);assert.equal(f.writes,0);assert.deepEqual(f.events,['history']);f.c.members[0].firstName='Changed';f.c.scheduleCloudSync();assert.equal(await f.c.syncOneDrive(),true);assert.equal(f.remote.additional.must,'remain');assert.equal(f.remote.members[0].firstName,'Changed');
});
test('Unsynced iPad changes with an unchanged legacy baseline are checkpointed, then carried forward',async()=>{
 const f=setup({legacy:true});f.c.members[0].firstName='Unsynced';assert.equal(await f.c.syncOneDrive(),true);assert.equal(f.choices,0);assert.equal(f.writes,1);assert.equal(f.remote.members[0].firstName,'Unsynced');assert.equal(f.files.size,1);const saved=JSON.parse(new TextDecoder().decode([...f.files.values()][0]));assert.equal(saved.value.members[0].firstName,'Unsynced');
});
test('Divergent iPad/cloud data never silently overwrites; both cancel and remote choice retain the checkpoint',async()=>{
 const f=setup({legacy:true});f.c.members[0].firstName='Local';f.update(value=>{value.members[0].firstName='Cloud';value.updatedAt='2026-11-13T11:00:00Z';});assert.equal(await f.c.syncOneDrive(),false);assert.equal(f.remote.members[0].firstName,'Cloud');assert.equal(f.c.members[0].firstName,'Local');assert.equal(f.writes,0);assert.equal(f.files.size,1);
 f.choice('remote');assert.equal(await f.c.syncOneDrive(),true);assert.equal(f.c.members[0].firstName,'Cloud');assert.equal(f.writes,0);assert.equal(f.choices,2);
});
test('A new edit during read or write stays dirty, never vanishes, and is saved by the next sync',async()=>{
 const f=setup();await f.c.syncOneDrive();f.c.members[0].firstName='First';f.c.scheduleCloudSync();let once=true;f.write(async()=>{if(once){once=false;f.c.members[0].firstName='Second';f.c.scheduleCloudSync();}});await f.c.syncOneDrive();assert.equal(f.remote.members[0].firstName,'First');assert.equal(f.c.members[0].firstName,'Second');assert.equal(f.local.getItem('fw_cloud_state_dirty'),'1');await f.c.syncOneDrive();assert.equal(f.remote.members[0].firstName,'Second');assert.equal(f.local.getItem('fw_cloud_state_dirty'),'0');
});
test('Lost response is recognized from matching state rather than duplicating or prompting a false conflict',async()=>{
 const f=setup();await f.c.syncOneDrive();f.c.members[0].firstName='Changed';f.c.scheduleCloudSync();let once=true;const save=f.c.CloudStorage.writeState;f.c.CloudStorage.writeState=async(...args)=>{const result=await save(...args);if(once){once=false;throw new TypeError('network response lost');}return result;};assert.equal(await f.c.syncOneDrive(),false);assert.equal(f.writes,1);assert.equal(await f.c.syncOneDrive(),true);assert.equal(f.writes,1);assert.equal(f.choices,0);
});
test('Revocation during a response prevents late data from becoming available',async()=>{
 const f=setup();f.read(async()=>{f.c.CloudStorage.connected=false;f.c.endOneDriveSession();});assert.equal(await f.c.syncOneDrive(),false);assert.equal(f.c.oneDriveAdministrationReady(),false);assert.equal(f.writes,0);assert.deepEqual(f.events,[]);
});
test('Verified Cloudflare source identity is available before the first asynchronous account-folder lookup',()=>{
 const c=vm.createContext({DrinksModel:{},CloudStorage:{connected:true,source:'a1b2c3d4e5f60718:root'},TextEncoder,crypto:webcrypto});
 vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-store.js'),'utf8'),c);
 assert.equal(c.DrinksStore.sourceKey(),'a1b2c3d4e5f60718:root');c.CloudStorage.connected=false;assert.equal(c.DrinksStore.sourceKey(),'');
});

test('Confirmed Cloudflare handover retires old settings but preserves enrollment and application data',async()=>{
 const f=setup({legacy:true}),scope=JSON.stringify(['old-client','old-folder']);
 for(const store of [f.local,f.c.sessionStorage])for(const key of ['tokens','pkce','client_id','shared_folder_url','verified_root','silent_retry','last_sync','local_updated'])store.setItem('fw_onedrive_'+key,key);
 f.local.setItem('fw_onedrive_client_id','old-client');f.local.setItem('fw_onedrive_shared_folder_url','old-folder');
 f.local.setItem('fw_v1_attendance_draft',JSON.stringify({source:scope,topic:'Keep draft',pending:[['synthetic','Anwesend']]}));
 f.local.setItem('fw_setup_completed_v1',scope);f.local.setItem('fw_cloud_device_v1','active-device');f.local.setItem('fw_members','keep-members');
 let sanitized=0;f.c.sanitizeSafetySnapshots=()=>sanitized++;
 assert.equal(await f.c.syncOneDrive({refreshHistory:true}),true);
 assert.equal([...f.local.values.keys()].some(key=>key.startsWith('fw_onedrive_')),false);
 assert.equal([...f.c.sessionStorage.values.keys()].some(key=>key.startsWith('fw_onedrive_')),false);
 assert.equal(f.local.getItem('fw_microsoft_client_id'),'old-client');assert.equal(f.local.getItem('fw_cloud_device_v1'),'active-device');assert.equal(JSON.parse(f.local.getItem('fw_members'))[0].id,'synthetic');
 const draft=JSON.parse(f.local.getItem('fw_v1_attendance_draft'));assert.equal(draft.source,'drive:root');assert.equal(draft.topic,'Keep draft');assert.equal(draft.pending.length,1);
 assert.equal(f.local.getItem('fw_setup_completed_v1'),'drive:root');assert.equal(sanitized,1);
});
test('Failed history or unrecognized draft scope keeps legacy migration settings',async()=>{
 const f=setup({legacy:true});f.local.setItem('fw_onedrive_client_id','old-client');f.c.loadOneDriveHistory=async()=>false;
 assert.equal(await f.c.syncOneDrive({refreshHistory:true}),false);assert.equal(f.local.getItem('fw_onedrive_client_id'),'old-client');assert.ok(f.local.getItem('fw_onedrive_state_base'));
 f.c.loadOneDriveHistory=async()=>true;f.local.setItem('fw_v1_attendance_draft',JSON.stringify({source:JSON.stringify(['old-client','']),topic:'Pending'}));
 f.local.setItem('fw_onedrive_state_base',JSON.stringify({source:'other:folder'}));
 assert.equal(await f.c.syncOneDrive({refreshHistory:true}),true);assert.equal(f.local.getItem('fw_onedrive_client_id'),'old-client');assert.equal(JSON.parse(f.local.getItem('fw_v1_attendance_draft')).topic,'Pending');
});

test('Local changes made while history loads defer retirement until the next confirmed sync',async()=>{
 const f=setup();f.local.setItem('fw_onedrive_client_id','keep-until-confirmed');let once=true;
 f.c.loadOneDriveHistory=async()=>{if(once){once=false;f.c.members[0].firstName='Pending edit';f.c.scheduleCloudSync();}return true;};
 await f.c.syncOneDrive({refreshHistory:true});assert.equal(f.local.getItem('fw_onedrive_client_id'),'keep-until-confirmed');
 await f.c.syncOneDrive({refreshHistory:true});assert.equal(f.local.getItem('fw_onedrive_client_id'),null);assert.equal(f.remote.members[0].firstName,'Pending edit');
});

for(const microsoft of [false,true])test('Startup checks a remembered device once and reuses Microsoft confirmation: '+microsoft,async()=>{
 const f=setup();let checks=0;f.c.CloudStorage.connected=false;f.c.CloudStorage.bootstrap=async()=>{checks++;f.c.CloudStorage.connected=true;return true;};f.c.MicrosoftConnection={finish:async()=>{if(microsoft)f.c.CloudStorage.connected=true;return microsoft;}};f.c.document={addEventListener(){}};f.c.ensureOneDriveUi=()=>{};
 await f.c.initCloudSync();assert.equal(checks,microsoft?0:1);assert.equal(f.c.oneDriveAdministrationReady(),true);assert.deepEqual(f.events,['history']);
});
