/* Production storage and revocable administration devices. No Microsoft dependency. */
(function(g){
 'use strict';const L=g.CentralLedger,utf=new TextEncoder(),PERMANENT_EXPIRY=Number.MAX_SAFE_INTEGER;
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
 const secret=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
 async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',utf.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
 const current=env=>env.DB.prepare('SELECT * FROM storage_runtime WHERE id=1').first();
 async function role(env,row){return (await L.open(env,row.label,'storage-device:'+row.id)).access||'state';}
 async function assertDevice(env,row){
  const access=await role(env,row),runtime=await current(env);
  if(access==='application-admin'){
   if(!runtime||runtime.run!==row.run||runtime.source_hash!==row.source_hash)fail('Dieser Gerätezugang gehört nicht zum aktiven Datenstand.',401);
  }else if(runtime?.run===row.run)fail('Dieser Zugang ist für den produktiven Datenstand nicht berechtigt.',401);
  return access;
 }
 async function administrator(env,token){
  if(!secret(token))fail('Verwaltungszugang ungültig.',401);
  if(!await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='storage_runtime'").first())fail('Verwaltungszugang ungültig.',401);
  const actor=await g.StorageState.tokenDevice(env,token);
  if(await assertDevice(env,actor)!=='application-admin')fail('Verwaltungszugang ungültig.',401);
  const ledger=await L.meta(env);if(ledger?.state!=='active'||await digest(ledger.source)!==actor.source_hash)fail('Datenquelle wurde geändert.',401);
  return actor;
 }
 async function adminScope(env,token,data){if(equal(token,env.ADMIN_TOKEN))return null;const actor=await administrator(env,token);if(data&&(data.run!==actor.run||data.source!==actor.source_hash))fail('Zugriff auf einen anderen Datenstand ist nicht erlaubt.',403);return actor;}
 // Existing valid administration devices adopt the permanent policy on their
 // next authenticated configuration check. Expired or revoked tokens never
 // reach this function. The primary key, secret and source identity stay intact.
 async function config(env,actor){
  if(actor.expires_at!==PERMANENT_EXPIRY){
   await env.DB.prepare('UPDATE storage_devices SET expires_at=? WHERE id=? AND token_hash=? AND revoked_at IS NULL AND expires_at>?').bind(PERMANENT_EXPIRY,actor.id,actor.token_hash,Date.now()).run();
   const saved=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=? AND token_hash=?').bind(actor.id,actor.token_hash).first();
   if(!saved||saved.revoked_at!==null||saved.expires_at!==PERMANENT_EXPIRY)fail('Gerätezugang gesperrt oder abgelaufen.',401);actor=saved;
  }
  const ledger=await L.meta(env),runtime=await current(env);return {provider:'cloudflare',mode:'active',serverTime:Date.now(),run:runtime.run,source:ledger.source,sourceHash:actor.source_hash,deviceId:actor.id,expiresAt:actor.expires_at,permanent:true,version:runtime.version};
 }

 async function route(path,data,env,auth){
  if((path.startsWith('/storage/microsoft/')||path==='/admin/storage-runtime/microsoft')&&g.StorageMicrosoft)return g.StorageMicrosoft.route(path,data,env,auth);
  if(path==='/storage/status'){const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='storage_runtime'").first();return {provider:'cloudflare',version:1,active:Boolean(table&&await current(env))};}
  if(path==='/storage/logout'){
   if(!secret(auth))fail('Gerätezugang ungültig.',401);
   await env.DB.prepare('UPDATE storage_devices SET revoked_at=COALESCE(revoked_at,?) WHERE token_hash=?').bind(Date.now(),await hash('storage-device/v1:'+auth)).run();return {ok:true};
  }
  if(path==='/storage/claim'){
   if(!secret(data.ticket)||!secret(data.token)||!uuid(data.deviceId)||typeof data.label!=='string'||!data.label.trim()||data.label.length>100||/[\x00-\x1f\x7f]/.test(data.label))fail('Ungültige Gerätekopplung.',400);
   const ticketId=await hash('storage-pair/v1:'+data.ticket),ticket=await env.DB.prepare('SELECT * FROM storage_pairings WHERE id=?').bind(ticketId).first(),runtime=await current(env);
   if(!ticket||!runtime||ticket.run!==runtime.run||ticket.source_hash!==runtime.source_hash||ticket.expires_at<=Date.now())fail('Die Gerätekopplung ist abgelaufen.',401);
   const tokenHash=await hash('storage-device/v1:'+data.token),registrationHash=await hash(JSON.stringify({ticketId,deviceId:data.deviceId,tokenHash,label:data.label})),now=Date.now();
   if(ticket.used_at!==null){const old=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=? AND registration_hash=?').bind(data.deviceId,registrationHash).first();if(ticket.device_id!==data.deviceId||!old||old.revoked_at!==null||old.expires_at<=now)fail('Die Gerätekopplung wurde bereits verwendet.',401);return {ok:true,...await config(env,old)};}
   const label=await L.seal(env,{label:data.label,access:'application-admin'},'storage-device:'+data.deviceId);
   await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO storage_devices(id,run,source_hash,token_hash,registration_hash,label,created_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM storage_pairings t WHERE t.id=? AND t.used_at IS NULL AND t.expires_at>? AND (t.device_id IS NULL OR EXISTS(SELECT 1 FROM storage_devices issuer WHERE 'issuer:'||issuer.id=t.device_id AND issuer.run=t.run AND issuer.source_hash=t.source_hash AND issuer.revoked_at IS NULL AND issuer.expires_at>?))) AND (SELECT COUNT(*) FROM storage_devices WHERE run=? AND revoked_at IS NULL AND expires_at>?)<10").bind(data.deviceId,ticket.run,ticket.source_hash,tokenHash,registrationHash,label,now,PERMANENT_EXPIRY,ticketId,now,now,ticket.run,now),
    env.DB.prepare('UPDATE storage_pairings SET used_at=?,device_id=? WHERE id=? AND used_at IS NULL AND EXISTS(SELECT 1 FROM storage_devices WHERE id=? AND registration_hash=?)').bind(now,data.deviceId,ticketId,data.deviceId,registrationHash)
   ]);
   const claimed=await env.DB.prepare('SELECT * FROM storage_pairings WHERE id=?').bind(ticketId).first(),actor=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=? AND registration_hash=?').bind(data.deviceId,registrationHash).first();
   if(!actor||claimed.device_id!==actor.id||claimed.used_at===null)fail('Die Gerätekopplung konnte nicht bestätigt werden.');return {ok:true,...await config(env,actor)};
  }
  if(path==='/admin/storage-runtime/activate'){
   if(!equal(auth,env.ADMIN_TOKEN))fail('Die erste Umschaltung benötigt den ursprünglichen Dienstzugang.',401);
   await g.StorageState.assertSource(env,data);
   const active=await current(env);if(active?.run===data.run&&active.source_hash===data.source)return {ok:true,version:active.version,mode:'active'};
   if(active)fail('Es ist bereits ein anderer Datenstand aktiv. Ein Standwechsel benötigt eine gesonderte Migration.');
   const manifest=await g.StorageMigration.verifiedManifest(env,data.source,data.run),state=await env.DB.prepare('SELECT * FROM storage_states WHERE run=? AND source_hash=?').bind(data.run,data.source).first();if(!state)fail('Der Datenstand wurde noch nicht übernommen.');
   if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion!==state.version||state.version!==1)fail('Der vorbereitete Datenstand wurde verändert. Bitte den Schlussabgleich wiederholen.');
   const files=(await env.DB.prepare("SELECT id,version FROM storage_files WHERE run=? AND kind='file' AND deleted_at IS NULL").bind(data.run).all()).results,ids=new Set(files.filter(f=>f.version===1).map(f=>f.id));
   for(const file of manifest.files)if(file.path!=='feuerwehr-wasser-daten.json'&&!ids.has(file.fileId))fail('Die Dateiablage ist noch nicht vollständig oder wurde nach der Übernahme geändert.');
   const ledger=await L.meta(env);
   await env.DB.prepare("INSERT OR IGNORE INTO storage_runtime(id,run,source_hash,version,activated_at) SELECT 1,?,?,1,? WHERE EXISTS(SELECT 1 FROM storage_states WHERE run=? AND source_hash=? AND version=?) AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND state='active' AND source=?)").bind(data.run,data.source,Date.now(),data.run,data.source,data.expectedVersion,ledger.source).run();
   const saved=await current(env);if(!saved||saved.run!==data.run||saved.source_hash!==data.source)fail('Die Umschaltung wurde gleichzeitig geändert.');return {ok:true,version:saved.version,mode:'active'};
  }
  const actor=equal(auth,env.ADMIN_TOKEN)?null:await administrator(env,auth),runtime=await current(env);
  if(path==='/admin/storage-runtime/status')return {active:Boolean(runtime),serverTime:Date.now(),...(runtime?{run:runtime.run,source:runtime.source_hash,version:runtime.version}:{})};
  if(!runtime)fail('Der Cloudflare-Datenstand ist noch nicht aktiviert.');
  if(path==='/admin/storage-runtime/permanent-devices'){
   if(data.run!==runtime.run||data.source!==runtime.source_hash)fail('Die Datenquelle stimmt nicht mit dem aktiven Speicher überein.',403);
   const now=Date.now(),rows=(await env.DB.prepare('SELECT * FROM storage_devices WHERE run=? AND source_hash=? AND revoked_at IS NULL AND expires_at>? AND expires_at<?').bind(runtime.run,runtime.source_hash,now,PERMANENT_EXPIRY).all()).results,updates=[];
   for(const row of rows){if(await role(env,row)!=='application-admin')continue;
    const guard=actor?' AND EXISTS(SELECT 1 FROM storage_devices a WHERE a.id=? AND a.token_hash=? AND a.revoked_at IS NULL AND a.expires_at>?)':'';
    updates.push(env.DB.prepare('UPDATE storage_devices SET expires_at=? WHERE id=? AND run=? AND source_hash=? AND revoked_at IS NULL AND expires_at>?'+guard).bind(PERMANENT_EXPIRY,row.id,runtime.run,runtime.source_hash,now,...(actor?[actor.id,actor.token_hash,now]:[])));
   }
   const results=updates.length?await env.DB.batch(updates):[];return {ok:true,updated:results.reduce((sum,row)=>sum+Number(row.meta.changes),0),permanent:true};
  }
  if(path==='/storage/config'){if(!actor)fail('Bitte einen eigenen Gerätezugang verwenden.',401);return config(env,actor);}
  if(path==='/storage/renew'){
   if(!actor)fail('Bitte einen eigenen Gerätezugang verwenden.',401);
   return {ok:true,...await config(env,actor)};
  }
  if(path==='/admin/storage-runtime/pairing'){
   if(!secret(data.ticket)||!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+5*60000)fail('Ein Kopplungscode ist maximal fünf Minuten gültig.',400);
   const id=await hash('storage-pair/v1:'+data.ticket),old=await env.DB.prepare('SELECT * FROM storage_pairings WHERE id=?').bind(id).first();if(old&&(old.used_at!==null||old.run!==runtime.run||old.source_hash!==runtime.source_hash||old.expires_at!==data.expiresAt))fail('Der Kopplungscode wurde bereits verwendet.');
   await env.DB.prepare('INSERT OR IGNORE INTO storage_pairings(id,run,source_hash,expires_at,device_id) VALUES(?,?,?,?,?)').bind(id,runtime.run,runtime.source_hash,data.expiresAt,actor?'issuer:'+actor.id:null).run();return {ok:true,expiresAt:data.expiresAt};
  }
  if(path==='/admin/storage-runtime/devices'){
   const rows=(await env.DB.prepare('SELECT * FROM storage_devices WHERE run=? ORDER BY created_at DESC').bind(runtime.run).all()).results,devices=[];
   for(const row of rows){const info=await L.open(env,row.label,'storage-device:'+row.id);if(info.access==='application-admin')devices.push({id:row.id,label:info.label,expiresAt:row.expires_at,permanent:row.expires_at===PERMANENT_EXPIRY,revoked:row.revoked_at!==null,createdAt:row.created_at});}return {devices};
  }
  if(path==='/admin/storage-runtime/cleanup'){
   const now=Date.now(),rows=(await env.DB.prepare('SELECT * FROM storage_devices WHERE run=? AND source_hash=? AND (revoked_at IS NOT NULL OR expires_at<=?)').bind(runtime.run,runtime.source_hash,now).all()).results,eligible=[],deletes=[];
   for(const row of rows)if(await role(env,row)==='application-admin')eligible.push(row);
   // Keep both D1's statement and bound-parameter budgets small for old histories.
   for(let offset=0;offset<eligible.length;offset+=20){const chunk=eligible.slice(offset,offset+20),guard=actor?' AND EXISTS(SELECT 1 FROM storage_devices a WHERE a.id=? AND a.token_hash=? AND a.revoked_at IS NULL AND a.expires_at>?)':'';
    const predicate='run=? AND source_hash=? AND (revoked_at IS NOT NULL OR expires_at<=?) AND ('+chunk.map(()=>'(id=? AND label=?)').join(' OR ')+') AND EXISTS(SELECT 1 FROM storage_runtime WHERE run=? AND source_hash=?)'+guard,args=[runtime.run,runtime.source_hash,now,...chunk.flatMap(row=>[row.id,row.label]),runtime.run,runtime.source_hash,...(actor?[actor.id,actor.token_hash,now]:[])];
    // Receipts reference the device. Remove only its retry acknowledgements in
    // the same transaction, with the same eligibility and authorization guards.
    // Application state, version history and active-device receipts stay intact.
    deletes.push(env.DB.prepare('DELETE FROM storage_state_receipts WHERE device_id IN (SELECT id FROM storage_devices WHERE '+predicate+')').bind(...args));
    deletes.push(env.DB.prepare('DELETE FROM storage_devices WHERE '+predicate).bind(...args));
   }
   const results=deletes.length?await env.DB.batch(deletes):[];return {ok:true,removed:results.reduce((sum,row,index)=>sum+(index%2?Number(row.meta.changes):0),0)};
  }
  if(path==='/admin/storage-runtime/rename'){
   if(!uuid(data.deviceId)||typeof data.label!=='string'||!data.label.trim()||data.label.trim().length>100||/[\x00-\x1f\x7f]/.test(data.label))fail('Bitte eine Gerätebezeichnung mit 1 bis 100 Zeichen eingeben.',400);
   const row=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=? AND run=? AND source_hash=?').bind(data.deviceId,runtime.run,runtime.source_hash).first();
   if(!row)fail('Gerät nicht gefunden.',404);
   const info=await L.open(env,row.label,'storage-device:'+row.id);if(info.access!=='application-admin')fail('Gerät nicht gefunden.',404);
   const payload=await L.seal(env,{...info,label:data.label.trim()},'storage-device:'+row.id),now=Date.now();
   const guard=actor?' AND EXISTS(SELECT 1 FROM storage_devices a WHERE a.id=? AND a.token_hash=? AND a.revoked_at IS NULL AND a.expires_at>?)':'';
   const saved=await env.DB.prepare('UPDATE storage_devices SET label=? WHERE id=? AND run=? AND source_hash=? AND label=? AND EXISTS(SELECT 1 FROM storage_runtime WHERE run=? AND source_hash=?)'+guard).bind(payload,row.id,runtime.run,runtime.source_hash,row.label,runtime.run,runtime.source_hash,...(actor?[actor.id,actor.token_hash,now]:[])).run();
   if(!saved.meta.changes)fail('Gerätebezeichnung wurde nicht bestätigt. Bitte Liste aktualisieren.');return {ok:true};
  }
  if(path==='/admin/storage-runtime/revoke'){

   if(!uuid(data.deviceId))fail('Ungültige Gerätekennung.',400);
   await env.DB.prepare('UPDATE storage_devices SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND run=? AND source_hash=?').bind(Date.now(),data.deviceId,runtime.run,runtime.source_hash).run();return {ok:true};
  }
  fail('Nicht gefunden.',404);
 }
 g.StorageRuntime={route,current,role,assertDevice,administrator,adminScope,permanentExpiry:PERMANENT_EXPIRY};
})(globalThis);
