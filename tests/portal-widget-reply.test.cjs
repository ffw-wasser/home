const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {fixture}=require('./helpers/portal-fixture.cjs');
async function setup(){
 const f=await fixture();const list=(await f.call('list',{widget:true})).value;
 const event=list.events[0],grant=list.widgetReply;
 assert.ok(grant?.token);assert.ok(grant.expiresAt<=f.clock.now+43200000);
 const job={eventId:event.id,status:'yes',expectedVersion:event.version,requestId:webcrypto.randomUUID()};
 async function call(path='widget-reply',data=job,token=grant.token){
  const response=await f.c.worker.fetch(new Request('https://test.example/portal/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)}),f.env);
  return {status:response.status,value:await response.json()};
 }
 return {...f,list,event,grant,job,widget:call};
}
test('Widget grant only exists on explicit authenticated native list; uses ordinary reply CAS and idempotency',async()=>{
 const f=await setup();assert.equal((await f.call('list')).value.widgetReply,undefined);
 const first=await f.widget();assert.equal(first.status,200);assert.equal(first.value.version,1);
 assert.deepEqual(await f.widget(),first);assert.equal((await f.call('list')).value.events[0].status,'yes');
 const change={...f.job,status:'maybe',expectedVersion:1,requestId:webcrypto.randomUUID()};
 assert.equal((await f.widget('widget-reply',change)).value.version,2);
 assert.equal((await f.call('list')).value.events[0].status,'maybe');
 assert.equal((await f.call('reply',{...f.job,status:'excused',expectedVersion:2,requestId:webcrypto.randomUUID()})).value.version,3);
 assert.equal((await f.widget('widget-reply',{...change,requestId:webcrypto.randomUUID()})).status,409);
});
test('Widget grant cannot authenticate unrelated APIs, another event or a modified envelope',async()=>{
 const f=await setup();for(const path of ['list','evidence','overview','remind','reply'])assert.notEqual((await f.widget(path,{...f.job,alias:f.people[0].alias,revision:f.people[0].revision})).status,200,path);
 assert.equal((await f.widget('widget-reply',{...f.job,eventId:'x'.repeat(43)})).status,401);
 assert.equal((await f.widget('widget-reply',f.job,'x'+f.grant.token.slice(1))).status,401);
 assert.ok(!f.grant.token.includes(f.people[0].memberId));
 const envelope=await f.L.open(f.env,Buffer.from(f.grant.token,'base64url').toString(),'portal-widget-reply-v1');
 assert.equal(envelope.events.length,1);assert.equal(envelope.session.length,43);assert.equal(envelope.alias,undefined);
});
for(const revoke of ['logout','account','credential','expiry'])test('Widget reply rejects live revocation: '+revoke,async()=>{
 const f=await setup();
 if(revoke==='logout')f.sql.prepare('DELETE FROM portal_identity_sessions').run();
 if(revoke==='account')f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('changed-revision',f.people[0].alias);
 if(revoke==='credential')f.sql.prepare('DELETE FROM portal_passkeys').run();
 if(revoke==='expiry')f.clock.now=f.grant.expiresAt;
 assert.equal((await f.widget()).status,401);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,0);
});
test('Widget reply enforces cancellation, calendar freshness and start boundary',async()=>{
 const f=await setup();f.offline(true);f.clock.now+=901000;await f.c.PortalService.scheduled(f.env);
 assert.equal((await f.widget()).status,503);f.offline(false);f.clock.now=f.event.start;
 assert.equal((await f.widget()).status,401,'12-hour grant expired before next-day event');
});
test('Widget reply cannot override own recipient restrictions after issuance',async()=>{
 const f=await setup();const roster=(await f.call('list',{},null,true)).value;
 // Remove caller from the live roster; session, account and scoped grant are revoked together.
 assert.equal((await f.call('roster',{members:f.people.slice(1).map(p=>({id:p.memberId,name:'Synthetic',leader:false}))},null,true)).status,200);
 assert.equal((await f.widget()).status,401);
});

test('Widget start boundary uses the same closed-response rule while grant is still fresh',async()=>{
 const f=await setup();f.clock.now=f.event.start-60000;
 const grant=(await f.call('list',{widget:true})).value.widgetReply;assert.ok(grant);
 f.clock.now=f.event.start;
 assert.equal((await f.widget('widget-reply',f.job,grant.token)).status,409);
});
test('Widget cannot select another member with forged alias fields',async()=>{
 const f=await setup();const other=f.people[1];
 assert.equal((await f.widget('widget-reply',{...f.job,alias:other.alias,revision:other.revision})).status,200);
 assert.equal((await f.call('list',{},other)).value.events[0].status,'open');
 assert.equal((await f.call('list')).value.events[0].status,'yes');
});

test('Widget version conflicts return only the current own answer without writing or renewing the grant',async()=>{
 const f=await setup();
 const accepted=await f.call('reply',{...f.job,status:'excused',requestId:webcrypto.randomUUID()});assert.equal(accepted.status,200);
 const conflict=await f.widget();assert.equal(conflict.status,409);
 assert.deepEqual(conflict.value.currentReply,{status:'excused',version:1});
 assert.deepEqual(Object.keys(conflict.value).sort(),['currentReply','error']);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,1);
 assert.equal((await f.call('list')).value.events[0].status,'excused');
 const ordinary=await f.call('reply',{...f.job,requestId:webcrypto.randomUUID()});
 assert.equal(ordinary.status,409);assert.equal(ordinary.value.currentReply,undefined);
 const chosen={...f.job,expectedVersion:conflict.value.currentReply.version,requestId:webcrypto.randomUUID()};
 const saved=await f.widget('widget-reply',chosen);assert.equal(saved.status,200);assert.equal(saved.value.version,2);
 assert.equal((await f.call('list')).value.events[0].status,'yes');
 f.clock.now=f.grant.expiresAt;const expired=await f.widget('widget-reply',chosen);
 assert.equal(expired.status,401);assert.equal(expired.value.currentReply,undefined);
});
test('Widget conflict state is not returned to revoked or unrelated grants',async()=>{
 const f=await setup();await f.call('reply',{...f.job,status:'maybe'});
 const unrelated=await f.widget('widget-reply',{...f.job,eventId:'x'.repeat(43)});
 assert.equal(unrelated.status,401);assert.equal(unrelated.value.currentReply,undefined);
 f.sql.prepare('DELETE FROM portal_identity_sessions').run();
 const revoked=await f.widget();assert.equal(revoked.status,401);assert.equal(revoked.value.currentReply,undefined);
});

for (const viaWidget of [false, true]) test('Saving '+(viaWidget?'widget':'portal')+' reply does not fetch or wait for optional Google colours',async()=>{
 const f=await setup(),endpoint='https://script.google.com/macros/s/test-bridge-id1234567890123456/exec';
 const row=f.sql.prepare('SELECT * FROM portal_config WHERE id=1').get(),config=await f.L.open(f.env,row.payload,'portal-config');
 config.googleColorBridge={endpoint,secret:'synthetic-colour-secret-'.padEnd(64,'x')};
 f.sql.prepare('UPDATE portal_config SET payload=?').run(await f.L.seal(f.env,config,'portal-config'));
 let release,started,colourCalls=0;
 const blocked=new Promise(resolve=>{release=resolve;}),colourStarted=new Promise(resolve=>{started=resolve;}),prior=f.c.fetch;
 f.c.fetch=(url,options)=>{
  if(url!==endpoint)return prior(url,options);
  colourCalls++;started();return blocked;
 };
 const calendarFetches=f.calendarFetches();
 const pending=viaWidget?f.widget():f.call('reply',f.job);
 try{
  const result=await Promise.race([pending,colourStarted.then(()=>({blocked:true}))]);
  assert.equal(result.blocked,undefined,'optional colour service must not enter the save path');
  assert.equal(result.status,200);assert.equal(result.value.status,'yes');assert.equal(result.value.version,1);
  assert.equal(colourCalls,0);assert.equal(f.calendarFetches(),calendarFetches);
  assert.equal(f.sql.prepare('SELECT version FROM portal_replies WHERE event=? AND member=?').get(f.event.id,f.people[0].memberId).version,1);
 }finally{release(new Response(null,{status:503}));await pending;}
});
test('Widget reminder status reads only granted events, returns current reply/reminder flags and never writes an answer',async()=>{
 const f=await setup();f.sql.prepare('INSERT INTO portal_event_reminders(event,reminded_at) VALUES(?,?)').run(f.event.id,f.clock.now);
 const before=f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n;
 let response=await f.widget('widget-status',{eventId:f.event.id});assert.equal(response.status,200);assert.deepEqual(response.value,{ok:true,status:'open',version:0,reminded:true,canReply:true});
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_replies').get().n,before);
 assert.equal((await f.widget('widget-status',{eventId:'z'.repeat(43)})).status,401);
 assert.equal((await f.widget()).status,200);
 response=await f.widget('widget-status',{eventId:f.event.id});assert.equal(response.value.status,'yes');assert.equal(response.value.version,1);
 const state=(await f.call('groups',{},null,true)).value;await f.call('groups',{groups:state.groups,observerIds:[f.people[0].memberId],expectedVersion:state.version},null,true);
 const cal=(await f.call('list',{},null,true)).value;await f.call('classify',{eventId:f.event.id,kind:'probe',approved:true,recipientIds:[f.people[1].memberId],expectedVersion:cal.rulesVersion},null,true);
 response=await f.widget('widget-status',{eventId:f.event.id});assert.equal(response.value.canReply,false);assert.equal(response.value.reminded,false);assert.equal(response.value.status,'open');
 f.clock.now=f.grant.expiresAt+1;assert.equal((await f.widget('widget-status',{eventId:f.event.id})).status,401);
});
