const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(require.resolve('../'+file),'utf8');
function operationContext(){
  const c=vm.createContext({safeStorage:{getItem:()=>''},window:{addEventListener(){}},console,
    document:{addEventListener(){}},entries:[],members:[],getMemberRoles:()=>[],nameForStorage:m=>m.lastName+', '+m.firstName});
  vm.runInContext(read('js/features/operations/operations.js'),c);
  vm.runInContext(read('js/features/quality/quality-engine.js'),c);
  c.operationNames=()=>['Testperson'];
  vm.runInContext("operationAssignments={'Testperson':'Reserve Einsatzstelle'};operationAssignmentRoles={'Testperson':'Reserve'}",c);
  return c;
}
test('Offene Einsatzberichtsfelder verhindern bei gültiger Reservezuordnung den Abschluss nicht',()=>{
  const c=operationContext(),data={date:'2026-10-09',members:['Testperson'],times:{}};
  const form=c.validateOperation(data),guard=c.validateOperationData(data);
  assert.equal(form.errors.length,0);assert.equal(guard.errors.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(form)),JSON.parse(JSON.stringify(guard)));
  assert.ok(form.warnings.some(t=>/Einsatzart/.test(t)));
  assert.ok(form.warnings.some(t=>/Einsatzstelle/.test(t)));
});
test('Fehlende Besetzung und ein fehlendes Einsatzdatum bleiben echte Abschlussblockaden',()=>{
  const c=operationContext();vm.runInContext("operationAssignments={};operationAssignmentRoles={}",c);
  const result=c.validateOperation({date:'',members:['Testperson'],times:{}});
  assert.ok(result.errors.some(t=>/nicht vollständig zugeordnet/.test(t)));
  assert.ok(result.errors.some(t=>/Einsatzdatum/.test(t)));
});
test('Historienänderung, Sicherungspunkt und Passwortänderung benötigen den Verwaltungsmodus',async()=>{
  const messages=[],data=new Map(),c=vm.createContext({requireAdmin:()=>false,byId:()=>null,
    safeStorage:{setItem:(k,v)=>data.set(k,v),getItem:()=>null},window:{addEventListener(){}},document:{},
    csvArchive:[{id:'a'}],members:[],showToast:m=>messages.push(m),console});
  vm.runInContext(read('js/features/history/archive.js'),c);
  vm.runInContext(read('js/features/quality/quality-engine.js'),c);
  vm.runInContext(read('js/features/settings/admin.js'),c);
  await c.deleteArchiveItem('a');c.correctArchiveItem('a');c.restoreLatestSafetySnapshot();c.changePin();
  assert.equal(c.csvArchive.length,1);assert.equal(data.size,0);
});
