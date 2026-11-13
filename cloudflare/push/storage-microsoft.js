/* One-time Microsoft folder proof; ongoing storage remains on Cloudflare. */
(function(g){
 'use strict';
 const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
 async function settings(env){
  const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='storage_microsoft'").first();
  const runtime=await g.StorageRuntime.current(env),row=table&&await env.DB.prepare('SELECT * FROM storage_microsoft WHERE id=1').first();
  return runtime&&row?.run===runtime.run&&row.source_hash===runtime.source_hash?row:null;
 }
 async function route(path,data,env,auth){
  if(path==='/admin/storage-runtime/microsoft'){
   await g.StorageRuntime.adminScope(env,auth);
   const runtime=await g.StorageRuntime.current(env);if(!runtime)fail('Cloudflare ist noch nicht aktiviert.',409);
   if(data.clientId===''){await env.DB.prepare('DELETE FROM storage_microsoft WHERE id=1').run();return {ok:true};}
   if(!uuid(data.clientId))fail('Bitte eine gültige Microsoft-Anwendungs-ID eingeben.',400);
   await env.DB.prepare('INSERT INTO storage_microsoft(id,client_id,run,source_hash) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,run=excluded.run,source_hash=excluded.source_hash').bind(data.clientId,runtime.run,runtime.source_hash).run();return {ok:true};
  }
  const cfg=await settings(env);if(!cfg)fail('Die Microsoft-Anmeldung muss einmal auf einem verbundenen Verwaltungsgerät eingerichtet werden.',409);
  if(path==='/storage/microsoft/config')return {clientId:cfg.client_id};
  if(path!=='/storage/microsoft/enroll')fail('Nicht gefunden.',404);
  if(typeof data.accessToken!=='string'||data.accessToken.length<20||data.accessToken.length>5000||/[\s\x00-\x1f]/.test(data.accessToken)||!uuid(data.deviceId)||typeof data.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.token)||typeof data.label!=='string'||!data.label.trim()||data.label.length>100||/[\x00-\x1f\x7f]/.test(data.label))fail('Ungültige Microsoft-Einrichtung.',400);
  const ledger=await g.CentralLedger.meta(env),source=ledger?.source||'',index=source.indexOf(':');
  if(ledger?.state!=='active'||index<1||Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source))),x=>x.toString(16).padStart(2,'0')).join('')!==cfg.source_hash)fail('Die Datenquelle wurde geändert.',409);
  const drive=source.slice(0,index),item=source.slice(index+1),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let response,folder;
  try{response=await fetch('https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(drive)+'/items/'+encodeURIComponent(item)+'?$select=id,parentReference,folder,deleted',{headers:{Authorization:'Bearer '+data.accessToken},redirect:'error',signal:controller.signal});if(response.ok)folder=await response.json();}catch{fail('Microsoft ist derzeit nicht erreichbar. Bitte erneut versuchen.',503);}finally{clearTimeout(timer);}
  if(response.status===429||response.status>=500)fail('Microsoft ist derzeit nicht erreichbar. Bitte erneut versuchen.',503);
  if(!response.ok)fail(response.status===401?'Microsoft-Anmeldung abgelaufen. Bitte erneut anmelden.':'Dieses Microsoft-Konto hat keinen bestätigten Zugriff auf den gemeinsamen Ordner „Webseite“.',response.status===401?401:403);
  if(!folder.folder||folder.deleted||folder.id!==item||String(folder.parentReference?.driveId||'').toLowerCase()!==drive.toLowerCase())fail('Microsoft hat einen anderen Ordner zurückgegeben.');
  const registration=await hash('microsoft-enroll/v1:'+data.deviceId+':'+data.token),tokenHash=await hash('storage-device/v1:'+data.token),now=Date.now();
  const label=await g.CentralLedger.seal(env,{label:data.label,access:'application-admin'},'storage-device:'+data.deviceId);
  await env.DB.prepare('INSERT OR IGNORE INTO storage_devices(id,run,source_hash,token_hash,registration_hash,label,created_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM storage_runtime r JOIN storage_microsoft m ON m.id=r.id AND m.run=r.run AND m.source_hash=r.source_hash WHERE r.id=1 AND r.run=? AND r.source_hash=? AND m.client_id=?) AND (SELECT COUNT(*) FROM storage_devices WHERE run=? AND revoked_at IS NULL AND expires_at>?)<10').bind(data.deviceId,cfg.run,cfg.source_hash,tokenHash,registration,label,now,g.StorageRuntime.permanentExpiry,cfg.run,cfg.source_hash,cfg.client_id,cfg.run,now).run();
  const actor=await env.DB.prepare('SELECT * FROM storage_devices WHERE id=? AND registration_hash=? AND revoked_at IS NULL AND expires_at>?').bind(data.deviceId,registration,now).first();
  if(!actor)fail('Gerätezugang konnte nicht eingerichtet werden. Bitte das Gerätelimit und die Freigabe prüfen.',409);
  await g.StorageRuntime.assertDevice(env,actor);
  return {origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',run:cfg.run,source,sourceHash:cfg.source_hash,deviceId:actor.id,token:data.token,expiresAt:actor.expires_at,permanent:true};
 }
 g.StorageMicrosoft={route};
})(globalThis);
