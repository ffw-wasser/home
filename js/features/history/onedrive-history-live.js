"use strict";
(() => {
  let pendingLoad = null,loadEpoch=0;
  window.clearOneDriveHistory=()=>{loadEpoch++;pdfByReportId.clear();reportCache.clear();cacheRoot="";csvArchive=[];window.oneDriveHistoryLastError="";};
  const pdfByReportId = new Map();
  let reportCache = new Map(), cacheRoot = "";
  const clone = value => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const cleanName = name => String(name || "").split("/").pop();
  const baseName = name => cleanName(name).replace(/\.zip$/i, "");
  const logicalBase = name => baseName(name)
    .replace(/_korrigiert-v\d+$/i, "")
    .replace(/_korrigiert$/i, "")
    .toLocaleLowerCase("de-DE");

  async function children(root, itemId) {
    const result = [];
    let url = `h2o-storage://drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,file,folder,lastModifiedDateTime,size,eTag,cTag`;
    while (url) {
      const response = await odFetch(url);
      const data = await response.json();
      result.push(...(data.value || []));
      url = data["@odata.nextLink"] || "";
    }
    return result;
  }

  async function zipFiles(root, itemId = root.id, depth = 0) {
    if(window.CloudStorage?.connected&&itemId===root.id)return (await CloudStorage.walk('Berichte')).filter(file=>/\.(zip|csv|pdf)$/i.test(file.path)).map(file=>({id:file.id,name:file.name,path:file.path,file:{},size:file.size,eTag:'"f-'+file.version+'"',lastModifiedDateTime:file.modifiedAt}));
    if (depth > 32) throw new Error('Die Berichtsordner sind zu tief verschachtelt.');
    const result = [];
    for (const item of await children(root, itemId)) {
      if (item.folder) result.push(...await zipFiles(root, item.id, depth + 1));
      else if (item.file && /\.zip$/i.test(item.name)) result.push(item);
    }
    return result;
  }

  async function itemBlob(root, item) {
    return (await odFetch(`h2o-storage://drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(item.id)}/content`)).blob();
  }

  function counts(rows) {
    return {
      presentCount: rows.filter(row => row.status === "Anwesend").length,
      excusedCount: rows.filter(row => row.status === "Entschuldigt").length,
      missingCount: rows.filter(row => row.status === "Fehlt").length
    };
  }

  async function reportFromZip(root, file, nextPdfs) {
    const blob = await itemBlob(root, file);
    try {
    const zip = await JSZip.loadAsync(blob);
    const infoEntry = zip.file("paket-info.json");
    const info = infoEntry ? JSON.parse(await infoEntry.async("string")) : {};
    const csvEntry = (info.csvName && zip.file(info.csvName)) || Object.values(zip.files).find(entry => !entry.dir && /\.csv$/i.test(entry.name));
    if (!csvEntry) return null;
    const content = await csvEntry.async("string");
    const parseCsvMatrix = text => {
      const source=String(text||"").replace(/^\uFEFF/,"");
      const matrix=[];let row=[],cell="",quoted=false;
      for(let i=0;i<source.length;i++){
        const ch=source[i],next=source[i+1];
        if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;}
        else if(ch==='"')quoted=!quoted;
        else if(ch===';'&&!quoted){row.push(cell);cell="";}
        else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(value=>value!==""))matrix.push(row);row=[];cell="";}
        else cell+=ch;
      }
      row.push(cell);if(row.some(value=>value!==""))matrix.push(row);return matrix;
    };
    const matrix=parseCsvMatrix(content),headers=(matrix[0]||[]).map(value=>String(value||"").trim()),values=matrix[1]||[];
    const headerIndex = name => headers.findIndex(header=>header.toLocaleLowerCase("de-DE")===name.toLocaleLowerCase("de-DE"));
    const isOperation = headerIndex("Einsatzart")>=0 || headerIndex("Alarmzeit")>=0 || Boolean(info.operationData) || info.type==="Einsatz";
    const rows = isOperation ? [] : CsvEngine.parse(content);
    const first = rows[0] || {};
    const valueFor = name => { const index=headerIndex(name); return index>=0 ? String(values[index]||"").trim() : ""; };
    const reportDate = [isOperation ? valueFor("Datum") : first.date,info.operationData?.date,info.originalReportDate].map(CsvEngine.normalizeDate).find(Boolean)||"";
    const detectedOperationData = isOperation ? {
      date: reportDate,
      type: valueFor("Einsatzart") || "Einsatz",
      location: valueFor("Einsatzstelle"),
      number: valueFor("Einsatznummer"),
      times: { alarm: valueFor("Alarmzeit") }
    } : undefined;
    const id = `onedrive-zip:${file.id}`;
    const pdfEntry = (info.pdfName && zip.file(info.pdfName)) || Object.values(zip.files).find(entry => !entry.dir && /\.pdf$/i.test(entry.name));
    if (pdfEntry) nextPdfs.set(id, await pdfEntry.async("blob"));
    const operationData = info.operationData ? clone(info.operationData) : detectedOperationData;
    if (operationData && reportDate) operationData.date = reportDate;
    return {
      id,
      packageFileName: file.name,
      fileName: cleanName(info.csvName || csvEntry.name),
      pdfFileName: cleanName(info.pdfName || (info.csvName || csvEntry.name).replace(/\.csv$/i, ".pdf")),
      content,
      sessionType: isOperation ? "Einsatz" : (first.sessionType || info.type || "Probe"),
      topic: isOperation ? [operationData?.type, operationData?.location].filter(Boolean).join(" · ") : (first.topic || ""),
      createdAt: file.lastModifiedDateTime || info.createdAt || new Date().toISOString(),
      originalReportDate: reportDate,
      calendarEventId:typeof info.calendarEventId==="string"?info.calendarEventId:null,
      calendarEventStart:Number.isFinite(info.calendarEventStart)?info.calendarEventStart:null,
      operationData,
      correctedAt:info.correctedAt||"",
      revisions:Array.isArray(info.revisions)?clone(info.revisions):[],legacySourceId:info.legacySourceId||"",legacySourceVersion:info.legacySourceVersion,legacyPdf:info.legacyPdf||null,
      oneDriveLive: true,
      oneDriveETag: file.eTag || "",
      hasImportedPdf: Boolean(pdfEntry),
      ...(isOperation ? {presentCount:Math.max(0,matrix.length-1),excusedCount:0,missingCount:0} : counts(rows))
    };
    } catch (error) { error.code = "invalidReportPackage"; throw error; }
  }

  async function reportFromCsv(root,file,all,nextPdfs){
    const content=await(await itemBlob(root,file)).text(),rows=CsvEngine.parse(content),first=rows[0]||{};
    if(!rows.length)return null;
    const id='cloud-csv:'+file.id,stem=file.name.replace(/\.csv$/i,'').toLocaleLowerCase('de'),pdfs=all.filter(item=>item.name.toLocaleLowerCase('de')===stem+'.pdf');
    if(pdfs.length===1)nextPdfs.set(id,await itemBlob(root,pdfs[0]));
    return {id,fileName:file.name,pdfFileName:pdfs[0]?.name||file.name.replace(/\.csv$/i,'.pdf'),content,sessionType:first.sessionType||'Probe',topic:first.topic||'',originalReportDate:first.date||'',createdAt:file.lastModifiedDateTime||'',oneDriveLive:true,cloudCsv:true,cloudPath:file.path,cloudPdf:pdfs.length===1?pdfs[0]:null,oneDriveETag:file.eTag,hasImportedPdf:pdfs.length===1,...counts(rows)};
  }

  function historyStatus(text) {
    window.Usability?.historyStatus(text);
    const status = document.getElementById("statisticsHistoryStatus");
    if (status) { status.textContent = text; status.hidden = !text; }
  }

  function loadOneDriveHistory(options = {}) {
    // Navigation und Synchronisierung warten auf denselben laufenden Abruf.
    if (pendingLoad) return pendingLoad;
    pendingLoad = refreshOneDriveHistory(options).finally(() => { pendingLoad = null; });
    return pendingLoad;
  }

  async function refreshOneDriveHistory({ manual = false } = {}) {
    const epoch=loadEpoch;
    if (!oneDriveSignedIn()) {
      csvArchive = [];
      pdfByReportId.clear();
      reportCache.clear(); cacheRoot = "";
      renderHistory?.();
      renderStatistics?.();
      historyStatus("Bitte Cloudflare verbinden, um Historie und Statistik zu laden.");
      if (manual) showToast("Bitte zuerst Cloudflare verbinden.", "error");
      return false;
    }
    if (navigator.onLine === false) {
      historyStatus("Offline. Historie und Statistik zeigen den zuletzt geladenen Stand. Sobald die Verbindung zurückkehrt, wird erneut synchronisiert.");
      if (manual) showToast("Offline. Bitte Internetverbindung prüfen.", "error");
      return false;
    }
    let failedFile = "";
    historyStatus("Historie wird aus Cloudflare geladen. Die Statistik aktualisiert sich anschließend automatisch.");
    document.documentElement.classList.add("onedrive-history-loading");
    try {
      const root = await oneDriveResolveSharedRoot();
      const rootKey = `${root.driveId}:${root.id}`;
      if (cacheRoot !== rootKey) { reportCache.clear(); cacheRoot = rootKey; }
      const allFiles=await zipFiles(root),packageNames=new Set(allFiles.filter(file=>/\.zip$/i.test(file.name)).map(file=>logicalBase(file.name)));
      const files=allFiles.filter(file=>/\.zip$/i.test(file.name)||/\.csv$/i.test(file.name)&&!packageNames.has(logicalBase(file.name.replace(/\.csv$/i,'.zip'))));
      const newestByLogicalName = new Map();
      for (const file of files) {
        const key = `${logicalBase(file.name)}::${file.id}`;
        const current = newestByLogicalName.get(key);
        if (!current || String(file.lastModifiedDateTime || "") > String(current.lastModifiedDateTime || "")) newestByLogicalName.set(key, file);
      }
      const filesToLoad = [...newestByLogicalName.values()];
      const reports = new Array(filesToLoad.length), nextPdfs = new Map(), nextCache = new Map();
      let nextIndex = 0, failure = null;
      async function loadReports() {
       while (!failure && epoch === loadEpoch && oneDriveSignedIn() && nextIndex < filesToLoad.length) {
        const index = nextIndex++, file = filesToLoad[index];
        try {
          const paired=/\.csv$/i.test(file.name)?allFiles.filter(other=>other.name.toLowerCase()===file.name.replace(/\.csv$/i,'.pdf').toLowerCase()):[];
          const version = JSON.stringify([file.name, file.eTag, file.cTag, file.lastModifiedDateTime, file.size,paired.map(other=>[other.id,other.eTag,other.lastModifiedDateTime,other.size])]);
          const cached = reportCache.get(file.id);
          const reusable = Boolean(file.eTag || file.cTag || file.lastModifiedDateTime) && cached?.version === version;
          const report = reusable ? clone(cached.report) : /\.csv$/i.test(file.name)?await reportFromCsv(root,file,allFiles,nextPdfs):await reportFromZip(root, file, nextPdfs);
          if (reusable && cached.pdf) nextPdfs.set(report.id, cached.pdf);
          if (report) {
            reports[index] = report;
            nextCache.set(file.id, {version, report: clone(report), pdf: nextPdfs.get(report.id)});
          }
        } catch (error) {
          if (!failure) { failure = error; failedFile = cleanName(file.name); }
        }
       }
      }
      // Drei Abrufe verkürzen die Netzwerkwartezeit, ohne alle ZIPs gleichzeitig
      // zu laden. Auch bei Fehlern erst die laufenden Abrufe vollständig abwarten.
      await Promise.all(Array.from({length: Math.min(3, filesToLoad.length)}, loadReports));
      if (failure) throw failure;
      failedFile = "";
      // Den bisherigen Stand erst nach einem vollständig erfolgreichen Abruf ersetzen.
      // Quelle bleiben ausschließlich die aktuell in Cloudflare vorhandenen ZIP-Pakete.
      if(epoch!==loadEpoch||!oneDriveSignedIn())return false;
      const loaded=reports.filter(Boolean),superseded=new Set(loaded.map(report=>report.legacySourceId).filter(Boolean)),names=new Set(loaded.map(report=>report.fileName));
      const fallback=(window.CloudStorage?.legacyArchive||[]).filter(report=>!names.has(report.fileName)).map(report=>({...report,oneDriveLive:false,legacyRetained:true}));
      csvArchive = [...loaded.filter(report=>!superseded.has(report.id.replace(/^cloud-csv:/,''))),...fallback].sort((a, b) => historyDateFromItem(b).localeCompare(historyDateFromItem(a)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      reportCache = nextCache;
      pdfByReportId.clear();
      nextPdfs.forEach((pdf, id) => pdfByReportId.set(id, pdf));
      renderHistory?.();
      renderStatistics?.();
      window.oneDriveHistoryLastError = "";
      historyStatus("");
      window.Usability?.historyStatus("",new Date().toISOString());
      if (manual) showToast(`Historie aus ${files.length} Cloudflare-ZIP-Datei${files.length === 1 ? "" : "en"} geladen.`);
      return true;
    } catch (error) {
      if(epoch!==loadEpoch)return false;
      console.error("Cloudflare-Historie konnte nicht geladen werden", error);
      const hint = error.code === "oneDriveRequestTimeout" ? "Cloudflare hat nicht rechtzeitig geantwortet. Bitte erneut synchronisieren."
        : error.code === "serviceReadOnly" ? "Die bisherige Datenquelle ist vorübergehend schreibgeschützt. Bitte den Datenstand erneut prüfen."
        : ["oneDriveFolderUnavailable","oneDriveFolderLinkInvalid"].includes(error.code) ? error.message
        : error.status === 401 || /Anmeldung|angemeldet/i.test(error.message || "")
        ? "Bitte Cloudflare erneut anmelden."
        : error.status === 403 ? "Bitte die Zugriffsrechte auf den gemeinsamen Cloudflare-Ordner prüfen."
        : error.status === 429 ? "Cloudflare begrenzt momentan die Abrufe. Bitte etwas später erneut synchronisieren."
        : error.status === 404 ? "Eine Datei oder ein Ordner wurde verschoben oder gelöscht. Bitte erneut synchronisieren."
        : error.code === "invalidReportPackage" ? "Dieses ZIP-Paket ist nicht lesbar. Bitte die Datei in Cloudflare prüfen oder neu exportieren."
        : "Bitte Internetverbindung prüfen und erneut synchronisieren.";
      const detail = `${failedFile ? " Datei: " + failedFile + "." : ""}${error.status ? " Cloudflare-Fehler " + error.status + "." : ""}`;
      const message = `Historie konnte nicht aktualisiert werden.${detail} Historie und Statistik zeigen den zuletzt geladenen Stand. ${hint}`;
      window.oneDriveHistoryLastError = message;
      historyStatus(message);
      if (manual) showToast(message, "error");
      return false;
    } finally {
      document.documentElement.classList.remove("onedrive-history-loading");
    }
  }

  function checkedReportTag(item,metadata){
    if(!metadata.eTag)throw new Error("Die Dateiversion konnte nicht geprüft werden. Bitte Historie erneut laden.");
    if(item.oneDriveETag&&item.oneDriveETag!==metadata.eTag)throw Object.assign(new Error("Der Bericht wurde inzwischen geändert. Bitte Historie erneut laden und die Korrektur prüfen."),{status:412});
    return metadata.eTag;
  }
  window.deleteOneDriveHistoryItem = async item => {
    if(item?.cloudCsv){
      const metadata=await CloudStorage.stat(item.cloudPath);checkedReportTag(item,{eTag:'"f-'+metadata.version+'"'});
      const config=CloudStorage.config();await CloudStorage.call('/admin/storage-files/delete',{source:CloudStorage.sourceHash,run:config.run,path:item.cloudPath,expectedVersion:metadata.version,operationId:crypto.randomUUID()});reportCache.delete(metadata.id);return;
    }

    if(pendingLoad)await pendingLoad;
    if(!item?.oneDriveLive||!String(item.id||"").startsWith("onedrive-zip:"))throw new Error("Das Original-Terminpaket fehlt.");
    const fileId=item.id.slice("onedrive-zip:".length);
    if(item.legacySourceId&&window.CloudStorage?.connected){
      const cfg=CloudStorage.config(),targets=[];
      try{const metadata=await CloudStorage.stat(item.legacySourceId,{id:true});if(metadata.version!==item.legacySourceVersion)throw new Error('Das frühere Original wurde zwischenzeitlich geändert. Bitte die Historie prüfen.');targets.push(metadata);}catch(error){if(error.status!==404)throw error;}
      if(item.legacyPdf)try{const metadata=await CloudStorage.stat(item.legacyPdf.path);if(metadata.version!==item.legacyPdf.version)throw new Error('Das frühere PDF wurde zwischenzeitlich geändert. Bitte die Historie prüfen.');targets.push(metadata);}catch(error){if(error.status!==404)throw error;}
      for(const target of targets)await CloudStorage.call('/admin/storage-files/delete',{source:CloudStorage.sourceHash,run:cfg.run,path:target.path,expectedVersion:target.version,operationId:crypto.randomUUID()});
    }

    if(!fileId)throw new Error("Die Cloudflare-Dateikennung fehlt.");
    const root=await oneDriveResolveSharedRoot();
    const url=`h2o-storage://drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(fileId)}`;
    try{
      const metadata=await (await odFetch(url+"?$select=id,eTag")).json();
      await odFetch(url,{method:"DELETE",headers:{"If-Match":checkedReportTag(item,metadata)}});
    }catch(error){if(error.status!==404)throw error;}
    // Ein gleichzeitig gestarteter Abruf darf den gelöschten Bericht nicht wieder einsetzen.
    loadEpoch++;
    reportCache.delete(fileId);pdfByReportId.delete(item.id);
    if(pendingLoad)await pendingLoad;
  };
  window.saveOneDriveHistoryCorrection = async (item, pdf, {preserveAttachments=true}={}) => {
    if(item?.cloudCsv){
      const metadata=await CloudStorage.stat(item.cloudPath);checkedReportTag(item,{eTag:'"f-'+metadata.version+'"'});
      const original=new JSZip(),originalCsv=await CloudStorage.readFile(item.cloudPath,metadata.version);
      original.file(item.fileName,originalCsv);
      let originalPdf=pdf,legacyPdf=null;
      if(item.cloudPdf){const meta=await CloudStorage.stat(item.cloudPdf.path);if('"f-'+meta.version+'"'!==item.cloudPdf.eTag)throw Object.assign(new Error('Das zugehörige PDF wurde inzwischen geändert. Bitte Historie erneut laden.'),{status:412});originalPdf=await CloudStorage.readFile(meta.path,meta.version);legacyPdf={path:meta.path,version:meta.version};}
      original.file(item.pdfFileName,originalPdf);
      original.file('paket-info.json',JSON.stringify({format:'FFW-Wasser-Terminpaket',version:'2.0',type:item.sessionType,createdAt:item.createdAt,originalReportDate:item.originalReportDate,baseName:item.fileName.replace(/\.csv$/i,''),csvName:item.fileName,pdfName:item.pdfFileName,operationData:item.operationData,legacySourceId:metadata.id,legacySourceVersion:metadata.version,legacyPdf}));
      const saved=await CloudStorage.writeFile(item.cloudPath.replace(/\.csv$/i,'.zip'),await original.generateAsync({type:'uint8array',compression:'DEFLATE'}),0);reportCache.delete(metadata.id);
      return window.saveOneDriveHistoryCorrection({...item,cloudCsv:false,id:'onedrive-zip:'+saved.id,oneDriveETag:'"f-'+saved.version+'"'},pdf,{preserveAttachments:Boolean(legacyPdf)&&preserveAttachments});
    }

    if(pendingLoad)await pendingLoad;
    if(!item?.oneDriveLive||!String(item.id||"").startsWith("onedrive-zip:"))throw new Error("Das Original-Terminpaket fehlt.");
    const fileId=item.id.slice("onedrive-zip:".length);
    if(!fileId)throw new Error("Die Cloudflare-Dateikennung fehlt.");
    const root=await oneDriveResolveSharedRoot();
    const url=`h2o-storage://drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(fileId)}`;
    const metadata=await (await odFetch(url+"?$select=id,eTag")).json();
    const eTag=checkedReportTag(item,metadata);
    const zip=await JSZip.loadAsync(await (await odFetch(url+"/content",{headers:{"If-Match":eTag}})).blob());
    const infoEntry=zip.file("paket-info.json");
    const info=infoEntry?JSON.parse(await infoEntry.async("string")):{};
    const oldCsv=info.csvName||Object.values(zip.files).find(entry=>!entry.dir&&/\.csv$/i.test(entry.name))?.name;
    const oldPdf=info.pdfName||Object.values(zip.files).find(entry=>!entry.dir&&/\.pdf$/i.test(entry.name))?.name;
    if(!oldCsv)throw new Error("Das Paket enthält keinen CSV-Bericht.");
    // Zusatzseiten des ursprünglichen Berichts nach dem neu erzeugten Hauptbericht erhalten.
    if(preserveAttachments&&oldPdf&&zip.file(oldPdf)&&globalThis.PDFLib?.PDFDocument){
      const rows=CsvEngine.parse(await zip.file(oldCsv).async("string"));
      const c=counts(rows);
      const oldMain=item.operationData?await operationPdfBlob(info.operationData||item.operationData):probePdfBlob(rows.map(row=>({time:row.time,name:row.name,status:row.status,role:row.role})),rows[0]?.sessionType||item.sessionType,{present:c.presentCount,excused:c.excusedCount,missing:c.missingCount,notApplicable:rows.filter(row=>row.status==="Betrifft nicht").length},rows[0]?.topic||"",rows[0]?.date||"");
      const mainDocument=await PDFLib.PDFDocument.load(await oldMain.arrayBuffer());
      const previous=await PDFLib.PDFDocument.load(await zip.file(oldPdf).async("uint8array"));
      if(previous.getPageCount()>mainDocument.getPageCount()){
        const corrected=await PDFLib.PDFDocument.load(await pdf.arrayBuffer());
        const pages=previous.getPageIndices().slice(mainDocument.getPageCount());
        for(const page of await corrected.copyPages(previous,pages))corrected.addPage(page);
        pdf=new Blob([await corrected.save()],{type:"application/pdf"});
      }
    }
    zip.remove(oldCsv);if(oldPdf)zip.remove(oldPdf);
    zip.file(item.fileName,item.content);zip.file(item.pdfFileName,pdf);
    zip.file("paket-info.json",JSON.stringify({...info,operationData:item.operationData||info.operationData,csvName:item.fileName,pdfName:item.pdfFileName,correctedAt:item.correctedAt,revisions:item.revisions,files:Object.keys(zip.files)},null,2));
    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
    await odFetch(url+"/content",{method:"PUT",headers:{"Content-Type":"application/zip","If-Match":eTag},body:blob});
    reportCache.delete(fileId);
  };
  window.loadOneDriveHistory = loadOneDriveHistory;
  window.loadOneDriveHistoryPdf = async item => pdfByReportId.get(item?.id) || null;
})();



