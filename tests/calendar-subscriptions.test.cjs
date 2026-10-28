const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
const token=url=>new URL(url).pathname.split('/')[3].slice(0,-4);
const get=(f,url,method='GET')=>f.c.worker.fetch(new Request(url,{method}),f.env);
async function events(f){
 const row=f.sql.prepare('SELECT * FROM portal_calendar').get(),cal=await f.L.open(f.env,row.payload,'portal-calendar'),first=cal.events[0];cal.events.push({...first,id:'b'.repeat(43),title:'Andere Gruppe',description:''},{...first,id:'c'.repeat(43),title:'INFO: Private Information',description:''},{...first,id:'d'.repeat(43),title:'Verborgene Probe',description:''});
 f.sql.prepare('UPDATE portal_calendar SET payload=?').run(await f.L.seal(f.env,cal,'portal-calendar'));
 for(const [id,kind,approved,ids] of [[first.id,'probe',true,[f.people[0].memberId]],['b'.repeat(43),'probe',true,[f.people[1].memberId]],['d'.repeat(43),'probe',false,null]]){const c=(await f.call('list',{},null,true)).value;assert.equal((await f.call('classify',{eventId:id,kind,approved,recipientIds:ids,expectedVersion:c.rulesVersion},null,true)).status,200);}
 return first;
}
test('Persönliches Abo ist stabil, verschlüsselt und pro Mitglied getrennt; der Link verleiht keine Portalrechte',async()=>{
 const f=await fixture(),one=(await f.call('calendar-subscription')).value,two=(await f.call('calendar-subscription',{},f.people[1])).value;assert.match(one.subscriptionUrl,/^https:\/\/feuerwehr-wasser-deckel-push\.522dn4fc5f\.workers\.dev\/calendar\/member\/[A-Za-z0-9_-]{43}\.ics$/);assert.equal((await f.call('calendar-subscription',{memberId:f.people[1].memberId})).value.subscriptionUrl,one.subscriptionUrl);assert.notEqual(two.subscriptionUrl,one.subscriptionUrl);assert.doesNotMatch(one.subscriptionUrl,/test-calendar|member-|alias|revision/);
 const rows=f.sql.prepare('SELECT * FROM portal_calendar_subscriptions').all();assert.ok(rows.every(r=>!r.payload.includes(token(one.subscriptionUrl))));assert.equal(f.sends.length,0);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_invites').get().n,0);
 const r=await f.c.worker.fetch(new Request('https://test.example/portal/list',{method:'POST',headers:{Authorization:'Bearer '+token(one.subscriptionUrl),'Content-Type':'application/json'},body:JSON.stringify({alias:f.people[0].alias,revision:f.people[0].revision})}),f.env);assert.equal(r.status,401);
});
test('Feed enthält nur eigene sichtbare kommende Termine, stabile Kennungen und öffentliche Antwortlinks',async()=>{
 const f=await fixture(),first=await events(f),one=(await f.call('calendar-subscription')).value,two=(await f.call('calendar-subscription',{},f.people[1])).value;
 let r=await get(f,one.subscriptionUrl),raw=await r.text();assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/^text\/calendar/);assert.match(r.headers.get('Cache-Control'),/private, no-store/);assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');assert.match(r.headers.get('X-Robots-Tag'),/noindex/);
 const root=new f.c.ICAL.Component(f.c.ICAL.parse(raw)),entries=root.getAllSubcomponents('vevent');assert.equal(root.getFirstPropertyValue('x-wr-calname'),'H₂O – Meine Feuerwehrtermine');assert.equal(entries.length,1);assert.equal(entries[0].getFirstPropertyValue('uid'),first.id+'@h2o.feuerwehr-wasser');assert.equal(entries[0].getFirstPropertyValue('url'),'https://ffw-wasser.github.io/home/termin.html?event='+first.id);assert.doesNotMatch(raw,/Andere Gruppe|Verborgene|Private Information|ATTENDEE|ORGANIZER|VALARM|token_hash|capability|member-/);assert.ok(!raw.includes(token(one.subscriptionUrl)));
 raw=await (await get(f,two.subscriptionUrl)).text();assert.match(raw,/Andere Gruppe/);assert.ok(!raw.includes(first.id+'@h2o'));
 const c=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:first.id,kind:'probe',approved:true,recipientIds:[f.people[1].memberId],expectedVersion:c.rulesVersion},null,true);raw=await (await get(f,one.subscriptionUrl)).text();assert.equal(new f.c.ICAL.Component(f.c.ICAL.parse(raw)).getAllSubcomponents('vevent').length,0,'group changes remove old appointments on refresh');
 assert.equal((await get(f,one.subscriptionUrl,'HEAD')).status,200);assert.equal(await (await get(f,one.subscriptionUrl,'HEAD')).text(),'');
});
test('Zurücksetzen sperrt nur den eigenen alten Link; Versionskonflikte und ungültige Kennungen bleiben gesperrt',async()=>{
 const f=await fixture(),one=(await f.call('calendar-subscription')).value,two=(await f.call('calendar-subscription',{},f.people[1])).value;
 assert.equal((await f.call('calendar-subscription',{reset:true,expectedVersion:0})).status,409);const next=await f.call('calendar-subscription',{reset:true,expectedVersion:one.version});assert.equal(next.status,200);assert.notEqual(next.value.subscriptionUrl,one.subscriptionUrl);assert.equal((await get(f,one.subscriptionUrl)).status,404);assert.equal((await get(f,two.subscriptionUrl)).status,200);assert.equal((await get(f,next.value.subscriptionUrl)).status,200);
 assert.equal((await get(f,next.value.subscriptionUrl.replace(token(next.value.subscriptionUrl),'z'.repeat(43)))).status,404);assert.equal((await get(f,next.value.subscriptionUrl.replace(token(next.value.subscriptionUrl),'short'))).status,404);
});
test('Mitgliedersperrung, geänderte Kontenzuordnung und Quellwechsel widerrufen das persönliche Abo',async()=>{
 for(const mode of ['roster','revision','source']){const f=await fixture(),one=(await f.call('calendar-subscription')).value;if(mode==='roster')await f.call('roster',{members:f.people.slice(1).map(p=>({id:p.memberId,name:'Synthetic',leader:false}))},null,true);else if(mode==='revision')f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('changed-revision',f.people[0].alias);else f.sql.prepare('UPDATE ledger_meta SET source=?').run('other-source');assert.ok([403,404].includes((await get(f,one.subscriptionUrl)).status),mode);}
});
test('Kalenderausfall liefert keinen ungeprüften Ersatzfeed; fehlende Konfiguration liefert keinen Hauptkalender-Link',async()=>{
 const f=await fixture(),one=(await f.call('calendar-subscription')).value;f.clock.now+=300001;f.offline(true);const r=await get(f,one.subscriptionUrl);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/BEGIN:VCALENDAR|Testprobe/);
 f.sql.prepare('DELETE FROM portal_config').run();assert.equal((await f.call('calendar-subscription')).value.subscriptionUrl,null);
});
test('Auch ein während des Abrufs zurückgesetzter Link liefert keine späten Kalenderdaten',async()=>{
 const f=await fixture(),one=(await f.call('calendar-subscription')).value;f.clock.now+=300001;const prior=f.c.fetch;let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);f.c.fetch=async(...args)=>{if(String(args[0]).startsWith('https://calendar.google.com/')){started();await gate;}return prior(...args);};const pending=get(f,one.subscriptionUrl);await ready;await f.call('calendar-subscription',{reset:true,expectedVersion:one.version});release();const r=await pending;assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/Testprobe/);
});

test('Kalendertext bleibt standardkonform bei Unicode, Zeilenumbrüchen und Ganztag über die Zeitumstellung',async()=>{
 const f=await fixture(),row=f.sql.prepare('SELECT * FROM portal_calendar').get(),cal=await f.L.open(f.env,row.payload,'portal-calendar'),e=cal.events[0];e.title='🔥Übung, Wasser; Süd'.repeat(12)+'\r\nATTENDEE:injected';e.location='Gerätehaus\nWasser';e.description='Notiz: mit Komma, und Semikolon;';e.allDay=true;e.start=Date.parse('2026-10-24T22:00:00Z');e.end=Date.parse('2026-10-25T23:00:00Z');f.clock.now=Date.parse('2026-10-24T20:00:00Z');f.sql.prepare('UPDATE portal_calendar SET payload=?,fetched_at=?').run(await f.L.seal(f.env,cal,'portal-calendar'),f.clock.now);const one=(await f.call('calendar-subscription')).value,raw=await (await get(f,one.subscriptionUrl)).text();for(const line of raw.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);assert.doesNotMatch(raw,/\r\nATTENDEE:/);assert.match(raw,/DTSTART;VALUE=DATE:20261025/);assert.match(raw,/DTEND;VALUE=DATE:20261026/);const entry=new f.c.ICAL.Component(f.c.ICAL.parse(raw)).getFirstSubcomponent('vevent');assert.equal(entry.getFirstPropertyValue('summary'),e.title.replace(/\r\n/g,'\n'));assert.equal(entry.getFirstPropertyValue('location'),'GH Wasser');assert.ok(entry.getFirstPropertyValue('description').includes('H₂O-Rückmeldung: https://ffw-wasser.github.io/home/termin.html?event='+e.id));
});

test('Eine Kontowiederherstellung widerruft das alte Kalenderabo unabhängig von der Browsersitzung',async()=>{
 const f=await fixture(),one=(await f.call('calendar-subscription')).value;await f.c.WhatsAppPasskeys.revoke(f.env,f.people[0]);assert.equal((await get(f,one.subscriptionUrl)).status,404);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_subscriptions').get().n,0);
});

test('Gleichzeitige erstmalige Aufrufe erzeugen ein einziges stabiles persönliches Abo',async()=>{
 const f=await fixture(),results=await Promise.all(Array.from({length:4},()=>f.call('calendar-subscription')));assert.ok(results.every(r=>r.status===200));assert.equal(new Set(results.map(r=>r.value.subscriptionUrl)).size,1);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_subscriptions').get().n,1);
});
