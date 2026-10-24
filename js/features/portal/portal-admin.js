/* iPad administration and attendance projection. RSVP never creates attendance records. */
(function(g){
 'use strict';let reminderPanel=null,reminderEvent=null;const VIEW='settingsPortalView',CALENDAR='settingsCalendarView',$=id=>document.getElementById(id==='status'&&!document.getElementById(CALENDAR).hidden?'portal-calendar-admin-status':'portal-admin-'+id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};let generation=0,busy=false,list=[],selected=null,manualNoCalendar=false,replyData=null,lastLoad=0,loading=false,attendanceRefreshPending=false,attendanceAccess=null,attendanceEpoch=0,manual=null,rosterKey=null,rosterBusy=false,rosterStatus={kind:"pending",text:"Mitglieder noch nicht mit dem Handyportal abgeglichen."},rosterSyncedAt=null,rosterResyncRequested=false,calendarGeneration=0,reviewLoading=false,reviewLastLoad=0,reviewSnapshot=null,reviewShowSaved=true,reviewEdited=new Set(),reviewFilter='all',reviewQuery='',reviewOpen=new Set(),reviewPinned=new Set();
 const date=e=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',...(e.allDay?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(e.start));
 function admin(){if(!requireAdmin(!document.getElementById(CALENDAR).hidden?CALENDAR:VIEW))throw Error('Bitte die Administration entsperren.');}
 const PUBLIC_ORIGIN_KEY='h2o_calendar_public_origin';
 function publicOrigin(){const value=localStorage.getItem(PUBLIC_ORIGIN_KEY)||'';return g.DrinksPush.validOrigin(value)?value:'';}
 function rememberOrigin(origin){if(g.DrinksPush.validOrigin(origin))localStorage.setItem(PUBLIC_ORIGIN_KEY,origin);}
 async function publicList(){const origin=publicOrigin();if(!origin)throw Error('Bitte unter Einstellungen → Kalender einmalig die öffentliche Cloudflare-Dienstadresse eintragen.');const response=await fetch(origin.replace(/\/$/,'')+'/calendar/public',{method:'GET',cache:'no-store',redirect:'error'});const data=await response.json();if(!response.ok)throw Error(data.error||'Kalender momentan nicht erreichbar.');if(!Array.isArray(data.events))throw Error('Ungültige Kalenderantwort.');return data;}
 async function connection(){const c=await g.DrinksCentral.connection();if(!c)throw Error('Bitte zuerst den bestehenden Kontodienst verbinden.');rememberOrigin(c.origin);return c;}
 async function request(path,data={}){
  const version=generation,source=g.DrinksStore.sourceKey(),c=await connection();
  const current=()=>{if(version!==generation)throw Error('Zugang wurde geändert. Bitte erneut öffnen.');if(source!==c.source||g.DrinksStore.sourceKey()!==source){lock();throw Error('Mitgliederordner wurde geändert. Bitte erneut öffnen.');}};
  try{current();const result=await g.DrinksPush.request(c,'/admin/portal/'+path,{source:c.source,...data});current();if((['configure','classify','groups','colors','google-colors','display'].includes(path)&&Object.keys(data).length>0)||(path==='list'&&data.force===true))g.CalendarSidebar?.clear();return result;}
  catch(e){if(e.status===404&&e.message==='Nicht gefunden.')throw Error('Bitte zuerst den bestehenden Cloudflare-Worker für das H₂O Portal aktualisieren.');throw Object.assign(Error(g.ConnectionStatus?.message(e)||e.message),{status:e.status});}
 }

 let groupSnapshot=null,groupDraft=null,groupsDirty=false,groupEditing=null,calendarSection='events',connectionDirty=false,connectionSaved={url:'',hours:'24'};
 const reviewEditors=new Map(),reviewSelection=new Set(),expandedGroups=new Set();let selectingEvents=false,expiryTimer=null;
 const currentEvent=e=>Number.isFinite(e.end)&&e.end>Date.now();
 const needsReview=e=>!!e.googleIssues?.length||e.kind!=='info'&&e.automatic!==false&&!e.approved||e.kind==='birthday'&&!e.memberId||e.kind==='probe'&&(!e.approved||Array.isArray(e.recipientIds)&&!e.recipientIds.length);
 const sortedPeople=people=>[...people].sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
 function nameList(ids,roster){
  const known=new Map((roster||[]).map(p=>[p.id,p]));const people=ids===null?[...known.values()]:[...new Set(ids)].map(id=>known.get(id)||{id,name:'Zuordnung nicht im aktuellen Mitgliederstand gefunden'});
  const list=node('ul');list.className='portal-name-list';for(const person of sortedPeople(people)){const item=node('li',person.name);item.dataset.memberId=person.id;list.append(item);}return list;
 }
 function cancelChanges(){
  if(g.CalendarDisplayAdmin&&!g.CalendarDisplayAdmin.cancel())return false;
  if(busy){showToast('Bitte warten, bis die Speicherung abgeschlossen ist.','error');return false;}
  if((groupsDirty||reviewEdited.size||connectionDirty)&&!confirm('Ungespeicherte Änderungen verwerfen?'))return false;
  for(const editor of reviewEditors.values())editor.close();
  if(groupsDirty||groupEditing){groupsDirty=false;groupEditing=null;groupDraft=groupSnapshot?structuredClone(groupSnapshot.groups):null;paintGroups();}
  if(connectionDirty){$('calendar').value=connectionSaved.url;$('hours').value=connectionSaved.hours;connectionDirty=false;}
  return true;
 }
 function beforeView(view){return view===CALENDAR||view==='adminLoginView'||document.getElementById(CALENDAR).hidden?true:cancelChanges();}
 function showCalendarSection(section,force=false){
  if(!force&&section!==calendarSection&&!cancelChanges())return false;
  calendarSection=section;
  for(const key of ['events','groups','connection']){
   const panel=document.getElementById('portal-calendar-'+key),button=document.getElementById('portal-calendar-nav-'+key);
   if(panel)panel.hidden=key!==section;if(button)button.setAttribute('aria-pressed',String(key===section));
  }
  const setup=document.getElementById('portal-calendar-public-setup');if(setup)setup.hidden=!document.getElementById('portal-calendar-administration').hidden&&section!=='connection';
  if(reviewSnapshot)reviewControls();
  return true;
 }
 const groupSources={active:'Kennzeichen: aktive Mitglieder',agt:'Kennzeichen: Atemschutz',leader:'Kennzeichen: Gruppenführer',age:'Kennzeichen: Altersabteilung',committee:'Kennzeichen: Ausschuss',manual:'Manuell hinterlegte Mitglieder'};
 function paintHelpGroups(){
  const host=document.getElementById('calendar-help-groups');if(!host)return;host.replaceChildren();
  const groups=(groupSnapshot?.groups||[]).filter(group=>group.enabled);
  if(!groups.length){host.append(node('p','Keine aktiven Gruppen gespeichert. Ohne passenden Gruppentreffer werden alle aktiven Mitglieder vorgesehen.'));return;}
  for(const group of groups){const card=node('article'),title=node('h4',group.name),words=node('div');card.className='calendar-help-group';card.setAttribute('role','listitem');words.className='calendar-help-keywords';for(const word of group.keywords)words.append(node('span',word));if(!group.keywords.length)words.append(node('span','Keine Schlagwörter'));card.append(title,words,node('p',group.general?'Allgemeine Regel · spezielle Gruppen haben Vorrang':'Spezielle Gruppe · zugeordnete Mitglieder'));host.append(card);}
 }
 async function loadGroups(){
  if(groupsDirty)return;
  const version=generation,data=await request('groups');if(version!==generation||groupsDirty)return;admin();groupSnapshot=data;groupDraft=structuredClone(data.groups);paintGroups();paintHelpGroups();
 }
 function paintGroups(){
  const host=document.getElementById('portal-keyword-groups');if(!host||!groupSnapshot||!groupDraft)return;
  host.replaceChildren();
  const toolbar=node('div');toolbar.className='portal-calendar-actions';
  const add=node('button','Neue Gruppe'),reload=node('button','Erneut laden');add.type=reload.type='button';add.className='primary-button';reload.className='outline-button';toolbar.append(add,reload);host.append(toolbar);
  const status=node('p',groupsDirty?'Änderungen noch nicht gespeichert.':'Gespeicherte Gruppen · '+(groupSnapshot.rosterUpdatedAt?'Mitgliederstand: '+new Date(groupSnapshot.rosterUpdatedAt).toLocaleString('de-DE'):'Mitgliederstand geladen'));
  status.setAttribute('role','status');host.append(status);
  const mark=()=>{groupsDirty=true;status.textContent='Änderungen noch nicht gespeichert.';};
  const beginEdit=id=>{if(groupEditing===id)return;if(!cancelChanges())return;groupEditing=id;paintGroups();};
  add.onclick=()=>{if(!cancelChanges())return;const id=crypto.randomUUID();groupDraft.push({id,name:'Neue Gruppe',keywords:[],source:'manual',memberIds:[],enabled:true,general:false});groupEditing=id;mark();paintGroups();};
  reload.onclick=()=>{if(!cancelChanges())return;return run(async()=>{await loadGroups();await reviewCalendar();},status);};
  for(const group of groupDraft){
   const box=node('details');box.className='portal-keyword-card';box.open=expandedGroups.has(group.id)||groupEditing===group.id;box.ontoggle=()=>{if(box.open)expandedGroups.add(group.id);else expandedGroups.delete(group.id);};box.dataset.groupId=group.id;
   const summary=node('summary'),heading=node('h4',group.name),count=node('span'),sourceNote=node('p'),keywordsNote=node('p'),peopleArea=node('div');
   summary.append(heading,count);count.className='portal-group-count';sourceNote.className='portal-review-meta';keywordsNote.className='portal-group-keywords';
   const namesTitle=node('h5'),search=node('input'),names=node('div'),empty=node('p');
   search.type='search';search.className='text-input';search.placeholder='Person in dieser Gruppe suchen';search.setAttribute('aria-label','Person in '+group.name+' suchen');
   const filter=()=>{let shown=0;const query=search.value.trim().toLocaleLowerCase('de');for(const li of names.querySelectorAll('li')){li.hidden=!li.textContent.toLocaleLowerCase('de').includes(query);if(!li.hidden)shown++;}empty.textContent=query&&!shown?'Keine passenden Personen.':'';empty.hidden=!empty.textContent;};
   search.oninput=filter;peopleArea.append(namesTitle,search,names,empty);peopleArea.className='portal-group-people';
   const recount=()=>{
    const ids=g.PortalGroups.members(group,{members:groupSnapshot.members});heading.textContent=group.name;count.textContent=ids.length+' Personen';
    sourceNote.textContent=(group.enabled?'Aktiv':'Deaktiviert · wird nicht automatisch verwendet')+' · '+groupSources[group.source];
    keywordsNote.textContent='Schlagwörter: '+(group.keywords.join(' · ')||'Noch keine')+(group.general?' · allgemeine Regel':'');
    namesTitle.textContent='Zugeordnete Personen ('+ids.length+')';names.replaceChildren(nameList(ids,groupSnapshot.members));search.hidden=ids.length<8;
    filter();if(!ids.length){empty.hidden=false;empty.textContent='Keine Personen zugeordnet.';}
   };
   const edit=node('button','Gruppe bearbeiten');edit.type='button';edit.className='outline-button';edit.onclick=()=>beginEdit(group.id);edit.hidden=groupEditing===group.id;
   box.append(summary,sourceNote,keywordsNote,peopleArea,edit);
   if(groupEditing===group.id){
    const form=node('div');form.className='portal-group-editor';
    const field=(label,control)=>{const line=node('label',label);line.append(control);form.append(line);return control;};
    const name=field('Gruppenname',node('input'));name.className='text-input';name.maxLength=80;name.value=group.name;
    name.oninput=()=>{group.name=name.value;mark();heading.textContent=name.value||'Neue Gruppe';};
    const keywords=field('Schlagwörter · ein Begriff je Zeile',node('textarea'));keywords.className='text-input';keywords.rows=3;keywords.value=group.keywords.join('\n');keywords.oninput=()=>{group.keywords=keywords.value.split('\n').map(s=>s.trim()).filter(Boolean);mark();recount();};
    const source=field('Personen zuordnen über',node('select'));source.className='text-input';for(const [value,label] of Object.entries(groupSources)){const opt=node('option',label);opt.value=value;source.append(opt);}source.value=group.source;
    const manual=node('div');manual.className='portal-recipient-list';manual.hidden=group.source!=='manual';
    for(const person of sortedPeople(groupSnapshot.members)){
     const label=node('label'),check=node('input');check.type='checkbox';check.value=person.id;check.checked=group.memberIds.includes(person.id);label.append(check,node('span',person.name));manual.append(label);
     check.onchange=()=>{group.memberIds=group.memberIds.filter(id=>id!==person.id);if(check.checked)group.memberIds.push(person.id);mark();recount();};
    }
    const memberSearch=node('input');memberSearch.type='search';memberSearch.className='text-input';memberSearch.placeholder='Person zur Auswahl suchen';memberSearch.setAttribute('aria-label','Manuelle Gruppenmitglieder suchen');memberSearch.hidden=group.source!=='manual';memberSearch.oninput=()=>{const q=memberSearch.value.trim().toLocaleLowerCase('de');for(const label of manual.children)label.hidden=!label.textContent.toLocaleLowerCase('de').includes(q);};
    source.onchange=()=>{if(source.value==='manual'&&group.source!=='manual'){group.memberIds=g.PortalGroups.members(group,{members:groupSnapshot.members});for(const check of manual.querySelectorAll('input'))check.checked=group.memberIds.includes(check.value);}group.source=source.value;manual.hidden=memberSearch.hidden=group.source!=='manual';mark();recount();};
    form.append(memberSearch,manual,node('p','Automatische Gruppen folgen den hinterlegten Mitgliederkennzeichen. Für eine eigene Auswahl „Manuell hinterlegte Mitglieder“ wählen.'));
    const enabled=node('input');enabled.type='checkbox';enabled.checked=group.enabled;field('Gruppe für automatische Zuordnung verwenden ',enabled);enabled.onchange=()=>{group.enabled=enabled.checked;mark();recount();};
    const general=node('input');general.type='checkbox';general.checked=group.general;field('Allgemeine Regel · spezifische Gruppen haben Vorrang ',general);general.onchange=()=>{group.general=general.checked;mark();recount();};
    const save=node('button','Gruppe speichern'),cancel=node('button','Abbrechen'),remove=node('button','Gruppe löschen');for(const b of [save,cancel,remove])b.type='button';save.className='primary-button';cancel.className=remove.className='outline-button';remove.className+=' portal-delete-group';
    const feedback=node('p');feedback.setAttribute('role','status');
    const persist=async groups=>{const result=await request('groups',{groups:g.PortalGroups.validate(groups),expectedVersion:groupSnapshot.version});if(result.version!==groupSnapshot.version+1)throw Error('Speicherung nicht bestätigt. Bitte den gespeicherten Stand prüfen.');admin();groupsDirty=false;groupEditing=null;await loadGroups();await reviewCalendar();};
    save.onclick=()=>run(()=>persist(groupDraft),feedback);cancel.onclick=()=>{if(cancelChanges())paintGroups();};
    remove.onclick=()=>{if(!confirm('Gruppe „'+group.name+'“ löschen? Die automatische Zuordnung kommender Termine kann sich dadurch ändern.'))return;return run(()=>persist(groupDraft.filter(g=>g.id!==group.id)),feedback);};
    const actions=node('div');actions.className='portal-calendar-actions';actions.append(save,cancel);form.append(actions,feedback,remove);box.append(form);
   }
   recount();host.append(box);
  }
  const tester=node('article');tester.className='portal-group-tester';tester.append(node('h4','Zuordnung testen'),node('p','Prüft die gespeicherten Regeln. Speichert keinen Termin und gibt keine Anmeldung frei.'));
  const label=node('label','Termintitel'),title=node('input');title.className='text-input';title.placeholder='Zum Beispiel: Sonderprobe Atemschutz';label.append(title);
  const test=node('button','Zuordnung anzeigen'),result=node('div');test.type='button';test.className='outline-button';result.setAttribute('aria-live','polite');
  test.onclick=()=>{admin();result.replaceChildren();if(!title.value.trim()){result.append(node('p','Bitte einen Termintitel eingeben.'));return;}const answer=g.PortalGroups.resolve(title.value,groupSnapshot.groups,{members:groupSnapshot.members}),groups=groupSnapshot.groups.filter(g=>answer.groupIds.includes(g.id));result.append(node('p',groups.length?'Passende Gruppen: '+groups.map(g=>g.name+' ('+g.keywords.join(', ')+')').join(' · '):'Kein passendes Schlagwort: alle aktiven Mitglieder.'),node('strong',answer.recipientIds.length+' zugeordnete Personen'),nameList(answer.recipientIds,groupSnapshot.members));if(!answer.recipientIds.length)result.append(node('p','Keine Personen zugeordnet.'));};
  tester.append(label,test,result);host.append(tester);
 }
 function renderSyncStatus(){const status=document.getElementById('memberEvidenceSyncStatus');if(status){status.textContent=rosterStatus.text;status.dataset.state=rosterStatus.kind;}const button=document.getElementById('memberEvidenceSync');if(button){button.hidden=!['pending','error'].includes(rosterStatus.kind);button.disabled=rosterBusy||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed;}}
 function syncStatus(kind,text){rosterStatus={kind,text};renderSyncStatus();}
 function storageChanged(){g.CalendarSidebar?.refresh();
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
   const c=await connection(),state=await g.oneDriveReadState(),people=state.members.map(m=>({id:String(m.id),name:[m.lastName,m.firstName].filter(Boolean).join(' '),firstName:m.firstName||'',ageDepartment:m.ageDepartment===true,committeeMember:m.committeeMember===true,leader:Array.isArray(m.roles)&&m.roles.includes('GF'),agt:m.breathingQualified===true||typeof m.breathingQualified!=='boolean'&&g.MemberEvidence.breathingRelevant(m),evidence:g.MemberEvidence.project({...m,breathingQualified:m.breathingQualified===true||typeof m.breathingQualified!=='boolean'&&g.MemberEvidence.breathingRelevant(m)})})),key=c.origin+':'+c.source+':'+JSON.stringify(people);
   if(key!==rosterKey||force){
    if(g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert.');
    const saved=await g.DrinksPush.request(c,'/admin/portal/roster',{source:c.source,members:people,agtSource:'member-checkbox'});
    if(saved.evidenceVersion!==1)throw Error('Für persönliche Nachweise bitte den aktuellen Cloudflare-Worker veröffentlichen.');
    if(g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert. Bitte erneut abgleichen.');
    rosterKey=key;rosterSyncedAt=Date.now();
   }
   if(typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed){syncStatus('pending','Weitere Änderungen warten auf OneDrive und Handyabgleich.');return false;}
   syncStatus('success','In OneDrive gespeichert · Handyportal abgeglichen am '+new Date(rosterSyncedAt).toLocaleString('de-DE')+'. Auf dem Handy „Aktualisieren“ wählen.');return true;
  }catch(e){syncStatus('error','Handyportal noch nicht aktualisiert. '+(g.ConnectionStatus?.message(e)||e.message)+' Mit „Nachweise fürs Handy aktualisieren“ erneut versuchen.');throw e;
  }finally{rosterBusy=false;renderSyncStatus();const again=rosterResyncRequested;rosterResyncRequested=false;if(again)storageChanged();}
 }
 async function run(fn,feedback=null){
  if(busy)return;busy=true;const version=generation,submit=$('form').querySelector('button[type=submit]'),buttons=[...document.querySelectorAll('#portal-admin-show-qr,#portal-calendar-administration button,#portal-calendar-administration select,#portal-calendar-administration input,#portal-calendar-administration textarea')].map(button=>[button,button.disabled]);
  submit.disabled=true;for(const [button] of buttons)button.disabled=true;
  try{admin();if(feedback)feedback.textContent='Wird gespeichert …';await fn();}
  catch(e){if(version===generation){const inline=feedback&&feedback.isConnected!==false;$('status').textContent=inline?'':e.message;if(inline)feedback.textContent=e.message;const review=$('review-status');if(!inline&&review&&!document.getElementById(CALENDAR).hidden){review.textContent=e.message;$('review-load').hidden=false;}}}
  finally{busy=false;submit.disabled=false;for(const [button,disabled] of buttons)if(button.isConnected)button.disabled=disabled;if(reviewSnapshot)reviewControls();}
 }
 function calendarCategory(e){return e.kind==='probe'?(e.sessionType==='Probe'?'probe':'special'):e.kind==='birthday'?'birthday':e.kind==='info'?'info':'other';}
 function reviewOverview(){
  if(!adminUnlocked||!oneDriveAdministrationReady())return null;
  if(!reviewSnapshot||reviewSnapshot.overviewSource!==g.DrinksStore.sourceKey())return {known:false};
  const events=reviewSnapshot.events.filter(currentEvent);
  return {known:true,count:events.filter(needsReview).length,groups:events.filter(e=>e.googleIssues?.length).length,stale:reviewSnapshot.stale===true,checkedAt:reviewLastLoad};
 }
 function openReview(){
  if(showView(CALENDAR)===false)return;
  reviewShowSaved=false;reviewPinned.clear();reviewFilter='all';reviewQuery='';$('review-search').value='';reviewControls();
  document.getElementById('portal-calendar-nav-events')?.click();
 }
 function matchesReview(e){return currentEvent(e)&&(reviewShowSaved||needsReview(e)||reviewPinned.has(e.id))&&(reviewFilter==='all'||calendarCategory(e)===reviewFilter)&&(!reviewQuery||[e.title,e.location,date(e),e.sessionType,e.attendanceType,e.clothing].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(reviewQuery));}
 function canRelease(e){return currentEvent(e)&&e.start>Date.now()&&e.kind==='probe'&&!e.approved&&(!Array.isArray(e.recipientIds)||e.recipientIds.length>0);}
 function automaticCandidates(){return (reviewSnapshot?.events||[]).filter(e=>matchesReview(e)&&canRelease(e)&&reviewSelection.has(e.id)&&!reviewEdited.has(e.id));}
 function reviewControls(){
  const all=(reviewSnapshot?.events||[]).filter(currentEvent),count=automaticCandidates().length;
  for(const id of reviewSelection)if(!all.some(e=>e.id===id&&matchesReview(e)&&canRelease(e)))reviewSelection.delete(id);
  $('review-auto').hidden=!selectingEvents;$('review-auto').disabled=!count||reviewSnapshot?.stale===true||reviewEdited.size>0||busy;
  $('review-auto').textContent=count+' ausgewählte Termine freigeben';
  $('review-toggle').textContent='Zu prüfen ('+all.filter(needsReview).length+')';$('review-toggle').setAttribute('aria-pressed',String(!reviewShowSaved));
  $('review-all').textContent='Alle ('+all.length+')';$('review-all').setAttribute('aria-pressed',String(reviewShowSaved));
  $('review-select').setAttribute('aria-pressed',String(selectingEvents));$('review-select').textContent=selectingEvents?'Auswahl beenden':'Mehrere freigeben';$('review-select').hidden=!selectingEvents&&!all.some(e=>matchesReview(e)&&canRelease(e));
  $('review-filter').value=reviewFilter;let shown=0;
  for(const card of $('review-events').children){
   const event=reviewSnapshot.events.find(e=>e.id===card.dataset.eventId);if(!event)continue;
   card.hidden=reviewOpen.has(event.id)?false:!matchesReview(event);if(!card.hidden)shown++;
   const selection=card.querySelector('.portal-release-selection');if(selection){selection.hidden=!selectingEvents||!canRelease(event);const check=selection.querySelector('input');check.checked=reviewSelection.has(event.id);check.disabled=busy||reviewEdited.size>0;}
   reviewEditors.get(event.id)?.expire();
  }
  $('review-filter-count').textContent=shown+' Termin'+(shown===1?'':'e')+' angezeigt';
  $('review-empty').hidden=shown>0||reviewLoading;$('review-empty').textContent=all.length?'Keine Termine für diese Auswahl.':'Keine kommenden Termine.';
 }
 function scheduleExpiry(){
  if(expiryTimer&&typeof clearTimeout==='function')clearTimeout(expiryTimer);expiryTimer=null;
  const ends=(reviewSnapshot?.events||[]).filter(currentEvent).map(e=>e.end);
  if(ends.length&&typeof setTimeout==='function')expiryTimer=setTimeout(()=>{expiryTimer=null;reviewControls();scheduleExpiry();},Math.min(2147483647,Math.max(1,Math.min(...ends)-Date.now()+1)));
 }
 async function acceptAutomatic(){
  const candidates=automaticCandidates();if(!candidates.length||reviewSnapshot?.stale||reviewEdited.size)return;
  if(!confirm('Diese '+candidates.length+' Termine für Anmeldung und Erinnerungen freigeben?\n\n'+candidates.map(e=>date(e)+' · '+e.title).join('\n')+'\n\nDie angezeigte Personenauswahl bleibt erhalten.'))return;
  return run(async()=>{
   const version=calendarGeneration,snapshot=reviewSnapshot;let expectedVersion=snapshot.rulesVersion,count=0,error='';
   try{for(const e of candidates){if(version!==calendarGeneration)throw Error('Ansicht wurde geändert. Bitte neu laden.');admin();if(!canRelease(e)||!matchesReview(e))throw Error('Die Auswahl ist nicht mehr aktuell. Bitte Termine erneut prüfen.');$('review-status').textContent=count+' / '+candidates.length+' Freigaben gespeichert …';const result=await request('classify',{eventId:e.id,kind:'probe',approved:true,sessionType:e.sessionType||'Sonderprobe',recipientMode:e.recipientMode,expectedGroupsVersion:snapshot.groupsVersion,expectedVersion});expectedVersion=result.version;count++;reviewSelection.delete(e.id);}}
   catch(e){error=e.message;}
   if(version!==calendarGeneration)return;lastLoad=0;await reviewCalendar();$('review-status').textContent=count+' Freigaben bestätigt.'+(error?' Weitere Freigaben nicht bestätigt: '+error:'');
  });
 }
 async function reviewCalendar({automatic=false,snapshot=null}={}){
  reviewControls();if(g.CalendarDisplayAdmin?.dirty())return;
  if(automatic&&(groupsDirty||reviewEdited.size||reviewOpen.size||groupEditing||busy||reviewLoading||Date.now()-reviewLastLoad<60000))return;
  const version=++calendarGeneration;reviewLoading=true;$('review-load').hidden=true;try{admin();if(!automatic)$('review-status').textContent='Kalendereinträge werden geladen …';const cal=snapshot||await request('list');if(g.CalendarDisplayAdmin?.dirty()||version!==calendarGeneration||automatic&&(reviewEdited.size||reviewOpen.size||groupsDirty||groupEditing))return;admin();if(!groupsDirty&&cal.groupsVersion!==undefined&&(groupSnapshot?.version!==cal.groupsVersion||groupSnapshot?.rosterUpdatedAt!==cal.rosterUpdatedAt))await loadGroups();if(g.CalendarDisplayAdmin?.dirty()||version!==calendarGeneration||automatic&&(reviewEdited.size||reviewOpen.size||groupsDirty||groupEditing))return;reviewLastLoad=Date.now();$('review-load').hidden=!cal.stale;
   const upcoming=cal.events.filter(e=>currentEvent(e)&&e.kind!=='birthday');
   const previous=reviewSnapshot;
   // Sort chronologically so a just-saved card does not jump to the bottom.
   upcoming.sort((a,b)=>a.start-b.start);
   if(automatic&&previous&&previous.rulesVersion===cal.rulesVersion&&previous.groupsVersion===cal.groupsVersion&&previous.rosterUpdatedAt===cal.rosterUpdatedAt&&previous.stale===cal.stale&&JSON.stringify(previous.events.map(e=>[e.id,e.title,e.kind,e.sessionType,e.approved,e.memberId,e.recipientIds,e.attendanceType,e.location,e.clothing,e.start,e.end,e.automatic,e.recipientMode,e.groupIds,e.googleIssues,e.note]))===JSON.stringify(upcoming.map(e=>[e.id,e.title,e.kind,e.sessionType,e.approved,e.memberId,e.recipientIds,e.attendanceType,e.location,e.clothing,e.start,e.end,e.automatic,e.recipientMode,e.groupIds,e.googleIssues,e.note]))){
    reviewSnapshot={...cal,overviewSource:g.DrinksStore.sourceKey(),events:previous.events};reviewControls();scheduleExpiry();return;
   }
   // Finished events no longer belong to the active H₂O calendar management.
   // The underlying Google calendar and the separately archived attendance
   // protocol are never changed here. Birthday series associations survive.
   reviewSnapshot={...cal,overviewSource:g.DrinksStore.sourceKey(),events:upcoming};
   reviewEdited.clear();reviewEditors.clear();$('review-events').replaceChildren();
   for(const e of reviewSnapshot.events){
    const card=node('article');card.className='portal-event';card.dataset.category=calendarCategory(e);card.dataset.eventId=e.id;card.dataset.saved=String(e.automatic===false);card.dataset.state=needsReview(e)?'unresolved':'saved';
    const badge=node('p',e.kind==='probe'?(e.approved?'Anmeldung freigegeben':'Anmeldung noch nicht freigegeben'):e.kind==='birthday'?(e.memberId?'Geburtstag zugeordnet':'Person zuordnen'):e.automatic!==false?'Einordnung prüfen':'Sonstiger Eintrag');badge.className='portal-review-badge';
    const h=node('h4',e.title),when=node('p',date(e)+(e.allDay?' · ganztägig':'')+(e.start<=Date.now()?' · Läuft gerade':''));when.className='portal-review-date';
    const meta=node('p',[e.attendanceType||e.sessionType||(e.kind==='birthday'?'Geburtstag':'Sonstiger Termin'),e.location||'GH Wasser',e.clothing==='Einsatz'?'Einsatzkleidung':e.clothing].filter(Boolean).join(' · '));meta.className='portal-review-meta';
    const roster=groupSnapshot?.members||[...$('member').options].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent}));
    const googleSource=node('p',e.googleManaged===true?'Angaben aus Google Kalender':e.googleManaged===false?'Eigene Webseiten-Einstellungen haben Vorrang':''),googleIssues=node('ul'),googleRestore=node('button','Google-Angaben übernehmen');googleSource.className='portal-google-source';googleSource.hidden=e.googleManaged===undefined;googleIssues.className='portal-google-issues';googleIssues.hidden=!e.googleIssues?.length;for(const issue of e.googleIssues||[])googleIssues.append(node('li',issue));googleRestore.type='button';googleRestore.className='outline-button portal-google-restore';googleRestore.hidden=e.googleManaged!==false||e.kind==='birthday';googleRestore.onclick=()=>{if(!cancelChanges())return;return run(async()=>{if(cal.googleInstructionVersion!==1)throw Error('Kalenderdienst bitte aktualisieren.');const result=await request('classify',{eventId:e.id,kind:e.kind,approved:e.approved===true,followGoogle:true,expectedVersion:cal.rulesVersion,expectedGroupsVersion:cal.groupsVersion});if(result.googleManaged!==true)throw Error('Google-Übernahme wurde nicht bestätigt.');const confirmed=await request('list');if(!confirmed.events.find(item=>item.id===e.id)?.googleManaged)throw Error('Google-Übernahme bitte erneut prüfen.');reviewOpen.delete(e.id);reviewEdited.delete(e.id);await reviewCalendar({snapshot:confirmed});},googleSource);};
    if(e.kind==='info'){card.dataset.state='saved';card.append(googleSource,googleIssues);card.append(node('p','Kalenderinformation'),h,when,node('p',e.note||''),g.CalendarDisplayAdmin.editor(e,roster,request,()=>reviewCalendar()));$('review-events').append(card);continue;}
    const matched=(groupSnapshot?.groups||[]).filter(g=>(e.groupIds||[]).includes(g.id));
    const origin=e.recipientMode==='automatic'?'Automatisch · '+(Array.isArray(e.recipientIds)&&!e.recipientIds.length?'keine Personen zugeordnet':matched.map(g=>g.name).join(', ')||'alle aktiven Mitglieder'):e.recipientMode==='manual'?'Manuell angepasst':'Bisherige Auswahl · geschützt';
    const audienceSummary=node('p',origin);audienceSummary.className='portal-review-audience';audienceSummary.hidden=e.kind!=='probe';
    const audienceDetails=node('details'),audienceTitle=node('summary','Eingeladene Personen ('+(Array.isArray(e.recipientIds)?e.recipientIds.length:roster.length)+')');audienceDetails.className='portal-event-people';audienceDetails.hidden=e.kind!=='probe';audienceDetails.append(audienceTitle,nameList(Array.isArray(e.recipientIds)?e.recipientIds:null,roster),node('small','Eingeladen bedeutet: darf den Termin sehen und antworten. Es ist keine Zusage oder Anwesenheit.'));
    if(Array.isArray(e.recipientIds)&&!e.recipientIds.length)audienceDetails.append(node('p','Keine Personen zugeordnet. Bitte die Gruppe prüfen.'));
    const selection=node('label'),selected=node('input');selection.className='portal-release-selection';selected.type='checkbox';selected.checked=reviewSelection.has(e.id);selection.append(selected,node('span','Für gemeinsame Freigabe auswählen'));selected.onchange=()=>{if(selected.checked)reviewSelection.add(e.id);else reviewSelection.delete(e.id);reviewControls();};
    let recipientMode=e.recipientMode||'legacy',editing=reviewOpen.has(e.id);
    const editButton=node('button','Bearbeiten');editButton.type='button';editButton.className='portal-review-edit-toggle';
    const setEdit=on=>{if(on){if(busy)return;if([...reviewOpen].some(id=>id!==e.id)&&!cancelChanges())return;editing=true;reviewOpen.add(e.id);}else{if(reviewEdited.has(e.id)&&!confirm('Änderungen an diesem Termin verwerfen?'))return;resetEditor();}update();reviewControls();};
    editButton.onclick=()=>setEdit(true);
    const kind=node('select'),kindCaption=node('label','Kalendereintrag');kind.className='text-input';kind.id='portal-calendar-kind-'+reviewEditors.size;kindCaption.htmlFor=kind.id;kind.setAttribute('aria-label','Eintrag behandeln als');
    for(const [value,label] of [['other','Sonstiger Kalendereintrag'],['probe','Normale Probe'],['special','Sonderprobe'],['birthday','Geburtstag']]){const o=node('option',label);o.value=value;kind.append(o);}kind.value=e.kind==='probe'&&e.sessionType==='Sonderprobe'?'special':e.kind;
    const attendanceTypeLabel=node('label','Terminart für die Anwesenheit'),attendanceType=node('select');
    attendanceType.className='text-input';attendanceType.setAttribute('aria-label','iPad-Terminart bei diesem Kalendertermin');
    for(const [value,label] of [['Allgemeine Probe','Allgemeine Probe'],['Sonderprobe','Sonderprobe'],['Unterricht','Unterricht'],['Ausschuss Sitzung','Ausschusssitzung']]){const o=node('option',label);o.value=value;attendanceType.append(o);}
    attendanceType.value=['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung'].includes(e.attendanceType)?e.attendanceType:(kind.value==='probe'?'Allgemeine Probe':'Sonderprobe');
    attendanceTypeLabel.append(attendanceType,node('small','Wird beim Start der Erfassung übernommen.'));
    const locationLabel=node('label','Ort'),locationChoice=node('select'),locationText=node('input');
    locationChoice.className=locationText.className='text-input';locationChoice.setAttribute('aria-label','Ort für diesen Termin');locationText.setAttribute('aria-label','Ort als Freitext');locationText.maxLength=300;locationText.placeholder='Individuellen Treffpunkt eingeben';
    for(const [value,label] of [['GH Wasser','GH Wasser'],['custom','Freitext']]){const o=node('option',label);o.value=value;locationChoice.append(o);}
    const initialLocation=e.location||'GH Wasser';locationChoice.value=initialLocation==='GH Wasser'?'GH Wasser':'custom';locationText.value=locationChoice.value==='custom'?initialLocation:'';locationLabel.append(locationChoice,locationText);
    const clothingLabel=node('label','Kleidung'),clothing=node('select'),clothingText=node('input');
    clothing.className=clothingText.className='text-input';clothing.setAttribute('aria-label','Kleidung für diesen Termin');clothingText.setAttribute('aria-label','Kleidung als Freitext');clothingText.maxLength=120;clothingText.placeholder='Eigene Kleidungsangabe';
    const outfits=['Einsatzkleidung','Tagesdienst','Uniform','T-Shirt/ Fest','Zivil'];
    for(const [value,label] of [['','Keine Angabe'],...outfits.map(v=>[v,v]),['custom','Freitext']]){const o=node('option',label);o.value=value;clothing.append(o);}
    const savedClothing=e.clothing??(kind.value==='probe'?'Einsatzkleidung':kind.value==='special'?'Tagesdienst':'');const initialClothing=savedClothing==='Tagdienst'?'Tagesdienst':savedClothing==='Einsatz'?'Einsatzkleidung':savedClothing;
    clothing.value=outfits.includes(initialClothing)?initialClothing:initialClothing?'custom':'';clothingText.value=clothing.value==='custom'?initialClothing:'';
    let clothingEdited=false;clothingLabel.append(clothing,clothingText);
    const approvalLabel=node('label'),approval=node('input');approval.type='checkbox';approval.checked=e.approved;approvalLabel.append(approval,node('span',' Für Anmeldung und Erinnerungen freigeben'));
    const personLabel=node('label','Geburtstagskind (gilt für diese Geburtstagsserie)'),person=node('select');person.className='text-input';person.setAttribute('aria-label','Geburtstag zuordnen');const empty=node('option','Noch nicht zugeordnet – kein Bonus');empty.value='';person.append(empty);for(const option of $('member').options){if(!option.value)continue;const o=node('option',option.textContent);o.value=option.value;person.append(o);}person.value=e.memberId||'';personLabel.append(person);
    const recipientsLabel=node('div',''),recipients=node('div');recipientsLabel.className='portal-recipient-heading';
    recipientsLabel.append(node('strong','Eingeladene Personen'),node('small','Nur ausgewählte Mitglieder können den Termin sehen und erhalten Erinnerungen.'));
    recipients.className='portal-recipient-choices';
    const audienceMode=node('select');audienceMode.className='text-input portal-audience-mode';audienceMode.setAttribute('aria-label','Betroffene Mitglieder auswählen');
    for(const [value,label] of [['all','Alle Mitglieder'],['selected','Nur ausgewählte Mitglieder']]){const option=node('option',label);option.value=value;audienceMode.append(option);}
    audienceMode.value=Array.isArray(e.recipientIds)?'selected':'all';
    const selectedCount=node('p');selectedCount.className='portal-recipient-count';selectedCount.setAttribute('role','status');
    const recipientSearch=node('input');recipientSearch.type='search';recipientSearch.className='text-input portal-recipient-search';recipientSearch.placeholder='Namen suchen …';recipientSearch.setAttribute('aria-label','Betroffene Mitglieder suchen');
    const peopleBox=node('div');peopleBox.className='portal-recipient-list';const people=[],peopleLabels=[];
    for(const option of $('member').options){
      if(!option.value)continue;
      const choice=node('label'),check=node('input');check.type='checkbox';check.value=option.value;check.checked=Array.isArray(e.recipientIds)?e.recipientIds.includes(option.value):false;
      choice.append(check,node('span',option.textContent));peopleBox.append(choice);people.push(check);
      peopleLabels.push({choice,name:String(option.textContent||'').toLocaleLowerCase('de')});
    }
    const automaticSelection=node('button','Automatische Gruppenauswahl erneut übernehmen');automaticSelection.type='button';automaticSelection.className='outline-button';
    const audienceOrigin=node('p',recipientMode==='automatic'?'Auswahl: automatisch anhand der Schlagwörter':recipientMode==='manual'?'Auswahl: manuell festgelegt':'Auswahl: bisherige Empfängerliste (geschützt)');
    const recipientActions=node('div');recipientActions.className='portal-recipient-actions';
    const chooseVisible=node('button','Sichtbare auswählen'),clearVisible=node('button','Sichtbare abwählen');
    for(const btn of [chooseVisible,clearVisible]){btn.type='button';btn.className='outline-button';recipientActions.append(btn);}
    const missingMembers=node('p');missingMembers.className='portal-recipient-missing';
    const updateRecipients=()=>{
      const restricted=audienceMode.value==='selected',checked=people.filter(c=>c.checked).length;
      recipientSearch.hidden=peopleBox.hidden=recipientActions.hidden=!restricted;
      selectedCount.textContent=restricted?checked+' von '+people.length+' Mitgliedern ausgewählt':'Alle Mitglieder ('+people.length+')';
      selectedCount.dataset.empty=String(restricted&&!checked);
      missingMembers.hidden=people.length>0||!restricted;
      missingMembers.textContent='Mitgliederliste noch nicht verfügbar. Bitte zuerst OneDrive synchronisieren und die Kalenderverwaltung neu öffnen.';
      for(const c of people)c.disabled=!restricted;

    };
    const filterRecipients=()=>{
      const query=recipientSearch.value.trim().toLocaleLowerCase('de');
      for(const r of peopleLabels)r.choice.hidden=!r.name.includes(query);
    };
    recipientSearch.oninput=filterRecipients;
    recipients.append(audienceMode,selectedCount,recipientSearch,recipientActions,missingMembers,peopleBox,audienceOrigin,automaticSelection);
    updateRecipients();
    const note=node('p'),save=node('button','Speichern'),cancel=node('button','Abbrechen'),feedback=node('p');save.type=cancel.type='button';save.className='primary-button';cancel.className='outline-button';feedback.className='portal-event-feedback';feedback.setAttribute('role','status');
    const update=()=>{
     const ended=!currentEvent(e),probe=['probe','special'].includes(kind.value);kind.hidden=kindCaption.hidden=!editing;editButton.hidden=editing;editButton.disabled=ended;editButton.setAttribute('aria-expanded',String(editing));
     locationLabel.hidden=!editing||kind.value==='birthday';locationText.hidden=!editing||locationChoice.value!=='custom';clothingLabel.hidden=!editing||kind.value==='birthday';clothingText.hidden=!editing||clothing.value!=='custom';approvalLabel.hidden=!editing||!probe;personLabel.hidden=!editing||kind.value!=='birthday';attendanceTypeLabel.hidden=!editing||!probe;recipientsLabel.hidden=recipients.hidden=!editing||!probe;
     save.hidden=cancel.hidden=!editing;save.disabled=reviewSnapshot?.stale===true||cal.stale||ended;note.hidden=!editing||probe;note.textContent=kind.value==='birthday'?'Die Zuordnung gilt für diese Geburtstagsserie. Keine Anmeldung; Geburtstagsbonus nach der bestehenden Einstellung.':'Keine Anmeldung und keine Termin-Erinnerung.';
     if(ended){badge.textContent='Termin beendet';if(editing)feedback.textContent='Dieser Termin ist beendet. Die Eingaben bleiben bis zum Abbrechen sichtbar; Speichern ist nicht mehr möglich.';}
    };
    const changed=()=>{reviewEdited.add(e.id);card.dataset.saved='false';card.dataset.state='edited';feedback.textContent='Änderungen noch nicht gespeichert.';update();reviewControls();};
    const controls=[kind,attendanceType,locationChoice,locationText,clothing,clothingText,approval,person,audienceMode,...people],initial=controls.map(c=>[c,c.value,c.checked]);
    const resetEditor=()=>{for(const [control,value,checked] of initial){control.value=value;control.checked=checked;}recipientMode=e.recipientMode||'legacy';clothingEdited=false;kind.dataset.previousKind='';editing=false;reviewEdited.delete(e.id);reviewOpen.delete(e.id);card.dataset.saved=String(e.automatic===false);card.dataset.state=needsReview(e)?'unresolved':'saved';feedback.textContent='';audienceOrigin.textContent=origin;updateRecipients();update();};
    reviewEditors.set(e.id,{close:resetEditor,expire:update});cancel.onclick=()=>setEdit(false);
    kind.onchange=()=>{const prior=kind.dataset.previousKind||(e.kind==='probe'&&e.sessionType==='Sonderprobe'?'special':e.kind),oldDefault=prior==='probe'?'Allgemeine Probe':prior==='special'?'Sonderprobe':null,nextDefault=kind.value==='probe'?'Allgemeine Probe':kind.value==='special'?'Sonderprobe':null;if(oldDefault&&nextDefault&&attendanceType.value===oldDefault)attendanceType.value=nextDefault;if(!clothingEdited&&clothing.value===(prior==='probe'?'Einsatzkleidung':prior==='special'?'Tagesdienst':''))clothing.value=kind.value==='probe'?'Einsatzkleidung':kind.value==='special'?'Tagesdienst':'';kind.dataset.previousKind=kind.value;changed();};
    locationChoice.onchange=changed;locationText.oninput=changed;clothing.onchange=()=>{clothingEdited=true;changed();};clothingText.oninput=()=>{clothingEdited=true;changed();};attendanceType.onchange=changed;approval.onchange=changed;person.onchange=changed;
    const manualAudience=()=>{recipientMode='manual';audienceOrigin.textContent='Auswahl: manuell festgelegt';updateRecipients();changed();};
    automaticSelection.onclick=()=>{if(!Array.isArray(e.automaticRecipientIds))return;recipientMode='automatic';audienceMode.value='selected';for(const check of people)check.checked=e.automaticRecipientIds.includes(check.value);audienceOrigin.textContent='Auswahl: automatisch anhand der Schlagwörter';updateRecipients();changed();};
    audienceMode.onchange=manualAudience;for(const check of people)check.onchange=manualAudience;for(const [btn,on] of [[chooseVisible,true],[clearVisible,false]])btn.onclick=()=>{for(const row of peopleLabels)if(!row.choice.hidden)row.choice.children[0].checked=on;manualAudience();};update();
    save.onclick=()=>run(async()=>{
      const access=generation;if(reviewSnapshot?.stale||cal.stale)throw Error('Kalenderstand nicht aktuell. Bitte vor dem Speichern erneut laden.');if(!currentEvent(e))throw Error('Der Termin ist beendet. Es wurde nichts gespeichert.');
      if(kind.value!=='birthday'&&cal.locationVersion!==1)throw Error('Für die Ortsauswahl bitte die aktuelle Veröffentlichung des Kalenderdienstes abwarten und den Kalender neu laden.');
      if(kind.value!=='birthday'&&locationChoice.value==='custom'&&!locationText.value.trim())throw Error('Bitte einen Treffpunkt im Freitext eingeben.');
      if(kind.value!=='birthday'&&cal.clothingVersion!==1)throw Error('Für die Kleidung bitte zuerst die aktuelle Veröffentlichung des Cloudflare-Workers abwarten und den Kalender neu laden. Es wurde nichts gespeichert.');
      if(kind.value!=='birthday'&&clothing.value==='custom'&&!clothingText.value.trim())throw Error('Bitte eine Kleidung im Freitext eingeben.');
      const isProbe=['probe','special'].includes(kind.value),restricted=isProbe&&audienceMode.value==='selected';
      const ids=restricted?people.filter(check=>check.checked).map(check=>check.value):null;
      if(restricted&&!people.length)throw Error('Keine Mitglieder geladen. Bitte OneDrive synchronisieren und die Kalenderverwaltung erneut öffnen.');
      if(restricted&&!ids.length&&recipientMode!=='automatic')throw Error('Bitte mindestens ein Mitglied für diesen Termin auswählen.');
      if(restricted&&Array.isArray(e.recipientIds)&&e.recipientIds.some(id=>!people.some(check=>check.value===id)))throw Error('Bisherige Empfänger sind nicht vollständig in der Mitgliederliste vorhanden. Bitte Mitgliederabgleich prüfen, bevor du die Auswahl änderst.');
      // Read the live rule version before editing any targeted member audience.
      const latest=restricted?await request('list'):null;
      if(restricted&&(latest?.recipientFeatureVersion!==2&&!(kind.value==='special'&&latest?.recipientFeatureVersion===1))){
        const active=(await connection()).origin;
        throw Error('Die derzeit verbundene Cloudflare-Adresse ('+active+') unterstützt diese Mitglieder-Auswahl noch nicht. Bitte den neuen worker.bundle.js veröffentlichen, bevor der Termin geändert wird.');
      }
      if(restricted&&latest.rulesVersion!==cal.rulesVersion)throw Error('Der Termin wurde inzwischen bearbeitet. Bitte neu laden.');
      if(restricted&&!latest.events.some(item=>item.id===e.id))throw Error('Der Termin wurde inzwischen geändert. Bitte Kalender neu laden.');
      if(isProbe&&cal.attendanceTypeVersion!==1){const active=(await connection()).origin;throw Error('Für die iPad-Terminart muss der Cloudflare-Worker aktualisiert werden ('+active+'). Bitte den aktuellen Worker-Code veröffentlichen. Es wurde nichts gespeichert.');}
      if(isProbe&&recipientMode==='automatic'&&cal.groupsVersion===undefined)throw Error('Bitte zuerst den Kalenderdienst aktualisieren.');
      const data={eventId:e.id,...(kind.value!=='birthday'?{location:locationChoice.value==='custom'?locationText.value.trim():'GH Wasser'}:{}),clothing:kind.value==='birthday'?'':clothing.value==='custom'?clothingText.value.trim():clothing.value,kind:kind.value==='special'?'probe':kind.value,...(isProbe?{sessionType:kind.value==='special'?'Sonderprobe':'Probe'}:{}),approved:isProbe&&approval.checked,memberId:kind.value==='birthday'?person.value:null,...(isProbe?{attendanceType:attendanceType.value,recipientIds:ids,recipientMode,expectedGroupsVersion:cal.groupsVersion}:{}),expectedVersion:restricted?latest.rulesVersion:cal.rulesVersion};
      const matches=entry=>restricted?Array.isArray(entry?.recipientIds)&&entry.recipientIds.length===ids.length&&ids.every(id=>entry.recipientIds.includes(id)):!Array.isArray(entry?.recipientIds);
      // Current Workers validate recipients and approval together, in one D1
      // rules update. Never temporarily turn off approval: a timeout between
      // two requests otherwise leaves already approved events disabled.
      admin();if(access!==generation||!currentEvent(e))throw Error('Der Termin oder Zugang hat sich geändert. Bitte neu laden.');
      const saved=await request('classify',data);if(access!==generation)return;
      if(isProbe&&(![1,2].includes(saved.recipientFeatureVersion)||kind.value==='probe'&&restricted&&saved.recipientFeatureVersion!==2||!matches(saved)))throw Error('Der Cloudflare-Worker hat die Empfängerliste nicht bestätigt. Bitte Worker aktualisieren und Einordnung prüfen.');
      if(kind.value!=='birthday'&&saved.clothingVersion!==1)throw Error('Die Kleidung wurde vom Dienst nicht bestätigt. Bitte Kalender neu laden.');
      admin();const confirmed=await request('list');if(access!==generation)return;admin();const stored=confirmed.events.find(item=>item.id===e.id);
      if(isProbe&&!matches(stored))throw Error('Die Empfängerauswahl konnte nach dem Speichern nicht bestätigt werden. Bitte Kalender neu laden und Empfänger prüfen.');
      if(stored?.approved!==data.approved)throw Error('Die Freigabe für Anmeldung und Erinnerungen wurde nicht wie gewünscht übernommen. Bitte den Termin prüfen.');
      if(['probe','special'].includes(kind.value)&&stored?.attendanceType!==data.attendanceType)throw Error('Die iPad-Terminart wurde nicht wie gewünscht gespeichert. Bitte Kalender neu laden und prüfen.');
      if(kind.value!=='birthday'&&stored?.clothing!==data.clothing)throw Error('Die Kleidung wurde nicht wie gewünscht gespeichert. Bitte Kalender neu laden und prüfen.');
      if(kind.value!=='birthday'&&stored?.location!==data.location)throw Error('Der Ort wurde nicht wie gewünscht gespeichert. Bitte Kalender neu laden und prüfen.');
      reviewPinned.add(e.id);reviewEdited.delete(e.id);reviewOpen.delete(e.id);lastLoad=0;await reviewCalendar({snapshot:confirmed});
      const savedCard=[...$('review-events').children].find(c=>c.dataset.eventId===e.id),savedFeedback=savedCard?.querySelector('.portal-event-feedback');
      if(savedFeedback)savedFeedback.textContent='Änderungen gespeichert.';$('status').textContent=savedCard?'':'Änderungen gespeichert.';
     },feedback);card.append(selection,badge,h,when,meta,googleSource,googleIssues,googleRestore,audienceSummary,audienceDetails,editButton,kindCaption,kind,attendanceTypeLabel,locationLabel,clothingLabel,approvalLabel,personLabel,recipientsLabel,recipients,note,save,cancel,feedback);if(g.CalendarDisplayAdmin)card.append(g.CalendarDisplayAdmin.editor(e,roster,request,()=>reviewCalendar()));$('review-events').append(card);
   }reviewControls();scheduleExpiry();$('review-status').textContent=cal.stale?'Kalenderstand nicht aktuell bestätigt. Änderungen sind bis zum erfolgreichen Laden gesperrt.':cal.recipientFeatureVersion!==2?'Der Kalenderdienst muss für die Mitglieder-Auswahl aktualisiert werden.':'';
   if(cal.googleColorStatus==='fallback')$('review-status').textContent+=' Google-Farben derzeit nicht erreichbar; App-Farben werden verwendet.';
   const connectionStatus=document.getElementById('portal-calendar-connection-status');if(connectionStatus)connectionStatus.textContent=cal.stale?'Kalender derzeit nicht erreichbar. Letzter bestätigter Stand bleibt sichtbar.':cal.configured?'Kalender verbunden'+(cal.fetchedAt?' · Aktualisiert am '+new Date(cal.fetchedAt).toLocaleString('de-DE'):''):'Kalender noch nicht verbunden.';

  }catch(e){if(version===calendarGeneration){if(reviewSnapshot)reviewSnapshot.stale=true;$('review-status').textContent=e.message;$('review-auto').disabled=true;$('review-load').hidden=false;}}finally{if(version===calendarGeneration){reviewLoading=false;reviewControls();}}
 }
 async function identityTicket(reset=false){return run(async()=>{
  admin();const id=$('member').value,version=generation;
  if(!id)throw Error('Bitte zuerst ein Mitglied auswählen.');
  const name=$('member').selectedOptions[0].textContent;
  if(!confirm((reset?'Alle Passkeys und Sitzungen von '+name+' jetzt sperren und Zugang neu freigeben?':'Passkey-Einrichtung für '+name+' freigeben?')+' Nur fortfahren, wenn du die Identität persönlich geprüft hast.'))return;
  clearQR();
  await syncRoster();admin();if(version!==generation)return;
  await g.DrinksMobile.adminLink(id);admin();
  const store=g.DrinksStore,saved=await store.readMobileFile(await store.mobileFileName(id));
  if(!saved||saved.data.memberId!==id)throw Error('Persönlicher Zugang nicht bestätigt.');
  if(version!==generation)return;admin();
  const result=await request('identity-ticket',{alias:saved.data.alias,revision:saved.data.revision,reset});
  if(version!==generation)return;admin();
  $('identity-code').value=result.code;$('identity-result').hidden=false;
  const url=new URL('deckel.html',location.href);url.search='';url.hash='setup='+result.code;const code=qrcode(0,'M');code.addData(url.href);code.make();const canvas=$('qr'),count=code.getModuleCount(),unit=6,quiet=4;canvas.width=canvas.height=(count+quiet*2)*unit;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(code.isDark(r,c))ctx.fillRect((c+quiet)*unit,(r+quiet)*unit,unit,unit);canvas.hidden=false;$('link').href=url.href;$('link').hidden=false;
  $('identity-status').textContent='Nur '+name+' zeigen. In H₂O unter Konto → Sicherheit eingeben. '+(reset?'Bisherige Passkeys und Sitzungen sind gesperrt.':'Der persönliche Zugang benötigt die zentrale Passkey-Anmeldung.');
  setTimeout(()=>{if($('identity-code').value===result.code){clearQR();}},Math.max(0,result.expiresAt-Date.now()));
 });}
 function qrLoading(active){const button=$('show-qr');button.disabled=active||busy;button.classList.toggle('is-loading',active);button.setAttribute('aria-busy',String(active));button.textContent=active?'Portal-Code wird vorbereitet …':'Passkey-Einrichtung freigeben';}
 function clearQR(){if($('identity-code')){$('identity-code').value='';$('identity-result').hidden=true;$('identity-status').textContent='';}qrLoading(false);$('qr-status').textContent='';$('install-guide').hidden=true;const canvas=$('qr');canvas.hidden=true;canvas.width=canvas.height=0;$('link').hidden=true;$('link').removeAttribute('href');}
 async function load(){return run(async()=>{const version=generation;clearQR();const state=await g.oneDriveReadState();if(version!==generation)return;admin();$('member').replaceChildren(node('option','Bitte Mitglied auswählen'));$('member').firstChild.value='';for(const member of state.members){const opt=node('option',[member.lastName,member.firstName].filter(Boolean).join(' '));opt.value=String(member.id);$('member').append(opt);}$('status').textContent='Mitglied auswählen und Passkey-Einrichtung freigeben.';});}
 async function loadCalendar(){if(reviewEdited.size||groupsDirty||connectionDirty||g.CalendarDisplayAdmin?.dirty())return;return run(async()=>{const version=generation;document.getElementById('portal-calendar-administration').hidden=false;document.getElementById('portal-calendar-admin-open').hidden=true;await syncRoster();const state=await g.oneDriveReadState();if(version!==generation)return;admin();const savedMember=$('member').value;$('member').replaceChildren();const placeholder=node('option','Bitte Mitglied auswählen');placeholder.value='';$('member').append(placeholder);for(const member of state.members||[]){const opt=node('option',[member.lastName,member.firstName].filter(Boolean).join(' '));opt.value=String(member.id);$('member').append(opt);}if([...$('member').children].some(opt=>opt.value===savedMember))$('member').value=savedMember;const result=await request('config');if(version!==generation)return;admin();$('calendar').value=result.config?.calendarUrl||'';$('hours').value=String(result.config?.leadHours||24);connectionSaved={url:$('calendar').value,hours:$('hours').value};connectionDirty=false;showCalendarSection(result.configured?'events':'connection',true);await reviewCalendar();await g.CalendarDisplayAdmin?.colors(request);if(reviewSnapshot?.googleInstructionVersion===1)await g.CalendarDisplayAdmin?.googleColors(request);if(version!==generation)return;$('status').textContent=result.configured?'':'Bitte im Bereich Verbindung die Google-iCal-Adresse eintragen und speichern.';});}
 function qr(){return identityTicket(false);}
 function lock(){g.CalendarDisplayAdmin?.clear();if(expiryTimer&&typeof clearTimeout==='function')clearTimeout(expiryTimer);expiryTimer=null;expandedGroups.clear();reviewEditors.clear();reviewSelection.clear();selectingEvents=false;groupEditing=null;connectionDirty=false;connectionSaved={url:'',hours:'24'};groupSnapshot=null;groupDraft=null;groupsDirty=false;document.getElementById('calendar-help-groups')?.replaceChildren();document.getElementById('portal-keyword-groups')?.replaceChildren();g.H2OReminders?.close();reminderPanel=null;reminderEvent=null;g.PortalEvidenceAdmin?.clear();document.getElementById('portal-calendar-administration').hidden=true;document.getElementById('portal-calendar-admin-open').hidden=false;const setup=document.getElementById('portal-calendar-public-setup');if(setup)setup.hidden=false;document.getElementById('portal-calendar-admin-status').textContent='';const connectionStatus=document.getElementById('portal-calendar-connection-status');if(connectionStatus)connectionStatus.textContent='';generation++;calendarGeneration++;reviewLoading=false;reviewLastLoad=0;reviewSnapshot=null;$('review-load').hidden=true;reviewEdited.clear();reviewOpen.clear();reviewPinned.clear();reviewQuery='';reviewFilter='all';reviewShowSaved=true;if($('review-search'))$('review-search').value='';$('review-auto').disabled=true;$('calendar-status').textContent='';$('review-events').replaceChildren();$('review-status').textContent='';clearQR();$('calendar').value='';$('member').replaceChildren();document.getElementById('portal-admin-status').textContent='';}
 function chosen(){const linked=safeStorage.getItem('h2o_calendar_session');if(linked)try{const v=JSON.parse(linked);if(v.session===currentSessionId&&v.session)return v.event;}catch{}return selected;}
 async function replies(){const id=chosen();if(!id){replyData=null;paintReplies();return;}replyData=null;paintReplies();const result=await request('replies',{eventId:id});if(chosen()!==id)return;replyData=result;autoStageCalendarReplies();paintReplies();}
 let autoStagedSession="";
 function autoStageCalendarReplies(){
  if(typeof homeFlowStage==='undefined'||homeFlowStage!==2||!currentSessionId||currentOperationId||!replyData||replyData.stale||chosen()!==replyData.event.id||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed)return false;
  const key=currentSessionId+"|"+replyData.event.id;
  if(autoStagedSession===key)return false;
  autoStagedSession=key;
  return stageCalendarReplies(true);
 }
 function replyCandidates(){
  if(!replyData||currentOperationId||currentSessionId&&sessionType==='Einsatz')return [];
  const answers=new Map(replyData.replies.map(r=>[String(r.memberId),r.status]));
  const known=new Set(todayEntries().flatMap(e=>[e.storedName,e.displayName]).filter(Boolean));
  const type=currentSessionId?sessionType:replyData.event.attendanceType||replyData.event.sessionType;if(type==='Einsatz')return [];
  return members.filter(m=>(type!=='Ausschuss Sitzung'||m.committeeMember)&&(!Array.isArray(replyData.event.recipientIds)||replyData.event.recipientIds.includes(String(m.id)))&&['yes','excused'].includes(answers.get(String(m.id)))&&!known.has(nameForStorage(m))&&!known.has(nameForTile(m))&&!pendingMemberStatuses.has(m.id)).map(member=>({member,status:answers.get(String(member.id))==='yes'?'Anwesend':'Entschuldigt'}));
 }
 function stageCalendarReplies(automatic=false){
  if(!replyData||replyData.stale||chosen()!==replyData.event.id||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed)return false;
  if(!replyCandidates().length)return false;
  const eventId=replyData.event.id;
  if(!currentSessionId&&!currentOperationId){if(typeof beginAttendanceFromContext!=='function')return false;beginAttendanceFromContext();}
  if(!currentSessionId||currentOperationId||sessionType==='Einsatz'||chosen()!==eventId)return false;
  const plan=replyCandidates();if(!plan.length){paintReplies();return false;}
  g.WorkflowUX?.beforeSelection();
  for(const {member,status} of plan)pendingMemberStatuses.set(member.id,status);
  chosenMemberIds=new Set(pendingMemberStatuses.keys());
  if(!automatic&&typeof setHomeFlowStage==='function')setHomeFlowStage(2);
  renderMembers();updateSelection();paintReplies();
  const yes=plan.filter(p=>p.status==='Anwesend').length,excused=plan.length-yes;
  if(!automatic)showToast(yes+' zugesagt · '+excused+' entschuldigt vorgemerkt. Vor Ort prüfen und Markierungen übernehmen.');return true;
 }
 function paintReplies(){const area=document.getElementById('portal-attendance-replies');if(!area)return;const expanded=new Map([...area.querySelectorAll('details')].map(d=>[d.dataset.replyStatus,d.open]));area.replaceChildren();area.hidden=!replyData;if(!replyData)return;
  area.append(node('h3',replyData.event.title+' · '+date(replyData.event)));if(replyData.stale)area.append(node('p','Kalender derzeit nicht aktuell bestätigt.'));
  const plan=replyCandidates(),apply=node('button',plan.length+' Rückmeldung'+(plan.length===1?'':'en')+' vormerken');apply.type='button';apply.className='primary-button';apply.hidden=!plan.length;apply.disabled=replyData.stale||!oneDriveAdministrationReady()||typeof oneDriveStateConfirmed!=='undefined'&&!oneDriveStateConfirmed;apply.onclick=()=>stageCalendarReplies();area.append(apply);
  const answers=new Map(replyData.replies.map(r=>[String(r.memberId),r.status]));for(const [status,title] of [['yes','Zugesagt'],['excused','Entschuldigt'],['maybe','Noch unsicher'],['open','Ohne Rückmeldung']]){const people=members.filter(m=>(!Array.isArray(replyData.event.recipientIds)||replyData.event.recipientIds.includes(String(m.id)))&&(answers.get(String(m.id))||'open')===status),details=node('details'),summary=node('summary',title+' ('+people.length+')');details.append(summary);details.dataset.replyStatus=status;details.open=expanded.has(status)?expanded.get(status):false;const names=node('p',people.map(m=>[m.lastName,m.firstName].filter(Boolean).join(' ')).join(' · ')||'Keine');if(people.length)details.append(names);area.append(details);}
  area.append(node('p',plan.length?'Mit einem Tippen Zusagen als „Anwesend“ und Entschuldigungen vormerken. Anschließend vor Ort prüfen und „Markierungen übernehmen“ wählen. Ohne Rückmeldung bleibt offen.':'Neue Rückmeldungen werden hier zur Vormerkung angeboten. Bereits erfasste Personen und eigene Markierungen bleiben erhalten.'));
  const whatsapp=node('button','WhatsApp-Erinnerung');whatsapp.type='button';whatsapp.disabled=replyData.stale||replyData.event.start<=Date.now();if(reminderEvent!==replyData.event.id){g.H2OReminders?.close();reminderPanel=null;reminderEvent=replyData.event.id;}const reminderHost=reminderPanel||(reminderPanel=node('div'));whatsapp.onclick=()=>{admin();g.H2OReminders.mount(reminderHost,{eventId:replyData.event.id,request:async(path,data)=>{admin();return request(path,data);},scope:'admin:'+g.DrinksStore.sourceKey(),admin:true});};area.append(whatsapp,reminderHost);
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
   for(const e of list){const kind=e.sessionType||'Probe',title=e.title||kind,label=(title.trim().toLocaleLowerCase('de')===kind.toLocaleLowerCase('de')?title:title+' · '+kind)+(e.audienceRestricted===true||Array.isArray(e.recipientIds)?' · Nur ausgewählte Mitglieder':'');const option=node('option',date(e)+' · '+label);option.value=e.id;picker.append(option);}
   picker.value=nextId||'';
   // Automatically pick the next event only while no attendance session runs.
   // Applying the selection also sets its date and the centrally configured
   // session type. Never overwrite an explicit "spontan" choice.
   const next=list.find(e=>e.id===nextId),changed=next&&(previous?.start!==next.start||previous?.sessionType!==next.sessionType||previous?.attendanceType!==next.attendanceType);
   if(!running&&(nextId!==current||changed))select(true);
   document.getElementById('portal-calendar-status').textContent=cal.configured?(cal.stale?'Kalender zuletzt nicht aktualisiert.':'Kalenderstand: '+new Date(cal.fetchedAt).toLocaleString('de-DE')):'Kalender unter Einstellungen → Kalender verbinden.';
   if(privateAccess)await replies();else{replyData=null;paintReplies();}g.syncAttendanceStart?.();
  }catch(e){const status=document.getElementById('portal-calendar-status');if(epoch===attendanceEpoch&&status)status.textContent=g.ConnectionStatus?.message(e)||e.message;}
  finally{loading=false;g.syncAttendanceStart?.();const again=attendanceRefreshPending;attendanceRefreshPending=false;if(again)await refreshAttendance(true);}
 }
 function select(automatic=false){const id=document.getElementById('portal-calendar-pick').value;if(manual){document.getElementById('portal-calendar-pick').value=chosen()||'';return showToast('Bitte zuerst den unbestätigten Erinnerungsversand erneut prüfen.','error');}const e=list.find(e=>e.id===id);if((currentOperationId||currentSessionId)&&id!==chosen()){document.getElementById('portal-calendar-pick').value=chosen()||'';return showToast('Eine Erfassung läuft bereits. Bitte diesen Termin zuerst abschließen oder verwerfen.','error');}selected=id||null;if(!automatic)manualNoCalendar=!id;replyData=null;if(e){const spontaneous=document.getElementById('attendanceSpontaneous');if(spontaneous)spontaneous.open=false;if(!currentSessionId&&!currentOperationId){const sessionType=e.attendanceType||(e.sessionType==='Probe'?'Allgemeine Probe':e.sessionType);if(['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung','Einsatz'].includes(sessionType)){if(typeof chooseSessionType==='function')chooseSessionType(sessionType,{calendar:true});else document.querySelector('#sessionTypes [data-session-type="'+sessionType+'"]')?.click();}}currentProbeDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(e.start));const input=byId('probeDateInput');if(input)input.value=currentProbeDate;}
  if(currentSessionId)safeStorage.setItem('h2o_calendar_session',JSON.stringify({session:currentSessionId,event:selected}));g.syncAttendanceStart?.();if(!automatic&&typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady())replies().catch(e=>{document.getElementById('portal-calendar-status').textContent=e.message;});}
 // Calendar clicks use the existing picker and its running-session protection.
 function selectCalendarEvent(id){
  const event=list.find(e=>e.id===id&&e.approved&&e.kind==='probe'&&e.end>Date.now()),picker=document.getElementById('portal-calendar-pick');
  if(!event||!picker){showToast('Dieser Termin ist noch nicht zur Erfassung verfügbar. Bitte den Kalender aktualisieren.','error');return false;}
  picker.value=id;select();return chosen()===id;
 }
 function isNextEvent(){return chosen()===list[0]?.id;}
 function selectedEvent(){return list.find(e=>e.id===chosen())||null;}
 function attendanceAudience(){
  const id=chosen();if(!id)return null;
  const event=replyData?.event?.id===id&&!replyData.stale?replyData.event:selectedEvent();
  // Public calendars deliberately omit private recipient IDs. Never interpret
  // a restricted public event without its roster as an invitation to everyone.
  if(!event||event.audienceRestricted===true&&!Array.isArray(event.recipientIds))return {pending:true};
  return {recipientIds:Array.isArray(event.recipientIds)?[...event.recipientIds]:null};
 }
 function useSpontaneous(){if(currentSessionId||currentOperationId)return false;selected=null;manualNoCalendar=true;replyData=null;const picker=document.getElementById('portal-calendar-pick');if(picker)picker.value='';currentProbeDate=typeof systemToday==='function'?systemToday():new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());const input=byId('probeDateInput');if(input)input.value=currentProbeDate;paintReplies();return true;}
 function selectedDate(){const e=list.find(e=>e.id===chosen());return e?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(e.start)):null;}
 function sessionStarted(){const date=selectedDate();if(date)currentProbeDate=date;if(selected&&currentSessionId)safeStorage.setItem('h2o_calendar_session',JSON.stringify({session:currentSessionId,event:selected}));paintReplies();}
 function discard(keepCalendar=false){
  safeStorage.removeItem('h2o_calendar_session');
  if(!keepCalendar){
   // Bereits geladene Termine sofort zeigen, auch wenn der nächste Abruf langsam ist.
   selected=list.find(e=>e.approved&&e.kind==='probe'&&e.end>Date.now())?.id||null;
   replyData=null;manualNoCalendar=false;autoStagedSession="";
  }
  const picker=document.getElementById('portal-calendar-pick');if(picker)picker.value=selected||'';
  paintReplies();
  if(!keepCalendar){
   lastLoad=0;
   // Der Aufrufer räumt zuerst die alte Erfassung auf. Danach ohne Minutensperre laden.
   queueMicrotask(()=>{g.syncAttendanceStart?.();refreshAttendance(true);});
  }
 }

 function init(){
  $('identity-recover').onclick=()=>identityTicket(true);
  $('open').onclick=()=>showView(VIEW);document.getElementById('portal-calendar-back').onclick=()=>showView('settingsView');document.getElementById('portal-calendar-admin-open').onclick=()=>{if(requireAdmin(CALENDAR))loadCalendar();};$('back').onclick=()=>{lock();showView('settingsMembersView');};$('member').onchange=()=>{generation++;clearQR();$('status').textContent='';};$('show-qr').onclick=qr;$('review-load').onclick=()=>{if(!cancelChanges())return;return reviewCalendar();};$('review-auto').onclick=acceptAutomatic;$('review-toggle').onclick=()=>{if(!cancelChanges())return;reviewShowSaved=false;reviewPinned.clear();reviewControls();};$('review-all').onclick=()=>{if(!cancelChanges())return;reviewShowSaved=true;reviewPinned.clear();reviewControls();};$('review-select').onclick=()=>{if(!cancelChanges())return;selectingEvents=!selectingEvents;reviewSelection.clear();reviewControls();};$('review-filter').onchange=()=>{if(!cancelChanges()){$('review-filter').value=reviewFilter;return;}reviewFilter=$('review-filter').value;reviewPinned.clear();reviewControls();};$('review-search').oninput=()=>{reviewQuery=String($('review-search').value||'').trim().toLocaleLowerCase('de');reviewPinned.clear();reviewControls();};$('form').onsubmit=event=>{event.preventDefault();return run(async()=>{const version=generation,form=$('form'),submit=form.querySelector('button[type=submit]'),label=submit.textContent;form.setAttribute('aria-busy','true');submit.textContent='Kalender wird geprüft …';$('calendar-status').textContent='Google-Kalender wird abgerufen und geprüft. Das kann einige Sekunden dauern …';try{const result=await request('configure',{calendarUrl:$('calendar').value.trim(),reminders:true,leadHours:Number($('hours').value)});if(version!==generation)return;admin();connectionSaved={url:$('calendar').value,hours:$('hours').value};connectionDirty=false;$('calendar-status').textContent='Verbindung und Erinnerungen gespeichert.';$('status').textContent='';lastLoad=0;try{await syncRoster(true);}catch(e){$('calendar-status').textContent+=' Mitgliederabgleich noch nicht bestätigt: '+e.message;}await reviewCalendar();}catch(e){if(version===generation)$('calendar-status').textContent=e.message;throw e;}finally{form.removeAttribute('aria-busy');submit.textContent=label;}});};
  for(const key of ['events','groups','connection'])document.getElementById('portal-calendar-nav-'+key).onclick=()=>showCalendarSection(key);
  $('calendar').oninput=()=>{connectionDirty=true;};$('hours').onchange=()=>{connectionDirty=true;};
  g.addEventListener('beforeunload',event=>{if(groupsDirty||reviewEdited.size||connectionDirty){event.preventDefault();event.returnValue='';}});
  const observer=new MutationObserver(()=>{if(document.getElementById(VIEW).hidden&&document.getElementById(CALENDAR).hidden)lock();});for(const id of [VIEW,CALENDAR])observer.observe(document.getElementById(id),{attributes:true,attributeFilter:['hidden']});
  const panel=document.querySelector('#attendanceView .home-session-type-panel'),section=node('section');section.className='portal-calendar-picker';section.innerHTML='<h3>Termin aus dem Probenkalender</h3><label for="portal-calendar-pick">Kalendertermin</label><select id="portal-calendar-pick" class="text-input"><option value="">Ohne Kalendertermin / spontan</option></select><p id="portal-calendar-status" role="status"></p>';(document.getElementById('attendanceCalendarChoice')||panel).prepend(section);document.getElementById('portal-public-origin').value=publicOrigin();document.getElementById('portal-public-save').onclick=()=>{const origin=document.getElementById('portal-public-origin').value.trim().replace(/\/$/,'')+'/';if(!g.DrinksPush.validOrigin(origin))return showToast('Bitte eine gültige Cloudflare-Worker-Adresse eingeben.','error');rememberOrigin(origin);lastLoad=0;showToast('Kalenderadresse auf diesem Gerät gespeichert.');refreshAttendance(true);};document.getElementById('portal-calendar-pick').onchange=()=>select();
  const replyArea=node('section');replyArea.id='portal-attendance-replies';replyArea.className='panel portal-attendance-replies';document.querySelector('#attendanceView .input-column').append(replyArea);paintReplies();
  const attendanceView=document.getElementById('attendanceView'),attendanceObserver=new MutationObserver(()=>{if(!attendanceView.hidden)refreshAttendance(true);});attendanceObserver.observe(attendanceView,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!attendanceView.hidden)refreshAttendance(true);if(!document.getElementById(CALENDAR).hidden&&!document.getElementById('portal-calendar-administration').hidden)reviewCalendar({automatic:true});}});
  g.addEventListener('online',()=>refreshAttendance(true));
  queueMicrotask(()=>refreshAttendance(true));
  setInterval(()=>{if(document.hidden)return;if(!byId('attendanceView').hidden)refreshAttendance();if(!document.getElementById(CALENDAR).hidden&&!document.getElementById('portal-calendar-administration').hidden)reviewCalendar({automatic:true});},60000);
 }
 g.PortalAdmin={resolveCheckin:code=>request('checkin-resolve',{code}),checkinContext:()=>({eventId:chosen(),replies:replyData,source:g.DrinksStore.sourceKey()}),load,loadCalendar,lock,reviewOverview,openReview,beforeView,refreshAttendance,sessionStarted,autoStageCalendarReplies,discard,syncRoster,renderSyncStatus,storageChanged,selectedDate,selectedEvent,selectCalendarEvent,isNextEvent,attendanceAudience,useSpontaneous,attendanceChanged:paintReplies};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
