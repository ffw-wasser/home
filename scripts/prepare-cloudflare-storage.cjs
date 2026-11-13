#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID,randomBytes}=require('node:crypto');
const {inventory}=require('./migrate-onedrive-snapshot.cjs');
const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
const sha=value=>createHash('sha256').update(value).digest('hex');
async function prepare(directory,{fetcher=fetch,log=console.log}={}){
 const config=JSON.parse(await fs.readFile(path.join(directory,'Getraenke','push-verbindung.json'),'utf8')),central=JSON.parse(await fs.readFile(path.join(directory,'Getraenke','konten-zentrale.json'),'utf8'));
 if(config.origin!==ORIGIN||typeof config.token!=='string'||!/^[a-f0-9]{64}$/.test(config.token)||typeof central.source!=='string'||!central.source||central.source.length>500)throw Error('Die vorhandene Dienstverbindung ist nicht gültig.');
 const files=await inventory(directory),source=sha(central.source),run=sha(JSON.stringify({version:1,source,files}));
 const stateBytes=await fs.readFile(path.join(directory,'feuerwehr-wasser-daten.json'));
 if(stateBytes.length>500000)throw Error('Der Datensatz überschreitet die Grenze dieser Vorbereitungsphase.');
 const expected=JSON.parse(stateBytes.toString('utf8'));
 if(!Array.isArray(expected.members)||!Array.isArray(expected.entries))throw Error('Die lokale Datendatei ist ungültig.');
 async function call(action,data={},token=config.token,admin=true){
  const response=await fetcher(ORIGIN+(admin?'/admin/storage-state/':'/storage-state/')+action,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({source,run,...data})});
  if(!response.ok)throw Error('Cloudflare hat die Vorbereitung nicht bestätigt (HTTP '+response.status+').');
  return response.json();
 }
 const status=await call('prepare');
 if(status.mode!=='rehearsal'||status.liveStorage!=='onedrive')throw Error('Unerwarteter Speicherstatus.');
 const record={deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Einmalige Übernahmeprüfung',expiresAt:Date.now()+5*60000};
 let attempted=false;
 try{
  attempted=true;const paired=await call('pair',record);if(paired.deviceId!==record.deviceId||paired.ok!==true)throw Error('Die Testverbindung wurde nicht bestätigt.');
  const read=await call('read',{},record.token,false);
  if(read.mode!=='rehearsal'||read.liveStorage!=='onedrive'||JSON.stringify(read.value)!==JSON.stringify(expected))throw Error('Der nachgelesene D1-Datenstand stimmt nicht mit der lokalen Kopie überein.');
  if(JSON.stringify(await inventory(directory))!==JSON.stringify(files))throw Error('Die lokale Kopie wurde während der Prüfung verändert.');
  log('D1-Datenstand vollständig nachgelesen und mit der Übernahmekopie verglichen.');
 }finally{
  if(attempted){const revoked=await call('revoke',{deviceId:record.deviceId});if(revoked.ok!==true)throw Error('Die Sperrung des Testzugangs wurde nicht bestätigt.');}
 }
 // Verify revocation using the very same credential before reporting completion.
 let blocked=false;
 try{await call('read',{},record.token,false);}catch(error){if(error.message==='Cloudflare hat die Vorbereitung nicht bestätigt (HTTP 401).')blocked=true;else throw error;}
 if(!blocked)throw Error('Der Testzugang wurde nicht wirksam gesperrt.');
 log('Gerätezugang geprüft und wieder gesperrt.');
 log('Vorbereitung abgeschlossen. Die Anwendung verwendet weiterhin OneDrive.');
 return {run,version:status.version,mode:'rehearsal',liveStorage:'onedrive'};
}
module.exports={prepare};
if(require.main===module){
 if(process.argv.length!==3){console.error('Aufruf: node scripts/prepare-cloudflare-storage.cjs /pfad/zur/uebernahmekopie');process.exitCode=2;}
 else prepare(path.resolve(process.argv[2])).catch(error=>{const safe=/^(Cloudflare hat die Vorbereitung nicht bestätigt \(HTTP \d{3}\)\.|Der Datensatz überschreitet|Die vorhandene Dienstverbindung|Der nachgelesene|Die lokale Kopie|Der Testzugang|Die Sperrung)/.test(error.message);console.error(safe?error.message:'Vorbereitung nicht bestätigt. Lokale Kopie und Dienst prüfen.');process.exitCode=1;});
}
