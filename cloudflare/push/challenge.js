/* Private question snapshots. One personal bonus round per Berlin calendar month. */
(function(g){
 'use strict';const L=g.CentralLedger,M=g.DrinksModel,Q=g.DrinksQuizModel;
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v),fail=(s,status=409,code='rejected')=>{throw Object.assign(Error(s),{status,code});},copy=v=>JSON.parse(JSON.stringify(v)),checks=new WeakMap();
 async function ready(env){const old=checks.get(env.DB);if(old&&old.until>Date.now())return old.ready;let ok=false;try{await env.DB.prepare('SELECT id FROM challenge_pool LIMIT 1').first();await env.DB.prepare('SELECT id FROM challenge_games LIMIT 1').first();ok=true;}catch{}checks.set(env.DB,{ready:ok,until:Date.now()+(ok?60000:5000)});return ok;}
 async function actor(env,data,auth){
  if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||''))fail('Ungültiger Handyzugang.',400);
  const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(data.alias,data.revision).first(),current=await env.DB.prepare('SELECT revision FROM accounts WHERE alias=?').bind(data.alias).first();
  if(!row||current?.revision!==data.revision||!equal(auth,await capability(env,data.alias,data.revision,'commands')))fail('Handyzugang wurde geändert. Bitte Deckel aktualisieren.',401);
  return L.open(env,row.payload,'access:'+data.alias);
 }
 async function pool(env){const row=await env.DB.prepare('SELECT * FROM challenge_pool WHERE id=1').first();return row?{value:await L.open(env,row.payload,'challenge-pool'),version:row.version}:null;}

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
  if(game.mode==='solo')return soloView(game);
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

 function month(now=Date.now()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit'}).formatToParts(new Date(now));return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
 async function monthlyId(env,memberId,period,epoch='0'){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('deckel-solo/v1:'+env.INVITE_SECRET+':'+memberId+':'+period+(epoch==='0'?'':':reset:'+epoch))),hex=Array.from(new Uint8Array(raw),v=>v.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20,32);}
 function soloView(game){const p=game.players[0],done=game.status==='done',q=game.questions[p.answers.length];return {version:1,mode:'solo',gameId:game.id,month:game.month,category:game.category,level:p.level,status:game.status,progress:p.answers.length,expiresAt:game.expiresAt,awardUnits:game.awardUnits,reason:game.reason||'',...(game.status==='running'&&q?{question:{index:p.answers.length,category:q.category,text:q.text,answers:q.answers}}:{}),...(done?{score:p.score,earnedUnits:p.earnedUnits,review:game.questions.map((q,i)=>({text:q.text,answers:q.answers,correct:q.correct,selected:p.answers[i],explanation:q.explanation,source:q.source}))}:{})};}
 // Retain pre-update rounds only when they belong to the current reset epoch.
 async function monthlyGame(env,record,period){const account=await L.read(env,record.memberId),epoch=account.account.resetEpoch||'0',id=await monthlyId(env,record.memberId,period,epoch),legacy=epoch==='0'?id:await monthlyId(env,record.memberId,period);for(const candidate of [...new Set([id,legacy])]){const row=await env.DB.prepare('SELECT * FROM challenge_games WHERE id=?').bind(candidate).first();if(!row)continue;const value=await L.open(env,row.payload,'challenge:'+candidate);if(value.mode!=='solo'||value.players[0].memberId!==record.memberId)fail('Monatsrunde konnte nicht eindeutig geprüft werden.');if(value.players[0].epoch===epoch)return {id:candidate,row,value,account};}return {id,row:null,value:null,account};}
 async function validSolo(env,meta,found){if(found.value?.status!=='running')return found;const a=await L.read(env,found.value.players[0].memberId),reason=found.value.month!==month()?'Der Monat ist beendet.':found.value.expiresAt<Date.now()?'Die Spielzeit ist abgelaufen.':(a.account.resetEpoch||'0')!==found.value.players[0].epoch?'Das Getränkekonto wurde zurückgesetzt.':'';if(reason){const next={...found.value,status:'cancelled',reason:reason+' Keine Treuepunkte vergeben.'};await commit(env,meta,found.row,next);return {...found,value:next};}return found;}
 async function soloRoute(action,data,env,record,meta){
  const period=month(),published=await pool(env),policy=published?.value.soloPolicy||null;
  if(action==='solo-status'){const found=await validSolo(env,meta,await monthlyGame(env,record,period));return {version:1,month:period,awardUnits:policy?.awardUnits||0,policyRevision:policy?.revision||null,game:found.value?soloView(found.value):null};}
  if(action==='solo-create'){
   if(!uuid(data.id))fail('Ungültige Vorgangsnummer.',400);if(data.month!==period)fail('Der Monat hat gewechselt. Bitte die Monats-Challenge aktualisieren.');const found=await validSolo(env,meta,await monthlyGame(env,record,period));if(data.epoch!==undefined&&data.epoch!==(found.account.account.resetEpoch||'0'))fail('Das Getränkekonto wurde zurückgesetzt. Bitte die Monats-Challenge aktualisieren.',409,'rejected');if(found.value)return soloView(found.value);
   if(!policy||!policy.awardUnits)fail('Die Verwaltung muss den Monatsbonus zuerst festlegen.');if(data.policyRevision!==policy.revision)fail('Der Monatsbonus wurde geändert. Bitte aktualisieren.');
   if(typeof data.category!=='string'||!data.category.trim()||data.category.length>80)fail('Bitte eine Kategorie auswählen.',400);
   const category=data.category.trim(),questions=published.value.questions.filter(q=>q.category===category),ownLevel=level(record,data);if(topics(questions,[ownLevel]).length<7)fail('Im Spieldienst fehlen sieben freigegebene Themen für '+ownLevel+' in '+category+'. Bitte die aktuelle Fragenbank übertragen.');
   const a=found.account;if(!a.version)fail('Das Getränkekonto ist noch nicht aktiv.');const selected=round(questions,[ownLevel]).byLevel[ownLevel],next={id:found.id,code:crypto.randomUUID().slice(0,8).toUpperCase(),mode:'solo',month:period,category,status:'running',createdAt:Date.now(),expiresAt:Date.now()+30*60000,awardUnits:policy.awardUnits,policyRevision:policy.revision,poolRevision:published.value.revision,questions:selected,players:[{memberId:record.memberId,epoch:a.account.resetEpoch||'0',level:ownLevel,answers:[]}],operations:{}};
   const payload=await L.seal(env,next,'challenge:'+next.id),result=await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO challenge_games(id,code,payload,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state=\'active\') AND EXISTS(SELECT 1 FROM challenge_pool WHERE id=1 AND version=?)').bind(next.id,next.code,payload,Date.now(),meta.seq,published.version),env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND EXISTS(SELECT 1 FROM challenge_games WHERE id=? AND payload=?)').bind(meta.seq,next.id,payload)]);if(!result[0].meta.changes)fail('Monatsrunde konnte noch nicht bestätigt werden. Bitte denselben Vorgang erneut prüfen.',409,'retry');return soloView(next);
  }
  if(!uuid(data.gameId))fail('Ungültige Monatsrunde.',400);const row=await env.DB.prepare('SELECT * FROM challenge_games WHERE id=?').bind(data.gameId).first();if(!row)fail('Monatsrunde nicht gefunden.',404);let found={row,value:await L.open(env,row.payload,'challenge:'+data.gameId)};if(found.value.mode!=='solo'||found.value.players[0].memberId!==record.memberId)fail('Diese Monatsrunde gehört einem anderen Mitglied.',403);const current=await L.read(env,record.memberId);if((current.account.resetEpoch||'0')!==found.value.players[0].epoch)fail('Das Getränkekonto wurde zurückgesetzt. Bitte die Monats-Challenge aktualisieren.',409,'rejected');found=await validSolo(env,meta,found);const old=found.value;
  if(action==='solo-get')return soloView(old);if(action!=='solo-answer')fail('Nicht gefunden.',404);if(!uuid(data.id))fail('Ungültige Vorgangsnummer.',400);
  const digest=await hash(JSON.stringify({gameId:data.gameId,index:data.index,answer:data.answer}));if(old.operations[data.id]){if(old.operations[data.id]!==digest)fail('Die Vorgangsnummer wurde bereits anders verwendet.');return soloView(old);}
  if(old.status!=='running'||data.index!==old.players[0].answers.length||data.index>=7||!Number.isSafeInteger(data.answer)||data.answer<0||data.answer>3)fail('Diese Antwort gehört nicht zur aktuellen Frage. Bitte aktualisieren.');
  const next=copy(old),p=next.players[0];next.operations[data.id]=digest;p.answers.push(data.answer);const affected=[];
  if(p.answers.length===7){const a=await L.read(env,p.memberId);if(!a.version||(a.account.resetEpoch||'0')!==p.epoch)fail('Das Getränkekonto wurde geändert. Bitte aktualisieren.');p.score=p.answers.reduce((n,answer,i)=>n+Number(answer===next.questions[i].correct),0);p.earnedUnits=p.score>=5?next.awardUnits:0;next.status='done';next.completedAt=new Date().toISOString();if(p.earnedUnits){const account=M.appendChallengeReward(a.account,{id:'challenge-reward-'+next.id,type:'challenge-reward',confirmation:'challenge',gameId:next.id,month:next.month,score:p.score,cents:p.earnedUnits,createdAt:next.completedAt});affected.push({id:p.memberId,version:a.version,account});}}
  if(next.month!==month()||next.expiresAt<Date.now())fail('Monat oder Spielzeit ist abgelaufen. Bitte aktualisieren.');await commit(env,meta,found.row,next,affected);return soloView(next);
 }
 async function route(path,data,env,auth){
  if(!await ready(env))fail('Die Challenge benötigt das Worker-Update und challenge.sql in der bestehenden D1-Datenbank.',503);
  const meta=await L.meta(env);L.active(meta);
  if(path.startsWith('/admin/challenge/')){
   L.source(meta,data);const old=await pool(env);
   if(path==='/admin/challenge/status')return {version:1,revision:old?.value.revision||null,count:old?.value.questions.length||0,soloPolicy:old?.value.soloPolicy||null,coverage:[...new Set((old?.value.questions||[]).map(q=>q.category))].map(category=>({category,counts:Object.fromEntries(levels.map(l=>[l,topics(old.value.questions.filter(q=>q.category===category),[l]).length]))}))};
   if(path==='/admin/challenge/solo-policy'){
    if(!uuid(data.revision)||!Number.isSafeInteger(data.awardUnits)||data.awardUnits<150||data.awardUnits>15000||data.awardUnits%150)fail('Bitte 1 bis 100 ganze Treuepunkte als Monatsbonus eingeben.',400);const previous=old?.value.soloPolicy||null;
    if(previous?.revision===data.revision){if(previous.awardUnits!==data.awardUnits)fail('Diese Bonusversion wurde bereits anders verwendet.');return {ok:true,soloPolicy:previous};}
    if((previous?.revision||null)!==data.expectedRevision)fail('Der Monatsbonus wurde inzwischen geändert. Bitte erneut laden.');const soloPolicy={revision:data.revision,awardUnits:data.awardUnits},value={...(old?.value||{revision:null,questions:[]}),soloPolicy},payload=await L.seal(env,value,'challenge-pool');const result=old?await env.DB.prepare('UPDATE challenge_pool SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.version).run():await env.DB.prepare('INSERT OR IGNORE INTO challenge_pool(id,payload) VALUES(1,?)').bind(payload).run();if(!result.meta.changes)fail('Fragen oder Monatsbonus wurden gleichzeitig geändert. Bitte erneut prüfen.',409,'retry');return {ok:true,soloPolicy};
   }
   if(path!=='/admin/challenge/publish')fail('Nicht gefunden.',404);
   if(!REV.test(data.revision||'')||!Array.isArray(data.questions)||data.questions.length>1000)fail('Ungültige Fragenbank.',400);
   let questions;try{questions=data.questions.map(Q.question).filter(q=>q.active);if(questions.some(q=>!q.level||!q.topic)||new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('Stufenzuordnung fehlt oder doppelte Fragen.');}catch{fail('Die Fragenbank ist nicht gültig. Freigegebene Fragen benötigen Ausbildungsstufe und Thema.',400);}
   const value={revision:data.revision,questions,...(old?.value.soloPolicy?{soloPolicy:old.value.soloPolicy}:{})};if(old?.value.revision===value.revision){if(JSON.stringify(old.value.questions)!==JSON.stringify(value.questions))fail('Diese Fragenversion wurde bereits anders verwendet.');return {ok:true,count:questions.length};}
   if((old?.value.revision||null)!==data.expectedRevision)fail('Der veröffentlichte Fragenstand wurde geändert. Bitte erneut prüfen.');
   const payload=await L.seal(env,value,'challenge-pool');let result;
   if(old)result=await env.DB.prepare('UPDATE challenge_pool SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.version).run();else result=await env.DB.prepare('INSERT OR IGNORE INTO challenge_pool(id,payload) VALUES(1,?)').bind(payload).run();
   if(!result.meta.changes)fail('Der Fragenstand wurde gleichzeitig geändert. Bitte erneut prüfen.');return {ok:true,count:questions.length};
  }
  const record=await actor(env,data,auth),action=path.slice('/challenge/'.length);
  if(action.startsWith('solo-'))return soloRoute(action,data,env,record,meta);
  if(['create','preview','join','start','answer'].includes(action))fail('Gegeneinander wurde durch die persönliche Monats-Challenge ersetzt. Bitte die App neu laden.',409);
  if(!['categories','get','cancel'].includes(action))fail('Nicht gefunden.',404);
  if(action==='categories'){
   const published=await pool(env),questions=published?.value.questions||[],names=[...new Set(questions.map(q=>q.category))].sort((a,b)=>a.localeCompare(b,'de')),profileLevel=levels.includes(record.challengeLevel)?record.challengeLevel:null;
   return {version:1,profileLevel,categories:names.map(name=>{const qs=questions.filter(q=>q.category===name),counts=Object.fromEntries(levels.map(l=>[l,topics(qs,[l]).length])),count=profileLevel?counts[profileLevel]:0;return {name,count,available:count>=7,counts};})};
  }
  const found=await game(env,data),old=found.value,me=old.players.find(p=>p.alias===record.alias);
  if(!me||me.revision!==record.revision)fail('Du gehörst nicht mit diesem Zugang zu dieser früheren Runde.',403);
  if(['lobby','running'].includes(old.status)){const next={...old,status:'cancelled',reason:'Gegeneinander wurde durch die Monats-Challenge ersetzt. Es wurde nichts übertragen.'};await commit(env,meta,found.row,next);return view(next,record.alias);}
  return view(old,record.alias);
 }
 g.DeckelChallengeService={route,ready,view,commit,month,monthlyId};
})(globalThis);

