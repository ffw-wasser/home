const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {fixture}=require('./helpers/portal-fixture.cjs');
const scope='https://www.googleapis.com/auth/calendar.events',token='SYNTHETIC_GOOGLE_TOKEN_1234567890',client='synthetic.apps.googleusercontent.com';
function setup({role='writer',aud=client,granted=scope,expires=300,precondition=false,attendees=false}={}){
 const requests=[],ctx={URL,URLSearchParams,Date,AbortSignal,fetch:async(url,options={})=>{requests.push({url,options});if(url.includes('tokeninfo'))return Response.json({aud,scope:granted,expires_in:expires});if(url.includes('maxResults=1'))return Response.json({accessRole:role});if(options.method&&precondition)return new Response('',{status:412});if(options.method==='DELETE')return new Response(null,{status:204});return Response.json({etag:'"v1"',attendees:attendees?[{email:'synthetic@example.invalid'}]:undefined,items:[]});}};
 vm.runInNewContext(fs.readFileSync('cloudflare/push/google-calendar-api.js','utf8'),ctx);
 const call=(action,data={},env={GOOGLE_CALENDAR_CLIENT_ID:client})=>ctx.GoogleCalendarAPI.route(action,{googleAccessToken:token,...data},env,{calendarUrl:'https://calendar.google.com/calendar/ical/test%40example.invalid/public/basic.ics'});
 return {api:ctx.GoogleCalendarAPI,call,requests};
}
const event={summary:'Synthetic exercise',description:'Synthetic data',location:'Test place',start:{dateTime:'2026-11-01T18:00:00+01:00'},end:{dateTime:'2026-11-01T20:00:00+01:00'}};
test('Google API: H2O admin authentication is required before any Google access',async()=>{
 const f=await fixture();assert.equal((await f.call('google-api/configuration',{},null,true)).value.configured,false);
 assert.equal((await f.call('google-api/configuration')).status,404);
 assert.equal((await f.call('google-api/status',{},null,true)).status,503);
 assert.equal(f.sends.some(x=>String(x.url).includes('googleapis.com')),false);
});
test('Google API: client audience, expiration, scope and calendar rights are independently checked',async()=>{
 for(const options of [{aud:'other'},{expires:0},{granted:'openid'},{role:'reader'},{role:'freeBusyReader'}]){
  const f=setup(options);await assert.rejects(f.call('create',{event,requestId:'a'.repeat(32)}));assert.equal(f.requests.some(r=>r.options.method==='POST'),false);
 }
 const f=setup();assert.equal((await f.call('status')).accessRole,'writer');assert.match(f.requests[1].url,/test%40example.invalid/);
 const read=setup({role:'reader',granted:'https://www.googleapis.com/auth/calendar.events.readonly'});assert.equal((await read.call('status')).accessRole,'reader');
});
test('Google API: allowlisted data, stable creation id, ETag updates, and no guest changes',async()=>{
 const f=setup();await f.call('create',{event,requestId:'a'.repeat(32)});const create=f.requests.find(r=>r.options.method==='POST');assert.equal(JSON.parse(create.options.body).id,'a'.repeat(32));
 for(const bad of [{...event,attendees:[]},{...event,end:event.start},{...event,summary:''},{...event,start:{dateTime:'invalid'}}])assert.throws(()=>f.api.eventData(bad));
 await assert.rejects(f.call('update',{googleEventId:'event123',event}),/neu laden/);
 await assert.rejects(setup({precondition:true}).call('update',{googleEventId:'event123',etag:'"v1"',event}),/inzwischen/);
 await assert.rejects(setup({attendees:true}).call('delete',{googleEventId:'event123',etag:'"v1"'}),/Einladungen/);
 await f.call('update',{googleEventId:'event123',etag:'"v1"',event});assert.equal(f.requests.find(r=>r.options.method==='PATCH').options.headers['If-Match'],'"v1"');
 await f.call('delete',{googleEventId:'event123',etag:'"v1"'});assert.ok(f.requests.find(r=>r.options.method==='DELETE'));
});
test('Calendar reply proof: all statuses map and stale observations cannot replace H2O replies',()=>{
 const {api}=setup();for(const [input,output] of [['accepted','yes'],['declined','excused'],['tentative','maybe'],['needsAction','open']])assert.equal(api.replyProposal(input,null,0,0),output);
 assert.equal(api.replyProposal('accepted',{source:'h2o'},1,1),null);
 assert.equal(api.replyProposal('declined',{source:'google'},1,2),null);
 assert.equal(api.replyProposal('accepted',{status:'excused'},1,1),null,'legacy replies protected');
 assert.equal(api.replyProposal('invalid',null,0,0),null);
});

test('Google event mapping uses the existing H2O ID and never exposes source identifiers to members',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,event=cal.events[0],original=f.c.fetch;f.env.GOOGLE_CALENDAR_CLIENT_ID=client;let ambiguous=false;
 f.c.fetch=async(url,options)=>{const u=new URL(url);if(u.hostname==='oauth2.googleapis.com')return Response.json({aud:client,scope,expires_in:300});if(u.hostname==='www.googleapis.com'){if(u.searchParams.get('fields')==='accessRole')return Response.json({accessRole:'writer'});const item={id:'google-event',iCalUID:event.googleUid,etag:'"source-v1"',summary:'Synthetic source'};return Response.json({items:ambiguous?[item,item]:[item]});}return original(url,options);};
 const result=await f.call('google-api/resolve',{eventId:event.id,googleUid:'ignored-foreign-uid',googleAccessToken:token},null,true);assert.equal(result.status,200,JSON.stringify(result.value));assert.equal(result.value.event.id,'google-event');assert.equal((await f.call('list')).value.events[0].googleUid,undefined);
 ambiguous=true;assert.equal((await f.call('google-api/resolve',{eventId:event.id,googleAccessToken:token},null,true)).status,409);
});
