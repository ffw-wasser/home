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
const deletingArchiveIds=new Set();
async function deleteArchiveItem(id){
  if(!requireAdmin("settingsHistoryView")||deletingArchiveIds.has(id))return;
  const item=csvArchive.find(entry=>entry.id===id);if(!item)return;
  const name=item.packageFileName||item.fileName;
  const message=item.oneDriveLive?`Terminpaket „${name}“ in OneDrive löschen? Der Bericht einschließlich CSV, PDF und Zusatzdokumenten wird entfernt.`:`Archivdatei „${name}“ löschen?`;
  if(!confirm(message))return;
  if(typeof captureQualitySnapshot==="function")captureQualitySnapshot("Vor Löschen eines Archiveintrags");
  deletingArchiveIds.add(id);
  try{
    if(item.oneDriveLive)await window.deleteOneDriveHistoryItem(item);
    csvArchive=csvArchive.filter(entry=>entry.id!==id);
    try{await deleteImportedReportPdf?.(id);await deleteDocumentReportsForArchive?.(id);}catch(error){console.warn("Lokale Berichtskopien konnten nicht vollständig entfernt werden",error);}
    saveArchive();renderArchive();renderHistory();renderStatistics();
    showToast(item.oneDriveLive?"Terminpaket in OneDrive gelöscht.":"Archivdatei gelöscht.");
    if(item.oneDriveLive)await window.loadOneDriveHistory();
  }catch(error){console.error("Bericht konnte nicht gelöscht werden",error);showToast(`Löschen in OneDrive nicht bestätigt. ${error.message||"Bitte erneut versuchen."}`,"error");}
  finally{deletingArchiveIds.delete(id);}
}

async function exportArchiveBackup() {
  const name = `FFW-Wasser_Archiv-Backup_${today()}.json`;
  await shareOrDownloadJson(name, { version:"1.0", createdAt:new Date().toISOString(), items:csvArchive }, "Archiv-Backup wurde ausgegeben.");
}
async function importArchiveBackup(file) { if(!requireAdmin("settingsHistoryView"))return; if(!confirm("Das Einlesen ergänzt beziehungsweise ersetzt Einträge im CSV-Archiv. Wirklich fortfahren?")){byId("backupFileInput").value="";return;} try { const data=JSON.parse(await file.text()); if(!Array.isArray(data.items))throw new Error(); const valid=data.items.filter(x=>x&&x.id&&x.fileName&&typeof x.content==="string"); const map=new Map([...valid,...csvArchive].map(x=>[x.id,x])); csvArchive=[...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); saveArchive();renderArchive();showToast(`${valid.length} Archiveinträge wurden eingelesen.`); } catch { showToast("Die Backup-Datei ist ungültig.","error"); } finally { byId("backupFileInput").value=""; } }

async function shareOrDownloadJson(fileName, data, successMessage) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  try {
    if (await writeJsonToBackupFolder(fileName, content)) {
      showToast(`${successMessage} ${fileName} wurde in „${backupDirectoryHandle.name}“ gespeichert.`);
      return "saved";
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
        return "shared";
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") return "cancelled";
  }
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = fileName; link.rel = "noopener"; link.style.display = "none";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(`${successMessage} ${fileName} Download wurde gestartet.`);return "downloaded";
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
async function exportCompleteBackup() { if(!requireAdmin("settingsFilesView"))return;
  const fileName = `FFW-Wasser_App-Daten_${today()}.json`;
  const payload=completeBackupPayload();
  payload.data.importedPdfs=await exportImportedReportPdfs();
  payload.data.documentReports=await exportDocumentReports?.()||[];
  payload.data.backupInfo={pdfCount:payload.data.importedPdfs.length,documentReportCount:payload.data.documentReports.length,includesImportedPdfs:true,includesDocumentReports:true};
  const result=await shareOrDownloadJson(fileName, payload, `App-Datensicherung wurde mit ${payload.data.importedPdfs.length} importierten PDF-Datei(en) ausgegeben.`);if(["saved","shared","downloaded"].includes(result))window.WorkflowUX?.backupResult(fileName,payload,result);
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
    g262ValidUntil:String(member.g262ValidUntil||""),g263ValidUntil:String(member.g263ValidUntil||""),agtInstructionValidUntil:String(member.agtInstructionValidUntil||""),ffiValidUntil:String(member.ffiValidUntil||""),
    driverLicenseCheckedOn:String(member.driverLicenseCheckedOn||""),
    ...(typeof member.breathingQualified==="boolean"?{breathingQualified:member.breathingQualified}:{}),
    driverLicenseIntervalMonths:Number.isInteger(member.driverLicenseIntervalMonths)&&member.driverLicenseIntervalMonths>=1&&member.driverLicenseIntervalMonths<=36?member.driverLicenseIntervalMonths:12
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
async function importCompleteBackup(file) { if(!requireAdmin("settingsFilesView"))return;
  const input=byId("completeBackupFileInput");
  if(!confirm("Diese App-Datensicherung ersetzt Mitglieder, Einstellungen, Jahresziele, Tagesdaten und die Historie. Getränkekonten und Getränke-PINs werden separat in OneDrive gesichert. Wirklich wiederherstellen?")){if(input)input.value="";return;}
  try{
    const backup=await parseCompleteBackupFile(file);
    const normalized=normalizeCompleteBackupData(backup.data);
    if(!confirm(`Backup geprüft: ${normalized.members.length} Mitglieder und ${normalized.csvArchive.length} Historieneinträge gefunden. Jetzt wiederherstellen?`))return;
    if(typeof captureQualitySnapshot==="function")captureQualitySnapshot("Vor Wiederherstellung eines Komplett-Backups");
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
  if(!byId("correctionDate")){const person=byId("correctionPerson");const label=document.createElement("label");label.htmlFor="correctionDate";label.textContent="Termindatum";const input=document.createElement("input");input.id="correctionDate";input.type="date";input.className="text-input";const personLabel=person.parentElement.querySelector('label[for="correctionPerson"]');person.parentElement.insertBefore(label,personLabel);label.insertAdjacentElement("afterend",input);const hint=document.createElement("p");hint.className="help-text";hint.textContent="Ein geändertes Termindatum gilt für den gesamten Bericht.";input.insertAdjacentElement("afterend",hint);}
  if(!byId("correctionName")){
    const label=document.createElement("label");label.htmlFor="correctionName";label.textContent="Name im Bericht";
    const input=document.createElement("input");input.id="correctionName";input.type="text";input.className="text-input";input.maxLength=150;
    byId("correctionPerson").insertAdjacentElement("afterend",label);label.insertAdjacentElement("afterend",input);
  }
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
  byId("correctionName").value=row.name||"";
  const roleSelect=byId("correctionRole");
  const isGeneral=(archiveCorrectionState.item.sessionType||archiveCorrectionState.rows[0]?.sessionType)==="Allgemeine Probe";
  const allowedRoles=isGeneral?correctionRolesForRow(row):[row.role||""];
  roleSelect.innerHTML='<option value="">Bitte Funktion auswählen</option>'+allowedRoles.map(role=>`<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("");
  byId("correctionStatus").value=row.status||"Fehlt";
  roleSelect.value=allowedRoles.includes(row.role)?row.role:"";
  updateCorrectionRoleVisibility();
}
function archiveCorrectionWorkspace(){
  let panel=byId("archiveCorrectionWorkspace");
  if(panel)return panel;
  panel=document.createElement("section");
  panel.id="archiveCorrectionWorkspace";
  panel.className="panel archive-correction-workspace";
  panel.setAttribute("aria-labelledby","archiveCorrectionHeading");
  panel.innerHTML='<div class="archive-correction-heading"><div><p class="eyebrow">Archivkorrektur · Schritt 2</p><h2 id="archiveCorrectionHeading">Termin und Personen korrigieren</h2><p>Den vorhandenen Bericht bearbeiten. Erst mit „Originalbericht speichern“ wird die bestehende Datei überschrieben.</p></div><button type="button" id="archiveCorrectionBack" class="outline-button">Zur Historie</button></div><div class="archive-correction-meta"><label>Termindatum<input id="archiveCorrectionEditDate" type="date" class="text-input"></label><label>Thema<textarea id="archiveCorrectionEditTopic" class="text-input" rows="2" maxlength="300" required></textarea></label></div><div class="archive-correction-toolbar"><label>Person suchen<input type="search" id="archiveCorrectionSearch" class="text-input" placeholder="Name suchen …" autocomplete="off"></label><label>Teilnahme filtern<select id="archiveCorrectionFilter" class="text-input"><option value="">Alle Personen</option><option value="Anwesend">Anwesend</option><option value="Entschuldigt">Entschuldigt</option><option value="Fehlt">Fehlt</option><option value="Betrifft nicht">Betrifft nicht</option></select></label><p id="archiveCorrectionCount" aria-live="polite"></p></div><div id="archiveCorrectionList" class="archive-correction-list"></div><div class="archive-correction-add"><label>Person ergänzen<select id="archiveCorrectionAddPerson" class="text-input"><option value="">Mitglied auswählen</option></select></label><button type="button" class="outline-button" id="archiveCorrectionAdd">Person ergänzen</button></div><div class="archive-correction-actions"><button type="button" class="outline-button" id="archiveCorrectionCancel">Abbrechen</button><button type="button" class="primary-button" id="archiveCorrectionSave">Originalbericht speichern</button></div>';
  byId("attendanceView").appendChild(panel);
  byId("archiveCorrectionBack").onclick=cancelArchiveCorrectionStep2;
  byId("archiveCorrectionCancel").onclick=cancelArchiveCorrectionStep2;
  byId("archiveCorrectionSave").onclick=saveArchiveCorrectionStep2;
  byId("archiveCorrectionSearch").oninput=filterArchiveCorrectionRows;
  byId("archiveCorrectionFilter").onchange=filterArchiveCorrectionRows;
  byId("archiveCorrectionAdd").onclick=addArchiveCorrectionMember;
  return panel;
}
function filterArchiveCorrectionRows(){
  const query=String(byId("archiveCorrectionSearch")?.value||"").trim().toLocaleLowerCase("de");
  const status=byId("archiveCorrectionFilter")?.value||"";
  let visible=0;
  for(const card of byId("archiveCorrectionList")?.children||[]){
    const rowStatus=card.querySelector('[data-correction-field="status"]')?.value||"";
    const name=card.querySelector('[data-correction-field="name"]')?.value||"";
    card.hidden=Boolean(query&&!name.toLocaleLowerCase("de").includes(query)||status&&rowStatus!==status);
    if(!card.hidden)visible++;
  }
  const count=byId("archiveCorrectionCount");
  if(count)count.textContent=visible+" von "+(archiveCorrectionState?.rows.length||0)+" Personen angezeigt";
}
function appendArchiveCorrectionPerson(row,index){
  const container=byId("archiveCorrectionList");
  const card=document.createElement("article");card.className="archive-correction-person";card.dataset.row=String(index);card.dataset.status=row.status||"Fehlt";
  const top=document.createElement("div");top.className="archive-correction-person-header";
  const heading=document.createElement("strong");heading.textContent="Person "+(index+1);
  const state=document.createElement("span");state.className="archive-correction-person-state";top.append(heading,state);
  const fields=document.createElement("div");fields.className="archive-correction-person-fields";
  const nameLabel=document.createElement("label");nameLabel.textContent="Name";const name=document.createElement("input");name.type="text";name.className="text-input";name.maxLength=150;name.required=true;name.value=row.name||"";name.dataset.correctionField="name";nameLabel.append(name);
  const statusLabel=document.createElement("label");statusLabel.textContent="Teilnahme";const status=document.createElement("select");status.className="text-input";status.dataset.correctionField="status";
  const types=["Anwesend","Entschuldigt","Fehlt"];
  if(archiveCorrectionState?.item.sessionType==="Sonderprobe"||row.status==="Betrifft nicht")types.push("Betrifft nicht");
  for(const value of types){const option=document.createElement("option");option.value=value;option.textContent=value;status.append(option);}
  status.value=types.includes(row.status)?row.status:"Fehlt";statusLabel.append(status);
  const roleLabel=document.createElement("label");roleLabel.textContent="Funktion / Status";const role=document.createElement("input");role.type="text";role.className="text-input";role.maxLength=120;role.dataset.correctionField="role";role.value=row.role||"";roleLabel.append(role);
  const update=()=>{roleLabel.hidden=status.value!=="Anwesend"||archiveCorrectionState?.item.sessionType!=="Allgemeine Probe";card.dataset.status=status.value;state.textContent=status.value;filterArchiveCorrectionRows();};
  status.onchange=update;name.oninput=filterArchiveCorrectionRows;
  fields.append(nameLabel,statusLabel,roleLabel);card.append(top,fields);container.append(card);update();
}
function refreshArchiveCorrectionMembers(){
  const select=byId("archiveCorrectionAddPerson");if(!select)return;
  const listed=new Set((archiveCorrectionState?.rows||[]).map(row=>String(row.name||"").trim().toLocaleLowerCase("de")));
  select.replaceChildren();
  const empty=document.createElement("option");empty.value="";empty.textContent="Mitglied auswählen";select.append(empty);
  for(const member of members||[]){
    if(archiveCorrectionState?.item.sessionType==="Ausschuss Sitzung"&&!member.committeeMember)continue;
    const name=nameForStorage(member);if(listed.has(name.toLocaleLowerCase("de")))continue;
    const option=document.createElement("option");option.value=name;option.textContent=nameForTile(member);select.append(option);
  }
}
function addArchiveCorrectionMember(){
  if(!archiveCorrectionState)return;
  const name=byId("archiveCorrectionAddPerson")?.value||"";
  if(!name)return showToast("Bitte zuerst ein Mitglied auswählen.","error");
  const exists=[...byId("archiveCorrectionList").children].some(card=>card.querySelector('[data-correction-field="name"]')?.value.trim().toLocaleLowerCase("de")===name.toLocaleLowerCase("de"));
  if(exists)return showToast("Diese Person steht bereits im Bericht.","error");
  const row={name,status:"Fehlt",role:"",date:byId("archiveCorrectionEditDate").value,sessionType:archiveCorrectionState.item.sessionType,time:"",topic:byId("archiveCorrectionEditTopic").value};
  archiveCorrectionState.rows.push(row);
  appendArchiveCorrectionPerson(row,archiveCorrectionState.rows.length-1);
  refreshArchiveCorrectionMembers();
  byId("archiveCorrectionSearch").value="";byId("archiveCorrectionFilter").value="";
  filterArchiveCorrectionRows();byId("archiveCorrectionList").lastElementChild?.scrollIntoView({block:"nearest"});
}
function archiveCorrectionHasChanges(){
  if(!archiveCorrectionState)return false;
  const original=archiveCorrectionState.rows;
  const date=byId("archiveCorrectionEditDate")?.value||"";
  const topic=byId("archiveCorrectionEditTopic")?.value.trim()||"";
  if(date!==(original[0]?.date||"")||topic!==String(archiveCorrectionState.item.topic||original[0]?.topic||"").trim())return true;
  const cards=[...(byId("archiveCorrectionList")?.children||[])];
  if(cards.length!==original.length)return true;
  return cards.some((card,i)=>["name","status","role"].some(field=>{
    const value=card.querySelector('[data-correction-field="'+field+'"]')?.value.trim()||"";
    return field==="role"&&card.querySelector('[data-correction-field="status"]')?.value!=="Anwesend"?false:value!==String(original[i]?.[field]||"").trim();
  }));
}
function clearArchiveCorrectionStep2(){
  archiveCorrectionState=null;
  byId("archiveCorrectionWorkspace")?.remove();
  byId("attendanceView")?.classList.remove("archive-correction-mode");
  setHomeFlowStage(1);
}
function archiveCorrectionBeforeView(viewId){
  if(!archiveCorrectionState||!byId("attendanceView")?.classList.contains("archive-correction-mode")||viewId==="attendanceView")return true;
  if(archiveCorrectionHasChanges()&&!confirm("Ungespeicherte Änderungen an der Archivkorrektur verwerfen?"))return false;
  clearArchiveCorrectionStep2();
  return true;
}
function cancelArchiveCorrectionStep2({saved=false}={}){
  if(!saved&&archiveCorrectionHasChanges()&&!confirm("Korrektur ohne Speichern verlassen und Änderungen verwerfen?"))return;
  clearArchiveCorrectionStep2();
  showView("settingsHistoryView");
}
async function saveArchiveCorrectionStep2(){
  if(!requireAdmin("settingsHistoryView")||!archiveCorrectionState)return;
  const item=structuredClone(archiveCorrectionState.item);
  const correctedDate=byId("archiveCorrectionEditDate").value;
  const topic=byId("archiveCorrectionEditTopic").value.trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(correctedDate))return showToast("Bitte ein gültiges Termindatum wählen.","error");
  if(!topic)return showToast("Bitte das Thema des Termins eintragen.","error");
  const cards=[...byId("archiveCorrectionList").children],rows=[];
  for(const card of cards){
    const index=Number(card.dataset.row),original=archiveCorrectionState.rows[index];
    if(!original)return showToast("Personenzuordnung ungültig. Bitte Korrektur erneut öffnen.","error");
    const name=card.querySelector('[data-correction-field="name"]').value.trim();
    const status=card.querySelector('[data-correction-field="status"]').value;
    const fieldRole=card.querySelector('[data-correction-field="role"]').value.trim();
    const role=status==="Anwesend"?(item.sessionType==="Allgemeine Probe"||original.status==="Anwesend"?fieldRole:(fieldRole||({Sonderprobe:"Anwesend",Unterricht:"Unterricht","Ausschuss Sitzung":"Ausschuss Sitzung"}[item.sessionType]||""))):"";
    if(!name)return showToast("Bitte für alle Personen einen Namen eintragen.","error");
    if(status==="Anwesend"&&item.sessionType==="Allgemeine Probe"&&!role&&correctionRolesForRow({...original,name}).length)return showToast("Bitte die Funktion von "+name+" ergänzen.","error");
    rows.push({...original,name,status,role,date:correctedDate,topic,sessionType:item.sessionType});
  }
  if(!rows.length)return showToast("Der Bericht benötigt mindestens eine Person.","error");
  const names=new Set();for(const row of rows){const normalized=row.name.toLocaleLowerCase("de");if(names.has(normalized))return showToast("Name doppelt im Bericht: "+row.name,"error");names.add(normalized);}
  const changed=rows.length!==archiveCorrectionState.rows.length||rows.some((row,i)=>["name","status","role","date"].some(key=>String(row[key]||"")!==String(archiveCorrectionState.rows[i]?.[key]||"")))||topic!==String(item.topic||archiveCorrectionState.rows[0]?.topic||"").trim();
  if(!changed)return showToast("Es gibt noch keine Änderungen zum Speichern.");
  if(!confirm("Die bestehende Archivdatei wird mit den korrigierten Angaben überschrieben. Fortfahren?"))return;
  const button=byId("archiveCorrectionSave");if(button.disabled)return;button.disabled=true;
  try{
    const timestamp=new Date().toISOString();
    item.topic=topic;
    item.revisions=[...(item.revisions||[]),{changedAt:timestamp,reason:"Termin in Schritt 2 korrigiert",changedRows:rows.reduce((n,row,i)=>n+(JSON.stringify(row)===JSON.stringify(archiveCorrectionState.rows[i])?0:1),0)}];
    await persistArchiveCorrection(item,rows,correctedDate);
    cancelArchiveCorrectionStep2({saved:true});
    showToast("Korrigierter Originalbericht erfolgreich gespeichert.");
  }catch(error){console.error("Terminkorrektur fehlgeschlagen",error);showToast("Korrektur nicht bestätigt: "+(error.message||"Bitte erneut versuchen."),"error");}
  finally{button.disabled=false;}
}
function archiveCorrectionLiveCaptureWarning(){
  // Session and operation IDs are allocated already when the selection screen
  // opens. An unused ID is not a saved attendance record and must not block
  // editing an existing report from the history view.
  const sessionId=String(currentSessionId||"");
  const operationId=String(currentOperationId||"");
  const currentRows=typeof todayEntries==="function"?todayEntries():[];
  const explicitRows=Array.isArray(entries)?entries.filter(row=>sessionId&&row.sessionId===sessionId||operationId&&row.operationId===operationId):[];
  const recorded=currentRows.length?currentRows:explicitRows;
  if(recorded.length)return "Eine laufende Erfassung enthält bereits Anwesenheiten. Bitte diese zuerst abschließen oder bewusst abbrechen, bevor ein Archivbericht korrigiert wird.";
  if(pendingMemberStatuses?.size||chosenMemberIds?.size||chosenMemberId)return "In der laufenden Erfassung sind noch Personen ausgewählt oder Markierungen vorgemerkt. Bitte diese zuerst übernehmen oder die Erfassung abbrechen.";
  if(sessionId&&String(currentClosingTopic||"").trim())return "Für die laufende Erfassung ist bereits ein Thema vorbereitet. Bitte diese Erfassung zuerst abschließen oder abbrechen.";
  // An operational report can contain data even before a person was entered.
  if(operationId&&(currentOperationDraft||Object.keys(operationAssignments||{}).length||Object.keys(operationAssignmentRoles||{}).length||typeof restoreOperationDraft==="function"&&restoreOperationDraft()))return "Ein Einsatzbericht ist noch in Bearbeitung. Bitte den Entwurf zuerst abschließen oder bewusst abbrechen.";
  return "";
}
function correctArchiveItem(id){
  if(!requireAdmin("settingsHistoryView"))return;
  const captureWarning=archiveCorrectionLiveCaptureWarning();
  if(captureWarning)return showToast(captureWarning,"error");
  const item=csvArchive.find(entry=>entry.id===id);if(!item)return;
  const rows=archiveRowsFromContent(item.content);
  if(!rows.length)return showToast("Keine korrigierbaren Einträge.","error");
  archiveCorrectionState={item,rows:structuredClone(rows)};
  if(showView("attendanceView")===false){archiveCorrectionState=null;return;}
  setHomeFlowStage(2);
  const panel=archiveCorrectionWorkspace();
  byId("attendanceView").classList.add("archive-correction-mode");
  byId("archiveCorrectionHeading").textContent=(item.sessionType||rows[0].sessionType||"Termin")+" korrigieren · Schritt 2";
  byId("archiveCorrectionEditDate").value=rows[0]?.date||historyDateFromItem(item);
  byId("archiveCorrectionEditTopic").value=item.topic||rows[0]?.topic||"";
  byId("archiveCorrectionSearch").value="";byId("archiveCorrectionFilter").value="";
  byId("archiveCorrectionList").replaceChildren();
  archiveCorrectionState.rows.forEach(appendArchiveCorrectionPerson);
  refreshArchiveCorrectionMembers();filterArchiveCorrectionRows();
  panel.scrollIntoView({block:"start",behavior:"instant"});
  showToast("Schritt 2: Datum, Thema und Personen korrigieren. Speichern überschreibt den Originalbericht.");
}
function pairedArchiveFileNames(item){
  const current=String(item.fileName||"Probe.csv");
  const base=(item.baseFileName||current).replace(/_korrigiert-v\d+(?=\.csv$)/i,"").replace(/\.csv$/i,"");
  return {base,csv:`${base}.csv`,pdf:`${base}.pdf`};
}
async function persistArchiveCorrection(item,rows,correctedDate){
  // All correction entry points share exactly the same archive and OneDrive overwrite.
  // Preserve the original filename and item ID, including when the report date changes.
  item.topic=String(item.topic||rows[0]?.topic||"").trim();
  item.content=archiveCsvFromRows(rows,item.topic);
  item.correctedAt=new Date().toISOString();
  item.updatedAt=item.correctedAt;
  item.originalReportDate=correctedDate;
  const previousNames=pairedArchiveFileNames(item);
  const names={csv:item.fileName||previousNames.csv,pdf:item.pdfFileName||previousNames.pdf};
  item.baseFileName=item.baseFileName||names.csv;
  item.fileName=names.csv;item.pdfFileName=names.pdf;
  const counts={
    present:rows.filter(row=>row.status==="Anwesend").length,
    excused:rows.filter(row=>row.status==="Entschuldigt").length,
    missing:rows.filter(row=>row.status==="Fehlt").length,
    notApplicable:rows.filter(row=>row.status==="Betrifft nicht").length
  };
  const correctedPdf=probePdfBlob(
    rows.map(row=>({time:row.time,name:row.name,status:row.status,role:row.role})),
    item.sessionType||rows[0]?.sessionType||"Probe",
    counts,item.topic,correctedDate
  );
  Object.assign(item,{presentCount:counts.present,excusedCount:counts.excused,missingCount:counts.missing,notApplicableCount:counts.notApplicable});
  if(item.oneDriveLive){
    await window.saveOneDriveHistoryCorrection(item,correctedPdf);
    await window.loadOneDriveHistory();
    return;
  }
  await saveImportedReportPdf(item.id,new File([correctedPdf],names.pdf,{type:"application/pdf"}));
  item.hasImportedPdf=true;
  csvArchive=csvArchive.map(entry=>entry.id===item.id?item:entry);
  let csvOverwritten=false,pdfOverwritten=false;
  try{csvOverwritten=await writeCsvToSelectedFolder(names.csv,item.content);}catch(error){console.warn("CSV konnte nicht direkt überschrieben werden",error);}
  try{pdfOverwritten=await savePdfToSelectedFolder(names.pdf,correctedPdf);}catch(error){console.warn("PDF konnte nicht direkt überschrieben werden",error);}
  saveArchive();renderArchive();renderStatistics();renderHistory();
  if(!csvOverwritten){
    const result=await exportCsvFile(names.csv,item.content,true);
    if(result==="failed"||result==="cancelled")showToast("Korrektur im Archiv gespeichert. CSV-Ausgabe wurde nicht abgeschlossen.","error");
  }
  if(!pdfOverwritten)downloadBlob(names.pdf,correctedPdf);
  if(csvOverwritten&&pdfOverwritten)showToast("Korrektur gespeichert. Original-CSV und Original-PDF überschrieben.");
  else showToast("Korrektur gespeichert. Bitte die ausgegebenen Originaldateien am Speicherort ersetzen.");
}
async function saveArchiveCorrection(){
  if(!requireAdmin("settingsHistoryView")||!archiveCorrectionState)return;
  const item=structuredClone(archiveCorrectionState.item),rows=structuredClone(archiveCorrectionState.rows);
  const index=Number(byId("correctionPerson").value),row=rows[index];if(!row)return;
  const status=byId("correctionStatus").value,role=status==="Anwesend"?byId("correctionRole").value.trim():"";
  const correctedName=byId("correctionName").value.trim();
  if(!correctedName)return showToast("Bitte einen Namen eintragen.","error");
  const correctedDate=byId("correctionDate")?.value||row.date;
  if(!correctedDate)return showToast("Bitte ein gültiges Termindatum auswählen.","error");
  const isGeneral=(item.sessionType||rows[0]?.sessionType)==="Allgemeine Probe";
  if(status==="Anwesend"&&isGeneral&&!role&&correctionRolesForRow(row).length)return showToast("Bitte eine für diese Person freigegebene Funktion auswählen.","error");
  const button=byId("saveCorrectionButton");if(button.disabled)return;button.disabled=true;
  try{
    const original={name:row.name,status:row.status,role:row.role,date:row.date};
    rows.forEach(entry=>entry.date=correctedDate);row.status=status;row.role=role;row.name=correctedName;
    item.revisions=[...(item.revisions||[]),{changedAt:new Date().toISOString(),name:row.name,original,updated:{name:correctedName,status,role,date:correctedDate}}];
    await persistArchiveCorrection(item,rows,correctedDate);
    byId("archiveCorrectionDialog").close();archiveCorrectionState=null;
  }catch(error){console.error("Terminkorrektur fehlgeschlagen",error);showToast("Korrektur nicht bestätigt: "+(error.message||"Bitte erneut versuchen."),"error");}
  finally{button.disabled=false;}
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
function historyDisplayTitle(item){
  if(String(item?.sessionType||"").trim()==="Einsatz"){const type=String(item?.operationData?.type||"").trim();if(type)return type;const topic=String(item?.topic||"").trim();if(topic)return topic.split(" · ")[0]||"Einsatz";return "Einsatz";}
  return String(item?.topic||parseCsvRows(item?.content||"")[0]?.topic||item?.sessionType||"Probe").trim();
}
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
let historyFilterSignature='',historyGroupState=new Map();
function renderHistory(){
  ensureHistoryView();
  const type=byId('historyTypeFilter')?.value||'',from=byId('historyFromFilter')?.value||'',to=byId('historyToFilter')?.value||'';
  const filterSignature=JSON.stringify([byId('historySearch')?.value||'',type,from,to]);
  if(filterSignature===historyFilterSignature)document.querySelectorAll('#historyYears details[data-history-group]').forEach(node=>historyGroupState.set(node.dataset.historyGroup,node.open));else historyGroupState.clear();
  historyFilterSignature=filterSignature;
  const query=(byId("historySearch")?.value||"").trim().toLocaleLowerCase("de");
  const sorted=csvArchive.filter(item=>(!type||item.sessionType===type)&&(!from||historyDateFromItem(item)>=from)&&(!to||historyDateFromItem(item)<=to)).filter(item=>[historyDisplayTitle(item),historyDateLabel(item),historyDateFromItem(item),item.sessionType,item.operationData?.location].join(" ").toLocaleLowerCase("de").includes(query)).sort((a,b)=>historyDateFromItem(b).localeCompare(historyDateFromItem(a))||String(b.createdAt).localeCompare(String(a.createdAt)));
  const years=new Map();
  sorted.forEach(item=>{
    const year=historyYearFromItem(item),month=historyMonthKey(item);
    if(!years.has(year))years.set(year,new Map());
    if(!years.get(year).has(month))years.get(year).set(month,[]);
    years.get(year).get(month).push(item);
  });
  const now=new Date(),currentYear=String(now.getFullYear()),currentMonth=`${currentYear}-${String(now.getMonth()+1).padStart(2,"0")}`;
  byId("historyEmpty").hidden=sorted.length>0;
  byId("historyEmpty").textContent=query||type||from||to?"Kein Bericht gefunden. Suche nach Thema, Datum oder Einsatzart.":"Noch keine abgeschlossenen Termine oder Einsätze vorhanden.";
  byId("historyYears").innerHTML=[...years.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([year,months])=>{
    const yearCount=[...months.values()].reduce((sum,items)=>sum+items.length,0);
    const yearOpen=historyGroupState.has(year)?historyGroupState.get(year)?" open":"":query||type||from||to||year===currentYear?" open":"";
    const monthHtml=[...months.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([month,items])=>{
      const monthOpen=historyGroupState.has(month)?historyGroupState.get(month)?" open":"":query||type||from||to||month===currentMonth?" open":"";
      return `<details class="history-month" data-history-group="${escapeHtml(month)}"${monthOpen}><summary><span>${escapeHtml(historyMonthLabel(month))}</span><small>${items.length} Bericht${items.length===1?"":"e"}</small><i aria-hidden="true"></i></summary><div class="history-list">${items.map(item=>{const date=historyDateLabel(item),topic=historyDisplayTitle(item);return `<article class="history-item${item.revisions?.length?" history-item-corrected":""}"><div class="history-item-details"><strong>${escapeHtml(date)} · ${escapeHtml(topic)}</strong><span>${escapeHtml(item.sessionType||"Probe")}</span><small>${escapeHtml(item.fileName)}${item.revisions?.length?` · ${item.revisions.length} Korrektur(en)`:""}</small></div><div class="history-item-actions"><button class="primary-button" type="button" data-history-pdf="${escapeHtml(item.id)}">${item.sessionType==="Einsatz"?"Einsatzbericht ansehen":"PDF ansehen"}</button><button class="secondary-button" type="button" data-history-csv="${escapeHtml(item.id)}">CSV ausgeben</button><button class="outline-button" type="button" data-history-correct="${escapeHtml(item.id)}" title="Aktualisiert CSV und zugehöriges PDF">${item.sessionType==="Einsatz"?"Einsatz korrigieren":"Eintrag korrigieren"}</button><button class="danger-button" type="button" data-history-delete="${escapeHtml(item.id)}">Löschen</button></div></article>`;}).join("")}</div></details>`;
    }).join("");
    return `<details class="history-year" data-history-group="${escapeHtml(year)}"${yearOpen}><summary class="history-year-heading"><h3>${escapeHtml(year)}</h3><span>${yearCount} Bericht${yearCount===1?"":"e"}</span><i aria-hidden="true"></i></summary><div class="history-months">${monthHtml}</div></details>`;
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




window.ArchiveCorrection={beforeView:archiveCorrectionBeforeView};
