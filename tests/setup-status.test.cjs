const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/features/quality/smart-workflow.js','utf8');
function app(){const data=new Map([['fw_onedrive_client_id','client'],['fw_onedrive_shared_folder_url','folder-a']]);const c=vm.createContext({connected:false,secure:false,members:[],oneDriveAdministrationReady:()=>c.connected,passwordSecurityStatus:()=>({secure:c.secure}),localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}});vm.runInContext(source.slice(source.indexOf('  const setupKey='),source.indexOf('  function openSetupStep')),c);return {c,data,state:()=>vm.runInContext('setupState()',c)};}
test('Einrichtung verschwindet erst nach bestätigtem Ordner, eigenem Passwort und Mitgliedern',()=>{const a=app();assert.equal(a.state().complete,false);a.c.connected=true;a.c.secure=true;assert.equal(a.state().complete,false);a.c.members=[{id:'test'}];assert.equal(a.state().complete,true);assert.ok(a.data.has('fw_setup_completed_v1'));});
test('Abgeschlossene Einrichtung bleibt nach Neustart oder Abmeldung gespeichert; neuer Ordner wird neu geprüft',()=>{const a=app();a.c.connected=true;a.c.secure=true;a.c.members=[{}];a.state();a.c.connected=false;a.c.members=[];assert.equal(a.state().complete,true);a.data.set('fw_onedrive_shared_folder_url','folder-b');assert.equal(a.state().complete,false);});
test('Zurückgesetztes Passwort oder bestätigter leerer Datenbestand erfordern erneute Einrichtung',()=>{for(const reason of ['password','members']){const a=app();a.c.connected=true;a.c.secure=true;a.c.members=[{}];a.state();if(reason==='password')a.c.secure=false;else a.c.members=[];assert.equal(a.state().complete,false);assert.equal(a.data.has('fw_setup_completed_v1'),false);}});
test('Gesperrter Browserspeicher verhindert weder Erkennung noch Einrichtung',()=>{const a=app();a.c.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};a.c.connected=true;a.c.secure=true;a.c.members=[{}];assert.equal(a.state().complete,true);});
test('Gespeichertes Passwort aktualisiert den Einrichtungshinweis sofort; ungültige Eingabe nicht',()=>{
 const source=fs.readFileSync('js/features/settings/admin.js','utf8');
 for(const [first,repeat,updates] of [['test-only-password','test-only-password',1],['short','short',0],['test-only-password','different-value',0]]){
  const fields={newPin:{value:first},repeatPin:{value:repeat}},stored=new Map();let calls=0;
  const c=vm.createContext({requireAdmin:()=>true,byId:id=>fields[id],KEYS:{password:'test-key'},safeStorage:{setItem:(k,v)=>stored.set(k,v)},showToast(){},window:{SmartWorkflow:{settings(){assert.equal(stored.get('test-key'),first);calls++;}}}});
  vm.runInContext(source.slice(source.indexOf('function changePin()')),c);c.changePin();assert.equal(calls,updates);
 }
});
test('Öffnen der Einstellungen prüft auch ein bereits eingerichtetes Passwort erneut',()=>{
 const source=fs.readFileSync('js/core/ui.js','utf8');let updates=0;
 const c=vm.createContext({window:{scrollTo(){},SmartWorkflow:{settings(){updates++;}}},byId:()=>({classList:{remove(){},toggle(){}}}),document:{querySelectorAll:()=>[]},clearTimeout(){},toastTimer:0,closeCompactMenu(){},hideDocumentReportUi(){}});
 vm.runInContext(source.slice(source.indexOf('function showView('),source.indexOf('function renderSessionType(')),c);
 c.showView('settingsView');assert.equal(updates,1);c.showView('attendanceView');assert.equal(updates,1);
});
