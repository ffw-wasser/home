'use strict';
(function(){
 const by=id=>document.getElementById(id);
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const android=/Android/i.test(navigator.userAgent);
 let pending=null,busy=false,installed=false,registered=false;
 function standalone(){return Boolean(navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches);}
 function personal(){try{const p=new URLSearchParams(location.hash.slice(1)),repo=p.get('r');return /^ffw-wasser\/[A-Za-z0-9_.-]+$/.test(repo||'')&&repo!=='ffw-wasser/home'&&/^[a-f0-9]{32}$/.test(p.get('a')||'')&&/^[a-f0-9]{64}$/.test(p.get('k')||'');}catch{return false;}}
 function steps(values){const list=by('installSteps');list.replaceChildren();for(const value of values){const li=document.createElement('li');li.textContent=value;list.append(li);}}
 function refresh(){
  const show=personal()&&!standalone()&&!installed;by('installSection').hidden=!show;if(!show)return;
  by('installButton').hidden=ios;by('installButton').disabled=busy;
  by('installButton').textContent=pending?'Deckel installieren':'Deckel auf dem Handy speichern';
  steps(ios?['Auf „Teilen“ tippen.','„Zum Home-Bildschirm“ auswählen und „Hinzufügen“ bestätigen.','Den Bierdeckel auf dem Home-Bildschirm öffnen. Dort kannst du Erinnerungen erlauben.']:
   ['Auf die Schaltfläche unten tippen.','Die Installation bestätigen. Falls kein Dialog erscheint: Im Browser-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.','Den Bierdeckel auf dem Home-Bildschirm öffnen und bei Bedarf Erinnerungen erlauben.']);
  if(!registered&&'serviceWorker' in navigator){registered=true;navigator.serviceWorker.register('service-worker.js').catch(()=>{registered=false;});}
 }
 async function install(){
  if(busy||!personal())return;busy=true;by('installButton').disabled=true;by('installStatus').textContent='';
  try{
   // Explicit click: persist the personal URL only locally, never in a manifest or network request.
   await DeckelDevice.saveLink(location.href);
   if(!pending){by('installStatus').textContent='Dein Zugang ist auf diesem Handy gespeichert. Öffne jetzt das Browser-Menü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.';return;}
   const prompt=pending;pending=null;await prompt.prompt();const choice=await prompt.userChoice;
   by('installStatus').textContent=choice.outcome==='accepted'?'Installation bestätigt. Öffne deinen Deckel über das Bierdeckel-Symbol.':'Du kannst den Deckel später über das Browser-Menü hinzufügen.';
  }catch{by('installStatus').textContent='Der Deckel konnte nicht auf diesem Handy gespeichert werden. Bitte Gerätespeicher erlauben und erneut versuchen.';}
  finally{busy=false;refresh();}
 }
 addEventListener('beforeinstallprompt',event=>{if(!personal()||standalone())return;event.preventDefault();pending=event;refresh();});
 addEventListener('appinstalled',()=>{if(!personal())return;installed=true;pending=null;DeckelDevice.saveLink(location.href).catch(()=>{});refresh();});
 addEventListener('hashchange',refresh);
 if(android)by('deckelManifest').href='deckel-android.webmanifest';
 by('installButton').onclick=install;
 window.DeckelInstall={refresh};refresh();
})();
