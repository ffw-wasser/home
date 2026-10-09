const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/features/tactics/tactics.js'),'utf8');
const begin=source.indexOf('function manualMoveTacticsMember('),end=source.indexOf('function initializeTacticsDragDrop(',begin);
function fixture(){
 const a={id:'a',atueQualified:true},b={id:'b',atueQualified:true},slot={vehicle:'LF10',role:'GF',member:b};
 const c=vm.createContext({findTacticsMember:id=>[a,b].find(p=>p.id===id),currentAtueMember:a,currentTacticsSlots:[slot],breathingProtectionPlanned:true,BREATHING_ROLES:new Set(),memberMayFillSlot:()=>false,showToast(){},deniedTacticsSlotMessage:()=> 'Nicht geeignet',refreshTacticsManualView(){},updateTacticsRecommendationAfterManualChange(){}});vm.runInContext(source.slice(begin,end),c);return {c,a,b,slot};
}
test('Abgelehnter Wechsel von ATÜ lässt die bestehende Besetzung unverändert',()=>{const f=fixture();f.c.manualMoveTacticsMember('a','LF10','GF');assert.equal(f.c.currentAtueMember,f.a);assert.equal(f.slot.member,f.b);});
test('ATÜ-Tausch prüft die Berechtigung der verdrängten Person vor jeder Änderung',()=>{const f=fixture();f.c.manualMoveTacticsMember('b','ATUE','ATÜ');assert.equal(f.c.currentAtueMember,f.a);assert.equal(f.slot.member,f.b);});
test('Erlaubter ATÜ-Tausch übernimmt beide Zuordnungen',()=>{const f=fixture();f.c.memberMayFillSlot=()=>true;f.c.manualMoveTacticsMember('b','ATUE','ATÜ');assert.equal(f.c.currentAtueMember,f.b);assert.equal(f.slot.member,f.a);});
