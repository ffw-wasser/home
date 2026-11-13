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
