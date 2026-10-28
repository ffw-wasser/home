/* One refresh action for release and account updates; private fragments stay local. */
(function(g){
 'use strict';const $=id=>document.getElementById(id);let checking=null,refreshing=false;
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
  if(checking)return checking;
  if(document.hidden)return false;
  const build=document.querySelector('meta[name="deckel-build"]')?.content;
  if(!build)return false;
  checking=(async()=>{
   try{
    const response=await fetch('app-release.json?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return false;
    const value=await response.json(),available=newer(value.build,build);
    $('deckel-update-banner').hidden=!available;
    if(available)$('deckel-update-message').textContent=updateMessage;
    return available;
   }catch{return false;}
  })();
  try{return await checking;}finally{checking=null;}
 }
 async function refresh(){
  if(refreshing||g.DeckelReload?.isLoading?.())return;
  refreshing=true;const hint=$('deckel-pull-refresh');
  if(hint){hint.hidden=false;hint.textContent='Wird aktualisiert …';}
  try{if(await check())reload();else await g.DeckelReload?.({checkUpdate:false});}
  finally{refreshing=false;if(hint)hint.hidden=true;}
 }
 function reload(){
  const messages=[];
  if(g.PortalEvidenceEditor?.hasUnsaved?.())messages.push('Status: Die Nachweiseingabe zuerst speichern oder abbrechen. Bei unbestätigter Speicherung erneut prüfen.');
  if(g.DeckelActions?.hasUnsaved?.())messages.push('Mein Deckel: Vorgemerkte Getränke zuerst speichern oder verwerfen. Bei einer gesendeten Buchung die Speicherung erneut prüfen.');
  if(g.TheaterPhone?.hasUnsaved?.())messages.push('Theater: Die vorgemerkte Bestellung zuerst senden oder die Mengen mit Minus auf null setzen. Bei unbestätigter Übertragung „Übertragung erneut prüfen“ wählen.');
  else if(g.H2OPortal?.hasUnsaved?.()&&!g.PortalEvidenceEditor?.hasUnsaved?.())messages.push('Termine: Bei unbestätigten Termin-Rückmeldungen die Bestätigung abwarten oder „Speicherung erneut prüfen“ wählen.');
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
 function initPullRefresh(){
  const main=$('deckel-main'),hint=$('deckel-pull-refresh');if(!main||!hint)return;
  let pull=null;
  const atTop=()=>main.scrollTop<=1&&(g.scrollY||0)<=1;
  const blocked=()=>document.hidden||refreshing||g.DeckelReload?.isLoading?.()||g.DeckelMobile?.isResources?.()||!document.body.classList.contains('h2o-portal')||document.body.classList.contains('portal-drag-active')||document.querySelector('dialog[open]')||Math.abs((g.visualViewport?.scale||1)-1)>.05;
  function cancel(){pull=null;if(!refreshing)hint.hidden=true;}
  main.addEventListener('touchstart',event=>{
   cancel();if(event.touches.length!==1||!atTop()||blocked())return;
   const target=event.target;
   if(target.closest('input,select,textarea,button,a,summary,[role="button"],[contenteditable],[data-no-swipe],canvas,iframe,dialog'))return;
   for(let node=target;node&&node!==main;node=node.parentElement){if(node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(g.getComputedStyle(node).overflowY))return;}
   const touch=event.touches[0];pull={id:touch.identifier,x:touch.clientX,y:touch.clientY,armed:false,active:false};
  },{passive:true});
  main.addEventListener('touchmove',event=>{
   if(!pull)return;
   if(event.touches.length!==1||!atTop()||blocked()){cancel();return;}
   const touch=Array.from(event.touches).find(t=>t.identifier===pull.id);if(!touch){cancel();return;}
   const dx=Math.abs(touch.clientX-pull.x),dy=touch.clientY-pull.y;
   if(!pull.active){if(Math.max(dx,Math.abs(dy))<12)return;if(dy<=0||dy<dx*1.5){cancel();return;}pull.active=true;}
   if(!event.cancelable){cancel();return;}event.preventDefault();
   pull.armed=dy>=80;hint.hidden=false;hint.textContent=pull.armed?'Loslassen zum Aktualisieren':'Zum Aktualisieren weiter nach unten ziehen';
  },{passive:false});
  main.addEventListener('touchend',event=>{
   if(!pull)return;const start=pull,ended=Array.from(event.changedTouches).some(t=>t.identifier===start.id);
   cancel();if(ended&&start.armed&&atTop()&&!blocked())refresh().catch(()=>{});
  },{passive:true});
  main.addEventListener('touchcancel',cancel,{passive:true});
  g.addEventListener('portal-pagechange',cancel);document.addEventListener('visibilitychange',cancel);
 }
 function init(){
  $('deckel-update-now').onclick=reload;
  initPullRefresh();
  check();
  g.setInterval(()=>{if(!document.hidden)check();},60000);
  document.addEventListener('visibilitychange',resume);
  g.addEventListener?.('pageshow',resume);
 }
 g.DeckelUpdate={check,reload,refresh,isRefreshing:()=>refreshing};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
