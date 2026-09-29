(function(){
  "use strict";
  const get=id=>document.getElementById(id);
  function normalizedBase(name){return String(name||"").replace(/\.(csv|pdf)$/i,"").toLocaleLowerCase("de-DE");}
  function normalizedRows(content){return (parseCsvRows(content)||[]).map(row=>[row.date,row.time,row.name,row.sessionType,row.status,row.role,row.topic].map(v=>String(v||"").trim()).join("|")).join("\n");}
  function reportKey(item){const rows=parseCsvRows(item.content)||[],first=rows[0]||{};return [first.date||"",item.sessionType||first.sessionType||"",item.topic||first.topic||"",normalizedRows(item.content)].join("|");}
  function counts(rows){return {presentCount:rows.filter(r=>r.status==="Anwesend").length,excusedCount:rows.filter(r=>r.status==="Entschuldigt").length,missingCount:rows.filter(r=>r.status==="Fehlt").length};}
  function itemFromCsv(file,content){const rows=parseCsvRows(content)||[];if(!rows.length)throw new Error(`${file.name}: keine lesbaren Berichtsdaten`);const first=rows[0];return {id:makeId(),fileName:file.name,content,sessionType:first.sessionType||"Probe",topic:first.topic||"",createdAt:new Date(file.lastModified||Date.now()).toISOString(),...counts(rows)};}
  async function importHistoryFiles(files){
    const list=[...files],csvFiles=list.filter(f=>/\.csv$/i.test(f.name)),pdfFiles=list.filter(f=>/\.pdf$/i.test(f.name));
    if(!csvFiles.length&&!pdfFiles.length)throw new Error("In den Speicherorten wurden keine CSV- oder PDF-Berichte gefunden.");
    const existingByKey=new Map((csvArchive||[]).map(item=>[reportKey(item),item]));
    const byBase=new Map((csvArchive||[]).map(item=>[normalizedBase(item.fileName),item]));
    let added=0,skipped=0,pdfs=0,orphans=0,invalid=0;
    for(const file of csvFiles){try{const item=itemFromCsv(file,await file.text()),key=reportKey(item);if(existingByKey.has(key)){skipped++;byBase.set(normalizedBase(file.name),existingByKey.get(key));continue;}csvArchive.push(item);existingByKey.set(key,item);byBase.set(normalizedBase(file.name),item);added++;}catch(error){console.error(error);invalid++;}}
    for(const file of pdfFiles){const item=byBase.get(normalizedBase(file.name));if(!item){orphans++;continue;}await saveImportedReportPdf(item.id,file);item.pdfFileName=file.name;item.hasImportedPdf=true;pdfs++;}
    csvArchive.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));saveArchive();renderHistory();renderStatistics();
    const parts=[`${added} neue CSV`,`${skipped} Duplikate übersprungen`,`${pdfs} PDF zugeordnet`];if(invalid)parts.push(`${invalid} ungültige CSV`);if(orphans)parts.push(`${orphans} PDF ohne CSV`);showToast(parts.join(" · "));const result={added,skipped,pdfs,orphans,invalid,selectedPdfNames:pdfFiles.map(file=>normalizedBase(file.name))};
    localStorage.setItem("fw_v1_last_import",JSON.stringify({...result,at:new Date().toISOString()}));
    updateImportStatus();
    return result;
  }
  async function filesFromDirectory(handle,recursive=false){const files=[];for await(const entry of handle.values()){if(entry.kind==="file"&&/^.+\.(csv|pdf)$/i.test(entry.name))files.push(await entry.getFile());else if(recursive&&entry.kind==="directory")files.push(...await filesFromDirectory(entry,true));}return files;}
  async function ensureReadPermission(handle){if(!handle)return false;if(typeof handle.queryPermission!=="function")return true;if(await handle.queryPermission({mode:"read"})==="granted")return true;return typeof handle.requestPermission==="function"&&await handle.requestPermission({mode:"read"})==="granted";}
  async function filesFromConfiguredLocations(){
    const handles=[csvDirectoryHandle,pdfDirectoryHandle].filter(Boolean),unique=[];
    for(const handle of handles)if(!unique.some(item=>item===handle))unique.push(handle);
    if(!unique.length)return {files:[],names:[],unavailable:[]};
    const files=[],names=[],unavailable=[];
    for(const handle of unique){
      const name=handle.name||"Speicherort";
      try{
        if(!await ensureReadPermission(handle)){unavailable.push(name);continue;}
        names.push(name);
        files.push(...await filesFromDirectory(handle,Boolean(get("historyIncludeSubfolders")?.checked)));
      }catch(error){
        console.warn(`Speicherort ${name} ist nicht mehr erreichbar`,error);
        unavailable.push(name);
      }
    }
    const uniqueFiles=[],seenFiles=new Set();
    for(const file of files){const signature=`${file.name}|${file.size}|${file.lastModified}`;if(seenFiles.has(signature))continue;seenFiles.add(signature);uniqueFiles.push(file);}
    return {files:uniqueFiles,names:[...new Set(names)],unavailable:[...new Set(unavailable)]};
  }
  async function chooseFolder(){
    const handle=await window.showDirectoryPicker({id:"ffw-history-import",mode:"read"});
    return {files:await filesFromDirectory(handle,Boolean(get("historyIncludeSubfolders")?.checked)),names:[handle.name||"Ausgewählter Ordner"],unavailable:[]};
  }
  async function importConfiguredOrChoose(){
    let source=await filesFromConfiguredLocations(),usedFallback=false;
    if(!source.files.length){
      if(typeof window.showDirectoryPicker!=="function")throw new Error("Die eingestellten Speicherorte sind nicht erreichbar. Bitte die Dateien erneut auswählen.");
      source=await chooseFolder();usedFallback=true;
    }
    const result=await importHistoryFiles(source.files);
    if(source.unavailable?.length)showToast(`Nicht erreichbare Speicherorte wurden übersprungen: ${source.unavailable.join(" · ")}.` ,"error");
    else if(usedFallback)showToast("Der gespeicherte Speicherort war nicht mehr erreichbar. Der neu ausgewählte Ordner wurde für diesen Import verwendet.");
    return {...result,names:source.names,unavailable:source.unavailable||[],usedFallback};
  }
  function updateHint(){const hint=get("historyImportHint"),button=get("importHistoryReportsButton");if(!hint||!button)return;const names=[csvDirectoryHandle?.name,pdfDirectoryHandle?.name].filter(Boolean);if(names.length){button.textContent="Alle Berichte aus den eingestellten Speicherorten einlesen";hint.textContent=`Verwendete Speicherorte: ${[...new Set(names)].join(" · ")}. CSV und PDF werden zusammengeführt; Duplikate werden übersprungen.`;}else{button.textContent=typeof window.showDirectoryPicker==="function"?"Berichtsordner auswählen und alle Dateien einlesen":"CSV- und PDF-Berichte auswählen";hint.textContent="Kein erreichbarer Speicherort ist hinterlegt. Beim Import wird deshalb ein Ordner beziehungsweise werden Dateien ausgewählt.";}}
  async function syncHistoryWithFiles(files){
    const list=[...files],csvFiles=list.filter(file=>/\.csv$/i.test(file.name)),pdfFiles=list.filter(file=>/\.pdf$/i.test(file.name));
    if(!csvFiles.length)throw new Error("In den ausgewählten Speicherorten wurden keine CSV-Berichte gefunden. Das lokale Archiv wurde nicht verändert.");
    const incoming=[],incomingByKey=new Map();
    for(const file of csvFiles){
      try{
        const item=itemFromCsv(file,await file.text()),key=reportKey(item);
        if(!incomingByKey.has(key)){incomingByKey.set(key,item);incoming.push(item);}
      }catch(error){console.error(error);}
    }
    if(!incoming.length)throw new Error("Es wurden keine gültigen CSV-Berichte gefunden. Das lokale Archiv wurde nicht verändert.");
    const incomingKeys=new Set(incomingByKey.keys());
    const current=[...(csvArchive||[])],removed=current.filter(item=>!incomingKeys.has(reportKey(item)));
    if(!confirm(`Das lokale Archiv wird an die gewählten Speicherorte angepasst. ${removed.length} nicht mehr vorhandene Bericht(e) werden lokal entfernt. Fortfahren?`))return {cancelled:true};
    const currentByKey=new Map(current.map(item=>[reportKey(item),item]));
    csvArchive=incoming.map(item=>{const existing=currentByKey.get(reportKey(item));return existing?{...existing,fileName:item.fileName,content:item.content,sessionType:item.sessionType,topic:item.topic,presentCount:item.presentCount,excusedCount:item.excusedCount,missingCount:item.missingCount}:item;});
    for(const item of removed)await deleteImportedReportPdf?.(item.id);
    const byBase=new Map(csvArchive.map(item=>[normalizedBase(item.fileName),item]));
    let pdfs=0,orphans=0;
    for(const file of pdfFiles){const item=byBase.get(normalizedBase(file.name));if(!item){orphans++;continue;}await saveImportedReportPdf(item.id,file);item.pdfFileName=file.name;item.hasImportedPdf=true;pdfs++;}
    csvArchive.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));saveArchive();renderHistory();renderStatistics();
    const status={at:new Date().toISOString(),added:Math.max(0,csvArchive.length-(current.length-removed.length)),skipped:csvArchive.length,pdfs,orphans,invalid:0,removed:removed.length,mode:"sync",selectedPdfNames:pdfFiles.map(file=>normalizedBase(file.name))};
    localStorage.setItem("fw_v1_last_import",JSON.stringify(status));updateImportStatus();
    showToast(`Archiv abgeglichen: ${csvArchive.length} CSV · ${removed.length} lokale Altberichte entfernt · ${pdfs} PDF zugeordnet.`);
    return status;
  }
  async function syncConfiguredOrChoose(){let source=await filesFromConfiguredLocations();if(!source.files.length){if(typeof window.showDirectoryPicker!=="function")throw new Error("Die eingestellten Speicherorte sind nicht erreichbar.");source=await chooseFolder();}return syncHistoryWithFiles(source.files);}
  function updateImportStatus(){const el=get("historyImportStatus");if(!el)return;try{const data=JSON.parse(localStorage.getItem("fw_v1_last_import")||"null");el.textContent=data?`${data.mode==="sync"?"Letzter Abgleich":"Letzter Import"}: ${new Date(data.at).toLocaleString("de-DE")} · ${data.added} neu · ${data.skipped} ${data.mode==="sync"?"CSV vorhanden":"Duplikate"} · ${data.removed||0} entfernt · ${data.pdfs} PDF · ${data.invalid} Fehler`:"Noch kein Import auf diesem Gerät durchgeführt.";}catch{el.textContent="Importstatus nicht verfügbar.";}}
  async function auditHistory(){
    const result=get("historyAuditResult"),last=JSON.parse(localStorage.getItem("fw_v1_last_import")||"null"),pdfNames=new Set(last?.selectedPdfNames||[]);
    let noTopic=0,noDate=0,csvWithoutPdf=0,brokenPdf=0,linkedPdfs=0;
    for(const item of csvArchive||[]){
      const rows=parseCsvRows(item.content)||[],first=rows[0]||{};
      if(!String(item.topic||first.topic||"").trim())noTopic++;
      if(!String(first.date||"").trim())noDate++;
      const storedPdf=item.hasImportedPdf?await loadImportedReportPdf(item.id):null;
      const matchedByImport=pdfNames.has(normalizedBase(item.fileName));
      const hasPdf=Boolean(storedPdf)||matchedByImport;
      if(hasPdf)linkedPdfs++;else csvWithoutPdf++;
      if(item.hasImportedPdf&&!storedPdf)brokenPdf++;
    }
    const orphanPdfs=last?.orphans||0;
    const issueCount=csvWithoutPdf+orphanPdfs+noTopic+noDate+brokenPdf;
    const statusClass=issueCount===0?"audit-ok":"audit-warning";
    const statusText=issueCount===0?"Archiv vollständig: Alle CSV-Berichte haben ein passendes PDF und gültige Grunddaten.":`${issueCount} Auffälligkeit(en) gefunden.`;
    result.hidden=false;
    result.innerHTML=`<strong>Archivprüfung</strong><p class="${statusClass}">${statusText}</p><ul><li>${csvArchive.length} CSV-Berichte im Archiv</li><li>${linkedPdfs} CSV mit zugeordnetem PDF</li><li>${csvWithoutPdf} CSV ohne zugeordnetes PDF</li><li>${orphanPdfs} PDF ohne passende CSV beim letzten Import</li><li>${noTopic} Berichte ohne Thema</li><li>${noDate} Berichte ohne Datum</li><li>${brokenPdf} PDF-Zuordnungen ohne gespeicherte Datei</li></ul>`;
  }

  function bind(){const button=get("importHistoryReportsButton"),syncButton=get("syncHistoryReportsButton"),input=get("historyReportsFileInput"),audit=get("auditHistoryButton");if(!button||!input||button.dataset.bound)return;button.dataset.bound="true";updateHint();updateImportStatus();audit?.addEventListener("click",auditHistory);syncButton?.addEventListener("click",async()=>{syncButton.disabled=true;const label=syncButton.textContent;syncButton.textContent="Archiv wird abgeglichen …";try{await syncConfiguredOrChoose();}catch(error){if(error?.name!=="AbortError"){console.error(error);showToast(error.message||"Das Archiv konnte nicht abgeglichen werden.","error");}}finally{syncButton.disabled=false;syncButton.textContent=label;}});button.addEventListener("click",async()=>{if(typeof window.showDirectoryPicker!=="function"&&!csvDirectoryHandle&&!pdfDirectoryHandle){input.click();return;}button.disabled=true;const label=button.textContent;button.textContent="Berichte werden eingelesen …";try{await importConfiguredOrChoose();}catch(error){if(error?.name!=="AbortError"){console.error(error);const missing=error?.name==="NotFoundError"||/could not be found|not found/i.test(error?.message||"");showToast(missing?"Der gespeicherte Ordner ist nicht mehr erreichbar. Bitte den Speicherort unter Einstellungen neu auswählen.":(error.message||"Die Speicherorte konnten nicht eingelesen werden."),"error");}}finally{button.disabled=false;button.textContent=label;updateHint();}});input.addEventListener("change",async()=>{try{if(input.files?.length)await importHistoryFiles(input.files);}catch(error){showToast(error.message||"Berichte konnten nicht eingelesen werden.","error");}finally{input.value="";}});}
  window.FFWReportImport=Object.freeze({itemFromCsv,importHistoryFiles,importConfiguredOrChoose,syncHistoryWithFiles,syncConfiguredOrChoose,updateHint,updateImportStatus,auditHistory,bind});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
