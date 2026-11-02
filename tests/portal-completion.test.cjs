const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/portal-fixture.cjs');
const stamp=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
async function setup(){
 const f=await fixture(),first=(await f.call('list',{},null,true)).value.events[0],nextStart=f.start+86400000;
 f.raw('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+[[f.start,'test-event'],[nextStart,'next-event']].map(([start,id])=>'BEGIN:VEVENT\r\nUID:'+id+'\r\nDTSTART:'+stamp(start)+'\r\nDTEND:'+stamp(start+3600000)+'\r\nSUMMARY:Testprobe\r\nEND:VEVENT').join('\r\n')+'\r\nEND:VCALENDAR\r\n');
 f.clock.now=f.start+1200000;await f.c.PortalService.scheduled(f.env);
 const response=await f.call('list',{},null,true);assert.equal(response.status,200,JSON.stringify(response.value));let list=response.value,next=list.events.find(e=>e.id!==first.id);assert.ok(next,JSON.stringify(list));
 assert.equal((await f.call('classify',{eventId:next.id,kind:'probe',approved:true,expectedVersion:list.rulesVersion},null,true)).status,200);
 return {...f,first,next,job:{eventId:first.id,eventStart:first.start,sessionId:'synthetic-saved-report'}};
}
test('Confirmed completion advances the member list and widget to the next replyable event',async()=>{
 const f=await setup();assert.ok((await f.call('complete',f.job)).status>=400,'member cannot close an event');assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_display').get().n,0);
 const done=await f.call('complete',f.job,null,true);assert.equal(done.status,200,JSON.stringify(done.value));
 const list=(await f.call('list',{widget:true})).value;assert.deepEqual(list.events.map(e=>e.id),[f.next.id]);assert.equal(list.events[0].canReply,true);assert.ok(list.widgetReply.token);
 assert.equal((await f.call('reply',{eventId:f.next.id,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()})).status,200);
 assert.equal((await f.call('reply',{eventId:f.first.id,status:'yes',expectedVersion:0,requestId:crypto.randomUUID()})).status,404);
 const repeated=await f.call('complete',f.job,null,true);assert.equal(repeated.status,200);assert.equal(repeated.value.completedAt,done.value.completedAt);
 const admin=(await f.call('list',{},null,true)).value;assert.ok(admin.events.find(e=>e.id===f.first.id).completedAt,'calendar history remains available');
});
test('Completion preserves display edits and survives subsequent note edits',async()=>{
 const f=await setup();assert.equal((await f.call('display',{eventId:f.first.id,note:'Testnotiz',infoVisible:false,recipientIds:null,expectedVersion:0},null,true)).status,200);
 assert.equal((await f.call('complete',f.job,null,true)).status,200);
 let event=(await f.call('list',{},null,true)).value.events.find(e=>e.id===f.first.id);assert.equal(event.note,'Testnotiz');assert.ok(event.completedAt);
 assert.equal((await f.call('display',{eventId:f.first.id,note:'Neue Notiz',infoVisible:false,recipientIds:null,expectedVersion:event.displayVersion},null,true)).status,200);
 event=(await f.call('list',{},null,true)).value.events.find(e=>e.id===f.first.id);assert.equal(event.note,'Neue Notiz');assert.ok(event.completedAt);
});
test('Future, moved, stale and unrelated completions are rejected without hiding an event',async()=>{
 const f=await setup();assert.equal((await f.call('complete',{...f.job,eventId:f.next.id,eventStart:f.next.start},null,true)).status,400);
 assert.equal((await f.call('complete',{...f.job,eventStart:f.first.start+1},null,true)).status,409);
 assert.equal((await f.call('complete',{...f.job,eventId:'x'.repeat(43)},null,true)).status,404);
 assert.equal((await f.call('complete',{...f.job,source:'another-source'},null,true)).status,409);
 f.offline(true);f.clock.now+=301000;assert.equal((await f.call('complete',f.job,null,true)).status,503);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_display').get().n,0);
});
