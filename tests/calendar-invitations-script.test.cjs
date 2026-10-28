const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('docs/google-calendar-invitations/Code.gs','utf8');
const job={id:'a'.repeat(64),googleEventId:'h2o'+'a'.repeat(64)+'0',action:'cancel'};
function fixture(options={}){
 const properties=new Map([['H2O_CALENDAR_ID','public-source'],['H2O_INVITATION_SECRET','c'.repeat(64)],['H2O_INVITATION_CALENDAR_ID','private-calendar'],['H2O_INVITATION_SYNC_TOKEN','old-sync'],['H2O_INVITATION_REMINDERS_V2','1']]),requests=[],mails=[],state={existing:options.existing||null,expired:false,released:0,ackFailed:false,interval:null};
 const googleEvent=()=>({id:job.googleEventId,status:'confirmed',extendedProperties:{private:{h2oInvitation:job.id,h2oFingerprint:job.fingerprint}},attendees:[{email:job.email,responseStatus:'accepted'}]});
 const response=(status,value)=>({getResponseCode:()=>status,getContentText:()=>JSON.stringify(value)});
 const c=vm.createContext({console,URL,Date,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,getProperties:()=>Object.fromEntries(properties),setProperty:(k,v)=>{properties.set(k,v);},deleteProperty:k=>properties.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>options.locked!==true,releaseLock:()=>state.released++})},MailApp:{getRemainingDailyQuota:()=>options.quota??100,sendEmail:value=>mails.push(value)},ScriptApp:{getOAuthToken:()=> 'SYNTHETIC_GOOGLE_ACCESS',getProjectTriggers:()=>[],deleteTrigger(){},newTrigger:()=>({timeBased(){return this;},everyMinutes(value){state.interval=value;return {create(){}};}})},UrlFetchApp:{fetch:(url,opts={})=>{
  requests.push({url,opts});
  if(url.includes('/portal/calendar-bridge/')){
   const action=url.split('/').at(-1),data=JSON.parse(opts.payload||'{}');
   if(action==='begin')return response(200,{ok:true,run:'d'.repeat(64),calendarId:'private-calendar',jobs:options.jobs||[]});
   if(action==='authorize')return response(200,{ok:true,eligible:options.eligible!==false});
   if(action==='observe'&&options.observeFails)return response(503,{error:'synthetic failure'});
   if(action==='result'&&options.ackFailsOnce&&!state.ackFailed){state.ackFailed=true;return response(503,{error:'synthetic failure'});}
   return response(200,{ok:true,done:options.done===true});
  }
  assert.ok(url.startsWith('https://www.googleapis.com/calendar/v3/'));assert.ok(!url.includes('calendars/public-source/events'),'never write guests into the public source');
  if(url.includes('/acl?'))return response(200,{items:options.publicCalendar?[{role:'reader',scope:{type:'default'}}]:[{role:'owner',scope:{type:'user',value:'owner@example.test'}}]});
  if(url.endsWith('/colors'))return response(200,{event:{}});
  if(url.includes('/events?')&&(!opts.method||opts.method==='get')){
   if(options.expired&&!state.expired&&url.includes('syncToken=')){state.expired=true;return response(410,{});}
   return response(200,{items:options.delta??[options.deltaFromExisting&&state.existing||googleEvent()],nextSyncToken:'next-sync'});
  }
  if(opts.method==='get')return state.existing?response(200,state.existing):response(404,{});
  if(opts.method==='delete'){state.existing=null;return response(204,{});}
  if(opts.method==='patch'&&options.patchConflict)return response(412,{});
  const value=JSON.parse(opts.payload);state.existing={...(opts.method==='patch'?state.existing:{}),...value,id:value.id||job.googleEventId,etag:'"saved"'};if(options.unconfirmedStatus)state.existing.attendees[0].responseStatus='needsAction';return response(200,state.existing);
 }}});vm.runInContext(source,c);return {c,state,properties,requests,mails};
}
const existing=()=>({id:job.googleEventId,status:'confirmed',etag:'"old"',extendedProperties:{private:{h2oInvitation:job.id}}});
test('Bereinigung löscht nur die eigene alte Einladung mit ETag und erstellt weder Kalender noch E-Mail',()=>{const f=fixture({jobs:[job],existing:existing()});f.c.h2oSyncInvitations();const writes=f.requests.filter(r=>r.url.includes('googleapis.com')&&['post','patch','delete'].includes(r.opts.method));assert.equal(writes.length,1);assert.equal(writes[0].opts.method,'delete');assert.equal(writes[0].opts.headers['If-Match'],'"old"');assert.match(writes[0].url,/sendUpdates=all/);assert.equal(f.mails.length,0);assert.throws(()=>f.c.h2oSetupInvitations(),/abgelöst/);});
test('Fremde Kalender und Marker sowie neue Auftragsarten werden ohne Änderungen abgelehnt',()=>{for(const options of [{publicCalendar:true,jobs:[job]},{jobs:[{...job,action:'upsert'}]}]){const f=fixture(options);assert.throws(()=>f.c.h2oSyncInvitations());assert.equal(f.requests.some(r=>r.url.includes('googleapis.com')&&r.opts.method==='delete'),false);}const f=fixture({jobs:[job],existing:{...existing(),extendedProperties:{private:{h2oInvitation:'foreign'}}}});f.c.h2oSyncInvitations();assert.equal(f.requests.some(r=>r.opts.method==='delete'),false);assert.equal(f.mails.length,0);});
test('Nicht vorhandene oder bereits gelöschte eigene Einladungen werden ohne erneute Löschung quittiert',()=>{for(const value of [null,{...existing(),status:'cancelled'}]){const f=fixture({jobs:[job],existing:value});f.c.h2oSyncInvitations();assert.equal(f.requests.some(r=>r.opts.method==='delete'),false);assert.ok(f.requests.some(r=>r.url.endsWith('/result')));}});
test('Das Bereinigungsmanifest fordert keine E-Mail-Berechtigung und keine neuen Kalender an',()=>{const m=JSON.parse(fs.readFileSync('docs/google-calendar-invitations/appsscript.json'));assert.equal(m.oauthScopes.some(x=>/send_mail|gmail/.test(x)),false);assert.doesNotMatch(source,/MailApp|\/events\?.*post|ScriptApp\.newTrigger/);});

test('Nach bestätigter vollständiger Bereinigung wird ausschließlich der eigene alte Trigger entfernt',()=>{const f=fixture({done:true}),own={getHandlerFunction:()=> 'h2oSyncInvitations'},other={getHandlerFunction:()=> 'anotherTask'},removed=[];f.c.ScriptApp.getProjectTriggers=()=>[own,other];f.c.ScriptApp.deleteTrigger=t=>removed.push(t);f.c.h2oSyncInvitations();assert.equal(removed.length,1);assert.equal(removed[0],own);});
