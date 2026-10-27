const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('docs/google-calendar-invitations/Code.gs','utf8');
const job={id:'a'.repeat(64),googleEventId:'h2o'+'a'.repeat(64)+'0',fingerprint:'b'.repeat(64),action:'upsert',email:'member@example.test',summary:'Probe Beispiel',description:'Öffentliche Termininformation',location:'GH Wasser',start:{dateTime:'2030-06-10T18:00:00Z',timeZone:'Europe/Berlin'},end:{dateTime:'2030-06-10T20:00:00Z',timeZone:'Europe/Berlin'}};
function fixture(options={}){
 const properties=new Map([['H2O_CALENDAR_ID','public-source'],['H2O_INVITATION_SECRET','c'.repeat(64)],['H2O_INVITATION_CALENDAR_ID','private-calendar'],['H2O_INVITATION_SYNC_TOKEN','old-sync']]),requests=[],mails=[],state={existing:options.existing||null,expired:false,released:0,ackFailed:false,interval:null};
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
   return response(200,{ok:true});
  }
  assert.ok(url.startsWith('https://www.googleapis.com/calendar/v3/'));assert.ok(!url.includes('calendars/public-source/events'),'never write guests into the public source');
  if(url.includes('/acl?'))return response(200,{items:options.publicCalendar?[{role:'reader',scope:{type:'default'}}]:[{role:'owner',scope:{type:'user',value:'owner@example.test'}}]});
  if(url.endsWith('/colors'))return response(200,{event:{}});
  if(url.includes('/events?')&&(!opts.method||opts.method==='get')){
   if(options.expired&&!state.expired&&url.includes('syncToken=')){state.expired=true;return response(410,{});}
   return response(200,{items:options.delta??[googleEvent()],nextSyncToken:'next-sync'});
  }
  if(opts.method==='get')return state.existing?response(200,state.existing):response(404,{});
  if(opts.method==='delete'){state.existing=null;return response(204,{});}
  const value=JSON.parse(opts.payload);state.existing={...value,id:value.id||job.googleEventId,etag:'"saved"'};return response(200,state.existing);
 }}});vm.runInContext(source,c);return {c,state,properties,requests,mails};
}
const workerCalls=(f,action)=>f.requests.filter(r=>r.url.endsWith('/portal/calendar-bridge/'+action)).map(r=>JSON.parse(r.opts.payload));
test('Standalone invitation adapter creates one private guest copy, uses notifications and acknowledges bounded reply batches',()=>{
 const f=fixture({jobs:[job]});f.c.h2oSyncInvitations();
 const write=f.requests.find(r=>r.opts.method==='post'&&r.url.includes('googleapis.com')&&r.url.includes('/events?'));assert.ok(write);const event=JSON.parse(write.opts.payload);
 assert.equal(event.visibility,'private');assert.equal(event.guestsCanSeeOtherGuests,false);assert.equal(event.guestsCanInviteOthers,false);assert.equal(event.guestsCanModify,false);assert.deepEqual(event.attendees,[{email:job.email,responseStatus:'needsAction'}]);assert.match(write.url,/sendUpdates=all/);assert.equal(write.opts.followRedirects,false);
 assert.equal(workerCalls(f,'authorize').length,1);assert.equal(workerCalls(f,'observe')[0].items[0].googleStatus,'accepted');assert.equal(f.properties.get('H2O_INVITATION_SYNC_TOKEN'),'next-sync');assert.equal(f.state.released,1);
});
test('Public or reader-shared invitation calendars stop before any H2O job or member address is fetched',()=>{
 const f=fixture({publicCalendar:true,jobs:[job]});assert.throws(()=>f.c.h2oSyncInvitations(),/privat/);assert.equal(workerCalls(f,'begin').length,0);assert.equal(f.mails.length,0);assert.equal(f.state.released,1);
});
test('Withdrawn jobs never send mail or write Google events; foreign events are not deleted',()=>{
 const f=fixture({jobs:[job],eligible:false});f.c.h2oSyncInvitations();assert.equal(f.requests.some(r=>r.url.includes('googleapis.com')&&['post','patch','delete'].includes(r.opts.method)),false);
 const foreign=fixture({jobs:[{...job,action:'cancel'}],existing:{id:job.googleEventId,etag:'"foreign"',extendedProperties:{private:{h2oInvitation:'foreign'}}}});foreign.c.h2oSyncInvitations();assert.equal(foreign.requests.some(r=>r.opts.method==='delete'),false);assert.ok(workerCalls(foreign,'result')[0].error);
});
test('A lost acknowledgement does not resend an already saved invitation or confirmation email',()=>{
 const existing={...job,id:job.googleEventId,etag:'"existing"',extendedProperties:{private:{h2oInvitation:job.id,h2oFingerprint:job.fingerprint}},attendees:[{email:job.email,responseStatus:'accepted'}]};
 const f=fixture({jobs:[job],existing});f.c.h2oSyncInvitations();assert.equal(f.requests.some(r=>r.url.includes('googleapis.com')&&['post','patch'].includes(r.opts.method)),false);
 const mail=fixture({jobs:[{...job,verification:true}],ackFailsOnce:true,delta:[]});mail.c.h2oSyncInvitations();mail.c.h2oSyncInvitations();assert.equal(mail.mails.length,1);assert.equal(mail.mails[0].to,job.email);assert.equal(JSON.stringify(mail.mails).includes('c'.repeat(64)),false);
});
test('Mail quota failure leaves replies operational and the verification job retryable',()=>{
 const f=fixture({jobs:[{...job,verification:true}],quota:0});f.c.h2oSyncInvitations();assert.equal(f.mails.length,0);assert.ok(workerCalls(f,'result')[0].error);assert.equal(workerCalls(f,'observe').length,1);assert.equal(f.properties.has('H2O_VERIFICATION_'+job.id),false);
});
test('Delta token expiry re-reads safely; failed answer import never advances the cursor',()=>{
 const f=fixture({expired:true});f.c.h2oSyncInvitations();const reads=f.requests.filter(r=>r.url.includes('/events?'));assert.equal(reads.length,2);assert.match(reads[0].url,/syncToken=/);assert.doesNotMatch(reads[1].url,/syncToken=/);assert.equal(f.properties.get('H2O_INVITATION_SYNC_TOKEN'),'next-sync');
 const failing=fixture({observeFails:true});assert.throws(()=>failing.c.h2oSyncInvitations());assert.equal(failing.properties.get('H2O_INVITATION_SYNC_TOKEN'),'old-sync');assert.equal(workerCalls(failing,'finish').length,0);
});
test('Deleted invitation tombstones are reported, and standalone setup installs a five-minute trigger',()=>{
 const f=fixture({delta:[{id:job.googleEventId,status:'cancelled'}]});f.c.h2oSetupInvitations();assert.equal(f.state.interval,5);assert.equal(workerCalls(f,'observe')[0].items[0].cancelled,true);assert.equal(f.state.released,2);
 const manifest=JSON.parse(fs.readFileSync('docs/google-calendar-invitations/appsscript.json','utf8'));assert.ok(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/calendar.events'));assert.equal(manifest.addOns,undefined);assert.equal(manifest.webapp,undefined);assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'));assert.ok(!manifest.oauthScopes.some(s=>/drive|gmail|admin/.test(s)));
});

test('Finished invitation cleanup removes only the private copy and requests attendee updates',()=>{const f=fixture({jobs:[{...job,action:'cleanup'}],existing:{id:job.googleEventId,etag:'\"v1\"',extendedProperties:{private:{h2oInvitation:job.id}}},delta:[]});f.c.h2oSyncInvitations();const removal=f.requests.find(r=>r.opts.method==='delete');assert.ok(removal);assert.match(removal.url,/sendUpdates=all/);assert.equal(workerCalls(f,'result')[0].action,'cleanup');});
