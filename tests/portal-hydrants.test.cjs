const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {fixture}=require('./helpers/portal-fixture.cjs');
const pdf=Buffer.concat([Buffer.from('%PDF-1.5\n'),Buffer.alloc(280000,65),Buffer.from('\n%%EOF')]);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function begin(f,bytes=pdf){const r=await f.call('hydrants/begin',{size:bytes.length,sha256:digest(bytes)},null,true);assert.equal(r.status,200);return r.value.plan;}
async function chunks(f,plan,bytes=pdf){for(let part=0;part<plan.parts;part++){const r=await f.call('hydrants/chunk',{version:plan.version,part,bytes:bytes.subarray(part*plan.chunkSize,(part+1)*plan.chunkSize).toString('base64')},null,true);assert.equal(r.status,200,JSON.stringify(r.value));}}
test('Hydrantenplan: große Abschnitte sind verschlüsselt, Veröffentlichung atomar, Abruf vollständig',async()=>{
 const f=await fixture();assert.equal((await f.call('hydrants/info')).status,404);
 const plan=await begin(f);await chunks(f,plan);
 assert.equal((await f.call('hydrants/info')).status,404,'unfertige Veröffentlichung bleibt unsichtbar');
 const stored=f.sql.prepare('SELECT payload FROM portal_plan_chunks').all();assert.equal(stored.length,2);assert.ok(stored.every(r=>!r.payload.includes(pdf.subarray(0,80).toString('base64'))));
 assert.equal((await f.call('hydrants/publish',{version:plan.version},null,true)).status,200);
 assert.equal((await f.call('hydrants/info')).value.plan.sha256,digest(pdf));
 const parts=[];for(let part=0;part<plan.parts;part++){const r=await f.call('hydrants/part',{version:plan.version,part});assert.equal(r.status,200);parts.push(Buffer.from(r.value.bytes,'base64'));}
 assert.deepEqual(Buffer.concat(parts),pdf);
 const next=await begin(f);assert.equal((await f.call('hydrants/publish',{version:next.version},null,true)).status,409);assert.equal((await f.call('hydrants/info')).value.plan.version,plan.version);
 assert.equal((await f.call('hydrants/chunk',{version:plan.version,part:0,bytes:pdf.subarray(0,plan.chunkSize).toString('base64')},null,true)).status,409);
 await chunks(f,next);assert.equal((await f.call('hydrants/publish',{version:next.version},null,true)).status,200);
 assert.equal((await f.call('hydrants/part',{version:plan.version,part:0})).status,409,'alte Planversion kann nicht weitergelesen werden');
});
test('Hydrantenplan: falsche Hashes, Nicht-PDF, doppelte abweichende Abschnitte und Größen werden abgewiesen',async()=>{
 const f=await fixture();assert.equal((await f.call('hydrants/begin',{size:9000000,sha256:digest(pdf)},null,true)).status,400);
 const p=await begin(f);await chunks(f,p);const different=Buffer.from(pdf.subarray(0,p.chunkSize));different[15]=66;
 assert.equal((await f.call('hydrants/chunk',{version:p.version,part:0,bytes:different.toString('base64')},null,true)).status,409);
 assert.equal((await f.call('hydrants/chunk',{version:p.version,part:99,bytes:'AAAA'},null,true)).status,400);
 const bad=Buffer.from('not a pdf');const bp=await begin(f,bad);await chunks(f,bp,bad);assert.equal((await f.call('hydrants/publish',{version:bp.version},null,true)).status,409);
 const corrupt=await begin(f);const changed=Buffer.from(pdf);changed[25]=66;await chunks(f,corrupt,changed);assert.equal((await f.call('hydrants/publish',{version:corrupt.version},null,true)).status,409);
});
test('Hydrantenplan: nur angemeldete aktive Mitglieder lesen; Adminaktionen erfordern Admin und passende Quelle',async()=>{
 const f=await fixture(),p=await begin(f);await chunks(f,p);await f.call('hydrants/publish',{version:p.version},null,true);
 assert.equal((await f.call('hydrants/info',{},f.people[1])).status,200);
 for(const path of ['info','part'])assert.equal((await f.call('hydrants/'+path,{version:p.version,part:0},{...f.people[0],testToken:'invalid'})).status,401);
 assert.equal((await f.call('hydrants/begin',{size:pdf.length,sha256:digest(pdf)})).status,404);
 assert.equal((await f.call('hydrants/begin',{source:'wrong',size:pdf.length,sha256:digest(pdf)},null,true)).status,409);
 await f.DB.prepare('DELETE FROM accounts WHERE alias=?').bind(f.people[0].alias).run();
 assert.equal((await f.call('hydrants/info')).status,401);
});
