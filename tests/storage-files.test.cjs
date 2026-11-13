const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
const {fixture,sha}=require('./helpers/storage-fixture.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {prepareFiles}=require('../scripts/prepare-cloudflare-files.cjs');
async function setup(t){
 const f=fixture(t),files=new Map([['feuerwehr-wasser-daten.json',Buffer.from('{"members":[],"entries":[]}')],['Berichte/Terminpakete/probe.zip',Buffer.from('synthetic original report')],['Ausbildung-Privat/test.json',Buffer.from('{"synthetic":true}')]]);
 const manifest=[...files].map(([path,bytes])=>({path,size:bytes.length,sha256:sha(bytes)}));
 const run=(await f.call('start',{files:manifest})).data.run;
 for(const file of manifest)assert.equal((await f.upload(run,file,files.get(file.path))).status,200);
 assert.equal((await f.call('verify',{run})).status,200);
 async function request(action,data={},token=f.env.ADMIN_TOKEN,bytes){
  const value={source:f.source,run,...data},r=await f.fetcher('https://test.account.workers.dev/admin/storage-files/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':bytes===undefined?'application/json':'application/octet-stream'},body:bytes===undefined?JSON.stringify(value):Buffer.concat([Buffer.from(JSON.stringify(value)+'\n'),bytes])});
  assert.match(r.headers.get('Cache-Control'),/no-store/);
  return r.headers.get('Content-Type')==='application/octet-stream'?{status:r.status,bytes:Buffer.from(await r.arrayBuffer()),headers:r.headers}:{status:r.status,data:await r.json()};
 }
 const prepared=await f.fetcher('https://test.account.workers.dev/admin/storage-state/prepare',{method:'POST',headers:{Authorization:'Bearer '+f.env.ADMIN_TOKEN},body:JSON.stringify({source:f.source,run})});assert.equal(prepared.status,200);
 async function prepare(){for(const path of files.keys())if(path!=='feuerwehr-wasser-daten.json')assert.equal((await request('prepare',{path,modifiedAt:'2026-10-01T10:00:00Z'})).status,200);}
 const write=(path,bytes,expectedVersion,operationId=randomUUID())=>request('write',{path,expectedVersion,operationId},f.env.ADMIN_TOKEN,bytes);
 return {...f,run,files,request,prepare,write};
}
test('Files: index confirmed snapshot, preserve hierarchy/date and encrypt private filenames',async t=>{
 const f=await setup(t);await f.prepare();const root=await f.request('list',{path:''});assert.equal(root.status,200);assert.equal(root.data.items.length,2);
 const path='Berichte/Terminpakete/probe.zip',meta=await f.request('stat',{path});assert.equal(meta.data.version,1);assert.equal(meta.data.modifiedAt,'2026-10-01T10:00:00Z');assert.equal(meta.data.id,sha(path));
 const read=await f.request('read',{path});assert.deepEqual(read.bytes,f.files.get(path));assert.equal(read.headers.get('Cache-Control'),'private, no-store');assert.equal(read.headers.get('Content-Disposition'),'attachment');
 for(const row of f.db.prepare('SELECT payload FROM storage_files').all())assert.ok(!row.payload.includes('probe.zip'));
 const count=f.db.prepare('SELECT COUNT(*) AS n FROM storage_files').get().n;await f.prepare();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_files').get().n,count);
 assert.equal((await f.request('prepare',{path:'not-in-snapshot.pdf',modifiedAt:new Date().toISOString()})).status,404);
 assert.equal((await f.request('read',{path:'feuerwehr-wasser-daten.json'})).status,400);
});
test('Files: only existing server admin, correct source and prepared run can access files',async t=>{
 const f=await setup(t);await f.prepare();for(const token of ['wrong','112',randomBytes(32).toString('base64url')])assert.equal((await f.request('list',{path:''},token)).status,401);
 assert.equal((await f.request('list',{path:'',source:'f'.repeat(64)})).status,409);
 assert.equal((await f.request('list',{path:'',run:'f'.repeat(64)})).status,409);
 for(const path of ['/a','../a','a/../b','a\\b','a//b','a\u0000b'])assert.equal((await f.request('stat',{path})).status,400);
});
test('Files: save, deduplicate, keep original version and reject concurrent stale corrections',async t=>{
 const f=await setup(t);await f.prepare();const path='Berichte/Terminpakete/probe.zip',bytes=Buffer.from('corrected synthetic report'),op=randomUUID();
 assert.equal((await f.write(path,bytes,1,op)).data.version,2);assert.equal((await f.write(path,bytes,1,op)).data.duplicate,true);
 assert.equal((await f.write(path,Buffer.from('altered'),1,op)).status,409);assert.equal((await f.write(path,Buffer.from('stale'),1)).status,409);
 assert.deepEqual((await f.request('read',{path})).bytes,bytes);assert.deepEqual((await f.request('read',{path,version:1})).bytes,f.files.get(path));
 assert.equal((await f.request('prepare',{path,modifiedAt:'2020-01-01T00:00:00Z'})).status,200);assert.equal((await f.request('stat',{path})).data.version,2);
 for(const [key,value] of f.objects)if(key.startsWith('files/'))assert.ok(!Buffer.from(value).includes(bytes));
});
test('Files: soft deletion, nonempty folder protection and explicit versioned restoration',async t=>{
 const f=await setup(t);await f.prepare();const path='Berichte/Terminpakete/probe.zip';
 assert.equal((await f.request('delete',{path:'Berichte/Terminpakete',expectedVersion:1,operationId:randomUUID()})).status,409);
 assert.equal((await f.request('delete',{path,expectedVersion:1,operationId:randomUUID()})).data.version,2);
 assert.equal((await f.request('read',{path})).status,404);assert.deepEqual((await f.request('read',{path,version:1})).bytes,f.files.get(path));
 assert.equal((await f.write(path,Buffer.from('unexpected resurrection'),2)).status,409);
 assert.equal((await f.request('restore',{path,expectedVersion:2,restoreVersion:1,operationId:randomUUID()})).data.version,3);
 assert.deepEqual((await f.request('read',{path})).bytes,f.files.get(path));
});
test('Files: same operation racing with different content cannot corrupt the winning R2 version',async t=>{
 const f=await setup(t);await f.prepare();const path='Berichte/Terminpakete/probe.zip',op=randomUUID(),a=Buffer.from('candidate A'),b=Buffer.from('candidate B');
 const result=await Promise.all([f.write(path,a,1,op),f.write(path,b,1,op)]);assert.equal(result.filter(r=>r.status===200).length,1);assert.equal(result.filter(r=>r.status===409).length,1);
 assert.deepEqual((await f.request('read',{path})).bytes,result[0].status===200?a:b);
 assert.deepEqual((await f.request('read',{path,version:1})).bytes,f.files.get(path));
});
test('Files: corrupted upload never advances D1; missing/deleted parents prevent new child',async t=>{
 const f=await setup(t);await f.prepare();const path='Berichte/Terminpakete/probe.zip',originalGet=f.bucket.get;
 f.bucket.get=async key=>{const object=await originalGet(key);if(!object||!key.startsWith('files/'))return object;return {arrayBuffer:async()=>{const bytes=new Uint8Array(await object.arrayBuffer());bytes[15]^=1;return bytes.buffer;}};};
 assert.equal((await f.write(path,Buffer.from('bad'),1)).status,503);assert.equal((await f.request('stat',{path})).data.version,1);
 f.bucket.get=originalGet;
 assert.equal((await f.write('missing/new.txt',Buffer.from('a'),0)).status,409);
 assert.equal((await f.request('mkdir',{path:'empty',expectedVersion:0,operationId:randomUUID()})).status,200);
 f.race(()=>f.db.prepare('UPDATE storage_files SET deleted_at=1 WHERE id=?').run(sha('empty')));
 assert.equal((await f.write('empty/new.txt',Buffer.from('a'),0)).status,409);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_files WHERE id=?').get(sha('empty/new.txt')).n,0);
});
test('Files: database receipt failures roll back metadata and keep the previous version readable',async t=>{
 const f=await setup(t);await f.prepare();const path='Berichte/Terminpakete/probe.zip',op=randomUUID();
 f.db.exec("CREATE TRIGGER fail_file_receipt BEFORE INSERT ON storage_file_receipts BEGIN SELECT RAISE(ABORT,'fixture'); END;");
 assert.equal((await f.write(path,Buffer.from('retry'),1,op)).status,503);assert.equal((await f.request('stat',{path})).data.version,1);assert.deepEqual((await f.request('read',{path})).bytes,f.files.get(path));
 f.db.exec('DROP TRIGGER fail_file_receipt');assert.equal((await f.write(path,Buffer.from('retry'),1,op)).status,200);
});
test('Files: preparation cannot create a child underneath a deleted folder',async t=>{
 const f=await setup(t);assert.equal((await f.request('mkdir',{path:'Ausbildung-Privat',expectedVersion:0,operationId:randomUUID()})).status,200);
 assert.equal((await f.request('delete',{path:'Ausbildung-Privat',expectedVersion:1,operationId:randomUUID()})).status,200);
 assert.equal((await f.request('prepare',{path:'Ausbildung-Privat/test.json',modifiedAt:new Date().toISOString()})).status,409);
 assert.equal((await f.request('stat',{path:'Ausbildung-Privat/test.json'})).status,404);
});
async function localCopy(t){
 const f=fixture(t),directory=await fs.mkdtemp(path.join(os.tmpdir(),'h2o-files-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 await fs.mkdir(path.join(directory,'Getraenke'));await fs.mkdir(path.join(directory,'Berichte'));
 const config={origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',token:f.env.ADMIN_TOKEN};
 await fs.writeFile(path.join(directory,'Getraenke','push-verbindung.json'),JSON.stringify(config));
 await fs.writeFile(path.join(directory,'Getraenke','konten-zentrale.json'),JSON.stringify({source:'drive-fixture:root-fixture',state:'active'}));
 await fs.writeFile(path.join(directory,'feuerwehr-wasser-daten.json'),'{"members":[],"entries":[]}');
 await fs.writeFile(path.join(directory,'Berichte','synthetic.txt'),'original synthetic report');
 const {migrate}=require('../scripts/migrate-onedrive-snapshot.cjs'),{prepare}=require('../scripts/prepare-cloudflare-storage.cjs');
 const snapshot=await migrate(directory,{H2O_WORKER_ORIGIN:config.origin,H2O_ADMIN_TOKEN:config.token,H2O_SOURCE:'drive-fixture:root-fixture'},{fetcher:f.fetcher,log:()=>{}});
 await prepare(directory,{fetcher:f.fetcher,log:()=>{}});
 async function listRoot(){const r=await f.fetcher(config.origin+'/admin/storage-files/list',{method:'POST',headers:{Authorization:'Bearer '+config.token},body:JSON.stringify({source:f.source,run:snapshot.run,path:''})});return (await r.json()).items;}
 return {...f,directory,snapshot,listRoot};
}
test('Files CLI: original copy remains unchanged; real read/write/history/restore and soft cleanup verified',async t=>{
 const f=await localCopy(t),messages=[],ledger=f.db.prepare('SELECT * FROM ledger_meta').get(),snapshotObjects=new Map([...f.objects].filter(([key])=>key.startsWith('migration/')));
 const result=await prepareFiles(f.directory,{fetcher:f.fetcher,log:x=>messages.push(x)});assert.equal(result.files,3);assert.equal(result.liveStorage,'onedrive');
 assert.equal(await fs.readFile(path.join(f.directory,'Berichte','synthetic.txt'),'utf8'),'original synthetic report');
 assert.deepEqual(f.db.prepare('SELECT * FROM ledger_meta').get(),ledger);assert.deepEqual(new Map([...f.objects].filter(([key])=>key.startsWith('migration/'))),snapshotObjects);
 assert.ok((await f.listRoot()).every(item=>!item.name.startsWith('__H2O-Speichertest-')));
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_file_versions').get().n,5);
 assert.ok(!messages.join(' ').includes(f.env.ADMIN_TOKEN));assert.ok(!messages.join(' ').includes('synthetic.txt'));
 assert.equal((await prepareFiles(f.directory,{fetcher:f.fetcher,log:()=>{}})).files,3);
});
test('Files CLI: a failed write still removes the synthetic test folder from current listing',async t=>{
 const f=await localCopy(t);
 await assert.rejects(prepareFiles(f.directory,{log:()=>{},fetcher:(url,options)=>url.endsWith('/storage-files/write')?new Response('{}',{status:503}):f.fetcher(url,options)}),/HTTP 503/);
 assert.ok((await f.listRoot()).every(item=>!item.name.startsWith('__H2O-Speichertest-')));
});
test('Files CLI: rejects a different destination before sending any credential',async t=>{
 const f=await localCopy(t);await fs.writeFile(path.join(f.directory,'Getraenke','push-verbindung.json'),JSON.stringify({origin:'https://unrelated.account.workers.dev',token:f.env.ADMIN_TOKEN}));
 await assert.rejects(prepareFiles(f.directory,{fetcher:()=>assert.fail('unexpected credential transmission'),log:()=>{}}),/nicht gültig/);
});
