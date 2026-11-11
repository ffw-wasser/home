const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),fs=require('node:fs');
const {fixture}=require('./helpers/portal-fixture.cjs');
const bytes=Buffer.from([255,216,255,65,255,217]);
const material=()=>({schemaVersion:1,title:'Synthetische Funkhilfe',steps:Array.from({length:6},(_,i)=>'Testschritt '+i),groups:[{mode:'TMO',code:'TESTGRUPPE',label:'Nur erfundene Daten'}],notes:['Synthetischer Hinweis'],image:{mime:'image/jpeg',base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')}});
test('Funkunterlagen: verschlüsselt, versionsgeschützt, nur für verifizierte aktive Feuerwehrmitglieder',async()=>{
 const f=await fixture(),m=material();assert.equal((await f.call('training')).status,404);
 assert.equal((await f.call('training',{material:m,expectedVersion:0})).status,404,'members cannot upload');
 assert.equal((await f.call('training',{material:m,expectedVersion:0,source:'wrong'},null,true)).status,409);
 assert.equal((await f.call('training',{material:m,expectedVersion:0},null,true)).status,200);
 const row=f.sql.prepare('SELECT payload FROM portal_training').get();assert.ok(!row.payload.includes(m.title)&&!row.payload.includes(m.image.base64));
 assert.deepEqual((await f.call('training')).value.material,m);
 assert.equal((await f.call('training',{material:m,expectedVersion:0},null,true)).status,409);
 assert.equal((await f.call('training',{}, {...f.people[0],testToken:'invalid'})).status,401);
 await f.call('roster',{members:f.people.map((p,i)=>({id:p.memberId,name:'Testperson '+i,leader:false,fitnessTrainer:i===1}))},null,true);
 assert.equal((await f.call('training',{},f.people[1])).status,403,'guests have no training access');
 const rosterRow=f.sql.prepare('SELECT payload FROM portal_roster WHERE id=1').get(),roster=await f.L.open(f.env,rosterRow.payload,'portal-roster');roster.members=roster.members.filter(p=>p.id!==f.people[0].memberId);await f.DB.prepare('UPDATE portal_roster SET payload=? WHERE id=1').bind(await f.L.seal(f.env,roster,'portal-roster')).run();
 assert.equal((await f.call('training')).status,403,'roster removal blocks existing session');
 await f.DB.prepare('DELETE FROM accounts WHERE alias=?').bind(f.people[2].alias).run();assert.equal((await f.call('training',{},f.people[2])).status,401);
 const legacy=await fixture({authenticated:false});assert.equal((await legacy.call('training')).status,401,'old capability is not a verified identity session');
});
test('Funkunterlagen: falsche Bilddaten und unvollständige Pakete werden nicht veröffentlicht',async()=>{
 const f=await fixture();for(const change of [m=>m.steps.pop(),m=>m.groups[0].mode='OTHER',m=>m.image.sha256='0'.repeat(64),m=>m.image.mime='text/html',m=>m.image.base64='!!!!']){const m=material();change(m);assert.equal((await f.call('training',{material:m,expectedVersion:0},null,true)).status,400);}
 assert.equal((await f.call('training')).status,404);
});
test('Funkunterlagen: öffentliche Dateien enthalten nur den Abruf, keine Importdatei oder persistenten Inhalte',()=>{
 const html=fs.readFileSync('deckel.html','utf8'),sw=fs.readFileSync('service-worker.js','utf8');assert.match(html,/Geschützte Ausbildungsunterlagen/);assert.doesNotMatch(html,/Mayday, Mayday, Mayday|309_F\*|FW EM BG/);assert.doesNotMatch(html+sw,/mxp600-kurzanleitung-wasser\.jpeg|H2O-Funk-Mitglieder-Import/);
 const ui=fs.readFileSync('js/features/portal/portal-training.js','utf8');assert.doesNotMatch(ui,/localStorage|indexedDB|caches\./);assert.match(ui,/URL\.revokeObjectURL/);assert.match(ui,/current!==epoch/);
});
test('Gesamte Ausbildungsbibliothek bleibt verschlüsselt und ist nur nach verifizierter Anmeldung lesbar',async()=>{const f=await fixture(),m={...material(),library:require('./helpers/training-library.cjs').library,edition:'test-1'};assert.equal((await f.call('training',{material:m,expectedVersion:0},null,true)).status,200);assert.equal((await f.call('training',{},null,true)).value.edition,'test-1');assert.deepEqual((await f.call('training')).value.material.library,m.library);assert.ok(!f.sql.prepare('SELECT payload FROM portal_training').get().payload.includes('synthetische geschützte Lerninhalte'));const bad={...m,library:{...m.library,'more-training':'<section><script>alert(1)</script></section>'}};assert.equal((await f.call('training',{material:bad,expectedVersion:1},null,true)).status,400);assert.equal((await f.call('training')).value.version,1);});
