/* Portal notifications: explicit opt-in; personal URL and credentials stay on the phone. */
(function(g){
 'use strict';let access=null,busy=false,pairingLink='',pairingExpires=0,pushConfigured=false,pushActive=false,otherAccount=false,generation=0;const $=id=>document.getElementById('portal-push-'+id);const browser=id=>document.getElementById('portal-browser-'+id);
 async function markRead(){if(document.hidden)return;try{await navigator.clearAppBadge?.();}catch{}try{const reg=await navigator.serviceWorker?.getRegistration();for(const tag of ['deckel-reminder','h2o-portal-reminder'])for(const note of await reg?.getNotifications?.({tag})||[])note.close();}catch{}}
 async function restore(){if(!location.hash)try{const saved=await DeckelDevice.read(),url=saved?.url||await DeckelDevice.readLink?.();if(url){const target=new URL(url);target.search=location.search;history.replaceState(null,'',target.href);}}catch{}}
 function clearPair(){pairingLink='';pairingExpires=0;browser('link-box').hidden=true;browser('manual').hidden=true;browser('link').value='';}
 function state(element,text,active=false){element.textContent=text;element.setAttribute('data-active',String(active));}
 function buttons(){
  if(!$('enable'))return;
  if(pairingLink&&pairingExpires<=Date.now())clearPair();
  if(document.getElementById('portal-passkey-register'))document.getElementById('portal-passkey-register').disabled=busy||!access;
  browser('start').hidden=Boolean(pairingLink);browser('start').disabled=busy||!access;
  browser('copy').disabled=busy||!pairingLink;browser('revoke').disabled=busy||!access;
  const supported='serviceWorker' in navigator&&'PushManager' in g&&'Notification' in g;
  const blocked=supported&&Notification.permission==='denied';
  const showDisable=pushActive||otherAccount||pushConfigured&&blocked;
  $('enable').hidden=showDisable;$('disable').hidden=!showDisable;
  $('enable').textContent=pushConfigured&&!showDisable?'Erneut aktivieren':'Aktivieren';
  $('enable').disabled=busy||!access||!supported||blocked;$('disable').disabled=busy;
  state($('state'),otherAccount?'Anderes Konto':pushActive&&!blocked?'Aktiv':blocked?'Blockiert':!supported?'Nicht verfügbar':pushConfigured?'Bitte prüfen':'Aus',pushActive&&!blocked&&!otherAccount);
  $('note').textContent=otherAccount?'Zuerst die Verbindung des anderen Kontos deaktivieren.':blocked?'Mitteilungen in den Handy-Einstellungen erlauben.':!supported?'Für Push die installierte H₂O-App öffnen.':'Erinnerungen direkt auf dieses Handy.';
 }
 async function render(value){
  if(busy)return;
  if(access&&(access.alias!==value.alias||access.revision!==value.revision||access.origin!==value.origin)){clearPair();$('status').textContent='';browser('status').textContent='';}
  access=value;const version=++generation;buttons();
  try{
   const saved=await DeckelDevice.read(),reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();
   if(version!==generation)return;
   pushConfigured=!!saved?.portal;otherAccount=pushConfigured&&saved.alias!==value.alias;
   pushActive=pushConfigured&&!otherAccount&&saved.revision===value.revision&&sub?.endpoint===saved.endpoint&&g.Notification?.permission==='granted';
   buttons();
  }catch{if(version===generation)state($('state'),'Nicht geprüft');}
  try{
   const result=await g.H2OPortal.api('browser/status');
   if(version!==generation)return;
   if(!Number.isSafeInteger(result.sessions)||result.sessions<0)throw Error('Invalid browser status');
   const passkeyStatus=document.getElementById('portal-passkey-status');if(passkeyStatus)passkeyStatus.textContent=result.passkeys>0?'✓ WhatsApp-Passkey eingerichtet':g.H2OPasskeys?.browserSupportsWebAuthn()?'Einmal mit Face ID, Fingerabdruck oder Geräte-PIN bestätigen.':'Passkeys hier nicht verfügbar. Verwende Safari/Chrome oder „Ohne Passkey verbinden“. ';
   state(browser('state'),result.sessions?result.sessions+' Browser verbunden':'Nicht verbunden',result.sessions>0);
  }catch{if(version===generation)state(browser('state'),'Status nicht verfügbar');}
 }
 async function enable(){if(busy||!access)return;busy=true;generation++;buttons();let created=null;try{
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;if(ios&&!navigator.standalone&&!matchMedia('(display-mode: standalone)').matches)throw Error('Bitte zuerst über Teilen → Zum Home-Bildschirm hinzufügen und das H₂O-Symbol öffnen.');
  // Request permission from the user's click, before waiting on network operations.
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Mitteilungen sind nicht erlaubt. Du kannst sie in den Handy-Einstellungen freigeben.');
  const saved=await DeckelDevice.read();if(saved?.portal&&saved.alias!==access.alias)throw Error('Bitte zuerst die Erinnerungen des anderen Mitglieds deaktivieren.');
  const c=access;await navigator.serviceWorker.register('service-worker.js');const reg=await navigator.serviceWorker.ready;
  const response=await fetch(c.origin+'/health',{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),health=await response.json();if(!response.ok||health.portalVersion!==1||!/^[A-Za-z0-9_-]{87}$/.test(health.publicKey||''))throw Error('Bitte den Cloudflare-Dienst für das H₂O Portal aktualisieren.');
  const key=Uint8Array.from(atob(health.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-health.publicKey.length%4)%4)),v=>v.charCodeAt(0));let sub=await reg.pushManager.getSubscription();if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=sub;}
  await g.H2OPortal.api('subscribe',{endpoint:sub.endpoint});const personalURL=new URL(location.href);personalURL.search='';await DeckelDevice.write({portal:true,url:personalURL.href,origin:c.origin,alias:c.alias,revision:c.revision,capability:c.capability,endpoint:sub.endpoint});created=null;pushConfigured=true;pushActive=true;otherAccount=false;$('status').textContent='Mitteilungen aktiviert.';
 }catch(e){await created?.unsubscribe().catch(()=>{});$('status').textContent=e.message||'Erinnerungen konnten nicht aktiviert werden.';}finally{busy=false;buttons();}}
 async function disable(){if(busy)return;busy=true;generation++;buttons();try{const saved=await DeckelDevice.read();if(saved?.url)await DeckelDevice.saveLink(saved.url);if(saved?.endpoint&&saved.portal){const response=await fetch(saved.origin+'/portal/unsubscribe',{method:'POST',headers:{Authorization:'Bearer '+saved.capability,'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,revision:saved.revision,endpoint:saved.endpoint}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Abmeldung beim Dienst noch nicht bestätigt. Bitte erneut versuchen.');}const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('Gerät konnte noch nicht abgemeldet werden.');await DeckelDevice.clear();pushConfigured=false;pushActive=false;otherAccount=false;await markRead();$('status').textContent='Mitteilungen deaktiviert.';}catch(e){$('status').textContent=e.message;}finally{busy=false;buttons();}}
 
 async function startBrowserPair(){
  if(busy||!access)return;busy=true;generation++;clearPair();buttons();browser('status').textContent='Verbindung wird vorbereitet …';
  try{
   const check=await fetch(access.origin+'/health',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(12000)}),health=await check.json();
   if(!check.ok||health.browserPairVersion!==1)throw Error('Der Cloudflare-Dienst benötigt noch das Update für WhatsApp-Terminlinks.');
   const value=await g.H2OPortal.api('browser/start');
   if(!/^[A-F0-9]{24}$/.test(value.code||'')||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now())throw Error('Die Browser-Verbindung wurde nicht bestätigt.');
   const url=new URL('termin.html',location.href);
   url.search='';url.hash='pair='+value.code.toLowerCase();
   pairingLink=url.href;pairingExpires=value.expiresAt;
   browser('link-box').hidden=false;
   browser('status').textContent='Link bereit. Im Browser öffnen, um die Verbindung abzuschließen.';
  }catch(e){
   clearPair();
   browser('status').textContent=e.message||'Browser-Verbindung derzeit nicht verfügbar.';
  }finally{busy=false;buttons();}
 }
 async function copyBrowserLink(){
  if(busy)return;
  if(pairingExpires<=Date.now()){clearPair();buttons();browser('status').textContent='Link abgelaufen. Bitte erneut verbinden.';return;}
  const link=pairingLink,version=generation;
  if(!link||!/^https:\/\/ffw-wasser\.github\.io\/home\/termin\.html#pair=[a-f0-9]{24}$/.test(link))return;
  try{
   await navigator.clipboard.writeText(link);
   if(version!==generation||link!==pairingLink)return;
   browser('manual').hidden=true;browser('link').value='';
   browser('status').textContent='Link kopiert. Jetzt in Safari oder Chrome einfügen und öffnen.';
  }catch{
   if(version!==generation||link!==pairingLink)return;
   browser('manual').hidden=false;browser('link').value=link;
   browser('link').focus();browser('link').select();
   browser('status').textContent='Link im Feld gedrückt halten und kopieren. Danach in Safari oder Chrome öffnen.';
  }
 }
 async function revokeBrowsers(){
  if(busy||!access||!confirm('Alle WhatsApp-Passkeys und Browser-Verbindungen für diesen H₂O-Zugang wirklich sperren?'))return;
  busy=true;generation++;buttons();
  try{await g.H2OPortal.api('browser/revoke');clearPair();state(browser('state'),'Nicht verbunden');document.getElementById('portal-passkey-status').textContent='WhatsApp-Zugang zurückgesetzt.';browser('status').textContent='Alle Browserverbindungen getrennt.';}
  catch(e){browser('status').textContent=e.message||'Zurücksetzen nicht bestätigt.';}
  finally{busy=false;buttons();}
 }
 async function registerPasskey(){
  if(busy||!access)return;
  const note=document.getElementById('portal-passkey-status');
  if(!g.H2OPasskeys?.browserSupportsWebAuthn()){note.textContent='Passkeys hier nicht verfügbar. Bitte Safari/Chrome verwenden oder „Ohne Passkey verbinden“ öffnen.';return;}
  busy=true;generation++;buttons();note.textContent='WhatsApp-Passkey wird eingerichtet …';
  try{
   const request=await g.H2OPortal.api('passkey/register/options');
   const response=await g.H2OPasskeys.startRegistration({optionsJSON:request.options});
   const result=await g.H2OPortal.api('passkey/register/verify',{id:request.id,response});
   if(result.ok!==true)throw Error('Einrichtung nicht bestätigt.');
   note.textContent='✓ WhatsApp-Zugang eingerichtet. Öffne den Terminlink und wähle „Mit Passkey anmelden“.';
  }catch(error){note.textContent=error.name==='NotAllowedError'?'Einrichtung abgebrochen. Du kannst es erneut versuchen.':error.message||'Passkey nicht eingerichtet. In Safari/Chrome erneut versuchen.';}
  finally{busy=false;buttons();}
 }
 function init(){const passkey=document.getElementById('portal-passkey-register');if(passkey)passkey.onclick=registerPasskey;if($('enable'))$('enable').onclick=enable;if($('disable'))$('disable').onclick=disable;if(browser('start'))browser('start').onclick=startBrowserPair;if(browser('copy'))browser('copy').onclick=copyBrowserLink;if(browser('revoke'))browser('revoke').onclick=revokeBrowsers;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&access&&!busy)void render(access);});buttons();}
 g.DeckelPush={restore,markRead,render};restore();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
