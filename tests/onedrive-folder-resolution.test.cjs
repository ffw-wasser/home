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
