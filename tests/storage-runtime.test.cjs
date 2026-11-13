const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID,randomBytes}=require('node:crypto');
const {fixture}=require('./helpers/storage-fixture.cjs'),{activate}=require('../scripts/activate-cloudflare-storage.cjs');
async function setup(t){
 const f=fixture(t),directory=await fs.mkdtemp(path.join(os.tmpdir(),'h2o-runtime-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const source=path.join(directory,'source');await fs.mkdir(path.join(source,'Getraenke'),{recursive:true});await fs.mkdir(path.join(source,'Berichte'));
 await fs.writeFile(path.join(source,'Getraenke/push-verbindung.json'),JSON.stringify({version:1,origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',token:f.env.ADMIN_TOKEN}));await fs.writeFile(path.join(source,'Getraenke/konten-zentrale.json'),JSON.stringify({version:1,source:'drive-fixture:root-fixture',state:'active'}));
 await fs.writeFile(path.join(source,'feuerwehr-wasser-daten.json'),JSON.stringify({members:[{id:'synthetic',name:'Anna Beispiel'}],entries:[],updatedAt:'2026-11-13T10:00:00Z',csvArchive:[{id:'legacy',content:'synthetic',fileName:'alt.csv'}]}));await fs.writeFile(path.join(source,'Berichte/test.txt'),'Synthetic report');
 let credential,opens=0;const logs=[];const options={fetcher:f.fetcher,checkpointRoot:path.join(directory,'copies'),log:value=>logs.push(value),openBrowser:async url=>{opens++;const u=new URL(url);assert.equal(u.origin,'https://ffw-wasser.github.io');assert.equal(u.search,'');credential=JSON.parse(Buffer.from(new URLSearchParams(u.hash.slice(1)).get('cloudDevice'),'base64url'));}};
 async function api(endpoint,data={},token=credential?.token){const r=await f.fetcher('https://test.account.workers.dev'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
 return {...f,directory,sourceDirectory:source,options,logs,api,get credential(){return credential;},get opens(){return opens;}};
}
test('Production CLI: fresh original and independent checkpoint verified; own device, unchanged source, no credential output',async t=>{
 const f=await setup(t),ledger=f.db.prepare('SELECT * FROM ledger_meta').get();const result=await activate(f.sourceDirectory,f.options);assert.equal(result.active,true);assert.equal(f.opens,1);assert.equal(f.credential.token.length,43);assert.equal(f.credential.source,'drive-fixture:root-fixture');assert.deepEqual(f.db.prepare('SELECT * FROM ledger_meta').get(),ledger);
 assert.ok(!f.logs.join(' ').includes(f.env.ADMIN_TOKEN));assert.ok(!f.logs.join(' ').includes(f.credential.token));assert.equal((await f.api('/storage/config')).status,200);assert.equal((await f.api('/admin/check')).status,200);
 assert.equal((await f.api('/storage-state/read',{source:f.source,run:result.run})).data.value.csvArchive[0].id,'legacy');
 const devices=f.db.prepare('SELECT * FROM storage_devices').all();assert.equal(devices.filter(row=>row.revoked_at===null).length,1);assert.ok(devices.some(row=>row.revoked_at!==null),'provisional verification access revoked');
});
test('Production: already active never reimports an old OneDrive copy or overwrites live changes',async t=>{
 const f=await setup(t),first=await activate(f.sourceDirectory,f.options),row=f.db.prepare('SELECT * FROM storage_states WHERE run=?').get(first.run);const value=(await f.api('/storage-state/read',{source:f.source,run:first.run})).data.value;value.members.push({id:'new',name:'Ben Beispiel'});
 assert.equal((await f.api('/storage-state/write',{source:f.source,run:first.run,expectedVersion:row.version,operationId:randomUUID(),value})).status,200);
 const before=f.db.prepare('SELECT payload,version FROM storage_states WHERE run=?').get(first.run),puts=f.puts();await activate(f.sourceDirectory,f.options);assert.deepEqual(f.db.prepare('SELECT payload,version FROM storage_states WHERE run=?').get(first.run),before);assert.equal(f.puts(),puts);assert.equal(f.opens,2);
});
test('Production: tokens are role-bound, source-bound, revocable and cannot reveal the original root secret',async t=>{
 const f=await setup(t),result=await activate(f.sourceDirectory,f.options),scope={source:f.source,run:result.run};
 assert.equal((await f.api('/admin/storage-files/read',{...scope,path:'Getraenke/push-verbindung.json'})).status,403);
 assert.equal((await f.api('/admin/storage-files/stat',{...scope,id:require('./helpers/storage-fixture.cjs').sha('Getraenke/push-verbindung.json')})).status,403);
 const listing=await f.api('/admin/storage-files/list',{...scope,path:'Getraenke'});assert.equal(listing.data.items.some(item=>item.name==='push-verbindung.json'),false);
 const stateToken=randomBytes(32).toString('base64url');assert.equal((await f.api('/admin/storage-state/pair',{...scope,deviceId:randomUUID(),token:stateToken,label:'Synthetic state-only',expiresAt:Date.now()+60000},f.env.ADMIN_TOKEN)).status,200);
 assert.equal((await f.api('/storage-state/read',scope,stateToken)).status,401);assert.equal((await f.api('/admin/check',{},stateToken)).status,401);
 assert.equal((await f.api('/admin/storage-files/list',{...scope,run:'f'.repeat(64),path:''})).status,403);
 assert.equal((await f.api('/admin/storage-runtime/revoke',{deviceId:f.credential.deviceId})).status,200);assert.equal((await f.api('/admin/check')).status,401);assert.equal((await f.api('/storage-state/read',scope)).status,401);
});
test('Production: pairing code single-use, same-claim retry idempotent; revoked devices never return',async t=>{
 const f=await setup(t);await activate(f.sourceDirectory,f.options);const ticket=randomBytes(32).toString('base64url'),record={ticket,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Synthetic tablet'};
 assert.equal((await f.api('/admin/storage-runtime/pairing',{ticket,expiresAt:Date.now()+120000})).status,200);
 assert.equal((await f.api('/storage/claim',record,'')).status,200);assert.equal((await f.api('/storage/claim',record,'')).status,200);
 assert.equal((await f.api('/storage/claim',{...record,deviceId:randomUUID(),token:randomBytes(32).toString('base64url')},'')).status,401);
 assert.equal((await f.api('/admin/storage-runtime/revoke',{deviceId:record.deviceId})).status,200);assert.equal((await f.api('/storage/claim',record,'')).status,401);assert.equal((await f.api('/storage/renew',{},record.token)).status,401);
});
test('Production: a change to the original during final comparison prevents activation',async t=>{
 const f=await setup(t);let changed=false;f.options.fetcher=async(url,options)=>{const response=await f.fetcher(url,options);if(!changed&&url.endsWith('/storage-files/read')){changed=true;await fs.writeFile(path.join(f.sourceDirectory,'Berichte/test.txt'),'changed during copy');}return response;};
 await assert.rejects(activate(f.sourceDirectory,f.options),/Quellordner wurde/);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_runtime').get().n,0);assert.equal(f.opens,0);
});
test('Production: issuer revocation cancels an unclaimed device ticket, also during registration',async t=>{
 const f=await setup(t);await activate(f.sourceDirectory,f.options);const ticket=randomBytes(32).toString('base64url');await f.api('/admin/storage-runtime/pairing',{ticket,expiresAt:Date.now()+120000});
 f.race(()=>f.db.prepare('UPDATE storage_devices SET revoked_at=1 WHERE id=?').run(f.credential.deviceId));
 const claim=await f.api('/storage/claim',{ticket,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Synthetic forbidden claim'},'');assert.equal(claim.status,409);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_devices WHERE revoked_at IS NULL').get().n,0);
});
test('Production CLI: wrong deployed Worker fingerprint stops before transmitting any administrative credential',async t=>{
 const f=await setup(t);let gets=0;await assert.rejects(activate(f.sourceDirectory,{...f.options,expectedFingerprint:'1'.repeat(64),fetcher:async(url,options)=>{gets++;assert.ok(url.endsWith('/health'));assert.equal(options.method,'GET');assert.equal(options.headers,undefined);return new Response(JSON.stringify({sourceFingerprint:'2'.repeat(64)}));}}),/Worker-Version stimmt/);assert.equal(gets,1);assert.equal(f.opens,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_runtime').get().n,0);
});
test('Administration devices remain usable after months of inactivity, including state and file writes; explicit revocation still wins',async t=>{
 const f=await setup(t),result=await activate(f.sourceDirectory,f.options),scope={source:f.source,run:result.run};assert.equal(f.credential.permanent,true);assert.equal(f.credential.expiresAt,Number.MAX_SAFE_INTEGER);
 const current=Date.now();f.context.Date=class extends Date{static now(){return current+180*86400000;}};
 assert.equal((await f.api('/storage/config')).status,200);assert.equal((await f.api('/storage/renew')).data.permanent,true);const read=await f.api('/storage-state/read',scope);assert.equal(read.status,200);
 assert.equal((await f.api('/storage-state/write',{...scope,expectedVersion:read.data.version,operationId:randomUUID(),value:{...read.data.value,entries:[]}})).status,200);
 assert.equal((await f.api('/admin/storage-files/mkdir',{...scope,path:'Berichte/after-inactivity',expectedVersion:0,operationId:randomUUID()})).status,200);
 await f.api('/admin/storage-runtime/revoke',{deviceId:f.credential.deviceId});assert.equal((await f.api('/storage/config')).status,401);assert.equal((await f.api('/storage/renew')).status,401);assert.equal((await f.api('/storage-state/read',scope)).status,401);
});
test('Only an existing valid administration device adopts the permanent policy; expired devices remain blocked',async t=>{
 const f=await setup(t);await activate(f.sourceDirectory,f.options);f.db.prepare('UPDATE storage_devices SET expires_at=? WHERE id=?').run(Date.now()+60000,f.credential.deviceId);
 const before=f.db.prepare('SELECT * FROM storage_devices WHERE id=?').get(f.credential.deviceId);assert.equal((await f.api('/storage/config')).data.permanent,true);const after=f.db.prepare('SELECT * FROM storage_devices WHERE id=?').get(f.credential.deviceId);assert.deepEqual({...after,expires_at:before.expires_at},{...before});assert.equal(after.expires_at,Number.MAX_SAFE_INTEGER);
 f.db.prepare('UPDATE storage_devices SET expires_at=0 WHERE id=?').run(f.credential.deviceId);assert.equal((await f.api('/storage/config')).status,401);assert.equal((await f.api('/storage/renew')).status,401);assert.equal(f.db.prepare('SELECT expires_at FROM storage_devices WHERE id=?').get(f.credential.deviceId).expires_at,0);
});
test('Permanent device access does not extend the five-minute one-use pairing invitation',async t=>{
 const f=await setup(t);await activate(f.sourceDirectory,f.options);const ticket=randomBytes(32).toString('base64url');await f.api('/admin/storage-runtime/pairing',{ticket,expiresAt:Date.now()+120000});
 const current=Date.now();f.context.Date=class extends Date{static now(){return current+10*60000;}};
 assert.equal((await f.api('/storage/config')).status,200);assert.equal((await f.api('/storage/claim',{ticket,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Expired invitation'},'')).status,401);
});
test('Permanent administration grants retain the ten-device limit and explicit revocation frees a slot',async t=>{
 const f=await setup(t),result=await activate(f.sourceDirectory,f.options),scope={source:f.source,run:result.run},devices=[];
 const record=()=>({...scope,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Synthetic administration laptop',access:'application-admin',expiresAt:Date.now()+60000});
 for(let i=0;i<9;i++){const device=record();devices.push(device);assert.equal((await f.api('/admin/storage-state/pair',device,f.env.ADMIN_TOKEN)).status,200);}
 const extra=record();assert.equal((await f.api('/admin/storage-state/pair',extra,f.env.ADMIN_TOKEN)).status,409);assert.equal((await f.api('/admin/storage-runtime/revoke',{deviceId:devices[0].deviceId})).status,200);assert.equal((await f.api('/admin/storage-state/pair',extra,f.env.ADMIN_TOKEN)).status,200);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_devices WHERE revoked_at IS NULL AND expires_at=?').get(Number.MAX_SAFE_INTEGER).n,10);
});
test('The rollout policy upgrades only currently valid administration devices of the active source',async t=>{
 const f=await setup(t),result=await activate(f.sourceDirectory,f.options),scope={source:f.source,run:result.run},records=[];
 for(const kind of ['valid','expired','revoked','state']){const record={...scope,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Synthetic '+kind,expiresAt:Date.now()+60000,...(kind==='state'?{}:{access:'application-admin'})};assert.equal((await f.api('/admin/storage-state/pair',record,f.env.ADMIN_TOKEN)).status,200);records.push({...record,kind});f.db.prepare('UPDATE storage_devices SET expires_at=?,revoked_at=? WHERE id=?').run(kind==='expired'?0:Date.now()+60000,kind==='revoked'?1:null,record.deviceId);}
 assert.equal((await f.api('/admin/storage-runtime/permanent-devices',{...scope,source:'f'.repeat(64)},f.env.ADMIN_TOKEN)).status,403);const policy=await f.api('/admin/storage-runtime/permanent-devices',scope,f.env.ADMIN_TOKEN);assert.equal(policy.status,200);assert.equal(policy.data.updated,1);
 for(const record of records){const row=f.db.prepare('SELECT * FROM storage_devices WHERE id=?').get(record.deviceId);assert.equal(row.expires_at===Number.MAX_SAFE_INTEGER,record.kind==='valid');}
 assert.equal((await f.api('/admin/storage-runtime/permanent-devices',scope,f.env.ADMIN_TOKEN)).data.updated,0);assert.equal((await f.api('/storage/config',{},records.find(x=>x.kind==='expired').token)).status,401);assert.equal((await f.api('/storage/config',{},records.find(x=>x.kind==='revoked').token)).status,401);
});

test('Microsoft enrollment requires exact server-verified folder access and never stores Microsoft tokens',async t=>{
 const f=await setup(t);await activate(f.sourceDirectory,f.options);
 const clientId='11111111-1111-4111-8111-111111111111',accessToken='synthetic-microsoft-access-token';
 assert.equal((await f.api('/storage/microsoft/config',{},'')).status,409);
 assert.equal((await f.api('/admin/storage-runtime/microsoft',{clientId},'')).status,401);
 assert.equal((await f.api('/admin/storage-runtime/microsoft',{clientId})).status,200);
 assert.equal((await f.api('/storage/microsoft/config',{},'')).data.clientId,clientId);
 const request={accessToken,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Synthetic Microsoft laptop'};
 let calls=0;f.context.fetch=async(url,options)=>{calls++;assert.equal(url,'https://graph.microsoft.com/v1.0/drives/drive-fixture/items/root-fixture?$select=id,parentReference,folder,deleted');assert.equal(options.headers.Authorization,'Bearer '+accessToken);assert.equal(options.redirect,'error');return new Response(JSON.stringify({id:'root-fixture',parentReference:{driveId:'drive-fixture'},folder:{}}));};
 const enrolled=await f.api('/storage/microsoft/enroll',request,'');assert.equal(enrolled.status,200,JSON.stringify(enrolled));assert.equal(calls,1);
 assert.equal((await f.api('/storage/microsoft/enroll',request,'')).status,200,'retry uses same device');
 assert.equal((await f.api('/storage/config',{},request.token)).status,200);
 assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM storage_devices').all()).includes(accessToken),false);
 for(const reply of [new Response('{}',{status:403}),new Response('{}',{status:401}),new Response(JSON.stringify({id:'other-folder',parentReference:{driveId:'drive-fixture'},folder:{}})),new Response(JSON.stringify({id:'root-fixture',parentReference:{driveId:'other-drive'},folder:{}})),new Response(JSON.stringify({id:'root-fixture',parentReference:{driveId:'drive-fixture'},file:{}}))]){
  f.context.fetch=async()=>reply;const candidate={...request,deviceId:randomUUID(),token:randomBytes(32).toString('base64url')};assert.ok((await f.api('/storage/microsoft/enroll',candidate,'')).status>=400);assert.equal(f.db.prepare('SELECT id FROM storage_devices WHERE id=?').get(candidate.deviceId),undefined);
 }
 f.context.fetch=async()=>{throw Error('Network failure '+accessToken);};const failed=await f.api('/storage/microsoft/enroll',{...request,deviceId:randomUUID()},'');assert.equal(failed.status,503);assert.equal(JSON.stringify(failed).includes(accessToken),false);
 await f.api('/admin/storage-runtime/microsoft',{clientId:''});assert.equal((await f.api('/storage/microsoft/config',{},'')).status,409);
});
