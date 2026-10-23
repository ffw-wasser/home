/* Shared manual WhatsApp preparation. No delivery tracking and no background sends. */
(function(g){
 'use strict';
 const labels={open:'Ohne Rückmeldung',maybe:'Noch unsicher',yes:'Zugesagt',excused:'Entschuldigt'};
 const eligible=m=>m.eligible!==false&&['open','maybe'].includes(m.status);
 function publicLink(event){const u=new URL('termin.html',location.href);u.search='';u.hash='';u.searchParams.set('event',event.id);return u.href;}
 function details(e){const when=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',...(e.allDay?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(e.start));const clothing=e.clothing==='Einsatz'?'Einsatzkleidung':e.clothing==='Tagdienst'?'Tagesdienst':e.clothing;return '📅 '+when+(e.allDay?' · ganztägig':' Uhr')+'\n🚒 '+[e.sessionType,e.title].filter(Boolean).join(' · ')+'\n📍 '+(e.location||'GH Wasser')+(clothing?'\n👕 '+clothing:'');}
 function individual(e,m){const ask=m.status==='maybe'?'Du warst noch unsicher. Kannst du inzwischen verbindlich zu- oder absagen?':'Deine Rückmeldung fehlt noch. Bist du dabei?';return '🚒 FFW Wasser – Terminerinnerung\n\nHallo'+(m.firstName?' '+m.firstName:'')+',\n\n'+ask+'\n\n'+details(e)+'\n\n🔗 '+publicLink(e)+'\n\nDanke!';}
 function group(events){return '🚒 FFW Wasser – Kommende Termine\n\nHallo zusammen,\nbitte denkt an unsere kommenden Termine und gebt eure Rückmeldung im H2O Portal ab:\n\n'+events.map(e=>details(e)+'\n🔗 '+publicLink(e)).join('\n\n')+'\n\nVielen Dank!';}
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,primary=false)=>{const b=node('button',text);b.type='button';b.className=primary?'portal-reminder-primary':'portal-reminder-secondary';b.onclick=fn;return b;};
 let active=null;
 function close(){if(active){active.dispose();active=null;}}
 function mount(host,{eventId,request,scope,admin=false}){
  close();let alive=true,busy=false,snapshot=null,current=null,organizerId='';
  const key=()=> 'h2o-whatsapp-progress:'+scope+':'+eventId+(admin?':organizer:'+organizerId:'');
  let progress;
  function restoreProgress(){progress={done:[],excluded:[],opened:[]};try{const saved=JSON.parse(sessionStorage.getItem(key()));if(saved&&Date.now()-saved.at<86400000&&Array.isArray(saved.done)&&Array.isArray(saved.excluded))progress={...saved,opened:Array.isArray(saved.opened)?saved.opened:[]};}catch{}}
  restoreProgress();
  const save=()=>{try{sessionStorage.setItem(key(),JSON.stringify({at:Date.now(),done:progress.done,excluded:progress.excluded,opened:progress.opened}));}catch{notice.textContent='Fortschritt bleibt nur bis zum Schließen dieser Ansicht erhalten.';}};
  const root=node('section'),retry=node('div'),body=node('div'),notice=node('p');root.className='portal-reminders';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  root.append(notice,retry,body);host.replaceChildren(root);
  function dispose(){alive=false;root.remove();}
  active={dispose};
  async function run(fn){if(busy||!alive)return;busy=true;notice.textContent='';retry.replaceChildren();root.setAttribute('aria-busy','true');try{await fn();}catch(e){if(alive){if([401,403,404].includes(e.status)){current=null;body.replaceChildren();}notice.textContent=e.message||'Verbindung fehlgeschlagen.';retry.replaceChildren(button('Erneut prüfen',()=>[401,403,404].includes(e.status)?load():run(fn)));}}finally{busy=false;root.removeAttribute('aria-busy');}}
  async function fetchList(){const r=await request('whatsapp-recipients',{eventId,...(admin?{organizerMemberId:organizerId}:{})});if(!alive)return null;snapshot=r;return r;}
  function load(){return run(async()=>{if(await fetchList())paint();});}
  function paint(){
   if(!alive)return;current=null;body.replaceChildren();
   const people=snapshot.members;
   if(admin){const label=node('label','Wer fragt den Termin ab?'),picker=node('select');const placeholder=node('option','Abfragenden auswählen');placeholder.value='';picker.append(placeholder);for(const m of people){const option=node('option',m.name);option.value=m.id;picker.append(option);}picker.value=organizerId;picker.onchange=()=>{organizerId=picker.value;restoreProgress();load();};label.append(picker);body.append(label);if(!organizerId){body.append(node('p','Dein Name wird aus der Empfängerliste ausgeschlossen.'));notice.textContent='Abfragenden auswählen';return;}}
   const waiting=people.filter(eligible),available=waiting.filter(m=>m.phone&&!progress.done.includes(m.id)),missing=waiting.filter(m=>!m.phone&&!progress.done.includes(m.id)),done=people.filter(m=>progress.done.includes(m.id)),answered=people.filter(m=>!eligible(m)&&!progress.done.includes(m.id)),selected=available;
   notice.textContent=selected.length+' Person'+(selected.length===1?'':'en')+' für WhatsApp ausgewählt'+(done.length?' · '+done.length+' erledigt':'');
   if(!waiting.length){
    notice.textContent='Keine Erinnerung erforderlich.';
    body.append(node('p','Alle betroffenen Mitglieder haben bereits zugesagt oder sich entschuldigt. Es wird niemand erinnert.'));
    body.append(button('Rückmeldungen neu prüfen',load));
    return;
   }
   if(!available.length&&!missing.length){
    notice.textContent='Alle Erinnerungen bearbeitet.';
    body.append(node('p','Für diesen Termin sind aktuell keine weiteren Personen zu erinnern.'));
    body.append(button('Rückmeldungen neu prüfen',load));
    return;
   }
   function person(m){
    const row=node('div');row.className='portal-reminder-person';
    const identity=node('div'),name=node('strong',m.name),status=node('small',labels[m.status]);identity.className='portal-reminder-identity';
    const description=node('span');description.append(name,status);identity.append(description);row.append(identity);
    if(eligible(m)&&!progress.done.includes(m.id)){
     row.append(button(progress.opened.includes(m.id)?'Erneut öffnen':'Nachricht ansehen',()=>prepare(m.id)));
     if(progress.opened.includes(m.id))row.append(button('Erledigt',()=>mark(m.id)));
    }
    return row;
   }
   body.append(node('h4','Empfänger'));
   if(!available.length)body.append(node('p','Für die noch offenen Rückmeldungen ist derzeit keine freigegebene WhatsApp-Nummer verfügbar. Mitgliedschaft allein reicht nicht aus.'));
   for(const m of available)body.append(person(m));
   const next=selected.find(m=>!progress.opened.includes(m.id));
   if(next&&available.length>1)body.append(button('Nächste Nachricht ansehen',()=>prepare(next.id),true));
   if(selected.some(m=>progress.opened.includes(m.id)))body.append(node('p','Geöffnete Chats bitte selbst auf Versand prüfen.'));
   function folder(title,subset,hint){if(!subset.length)return;const box=node('details');box.className='portal-reminder-folder';box.append(node('summary',title+' ('+subset.length+')'));if(hint)box.append(node('p',hint));for(const m of subset)box.append(person(m));body.append(box);return box;}
   const missingBox=folder('Ohne WhatsApp-Kontakt',missing,'Die Nummer fehlt, ist ungültig oder nicht für Erinnerungen freigegeben. Das Mitglied kann die Nummer unter Konto & Sicherheit selbst eintragen.');if(missingBox&&!available.length)missingBox.open=true;
   folder('Keine Erinnerung nötig',answered,'Diese Personen haben bereits zugesagt oder sich entschuldigt.');
   folder('Von dir erledigt',done,'Von dir als erledigt markiert. Das Portal kann nicht prüfen, ob eine Nachricht gesendet wurde.');
   const tools=node('div');tools.className='portal-reminder-tools';tools.append(button('Rückmeldungen neu laden',load));
   if(progress.done.length||progress.opened.length)tools.append(button('Erinnerungsliste zurücksetzen',()=>{if(!confirm('Deine Markierungen löschen? Bereits bearbeitete Personen können danach erneut erinnert werden.'))return;progress={done:[],excluded:[],opened:[]};save();load();}));body.append(tools);
  }
  function mark(id){if(busy||!alive)return;if(!progress.done.includes(id))progress.done.push(id);save();load();}
  function prepare(id){return run(async()=>{const r=await fetchList();if(!r)return;const m=r.members.find(p=>p.id===id);if(!m||!eligible(m)||progress.done.includes(id)){paint();notice.textContent='Für diese Person ist keine weitere Erinnerung nötig.';return;}current={id,event:r.event};notice.textContent='';body.replaceChildren();const text=node('textarea');text.rows=8;text.value=individual(r.event,m);text.setAttribute('aria-label','Nachricht bearbeiten');const hint=node('p');hint.setAttribute('role','status');
    const verify=async action=>{await run(async()=>{const fresh=await request('whatsapp-prepare',{eventId,memberId:id,...(admin?{organizerMemberId:organizerId}:{})});if(!alive)return;if(!fresh.eligible){await fetchList();paint();notice.textContent='Rückmeldung geändert. Keine Erinnerung mehr vorgesehen.';return;}if(JSON.stringify(fresh.event)!==JSON.stringify(current.event)){await fetchList();paint();notice.textContent='Termindaten geändert. Bitte Nachricht neu vorbereiten.';return;}if(action==='chat'&&!fresh.phone)throw Error('Die WhatsApp-Nummer ist nicht mehr verfügbar. Bitte „Text kopieren“ wählen.');
     // Navigation in the same tab needs no popup permission after asynchronous validation.
     if(action==='chat'){if(progress.opened.includes(id)&&!confirm('Diese Nachricht wurde bereits geöffnet. Erneut öffnen?'))return;if(!progress.opened.includes(id))progress.opened.push(id);save();location.assign('https://wa.me/'+fresh.phone+'?text='+encodeURIComponent(text.value));hint.textContent='In WhatsApp senden, danach hier „Erledigt“ wählen.';}
     else {
      let copied=false;
      try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text.value);copied=true;}else{prompt('Nachricht kopieren',text.value);}}catch{prompt('Nachricht kopieren',text.value);}
      if(!alive)return;
      hint.textContent=copied?'Text kopiert. Nach dem Senden „Erledigt“ wählen.':'Text auswählen, kopieren und selbst senden.';
     }
    });};
    const instruction=node('p',m.phone?'Du sendest die Nachricht in WhatsApp selbst.':'Text kopieren und selbst senden.');const label=node('label','Deine Nachricht');label.append(text);const finish=node('div');finish.className='portal-reminder-finish';finish.append(node('p','Bereits gesendet?'),button('Erledigt',()=>mark(id)));body.append(node('h4','Nachricht an '+m.name),instruction,label,button(m.phone?'WhatsApp öffnen':'Text kopieren',()=>verify(m.phone?'chat':'text'),true),...(m.phone?[button('Text kopieren',()=>verify('text'))]:[]),hint,finish,button('Zurück zur Auswahl',load));
  });}
  load();return {dispose};
 }
 g.H2OReminders={mount,close,eligible,individual,group};
})(globalThis);
