/* Optional presentation only: authentication and privacy stay with their owners. */
(function(global){
 'use strict';
 const screen=document.getElementById('h2oStartup');if(!screen)return;
 const status=document.getElementById('h2oStartupStatus'),retry=document.getElementById('h2oStartupRetry'),surfaces=()=>[document.querySelector('.deckel-header'),document.getElementById('deckel-main'),document.getElementById('deckel-nav')].filter(Boolean);
 let epoch=0,active=false,fading=false,deadlineTimer=null,hideTimer=null;
 function release(token){
  if(!active||token!==epoch)return;
  if(global.AppRelease?.pending){global.AppRelease.ready.then(reloading=>{if(!reloading)release(token);});return;}
  clearTimeout(deadlineTimer);clearTimeout(hideTimer);active=false;fading=false;screen.hidden=true;document.body.classList.remove('h2o-starting');
  for(const node of surfaces()){node.inert=false;node.removeAttribute('aria-busy');}
 }
 function begin(){
  const token=++epoch;active=true;fading=false;clearTimeout(deadlineTimer);clearTimeout(hideTimer);screen.hidden=false;screen.classList.remove('is-leaving','is-slow');document.body.classList.add('h2o-starting');
  for(const node of surfaces()){node.inert=true;node.setAttribute('aria-busy','true');}
  status.textContent=global.AppRelease?.pending?'Updates werden geprüft und geladen …':'Anmeldung wird geprüft …';retry.hidden=true;
  // A stalled data request or suspended fade must never lock the application.
  deadlineTimer=setTimeout(()=>release(token),4000);return token;
 }
 function stage(token,message){if(active&&token===epoch)status.textContent=global.AppRelease?.pending?'Updates werden geprüft und geladen …':message;}
 function finish(token){
  if(!active||fading||token!==epoch||document.hidden)return;
  if(global.AppRelease?.pending){global.AppRelease.ready.then(reloading=>{if(!reloading)finish(token);});return;}
  fading=true;clearTimeout(hideTimer);document.body.classList.remove('h2o-starting');screen.classList.add('is-leaving');
  if(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)release(token);else hideTimer=setTimeout(()=>release(token),180);
 }
 retry.addEventListener('click',()=>global.location.reload());
 global.addEventListener('error',event=>{if(active&&event.target?.tagName==='SCRIPT'){status.textContent='Die App konnte nicht vollständig geladen werden. Bitte erneut öffnen.';retry.hidden=false;}},true);
 global.DeckelStartup={begin,stage,finish,isActive:()=>active};begin();stage(epoch,'Die App wird geöffnet …');
})(globalThis);
