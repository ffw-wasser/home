/* Google Calendar desktop add-on. Each administrator runs their own installation.
   OAuth tokens exist only during an execution; no H2O/Cloudflare credentials. */
function h2oConfig_() {
  const p = PropertiesService.getScriptProperties();
  const calendarId = p.getProperty('H2O_CALENDAR_ID');
  if (typeof calendarId !== 'string' || !calendarId || calendarId.length > 1024 || /[\s\x00-\x1f]/.test(calendarId) || calendarId === 'primary') throw Error('H2O_CALENDAR_ID auf den gemeinsamen Feuerwehrkalender setzen.');
  return {calendarId:calendarId, groups:H2OCalendarAddonModel.groups(p.getProperty('H2O_GROUP_NAMES'))};
}
function h2oEscape_(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function h2oMessage_(text) {
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('H₂O Kalenderauswahl'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(h2oEscape_(text)))).build();
}
function h2oHome() {
  try { h2oConfig_(); return h2oMessage_('Im gemeinsamen Feuerwehrkalender zuerst den Termin mit Titel, Zeit und Ort speichern. Danach den gespeicherten Termin öffnen und rechts das H₂O-Symbol wählen. Die Auswahl gilt für diesen Termin bzw. dieses einzelne Serienvorkommen.'); }
  catch (e) { return h2oMessage_(e.message); }
}
function h2oContext_(e) {
  const config = h2oConfig_(), active = e.calendar || e.calendarEventObject || {}, params = (e.commonEventObject || {}).parameters || e.parameters || {};
  const calendarId = active.calendarId || params.calendarId, id = active.id || params.eventId;
  if (calendarId !== config.calendarId) throw Error('Bitte einen Termin im konfigurierten Feuerwehrkalender öffnen.');
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_@.-]{1,1024}$/.test(id)) throw Error('Termin zuerst in Google speichern und erneut öffnen.');
  if (params.eventId && params.eventId !== id || params.calendarId && params.calendarId !== calendarId) throw Error('Der geöffnete Termin wurde gewechselt. Bitte H₂O erneut öffnen.');
  return {config:config, calendarId:calendarId, id:id, params:params};
}
function h2oGoogle_(url, method, payload, etag) {
  const options = {method:method || 'get', headers:{Authorization:'Bearer ' + ScriptApp.getOAuthToken()}, followRedirects:false, muteHttpExceptions:true};
  if (payload) { options.contentType = 'application/json'; options.payload = JSON.stringify(payload); options.headers['If-Match'] = etag; }
  let response;
  try { response = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/' + url, options); }
  catch (_) { throw Error('Google nicht erreichbar. Bei einem Speicherversuch zuerst den Termin neu öffnen und den Google-Stand prüfen.'); }
  const status = response.getResponseCode();
  if (status === 412) throw Error('Der Termin wurde inzwischen geändert. Bitte neu öffnen; nichts wurde überschrieben.');
  if (status === 401 || status === 403) throw Error('Google erlaubt den Zugriff nicht. Eigenes Konto und Kalender-Bearbeitungsrechte prüfen.');
  if (status === 404) throw Error('Termin zuerst in Google speichern und erneut öffnen oder prüfen, ob er gelöscht wurde.');
  if (status < 200 || status >= 300) throw Error('Google hat den Vorgang nicht bestätigt. Termin neu öffnen und aktuellen Stand prüfen.');
  try { const value = JSON.parse(response.getContentText()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; }
  catch (_) { throw Error('Google-Antwort nicht lesbar. Bei einem Speicherversuch zuerst den aktuellen Google-Stand prüfen.'); }
}
function h2oEvent_(context) {
  const base = 'calendars/' + encodeURIComponent(context.calendarId) + '/events';
  const access = h2oGoogle_(base + '?maxResults=1&fields=accessRole');
  if (!['writer', 'owner'].includes(access.accessRole)) throw Error('Für diese Auswahl sind Google-Bearbeitungsrechte am Feuerwehrkalender erforderlich.');
  const event = h2oGoogle_(base + '/' + encodeURIComponent(context.id) + '?fields=id,etag,summary,description,status,recurrence,recurringEventId,attendees(responseStatus),extendedProperties(shared)');
  if (/geburtstag|birthday|\bgeb\.|🎂/i.test(event.summary || '')) throw Error('Geburtstage und persönliche Zuordnungen bitte in H₂O pflegen.');
  if (event.status === 'cancelled') throw Error('Dieser Termin ist abgesagt.');
  if (event.recurrence && event.recurrence.length) throw Error('Bitte ein einzelnes Serienvorkommen öffnen. Ganze Serien sind für die H₂O-Auswahl gesperrt.');
  if (event.attendees && event.attendees.length) throw Error('Termine mit Google-Gästen sind für die H₂O-Auswahl noch nicht freigegeben.');
  if (event.id !== context.id || typeof event.etag !== 'string' || !/^"[^"\r\n]{1,200}"$/.test(event.etag)) throw Error('Google-Termin konnte nicht sicher zugeordnet werden.');
  return event;
}
function h2oCard_(context, event) {
  const M = H2OCalendarAddonModel, value = M.read(event.description, context.config.groups, event.summary);
  const section = CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(h2oEscape_('Google-Titel, Datum und Ort zuerst speichern. Danach hier auswählen. Gruppennamen und Kleidung stehen öffentlich in der Terminbeschreibung; keine Mitgliedernamen eingeben. H₂O-Einzelanpassungen behalten Vorrang. Freigabe gilt für Probe, Sonderprobe, Unterricht und Ausschusssitzung.')));
  function choose(name, title, type, items, selected) {
    const input = CardService.newSelectionInput().setFieldName(name).setTitle(title).setType(type);
    items.forEach(function (item) { input.addItem(item, item, selected.includes(item)); }); section.addWidget(input);
  }
  choose('type', 'Terminart', CardService.SelectionInputType.DROPDOWN, M.types, [value.type]);
  choose('outfit', 'Kleidung', CardService.SelectionInputType.DROPDOWN, M.outfits.concat(['Freitext']), [M.outfits.includes(value.clothing) ? value.clothing : 'Freitext']);
  section.addWidget(CardService.newTextInput().setFieldName('clothing').setTitle('Kleidung bei Freitext').setValue(M.outfits.includes(value.clothing) ? '' : value.clothing));
  choose('mode', 'Betroffene Mitglieder', CardService.SelectionInputType.DROPDOWN, ['Automatisch nach Schlagwörtern', 'Ausgewählte Gruppen'], [value.mode === 'selected' ? 'Ausgewählte Gruppen' : 'Automatisch nach Schlagwörtern']);
  choose('groups', 'Gruppen · mehrfach möglich', CardService.SelectionInputType.CHECK_BOX, context.config.groups, value.groups);
  choose('release', 'Rückmeldung im H₂O Portal', CardService.SelectionInputType.DROPDOWN, ['Noch nicht freigeben', 'Freigeben'], [value.release ? 'Freigeben' : 'Noch nicht freigeben']);
  const action = CardService.newAction().setFunctionName('h2oSave').setParameters({calendarId:context.calendarId, eventId:context.id, etag:event.etag, groups:JSON.stringify(context.config.groups)});
  section.addWidget(CardService.newTextButton().setText('H₂O-Auswahl in Google speichern').setOnClickAction(action));
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('H₂O Kalenderauswahl').setSubtitle(h2oEscape_(event.summary))).addSection(section).build();
}
function h2oOpen(e) {
  try { const c = h2oContext_(e); return h2oCard_(c, h2oEvent_(c)); }
  catch (error) { return h2oMessage_(error.message); }
}
function h2oSave(e) {
  try {
    const c = h2oContext_(e);
    if (c.params.groups !== JSON.stringify(c.config.groups)) throw Error('Die Gruppenliste wurde geändert. Bitte H₂O erneut öffnen.');
    const event = h2oEvent_(c);
    if (c.params.etag !== event.etag) throw Error('Der Termin wurde inzwischen geändert. Bitte neu öffnen; nichts wurde überschrieben.');
    const form = (e.commonEventObject || {}).formInputs || {}, values = function (key) { const v = ((form[key] || {}).stringInputs || {}).value; return Array.isArray(v) ? v : []; };
    const one = function (key) { const list = values(key); if (list.length !== 1) throw Error('Bitte alle Auswahlfelder prüfen.'); return list[0]; };
    const outfit = one('outfit'), mode = one('mode'), release = one('release');
    if (!H2OCalendarAddonModel.outfits.concat(['Freitext']).includes(outfit) || !['Automatisch nach Schlagwörtern', 'Ausgewählte Gruppen'].includes(mode) || !['Noch nicht freigeben', 'Freigeben'].includes(release)) throw Error('Ungültige Auswahl. Bitte H₂O erneut öffnen.');
    const type = one('type');
    if (/^\s*INFO\s*:/i.test(event.summary || '') && type !== 'Information') throw Error('Der Titel beginnt mit INFO:. Für eine andere Terminart zuerst den Google-Titel ändern und speichern.');
    const patch = H2OCalendarAddonModel.build(event, {type:type, clothing:outfit === 'Freitext' ? one('clothing') : outfit, mode:mode === 'Ausgewählte Gruppen' ? 'selected' : 'automatic', groups:values('groups'), release:release === 'Freigeben'}, c.config.groups);
    const url = 'calendars/' + encodeURIComponent(c.calendarId) + '/events/' + encodeURIComponent(c.id) + '?sendUpdates=none&fields=id,etag,description,extendedProperties(shared)';
    const saved = h2oGoogle_(url, 'patch', patch, event.etag);
    if (saved.id !== event.id || saved.description !== patch.description) throw Error('Speicherung nicht eindeutig bestätigt. Termin zuerst neu öffnen und prüfen.');
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('In Google gespeichert. Termin schließen und neu öffnen. Der H₂O-Import kann verzögert erscheinen.')).setStateChanged(true).build();
  } catch (error) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(error.message)).build();
  }
}
