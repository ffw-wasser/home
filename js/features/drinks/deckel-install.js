'use strict';
(function(){
 const by=id=>document.getElementById(id);
 const native=()=>/\bH2ONative\/1\b/.test(navigator.userAgent);
 const isIos=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const isAndroid=()=>/Android/i.test(navigator.userAgent);
 let pending=null,busy=false,installed=false,registered=false;
 function standalone(){return Boolean(navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches);}
 function personal(){if(globalThis.H2OIdentity?.session?.())return true;try{const p=new URLSearchParams(location.hash.slice(1)),repo=p.get('r');return /^ffw-wasser\/[A-Za-z0-9_.-]+$/.test(repo||'')&&repo!=='ffw-wasser/home'&&/^[a-f0-9]{32}$/.test(p.get('a')||'')&&/^[a-f0-9]{64}$/.test(p.get('k')||'');}catch{return false;}}
 function steps(values){const list=by('installSteps');list.replaceChildren();for(const value of values){const li=document.createElement('li');li.textContent=value;list.append(li);}}
 function refresh(){
  const retired=by('nativeRetired');if(retired)retired.hidden=!native();
  if(native()){by('installSection').hidden=true;return;}
  if(!registered&&'serviceWorker' in navigator){registered=true;navigator.serviceWorker.register('service-worker.js').catch(()=>{registered=false;});}
  const show=!standalone()&&!installed;by('installSection').hidden=!show;if(!show)return;
  if(by('installIllustration'))by('installIllustration').hidden=!isIos();
  by('installButton').hidden=isIos()||!personal();by('installButton').disabled=busy;
  by('installButton').textContent=!pending&&globalThis.H2OIdentity?.session?.()?'Anleitung zum Startsymbol':pending?'H₂O Portal installieren':'H₂O Portal auf dem Handy speichern';
  steps(isIos()?['Auf „Teilen“ tippen.','„Zum Home-Bildschirm“ auswählen und „Hinzufügen“ bestätigen.','Das H₂O Portal auf dem Home-Bildschirm öffnen. Dort findest du Termine, Rückmeldungen und deinen Deckel.']:
   ['Wenn dein Browser die Installation unterstützt, öffnet „H₂O Portal installieren“ den Installationsdialog.','Alternativ im Browser-Menü ⋮ „Zum Startbildschirm hinzufügen“ wählen.','Falls Google Play Protect warnt: Installation abbrechen, Schutz nicht ausschalten und das Portal im Browser nutzen.']);
 }
 async function install(){
  if(busy||!personal())return;busy=true;by('installButton').disabled=true;by('installStatus').textContent='';
  try{
   // Explicit click: persist the personal URL only locally, never in a manifest or network request.
   const personalURL=new URL(location.href);personalURL.search='';if(!globalThis.H2OIdentity?.session?.())await DeckelDevice.saveLink(personalURL.href);
   if(!pending){by('installStatus').textContent=(globalThis.H2OIdentity?.session?.()?'Du bist in diesem Browser angemeldet. ':'Dein Zugang ist auf diesem Handy gespeichert. ')+'Öffne jetzt in Chrome oder deinem Browser das Menü und wähle „Zum Startbildschirm hinzufügen“.';return;}
   const prompt=pending;pending=null;await prompt.prompt();const choice=await prompt.userChoice;
   by('installStatus').textContent=choice.outcome==='accepted'?'Installation bestätigt. Öffne das H₂O Portal über das neue Symbol.':'Du kannst den Deckel später über das Browser-Menü hinzufügen.';
  }catch{by('installStatus').textContent='Der Deckel konnte nicht auf diesem Handy gespeichert werden. Bitte Gerätespeicher erlauben und erneut versuchen.';}
  finally{busy=false;refresh();}
 }
 addEventListener('beforeinstallprompt',event=>{if(standalone())return;event.preventDefault();pending=event;refresh();});
 addEventListener('appinstalled',()=>{if(!personal())return;installed=true;pending=null;if(!globalThis.H2OIdentity?.session?.())DeckelDevice.saveLink(location.href.split('?')[0].split('#')[0]+location.hash).catch(()=>{});refresh();});
 addEventListener('hashchange',refresh);
 by('installButton').onclick=install;
 window.DeckelInstall={refresh};refresh();
})();
