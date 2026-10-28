/* Members portal. Reuses scoped member credentials; all private payloads encrypted. */
(function(g){
 'use strict';const L=g.CentralLedger,DAY=86400000,fail=(message,status=409)=>{throw Object.assign(Error(message),{status});},checks=new WeakSet(),loads=new WeakMap(),yearLoads=new WeakMap();
 const ddl=[
  'CREATE TABLE IF NOT EXISTS portal_groups (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  ...g.PortalEvidence.schema,
  ...(g.CalendarInvitations?.schema||[]),
  ...g.PortalHydrants.schema,
  ...(g.WhatsAppPasskeys?.schema||[]),
  'CREATE TABLE IF NOT EXISTS portal_bonus_policy (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_rules (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_birthdays (member TEXT NOT NULL,year INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(member,year))',
  'CREATE TABLE IF NOT EXISTS portal_devices (id TEXT PRIMARY KEY)',
  'CREATE TABLE IF NOT EXISTS portal_roster (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_regulations (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_contacts (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_config (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,fetched_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_display (event TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_colors (id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_year (year INTEGER PRIMARY KEY,payload TEXT NOT NULL,fetched_at INTEGER NOT NULL)',
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
 async function config(env){const c=await open(env,await env.DB.prepare('SELECT * FROM portal_config WHERE id=1').first(),'portal-config');return c?{...c,reminders:false}:null;}
 function calendarURL(value){let u;try{u=new URL(value);}catch{fail('Bitte den öffentlichen Google-iCal-Link eingeben.',400);}if(u.origin!=='https://calendar.google.com'||!/^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/.test(u.pathname)||u.search||u.hash||u.username||u.password)fail('Bitte die öffentliche iCal-Adresse aus Google Kalender verwenden.',400);return u.href;}
 async function download(url){
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'text/calendar'}});if(!response.ok)fail('Google-Kalender derzeit nicht erreichbar. Bitte später erneut prüfen.',503);
  if(Number(response.headers.get('content-length'))>2000000)fail('Der Kalender ist zu groß.',400);
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)fail('Der Kalender ist zu groß.',400);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);
 }
 async function projection(url,range=null){const raw=await download(url),items=g.PortalCalendar.parse(raw,Date.now(),range),events=[],series=new Map();for(const item of items){const {key,seriesKey,...rest}=item;if(!series.has(seriesKey))series.set(seriesKey,await hash('h2o-series/v1:'+url+':'+seriesKey));events.push({id:await hash('h2o-event/v1:'+url+':'+key),seriesId:series.get(seriesKey),...rest});}return events;}
 async function yearCalendar(env,year,ctx,background=false){
  if(!Number.isInteger(year)||year<2000||year>2100)fail('Bitte ein Jahr von 2000 bis 2100 wählen.',400);
  const c=await config(env);if(!c)return {year,configured:false,events:[],fetchedAt:null,stale:true};
  const range={from:Date.parse(year+'-01-01T00:00:00+01:00'),to:Date.parse((year+1)+'-01-01T00:00:00+01:00')};
  // Keep only raw projections in this bounded, per-database memory cache.
  // Rules, roster and recipient restrictions are applied afresh on every read.
  let years=yearLoads.get(env.DB);if(!years){years=new Map();yearLoads.set(env.DB,years);}
  for(const [key,value] of years)if(value.url!==c.calendarUrl)years.delete(key);
  let entry=years.get(year);
  if(!entry||!entry.pending&&entry.fetchedAt<=Date.now()-300000){
   const previous=entry;entry={url:c.calendarUrl,fetchedAt:0,pending:null,fallback:null};let snapshotReady;entry.snapshotReady=new Promise(resolve=>snapshotReady=resolve);years.set(year,entry);
   while(years.size>3)years.delete(years.keys().next().value);
   entry.pending=(async()=>{let fallback=previous?.events?{events:previous.events,fetchedAt:previous.fetchedAt}:null;
    try{
     // Encrypted snapshots also serve cold isolates without recalculating every
     // historical series. They never contain recipient decisions or reply data.
     const row=await env.DB.prepare('SELECT * FROM portal_calendar_year WHERE year=?').bind(year).first(),saved=await open(env,row,'portal-calendar-year:'+year);if(saved?.calendarUrl===c.calendarUrl&&Array.isArray(saved.events)&&(!fallback||row.fetched_at>fallback.fetchedAt))fallback={events:saved.events,fetchedAt:row.fetched_at};
     entry.fallback=fallback;snapshotReady();
     if(fallback&&fallback.fetchedAt>Date.now()-300000){entry.events=fallback.events;entry.fetchedAt=fallback.fetchedAt;return {events:entry.events,fetchedAt:entry.fetchedAt,stale:false};}
     const events=await projection(c.calendarUrl,range),fetchedAt=Date.now();
     if((await config(env))?.calendarUrl!==c.calendarUrl)fail('Kalenderverbindung wurde geändert. Bitte aktualisieren.');
     const payload=await L.seal(env,{calendarUrl:c.calendarUrl,events},'portal-calendar-year:'+year);
     await env.DB.prepare('INSERT INTO portal_calendar_year(year,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(year) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at WHERE portal_calendar_year.fetched_at<=excluded.fetched_at').bind(year,payload,fetchedAt).run();
     entry.events=events;entry.fetchedAt=fetchedAt;return {events,fetchedAt,stale:false};
    }
    catch(error){if(fallback){entry.events=fallback.events;entry.fetchedAt=fallback.fetchedAt;return {events:entry.events,fetchedAt:entry.fetchedAt,stale:true};}if(years.get(year)===entry)years.delete(year);throw error;}
    finally{snapshotReady();entry.pending=null;entry.fallback=null;}})();
  }
  let cal;
  if(background&&ctx?.waitUntil&&entry.pending){
   const pending=entry.pending;await entry.snapshotReady;
   if(entry.pending&&entry.fallback&&entry.fallback.fetchedAt<=Date.now()-300000){
    // Return the encrypted snapshot before Google; apply current rules below.
    ctx.waitUntil(pending.catch(()=>{}));cal={events:entry.fallback.events,fetchedAt:entry.fallback.fetchedAt,stale:true,refreshing:true};
   }else cal=await pending;
  }else cal=entry.pending?await entry.pending:{events:entry.events,fetchedAt:entry.fetchedAt,stale:false};
  if((await config(env))?.calendarUrl!==c.calendarUrl)fail('Kalenderverbindung wurde geändert. Bitte aktualisieren.');
  return {year,...await decorate(env,{configured:true,...cal},c,ctx)};
 }
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
  if(g.CalendarPresentation.isInfo(e.title))return {kind:'info',sessionType:null,memberId:null};
  if(e.birthdayHint){const title=e.title.replace(/geburtstag|birthday|geb\.|🎂/gi,' ').replace(/\b(?:von|happy)\b/gi,' '),key=nameKey(title),matches=(roster?.members||[]).filter(m=>nameKey(m.name)===key);return {kind:'birthday',sessionType:null,memberId:matches.length===1?matches[0].id:null};}
  if(/(?:^|[\s:-])unterricht(?:$|[\s:,-])/i.test(e.title))return {kind:'probe',sessionType:'Sonderprobe',attendanceType:'Unterricht',memberId:null};
  if(/ausschuss[\s-]*sitzung/i.test(e.title))return {kind:'probe',sessionType:'Sonderprobe',attendanceType:'Ausschuss Sitzung',memberId:null};
  return {kind:'probe',sessionType:!/sonderprobe/i.test(e.title)&&/(?:^|[\s-])probe(?:$|[\s:,-])|gesamtprobe|hauptprobe|übungsprobe/i.test(e.title)?'Probe':'Sonderprobe',memberId:null};
 }
 async function audienceGroups(env){
  const row=await env.DB.prepare('SELECT * FROM portal_groups WHERE id=1').first();
  const value=row?await open(env,row,'portal-groups'):{groups:g.PortalGroups.defaults()};
  // Corrupt or missing persisted groups must never turn a restricted audience into everyone.
  if(!value||!Array.isArray(value.groups))fail('Gruppendaten konnten nicht sicher gelesen werden.',503);
  return {groups:g.PortalGroups.validate(value.groups),version:row?.version||0};
 }
 async function decorate(env,cal,configuration,ctx){
  const row=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,row,'portal-rules')||{},roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster'),groups=await audienceGroups(env);
  const requested=new Map((await env.DB.prepare('SELECT event,requested_at FROM portal_response_requests').all()).results.map(r=>[r.event,r.requested_at]));
  const resolveAudience=g.PortalGroups.resolver(groups.groups,roster),design=await calendarColors(env),googleColors=await g.GoogleCalendarColors.read(env,configuration===undefined?await config(env):configuration,cal.events,ctx),display=new Map();for(const item of (await env.DB.prepare('SELECT * FROM portal_calendar_display').all()).results)display.set(item.event,{...await open(env,item,'calendar-display:'+item.event),version:item.version});
  return {...cal,googleColorStatus:googleColors.status,colors:design.colors,colorVersion:design.version,displayFeatureVersion:1,rulesVersion:row?.version||0,groupsVersion:groups.version,rosterUpdatedAt:roster?.updatedAt||null,events:cal.events.map(e=>{
   const rule=rules[e.id]||rules[e.seriesId],source=g.CalendarPresentation.instructions(e.description),fields=source.fields,issues=[...source.issues],auto=detected(e,roster);
   const controlled=auto.kind!=='info'&&auto.kind!=='birthday';
   if(controlled&&fields.type){auto.kind=['other','info'].includes(fields.type)?fields.type:'probe';auto.attendanceType=auto.kind==='probe'?fields.type:null;auto.sessionType=auto.kind==='probe'?(fields.type==='Allgemeine Probe'?'Probe':'Sonderprobe'):null;}
   const kind=g.CalendarPresentation.isInfo(e.title)?'info':rule?.kind||auto.kind,sessionType=kind==='probe'?(rule?.sessionType||auto.sessionType||'Sonderprobe'):null;
   let automaticAudience=kind==='probe'?resolveAudience(e.title):{recipientIds:[],groupIds:[]};
   if(kind==='probe'&&fields.group!==undefined){
    const enabled=groups.groups.filter(group=>group.enabled),find=name=>enabled.find(group=>g.PortalGroups.normalize(group.name)===g.PortalGroups.normalize(name));
    const exact=find(fields.group),names=exact?[fields.group]:fields.group.split(';').map(value=>value.trim()),selected=names.map(find);
    if(!roster||selected.some(group=>!group)){issues.push('Gruppe unbekannt, deaktiviert oder Mitgliederstand fehlt: '+fields.group);automaticAudience={recipientIds:[],groupIds:[]};}
    else automaticAudience={recipientIds:[...new Set(selected.flatMap(group=>g.PortalGroups.members(group,roster)))],groupIds:selected.map(group=>group.id)};
   }
   const recipientMode=rule?(rule.recipientMode||'legacy'):'automatic',meta=display.get(e.id)||{};
   let groupRecipients=[];if(recipientMode==='groups')try{groupRecipients=g.PortalGroups.selection(rule.groupIds,rule.includeIds||[],rule.excludeIds||[],groups.groups,roster);}catch{issues.push('Gruppen-Auswahl bitte erneut prüfen.');}
   const recipientIds=kind==='info'?(meta.recipientIds??null):kind!=='probe'?null:recipientMode==='groups'?groupRecipients:recipientMode==='automatic'?(rule&&((rule.groupsVersion>0&&!groups.version)||!roster)?[]:automaticAudience.recipientIds):Array.isArray(rule?.recipientIds)?rule.recipientIds:null;
   const recognized=!!fields.type||!!auto.attendanceType||/sonderprobe|(?:^|[\s-])probe(?:$|[\s:,-])|gesamtprobe|hauptprobe|übungsprobe/i.test(e.title);
   if(!rule&&fields.release===true&&kind==='probe'&&!recognized)issues.push('Titel oder Terminart ist nicht eindeutig. Bitte Terminart angeben.');
   if(!rule&&fields.release===true&&kind==='probe'&&!automaticAudience.recipientIds.length)issues.push('Keine Mitglieder für die Freigabe zugeordnet.');
   const clothingValue=rule?.clothing??fields.clothing??(kind==='probe'?(sessionType==='Probe'?'Einsatzkleidung':'Tagesdienst'):'');
   return {...e,responseRequested:requested.has(e.id),responseRequestedAt:requested.get(e.id)||null,...(googleColors.colors.get(g.GoogleCalendarColors.eventKey(e))?{googleColor:googleColors.colors.get(g.GoogleCalendarColors.eventKey(e)).color}:{}),description:source.note,note:g.CalendarPresentation.plain(meta.note??source.note),noteOverride:meta.note!=null,displayVersion:meta.version||0,infoVisible:kind==='info'&&meta.infoVisible===true,location:kind==='info'?'':rule?.location??(e.location||'GH Wasser'),kind,sessionType,clothing:clothingValue==='Tagdienst'?'Tagesdienst':clothingValue==='Einsatz'?'Einsatzkleidung':clothingValue,automatic:!rule,googleManaged:!rule,googleIssues:issues,approved:kind==='probe'&&(rule?rule.kind==='probe'&&rule.approved===true:fields.release===true&&!issues.length),memberId:kind==='birthday'?(rule?rule.memberId||null:auto.memberId):null,recipientIds,recipientMode,groupIds:recipientMode==='groups'?rule.groupIds:automaticAudience.groupIds,...(recipientMode==='groups'?{includeIds:rule.includeIds||[],excludeIds:rule.excludeIds||[]}:{}),automaticRecipientIds:automaticAudience.recipientIds,attendanceType:kind==='probe'?(rule?.attendanceType||auto.attendanceType||(sessionType==='Probe'?'Allgemeine Probe':'Sonderprobe')):null};
  })};
 }
 async function calendarColors(env,data={}){
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_colors WHERE id=1').first(),current=row?await open(env,row,'calendar-colors'):g.CalendarPresentation.defaults();
  if(data.colors===undefined)return {colors:current,version:row?.version||0};
  let colors;try{colors=g.CalendarPresentation.validate(data.colors);}catch(e){fail(e.message,400);}
  if(data.expectedVersion!==(row?.version||0))fail('Farben wurden inzwischen geändert. Bitte neu laden.');
  const payload=await L.seal(env,colors,'calendar-colors'),saved=row?await env.DB.prepare('UPDATE portal_calendar_colors SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,row.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_calendar_colors(id,payload) VALUES(1,?)').bind(payload).run();
  if(!saved.meta.changes)fail('Farben wurden gleichzeitig geändert. Bitte neu laden.');return {colors,version:(row?.version||0)+1};
 }
 async function saveCalendarDisplay(env,data,cal,roster){
  const event=cal.events.find(e=>e.id===data.eventId);if(!event)fail('Kalendereintrag nicht mehr vorhanden.',404);if(cal.stale)fail('Kalenderstand bitte zuerst aktualisieren.',503);
  if(data.note!==null&&(typeof data.note!=='string'||data.note.length>4000))fail('Zusatzinfo darf höchstens 4000 Zeichen enthalten.',400);
  if(typeof data.infoVisible!=='boolean'||event.kind!=='info'&&data.infoVisible)fail('Ungültige Informationsfreigabe.',400);
  if(data.recipientIds!==null&&(!Array.isArray(data.recipientIds)||data.recipientIds.length>500||new Set(data.recipientIds).size!==data.recipientIds.length||data.recipientIds.some(id=>!roster?.members.some(m=>m.id===id))))fail('Bitte gültige Mitglieder wählen.',400);
  if(event.kind==='info'&&data.infoVisible&&Array.isArray(data.recipientIds)&&!data.recipientIds.length)fail('Bitte mindestens eine Person wählen oder die H2O-Anzeige ausschalten.',400);
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_display WHERE event=?').bind(event.id).first();if(data.expectedVersion!==(row?.version||0))fail('Zusatzinfo wurde inzwischen geändert. Bitte neu laden.');
  const value={note:data.note===null?null:g.CalendarPresentation.plain(data.note),infoVisible:event.kind==='info'&&data.infoVisible,recipientIds:event.kind==='info'?data.recipientIds:null},payload=await L.seal(env,value,'calendar-display:'+event.id);
  const saved=row?await env.DB.prepare('UPDATE portal_calendar_display SET payload=?,version=version+1 WHERE event=? AND version=?').bind(payload,event.id,row.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_calendar_display(event,payload) VALUES(?,?)').bind(event.id,payload).run();
  if(!saved.meta.changes)fail('Zusatzinfo wurde gleichzeitig geändert. Bitte neu laden.');return {...value,version:(row?.version||0)+1};
 }
 function isRecipient(event,memberId){return !Array.isArray(event.recipientIds)||event.recipientIds.includes(memberId);}
 function memberEvent(event){const {recipientIds,automaticRecipientIds,groupIds,includeIds,excludeIds,googleUid,googleOccurrence,recipientMode,googleIssues,googleManaged,...visible}=event;return {...visible,audienceRestricted:Array.isArray(recipientIds)};}
 async function classify(env,data,cal,roster){
  if(data.sessionType!==undefined&&!['Probe','Sonderprobe'].includes(data.sessionType))fail('Ungültige Terminart.',400);if(!['probe','birthday','other'].includes(data.kind)||typeof data.approved!=='boolean'||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Terminfreigabe.',400);const event=cal.events.find(e=>e.id===data.eventId);if(!event)fail('Termin nicht mehr verfügbar.',404);if(cal.stale)fail('Kalender konnte nicht aktuell geprüft werden.',503);
  if(event.kind==='info')fail('INFO-Einträge sind reine Kalenderinformationen. Bitte nur Darstellung und Sichtbarkeit bearbeiten.',400);
  if(data.followGoogle!==undefined&&typeof data.followGoogle!=='boolean')fail('Ungültige Google-Übernahme.',400);
  if(data.followGoogle===true){
   if(event.kind==='birthday'||data.kind==='birthday')fail('Geburtstagszuordnungen bitte gesondert pflegen.',400);
   if(data.expectedGroupsVersion!==cal.groupsVersion)fail('Gruppen wurden inzwischen geändert. Bitte neu laden.');
   const old=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,old,'portal-rules')||{};
   if((old?.version||0)!==data.expectedVersion)fail('Terminfreigaben wurden inzwischen geändert. Bitte neu laden.');
   delete rules[event.id];
   const payload=await L.seal(env,rules,'portal-rules'),result=old?await env.DB.prepare('UPDATE portal_rules SET payload=?,version=version+1 WHERE id=1 AND version=? AND COALESCE((SELECT version FROM portal_groups WHERE id=1),0)=?').bind(payload,old.version,cal.groupsVersion).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_rules(id,payload) SELECT 1,? WHERE COALESCE((SELECT version FROM portal_groups WHERE id=1),0)=?').bind(payload,cal.groupsVersion).run();
   if(!result.meta.changes)fail('Freigabe wurde gleichzeitig geändert. Bitte neu laden.');return {ok:true,version:data.expectedVersion+1,googleManaged:true};
  }
  if(data.kind==='birthday'&&data.memberId&&!roster?.members.some(m=>m.id===data.memberId))fail('Bitte den Geburtstag einem aktuellen Mitglied zuordnen.',400);
  const targetType=data.kind==='probe'?(data.sessionType||event.sessionType||'Sonderprobe'):null;
  if(data.clothing!==undefined&&(typeof data.clothing!=='string'||data.clothing.trim().length>120||/[\x00-\x1f\x7f]/.test(data.clothing)))fail('Bitte Kleidung als Text mit höchstens 120 Zeichen eingeben.',400);
  if(data.location!==undefined&&(typeof data.location!=='string'||!data.location.trim()||data.location.trim().length>300||/[\x00-\x1f\x7f]/.test(data.location)))fail('Bitte einen Ort mit 1 bis 300 Zeichen eingeben.',400);
  const location=data.location===undefined?(event.location||'GH Wasser'):data.location.trim();
  const clothingInput=data.kind==='birthday'?'':data.clothing===undefined?(event.clothing??(targetType==='Probe'?'Einsatzkleidung':targetType==='Sonderprobe'?'Tagesdienst':'')):data.clothing.trim();
  const clothing=clothingInput==='Tagdienst'?'Tagesdienst':clothingInput==='Einsatz'?'Einsatzkleidung':clothingInput;
  const attendanceType=data.kind==='probe'?(data.attendanceType||event.attendanceType||(targetType==='Probe'?'Allgemeine Probe':'Sonderprobe')):null;
  if(data.attendanceType!==undefined&&data.kind!=='probe')fail('Eine iPad-Terminart kann nur Proben und Sonderproben zugeordnet werden.',400);
  if(data.kind==='probe'&&!['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung'].includes(attendanceType))fail('Ungültige iPad-Terminart.',400);
  if(data.recipientMode!==undefined&&!['automatic','manual','legacy','groups'].includes(data.recipientMode))fail('Ungültige Mitgliederauswahl.',400);
  const previousMode=event.recipientMode;
  if(data.recipientMode==='legacy'&&previousMode!=='legacy')fail('Ungültige bisherige Auswahl.',400);
  const recipientMode=data.kind==='probe'?(data.recipientMode||(data.recipientIds!==undefined?'manual':previousMode==='automatic'?(event.automatic?'legacy':'manual'):previousMode)):'legacy';
  if(recipientMode==='groups'){
   if(data.expectedGroupsVersion!==cal.groupsVersion)fail('Gruppen wurden inzwischen geändert. Bitte neu laden.');
   const groups=await audienceGroups(env);try{data.recipientIds=g.PortalGroups.selection(data.groupIds,data.includeIds||[],data.excludeIds||[],groups.groups,roster);}catch(e){fail(e.message,400);}
  }else if(recipientMode==='automatic'){
   if(data.expectedGroupsVersion!==cal.groupsVersion)fail('Schlagwort-Gruppen wurden inzwischen geändert. Bitte neu laden.');
   // New rules may use the defaults before the first explicit group save.
   data.recipientIds=event.automaticRecipientIds;
  }else if(data.recipientIds===undefined)data.recipientIds=data.kind==='probe'&&(previousMode!=='automatic'||!event.automatic)?event.recipientIds:null;
  if(data.recipientIds!==undefined&&data.recipientIds!==null){
   if(data.kind!=='probe'||!Array.isArray(data.recipientIds)||(recipientMode!=='automatic'&&!data.recipientIds.length)||data.recipientIds.length>500||new Set(data.recipientIds).size!==data.recipientIds.length||!roster?.members||data.recipientIds.some(id=>typeof id!=='string'||!roster.members.some(m=>m.id===id)))fail('Bitte gültige Mitglieder für diesen Termin auswählen.',400);
  }
  const old=await env.DB.prepare('SELECT * FROM portal_rules WHERE id=1').first(),rules=await open(env,old,'portal-rules')||{};if((old?.version||0)!==data.expectedVersion)fail('Terminfreigaben wurden inzwischen geändert. Bitte neu laden.');
  if(data.kind==='birthday'){rules[event.seriesId]={kind:'birthday',memberId:data.memberId||null};delete rules[event.id];}else rules[event.id]={kind:data.kind,approved:data.kind==='probe'&&data.approved,expiresAt:event.end,location,clothing,...(data.kind==='probe'?{sessionType:targetType,attendanceType,recipientMode,groupsVersion:cal.groupsVersion,groupIds:recipientMode==='groups'?data.groupIds:event.groupIds,...(recipientMode==='groups'?{includeIds:data.includeIds||[],excludeIds:data.excludeIds||[]}:{}),...(Array.isArray(data.recipientIds)?{recipientIds:data.recipientIds}:{} )}:{})};
  const payload=await L.seal(env,rules,'portal-rules'),result=old?await env.DB.prepare('UPDATE portal_rules SET payload=?,version=version+1 WHERE id=1 AND version=? AND COALESCE((SELECT version FROM portal_groups WHERE id=1),0)=?').bind(payload,old.version,cal.groupsVersion).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_rules(id,payload) SELECT 1,? WHERE COALESCE((SELECT version FROM portal_groups WHERE id=1),0)=?').bind(payload,cal.groupsVersion).run();if(!result.meta.changes)fail('Freigabe wurde gleichzeitig geändert. Bitte neu laden.');return {ok:true,version:data.expectedVersion+1,recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1,attendanceType,recipientMode,recipientIds:data.kind==='probe'&&Array.isArray(data.recipientIds)?data.recipientIds:null};
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
 async function send(env,event,requestId){
  let accepted=0,failed=0,excused=0,duplicate=0,processed=0;const people=await recipients(env),campaign=requestId,already=new Set((await env.DB.prepare('SELECT member FROM portal_sends WHERE event=? AND campaign=?').bind(event.id,campaign).all()).results.map(r=>r.member)),roster=await open(env,await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),'portal-roster');let remaining=0;const replyRows=(await env.DB.prepare('SELECT * FROM portal_replies WHERE event=?').bind(event.id).all()).results,statuses=new Map();for(const row of replyRows)statuses.set(row.member,(await open(env,row,'portal-reply:'+event.id+':'+row.member)).status);
  for(const [member,records] of people){
   if(roster&&!roster.members.some(m=>m.id===member))continue;if(!isRecipient(event,member))continue;if(already.has(member)){duplicate++;continue;}
   if(statuses.get(member)==='excused'){excused++;continue;}if(processed>=2){remaining++;continue;}processed++;
   const id=await hash('portal-send:'+event.id+':'+member+':'+requestId),now=Date.now(),payload=await L.seal(env,{event:memberEvent(event),status:'reminder'},'portal-send:'+id);
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
  await ready(env);const c=await config(env);if(!c)return;const cal=await decorate(env,await calendar(env,false,c),null);if(cal.stale)return;
  await pruneFinishedEvents(env,cal);
  await env.DB.prepare('DELETE FROM portal_sends WHERE created_at<?').bind(Date.now()-30*DAY).run();
  await env.DB.prepare('DELETE FROM portal_replies WHERE updated_at<?').bind(Date.now()-400*DAY).run();
  await awardBirthdays(env,cal);
  // Calendar refresh, cleanup and birthday rewards remain automatic. Reminders require /admin/portal/remind.
 }
 async function route(path,data,env,auth,clientIP='unknown',ctx){
  await ready(env);const m=await L.meta(env);L.active(m);const admin=path.startsWith('/admin/');
   if(path==='/admin/portal/identity-ticket'){L.source(m,data);return g.WhatsAppPasskeys.admin(env,data);}
   if(path.startsWith('/portal/passkey/')){if(/\/(options|verify)$/.test(path)||path.includes('/password/'))await g.WhatsAppPasskeys.limit(env,clientIP);const action=path.slice('/portal/passkey/'.length);if(action.startsWith('portal/')||action.startsWith('enroll/')||action.startsWith('password/')||['session','logout','devices','remove','sessions/revoke'].includes(action))return g.WhatsAppPasskeys.identity(action,data,env,auth);fail('Bitte die zentrale H₂O-Passkey-Anmeldung verwenden.',401);}
   if(path.startsWith('/portal/browser/'))fail('Bitte die zentrale H₂O-Passkey-Anmeldung verwenden.',401);
   if(path.startsWith('/portal/calendar-bridge/'))return g.CalendarInvitations.bridge(path.slice('/portal/calendar-bridge/'.length),data,env,auth);
   let record;if(admin)L.source(m,data);else record=await actor(env,data,auth,path);
  if(path.startsWith('/portal/passkey/'))return g.WhatsAppPasskeys.route(path.slice('/portal/passkey/'.length),data,env,record);
  if(path==='/admin/portal/calendar-invitations')return g.CalendarInvitations.settings(env,data);
  if(/^\/(?:admin\/)?portal\/whatsapp-/.test(path))fail('WhatsApp-Erinnerungen sind entfallen. Bitte Kalendereinladungen verwenden.',410);
  if(path==='/portal/calendar-preference')return g.CalendarInvitations.preference(env,data,record);
  if(path.startsWith('/portal/hydrants/')||path.startsWith('/admin/portal/hydrants/'))return g.PortalHydrants.route(path,data,env,admin);
  const rosterRow=await env.DB.prepare('SELECT * FROM portal_roster WHERE id=1').first(),roster=await open(env,rosterRow,'portal-roster');
  if(path==='/portal/checkin-code'){
   await assertMember(env,record);
   const expiresAt=Date.now()+90000;
   const sealed=await L.seal(env,{alias:record.alias,revision:record.revision,source:m.source,expiresAt},'attendance-checkin-v1');
   return {code:'FFW-CHECKIN:1:'+btoa(sealed),expiresAt};
  }
  if(path==='/admin/portal/checkin-resolve'){
   if(typeof data.code!=='string'||data.code.length>4096||!data.code.startsWith('FFW-CHECKIN:1:'))fail('Kein gültiger Anwesenheitscode.',400);
   let ticket;try{ticket=await L.open(env,atob(data.code.slice(14)),'attendance-checkin-v1');}catch{fail('Anwesenheitscode ungültig. Bitte neu öffnen.',400);}
   if(!Number.isFinite(ticket.expiresAt)||ticket.expiresAt<=Date.now()||ticket.expiresAt>Date.now()+90000||ticket.source!==m.source)fail('Code abgelaufen. Bitte im Portal neu öffnen.',400);
   const active=await assertAlias(env,ticket.alias);
   if(!active||active.revision!==ticket.revision||!roster?.members.some(person=>person.id===active.memberId))fail('Mitgliedszugang nicht mehr freigegeben.',403);
   return {memberId:active.memberId};
  }
  if(path.startsWith('/portal/theater/')||path.startsWith('/admin/portal/theater/'))return g.TheaterService.route(path,data,env,admin,record,roster);
  if(path==='/admin/portal/groups'){
   const current=await audienceGroups(env);
   if(data.groups===undefined)return {...current,rosterUpdatedAt:roster?.updatedAt||null,members:(roster?.members||[]).map(({id,name,agt,leader,ageDepartment,committeeMember})=>({id,name,agt,leader,ageDepartment,committeeMember}))};
   if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion!==current.version)fail('Gruppen wurden inzwischen geändert. Bitte neu laden.');
   let groups;try{groups=g.PortalGroups.validate(data.groups);}catch(e){fail(e.message,400);}
   const oldIds=new Set(current.groups.flatMap(group=>group.memberIds));
   if(groups.some(group=>group.memberIds.some(id=>!roster?.members.some(m=>m.id===id)&&!oldIds.has(id))))fail('Mitglied nicht mehr vorhanden. Bitte neu laden.',400);
   const payload=await L.seal(env,{groups},'portal-groups');
   const result=current.version?await env.DB.prepare('UPDATE portal_groups SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,current.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_groups(id,payload) VALUES(1,?)').bind(payload).run();
   if(!result.meta.changes)fail('Gruppen wurden gleichzeitig geändert. Bitte neu laden.');
   return {ok:true,version:current.version+1};
  }
  if(path==='/portal/regulations/pdf'){
   const url=g.RegulationsModel.pdfUrl(data.url);if(!url)fail('Kein gültiger offizieller PDF-Link.',400);
   const row=await env.DB.prepare('SELECT * FROM portal_regulations WHERE id=1').first(),items=row?(await open(env,row,'portal-regulations')).items:g.RegulationsModel.defaults();
   if(!items.some(item=>item.url===url))fail('Diese Vorschrift ist nicht in der freigegebenen Auswahl.',404);
   const upstream=await fetch(url,{redirect:'error',headers:{Accept:'application/pdf'},signal:AbortSignal.timeout(60000),cf:{cacheTtl:86400,cacheEverything:true}});
   if(!upstream.ok||!upstream.body)fail('Die Original-PDF ist derzeit nicht erreichbar.',502);
   const max=30*1024*1024;if(Number(upstream.headers.get('Content-Length'))>max){await upstream.body.cancel();fail('Die PDF ist zu groß für die Buchansicht. Bitte das Original öffnen.',413);}
   const reader=upstream.body.getReader();let prefix=new Uint8Array(0),size=0;
   try{while(prefix.length<5){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max)fail('Die PDF ist zu groß.',413);const next=new Uint8Array(prefix.length+part.value.length);next.set(prefix);next.set(part.value,prefix.length);prefix=next;}
    if(new TextDecoder().decode(prefix.slice(0,5))!=='%PDF-')fail('Die Quelle hat keine gültige PDF geliefert.',502);
   }catch(error){await reader.cancel().catch(()=>{});throw error;}
   let first=true;
   const stream=new ReadableStream({async pull(controller){try{if(first){first=false;controller.enqueue(prefix);return;}const part=await reader.read();if(part.done){controller.close();return;}size+=part.value.length;if(size>max){await reader.cancel();controller.error(Error('PDF überschreitet die maximale Größe.'));return;}controller.enqueue(part.value);}catch(error){await reader.cancel().catch(()=>{});controller.error(error);}},cancel(reason){return reader.cancel(reason);}});
   return new Response(stream,{headers:{'Content-Type':'application/pdf'}});
  }
  if(path==='/portal/regulations'||path==='/admin/portal/regulations'){
   const row=await env.DB.prepare('SELECT * FROM portal_regulations WHERE id=1').first();
   if(admin&&Object.prototype.hasOwnProperty.call(data,'items')){
    let items;try{items=g.RegulationsModel.validate(data.items);}catch(e){fail(e.message,400);}
    if(!Number.isInteger(data.expectedVersion)||data.expectedVersion!==(row?.version||0))fail('Die Auswahl wurde zwischenzeitlich geändert. Bitte erneut laden.',409);
    const payload=await L.seal(env,{items},'portal-regulations'),version=data.expectedVersion+1;
    const saved=await env.DB.prepare('INSERT INTO portal_regulations(id,payload,version) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=excluded.version WHERE portal_regulations.version=?').bind(payload,version,data.expectedVersion).run();
    if(!saved.meta.changes)fail('Die Auswahl wurde zwischenzeitlich geändert. Bitte erneut laden.',409);
    return {items,version};
   }
   return {items:row?(await open(env,row,'portal-regulations')).items:g.RegulationsModel.defaults(),version:row?.version||0};
  }
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
   if(!Array.isArray(data.members)||data.members.length>500||new Set(data.members.map(m=>m.id)).size!==data.members.length||data.members.some(m=>typeof m.id!=='string'||!m.id||m.id.length>200||typeof m.name!=='string'||!m.name.trim()||m.name.length>200||typeof m.leader!=='boolean'||['ageDepartment','committeeMember'].some(k=>m[k]!==undefined&&typeof m[k]!=='boolean')||m.agt!==undefined&&m.agt!==null&&typeof m.agt!=='boolean'))fail('Ungültige Mitgliederfreigabe.',400);
   let people;try{people=data.members.map(m=>({id:m.id,name:m.name,ageDepartment:m.ageDepartment===undefined?roster?.members.find(p=>p.id===m.id)?.ageDepartment===true:m.ageDepartment===true,committeeMember:m.committeeMember===undefined?roster?.members.find(p=>p.id===m.id)?.committeeMember===true:m.committeeMember===true,firstName:typeof m.firstName==='string'?m.firstName.slice(0,100):'',leader:m.leader,agt:m.agt===true?true:m.agt===false?false:null,...(m.evidence!==undefined?{evidence:g.MemberEvidence.validate(m.evidence),evidenceUpdatedAt:Date.now()}:(()=>{const old=roster?.members.find(p=>p.id===m.id);return old?.evidence?{evidence:old.evidence,evidenceUpdatedAt:old.evidenceUpdatedAt||null}:{};})())}));}catch(e){fail(e.message,400);}people=people.map(person=>({...person,evidenceRevisions:g.PortalEvidence.revisions(person,roster?.members.find(old=>old.id===person.id))}));const payload=await L.seal(env,{members:people,updatedAt:Date.now(),agtSource:data.agtSource==='member-checkbox'?'member-checkbox':null},'portal-roster');
   // A roster change and every credential revocation are one transaction.
   // The sequence CAS also invalidates ledger/game writes started before removal.
   const marker='EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?)';
   const statements=[env.DB.prepare('INSERT INTO portal_roster(id,payload) SELECT 1,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(payload,m.seq)];
   const activeMembers=new Set(people.map(p=>p.id));
   const removed=new Set((roster?.members||[]).map(p=>p.id).filter(id=>!activeMembers.has(id)));
   if(removed.size)statements.push(env.DB.prepare("UPDATE portal_calendar_profiles SET email_hash=NULL,payload='',version=version+1 WHERE member IN (SELECT value FROM json_each(?)) AND "+marker).bind(JSON.stringify([...removed]),payload));
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
    for(const table of ['portal_identity_sessions','portal_identity_grants','portal_identity_tickets','portal_passwords','portal_passkeys','portal_passkey_challenges','portal_browser_sessions','portal_browser_pairs','devices','ledger_access','accounts'])statements.push(env.DB.prepare('DELETE FROM '+table+' WHERE '+scope).bind(aliases,payload));
    statements.push(env.DB.prepare("UPDATE commands SET status='rejected',result='accessChanged',envelope='' WHERE status='pending' AND "+scope).bind(aliases,payload));
   }
   statements.push(env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND '+marker).bind(m.seq,payload));
   const result=await env.DB.batch(statements);
   if(!result[0].meta.changes)fail('Mitglieder oder Konten wurden gleichzeitig geändert. Bitte erneut synchronisieren.',409);
   return {ok:true,evidenceVersion:1,removedBrowserMembers:removed.size};
  }
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
   if(path==='/admin/portal/evidence/overview')return g.PortalEvidence.overview(env,roster);
   if(path==='/admin/portal/evidence'||path==='/admin/portal/evidence/review'){
    const member=roster?.members.find(person=>person.id===data.memberId);
    return path.endsWith('/review')?g.PortalEvidence.write(env,member,roster,data,true,m):g.PortalEvidence.read(env,member,roster);
   }
  if(path==='/admin/portal/birthday-status')return {birthdayPolicy:(await birthdayPolicy(env)).value};
  if(path==='/admin/portal/birthday-policy')return saveBirthdayPolicy(env,data);
  if(path.startsWith('/admin/portal/google-oauth/'))return g.GoogleCalendarOAuth.route(path.slice('/admin/portal/google-oauth/'.length),data,env,m.source);
  if(path.startsWith('/admin/portal/google-api/')){
   const action=path.slice('/admin/portal/google-api/'.length);
   if(action==='resolve'){
    if(!/^[A-Za-z0-9_-]{43}$/.test(data.eventId||''))fail('Ungültiger Kalendertermin.',400);
    let cal=await calendar(env),event=cal.events.find(e=>e.id===data.eventId);if(!event?.googleUid){cal=await calendar(env,true);event=cal.events.find(e=>e.id===data.eventId);}
    if(cal.stale||!event?.googleUid)fail('Google-Termin bitte zuerst im Kalender aktualisieren.',409);
    data={...data,googleUid:event.googleUid,googleOccurrence:event.googleOccurrence,from:event.start-86400000,to:event.end+86400000};
   }
   return g.GoogleCalendarAPI.route(action,data,env,await config(env));
  }
  if(path==='/admin/portal/google-colors'){
   const row=await env.DB.prepare('SELECT * FROM portal_config WHERE id=1').first(),c=await open(env,row,'portal-config');if(!c)fail('Bitte zuerst den Google-Kalender verbinden.',400);
   if(data.enabled===undefined)return {configured:!!c.googleColorBridge,endpoint:c.googleColorBridge?.endpoint||'',version:row.version};
   if(typeof data.enabled!=='boolean'||data.expectedVersion!==row.version)fail('Kalenderverbindung wurde geändert. Bitte neu laden.',409);
   if(data.enabled){try{c.googleColorBridge=g.GoogleCalendarColors.validate(data.endpoint,data.secret||c.googleColorBridge?.secret);}catch(e){fail(e.message,400);}}else delete c.googleColorBridge;
   const payload=await L.seal(env,c,'portal-config'),saved=await env.DB.prepare('UPDATE portal_config SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,row.version).run();if(!saved.meta.changes)fail('Kalenderverbindung wurde gleichzeitig geändert.',409);
   return {configured:!!c.googleColorBridge,endpoint:c.googleColorBridge?.endpoint||'',version:row.version+1};
  }
  if(path==='/admin/portal/colors')return calendarColors(env,data);
  if(path==='/admin/portal/year')return yearCalendar(env,data.year,ctx,data.background===true);
  if(path==='/portal/year'){
   const calendarManaged=await g.CalendarInvitations.managedEvents(env,record.memberId),calendarLinkOnly=await g.CalendarInvitations.linkMode(env);
   const cal=await yearCalendar(env,data.year);
   // Preserve the same audience as the personal appointment list. Other people's
   // birthdays, unapproved entries and administration metadata stay private.
   return {year:cal.year,configured:cal.configured,fetchedAt:cal.fetchedAt,stale:cal.stale,colors:cal.colors,colorVersion:cal.colorVersion,
    events:cal.events.filter(e=>e.kind==='probe'&&e.approved&&isRecipient(e,record.memberId)||e.kind==='birthday'&&e.memberId===record.memberId||e.kind==='info'&&e.infoVisible&&isRecipient(e,record.memberId)).map(e=>({
     id:e.id,calendarManaged:calendarManaged.has(e.id),calendarLinkOnly,title:e.kind==='birthday'?'Dein Geburtstag':e.title,start:e.start,end:e.end,allDay:e.allDay===true,kind:e.kind,...(e.googleColor?{googleColor:e.googleColor}:{}),
     ...(e.kind==='probe'?{sessionType:e.sessionType,attendanceType:e.attendanceType,location:e.location,clothing:e.clothing,note:e.note,approved:true}:e.kind==='info'?{note:e.note}:{})
    }))};
  }
  if(path==='/admin/portal/config'){
   const c=await config(env),safe=c?{...c}:c;if(safe)delete safe.googleColorBridge;return {configured:!!c,config:safe||null};
  }
  if(path==='/admin/portal/configure'){
   const url=calendarURL(data.calendarUrl);if(![1,2,6,12,24,48].includes(data.leadHours))fail('Ungültige Erinnerungseinstellungen.',400);
   const old=await config(env);if(old&&old.calendarUrl!==url)fail('Ein Kalenderwechsel würde die Terminzuordnung ändern. Bitte den vorhandenen Kalender weiterverwenden.');
   const events=await projection(url),existing=await config(env),c={...(existing?.calendarUrl===url?existing:{}),calendarUrl:url,reminders:false,leadHours:data.leadHours},payload=await L.seal(env,c,'portal-config'),cal=await L.seal(env,{events},'portal-calendar');
   await env.DB.batch([env.DB.prepare('INSERT INTO portal_config(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=version+1').bind(payload),env.DB.prepare('INSERT INTO portal_calendar(id,payload,fetched_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').bind(cal,Date.now())]);return {ok:true,count:events.length};
  }
  if(path==='/portal/push-devices'){
   const deviceURL=data.endpoint===undefined?null:endpoint(data.endpoint);
   if(data.reset!==undefined&&typeof data.reset!=='boolean')fail('Ungültige Geräteaktion.',400);
   if(data.reset===true)await env.DB.batch([
    env.DB.prepare('DELETE FROM portal_devices WHERE id IN (SELECT id FROM devices WHERE alias=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?)').bind(record.alias,record.alias,record.revision),
    env.DB.prepare('DELETE FROM devices WHERE alias=? AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?)').bind(record.alias,record.alias,record.revision)
   ]);
   const count=(await env.DB.prepare('SELECT COUNT(*) n FROM devices WHERE alias=?').bind(record.alias).first()).n;
   const registered=deviceURL?!!await env.DB.prepare('SELECT id FROM devices WHERE alias=? AND revision=? AND endpoint=?').bind(record.alias,record.revision,deviceURL).first():false;
   const renewable=deviceURL?!!await env.DB.prepare('SELECT id FROM devices WHERE alias=? AND endpoint=?').bind(record.alias,deviceURL).first():false;
   return {ok:true,count,limit:5,registered,renewable};
  }
  if(path==='/portal/subscribe'||path==='/portal/unsubscribe'){
   const url=endpoint(data.endpoint),id=await hash(url);if(path.endsWith('/unsubscribe')){await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(id,data.alias).run();return {ok:true};}
   const old=await env.DB.prepare('SELECT alias FROM devices WHERE id=?').bind(id).first();if(old&&old.alias!==data.alias)fail('Auf diesem Handy zuerst die Erinnerungen des anderen Mitglieds deaktivieren.');
   const saved=await env.DB.prepare('INSERT INTO devices(id,alias,revision,endpoint) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?) AND ((SELECT COUNT(*) FROM devices WHERE alias=?)<5 OR EXISTS(SELECT 1 FROM devices WHERE id=? AND alias=?)) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision WHERE devices.alias=excluded.alias').bind(id,data.alias,data.revision,url,data.alias,data.revision,data.alias,id,data.alias).run();if(!saved.meta.changes)fail('Maximal fünf Geräte pro Mitglied.');await env.DB.prepare('INSERT OR IGNORE INTO portal_devices(id) VALUES(?)').bind(id).run();return {ok:true};
  }
  if(path==='/portal/notification'){
   const row=await env.DB.prepare("SELECT * FROM portal_sends WHERE member=? AND status IN ('pending','accepted') AND created_at>? ORDER BY created_at DESC LIMIT 1").bind(record.memberId,Date.now()-DAY).first();if(!row)return {event:null};const value=await open(env,row,'portal-send:'+row.id),cal=await decorate(env,await calendar(env)),event=cal.events.find(e=>e.id===value.event.id&&e.approved&&e.kind==='probe'&&isRecipient(e,record.memberId));
   return {event:event&&event.start>Date.now()&&(await replyFor(env,event.id,record.memberId)).status!=='excused'?memberEvent(event):null};
  }
  const cal=await decorate(env,await (['/portal/list','/admin/portal/list','/portal/reply','/portal/overview','/admin/portal/replies'].includes(path)?cachedCalendar(env,15*60*1000,path==='/portal/list',ctx):calendar(env)),undefined,path==='/portal/list'?ctx:undefined);
  if(path==='/admin/portal/display')return saveCalendarDisplay(env,data,cal,roster);
  if(path==='/admin/portal/classify')return classify(env,data,cal,roster);
  if(path==='/admin/portal/request-responses'){
   const saved=await g.CalendarInvitations.requestResponses(env,data,cal);
   if(data.notify===true&&await g.CalendarInvitations.linkMode(env))return {...saved,...await send(env,cal.events.find(e=>e.id===data.eventId),saved.requestId)};
   return saved;
  }
  if(path==='/portal/list'){
   const calendarManaged=await g.CalendarInvitations.managedEvents(env,record.memberId),calendarLinkOnly=await g.CalendarInvitations.linkMode(env);
   const ownBirthday=cal.events.some(e=>e.kind==='birthday'&&e.memberId===record.memberId&&berlinDay(e.start)===berlinDay(Date.now())),birthdayRow=ownBirthday?await env.DB.prepare('SELECT * FROM portal_birthdays WHERE member=? AND year=?').bind(record.memberId,Number(berlinDay(Date.now()).slice(0,4))).first():null,birthday=ownBirthday?{today:true,awarded:!!birthdayRow,awardUnits:birthdayRow?(await open(env,birthdayRow,'birthday:'+record.memberId+':'+berlinDay(Date.now()).slice(0,4))).awardUnits:(await birthdayPolicy(env)).value.awardUnits}:null;const replies=(await env.DB.prepare('SELECT * FROM portal_replies WHERE member=?').bind(record.memberId).all()).results,map=new Map();for(const row of replies)map.set(row.event,{status:(await open(env,row,'portal-reply:'+row.event+':'+record.memberId)).status,version:row.version,updatedAt:row.updated_at||null});const requestedId=typeof data.eventId==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.eventId)?data.eventId:null;const requestedEvent=requestedId?cal.events.find(e=>e.id===requestedId):null;const eventLinkStatus=!requestedId?null:requestedEvent?.approved&&requestedEvent.kind==='probe'&&requestedEvent.end>Date.now()?(isRecipient(requestedEvent,record.memberId)?null:'not-relevant'):'unavailable';return {...cal,eventLinkStatus,memberName:roster?.members.find(m=>m.id===record.memberId)?.name||'',uncertainReplies:true,birthday,leader:roster?.members.some(m=>m.id===record.memberId&&m.leader)===true,events:cal.events.filter(e=>e.approved&&e.kind==='probe'&&e.end>Date.now()&&isRecipient(e,record.memberId)).map(e=>({...memberEvent(e),calendarManaged:calendarManaged.has(e.id),calendarLinkOnly,...(map.get(e.id)||{status:'open',version:0})}))};
  }
  if(path==='/admin/portal/list')return {...cal,calendarLinkOnly:await g.CalendarInvitations.linkMode(env),googleInstructionVersion:1,recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1};
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
  if(path==='/portal/remind'){
   if(!roster?.members.some(m=>m.id===record.memberId&&m.leader))fail('Erinnerungen sind nur für hinterlegte Gruppenführer freigegeben.',403);
   if(!event.responseRequested)fail('Die Rückmeldung für diesen Termin wurde noch nicht angefordert.',423);
   if(!REV.test(data.requestId||''))fail('Ungültige Versandkennung.',400);
   return send(env,event,data.requestId);
  }
  if(path==='/admin/portal/remind'){
   if(!event.responseRequested)fail('Bitte zuerst die Rückmeldung für diesen Termin anfordern.',423);
   if(!REV.test(data.requestId||''))fail('Ungültige Versandkennung.',400);return send(env,event,data.requestId);
  }
  if(path==='/portal/reply'){
   if(!event.responseRequested)fail('Die Rückmeldung für diesen Termin wurde noch nicht angefordert.',423);
   if(!['yes','excused','maybe','open'].includes(data.status)||!REV.test(data.requestId||'')||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Rückmeldung.',400);
   const old=await env.DB.prepare('SELECT * FROM portal_replies WHERE event=? AND member=?').bind(event.id,record.memberId).first(),previous=await open(env,old,'portal-reply:'+event.id+':'+record.memberId);
   if(previous?.requestId===data.requestId){if(previous.status!==data.status)fail('Vorgangsnummer wurde bereits anders verwendet.');return {ok:true,status:previous.status,version:old.version,updatedAt:old.updated_at||null};}
   if((old?.version||0)!==data.expectedVersion)fail('Deine Rückmeldung wurde inzwischen geändert. Bitte aktualisieren.');
   const updatedAt=Date.now(),payload=await L.seal(env,{status:data.status,source:'h2o',requestId:data.requestId,updatedAt},'portal-reply:'+event.id+':'+record.memberId);
   const result=old?await env.DB.prepare('UPDATE portal_replies SET payload=?,updated_at=?,version=version+1 WHERE event=? AND member=? AND version=?').bind(payload,updatedAt,event.id,record.memberId,old.version).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_replies(event,member,payload,updated_at) VALUES(?,?,?,?)').bind(event.id,record.memberId,payload,updatedAt).run();if(!result.meta.changes)fail('Rückmeldung wurde gleichzeitig geändert. Bitte aktualisieren.');return {ok:true,status:data.status,version:data.expectedVersion+1,updatedAt};
  }
  fail('Nicht gefunden.',404);
 }
 // Use the synchronized snapshot for reads and replies with the same freshness limit.
 // Member reads return the saved snapshot while waitUntil refreshes Google.
 // Without an execution context, preserve the synchronous refresh fallback.
 // Reply and overview requests never wait for Google.
 async function cachedCalendar(env,maxAgeMs=15*60*1000,refreshExpired=false,ctx){
  const c=await config(env);
  if(!c)return {configured:false,events:[],fetchedAt:null,stale:true};
  const row=await env.DB.prepare('SELECT * FROM portal_calendar WHERE id=1').first();
  if(!row)return calendar(env,false,c);
  if(refreshExpired&&(!row.fetched_at||row.fetched_at<Date.now()-maxAgeMs)){
   if(ctx?.waitUntil)ctx.waitUntil(calendar(env,false,c).catch(()=>{}));
   else return calendar(env,false,c);
  }
  return {...await open(env,row,'portal-calendar'),configured:true,fetchedAt:row.fetched_at,
   stale:!row.fetched_at||row.fetched_at<Date.now()-maxAgeMs};
 }
 async function publicCalendar(env,year=null){
  await ready(env);
  const cal=year===null?await decorate(env,await cachedCalendar(env)):await yearCalendar(env,year);
  // Show all approved probe dates, including selected-member appointments. Never expose the recipient list, member names, birthdays, replies, or the private iCal URL.
  return {configured:cal.configured===true,fetchedAt:cal.fetchedAt||null,stale:cal.stale===true,
   ...(year===null?{}:{year}),events:cal.events.filter(e=>e.approved===true&&e.kind==='probe'&&(year!==null||e.end>Date.now())).map(e=>({
    id:e.id,title:e.sessionType==='Probe'?'Probe':'Sonderprobe',start:e.start,end:e.end,
    allDay:e.allDay===true,sessionType:e.sessionType==='Probe'?'Probe':'Sonderprobe',attendanceType:e.attendanceType,kind:'probe',approved:true,
    audienceRestricted:Array.isArray(e.recipientIds)
   }))};
 }
 g.PortalService={calendar,config,assertMember,assertAlias,route,scheduled,ready,calendarURL,projection,send,decorate,awardBirthdays,publicCalendar};
})(globalThis);
