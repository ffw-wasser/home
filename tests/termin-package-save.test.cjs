const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/core/onedrive-sync.js'),'utf8');
function fixture({status=201,item,fail=false}={}){
 const calls=[],store=new Map([['share','synthetic-folder']]);let epoch=1,ready=true;
 const c=vm.createContext({Blob,URL,AbortController,oneDriveRequests:new Set(),oneDriveSessionEpoch:1,OD_SHARE_KEY:'share',localStorage:{getItem:k=>store.get(k)},odConfig:()=>({clientId:'synthetic'}),oneDriveAdministrationReady:()=>ready,assertOneDriveSession:e=>{if(e!==c.oneDriveSessionEpoch)throw Error('session ended');},oneDriveResolveSharedRoot:async()=>({id:'root',driveId:'drive'}),odEnsureFolder:async(p,n)=>{calls.push(['folder',n]);return n;},odFetch:async(u,o)=>{calls.push(['session',u,JSON.parse(o.body)]);if(fail)throw Error('existing name');return {json:async()=>({uploadUrl:'https://upload.example.invalid/session'})};},fetch:async(u,o)=>{calls.push(['upload',u,o]);return {ok:status<400,status,json:async()=>item||({id:'item',name:'FFW-Wasser_2026-10-23_Unterricht.zip',size:3,file:{}})};}});
 vm.runInContext(source.slice(source.indexOf('async function oneDriveUploadTerminPackage('),source.indexOf('async function oneDriveUploadReport(')),c);
 return {c,calls,save:blob=>c.oneDriveUploadTerminPackage(blob||new Blob(['ZIP']),'FFW-Wasser_2026-10-23_Unterricht.zip'),setReady:v=>ready=v,store};
}
test('Terminpaket wird erst nach bestätigter DriveItem-Antwort gespeichert, ohne Bearer an Upload-URL',async()=>{const f=fixture();const item=await f.save();assert.equal(item.id,'item');const session=f.calls.find(x=>x[0]==='session');assert.equal(session[2].item['@microsoft.graph.conflictBehavior'],'fail');const upload=f.calls.find(x=>x[0]==='upload');assert.equal(upload[2].headers['Content-Range'],'bytes 0-2/3');assert.equal(upload[2].headers.Authorization,undefined);assert.equal(f.c.oneDriveRequests.size,0);});
test('Upload ohne endgültige Bestätigung ist kein Erfolg',async()=>{for(const options of [{status:202},{status:409},{status:503},{item:{id:'wrong',file:{},size:1,name:'other.zip'}},{fail:true}])await assert.rejects(fixture(options).save());});
test('Abmeldung und Ordnerwechsel während des Uploads verhindern den Abschluss',async()=>{for(const change of [f=>f.c.oneDriveSessionEpoch++,f=>f.store.set('share','other'),f=>f.setReady(false)]){const f=fixture();f.c.fetch=async()=>{change(f);return {ok:true,status:201,json:async()=>({id:'item',file:{},size:3,name:'FFW-Wasser_2026-10-23_Unterricht.zip'})};};await assert.rejects(f.save());assert.equal(f.c.oneDriveRequests.size,0);}});
test('Große ZIPs verwenden 320-KiB-kompatible Teilstücke und bestätigen erst das letzte',async()=>{const f=fixture(),size=10*1024*1024+5;let n=0;f.c.fetch=async(u,o)=>{n++;return n===1?{ok:true,status:202}:{ok:true,status:201,json:async()=>({id:'item',file:{},size,name:'FFW-Wasser_2026-10-23_Unterricht.zip'})};};await f.save(new Blob([new Uint8Array(size)]));assert.equal(n,2);});

test('Ein eingeschränkter öffentlicher Kalender wird ohne private Empfängerliste nicht als allgemeine Probe exportiert',()=>{
 const source=fs.readFileSync(require.resolve('../js/features/portal/portal-admin.js'),'utf8'),start=source.indexOf('function selectedEvent(){'),end=source.indexOf(' function useSpontaneous()',start);
 const c=vm.createContext({list:[{id:'event',audienceRestricted:true}],replyData:null,chosen:()=> 'event'});vm.runInContext(source.slice(start,end),c);assert.equal(c.attendanceAudience().pending,true);c.replyData={event:{id:'event',recipientIds:['a']},stale:false};assert.deepEqual(Array.from(c.attendanceAudience().recipientIds),['a']);c.chosen=()=>null;assert.equal(c.attendanceAudience(),null);
});

test('Uploadvorbereitung verwendet den Dateinamen aus der URL und minimale Metadaten',async()=>{
 const f=fixture();f.c.odFetch=async(u,o)=>{
  const body=JSON.parse(o.body);
  assert.deepEqual(Object.keys(body.item),['@microsoft.graph.conflictBehavior']);
  assert.equal(body.item['@microsoft.graph.conflictBehavior'],'fail');assert.match(decodeURIComponent(u),/\/FFW-Wasser_2026-10-23_Unterricht\.zip:\/createUploadSession$/);
  return {json:async()=>({uploadUrl:'https://upload.example.invalid/session'})};
 };assert.equal((await f.save()).id,'item');
});
test('Graph-Fehler nennt den Speicherschritt und bestätigt keinen Abschluss',async()=>{
 for(const stage of ['Berichtsordner prüfen','Terminordner prüfen','Dateiübertragung vorbereiten']){
  const f=fixture();f.c.odEnsureFolder=async(p,name)=>{if((name==='Berichte'&&stage==='Berichtsordner prüfen')||(name==='Terminpakete'&&stage==='Terminordner prüfen'))throw Object.assign(Error('OneDrive-Fehler 400'),{status:400});return name;};
  f.c.odFetch=async()=>{throw Object.assign(Error('OneDrive-Fehler 400'),{status:400});};
  await assert.rejects(f.save(),e=>e.status===400&&e.message.includes(stage)&&e.message.includes('400'));
  assert.equal(f.calls.filter(c=>c[0]==='upload').length,0);
 }
});
