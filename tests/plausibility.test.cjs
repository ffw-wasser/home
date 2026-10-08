const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const TacticsEngine=require('../js/features/tactics/tactics-engine.js');

test('Fahrzeugberechtigungen unterscheiden LF und TSF',()=>{
  assert.equal(TacticsEngine.canDriveVehicle({machinistVehicles:['TSF']},'LF10'),false);
  assert.equal(TacticsEngine.canDriveVehicle({machinistVehicles:['LF']},'LF10'),true);
  assert.equal(TacticsEngine.canDriveVehicle({machinistVehicles:['LF']},'TSF'),true);
  assert.equal(TacticsEngine.canDriveVehicle({machinistVehicles:[]},'TSF'),false);
});

test('Staffel wird pro Fahrzeug geprüft; verteilte Rollen ergeben keine vollständige Staffel',()=>{
  const roles=['GF','Maschinist','ATF','ATM','WTF','WTM'];
  const slots=roles.map(role=>({vehicle:'LF10',role,member:{id:role}}));
  assert.equal(TacticsEngine.hasCompleteStaffelOnAnyVehicle(slots),true);
  slots[5].vehicle='TSF';
  assert.equal(TacticsEngine.hasCompleteStaffelOnAnyVehicle(slots),false);
  assert.equal(TacticsEngine.shouldShowAlternative('Allgemeine Probe',slots),true);
  assert.equal(TacticsEngine.shouldShowAlternative('Unterricht',slots),false);
});

test('Einsatzbesetzung meldet Doppelbelegung und Überbelegung',()=>{
  const context=vm.createContext({safeStorage:{getItem:()=>''},window:{},console,
    document:{addEventListener(){}},entries:[],members:[],getMemberRoles:()=>['GF','ATM'],
    nameForStorage:m=>m.lastName+', '+m.firstName});
  vm.runInContext(fs.readFileSync(require.resolve('../js/features/operations/operations.js'),'utf8'),context);
  const names=Array.from({length:10},(_,i)=>'Test '+i);
  context.members=names.map((name,i)=>({id:String(i),firstName:String(i),lastName:'Test',machinistVehicles:['LF']}));
  context.operationNames=()=>names;
  context.operationRolesForName=()=>['GF','Maschinist','ATM'];
  context.testNames=names;
  vm.runInContext(`operationAssignments={};operationAssignmentRoles={};
    testNames.forEach((name,i)=>{operationAssignments[name]='EM 5/42 LF10';
    operationAssignmentRoles[name]=i===0?'GF':i===1?'Maschinist':'ATM';});`,context);
  const errors=context.validateOperationAssignments();
  assert.ok(errors.some(x=>x.includes('doppelt besetzt')));
  assert.ok(errors.some(x=>x.includes('Kapazität von 9')));
});
