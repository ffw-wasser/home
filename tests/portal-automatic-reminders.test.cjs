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
 const stamp=f.sql.prepare('SELECT reminded_at FROM portal_event_reminders').get().reminded_at;
 f.clock.now+=60000;await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,5,'completed campaign stays complete');assert.equal(f.sql.prepare('SELECT reminded_at FROM portal_event_reminders').get().reminded_at,stamp,'an idle Cron tick never claims a fresh reminder was sent');
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
async function mixedDevices(f){
 const person=f.people[0];f.c.NativePush.ready=f.c.AndroidPush.ready=()=>true;
 assert.equal((await f.call('native-push',{action:'subscribe',deviceToken:'ab'.repeat(32)},person)).status,200);
 assert.equal((await f.call('native-push',{action:'subscribe',platform:'android',deviceToken:'synthetic-android-token-0001'},person)).status,200);
 assert.equal((await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/synthetic-web-device'},person)).status,200);
 const warnings=[],summaries=[];f.c.console={warn:(...args)=>warnings.push(args),info:(...args)=>summaries.push(args)};
 return {person,warnings,summaries};
}
test('Automatic dispatch diagnoses each transport for multiple devices of the same member without exposing provider data',async()=>{
 const f=await fixture({now:Date.parse('2026-11-01T12:00:00Z')}),{warnings,summaries}=await mixedDevices(f);
 f.c.NativePush.send=async()=>new Response(JSON.stringify({reason:'BadDeviceToken',message:'secret-provider-message'}),{status:400});
 f.c.AndroidPush.send=async()=>new Response(JSON.stringify({error:{status:'PERMISSION_DENIED',message:'secret-provider-message',details:[{errorCode:'SENDER_ID_MISMATCH'}]}}),{status:403});
 await policy(f);f.clock.now=Date.parse('2026-11-01T18:30:00Z');await f.c.PortalService.scheduled(f.env);
 assert.deepEqual(warnings.map(args=>JSON.parse(args[1])),[{transport:'ios',httpStatus:400,reason:'BadDeviceToken'},{transport:'android',httpStatus:403,reason:'SENDER_ID_MISMATCH'}]);
 assert.deepEqual(JSON.parse(summaries[0][1]),{automatic:true,accepted:1,failed:2,excused:0,remaining:0});
 assert.equal(f.sql.prepare('SELECT status FROM portal_sends').get().status,'accepted','one provider acceptance does not mean all devices succeeded');
 assert.doesNotMatch(JSON.stringify([warnings,summaries]),/secret-provider-message|synthetic|https:|member-|Testperson|revision-|abab|111111/);
});
test('The sender receives reminders on both native devices and the web device',async()=>{
 const f=await fixture(),{person,warnings,summaries}=await mixedDevices(f),sent=[];
 f.c.NativePush.send=async()=>{sent.push('ios');return new Response(null,{status:200});};
 f.c.AndroidPush.send=async()=>{sent.push('android');return new Response(null,{status:200});};
 const event=(await f.call('list',{},person)).value.events[0];
 const result=await f.call('remind',{eventId:event.id,requestId:crypto.randomUUID()},person);
 assert.equal(result.status,200);assert.equal(result.value.accepted,3);assert.equal(result.value.failed,0);
 assert.deepEqual(sent,['ios','android']);assert.equal(warnings.length,0);assert.equal(JSON.parse(summaries[0][1]).automatic,false);
});
test('Unknown provider reasons, invalid bodies and exception details cannot enter push diagnostics',async()=>{
 const f=await fixture(),{person,warnings}=await mixedDevices(f);
 f.c.NativePush.send=async()=>new Response(JSON.stringify({reason:'secret-token-and-name'}),{status:403});
 f.c.AndroidPush.send=async()=>{throw Object.assign(Error('secret-token-and-name'),{name:'secret-exception-name'});};
 // Populate the calendar cache before replacing the transport fetch implementation.
 const event=(await f.call('list',{},person)).value.events[0];
 f.c.fetch=async()=>new Response('secret-token-and-name',{status:502});
 const result=await f.call('remind',{eventId:event.id,requestId:crypto.randomUUID()},person);
 assert.equal(result.status,200);assert.equal(result.value.accepted,0);assert.equal(result.value.failed,3);
 assert.deepEqual(warnings.map(args=>JSON.parse(args[1])),[{transport:'ios',httpStatus:403},{transport:'android',error:'unknown'},{transport:'web',httpStatus:502}]);
 assert.doesNotMatch(JSON.stringify(warnings),/secret|synthetic|https:|member-|abab/);
});
test('Manual feedback groups safe provider errors across devices of the same member',async()=>{
 const f=await fixture(),{person}=await mixedDevices(f);
 assert.equal((await f.call('native-push',{action:'subscribe',deviceToken:'cd'.repeat(32)},person)).status,200);
 f.c.NativePush.send=async()=>new Response(JSON.stringify({reason:'InvalidProviderToken',message:'secret-provider-message'}),{status:403});
 f.c.AndroidPush.send=async()=>{throw Error('Android-Mitteilungsdienst noch nicht eingerichtet.');};
 const event=(await f.call('list',{},person)).value.events[0],response=await f.call('remind',{eventId:event.id,requestId:crypto.randomUUID()},person);
 assert.equal(response.status,200);assert.equal(response.value.accepted,1);assert.equal(response.value.failed,3);
 assert.deepEqual(response.value.failures,[{transport:'ios',httpStatus:403,reason:'InvalidProviderToken',count:2},{transport:'android',error:'Error',reason:'NotConfigured',count:1}]);
 assert.doesNotMatch(JSON.stringify(response.value),/secret|synthetic|https:|member-|abab|cdcd/);
 const text=f.c.CalendarPresentation.reminderResult(response.value);
 assert.match(text,/iPhone-App: HTTP 403 · InvalidProviderToken \(2 Geräte\)/);assert.match(text,/Android-App: Mitteilungsdienst nicht eingerichtet \(1 Gerät\)/);
});
