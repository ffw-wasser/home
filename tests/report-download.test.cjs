const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const JSZip=require('../js/vendor/jszip.min.js');
const context=vm.createContext({JSZip,TextDecoder,Date,Blob,console});
vm.runInContext(fs.readFileSync(require.resolve('../js/features/reports/report-download.js'),'utf8'),context);
const model=context.ReportDownload;
test('ZIP-Zeitraum: alle, Jahr und Monat einschließlich Jahreswechsel und Schaltjahr',()=>{
  for(const value of ['2024-02-29','2025-12-31','2026-01-01',''])assert.equal(model.matches(value),true);
  assert.equal(model.matches('2024-02-29','2024','02'),true);
  assert.equal(model.matches('2025-12-31','2026'),false);
  assert.equal(model.matches('2026-01-01','2026','12'),false);
  assert.equal(model.matches('','2026'),false);
  for(const args of [['2026','13'],['','01'],['x','']])assert.throws(()=>model.matches('',...args),/auswählen/);
  assert.equal(model.date('29.2.2024'),'2024-02-29');assert.equal(model.date('2025-02-29'),'');assert.equal(model.date('2026-04-31'),'');
});
test('Korrekturen gehören zum Termin, niemals zum Upload- oder Erstellungsdatum',()=>{
  assert.equal(model.eventDate({content:'Datum;Name\r\n31.12.2025;Beispiel',info:{createdAt:'2026-02-01',correctedAt:'2026-03-01'},path:'Berichte/a.zip'}),'2025-12-31');
  assert.equal(model.eventDate({info:{createdAt:'2026-02-01',lastModifiedDateTime:'2026-03-01'},path:'Berichte/ohne-datum.pdf'}),'');
  assert.equal(model.eventDate({info:{operationData:{date:'2026-01-02'}}}),'2026-01-02');
  assert.equal(model.eventDate({path:'Berichte/2026-02-01_Probe_abcdefg.pdf'}),'2026-02-01');
  assert.equal(model.eventDate({path:'Berichte/PDF/FFW-Wasser_2025-12-31_18-00.pdf'}),'2025-12-31');
  assert.throws(()=>model.eventDate({content:'Datum;Name\n2026-01-01;A\n2026-01-02;B'}),/Mehrere/);
  assert.throws(()=>model.eventDate({content:'Datum;Name\n2026-01-01;A',info:{operationData:{date:'2026-01-02'}}}),/Widersprüchliche/);
});
async function fixture(){
 const packageZip=new JSZip();packageZip.file('bericht.csv','Datum;Name;Thema\r\n2025-12-31;Beispiel;"Funk; Übung"');packageZip.file('bericht.pdf','%PDF-Test');packageZip.file('anlagen/bild.jpg','vollständig');packageZip.file('paket-info.json',JSON.stringify({csvName:'bericht.csv',pdfName:'bericht.pdf',createdAt:'2026-02-01',correctedAt:'2026-03-01'}));
 const entries=[{path:'Berichte/Terminpakete/a.zip',version:2,bytes:await packageZip.generateAsync({type:'uint8array'})},{path:'Berichte/CSV/2026-01-01_Probe.csv',version:1,bytes:Buffer.from('Datum;Name\n2026-01-01;Test')},{path:'Berichte/PDF/unbekannt.pdf',version:3,bytes:Buffer.from('%PDF-Unbekannt')}];
 const reads=[];const storage={walk:async path=>{assert.equal(path,'Berichte');return entries;},readFile:async(path,version)=>{reads.push([path,version]);return entries.find(entry=>entry.path===path&&entry.version===version).bytes;}};
 return {entries,reads,records:await model.inventory(storage)};
}
test('Gesamtexport erhält sämtliche Originale und Anlagen, PDF/CSV zusätzlich einzeln',async()=>{
 const f=await fixture();assert.equal(f.reads.length,3);assert.equal(f.records[0].date,'2025-12-31');
 const result=await model.build(f.records),zip=await JSZip.loadAsync(await result.blob.arrayBuffer());
 assert.equal(result.count,3);assert.equal(result.fileName,'H2O-Berichte-Komplett.zip');
 for(const entry of f.entries)assert.deepEqual(Buffer.from(await zip.file('Originale/'+entry.path).async('uint8array')),Buffer.from(entry.bytes));
 assert.equal(await zip.file('PDF/Berichte/Terminpakete/a.zip/bericht.pdf').async('string'),'%PDF-Test');
 const original=await JSZip.loadAsync(await zip.file('Originale/Berichte/Terminpakete/a.zip').async('uint8array'));assert.equal(await original.file('anlagen/bild.jpg').async('string'),'vollständig');
 assert.match(await zip.file('Berichtsverzeichnis.csv').async('string'),/Termindatum unbekannt/);
});
test('Monats- und Jahresexport enthalten genau die zugehörigen vollständigen Dateien',async()=>{
 const f=await fixture();
 for(const selection of [{year:'2025'},{year:'2025',month:'12'}]){
   const result=await model.build(f.records,selection),zip=await JSZip.loadAsync(await result.blob.arrayBuffer());assert.equal(result.count,1);assert.ok(zip.file('Originale/Berichte/Terminpakete/a.zip'));assert.equal(zip.file('Originale/Berichte/PDF/unbekannt.pdf'),null);
 }
 await assert.rejects(model.build(f.records,{year:'2024'}),/keine Berichtsdateien/);
});
test('Abgebrochener Abruf oder fehlende Paketdatei liefert keinen Teil-Download',async()=>{
 await assert.rejects(model.inventory({walk:async()=>[{path:'Berichte/a.pdf',version:2}],readFile:async()=>{throw new Error('Gerät gesperrt');}}),/gesperrt/);
 const zip=new JSZip();zip.file('paket-info.json',JSON.stringify({csvName:'fehlt.csv'}));const bytes=await zip.generateAsync({type:'uint8array'});
 await assert.rejects(model.inventory({walk:async()=>[{path:'Berichte/a.zip',version:1}],readFile:async()=>bytes}),/CSV.*fehlt/);
});
test('ZIP-Inhalte können keine Pfade außerhalb des Exportverzeichnisses anlegen',async()=>{
 const zip=new JSZip();zip.file('../ausbruch.pdf','bad');const bytes=await zip.generateAsync({type:'uint8array'});
 const records=await model.inventory({walk:async()=>[{path:'Berichte/a.zip',version:1}],readFile:async()=>bytes});
 await assert.rejects(model.build(records),/Unsicherer Dateipfad/);
});
test('Ältere PDF-Dateien in separaten Ordnern erhalten nur eindeutig zugehörige CSV-Daten',async()=>{
 const files=[['Berichte/CSV/Probe.csv','Datum;Name\n2025-12-31;Test'],['Berichte/PDF/Probe.pdf','%PDF-Beispiel'],['Berichte/2024/mehrdeutig.csv','Datum;Name\n2024-01-01;Test'],['Berichte/2025/mehrdeutig.csv','Datum;Name\n2025-01-01;Test'],['Berichte/PDF/mehrdeutig.pdf','%PDF-Beispiel']].map(([path,body])=>({path,version:1,bytes:Buffer.from(body)}));
 const records=await model.inventory({walk:async()=>files,readFile:async path=>files.find(file=>file.path===path).bytes});
 assert.equal(records[1].date,'2025-12-31');assert.equal(records[4].date,'');
});
