/* Shared manual WhatsApp preparation. No delivery tracking and no background sends. */
(function(g){
 'use strict';
 const labels={open:'Ohne Rückmeldung',maybe:'Noch unsicher',yes:'Zugesagt',excused:'Entschuldigt'};
 const eligible=m=>['open','maybe'].includes(m.status);
 function publicLink(event){const u=new URL('termin.html',location.href);u.search='';u.hash='';u.searchParams.set('event',event.id);return u.href;}
 function details(e){const when=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',...(e.allDay?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(e.start));const clothing=e.clothing==='Einsatz'?'Einsatzkleidung':e.clothing==='Tagdienst'?'Tagesdienst':e.clothing;return '📅 '+when+(e.allDay?' · ganztägig':' Uhr')+'\n🚒 '+[e.sessionType,e.title].filter(Boolean).join(' · ')+'\n📍 '+(e.location||'GH Wasser')+(clothing?'\n👕 '+clothing:'');}
 function individual(e,m){return '🚒 FFW Wasser – Terminerinnerung\n\nHallo'+(m.firstName?' '+m.firstName:'')+',\n\nfür folgenden Termin fehlt uns noch deine verbindliche Rückmeldung:\n\n'+details(e)+'\n\nBitte teile uns über das H2O Portal mit, ob du teilnehmen kannst.\n\n🔗 '+publicLink(e)+'\n\nVielen Dank!';}
 function group(events){return '🚒 FFW Wasser – Kommende Termine\n\nHallo zusammen,\nbitte denkt an unsere kommenden Termine und gebt eure Rückmeldung im H2O Portal ab:\n\n'+events.map(e=>details(e)+'\n🔗 '+publicLink(e)).join('\n\n')+'\n\nVielen Dank!';}
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,primary=false)=>{const b=node('button',text);b.type='button';b.className=primary?'portal-reminder-primary':'portal-reminder-secondary';b.onclick=fn;return b;};
 let active=null;
 function close(){if(active){active.dispose();active=null;}}
 function mount(host,{eventId,request,scope,admin=false}){
  close();let alive=true,busy=false,snapshot=null,current=null,mode='individual';
  const key='h2o-whatsapp-progress:'+scope+':'+eventId;
  let progress={done:[],excluded:[],opened:[]};try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved&&Date.now()-saved.at<86400000&&Array.isArray(saved.done)&&Array.isArray(saved.excluded))progress={...saved,opened:Array.isArray(saved.opened)?saved.opened:[]};}catch{}
  const save=()=>{try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),done:progress.done,excluded:progress.excluded,opened:progress.opened}));}catch{notice.textContent='Fortschritt bleibt nur bis zum Schließen dieser Ansicht erhalten.';}};
  const root=node('section'),nav=node('div'),body=node('div'),notice=node('p');root.className='portal-reminders';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const single=button('Einzeln erinnern',()=>{mode='individual';load();}),groups=button('Gruppeninfo',()=>{mode='group';loadGroups();});single.className='';groups.className='';single.setAttribute('aria-pressed','true');groups.setAttribute('aria-pressed','false');nav.className='portal-reminder-actions';nav.append(single,groups);nav.setAttribute('aria-label','Art der WhatsApp-Erinnerung');root.append(nav,notice,body);host.replaceChildren(root);
  function dispose(){alive=false;root.remove();}
  active={dispose};
  async function run(fn){if(busy||!alive)return;busy=true;root.setAttribute('aria-busy','true');try{await fn();}catch(e){if(alive){current=null;body.replaceChildren();notice.textContent=e.message;body.append(button('Erneut prüfen',()=>mode==='group'?loadGroups():load()));}}finally{busy=false;root.removeAttribute('aria-busy');}}
  async function fetchList(){const r=await request('whatsapp-recipients',{eventId});if(!alive)return null;snapshot=r;return r;}
  function load(){single.setAttribute('aria-pressed','true');groups.setAttribute('aria-pressed','false');return run(async()=>{if(await fetchList())paint();});}
  function paint(){
   if(!alive)return;current=null;body.replaceChildren();
   const people=snapshot.members,waiting=people.filter(eligible),available=waiting.filter(m=>m.phone&&!progress.done.includes(m.id)),missing=waiting.filter(m=>!m.phone&&!progress.done.includes(m.id)),done=people.filter(m=>progress.done.includes(m.id)),answered=people.filter(m=>!eligible(m)&&!progress.done.includes(m.id)),selected=available.filter(m=>!progress.excluded.includes(m.id));
   notice.textContent=selected.length+' Person'+(selected.length===1?'':'en')+' für WhatsApp ausgewählt'+(done.length?' · '+done.length+' erledigt':'');
   body.append(node('p','Ausgewählt sind Eingeladene ohne feste Rückmeldung. Wer zugesagt oder sich entschuldigt hat, wird nicht erinnert.'));
   function person(m,selectable=false){
    const row=node('div');row.className='portal-reminder-person';
    const identity=node(selectable?'label':'div'),name=node('strong',m.name),status=node('small',labels[m.status]);identity.className='portal-reminder-identity';
    if(selectable){const check=node('input');check.type='checkbox';check.checked=!progress.excluded.includes(m.id);check.setAttribute('aria-label',m.name+' auswählen');check.onchange=()=>{progress.excluded=progress.excluded.filter(id=>id!==m.id);if(!check.checked)progress.excluded.push(m.id);save();paint();};identity.append(check);}
    const description=node('span');description.append(name,status);identity.append(description);row.append(identity);
    if(eligible(m)&&!progress.done.includes(m.id)){
     row.append(button(progress.opened.includes(m.id)?'Weiter bearbeiten':'Nachricht ansehen',()=>prepare(m.id)));
     if(progress.opened.includes(m.id))row.append(button('Als erledigt markieren',()=>mark(m.id)));
    }
    if(admin)row.append(button('Nummer bearbeiten',()=>contact(m)));
    return row;
   }
   body.append(node('h4','Wen möchtest du erinnern?'));
   if(!available.length)body.append(node('p','Keine offenen Personen mit WhatsApp-Nummer.'));
   for(const m of available)body.append(person(m,true));
   const next=selected.find(m=>!progress.opened.includes(m.id));
   if(next&&available.length>1)body.append(button('Nächste Nachricht ansehen',()=>prepare(next.id),true));
   if(selected.some(m=>progress.opened.includes(m.id)))body.append(node('p','Schon geöffnete Nachrichten findest du unter „Weiter bearbeiten“. Bitte prüfe selbst, ob du sie gesendet hast.'));
   function folder(title,subset,hint){if(!subset.length)return;const box=node('details');box.className='portal-reminder-folder';box.append(node('summary',title+' ('+subset.length+')'));if(hint)box.append(node('p',hint));for(const m of subset)box.append(person(m));body.append(box);return box;}
   const missingBox=folder('Ohne WhatsApp-Nummer',missing,'Hier fehlt eine für WhatsApp freigegebene Nummer. Du kannst den Nachrichtentext trotzdem kopieren und selbst weitergeben.');if(missingBox&&!available.length)missingBox.open=true;
   folder('Keine Erinnerung nötig',answered,'Diese Personen haben bereits zugesagt oder sich entschuldigt.');
   folder('Von dir erledigt',done,'Von dir als erledigt markiert. Das Portal kann nicht prüfen, ob eine Nachricht gesendet wurde.');
   const tools=node('div');tools.className='portal-reminder-tools';tools.append(button('Rückmeldungen neu laden',load));
   if(progress.done.length||progress.opened.length)tools.append(button('Erinnerungsliste zurücksetzen',()=>{if(!confirm('Deine Markierungen löschen? Bereits bearbeitete Personen können danach erneut erinnert werden.'))return;progress={done:[],excluded:[],opened:[]};save();load();}));body.append(tools);
  }
  function mark(id){if(!progress.done.includes(id))progress.done.push(id);save();load();}
  function contact(m){body.replaceChildren();const label=node('label','WhatsApp-Nummer (international, z. B. +49 …)'),input=node('input');input.type='tel';input.autocomplete='off';input.value=m.contactPhone||'';label.append(input);const consent=node('label'),check=node('input');check.type='checkbox';check.checked=m.allowed===true;consent.append(check,node('span','Einwilligung oder zulässige Grundlage für persönliche WhatsApp-Erinnerungen ist dokumentiert.'));body.append(node('h4','WhatsApp-Nummer für '+m.name),label,consent,button('Nummer speichern',()=>run(async()=>{await request('whatsapp-contact',{eventId,memberId:m.id,phone:input.value,allowed:check.checked});if(await fetchList())paint();})),button('Zurück',paint));}
  function prepare(id){return run(async()=>{const r=await fetchList();if(!r)return;const m=r.members.find(p=>p.id===id);if(!m||!eligible(m)||progress.done.includes(id)){paint();notice.textContent='Für diese Person ist keine weitere Erinnerung nötig.';return;}current={id,event:r.event};notice.textContent='';body.replaceChildren();const text=node('textarea');text.rows=8;text.value=individual(r.event,m);text.setAttribute('aria-label','Nachricht bearbeiten');const hint=node('p');hint.setAttribute('role','status');
    const verify=async action=>{await run(async()=>{const fresh=await request('whatsapp-prepare',{eventId,memberId:id});if(!alive)return;if(!fresh.eligible){await fetchList();paint();notice.textContent='Rückmeldung geändert. Keine Erinnerung mehr vorgesehen.';return;}if(JSON.stringify(fresh.event)!==JSON.stringify(current.event)){await fetchList();paint();notice.textContent='Termindaten geändert. Bitte Nachricht neu vorbereiten.';return;}if(action==='chat'&&!fresh.phone)throw Error('Die WhatsApp-Nummer ist nicht mehr verfügbar. Bitte zurück zur Liste gehen und den Text kopieren.');
     // Navigation in the same tab needs no popup permission after asynchronous validation.
     if(action==='chat'){if(progress.opened.includes(id)&&!confirm('Diese Nachricht wurde bereits geöffnet. Erneut öffnen?'))return;if(!progress.opened.includes(id))progress.opened.push(id);save();location.assign('https://wa.me/'+fresh.phone+'?text='+encodeURIComponent(text.value));hint.textContent='Sende die Nachricht in WhatsApp. Kehre danach hierher zurück und markiere die Person als erledigt.';}
     else {try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text.value);else prompt('Nachricht kopieren',text.value);if(!progress.opened.includes(id))progress.opened.push(id);save();hint.textContent='Füge den Text in den gewünschten Chat ein und sende ihn dort. Markiere die Person danach hier als erledigt.';}catch{prompt('Nachricht kopieren',text.value);hint.textContent='Kopiere den Text aus dem Textfeld und sende ihn selbst weiter.';}}
    });};
    const instruction=node('p',m.phone?'Prüfe den Text und öffne WhatsApp. Dort sendest du die Nachricht selbst. Danach kommst du hierher zurück.':'Prüfe den Text, kopiere ihn und sende ihn selbst an die Person.');const label=node('label','Deine Nachricht');label.append(text);const finish=node('div');finish.className='portal-reminder-finish';finish.append(node('p','Nach dem Senden kannst du die Person hier für dich als erledigt markieren. Das Portal erhält keine Versandbestätigung.'),button('Als erledigt markieren',()=>mark(id)));body.append(node('h4','Nachricht an '+m.name),instruction,label,button(m.phone?'WhatsApp öffnen':'Text kopieren',()=>verify(m.phone?'chat':'text'),true),hint,finish,button('Zurück zur Auswahl',load));
  });}
  function loadGroups(){
   single.setAttribute('aria-pressed','false');groups.setAttribute('aria-pressed','true');
   return run(async()=>{
    const r=await request('whatsapp-events',{});if(!alive)return;body.replaceChildren();
    const selected=new Set(r.events.filter(e=>!e.audienceRestricted&&e.id===eventId).map(e=>e.id)),text=node('textarea');text.rows=8;text.setAttribute('aria-label','Gruppeninfo bearbeiten');
    const regenerate=()=>{text.value=group(r.events.filter(e=>selected.has(e.id)));notice.textContent=selected.size+' Termin'+(selected.size===1?'':'e')+' ausgewählt';};
    body.append(node('p','Eine allgemeine Nachricht für deine WhatsApp-Gruppe. Namen und persönliche Rückmeldungen werden nicht eingefügt.'),node('h4','1. Termine auswählen'));
    if(!r.events.length)body.append(node('p','Zurzeit gibt es keine kommenden freigegebenen Termine.'));
    for(const e of r.events){
     const label=node('label'),check=node('input'),description=node('span');label.className='portal-reminder-event';check.type='checkbox';check.checked=selected.has(e.id);
     check.onchange=()=>{if(check.checked&&e.audienceRestricted&&!confirm('Dieser Termin betrifft nur ausgewählte Mitglieder. In deiner WhatsApp-Gruppe könnten auch andere Personen mitlesen. Trotzdem in die Gruppeninfo aufnehmen?')){check.checked=false;return;}if(check.checked)selected.add(e.id);else selected.delete(e.id);regenerate();};
     description.append(node('strong',e.title),node('small',details(e).split('\n')[0]));if(e.audienceRestricted)description.append(node('small','Nur für ausgewählte Mitglieder'));label.append(check,description);body.append(label);
    }
    regenerate();const label=node('label','2. Nachricht prüfen und bei Bedarf ändern');label.append(text);
    body.append(label,node('p','3. Teile die Nachricht. Wähle im Teilen-Menü WhatsApp und anschließend deine Gruppe.'),button('Gruppeninfo teilen',async()=>{
     if(!selected.size){notice.textContent='Wähle zuerst mindestens einen Termin aus.';return;}
     try{if(navigator.share){await navigator.share({title:'FFW Wasser – Termine',text:text.value});notice.textContent='Teilen-Menü geschlossen. Bitte prüfe in WhatsApp, ob du die Nachricht gesendet hast.';}else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text.value);notice.textContent='Text kopiert. Öffne deine WhatsApp-Gruppe, füge ihn ein und sende ihn dort.';}else{prompt('Gruppeninfo kopieren',text.value);notice.textContent='Kopiere den Text und sende ihn selbst an deine WhatsApp-Gruppe.';}}
     catch(e){if(e.name!=='AbortError')notice.textContent='Das Teilen hat nicht funktioniert. Kopiere den Text aus dem Nachrichtenfeld und öffne WhatsApp selbst.';}
    },true));
   });
  }
  load();return {dispose};
 }
 g.H2OReminders={mount,close,eligible,individual,group};
})(globalThis);
