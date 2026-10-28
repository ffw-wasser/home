/* Personal read-only calendar feeds. The opaque link grants calendar access only. */
(function(g){
 'use strict';
 const L=g.CentralLedger,origin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
 const schema=['CREATE TABLE IF NOT EXISTS portal_calendar_subscriptions (member TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)'];
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
 async function feed(env,token){
  await g.PortalService.ready(env);const record=await resolve(env,token),cal=await g.PortalService.personalCalendar(env,record);
  // Recheck after a slow source fetch: reset/removal may have invalidated the link meanwhile.
  await resolve(env,token);return serialize(cal.events,cal.fetchedAt);
 }
 g.PortalCalendarSubscriptions={schema,subscription,feed};
})(globalThis);
