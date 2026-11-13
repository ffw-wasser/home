const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
const {fixture,sha}=require('./helpers/storage-fixture.cjs');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {prepare:prepareCopy}=require('../scripts/prepare-cloudflare-storage.cjs');
async function setup(t){
 const f=fixture(t),initial={schemaVersion:3,updatedAt:'2026-11-13T10:00:00Z',members:[{id:'synthetic-member',name:'Erika Beispiel'}],entries:[],careerCatalog:[{id:'synthetic-course',label:'Beispiel'}]},bytes=Buffer.from(JSON.stringify(initial)),file={path:'feuerwehr-wasser-daten.json',size:bytes.length,sha256:sha(bytes)};
 const run=(await f.call('start',{files:[file]})).data.run;assert.equal((await f.upload(run,file,bytes)).status,200);
 async function api(path,data={},token=f.env.ADMIN_TOKEN){const r=await f.fetcher('https://test.account.workers.dev'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({source:f.source,run,...data})});assert.match(r.headers.get('Cache-Control'),/no-store/);return {status:r.status,data:await r.json()};}
 const admin=(action,data={},token)=>api('/admin/storage-state/'+action,data,token);
 async function prepare(){assert.equal((await f.call('verify',{run})).status,200);assert.equal((await admin('prepare')).status,200);}
 async function pair(){const record={deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Test-iPad',expiresAt:Date.now()+3600000};assert.equal((await admin('pair',record)).status,200);return record;}
 return {...f,initial,run,api,admin,prepare,pair};
}
test('Storage state: import only a verified authenticated snapshot; retain all fields and encrypt state',async t=>{
 const f=await setup(t),ledger=f.db.prepare('SELECT * FROM ledger_meta').get(),account=f.db.prepare('SELECT * FROM accounts').get();
 assert.equal((await f.admin('prepare')).status,409);
 assert.equal((await f.admin('prepare',{},'wrong')).status,401);
 await f.prepare();const row=f.db.prepare('SELECT * FROM storage_states').get();assert.ok(!row.payload.includes('Erika Beispiel'));
 const device=await f.pair(),read=await f.api('/storage-state/read',{},device.token);assert.equal(read.status,200);assert.deepEqual(read.data.value,f.initial);assert.equal(read.data.liveStorage,'onedrive');assert.equal(read.data.mode,'rehearsal');
 const status=await f.admin('status');assert.equal(status.data.members,1);assert.equal(status.data.entries,0);assert.equal(status.data.value,undefined);
 assert.equal((await f.admin('activate')).status,404);assert.deepEqual(f.db.prepare('SELECT * FROM ledger_meta').get(),ledger);assert.deepEqual(f.db.prepare('SELECT * FROM accounts').get(),account);
});
test('Storage state: server rejects local PINs, unrelated phone/admin tokens, wrong sources and expired devices',async t=>{
 const f=await setup(t);await f.prepare();const d=await f.pair();
 for(const token of ['112','',f.env.ADMIN_TOKEN,'p'.repeat(43)])assert.equal((await f.api('/storage-state/read',{},token)).status,401);
 assert.equal((await f.admin('status',{source:'f'.repeat(64)})).status,409);
 assert.equal((await f.api('/storage-state/read',{run:'f'.repeat(64)},d.token)).status,401);
 assert.equal((await f.api('/storage-state/read',{source:'f'.repeat(64)},d.token)).status,401);
 f.db.prepare('UPDATE storage_devices SET expires_at=0 WHERE id=?').run(d.deviceId);assert.equal((await f.api('/storage-state/read',{},d.token)).status,401);
 const other=await f.pair();f.db.prepare("UPDATE ledger_meta SET source='another-source'").run();assert.equal((await f.api('/storage-state/read',{},other.token)).status,409);
});
test('Storage state: retries deduplicate, changed reuse and stale revisions cannot overwrite',async t=>{
 const f=await setup(t);await f.prepare();const d=await f.pair(),next={...f.initial,members:[{id:'synthetic-member',name:'Erika Beispiel',agt:true}]};
 const job={operationId:randomUUID(),expectedVersion:1,value:next};
 let r=await f.api('/storage-state/write',job,d.token);assert.equal(r.status,200);assert.equal(r.data.version,2);
 r=await f.api('/storage-state/write',job,d.token);assert.equal(r.status,200);assert.equal(r.data.duplicate,true);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_state_receipts').get().n,1);
 assert.equal((await f.api('/storage-state/write',{...job,value:f.initial},d.token)).status,409);
 assert.equal((await f.api('/storage-state/write',{...job,operationId:randomUUID()},d.token)).status,409);
 const other=await f.pair();assert.equal((await f.api('/storage-state/write',job,other.token)).status,409);
 // Repeating preparation cannot replace edits in the rehearsal state.
 assert.equal((await f.admin('prepare')).data.version,2);assert.deepEqual((await f.api('/storage-state/read',{},d.token)).data.value,next);
 assert.equal((await f.api('/storage-state/write',{operationId:randomUUID(),expectedVersion:2,value:{members:[]}},d.token)).status,400);
});
test('Storage state: revocation is immediate, idempotent and cannot be undone by reenrollment',async t=>{
 const f=await setup(t);await f.prepare();const d=await f.pair(),raw=f.db.prepare('SELECT * FROM storage_devices').get();
 assert.ok(!JSON.stringify(raw).includes(d.token));assert.ok(!raw.label.includes(d.label));
 assert.equal((await f.admin('pair',d)).data.duplicate,true);
 assert.equal((await f.admin('pair',{...d,label:'Changed'})).status,409);
 assert.equal((await f.admin('revoke',{deviceId:d.deviceId})).status,200);
 assert.equal((await f.admin('revoke',{deviceId:d.deviceId})).status,200);
 assert.equal((await f.api('/storage-state/read',{},d.token)).status,401);
 assert.equal((await f.admin('pair',d)).status,409);
 const bad={...d,deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),expiresAt:Date.now()+31*86400000};assert.equal((await f.admin('pair',bad)).status,400);
});
test('Storage state: revocation and concurrent writes during encryption prevent the entire transaction',async t=>{
 const f=await setup(t);await f.prepare();const d=await f.pair(),job={operationId:randomUUID(),expectedVersion:1,value:{...f.initial,entries:[{id:'synthetic-entry'}]}};
 f.race(()=>f.db.prepare('UPDATE storage_devices SET revoked_at=1 WHERE id=?').run(d.deviceId));
 assert.equal((await f.api('/storage-state/write',job,d.token)).status,409);
 assert.equal(f.db.prepare('SELECT version FROM storage_states').get().version,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_state_receipts').get().n,0);
 const other=await f.pair();f.race(()=>f.db.prepare('UPDATE storage_states SET version=version+1').run());
 assert.equal((await f.api('/storage-state/write',job,other.token)).status,409);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_state_receipts').get().n,0);
});
test('Storage state: a receipt failure rolls back the data write; same operation then succeeds',async t=>{
 const f=await setup(t);await f.prepare();const d=await f.pair(),job={operationId:randomUUID(),expectedVersion:1,value:{...f.initial,entries:[{id:'synthetic-entry'}]}};
 f.db.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON storage_state_receipts BEGIN SELECT RAISE(ABORT,'fixture'); END;");
 assert.equal((await f.api('/storage-state/write',job,d.token)).status,503);
 assert.equal(f.db.prepare('SELECT version FROM storage_states').get().version,1);
 f.db.exec('DROP TRIGGER fail_receipt');assert.equal((await f.api('/storage-state/write',job,d.token)).status,200);
});
test('Storage state: at most ten current device grants, freed by revocation',async t=>{
 const f=await setup(t);await f.prepare();const records=[];for(let n=0;n<10;n++)records.push(await f.pair());
 const extra={deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Extra',expiresAt:Date.now()+3600000};assert.equal((await f.admin('pair',extra)).status,409);
 assert.equal((await f.admin('revoke',{deviceId:records[0].deviceId})).status,200);assert.equal((await f.admin('pair',extra)).status,200);
});
async function localCopy(t){
 const f=fixture(t),directory=await fs.mkdtemp(path.join(os.tmpdir(),'h2o-state-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 await fs.mkdir(path.join(directory,'Getraenke'));
 await fs.writeFile(path.join(directory,'Getraenke','push-verbindung.json'),JSON.stringify({origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',token:f.env.ADMIN_TOKEN}));
 await fs.writeFile(path.join(directory,'Getraenke','konten-zentrale.json'),JSON.stringify({source:'drive-fixture:root-fixture',state:'active'}));
 await fs.writeFile(path.join(directory,'feuerwehr-wasser-daten.json'),JSON.stringify({members:[{id:'synthetic-member'}],entries:[],careerCatalog:[{id:'preserve'}]}));
 const {migrate}=require('../scripts/migrate-onedrive-snapshot.cjs');
 const initial=await migrate(directory,{H2O_WORKER_ORIGIN:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',H2O_ADMIN_TOKEN:f.env.ADMIN_TOKEN,H2O_SOURCE:'drive-fixture:root-fixture'},{fetcher:f.fetcher,log:()=>{}});
 return {...f,directory,initial};
}
test('Storage preparation CLI: verified local copy, independent device read and proven revocation',async t=>{
 const f=await localCopy(t),messages=[];
 const result=await prepareCopy(f.directory,{fetcher:f.fetcher,log:x=>messages.push(x)});assert.equal(result.run,f.initial.run);assert.equal(result.liveStorage,'onedrive');
 const devices=f.db.prepare('SELECT * FROM storage_devices').all();assert.equal(devices.length,1);assert.ok(devices[0].revoked_at);
 assert.ok(!messages.join(' ').includes(f.env.ADMIN_TOKEN));assert.ok(!messages.join(' ').includes('synthetic-member'));
 assert.equal((await prepareCopy(f.directory,{fetcher:f.fetcher,log:()=>{}})).version,1);
});
test('Storage preparation CLI: failed independent read still revokes the provisional device',async t=>{
 const f=await localCopy(t);
 await assert.rejects(prepareCopy(f.directory,{log:()=>{},fetcher:async(url,options)=>url.endsWith('/storage-state/read')?new Response('{}',{status:503}):f.fetcher(url,options)}),/HTTP 503/);
 assert.ok(f.db.prepare('SELECT revoked_at FROM storage_devices').get().revoked_at);
});
test('Storage preparation CLI: never sends local credentials to another Worker',async t=>{
 const f=await localCopy(t);await fs.writeFile(path.join(f.directory,'Getraenke','push-verbindung.json'),JSON.stringify({origin:'https://other.account.workers.dev',token:f.env.ADMIN_TOKEN}));
 await assert.rejects(prepareCopy(f.directory,{fetcher:()=>assert.fail('must not contact a different origin'),log:()=>{}}),/nicht gültig/);
});
