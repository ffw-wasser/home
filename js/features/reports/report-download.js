"use strict";
/* Complete report export. Event dates never fall back to upload timestamps. */
(() => {
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const clearHandlers=new Set();
  const clear=()=>clearHandlers.forEach(handler=>handler());
  globalThis.addEventListener?.('h2o-storage-lock',clear);
  function date(value) {
    const text=String(value||'').trim();
    const iso=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text),de=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
    if(!iso&&!de)return '';
    const year=Number(iso?iso[1]:de[3]),month=Number(iso?iso[2]:de[2]),day=Number(iso?iso[3]:de[1]);
    const check=new Date(Date.UTC(year,month-1,day));
    return year>=1900&&year<=9999&&check.getUTCFullYear()===year&&check.getUTCMonth()===month-1&&check.getUTCDate()===day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';
  }
  function csvRows(text) {
    const rows=[];let row=[],cell='',quoted=false;
    const input=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(ch==='"'&&quoted&&input[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=!quoted;
      else if(ch===';'&&!quoted){row.push(cell);cell='';}
      else if(/[\r\n]/.test(ch)&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    row.push(cell);if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function eventDate({content='',info={},path=''}) {
    const rows=csvRows(content),column=(rows[0]||[]).findIndex(value=>value.trim().toLowerCase()==='datum');
    const dates=column<0?[]:[...new Set(rows.slice(1).map(row=>date(row[column])).filter(Boolean))];
    if(dates.length>1)throw new Error('Mehrere Termindaten in einem Bericht: '+path);
    const operation=date(info.operationData?.date);
    if(operation&&dates[0]&&operation!==dates[0])throw new Error('Widersprüchliche Termindaten: '+path);
    // These are event fields; createdAt / lastModifiedDateTime are deliberately excluded.
    const namedDate=/^(?:FFW-Wasser_)?(\d{4}-\d{2}-\d{2})(?:[_ .-]|$)/i.exec(String(path).split('/').pop());
    return dates[0]||operation||date(namedDate?.[1])||'';
  }
  function matches(value,year='',month='') {
    if(year&&!/^\d{4}$/.test(year)||month&&!/^(?:0[1-9]|1[0-2])$/.test(month)||month&&!year)throw new Error('Bitte Jahr und Monat gültig auswählen.');
    return !year||Boolean(value&&value.slice(0,4)===year&&(!month||value.slice(5,7)===month));
  }
  function safePath(path) {
    if(typeof path!=='string'||!path||/[\\\u0000-\u001f]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Unsicherer Dateipfad im Bericht.');
    return path;
  }
  // Historic CSV/PDF exports used separate folders. Infer only if the complete
  // basename identifies exactly one event date across the whole report tree.
  const group=path=>path.split('/').pop().replace(/\.(zip|csv|pdf|docx)$/i,'').replace(/_korrigiert(?:-v\d+)?$/i,'');
  async function inventory(storage,onProgress=()=>{}) {
    const files=await storage.walk('Berichte'),records=[];
    for(const file of files){
      safePath(file.path);
      // Read the enumerated version, including when a correction happens during export.
      const bytes=await storage.readFile(file.path,file.version);
      let info={},content='',zip=null;
      if(/\.zip$/i.test(file.path)){
        zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
        const metadata=zip.file('paket-info.json');if(metadata)info=JSON.parse(await metadata.async('string'));
        const csv=info.csvName?zip.file(info.csvName):Object.values(zip.files).find(entry=>!entry.dir&&/\.csv$/i.test(entry.name));
        if(info.csvName&&!csv)throw new Error('Die CSV im Terminpaket fehlt: '+file.path);
        if(csv)content=await csv.async('string');
        if(info.pdfName&&!zip.file(info.pdfName))throw new Error('Das PDF im Terminpaket fehlt: '+file.path);
      }else if(/\.csv$/i.test(file.path))content=new TextDecoder().decode(bytes);
      records.push({...file,bytes,zip,info,date:eventDate({content,info,path:file.path})});
      onProgress(records.length,files.length);
    }
    const dates=new Map();
    for(const record of records){if(!record.date)continue;const key=group(record.path),values=dates.get(key)||new Set();values.add(record.date);dates.set(key,values);}
    for(const record of records)if(!record.date&&dates.get(group(record.path))?.size===1)record.date=[...dates.get(group(record.path))][0];
    return records;
  }
  async function build(records,{year='',month=''}={},onProgress=()=>{}) {
    matches('',year,month);
    const selected=records.filter(record=>matches(record.date,year,month));
    if(!selected.length)throw new Error('Für diesen Zeitraum sind keine Berichtsdateien vorhanden.');
    const zip=new JSZip(),rows=[['Termindatum','Originalpfad','Dateiversion','PDF / CSV im Download','Hinweis']];
    for(const record of selected){
      const path=safePath(record.path);zip.file('Originale/'+path,record.bytes);
      const extracted=[];
      if(record.zip){
        for(const entry of Object.values(record.zip.files)){
          if(entry.dir||!/\.(pdf|csv)$/i.test(entry.name))continue;
          // JSZip exposes unsafeOriginalName after sanitizing traversal; reject it explicitly.
          const inner=safePath(entry.unsafeOriginalName||entry.name),kind=/\.pdf$/i.test(inner)?'PDF':'CSV';
          const destination=kind+'/'+path+'/'+inner;
          zip.file(destination,await entry.async('uint8array'));extracted.push(destination);
        }
      }
      rows.push([record.date,path,String(record.version),extracted.join(' | '),record.date?'':'Termindatum unbekannt; nur im Gesamtexport enthalten']);
    }
    // Quoting prevents delimiters/newlines changing the manifest; neutralize spreadsheet formulas.
    const cell=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    zip.file('Berichtsverzeichnis.csv','\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},value=>onProgress(Math.round(value.percent)));
    return {blob,fileName:exportName({year,month}),count:selected.length};
  }
  const exportName=({year='',month=''}={})=>'H2O-Berichte-'+(year?year+(month?'-'+month:''):'Komplett')+'.zip';
  function mount(container) {
    if(!container||document.getElementById('reportZipDownload'))return;
    const panel=document.createElement('section');panel.id='reportZipDownload';panel.className='storage-card';
    panel.innerHTML='<h3>Berichte als ZIP herunterladen</h3><p>Proben und Einsätze mit vollständigen Originaldateien und Anlagen. PDF und CSV aus Terminpaketen liegen zusätzlich einzeln bei.</p><div class="storage-card-actions"><label>Jahr <select id="reportZipYear" aria-label="Jahr für ZIP-Download"><option value="">Alle Jahre</option></select></label><label>Monat <select id="reportZipMonth" aria-label="Monat für ZIP-Download" disabled><option value="">Ganzes Jahr</option></select></label><button type="button" class="outline-button" id="reportZipRefresh">Berichte laden</button><button type="button" class="primary-button" id="reportZipSave" disabled>ZIP herunterladen</button><button type="button" class="primary-button" id="reportZipSaveAs" hidden disabled>ZIP speichern unter …</button></div><p id="reportZipSaveHelp">Für ein manuelles Backup außerhalb von Cloudflare beim Speichern den synchronisierten OneDrive-Ordner „Webseite“ wählen. Ohne Ordnerauswahl im Browser die heruntergeladene ZIP dorthin verschieben.</p><p>Der Zeitraum richtet sich nach dem Termin, auch bei späteren Korrekturen. Berichte ohne erkennbares Termindatum sind im Gesamtexport enthalten.</p><p role="status" aria-live="polite" id="reportZipStatus">Berichte vor der Auswahl laden.</p>';
    container.append(panel);
    const year=panel.querySelector('#reportZipYear'),month=panel.querySelector('#reportZipMonth'),refresh=panel.querySelector('#reportZipRefresh'),save=panel.querySelector('#reportZipSave'),status=panel.querySelector('#reportZipStatus'),saveAs=panel.querySelector('#reportZipSaveAs');
    saveAs.hidden=typeof globalThis.showSaveFilePicker!=='function';
    months.forEach((name,index)=>month.add(new Option(name,String(index+1).padStart(2,'0'))));
    let records=null,busy=false,epoch=0,source='';
    const identity=()=>CloudStorage.sourceHash+':'+CloudStorage.deviceId;
    const assertSession=expected=>{if(expected!==epoch||!globalThis.CloudStorage?.connected||source!==identity()||typeof checkAdminSession==='function'&&!checkAdminSession())throw new Error('Der Gerätezugang wurde beendet oder geändert. Berichte bitte erneut laden.');};
    const update=()=>{month.disabled=busy||!year.value;if(!year.value)month.value='';const selected=(records||[]).filter(record=>matches(record.date,year.value,month.value));save.disabled=busy||!selected.length;saveAs.disabled=save.disabled;};
    const lock=value=>{busy=value;year.disabled=value;refresh.disabled=value;update();panel.setAttribute('aria-busy',String(value));};
    clearHandlers.add(()=>{epoch++;records=null;source='';year.replaceChildren(new Option('Alle Jahre',''));month.value='';lock(false);status.textContent='Berichte vor der Auswahl erneut laden.';});
    year.addEventListener('change',update);month.addEventListener('change',update);
    refresh.addEventListener('click',async()=>{
      if(busy)return;lock(true);records=null;const requestEpoch=++epoch;
      try{
        if(!globalThis.CloudStorage?.connected)throw new Error('Bitte zuerst dieses Verwaltungsgerät mit Cloudflare verbinden.');
        source=identity();const loaded=await inventory(CloudStorage,(done,total)=>{assertSession(requestEpoch);status.textContent=`Berichte werden geladen: ${done} / ${total}`;});assertSession(requestEpoch);records=loaded;
        const previous=year.value;year.replaceChildren(new Option('Alle Jahre',''));[...new Set(records.map(record=>record.date.slice(0,4)).filter(Boolean))].sort().reverse().forEach(value=>year.add(new Option(value,value)));if([...year.options].some(option=>option.value===previous))year.value=previous;
        const unknown=records.filter(record=>!record.date).length;
        status.textContent=`${records.length} Berichtsdateien geladen.`+(unknown?` ${unknown} ohne Termindatum: im Gesamtexport enthalten.`:'');
      }catch(error){if(requestEpoch===epoch){records=null;status.textContent=error.message||'Berichte konnten nicht geladen werden.';}}finally{if(requestEpoch===epoch)lock(false);}
    });
    async function saveArchive(chooseTarget){
      if(busy||!records)return;const selection={year:year.value,month:month.value},requestEpoch=epoch;lock(true);let writable;
      try{
        // The picker must run inside the click's user activation, before ZIP work.
        assertSession(requestEpoch);const handle=chooseTarget?await globalThis.showSaveFilePicker({suggestedName:exportName(selection),types:[{description:'ZIP-Berichtssicherung',accept:{'application/zip':['.zip']}}]}):null;assertSession(requestEpoch);
        const result=await build(records,selection,percent=>{assertSession(requestEpoch);status.textContent=`ZIP wird erstellt: ${percent} %`;});assertSession(requestEpoch);
        if(handle){
          writable=await handle.createWritable();assertSession(requestEpoch);await writable.write(result.blob);assertSession(requestEpoch);await writable.close();writable=null;
          if(requestEpoch===epoch)status.textContent=`${result.count} Berichtsdateien: ${result.fileName} · Im gewählten Ordner gespeichert.`;
        }else{downloadBlob(result.fileName,result.blob);status.textContent=`${result.count} Berichtsdateien: ${result.fileName} · Download gestartet.`;}
      }catch(error){if(writable)await writable.abort().catch(()=>{});if(requestEpoch===epoch)status.textContent=error.name==='AbortError'?'Speichern abgebrochen.':error.message||'ZIP konnte nicht gespeichert werden.';}finally{if(requestEpoch===epoch)lock(false);}
    }
    save.addEventListener('click',()=>saveArchive(false));saveAs.addEventListener('click',()=>saveArchive(true));
  }
  globalThis.ReportDownload={date,eventDate,matches,inventory,build,mount,clear};
})();
