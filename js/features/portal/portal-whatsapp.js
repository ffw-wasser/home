/* H₂O WhatsApp link: independent Safari credential, calendar-only session.
 * No personal #r/#a/#k URLs or ledger capabilities are used here. */
'use strict';
(() => {
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
 const STORAGE='h2o-safari-calendar-v1', ID=/^[A-Za-z0-9_-]{43}$/;
 const el=id=>document.getElementById(id);
 const wanted=()=>new URLSearchParams(location.search).get('event');
 // A secret handoff is carried only in the URL fragment, never in a group link,
 // Referer, server URL or any request. Erase it from browser history immediately.
 const initialPair=(()=>{
  const match=/^#pair=([a-f0-9]{24})$/i.exec(location.hash);
  if(!match)return null;
  history.replaceState(null,'',location.pathname+location.search);
  return match[1].toLowerCase();
 })();
 let session=null,items=[],stale=false,working=false,pending=null,memberName='',eventLinkStatus=null;
 const status=message=>{el('status').textContent=message;};
 const dayFmt=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
 const when=event=>event.allDay?dayFmt.format(new Date(event.start))+' · ganztägig':fmt.format(new Date(event.start))+' Uhr';
 const fmt=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 function restore(){return globalThis.H2OIdentity?.session()||null;}
 function persist(){localStorage.removeItem(STORAGE);}
 async function post(path,body,token){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch(ORIGIN+'/portal/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
   const data=await response.json();
   if(!response.ok)throw Object.assign(Error(data.error||'Verbindung nicht möglich.'),{status:response.status});
   return data;
  }finally{clearTimeout(timer);}
 }
 function hide(){el('pairing').hidden=true;el('chosen').hidden=true;el('events').hidden=true;el('back-to-whatsapp').hidden=!wanted();}
 function showPair(message){
  hide();el('pairing').hidden=false;el('heading').textContent='Zum Termin anmelden';
  status(message||'Bitte mit Passkey anmelden.');
 }
 function element(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
 function paintEvents(){
  const list=el('event-list');list.replaceChildren();
  for(const event of items){
   const btn=element('button',event.title+' · '+when(event));
   btn.className='event-option';btn.type='button';btn.onclick=()=>{const u=new URL(location.href);u.searchParams.set('event',event.id);history.replaceState(null,'',u);renderEvent(event);};list.append(btn);
  }
  if(!items.length)list.append(element('p','Zurzeit keine freigegebenen Termine vorhanden.'));
 }
 function renderEvent(event){
  hide();el('heading').textContent=memberName?'Rückmeldung für '+memberName:'Deine Terminrückmeldung';
  if(!event){status(eventLinkStatus==='not-relevant'?'Dieser Termin ist für dich nicht relevant!':'Dieser Termin ist nicht mehr verfügbar.');return;}
  el('chosen').hidden=false;el('session-type').textContent=event.sessionType||'Termin';
  el('event-title').textContent=event.title||'Feuerwehr-Termin';
  el('event-when').textContent='📅 '+when(event);
  el('event-clothing').hidden=!event.clothing;el('event-clothing').textContent=event.clothing?'👕 '+(event.clothing==='Einsatz'?'Einsatzkleidung':event.clothing==='Tagdienst'?'Tagesdienst':event.clothing):'';
  el('event-location').textContent='📍 '+(event.location||'GH Wasser');
  const state={yes:'✓ Du bist dabei',excused:'Entschuldigt',maybe:'Noch unsicher',open:'Deine Rückmeldung fehlt noch'};
  const changed=Number.isSafeInteger(event.updatedAt)&&event.updatedAt>0?' · Zuletzt geändert: '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(event.updatedAt))+' Uhr':'';
  el('event-status').textContent=(state[event.status]||state.open)+changed;
  const locked=stale||event.start<=Date.now()||working;
  for(const button of el('chosen').querySelectorAll('[data-reply]')){
   const chosen=button.dataset.reply===event.status;
   button.disabled=locked;button.setAttribute('aria-pressed',String(chosen));
   button.textContent=(chosen?'✓ ':'')+({yes:'Bin dabei',excused:'Entschuldigt',maybe:'Noch unsicher'}[button.dataset.reply]);
  }
  status(stale?'Kalender nicht aktuell. Bitte neu laden.':event.start<=Date.now()?'Termin hat bereits begonnen.':'');
 }
 async function refresh(){
  if(working)return;
  if(pending){status('Bitte zuerst die offene Speicherung prüfen.');return;}
  el('reload-event').hidden=true;
  if(!session)return showPair();
  working=true;hide();status('Deine Termine werden geladen …');
  try{
   const renewal=session.scope==='portal'?{ok:true,expiresAt:session.expiresAt}:await post('browser/renew',{alias:session.alias,revision:session.revision},session.token);
   if(renewal.ok!==true||!Number.isSafeInteger(renewal.expiresAt)||renewal.expiresAt<=Date.now())throw Error('Browser-Verbindung konnte nicht verlängert werden.');
   session.expiresAt=renewal.expiresAt;persist(session);
   const result=await post('list',{alias:session.alias,revision:session.revision,eventId:wanted()},session.token);
   memberName=typeof result.memberName==='string'?result.memberName:'';
   items=Array.isArray(result.events)?result.events.filter(e=>ID.test(e.id||'')):[];
   stale=result.stale===true;el('reload-event').hidden=!stale;eventLinkStatus=result.eventLinkStatus;el('pairing').hidden=true;
   working=false;
   if(wanted()&&!ID.test(wanted())){el('heading').textContent='Ungültiger Testlink';status('In diesem Link fehlt eine gültige Termin-ID. Bitte einen echten Termin über den Gruppenführer teilen.');return;}
   if(wanted()){renderEvent(items.find(e=>e.id===wanted()));}
   else{el('heading').textContent='Deine nächsten Termine';el('events').hidden=false;paintEvents();status('Dein Browser ist mit deinem H₂O-Terminzugang verbunden.');}
  }catch(error){
   working=false;
   if(error.status===401||error.status===403){session=null;persist(null);showPair('Der Browserzugang ist nicht mehr gültig. Bitte H₂O erneut verbinden.');}
   else{status(error.message||'Termine konnten nicht geladen werden.');el('reload-event').hidden=false;}
  }
 }
 async function loginPasskey(){
  if(working)return;
  if(!globalThis.H2OPasskeys?.browserSupportsWebAuthn()){showPair('Bitte denselben Terminlink über das WhatsApp-Menü in Safari oder Chrome öffnen.');return;}
  working=true;el('passkey-login').disabled=true;status('Passkey wird geprüft …');
  try{
   const result=await globalThis.H2OIdentity.login();
   persist(result);session=result;working=false;await refresh();
  }catch(error){showPair(error.name==='NotAllowedError'?'Anmeldung abgebrochen oder kein Passkey verfügbar. Richte ihn zuerst in H₂O ein; öffne diesen Link bei Bedarf in Safari/Chrome.':error.message||'Anmeldung fehlgeschlagen.');}
  finally{working=false;el('passkey-login').disabled=false;}
 }
 async function reply(event,choice){
  if(working||stale||event.start<=Date.now()||!session)return;
  el('back-to-h2o-status').textContent='';
  if(pending&&pending.eventId!==event.id)return;
  const newStatus=event.status===choice?'open':choice;
  if(!pending)pending={eventId:event.id,status:newStatus,expectedVersion:event.version,requestId:crypto.randomUUID()};
  else if(pending.status!==newStatus){status('Bitte zuerst die unbestätigte Speicherung erneut prüfen.');return;}
  el('retry-reply').hidden=true;working=true;renderEvent(event);status('Antwort wird sicher gespeichert …');
  try{
   const value=await post('reply',{alias:session.alias,revision:session.revision,...pending},session.token);
   if(value.ok!==true||value.status!==pending.status||!Number.isSafeInteger(value.version)||value.version<pending.expectedVersion)throw Error('Speicherung noch nicht eindeutig bestätigt.');
   event.status=value.status;event.version=value.version;event.updatedAt=value.updatedAt||Date.now();pending=null;status('✓ Gespeichert!');
  }catch(e){
   if([400,401,403,404,409].includes(e.status)){pending=null;stale=true;el('reload-event').hidden=false;}
   if(e.status===401||e.status===403)session=null;
   el('retry-reply').hidden=!pending;
   status((e.message||'Speicherung nicht bestätigt.')+(pending?' Bitte Speicherung prüfen.':' Bitte den Termin erneut laden.'));
  }finally{
   working=false;
   const note=el('status').textContent;
   renderEvent(event);
   status(note);
  }
 }
 // Only launch from this explicit tap. whatsapp://app opens WhatsApp itself;
 // it does not compose a message or pass the event/member/session to WhatsApp.
 el('back-to-whatsapp').addEventListener('click',()=>{
  const feedback=el('back-to-h2o-status');
  if(working){feedback.textContent='Bitte warte, bis die laufende Prüfung oder Speicherung abgeschlossen ist.';return;}
  if(pending){feedback.textContent='Deine Rückmeldung ist noch nicht bestätigt. Bitte zuerst „Speicherung prüfen“ wählen.';return;}
  // Only use history when the referrer really belongs to WhatsApp Web.
  try{
   const previous=new URL(document.referrer);
   if(previous.protocol==='https:'&&/(^|\.)whatsapp\.com$/.test(previous.hostname)&&history.length>1){history.back();return;}
  }catch{}
  const mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||'')||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  feedback.textContent=mobile?'Falls WhatsApp nicht geöffnet wird, wechsle über den App-Umschalter zu WhatsApp.':'Falls WhatsApp Web nicht geöffnet wird, wechsle zum bisherigen WhatsApp-Fenster.';
  try{location.assign(mobile?'whatsapp://app':'https://web.whatsapp.com/');}catch{/* Keep the manual return hint visible when an app launch is blocked. */}
 });
 for(const button of el('chosen').querySelectorAll('[data-reply]'))button.addEventListener('click',()=>{
  const focus=wanted();
  const item=items.find(e=>e.id===focus);
  if(item)void reply(item,button.dataset.reply);
 });
 el('retry-reply').addEventListener('click',()=>{const event=items.find(e=>e.id===pending?.eventId);if(event)void reply(event,pending.status==='open'?event.status:pending.status);});
 el('reload-event').addEventListener('click',()=>void refresh());
 el('passkey-login').addEventListener('click',loginPasskey);
 session=restore();persist();if(initialPair)showPair('Die bisherige Browser-Verbindung wurde ersetzt. Bitte mit deinem zentralen H₂O-Passkey anmelden.');else if(session)void refresh();else showPair();
})();
