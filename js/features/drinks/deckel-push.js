/* Portal notifications: explicit opt-in; personal URL and credentials stay on the phone. */
(function(g){
 'use strict';let access=null,busy=false,pairingLink='';const $=id=>document.getElementById('portal-push-'+id);const browser=id=>document.getElementById('portal-browser-'+id);
 async function markRead(){if(document.hidden)return;try{await navigator.clearAppBadge?.();}catch{}try{const reg=await navigator.serviceWorker?.getRegistration();for(const tag of ['deckel-reminder','h2o-portal-reminder'])for(const note of await reg?.getNotifications?.({tag})||[])note.close();}catch{}}
 async function restore(){if(!location.hash)try{const saved=await DeckelDevice.read(),url=saved?.url||await DeckelDevice.readLink?.();if(url){const target=new URL(url);target.search=location.search;history.replaceState(null,'',target.href);}}catch{}}
 function buttons(){if(!$('enable'))return;if(browser('start'))browser('start').disabled=busy||!access;if(browser('revoke'))browser('revoke').disabled=busy||!access;const supported='serviceWorker' in navigator&&'PushManager' in g&&'Notification' in g;$('enable').disabled=busy||!access||!supported;$('disable').disabled=busy||!supported;$('note').textContent=supported?'Erinnerungen erscheinen als Handy-Mitteilung. Am iPhone das H₂O Portal zuerst zum Home-Bildschirm hinzufügen. Ton und Anzeige hängen von deinen Handy-Einstellungen ab.':'Dieser Browser unterstützt keine Push-Mitteilungen. Termine bleiben im Portal sichtbar.';}
 async function render(value){access=value;buttons();try{const saved=await DeckelDevice.read();if(saved?.portal&&saved.alias===value.alias&&saved.revision===value.revision)$('status').textContent='Erinnerungen auf diesem Handy aktiviert.';}catch{}}
 async function enable(){if(busy||!access)return;busy=true;buttons();let created=null;try{
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;if(ios&&!navigator.standalone&&!matchMedia('(display-mode: standalone)').matches)throw Error('Bitte zuerst über Teilen → Zum Home-Bildschirm hinzufügen und das H₂O-Symbol öffnen.');
  // Request permission from the user's click, before waiting on network operations.
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Mitteilungen sind nicht erlaubt. Du kannst sie in den Handy-Einstellungen freigeben.');
  const saved=await DeckelDevice.read();if(saved?.portal&&saved.alias!==access.alias)throw Error('Bitte zuerst die Erinnerungen des anderen Mitglieds deaktivieren.');
  const c=access;await navigator.serviceWorker.register('service-worker.js');const reg=await navigator.serviceWorker.ready;
  const response=await fetch(c.origin+'/health',{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),health=await response.json();if(!response.ok||health.portalVersion!==1||!/^[A-Za-z0-9_-]{87}$/.test(health.publicKey||''))throw Error('Bitte den Cloudflare-Dienst für das H₂O Portal aktualisieren.');
  const key=Uint8Array.from(atob(health.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-health.publicKey.length%4)%4)),v=>v.charCodeAt(0));let sub=await reg.pushManager.getSubscription();if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=sub;}
  await g.H2OPortal.api('subscribe',{endpoint:sub.endpoint});const personalURL=new URL(location.href);personalURL.search='';await DeckelDevice.write({portal:true,url:personalURL.href,origin:c.origin,alias:c.alias,revision:c.revision,capability:c.capability,endpoint:sub.endpoint});created=null;$('status').textContent='✓ Erinnerungen auf diesem Handy aktiviert. Entschuldigte Termine werden ausgelassen.';
 }catch(e){await created?.unsubscribe().catch(()=>{});$('status').textContent=e.message||'Erinnerungen konnten nicht aktiviert werden.';}finally{busy=false;buttons();}}
 async function disable(){if(busy)return;busy=true;buttons();try{const saved=await DeckelDevice.read();if(saved?.url)await DeckelDevice.saveLink(saved.url);if(saved?.endpoint&&saved.portal){const response=await fetch(saved.origin+'/portal/unsubscribe',{method:'POST',headers:{Authorization:'Bearer '+saved.capability,'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,revision:saved.revision,endpoint:saved.endpoint}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Abmeldung beim Dienst noch nicht bestätigt. Bitte erneut versuchen.');}const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('Gerät konnte noch nicht abgemeldet werden.');await DeckelDevice.clear();await markRead();$('status').textContent='Erinnerungen auf diesem Handy deaktiviert.';}catch(e){$('status').textContent=e.message;}finally{busy=false;buttons();}}
 
 async function startBrowserPair(){
  if(busy||!access)return;busy=true;buttons();pairingLink='';browser('link-box').hidden=true;browser('status').textContent='Sichere Browser-Verbindung wird vorbereitet …';
  try{
   const check=await fetch(access.origin+'/health',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(12000)}),health=await check.json();
   if(!check.ok||health.browserPairVersion!==1)throw Error('Der Cloudflare-Dienst benötigt noch das Update für WhatsApp-Terminlinks.');
   const value=await g.H2OPortal.api('browser/start');
   if(!/^[A-F0-9]{24}$/.test(value.code||''))throw Error('Die Browser-Verbindung wurde nicht bestätigt.');
   const url=new URL('termin.html',location.href);
   url.search='';url.hash='pair='+value.code.toLowerCase();
   pairingLink=url.href;
   browser('link-box').hidden=false;
   browser('status').textContent='✓ Fertig vorbereitet. Tippe auf „Verbindungslink kopieren“ und füge ihn in Safari (iPhone) oder Chrome (Android) ein. H₂O bleibt geöffnet.';
  }catch(e){
   pairingLink='';browser('link-box').hidden=true;
   browser('status').textContent=e.message||'Browser-Verbindung derzeit nicht verfügbar.';
  }finally{busy=false;buttons();}
 }
 async function copyBrowserLink(){
  const link=pairingLink;
  if(!link||!/^https:\/\/ffw-wasser\.github\.io\/home\/termin\.html#pair=[a-f0-9]{24}$/.test(link))return;
  try{
   await navigator.clipboard.writeText(link);
   browser('status').textContent='✓ Link kopiert. Öffne jetzt Safari (iPhone) oder Chrome (Android) und füge ihn in die Adressleiste ein. Deine H₂O-App bleibt im Hintergrund geöffnet.';
  }catch{
   browser('status').textContent='Automatisches Kopieren nicht möglich. Tippe auf „Jetzt im Browser öffnen“ oder probiere es später erneut.';
  }
 }
 async function revokeBrowsers(){
  if(busy||!access||!confirm('Alle für diesen H₂O-Zugang eingerichteten Browser-Verbindungen wirklich sperren?'))return;
  busy=true;buttons();
  try{await g.H2OPortal.api('browser/revoke');pairingLink='';browser('link-box').hidden=true;browser('status').textContent='✓ Browserzugänge gesperrt. Bei Bedarf erneut verbinden.';}
  catch(e){browser('status').textContent=e.message||'Zurücksetzen nicht bestätigt.';}
  finally{busy=false;buttons();}
 }
 function init(){if($('enable'))$('enable').onclick=enable;if($('disable'))$('disable').onclick=disable;if(browser('start'))browser('start').onclick=startBrowserPair;if(browser('copy'))browser('copy').onclick=copyBrowserLink;if(browser('revoke'))browser('revoke').onclick=revokeBrowsers;buttons();}
 g.DeckelPush={restore,markRead,render};restore();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
