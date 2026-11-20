const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,calendar,event}=require('./helpers/portal-fixture.cjs');

async function setup(type,memberCount=5){
 const f=await fixture({memberCount});
 const members=f.people.map((person,i)=>({
  id:person.memberId,name:'Testperson '+(i+1),leader:i===0||i===2,
  fitnessTrainer:i===memberCount-1,replyRoles:i===0||i===3?['Maschinist']:[],
  staffingProfile:{
   roles:i===1?['ATF']:i===4?['STF']:i===5?['STM']:i===6?['Melder']:[],
   vehicles:i===0||i===3?['LF']:[],year:new Date(f.start).getFullYear(),actuals:{},targets:{}
  },agt:i===1
 }));
 assert.equal((await f.call('roster',{members,replyFunctionsVersion:1},null,true)).status,200);
 f.sql.prepare('DELETE FROM portal_rules').run();
 f.raw(calendar([event(f.start,type,'DESCRIPTION:Terminart: '+type)]));
 f.clock.now+=310000;
 const get=async()=> (await f.call('list',{force:true},null,true)).value;
 const classify=async options=>{
  const cal=await get();
  return f.call('classify',{
   eventId:cal.events[0].id,kind:'probe',approved:true,recipientMode:'automatic',
   expectedVersion:cal.rulesVersion,expectedGroupsVersion:cal.groupsVersion,...options
  },null,true);
 };
 const eventId=(await get()).events[0].id;
 const list=async person=>(await f.call('list',{},person)).value.events[0];
 const answer=(person,status='yes',expectedVersion=0)=>f.call('reply',{eventId,status,expectedVersion,requestId:crypto.randomUUID()},person);
 return {...f,members,eventId,get,classify,list,answer};
}

test('Einzeltermin schließt Gäste aus und zählt eine Zusage je besetzter Funktion',async()=>{
 const f=await setup('Veranstaltung'),[leader,agt,organizer,machinist,guest]=f.people;
 const options={recipientMode:'individual',recipientIds:[leader.memberId,agt.memberId,machinist.memberId],staffingRequirements:{minimum:3,roles:{GF:1,Maschinist:1,AGT:1}},organizerId:organizer.memberId};
 assert.equal((await f.classify({...options,recipientIds:[guest.memberId]})).status,400);
 assert.equal((await f.classify({...options,organizerId:agt.memberId})).status,400);
 assert.equal((await f.classify({...options,staffingRequirements:{minimum:3,roles:{unknown:1}}})).status,400);
 assert.equal((await f.classify(options)).status,200);
 assert.equal((await f.get()).events[0].groupIds.length,0);
 assert.equal(await f.list(guest),undefined);
 const organiserEvent=await f.list(organizer);
 assert.equal(organiserEvent.organizes,true);
 assert.equal(organiserEvent.canManage,true);
 assert.equal(organiserEvent.canReply,false);
 const overview=await f.call('overview',{eventId:f.eventId},organizer);
 assert.deepEqual(overview.value.members.map(m=>m.name),['Testperson 1','Testperson 2','Testperson 4']);
 assert.equal((await f.call('overview',{eventId:f.eventId},agt)).status,403);
 assert.equal((await f.answer(guest)).status,404);
 const first=(await f.answer(leader)).value.participation;
 assert.deepEqual(first.minimum.missing,[{role:'Maschinist',count:1},{role:'AGT',count:1}]);
 await f.answer(agt);
 const ready=(await f.answer(machinist)).value.participation;
 assert.equal(ready.state,'ready');
 const regularEvent=await f.list(agt);
 assert.equal(regularEvent.organizerId,undefined);
 assert.equal(regularEvent.recipientIds,undefined);
 assert.equal(regularEvent.staffingRequirements,undefined);
 assert.deepEqual(regularEvent.participation,ready);
 assert.equal(regularEvent.staffingProposal,undefined);
 assert.equal((await f.answer(machinist,'maybe',1)).value.participation.state,'pending');
 assert.equal((await f.classify({...options,organizerId:leader.memberId})).status,200);
 const changed=await f.list(agt);
 assert.equal(changed.participation.confirmed,1);
 assert.equal(changed.participation.minimum.missing.some(m=>m.role==='GF'),true);
 f.clock.now=f.start;
 assert.equal((await f.list(agt)).participation.state,'pending','keine automatische Absage');
});

test('Allgemeine Probe prüft Staffel und Gruppe, Organisator bleibt bei der Besetzung außen vor',async()=>{
 const f=await setup('Allgemeine Probe',9);
 const [organizer,firstTF,leader,machinist,secondTF,thirdTF,melder,other,guest]=f.people;
 assert.equal((await f.classify({organizerId:organizer.memberId})).status,200);
 assert.equal((await f.get()).events[0].tacticalStaffing,true);
 assert.equal((await f.answer(organizer)).value.participation.confirmed,0);
 for(const person of [firstTF,leader,machinist,secondTF,thirdTF])assert.equal((await f.answer(person)).status,200);
 const staff=(await f.answer(melder)).value.participation;
 assert.equal(staff.minimum.ready,true);
 assert.equal(staff.goal.ready,false);
 assert.equal(staff.goal.shortfall,3);
 assert.match(f.c.CalendarPresentation.participationText(staff),/Staffel möglich.*3 Zusagen/);
 const planned=(await f.call('overview',{eventId:f.eventId},organizer)).value.staffingProposal;
 assert.equal(planned.unit,'Staffel');
 assert.equal(planned.assignments.some(position=>position.name==='Testperson 1'),false);
 assert.deepEqual(planned.assignments.find(position=>position.role==='Maschinist'),{role:'Maschinist',name:'Testperson 4'});
 assert.equal((await f.answer(guest)).status,404);
 assert.equal((await f.answer(other)).status,200);
 f.members.at(-1).fitnessTrainer=false;
 assert.equal((await f.call('roster',{members:f.members,replyFunctionsVersion:1},null,true)).status,200);
 await f.answer(guest);
 const eight=(await f.list(leader)).participation;
 assert.equal(eight.confirmed,8);
 assert.equal(eight.goal.shortfall,1);
 assert.equal((await f.classify({organizerId:null})).status,200);
 assert.equal((await f.list(leader)).participation.goal.ready,true);
 const shortage=(await f.answer(melder,'excused',1)).value.participation;
 assert.equal(shortage.minimum.ready,true);
 assert.deepEqual(shortage.goal.missing,[{role:'Melder',count:1}]);
 assert.match(f.c.CalendarPresentation.participationText(shortage),/Melder/);
});

test('Mehrfachqualifikation und Jahresziel folgen der Auswahl aus der Probe-Erfassung',async()=>{
 const f=await setup('Veranstaltung'),[leader,agt,otherLeader,machinist]=f.people;
 const currentYear=new Date(f.start).getFullYear();
 f.members[0].staffingProfile={roles:['GF'],vehicles:['LF'],year:currentYear,actuals:{GF:4},targets:{GF:6}};
 f.members[2].staffingProfile={roles:['GF'],vehicles:[],year:currentYear,actuals:{GF:1},targets:{GF:6}};
 assert.equal((await f.call('roster',{members:f.members,replyFunctionsVersion:1},null,true)).status,200);
 const options={recipientMode:'individual',recipientIds:[leader,agt,otherLeader,machinist].map(person=>person.memberId),staffingRequirements:{minimum:2,roles:{GF:1,Maschinist:1}}};
 assert.equal((await f.classify(options)).status,200);
 for(const person of [leader,otherLeader,machinist])assert.equal((await f.answer(person)).status,200);
 const staffing=async()=> (await f.call('overview',{eventId:f.eventId},leader)).value.staffingProposal.assignments;
 assert.equal((await staffing()).find(position=>position.role==='GF').name,'Testperson 3');
 assert.equal((await f.answer(otherLeader,'excused',1)).status,200);
 assert.equal((await staffing()).find(position=>position.role==='GF').name,'Testperson 1');
 assert.equal((await staffing()).find(position=>position.role==='Maschinist').name,'Testperson 4');
});
