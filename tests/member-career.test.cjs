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
 const backup=Backup.create({members:[record],entries:[],csvArchive:[],roleTargets:{}});
 const restored=Backup.normalize(backup);
 assert.deepEqual(restored.members[0].careerEntries,[example]);
 assert.equal(restored.members[0].fitnessTrainer,true);
});
