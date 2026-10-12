const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=__dirname+'/../',read=p=>fs.readFileSync(root+p,'utf8');
test('Monatsbonus wird getrennt und idempotent gespeichert; verlorene Antwort bleibt identisch prüfbar',async()=>{
 const f=fixture(true),calls=[];let policy=null,lose=true;f.c.DrinksCentral={connection:async()=>({source:'drive:root',origin:'https://test.account.workers.dev'})};f.c.DrinksPush={request:async(c,path,data)=>{if(path.endsWith('/status'))return {revision:null,count:0,soloPolicy:policy};calls.push(structuredClone(data));policy={revision:data.revision,awardUnits:data.awardUnits};if(lose){lose=false;throw new TypeError('Network');}return {ok:true,soloPolicy:policy};}};
 f.replace(f.M.prepare(f.M.empty(),f.input));await f.c.DrinksQuizQuestions.load();f.nodes.get('quiz-solo-points').value='2';await f.nodes.get('quiz-solo-save').onclick();assert.equal(f.writes.length,0);assert.equal(f.nodes.get('quiz-retry').hidden,false);assert.equal(f.c.DrinksQuizQuestions.beforeView('drinksView'),false);await f.nodes.get('quiz-retry').onclick();assert.deepEqual(calls[0],calls[1]);assert.equal(policy.awardUnits,300);assert.equal(f.nodes.get('quiz-retry').hidden,true);assert.match(f.nodes.get('quiz-solo-status').textContent,/2 Treuepunkte/);
});
test('Ungültiger Bonus und Admin-Sperre senden keine Punkte-Einstellungen',async()=>{const f=fixture(true),calls=[];f.c.DrinksCentral={connection:async()=>({source:'drive:root',origin:'https://test.account.workers.dev'})};f.c.DrinksPush={request:async(c,path,data)=>{if(path.endsWith('/status'))return {revision:null,count:0,soloPolicy:null};calls.push(data);return {};}};f.replace(f.M.prepare(f.M.empty(),f.input));await f.c.DrinksQuizQuestions.load();for(const raw of ['0','101','1,5','-2']){f.nodes.get('quiz-solo-points').value=raw;await f.nodes.get('quiz-solo-save').onclick();}assert.equal(calls.length,0);f.c.adminUnlocked=false;f.c.DrinksQuizQuestions.lock();assert.equal(f.nodes.get('quiz-solo-points').value,'');assert.equal(f.nodes.get('quiz-published').textContent,'');await f.nodes.get('quiz-solo-save').onclick();assert.equal(calls.length,0);});
function fixture(ui=false){
 const nodes=new Map(),writes=[];let disk=null,tag=null,source='root',lost=false,failBefore=false,sequence=0;
 class Node{constructor(){this.children=[];this.dataset={};this.hidden=false;this.value='';this.checked=false;this.disabled=false;}set innerHTML(v){for(const m of v.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Node());}append(...v){this.children.push(...v);for(const n of v)if(n.id)nodes.set(n.id,n);}replaceChildren(){this.children=[];}querySelectorAll(){return [...nodes.entries()].filter(([id])=>/^quiz-(answer|category|text|explanation|source|correct|active|search|filter|new|import|cancel|save)/.test(id)).map(([,n])=>n);}focus(){}scrollIntoView(){}}
 const main=new Node();nodes.set('drinksSettingsQuizCard',new Node());
 const c=vm.createContext({Date,JSON,crypto:webcrypto,navigator:{onLine:true},adminUnlocked:true,oneDriveSessionEpoch:1,oneDriveAdministrationReady:()=>true,oneDriveSignedIn:()=>true,oneDriveResolveSharedRoot:async()=>({driveId:'drive',id:source}),requireAdmin:()=>c.adminUnlocked,showToast(){},confirm:()=>true,addEventListener(){},showView:()=>{},console});c.window=c;
 if(ui)c.document={readyState:'complete',createElement:()=>new Node(),getElementById:id=>nodes.get(id),querySelector:()=>main};
 const error=status=>Object.assign(Error('HTTP '+status),{status});
 c.odFetch=async(url,options={})=>{
  if(options.method==='PUT'){
   if(failBefore){failBefore=false;throw new TypeError('Network');}
   if(options.headers['If-Match']!==(tag||'"0"'))throw error(412);
   writes.push({url,options});disk=JSON.parse(options.body);tag='"'+(++sequence)+'"';if(lost){lost=false;throw new TypeError('Network');}return {json:async()=>({id:'file',eTag:tag})};
  }
  if(url.includes(':/Getraenke?'))return {json:async()=>({id:'folder',folder:{}})};
  if(url.includes('challenge-fragen.json?')||url.includes('/items/file?$')){if(!disk)throw error(404);return {json:async()=>({id:'file',eTag:tag,file:{}})};}
  if(url.endsWith('/items/file/content'))return {json:async()=>structuredClone(disk)};
  throw Error('Unexpected URL '+url);
 };
 vm.runInContext(read('js/features/drinks/drinks-quiz-model.js'),c);vm.runInContext(read('js/features/drinks/drinks-quiz-admin.js'),c);
 if(ui)nodes.get('quiz-filter').value='all';
 const M=c.DrinksQuizModel,S=c.DrinksQuizQuestions.store,input={level:'TM',topic:'Gerätekunde',category:'LF10',text:'Beispielfrage?',answers:['eins','zwei','drei','vier'],correct:1,explanation:'Lösung',source:'Vor Ort',active:true};
 return {c,nodes,M,S,input,writes,disk:()=>disk,lose:()=>lost=true,fail:()=>failBefore=true,source:v=>source=v,replace:bank=>{disk=structuredClone(bank);tag='"'+(++sequence)+'"';}};
}
const plan=(old,bank)=>({bank,eTag:old.eTag,revision:old.bank.revision,source:old.source});
test('Gesamtfreigabe aktualisiert nur Entwürfe und weist fehlende Zuordnung atomar ab',()=>{
 const f=fixture(),M=f.M;let bank=M.empty();bank=M.prepare(bank,{...f.input,active:true});bank=M.prepare(bank,{...f.input,text:'Zweite Frage',active:false});const original=structuredClone(bank),result=f.S.prepareApproval(bank);assert.equal(result.approved,1);assert.ok(result.bank.questions.every(q=>q.active));assert.deepEqual(result.bank.questions[0],bank.questions[0]);assert.equal(result.bank.questions[1].version,bank.questions[1].version+1);assert.equal(result.bank.questions[1].id,bank.questions[1].id);assert.equal(JSON.stringify(bank),JSON.stringify(original));assert.equal(f.S.prepareApproval(result.bank).approved,0);assert.equal(f.S.prepareApproval(M.empty()).approved,0);assert.throws(()=>f.S.prepareApproval({...bank,questions:[bank.questions[0],{...bank.questions[1],level:null}]}),/nichts freigegeben/);assert.equal(bank.questions[1].active,false);
});
test('Alle Fragen freigeben betrifft den gesamten Katalog trotz Suchfilter und schreibt nur einmal',async()=>{
 const f=fixture(true),M=f.M;let bank=M.prepare(M.empty(),{...f.input,active:false});bank=M.prepare(bank,{...f.input,text:'Andere Kategorie',category:'Technik',active:false});f.replace(bank);await f.c.DrinksQuizQuestions.load();f.nodes.get('quiz-search').value='Beispielfrage';f.nodes.get('quiz-search').oninput();assert.equal(f.nodes.get('quiz-list').children.length,1);await f.nodes.get('quiz-approve-all').onclick();assert.equal(f.writes.length,1);assert.equal(f.disk().questions.filter(q=>q.active).length,2);assert.equal(f.nodes.get('quiz-approve-all').disabled,true);assert.match(f.nodes.get('quiz-status').textContent,/2 Fragen gemeinsam freigegeben/);await f.nodes.get('quiz-approve-all').onclick();assert.equal(f.writes.length,1);
});
test('Nicht bestätigte Gesamtfreigabe wird identisch erneut geprüft; parallele Änderungen bleiben erhalten',async()=>{
 const f=fixture(true),bank=f.M.prepare(f.M.empty(),{...f.input,active:false});f.replace(bank);await f.c.DrinksQuizQuestions.load();f.fail();await f.nodes.get('quiz-approve-all').onclick();assert.equal(f.nodes.get('quiz-retry').hidden,false);assert.equal(f.disk().questions[0].active,false);await f.nodes.get('quiz-retry').onclick();assert.equal(f.writes.length,1);assert.equal(f.disk().questions[0].active,true);assert.match(f.nodes.get('quiz-status').textContent,/gemeinsam freigegeben/);
 const stale=fixture(true),old=stale.M.prepare(stale.M.empty(),{...stale.input,active:false});stale.replace(old);await stale.c.DrinksQuizQuestions.load();const newer=stale.M.prepare(old,{...stale.input,text:'Parallel geändert',active:false},old.questions[0].id);stale.replace(newer);await stale.nodes.get('quiz-approve-all').onclick();assert.equal(stale.writes.length,0);assert.equal(stale.disk().questions[0].text,'Parallel geändert');assert.equal(stale.disk().questions[0].active,false);
});
test('Abbruch, offene Bearbeitung und Admin-Sperre verhindern Gesamtfreigabe',async()=>{
 const f=fixture(true);f.replace(f.M.prepare(f.M.empty(),{...f.input,active:false}));await f.c.DrinksQuizQuestions.load();f.c.confirm=()=>false;await f.nodes.get('quiz-approve-all').onclick();assert.equal(f.writes.length,0);f.c.confirm=()=>true;f.nodes.get('quiz-form').oninput();await f.nodes.get('quiz-approve-all').onclick();assert.equal(f.writes.length,0);assert.match(f.nodes.get('quiz-status').textContent,/zuerst speichern/);f.c.DrinksQuizQuestions.lock();f.c.adminUnlocked=false;await f.nodes.get('quiz-approve-all').onclick();assert.equal(f.writes.length,0);
});
test('Profilstufe folgt höchster Funktion; Veröffentlichung verlangt Thema und Stufe',()=>{
 const f=fixture(),M=f.M;assert.equal(M.profileLevel({roles:['STM']}),'TM');assert.equal(M.profileLevel({roles:['WTF','ATM']}),'TF');assert.equal(M.profileLevel({roles:['STF','GF','STM']}),'GF');assert.equal(M.profileLevel({roles:['Melder','Maschinist']}),null);assert.equal(M.profileLevel(null),null);assert.throws(()=>M.prepare(M.empty(),{...f.input,level:null}),/Stufe|Ausbildungsstufe/);assert.throws(()=>M.prepare(M.empty(),{...f.input,topic:''}),/Thema/);assert.throws(()=>M.question({...M.prepare(M.empty(),f.input).questions[0],level:'admin'}));
});
test('Stufenvorlage ergänzt atomar, erhält bearbeitete und gelöschte Fragen und ist wiederholbar',()=>{
 const f=fixture(),M=f.M,bank=M.prepare(M.empty(),{...f.input,active:false}),q=bank.questions[0],variant=M.prepare(M.empty(),{...f.input,level:'GF',text:'GF Fall?',active:false}).questions[0],template={schemaVersion:1,updates:[{expected:q,level:'ALL',topic:'Gerätekunde'}],questions:[variant]},first=M.mergeLevels(bank,template);assert.equal(first.updated,1);assert.equal(first.added,1);assert.equal(first.bank.questions[0].level,'ALL');assert.equal(first.bank.questions[0].active,false);const again=M.mergeLevels(first.bank,template);assert.equal(again.updated,0);assert.equal(again.added,0);assert.equal(again.bank.revision,first.bank.revision);
 const edited=M.prepare(bank,{...f.input,text:'Örtlich angepasst',active:false},q.id),safe=M.mergeLevels(edited,template);assert.equal(safe.updated,0);assert.equal(safe.bank.questions[0].text,'Örtlich angepasst');const removed=M.remove(bank,q.id),other=M.mergeLevels(removed,template);assert.equal(other.bank.questions.some(x=>x.id===q.id),false);assert.throws(()=>M.mergeLevels(bank,{...template,questions:[{...variant,correct:7}]}));assert.equal(bank.questions[0].level,'TM');
});
test('Strenge Prüfung: Antworten, Lösung, Duplikate und Import werden atomar validiert',()=>{
 const f=fixture(),M=f.M;assert.throws(()=>M.prepare(M.empty(),{...f.input,correct:null}));assert.throws(()=>M.prepare(M.empty(),{...f.input,answers:['eins',' EINS ','drei','vier']}));
 const bank=M.prepare(M.empty(),f.input);assert.equal(bank.questions[0].version,1);const edit=M.prepare(bank,{...f.input,text:'Anders?'},bank.questions[0].id);assert.equal(edit.questions[0].version,2);assert.equal(edit.questions[0].id,bank.questions[0].id);
 const imported=M.importQuestions(M.empty(),{schemaVersion:1,questions:bank.questions});assert.equal(imported.added,1);assert.equal(imported.bank.questions[0].active,false);assert.notEqual(imported.bank.questions[0].id,bank.questions[0].id);assert.equal(M.importQuestions(imported.bank,{schemaVersion:1,questions:bank.questions}).added,0);
 assert.throws(()=>M.importQuestions(bank,{schemaVersion:1,questions:[bank.questions[0],{...bank.questions[0],correct:9}]}));assert.equal(bank.questions.length,1);
});
test('Leere Fragenbank lesen schreibt nichts; Speichern ist privat und bestätigt',async()=>{
 const f=fixture(),old=await f.S.read();assert.equal(old.bank.questions.length,0);assert.equal(f.writes.length,0);
 const next=f.M.prepare(old.bank,f.input),saved=await f.S.save(plan(old,next));assert.equal(saved.bank.revision,next.revision);assert.equal(f.writes.length,1);assert.match(f.writes[0].url,/challenge-fragen\.json/);assert.equal(f.writes[0].options.headers['If-Match'],'"0"');
});
test('Parallele Änderungen werden erhalten und ein veralteter Stand wird abgewiesen',async()=>{
 const f=fixture(),old=await f.S.read(),first=f.M.prepare(old.bank,f.input);await f.S.save(plan(old,first));const stale=f.M.prepare(old.bank,{...f.input,text:'Veraltet?'});
 await assert.rejects(f.S.save(plan(old,stale)),e=>e.code==='quizConflict');assert.equal(f.disk().revision,first.revision);assert.equal(f.writes.length,1);
});
test('Verlorene Serverantwort wird gelesen; erneute Prüfung schreibt keine Duplikate',async()=>{
 const f=fixture(),old=await f.S.read(),next=f.M.prepare(old.bank,f.input),p=plan(old,next);f.lose();const result=await f.S.save(p);assert.equal(result.bank.revision,next.revision);await f.S.save(p);assert.equal(f.writes.length,1);
});
test('Wechsel des OneDrive-Ordners, Admin-Sperre und Offline verhindern Schreibzugriffe',async()=>{
 const f=fixture(),old=await f.S.read(),p=plan(old,f.M.prepare(old.bank,f.input));f.source('other');await assert.rejects(f.S.save(p),e=>e.code==='contextChanged');f.source('root');f.c.adminUnlocked=false;await assert.rejects(f.S.save(p));f.c.adminUnlocked=true;f.c.navigator.onLine=false;await assert.rejects(f.S.save(p));assert.equal(f.writes.length,0);
});
test('Import in der Verwaltung bleibt nach Verbindungsfehler identisch und ist nur Entwurf',async()=>{
 const f=fixture(true);await f.c.DrinksQuizQuestions.load();const q=f.M.prepare(f.M.empty(),f.input).questions[0],file={size:100,text:async()=>JSON.stringify({schemaVersion:1,questions:[q]})};f.fail();await f.nodes.get('quiz-import-file').onchange({target:{files:[file],value:'file'}});assert.equal(f.nodes.get('quiz-retry').hidden,false);assert.equal(f.nodes.get('quiz-new').disabled,true);assert.equal(f.c.DrinksQuizQuestions.beforeView('drinksView'),false);
 await f.nodes.get('quiz-retry').onclick();assert.equal(f.writes.length,1);assert.equal(f.disk().questions[0].active,false);assert.equal(f.nodes.get('quiz-retry').hidden,true);await f.nodes.get('quiz-import-file').onchange({target:{files:[file],value:'file'}});assert.equal(f.writes.length,1);
});
test('Admin-Sperre entfernt alle sichtbaren Fragen und Lösungen',async()=>{
 const f=fixture(true);f.replace(f.M.prepare(f.M.empty(),f.input));await f.c.DrinksQuizQuestions.load();assert.equal(f.nodes.get('quiz-list').children.length,1);f.c.adminUnlocked=false;f.c.DrinksQuizQuestions.lock();assert.equal(f.nodes.get('quiz-list').children.length,0);assert.equal(f.nodes.get('quiz-text').value,'');assert.equal(f.nodes.get('quiz-new').disabled,true);assert.equal(f.nodes.get('quiz-categories').children.length,0);
});
test('Import nach Admin-Sperre während Dateilesen wird verworfen',async()=>{
 const f=fixture(true);await f.c.DrinksQuizQuestions.load();let finish;const text=new Promise(r=>finish=r),q=f.M.prepare(f.M.empty(),f.input).questions[0];const loading=f.nodes.get('quiz-import-file').onchange({target:{files:[{size:100,text:()=>text}],value:''}});f.c.adminUnlocked=false;f.c.DrinksQuizQuestions.lock();finish(JSON.stringify({schemaVersion:1,questions:[q]}));await loading;assert.equal(f.writes.length,0);assert.equal(f.nodes.get('quiz-list').children.length,0);
});
test('Nur freigegebene Fragen werden übertragen; Admin-Sperre erlaubt dieselbe Veröffentlichung erneut zu prüfen',async()=>{
 const f=fixture(true),calls=[];let bank=f.M.empty();for(let i=0;i<3;i++)bank=f.M.prepare(bank,{...f.input,text:'Frage '+i,active:i!==2});f.replace(bank);await f.c.DrinksQuizQuestions.load();f.c.DrinksCentral={syncProfiles:async()=>0,connection:async()=>({source:'drive:root',origin:'https://test.account.workers.dev'})};let fail=true;
 f.c.DrinksPush={request:async(c,path,data)=>{if(path.endsWith('/status'))return {revision:null};calls.push(structuredClone(data));if(fail){fail=false;throw new TypeError('Network');}return {count:data.questions.length};}};
 await f.nodes.get('quiz-publish').onclick();assert.equal(f.nodes.get('quiz-retry').hidden,false);assert.equal(calls[0].questions.length,2);assert.equal(calls[0].questions.some(q=>!q.active),false);f.c.adminUnlocked=false;f.c.DrinksQuizQuestions.lock();assert.equal(f.nodes.get('quiz-list').children.length,0);f.c.adminUnlocked=true;await f.c.DrinksQuizQuestions.load();assert.deepEqual(calls[0],calls[1]);assert.equal(f.nodes.get('quiz-retry').hidden,true);assert.match(f.nodes.get('quiz-status').textContent,/2 Fragen/);
});
