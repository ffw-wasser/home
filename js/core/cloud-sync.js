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
function updateOneDriveHeaderStatus(){oneDriveStatus(oneDriveBusy?'Wird synchronisiert …':oneDriveLastError?'Speicherung nicht bestätigt':oneDriveStateConfirmed?'Synchronisiert':oneDriveSignedIn()?'Speicherung ausstehend':'Gerät verbinden',oneDriveBusy?'syncing':oneDriveLastError?'error':oneDriveStateConfirmed?'online':'offline');}
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
async function cloudConflictChoice(){
 let dialog=byId('cloudConflictDialog');if(dialog)throw new Error('Bitte zuerst den offenen Datenkonflikt entscheiden.');
 dialog=document.createElement('dialog');dialog.id='cloudConflictDialog';dialog.className='cloud-sync-dialog';dialog.innerHTML='<div class="cloud-sync-shell"><header><h2>Zwei geänderte Datenstände</h2></header><div class="cloud-sync-body"><p>Auf diesem Gerät und in Cloudflare liegen unterschiedliche Änderungen vor. Der lokale Stand ist als private Datei unter Backups/Umstellung gesichert. Frühere Cloudflare-Stände bleiben erhalten.</p><p>Welcher Stand soll für Mitglieder und laufende Anwesenheit verwendet werden? Die Berichtsdateien werden dadurch nicht ersetzt.</p><button type="button" class="primary-button" data-choice="remote">Cloudflare-Stand übernehmen</button><button type="button" class="outline-button" data-choice="local">Lokalen Stand verwenden</button><button type="button" class="outline-button" data-choice="cancel">Später entscheiden</button></div></div>';document.body.append(dialog);
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
  if(archiveDirty)local.legacyArchive=(csvArchive||[]).filter(item=>!item.oneDriveLive);
  else if(first&&legacyDirty){const archived=new Map([...(CloudStorage.legacyArchive||[]),...(csvArchive||[]).filter(item=>!item.oneDriveLive)].map(item=>[item.id,item]));local.legacyArchive=[...archived.values()];}
  if(dirty&&cloudSame(local,remote.value)&&(!local.legacyArchive||JSON.stringify(local.legacyArchive)===JSON.stringify(remote.value.legacyArchive||remote.value.csvArchive||[])))dirty=false;
  if(dirty){
   // Back up local data before any handover or conflict choice. Never replace a
   // newer source with the stale Downloads snapshot or discard an iPad draft.
   if(first||base.version!==remote.version)await cloudCheckpoint(local,first?'Umstellung':'Datenkonflikt');
   assertOneDriveSession(epoch);
   const sourceMatches=cloudSource(legacyBase?.source)===cloudSource(CloudStorage.source);
   const unchanged=first?sourceMatches&&legacyBase.updatedAt===remote.value.updatedAt:base.version===remote.version;
   if(!unchanged){const choice=await cloudConflictChoice();assertOneDriveSession(epoch);if(choice==='cancel')throw new Error('Datenkonflikt offen. Beide Datenstände bleiben erhalten.');dirty=choice==='local';}
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
 const dialog=document.createElement('dialog');dialog.id='cloudSyncDialog';dialog.className='cloud-sync-dialog';dialog.innerHTML='<div class="cloud-sync-shell"><header><h2>Cloudflare-Verbindung</h2><button id="cloudSyncClose" type="button" class="cloud-sync-close" aria-label="Schließen">×</button></header><div class="cloud-sync-body"><p id="oneDriveDetail" role="status"></p><p id="cloudImportHelp">Weitere Verwaltungsgeräte werden mit einem einmaligen QR-Code unter Einstellungen → H₂O-Dienst gekoppelt. Nach längerer Nichtbenutzung ist eine neue Kopplung erforderlich.</p><label>Kopplungslink oder Code<input id="cloudPairCode" class="text-input" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="512"></label><button id="cloudPairClaim" type="button" class="primary-button">Dieses Gerät koppeln</button><p>Bei einer installierten Gerätehaus-App den Kopplungslink hier einfügen, damit der Zugang direkt in dieser App eingerichtet wird.</p><label id="cloudRecoveryLabel">Erstes Gerät oder Wiederherstellung: vorhandene Verbindungsdateien<input id="cloudConnectionFiles" type="file" accept=".json,application/json" multiple></label><p id="cloudRecoveryHelp">Bei der Ersteinrichtung push-verbindung.json und konten-zentrale.json gemeinsam auswählen. Diese Dateien und Kopplungscodes nicht weitergeben.</p><div class="cloud-sync-actions"><button id="oneDriveNow" class="primary-button" type="button">Erneut synchronisieren</button><button id="oneDriveLogout" class="danger-button" type="button">Gerät abmelden</button></div></div></div>';document.body.append(dialog);
 button.onclick=()=>{renderOneDriveDialog();dialog.showModal();};byId('cloudSyncClose').onclick=()=>dialog.close();byId('oneDriveNow').onclick=()=>syncOneDrive({manual:true,refreshHistory:true});byId('oneDriveLogout').onclick=async()=>{if(!requireAdmin('settingsView',{allowDisconnected:true}))return;await window.AppPrivacy.logout();};
 byId('cloudPairClaim').onclick=async()=>{const input=byId('cloudPairCode'),code=input.value;input.value='';try{await CloudStorage.claim(code);await CloudStorage.bootstrap();await syncOneDrive({manual:true,refreshHistory:true});}catch(error){oneDriveLastError=error.message;renderOneDriveDialog();}};
 byId('cloudConnectionFiles').onchange=async event=>{const files=[...event.target.files];event.target.value='';try{await CloudStorage.enrollFiles(files);await syncOneDrive({manual:true,refreshHistory:true});}catch(error){oneDriveLastError=error.message;renderOneDriveDialog();}};
}
function renderOneDriveDialog(){const detail=byId('oneDriveDetail');if(detail)detail.textContent=oneDriveLastError|| (oneDriveSignedIn()?'Dieses Gerät ist mit dem geschützten Cloudflare-Speicher verbunden. Änderungen werden automatisch abgeglichen.':'Dieses Gerät ist noch nicht verbunden. Die private Datenübernahme muss zuerst abgeschlossen sein.');for(const id of ['oneDriveNow','oneDriveLogout'])if(byId(id))byId(id).hidden=!oneDriveSignedIn();for(const id of ['cloudRecoveryLabel','cloudRecoveryHelp','cloudPairClaim'])if(byId(id))byId(id).hidden=oneDriveSignedIn();if(byId('cloudPairCode'))byId('cloudPairCode').closest('label').hidden=oneDriveSignedIn();}
async function initCloudSync(){
 if(window.AppRelease&&await window.AppRelease.ready)return;ensureOneDriveUi();updateOneDriveStartup();
 window.addEventListener('online',async()=>{try{await CloudStorage.bootstrap();await syncOneDrive({refreshHistory:true});}catch(error){oneDriveLastError=error.message;notifyAppStorageState();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOneDrive({refreshHistory:true});});
 try{if(await CloudStorage.bootstrap())await syncOneDrive({refreshHistory:true});}catch(error){oneDriveLastError=error.message;oneDriveNeedsLogin=error.status===401;}renderOneDriveDialog();notifyAppStorageState();
}
window.addEventListener('h2o-storage-lock',()=>{endOneDriveSession();oneDriveNeedsLogin=true;notifyAppStorageState();});
