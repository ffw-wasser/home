/* Encrypted authoritative ledger. All mutations share a D1 transaction/revision. */
(function(g){
 'use strict';const M=g.DrinksModel,C=g.DeckelCrypto,utf=new TextEncoder(),dec=new TextDecoder();
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const meta=env=>env.DB.prepare('SELECT * FROM ledger_meta WHERE id=1').first();
 async function cryptKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf.encode('ffw-ledger-at-rest/v1:'+env.INVITE_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
 async function seal(env,value,purpose){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf.encode(purpose)},await cryptKey(env),utf.encode(JSON.stringify(value))));return JSON.stringify({iv:Array.from(iv),data:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))});}
 async function open(env,payload,purpose){const e=JSON.parse(payload);return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(e.iv),additionalData:utf.encode(purpose)},await cryptKey(env),Uint8Array.from(atob(e.data),c=>c.charCodeAt(0)))));}
 function member(id){if(typeof id!=='string'||!id.length||id.length>200)fail('Ungültige Mitgliederkennung.',400);return id;}
 async function read(env,id){member(id);const row=await env.DB.prepare('SELECT * FROM ledgers WHERE member=?').bind(id).first();return row?{account:M.validate(await open(env,row.payload,'ledger:'+id),id),version:row.version}:{account:M.empty(id),version:0};}
 function source(m,data){if(!m||m.source!==data.source)fail('Dieser Dienst gehört zu einem anderen OneDrive-Ordner.');}
 function active(m){if(m?.state!=='active')fail('Die Kontenübernahme ist noch nicht abgeschlossen.');}
 const tick=(env,seq)=>env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=?').bind(seq);
 async function save(env,m,id,a,version,extras=[]){
  M.validate(a,id);const payload=await seal(env,a,'ledger:'+id);
  const q=env.DB.prepare("INSERT INTO ledgers(member,payload,version) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state='active') AND ?=0 ON CONFLICT(member) DO NOTHING").bind(id,payload,m.seq,version);
  const update=env.DB.prepare("UPDATE ledgers SET payload=?,version=version+1 WHERE member=? AND version=? AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state='active')").bind(payload,id,version,m.seq);
  // The marker payload is unique; acknowledgements and the sequence tick run only
  // if this exact CAS succeeded, in the same transaction.
  const guard='EXISTS(SELECT 1 FROM ledgers WHERE member=? AND payload=?)';
  const statements=[version?update:q,...extras.map(fn=>fn(guard,id,payload)),env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND '+guard).bind(m.seq,id,payload)];
  await env.DB.batch(statements);
  const check=await env.DB.prepare('SELECT payload,version FROM ledgers WHERE member=?').bind(id).first();
  if(check?.payload!==payload)fail('Das Konto wurde gleichzeitig geändert. Bitte erneut prüfen.');
  return {version:check.version};
 }
 async function process(env,data){
  const receipt=await env.DB.prepare('SELECT * FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();
  if(!receipt)return {status:'missing'};if(receipt.status!=='pending')return {status:receipt.status,result:receipt.result};
  for(let attempt=0;attempt<4;attempt++){
   const m=await meta(env);active(m);
   const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(data.alias,data.revision).first();
   if(!row)fail('Handyzugang muss in der Verwaltung aktualisiert werden.');
   const record=await open(env,row.payload,'access:'+data.alias),current=await read(env,record.memberId);
   let next,rejection='';
   try{const command=await g.DeckelCommands.open(JSON.parse(receipt.envelope),record,data.id);next=g.DrinksLedger.apply(current.account,receipt,command,M.rewardPolicy(await open(env,m.policy,'policy')));}
   catch(e){rejection=['pointsChanged','correctionChanged','accessChanged'].includes(e.code)?e.code:'invalid';}
   if(rejection){
    await env.DB.prepare("UPDATE commands SET status='rejected',result=?,envelope='' WHERE alias=? AND revision=? AND id=? AND status='pending' AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=?)").bind(rejection,data.alias,data.revision,data.id,m.seq).run();
    const check=await env.DB.prepare('SELECT status,result FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();if(check.status!=='pending')return check;continue;
   }
   try{await save(env,m,record.memberId,next,current.version,[(guard,id,payload)=>env.DB.prepare("UPDATE commands SET status='done',result='',envelope='' WHERE alias=? AND revision=? AND id=? AND status='pending' AND "+guard).bind(data.alias,data.revision,data.id,id,payload)]);return {status:'done',result:''};}
   catch(e){if(e.status!==409)throw e;const done=await env.DB.prepare('SELECT status,result FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();if(done.status!=='pending')return done;}
  }
  return {status:'pending'};
 }
 async function route(path,data,env,auth,url){
  let m=await meta(env);
  if(path==='/central/snapshot'){
   if(m?.state!=='active')return {mode:'legacy'};
   const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=?').bind(data.alias||'').first();if(!row)fail('Handyzugang noch nicht übernommen. Bitte die Verwaltung informieren.',404);
   const record=await open(env,row.payload,'access:'+data.alias);
   if(!equal(auth,await hash('deckel-read/v1:'+record.alias+':'+record.key)))fail('Handyzugang ungültig.',401);
   const current=await read(env,record.memberId),p=M.rewardPolicy(await open(env,m.policy,'policy')),snapshot=g.DrinksLedger.snapshot(current.account,p);
   snapshot.actions={origin:new URL(url).origin,revision:record.revision,capability:await capability(env,record.alias,record.revision,'commands'),central:true,epoch:current.account.resetEpoch||'0'};
   return {mode:'central',envelope:await C.seal(snapshot,record)};
  }
  if(path.startsWith('/commands/')&&m?.state==='active'){
   if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||'')||!/^[a-f0-9-]{36}$/.test(data.id||''))fail('Ungültiger Auftrag.',400);
   const row=await env.DB.prepare('SELECT revision FROM ledger_access WHERE alias=?').bind(data.alias).first();
   if(!row||row.revision!==data.revision||!equal(auth,await capability(env,data.alias,row.revision,'commands')))fail('Buchungszugang ersetzt. Bitte neu laden.',401);
   if(path==='/commands/status')return process(env,data);
   if(path!=='/commands/submit')fail('Nicht gefunden.',404);
   const envelope=JSON.stringify(data.envelope);if(data.envelope?.version!==1||data.envelope.iv?.length!==16||data.envelope.data?.length!==5484)fail('Ungültige verschlüsselte Buchung.',400);
   const digest=await hash(envelope),old=await env.DB.prepare('SELECT digest FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();
   if(old&&old.digest!==digest)fail('Vorgangsnummer bereits verwendet.');
   if(!old){const now=Date.now();await env.DB.prepare("INSERT OR IGNORE INTO commands(alias,revision,id,envelope,digest,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM commands WHERE alias=? AND status='pending')<30 AND NOT EXISTS(SELECT 1 FROM commands WHERE alias=? AND created_at>?)").bind(data.alias,data.revision,data.id,envelope,digest,now,data.alias,data.alias,now-1000).run();const found=await env.DB.prepare('SELECT digest FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();if(!found)fail('Bitte kurz warten und denselben Vorgang erneut prüfen.',429);if(found.digest!==digest)fail('Vorgangsnummer bereits verwendet.');}
   return process(env,data);
  }
  if(!path.startsWith('/admin/central/'))return null;
  if(path==='/admin/central/status')return {version:1,state:m?.state||'unconfigured',source:m?.source||null,seq:m?.seq||0};
  if(path==='/admin/central/start'){
   if(typeof data.source!=='string'||!data.source||data.source.length>500)fail('Ungültiger Datenordner.',400);
   const policy=M.validateRewardSettings(data.policy);
   await env.DB.prepare("INSERT OR IGNORE INTO ledger_meta(id,source,state,seq,policy) VALUES(1,?,'staging',0,?)").bind(data.source,await seal(env,policy,'policy')).run();m=await meta(env);source(m,data);if(m.state==='staging')await env.DB.prepare("UPDATE ledger_meta SET policy=? WHERE id=1 AND state='staging'").bind(await seal(env,policy,'policy')).run();return {state:m.state};
  }
  source(m,data);
  if(path==='/admin/central/import'){
   if(m.state!=='staging')fail('Die Übernahme wurde bereits abgeschlossen.');
   const a=M.validate(data.account,member(data.account?.memberId)),payload=await seal(env,a,'ledger:'+a.memberId);
   await env.DB.prepare("INSERT INTO ledgers(member,payload,version) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE state='staging') ON CONFLICT(member) DO UPDATE SET payload=excluded.payload,version=ledgers.version+1 WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE state='staging')").bind(a.memberId,payload).run();return {ok:true};
  }
  if(path==='/admin/central/access'){
   const r=C.access(data.record);member(r.memberId);if(!REV.test(r.revision||''))fail('Ungültige Zugangsversion.',400);
   const old=await account(env,r.alias);if(old?.revision!==r.revision)fail('Handyzugang zuerst beim Dienst anmelden.');
   const existing=await env.DB.prepare('SELECT payload FROM ledger_access WHERE alias=?').bind(r.alias).first();if(existing&&JSON.stringify(await open(env,existing.payload,'access:'+r.alias))===JSON.stringify(r))return {ok:true};
   const payload=await seal(env,r,'access:'+r.alias);
   await env.DB.batch([env.DB.prepare('INSERT INTO ledger_access(alias,revision,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE seq=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?) ON CONFLICT(alias) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').bind(r.alias,r.revision,payload,m.seq,r.alias,r.revision),tick(env,m.seq)]);
   if((await env.DB.prepare('SELECT payload FROM ledger_access WHERE alias=?').bind(r.alias).first())?.payload!==payload)fail('Zugang wurde gleichzeitig geändert.');return {ok:true};
  }
  if(path==='/admin/central/activate'){
   const count=(await env.DB.prepare('SELECT COUNT(*) AS n FROM ledgers').first()).n;
   if(!Number.isInteger(data.count)||count!==data.count||typeof data.backup!=='string'||!data.backup.startsWith('sicherung-'))fail('Übernahme oder Sicherung unvollständig.');
   await env.DB.prepare("UPDATE ledger_meta SET state='active',seq=seq+1 WHERE id=1 AND state='staging'").run();return {state:'active'};
  }
  active(m);
  if(path==='/admin/central/members')return {members:(await env.DB.prepare('SELECT member FROM ledgers ORDER BY member').all()).results.map(r=>r.member),seq:m.seq};
  if(path==='/admin/central/read')return {...await read(env,member(data.memberId)),seq:m.seq};
  if(path==='/admin/central/policy')return {policy:await open(env,m.policy,'policy'),seq:m.seq};
  if(path==='/admin/central/policy-write'){
   const p=M.validateRewardSettings(data.policy),old=await open(env,m.policy,'policy');if(old.revision!==data.expectedRevision)fail('Treuepunkte-Einstellungen wurden geändert.');
   const result=await env.DB.prepare('UPDATE ledger_meta SET policy=?,seq=seq+1 WHERE id=1 AND seq=?').bind(await seal(env,p,'policy'),m.seq).run();if(!result.meta.changes)fail('Konten wurden gleichzeitig geändert.');return {ok:true};
  }
  if(path==='/admin/central/write'){
   const a=M.validate(data.account,member(data.memberId)),current=await read(env,data.memberId);
   if(current.version!==data.version)fail('Das Konto wurde gleichzeitig geändert.');
   const additions=a.bookings.slice(current.account.bookings.length),policy=await open(env,m.policy,'policy');
   if((data.policyRevision&&data.policyRevision!==policy.revision)||(!data.policyRevision&&additions.some(b=>b.type==='payment'||b.type==='bonus'||b.pointUnits)))fail('Die Treuepunkte-Einstellungen wurden geändert. Bitte neu laden.');
   // Ordinary writes must preserve the reset barrier and every existing entry.
   if((a.resetEpoch||'0')!==(current.account.resetEpoch||'0')||a.resetAt!==current.account.resetAt||JSON.stringify(a.bookings.slice(0,current.account.bookings.length))!==JSON.stringify(current.account.bookings))fail('Bestehende Buchungen dürfen nur über Zurücksetzen entfernt werden.');
   return save(env,m,data.memberId,a,data.version);
  }
  if(path==='/admin/central/reset-stage'){
   if(!REV.test(data.id||'')||data.seq!==m.seq)fail('Seit der Sicherung wurde gebucht. Bitte neu sichern.');
   const id=member(data.memberId),current=await read(env,id);if(!current.version)fail('Konto nicht gefunden.');
   const next={...M.empty(id),schemaVersion:7,pin:current.account.pin,resetEpoch:data.id,resetAt:new Date().toISOString()};
   await env.DB.prepare('INSERT INTO ledger_reset_items(reset_id,member,payload,seq) VALUES(?,?,?,?) ON CONFLICT(reset_id,member) DO UPDATE SET payload=excluded.payload,seq=excluded.seq').bind(data.id,id,await seal(env,next,'ledger:'+id),m.seq).run();return {ok:true};
  }
  if(path==='/admin/central/reset'){
   if(!REV.test(data.id||'')||!/^sicherung-[a-z0-9-]+\.json$/.test(data.backup||'')||!Array.isArray(data.members)||!data.members.length||new Set(data.members).size!==data.members.length||data.members.length>500)fail('Ungültiges Zurücksetzen.',400);
   const previous=await env.DB.prepare('SELECT id FROM ledger_resets WHERE id=?').bind(data.id).first();if(previous)return {ok:true,duplicate:true};
   if(data.seq!==m.seq)fail('Seit der Sicherung wurde gebucht. Bitte neu sichern und bestätigen.');
   const staged=(await env.DB.prepare('SELECT member,seq FROM ledger_reset_items WHERE reset_id=?').bind(data.id).all()).results;
   if(staged.length!==data.members.length||staged.some(r=>r.seq!==m.seq||!data.members.includes(r.member)))fail('Reset-Vorbereitung unvollständig.');
   await env.DB.batch([
    env.DB.prepare('UPDATE ledgers SET payload=(SELECT payload FROM ledger_reset_items WHERE reset_id=? AND member=ledgers.member),version=version+1 WHERE member IN(SELECT member FROM ledger_reset_items WHERE reset_id=?) AND EXISTS(SELECT 1 FROM ledger_meta WHERE seq=?)').bind(data.id,data.id,m.seq),
    env.DB.prepare('INSERT INTO ledger_resets(id,backup,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE seq=?)').bind(data.id,data.backup,Date.now(),m.seq),tick(env,m.seq)
   ]);
   if(!await env.DB.prepare('SELECT id FROM ledger_resets WHERE id=?').bind(data.id).first())fail('Seit der Sicherung wurde gebucht. Es wurde nichts zurückgesetzt.');return {ok:true};
  }
  fail('Nicht gefunden.',404);
 }
 g.CentralLedger={route};
})(globalThis);
