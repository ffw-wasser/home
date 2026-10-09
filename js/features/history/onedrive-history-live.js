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
    let url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,file,folder,lastModifiedDateTime,size,eTag,cTag`;
    while (url) {
      const response = await odFetch(url);
      const data = await response.json();
      result.push(...(data.value || []));
      url = data["@odata.nextLink"] || "";
    }
    return result;
  }

  async function zipFiles(root, itemId = root.id, depth = 0) {
    if (depth > 4) return [];
    const result = [];
    for (const item of await children(root, itemId)) {
      if (item.folder) result.push(...await zipFiles(root, item.id, depth + 1));
      else if (item.file && /\.zip$/i.test(item.name)) result.push(item);
    }
    return result;
  }

  async function itemBlob(root, item) {
    return (await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(item.id)}/content`)).blob();
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
    const reportDate = [isOperation ? valueFor("Datum") : first.date,info.operationData?.date,info.createdAt,file.lastModifiedDateTime].map(CsvEngine.normalizeDate).find(Boolean)||"";
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
      operationData,
      oneDriveLive: true,
      hasImportedPdf: Boolean(pdfEntry),
      ...(isOperation ? {presentCount:Math.max(0,matrix.length-1),excusedCount:0,missingCount:0} : counts(rows))
    };
    } catch (error) { error.code = "invalidReportPackage"; throw error; }
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
      historyStatus("Bitte OneDrive verbinden, um Historie und Statistik zu laden.");
      if (manual) showToast("Bitte zuerst OneDrive verbinden.", "error");
      return false;
    }
    if (navigator.onLine === false) {
      historyStatus("Offline. Historie und Statistik zeigen den zuletzt geladenen Stand. Sobald die Verbindung zurückkehrt, wird erneut synchronisiert.");
      if (manual) showToast("Offline. Bitte Internetverbindung prüfen.", "error");
      return false;
    }
    let failedFile = "";
    historyStatus("Historie wird aus OneDrive geladen. Die Statistik aktualisiert sich anschließend automatisch.");
    document.documentElement.classList.add("onedrive-history-loading");
    try {
      const root = await oneDriveResolveSharedRoot();
      const rootKey = `${root.driveId}:${root.id}`;
      if (cacheRoot !== rootKey) { reportCache.clear(); cacheRoot = rootKey; }
      const files = await zipFiles(root);
      const newestByLogicalName = new Map();
      for (const file of files) {
        const key = `${logicalBase(file.name)}::${file.id}`;
        const current = newestByLogicalName.get(key);
        if (!current || String(file.lastModifiedDateTime || "") > String(current.lastModifiedDateTime || "")) newestByLogicalName.set(key, file);
      }
      const reports = [], nextPdfs = new Map(), nextCache = new Map();
      for (const file of newestByLogicalName.values()) {
        failedFile = cleanName(file.name);
        const version = JSON.stringify([file.name, file.eTag, file.cTag, file.lastModifiedDateTime, file.size]);
        const cached = reportCache.get(file.id);
        const reusable = Boolean(file.eTag || file.cTag || file.lastModifiedDateTime) && cached?.version === version;
        const report = reusable ? clone(cached.report) : await reportFromZip(root, file, nextPdfs);
        if (reusable && cached.pdf) nextPdfs.set(report.id, cached.pdf);
        if (report) {
          reports.push(report);
          nextCache.set(file.id, {version, report: clone(report), pdf: nextPdfs.get(report.id)});
        }
      }
      failedFile = "";
      // Den bisherigen Stand erst nach einem vollständig erfolgreichen Abruf ersetzen.
      // Quelle bleiben ausschließlich die aktuell in OneDrive vorhandenen ZIP-Pakete.
      if(epoch!==loadEpoch||!oneDriveSignedIn())return false;
      csvArchive = reports.sort((a, b) => historyDateFromItem(b).localeCompare(historyDateFromItem(a)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      reportCache = nextCache;
      pdfByReportId.clear();
      nextPdfs.forEach((pdf, id) => pdfByReportId.set(id, pdf));
      renderHistory?.();
      renderStatistics?.();
      window.oneDriveHistoryLastError = "";
      historyStatus("");
      window.Usability?.historyStatus("",new Date().toISOString());
      if (manual) showToast(`Historie aus ${files.length} OneDrive-ZIP-Datei${files.length === 1 ? "" : "en"} geladen.`);
      return true;
    } catch (error) {
      if(epoch!==loadEpoch)return false;
      console.error("OneDrive-Historie konnte nicht geladen werden", error);
      const hint = error.status === 401 || /Anmeldung|angemeldet/i.test(error.message || "")
        ? "Bitte OneDrive erneut anmelden."
        : error.status === 403 ? "Bitte die Zugriffsrechte auf den gemeinsamen OneDrive-Ordner prüfen."
        : error.status === 429 ? "OneDrive begrenzt momentan die Abrufe. Bitte etwas später erneut synchronisieren."
        : error.status === 404 ? "Eine Datei oder ein Ordner wurde verschoben oder gelöscht. Bitte erneut synchronisieren."
        : error.code === "invalidReportPackage" ? "Dieses ZIP-Paket ist nicht lesbar. Bitte die Datei in OneDrive prüfen oder neu exportieren."
        : "Bitte Internetverbindung prüfen und erneut synchronisieren.";
      const detail = `${failedFile ? " Datei: " + failedFile + "." : ""}${error.status ? " OneDrive-Fehler " + error.status + "." : ""}`;
      const message = `Historie konnte nicht aktualisiert werden.${detail} Historie und Statistik zeigen den zuletzt geladenen Stand. ${hint}`;
      window.oneDriveHistoryLastError = message;
      historyStatus(message);
      if (manual) showToast(message, "error");
      return false;
    } finally {
      document.documentElement.classList.remove("onedrive-history-loading");
    }
  }

  window.loadOneDriveHistory = loadOneDriveHistory;
  window.loadOneDriveHistoryPdf = async item => pdfByReportId.get(item?.id) || null;
})();
