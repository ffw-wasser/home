/* Administration setup; the worker retains only a hash of the bridge credential. */
(function(g){
 'use strict';let epoch=0;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function clear(){epoch++;document.getElementById('calendar-invitations-connection')?.replaceChildren();}
 async function render(request){
  const host=document.getElementById('calendar-invitations-connection');if(!host)return;const generation=epoch,value=await request('calendar-invitations');if(generation!==epoch)return;
  host.replaceChildren();const detail=node('details'),heading=node('summary','Persönliche Kalendereinladungen'),state=node('p'),feedback=node('p');detail.className='calendar-google-help';feedback.setAttribute('role','status');
  const status=()=>{state.textContent=!value.configured?'Noch nicht eingerichtet. Mitglieder können weiterhin in H₂O antworten.':value.lastSyncAt?'Letzter erfolgreicher Abgleich: '+new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(value.lastSyncAt)+(Date.now()-value.lastSyncAt>900000?' · Bitte die Apps-Script-Ausführung prüfen.':''):'Verbindungsschlüssel eingerichtet · erster Abgleich steht noch aus.';if(value.errors)state.textContent+=' · '+value.errors+' Einladungen benötigen eine Prüfung.';if(value.pending)state.textContent+=' · '+value.pending+' Aufträge stehen noch aus.';};status();
  detail.append(heading,node('p','Neue Termine und H₂O-Auswahl bleiben im bisherigen Google-Kalender. Ein Zeittrigger erzeugt daraus private Einladungen und übernimmt die Antworten. Mitglieder bestätigen ihre persönliche Kalenderadresse selbst unter Konto & Sicherheit. Google, Apple Kalender und Outlook werden über persönliche Einladungen angesprochen.'),state);
  const guide=node('a','Einrichtung in Google Apps Script');guide.href='https://github.com/ffw-wasser/home/blob/main/docs/google-calendar-invitations/README.md';guide.target='_blank';guide.rel='noopener noreferrer';detail.append(guide);
  for(const name of ['Code.gs','appsscript.json']){const link=node('a',name+' herunterladen');link.href='docs/google-calendar-invitations/'+name;link.download=name;link.className='outline-button';detail.append(link);}
  const sourceLabel=node('label','H2O_CALENDAR_ID · bisheriger öffentlicher Feuerwehrkalender'),source=node('input');source.readOnly=true;source.value=value.sourceCalendarId||'';sourceLabel.append(source);detail.append(sourceLabel);
  const setup=node('button',value.configured?'Verbindungsschlüssel erneuern':'Einladungsanbindung einrichten');setup.type='button';setup.className='outline-button';
  const secretLabel=node('label','Verbindungsschlüssel · nur für die Skripteigenschaft H2O_INVITATION_SECRET'),secret=node('input');secret.type='password';secret.readOnly=true;secret.autocomplete='off';secretLabel.append(secret);secretLabel.hidden=true;
  const copy=node('button','Schlüssel kopieren');copy.type='button';copy.className='outline-button';copy.hidden=true;copy.onclick=async()=>{try{await navigator.clipboard.writeText(secret.value);feedback.textContent='Schlüssel kopiert. Nur in den privaten Skripteigenschaften speichern.';}catch{feedback.textContent='Kopieren nicht möglich. Schlüssel im Feld auswählen und kopieren.';}};
  setup.onclick=async()=>{if(value.configured&&!confirm('Verbindungsschlüssel erneuern? Den neuen Schlüssel danach in Apps Script eintragen. Bis dahin ist der automatische Abgleich unterbrochen.'))return;setup.disabled=true;try{const saved=await request('calendar-invitations',{enabled:true,expectedVersion:value.version});if(generation!==epoch)return;Object.assign(value,saved);secret.value=saved.secret;secretLabel.hidden=copy.hidden=false;feedback.textContent='Schlüssel einmalig angezeigt. Die Einrichtung in Apps Script abschließen; bisher wurden keine Einladungen versendet.';setup.textContent='Verbindungsschlüssel erneuern';status();}catch(e){if(generation===epoch)feedback.textContent=e.message;}finally{setup.disabled=false;}};
  detail.append(setup,secretLabel,copy,feedback);host.append(detail);
 }
 g.CalendarInvitationsAdmin={render,clear};
})(globalThis);
