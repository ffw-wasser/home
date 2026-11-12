const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Backup=require('../js/features/history/backup-engine.js');
const code=fs.readFileSync(path.join(__dirname,'../js/features/settings/member-career.js'),'utf8');
function api(){
 const window={};
 vm.runInNewContext(code,{window,document:{addEventListener(){}},Date,console});
 return window.MemberCareer;
}
const example={id:'qualification-1',type:'course',title:'Truppführer',date:'2024-05-17',notes:'Lehrgang'};
test('Lehrgänge, Fortbildungen, Dienstgrade und Leistungsabzeichen werden in einer eigenen Akte angezeigt',()=>{
 const module=api(),output=module.render({careerEntries:[example,{id:'r1',type:'rank',title:'Oberfeuerwehrmann',date:'2025-02-10',notes:''},{id:'a1',type:'award',title:'Leistungsabzeichen Bronze',date:'2023-06-01',notes:''}]});
 for(const label of ['Lehrgänge','Fortbildungen','Dienstgrade','Leistungsabzeichen','Erworben am 17.05.2024'])assert.ok(output.includes(label),label);
 assert.equal(module.currentRank([{type:'rank',title:'Feuerwehrmann',date:'2020-01-01'},{type:'rank',title:'Oberfeuerwehrmann',date:'2024-02-01'}]),'Oberfeuerwehrmann');
});
test('Laufbahnangaben sind XSS-sicher ausgegeben',()=>{
 const module=api(),output=module.render({careerEntries:[{id:'x',type:'training',title:'<script>alert(1)</script>',date:'2022-02-10',notes:'" onclick="alert(1)'}]});
 assert.ok(!output.includes('<script>'));
 assert.ok(output.includes('&lt;script&gt;'));
 assert.ok(output.includes('&quot;'));
});
test('Ungültige, zukünftige und zu lange Einträge werden abgelehnt',()=>{
 const module=api();
 assert.equal(module.validate([example]).length,1);
 for(const entry of [{...example,date:'2040-02-10'},{...example,date:'2025-02-30'},{...example,type:'unknown'},{...example,title:''},{...example,title:'x'.repeat(121)}])assert.throws(()=>module.validate([entry]));
 assert.throws(()=>module.validate({}));
});
test('Laufbahndaten bleiben im Mitglieder-Komplettbackup erhalten',()=>{
 const record={id:'m1',lastName:'Test',firstName:'Max',roles:['GF'],careerEntries:[example],fitnessTrainer:true};
 const backup=Backup.create({members:[record],entries:[],csvArchive:[],roleTargets:{},careerCatalog:[{type:'rank',title:'Oberlöschmeister'}]});
 const restored=Backup.normalize(backup);
 assert.deepEqual(restored.members[0].careerEntries,[example]);
 assert.equal(restored.members[0].fitnessTrainer,true);
 assert.equal(restored.careerCatalog[0].title,'Oberlöschmeister');
});

test('Gemeinsamer Dienstgradkatalog enthält nur Ehrenamt der Freiwilligen Feuerwehr Baden-Württemberg',()=>{
 const module=api(),member=[{careerEntries:[
  {type:'rank',title:'Brandrat',date:'2023-01-01'},
  {type:'rank',title:'Hauptbrandmeister',date:'2023-01-01'},
  {type:'course',title:'Sonderausbildung Hochwasser',date:'2024-01-01'}]}];
 const ranks=module.suggestions('rank',member);
 assert.ok(ranks.includes('Hauptbrandmeister'));
 for(const blocked of ['Brandrat','Branddirektor','Brandamtmann','Brandoberinspektor'])
   assert.equal(ranks.includes(blocked),false);
 assert.ok(module.suggestions('course',member).includes('Sonderausbildung Hochwasser'));
 const catalog=module.mergedCatalog([{type:'rank',title:'Branddirektor'},{type:'training',title:'Beamtenlaufbahn'}],member);
 assert.ok(catalog.some(item=>item.type==='rank'&&item.title==='Hauptbrandmeister'));
 assert.equal(catalog.some(item=>/Branddirektor|Brandrat|Beamtenlaufbahn/i.test(item.title)),false);
 assert.equal(module.volunteerCatalogItem('rank','Leitender Hauptbrandmeister'),true);
 assert.equal(module.volunteerCatalogItem('rank','Brandamtsrat'),false);
});

test('Katalog enthält ausschließlich freiwillige Feuerwehr: Beamten-/Berufsbezeichnungen ausgeschlossen',()=>{
 const m=api();
 assert.ok(m.suggestions('rank',[],[]).includes('Oberfeuerwehrmann'));
 assert.ok(m.suggestions('rank',[],[]).includes('Löschmeister'));
 assert.equal(m.suggestions('rank',[],[]).includes('Branddirektor'),false);
 assert.equal(m.volunteerCatalogItem('rank','Branddirektor'),false);
 assert.equal(m.volunteerCatalogItem('rank','Brandoberinspektor'),false);
 assert.equal(m.volunteerCatalogItem('rank','Oberbrandmeister'),true);
 assert.equal(m.volunteerCatalogItem('course','Laufbahnprüfung gehobener feuerwehrtechnischer Dienst'),false);
 assert.equal(m.volunteerCatalogItem('training','Ausbildung zum hauptamtlichen Brandinspektor'),false);
 assert.equal(m.volunteerCatalogItem('training','Ausbildung Wasserrettung'),true);
});
test('Eigene erlaubte Bezeichnung wird ohne Doppelungen mitgliedsübergreifend angeboten',()=>{
 const m=api();
 const members=[{careerEntries:[{...example,type:'training',title:'Schulung Digitalfunk'}]},{careerEntries:[{...example,type:'training',title:'schulung digitalfunk'}]}];
 const all=m.mergedCatalog([{type:'training',title:'Schulung Digitalfunk'},{type:'rank',title:'Branddirektor'}],members);
 assert.equal(all.filter(x=>x.type==='training').length,1);
 assert.equal(all.some(x=>x.title==='Branddirektor'),false);
 assert.ok(m.suggestions('training',[],all).includes('Schulung Digitalfunk'));
});
test('Gemeinsamer Katalog wird im Komplettbackup erhalten',()=>{
 const terms=[{type:'training',title:'Gemeinsame Fortbildung'}];
 const backup=Backup.create({members:[{id:'m1',lastName:'Muster',firstName:'Marie'}],careerCatalog:terms,entries:[],csvArchive:[],roleTargets:{}});
 assert.deepEqual(Backup.normalize(backup).careerCatalog,terms);
});

test('Abzeichen gehören exakt zu FF-Dienstgrad und erworbener Auszeichnung',()=>{
 const m=api();
 assert.equal(m.insigniaAsset({type:'rank',title:'Oberfeuerwehrfrau'}),'senior-firefighter.png');
 assert.equal(m.insigniaAsset({type:'rank',title:'Oberfeuerwehrmann'}),'senior-firefighter.png');
 assert.equal(m.insigniaAsset({type:'rank',title:'Brandoberinspektor'}),'');
 assert.equal(m.insigniaAsset({type:'award',title:'Leistungsabzeichen Silber'}),'achievement-silver.png');
 assert.equal(m.insigniaAsset({type:'award',title:'Feuerwehr-Leistungsabzeichen Gold'}),'achievement-gold.png');
 assert.equal(m.insigniaAsset({type:'training',title:'Leistungsabzeichen Gold'}),'');
 assert.equal(m.insigniaAsset({type:'award',title:'Freies Abzeichen'}),'');
 const html=m.honorsHtml([{type:'rank',title:'Feuerwehrfrau',date:'2020-01-01'},{type:'rank',title:'Oberfeuerwehrfrau',date:'2024-05-01'},{type:'rank',title:'Hauptfeuerwehrfrau',date:'2099-01-01'},{type:'award',title:'Leistungsabzeichen Gold',date:'2024-06-01'}]);
 assert.match(html,/Oberfeuerwehrfrau/);assert.doesNotMatch(html,/>Feuerwehrfrau<|Hauptfeuerwehrfrau/);
 assert.match(html,/01.05.2024/);assert.match(html,/achievement-gold.png/);
 assert.equal(m.honorsHtml([]),'');
 for(const name of ['Feuerwehrfrau','Oberfeuerwehrfrau','Löschmeisterin','Leitende Hauptbrandmeisterin'])assert.ok(fs.existsSync(path.join(__dirname,'../assets/member-insignia',m.insigniaAsset({type:'rank',title:name}))));
});
