/* iPad administration and attendance projection. RSVP never creates attendance records. */
(function(g){
 'use strict';const VIEW='settingsPortalView',CALENDAR='settingsCalendarView',$=id=>document.getElementById(id==='status'&&!document.getElementById(CALENDAR).hidden?'portal-calendar-admin-status':'portal-admin-'+id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};let generation=0,busy=false,list=[],selected=null,manualNoCalendar=false,replyData=null,lastLoad=0,loading=false,attendanceRefreshPending=false,attendanceAccess=null,attendanceEpoch=0,manual=null,rosterKey=null,rosterBusy=false,rosterStatus={kind:"pending",text:"Mitglieder noch nicht mit dem Handyportal abgeglichen."},rosterSyncedAt=null,rosterResyncRequested=false,calendarGeneration=0,reviewLoading=false,reviewLastLoad=0,reviewSnapshot=null,reviewShowSaved=true,reviewEdited=new Set(),reviewFilter='all';
 const date=e=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',...(e.allDay?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(e.start));
 function admin(){if(!requireAdmin(!document.getElementById(CALENDAR).hidden?CALENDAR:VIEW))throw Error('Bitte die Administration entsperren.');}
 const PUBLIC_ORIGIN_KEY='h2o_calendar_public_origin';
 function publicOrigin(){const value=localStorage.getItem(PUBLIC_ORIGIN_KEY)||'';return g.DrinksPush.validOrigin(value)?value:'';}
 function rememberOrigin(origin){if(g.DrinksPush.validOrigin(origin))localStorage.setItem(PUBLIC_ORIGIN_KEY,origin);}
 async function publicList(){const origin=publicOrigin();if(!origin)throw Error('Bitte unter Einstellungen → Kalender einmalig die öffentliche Cloudflare-Dienstadresse eintragen.');const response=await fetch(origin.replace(/\/$/,'')+'/calendar/public',{method:'GET',cache:'no-store',redirect:'error'});const data=await response.json();if(!response.ok)throw Error(data.error||'Kalender momentan nicht erreichbar.');if(!Array.isArray(data.events))throw Error('Ungültige Kalenderantwort.');return data;}
 async function connection(){const c=await g.DrinksCentral.connection();if(!c)throw Error('Bitte zuerst den bestehenden Kontodienst verbinden.');rememberOrigin(c.origin);return c;}
 async function request(path,data={}){const c=await connection();try{return await g.DrinksPush.request(c,'/admin/portal/'+path,{source:c.source,...data});}catch(e){if(e.status===404&&e.message==='Nicht gefunden.')throw Error('Bitte zuerst den bestehenden Cloudflare-Worker für das H₂O Portal aktualisieren.');throw Object.assign(Error(g.ConnectionStatus?.message(e)||e.message),{status:e.status});}}

 function renderSyncStatus(){const status=document.getElementById('memberEvidenceSyncStatus');if(status){status.textContent=rosterStatus.text;status.dataset.state=rosterStatus.kind;}const button=document.getElementById('memberEvidenceSync');if(button){button.hidden=!['pending','error'].includes(rosterStatus.kind);button.disabled=rosterBusy||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed;}}
 function syncStatus(kind,text){rosterStatus={kind,text};renderSyncStatus();}
 function storageChanged(){
  const access=oneDriveAdministrationReady(),changed=access!==attendanceAccess;
  if(changed){attendanceAccess=access;attendanceEpoch++;}
  const refresh=changed?refreshAttendance(true):Promise.resolve();
  if(typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed){syncStatus('pending','Auf diesem Gerät gespeichert · OneDrive-Speicherung noch nicht bestätigt. Handyportal noch nicht aktualisiert.');return refresh;}
  if(!access){syncStatus('pending','Für den Handyabgleich bitte OneDrive verbinden.');return refresh;}
  if(rosterBusy){rosterResyncRequested=true;return refresh;}
  return Promise.all([refresh,syncRoster().catch(()=>{})]); // Both operations expose failures in their status cards.
 }
 async function syncRoster(force=false){
  if(rosterBusy){rosterResyncRequested=true;return false;}
  if(!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed){storageChanged();return false;}
  rosterBusy=true;syncStatus('syncing','In OneDrive gespeichert · Handyportal wird abgeglichen …');
  try{
   const c=await connection(),state=await g.oneDriveReadState(),people=state.members.map(m=>({id:String(m.id),name:[m.lastName,m.firstName].filter(Boolean).join(' '),leader:Array.isArray(m.roles)&&m.roles.includes('GF'),evidence:g.MemberEvidence.project(m)})),key=c.origin+':'+c.source+':'+JSON.stringify(people);
   if(key!==rosterKey||force){
    if(g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert.');
    const saved=await g.DrinksPush.request(c,'/admin/portal/roster',{source:c.source,members:people});
    if(saved.evidenceVersion!==1)throw Error('Für persönliche Nachweise bitte den aktuellen Cloudflare-Worker veröffentlichen.');
    if(g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert. Bitte erneut abgleichen.');
    rosterKey=key;rosterSyncedAt=Date.now();
   }
   if(typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed){syncStatus('pending','Weitere Änderungen warten auf OneDrive und Handyabgleich.');return false;}
   syncStatus('success','In OneDrive gespeichert · Handyportal abgeglichen am '+new Date(rosterSyncedAt).toLocaleString('de-DE')+'. Auf dem Handy „Aktualisieren“ wählen.');return true;
  }catch(e){syncStatus('error','Handyportal noch nicht aktualisiert. '+(g.ConnectionStatus?.message(e)||e.message)+' Mit „Nachweise fürs Handy aktualisieren“ erneut versuchen.');throw e;
  }finally{rosterBusy=false;renderSyncStatus();const again=rosterResyncRequested;rosterResyncRequested=false;if(again)storageChanged();}
 }
 async function run(fn){if(busy)return;busy=true;const submit=$('form').querySelector('button[type=submit]'),buttons=[...document.querySelectorAll('#portal-admin-show-qr,#portal-admin-review-events button,#portal-admin-review-events select,#portal-admin-review-events input,#portal-admin-review-auto,#portal-admin-review-load,#portal-admin-review-toggle,#portal-admin-review-filter')].map(button=>[button,button.disabled]);submit.disabled=true;for(const [button] of buttons)button.disabled=true;try{admin();await fn();}catch(e){$('status').textContent=e.message;const review=$('review-status');if(review&&!document.getElementById(CALENDAR).hidden){review.textContent='⚠ '+e.message;$('review-load').hidden=false;}}finally{busy=false;submit.disabled=false;for(const [button,disabled] of buttons)if(button.isConnected)button.disabled=disabled;if(reviewSnapshot)reviewControls();}}
 function calendarCategory(e){return e.kind==='probe'?(e.sessionType==='Probe'?'probe':'special'):e.kind==='birthday'?'birthday':'other';}
 function automaticCandidates(){const seen=new Set();return (reviewSnapshot?.events||[]).filter(e=>{if(reviewFilter!=='all'&&calendarCategory(e)!==reviewFilter||!e.automatic||reviewEdited.has(e.id)||e.kind==='birthday'&&!e.memberId)return false;const key=e.kind==='birthday'?e.seriesId:e.id;if(seen.has(key))return false;seen.add(key);return true;});}
 function reviewControls(){
  const count=automaticCandidates().length;
  $('review-auto').disabled=!count||reviewSnapshot?.stale===true||reviewEdited.size>0;
  $('review-auto').textContent=reviewEdited.size?'Änderungen zuerst einzeln speichern':'Automatische Erkennung übernehmen ('+count+')';
  $('review-toggle').textContent=reviewShowSaved?'Nur offene Einträge anzeigen':'Gespeicherte Einträge anzeigen';
  $('review-toggle').setAttribute('aria-pressed',String(reviewShowSaved));
  $('review-filter').value=reviewFilter;
  let shown=0;
  for(const card of $('review-events').children){
   card.hidden=(!reviewShowSaved&&card.dataset.saved==='true')||(reviewFilter!=='all'&&card.dataset.category!==reviewFilter);
   if(!card.hidden)shown++;
  }
  $('review-filter-count').textContent=shown+' von '+(reviewSnapshot?.events?.length||0)+' Kalendereinträgen angezeigt';
 }
 async function acceptAutomatic(){return run(async()=>{const version=calendarGeneration,candidates=automaticCandidates();if(!candidates.length||reviewSnapshot.stale||reviewEdited.size)return;let expectedVersion=reviewSnapshot.rulesVersion,count=0,error='';try{for(const e of candidates){if(version!==calendarGeneration)throw Error('Ansicht wurde geändert. Bitte neu laden.');admin();$('review-status').textContent='Automatische Einordnungen werden gespeichert: '+count+' / '+candidates.length+' …';const result=await request('classify',{eventId:e.id,kind:e.kind,approved:e.kind==='probe',...(e.kind==='probe'?{sessionType:e.sessionType||'Sonderprobe'}:{memberId:e.memberId}),expectedVersion});expectedVersion=result.version;count++;}}catch(e){error=e.message;}lastLoad=0;if(version!==calendarGeneration)return;await reviewCalendar();$('review-status').textContent=count+' Einordnungen übernommen. Die angezeigte Terminart wurde verarbeitet. '+(error?'Weitere Einträge nicht bestätigt: '+error:'Ungeklärte Geburtstage bleiben offen.');});}
 async function reviewCalendar({automatic=false}={}){
  if(automatic&&(reviewEdited.size||busy||reviewLoading||Date.now()-reviewLastLoad<60000))return;
  const version=++calendarGeneration;reviewLoading=true;$('review-load').hidden=true;try{admin();$('review-status').textContent='Kalendereinträge werden geladen …';const cal=await request('list');if(version!==calendarGeneration||automatic&&reviewEdited.size)return;admin();reviewLastLoad=Date.now();$('review-load').hidden=!cal.stale;
   // Finished events no longer belong to the active H₂O calendar management.
   // The underlying Google calendar and the separately archived attendance
   // protocol are never changed here. Birthday series associations survive.
   reviewSnapshot={...cal,events:cal.events.filter(e=>Number.isFinite(e.end)&&e.end>Date.now())};
   reviewEdited.clear();$('review-events').replaceChildren();
   for(const e of reviewSnapshot.events){const card=node('article');card.className='portal-event';card.dataset.category=calendarCategory(e);const unresolved=e.kind==='birthday'&&!e.memberId,saved=e.automatic===false&&!unresolved;card.dataset.saved=String(saved);card.dataset.state=unresolved?'unresolved':saved?'saved':'detected';const badge=node('p',unresolved?'Zuordnung prüfen':saved?'✓ Gespeichert'+(e.kind==='probe'&&e.sessionType==='Sonderprobe'?(Array.isArray(e.recipientIds)?' · '+e.recipientIds.length+' ausgewählte Mitglieder':' · Alle Mitglieder'):''):'Automatisch erkannt · noch nicht gespeichert');badge.className='portal-review-badge';const h=node('h4',date(e)+' · '+e.title),kind=node('select');kind.className='text-input';kind.setAttribute('aria-label','Eintrag behandeln als');for(const [value,label] of [['other','Sonstiger Kalendereintrag'],['probe','Probe / Anmeldung möglich'],['special','Sonderprobe / Anmeldung möglich'],['birthday','Geburtstag / keine Anmeldung']]){const o=node('option',label);o.value=value;kind.append(o);}kind.value=e.kind==='probe'&&e.sessionType==='Sonderprobe'?'special':e.kind;
    const attendanceTypeLabel=node('label','Terminart für die iPad-Erfassung'),attendanceType=node('select');
    attendanceType.className='text-input';attendanceType.setAttribute('aria-label','iPad-Terminart bei diesem Kalendertermin');
    for(const [value,label] of [['Allgemeine Probe','Allgemeine Probe'],['Sonderprobe','Sonderprobe'],['Unterricht','Unterricht'],['Ausschuss Sitzung','Ausschusssitzung'],['Einsatz','Einsatz']]){const o=node('option',label);o.value=value;attendanceType.append(o);}
    attendanceType.value=['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung','Einsatz'].includes(e.attendanceType)?e.attendanceType:(kind.value==='probe'?'Allgemeine Probe':'Sonderprobe');
    attendanceTypeLabel.append(attendanceType,node('small','Beim Auswählen dieses Kalendertermins wird diese Terminart auf dem iPad vorausgewählt.'));
    const approvalLabel=node('label'),approval=node('input');approval.type='checkbox';approval.checked=e.approved;approvalLabel.append(approval,node('span',' Für Anmeldung und Erinnerungen freigeben'));
    const personLabel=node('label','Geburtstagskind (gilt für diese Geburtstagsserie)'),person=node('select');person.className='text-input';person.setAttribute('aria-label','Geburtstag zuordnen');const empty=node('option','Noch nicht zugeordnet – kein Bonus');empty.value='';person.append(empty);for(const option of $('member').options){if(!option.value)continue;const o=node('option',option.textContent);o.value=option.value;person.append(o);}person.value=e.memberId||'';personLabel.append(person);
    const recipientsLabel=node('label','Empfänger der Sonderprobe'),recipients=node('div');recipients.className='portal-recipient-choices';const allLabel=node('label'),all=node('input');all.type='checkbox';all.checked=!Array.isArray(e.recipientIds);allLabel.append(all,node('span',' Alle Mitglieder'));recipients.append(allLabel);const peopleBox=node('div');peopleBox.className='portal-recipient-list';const people=[];for(const option of $('member').options){if(!option.value)continue;const choice=node('label'),check=node('input');check.type='checkbox';check.value=option.value;check.checked=Array.isArray(e.recipientIds)?e.recipientIds.includes(option.value):false;choice.append(check,node('span',option.textContent));peopleBox.append(choice);people.push(check);}recipients.append(peopleBox);const updateRecipients=()=>{peopleBox.hidden=all.checked;for(const check of people)check.disabled=all.checked;};updateRecipients();
     const recognition=node('p',e.automatic?(e.kind==='birthday'?(e.memberId?'Automatisch zugeordnet.':'Geburtstag erkannt. Keine eindeutige Namenszuordnung – bitte Mitglied auswählen.'):'Automatisch erkannt: '+e.sessionType+'. Zur Anmeldung bitte freigeben.'):'Manuell festgelegte Einordnung.');const note=node('p'),save=node('button','Einordnung speichern');save.type='button';save.className='outline-button';const update=()=>{approvalLabel.hidden=!['probe','special'].includes(kind.value);personLabel.hidden=kind.value!=='birthday';attendanceTypeLabel.hidden=!['probe','special'].includes(kind.value);recipientsLabel.hidden=recipients.hidden=kind.value!=='special';note.textContent=kind.value==='birthday'?'Keine Anmeldung und keine Probe-Erinnerung. Am Geburtstag wird dem zugeordneten Mitglied einmal jährlich der eingestellte Geburtstagsbonus gutgeschrieben. Die Punktzahl steht unter Treuepunkte.':kind.value==='special'?'Nur freigegebene Empfänger sehen diese Sonderprobe und können sich anmelden. Bei „Alle Mitglieder“ erhalten alle den Termin.':kind.value==='probe'?'Erst nach Freigabe im Portal sichtbar. Normale Proben gelten für alle Mitglieder.':'Keine Anmeldung und keine Termin-Erinnerung.';};const changed=()=>{reviewEdited.add(e.id);card.dataset.saved='false';card.dataset.state='edited';badge.textContent='Geändert · noch nicht gespeichert';update();reviewControls();};kind.onchange=()=>{const prior=kind.dataset.previousKind|| (e.kind==='probe'&&e.sessionType==='Sonderprobe'?'special':e.kind),oldDefault=prior==='probe'?'Allgemeine Probe':prior==='special'?'Sonderprobe':null,nextDefault=kind.value==='probe'?'Allgemeine Probe':kind.value==='special'?'Sonderprobe':null;if(oldDefault&&nextDefault&&attendanceType.value===oldDefault)attendanceType.value=nextDefault;kind.dataset.previousKind=kind.value;changed();};attendanceType.onchange=changed;approval.onchange=changed;person.onchange=changed;all.onchange=()=>{updateRecipients();changed();};for(const check of people)check.onchange=changed;update();save.disabled=cal.stale;
    save.onclick=()=>run(async()=>{
      const restricted=kind.value==='special'&&!all.checked;
      // This card may have been opened before the Worker was deployed.
      // Always check the ACTIVE service again, instead of trusting the older
      // list response captured when the card was rendered.
      const latest=restricted?await request('list'):null;
      if(restricted&&latest?.recipientFeatureVersion!==1){
       const active=(await connection()).origin;
       throw Error('Die aktuell verbundene Cloudflare-Adresse ('+active+') meldet noch keine Empfängerauswahl. Bitte prüfen, ob genau dieser Worker in Cloudflare unter Produktion veröffentlicht wurde. Danach „Kalendereinträge laden“ drücken. Es wurde nichts gespeichert.');
      }
      if(restricted&&!latest.events.some(item=>item.id===e.id))throw Error('Die Sonderprobe wurde inzwischen geändert. Bitte Kalendereinträge neu laden.');
      if(['probe','special'].includes(kind.value)&&cal.attendanceTypeVersion!==1){const active=(await connection()).origin;throw Error('Für die iPad-Terminart muss der Cloudflare-Worker aktualisiert werden ('+active+'). Bitte den aktuellen Worker-Code veröffentlichen. Es wurde nichts gespeichert.');}
      const ids=restricted?people.filter(c=>c.checked).map(c=>c.value):null;
      if(restricted&&!ids.length)throw Error('Bitte mindestens ein Mitglied für die Sonderprobe auswählen.');
      const data={eventId:e.id,kind:kind.value==='special'?'probe':kind.value,...(['probe','special'].includes(kind.value)?{sessionType:kind.value==='special'?'Sonderprobe':'Probe'}:{}),approved:['probe','special'].includes(kind.value)&&approval.checked,memberId:kind.value==='birthday'?person.value:null,...(['probe','special'].includes(kind.value)?{attendanceType:attendanceType.value}:{}),expectedVersion:restricted?latest.rulesVersion:cal.rulesVersion,...(kind.value==='special'?{recipientIds:ids}:{})};
      const matches=entry=>Array.isArray(entry?.recipientIds)&&entry.recipientIds.length===ids.length&&ids.every(id=>entry.recipientIds.includes(id));
      // Current Workers validate recipients and approval together, in one D1
      // rules update. Never temporarily turn off approval: a timeout between
      // two requests otherwise leaves already approved events disabled.
      const saved=await request('classify',data);
      if(restricted&&(saved.recipientFeatureVersion!==1||!Array.isArray(saved.recipientIds)||saved.recipientIds.length!==ids.length||!ids.every(id=>saved.recipientIds.includes(id))))throw Error('Der Cloudflare-Worker hat die Empfängerliste nicht bestätigt. Bitte Worker aktualisieren und Einordnung prüfen.');
      admin();reviewShowSaved=true;lastLoad=0;await reviewCalendar();
      const stored=reviewSnapshot?.events.find(item=>item.id===e.id);
      if(restricted&&!matches(stored))throw Error('Die Empfängerauswahl konnte nach dem Speichern nicht bestätigt werden. Bitte Kalender neu laden und Empfänger prüfen.');
      if(stored?.approved!==data.approved)throw Error('Die Freigabe für Anmeldung und Erinnerungen wurde nicht wie gewünscht übernommen. Bitte den Termin prüfen.');
      if(['probe','special'].includes(kind.value)&&stored?.attendanceType!==data.attendanceType)throw Error('Die iPad-Terminart wurde nicht wie gewünscht gespeichert. Bitte Kalender neu laden und prüfen.');
      $('status').textContent='✓ Einordnung, Empfänger und Freigabe gespeichert.';
     });card.append(badge,h,recognition,kind,attendanceTypeLabel,approvalLabel,personLabel,recipientsLabel,recipients,note,save);$('review-events').append(card);
   }reviewControls();$('review-status').textContent=(cal.recipientFeatureVersion===1?'':'⚠ Der Cloudflare-Worker ist für die Empfängerauswahl nicht aktuell. Bitte das neue worker.bundle.js in Cloudflare veröffentlichen. Eine Auswahl einzelner Mitglieder ist bis dahin nicht möglich. ')+reviewSnapshot.events.filter(e=>e.automatic!==false||e.kind==='birthday'&&!e.memberId).length+' offene Einträge · '+reviewSnapshot.events.filter(e=>e.automatic===false&&!(e.kind==='birthday'&&!e.memberId)).length+' gespeichert · '+reviewSnapshot.events.length+' anstehende Kalendereinträge · '+reviewSnapshot.events.filter(e=>e.approved&&e.kind==='probe').length+' Probetermine freigegeben.'+(cal.stale?' Kalender derzeit nicht aktuell bestätigt.':'');
  }catch(e){if(version===calendarGeneration){$('review-status').textContent=e.message;$('review-auto').disabled=true;$('review-load').hidden=false;}}finally{if(version===calendarGeneration)reviewLoading=false;}
 }
 function qrLoading(active){const button=$('show-qr');button.disabled=active||busy;button.classList.toggle('is-loading',active);button.setAttribute('aria-busy',String(active));button.textContent=active?'Portal-Code wird vorbereitet …':'Persönlichen Portal-Code anzeigen';}
 function clearQR(){qrLoading(false);$('qr-status').textContent='';$('install-guide').hidden=true;const canvas=$('qr');canvas.hidden=true;canvas.width=canvas.height=0;$('link').hidden=true;$('link').removeAttribute('href');}
 async function load(){return run(async()=>{const version=generation;clearQR();const state=await g.oneDriveReadState();if(version!==generation)return;admin();$('member').replaceChildren(node('option','Bitte Mitglied auswählen'));$('member').firstChild.value='';for(const member of state.members){const opt=node('option',[member.lastName,member.firstName].filter(Boolean).join(' '));opt.value=String(member.id);$('member').append(opt);}$('status').textContent='Mitglied auswählen und persönlichen Portal-Code anzeigen.';});}
 async function loadCalendar(){return run(async()=>{const version=generation;document.getElementById('portal-calendar-administration').hidden=false;document.getElementById('portal-calendar-admin-open').hidden=true;await syncRoster();const result=await request('config');if(version!==generation)return;admin();$('calendar').value=result.config?.calendarUrl||'';$('hours').value=String(result.config?.leadHours||24);await reviewCalendar();$('status').textContent=result.configured?'Kalender verbunden. Erinnerungen gehen an Zusagen und offene Rückmeldungen; Entschuldigte werden ausgelassen.':'Bitte den öffentlichen Google-iCal-Link eintragen und speichern.';});}
 async function qr(){return run(async()=>{
  clearQR();const id=$('member').value,version=generation;
  if(!id){$('qr-status').textContent='Bitte ein Mitglied auswählen.';return;}
  qrLoading(true);$('qr-status').textContent='Mitglieder werden abgeglichen und dein persönlicher Portal-Code wird geladen. Bitte kurz warten …';
  try{
   await syncRoster();if(version!==generation)return;admin();
   $('qr-status').textContent='Persönlicher Portalzugang wird vorbereitet …';
   const url=await g.DrinksMobile.adminLink(id);if(version!==generation)return;admin();
   const code=qrcode(0,'M');code.addData(url);code.make();
   const canvas=$('qr'),count=code.getModuleCount(),unit=6,quiet=4;canvas.width=canvas.height=(count+quiet*2)*unit;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';
   for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(code.isDark(r,c))ctx.fillRect((c+quiet)*unit,(r+quiet)*unit,unit,unit);
   canvas.hidden=false;$('link').href=url;$('link').hidden=false;$('install-guide').hidden=false;
   $('qr-status').textContent='Persönlicher QR-Code für '+$('member').selectedOptions[0].textContent+'. Nur diesem Mitglied zeigen.';
  }catch(e){if(version===generation){clearQR();$('qr-status').textContent='Portal-Code konnte nicht geladen werden. '+e.message+' Bitte erneut versuchen.';}}
  finally{qrLoading(false);}
 });}
 function lock(){document.getElementById('portal-calendar-administration').hidden=true;document.getElementById('portal-calendar-admin-open').hidden=false;document.getElementById('portal-calendar-admin-status').textContent='';generation++;calendarGeneration++;reviewLoading=false;reviewLastLoad=0;reviewSnapshot=null;$('review-load').hidden=true;reviewEdited.clear();$('review-auto').disabled=true;$('calendar-status').textContent='';$('review-events').replaceChildren();$('review-status').textContent='';clearQR();$('calendar').value='';$('member').replaceChildren();document.getElementById('portal-admin-status').textContent='';}
 function chosen(){const linked=safeStorage.getItem('h2o_calendar_session');if(linked)try{const v=JSON.parse(linked);if(v.session===currentSessionId&&v.session)return v.event;}catch{}return selected;}
 async function replies(){const id=chosen();if(!id){replyData=null;paintReplies();return;}replyData=null;paintReplies();const result=await request('replies',{eventId:id});if(chosen()!==id)return;replyData=result;paintReplies();}
 function replyCandidates(){
  if(!replyData||currentOperationId||currentSessionId&&sessionType==='Einsatz')return [];
  const answers=new Map(replyData.replies.map(r=>[String(r.memberId),r.status]));
  const known=new Set(todayEntries().flatMap(e=>[e.storedName,e.displayName]).filter(Boolean));
  const type=currentSessionId?sessionType:replyData.event.attendanceType||replyData.event.sessionType;if(type==='Einsatz')return [];
  return members.filter(m=>(type!=='Ausschuss Sitzung'||m.committeeMember)&&(!Array.isArray(replyData.event.recipientIds)||replyData.event.recipientIds.includes(String(m.id)))&&['yes','excused'].includes(answers.get(String(m.id)))&&!known.has(nameForStorage(m))&&!known.has(nameForTile(m))&&!pendingMemberStatuses.has(m.id)).map(member=>({member,status:answers.get(String(member.id))==='yes'?'Anwesend':'Entschuldigt'}));
 }
 function stageCalendarReplies(){
  if(!replyData||replyData.stale||chosen()!==replyData.event.id||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed)return false;
  if(!replyCandidates().length)return false;
  const eventId=replyData.event.id;
  if(!currentSessionId&&!currentOperationId){if(typeof beginAttendanceFromContext!=='function')return false;beginAttendanceFromContext();}
  if(!currentSessionId||currentOperationId||sessionType==='Einsatz'||chosen()!==eventId)return false;
  const plan=replyCandidates();if(!plan.length){paintReplies();return false;}
  g.WorkflowUX?.beforeSelection();
  for(const {member,status} of plan)pendingMemberStatuses.set(member.id,status);
  chosenMemberIds=new Set(pendingMemberStatuses.keys());
  if(typeof setHomeFlowStage==='function')setHomeFlowStage(2);
  renderMembers();updateSelection();paintReplies();
  const yes=plan.filter(p=>p.status==='Anwesend').length,excused=plan.length-yes;
  showToast(yes+' zugesagt · '+excused+' entschuldigt vorgemerkt. Vor Ort prüfen und Markierungen übernehmen.');return true;
 }
 function paintReplies(){const area=document.getElementById('portal-attendance-replies');if(!area)return;const expanded=new Map([...area.querySelectorAll('details')].map(d=>[d.dataset.replyStatus,d.open]));area.replaceChildren();if(!replyData){area.append(node('p','Kalendertermin auswählen, um Zusagen und Entschuldigungen zu sehen.'));return;}
  area.append(node('h3',replyData.event.title+' · '+date(replyData.event)));if(replyData.stale)area.append(node('p','Kalender derzeit nicht aktuell bestätigt.'));
  const plan=replyCandidates(),apply=node('button',plan.length+' Rückmeldung'+(plan.length===1?'':'en')+' vormerken');apply.type='button';apply.className='primary-button';apply.hidden=!plan.length;apply.disabled=replyData.stale||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed;apply.onclick=stageCalendarReplies;area.append(apply);
  const answers=new Map(replyData.replies.map(r=>[String(r.memberId),r.status]));for(const [status,title] of [['yes','Zugesagt'],['excused','Entschuldigt'],['maybe','Noch unsicher'],['open','Ohne Rückmeldung']]){const people=members.filter(m=>(!Array.isArray(replyData.event.recipientIds)||replyData.event.recipientIds.includes(String(m.id)))&&(answers.get(String(m.id))||'open')===status),details=node('details'),summary=node('summary',title+' ('+people.length+')');details.append(summary);details.dataset.replyStatus=status;details.open=expanded.has(status)?expanded.get(status):status==='yes'&&people.length>0;const names=node('p',people.map(m=>[m.lastName,m.firstName].filter(Boolean).join(' ')).join(' · ')||'Keine');if(people.length)details.append(names);area.append(details);}
  area.append(node('p',plan.length?'Mit einem Tippen Zusagen als „Anwesend“ und Entschuldigungen vormerken. Anschließend vor Ort prüfen und „Markierungen übernehmen“ wählen. Ohne Rückmeldung bleibt offen.':'Neue Rückmeldungen werden hier zur Vormerkung angeboten. Bereits erfasste Personen und eigene Markierungen bleiben erhalten.'));
  const reminder=node('button',manual?'Versand fortsetzen / erneut prüfen':'Alle außer Entschuldigten erinnern');reminder.type='button';reminder.className='outline-button';reminder.disabled=replyData.stale||replyData.event.start<=Date.now();reminder.onclick=async()=>{if(!requireAdmin(!document.getElementById(CALENDAR).hidden?CALENDAR:VIEW))return;if(!manual&&!confirm('Alle für diesen Termin freigegebenen Mitglieder mit aktivierten Handy-Mitteilungen erinnern? Entschuldigte erhalten keine Nachricht.'))return;manual=manual||{eventId:replyData.event.id,requestId:crypto.randomUUID()};reminder.disabled=true;try{const result=await request('remind',manual);if(!result.remaining)manual=null;showToast(result.accepted+' Handy-Mitteilungen angenommen · '+result.failed+' fehlgeschlagen'+(result.remaining?' · Versand bitte fortsetzen.':'.'));paintReplies();}catch(e){showToast(e.message+' Denselben Versand erneut prüfen.','error');reminder.disabled=false;reminder.textContent='Versand erneut prüfen';}};area.append(reminder);
 }
 async function refreshAttendance(force=false){
  if(document.hidden||!document.getElementById('portal-calendar-pick'))return;
  if(loading){if(force)attendanceRefreshPending=true;return;}
  if(!force&&Date.now()-lastLoad<60000)return;
  loading=true;const epoch=attendanceEpoch;
  try{
   // An approved calendar is safe to read without Microsoft credentials.
   // Private attendance replies are never included in the anonymous response.
   let cal,privateAccess=false;
   if(typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady()){
    try{cal=await request('list');privateAccess=true;}catch(e){cal=await publicList();}
   }else cal=await publicList();
   if(epoch!==attendanceEpoch)return;
   lastLoad=Date.now();
   const now=Date.now(),running=Boolean(currentSessionId||currentOperationId),current=chosen();
   // The active attendance session stays linked to its event even after that
   // event ends. Otherwise only future or currently ongoing events appear.
   const previous=list.find(e=>e.id===current);
   list=cal.events.filter(e=>e.approved&&e.kind==='probe'&&(e.end>now||(running&&e.id===current))).sort((a,b)=>a.start-b.start);
   const picker=document.getElementById('portal-calendar-pick');if(!picker)return;
   const stillAvailable=list.some(e=>e.id===current);
   const nextId=stillAvailable?current:(running||manualNoCalendar?'':(list[0]?.id||''));
   picker.replaceChildren();const none=node('option','Ohne Kalendertermin / spontan');none.value='';picker.append(none);
   for(const e of list){const kind=e.sessionType||'Probe',title=e.title||kind,label=title.trim().toLocaleLowerCase('de')===kind.toLocaleLowerCase('de')?title:title+' · '+kind;const option=node('option',date(e)+' · '+label);option.value=e.id;picker.append(option);}
   picker.value=nextId||'';
   // Automatically pick the next event only while no attendance session runs.
   // Applying the selection also sets its date and the centrally configured
   // session type. Never overwrite an explicit "spontan" choice.
   const next=list.find(e=>e.id===nextId),changed=next&&(previous?.start!==next.start||previous?.sessionType!==next.sessionType||previous?.attendanceType!==next.attendanceType);
   if(!running&&(nextId!==current||changed))select(true);
   document.getElementById('portal-calendar-status').textContent=cal.configured?(cal.stale?'Kalender zuletzt nicht aktualisiert.':'Kalenderstand: '+new Date(cal.fetchedAt).toLocaleString('de-DE')):'Kalender unter Einstellungen → Kalender verbinden.';
   if(privateAccess)await replies();else{replyData=null;paintReplies();}g.syncAttendanceStart?.();
  }catch(e){const status=document.getElementById('portal-calendar-status');if(epoch===attendanceEpoch&&status)status.textContent=g.ConnectionStatus?.message(e)||e.message;}
  finally{loading=false;const again=attendanceRefreshPending;attendanceRefreshPending=false;if(again)await refreshAttendance(true);}
 }
 function select(automatic=false){const id=document.getElementById('portal-calendar-pick').value;if(manual){document.getElementById('portal-calendar-pick').value=chosen()||'';return showToast('Bitte zuerst den unbestätigten Erinnerungsversand erneut prüfen.','error');}const e=list.find(e=>e.id===id);if((currentOperationId||currentSessionId&&(todayEntries().length||pendingMemberStatuses.size))&&id!==chosen()){document.getElementById('portal-calendar-pick').value=chosen()||'';return showToast('Der laufende Termin enthält bereits Anwesenheiten. Bitte diesen Termin zuerst abschließen.','error');}selected=id||null;if(!automatic)manualNoCalendar=!id;replyData=null;if(e){const spontaneous=document.getElementById('attendanceSpontaneous');if(spontaneous)spontaneous.open=false;if(!currentSessionId&&!currentOperationId){const sessionType=e.attendanceType||(e.sessionType==='Probe'?'Allgemeine Probe':e.sessionType);if(['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung','Einsatz'].includes(sessionType)){if(typeof chooseSessionType==='function')chooseSessionType(sessionType,{calendar:true});else document.querySelector('#sessionTypes [data-session-type="'+sessionType+'"]')?.click();}}currentProbeDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(e.start));const input=byId('probeDateInput');if(input)input.value=currentProbeDate;}
  if(currentSessionId)safeStorage.setItem('h2o_calendar_session',JSON.stringify({session:currentSessionId,event:selected}));g.syncAttendanceStart?.();if(!automatic&&typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady())replies().catch(e=>{document.getElementById('portal-calendar-status').textContent=e.message;});}
 function selectedEvent(){return list.find(e=>e.id===chosen())||null;}
 function useSpontaneous(){if(currentSessionId||currentOperationId)return false;selected=null;manualNoCalendar=true;replyData=null;const picker=document.getElementById('portal-calendar-pick');if(picker)picker.value='';currentProbeDate=typeof systemToday==='function'?systemToday():new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());const input=byId('probeDateInput');if(input)input.value=currentProbeDate;paintReplies();return true;}
 function selectedDate(){const e=list.find(e=>e.id===chosen());return e?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(e.start)):null;}
 function sessionStarted(){const date=selectedDate();if(date)currentProbeDate=date;if(selected&&currentSessionId)safeStorage.setItem('h2o_calendar_session',JSON.stringify({session:currentSessionId,event:selected}));paintReplies();}
 function discard(keepCalendar=false){if(!keepCalendar){selected=null;replyData=null;manualNoCalendar=false;}safeStorage.removeItem('h2o_calendar_session');const picker=document.getElementById('portal-calendar-pick');if(picker)picker.value=selected||'';paintReplies();}
 function init(){
  $('open').onclick=()=>showView(VIEW);document.getElementById('portal-calendar-back').onclick=()=>{lock();showView('settingsView');};document.getElementById('portal-calendar-admin-open').onclick=()=>{if(requireAdmin(CALENDAR))loadCalendar();};$('back').onclick=()=>{lock();showView('settingsView');};$('member').onchange=()=>{generation++;clearQR();$('status').textContent='';};$('show-qr').onclick=qr;$('review-load').onclick=()=>{if(reviewEdited.size){$('review-status').textContent='Bitte deine Änderungen zuerst speichern. Sie bleiben hier erhalten.';return;}return reviewCalendar();};$('review-auto').onclick=acceptAutomatic;$('review-toggle').onclick=()=>{reviewShowSaved=!reviewShowSaved;reviewControls();};$('review-filter').onchange=()=>{reviewFilter=$('review-filter').value;reviewControls();};$('form').onsubmit=event=>{event.preventDefault();return run(async()=>{const version=generation,form=$('form'),submit=form.querySelector('button[type=submit]'),label=submit.textContent;form.setAttribute('aria-busy','true');submit.textContent='Kalender wird geprüft …';$('calendar-status').textContent='Google-Kalender wird abgerufen und geprüft. Das kann einige Sekunden dauern …';try{const result=await request('configure',{calendarUrl:$('calendar').value.trim(),reminders:true,leadHours:Number($('hours').value)});if(version!==generation)return;admin();$('calendar-status').textContent=result.count+' Kalendereinträge verbunden. Erinnerungseinstellungen gespeichert.';$('status').textContent='';lastLoad=0;try{await syncRoster(true);}catch(e){$('calendar-status').textContent+=' Mitgliederabgleich noch nicht bestätigt: '+e.message;}await reviewCalendar();}catch(e){if(version===generation)$('calendar-status').textContent=e.message;throw e;}finally{form.removeAttribute('aria-busy');submit.textContent=label;}});};
  const observer=new MutationObserver(()=>{if(document.getElementById(VIEW).hidden&&document.getElementById(CALENDAR).hidden)lock();});for(const id of [VIEW,CALENDAR])observer.observe(document.getElementById(id),{attributes:true,attributeFilter:['hidden']});
  const panel=document.querySelector('#attendanceView .home-session-type-panel'),section=node('section');section.className='portal-calendar-picker';section.innerHTML='<h3>Termin aus dem Probenkalender</h3><label for="portal-calendar-pick">Kalendertermin</label><select id="portal-calendar-pick" class="text-input"><option value="">Ohne Kalendertermin / spontan</option></select><p id="portal-calendar-status" role="status"></p>';(document.getElementById('attendanceCalendarChoice')||panel).prepend(section);document.getElementById('portal-public-origin').value=publicOrigin();document.getElementById('portal-public-save').onclick=()=>{const origin=document.getElementById('portal-public-origin').value.trim().replace(/\/$/,'')+'/';if(!g.DrinksPush.validOrigin(origin))return showToast('Bitte eine gültige Cloudflare-Worker-Adresse eingeben.','error');rememberOrigin(origin);lastLoad=0;showToast('Kalenderadresse auf diesem Gerät gespeichert.');refreshAttendance(true);};document.getElementById('portal-calendar-pick').onchange=()=>select();
  const replyArea=node('section');replyArea.id='portal-attendance-replies';replyArea.className='panel portal-attendance-replies';document.querySelector('#attendanceView .attendance-layout').prepend(replyArea);paintReplies();
  const attendanceView=document.getElementById('attendanceView'),attendanceObserver=new MutationObserver(()=>{if(!attendanceView.hidden)refreshAttendance(true);});attendanceObserver.observe(attendanceView,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!attendanceView.hidden)refreshAttendance(true);if(!document.getElementById(CALENDAR).hidden&&!document.getElementById('portal-calendar-administration').hidden)reviewCalendar({automatic:true});}});
  g.addEventListener('online',()=>refreshAttendance(true));
  queueMicrotask(()=>refreshAttendance(true));
  setInterval(()=>{if(document.hidden)return;if(!byId('attendanceView').hidden)refreshAttendance();if(!document.getElementById(CALENDAR).hidden&&!document.getElementById('portal-calendar-administration').hidden)reviewCalendar({automatic:true});},60000);
 }
 g.PortalAdmin={load,loadCalendar,lock,refreshAttendance,sessionStarted,discard,syncRoster,renderSyncStatus,storageChanged,selectedDate,selectedEvent,useSpontaneous,attendanceChanged:paintReplies};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
