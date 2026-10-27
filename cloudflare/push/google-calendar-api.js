/* Optional Google API transport. H2O authority and Google authority are independent.
   Caller tokens are short-lived and never persisted, returned or logged here.
   OAuth consent/client configuration and live acceptance remain a deployment gate. */
(function(g){
 'use strict';
 const scope='https://www.googleapis.com/auth/calendar.events',readScope='https://www.googleapis.com/auth/calendar.events.readonly';
 const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
 const fields='id,iCalUID,etag,summary,description,location,start,end,recurrence,recurringEventId,originalStartTime,status,updated,htmlLink';
 async function json(url,token,options={}){
  let response;try{response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{fail('Google-Kalenderdienst nicht erreichbar (G03). Verbindung bitte erneut prüfen; bei Terminänderungen zuerst den Google-Kalender kontrollieren.',503);}
  // Do not follow redirects with the caller's Authorization header.
  if(response.status>=300&&response.status<400)fail('Google-Kalenderdienst antwortete mit einer nicht erlaubten Weiterleitung (G03).',503);
  if(response.status===412)fail('Der Google-Termin wurde inzwischen geändert. Bitte neu laden.',409);
  if(!response.ok)fail(response.status===401?'Google-Anmeldung abgelaufen. Bitte erneut verbinden.':response.status===403?'Google erlaubt diesen Kalenderzugriff nicht.':'Google Kalender derzeit nicht erreichbar.',response.status===401?401:response.status===403?403:503);
  if(response.status===204)return {};
  let value;try{value=await response.json();}catch{fail('Google-Kalenderdienst lieferte keine gültige Antwort (G03). Bei Terminänderungen zuerst den Google-Kalender kontrollieren.',503);}
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Google-Kalenderdienst lieferte keine gültige Antwort (G03). Bei Terminänderungen zuerst den Google-Kalender kontrollieren.',503);
  return value;
 }
 function calendarId(configuration){try{return decodeURIComponent(new URL(configuration.calendarUrl).pathname.split('/')[3]);}catch{fail('Bitte zuerst den bestehenden ICS-Kalender verbinden.',400);}}
 function eventData(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['summary','description','location','start','end','recurrence'].includes(key)))fail('Ungültige Google-Termindaten.',400);
  const out={};for(const key of ['summary','description','location']){if(typeof value[key]!=='string'||value[key].length>(key==='description'?4000:key==='summary'?240:300))fail('Titel, Beschreibung und Ort bitte prüfen.',400);out[key]=value[key];}
  if(!out.summary.trim())fail('Bitte einen Titel eingeben.',400);
  const time=value=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['date','dateTime','timeZone'].includes(key)))fail('Ungültige Terminzeit.',400);if(value.date&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)&&Number.isFinite(Date.parse(value.date))&&new Date(value.date).toISOString().slice(0,10)===value.date&&!value.dateTime)return {date:value.date};if(typeof value.dateTime==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.dateTime)&&Number.isFinite(Date.parse(value.dateTime))&&!value.date)return {dateTime:value.dateTime,...(value.timeZone==='Europe/Berlin'?{timeZone:value.timeZone}:{})};fail('Bitte vollständige Terminzeiten mit Zeitzone verwenden.',400);};
  out.start=time(value.start);out.end=time(value.end);if(!!out.start.date!==!!out.end.date||Date.parse(out.end.date||out.end.dateTime)<=Date.parse(out.start.date||out.start.dateTime))fail('Terminende muss nach dem Beginn liegen.',400);
  if(value.recurrence!==undefined){if(!Array.isArray(value.recurrence)||value.recurrence.length>10||value.recurrence.some(v=>typeof v!=='string'||v.length>500||! /^(RRULE|RDATE|EXDATE)[;:]/.test(v)||/[\r\n]/.test(v)))fail('Ungültige Wiederholung.',400);out.recurrence=value.recurrence;}
  return out;
 }
 async function route(action,data,env,configuration){
  const client=env.GOOGLE_CALENDAR_CLIENT_ID;
  if(action==='configuration')return {configured:!!client,clientId:client||null,scope,readScope};
  if(!client)fail('Google-OAuth ist noch nicht eingerichtet. Der ICS-Import bleibt verfügbar.',503);
  const token=data.googleAccessToken;if(typeof token!=='string'||token.length<20||token.length>4096||/[\s\x00-\x1f]/.test(token))fail('Bitte zuerst Google Kalender verbinden.',401);
  // Validate audience and scopes, rather than accepting arbitrary Google tokens.
  let verification;try{verification=await fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(token),{redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{fail('Google-Zugangsprüfung nicht erreichbar (G02). Bitte erneut verbinden.',503);}
  if(verification.status>=300&&verification.status<400)fail('Google-Zugangsprüfung antwortete mit einer nicht erlaubten Weiterleitung (G02).',503);
  if(verification.status>=500||verification.status===429)fail('Google-Zugangsprüfung vorübergehend nicht verfügbar (G02). Bitte später erneut verbinden.',503);
  if(!verification.ok)fail('Google-Zugang ungültig oder abgelaufen.',401);
  let info;try{info=await verification.json();}catch{fail('Google-Zugangsprüfung lieferte keine gültige Antwort (G02). Bitte erneut verbinden.',503);}
  if(!info||typeof info!=='object'||Array.isArray(info))fail('Google-Zugangsprüfung lieferte keine gültige Antwort (G02). Bitte erneut verbinden.',503);
  const scopes=new Set(String(info.scope||'').split(' ')),write=['create','update','delete'].includes(action);
  if(info.aud!==client||Number(info.expires_in)<=0||!(scopes.has(scope)||!write&&scopes.has(readScope)))fail('Google-Zugang besitzt nicht die erforderliche Freigabe.');
  const id=calendarId(configuration),base='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(id);
  // A Google account must itself have access to THIS calendar. No owner credentials.
  // Events.list returns accessRole without requesting calendar-list/ACL scopes.
  const permissions=await json(base+'/events?maxResults=1&fields=accessRole',token);
  if(write&&!['writer','owner'].includes(permissions.accessRole)||!write&&!['reader','writer','owner'].includes(permissions.accessRole))fail('Google-Kalenderberechtigung reicht nicht aus.');
  if(action==='status')return {ok:true,accessRole:permissions.accessRole,calendarId:id};
  if(action==='resolve'){
   if(typeof data.googleUid!=='string'||!data.googleUid||data.googleUid.length>1024)fail('Google-Terminzuordnung fehlt.',400);
   const params=new URLSearchParams({iCalUID:data.googleUid,singleEvents:'false',maxResults:'250',fields:'items('+fields+'),nextPageToken'});
   const source=await json(base+'/events?'+params,token);if(source.nextPageToken)fail('Google-Terminzuordnung ist nicht eindeutig.',409);
   let matches=(source.items||[]).filter(e=>e.iCalUID===data.googleUid&&e.status!=='cancelled');
   if(data.googleOccurrence!=null){
    const masters=matches.filter(e=>e.recurrence?.length&&!e.recurringEventId);if(masters.length!==1)fail('Google-Terminserie ist nicht eindeutig.',409);
    const window=new URLSearchParams({timeMin:new Date(data.from).toISOString(),timeMax:new Date(data.to).toISOString(),maxResults:'250',fields:'items('+fields+'),nextPageToken'});
    const instances=await json(base+'/events/'+encodeURIComponent(masters[0].id)+'/instances?'+window,token);if(instances.nextPageToken)fail('Google-Terminserie ist zu umfangreich.',409);
    matches=(instances.items||[]).filter(e=>e.status!=='cancelled'&&(typeof data.googleOccurrence==='string'?e.originalStartTime?.date===data.googleOccurrence:Date.parse(e.originalStartTime?.dateTime)===data.googleOccurrence));
   }else matches=matches.filter(e=>!e.recurringEventId&&!e.recurrence?.length);
   if(matches.length!==1)fail('Der zugehörige Google-Termin ist nicht mehr eindeutig verfügbar.',409);
   return {event:matches[0]};
  }
  if(action==='list'){
   if(!Number.isFinite(data.from)||!Number.isFinite(data.to)||data.to<=data.from||data.to-data.from>31*86400000)fail('Bitte einen Zeitraum von höchstens 31 Tagen wählen.',400);
   const params=new URLSearchParams({timeMin:new Date(data.from).toISOString(),timeMax:new Date(data.to).toISOString(),singleEvents:'true',maxResults:'250',fields:'accessRole,nextPageToken,items('+fields+')'});
   const result=await json(base+'/events?'+params,token);return {events:result.items||[],truncated:!!result.nextPageToken};
  }
  if(action==='create'){
   // No attendees: invitation privacy and OAuth consent must be approved/tested first.
   if(!/^[a-v0-9]{32,64}$/.test(data.requestId||''))fail('Ungültige Vorgangskennung.',400);
   return {event:await json(base+'/events?sendUpdates=none&fields='+fields,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...eventData(data.event),id:data.requestId})})};
  }
  if(!['read','update','delete'].includes(action)||!/^[a-zA-Z0-9_@.-]{1,1024}$/.test(data.googleEventId||''))fail('Ungültige Google-Terminaktion.',400);
  const url=base+'/events/'+encodeURIComponent(data.googleEventId);
  if(action==='read')return {event:await json(url+'?fields='+fields,token)};
  if(typeof data.etag!=='string'||!/^"[^"\r\n]{1,200}"$/.test(data.etag))fail('Bitte den Google-Termin vor der Änderung neu laden.',400);
  const headers={'If-Match':data.etag};
  // A delete or source change could notify guests. Reject invited events until the
  // invitation workflow, consent and response conflict policy have been accepted.
  const existing=await json(url+'?fields=etag,attendees,recurringEventId,recurrence',token);
  if(existing.etag!==data.etag)fail('Der Google-Termin wurde inzwischen geändert.',409);
  if(existing.attendees?.length)fail('Termine mit persönlichen Einladungen sind noch nicht für Änderungen freigegeben.',409);
  if(existing.recurrence?.length)fail('Serienänderungen bitte bis zur Geräteprüfung in Google Kalender vornehmen.',409);
  if(action==='delete'){await json(url+'?sendUpdates=none',token,{method:'DELETE',headers});return {ok:true};}
  return {event:await json(url+'?sendUpdates=none&fields='+fields,token,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(eventData(data.event))})};
 }
 const replies={accepted:'yes',declined:'excused',tentative:'maybe',needsAction:'open'};
 // Google event.updated is not a per-attendee response clock. Never use it to
 // overwrite a newer H2O reply. This conservative proposal requires version CAS
 // and stops automatic imports after a member has answered in H2O.
 function replyProposal(googleStatus,previous,observedVersion,currentVersion){
  if(!Object.hasOwn(replies,googleStatus)||observedVersion!==currentVersion||previous?.source==='h2o'||previous&&!previous.source)return null;
  return replies[googleStatus];
 }
 g.GoogleCalendarAPI={route,eventData,replyProposal};
})(globalThis);
