const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
const policy=(f,patch={})=>f.call('reminder-policy',{enabled:true,daysBefore:1,time:'19:30',expectedVersion:0,...patch},null,true);
async function subscribe(f){for(const person of f.people)assert.equal((await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+person.memberId},person)).status,200);}
test('Automatic reminder defaults are inactive and editing requires administrator/source/version',async()=>{
 const f=await fixture();assert.equal((await f.call('reminder-policy')).status,404);
 const denied=await f.c.worker.fetch(new Request('https://test.example/admin/portal/reminder-policy',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io','Content-Type':'application/json',Authorization:'Bearer invalid'},body:JSON.stringify({source:'test-source',enabled:true,daysBefore:1,time:'19:30',expectedVersion:0})}),f.env);assert.equal(denied.status,401);
 const initial=(await f.call('reminder-policy',{},null,true)).value;assert.equal(initial.value.enabled,false);assert.equal(initial.value.time,'19:30');assert.equal(initial.value.daysBefore,1);
 assert.equal((await policy(f)).status,200);assert.equal((await policy(f)).status,409);
 for(const patch of [{expectedVersion:1,time:'24:00'},{expectedVersion:1,time:'19:3'},{expectedVersion:1,daysBefore:8},{expectedVersion:1,daysBefore:-1},{expectedVersion:1,daysBefore:1.5},{expectedVersion:1,enabled:'true'}])assert.equal((await policy(f,patch)).status,400);
 assert.equal((await policy(f,{expectedVersion:1,enabled:false,daysBefore:0,time:'08:05'})).status,200);
 assert.equal((await f.call('reminder-policy',{},null,true)).value.value.time,'08:05');
});
for(const [name,date,before,due] of [
 ['winter','2026-11-01T12:00:00Z','2026-11-01T18:29:00Z','2026-11-01T18:30:00Z'],
 ['summer','2026-07-01T12:00:00Z','2026-07-01T17:29:00Z','2026-07-01T17:30:00Z'],
 ['DST begins next day','2026-03-28T12:00:00Z','2026-03-28T18:29:00Z','2026-03-28T18:30:00Z'],
 ['DST ends next day','2026-10-24T12:00:00Z','2026-10-24T17:29:00Z','2026-10-24T17:30:00Z']])test('Berlin calendar-day scheduling: '+name,async()=>{
 const f=await fixture({now:Date.parse(date)});await subscribe(f);assert.equal((await policy(f)).status,200);
 f.clock.now=Date.parse(before);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);
 f.clock.now=Date.parse(due);await Promise.all([f.c.PortalService.scheduled(f.env),f.c.PortalService.scheduled(f.env)]);assert.equal(new Set(f.sends.map(s=>s.url)).size,f.sends.length,'concurrent Cron ticks do not duplicate devices');
 for(let i=0;i<4;i++){f.clock.now+=60000;await f.c.PortalService.scheduled(f.env);}
 assert.equal(f.sends.length,5);assert.equal(new Set(f.sends.map(s=>s.url)).size,5);
 f.clock.now+=60000;await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,5,'completed campaign stays complete');
});
test('Only current recipients receive reminders; excused members are skipped',async()=>{
 const f=await fixture({now:Date.parse('2026-11-01T12:00:00Z')}),cal=(await f.call('list',{},null,true)).value,e=cal.events[0];await subscribe(f);
 await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Sonderprobe',approved:true,recipientIds:f.people.slice(0,3).map(p=>p.memberId),expectedVersion:cal.rulesVersion},null,true);
 await f.call('reply',{eventId:e.id,status:'excused',expectedVersion:0,requestId:crypto.randomUUID()},f.people[1]);await policy(f);
 f.clock.now=Date.parse('2026-11-01T18:30:00Z');await f.c.PortalService.scheduled(f.env);
 assert.deepEqual(f.sends.map(s=>s.url).sort(),['https://fcm.googleapis.com/member-1','https://fcm.googleapis.com/member-3']);
});
test('Late activation does not send already-due reminders; disabling stops remaining recipients',async()=>{
 const f=await fixture({now:Date.parse('2026-11-01T12:00:00Z')});await subscribe(f);
 f.clock.now=Date.parse('2026-11-01T18:31:00Z');await policy(f);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);
 await policy(f,{expectedVersion:1,time:'19:32'});f.clock.now=Date.parse('2026-11-01T18:32:00Z');await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,2);
 await policy(f,{expectedVersion:2,enabled:false});f.clock.now+=60000;await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,2);
});
test('Same-day reminders support custom times without changing legacy calendar connection settings',async()=>{
 const f=await fixture({now:Date.parse('2026-11-01T12:00:00Z')});await subscribe(f);await policy(f,{daysBefore:0,time:'08:05'});
 f.clock.now=Date.parse('2026-11-02T07:04:00Z');await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);
 f.clock.now+=60000;await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,2);
 const config=(await f.call('config',{},null,true)).value.config;await f.call('configure',{calendarUrl:config.calendarUrl,leadHours:12,reminders:false},null,true);
 assert.equal((await f.call('reminder-policy',{},null,true)).value.value.enabled,true);
});
test('An unconfirmed calendar and suspended membership service never trigger automatic delivery',async()=>{
 const f=await fixture({now:Date.parse('2026-11-01T12:00:00Z')});await subscribe(f);await policy(f);f.clock.now=Date.parse('2026-11-01T18:30:00Z');
 f.offline(true);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);
 f.offline(false);f.sql.prepare("UPDATE ledger_meta SET state='staging'").run();await assert.rejects(f.c.PortalService.scheduled(f.env));assert.equal(f.sends.length,0);
});
test('Revoked accounts and removed recipient membership are excluded at dispatch time',async()=>{
 const f=await fixture({now:Date.parse('2026-11-01T12:00:00Z')});await subscribe(f);await policy(f);
 f.sql.prepare("UPDATE accounts SET revision='revoked' WHERE alias=?").run(f.people[0].alias);
 const row=f.sql.prepare('SELECT * FROM portal_roster WHERE id=1').get(),roster=await f.L.open(f.env,row.payload,'portal-roster');roster.members=roster.members.filter(p=>p.id!==f.people[1].memberId);f.sql.prepare('UPDATE portal_roster SET payload=?').run(await f.L.seal(f.env,roster,'portal-roster'));
 f.clock.now=Date.parse('2026-11-01T18:30:00Z');for(let i=0;i<3;i++){await f.c.PortalService.scheduled(f.env);f.clock.now+=60000;}
 assert.deepEqual(f.sends.map(s=>s.url).sort(),f.people.slice(2).map(p=>'https://fcm.googleapis.com/'+p.memberId));
});
