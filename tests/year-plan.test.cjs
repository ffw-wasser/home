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
