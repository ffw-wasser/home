const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Dokumentfotos nur bei Ausschusssitzung, ohne Sperre für Probe oder Einsatz',async()=>{
 const panel={hidden:false,style:{},setAttribute(){}};
 const c=vm.createContext({byId:()=>panel,sessionType:'Allgemeine Probe',homeFlowStage:3});
 vm.runInContext(fs.readFileSync('js/features/reports/document-report.js','utf8'),c);
 for(const type of ['Allgemeine Probe','Sonderprobe','Unterricht','Einsatz']){
  c.sessionType=type;assert.equal(c.documentReportRequired(),false,type);c.syncDocumentReportVisibility(3);assert.equal(panel.hidden,true,type);assert.equal(await c.prepareDocumentReportBeforeClose(),true,type);
 }
 c.sessionType='Ausschuss Sitzung';assert.equal(c.documentReportRequired(),true);c.syncDocumentReportVisibility(3);assert.equal(panel.hidden,false);assert.equal(c.documentReportKind(),'Sitzungsbericht');
});
