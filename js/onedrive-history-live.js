"use strict";
(() => {
  let busy = false;
  const pdfByReportId = new Map();
  const clone = value => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const cleanName = name => String(name || "").split("/").pop();
  const baseName = name => cleanName(name).replace(/\.zip$/i, "");
  const logicalBase = name => baseName(name)
    .replace(/_korrigiert-v\d+$/i, "")
    .replace(/_korrigiert$/i, "")
    .toLocaleLowerCase("de-DE");

  async function children(root, itemId) {
    const result = [];
    let url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,file,folder,lastModifiedDateTime,size`;
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

  async function reportFromZip(root, file) {
    const zip = await JSZip.loadAsync(await itemBlob(root, file));
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
    const isOperation = headerIndex("Einsatzart")>=0 || headerIndex("Alarmzeit")>=0;
    const rows = isOperation ? [] : CsvEngine.parse(content);
    const first = rows[0] || {};
    const valueFor = name => { const index=headerIndex(name); return index>=0 ? String(values[index]||"").trim() : ""; };
    const reportDate = (isOperation ? valueFor("Datum") : first.date) || String(info.createdAt || file.lastModifiedDateTime || "").slice(0, 10);
    const detectedOperationData = isOperation ? {
      date: reportDate,
      type: valueFor("Einsatzart") || "Einsatz",
      location: valueFor("Einsatzstelle"),
      number: valueFor("Einsatznummer"),
      times: { alarm: valueFor("Alarmzeit") }
    } : undefined;
    const id = `onedrive-zip:${file.id}`;
    const pdfEntry = (info.pdfName && zip.file(info.pdfName)) || Object.values(zip.files).find(entry => !entry.dir && /\.pdf$/i.test(entry.name));
    if (pdfEntry) pdfByReportId.set(id, await pdfEntry.async("blob"));
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
  }

  async function loadOneDriveHistory({ manual = false } = {}) {
    if (busy) return;
    if (!oneDriveSignedIn()) {
      csvArchive = [];
      renderHistory?.();
      if (manual) showToast("Bitte zuerst OneDrive verbinden.", "error");
      return;
    }
    busy = true;
    pdfByReportId.clear();
    document.documentElement.classList.add("onedrive-history-loading");
    try {
      const root = await oneDriveResolveSharedRoot();
      const files = await zipFiles(root);
      const newestByLogicalName = new Map();
      for (const file of files) {
        const key = `${logicalBase(file.name)}::${file.id}`;
        const current = newestByLogicalName.get(key);
        if (!current || String(file.lastModifiedDateTime || "") > String(current.lastModifiedDateTime || "")) newestByLogicalName.set(key, file);
      }
      const reports = [];
      for (const file of newestByLogicalName.values()) {
        try {
          const report = await reportFromZip(root, file);
          if (report) reports.push(report);
        } catch (error) {
          console.error("ZIP-Terminpaket konnte nicht gelesen werden", file.name, error);
        }
      }
      // Ausschließlich die aktuell in OneDrive vorhandenen ZIP-Pakete anzeigen.
      // Lokale Archiveinträge und die csvArchive-Kopie aus feuerwehr-wasser-daten.json werden bewusst ignoriert.
      csvArchive = reports.sort((a, b) => historyDateFromItem(b).localeCompare(historyDateFromItem(a)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      renderHistory?.();
      renderStatistics?.();
      if (manual) showToast(`Historie aus ${files.length} OneDrive-ZIP-Datei${files.length === 1 ? "" : "en"} geladen.`);
    } catch (error) {
      console.error("OneDrive-Historie konnte nicht geladen werden", error);
      csvArchive = [];
      renderHistory?.();
      showToast("Historie konnte nicht aus den OneDrive-ZIP-Dateien geladen werden.", "error");
    } finally {
      busy = false;
      document.documentElement.classList.remove("onedrive-history-loading");
    }
  }

  window.loadOneDriveHistory = loadOneDriveHistory;
  window.loadOneDriveHistoryPdf = async item => pdfByReportId.get(item?.id) || null;
})();
