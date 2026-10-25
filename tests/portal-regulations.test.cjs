const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {fixture}=require('./helpers/portal-fixture.cjs');
const ctx=vm.createContext({URL});vm.runInContext(fs.readFileSync(require.resolve('../js/features/portal/regulations-model.js'),'utf8'),ctx);
const M=ctx.RegulationsModel;
test('Dienstvorschriften: offizielle Grundauswahl, keine externen, aktiven oder umgeleiteten PDF-Adressen',()=>{
 const items=M.defaults();assert.equal(items.length,6);assert.equal(items[0].label,'FwDV 3');assert.equal(M.validate(items).length,6);
 for(const url of ['javascript:alert(1)','http://www.lfs-bw.de/test.pdf','https://evil.example/test.pdf','https://www.lfs-bw.de.evil.example/test.pdf',items[0].url+'?redirect=evil',items[0].url+'#secret',items[0].url.replace('.pdf','.html'),'https://x:y@www.lfs-bw.de/fileadmin/LFS-BW/test.pdf'])assert.equal(M.pdfUrl(url),null,url);
 assert.throws(()=>M.validate([...items,items[0]]));assert.throws(()=>M.validate([{...items[0],title:'<script>'}]));assert.throws(()=>M.validate([{...items[0],sourceUpdated:'2026-02-31'}]));
});
test('Dienstvorschriften: nur berechtigte Zugriffe, verschlüsselte Auswahl und Konfliktschutz',async()=>{
 const f=await fixture(),initial=await f.call('regulations');assert.equal(initial.status,200);assert.equal(initial.value.version,0);assert.equal(initial.value.items.length,6);
 const items=[{...initial.value.items[2],title:'Testtitel Atemschutz'},initial.value.items[0]];
 const saved=await f.call('regulations',{items,expectedVersion:0},null,true);assert.equal(saved.status,200);assert.equal(saved.value.version,1);
 assert.ok(!f.sql.prepare('SELECT payload FROM portal_regulations WHERE id=1').get().payload.includes('Testtitel Atemschutz'));
 assert.deepEqual((await f.call('regulations')).value.items,items);
 assert.equal((await f.call('regulations',{items:[],expectedVersion:0},null,true)).status,409);
 assert.equal((await f.call('regulations',{items:[{...items[0],url:'https://evil.example/test.pdf'}],expectedVersion:1},null,true)).status,400);
 // A member cannot replace the shared selection by posting admin-shaped data.
 await f.call('regulations',{items:[],expectedVersion:1});assert.deepEqual((await f.call('regulations')).value.items,items);
 const denied=await f.c.worker.fetch(new Request('https://test.example/portal/regulations',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer invalid','Content-Type':'application/json'},body:JSON.stringify({alias:f.people[0].alias,revision:f.people[0].revision})}),f.env);assert.equal(denied.status,401);
 assert.equal((await f.call('regulations',{items:[],expectedVersion:1},null,true)).status,200);assert.deepEqual((await f.call('regulations')).value.items,[]);
});
