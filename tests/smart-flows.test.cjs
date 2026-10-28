const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(require.resolve('../'+file),'utf8');
function syncApp(){
 const store=new Map(),timers=new Map();let id=0;
 const c=vm.createContext({window:{},members:[],entries:[],csvArchive:[],navigator:{onLine:true},safeStorage:{persistent:true},console:{error(){}},byId:()=>null,showToast(){},localStorage:{getItem:k=>store.get(k)||'',setItem:(k,v)=>store.set(k,v)},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i)});
 vm.runInContext(read('js/core/onedrive-sync.js'),c);
 Object.assign(c,{oneDriveSignedIn:()=>true,oneDriveStatus(){},renderOneDriveDialog(){},oneDriveResolveSharedRoot:async()=>({driveId:'test',id:'root'}),oneDriveReadState:async()=>null,oneDriveWriteState:async()=>{},applyOneDrivePayload(){}});
 return {c,timers};
}
test('Änderungen während eines laufenden Schreibens bleiben lokal gekennzeichnet und werden nachgesendet',async()=>{
 const {c,timers}=syncApp();let release,writes=0,started;const writing=new Promise(r=>started=r);
 c.oneDriveWriteState=async()=>{writes++;if(writes===1)await new Promise(r=>{release=r;started();});};
 c.scheduleCloudSync();const first=c.syncOneDrive();await writing;
 c.scheduleCloudSync();assert.equal(c.getAppStorageState().kind,'local');release();await first;
 assert.equal(c.getAppStorageState().kind,'local');assert.equal(timers.size,1);
 await [...timers.values()][0]();assert.equal(writes,2);assert.equal(c.getAppStorageState().kind,'cloud');
});
test('Neuer lokaler Stand während OneDrive-Lesen wird nicht durch die ältere Antwort überschrieben',async()=>{
 const {c}=syncApp();let release,applied=0,written=0;
 c.oneDriveReadState=()=>new Promise(r=>release=r);c.applyOneDrivePayload=()=>applied++;c.oneDriveWriteState=async()=>written++;
 const first=c.syncOneDrive();c.scheduleCloudSync();release({data:{updatedAt:'2099-01-01'},eTag:'test-tag',url:'https://graph.microsoft.com/test'});await first;
 assert.equal(applied,0);assert.equal(written,1);assert.equal(c.getAppStorageState().kind,'cloud');
});
test('Fehlgeschlagenes OneDrive-Schreiben bestätigt keinen Cloud-Speicherstatus',async()=>{
 const {c}=syncApp();c.scheduleCloudSync();c.oneDriveWriteState=async()=>{throw Error('offline');};await c.syncOneDrive();assert.equal(c.getAppStorageState().kind,'error');assert.match(c.getAppStorageState().text,/Synchronisierung fehlgeschlagen/);
});
test('Ohne dauerhaften Browser-Speicher behauptet der Hinweis keine Gerätesicherung',()=>{
 const {c}=syncApp();c.safeStorage.persistent=false;c.oneDriveSignedIn=()=>false;c.scheduleCloudSync();assert.match(c.getAppStorageState().text,/Für diese Sitzung gespeichert/);
});
function completionApp(type='Unterricht'){
 let preview,stage,view;const warnings=[];
 const members=[{id:'a',firstName:'A',lastName:'Test',committeeMember:true},{id:'b',firstName:'B',lastName:'Test',committeeMember:false},{id:'c',firstName:'C',lastName:'Alter',ageDepartment:true,committeeMember:true}];
 const entries=[{id:'entry-1',storedName:'Test, A',displayName:'Test, A',status:'Anwesend',sessionType:type}];
 const c=vm.createContext({window:{SmartWorkflow:{confirm:async(...args)=>{preview=args;return false;}}},document:{readyState:'loading',addEventListener(){}},moveReportImportToSettings(){},setTimeout(){},members,sessionType:type,pendingMemberStatuses:new Map(),currentClosingTopic:'Funk',todayEntries:()=>entries,nameForStorage:m=>m.lastName+', '+m.firstName,nameForTile:m=>m.lastName+', '+m.firstName,today:()=> '2026-10-09',showToast:m=>warnings.push(m),setHomeFlowStage:s=>stage=s,showView:v=>view=v});
 const source=read('js/features/reports/zip-terminpakete.js');vm.runInContext(source.slice(source.indexOf('let closingDay=false;'),source.indexOf('window.closeDay=async')+source.slice(source.indexOf('window.closeDay=async')).indexOf('\n};')+4),c);return {c,warnings,getPreview:()=>preview,getStage:()=>stage,getView:()=>view};
}
test('Abschlussvorschau nennt auch unmarkierte Altersmitglieder, die CSV als Fehlt ausgibt',async()=>{
 const a=completionApp();await a.c.window.closeDay();assert.deepEqual(Array.from(a.getPreview()[3].people),['Test, B','Alter, C']);assert.equal(a.getPreview()[1].find(x=>x[0]==='Als Fehlt exportiert')[1],'2');assert.equal(a.getStage(),2);assert.equal(a.getView(),'attendanceView');
});
test('Doppelte Anwesenheit verhindert Abschluss vor ZIP-Erstellung',async()=>{
 const a=completionApp();a.c.todayEntries=()=>[{storedName:'Test, A',status:'Anwesend',sessionType:'Unterricht'},{storedName:'Test, A',status:'Anwesend',sessionType:'Unterricht'}];await a.c.window.closeDay();assert.match(a.warnings.join(' '),/mehrfach erfasst/);assert.equal(a.getPreview(),undefined);
});
test('Ausschuss-Abschluss listet nur Ausschussmitglieder als Fehlt',async()=>{
 const a=completionApp('Ausschuss Sitzung');await a.c.window.closeDay();assert.deepEqual(Array.from(a.getPreview()[3].people),['Alter, C']);
});
test('Nicht übernommene Anwesenheitsauswahl verhindert den Export',async()=>{
 const a=completionApp();a.c.pendingMemberStatuses.set('b','Anwesend');await a.c.window.closeDay();assert.equal(a.getPreview(),undefined);assert.match(a.warnings[0],/Auswahl übernehmen/);
});
test('Doppeltes Abschließen während der Vorschau startet nur eine Prüfung; Abbruch gibt den Abschluss frei',async()=>{
 const f=completionApp();let release,previews=0;
 f.c.window.SmartWorkflow.confirm=async()=>{previews++;return new Promise(r=>release=r);};
 const first=f.c.window.closeDay();await f.c.window.closeDay();assert.equal(previews,1);release(false);await first;
 const next=f.c.window.closeDay();assert.equal(previews,2);release(false);await next;
});

test('Gruppenprobe zählt nur eingeladene, nicht erfasste Personen als fehlend',async()=>{
 for(const ids of [['a'],['a','b'],[]]){const f=completionApp('Sonderprobe');f.c.window.PortalAdmin={attendanceAudience:()=>({recipientIds:ids})};await f.c.window.closeDay();assert.equal(f.getPreview()[1].find(x=>x[0]==='Als Fehlt exportiert')[1],ids.includes('b')?'1':'0');}
});
test('Unbekannte private Einladungsliste verhindert falschen Export',async()=>{const f=completionApp();f.c.window.PortalAdmin={attendanceAudience:()=>({pending:true})};await f.c.window.closeDay();assert.equal(f.getPreview(),undefined);assert.match(f.warnings[0],/eingeladenen Personen/);});
test('CSV und PDF behandeln nicht eingeladene Mitglieder als Betrifft nicht, explizites Fehlt bleibt erhalten',async()=>{
 const f=completionApp('Sonderprobe');f.c.window.PortalAdmin={attendanceAudience:()=>({recipientIds:['a','b']})};f.c.window.SmartWorkflow.confirm=async()=>true;f.c.todayEntries=()=>[{storedName:'Test, A',status:'Anwesend',sessionType:'Sonderprobe'},{storedName:'Test, B',status:'Fehlt',sessionType:'Sonderprobe',date:'2026-10-09',time:''}];f.c.ensureCurrentSessionId=()=> 'session-test';f.c.saveEntries=()=>{};f.c.csvCell=x=>String(x??'');f.c.probePdfBlob=(rows,type,counts)=>{assert.equal(rows.find(x=>x.name==='Alter, C').status,'Betrifft nicht');assert.equal(rows.find(x=>x.name==='Test, B').status,'Fehlt');assert.equal(counts.missing,1);assert.equal(counts.notApplicable,1);return {};};f.c.buildTerminPackage=async options=>{assert.match(options.csvContent,/Alter, C;Sonderprobe;Betrifft nicht/);throw Error('captured');};await assert.rejects(f.c.window.closeDay(),/captured/);
});
