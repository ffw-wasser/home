const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/portal-admin.js','utf8');
function fixture(options={}){
 const calls=[],people=['yes','excused','open','saved','marked','outside'].map(id=>({id,firstName:'Test',lastName:id}));
 const c=vm.createContext({replyData:{event:{id:'test-event',attendanceType:'Sonderprobe',recipientIds:['yes','excused','open','saved','marked']},replies:['yes','saved','marked','outside'].map(memberId=>({memberId,status:'yes'})).concat({memberId:'excused',status:'excused'}),stale:false},members:people,sessionType:'Sonderprobe',currentSessionId:'test-session',currentOperationId:'',oneDriveStateConfirmed:true,oneDriveAdministrationReady:()=>true,pendingMemberStatuses:new Map([['marked','Entschuldigt']]),chosenMemberIds:new Set(),todayEntries:()=>[{storedName:'saved'}],nameForStorage:m=>m.id,nameForTile:m=>m.lastName,chosen:()=> 'test-event',paintReplies:()=>calls.push('paint'),renderMembers:()=>calls.push('render'),updateSelection:()=>calls.push('selection'),setHomeFlowStage:n=>calls.push(n),showToast:s=>calls.push(s),WorkflowUX:{beforeSelection:()=>calls.push('undo')},...options});c.g=c;
 vm.runInContext(source.slice(source.indexOf(' function replyCandidates'),source.indexOf(' function paintReplies')),c);return {c,calls};
}
test('Nur Zusagen und Entschuldigungen berechtigter, noch nicht markierter oder erfasster Personen werden vorgemerkt',()=>{
 const f=fixture();assert.deepEqual(Array.from(f.c.replyCandidates(),p=>[p.member.id,p.status]),[['yes','Anwesend'],['excused','Entschuldigt']]);assert.equal(f.c.stageCalendarReplies(),true);assert.equal(f.c.pendingMemberStatuses.get('yes'),'Anwesend');assert.equal(f.c.pendingMemberStatuses.get('excused'),'Entschuldigt');assert.equal(f.c.pendingMemberStatuses.get('marked'),'Entschuldigt');assert.equal(f.c.pendingMemberStatuses.has('open'),false);assert.equal(f.c.pendingMemberStatuses.has('saved'),false);assert.equal(f.c.pendingMemberStatuses.has('outside'),false);assert.equal(f.c.chosenMemberIds.size,3);assert.ok(f.calls.includes('undo'));assert.ok(f.calls.includes(2));
});
test('Wiederholtes Vormerken erzeugt weder doppelte Markierungen noch eine erneute Änderung',()=>{const f=fixture();f.c.stageCalendarReplies();f.calls.length=0;assert.equal(f.c.stageCalendarReplies(),false);assert.equal(f.c.pendingMemberStatuses.size,3);assert.equal(f.calls.length,0);});
test('Veralteter Kalender, falscher Termin und unbestätigte OneDrive-Verbindung sperren die Aktion auch bei direktem Aufruf',()=>{
 for(const kind of ['stale','wrong-event','no-access','unconfirmed']){const f=fixture();if(kind==='stale')f.c.replyData.stale=true;if(kind==='wrong-event')f.c.chosen=()=> 'other';if(kind==='no-access')f.c.oneDriveAdministrationReady=()=>false;if(kind==='unconfirmed')f.c.oneDriveStateConfirmed=false;assert.equal(f.c.stageCalendarReplies(),false);assert.equal(f.c.pendingMemberStatuses.size,1);assert.equal(f.calls.length,0);}
});
test('Ohne laufenden Termin startet dieselbe Aktion die Kalendererfassung und zeigt die Vormerkungen',()=>{
 const f=fixture({currentSessionId:'',sessionType:'Einsatz'});let started=0;f.c.beginAttendanceFromContext=()=>{started++;f.c.currentSessionId='new-session';f.c.sessionType='Sonderprobe';};assert.equal(f.c.stageCalendarReplies(),true);assert.equal(started,1);assert.equal(f.c.pendingMemberStatuses.get('yes'),'Anwesend');
});
test('Abgebrochener oder fehlgeschlagener Terminstart merkt keine Personen vor',()=>{const f=fixture({currentSessionId:''});f.c.beginAttendanceFromContext=()=>{};assert.equal(f.c.stageCalendarReplies(),false);assert.equal(f.c.pendingMemberStatuses.size,1);});
test('Einsätze werden nicht aus Kalenderzusagen besetzt und Ausschusssitzungen bleiben auf Ausschussmitglieder begrenzt',()=>{
 const operation=fixture({currentOperationId:'test-operation',sessionType:'Einsatz'});assert.equal(operation.c.stageCalendarReplies(),false);assert.equal(operation.c.pendingMemberStatuses.size,1);
 const f=fixture({sessionType:'Ausschuss Sitzung'});f.c.members.find(m=>m.id==='yes').committeeMember=true;assert.deepEqual(Array.from(f.c.replyCandidates(),p=>p.member.id),['yes']);
});
test('Die Übersicht bietet die passende Anzahl direkt an und blendet den Button nach der Vormerkung aus',()=>{
 const f=fixture(),area={children:[],querySelectorAll(){return this.children.filter(n=>n.tagName==='details');},replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};
 f.c.document={getElementById:()=>area};f.c.node=(tag,text)=>({tagName:tag,textContent:text,dataset:{},children:[],append(...nodes){this.children.push(...nodes);}});f.c.date=()=> 'Testdatum';f.c.manual=null;
 vm.runInContext(source.slice(source.indexOf(' function paintReplies'),source.indexOf(' async function refreshAttendance')),f.c);f.c.paintReplies();
 const apply=area.children.find(n=>n.tagName==='button');assert.equal(apply.textContent,'2 Rückmeldungen vormerken');assert.equal(apply.hidden,false);assert.equal(apply.disabled,false);apply.onclick();assert.equal(area.children.find(n=>n.tagName==='button').hidden,true);assert.equal(f.c.pendingMemberStatuses.size,3);
});
