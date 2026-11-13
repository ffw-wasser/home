"use strict";
// Names used by existing feature modules remain stable; all I/O uses Cloudflare.
let oneDriveBusy=false,oneDriveApplying=false,oneDriveSharedRoot=null,oneDriveLastError='',oneDriveLastFailure=null,oneDriveSessionEpoch=0;
let oneDriveAccessConfirmed=false,oneDriveStateConfirmed=false,oneDriveStartupConfirmed=false,oneDriveNeedsLogin=false,cloudHistoryConfirmed=false;
let oneDriveLocalRevision=0,oneDriveSyncedRevision=-1,oneDriveTimer=null,oneDriveResyncRequested=false;
const CLOUD_DIRTY='fw_cloud_state_dirty',CLOUD_BASE='fw_cloud_state_base',CLOUD_LAST='fw_cloud_last_sync';
function oneDriveSignedIn(){return Boolean(window.CloudStorage?.connected);}
function oneDriveAdministrationReady(){return oneDriveAccessConfirmed&&oneDriveSignedIn()&&navigator.onLine!==false&&!window.AppPrivacy?.clearing;}
function assertOneDriveSession(epoch){if(epoch!==oneDriveSessionEpoch||!oneDriveSignedIn())throw new Error('Gerätezugang beendet. Abruf verworfen.');}
function oneDriveCancelAdminReturn(){}
function updateOneDriveStartup(){window.AppStartup?.update({ready:oneDriveStartupConfirmed&&oneDriveSignedIn(),busy:oneDriveBusy,signed:oneDriveSignedIn(),error:Boolean(oneDriveLastError),stage:oneDriveBusy?'Gemeinsame Daten und Berichte werden geladen …':'Cloudflare-Verbindung wird geprüft …',needsLogin:oneDriveNeedsLogin,offline:navigator.onLine===false});}
function getAppStorageState(){if(oneDriveStateConfirmed&&oneDriveLocalRevision===oneDriveSyncedRevision)return {kind:'cloud',text:'In Cloudflare gespeichert'};return {kind:oneDriveLastError?'error':'local',text:(typeof safeStorage!=='undefined'&&safeStorage.persistent===false?'Für diese Sitzung':'Auf diesem Gerät')+' gespeichert · '+(navigator.onLine===false?'offline':oneDriveLastError?'Speicherung nicht bestätigt':oneDriveBusy?'Wird synchronisiert …':'Cloudflare noch nicht bestätigt')};}
function oneDriveStatus(text,state='offline'){const label=byId('cloudSyncLabel'),sub=byId('cloudSyncState'),button=byId('cloudSyncButton');if(label)label.textContent='Cloudflare';if(sub)sub.textContent=text;if(button){button.dataset.state=state;button.setAttribute('aria-label','Cloudflare: '+text+'. Verbindungsdetails öffnen.');}updateOneDriveStartup();}
function updateOneDriveHeaderStatus(){const confirmed=oneDriveStateConfirmed&&oneDriveLocalRevision===oneDriveSyncedRevision;oneDriveStatus(oneDriveNeedsLogin?'Anmeldung erforderlich':oneDriveBusy?'Wird synchronisiert …':oneDriveLastError?'Speicherung nicht bestätigt':confirmed?'Synchronisiert':oneDriveSignedIn()?'Speicherung ausstehend':'Gerät verbinden',oneDriveNeedsLogin||oneDriveLastError?'error':oneDriveBusy?'syncing':confirmed?'online':'offline');}
function notifyAppStorageState(){updateOneDriveHeaderStatus();window.AttendanceSmart?.storageStatus();window.WorkflowUX?.storage();window.SmartWorkflow?.settings?.();window.PortalAdmin?.storageChanged?.();window.PortalTraining?.sync?.();}
function endOneDriveSession(){oneDriveSessionEpoch++;clearTimeout(oneDriveTimer);oneDriveAccessConfirmed=false;oneDriveStateConfirmed=false;oneDriveStartupConfirmed=false;cloudHistoryConfirmed=false;oneDriveSharedRoot=null;window.MemberRecordsPrint?.clear();window.PortalEvidenceAdmin?.clear();window.CalendarSidebar?.clear();window.YearPlan?.lock();window.PortalHydrantsView?.clearIpad();window.Drinks?.reset();window.clearOneDriveHistory?.();window.ReportDownload?.clear();updateOneDriveStartup();}
async function oneDriveResolveSharedRoot(){if(!oneDriveSignedIn())throw new Error('Bitte dieses Verwaltungsgerät mit Cloudflare verbinden.');return oneDriveSharedRoot||(oneDriveSharedRoot=CloudStorage.root());}
const odItemBase=root=>`h2o-storage://drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(root.id)}`;
async function odFetch(url,options={}){const epoch=oneDriveSessionEpoch;await CloudStorage.ensureFresh();assertOneDriveSession(epoch);const response=await CloudStorage.graphFetch(url,options);assertOneDriveSession(epoch);return response;}
async function odEnsureFolder(parentId,name){const root=await oneDriveResolveSharedRoot(),base=odItemBase({...root,id:parentId});try{const value=await(await odFetch(base+':/'+encodeURIComponent(name))).json();if(!value.folder)throw new Error('Der Speicherpfad ist kein Ordner.');return value.id;}catch(error){if(error.status!==404)throw error;try{return (await(await odFetch(base+'/children',{method:'POST',body:JSON.stringify({name,folder:{}})})).json()).id;}catch(race){if(race.status!==409)throw race;return (await(await odFetch(base+':/'+encodeURIComponent(name))).json()).id;}}}
function oneDrivePayload(){return {schemaVersion:4,updatedAt:new Date().toISOString(),members,entries,careerCatalog:typeof careerCatalog!=='undefined'?careerCatalog:[],roleTargets:typeof getRoleTargets==='function'?getRoleTargets():{},functionEntryEnabled:typeof isFunctionEntryEnabled==='function'?isFunctionEntryEnabled():true};}
function applyOneDrivePayload(data){
 if(!data||!Array.isArray(data.members)||!Array.isArray(data.entries))throw new Error('Ungültiger Cloudflare-Datenstand.');
 oneDriveApplying=true;
 try{members=data.members;entries=data.entries;if(typeof careerCatalog!=='undefined')careerCatalog=Array.isArray(data.careerCatalog)?data.careerCatalog:[];
 safeStorage.setItem(KEYS.members,JSON.stringify(members));safeStorage.setItem(KEYS.entries,JSON.stringify(entries));if(KEYS.careerCatalog&&typeof careerCatalog!=='undefined')safeStorage.setItem(KEYS.careerCatalog,JSON.stringify(careerCatalog));
 if(typeof saveRoleTargets==='function')saveRoleTargets(data.roleTargets||{});else safeStorage.setItem(KEYS.roleTargets,JSON.stringify(data.roleTargets||{}));safeStorage.setItem(KEYS.functionEntry,String(data.functionEntryEnabled!==false));
 }finally{oneDriveApplying=false;}
 for(const render of [window.renderMembers,window.renderToday,window.renderAdmin,window.renderStatistics])render?.();
}
async function oneDriveReadState({versioned=false}={}){const epoch=oneDriveSessionEpoch,result=await CloudStorage.readState();assertOneDriveSession(epoch);return versioned?{data:result.value,version:result.version,eTag:'"s-'+result.version+'"'}:result.value;}
async function oneDriveWriteState(expected){const value=oneDrivePayload();await CloudStorage.writeState(value,expected.version);localStorage.setItem(CLOUD_LAST,new Date().toISOString());return value.updatedAt;}
const cloudSame=(a,b)=>['members','entries','careerCatalog','roleTargets','functionEntryEnabled'].every(key=>JSON.stringify(a[key]??(key==='functionEntryEnabled'?true:key==='roleTargets'?{}:[]))===JSON.stringify(b[key]??(key==='functionEntryEnabled'?true:key==='roleTargets'?{}:[])));
const cloudSource=value=>String(value||'').replace(/^([a-f0-9]{16}):/i,(_,drive)=>drive.toLowerCase()+':');
function cloudJson(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
async function cloudCheckpoint(value,reason){
 const folder='Backups/Umstellung';await CloudStorage.ensureFolder(folder);
 const drafts={};for(let i=0;i<safeStorage.length;i++){const key=safeStorage.key(i);if(/^fw_v\d+_/.test(key||'')&&!/password|pin|token/i.test(key))drafts[key]=safeStorage.getItem(key);}
 const bytes=new TextEncoder().encode(JSON.stringify({format:'H2O-Umstellungsstand',createdAt:new Date().toISOString(),reason,source:CloudStorage.source,value,drafts,archive:typeof csvArchive!=='undefined'?csvArchive:[]}));
 const path=folder+'/'+Date.now()+'-'+crypto.randomUUID()+'.json';await CloudStorage.writeFile(path,bytes,0);
 const metadata=await CloudStorage.stat(path),read=await CloudStorage.readFile(path,metadata.version);if(await CloudStorage.digest(read)!==await CloudStorage.digest(bytes))throw new Error('Der lokale Sicherungsstand konnte nicht nachgelesen werden.');return path;
}
async function cloudConflictChoice(local,remote){
 let dialog=byId('cloudConflictDialog');if(dialog)throw new Error('Bitte zuerst den offenen Datenkonflikt entscheiden.');
 dialog=document.createElement('dialog');dialog.id='cloudConflictDialog';dialog.className='cloud-sync-dialog';dialog.innerHTML='<div class="cloud-sync-shell"><header><h2>Zwei geänderte Datenstände</h2></header><div class="cloud-sync-body"><p>Auf diesem Gerät und in Cloudflare liegen unterschiedliche Änderungen vor. Der lokale Stand ist als private Datei unter Backups/Umstellung gesichert. Frühere Cloudflare-Stände bleiben erhalten.</p><p>Welcher Stand soll für Mitglieder und laufende Anwesenheit verwendet werden? Die Berichtsdateien werden dadurch nicht ersetzt.</p><button type="button" class="primary-button" data-choice="remote">Cloudflare-Stand übernehmen</button><button type="button" class="outline-button" data-choice="local">Lokalen Stand verwenden</button><button type="button" class="outline-button" data-choice="cancel">Später entscheiden</button></div></div>';const counts=document.createElement('p');counts.textContent='Lokal: '+local.members.length+' Mitglieder, '+local.entries.length+' laufende Einträge. Cloudflare: '+remote.members.length+' Mitglieder, '+remote.entries.length+' laufende Einträge.';dialog.querySelector('.cloud-sync-body').prepend(counts);document.body.append(dialog);
 return new Promise(resolve=>{const finish=value=>{dialog.close();dialog.remove();resolve(value);};dialog.oncancel=event=>{event.preventDefault();finish('cancel');};dialog.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>finish(button.dataset.choice));dialog.showModal();});
}
async function syncOneDrive({manual=false,refreshHistory=manual}={}){
 if(!oneDriveSignedIn()||navigator.onLine===false){notifyAppStorageState();return false;}
 if(oneDriveBusy){oneDriveResyncRequested=true;return false;}
 const epoch=oneDriveSessionEpoch,startRevision=oneDriveLocalRevision;oneDriveBusy=true;notifyAppStorageState();
 try{
  await CloudStorage.ensureFresh();const remote=await CloudStorage.readState();assertOneDriveSession(epoch);
  const local=oneDrivePayload(),base=cloudJson(CLOUD_BASE),legacyBase=cloudJson('fw_onedrive_state_base'),first=base?.source!==CloudStorage.source;
  const legacyDirty=localStorage.getItem('fw_onedrive_state_dirty')==='1'||(localStorage.getItem('fw_onedrive_local_updated')||'')>(localStorage.getItem('fw_onedrive_last_sync')||'');
  let dirty=localStorage.getItem(CLOUD_DIRTY)==='1'||(first&&legacyDirty)||oneDriveLocalRevision>0&&oneDriveLocalRevision!==oneDriveSyncedRevision;
  const archiveDirty=safeStorage.getItem('fw_cloud_archive_dirty')==='1';
  if(archiveDirty)local.legacyArchive=(csvArchive||[]).filter(item=>!item.oneDriveLive&&!item.cloudSaved);
  else if(first&&legacyDirty){const archived=new Map([...(CloudStorage.legacyArchive||[]),...(csvArchive||[]).filter(item=>!item.oneDriveLive&&!item.cloudSaved)].map(item=>[item.id,item]));local.legacyArchive=[...archived.values()];}
  if(dirty&&cloudSame(local,remote.value)&&(!local.legacyArchive||JSON.stringify(local.legacyArchive)===JSON.stringify(remote.value.legacyArchive||remote.value.csvArchive||[])))dirty=false;
  if(dirty){
   // Back up local data before any handover or conflict choice. Never replace a
   // newer source with the stale Downloads snapshot or discard an iPad draft.
   if(first||base.version!==remote.version)await cloudCheckpoint(local,first?'Umstellung':'Datenkonflikt');
   assertOneDriveSession(epoch);
   const sourceMatches=cloudSource(legacyBase?.source)===cloudSource(CloudStorage.source);
   const unchanged=first?sourceMatches&&legacyBase.updatedAt===remote.value.updatedAt:base.version===remote.version;
   if(!unchanged){const choice=await cloudConflictChoice(local,remote.value);assertOneDriveSession(epoch);if(choice==='cancel')throw new Error('Datenkonflikt offen. Beide Datenstände bleiben erhalten.');dirty=choice==='local';}
  }
  let version=remote.version;
  if(oneDriveLocalRevision!==startRevision)throw new Error('Während des Abgleichs wurden Eingaben geändert. Sie bleiben lokal erhalten; der Abgleich wird wiederholt.');
  if(dirty){const operationId=crypto.randomUUID();const saved=await CloudStorage.writeState({...remote.value,...local},remote.version,operationId);version=saved.version;assertOneDriveSession(epoch);}
  else applyOneDrivePayload(remote.value);
  assertOneDriveSession(epoch);
  if(oneDriveLocalRevision===startRevision){oneDriveSyncedRevision=startRevision;localStorage.setItem(CLOUD_DIRTY,'0');localStorage.setItem('fw_onedrive_state_dirty','0');safeStorage.setItem('fw_cloud_archive_dirty','0');}
  localStorage.setItem(CLOUD_BASE,JSON.stringify({source:CloudStorage.source,version}));localStorage.setItem(CLOUD_LAST,new Date().toISOString());
  oneDriveAccessConfirmed=true;oneDriveStateConfirmed=oneDriveLocalRevision===oneDriveSyncedRevision;
  if(first){
   const draft=cloudJson('fw_v1_attendance_draft'),oldScope=JSON.stringify(['fw_onedrive_client_id','fw_onedrive_shared_folder_url'].map(key=>safeStorage.getItem(key)||''));
   if(draft?.source===oldScope&&cloudSource(legacyBase?.source)===cloudSource(CloudStorage.source)){draft.source=CloudStorage.source;safeStorage.setItem('fw_v1_attendance_draft',JSON.stringify(draft));window.restoreAttendanceDraft?.();}
   for(const key of ['fw_onedrive_tokens','fw_onedrive_pkce','fw_onedrive_admin_return','fw_onedrive_silent_retry','fw_onedrive_verified_root']){localStorage.removeItem(key);sessionStorage.removeItem(key);}
  }
  window.Drinks?.preload?.();
  if(refreshHistory&&typeof window.loadOneDriveHistory==='function'){if(await window.loadOneDriveHistory()===false)throw new Error(window.oneDriveHistoryLastError||'Berichte konnten nicht vollständig geladen werden.');cloudHistoryConfirmed=true;}
  if(cloudHistoryConfirmed&&oneDriveStateConfirmed)oneDriveStartupConfirmed=true;
  oneDriveLastError='';oneDriveLastFailure=null;oneDriveNeedsLogin=false;if(manual)showToast('Daten und Berichte mit Cloudflare synchronisiert.');return true;
 }catch(error){if(epoch!==oneDriveSessionEpoch)return false;oneDriveLastError=error.message||'Speicherung nicht bestätigt.';oneDriveLastFailure=error;oneDriveStateConfirmed=false;if(error.status===401){oneDriveNeedsLogin=true;oneDriveAccessConfirmed=false;oneDriveStartupConfirmed=false;}if(manual)showToast(oneDriveLastError,'error');return false;
 }finally{oneDriveBusy=false;renderOneDriveDialog();notifyAppStorageState();const again=oneDriveResyncRequested||oneDriveLocalRevision>startRevision;oneDriveResyncRequested=false;if(again&&epoch===oneDriveSessionEpoch&&oneDriveSignedIn()){clearTimeout(oneDriveTimer);oneDriveTimer=setTimeout(()=>syncOneDrive(),oneDriveLastError?5000:900);}}
}
function scheduleCloudSync(){if(oneDriveApplying)return;oneDriveLocalRevision++;oneDriveStateConfirmed=false;localStorage.setItem(CLOUD_DIRTY,'1');notifyAppStorageState();clearTimeout(oneDriveTimer);if(oneDriveSignedIn())oneDriveTimer=setTimeout(()=>syncOneDrive(),900);}
async function oneDriveWebsiteFile(path){if(!oneDriveAdministrationReady())throw new Error('Bitte zuerst Cloudflare verbinden und synchronisieren.');const epoch=oneDriveSessionEpoch,metadata=await CloudStorage.stat(path),bytes=await CloudStorage.readFile(path,metadata.version);assertOneDriveSession(epoch);return {response:new Response(bytes),assertCurrent:()=>assertOneDriveSession(epoch)};}
async function oneDriveReadContacts(){const {response,assertCurrent}=await oneDriveWebsiteFile('Feuerwehr-Kontakte-Privat/feuerwehr-emmendingen-kontakte.json');const value=await response.json();assertCurrent();if(value?.schemaVersion!==1||!Array.isArray(value.groups))throw new Error('Ungültiges Kontaktverzeichnis.');return value;}
async function oneDriveReadTraining(){const {response,assertCurrent}=await oneDriveWebsiteFile('Ausbildung-Privat/H2O-Ausbildung-Privat.json');const value=await response.json();assertCurrent();return value;}
async function oneDriveReadHydrants(){const {response,assertCurrent}=await oneDriveWebsiteFile('Hydrantenplan/Hydrantenplan-Wasser.pdf');const bytes=new Uint8Array(await response.arrayBuffer());assertCurrent();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Der Hydrantenplan ist keine PDF.');return bytes;}
async function oneDriveUploadTerminPackage(blob,name){
 if(!oneDriveAdministrationReady())throw new Error('Bitte zuerst Cloudflare verbinden.');
 if(!(blob instanceof Blob)||!blob.size||!/^(?:FFW-Wasser_[^\\/:*?"<>|]+|\d{4}-\d{2}-\d{2}_[A-Za-z0-9_-]+_[a-z0-9]{7})\.zip$/i.test(name))throw new Error('Ungültiges Terminpaket.');
 const epoch=oneDriveSessionEpoch,path='Berichte/Terminpakete/'+name,bytes=new Uint8Array(await blob.arrayBuffer());await CloudStorage.ensureFolder('Berichte/Terminpakete');assertOneDriveSession(epoch);
 // Expected version zero is an atomic create-only check; retries never replace
 // an existing report. The operation ID remains stable across network retries.
 const operationId=crypto.randomUUID();let saved;for(let attempt=0;attempt<2;attempt++){try{saved=await CloudStorage.writeFile(path,bytes,0,operationId);break;}catch(error){if(attempt||error.status&&error.status<500)throw error;assertOneDriveSession(epoch);}}
 const copy=await CloudStorage.readFile(path,saved.version);assertOneDriveSession(epoch);if(await CloudStorage.digest(copy)!==await CloudStorage.digest(bytes))throw new Error('Das gespeicherte Terminpaket konnte nicht nachgelesen werden.');return {id:saved.id,name,size:bytes.length,file:{}};
}
async function oneDriveUploadReport(blob,name){const kind=/\.pdf$/i.test(name)?'PDF':'CSV',path='Berichte/'+kind+'/'+String(name).replace(/[\\/:*?"<>|]/g,'-');await CloudStorage.ensureFolder('Berichte/'+kind);let expected=0;try{expected=(await CloudStorage.stat(path)).version;}catch(error){if(error.status!==404)throw error;}await CloudStorage.writeFile(path,new Uint8Array(await blob.arrayBuffer()),expected);}
function ensureOneDriveUi(){
 if(byId('cloudSyncButton'))return;const button=document.createElement('button');button.id='cloudSyncButton';button.className='cloud-sync-button';button.type='button';button.innerHTML='<span class="cloud-sync-icon" aria-hidden="true">☁</span><span class="cloud-sync-copy" role="status"><b id="cloudSyncLabel">Cloudflare</b><small id="cloudSyncState">Gerät verbinden</small></span>';(byId('appConnectionStatus')||document.body).append(button);
 const dialog=document.createElement('dialog');dialog.id='cloudSyncDialog';dialog.className='cloud-sync-dialog';dialog.innerHTML='<div class="cloud-sync-shell"><header><h2>Cloudflare-Verbindung</h2><button id="cloudSyncClose" type="button" class="cloud-sync-close" aria-label="Schließen">×</button></header><div class="cloud-sync-body"><p id="oneDriveDetail" role="status"></p><div id="cloudDeviceSetup"><h3>Dieses Verwaltungsgerät verbinden</h3><button id="cloudMicrosoftLogin" class="primary-button" type="button">Mit Microsoft anmelden</button><p>Mit dem Konto anmelden, das Zugriff auf den gemeinsamen OneDrive-Ordner „Webseite“ hat. Das Gerät wird danach automatisch mit Cloudflare verbunden.</p><button id="cloudPairScan" type="button" class="primary-button">Kamera öffnen – QR-Code scannen</button><p>Auf einem verbundenen Gerät: Einstellungen → H₂O-Dienst → Verwaltungsgerät koppeln. Den angezeigten QR-Code hier scannen; danach „Dieses Gerät koppeln“ wählen.</p><div id="cloudFolderSetup"><p>Alternativ den gemeinsamen OneDrive-Ordner einmal auswählen. Der eigene Gerätezugang bleibt in diesem Browser gespeichert; die laufenden Daten kommen aus Cloudflare.</p><label class="primary-button cloud-folder-connect">Ordner „Webseite“ auswählen<input id="cloudConnectionFolder" type="file" webkitdirectory directory aria-label="Gemeinsamen Ordner Webseite auswählen"></label><p class="help-text">Nur die zwei Verbindungsdateien unter Getraenke werden gelesen. Der übrige Ordner wird nicht hochgeladen. Die Ordnerauswahl kann den OneDrive-Webordner nicht direkt öffnen. Am Laptop den synchronisierten Ordner im Explorer auswählen. Auf iPhone/iPad stattdessen den QR-Code scannen oder die zwei Dateien einzeln über „Dateien“ → OneDrive auswählen.</p></div><p id="cloudFileSetupHint" hidden>Auf iPhone und iPad: QR-Code scannen oder die zwei Verbindungsdateien über „Dateien“ → „Durchsuchen“ → OneDrive auswählen. Falls OneDrive dort nicht verfügbar ist, die Dateien vorher auf dieses Gerät laden.</p><details id="cloudPairManual"><summary>Kopplungslink oder eingescannter Code</summary><label>Kopplungslink oder Code<input id="cloudPairCode" class="text-input" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="512"></label><button id="cloudPairClaim" type="button" class="primary-button">Dieses Gerät koppeln</button><p>Auf einem verbundenen Gerät: Einstellungen → H₂O-Dienst → Verwaltungsgerät koppeln. In einer installierten Gerätehaus-App den Link hier einfügen.</p></details><details id="cloudFileSetup"><summary>Verbindungsdateien über „Dateien“ auswählen</summary><label>push-verbindung.json und konten-zentrale.json gemeinsam auswählen<input id="cloudConnectionFiles" type="file" accept=".json,application/json" multiple></label></details></div><details id="cloudMicrosoftSettings" hidden><summary>Microsoft-Anmeldung für weitere Geräte einrichten</summary><p>Einmalig die bisherige Microsoft-Anwendungs-ID hinterlegen. Weitere Geräte brauchen dann nur noch die Anmeldung. Die vorhandene Entra-App muss die SPA-Rücksprungadresse https://ffw-wasser.github.io/home/ erlauben.</p><label>Anwendungs-ID<input id="cloudMicrosoftClient" class="text-input" autocomplete="off" maxlength="36"></label><button id="cloudMicrosoftSave" class="outline-button" type="button">Microsoft-Anmeldung aktivieren</button></details><div class="cloud-sync-actions"><button id="oneDriveNow" class="primary-button" type="button">Erneut synchronisieren</button><button id="oneDriveLogout" class="danger-button" type="button">Gerät abmelden</button></div></div></div>';document.body.append(dialog);
 button.onclick=()=>{renderOneDriveDialog();dialog.showModal();};byId('cloudSyncClose').onclick=()=>dialog.close();byId('oneDriveNow').onclick=()=>syncOneDrive({manual:true,refreshHistory:true});byId('oneDriveLogout').onclick=async()=>{if(!requireAdmin('settingsView',{allowDisconnected:true}))return;await window.AppPrivacy.logout();};
 byId('cloudMicrosoftLogin').onclick=async()=>{try{await MicrosoftConnection.login();}catch(error){byId('oneDriveDetail').textContent=error.message;}};
 byId('cloudMicrosoftClient').value=localStorage.getItem('fw_onedrive_client_id')||'';
 byId('cloudMicrosoftSave').onclick=async()=>{if(!requireAdmin('settingsView'))return;try{await CloudStorage.adminRequest('/admin/storage-runtime/microsoft',{clientId:byId('cloudMicrosoftClient').value.trim()});byId('oneDriveDetail').textContent='Microsoft-Anmeldung für weitere Verwaltungsgeräte aktiviert.';}catch(error){byId('oneDriveDetail').textContent=error.message;}};
 configureCloudConnectionPicker();
 byId('cloudPairScan').onclick=scanCloudPair;
 byId('cloudPairClaim').onclick=async()=>{const input=byId('cloudPairCode'),code=input.value;input.value='';try{await CloudStorage.claim(code);await CloudStorage.bootstrap();await syncOneDrive({manual:true,refreshHistory:true});}catch(error){oneDriveLastError=error.message;renderOneDriveDialog();}};
 async function connectFiles(event,folder){const input=event.target,files=[...input.files];input.value='';if(!files.length)return;input.disabled=true;byId('oneDriveDetail').textContent='Gerätezugang wird geprüft …';try{await CloudStorage[folder?'enrollFolder':'enrollFiles'](files);oneDriveNeedsLogin=false;await syncOneDrive({manual:true,refreshHistory:true});}catch(error){oneDriveLastError=error.message;}finally{input.disabled=false;renderOneDriveDialog();notifyAppStorageState();}}
 byId('cloudConnectionFolder').onchange=event=>connectFiles(event,true);
 byId('cloudConnectionFiles').onchange=event=>connectFiles(event,false);
}
function configureCloudConnectionPicker(){
 // iPadOS can report a desktop Mac user agent while exposing touch input.
 const appleMobile=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const folderSupported=!appleMobile&&'webkitdirectory' in byId('cloudConnectionFolder');
 byId('cloudFolderSetup').hidden=!folderSupported;
 byId('cloudFileSetupHint').hidden=!appleMobile;
 byId('cloudFileSetup').open=!folderSupported;
}
async function scanCloudPair(){
 if(document.getElementById('cloudPairScanner'))return;
 const dialog=document.createElement('dialog');dialog.id='cloudPairScanner';dialog.className='cloud-sync-dialog';dialog.setAttribute('aria-label','Kopplungs-QR-Code scannen');
 dialog.innerHTML='<div class="cloud-sync-body"><h2>Kopplungs-QR-Code scannen</h2><video autoplay muted playsinline aria-label="Kamerabild"></video><p role="status">Kamera wird geöffnet …</p><button type="button" class="outline-button">Abbrechen</button></div>';document.body.append(dialog);
 const video=dialog.querySelector('video'),status=dialog.querySelector('[role="status"]');let stream,frame=0,closed=false,previous=0;
 const stop=()=>{closed=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;window.removeEventListener('pagehide',close);document.removeEventListener('visibilitychange',hidden);};
 const close=()=>{stop();if(dialog.open)dialog.close();dialog.remove();byId('cloudPairScan')?.focus();};
 const hidden=()=>{if(document.hidden)close();};
 dialog.querySelector('button').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=stop;window.addEventListener('pagehide',close);document.addEventListener('visibilitychange',hidden);dialog.showModal();
 try{
  if(!navigator.mediaDevices?.getUserMedia||typeof window.jsQR!=='function')throw Error('unavailable');
  const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}});
  if(closed){camera.getTracks().forEach(track=>track.stop());return;}stream=camera;video.srcObject=stream;await video.play();if(closed)return;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('unavailable');status.textContent='QR-Code vom verbundenen Verwaltungsgerät in die Kamera halten.';
  function tick(now){
   if(closed)return;
   try{if(now-previous>250&&video.readyState>=2&&video.videoWidth){
    previous=now;const scale=Math.min(1,960/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),qr=window.jsQR(pixels.data,canvas.width,canvas.height);
    if(qr){let code='';try{const url=new URL(qr.data);if(url.origin==='https://ffw-wasser.github.io'&&url.pathname==='/home/index.html'&&!url.username&&!url.password&&!url.search)code=new URLSearchParams(url.hash.slice(1)).get('pair')||'';}catch{}
     if(/^[A-Za-z0-9_-]{43}$/.test(code)){byId('cloudPairCode').value=code;byId('cloudPairManual').open=true;close();byId('cloudPairClaim').focus();byId('oneDriveDetail').textContent='QR-Code eingelesen. Mit „Dieses Gerät koppeln“ bestätigen.';return;}
     status.textContent='Das ist kein gültiger Verwaltungs-Kopplungscode. Bitte den passenden QR-Code scannen.';
    }
   }}catch{status.textContent='Kamerabild konnte nicht gelesen werden. Bitte erneut öffnen oder den Link eingeben.';stream?.getTracks().forEach(track=>track.stop());return;}
   frame=requestAnimationFrame(tick);
  }frame=requestAnimationFrame(tick);
 }catch{if(!closed){stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;video.hidden=true;status.textContent='Kamera nicht verfügbar. Bitte Kamerazugriff erlauben oder den Kopplungslink manuell eingeben.';dialog.querySelector('button').textContent='Zurück zur Eingabe';}}
}
function renderOneDriveDialog(){const detail=byId('oneDriveDetail');if(detail)detail.textContent=oneDriveLastError||(oneDriveSignedIn()?'Dieses Gerät ist mit dem geschützten Cloudflare-Speicher verbunden. Änderungen werden automatisch abgeglichen.':'Einmal verbinden, anschließend automatisch synchronisieren.');for(const id of ['oneDriveNow','oneDriveLogout'])if(byId(id))byId(id).hidden=!oneDriveSignedIn();if(byId('cloudDeviceSetup'))byId('cloudDeviceSetup').hidden=oneDriveSignedIn();if(byId('cloudMicrosoftSettings'))byId('cloudMicrosoftSettings').hidden=!oneDriveSignedIn();}
async function initCloudSync(){
 if(window.AppRelease&&await window.AppRelease.ready)return;ensureOneDriveUi();updateOneDriveStartup();
 window.addEventListener('online',async()=>{try{await CloudStorage.bootstrap();await syncOneDrive({refreshHistory:true});}catch(error){oneDriveLastError=error.message;notifyAppStorageState();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOneDrive({refreshHistory:true});});
 try{await window.MicrosoftConnection?.finish();if(await CloudStorage.bootstrap())await syncOneDrive({refreshHistory:true});}catch(error){oneDriveLastError=error.message;oneDriveNeedsLogin=error.status===401;}renderOneDriveDialog();notifyAppStorageState();
}
window.addEventListener('h2o-storage-lock',()=>{endOneDriveSession();oneDriveNeedsLogin=true;notifyAppStorageState();});
