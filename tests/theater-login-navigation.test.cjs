const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function fixture(){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:true,value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},select(){},close(){}});return nodes.get(id);};
 for(const id of ['eventsView','theaterView','adminLoginView','attendanceView'])get(id);
 get('eventsView').hidden=false;
 const calls=[];
 const c=vm.createContext({pendingSettingsTarget:'',adminUnlocked:false,toastTimer:null,mode:'manage',console,
  byId:get,document:{querySelectorAll:()=>[...nodes.values()].filter(n=>n.id.endsWith('View'))},
  oneDriveAdministrationReady:()=>true,checkAdminSession:()=>c.adminUnlocked,resetAdminTimeout(){},clearTimeout(){},setTimeout(){},hideDocumentReportUi(){},
  adminPin:()=> 'test-password',renderAdmin(){},scrollTo(){}});
 c.window=c;c.g=c;
 vm.runInContext(read('js/core/ui.js'),c);
 const admin=read('js/features/settings/admin.js');
 vm.runInContext(admin.slice(admin.indexOf('function cancelAdminLogin()'),admin.indexOf('function loginArchive()')),c);
 const theater=read('js/features/theater/theater-admin.js');
 vm.runInContext(theater.slice(theater.indexOf(' function route('),theater.indexOf(' function setMode(')),c);
 c.TheaterAdmin={beforeView:()=>true,setMode:mode=>{calls.push(mode);c.mode=mode;return true;},load:()=>calls.push('load')};
 return {c,get,calls};
}
for(const [mode,target] of [['cash','theaterCashView'],['stats','theaterStatsView'],['manage','theaterManageView']]){
 test('Nach Passwort öffnet genau der gewählte Bereich: '+mode,()=>{
  const f=fixture();assert.equal(f.c.openTab(mode),false);
  assert.equal(f.c.pendingSettingsTarget,target);assert.equal(f.get('adminLoginView').hidden,false);
  assert.deepEqual(f.calls,[],'Vor Freigabe keine Theaterdaten laden');
  f.get('adminPin').value='falsch';f.c.login();assert.equal(f.c.pendingSettingsTarget,target);assert.deepEqual(f.calls,[]);
  f.get('adminPin').value='test-password';f.c.login();
  assert.equal(f.get('theaterView').hidden,false);assert.deepEqual(f.calls,[mode,'load']);
  assert.equal(f.c.pendingSettingsTarget,'');
 });
 test('Abgebrochene Anmeldung führt zur Veranstaltung zurück: '+mode,()=>{
  const f=fixture();f.c.openTab(mode);f.get('adminPin').value='angefangen';f.c.cancelAdminLogin();
  assert.equal(f.get('eventsView').hidden,false);assert.equal(f.get('theaterView').hidden,true);
  assert.equal(f.c.pendingSettingsTarget,'');assert.equal(f.get('adminPin').value,'');assert.deepEqual(f.calls,[]);
 });
}
test('Bereits freigegebener Zugang öffnet die Kasse direkt und lädt nur einmal',()=>{
 const f=fixture();f.c.adminUnlocked=true;assert.equal(f.c.openTab('cash'),true);
 assert.deepEqual(f.calls,['cash','load']);assert.equal(f.get('theaterView').hidden,false);
});
