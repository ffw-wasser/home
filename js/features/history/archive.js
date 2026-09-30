async function addCsvToArchive(fileName, content, sessionLabel, topic="") {
  const closedEntries = [...todayEntries()];
  const presentCount = closedEntries.filter(entry => entry.status === "Anwesend").length;
  const excusedCount = closedEntries.filter(entry => entry.status === "Entschuldigt").length;
  const recordedNames = new Set(closedEntries.flatMap(entry => [entry.storedName, entry.displayName].filter(Boolean)));
  const missingCount = members.filter(member => !member.ageDepartment && !recordedNames.has(nameForStorage(member)) && !recordedNames.has(nameForTile(member))).length;
  const archiveItem={ id: makeId(), fileName, content, sessionType: sessionLabel, createdAt: new Date().toISOString(), presentCount, excusedCount, missingCount, topic };
  csvArchive = [archiveItem, ...csvArchive];
  await commitPendingDocumentReport?.(archiveItem.id);
  saveArchive(); renderArchive();
}
function archiveDateLabel(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("de-DE", { dateStyle:"medium", timeStyle:"short" }); }
function renderArchive() {
  // Kompatibilitätsfunktion: sichtbare Einträge werden ausschließlich in der Historie gerendert.
  renderHistory?.();
}
async function exportArchiveItem(id) { const item=csvArchive.find(x=>x.id===id); if(!item)return; const result=await exportCsvFile(item.fileName,item.content,true); showToast(result==="failed"?"CSV konnte nicht ausgegeben werden.":result==="cancelled"?"Ausgabe wurde abgebrochen.":"CSV wurde erneut ausgegeben.",result==="failed"||result==="cancelled"?"error":"success"); }
async function deleteArchiveItem(id) { const item=csvArchive.find(x=>x.id===id); if(!item||!confirm(`Archivdatei „${item.fileName}“ löschen?`))return; csvArchive=csvArchive.filter(x=>x.id!==id); await deleteImportedReportPdf?.(id); await deleteDocumentReportsForArchive?.(id); saveArchive(); renderArchive(); showToast("Archivdatei gelöscht."); }
async function exportArchiveBackup() {
  const name = `FFW-Wasser_Archiv-Backup_${today()}.json`;
  await shareOrDownloadJson(name, { version:"1.0", createdAt:new Date().toISOString(), items:csvArchive }, "Archiv-Backup wurde ausgegeben.");
}
async function importArchiveBackup(file) { if(!confirm("Das Einlesen ergänzt beziehungsweise ersetzt Einträge im CSV-Archiv. Wirklich fortfahren?")){byId("backupFileInput").value="";return;} try { const data=JSON.parse(await file.text()); if(!Array.isArray(data.items))throw new Error(); const valid=data.items.filter(x=>x&&x.id&&x.fileName&&typeof x.content==="string"); const map=new Map([...valid,...csvArchive].map(x=>[x.id,x])); csvArchive=[...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); saveArchive();renderArchive();showToast(`${valid.length} Archiveinträge wurden eingelesen.`); } catch { showToast("Die Backup-Datei ist ungültig.","error"); } finally { byId("backupFileInput").value=""; } }

async function shareOrDownloadJson(fileName, data, successMessage) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  try {
    if (await writeJsonToBackupFolder(fileName, content)) {
      showToast(`${successMessage} ${fileName} wurde in „${backupDirectoryHandle.name}“ gespeichert.`);
      return;
    }
  } catch (error) {
    showToast("Direktes Speichern war nicht möglich. Teilen oder Download wird verwendet.", "error");
  }
  try {
    if (typeof File === "function" && navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        showToast(`${successMessage} ${fileName} wurde geteilt.`);
        return;
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = fileName; link.rel = "noopener"; link.style.display = "none";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(`${successMessage} ${fileName} wurde heruntergeladen.`);
  } catch (error) {
    showToast("Backup konnte nicht ausgegeben werden.", "error");
  }
}
function completeBackupPayload() {
  return BackupEngine.create({
    members: members.map(member=>({...member,roles:getMemberRoles(member)})),
    entries, csvArchive, roleTargets:getRoleTargets(),
    functionEntryEnabled:isFunctionEntryEnabled()
  });
}
async function exportCompleteBackup() {
  const fileName = `FFW-Wasser_Komplett-Backup_${today()}.json`;
  const payload=completeBackupPayload();
  payload.data.importedPdfs=await exportImportedReportPdfs();
  payload.data.documentReports=await exportDocumentReports?.()||[];
  payload.data.backupInfo={pdfCount:payload.data.importedPdfs.length,documentReportCount:payload.data.documentReports.length,includesImportedPdfs:true,includesDocumentReports:true};
  await shareOrDownloadJson(fileName, payload, `Komplett-Backup wurde mit ${payload.data.importedPdfs.length} importierten PDF-Datei(en) ausgegeben.`);
}
function validBackupMember(member) {
  return member && typeof member.id === "string" && typeof member.lastName === "string" && typeof member.firstName === "string";
}
async function parseCompleteBackupFile(file) {
  const raw=await file.text();
  const text=String(raw||"").replace(/^\uFEFF/,"").trim();
  if(!text)throw new Error("empty");
  let backup;
  try{backup=JSON.parse(text);}catch(error){throw new Error("json");}
  if(backup?.format!=="Feuerwehr-Wasser-Komplett-Backup")throw new Error("format");
  if(!backup.data||!Array.isArray(backup.data.members))throw new Error("data");
  return backup;
}
function normalizeCompleteBackupData(data) {
  const importedMembers=data.members.filter(validBackupMember).map(member=>({
    id:String(member.id),
    lastName:String(member.lastName).trim(),
    firstName:String(member.firstName).trim(),
    roles:Array.isArray(member.roles)?member.roles.filter(role=>AVAILABLE_ROLES.includes(role)&&role!=="Maschinist"):[],
    ageDepartment:Boolean(member.ageDepartment),
    machinistVehicles:Array.isArray(member.machinistVehicles)?member.machinistVehicles.filter(value=>value==="LF"||value==="TSF"):[],
    rfidId:String(member.rfidId||"").trim(),
    committeeMember:Boolean(member.committeeMember),
    atueQualified:Boolean(member.atueQualified),breathingClearance:Boolean(member.breathingClearance),breathingClearanceUntil:String(member.breathingClearanceUntil||""),
    driverLicenseCheckedOn:String(member.driverLicenseCheckedOn||"")
  })).filter(member=>member.lastName&&member.firstName);
  if(!importedMembers.length)throw new Error("members");
  return {
    members:importedMembers,
    entries:Array.isArray(data.entries)?data.entries.filter(entry=>entry&&entry.id&&entry.date&&entry.storedName):[],
    csvArchive:Array.isArray(data.csvArchive)?data.csvArchive.filter(item=>item&&item.id&&item.fileName&&typeof item.content==="string"):[],
    functionEntryEnabled:data.functionEntryEnabled,
    roleTargets:data.roleTargets&&typeof data.roleTargets==="object"?data.roleTargets:{}
  };
}
function saveCompleteBackupData(data) {
  const serialized={
    members:JSON.stringify(data.members),
    entries:JSON.stringify(data.entries),
    archive:JSON.stringify(data.csvArchive),
    targets:JSON.stringify(Object.fromEntries(AVAILABLE_ROLES.map(role=>[role,Math.max(0,Math.min(99,Number.parseInt(data.roleTargets[role],10)||0))])))
  };
  try{
    safeStorage.setItem(KEYS.members,serialized.members);
    safeStorage.setItem(KEYS.entries,serialized.entries);
    safeStorage.setItem(KEYS.archive,serialized.archive);
    safeStorage.setItem(KEYS.functionEntry,data.functionEntryEnabled===false?"false":"true");
    safeStorage.setItem(KEYS.roleTargets,serialized.targets);
    // Das lokale Passwort wird bei einer Wiederherstellung bewusst nicht ersetzt.
  }catch(error){
    if(error?.name==="QuotaExceededError")throw new Error("storage");
    throw new Error("save");
  }
  members=data.members;
  entries=data.entries;
  csvArchive=data.csvArchive;
}
function refreshAfterCompleteBackupImport() {
  const updates=[
    ["Terminart",()=>renderSessionType()],
    ["Mitglieder",()=>renderMembers()],
    ["Funktionen",()=>renderRoles()],
    ["Tagesdaten",()=>renderEntries()],
    ["Administration",()=>renderAdmin()],
    ["Historie",()=>renderArchive()],
    ["Statistik",()=>renderStatistics()],
    ["Auswahl",()=>updateSelection()],
    ["Arbeitsablauf",()=>updateProbeWorkflow()],
    ["Hauptaktion",()=>updatePrimaryAction()]
  ];
  const failed=[];
  updates.forEach(([name,action])=>{try{action();}catch(error){console.error(`Anzeige ${name} konnte nicht aktualisiert werden`,error);failed.push(name);}});
  return failed;
}
async function importCompleteBackup(file) {
  const input=byId("completeBackupFileInput");
  if(!confirm("Das Komplett-Backup ersetzt Mitglieder, Einstellungen, Jahresziele, Tagesdaten und die Historie. Wirklich wiederherstellen?")){if(input)input.value="";return;}
  try{
    const backup=await parseCompleteBackupFile(file);
    const normalized=normalizeCompleteBackupData(backup.data);
    if(!confirm(`Backup geprüft: ${normalized.members.length} Mitglieder und ${normalized.csvArchive.length} Historieneinträge gefunden. Jetzt wiederherstellen?`))return;
    saveCompleteBackupData(normalized);
    csvArchive=normalized.csvArchive;
    const restoredPdfs=await restoreImportedReportPdfs(backup.data.importedPdfs);
    const restoredDocuments=await restoreDocumentReports?.(backup.data.documentReports)||0;
    chosenMemberId="";
    chosenMemberIds.clear();
    chosenRole="";
    const displayFailures=refreshAfterCompleteBackupImport();
    if(displayFailures.length){
      showToast("Backup wurde gespeichert. Bitte die App einmal neu öffnen, damit alle Ansichten aktualisiert werden.","success");
    }else{
      showToast(`Komplett-Backup wurde erfolgreich wiederhergestellt. ${restoredPdfs} PDF-Datei(en) wurden übernommen.`,"success");
    }
  }catch(error){
    console.error("Komplett-Backup-Import fehlgeschlagen",error);
    const messages={
      empty:"Die ausgewählte Datei ist leer.",
      json:"Die ausgewählte Datei enthält kein lesbares JSON.",
      format:"Die Datei ist kein Komplett-Backup der Feuerwehr-Wasser-App.",
      data:"Im Backup fehlt der vollständige Datenbereich.",
      members:"Im Backup wurden keine gültigen Mitglieder gefunden.",
      storage:"Das Backup ist gültig, aber der verfügbare Browser-Speicher reicht nicht aus.",
      save:"Das Backup ist gültig, konnte aber nicht im Browser gespeichert werden."
    };
    showToast(messages[error?.message]||`Wiederherstellung fehlgeschlagen (${error?.message||"unbekannter Fehler"}).`,"error");
  }finally{
    if(input)input.value="";
  }
}

function archiveRowsFromContent(content){return parseCsvRows(content);}
function archiveCsvFromRows(rows,topic=""){const header="Datum;Uhrzeit;Name;Terminart;Status;Funktion / Status;Thema";return "\ufeff"+[header,...rows.map(row=>[row.date,row.time,row.name,row.sessionType,row.status,row.role,row.topic||topic].map(csvCell).join(";"))].join("\r\n");}
let archiveCorrectionState=null;
function ensureArchiveCorrectionDialog(){
  const dialog=byId("archiveCorrectionDialog");
  if(!dialog||dialog.dataset.bound)return;
  dialog.dataset.bound="true";
  byId("cancelCorrectionButton").addEventListener("click",()=>dialog.close());
  byId("correctionPerson").addEventListener("change",loadSelectedCorrectionRow);
  byId("correctionStatus").addEventListener("change",updateCorrectionRoleVisibility);
  if(!byId("correctionDate")){const person=byId("correctionPerson");const label=document.createElement("label");label.htmlFor="correctionDate";label.textContent="Probetermin";const input=document.createElement("input");input.id="correctionDate";input.type="date";input.className="text-input";person.parentElement.insertBefore(input,person);person.parentElement.insertBefore(label,input);}
  byId("saveCorrectionButton").addEventListener("click",saveArchiveCorrection);
}
function updateCorrectionRoleVisibility(){
  const present=byId("correctionStatus").value==="Anwesend";
  byId("correctionRole").hidden=!present;byId("correctionRoleLabel").hidden=!present;
  if(!present)byId("correctionRole").value="";
}
function correctionMemberForRow(row){
  const rowName=String(row?.name||"").trim();
  return members.find(member=>nameForStorage(member)===rowName||nameForTile(member)===rowName)||null;
}
function correctionRolesForRow(row){
  const member=correctionMemberForRow(row);
  if(!member||member.ageDepartment)return [];
  const roles=[...new Set(getMemberRoles(member).filter(Boolean))];
  const vehicles=Array.isArray(member.machinistVehicles)?member.machinistVehicles:[];
  if(vehicles.length&&!roles.includes("Maschinist"))roles.push("Maschinist");
  return roles;
}
function loadSelectedCorrectionRow(){
  if(!archiveCorrectionState)return;
  const row=archiveCorrectionState.rows[Number(byId("correctionPerson").value)];if(!row)return;
  const roleSelect=byId("correctionRole");
  const isGeneral=(archiveCorrectionState.item.sessionType||archiveCorrectionState.rows[0]?.sessionType)==="Allgemeine Probe";
  const allowedRoles=isGeneral?correctionRolesForRow(row):[row.role||""];
  roleSelect.innerHTML='<option value="">Bitte Funktion auswählen</option>'+allowedRoles.map(role=>`<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("");
  byId("correctionStatus").value=row.status||"Fehlt";
  roleSelect.value=allowedRoles.includes(row.role)?row.role:"";
  updateCorrectionRoleVisibility();
}
function correctArchiveItem(id){
  const item=csvArchive.find(x=>x.id===id);if(!item)return;
  const rows=archiveRowsFromContent(item.content);if(!rows.length)return showToast("Keine korrigierbaren Einträge.","error");
  ensureArchiveCorrectionDialog();archiveCorrectionState={item,rows};
  byId("correctionPerson").innerHTML=rows.map((row,index)=>`<option value="${index}">${escapeHtml(row.name)} · ${escapeHtml(row.status)}${row.role?` · ${escapeHtml(row.role)}`:""}</option>`).join("");
  loadSelectedCorrectionRow();byId("correctionDate").value=rows[0]?.date||historyDateFromItem(item);byId("archiveCorrectionDialog").showModal();
}
function pairedArchiveFileNames(item){
  const current=String(item.fileName||"Probe.csv");
  const base=(item.baseFileName||current).replace(/_korrigiert-v\d+(?=\.csv$)/i,"").replace(/\.csv$/i,"");
  return {base,csv:`${base}.csv`,pdf:`${base}.pdf`};
}
async function saveArchiveCorrection(){
  if(!archiveCorrectionState)return;
  const {item,rows}=archiveCorrectionState,index=Number(byId("correctionPerson").value),row=rows[index];if(!row)return;
  const status=byId("correctionStatus").value,role=status==="Anwesend"?byId("correctionRole").value.trim():"";
  const correctedDate=byId("correctionDate")?.value||row.date;
  if(!correctedDate)return showToast("Bitte einen gültigen Probetermin auswählen.","error");
  const isGeneral=(item.sessionType||rows[0]?.sessionType)==="Allgemeine Probe";
  if(status==="Anwesend"&&isGeneral&&!role){
    showToast("Bitte eine für diese Person freigegebene Funktion auswählen.","error");
    return;
  }
  const original={status:row.status,role:row.role,date:row.date};rows.forEach(item=>item.date=correctedDate);row.status=status;row.role=role;
  item.revisions=[...(item.revisions||[]),{changedAt:new Date().toISOString(),name:row.name,original,updated:{status,role}}];
  item.topic=item.topic||rows[0]?.topic||"";
  item.content=archiveCsvFromRows(rows,item.topic);
  item.correctedAt=new Date().toISOString();

  const oldNames=pairedArchiveFileNames(item);
  const safeType=String(item.sessionType||rows[0]?.sessionType||"Probe").replace(/ /g,"-");
  const names={base:`FFW-Wasser_${correctedDate}_${safeType}`,csv:`FFW-Wasser_${correctedDate}_${safeType}.csv`,pdf:`FFW-Wasser_${correctedDate}_${safeType}.pdf`};
  item.baseFileName=`${names.base}.csv`;
  item.fileName=names.csv;
  item.pdfFileName=names.pdf;
  item.hasImportedPdf=false;
  await deleteImportedReportPdf?.(item.id);

  const counts={
    present:rows.filter(x=>x.status==="Anwesend").length,
    excused:rows.filter(x=>x.status==="Entschuldigt").length,
    missing:rows.filter(x=>x.status==="Fehlt").length,
    notApplicable:rows.filter(x=>x.status==="Betrifft nicht").length
  };
  const correctedPdf=probePdfBlob(
    rows.map(x=>({time:x.time,name:x.name,status:x.status,role:x.role})),
    item.sessionType||rows[0]?.sessionType||"Probe",
    counts,
    item.topic||rows[0]?.topic||"",
    row.date || rows[0]?.date || historyDateFromItem(item)
  );

  let csvOverwritten=false,pdfOverwritten=false;
  try{csvOverwritten=await writeCsvToSelectedFolder(names.csv,item.content);}catch(error){csvOverwritten=false;}
  try{pdfOverwritten=await savePdfToSelectedFolder(names.pdf,correctedPdf);}catch(error){pdfOverwritten=false;}

  saveArchive();renderArchive();renderStatistics();renderHistory();byId("archiveCorrectionDialog").close();

  if(!csvOverwritten){
    const csvResult=await exportCsvFile(names.csv,item.content,true);
    if(csvResult==="failed"||csvResult==="cancelled")showToast("Korrektur gespeichert. Die CSV-Ausgabe wurde abgebrochen.","error");
  }
  if(!pdfOverwritten)downloadBlob(names.pdf,correctedPdf);

  if(csvOverwritten&&pdfOverwritten)showToast("Korrektur gespeichert. Zugehörige CSV und PDF wurden überschrieben.");
  else if(pdfOverwritten)showToast("Korrektur gespeichert. Das zugehörige PDF wurde überschrieben; CSV wurde ausgegeben.");
  else if(csvOverwritten)showToast("Korrektur gespeichert. Die CSV wurde überschrieben; PDF wurde neu ausgegeben.");
  else showToast("Korrektur gespeichert. CSV und PDF wurden neu ausgegeben.");
}
function historyNormalizeDate(value){
  const raw=String(value||"").trim();
  let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(match)return `${match[1]}-${match[2]}-${match[3]}`;
  match=raw.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})$/);
  if(match)return `${match[3]}-${match[2]}-${match[1]}`;
  const parsed=new Date(raw);
  return Number.isNaN(parsed.getTime())?"":`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
}
function historyDateFromItem(item){
  const rows=parseCsvRows(item.content);
  return historyNormalizeDate(item.operationData?.date||rows[0]?.date||String(item.createdAt||"").slice(0,10));
}
function historyDateLabel(item){return formatDisplayDate(historyDateFromItem(item));}
function historyYearFromItem(item){return historyDateFromItem(item).slice(0,4)||"Unbekannt";}
function historyCountsForItem(item){
  const rows=parseCsvRows(item.content);
  return {rows,present:rows.filter(x=>x.status==="Anwesend").length,excused:rows.filter(x=>x.status==="Entschuldigt").length,missing:rows.filter(x=>x.status==="Fehlt").length,notApplicable:rows.filter(x=>x.status==="Betrifft nicht").length};
}
function ensureHistoryView(){
  const section=byId("settingsHistoryView")||byId("historyView");
  if(!section||section.dataset.bound)return;
  section.dataset.bound="true";
  const home=section.querySelector("[data-history-home]");
  if(home)home.addEventListener("click",()=>showView("settingsView"));
  section.addEventListener("click",e=>{
    const pdf=e.target.closest("[data-history-pdf]");
    const csv=e.target.closest("[data-history-csv]");
    const correct=e.target.closest("[data-history-correct]");
    const remove=e.target.closest("[data-history-delete]");
    if(pdf)openHistoryPdf(pdf.dataset.historyPdf);
    else if(csv)exportArchiveItem(csv.dataset.historyCsv);
    else if(correct){const item=csvArchive.find(entry=>entry.id===correct.dataset.historyCorrect);if(item?.sessionType==="Einsatz")editArchivedOperation(item.id);else correctArchiveItem(item?.id);}
    else if(remove)deleteArchiveItem(remove.dataset.historyDelete);
  });
}
function ensureHistoryMenu(){
  if(byId("historyTab"))return;
  const button=document.createElement("button");button.className="compact-menu-button";button.id="historyTab";button.type="button";button.textContent="Historie";
  const menu=byId("compactMenu"), help=byId("helpTab");menu.insertBefore(button,help||null);
  button.addEventListener("click",()=>{renderHistory();showView("historyView");});
}
function historyMonthKey(item){return historyDateFromItem(item).slice(0,7)||"Unbekannt";}
function historyMonthLabel(key){
  if(!/^\d{4}-\d{2}$/.test(key))return "Unbekannter Monat";
  const date=new Date(`${key}-01T12:00:00`);
  return date.toLocaleDateString("de-DE",{month:"long"}).replace(/^./,c=>c.toLocaleUpperCase("de-DE"));
}
function renderHistory(){
  ensureHistoryView();
  const sorted=[...csvArchive].sort((a,b)=>historyDateFromItem(b).localeCompare(historyDateFromItem(a))||String(b.createdAt).localeCompare(String(a.createdAt)));
  const years=new Map();
  sorted.forEach(item=>{
    const year=historyYearFromItem(item),month=historyMonthKey(item);
    if(!years.has(year))years.set(year,new Map());
    if(!years.get(year).has(month))years.get(year).set(month,[]);
    years.get(year).get(month).push(item);
  });
  const now=new Date(),currentYear=String(now.getFullYear()),currentMonth=`${currentYear}-${String(now.getMonth()+1).padStart(2,"0")}`;
  byId("historyEmpty").hidden=sorted.length>0;
  byId("historyYears").innerHTML=[...years.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([year,months])=>{
    const yearCount=[...months.values()].reduce((sum,items)=>sum+items.length,0);
    const yearOpen=year===currentYear?" open":"";
    const monthHtml=[...months.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([month,items])=>{
      const monthOpen=month===currentMonth?" open":"";
      return `<details class="history-month"${monthOpen}><summary><span>${escapeHtml(historyMonthLabel(month))}</span><small>${items.length} Bericht${items.length===1?"":"e"}</small><i aria-hidden="true"></i></summary><div class="history-list">${items.map(item=>{const date=historyDateLabel(item),topic=item.topic||parseCsvRows(item.content)[0]?.topic||"Ohne Thema";return `<article class="history-item${item.revisions?.length?" history-item-corrected":""}"><div class="history-item-details"><strong>${escapeHtml(date)} · ${escapeHtml(item.sessionType||"Probe")}</strong><span>${escapeHtml(topic)}</span><small>${escapeHtml(item.fileName)}${item.revisions?.length?` · ${item.revisions.length} Korrektur(en)`:""}</small></div><div class="history-item-actions"><button class="primary-button" type="button" data-history-pdf="${escapeHtml(item.id)}">${item.sessionType==="Einsatz"?"Einsatzbericht ansehen":"PDF ansehen"}</button><button class="secondary-button" type="button" data-history-csv="${escapeHtml(item.id)}">CSV ausgeben</button><button class="outline-button" type="button" data-history-correct="${escapeHtml(item.id)}" title="Aktualisiert CSV und zugehöriges PDF">${item.sessionType==="Einsatz"?"Einsatz korrigieren":"Eintrag korrigieren"}</button><button class="danger-button" type="button" data-history-delete="${escapeHtml(item.id)}">Löschen</button></div></article>`;}).join("")}</div></details>`;
    }).join("");
    return `<details class="history-year"${yearOpen}><summary class="history-year-heading"><h3>${escapeHtml(year)}</h3><span>${yearCount} Bericht${yearCount===1?"":"e"}</span><i aria-hidden="true"></i></summary><div class="history-months">${monthHtml}</div></details>`;
  }).join("");
  window.SmartWorkflow?.history?.();
}
let historyPdfPreviewUrl="";
let historyPdfPreviewBlob=null;
let historyPdfPreviewName="";
function ensureHistoryPdfPreview(){
  let dialog=byId("historyPdfPreviewDialog");
  if(dialog)return dialog;
  dialog=document.createElement("dialog");
  dialog.id="historyPdfPreviewDialog";
  dialog.className="history-pdf-preview-dialog";
  dialog.innerHTML=`<div class="history-pdf-preview-shell"><header><div><small>Historie</small><h2 id="historyPdfPreviewTitle">PDF-Bericht</h2></div><button type="button" class="outline-button" data-history-pdf-close>Schließen</button></header><div class="history-pdf-preview-body"><iframe id="historyPdfPreviewFrame" title="PDF-Vorschau"></iframe></div><footer><button type="button" class="outline-button" id="historyPdfShareButton">Teilen / speichern</button><button type="button" class="primary-button" data-history-pdf-close>Vorschau schließen</button></footer></div>`;
  document.body.appendChild(dialog);
  const close=()=>{
    try{dialog.close();}catch{dialog.removeAttribute("open");}
    byId("historyPdfPreviewFrame")?.removeAttribute("src");
    if(historyPdfPreviewUrl){URL.revokeObjectURL(historyPdfPreviewUrl);historyPdfPreviewUrl="";}
    historyPdfPreviewBlob=null;historyPdfPreviewName="";
  };
  dialog.querySelectorAll("[data-history-pdf-close]").forEach(button=>button.onclick=close);
  dialog.oncancel=event=>{event.preventDefault();close();};
  byId("historyPdfShareButton").onclick=async()=>{
    if(!historyPdfPreviewBlob)return;
    const isiPad=/iPad|Macintosh/i.test(navigator.userAgent||"")&&("ontouchend" in document);
    if(isiPad&&typeof File==="function"&&navigator.share&&navigator.canShare){
      const file=new File([historyPdfPreviewBlob],historyPdfPreviewName,{type:"application/pdf",lastModified:Date.now()});
      if(navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:historyPdfPreviewName});}catch(error){if(error?.name!=="AbortError")showToast("PDF konnte nicht geteilt werden.","error");}return;}
    }
    downloadBlob(historyPdfPreviewName,historyPdfPreviewBlob);
  };
  return dialog;
}
function showHistoryPdfPreview(blob,fileName){
  const dialog=ensureHistoryPdfPreview();
  if(historyPdfPreviewUrl)URL.revokeObjectURL(historyPdfPreviewUrl);
  historyPdfPreviewBlob=blob;historyPdfPreviewName=fileName;
  historyPdfPreviewUrl=URL.createObjectURL(blob instanceof Blob&&blob.type==="application/pdf"?blob:new Blob([blob],{type:"application/pdf"}));
  byId("historyPdfPreviewTitle").textContent=fileName;
  const isiPhonePdf=/iPhone|iPad|iPod/i.test(navigator.userAgent||"")||(/Macintosh/i.test(navigator.userAgent||"")&&("ontouchend" in document));
  if(isiPhonePdf){
    // Ein echtes Link-Ziel oeffnet auf iOS den nativen PDF-Viewer statt des
    // eingebetteten Einseiten-Previews. Dort sind Seite 1 und Seite 2 scrollbar.
    const link=document.createElement("a");
    link.href=historyPdfPreviewUrl;
    link.target="_blank";
    link.rel="noopener";
    link.download=fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    try{dialog.close?.();}catch(error){}
    return;
  }
  byId("historyPdfPreviewFrame").src=historyPdfPreviewUrl+"#toolbar=1&navpanes=0&view=FitH";
  dialog.showModal();
}
async function openHistoryPdf(id){
  const item=csvArchive.find(x=>x.id===id);if(!item)return;
  // Einsätze werden immer aus den strukturierten Einsatzdaten als Einsatzbericht erzeugt.
  // Ein möglicherweise falsch zugeordnetes oder älteres Proben-PDF darf diesen Bericht nicht ersetzen.
  if(item.operationData||String(item.sessionType||"").trim()==="Einsatz"){
    const operationName=item.pdfFileName||`FFW-Wasser_${historyDateFromItem(item)}_Einsatzbericht.pdf`;
    if(item.operationData){showHistoryPdfPreview(await operationPdfBlob(item.operationData),operationName);return;}
    const stored=item.hasImportedPdf?await loadImportedReportPdf?.(id):null;
    if(stored){showHistoryPdfPreview(stored,operationName);return;}
    showToast("Für diesen Einsatz fehlen strukturierte Einsatzdaten und ein gespeichertes Einsatz-PDF.","error");return;
  }
  const imported=item.hasImportedPdf?await loadImportedReportPdf?.(id):null;
  if(imported){
    const fileName=item.pdfFileName||item.fileName.replace(/\.csv$/i,".pdf");
    showHistoryPdfPreview(imported,fileName);
    return;
  }
  const data=historyCountsForItem(item),topic=item.topic||data.rows[0]?.topic||"";
  const pdfRows=data.rows.map(x=>({time:x.time,name:x.name,status:x.status,role:x.role}));
  const blob=probePdfBlob(pdfRows,item.sessionType||data.rows[0]?.sessionType||"Probe",{present:data.present,excused:data.excused,missing:data.missing,notApplicable:data.notApplicable},topic,data.rows[0]?.date||historyDateFromItem(item));
  const fileName=item.fileName.replace(/\.csv$/i,".pdf");
  showHistoryPdfPreview(blob,fileName);
}
