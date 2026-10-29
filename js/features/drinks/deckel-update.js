/* One refresh action for release and account updates; private fragments stay local. */
(function(g){
 'use strict';const $=id=>document.getElementById(id);let checking=null,refreshing=false,nextRefreshAt=0,hintTimer;
 async function check(){return document.hidden?false:Boolean(await g.AppRelease?.check());}
 function feedback(text){const hint=$('deckel-pull-refresh');if(hint){g.clearTimeout?.(hintTimer);hint.hidden=false;hint.textContent=text;hintTimer=g.setTimeout?.(()=>{if(!refreshing)hint.hidden=true;},6000);}}
 async function refresh(){
  if(refreshing||g.DeckelReload?.isLoading?.())return;
  const hint=$('deckel-pull-refresh');g.clearTimeout?.(hintTimer);
  if(Date.now()<nextRefreshAt){if(hint){hint.hidden=false;hint.textContent='Bitte kurz warten, bevor du erneut aktualisierst.';hintTimer=g.setTimeout?.(()=>{if(!refreshing)hint.hidden=true;},1800);}return false;}
  refreshing=true;let completed=false;
  if(hint){hint.hidden=false;hint.textContent='Wird aktualisiert …';}
  try{if(await check())completed=await reload();else{await g.DeckelReload?.({checkUpdate:false});completed=true;}return completed;}
  finally{if(completed)nextRefreshAt=Date.now()+10000;refreshing=false;if(hint&&(completed||hint.textContent==='Wird aktualisiert …'))hint.hidden=true;}
 }
 function blocked(){
  const messages=[];
  if(g.PortalEvidenceEditor?.hasUnsaved?.())messages.push('Status: Die Nachweiseingabe zuerst speichern oder abbrechen. Bei unbestätigter Speicherung erneut prüfen.');
  if(g.DeckelActions?.hasUnsaved?.())messages.push('Mein Deckel: Vorgemerkte Getränke zuerst speichern oder verwerfen. Bei einer gesendeten Buchung die Speicherung erneut prüfen.');
  if(g.TheaterPhone?.hasUnsaved?.())messages.push('Theater: Die vorgemerkte Bestellung zuerst senden oder die Mengen mit Minus auf null setzen. Bei unbestätigter Übertragung „Übertragung erneut prüfen“ wählen.');
  else if(g.H2OPortal?.hasUnsaved?.()&&!g.PortalEvidenceEditor?.hasUnsaved?.())messages.push('Termine: Bei unbestätigten Termin-Rückmeldungen die Bestätigung abwarten oder „Speicherung erneut prüfen“ wählen.');
  return messages.join(' ');
 }
 async function reload(){
  const reason=blocked();if(reason){feedback(reason);return false;}
  const applied=await g.AppRelease?.apply({guard:blocked});if(!applied&&g.AppRelease?.error)feedback(g.AppRelease.error);return Boolean(applied);
 }
 async function startup(){if(document.querySelector('dialog[open]')||g.H2OIdentity?.isBusy?.()||blocked()||!g.AppRelease?.start)return false;const ready=g.AppRelease.start({guard:blocked});g.DeckelStartup?.begin();return ready;}
 function initPullRefresh(){
  const main=$('deckel-main'),hint=$('deckel-pull-refresh');if(!main||!hint)return;
  let pull=null,suppressClickUntil=0;
  const atTop=()=>main.scrollTop<=1&&(g.scrollY||0)<=1;
  const blocked=()=>document.hidden||refreshing||g.DeckelReload?.isLoading?.()||g.DeckelMobile?.isResources?.()||!document.body.classList.contains('h2o-portal')||document.body.classList.contains('portal-drag-active')||document.querySelector('dialog[open]')||Math.abs((g.visualViewport?.scale||1)-1)>.05;
  function cancel(){pull=null;if(!refreshing)hint.hidden=true;}
  main.addEventListener('touchstart',event=>{
   cancel();if(event.touches.length!==1||!atTop()||blocked())return;
   const target=event.target;
   if(target.closest('input,select,textarea,a,summary,[contenteditable],[data-no-swipe],canvas,iframe,dialog'))return;
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
   pull.armed=dy>=140;hint.hidden=false;hint.textContent=pull.armed?'Loslassen zum Aktualisieren':'Zum Aktualisieren weiter nach unten ziehen';
  },{passive:false});
  main.addEventListener('touchend',event=>{
   if(!pull)return;const start=pull,ended=Array.from(event.changedTouches).some(t=>t.identifier===start.id);
   if(start.active)suppressClickUntil=Date.now()+700;
   cancel();if(ended&&start.armed&&atTop()&&!blocked())refresh().catch(()=>{});
  },{passive:true});
  main.addEventListener('touchcancel',cancel,{passive:true});
  main.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  g.addEventListener('portal-pagechange',cancel);document.addEventListener('visibilitychange',cancel);
 }
 function init(){initPullRefresh();}
 g.DeckelUpdate={check,reload,refresh,startup,isRefreshing:()=>refreshing};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
