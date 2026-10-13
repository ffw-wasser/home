/* UI updates are separate from account refreshes; private fragments stay local. */
(function(g){
 'use strict';const $=id=>document.getElementById(id);let busy=false;
 async function check(){if(busy||document.hidden)return;const build=document.querySelector('meta[name="deckel-build"]')?.content;if(!build)return;busy=true;try{const response=await fetch('app-release.json?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const value=await response.json();if(!/^\d{8}\.\d+$/.test(value.build||'')||value.build===build)return;$('deckel-update-banner').hidden=false;$('deckel-update-message').textContent='Eine neue Deckel-Ansicht ist verfügbar. Bitte die Ansicht neu laden.';}catch{/* An unavailable update check never blocks the account. */}finally{busy=false;}}
 function reload(){if(g.DeckelActions?.hasUnsaved?.()){$('deckel-update-banner').hidden=false;$('deckel-update-message').textContent='Bitte vorgemerkte Getränke zuerst speichern oder verwerfen. Bei einem versendeten Vorgang zunächst die Bestätigung abwarten.';return;}g.location.reload();}
 function init(){for(const id of ['deckel-update-now','deckel-update-reload'])$(id).onclick=reload;check();g.setInterval(()=>{if(!document.hidden)check();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});}
 g.DeckelUpdate={check,reload};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
