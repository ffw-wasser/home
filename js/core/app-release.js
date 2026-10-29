/* Shared public release check. Personal fragments are retained only for local navigation. */
(function(g){
 'use strict';
 const tag=document.querySelector('meta[name="ffw-build"]')||document.querySelector('meta[name="deckel-build"]');
 if(!tag)return;
 const portal=Boolean(document.querySelector('meta[name="deckel-build"]')),page=portal?'deckel.html':'index.html',parameter=portal?'_h2o_refresh':'_ffw_refresh',build=tag.content;
 let checking=null,applying=null,pending=true,redirecting=false,lastError='';
 function newer(remote,local){const pattern=/^(\d{8})\.(\d+)$/,a=pattern.exec(remote||''),b=pattern.exec(local||'');return !!(a&&b&&(Number(a[1])>Number(b[1])||a[1]===b[1]&&Number(a[2])>Number(b[2])));}
 async function check(signal){
  if(checking)return checking;
  checking=(async()=>{try{
   const response=await fetch('app-release.json?t='+Date.now(),{cache:'no-store',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:signal||AbortSignal.timeout(3000)});
   if(!response.ok)throw Error('Die Update-Prüfung ist derzeit nicht erreichbar.');
   const value=await response.json();if(!/^\d{8}\.\d+$/.test(value.build||''))throw Error('Die Update-Version konnte nicht geprüft werden.');lastError='';return newer(value.build,build)?value.build:'';
  }catch{lastError='Update-Prüfung nicht möglich. Bitte die Internetverbindung prüfen.';return '';}})();
  try{return await checking;}finally{checking=null;}
 }
 async function apply({guard=()=>'',startup=false}={}){
  if(applying)return applying;
  applying=(async()=>{try{
   lastError=guard();if(lastError)return false;
   const signal=AbortSignal.timeout(3000),remote=await check(signal);if(!remote)return false;
   const url=new URL(g.location.href);
   // A CDN may still return the old document after the release manifest changes.
   if(url.searchParams.get(parameter)===remote||newer(url.searchParams.get(parameter),remote)){lastError='Die neue Version wird noch bereitgestellt.';return false;}
   const response=await fetch(page+'?_app_verify='+encodeURIComponent(remote),{cache:'no-store',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal});
   const html=response.ok?await response.text():'',name=portal?'deckel-build':'ffw-build',match=new RegExp('<meta\\s+name="'+name+'"\\s+content="([\\d.]+)"').exec(html),verified=match?.[1];
   if(verified!==remote&&!newer(verified,remote)){lastError='Die neue Version wird noch bereitgestellt.';return false;}
   if(startup&&document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
   lastError=guard();if(lastError)return false;
   // Versioned resources bypass the old cache; do not delay startup for SW activation.
   try{void g.navigator?.serviceWorker?.getRegistration().then(r=>r?.update()).catch(()=>{});}catch{}
   url.searchParams.set(parameter,verified);redirecting=true;if(startup)pending=true;g.location.replace(url.href);return true;
  }catch{lastError='Aktualisierung nicht möglich. Bitte später erneut versuchen.';return false;}})();
  try{return await applying;}finally{applying=null;}
 }
 function start({guard=()=>''}={}){
  if(pending&&api.ready)return api.ready;pending=true;
  api.ready=apply({startup:true,guard}).then(reloading=>{if(!reloading)pending=false;return reloading;},()=>{pending=false;return false;});return api.ready;
 }
 const api={check,apply,start,newer,get pending(){return pending;},get redirecting(){return redirecting;},get error(){return lastError;}};g.AppRelease=api;
 start();
})(globalThis);
