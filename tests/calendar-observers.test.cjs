const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {fixture}=require('./helpers/portal-fixture.cjs');
async function setup(){
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 await f.call('classify',{eventId:e.id,kind:'probe',approved:true,recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true);
 const state=(await f.call('groups',{},null,true)).value;
 const save=await f.call('groups',{groups:state.groups,observerIds:[f.people[2].memberId],expectedVersion:state.version},null,true);assert.equal(save.status,200);
 return {...f,event:e};
}
test('Globale Beobachter sehen freigegebene Termine ohne Abstimmung und ohne Teilnehmerlisten oder Erinnerungsrechte',async()=>{
 const f=await setup(),observer=f.people[2],list=(await f.call('list',{widget:true,eventId:f.event.id},observer)).value,e=list.events[0];
 assert.equal(list.eventLinkStatus,null);assert.equal(e.observerOnly,true);assert.equal(e.canReply,false);assert.equal(e.status,'open');assert.equal(list.widgetReply,null);
 for(const key of ['observerIds','recipientIds','automaticRecipientIds','groupIds'])assert.equal(e[key],undefined,key);
 assert.equal((await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()},observer)).status,403);
 assert.equal((await f.call('overview',{eventId:e.id},observer)).status,403);
 assert.equal((await f.call('remind',{eventId:e.id,requestId:webcrypto.randomUUID()},observer)).status,403);
 assert.equal((await f.call('list',{},f.people[3])).value.events.length,0);
 const reply=await f.call('reply',{eventId:e.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()},f.people[1]);assert.equal(reply.status,200);
 const overview=(await f.call('replies',{eventId:e.id},null,true)).value;assert.deepEqual(overview.replies.map(r=>r.memberId),[f.people[1].memberId]);
});
test('Teilnahme hat Vorrang vor globalem Beobachten; Widerruf und Mitgliedsentzug gelten sofort',async()=>{
 const f=await setup(),observer=f.people[2],state=(await f.call('groups',{},null,true)).value;
 let cal=(await f.call('list',{},null,true)).value;
 await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,recipientIds:[observer.memberId],expectedVersion:cal.rulesVersion},null,true);
 let list=(await f.call('list',{widget:true},observer)).value;assert.equal(list.events[0].canReply,true);assert.equal(list.events[0].observerOnly,false);assert.ok(list.widgetReply?.token);
 const grant=list.widgetReply.token;
 cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true);
 const request=new Request('https://test.example/portal/widget-reply',{method:'POST',headers:{Authorization:'Bearer '+grant,'Content-Type':'application/json'},body:JSON.stringify({eventId:f.event.id,status:'yes',expectedVersion:0,requestId:webcrypto.randomUUID()})});assert.equal((await f.c.worker.fetch(request,f.env)).status,403);
 assert.equal((await f.call('list',{},observer)).value.events[0].canReply,false);
 assert.equal((await f.call('groups',{groups:state.groups,observerIds:[],expectedVersion:state.version},null,true)).status,200);
 assert.equal((await f.call('list',{},observer)).value.events.length,0);
});
test('Globales Beobachten gilt im persönlichen Kalender und Jahresplan als Information und ist nicht öffentlich',async()=>{
 const f=await setup(),observer=f.people[2],year=new Date(f.event.start).getUTCFullYear();
 const plan=(await f.call('year',{year},observer)).value.events;assert.equal(plan.length,1);assert.equal(plan[0].observerOnly,true);assert.equal(plan[0].canReply,false);assert.equal(plan[0].observerIds,undefined);
 const sub=(await f.call('calendar-subscription',{},observer)).value;
 const response=await f.c.worker.fetch(new Request(sub.subscriptionUrl),f.env);assert.equal(response.status,200);const text=await response.text();assert.match(text,/Nur zur Information/);assert.doesNotMatch(text,/H₂O-Rückmeldung|member-3|observerIds/);
 const publicResponse=await f.c.worker.fetch(new Request('https://test.example/calendar/public?year='+year),f.env);assert.doesNotMatch(JSON.stringify(await publicResponse.json()),/observerIds|member-3/);
});
test('Beobachter ändern keine Freigaben und bleiben bei älteren Gruppenänderungen erhalten',async()=>{
 const f=await setup(),observer=f.people[2],state=(await f.call('groups',{},null,true)).value;
 assert.equal((await f.call('groups',{groups:state.groups,expectedVersion:state.version},null,true)).status,200);
 assert.deepEqual((await f.call('groups',{},null,true)).value.observerIds,[observer.memberId]);
 const cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:f.event.id,kind:'probe',approved:false,recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true);
 assert.equal((await f.call('list',{},observer)).value.events.length,0);
 const current=(await f.call('groups',{},null,true)).value;
 for(const ids of [['unknown'],[observer.memberId,observer.memberId],null])assert.equal((await f.call('groups',{groups:current.groups,observerIds:ids,expectedVersion:current.version},null,true)).status,400);
 assert.equal((await f.call('groups',{groups:current.groups,observerIds:[],expectedVersion:current.version},observer)).status,404);
});

test('Widget zieht bei einer echten Überschneidung den Teilnehmertermin vor',()=>{
 require('../js/features/portal/calendar-presentation.js');
 const {widgetEvents}=globalThis.CalendarPresentation;
 const now=100,observer={id:'info',start:110,end:160,canReply:false},other={id:'info2',start:120,end:140,canReply:false};
 const boundary={id:'after',start:160,end:200,canReply:true},participant={id:'own',start:150,end:180,canReply:true};
 assert.deepEqual(widgetEvents([observer,other,{...other,start:130},participant,boundary],now).map(e=>e.id),['own','info','info2']);
 assert.deepEqual(widgetEvents([observer,boundary],now).map(e=>e.id),['info','after']);
 assert.equal(widgetEvents([observer,participant],180).length,0);
});
