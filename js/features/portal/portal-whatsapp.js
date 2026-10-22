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
 function hide(){el('pairing').hidden=true;el('chosen').hidden=true;el('events').hidden=true;el('remove').hidden=!session;el('back-to-whatsapp').hidden=!wanted();}
 function showPair(message){
  hide();el('pairing').hidden=false;el('heading').textContent='Zum Termin anmelden';
  status(message||'Bitte mit Passkey anmelden.');
 }
 function element(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
 function paintEvents(){
  const list=el('event-list');list.replaceChildren();
  for(const event of items){
   const btn=element('button',event.title+' · '+fmt.format(new Date(event.start))+' Uhr');
   btn.className='event-option';btn.type='button';btn.onclick=()=>{const u=new URL(location.href);u.searchParams.set('event',event.id);history.replaceState(null,'',u);renderEvent(event);};list.append(btn);
  }
  if(!items.length)list.append(element('p','Zurzeit keine freigegebenen Termine vorhanden.'));
 }
 function renderEvent(event){
  hide();el('remove').hidden=false;el('heading').textContent=memberName?'Rückmeldung für '+memberName:'Deine Terminrückmeldung';
  if(!event){status(eventLinkStatus==='not-relevant'?'Dieser Termin ist für dich nicht relevant!':'Dieser Termin ist nicht mehr verfügbar.');return;}
  el('chosen').hidden=false;el('session-type').textContent=event.sessionType||'Termin';
  el('event-title').textContent=event.title||'Feuerwehr-Termin';
  el('event-when').textContent='📅 '+fmt.format(new Date(event.start))+' Uhr';
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
  status(stale?'Kalender nicht aktuell. Antworten vorübergehend gesperrt.':'Wähle deine Rückmeldung.');
 }
 async function refresh(){
  if(!session)return showPair();
  working=true;hide();status('Deine Termine werden geladen …');
  try{
   const renewal=session.scope==='portal'?{ok:true,expiresAt:session.expiresAt}:await post('browser/renew',{alias:session.alias,revision:session.revision},session.token);
   if(renewal.ok!==true||!Number.isSafeInteger(renewal.expiresAt)||renewal.expiresAt<=Date.now())throw Error('Browser-Verbindung konnte nicht verlängert werden.');
   session.expiresAt=renewal.expiresAt;persist(session);
   const result=await post('list',{alias:session.alias,revision:session.revision,eventId:wanted()},session.token);
   memberName=typeof result.memberName==='string'?result.memberName:'';
   items=Array.isArray(result.events)?result.events.filter(e=>ID.test(e.id||'')):[];
   stale=result.stale===true;eventLinkStatus=result.eventLinkStatus;el('remove').hidden=false;el('pairing').hidden=true;
   working=false;
   if(wanted()&&!ID.test(wanted())){el('heading').textContent='Ungültiger Testlink';status('In diesem Link fehlt eine gültige Termin-ID. Bitte einen echten Termin über den Gruppenführer teilen.');return;}
   if(wanted()){renderEvent(items.find(e=>e.id===wanted()));}
   else{el('heading').textContent='Deine nächsten Termine';el('events').hidden=false;paintEvents();status('Dein Browser ist mit deinem H₂O-Terminzugang verbunden.');}
  }catch(error){
   working=false;
   if(error.status===401||error.status===403){session=null;persist(null);showPair('Der Browserzugang ist nicht mehr gültig. Bitte H₂O erneut verbinden.');}
   else{status(error.message||'Termine konnten nicht geladen werden.');el('pairing').hidden=false;}
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
  if(pending&&pending.eventId!==event.id)return;
  const newStatus=event.status===choice?'open':choice;
  if(!pending)pending={eventId:event.id,status:newStatus,expectedVersion:event.version,requestId:crypto.randomUUID()};
  else if(pending.status!==newStatus){status('Bitte zuerst die unbestätigte Speicherung erneut prüfen.');return;}
  working=true;renderEvent(event);status('Antwort wird sicher gespeichert …');
  try{
   const value=await post('reply',{alias:session.alias,revision:session.revision,...pending},session.token);
   if(value.ok!==true||value.status!==pending.status||!Number.isSafeInteger(value.version)||value.version<pending.expectedVersion)throw Error('Speicherung noch nicht eindeutig bestätigt.');
   event.status=value.status;event.version=value.version;event.updatedAt=value.updatedAt||Date.now();pending=null;status('✓ Gespeichert!');
  }catch(e){
   if([400,401,403,404,409].includes(e.status))pending=null;
   status((e.message||'Speicherung nicht bestätigt.')+(pending?' Bitte dieselbe Antwort erneut antippen.':' Bitte den Termin erneut laden.'));
  }finally{
   working=false;
   const note=el('status').textContent;
   renderEvent(event);
   status(note);
  }
 }
 // WhatsApp does not provide a reliable browser return URL. Never guess a chat or use an untrusted referrer as a destination.
 el('back-to-whatsapp').addEventListener('click',()=>{
  const feedback=el('back-to-h2o-status');
  feedback.textContent='Wechsle zurück zu WhatsApp. Deine Rückmeldung bleibt gespeichert.';
  try{
   const previous=new URL(document.referrer);
   if(/(^|\.)whatsapp\.com$/.test(previous.hostname)&&history.length>1){history.back();return;}
  }catch{}
  feedback.textContent='Öffne WhatsApp über den App-Umschalter. Deine Rückmeldung ist gespeichert.';
 });
 // Return only to the already authenticated installed PWA, or genuine in-tab history.
 // Never fall back to a generic deckel.html link: that could restart QR onboarding.
 el('back-to-h2o').addEventListener('click',async()=>{
  const feedback=el('back-to-h2o-status');
  const standalone=Boolean(navigator.standalone||matchMedia('(display-mode: standalone)').matches);
  if(standalone&&globalThis.DeckelDevice){
   try{
    const stored=await DeckelDevice.read();
    const personal=stored?.url||await DeckelDevice.readLink();
    if(personal){
     const url=new URL(personal);
     if(url.origin===location.origin&&url.pathname===new URL('deckel.html',location.href).pathname&&!url.search){
      location.assign(url.href);
      return;
     }
    }
   }catch{/* A private link may not be available in this browser context. */}
  }
  if(globalThis.H2OIdentity?.session()){location.assign(new URL('deckel.html',location.href).href);return;}
  try{
   const previous=new URL(document.referrer);
   if(previous.origin===location.origin&&previous.pathname===new URL('deckel.html',location.href).pathname&&history.length>1){
    history.back();
    return;
   }
  }catch{}
  feedback.textContent='Öffne die H₂O-App über ihr Symbol auf deinem Home-Bildschirm. Wenn du Safari oder Chrome verwendest, wechsle über den App-Umschalter zu H₂O. Deine Anmeldung bleibt erhalten.';
 });
 el('remove').addEventListener('click',async()=>{
  if(!confirm('Browserzugang auf diesem Gerät entfernen? Rückmeldungen bleiben gespeichert.'))return;
  if(session?.scope==='portal'){try{await globalThis.H2OIdentity.post('logout');globalThis.H2OIdentity.forget();}catch(e){status(e.message);return;}}
  session=null;pending=null;persist(null);showPair('Browserzugang auf diesem Gerät entfernt. Andere Browserzugänge kannst du in H₂O sperren.');
 });
 for(const button of el('chosen').querySelectorAll('[data-reply]'))button.addEventListener('click',()=>{
  const focus=wanted();
  const item=items.find(e=>e.id===focus);
  if(item)void reply(item,button.dataset.reply);
 });
 el('passkey-login').addEventListener('click',loginPasskey);
 session=restore();persist();if(initialPair)showPair('Die bisherige Browser-Verbindung wurde ersetzt. Bitte mit deinem zentralen H₂O-Passkey anmelden.');else if(session)void refresh();else showPair();
})();
