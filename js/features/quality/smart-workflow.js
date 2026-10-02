"use strict";
(function(){
  const esc=value=>typeof escapeHtml==="function"?escapeHtml(value):String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function ensureSmartDialog(){let d=document.getElementById("smartCompletionDialog");if(d)return d;d=document.createElement("dialog");d.id="smartCompletionDialog";d.className="smart-completion-dialog";d.innerHTML='<div class="smart-completion-shell"><header><div><small>Abschlussprüfung</small><h2>Angaben prüfen</h2></div><button type="button" data-smart-cancel aria-label="Schließen">×</button></header><div class="smart-completion-body" data-smart-body></div><footer><button type="button" class="outline-button" data-smart-cancel>Zurück und bearbeiten</button><button type="button" class="primary-button" data-smart-confirm>Geprüft, fortfahren</button></footer></div>';document.body.appendChild(d);return d;}
  function askSmartConfirmation(title,rows,issues=[]){const d=ensureSmartDialog();d.querySelector("h2").textContent=title;d.querySelector("[data-smart-body]").innerHTML=`<div class="smart-summary-grid">${rows.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value||"–")}</strong></div>`).join("")}</div>${issues.length?`<section class="smart-issues"><h3>Hinweise</h3>${issues.map(x=>`<p>${esc(x)}</p>`).join("")}</section>`:'<p class="smart-ready">✓ Alle wesentlichen Angaben sind vollständig.</p>'}`;return new Promise(resolve=>{const done=value=>{d.close();resolve(value)};d.querySelectorAll("[data-smart-cancel]").forEach(b=>b.onclick=()=>done(false));d.querySelector("[data-smart-confirm]").onclick=()=>done(true);d.oncancel=e=>{e.preventDefault();done(false)};d.showModal();});}
  window.smartConfirmOperation=async function(d,check){const vehicles=[...new Set(Object.values(d.assignments||{}).filter(v=>String(v).includes("EM 5/")))];const docs=globalThis.pendingDocumentReport?.pageCount||0;return askSmartConfirmation("Einsatz abschließen",[["Datum",d.date],["Einsatz",[d.type,d.location].filter(Boolean).join(" · ")],["Teilnehmende",String((d.members||[]).length)],["Fahrzeuge",vehicles.join(", ")||"nur Reserve"],["Dokumentseiten",String(docs)],["Paketname",`FFW-Wasser_${d.date}_${String(d.times?.alarm||"").replace(":","-")}_Einsatz.zip`]],check?.warnings||[]);};
  function enhanceOperationForm(){const form=document.getElementById("operationReportForm");if(!form||form.dataset.smartEnhanced)return;form.dataset.smartEnhanced="1";form.querySelectorAll(":scope > fieldset").forEach((field,index)=>{field.classList.add("smart-form-section");const legend=field.querySelector("legend");if(!legend)return;legend.tabIndex=0;legend.setAttribute("role","button");legend.setAttribute("aria-expanded","true");const toggle=()=>{field.classList.toggle("smart-collapsed");legend.setAttribute("aria-expanded",String(!field.classList.contains("smart-collapsed")));};legend.addEventListener("click",toggle);legend.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}});});const quick=(id,values)=>{const input=document.getElementById(id);if(!input||input.parentElement.querySelector(".smart-quick-values"))return;const box=document.createElement("div");box.className="smart-quick-values";box.innerHTML=values.map(v=>`<button type="button">${esc(v)}</button>`).join("");box.onclick=e=>{const b=e.target.closest("button");if(b){input.value=b.textContent;input.dispatchEvent(new Event("input",{bubbles:true}));}};input.insertAdjacentElement("afterend",box);};quick("opType",["Brand","Technische Hilfe","BMA","Ölspur"]);quick("opWaterSources",["Hydrant","offenes Gewässer","kein Löschwasser"]);quick("opAlarmMethods",["Digitalmelder","Sirene","Telefon"]);}
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
    const signature=JSON.stringify(issues.map(item=>[item.type,item.label,item.message]));
    if(panel.dataset.qualitySignature===signature)return;
    panel.dataset.qualitySignature=signature;
    const counts=issues.reduce((map,item)=>(map[item.type]=(map[item.type]||0)+1,map),{});
    panel.innerHTML=`<div class="panel-heading"><span class="step ${issues.length?"yellow":"green"}">Q</span><div><h3>Datenqualität</h3><p>${issues.length?`${issues.length} Hinweis${issues.length===1?"":"e"} gefunden.`:"Keine offensichtlichen Datenlücken gefunden."}</p></div></div>${issues.length?`<div class="smart-quality-summary">${Object.entries(counts).map(([type,count])=>`<span><b>${count}</b>${esc(type)}</span>`).join("")}</div><button type="button" class="outline-button smart-quality-toggle" aria-expanded="false" aria-controls="smartQualityList">Hinweise anzeigen</button><div id="smartQualityList" data-quality-list hidden>${issues.map(item=>`<article><strong>${esc(item.label)}</strong><span>${esc(item.message)}</span><small>${esc(item.type)}</small></article>`).join("")}</div>`:'<p class="smart-ready">✓ Die vorhandenen Archivdaten sind plausibel und vollständig auswertbar.</p>'}`;
    const button=panel.querySelector(".smart-quality-toggle"),list=panel.querySelector("[data-quality-list]");
    if(button&&list)button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();const shouldOpen=list.hasAttribute("hidden");if(shouldOpen)list.removeAttribute("hidden");else list.setAttribute("hidden","");button.setAttribute("aria-expanded",String(shouldOpen));button.textContent=shouldOpen?"Hinweise ausblenden":"Hinweise anzeigen";});
  }
  function enhanceStatistics(){
    const view=document.getElementById("settingsStatisticsView")||document.getElementById("statisticsView"),grid=view?.querySelector(".statistics-grid");if(!grid)return;
    let panel=document.getElementById("smartDataQualityPanel");
    if(!panel){panel=document.createElement("article");panel.id="smartDataQualityPanel";panel.className="panel statistics-panel smart-quality-panel";grid.appendChild(panel);}
    renderQualityPanel(panel,qualityData());
  }
  function enhanceHistory(){document.querySelectorAll(".history-item").forEach(item=>{if(item.querySelector(".smart-history-status"))return;const small=item.querySelector("small");if(!small)return;const corrected=/Korrektur/.test(small.textContent);const badge=document.createElement("span");badge.className=`smart-history-status ${corrected?"corrected":"original"}`;badge.textContent=corrected?"korrigiert":"Original";small.insertAdjacentElement("afterend",badge);});}
  function enhanceSettings(){const page=document.getElementById("settingsView");if(!page||document.getElementById("smartSetupCard"))return;const connected=typeof oneDriveSignedIn==="function"&&oneDriveSignedIn(),count=Array.isArray(members)?members.length:0,card=document.createElement("article");card.id="smartSetupCard";card.className="panel smart-setup-card";card.innerHTML=`<div><small>Einrichtungsstatus</small><h3>${count&&connected?"Anwendung ist startklar":"Einrichtung vervollständigen"}</h3><p>${count?`${count} Mitglieder geladen`:`Noch keine Mitglieder geladen`} · ${connected?"OneDrive verbunden":"OneDrive nicht verbunden"}</p></div><div class="smart-setup-steps"><span class="${count?"done":""}">1 Mitglieder</span><span class="${connected?"done":""}">2 OneDrive</span><span>3 Backup prüfen</span></div>`;page.querySelector(".settings-grid,.settings-menu,.settings-cards")?.prepend(card);}
  function syncOneDriveFreshness(){const el=document.getElementById("oneDriveDetail");if(!el)return;const last=localStorage.getItem("fw_onedrive_last_sync");if(last&&!el.textContent.includes("Letzte erfolgreiche")){const d=new Date(last);if(!Number.isNaN(d.getTime()))el.textContent+=` · Letzte erfolgreiche Synchronisierung: ${d.toLocaleString("de-DE")}`;}}
  function ensureSetupWizard(){let d=document.getElementById("smartSetupWizard");if(d)return d;d=document.createElement("dialog");d.id="smartSetupWizard";d.className="smart-setup-wizard";d.innerHTML='<form method="dialog"><header><div><small>Geführte Einrichtung</small><h2>System startklar machen</h2></div><button value="cancel" aria-label="Schließen">×</button></header><ol><li data-setup="password"><b>1</b><div><strong>Admin-Passwort</strong><span>Standardpasswort ersetzen und Zugriff absichern.</span></div></li><li data-setup="members"><b>2</b><div><strong>Mitglieder</strong><span>Mitgliederdaten lokal oder über OneDrive laden.</span></div></li><li data-setup="onedrive"><b>3</b><div><strong>OneDrive</strong><span>Gemeinsamen Datenordner verbinden und testen.</span></div></li><li data-setup="backup"><b>4</b><div><strong>Backup</strong><span>Speicherort und Wiederherstellung prüfen.</span></div></li></ol><footer><button value="cancel" class="primary-button">Fertig</button></footer></form>';document.body.appendChild(d);return d;}
  function updateSetupWizard(){const d=ensureSetupWizard(),secure=typeof passwordSecurityStatus==="function"&&passwordSecurityStatus().secure,count=Array.isArray(members)?members.length:0,connected=typeof oneDriveSignedIn==="function"&&oneDriveSignedIn(),backed=Boolean(localStorage.getItem("fw_onedrive_last_sync"));[["password",secure],["members",count>0],["onedrive",connected],["backup",backed]].forEach(([key,done])=>d.querySelector(`[data-setup="${key}"]`)?.classList.toggle("done",done));}
  function enhanceSettingsWizard(){const card=document.getElementById("smartSetupCard");if(!card||card.querySelector("button"))return;const button=document.createElement("button");button.type="button";button.className="primary-button";button.textContent="Einrichtungsassistent öffnen";button.onclick=()=>{updateSetupWizard();ensureSetupWizard().showModal();};card.appendChild(button);}
  function enhanceCorrectionMode(){document.querySelectorAll(".archive-correction-dialog form,.operation-report-form").forEach(form=>{if(form.querySelector(".smart-edit-mode"))return;const tag=document.createElement("p");tag.className="smart-edit-mode";tag.textContent=form.closest(".archive-correction-dialog")?"Korrekturmodus · Änderungen werden vor dem Speichern geprüft":"Bearbeitungsmodus";form.prepend(tag);});}
  function initialize(){enhanceHistory();enhanceSettings();syncOneDriveFreshness();enhanceSettingsWizard();enhanceCorrectionMode();}
  window.SmartWorkflow={
    initialize,
    statistics:enhanceStatistics,
    history:()=>{enhanceHistory();enhanceCorrectionMode();},
    operationForm:()=>{enhanceOperationForm();enhanceCorrectionMode();},
    settings:()=>{enhanceSettings();syncOneDriveFreshness();enhanceSettingsWizard();},
    confirm:askSmartConfirmation,
    confirmOperation:window.smartConfirmOperation
  };
  document.addEventListener("DOMContentLoaded",initialize,{once:true});
  if(document.readyState!=="loading")initialize();
})();
