/* Explicit opt-in: prepare resources first, subscribe directly from the click. */
(function(g){
 'use strict';
 let access=null,busy=false,preparing=false,prepared=null,pushConfigured=false,pushActive=false,otherAccount=false,deviceLimit=false,prepareFailed=false,phase='',generation=0;
 const $=id=>document.getElementById('portal-push-'+id);
 const native=()=>/\bH2ONative\/1\b/.test(navigator.userAgent);
 const supported=()=>!native()&&Boolean(navigator.serviceWorker&&g.PushManager&&g.Notification);
 const same=(a,b)=>Boolean(a&&b&&a.alias===b.alias&&a.revision===b.revision&&a.origin===b.origin&&a.capability===b.capability);
 const current=(c,version)=>{if(version!==generation||!same(c,access))throw Error('Der Portalzugang wurde geändert. Bitte erneut anmelden.');};
 const isIos=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const installed=()=>navigator.standalone||g.matchMedia?.('(display-mode: standalone)').matches;
 let nativeToken='',nativeReady=false,nativeActive=false,nativePermission='default';
 const nativeConsentKey=()=>access?'h2o-native-push-opt-in:'+access.alias:'';
 function nativeConsent(value){try{const key=nativeConsentKey();if(!key)return false;if(value===true)localStorage.setItem(key,'yes');else if(value===false)localStorage.removeItem(key);return localStorage.getItem(key)==='yes';}catch{return false;}}
 function nativeRequest(action){return new Promise((resolve,reject)=>{
  const bridge=g.webkit?.messageHandlers?.h2oNotifications;if(!bridge){reject(Error('Bitte die aktuelle iPhone-App installieren.'));return;}
  const id=crypto.randomUUID(),done=event=>{if(event.detail?.id!==id)return;clearTimeout(timer);g.removeEventListener('h2o-native-notifications',done);resolve(event.detail);};
  const timer=setTimeout(()=>{g.removeEventListener('h2o-native-notifications',done);reject(Error('Apple-Mitteilungen konnten noch nicht bestätigt werden. Bitte erneut prüfen.'));},20000);
  g.addEventListener('h2o-native-notifications',done);bridge.postMessage({id,action});
 });}
 function nativeButtons(){
  if(!g.webkit?.messageHandlers?.h2oNotifications){
   $('enable').hidden=$('disable').hidden=$('reset').hidden=true;
   state($('state'),'Bitte App aktualisieren');
   $('note').textContent='Diese TestFlight-Version unterstützt keine nativen Mitteilungen. Bitte die aktuelle iPhone-App verwenden.';return;
  }
  $('enable').hidden=nativeActive;$('disable').hidden=!nativeActive;$('reset').hidden=true;
  $('enable').disabled=busy||!access||!nativeReady;$('disable').disabled=busy;
  $('enable').textContent='Mitteilungen erlauben';
  state($('state'),busy?'Wird geprüft':nativeActive?'Aktiv':nativePermission==='denied'?'Nicht erlaubt':nativeReady?'Aus':'Noch nicht eingerichtet',nativeActive);
  $('note').textContent=!nativeReady?'Der Apple-Mitteilungsdienst muss von der Verwaltung noch eingerichtet werden.':nativePermission==='denied'?'Mitteilungen in den iPhone-Einstellungen für H₂O erlauben.':'Freiwillig: Feuerwehr-Mitteilungen direkt auf diesem iPhone. Du kannst H₂O auch ohne Mitteilungen nutzen.';
 }
 async function nativeRender(){
  const version=generation;busy=true;nativeButtons();try{
   const result=await g.H2OPortal.api('native-push',{action:'status',...(nativeToken?{deviceToken:nativeToken}:{})});
   if(version!==generation)return;nativeReady=result.ready===true;nativeActive=result.registered===true;
   if(nativeReady){const device=await nativeRequest('status');if(version!==generation)return;nativePermission=device.permission;if(device.deviceToken){nativeToken=device.deviceToken;const saved=await g.H2OPortal.api('native-push',{action:nativeConsent()&&device.permission==='granted'?'subscribe':'status',deviceToken:nativeToken});if(version!==generation)return;nativeActive=saved.registered===true;}}
   $('status').textContent='';
  }catch(error){if(version===generation){nativeReady=false;nativeActive=false;$('status').textContent=error.message;}}
  finally{if(version===generation){busy=false;nativeButtons();}}
 }
 async function nativeEnable(){
  if(busy||!access||!nativeReady)return;const version=generation;busy=true;nativeButtons();
  try{const device=await nativeRequest('request');if(version!==generation)return;nativePermission=device.permission;
   if(device.permission!=='granted'||!device.deviceToken)throw Error(device.permission==='denied'?'Mitteilungen wurden nicht erlaubt. Du kannst das später in den iPhone-Einstellungen ändern.':'Das iPhone konnte sich noch nicht für Mitteilungen registrieren.');
   nativeToken=device.deviceToken;const saved=await g.H2OPortal.api('native-push',{action:'subscribe',deviceToken:nativeToken});if(version!==generation)return;
   if(!saved.registered)throw Error('Apple-Mitteilungen wurden vom Dienst noch nicht bestätigt.');nativeConsent(true);nativeActive=true;$('status').textContent='Mitteilungen auf diesem iPhone aktiviert.';
  }catch(error){if(version===generation)$('status').textContent=error.message;}finally{if(version===generation){busy=false;nativeButtons();}}
 }
 async function nativeDisable(){
  const version=generation;
  nativeConsent(false);
  if(nativeToken&&access)await g.H2OPortal.api('native-push',{action:'unsubscribe',deviceToken:nativeToken});
  if(version!==generation)return;nativeActive=false;if($('status'))$('status').textContent='Mitteilungen für dieses Mitglied deaktiviert.';nativeButtons();
 }
 function timeout(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
 async function markRead(){if(document.hidden)return;try{await navigator.clearAppBadge?.();}catch{}try{const reg=await navigator.serviceWorker?.getRegistration();for(const tag of ['deckel-reminder','h2o-portal-reminder'])for(const note of await reg?.getNotifications?.({tag})||[])note.close();}catch{}}
 function state(element,text,active=false){element.textContent=text;element.setAttribute('data-active',String(active));}
 function buttons(){
  if(!$('enable'))return;
  if(native()){nativeButtons();return;}
  const available=supported(),blocked=available&&Notification.permission==='denied',showDisable=pushActive||otherAccount||pushConfigured&&blocked;
  $('enable').hidden=showDisable||deviceLimit;$('disable').hidden=!showDisable;$('reset').hidden=!deviceLimit||otherAccount;$('reset').disabled=busy||preparing;
  $('enable').textContent=preparing?'Wird vorbereitet …':!prepared?'Erneut prüfen':pushConfigured?'Erneut aktivieren':'Aktivieren';
  $('enable').disabled=busy||preparing||!access||!available||blocked;$('disable').disabled=busy||preparing;
  state($('state'),busy?phase:deviceLimit?'Gerätelimit erreicht':prepareFailed?'Prüfung fehlgeschlagen':otherAccount?'Anderes Konto':pushActive&&!blocked?'Aktiv':blocked?'Blockiert':!available?'Nicht verfügbar':preparing?'Wird vorbereitet':pushConfigured?'Bitte prüfen':'Aus',pushActive&&!blocked&&!otherAccount);

  $('note').textContent=deviceLimit?'Fünf Push-Verbindungen sind für dein Konto gespeichert. Du kannst sie zurücksetzen und dieses Gerät neu aktivieren.':otherAccount?'Zuerst die Verbindung des anderen Kontos deaktivieren.':blocked?'Mitteilungen in den Handy-Einstellungen erlauben.':isIos()&&!installed()?'H₂O über das Symbol auf dem Home-Bildschirm öffnen.':!available?'Dieser Browser unterstützt keine Push-Mitteilungen.':'Erinnerungen direkt auf dieses Handy.';
 }
 async function prepare(){
  if(preparing||busy||!access||!supported())return;
  const c={...access},version=generation;preparing=true;prepareFailed=false;prepared=null;buttons();
  try{
   if(isIos()&&!installed())throw Error('Auf dem iPhone: Teilen → Zum Home-Bildschirm hinzufügen. Danach H₂O über dieses Symbol öffnen.');
   const [saved,existing]=await Promise.all([g.DeckelDevice.read(),navigator.serviceWorker.getRegistration()]);current(c,version);
   pushConfigured=!!saved?.portal;otherAccount=pushConfigured&&(saved.alias!==c.alias||saved.origin&&saved.origin!==c.origin);
   const reg=existing?.active?existing:await timeout((async()=>{await navigator.serviceWorker.register('service-worker.js');return navigator.serviceWorker.ready;})(),20000,'Das Einrichten der Mitteilungen dauert zu lange. Bitte online erneut prüfen.');current(c,version);
   const sub=await reg.pushManager.getSubscription();current(c,version);
   pushActive=false;if(otherAccount)return;
   const devices=await g.H2OPortal.api('push-devices',{...(sub?{endpoint:sub.endpoint}:{})});current(c,version);
   if(!Number.isInteger(devices.count)||devices.limit!==5||typeof devices.registered!=='boolean')throw Error('Push-Geräte konnten nicht bestätigt werden. Bitte den Dienst aktualisieren.');
   deviceLimit=devices.count>=devices.limit&&!devices.registered&&devices.renewable!==true;
   if(deviceLimit){$('status').textContent='Vor einer neuen Aktivierung müssen gespeicherte Push-Verbindungen freigegeben werden.';return;}
   pushActive=pushConfigured&&saved.revision===c.revision&&sub?.endpoint===saved.endpoint&&devices.registered&&g.Notification.permission==='granted';
   if(pushActive){$('status').textContent='';return;}
   const response=await fetch(c.origin+'/health',{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),health=await response.json();current(c,version);
   if(!response.ok||health.portalVersion!==1||!/^[A-Za-z0-9_-]{87}$/.test(health.publicKey||''))throw Error('Der Mitteilungsdienst ist derzeit nicht bereit. Bitte später erneut prüfen.');
   const key=Uint8Array.from(atob(health.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-health.publicKey.length%4)%4)),v=>v.charCodeAt(0));
   prepared={c,reg,sub,key};if(!/^(Mitteilungen deaktiviert|Push-Verbindungen zurückgesetzt)/.test($('status').textContent))$('status').textContent='';
  }catch(error){if(version===generation){prepareFailed=true;$('status').textContent=error.status===404?'Der Push-Dienst muss aktualisiert werden. Bitte später erneut prüfen.':error.message||'Vorbereitung fehlgeschlagen. Bitte erneut prüfen.';}}
  finally{preparing=false;buttons();if(access&&version!==generation&&!busy)void prepare();}
 }
 async function render(value){
  if(!same(access,value)){$('status').textContent='';generation++;access=value;prepared=null;pushConfigured=pushActive=otherAccount=deviceLimit=prepareFailed=false;}
  if(native()){await nativeRender();return;}buttons();if(!busy)await prepare();
 }
 async function enable(){
  if(busy||preparing||!access)return;
  if(!prepared){await prepare();return;}
  const ready=prepared,c={...access},version=generation;busy=true;phase='Wird aktiviert';$('status').textContent='Mitteilungen werden aktiviert …';buttons();let created=null,registered=false;
  try{
   current(c,version);if(!same(ready.c,c))throw Error('Bitte die Verbindung erneut prüfen.');
   // No await or network request before subscribe: Safari requires this exact gesture.
   const subscription=ready.sub?Promise.resolve(ready.sub):ready.reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:ready.key});
   const sub=await subscription;if(!ready.sub)created=sub;current(c,version);
   const result=await g.H2OPortal.api('subscribe',{endpoint:sub.endpoint});current(c,version);if(result.ok!==true)throw Error('Die Aktivierung wurde noch nicht bestätigt. Bitte erneut versuchen.');registered=true;
   const personalURL=new URL(location.href);personalURL.search='';if(g.H2OIdentity?.session())personalURL.hash='';
   await g.DeckelDevice.write({portal:true,url:personalURL.href,origin:c.origin,alias:c.alias,revision:c.revision,capability:c.capability,endpoint:sub.endpoint});current(c,version);
   created=null;prepared={...ready,sub};pushConfigured=pushActive=true;otherAccount=false;$('status').textContent='Mitteilungen aktiviert.';
  }catch(error){if(created&&registered)await g.H2OPortal.api('unsubscribe',{endpoint:created.endpoint}).catch(()=>{});await created?.unsubscribe().catch(()=>{});if(version===generation){prepared=null;deviceLimit=/Maximal fünf Geräte/.test(error.message||'');$('status').textContent=error.name==='NotAllowedError'?'Mitteilungen wurden nicht erlaubt. Bitte die Mitteilungseinstellungen dieses Handys prüfen.':error.message||'Mitteilungen konnten nicht aktiviert werden.';}}
  finally{busy=false;buttons();}
 }
 async function disable(){if(busy||preparing)return;busy=true;phase='Wird deaktiviert';generation++;prepared=null;buttons();try{
  const saved=await g.DeckelDevice.read();if(saved?.url&&new URL(saved.url).hash)await g.DeckelDevice.saveLink(saved.url);
  if(saved?.endpoint&&saved.portal){const response=await fetch(saved.origin+'/portal/unsubscribe',{method:'POST',headers:{Authorization:'Bearer '+(access?.alias===saved.alias?access.capability:saved.capability),'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,revision:saved.revision,endpoint:saved.endpoint}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Abmeldung beim Dienst noch nicht bestätigt. Bitte erneut versuchen.');}
  const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('Gerät konnte noch nicht abgemeldet werden.');await g.DeckelDevice.clear();pushConfigured=pushActive=otherAccount=deviceLimit=prepareFailed=false;await markRead();$('status').textContent='Mitteilungen deaktiviert.';
 }catch(error){$('status').textContent=error.message;}finally{busy=false;buttons();if(access)void prepare();}}
 async function resetDevices(){
  if(busy||preparing||!access||otherAccount)return;
  if(!confirm('Alle gespeicherten Push-Verbindungen für dein Konto zurücksetzen? Auf deinen anderen Geräten musst du Mitteilungen danach erneut aktivieren. Anmeldung und gespeicherte Daten bleiben erhalten.'))return;
  const c={...access},version=generation;busy=true;phase='Wird zurückgesetzt';buttons();
  try{const result=await g.H2OPortal.api('push-devices',{reset:true});current(c,version);if(result.ok!==true||result.count!==0)throw Error('Zurücksetzen nicht bestätigt. Bitte erneut prüfen.');await g.DeckelDevice.clear();current(c,version);pushConfigured=pushActive=otherAccount=deviceLimit=prepareFailed=false;prepared=null;$('status').textContent='Push-Verbindungen zurückgesetzt. Dieses Gerät jetzt aktivieren.';}
  catch(error){if(version===generation)$('status').textContent=error.message;}
  finally{busy=false;buttons();if(access&&version===generation)void prepare();}
 }
 function clear({unsubscribeNative=true}={}){if(unsubscribeNative&&native()&&nativeActive&&access)void nativeDisable().catch(()=>{});nativeActive=false;nativeReady=false;nativeToken='';generation++;$('status').textContent='';access=null;prepared=null;pushConfigured=pushActive=otherAccount=deviceLimit=prepareFailed=false;buttons();}
 function init(){if($('enable'))$('enable').onclick=()=>native()?nativeEnable():enable();if($('disable'))$('disable').onclick=()=>native()?nativeDisable().catch(error=>{$('status').textContent=error.message;}):disable();if($('reset'))$('reset').onclick=resetDevices;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&access&&!busy)void render(access);});g.addEventListener?.('portal-pagechange',event=>{if(event.detail?.page==='more-security'&&access&&!busy)void prepare();});buttons();}
 g.H2ONativePush={disable:nativeDisable};g.DeckelPush={markRead,render,clear};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
