const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../js/features/drinks/deckel-challenge.js','utf8');
function fixture(categoryValues=[{name:'Technik',count:15,available:true,counts:{TM:15,TF:15,GF:15}}]){
 const nodes=new Map(),events={},requests=[],saved=new Map(),copied=[];let networkFail=false,storageFail=false,defer=null;
 class Node{constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.hidden=false;this.disabled=false;this.open=false;this.textContent='';}set innerHTML(s){for(const m of s.matchAll(/<(\w+)[^>]*id="([^"]+)"[^>]*>/g)){const n=new Node(m[1]);n.id=m[2];const value=/value="([^"]*)"/.exec(m[0]);if(value)n.value=value[1];nodes.set(n.id,n);}}append(...values){for(const n of values){this.children.push(n);if(n.id)nodes.set(n.id,n);}}replaceChildren(){this.children=[];}querySelectorAll(){return [...nodes.values(),...this.children.flatMap(n=>n.children)].filter(n=>['button','input','select'].includes(n.tagName));}}
 nodes.set('account',new Node());const alias='1'.repeat(32),key='a'.repeat(64),c=vm.createContext({console,Date,TextEncoder,TextDecoder,crypto:webcrypto,Uint8Array,atob,btoa,URLSearchParams,AbortSignal,setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t;},clearTimeout,location:{hash:'#a='+alias+'&k='+key},document:{readyState:'complete',hidden:false,getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),addEventListener:(name,fn)=>events['document:'+name]=fn},navigator:{clipboard:{writeText:async text=>copied.push(text)}},confirm:()=>true,addEventListener:(name,fn)=>events[name]=fn,DeckelReload(){},DeckelDevice:{readChallenge:async a=>saved.get(a)||null,saveChallenge:async(a,value)=>{if(storageFail)throw Error('storage');saved.set(a,value);}}});c.globalThis=c;
 c.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/solo-status'))return {ok:true,json:async()=>({version:1,month:'2026-10',awardUnits:300,policyRevision:'policy-revision',game:null})};if(url.endsWith('/categories'))return {ok:true,json:async()=>({version:1,categories:categoryValues})};requests.push({url,body});if(networkFail){networkFail=false;throw new TypeError('network');}if(defer){const fn=defer;defer=null;await fn();}return {ok:true,json:async()=>({version:1,mode:'solo',gameId:body.gameId||body.id,month:'2026-10',category:'Technik',level:'TM',status:'running',awardUnits:300,progress:0,expiresAt:Date.now()+1800000,question:{index:0,category:'Technik',text:'Testfrage?',answers:['A','B','C','D']}})};};
 vm.runInContext(source,c);const snapshot={actions:{central:true,challengeVersion:1,challengeCategoriesVersion:1,challengeLevelsVersion:1,challengeLevel:'TM',challengeSoloVersion:1,origin:'https://example.account.workers.dev',revision:'revision-test',capability:'a'.repeat(43)}};
 return {c,nodes,events,requests,saved,copied,alias,snapshot,networkFail:()=>networkFail=true,storageFail:()=>storageFail=true,defer:fn=>defer=fn};
}
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('timeout');}

test('Menü enthält nur Solo: Profilstufe automatisch, Kategorie plus Start ohne Zusatzbestätigung',async()=>{const f=fixture();await f.c.DeckelChallenge.render({...f.snapshot,actions:{...f.snapshot.actions,challengeLevel:'GF'}});assert.equal(f.nodes.has('challenge-stake'),false);assert.equal(f.nodes.has('challenge-join-code'),false);assert.equal(f.nodes.has('challenge-name'),false);assert.equal(f.nodes.get('challenge-level-choice').hidden,true);assert.equal(f.nodes.get('challenge-level').disabled,true);f.nodes.get('challenge-level').value='TM';f.nodes.get('challenge-category').value='Technik';await f.nodes.get('challenge-create').onclick();await until(()=>f.requests.length===1&&!f.nodes.get('challenge-create').disabled===false);assert.equal(f.requests[0].body.level,'GF');assert.match(f.requests[0].url,/solo-create$/);assert.equal(f.requests[0].body.stakeCents,undefined);});
test('Fehlende Profilstufe ausdrücklich wählen; Kategorie braucht sieben Themen; alter Worker blockiert',async()=>{const f=fixture([{name:'Technik',counts:{TM:5,TF:8,GF:9}}]);await f.c.DeckelChallenge.render({...f.snapshot,actions:{...f.snapshot.actions,challengeLevel:null}});assert.equal(f.nodes.get('challenge-level-choice').hidden,false);f.nodes.get('challenge-level').value='TM';f.nodes.get('challenge-level').onchange();f.nodes.get('challenge-category').value='Technik';await f.nodes.get('challenge-create').onclick();assert.equal(f.requests.length,0);f.nodes.get('challenge-level').value='TF';f.nodes.get('challenge-level').onchange();f.nodes.get('challenge-category').value='Technik';f.nodes.get('challenge-category').onchange();assert.equal(f.nodes.get('challenge-create').disabled,false);const old=fixture();await old.c.DeckelChallenge.render({actions:{...old.snapshot.actions,challengeSoloVersion:undefined}});assert.equal(old.nodes.get('challenge-create').disabled,true);assert.match(old.nodes.get('challenge-status').textContent,/Cloudflare-Worker/);});
test('Unbestätigter Start bleibt verschlüsselt, Prüfung verwendet exakt dieselbe ID',async()=>{const f=fixture();await f.c.DeckelChallenge.render(f.snapshot);f.nodes.get('challenge-category').value='Technik';f.networkFail();await f.nodes.get('challenge-create').onclick();await until(()=>!f.nodes.get('challenge-retry').hidden&&!f.nodes.get('challenge-retry').disabled);assert.equal(f.requests.length,1);assert.equal(JSON.stringify(f.saved.get(f.alias)).includes('Technik'),false);assert.equal(f.nodes.get('challenge-create').disabled,true);await f.nodes.get('challenge-retry').onclick();assert.equal(f.requests.length,2);assert.deepEqual(f.requests[0].body,f.requests[1].body);assert.equal(f.nodes.get('challenge-retry').hidden,true);assert.equal(f.nodes.get('challenge-create-area').hidden,true);assert.equal(f.nodes.get('challenge-game-area').hidden,false);});
test('Ohne sicheren Speicher wird keine Spielaktion gesendet',async()=>{const f=fixture();await f.c.DeckelChallenge.render(f.snapshot);f.nodes.get('challenge-category').value='Technik';f.storageFail();await f.nodes.get('challenge-create').onclick();await until(()=>f.nodes.get('challenge-status').textContent.includes('Nicht gesendet'));assert.equal(f.requests.length,0);});
test('Zugangswechsel entfernt alte Frage und verwirft verspätete Antwort',async()=>{const f=fixture();await f.c.DeckelChallenge.render(f.snapshot);f.nodes.get('challenge-category').value='Technik';let finish;const wait=new Promise(r=>finish=r);f.defer(()=>wait);f.nodes.get('challenge-create').onclick();await until(()=>f.requests.length===1);f.c.location.hash='#a='+'2'.repeat(32)+'&k='+'b'.repeat(64);f.events.hashchange();await f.c.DeckelChallenge.render(f.snapshot);finish();await new Promise(r=>setTimeout(r,10));assert.equal(f.nodes.get('challenge-question').children.length,0);assert.equal(f.nodes.get('challenge-create-area').hidden,false);assert.equal(f.nodes.get('challenge-create').disabled,true);});


test('Kontoreset entfernt alte Frage und verwirft verspätete Antwort bei gleichbleibendem Zugang',async()=>{const f=fixture();await f.c.DeckelChallenge.render({...f.snapshot,actions:{...f.snapshot.actions,epoch:'0'}});f.nodes.get('challenge-category').value='Technik';let finish;const wait=new Promise(r=>finish=r);f.defer(()=>wait);f.nodes.get('challenge-create').onclick();await until(()=>f.requests.length===1);await f.c.DeckelChallenge.render({...f.snapshot,actions:{...f.snapshot.actions,epoch:'reset-new'}});finish();await new Promise(r=>setTimeout(r,10));assert.equal(f.requests.length,1);assert.equal(f.nodes.get('challenge-question').children.length,0);assert.equal(f.nodes.get('challenge-create-area').hidden,false);assert.equal(f.nodes.get('challenge-retry').hidden,true);assert.equal(f.requests[0].body.epoch,'0');});
test('Gespeicherter unbestätigter Start wird nach Kontoreset nicht erneut gesendet',async()=>{const f=fixture();await f.c.DeckelChallenge.render({...f.snapshot,actions:{...f.snapshot.actions,epoch:'0'}});f.nodes.get('challenge-category').value='Technik';f.networkFail();f.nodes.get('challenge-create').onclick();await until(()=>!f.nodes.get('challenge-retry').hidden&&!f.nodes.get('challenge-retry').disabled);assert.equal(f.requests.length,1);await f.c.DeckelChallenge.render({...f.snapshot,actions:{...f.snapshot.actions,epoch:'reset-new'}});assert.equal(f.requests.length,1);assert.equal(f.nodes.get('challenge-retry').hidden,true);assert.equal(f.nodes.get('challenge-create-area').hidden,false);});

test('Challenge zeigt Laden-Button nur nach Lesefehler; erfolgreiche Wiederholung blendet ihn aus',async()=>{
 const f=fixture(),fetch=f.c.fetch;f.c.fetch=async(url,options)=>{if(url.endsWith('/solo-status'))throw new TypeError('Load failed');return fetch(url,options);};
 await f.c.DeckelChallenge.render(f.snapshot);assert.equal(f.nodes.get('challenge-refresh').hidden,false);assert.equal(f.nodes.get('challenge-retry').hidden,true);
 f.c.fetch=fetch;await f.nodes.get('challenge-refresh').onclick();assert.equal(f.nodes.get('challenge-refresh').hidden,true);assert.equal(f.requests.length,0);
});

test('Abschließende Challenge-Auswertung markiert falsche Antworten rot und richtige grün',async()=>{
 const f=fixture(),originalFetch=f.c.fetch;
 const review=[
  {text:'Was wird zuerst geprüft?',answers:['A','B','C'],selected:0,correct:1,explanation:'Antwort B ist korrekt.',source:'Ausbildungsunterlage'},
  {text:'Was ist richtig?',answers:['Ja','Nein'],selected:0,correct:0,explanation:'Ja ist richtig.',source:'Lehrgang'}
 ];
 f.c.fetch=async(url,options)=>url.endsWith('/solo-status')?{ok:true,json:async()=>({version:1,month:'2026-10',awardUnits:300,policyRevision:'revision',game:{gameId:'done-1',month:'2026-10',category:'Technik',level:'TM',status:'done',score:1,earnedUnits:0,review}})}:originalFetch(url,options);
 await f.c.DeckelChallenge.render(f.snapshot);
 const details=f.nodes.get('challenge-review').children[0];
 assert.equal(details.open,true);
 const cards=details.children.filter(n=>n.tagName==='article');
 assert.equal(cards.length,2);
 assert.match(cards[0].className,/is-wrong/);
 assert.match(cards[0].children[0].textContent,/Falsch beantwortet/);
 assert.match(cards[0].children[1].textContent,/Deine Antwort: A/);
 assert.match(cards[0].children[2].textContent,/Richtige Antwort: B/);
 assert.match(cards[1].className,/is-correct/);
 assert.match(cards[1].children[0].textContent,/Richtig beantwortet/);
});

test('Antwortauswahl ist unverbindlich, kann korrigiert werden und wird erst nach Bestätigung gesendet',async()=>{
 const f=fixture(),base=f.c.fetch,game={gameId:'round-1',month:'2026-10',category:'Technik',level:'TM',status:'running',expiresAt:Date.now()+1800000,question:{index:0,text:'Welche Antwort ist richtig?',answers:['Antwort A','Antwort B','Antwort C']}};
 f.c.fetch=async(url,options)=>url.endsWith('/solo-status')?{ok:true,json:async()=>({version:1,month:'2026-10',awardUnits:300,policyRevision:'r1',game})}:base(url,options);
 await f.c.DeckelChallenge.render(f.snapshot);
 const answers=f.nodes.get('challenge-question').children.filter(n=>n.className?.includes('challenge-answer'));
 const confirm=f.nodes.get('challenge-confirm');
 assert.equal(answers.length,3);
 assert.equal(confirm.disabled,true);
 confirm.onclick();assert.equal(f.requests.length,0);
 answers[0].onclick();assert.equal(f.requests.length,0);
 assert.equal(confirm.disabled,false);
 assert.match(answers[0].className,/is-selected/);
 answers[2].onclick();
 assert.equal(f.requests.length,0,'Auswahlwechsel darf keinen Netzwerkaufruf auslösen');
 assert.doesNotMatch(answers[0].className,/is-selected/);
 assert.match(answers[2].className,/is-selected/);
 await confirm.onclick();
 await until(()=>f.requests.length===1);
 assert.equal(f.requests[0].body.answer,2);
 assert.equal(f.requests[0].body.index,0);
 assert.match(f.requests[0].url,/solo-answer$/);
});

test('Hintergrund-Aktualisierung behält die Schaltflächen und Antwortauswahl unverändert',async()=>{
 const f=fixture(),base=f.c.fetch,game={gameId:'round-1',month:'2026-10',category:'Technik',level:'TM',status:'running',expiresAt:Date.now()+1800000,question:{index:0,text:'Welche Antwort ist richtig?',answers:['Antwort A','Antwort B','Antwort C']}};
 f.c.fetch=async(url,options)=>url.endsWith('/solo-status')?{ok:true,json:async()=>({version:1,month:'2026-10',awardUnits:300,policyRevision:'r1',game:{...game,question:{...game.question,answers:[...game.question.answers]}}})}:base(url,options);
 await f.c.DeckelChallenge.render(f.snapshot);
 const originalQuestion=f.nodes.get('challenge-question').children[2];
 const answer=f.nodes.get('challenge-question').children[3];
 answer.onclick();
 const confirm=f.nodes.get('challenge-confirm');
 await f.c.DeckelChallenge.render(f.snapshot);
 assert.equal(f.nodes.get('challenge-question').children[2],originalQuestion,'Die Frage darf bei identischem Stand nicht ersetzt werden');
 assert.equal(f.nodes.get('challenge-question').children[3],answer,'Angetippte Schaltfläche muss stabil bleiben');
 assert.equal(f.nodes.get('challenge-confirm'),confirm);
 assert.match(answer.className,/is-selected/);
 assert.equal(confirm.disabled,false);
 assert.equal(f.requests.length,0);
});

test('Neue Frage entfernt die alte Auswahl und sperrt die Bestätigung erneut',async()=>{
 const f=fixture(),base=f.c.fetch;
 let index=0;const status=()=>({version:1,month:'2026-10',awardUnits:300,policyRevision:'r1',game:{gameId:'round-1',month:'2026-10',category:'Technik',level:'TM',status:'running',expiresAt:Date.now()+1800000,question:{index,text:'Frage '+(index+1),answers:['A','B']}}});
 f.c.fetch=async(url,options)=>url.endsWith('/solo-status')?{ok:true,json:async()=>status()}:base(url,options);
 await f.c.DeckelChallenge.render(f.snapshot);
 const old=f.nodes.get('challenge-question').children[3];old.onclick();
 assert.equal(f.nodes.get('challenge-confirm').disabled,false);
 index=1;await f.c.DeckelChallenge.render(f.snapshot);
 assert.equal(f.nodes.get('challenge-confirm').disabled,true);
 assert.equal(f.nodes.get('challenge-question').children[3].className,'challenge-answer');
 old.onclick();
 assert.equal(f.nodes.get('challenge-confirm').disabled,true,'Alte Antworten dürfen neue Frage nicht verändern');
 assert.equal(f.requests.length,0);
});
