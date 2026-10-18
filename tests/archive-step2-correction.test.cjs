const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/features/history/archive.js','utf8');
const start=source.indexOf('function archiveCorrectionWorkspace()');
const end=source.indexOf('function pairedArchiveFileNames(',start);
assert.ok(start>=0&&end>start,'Korrekturablauf muss im Archivmodul enthalten sein');

function fixture(type='Sonderprobe'){
  const rows=[
    {date:'2026-10-15',time:'19:00',name:'Mustermann Erika',sessionType:type,status:'Anwesend',role:type==='Allgemeine Probe'?'Maschinist':'Anwesend',topic:'Funkübung'},
    {date:'2026-10-15',time:'',name:'Muster Max',sessionType:type,status:'Fehlt',role:'',topic:'Funkübung'}
  ];
  const item={id:'original-archive-id',fileName:'Originalbericht.csv',pdfFileName:'Originalbericht.pdf',packageFileName:'Originalbericht.zip',sessionType:type,topic:'Funkübung',content:'fake-csv',oneDriveLive:true};
  const nodes=new Map(),calls=[],get=id=>{
    if(!nodes.has(id)){const flags=new Set();nodes.set(id,{value:'',textContent:'',children:[],disabled:false,replaceChildren(){this.children=[];},scrollIntoView(){},remove(){},classList:{add(x){flags.add(x);calls.push(['add-class',x]);},remove(x){flags.delete(x);calls.push(['remove-class',x]);},contains(x){return flags.has(x);}}});}
    return nodes.get(id);
  };
  const captured=[];
  const c=vm.createContext({
    archiveCorrectionState:null,csvArchive:[item],currentSessionId:'',currentOperationId:'',entries:[],pendingMemberStatuses:new Map(),chosenMemberIds:new Set(),chosenMemberId:'',currentClosingTopic:'',currentOperationDraft:null,operationAssignments:{},operationAssignmentRoles:{},
    requireAdmin:()=>true,byId:get,structuredClone,Date,JSON,console,
    members:[],nameForStorage:m=>m.name,nameForTile:m=>m.name,
    archiveRowsFromContent:()=>rows,historyDateFromItem:()=>rows[0].date,
    showView:v=>{calls.push(['view',v]);return true;},setHomeFlowStage:n=>calls.push(['stage',n]),
    showToast:(...args)=>calls.push(['toast',...args]),confirm:()=>true,correctionRolesForRow:()=>[],
    persistArchiveCorrection:async(...args)=>captured.push(args),
    document:{createElement:()=>({})}
  });
  vm.runInContext(source.slice(start,end),c);
  c.archiveCorrectionWorkspace=()=>({scrollIntoView(){}});
  c.appendArchiveCorrectionPerson=()=>{};
  c.refreshArchiveCorrectionMembers=()=>{};
  c.filterArchiveCorrectionRows=()=>{};
  return {c,get,calls,captured,item,rows};
}
function editableCard(index,name,status,role=''){
  const values={name:{value:name},status:{value:status},role:{value:role}};
  return {dataset:{row:String(index)},querySelector:selector=>values[selector.match(/data-correction-field="([^"]+)"/)?.[1]]||null};
}

test('Archivkorrektur öffnet unabhängig von laufenden Terminen und erhält sämtliche Erfassungsdaten',()=>{
  for(const type of ['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung']){
    const f=fixture(type);
    f.c.currentSessionId='laufender-termin';
    f.c.currentOperationId='laufender-einsatz';
    f.c.entries=[{sessionId:'laufender-termin',status:'Anwesend'}];
    f.c.pendingMemberStatuses.set('123','Anwesend');
    f.c.chosenMemberIds.add('123');f.c.chosenMemberId='123';
    f.c.currentClosingTopic='Vorbereitetes Thema';
    f.c.currentOperationDraft={situation:'Entwurf'};
    f.c.operationAssignments={'Muster Erika':'LF 10'};
    const snapshot=()=>JSON.stringify([f.c.currentSessionId,f.c.currentOperationId,f.c.entries,[...f.c.pendingMemberStatuses],[...f.c.chosenMemberIds],f.c.chosenMemberId,f.c.currentClosingTopic,f.c.currentOperationDraft,f.c.operationAssignments]);
    const before=snapshot();
    f.c.correctArchiveItem('original-archive-id');
    assert.ok(f.c.archiveCorrectionState,type);
    assert.ok(f.calls.some(call=>call[0]==='view'&&call[1]==='archiveCorrectionView'));
    assert.equal(f.get('archiveCorrectionEditTopic').value,'Funkübung');
    f.c.cancelArchiveCorrectionStep2({saved:true});
    assert.equal(snapshot(),before,'Laufende Erfassung bleibt beim Öffnen und Schließen unverändert');
    assert.equal(f.calls.some(call=>call[0]==='stage'),false);
  }
});
test('Während des Speicherns bleibt die Archivkorrektur geöffnet',()=>{
  const f=fixture();f.c.correctArchiveItem('original-archive-id');
  f.get('archiveCorrectionSave').disabled=true;
  assert.equal(f.c.archiveCorrectionBeforeView('attendanceView'),false);
  f.c.cancelArchiveCorrectionStep2();
  assert.ok(f.c.archiveCorrectionState);
});
test('Schritt 2 speichert mehrere korrigierte Personen samt Thema und Datum unter der Original-ID',async()=>{
  const f=fixture();f.c.correctArchiveItem('original-archive-id');
  f.get('archiveCorrectionEditDate').value='2026-10-16';
  f.get('archiveCorrectionEditTopic').value='Funkübung und Gerätekunde';
  f.get('archiveCorrectionList').children=[
    editableCard(0,'Mustermann Erika','Entschuldigt',''),
    editableCard(1,'Muster Max','Anwesend','Anwesend')
  ];
  f.c.cancelArchiveCorrectionStep2=()=>{};
  await f.c.saveArchiveCorrectionStep2();
  assert.equal(f.captured.length,1);
  const [item,rows,date]=f.captured[0];
  assert.equal(item.id,'original-archive-id');
  assert.equal(item.packageFileName,'Originalbericht.zip');
  assert.equal(item.topic,'Funkübung und Gerätekunde');
  assert.equal(date,'2026-10-16');
  assert.equal(rows[0].status,'Entschuldigt');
  assert.equal(rows[1].status,'Anwesend');
  assert.equal(rows[1].date,'2026-10-16');
  assert.equal(f.item.content,'fake-csv','Original bleibt unverändert bis das Speichern erfolgreich ist');
});
test('Abgebrochene Bestätigung schreibt keine Archivdaten',async()=>{
  const f=fixture();f.c.correctArchiveItem('original-archive-id');
  f.get('archiveCorrectionEditDate').value='2026-10-17';
  f.get('archiveCorrectionEditTopic').value='Funkübung';
  f.get('archiveCorrectionList').children=[editableCard(0,'Mustermann Erika','Anwesend','Anwesend'),editableCard(1,'Muster Max','Fehlt')];
  f.c.confirm=()=>false;
  await f.c.saveArchiveCorrectionStep2();
  assert.equal(f.captured.length,0);
});
test('Gemeinsame Speicherfunktion ersetzt denselben OneDrive-Bericht ohne neue Dateinamen',async()=>{
  const a=source.indexOf('async function persistArchiveCorrection('),b=source.indexOf('async function saveArchiveCorrection()',a);
  assert.ok(a>=0&&b>a);
  const writes=[],rows=[{date:'2026-10-16',time:'19:00',name:'Mustermann Erika',status:'Anwesend',role:'Anwesend',sessionType:'Sonderprobe',topic:'Thema'}];
  const ctx=vm.createContext({
    Date,JSON,console,
    pairedArchiveFileNames:()=>({csv:'Originalbericht.csv',pdf:'Originalbericht.pdf'}),
    archiveCsvFromRows:()=> 'korrigierte-csv',
    probePdfBlob:(...args)=>{writes.push(['pdf',...args]);return {pdf:true};},
    window:{saveOneDriveHistoryCorrection:async(item,pdf)=>writes.push(['onedrive',structuredClone(item),pdf]),loadOneDriveHistory:async()=>writes.push(['reload'])},
    renderArchive(){},renderHistory(){},renderStatistics(){},showToast(){}
  });
  vm.runInContext(source.slice(a,b),ctx);
  await ctx.persistArchiveCorrection({id:'original-archive-id',fileName:'Originalbericht.csv',pdfFileName:'Originalbericht.pdf',packageFileName:'Originalbericht.zip',oneDriveLive:true,sessionType:'Sonderprobe',topic:'Thema'},rows,'2026-10-16');
  const saved=writes.find(x=>x[0]==='onedrive')?.[1];
  assert.ok(saved);
  assert.equal(saved.id,'original-archive-id');
  assert.equal(saved.fileName,'Originalbericht.csv');
  assert.equal(saved.pdfFileName,'Originalbericht.pdf');
  assert.equal(saved.packageFileName,'Originalbericht.zip');
  assert.equal(saved.content,'korrigierte-csv');
  assert.equal(saved.presentCount,1);
  assert.ok(writes.some(x=>x[0]==='reload'));
});

test('Navigation fragt vor dem Verlassen einer ungespeicherten Archivkorrektur',()=>{
  const f=fixture();f.c.correctArchiveItem('original-archive-id');
  f.get('archiveCorrectionList').children=[editableCard(0,'Mustermann Erika','Anwesend','Anwesend'),editableCard(1,'Muster Max','Fehlt')];
  f.get('archiveCorrectionEditTopic').value='Verändertes Probenthema';
  f.c.confirm=()=>false;
  assert.equal(f.c.archiveCorrectionBeforeView('settingsHistoryView'),false);
  assert.ok(f.c.archiveCorrectionState);
  f.c.confirm=()=>true;
  assert.equal(f.c.archiveCorrectionBeforeView('settingsHistoryView'),true);
  assert.equal(f.c.archiveCorrectionState,null);
  assert.equal(f.calls.some(call=>call[0]==='stage'),false);
});
test('Bei unverändertem Bericht ist der Rückweg ohne Warnmeldung möglich',()=>{
  const f=fixture();f.c.correctArchiveItem('original-archive-id');
  f.get('archiveCorrectionList').children=[editableCard(0,'Mustermann Erika','Anwesend','Anwesend'),editableCard(1,'Muster Max','Fehlt')];
  let confirms=0;f.c.confirm=()=>{confirms++;return true;};
  assert.equal(f.c.archiveCorrectionBeforeView('settingsHistoryView'),true);
  assert.equal(confirms,0);
});
