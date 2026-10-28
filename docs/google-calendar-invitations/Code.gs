/* Cleanup-only adapter for previously created private invitations.
   Reuse existing script properties and calendar. No new setup or member consent.
   Never log credentials or event contents. */
const H2O_INVITATION_WORKER = 'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
function h2oInvitationConfig_() {
  const props = PropertiesService.getScriptProperties();
  const source = props.getProperty('H2O_CALENDAR_ID'), secret = props.getProperty('H2O_INVITATION_SECRET');
  if (!source || !/^[a-f0-9]{64}$/.test(secret || '')) throw Error('H2O_CALENDAR_ID und H2O_INVITATION_SECRET zuerst in den Skripteigenschaften eintragen.');
  return {props:props, source:source, secret:secret, calendar:props.getProperty('H2O_INVITATION_CALENDAR_ID')};
}
function h2oInvitationWorker_(config, action, data) {
  let response;
  try { response = UrlFetchApp.fetch(H2O_INVITATION_WORKER + '/portal/calendar-bridge/' + action, {method:'post', headers:{Authorization:'Bearer ' + config.secret}, contentType:'application/json', payload:JSON.stringify(data || {}), followRedirects:false, muteHttpExceptions:true}); }
  catch (_) { throw Error('H₂O ist nicht erreichbar. Die Synchronisierung versucht es beim nächsten Lauf erneut.'); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw Error('H₂O hat die Synchronisierung nicht bestätigt. Verbindung und Ausführungsprotokoll ohne persönliche Daten prüfen.');
  try { const value = JSON.parse(response.getContentText()); if (value.ok !== true) throw Error(); return value; }
  catch (_) { throw Error('H₂O-Antwort nicht bestätigt.'); }
}
function h2oInvitationGoogle_(config, path, method, payload, etag, missing) {
  const options = {method:method || 'get', headers:{Authorization:'Bearer ' + ScriptApp.getOAuthToken()}, followRedirects:false, muteHttpExceptions:true};
  if (payload) { options.contentType = 'application/json'; options.payload = JSON.stringify(payload); }
  if (etag) options.headers['If-Match'] = etag;
  let response;
  try { response = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/' + path, options); }
  catch (_) { throw Error('Google nicht erreichbar. Denselben Vorgang beim nächsten Lauf erneut prüfen.'); }
  const status = response.getResponseCode();
  if (missing && (status === 404 || status === 410)) return null;
  if (status === 410) throw Object.assign(Error('Der Google-Abgleich muss neu gelesen werden.'), {syncExpired:true});
  if (status === 409 || status === 412) throw Error('Google-Termin wurde gleichzeitig geändert. Beim nächsten Lauf neu lesen.');
  if (status < 200 || status >= 300) throw Error('Google hat den Vorgang nicht bestätigt. Kalenderfreigaben und Berechtigungen prüfen.');
  if (status === 204) return {};
  try { return JSON.parse(response.getContentText()); }
  catch (_) { throw Error('Google-Antwort nicht lesbar.'); }
}
function h2oPrivateInvitationCalendar_(config) {
  if (!config.calendar || config.calendar === config.source) throw Error('Der zusätzliche private Einladungskalender fehlt. h2oSetupInvitations einmal ausführen.');
  const base = 'calendars/' + encodeURIComponent(config.calendar), result = h2oInvitationGoogle_(config, base + '/acl?maxResults=250');
  if (result.nextPageToken || !Array.isArray(result.items) || !result.items.length || result.items.some(function (rule) { return rule.role !== 'none' && (!rule.scope || rule.scope.type !== 'user' || !['owner','writer'].includes(rule.role)); })) throw Error('Der Einladungskalender muss privat bleiben. Öffentliche, Domain-, Gruppen- und Lesefreigaben zuerst entfernen.');
  return base;
}
// Existing triggers keep this name. No calendars, invitations or confirmation mails are created.
function h2oSetupInvitations() { throw Error('Persönliche Einladungen sind abgelöst. Kalenderabo und H₂O-Antwortlink verwenden. Nur eine bestehende Bereinigung mit h2oSyncInvitations fortsetzen.'); }
function h2oSyncInvitations() {
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try {
  const config=h2oInvitationConfig_(),base=h2oPrivateInvitationCalendar_(config),plan=h2oInvitationWorker_(config,'begin',{calendarId:config.calendar,sourceCalendarId:config.source,adapterVersion:3});
  if(!/^[a-f0-9]{64}$/.test(plan.run||'')||plan.calendarId!==config.calendar||!Array.isArray(plan.jobs)||plan.jobs.length>30)throw Error('Ungültiger Bereinigungsauftrag.');
  for(const job of plan.jobs){
   if(!/^[a-f0-9]{64}$/.test(job.id||'')||!new RegExp('^h2o'+job.id+'[a-f0-9]{1,8}$').test(job.googleEventId||'')||!['cancel','cleanup'].includes(job.action))throw Error('Es sind ausschließlich alte Einladungen zur Bereinigung erlaubt.');
   const data={run:plan.run,id:job.id,googleEventId:job.googleEventId,action:job.action};
   if(!h2oInvitationWorker_(config,'authorize',data).eligible)continue;
   try {
    const url=base+'/events/'+encodeURIComponent(job.googleEventId),existing=h2oInvitationGoogle_(config,url+'?fields=id,status,etag,extendedProperties(private)','get',null,null,true);
    if(existing&&existing.status!=='cancelled'){
     if(existing.id!==job.googleEventId||((existing.extendedProperties||{}).private||{}).h2oInvitation!==job.id||typeof existing.etag!=='string')throw Error('Fremden Google-Termin nicht löschen.');
     h2oInvitationGoogle_(config,url+'?sendUpdates=all','delete',null,existing.etag);
    }
    h2oInvitationWorker_(config,'result',data);
   }catch(_){h2oInvitationWorker_(config,'result',Object.assign({},data,{error:'Alte Einladung noch nicht bestätigt bereinigt.'}));}
  }
  const finished=h2oInvitationWorker_(config,'finish',{run:plan.run});
  if(finished.done===true)for(const trigger of ScriptApp.getProjectTriggers())if(trigger.getHandlerFunction()==='h2oSyncInvitations')ScriptApp.deleteTrigger(trigger);
 }finally{lock.releaseLock();}
}
