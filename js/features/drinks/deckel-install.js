'use strict';
(function(){
 const by=id=>document.getElementById(id);
 const native=()=>/\bH2ONative\/1\b/.test(navigator.userAgent);
 const isIos=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const isAndroid=()=>/Android/i.test(navigator.userAgent);
 let pending=null,busy=false,installed=false,registered=false,step=0,override='';
 function profile(){
  const ua=navigator.userAgent,ios=isIos(),android=isAndroid();
  const browser=/Edg\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung Internet':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Browser';
  const embedded=/FBAN|FBAV|Instagram|GSA\/|; wv\)|WebView|Outlook/i.test(ua)||(ios&&!/Safari|CriOS|FxiOS|EdgiOS/.test(ua));
  return {platform:override||(ios?'ios':android?'android':'desktop'),browser,embedded,label:(ios?'iPhone / iPad':android?'Android':/Macintosh/.test(ua)?'Mac':'Computer')+' · '+browser};
 }
 function instructions(p){
  if(p.platform==='ios')return ['Den persönlichen Link in Safari öffnen. Falls du schon angemeldet bist: Bei einem Browserwechsel mit demselben Passkey oder Passwort anmelden.','Auf „Teilen“ tippen (gegebenenfalls zuerst das Seitenmenü öffnen) und „Zum Home-Bildschirm“ wählen. Falls angezeigt, „Als Web-App öffnen“ einschalten und „Hinzufügen“ bestätigen.','Das neue H₂O-Symbol auf dem Home-Bildschirm öffnen. Falls eine Anmeldung erscheint, denselben Passkey oder Benutzernamen und dasselbe Passwort verwenden. Termine und deinen persönlichen Zugang prüfen.'];
  if(p.platform==='android')return ['Den Link in Chrome, Samsung Internet oder deinem normalen Browser öffnen. In einer E-Mail-App zuerst „Im Browser öffnen“ wählen.','Wenn verfügbar, unten „H₂O Portal installieren“ antippen. Sonst im Browser-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen und bestätigen. Falls Google Play Protect warnt: Installation abbrechen und H₂O im Browser nutzen.','Das neue H₂O-Symbol öffnen. Falls nötig, mit demselben Passkey oder Passwort anmelden und deinen persönlichen Zugang prüfen.'];
  return ['Den Link in deinem normalen Browser öffnen. Du kannst H₂O auch direkt im Browser nutzen.','In Chrome oder Edge die Installationsschaltfläche unten oder das Installationssymbol in der Adressleiste verwenden. Auf dem Mac in Safari, falls angeboten, „Ablage → Zum Dock hinzufügen“ wählen. Fehlt die Funktion, ein Lesezeichen setzen.','H₂O über das neue Symbol oder Lesezeichen öffnen. Falls nötig, mit demselben Passkey oder Passwort anmelden und deinen persönlichen Zugang prüfen.'];
 }
 function standalone(){return Boolean(navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches);}
 function personal(){if(globalThis.H2OIdentity?.session?.())return true;try{const p=new URLSearchParams(location.hash.slice(1)),repo=p.get('r');return /^ffw-wasser\/[A-Za-z0-9_.-]+$/.test(repo||'')&&repo!=='ffw-wasser/home'&&/^[a-f0-9]{32}$/.test(p.get('a')||'')&&/^[a-f0-9]{64}$/.test(p.get('k')||'');}catch{return false;}}
 function steps(values){const list=by('installSteps');list.replaceChildren();for(const value of values){const li=document.createElement('li');li.textContent=value;list.append(li);}}
 function refresh(){
  const retired=by('nativeRetired');if(retired)retired.hidden=!native();
  if(native()){by('installSection').hidden=true;return;}
  if(!registered&&'serviceWorker' in navigator){registered=true;navigator.serviceWorker.register('service-worker.js').catch(()=>{registered=false;});}
  const show=!standalone()&&!installed;by('installSection').hidden=!show;if(!show)return;
  const p=profile(),values=instructions(p);
  if(by('installIllustration'))by('installIllustration').hidden=p.platform!=='ios';
  if(by('installPlatform')){by('installPlatform').value=override;by('installDetected').textContent='Erkannt: '+p.label+(p.embedded?' · Möglicherweise innerhalb einer anderen App. Bitte im normalen Browser öffnen.':'');}
  by('installButton').hidden=p.platform==='ios'||!personal();by('installButton').disabled=busy;
  by('installButton').textContent=!pending&&globalThis.H2OIdentity?.session?.()?'Anleitung zum Startsymbol':pending?'H₂O Portal installieren':'H₂O Portal auf dem Handy speichern';
  steps(values);
  if(by('installProgress')){by('installProgress').textContent='Schritt '+(step+1)+' von '+values.length;Array.from(by('installSteps').children).forEach((item,index)=>item.hidden=index!==step);by('installBack').disabled=step===0;by('installNext').disabled=step===values.length-1;}
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
 if(by('installPlatform'))by('installPlatform').onchange=()=>{override=by('installPlatform').value;step=0;refresh();};
 if(by('installBack'))by('installBack').onclick=()=>{step=Math.max(0,step-1);refresh();};
 if(by('installNext'))by('installNext').onclick=()=>{step=Math.min(2,step+1);refresh();};
 window.DeckelInstall={refresh,profile,instructions};refresh();
})();
