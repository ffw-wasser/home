const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),vm=require('node:vm'),os=require('node:os'),path=require('node:path');
const {webcrypto,createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {migrate,inventory,settings}=require('../scripts/migrate-onedrive-snapshot.cjs');
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const file of ['schema.sql','central.sql','storage-migration.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../cloudflare/push',file),'utf8'));
 // Existing identity must never be rewritten by snapshot staging.
 db.prepare("INSERT INTO ledger_meta VALUES(1,?,'active',17,?)").run('drive-fixture:root-fixture','original-policy');
 db.prepare('INSERT INTO accounts(alias,revision,last_sent) VALUES(?,?,?)').run('a'.repeat(32),'original-revision',123);
 let queries=0;
 const DB={prepare(sql){let args=[];const stmt={bind(...values){args=values;return stmt;},async first(){queries++;return db.prepare(sql).get(...args)||null;},async all(){queries++;return {results:db.prepare(sql).all(...args)};},async run(){queries++;return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};return stmt;}};
 const objects=new Map();let puts=0;
 const bucket={async put(key,bytes){puts++;objects.set(key,new Uint8Array(bytes));},async get(key){const value=objects.get(key);return value?{async arrayBuffer(){return value.slice().buffer;}}:null;}};
 const env={DB,MIGRATION_FILES:bucket,ADMIN_TOKEN:'a'.repeat(64),INVITE_SECRET:'b'.repeat(64),VAPID_PRIVATE_JWK:'{}',VAPID_PUBLIC_KEY:'public-key'};
 const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,URL,Request,Response,Headers,btoa,atob,Date,console});
 for(const file of ['central.js','storage-migration.js','worker.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../cloudflare/push',file),'utf8').replace('export default {','globalThis.worker={'),context);
 const source=sha('drive-fixture:root-fixture');
 async function fetcher(url,options){queries=0;const response=await context.worker.fetch(new Request(url,options),env,{});assert.ok(queries<=50,'Free query budget');return response;}
 async function call(action,data={},token=env.ADMIN_TOKEN){const r=await fetcher('https://test.account.workers.dev/admin/storage-migration/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://ffw-wasser.github.io','Content-Type':'application/json'},body:JSON.stringify({source,...data})});return {status:r.status,data:await r.json()};}
 async function upload(run,file,bytes){return fetcher('https://test.account.workers.dev/admin/storage-migration/upload?'+new URLSearchParams({source,run,file:sha(file.path)}),{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN},body:bytes});}
 return {db,env,context,objects,bucket,call,fetcher,upload,source,puts:()=>puts};
}
test('Storage: resumed encrypted copies preserve source, phone access and active storage',async t=>{
 const f=fixture(t),bytes=Buffer.from('Synthetic member: Erika Beispiel'),file={path:'Mitglieder/stammdaten.json',size:bytes.length,sha256:sha(bytes)};
 const before=f.db.prepare('SELECT * FROM ledger_meta').get(),account=f.db.prepare('SELECT * FROM accounts').get();
 const start=await f.call('start',{files:[file]});assert.equal(start.status,200);const {run}=start.data;
 assert.equal((await f.call('verify',{run})).status,409);
 let r=await f.upload(run,file,bytes);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,false);
 assert.equal(f.puts(),1);assert.equal(f.objects.size,1);
 assert.ok(!Buffer.from([...f.objects.values()][0]).includes(bytes));
 const manifest=f.db.prepare('SELECT manifest FROM storage_migrations').get().manifest;assert.ok(!manifest.includes(file.path));
 r=await f.upload(run,file,bytes);assert.equal((await r.json()).duplicate,true);assert.equal(f.puts(),1);
 const same=await f.call('start',{files:[file]});assert.equal(same.data.run,run);assert.equal(same.data.files,1);
 const read=await f.fetcher('https://test.account.workers.dev/admin/storage-migration/read',{method:'POST',headers:{Authorization:'Bearer '+f.env.ADMIN_TOKEN},body:JSON.stringify({source:f.source,run,fileId:sha(file.path)})});assert.equal(read.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(Buffer.from(await read.arrayBuffer()),bytes);
 const verified=await f.call('verify',{run});assert.equal(verified.data.state,'verified');assert.equal(verified.data.liveStorage,'onedrive');assert.equal((await f.call('status',{run})).data.state,'verified');
 assert.equal((await f.call('activate',{run})).status,404);
 assert.deepEqual(f.db.prepare('SELECT * FROM ledger_meta').get(),before);assert.deepEqual(f.db.prepare('SELECT * FROM accounts').get(),account);
});
test('Storage: server checks admin, source, membership of manifest and byte checksum',async t=>{
 const f=fixture(t),bytes=Buffer.from('a'),file={path:'test.pdf',size:1,sha256:sha(bytes)};
 assert.equal((await f.call('start',{files:[file]},'wrong')).status,401);
 assert.equal((await f.call('start',{files:[file],source:'f'.repeat(64)})).status,409);
 const {run}=(await f.call('start',{files:[file]})).data;
 assert.equal((await f.upload(run,file,Buffer.from('b'))).status,409);
 assert.equal((await f.upload(run,{...file,path:'other.pdf'},bytes)).status,404);
 assert.equal(f.puts(),0);assert.equal((await f.call('read',{run,fileId:sha(file.path)})).status,404);
 for(const path of ['../test.pdf','/test.pdf','a//b','a/./b','a\\b','a\u0000b'])assert.equal((await f.call('start',{files:[{...file,path}]})).status,400);
 assert.equal((await f.call('start',{files:[file,file]})).status,400);
 assert.equal((await f.call('start',{files:[{...file,size:8*1024*1024+1}]})).status,400);
 const r=await f.fetcher('https://test.account.workers.dev/admin/storage-migration/status',{method:'POST',headers:{Authorization:'Bearer '+f.env.ADMIN_TOKEN,Origin:'https://evil.invalid'},body:'{}'});assert.equal(r.status,403);
 delete f.env.MIGRATION_FILES;assert.equal((await f.call('status',{run})).status,503);
});
test('Storage: corrupted or missing R2 data never produces a verified receipt',async t=>{
 const f=fixture(t),bytes=Buffer.from('data'),file={path:'test.pdf',size:bytes.length,sha256:sha(bytes)},run=(await f.call('start',{files:[file]})).data.run;
 f.bucket.get=async()=>null;
 assert.equal((await f.upload(run,file,bytes)).status,503);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_migration_files').get().n,0);
 assert.equal((await f.call('verify',{run})).status,409);
 f.bucket.get=async key=>({arrayBuffer:async()=>{const bad=f.objects.get(key).slice();bad[15]^=1;return bad.buffer;}});
 assert.equal((await f.upload(run,file,bytes)).status,503);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM storage_migration_files').get().n,0);
});
test('Storage: manifests are independent; empty files round trip; oversized streams rejected',async t=>{
 const f=fixture(t),file={path:'empty.csv',size:0,sha256:sha('')},run=(await f.call('start',{files:[file]})).data.run;
 assert.equal((await f.upload(run,file,Buffer.alloc(0))).status,200);
 const next=(await f.call('start',{files:[{...file,path:'other.csv'}]})).data.run;assert.notEqual(next,run);
 assert.equal((await f.call('verify',{run:next})).status,409);
 assert.equal((await f.call('verify',{run})).status,200);
 assert.equal((await f.upload(run,file,Buffer.alloc(8*1024*1024+1))).status,413);
});
test('Storage importer: complete copy, repeat run and private progress against actual worker',async t=>{
 const f=fixture(t),directory=await fsp.mkdtemp(path.join(os.tmpdir(),'h2o-storage-'));t.after(()=>fsp.rm(directory,{recursive:true,force:true}));
 await fsp.mkdir(path.join(directory,'Berichte'));await fsp.writeFile(path.join(directory,'Berichte','probe.pdf'),'synthetic PDF bytes');await fsp.writeFile(path.join(directory,'feuerwehr-wasser-daten.json'),JSON.stringify({members:[{id:'synthetic-1'}],entries:[]}));
 const env={H2O_WORKER_ORIGIN:'https://test.account.workers.dev',H2O_ADMIN_TOKEN:f.env.ADMIN_TOKEN,H2O_SOURCE:'drive-fixture:root-fixture'},messages=[];
 const result=await migrate(directory,env,{fetcher:f.fetcher,log:x=>messages.push(x)});assert.equal(result.files,2);assert.equal(result.state,'verified');
 assert.equal((await migrate(directory,env,{fetcher:f.fetcher,log:()=>{}})).run,result.run);assert.equal(f.puts(),2);
 const output=messages.join(' ');for(const secret of [env.H2O_ADMIN_TOKEN,env.H2O_SOURCE,'probe.pdf','synthetic-1'])assert.ok(!output.includes(secret));
 assert.equal((await inventory(directory)).length,2);
 await fsp.symlink(path.join(directory,'feuerwehr-wasser-daten.json'),path.join(directory,'link'));await assert.rejects(inventory(directory),/Links/);
});
test('Storage importer: rejects redirects, invalid destination and changing exports',async t=>{
 assert.throws(()=>settings({H2O_WORKER_ORIGIN:'https://evil.invalid'}),/HTTPS/);
 const f=fixture(t),directory=await fsp.mkdtemp(path.join(os.tmpdir(),'h2o-storage-'));t.after(()=>fsp.rm(directory,{recursive:true,force:true}));
 await fsp.writeFile(path.join(directory,'test.json'),'before');
 const env={H2O_WORKER_ORIGIN:'https://test.account.workers.dev',H2O_ADMIN_TOKEN:f.env.ADMIN_TOKEN,H2O_SOURCE:'drive-fixture:root-fixture'};
 await assert.rejects(migrate(directory,env,{log:()=>{},fetcher:async(url,options)=>{assert.equal(options.redirect,'error');const r=await f.fetcher(url,options);if(url.endsWith('/start'))await fsp.writeFile(path.join(directory,'test.json'),'after');return r;}}),/verändert/);
 assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM storage_migrations WHERE state='verified'").get().n,0);
});
