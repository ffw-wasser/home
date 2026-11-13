const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto,createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const file of ['schema.sql','central.sql','storage-migration.sql','storage-state.sql','storage-files.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../../cloudflare/push',file),'utf8'));
 // Existing identity must never be rewritten by snapshot staging.
 db.prepare("INSERT INTO ledger_meta VALUES(1,?,'active',17,?)").run('drive-fixture:root-fixture','original-policy');
 db.prepare('INSERT INTO accounts(alias,revision,last_sent) VALUES(?,?,?)').run('a'.repeat(32),'original-revision',123);
 let queries=0,beforeBatch=null;
 const DB={async batch(statements){if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn();}db.exec('BEGIN');try{const result=statements.map(s=>s.sync());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},prepare(sql){let args=[];const stmt={bind(...values){args=values;return stmt;},async first(){queries++;return db.prepare(sql).get(...args)||null;},async all(){queries++;return {results:db.prepare(sql).all(...args)};},sync(){queries++;return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};},async run(){return stmt.sync();}};return stmt;}};
 const objects=new Map();let puts=0;
 const bucket={async put(key,bytes){puts++;objects.set(key,new Uint8Array(bytes));},async get(key){const value=objects.get(key);return value?{async arrayBuffer(){return value.slice().buffer;}}:null;}};
 const env={DB,MIGRATION_FILES:bucket,ADMIN_TOKEN:'a'.repeat(64),INVITE_SECRET:'b'.repeat(64),VAPID_PRIVATE_JWK:'{}',VAPID_PUBLIC_KEY:'public-key'};
 const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,URL,Request,Response,Headers,btoa,atob,Date,console});
 for(const file of ['central.js','storage-migration.js','storage-state.js','storage-files.js','worker.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../cloudflare/push',file),'utf8').replace('export default {','globalThis.worker={'),context);
 const source=sha('drive-fixture:root-fixture');
 async function fetcher(url,options){queries=0;const response=await context.worker.fetch(new Request(url,options),env,{});assert.ok(queries<=50,'Free query budget');return response;}
 async function call(action,data={},token=env.ADMIN_TOKEN){const r=await fetcher('https://test.account.workers.dev/admin/storage-migration/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://ffw-wasser.github.io','Content-Type':'application/json'},body:JSON.stringify({source,...data})});return {status:r.status,data:await r.json()};}
 async function upload(run,file,bytes){return fetcher('https://test.account.workers.dev/admin/storage-migration/upload?'+new URLSearchParams({source,run,file:sha(file.path)}),{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN},body:bytes});}
 return {db,env,context,objects,bucket,call,fetcher,upload,source,race:fn=>beforeBatch=fn,puts:()=>puts};
}
module.exports={fixture,sha};
