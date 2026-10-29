"use strict";
const OD_CLIENT_KEY="fw_onedrive_client_id",OD_SHARE_KEY="fw_onedrive_shared_folder_url",OD_TOKEN_KEY="fw_onedrive_tokens",OD_PKCE_KEY="fw_onedrive_pkce",OD_STATE_FILE="feuerwehr-wasser-daten.json";
let oneDriveBusy=false,oneDriveTimer=null,oneDriveApplying=false,oneDriveSharedRoot=null,oneDriveLastError="",oneDriveRetryUntil=0,oneDriveLastFailure=null;
let oneDriveAccessConfirmed=false,oneDriveSessionEpoch=0,oneDriveStartupConfirmed=false,oneDriveStartupStage="OneDrive-Anmeldung wird geprüft …",oneDriveStartupChecking=false;
function updateOneDriveStartup(){window.AppStartup?.update({ready:oneDriveStartupConfirmed&&oneDriveSignedIn(),busy:oneDriveBusy,signed:oneDriveSignedIn(),error:oneDriveNeedsLogin||Boolean(oneDriveLastError),stage:oneDriveStartupStage,connecting:oneDriveAuthorizing||oneDriveStartupChecking,needsLogin:oneDriveNeedsLogin,offline:navigator.onLine===false});}
window.updateOneDriveStartup=updateOneDriveStartup;
const OD_ADMIN_RETURN_KEY='fw_onedrive_admin_return';
const OD_VERIFIED_ROOT_KEY='fw_onedrive_verified_root';
let oneDriveAdminReturn=null,oneDriveNeedsLogin=false;
const OD_SILENT_RETRY_KEY='fw_onedrive_silent_retry';
let oneDriveAuthorizing=false;
function odLoginHint(token){try{const part=token?.id_token?.split('.')[1];if(!part)return '';const data=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')));return [data.login_hint,data.preferred_username,data.email].find(value=>typeof value==='string'&&value.length>0)||'';}catch{return '';}}
function oneDriveCancelAdminReturn(){oneDriveAdminReturn=null;sessionStorage.removeItem(OD_ADMIN_RETURN_KEY);}
window.oneDriveCancelAdminReturn=oneDriveCancelAdminReturn;
async function odAccountKey(token){try{const encoded=token?.id_token?.split('.')[1];if(!encoded)return '';const data=JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=')));if(typeof data.iss!=='string'||typeof data.sub!=='string')return '';return odChallenge(odConfig().clientId+'|'+data.iss+'|'+data.sub);}catch{return '';}}
const odReturnViews=new Set(['settingsView','settingsCalendarView','settingsHistoryView','settingsStatisticsView','theaterCashView','theaterStatsView','theaterManageView','settingsQuizQuestionsView','settingsBookingsView','settingsPushView','settingsDrinksView','settingsMembersView','settingsGoalsView','settingsSecurityView','settingsFilesView','settingsRemindersView','settingsRewardsView','settingsBackupView','settingsPortalView']);
async function odAdminReturnPlan(state){
 if(typeof adminUnlocked==='undefined'||!adminUnlocked||typeof adminUnlockUntil==='undefined'||adminUnlockUntil<=Date.now())return null;
 const identity=await odAccountKey(oneDriveTokens());if(!identity||!adminUnlocked||adminUnlockUntil<=Date.now())return null;const config=odConfig(),share=localStorage.getItem(OD_SHARE_KEY)||'',visibleView=document.querySelector('.view:not([hidden])')?.id,view=visibleView==='theaterView'?(window.TheaterAdmin?.route?.()||'theaterManageView'):visibleView;let root=oneDriveSharedRoot;
 if(!root){try{const saved=JSON.parse(localStorage.getItem(OD_VERIFIED_ROOT_KEY)||'null');if(saved?.version===1&&saved.clientId===config.clientId&&saved.identity===identity&&saved.shareHash===await odChallenge(share)&&typeof saved.driveId==='string'&&typeof saved.id==='string')root=saved;}catch{}}
 if(!root||!adminUnlocked||adminUnlockUntil<=Date.now())return null;
 return {version:1,state,identity,clientId:config.clientId,share,driveId:root.driveId,folderId:root.id,createdAt:Date.now(),validUntil:Math.min(adminUnlockUntil,Date.now()+5*60000),adminUntil:adminUnlockUntil,view:odReturnViews.has(view)?view:'settingsView'};
}
function restoreOneDriveAdminReturn(){
 const plan=oneDriveAdminReturn;oneDriveAdminReturn=null;if(!plan||plan.validUntil<Date.now()||plan.adminUntil<=Date.now()||!oneDriveAdministrationReady()||oneDriveSharedRoot?.driveId!==plan.driveId||oneDriveSharedRoot?.id!==plan.folderId||odConfig().clientId!==plan.clientId||localStorage.getItem(OD_SHARE_KEY)!==plan.share||!odReturnViews.has(plan.view))return false;
 adminUnlocked=true;adminUnlockUntil=plan.adminUntil;renderAdmin();pendingSettingsTarget='';showView(plan.view);window.SmartWorkflow?.settings?.();clearTimeout(adminTimeoutId);adminUnlockUntil=plan.adminUntil;adminTimeoutId=setTimeout(()=>logoutAdmin(true),Math.max(0,plan.adminUntil-Date.now()));return true;
}
const oneDriveRequests=new Set();
function oneDriveAdministrationReady(){return oneDriveAccessConfirmed&&oneDriveSignedIn()&&navigator.onLine!==false&&!window.AppPrivacy?.clearing;}
function endOneDriveSession(){oneDriveStartupConfirmed=false;window.CalendarSidebar?.clear();window.YearPlan?.lock();window.PortalHydrantsView?.clearIpad();oneDriveSessionEpoch++;oneDriveCancelAdminReturn();oneDriveNeedsLogin=false;oneDriveAuthorizing=false;oneDriveAccessConfirmed=false;oneDriveStateConfirmed=false;oneDriveSharedRoot=null;oneDriveResyncRequested=false;clearTimeout(oneDriveTimer);for(const controller of oneDriveRequests)controller.abort();oneDriveRequests.clear();localStorage.removeItem(OD_TOKEN_KEY);sessionStorage.removeItem(OD_PKCE_KEY);sessionStorage.removeItem(OD_SILENT_RETRY_KEY);window.Drinks?.reset();window.DrinksQuizQuestions?.lock();window.DrinksChallengeSettings?.lock();window.clearOneDriveHistory?.();updateOneDriveStartup();}
function assertOneDriveSession(epoch){if(epoch!==oneDriveSessionEpoch)throw new Error("OneDrive-Anmeldung wurde beendet. Abruf verworfen.");}
let oneDriveLocalRevision=0,oneDriveSyncedRevision=-1,oneDriveStateConfirmed=false,oneDriveResyncRequested=false;
function getAppStorageState(){
  const memory=typeof safeStorage!=="undefined"&&safeStorage.persistent===false;
  if(oneDriveStateConfirmed&&oneDriveLocalRevision===oneDriveSyncedRevision)return {kind:"cloud",text:"In OneDrive gespeichert"};
  const local=memory?"Für diese Sitzung gespeichert":"Auf diesem Gerät gespeichert";
  const failed=Boolean(oneDriveLastError)&&!oneDriveBusy;
  const detail=navigator.onLine===false?"offline":!oneDriveSignedIn()?"OneDrive nicht verbunden":oneDriveBusy?"OneDrive synchronisiert …":failed?"OneDrive-Synchronisierung fehlgeschlagen – erneut versuchen":"OneDrive noch nicht bestätigt";
  return {kind:failed?"error":"local",text:local+" · "+detail};
}
function notifyAppStorageState(){updateOneDriveStartup();updateOneDriveHeaderStatus();window.AttendanceSmart?.storageStatus();window.WorkflowUX?.storage();window.SmartWorkflow?.settings?.();window.PortalAdmin?.storageChanged?.();}
const odRedirect=()=>"https://ffw-wasser.github.io/home/";
const odConfig=()=>({clientId:localStorage.getItem(OD_CLIENT_KEY)||"",authority:"https://login.microsoftonline.com/consumers/oauth2/v2.0",scope:"openid profile offline_access Files.ReadWrite"});
const odB64Url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const odShareToken=url=>"u!"+odB64Url(new TextEncoder().encode(url));
async function odChallenge(v){return odB64Url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));}
function oneDriveTokens(){try{return JSON.parse(localStorage.getItem(OD_TOKEN_KEY)||"null");}catch{return null;}}
function oneDriveSignedIn(){return Boolean(oneDriveTokens()?.access_token);}
function oneDriveStatus(text,state="offline"){
 if(text==="Verbindet")oneDriveStartupStage="OneDrive-Anmeldung wird geprüft …";
 else if(text==="Lädt Historie")oneDriveStartupStage="Berichte und Historie werden geladen …";
 else if(state==="syncing"&&text==="Synchronisiert")oneDriveStartupStage="Gemeinsame Daten werden synchronisiert …";
 updateOneDriveStartup();
 const label=byId("cloudSyncLabel"),sub=byId("cloudSyncState"),button=byId("cloudSyncButton");
 const message=state==="online"?"Synchronisiert":text==="Synchronisiert"&&state==="syncing"?"Wird synchronisiert …":text==="Einrichten"?"Nicht verbunden":text==="Anmeldung bestätigen"?"Anmeldung erforderlich":text==="Änderungen ausstehend"?"Speicherung ausstehend":text==="Fehler"?"Synchronisierung fehlgeschlagen":text;
 if(label)label.textContent="OneDrive";if(sub)sub.textContent=message;
 if(button){button.setAttribute("data-state",state);button.setAttribute("aria-label","OneDrive: "+message+". Verbindungsdetails öffnen.");button.title="Verbindungsdetails öffnen";}
}
function updateOneDriveHeaderStatus(){
 if(!byId("cloudSyncButton"))return;
 if(oneDriveNeedsLogin)return oneDriveStatus("Anmeldung erforderlich","error");
 if(oneDriveBusy)return oneDriveStatus("Wird synchronisiert …","syncing");
 if(oneDriveLastError)return oneDriveStatus("Synchronisierung fehlgeschlagen","error");
 if(navigator.onLine===false)return oneDriveStatus("Offline","offline");
 const storage=getAppStorageState();
 if(storage.kind==="cloud")return oneDriveStatus("Synchronisiert","online");
 oneDriveStatus(oneDriveSignedIn()?"Speicherung ausstehend":"Nicht verbunden",oneDriveSignedIn()?"syncing":"offline");
}

function saveOneDriveSettings(){if(!requireAdmin("settingsView",{allowDisconnected:true}))return null;const previousClient=localStorage.getItem(OD_CLIENT_KEY)||"",previousShare=localStorage.getItem(OD_SHARE_KEY)||"";const clientId=(byId("oneDriveClientId")?.value||"").trim(),share=(byId("oneDriveShareUrl")?.value||"").trim();if(clientId)localStorage.setItem(OD_CLIENT_KEY,clientId);if(share)localStorage.setItem(OD_SHARE_KEY,share);else localStorage.removeItem(OD_SHARE_KEY);if(previousClient!==clientId||previousShare!==share){oneDriveStartupConfirmed=false;oneDriveSharedRoot=null;oneDriveStateConfirmed=false;oneDriveAccessConfirmed=false;notifyAppStorageState();window.Drinks?.reset();window.DrinksQuizQuestions?.lock();window.DrinksChallengeSettings?.lock();}return {clientId,share};}
async function oneDriveLogin(){
 // Existing connection: renew only the saved account, without opening configuration.
 const settings=oneDriveSignedIn()&&!adminUnlocked?{clientId:odConfig().clientId,share:localStorage.getItem(OD_SHARE_KEY)||''}:saveOneDriveSettings();if(!settings)return;
 if(!settings.clientId)return showToast("Bitte zuerst die Client-ID eintragen.","error");if(!settings.share)return showToast("Bitte den Link zum gemeinsamen OneDrive-Ordner eintragen.","error");
 try{await odStartAuthorization(false,settings);}catch(error){oneDriveAuthorizing=false;showToast(error.message||"OneDrive-Anmeldung konnte nicht gestartet werden.","error");}
}
async function odStartAuthorization(silent,settings,canNavigate=()=>true){
 if(oneDriveAuthorizing)return false;oneDriveAuthorizing=true;oneDriveStartupStage="Microsoft-Anmeldung wird vorbereitet …";updateOneDriveStartup();
 try{
  const epoch=oneDriveSessionEpoch,token=oneDriveTokens(),identity=await odAccountKey(token),hint=odLoginHint(token);
  if(silent&&!identity){oneDriveAuthorizing=false;return false;}
  const verifier=odB64Url(crypto.getRandomValues(new Uint8Array(48))),state=odB64Url(crypto.getRandomValues(new Uint8Array(18))),challenge=await odChallenge(verifier),resume=await odAdminReturnPlan(state);
  assertOneDriveSession(epoch);if(silent&&!canNavigate()){oneDriveAuthorizing=false;return false;}const c=odConfig();if(settings.clientId!==c.clientId||settings.share!==(localStorage.getItem(OD_SHARE_KEY)||''))throw new Error('OneDrive-Konfiguration wurde geändert. Bitte erneut versuchen.');
  if(!token)endOneDriveSession();
  oneDriveAccessConfirmed=false;oneDriveStateConfirmed=false;oneDriveSharedRoot=null;
  sessionStorage.setItem(OD_PKCE_KEY,JSON.stringify({verifier,state,clientId:c.clientId,share:settings.share,identity,createdAt:Date.now(),silent}));
  if(resume)sessionStorage.setItem(OD_ADMIN_RETURN_KEY,JSON.stringify(resume));
  const url=new URL(c.authority+'/authorize');url.search=new URLSearchParams({client_id:c.clientId,response_type:'code',redirect_uri:odRedirect(),response_mode:'query',scope:c.scope,code_challenge:challenge,code_challenge_method:'S256',state}).toString();
  if(hint)url.searchParams.set('login_hint',hint);
  if(silent){url.searchParams.set('prompt','none');sessionStorage.setItem(OD_SILENT_RETRY_KEY,String(Date.now()));}
  location.assign(url.toString());return true;
 }catch(error){oneDriveAuthorizing=false;throw error;}
}
async function oneDriveHandleCallback(){
 const q=new URLSearchParams(location.search),code=q.get("code"),authError=q.get("error");if(!code&&!authError){oneDriveCancelAdminReturn();return false;}
 let saved,resume;try{saved=JSON.parse(sessionStorage.getItem(OD_PKCE_KEY)||"null");resume=JSON.parse(sessionStorage.getItem(OD_ADMIN_RETURN_KEY)||"null");}catch{oneDriveCancelAdminReturn();throw new Error("Ungültiger Anmeldestatus");}oneDriveCancelAdminReturn();history.replaceState({},"",location.pathname+location.hash);
 try{
  if(!saved||saved.state!==q.get("state"))throw new Error("Ungültiger Anmeldestatus");
  if(saved.clientId&&(saved.clientId!==odConfig().clientId||saved.share!==(localStorage.getItem(OD_SHARE_KEY)||'')||!Number.isFinite(saved.createdAt)||Date.now()-saved.createdAt>15*60000||saved.createdAt>Date.now()))throw new Error("OneDrive-Anmeldestatus ist abgelaufen oder wurde geändert.");
  if(authError){oneDriveNeedsLogin=true;if(saved.silent){oneDriveLastError='Microsoft benötigt eine Bestätigung. Bitte OneDrive-Anmeldung erneuern wählen.';return false;}throw new Error("Microsoft-Anmeldung wurde nicht abgeschlossen.");}
  const epoch=oneDriveSessionEpoch,c=odConfig(),body=new URLSearchParams({client_id:c.clientId,grant_type:"authorization_code",code,redirect_uri:odRedirect(),code_verifier:saved.verifier,scope:c.scope}),response=await fetch(c.authority+"/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}),data=await response.json();assertOneDriveSession(epoch);if(c.clientId!==odConfig().clientId)throw new Error('OneDrive-Konfiguration wurde während der Anmeldung geändert.');
  if(!response.ok){const error=new Error("OneDrive-Anmeldung fehlgeschlagen.");error.status=response.status;error.code=data.error;throw error;}if(!data.access_token)throw new Error("Microsoft hat keinen gültigen Zugang zurückgegeben.");
  if(saved.identity&&saved.identity!==await odAccountKey(data)){oneDriveNeedsLogin=true;throw new Error('Bitte das bisherige Microsoft-Konto verwenden. Für einen Kontowechsel zuerst als Admin abmelden.');}assertOneDriveSession(epoch);
  data.obtained_at=Date.now();localStorage.setItem(OD_TOKEN_KEY,JSON.stringify(data));oneDriveNeedsLogin=false;oneDriveLastError='';sessionStorage.removeItem(OD_SILENT_RETRY_KEY);
  if(resume?.version===1&&resume.state===saved.state&&Number.isFinite(resume.createdAt)&&resume.createdAt<=Date.now()&&Number.isFinite(resume.validUntil)&&Number.isFinite(resume.adminUntil)&&resume.validUntil>Date.now()&&resume.validUntil<=resume.createdAt+5*60000&&resume.validUntil<=resume.adminUntil&&resume.adminUntil<=Date.now()+15*60000&&resume.clientId===c.clientId&&resume.share===localStorage.getItem(OD_SHARE_KEY)&&resume.identity&&resume.identity===await odAccountKey(data))oneDriveAdminReturn=resume;
  return true;
 }finally{sessionStorage.removeItem(OD_PKCE_KEY);}
}
let oneDriveTokenRefresh=null;
async function oneDriveAccessToken(force=false,rejectedToken=""){
  const token=oneDriveTokens();
  if(!token)throw new Error("Nicht bei OneDrive angemeldet");
  if(force&&rejectedToken&&token.access_token!==rejectedToken)return token.access_token;
  if(oneDriveTokenRefresh)return oneDriveTokenRefresh;
  if(!force&&Date.now()<(token.obtained_at||0)+(Number(token.expires_in||3600)-120)*1000)return token.access_token;
  if(!token.refresh_token){oneDriveNeedsLogin=true;oneDriveAccessConfirmed=false;throw new Error("OneDrive-Anmeldung abgelaufen. Bitte Anmeldung erneuern wählen.");}
  const saved=localStorage.getItem(OD_TOKEN_KEY),epoch=oneDriveSessionEpoch;
  oneDriveTokenRefresh=(async()=>{
    const c=odConfig(),body=new URLSearchParams({client_id:c.clientId,grant_type:"refresh_token",refresh_token:token.refresh_token,scope:c.scope});
    const response=await fetch(c.authority+"/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const data=await response.json();assertOneDriveSession(epoch);
    if(!response.ok){const required=['invalid_grant','interaction_required','login_required','consent_required'].includes(data.error);oneDriveNeedsLogin=required;if(required)oneDriveAccessConfirmed=false;const error=new Error(required?"OneDrive-Anmeldung muss erneuert werden. Bitte Anmeldung erneuern wählen.":"OneDrive-Anmeldung konnte derzeit nicht erneuert werden. Bitte später erneut synchronisieren.");error.status=response.status;error.code=data.error;throw error;}
    if(localStorage.getItem(OD_TOKEN_KEY)!==saved)throw new Error("OneDrive-Anmeldung wurde während des Abrufs geändert. Bitte erneut synchronisieren.");
    if(!data.access_token)throw new Error("Microsoft hat keinen gültigen Zugang zurückgegeben.");
    data.refresh_token=data.refresh_token||token.refresh_token;data.id_token=data.id_token||token.id_token;data.obtained_at=Date.now();
    localStorage.setItem(OD_TOKEN_KEY,JSON.stringify(data));oneDriveNeedsLogin=false;return data.access_token;
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
function odDirectFolderReference(value){
 let url;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=="https:"||url.username||url.password)return null;
 if(url.host==='graph.microsoft.com'){
  const match=url.pathname.match(/^\/v1\.0\/drives\/([^/]+)\/items\/([^/]+)$/);
  if(!match||url.search||url.hash)return null;
  try{const driveId=decodeURIComponent(match[1]),id=decodeURIComponent(match[2]);return /^[A-Za-z0-9!_.-]{1,256}$/.test(driveId)&&/^[A-Za-z0-9!_.-]{1,256}$/.test(id)?{driveId,id}:null;}catch{return null;}
 }
 if(url.host!=="onedrive.live.com")return null;
 const driveId=url.searchParams.get("cid"),id=url.searchParams.get("id")||url.searchParams.get("resid");
 if(!/^[a-f0-9]{16}$/i.test(driveId||"")||!/^[a-f0-9]{16}![a-z0-9-]+$/i.test(id||"")||!id.toLowerCase().startsWith(driveId.toLowerCase()+"!"))return null;
 return {driveId,id};
}
async function oneDriveResolveSharedRoot(){
 const epoch=oneDriveSessionEpoch;if(oneDriveSharedRoot)return oneDriveSharedRoot;
 const share=localStorage.getItem(OD_SHARE_KEY)||"",clientId=odConfig().clientId;if(!share)throw new Error("Kein gemeinsamer OneDrive-Ordner eingerichtet");
 const identity=await odAccountKey(oneDriveTokens()),shareHash=identity?await odChallenge(share):'';
 const assertCurrent=async()=>{assertOneDriveSession(epoch);if(clientId!==odConfig().clientId||share!==(localStorage.getItem(OD_SHARE_KEY)||'')||identity!==await odAccountKey(oneDriveTokens()))throw new Error("OneDrive-Verbindung wurde während des Abrufs geändert.");assertOneDriveSession(epoch);};
 await assertCurrent();
 let target=odDirectFolderReference(share);
 if(!target&&identity){
  let saved;try{saved=JSON.parse(localStorage.getItem(OD_VERIFIED_ROOT_KEY)||'null');}catch{}
  // The saved location is a locator, never an authorization grant. Revalidate it
  // with Microsoft after every restart, even when its original share was revoked.
  if(saved?.version===1&&saved.clientId===clientId&&saved.identity===identity&&saved.shareHash===shareHash&&typeof saved.driveId==='string'&&saved.driveId&&typeof saved.id==='string'&&saved.id)target={driveId:saved.driveId,id:saved.id};
 }
 let item;
 try{
  const url=target?`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(target.driveId)}/items/${encodeURIComponent(target.id)}?$select=id,name,parentReference,folder,remoteItem`:`https://graph.microsoft.com/v1.0/shares/${odShareToken(share)}/driveItem?$select=id,name,parentReference,folder,remoteItem`;
  item=await (await odFetch(url,target?{}:{headers:{Prefer:"redeemSharingLink"}})).json();
 }catch(error){
  await assertCurrent();
  if(error.status===403||error.status===404)throw Object.assign(new Error(target?"Der gespeicherte OneDrive-Ordner ist für dieses Microsoft-Konto nicht erreichbar. Bitte Ordner und Zugriffsrechte prüfen.":"Der gespeicherte OneDrive-Ordnerlink ist nicht mehr gültig oder zugänglich. Bitte unter Verbindung verwalten die aktuelle Ordneradresse eintragen."),{status:error.status,code:target?"oneDriveFolderUnavailable":"oneDriveFolderLinkInvalid"});
  throw error;
 }
 await assertCurrent();
 const resolved=item.remoteItem||item,driveId=resolved.parentReference?.driveId||item.parentReference?.driveId,id=resolved.id||item.id;
 if(!driveId||!id||!resolved.folder)throw new Error("Die OneDrive-Adresse verweist nicht auf einen zugänglichen Ordner");
 if(target){
  const same=(a,b)=>/^[a-f0-9]{16}$/i.test(target.driveId)?String(a).toLowerCase()===String(b).toLowerCase():a===b;
  if(!same(driveId,target.driveId)||!same(id,target.id))throw new Error("OneDrive hat einen anderen Ordner zurückgegeben. Bitte Verbindung prüfen.");
 }
 if(identity)localStorage.setItem(OD_VERIFIED_ROOT_KEY,JSON.stringify({version:1,clientId,identity,shareHash,driveId,id}));
 oneDriveSharedRoot={driveId,id,name:resolved.name||item.name||"Gemeinsamer Ordner"};return oneDriveSharedRoot;
}
// Change the locator only after authenticating the exact same folder again.
// Drive/item IDs remain the financial and portal source identity.
let oneDriveDirectBusy=false;
async function oneDriveUseDirectFolder(){
 if(!requireAdmin('settingsView')||oneDriveDirectBusy)return false;
 const button=byId('oneDriveDirect');oneDriveDirectBusy=true;if(button)button.disabled=true;
 try{
  if(oneDriveBusy||oneDriveAuthorizing)throw new Error('Bitte die laufende Synchronisierung oder Anmeldung abwarten.');
  const epoch=oneDriveSessionEpoch,clientId=odConfig().clientId,share=localStorage.getItem(OD_SHARE_KEY)||'',identity=await odAccountKey(oneDriveTokens());
  if((byId('oneDriveClientId')&&byId('oneDriveClientId').value.trim()!==clientId)||(byId('oneDriveShareUrl')&&byId('oneDriveShareUrl').value.trim()!==share))throw new Error('Die Einrichtung enthält ungespeicherte Änderungen. Bitte zuerst die gewünschte Verbindung speichern oder das Fenster neu öffnen.');
  if(!identity||!oneDriveAdministrationReady())throw new Error('Bitte OneDrive verbinden und die Verwaltung entsperren.');
  const current=async()=>{
   const account=oneDriveTokens(),key=await odAccountKey(account);assertOneDriveSession(epoch);
   if(!requireAdmin('settingsView')||!oneDriveAdministrationReady()||oneDriveAuthorizing||clientId!==odConfig().clientId||share!==(localStorage.getItem(OD_SHARE_KEY)||'')||identity!==key||account?.id_token!==oneDriveTokens()?.id_token)throw new Error('Die Verbindung wurde geändert. Bitte erneut prüfen.');
  };
  const root=await oneDriveResolveSharedRoot();await current();
  const address=/^[a-f0-9]{16}$/i.test(root.driveId)?'https://onedrive.live.com/?cid='+encodeURIComponent(root.driveId)+'&id='+encodeURIComponent(root.id):odItemBase(root);
  const target=odDirectFolderReference(address);if(!target||target.driveId!==root.driveId||target.id!==root.id)throw new Error('Die Ordneradresse konnte nicht sicher übernommen werden.');
  const item=await(await odFetch(odItemBase(root)+'?$select=id,name,parentReference,folder')).json();await current();
  if(!item.folder||item.id!==root.id||item.parentReference?.driveId!==root.driveId)throw new Error('Microsoft hat einen anderen Ordner zurückgegeben. Die Verbindung bleibt unverändert.');
  const state=await(await odFetch(odItemBase(root)+':/'+encodeURIComponent(OD_STATE_FILE)+'?$select=id,file')).json();await current();
  if(!state.id||!state.file)throw new Error('Die vorhandene App-Datendatei wurde im Ordner nicht bestätigt.');
  const shareHash=await odChallenge(address);await current();
  const draftStore=typeof safeStorage==='undefined'?localStorage:safeStorage,draftKey='fw_v1_attendance_draft',draftRaw=draftStore.getItem(draftKey),oldVerified=localStorage.getItem(OD_VERIFIED_ROOT_KEY);
  const oldScope=JSON.stringify([clientId,share]),newScope=JSON.stringify([clientId,address]);let draft=null;
  if(draftRaw){draft=JSON.parse(draftRaw);if(draft?.version!==1||draft.source!==oldScope)draft=null;}
  try{
   if(draft)draftStore.setItem(draftKey,JSON.stringify({...draft,source:newScope}));
   localStorage.setItem(OD_VERIFIED_ROOT_KEY,JSON.stringify({version:1,clientId,identity,shareHash,driveId:root.driveId,id:root.id}));
   localStorage.setItem(OD_SHARE_KEY,address);
  }catch(error){
   try{if(draft&&draftRaw)draftStore.setItem(draftKey,draftRaw);if(oldVerified===null)localStorage.removeItem(OD_VERIFIED_ROOT_KEY);else localStorage.setItem(OD_VERIFIED_ROOT_KEY,oldVerified);localStorage.setItem(OD_SHARE_KEY,share);}catch{}
   throw new Error('Die neue Ordneradresse konnte nicht gespeichert werden. Bitte die Verbindung prüfen.');
  }
  if(typeof attendanceDraftScope!=='undefined'&&attendanceDraftScope===oldScope){attendanceDraftScope=newScope;attendanceDraftSignature='';}
  oneDriveCancelAdminReturn();renderOneDriveDialog();
  showToast('Direkter Ordnerzugriff geprüft und auf diesem Gerät eingerichtet. Den bisherigen Freigabelink erst nach dem Test aller Geräte und berechtigten Konten in OneDrive entfernen.','success');return true;
 }catch(error){showToast(error.message||'Direkter Ordnerzugriff konnte nicht bestätigt werden.','error');return false;}
 finally{oneDriveDirectBusy=false;if(button)button.disabled=false;if(oneDriveResyncRequested){oneDriveResyncRequested=false;syncOneDrive();}}
}
const odItemBase=(root=oneDriveSharedRoot)=>`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(root.id)}`;
function oneDrivePayload(){return {schemaVersion:3,updatedAt:new Date().toISOString(),members,entries,csvArchive,roleTargets:typeof getRoleTargets==="function"?getRoleTargets():{},functionEntryEnabled:typeof isFunctionEntryEnabled==="function"?isFunctionEntryEnabled():true};}
function applyOneDrivePayload(data){if(!data||!Array.isArray(data.members)||!Array.isArray(data.entries))throw new Error("OneDrive-Datendatei ist ungültig");oneDriveApplying=true;members=data.members;entries=data.entries;const importedRoleTargets=data.roleTargets||{};const importedFunctionEntryEnabled=data.functionEntryEnabled!==false;safeStorage.setItem(KEYS.members,JSON.stringify(members));safeStorage.setItem(KEYS.entries,JSON.stringify(entries));safeStorage.removeItem?.(KEYS.archive);if(typeof saveRoleTargets==="function")saveRoleTargets(importedRoleTargets);else safeStorage.setItem(KEYS.roleTargets,JSON.stringify(importedRoleTargets));safeStorage.setItem(KEYS.functionEntry,String(importedFunctionEntryEnabled));oneDriveApplying=false;if(typeof renderMembers==="function")renderMembers();if(typeof renderToday==="function")renderToday();if(typeof renderAdmin==="function")renderAdmin();if(typeof renderStatistics==="function")renderStatistics();}
// Resolve protected website files in the shared drive, never the caller's /me/drive.
async function oneDriveWebsiteFile(relativePath,label){
 if(!oneDriveAdministrationReady())throw new Error('Bitte zuerst OneDrive verbinden.');
 const epoch=oneDriveSessionEpoch,share=localStorage.getItem(OD_SHARE_KEY)||'',clientId=odConfig().clientId;
 const root=await oneDriveResolveSharedRoot();
 const assertCurrent=()=>{assertOneDriveSession(epoch);if(!oneDriveAdministrationReady()||oneDriveSharedRoot!==root||share!==(localStorage.getItem(OD_SHARE_KEY)||'')||clientId!==odConfig().clientId)throw new Error('OneDrive-Verbindung wurde geändert. Bitte erneut öffnen.');};
 assertCurrent();
 const name=root.name.trim().toLocaleLowerCase('de-DE'),segments=relativePath.split('/');
 let base=odItemBase(root),path=segments;
 if(name==='feuerwehr share')path=['Webseite',...segments];
 else if(name!=='webseite'){
  // Existing app-data folders can be elsewhere in the same shared drive/library.
  // Preserve the established website location, but bind it to the verified drive.
  base=`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/root`;
  path=['Feuerwehr Share','Webseite',...segments];
 }
 try{
  const response=await odFetch(base+':/'+path.map(encodeURIComponent).join('/')+':/content');assertCurrent();return {response,assertCurrent};
 }catch(error){
  assertCurrent();
  if(error.status===404)throw Object.assign(new Error(label+' wurde in der gemeinsamen Ablage nicht gefunden. Bitte Datei unter Feuerwehr Share/Webseite/'+relativePath+' und die Zugriffsrechte dieses Microsoft-Kontos prüfen.'),{status:404,code:'oneDriveWebsiteFileMissing'});
  if(error.status===403)throw Object.assign(new Error(label+' kann mit diesem Microsoft-Konto nicht gelesen werden. Bitte die Zugriffsrechte in der gemeinsamen Ablage prüfen.'),{status:403,code:'oneDriveWebsiteFileForbidden'});
  throw error;
 }
}
async function oneDriveReadContacts(){
 const {response,assertCurrent}=await oneDriveWebsiteFile('Feuerwehr-Kontakte-Privat/feuerwehr-emmendingen-kontakte.json','Das Kontaktverzeichnis');
 const contacts=await response.json();assertCurrent();
 if(contacts?.schemaVersion!==1||!Array.isArray(contacts.groups))throw new Error('Kontaktverzeichnis hat ein ungültiges Format.');
 return contacts;
}
window.oneDriveReadContacts=oneDriveReadContacts;
async function oneDriveReadHydrants(){
 const {response,assertCurrent}=await oneDriveWebsiteFile('Hydrantenplan/Hydrantenplan-Wasser.pdf','Der Hydrantenplan');
 if(Number(response.headers.get('content-length'))>8*1024*1024)throw new Error('Der Plan darf höchstens 8 MB groß sein.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();assertCurrent();if(done)break;size+=value.byteLength;if(size>8*1024*1024)throw new Error('Der Plan darf höchstens 8 MB groß sein.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 assertCurrent();const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Die OneDrive-Datei ist keine PDF.');
 return bytes;
}
window.oneDriveReadHydrants=oneDriveReadHydrants;
async function oneDriveReadState({versioned=false}={}){
  const epoch=oneDriveSessionEpoch,root=await oneDriveResolveSharedRoot(),path=`${odItemBase(root)}:/${encodeURIComponent(OD_STATE_FILE)}`;
  if(!versioned){const data=await (await odFetch(path+":/content")).json();assertOneDriveSession(epoch);return data;}
  const metadata=await (await odFetch(path+"?$select=id,eTag")).json();
  if(!metadata.id||!metadata.eTag)throw new Error("Die OneDrive-Dateiversion konnte nicht geprüft werden.");
  const url=`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(metadata.id)}`;
  const data=await (await odFetch(url+"/content",{headers:{"If-Match":metadata.eTag}})).json();
  const after=await (await odFetch(url+"?$select=id,eTag")).json();assertOneDriveSession(epoch);
  if(after.eTag!==metadata.eTag)throw Object.assign(new Error("Die OneDrive-Daten wurden gleichzeitig geändert. Bitte erneut synchronisieren."),{status:412});
  return {data,eTag:metadata.eTag,url};
}
async function oneDriveWriteState(expected){
  const epoch=oneDriveSessionEpoch,root=await oneDriveResolveSharedRoot();assertOneDriveSession(epoch);
  // Never retry an uncertain write automatically. A new sync reads the remote state first.
  const data=JSON.stringify(oneDrivePayload()),url=expected?.url||`${odItemBase(root)}:/${encodeURIComponent(OD_STATE_FILE)}:`;
  await odFetch(url+"/content",{method:"PUT",headers:{"Content-Type":"application/json","If-Match":expected?.eTag||'"0"'},body:data},false);
  assertOneDriveSession(epoch);localStorage.setItem("fw_onedrive_last_sync",new Date().toISOString());
  return JSON.parse(data).updatedAt;
}

async function odEnsureFolder(parentId,name){const root=await oneDriveResolveSharedRoot(),list=await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(parentId)}/children?$select=id,name,folder`),data=await list.json(),existing=(data.value||[]).find(x=>x.folder&&x.name===name);if(existing)return existing.id;const response=await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(parentId)}/children`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,folder:{},"@microsoft.graph.conflictBehavior":"fail"})});return (await response.json()).id;}
async function syncOneDrive({manual=false,refreshHistory=manual}={}){
  if(!oneDriveSignedIn()||!navigator.onLine){notifyAppStorageState();return;}
  if(oneDriveBusy||oneDriveDirectBusy){oneDriveResyncRequested=true;return;}
  const epoch=oneDriveSessionEpoch;const startRevision=oneDriveLocalRevision;oneDriveBusy=true;notifyAppStorageState();oneDriveStatus("Synchronisiert","syncing");
  try{
    let stateError=null;
    try{
      let remote=null,expected=null;
      try{expected=await oneDriveReadState({versioned:true});remote=expected?.data||null;}catch(error){if(!String(error.message).includes("itemNotFound"))throw error;}
      assertOneDriveSession(epoch);const localUpdated=localStorage.getItem("fw_onedrive_local_updated")||"",lastSync=localStorage.getItem("fw_onedrive_last_sync")||"";
      let dirty=localStorage.getItem("fw_onedrive_state_dirty")==="1"||(oneDriveLocalRevision>0&&oneDriveLocalRevision!==oneDriveSyncedRevision)||localUpdated>lastSync;
      // If a PUT succeeded but its response was lost, identical remote content
      // confirms that exact state instead of issuing another write or losing edits.
      if(remote&&dirty){const local=oneDrivePayload();if(['schemaVersion','members','entries','roleTargets','functionEntryEnabled'].every(key=>JSON.stringify(remote[key])===JSON.stringify(local[key])))dirty=false;}
      const root=await oneDriveResolveSharedRoot(),source=root.driveId+":"+root.id;
      let baseline=null;try{baseline=JSON.parse(localStorage.getItem("fw_onedrive_state_base")||"null");}catch{}
      if(remote&&dirty&&baseline?.source===source&&remote.updatedAt!==baseline.updatedAt)throw new Error("OneDrive und lokale Daten wurden geändert. Die lokalen Daten bleiben erhalten; bitte den Datenkonflikt prüfen.");
      if(remote&&(!dirty||remote.updatedAt>localUpdated)&&oneDriveLocalRevision===startRevision){
        if(dirty)throw new Error("Lokale Änderungen und ein neuerer OneDrive-Stand liegen vor. Die lokalen Daten bleiben erhalten; bitte den Datenkonflikt vor dem Abgleich prüfen.");
        applyOneDrivePayload(remote);oneDriveSyncedRevision=oneDriveLocalRevision;localStorage.setItem("fw_onedrive_state_dirty","0");
        localStorage.setItem("fw_onedrive_local_updated",remote.updatedAt);localStorage.setItem("fw_onedrive_last_sync",new Date().toISOString());
        localStorage.setItem("fw_onedrive_state_base",JSON.stringify({source,updatedAt:remote.updatedAt}));
      }else {const writeRevision=oneDriveLocalRevision;const updatedAt=await oneDriveWriteState(expected);oneDriveSyncedRevision=writeRevision;if(writeRevision===oneDriveLocalRevision)localStorage.setItem("fw_onedrive_state_dirty","0");localStorage.setItem("fw_onedrive_state_base",JSON.stringify({source,updatedAt}));}
      assertOneDriveSession(epoch);window.Drinks?.preload?.();oneDriveAccessConfirmed=true;oneDriveStateConfirmed=oneDriveSyncedRevision===oneDriveLocalRevision;notifyAppStorageState();
    }catch(error){if(epoch!==oneDriveSessionEpoch)return;oneDriveAccessConfirmed=false;oneDriveStateConfirmed=false;stateError=error;notifyAppStorageState();}
    // ZIP-Berichte liefern die Statistik, unabhängig davon, welche Ansicht offen ist.
    // Auch bei einer fehlerhaften Datendatei versuchen, die Berichte zu laden.
    if(refreshHistory&&typeof window.loadOneDriveHistory==="function"){
      oneDriveStatus("Lädt Historie","syncing");
      if(await window.loadOneDriveHistory()===false)throw new Error(window.oneDriveHistoryLastError||"OneDrive-Historie konnte nicht aktualisiert werden.");
    }
    if(stateError)throw stateError;
    assertOneDriveSession(epoch);if(refreshHistory&&oneDriveStateConfirmed)oneDriveStartupConfirmed=true;oneDriveLastError="";oneDriveLastFailure=null;oneDriveStatus(oneDriveStateConfirmed?"Aktuell":"Änderungen ausstehend",oneDriveStateConfirmed?"online":"syncing");
    if(manual)showToast(oneDriveStateConfirmed?"Daten und Historie im gemeinsamen OneDrive-Ordner wurden synchronisiert.":"Neue Änderungen werden noch mit OneDrive synchronisiert.");
  }catch(error){
    if(epoch!==oneDriveSessionEpoch)return;
    console.error(error);oneDriveLastFailure=error;oneDriveLastError=String(error.message||error);oneDriveStatus(oneDriveNeedsLogin?"Anmeldung bestätigen":"Fehler","error");
    const detail=byId("oneDriveDetail");if(detail)detail.textContent=`Fehler: ${oneDriveLastError}`;
    if(manual)showToast("OneDrive-Synchronisierung fehlgeschlagen. Details stehen im OneDrive-Fenster.","error");
  }finally{
    oneDriveBusy=false;renderOneDriveDialog();notifyAppStorageState();
    const again=oneDriveResyncRequested||(oneDriveLocalRevision>startRevision&&oneDriveLocalRevision!==oneDriveSyncedRevision);oneDriveResyncRequested=false;
    if(again&&epoch===oneDriveSessionEpoch&&oneDriveSignedIn()&&!oneDriveNeedsLogin){clearTimeout(oneDriveTimer);oneDriveTimer=setTimeout(()=>syncOneDrive(),oneDriveLastError?5000:900);}
  }
}
function scheduleCloudSync(){if(oneDriveApplying)return;oneDriveLocalRevision++;localStorage.setItem("fw_onedrive_state_dirty","1");oneDriveStateConfirmed=false;localStorage.setItem("fw_onedrive_local_updated",new Date().toISOString());notifyAppStorageState();if(!oneDriveSignedIn())return;clearTimeout(oneDriveTimer);oneDriveTimer=setTimeout(()=>syncOneDrive(),900);}
async function oneDriveUploadTerminPackage(blob,fileName){
 if(!oneDriveAdministrationReady())throw new Error("Bitte zuerst OneDrive verbinden.");
 if(!(blob instanceof Blob)||!blob.size||!/^FFW-Wasser_[^\\/:*?"<>|]+\.zip$/i.test(fileName))throw new Error("Ungültiges Terminpaket.");
 const epoch=oneDriveSessionEpoch,share=localStorage.getItem(OD_SHARE_KEY)||'',clientId=odConfig().clientId;
 const current=()=>{assertOneDriveSession(epoch);if(share!==(localStorage.getItem(OD_SHARE_KEY)||'')||clientId!==odConfig().clientId||!oneDriveAdministrationReady())throw new Error("OneDrive-Verbindung wurde geändert. Die Eingaben bleiben erhalten.");};
 let stage="Datenordner prüfen";
 try{
 const root=await oneDriveResolveSharedRoot();current();
 stage="Berichtsordner prüfen";const reportsId=await odEnsureFolder(root.id,"Berichte");current();
 stage="Terminordner prüfen";const folderId=await odEnsureFolder(reportsId,"Terminpakete");current();
 // The documented minimal upload-session body needs only the conflict rule;
 // the URL already supplies the name. Never replace an existing report.
 stage="Dateiübertragung vorbereiten";
 const response=await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/createUploadSession`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({item:{"@microsoft.graph.conflictBehavior":"fail"}})});
 const session=await response.json();current();
 const upload=new URL(session.uploadUrl);if(upload.protocol!=="https:"||upload.username||upload.password)throw new Error("Ungültige OneDrive-Uploadadresse.");
 stage="Terminpaket übertragen";
 const chunkSize=10*1024*1024;let item=null;
 for(let start=0;start<blob.size;start+=chunkSize){
  current();const end=Math.min(start+chunkSize,blob.size),controller=new AbortController();oneDriveRequests.add(controller);
  try{
   // Upload URLs are pre-authorized by Microsoft; never attach the bearer token.
   const part=await fetch(upload.href,{method:"PUT",redirect:"error",signal:controller.signal,headers:{"Content-Type":"application/octet-stream","Content-Range":`bytes ${start}-${end-1}/${blob.size}`},body:blob.slice(start,end)});current();
   if(!part.ok)throw new Error(part.status===409?"Ein Terminpaket mit diesem Namen ist bereits vorhanden. Bitte die Historie prüfen.":"OneDrive konnte das Terminpaket nicht bestätigen. Bitte die Historie prüfen und erneut versuchen.");
   if(end===blob.size){if(part.status!==200&&part.status!==201)throw new Error("OneDrive hat die Speicherung noch nicht bestätigt.");item=await part.json();}
   else if(part.status!==202)throw new Error("OneDrive hat den Upload nicht fortgesetzt.");
  }finally{oneDriveRequests.delete(controller);}
 }
 current();if(!item?.id||!item.file||item.name!==fileName||item.size!==blob.size)throw new Error("Die gespeicherte OneDrive-Datei konnte nicht bestätigt werden. Bitte die Historie prüfen.");
 return item;
 }catch(error){
  if(Number.isInteger(error?.status))throw Object.assign(new Error(stage+": "+error.message),{status:error.status,code:error.code||"",stage});
  throw error;
 }
}
async function oneDriveUploadReport(blob,fileName){const root=await oneDriveResolveSharedRoot(),reportsId=await odEnsureFolder(root.id,"Berichte"),folderName=String(fileName||"").toLowerCase().endsWith(".pdf")?"PDF":"CSV",folderId=await odEnsureFolder(reportsId,folderName),safe=String(fileName||`Bericht-${Date.now()}`).replace(/[\\/:*?"<>|]/g,"-");await odFetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(safe)}:/content`,{method:"PUT",headers:{"Content-Type":blob.type||"application/octet-stream"},body:blob});showToast(`${safe} wurde im gemeinsamen OneDrive-Ordner gespeichert.`);}
function ensureOneDriveUi(){if(byId("cloudSyncButton"))return;const button=document.createElement("button");button.id="cloudSyncButton";button.className="cloud-sync-button";button.type="button";button.innerHTML='<span class="cloud-sync-icon" aria-hidden="true">☁</span><span class="cloud-sync-copy" role="status" aria-live="polite" aria-atomic="true"><b id="cloudSyncLabel">OneDrive</b><small id="cloudSyncState">Einrichten</small></span>';(byId("appConnectionStatus")||document.querySelector(".top-nav")||document.body).appendChild(button);const dialog=document.createElement("dialog");dialog.id="cloudSyncDialog";dialog.className="cloud-sync-dialog";dialog.innerHTML='<div class="cloud-sync-shell"><header><div><small>Gemeinsame Datenablage</small><h2>OneDrive-Synchronisierung</h2></div><button type="button" id="cloudSyncClose" aria-label="OneDrive-Status schließen" class="cloud-sync-close">×</button></header><div class="cloud-sync-body"><p id="oneDriveDetail" role="status"></p><button type="button" class="outline-button" id="oneDriveManage">Verbindung verwalten</button><label>Microsoft Entra Client-ID<input id="oneDriveClientId" class="text-input" autocomplete="off"></label><label>Adresse des gemeinsamen OneDrive-Ordners<input id="oneDriveShareUrl" class="text-input" type="url" inputmode="url" autocomplete="off" placeholder="Ordneradresse oder Freigabelink hier einfügen"></label><p class="cloud-sync-help">Die Ordneradresse bleibt auf diesem Gerät. Das angemeldete Microsoft-Konto benötigt Bearbeitungszugriff. Eine öffentliche Freigabe ist nicht erforderlich.</p><button type="button" class="outline-button" id="oneDriveDirect">Direkten Ordnerzugriff einrichten</button><p id="oneDriveDirectStatus" class="cloud-sync-help" role="status"></p><div class="cloud-sync-actions"><button type="button" class="primary-button" id="oneDriveLogin">Einstellungen speichern und mit Microsoft anmelden</button><button type="button" class="primary-button" id="oneDriveNow">Erneut laden</button><button type="button" class="danger-button" id="oneDriveLogout">Abmelden</button></div></div></div>';document.body.appendChild(dialog);button.onclick=()=>{renderOneDriveDialog();dialog.showModal();};byId("cloudSyncClose").onclick=()=>dialog.close();byId("oneDriveManage").onclick=()=>{if(!oneDriveStartupConfirmed)dialog.close();if(requireAdmin("settingsView",{allowDisconnected:true})){renderOneDriveDialog();if(!dialog.open)dialog.showModal();}};byId("oneDriveDirect").onclick=oneDriveUseDirectFolder;byId("oneDriveLogin").onclick=oneDriveLogin;byId("oneDriveNow").onclick=()=>syncOneDrive({manual:true,refreshHistory:true});byId("oneDriveLogout").onclick=()=>{if(!requireAdmin("settingsView",{allowDisconnected:true}))return;window.AppPrivacy.logout();};}
function renderOneDriveDialog(){const signed=oneDriveSignedIn(),client=byId("oneDriveClientId"),share=byId("oneDriveShareUrl"),detail=byId("oneDriveDetail");if(client){client.closest("label").hidden=!adminUnlocked;client.readOnly=!adminUnlocked;client.value=localStorage.getItem(OD_CLIENT_KEY)||"";}if(share){share.closest("label").hidden=!adminUnlocked;share.readOnly=!adminUnlocked;share.value=localStorage.getItem(OD_SHARE_KEY)||"";}if(detail)detail.textContent=oneDriveNeedsLogin?"Microsoft benötigt eine Bestätigung. Anmeldung erneuern verbindet das bisherige Konto; dafür ist kein zusätzliches Admin-Passwort nötig.":oneDriveLastError?`Fehler: ${oneDriveLastError}`:(signed?"Auf diesem Gerät angemeldet. Die Verbindung wird automatisch erneuert. App-Daten werden mit OneDrive synchronisiert und zusätzlich auf diesem Gerät gespeichert. Bei aktiver zentraler Kontenführung liegen Getränkekonten im geschützten Kontodienst (Cloudflare/D1); OneDrive enthält die Verbindung und gesonderte Sicherungen. Ohne zentrale Kontenführung werden die Konten mit OneDrive synchronisiert.":"Nicht verbunden. Die Verwaltung kann OneDrive hier einrichten.");for(const id of ["oneDriveNow","oneDriveLogout"])if(byId(id))byId(id).hidden=!signed;if(byId("oneDriveLogin"))byId("oneDriveLogin").hidden=signed&&!oneDriveNeedsLogin&&!adminUnlocked;if(byId("oneDriveLogin"))byId("oneDriveLogin").textContent=signed&&!adminUnlocked?"OneDrive-Anmeldung erneuern":"Einstellungen speichern und mit Microsoft anmelden";if(byId("oneDriveLogout"))byId("oneDriveLogout").hidden=!signed||!adminUnlocked;if(byId("oneDriveManage"))byId("oneDriveManage").hidden=adminUnlocked;const direct=Boolean(odDirectFolderReference(localStorage.getItem(OD_SHARE_KEY)||'')),directButton=byId('oneDriveDirect'),directStatus=byId('oneDriveDirectStatus');if(directButton){directButton.hidden=!signed||!adminUnlocked;directButton.disabled=oneDriveDirectBusy;directButton.textContent=direct?'Direkten Ordnerzugriff prüfen':'Direkten Ordnerzugriff einrichten';}if(directStatus){directStatus.hidden=!adminUnlocked;directStatus.textContent=direct?'Dieses Gerät verwendet die private Ordneradresse. Zugriff erhält nur ein entsprechend berechtigtes Microsoft-Konto. Bestehende Freigabelinks werden dadurch nicht gelöscht.':'Nach der Prüfung kann dieses Gerät ohne Freigabelink auf denselben Ordner zugreifen. Auf allen Verwaltungsgeräten einrichten und mit allen berechtigten Konten testen, bevor der bisherige Link in OneDrive entfernt wird.';}const help=document.querySelector(".cloud-sync-help");if(help)help.hidden=!adminUnlocked;const last=localStorage.getItem("fw_onedrive_last_sync");if(detail&&last)detail.textContent+=" · Letzte App-Synchronisierung: "+new Date(last).toLocaleString("de-DE");}
async function initCloudSync(){
 if(window.AppRelease&&await window.AppRelease.ready)return;
 oneDriveStartupChecking=true;updateOneDriveStartup();ensureOneDriveUi();const callback=new URLSearchParams(location.search).has('code')||new URLSearchParams(location.search).has('error'),startupEpoch=oneDriveSessionEpoch;
 let untouched=true;const touched=()=>{untouched=false;};
 addEventListener('pointerdown',touched,{capture:true,once:true});addEventListener('keydown',touched,{capture:true,once:true});
 // Reconnection events are available even if the first authorization redirects.
 addEventListener("online",()=>syncOneDrive({refreshHistory:true}));document.addEventListener("visibilitychange",()=>{if(!document.hidden)return syncOneDrive({refreshHistory:true});});
 const canNavigate=()=>untouched&&!document.hidden&&navigator.onLine!==false&&startupEpoch===oneDriveSessionEpoch;
 const recover=async()=>{
  const last=Number(sessionStorage.getItem(OD_SILENT_RETRY_KEY)||0);
  if(callback||!oneDriveNeedsLogin||!canNavigate()||Date.now()-last<=10*60000)return false;
  try{return await odStartAuthorization(true,{clientId:odConfig().clientId,share:localStorage.getItem(OD_SHARE_KEY)||''},canNavigate);}catch(error){console.warn('Automatische OneDrive-Verbindung nicht möglich',error);return false;}
 };
 try{
  try{await oneDriveHandleCallback();}catch(error){console.error(error);oneDriveLastError=String(error.message||error);showToast(oneDriveLastError,"error");}
  renderOneDriveDialog();
  if(!oneDriveSignedIn()){oneDriveStatus("Einrichten","offline");return;}
  if(navigator.onLine===false){oneDriveStatus("Offline","offline");return;}
  oneDriveStatus("Verbindet","syncing");
  if(!callback){try{await oneDriveAccessToken();}catch(error){if(oneDriveNeedsLogin&&await recover())return;}}
  if(!oneDriveNeedsLogin){
   await syncOneDrive({refreshHistory:true});
   // A cached token may only be rejected by Graph during the actual sync.
   // Retry a temporary startup failure once, reading remote versions before any write.
   const failure=oneDriveLastFailure,temporary=failure&&(failure.name==='TypeError'||['TimeoutError','AbortError'].includes(failure.name)||[429,502,503,504].includes(failure.status));
   if(temporary&&!oneDriveNeedsLogin&&canNavigate()){
    await new Promise(resolve=>setTimeout(resolve,1200));
    if(canNavigate()&&oneDriveSignedIn())await syncOneDrive({refreshHistory:true});
   }
   if(oneDriveNeedsLogin&&await recover())return;
   restoreOneDriveAdminReturn();
  }
  if(oneDriveNeedsLogin){oneDriveAccessConfirmed=false;oneDriveStatus("Anmeldung bestätigen","error");}
  renderOneDriveDialog();
 }finally{untouched=false;oneDriveStartupChecking=false;updateOneDriveStartup();}
}


async function oneDriveConvertDocxToPdf(docxBlob,fileName){if(!oneDriveSignedIn())throw new Error("Für die Word-zu-PDF-Konvertierung bitte zuerst OneDrive verbinden.");const safe=("FFW-Wasser-Temp-"+Date.now()+".docx").replace(/[^A-Za-z0-9._-]/g,"-");let item=null;try{const upload=await odFetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(safe)}:/content`,{method:"PUT",headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},body:docxBlob});item=await upload.json();let response;try{response=await odFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}/content?format=pdf`);}catch(error){throw new Error("Die Word-Datei wurde erstellt, aber OneDrive konnte die PDF-Konvertierung nicht laden. Bitte OneDrive in der App einmal ab- und wieder anmelden.");}const blob=await response.blob();if(!blob.size)throw new Error("OneDrive hat eine leere PDF zurückgegeben.");return blob;}catch(error){if(error instanceof TypeError||/Failed to fetch/i.test(String(error?.message||error)))throw new Error("OneDrive ist derzeit nicht erreichbar. Bitte Internetverbindung prüfen und OneDrive in der App neu verbinden.");throw error;}finally{if(item?.id)odFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}`,{method:"DELETE"}).catch(()=>{});}}

globalThis.oneDriveConvertDocxToPdf=oneDriveConvertDocxToPdf;

