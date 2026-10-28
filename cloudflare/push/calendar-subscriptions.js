/* Personal read-only calendar feeds. The opaque link grants calendar access only. */
(function(g){
 'use strict';
 const L=g.CentralLedger,origin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
 const schema=['CREATE TABLE IF NOT EXISTS portal_calendar_subscriptions (member TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_calendar_usage (member TEXT PRIMARY KEY,alias TEXT NOT NULL,payload TEXT NOT NULL)'];
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('calendar-subscription:'+token))),n=>n.toString(16).padStart(2,'0')).join('');
 const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const open=(env,row)=>row?L.open(env,row.payload,'calendar-subscription:'+row.member):null;
 async function subscription(env,data,record){
  await g.PortalService.assertMember(env,record);const meta=await L.meta(env);L.active(meta);
  if(!await g.PortalService.config(env))return {subscriptionUrl:null,version:0};
  const row=await env.DB.prepare('SELECT * FROM portal_calendar_subscriptions WHERE member=?').bind(record.memberId).first(),old=await open(env,row);
  if(data.reset!==undefined&&typeof data.reset!=='boolean')fail('Ungültige Kalenderaktion.',400);
  if(data.reset===true&&data.expectedVersion!==(row?.version||0))fail('Der Kalenderlink wurde inzwischen geändert. Bitte neu laden.');
  if(data.reset!==true&&row?.alias===record.alias&&row.revision===record.revision&&old?.source===meta.source)return {subscriptionUrl:origin+'/calendar/member/'+old.token+'.ics',version:row.version};
  const token=random(),tokenHash=await digest(token),payload=await L.seal(env,{token,source:meta.source},'calendar-subscription:'+record.memberId);
  const guard="EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND source=? AND state='active') AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?)";
  const result=row?await env.DB.prepare('UPDATE portal_calendar_subscriptions SET alias=?,revision=?,token_hash=?,payload=?,version=version+1 WHERE member=? AND version=? AND '+guard).bind(record.alias,record.revision,tokenHash,payload,record.memberId,row.version,meta.source,record.alias,record.revision).run():await env.DB.prepare('INSERT OR IGNORE INTO portal_calendar_subscriptions(member,alias,revision,token_hash,payload) SELECT ?,?,?,?,? WHERE '+guard).bind(record.memberId,record.alias,record.revision,tokenHash,payload,meta.source,record.alias,record.revision).run();
  if(!result.meta.changes){if(data.reset===true)fail('Der Kalenderlink wurde gleichzeitig geändert. Bitte neu laden.');const winner=await env.DB.prepare('SELECT * FROM portal_calendar_subscriptions WHERE member=? AND alias=? AND revision=?').bind(record.memberId,record.alias,record.revision).first(),value=await open(env,winner);if(value?.source===meta.source)return {subscriptionUrl:origin+'/calendar/member/'+value.token+'.ics',version:winner.version};fail('Kalenderzugang wurde geändert. Bitte neu laden.');}
  await g.PortalService.assertMember(env,record);
  return {subscriptionUrl:origin+'/calendar/member/'+token+'.ics',version:(row?.version||0)+1};
 }
 async function resolve(env,token){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))fail('Kalenderabo nicht verfügbar.',404);
  const row=await env.DB.prepare('SELECT s.* FROM portal_calendar_subscriptions s JOIN accounts a ON a.alias=s.alias AND a.revision=s.revision JOIN ledger_access l ON l.alias=s.alias AND l.revision=s.revision WHERE s.token_hash=?').bind(await digest(token)).first();
  if(!row)fail('Kalenderabo nicht verfügbar.',404);const meta=await L.meta(env),value=await open(env,row);L.active(meta);if(value?.source!==meta.source)fail('Kalenderabo nicht verfügbar.',404);
  const access=await env.DB.prepare('SELECT payload FROM ledger_access WHERE alias=? AND revision=?').bind(row.alias,row.revision).first();if(!access)fail('Kalenderabo nicht verfügbar.',404);
  const record=await L.open(env,access.payload,'access:'+row.alias);if(record.memberId!==row.member)fail('Kalenderabo nicht verfügbar.',404);await g.PortalService.assertMember(env,record);return record;
 }
 const utc=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const day=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms)).replace(/-/g,'');
 const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 function fold(line){let result='',part='',length=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(length+size>75){result+=part+'\r\n';part=' ';length=1;}part+=ch;length+=size;}return result+part;}
 function serialize(events,updatedAt){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Feuerwehr Wasser//H2O Personal Calendar//DE','CALSCALE:GREGORIAN','X-WR-CALNAME:H₂O – Meine Feuerwehrtermine','REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H'];
  for(const e of events){const link=g.CalendarPresentation.responseLink(e.id);lines.push('BEGIN:VEVENT','UID:'+e.id+'@h2o.feuerwehr-wasser','DTSTAMP:'+utc(updatedAt),...(e.allDay?['DTSTART;VALUE=DATE:'+day(e.start),'DTEND;VALUE=DATE:'+day(e.end)]:['DTSTART:'+utc(e.start),'DTEND:'+utc(e.end)]),'CLASS:PRIVATE','SUMMARY:'+escape(e.title),'LOCATION:'+escape(e.location),'DESCRIPTION:'+escape('H₂O-Rückmeldung: '+link+(e.clothing?'\nKleidung: '+e.clothing:'')+(e.note?'\n'+e.note:'')),'URL:'+link,'END:VEVENT');}
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
 }
 async function overview(env,roster,source){
  // Only current account revisions and the current data source can contribute a status.
  const rows=(await env.DB.prepare('SELECT l.alias,l.revision,l.payload,(SELECT COUNT(*) FROM devices d WHERE d.alias=l.alias AND d.revision=l.revision) AS devices FROM ledger_access l JOIN accounts a ON a.alias=l.alias AND a.revision=l.revision').all()).results;
  const subscriptions=new Map((await env.DB.prepare('SELECT * FROM portal_calendar_subscriptions').all()).results.map(row=>[row.member,row]));
  const usage=new Map((await env.DB.prepare('SELECT * FROM portal_calendar_usage').all()).results.map(row=>[row.member,row]));
  const members=new Map((roster?.members||[]).map(person=>[person.id,{memberId:person.id,pushDevices:0,calendarLastFetchedAt:null}]));
  for(const row of rows){
   const record=await L.open(env,row.payload,'access:'+row.alias),person=members.get(record.memberId);if(!person||record.alias!==row.alias||record.revision!==row.revision)continue;
   person.pushDevices+=Number(row.devices)||0;
   const sub=subscriptions.get(record.memberId),read=usage.get(record.memberId);
   if(!sub||sub.alias!==row.alias||sub.revision!==row.revision||!read||read.alias!==row.alias)continue;
   const [value,seen]=await Promise.all([open(env,sub),L.open(env,read.payload,'calendar-usage:'+record.memberId)]);
   if(value.source===source&&seen.source===source&&seen.tokenHash===sub.token_hash&&Number.isFinite(seen.lastFetchedAt))person.calendarLastFetchedAt=Math.max(person.calendarLastFetchedAt||0,seen.lastFetchedAt);
  }
  return {version:1,source,checkedAt:Date.now(),members:[...members.values()]};
 }
 async function markFetched(env,record,token){
  const meta=await L.meta(env),tokenHash=await digest(token),payload=await L.seal(env,{source:meta.source,tokenHash,lastFetchedAt:Date.now()},'calendar-usage:'+record.memberId);
  // A late request cannot resurrect usage after link reset, revocation or source change.
  await env.DB.prepare("INSERT INTO portal_calendar_usage(member,alias,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM portal_calendar_subscriptions s JOIN accounts a ON a.alias=s.alias AND a.revision=s.revision WHERE s.member=? AND s.alias=? AND s.revision=? AND s.token_hash=?) AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND source=? AND state='active') ON CONFLICT(member) DO UPDATE SET alias=excluded.alias,payload=excluded.payload").bind(record.memberId,record.alias,payload,record.memberId,record.alias,record.revision,tokenHash,meta.source).run();
 }
 async function feed(env,token,method='GET'){
  await g.PortalService.ready(env);const record=await resolve(env,token),cal=await g.PortalService.personalCalendar(env,record);
  // Recheck after a slow source fetch: reset/removal may have invalidated the link meanwhile.
  await resolve(env,token);const result=serialize(cal.events,cal.fetchedAt);if(method==='GET')await markFetched(env,record,token).catch(()=>{});return result;
 }
 g.PortalCalendarSubscriptions={schema,subscription,feed,overview};
})(globalThis);
