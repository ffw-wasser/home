const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(require.resolve('../'+file),'utf8');
function syncApp(){
 const store=new Map(),timers=new Map();let id=0;
 const c=vm.createContext({window:{},navigator:{onLine:true},safeStorage:{persistent:true},console:{error(){}},byId:()=>null,showToast(){},localStorage:{getItem:k=>store.get(k)||'',setItem:(k,v)=>store.set(k,v)},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i)});
 vm.runInContext(read('js/core/onedrive-sync.js'),c);
 Object.assign(c,{oneDriveSignedIn:()=>true,oneDriveStatus(){},renderOneDriveDialog(){},oneDriveReadState:async()=>null,oneDriveWriteState:async()=>{},applyOneDrivePayload(){}});
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
 const first=c.syncOneDrive();c.scheduleCloudSync();release({updatedAt:'2099-01-01'});await first;
 assert.equal(applied,0);assert.equal(written,1);assert.equal(c.getAppStorageState().kind,'cloud');
});
test('Fehlgeschlagenes OneDrive-Schreiben bestätigt keinen Cloud-Speicherstatus',async()=>{
 const {c}=syncApp();c.scheduleCloudSync();c.oneDriveWriteState=async()=>{throw Error('offline');};await c.syncOneDrive();assert.equal(c.getAppStorageState().kind,'local');assert.match(c.getAppStorageState().text,/noch nicht bestätigt/);
});
test('Ohne dauerhaften Browser-Speicher behauptet der Hinweis keine Gerätesicherung',()=>{
 const {c}=syncApp();c.safeStorage.persistent=false;c.oneDriveSignedIn=()=>false;c.scheduleCloudSync();assert.match(c.getAppStorageState().text,/Für diese Sitzung gespeichert/);
});
function completionApp(type='Unterricht'){
 let preview,stage,view;const warnings=[];
 const members=[{id:'a',firstName:'A',lastName:'Test',committeeMember:true},{id:'b',firstName:'B',lastName:'Test',committeeMember:false},{id:'c',firstName:'C',lastName:'Alter',ageDepartment:true,committeeMember:true}];
 const entries=[{id:'entry-1',storedName:'Test, A',displayName:'Test, A',status:'Anwesend',sessionType:type}];
 const c=vm.createContext({window:{SmartWorkflow:{confirm:async(...args)=>{preview=args;return false;}}},document:{readyState:'loading',addEventListener(){}},moveReportImportToSettings(){},setTimeout(){},members,sessionType:type,pendingMemberStatuses:new Map(),currentClosingTopic:'Funk',todayEntries:()=>entries,nameForStorage:m=>m.lastName+', '+m.firstName,nameForTile:m=>m.lastName+', '+m.firstName,today:()=> '2026-10-09',showToast:m=>warnings.push(m),setHomeFlowStage:s=>stage=s,showView:v=>view=v});
 const source=read('js/features/reports/zip-terminpakete.js');vm.runInContext(source.slice(source.indexOf('window.closeDay=async'),source.indexOf('window.closeDay=async')+source.slice(source.indexOf('window.closeDay=async')).indexOf('\n};')+4),c);return {c,warnings,getPreview:()=>preview,getStage:()=>stage,getView:()=>view};
}
test('Abschlussvorschau nennt auch unmarkierte Altersmitglieder, die CSV als Fehlt ausgibt',async()=>{
 const a=completionApp();await a.c.window.closeDay();assert.deepEqual(Array.from(a.getPreview()[3].people),['Test, B','Alter, C']);assert.equal(a.getPreview()[1].find(x=>x[0]==='Als Fehlt exportiert')[1],'2');assert.equal(a.getStage(),2);assert.equal(a.getView(),'attendanceView');
});
test('Ausschuss-Abschluss listet nur Ausschussmitglieder als Fehlt',async()=>{
 const a=completionApp('Ausschuss Sitzung');await a.c.window.closeDay();assert.deepEqual(Array.from(a.getPreview()[3].people),['Alter, C']);
});
test('Nicht übernommene Anwesenheitsauswahl verhindert den Export',async()=>{
 const a=completionApp();a.c.pendingMemberStatuses.set('b','Anwesend');await a.c.window.closeDay();assert.equal(a.getPreview(),undefined);assert.match(a.warnings[0],/Auswahl übernehmen/);
});
