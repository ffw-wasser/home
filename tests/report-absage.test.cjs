const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('PDF displays Absage while report model and source keep the legacy status and counts',async()=>{
 const c=vm.createContext({Blob});
 for(const file of ['report-engine.js','probe-pdf.js'])vm.runInContext(fs.readFileSync('js/features/reports/'+file,'utf8'),c);
 const rows=[{time:'19:00',name:'Anna Test',status:'Entschuldigt',role:''},{time:'19:00',name:'Ben Test',status:'Anwesend',role:'GF'}];
 const before=JSON.stringify(rows);
 for(const sessionType of ['Allgemeine Probe','Sonderprobe','Unterricht']){
  const model=c.ReportEngine.model({rows,sessionType,date:'2026-11-15'});
  assert.equal(model.counts.excused,1);assert.equal(model.counts.present,1);assert.equal(model.rows[0].status,'Entschuldigt');
  const blob=c.probePdfBlob(rows,sessionType,undefined,'Test','2026-11-15');
  const pdf=Buffer.from(await blob.arrayBuffer()).toString('latin1');
  assert.match(pdf,/Absagen: 1/);assert.match(pdf,/\(Absage\) Tj/);assert.doesNotMatch(pdf,/Entschuldigt/);
 }
 assert.equal(JSON.stringify(rows),before);
});
