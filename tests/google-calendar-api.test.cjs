const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {fixture}=require('./helpers/portal-fixture.cjs');
const scope='https://www.googleapis.com/auth/calendar.events',token='SYNTHETIC_GOOGLE_TOKEN_1234567890',client='synthetic.apps.googleusercontent.com';
function setup({role='writer',aud=client,granted=scope,expires=300,precondition=false,attendees=false}={}){
 const requests=[],ctx={URL,URLSearchParams,Date,AbortSignal,fetch:async(url,options={})=>{if(options.redirect==='error')throw new TypeError('Invalid redirect value, must be follow or manual');requests.push({url,options});if(url.includes('tokeninfo'))return Response.json({aud,scope:granted,expires_in:expires});if(url.includes('maxResults=1'))return Response.json({accessRole:role});if(options.method&&precondition)return new Response('',{status:412});if(options.method==='DELETE')return new Response(null,{status:204});return Response.json({etag:'"v1"',attendees:attendees?[{email:'synthetic@example.invalid'}]:undefined,items:[]});}};
 vm.runInNewContext(fs.readFileSync('cloudflare/push/google-calendar-api.js','utf8'),ctx);
 const call=(action,data={},env={GOOGLE_CALENDAR_CLIENT_ID:client})=>ctx.GoogleCalendarAPI.route(action,{googleAccessToken:token,...data},env,{calendarUrl:'https://calendar.google.com/calendar/ical/test%40example.invalid/public/basic.ics'});
 return {api:ctx.GoogleCalendarAPI,call,requests,ctx};
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
  const f=setup(options);await assert.rejects(f.call('update',{event,googleEventId:'event123',etag:'"v1"'}));assert.equal(f.requests.some(r=>r.options.method==='PATCH'),false);
 }
 const f=setup();assert.equal((await f.call('status')).accessRole,'writer');assert.match(f.requests[1].url,/test%40example.invalid/);
 const read=setup({role:'reader',granted:'https://www.googleapis.com/auth/calendar.events.readonly'});assert.equal((await read.call('status')).accessRole,'reader');
});
test('Google API: allowlisted updates, ETags and no guest changes',async()=>{
 const f=setup();
 for(const bad of [{...event,attendees:[]},{...event,end:event.start},{...event,summary:''},{...event,start:{dateTime:'invalid'}},{...event,start:{date:'2026-02-30'},end:{date:'2026-03-04'}}])assert.throws(()=>f.api.eventData(bad));
 await assert.rejects(f.call('update',{googleEventId:'event123',event}),/neu laden/);
 await assert.rejects(setup({precondition:true}).call('update',{googleEventId:'event123',etag:'"v1"',event}),/inzwischen/);
 await assert.rejects(setup({attendees:true}).call('delete',{googleEventId:'event123',etag:'"v1"'}),/Einladungen/);
 await f.call('update',{googleEventId:'event123',etag:'"v1"',event});assert.equal(f.requests.find(r=>r.options.method==='PATCH').options.headers['If-Match'],'"v1"');
 await f.call('delete',{googleEventId:'event123',etag:'"v1"'});assert.ok(f.requests.find(r=>r.options.method==='DELETE'));
});
test('Google event mapping uses the existing H2O ID and never exposes source identifiers to members',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,event=cal.events[0],original=f.c.fetch;f.env.GOOGLE_CALENDAR_CLIENT_ID=client;let ambiguous=false;
 f.c.fetch=async(url,options)=>{const u=new URL(url);if(u.hostname==='oauth2.googleapis.com')return Response.json({aud:client,scope,expires_in:300});if(u.hostname==='www.googleapis.com'){if(u.searchParams.get('fields')==='accessRole')return Response.json({accessRole:'writer'});const item={id:'google-event',iCalUID:event.googleUid,etag:'"source-v1"',summary:'Synthetic source'};return Response.json({items:ambiguous?[item,item]:[item]});}return original(url,options);};
 const result=await f.call('google-api/resolve',{eventId:event.id,googleUid:'ignored-foreign-uid',googleAccessToken:token},null,true);assert.equal(result.status,200,JSON.stringify(result.value));assert.equal(result.value.event.id,'google-event');assert.equal((await f.call('list')).value.events[0].googleUid,undefined);
 ambiguous=true;assert.equal((await f.call('google-api/resolve',{eventId:event.id,googleAccessToken:token},null,true)).status,409);
});

test('Google connection: token verification and calendar failures identify their step without leaking tokens',async()=>{
 for(const step of ['verification','calendar'])for(const mode of ['network','body','null']){
  const f=await fixture();f.env.GOOGLE_CALENDAR_CLIENT_ID=client;
  f.c.fetch=async url=>{if(step==='calendar'&&String(url).includes('tokeninfo'))return Response.json({aud:client,scope,expires_in:300});if(mode==='network')throw Error(token);if(mode==='body')return new Response('invalid '+token);return Response.json(null);};
  const result=await f.call('google-api/status',{googleAccessToken:token},null,true);
  assert.equal(result.status,503);assert.match(result.value.error,step==='verification'?/G02/:/G03/);assert.equal(JSON.stringify(result).includes(token),false);
 }
});

test('Google API: neither access verification nor calendar requests follow credential-bearing redirects',async()=>{
 for(const step of ['verification','calendar']){
  const f=await fixture();f.env.GOOGLE_CALENDAR_CLIENT_ID=client;let calls=0;
  f.c.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');assert.notEqual(new URL(url).hostname,'synthetic.example.invalid');if(step==='calendar'&&String(url).includes('tokeninfo'))return Response.json({aud:client,scope,expires_in:300});return new Response(token,{status:307,headers:{Location:'https://synthetic.example.invalid/collect'}});};
  const result=await f.call('google-api/status',{googleAccessToken:token},null,true);
  assert.equal(result.status,503);assert.match(result.value.error,step==='verification'?/Weiterleitung.*G02/:/Weiterleitung.*G03/);assert.equal(calls,step==='verification'?1:2);assert.equal(JSON.stringify(result).includes(token),false);
 }
});

test('Google API creates no new calendar entries from H2O',async()=>{const f=setup();await assert.rejects(f.call('create',{event,requestId:'a'.repeat(32)}),e=>e.status===404);assert.equal(f.requests.length,0);});


test('Google-Löschung prüft Rechte und Termin parallel, wartet aber vor DELETE auf beide Ergebnisse',async()=>{
 const f=setup(),fetch=f.ctx.fetch,reads=[];let permissions,eventRead;
 f.ctx.fetch=async(url,options)=>{if(url.includes('maxResults=1')){reads.push('role');return new Promise(resolve=>permissions=()=>resolve(Response.json({accessRole:'writer'})));}if(url.includes('fields=etag,')){reads.push('event');return new Promise(resolve=>eventRead=()=>resolve(Response.json({etag:'"v1"'})));}return fetch(url,options);};
 const deleting=f.call('delete',{googleEventId:'event123',etag:'"v1"'});
 await new Promise(setImmediate);assert.deepEqual(reads,['role','event']);assert.equal(f.requests.some(r=>r.options.method==='DELETE'),false);
 permissions();await new Promise(setImmediate);assert.equal(f.requests.some(r=>r.options.method==='DELETE'),false);
 eventRead();assert.equal((await deleting).ok,true);assert.equal(f.requests.filter(r=>r.options.method==='DELETE').length,1);
});

test('Google-Löschung bleibt trotz paralleler Leseprüfungen ohne Schreibrecht, bei Gästen und geänderter ETag gesperrt',async()=>{
 for(const options of [{role:'reader'},{role:'freeBusyReader'},{attendees:true}]){
  const f=setup(options);await assert.rejects(f.call('delete',{googleEventId:'event123',etag:'"v1"'}));assert.equal(f.requests.some(r=>r.options.method==='DELETE'),false);
 }
 const f=setup();await assert.rejects(f.call('delete',{googleEventId:'event123',etag:'"old"'}),/inzwischen/);assert.equal(f.requests.some(r=>r.options.method==='DELETE'),false);
});
