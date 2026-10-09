/* Explicit OneDrive logout removes local personal data, never remote files. */
(function(global){
 'use strict';const MARKER='fw_privacy_cleanup_pending';
 const KEEP=new Set(['fw_v6_password','fw_v5_pin','fw_onedrive_client_id','fw_onedrive_shared_folder_url','fw_v1_function_entry_enabled','fw_v1_annual_role_targets',MARKER]);
 const DATABASES=['fw_v1_report_pdfs','ffw-document-reports','fw_v14_settings','ffw-deckel-reminders'];let running=null,clearing=false;
 function purge(store){if(!store)return;const keys=[];for(let i=0;i<store.length;i++){const key=store.key(i);if(key?.startsWith('fw_')&&!KEEP.has(key))keys.push(key);}for(const key of keys)store.removeItem(key);}
 function removeDatabase(name){if(typeof indexedDB==='undefined')return Promise.resolve();return new Promise((resolve,reject)=>{let req;const timer=setTimeout(()=>reject(new Error('Bitte weitere App-Fenster schließen und die Bereinigung erneut versuchen.')),5000);try{req=indexedDB.deleteDatabase(name);}catch(error){clearTimeout(timer);reject(error);return;}req.onsuccess=()=>{clearTimeout(timer);resolve();};req.onerror=()=>{clearTimeout(timer);reject(req.error||new Error('Lokale Berichte konnten nicht gelöscht werden.'));};});}
 function shield(){let panel=byId('privacyCleanupPanel');if(panel)return panel;panel=document.createElement('section');panel.id='privacyCleanupPanel';panel.className='panel privacy-cleanup-panel';panel.setAttribute('role','status');panel.innerHTML='<h2>OneDrive abgemeldet</h2><p id="privacyCleanupStatus">Lokale personenbezogene Daten werden entfernt …</p><button id="privacyCleanupRetry" class="primary-button" type="button" hidden>Bereinigung erneut versuchen</button>';document.body.append(panel);byId('privacyCleanupRetry').onclick=()=>clear();return panel;}
 function clear(){if(running)return running;clearing=true;running=(async()=>{
  safeStorage.setItem(MARKER,'1');
  // Clear all currently displayed data immediately; reloading releases remaining JS references.
  global.Drinks?.reset();global.clearOneDriveHistory?.();global.WorkflowUX?.reset();
  members=[];entries=[];csvArchive=[];adminUnlocked=false;pendingSettingsTarget='';chosenMemberId='';chosenMemberIds.clear();
  if(typeof pendingMemberStatuses!=='undefined')pendingMemberStatuses.clear();
  if(typeof resetDocumentReportState==='function')resetDocumentReportState();
  if(typeof resetOperationState==='function')resetOperationState();
  for(const dialog of document.querySelectorAll('dialog'))dialog.close?.();
  for(const input of document.querySelectorAll('main input,main textarea,#reminderDraftText,#deckel-token,#pushAdminToken,#adminPin,#archivePin'))input.value='';
  const main=document.querySelector('main.app-shell');if(main)main.hidden=true;
  shield();byId('privacyCleanupRetry').hidden=true;byId('privacyCleanupStatus').textContent='Lokale personenbezogene Daten werden entfernt …';
  purge(safeStorage);try{purge(localStorage);}catch{}try{purge(sessionStorage);}catch{}
  const results=await Promise.allSettled(DATABASES.map(removeDatabase));
  const failed=results.find(x=>x.status==='rejected');if(failed)throw failed.reason;
  safeStorage.removeItem(MARKER);try{localStorage.removeItem(MARKER);sessionStorage.removeItem(MARKER);}catch{}
  byId('privacyCleanupStatus').textContent='Lokale Daten entfernt. OneDrive-Dateien bleiben erhalten.';location.reload();
 })().catch(error=>{shield();byId('privacyCleanupStatus').textContent='Die Anmeldung ist beendet. '+(error.message||'Lokale Berichte konnten noch nicht vollständig entfernt werden.');byId('privacyCleanupRetry').hidden=false;}).finally(()=>{running=null;});return running;}
 async function logout({ask=true}={}){
  const unsynced=oneDriveLocalRevision!==oneDriveSyncedRevision&&(members.length||entries.length);
  if(ask&&!confirm(unsynced?'Noch nicht synchronisierte lokale Änderungen können verloren gehen. Wirklich abmelden und lokale Mitglieder, Anwesenheiten, Entwürfe, Sicherungspunkte und Berichte entfernen? Bereits gespeicherte OneDrive-Dateien bleiben erhalten.':'Abmelden und lokale Mitglieder, Anwesenheiten, Entwürfe, Sicherungspunkte und Berichte entfernen? Dateien in OneDrive bleiben erhalten.'))return false;
  endOneDriveSession();await clear();return true;
 }
 global.AppPrivacy={logout,clear,get clearing(){return clearing;}};
 global.addEventListener?.('storage',event=>{if(event.key==='fw_onedrive_tokens'&&event.newValue===null&&!clearing)logout({ask:false});});
 if(safeStorage.getItem(MARKER)==='1'){
  const resume=()=>{endOneDriveSession();clear();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resume,{once:true});else resume();
 }
})(window);
