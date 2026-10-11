"use strict";
(function(){
  const esc=value=>typeof escapeHtml==="function"?escapeHtml(value):String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function ensureSmartDialog(){let d=document.getElementById("smartCompletionDialog");if(d)return d;d=document.createElement("dialog");d.id="smartCompletionDialog";d.className="smart-completion-dialog";d.innerHTML='<div class="smart-completion-shell"><header><div><small>Abschlussprüfung</small><h2>Angaben prüfen</h2></div><button type="button" data-smart-cancel aria-label="Schließen">×</button></header><div class="smart-completion-body" data-smart-body></div><footer><button type="button" class="outline-button" data-smart-cancel>Zurück und bearbeiten</button><button type="button" class="primary-button" data-smart-confirm>Geprüft, fortfahren</button></footer></div>';document.body.appendChild(d);return d;}
  function askSmartConfirmation(title,rows,issues=[],details={}){const d=ensureSmartDialog();d.querySelector("h2").textContent=title;d.querySelector("[data-smart-body]").innerHTML=`<div class="smart-summary-grid">${rows.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value||"–")}</strong></div>`).join("")}</div>${details.people?.length?`<section class="smart-issues"><h3>Diese Personen werden als „Fehlt“ exportiert</h3><ul>${details.people.map(name=>`<li>${esc(name)}</li>`).join("")}</ul><p>Über „Zurück und bearbeiten“ kannst du ihre Anwesenheit noch erfassen.</p></section>`:""}${issues.length?`<section class="smart-issues"><h3>Hinweise</h3>${issues.map(x=>`<p>${esc(x)}</p>`).join("")}</section>`:'<p class="smart-ready">✓ Alle wesentlichen Angaben sind vollständig.</p>'}`;return new Promise(resolve=>{const done=value=>{d.close();resolve(value)};d.querySelectorAll("[data-smart-cancel]").forEach(b=>b.onclick=()=>done(false));const body=d.querySelector("[data-smart-body]");if(details.actions?.length){const actions=document.createElement("div");actions.className="workflow-actions";for(const action of details.actions){const button=document.createElement("button");button.type="button";button.className="outline-button";button.textContent=action.label;button.onclick=()=>{done(false);setTimeout(action.run,0);};actions.append(button);}body.append(actions);}d.querySelector("[data-smart-confirm]").onclick=()=>done(true);d.oncancel=e=>{e.preventDefault();done(false)};d.showModal();});}
  window.smartConfirmOperation=async function(d,check){const vehicles=[...new Set(Object.values(d.assignments||{}).filter(v=>String(v).includes("EM 5/")))];const docs=typeof pendingDocumentReport!=="undefined"?pendingDocumentReport?.pageCount||0:0;return askSmartConfirmation("Einsatz abschließen",[["Datum",d.date],["Einsatz",[d.type,d.location].filter(Boolean).join(" · ")],["Teilnehmende",String((d.members||[]).length)],["Fahrzeuge",vehicles.join(", ")||"nur Reserve"],["Dokumentseiten",String(docs)],["Paketname",`FFW-Wasser_${d.date}_${String(d.times?.alarm||"").replace(":","-")}_Einsatz.zip`]],check?.warnings||[],{actions:[{label:"Einsatzangaben bearbeiten",run:()=>{showView("attendanceView");openOperationReportForm();const field=byId(!d.type?"opType":!d.location?"opLocation":"opType");field?.closest("fieldset")?.classList.remove("smart-collapsed");field?.focus();}}]});};
  function enhanceOperationForm(){const form=document.getElementById("operationReportForm");if(!form||form.dataset.smartEnhanced)return;form.dataset.smartEnhanced="1";const quick=(id,values)=>{const input=document.getElementById(id);if(!input||input.parentElement.querySelector(".smart-quick-values"))return;const box=document.createElement("div");box.className="smart-quick-values";box.innerHTML=values.map(v=>`<button type="button">${esc(v)}</button>`).join("");box.onclick=e=>{const b=e.target.closest("button");if(b){input.value=b.textContent;input.dispatchEvent(new Event("input",{bubbles:true}));}};input.insertAdjacentElement("afterend",box);};quick("opType",["Brand","Technische Hilfe","BMA","Ölspur"]);quick("opWaterSources",["Hydrant","offenes Gewässer","kein Löschwasser"]);quick("opAlarmMethods",["Digitalmelder","Sirene","Telefon"]);}
  function qualityData(){
    const data=Array.isArray(csvArchive)?csvArchive:[],issues=[];
    data.forEach((item,index)=>{
      const label=item.fileName||item.topic||`Archiveintrag ${index+1}`;
      if(item.sessionType==="Einsatz"){
        const d=item.operationData;
        if(!d){issues.push({type:"Einsatz",label,message:"Keine strukturierten Einsatzdaten vorhanden."});return;}
        if(!d.type)issues.push({type:"Einsatz",label,message:"Einsatzart fehlt."});
        if(!d.location)issues.push({type:"Einsatz",label,message:"Einsatzstelle fehlt."});
        if(!d.times?.alarm||!d.times?.ended)issues.push({type:"Einsatz",label,message:"Alarm- oder Einsatzendzeit fehlt."});
        if(!Array.isArray(d.members)||!d.members.length)issues.push({type:"Einsatz",label,message:"Keine Einsatzkräfte hinterlegt."});
        const assigned=Object.keys(d.assignments||{}).length,roles=Object.keys(d.assignmentRoles||{}).length;
        if((d.members?.length||0)>assigned||(d.members?.length||0)>roles)issues.push({type:"Einsatz",label,message:"Fahrzeug- oder Funktionszuordnung ist unvollständig."});
      }else{
        if(!String(item.topic||"").trim())issues.push({type:"Termin",label,message:"Thema fehlt."});
        const rows=Array.isArray(item.rows)?item.rows:[];
        const qualityType=String(item.sessionType||rows[0]?.sessionType||"").trim().toLowerCase().replace(/\s+/g," ");
        const participantDataRequired=qualityType==="allgemeine probe"||qualityType==="einsatz";
        if(participantDataRequired&&!rows.length&&!String(item.csvContent||"").trim())issues.push({type:"Termin",label,message:"Keine auswertbaren Teilnehmerdaten vorhanden."});
      }
    });
    return issues;
  }
  function renderQualityPanel(panel,issues){
    const signature=JSON.stringify([csvArchive.length,issues.map(item=>[item.type,item.label,item.message])]);
    if(panel.dataset.qualitySignature===signature)return;
    panel.dataset.qualitySignature=signature;
    const counts=issues.reduce((map,item)=>(map[item.type]=(map[item.type]||0)+1,map),{});
    panel.innerHTML=`<div class="panel-heading"><span class="step ${issues.length?"yellow":"green"}">Q</span><div><h3>Datenqualität</h3><p>${issues.length?`${issues.length} Hinweis${issues.length===1?"":"e"} gefunden.`:"Keine Auffälligkeiten in den geladenen Berichten gefunden."}</p></div></div>${issues.length?`<div class="smart-quality-summary">${Object.entries(counts).map(([type,count])=>`<span><b>${count}</b>${esc(type)}</span>`).join("")}</div><button type="button" class="outline-button smart-quality-toggle" aria-expanded="false" aria-controls="smartQualityList">Hinweise anzeigen</button><div id="smartQualityList" data-quality-list hidden>${issues.map(item=>`<article><strong>${esc(item.label)}</strong><span>${esc(item.message)}</span><small>${esc(item.type)}</small></article>`).join("")}</div>`:'<p class="smart-ready">${csvArchive.length?"✓ Keine Auffälligkeiten in den geladenen Berichten gefunden.":"Noch keine Berichte zur Prüfung geladen."}</p>'}`;
    const button=panel.querySelector(".smart-quality-toggle"),list=panel.querySelector("[data-quality-list]");
    if(button&&list)button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();const shouldOpen=list.hasAttribute("hidden");if(shouldOpen)list.removeAttribute("hidden");else list.setAttribute("hidden","");button.setAttribute("aria-expanded",String(shouldOpen));button.textContent=shouldOpen?"Hinweise ausblenden":"Hinweise anzeigen";});
  }
  function enhanceStatistics(){
    const view=document.getElementById("settingsStatisticsView")||document.getElementById("statisticsView"),grid=view?.querySelector(".statistics-grid");if(!grid)return;
    let panel=document.getElementById("smartDataQualityPanel");
    if(!panel){panel=document.createElement("article");panel.id="smartDataQualityPanel";panel.className="panel statistics-panel smart-quality-panel";grid.appendChild(panel);}
    renderQualityPanel(panel,qualityData());
    window.Usability?.statistics();
  }
  function enhanceHistory(){document.querySelectorAll(".history-item").forEach(item=>{if(item.querySelector(".smart-history-status"))return;const small=item.querySelector("small");if(!small)return;const corrected=/Korrektur/.test(small.textContent);const badge=document.createElement("span");badge.className=`smart-history-status ${corrected?"corrected":"original"}`;badge.textContent=corrected?"korrigiert":"Original";small.insertAdjacentElement("afterend",badge);});}
  const setupKey='fw_setup_completed_v1';
  function setupState(){
    const connected=typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady();
    const secure=typeof passwordSecurityStatus==='function'&&passwordSecurityStatus().secure;
    const count=typeof members!=='undefined'&&Array.isArray(members)?members.length:0;
    let scope='',completed=false;
    try{scope=JSON.stringify([localStorage.getItem('fw_onedrive_client_id')||'',localStorage.getItem('fw_onedrive_shared_folder_url')||'']);completed=localStorage.getItem(setupKey)===scope;}catch{}
    const ready=connected&&secure&&count>0;
    try{if(ready&&scope)localStorage.setItem(setupKey,scope);else if(!secure||(connected&&!count)){localStorage.removeItem(setupKey);completed=false;}}catch{}
    return {connected,secure,count,complete:ready||(completed&&secure)};
  }
  function openSetupStep(key){
    document.getElementById('smartSetupWizard')?.close();
    if(key==='onedrive')document.getElementById('cloudSyncButton')?.click();
    else showView(key==='password'?'settingsSecurityView':'settingsMembersView');
  }
  function nextSetupStep(state){return !state.connected?'onedrive':!state.secure?'password':'members';}
  const setupLabels={onedrive:['OneDrive verbinden','Verbinde den gemeinsamen Datenordner.'],password:['Admin-Passwort festlegen','Lege ein eigenes Passwort mit mindestens 8 Zeichen fest.'],members:['Mitglieder laden oder anlegen','Öffne die Mitgliederverwaltung und prüfe die Mitgliederliste.']};
  function enhanceSettings(){
    const page=document.getElementById('settingsView');if(!page)return;
    let card=document.getElementById('smartSetupCard');
    if(!card){card=document.createElement('article');card.id='smartSetupCard';card.className='panel smart-setup-card';card.innerHTML='<div><small>Einmalige Einrichtung</small><h3></h3><p></p></div><button type="button" class="primary-button"></button>';page.querySelector('.screen-heading')?.after(card);}
    const state=setupState(),key=nextSetupStep(state),[label,help]=setupLabels[key];
    card.hidden=state.complete;
    card.querySelector('h3').textContent=label;card.querySelector('p').textContent=help;
    const button=card.querySelector('button');button.textContent=label;button.onclick=()=>openSetupStep(key);
    if(!document.getElementById('smartSetupReview')){const details=document.createElement('details');details.id='smartSetupReview';details.className='dr-admin-details';details.innerHTML='<summary>Einrichtung prüfen</summary><p>Verbindung, Passwort und Mitglieder prüfen. Sicherungen findest du unter „Berichte und Datensicherung“; Getränkekonten unter „Getränkeverwaltung → Sichern &amp; Zurücksetzen“.</p><button type="button" class="outline-button">Einrichtungsstatus anzeigen</button>';details.querySelector('button').onclick=()=>{updateSetupWizard();ensureSetupWizard().showModal();};page.append(details);}
    const dialog=document.getElementById('smartSetupWizard');if(dialog?.open)updateSetupWizard();
  }
  function syncOneDriveFreshness(){const el=document.getElementById('oneDriveDetail');if(!el)return;const last=localStorage.getItem('fw_onedrive_last_sync');if(last&&!el.textContent.includes('Letzte erfolgreiche')){const d=new Date(last);if(!Number.isNaN(d.getTime()))el.textContent+=' · Letzte erfolgreiche Synchronisierung: '+d.toLocaleString('de-DE');}}
  function ensureSetupWizard(){let d=document.getElementById('smartSetupWizard');if(d)return d;d=document.createElement('dialog');d.id='smartSetupWizard';d.className='smart-setup-wizard';d.innerHTML='<form method="dialog"><header><h2>Einrichtung prüfen</h2><button value="cancel" aria-label="Schließen">×</button></header><p class="smart-setup-status" role="status"></p><ol><li data-setup="onedrive"><b>1</b><div><strong>OneDrive</strong><span></span></div></li><li data-setup="password"><b>2</b><div><strong>Admin-Passwort</strong><span></span></div></li><li data-setup="members"><b>3</b><div><strong>Mitglieder</strong><span></span></div></li></ol><footer><button value="cancel" class="primary-button">Schließen</button></footer></form>';document.body.appendChild(d);for(const item of d.querySelectorAll('[data-setup]')){const button=document.createElement('button');button.type='button';button.className='outline-button';button.textContent='Öffnen';button.onclick=()=>openSetupStep(item.dataset.setup);item.append(button);}return d;}
  function updateSetupWizard(){const d=ensureSetupWizard(),state=setupState();d.querySelector('.smart-setup-status').textContent=state.complete?'Die Einrichtung ist abgeschlossen.':'Erledige den nächsten offenen Schritt.';for(const [key,done,text] of [['onedrive',state.connected,state.connected?'Verbindung bestätigt.':'Aktuell nicht verbunden.'],['password',state.secure,state.secure?'Eigenes Passwort eingerichtet.':'Eigenes Passwort festlegen.'],['members',state.count>0,state.count+' Mitglieder geladen.']]){const item=d.querySelector('[data-setup="'+key+'"]');item.classList.toggle('done',done);item.querySelector('span').textContent=text;item.querySelector('button').hidden=done;}}
  function enhanceCorrectionMode(){document.querySelectorAll(".archive-correction-dialog form,.operation-report-form").forEach(form=>{if(form.querySelector(".smart-edit-mode"))return;const tag=document.createElement("p");tag.className="smart-edit-mode";tag.textContent=form.closest(".archive-correction-dialog")?"Korrekturmodus · Änderungen werden vor dem Speichern geprüft":"Bearbeitungsmodus";form.prepend(tag);});}
  function initialize(){enhanceHistory();enhanceSettings();syncOneDriveFreshness();enhanceCorrectionMode();}
  window.SmartWorkflow={
    initialize,
    statistics:enhanceStatistics,
    history:()=>{enhanceHistory();enhanceCorrectionMode();},
    operationForm:()=>{enhanceOperationForm();enhanceCorrectionMode();},
    settings:()=>{enhanceSettings();syncOneDriveFreshness();},
    confirm:askSmartConfirmation,
    confirmOperation:window.smartConfirmOperation
  };
  document.addEventListener("DOMContentLoaded",initialize,{once:true});
  if(document.readyState!=="loading")initialize();
})();
