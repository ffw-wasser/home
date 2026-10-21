/* Portal notifications: explicit opt-in; personal URL and credentials stay on the phone. */
(function(g){
 'use strict';let access=null,busy=false,pushConfigured=false,pushActive=false,otherAccount=false,generation=0;const $=id=>document.getElementById('portal-push-'+id);const browser=id=>document.getElementById('portal-browser-'+id);
 async function markRead(){if(document.hidden)return;try{await navigator.clearAppBadge?.();}catch{}try{const reg=await navigator.serviceWorker?.getRegistration();for(const tag of ['deckel-reminder','h2o-portal-reminder'])for(const note of await reg?.getNotifications?.({tag})||[])note.close();}catch{}}
 function state(element,text,active=false){element.textContent=text;element.setAttribute('data-active',String(active));}
 function buttons(){
  if(!$('enable'))return;
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
  if(access&&(access.alias!==value.alias||access.revision!==value.revision||access.origin!==value.origin)){$('status').textContent='';}
  access=value;const version=++generation;buttons();
  try{
   const saved=await DeckelDevice.read(),reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();
   if(version!==generation)return;
   pushConfigured=!!saved?.portal;otherAccount=pushConfigured&&saved.alias!==value.alias;
   pushActive=pushConfigured&&!otherAccount&&saved.revision===value.revision&&sub?.endpoint===saved.endpoint&&g.Notification?.permission==='granted';
   buttons();
  }catch{if(version===generation)state($('state'),'Nicht geprüft');}
  state(browser('state'),'Mit H₂O verbunden',true);
 }
 async function enable(){if(busy||!access)return;busy=true;generation++;buttons();let created=null;try{
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;if(ios&&!navigator.standalone&&!matchMedia('(display-mode: standalone)').matches)throw Error('Bitte zuerst über Teilen → Zum Home-Bildschirm hinzufügen und das H₂O-Symbol öffnen.');
  // Request permission from the user's click, before waiting on network operations.
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Mitteilungen sind nicht erlaubt. Du kannst sie in den Handy-Einstellungen freigeben.');
  const saved=await DeckelDevice.read();if(saved?.portal&&saved.alias!==access.alias)throw Error('Bitte zuerst die Erinnerungen des anderen Mitglieds deaktivieren.');
  const c=access;await navigator.serviceWorker.register('service-worker.js');const reg=await navigator.serviceWorker.ready;
  const response=await fetch(c.origin+'/health',{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),health=await response.json();if(!response.ok||health.portalVersion!==1||!/^[A-Za-z0-9_-]{87}$/.test(health.publicKey||''))throw Error('Bitte den Cloudflare-Dienst für das H₂O Portal aktualisieren.');
  const key=Uint8Array.from(atob(health.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-health.publicKey.length%4)%4)),v=>v.charCodeAt(0));let sub=await reg.pushManager.getSubscription();if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=sub;}
  await g.H2OPortal.api('subscribe',{endpoint:sub.endpoint});const personalURL=new URL(location.href);personalURL.search='';if(g.H2OIdentity?.session())personalURL.hash='';await DeckelDevice.write({portal:true,url:personalURL.href,origin:c.origin,alias:c.alias,revision:c.revision,capability:c.capability,endpoint:sub.endpoint});created=null;pushConfigured=true;pushActive=true;otherAccount=false;$('status').textContent='Mitteilungen aktiviert.';
 }catch(e){await created?.unsubscribe().catch(()=>{});$('status').textContent=e.message||'Erinnerungen konnten nicht aktiviert werden.';}finally{busy=false;buttons();}}
 async function disable(){if(busy)return;busy=true;generation++;buttons();try{const saved=await DeckelDevice.read();if(saved?.url)await DeckelDevice.saveLink(saved.url);if(saved?.endpoint&&saved.portal){const response=await fetch(saved.origin+'/portal/unsubscribe',{method:'POST',headers:{Authorization:'Bearer '+(access?.alias===saved.alias?access.capability:saved.capability),'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,revision:saved.revision,endpoint:saved.endpoint}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Abmeldung beim Dienst noch nicht bestätigt. Bitte erneut versuchen.');}const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('Gerät konnte noch nicht abgemeldet werden.');await DeckelDevice.clear();pushConfigured=false;pushActive=false;otherAccount=false;await markRead();$('status').textContent='Mitteilungen deaktiviert.';}catch(e){$('status').textContent=e.message;}finally{busy=false;buttons();}}
 
 function init(){if($('enable'))$('enable').onclick=enable;if($('disable'))$('disable').onclick=disable;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&access&&!busy)void render(access);});buttons();}
 g.DeckelPush={markRead,render};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
