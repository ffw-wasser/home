const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/attendance/attendance-controller.js','utf8');
function fixture(options={}){
 const nodes=new Map(),calls=[],get=id=>{if(!nodes.has(id))nodes.set(id,{querySelector:()=>({focus:()=>calls.push('focus')})});return nodes.get(id);};
 const c=vm.createContext({Intl,Date,currentSessionId:'',currentOperationId:'',sessionType:'Allgemeine Probe',pendingSessionType:'',pendingMemberStatuses:new Map(),today:()=> '2026-10-16',todayEntries:()=>[],window:{PortalAdmin:{selectedEvent:()=>options.event||null}},byId:get,setHomeFlowStage:stage=>calls.push(stage),renderSessionType(){},renderMembers(){},renderEntries(){},updateSelection(){},chooseSessionType(type,options){calls.push({type,calendar:options.calendar});c.pendingSessionType=type;},continueToAttendance:()=>calls.push('start'),...options});
 vm.runInContext(source.slice(source.indexOf('function attendanceStartState'),source.indexOf('function backToMembers')),c);return {c,get,calls};
}
test('Kalendertermin zeigt Namen und startet direkt mit übernommener Terminart',()=>{
 const f=fixture({event:{title:'Testübung',sessionType:'Probe',start:'2026-10-16T17:00:00Z'}}),state=f.c.attendanceStartState();
 assert.equal(state.title,'Testübung');assert.equal(state.type,'Allgemeine Probe');assert.equal(state.action,'Erfassung starten');assert.match(state.date,/19:00/);
 f.c.beginAttendanceFromContext();assert.deepEqual(f.calls,[{type:'Allgemeine Probe',calendar:true},'start']);
});
test('Fortsetzen erhält Termin und unübernommene Markierungen',()=>{
 const pending=new Map([['test-member','Anwesend']]),f=fixture({currentSessionId:'test-session',pendingMemberStatuses:pending,todayEntries:()=>[{status:'Anwesend'},{status:'Entschuldigt'}]});
 assert.equal(f.c.attendanceStartState().action,'Erfassung fortsetzen');assert.match(f.c.attendanceStartState().summary,/1 anwesend · 1 entschuldigt · 1 noch/);
 f.c.beginAttendanceFromContext();assert.deepEqual(f.calls,[2]);assert.equal(f.c.currentSessionId,'test-session');assert.equal(f.c.pendingMemberStatuses,pending);
 f.c.syncAttendanceStart();assert.equal(f.get('attendanceAlternatives').hidden,true);
});
test('Ohne Kalender und Terminart wird nur die spontane Auswahl geöffnet',()=>{
 const f=fixture();f.c.beginAttendanceFromContext();assert.equal(f.get('attendanceAlternatives').open,true);assert.equal(f.get('attendanceSpontaneous').open,true);assert.deepEqual(f.calls,['focus']);assert.equal(f.c.currentSessionId,'');
});
test('Erst Markierungen übernehmen, dann zum passenden Abschluss wechseln',()=>{
 for(const [type,label] of [['Allgemeine Probe','Weiter zu Schritt 3'],['Einsatz','Fahrzeuge zuordnen'],['Unterricht','Termin prüfen und abschließen']]){
  const f=fixture({sessionType:type,todayEntries:()=>[{status:'Anwesend'}],pendingMemberStatuses:new Map([['test-member','Anwesend']])});f.c.updatePrimaryAction();
  assert.equal(f.get('exportResetButton').hidden,true);assert.equal(f.get('exportResetButton').disabled,true);assert.equal(f.get('saveButton').hidden,false);
  f.c.pendingMemberStatuses.clear();f.c.updatePrimaryAction();assert.equal(f.get('saveButton').hidden,true);assert.equal(f.get('exportResetButton').hidden,false);assert.equal(f.get('exportResetButton').disabled,false);assert.equal(f.get('exportResetButton').textContent,label);
 }
});
test('Ohne erfasste Personen bleibt der Abschluss gesperrt',()=>{const f=fixture();f.c.updatePrimaryAction();assert.equal(f.get('exportResetButton').disabled,true);});
test('Nur die manuelle Terminartauswahl ohne laufenden Termin löst die Kalenderbindung',()=>{
 const ui=fs.readFileSync('js/core/ui.js','utf8'),start=ui.indexOf('function chooseSessionType'),end=ui.indexOf('\n}',start)+2;
 for(const [calendar,running,expected] of [[true,false,0],[false,false,1],[false,true,0]]){
  let detached=0;const c=vm.createContext({currentSessionId:running?'test-session':'',currentOperationId:'',pendingSessionType:'',window:{PortalAdmin:{useSpontaneous:()=>detached++}},byId:()=>null,showToast(){}});
  vm.runInContext(ui.slice(start,end),c);c.chooseSessionType('Unterricht',{calendar});assert.equal(detached,expected);assert.equal(c.pendingSessionType,'Unterricht');
 }
});

test('Probenabschluss übernimmt das Kalender-Thema, ohne das Textfeld zu sperren',()=>{
 const source=fs.readFileSync('js/features/settings/admin.js','utf8');
 const start=source.indexOf('function suggestedProbeTopic()');
 const end=source.indexOf('async function confirmProbeTopic()',start);
 assert.ok(start>=0&&end>start);
 let title='Funkübung – Löschangriff',selected=true,date='2026-10-18';
 const input={value:'',focus(){},setSelectionRange(){},},description={},error={},dialog={showModal(){this.shown=true;}};
 const fields={probeTopicInput:input,probeTopicDialog:dialog,probeTopicDescription:description,probeTopicError:error};
 const c=vm.createContext({
  currentClosingTopic:'',currentProbeDate:'2026-10-18',sessionType:'Allgemeine Probe',
  window:{PortalAdmin:{selectedEvent:()=>selected?{kind:'probe',title}:null,selectedDate:()=>date}},
  ensureProbeTopicDialog(){},byId:id=>fields[id]
 });
 vm.runInContext(source.slice(start,end),c);
 c.openProbeTopicDialog();
 assert.equal(input.value,'Funkübung – Löschangriff');
 assert.equal(dialog.shown,true);
 input.value='Abweichende Übung';
 assert.equal(input.value,'Abweichende Übung','Die Vorschau bleibt frei editierbar');
 c.currentClosingTopic=input.value;
 title='Neues Kalenderthema';
 c.openProbeTopicDialog();
 assert.equal(input.value,'Abweichende Übung','Ein bestätigtes Thema hat Vorrang vor Kalender-Updates');
 c.currentClosingTopic='';title='Probe';c.openProbeTopicDialog();
 assert.equal(input.value,'','Eine bloße Terminart ist kein geeignetes Probenthema');
 title='Fahrzeugkunde';date='2026-10-19';c.openProbeTopicDialog();
 assert.equal(input.value,'','Nicht zu diesem Datum gehörende Kalendertermine dürfen nichts vorausfüllen');
 date='2026-10-18';selected=false;c.openProbeTopicDialog();
 assert.equal(input.value,'','Spontane Proben bleiben frei beschreibbar');
});
