const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const report=fs.readFileSync('js/features/reports/zip-terminpakete.js','utf8'),controller=fs.readFileSync('js/features/attendance/attendance-controller.js','utf8');
function fixture({type='Unterricht',audience=null,rows,statuses=['Anwesend','Fehlt','Entschuldigt'],legacy=false}={}){
 const members=[{id:'a',committeeMember:true},{id:'b'},{id:'c',ageDepartment:true,committeeMember:true}],nodes={},uploads=[],counts=[];
 let session=legacy?'':'session-2026-10-28-a',saved=0;
 const entries=rows||members.map((m,i)=>({id:'entry-'+m.id,date:'2026-10-28',time:'19:00',storedName:m.id,displayName:m.id,status:statuses[i],sessionType:type,...(legacy?{}:{sessionId:session})}));
 const c=vm.createContext({window:{PortalAdmin:{attendanceAudience:()=>audience}},members,entries,sessionType:type,currentClosingTopic:'Test',pendingMemberStatuses:new Map(),todayEntries:()=>entries,byId:id=>nodes[id]??=( {} ),escapeHtml:x=>String(x||''),nameForStorage:m=>m.id,nameForTile:m=>m.id,today:()=> '2026-10-28',showToast(){},ensureCurrentSessionId:()=>session,startAttendanceSession:()=>session='session-legacy-stable',saveEntries:()=>saved++,csvCell:x=>String(x??''),probePdfBlob:(rows,type,value)=>{counts.push(value);return {};},buildTerminPackage:async value=>{uploads.push(value);return {zipBlob:{}};},saveTerminPackage:async()=> 'failed'});
 vm.runInContext(report.slice(report.indexOf('let closingDay=false;'),report.indexOf('/* Einsatzabschluss:')),c);
 vm.runInContext(controller.slice(controller.indexOf('function renderEntries()'),controller.indexOf('function renderAdmin()')),c);
 return {c,nodes,uploads,counts,entries,getSession:()=>session,getSaved:()=>saved,setSession:id=>session=id};
}
test('Live-Zähler stimmt mit dem Export für Zielgruppe, explizites Fehlt, Altersabteilung und Ausschuss überein',async()=>{
 const cases=[
  {audience:{recipientIds:['a']},statuses:['Anwesend','Betrifft nicht','Betrifft nicht'],expected:0},
  {expected:1},
  {rows:[{storedName:'a',status:'Anwesend',sessionType:'Unterricht'}],expected:2},
  {type:'Ausschuss Sitzung',expected:0},
  {type:'Ausschuss Sitzung',rows:[{storedName:'a',status:'Anwesend',sessionType:'Ausschuss Sitzung'}],expected:1},
  {audience:{recipientIds:['a','b']},expected:1},
  {audience:{recipientIds:[]},statuses:['Betrifft nicht','Betrifft nicht','Betrifft nicht'],expected:0}
 ];
 for(const value of cases){const f=fixture(value);f.c.renderEntries();await f.c.window.closeDay();assert.equal(f.nodes.missingCount.textContent,value.expected,JSON.stringify(value));assert.equal(f.counts[0].missing,value.expected);}
});
test('Unbekannte Empfängerliste zeigt keine erfundene Fehlzahl und blockiert den Abschluss',async()=>{
 const f=fixture({audience:{pending:true}});f.c.renderEntries();assert.equal(f.nodes.missingCount.textContent,'–');await f.c.window.closeDay();assert.equal(f.uploads.length,0);
});
test('Verschiedene Termine am selben Tag erhalten eigene Namen, wiederholtes Speichern behält den Namen',async()=>{
 const f=fixture();await f.c.window.closeDay();await f.c.window.closeDay();assert.equal(f.uploads[0].baseName,f.uploads[1].baseName);f.setSession('session-2026-10-28-b');await f.c.window.closeDay();assert.notEqual(f.uploads[0].baseName,f.uploads[2].baseName);assert.equal(f.uploads[0].csvName,f.uploads[0].baseName+'.csv');assert.equal(f.uploads[0].pdfName,f.uploads[0].baseName+'.pdf');
 assert.notEqual(f.c.terminPackageBase('2026-10-28','Einsatz','op-a'),f.c.terminPackageBase('2026-10-28','Einsatz','op-b'));
 assert.notEqual(f.c.terminPackageBase('2026-10-28','Einsatz','a/b'),f.c.terminPackageBase('2026-10-28','Einsatz','a~2f~b'));
 assert.throws(()=>f.c.terminPackageBase('2026-10-28','Einsatz',''),/Vorgangskennung/);
});
test('Alter lokaler Termin erhält vor Upload eine gespeicherte Kennung, die auch nach Neustart erhalten bleibt',async()=>{
 const f=fixture({legacy:true});await f.c.window.closeDay();assert.equal(f.getSaved(),1);assert.ok(f.entries.every(e=>e.sessionId===f.getSession()));const resumed=fixture({rows:JSON.parse(JSON.stringify(f.entries))});resumed.setSession(f.getSession());await resumed.c.window.closeDay();assert.equal(resumed.uploads[0].baseName,f.uploads[0].baseName);
});
