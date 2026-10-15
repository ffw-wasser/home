/* UI updates are separate from account refreshes; private fragments stay local. */
(function(g){
 'use strict';const $=id=>document.getElementById(id);let busy=false;
 // Only an actually newer release should display the banner. A previous
 // release.json was older than deckel.html, causing an endless update loop.
 function newer(remote,local){
  const pattern=/^(\d{8})\.(\d+)$/,a=pattern.exec(remote||''),b=pattern.exec(local||'');
  if(!a||!b)return false;
  return Number(a[1])>Number(b[1])||a[1]===b[1]&&Number(a[2])>Number(b[2]);
 }
 async function check(){
  if(busy||document.hidden)return;
  const build=document.querySelector('meta[name="deckel-build"]')?.content;
  if(!build)return;
  busy=true;
  try{
   const response=await fetch('app-release.json?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
   if(!response.ok)return;
   const value=await response.json(),banner=$('deckel-update-banner');
   if(!newer(value.build,build)){banner.hidden=true;return;}
   banner.hidden=false;
   $('deckel-update-message').textContent='Eine neue Deckel-Ansicht ist verfügbar. Bitte die Ansicht neu laden.';
  }catch{/* A failed update check never blocks the account. */}finally{busy=false;}
 }
 function reload(){
  if(g.DeckelActions?.hasUnsaved?.()||g.H2OPortal?.hasUnsaved?.()){
   $('deckel-update-banner').hidden=false;
   $('deckel-update-message').textContent='Bitte vorgemerkte Getränke zuerst speichern oder verwerfen. Bei versendeten Buchungen oder Termin-Rückmeldungen zunächst die Bestätigung abwarten bzw. die Speicherung erneut prüfen.';
   return;
  }
  // Reload the public HTML past stale browser caches, while preserving the
  // entire personal URL fragment (account access never enters the query).
  const url=new URL(g.location.href);
  url.searchParams.set('_h2o_refresh',String(Date.now()));
  g.location.replace(url.href);
 }
 function init(){
  for(const id of ['deckel-update-now','deckel-update-reload'])$(id).onclick=reload;
  check();
  g.setInterval(()=>{if(!document.hidden)check();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 }
 g.DeckelUpdate={check,reload};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
