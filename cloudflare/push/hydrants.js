/* Private plans: encrypted chunks, atomic publication, no public file URLs. */
(function(g){
'use strict';
const L=g.CentralLedger,CHUNK=196608,MAX=8*1024*1024;
const schema=[
 'CREATE TABLE IF NOT EXISTS portal_plan_versions (id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS portal_plan_chunks (version TEXT NOT NULL,part INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(version,part))',
 'CREATE TABLE IF NOT EXISTS portal_plan_current (id INTEGER PRIMARY KEY CHECK(id=1),version TEXT NOT NULL)'
];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const hex=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
async function version(env,id){
 if(!validId(id))fail('Ungültige Planversion.');
 const row=await env.DB.prepare('SELECT * FROM portal_plan_versions WHERE id=?').bind(id).first();
 if(!row)fail('Planversion nicht verfügbar. Bitte erneut laden.',404);
 return L.open(env,row.payload,'plan-meta:'+id);
}
async function route(path,data,env,admin){
 const action=path.split('/').pop();
 if(admin&&action==='begin'){
  if(!Number.isInteger(data.size)||data.size<5||data.size>MAX||typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256))fail('Bitte eine PDF bis 8 MB verwenden.');
  const id=crypto.randomUUID(),meta={version:id,title:'Hydrantenplan Wasser',fileName:'Hydrantenplan-Wasser.pdf',size:data.size,sha256:data.sha256,parts:Math.ceil(data.size/CHUNK),chunkSize:CHUNK,updatedAt:Date.now()};
  // Remove abandoned uploads, retaining the last published plan.
  const current=await env.DB.prepare('SELECT version FROM portal_plan_current WHERE id=1').first();
  await env.DB.batch([
   env.DB.prepare('DELETE FROM portal_plan_chunks WHERE version IN (SELECT id FROM portal_plan_versions WHERE created_at<? AND id<>?)').bind(Date.now()-3600000,current?.version||''),
   env.DB.prepare('DELETE FROM portal_plan_versions WHERE created_at<? AND id<>?').bind(Date.now()-3600000,current?.version||'')
  ]);
  await env.DB.prepare('INSERT INTO portal_plan_versions(id,payload,created_at) VALUES(?,?,?)').bind(id,await L.seal(env,meta,'plan-meta:'+id),Date.now()).run();
  return {plan:meta};
 }
 if(admin&&action==='chunk'){
  const meta=await version(env,data.version),current=await env.DB.prepare('SELECT version FROM portal_plan_current WHERE id=1').first();
  if(current?.version===data.version)fail('Veröffentlichte Pläne können nicht verändert werden.',409);
  if(!Number.isInteger(data.part)||data.part<0||data.part>=meta.parts||typeof data.bytes!=='string'||data.bytes.length>262144||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.bytes))fail('Ungültiger Planabschnitt.');
  const bytes=atob(data.bytes),expected=Math.min(CHUNK,meta.size-data.part*CHUNK);
  if(bytes.length!==expected)fail('Unvollständiger Planabschnitt.');
  await env.DB.prepare('INSERT OR IGNORE INTO portal_plan_chunks(version,part,payload) VALUES(?,?,?)').bind(data.version,data.part,await L.seal(env,{bytes:data.bytes},'plan-chunk:'+data.version+':'+data.part)).run();
  const saved=await env.DB.prepare('SELECT payload FROM portal_plan_chunks WHERE version=? AND part=?').bind(data.version,data.part).first();
  if(!saved||(await L.open(env,saved.payload,'plan-chunk:'+data.version+':'+data.part)).bytes!==data.bytes)fail('Planabschnitt bereits anders übertragen. Bitte neu abgleichen.',409);
  return {ok:true};
 }
 if(admin&&action==='publish'){
  const meta=await version(env,data.version),rows=(await env.DB.prepare('SELECT * FROM portal_plan_chunks WHERE version=? ORDER BY part').bind(meta.version).all()).results;
  if(rows.length!==meta.parts)fail('Der Plan ist noch nicht vollständig übertragen.',409);
  const bytes=new Uint8Array(meta.size);
  for(let part=0;part<rows.length;part++){
   if(rows[part].part!==part)fail('Planabschnitt fehlt.',409);
   const raw=atob((await L.open(env,rows[part].payload,'plan-chunk:'+meta.version+':'+part)).bytes);
   bytes.set(Uint8Array.from(raw,c=>c.charCodeAt(0)),part*CHUNK);
  }
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||hex(await crypto.subtle.digest('SHA-256',bytes))!==meta.sha256)fail('Die PDF-Prüfung ist fehlgeschlagen.',409);
  await env.DB.prepare('INSERT INTO portal_plan_current(id,version) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version').bind(meta.version).run();
  return {ok:true,plan:meta};
 }
 if(!admin&&(action==='info'||action==='part')){
  const row=await env.DB.prepare('SELECT version FROM portal_plan_current WHERE id=1').first();
  if(!row)fail('Der Hydrantenplan wurde noch nicht vom Gerätehaus-iPad abgeglichen.',404);
  const meta=await version(env,row.version);
  if(action==='info')return {plan:meta};
  if(data.version!==row.version)fail('Der Plan wurde aktualisiert. Bitte erneut laden.',409);
  if(!Number.isInteger(data.part)||data.part<0||data.part>=meta.parts)fail('Ungültiger Planabschnitt.');
  const chunk=await env.DB.prepare('SELECT payload FROM portal_plan_chunks WHERE version=? AND part=?').bind(meta.version,data.part).first();
  if(!chunk)fail('Planabschnitt nicht verfügbar.',503);
  return L.open(env,chunk.payload,'plan-chunk:'+meta.version+':'+data.part);
 }
 fail('Nicht gefunden.',404);
}
g.PortalHydrants={schema,route};
})(globalThis);
