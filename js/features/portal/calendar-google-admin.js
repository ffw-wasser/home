/* Google authority is per administrator/browser, memory-only and separate from H2O. */
(function(g){
 'use strict';
 let access=null,pending=null,host=null,request=null,epoch=0,config=null,connecting=false,editor=null,editing=false,saving=false,role=null;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 function cleanup(){if(!pending)return;removeEventListener('message',pending.receive);pending.channel?.close();clearTimeout(pending.timer);clearTimeout(pending.closedTimer);clearInterval(pending.closed);pending.popup.close();pending=null;connecting=false;}
 function clear(){epoch++;connecting=false;editor?.remove();editor=null;editing=false;saving=false;role=null;access=null;cleanup();host?.remove();host=null;request=null;config=null;}
 function token(){if(!access||access.expiresAt<=Date.now()){access=null;throw Error('Bitte Google Kalender erneut verbinden.');}return access.accessToken;}
 async function api(action,data={}){const version=epoch;if(!request)throw Error('Kalenderverwaltung bitte neu öffnen.');try{const result=await request('google-api/'+action,{...data,googleAccessToken:token()});if(version!==epoch)throw Error('Verwaltung wurde geschlossen. Bitte erneut öffnen.');return result;}catch(error){if(error.status===401&&version===epoch)access=null;throw error;}}
 function paint(message){if(!host)return;host.replaceChildren();const heading=node('h3','Google Kalender gemeinsam bearbeiten'),info=node('p','Jede Verwaltungsperson verbindet ihr eigenes Google-Konto. Martin bleibt Eigentümer und muss dem zweiten Konto „Änderungen an Terminen vornehmen“ erlauben. Normale Mitglieder brauchen keine Google-Anmeldung.');host.append(heading,info);
  const status=node('p',message||(access?'Google Kalender verbunden. Die Verbindung gilt bis zum Schließen oder Ablauf der Sitzung.':config?.configured?'Verbinde dein berechtigtes Google-Konto.':'Die Verwaltung muss die Google-Anbindung noch einrichten. Der bestehende Kalender funktioniert weiter.'));status.setAttribute('role','status');host.append(status);
  const connect=node('button',access?'Google-Konto wechseln':'Google Kalender verbinden');connect.type='button';connect.className='primary-button';connect.disabled=connecting||!config?.configured;connect.onclick=()=>connectGoogle(status);host.append(connect);
  if(access){const end=node('button','Google-Verbindung auf diesem Gerät beenden');end.type='button';end.className='outline-button';end.onclick=()=>{if(!cancel())return;epoch++;access=null;paint('Google-Verbindung auf diesem Gerät beendet. Die Freigabe in deinem Google-Konto kannst du dort separat widerrufen.');};host.append(end);}
 }
 async function connectGoogle(status){
  if(connecting||!cancel())return;
  const popup=g.open('about:blank','h2o-google-oauth','width=560,height=720');if(!popup){status.textContent='Bitte das Anmeldefenster für H₂O erlauben und erneut verbinden.';return;}
  access=null;role=null;connecting=true;const version=epoch;let verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
  try{
   const challenge=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),start=await request('google-oauth/start',{challenge});if(version!==epoch){popup.close();return;}
   const target=new URL(start.authorizationUrl);if(target.origin!=='https://accounts.google.com'||target.pathname!=='/o/oauth2/v2/auth'||!start.state)throw Error('Google-Anmeldeziel nicht bestätigt.');
   const receive=async event=>{
    if(event.origin!=='https://ffw-wasser.github.io'||event.source!==popup||event.data?.type!=='h2o-google-oauth'||event.data.state!==start.state)return;
    if(!pending||pending.popup!==popup)return;const code=event.data.code,error=event.data.error;cleanup();
    try{if(error||typeof code!=='string'||!code)throw Error('Die Google-Freigabe wurde abgebrochen.');const value=await request('google-oauth/exchange',{state:start.state,code,verifier});verifier='';if(version!==epoch)return;access=value;const google=await api('status');if(version!==epoch)return;role=google.accessRole;paint(['writer','owner'].includes(google.accessRole)?'Google Kalender verbunden · Bearbeitung erlaubt.':'Google Kalender verbunden · nur Leserechte. Martin muss die Bearbeitung noch erlauben.');}
    catch(e){verifier='';if(version===epoch){access=null;paint(e.message);}}
   };
   pending={popup,receive,timer:setTimeout(()=>{verifier='';cleanup();paint('Google-Anmeldung abgelaufen. Bitte erneut verbinden.');},300000),closed:setInterval(()=>{if(popup.closed){clearInterval(pending.closed);pending.closedTimer=setTimeout(()=>{if(pending?.popup!==popup)return;verifier='';cleanup();paint('Google-Anmeldefenster geschlossen. Du kannst erneut verbinden.');},1000);}},500)};
   if(typeof BroadcastChannel==='function'&&/^[A-Za-z0-9_-]{43}$/.test(start.channel||'')){pending.channel=new BroadcastChannel('h2o-google-'+start.channel);pending.channel.onmessage=event=>receive({origin:location.origin,source:popup,data:event.data});}
   addEventListener('message',receive);popup.location.href=target.href;paint('Bitte die Anmeldung und Kalenderfreigabe im Google-Fenster bestätigen.');
  }catch(e){verifier='';popup.close();connecting=false;paint(e.message);}
 }
 // Values are entered in Europe/Berlin, independently of the device timezone.
 const berlin=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const localTime=value=>berlin.format(new Date(value)).replace(' ','T');
 function instant(value){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Bitte Datum und Uhrzeit vollständig eingeben.');
  const guess=Date.parse(value+'Z'),matches=[guess-7200000,guess-3600000].filter(time=>localTime(time)===value);
  if(matches.length!==1)throw Error('Diese Uhrzeit liegt in einer Zeitumstellung. Bitte eine eindeutige Uhrzeit wählen oder den Termin in Google Kalender bearbeiten.');
  return {dateTime:new Date(matches[0]).toISOString(),timeZone:'Europe/Berlin'};
 }
 function cancel(){if(saving)return false;if(editing&&!g.confirm('Ungespeicherte Google-Terminänderungen verwerfen?'))return false;editor?.remove();editor=null;editing=false;return true;}
 function button(event,reload,beforeOpen){
  const b=node('button','Google-Termin bearbeiten');b.type='button';b.className='outline-button';
  b.onclick=()=>{if(beforeOpen&&beforeOpen()===false)return;return openEditor(event,reload);};return b;
 }
 async function openEditor(event,reload){
  if(!event?.id)return;
  if(!cancel())return;
  const version=epoch,dialog=node('dialog');editor=dialog;dialog.className='google-event-dialog';dialog.setAttribute('aria-labelledby','google-editor-title');
  const heading=node('h2','Google-Termin bearbeiten');heading.id='google-editor-title';
  const status=node('p','Google-Termin wird geladen …');status.setAttribute('role','status');
  const close=node('button','Schließen');close.type='button';close.onclick=cancel;dialog.append(heading,status,close);document.body.append(dialog);dialog.showModal();
  dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
  if(!access||access.expiresAt<=Date.now()){status.textContent='Bitte zuerst unter Kalender → Verbindung dein Google-Konto verbinden. Danach diesen Termin erneut öffnen.';return;}
  let source=null;
  try{
   if(event)source=(await api('resolve',{eventId:event.id})).event;
   if(version!==epoch||editor!==dialog)return;
   if(!['writer','owner'].includes(role))throw Error('Google erlaubt hier nur Lesezugriff. Bitte Martin um die Freigabe „Änderungen an Terminen vornehmen“ bitten.');
   if(source?.status==='cancelled')throw Error('Der Google-Termin wurde abgesagt. Bitte Kalender aktualisieren.');
   if(source?.recurrence?.length)throw Error('Eine ganze Terminserie bitte in Google Kalender bearbeiten. Einzelne Vorkommen sind hier bearbeitbar.');
   const form=node('form'),notice=node('p','Titel, Zeit, Ort und Beschreibung werden im gemeinsamen Google Kalender gespeichert. Die H₂O-Gruppenauswahl bleibt am Termin erhalten.');
   function field(caption,type,value,max){const label=node('label',caption),input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value||'';if(max)input.maxLength=max;label.append(input);form.append(label);input.oninput=()=>{editing=true;};return input;}
   const title=field('Titel','text',source?.summary,240);title.required=true;
   const allDay=field('Ganztägig','checkbox','');allDay.checked=!!source?.start?.date;
   const tomorrow=Date.now()+86400000,start=field('Beginn · Europe/Berlin','datetime-local',source?.start?.dateTime?localTime(source.start.dateTime):localTime(tomorrow)),end=field('Ende · Europe/Berlin','datetime-local',source?.end?.dateTime?localTime(source.end.dateTime):localTime(tomorrow+7200000));start.required=end.required=true;
   const endHelp=node('p','Bei ganztägigen Terminen ist das Enddatum der erste Tag nach dem Termin.');form.append(endHelp);
   const dates=()=>{start.type=end.type=allDay.checked?'date':'datetime-local';endHelp.hidden=!allDay.checked;};dates();if(allDay.checked){start.value=source.start.date;end.value=source.end.date;}
   allDay.onchange=()=>{editing=true;const a=start.value,b=end.value;dates();start.value=allDay.checked?a.slice(0,10):a+'T18:00';end.value=allDay.checked?b.slice(0,10):b+'T20:00';};
   const locationInput=field('Ort','text',source?.location,300),description=field('Beschreibung · öffentlich im Kalender','textarea',source?.description,4000);description.rows=5;
   let link=null;if(event){link=field('H₂O-Bearbeitungslink in Beschreibung aufnehmen','checkbox','');link.checked=true;}
   const save=node('button','In Google Kalender speichern');save.type='submit';save.className='primary-button';
   const discard=node('button','Abbrechen');discard.type='button';discard.onclick=cancel;
   const again=node('button','Aktuellen Google-Stand neu laden');again.type='button';again.onclick=()=>openEditor(event,reload);
   const controls=node('div');controls.className='portal-calendar-actions';controls.append(save,discard,again);form.append(controls);
   let sending=false;
   const submit=async deleting=>{
    if(sending)return;if(deleting&&!g.confirm('Diesen Termin wirklich aus Google Kalender löschen? Bestehende H₂O-Protokolle werden dadurch nicht gelöscht.'))return;
    sending=true;saving=true;for(const control of form.elements)control.disabled=true;close.disabled=true;status.textContent=deleting?'Termin wird gelöscht …':'Termin wird gespeichert …';
    try{
     let body=description.value;
     if(link?.checked){const url=new URL('index.html',location.href);url.search='';url.hash='';url.searchParams.set('editEvent',event.id);if(!body.includes(url.href))body+=(body?'\n\n':'')+'Termin in H₂O bearbeiten: '+url.href;}
     if(!deleting&&body.length>4000)throw Error('Beschreibung einschließlich Bearbeitungslink ist zu lang (höchstens 4000 Zeichen).');
     const time=(input,previous)=>previous?.dateTime&&input.value===localTime(previous.dateTime)?{dateTime:previous.dateTime,timeZone:'Europe/Berlin'}:instant(input.value);
     const value=deleting?null:{summary:title.value,location:locationInput.value,description:body,start:allDay.checked?{date:start.value}:time(start,source?.start),end:allDay.checked?{date:end.value}:time(end,source?.end)};
     await api(deleting?'delete':'update',{googleEventId:source.id,etag:source.etag,...(!deleting?{event:value}:{})});
     if(version!==epoch||editor!==dialog)return;
     editing=false;form.remove();close.disabled=false;status.textContent=deleting?'Termin in Google Kalender gelöscht.':'In Google Kalender gespeichert.';
     try{const synced=await request('list',{force:true});g.CalendarSidebar?.clear();await reload?.();if(synced.stale)throw Error('Import noch nicht bestätigt');status.textContent+=' H₂O wurde neu geladen; Änderungen aus Google können beim Import verzögert erscheinen.';}catch{status.textContent+=' Die H₂O-Anzeige konnte noch nicht aktualisiert werden. Bitte den Kalender erneut laden; die Google-Änderung ist gespeichert.';}
    }catch(e){if(version===epoch&&editor===dialog){status.textContent=e.message;for(const control of form.elements)control.disabled=false;close.disabled=false;}}
    finally{sending=false;if(version===epoch&&editor===dialog)saving=false;}
   };
   form.onsubmit=e=>{e.preventDefault();submit(false);};
   if(source){const remove=node('button','Google-Termin löschen');remove.type='button';remove.className='outline-button';remove.onclick=()=>submit(true);controls.append(remove);}
   dialog.insertBefore(notice,status);dialog.insertBefore(form,status);status.textContent='';close.textContent='Schließen';title.focus();
  }catch(e){if(version===epoch&&editor===dialog)status.textContent=e.message;}
 }
 async function mount(send){
  request=send;const version=epoch;if(!host){host=node('section');host.id='portal-google-connection';host.className='panel';document.getElementById('portal-calendar-connection')?.append(host);}
  try{config=await send('google-oauth/configuration');if(version!==epoch)return;paint();}catch(e){if(version===epoch)paint(e.message);}
 }
 g.addEventListener('beforeunload',event=>{if(editing||saving){event.preventDefault();event.returnValue='';}});
 g.GoogleCalendarAdmin={mount,clear,api,openEditor,button,dirty:()=>editing,cancel,connected:()=>!!access&&access.expiresAt>Date.now()};
})(globalThis);
