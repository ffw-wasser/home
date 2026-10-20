const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const read=p=>fs.readFileSync(__dirname+'/../'+p,'utf8'),icsTime=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function calendar(events){return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+events.join('\r\n')+'\r\nEND:VCALENDAR\r\n';}
function event(start=Date.now()+86400000,title='Testprobe',extra=''){return `BEGIN:VEVENT\r\nUID:test-event\r\nDTSTART:${icsTime(start)}\r\nDTEND:${icsTime(start+3600000)}\r\nSUMMARY:${title}\r\n${extra}\r\nEND:VEVENT`;}
async function fixture(){
 const sql=new DatabaseSync(':memory:');for(const p of ['schema.sql','central.sql','challenge.sql'])sql.exec(read('cloudflare/push/'+p));
 let batchFailure=false;const DB={prepare(query){return {query,args:[],bind(...args){return {...this,args};},async first(){return sql.prepare(this.query).get(...this.args)||null;},async all(){return {results:sql.prepare(this.query).all(...this.args)};},async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());if(batchFailure){batchFailure=false;throw Error('failure');}sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const start=Date.now()+86400000-30000,sends=[];let raw=calendar([event(start)]),offline=false,calendarFetches=0;const clock={now:Date.now()};
 const c=vm.createContext({console,Date:class extends Date{static now(){return clock.now;}},Intl,TextEncoder,TextDecoder,crypto:webcrypto,Uint8Array,Uint32Array,atob,btoa,Request,Response,Headers,URL,AbortSignal,fetch:async(url,options)=>{if(String(url).startsWith('https://calendar.google.com/')){calendarFetches++;if(offline)throw Error('offline');return new Response(raw,{headers:{'Content-Type':'text/calendar'}});}sends.push({url,options});return new Response(null,{status:201});}});c.globalThis=c;vm.runInContext(read('cloudflare/push/worker.bundle.js').replace('export default {','globalThis.worker = {'),c);
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),env={DB,ADMIN_TOKEN:'TEST-ONLY-ADMIN-'.padEnd(64,'x'),INVITE_SECRET:'TEST-ONLY-INVITE-'.padEnd(64,'y'),VAPID_PRIVATE_JWK:JSON.stringify(await webcrypto.subtle.exportKey('jwk',keys.privateKey)),VAPID_PUBLIC_KEY:Buffer.from(await webcrypto.subtle.exportKey('raw',keys.publicKey)).toString('base64url')},L=c.CentralLedger;
 await DB.prepare("INSERT INTO ledger_meta(id,source,state,seq,policy) VALUES(1,'test-source','active',0,?)").bind(await L.seal(env,{},'policy')).run();const people=[];
 for(let i=1;i<=5;i++){const p={version:1,alias:String(i).repeat(32),key:'a'.repeat(64),revision:'revision-'+i,memberId:'member-'+i};people.push(p);await DB.prepare('INSERT INTO accounts(alias,revision) VALUES(?,?)').bind(p.alias,p.revision).run();await DB.prepare('INSERT INTO ledger_access(alias,revision,payload) VALUES(?,?,?)').bind(p.alias,p.revision,await L.seal(env,p,'access:'+p.alias)).run();}
 const token=vm.runInContext('(env,r)=>capability(env,r.alias,r.revision,"commands")',c),call=async(path,data={},person=people[0],admin=false)=>{const auth=admin?env.ADMIN_TOKEN:await token(env,person),r=await c.worker.fetch(new Request('https://test.example'+(admin?'/admin/portal/':'/portal/')+path,{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify(admin?{source:'test-source',...data}:{...data,alias:person.alias,revision:person.revision})}),env);return {status:r.status,value:await r.json()};};
 await call('configure',{calendarUrl:'https://calendar.google.com/calendar/ical/test-calendar/public/basic.ics',reminders:true,leadHours:24},null,true);await call('roster',{members:people.map((p,i)=>({id:p.memberId,name:'Testperson '+(i+1),leader:i===0}))},null,true);
 const initial=(await call('list',{},null,true)).value;assert.equal((await call('classify',{eventId:initial.events[0].id,kind:'probe',approved:true,expectedVersion:initial.rulesVersion},null,true)).status,200);
 return {c,env,DB,sql,L,people,start,sends,clock,call,raw:v=>raw=v,offline:v=>offline=v,failBatch:()=>batchFailure=true,calendarFetches:()=>calendarFetches};
}
test('Kalenderprojektion: UID bleibt bei Titel-/Zeitwechsel stabil, abgesagte Termine verschwinden',async()=>{const f=await fixture(),first=(await f.call('list')).value.events[0];f.raw(calendar([event(f.start+3600000,'Unterricht') ]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);const changed=(await f.call('list')).value.events[0];assert.equal(changed.id,first.id);assert.equal(changed.title,'Unterricht');assert.equal(changed.start,first.start+3600000);f.raw(calendar([event(f.start,'Testprobe','STATUS:CANCELLED')]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);assert.equal((await f.call('list')).value.events.length,0);});
test('Rückmeldung: echte Speicherung, versionierte Änderung, Wiederholung und Konflikt',async()=>{const f=await fixture(),e=(await f.call('list')).value.events[0],data={eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()};assert.equal((await f.call('reply',data)).status,200);assert.equal((await f.call('reply',data)).value.version,1);assert.equal((await f.call('reply',{...data,status:'excused'})).status,409);assert.equal((await f.call('reply',{...data,requestId:webcrypto.randomUUID()})).status,409);assert.equal((await f.call('reply',{...data,status:'excused',expectedVersion:1,requestId:webcrypto.randomUUID()})).value.version,2);assert.equal((await f.call('list')).value.events[0].status,'excused');assert.equal((await f.call('list',{},f.people[1])).value.events[0].status,'open');const raw=f.sql.prepare('SELECT payload FROM portal_replies').get().payload;assert.ok(!raw.includes('excused'));assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM ledgers').get().n,0);});
test('Nur GF sieht Namen; Client-Rolle, fremde Token und ungültige Zugänge verleihen keine Rechte',async()=>{const f=await fixture(),e=(await f.call('list')).value.events[0];assert.equal((await f.call('list')).value.leader,true);assert.equal((await f.call('overview',{eventId:e.id})).value.members.length,5);assert.equal((await f.call('list',{},f.people[1])).value.leader,false);assert.equal((await f.call('overview',{eventId:e.id,leader:true,challengeLevel:'GF'},f.people[1])).status,403);assert.equal((await f.call('list',{}, {...f.people[0],revision:'wrong-revision'})).status,401);assert.ok(!f.sql.prepare('SELECT payload FROM portal_roster').get().payload.includes('Testperson'));await f.call('roster',{members:[{id:f.people[1].memberId,name:'Testperson 2',leader:true}]},null,true);assert.equal((await f.call('list')).status,403);assert.equal((await f.call('overview',{eventId:e.id},f.people[1])).status,200);});
test('Erinnerung geht an Zusagen und offene Antworten, niemals an Entschuldigte; Wiederholung bleibt einmalig',async()=>{const f=await fixture(),e=(await f.call('list')).value.events[0];for(const p of f.people)assert.equal((await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p)).status,200);for(const [i,status] of [[0,'yes'],[1,'excused'],[2,'maybe']])await f.call('reply',{eventId:e.id,status,expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[i]);const data={eventId:e.id,requestId:webcrypto.randomUUID()};let r=await f.call('remind',data,null,true);assert.equal(r.status,200);assert.equal(r.value.accepted,2);assert.equal(r.value.remaining,2);r=await f.call('remind',data,null,true);assert.equal(r.value.accepted,2);assert.equal(r.value.remaining,0);assert.equal(f.sends.length,4);assert.ok(!f.sends.some(s=>s.url.endsWith('/member-2')));assert.ok(f.sends.every(s=>s.options.body===null));await f.call('remind',data,null,true);assert.equal(f.sends.length,4);assert.equal((await f.call('notification')).value.event.id,e.id);assert.equal((await f.call('notification',{},f.people[1])).value.event,null);});
test('Geplanter Versand bleibt nach wiederholtem Cron einmalig und setzt keinen Admin-Aufruf voraus',async()=>{const f=await fixture();for(const p of f.people)await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p);await f.c.PortalService.scheduled(f.env);await f.c.PortalService.scheduled(f.env);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,5);await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,5);});
test('Unsichere Antwort bleibt gespeichert, versioniert und getrennt von offenen Antworten',async()=>{
 const f=await fixture(),list=(await f.call('list')).value,e=list.events[0],job={eventId:e.id,status:'maybe',expectedVersion:0,requestId:webcrypto.randomUUID()};assert.equal(list.uncertainReplies,true);
 assert.equal((await f.call('reply',job)).status,200);assert.equal((await f.call('reply',job)).value.version,1);assert.equal((await f.call('reply',{...job,status:'yes'})).status,409);
 assert.equal((await f.call('list')).value.events[0].status,'maybe');assert.equal((await f.call('overview',{eventId:e.id})).value.members.find(m=>m.name==='Testperson 1').status,'maybe');
 assert.equal((await f.call('list',{},f.people[1])).value.events[0].status,'open');
 assert.equal((await f.call('reply',{...job,status:'open',expectedVersion:1,requestId:webcrypto.randomUUID()})).value.version,2);assert.equal((await f.call('list')).value.events[0].status,'open');assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM ledgers').get().n,0);
});
test('Unsichere Mitglieder erhalten die konfigurierte Erinnerung einmalig, Entschuldigte nicht',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0];await f.call('configure',{calendarUrl:'https://calendar.google.com/calendar/ical/test-calendar/public/basic.ics',reminders:true,leadHours:12},null,true);
 for(const p of f.people)await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p);
 for(const [i,status] of [[0,'maybe'],[1,'excused'],[2,'yes']])assert.equal((await f.call('reply',{eventId:e.id,status,expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[i])).status,200);
 await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,0);f.clock.now=e.start-12*3600000+1000;
 for(let i=0;i<4;i++)await f.c.PortalService.scheduled(f.env);assert.equal(f.sends.length,4);assert.ok(f.sends.some(s=>s.url.endsWith('/member-1')));assert.ok(!f.sends.some(s=>s.url.endsWith('/member-2')));assert.equal((await f.call('notification')).value.event.id,e.id);
});
test('Kalenderausfall zeigt letzten Stand, blockiert Schreiben und Erinnerungen; abgelaufener Termin ist gesperrt',async()=>{const f=await fixture(),e=(await f.call('list')).value.events[0];f.offline(true);f.clock.now+=901000;await f.c.PortalService.scheduled(f.env);assert.equal((await f.call('list')).value.stale,true);assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()})).status,503);assert.equal((await f.call('remind',{eventId:e.id,requestId:webcrypto.randomUUID()},null,true)).status,503);f.offline(false);f.clock.now=e.start+1000;await f.c.PortalService.scheduled(f.env);assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()})).status,409);});
test('Kalenderverbindung weist fremde Hosts, private Links, Querys und Kalenderwechsel ab',async()=>{const f=await fixture();for(const url of ['https://example.invalid/calendar.ics','https://calendar.google.com/calendar/ical/test/private-secret/basic.ics','https://calendar.google.com/calendar/ical/test/public/basic.ics?redirect=x'])assert.equal((await f.call('configure',{calendarUrl:url,reminders:false,leadHours:24},null,true)).status,400);assert.equal((await f.call('configure',{calendarUrl:'https://calendar.google.com/calendar/ical/other/public/basic.ics',reminders:false,leadHours:24},null,true)).status,409);});
test('Serien: EXDATE, verschobene Einzeltermine, abgesagte Ausnahmen und ganztägige Termine',()=>{const c=vm.createContext({Intl,Date});c.globalThis=c;vm.runInContext(read('js/vendor/ical.js')+'\n'+read('js/features/portal/calendar-model.js'),c);const raw=calendar([`BEGIN:VEVENT\r\nUID:weekly\r\nDTSTART:20261020T170000Z\r\nDTEND:20261020T180000Z\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE:20261027T170000Z\r\nSUMMARY:Probe\r\nEND:VEVENT`,`BEGIN:VEVENT\r\nUID:weekly\r\nRECURRENCE-ID:20261103T170000Z\r\nDTSTART:20261104T180000Z\r\nDTEND:20261104T190000Z\r\nSUMMARY:Unterricht\r\nEND:VEVENT`,`BEGIN:VEVENT\r\nUID:weekly\r\nRECURRENCE-ID:20261110T170000Z\r\nDTSTART:20261110T170000Z\r\nDTEND:20261110T180000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT`,`BEGIN:VEVENT\r\nUID:day\r\nDTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026\r\nSUMMARY:Tag\r\nEND:VEVENT`]);const events=c.PortalCalendar.parse(raw,Date.parse('2026-10-19T00:00:00Z'));assert.equal(events.length,3);assert.equal(events.find(e=>e.title==='Unterricht').key,'weekly\n2026-11-03T17:00:00Z');assert.equal(events.find(e=>e.title==='Tag').start,Date.parse('2026-10-24T22:00:00Z'));assert.equal(events.find(e=>e.title==='Tag').allDay,true);});

test('Nur freigegebene Probetermine sind sichtbar und anmeldbar; Geburtstag ist keine Probe',async()=>{const f=await fixture();f.raw(calendar([event(f.start),event(f.start+3600000,'Ungeprüft').replace('UID:test-event','UID:other'),event(f.start+7200000,'Geburtstag Testperson').replace('UID:test-event','UID:birthday')]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);const list=(await f.call('list',{},null,true)).value;assert.equal(list.events.length,3);const birthday=list.events.find(e=>e.kind==='birthday'),unapproved=list.events.find(e=>e.title==='Ungeprüft');assert.ok(birthday);assert.equal((await f.call('list')).value.events.length,1);for(const e of [birthday,unapproved])assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()})).status,404);assert.equal((await f.call('classify',{eventId:unapproved.id,kind:'probe',approved:true,expectedVersion:list.rulesVersion},null,true)).status,200);assert.equal((await f.call('list')).value.events.length,2);assert.equal((await f.call('classify',{eventId:birthday.id,kind:'probe',approved:true,expectedVersion:list.rulesVersion},null,true)).status,409);});
async function birthday(f){f.raw(calendar([event(f.clock.now,'Geburtstag Testperson')]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);const cal=(await f.call('list',{},null,true)).value,e=cal.events[0];assert.equal((await f.call('classify',{eventId:e.id,kind:'birthday',approved:false,memberId:f.people[0].memberId,expectedVersion:cal.rulesVersion},null,true)).status,200);return e;}
test('Geburtstag vergibt genau 1 Punkt jährlich ohne Geld-/Verbrauchsänderung, auch bei doppelten Einträgen',async()=>{const f=await fixture(),e=await birthday(f);for(let i=0;i<3;i++)await f.c.PortalService.scheduled(f.env);const a=(await f.L.read(f.env,f.people[0].memberId)).account,M=f.c.DrinksModel;assert.equal(a.schemaVersion,10);assert.equal(a.bookings.length,1);assert.equal(a.bookings[0].type,'birthday-reward');assert.equal(M.rewardState(a,null).pointUnits,150);assert.equal(M.totals(a).balance,0);assert.equal(M.totals(a).count,0);assert.equal(M.rewardState(a,null).credit,0);const stats=M.consumption([a],new Date().getFullYear());assert.equal(stats.birthdayPointUnits,150);assert.equal(stats.earnedPointUnits,150);assert.equal(stats.total,0);assert.equal((await f.call('list')).value.birthday.awarded,true);assert.equal((await f.call('list',{},f.people[1])).value.birthday,null);assert.equal((await f.call('list')).value.events.length,0);assert.throws(()=>M.append(M.empty('test'),a.bookings[0]));assert.equal((await f.call('remind',{eventId:e.id,requestId:webcrypto.randomUUID()},null,true)).status,404);assert.equal(f.sends.length,0);});
test('Geburtstagsbonus und Jahresmarker werden gemeinsam zurückgerollt; Kontoreset erlaubt keinen zweiten Bonus',async()=>{const f=await fixture();await birthday(f);f.failBatch();await assert.rejects(f.c.PortalService.scheduled(f.env));assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_birthdays').get().n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM ledgers').get().n,0);await f.c.PortalService.scheduled(f.env);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_birthdays').get().n,1);const reset={...f.c.DrinksModel.empty(f.people[0].memberId),schemaVersion:7,resetEpoch:webcrypto.randomUUID(),resetAt:new Date(f.clock.now-1).toISOString()};await f.DB.prepare('UPDATE ledgers SET payload=?,version=version+1 WHERE member=?').bind(await f.L.seal(f.env,reset,'ledger:'+reset.memberId),reset.memberId).run();await f.c.PortalService.scheduled(f.env);assert.equal((await f.L.read(f.env,reset.memberId)).account.bookings.length,0);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_birthdays').get().n,1);});
test('Unzugeordneter Geburtstag vergibt nichts; neue Jahresgutschrift bewahrt Challenge und Snapshot-Kompatibilität',async()=>{const unmatched=await fixture();unmatched.raw(calendar([event(unmatched.clock.now,'Geburtstag Testperson').replace('UID:test-event','UID:unassigned-birthday')]));unmatched.clock.now+=301000;await unmatched.c.PortalService.scheduled(unmatched.env);await unmatched.c.PortalService.scheduled(unmatched.env);assert.equal(unmatched.sql.prepare('SELECT COUNT(*) n FROM ledgers').get().n,0);const f=await fixture();await birthday(f);await f.c.PortalService.scheduled(f.env);const M=f.c.DrinksModel,base=(await f.L.read(f.env,f.people[0].memberId)).account,gameId=webcrypto.randomUUID(),next=M.appendChallengeReward(base,{id:'challenge-reward-'+gameId,type:'challenge-reward',gameId,confirmation:'challenge',month:new Date(f.clock.now).toISOString().slice(0,7),score:5,cents:150,createdAt:new Date(f.clock.now).toISOString()});assert.equal(next.schemaVersion,10);const policy={schemaVersion:2,id:'test-policy',revision:'test-revision',startedAt:'2026-01-01T00:00:00Z',thresholdCents:3000,awardUnits:150,beerUnits:150,wineUnits:150},snapshot=f.c.DrinksLedger.snapshot(next,policy);assert.equal(f.c.DeckelCrypto.validate(snapshot),snapshot);assert.equal(snapshot.bookings[1].type,'birthday-reward');assert.equal(snapshot.bookings[1].year,new Date(f.clock.now).getFullYear());});

test('Geburtstagspunkte: Standard 1, versionierte gemeinsame Einstellung und keine nachträgliche Doppelgutschrift',async()=>{const f=await fixture();await birthday(f);const status=(await f.call('birthday-status',{},null,true)).value.birthdayPolicy;assert.equal(status.awardUnits,150);const policy={revision:webcrypto.randomUUID(),expectedRevision:status.revision,awardUnits:450};assert.equal((await f.call('birthday-policy',policy,null,true)).status,200);assert.equal((await f.call('birthday-policy',policy,null,true)).status,200);assert.equal((await f.call('birthday-policy',{...policy,awardUnits:600},null,true)).status,409);assert.equal((await f.call('birthday-policy',{...policy,revision:webcrypto.randomUUID()},null,true)).status,409);assert.equal((await f.call('birthday-policy',{...policy,awardUnits:151},null,true)).status,400);await f.c.PortalService.scheduled(f.env);const a=(await f.L.read(f.env,f.people[0].memberId)).account;assert.equal(a.bookings[0].cents,450);assert.equal(f.c.DrinksModel.rewardState(a,null).pointUnits,450);assert.equal((await f.call('list')).value.birthday.awardUnits,450);await f.call('birthday-policy',{revision:webcrypto.randomUUID(),expectedRevision:policy.revision,awardUnits:750},null,true);await f.c.PortalService.scheduled(f.env);assert.equal((await f.L.read(f.env,f.people[0].memberId)).account.bookings[0].cents,450);assert.equal((await f.call('list')).value.birthday.awardUnits,450);assert.ok(!read('index.html').includes('portal-admin-birthday-points'));assert.ok(read('js/features/drinks/drinks-birthday-settings.js').includes("VIEW='settingsRewardsView'"));});
test('Geburtstagsserie folgt Europe/Berlin über Jahresgrenzen und vergibt im Folgejahr den aktuellen Bonus',async()=>{const f=await fixture();f.clock.now=Date.parse('2026-12-31T23:30:00Z');f.raw(calendar(['BEGIN:VEVENT\r\nUID:annual-birthday\r\nDTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260102\r\nRRULE:FREQ=YEARLY\r\nSUMMARY:Geburtstag Testperson\r\nEND:VEVENT']));await f.c.PortalService.scheduled(f.env);const cal=(await f.call('list',{},null,true)).value,e=cal.events.find(e=>new Date(e.start).getUTCFullYear()===2026);assert.equal((await f.call('classify',{eventId:e.id,kind:'birthday',approved:false,memberId:f.people[0].memberId,expectedVersion:cal.rulesVersion},null,true)).status,200);await f.c.PortalService.scheduled(f.env);let a=(await f.L.read(f.env,f.people[0].memberId)).account;assert.equal(a.bookings[0].year,2027);assert.equal(a.bookings[0].cents,150);const p=(await f.call('birthday-status',{},null,true)).value.birthdayPolicy;await f.call('birthday-policy',{revision:webcrypto.randomUUID(),expectedRevision:p.revision,awardUnits:300},null,true);f.clock.now=Date.parse('2027-12-31T23:30:00Z');await f.c.PortalService.scheduled(f.env);await f.c.PortalService.scheduled(f.env);a=(await f.L.read(f.env,f.people[0].memberId)).account;assert.deepEqual(Array.from(a.bookings,b=>b.year),[2027,2028]);assert.deepEqual(Array.from(a.bookings,b=>b.cents),[150,300]);assert.equal(f.c.DrinksModel.rewardState(a,null).pointUnits,450);});
test('TZID und Serien behalten die lokale Uhrzeit beim Wechsel auf Winterzeit',()=>{const c=vm.createContext({Intl,Date});c.globalThis=c;vm.runInContext(read('js/vendor/ical.js')+'\n'+read('js/features/portal/calendar-model.js'),c);const raw='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTIMEZONE\r\nTZID:Europe/Berlin\r\nBEGIN:DAYLIGHT\r\nDTSTART:19700329T020000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nDTSTART:19701025T030000\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:local-probe\r\nDTSTART;TZID=Europe/Berlin:20261021T193000\r\nDTEND;TZID=Europe/Berlin:20261021T213000\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Probe\r\nEND:VEVENT\r\nEND:VCALENDAR';const events=c.PortalCalendar.parse(raw,Date.parse('2026-10-20T00:00:00Z'));assert.deepEqual(Array.from(events,e=>new Date(e.start).toISOString()),['2026-10-21T17:30:00.000Z','2026-10-28T18:30:00.000Z']);});

test('Automatische Terminarten: Probe, Sonderprobe und übrige Einträge; Freigabe bleibt ausdrücklich',async()=>{
 const f=await fixture();f.raw(calendar(['Probe Löschangriff','Gesamtprobe','Sonderprobe Atemschutz','Unterricht','Ausflug'].map((title,i)=>event(f.start+i*3600000,title).replace('UID:test-event','UID:auto-'+i))));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 let cal=(await f.call('list',{},null,true)).value;assert.deepEqual(Array.from(cal.events,e=>e.sessionType),['Probe','Probe','Sonderprobe','Sonderprobe','Sonderprobe']);assert.ok(cal.events.every(e=>e.kind==='probe'&&e.automatic&&!e.approved));assert.equal((await f.call('list')).value.events.length,0);
 const e=cal.events[3];assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Probe',approved:true,expectedVersion:cal.rulesVersion},null,true)).status,200);cal=(await f.call('list',{},null,true)).value;assert.equal(cal.events[3].sessionType,'Probe');assert.equal(cal.events[3].automatic,false);assert.equal((await f.call('list')).value.events.length,1);
 assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Einsatz',approved:true,expectedVersion:cal.rulesVersion},null,true)).status,400);
});
test('Geburtstag wird bei eindeutigem vollständigem Namen automatisch zugeordnet und einmal belohnt',async()=>{
 const f=await fixture();await f.call('roster',{members:[{id:f.people[0].memberId,name:'Müller Anna',leader:true}]},null,true);f.raw(calendar([event(f.clock.now,'🎂 Geburtstag Anna Mueller (40)').replace('UID:test-event','UID:auto-birthday')]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 const e=(await f.call('list',{},null,true)).value.events[0];assert.equal(e.kind,'birthday');assert.equal(e.memberId,f.people[0].memberId);assert.equal(e.automatic,true);assert.equal(e.approved,false);await f.c.PortalService.scheduled(f.env);await f.c.PortalService.scheduled(f.env);assert.equal((await f.L.read(f.env,f.people[0].memberId)).account.bookings.length,1);
});
test('Geburtstag: doppelte Namen, Teilnamen und unbekannte Namen bleiben offen; manuelle Zuordnung hat Vorrang',async()=>{
 const f=await fixture();await f.call('roster',{members:[{id:f.people[0].memberId,name:'Beispiel Anna',leader:true},{id:f.people[1].memberId,name:'Anna Beispiel',leader:false}]},null,true);f.raw(calendar(['Geburtstag Anna Beispiel','Geburtstag Anna','Geburtstag Unbekannt Person'].map((title,i)=>event(f.start+i*3600000,title).replace('UID:test-event','UID:ambiguous-'+i))));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 let cal=(await f.call('list',{},null,true)).value;assert.ok(cal.events.every(e=>e.kind==='birthday'&&e.memberId===null));const e=cal.events[0];assert.equal((await f.call('classify',{eventId:e.id,kind:'birthday',approved:false,memberId:f.people[1].memberId,expectedVersion:cal.rulesVersion},null,true)).status,200);
 await f.call('roster',{members:[{id:f.people[0].memberId,name:'Beispiel Anna',leader:true},{id:f.people[1].memberId,name:'Anders Bea',leader:false}]},null,true);cal=(await f.call('list',{},null,true)).value;assert.equal(cal.events[0].memberId,f.people[1].memberId);assert.equal(cal.events[0].automatic,false);
});

test('Sonderprobe beschränkt Liste, Antworten, GF-Übersicht und Push auf ausgewählte Empfänger',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,e=cal.events[0],ids=[f.people[0].memberId,f.people[1].memberId];
 const saved=await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Sonderprobe',attendanceType:'Unterricht',recipientIds:ids,approved:true,expectedVersion:cal.rulesVersion},null,true);assert.equal(saved.status,200);assert.equal(saved.value.attendanceType,'Unterricht');
 assert.equal((await f.call('list',{},f.people[2])).value.events.length,0);const mine=(await f.call('list')).value.events[0];assert.equal(mine.attendanceType,'Unterricht');assert.equal(mine.recipientIds,undefined);assert.equal((await f.call('overview',{eventId:e.id})).value.members.length,2);
 for(const route of ['reply','overview'])assert.equal((await f.call(route,{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[2])).status,404);
 for(const p of f.people)await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p);
 await f.call('reply',{eventId:e.id,status:'excused',expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[1]);await f.call('remind',{eventId:e.id,requestId:webcrypto.randomUUID()},null,true);assert.equal(f.sends.length,1);assert.ok(f.sends[0].url.endsWith('/member-1'));
 assert.equal((await f.c.PortalService.publicCalendar(f.env)).events.length,0);
});

test('Normale Probe kann nachträglich auf bestimmte Mitglieder begrenzt und erneut für alle freigegeben werden',async()=>{
 const f=await fixture(),initial=(await f.call('list',{},null,true)).value,e=initial.events[0];
 const ids=[f.people[0].memberId,f.people[1].memberId];
 const save=await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Probe',attendanceType:'Allgemeine Probe',approved:true,recipientIds:ids,expectedVersion:initial.rulesVersion},null,true);
 assert.equal(save.status,200);
 assert.equal(save.value.recipientFeatureVersion,2);
 let list=(await f.call('list',{},null,true)).value;
 assert.equal(list.events[0].sessionType,'Probe');
 assert.deepEqual(Array.from(list.events[0].recipientIds),ids);
 assert.equal((await f.call('list',{},f.people[2])).value.events.length,0);
 assert.equal((await f.call('list',{},f.people[0])).value.events.length,1);
 assert.equal((await f.c.PortalService.publicCalendar(f.env)).events.length,0);
 const reopen=await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Probe',attendanceType:'Allgemeine Probe',approved:true,recipientIds:null,expectedVersion:list.rulesVersion},null,true);
 assert.equal(reopen.status,200);
 list=(await f.call('list',{},null,true)).value;
 assert.equal(list.events[0].sessionType,'Probe');
 assert.equal(list.events[0].recipientIds,null);
 assert.equal((await f.call('list',{},f.people[2])).value.events.length,1);
 assert.equal((await f.c.PortalService.publicCalendar(f.env)).events.length,1);
});

test('Öffentlicher Kalender enthält nur neutrale freigegebene Termine und keine privaten Daten',async()=>{
 const f=await fixture(),r=await f.c.worker.fetch(new Request('https://test.example/calendar/public',{headers:{Origin:'https://ffw-wasser.github.io'}}),f.env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');const data=await r.json();assert.equal(data.events.length,1);assert.ok(['Probe','Sonderprobe'].includes(data.events[0].title));assert.deepEqual(Object.keys(data.events[0]).sort(),['allDay','approved','attendanceType','end','id','kind','sessionType','start','title']);assert.ok(!JSON.stringify(data).includes('Testperson'));assert.ok(!JSON.stringify(data).includes('calendar.google.com'));assert.equal(data.rulesVersion,undefined);
 const forbidden=await f.c.worker.fetch(new Request('https://test.example/admin/portal/list',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),f.env);assert.equal(forbidden.status,401);
});

test('Terminarten und Empfängerauswahl werden serverseitig validiert',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,base={eventId:cal.events[0].id,kind:'probe',sessionType:'Sonderprobe',approved:true,expectedVersion:cal.rulesVersion};
 for(const recipientIds of [[],['unknown'],['member-1','member-1']])assert.equal((await f.call('classify',{...base,recipientIds},null,true)).status,400);
 assert.equal((await f.call('classify',{...base,attendanceType:'unknown'},null,true)).status,400);
 for(const attendanceType of ['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung','Einsatz']){const current=(await f.call('list',{},null,true)).value;assert.equal((await f.call('classify',{...base,attendanceType,expectedVersion:current.rulesVersion},null,true)).status,200);assert.equal((await f.call('list',{},null,true)).value.events[0].attendanceType,attendanceType);}
});

test('Bereinigung entfernt Rückmeldungen nach sechs Stunden, erhält Kalender-Korrekturen 31 Tage',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0];await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()});
 const rules=await f.sql.prepare('SELECT * FROM portal_rules WHERE id=1').get(),value=await f.L.open(f.env,rules.payload,'portal-rules');value['birthday-series']={kind:'birthday',memberId:'member-1'};await f.DB.prepare('UPDATE portal_rules SET payload=? WHERE id=1').bind(await f.L.seal(f.env,value,'portal-rules')).run();
 f.clock.now=e.end+6*3600000-1;await f.c.PortalService.scheduled(f.env);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,1);
 f.clock.now=e.end+6*3600000;await f.c.PortalService.scheduled(f.env);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);const after=await f.L.open(f.env,f.sql.prepare('SELECT payload FROM portal_rules WHERE id=1').get().payload,'portal-rules');assert.equal(after[e.id]?.kind,'probe','Vergangener Termin bleibt für nachträgliche Korrekturen erhalten');assert.equal(after['birthday-series'].kind,'birthday');assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM ledgers').get().n,0);
 f.clock.now=e.end+31*86400000;await f.c.PortalService.scheduled(f.env);const past=await f.L.open(f.env,f.sql.prepare('SELECT payload FROM portal_rules WHERE id=1').get().payload,'portal-rules');assert.equal(past[e.id],undefined);assert.equal(past['birthday-series'].kind,'birthday');
});

test('Verschobener Termin behält Freigabe und Rückmeldungen trotz alter gespeicherter Ablaufzeit',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0];await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()});f.raw(calendar([event(e.start+3*86400000)]));f.clock.now=e.end+7*3600000;await f.c.PortalService.scheduled(f.env);const next=(await f.call('list')).value.events[0];assert.equal(next.id,e.id);assert.equal(next.status,'yes');assert.equal(next.start,e.start+3*86400000);
});

test('Kalenderausfall verhindert Bereinigung und neue Freigaben; Admin-Snapshot wird veraltet markiert',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0];await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()});f.offline(true);f.clock.now=e.end+7*3600000;await f.c.PortalService.scheduled(f.env);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,1);const cal=(await f.call('list',{},null,true)).value;assert.equal(cal.stale,true);assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',approved:false,expectedVersion:cal.rulesVersion},null,true)).status,503);
});

test('Gleichzeitige Regeländerung verhindert verlustreiche Bereinigung',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Probe',approved:true,expectedVersion:cal.rulesVersion},null,true)).status,200);
 const originalRules=await f.L.open(f.env,f.sql.prepare('SELECT payload FROM portal_rules WHERE id=1').get().payload,'portal-rules');
 assert.ok(originalRules[e.id]);
 // The cleanup attempts rule deletion only after its 31-day correction window.
 const prepare=f.DB.prepare;f.DB.prepare=query=>{const statement=prepare(query);if(query.startsWith('UPDATE portal_rules SET payload=?'))statement.run=async()=>({meta:{changes:0}});return statement;};
 f.clock.now=e.end+32*86400000;await f.c.PortalService.scheduled(f.env);
 const kept=await f.L.open(f.env,f.sql.prepare('SELECT payload FROM portal_rules WHERE id=1').get().payload,'portal-rules');
 assert.ok(kept[e.id],'Optimistic conflict must retain the pre-existing archive classification');
});

test('Automatische Erinnerungen gelten auch bei alter deaktivierter Einstellung und beachten Empfänger sowie Entschuldigungen',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 const cfg=(await f.call('config',{},null,true)).value.config;
 await f.DB.prepare('UPDATE portal_config SET payload=? WHERE id=1').bind(await f.L.seal(f.env,{...cfg,reminders:false},'portal-config')).run();
 assert.equal((await f.call('config',{},null,true)).value.config.reminders,true);
 const ids=f.people.slice(0,3).map(p=>p.memberId);
 assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Sonderprobe',recipientIds:ids,approved:true,expectedVersion:cal.rulesVersion},null,true)).status,200);
 for(const p of f.people)await f.call('subscribe',{endpoint:'https://fcm.googleapis.com/'+p.memberId},p);
 for(const [i,status] of [[0,'yes'],[1,'excused']])assert.equal((await f.call('reply',{eventId:e.id,status,expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[i])).status,200);
 for(let i=0;i<4;i++)await f.c.PortalService.scheduled(f.env);
 assert.deepEqual(f.sends.map(s=>s.url).sort(),['https://fcm.googleapis.com/member-1','https://fcm.googleapis.com/member-3']);
});
test('Kalender kann mit Vorlauf gespeichert werden; alte Clients können Erinnerungen nicht deaktivieren',async()=>{
 const f=await fixture(),config=(await f.call('config',{},null,true)).value.config;
 for(const patch of [{reminders:false},{}]){
  assert.equal((await f.call('configure',{calendarUrl:config.calendarUrl,leadHours:12,...patch},null,true)).status,200);
  const saved=(await f.call('config',{},null,true)).value.config;assert.equal(saved.reminders,true);assert.equal(saved.leadHours,12);
 }
});

test('Nachweise sind verschlüsselt, kalenderunabhängig und nur für das authentifizierte Mitglied sichtbar',async()=>{
 const f=await fixture(),E=f.c.MemberEvidence;
 const people=f.people.map((p,i)=>({id:p.memberId,name:'Testperson '+(i+1),leader:i===0,evidence:E.project(i===0?{breathingQualified:true,g263ValidUntil:'2030-05-12'}:{machinistVehicles:['TSF'],driverLicenseCheckedOn:'2026-01-17'})}));
 assert.equal((await f.call('roster',{members:people},null,true)).value.evidenceVersion,1);
 const first=(await f.call('evidence',{memberId:f.people[1].memberId})).value,second=(await f.call('evidence',{},f.people[1])).value;
 assert.equal(first.evidence.breathing.g263,'2030-05-12');assert.equal(first.evidence.driver,null);assert.equal(second.evidence.breathing,null);assert.equal(second.evidence.driver.checkedOn,'2026-01-17');assert.ok(first.syncedAt);
 const encrypted=f.sql.prepare('SELECT payload FROM portal_roster').get().payload;assert.ok(!encrypted.includes('2030-05-12'));
 assert.ok(!(await f.call('overview',{eventId:(await f.call('list')).value.events[0].id})).value.members.some(m=>m.evidence));
 assert.ok(!JSON.stringify(await f.c.PortalService.publicCalendar(f.env)).includes('2030-05-12'));
 f.sql.exec('DELETE FROM portal_config; DELETE FROM portal_calendar');f.offline(true);assert.equal((await f.call('evidence')).status,200);
 const invalid=await f.c.worker.fetch(new Request('https://test.example/portal/evidence',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer invalid','Content-Type':'application/json'},body:JSON.stringify({alias:f.people[0].alias,revision:f.people[0].revision})}),f.env);assert.equal(invalid.status,401);
 await f.call('roster',{members:[people[1]]},null,true);assert.equal((await f.call('evidence')).status,403);
});
test('Ältere Mitgliederabgleiche bewahren Nachweise und deren ursprünglichen Datenstand',async()=>{
 const f=await fixture(),m={id:f.people[0].memberId,name:'Testperson 1',leader:true,evidence:f.c.MemberEvidence.project({breathingQualified:true})};
 await f.call('roster',{members:[m]},null,true);const original=(await f.call('evidence')).value;f.clock.now+=10000;
 const {evidence,...legacy}=m;await f.call('roster',{members:[legacy]},null,true);const retained=(await f.call('evidence')).value;
 assert.deepEqual(retained.evidence,original.evidence);assert.equal(retained.syncedAt,original.syncedAt);
 const invalid={...evidence,breathing:{g263:'2026-02-30',instruction:'',ffi:''}};
 assert.equal((await f.call('roster',{members:[{...m,evidence:invalid}]},null,true)).status,400);
 assert.deepEqual((await f.call('evidence')).value.evidence,original.evidence);
});

test('Mitgliederabgleich mit Nachweisen unterstützt realistische Listen über 6000 Zeichen',async()=>{
 const f=await fixture(),members=Array.from({length:40},(_,i)=>({id:i<5?f.people[i].memberId:'test-member-'+i,name:'Künstliche Testperson '+i,leader:i===0,evidence:f.c.MemberEvidence.project({breathingQualified:i%2===0,g262ValidUntil:'2028-01-01',g263ValidUntil:'2028-02-01',agtInstructionValidUntil:'2028-03-01',ffiValidUntil:'2028-04-01',machinistVehicles:['LF','TSF'],driverLicenseCheckedOn:'2026-01-17'})}));
 assert.ok(JSON.stringify({source:'test-source',members}).length>6000);
 const result=await f.call('roster',{members},null,true);assert.equal(result.status,200,JSON.stringify(result.value));assert.equal(result.value.evidenceVersion,1);assert.equal((await f.call('evidence')).value.evidence.medical.g262,'2028-01-01');
});

test('Größere Portal-Anfragen bleiben begrenzt; private Aufrufe behalten die kleine Grenze',async()=>{
 const f=await fixture();
 const memberCall=await f.call('evidence',{padding:'x'.repeat(6100)});assert.equal(memberCall.status,413);assert.match(memberCall.value.error,/zulässige Größe/);
 const oversized=await f.call('roster',{padding:'x'.repeat(512001),members:[]},null,true);assert.equal(oversized.status,413);assert.equal((await f.call('list',{},null,true)).value.events.length,1);
});

test('GF-Übersicht liest aktuelle Rückmeldungen ohne Google-Abruf, auch bei altem Kalenderstand',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0];
 await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[1]);
 f.clock.now+=901000;f.offline(true);const before=f.calendarFetches();
 const overview=await f.call('overview',{eventId:e.id});
 assert.equal(overview.status,200);assert.equal(overview.value.stale,true);
 assert.deepEqual(overview.value.members.map(m=>m.status),['open','yes','open','open','open']);
 assert.equal((await f.call('replies',{eventId:e.id},null,true)).status,200);
 assert.equal((await f.call('overview',{eventId:e.id},f.people[1])).status,403);
 assert.equal(f.calendarFetches(),before,'Leseübersichten dürfen nicht auf Google warten');
});
test('Anzeige und Antworten akzeptieren denselben Kalenderstand für 15 Minuten',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0],before=f.calendarFetches();f.offline(true);
 assert.equal((await f.call('reply',{eventId:e.id,status:'maybe',expectedVersion:0,requestId:webcrypto.randomUUID()})).status,200);
 f.clock.now+=301000;assert.equal((await f.call('list')).value.stale,false);
 assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:1,requestId:webcrypto.randomUUID()})).status,200);
 f.clock.now+=600001;const r=await f.call('reply',{eventId:e.id,status:'excused',expectedVersion:2,requestId:webcrypto.randomUUID()});assert.equal(r.status,503);assert.equal(f.calendarFetches(),before);
 const list=await f.call('list');assert.equal(list.value.stale,true);assert.equal(list.value.events[0].status,'yes');
});

test('Kleidung: Vorgaben, Auswahl und Freitext bleiben im persönlichen Kalender gespeichert',async()=>{
 const f=await fixture();
 let cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 assert.equal(cal.clothingVersion,1);assert.equal(e.clothing,'Tagesdienst');
 async function save(extra){cal=(await f.call('list',{},null,true)).value;return f.call('classify',{eventId:e.id,kind:'probe',sessionType:'Probe',approved:true,expectedVersion:cal.rulesVersion,...extra},null,true);}
 for(const clothing of ['Einsatzkleidung','Einsatz','Tagesdienst','Uniform','T-Shirt/ Fest','Zivil','  Jacke mitbringen  ','']){
  assert.equal((await save({clothing})).status,200);
  assert.equal((await f.call('list')).value.events[0].clothing,clothing==='Einsatz'?'Einsatzkleidung':clothing.trim());
 }
 await save({clothing:'Uniform'});
 await save({attendanceType:'Unterricht'});
 assert.equal((await f.call('list')).value.events[0].clothing,'Uniform');
 for(const clothing of [42,'x'.repeat(121),'Zivil\nUniform'])assert.equal((await save({clothing})).status,400);
 assert.equal((await f.call('list')).value.events[0].clothing,'Uniform');
 f.raw(calendar([event(f.start,'Probe').replace('UID:test-event','UID:new-probe')]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 cal=(await f.call('list',{},null,true)).value;assert.equal(cal.events[0].clothing,'Einsatzkleidung');
});

test('Ort: GH Wasser als Vorgabe, bestehender Kalenderort und individuelle Speicherung',async()=>{
 const f=await fixture();let cal=(await f.call('list',{},null,true)).value;const id=cal.events[0].id;
 assert.equal(cal.locationVersion,1);assert.equal(cal.events[0].location,'GH Wasser');
 async function save(extra){cal=(await f.call('list',{},null,true)).value;return f.call('classify',{eventId:id,kind:'probe',approved:true,expectedVersion:cal.rulesVersion,...extra},null,true);}
 assert.equal((await save({location:'  Treffpunkt Testplatz  '})).status,200);
 assert.equal((await f.call('list')).value.events[0].location,'Treffpunkt Testplatz');
 await save({clothing:'Uniform'});assert.equal((await f.call('list')).value.events[0].location,'Treffpunkt Testplatz');
 for(const location of ['',42,'x'.repeat(301),'Ort\nZeile'])assert.equal((await save({location})).status,400);
 await save({location:'GH Wasser'});assert.equal((await f.call('list')).value.events[0].location,'GH Wasser');
 f.raw(calendar([event(f.start,'Probe','LOCATION:Anderer Treffpunkt').replace('UID:test-event','UID:location-event')]));f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 cal=(await f.call('list',{},null,true)).value;assert.equal(cal.events[0].location,'Anderer Treffpunkt');
});

test('Öffnen aktualisiert einen abgelaufenen Kalender auch ohne Cron und erlaubt danach Rückmeldung',async()=>{
 const f=await fixture(),e=(await f.call('list')).value.events[0],before=f.calendarFetches();f.clock.now+=901000;
 const list=await f.call('list');assert.equal(list.value.stale,false);assert.equal(f.calendarFetches(),before+1);
 assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()})).status,200);
 f.raw(calendar([event(f.start,'Testprobe','STATUS:CANCELLED')]));f.clock.now+=901000;
 assert.equal((await f.call('list')).value.events.length,0);assert.equal((await f.call('reply',{eventId:e.id,status:'excused',expectedVersion:1,requestId:webcrypto.randomUUID()})).status,404);
});


test('WhatsApp/Safari: einmalig koppeln, Rückmeldung wiederholt ändern, Zeitpunkt anzeigen und Zugriff eingrenzen',async()=>{
 const f=await fixture(),event=(await f.call('list')).value.events[0];
 const code=(await f.call('browser/start')).value;
 assert.match(code.code,/^[A-F0-9]{24}$/);
 assert.equal(code.expiresAt-f.clock.now,5*60*1000);
 async function browser(path,body={},token=''){
  const response=await f.c.worker.fetch(new Request('https://test.example/portal/'+path,{
   method:'POST',headers:{Origin:'https://ffw-wasser.github.io','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   body:JSON.stringify(body)
  }),f.env);
  return {status:response.status,value:await response.json()};
 }
 const redeemed=await browser('browser/redeem',{code:code.code});
 assert.equal(redeemed.status,200);assert.match(redeemed.value.token,/^[a-f0-9]{64}$/);
 assert.equal((await browser('browser/redeem',{code:code.code})).status,401,'Einmalcode ist nur einmal nutzbar');
 const auth=redeemed.value.token,identity={alias:redeemed.value.alias,revision:redeemed.value.revision};
 const list=await browser('list',identity,auth);assert.equal(list.status,200);
 assert.equal(list.value.events[0].id,event.id);
 assert.equal((await browser('overview',{...identity,eventId:event.id},auth)).status,401,'keine Führungsübersicht');
 assert.equal((await browser('evidence',identity,auth)).status,401,'keine Nachweise');
 assert.equal((await browser('browser/start',identity,auth)).status,401,'keine weiteren Codes');
 const first=await browser('reply',{...identity,eventId:event.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()},auth);
 assert.equal(first.status,200);assert.equal(first.value.version,1);assert.ok(first.value.updatedAt>0);
 let current=(await browser('list',identity,auth)).value.events[0];
 assert.equal(current.status,'yes');assert.equal(current.updatedAt,first.value.updatedAt);
 const second=await browser('reply',{...identity,eventId:event.id,status:'excused',expectedVersion:1,requestId:webcrypto.randomUUID()},auth);
 assert.equal(second.status,200);assert.equal(second.value.version,2);
 current=(await browser('list',identity,auth)).value.events[0];
 assert.equal(current.status,'excused');assert.equal(current.version,2);
 assert.equal((await f.call('overview',{eventId:event.id})).value.members.find(m=>m.name==='Testperson 1').status,'excused');
 assert.equal((await f.call('browser/revoke')).status,200);
 assert.equal((await browser('list',identity,auth)).status,401,'Browserzugang nach Sperre ungültig');
});
test('WhatsApp/Safari: Verbindungscode läuft ab, falsche Codes werden verworfen',async()=>{
 const f=await fixture();
 const code=(await f.call('browser/start')).value;
 f.clock.now+=5*60*1000+1000;
 async function redeem(value){
  const response=await f.c.worker.fetch(new Request('https://test.example/portal/browser/redeem',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io','Content-Type':'application/json'},body:JSON.stringify({code:value})}),f.env);
  return response.status;
 }
 assert.equal(await redeem(code.code),401);
 assert.equal(await redeem('garbage'),400);
});
