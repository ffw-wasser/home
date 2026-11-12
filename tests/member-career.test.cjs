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

test('Ehrungen sind getrennt von Leistungszeichen; passende Originalbilder und bestehende Einträge bleiben erhalten',()=>{
 const m=api(),choices=m.suggestions('honor',[],[]);
 assert.equal(choices.length,13);
 for(const title of choices){const item={type:'award',title,date:'2024-05-01'};assert.ok(m.isHonor(item));assert.ok(fs.existsSync(path.join(__dirname,'../assets/member-insignia',m.insigniaAsset(item))),title);}
 const old={id:'old',type:'award',title:'Feuerwehr-Ehrenzeichen in Bronze',date:'2024-05-01',notes:''};
 assert.equal(m.insigniaAsset(old),'honor-bw-bronze.jpg');
 assert.equal(m.insigniaAsset({...old,title:'Deutsches Feuerwehr-Ehrenkreuz Bronze'}),'honor-dfv-bronze.jpg');
 assert.equal(m.insigniaAsset({...old,title:'Feuerwehr-Leistungsabzeichen Bronze'}),'achievement-bronze.png');
 assert.equal(m.insigniaAsset({...old,title:'Ehrenabzeichen Bronze'}),'','Unklare Organisation erhält kein geratenes Symbol');
 const html=m.render({careerEntries:[old,{...old,id:'performance',title:'Leistungsabzeichen Bronze'}]});
 const groups=html.split('<section class="career-category">').slice(1);
 assert.ok(groups.find(x=>x.includes('data-career-add="honor"')).includes('Feuerwehr-Ehrenzeichen in Bronze'));
 assert.ok(!groups.find(x=>x.includes('data-career-add="award"')).includes('Feuerwehr-Ehrenzeichen in Bronze'));
 assert.deepEqual(JSON.parse(JSON.stringify(m.validate([old])[0])),old,'Vorhandene Daten werden nicht umbenannt');
 assert.equal(m.honorsHtml([]),'','Eintritt und Dienstjahre verleihen keine Ehrung');
 assert.equal(m.honorsHtml([{...old,date:'2099-01-01'}]),'','Keine zukünftige Ehrung als verliehen darstellen');
});
test('Freie Ehrungen behalten ihre Kategorie im Katalog und Backup ohne erfundenes Symbol',()=>{
 const m=api(),item={id:'free',type:'award',awardKind:'honor',title:'Besonderer Dank der Abteilung',date:'2024-05-01',notes:'Urkunde'};
 const validated=m.validate([item]);assert.equal(validated[0].awardKind,'honor');assert.ok(m.isHonor(validated[0]));
 const catalog=m.mergedCatalog([],[{careerEntries:validated}]);
 assert.equal(catalog[0].awardKind,'honor');assert.ok(m.suggestions('honor',[],catalog).includes(item.title));assert.ok(!m.suggestions('award',[],catalog).includes(item.title));
 const restored=Backup.normalize(Backup.create({members:[{id:'m',firstName:'Test',lastName:'Muster',joinedOn:'2001-03-17',careerEntries:validated}],careerCatalog:catalog}));
 assert.equal(restored.members[0].joinedOn,'2001-03-17');assert.equal(restored.members[0].careerEntries[0].awardKind,'honor');assert.equal(restored.careerCatalog[0].awardKind,'honor');
 assert.equal(m.insigniaAsset(item),'');
 const html=m.honorsHtml(validated);assert.match(html,/Ehrungen/);assert.match(html,/Verliehen am 01.05.2024/);assert.doesNotMatch(html,/<img/);
});

test('Ehrungen und vorhandene Dienstgrade bleiben nach Datum absteigend sortiert',()=>{
 const m=api(),html=m.render({careerEntries:[
  {type:'award',awardKind:'honor',title:'Ältere Ehrung',date:'2020-01-01'},
  {type:'award',awardKind:'honor',title:'Neuere Ehrung',date:'2024-01-01'},
  {type:'rank',title:'Feuerwehrmann',date:'2019-01-01'},
  {type:'rank',title:'Oberfeuerwehrmann',date:'2022-01-01'}]});
 const group=html.split('<section class="career-category">').find(x=>x.includes('data-career-add="honor"'));
 assert.ok(group.indexOf('<strong>Neuere Ehrung</strong>')<group.indexOf('<strong>Ältere Ehrung</strong>'));
 const honors=m.honorsHtml([{type:'award',awardKind:'honor',title:'Ältere Ehrung',date:'2020-01-01'},{type:'award',awardKind:'honor',title:'Neuere Ehrung',date:'2024-01-01'}]);
 assert.ok(honors.indexOf('Neuere Ehrung')<honors.indexOf('Ältere Ehrung'));
});
test('Echte Wiederherstellungsnormalisierung erhält Eintrittsdatum und freie Ehrungen',()=>{
 const m=api(),source=fs.readFileSync(path.join(__dirname,'../js/features/history/archive.js'),'utf8');
 const start=source.indexOf('function normalizeCompleteBackupData('),end=source.indexOf('\nfunction saveCompleteBackupData(',start);
 const context={window:{MemberCareer:m},AVAILABLE_ROLES:['GF'],BackupEngine:Backup,validBackupMember:member=>member&&typeof member.id==='string'&&typeof member.firstName==='string'&&typeof member.lastName==='string'};
 vm.runInNewContext(source.slice(start,end)+';this.restore=normalizeCompleteBackupData;',context);
 const result=context.restore({members:[{id:'m',firstName:'Test',lastName:'Muster',joinedOn:'2001-03-17',careerEntries:[{id:'x',type:'award',awardKind:'honor',title:'Besonderer Dank der Abteilung',date:'2024-05-01'}]}]});
 assert.equal(result.members[0].joinedOn,'2001-03-17');assert.equal(result.members[0].careerEntries[0].awardKind,'honor');assert.equal(result.careerCatalog[0].awardKind,'honor');
});
