/* Time-trigger adapter: no member data in the public source calendar.
   Configure H2O_INVITATION_SECRET in Script Properties, then run h2oSetupInvitations.
   Never log request bodies, addresses, confirmation links, or credentials. */
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
function h2oSetupInvitations() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw Error('Eine Kalenderaktion läuft bereits.');
  try {
    const config = h2oInvitationConfig_();
    if (!config.calendar) {
      const result = h2oInvitationGoogle_(config, 'calendars', 'post', {summary:'H₂O · Persönliche Einladungen', description:'Privater technischer Einladungskalender. Nicht veröffentlichen oder für Mitglieder freigeben. Termine weiter im bisherigen Feuerwehrkalender pflegen.', timeZone:'Europe/Berlin'});
      if (!result.id || result.id === config.source) throw Error('Privater Kalender wurde nicht bestätigt.');
      config.props.setProperty('H2O_INVITATION_CALENDAR_ID', result.id); config.calendar = result.id;
    }
    h2oPrivateInvitationCalendar_(config);
    const triggers = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'h2oSyncInvitations'; });
    if (!triggers.length) ScriptApp.newTrigger('h2oSyncInvitations').timeBased().everyMinutes(5).create();
    for (let i = 1; i < triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  } finally { lock.releaseLock(); }
  h2oSyncInvitations();
}
function h2oInvitationEvent_(job, existing, palette) {
  if (existing) {
    const marker = ((existing.extendedProperties || {}).private || {}).h2oInvitation;
    if (marker !== job.id || existing.status === 'cancelled') throw Error('Die private Einladungskennung stimmt nicht überein oder wurde gelöscht.');
    const guests = existing.attendees || [];
    if (guests.some(function (guest) { return String(guest.email).toLowerCase() !== job.email; })) throw Error('Die persönliche Einladung enthält eine unerwartete Gastadresse.');
  }
  const old = existing && (existing.attendees || []).find(function (guest) { return String(guest.email).toLowerCase() === job.email; });
  const value = {summary:job.summary, description:job.description, location:job.location || '', start:job.start, end:job.end, visibility:'private', guestsCanSeeOtherGuests:false, guestsCanInviteOthers:false, guestsCanModify:false,
    attendees:[{email:job.email, responseStatus:old && old.responseStatus || 'needsAction'}],
    extendedProperties:{private:{h2oInvitation:job.id, h2oFingerprint:job.fingerprint}}, reminders:{useDefault:true}};
  if (!existing) value.id = job.googleEventId;
  const color = Object.keys(palette || {}).find(function (id) { return String(palette[id].background).toLowerCase() === String(job.color).toLowerCase(); });
  if (color) value.colorId = color;
  return value;
}
function h2oSyncInvitations() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return;
  try {
    const config = h2oInvitationConfig_();
    const properties = config.props.getProperties();
    Object.keys(properties).forEach(function (key) { if (/^H2O_VERIFICATION_[a-f0-9]{64}$/.test(key) && Number(properties[key]) < Date.now() - 2 * 86400000) config.props.deleteProperty(key); });
    const base = h2oPrivateInvitationCalendar_(config), plan = h2oInvitationWorker_(config, 'begin', {calendarId:config.calendar, sourceCalendarId:config.source}), run = plan.run;
    if (!/^[a-f0-9]{64}$/.test(run || '') || plan.calendarId !== config.calendar || !Array.isArray(plan.jobs) || plan.jobs.length > 30) throw Error('H₂O-Auftrag ist nicht gültig.');
    const palette = plan.jobs.some(function (j) { return j.color; }) ? (h2oInvitationGoogle_(config, 'colors').event || {}) : {};
    for (const job of plan.jobs) {
      if (!/^[a-f0-9]{64}$/.test(job.id || '') || !new RegExp('^h2o' + job.id + '[a-f0-9]{1,8}$').test(job.googleEventId || '') || !['upsert','cancel','cleanup'].includes(job.action)) throw Error('Ungültiger Einladungsauftrag.');
      const permission = h2oInvitationWorker_(config, 'authorize', {run:run, id:job.id, googleEventId:job.googleEventId, action:job.action, fingerprint:job.fingerprint});
      if (!permission.eligible) continue;
      try {
      if (job.verification && job.action === 'upsert') {
        const sentKey = 'H2O_VERIFICATION_' + job.id;
        if (!config.props.getProperty(sentKey)) {
          if (MailApp.getRemainingDailyQuota() < 1) throw Error('Das tägliche Bestätigungsmail-Kontingent ist ausgeschöpft.');
          MailApp.sendEmail({to:job.email, subject:job.summary, body:job.description, name:'Feuerwehr Wasser · H₂O'});
          config.props.setProperty(sentKey, String(Date.now()));
        }
        h2oInvitationWorker_(config, 'result', {run:run, id:job.id, googleEventId:job.googleEventId, action:'upsert', fingerprint:job.fingerprint});
        continue;
      }
      const url = base + '/events/' + encodeURIComponent(job.googleEventId);
      const existing = h2oInvitationGoogle_(config, url, 'get', null, null, true);
      if (job.action === 'cancel' || job.action === 'cleanup') {
        if (existing && existing.status !== 'cancelled') {
          if ((((existing.extendedProperties || {}).private || {}).h2oInvitation) !== job.id) throw Error('Fremden Google-Termin nicht löschen.');
          h2oInvitationGoogle_(config, url + '?sendUpdates=all', 'delete', null, existing.etag);
        }
        h2oInvitationWorker_(config, 'result', {run:run, id:job.id, googleEventId:job.googleEventId, action:job.action});
      } else {
        const value = h2oInvitationEvent_(job, existing, palette);
        const alreadySaved = existing && (((existing.extendedProperties || {}).private || {}).h2oFingerprint) === job.fingerprint;
        const saved = alreadySaved ? existing : h2oInvitationGoogle_(config, (existing ? url : base + '/events') + '?sendUpdates=all', existing ? 'patch' : 'post', value, existing && existing.etag);
        if (saved.id !== job.googleEventId) throw Error('Google hat eine andere Einladungskennung geliefert.');
        h2oInvitationWorker_(config, 'result', {run:run, id:job.id, googleEventId:job.googleEventId, action:'upsert', fingerprint:job.fingerprint});
      }
      } catch (error) { h2oInvitationWorker_(config, 'result', {run:run, id:job.id, googleEventId:job.googleEventId, action:job.action, fingerprint:job.fingerprint, error:String(error.message || 'Einladung nicht bestätigt.').slice(0,160)}); }
    }
    // Delta cursor belongs to this private calendar. Persist only after every page is acknowledged.
    let sync = config.props.getProperty('H2O_INVITATION_SYNC_TOKEN'), page = null, next = null, pages = 0;
    while (true) {
      if (++pages > 40) throw Error('Der private Kalender ist für einen Lauf zu umfangreich.');
      const query = ['showDeleted=true','maxResults=100','fields=nextPageToken,nextSyncToken,items(id,status,attendees(email,responseStatus,organizer),extendedProperties/private)'];
      if (sync) query.push('syncToken=' + encodeURIComponent(sync));
      if (page) query.push('pageToken=' + encodeURIComponent(page));
      let result;
      try { result = h2oInvitationGoogle_(config, base + '/events?' + query.join('&')); }
      catch (error) { if (!error.syncExpired || !sync) throw error; config.props.deleteProperty('H2O_INVITATION_SYNC_TOKEN'); sync = null; page = null; pages = 0; continue; }
      const observations = [];
      for (const event of result.items || []) {
        const cancelled = /^h2o([a-f0-9]{64})([a-f0-9]{1,8})$/.exec(event.id || '');
        if (event.status === 'cancelled' && cancelled) { observations.push({id:cancelled[1], googleEventId:event.id, cancelled:true}); continue; }
        const marker = (event.extendedProperties || {}).private || {};
        if (!/^[a-f0-9]{64}$/.test(marker.h2oInvitation || '') || !new RegExp('^h2o' + marker.h2oInvitation + '[a-f0-9]{1,8}$').test(event.id || '') || event.status === 'cancelled') continue;
        const guests = (event.attendees || []).filter(function (a) { return !a.organizer; });
        if (guests.length !== 1 || !['accepted','declined','tentative','needsAction'].includes(guests[0].responseStatus)) throw Error('Persönliche Kalenderantwort ist nicht eindeutig.');
        observations.push({id:marker.h2oInvitation, googleEventId:event.id, fingerprint:marker.h2oFingerprint, email:String(guests[0].email).toLowerCase(), googleStatus:guests[0].responseStatus});
      }
      for (let i = 0; i < observations.length; i += 8) h2oInvitationWorker_(config, 'observe', {run:run, items:observations.slice(i, i + 8)});
      page = result.nextPageToken; next = result.nextSyncToken;
      if (!page) break;
    }
    if (!next) throw Error('Google hat den Antwortabgleich nicht vollständig bestätigt.');
    h2oInvitationWorker_(config, 'finish', {run:run});
    config.props.setProperty('H2O_INVITATION_SYNC_TOKEN', next);
  } finally { lock.releaseLock(); }
}
