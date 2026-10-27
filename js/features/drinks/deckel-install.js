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
  by('installButton').hidden=isIos()||!personal();by('installButton').disabled=busy;
  by('installButton').textContent=isAndroid()?(globalThis.H2OIdentity?.session?.()?'Anleitung zum Startsymbol':'Zugang auf diesem Handy sichern'):pending?'H₂O Portal installieren':'H₂O Portal auf dem Handy speichern';
  steps(isIos()?['Das Portal in Safari öffnen. Im Menü auf „Teilen“ tippen.','„Zum Home-Bildschirm hinzufügen“ wählen, falls angeboten „Als Web-App öffnen“ einschalten und „Hinzufügen“ bestätigen.','Das H₂O-Symbol öffnen. Falls erneut gefragt, mit deinem Passkey oder Passwort anmelden. Eine neue Freigabe ist dafür nicht erforderlich.']:
   isAndroid()?['Das Portal in Google Chrome öffnen.','Im Menü ⋮ „Zum Startbildschirm hinzufügen“ oder „Installieren und Verknüpfung erstellen“ wählen. Eine Verknüpfung erstellen, keine APK aus anderen Quellen installieren.','Das H₂O-Symbol öffnen und bei Bedarf mit deinem Passkey oder Passwort anmelden. Bei einer Play-Protect-Warnung abbrechen, den Schutz eingeschaltet lassen und das Portal im Browser nutzen.']:
   ['Das Portal kann direkt im Browser genutzt und als Lesezeichen gespeichert werden.','Wenn der Browser eine Installation anbietet, kannst du das H₂O-Symbol zusätzlich einrichten.','Mit deinem persönlichen Passkey oder Passwort anmelden. Die Installation ist freiwillig.']);
 }
 async function install(){
  if(busy||!personal())return;busy=true;by('installButton').disabled=true;by('installStatus').textContent='';
  try{
   // Explicit click: persist the personal URL only locally, never in a manifest or network request.
   const personalURL=new URL(location.href);personalURL.search='';if(!globalThis.H2OIdentity?.session?.())await DeckelDevice.saveLink(personalURL.href);
   if(isAndroid()){by('installStatus').textContent=(globalThis.H2OIdentity?.session?.()?'Du bist in diesem Browser angemeldet. ':'Persönlicher Zugang lokal gespeichert. ')+'In Chrome ⋮ → „Zum Startbildschirm hinzufügen“ oder „Installieren und Verknüpfung erstellen“ → Verknüpfung erstellen. Bei einer Play-Protect-Warnung abbrechen und das Portal im Browser öffnen.';return;}
   if(!pending){by('installStatus').textContent='Dein Zugang ist auf diesem Handy gespeichert. Öffne jetzt das Browser-Menü und wähle „Zum Startbildschirm hinzufügen“.';return;}
   const prompt=pending;pending=null;await prompt.prompt();const choice=await prompt.userChoice;
   by('installStatus').textContent=choice.outcome==='accepted'?'Installation bestätigt. Öffne das H₂O Portal über das neue Symbol.':'Du kannst den Deckel später über das Browser-Menü hinzufügen.';
  }catch{by('installStatus').textContent='Der Deckel konnte nicht auf diesem Handy gespeichert werden. Bitte Gerätespeicher erlauben und erneut versuchen.';}
  finally{busy=false;refresh();}
 }
 addEventListener('beforeinstallprompt',event=>{if(isAndroid()){event.preventDefault();return;}if(!personal()||standalone())return;event.preventDefault();pending=event;refresh();});
 addEventListener('appinstalled',()=>{if(!personal())return;installed=true;pending=null;if(!globalThis.H2OIdentity?.session?.())DeckelDevice.saveLink(location.href.split('?')[0].split('#')[0]+location.hash).catch(()=>{});refresh();});
 addEventListener('hashchange',refresh);
 by('installButton').onclick=install;
 window.DeckelInstall={refresh};refresh();
})();
