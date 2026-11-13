#!/usr/bin/env node
'use strict';
// Read-only source export -> private migration snapshot. Never switches live storage.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_FILE=8*1024*1024;
async function inventory(directory){
 const files=[];
 async function walk(folder,relative=''){
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
   const name=relative?relative+'/'+entry.name:entry.name,absolute=path.join(folder,entry.name);
   if(entry.isSymbolicLink())throw Error('Symbolische Links sind im Export nicht erlaubt.');
   if(entry.isDirectory())await walk(absolute,name);
   else if(entry.isFile()){
    if(name!==name.normalize('NFC')||/[\\\x00-\x1f\x7f]/.test(name))throw Error('Der Export enthält einen nicht unterstützten Dateipfad.');
    const stat=await fs.stat(absolute);if(stat.size>MAX_FILE)throw Error('Der Export enthält eine Datei über 8 MiB. Die Übernahme wurde nicht gestartet.');
    const bytes=await fs.readFile(absolute);files.push({path:name,size:bytes.length,sha256:sha(bytes)});
   }else throw Error('Der Export enthält eine nicht unterstützte Datei.');
  }
 }
 await walk(directory);
 return files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function settings(env){
 let origin;try{origin=new URL(env.H2O_WORKER_ORIGIN);}catch{throw Error('H2O_WORKER_ORIGIN fehlt oder ist ungültig.');}
 if(origin.protocol!=='https:'||!/^[-a-z0-9]+\.[-a-z0-9]+\.workers\.dev$/.test(origin.hostname)||origin.pathname!=='/'||origin.search||origin.hash||origin.port||origin.username||origin.password)throw Error('Nur die HTTPS-Adresse des bestehenden Workers ist erlaubt.');
 if(!env.H2O_ADMIN_TOKEN||env.H2O_ADMIN_TOKEN.length<40||!env.H2O_SOURCE||env.H2O_SOURCE.length>500)throw Error('H2O_ADMIN_TOKEN und H2O_SOURCE werden benötigt. Zugangsdaten nur über die Umgebung übergeben.');
 return {origin:origin.origin,token:env.H2O_ADMIN_TOKEN,source:sha(env.H2O_SOURCE)};
}
async function migrate(directory,env=process.env,{fetcher=fetch,log=console.log}={}){
 const config=settings(env),files=await inventory(directory);
 if(!files.length||files.length>2000)throw Error('Der Export muss 1 bis 2000 Dateien enthalten.');
 if(Buffer.byteLength(JSON.stringify(files))>512000)throw Error('Die Dateiliste ist zu groß.');
 async function call(action,data={},bytes){
  const query=bytes!==undefined?'?'+new URLSearchParams({source:config.source,run:data.run,file:data.fileId}):'';
  const response=await fetcher(config.origin+'/admin/storage-migration/'+action+query,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+config.token,'Content-Type':bytes!==undefined?'application/octet-stream':'application/json'},body:bytes!==undefined?bytes:JSON.stringify({source:config.source,...data})});
  if(!response.ok)throw Error('Cloudflare hat den Schritt nicht bestätigt (HTTP '+response.status+'). Nach Behebung denselben Export erneut starten.');
  return action==='read'?Buffer.from(await response.arrayBuffer()):response.json();
 }
 // Credentials and source identity are deliberately never included in progress output.
 log('Bestandsaufnahme abgeschlossen: '+files.length+' Dateien.');
 const start=await call('start',{files}),run=start.run;
 if(typeof run!=='string'||!/^[a-f0-9]{64}$/.test(run))throw Error('Ungültige Übernahmeantwort.');
 for(let index=0;index<files.length;index++){
  const file=files[index],fileId=sha(file.path),absolute=path.join(directory,...file.path.split('/'));
  // Recheck source on every attempt; do not copy modified content under an old manifest.
  if((await fs.lstat(absolute)).isSymbolicLink())throw Error('Der Export wurde während der Übernahme verändert.');
  const bytes=await fs.readFile(absolute);
  if(bytes.length!==file.size||sha(bytes)!==file.sha256)throw Error('Der Export wurde während der Übernahme verändert.');
  await call('upload',{run,fileId},bytes);
  const copy=await call('read',{run,fileId});
  if(copy.length!==file.size||sha(copy)!==file.sha256)throw Error('Die nachgelesene Cloudflare-Kopie stimmt nicht mit dem Export überein.');
  log('Kopiert und nachgelesen: '+(index+1)+' / '+files.length);
 }
 const after=await inventory(directory);
 if(JSON.stringify(after)!==JSON.stringify(files))throw Error('Der Export wurde während der Übernahme verändert. Keine vollständige Übernahme bestätigt.');
 const result=await call('verify',{run});
 if(result.state!=='verified'||result.files!==files.length||result.bytes!==files.reduce((n,f)=>n+f.size,0)||result.liveStorage!=='onedrive')throw Error('Die Abschlussprüfung wurde nicht bestätigt.');
 log('Übernahmekopie vollständig geprüft. OneDrive bleibt aktiv. Kennung: '+run);
 return result;
}
module.exports={inventory,settings,migrate};
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==1){console.error('Aufruf: node scripts/migrate-onedrive-snapshot.cjs /absoluter/pfad/zum/export');process.exitCode=2;}
 else migrate(path.resolve(args[0])).catch(()=>{console.error('Übernahme nicht abgeschlossen. Voraussetzungen, Dateigrößen und unveränderten Export prüfen; denselben Vorgang erneut starten. OneDrive bleibt aktiv.');process.exitCode=1;});
}
