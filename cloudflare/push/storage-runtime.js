/* Production storage and revocable administration devices. No Microsoft dependency. */
(function(g){
 'use strict';const L=g.CentralLedger,utf=new TextEncoder();
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
 async function config(env,actor){const ledger=await L.meta(env),runtime=await current(env);return {provider:'cloudflare',mode:'active',run:runtime.run,source:ledger.source,sourceHash:actor.source_hash,deviceId:actor.id,expiresAt:actor.expires_at,version:runtime.version};}
 async function route(path,data,env,auth){
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
    env.DB.prepare("INSERT OR IGNORE INTO storage_devices(id,run,source_hash,token_hash,registration_hash,label,created_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM storage_pairings WHERE id=? AND used_at IS NULL AND expires_at>?) AND (SELECT COUNT(*) FROM storage_devices WHERE run=? AND revoked_at IS NULL AND expires_at>?)<10").bind(data.deviceId,ticket.run,ticket.source_hash,tokenHash,registrationHash,label,now,now+30*86400000,ticketId,now,ticket.run,now),
    env.DB.prepare('UPDATE storage_pairings SET used_at=?,device_id=? WHERE id=? AND used_at IS NULL AND EXISTS(SELECT 1 FROM storage_devices WHERE id=? AND registration_hash=?)').bind(now,data.deviceId,ticketId,data.deviceId,registrationHash)
   ]);
   const claimed=await env.DB.prepare('SELECT * FROM storage_pairings WHERE id=?').bind(ticketId).first(),actor=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=? AND registration_hash=?').bind(data.deviceId,registrationHash).first();
   if(!actor||claimed.device_id!==actor.id||claimed.used_at===null)fail('Die Gerätekopplung konnte nicht bestätigt werden.');return {ok:true,...await config(env,actor)};
  }
  if(path==='/admin/storage-runtime/activate'){
   if(!equal(auth,env.ADMIN_TOKEN))fail('Die erste Umschaltung benötigt den ursprünglichen Dienstzugang.',401);
   await g.StorageState.assertSource(env,data);
   const manifest=await g.StorageMigration.verifiedManifest(env,data.source,data.run),state=await env.DB.prepare('SELECT * FROM storage_states WHERE run=? AND source_hash=?').bind(data.run,data.source).first();if(!state)fail('Der Datenstand wurde noch nicht übernommen.');
   const files=(await env.DB.prepare("SELECT id FROM storage_files WHERE run=? AND kind='file' AND deleted_at IS NULL").bind(data.run).all()).results,ids=new Set(files.map(f=>f.id));
   for(const file of manifest.files)if(file.path!=='feuerwehr-wasser-daten.json'&&!ids.has(file.fileId))fail('Die Dateiablage ist noch nicht vollständig übernommen.');
   const old=await current(env);if(old?.run===data.run&&old.source_hash===data.source)return {ok:true,version:old.version,mode:'active'};
   if(old)fail('Es ist bereits ein anderer Datenstand aktiv. Ein Standwechsel benötigt eine gesonderte Migration.');
   await env.DB.prepare('INSERT OR IGNORE INTO storage_runtime(id,run,source_hash,version,activated_at) VALUES(1,?,?,1,?)').bind(data.run,data.source,Date.now()).run();
   const saved=await current(env);if(saved.run!==data.run||saved.source_hash!==data.source)fail('Die Umschaltung wurde gleichzeitig geändert.');return {ok:true,version:saved.version,mode:'active'};
  }
  const actor=equal(auth,env.ADMIN_TOKEN)?null:await administrator(env,auth),runtime=await current(env);
  if(path==='/admin/storage-runtime/status')return {active:Boolean(runtime),...(runtime?{run:runtime.run,source:runtime.source_hash,version:runtime.version}:{})};
  if(!runtime)fail('Der Cloudflare-Datenstand ist noch nicht aktiviert.');
  if(path==='/storage/config'){if(!actor)fail('Bitte einen eigenen Gerätezugang verwenden.',401);return config(env,actor);}
  if(path==='/storage/renew'){
   if(!actor)fail('Bitte einen eigenen Gerätezugang verwenden.',401);
   await env.DB.prepare('UPDATE storage_devices SET expires_at=? WHERE id=? AND token_hash=? AND revoked_at IS NULL AND expires_at>?').bind(Date.now()+30*86400000,actor.id,actor.token_hash,Date.now()).run();const saved=await g.StorageState.tokenDevice(env,auth);return {ok:true,...await config(env,saved)};
  }
  if(path==='/admin/storage-runtime/pairing'){
   if(!secret(data.ticket)||!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+5*60000)fail('Ein Kopplungscode ist maximal fünf Minuten gültig.',400);
   const id=await hash('storage-pair/v1:'+data.ticket),old=await env.DB.prepare('SELECT * FROM storage_pairings WHERE id=?').bind(id).first();if(old&&(old.used_at!==null||old.run!==runtime.run||old.source_hash!==runtime.source_hash||old.expires_at!==data.expiresAt))fail('Der Kopplungscode wurde bereits verwendet.');
   await env.DB.prepare('INSERT OR IGNORE INTO storage_pairings(id,run,source_hash,expires_at) VALUES(?,?,?,?)').bind(id,runtime.run,runtime.source_hash,data.expiresAt).run();return {ok:true,expiresAt:data.expiresAt};
  }
  if(path==='/admin/storage-runtime/devices'){
   const rows=(await env.DB.prepare('SELECT * FROM storage_devices WHERE run=? ORDER BY created_at DESC').bind(runtime.run).all()).results,devices=[];
   for(const row of rows){const info=await L.open(env,row.label,'storage-device:'+row.id);if(info.access==='application-admin')devices.push({id:row.id,label:info.label,expiresAt:row.expires_at,revoked:row.revoked_at!==null,createdAt:row.created_at});}return {devices};
  }
  if(path==='/admin/storage-runtime/revoke'){
   if(!uuid(data.deviceId))fail('Ungültige Gerätekennung.',400);
   await env.DB.prepare('UPDATE storage_devices SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND run=? AND source_hash=?').bind(Date.now(),data.deviceId,runtime.run,runtime.source_hash).run();return {ok:true};
  }
  fail('Nicht gefunden.',404);
 }
 g.StorageRuntime={route,current,role,assertDevice,administrator,adminScope};
})(globalThis);
