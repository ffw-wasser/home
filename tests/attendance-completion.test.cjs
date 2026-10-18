const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const controller=fs.readFileSync('js/features/attendance/attendance-controller.js','utf8');
function fixture(){
 const calls=[],nodes={homeStageFinish:{hidden:false,style:{}},probeTopicInput:{value:'Testübung'},probeTopicError:{hidden:true},probeTopicDialog:{close(){calls.push('dialog-close');}}};
 const c=vm.createContext({probeCompletionMode:'direct',tacticsClosingPending:false,currentClosingTopic:'',sessionType:'Allgemeine Probe',todayEntries:()=>[{status:'Anwesend'}],guardProbeCompletion:()=>true,byId:id=>nodes[id],openTactics:()=>calls.push('tactics'),openProbeTopicDialog:()=>calls.push('topic'),showToast:()=>calls.push('error'),requestExportFolderPermissionsNow:async()=>({ok:true}),closeDay:async topic=>calls.push(['close',topic]),finalizeProbeFromTactics:async()=>calls.push('finalize'),console});
 vm.runInContext(controller.slice(controller.indexOf('function chooseProbeCompletion'),controller.indexOf('function syncHomeFlowProgress')),c);
 const admin=fs.readFileSync('js/features/settings/admin.js','utf8');vm.runInContext(admin.slice(admin.indexOf('async function confirmProbeTopic'),admin.indexOf('function cancelAdminLogin')),c);
 return {c,calls,nodes};
}
test('Direkter Abschluss führt über das Thema zum Export ohne Taktikberechnung',async()=>{const f=fixture();f.c.chooseProbeCompletion('direct');await f.c.confirmProbeTopic();assert.deepEqual(f.calls,['topic','dialog-close',['close','Testübung']]);assert.equal(f.c.sessionType,'Allgemeine Probe');});
test('Automatik zeigt erst die Besetzung und übernimmt sie beim Themenabschluss',async()=>{const f=fixture();f.c.chooseProbeCompletion('automatic');assert.equal(f.nodes.homeStageFinish.hidden,true);assert.deepEqual(f.calls,['tactics']);await f.c.confirmProbeTopic();assert.deepEqual(f.calls,['tactics','dialog-close','finalize']);});
test('Fehlende Anwesenheit blockiert nur die Fahrzeugautomatik; unerfasste Auswahl blockiert beide Wege',()=>{const f=fixture();f.c.todayEntries=()=>[{status:'Entschuldigt'}];f.c.chooseProbeCompletion('automatic');assert.deepEqual(f.calls,['error']);f.c.chooseProbeCompletion('direct');assert.deepEqual(f.calls,['error','topic']);f.c.guardProbeCompletion=()=>false;f.c.chooseProbeCompletion('automatic');f.c.chooseProbeCompletion('direct');assert.deepEqual(f.calls,['error','topic']);});
test('Kleine Mannschaft kann nach Prüfung als allgemeine Probe abschließen',async()=>{
 const f=fixture(),tactics=fs.readFileSync('js/features/tactics/tactics.js','utf8');f.c.tacticsClosingPending=true;f.c.currentClosingTopic='Testübung';f.c.applyCalculatedTacticsFunctions=()=>f.calls.push('apply');f.c.showView=()=>{};f.c.hasCompleteStaffelOnAnyVehicle=()=>false;
 vm.runInContext(tactics.slice(tactics.indexOf('async function finalizeProbeFromTactics'),tactics.indexOf('\nbyId("breathingProtectionPlanned")')),f.c);await f.c.finalizeProbeFromTactics();assert.deepEqual(f.calls,['apply',['close','Testübung']]);assert.equal(f.c.sessionType,'Allgemeine Probe');
});
test('Thema wird vor Übernahme der Fahrzeugfunktionen verlangt',async()=>{
 const f=fixture(),tactics=fs.readFileSync('js/features/tactics/tactics.js','utf8');f.c.tacticsClosingPending=true;f.c.applyCalculatedTacticsFunctions=()=>f.calls.push('apply');
 vm.runInContext(tactics.slice(tactics.indexOf('async function finalizeProbeFromTactics'),tactics.indexOf('\nbyId("breathingProtectionPlanned")')),f.c);await f.c.finalizeProbeFromTactics();assert.deepEqual(f.calls,['topic']);
});
