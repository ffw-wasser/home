/* Calendar replies are absolute, versioned choices. Failed writes are never shown as saved. */
(function(g){
 'use strict';const $=id=>document.getElementById('portal-'+id);let access=null,generation=0,busy=false,pending=null,timer=null,loaded=false,visible=false,deepLinkDone=false,latestResult=null;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const date=event=>eventIsToday(event)?'Heute · '+(event.allDay?'ganztägig':new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(event.start))+' Uhr'):new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',...(event.allDay?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(event.start))+(event.allDay?' · ganztägig':' Uhr');
 function eventIsToday(event){
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
  return day.format(new Date(event.start))===day.format(new Date(Date.now()));
 }
 function eventDayLabel(event){return eventIsToday(event)?'Heute':new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(event.start));}

 // Remove a repeated type only from the card heading, preserving calendar and export titles.
 function eventTopic(event){
  const raw=String(event.title||event.sessionType||'Termin').trim(),type=String(event.sessionType||'').trim();
  const prefix={Probe:/^(?:Allgemeine\s+)?Probe(?=$|[\s:·|–—-])[\s:·|–—-]*/i,Sonderprobe:/^Sonderprobe(?=$|[\s:·|–—-])[\s:·|–—-]*/i,Unterricht:/^Unterricht(?=$|[\s:·|–—-])[\s:·|–—-]*/i,Veranstaltung:/^Veranstaltung(?=$|[\s:·|–—-])[\s:·|–—-]*/i}[type];
  let title=raw;if(prefix)while(prefix.test(title)){const next=title.replace(prefix,'').trim();if(!next){title=type;break;}title=next;}
  return title;
 }
 async function api(path,data={}){if(!access)throw Error('Bitte den persönlichen Portalzugang öffnen.');const c=access,response=await fetch(c.origin+'/portal/'+path,{method:'POST',headers:{Authorization:'Bearer '+c.capability,'Content-Type':'application/json'},body:JSON.stringify({alias:c.alias,revision:c.revision,...data}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(path==='reply'?12000:path==='year'?35000:25000)});const value=await response.json();if(!response.ok)throw Object.assign(Error(response.status===404&&value.error==='Nicht gefunden.'?'Das H₂O Portal wird noch eingerichtet. Bitte die Verwaltung informieren.':value.error||'Portal nicht erreichbar.'),{status:response.status});return value;}
 function controls(){
  if($('events'))for(const b of $('events').querySelectorAll('button'))b.disabled=b.dataset.reply?busy||!!pending||b.dataset.locked==='true':b.dataset.replyRetry==='true'?busy:false;
  if($('retry')){$('retry').hidden=!pending;$('retry').disabled=busy;}
  if($('refresh'))$('refresh').disabled=busy||!!pending;
 }
 function replyFeedback(eventId,text,uncertain=false){
  const card=document.getElementById('portal-event-'+eventId);if(!card)return;
  card.setAttribute('aria-busy',String(busy));
  const status=card.querySelector('.portal-answer');if(status){status.textContent=text;status.setAttribute('role','status');status.setAttribute('aria-live','polite');}
  let button=card.querySelector('[data-reply-retry]');
  if(uncertain&&!button){button=node('button','Speicherung erneut prüfen');button.type='button';button.dataset.replyRetry='true';button.className='portal-reply-retry';button.onclick=retry;card.append(button);}
  if(button){button.hidden=!uncertain;button.disabled=busy;}
 }
 function schedule(){clearTimeout(timer);if(visible&&!document.hidden&&(!document.getElementById('portal-page-terms')?.hidden||!document.getElementById('portal-page-evidence')?.hidden))timer=setTimeout(refresh,60000);}
 const evidenceDate=(value,medical=false)=>!value?'':medical&&globalThis.MemberEvidence?.displayMonth?globalThis.MemberEvidence.displayMonth(value):new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
 const evidenceOrder={expired:0,missing:1,soon:2,valid:3,covered:4,optional:5};
 const evidenceItemLabel={covered:'✓ Durch G26.3 abgedeckt',optional:'Nicht zusätzlich erforderlich',valid:'✓ Gültig',soon:'! Bald fällig',expired:'× Abgelaufen',missing:'? Nachweis fehlt'};
 const evidenceLabel={valid:'✓ Alle hinterlegten Nachweise gültig',soon:'Bald fällig',expired:'Nachweis abgelaufen',missing:'Nachweis fehlt / Daten unvollständig'};
 function evidenceText(item){if(item.status==='covered')return 'Eine gültige G26.3 ersetzt die zusätzliche G26.2.';if(item.status==='optional')return item.until?'Hinterlegte Gültigkeit: '+evidenceDate(item.until,true):'Kein zusätzlicher Nachweis erforderlich.';if(item.invalidFuture)return 'Kontrolldatum liegt in der Zukunft – bitte korrigieren lassen.';if(item.status==='missing')return item.label==='Führerscheinkontrolle'?'Kontrolle nicht hinterlegt':'Nachweis fehlt';return (item.status==='expired'?'Abgelaufen am ':item.label==='Führerscheinkontrolle'?'Nächste Kontrolle bis ':'Gültig bis ')+evidenceDate(item.until,item.label!=='Führerscheinkontrolle');}
 // Portal grouping only: keep the shared clearance assessment and stored expiry dates intact.
 function evidenceGroups(e,now=Date.now()){
  const E=g.MemberEvidence,groups=E.assess(e,now),today=E.day(now),breathing=groups.find(group=>group.title==='Atemschutz'),medical=groups.find(group=>group.title==='Feuerwehrmedizinische Eignung');
  const g263=e.breathing?e.breathing.g263:e.medical.g263,higher=g263&&g263>=today,required=e.breathing?'g263':higher?'g263':e.medical.g262?'g262':'g263';
  const original=breathing?breathing.items[0]:medical.items[0],items=['g262','g263'].map(key=>{
   const isRequired=key===required,covered=key==='g262'&&higher;
   return {field:key,label:key==='g262'?'G26.2 – ohne Belastungstest':'G26.3 – mit Belastungstest',until:key==='g263'?g263:e.medical.g262,status:isRequired?original.status:covered?'covered':'optional',description:key==='g262'&&e.breathing?'Für Atemschutz ist die G26.3 erforderlich.':'',substitution:isRequired?original.substitution:undefined};
  });
  // No recorded examination: G26.2 is the minimum for members without breathing duties.
  if(!e.breathing&&!e.medical.g262&&!e.medical.g263){items[0].status='missing';items[1].status='optional';}
  const result=[{title:'Ärztliche Untersuchung',items,status:original.status}];
  if(breathing)result.push({...breathing,items:breathing.items.slice(1).map((item,index)=>({...item,field:index===0?'instruction':'ffi',label:index===0?'Unterricht – Sicherheitsunterweisung':'FFI – FitFirefighterIndex',description:index===0?'Sicherheitsunterweisung bei der Feuerwehr Emmendingen · einmal jährlich.':'Atemschutzdurchgang bei der Feuerwehr Emmendingen / Übungsstrecke · einmal jährlich.'})),status:breathing.items.slice(1).some(i=>i.status==='expired')?'expired':breathing.items.slice(1).some(i=>i.status==='missing')?'missing':breathing.items.slice(1).some(i=>i.status==='soon')?'soon':'valid'});
  return result.concat(groups.filter(group=>group.title==='Führerscheinkontrolle').map(group=>({...group,items:group.items.map(item=>({...item,field:'driver'}))})));
 }
 function evidencePriority(groups,message=''){
  const box=$('priority'),content=$('priority-text');if(!box||!content)return;
  const issues=groups.flatMap(group=>group.items.filter(item=>['missing','expired','soon'].includes(item.status))).sort((a,b)=>(evidenceOrder[a.status]??3)-(evidenceOrder[b.status]??3));
  content.replaceChildren();
  for(const item of issues)content.append(node('p',item.label+': '+(item.status==='soon'?'Bald fällig · ':'')+evidenceText(item)));
  if(message)content.append(node('p',message));
  box.hidden=!issues.length&&!message;
  box.dataset.state=message?'unknown':issues.some(item=>item.status==='expired')?'expired':issues.some(item=>item.status==='missing')?'missing':'soon';
  const title=message?'Nachweise nicht aktuell geprüft':issues.length+' Nachweis'+(issues.length===1?'':'e')+' prüfen';
  if($('priority-heading'))$('priority-heading').textContent=title;
  const badge=$('evidence-count'),tab=document.querySelector?.('[data-deckel-target="portal-evidence"]');
  if(badge){badge.hidden=box.hidden;badge.textContent=message?'!':String(issues.length);badge.dataset.state=box.dataset.state;}
  if(tab){if(box.hidden)tab.removeAttribute('aria-label');else tab.setAttribute('aria-label','Meine Nachweise · '+title);}
 }
 function openEvidence(){
  g.DeckelMobile?.jump('portal-evidence');
  const evidence=$('evidence');if(!evidence)return;
  const target=$('evidence-details').querySelector('.portal-evidence-group[data-state=expired],.portal-evidence-group[data-state=missing],.portal-evidence-group[data-state=soon]')||evidence;
  target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  $('evidence-heading').focus({preventScroll:true});
 }
 function eventSections(events,now=Date.now()){
  const upcoming=events.filter(e=>Number.isFinite(e.end)&&e.end>now).sort((a,b)=>a.start-b.start);
  const next=upcoming[0];
  return {next,ordered:upcoming};
 }
 async function refreshEvidence(version){
  if(!$('evidence')||globalThis.PortalEvidenceEditor?.hasUnsaved())return;const box=$('evidence'),status=$('evidence-status'),details=$('evidence-details');box.hidden=false;status.textContent='Nachweise werden aktualisiert …';
  try{const result=await api('evidence');if(version!==generation)return;
   if(!result.evidence){details.replaceChildren();evidencePriority([],'Noch keine persönlichen Nachweisdaten übertragen. Bitte die Verwaltung um einen Mitgliederabgleich bitten.');status.textContent='Noch keine persönlichen Nachweisdaten übertragen. Bitte die Verwaltung um einen Mitgliederabgleich bitten.';return;}
   const groups=evidenceGroups(result.evidence).sort((a,b)=>evidenceOrder[a.status]-evidenceOrder[b.status]);evidencePriority(groups);details.replaceChildren();
   for(const group of groups){
    const section=node('section');section.className='portal-evidence-group';section.dataset.group=group.title;section.dataset.state=group.status;
    const heading=node('header'),title=node('h3',group.title),badge=node('p',group.title==='Führerscheinkontrolle'&&group.status==='valid'?'✓ Kontrolle dokumentiert':evidenceLabel[group.status]);badge.className='portal-evidence-group-status';heading.append(title);if(group.items.length>1)heading.append(badge);section.append(heading);
    for(const item of [...group.items].sort((a,b)=>evidenceOrder[a.status]-evidenceOrder[b.status])){
     if(item.status==='covered'){const note=node('p','✓ G26.2 durch gültige G26.3 abgedeckt.');note.className='portal-evidence-covered';section.append(note);continue;}
     const card=node('article');card.className='portal-evidence-item';card.dataset.state=item.status;
     const row=node('div');row.className='portal-evidence-item-heading';const state=node('span',evidenceItemLabel[item.status]);state.className='portal-evidence-item-status';if(group.items.length>1||item.label!==group.title)row.append(node('h4',item.label));row.append(state);card.append(row);
     if(item.description){const description=node('p',item.description);description.className='portal-evidence-meta';card.append(description);}const until=node('p',evidenceText(item));until.className='portal-evidence-date';card.append(until);
     for(const text of [item.checkedOn?'Letzte Kontrolle: '+evidenceDate(item.checkedOn):'',item.intervalMonths?'Kontrollintervall: '+item.intervalMonths+' Monate':'',item.substitution||''].filter(Boolean)){const meta=node('p',text);meta.className='portal-evidence-meta';card.append(meta);}
     if(item.field&&result.entries){const origin=node('p',globalThis.PortalEvidenceEditor?.source(result.entries[item.field])||'Verwaltung');origin.className='portal-evidence-source';card.append(origin);}
     if(item.field==='driver'&&result.entries?.driver.status==='pending')card.append(node('p','Neu gemeldete Kontrolle vom '+evidenceDate(result.entries.driver.checkedOn)+' · noch nicht bestätigt. Die letzte bestätigte Kontrolle bleibt maßgeblich.'));
     section.append(card);
    }
    if(group.vehicles){const vehicles=node('p','Hinterlegte Fahrberechtigung: '+group.vehicles.join(' · '));vehicles.className='portal-evidence-meta';section.append(vehicles);}
    details.append(section);
   }
   globalThis.PortalEvidenceEditor?.render(result,details);
   if(!groups.length)details.append(node('p','Für dich sind derzeit weder Atemschutz noch Fahrzeugberechtigungen hinterlegt.'));
   status.textContent='Datenstand: '+(result.syncedAt?new Date(result.syncedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'nicht hinterlegt')+'\nVorwarnung: 60 Tage.';
   if(groups.some(group=>group.title==='Atemschutz'))details.append(node('p','Angezeigt werden die hinterlegten Nachweise. Die konkrete Einsatzfreigabe prüft die verantwortliche Führungskraft.'));
  }catch(e){if(version===generation){evidencePriority([],'Nachweise konnten nicht aktuell geprüft werden. Bitte den Datenstand unter „Meine Nachweise“ beachten.');status.textContent=e.status===404?'Die Nachweisanzeige benötigt das aktuelle Portal-Update. Bitte die Verwaltung informieren.':(navigator.onLine===false?'Offline. ':'')+'Nachweise konnten nicht aktuell geprüft werden. '+(details.children.length?'Angezeigt bleibt der zuletzt geladene Stand.':'Bitte erneut aktualisieren.');}}
 }
 async function refresh(){if(!access||busy||pending||document.hidden)return;const version=generation;busy=true;controls();const evidence=refreshEvidence(version);$('status').textContent=loaded?'Termine werden aktualisiert …':'Kalender wird geladen …';try{const result=await api('list');if(version!==generation)return;loaded=true;paint(result);$('status').textContent=!result.configured?'Der Kalender wird von der Verwaltung noch verbunden.':(result.stale?'Kalender konnte nicht aktuell geprüft werden. Angezeigt bleibt der letzte Stand. ':'')+'Zuletzt aktualisiert: '+new Date(result.fetchedAt).toLocaleString('de-DE')+'.';}catch(e){if(version===generation){const network=e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError||/abort|load failed|fetch/i.test(e.message||'');$('status').textContent=(navigator.onLine===false?'Offline. ':network?(g.ConnectionStatus?.message(e)||'Die Kalenderverbindung wurde unterbrochen. Bitte erneut versuchen.')+' ':e.message)+(loaded?' Der zuletzt geladene Stand bleibt angezeigt.':'');}}finally{if(version===generation){busy=false;controls();schedule();}await evidence;}}
 let overviewDialog=null,overviewRequest=0;
 function closeOverview(){g.H2OReminders?.close();overviewRequest++;overviewDialog?.close();}
 async function shareEvent(event,feedback){
  // Keep navigator.share inside the original user gesture: async health checks above it
  // can consume transient activation on iOS Safari and prevent the share sheet.
  if(event.audienceRestricted&&!confirm('Dieser Termin ist nur für ausgewählte Mitglieder freigegeben. In einer WhatsApp-Gruppe können auch andere Personen die Terminangaben lesen. Trotzdem teilen?'))return;
  const url=new URL('termin.html',location.href);url.hash='';url.search='';url.searchParams.set('event',event.id);
  const start=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(event.start));
  const clothing=event.clothing==='Einsatz'?'Einsatzkleidung':event.clothing==='Tagdienst'?'Tagesdienst':(event.clothing||'').trim();
  const message='🚒 Feuerwehr Wasser\n\n'+(event.sessionType||'Termin')+' · '+event.title+'\n📅 '+start+' Uhr\n📍 '+(event.location||'GH Wasser')+(clothing?'\n👕 Kleidung: '+clothing:'')+'\n\nBitte über H₂O eine Rückmeldung abgeben:';
  try{
   if(navigator.share){await navigator.share({title:'Feuerwehr Wasser · '+event.title,text:message,url:url.href});feedback.textContent='Teilen-Menü geöffnet. Der Versand erfolgt erst durch deine Bestätigung.';}
   else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message+'\n'+url.href);feedback.textContent='Nachricht mit gemeinsamem Terminlink kopiert. In WhatsApp einfügen.';}
   else{prompt('WhatsApp-Nachricht kopieren:',message+'\n'+url.href);feedback.textContent='Nachricht zum Kopieren vorbereitet.';}
  }catch(e){if(e.name!=='AbortError'){
    const fallback=message+'\n'+url.href;
    prompt('WhatsApp-Nachricht kopieren:',fallback);
    feedback.textContent='Teilen-Menü nicht verfügbar. Nachricht zum Kopieren vorbereitet.';
  }}
 }
 async function showOverview(event){
  if(!overviewDialog){overviewDialog=node('dialog');overviewDialog.className='portal-calendar-dialog portal-overview-dialog';overviewDialog.setAttribute('aria-labelledby','portal-overview-title');document.body.append(overviewDialog);overviewDialog.addEventListener('close',()=>{overviewRequest++;g.H2OReminders?.close();});}
  const request=++overviewRequest,version=generation,heading=node('h2','Rückmeldungen'),title=node('p',event.title),content=node('div','Rückmeldungen werden geladen …'),close=node('button','Schließen');heading.id='portal-overview-title';close.type='button';close.className='portal-overview-close';close.textContent='×';close.setAttribute('aria-label','Schließen');close.onclick=closeOverview;const share=node('button','Terminlink teilen'),shareStatus=node('p');share.type='button';share.className='portal-overview-open';share.disabled=true;share.onclick=()=>shareEvent(event,shareStatus);shareStatus.setAttribute('role','status');const header=node('div'),actions=node('div');header.className='portal-overview-heading';actions.className='portal-overview-actions';header.append(heading,close);actions.append(share);overviewDialog.replaceChildren(header,title,actions,shareStatus,content);if(!overviewDialog.open)overviewDialog.showModal();
  if(event.start>Date.now()&&access?.origin){
   shareStatus.textContent='Teilen wird vorbereitet …';
   void (async()=>{
    try{
     const response=await fetch(access.origin+'/health',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(12000)});
     const health=await response.json();
     if(request!==overviewRequest||version!==generation||!overviewDialog.open)return;
     if(response.ok&&health.browserPairVersion===1){share.disabled=false;shareStatus.textContent='';}
     else shareStatus.textContent='Der Terminlink kann gerade nicht geteilt werden. Bitte später erneut versuchen.';
    }catch{if(request===overviewRequest&&overviewDialog.open)shareStatus.textContent='Teilen ist gerade nicht möglich. Bitte später erneut versuchen.';}
   })();
  }
  try{const result=await api('overview',{eventId:event.id});if(request!==overviewRequest||version!==generation||!overviewDialog.open)return;content.replaceChildren();
   const remind=node('button','Personen erinnern'),reminderHost=node('div'),summary=node('div'),back=node('button','← Rückmeldungen');remind.type='button';remind.className='portal-overview-remind';back.type='button';back.className='portal-overview-back';back.hidden=true;
   back.onclick=()=>{g.H2OReminders?.close();showOverview(event);};
   remind.disabled=result.stale||!(result.event?.start>Date.now());
   remind.onclick=()=>{g.H2OReminders.mount(reminderHost,{eventId:result.event.id,request:api,scope:access.origin+':'+access.alias});remind.hidden=true;share.hidden=true;shareStatus.hidden=true;summary.hidden=true;back.hidden=false;heading.textContent='WhatsApp';};actions.append(remind,back);content.append(reminderHost,summary);
   if(result.stale)summary.append(node('p','Die Terminangaben konnten gerade nicht aktualisiert werden. Die Rückmeldungen sind aktuell.'));
   for(const [value,label] of [['yes','Zugesagt'],['excused','Entschuldigt'],['maybe','Noch unsicher'],['open','Ohne Rückmeldung']]){const people=result.members.filter(m=>m.status===value);summary.append(node('h3',label+' ('+people.length+')'),node('p',people.map(m=>m.name).join(' · ')||'Keine'));}
  }catch(error){if(request!==overviewRequest||version!==generation||!overviewDialog.open)return;const retry=node('button','Erneut laden');retry.type='button';retry.onclick=()=>showOverview(event);content.replaceChildren(node('p',g.ConnectionStatus?.message(error)||error.message),retry);}
 }
 function paint(result){latestResult=result;globalThis.H2OIdentity?.setMemberName?.(result.memberName||'');const gfTile=document.getElementById('portal-more-breathing-tile');if(gfTile)gfTile.hidden=result.leader!==true;$('birthday').hidden=!result.birthday?.today;$('birthday').textContent=result.birthday?.today?'🎂 Alles Gute zum Geburtstag! '+(result.birthday.awarded?'Dein Geburtstagsbonus wurde gutgeschrieben: ':'Dein Geburtstagsbonus wird heute gutgeschrieben: ')+(result.birthday.awardUnits/150).toLocaleString('de-DE')+' Treuepunkt'+(result.birthday.awardUnits===150?'':'e')+'.':'';$('events').replaceChildren();const sections=eventSections(result.events),upcoming=sections.ordered;for(const event of upcoming){
  const card=node('article');card.className='portal-event';card.dataset.status=['yes','excused','maybe'].includes(event.status)?event.status:'open';card.id='portal-event-'+event.id;const info=node('div');info.className='portal-event-content';info.setAttribute('aria-label','Termininformationen');card.append(info);const when=node('button');when.type='button';when.className='portal-event-date';when.setAttribute('aria-label',date(event)+' – Kalender öffnen oder Termin übernehmen');when.setAttribute('aria-haspopup','dialog');const time=node('time',date(event));time.setAttribute('datetime',new Date(event.start).toISOString());when.append(time);when.onclick=()=>g.H2OCalendar.show(event);const badges=node('div');badges.className='portal-event-badges';const topic=eventTopic(event);if(event.sessionType&&topic.toLocaleLowerCase('de')!==event.sessionType.toLocaleLowerCase('de')){badges.append(node('span',event.sessionType));info.append(badges);}info.append(node('h3',topic),when);
  const day=node('span',eventDayLabel(event)),clock=node('strong',event.allDay?'Ganztägig':new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(event.start))+' Uhr');day.className='portal-event-day';clock.className='portal-event-clock';time.textContent='';time.append(day,clock);
  for(const [symbol,label,value] of [['📍','Ort',event.location||'GH Wasser'],['👕','Kleidung',event.clothing==='Einsatz'?'Einsatzkleidung':event.clothing]]){if(!value)continue;const row=node('p'),icon=node('span',symbol),text=node('span',value);row.className='portal-event-meta';icon.setAttribute('aria-hidden','true');row.setAttribute('aria-label',label+': '+value);row.append(icon,text);info.append(row);}
  const status=node('strong',({yes:'✓ Du bist dabei',excused:'Entschuldigt',maybe:'Gesehen · noch unsicher',open:'Deine Rückmeldung fehlt noch'})[event.status]||'Deine Rückmeldung fehlt noch');if(event.start<=Date.now())status.textContent+=' · Rückmeldung geschlossen';status.className='portal-answer portal-answer-'+event.status;card.append(status);
  const actions=node('div');actions.className='portal-choices';for(const [value,label] of [['yes','Bin dabei'],['excused','Entschuldigt'],['maybe','Noch unsicher']]){const selected=event.status===value,button=node('button',label);button.type='button';button.dataset.reply=value;button.setAttribute('aria-pressed',String(selected));if(selected)button.textContent='✓ '+label;button.setAttribute('aria-label',(value==='maybe'?'Gesehen, noch unsicher – Erinnerungen bleiben aktiv':label)+(selected?' – ausgewählt, erneut tippen zum Zurücknehmen':''));if(value==='maybe')button.title='Gesehen · noch unsicher';button.dataset.locked=String(result.stale||event.start<=Date.now());button.onclick=()=>{if(value==='maybe'&&!selected&&!result.uncertainReplies){$('status').textContent='Für die Antwort „Noch unsicher“ muss die Verwaltung den Cloudflare-Dienst aktualisieren.';return;}return reply(event,selected?'open':value);};actions.append(button);}if(event.start>Date.now()){card.append(actions);if(['yes','excused','maybe'].includes(event.status)){const hint=node('p','Erneut antippen hebt die Auswahl auf.');hint.className='portal-choice-hint';card.append(hint);}}if(result.leader){const overview=node('button','Rückmeldungen ansehen');overview.type='button';overview.className='portal-overview-open';overview.setAttribute('aria-haspopup','dialog');overview.setAttribute('aria-label','Rückmeldungen ansehen');const icon=document.createElementNS?.('http://www.w3.org/2000/svg','svg');if(icon){icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.setAttribute('class','portal-overview-symbol');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75');const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx','9');circle.setAttribute('cy','7');circle.setAttribute('r','4');icon.append(path,circle);overview.append(icon);}overview.onclick=()=>showOverview(event);info.append(overview);}if(event===sections.next){const first=node('div');first.className='portal-first-event';const heading=node('h2','Nächster Termin');heading.className='portal-next-heading';first.append(heading,card);$('events').append(first);}else $('events').append(card);
 }if(!upcoming.length){const empty=node('p','Zurzeit stehen keine weiteren freigegebenen Termine an.');empty.className='portal-empty-state';$('events').append(empty);}
 const focus=new URLSearchParams(location.search).get('event');if(!deepLinkDone&&focus&&/^[A-Za-z0-9_-]{43}$/.test(focus)){const target=document.getElementById('portal-event-'+focus);if(target){target.scrollIntoView({block:'center'});deepLinkDone=true;}}
 }
 async function reply(event,status){if(busy||pending||event.status===status)return;pending={eventId:event.id,status,expectedVersion:event.version,requestId:crypto.randomUUID()};await retry();}
 async function retry(){if(!pending||busy)return;const version=generation,job=pending;busy=true;controls();$('status').textContent='Rückmeldung wird gespeichert …';replyFeedback(job.eventId,$('status').textContent);try{const saved=await api('reply',job);if(version!==generation)return;if(saved.ok!==true||saved.status!==job.status||!Number.isSafeInteger(saved.version)||saved.version<job.expectedVersion)throw Error('Der Dienst hat die Speicherung nicht eindeutig bestätigt.');pending=null;if(latestResult){const event=latestResult.events.find(e=>e.id===job.eventId);if(event){event.status=saved.status;event.version=saved.version;}paint(latestResult);}else loaded=false;$('status').textContent='✓ Rückmeldung gespeichert.';}catch(e){if(version===generation){if([400,401,403,404,409].includes(e.status))pending=null;$('status').textContent=(g.ConnectionStatus?.message(e)||e.message)+(pending?' Speicherung noch nicht bestätigt. Bitte erneut prüfen.':' Bitte aktualisieren.');}}finally{if(version===generation){busy=false;replyFeedback(job.eventId,$('status').textContent,!!pending);controls();if(!pending)schedule();}}}
 function clear(){g.PortalYearPlan?.lock();g.PortalHydrantsView?.clear();globalThis.PortalEvidenceEditor?.clear();globalThis.H2OIdentity?.setMemberName?.('');const gfTile=document.getElementById('portal-more-breathing-tile');if(gfTile)gfTile.hidden=true;g.H2OGFBreathing?.clear();closeOverview();g.TheaterPhone?.clear();generation++;evidencePriority([]);if($('evidence'))$('evidence').hidden=true;$('evidence-details')?.replaceChildren();if($('evidence-status'))$('evidence-status').textContent='';access=null;busy=false;pending=null;loaded=false;visible=false;deepLinkDone=false;latestResult=null;clearTimeout(timer);if($('section'))$('section').hidden=true;$('events')?.replaceChildren();if($('birthday')){$('birthday').hidden=true;$('birthday').textContent='';}if($('status'))$('status').textContent='';}
 async function render(snapshot){const p=new URLSearchParams(location.hash.slice(1)),next=snapshot.actions?{...snapshot.actions,alias:g.H2OIdentity?.credentials()?.alias||p.get('a')}:null;if(!next?.central){clear();$('section').hidden=false;$('evidence').hidden=false;$('evidence-status').textContent='Für persönliche Nachweise bitte die Verwaltung um einen verbundenen Portalzugang bitten.';visible=true;$('status').textContent='Für Proben und Termine muss die Verwaltung deinen Portalzugang mit dem Kontodienst verbinden.';g.DeckelMobile?.sync();return;}const changed=next.alias!==access?.alias||next.revision!==access?.revision||next.origin!==access?.origin;if(changed)clear();access=next;g.TheaterPhone?.connect(next);$('section').hidden=false;visible=true;g.DeckelMobile?.sync();g.DeckelPush?.render(next);await refresh();}
 function init(){if($('priority-open'))$('priority-open').onclick=openEvidence;$('refresh').onclick=refresh;g.addEventListener('portal-pagechange',event=>{closeOverview();if(['portal-section','portal-evidence'].includes(event.detail.page)){refresh();schedule();}else clearTimeout(timer);});$('retry').onclick=retry;document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else{refresh();schedule();}});g.addEventListener('hashchange',clear);}
 g.H2OPortal={render,clear,api,hasAccess:()=>Boolean(access),refreshEvidence:()=>refreshEvidence(generation),hasUnsaved:()=>!!pending||!!g.TheaterPhone?.hasUnsaved()||!!globalThis.PortalEvidenceEditor?.hasUnsaved()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);

