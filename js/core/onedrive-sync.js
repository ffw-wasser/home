"use strict";
const OD_CLIENT_KEY="fw_onedrive_client_id",OD_SHARE_KEY="fw_onedrive_shared_folder_url",OD_TOKEN_KEY="fw_onedrive_tokens",OD_PKCE_KEY="fw_onedrive_pkce",OD_STATE_FILE="feuerwehr-wasser-daten.json";
let oneDriveBusy=false,oneDriveTimer=null,oneDriveApplying=false,oneDriveSharedRoot=null,oneDriveLastError="",oneDriveRetryUntil=0;
let oneDriveAccessConfirmed=false,oneDriveSessionEpoch=0;
const oneDriveRequests=new Set();
function oneDriveAdministrationReady(){return oneDriveAccessConfirmed&&oneDriveSignedIn()&&navigator.onLine!==false&&!window.AppPrivacy?.clearing;}
function endOneDriveSession(){oneDriveSessionEpoch++;oneDriveAccessConfirmed=false;oneDriveStateConfirmed=false;oneDriveSharedRoot=null;oneDriveResyncRequested=false;clearTimeout(oneDriveTimer);for(const controller of oneDriveRequests)controller.abort();oneDriveRequests.clear();localStorage.removeItem(OD_TOKEN_KEY);sessionStorage.removeItem(OD_PKCE_KEY);window.Drinks?.reset();window.clearOneDriveHistory?.();}
function assertOneDriveSession(epoch){if(epoch!==oneDriveSessionEpoch)throw new Error("OneDrive-Anmeldung wurde beendet. Abruf verworfen.");}
let oneDriveLocalRevision=0,oneDriveSyncedRevision=-1,oneDriveStateConfirmed=false,oneDriveResyncRequested=false;
function getAppStorageState(){
  const memory=typeof safeStorage!=="undefined"&&safeStorage.persistent===false;
  if(oneDriveStateConfirmed&&oneDriveLocalRevision===oneDriveSyncedRevision)return {kind:"cloud",text:"Mit OneDrive synchronisiert"};
  const local=memory?"Für diese Sitzung gespeichert":"Auf diesem Gerät gespeichert";
  const detail=!navigator.onLine?"offline":!oneDriveSignedIn()?"OneDrive nicht verbunden":oneDriveBusy?"OneDrive synchronisiert …":"OneDrive noch nicht bestätigt";
  return {kind:"local",text:local+" · "+detail};
}
function notifyAppStorageState(){window.AttendanceSmart?.storageStatus();}
const odRedirect=()=>"https://ffw-wasser.github.io/home/";
const odConfig=()=>({clientId:localStorage.getItem(OD_CLIENT_KEY)||"",authority:"https://login.microsoftonline.com/consumers/oauth2/v2.0",scope:"openid profile offline_access Files.ReadWrite"});
const odB64Url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const odShareToken=url=>"u!"+odB64Url(new TextEncoder().encode(url));
async function odChallenge(v){return odB64Url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));}
function oneDriveTokens(){try{return JSON.parse(localStorage.getItem(OD_TOKEN_KEY)||"null");}catch{return null;}}
function oneDriveSignedIn(){return Boolean(oneDriveTokens()?.access_token);}
function oneDriveStatus(text,state="offline"){const label=byId("cloudSyncLabel"),sub=byId("cloudSyncState");if(label)label.textContent="OneDrive";if(sub)sub.textContent=text;byId("cloudSyncButton")?.setAttribute("data-state",state);}
function saveOneDriveSettings(){if(!requireAdmin("settingsView",{allowDisconnected:true}))return null;const previousClient=localStorage.getItem(OD_CLIENT_KEY)||"",previousShare=localStorage.getItem(OD_SHARE_KEY)||"";const clientId=(byId("oneDriveClientId")?.value||"").trim(),share=(byId("oneDriveShareUrl")?.value||"").trim();if(clientId)localStorage.setItem(OD_CLIENT_KEY,clientId);if(share)localStorage.setItem(OD_SHARE_KEY,share);else localStorage.removeItem(OD_SHARE_KEY);oneDriveSharedRoot=null;if(previousClient!==clientId||previousShare!==share){oneDriveStateConfirmed=false;oneDriveAccessConfirmed=false;notifyAppStorageState();window.Drinks?.reset();}return {clientId,share};}
async function oneDriveLogin(){const settings=saveOneDriveSettings();if(!settings)return;const {clientId,share}=settings;if(!clientId)return showToast("Bitte zuerst die Client-ID eintragen.","error");if(!share)return showToast("Bitte den Link zum gemeinsamen OneDrive-Ordner eintragen.","error");endOneDriveSession();const verifier=odB64Url(crypto.getRandomValues(new Uint8Array(48))),state=odB64Url(crypto.getRandomValues(new Uint8Array(18))),challenge=await odChallenge(verifier);sessionStorage.setItem(OD_PKCE_KEY,JSON.stringify({verifier,state}));const c=odConfig(),url=new URL(c.authority+"/authorize");url.search=new URLSearchParams({client_id:c.clientId,response_type:"code",redirect_uri:odRedirect(),response_mode:"query",scope:c.scope,code_challenge:challenge,code_challenge_method:"S256",state,prompt:"consent"}).toString();location.assign(url.toString());}
async function oneDriveHandleCallback(){const q=new URLSearchParams(location.search),code=q.get("code");if(!code)return;const saved=JSON.parse(sessionStorage.getItem(OD_PKCE_KEY)||"null");if(!saved||saved.state!==q.get("state"))throw new Error("Ungültiger Anmeldestatus");const c=odConfig(),body=new URLSearchParams({client_id:c.clientId,grant_type:"authorization_code",code,redirect_uri:odRedirect(),code_verifier:saved.verifier,scope:c.scope});const response=await fetch(c.authority+"/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});const data=await response.json();if(!response.ok)throw new Error(data.error_description||"OneDrive-Anmeldung fehlgeschlagen");data.obtained_at=Date.now();localStorage.setItem(OD_TOKEN_KEY,JSON.stringify(data));sessionStorage.removeItem(OD_PKCE_KEY);history.replaceState({},"",location.pathname+location.hash);}
let oneDriveTokenRefresh=null;
async function oneDriveAccessToken(force=false,rejectedToken=""){
  const token=oneDriveTokens();
  if(!token)throw new Error("Nicht bei OneDrive angemeldet");
  if(force&&rejectedToken&&token.access_token!==rejectedToken)return token.access_token;
  if(oneDriveTokenRefresh)return oneDriveTokenRefresh;
  if(!force&&Date.now()<(token.obtained_at||0)+(Number(token.expires_in||3600)-120)*1000)return token.access_token;
  if(!token.refresh_token)throw new Error("OneDrive-Anmeldung abgelaufen. Bitte erneut anmelden.");
  const saved=localStorage.getItem(OD_TOKEN_KEY);
  oneDriveTokenRefresh=(async()=>{
    const c=odConfig(),body=new URLSearchParams({client_id:c.clientId,grant_type:"refresh_token",refresh_token:token.refresh_token,scope:c.scope});
    const response=await fetch(c.authority+"/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const data=await response.json();
    if(!response.ok){const error=new Error("OneDrive-Anmeldung konnte nicht erneuert werden. Bitte erneut anmelden.");error.status=response.status;error.code=data.error;throw error;}
    if(localStorage.getItem(OD_TOKEN_KEY)!==saved)throw new Error("OneDrive-Anmeldung wurde während des Abrufs geändert. Bitte erneut synchronisieren.");
    data.refresh_token=data.refresh_token||token.refresh_token;data.obtained_at=Date.now();
    localStorage.setItem(OD_TOKEN_KEY,JSON.stringify(data));return data.access_token;
  })().finally(()=>{oneDriveTokenRefresh=null;});
  return oneDriveTokenRefresh;
}
function odRetryDelay(response,attempt){
  const header=response?.headers?.get("Retry-After"),seconds=Number(header);
  if(header&&Number.isFinite(seconds)&&seconds>=0)return seconds*1000;
  const date=header?Date.parse(header):NaN;
  if(Number.isFinite(date))return Math.max(0,date-Date.now());
  return Math.min(1000*2**attempt,8000);
}
async function odFetch(url,options={},retry=true){
  const epoch=oneDriveSessionEpoch;
  const readable=["GET","HEAD"].includes(String(options.method||"GET").toUpperCase());
  let attempts=0,authRetried=false,forcedToken="";
  for(;;){
    assertOneDriveSession(epoch);
    const wait=Math.max(0,oneDriveRetryUntil-Date.now());
    if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    const headers=new Headers(options.headers||{});
    const token=forcedToken||await oneDriveAccessToken();forcedToken="";
    assertOneDriveSession(epoch);
    headers.set("Authorization","Bearer "+token);
    let response;
    const controller=typeof AbortController!=="undefined"?new AbortController():null;const cancel=()=>controller?.abort();
    if(controller){oneDriveRequests.add(controller);options.signal?.addEventListener("abort",cancel,{once:true});if(options.signal?.aborted)controller.abort();}
    try{response=await fetch(url,{...options,headers,...(controller?{signal:controller.signal}:{})});assertOneDriveSession(epoch);}
    catch(error){
      assertOneDriveSession(epoch);
      if(!retry||!readable||error?.name==="AbortError"||options.signal?.aborted||navigator.onLine===false||attempts>=3)throw error;
      await new Promise(resolve=>setTimeout(resolve,odRetryDelay(null,attempts++)));continue;
    }
    finally{if(controller)oneDriveRequests.delete(controller);options.signal?.removeEventListener("abort",cancel);}
    if(response.status===401&&!authRetried){
      authRetried=true;forcedToken=await oneDriveAccessToken(true,token);continue;
    }
    if(response.status===429)oneDriveRetryUntil=Date.now()+odRetryDelay(response,attempts);
    const transient=response.status===429||(readable&&[502,503,504].includes(response.status));
    if(retry&&transient&&attempts<3){
      const delay=odRetryDelay(response,attempts++);
      if(response.status!==429)await new Promise(resolve=>setTimeout(resolve,delay));
      continue;
    }
    if(!response.ok){
      let data={};try{data=JSON.parse(await response.text());}catch{}
      const error=new Error(`OneDrive-Fehler ${response.status}${data.error?.code?" ("+data.error.code+")":""}`);
      error.status=response.status;error.code=data.error?.code||"";throw error;
    }
    return response;
  }
}
async function oneDriveResolveSharedRoot(){const epoch=oneDriveSessionEpoch;if(oneDriveSharedRoot)return oneDriveSharedRoot;const share=localStorage.getItem(OD_SHARE_KEY)||"";if(!share)throw new Error("Kein gemeinsamer OneDrive-Ordner eingerichtet");const response=await odFetch(`https://graph.microsoft.com/v1.0/shares/${odShareToken(share)}/driveItem?$select=id,name,parentReference,folder,remoteItem`,{headers:{Prefer:"redeemSharingLink"}});const item=await response.json(),resolved=item.remoteItem||item,driveId=resolved.parentReference?.driveId||item.parentReference?.driveId,id=resolved.id||item.id;assertOneDriveSession(epoch);if(!driveId||!id||!resolved.folder&&!item.folder)throw new Error("Der Freigabelink verweist nicht auf einen zugänglichen Ordner");oneDriveSharedRoot={driveId,id,name:resolved.name||item.name||"Gemeinsamer Ordner"};return oneDriveSharedRoot;}
const odItemBase=(root=oneDriveSharedRoot)=>`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(root.id)}`;
function oneDrivePayload(){return {schemaVersion:3,updatedAt:new Date().toISOString(),members,entries,csvArchive,roleTargets:typeof getRoleTargets==="function"?getRoleTargets():{},functionEntryEnabled:typeof isFunctionEntryEnabled==="function"?isFunctionEntryEnabled():true};}
function applyOneDrivePayload(data){if(!data||!Array.isArray(data.members)||!Array.isArray(data.entries))throw new Error("OneDrive-Datendatei ist ungültig");oneDriveApplying=true;members=data.members;entries=data.entries;const importedRoleTargets=data.roleTargets||{};const importedFunctionEntryEnabled=data.functionEntryEnabled!==false;safeStorage.setItem(KEYS.members,JSON.stringify(members));safeStorage.setItem(KEYS.entries,JSON.stringify(entries));safeStorage.removeItem?.(KEYS.archive);if(typeof saveRoleTargets==="function")saveRoleTargets(importedRoleTargets);else safeStorage.setItem(KEYS.roleTargets,JSON.stringify(importedRoleTargets));safeStorage.setItem(KEYS.functionEntry,String(importedFunctionEntryEnabled));oneDriveApplying=false;if(typeof renderMembers==="function")renderMembers();if(typeof renderToday==="function")renderToday();if(typeof renderAdmin==="function")renderAdmin();if(typeof renderStatistics==="function")renderStatistics();}
async function oneDriveReadState(){const epoch=oneDriveSessionEpoch;const root=await oneDriveResolveSharedRoot(),response=await odFetch(`${odItemBase(root)}:/${encodeURIComponent(OD_STATE_FILE)}:/content`);const data=await response.json();assertOneDriveSession(epoch);return data;}
async function oneDriveWriteState(){const epoch=oneDriveSessionEpoch;const root=await oneDriveResolveSharedRoot();assertOneDriveSession(epoch);const data=JSON.stringify(oneDrivePayload());await odFetch(`${odItemBase(root)}:/${encodeURIComponent(OD_STATE_FILE)}:/content`,{method:"PUT",headers:{"Content-Type":"application/json"},body:data});assertOneDriveSession(epoch);localStorage.setItem("fw_onedrive_last_sync",new Date().toISOString());}
async function odEnsureFolder(parentId,name){const root=await oneDriveResolveSharedRoot(),list=await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(parentId)}/children?$select=id,name,folder`),data=await list.json(),existing=(data.value||[]).find(x=>x.folder&&x.name===name);if(existing)return existing.id;const response=await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(parentId)}/children`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,folder:{},"@microsoft.graph.conflictBehavior":"fail"})});return (await response.json()).id;}
async function syncOneDrive({manual=false,refreshHistory=manual}={}){
  if(!oneDriveSignedIn()||!navigator.onLine){notifyAppStorageState();return;}
  if(oneDriveBusy){oneDriveResyncRequested=true;return;}
  const epoch=oneDriveSessionEpoch;const startRevision=oneDriveLocalRevision;oneDriveBusy=true;notifyAppStorageState();oneDriveStatus("Synchronisiert","syncing");
  try{
    let stateError=null;
    try{
      let remote=null;
      try{remote=await oneDriveReadState();}catch(error){if(!String(error.message).includes("itemNotFound"))throw error;}
      assertOneDriveSession(epoch);const localUpdated=localStorage.getItem("fw_onedrive_local_updated")||"";
      if(remote&&remote.updatedAt>localUpdated&&oneDriveLocalRevision===startRevision){
        applyOneDrivePayload(remote);oneDriveSyncedRevision=oneDriveLocalRevision;
        localStorage.setItem("fw_onedrive_local_updated",remote.updatedAt);localStorage.setItem("fw_onedrive_last_sync",new Date().toISOString());
      }else {const writeRevision=oneDriveLocalRevision;await oneDriveWriteState();oneDriveSyncedRevision=writeRevision;}
      assertOneDriveSession(epoch);oneDriveAccessConfirmed=true;oneDriveStateConfirmed=oneDriveSyncedRevision===oneDriveLocalRevision;notifyAppStorageState();
    }catch(error){if(epoch!==oneDriveSessionEpoch)return;oneDriveAccessConfirmed=false;oneDriveStateConfirmed=false;stateError=error;notifyAppStorageState();}
    // ZIP-Berichte liefern die Statistik, unabhängig davon, welche Ansicht offen ist.
    // Auch bei einer fehlerhaften Datendatei versuchen, die Berichte zu laden.
    if(refreshHistory&&typeof window.loadOneDriveHistory==="function"){
      oneDriveStatus("Lädt Historie","syncing");
      if(await window.loadOneDriveHistory()===false)throw new Error(window.oneDriveHistoryLastError||"OneDrive-Historie konnte nicht aktualisiert werden.");
    }
    if(stateError)throw stateError;
    assertOneDriveSession(epoch);oneDriveLastError="";oneDriveStatus(oneDriveStateConfirmed?"Aktuell":"Änderungen ausstehend",oneDriveStateConfirmed?"online":"syncing");
    if(manual)showToast(oneDriveStateConfirmed?"Daten und Historie im gemeinsamen OneDrive-Ordner wurden synchronisiert.":"Neue Änderungen werden noch mit OneDrive synchronisiert.");
  }catch(error){
    if(epoch!==oneDriveSessionEpoch)return;
    console.error(error);oneDriveLastError=String(error.message||error);oneDriveStatus("Fehler","error");
    const detail=byId("oneDriveDetail");if(detail)detail.textContent=`Fehler: ${oneDriveLastError}`;
    if(manual)showToast("OneDrive-Synchronisierung fehlgeschlagen. Details stehen im OneDrive-Fenster.","error");
  }finally{
    oneDriveBusy=false;renderOneDriveDialog();notifyAppStorageState();
    const again=oneDriveResyncRequested||(oneDriveLocalRevision>startRevision&&oneDriveLocalRevision!==oneDriveSyncedRevision);oneDriveResyncRequested=false;
    if(again&&epoch===oneDriveSessionEpoch&&oneDriveSignedIn()){clearTimeout(oneDriveTimer);oneDriveTimer=setTimeout(()=>syncOneDrive(),900);}
  }
}
function scheduleCloudSync(){if(oneDriveApplying)return;oneDriveLocalRevision++;oneDriveStateConfirmed=false;localStorage.setItem("fw_onedrive_local_updated",new Date().toISOString());notifyAppStorageState();if(!oneDriveSignedIn())return;clearTimeout(oneDriveTimer);oneDriveTimer=setTimeout(()=>syncOneDrive(),900);}
async function oneDriveUploadReport(blob,fileName){const root=await oneDriveResolveSharedRoot(),reportsId=await odEnsureFolder(root.id,"Berichte"),folderName=String(fileName||"").toLowerCase().endsWith(".pdf")?"PDF":"CSV",folderId=await odEnsureFolder(reportsId,folderName),safe=String(fileName||`Bericht-${Date.now()}`).replace(/[\\/:*?"<>|]/g,"-");await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(safe)}:/content`,{method:"PUT",headers:{"Content-Type":blob.type||"application/octet-stream"},body:blob});showToast(`${safe} wurde im gemeinsamen OneDrive-Ordner gespeichert.`);}
function ensureOneDriveUi(){if(byId("cloudSyncButton"))return;const button=document.createElement("button");button.id="cloudSyncButton";button.className="cloud-sync-button";button.type="button";button.innerHTML='<span class="cloud-sync-icon" aria-hidden="true">☁</span><span class="cloud-sync-copy"><b id="cloudSyncLabel">OneDrive</b><small id="cloudSyncState">Einrichten</small></span>';(document.querySelector(".top-nav-actions")||document.querySelector(".top-nav")||document.body).appendChild(button);const dialog=document.createElement("dialog");dialog.id="cloudSyncDialog";dialog.className="cloud-sync-dialog";dialog.innerHTML='<div class="cloud-sync-shell"><header><div><small>Gemeinsame Datenablage</small><h2>OneDrive-Synchronisierung</h2></div><button type="button" id="cloudSyncClose" aria-label="OneDrive-Status schließen" class="cloud-sync-close">×</button></header><div class="cloud-sync-body"><p id="oneDriveDetail" role="status"></p><button type="button" class="outline-button" id="oneDriveManage">Verbindung verwalten</button><label>Microsoft Entra Client-ID<input id="oneDriveClientId" class="text-input" autocomplete="off"></label><label>Link zum gemeinsamen OneDrive-Ordner<input id="oneDriveShareUrl" class="text-input" type="url" inputmode="url" autocomplete="off" placeholder="Freigabelink hier einfügen"></label><p class="cloud-sync-help">Der Link bleibt auf diesem Gerät. Das angemeldete Microsoft-Konto benötigt Bearbeitungszugriff auf den freigegebenen Ordner.</p><div class="cloud-sync-actions"><button type="button" class="primary-button" id="oneDriveLogin">Einstellungen speichern und mit Microsoft anmelden</button><button type="button" class="primary-button" id="oneDriveNow">Erneut laden</button><button type="button" class="danger-button" id="oneDriveLogout">Abmelden</button></div></div></div>';document.body.appendChild(dialog);button.onclick=()=>{renderOneDriveDialog();dialog.showModal();};byId("cloudSyncClose").onclick=()=>dialog.close();byId("oneDriveManage").onclick=()=>{if(requireAdmin("settingsView",{allowDisconnected:true})){renderOneDriveDialog();}};byId("oneDriveLogin").onclick=oneDriveLogin;byId("oneDriveNow").onclick=()=>syncOneDrive({manual:true,refreshHistory:true});byId("oneDriveLogout").onclick=()=>{if(!requireAdmin("settingsView",{allowDisconnected:true}))return;window.AppPrivacy.logout();};}
function renderOneDriveDialog(){const signed=oneDriveSignedIn(),client=byId("oneDriveClientId"),share=byId("oneDriveShareUrl"),detail=byId("oneDriveDetail");if(client){client.closest("label").hidden=!adminUnlocked;client.readOnly=!adminUnlocked;client.value=localStorage.getItem(OD_CLIENT_KEY)||"";}if(share){share.closest("label").hidden=!adminUnlocked;share.readOnly=!adminUnlocked;share.value=localStorage.getItem(OD_SHARE_KEY)||"";}if(detail)detail.textContent=oneDriveLastError?`Fehler: ${oneDriveLastError}`:(signed?"Verbunden. App-Daten werden mit OneDrive synchronisiert und zusätzlich auf diesem Gerät gespeichert. Getränkekonten werden ausschließlich in OneDrive geführt.":"Nicht verbunden. Die Verwaltung kann OneDrive hier einrichten.");for(const id of ["oneDriveNow","oneDriveLogout"])if(byId(id))byId(id).hidden=!signed;if(byId("oneDriveLogin"))byId("oneDriveLogin").hidden=signed;if(byId("oneDriveLogout"))byId("oneDriveLogout").hidden=!signed||!adminUnlocked;if(byId("oneDriveManage"))byId("oneDriveManage").hidden=adminUnlocked;const help=document.querySelector(".cloud-sync-help");if(help)help.hidden=!adminUnlocked;const last=localStorage.getItem("fw_onedrive_last_sync");if(detail&&last)detail.textContent+=" · Letzte App-Synchronisierung: "+new Date(last).toLocaleString("de-DE");}
async function initCloudSync(){ensureOneDriveUi();try{await oneDriveHandleCallback();}catch(error){console.error(error);showToast("OneDrive-Anmeldung konnte nicht abgeschlossen werden.","error");}renderOneDriveDialog();if(oneDriveSignedIn()){oneDriveStatus("Verbindet","syncing");await syncOneDrive({refreshHistory:true});}else oneDriveStatus("Einrichten","offline");addEventListener("online",()=>syncOneDrive({refreshHistory:true}));document.addEventListener("visibilitychange",()=>{if(!document.hidden)return syncOneDrive({refreshHistory:true});});}

async function oneDriveConvertDocxToPdf(docxBlob,fileName){if(!oneDriveSignedIn())throw new Error("Für die Word-zu-PDF-Konvertierung bitte zuerst OneDrive verbinden.");const safe=("FFW-Wasser-Temp-"+Date.now()+".docx").replace(/[^A-Za-z0-9._-]/g,"-");let item=null;try{const upload=await odFetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(safe)}:/content`,{method:"PUT",headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},body:docxBlob});item=await upload.json();let response;try{response=await odFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}/content?format=pdf`);}catch(error){throw new Error("Die Word-Datei wurde erstellt, aber OneDrive konnte die PDF-Konvertierung nicht laden. Bitte OneDrive in der App einmal ab- und wieder anmelden.");}const blob=await response.blob();if(!blob.size)throw new Error("OneDrive hat eine leere PDF zurückgegeben.");return blob;}catch(error){if(error instanceof TypeError||/Failed to fetch/i.test(String(error?.message||error)))throw new Error("OneDrive ist derzeit nicht erreichbar. Bitte Internetverbindung prüfen und OneDrive in der App neu verbinden.");throw error;}finally{if(item?.id)odFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}`,{method:"DELETE"}).catch(()=>{});}}

globalThis.oneDriveConvertDocxToPdf=oneDriveConvertDocxToPdf;
