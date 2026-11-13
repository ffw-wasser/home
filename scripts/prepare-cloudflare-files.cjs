#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {inventory}=require('./migrate-onedrive-snapshot.cjs');
const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function prepareFiles(directory,{fetcher=fetch,log=console.log}={}){
 const config=JSON.parse(await fs.readFile(path.join(directory,'Getraenke','push-verbindung.json'),'utf8')),central=JSON.parse(await fs.readFile(path.join(directory,'Getraenke','konten-zentrale.json'),'utf8'));
 if(config.origin!==ORIGIN||typeof config.token!=='string'||!/^[a-f0-9]{64}$/.test(config.token)||typeof central.source!=='string'||!central.source||central.source.length>500)throw Error('Die vorhandene Dienstverbindung ist nicht gültig.');
 const files=await inventory(directory),source=sha(central.source),run=sha(JSON.stringify({version:1,source,files}));
 async function call(action,data={},bytes){
  const value={source,run,...data},response=await fetcher(ORIGIN+'/admin/storage-files/'+action,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+config.token,'Content-Type':bytes===undefined?'application/json':'application/octet-stream'},body:bytes===undefined?JSON.stringify(value):Buffer.concat([Buffer.from(JSON.stringify(value)+'\n'),bytes])});
  if(!response.ok)throw Object.assign(Error('Cloudflare hat den Dateitest nicht bestätigt (HTTP '+response.status+').'),{status:response.status});
  return action==='read'?Buffer.from(await response.arrayBuffer()):response.json();
 }
 const documents=files.filter(file=>file.path!=='feuerwehr-wasser-daten.json');
 for(let n=0;n<documents.length;n++){
  const file=documents[n],absolute=path.join(directory,...file.path.split('/')),stat=await fs.stat(absolute);
  await call('prepare',{path:file.path,modifiedAt:stat.mtime.toISOString()});
  const copy=await call('read',{path:file.path});
  if(copy.length!==file.size||sha(copy)!==file.sha256)throw Error('Der nachgelesene Dateiinhalt stimmt nicht mit der Übernahmekopie überein.');
  log('Dateien geprüft: '+(n+1)+' / '+documents.length);
 }
 if(JSON.stringify(await inventory(directory))!==JSON.stringify(files))throw Error('Die lokale Übernahmekopie wurde während der Prüfung verändert.');
 const folder='__H2O-Speichertest-'+randomUUID(),testPath=folder+'/probe.bin',first=Buffer.from('H2O synthetic test version 1'),second=Buffer.from('H2O synthetic test version 2');
 const op=()=>randomUUID();
 async function removeIfPresent(itemPath){
  let current;try{current=await call('stat',{path:itemPath});}catch(error){if(error.status===404)return;throw error;}
  await call('delete',{path:itemPath,expectedVersion:current.version,operationId:op()});
 }
 // Only the random synthetic namespace is ever written; user files are read-only.
 try{
  await call('mkdir',{path:folder,expectedVersion:0,operationId:op()});
  const a=await call('write',{path:testPath,expectedVersion:0,operationId:op()},first);
  const b=await call('write',{path:testPath,expectedVersion:a.version,operationId:op()},second);
  if(!(await call('read',{path:testPath})).equals(second)||!(await call('read',{path:testPath,version:a.version})).equals(first))throw Error('Der Schreib- und Versionsvergleich ist fehlgeschlagen.');
  const deleted=await call('delete',{path:testPath,expectedVersion:b.version,operationId:op()});
  await call('restore',{path:testPath,expectedVersion:deleted.version,restoreVersion:a.version,operationId:op()});
  if(!(await call('read',{path:testPath})).equals(first))throw Error('Die Wiederherstellung konnte nicht bestätigt werden.');
 }finally{
  await removeIfPresent(testPath);await removeIfPresent(folder);
 }
 for(const itemPath of [testPath,folder]){
  let deleted=false;try{await call('stat',{path:itemPath});}catch(error){if(error.status===404)deleted=true;else throw error;}
  if(!deleted)throw Error('Die Testbereinigung konnte nicht bestätigt werden.');
 }
 log('Dateiablage vollständig mit der Übernahmekopie verglichen.');
 log('Schreiben, frühere Versionen und Wiederherstellung erfolgreich geprüft.');
 log('Testobjekte als gelöscht bestätigt. Die Anwendung verwendet weiterhin OneDrive.');
 return {run,files:documents.length,mode:'rehearsal',liveStorage:'onedrive'};
}
module.exports={prepareFiles};
if(require.main===module){
 if(process.argv.length!==3){console.error('Aufruf: node scripts/prepare-cloudflare-files.cjs /pfad/zur/uebernahmekopie');process.exitCode=2;}
 else prepareFiles(path.resolve(process.argv[2])).catch(error=>{const safe=/^(Cloudflare hat den Dateitest|Die vorhandene Dienstverbindung|Der nachgelesene|Die lokale Übernahmekopie|Der Schreib-|Die Wiederherstellung|Die Testbereinigung)/.test(error.message);console.error(safe?error.message:'Dateitest nicht bestätigt. Keine Umschaltung vorgenommen.');process.exitCode=1;});
}
