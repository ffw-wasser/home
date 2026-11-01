/* Google Calendar desktop add-on. Each administrator runs their own installation.
   Own Google OAuth plus a separately revocable H2O group-only connection. Never log credentials or members. */
const H2O_GROUPS_WORKER = 'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
function h2oConfig_() {
  const p = PropertiesService.getScriptProperties();
  const calendarId = p.getProperty('H2O_CALENDAR_ID');
  if (typeof calendarId !== 'string' || !calendarId || calendarId.length > 1024 || /[\s\x00-\x1f]/.test(calendarId) || calendarId === 'primary') throw Error('H2O_CALENDAR_ID auf den gemeinsamen Feuerwehrkalender setzen.');
  const config={calendarId:calendarId, groupToken:p.getProperty('H2O_GROUPS_TOKEN')||''};
  if(config.groupToken){const state=h2oGroups_(config,'read');if(!Array.isArray(state.members)||!Number.isSafeInteger(state.version)||typeof state.rosterRevision!=='string')throw Error('H₂O-Gruppenstand wurde nicht bestätigt.');if(!Array.isArray(state.groups))throw Error('H₂O-Gruppenliste ist ungültig.');config.groupState=state;config.groups=state.groups.length?H2OCalendarAddonModel.groups(JSON.stringify(state.groups)):[];}
  else config.groups=H2OCalendarAddonModel.groups(p.getProperty('H2O_GROUP_NAMES'));
  return config;
}
function h2oGroups_(config,action,data){
 if(!/^[A-Za-z0-9_-]{43}$/.test(config.groupToken||''))throw Error('Einmal unter H₂O → Kalender → Verbindung eine Google-Gruppenverbindung erstellen und als H2O_GROUPS_TOKEN in den Skripteigenschaften speichern.');
 let response;try{response=UrlFetchApp.fetch(H2O_GROUPS_WORKER+'/portal/calendar-addon/groups',{method:'post',headers:{Authorization:'Bearer '+config.groupToken},contentType:'application/json',payload:JSON.stringify(Object.assign({},data||{},{calendarId:config.calendarId,action:action})),followRedirects:false,muteHttpExceptions:true});}catch(_){throw Error('H₂O ist nicht erreichbar. Denselben Vorgang erneut prüfen; keine zweite Gruppe anlegen.');}
 let value;try{value=JSON.parse(response.getContentText());}catch(_){throw Error('H₂O-Antwort nicht lesbar. Denselben Vorgang erneut prüfen.');}
 if(response.getResponseCode()<200||response.getResponseCode()>=300||value.ok!==true)throw Error(typeof value.error==='string'?value.error.slice(0,300):'H₂O hat die Gruppenaktion nicht bestätigt.');return value;
}
function h2oValues_(e,key){const form=(e.commonEventObject||{}).formInputs||{},input=(form[key]||{}).stringInputs;return input&&Array.isArray(input.value)?input.value:[];}
function h2oDraft_(e){const one=key=>h2oValues_(e,key)[0]||'',outfit=one('outfit');return {type:one('type'),clothing:outfit==='Freitext'?one('clothing'):outfit,mode:'selected',groups:h2oValues_(e,'groups'),release:one('release')==='Freigeben'};}
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
function h2oCard_(context, event, draft, notice) {
  const M = H2OCalendarAddonModel, value = draft || M.read(event.description, context.config.groups, event.summary);
  const section = CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(h2oEscape_('Google-Titel, Datum und Ort zuerst speichern. Danach hier auswählen. Gruppennamen und Kleidung stehen in der Terminbeschreibung des privaten Kalenders; keine Mitgliedernamen eingeben. Eine oder mehrere passende Gruppen direkt auswählen. H₂O-Einzelanpassungen behalten Vorrang. Sichtbarkeit gilt für Probe, Sonderprobe, Unterricht, Ausschusssitzung und Fitness.')));
  if(notice)section.addWidget(CardService.newTextParagraph().setText(h2oEscape_(notice)));
  function choose(name, title, type, items, selected) {
    const input = CardService.newSelectionInput().setFieldName(name).setTitle(title).setType(type);
    items.forEach(function (item) { input.addItem(item, item, selected.includes(item)); }); section.addWidget(input);
  }
  choose('type', 'Terminart', CardService.SelectionInputType.DROPDOWN, M.types, [value.type]);
  choose('outfit', 'Kleidung', CardService.SelectionInputType.DROPDOWN, M.outfits.concat(['Freitext']), [M.outfits.includes(value.clothing) ? value.clothing : 'Freitext']);
  section.addWidget(CardService.newTextInput().setFieldName('clothing').setTitle('Kleidung bei Freitext').setValue(M.outfits.includes(value.clothing) ? '' : value.clothing));
  if(context.config.groups.length)choose('groups', 'Passende Gruppen · eine oder mehrere wählen', CardService.SelectionInputType.CHECK_BOX, context.config.groups, value.groups);else section.addWidget(CardService.newTextParagraph().setText('Noch keine aktiven Gruppen. Zuerst „Neue Gruppe“ wählen.'));
  choose('release', 'Termin in H₂O anzeigen', CardService.SelectionInputType.DROPDOWN, ['Noch nicht freigeben', 'Freigeben'], [value.release ? 'Freigeben' : 'Noch nicht freigeben']);
  const action = CardService.newAction().setFunctionName('h2oSave').setParameters({calendarId:context.calendarId, eventId:context.id, etag:event.etag, groups:JSON.stringify(context.config.groups)});
  section.addWidget(CardService.newTextButton().setText('H₂O-Auswahl in Google speichern').setOnClickAction(action));
  section.addWidget(CardService.newTextButton().setText('Neue Gruppe').setOnClickAction(CardService.newAction().setFunctionName('h2oNewGroup').setParameters({calendarId:context.calendarId,eventId:context.id,etag:event.etag})));
  section.addWidget(CardService.newTextButton().setText('Gruppenliste aktualisieren').setOnClickAction(CardService.newAction().setFunctionName('h2oRefreshGroups').setParameters({calendarId:context.calendarId,eventId:context.id,etag:event.etag})));
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
    const outfit = one('outfit'), release = one('release');
    if (!H2OCalendarAddonModel.outfits.concat(['Freitext']).includes(outfit) || !['Noch nicht freigeben', 'Freigeben'].includes(release)) throw Error('Ungültige Auswahl. Bitte H₂O erneut öffnen.');
    const type = one('type');
    if (/^\s*INFO\s*:/i.test(event.summary || '') && type !== 'Information') throw Error('Der Titel beginnt mit INFO:. Für eine andere Terminart zuerst den Google-Titel ändern und speichern.');
    const patch = H2OCalendarAddonModel.build(event, {type:type, clothing:outfit === 'Freitext' ? one('clothing') : outfit, mode:'selected', groups:values('groups'), release:release === 'Freigeben'}, c.config.groups);
    const url = 'calendars/' + encodeURIComponent(c.calendarId) + '/events/' + encodeURIComponent(c.id) + '?sendUpdates=none&fields=id,etag,description,extendedProperties(shared)';
    const saved = h2oGoogle_(url, 'patch', patch, event.etag);
    if (saved.id !== event.id || saved.description !== patch.description) throw Error('Speicherung nicht eindeutig bestätigt. Termin zuerst neu öffnen und prüfen.');
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText('In Google gespeichert. Termin schließen und neu öffnen. Der H₂O-Import kann verzögert erscheinen.')).setStateChanged(true).build();
  } catch (error) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(error.message)).build();
  }
}

function h2oNewGroup(e){
 try{const c=h2oContext_(e),event=h2oEvent_(c);if(c.params.etag!==event.etag)throw Error('Der Termin wurde inzwischen geändert. Bitte neu öffnen.');if(!c.config.groupState)throw Error('Zum Anlegen einmal eine Google-Gruppenverbindung in H₂O unter Kalender → Verbindung erstellen und als H2O_GROUPS_TOKEN speichern.');
 const state=c.config.groupState;if(!state.members.length)throw Error('Bitte zuerst die Mitglieder in H₂O synchronisieren.');const section=CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('Die Gruppe wird zentral in H₂O angelegt. Hier nur den Gruppennamen und die betroffenen Mitglieder wählen. Die bisherige Termin-Auswahl bleibt erhalten. Mitgliedernamen werden nicht in die Google-Terminbeschreibung geschrieben.'));
 section.addWidget(CardService.newTextInput().setFieldName('newGroupName').setTitle('Name der neuen Gruppe'));
 const members=CardService.newSelectionInput().setType(CardService.SelectionInputType.CHECK_BOX).setFieldName('newGroupMembers').setTitle('Mitglieder · mehrfach möglich');state.members.forEach(function(member){members.addItem(h2oEscape_(member.name),member.id,false);});section.addWidget(members);
 const params={calendarId:c.calendarId,eventId:c.id,etag:event.etag,version:String(state.version),rosterRevision:state.rosterRevision,rosterUpdatedAt:state.rosterUpdatedAt===null?'':String(state.rosterUpdatedAt),requestId:Utilities.getUuid(),draft:JSON.stringify(h2oDraft_(e))};
 section.addWidget(CardService.newTextButton().setText('Gruppe in H₂O anlegen').setOnClickAction(CardService.newAction().setFunctionName('h2oCreateGroup').setParameters(params)));
 const card=CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('Neue H₂O-Gruppe')).addSection(section).build();return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(card)).build();
 }catch(error){return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(error.message)).build();}
}
function h2oCreateGroup(e){
 let created=null;
 try{const c=h2oContext_(e),event=h2oEvent_(c);if(c.params.etag!==event.etag)throw Error('Der Termin wurde inzwischen geändert. Bitte neu öffnen.');
 const name=h2oValues_(e,'newGroupName');if(name.length!==1)throw Error('Bitte einen Gruppennamen eingeben.');const p=c.params;
 const result=h2oGroups_(c.config,'create',{name:name[0],memberIds:h2oValues_(e,'newGroupMembers'),requestId:p.requestId,expectedVersion:Number(p.version),expectedRosterRevision:p.rosterRevision,expectedRosterUpdatedAt:p.rosterUpdatedAt===''?null:Number(p.rosterUpdatedAt)});created=result.group;
 if(!created||typeof created.name!=='string')throw Error('Die neue Gruppe wurde nicht bestätigt.');c.config=h2oConfig_();
 if(typeof p.draft!=='string'||p.draft.length>5000)throw Error('Termin-Auswahl bitte erneut prüfen.');const draft=JSON.parse(p.draft);if(!Array.isArray(draft.groups)||draft.groups.some(function(name){return !c.config.groups.includes(name);}))throw Error('Die bisherige Gruppenauswahl wurde geändert.');draft.groups=Array.from(new Set(draft.groups.concat([created.name])));draft.mode='selected';
 const card=h2oCard_(c,event,draft,'Gruppe „'+created.name+'“ wurde in H₂O angelegt und ist ausgewählt. Die Terminzuordnung erst mit „H₂O-Auswahl in Google speichern“ übernehmen.');
 return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().popCard().updateCard(card)).setNotification(CardService.newNotification().setText('Gruppe in H₂O angelegt. Termin-Auswahl bitte separat speichern.')).setStateChanged(true).build();
 }catch(error){return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(created?'Gruppe wurde angelegt. Termin neu öffnen und die Gruppenauswahl prüfen.':error.message)).build();}
}
function h2oRefreshGroups(e){
 try{const c=h2oContext_(e),event=h2oEvent_(c);if(c.params.etag!==event.etag)throw Error('Der Termin wurde inzwischen geändert. Bitte neu öffnen.');const draft=h2oDraft_(e);if(draft.groups.some(function(name){return !c.config.groups.includes(name);}))throw Error('Eine ausgewählte Gruppe ist nicht mehr vorhanden. Bitte die Auswahl zuerst prüfen.');return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(h2oCard_(c,event,draft))).setNotification(CardService.newNotification().setText('Gruppenliste aktualisiert.')).build();}catch(error){return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(error.message)).build();}
}
