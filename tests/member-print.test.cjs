const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/features/settings/member-print.js'),'utf8');
function api(){
 const window={},document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(code,{window,document,console,Date});
 return window.MemberRecordsPrint;
}
const people=[
 {id:'member-a',firstName:'Anna',lastName:'Test',roles:['GF','ATF'],machinistVehicles:['LF'],careerEntries:[
  {type:'course',title:'Truppführer',date:'2024-03-14',notes:'Ausbildung'},
  {type:'training',title:'Digitalfunk',date:'2024-05-10'},
  {type:'rank',title:'Oberfeuerwehrfrau',date:'2023-02-01'},
  {type:'award',title:'Leistungsabzeichen Bronze',date:'2022-05-01'}]},
 {id:'member-b',firstName:'Ben',lastName:'Beispiel',roles:[],careerEntries:[{type:'rank',title:'Feuerwehrmann',date:'2024-06-30'}]},
 {id:'member-c',firstName:'Cora',lastName:'Alt',ageDepartment:true,roles:[],careerEntries:[{type:'award',title:'Leistungsabzeichen Silber',date:'2024-04-15'}]},
 {id:'member-guest',firstName:'Gast',lastName:'Fitness',fitnessTrainer:true,careerEntries:[{type:'training',title:'Fitness',date:'2024-08-10'}]}
];
test('Jahresfilter: nur Lehrgänge, Fortbildungen und Dienstgrade im gewählten Jahr',()=>{
 const m=api();
 assert.deepEqual(Array.from(m.candidates(people,{mode:'year',year:2024}),x=>x.id),['member-b','member-a']);
 assert.deepEqual(Array.from(m.candidates(people,{mode:'year',year:2023}),x=>x.id),['member-a']);
 assert.equal(m.candidates(people,{mode:'year',year:2022}).length,0);
 assert.equal(m.matchedInYear(people[0],2024).length,2);
 assert.equal(m.matchedInYear(people[0],2023).length,1);
 assert.equal(m.matchedInYear(people[2],2024).length,0,'Abzeichen allein gilt nicht als Jahres-Lehrgang oder Dienstgrad');
});
test('Einzelausdruck, alle Mitglieder und Gäste-Regel',()=>{
 const m=api();
 assert.deepEqual(Array.from(m.candidates(people,{mode:'selected',memberId:'member-a'}),x=>x.id),['member-a']);
 assert.equal(m.candidates(people,{mode:'all'}).length,3,'Gäste gehören nicht zum Gesamtausdruck der Feuerwehr');
 assert.equal(m.candidates(people,{mode:'selected',memberId:'member-guest'}).length,1,'eine explizit ausgewählte Gastakte bleibt druckbar');
 assert.equal(m.candidates(people,{mode:'selected',memberId:'missing'}).length,0);
});
test('Jahresausdruck: eine vollständige Personenkarten-Ausgabe pro berechtigtem Mitglied',()=>{
 const m=api(),html=m.documentHtml(people,{mode:'year',year:2024});
 assert.equal((html.match(/class="member-print-person"/g)||[]).length,2);
 assert.match(html,/Anna Test/);
 assert.match(html,/Ben Beispiel/);
 assert.doesNotMatch(html,/Cora Alt/);
 assert.match(html,/Im Jahr 2024 erreicht/);
 assert.match(html,/Truppführer/);
 assert.match(html,/Oberfeuerwehrfrau/);
 assert.match(html,/Leistungsabzeichen Bronze/,'vollständige Laufbahn wird zusätzlich abgedruckt');
 assert.match(html,/Gruppenführer/);
 assert.match(html,/Maschinist · LF/);
});
test('Druckansicht maskiert HTML und enthält keine Kontakt-, PIN- oder Gesundheitsdaten',()=>{
 const m=api(),html=m.documentHtml([{id:'x',firstName:'<svg onload=alert(1)>',lastName:'Test',roles:['GF'],
  whatsappPhone:'+49123456789',pin:'4321',drinkPin:'9471',g263ValidUntil:'2027-01',
  careerEntries:[{type:'course',title:'<img src=x onerror=alert(1)>',date:'2024-09-01',notes:'<script>alert(2)</script>'}]}],{mode:'all'});
 for(const fragment of ['<svg','<img','<script','+49123456789','4321','9471','g263ValidUntil','2027-01'])assert.equal(html.includes(fragment),false,fragment);
 for(const escaped of ['&lt;svg','&lt;img','&lt;script'])assert.ok(html.includes(escaped),escaped);
});
test('Korrekte Chronologie und deutliche Jahresauswahl',()=>{
 const m=api();
 assert.equal(m.currentRank(people[0]),'Oberfeuerwehrfrau');
 assert.equal(m.documentHtml(people,{mode:'year',year:2035}),'');
 assert.deepEqual(Array.from(m.functionsFor(people[2])),['Altersabteilung']);
});
