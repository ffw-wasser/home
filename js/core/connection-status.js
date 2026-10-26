/* Shared wording for connection failures; never marks an unconfirmed write as saved. */
(function(g){
 'use strict';
 function message(error){
  if(g.navigator?.onLine===false)return 'Offline. Bitte die Internetverbindung prüfen und erneut versuchen.';
  if(['TimeoutError','AbortError'].includes(error?.name))return 'Die Verbindung hat zu lange gedauert. Bitte erneut versuchen.';
  if(error instanceof TypeError||/load failed|failed to fetch|networkerror|network request failed/i.test(error?.message||''))return 'Die Verbindung wurde unterbrochen. Bitte erneut versuchen.';
  if(error?.name==='SyntaxError')return 'Der Dienst hat keine gültige Antwort geliefert. Bitte erneut versuchen.';
  return error?.message||'Der Dienst ist derzeit nicht erreichbar. Bitte erneut versuchen.';
 }
 function initOffline(){
  const main=document.querySelector('main');if(!main)return;
  const banner=document.createElement('p');banner.id='app-offline-status';banner.className='app-offline-status';banner.setAttribute('role','status');banner.hidden=true;main.prepend(banner);
  const paint=()=>{banner.hidden=g.navigator?.onLine!==false;banner.textContent='Offline · Gespeicherte Inhalte';};paint();g.addEventListener('online',paint);g.addEventListener('offline',paint);
  const output=document.getElementById('offline-library-status'),retry=document.getElementById('offline-library-retry');
  if(!g.navigator?.serviceWorker)return;
  const send=type=>g.navigator.serviceWorker.ready.then(registration=>registration.active?.postMessage({type})).catch(()=>{});
  g.navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type!=='OFFLINE_LIBRARY_STATUS')return;const {ready,total}=event.data;if(!Number.isInteger(ready)||!Number.isInteger(total)||ready<0||ready>total)return;if(output)output.textContent=ready===total?'Ausbildung, Hilfe und FwDV sind offline bereit.':'Offline-Unterlagen: '+ready+' / '+total+' gespeichert. Bitte online vervollständigen.';if(retry)retry.hidden=ready===total;});
  retry?.addEventListener('click',()=>{if(g.navigator.onLine===false){output.textContent='Zum Vervollständigen kurz online gehen.';return;}output.textContent='Offline-Unterlagen werden geladen …';send('PREPARE_OFFLINE_LIBRARY');});
  send('PREPARE_OFFLINE_LIBRARY');g.addEventListener('online',()=>send('PREPARE_OFFLINE_LIBRARY'));
 }
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initOffline,{once:true});else initOffline();}
 g.ConnectionStatus={message};if(typeof module!=='undefined'&&module.exports)module.exports=g.ConnectionStatus;
})(globalThis);
