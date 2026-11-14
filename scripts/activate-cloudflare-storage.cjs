#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomBytes,randomUUID,createHash}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {inventory,migrate}=require('./migrate-onedrive-snapshot.cjs'),{prepare}=require('./prepare-cloudflare-storage.cjs'),{prepareFiles}=require('./prepare-cloudflare-files.cjs');
const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',APP='https://ffw-wasser.github.io/home/index.html',sha=value=>createHash('sha256').update(value).digest('hex');
async function activate(sourceDirectory,{fetcher=fetch,log=console.log,expectedFingerprint=null,checkpointRoot=path.join(os.homedir(),'Downloads'),openBrowser=async url=>{if(process.platform!=='win32')throw Error('Bitte die Verbindung anschließend in der Anwendung mit den beiden vorhandenen Verbindungsdateien einrichten.');await promisify(execFile)('rundll32.exe',['url.dll,FileProtocolHandler',url]);}}={}){
 const connection=JSON.parse(await fs.readFile(path.join(sourceDirectory,'Getraenke','push-verbindung.json'),'utf8')),central=JSON.parse(await fs.readFile(path.join(sourceDirectory,'Getraenke','konten-zentrale.json'),'utf8'));
 if(connection.origin!==ORIGIN||!/^[a-f0-9]{64}$/.test(connection.token||'')||typeof central.source!=='string'||!central.source||central.source.length>500||central.state!=='active')throw Error('Die vorhandenen Verbindungsdateien sind nicht gültig.');
 const source=sha(central.source);
 if(expectedFingerprint){const response=await fetcher(ORIGIN+'/health',{method:'GET',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok||(await response.json()).sourceFingerprint!==expectedFingerprint)throw Error('Die bereitgestellte Worker-Version stimmt noch nicht mit dem geprüften Umschaltpaket überein. Bitte Worker und Umschaltskripte aus demselben geprüften Stand verwenden.');}
 async function call(endpoint,data={},token=connection.token){const response=await fetcher(ORIGIN+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(60000),body:JSON.stringify(data)});if(!response.ok)throw Error('Cloudflare hat die Umschaltung nicht bestätigt (HTTP '+response.status+').');return response.json();}
 let status=await call('/admin/storage-runtime/status'),run;
 if(status.active){if(status.source!==source)throw Error('Es ist bereits eine andere Datenquelle aktiv.');run=status.run;log('Cloudflare ist bereits aktiv. Bestehende Cloudflare-Daten werden beibehalten.');}
 else{
  // The selected original folder is read-only. Make an independent checkpoint
  // outside OneDrive and compare both inventories before and after upload.
  log('Aktuellen Originalordner vollständig einlesen …');const before=await inventory(sourceDirectory);await fs.mkdir(checkpointRoot,{recursive:true});
  const checkpoint=await fs.mkdtemp(path.join(checkpointRoot,'H2O-Umschaltung-'));
  if(path.resolve(checkpoint).startsWith(path.resolve(sourceDirectory)+path.sep))throw Error('Die Übernahmekopie muss außerhalb des Quellordners liegen.');
  await fs.cp(sourceDirectory,checkpoint,{recursive:true,preserveTimestamps:true,dereference:false,force:false,errorOnExist:false});
  const copied=await inventory(checkpoint);if(JSON.stringify(before)!==JSON.stringify(copied)||JSON.stringify(before)!==JSON.stringify(await inventory(sourceDirectory)))throw Error('Der Quellordner wurde während der Übernahme verändert.');
  log('Unabhängige lokale Schlusskopie erstellt.');
  const snapshot=await migrate(checkpoint,{H2O_WORKER_ORIGIN:ORIGIN,H2O_ADMIN_TOKEN:connection.token,H2O_SOURCE:central.source},{fetcher,log:message=>{if(/^Kopiert und nachgelesen:/.test(message))log(message);}});run=snapshot.run;
  const prepared=await prepare(checkpoint,{fetcher,log:()=>{}});await prepareFiles(checkpoint,{fetcher,prepareOnly:true,log});
  if(JSON.stringify(before)!==JSON.stringify(await inventory(sourceDirectory))||JSON.stringify(copied)!==JSON.stringify(await inventory(checkpoint)))throw Error('Der Quellordner wurde während der Übernahme verändert.');
  log('Stammdaten und sämtliche Dateien vollständig aus Cloudflare nachgelesen.');
  // The source can now be activated without making a rehearsal mode visible.
  status=await call('/admin/storage-runtime/activate',{source,run,expectedVersion:prepared.version});
  if(status.mode!=='active')throw Error('Der aktive Speicher konnte nicht bestätigt werden.');
  const check=await call('/admin/storage-runtime/status');status=check;if(!check.active||check.source!==source||check.run!==run)throw Error('Der aktive Speicher konnte nicht bestätigt werden.');
  log('Cloudflare ist als produktiver Speicher aktiviert. Originaldateien bleiben erhalten.');
 }
 await call('/admin/storage-runtime/permanent-devices',{source,run});
 const device={deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Verwaltung · Windows',expiresAt:status.serverTime?status.serverTime+30*86400000:Date.now()+29*86400000,access:'application-admin'};
 await call('/admin/storage-state/pair',{source,run,...device});
 try{
  const config=await call('/storage/config',{},device.token);if(config.sourceHash!==source||config.run!==run||config.deviceId!==device.deviceId)throw Error('Der neue Gerätezugang konnte nicht bestätigt werden.');
  const credential={origin:ORIGIN,...config,token:device.token};
  // Credentials are neither console output nor URL query parameters. The app
  // removes the fragment immediately and verifies the device with the server.
  await openBrowser(APP+'#cloudDevice='+Buffer.from(JSON.stringify(credential)).toString('base64url'));
  log('Geschützter Gerätezugang geprüft. Anwendung im Browser geöffnet.');
 }catch(error){await call('/admin/storage-state/revoke',{source,run,deviceId:device.deviceId}).catch(()=>{});throw error;}
 return {active:true,source,run};
}
async function choose(){if(process.platform!=='win32')throw Error('Die Ordnerauswahl ist für Windows vorgesehen.');const script="Add-Type -AssemblyName System.Windows.Forms; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = 'Aktuellen OneDrive-Originalordner Webseite auswählen (nicht die frühere Downloads-Kopie). Alle Gerätehaus-Fenster vorher schließen und OneDrive abwarten.'; $picker.ShowNewFolderButton = $false; if ($picker.ShowDialog() -eq 'OK') { [Console]::Write($picker.SelectedPath) }";const result=await promisify(execFile)('powershell.exe',['-NoProfile','-STA','-Command',script],{maxBuffer:10000});if(!result.stdout.trim())throw Error('Die Ordnerauswahl wurde abgebrochen.');return result.stdout.trim();}
const EXPECTED_WORKER_FINGERPRINT='7404b1553c12eb9aeedfbc7cadb5079f39b2d03715c72111c77a16e188c338c8';
module.exports={activate};
if(require.main===module)(async()=>{const source=process.argv[2]==='--choose'?await choose():process.argv[2];if(!source)throw Error('Aufruf: node activate-cloudflare-storage.cjs --choose');await activate(path.resolve(source),{expectedFingerprint:EXPECTED_WORKER_FINGERPRINT});})().catch(error=>{const safe=/^(Cloudflare hat|Cloudflare ist|Die vorhandenen|Die bereitgestellte|Es ist bereits|Der Quellordner|Der aktive Speicher|Die Übernahmekopie|Der neue Gerätezugang|Die Ordnerauswahl|Bitte die Verbindung|Aufruf:)/.test(error.message);console.error(safe?error.message:'Umschaltung nicht vollständig bestätigt. Originaldaten bleiben erhalten. Vor einem erneuten Versuch den Dienststatus prüfen.');process.exitCode=1;});
