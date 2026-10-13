/* Compatibility for old installed Deckel links; reminder activation is removed. */
(function(){
 'use strict';let cleanup=null;
 async function markRead(){
  if(document.hidden)return;
  try{await navigator.clearAppBadge?.();}catch{}
  try{const reg=await navigator.serviceWorker?.getRegistration();const notifications=await reg?.getNotifications?.({tag:'deckel-reminder'});for(const notification of notifications||[])notification.close();}catch{}
 }
 async function removeOldReminders(){
  if(cleanup)return cleanup;
  cleanup=(async()=>{const saved=await DeckelDevice.read();
   // Keep the personal link before clearing the obsolete notification record.
   if(saved?.url)await DeckelDevice.saveLink(saved.url);
   const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();
   if(sub&&!await sub.unsubscribe())throw Error('Alte Benachrichtigung konnte noch nicht entfernt werden.');
   if(saved?.endpoint&&/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(saved.origin||'')&&/^[A-Za-z0-9_-]{43}$/.test(saved.capability||'')){
    try{await fetch(saved.origin+'/unsubscribe',{method:'POST',headers:{Authorization:'Bearer '+saved.capability,'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,endpoint:saved.endpoint}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(10000)});}catch{}
   }
   if(saved)await DeckelDevice.clear();await markRead();
  })().catch(()=>{cleanup=null;});return cleanup;
 }
 async function restore(){if(!location.hash)try{const saved=await DeckelDevice.read(),url=saved?.url||await DeckelDevice.readLink?.();if(url)history.replaceState(null,'',url);}catch{}await removeOldReminders();}
 window.DeckelPush={restore,markRead};restore();
})();
