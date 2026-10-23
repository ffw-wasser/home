/* Birthday bonus policy lives on the shared loyalty settings page. */
(function(g){
 'use strict';const VIEW='settingsRewardsView',$=id=>document.getElementById('birthday-settings-'+id);let policy=null,loaded=false,busy=false,dirty=false,pending=null,generation=0;
 function admin(){if(!requireAdmin(VIEW))throw Error('Bitte die Verwaltung entsperren.');if(typeof oneDriveAdministrationReady==='function'&&!oneDriveAdministrationReady())throw Error('Bitte den Datenordner verbinden und erfolgreich synchronisieren.');}
 async function connection(){admin();const c=await g.DrinksCentral.connection();admin();if(!c)throw Error('Bitte zuerst den Kontodienst verbinden.');if(g.DrinksStore.sourceKey()!==c.source)throw Error('Der Datenordner wurde gewechselt. Bitte neu laden.');return c;}
 function verify(c){admin();if(g.DrinksStore.sourceKey()!==c.source)throw Error('Der Datenordner wurde gewechselt. Bitte neu laden.');}
 function valid(p){if(p&&(!Number.isSafeInteger(p.awardUnits)||p.awardUnits<150||p.awardUnits>15000||p.awardUnits%150))throw Error('Der gespeicherte Geburtstagsbonus ist nicht gültig.');return p;}
 function controls(){if(!$('save'))return;$('points').disabled=busy||Boolean(pending)||!loaded;$('save').disabled=busy||Boolean(pending)||!loaded;$('retry').hidden=!pending;$('retry').disabled=busy;$('reload').disabled=busy;}
 async function load(force=false){if(busy)return;try{admin();}catch{return;}if(pending)return save();if(dirty&&!force)return;if(dirty&&!confirm('Ungespeicherte Geburtstagspunkte verwerfen und neu laden?'))return;const number=++generation;busy=true;loaded=false;controls();$('status').textContent='Geburtstagsbonus wird geladen …';try{const c=await connection(),result=await g.DrinksPush.request(c,'/admin/portal/birthday-status',{source:c.source});if(number!==generation)return;verify(c);policy=valid(result.birthdayPolicy||null);loaded=true;dirty=false;$('points').value=policy?String(policy.awardUnits/150):'';$('status').textContent=policy?policy.awardUnits/150+' Treuepunkte pro Geburtstag gespeichert.':'Bitte die Treuepunkte pro Geburtstag festlegen.';}catch(e){if(number===generation)$('status').textContent=e.message;}finally{if(number===generation){busy=false;controls();}}}
 async function save(){if(busy)return;try{admin();}catch{return;}if(!loaded&&!pending)return;const number=++generation;busy=true;controls();$('status').textContent='Geburtstagsbonus wird gespeichert …';try{const c=await connection();if(!pending){const raw=$('points').value.trim();if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>100)throw Error('Bitte 1 bis 100 ganze Treuepunkte eingeben.');pending={origin:c.origin,source:c.source,revision:crypto.randomUUID(),expectedRevision:policy?.revision||null,awardUnits:Number(raw)*150};}if(c.origin!==pending.origin||c.source!==pending.source)throw Error('Bitte die ursprüngliche Kontodienst- und Datenordner-Verbindung wiederherstellen.');const result=await g.DrinksPush.request(c,'/admin/portal/birthday-policy',pending);if(number!==generation)return;verify(c);const next=valid(result.birthdayPolicy);if(!next||next.revision!==pending.revision)throw Error('Die Speicherung ist noch nicht bestätigt. Bitte erneut prüfen.');policy=next;pending=null;dirty=false;loaded=true;$('points').value=String(policy.awardUnits/150);$('status').textContent=policy.awardUnits/150+' Treuepunkte gespeichert. Gilt für zukünftige Geburtstagsgutschriften. Bereits vergebene Boni bleiben erhalten.';}catch(e){if(number===generation){if([400,401,403,404,409].includes(e.status)){pending=null;loaded=false;}$('status').textContent=e.message+(pending?' Dieselbe Speicherung erneut prüfen.':'');}}finally{if(number===generation){busy=false;controls();}}}
 function beforeView(id){if(assignmentsSaving){showToast("Bitte die Speicherung der Geburtstagszuordnung abwarten.","error");return false;}if(id!==VIEW&&id!=="adminLoginView"&&assignmentsDirty&&!confirm("Ungespeicherte Geburtstagszuordnung verwerfen?"))return false;if(id===VIEW||id==='adminLoginView')return true;if(busy||pending){showToast('Bitte die Speicherung des Geburtstagsbonus abwarten oder erneut prüfen.','error');return false;}if(dirty&&!confirm('Ungespeicherte Geburtstagspunkte verwerfen?'))return false;dirty=false;assignmentDrafts.clear();assignmentsDirty=false;return true;}
 function lock(){assignmentsEpoch++;assignmentsDirty=false;assignmentsSaving=false;assignmentDrafts.clear();document.getElementById("birthday-assignments-list")?.replaceChildren();generation++;busy=false;loaded=false;dirty=false;policy=null;if($('points'))$('points').value='';if($('status'))$('status').textContent='Zum Öffnen die Verwaltung entsperren.';controls();}
 function init(){const view=document.getElementById(VIEW);if(!view)return;const section=document.createElement('article');section.className='panel ux-bonus-settings';section.id='birthday-rewards-settings';section.innerHTML='<h3>Treuepunkte zum Geburtstag</h3><p>Ein zugeordneter Geburtstag aus dem Kalender vergibt einmal pro Mitglied und Kalenderjahr den hier eingestellten Bonus. Standard: 1 Treuepunkt.</p><label for="birthday-settings-points">Treuepunkte pro Geburtstag</label><input id="birthday-settings-points" class="text-input" type="number" min="1" max="100" step="1" inputmode="numeric" disabled><p class="help-text">1 bis 100 ganze Punkte. Änderungen gelten für zukünftige Gutschriften. Bereits vergebene Geburtstagsboni bleiben erhalten und werden nicht erneut gebucht.</p><div class="ux-dialog-actions"><button id="birthday-settings-save" class="primary-button" type="button" disabled>Geburtstagspunkte speichern</button><button id="birthday-settings-reload" class="outline-button" type="button">Erneut laden</button><button id="birthday-settings-retry" class="outline-button" type="button" hidden>Speicherung erneut prüfen</button></div><p id="birthday-settings-status" role="status" aria-live="polite"></p>';view.append(section);$('save').onclick=save;$('reload').onclick=()=>load(true);$('retry').onclick=save;$('points').oninput=()=>{dirty=true;$('status').textContent='Geburtstagspunkte noch nicht gespeichert.';};g.addEventListener('beforeunload',event=>{if(dirty||busy||pending){event.preventDefault();event.returnValue='';}});controls();}
 let assignmentsEpoch=0,assignmentsDirty=false,assignmentsSaving=false;
 const assignmentDrafts=new Map();
 async function loadAssignments({preserveDrafts=false}={}){
  if(assignmentsSaving)return;
  if(!preserveDrafts&&assignmentsDirty&&!confirm('Ungespeicherte Geburtstagszuordnung verwerfen?'))return;
  if(!preserveDrafts){assignmentDrafts.clear();assignmentsDirty=false;}
  const epoch=++assignmentsEpoch,host=document.getElementById('birthday-assignments-list'),status=document.getElementById('birthday-assignments-status');
  host.replaceChildren();status.textContent='Geburtstagszuordnungen werden geladen …';
  try{
   const c=await connection(),cal=await g.DrinksPush.request(c,'/admin/portal/list',{source:c.source}),state=await g.oneDriveReadState();
   if(epoch!==assignmentsEpoch)return;verify(c);
   const seen=new Set();let count=0;
   for(const event of cal.events.filter(e=>e.kind==='birthday')){
    const key=event.seriesId||event.id;if(seen.has(key))continue;seen.add(key);count++;
    const row=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),save=document.createElement('button');row.className='birthday-assignment';
    label.textContent=event.title+' · '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit'}).format(new Date(event.start));
    select.className='text-input';select.setAttribute('aria-label','Mitglied für '+event.title);
    for(const person of [{id:'',firstName:'Keine Zuordnung',lastName:''},...(state.members||[])]){
     const option=document.createElement('option');option.value=String(person.id);option.textContent=[person.lastName,person.firstName].filter(Boolean).join(' ');select.append(option);
    }
    select.value=assignmentDrafts.has(key)?assignmentDrafts.get(key):event.memberId||'';
    select.onchange=()=>{
     if(select.value===(event.memberId||''))assignmentDrafts.delete(key);else assignmentDrafts.set(key,select.value);
     assignmentsDirty=assignmentDrafts.size>0;status.textContent=assignmentsDirty?'Geburtstagszuordnung noch nicht gespeichert.':'Alle angezeigten Zuordnungen sind gespeichert.';
    };
    save.type='button';save.textContent='Zuordnung speichern';save.className='outline-button';save.disabled=cal.stale===true;
    save.onclick=async()=>{
     if(assignmentsSaving)return;
     assignmentsSaving=true;save.disabled=true;select.disabled=true;const memberId=select.value||null;
     try{
      verify(c);
      const result=await g.DrinksPush.request(c,'/admin/portal/classify',{source:c.source,eventId:event.id,kind:'birthday',approved:false,memberId,expectedVersion:cal.rulesVersion});
      if(epoch!==assignmentsEpoch)return;verify(c);
      if(result.version!==cal.rulesVersion+1)throw Error('Speicherung nicht bestätigt. Bitte neu laden und prüfen.');
      const confirmed=await g.DrinksPush.request(c,'/admin/portal/list',{source:c.source});
      if(epoch!==assignmentsEpoch)return;verify(c);
      if(confirmed.rulesVersion!==result.version||confirmed.events.find(e=>e.id===event.id)?.memberId!==memberId)throw Error('Zuordnung wurde nicht bestätigt. Bitte neu laden und prüfen.');
      assignmentDrafts.delete(key);assignmentsDirty=assignmentDrafts.size>0;assignmentsSaving=false;
      await loadAssignments({preserveDrafts:true});
      status.textContent='Zuordnung gespeichert. Bestehende Jahresgutschriften bleiben erhalten.'+(assignmentsDirty?' Weitere Zuordnungen sind noch nicht gespeichert.':'');
     }catch(e){if(epoch===assignmentsEpoch)status.textContent=e.message;}
     finally{if(epoch===assignmentsEpoch){assignmentsSaving=false;save.disabled=cal.stale===true;select.disabled=false;}}
    };
    label.append(select);row.append(label,save);host.append(row);
   }
   status.textContent=assignmentsDirty?'Weitere Zuordnungen sind noch nicht gespeichert.':count?'Zuordnung gilt für die Geburtstagsserie. Keine Terminaktionen.':'Keine Geburtstage im aktuellen Kalenderzeitraum gefunden.';
  }catch(e){if(epoch===assignmentsEpoch)status.textContent=e.message;}
 }
 function initAssignments(){
  const page=document.getElementById(VIEW);if(!page)return;
  const box=document.createElement('article');box.className='panel';box.innerHTML='<h3>Geburtstage zuordnen</h3><p>Für Jahresplan und einmalige Treuepunktegutschrift. Die Google-Kalenderquelle bleibt bestehen.</p><button class="outline-button" type="button" id="birthday-assignments-load">Zuordnungen laden</button><p id="birthday-assignments-status" role="status" aria-live="polite"></p><div id="birthday-assignments-list"></div>';
  page.append(box);document.getElementById('birthday-assignments-load').onclick=()=>loadAssignments();
  g.addEventListener('beforeunload',e=>{if(assignmentsDirty||assignmentsSaving){e.preventDefault();e.returnValue='';}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAssignments,{once:true});else initAssignments();
 g.DrinksBirthdaySettings={load,save,beforeView,lock};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
