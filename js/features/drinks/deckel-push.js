/* Explicit opt-in: prepare resources first, subscribe directly from the click. */
(function(g){
 'use strict';
 let access=null,busy=false,preparing=false,prepared=null,pushConfigured=false,pushActive=false,otherAccount=false,generation=0;
 const $=id=>document.getElementById('portal-push-'+id);
 const native=()=>/\bH2ONative\/1\b/.test(navigator.userAgent);
 const supported=()=>!native()&&Boolean(navigator.serviceWorker&&g.PushManager&&g.Notification);
 const same=(a,b)=>Boolean(a&&b&&a.alias===b.alias&&a.revision===b.revision&&a.origin===b.origin&&a.capability===b.capability);
 const current=(c,version)=>{if(version!==generation||!same(c,access))throw Error('Der Portalzugang wurde geändert. Bitte erneut anmelden.');};
 const isIos=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const installed=()=>navigator.standalone||g.matchMedia?.('(display-mode: standalone)').matches;
 function timeout(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
 async function markRead(){if(document.hidden)return;try{await navigator.clearAppBadge?.();}catch{}try{const reg=await navigator.serviceWorker?.getRegistration();for(const tag of ['deckel-reminder','h2o-portal-reminder'])for(const note of await reg?.getNotifications?.({tag})||[])note.close();}catch{}}
 function state(element,text,active=false){element.textContent=text;element.setAttribute('data-active',String(active));}
 function buttons(){
  if(!$('enable'))return;
  const available=supported(),blocked=available&&Notification.permission==='denied',showDisable=pushActive||otherAccount||pushConfigured&&blocked;
  $('enable').hidden=showDisable;$('disable').hidden=!showDisable;
  $('enable').textContent=preparing?'Wird vorbereitet …':!prepared?'Erneut prüfen':pushConfigured?'Erneut aktivieren':'Aktivieren';
  $('enable').disabled=busy||preparing||!access||!available||blocked;$('disable').disabled=busy||preparing;
  state($('state'),otherAccount?'Anderes Konto':pushActive&&!blocked?'Aktiv':blocked?'Blockiert':!available?'Nicht verfügbar':preparing?'Wird vorbereitet':pushConfigured?'Bitte prüfen':'Aus',pushActive&&!blocked&&!otherAccount);
  if(native()){$('enable').hidden=$('disable').hidden=true;state($('state'),'App-Vorbereitung');$('note').textContent='Server-Mitteilungen sind in dieser App-Version noch nicht eingerichtet. Oben unter Erinnerung kannst du eine tägliche App-Erinnerung wählen.';return;}
  $('note').textContent=otherAccount?'Zuerst die Verbindung des anderen Kontos deaktivieren.':blocked?'Mitteilungen in den Handy-Einstellungen erlauben.':isIos()&&!installed()?'H₂O über das Symbol auf dem Home-Bildschirm öffnen.':!available?'Dieser Browser unterstützt keine Push-Mitteilungen.':'Erinnerungen direkt auf dieses Handy.';
 }
 async function prepare(){
  if(preparing||busy||!access||!supported())return;
  const c={...access},version=generation;preparing=true;prepared=null;buttons();
  try{
   if(isIos()&&!installed())throw Error('Auf dem iPhone: Teilen → Zum Home-Bildschirm hinzufügen. Danach H₂O über dieses Symbol öffnen.');
   const [saved,existing]=await Promise.all([g.DeckelDevice.read(),navigator.serviceWorker.getRegistration()]);current(c,version);
   pushConfigured=!!saved?.portal;otherAccount=pushConfigured&&(saved.alias!==c.alias||saved.origin&&saved.origin!==c.origin);
   const reg=existing?.active?existing:await timeout((async()=>{await navigator.serviceWorker.register('service-worker.js');return navigator.serviceWorker.ready;})(),20000,'Die App-Vorbereitung dauert zu lange. Bitte online erneut prüfen.');current(c,version);
   const sub=await reg.pushManager.getSubscription();current(c,version);
   pushActive=pushConfigured&&!otherAccount&&saved.revision===c.revision&&sub?.endpoint===saved.endpoint&&g.Notification.permission==='granted';
   if(otherAccount||pushActive)return;
   const response=await fetch(c.origin+'/health',{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),health=await response.json();current(c,version);
   if(!response.ok||health.portalVersion!==1||!/^[A-Za-z0-9_-]{87}$/.test(health.publicKey||''))throw Error('Der Mitteilungsdienst ist derzeit nicht bereit. Bitte später erneut prüfen.');
   const key=Uint8Array.from(atob(health.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-health.publicKey.length%4)%4)),v=>v.charCodeAt(0));
   prepared={c,reg,sub,key};$('status').textContent='';
  }catch(error){if(version===generation)$('status').textContent=error.message||'Vorbereitung fehlgeschlagen. Bitte erneut prüfen.';}
  finally{preparing=false;buttons();if(access&&version!==generation&&!busy)void prepare();}
 }
 async function render(value){
  if(!same(access,value)){$('status').textContent='';generation++;access=value;prepared=null;pushConfigured=pushActive=otherAccount=false;}
  buttons();if(!busy)await prepare();
 }
 async function enable(){
  if(busy||preparing||!access)return;
  if(!prepared){await prepare();return;}
  const ready=prepared,c={...access},version=generation;busy=true;buttons();let created=null;
  try{
   current(c,version);if(!same(ready.c,c))throw Error('Bitte die Verbindung erneut prüfen.');
   // No await or network request before subscribe: Safari requires this exact gesture.
   const subscription=ready.sub?Promise.resolve(ready.sub):ready.reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:ready.key});
   const sub=await subscription;if(!ready.sub)created=sub;current(c,version);
   const result=await g.H2OPortal.api('subscribe',{endpoint:sub.endpoint});current(c,version);if(result.ok!==true)throw Error('Die Aktivierung wurde noch nicht bestätigt. Bitte erneut versuchen.');
   const personalURL=new URL(location.href);personalURL.search='';if(g.H2OIdentity?.session())personalURL.hash='';
   await g.DeckelDevice.write({portal:true,url:personalURL.href,origin:c.origin,alias:c.alias,revision:c.revision,capability:c.capability,endpoint:sub.endpoint});current(c,version);
   created=null;prepared={...ready,sub};pushConfigured=pushActive=true;otherAccount=false;$('status').textContent='Mitteilungen aktiviert.';
  }catch(error){await created?.unsubscribe().catch(()=>{});if(version===generation){prepared=null;$('status').textContent=error.name==='NotAllowedError'?'Mitteilungen wurden nicht erlaubt. Bitte die Mitteilungseinstellungen dieses Handys prüfen.':error.message||'Mitteilungen konnten nicht aktiviert werden.';}}
  finally{busy=false;buttons();}
 }
 async function disable(){if(busy||preparing)return;busy=true;generation++;prepared=null;buttons();try{
  const saved=await g.DeckelDevice.read();if(saved?.url&&new URL(saved.url).hash)await g.DeckelDevice.saveLink(saved.url);
  if(saved?.endpoint&&saved.portal){const response=await fetch(saved.origin+'/portal/unsubscribe',{method:'POST',headers:{Authorization:'Bearer '+(access?.alias===saved.alias?access.capability:saved.capability),'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,revision:saved.revision,endpoint:saved.endpoint}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Abmeldung beim Dienst noch nicht bestätigt. Bitte erneut versuchen.');}
  const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('Gerät konnte noch nicht abgemeldet werden.');await g.DeckelDevice.clear();pushConfigured=pushActive=otherAccount=false;await markRead();$('status').textContent='Mitteilungen deaktiviert.';
 }catch(error){$('status').textContent=error.message;}finally{busy=false;buttons();}}
 function clear(){generation++;$('status').textContent='';access=null;prepared=null;pushConfigured=pushActive=otherAccount=false;buttons();}
 function init(){if($('enable'))$('enable').onclick=enable;if($('disable'))$('disable').onclick=disable;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&access&&!busy)void render(access);});g.addEventListener?.('portal-pagechange',event=>{if(event.detail?.page==='more-security'&&access&&!busy)void prepare();});buttons();}
 g.DeckelPush={markRead,render,clear};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
