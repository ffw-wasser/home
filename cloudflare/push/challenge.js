/* Private question snapshots and atomic, zero-sum multiplayer settlement. */
(function(g){
 'use strict';const L=g.CentralLedger,M=g.DrinksModel,Q=g.DrinksQuizModel,R=g.DeckelChallengeRules;
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v),fail=(s,status=409,code='rejected')=>{throw Object.assign(Error(s),{status,code});},copy=v=>JSON.parse(JSON.stringify(v)),checks=new WeakMap();
 async function ready(env){const old=checks.get(env.DB);if(old&&old.until>Date.now())return old.ready;let ok=false;try{await env.DB.prepare('SELECT id FROM challenge_pool LIMIT 1').first();await env.DB.prepare('SELECT id FROM challenge_games LIMIT 1').first();ok=true;}catch{}checks.set(env.DB,{ready:ok,until:Date.now()+(ok?60000:5000)});return ok;}
 async function actor(env,data,auth){
  if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||''))fail('Ungültiger Handyzugang.',400);
  const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(data.alias,data.revision).first(),current=await env.DB.prepare('SELECT revision FROM accounts WHERE alias=?').bind(data.alias).first();
  if(!row||current?.revision!==data.revision||!equal(auth,await capability(env,data.alias,data.revision,'commands')))fail('Handyzugang wurde geändert. Bitte Deckel aktualisieren.',401);
  return L.open(env,row.payload,'access:'+data.alias);
 }
 async function pool(env){const row=await env.DB.prepare('SELECT * FROM challenge_pool WHERE id=1').first();return row?{value:await L.open(env,row.payload,'challenge-pool'),version:row.version}:null;}
 const name=v=>{if(typeof v!=='string'||!v.trim()||v.length>40)fail('Bitte einen Spielnamen mit höchstens 40 Zeichen eingeben.',400);return v.trim();};
 function shuffled(values){const a=values.slice();for(let i=a.length-1;i>0;i--){const limit=Math.floor(0x100000000/(i+1))*(i+1);let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
 function select(questions){return shuffled(questions).slice(0,7).map(q=>{const order=shuffled([0,1,2,3]);return {...q,answers:order.map(i=>q.answers[i]),correct:order.indexOf(q.correct)};});}
 const levels=['TM','TF','GF'];
 function level(record,data){const saved=levels.includes(record.challengeLevel)?record.challengeLevel:null;if(saved&&data.level&&data.level!==saved)fail('Die Ausbildungsstufe kommt aus deinem Mitgliederprofil. Bitte Deckel aktualisieren.',409);if(saved)return saved;if(!levels.includes(data.level))fail('Bitte deine Ausbildungsstufe auswählen.',400);return data.level;}
 function topics(questions,requested){return [...new Set(questions.filter(q=>q.level&&q.topic).map(q=>q.topic))].filter(topic=>requested.every(l=>questions.some(q=>q.topic===topic&&(q.level===l||q.level==='ALL'))));}
 function round(questions,requested){const common=shuffled(topics(questions,requested)).slice(0,7);if(common.length!==7)fail('Für diese Teilnehmerstufen fehlen sieben gemeinsame Themen mit freigegebenen Fragen.');const byLevel={};for(const l of requested)byLevel[l]=common.map(topic=>{const specific=questions.filter(q=>q.topic===topic&&q.level===l),eligible=specific.length?specific:questions.filter(q=>q.topic===topic&&q.level==='ALL');return select([shuffled(eligible)[0]])[0];});return {topics:common,byLevel};}
 const ownQuestions=(game,player)=>game.levelsVersion===1?game.questionsByLevel?.[player?.level]||[]:game.questions;
 async function game(env,data){
  let row;if(uuid(data.gameId))row=await env.DB.prepare('SELECT * FROM challenge_games WHERE id=?').bind(data.gameId).first();else if(/^[A-F0-9]{8}$/.test(data.code||''))row=await env.DB.prepare('SELECT * FROM challenge_games WHERE code=?').bind(data.code).first();else fail('Bitte einen gültigen Spielcode eingeben.',400);
  if(!row)fail('Runde nicht gefunden. Bitte den Spielcode prüfen.',404);return {row,value:await L.open(env,row.payload,'challenge:'+row.id)};
 }
 function view(game,alias){
  const me=game.players.find(p=>p.alias===alias),done=game.status==='done',own=ownQuestions(game,me);
  return {version:1,gameId:game.id,code:game.code,levelsVersion:game.levelsVersion||0,level:me?.level||null,category:game.category||'Gemischte ältere Runde',status:game.status,stakeCents:game.stakeCents,expiresAt:game.expiresAt,isHost:game.host===alias,reason:game.reason||'',players:game.players.map(p=>({name:p.name,me:p.alias===alias,host:p.alias===game.host,progress:p.answers.length,...(done?{score:p.score,delta:p.delta}:{} )})),...(me&&game.status==='running'&&me.answers.length<7?{question:{index:me.answers.length,category:own[me.answers.length].category,text:own[me.answers.length].text,answers:own[me.answers.length].answers}}:{}),...(done&&me?{review:own.map((q,i)=>({text:q.text,answers:q.answers,correct:q.correct,selected:me.answers[i],explanation:q.explanation,source:q.source}))}:{})};
 }
 // The first CAS verifies ALL affected ledger versions before changing anything.
 // All later statements are guarded by its unique encrypted marker in one batch.
 async function commit(env,meta,row,next,accounts=[]){
  const payload=await L.seal(env,next,'challenge:'+next.id),clauses=['EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state=\'active\')'],params=[meta.seq];
  for(const a of accounts){clauses.push('EXISTS(SELECT 1 FROM ledgers WHERE member=? AND version=?)');params.push(a.id,a.version);}
  const first=env.DB.prepare('UPDATE challenge_games SET payload=?,version=version+1,updated_at=? WHERE id=? AND version=? AND '+clauses.join(' AND ')).bind(payload,Date.now(),next.id,row.version,...params),guard='EXISTS(SELECT 1 FROM challenge_games WHERE id=? AND payload=?)',statements=[first];
  for(const a of accounts)statements.push(env.DB.prepare('UPDATE ledgers SET payload=?,version=version+1 WHERE member=? AND '+guard).bind(await L.seal(env,a.account,'ledger:'+a.id),a.id,next.id,payload));
  statements.push(env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND '+guard).bind(meta.seq,next.id,payload));
  const results=await env.DB.batch(statements);if(!results[0].meta.changes)fail('Die Runde oder ein Konto wurde gleichzeitig geändert. Bitte denselben Vorgang erneut prüfen.',409,'retry');
 }
 async function settlement(env,next){
  const accounts=[];for(const p of next.players){
   const access=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(p.alias,p.revision).first(),current=await env.DB.prepare('SELECT revision FROM accounts WHERE alias=?').bind(p.alias).first();
   if(!access||current?.revision!==p.revision){next.status='cancelled';next.reason='Ein Handyzugang wurde geändert. Es wurde nichts übertragen.';return [];}
   const r=await L.open(env,access.payload,'access:'+p.alias),a=await L.read(env,p.memberId);
   if(r.memberId!==p.memberId||!a.version||(a.account.resetEpoch||'0')!==p.epoch){next.status='cancelled';next.reason='Ein Konto wurde zurückgesetzt oder geändert. Es wurde nichts übertragen.';return [];}
   accounts.push({id:p.memberId,version:a.version,account:a.account});
  }
  const deltas=R.settle(next.players.map((p,i)=>({...p,questions:ownQuestions(next,p),debt:M.totals(accounts[i].account).balance})),next.questions,next.stakeCents),createdAt=new Date().toISOString();
  for(let i=0;i<next.players.length;i++){const p=next.players[i],result=deltas.find(r=>r.alias===p.alias);p.score=result.score;p.delta=result.delta;if(result.delta)accounts[i].account=M.appendChallenge(accounts[i].account,{id:'challenge-'+next.id,type:'challenge',gameId:next.id,code:next.code,confirmation:'challenge',direction:result.delta>0?'in':'out',cents:Math.abs(result.delta),score:result.score,createdAt});}
  next.status='done';next.completedAt=createdAt;return accounts;
 }
 async function route(path,data,env,auth){
  if(!await ready(env))fail('Die Challenge benötigt das Worker-Update und challenge.sql in der bestehenden D1-Datenbank.',503);
  const meta=await L.meta(env);L.active(meta);
  if(path.startsWith('/admin/challenge/')){
   L.source(meta,data);const old=await pool(env);
   if(path==='/admin/challenge/status')return {version:1,revision:old?.value.revision||null,count:old?.value.questions.length||0};
   if(path!=='/admin/challenge/publish')fail('Nicht gefunden.',404);
   if(!REV.test(data.revision||'')||!Array.isArray(data.questions)||data.questions.length>1000)fail('Ungültige Fragenbank.',400);
   let questions;try{questions=data.questions.map(Q.question).filter(q=>q.active);if(questions.some(q=>!q.level||!q.topic)||new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('Stufenzuordnung fehlt oder doppelte Fragen.');}catch{fail('Die Fragenbank ist nicht gültig. Freigegebene Fragen benötigen Ausbildungsstufe und Thema.',400);}
   const value={revision:data.revision,questions};if(old?.value.revision===value.revision){if(JSON.stringify(old.value)!==JSON.stringify(value))fail('Diese Fragenversion wurde bereits anders verwendet.');return {ok:true,count:questions.length};}
   if((old?.value.revision||null)!==data.expectedRevision)fail('Der veröffentlichte Fragenstand wurde geändert. Bitte erneut prüfen.');
   const payload=await L.seal(env,value,'challenge-pool');let result;
   if(old)result=await env.DB.prepare('UPDATE challenge_pool SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.version).run();else result=await env.DB.prepare('INSERT OR IGNORE INTO challenge_pool(id,payload) VALUES(1,?)').bind(payload).run();
   if(!result.meta.changes)fail('Der Fragenstand wurde gleichzeitig geändert. Bitte erneut prüfen.');return {ok:true,count:questions.length};
  }
  const record=await actor(env,data,auth),action=path.slice('/challenge/'.length);
  if(!['categories','create','preview','join','get','start','answer','cancel'].includes(action))fail('Nicht gefunden.',404);
  if(action==='categories'){
   const published=await pool(env),questions=published?.value.questions||[],names=[...new Set(questions.map(q=>q.category))].sort((a,b)=>a.localeCompare(b,'de')),profileLevel=levels.includes(record.challengeLevel)?record.challengeLevel:null;
   return {version:1,profileLevel,categories:names.map(name=>{const qs=questions.filter(q=>q.category===name),counts=Object.fromEntries(levels.map(l=>[l,topics(qs,[l]).length])),count=profileLevel?counts[profileLevel]:0;return {name,count,available:count>=7,counts};})};
  }
  const digest=await hash(JSON.stringify({...data,action}));
  if(action==='create'){
   if(!uuid(data.id)||!Number.isSafeInteger(data.stakeCents)||data.stakeCents<1||data.stakeCents>100000||data.confirmedCents!==data.stakeCents)fail('Einsatz bitte ausdrücklich bestätigen: 0,01 bis 1000 Euro.',400);
   const previous=await env.DB.prepare('SELECT * FROM challenge_games WHERE id=?').bind(data.id).first();
   if(previous){const old=await L.open(env,previous.payload,'challenge:'+data.id);if(old.host!==record.alias||old.operations[data.id]!==digest)fail('Die Vorgangsnummer wurde bereits anders verwendet.');return view(old,record.alias);}
   if(typeof data.category!=='string'||!data.category.trim()||data.category.length>80)fail('Bitte vor dem Erstellen eine Kategorie auswählen.',400);
   const category=data.category.trim(),published=await pool(env),questions=published?.value.questions.filter(q=>q.category===category)||[];
   const ownLevel=level(record,data);if(topics(questions,[ownLevel]).length<7)fail('Für deine Stufe und diese Kategorie muss die Verwaltung Fragen für mindestens sieben Themen veröffentlichen.');
   const a=await L.read(env,record.memberId);if(!a.version)fail('Das Getränkekonto ist noch nicht aktiv.');
   const next={id:data.id,code:crypto.randomUUID().slice(0,8).toUpperCase(),category,levelsVersion:1,status:'lobby',host:record.alias,stakeCents:data.stakeCents,createdAt:Date.now(),expiresAt:Date.now()+86400000,poolRevision:published.value.revision,poolQuestions:questions,questions:[],players:[{alias:record.alias,revision:record.revision,memberId:record.memberId,epoch:a.account.resetEpoch||'0',level:ownLevel,name:name(data.name),answers:[]}],operations:{[data.id]:digest}};
   const payload=await L.seal(env,next,'challenge:'+next.id),results=await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO challenge_games(id,code,payload,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state=\'active\')').bind(next.id,next.code,payload,Date.now(),meta.seq),env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND EXISTS(SELECT 1 FROM challenge_games WHERE id=? AND payload=?)').bind(meta.seq,next.id,payload)]);
   if(!results[0].meta.changes)fail('Die Runde konnte noch nicht bestätigt werden. Bitte denselben Vorgang erneut prüfen.',409,'retry');return view(next,record.alias);
  }
  const found=await game(env,data),old=found.value,me=old.players.find(p=>p.alias===record.alias);
  if(action==='preview')return {version:1,levelsVersion:old.levelsVersion||0,gameId:old.id,code:old.code,category:old.category||'Gemischte ältere Runde',status:old.status,stakeCents:old.stakeCents,joined:Boolean(me&&me.revision===record.revision),players:old.players.map(p=>({name:p.name})),expiresAt:old.expiresAt};
  if(action!=='join'&&(!me||me.revision!==record.revision))fail('Du gehörst nicht mit diesem Zugang zu dieser Runde.',403);
  if(action==='get'){
   if(['lobby','running'].includes(old.status)&&old.expiresAt<Date.now()){const next={...old,status:'cancelled',reason:'Zeit abgelaufen. Es wurde nichts übertragen.'};await commit(env,meta,found.row,next);return view(next,record.alias);}return view(old,record.alias);
  }
  if(!uuid(data.id))fail('Ungültige Vorgangsnummer.',400);
  if(old.operations[data.id]){if(old.operations[data.id]!==digest)fail('Die Vorgangsnummer wurde bereits anders verwendet.');return view(old,record.alias);}
  if(!['lobby','running'].includes(old.status)||old.expiresAt<Date.now())fail('Diese Runde ist beendet oder abgelaufen. Bitte aktualisieren.');
  const next=copy(old);next.operations[data.id]=digest;let affected=[];
  if(action==='join'){
   if(old.status!=='lobby'||old.players.length>=20)fail('Die Runde ist bereits gestartet oder voll.');
   if(old.players.some(p=>p.memberId===record.memberId))fail('Dieses Mitglied ist bereits in der Runde.');
   if(data.confirmedCents!==old.stakeCents)fail('Bitte den angezeigten Einsatz ausdrücklich bestätigen.',400);
   const a=await L.read(env,record.memberId);if(!a.version)fail('Das Getränkekonto ist noch nicht aktiv.');const nickname=name(data.name);if(old.players.some(p=>p.name.toLocaleLowerCase('de-DE')===nickname.toLocaleLowerCase('de-DE')))fail('Diesen Spielnamen gibt es bereits. Bitte einen anderen wählen.');
   const ownLevel=old.levelsVersion===1?level(record,data):null;if(old.levelsVersion===1&&topics(old.poolQuestions,[...new Set([...old.players.map(p=>p.level),ownLevel])]).length<7)fail('Für diese Kombination von Ausbildungsstufen fehlen sieben gemeinsame Themen. Die Verwaltung muss passende Varianten freigeben.');
   next.players.push({alias:record.alias,revision:record.revision,memberId:record.memberId,epoch:a.account.resetEpoch||'0',level:ownLevel,name:nickname,answers:[]});
  }else if(action==='start'){
   if(old.host!==record.alias||old.status!=='lobby'||old.players.length<2)fail('Nur der Gastgeber startet mit mindestens zwei Teilnehmern.');if(old.levelsVersion===1){const selected=round(old.poolQuestions,[...new Set(old.players.map(p=>p.level))]);next.topics=selected.topics;next.questionsByLevel=selected.byLevel;next.questions=selected.byLevel[old.players[0].level];delete next.poolQuestions;}next.status='running';next.expiresAt=Date.now()+30*60000;
  }else if(action==='cancel'){
   next.status='cancelled';next.reason='Die Runde wurde abgebrochen. Es wurde nichts übertragen.';
  }else if(action==='answer'){
   const player=next.players.find(p=>p.alias===record.alias);if(old.status!=='running'||data.index!==player.answers.length||data.index>=7||!Number.isSafeInteger(data.answer)||data.answer<0||data.answer>3)fail('Diese Antwort gehört nicht zur aktuellen Frage. Bitte aktualisieren.');
   player.answers.push(data.answer);if(next.players.every(p=>p.answers.length===7))affected=await settlement(env,next);
  }
  await commit(env,meta,found.row,next,affected);return view(next,record.alias);
 }
 g.DeckelChallengeService={route,ready,view,commit,settlement};
})(globalThis);
