const test=require('node:test'),assert=require('node:assert/strict'),E=require('../js/features/portal/member-evidence.js');
const now=Date.parse('2026-10-16T06:00:00Z');
test('Nur relevante persönliche Nachweise; bestehende Atemschutzdaten bleiben erkannt',()=>{
 assert.deepEqual(E.project({}),{version:1,medical:{g262:'',g263:''},breathing:null,driver:null});
 assert.equal(E.project({g263ValidUntil:'2027-01-01'}).breathing,null);
 assert.equal(E.project({breathingClearanceUntil:'2027-01-01'}).breathing,null);
 assert.ok(E.project({breathingClearance:true,agtInstructionValidUntil:'2027-01-01'}).breathing);
 assert.equal(E.project({breathingQualified:false,g263ValidUntil:'2027-01-01'}).breathing,null);
 assert.ok(E.project({breathingQualified:true}).breathing);
 assert.equal(E.project({ageDepartment:true,breathingQualified:true,machinistVehicles:['LF']}).driver,null);
 const e=E.project({machinistVehicles:['LF','LF','TSF'],driverLicenseCheckedOn:'2026-05-01',driverLicenseIntervalMonths:6});assert.deepEqual(e.driver.vehicles,['LF','TSF']);assert.equal(e.driver.intervalMonths,6);
});
test('Atemschutz zeigt fehlende, abgelaufene und bald fällige Nachweise getrennt; Frist gilt bis Tagesende',()=>{
 let group=E.assess(E.project({breathingQualified:true,g263ValidUntil:'2026-10-15',agtInstructionValidUntil:'2026-10-16'}),now)[0];
 assert.equal(group.status,'expired');assert.deepEqual(group.items.map(i=>i.status),['expired','soon','missing']);
 group=E.assess(E.project({breathingQualified:true,g263ValidUntil:'2026-12-16',agtInstructionValidUntil:'2026-12-15',ffiValidUntil:'2028-01-01'}),now)[0];assert.equal(group.status,'soon');assert.deepEqual(group.items.map(i=>i.status),['valid','soon','valid']);
 assert.equal(E.assess(E.project({breathingQualified:true}),now)[0].status,'missing');
});
test('Führerscheinkontrolle: Monatsende, Schaltjahr, frei wählbares Intervall und ungültiges Kontrolldatum',()=>{
 assert.equal(E.due('2024-02-29',12),'2025-02-28');assert.equal(E.due('2026-01-31',1),'2026-02-28');assert.equal(E.due('2026-05-01',6),'2026-11-01');
 assert.equal(E.date('2026-02-30'),'');assert.equal(E.date('nonsense'),'');assert.equal(E.due('2026-02-30'), '');
 for(const [checked,interval,status] of [['',12,'missing'],['2025-10-15',12,'expired'],['2025-10-16',12,'soon'],['2026-10-17',12,'missing'],['2026-05-01',6,'soon'],['2026-09-01',12,'valid']]){const group=E.assess(E.project({machinistVehicles:['LF'],driverLicenseCheckedOn:checked,driverLicenseIntervalMonths:interval}),now).find(g=>g.title==='Führerscheinkontrolle');assert.equal(group.status,status,checked);}
 assert.equal(E.day(Date.parse('2026-10-15T22:30:00Z')),'2026-10-16');
});
test('Private Projektion enthält nur freigegebene Felder und lehnt falsche Daten ab',()=>{
 const projection=E.project({firstName:'PRIVATE-NAME',medicalDocument:'PRIVATE-DOC',breathingQualified:true,g263ValidUntil:'2027-01-01'});
 assert.ok(!JSON.stringify(projection).includes('PRIVATE'));
 assert.deepEqual(E.validate({...projection,secret:'PRIVATE'}),projection);
 for(const value of [{},null,{version:1,breathing:{g263:'2026-02-30',instruction:'',ffi:''},driver:null},{version:1,breathing:null,driver:{checkedOn:'',intervalMonths:0,vehicles:['LF']}}])assert.throws(()=>E.validate(value));
});

test('G26.2 ist der Mindestnachweis aller anderen; gültige G26.3 ersetzt sie, umgekehrt nicht',()=>{
 const check=m=>E.assess(E.project({breathingQualified:false,...m}),now).find(g=>g.title==='Arbeitsmedizinische Eignung');
 assert.equal(check({}).status,'missing');assert.equal(check({ageDepartment:true}).status,'missing');
 assert.equal(check({g262ValidUntil:'2028-01-01'}).status,'valid');
 const higher=check({g263ValidUntil:'2028-01-01'});assert.equal(higher.status,'valid');assert.match(higher.items[0].label,/ersetzt G26.2/);assert.ok(higher.items[0].substitution);
 assert.equal(check({g262ValidUntil:'2020-01-01',g263ValidUntil:'2028-01-01'}).status,'valid');
 const lower=check({g262ValidUntil:'2028-01-01',g263ValidUntil:'2020-01-01'});assert.equal(lower.status,'valid');assert.equal(lower.items[0].substitution,undefined);
 assert.equal(check({g263ValidUntil:'2020-01-01'}).status,'expired');
 const agt=E.assess(E.project({breathingQualified:true,g262ValidUntil:'2028-01-01',agtInstructionValidUntil:'2028-01-01',ffiValidUntil:'2028-01-01'}),now)[0];assert.equal(agt.status,'missing');assert.equal(agt.items[0].label,'G26.3');
});

test('Ehemalige AGT behalten G26.3 als Mindestnachweis, ohne AGT-Pflichten oder Freigabe',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const m={breathingQualified:false,roles:['ATM','ATG'],breathingClearance:true,g263ValidUntil:'2028-01-01',agtInstructionValidUntil:'2020-01-01',ffiValidUntil:''};
 const before=JSON.stringify(m),groups=E.assess(E.project(m),now);
 assert.equal(groups.length,1);assert.equal(groups[0].title,'Arbeitsmedizinische Eignung');assert.equal(groups[0].status,'valid');
 assert.match(groups[0].items[0].label,/G26.3.*ersetzt G26.2/);
 const c=vm.createContext({MemberEvidence:E,document:{getElementById(){}},window:{},console});
 vm.runInContext(fs.readFileSync('js/core/config.js','utf8'),c);
 const app=fs.readFileSync('js/app/app.js','utf8');
 vm.runInContext(app.match(/function isAtmOrAtgQualified\(member\)\{[^\n]+/)[0],c);
 assert.equal(c.isAtmOrAtgQualified(m),false);
 assert.equal(c.hasValidBreathingClearance(m,'2026-10-16'),false);
 assert.equal(c.breathingClearanceState(m,'2026-10-16'),'none');
 assert.equal(E.assess(E.project({...m,breathingQualified:true}),now)[0].status,'expired');
 assert.equal(JSON.stringify(m),before);
});
