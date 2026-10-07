"use strict";
(() => {
  let busy = false;
  const reportPdfBlobs = new Map();
  const normalizeBase = name => String(name || "").split("/").pop().replace(/\.(zip|csv|pdf)$/i, "").toLocaleLowerCase("de-DE");
  const clone = value => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));

  async function listChildren(root, itemId) {
    const found = [];
    let url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,file,folder,lastModifiedDateTime,size`;
    while (url) {
      const response = await odFetch(url);
      const data = await response.json();
      found.push(...(data.value || []));
      url = data["@odata.nextLink"] || "";
    }
    return found;
  }

  async function listReportFiles(root, itemId = root.id, depth = 0) {
    if (depth > 4) return [];
    const result = [];
    for (const item of await listChildren(root, itemId)) {
      if (item.folder) result.push(...await listReportFiles(root, item.id, depth + 1));
      else if (item.file && /\.(zip|csv|pdf)$/i.test(item.name)) result.push(item);
    }
    return result;
  }

  async function itemBlob(root, item) {
    return (await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(item.id)}/content`)).blob();
  }

  function normalizeArchiveItem(item) {
    const rows = CsvEngine.parse(item.content || "");
    const first = rows[0] || {};
    return {
      ...item,
      sessionType: item.sessionType || first.sessionType || "Probe",
      topic: item.topic || first.topic || "",
      oneDriveLive: true,
      hasImportedPdf: false
    };
  }

  function itemFromCsv(name, content, createdAt, operationData = null) {
    const rows = CsvEngine.parse(content);
    if (!rows.length) return null;
    const first = rows[0];
    const key = `${first.date || createdAt || ""}|${first.sessionType || "Probe"}|${first.topic || ""}|${name}`;
    return {
      id: `onedrive:${key}`,
      fileName: name,
      pdfFileName: name.replace(/\.csv$/i, ".pdf"),
      content,
      sessionType: first.sessionType || (operationData ? "Einsatz" : "Probe"),
      topic: first.topic || (operationData ? [operationData.type, operationData.location].filter(Boolean).join(" · ") : ""),
      createdAt: createdAt || new Date().toISOString(),
      operationData: operationData || undefined,
      oneDriveLive: true,
      hasImportedPdf: false
    };
  }

  async function reportsFromFiles(root) {
    const files = await listReportFiles(root);
    const loosePdfs = new Map();
    const reports = [];
    for (const file of files.filter(item => /\.pdf$/i.test(item.name))) {
      loosePdfs.set(normalizeBase(file.name), file);
    }
    for (const file of files) {
      try {
        if (/\.csv$/i.test(file.name)) {
          const content = await (await itemBlob(root, file)).text();
          const item = itemFromCsv(file.name, content, file.lastModifiedDateTime);
          if (item) {
            const pdf = loosePdfs.get(normalizeBase(file.name));
            if (pdf) reportPdfBlobs.set(item.id, await itemBlob(root, pdf));
            reports.push(item);
          }
        } else if (/\.zip$/i.test(file.name) && typeof JSZip === "function") {
          const zip = await JSZip.loadAsync(await itemBlob(root, file));
          const infoEntry = zip.file("paket-info.json");
          const info = infoEntry ? JSON.parse(await infoEntry.async("string")) : null;
          const csvEntry = (info?.csvName && zip.file(info.csvName)) || Object.values(zip.files).find(entry => !entry.dir && /\.csv$/i.test(entry.name));
          if (!csvEntry) continue;
          const content = await csvEntry.async("string");
          const csvName = (info?.csvName || csvEntry.name).split("/").pop();
          const item = itemFromCsv(csvName, content, info?.createdAt || file.lastModifiedDateTime, info?.operationData || null);
          if (!item) continue;
          item.packageFileName = file.name;
          const pdfEntry = (info?.pdfName && zip.file(info.pdfName)) || Object.values(zip.files).find(entry => !entry.dir && /\.pdf$/i.test(entry.name));
          if (pdfEntry) reportPdfBlobs.set(item.id, await pdfEntry.async("blob"));
          reports.push(item);
        }
      } catch (error) {
        console.error("OneDrive-Berichtsdatei konnte nicht gelesen werden", file.name, error);
      }
    }
    return reports;
  }

  function reportKey(item) {
    const rows = CsvEngine.parse(item.content || "");
    const first = rows[0] || {};
    return [first.date || "", item.sessionType || first.sessionType || "", item.topic || first.topic || "", normalizeBase(item.fileName)].join("|");
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
    reportPdfBlobs.clear();
    document.documentElement.classList.add("onedrive-history-loading");
    try {
      const root = await oneDriveResolveSharedRoot();
      let stateItems = [];
      try {
        const state = await oneDriveReadState();
        stateItems = Array.isArray(state?.csvArchive) ? state.csvArchive.map(item => normalizeArchiveItem(clone(item))) : [];
      } catch (error) {
        console.warn("OneDrive-Datendatei enthält keine lesbare Historie", error);
      }
      const fileItems = await reportsFromFiles(root);
      const merged = new Map();
      for (const item of [...stateItems, ...fileItems]) merged.set(reportKey(item), item);
      csvArchive = [...merged.values()].sort((a, b) => historyDateFromItem(b).localeCompare(historyDateFromItem(a)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      renderHistory?.();
      renderStatistics?.();
      if (manual) showToast(`Historie aus OneDrive geladen: ${csvArchive.length} Bericht${csvArchive.length === 1 ? "" : "e"}.`);
    } catch (error) {
      console.error("OneDrive-Historie konnte nicht geladen werden", error);
      csvArchive = [];
      renderHistory?.();
      showToast("Historie konnte nicht aus OneDrive geladen werden.", "error");
    } finally {
      busy = false;
      document.documentElement.classList.remove("onedrive-history-loading");
    }
  }

  window.loadOneDriveHistory = loadOneDriveHistory;
  window.loadOneDriveHistoryPdf = async item => reportPdfBlobs.get(item?.id) || null;
  document.addEventListener("visibilitychange", () => {
    const view = document.getElementById("settingsHistoryView");
    if (!document.hidden && view && !view.hidden) loadOneDriveHistory();
  });
})();
