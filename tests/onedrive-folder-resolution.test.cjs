const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(require.resolve('../js/core/onedrive-sync.js'), 'utf8');
const token = sub => ({access_token:'TEST-TOKEN',obtained_at:Date.now(),expires_in:3600,
  id_token:'a.'+Buffer.from(JSON.stringify({iss:'test-issuer',sub})).toString('base64url')+'.b'});
const folder = {id:'test-folder',name:'Testordner',folder:{},parentReference:{driveId:'test-drive'}};
function fixture(local = new Map()) {
  if (!local.size) {
    local.set('fw_onedrive_client_id','test-client');
    local.set('fw_onedrive_shared_folder_url','https://example.test/old-share');
    local.set('fw_onedrive_tokens',JSON.stringify(token('test-account')));
  }
  const calls=[];
  const storage = map => ({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
  const c=vm.createContext({window:{},console,URL,URLSearchParams,Headers,AbortController,
    crypto:webcrypto,TextEncoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,
    localStorage:storage(local),sessionStorage:storage(new Map()),navigator:{onLine:true},
    fetch:async(url,options)=>{calls.push({url,options});return f.respond(url,options);}});
  const f={c,local,calls,respond:()=>new Response(JSON.stringify(folder)),run:s=>vm.runInContext(s,c)};
  vm.runInContext(source,c);return f;
}
function errorResponse(status) {return new Response(JSON.stringify({error:{code:'itemNotFound'}}),{status});}

test('Nach Linkentfernung und Neustart wird der bekannte Ordner authentifiziert erneut geprüft',async()=>{
  let f=fixture();await f.c.oneDriveResolveSharedRoot();assert.match(f.calls[0].url,/\/shares\//);
  f=fixture(f.local);
  f.respond=url=>url.includes('/shares/')?errorResponse(404):new Response(JSON.stringify(folder));
  const root=await f.c.oneDriveResolveSharedRoot();assert.equal(root.id,folder.id);
  assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/\/drives\/test-drive\/items\/test-folder\?/);
  assert.equal(f.calls[0].options.headers.get('Authorization'),'Bearer TEST-TOKEN');
  assert.equal(f.calls[0].options.method,undefined);assert.equal(f.calls[0].options.headers.has('Prefer'),false);
  await f.c.oneDriveResolveSharedRoot();assert.equal(f.calls.length,1);
});

for(const change of ['account','client','link','corrupt-cache','no-identity'])test(`Ein ${change} übernimmt keinen alten Ordner`,async()=>{
  let f=fixture();await f.c.oneDriveResolveSharedRoot();
  if(change==='account')f.local.set('fw_onedrive_tokens',JSON.stringify(token('other-account')));
  if(change==='client')f.local.set('fw_onedrive_client_id','other-client');
  if(change==='link')f.local.set('fw_onedrive_shared_folder_url','https://example.test/new-share');
  if(change==='corrupt-cache')f.local.set('fw_onedrive_verified_root','broken');
  if(change==='no-identity')f.local.set('fw_onedrive_tokens',JSON.stringify({...token('test-account'),id_token:''}));
  f=fixture(f.local);await f.c.oneDriveResolveSharedRoot();assert.match(f.calls[0].url,/\/shares\//);
});

for(const status of [403,404])test(`HTTP ${status} am bekannten Ordner wird nicht durch erneutes Einlösen der Freigabe umgangen`,async()=>{
  let f=fixture();await f.c.oneDriveResolveSharedRoot();f=fixture(f.local);f.respond=()=>errorResponse(status);
  await assert.rejects(f.c.oneDriveResolveSharedRoot(),e=>e.status===status&&e.code==='oneDriveFolderUnavailable'&&!e.message.includes('itemNotFound'));
  assert.equal(f.calls.length,1);assert.equal(f.run('oneDriveSharedRoot'),null);
  assert.doesNotMatch(f.calls[0].url,/\/shares\//);
});

test('Entfernter Link ohne geprüften Ordner erklärt die Konfiguration statt gelöschter Berichte',async()=>{
  const f=fixture();f.respond=()=>errorResponse(404);
  await assert.rejects(f.c.oneDriveResolveSharedRoot(),e=>e.code==='oneDriveFolderLinkInvalid'&&/Ordneradresse/.test(e.message));
  assert.equal(f.local.has('fw_onedrive_verified_root'),false);
});

for(const key of ['id','resid'])test(`Normale persönliche OneDrive-Adresse mit ${key} benötigt keine Freigabe`,async()=>{
  const f=fixture(),driveId='0123456789abcdef',id='0123456789ABCDEF!s1234';
  f.local.set('fw_onedrive_shared_folder_url',`https://onedrive.live.com/?cid=${driveId}&${key}=${encodeURIComponent(id)}`);
  f.respond=()=>new Response(JSON.stringify({...folder,id,parentReference:{driveId}}));
  assert.equal((await f.c.oneDriveResolveSharedRoot()).id,id);
  assert.equal(f.calls.length,1);assert.doesNotMatch(f.calls[0].url,/\/shares\//);
  assert.equal(f.calls[0].options.headers.get('Authorization'),'Bearer TEST-TOKEN');
});

test('Direkte Ordneradresse akzeptiert nur HTTPS, den Microsoft-Host und zusammenpassende Kennungen',()=>{
  const {c}=fixture(),query='?cid=0123456789abcdef&id=0123456789abcdef!s1234';
  for(const address of [
    'https://onedrive.live.com.evil.test/'+query,'https://onedrive.live.com@evil.test/'+query,
    'http://onedrive.live.com/'+query,'https://user:pass@onedrive.live.com/'+query,
    'https://onedrive.live.com:444/'+query,'https://onedrive.live.com/?cid=0123456789abcdef&id=9999999999999999!s1234',
    'https://onedrive.live.com/?cid=0123456789abcdef&id=0123456789abcdef!s1234%2Fcontent'
  ])assert.equal(c.odDirectFolderReference(address),null,address);
});

for(const kind of ['file','wrong-folder','wrong-drive'])test(`Ein ${kind} ersetzt keinen bestätigten Ordner`,async()=>{
  let f=fixture();await f.c.oneDriveResolveSharedRoot();const saved=f.local.get('fw_onedrive_verified_root');f=fixture(f.local);
  const item={...folder};if(kind==='file'){delete item.folder;item.file={};}
  if(kind==='wrong-folder')item.id='different-folder';if(kind==='wrong-drive')item.parentReference={driveId:'different-drive'};
  f.respond=()=>new Response(JSON.stringify(item));await assert.rejects(f.c.oneDriveResolveSharedRoot());
  assert.equal(f.local.get('fw_onedrive_verified_root'),saved);assert.equal(f.run('oneDriveSharedRoot'),null);
});

for(const change of ['logout','link','account'])test(`Ein ${change} während des Abrufs verwirft das Ergebnis`,async()=>{
  const f=fixture();let begin,finish;const started=new Promise(resolve=>begin=resolve),waiting=new Promise(resolve=>finish=resolve);
  f.respond=async()=>{begin();await waiting;return new Response(JSON.stringify(folder));};
  const pending=f.c.oneDriveResolveSharedRoot();await started;
  if(change==='logout')f.c.endOneDriveSession();
  if(change==='link')f.local.set('fw_onedrive_shared_folder_url','https://example.test/other');
  if(change==='account')f.local.set('fw_onedrive_tokens',JSON.stringify(token('other-account')));
  finish();await assert.rejects(pending);
  assert.equal(f.run('oneDriveSharedRoot'),null);assert.equal(f.local.has('fw_onedrive_verified_root'),false);
});

test('Nicht erreichbarer Ordner wird bei der Synchronisierung nicht als fehlende Datendatei angelegt',async()=>{
  let f=fixture();await f.c.oneDriveResolveSharedRoot();f=fixture(f.local);f.respond=()=>errorResponse(404);
  Object.assign(f.c,{oneDriveStatus(){},renderOneDriveDialog(){},byId:()=>null});
  f.c.console={error(){}};await f.c.syncOneDrive();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.method,undefined);
  assert.equal(f.run('oneDriveAccessConfirmed'),false);assert.equal(f.run('oneDriveStateConfirmed'),false);
});

test('Angemeldete Verwaltung kann eine geänderte Ordneradresse speichern; normale Sitzung zeigt keine Einrichtung',()=>{
  const f=fixture(),button={};Object.assign(f.c,{adminUnlocked:true,byId:id=>id==='oneDriveLogin'?button:null,document:{querySelector:()=>null}});
  f.c.renderOneDriveDialog();assert.equal(button.hidden,false);assert.match(button.textContent,/Einstellungen speichern/);
  f.c.adminUnlocked=false;f.c.renderOneDriveDialog();assert.equal(button.hidden,true);
  f.run('oneDriveNeedsLogin=true');f.c.renderOneDriveDialog();assert.equal(button.hidden,false);assert.match(button.textContent,/Anmeldung erneuern/);
});


function directFixture(){
 const f=fixture();Object.assign(f.c,{adminUnlocked:true,requireAdmin:()=>f.c.adminUnlocked,byId:()=>null,showToast:(text,kind)=>f.messages.push({text,kind}),renderOneDriveDialog(){}});
 f.messages=[];f.run('oneDriveAccessConfirmed=true');
 f.respond=url=>new Response(JSON.stringify(url.includes(':/feuerwehr-wasser-daten.json?')?{id:'state-file',file:{}}:folder));return f;
}

test('Umstellung prüft vorhandenen Ordner und Datendatei nur lesend; IDs, Token und Kontoquelle bleiben gleich',async()=>{
 let f=directFixture();await f.c.oneDriveResolveSharedRoot();f.calls.length=0;
 const originalToken=f.local.get('fw_onedrive_tokens'),scope=JSON.stringify(['test-client','https://example.test/old-share']);
 f.local.set('fw_v1_attendance_draft',JSON.stringify({version:1,id:'draft-test',source:scope,topic:'Testthema',pending:[['test','Anwesend']]}));
 f.run('let attendanceDraftScope='+JSON.stringify(scope)+';let attendanceDraftSignature="old"');
 assert.equal(await f.c.oneDriveUseDirectFolder(),true);
 const address=f.local.get('fw_onedrive_shared_folder_url');assert.equal(address,'https://graph.microsoft.com/v1.0/drives/test-drive/items/test-folder');
 assert.equal(f.calls.length,2);for(const call of f.calls){assert.doesNotMatch(call.url,/\/shares\//);assert.equal(call.options.method,undefined);assert.equal(call.options.headers.get('Authorization'),'Bearer TEST-TOKEN');assert.equal(call.options.headers.has('Prefer'),false);}
 assert.equal(f.local.get('fw_onedrive_tokens'),originalToken);
 const draft=JSON.parse(f.local.get('fw_v1_attendance_draft'));assert.equal(draft.topic,'Testthema');assert.deepEqual(draft.pending,[['test','Anwesend']]);assert.equal(draft.source,JSON.stringify(['test-client',address]));assert.equal(f.run('attendanceDraftScope'),draft.source);
 f=fixture(f.local);f.respond=()=>new Response(JSON.stringify(folder));const root=await f.c.oneDriveResolveSharedRoot();
 assert.equal(root.driveId+':'+root.id,'test-drive:test-folder');assert.equal(f.calls.length,1);assert.doesNotMatch(f.calls[0].url,/\/shares\//);
});

for(const condition of ['403','404','file','wrong-id','wrong-drive','missing-state','logout','account','locked','busy','storage'])test('Fehler '+condition+' stellt die Ordneradresse nicht um',async()=>{
 const f=directFixture();await f.c.oneDriveResolveSharedRoot();f.calls.length=0;
 const share=f.local.get('fw_onedrive_shared_folder_url'),saved=f.local.get('fw_onedrive_verified_root');
 f.respond=url=>{
  if(condition==='403'||condition==='404')return errorResponse(Number(condition));
  if(condition==='logout')f.c.endOneDriveSession();
  if(condition==='account')f.local.set('fw_onedrive_tokens',JSON.stringify(token('other')));
  if(condition==='locked')f.c.adminUnlocked=false;
  let item=url.includes(':/feuerwehr-wasser-daten.json?')?{id:'state-file',file:{}}:{...folder};
  if(condition==='file'){delete item.folder;item.file={};}
  if(condition==='wrong-id')item.id='other';if(condition==='wrong-drive')item.parentReference={driveId:'other'};
  if(condition==='missing-state'&&item.file)item={id:'not-a-file'};
  return new Response(JSON.stringify(item));
 };
 if(condition==='busy')f.run('oneDriveBusy=true');
 if(condition==='storage'){const set=f.c.localStorage.setItem;f.c.localStorage.setItem=(key,value)=>{if(key==='fw_onedrive_shared_folder_url'&&value!==share)throw Error('quota');set(key,value);};}
 assert.equal(await f.c.oneDriveUseDirectFolder(),false);
 assert.equal(f.local.get('fw_onedrive_shared_folder_url'),share);
 if(condition!=='logout')assert.equal(f.local.get('fw_onedrive_verified_root'),saved);
 assert.equal(f.messages.at(-1).kind,'error');
});

test('Fremder Entwurf bleibt unverändert und die Umstellung ist wiederholbar',async()=>{
 const f=directFixture(),draft=JSON.stringify({version:1,source:'other',topic:'Test'});f.local.set('fw_v1_attendance_draft',draft);
 assert.equal(await f.c.oneDriveUseDirectFolder(),true);const address=f.local.get('fw_onedrive_shared_folder_url');
 assert.equal(await f.c.oneDriveUseDirectFolder(),true);assert.equal(f.local.get('fw_onedrive_shared_folder_url'),address);assert.equal(f.local.get('fw_v1_attendance_draft'),draft);
});

test('Direkte Graph-Adresse akzeptiert ausschließlich feste Ordnerkennungen ohne Query, Fragment oder Unterpfad',()=>{
 const f=fixture(),base='https://graph.microsoft.com/v1.0/drives/test-drive/items/test-folder';
 assert.equal(f.c.odDirectFolderReference(base).id,'test-folder');
 for(const address of [base+'/content',base+'?expand=children',base+'#anything',base.replace('test-folder','test%2Ffolder'),base.replace('graph.microsoft.com','graph.microsoft.com.evil.test'),base.replace('https:','http:')])assert.equal(f.c.odDirectFolderReference(address),null);
});


test('Ungespeicherte Einrichtung wird nicht durch die Übernahme des bisherigen Ordners überschrieben',async()=>{
 const f=directFixture();f.c.byId=id=>id==='oneDriveShareUrl'?{value:'https://example.test/unsaved'}:null;
 assert.equal(await f.c.oneDriveUseDirectFolder(),false);assert.equal(f.calls.length,0);
 assert.equal(f.local.get('fw_onedrive_shared_folder_url'),'https://example.test/old-share');assert.match(f.messages[0].text,/ungespeicherte/);
});
