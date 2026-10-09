const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const BackupEngine = require('../js/features/history/backup-engine.js');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const member = {id:'test',firstName:'Test',lastName:'Person',roles:['ATM'],ageDepartment:false,
  machinistVehicles:['LF'],g263ValidUntil:'2027-01-02',agtInstructionValidUntil:'2027-03-04',
  ffiValidUntil:'2027-05-06',breathingClearanceUntil:'2027-01-02',driverLicenseCheckedOn:'2026-01-01'};

test('Komplettbackup erhält alle drei Atemschutztermine bis zur tatsächlichen Wiederherstellung', () => {
  const original = JSON.stringify(member);
  const backup = BackupEngine.create({members:[member],entries:[],csvArchive:[],roleTargets:{}});
  const read = BackupEngine.normalize(JSON.parse(JSON.stringify(backup)));
  const context = vm.createContext({window:{},document:{addEventListener(){}},AVAILABLE_ROLES:['ATM'],console});
  vm.runInContext(source('js/features/history/archive.js'), context);
  const restored = context.normalizeCompleteBackupData(read).members[0];
  for (const key of ['g263ValidUntil','agtInstructionValidUntil','ffiValidUntil','driverLicenseCheckedOn'])
    assert.equal(restored[key],member[key]);
  assert.equal(JSON.stringify(member),original);
});

function storage(initial={}) {
  const data = new Map(Object.entries(initial));
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,
    getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
function safety(persistent=true) {
  const local = storage();
  const context = vm.createContext({window:persistent?{localStorage:local}:{},
    document:{getElementById:()=>null},console});
  context.window.addEventListener=()=>{};
  vm.runInContext(source('js/core/config.js'),context);
  vm.runInContext(source('js/features/quality/quality-engine.js'),context);
  return context;
}
for (const persistent of [true,false]) test(`Sicherungspunkte enthalten Nutzdaten und keine Tokens oder verschachtelten Sicherungen, persistent=${persistent}`,()=>{
  const context=safety(persistent);
  vm.runInContext(`safeStorage.setItem(KEYS.members,'[{"id":"test"}]');
    safeStorage.setItem(KEYS.entries,'[]');
    safeStorage.setItem('fw_onedrive_tokens','test-only-token');
    safeStorage.setItem('fw_onedrive_pkce','test-only-pkce');`,context);
  for(let i=0;i<12;i++)assert.equal(context.createSafetySnapshot('test'),true);
  const snapshots=JSON.parse(vm.runInContext('safeStorage.getItem(QUALITY_SNAPSHOT_KEY)',context));
  assert.equal(snapshots.length,10);
  for(const snapshot of snapshots){
    assert.equal(snapshot.data.fw_v5_members,'[{"id":"test"}]');
    assert.equal(snapshot.data.fw_v5_entries,'[]');
    assert.ok(!('fw_v1_safety_snapshots' in snapshot.data));
    assert.ok(!('fw_onedrive_tokens' in snapshot.data));
    assert.ok(!('fw_onedrive_pkce' in snapshot.data));
  }
});

test('Offline-Registrierung verwendet den richtigen Projektpfad und fängt Ablehnung ab',async()=>{
  const app=source('js/app/app.js');
  const fn=app.slice(app.indexOf('function registerAppServiceWorker(){'),app.indexOf('if(document.readyState==="complete")registerAppServiceWorker();'));
  const calls=[];
  const context=vm.createContext({URL,Promise,console:{warn(){}},window:{isSecureContext:true},
    document:{baseURI:'https://example.invalid/home/index.html'},
    navigator:{serviceWorker:{register:async url=>{calls.push(url);return {active:true};}}}});
  vm.runInContext(fn,context);
  assert.equal((await context.registerAppServiceWorker()).active,true);
  assert.deepEqual(calls,['https://example.invalid/home/service-worker.js']);
  context.navigator.serviceWorker.register=async()=>{throw new Error('test rejection');};
  assert.equal(await context.registerAppServiceWorker(),null);
  context.window.isSecureContext=false;
  assert.equal(await context.registerAppServiceWorker(),null);
});

test('Erste Offline-Installation lädt alle direkt benötigten öffentlichen App-Dateien',()=>{
  const context=vm.createContext({importScripts:()=>{},self:{addEventListener(){}},console});
  vm.runInContext(source('service-worker.js'),context);
  const core=vm.runInContext('CORE',context);
  const html=source('index.html');
  const refs=[...html.matchAll(/(?:src|href)="((?:js|css)\/[^\"]+)"/g)].map(m=>'./'+m[1]);
  for(const ref of refs){
    assert.ok(core.includes(ref),`Offline fehlt: ${ref}`);
    assert.ok(fs.existsSync(path.join(__dirname,'..',ref.split('?')[0])),`Datei fehlt: ${ref}`);
  }
  assert.ok(!core.some(p=>/onedrive_tokens|daten\.json|Berichte\//.test(p)));
});

test('Komplettbackup enthält auch PDFs aus der geladenen OneDrive-Historie',async()=>{
  const context=vm.createContext({window:{loadOneDriveHistoryPdf:async report=>report.id==='live'?'onedrive-pdf':null},
    csvArchive:[{id:'live',hasImportedPdf:true,fileName:'live.csv'},{id:'local',hasImportedPdf:true,fileName:'local.csv'}]});
  vm.runInContext(source('js/core/database.js'),context);
  context.loadImportedReportPdf=async id=>id==='local'?'local-pdf':null;
  context.blobToDataUrl=async blob=>'data:application/pdf;base64,'+blob;
  const result=await context.exportImportedReportPdfs();
  assert.deepEqual(JSON.parse(JSON.stringify(result)),[
    {reportId:'live',fileName:'live.pdf',dataUrl:'data:application/pdf;base64,onedrive-pdf'},
    {reportId:'local',fileName:'local.pdf',dataUrl:'data:application/pdf;base64,local-pdf'}
  ]);
});
