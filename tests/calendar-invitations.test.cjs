const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
async function setup(options={}){
 const f=await fixture(options),enabled=await f.call('calendar-invitations',{enabled:true,expectedVersion:0},null,true);assert.equal(enabled.status,200);
 const secret=enabled.value.secret;
 const bridge=async(action,data={})=>{const r=await f.c.worker.fetch(new Request('https://test.example/portal/calendar-bridge/'+action,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(data)}),f.env);return {status:r.status,value:await r.json()};};
 const begin=()=>bridge('begin',{calendarId:'private-invitations@group.calendar.google.com',sourceCalendarId:'test-calendar',adapterVersion:2});
 return {...f,bridge,begin,secret};
}
async function verified(f){
 assert.equal((await f.call('calendar-preference',{email:'member@example.test',allowed:true,expectedVersion:0})).status,200);
 const run=await f.begin();assert.equal(run.status,200);const job=run.value.jobs.find(j=>j.verification),token=/calendarConfirm=([a-f0-9]{64})/.exec(job.description)[1];
 await f.bridge('finish',{run:run.value.run});
 const confirmed=await f.call('calendar-preference',{confirm:token,expectedVersion:1});assert.equal(confirmed.status,200);assert.equal(confirmed.value.verified,true);
 return token;
}
async function invited(f){await verified(f);const plan=await f.begin();assert.equal(plan.status,200);const job=plan.value.jobs.find(j=>!j.verification&&j.action==='upsert');assert.ok(job);const result=await f.bridge('result',{run:plan.value.run,id:job.id,googleEventId:job.googleEventId,action:'upsert',fingerprint:job.fingerprint});assert.equal(result.status,200);return {plan,job};}
test('Kalenderadresse bleibt geschützt, wird nur am eigenen Konto bestätigt und benötigt Einwilligung',async()=>{
 const f=await setup();assert.equal((await f.call('calendar-preference',{email:'bad\n@example.test',allowed:true,expectedVersion:0})).status,400);
 const pending=await f.call('calendar-preference',{email:'member@example.test',allowed:true,expectedVersion:0});assert.equal(pending.status,200);assert.equal(pending.value.verified,false);assert.equal(pending.value.confirmToken,undefined);
 const plan=await f.begin(),job=plan.value.jobs[0],token=/calendarConfirm=([a-f0-9]{64})/.exec(job.description)[1];assert.equal(job.verification,true);
 assert.equal((await f.call('calendar-preference',{confirm:token,expectedVersion:0},f.people[1])).status,400);
 assert.equal((await f.call('calendar-preference',{confirm:'0'.repeat(64),expectedVersion:1})).status,400);
 assert.equal((await f.call('calendar-preference',{confirm:token,expectedVersion:1})).status,200);
 assert.equal((await f.call('calendar-preference',{confirm:token,expectedVersion:2})).status,400);
 const row=f.sql.prepare('SELECT payload,email_hash FROM portal_calendar_profiles').get();assert.ok(!row.payload.includes('member@example.test'));assert.ok(!row.payload.includes(token));assert.equal(row.email_hash.includes('@'),false);
});
test('Kalenderadressen werden nicht geteilt und Bestätigungsmails sind begrenzt',async()=>{
 const f=await setup();await f.call('calendar-preference',{email:'member@example.test',allowed:true,expectedVersion:0});
 assert.equal((await f.call('calendar-preference',{email:'MEMBER@example.test',allowed:true,expectedVersion:0},f.people[1])).status,409);
 assert.equal((await f.call('calendar-preference',{email:'different@example.test',allowed:true,expectedVersion:1})).status,429);
 assert.equal((await f.call('calendar-preference',{allowed:false,expectedVersion:1})).status,200);
 assert.equal((await f.call('calendar-preference')).value.email,'');
});
test('Nur freigegebene tatsächliche Empfänger erhalten persönliche Einladungsaufträge',async()=>{
 const f=await setup();await verified(f);let cal=(await f.call('list',{},null,true)).value;
 await f.call('classify',{eventId:cal.events[0].id,kind:'probe',approved:true,recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true);
 let plan=await f.begin();assert.equal(plan.value.jobs.some(j=>!j.verification&&j.action==='upsert'),false);await f.bridge('finish',{run:plan.value.run});
 cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:cal.events[0].id,kind:'probe',approved:true,recipientIds:[f.people[0].memberId],expectedVersion:cal.rulesVersion},null,true);
 plan=await f.begin();const job=plan.value.jobs.find(j=>!j.verification&&j.action==='upsert');assert.ok(job);assert.equal(job.email,'member@example.test');assert.equal(job.member,f.people[0].memberId);assert.match(job.googleEventId,/^h2o[a-f0-9]{65,72}$/);
 const publicCal=await f.c.PortalService.publicCalendar(f.env);assert.ok(!JSON.stringify(publicCal).includes('@'));assert.ok(!JSON.stringify(publicCal).includes('calendarConfirm'));
});
test('H₂O-Korrekturen bleiben bei unverändertem Kalenderstatus erhalten; eine neue Kalenderantwort wird übernommen',async()=>{
 const f=await setup(),{plan,job}=await invited(f),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email};
 const read=async()=>{const row=f.sql.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').get(job.event,job.member);return {...row,...await f.L.open(f.env,row.payload,'portal-reply:'+job.event+':'+job.member)};};
 assert.equal((await f.bridge('observe',{...data,googleStatus:'accepted'})).status,200);
 let reply=await read();assert.equal(reply.status,'yes');
 const correction={eventId:job.event,status:'excused',expectedVersion:reply.version,requestId:crypto.randomUUID()};
 const saved=await f.call('reply',correction);assert.equal(saved.status,200);assert.equal(saved.value.status,'excused');
 assert.equal((await f.call('reply',correction)).value.version,saved.value.version,'retry is idempotent');
 assert.equal((await f.call('reply',{...correction,status:'maybe',requestId:crypto.randomUUID()})).status,409,'stale app version cannot overwrite correction');
 for(let i=0;i<2;i++)assert.equal((await f.bridge('observe',{...data,googleStatus:'accepted'})).status,200);
 reply=await read();assert.equal(reply.status,'excused');assert.equal(reply.source,'h2o');assert.equal(reply.version,saved.value.version);
 await f.bridge('finish',{run:plan.value.run});const next=await f.begin();
 assert.equal((await f.bridge('observe',{...data,run:next.value.run,googleStatus:'accepted'})).status,200);
 assert.equal((await read()).status,'excused','next synchronization preserves correction');
 const write=next.value.jobs.find(j=>j.action==='reply');assert.ok(write);assert.equal(write.responseStatus,'declined');assert.equal(write.replyVersion,saved.value.version);assert.equal((await f.bridge('authorize',{...write,run:next.value.run})).value.eligible,true);assert.equal((await f.bridge('result',{...write,run:next.value.run})).status,200);
 assert.equal((await f.bridge('observe',{...data,run:next.value.run,googleStatus:'tentative'})).status,200);
 reply=await read();assert.equal(reply.status,'maybe');assert.equal(reply.source,'google');
 const reset=await f.call('reply',{eventId:job.event,status:'open',expectedVersion:reply.version,requestId:crypto.randomUUID()});assert.equal(reset.status,200);
 await f.bridge('observe',{...data,run:next.value.run,googleStatus:'tentative'});assert.equal((await read()).status,'open');
 const other=await f.call('reply',{eventId:job.event,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()},f.people[1]);assert.equal(other.status,200);assert.equal((await read()).status,'open','members can only correct their own reply');
 f.clock.now=f.start+1;await f.call('refresh',{},null,true);assert.equal((await f.call('reply',{eventId:job.event,status:'yes',expectedVersion:reset.value.version,requestId:crypto.randomUUID()})).status,409,'reply closes at start');
});
test('Widerruf und Mitgliedersperrung stoppen Antwortimporte und planen Absagen',async()=>{
 const f=await setup(),{plan,job}=await invited(f),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'accepted'};
 const own=(await f.call('calendar-preference')).value;await f.call('calendar-preference',{allowed:false,expectedVersion:own.version});
 assert.equal((await f.bridge('observe',data)).value.ignored,true);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);
 await f.bridge('finish',{run:plan.value.run});const next=await f.begin();assert.equal(next.value.jobs.find(j=>j.id===job.id).action,'cancel');
});
test('Bridge-Schlüssel, Kalenderzuordnung, laufende Version und abgelaufene Läufe werden geprüft',async()=>{
 const f=await setup();const unauthorized=await f.c.worker.fetch(new Request('https://test.example/portal/calendar-bridge/begin',{method:'POST',headers:{Authorization:'Bearer invalid','Content-Type':'application/json'},body:'{}'}),f.env);assert.equal(unauthorized.status,401);
 assert.equal((await f.bridge('begin',{calendarId:'test-calendar',sourceCalendarId:'test-calendar'})).status,400);
 const run=await f.begin();assert.equal(run.status,200);assert.equal((await f.begin()).status,409);
 assert.equal((await f.bridge('finish',{run:'0'.repeat(64)})).status,409);
 f.clock.now+=240001;assert.equal((await f.bridge('finish',{run:run.value.run})).status,409);
});

test('Terminlink meldet nicht eingeladene Mitglieder ohne Termindetails',async()=>{
 const f=await fixture(),id=(await f.call('list')).value.events[0].id;
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

test('Entfernte WhatsApp-Routen geben weder Kontakte noch Versandaufträge aus',async()=>{const f=await fixture();for(const route of ['whatsapp-preference','whatsapp-events','whatsapp-recipients','whatsapp-prepare','whatsapp-contact'])assert.equal((await f.call(route)).status,410);});

test('Verlorene Rollen und nachträgliche Empfängeränderungen sperren einen schon geplanten Versand',async()=>{
 const f=await setup();await verified(f);const plan=await f.begin(),job=plan.value.jobs.find(j=>!j.verification&&j.action==='upsert');
 const cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:job.event,kind:'probe',approved:false,expectedVersion:cal.rulesVersion},null,true);
 assert.equal((await f.bridge('authorize',{run:plan.value.run,id:job.id,googleEventId:job.googleEventId,action:'upsert',fingerprint:job.fingerprint})).value.eligible,false);
 await f.bridge('finish',{run:plan.value.run});
 f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('revoked-revision',f.people[0].alias);
 const next=await f.begin();assert.equal(next.value.jobs.find(j=>j.id===job.id).action,'cancel');
});
test('Ein gleichzeitiger Regelwechsel übernimmt weder Antwort noch Google-Beobachtungsstand',async()=>{
 const f=await setup(),{plan,job}=await invited(f),batch=f.DB.batch;let once=true;
 f.DB.batch=async statements=>{if(once&&statements.some(s=>s.query.includes('portal_replies'))){once=false;f.sql.prepare('UPDATE portal_rules SET version=version+1').run();}return batch(statements);};
 const data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'accepted'};
 assert.equal((await f.bridge('observe',data)).status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);
 const row=f.sql.prepare('SELECT payload FROM portal_calendar_invites WHERE id=?').get(job.id);assert.equal((await f.L.open(f.env,row.payload,'calendar-invite:'+job.id)).googleStatus,null);
 assert.equal((await f.bridge('observe',data)).status,200);
});
test('D1-Fehler rollen Antwort und Beobachtungsstand gemeinsam zurück; erneute Übernahme bleibt möglich',async()=>{
 const f=await setup(),{plan,job}=await invited(f),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'accepted'};
 f.failBatch();assert.equal((await f.bridge('observe',data)).status,503);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);
 assert.equal((await f.bridge('observe',data)).status,200);
 assert.equal((await f.bridge('observe',{...data,email:'someone-else@example.test'})).status,400);
 assert.equal((await f.bridge('observe',{run:plan.value.run,items:Array(9).fill(data)})).status,400);
});
test('Abgelaufene unbestätigte Adressen können neu beansprucht werden, eine bestehende H₂O-Antwort bleibt bis zur Kalenderantwort erhalten',async()=>{
 const f=await setup();await f.call('calendar-preference',{email:'member@example.test',allowed:true,expectedVersion:0});f.clock.now+=86400001;
 assert.equal((await f.call('calendar-preference',{email:'member@example.test',allowed:true,expectedVersion:0},f.people[1])).status,200);
 const fresh=await setup(),event=(await fresh.call('list')).value.events[0];await fresh.call('reply',{eventId:event.id,status:'excused',expectedVersion:0,requestId:crypto.randomUUID()});
 const {plan,job}=await invited(fresh),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email};await fresh.bridge('observe',{...data,googleStatus:'needsAction'});
 let row=fresh.sql.prepare('SELECT * FROM portal_replies').get();assert.equal((await fresh.L.open(fresh.env,row.payload,'portal-reply:'+job.event+':'+job.member)).status,'excused');
 await fresh.bridge('finish',{run:plan.value.run});const next=await fresh.begin(),correction=next.value.jobs.find(j=>j.action==='reply');assert.ok(correction);await fresh.bridge('result',{...correction,run:next.value.run});
 await fresh.bridge('observe',{...data,run:next.value.run,googleStatus:'tentative'});row=fresh.sql.prepare('SELECT * FROM portal_replies').get();assert.equal((await fresh.L.open(fresh.env,row.payload,'portal-reply:'+job.event+':'+job.member)).status,'maybe');
});

test('Fehlgeschlagene Absagen werden nicht als abgeschlossen markiert und entfernte Einladungen geben H₂O-Antworten wieder frei',async()=>{
 const f=await setup(),{plan,job}=await invited(f),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId};
 await f.bridge('observe',{...data,cancelled:true});assert.equal(await f.c.CalendarInvitations.managed(f.env,job.member,job.event),false);await f.bridge('finish',{run:plan.value.run});
 let next=await f.begin();assert.equal(next.value.jobs.some(j=>j.id===job.id&&j.action==='upsert'),false);await f.bridge('finish',{run:next.value.run});
 await f.call('calendar-preference',{allowed:false,expectedVersion:2});next=await f.begin();
 await f.bridge('result',{run:next.value.run,id:job.id,googleEventId:job.googleEventId,action:'cancel',error:'Google vorübergehend nicht erreichbar.'});
 let row=f.sql.prepare('SELECT * FROM portal_calendar_invites WHERE id=?').get(job.id);assert.notEqual(row.state,'cancelled');assert.equal(row.last_error,'delivery_failed');
 await f.bridge('result',{run:next.value.run,id:job.id,googleEventId:job.googleEventId,action:'cancel'});row=f.sql.prepare('SELECT * FROM portal_calendar_invites WHERE id=?').get(job.id);const saved=await f.L.open(f.env,row.payload,'calendar-invite:'+job.id);assert.equal(row.state,'cancelled');assert.equal(saved.email,undefined);
});

test('Erneute Freigabe nach einer Absage verwendet eine neue Google-Kennung und verwirft Antworten der alten Einladung',async()=>{
 const f=await setup(),{plan,job}=await invited(f);await f.bridge('finish',{run:plan.value.run});
 let cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:job.event,kind:'probe',approved:false,expectedVersion:cal.rulesVersion},null,true);
 const cancel=await f.begin();assert.equal(cancel.value.jobs.find(j=>j.id===job.id).action,'cancel');
 cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:job.event,kind:'probe',approved:true,expectedVersion:cal.rulesVersion},null,true);
 assert.equal((await f.bridge('authorize',{run:cancel.value.run,id:job.id,googleEventId:job.googleEventId,action:'cancel'})).value.eligible,true,'committed cancellation is completed before reinvitation');
 await f.bridge('result',{run:cancel.value.run,id:job.id,googleEventId:job.googleEventId,action:'cancel'});await f.bridge('finish',{run:cancel.value.run});
 const next=await f.begin(),replacement=next.value.jobs.find(j=>j.id===job.id);assert.ok(replacement);assert.notEqual(replacement.googleEventId,job.googleEventId);
 await f.bridge('result',{run:next.value.run,id:job.id,googleEventId:replacement.googleEventId,action:'upsert',fingerprint:replacement.fingerprint});
 assert.equal((await f.bridge('observe',{run:next.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'declined'})).value.ignored,true);
 await f.bridge('observe',{run:next.value.run,id:job.id,googleEventId:replacement.googleEventId,fingerprint:replacement.fingerprint,email:replacement.email,googleStatus:'accepted'});
 const row=f.sql.prepare('SELECT payload FROM portal_replies').get();assert.equal((await f.L.open(f.env,row.payload,'portal-reply:'+job.event+':'+job.member)).status,'yes');
});

test('Antworten werden nach Beginn nicht mehr importiert; abgelaufene Einladungen werden ohne Löschen der H₂O-Antworten bereinigt',async()=>{
 const f=await setup(),{plan,job}=await invited(f);await f.bridge('finish',{run:plan.value.run});f.clock.now=f.start+1000;
 let next=await f.begin();assert.equal((await f.bridge('observe',{run:next.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'accepted'})).value.ignored,true);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);await f.bridge('finish',{run:next.value.run});
 f.clock.now=f.start+3600001;next=await f.begin();assert.equal(next.value.jobs.find(j=>j.id===job.id).action,'cleanup');await f.bridge('result',{run:next.value.run,id:job.id,googleEventId:job.googleEventId,action:'cleanup'});const row=f.sql.prepare('SELECT * FROM portal_calendar_invites WHERE id=?').get(job.id);assert.equal(row.state,'finished');assert.equal((await f.L.open(f.env,row.payload,'calendar-invite:'+job.id)).email,undefined);
});

test('Mitgliederentfernung löscht die Kalenderadresse atomar und bewahrt die Versionsgrenze für eine spätere Neueinrichtung',async()=>{
 const f=await setup();await verified(f);const members=f.people.slice(1).map((p,i)=>({id:p.memberId,name:'Testperson '+(i+2),leader:false}));
 f.failBatch();assert.equal((await f.call('roster',{members},null,true)).status,503);let row=f.sql.prepare('SELECT * FROM portal_calendar_profiles').get();assert.notEqual(row.payload,'');assert.ok(row.email_hash);
 assert.equal((await f.call('roster',{members},null,true)).status,200);row=f.sql.prepare('SELECT * FROM portal_calendar_profiles').get();assert.equal(row.payload,'');assert.equal(row.email_hash,null);assert.equal(row.version,3);assert.equal((await f.call('calendar-preference')).status,401);
});

test('App-Korrekturen warten bei alten Adaptern und Google-Fehlern; überholte Aufträge können neue Antworten nicht quittieren',async()=>{
 const f=await setup(),{plan,job}=await invited(f),observation={id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email};
 await f.bridge('observe',{...observation,run:plan.value.run,googleStatus:'accepted'});await f.bridge('finish',{run:plan.value.run});
 let reply=(await f.call('list')).value.events.find(e=>e.id===job.event);
 await f.call('reply',{eventId:job.event,status:'maybe',expectedVersion:reply.version,requestId:crypto.randomUUID()});
 const old=await f.bridge('begin',{calendarId:'private-invitations@group.calendar.google.com',sourceCalendarId:'test-calendar'});assert.equal(old.value.jobs.some(j=>j.action==='reply'),false);
 assert.equal((await f.bridge('observe',{...observation,run:old.value.run,googleStatus:'declined'})).value.pendingReply,true);assert.equal((await f.call('list')).value.events[0].status,'maybe');await f.bridge('finish',{run:old.value.run});
 const next=await f.begin(),first=next.value.jobs.find(j=>j.action==='reply');assert.equal(first.responseStatus,'tentative');
 assert.equal((await f.bridge('result',{...first,run:next.value.run,error:'synthetic Google failure'})).status,200);assert.equal(f.sql.prepare('SELECT last_error FROM portal_calendar_invites WHERE id=?').get(job.id).last_error,'reply_failed');
 reply=(await f.call('list')).value.events[0];await f.call('reply',{eventId:job.event,status:'excused',expectedVersion:reply.version,requestId:crypto.randomUUID()});
 assert.equal((await f.bridge('authorize',{...first,run:next.value.run})).value.eligible,false);assert.equal((await f.bridge('result',{...first,run:next.value.run})).status,409);
 await f.bridge('finish',{run:next.value.run});const retry=await f.begin(),last=retry.value.jobs.find(j=>j.action==='reply');assert.equal(last.responseStatus,'declined');assert.ok(last.replyVersion>first.replyVersion);
 assert.equal((await f.bridge('result',{...last,run:retry.value.run})).status,200);assert.equal((await f.bridge('result',{...last,run:retry.value.run})).status,200,'lost acknowledgement is idempotent');
 assert.equal(f.sql.prepare('SELECT last_error FROM portal_calendar_invites WHERE id=?').get(job.id).last_error,null);
 await f.bridge('finish',{run:retry.value.run});const clean=await f.begin();assert.equal(clean.value.jobs.some(j=>j.action==='reply'),false);
});
test('Kalenderkorrekturen prüfen Adresse, Version, Freigabe und aktuellen Kontozugang vor dem Schreiben',async()=>{
 const f=await setup(),{plan,job}=await invited(f);await f.bridge('finish',{run:plan.value.run});await f.call('reply',{eventId:job.event,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()});
 const next=await f.begin(),write=next.value.jobs.find(j=>j.action==='reply');assert.ok(write);
 assert.equal((await f.bridge('authorize',{...write,run:next.value.run,responseStatus:'declined'})).value.eligible,false);
 assert.equal((await f.bridge('result',{...write,run:next.value.run,replyVersion:write.replyVersion+1})).status,409);
 const batch=f.DB.prepare;let changed=false;
 f.DB.prepare=function(query){const statement=batch.call(this,query);if(query.startsWith('UPDATE portal_calendar_invites SET payload=?,last_error=NULL')){const run=statement.run;statement.run=async function(){if(!changed){changed=true;f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('revoked-revision',f.people[0].alias);}return run.call(this);};}return statement;};
 assert.equal((await f.bridge('result',{...write,run:next.value.run})).status,409,'account revocation between read and write rejects acknowledgement');
 const saved=f.sql.prepare('SELECT payload FROM portal_calendar_invites WHERE id=?').get(job.id);assert.equal((await f.L.open(f.env,saved.payload,'calendar-invite:'+job.id)).appReplyVersion||0,0);
});

test('Eine gleichzeitig gespeicherte App-Korrektur verhindert einen überholten Kalenderimport atomar',async()=>{
 const f=await setup(),{plan,job}=await invited(f),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email};
 await f.bridge('observe',{...data,googleStatus:'accepted'});const before=f.sql.prepare('SELECT version FROM portal_replies').get().version,batch=f.DB.batch;let once=true;
 f.DB.batch=async statements=>{if(once&&statements.some(s=>s.query.includes('portal_replies'))){once=false;assert.equal((await f.call('reply',{eventId:job.event,status:'maybe',expectedVersion:before,requestId:crypto.randomUUID()})).status,200);}return batch(statements);};
 assert.equal((await f.bridge('observe',{...data,googleStatus:'declined'})).status,409);
 const reply=f.sql.prepare('SELECT * FROM portal_replies').get();assert.equal((await f.L.open(f.env,reply.payload,'portal-reply:'+job.event+':'+job.member)).status,'maybe');
 const invitation=f.sql.prepare('SELECT payload FROM portal_calendar_invites WHERE id=?').get(job.id);assert.equal((await f.L.open(f.env,invitation.payload,'calendar-invite:'+job.id)).googleStatus,'accepted');
 assert.equal((await f.bridge('observe',{...data,googleStatus:'declined'})).value.pendingReply,true);
});

test('Normale Terminfreigabe startet weder H₂O-Rückmeldung noch persönliche Einladung; nur der Admin-Befehl startet den gewählten Termin',async()=>{
 const f=await setup({requestReplies:false});await verified(f);let cal=(await f.call('list',{},null,true)).value,e=cal.events[0];assert.equal(e.approved,true);assert.equal(e.responseRequested,false);
 assert.equal((await f.call('list')).value.events[0].responseRequested,false,'the date remains visible');assert.equal((await f.call('reply',{eventId:e.id,status:'yes',requestId:crypto.randomUUID(),expectedVersion:0})).status,423);
 let plan=await f.begin();assert.equal(plan.value.jobs.some(j=>!j.verification&&j.action==='upsert'),false);await f.bridge('finish',{run:plan.value.run});
 const data={eventId:e.id,requestId:crypto.randomUUID(),expectedVersion:cal.rulesVersion,expectedGroupsVersion:cal.groupsVersion};
 assert.equal((await f.call('request-responses',data)).status,404,'members cannot start a query');assert.equal((await f.call('request-responses',{...data,expectedVersion:cal.rulesVersion+1},null,true)).status,409);
 assert.equal((await f.call('request-responses',data,null,true)).status,200);assert.equal((await f.call('request-responses',data,null,true)).status,200);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_response_requests').get().n,1);
 assert.equal((await f.call('list')).value.events[0].responseRequested,true);assert.equal((await f.call('reply',{eventId:e.id,status:'yes',requestId:crypto.randomUUID(),expectedVersion:0})).status,200);
 plan=await f.begin();const job=plan.value.jobs.find(j=>!j.verification&&j.action==='upsert');assert.ok(job);assert.equal(job.event,e.id);await f.bridge('finish',{run:plan.value.run});
 f.raw('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:second-unrequested\r\nDTSTART:'+new Date(f.start+86400000).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'\r\nDTEND:'+new Date(f.start+90000000).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'\r\nSUMMARY:Probe\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
 await f.c.PortalService.calendar(f.env,true);cal=(await f.call('list',{},null,true)).value;e=cal.events[0];await f.call('classify',{eventId:e.id,kind:'probe',approved:true,expectedVersion:cal.rulesVersion},null,true);
 plan=await f.begin();assert.equal(plan.value.jobs.some(j=>j.event===e.id&&j.action==='upsert'),false,'a different approved date is not requested');
});
test('Bereits automatisch versandte Einladungen ohne bewusste Rückmeldeanforderung werden zurückgezogen',async()=>{
 const f=await setup(),{plan,job}=await invited(f);await f.bridge('finish',{run:plan.value.run});f.sql.prepare('DELETE FROM portal_response_requests').run();
 const next=await f.begin();assert.equal(next.value.jobs.find(j=>j.id===job.id).action,'cancel');assert.equal((await f.call('list')).value.events[0].responseRequested,false);
});

test('Kalenderabo mit Antwortlink stoppt neue Einladungen, invalidiert alte Läufe und behält Rückmeldungen',async()=>{
 const f=await setup(),{plan,job}=await invited(f);await f.bridge('observe',{run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'accepted'});await f.bridge('finish',{run:plan.value.run});
 const oldRun=await f.begin(),cfg=(await f.call('calendar-invitations',{},null,true)).value;
 assert.equal((await f.call('calendar-invitations',{deliveryMode:'links',expectedVersion:cfg.version})).status,404);
 assert.equal((await f.call('calendar-invitations',{deliveryMode:'links',expectedVersion:cfg.version+1},null,true)).status,409);
 const mode=await f.call('calendar-invitations',{deliveryMode:'links',expectedVersion:cfg.version},null,true);assert.equal(mode.status,200);assert.equal(mode.value.deliveryMode,'links');
 assert.equal((await f.bridge('finish',{run:oldRun.value.run})).status,409,'the previous adapter run cannot continue');
 const list=(await f.call('list')).value;assert.equal(list.events[0].calendarLinkOnly,true);assert.equal(list.events[0].calendarManaged,false);assert.equal(list.events[0].status,'yes');
 const next=await f.begin();assert.equal(next.status,200);assert.equal(next.value.jobs.find(j=>j.id===job.id).action,'cancel');assert.ok(next.value.jobs.every(j=>['cancel','cleanup'].includes(j.action)));assert.ok(!JSON.stringify(next.value.jobs).includes(job.email));
 const cancel=next.value.jobs.find(j=>j.id===job.id);assert.equal((await f.bridge('authorize',{...cancel,run:next.value.run})).value.eligible,true);for(const item of next.value.jobs)await f.bridge('result',{...item,run:next.value.run});
 assert.equal((await f.bridge('observe',{run:next.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email,googleStatus:'declined'})).value.ignored,true);
 const answer=await f.call('reply',{eventId:job.event,status:'maybe',expectedVersion:list.events[0].version,requestId:crypto.randomUUID()});assert.equal(answer.status,200);assert.equal((await f.call('list')).value.events[0].status,'maybe');
 assert.equal((await f.call('calendar-preference')).value.deliveryMode,'links');assert.equal((await f.call('calendar-preference',{email:'new@example.test',allowed:true,expectedVersion:2})).status,409);
 const own=(await f.call('calendar-preference')).value;assert.equal((await f.call('calendar-preference',{allowed:false,expectedVersion:own.version})).value.deliveryMode,'links');
 await f.bridge('finish',{run:next.value.run});const empty=await f.begin();assert.equal(empty.value.jobs.length,0);await f.bridge('finish',{run:empty.value.run});
 const settings=(await f.call('calendar-invitations',{},null,true)).value;await f.call('calendar-invitations',{enabled:true,expectedVersion:settings.version},null,true);assert.equal((await f.call('calendar-invitations',{},null,true)).value.deliveryMode,'links','an old client cannot switch invitations back on');
});

test('Rückmeldelink-Modus verschickt die bewusst angeforderte Abfrage einmalig und setzt begrenzte Sendungen fort',async()=>{
 const f=await fixture({requestReplies:false});assert.equal((await f.call('calendar-invitations',{deliveryMode:'links',expectedVersion:0},null,true)).status,200);
 for(const p of f.people)await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p);
 await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);
 const cal=(await f.call('list',{},null,true)).value,id=cal.events[0].id,body={eventId:id,notify:true,requestId:crypto.randomUUID(),expectedVersion:cal.rulesVersion,expectedGroupsVersion:cal.groupsVersion};
 let result=await f.call('request-responses',body,null,true);assert.equal(result.status,200);assert.equal(result.value.accepted,2);assert.equal(result.value.remaining,3);const campaign=result.value.requestId;
 for(let i=0;i<4;i++){result=await f.call('request-responses',{...body,requestId:crypto.randomUUID()},null,true);assert.equal(result.value.requestId,campaign);}
 assert.equal(result.value.remaining,0);assert.equal(f.sends.length,5);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,5);
 assert.equal((await f.call('list')).value.events[0].responseRequested,true);assert.equal((await f.call('request-responses',body)).status,404);
});
