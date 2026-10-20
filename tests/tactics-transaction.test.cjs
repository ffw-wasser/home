const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/features/tactics/tactics.js'),'utf8');
const begin=source.indexOf('function manualMoveTacticsMember('),end=source.indexOf('function initializeTacticsDragDrop(',begin);
function fixture(){
 const a={id:'a'},b={id:'b'},sourceSlot={vehicle:'LF10',role:'Melder',member:a},slot={vehicle:'LF10',role:'GF',member:b};
 const c=vm.createContext({findTacticsMember:id=>[a,b].find(p=>p.id===id),currentTacticsSlots:[sourceSlot,slot],breathingProtectionPlanned:true,BREATHING_ROLES:new Set(),memberMayFillSlot:()=>false,showToast(){},deniedTacticsSlotMessage:()=> 'Nicht geeignet',refreshTacticsManualView(){},updateTacticsRecommendationAfterManualChange(){}});vm.runInContext(source.slice(begin,end),c);return {c,a,b,slot,sourceSlot};
}
test('Abgelehnter Wechsel lässt beide Fahrzeugplätze unverändert',()=>{const f=fixture();f.c.manualMoveTacticsMember('a','LF10','GF');assert.equal(f.sourceSlot.member,f.a);assert.equal(f.slot.member,f.b);});
test('Tausch prüft die Berechtigung der verdrängten Person',()=>{const f=fixture();f.c.memberMayFillSlot=m=>m.id==='a';f.c.manualMoveTacticsMember('a','LF10','GF');assert.equal(f.sourceSlot.member,f.a);assert.equal(f.slot.member,f.b);});
test('Erlaubter Tausch übernimmt beide Fahrzeugzuordnungen',()=>{const f=fixture();f.c.memberMayFillSlot=()=>true;f.c.manualMoveTacticsMember('a','LF10','GF');assert.equal(f.slot.member,f.a);assert.equal(f.sourceSlot.member,f.b);});
