const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const JSZip=require('../js/vendor/jszip.min.js');
const PDFLib=require('../js/vendor/pdf-lib.min.js');
const source=name=>fs.readFileSync(path.join(__dirname,'../js/features/reports',name),'utf8');
const sample={date:'2026-10-08',type:'Testbericht',location:'Testort',leader:'Testleitung',members:['Person, Test'],
  assignments:{'Person, Test':'EM 5/42 LF10'},assignmentRoles:{'Person, Test':'GF'},
  times:{alarm:'12:00'},agencies:[],alarmMethods:[],waterSources:[],reportVehicles:['EM 5/42 LF10']};

test('Wordbericht verwendet die eingebettete Vorlage und ersetzt alle Platzhalter',async()=>{
  const context=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});
  vm.runInContext(source('operation-docx-template.js'),context);
  context.OPERATION_DOCX_TEMPLATE_BASE64=context.window.OPERATION_DOCX_TEMPLATE_BASE64;
  vm.runInContext(source('operation-docx.js'),context);
  const blob=await context.OperationDocx.create(sample);
  const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml=await zip.file('word/document.xml').async('string');
  assert.ok(!xml.includes('{{'));
  assert.ok(xml.includes('Testbericht'));
  assert.ok(xml.includes('Test Person'));
});

test('Lokaler PDF-Hintergrundprozess erzeugt einen lesbaren zweiseitigen Einsatzbericht',async()=>{
  const root={Blob,Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,atob,btoa,TextEncoder,TextDecoder,
    setTimeout,clearTimeout,console,Date};
  root.self=root;
  const context=vm.createContext(root);
  vm.runInContext(source('operation-pdf-worker-source.js'),context);
  vm.runInContext(context.OPERATION_PDF_WORKER_SOURCE,context);
  let result;
  context.postMessage=value=>{result=value;};
  await context.onmessage({data:{operationData:sample}});
  assert.equal(result.ok,true,result.message);
  const pdf=await PDFLib.PDFDocument.load(new Uint8Array(result.buffer));
  assert.equal(pdf.getPageCount(),2);
});

test('Protokoll zeigt nur eigene Fahrzeuge mit Überschrift und Behörden nur als Kreuze',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const blob=await c.OperationDocx.create({...sample,reportVehicles:[],agencies:['Netze BW','THW']});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');const text=xml.replace(/<[^>]+>/g,'');
 assert.ok(text.includes('Eingesetzte Fahrzeuge'));assert.ok(text.includes('EM 5/42 LF10'));assert.ok(text.includes('EM 5/47 TSF'));assert.ok(!text.includes('KDOW'));assert.ok(!text.includes('HLF 20'));assert.ok(!text.includes('Netze BW, THW'));
 const tables=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g);const vehicles=tables.find(t=>t.includes('Eingesetzte Fahrzeuge'));assert.equal((vehicles.match(/<w:t>X<\/w:t>/g)||[]).length,1);
 assert.ok(!xml.includes('{{'));assert.equal((text.match(/Netze BW/g)||[]).length,1);
});
test('Wordprotokoll übernimmt individuelle Gerätehaus-Zeiten und Dauer',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);const blob=await c.OperationDocx.create({...sample,assignments:{'Person, Test':'Reserve Gerätehaus'},reserveTimes:{'Person, Test':{from:'2026-10-11T23:00',to:'2026-10-12T01:30'}}});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');assert.ok(xml.includes('11.10. 23:00 - 12.10. 01:30 · 2:30 h'));
});

test('Gerätehausbesetzung steht im Wordbericht ohne Fahrzeugkreuze',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const blob=await c.OperationDocx.create({...sample,stationOnly:true,reportVehicles:[],assignments:{'Person, Test':'Reserve Gerätehaus'},assignmentRoles:{'Person, Test':'Gerätehausbesetzung'}});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');
 assert.ok(xml.includes('Gerätehausbesetzung'));const vehicles=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g).find(t=>t.includes('Eingesetzte Fahrzeuge'));assert.equal((vehicles.match(/<w:t>X<\/w:t>/g)||[]).length,0);
});

test('Wordprotokoll zeigt bei leeren Personzeiten keine Mannschaftszeiten, Stromausfall bleibt enthalten',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const blob=await c.OperationDocx.create({...sample,stationOnly:true,powerOutage:true,type:'Gerätehausbesetzung',times:{alarm:'22:00',arrived:'23:00',ended:'01:30'},assignments:{'Person, Test':'Reserve Gerätehaus'},reserveTimes:{}});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');assert.ok(xml.includes('Gerätehausbesetzung · Stromausfall'));assert.ok(!xml.includes('08.10.2026 23:00 bis'));assert.ok(!xml.includes('Individuell:'));
});

test('Mannschaft nutzt zwei Personenspalten; individuelle Zeitangaben bleiben bei der Person',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const people=['Beispiel-Langname, Annemarie','Muster, Bernd','Beispiel, Carla'];
 const blob=await c.OperationDocx.create({...sample,stationOnly:true,members:people,times:{alarm:'09:00',arrived:'10:00',ended:'12:00'},assignments:Object.fromEntries(people.map(n=>[n,'Reserve Gerätehaus'])),assignmentRoles:{},reserveTimes:{[people[1]]:{from:'2026-10-08T11:00',to:''}}});
 const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');
 const table=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g).find(t=>t.includes('Gerätehausbesetzung'));
 assert.equal((table.match(/<w:tr>/g)||[]).length,3);assert.equal((table.match(/11:00 - 12:00/g)||[]).length,1);assert.ok(table.includes('11:00 - 12:00 · 1:00 h'));assert.ok(table.match(/<w:tc>[\s\S]*?<\/w:tc>/g).some(cell=>cell.includes('Bernd Muster')&&cell.includes('11:00 - 12:00')));
 assert.ok(table.includes('<w:cantSplit/>'));assert.ok(table.includes('<w:tblHeader/>'));assert.ok(!table.includes('Annemarie Beispiel-Langname, Bernd'));
});

test('Alarmierungswege aus den Schnellwahlen und Freitext werden vollständig ausgegeben',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 for(const [methods,marks] of [[['Digitalmelder','Sirene','Telefon'],2],[['Melder','Funk','mündlich','selbst'],4],[['Sirene','Leitstelle & Rückruf'],0],[[],0]]){
  const blob=await c.OperationDocx.create({...sample,alarmMethods:methods});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');const table=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g).find(t=>t.replace(/<[^>]+>/g,'').includes('Alarmierung:'));assert.ok(table);
  for(const method of methods)assert.ok(table.includes(method.replaceAll('&','&amp;')));
  assert.equal((table.match(/<w:t>X<\/w:t>/g)||[]).length,marks);
  assert.equal(table.includes('Alarmierungswege:'),methods.length>0);assert.ok(!xml.includes('{{'));assert.ok(table.includes('12:00'));
 }
});

test('Freitext aus Einsatzmitteln und Atemschutzüberwachung geht im Bericht nicht verloren',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const data={...sample,pipes:{description:'8 B, 6 C'},waterSources:['Hydrant beim Gerätehaus','kein offenes Gewässer'],oil:{description:'2 Sack Ölbindemittel'},atueUsed:true,atuePerson:'Test Person'};
 const blob=await c.OperationDocx.create(data);const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');
 for(const value of ['8 B, 6 C','Hydrant beim Gerätehaus, kein offenes Gewässer','2 Sack Ölbindemittel','Atemschutzüberwachung: durch Test Person'])assert.ok(xml.includes(value));
 const department=await c.OperationDocx.create({...data,atueDepartment:true});const z=await JSZip.loadAsync(new Uint8Array(await department.arrayBuffer()));const x=await z.file('word/document.xml').async('string');assert.ok(x.includes('Atemschutzüberwachung: durch Abteilung Emmendingen'));assert.ok(!x.includes('Atemschutzüberwachung: durch Test Person'));
});

async function reportXml(d){const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);return (await JSZip.loadAsync(new Uint8Array(await(await c.OperationDocx.create(d)).arrayBuffer()))).file('word/document.xml').async('string');}
test('Fahrzeuggruppen, beide Reserven und weitere Zuordnungen bleiben vollständig im kompakten Block',async()=>{
 const members=Array.from({length:40},(_,i)=>`Test${i}, Name${i}`),groups=['EM 5/42 LF10','EM 5/47 TSF','Reserve Einsatzstelle','Reserve Gerätehaus','Weitere Einheit'];
 const xml=await reportXml({...sample,members,assignments:Object.fromEntries(members.map((n,i)=>[n,groups[i%5]])),assignmentRoles:Object.fromEntries(members.map(n=>[n,'Testfunktion']))});
 for(const name of members){const [last,first]=name.split(', ');assert.equal((xml.match(new RegExp(first+' '+last+' \\(' ,'g'))||[]).length,1,name);}
 for(const label of ['EM 5/42 LF10 · 8','EM 5/47 TSF · 8','Reserve an Einsatzstelle · 8','Reserve im GH · 8','Weitere Einheit · 8'])assert.ok(xml.includes(label),label);
 assert.ok(xml.includes('Gesamt: 40'));const crew=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g).find(t=>t.includes('EM 5/42 LF10 ·'));assert.equal((crew.match(/<w:gridCol /g)||[]).length,3);
});
test('Gleiche persönliche Gruppenzeiten erscheinen einmal, abweichende Zeiten weiterhin bei der Person',async()=>{
 const members=['Test, Anna','Test, Bernd'],d={...sample,members,times:{arrived:'10:00',ended:'14:00'},assignments:Object.fromEntries(members.map(n=>[n,'Reserve Gerätehaus'])),assignmentRoles:{},reserveTimes:Object.fromEntries(members.map(n=>[n,{from:'2026-10-08T11:00',to:'2026-10-08T13:00'}]))};
 let xml=await reportXml(d);assert.equal((xml.match(/Zeiten dieser Gruppe:/g)||[]).length,1);assert.equal((xml.match(/11:00 - 13:00/g)||[]).length,1);
 d.reserveTimes[members[1]].to='2026-10-08T12:00';xml=await reportXml(d);assert.ok(!xml.includes('Zeiten dieser Gruppe:'));for(const [person,time] of [['Anna Test','11:00 - 13:00'],['Bernd Test','11:00 - 12:00']])assert.ok(xml.match(/<w:tc>[\s\S]*?<\/w:tc>/g).some(cell=>cell.includes(person)&&cell.includes(time)));
 d.reserveTimes=Object.fromEntries(members.map(n=>[n,{from:'2026-10-08T10:00',to:'2026-10-08T14:00'}]));xml=await reportXml(d);assert.ok(!xml.includes('10:00 - 14:00'));assert.ok(!xml.includes('Zeiten dieser Gruppe:'));
});
test('Kompakte persönliche Zeiten erhalten den Tageswechsel einschließlich Jahreswechsel',async()=>{
 const xml=await reportXml({...sample,date:'2026-12-31',times:{arrived:'22:00',ended:'02:00'},assignments:{'Person, Test':'Reserve Gerätehaus'},reserveTimes:{'Person, Test':{from:'2026-12-31T23:00',to:'2027-01-01T01:30'}}});assert.ok(xml.includes('23:00 - 01:30 (+1 Tag) · 2:30 h'));
});
async function pdfPages(count){const d=await PDFLib.PDFDocument.create();for(let i=0;i<count;i++)d.addPage();return new Blob([await d.save()],{type:'application/pdf'});}
function limitedReport(outputs){const calls=[];const c=vm.createContext({window:{OperationDocx:{create:async(d,options)=>options}},PDFLib,Blob,oneDriveConvertDocxToPdf:async(options,name)=>{calls.push({options,name});return outputs[options.compactCrew?1:0];}});const s=fs.readFileSync(path.join(__dirname,'../js/features/operations/operations.js'),'utf8');vm.runInContext(s.slice(s.indexOf('async function operationDocxBlob'),s.indexOf('async function showOperationPdfPreview')),c);return {c,calls};}
test('Die Seitenprüfung gibt zwei Seiten unverändert aus und versucht bei Überlauf nur einen kompakteren Mannschaftsblock',async()=>{
 const good=await pdfPages(2),large=await pdfPages(3);let f=limitedReport([good,good]);assert.equal(await f.c.operationPdfBlob(sample),good);assert.equal(f.calls.length,1);
 f=limitedReport([large,good]);assert.equal(await f.c.operationPdfBlob(sample),good);assert.equal(f.calls.length,2);assert.equal(f.calls[0].options.compactCrew,false);assert.equal(f.calls[1].options.compactCrew,true);
});
test('Mehr als zwei Protokollseiten werden mit einem klaren Hinweis gestoppt, ohne Inhalt abzuschneiden',async()=>{
 const large=await pdfPages(3),f=limitedReport([large,large]);await assert.rejects(f.c.operationPdfBlob(sample),/maximal zwei Seiten.*keine Angaben abgeschnitten/);assert.equal(f.calls.length,2);
});
