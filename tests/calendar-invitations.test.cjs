const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs'),{seed}=require('./helpers/calendar-cleanup-fixture.cjs');
test('Kalenderabo mit H₂O-Link ist ohne Einladungsanbindung aktiv; alte Einwilligungs- und Einrichtungsaktionen sind beendet',async()=>{
 const f=await fixture(),settings=(await f.call('calendar-invitations',{},null,true)).value;assert.equal(settings.deliveryMode,'links');assert.equal(settings.configured,false);assert.equal(settings.remainingInvitations,0);
 for(const data of [{enabled:true,expectedVersion:0},{enabled:false,expectedVersion:0},{deliveryMode:'invitations',expectedVersion:0}])assert.equal((await f.call('calendar-invitations',data,null,true)).status,410);
 for(const data of [{email:'member@example.test',allowed:true,expectedVersion:0},{confirm:'a'.repeat(64),expectedVersion:0},{confirm:'a'.repeat(64),allowed:false,expectedVersion:0}])assert.equal((await f.call('calendar-preference',data)).status,410);
 const list=(await f.call('list')).value;assert.equal(list.events[0].calendarLinkOnly,true);assert.equal(list.events[0].calendarManaged,false);assert.equal(f.sends.length,0);
});
test('Alte Einladungen werden begrenzt zurückgezogen, ohne Antworten oder Konto-Daten zu verändern',async()=>{
 const f=await fixture(),old=await seed(f,{count:34}),e=(await f.call('list')).value.events[0];await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()});
 assert.equal((await f.call('calendar-invitations',{},null,true)).value.remainingInvitations,34);const before=f.sql.prepare('SELECT payload FROM portal_replies').get().payload;
 for(const expected of [30,4]){const plan=await old.begin();assert.equal(plan.status,200);assert.equal(plan.value.jobs.length,expected);assert.equal((await old.begin()).status,409);assert.ok(plan.value.jobs.every(j=>j.action==='cancel'));assert.ok(!JSON.stringify(plan.value).includes('@example.test'));
  for(const job of plan.value.jobs){assert.equal((await old.bridge('authorize',{...job,run:plan.value.run})).value.eligible,true);assert.equal((await old.bridge('result',{...job,run:plan.value.run})).status,200);assert.equal((await old.bridge('result',{...job,run:plan.value.run})).status,200);}
  await old.bridge('observe',{run:plan.value.run,items:[{id:old.jobs[0].id,googleStatus:'declined'}]});assert.equal(f.sql.prepare('SELECT payload FROM portal_replies').get().payload,before);
  const done=await old.bridge('finish',{run:plan.value.run});assert.equal(done.value.done,expected===4);}
 assert.equal((await old.begin()).value.jobs.length,0);for(const row of f.sql.prepare('SELECT id,payload FROM portal_calendar_invites').all()){const value=await f.L.open(f.env,row.payload,'calendar-invite:'+row.id);assert.equal(value.email,undefined);assert.equal(value.description,undefined);assert.equal(value.confirmToken,undefined);}
});
test('Alter Bridge-Schlüssel, Kalenderzuordnung, Aufträge und Antwortimporte können keine Einladungen oder Rückmeldungen mehr erstellen',async()=>{
 const f=await fixture(),old=await seed(f),plan=await old.begin(),job=plan.value.jobs[0],data={...job,run:plan.value.run};
 assert.equal((await old.bridge('begin',{calendarId:'test-calendar',sourceCalendarId:'test-calendar'})).status,400);assert.equal((await old.bridge('authorize',{...data,googleEventId:'foreign'})).status,400);
 for(const action of ['upsert','reply']){assert.equal((await old.bridge('authorize',{...data,action})).value.eligible,false);assert.equal((await old.bridge('result',{...data,action})).value.ignored,true);}
 assert.equal((await old.bridge('result',{...data,error:'SYNTHETIC SECRET'})).status,200);const row=f.sql.prepare('SELECT last_error FROM portal_calendar_invites').get();assert.equal(row.last_error,'cleanup_failed');
 const restored=await old.bridge('authorize',data);assert.equal(restored.value.eligible,true);f.clock.now+=240001;assert.equal((await old.bridge('result',data)).status,409);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);assert.equal(f.sends.length,0);
});
test('Frühere Bestätigungsmails werden lokal bereinigt; eine gespeicherte Adresse kann nur das eigene Mitglied entfernen',async()=>{
 const f=await fixture(),old=await seed(f,{verification:true}),plan=await old.begin();assert.equal(plan.value.jobs.length,0);assert.equal((await old.bridge('finish',{run:plan.value.run})).value.done,true);
 const own=(await f.call('calendar-preference')).value;assert.equal(own.hasSavedAddress,true);assert.equal(own.email,'');assert.equal((await f.call('calendar-preference',{},f.people[1])).value.hasSavedAddress,false);
 assert.equal((await f.call('calendar-preference',{allowed:false,expectedVersion:own.version+1})).status,409);const removed=await f.call('calendar-preference',{allowed:false,expectedVersion:own.version});assert.equal(removed.value.hasSavedAddress,false);const row=f.sql.prepare('SELECT payload,email_hash FROM portal_calendar_profiles').get();assert.equal(row.payload,'');assert.equal(row.email_hash,null);
});
test('Bewusst angeforderte Push-Abfragen werden einmalig fortgesetzt und versenden keine Kalendereinladung',async()=>{
 const f=await fixture({requestReplies:false});for(const p of f.people)await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);
 const cal=(await f.call('list',{},null,true)).value,body={eventId:cal.events[0].id,notify:true,requestId:crypto.randomUUID(),expectedVersion:cal.rulesVersion,expectedGroupsVersion:cal.groupsVersion};let r=await f.call('request-responses',body,null,true);assert.equal(r.value.accepted,2);assert.equal(r.value.remaining,3);const campaign=r.value.requestId;
 for(let i=0;i<4;i++){r=await f.call('request-responses',{...body,requestId:crypto.randomUUID()},null,true);assert.equal(r.value.requestId,campaign);}assert.equal(r.value.remaining,0);assert.equal(f.sends.length,5);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_invites').get().n,0);assert.equal((await f.call('request-responses',body)).status,404);
});
