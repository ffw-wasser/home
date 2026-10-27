const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/portal-fixture.cjs');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('js/features/portal/calendar-model.js','utf8'),context);const G=context.PortalGroups;
const roster={members:[{id:'a',agt:true,leader:true,committeeMember:false},{id:'b',agt:true,committeeMember:true},{id:'c',leader:true},{id:'d',ageDepartment:true}]};
const resolve=(title,groups=G.defaults())=>Array.from(G.resolve(title,groups,roster).recipientIds).sort();
test('Gruppen: aktive Mitglieder, Atemschutz-Komposita, Schreibvarianten und Wortgrenzen',()=>{
 assert.deepEqual(resolve('Probe'),['a','b','c']);assert.deepEqual(resolve('Unbekannter Termin'),['a','b','c']);
 for(const title of ['Atemschutzprobe','Sonderprobe Atemschutz','AGT','AS-Probe','atemschutz-Übung'])assert.deepEqual(resolve(title),['a','b']);
 for(const title of ['Gruppenführer Probe','GRUPPENFUEHRER','Gruppenfuhrerprobe','GF Probe'])assert.deepEqual(resolve(title),['a','c']);
 assert.deepEqual(resolve('GFahrzeuge'),['a','b','c']);assert.deepEqual(resolve('Altersabteilung'),['d']);
 assert.deepEqual(resolve('Ausschusssitzung'),['b']);
});
test('Gruppen: eigene Regeln kombinieren spezifische Gruppen ohne doppelte Mitgliedschaften',()=>{
 const groups=G.defaults();groups.push({id:'mach',name:'Maschinisten',source:'manual',memberIds:['b','c','removed'],enabled:true,general:false,keywords:['Maschinisten']});
 assert.deepEqual(resolve('Maschinisten Sonderprobe',groups),['b','c']);assert.deepEqual(resolve('Atemschutz GF Probe',groups),['a','b','c']);
 groups.find(g=>g.id==='agt').memberIds=['d'];assert.deepEqual(resolve('Atemschutz',groups),['a','b'],'Kennzeichen hat Vorrang vor ungenutzten manuellen IDs');
 groups.find(g=>g.id==='agt').enabled=false;assert.deepEqual(resolve('Atemschutz GF',groups),['a','c']);
});
test('Gruppen: doppelte normalisierte Begriffe und ungültige Zuordnungen werden abgewiesen',()=>{
 const groups=G.defaults();groups[1].keywords.push('gruppenfuehrer');assert.throws(()=>G.validate(groups),/mehrfach/);
 assert.throws(()=>G.validate([{...G.defaults()[0],memberIds:['a','a']}]),/doppelt/);
});
async function setup(){const f=await fixture();await f.call('roster',{members:f.people.map((p,i)=>({id:p.memberId,name:'Synthetisch '+i,leader:i===0,agt:i<2,committeeMember:i===2,ageDepartment:i===4}))},null,true);return f;}
const list=async f=>(await f.call('list',{},null,true)).value;
async function automatic(f){const cal=await list(f),event=cal.events[0];return f.call('classify',{eventId:event.id,kind:'probe',sessionType:'Sonderprobe',approved:true,recipientMode:'automatic',expectedVersion:cal.rulesVersion,expectedGroupsVersion:cal.groupsVersion},null,true);}
async function rename(f,title){const row=f.sql.prepare('SELECT * FROM portal_calendar WHERE id=1').get(),cal=await f.L.open(f.env,row.payload,'portal-calendar');cal.events[0].title=title;f.sql.prepare('UPDATE portal_calendar SET payload=? WHERE id=1').run(await f.L.seal(f.env,cal,'portal-calendar'));}
test('Gruppen-API: nur Admin, verschlüsselt, dauerhafte IDs, konkurrierende Versionen und dynamische Kennzeichen',async()=>{
 const f=await setup(),g=(await f.call('groups',{},null,true)).value;assert.equal(g.version,0);assert.equal(g.groups.find(g=>g.id==='committee').source,'committee');
 assert.notEqual((await f.call('groups')).status,200);
 assert.equal((await f.call('groups',{groups:g.groups,expectedVersion:0},null,true)).status,200);
 assert.equal((await f.call('groups',{groups:g.groups,expectedVersion:0},null,true)).status,409);
 const stored=f.sql.prepare('SELECT payload FROM portal_groups WHERE id=1').get().payload;assert.ok(!stored.includes('Atemschutz'));
 const bad=structuredClone(g.groups);bad[1].keywords.push('GF');assert.equal((await f.call('groups',{groups:bad,expectedVersion:1},null,true)).status,400);
 await rename(f,'Ausschusssitzung');await automatic(f);assert.deepEqual((await list(f)).events[0].recipientIds,['member-3']);
});
test('Einführung: bestehende null- und eingeschränkte Listen sowie Rückmeldungen bleiben geschützt',async()=>{
 const f=await setup(),before=await list(f),id=before.events[0].id;
 assert.equal(before.events[0].recipientMode,'legacy');assert.equal(before.events[0].recipientIds,null);
 assert.equal((await f.call('reply',{eventId:id,status:'yes',expectedVersion:0,requestId:require('node:crypto').randomUUID()})).status,200);
 const groups=(await f.call('groups',{},null,true)).value;await f.call('groups',{groups:groups.groups,expectedVersion:0},null,true);await rename(f,'Atemschutzprobe');
 assert.equal((await list(f)).events[0].recipientIds,null);
 const cal=await list(f);await f.call('classify',{eventId:id,kind:'probe',approved:true,recipientIds:['member-1'],expectedVersion:cal.rulesVersion},null,true);
 await rename(f,'Probe');const after=await list(f);assert.equal(after.events[0].recipientMode,'manual');assert.deepEqual(after.events[0].recipientIds,['member-1']);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_replies').get().n,1);
});
test('Automatik ohne Freigabeschritt, manuelle Korrektur, Gruppenänderung und serverseitige Berechtigung',async()=>{
 const f=await setup();await rename(f,'Sonderprobe Atemschutz');assert.equal((await automatic(f)).status,200);
 let cal=await list(f),event=cal.events[0];assert.equal(event.sessionType,'Sonderprobe');assert.equal(event.recipientMode,'automatic');assert.deepEqual(event.recipientIds,['member-1','member-2']);
 assert.equal((await f.call('reply',{eventId:event.id,status:'yes',expectedVersion:0,requestId:require('node:crypto').randomUUID()},f.people[2])).status,404);
 const own=(await f.call('list',{eventId:event.id},f.people[2])).value;assert.equal(own.eventLinkStatus,'not-relevant');assert.equal(own.events.length,0);
 await f.call('classify',{eventId:event.id,kind:'probe',sessionType:'Sonderprobe',approved:true,recipientMode:'manual',recipientIds:['member-3'],expectedVersion:cal.rulesVersion},null,true);
 await rename(f,'Probe');event=(await list(f)).events[0];assert.deepEqual(event.recipientIds,['member-3']);assert.equal(event.sessionType,'Sonderprobe');
 assert.equal((await automatic(f)).status,200);assert.deepEqual((await list(f)).events[0].recipientIds,['member-1','member-2','member-3','member-4']);
});
test('Automatik: leere spezifische Gruppe bleibt leer und fehlende oder defekte Gruppendaten öffnen keinen Zugriff',async()=>{
 const f=await setup(),groups=(await f.call('groups',{},null,true)).value.groups;groups.push({id:'empty',name:'Leere Gruppe',source:'manual',memberIds:[],keywords:['Spezial'],enabled:true,general:false});
 await f.call('groups',{groups,expectedVersion:0},null,true);await rename(f,'Spezial Probe');assert.equal((await automatic(f)).status,200);assert.deepEqual((await list(f)).events[0].recipientIds,[]);
 f.sql.prepare('DELETE FROM portal_groups').run();assert.deepEqual((await list(f)).events[0].recipientIds,[]);
 f.sql.prepare("INSERT INTO portal_groups(id,payload,version) VALUES(1,'broken',1)").run();assert.notEqual((await f.call('list',{},null,true)).status,200);
});
test('Automatik: aktuelle Kennzeichen folgen neuen und entfernten Mitgliedern; Gruppen-CAS verhindert veraltete Auswahl',async()=>{
 const f=await setup();await rename(f,'Atemschutzprobe');await automatic(f);const before=await list(f),groups=(await f.call('groups',{},null,true)).value;
 await f.call('groups',{groups:groups.groups,expectedVersion:0},null,true);
 assert.equal((await f.call('classify',{eventId:before.events[0].id,kind:'probe',approved:true,recipientMode:'automatic',expectedGroupsVersion:0,expectedVersion:before.rulesVersion},null,true)).status,409);
 await f.call('roster',{members:f.people.slice(1).map(p=>({id:p.memberId,name:'Test '+p.memberId,leader:false,agt:true}))},null,true);
 assert.deepEqual((await list(f)).events[0].recipientIds,['member-2','member-3','member-4','member-5']);
});
test('D1 und CPU: Gruppenerkennung liest eine Konfiguration pro Projektion, Index vermeidet Regeln-mal-Termine-Suche',async()=>{
 const f=await setup(),prepare=f.DB.prepare;let reads=0;f.DB.prepare=function(q){if(q.includes('SELECT * FROM portal_groups'))reads++;return prepare.call(this,q);};await list(f);assert.equal(reads,1);
 const groups=G.defaults();for(let i=0;i<90;i++)groups.push({id:'g'+i,name:'Gruppe '+i,source:'manual',memberIds:['a'],keywords:Array.from({length:20},(_,k)=>'Begriff'+i+'x'+k),general:false,enabled:true});
 const compiled=G.resolver(G.validate(groups),roster);const start=performance.now();for(let i=0;i<500;i++)assert.deepEqual(Array.from(compiled('Sonderprobe Begriff'+(i%90)+'x3').recipientIds),['a']);assert.ok(performance.now()-start<1000);
});
test('Neue Kalenderdaten erhalten automatisch Empfänger, unabhängig von der Terminfreigabe',async()=>{
 const f=await setup();f.sql.prepare('DELETE FROM portal_rules').run();await rename(f,'Sonderprobe Atemschutz');
 const event=(await list(f)).events[0];assert.equal(event.recipientMode,'automatic');assert.equal(event.approved,false);assert.equal(event.sessionType,'Sonderprobe');assert.deepEqual(event.recipientIds,['member-1','member-2']);
});
test('Zwei gleichzeitige Gruppenschreibvorgänge bestätigen höchstens eine Version',async()=>{
 const f=await setup(),groups=(await f.call('groups',{},null,true)).value.groups;
 const results=await Promise.all([f.call('groups',{groups,expectedVersion:0},null,true),f.call('groups',{groups:groups.map(g=>({...g,name:g.name+' neu'})),expectedVersion:0},null,true)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await f.call('groups',{},null,true)).value.version,1);
});
test('Ältere Administrationsaufrufe ohne Empfängerangabe erweitern automatische eingeschränkte Termine nicht',async()=>{
 const f=await setup();await rename(f,'Atemschutzprobe');await automatic(f);const cal=await list(f);
 assert.equal((await f.call('classify',{eventId:cal.events[0].id,kind:'probe',approved:true,expectedVersion:cal.rulesVersion},null,true)).status,200);
 assert.deepEqual((await list(f)).events[0].recipientIds,['member-1','member-2']);
});

test('Anklickbare Gruppen: dynamische Mehrfachauswahl, Ergänzung, Ausschluss und private Metadaten',async()=>{
 const f=await fixture(),cal=(await f.call('list',{},null,true)).value,groups=(await f.call('groups',{},null,true)).value;
 const selected=groups.groups.filter(g=>g.source==='active'||g.source==='leader').map(g=>g.id);
 const saved=await f.call('classify',{eventId:cal.events[0].id,kind:'probe',approved:true,recipientMode:'groups',groupIds:selected,includeIds:[],excludeIds:['member-2'],expectedVersion:cal.rulesVersion,expectedGroupsVersion:groups.version},null,true);
 assert.equal(saved.status,200,JSON.stringify(saved.value));assert.equal(saved.value.recipientIds.includes('member-2'),false);
 assert.equal((await f.call('list',{},f.people[1])).value.events.length,0);
 const own=(await f.call('list')).value.events[0];for(const key of ['groupIds','includeIds','excludeIds','recipientIds'])assert.equal(own[key],undefined,key);
 // Changing a member's department changes the selected group without resaving the event.
 await f.call('roster',{members:f.people.map((p,i)=>({id:p.memberId,name:'Synthetic '+i,leader:i===0,ageDepartment:i===2}))},null,true);
 const after=(await f.call('list',{},null,true)).value.events[0];assert.equal(after.recipientIds.includes('member-3'),false);
 const state=(await f.call('list',{},null,true)).value;
 assert.equal((await f.call('classify',{eventId:after.id,kind:'probe',approved:true,recipientMode:'groups',groupIds:['missing-group'],includeIds:[],excludeIds:[],expectedVersion:state.rulesVersion,expectedGroupsVersion:groups.version},null,true)).status,400);
 assert.equal((await f.call('classify',{eventId:after.id,kind:'probe',approved:true,recipientMode:'groups',groupIds:selected,includeIds:[],excludeIds:[],expectedVersion:state.rulesVersion,expectedGroupsVersion:999},null,true)).status,409);
});
