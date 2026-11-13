/* Private, resumable migration snapshots. Deliberately no live cutover endpoint. */
(function(g){
 'use strict';
 const utf=new TextEncoder(),MAX_FILE=8*1024*1024,MAX_MANIFEST=512000;
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
 const id=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 function normalize(files){
  if(!Array.isArray(files)||!files.length||files.length>2000)fail('Die Dateiliste muss 1 bis 2000 Dateien enthalten.',400);
  const paths=new Set();
  const result=files.map(file=>{
   const path=file?.path;
   if(typeof path!=='string'||path.length>1000||path!==path.normalize('NFC')||/[\\\x00-\x1f\x7f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))fail('Ungültiger Dateipfad.',400);
   if(paths.has(path))fail('Ein Dateipfad ist mehrfach enthalten.',400);paths.add(path);
   if(!Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_FILE||!id(file.sha256))fail('Ungültige Dateigröße oder Prüfsumme. Maximal 8 MiB je Datei.',400);
   return {path,size:file.size,sha256:file.sha256};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(utf.encode(JSON.stringify(result)).length>MAX_MANIFEST)fail('Die Dateiliste ist zu groß.',413);
  return result;
 }
 async function bounded(request,max){
  if(Number(request.headers.get('Content-Length'))>max)fail('Die Anfrage ist zu groß.',413);
  const reader=request.body?.getReader(),parts=[];let size=0;
  if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail('Die Anfrage ist zu groß.',413);}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
 }
 async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf.encode('ffw-storage-migration/v1:'+env.INVITE_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
 const purpose=(run,file)=>'storage-migration/v1:'+run+':'+file.sha256+':'+file.path;
 const objectKey=(run,fileId)=>'migration/v1/'+run+'/'+fileId;
 async function unpack(env,run,file,bytes){
  const data=new Uint8Array(bytes);
  if(data.length<28)fail('Die gespeicherte Datei ist unvollständig.',503);
  let plain;try{plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:utf.encode(purpose(run,file))},await key(env),data.slice(12)));}catch{fail('Die gespeicherte Datei konnte nicht geprüft werden.',503);}
  if(plain.length!==file.size||await digest(plain)!==file.sha256)fail('Die gespeicherte Datei stimmt nicht mit dem Original überein.',503);
  return plain;
 }
 async function readObject(env,run,fileId,file){
  const object=await env.MIGRATION_FILES.get(objectKey(run,fileId));
  if(!object)fail('Die übernommene Datei fehlt.',503);
  return unpack(env,run,file,await object.arrayBuffer());
 }
 async function receipt(env,run,fileId){return env.DB.prepare('SELECT * FROM storage_migration_files WHERE migration_id=? AND file_id=?').bind(run,fileId).first();}
 async function stats(env,run){return env.DB.prepare('SELECT COUNT(*) AS files,COALESCE(SUM(size),0) AS bytes FROM storage_migration_files WHERE migration_id=?').bind(run).first();}
 async function route(path,request,env,auth){
  // Defense in depth: direct callers must pass the same server-side admin check.
  if(!env.ADMIN_TOKEN||!equal(auth,env.ADMIN_TOKEN))fail('Admin-Zugang ungültig.',401);
  if(!env.MIGRATION_FILES)fail('Der private Cloudflare-Übernahmespeicher ist noch nicht eingerichtet.',503);
  const upload=path==='/admin/storage-migration/upload';
  let data;
  if(upload){const params=new URL(request.url).searchParams;data={source:params.get('source'),run:params.get('run'),fileId:params.get('file')};}
  else{try{data=JSON.parse(new TextDecoder().decode(await bounded(request,MAX_MANIFEST+10000)));}catch(error){if(error.status)throw error;fail('Ungültige Anfrage.',400);}if(!data||typeof data!=='object'||Array.isArray(data))fail('Ungültige Anfrage.',400);}
  // Source identity deliberately remains unchanged so existing phone/widget credentials survive.
  const ledger=await g.CentralLedger.meta(env);
  if(!ledger||ledger.state!=='active')fail('Die bestehende H₂O-Datenquelle ist noch nicht aktiv.');
  const sourceHash=await digest(utf.encode(ledger.source));
  if(!equal(data.source,sourceHash))fail('Die Übernahme gehört zu einer anderen Datenquelle.');
  if(path==='/admin/storage-migration/start'){
   const files=normalize(data.files),run=await digest(utf.encode(JSON.stringify({version:1,source:sourceHash,files})));
   for(const file of files)file.fileId=await digest(utf.encode(file.path));
   await env.DB.prepare("INSERT OR IGNORE INTO storage_migrations(id,source_hash,manifest,state,created_at) VALUES(?,?,?,'staging',?)").bind(run,sourceHash,await g.CentralLedger.seal(env,{version:1,files},'storage-manifest:'+run),Date.now()).run();
   const row=await env.DB.prepare('SELECT state FROM storage_migrations WHERE id=? AND source_hash=?').bind(run,sourceHash).first();
   return {version:1,run,state:row.state,expectedFiles:files.length,expectedBytes:files.reduce((sum,f)=>sum+f.size,0),...await stats(env,run),liveStorage:'onedrive'};
  }
  if(!id(data.run))fail('Ungültige Übernahmekennung.',400);
  const row=await env.DB.prepare('SELECT * FROM storage_migrations WHERE id=? AND source_hash=?').bind(data.run,sourceHash).first();
  if(!row)fail('Die Übernahme wurde nicht gefunden.',404);
  const manifest=await g.CentralLedger.open(env,row.manifest,'storage-manifest:'+data.run),files=manifest.files;
  if(path==='/admin/storage-migration/status')return {version:1,run:data.run,state:row.state,expectedFiles:files.length,expectedBytes:files.reduce((sum,f)=>sum+f.size,0),...await stats(env,data.run),liveStorage:'onedrive'};
  if(path==='/admin/storage-migration/verify'){
   const current=await stats(env,data.run);
   if(current.files!==files.length||current.bytes!==files.reduce((sum,f)=>sum+f.size,0))fail('Die Übernahme ist noch nicht vollständig.');
   await env.DB.prepare("UPDATE storage_migrations SET state='verified',verified_at=? WHERE id=? AND state='staging'").bind(Date.now(),data.run).run();
   return {version:1,run:data.run,state:'verified',...current,liveStorage:'onedrive'};
  }
  if(!upload&&path!=='/admin/storage-migration/read')fail('Nicht gefunden.',404);
  if(!id(data.fileId))fail('Ungültige Dateikennung.',400);
  const file=files.find(candidate=>candidate.fileId===data.fileId);
  if(!file)fail('Die Datei gehört nicht zur geprüften Dateiliste.',404);
  if(!upload){
   if(!await receipt(env,data.run,data.fileId))fail('Die Datei wurde noch nicht übernommen.',404);
   return new Response(await readObject(env,data.run,data.fileId,file),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  const bytes=await bounded(request,MAX_FILE);
  if(bytes.length!==file.size||await digest(bytes)!==file.sha256)fail('Die Datei wurde verändert. Bitte eine neue Bestandsaufnahme erstellen.',409);
  const previous=await receipt(env,data.run,data.fileId);
  if(previous){await readObject(env,data.run,data.fileId,file);return {ok:true,duplicate:true};}
  if(row.state!=='staging')fail('Diese Übernahme ist bereits abgeschlossen.');
  const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf.encode(purpose(data.run,file))},await key(env),bytes)),packed=new Uint8Array(iv.length+cipher.length);packed.set(iv);packed.set(cipher,iv.length);
  await env.MIGRATION_FILES.put(objectKey(data.run,data.fileId),packed,{httpMetadata:{contentType:'application/octet-stream'}});
  // D1 receipt exists only after decrypting and hashing a fresh R2 read.
  await readObject(env,data.run,data.fileId,file);
  await env.DB.prepare('INSERT OR IGNORE INTO storage_migration_files(migration_id,file_id,size,sha256,verified_at) VALUES(?,?,?,?,?)').bind(data.run,data.fileId,file.size,file.sha256,Date.now()).run();
  return {ok:true,duplicate:false};
 }
 async function verifiedManifest(env,sourceHash,run){
  if(!id(sourceHash)||!id(run))fail('Ungültige Übernahmekennung.',400);
  const row=await env.DB.prepare("SELECT manifest FROM storage_migrations WHERE id=? AND source_hash=? AND state='verified'").bind(run,sourceHash).first();
  if(!row)fail('Eine vollständig geprüfte Übernahme wird benötigt.');
  return g.CentralLedger.open(env,row.manifest,'storage-manifest:'+run);
 }
 async function verifiedFile(env,sourceHash,run,path){
  const manifest=await verifiedManifest(env,sourceHash,run),file=manifest.files.find(f=>f.path===path);
  if(!file)fail('Die erforderliche Datei fehlt in der Übernahme.',404);
  if(!await receipt(env,run,file.fileId))fail('Die erforderliche Datei wurde nicht bestätigt.');
  return readObject(env,run,file.fileId,file);
 }
 g.StorageMigration={route,verifiedFile,verifiedManifest,bounded};
})(globalThis);
