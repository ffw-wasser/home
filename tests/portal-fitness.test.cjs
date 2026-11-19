const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/portal-fixture.cjs');
const {calendar,event}=require('./helpers/portal-fixture.cjs');
const ics=stamp=>new Date(stamp).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const raw=(start,fitness=true)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-event\r\nDTSTART:${ics(start)}\r\nDTEND:${ics(start+3600000)}\r\nSUMMARY:${fitness?'Fitness':'Probe'}\r\nDESCRIPTION:Terminart: ${fitness?'Fitness':'Probe'}\\nGruppe: ${fitness?'Fitness':'Alle aktiven Mitglieder'}\\nFreigabe: Ja\r\nEND:VEVENT\r\nEND:VCALENDAR`;
async function setup(){
 const f=await fixture();
 const roster=f.people.map((p,i)=>({id:p.memberId,name:'Synthetisch '+i,leader:i===0,fitnessTrainer:i===1}));
 assert.equal((await f.call('roster',{members:roster},null,true)).status,200);
 const state=(await f.call('groups',{},null,true)).value;const group=state.groups.find(g=>g.id==='fitness');group.memberIds=f.people.slice(1).map(p=>p.memberId);group.trainerIds=[f.people[1].memberId];
 assert.equal((await f.call('groups',{groups:state.groups,expectedVersion:state.version},null,true)).status,200);
 f.raw(raw(f.start));f.clock.now+=310000;
 const cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 assert.equal((await f.call('classify',{eventId:e.id,kind:'probe',approved:true,sessionType:'Fitness',attendanceType:'Fitness',recipientMode:'groups',groupIds:['fitness'],includeIds:[],excludeIds:[],expectedGroupsVersion:cal.groupsVersion,expectedVersion:cal.rulesVersion},null,true)).status,200);
 return {...f,event:e,roster};
}
test('Fitnessrolle: eigene Termine/Rückmeldungen/Erinnerungen, keine Feuerwehr- oder Verwaltungsrechte',async()=>{
 const f=await setup(),trainer=f.people[1];
 const list=await f.call('list',{},trainer);assert.equal(list.status,200);assert.equal(list.value.fitnessTrainer,true);assert.equal(list.value.leader,false);assert.equal(list.value.events[0].canManage,true);assert.equal(list.value.events[0].attendanceType,'Fitness');
 assert.equal((await f.call('overview',{eventId:f.event.id},trainer)).status,200);
 assert.equal((await f.call('remind',{eventId:f.event.id,requestId:'fitness-remind-1'},trainer)).status,200);
 for(const path of ['gf-breathing','evidence','evidence/report','regulations','regulations/pdf','contacts','hydrants/list','checkin-code','fitness-statistics','groups'])assert.equal((await f.call(path,{},trainer)).status,403,path);
 assert.equal((await f.call('fitness-statistics',{year:new Date(f.start).getUTCFullYear()},trainer)).status,403);
 assert.notEqual((await f.call('overview',{eventId:f.event.id},f.people[2])).status,200);
 const year=(await f.call('year',{year:new Date(f.start).getUTCFullYear()},trainer)).value;assert.equal(year.events.length,1);assert.equal(year.events[0].attendanceType,'Fitness');
 const subscription=await f.c.PortalService.personalCalendar(f.env,trainer);assert.equal(subscription.events.length,1);
});
test('Fitness-Mindestteilnahme zählt eindeutige, berechtigte Zusagen bis zum Beginn',async()=>{
 const f=await setup(),[leader,trainer,...members]=f.people,eventId=f.event.id,job={eventId};
 const answer=(person,status,expectedVersion=0)=>f.call('reply',{eventId,status,expectedVersion,requestId:crypto.randomUUID()},person);
 const participation=async person=>(await f.call('list',{},person)).value.events[0].participation;
 assert.deepEqual(await participation(trainer),{required:5,confirmed:0,state:'pending'});
 assert.equal((await answer(leader,'yes')).status,404);
 for(const person of [trainer,...members])assert.equal((await answer(person,'yes')).status,200);
 assert.deepEqual(await participation(trainer),{required:5,confirmed:4,state:'pending'});
 const cal=(await f.call('list',{},null,true)).value;
 assert.equal((await f.call('classify',{eventId,kind:'probe',approved:true,attendanceType:'Fitness',recipientMode:'groups',groupIds:['fitness'],includeIds:[leader.memberId],excludeIds:[],expectedGroupsVersion:cal.groupsVersion,expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.deepEqual((await answer(leader,'yes')).value.participation,{required:5,confirmed:5,state:'ready'});
 assert.deepEqual((await f.call('overview',job,leader)).value.event.participation,{required:5,confirmed:5,state:'ready'});
 for(const [version,status] of [[1,'maybe'],[2,'excused'],[3,'open']]){
  assert.deepEqual((await answer(leader,status,version)).value.participation,{required:5,confirmed:4,state:'pending'});
 }
 f.clock.now=f.start;await f.c.PortalService.scheduled(f.env);
 const event=(await f.call('list',{},trainer)).value.events[0];
 assert.deepEqual(event.participation,{required:5,confirmed:4,state:'cancelled'});
 assert.equal(event.canReply,false);
 assert.equal((await answer(leader,'yes',4)).status,409);
 assert.equal(f.c.CalendarPresentation.widgetEvents([event],f.start).length,0);
});
test('Fitness-Mindestteilnahme kann im Kalender geändert werden und gilt nur für Fitness',async()=>{
 const f=await setup(),person=f.people[2],eventId=f.event.id;
 f.raw(raw(f.start).replace('Freigabe: Ja','Freigabe: Ja\\nMindestteilnahme: 1'));
 f.clock.now+=310000;await f.c.PortalService.scheduled(f.env);
 const reply=await f.call('reply',{eventId,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()},person);
 assert.deepEqual(reply.value.participation,{required:1,confirmed:1,state:'ready'});
 f.clock.now=f.start;await f.c.PortalService.scheduled(f.env);
 assert.deepEqual((await f.call('list',{},person)).value.events[0].participation,{required:1,confirmed:1,state:'confirmed'});
 const standard=await fixture();
 assert.equal((await standard.call('list')).value.events[0].participation,undefined);
});
test('Alte Fitness-Freigaben gruppieren Zusagen auch für Gruppenführer nur nach Antwortstatus',async()=>{
 const f=await setup(),job={eventId:f.event.id},leader=f.people[0];
 const roster=f.roster.map((m,i)=>({...m,replyRoles:i===2?['Maschinist']:[]}));
 assert.equal((await f.call('roster',{members:roster,replyFunctionsVersion:1},null,true)).status,200);
 f.raw(raw(f.start,false));f.clock.now+=310000;
 const saved=f.sql.prepare('SELECT payload FROM portal_rules WHERE id=1').get();
 const rules=await f.L.open(f.env,saved.payload,'portal-rules');delete rules[f.event.id].attendanceType;
 rules[f.event.id].includeIds=[leader.memberId];
 f.sql.prepare('UPDATE portal_rules SET payload=?').run(await f.L.seal(f.env,rules,'portal-rules'));
 assert.equal((await f.call('reply',{...job,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()},f.people[2])).status,200);
 const overview=await f.call('overview',job,leader);
 assert.equal(overview.status,200);assert.equal(overview.value.event.sessionType,'Fitness');
 assert.equal(overview.value.functionsVersion,0);
 assert.ok(overview.value.members.some(member=>member.name==='Synthetisch 2'&&member.status==='yes'));
 assert.ok(overview.value.members.every(member=>member.functions===undefined));
});
test('Fitnessrolle: Entzug, deaktivierte Gruppe, Fremdempfänger und Feuerwehrtermine bleiben serverseitig gesperrt',async()=>{
 const f=await setup(),trainer=f.people[1],cal=(await f.call('list',{},null,true)).value;
 // An extra recipient removes trainer authority. The guest keeps their own reply.
 assert.equal((await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,attendanceType:'Fitness',recipientMode:'groups',groupIds:['fitness'],includeIds:[f.people[0].memberId],excludeIds:[],expectedGroupsVersion:cal.groupsVersion,expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.equal((await f.call('list',{},trainer)).value.events[0].canManage,false);assert.equal((await f.call('overview',{eventId:f.event.id},trainer)).status,403);
 const groups=(await f.call('groups',{},null,true)).value;groups.groups.find(g=>g.id==='fitness').enabled=false;
 assert.equal((await f.call('groups',{groups:groups.groups,expectedVersion:groups.version},null,true)).status,200);
 assert.equal((await f.call('remind',{eventId:f.event.id,requestId:'fitness-remind-2'},trainer)).status,404);
 assert.equal((await f.c.PortalService.personalCalendar(f.env,trainer)).events.length,0);
 // Same account with accidental GF flag still has only the fitness scope.
 f.roster[1].leader=true;await f.call('roster',{members:f.roster},null,true);assert.equal((await f.call('gf-breathing',{},trainer)).status,403);
});
test('Gast ohne Fitness-Zuordnung bleibt Gast und erhält keine Trainerrechte',async()=>{
 const f=await setup(),guest=f.people[1],state=(await f.call('groups',{},null,true)).value;
 state.groups.find(g=>g.id==='fitness').trainerIds=[];
 assert.equal((await f.call('groups',{groups:state.groups,expectedVersion:state.version},null,true)).status,200);
 const list=await f.call('list',{},guest);
 assert.equal(list.status,200);
 assert.equal(list.value.fitnessTrainer,true);
 assert.equal(list.value.leader,false);
 assert.equal(list.value.events.length,1);
 assert.equal(list.value.events[0].canReply,true);
 assert.equal(list.value.events[0].canManage,false);
 assert.equal((await f.call('overview',{eventId:f.event.id},guest)).status,403);
 assert.equal((await f.call('remind',{eventId:f.event.id,requestId:'guest-no-trainer'},guest)).status,403);
 assert.equal((await f.call('gf-breathing',{},guest)).status,403);
 assert.equal((await f.c.PortalService.personalCalendar(f.env,guest)).events.length,1);
});

test('Gaststart enthält keine vorhandenen Getränkedaten. Rollenwechsel erhält Zuordnung und Kontodaten.',async()=>{
 const f=await setup(),person=f.people[1],token='g'.repeat(43);
 const digest=require('node:crypto').createHash('sha256').update('portal-session:'+token).digest('base64url');
 f.sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(digest,person.alias,person.revision,'fixture-'+person.alias,f.clock.now,f.clock.now+3600000);
 const request=async(path,data={})=>{
  const r=await f.c.worker.fetch(new Request('https://test.account.workers.dev'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({alias:person.alias,revision:person.revision,...data})}),f.env);
  return {status:r.status,value:await r.json()};
 };
 const account=f.c.DrinksModel.append(f.c.DrinksModel.empty(person.memberId),{id:'historic-drink',type:'drinks',cents:f.c.DrinksModel.PRICE,count:1,createdAt:new Date(f.clock.now).toISOString()});
 const payload=await f.L.seal(f.env,account,'ledger:'+person.memberId);
 f.sql.prepare('INSERT INTO ledgers(member,payload,version) VALUES(?,?,1)').run(person.memberId,payload);
 const guest=await request('/central/snapshot');
 assert.equal(guest.status,200);
 const projection=await f.c.DeckelCrypto.open(guest.value.envelope,person);
 assert.equal(projection.balance,0);
 assert.equal(projection.bookings.length,0);
 const command={id:'00000000-0000-4000-8000-000000000001'};
 assert.equal((await request('/commands/status',command)).status,403);
 assert.equal((await request('/commands/submit',command)).status,403);
 assert.equal((await request('/challenge/status')).status,403);

 const roster=f.roster.map(member=>member.id===person.memberId?{...member,fitnessTrainer:false}:member);
 assert.equal((await f.call('roster',{members:roster},null,true)).status,200);
 assert.deepEqual((await f.call('groups',{},null,true)).value.groups.find(g=>g.id==='fitness').trainerIds,[person.memberId]);
 assert.equal((await f.call('overview',{eventId:f.event.id},person)).status,200);
 const restored=await request('/central/snapshot');
 assert.equal((await f.c.DeckelCrypto.open(restored.value.envelope,person)).balance,f.c.DrinksModel.PRICE);
 assert.equal(f.sql.prepare('SELECT payload FROM ledgers WHERE member=?').get(person.memberId).payload,payload);
});

test('Fitnessgruppe vergibt Trainerrechte unabhängig von Gast an normales Mitglied',async()=>{
 const f=await setup(),member=f.people[2],former=f.people[1],state=(await f.call('groups',{},null,true)).value;
 const group=state.groups.find(g=>g.id==='fitness');
 group.trainerIds=[member.memberId];
 assert.equal((await f.call('groups',{groups:state.groups,expectedVersion:state.version},null,true)).status,200);
 const list=await f.call('list',{},member);
 assert.equal(list.status,200);
 assert.equal(list.value.fitnessTrainer,false);
 assert.equal(list.value.leader,false);
 assert.equal(list.value.events.find(e=>e.id===f.event.id).canManage,true);
 assert.equal((await f.call('overview',{eventId:f.event.id},member)).status,200);
 assert.equal((await f.call('remind',{eventId:f.event.id,requestId:'normal-trainer-1'},member)).status,200);
 assert.equal((await f.call('list',{},former)).value.events[0].canManage,false);
 const subscription=await f.c.PortalService.personalCalendar(f.env,member);
 assert.ok(subscription.events.some(e=>e.id===f.event.id));
 const updated=(await f.call('groups',{},null,true)).value;
 updated.groups.find(g=>g.id==='fitness').trainerIds=[];
 assert.equal((await f.call('groups',{groups:updated.groups,expectedVersion:updated.version},null,true)).status,200);
 assert.equal((await f.call('list',{},member)).value.events.find(e=>e.id===f.event.id).canManage,false);
 assert.equal((await f.call('overview',{eventId:f.event.id},member)).status,403);
});

test('Fitnessstatistik: Rückmeldungen getrennt, ausgeschlossene Personen, Monatsfilter und dauerhafte namenlose Summen',async()=>{
 const f=await setup(),year=Number(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date(f.start)));
 for(const [index,status] of [[2,'yes'],[3,'excused'],[4,'maybe']])assert.equal((await f.call('reply',{eventId:f.event.id,status,requestId:'fitness-answer-'+index,expectedVersion:0},f.people[index])).status,200);
 let result=await f.call('fitness-statistics',{year},null,true);assert.equal(result.status,200);assert.deepEqual([result.value.totals.offered,result.value.totals.yes,result.value.totals.excused,result.value.totals.maybe,result.value.totals.open],[1,1,1,1,1]);assert.equal(result.value.totals.quoteSum,.25);
 // 'Betrifft nicht' is an exclusion on the calendar audience, not a missing answer.
 const cal=(await f.call('list',{},null,true)).value;
 assert.equal((await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,attendanceType:'Fitness',recipientMode:'groups',groupIds:['fitness'],includeIds:[],excludeIds:[f.people[1].memberId],expectedGroupsVersion:cal.groupsVersion,expectedVersion:cal.rulesVersion},null,true)).status,200);
 result=await f.call('fitness-statistics',{year},null,true);assert.equal(result.value.totals.eligible,3);assert.equal(result.value.totals.open,0);assert.equal(result.value.totals.quoteSum,1/3);
 f.clock.now=f.start+8*3600000;await f.c.PortalService.scheduled(f.env);
 const saved=f.sql.prepare('SELECT * FROM portal_fitness_history').all();assert.equal(saved.length,1);assert.ok(!saved[0].payload.includes('Synthetisch'));const summary=await f.L.open(f.env,saved[0].payload,'fitness-summary:'+f.event.id);assert.deepEqual(Object.keys(summary).sort(),['eligible','excused','maybe','open','yes']);
 f.sql.prepare('DELETE FROM portal_replies').run();result=await f.call('fitness-statistics',{year},null,true);assert.equal(result.value.totals.yes,1);assert.equal(result.value.totals.eligible,3);assert.equal(result.value.months.reduce((n,m)=>n+m.yes,0),1);
 assert.equal((await f.call('fitness-statistics',{year:year-1},null,true)).value.totals.offered,0);
});
test('Fitnessstatistik: abgesagte Termine zählen nicht, leere Fitnessgruppe wird nie zur Feuerwehrgruppe',async()=>{
 const f=await setup(),year=new Date(f.start).getUTCFullYear();
 const cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:f.event.id,kind:'probe',approved:false,attendanceType:'Fitness',recipientMode:'groups',groupIds:['fitness'],includeIds:[],excludeIds:[],expectedGroupsVersion:cal.groupsVersion,expectedVersion:cal.rulesVersion},null,true);
 assert.equal((await f.call('fitness-statistics',{year},null,true)).value.totals.offered,0);
 const groups=(await f.call('groups',{},null,true)).value;groups.groups.find(g=>g.id==='fitness').memberIds=[];await f.call('groups',{groups:groups.groups,expectedVersion:groups.version},null,true);
 const resolved=f.c.PortalGroups.resolve('Fitness',groups.groups,{members:f.roster});assert.deepEqual(Array.from(resolved.recipientIds),[]);
 assert.ok(!Array.from(f.c.PortalGroups.resolve('Probe',groups.groups,{members:f.roster}).recipientIds).includes(f.people[1].memberId));
});

test('Veranstaltung bleibt eigene Terminart ohne Trainerrechte und ohne Fitnessstatistik',async()=>{const f=await fixture();f.raw('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-veranstaltung\r\nDTSTART:20261201T180000Z\r\nDTEND:20261201T200000Z\r\nSUMMARY:Veranstaltung: Testabend\r\nDESCRIPTION:Terminart: Veranstaltung\\nGruppe: Veranstaltung\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');f.clock.now+=960001;await f.call('list');const cal=await f.call('list',{},null,true);const event=cal.value.events.find(e=>e.title.includes('Testabend'));assert.equal(event.attendanceType,'Veranstaltung');assert.equal(event.sessionType,'Veranstaltung');assert.equal(event.recipientIds.length,0);const groups=await f.call('groups',{},null,true);assert.ok(groups.value.groups.some(g=>g.id==='events'&&!g.trainerIds?.length));const eventGroup=groups.value.groups.find(g=>g.id==='events');eventGroup.memberIds=[f.people[0].memberId];assert.equal((await f.call('groups',{groups:groups.value.groups,expectedVersion:groups.value.version},null,true)).status,200);const stats=await f.call('event-statistics',{year:2026},null,true);assert.equal(stats.status,200);assert.equal(stats.value.events.length,1);assert.equal((await f.call('fitness-statistics',{year:2026},null,true)).value.events.length,0);assert.equal((await f.call('event-statistics',{year:2026})).status,404);});
