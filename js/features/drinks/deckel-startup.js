/* Cover the initial portal assembly and the privacy reset on backgrounding. */
(function(global){
 'use strict';
 const screen=document.getElementById('h2oStartup');if(!screen)return;
 const status=document.getElementById('h2oStartupStatus'),retry=document.getElementById('h2oStartupRetry'),surfaces=()=>[document.querySelector('.deckel-header'),document.getElementById('deckel-main'),document.getElementById('deckel-nav')].filter(Boolean);
 let epoch=0,active=false,fading=false,slowTimer=null,hideTimer=null;
 function slow(message='Die Verbindung dauert länger. Bitte einen Moment warten oder erneut öffnen.'){
  if(!active)return;status.textContent=message;retry.hidden=false;screen.classList.add('is-slow');
 }
 function begin(){
  const token=++epoch;active=true;fading=false;clearTimeout(slowTimer);clearTimeout(hideTimer);screen.hidden=false;screen.classList.remove('is-leaving','is-slow');document.body.classList.add('h2o-starting');
  for(const node of surfaces()){node.inert=true;node.setAttribute('aria-busy','true');}
  status.textContent='Anmeldung wird geprüft …';retry.hidden=true;slowTimer=setTimeout(()=>slow(),7000);return token;
 }
 function stage(token,message){if(active&&token===epoch)status.textContent=message;}
 function finish(token){
  if(!active||fading||token!==epoch||document.hidden)return;
  fading=true;clearTimeout(slowTimer);clearTimeout(hideTimer);document.body.classList.remove('h2o-starting');screen.classList.add('is-leaving');
  const reveal=()=>{if(token!==epoch||document.hidden)return;active=false;fading=false;screen.hidden=true;document.body.classList.remove('h2o-starting');for(const node of surfaces()){node.inert=false;node.removeAttribute('aria-busy');}};
  if(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)reveal();else hideTimer=setTimeout(reveal,180);
 }
 retry.addEventListener('click',()=>global.location.reload());
 global.addEventListener('error',event=>{if(event.target?.tagName==='SCRIPT')slow('Die App konnte nicht vollständig geladen werden. Bitte erneut öffnen.');},true);
 global.DeckelStartup={begin,stage,finish};begin();stage(epoch,'Die App wird geöffnet …');
})(globalThis);
