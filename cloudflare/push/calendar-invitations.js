/* Public calendar subscription plus compatibility-only cleanup of former test invitations. */
(function(g){
 'use strict';
 const L=g.CentralLedger,fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const schema=[
  'CREATE TABLE IF NOT EXISTS portal_response_requests (event TEXT PRIMARY KEY,request TEXT NOT NULL,requested_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_bridge (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,run_id TEXT,run_until INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_profiles (member TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,email_hash TEXT UNIQUE,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_invites (id TEXT PRIMARY KEY,event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT \'pending\',last_error TEXT)',
  'CREATE INDEX IF NOT EXISTS portal_calendar_invites_member ON portal_calendar_invites(member,event)'
 ];
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
 const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
 const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;};
 const open=async(env,row,purpose)=>row?{...await L.open(env,row.payload,purpose),version:row.version}:null;
 const config=async env=>open(env,await env.DB.prepare('SELECT * FROM portal_calendar_bridge WHERE id=1').first(),'calendar-bridge');
 // Compatibility-only: finish withdrawing copies created during the old test.
 const remaining=async env=>(await env.DB.prepare("SELECT COUNT(*) n FROM portal_calendar_invites WHERE state NOT IN ('cancelled','finished') AND event<>'verification'").first()).n;
 async function preference(env,data,record){
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_profiles WHERE member=?').bind(record.memberId).first();
  if(data.email!==undefined||data.confirm!==undefined||data.allowed!==undefined&&data.allowed!==false)fail('Keine Kalenderadresse oder zusätzliche Freigabe nötig. Bitte den H₂O-Link im Kalenderabo verwenden.',410);
  if(data.allowed===false){
   if(data.expectedVersion!==(row?.version||0))fail('Die gespeicherte Kalenderadresse wurde geändert. Bitte neu laden.');
   if(row){const saved=await env.DB.prepare("UPDATE portal_calendar_profiles SET email_hash=NULL,payload='',version=version+1 WHERE member=? AND version=?").bind(record.memberId,row.version).run();if(!saved.meta.changes)fail('Die gespeicherte Kalenderadresse wurde gleichzeitig geändert.');}
  }
  return {deliveryMode:'links',allowed:false,verified:false,pending:false,email:'',hasSavedAddress:data.allowed===false?false:!!row?.payload,version:(row?.version||0)+(data.allowed===false&&row?1:0),configured:false};
 }
 async function authenticated(env,auth){const c=await config(env);if(!c?.enabled||! /^[a-f0-9]{64}$/.test(auth)||!same(await digest(auth),c.secretHash))fail('Kalenderbereinigung nicht autorisiert.',401);return c;}
 async function run(env,data){const row=await env.DB.prepare('SELECT * FROM portal_calendar_bridge WHERE id=1').first();if(!row?.run_id||!same(row.run_id,data.run)||row.run_until<=Date.now())fail('Bereinigung abgelaufen. Bitte erneut starten.');return row;}
 const valid=(id,value)=>/^[a-f0-9]{64}$/.test(id||'')&&new RegExp('^h2o'+id+'[a-f0-9]{1,8}$').test(value||'');
 async function bridge(action,data,env,auth){
  const c=await authenticated(env,auth);
  if(action==='begin'){
   const source=await g.PortalService.config(env),sourceId=source?decodeURIComponent(new URL(source.calendarUrl).pathname.split('/')[3]):null;
   if(typeof data.calendarId!=='string'||! /^[A-Za-z0-9_.@-]{5,1024}$/.test(data.calendarId)||data.calendarId===sourceId||data.sourceCalendarId!==sourceId||c.calendarId&&c.calendarId!==data.calendarId)fail('Die private Kalenderzuordnung stimmt nicht überein.',400);
   const runId=random(),now=Date.now(),payload=await L.seal(env,{...c,deliveryMode:'links',calendarId:data.calendarId},'calendar-bridge');
   const acquired=await env.DB.prepare('UPDATE portal_calendar_bridge SET payload=?,run_id=?,run_until=? WHERE id=1 AND version=? AND run_until<=?').bind(payload,runId,now+240000,c.version,now).run();if(!acquired.meta.changes)fail('Eine Kalenderbereinigung läuft bereits.');
   const jobs=[],rows=(await env.DB.prepare("SELECT * FROM portal_calendar_invites WHERE state NOT IN ('cancelled','finished') LIMIT 30").all()).results;
   for(const row of rows){
    const value=await open(env,row,'calendar-invite:'+row.id);
    if(value.verification){const sanitized=await L.seal(env,{phase:'cancelled',googleEventId:value.googleEventId},'calendar-invite:'+row.id);await env.DB.prepare("UPDATE portal_calendar_invites SET payload=?,state='cancelled',last_error=NULL,version=version+1 WHERE id=? AND version=?").bind(sanitized,row.id,row.version).run();continue;}
    if(!valid(row.id,value.googleEventId))fail('Eine alte Einladungskennung muss geprüft werden.');
    const cleanup=value.phase==='finishing'||value.endsAt<=now,phase=cleanup?'finishing':'cancelling';
    const saved=await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=?,version=version+1 WHERE id=? AND version=?').bind(await L.seal(env,{...value,phase},'calendar-invite:'+row.id),phase,row.id,row.version).run();
    if(saved.meta.changes)jobs.push({id:row.id,googleEventId:value.googleEventId,action:cleanup?'cleanup':'cancel'});
   }
   return {ok:true,run:runId,calendarId:data.calendarId,jobs,remaining:await remaining(env)};
  }
  await run(env,data);
  if(action==='finish'){const saved=await env.DB.prepare('UPDATE portal_calendar_bridge SET run_id=NULL,run_until=0,updated_at=? WHERE id=1 AND run_id=?').bind(Date.now(),data.run).run();if(!saved.meta.changes)fail('Bereinigung wurde gleichzeitig geändert.');const left=await remaining(env);const pending=(await env.DB.prepare("SELECT COUNT(*) n FROM portal_calendar_invites WHERE state NOT IN ('cancelled','finished')").first()).n;return {ok:true,remaining:left,done:pending===0};}
  // Old adapters may still submit observations or acknowledgements for retired work.
  if(action==='observe')return {ok:true,ignored:true};
  if(!['authorize','result'].includes(action)||!valid(data.id,data.googleEventId))fail('Ungültige Bereinigungskennung.',400);
  if(!['cancel','cleanup'].includes(data.action))return {ok:true,eligible:false,ignored:true};
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_invites WHERE id=?').bind(data.id).first(),value=await open(env,row,'calendar-invite:'+data.id),phase=data.action==='cleanup'?'finishing':'cancelling',done=data.action==='cleanup'?'finished':'cancelled';
  if(!row||value.googleEventId!==data.googleEventId)return {ok:true,eligible:false,ignored:true};
  if(action==='authorize')return {ok:true,eligible:value.phase===phase};
  if(value.phase===done)return {ok:true};
  if(value.phase!==phase)fail('Die Bereinigung ist nicht mehr beauftragt.');
  if(data.error){const saved=await env.DB.prepare("UPDATE portal_calendar_invites SET last_error='cleanup_failed',version=version+1 WHERE id=? AND version=?").bind(data.id,row.version).run();if(!saved.meta.changes)fail('Bereinigung wurde gleichzeitig geändert.');return {ok:true};}
  const payload=await L.seal(env,{phase:done,googleEventId:value.googleEventId},'calendar-invite:'+data.id);
  const saved=await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=?,last_error=NULL,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM portal_calendar_bridge WHERE run_id=? AND run_until>?)').bind(payload,done,data.id,row.version,data.run,Date.now()).run();if(!saved.meta.changes)fail('Bereinigung wurde gleichzeitig geändert.');return {ok:true};
 }
 g.CalendarInvitations={schema,preference,bridge};
})(globalThis);
