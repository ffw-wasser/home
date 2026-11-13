/* Rehearsal of D1 state and revocable device credentials. Not yet live storage. */
(function(g){
 'use strict';
 const utf=new TextEncoder(),dec=new TextDecoder(),L=g.CentralLedger;
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
 const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const get=(env,run)=>env.DB.prepare('SELECT * FROM storage_states WHERE run=?').bind(run).first();
 const purpose=run=>'storage-state/v1:'+run;
 function state(value){
  if(!value||Array.isArray(value)||typeof value!=='object'||!Array.isArray(value.members)||!Array.isArray(value.entries))fail('Ungültige Mitglieder- und Anwesenheitsdaten.',400);
  if(utf.encode(JSON.stringify(value)).length>500000)fail('Der Datenstand ist für diese Übernahmephase zu groß.',413);
  return value;
 }
 // Migration source hashes use hex rather than the legacy base64url hash helper.
 async function sourceDigest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',utf.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
 async function checkSource(env,data){const ledger=await L.meta(env);if(ledger?.state!=='active'||!hex(data.source)||!equal(await sourceDigest(ledger.source),data.source))fail('Die Datenquelle stimmt nicht mit dem bestehenden Dienst überein.');}
 async function tokenDevice(env,auth){
  if(!/^[A-Za-z0-9_-]{43}$/.test(auth||''))fail('Gerätezugang ungültig.',401);
  const row=await env.DB.prepare('SELECT * FROM storage_devices WHERE token_hash=?').bind(await hash('storage-device/v1:'+auth)).first();
  if(!row||row.revoked_at!==null||row.expires_at<=Date.now())fail('Gerätezugang abgelaufen oder gesperrt.',401);
  return row;
 }
 async function device(env,data,auth){const row=await tokenDevice(env,auth);if(row.run!==data.run||row.source_hash!==data.source)fail('Gerätezugang gehört zu einem anderen Datenstand.',401);if(g.StorageRuntime)await g.StorageRuntime.assertDevice(env,row);return row;}
 async function route(path,data,env,auth){
  const admin=path.startsWith('/admin/storage-state/');
  if(admin){if(g.StorageRuntime)await g.StorageRuntime.adminScope(env,auth,data);else if(!env.ADMIN_TOKEN||!equal(auth,env.ADMIN_TOKEN))fail('Admin-Zugang ungültig.',401);}
  if(!hex(data.run))fail('Ungültige Übernahmekennung.',400);
  const actor=admin?null:await device(env,data,auth);
  const runtime=g.StorageRuntime?await g.StorageRuntime.current(env):null,phase=runtime?.run===data.run?{mode:'active',liveStorage:'cloudflare'}:{mode:'rehearsal',liveStorage:'onedrive'};
  await checkSource(env,data);
  if(path==='/admin/storage-state/prepare'){
   const bytes=await g.StorageMigration.verifiedFile(env,data.source,data.run,'feuerwehr-wasser-daten.json');
   let value;try{value=JSON.parse(dec.decode(bytes));}catch{fail('Die übernommene Datendatei ist kein gültiges JSON.',400);}state(value);
   const payload=await L.seal(env,value,purpose(data.run));
   await env.DB.prepare('INSERT OR IGNORE INTO storage_states(run,source_hash,payload,version,created_at) VALUES(?,?,?,1,?)').bind(data.run,data.source,payload,Date.now()).run();
   const row=await get(env,data.run);if(row.source_hash!==data.source)fail('Die Datenquelle wurde geändert.');
   return {version:row.version,...phase};
  }
  const row=await get(env,data.run);if(!row||row.source_hash!==data.source)fail('Der Datenstand wurde noch nicht vorbereitet.',404);
  if(path==='/admin/storage-state/status'){
   const value=await L.open(env,row.payload,purpose(data.run));
   return {version:row.version,...phase,members:value.members.length,entries:value.entries.length};
  }
  if(path==='/admin/storage-state/pair'){
   if(!uuid(data.deviceId)||!/^[A-Za-z0-9_-]{43}$/.test(data.token||'')||typeof data.label!=='string'||!data.label.trim()||data.label.length>100||/[\x00-\x1f\x7f]/.test(data.label)||!Number.isSafeInteger(data.expiresAt))fail('Ungültige Geräteanmeldung.',400);
   if(data.access!==undefined&&!['state','application-admin'].includes(data.access))fail('Ungültige Geräteberechtigung.',400);
   const access=data.access||'state',tokenHash=await hash('storage-device/v1:'+data.token),registrationHash=await hash(JSON.stringify({run:data.run,source:data.source,tokenHash,label:data.label,expiresAt:data.expiresAt,...(access==='application-admin'?{access}:{})}));
   const old=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=?').bind(data.deviceId).first();
   if(old){if(old.registration_hash!==registrationHash||old.revoked_at!==null||old.expires_at<=Date.now())fail('Die Gerätekennung ist bereits vergeben oder gesperrt.');return {ok:true,deviceId:old.id,expiresAt:old.expires_at,duplicate:true,mode:phase.mode};}
   const now=Date.now();if(data.expiresAt<=now||data.expiresAt>now+30*86400000)fail('Ein Gerätezugang gilt maximal 30 Tage.',400);
   const expiresAt=access==='application-admin'&&phase.mode==='active'?g.StorageRuntime.permanentExpiry:data.expiresAt;
   await env.DB.prepare('INSERT OR IGNORE INTO storage_devices(id,run,source_hash,token_hash,registration_hash,label,created_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM storage_devices WHERE run=? AND revoked_at IS NULL AND expires_at>?)<10').bind(data.deviceId,data.run,data.source,tokenHash,registrationHash,await L.seal(env,{label:data.label,...(access==='application-admin'?{access}:{})},'storage-device:'+data.deviceId),now,expiresAt,data.run,now).run();
   const saved=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=?').bind(data.deviceId).first();
   if(!saved||saved.registration_hash!==registrationHash||saved.revoked_at!==null)fail('Geräteanmeldung nicht bestätigt oder Gerätelimit erreicht.');
   return {ok:true,deviceId:saved.id,expiresAt:saved.expires_at,duplicate:false,mode:phase.mode};
  }
  if(path==='/admin/storage-state/revoke'){
   if(!uuid(data.deviceId))fail('Ungültige Gerätekennung.',400);
   const target=await env.DB.prepare('SELECT id FROM storage_devices WHERE id=? AND run=? AND source_hash=?').bind(data.deviceId,data.run,data.source).first();if(!target)fail('Gerät nicht gefunden.',404);
   await env.DB.prepare('UPDATE storage_devices SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND run=? AND source_hash=?').bind(Date.now(),data.deviceId,data.run,data.source).run();return {ok:true};
  }
  if(path==='/storage-state/read'){
   const value=await L.open(env,row.payload,purpose(data.run));await device(env,data,auth);
   return {value,version:row.version,...phase};
  }
  if(path!=='/storage-state/write')fail('Nicht gefunden.',404);
  if(!uuid(data.operationId)||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<1)fail('Ungültiger Speichervorgang.',400);
  const value=state(data.value),digest=await hash(JSON.stringify({expectedVersion:data.expectedVersion,value}));
  const previous=await env.DB.prepare('SELECT * FROM storage_state_receipts WHERE run=? AND operation_id=?').bind(data.run,data.operationId).first();
  if(previous){if(previous.device_id!==actor.id||previous.digest!==digest)fail('Die Vorgangskennung wurde bereits anders verwendet.');return {version:previous.version,currentVersion:row.version,duplicate:true,mode:phase.mode};}
  if(row.version!==data.expectedVersion)fail('Der Datenstand wurde gleichzeitig geändert. Lokale Änderungen behalten und erneut vergleichen.');
  const payload=await L.seal(env,value,purpose(data.run)),version=data.expectedVersion+1;
  const access=g.StorageRuntime?await g.StorageRuntime.role(env,actor):'state';
  const runtimeGuard=access==='application-admin'?"EXISTS(SELECT 1 FROM storage_runtime WHERE run=? AND source_hash=?)":"NOT EXISTS(SELECT 1 FROM storage_runtime WHERE run=?)";
  const runtimeArgs=access==='application-admin'?[data.run,data.source]:[data.run];
  // Check revocation and expiry again inside the same transaction as the CAS.
  const result=await env.DB.batch([
   env.DB.prepare('UPDATE storage_states SET payload=?,version=version+1 WHERE run=? AND source_hash=? AND version=? AND EXISTS(SELECT 1 FROM storage_devices WHERE id=? AND token_hash=? AND run=? AND revoked_at IS NULL AND expires_at>?) AND '+runtimeGuard).bind(payload,data.run,data.source,data.expectedVersion,actor.id,actor.token_hash,data.run,Date.now(),...runtimeArgs),
   env.DB.prepare('INSERT OR IGNORE INTO storage_state_receipts(run,operation_id,device_id,digest,version) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM storage_states WHERE run=? AND payload=? AND version=?)').bind(data.run,data.operationId,actor.id,digest,version,data.run,payload,version),
   env.DB.prepare('INSERT OR IGNORE INTO storage_state_versions(run,version,payload,saved_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM storage_states WHERE run=? AND payload=? AND version=?)').bind(data.run,row.version,row.payload,Date.now(),data.run,payload,version)
  ]);
  // Do not infer success from the HTTP delivery or a prior read.
  const receipt=await env.DB.prepare('SELECT * FROM storage_state_receipts WHERE run=? AND operation_id=?').bind(data.run,data.operationId).first();
  if(!receipt||receipt.device_id!==actor.id||receipt.digest!==digest)fail('Speicherung nicht bestätigt. Denselben Vorgang erneut prüfen.');
  return {version:receipt.version,currentVersion:receipt.version,duplicate:!result[0].meta.changes,mode:phase.mode};
 }
 g.StorageState={route,assertSource:checkSource,tokenDevice};
})(globalThis);
