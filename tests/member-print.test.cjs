const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/features/settings/member-print.js'),'utf8');
function api(){
 const window={},document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/features/settings/member-career.js'),'utf8'),{window,document,console,Date});
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
 for(const fragment of ['<svg onload','<img src','<script','+49123456789','4321','9471','g263ValidUntil','2027-01'])assert.equal(html.includes(fragment),false,fragment);
 for(const escaped of ['&lt;svg','&lt;img','&lt;script'])assert.ok(html.includes(escaped),escaped);
});
test('Korrekte Chronologie und deutliche Jahresauswahl',()=>{
 const m=api();
 assert.equal(m.currentRank(people[0]),'Oberfeuerwehrfrau');
 assert.equal(m.documentHtml(people,{mode:'year',year:2035}),'');
 assert.deepEqual(Array.from(m.functionsFor(people[2])),['Altersabteilung']);
});


test('Kreisdiagramme basieren auf dokumentierten abgeschlossenen Proben und Einsätzen',()=>{
 const m=api();
 const member=people[0];
 const history=[
  {date:'2024-01-11',item:{id:'probe-1',sessionType:'Allgemeine Probe'},rows:[{name:'Test, Anna',sessionType:'Allgemeine Probe',status:'Anwesend'}]},
  {date:'2024-01-25',item:{id:'probe-2',sessionType:'Sonderprobe'},rows:[{name:'Anna Test',sessionType:'Sonderprobe',status:'Entschuldigt'}]},
  {date:'2024-02-10',item:{id:'probe-3',sessionType:'Unterricht'},rows:[{name:'Test Anna',sessionType:'Unterricht',status:'Fehlt'}]},
  {date:'2024-03-13',item:{id:'probe-4',sessionType:'Probe'},rows:[{name:'Test, Anna',sessionType:'Probe',status:'Betrifft nicht'}]},
  {date:'2024-04-15',item:{id:'probe-5',sessionType:'Probe'},rows:[{name:'Beispiel, Ben',sessionType:'Probe',status:'Anwesend'}]},
  {date:'2024-05-17',item:{id:'op-1',sessionType:'Einsatz'},rows:[{name:'Test, Anna',sessionType:'Einsatz',status:'Anwesend'}],operation:true},
  {date:'2024-06-19',item:{id:'op-2',sessionType:'Einsatz'},rows:[{name:'Beispiel, Ben',sessionType:'Einsatz',status:'Anwesend'}],operation:true},
  {date:'2023-03-19',item:{id:'op-old',sessionType:'Einsatz'},rows:[{name:'Test, Anna',sessionType:'Einsatz',status:'Anwesend'}],operation:true},
  {date:'2024-07-19',item:{id:'fit',sessionType:'Fitness'},rows:[{name:'Test, Anna',sessionType:'Fitness',status:'Anwesend'}]}
 ];
 const all=m.participation(member,history,people);
 assert.deepEqual(JSON.parse(JSON.stringify(all)),{
  drills:{present:1,excused:1,missing:1,total:3},
  operations:{present:2,other:1,total:3}
 });
 const only2024=m.participation(member,history,people,2024);
 assert.deepEqual(JSON.parse(JSON.stringify(only2024)),{
  drills:{present:1,excused:1,missing:1,total:3},
  operations:{present:1,other:1,total:2}
 });
 const html=m.documentHtml(people,{mode:'selected',memberId:'member-a'},history);
 assert.equal((html.match(/class="member-print-ring"/g)||[]).length,2);
 assert.match(html,/Proben &amp; Unterricht/);
 assert.match(html,/Einsätze/);
 assert.match(html,/Nicht als Teilnehmer erfasst/);
 assert.match(html,/33 %/);
 const filtered=m.documentHtml(people,{mode:'year',year:2024},history);
 assert.match(filtered,/Kalenderjahr 2024/);
 assert.match(filtered,/50 %/);
});
test('Einsatzteilnahme ist keine erfundene Fehlzeit; bei fehlender Historie gibt es keine Quote',()=>{
 const m=api(),html=m.documentHtml(people,{mode:'selected',memberId:'member-a'});
 assert.match(html,/Noch keine auswertbaren Berichte vorhanden/);
 assert.match(html,/keine Daten/);
 assert.doesNotMatch(html,/100 %/);
 const sameName=[{...people[0],id:'x'}, {...people[0],id:'y'}];
 const history=[{date:'2024-01-01',item:{id:'a',sessionType:'Einsatz'},operation:true,rows:[{name:'Test, Anna',sessionType:'Einsatz',status:'Anwesend'}]}];
 assert.equal(m.participation(sameName[0],history,sameName).operations.present,0,'doppelte Namen dürfen nicht falsch zugeordnet werden');
});

test('Stammdatenausdruck zeigt Eintrittsdatum und Ehrungen in eigener Gruppe; Jahresfilter bleibt fachlich unverändert',()=>{
 const m=api(),person={id:'x',firstName:'Test',lastName:'Muster',joinedOn:'2001-03-17',careerEntries:[{type:'award',title:'Feuerwehr-Ehrenzeichen in Bronze',date:'2024-05-01'}]};
 const html=m.documentHtml([person],{mode:'all'});
 assert.match(html,/Eintrittsdatum/);assert.match(html,/17.03.2001/);assert.match(html,/<h3>Ehrungen<\/h3>/);assert.match(html,/honor-bw-bronze.jpg/);assert.match(html,/Verliehen am 01.05.2024/);
 assert.equal(m.candidates([person],{mode:'year',year:2024}).length,0,'Ehrung ist kein Lehrgang, keine Fortbildung und kein Dienstgrad');
});
