const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(require.resolve('../'+file),'utf8');
test('Termin-Rückweg öffnet Schritt 1 und erhält den laufenden Entwurf',()=>{
 const source=read('js/features/attendance/attendance-controller.js');
 const entries=[{id:'saved'}],pendingMemberStatuses=new Map([['member','Anwesend']]);
 const c=vm.createContext({homeFlowStage:2,currentSessionId:'session',entries,pendingMemberStatuses,setHomeFlowStage(stage){c.homeFlowStage=stage;}});
 vm.runInContext(source.slice(source.indexOf('function requestReturnToHomeStage'),source.indexOf('function discardCurrentAttendanceSession')),c);
 assert.equal(c.requestReturnToHomeStage(),true);assert.equal(c.homeFlowStage,1);
 assert.equal(c.currentSessionId,'session');assert.equal(c.entries,entries);assert.equal(c.pendingMemberStatuses.get('member'),'Anwesend');
});
function summaryFixture({entries=[],pending=[],stage=1,draft=null}={}){
 const button={},summary={querySelector:selector=>selector==='button'?button:{}};
 const c=vm.createContext({initialized:true,selectionKey:'session|Unterricht',selectionUndo:null,currentSessionId:'session',currentOperationId:'',sessionType:'Unterricht',currentClosingTopic:'',currentOperationDraft:draft,homeFlowStage:stage,pendingMemberStatuses:new Map(pending),todayEntries:()=>entries,today:()=> '2026-10-09',byId:id=>id==='workflowSessionSummary'?summary:null,text(){}});
 const source=read('js/features/quality/workflow-ux.js');vm.runInContext(source.slice(source.indexOf(' function attendance()'),source.indexOf(' function beforeSelection()')),c);c.attendance();return {summary,button};
}
test('Eine bloße Terminartauswahl zeigt keine Fortsetzen-Karte',()=>{assert.equal(summaryFixture().summary.hidden,true);});
test('Anmeldungen und ungespeicherte Eingaben können vom Start aus fortgesetzt werden',()=>{
 for(const options of [{entries:[{id:'saved'}]},{pending:[['member','Anwesend']]},{draft:{type:'Brand'}}]){
  const start=summaryFixture(options);assert.equal(start.summary.hidden,false);assert.equal(start.button.hidden,false);
  assert.equal(summaryFixture({...options,stage:2}).button.hidden,true);
 }
});
