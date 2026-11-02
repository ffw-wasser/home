const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/attendance/attendance-controller.js','utf8');
function fixture(type,smart=true){
 const nodes=new Map(),people=[{id:'member',lastName:'Feuerwehr',firstName:'Beispiel',committeeMember:true},{id:'trainer',lastName:'Trainer',firstName:'Beispiel',fitnessTrainer:true,committeeMember:true}],c=vm.createContext({
  members:people,sessionType:type,chosenRole:'Anwesend',chosenMemberId:'trainer',chosenMemberIds:new Set(['trainer']),pendingMemberStatuses:new Map([['trainer','Anwesend']]),
  sortMembers:x=>x,todayEntries:()=>[],nameForStorage:m=>m.id,nameForTile:m=>m.lastName,escapeHtml:s=>s,requestAnimationFrame(){},fitMemberLastNames(){},
  byId:id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',querySelectorAll:()=>[]});return nodes.get(id);},
  window:{AttendanceSmart:smart?{matches:()=>true,refresh(){}}:null},document:{},entries:[],Date,
  makeId:()=> 'new-entry',today:()=> '2026-11-02',ensureCurrentSessionId:()=> 'session',saveEntries(){},renderEntries(){},renderAdmin(){},updateSelection(){},updateProbeWorkflow(){},updatePrimaryAction(){},setTimeout(){},showToast(){}
 });
 vm.runInContext(source.slice(source.indexOf('function renderMembers()'),source.indexOf('function attendanceStartState()')),c);
 vm.runInContext(source.slice(source.indexOf('function saveQuickMemberStatus('),source.indexOf('function chooseMember(')),c);
 return {c,nodes,people};
}
test('Trainer never appears in attendance tiles or counts, with or without smart filters',()=>{
 for(const type of ['Allgemeine Probe','Sonderprobe','Unterricht','Einsatz','Ausschuss Sitzung','Fitness'])for(const smart of [true,false]){
  const {c,nodes}=fixture(type,smart);c.renderMembers();
  assert.doesNotMatch(nodes.get('members').innerHTML,/Trainer|data-quick-member="trainer"/,type);
  assert.match(nodes.get('members').innerHTML,/data-quick-member="member"/,type);
  assert.match(nodes.get('memberCount').textContent,/1 offen$/);
  assert.equal(c.chosenMemberId,'');assert.equal(c.chosenMemberIds.size,0);assert.equal(c.pendingMemberStatuses.size,0);
  assert.equal(c.members.find(m=>m.id==='trainer').fitnessTrainer,true,'administrative role remains intact');
 }
});
test('A roster containing only trainers shows no eligible participants',()=>{
 const {c,nodes}=fixture('Allgemeine Probe');c.members=c.members.filter(m=>m.fitnessTrainer);c.renderMembers();
 assert.match(nodes.get('members').innerHTML,/Für diese Terminart sind keine Mitglieder hinterlegt/);assert.match(nodes.get('memberCount').textContent,/0 offen$/);
});
test('Old selections cannot write trainer attendance, ordinary members can still be saved',()=>{
 const {c}=fixture('Fitness');assert.equal(c.saveQuickMemberStatus('trainer','Anwesend'),false);
 c.pendingMemberStatuses.set('member','Anwesend');c.renderMembers=()=>{};c.commitPendingMemberStatuses();
 assert.equal(c.entries.length,1);assert.equal(c.entries[0].storedName,'member');assert.equal(c.pendingMemberStatuses.size,0);
});

test('Saved members keep an inaccessible grid slot; deleting attendance restores their tile',()=>{
 for(const smart of [true,false]){
  const {c,nodes}=fixture('Unterricht',smart);c.members.push({id:'other',lastName:'Weitere',firstName:'Person'});
  c.todayEntries=()=>[{storedName:'member',status:'Anwesend'}];c.renderMembers();
  assert.match(nodes.get('members').innerHTML,/class="member-direct-card  recorded" aria-hidden="true" inert/);
  assert.ok(nodes.get('members').innerHTML.indexOf('data-quick-member="member"')<nodes.get('members').innerHTML.indexOf('data-quick-member="other"'));
  assert.match(nodes.get('memberCount').textContent,/1 offen$/);
  c.todayEntries=()=>[];c.renderMembers();assert.doesNotMatch(nodes.get('members').innerHTML,/aria-hidden="true" inert/);assert.match(nodes.get('memberCount').textContent,/2 offen$/);
 }
});
