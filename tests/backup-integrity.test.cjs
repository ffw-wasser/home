const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const BackupEngine = require('../js/features/history/backup-engine.js');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const member = {id:'test',firstName:'Test',lastName:'Person',roles:['ATM'],ageDepartment:false,
  machinistVehicles:['LF'],g262ValidUntil:'2028-03-04',g263ValidUntil:'2027-01-02',agtInstructionValidUntil:'2027-03-04',
  ffiValidUntil:'2027-05-06',breathingClearanceUntil:'2027-01-02',driverLicenseCheckedOn:'2026-01-01',breathingQualified:false,driverLicenseIntervalMonths:6};

test('WhatsApp-Kontaktdaten bleiben beim Backup und Wiederherstellen erhalten', () => {
  const input={...member,whatsappPhone:'+4915112345678',whatsappAllowed:true};
  const backup=BackupEngine.create({members:[input],entries:[],csvArchive:[],roleTargets:{}});
  const normalized=BackupEngine.normalize(JSON.parse(JSON.stringify(backup)));
  const context=vm.createContext({BackupEngine,window:{},document:{addEventListener(){}},AVAILABLE_ROLES:['ATM'],console});
  vm.runInContext(source('js/features/history/archive.js'),context);
  const restored=context.normalizeCompleteBackupData(normalized).members[0];
  assert.equal(restored.whatsappPhone,input.whatsappPhone);
  assert.equal(restored.whatsappAllowed,true);
});

test('Komplettbackup erhält alle drei Atemschutztermine bis zur tatsächlichen Wiederherstellung', () => {
  const original = JSON.stringify(member);
  const backup = BackupEngine.create({members:[member],entries:[],csvArchive:[],roleTargets:{}});
  const read = BackupEngine.normalize(JSON.parse(JSON.stringify(backup)));
  const context = vm.createContext({BackupEngine,window:{},document:{addEventListener(){}},AVAILABLE_ROLES:['ATM'],console});
  vm.runInContext(source('js/features/history/archive.js'), context);
  const restored = context.normalizeCompleteBackupData(read).members[0];
  for (const key of ['g262ValidUntil','g263ValidUntil','agtInstructionValidUntil','ffiValidUntil','driverLicenseCheckedOn','breathingQualified','driverLicenseIntervalMonths'])
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


test('Laufender Einsatz wird mit Entwurf wiederhergestellt, ohne Tokens oder Passwörter zu übernehmen',()=>{
  const local=storage({'fw_v1_current_operation_id':'op-test','fw_v1_operation_draft_op-test':JSON.stringify({id:'op-test',location:'Teststelle'}),
    fw_v1_attendance_draft:JSON.stringify({version:1,id:'op-test',source:'test-source',topic:'Testthema',pending:[['test','Anwesend']]}),
    fw_onedrive_tokens:'PRIVATE-TEST-TOKEN',fw_v6_password:'PRIVATE-TEST-PASSWORD'});
  const context=vm.createContext({BackupEngine,safeStorage:local,window:{},document:{addEventListener(){}},console,
    members:[member],entries:[],csvArchive:[],getMemberRoles:m=>m.roles,getRoleTargets:()=>({}),isFunctionEntryEnabled:()=>true,
    KEYS:{members:'members',entries:'entries',archive:'archive',functionEntry:'functions',roleTargets:'targets'},AVAILABLE_ROLES:['ATM']});
  vm.runInContext(source('js/features/history/archive.js'),context);
  const payload=context.completeBackupPayload(),serialized=JSON.stringify(payload);
  assert.ok(!serialized.includes('PRIVATE-TEST-'));
  assert.equal(payload.version,'1.2');
  local.setItem('fw_v1_current_operation_id','op-replaced');local.setItem('fw_v1_operation_draft_op-replaced','{}');
  context.saveCompleteBackupData(context.normalizeCompleteBackupData(BackupEngine.normalize(JSON.parse(serialized))));
  assert.equal(local.getItem('fw_v1_current_operation_id'),'op-test');
  assert.equal(JSON.parse(local.getItem('fw_v1_operation_draft_op-test')).location,'Teststelle');
  assert.equal(JSON.parse(local.getItem('fw_v1_attendance_draft')).source,'test-source');
  assert.equal(local.getItem('fw_v1_operation_draft_op-replaced'),null);
  assert.equal(local.getItem('fw_onedrive_tokens'),'PRIVATE-TEST-TOKEN');
  assert.equal(local.getItem('fw_v6_password'),'PRIVATE-TEST-PASSWORD');
  assert.equal(BackupEngine.normalize(BackupEngine.create({members:[member]})).runningState,null);
});

test('Fehlende PDF-Dateien verhindern eine unvollständige App-Sicherung',async()=>{
  const context=vm.createContext({window:{},csvArchive:[{id:'missing',hasImportedPdf:true,fileName:'test.csv'}]});
  vm.runInContext(source('js/core/database.js'),context);
  context.loadImportedReportPdf=async()=>null;
  await assert.rejects(context.exportImportedReportPdfs(),/PDF-Datei fehlt/);
});

test('Unvollständige Online-Historie verhindert Ausgabe und Erfolgsmeldung',async()=>{
  const messages=[];let outputs=0;
  const context=vm.createContext({window:{loadOneDriveHistory:async()=>false},document:{addEventListener(){}},
    requireAdmin:()=>true,showToast:(...args)=>messages.push(args),console});
  vm.runInContext(source('js/features/history/archive.js'),context);
  context.shareOrDownloadJson=async()=>outputs++;
  await context.exportCompleteBackup();
  assert.equal(outputs,0);assert.match(messages[0][0],/Sicherung nicht erstellt/);
});


test('Auch gespeicherte Dokumentberichte dürfen ohne PDF nicht als gesichert gelten',async()=>{
  const context=vm.createContext({window:{}});
  vm.runInContext(source('js/features/reports/document-report.js'),context);
  context.allDocumentReports=async()=>[{id:'test-document'}];
  await assert.rejects(context.exportDocumentReports(),/keine PDF-Datei/);
});

test('Öffentliche Wordvorlage und eingebettete Kopie haben keine persönlichen Dateieigenschaften',async()=>{
  const JSZip=require('../js/vendor/jszip.min.js');
  const context=vm.createContext({window:{}});
  vm.runInContext(source('js/features/reports/operation-docx-template.js'),context);
  const bytes=Buffer.from(context.window.OPERATION_DOCX_TEMPLATE_BASE64,'base64');
  assert.deepEqual(bytes,fs.readFileSync(path.join(__dirname,'../assets/templates/Einsatzbericht-Wordvorlage-Kreuze-FINAL.docx')));
  const zip=await JSZip.loadAsync(bytes),core=await zip.file('docProps/core.xml').async('string');
  for(const tag of ['dc:creator','cp:lastModifiedBy','dc:title','dc:description'])
    assert.ok(!new RegExp('<'+tag+'(?:\\s[^>]*)?>[^<]+</'+tag+'>').test(core),tag);
  const xml=await zip.file('word/document.xml').async('string');
  assert.equal((xml.match(/KBM \/ Vertretung/g)||[]).length,4);
  assert.ok(xml.includes('{{LEADER}}'));assert.ok(xml.includes('{{AGENCY_12}}'));
});

test('Erfolgreiche App-Sicherung benennt zusätzlich notwendige Sicherungen und enthält Entwürfe',async()=>{
  let output;
  const local=storage({'fw_v1_current_session_id':'session-test','fw_v1_attendance_draft':JSON.stringify({id:'session-test',topic:'Testthema',source:'original-source'})});
  const context=vm.createContext({BackupEngine,safeStorage:local,window:{loadOneDriveHistory:async()=>true},document:{addEventListener(){}},
    members:[member],entries:[],csvArchive:[],getMemberRoles:m=>m.roles,getRoleTargets:()=>({}),isFunctionEntryEnabled:()=>true,
    requireAdmin:()=>true,today:()=> '2026-10-23',exportImportedReportPdfs:async()=>[],exportDocumentReports:async()=>[],
    showToast:message=>{throw Error(message);},console});
  vm.runInContext(source('js/features/history/archive.js'),context);
  context.shareOrDownloadJson=async(name,payload)=>{output=payload;return 'downloaded';};
  await context.exportCompleteBackup();
  assert.equal(output.data.runningState.attendanceDraft.topic,'Testthema');
  assert.equal(output.data.backupInfo.encrypted,false);
  assert.ok(output.data.backupInfo.excludes.some(x=>x.includes('Cloudflare/D1')));
});

for(const fails of [false,true])test(`App-Sicherung integriert zentrale Konten und meldet Fehler ohne unvollständigen Export: ${fails}`,async()=>{
 let output=null,calls=0,message='';
 const central={connection:async()=>({source:'test-source'}),backup:async()=>{calls++;if(fails)throw Error('OneDrive-Sicherung fehlgeschlagen');return {name:'sicherung-test.json',accounts:[{memberId:'test'}],seq:7};}};
 const context=vm.createContext({BackupEngine,safeStorage:storage(),window:{DrinksCentral:central},document:{addEventListener(){}},members:[member],entries:[],csvArchive:[],getMemberRoles:m=>m.roles,getRoleTargets:()=>({}),isFunctionEntryEnabled:()=>true,requireAdmin:()=>true,today:()=> '2026-10-29',exportImportedReportPdfs:async()=>[],exportDocumentReports:async()=>[],showToast:m=>message=m,console});
 vm.runInContext(source('js/features/history/archive.js'),context);context.shareOrDownloadJson=async(name,payload)=>{output=payload;return 'downloaded';};await context.exportCompleteBackup();assert.equal(calls,1);
 if(fails){assert.equal(output,null);assert.match(message,/Sicherung nicht erstellt.*OneDrive-Sicherung fehlgeschlagen/);}else{assert.equal(output.data.backupInfo.centralBackup.file,'Getraenke/sicherung-test.json');assert.equal(output.data.backupInfo.centralBackup.verified,true);assert.equal(output.data.backupInfo.centralBackup.accountCount,1);assert.equal(output.data.backupInfo.centralBackup.sequence,7);assert.ok(!JSON.stringify(output).includes('token'));}
});
