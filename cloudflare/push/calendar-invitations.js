/* Private invitation jobs. The public source calendar never receives attendees.
   A separately authorized Apps Script owns Google credentials and a private calendar. */
(function(g){
 'use strict';
 const L=g.CentralLedger,DAY=86400000,ROOT='https://ffw-wasser.github.io/home/deckel.html';
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const schema=[
  'CREATE TABLE IF NOT EXISTS portal_calendar_bridge (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,run_id TEXT,run_until INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_profiles (member TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,email_hash TEXT UNIQUE,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_invites (id TEXT PRIMARY KEY,event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT \'pending\',last_error TEXT)',
  'CREATE INDEX IF NOT EXISTS portal_calendar_invites_member ON portal_calendar_invites(member,event)'
 ];
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
 const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
 const addressHash=async(env,address)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.INVITE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('calendar-email/v1:'+address))),n=>n.toString(16).padStart(2,'0')).join('');};
 const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;};
 const open=async(env,row,purpose)=>row?{...await L.open(env,row.payload,purpose),version:row.version}:null;
 const profileRow=(env,member)=>env.DB.prepare('SELECT * FROM portal_calendar_profiles WHERE member=?').bind(member).first();
 const profile=async(env,member)=>{const row=await profileRow(env,member);return row?.payload===''?{allowed:false,verified:false,version:row.version}:open(env,row,'calendar-profile:'+member);};
 const config=async env=>open(env,await env.DB.prepare('SELECT * FROM portal_calendar_bridge WHERE id=1').first(),'calendar-bridge');
 function email(value){if(typeof value!=='string'||value.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value)||value.includes('..'))fail('Bitte eine gültige Kalender-E-Mail-Adresse eingeben.',400);return value.toLowerCase();}
 const publicProfile=(p,record)=>({email:p?.allowed?p.email:'',allowed:p?.allowed===true,verified:p?.allowed===true&&p.verified===true&&(!record||p.alias===record.alias&&p.revision===record.revision),pending:p?.allowed===true&&!p.verified&&p.expiresAt>Date.now(),version:p?.version||0});
 async function settings(env,data){
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_bridge WHERE id=1').first(),c=await open(env,row,'calendar-bridge');
  if(data.enabled===undefined){const source=await g.PortalService.config(env);const sourceCalendarId=source?decodeURIComponent(new URL(source.calendarUrl).pathname.split('/')[3]):null;const counts=await env.DB.prepare("SELECT SUM(CASE WHEN state=\'pending\' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) errors FROM portal_calendar_invites").first();return {sourceCalendarId,pending:counts?.pending||0,errors:counts?.errors||0,configured:c?.enabled===true,calendarId:c?.calendarId||null,version:row?.version||0,lastSyncAt:row?.updated_at||null,error:c?.error||null};}
  if(typeof data.enabled!=='boolean'||data.expectedVersion!==(row?.version||0))fail('Die Kalenderanbindung wurde geändert. Bitte neu laden.');
  const secret=data.enabled?random():null,next={enabled:data.enabled,secretHash:secret?await digest(secret):null,calendarId:c?.calendarId||null,error:null};
  const payload=await L.seal(env,next,'calendar-bridge');
  const saved=row?await env.DB.prepare('UPDATE portal_calendar_bridge SET payload=?,version=version+1,run_id=NULL,run_until=0 WHERE id=1 AND version=?').bind(payload,row.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_calendar_bridge(id,payload) VALUES(1,?)').bind(payload).run();
  if(!saved.meta.changes)fail('Die Kalenderanbindung wurde gleichzeitig geändert.');
  return {ok:true,configured:next.enabled,secret,calendarId:next.calendarId,version:(row?.version||0)+1};
 }
 async function preference(env,data,record){
  const c=await config(env),old=await profile(env,record.memberId),version=old?.version||0;
  if(data.email===undefined&&data.confirm===undefined&&data.allowed===undefined)return {...publicProfile(old,record),configured:c?.enabled===true};
  if(data.expectedVersion!==version)fail('Die Kalenderadresse wurde geändert. Bitte neu laden.');
  let next;
  if(data.confirm!==undefined){
   if(typeof data.confirm!=='string'||! /^[a-f0-9]{64}$/.test(data.confirm)||!old?.allowed||old.alias!==record.alias||old.revision!==record.revision||old.verified||old.expiresAt<=Date.now()||!same(await digest(data.confirm),old.confirmHash))fail('Der Bestätigungslink ist ungültig oder abgelaufen.',400);
   next={...old,verified:true,confirmedAt:Date.now(),confirmToken:null,confirmHash:null,expiresAt:null};
  }else if(data.allowed===false){next={...old,email:null,allowed:false,verified:false,confirmToken:null,confirmHash:null,expiresAt:null};}
  else{
   if(data.allowed!==true||!c?.enabled)fail('Die Verwaltung muss zuerst die Kalendereinladungen einrichten.',400);
   const address=email(data.email),now=Date.now();
   if(old?.allowed&&old.verified&&old.email===address&&old.alias===record.alias&&old.revision===record.revision)return {...publicProfile(old,record),configured:c?.enabled===true};
   const count=old?.requestDay===Math.floor(now/DAY)?old.requestCount||0:0;
   if(count>=3||old?.requestedAt>now-600000)fail('Bitte vor einer weiteren Bestätigung warten; höchstens drei Anfragen pro Tag.',429);
   const token=random();next={alias:record.alias,revision:record.revision,email:address,allowed:true,verified:false,confirmToken:token,confirmHash:await digest(token),expiresAt:now+DAY,requestedAt:now,requestDay:Math.floor(now/DAY),requestCount:count+1};
  }
  delete next.version;
  const emailHash=next.allowed?await addressHash(env,next.email):null;
  const existing=emailHash?await env.DB.prepare('SELECT member FROM portal_calendar_profiles WHERE email_hash=? AND member<>?').bind(emailHash,record.memberId).first():null;
  if(existing){
   const otherRow=await profileRow(env,existing.member),other=await open(env,otherRow,'calendar-profile:'+existing.member);let inactive=false;
   try{const access=await g.PortalService.assertAlias(env,other.alias);inactive=access?.memberId!==existing.member||access.revision!==other.revision;}catch(e){if(![401,403].includes(e.status))throw e;inactive=true;}
   if(!inactive&&(other.verified||other.expiresAt>Date.now()))fail('Diese Kalenderadresse ist bereits einem anderen Konto zugeordnet.',409);
   const cleared=await L.seal(env,{...other,email:null,allowed:false,verified:false,confirmToken:null,confirmHash:null,expiresAt:null},'calendar-profile:'+existing.member);
   const released=await env.DB.prepare('UPDATE portal_calendar_profiles SET email_hash=NULL,payload=?,version=version+1 WHERE member=? AND version=?').bind(cleared,existing.member,otherRow.version).run();if(!released.meta.changes)fail('Die Kalenderadresse wurde gleichzeitig geändert. Bitte erneut prüfen.');
  }
  const payload=await L.seal(env,next,'calendar-profile:'+record.memberId);
  let saved;try{saved=version?await env.DB.prepare('UPDATE portal_calendar_profiles SET alias=?,revision=?,email_hash=?,payload=?,version=version+1 WHERE member=? AND version=?').bind(record.alias,record.revision,emailHash,payload,record.memberId,version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_calendar_profiles(member,alias,revision,email_hash,payload) VALUES(?,?,?,?,?)').bind(record.memberId,record.alias,record.revision,emailHash,payload).run();}catch{fail('Die Kalenderadresse konnte nicht eindeutig gespeichert werden. Bitte neu laden.');}
  if(!saved.meta.changes)fail('Die Kalenderadresse wurde gleichzeitig geändert.');
  return {...publicProfile({...next,version:version+1}),configured:c?.enabled===true};
 }
 async function context(env,onlyMembers=null){
  const configuration=await g.PortalService.config(env),calendar=await g.PortalService.decorate(env,await g.PortalService.calendar(env));
  if(!configuration||calendar.stale)fail('Der Quellkalender ist nicht aktuell bestätigt. Es werden keine Einladungen geändert.',503);
  const row=await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),roster=row?await L.open(env,row.payload,'portal-roster'):null;
  const profiles=[],members=new Set((roster?.members||[]).map(m=>m.id));
  const query='SELECT p.*,l.payload AS access_payload FROM portal_calendar_profiles p JOIN accounts a ON a.alias=p.alias AND a.revision=p.revision JOIN ledger_access l ON l.alias=p.alias AND l.revision=p.revision WHERE p.payload<>\'\''+(onlyMembers?' AND p.member IN (SELECT value FROM json_each(?))':'');
  const statement=env.DB.prepare(query),rows=(await (onlyMembers?statement.bind(JSON.stringify(onlyMembers)):statement).all()).results;
  for(const row of rows){if(!members.has(row.member))continue;const record=await L.open(env,row.access_payload,'access:'+row.alias);if(record.memberId!==row.member)continue;const p=await open(env,row,'calendar-profile:'+row.member);p.member=row.member;if(p.allowed&&p.alias===record.alias&&p.revision===record.revision)profiles.push(p);}
  const invited=new Set((await env.DB.prepare("SELECT id FROM portal_calendar_invites WHERE state NOT IN ('cancelled','finished')").all()).results.map(row=>row.id));
  return {profiles,calendar,invited,sequence:(await L.meta(env)).seq,calendarId:decodeURIComponent(new URL(configuration.calendarUrl).pathname.split('/')[3])};
 }
 async function desired(env,onlyMembers=null){
  const ctx=await context(env,onlyMembers),out=new Map(),now=Date.now();
  for(const p of ctx.profiles){
   if(!p.verified){if(p.expiresAt<=now)continue;const id=await digest('verify:'+p.member+':'+p.version),day=new Date(p.requestedAt+DAY).toISOString().slice(0,10);out.set(id,{id,member:p.member,event:'verification',profileVersion:p.version,verification:true,email:p.email,summary:'H₂O · Kalenderadresse bestätigen',description:'Bestätige deine freiwillige Kalenderanbindung in deinem angemeldeten H₂O-Konto:\n'+ROOT+'?calendarConfirm='+p.confirmToken+'\nDer Link ist einmalig und 24 Stunden gültig. Wenn du dies nicht angefordert hast, ignoriere diese E-Mail. Es werden keine Termine versendet.',start:{date:day},end:{date:new Date(Date.parse(day)+DAY).toISOString().slice(0,10)},colorId:null});continue;}
   for(const e of ctx.calendar.events){
    if(e.kind!=='probe'||!e.approved||e.end<=now||Array.isArray(e.recipientIds)&&!e.recipientIds.includes(p.member))continue;
    const id=await digest('invite:'+e.id+':'+p.member+':'+p.version);if((e.start<=now||e.start>now+90*DAY)&&!ctx.invited.has(id))continue;const time=ms=>({dateTime:new Date(ms).toISOString(),timeZone:'Europe/Berlin'}),date=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms);
    out.set(id,{id,member:p.member,event:e.id,startsAt:e.start,endsAt:e.end,profileVersion:p.version,verification:false,email:p.email,summary:e.title,description:[e.attendanceType||e.sessionType,e.clothing&&'Kleidung: '+e.clothing,e.note,'Persönliche Rückmeldung: Bitte bis zum Terminbeginn in deinem Kalender zusagen, absagen oder vorläufig zusagen. Spätere Änderungen bitte im Gerätehaus klären.\nH₂O: '+ROOT].filter(Boolean).join('\n\n'),location:e.location||'GH Wasser',start:e.allDay?{date:date(e.start)}:time(e.start),end:e.allDay?{date:date(e.end)}:time(e.end),color:e.googleColor||null});
   }
  }
  for(const item of out.values()){item.fingerprint=await digest(JSON.stringify(item));item.googleEventId='h2o'+item.id+'0';}
  return {...ctx,desired:out};
 }
 async function authenticated(env,auth){const c=await config(env);if(!c?.enabled||! /^[a-f0-9]{64}$/.test(auth)||!same(await digest(auth),c.secretHash))fail('Kalenderverbindung nicht autorisiert.',401);return c;}
 async function run(env,data){const row=await env.DB.prepare('SELECT * FROM portal_calendar_bridge WHERE id=1').first();if(!row?.run_id||!same(row.run_id,data.run)||row.run_until<=Date.now())fail('Synchronisierung abgelaufen. Bitte erneut starten.');return row;}
 async function bridge(action,data,env,auth){
  const c=await authenticated(env,auth);
  if(action==='begin'){
   if(typeof data.calendarId!=='string'||! /^[A-Za-z0-9_.@-]{5,1024}$/.test(data.calendarId)||data.calendarId===data.sourceCalendarId)fail('Ein eigener privater Einladungskalender ist erforderlich.',400);
   if(c.calendarId&&c.calendarId!==data.calendarId)fail('Der private Einladungskalender wurde geändert. Bitte die Einrichtung prüfen.');
   const state=await desired(env);if(data.sourceCalendarId!==state.calendarId||data.calendarId===state.calendarId)fail('Die Kalenderzuordnung stimmt nicht überein.',400);
   const runId=random(),now=Date.now(),payload=await L.seal(env,{...c,calendarId:data.calendarId},'calendar-bridge');
   const acquired=await env.DB.prepare('UPDATE portal_calendar_bridge SET payload=?,run_id=?,run_until=? WHERE id=1 AND version=? AND run_until<=?').bind(payload,runId,now+240000,c.version,now).run();if(!acquired.meta.changes)fail('Eine Kalender-Synchronisierung läuft bereits.');
   const stored=new Map();for(const row of (await env.DB.prepare('SELECT * FROM portal_calendar_invites').all()).results)stored.set(row.id,{row,value:await open(env,row,'calendar-invite:'+row.id)});
   const jobs=[];
   // Cancellations first, including a create whose acknowledgement was lost.
   for(const [id,entry] of stored){
    const value=entry.value;if(['cancelled','finished'].includes(value.phase))continue;
    if(value.phase==='finishing'||!value.verification&&value.endsAt<=now){
     if(value.phase!=='finishing'){value.phase='finishing';await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=?,version=version+1 WHERE id=? AND version=?').bind(await L.seal(env,value,'calendar-invite:'+id),'finishing',id,entry.row.version).run();}
     jobs.push({id,action:'cleanup',googleEventId:value.googleEventId});continue;
    }
    if(!state.desired.has(id)||value.phase==='cancelling'){
     if(value.phase!=='cancelling'){value.phase='cancelling';await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=?,version=version+1 WHERE id=? AND version=?').bind(await L.seal(env,value,'calendar-invite:'+id),'cancelling',id,entry.row.version).run();}
     jobs.push({id,action:'cancel',googleEventId:value.googleEventId});
    }
   }
   for(const [id,item] of state.desired){
    const old=stored.get(id);if(['cancelling','finishing','remote-cancelled'].includes(old?.value.phase)||old?.value.phase==='active'&&old.value.fingerprint===item.fingerprint)continue;
    if(jobs.length>=30)break;
    const generation=(old?.value.generation||0)+(['cancelled','finished'].includes(old?.value.phase)?1:0),value={...item,generation,googleEventId:'h2o'+id+generation.toString(16),phase:'pending',delivered:old?.value.delivered===true||['active','finished'].includes(old?.value.phase),googleStatus:old?.value.googleStatus||null,lastError:null};
    const payload=await L.seal(env,value,'calendar-invite:'+id);
    if(old)await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=\'pending\',version=version+1 WHERE id=? AND version=?').bind(payload,id,old.row.version).run();
    else await env.DB.prepare('INSERT OR IGNORE INTO portal_calendar_invites(id,event,member,payload) VALUES(?,?,?,?)').bind(id,item.event,item.member,payload).run();
    jobs.push({...item,googleEventId:value.googleEventId,action:'upsert'});
   }
   return {ok:true,run:runId,calendarId:data.calendarId,jobs:jobs.slice(0,30)};
  }
  await run(env,data);
  if(action==='finish'){
   await env.DB.prepare('UPDATE portal_calendar_bridge SET run_id=NULL,run_until=0,updated_at=? WHERE id=1 AND run_id=?').bind(Date.now(),data.run).run();return {ok:true};
  }
  let onlyMembers;
  if(action==='observe'&&Array.isArray(data.items)){
   if(data.items.length>8||!data.items.length||data.items.some(item=>!item||! /^[a-f0-9]{64}$/.test(item.id||'')))fail('Ungültige Antwortanzahl.',400);
   onlyMembers=(await env.DB.prepare('SELECT DISTINCT member FROM portal_calendar_invites WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(data.items.map(item=>item.id))).all()).results.map(row=>row.member);
  }else{
   if(! /^[a-f0-9]{64}$/.test(data.id||''))fail('Ungültige Einladungskennung.',400);
   const row=await env.DB.prepare('SELECT member FROM portal_calendar_invites WHERE id=?').bind(data.id).first();if(!row)return {ok:true,ignored:true,eligible:false};onlyMembers=[row.member];
  }
  const state=await desired(env,onlyMembers);
  if(action==='observe'&&Array.isArray(data.items)){
   if(data.items.length>8||!data.items.length)fail('Ungültige Antwortanzahl.',400);
   for(const item of data.items)await applyResult('observe',{...item,run:data.run},env,state);
   return {ok:true};
  }
  return applyResult(action,data,env,state);
 }
 async function applyResult(action,data,env,state){
  if(!['result','observe','authorize'].includes(action)||! /^[a-f0-9]{64}$/.test(data.id||''))fail('Ungültige Einladungszuordnung.',400);
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_invites WHERE id=?').bind(data.id).first();if(!row)return {ok:true,ignored:true};
  const invitation=await open(env,row,'calendar-invite:'+data.id),target=state.desired.get(data.id);
  if(data.googleEventId!==invitation.googleEventId)return {ok:true,ignored:true,eligible:false};
  if(['result','authorize'].includes(action)&&!['upsert','cancel','cleanup'].includes(data.action))fail('Ungültiger Einladungsauftrag.',400);
  if(action==='result'&&data.googleStatus!==undefined)fail('Antworten müssen getrennt abgeglichen werden.',400);
  if(action==='observe'&&['cancelling','finishing','cancelled','finished'].includes(invitation.phase))return {ok:true,ignored:true};
  if(action==='result'&&['cancel','cleanup'].includes(data.action)&&invitation.phase===(data.action==='cleanup'?'finished':'cancelled'))return {ok:true};
  if(action==='result'&&data.action==='upsert'&&invitation.phase==='active'&&invitation.delivered&&target?.fingerprint===invitation.fingerprint&&data.fingerprint===invitation.fingerprint)return {ok:true};
  if(action==='authorize')return {ok:true,eligible:data.action==='cleanup'?invitation.phase==='finishing':data.action==='cancel'?invitation.phase==='cancelling':['pending','active'].includes(invitation.phase)&&!!target&&target.fingerprint===data.fingerprint&&target.fingerprint===invitation.fingerprint};
  if(data.error){if(typeof data.error!=='string'||data.error.length>200)fail('Ungültiger Fehlerstatus.',400);const payload=await L.seal(env,{...invitation,lastError:data.error},'calendar-invite:'+data.id);await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,last_error=?,version=version+1 WHERE id=? AND version=?').bind(payload,'delivery_failed',data.id,row.version).run();return {ok:true};}
  if(action==='result'&&['cancel','cleanup'].includes(data.action)){
   const finished=data.action==='cleanup';
   if(invitation.phase!==(finished?'finishing':'cancelling'))fail('Die Absage ist nicht mehr beauftragt. Bitte neu synchronisieren.');
   const payload=await L.seal(env,{phase:finished?'finished':'cancelled',profileVersion:invitation.profileVersion,generation:invitation.generation||0,googleEventId:invitation.googleEventId},'calendar-invite:'+data.id);
   await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=?,last_error=NULL,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM portal_calendar_bridge WHERE run_id=? AND run_until>?)').bind(payload,finished?'finished':'cancelled',data.id,row.version,data.run,Date.now()).run();return {ok:true};
  }
  if(action==='observe'&&target&&!target.verification&&target.startsAt<=Date.now())return {ok:true,ignored:true};
  if(action==='observe'&&data.cancelled===true){
   if(!target||target.verification)return {ok:true,ignored:true};
   const payload=await L.seal(env,{...invitation,phase:'remote-cancelled',lastError:'Die persönliche Einladung wurde im privaten Kalender gelöscht.'},'calendar-invite:'+data.id);
   const result=await env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=?,last_error=?,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM portal_calendar_bridge WHERE run_id=? AND run_until>?)').bind(payload,'remote-cancelled','invitation_deleted',data.id,row.version,data.run,Date.now()).run();if(!result.meta.changes)fail('Einladung wurde gleichzeitig geändert.');return {ok:true};
  }
  if(['cancelling','finishing','finished'].includes(invitation.phase))return {ok:true,ignored:true};
  if(!target||target.fingerprint!==data.fingerprint||target.fingerprint!==invitation.fingerprint)return {ok:true,ignored:true};
  if(action==='observe'&&data.email!==target.email)fail('Die Kalenderantwort gehört nicht zur bestätigten Adresse.',400);
  if(action==='observe'&&invitation.phase==='active'&&invitation.googleStatus===data.googleStatus&&!invitation.lastError)return {ok:true};
  if(action==='observe'&&!['accepted','declined','tentative','needsAction'].includes(data.googleStatus))fail('Ungültige Kalenderantwort.',400);
  const authority='EXISTS(SELECT 1 FROM portal_calendar_bridge WHERE run_id=? AND run_until>?) AND EXISTS(SELECT 1 FROM portal_calendar_profiles p JOIN accounts a ON a.alias=p.alias AND a.revision=p.revision WHERE p.member=? AND p.version=?) AND COALESCE((SELECT version FROM portal_rules WHERE id=1),0)=? AND COALESCE((SELECT version FROM portal_groups WHERE id=1),0)=? AND EXISTS(SELECT 1 FROM portal_calendar WHERE id=1 AND fetched_at=?) AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=?)',authorityArgs=[data.run,Date.now(),target.member,target.profileVersion,state.calendar.rulesVersion||0,state.calendar.groupsVersion||0,state.calendar.fetchedAt,state.sequence];
  const mapped={accepted:'yes',declined:'excused',tentative:'maybe',needsAction:'open'},status=mapped[data.googleStatus],now=Date.now(),statements=[];let replyGuard='',replyArgs=[];
  if(!target.verification&&status&&data.googleStatus!==invitation.googleStatus){
   const old=await env.DB.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').bind(target.event,target.member).first(),previous=old?await L.open(env,old.payload,'portal-reply:'+target.event+':'+target.member):null;
   if(status!=='open'||previous?.source==='google'){
    const payload=await L.seal(env,{status,source:'google',requestId:'google:'+data.id,updatedAt:now},'portal-reply:'+target.event+':'+target.member);
    const guard=authority+' AND EXISTS(SELECT 1 FROM portal_calendar_invites WHERE id=? AND version=?)';
    statements.push(old?env.DB.prepare('UPDATE portal_replies SET payload=?,updated_at=?,version=version+1 WHERE event=? AND member=? AND version=? AND '+guard).bind(payload,now,target.event,target.member,old.version,...authorityArgs,data.id,row.version):env.DB.prepare('INSERT OR IGNORE INTO portal_replies(event,member,payload,updated_at) SELECT ?,?,?,? WHERE '+guard).bind(target.event,target.member,payload,now,...authorityArgs,data.id,row.version));
    replyGuard=' AND EXISTS(SELECT 1 FROM portal_replies WHERE event=? AND member=? AND payload=?)';replyArgs=[target.event,target.member,payload];
   }
  }
  const payload=await L.seal(env,{...invitation,phase:'active',delivered:true,googleStatus:data.googleStatus||invitation.googleStatus,lastError:null},'calendar-invite:'+data.id);
  statements.push(env.DB.prepare('UPDATE portal_calendar_invites SET payload=?,state=\'active\',last_error=NULL,version=version+1 WHERE id=? AND version=? AND '+authority+replyGuard).bind(payload,data.id,row.version,...authorityArgs,...replyArgs));
  const saved=await env.DB.batch(statements);if(saved.some(r=>!r.meta.changes))fail('Einladung oder Rückmeldung wurde gleichzeitig geändert. Bitte neu lesen.');
  return {ok:true};
 }
 async function managedEvents(env,member){
  const out=new Set(),p=await profile(env,member);if(!p?.allowed||!p.verified)return out;
  try{const record=await g.PortalService.assertAlias(env,p.alias);if(record.memberId!==member||record.revision!==p.revision)return out;}catch{return out;}
  for(const row of (await env.DB.prepare('SELECT * FROM portal_calendar_invites WHERE member=?').bind(member).all()).results){const item=await open(env,row,'calendar-invite:'+row.id);if(item.profileVersion===p.version&&(item.phase==='active'||item.delivered===true&&item.phase==='pending')&&!item.verification)out.add(row.event);}
  return out;
 }
 const managed=async(env,member,event)=>(await managedEvents(env,member)).has(event);
 g.CalendarInvitations={schema,settings,preference,bridge,managed,managedEvents,email};
})(globalThis);
