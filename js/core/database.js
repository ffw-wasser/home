function openSettingsDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB nicht verfügbar"));
      return;
    }
    let request;
    try { request = indexedDB.open("fw_v14_settings", 1); }
    catch (error) { reject(error); return; }
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveStoredDirectoryHandle(handle, key) {
  const db = await openSettingsDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function loadStoredDirectoryHandle(key) {
  try {
    const db = await openSettingsDb();
    const handle = await new Promise((resolve, reject) => {
      const request = db.transaction("handles", "readonly").objectStore("handles").get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch { return null; }
}
async function removeStoredDirectoryHandle(key) {
  const db = await openSettingsDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function saveDirectoryHandle(handle) { return saveStoredDirectoryHandle(handle, "csvDirectory"); }
async function loadDirectoryHandle() { return loadStoredDirectoryHandle("csvDirectory"); }
async function removeDirectoryHandle() { return removeStoredDirectoryHandle("csvDirectory"); }
async function saveBackupDirectoryHandle(handle) { return saveStoredDirectoryHandle(handle, "backupDirectory"); }
async function loadBackupDirectoryHandle() { return loadStoredDirectoryHandle("backupDirectory"); }
async function removeBackupDirectoryHandle() { return removeStoredDirectoryHandle("backupDirectory"); }
async function savePdfDirectoryHandle(handle) { return saveStoredDirectoryHandle(handle, "pdfDirectory"); }
async function loadPdfDirectoryHandle() { return loadStoredDirectoryHandle("pdfDirectory"); }
async function removePdfDirectoryHandle() { return removeStoredDirectoryHandle("pdfDirectory"); }


function visibleDirectoryPath(handle) {
  if(!handle) return "";
  const name=String(handle.name||"").trim();
  return name ? `${name}/` : "";
}
function setDirectoryPathText(elementId, handle, emptyText) {
  const element=byId(elementId);
  if(!element) return;
  const path=visibleDirectoryPath(handle);
  element.textContent=path || emptyText;
  element.title=path || emptyText;
}
function supportsPersistentDirectoryPicker() {
  return typeof window.showDirectoryPicker === "function";
}
function setIpadStorageCardState(kind) {
  const map={
    csv:{name:"csvFolderName",choose:"chooseCsvFolderButton",clear:"clearCsvFolderButton",hint:"csvSupportHint",label:"Terminpakete werden beim Abschluss über den iPad-Teilen-Dialog ausgegeben. Dort „In Dateien sichern“ und OneDrive wählen."},
    pdf:{name:"pdfFolderName",choose:"choosePdfFolderButton",clear:"clearPdfFolderButton",hint:"pdfSupportHint",label:"PDF und CSV befinden sich im Terminpaket. Im iPad-Teilen-Dialog „In Dateien sichern“ und OneDrive wählen."},
    backup:{name:"backupFolderName",choose:"chooseBackupFolderButton",clear:"clearBackupFolderButton",hint:"backupSupportHint",label:"Backups werden über den iPad-Teilen-Dialog ausgegeben. Dort „In Dateien sichern“ und OneDrive wählen."}
  };
  const item=map[kind];if(!item)return;
  const name=byId(item.name),choose=byId(item.choose),clear=byId(item.clear),hint=byId(item.hint);
  if(name){name.textContent="Auswahl beim Speichern";name.title="OneDrive-Ordner im iPad-Dialog auswählen";}
  if(choose){choose.hidden=true;choose.disabled=true;choose.setAttribute("aria-hidden","true");}
  if(clear){clear.hidden=true;clear.disabled=true;clear.setAttribute("aria-hidden","true");}
  if(hint)hint.textContent=item.label+" Ein fester OneDrive-Ordner kann in iPad/Safari nicht dauerhaft an die Webseite gebunden werden. Im Teilen-Dialog bitte „In Dateien sichern“ und anschließend den gewünschten OneDrive-Ordner wählen.";
  name?.closest("article")?.classList.add("storage-card-ipad-mode");
}

function renderBackupFolderStatus() {
  if(!byId("backupFolderName")) return;
  if(!supportsPersistentDirectoryPicker()) return setIpadStorageCardState("backup");
  setDirectoryPathText("backupFolderName",backupDirectoryHandle,"Kein Backup-Ordner ausgewählt");
  byId("chooseBackupFolderButton").hidden=false;
  byId("chooseBackupFolderButton").disabled=false;
  byId("clearBackupFolderButton").hidden=false;
  byId("clearBackupFolderButton").disabled=!backupDirectoryHandle;
  byId("backupSupportHint").textContent="Backups werden direkt in diesem Ordner gespeichert. Den übergeordneten Gerätepfad gibt der Browser nicht an die App weiter.";
}

async function chooseBackupFolder() {
  if (!("showDirectoryPicker" in window)) return showToast("Dieser Browser verwendet den Download- oder Teilen-Dialog für Backups.","error");
  try {
    backupDirectoryHandle=await window.showDirectoryPicker({mode:"readwrite",id:"feuerwehr-backup"});
    await saveBackupDirectoryHandle(backupDirectoryHandle);
    renderBackupFolderStatus();
    showToast(`Speicherort „${backupDirectoryHandle.name}“ wurde für Backups gespeichert.`);
  } catch(error) { if(error?.name!=="AbortError") showToast("Speicherort für Backups konnte nicht ausgewählt werden.","error"); }
}
async function clearBackupFolder() {
  try { await removeBackupDirectoryHandle(); } catch(error) { return showToast("Backup-Speicherort konnte nicht entfernt werden.","error"); }
  backupDirectoryHandle=null; renderBackupFolderStatus(); showToast("Backup-Speicherort wurde entfernt.");
}
async function ensureDirectoryWritePermission(handle) {
  if(!handle) return false;
  if(!handle.queryPermission || !handle.requestPermission) return true;
  if(await handle.queryPermission({mode:"readwrite"})==="granted") return true;
  return await handle.requestPermission({mode:"readwrite"})==="granted";
}

// Muss unmittelbar aus dem Klick auf „Weiter zum Abschluss“ aufgerufen werden.
// Alle requestPermission-Aufrufe werden vor dem ersten await gestartet, damit
// die Browser-Benutzeraktivierung auch bei einem OneDrive-Synchronordner gilt.
async function requestExportFolderPermissionsNow() {
  const handles=[csvDirectoryHandle,pdfDirectoryHandle].filter(Boolean);
  const uniqueHandles=handles.filter((handle,index)=>handles.indexOf(handle)===index);
  if(!uniqueHandles.length)return {ok:true,usesFolders:false};
  try {
    const permissionRequests=uniqueHandles.map(handle=>{
      if(!handle.requestPermission)return Promise.resolve("granted");
      return handle.requestPermission({mode:"readwrite"});
    });
    const states=await Promise.all(permissionRequests);
    return {ok:states.every(state=>state==="granted"),usesFolders:true};
  } catch(error) {
    console.error("Ordnerberechtigung konnte nicht angefordert werden",error);
    return {ok:false,usesFolders:true};
  }
}

function effectiveCsvDirectoryHandle(){return csvDirectoryHandle||pdfDirectoryHandle||null;}
function effectivePdfDirectoryHandle(){return pdfDirectoryHandle||csvDirectoryHandle||null;}
async function writeJsonToBackupFolder(fileName, content) {
  if(!backupDirectoryHandle || !(await ensureDirectoryWritePermission(backupDirectoryHandle))) return false;
  const fileHandle=await backupDirectoryHandle.getFileHandle(fileName,{create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(content); await writable.close(); return true;
}

function isSafariBrowser() {
  const ua = navigator.userAgent;
  return /^((?!chrome|android|edg).)*safari/i.test(ua);
}

function renderCsvFolderStatus() {
  if(!byId("csvFolderName")) return;
  if(!supportsPersistentDirectoryPicker()) return setIpadStorageCardState("csv");
  setDirectoryPathText("csvFolderName",csvDirectoryHandle,"Noch kein Ordner ausgewählt");
  byId("chooseCsvFolderButton").hidden=false;
  byId("chooseCsvFolderButton").disabled=false;
  byId("clearCsvFolderButton").hidden=false;
  byId("clearCsvFolderButton").disabled=!csvDirectoryHandle;
  byId("csvSupportHint").textContent="CSV-Dateien werden direkt in diesem Ordner gespeichert. Den übergeordneten Gerätepfad gibt der Browser nicht an die App weiter.";
}

async function chooseCsvFolder() {
  if (!("showDirectoryPicker" in window)) return showToast("Dieser Browser verwendet den Download- oder Teilen-Dialog für CSV-Dateien.", "error");
  try {
    csvDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "feuerwehr-csv" });
    await saveDirectoryHandle(csvDirectoryHandle);
    renderCsvFolderStatus();
    showToast(`CSV-Speicherordner „${csvDirectoryHandle.name}“ wurde gespeichert.`);
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Der Speicherordner konnte nicht übernommen werden.", "error");
  }
}
async function clearCsvFolder() {
  try { await removeDirectoryHandle(); } catch (error) {}
  csvDirectoryHandle = null;
  renderCsvFolderStatus();
  showToast("Die gespeicherte Ordnerauswahl wurde entfernt.");
}
async function writeCsvToSelectedFolder(fileName, content) {
  const directoryHandle=effectiveCsvDirectoryHandle();
  if (!directoryHandle) return false;
  try {
    if (!(await ensureDirectoryWritePermission(directoryHandle))) return false;
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
async function exportCsvFile(fileName, content, allowShare = true) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });

  // iPad/iPhone Safari: native Teilen-/Sichern-Dialog als erste Wahl.
  try {
    if (allowShare && isSafariBrowser() && typeof File === "function" && navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: "text/csv" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return "shared";
      }
    }
  } catch (error) {
    if (error && error.name === "AbortError") return "cancelled";
  }

  // Standarddownload für Chrome, Edge und unterstützte Safari-Kontexte.
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch (error) {}

  // Letzter Safari-Fallback: CSV in neuer Ansicht öffnen, danach Teilen > In Dateien sichern.
  try {
    const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(content);
    const opened = window.open(dataUrl, "_blank");
    return opened ? "opened" : "failed";
  } catch (error) {
    return "failed";
  }
}

function ensurePdfFolderControls(){
  if(byId("pdfFolderPanel"))return;
  const archiveView=byId("settingsFilesView")||byId("archiveView");if(!archiveView)return;
  const panel=document.createElement("article");panel.className="panel pdf-folder-panel";panel.id="pdfFolderPanel";
  panel.innerHTML=`<div class="panel-heading"><span class="step yellow">PDF</span><h3>Speicherort für PDF-Berichte</h3></div><p class="help-text">Hier kann ein eigener Ordner für Probenberichte festgelegt werden. CSV-Dateien verwenden weiterhin den CSV-Speicherort.</p><div class="folder-status"><span>Aktueller PDF-Ordner</span><strong id="pdfFolderName">Kein PDF-Ordner ausgewählt</strong></div><div class="csv-folder-actions"><button class="primary-button" id="choosePdfFolderButton" type="button">PDF-Speicherort auswählen</button><button class="outline-button" id="clearPdfFolderButton" type="button">Auswahl entfernen</button></div><p class="help-text" id="pdfSupportHint"></p>`;
  const first=archiveView.querySelector(".archive-layout,.archive-content,.archive-grid")||archiveView.querySelector("article")?.parentElement||archiveView;
  first.prepend(panel);
  byId("choosePdfFolderButton").addEventListener("click",choosePdfFolder);
  byId("clearPdfFolderButton").addEventListener("click",clearPdfFolder);
  renderPdfFolderStatus();
}
function renderPdfFolderStatus(){
  if(!byId("pdfFolderName"))return;
  if(!supportsPersistentDirectoryPicker()) return setIpadStorageCardState("pdf");
  setDirectoryPathText("pdfFolderName",pdfDirectoryHandle,"Kein PDF-Ordner ausgewählt");
  byId("choosePdfFolderButton").hidden=false;
  byId("choosePdfFolderButton").disabled=false;
  byId("clearPdfFolderButton").hidden=false;
  byId("clearPdfFolderButton").disabled=!pdfDirectoryHandle;
  byId("pdfSupportHint").textContent="Neue PDF-Probenberichte werden direkt in diesem Ordner gespeichert.";
}

async function choosePdfFolder(){
  if(!("showDirectoryPicker" in window))return showToast("Dieser Browser verwendet für PDFs den Teilen- oder Download-Dialog.","error");
  try{pdfDirectoryHandle=await window.showDirectoryPicker({mode:"readwrite",id:"feuerwehr-pdf"});await savePdfDirectoryHandle(pdfDirectoryHandle);renderPdfFolderStatus();showToast(`PDF-Speicherort „${pdfDirectoryHandle.name}“ wurde gespeichert.`);}catch(error){if(error?.name!=="AbortError")showToast("PDF-Speicherort konnte nicht ausgewählt werden.","error");}
}
async function clearPdfFolder(){
  try{await removePdfDirectoryHandle();}catch(error){return showToast("PDF-Speicherort konnte nicht entfernt werden.","error");}
  pdfDirectoryHandle=null;renderPdfFolderStatus();showToast("PDF-Speicherort wurde entfernt.");
}
async function savePdfToSelectedFolder(fileName,blob){
  const directoryHandle=effectivePdfDirectoryHandle();
  if(!directoryHandle)return false;
  try{const permission=await ensureDirectoryWritePermission(directoryHandle);if(!permission)return false;const handle=await directoryHandle.getFileHandle(fileName,{create:true});const writable=await handle.createWritable();await writable.write(blob);await writable.close();return true;}catch(error){return false;}
}

function ensureArchiveStorageCenter(){
  const filesView=byId("settingsFilesView")||byId("archiveView");
  if(!filesView)return;
  ensurePdfFolderControls();

  let center=byId("archiveStorageCenter");
  if(!center){
    center=document.createElement("section");
    center.id="archiveStorageCenter";
    center.className="archive-storage-center";
    center.innerHTML=`<div class="archive-storage-heading"><div><p class="eyebrow">Dateiverwaltung</p><h3>Speicherorte und Backups</h3><p>Verwalte die Speicherorte für CSV-Auswertungen, PDF-Berichte und vollständige Datensicherungen.</p></div></div><div class="storage-location-group"><div class="storage-location-heading"><span>Probenabschluss</span><h4>CSV- und PDF-Dateien</h4><p>Für Auswertungsdateien und lesbare Berichte abgeschlossener Proben.</p></div><div class="archive-storage-grid archive-storage-output-grid" id="archiveStorageOutputGrid"></div></div><div class="storage-location-group"><div class="storage-location-heading"><span>Datensicherung</span><h4>Vollständige Backups</h4><p>Sichert Mitglieder, Einstellungen, Ziele, laufende Daten und die Historie.</p></div><div class="archive-storage-grid archive-storage-backup-grid" id="archiveStorageBackupGrid"></div></div>`;
    const heading=filesView.querySelector(".screen-heading");
    heading?.insertAdjacentElement("afterend",center);
    if(!heading)filesView.prepend(center);
  }

  const outputGrid=byId("archiveStorageOutputGrid"),backupGrid=byId("archiveStorageBackupGrid");
  const csvPanel=byId("chooseCsvFolderButton")?.closest("article");
  const pdfPanel=byId("pdfFolderPanel");
  const exportCompleteButton=byId("exportCompleteBackupButton");
  const importCompleteButton=byId("importCompleteBackupButton");
  const completeBackupInput=byId("completeBackupFileInput");

  if(csvPanel){
    csvPanel.className="storage-card storage-file-card storage-card-csv";
    const h=csvPanel.querySelector("h3");if(h)h.textContent="CSV-Auswertungen";
    const help=csvPanel.querySelector(".help-text");if(help)help.textContent="Speicherort für CSV-Dateien abgeschlossener Proben.";
    outputGrid?.appendChild(csvPanel);
  }
  if(pdfPanel){
    pdfPanel.className="storage-card storage-file-card storage-card-pdf";
    const h=pdfPanel.querySelector("h3");if(h)h.textContent="PDF-Probenberichte";
    const help=pdfPanel.querySelector(".help-text");if(help)help.textContent="Speicherort für lesbare PDF-Berichte abgeschlossener Proben.";
    outputGrid?.appendChild(pdfPanel);
  }
  if(exportCompleteButton&&importCompleteButton&&backupGrid){
    let completeBackupPanel=byId("completeBackupStorageCard");
    if(!completeBackupPanel){
      completeBackupPanel=document.createElement("article");
      completeBackupPanel.id="completeBackupStorageCard";
      completeBackupPanel.className="storage-card storage-backup-card";
      completeBackupPanel.innerHTML=`<div class="storage-card-heading"><span class="storage-card-kicker">Datensicherung</span><h3>Vollständige Backups</h3><p class="help-text">Speicherort festlegen sowie alle Anwendungsdaten sichern oder wiederherstellen.</p></div><div class="storage-folder-status backup-folder-status"><span class="storage-status-label">Ausgewählter Ordner</span><strong id="backupFolderName">Kein Backup-Ordner ausgewählt</strong><small id="backupSupportHint">Der gewählte Ordner wird für vollständige Backups verwendet.</small></div><div class="storage-card-actions storage-folder-actions" id="backupFolderActions"></div><div class="storage-card-actions storage-backup-actions" id="completeBackupActions"></div>`;
      backupGrid.appendChild(completeBackupPanel);
    }
    const folderActions=byId("backupFolderActions");
    const backupActions=byId("completeBackupActions");
    const chooseBackupButton=byId("chooseBackupFolderButton");
    const clearBackupButton=byId("clearBackupFolderButton");
    if(chooseBackupButton){chooseBackupButton.textContent="Backup-Ordner auswählen";folderActions?.appendChild(chooseBackupButton);}
    if(clearBackupButton){clearBackupButton.textContent="Auswahl entfernen";folderActions?.appendChild(clearBackupButton);}
    exportCompleteButton.textContent="Vollständiges Backup exportieren";
    importCompleteButton.textContent="Vollständiges Backup importieren";
    backupActions?.append(exportCompleteButton,importCompleteButton);
    if(completeBackupInput)completeBackupPanel.appendChild(completeBackupInput);
  }

  // Alte CSV-Listen- und Teilbackup-Bereiche sind durch Historie und Komplettbackup ersetzt.
  byId("csvArchive")?.closest("article,section,.panel")?.remove();
  byId("exportBackupButton")?.closest("article,section,.panel")?.remove();
  byId("importBackupButton")?.closest("article,section,.panel")?.remove();
  byId("backupFileInput")?.remove();
  byId("archiveCount")?.closest(".step,.badge,.count-badge")?.remove();
  byId("emptyArchive")?.remove();

  renderCsvFolderStatus();
  renderPdfFolderStatus();
  renderBackupFolderStatus();
}

function openReportPdfDb(){
  return new Promise((resolve,reject)=>{if(!("indexedDB" in window))return reject(new Error("IndexedDB nicht verfügbar"));const request=indexedDB.open("fw_v1_report_pdfs",1);request.onupgradeneeded=()=>request.result.createObjectStore("pdfs");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function saveImportedReportPdf(reportId,file){const db=await openReportPdfDb();await new Promise((resolve,reject)=>{const tx=db.transaction("pdfs","readwrite");tx.objectStore("pdfs").put(file,reportId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
async function loadImportedReportPdf(reportId){try{const db=await openReportPdfDb();const blob=await new Promise((resolve,reject)=>{const r=db.transaction("pdfs","readonly").objectStore("pdfs").get(reportId);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});db.close();return blob;}catch{return null;}}
async function deleteImportedReportPdf(reportId){try{const db=await openReportPdfDb();await new Promise((resolve,reject)=>{const tx=db.transaction("pdfs","readwrite");tx.objectStore("pdfs").delete(reportId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch{}}

async function blobToDataUrl(blob){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
function dataUrlToBlob(dataUrl){const [meta,data]=String(dataUrl||"").split(",",2),mime=(meta.match(/^data:([^;]+)/)||[])[1]||"application/pdf",binary=atob(data||""),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:mime});}
async function exportImportedReportPdfs(){const items=[];for(const report of csvArchive||[]){if(!report.hasImportedPdf)continue;const blob=await loadImportedReportPdf(report.id);if(blob)items.push({reportId:report.id,fileName:report.pdfFileName||report.fileName.replace(/\.csv$/i,".pdf"),dataUrl:await blobToDataUrl(blob)});}return items;}
async function restoreImportedReportPdfs(items){let restored=0;for(const item of Array.isArray(items)?items:[]){if(!item?.reportId||!item?.dataUrl)continue;const blob=dataUrlToBlob(item.dataUrl),file=new File([blob],item.fileName||"Bericht.pdf",{type:blob.type});await saveImportedReportPdf(item.reportId,file);const report=(csvArchive||[]).find(x=>x.id===item.reportId);if(report){report.hasImportedPdf=true;report.pdfFileName=file.name;}restored++;}if(restored)saveArchive();return restored;}
