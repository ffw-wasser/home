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
test('Fitnessrolle: Entzug, deaktivierte Gruppe, Fremdempfänger und Feuerwehrtermine bleiben serverseitig gesperrt',async()=>{
 const f=await setup(),trainer=f.people[1],cal=(await f.call('list',{},null,true)).value;
 // Explicit extra recipient outside this group must not be visible to the trainer.
 assert.equal((await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,attendanceType:'Fitness',recipientMode:'groups',groupIds:['fitness'],includeIds:[f.people[0].memberId],excludeIds:[],expectedGroupsVersion:cal.groupsVersion,expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.equal((await f.call('list',{},trainer)).value.events.length,0);assert.equal((await f.call('overview',{eventId:f.event.id},trainer)).status,404);
 const groups=(await f.call('groups',{},null,true)).value;groups.groups.find(g=>g.id==='fitness').enabled=false;
 assert.equal((await f.call('groups',{groups:groups.groups,expectedVersion:groups.version},null,true)).status,200);
 assert.equal((await f.call('remind',{eventId:f.event.id,requestId:'fitness-remind-2'},trainer)).status,404);
 assert.equal((await f.c.PortalService.personalCalendar(f.env,trainer)).events.length,0);
 // Same account with accidental GF flag still has only the fitness scope.
 f.roster[1].leader=true;await f.call('roster',{members:f.roster},null,true);assert.equal((await f.call('gf-breathing',{},trainer)).status,403);
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
