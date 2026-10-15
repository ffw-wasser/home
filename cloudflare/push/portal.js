/* Members portal. Reuses scoped member credentials; all private payloads encrypted. */
(function(g){
 'use strict';const L=g.CentralLedger,DAY=86400000,fail=(message,status=409)=>{throw Object.assign(Error(message),{status});},checks=new WeakSet(),loads=new WeakMap();
 const ddl=[
  'CREATE TABLE IF NOT EXISTS portal_bonus_policy (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_rules (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_birthdays (member TEXT NOT NULL,year INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(member,year))',
  'CREATE TABLE IF NOT EXISTS portal_devices (id TEXT PRIMARY KEY)',
  'CREATE TABLE IF NOT EXISTS portal_roster (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_config (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,fetched_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_replies (event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(event,member))',
  "CREATE TABLE IF NOT EXISTS portal_sends (id TEXT PRIMARY KEY,event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',campaign TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL)",
  'CREATE INDEX IF NOT EXISTS portal_sends_created ON portal_sends(created_at)'
 ];
 async function ready(env){if(checks.has(env.DB))return;await env.DB.batch(ddl.map(sql=>env.DB.prepare(sql)));checks.add(env.DB);}
 const open=(env,row,purpose)=>row?L.open(env,row.payload,purpose):null;
 async function config(env){return open(env,await env.DB.prepare('SELECT * FROM portal_config WHERE id=1').first(),'portal-config');}
 function calendarURL(value){let u;try{u=new URL(value);}catch{fail('Bitte den öffentlichen Google-iCal-Link eingeben.',400);}if(u.origin!=='https://calendar.google.com'||!/^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/.test(u.pathname)||u.search||u.hash||u.username||u.password)fail('Bitte die öffentliche iCal-Adresse aus Google Kalender verwenden.',400);return u.href;}
 async function download(url){
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'text/calendar'}});if(!response.ok)fail('Google-Kalender derzeit nicht erreichbar. Bitte später erneut prüfen.',503);
  if(Number(response.headers.get('content-length'))>2000000)fail('Der Kalender ist zu groß.',400);
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)fail('Der Kalender ist zu groß.',400);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);
 }
 async function projection(url){const raw=await download(url),items=g.PortalCalendar.parse(raw),events=[];for(const item of items){const {key,seriesKey,...rest}=item;events.push({id:await hash('h2o-event/v1:'+url+':'+key),seriesId:await hash('h2o-series/v1:'+url+':'+seriesKey),...rest});}return events;}
 async function calendar(env,force=false){
  const c=await config(env);if(!c)return {configured:false,events:[],fetchedAt:null,stale:true};
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
 async function decorate(env,cal){const row=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,row,'portal-rules')||{},roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');return {...cal,rulesVersion:row?.version||0,events:cal.events.map(e=>{const rule=rules[e.id]||rules[e.seriesId],auto=detected(e,roster),kind=rule?.kind||auto.kind;return {...e,kind,sessionType:kind==='probe'?(rule?.sessionType||auto.sessionType||'Sonderprobe'):null,automatic:!rule,approved:rule?.kind==='probe'&&rule.approved===true,memberId:kind==='birthday'?(rule?rule.memberId||null:auto.memberId):null};})};}
 async function classify(env,data,cal,roster){
  if(data.sessionType!==undefined&&!['Probe','Sonderprobe'].includes(data.sessionType))fail('Ungültige Terminart.',400);if(!['probe','birthday','other'].includes(data.kind)||typeof data.approved!=='boolean'||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Terminfreigabe.',400);const event=cal.events.find(e=>e.id===data.eventId);if(!event)fail('Termin nicht mehr verfügbar.',404);if(cal.stale)fail('Kalender konnte nicht aktuell geprüft werden.',503);
  if(data.kind==='birthday'&&data.memberId&&!roster?.members.some(m=>m.id===data.memberId))fail('Bitte den Geburtstag einem aktuellen Mitglied zuordnen.',400);
  const old=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,old,'portal-rules')||{};if((old?.version||0)!==data.expectedVersion)fail('Terminfreigaben wurden inzwischen geändert. Bitte neu laden.');
  if(data.kind==='birthday'){rules[event.seriesId]={kind:'birthday',memberId:data.memberId||null};delete rules[event.id];}else rules[event.id]={kind:data.kind,approved:data.kind==='probe'&&data.approved,...(data.kind==='probe'?{sessionType:data.sessionType||event.sessionType||'Sonderprobe'}:{})};
  const payload=await L.seal(env,rules,'portal-rules'),result=old?await env.DB.prepare('UPDATE portal_rules SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_rules(id,payload) VALUES(1,?)').bind(payload).run();if(!result.meta.changes)fail('Freigabe wurde gleichzeitig geändert. Bitte neu laden.');return {ok:true,version:data.expectedVersion+1};
 }
 async function birthdayPolicy(env){const row=await env.DB.prepare('SELECT * FROM portal_bonus_policy WHERE id=1').first();return {row,value:await open(env,row,'portal-birthday-policy')||{revision:'birthday-default-v1',awardUnits:150}};}
 async function saveBirthdayPolicy(env,data){
  if(!REV.test(data.revision||'')||!Number.isSafeInteger(data.awardUnits)||data.awardUnits<150||data.awardUnits>15000||data.awardUnits%150)fail('Bitte 1 bis 100 ganze Geburtstagspunkte eingeben.',400);const old=await birthdayPolicy(env);
  if(old.value.revision===data.revision){if(old.value.awardUnits!==data.awardUnits)fail('Diese Bonusversion wurde bereits anders verwendet.');return {birthdayPolicy:old.value};}
  if(data.expectedRevision!==old.value.revision)fail('Geburtstagspunkte wurden inzwischen geändert. Bitte neu laden.');const policy={revision:data.revision,awardUnits:data.awardUnits},payload=await L.seal(env,policy,'portal-birthday-policy'),result=old.row?await env.DB.prepare('UPDATE portal_bonus_policy SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.row.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_bonus_policy(id,payload) VALUES(1,?)').bind(payload).run();if(!result.meta.changes)fail('Geburtstagspunkte wurden gleichzeitig geändert. Bitte erneut prüfen.');return {birthdayPolicy:policy};
 }
 const berlinDay=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
 async function awardBirthdays(env,cal){
  const today=berlinDay(Date.now()),year=Number(today.slice(0,4)),rosterRow=await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),roster=await open(env,rosterRow,'portal-roster'),ruleRow=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first();if(!roster||!ruleRow)return 0;
  const policy=await birthdayPolicy(env);const awarded=new Set((await env.DB.prepare('SELECT member FROM portal_birthdays WHERE year=?').bind(year).all()).results.map(r=>r.member));let processed=0;
  for(const e of cal.events){if(e.kind!=='birthday'||!e.memberId||berlinDay(e.start)!==today||awarded.has(e.memberId)||!roster.members.some(m=>m.id===e.memberId))continue;if(processed>=2)break;
   const m=await L.meta(env);L.active(m);const current=await L.read(env,e.memberId),booking={id:'birthday-'+year,type:'birthday-reward',confirmation:'birthday',year,cents:policy.value.awardUnits,createdAt:new Date(Date.now()).toISOString()},next=g.DrinksModel.appendBirthdayReward(current.account,booking),marker=await L.seal(env,{eventId:e.id,awardUnits:policy.value.awardUnits,awardedAt:Date.now()},'birthday:'+e.memberId+':'+year),payload=await L.seal(env,next,'ledger:'+e.memberId),guard='EXISTS(SELECT 1 FROM portal_birthdays WHERE member=? AND year=? AND payload=?)';
   const first=env.DB.prepare("INSERT OR IGNORE INTO portal_birthdays(member,year,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state='active') AND EXISTS(SELECT 1 FROM portal_rules WHERE id=1 AND payload=?) AND EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?) AND "+(policy.row?'EXISTS(SELECT 1 FROM portal_bonus_policy WHERE id=1 AND payload=?)':'NOT EXISTS(SELECT 1 FROM portal_bonus_policy WHERE id=1)')+' AND '+(current.version?'EXISTS(SELECT 1 FROM ledgers WHERE member=? AND version=?)':'NOT EXISTS(SELECT 1 FROM ledgers WHERE member=?)')).bind(e.memberId,year,marker,m.seq,ruleRow.payload,rosterRow.payload,...(policy.row?[policy.row.payload]:[]),e.memberId,...(current.version?[current.version]:[]));
   const write=current.version?env.DB.prepare('UPDATE ledgers SET payload=?,version=version+1 WHERE member=? AND '+guard).bind(payload,e.memberId,e.memberId,year,marker):env.DB.prepare('INSERT INTO ledgers(member,payload,version) SELECT ?,?,1 WHERE '+guard).bind(e.memberId,payload,e.memberId,year,marker);
   const results=await env.DB.batch([first,write,env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND '+guard).bind(e.memberId,year,marker)]);if(results[0].meta.changes){processed++;awarded.add(e.memberId);}
  }return processed;
 }
 async function actor(env,data,auth){
  if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||''))fail('Ungültiger Portalzugang.',400);
  const row=await env.DB.prepare('SELECT a.* FROM ledger_access a JOIN accounts c ON c.alias=a.alias AND c.revision=a.revision WHERE a.alias=? AND a.revision=?').bind(data.alias,data.revision).first();
  if(!row||!equal(auth,await capability(env,data.alias,data.revision,'commands')))fail('Portalzugang wurde geändert. Bitte den persönlichen QR-Code erneut öffnen.',401);
  const record=await L.open(env,row.payload,'access:'+data.alias),roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');if(roster&&!roster.members.some(m=>m.id===record.memberId))fail('Dieser Portalzugang ist nicht mehr freigegeben.',403);return record;
 }
 async function replyFor(env,event,member){const row=await env.DB.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').bind(event,member).first();return {status:row?(await open(env,row,'portal-reply:'+event+':'+member)).status:'open',version:row?.version||0};}
 async function recipients(env){const rows=(await env.DB.prepare('SELECT a.* FROM ledger_access a JOIN accounts c ON c.alias=a.alias AND c.revision=a.revision WHERE EXISTS(SELECT 1 FROM devices d JOIN portal_devices p ON p.id=d.id WHERE d.alias=a.alias AND d.revision=a.revision)').all()).results,result=new Map();for(const row of rows){const record=await L.open(env,row.payload,'access:'+row.alias);if(!result.has(record.memberId))result.set(record.memberId,[]);result.get(record.memberId).push(record);}return result;}
 async function send(env,event,mode,requestId){
  let accepted=0,failed=0,excused=0,duplicate=0,processed=0;const people=await recipients(env),campaign=mode==='auto'?String(event.start):requestId,already=new Set((await env.DB.prepare('SELECT member FROM portal_sends WHERE event=? AND campaign=?').bind(event.id,campaign).all()).results.map(r=>r.member)),roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');let remaining=0;const replyRows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,statuses=new Map();for(const row of replyRows)statuses.set(row.member,(await open(env,row,'portal-reply:'+event.id+':'+row.member)).status);
  for(const [member,records] of people){
   if(roster&&!roster.members.some(m=>m.id===member))continue;if(already.has(member)){duplicate++;continue;}
   if(statuses.get(member)==='excused'){excused++;continue;}if(processed>=2){remaining++;continue;}processed++;
   const id=await hash('portal-send:'+event.id+':'+member+':'+(mode==='auto'?event.start:requestId)),now=Date.now(),payload=await L.seal(env,{event,status:'reminder'},'portal-send:'+id);
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
 async function scheduled(env){
  await ready(env);const c=await config(env);if(!c)return;const cal=await decorate(env,await calendar(env));if(cal.stale)return;
  await env.DB.prepare('DELETE FROM portal_sends WHERE created_at<?').bind(Date.now()-30*DAY).run();
  await env.DB.prepare('DELETE FROM portal_replies WHERE updated_at<?').bind(Date.now()-400*DAY).run();
  if(await awardBirthdays(env,cal))return;
  if(!c.reminders)return;
  const now=Date.now(),due=cal.events.filter(event=>{const at=event.start-c.leadHours*3600000;return event.approved&&event.kind==='probe'&&!event.allDay&&event.start>now&&at<=now&&at>now-3600000;});if(due.length)await send(env,due[Math.floor(now/60000)%due.length],'auto');
 }
 async function route(path,data,env,auth){
  await ready(env);const m=await L.meta(env);L.active(m);const admin=path.startsWith('/admin/');let record;if(admin)L.source(m,data);else record=await actor(env,data,auth);
  const roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');
  if(path==='/admin/portal/roster'){
   if(!Array.isArray(data.members)||data.members.length>500||new Set(data.members.map(m=>m.id)).size!==data.members.length||data.members.some(m=>typeof m.id!=='string'||!m.id||m.id.length>200||typeof m.name!=='string'||!m.name.trim()||m.name.length>200||typeof m.leader!=='boolean'))fail('Ungültige Mitgliederfreigabe.',400);
   const payload=await L.seal(env,{members:data.members.map(m=>({id:m.id,name:m.name,leader:m.leader}))},'portal-roster');await env.DB.prepare('INSERT INTO portal_roster(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(payload).run();return {ok:true};
  }
  if(path==='/admin/portal/birthday-status')return {birthdayPolicy:(await birthdayPolicy(env)).value};
  if(path==='/admin/portal/birthday-policy')return saveBirthdayPolicy(env,data);
  if(path==='/admin/portal/config'){
   const c=await config(env);return {configured:!!c,config:c||null};
  }
  if(path==='/admin/portal/configure'){
   const url=calendarURL(data.calendarUrl);if(typeof data.reminders!=='boolean'||![1,2,6,12,24,48].includes(data.leadHours))fail('Ungültige Erinnerungseinstellungen.',400);
   const old=await config(env);if(old&&old.calendarUrl!==url)fail('Ein Kalenderwechsel würde die Terminzuordnung ändern. Bitte den vorhandenen Kalender weiterverwenden.');
   const events=await projection(url),c={calendarUrl:url,reminders:data.reminders,leadHours:data.leadHours},payload=await L.seal(env,c,'portal-config'),cal=await L.seal(env,{events},'portal-calendar');
   await env.DB.batch([env.DB.prepare('INSERT INTO portal_config(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=version+1').bind(payload),env.DB.prepare('INSERT INTO portal_calendar(id,payload,fetched_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').bind(cal,Date.now())]);return {ok:true,count:events.length};
  }
  if(path==='/portal/subscribe'||path==='/portal/unsubscribe'){
   const url=endpoint(data.endpoint),id=await hash(url);if(path.endsWith('/unsubscribe')){await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(id,data.alias).run();return {ok:true};}
   const old=await env.DB.prepare('SELECT alias FROM devices WHERE id=?').bind(id).first();if(old&&old.alias!==data.alias)fail('Auf diesem Handy zuerst die Erinnerungen des anderen Mitglieds deaktivieren.');
   const saved=await env.DB.prepare('INSERT INTO devices(id,alias,revision,endpoint) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE alias=?)<5 ON CONFLICT(id) DO UPDATE SET revision=excluded.revision').bind(id,data.alias,data.revision,url,data.alias).run();if(!saved.meta.changes&&!old)fail('Maximal fünf Geräte pro Mitglied.');await env.DB.prepare('INSERT OR IGNORE INTO portal_devices(id) VALUES(?)').bind(id).run();return {ok:true};
  }
  if(path==='/portal/notification'){
   const row=await env.DB.prepare("SELECT * FROM portal_sends WHERE member=? AND status IN ('pending','accepted') AND created_at>? ORDER BY created_at DESC LIMIT 1").bind(record.memberId,Date.now()-DAY).first();if(!row)return {event:null};const value=await open(env,row,'portal-send:'+row.id),cal=await decorate(env,await calendar(env)),event=cal.events.find(e=>e.id===value.event.id&&e.approved&&e.kind==='probe');
   return {event:event&&event.start>Date.now()&&(await replyFor(env,event.id,record.memberId)).status!=='excused'?event:null};
  }
  const cal=await decorate(env,await calendar(env));
  if(path==='/admin/portal/classify')return classify(env,data,cal,roster);
  if(path==='/portal/list'){
   const ownBirthday=cal.events.some(e=>e.kind==='birthday'&&e.memberId===record.memberId&&berlinDay(e.start)===berlinDay(Date.now())),birthdayRow=ownBirthday?await env.DB.prepare('SELECT * FROM portal_birthdays WHERE member=? AND year=?').bind(record.memberId,Number(berlinDay(Date.now()).slice(0,4))).first():null,birthday=ownBirthday?{today:true,awarded:!!birthdayRow,awardUnits:birthdayRow?(await open(env,birthdayRow,'birthday:'+record.memberId+':'+berlinDay(Date.now()).slice(0,4))).awardUnits:(await birthdayPolicy(env)).value.awardUnits}:null;const replies=(await env.DB.prepare('SELECT * FROM portal_replies WHERE member=?').bind(record.memberId).all()).results,map=new Map();for(const row of replies)map.set(row.event,{status:(await open(env,row,'portal-reply:'+row.event+':'+record.memberId)).status,version:row.version});return {...cal,birthday,leader:roster?.members.some(m=>m.id===record.memberId&&m.leader)===true,events:cal.events.filter(e=>e.approved&&e.kind==='probe').map(e=>({...e,...(map.get(e.id)||{status:'open',version:0})}))};
  }
  if(path==='/admin/portal/list')return cal;
  const event=cal.events.find(e=>e.id===data.eventId&&(e.approved&&e.kind==='probe'));if(!event)fail('Termin wurde abgesagt oder ist nicht mehr im Kalender.',404);
  if(path==='/portal/overview'){
   if(!roster?.members.some(m=>m.id===record.memberId&&m.leader))fail('Diese Übersicht ist nur für hinterlegte Gruppenführer freigegeben.',403);
   const rows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,statuses=new Map();for(const row of rows)statuses.set(row.member,(await open(env,row,'portal-reply:'+event.id+':'+row.member)).status);
   return {event,stale:cal.stale,members:roster.members.map(m=>({name:m.name,status:statuses.get(m.id)||'open'}))};
  }
  if(path==='/admin/portal/replies'){
   const rows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,replies=[];for(const row of rows)replies.push({memberId:row.member,...await open(env,row,'portal-reply:'+row.event+':'+row.member)});return {event,replies,stale:cal.stale,fetchedAt:cal.fetchedAt};
  }
  if(cal.stale)fail('Kalender konnte nicht aktuell geprüft werden. Bitte später erneut versuchen.',503);
  if(event.start<=Date.now())fail('Der Termin hat bereits begonnen. Änderungen bitte am Gerätehaus-iPad erfassen.');
  if(path==='/admin/portal/remind'){
   if(!REV.test(data.requestId||''))fail('Ungültige Versandkennung.',400);return send(env,event,'manual',data.requestId);
  }
  if(path==='/portal/reply'){
   if(!['yes','excused','open'].includes(data.status)||!REV.test(data.requestId||'')||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Rückmeldung.',400);
   const old=await env.DB.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').bind(event.id,record.memberId).first(),previous=await open(env,old,'portal-reply:'+event.id+':'+record.memberId);
   if(previous?.requestId===data.requestId){if(previous.status!==data.status)fail('Vorgangsnummer wurde bereits anders verwendet.');return {ok:true,status:previous.status,version:old.version};}
   if((old?.version||0)!==data.expectedVersion)fail('Deine Rückmeldung wurde inzwischen geändert. Bitte aktualisieren.');
   const payload=await L.seal(env,{status:data.status,requestId:data.requestId,updatedAt:Date.now()},'portal-reply:'+event.id+':'+record.memberId);
   const result=old?await env.DB.prepare('UPDATE portal_replies SET payload=?,updated_at=?,version=version+1 WHERE event=? AND member=? AND version=?').bind(payload,Date.now(),event.id,record.memberId,old.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_replies(event,member,payload,updated_at) VALUES(?,?,?,?)').bind(event.id,record.memberId,payload,Date.now()).run();if(!result.meta.changes)fail('Rückmeldung wurde gleichzeitig geändert. Bitte aktualisieren.');return {ok:true,status:data.status,version:data.expectedVersion+1};
  }
  fail('Nicht gefunden.',404);
 }
 g.PortalService={route,scheduled,ready,calendarURL,projection,send,decorate,awardBirthdays};
})(globalThis);
