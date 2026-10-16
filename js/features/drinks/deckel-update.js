/* UI updates are separate from account refreshes; private fragments stay local. */
(function(g){
 'use strict';const $=id=>document.getElementById(id);let busy=false;
 const updateMessage='Eine neue Ansicht ist verfügbar. Bitte die Ansicht neu laden.';
 function resume(){if(document.hidden)return;$('deckel-update-message').textContent=updateMessage;check();}
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
   $('deckel-update-message').textContent=updateMessage;
  }catch{/* A failed update check never blocks the account. */}finally{busy=false;}
 }
 function reload(){
  const messages=[];
  if(g.DeckelActions?.hasUnsaved?.())messages.push('Mein Deckel: Vorgemerkte Getränke zuerst speichern oder verwerfen. Bei einer gesendeten Buchung die Speicherung erneut prüfen.');
  if(g.TheaterPhone?.hasUnsaved?.())messages.push('Theater: Die vorgemerkte Bestellung zuerst senden oder die Mengen mit Minus auf null setzen. Bei unbestätigter Übertragung „Übertragung erneut prüfen“ wählen.');
  else if(g.H2OPortal?.hasUnsaved?.())messages.push('Termine: Bei unbestätigten Termin-Rückmeldungen die Bestätigung abwarten oder „Speicherung erneut prüfen“ wählen.');
  if(messages.length){
   $('deckel-update-banner').hidden=false;
   $('deckel-update-message').textContent=messages.join(' ');
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
  document.addEventListener('visibilitychange',resume);
  g.addEventListener?.('pageshow',resume);
 }
 g.DeckelUpdate={check,reload};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
