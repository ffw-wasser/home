const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/portal-fixture.cjs');
const PRIVATE='https://calendar.google.com/calendar/ical/test-calendar/private-'+'a'.repeat(32)+'/basic.ics';
const NEXT=PRIVATE.replace('a'.repeat(32),'b'.repeat(32));
const state=f=>f.call('private-calendar',{},null,true);
const activate=async(f,url=PRIVATE,version)=>(await f.call('private-calendar',{privateUrl:url,expectedVersion:version??(await state(f)).value.version},null,true));
const pub=async(f,year='')=>{const response=await f.c.worker.fetch(new Request('https://test.example/calendar/public'+(year?'?year='+year:'')),f.env);return {status:response.status,value:await response.json()};};
const rawConfig=f=>f.sql.prepare('SELECT * FROM portal_config WHERE id=1').get();
const parsedConfig=async f=>f.L.open(f.env,rawConfig(f).payload,'portal-config');
const getFeed=async(f,url)=>(await f.c.worker.fetch(new Request(url),f.env));

test('Privater Import behält Kennungen, Rückmeldungen, Regeln und persönliche Abos; Geheimnis bleibt verschlüsselt und nicht lesbar',async()=>{
 const f=await fixture(),before=(await f.call('list',{},null,true)).value,e=before.events[0];
 assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:require('node:crypto').randomUUID()})).status,200);const link=(await f.call('calendar-subscription')).value.subscriptionUrl,icsBefore=await (await getFeed(f,link)).text();
 const rules=f.sql.prepare('SELECT payload FROM portal_rules').get().payload,reply=f.sql.prepare('SELECT payload FROM portal_replies').get().payload;
 const result=await activate(f);assert.equal(result.status,200);assert.equal(result.value.private,true);assert.doesNotMatch(JSON.stringify(result.value),/private-aaaa|privateCalendarUrl/);
 const c=await parsedConfig(f);assert.equal(c.calendarUrl,'https://calendar.google.com/calendar/ical/test-calendar/public/basic.ics');assert.equal(c.privateCalendarUrl,PRIVATE);assert.ok(!rawConfig(f).payload.includes(PRIVATE));
 const safe=(await f.call('config',{},null,true)).value;assert.equal(safe.privateCalendar,true);assert.doesNotMatch(JSON.stringify(safe),/private-aaaa|privateCalendarUrl/);assert.doesNotMatch(JSON.stringify((await state(f)).value),/private-aaaa/);
 const after=(await f.call('list',{},null,true)).value;assert.equal(after.events[0].id,e.id);assert.equal(after.events[0].seriesId,e.seriesId);assert.deepEqual(after.events[0].recipientIds,e.recipientIds);
 assert.equal(f.sql.prepare('SELECT payload FROM portal_rules').get().payload,rules);assert.equal(f.sql.prepare('SELECT payload FROM portal_replies').get().payload,reply);assert.equal(await (await getFeed(f,link)).text(),icsBefore);
});

test('Privater Betrieb sperrt öffentliche Tages- und Jahresdaten, auch bei vorhandenem Cache',async()=>{
 const f=await fixture();assert.ok((await pub(f)).value.events.length);await f.call('year',{year:2026},null,true);await activate(f);
 for(const year of ['',2026]){const value=await pub(f,year);assert.equal(value.status,200);assert.deepEqual(value.value.events,[]);assert.equal(value.value.private,true);assert.doesNotMatch(JSON.stringify(value),/test-event|Testprobe|private-aaaa|recipient|location/);}
 assert.ok((await f.call('list',{},null,true)).value.events.length);
});

test('Fremde Kalender, unsichere Adressen, alte Version und unberechtigte Zugriffe ändern nichts',async()=>{
 const f=await fixture(),before=rawConfig(f),version=(await state(f)).value.version;
 const invalid=[PRIVATE.replace('calendar.google.com','example.invalid'),PRIVATE.replace('https:','http:'),PRIVATE+'?x=1',PRIVATE+'#fragment',PRIVATE.replace('calendar.google.com','user@calendar.google.com'),PRIVATE.replace('test-calendar','different-calendar'),PRIVATE.replace('a'.repeat(32),'short'),PRIVATE.replace('/private-'+ 'a'.repeat(32),'/public'),PRIVATE.replace('test-calendar','foo%2Fbar')];
 for(const privateUrl of invalid){const result=await activate(f,privateUrl,version);assert.ok([400,409].includes(result.status),privateUrl);assert.equal(rawConfig(f).payload,before.payload);}
 assert.equal((await activate(f,PRIVATE,version-1)).status,409);
 const denied=await f.c.worker.fetch(new Request('https://test.example/admin/portal/private-calendar',{method:'POST',headers:{Authorization:'Bearer invalid','Content-Type':'application/json'},body:JSON.stringify({source:'test-source',privateUrl:PRIVATE,expectedVersion:version})}),f.env);assert.equal(denied.status,401);
 assert.equal(rawConfig(f).payload,before.payload);
});

test('Geänderter Quellzugriff wird ausschließlich nach erfolgreichem echten Abruf gespeichert; Fehler und Weiterleitungen verraten keinen Schlüssel',async()=>{
 for(const mode of ['network','redirect','denied','invalid','too-large']){
  const f=await fixture(),before=rawConfig(f),fetch=f.c.fetch;
  f.c.fetch=async(url,options)=>{if(String(url).includes('/private-')){assert.equal(options.redirect,'manual');if(mode==='network')throw Error('fetch failed '+PRIVATE);if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'https://example.invalid/'+PRIVATE}});if(mode==='denied')return new Response(null,{status:403});if(mode==='invalid')return new Response('not a calendar '+PRIVATE);return new Response('BEGIN:VCALENDAR',{headers:{'Content-Length':'2000001'}});}return fetch(url,options);};
  const result=await activate(f);assert.equal(result.status,503,mode);assert.doesNotMatch(JSON.stringify(result.value),/private-aaaa|fetch failed|example.invalid/);assert.equal(rawConfig(f).payload,before.payload);
 }
});

test('Prüfung nach Abschalten der öffentlichen Freigabe nutzt private Quelle und unterscheidet Freigabe, Sperre und unbekannt',async()=>{
 const f=await fixture(),fetch=f.c.fetch,calls=[];let publicStatus=403;
 await activate(f);f.c.fetch=async(url,options)=>{calls.push(String(url));if(String(url).includes('/public/'))return publicStatus===200?fetch(url,options):new Response(null,{status:publicStatus});return fetch(url,options);};
 for(const [status,expected] of [[403,'blocked'],[404,'blocked'],[200,'readable'],[503,'unknown'],[302,'unknown']]){publicStatus=status;const r=await f.call('private-calendar',{check:true,expectedVersion:(await state(f)).value.version},null,true);assert.equal(r.status,200);assert.equal(r.value.publicAccess,expected);assert.ok(r.value.count>0);}
 assert.ok(calls.some(url=>url===PRIVATE));
});

test('Ausfall der privaten Quelle fällt nie auf öffentliche Daten zurück und bestätigt keinen alten Cache als privaten Test',async()=>{
 const f=await fixture();await activate(f);let publicReads=0;const fetch=f.c.fetch;
 f.c.fetch=async(url,options)=>{if(String(url).includes('/private-'))return new Response(null,{status:403});if(String(url).includes('/public/'))publicReads++;return fetch(url,options);};
 const r=await f.call('private-calendar',{check:true,expectedVersion:(await state(f)).value.version},null,true);assert.equal(r.status,503);assert.equal(publicReads,0);assert.equal((await state(f)).value.private,true);assert.deepEqual((await pub(f)).value.events,[]);
 f.clock.now+=300001;const link=(await f.call('calendar-subscription')).value.subscriptionUrl;assert.equal((await getFeed(f,link)).status,503);
});

test('Schlüsselwechsel entwertet Importcache ohne die Termin-ID oder Kalender-ID zu verändern',async()=>{
 const f=await fixture();await activate(f);const before=await parsedConfig(f),id=(await f.call('list',{},null,true)).value.events[0].id;
 const result=await activate(f,NEXT);assert.equal(result.status,200);const after=await parsedConfig(f);assert.notEqual(after.privateCalendarRevision,before.privateCalendarRevision);assert.equal(after.calendarUrl,before.calendarUrl);assert.equal((await f.call('list',{},null,true)).value.events[0].id,id);
 let publicRead=false;const fetch=f.c.fetch;f.c.fetch=(url,options)=>{if(String(url).includes('/public/'))publicRead=true;return fetch(url,options);};assert.equal((await f.call('configure',{calendarUrl:after.calendarUrl,leadHours:24},null,true)).status,200);assert.equal(publicRead,false);assert.equal((await parsedConfig(f)).privateCalendarUrl,NEXT);
});

test('Gleichzeitige Verbindungseinrichtung gewinnt nur einmal; unvollständige Transaktion bleibt vollständig zurückgerollt',async()=>{
 const f=await fixture(),version=(await state(f)).value.version;const results=await Promise.all([activate(f,PRIVATE,version),activate(f,NEXT,version)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const c=await parsedConfig(f),snapshot=await f.L.open(f.env,f.sql.prepare('SELECT payload FROM portal_calendar').get().payload,'portal-calendar');assert.equal(snapshot.sourceRevision,c.privateCalendarRevision);
 const before=rawConfig(f);f.failBatch();assert.equal((await activate(f,c.privateCalendarUrl===PRIVATE?NEXT:PRIVATE)).status,503);assert.equal(rawConfig(f).payload,before.payload);
});

test('Langsamer Abruf einer alten Quelle kann den neuen Kalenderstand nicht überschreiben',async()=>{
 const f=await fixture();await activate(f);const fetch=f.c.fetch;let release,started;const waiting=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 f.c.fetch=async(url,options)=>{if(String(url)===PRIVATE){started();await gate;}return fetch(url,options);};
 const old=f.c.PortalService.calendar(f.env,true).then(value=>({value}),error=>({error}));await waiting;assert.equal((await activate(f,NEXT)).status,200);const saved=f.sql.prepare('SELECT payload FROM portal_calendar').get().payload;release();const stale=await old;assert.ok(stale.error);assert.equal(f.sql.prepare('SELECT payload FROM portal_calendar').get().payload,saved);
});

test('Serien, Jahresplan und Geburtstagspunkte behalten ihre Zuordnung beim Zugangstausch',async()=>{
 const f=await fixture({now:Date.parse('2026-06-15T10:00:00Z')});
 const raw='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:series-test\r\nDTSTART:20260616T170000Z\r\nDTEND:20260616T190000Z\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nSUMMARY:Probe Serie\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:birthday-test\r\nDTSTART;VALUE=DATE:20260615\r\nDTEND;VALUE=DATE:20260616\r\nRRULE:FREQ=YEARLY\r\nSUMMARY:Geburtstag Testperson 1\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
 f.raw(raw);await f.c.PortalService.calendar(f.env,true);const before=(await f.call('year',{year:2026},null,true)).value.events;
 // A stored synthetic yearly marker must neither disappear nor duplicate.
 await f.DB.prepare('INSERT INTO portal_birthdays(member,year,payload) VALUES(?,?,?)').bind('member-1',2026,await f.L.seal(f.env,{synthetic:true},'synthetic-marker')).run();const marker=f.sql.prepare('SELECT * FROM portal_birthdays').get();
 assert.equal((await activate(f)).status,200);const after=(await f.call('year',{year:2026},null,true)).value.events;
 const identities=events=>events.map(e=>({id:e.id,seriesId:e.seriesId,start:e.start,kind:e.kind,googleOccurrence:e.googleOccurrence}));assert.deepEqual(identities(after),identities(before));assert.equal(after.filter(e=>e.kind==='probe').length,3);assert.ok(after.some(e=>e.kind==='birthday'));assert.deepEqual(f.sql.prepare('SELECT * FROM portal_birthdays').get(),marker);
});

test('Ersteinrichtung kann direkt privat erfolgen und braucht keinen öffentlichen Google-Abruf',async()=>{
 const f=await fixture();f.sql.prepare('DELETE FROM portal_config').run();f.sql.prepare('DELETE FROM portal_calendar').run();const fetch=f.c.fetch;let publicReads=0;
 f.c.fetch=(url,options)=>{if(String(url).includes('/public/'))publicReads++;return fetch(url,options);};
 const result=await activate(f);assert.equal(result.status,200);assert.equal(result.value.version,1);assert.equal(publicReads,0);assert.equal((await parsedConfig(f)).privateCalendarUrl,PRIVATE);assert.equal((await pub(f,1999)).status,400);
});

test('Verwaltung sieht alle Termine, auch wenn das eigene Mitglied nicht zur Zielgruppe gehört',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',approved:true,recipientMode:'manual',recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.equal((await activate(f)).status,200);assert.equal((await f.call('list',{},f.people[0])).value.events.length,0);assert.equal((await f.call('list',{},null,true)).value.events.length,1);
});
