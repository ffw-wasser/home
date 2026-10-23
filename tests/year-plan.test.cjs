const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/portal-fixture.cjs');
const ics=items=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+items.join('\r\n')+'\r\nEND:VCALENDAR\r\n';
const event=(id,date,title,extra='')=>`BEGIN:VEVENT\r\nUID:${id}\r\nDTSTART;VALUE=DATE:${date}\r\nDTEND;VALUE=DATE:${date.slice(0,6)+String(Number(date.slice(6))+1).padStart(2,'0')}\r\nSUMMARY:${title}\r\n${extra}\r\nEND:VEVENT`;
test('Jahresabruf enthält vergangene Monate und Serien, verändert weder Arbeitskalender noch Geburtstagsmarker',async()=>{
 const f=await fixture({now:Date.parse('2026-10-23T10:00:00Z')});
 f.raw(ics([event('past','20260102','Probe Januar'),event('birthday','20260202','Geburtstag Testperson'),event('annual','20260302','Probe Serie','RRULE:FREQ=MONTHLY;COUNT=10')]));
 const before=f.sql.prepare('SELECT * FROM portal_calendar').get(),markers=f.sql.prepare('SELECT COUNT(*) n FROM portal_birthdays').get().n;
 const annual=await f.call('year',{year:2026},null,true);assert.equal(annual.status,200);assert.equal(annual.value.year,2026);assert.equal(annual.value.events.length,12);assert(annual.value.events.some(e=>e.title==='Probe Januar'));assert(annual.value.events.some(e=>e.kind==='birthday'));
 assert.deepEqual(f.sql.prepare('SELECT * FROM portal_calendar').get(),before);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_birthdays').get().n,markers);
 assert.equal((await f.call('year',{year:1999},null,true)).status,400);assert.equal((await f.call('year',{year:2026.5},null,true)).status,400);
});
test('Öffentliche Jahresansicht veröffentlicht keine Geburtstage, Namen, Orte, Zuordnungen oder private URLs',async()=>{
 const f=await fixture();const normal=(await f.call('list',{},null,true)).value.events[0];
 const before=f.sql.prepare('SELECT * FROM portal_calendar').get();
 const response=await f.c.worker.fetch(new Request('https://test.example/calendar/public?year='+new Date(f.start).getUTCFullYear()),f.env);
 assert.equal(response.status,200);const data=await response.json();assert(data.events.length>0);assert(data.events.every(e=>e.kind==='probe'&&['Probe','Sonderprobe'].includes(e.title)));assert.equal(JSON.stringify(data).includes(normal.title),false);
 for(const e of data.events)for(const key of ['memberId','seriesId','location','clothing','recipientIds','calendarUrl','automaticRecipientIds'])assert.equal(e[key],undefined);
 assert.match(response.headers.get('Cache-Control'),/no-store/);assert.deepEqual(f.sql.prepare('SELECT * FROM portal_calendar').get(),before);
 const denied=await f.c.worker.fetch(new Request('https://test.example/admin/portal/year',{method:'POST',headers:{Authorization:'Bearer invalid','Content-Type':'application/json'},body:JSON.stringify({year:2026,source:'test-source'})}),f.env);assert.equal(denied.status,401);
 assert.equal((await f.call('year',{year:2026,source:'wrong-source'},null,true)).status,409);
});
test('Jahresprojektion berücksichtigt Berliner Jahresgrenzen, Serienausnahmen und exklusive Ganztagsenden',()=>{
 const c=vm.createContext({Intl,Date});vm.runInContext(fs.readFileSync('js/vendor/ical.js','utf8'),c);vm.runInContext(fs.readFileSync('js/features/portal/calendar-model.js','utf8'),c);
 const raw=ics(['BEGIN:VEVENT\r\nUID:berlin\r\nDTSTART:20251231T233000Z\r\nDTEND:20260101T003000Z\r\nSUMMARY:Probe Jahreswechsel\r\nEND:VEVENT',event('series','20260105','Probe Serie','RRULE:FREQ=MONTHLY;COUNT=3\r\nEXDATE;VALUE=DATE:20260205'),event('outside','20270102','Außerhalb')]);
 const result=c.PortalCalendar.parse(raw,Date.parse('2026-10-23T00:00:00Z'),{from:Date.parse('2026-01-01T00:00:00+01:00'),to:Date.parse('2027-01-01T00:00:00+01:00')});
 assert.equal(result.length,3);assert(result.some(e=>e.title==='Probe Jahreswechsel'));assert.equal(result.filter(e=>e.title==='Probe Serie').length,2);assert.equal(result.filter(e=>e.allDay)[0].end-result.filter(e=>e.allDay)[0].start,86400000);
});
test('Ferien schließen beide Grenztage ein, laufen über den Jahreswechsel und weisen fehlende Jahre aus',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync('js/features/portal/school-holidays.js','utf8'),c);const h=c.SchoolHolidays;
 assert.equal(h.forDay('2026-01-05')[0].name,'Weihnachtsferien');assert.equal(h.forDay('2026-01-06').length,0);assert.equal(h.forDay('2027-01-09')[0].name,'Weihnachtsferien');assert.equal(h.forDay('2027-01-10').length,0);assert.equal(h.complete(2026),true);assert.equal(h.complete(2030),false);
});

test('Baden-Württemberg: zwölf gesetzliche Feiertage, feste Tage und Osterverschiebung',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync('js/features/portal/public-holidays.js','utf8'),c);const h=c.PublicHolidays;
 const dates=year=>Object.fromEntries(h.forYear(year).map(p=>[p.name,p.date]));
 assert.equal(h.forYear(2026).length,12);assert.equal(dates(2026)['Heilige Drei Könige'],'2026-01-06');
 for(const [name,date] of [['Karfreitag','2026-04-03'],['Ostermontag','2026-04-06'],['Christi Himmelfahrt','2026-05-14'],['Pfingstmontag','2026-05-25'],['Fronleichnam','2026-06-04']])assert.equal(dates(2026)[name],date);
 assert.equal(dates(2027)['Karfreitag'],'2027-03-26');assert.equal(dates(2038)['Ostermontag'],'2038-04-26');assert.equal(h.forDay('2026-11-01')[0].name,'Allerheiligen');assert.equal(h.forDay('2026-08-15').length,0);
 for(let year=2000;year<=2100;year++){const items=h.forYear(year);assert.equal(items.length,12);assert(new Set(items.map(p=>p.date)).size>=11);assert(items.every(p=>Number.isFinite(Date.parse(p.date))&&p.date.startsWith(year+'-')));}
 assert.equal(h.forDay('2008-05-01').length,2,'Ascension can coincide with Labour Day');
 assert.equal(h.forYear(1999).length,0);assert.equal(h.forYear(2026.5).length,0);
});
test('Persönlicher Jahresplan wahrt Empfängergrenzen und zeigt ausschließlich den eigenen Geburtstag',async()=>{
 const f=await fixture({now:Date.parse('2026-06-15T12:00:00Z')});
 f.raw(ics([event('allowed','20260620','Probe Allgemein'),event('restricted','20260710','Probe Vertraulich'),event('unapproved','20260801','Probe Noch nicht freigegeben'),event('own-birthday','20260910','Geburtstag Eigene Testperson'),event('other-birthday','20260911','Geburtstag Andere Testperson')]));
 f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 for(const [title,kind,memberId,recipientIds] of [['Probe Allgemein','probe',null,null],['Probe Vertraulich','probe',null,[f.people[1].memberId]],['Geburtstag Eigene Testperson','birthday',f.people[0].memberId],['Geburtstag Andere Testperson','birthday',f.people[1].memberId]]){
  const cal=(await f.call('list',{},null,true)).value,e=cal.events.find(e=>e.title===title);
  assert.equal((await f.call('classify',{eventId:e.id,kind,approved:kind==='probe',memberId,expectedVersion:cal.rulesVersion,...(kind==='probe'?{recipientIds}:{})},null,true)).status,200);
 }
 const full=await f.call('year',{year:2026},null,true);assert.equal(full.status,200);assert.deepEqual(full.value.events.map(e=>e.title),['Probe Allgemein','Probe Vertraulich','Probe Noch nicht freigegeben','Geburtstag Eigene Testperson','Geburtstag Andere Testperson'],'Gerätehaus projection contains all appointments and birthdays');
 const response=await f.call('year',{year:2026});assert.equal(response.status,200);assert.deepEqual(response.value.events.map(e=>e.title),['Probe Allgemein','Dein Geburtstag']);
 for(const e of response.value.events)for(const key of ['memberId','seriesId','recipientIds','automaticRecipientIds','recipientMode','groupIds'])assert.equal(e[key],undefined);
 const other=await f.call('year',{year:2026},f.people[1]);assert.deepEqual(other.value.events.map(e=>e.title),['Probe Allgemein','Probe Vertraulich','Dein Geburtstag']);
 assert.equal((await f.call('year',{year:2026}, {...f.people[0],testToken:'invalid'})).status,401);
 f.sql.prepare('DELETE FROM portal_roster').run();assert.equal((await f.call('year',{year:2026})).status,403);
});

test('Alte jährliche Geburtstage benötigen nur einen Zeitzonenformatierer und behalten Schaltjahre',()=>{
 let constructed=0;const c=vm.createContext({Date,Intl:{DateTimeFormat:class extends Intl.DateTimeFormat{constructor(...args){super(...args);constructed++;}}}});
 for(const file of ['js/vendor/ical.js','js/features/portal/calendar-model.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const entries=Array.from({length:80},(_,i)=>event('old-'+i,'1960'+String(i%12+1).padStart(2,'0')+String(i%27+1).padStart(2,'0'),'Geburtstag Testperson '+i,'RRULE:FREQ=YEARLY'));
 entries.push('BEGIN:VEVENT\r\nUID:leap\r\nDTSTART;VALUE=DATE:19600229\r\nDURATION:P1D\r\nRRULE:FREQ=YEARLY\r\nSUMMARY:Geburtstag Schalttag\r\nEND:VEVENT');
 const raw=ics(entries),range=year=>({from:Date.parse(year+'-01-01T00:00:00+01:00'),to:Date.parse((year+1)+'-01-01T00:00:00+01:00')});
 const normal=c.PortalCalendar.parse(raw,Date.now(),range(2026));assert.equal(normal.length,81);assert.equal(constructed,1);assert.equal(new Date(normal.find(e=>e.title==='Geburtstag Schalttag').start).toISOString(),'2026-02-28T23:00:00.000Z');
 const leap=c.PortalCalendar.parse(raw,Date.now(),range(2028));assert.equal(leap.length,81);assert.equal(constructed,1);assert.equal(new Date(leap.find(e=>e.title==='Geburtstag Schalttag').start).toISOString(),'2028-02-28T23:00:00.000Z');
 const counted=c.PortalCalendar.parse(ics([event('counted','19600102','Begrenzte Serie','RRULE:FREQ=YEARLY;COUNT=3')]),Date.now(),range(2026));assert.equal(counted.length,0,'COUNT must not restart near the requested year');
});

test('Jahresprojektionen werden geteilt, verschlüsselt gespeichert und nach Neustart ohne Google neu gelesen',async()=>{
 const f=await fixture({now:Date.parse('2026-06-15T12:00Z')});f.raw(ics([event('annual','20260102','Probe Jahrescache')]));const before=f.calendarFetches();
 const result=await Promise.all([f.call('year',{year:2026},null,true),f.call('year',{year:2026},null,true)]);assert(result.every(r=>r.status===200));assert.equal(f.calendarFetches(),before+1);
 const row=f.sql.prepare('SELECT * FROM portal_calendar_year WHERE year=2026').get();assert.ok(row);assert.ok(!row.payload.includes('Probe Jahrescache'));
 const coldEnv={...f.env,DB:{...f.DB}},response=await f.c.worker.fetch(new Request('https://test.example/admin/portal/year',{method:'POST',headers:{Authorization:'Bearer '+f.env.ADMIN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({source:'test-source',year:2026})}),coldEnv);
 assert.equal(response.status,200);assert.equal((await response.json()).events[0].title,'Probe Jahrescache');assert.equal(f.calendarFetches(),before+1);
 f.clock.now+=301000;f.offline(true);const stale=await f.call('year',{year:2026},null,true);assert.equal(stale.status,200);assert.equal(stale.value.stale,true);assert.equal(stale.value.events[0].title,'Probe Jahrescache');
});

test('Auch mit Jahrescache werden geänderte Empfänger sofort angewendet; andere Kalenderquellen erhalten keinen alten Plan',async()=>{
 const f=await fixture({now:Date.parse('2026-06-15T12:00Z')}),id=(await f.call('list',{},null,true)).value.events[0].id;
 assert.equal((await f.call('year',{year:2026})).value.events.length,1);const before=f.calendarFetches(),cal=(await f.call('list',{},null,true)).value;
 assert.equal((await f.call('classify',{eventId:id,kind:'probe',approved:true,recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.equal((await f.call('year',{year:2026})).value.events.length,0);assert.equal((await f.call('year',{year:2026},f.people[1])).value.events.length,1);assert.equal(f.calendarFetches(),before);
 const configRow=f.sql.prepare('SELECT * FROM portal_config WHERE id=1').get(),config=await f.L.open(f.env,configRow.payload,'portal-config');config.calendarUrl='https://calendar.google.com/calendar/ical/other-test-calendar/public/basic.ics';f.sql.prepare('UPDATE portal_config SET payload=? WHERE id=1').run(await f.L.seal(f.env,config,'portal-config'));f.offline(true);
 assert.equal((await f.call('year',{year:2026},null,true)).status,503,'a snapshot from a different Google source must never be returned');
});
