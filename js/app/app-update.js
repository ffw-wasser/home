/* Public release checks; applying an update is explicit and respects active work. */
(function(g){
 'use strict';
 const $=id=>document.getElementById(id);
 let checking=null,available='',applying=false;
 const build=document.querySelector('meta[name="ffw-build"]')?.content||'';
 function newer(remote,local){
  const pattern=/^(\d{8})\.(\d+)$/,a=pattern.exec(remote||''),b=pattern.exec(local||'');
  return !!(a&&b&&(Number(a[1])>Number(b[1])||a[1]===b[1]&&Number(a[2])>Number(b[2])));
 }
 function message(text){$('app-update-banner').hidden=false;$('app-update-message').textContent=text;}
 async function check(manual=false){
  if(document.hidden)return false;
  if(checking)return checking;
  $('app-update-check').disabled=true;
  checking=(async()=>{
   try{
    const response=await fetch('app-release.json?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('release');
    const value=await response.json();
    if(!/^\d{8}\.\d+$/.test(value.build||''))throw Error('release');
    available=newer(value.build,build)?value.build:'';
    $('app-update-now').hidden=!available;
    if(available)message('Eine neue Version von FFW Wasser ist verfügbar.');
    else if(manual)message('FFW Wasser ist auf dem neuesten Stand.');
    else $('app-update-banner').hidden=true;
    return !!available;
   }catch{
    if(manual)message('Update-Prüfung nicht möglich. Bitte Internetverbindung prüfen und erneut versuchen.');
    return false;
   }
  })();
  try{return await checking;}finally{checking=null;$('app-update-check').disabled=false;}
 }
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
 function refreshHome(){
  if(applying)return false;const reason=blocked();if(reason){g.showToast?.(reason,'warning');return false;}
  const url=new URL(g.location.href);url.searchParams.set('_ffw_refresh',String(Date.now()));g.location.replace(url.href);return true;
 }
 async function apply(){
  if(applying)return;
  let reason=blocked();if(reason){message(reason);return;}
  applying=true;$('app-update-now').disabled=true;
  try{
   if(!await check(true))return;
   // GitHub Pages may deliver the release manifest before the new HTML.
   const response=await fetch('index.html?_ffw_verify='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
   const html=response.ok?await response.text():'',remote=/<meta\s+name="ffw-build"\s+content="([\d.]+)"/.exec(html)?.[1];
   if(remote!==available&&!newer(remote,available)){message('Die neue Version wird noch bereitgestellt. Bitte gleich erneut versuchen.');return;}
   try{const registration=await navigator.serviceWorker?.getRegistration();await registration?.update();}catch{/* Online navigation still loads the verified release. */}
   reason=blocked();if(reason){message(reason);return;}
   const url=new URL(g.location.href);url.searchParams.set('_ffw_refresh',String(Date.now()));
   g.location.replace(url.href);
  }catch{message('Aktualisierung nicht möglich. Bitte Internetverbindung prüfen und erneut versuchen.');}
  finally{applying=false;$('app-update-now').disabled=false;}
 }
 function resume(){if(!document.hidden&&!applying)void check();}
 function init(){
  if(!$('app-update-banner')||!build)return;
  $('app-update-now').onclick=apply;
  $('app-update-check').onclick=()=>{g.closeCompactMenu?.();void check(true);};
  resume();g.setInterval(resume,60000);
  document.addEventListener('visibilitychange',resume);
  g.addEventListener('pageshow',resume);g.addEventListener('online',resume);
 }
 g.FFWUpdate={check,apply,refreshHome};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
