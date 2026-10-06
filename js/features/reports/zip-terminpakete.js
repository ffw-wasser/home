"use strict";
async function buildTerminPackage({baseName,csvName,csvContent,pdfName,pdfBlob,documentReport=null,packageType="Probe",operationData=null}){
  if(typeof JSZip!=="function")throw new Error("ZIP-Funktion ist nicht geladen");
  const zip=new JSZip();
  zip.file(csvName,csvContent);
  let finalPdf=pdfBlob;
  if(documentReport?.pdf){
    if(!globalThis.PDFLib?.PDFDocument)throw new Error("PDF-Zusammenführung ist nicht geladen");
    const main=await PDFLib.PDFDocument.load(await pdfBlob.arrayBuffer());
    const attachment=await PDFLib.PDFDocument.load(await documentReport.pdf.arrayBuffer());
    const copied=await main.copyPages(attachment,attachment.getPageIndices());
    copied.forEach(page=>main.addPage(page));
    finalPdf=new Blob([await main.save()],{type:"application/pdf"});
  }
  zip.file(pdfName,finalPdf);
  zip.file("paket-info.json",JSON.stringify({format:"FFW-Wasser-Terminpaket",version:"2.0",type:packageType,createdAt:new Date().toISOString(),baseName,csvName,pdfName,operationData:operationData||undefined,files:Object.keys(zip.files)},null,2));
  const zipBlob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6},mimeType:"application/zip"});
  return {zipBlob,finalPdf};
}
let pendingTerminPackageSave=null;
function ensureIpadTerminPackageDialog(){
  let dialog=byId("ipadTerminPackageDialog");if(dialog)return dialog;
  dialog=document.createElement("dialog");dialog.id="ipadTerminPackageDialog";dialog.className="ipad-termin-package-dialog";
  dialog.innerHTML=`<div class="ipad-package-shell"><header><div><small>Terminabschluss</small><h2>Terminpaket ist fertig</h2></div></header><div class="ipad-package-body"><p>Das ZIP-Terminpaket wurde erstellt. Bitte jetzt auf <b>Teilen und speichern</b> tippen und anschließend <b>In Dateien sichern</b> sowie den gewünschten OneDrive-Ordner auswählen.</p><p class="ipad-package-name" id="ipadTerminPackageName"></p><p class="ipad-package-error" id="ipadTerminPackageError" hidden></p></div><footer><button type="button" class="outline-button" id="ipadTerminPackageCancel">Abbrechen</button><button type="button" class="primary-button" id="ipadTerminPackageShare">Teilen und speichern</button></footer></div>`;
  document.body.appendChild(dialog);
  byId("ipadTerminPackageCancel").onclick=()=>finishIpadTerminPackageSave("cancelled");
  byId("ipadTerminPackageShare").onclick=sharePendingTerminPackage;
  dialog.oncancel=event=>{event.preventDefault();finishIpadTerminPackageSave("cancelled");};
  return dialog;
}
function finishIpadTerminPackageSave(result){
  const pending=pendingTerminPackageSave;if(!pending)return;
  pendingTerminPackageSave=null;try{pending.dialog.close();}catch{pending.dialog.removeAttribute("open");}
  pending.resolve(result);
}
async function sharePendingTerminPackage(){
  const pending=pendingTerminPackageSave;if(!pending)return;
  const button=byId("ipadTerminPackageShare"),errorBox=byId("ipadTerminPackageError");button.disabled=true;errorBox.hidden=true;
  try{
    const file=new File([pending.blob],pending.fileName,{type:"application/zip",lastModified:Date.now()});
    if(!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})))throw new Error("Dateifreigabe wird von diesem Browser nicht unterstützt.");
    // Direkter Aufruf aus dem Button-Klick: notwendige Benutzeraktivierung bleibt erhalten.
    // Nur die ZIP-Datei an den iOS-Teilen-Dialog übergeben. Ein zusätzlicher
    // title-Wert wurde von "In Dateien sichern" teilweise als Text.txt gespeichert.
    await navigator.share({files:[file]});
    finishIpadTerminPackageSave("shared");
  }catch(error){
    if(error?.name==="AbortError"){finishIpadTerminPackageSave("cancelled");return;}
    console.error("Terminpaket konnte nicht geteilt werden",error);
    errorBox.textContent=`Teilen war nicht möglich: ${error?.message||"unbekannter Fehler"}. Bitte erneut versuchen.`;errorBox.hidden=false;button.disabled=false;
  }
}
function promptIpadTerminPackageSave(fileName,blob){
  if(pendingTerminPackageSave)return Promise.resolve("failed");
  const dialog=ensureIpadTerminPackageDialog();byId("ipadTerminPackageName").textContent=fileName;byId("ipadTerminPackageError").hidden=true;byId("ipadTerminPackageShare").disabled=false;
  return new Promise(resolve=>{
    pendingTerminPackageSave={fileName,blob,resolve,dialog};
    // Der Dokumenteditor aus Schritt 4 ist selbst ein modaler Dialog. Safari/iPad
    // erlaubt keinen zweiten modalen Dialog darueber. Deshalb zuerst sauber schliessen.
    document.querySelectorAll("dialog[open]").forEach(openDialog=>{
      if(openDialog===dialog)return;
      try{openDialog.close();}catch{openDialog.removeAttribute("open");}
    });
    document.documentElement.classList.remove("document-editor-open");
    requestAnimationFrame(()=>{
      try{dialog.showModal();}
      catch(error){
        console.error("Speicherdialog konnte nicht modal geoeffnet werden",error);
        dialog.setAttribute("open","");
        dialog.scrollIntoView({block:"center"});
      }
    });
  });
}
async function saveTerminPackage(fileName,blob,overwriteRequired=false){
  document.querySelectorAll("#operationPdfPreviewDialog,.operation-pdf-preview-dialog").forEach(node=>{try{node.close?.();}catch{}node.remove();});
  const isiOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||"")||(/Macintosh/i.test(navigator.userAgent||"")&&("ontouchend" in document));
  if(isiOS){
    if(overwriteRequired)showToast("Korrektur: Im Dateien-Dialog die vorhandene ZIP mit gleichem Namen ersetzen.","warning");
    return promptIpadTerminPackageSave(fileName,blob);
  }
  // Desktop/Windows: immer als echten Browser-Download ausgeben. Ein alter oder
  // abgelaufener Verzeichnis-Handle darf den ZIP-Download nicht mehr verhindern.
  try{
    if(!(blob instanceof Blob)||!blob.size)throw new Error("Das ZIP-Paket ist leer.");
    downloadBlob(fileName,blob);
    return "downloaded";
  }catch(error){
    console.error("ZIP-Download fehlgeschlagen",error);
    showToast(`ZIP konnte nicht heruntergeladen werden: ${error?.message||"unbekannter Fehler"}`,"error");
    return "failed";
  }
}

async function packageFilesFromZip(file){const zip=await JSZip.loadAsync(file),files=[];for(const entry of Object.values(zip.files)){if(entry.dir||!/\.(csv|pdf)$/i.test(entry.name))continue;const blob=await entry.async("blob"),name=entry.name.split("/").pop();files.push(new File([blob],name,{type:/\.csv$/i.test(name)?"text/csv":"application/pdf",lastModified:file.lastModified||Date.now()}));}return files;}

/* Probe-/Terminabschluss: nur ein ZIP-Paket nach außen speichern. */
window.closeDay=async function(topic=currentClosingTopic){
  topic=String(topic||"").trim();if(!topic){openProbeTopicDialog();return;}
  const allCurrent=[...todayEntries()];
  const committeeExport=sessionType==="Ausschuss Sitzung"||allCurrent[0]?.sessionType==="Ausschuss Sitzung";
  const exportMembers=committeeExport?members.filter(member=>member.committeeMember):members;
  const allowedNames=new Set(exportMembers.flatMap(member=>[nameForStorage(member),nameForTile(member)]));
  const current=committeeExport?allCurrent.filter(entry=>allowedNames.has(entry.storedName)||allowedNames.has(entry.displayName)):allCurrent;
  if(!current.length)return showToast("Es sind noch keine Anmeldungen vorhanden.","error");
  const organizers=current.filter(e=>e.status==="Anwesend"&&e.role==="Orga").length,present=current.filter(e=>e.status==="Anwesend"&&e.role!=="Orga").length,excused=current.filter(e=>e.status==="Entschuldigt").length;
  const recordedPreview=new Set(current.flatMap(e=>[e.storedName,e.displayName].filter(Boolean))),openPreview=exportMembers.filter(m=>!m.ageDepartment&&!recordedPreview.has(nameForStorage(m))&&!recordedPreview.has(nameForTile(m))).length;
  if(window.SmartWorkflow?.confirm){const approved=await window.SmartWorkflow.confirm("Termin abschließen",[["Terminart",sessionType||"Termin"],["Datum",today()],["Thema",topic],["Anwesend",String(present+organizers)],["Entschuldigt",String(excused)],["Ohne Status",String(openPreview)]],openPreview?[`${openPreview} Person${openPreview===1?" ist":"en sind"} noch ohne Status.`]:[]);if(!approved)return;}
  const recorded=new Set(current.flatMap(e=>[e.storedName,e.displayName].filter(Boolean))),missing=exportMembers.filter(m=>!m.ageDepartment&&!recorded.has(nameForStorage(m))&&!recorded.has(nameForTile(m))).length;
  if(!exportMembers.length)return showToast(committeeExport?"Es sind keine Ausschussmitglieder eingerichtet.":"Es gibt keine Mitglieder für den Export.","error");
  const exportType=current[0]?.sessionType||sessionType,entryByName=new Map(current.map(e=>[e.storedName||e.displayName,e]));
  const rows=exportMembers.map(member=>{const name=nameForStorage(member),entry=entryByName.get(name)||entryByName.get(nameForTile(member));if(!entry)return[today(),"",name,exportType,"Fehlt",""];if(entry.status==="Entschuldigt")return[entry.date,entry.time,name,exportType,"Entschuldigt",""];if(entry.status==="Betrifft nicht")return[entry.date,entry.time,name,exportType,"Betrifft nicht",""];if(entry.role==="Orga")return[entry.date,entry.time,name,exportType,"Anwesend","Orga"];if(exportType==="Sonderprobe")return[entry.date,entry.time,name,exportType,"Anwesend","Anwesend"];if(exportType==="Unterricht")return[entry.date,entry.time,name,exportType,"Anwesend","Unterricht"];if(exportType==="Ausschuss Sitzung")return[entry.date,entry.time,name,exportType,"Anwesend","Ausschuss Sitzung"];return[entry.date,entry.time,name,exportType,"Anwesend",csvRoleForEntry(entry,member)];});
  const includeFunction=exportType==="Allgemeine Probe"||exportType==="Einsatz";
  const csvHeader=includeFunction?"Datum;Uhrzeit;Name;Terminart;Status;Funktion / Status;Thema":"Datum;Uhrzeit;Name;Terminart;Status;Thema";
  const csv="\ufeff"+[csvHeader,...rows.map(row=>(includeFunction?[...row,topic]:[...row.slice(0,5),topic]).map(csvCell).join(";"))].join("\r\n"),safeType=exportType.replace(/ /g,"-"),base=`FFW-Wasser_${today()}_${safeType}`,csvName=`${base}.csv`,pdfName=`${base}.pdf`,pdfRows=rows.map(r=>({time:r[1],name:r[2],status:r[4],role:includeFunction?r[5]:""})),notApplicable=rows.filter(r=>r[4]==="Betrifft nicht").length,pdf=probePdfBlob(pdfRows,exportType,{present:present+organizers,excused,missing,notApplicable},topic);
  const packageResult=await buildTerminPackage({baseName:base,csvName,csvContent:csv,pdfName,pdfBlob:pdf,documentReport:typeof pendingDocumentReport!=="undefined"?pendingDocumentReport:null,packageType:"Probe"}),result=await saveTerminPackage(`${base}.zip`,packageResult.zipBlob);
  if(result==="failed"||result==="cancelled")return showToast("Das Terminpaket konnte nicht gespeichert werden. Die Tagesdaten bleiben erhalten.","error");
  try{await addCsvToArchive(csvName,csv,exportType,topic);}catch(error){console.error("Lokales Archiv konnte nach erfolgreichem Speichern nicht vollständig ergänzt werden",error);}
  const completedSessionId=ensureCurrentSessionId();entries=entries.filter(e=>e.sessionId!==completedSessionId);currentSessionId="";safeStorage.setItem("fw_v1_current_session_id","");chosenMemberId="";chosenMemberIds.clear();chosenRole="";currentClosingTopic="";resetDocumentReportState();currentProbeDate=systemToday();saveEntries();renderMembers();renderRoles();renderEntries();updateSelection();tacticsClosingPending=false;const actions=byId("tacticsCloseActions");if(actions)actions.hidden=true;setHomeFlowStage(1);showView("attendanceView");showToast("Probe abgeschlossen: Das ZIP-Terminpaket wurde gespeichert und der Tag zurückgesetzt.");
};

/* Einsatzabschluss: direkt speichern, archivieren und anschließend zu Home zurückkehren. */
window.finishOperationZip=async function(){
  const button=byId("operationFinish"),validationBox=byId("operationValidation");
  const defaultButtonText="Einsatz abschließen · Terminpaket";
  if(!button)throw new Error("Der Abschlussbutton wurde nicht gefunden");
  button.textContent="Einsatz wird vorbereitet …";
  button.setAttribute("aria-busy","true");
  button.disabled=true;
  if(validationBox){validationBox.hidden=false;validationBox.innerHTML='<p class="warning">Einsatzbericht wird geprüft und erstellt …</p>';}
  try{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(typeof collectOperationData!=="function")throw new Error("Einsatzdaten-Modul ist nicht geladen");
    const d=collectOperationData();
    if(!d||typeof d!=="object")throw new Error("Einsatzdaten konnten nicht gelesen werden");
    persistOperationDraft?.(d);
    d.members=Array.isArray(d.members)?d.members:[];
    d.times=d.times||{};
    if(typeof validateOperation!=="function")throw new Error("Einsatzprüfung ist nicht geladen");
    const rawCheck=validateOperation(d)||{};
    const check={errors:Array.isArray(rawCheck.errors)?rawCheck.errors:[],warnings:Array.isArray(rawCheck.warnings)?rawCheck.warnings:[]};
    if(validationBox){validationBox.hidden=!(check.errors.length||check.warnings.length);validationBox.innerHTML=[...check.errors.map(x=>`<p class="error">${escapeHtml(x)}</p>`),...check.warnings.map(x=>`<p class="warning">${escapeHtml(x)}</p>`)].join("");}
    if(check.errors.length){showToast("Bitte die Pflichtangaben und Hinweise prüfen.","error");return;}
    // Keine doppelte Abschlussprüfung: Die PDF-Vorschau ist jetzt die einzige
    // verbindliche Prüfung. Dadurch ist "Dokumentseiten 0" nicht mehr missverständlich.
    if(check.warnings.length&&!confirm(check.warnings.join("\n")+"\n\nTrotzdem PDF-Vorschau erstellen?"))return;

    const previous=editingOperationArchiveId?csvArchive.find(entry=>entry.id===editingOperationArchiveId):null;
    const stamp=(d.times.alarm||new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})).replace(":","-");
    const generatedBase=`FFW-Wasser_${d.date}_${stamp}_Einsatz`;
    const previousBase=String(previous?.packageFileName||previous?.fileName||"").replace(/\.(zip|csv|pdf)$/i,"");
    const base=previousBase||generatedBase,zipName=`${base}.zip`,csvName=`${base}.csv`,pdfName=`${base}.pdf`,csv=operationCsv(d);
    if(validationBox)validationBox.innerHTML='<p class="warning">PDF-Vorschau wird lokal erstellt. Bitte kurz warten ...</p>';
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const pdf=await operationPdfBlob(d);
    const completed=await showOperationPdfPreview(pdf,pdfName,async()=>{
      // Neu und Korrektur speichern ausschließlich ein ZIP. Bei der Korrektur
      // bleibt der ursprüngliche Paketname erhalten, damit die Datei im
      // ausgewählten Ordner ersetzt statt als CSV/PDF-Doppel ausgegeben wird.
      const packageResult=await buildTerminPackage({baseName:base,csvName,csvContent:csv,pdfName,pdfBlob:pdf,documentReport:typeof pendingDocumentReport!=="undefined"?pendingDocumentReport:null,packageType:"Einsatz",operationData:d}),result=await saveTerminPackage(zipName,packageResult.zipBlob,Boolean(previous));
      if(result==="failed"||result==="cancelled"){showToast("Das Einsatz-Terminpaket konnte nicht gespeichert werden. Daten bleiben erhalten.","error");return false;}
      const item={id:previous?.id||makeId(),packageFileName:zipName,fileName:csvName,pdfFileName:pdfName,content:csv,sessionType:"Einsatz",topic:`${d.type} · ${d.location}`,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),presentCount:(Array.isArray(d.members)?d.members.length:0),excusedCount:0,missingCount:0,operationData:d,hasImportedPdf:true,revisions:[...(previous?.revisions||[]),...(previous?[{correctedAt:new Date().toISOString(),reason:"Einsatzbericht korrigiert",previousOperationData:previous.operationData}]:[])]};
      try{await saveImportedReportPdf(item.id,new File([packageResult.finalPdf],pdfName,{type:"application/pdf"}));await commitPendingDocumentReport?.(item.id);csvArchive=previous?csvArchive.map(entry=>entry.id===item.id?item:entry):[item,...csvArchive];saveArchive();}catch(error){console.error("Lokales Einsatzarchiv konnte nach erfolgreichem Speichern nicht vollständig ergänzt werden",error);}
      entries=entries.filter(e=>e.operationId!==currentOperationId);saveEntries();resetDocumentReportState();resetOperationState();renderEntries();renderMembers();renderStatistics();renderHistory();setHomeFlowStage(1);showView("attendanceView");showToast(previous?"Korrigiertes Einsatz-Terminpaket wurde gespeichert.":"Einsatz-Terminpaket wurde gespeichert.");return true;
    });
    if(!completed)showToast("Finales Speichern abgebrochen. Einsatzdaten bleiben zur Bearbeitung erhalten.","error");
  }catch(error){console.error("Einsatzabschluss fehlgeschlagen",error);try{if(typeof collectOperationData==="function")persistOperationDraft?.(collectOperationData());}catch(saveError){console.warn("Einsatzbericht konnte nach dem Fehler nicht erneut gesichert werden",saveError);}const raw=String(error?.message||error||""),message=/Failed to fetch/i.test(raw)?"PDF konnte nicht über OneDrive erzeugt werden. Bitte Internetverbindung und OneDrive-Anmeldung prüfen. Alle Protokolleinträge wurden gespeichert.":`${raw||"Unbekannter Fehler"} Alle Protokolleinträge wurden gespeichert.`;showToast(`Einsatz konnte nicht abgeschlossen werden. ${message}`,"error");}
  finally{
    button.disabled=false;
    button.removeAttribute("aria-busy");
    button.textContent=defaultButtonText;
  }
};
// Der Abschlussbutton wird direkt und genau einmal in operations.js gebunden.

/* ZIP-Auswahl in der Historie automatisch entpacken. */
async function importTerminPackageFile(file){
  const zip=await JSZip.loadAsync(file),infoEntry=zip.file("paket-info.json");
  const info=infoEntry?JSON.parse(await infoEntry.async("string")):null;
  if(info?.format==="FFW-Wasser-Terminpaket"&&info.type==="Einsatz"&&info.operationData){
    const csvEntry=zip.file(info.csvName)||Object.values(zip.files).find(entry=>!entry.dir&&/\.csv$/i.test(entry.name));
    const pdfEntry=zip.file(info.pdfName)||Object.values(zip.files).find(entry=>!entry.dir&&/\.pdf$/i.test(entry.name));
    if(!csvEntry||!pdfEntry)throw new Error("Im Einsatz-Terminpaket fehlen CSV oder PDF.");
    const csv=await csvEntry.async("string"),pdf=await pdfEntry.async("blob"),d=info.operationData;
    const existing=csvArchive.find(item=>item.sessionType==="Einsatz"&&item.operationData?.id===d.id);
    const item={id:existing?.id||makeId(),fileName:info.csvName||csvEntry.name,pdfFileName:info.pdfName||pdfEntry.name,content:csv,sessionType:"Einsatz",topic:`${d.type||"Einsatz"} · ${d.location||""}`.trim(),createdAt:info.createdAt||new Date(file.lastModified||Date.now()).toISOString(),presentCount:(d.members||[]).length,excusedCount:0,missingCount:0,operationData:d,hasImportedPdf:true};
    await saveImportedReportPdf(item.id,new File([pdf],item.pdfFileName,{type:"application/pdf"}));
    csvArchive=existing?csvArchive.map(entry=>entry.id===item.id?item:entry):[item,...csvArchive];
    saveArchive();renderHistory();renderStatistics();showToast("Einsatz-Terminpaket wurde vollständig importiert.");return;
  }
  const files=await packageFilesFromZip(file);await window.FFWReportImport.importHistoryFiles(files);
}
document.addEventListener("change",async event=>{const input=event.target;if(input?.id!=="historyReportsFileInput"||![...(input.files||[])].some(f=>/\.zip$/i.test(f.name)))return;event.stopImmediatePropagation();try{for(const file of [...input.files]){if(/\.zip$/i.test(file.name))await importTerminPackageFile(file);else await window.FFWReportImport.importHistoryFiles([file]);}}catch(error){console.error(error);showToast(error.message||"Terminpaket konnte nicht eingelesen werden.","error");}finally{input.value="";}},true);
function moveReportImportToSettings(){
  const oldPanel=byId("historyImportPanel"),input=byId("historyReportsFileInput"),settings=byId("settingsFilesView")||byId("archiveView");
  if(!oldPanel||!input||!settings||byId("reportImportSettingsCard"))return;
  input.accept=".zip,.csv,.pdf,application/zip,text/csv,application/pdf";
  const card=document.createElement("article");
  card.id="reportImportSettingsCard";
  card.className="storage-card storage-backup-card report-import-settings-card";
  card.innerHTML=`<div class="storage-card-heading"><span class="storage-card-kicker">Wiederherstellung und Übernahme</span><h3>Terminpaket importieren</h3><p class="help-text">ZIP-Terminpakete und ältere CSV-/PDF-Berichte bei Bedarf in Historie und Statistik übernehmen.</p></div><div class="storage-card-actions"><button class="primary-button" id="importTerminPackageButton" type="button">Terminpaket oder ältere Berichte auswählen</button></div><p class="help-text">Der normale Terminabschluss wird automatisch in der Historie gespeichert. Diese Funktion ist nur für Übernahme oder Wiederherstellung erforderlich.</p>`;
  card.appendChild(input);
  const center=byId("archiveStorageCenter"),backupGrid=byId("archiveStorageBackupGrid");
  if(backupGrid)backupGrid.appendChild(card);else if(center)center.appendChild(card);else settings.appendChild(card);
  byId("importTerminPackageButton").addEventListener("click",()=>input.click());
  oldPanel.remove();
}
document.addEventListener("DOMContentLoaded",()=>{setTimeout(moveReportImportToSettings,0);document.querySelectorAll("#homeStageFinishButton,#operationFinish").forEach(button=>button.textContent=button.id==="operationFinish"?"Einsatz abschließen · Terminpaket":"Probe abschließen · Terminpaket");});
if(document.readyState!=="loading")setTimeout(moveReportImportToSettings,0);


const zipStorageStyle=document.createElement("style");zipStorageStyle.textContent=`
.zip-storage-layout{display:grid;gap:24px;margin-top:20px}.zip-storage-section{display:grid;gap:14px}.zip-storage-heading{padding:0 2px}.zip-storage-heading span{display:block;color:#b00000;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.zip-storage-heading h3{margin:4px 0 3px;font-size:1.25rem}.zip-storage-heading p{margin:0;color:#555}.zip-storage-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.zip-storage-grid>.storage-card{margin:0;min-width:0}.zip-package-card{grid-column:1/-1;border-top:5px solid #c80000}.report-import-settings-card{border-top:5px solid #f2c500}@media(max-width:760px){.zip-storage-grid{grid-template-columns:1fr}.zip-package-card{grid-column:auto}}
`;document.head.appendChild(zipStorageStyle);

function reorganizeStorageAndBackups(){
  const page=byId("settingsFilesView")||byId("archiveView");
  if(!page||byId("zipStorageLayout"))return;
  const content=page.querySelector(".settings-subpage-content")||page;
  const csvCard=byId("csvFolderName")?.closest("article");
  const pdfCard=byId("pdfFolderName")?.closest("article");
  const backupCard=byId("backupFolderName")?.closest("article");
  const completeExport=byId("exportCompleteBackupButton");
  const completeImport=byId("importCompleteBackupButton");
  const importCard=byId("reportImportSettingsCard");

  const layout=document.createElement("div");layout.id="zipStorageLayout";layout.className="zip-storage-layout";
  const makeSection=(id,kicker,title,description)=>{const section=document.createElement("section");section.id=id;section.className="zip-storage-section";section.innerHTML=`<header class="zip-storage-heading"><span>${kicker}</span><h3>${title}</h3><p>${description}</p></header><div class="zip-storage-grid"></div>`;layout.appendChild(section);return section.querySelector(".zip-storage-grid");};
  const packageGrid=makeSection("zipPackageStorage","1 · Terminpakete","Terminpakete speichern","Beim Abschluss wird eine ZIP-Datei mit CSV, Haupt-PDF und optionalem Zusatzbericht gespeichert.");
  const recoveryGrid=makeSection("zipRecoveryStorage","2 · Wiederherstellung","Daten übernehmen oder wiederherstellen","Terminpakete, ältere Berichte und vollständige Datensicherungen einlesen.");
  const backupGrid=makeSection("zipBackupStorage","3 · Datensicherung","Komplett-Backup","Mitglieder, Einstellungen, Historie und Dokumentberichte unabhängig von den Terminpaketen sichern.");

  if(csvCard){csvCard.classList.add("zip-package-card");const heading=csvCard.querySelector("h3,h4");if(heading)heading.textContent="Speicherort für Terminpakete";const hint=byId("csvSupportHint");if(hint)hint.textContent=supportsPersistentDirectoryPicker?.()?"ZIP-Terminpakete werden direkt in diesem Ordner gespeichert.":"Beim Abschluss öffnet sich Teilen beziehungsweise „In Dateien sichern“ für das ZIP-Terminpaket.";const choose=byId("chooseCsvFolderButton");if(choose)choose.textContent="Ordner für Terminpakete auswählen";packageGrid.appendChild(csvCard);}
  if(pdfCard)pdfCard.remove();
  if(importCard)recoveryGrid.appendChild(importCard);

  if(completeImport){const card=document.createElement("article");card.className="storage-card storage-backup-card";card.innerHTML=`<div class="storage-card-heading"><span class="storage-card-kicker">Vollständige Wiederherstellung</span><h3>Komplett-Backup einlesen</h3><p class="help-text">Ersetzt nach Bestätigung Mitglieder, Einstellungen, Tagesdaten, Historie und gespeicherte Dokumentberichte.</p></div><div class="storage-card-actions"></div>`;card.querySelector(".storage-card-actions").appendChild(completeImport);recoveryGrid.appendChild(card);}
  if(backupCard){const heading=backupCard.querySelector("h3,h4");if(heading)heading.textContent="Speicherort für Komplett-Backups";backupGrid.appendChild(backupCard);}
  if(completeExport){const card=document.createElement("article");card.className="storage-card storage-backup-card";card.innerHTML=`<div class="storage-card-heading"><span class="storage-card-kicker">Notfallsicherung</span><h3>Vollständige Datensicherung erstellen</h3><p class="help-text">Diese Sicherung ist unabhängig von einzelnen ZIP-Terminpaketen und dient der Wiederherstellung der gesamten Anwendung.</p></div><div class="storage-card-actions"></div>`;card.querySelector(".storage-card-actions").appendChild(completeExport);backupGrid.appendChild(card);}

  content.querySelectorAll(".archive-storage-center,.archive-storage-backup-grid").forEach(node=>{if(node!==layout&&!node.contains(layout)&&node.children.length===0)node.remove();});
  content.appendChild(layout);
  const title=page.querySelector(".screen-heading h2");if(title)title.textContent="Speicherorte und Backups";
  const description=page.querySelector(".screen-heading p:not(.eyebrow)");if(description)description.textContent="ZIP-Terminpakete, Wiederherstellung und vollständige Datensicherung getrennt verwalten.";
}
const previousMoveReportImportToSettings=moveReportImportToSettings;
moveReportImportToSettings=function(){previousMoveReportImportToSettings();setTimeout(reorganizeStorageAndBackups,0);};
document.addEventListener("DOMContentLoaded",()=>setTimeout(reorganizeStorageAndBackups,50));
if(document.readyState!=="loading")setTimeout(reorganizeStorageAndBackups,50);
