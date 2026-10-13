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
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);const blob=await c.OperationDocx.create({...sample,assignments:{'Person, Test':'Reserve Gerätehaus'},reserveTimes:{'Person, Test':{from:'2026-10-11T23:00',to:'2026-10-12T01:30'}}});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');assert.ok(xml.includes('11.10.2026 23:00 bis 12.10.2026 01:30 (2 Std. 30 Min.)'));
});

test('Gerätehausbesetzung steht im Wordbericht ohne Fahrzeugkreuze',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const blob=await c.OperationDocx.create({...sample,stationOnly:true,reportVehicles:[],assignments:{'Person, Test':'Reserve Gerätehaus'},assignmentRoles:{'Person, Test':'Gerätehausbesetzung'}});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');
 assert.ok(xml.includes('Gerätehausbesetzung'));const vehicles=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g).find(t=>t.includes('Eingesetzte Fahrzeuge'));assert.equal((vehicles.match(/<w:t>X<\/w:t>/g)||[]).length,0);
});

test('Wordprotokoll übernimmt Einsatzzeit bei leeren Personzeiten und die Stromausfall-Option',async()=>{
 const c=vm.createContext({window:{},JSZip,Blob,Uint8Array,atob,console});vm.runInContext(source('operation-docx-template.js'),c);c.OPERATION_DOCX_TEMPLATE_BASE64=c.window.OPERATION_DOCX_TEMPLATE_BASE64;vm.runInContext(source('operation-docx.js'),c);
 const blob=await c.OperationDocx.create({...sample,stationOnly:true,powerOutage:true,type:'Gerätehausbesetzung',times:{alarm:'23:00',ended:'01:30'},assignments:{'Person, Test':'Reserve Gerätehaus'},reserveTimes:{}});const zip=await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');assert.ok(xml.includes('Gerätehausbesetzung · Stromausfall'));assert.ok(xml.includes('08.10.2026 23:00 bis 09.10.2026 01:30 (2 Std. 30 Min.)'));
});
