/* Members portal. Reuses scoped member credentials; all private payloads encrypted. */
(function(g){
 'use strict';const L=g.CentralLedger,DAY=86400000,fail=(message,status=409)=>{throw Object.assign(Error(message),{status});},checks=new WeakSet(),loads=new WeakMap();
 const ddl=[
  ...g.PortalEvidence.schema,
  ...g.PortalHydrants.schema,
  ...(g.WhatsAppPasskeys?.schema||[]),
  'CREATE TABLE IF NOT EXISTS portal_bonus_policy (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_rules (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_birthdays (member TEXT NOT NULL,year INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(member,year))',
  'CREATE TABLE IF NOT EXISTS portal_devices (id TEXT PRIMARY KEY)',
  'CREATE TABLE IF NOT EXISTS portal_roster (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_contacts (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_config (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,fetched_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_replies (event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(event,member))',
  "CREATE TABLE IF NOT EXISTS portal_sends (id TEXT PRIMARY KEY,event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',campaign TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL)",
  'CREATE INDEX IF NOT EXISTS portal_sends_created ON portal_sends(created_at)',
   'CREATE TABLE IF NOT EXISTS portal_browser_pairs (code_hash TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0)',
   'CREATE INDEX IF NOT EXISTS portal_browser_pairs_alias ON portal_browser_pairs(alias)',
   'CREATE TABLE IF NOT EXISTS portal_browser_sessions (token_hash TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,expires_at INTEGER NOT NULL)',
   'CREATE INDEX IF NOT EXISTS portal_browser_sessions_alias ON portal_browser_sessions(alias,revision)'
 ];
 async function ready(env){if(checks.has(env.DB))return;await env.DB.batch(ddl.map(sql=>env.DB.prepare(sql)));checks.add(env.DB);}
 const open=(env,row,purpose)=>row?L.open(env,row.payload,purpose):null;
 async function config(env){const c=await open(env,await env.DB.prepare('SELECT * FROM portal_config WHERE id=1').first(),'portal-config');return c?{...c,reminders:true}:null;}
 function calendarURL(value){let u;try{u=new URL(value);}catch{fail('Bitte den öffentlichen Google-iCal-Link eingeben.',400);}if(u.origin!=='https://calendar.google.com'||!/^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/.test(u.pathname)||u.search||u.hash||u.username||u.password)fail('Bitte die öffentliche iCal-Adresse aus Google Kalender verwenden.',400);return u.href;}
 async function download(url){
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'text/calendar'}});if(!response.ok)fail('Google-Kalender derzeit nicht erreichbar. Bitte später erneut prüfen.',503);
  if(Number(response.headers.get('content-length'))>2000000)fail('Der Kalender ist zu groß.',400);
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)fail('Der Kalender ist zu groß.',400);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);
 }
 async function projection(url){const raw=await download(url),items=g.PortalCalendar.parse(raw),events=[];for(const item of items){const {key,seriesKey,...rest}=item;events.push({id:await hash('h2o-event/v1:'+url+':'+key),seriesId:await hash('h2o-series/v1:'+url+':'+seriesKey),...rest});}return events;}
 async function calendar(env,force=false,configuration){
  const c=configuration===undefined?await config(env):configuration;if(!c)return {configured:false,events:[],fetchedAt:null,stale:true};
  const old=await env.DB.prepare('SELECT * FROM portal_calendar WHERE id=1').first();if(old&&!force&&old.fetched_at>Date.now()-300000)return {...await open(env,old,'portal-calendar'),configured:true,fetchedAt:old.fetched_at,stale:false};
  if(loads.has(env.DB))return loads.get(env.DB);
  const promise=(async()=>{try{const events=await projection(c.calendarUrl),fetchedAt=Date.now(),payload=await L.seal(env,{events},'portal-calendar');
    // A concurrent administrator change cannot publish the previous calendar.
    const current=await config(env);if(current?.calendarUrl!==c.calendarUrl)fail('Kalenderverbindung wurde geändert. Bitte aktualisieren.');
    await env.DB.prepare('INSERT INTO portal_calendar(id,payload,fetched_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').bind(payload,fetchedAt).run();return {configured:true,events,fetchedAt,stale:false};
   }catch(e){if(!old)throw e;return {...await open(env,old,'portal-calendar'),configured:true,fetchedAt:old.fetched_at,stale:true};}})();loads.set(env.DB,promise);try{return await promise;}finally{loads.delete(env.DB);}
 }
 function nameKey(value){return String(value).toLocaleLowerCase('de-DE').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]+/g)?.sort().join(' ')||'';}
 function detected(e,roster){
  if(e.birthdayHint){const title=e.title.replace(/geburtstag|birthday|geb\.|🎂/gi,' ').replace(/\b(?:von|happy)\b/gi,' '),key=nameKey(title),matches=(roster?.members||[]).filter(m=>nameKey(m.name)===key);return {kind:'birthday',sessionType:null,memberId:matches.length===1?matches[0].id:null};}
  return {kind:'probe',sessionType:!/sonderprobe/i.test(e.title)&&/(?:^|[\s-])probe(?:$|[\s:,-])|gesamtprobe|hauptprobe|übungsprobe/i.test(e.title)?'Probe':'Sonderprobe',memberId:null};
 }
 async function decorate(env,cal){const row=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,row,'portal-rules')||{},roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');return {...cal,rulesVersion:row?.version||0,events:cal.events.map(e=>{const rule=rules[e.id]||rules[e.seriesId],auto=detected(e,roster),kind=rule?.kind||auto.kind,sessionType=kind==='probe'?(rule?.sessionType||auto.sessionType||'Sonderprobe'):null,clothingValue=rule?.clothing??(kind==='probe'?(sessionType==='Probe'?'Einsatzkleidung':'Tagesdienst'):'');return {...e,location:rule?.location??(e.location||'GH Wasser'),kind,sessionType,clothing:clothingValue==='Tagdienst'?'Tagesdienst':clothingValue==='Einsatz'?'Einsatzkleidung':clothingValue,automatic:!rule,approved:rule?.kind==='probe'&&rule.approved===true,memberId:kind==='birthday'?(rule?rule.memberId||null:auto.memberId):null,recipientIds:kind==='probe'&&Array.isArray(rule?.recipientIds)?rule.recipientIds:null,attendanceType:kind==='probe'?(rule?.attendanceType|| (sessionType==='Probe'?'Allgemeine Probe':'Sonderprobe')):null};})};}
 function isRecipient(event,memberId){return !Array.isArray(event.recipientIds)||event.recipientIds.includes(memberId);}
 function memberEvent(event){const {recipientIds,...visible}=event;return {...visible,audienceRestricted:Array.isArray(recipientIds)};}
 async function classify(env,data,cal,roster){
  if(data.sessionType!==undefined&&!['Probe','Sonderprobe'].includes(data.sessionType))fail('Ungültige Terminart.',400);if(!['probe','birthday','other'].includes(data.kind)||typeof data.approved!=='boolean'||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Terminfreigabe.',400);const event=cal.events.find(e=>e.id===data.eventId);if(!event)fail('Termin nicht mehr verfügbar.',404);if(cal.stale)fail('Kalender konnte nicht aktuell geprüft werden.',503);
  if(data.kind==='birthday'&&data.memberId&&!roster?.members.some(m=>m.id===data.memberId))fail('Bitte den Geburtstag einem aktuellen Mitglied zuordnen.',400);
  const targetType=data.kind==='probe'?(data.sessionType||event.sessionType||'Sonderprobe'):null;
  if(data.clothing!==undefined&&(typeof data.clothing!=='string'||data.clothing.trim().length>120||/[\x00-\x1f\x7f]/.test(data.clothing)))fail('Bitte Kleidung als Text mit höchstens 120 Zeichen eingeben.',400);
  if(data.location!==undefined&&(typeof data.location!=='string'||!data.location.trim()||data.location.trim().length>300||/[\x00-\x1f\x7f]/.test(data.location)))fail('Bitte einen Ort mit 1 bis 300 Zeichen eingeben.',400);
  const location=data.location===undefined?(event.location||'GH Wasser'):data.location.trim();
  const clothingInput=data.kind==='birthday'?'':data.clothing===undefined?(event.clothing??(targetType==='Probe'?'Einsatzkleidung':targetType==='Sonderprobe'?'Tagesdienst':'')):data.clothing.trim();
  const clothing=clothingInput==='Tagdienst'?'Tagesdienst':clothingInput==='Einsatz'?'Einsatzkleidung':clothingInput;
  const attendanceType=data.kind==='probe'?(data.attendanceType||event.attendanceType||(targetType==='Probe'?'Allgemeine Probe':'Sonderprobe')):null;
  if(data.attendanceType!==undefined&&data.kind!=='probe')fail('Eine iPad-Terminart kann nur Proben und Sonderproben zugeordnet werden.',400);
  if(data.kind==='probe'&&!['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung','Einsatz'].includes(attendanceType))fail('Ungültige iPad-Terminart.',400);
  if(data.recipientIds!==undefined&&data.recipientIds!==null){
   if(data.kind!=='probe'||!Array.isArray(data.recipientIds)||!data.recipientIds.length||data.recipientIds.length>500||new Set(data.recipientIds).size!==data.recipientIds.length||!roster?.members||data.recipientIds.some(id=>typeof id!=='string'||!roster.members.some(m=>m.id===id)))fail('Bitte gültige Mitglieder für diesen Termin auswählen.',400);
  }
  const old=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,old,'portal-rules')||{};if((old?.version||0)!==data.expectedVersion)fail('Terminfreigaben wurden inzwischen geändert. Bitte neu laden.');
  if(data.kind==='birthday'){rules[event.seriesId]={kind:'birthday',memberId:data.memberId||null};delete rules[event.id];}else rules[event.id]={kind:data.kind,approved:data.kind==='probe'&&data.approved,expiresAt:event.end,location,clothing,...(data.kind==='probe'?{sessionType:targetType,attendanceType,...(Array.isArray(data.recipientIds)?{recipientIds:data.recipientIds}:{} )}:{})};
  const payload=await L.seal(env,rules,'portal-rules'),result=old?await env.DB.prepare('UPDATE portal_rules SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_rules(id,payload) VALUES(1,?)').bind(payload).run();if(!result.meta.changes)fail('Freigabe wurde gleichzeitig geändert. Bitte neu laden.');return {ok:true,version:data.expectedVersion+1,recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1,attendanceType,recipientIds:data.kind==='probe'&&Array.isArray(data.recipientIds)?data.recipientIds:null};
 }
 async function birthdayPolicy(env){const row=await env.DB.prepare('SELECT * FROM portal_bonus_policy WHERE id=1').first();return {row,value:await open(env,row,'portal-birthday-policy')||{revision:'birthday-default-v1',awardUnits:150}};}
 async function saveBirthdayPolicy(env,data){
  if(!REV.test(data.revision||'')||!Number.isSafeInteger(data.awardUnits)||data.awardUnits<150||data.awardUnits>15000||data.awardUnits%150)fail('Bitte 1 bis 100 ganze Geburtstagspunkte eingeben.',400);const old=await birthdayPolicy(env);
  if(old.value.revision===data.revision){if(old.value.awardUnits!==data.awardUnits)fail('Diese Bonusversion wurde bereits anders verwendet.');return {birthdayPolicy:old.value};}
  if(data.expectedRevision!==old.value.revision)fail('Geburtstagspunkte wurden inzwischen geändert. Bitte neu laden.');const policy={revision:data.revision,awardUnits:data.awardUnits},payload=await L.seal(env,policy,'portal-birthday-policy'),result=old.row?await env.DB.prepare('UPDATE portal_bonus_policy SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.row.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_bonus_policy(id,payload) VALUES(1,?)').bind(payload).run();if(!result.meta.changes)fail('Geburtstagspunkte wurden gleichzeitig geändert. Bitte erneut prüfen.');return {birthdayPolicy:policy};
 }
 let berlinDayFormatter;
 const berlinDay=ms=>(berlinDayFormatter??=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'})).format(new Date(ms));
 async function awardBirthdays(env,cal){
  const today=berlinDay(Date.now()),birthdays=cal.events.filter(e=>e.kind==='birthday'&&e.memberId&&berlinDay(e.start)===today);
  if(!birthdays.length)return 0; // Ordinary minutes need no birthday database reads or decryption.
  const year=Number(today.slice(0,4)),rosterRow=await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),roster=await open(env,rosterRow,'portal-roster'),ruleRow=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first();if(!roster||!ruleRow)return 0;
  const policy=await birthdayPolicy(env);const awarded=new Set((await env.DB.prepare('SELECT member FROM portal_birthdays WHERE year=?').bind(year).all()).results.map(r=>r.member));let processed=0;
  for(const e of birthdays){if(awarded.has(e.memberId)||!roster.members.some(m=>m.id===e.memberId))continue;if(processed>=2)break;
   const m=await L.meta(env);L.active(m);const current=await L.read(env,e.memberId),booking={id:'birthday-'+year,type:'birthday-reward',confirmation:'birthday',year,cents:policy.value.awardUnits,createdAt:new Date(Date.now()).toISOString()},next=g.DrinksModel.appendBirthdayReward(current.account,booking),marker=await L.seal(env,{eventId:e.id,awardUnits:policy.value.awardUnits,awardedAt:Date.now()},'birthday:'+e.memberId+':'+year),payload=await L.seal(env,next,'ledger:'+e.memberId),guard='EXISTS(SELECT 1 FROM portal_birthdays WHERE member=? AND year=? AND payload=?)';
   const first=env.DB.prepare("INSERT OR IGNORE INTO portal_birthdays(member,year,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state='active') AND EXISTS(SELECT 1 FROM portal_rules WHERE id=1 AND payload=?) AND EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?) AND "+(policy.row?'EXISTS(SELECT 1 FROM portal_bonus_policy WHERE id=1 AND payload=?)':'NOT EXISTS(SELECT 1 FROM portal_bonus_policy WHERE id=1)')+' AND '+(current.version?'EXISTS(SELECT 1 FROM ledgers WHERE member=? AND version=?)':'NOT EXISTS(SELECT 1 FROM ledgers WHERE member=?)')).bind(e.memberId,year,marker,m.seq,ruleRow.payload,rosterRow.payload,...(policy.row?[policy.row.payload]:[]),e.memberId,...(current.version?[current.version]:[]));
   const write=current.version?env.DB.prepare('UPDATE ledgers SET payload=?,version=version+1 WHERE member=? AND '+guard).bind(payload,e.memberId,e.memberId,year,marker):env.DB.prepare('INSERT INTO ledgers(member,payload,version) SELECT ?,?,1 WHERE '+guard).bind(e.memberId,payload,e.memberId,year,marker);
   const results=await env.DB.batch([first,write,env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND '+guard).bind(e.memberId,year,marker)]);if(results[0].meta.changes){processed++;awarded.add(e.memberId);}
  }return processed;
 }
 
  async function assertMember(env,record){
   await ready(env);
  const roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');
   if(!roster||!Array.isArray(roster.members)||!roster.members.some(m=>m.id===record.memberId))fail('Dieser Portalzugang ist nicht mehr freigegeben.',403);
   return record;
  }
  async function assertAlias(env,alias){
   if((await L.meta(env))?.state!=='active')return; // Preserve pre-central reminder mode.
   const row=await env.DB.prepare('SELECT a.* FROM ledger_access a JOIN accounts c ON c.alias=a.alias AND c.revision=a.revision WHERE a.alias=?').bind(alias).first();
   if(!row)fail('Handyzugang wurde gesperrt oder ersetzt.',401);
   return assertMember(env,await L.open(env,row.payload,'access:'+alias));
  }
  async function actor(env,data,auth,path){
  if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||''))fail('Ungültiger Portalzugang.',400);
  const row=await env.DB.prepare('SELECT a.* FROM ledger_access a JOIN accounts c ON c.alias=a.alias AND c.revision=a.revision WHERE a.alias=? AND a.revision=?').bind(data.alias,data.revision).first();
  if(!row)fail('Portalzugang wurde geändert. Bitte den persönlichen QR-Code erneut öffnen.',401);
   const identity=await g.WhatsAppPasskeys?.session(env,auth);
   if(identity){if(identity.record.alias!==data.alias||identity.record.revision!==data.revision)fail('Falsches Mitglied.',401);return identity.record;}
   fail('Bitte mit deinem H₂O-Passkey anmelden.',401);
 }
 async function replyFor(env,event,member){const row=await env.DB.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').bind(event,member).first();return {status:row?(await open(env,row,'portal-reply:'+event+':'+member)).status:'open',version:row?.version||0};}
 async function recipients(env){const rows=(await env.DB.prepare('SELECT a.* FROM ledger_access a JOIN accounts c ON c.alias=a.alias AND c.revision=a.revision WHERE EXISTS(SELECT 1 FROM devices d JOIN portal_devices p ON p.id=d.id WHERE d.alias=a.alias AND d.revision=a.revision)').all()).results,result=new Map();for(const row of rows){const record=await L.open(env,row.payload,'access:'+row.alias);if(!result.has(record.memberId))result.set(record.memberId,[]);result.get(record.memberId).push(record);}return result;}
 async function send(env,event,mode,requestId){
  let accepted=0,failed=0,excused=0,duplicate=0,processed=0;const people=await recipients(env),campaign=mode==='auto'?String(event.start):requestId,already=new Set((await env.DB.prepare('SELECT member FROM portal_sends WHERE event=? AND campaign=?').bind(event.id,campaign).all()).results.map(r=>r.member)),roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');let remaining=0;const replyRows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,statuses=new Map();for(const row of replyRows)statuses.set(row.member,(await open(env,row,'portal-reply:'+event.id+':'+row.member)).status);
  for(const [member,records] of people){
   if(roster&&!roster.members.some(m=>m.id===member))continue;if(!isRecipient(event,member))continue;if(already.has(member)){duplicate++;continue;}
   if(statuses.get(member)==='excused'){excused++;continue;}if(processed>=2){remaining++;continue;}processed++;
   const id=await hash('portal-send:'+event.id+':'+member+':'+(mode==='auto'?event.start:requestId)),now=Date.now(),payload=await L.seal(env,{event:memberEvent(event),status:'reminder'},'portal-send:'+id);
   // Claim before delivery: ambiguous network responses are never sent a second time.
   const claim=await env.DB.prepare("INSERT OR IGNORE INTO portal_sends(id,event,member,payload,status,campaign,created_at) SELECT ?,?,?,?,'pending',?,? WHERE NOT EXISTS(SELECT 1 FROM portal_sends WHERE member=? AND created_at>?)").bind(id,event.id,member,payload,campaign,now,member,now-60000).run();if(!claim.meta.changes){duplicate++;continue;}
   let a=0,f=0;
   for(const record of records){const devices=(await env.DB.prepare('SELECT d.id,d.endpoint FROM devices d JOIN portal_devices p ON p.id=d.id WHERE alias=? AND revision=? LIMIT 5').bind(record.alias,record.revision).all()).results;
    for(const device of devices){
     if((await replyFor(env,event.id,member)).status==='excused')continue;
     try{const url=endpoint(device.endpoint),res=await fetch(url,{method:'POST',headers:{Authorization:await vapid(env,url),TTL:String(Math.max(60,Math.min(86400,Math.floor((event.start-Date.now())/1000)))),Urgency:'normal',Topic:'h2o-portal'},body:null,redirect:'manual',signal:AbortSignal.timeout(8000)});if(res.ok)a++;else{f++;if([404,410].includes(res.status))await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(device.id,record.alias).run();}}catch{f++;}
    }
   }
   await env.DB.prepare('UPDATE portal_sends SET status=? WHERE id=?').bind(a?'accepted':f?'failed':'skipped',id).run();accepted+=a;failed+=f;
  }
  return {accepted,failed,excused,duplicate,remaining};
 }
 // Completed calendar events are no longer managed in H₂O. Keep their replies
 // for six hours after the end so an ongoing iPad attendance session can
 // finish. Never remove recurring birthday assignments or the Google source.
 async function pruneFinishedEvents(env,cal,now=Date.now()){
  const cutoff=now-6*3600000,ruleCutoff=now-31*DAY,currentEvents=new Map(cal.events.map(e=>[e.id,e]));
  const expired=cal.events.filter(e=>e.kind!=='birthday'&&Number.isFinite(e.end)&&e.end<=cutoff).slice(0,100);
  const obsoleteIds=new Set(expired.map(e=>e.id));
  const row=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first();
  if(row){
   const rules=await open(env,row,'portal-rules')||{};
   let changed=false;
   for(const [id,rule] of Object.entries(rules)){
    if(!rule||rule.kind==='birthday')continue; // Series-wide birthdays remain valid for coming years.
    // A moved event keeps its identity; its current end supersedes the saved expiry.
    const expiresAt=currentEvents.has(id)?currentEvents.get(id).end:rule.expiresAt;
    if(Number.isFinite(expiresAt)&&expiresAt<=ruleCutoff){
     delete rules[id];changed=true;
    }
   }
   if(changed){
    const payload=await L.seal(env,rules,'portal-rules');
    // If another administrator saved rules concurrently, preserve their edits.
    // The next Cron pass will retry cleanup using the newest version.
    const result=await env.DB.prepare('UPDATE portal_rules SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,row.version).run();
    if(!result.meta.changes)return;
   }
  }
  for(const id of obsoleteIds)await env.DB.prepare('DELETE FROM portal_replies WHERE event=?').bind(id).run();
 }
 async function scheduled(env){
  await ready(env);const c=await config(env);if(!c)return;const cal=await decorate(env,await calendar(env,false,c));if(cal.stale)return;
  await pruneFinishedEvents(env,cal);
  await env.DB.prepare('DELETE FROM portal_sends WHERE created_at<?').bind(Date.now()-30*DAY).run();
  await env.DB.prepare('DELETE FROM portal_replies WHERE updated_at<?').bind(Date.now()-400*DAY).run();
  if(await awardBirthdays(env,cal))return;
  const now=Date.now(),due=cal.events.filter(event=>{const at=event.start-c.leadHours*3600000;return event.approved&&event.kind==='probe'&&!event.allDay&&event.start>now&&at<=now&&at>now-3600000;});if(due.length)await send(env,due[Math.floor(now/60000)%due.length],'auto');
 }
 async function route(path,data,env,auth,clientIP='unknown'){
  await ready(env);const m=await L.meta(env);L.active(m);const admin=path.startsWith('/admin/');
   if(path==='/admin/portal/identity-ticket'){L.source(m,data);return g.WhatsAppPasskeys.admin(env,data);}
   if(path.startsWith('/portal/passkey/')){if(/\/(options|verify)$/.test(path))await g.WhatsAppPasskeys.limit(env,clientIP);const action=path.slice('/portal/passkey/'.length);if(action.startsWith('portal/')||action.startsWith('enroll/')||['session','logout','devices','remove','sessions/revoke'].includes(action))return g.WhatsAppPasskeys.identity(action,data,env,auth);fail('Bitte die zentrale H₂O-Passkey-Anmeldung verwenden.',401);}
   if(path.startsWith('/portal/browser/'))fail('Bitte die zentrale H₂O-Passkey-Anmeldung verwenden.',401);
   let record;if(admin)L.source(m,data);else record=await actor(env,data,auth,path);
  if(path.startsWith('/portal/passkey/'))return g.WhatsAppPasskeys.route(path.slice('/portal/passkey/'.length),data,env,record);
  if(path.startsWith('/portal/hydrants/')||path.startsWith('/admin/portal/hydrants/'))return g.PortalHydrants.route(path,data,env,admin);
  const rosterRow=await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),roster=await open(env,rosterRow,'portal-roster');
  if(path.startsWith('/portal/theater/')||path.startsWith('/admin/portal/theater/'))return g.TheaterService.route(path,data,env,admin,record,roster);
  if(path==='/admin/portal/contacts'){
   const contacts=data.contacts;
   if(!contacts||contacts.schemaVersion!==1||!Array.isArray(contacts.groups)||contacts.groups.length>12||JSON.stringify(contacts).length>16000)fail('Ungültiges Kontaktverzeichnis.',400);
   const safe=v=>typeof v==='string'&&v.length<=180&&!/[\x00-\x1f<>]/.test(v);
   if(!safe(contacts.title)||!safe(contacts.businessHours)||!safe(contacts.sourceDate)||contacts.groups.some(group=>!safe(group.title)||!Array.isArray(group.contacts)||group.contacts.length>25||group.contacts.some(p=>!safe(p.name)||!safe(p.role||'')||['phone','mobile','email'].some(k=>p[k]!==undefined&&!safe(p[k])))))fail('Kontaktdaten nicht gültig.',400);
   const payload=await L.seal(env,contacts,'portal-contacts');
   await env.DB.prepare('INSERT INTO portal_contacts(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(payload,Date.now()).run();
   return {ok:true,updatedAt:Date.now()};
  }
  if(path==='/portal/contacts'){
   const row=await env.DB.prepare('SELECT * FROM portal_contacts WHERE id=1').first();
   return {contacts:await open(env,row,'portal-contacts'),updatedAt:row?.updated_at||null};
  }
  if(path==='/admin/portal/roster'){
   if(!Array.isArray(data.members)||data.members.length>500||new Set(data.members.map(m=>m.id)).size!==data.members.length||data.members.some(m=>typeof m.id!=='string'||!m.id||m.id.length>200||typeof m.name!=='string'||!m.name.trim()||m.name.length>200||typeof m.leader!=='boolean'||m.agt!==undefined&&m.agt!==null&&typeof m.agt!=='boolean'))fail('Ungültige Mitgliederfreigabe.',400);
   let people;try{people=data.members.map(m=>({id:m.id,name:m.name,firstName:typeof m.firstName==='string'?m.firstName.slice(0,100):'',whatsapp:roster?.members.find(p=>p.id===m.id)?.whatsapp||null,leader:m.leader,agt:m.agt===true?true:m.agt===false?false:null,...(m.evidence!==undefined?{evidence:g.MemberEvidence.validate(m.evidence),evidenceUpdatedAt:Date.now()}:(()=>{const old=roster?.members.find(p=>p.id===m.id);return old?.evidence?{evidence:old.evidence,evidenceUpdatedAt:old.evidenceUpdatedAt||null}:{};})())}));}catch(e){fail(e.message,400);}people=people.map(person=>({...person,evidenceRevisions:g.PortalEvidence.revisions(person,roster?.members.find(old=>old.id===person.id))}));const payload=await L.seal(env,{members:people,updatedAt:Date.now(),agtSource:data.agtSource==='member-checkbox'?'member-checkbox':null},'portal-roster');
   // A roster change and every credential revocation are one transaction.
   // The sequence CAS also invalidates ledger/game writes started before removal.
   const marker='EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?)';
   const statements=[env.DB.prepare('INSERT INTO portal_roster(id,payload) SELECT 1,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(payload,m.seq)];
   const activeMembers=new Set(people.map(p=>p.id));
   const removed=new Set((roster?.members||[]).map(p=>p.id).filter(id=>!activeMembers.has(id)));
   const linked=(await env.DB.prepare('SELECT alias,revision,payload FROM ledger_access').all()).results;
   const revoked=[];
   for(const row of linked){
    const owner=await L.open(env,row.payload,'access:'+row.alias);
    if(activeMembers.has(owner.memberId))continue;
    // Include orphaned aliases even when an older roster was missing.
    removed.add(owner.memberId);
    revoked.push(row.alias);
   }
   if(revoked.length){
    // One JSON parameter keeps even bulk removals within D1 bind/query limits.
    const aliases=JSON.stringify(revoked),scope='alias IN (SELECT value FROM json_each(?)) AND '+marker;
    for(const table of ['accounts','ledger_access'])statements.push(env.DB.prepare('INSERT OR IGNORE INTO retired(alias,revision) SELECT alias,revision FROM '+table+' WHERE '+scope).bind(aliases,payload));
    for(const table of ['portal_identity_sessions','portal_identity_grants','portal_identity_tickets','portal_passkeys','portal_passkey_challenges','portal_browser_sessions','portal_browser_pairs','devices','ledger_access','accounts'])statements.push(env.DB.prepare('DELETE FROM '+table+' WHERE '+scope).bind(aliases,payload));
    statements.push(env.DB.prepare("UPDATE commands SET status='rejected',result='accessChanged',envelope='' WHERE status='pending' AND "+scope).bind(aliases,payload));
   }
   statements.push(env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND '+marker).bind(m.seq,payload));
   const result=await env.DB.batch(statements);
   if(!result[0].meta.changes)fail('Mitglieder oder Konten wurden gleichzeitig geändert. Bitte erneut synchronisieren.',409);
   return {ok:true,evidenceVersion:1,removedBrowserMembers:removed.size};
  }
   // Separate GF-only view; browser tokens are rejected by actor() for this path.
   if(path==='/portal/gf-breathing'){
    if(!roster?.members?.some(m=>m.id===record.memberId&&m.leader===true))fail('Diese Übersicht ist nur für Gruppenführer freigegeben.',403);
    const now=Date.now(),people=[],uncertain=[],limit=now-7*DAY;
    const evidenceRows=await g.PortalEvidence.rows(env);
    // Older projections could infer membership from roles. Require a fresh checkbox-only projection.
    if(roster.agtSource!=='member-checkbox')return {people,uncertain,stale:true,assignmentSyncRequired:true,syncedAt:roster.updatedAt||null,servedAt:now};
    for(const member of roster.members){
     if(member.agt!==true)continue;
     const merged=await g.PortalEvidence.view(env,member,roster,evidenceRows),e=merged.evidence?.breathing,details={version:1,medical:{g262:'',g263:e?.g263||''},breathing:{g263:e?.g263||'',instruction:e?.instruction||'',ffi:e?.ffi||''},driver:null};
     const assessment=g.MemberEvidence.assess(details,now).find(group=>group.title==='Atemschutz');
     const keys=['g263','instruction','ffi'],items=assessment.items.map((item,i)=>({label:item.label,until:item.until,status:item.status,source:merged.entries[keys[i]].source,updatedAt:merged.entries[keys[i]].updatedAt}));
     const status=items.some(item=>['expired','missing'].includes(item.status))?'check':items.some(item=>item.status==='soon')?'soon':'valid';
     people.push({name:member.name,status,items});
    }
    const stale=!roster.updatedAt||roster.updatedAt<limit||roster.members.some(member=>member.agt===true&&(!member.evidenceUpdatedAt||member.evidenceUpdatedAt<limit));
    return {people,uncertain,stale,syncedAt:roster.updatedAt||null,servedAt:now};
   }
   if(path==='/portal/evidence'||path==='/portal/evidence/report'){
    const own=roster?.members.find(member=>member.id===record.memberId);
    return path.endsWith('/report')?g.PortalEvidence.write(env,own,roster,data,false,m):g.PortalEvidence.read(env,own,roster);
   }
   if(path==='/admin/portal/evidence'||path==='/admin/portal/evidence/review'){
    const member=roster?.members.find(person=>person.id===data.memberId);
    return path.endsWith('/review')?g.PortalEvidence.write(env,member,roster,data,true,m):g.PortalEvidence.read(env,member,roster);
   }
  if(path==='/admin/portal/birthday-status')return {birthdayPolicy:(await birthdayPolicy(env)).value};
  if(path==='/admin/portal/birthday-policy')return saveBirthdayPolicy(env,data);
  if(path==='/admin/portal/config'){
   const c=await config(env);return {configured:!!c,config:c||null};
  }
  if(path==='/admin/portal/configure'){
   const url=calendarURL(data.calendarUrl);if(![1,2,6,12,24,48].includes(data.leadHours))fail('Ungültige Erinnerungseinstellungen.',400);
   const old=await config(env);if(old&&old.calendarUrl!==url)fail('Ein Kalenderwechsel würde die Terminzuordnung ändern. Bitte den vorhandenen Kalender weiterverwenden.');
   const events=await projection(url),c={calendarUrl:url,reminders:true,leadHours:data.leadHours},payload=await L.seal(env,c,'portal-config'),cal=await L.seal(env,{events},'portal-calendar');
   await env.DB.batch([env.DB.prepare('INSERT INTO portal_config(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=version+1').bind(payload),env.DB.prepare('INSERT INTO portal_calendar(id,payload,fetched_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').bind(cal,Date.now())]);return {ok:true,count:events.length};
  }
  if(path==='/portal/subscribe'||path==='/portal/unsubscribe'){
   const url=endpoint(data.endpoint),id=await hash(url);if(path.endsWith('/unsubscribe')){await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(id,data.alias).run();return {ok:true};}
   const old=await env.DB.prepare('SELECT alias FROM devices WHERE id=?').bind(id).first();if(old&&old.alias!==data.alias)fail('Auf diesem Handy zuerst die Erinnerungen des anderen Mitglieds deaktivieren.');
   const saved=await env.DB.prepare('INSERT INTO devices(id,alias,revision,endpoint) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE alias=?)<5 ON CONFLICT(id) DO UPDATE SET revision=excluded.revision').bind(id,data.alias,data.revision,url,data.alias).run();if(!saved.meta.changes&&!old)fail('Maximal fünf Geräte pro Mitglied.');await env.DB.prepare('INSERT OR IGNORE INTO portal_devices(id) VALUES(?)').bind(id).run();return {ok:true};
  }
  if(path==='/portal/notification'){
   const row=await env.DB.prepare("SELECT * FROM portal_sends WHERE member=? AND status IN ('pending','accepted') AND created_at>? ORDER BY created_at DESC LIMIT 1").bind(record.memberId,Date.now()-DAY).first();if(!row)return {event:null};const value=await open(env,row,'portal-send:'+row.id),cal=await decorate(env,await calendar(env)),event=cal.events.find(e=>e.id===value.event.id&&e.approved&&e.kind==='probe'&&isRecipient(e,record.memberId));
   return {event:event&&event.start>Date.now()&&(await replyFor(env,event.id,record.memberId)).status!=='excused'?memberEvent(event):null};
  }
  const cal=await decorate(env,await (['/portal/list','/admin/portal/list','/portal/reply','/portal/overview','/admin/portal/replies'].includes(path)?cachedCalendar(env,15*60*1000,path==='/portal/list'):calendar(env)));
  if(path==='/admin/portal/classify')return classify(env,data,cal,roster);
  if(path==='/portal/list'){
   const ownBirthday=cal.events.some(e=>e.kind==='birthday'&&e.memberId===record.memberId&&berlinDay(e.start)===berlinDay(Date.now())),birthdayRow=ownBirthday?await env.DB.prepare('SELECT * FROM portal_birthdays WHERE member=? AND year=?').bind(record.memberId,Number(berlinDay(Date.now()).slice(0,4))).first():null,birthday=ownBirthday?{today:true,awarded:!!birthdayRow,awardUnits:birthdayRow?(await open(env,birthdayRow,'birthday:'+record.memberId+':'+berlinDay(Date.now()).slice(0,4))).awardUnits:(await birthdayPolicy(env)).value.awardUnits}:null;const replies=(await env.DB.prepare('SELECT * FROM portal_replies WHERE member=?').bind(record.memberId).all()).results,map=new Map();for(const row of replies)map.set(row.event,{status:(await open(env,row,'portal-reply:'+row.event+':'+record.memberId)).status,version:row.version,updatedAt:row.updated_at||null});const requestedId=typeof data.eventId==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.eventId)?data.eventId:null;const requestedEvent=requestedId?cal.events.find(e=>e.id===requestedId):null;const eventLinkStatus=!requestedId?null:requestedEvent?.approved&&requestedEvent.kind==='probe'&&requestedEvent.end>Date.now()?(isRecipient(requestedEvent,record.memberId)?null:'not-relevant'):'unavailable';return {...cal,eventLinkStatus,memberName:roster?.members.find(m=>m.id===record.memberId)?.name||'',uncertainReplies:true,birthday,leader:roster?.members.some(m=>m.id===record.memberId&&m.leader)===true,events:cal.events.filter(e=>e.approved&&e.kind==='probe'&&e.end>Date.now()&&isRecipient(e,record.memberId)).map(e=>({...memberEvent(e),...(map.get(e.id)||{status:'open',version:0})}))};
  }
  if(path==='/admin/portal/list')return {...cal,recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1};
  const whatsappAction=path.match(/^\/(?:admin\/)?portal\/whatsapp-(events|recipients|prepare|contact)$/)?.[1];
  if(whatsappAction){
   if(!admin&&!roster?.members.some(p=>p.id===record.memberId&&p.leader===true))fail('Nur für berechtigte Gruppenführer freigegeben.',403);
   if(cal.stale)fail('Kalender konnte nicht aktuell geprüft werden.',503);
   if(whatsappAction==='events')return {events:cal.events.filter(e=>e.approved&&e.kind==='probe'&&e.start>Date.now()&&(admin||isRecipient(e,record.memberId))).map(memberEvent)};
  }

  const event=cal.events.find(e=>e.id===data.eventId&&(e.approved&&e.kind==='probe')&&(admin||isRecipient(e,record.memberId)));if(!event)fail('Termin wurde abgesagt oder ist nicht mehr im Kalender.',404);
  if(path==='/portal/overview'){
   if(!roster?.members.some(m=>m.id===record.memberId&&m.leader))fail('Diese Übersicht ist nur für hinterlegte Gruppenführer freigegeben.',403);
   const rows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,statuses=new Map();for(const row of rows)statuses.set(row.member,(await open(env,row,'portal-reply:'+event.id+':'+row.member)).status);
   return {event:memberEvent(event),stale:cal.stale,members:roster.members.filter(m=>isRecipient(event,m.id)).map(m=>({name:m.name,status:statuses.get(m.id)||'open'}))};
  }
  if(path==='/admin/portal/replies'){
   const rows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,replies=[];for(const row of rows)if(isRecipient(event,row.member))replies.push({memberId:row.member,...await open(env,row,'portal-reply:'+row.event+':'+row.member)});return {event,replies,stale:cal.stale,fetchedAt:cal.fetchedAt};
  }
  if(cal.stale)fail('Kalender konnte nicht aktuell geprüft werden. Bitte später erneut versuchen.',503);
  if(event.start<=Date.now())fail('Der Termin hat bereits begonnen. Änderungen bitte am Gerätehaus-iPad erfassen.');
  if(whatsappAction){
   if(whatsappAction==='contact'){
    if(!admin)fail('Kontakte dürfen nur durch die Verwaltung geändert werden.',403);
    const person=roster?.members.find(p=>p.id===data.memberId&&isRecipient(event,p.id));
    if(!person)fail('Mitglied nicht mehr eingeladen.',404);
    if(typeof data.phone!=='string'||data.phone.length>40||typeof data.allowed!=='boolean')fail('Ungültige Kontaktdaten.',400);
    const phone=data.phone.replace(/[\s()\-]/g,'').replace(/^00/,'+');
    if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))fail('Bitte eine internationale Nummer mit + und Ländervorwahl eingeben.',400);
    person.whatsapp=phone?{phone:phone.slice(1),allowed:data.allowed,updatedAt:Date.now()}:null;
    const payload=await L.seal(env,roster,'portal-roster');
    const saved=await env.DB.batch([env.DB.prepare('UPDATE portal_roster SET payload=? WHERE id=1 AND payload=? AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=?)').bind(payload,rosterRow.payload,m.seq),env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?)').bind(m.seq,payload)]);
    if(!saved[0].meta.changes)fail('Mitglieder wurden gleichzeitig geändert. Bitte erneut prüfen.',409);
    return {ok:true};
   }
   const people=[],statuses=new Map();
   const rows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results;
   for(const row of rows)statuses.set(row.member,(await open(env,row,'portal-reply:'+event.id+':'+row.member)).status);
   for(const person of roster?.members||[]){
    if(!isRecipient(event,person.id)||whatsappAction==='prepare'&&person.id!==data.memberId)continue;
    const status=statuses.get(person.id)||'open',eligible=['open','maybe'].includes(status),contact=person.whatsapp;
    people.push({id:person.id,name:person.name,firstName:person.firstName||'',status,eligible,phone:eligible&&contact?.allowed===true&&/^[1-9]\d{7,14}$/.test(contact.phone)?contact.phone:null,...(admin?{contactPhone:contact?.phone?'+'+contact.phone:'',allowed:contact?.allowed===true}:{})});
   }
   if(whatsappAction==='prepare')return {event:memberEvent(event),eligible:people[0]?.eligible===true,phone:people[0]?.phone||null};
   return {event:memberEvent(event),members:people};
  }
  if(path==='/admin/portal/remind'){
   if(!REV.test(data.requestId||''))fail('Ungültige Versandkennung.',400);return send(env,event,'manual',data.requestId);
  }
  if(path==='/portal/reply'){
   if(!['yes','excused','maybe','open'].includes(data.status)||!REV.test(data.requestId||'')||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Rückmeldung.',400);
   const old=await env.DB.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').bind(event.id,record.memberId).first(),previous=await open(env,old,'portal-reply:'+event.id+':'+record.memberId);
   if(previous?.requestId===data.requestId){if(previous.status!==data.status)fail('Vorgangsnummer wurde bereits anders verwendet.');return {ok:true,status:previous.status,version:old.version,updatedAt:old.updated_at||null};}
   if((old?.version||0)!==data.expectedVersion)fail('Deine Rückmeldung wurde inzwischen geändert. Bitte aktualisieren.');
   const updatedAt=Date.now(),payload=await L.seal(env,{status:data.status,requestId:data.requestId,updatedAt},'portal-reply:'+event.id+':'+record.memberId);
   const result=old?await env.DB.prepare('UPDATE portal_replies SET payload=?,updated_at=?,version=version+1 WHERE event=? AND member=? AND version=?').bind(payload,updatedAt,event.id,record.memberId,old.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_replies(event,member,payload,updated_at) VALUES(?,?,?,?)').bind(event.id,record.memberId,payload,updatedAt).run();if(!result.meta.changes)fail('Rückmeldung wurde gleichzeitig geändert. Bitte aktualisieren.');return {ok:true,status:data.status,version:data.expectedVersion+1,updatedAt};
  }
  fail('Nicht gefunden.',404);
 }
 // Use the synchronized snapshot for reads and replies with the same freshness limit.
 // Opening the member calendar can refresh an expired snapshot if Cron missed a run.
 // Reply and overview requests never wait for Google.
 async function cachedCalendar(env,maxAgeMs=15*60*1000,refreshExpired=false){
  const c=await config(env);
  if(!c)return {configured:false,events:[],fetchedAt:null,stale:true};
  const row=await env.DB.prepare('SELECT * FROM portal_calendar WHERE id=1').first();
  if(!row||refreshExpired&&(!row.fetched_at||row.fetched_at<Date.now()-maxAgeMs))return calendar(env);
  return {...await open(env,row,'portal-calendar'),configured:true,fetchedAt:row.fetched_at,
   stale:!row.fetched_at||row.fetched_at<Date.now()-maxAgeMs};
 }
 async function publicCalendar(env){
  await ready(env);
  const cal=await decorate(env,await cachedCalendar(env));
  // Show all approved probe dates, including selected-member appointments. Never expose the recipient list, member names, birthdays, replies, or the private iCal URL.
  return {configured:cal.configured===true,fetchedAt:cal.fetchedAt||null,stale:cal.stale===true,
   events:cal.events.filter(e=>e.approved===true&&e.kind==='probe'&&e.end>Date.now()).map(e=>({
    id:e.id,title:e.sessionType==='Probe'?'Probe':'Sonderprobe',start:e.start,end:e.end,
    allDay:e.allDay===true,sessionType:e.sessionType==='Probe'?'Probe':'Sonderprobe',attendanceType:e.attendanceType,kind:'probe',approved:true,
    audienceRestricted:Array.isArray(e.recipientIds)
   }))};
 }
 g.PortalService={assertMember,assertAlias,route,scheduled,ready,calendarURL,projection,send,decorate,awardBirthdays,publicCalendar};
})(globalThis);
