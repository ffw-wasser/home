const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture}=require('./helpers/portal-fixture.cjs'),E=require('../js/features/portal/member-evidence.js');
async function setup(){
 const f=await fixture({now:Date.parse('2026-10-22T12:00:00Z')});
 f.people=f.people.map((p,i)=>({...p,agt:i===0,evidence:E.project({breathingQualified:i===0,g263ValidUntil:'2026-01-01',agtInstructionValidUntil:'2026-01-01',ffiValidUntil:'2026-01-01',machinistVehicles:i<2?['LF']:[],driverLicenseCheckedOn:'2025-01-01',driverLicenseIntervalMonths:6})}));
 f.roster=async people=>{const result=await f.call('roster',{agtSource:'member-checkbox',members:people.map((p,i)=>({id:p.memberId,name:'Testperson '+(i+1),leader:i===0,agt:p.agt,evidence:p.evidence}))},null,true);assert.equal(result.status,200,JSON.stringify(result.value));};
 await f.roster(f.people);return f;
}
const job=(field='ffi',extra={})=>({field,checkedOn:'2026-10-20',responsibility:true,expectedVersion:0,requestId:randomUUID(),...extra});
const report=(f,data,p=f.people[0])=>f.call('evidence/report',data,p);
const review=(f,data)=>f.call('evidence/review',{memberId:f.people[0].memberId,...data},null,true);
test('Eigenangabe: owner, strict AGT assignment and driver eligibility are enforced by Worker',async()=>{
 const f=await setup();assert.equal((await report(f,job('ffi'),f.people[1])).status,403);
 assert.equal((await report(f,job('driver'),f.people[2])).status,403);
 assert.equal((await report(f,job('ffi',{memberId:f.people[1].memberId}))).status,403);
 const okay=await report(f,job());assert.equal(okay.status,200,JSON.stringify(okay.value));
 assert.equal(okay.value.evidence.breathing.ffi,'2027-10-20');assert.equal(okay.value.entries.ffi.source,'self');
 const other=await f.call('evidence',{},f.people[1]);assert.equal(other.value.entries.ffi.version,0);assert.deepEqual(other.value.history,[]);
});
test('Eigenangabe: invalid, future and unconfirmed inputs cannot alter dates or authority',async()=>{
 const f=await setup();for(const extra of [{responsibility:false},{checkedOn:'2026-02-30'},{checkedOn:'2026-10-23'},{until:'2099-01-01'},{agt:true},{field:'leader'},{expectedVersion:-1}])assert.ok([400,403].includes((await report(f,job('ffi',extra))).status),JSON.stringify(extra));
 for(const validMonth of ['2026-09','2030-01','bad'])assert.equal((await report(f,job('g263',{validMonth}))).status,400);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,0);
});
test('Eigenangabe: G26 uses documented month; other fields preserve current assessment rules',async()=>{
 const f=await setup();const med=await report(f,job('g263',{validMonth:'2027-05'}));assert.equal(med.status,200);assert.equal(med.value.evidence.medical.g263,'2027-05-31');assert.equal(med.value.evidence.breathing.g263,'2027-05-31');
 const ffi=await report(f,job());assert.equal(ffi.value.evidence.breathing.ffi,'2027-10-20');
 const instruction=await report(f,job('instruction'));assert.equal(instruction.value.evidence.breathing.instruction,'2027-10-20');
 const lower=await report(f,job('g262',{validMonth:'2027-05'}));assert.equal(lower.value.evidence.medical.g262,'2027-05-31');
 const gf=await f.call('gf-breathing');assert.equal(gf.value.people[0].status,'valid');assert.ok(gf.value.people[0].items.every(item=>item.source==='self'));
});
test('Führerschein: self-report cannot become a confirmed check or modify interval/vehicles',async()=>{
 const f=await setup(),r=await report(f,job('driver',{controller:'Test-Kontrollperson'}));assert.equal(r.status,200,JSON.stringify(r.value));
 assert.equal(r.value.entries.driver.status,'pending');assert.equal(r.value.evidence.driver.checkedOn,'2025-01-01');assert.equal(r.value.evidence.driver.intervalMonths,6);
 assert.equal((await report(f,job('driver',{intervalMonths:36}))).status,400);
 const confirm=await review(f,{field:'driver',action:'confirm',expectedVersion:1,requestId:randomUUID()});assert.equal(confirm.status,200,JSON.stringify(confirm.value));assert.equal(confirm.value.entries.driver.status,'confirmed');assert.equal(confirm.value.entries.driver.source,'admin');assert.equal(confirm.value.evidence.driver.checkedOn,'2026-10-20');
});
test('Review: member tokens cannot confirm, reject or impersonate administration',async()=>{
 const f=await setup();await report(f,job('driver'));
 assert.equal((await report(f,job('driver',{action:'confirm',expectedVersion:1}))).status,400);
 const body={memberId:f.people[0].memberId,field:'driver',action:'confirm',expectedVersion:1,requestId:randomUUID()};
 assert.equal((await f.call('evidence/review',body)).status,404);
 const record=f.people[0],token=await require('node:vm').runInContext('(env,p)=>capability(env,p.alias,p.revision,"commands")',f.c)(f.env,record);
 const response=await f.c.worker.fetch(new Request('https://test.example/admin/portal/evidence/review',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({source:'test-source',...body})}),f.env);assert.equal(response.status,401);
});
test('Idempotency: lost responses and conflicting versions do not create duplicate events',async()=>{
 const f=await setup(),data=job();const a=await report(f,data),b=await report(f,data);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(b.value.receipt,data.requestId);assert.equal(b.value.entries.ffi.version,1);
 assert.equal((await report(f,{...data,checkedOn:'2026-10-19'})).status,409);
 assert.equal((await report(f,job())).status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,1);
});
test('Encryption and transaction: failed audit rolls back entry and dates remain absent from plaintext',async()=>{
 const f=await setup(),data=job('driver',{controller:'CONFIDENTIAL-TEST'});f.failBatch();assert.equal((await report(f,data)).status,503);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_entries').get().n,0);
 assert.equal((await report(f,data)).status,200);
 for(const table of ['portal_evidence_entries','portal_evidence_audit']){const text=JSON.stringify(f.sql.prepare('SELECT * FROM '+table).all());assert.ok(!text.includes('CONFIDENTIAL-TEST'));assert.ok(!text.includes('2026-10-20'));}
});
test('Administrative sync: unchanged baseline preserves own entries; explicit changed baseline supersedes them',async()=>{
 const f=await setup();await report(f,job());await f.roster(f.people);
 assert.equal((await f.call('evidence')).value.evidence.breathing.ffi,'2027-10-20');
 f.people[0].evidence.breathing.ffi='2028-01-01';await f.roster(f.people);
 let r=(await f.call('evidence')).value;assert.equal(r.evidence.breathing.ffi,'2028-01-01');assert.equal(r.entries.ffi.source,'admin');assert.equal(r.history.length,1);
 f.people[0].evidence.breathing.ffi='2026-01-01';await f.roster(f.people);r=(await f.call('evidence')).value;assert.equal(r.evidence.breathing.ffi,'2026-01-01','old self-report never reappears');
});
test('Reject/correct: previous administrative values and complete history are retained',async()=>{
 const f=await setup();await report(f,job());const rejected=await review(f,{field:'ffi',action:'reject',expectedVersion:1,requestId:randomUUID()});assert.equal(rejected.status,200);assert.equal(rejected.value.evidence.breathing.ffi,'2026-01-01');
 const correct=await review(f,{field:'ffi',action:'correct',checkedOn:'2026-10-10',expectedVersion:2,requestId:randomUUID()});assert.equal(correct.status,200);assert.equal(correct.value.evidence.breathing.ffi,'2027-10-10');assert.equal(correct.value.history.length,3);
});
test('Removed qualification or member cannot write or see former personal evidence',async()=>{
 const f=await setup();await report(f,job());f.people[0].agt=false;await f.roster(f.people);assert.equal((await report(f,job('ffi',{expectedVersion:1}))).status,403);
 await f.roster(f.people.slice(1));assert.equal((await f.call('evidence')).status,401);assert.equal((await report(f,job())).status,401);
});

test('New pending or rejected driver report preserves the last confirmed portal check',async()=>{
 const f=await setup();await report(f,job('driver'));
 await review(f,{field:'driver',action:'confirm',expectedVersion:1,requestId:randomUUID()});
 const pending=await report(f,job('driver',{checkedOn:'2026-10-21',expectedVersion:2}));assert.equal(pending.status,200);assert.equal(pending.value.evidence.driver.checkedOn,'2026-10-20');
 const reject=await review(f,{field:'driver',action:'reject',expectedVersion:3,requestId:randomUUID()});assert.equal(reject.value.evidence.driver.checkedOn,'2026-10-20');
});

test('Concurrent roster/ledger changes reject evidence writes without audit or partial state',async()=>{
 const f=await setup(),batch=f.DB.batch;
 f.DB.batch=async statements=>{if(statements.some(s=>s.query.startsWith('INSERT INTO portal_evidence_entries')))f.sql.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1').run();return batch(statements);};
 const r=await report(f,job());assert.equal(r.status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_entries').get().n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,0);
});

test('Legacy capability without a portal Passkey session cannot submit evidence',async()=>{
 const f=await fixture({authenticated:false});const result=await f.call('evidence/report',job());assert.equal(result.status,401);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_entries').get().n,0);
});

test('Personal write limit preserves idempotent retries after the daily cap',async()=>{
 const f=await setup(),first=job();assert.equal((await report(f,first)).status,200);
 for(let version=1;version<20;version++)assert.equal((await report(f,job('ffi',{expectedVersion:version}))).status,200);
 assert.equal((await report(f,job('ffi',{expectedVersion:20}))).status,429);
 assert.equal((await report(f,first)).status,200,'known receipt can still be checked');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,20);
});

test('Changing AGT assignment preserves an independently confirmed driving check',async()=>{
 const f=await setup();await report(f,job('driver'));await review(f,{field:'driver',action:'confirm',expectedVersion:1,requestId:randomUUID()});
 f.people[0].agt=false;await f.roster(f.people);const r=await f.call('evidence');assert.equal(r.value.evidence.driver.checkedOn,'2026-10-20');assert.equal(r.value.eligibility.agt,false);
});

test('Admin overview finds existing unreviewed reports across members without changing evidence or audit',async()=>{
 const f=await setup();await report(f,job());await report(f,job('g263',{validMonth:'2027-05'}));await report(f,job('driver'),f.people[1]);
 const before=f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n;
 const response=await f.call('evidence/overview',{},null,true);assert.equal(response.status,200,JSON.stringify(response.value));
 const {items,count,memberCount}=response.value;assert.equal(count,3);assert.equal(memberCount,2);
 assert.deepEqual(items.map(item=>[item.name,item.field,item.status]),[['Testperson 1','ffi','reported'],['Testperson 1','g263','reported'],['Testperson 2','driver','pending']]);
 assert.equal(items[0].checkedOn,'2026-10-20');assert.equal(items[0].confirmedValue,'2026-01-01');assert.equal(items[0].version,1);
 assert.ok(items.every(item=>!('alias' in item)&&!('revision' in item)&&!('evidence' in item)&&!('controller' in item)));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_evidence_audit').get().n,before);
 assert.equal((await f.call('evidence',{},f.people[1])).value.evidence.driver.checkedOn,'2025-01-01');
});
test('Admin overview removes confirmed, rejected, superseded and ineligible reports',async()=>{
 const f=await setup();await report(f,job());await report(f,job('instruction'));await report(f,job('driver'),f.people[1]);
 await review(f,{field:'ffi',action:'confirm',expectedVersion:1,requestId:randomUUID()});
 await review(f,{field:'instruction',action:'reject',expectedVersion:1,requestId:randomUUID()});
 let result=await f.call('evidence/overview',{},null,true);assert.equal(result.value.count,1);assert.equal(result.value.items[0].memberId,f.people[1].memberId);
 f.people[1].evidence.driver.checkedOn='2026-10-21';await f.roster(f.people);assert.equal((await f.call('evidence/overview',{},null,true)).value.count,0);
 await report(f,job('g263',{validMonth:'2027-05'}));f.people[0].agt=false;await f.roster(f.people);assert.equal((await f.call('evidence/overview',{},null,true)).value.count,0);
 f.people[0].agt=true;await f.roster(f.people);await report(f,job('ffi',{expectedVersion:2}));await f.roster(f.people.slice(1));assert.equal((await f.call('evidence/overview',{},null,true)).value.count,0);
});
test('Central evidence overview is admin-only and bound to the current data source',async()=>{
 const f=await setup();await report(f,job());
 assert.equal((await f.call('evidence/overview')).status,404);
 const request=new Request('https://test.example/admin/portal/evidence/overview',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+await require('node:vm').runInContext('(env,r)=>capability(env,r.alias,r.revision,"commands")',f.c)(f.env,f.people[0]),'Content-Type':'application/json'},body:JSON.stringify({source:'test-source'})});
 assert.equal((await f.c.worker.fetch(request,f.env)).status,401);
 assert.notEqual((await f.call('evidence/overview',{source:'another-folder'},null,true)).status,200);
 await f.DB.prepare('DELETE FROM portal_roster WHERE id=1').run();const missing=await f.call('evidence/overview',{},null,true);assert.equal(missing.status,503);assert.ok(!('items' in missing.value));
});
