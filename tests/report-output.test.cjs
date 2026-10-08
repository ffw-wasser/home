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
