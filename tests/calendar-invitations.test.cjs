const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
async function setup(){
 const f=await fixture(),enabled=await f.call('calendar-invitations',{enabled:true,expectedVersion:0},null,true);assert.equal(enabled.status,200);
 const secret=enabled.value.secret;
 const bridge=async(action,data={})=>{const r=await f.c.worker.fetch(new Request('https://test.example/portal/calendar-bridge/'+action,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(data)}),f.env);return {status:r.status,value:await r.json()};};
 const begin=()=>bridge('begin',{calendarId:'private-invitations@group.calendar.google.com',sourceCalendarId:'test-calendar'});
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
test('Google-Antworten werden idempotent übernommen; eine aktive Einladung sperrt widersprüchliche H₂O-Antworten',async()=>{
 const f=await setup(),{plan,job}=await invited(f),data={run:plan.value.run,id:job.id,googleEventId:job.googleEventId,fingerprint:job.fingerprint,email:job.email};
 assert.equal((await f.bridge('observe',{...data,googleStatus:'accepted'})).status,200);
 let reply=f.sql.prepare('SELECT * FROM portal_replies').get();assert.equal((await f.L.open(f.env,reply.payload,'portal-reply:'+job.event+':'+job.member)).status,'yes');
 assert.equal((await f.call('reply',{eventId:job.event,status:'excused',expectedVersion:reply.version,requestId:crypto.randomUUID()})).status,423);
 await f.bridge('observe',{...data,googleStatus:'accepted'});assert.equal(f.sql.prepare('SELECT version FROM portal_replies').get().version,reply.version);
 await f.bridge('observe',{...data,googleStatus:'declined'});reply=f.sql.prepare('SELECT * FROM portal_replies').get();assert.equal((await f.L.open(f.env,reply.payload,'portal-reply:'+job.event+':'+job.member)).status,'excused');
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
 await fresh.bridge('observe',{...data,googleStatus:'tentative'});row=fresh.sql.prepare('SELECT * FROM portal_replies').get();assert.equal((await fresh.L.open(fresh.env,row.payload,'portal-reply:'+job.event+':'+job.member)).status,'maybe');
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
