const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{fixture}=require('./helpers/portal-fixture.cjs');
async function setup(){
 const f=await fixture({now:Date.parse('2026-11-07T12:00:00Z')}),E=f.c.MemberEvidence;
 f.members=f.people.map((p,i)=>({id:p.memberId,name:'Beispiel '+i,leader:i===0,agt:true,replyRoles:i===0?['ATF','Maschinist']:i===1?['Maschinist']:i===3?['ATF']:[],evidence:E.project({breathingQualified:true,g263ValidUntil:'2027-05-31',agtInstructionValidUntil:'2027-05-31',ffiValidUntil:'2027-05-31'})}));
 f.upload=async(extra={})=>assert.equal((await f.call('roster',{members:f.members,replyFunctionsVersion:1,agtSource:'member-checkbox',...extra},null,true)).status,200);
 await f.upload();f.event=(await f.call('list')).value.events[0];
 for(const p of f.people){assert.equal((await f.call('evidence/consent',{granted:true,textVersion:f.c.G26Consent.version,expectedVersion:0},p)).status,200);}
 for(const p of f.people.slice(0,4))assert.equal((await f.call('reply',{eventId:f.event.id,status:'yes',expectedVersion:0,requestId:randomUUID()},p)).status,200);
 f.overview=async()=>{const r=await f.call('overview',{eventId:f.event.id});assert.equal(r.status,200);return r.value;};
 f.roles=async()=>JSON.parse(JSON.stringify((await f.overview()).members.map(m=>m.functions||null)));
 return f;
}
test('Rückmeldung: AGT ohne ATF werden erfasst; Gruppenführer und Maschinisten bleiben ausschließlich in ihrer Rubrik',async()=>{
 const f=await setup();f.members[3].agt=false;await f.upload();
 assert.deepEqual(await f.roles(),[['GF'],['Maschinist'],['AGT'],[],null]);
 const view=await f.overview();assert.equal(view.functionsVersion,2);
 assert.ok(view.members.every(m=>Object.keys(m).every(k=>['name','status','functions','breathingNeedsCheck'].includes(k))),'keine Nachweise, Fristen, Einwilligungen oder IDs in der Übersicht');
 assert.equal((await f.call('overview',{eventId:f.event.id,leader:true},f.people[2])).status,403);
});
test('Rückmeldung: alle AGT bleiben sichtbar; fehlende oder abgelaufene Nachweise werden markiert',async()=>{
 const f=await setup(),m=f.members[2],original=structuredClone(m.evidence);
 for(const field of ['g263','instruction','ffi'])for(const value of ['', '2026-11-06']){
  m.evidence=structuredClone(original);m.evidence.breathing[field]=value;await f.upload();assert.deepEqual((await f.roles())[2],['AGT'],field+': '+value);assert.equal((await f.overview()).members[2].breathingNeedsCheck,true);
 }
 m.evidence=structuredClone(original);m.evidence.breathing.ffi='2026-11-07';await f.upload();assert.equal((await f.overview()).members[2].breathingNeedsCheck,false,'bis einschließlich heute gültig');
 m.evidence.breathing.ffi='2026-11-20';await f.upload();assert.equal((await f.overview()).members[2].breathingNeedsCheck,false,'bald fällig bleibt gültig');
 m.evidence.breathing=null;await f.upload();assert.deepEqual((await f.roles())[2],['AGT']);assert.equal((await f.overview()).members[2].breathingNeedsCheck,true);
});
test('Rückmeldung: Einwilligung, Checkbox, Aktualität und Terminempfänger werden serverseitig berücksichtigt',async()=>{
 const f=await setup();await f.call('evidence/consent',{granted:false,textVersion:f.c.G26Consent.version,expectedVersion:1},f.people[2]);assert.deepEqual((await f.roles())[2],['AGT']);assert.equal((await f.overview()).members[2].breathingNeedsCheck,true);
 await f.call('evidence/consent',{granted:true,textVersion:f.c.G26Consent.version,expectedVersion:2},f.people[2]);assert.equal((await f.overview()).members[2].breathingNeedsCheck,false);
 await f.upload({agtSource:undefined});assert.deepEqual((await f.roles())[2],[],'alte Rollenprojektion reicht nicht');await f.upload();
 f.clock.now+=8*86400000;assert.deepEqual((await f.roles())[2],['AGT']);assert.equal((await f.overview()).members[2].breathingNeedsCheck,true,'alter Mitgliederabgleich ist keine bestätigte Verfügbarkeit');f.clock.now-=8*86400000;
 const cal=(await f.call('list',{},null,true)).value;assert.equal((await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,recipientIds:[f.people[0].memberId],expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.deepEqual((await f.overview()).members.map(m=>m.name),['Beispiel 0']);
});
test('Rückmeldung: aktuelle Eigenangaben ersetzen abgelaufene Nachweise ohne ATF-Zuordnung',async()=>{
 const f=await setup();f.members[2].evidence.breathing.ffi='2026-01-01';await f.upload();assert.equal((await f.overview()).members[2].breathingNeedsCheck,true);
 assert.equal((await f.call('evidence/report',{field:'ffi',checkedOn:'2026-11-06',responsibility:true,expectedVersion:0,requestId:randomUUID()},f.people[2])).status,200);
 assert.deepEqual((await f.roles())[2],['AGT']);assert.equal((await f.overview()).members[2].breathingNeedsCheck,false);
});
