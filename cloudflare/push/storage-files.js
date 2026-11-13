/* Versioned private file rehearsal. Only the existing server administrator may access it. */
(function(g){
 'use strict';
 const L=g.CentralLedger,M=g.StorageMigration,utf=new TextEncoder(),dec=new TextDecoder(),MAX=8*1024*1024;
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
 const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 async function sha(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
 const pathId=path=>sha(utf.encode(path));
 function validPath(path,{root=false}={}){
  if(root&&path==='')return path;
  if(typeof path!=='string'||!path||path.length>1000||path!==path.normalize('NFC')||/[\\\x00-\x1f\x7f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||path.split('/').length>32)fail('Ungültiger Dateipfad.',400);
  if(path==='feuerwehr-wasser-daten.json')fail('Die Stammdatendatei wird über den getrennten Datenspeicher verwaltet.',400);
  return path;
 }
 const parentPath=path=>path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
 const get=(env,run,id)=>env.DB.prepare('SELECT * FROM storage_files WHERE run=? AND id=?').bind(run,id).first();
 const purpose=(run,id)=>'storage-file-meta/v1:'+run+':'+id;
 async function open(env,row){const value=await L.open(env,row.payload,purpose(row.run,row.id));if(await pathId(value.path)!==row.id)fail('Dateimetadaten konnten nicht bestätigt werden.',503);return value;}
 async function details(env,row){const value=await open(env,row);return {id:row.id,path:value.path,name:value.path.split('/').pop(),kind:row.kind,version:row.version,size:value.size||0,modifiedAt:value.modifiedAt,deleted:row.deleted_at!==null};}
 async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf.encode('ffw-storage-files/v1:'+env.INVITE_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
 const aad=(run,id,op)=>utf.encode('storage-file/v1:'+run+':'+id+':'+op);
 async function content(env,run,id,value){
  if(value.snapshot)return M.verifiedFile(env,value.source,run,value.path);
  const object=await env.MIGRATION_FILES.get(value.object);if(!object)fail('Die gespeicherte Dateiversion fehlt.',503);
  const packed=new Uint8Array(await object.arrayBuffer());let bytes;
  try{bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:packed.slice(0,12),additionalData:aad(run,id,value.operationId)},await key(env),packed.slice(12)));}catch{fail('Die gespeicherte Dateiversion konnte nicht geprüft werden.',503);}
  if(bytes.length!==value.size||await sha(bytes)!==value.sha256)fail('Die gespeicherte Dateiversion ist unvollständig.',503);return bytes;
 }
 async function save(env,data,old,kind,value,deletedAt=null){
  const id=await pathId(value.path),parent=await pathId(parentPath(value.path)),version=(old?.version||0)+1,payload=await L.seal(env,value,purpose(data.run,id));
  const root=await pathId(''),actor=data._actor,parentGuard=(parent===root?'1=1':"EXISTS(SELECT 1 FROM storage_files p WHERE p.run=? AND p.id=? AND p.kind='folder' AND p.deleted_at IS NULL)")+(actor?' AND EXISTS(SELECT 1 FROM storage_devices d JOIN storage_runtime r ON r.run=d.run AND r.source_hash=d.source_hash WHERE d.id=? AND d.token_hash=? AND d.revoked_at IS NULL AND d.expires_at>?)':'');
  const parentArgs=[...(parent===root?[]:[data.run,parent]),...(actor?[actor.id,actor.token_hash,Date.now()]:[])];
  // Atomic version check also prevents creation beneath a concurrently deleted parent.
  const q=old?env.DB.prepare('UPDATE storage_files SET payload=?,version=?,deleted_at=? WHERE run=? AND id=? AND version=? AND '+parentGuard+(kind==='folder'&&deletedAt!==null?' AND NOT EXISTS(SELECT 1 FROM storage_files c WHERE c.run=? AND c.parent=? AND c.deleted_at IS NULL)':'')).bind(payload,version,deletedAt,data.run,id,old.version,...parentArgs,...(kind==='folder'&&deletedAt!==null?[data.run,id]:[])):
   env.DB.prepare('INSERT OR IGNORE INTO storage_files(run,id,parent,kind,payload,version) SELECT ?,?,?,?,?,1 WHERE '+parentGuard).bind(data.run,id,parent,kind,payload,...parentArgs);
  const guard='EXISTS(SELECT 1 FROM storage_files WHERE run=? AND id=? AND payload=? AND version=?)';
  const batch=[q];
  if(old)batch.push(env.DB.prepare('INSERT OR IGNORE INTO storage_file_versions(run,id,version,payload,deleted_at) SELECT ?,?,?,?,? WHERE '+guard).bind(data.run,id,old.version,old.payload,old.deleted_at,data.run,id,payload,version));
  batch.push(env.DB.prepare('INSERT OR IGNORE INTO storage_file_receipts(run,operation_id,digest,id,version) SELECT ?,?,?,?,? WHERE '+guard).bind(data.run,data.operationId,data.digest,id,version,data.run,id,payload,version));
  await env.DB.batch(batch);
  const receipt=await env.DB.prepare('SELECT * FROM storage_file_receipts WHERE run=? AND operation_id=?').bind(data.run,data.operationId).first();
  if(!receipt||receipt.digest!==data.digest||receipt.id!==id)fail('Die Datei wurde gleichzeitig geändert. Denselben Vorgang erneut prüfen.');
  return {id,version:receipt.version,mode:'rehearsal',liveStorage:'onedrive'};
 }
 async function route(path,request,env,auth){
  const actor=equal(auth,env.ADMIN_TOKEN)?null:g.StorageRuntime?await g.StorageRuntime.administrator(env,auth):fail('Admin-Zugang ungültig.',401);
  if(!env.MIGRATION_FILES)fail('Die private Dateiablage fehlt.',503);
  const upload=path==='/admin/storage-files/write',raw=await M.bounded(request,upload?MAX+8192:6000);
  let data,bytes;
  try{if(upload){const newline=raw.indexOf(10);if(newline<0||newline>8000)fail('Ungültiger Dateiheader.',400);data=JSON.parse(dec.decode(raw.slice(0,newline)));bytes=raw.slice(newline+1);}else data=JSON.parse(dec.decode(raw));}catch(error){if(error.status)throw error;fail('Ungültige Anfrage.',400);}
  if(!data||typeof data!=='object'||Array.isArray(data)||!hex(data.run))fail('Ungültige Anfrage.',400);
  if(actor&&(data.run!==actor.run||data.source!==actor.source_hash))fail('Ein anderer Datenstand ist nicht freigegeben.',403);data._actor=actor;
  await g.StorageState.assertSource(env,data);
  if(!await env.DB.prepare('SELECT run FROM storage_states WHERE run=? AND source_hash=?').bind(data.run,data.source).first())fail('Der getrennte Datenstand ist noch nicht vorbereitet.');
  if(path==='/admin/storage-files/prepare'){
   if(actor)fail('Die Erstübernahme benötigt den ursprünglichen Dienstzugang.',403);
   const path=validPath(data.path),manifest=await M.verifiedManifest(env,data.source,data.run),file=manifest.files.find(f=>f.path===path);
   if(!file)fail('Die Datei fehlt in der bestätigten Übernahme.',404);
   if(typeof data.modifiedAt!=='string'||!Number.isFinite(Date.parse(data.modifiedAt)))fail('Ungültiges Änderungsdatum.',400);
   const parts=path.split('/'),rows=[];
   for(let index=1;index<=parts.length;index++){
    const itemPath=parts.slice(0,index).join('/'),id=await pathId(itemPath),kind=index===parts.length?'file':'folder';
    if(kind==='folder'&&manifest.files.some(f=>f.path===itemPath))fail('Ein Dateiname überschneidet sich mit einem Ordner.');
    const parent=await pathId(parentPath(itemPath)),root=parentPath(itemPath)==='';
    rows.push(env.DB.prepare('INSERT OR IGNORE INTO storage_files(run,id,parent,kind,payload,version) SELECT ?,?,?,?,?,1 WHERE '+(root?'1=1':"EXISTS(SELECT 1 FROM storage_files p WHERE p.run=? AND p.id=? AND p.kind='folder' AND p.deleted_at IS NULL)")).bind(data.run,id,parent,kind,await L.seal(env,{path:itemPath,modifiedAt:data.modifiedAt,...(kind==='file'?{size:file.size,sha256:file.sha256,snapshot:true,source:data.source}:{})},purpose(data.run,id)),...(root?[]:[data.run,parent])));
   }
   await env.DB.batch(rows);const saved=await get(env,data.run,await pathId(path));if(!saved||saved.kind!=='file'||saved.deleted_at!==null)fail('Der Dateipfad wurde bereits geändert oder gelöscht.');return {ok:true,mode:'rehearsal',liveStorage:'onedrive'};
  }
  if(path==='/admin/storage-files/list'){
   const parent=validPath(data.path,{root:true}),id=await pathId(parent);
   if(parent){const folder=await get(env,data.run,id);if(!folder||folder.kind!=='folder'||folder.deleted_at!==null)fail('Ordner nicht gefunden.',404);}
   const rows=(await env.DB.prepare('SELECT * FROM storage_files WHERE run=? AND parent=? AND deleted_at IS NULL ORDER BY id').bind(data.run,id).all()).results;
   const items=[];for(const row of rows){const item=await details(env,row);if(!actor||!/(?:^|\/)push-verbindung\.json$/i.test(item.path))items.push(item);}return {items};
  }
  let filePath=data.path;
  if(filePath===undefined&&hex(data.id)){const byId=await get(env,data.run,data.id);if(!byId)fail('Datei nicht gefunden.',404);filePath=(await open(env,byId)).path;}
  filePath=validPath(filePath);if(actor&&/(?:^|\/)push-verbindung\.json$/i.test(filePath))fail('Der ursprüngliche Dienstzugang wird nicht an Geräte ausgegeben.',403);
  const id=await pathId(filePath),old=await get(env,data.run,id);
  if(path==='/admin/storage-files/stat'){if(!old||old.deleted_at!==null)fail('Datei nicht gefunden.',404);return details(env,old);}
  if(path==='/admin/storage-files/read'){
   if(!old)fail('Datei nicht gefunden.',404);let record=old;
   if(data.version!==undefined){if(!Number.isSafeInteger(data.version)||data.version<1)fail('Ungültige Dateiversion.',400);if(data.version!==old.version){const version=await env.DB.prepare('SELECT * FROM storage_file_versions WHERE run=? AND id=? AND version=?').bind(data.run,id,data.version).first();if(!version)fail('Dateiversion nicht gefunden.',404);record={...old,...version};}}
   if(record.deleted_at!==null||record.kind!=='file')fail('Datei nicht gefunden.',404);
   const bytes=await content(env,data.run,id,await open(env,record));if(actor)await g.StorageRuntime.administrator(env,auth);return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(!['/admin/storage-files/write','/admin/storage-files/mkdir','/admin/storage-files/delete','/admin/storage-files/restore'].includes(path))fail('Nicht gefunden.',404);
  if(!uuid(data.operationId)||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültiger Dateivorgang.',400);
  if(upload&&bytes.length>MAX)fail('Dateien dürfen höchstens 8 MiB groß sein.',413);
  const kind=path.endsWith('/mkdir')?'folder':upload?'file':old?.kind;
  data.digest=await hash(JSON.stringify({action:path,path:filePath,version:data.expectedVersion,...(upload?{size:bytes.length,sha256:await sha(bytes)}:{}),...(path.endsWith('/restore')?{restoreVersion:data.restoreVersion}:{})}));
  const previous=await env.DB.prepare('SELECT * FROM storage_file_receipts WHERE run=? AND operation_id=?').bind(data.run,data.operationId).first();
  if(previous){if(previous.digest!==data.digest||previous.id!==id)fail('Die Vorgangskennung wurde bereits anders verwendet.');return {id,version:previous.version,duplicate:true,mode:'rehearsal',liveStorage:'onedrive'};}
  if((old?.version||0)!==data.expectedVersion)fail('Die Dateiversion wurde gleichzeitig geändert.');
  if(path.endsWith('/restore')){
   if(!old||!Number.isSafeInteger(data.restoreVersion)||data.restoreVersion<1||data.restoreVersion>=old.version)fail('Ungültige Wiederherstellungsversion.',400);
   const archived=await env.DB.prepare('SELECT * FROM storage_file_versions WHERE run=? AND id=? AND version=?').bind(data.run,id,data.restoreVersion).first();
   if(!archived||archived.deleted_at!==null)fail('Wiederherstellbare Dateiversion nicht gefunden.',404);
   const value=await open(env,{...old,...archived});if(old.kind==='file')await content(env,data.run,id,value);
   return save(env,data,old,old.kind,{...value,modifiedAt:new Date().toISOString()});
  }
  if(path.endsWith('/delete')){if(!old||old.deleted_at!==null)fail('Datei nicht gefunden.',404);return save(env,data,old,old.kind,await open(env,old),Date.now());}
  if(old&&(old.kind!==kind||old.deleted_at!==null))fail('Der Pfad ist bereits anders belegt oder gelöscht.');
  if(kind==='folder'&&old)fail('Der Ordner ist bereits vorhanden.');
  let value={path:filePath,modifiedAt:new Date().toISOString()};
  if(upload){
   const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(data.run,id,data.operationId)},await key(env),bytes)),packed=new Uint8Array(iv.length+encrypted.length);packed.set(iv);packed.set(encrypted,iv.length);
   value={...value,size:bytes.length,sha256:await sha(bytes),operationId:data.operationId};value.object='files/v1/'+data.run+'/'+id+'/'+data.operationId+'/'+value.sha256;
   await env.MIGRATION_FILES.put(value.object,packed,{httpMetadata:{contentType:'application/octet-stream'}});await content(env,data.run,id,value);
  }
  return save(env,data,old,kind,value);
 }
 g.StorageFiles={route};
})(globalThis);
