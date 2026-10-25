const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const MemberEvidence=require('../js/features/portal/member-evidence.js');
function fixture(roster){
 const c=vm.createContext({members:roster,MemberEvidence,Date,nameForStorage:m=>`${m.lastName}, ${m.firstName}`,nameForTile:m=>`${m.lastName}, ${m.firstName}`,getMemberRoles:m=>[...(m.roles||[]).filter(r=>r!=='Maschinist'),...((m.machinistVehicles||[]).some(v=>['LF','TSF'].includes(v))?['Maschinist']:[])],AVAILABLE_ROLES:['GF','Maschinist','Melder','ATF','ATM','WTF','WTM','STF','STM']});
 vm.runInContext(fs.readFileSync(require.resolve('../js/features/statistics/statistics.js'),'utf8'),c);return c;
}
const member=(id,extra={})=>({id,firstName:id,lastName:'Beispiel',roles:[],...extra});
const as={breathingQualified:true,g263ValidUntil:'2030-12-31',agtInstructionValidUntil:'2030-12-31',ffiValidUntil:'2030-12-31'};
test('Gleiche Einsatzarten werden unabhängig von Ort, Leerzeichen und Großschreibung zusammengefasst',()=>{
 const c=fixture([]),operation=(type,topic='')=>({item:{sessionType:'Einsatz',operationData:type?{type}:undefined,topic},rows:[]});
 const result=c.statisticsOperationTypeEntries([operation('Brand'),operation(' brand  '),operation('BRAND'),operation('', 'Brand · Anderer Ort'),operation('Technische  Hilfe'),operation('technische Hilfe'),operation('Sonstiges'),{item:{sessionType:'Sonderprobe',topic:'Brand'},rows:[]}]);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),[['Brand',4],['Technische Hilfe',2],['Sonstiges',1]]);
});
test('Heutige Nachweise: bald fällig bleibt gültig; abgelaufen, fehlend und Zukunftsprüfung nicht freigeben',()=>{
 const roster=[member('valid',{...as,roles:['ATF','ATM','WTF'],machinistVehicles:['LF'],driverLicenseCheckedOn:'2026-10-01'}),member('soon',{...as,ffiValidUntil:'2026-11-01'}),member('expired',{...as,g263ValidUntil:'2026-10-24'}),member('missing',{...as,ffiValidUntil:''}),member('not-as',{breathingQualified:false,...{g263ValidUntil:'2030-12-31'}}),member('age',{...as,ageDepartment:true}),member('future-driver',{machinistVehicles:['TSF'],driverLicenseCheckedOn:'2026-10-26'}),member('old-driver',{machinistVehicles:['LF'],driverLicenseCheckedOn:'2020-01-01'}),member('unknown-driver',{machinistVehicles:['TSF']})];
 const c=fixture(roster),before=JSON.stringify(roster),r=c.statisticsCurrentReadiness(roster,'2026-10-25');
 assert.deepEqual(JSON.parse(JSON.stringify([r.breathing.total,r.breathing.eligible,r.breathing.valid,r.breathing.soon,r.breathing.expired,r.breathing.missing])),[4,2,1,1,1,1]);
 assert.equal(r.drivers.total,4);assert.equal(r.drivers.eligible,1);assert.equal(r.drivers.missing,2);assert.equal(r.drivers.expired,1);
 assert.equal(r.crew.find(g=>g.label==='Angriffstrupp').count,1,'ATF + ATM counts one person');assert.equal(r.crew.find(g=>g.label==='Wassertrupp').count,1,'same qualified person may cover another role');
 assert.equal(r.crew.find(g=>g.label==='Maschinisten').count,1);assert.equal(JSON.stringify(roster),before);
});
test('Teilnahme und Bestenliste verwenden betreffende Übungen, eindeutige Namen und keine Sitzungen oder Einsätze',()=>{
 const a=member('Anna'),b=member('Ben'),age=member('Alt',{ageDepartment:true}),c=fixture([a,b,age]);
 const row=(m,status)=>({name:`${m.lastName}, ${m.firstName}`,status});
 const data=(type,rows)=>({item:{sessionType:type},rows:rows.map(r=>({...r,sessionType:type}))});
 const result=c.statisticsParticipation([data('Allgemeine Probe',[row(a,'Anwesend'),row(a,'Anwesend'),row(b,'Entschuldigt'),row(age,'Anwesend')]),data('Sonderprobe',[row(a,'Betrifft nicht'),row(b,'Anwesend')]),data('Unterricht',[{name:' Anna   Beispiel ',status:'Fehlt'}]),data('Ausschuss Sitzung',[row(a,'Anwesend')]),data('Einsatz',[row(a,'Anwesend')])]);
 assert.equal(result.drills.length,3);assert.equal(result.rows.length,4);assert.equal(result.present,2);assert.equal(result.excused,1);assert.equal(result.missing,1);
 assert.equal(result.people[0].relevant,2);assert.equal(result.people[0].percent,50);assert.equal(result.people[1].relevant,2);
 c.members.push(member('Anna',{id:'duplicate'}));assert.equal(c.statisticsParticipation([data('Probe',[row(a,'Anwesend')])]).rows.length,0,'ambiguous names are not attributed');
});
test('Funktionsziele zählen Probe und Einsatz, aber keine Sonderprobe; Truppziel verlangt alle persönlichen Teilziele',()=>{
 const a=member('Anna',{roles:['ATF','ATM']}),b=member('Ben',{roles:['ATF']}),c=fixture([a,b]);
 const data=(type,role)=>({item:{sessionType:type},rows:[{name:'Beispiel, Anna',sessionType:type,status:'Anwesend',role}]});
 const rows=c.statisticsFunctionTargets([data('Allgemeine Probe','ATF'),data('Einsatz','ATM'),data('Sonderprobe','ATF')],[a,b],{ATF:1,ATM:1});
 const group=c.statisticsGoalGroups(rows).find(g=>g.label==='Angriffstrupp');assert.equal(group.complete,1);assert.equal(group.total,2);assert.equal(rows.find(r=>r.name==='Beispiel, Anna'&&r.role==='ATF').actual,1);
 const unmet=c.statisticsGoalGroups(c.statisticsFunctionTargets([data('Allgemeine Probe','ATF')],[a],{ATF:1,ATM:1}))[0];assert.equal(unmet.complete,0);
 assert.equal(c.statisticsGoalGroups(c.statisticsFunctionTargets([],[a,b],{})).length,0);
});
