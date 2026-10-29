/* Startup updates are automatic; manual checks keep the existing work guards. */
(function(g){
 'use strict';
 const $=id=>document.getElementById(id);
 function blocked(){
  if((typeof currentSessionId!=='undefined'&&currentSessionId)||(typeof currentOperationId!=='undefined'&&currentOperationId))return 'Bitte den laufenden Termin oder Einsatz zuerst abschließen. Danach kannst du aktualisieren.';
  if(typeof oneDriveBusy!=='undefined'&&oneDriveBusy)return 'OneDrive synchronisiert gerade. Bitte die Speicherung abwarten und erneut aktualisieren.';
  if(g.PortalEvidenceAdmin?.hasUnsaved?.())return 'Bitte die laufende Nachweisprüfung zuerst abschließen.';
  if(g.TheaterAdmin?.hasUnsaved?.())return 'Bitte die Theater-Änderungen zuerst speichern und laufende Vorgänge abwarten.';
  if(document.querySelector('dialog[open]'))return 'Bitte den geöffneten Dialog zuerst abschließen oder schließen.';
  // Reuse the existing guards for drinks, member edits and pending attendance.
  const event=new Event('beforeunload',{cancelable:true});
  g.dispatchEvent(event);
  if(event.defaultPrevented)return 'Bitte offene Änderungen zuerst speichern oder verwerfen. Bei unbestätigter Speicherung zuerst das Ergebnis prüfen.';
  return '';
 }
 async function check(manual=false){
  const available=Boolean(await g.AppRelease?.check());
  if(manual)g.showToast?.(g.AppRelease?.error||(available?'Eine Aktualisierung wird beim nächsten Start übernommen.':'Die Anwendung ist auf dem neuesten Stand.'));
  return available;
 }
 async function apply(){
  const button=$('app-update-check');if(button?.disabled)return false;if(button)button.disabled=true;
  try{const applied=await g.AppRelease?.apply({guard:blocked});if(!applied)g.showToast?.(g.AppRelease?.error||'Die Anwendung ist auf dem neuesten Stand.');return Boolean(applied);}
  finally{if(button)button.disabled=false;}
 }
 async function resume(){
  if(document.hidden||blocked()||!g.AppRelease?.start)return;
  const ready=g.AppRelease.start({guard:blocked});g.updateOneDriveStartup?.();
  if(!await ready)g.updateOneDriveStartup?.();
 }
 function init(){document.addEventListener('visibilitychange',resume);g.addEventListener?.('pageshow',event=>{if(event.persisted)void resume();});const button=$('app-update-check');if(button)button.onclick=()=>{g.closeCompactMenu?.();void apply();};}
 g.FFWUpdate={check,apply};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
