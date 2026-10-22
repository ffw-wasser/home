const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/portal-fixture.cjs');
async function setup(){const f=await fixture(),event=(await f.call('list')).value.events[0];return {...f,event};}
const contact=(f,i,allowed=true,phone='+49 151 0000000'+i)=>f.call('whatsapp-contact',{eventId:f.event.id,memberId:f.people[i].memberId,phone,allowed},null,true);
const reply=(f,i,status)=>f.call('reply',{eventId:f.event.id,status,expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[i]);
test('WhatsApp selects only open/maybe, encrypts contacts and rechecks changed replies without sending',async()=>{
 const f=await setup();for(let i=0;i<4;i++)assert.equal((await contact(f,i)).status,200);
 await reply(f,1,'maybe');await reply(f,2,'yes');await reply(f,3,'excused');
 const r=await f.call('whatsapp-recipients',{eventId:f.event.id});assert.equal(r.status,200);
 assert.deepEqual(r.value.members.filter(m=>m.eligible&&m.phone).map(m=>m.id),f.people.slice(0,2).map(p=>p.memberId));
 assert.equal(r.value.members[4].phone,null);assert.equal(r.value.members[2].phone,null);assert.equal(r.value.members[0].contactPhone,undefined);
 const raw=f.sql.prepare('SELECT payload FROM portal_roster').get().payload;assert.ok(!raw.includes('491510000000'));
 await reply(f,0,'yes');const checked=await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[0].memberId});assert.equal(checked.value.eligible,false);assert.equal(checked.value.phone,null);
 assert.equal(f.sends.length,0);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_sends').get().n,0);
});
test('WhatsApp requires role, session, contact permission and current event audience',async()=>{
 const f=await setup();assert.equal((await f.call('whatsapp-recipients',{eventId:f.event.id},f.people[1])).status,403);
 assert.equal((await f.call('whatsapp-events',{},f.people[1])).status,403);
 assert.equal((await f.call('whatsapp-contact',{eventId:f.event.id,memberId:f.people[0].memberId,phone:'+4915100000000',allowed:true})).status,403);
 assert.equal((await contact(f,0,true,'javascript:123')).status,400);await contact(f,0,false);
 assert.equal((await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[0].memberId})).value.phone,null);
 const cal=(await f.call('list',{},null,true)).value;
 await f.call('classify',{eventId:f.event.id,kind:'probe',sessionType:'Sonderprobe',approved:true,recipientIds:[f.people[0].memberId],expectedVersion:cal.rulesVersion},null,true);
 assert.equal((await f.call('whatsapp-recipients',{eventId:f.event.id})).value.members.length,1);
 assert.equal((await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[1].memberId})).value.eligible,false);
 const group=(await f.call('whatsapp-events')).value.events[0];assert.equal(group.audienceRestricted,true);assert.equal(group.recipientIds,undefined);assert.equal(group.members,undefined);
 const unauthed=await fixture({authenticated:false});assert.equal((await unauthed.call('whatsapp-events')).status,401);
});
test('Contact mapping survives roster sync, disappears on removal, and can be cleared',async()=>{
 const f=await setup();await contact(f,0);const roster=f.people.map((p,i)=>({id:p.memberId,name:'Synthetic '+i,firstName:'Test'+i,leader:i===0}));
 await f.call('roster',{members:roster},null,true);let r=await f.call('whatsapp-recipients',{eventId:f.event.id});assert.ok(r.value.members[0].phone);assert.equal(r.value.members[0].firstName,'Test0');
 await contact(f,0,false,'');r=await f.call('whatsapp-recipients',{eventId:f.event.id});assert.equal(r.value.members[0].phone,null);
 await contact(f,1);await f.call('roster',{members:roster.filter(p=>p.id!==f.people[1].memberId)},null,true);r=await f.call('whatsapp-recipients',{eventId:f.event.id});assert.ok(!r.value.members.some(p=>p.id===f.people[1].memberId));
});
test('Stale, started and cancelled events cannot prepare reminders',async()=>{
 const f=await setup();f.offline(true);f.clock.now+=901000;assert.equal((await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[0].memberId})).status,503);
 f.offline(false);f.clock.now=f.event.start+1;assert.notEqual((await f.call('whatsapp-recipients',{eventId:f.event.id})).status,200);
});
test('Messages contain public links, clothing and multiple dates without credentials or member data in group text',()=>{
 const c=vm.createContext({URL,Intl,Date,location:{href:'https://example.org/deckel.html?secret=private#token'}});vm.runInContext(fs.readFileSync('js/features/portal/portal-reminders.js','utf8'),c);const e={id:'public-event',title:'Testprobe',sessionType:'Probe',start:Date.parse('2030-06-12T17:00Z'),location:'GH Wasser',clothing:'Einsatz'};
 const text=c.H2OReminders.individual(e,{firstName:'Anna'});assert.ok(text.includes('Hallo Anna'));assert.ok(text.includes('Einsatzkleidung'));assert.ok(text.includes('termin.html?event=public-event'));assert.ok(!/secret|private|token/.test(text));
 const group=c.H2OReminders.group([e,{...e,id:'other',title:'Unterricht',members:[{name:'PrivateName'}],status:'excused'}]);assert.ok(group.includes('Unterricht'));assert.equal(group.match(/🔗/g).length,2);assert.ok(!/PrivateName|excused|secret|token/.test(group));
 assert.equal(c.H2OReminders.eligible({status:'yes'}),false);assert.equal(c.H2OReminders.eligible({status:'maybe'}),true);
});
test('Preparation denies a removed GF role and an explicitly cancelled event',async()=>{
 const f=await setup();await f.call('roster',{members:f.people.map((p,i)=>({id:p.memberId,name:'Test '+i,leader:false}))},null,true);
 assert.equal((await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[1].memberId})).status,403);
 const cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:f.event.id,kind:'probe',approved:false,expectedVersion:cal.rulesVersion},null,true);
 assert.equal((await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[1].memberId},null,true)).status,404);
});
test('Failed contact transaction changes neither contact nor synchronization sequence',async()=>{
 const f=await setup(),before=f.sql.prepare('SELECT seq FROM ledger_meta').get().seq;f.failBatch();assert.equal((await contact(f,0)).status,503);
 assert.equal(f.sql.prepare('SELECT seq FROM ledger_meta').get().seq,before);assert.equal((await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[0].memberId})).value.phone,null);
});

test('Terminlink meldet nicht eingeladene Mitglieder ohne Termindetails',async()=>{
 const f=await setup(),id=f.event.id;
 const before=await f.call('list',{eventId:id},f.people[1]);
 assert.equal(before.status,200);assert.equal(before.value.eventLinkStatus,null);
 const cal=(await f.call('list',{},null,true)).value;
 await f.call('classify',{eventId:id,kind:'probe',sessionType:'Sonderprobe',approved:true,recipientIds:[f.people[0].memberId],expectedVersion:cal.rulesVersion},null,true);
 const excluded=await f.call('list',{eventId:id},f.people[1]);
 assert.equal(excluded.status,200);assert.equal(excluded.value.eventLinkStatus,'not-relevant');
 assert.equal(excluded.value.events.some(e=>e.id===id),false);
 const invited=await f.call('list',{eventId:id},f.people[0]);
 assert.equal(invited.value.eventLinkStatus,null);
 assert.equal(invited.value.events.some(e=>e.id===id),true);
});

test('Organizer is excluded from personal WhatsApp reminders, including direct prepare',async()=>{
 const f=await setup();
 await contact(f,0);
 await contact(f,1);
 const list=await f.call('whatsapp-recipients',{eventId:f.event.id},f.people[0]);
 assert.equal(list.status,200);
 assert.ok(!list.value.members.some(m=>m.id===f.people[0].memberId));
 assert.ok(list.value.members.some(m=>m.id===f.people[1].memberId));
 const own=await f.call('whatsapp-prepare',{eventId:f.event.id,memberId:f.people[0].memberId},f.people[0]);
 assert.equal(own.value.eligible,false);
 assert.equal(own.value.phone,null);
});
