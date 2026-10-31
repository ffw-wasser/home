'use strict';
(function(){
 const by=id=>document.getElementById(id);
 const native=()=>/\bH2ONative\/1\b/.test(navigator.userAgent);
 const isIos=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const isAndroid=()=>/Android/i.test(navigator.userAgent);
 let pending=null,busy=false,installed=false,registered=false,step=0,override='';
 function profile(){
  const ua=navigator.userAgent,ios=isIos(),android=isAndroid(),app=standalone()||native();
  const browser=ios&&app?'Safari':/Edg\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung Internet':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Browser';
  const embedded=!app&&(/FBAN|FBAV|Instagram|GSA\/|; wv\)|WebView|Outlook/i.test(ua)||(ios&&!/Safari|CriOS|FxiOS|EdgiOS/.test(ua)));
  return {platform:override||(ios?'ios':android?'android':'desktop'),browser,embedded,label:(ios?'iPhone / iPad':android?'Android':/Macintosh/.test(ua)?'Mac':'Computer')+' · '+browser};
 }
 function instructions(p){
  if(p.platform==='ios')return ['Unten in Safari auf die waagerechten Striche tippen (Seitenmenü; je nach Ansicht „…“).','Im geöffneten Menü „Teilen“ wählen – das Quadrat mit dem Pfeil ↑.','Nach unten scrollen. „Zu Home-Bildschirm hinzufügen“ wählen (auch „Zum Home-Bildschirm“ genannt).','„Als Web-App öffnen“ eingeschaltet lassen, falls angezeigt. Oben „Hinzufügen“ antippen.'];
  if(p.platform==='android')return [p.browser==='Samsung Internet'?'Öffne das Browser-Menü ☰.':'Öffne das Browser-Menü ⋮.','Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.','Bestätige mit „Installieren“ oder „Hinzufügen“.','Öffne das neue H₂O-Symbol. Melde dich bei Bedarf mit demselben Zugang an.'];
  if(p.browser==='Safari')return ['Öffne in Safari das Menü „Ablage“.','Wähle „Zum Dock hinzufügen“. Fehlt der Eintrag, nutze ein Lesezeichen.','Bestätige mit „Hinzufügen“.','Öffne H₂O über das neue Symbol.'];
  if(!['Chrome','Edge'].includes(p.browser))return ['Öffne das Lesezeichen-Menü deines Browsers.','Speichere diese Seite als Lesezeichen.','Öffne H₂O später über dieses Lesezeichen.'];
  return ['Klicke in Chrome oder Edge auf das Installationssymbol in der Adressleiste.','Bestätige mit „Installieren“.','Öffne H₂O über das neue Symbol.'];
 }
 function standalone(){return Boolean(navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches);}
 function personal(){if(globalThis.H2OIdentity?.session?.())return true;try{const p=new URLSearchParams(location.hash.slice(1)),repo=p.get('r');return /^ffw-wasser\/[A-Za-z0-9_.-]+$/.test(repo||'')&&repo!=='ffw-wasser/home'&&/^[a-f0-9]{32}$/.test(p.get('a')||'')&&/^[a-f0-9]{64}$/.test(p.get('k')||'');}catch{return false;}}
 function steps(values){const list=by('installSteps');list.replaceChildren();for(const value of values){const li=document.createElement('li');li.textContent=value;list.append(li);}}
 function refresh(){
  const retired=by('nativeRetired');if(retired)retired.hidden=!native()||Boolean(globalThis.webkit?.messageHandlers?.h2oNotifications);
  if(native()){by('installSection').hidden=true;return;}
  if(!registered&&'serviceWorker' in navigator){registered=true;navigator.serviceWorker.register('service-worker.js').catch(()=>{registered=false;});}
  const show=!standalone()&&!installed;by('installSection').hidden=!show;if(!show)return;
  const p=profile(),values=instructions(p),systemGuide=p.platform==='ios';step=Math.min(step,values.length-1);
  by('installSection').classList?.toggle('is-system-guide',systemGuide);
  if(by('installAfterSteps'))by('installAfterSteps').hidden=!systemGuide;
  if(by('installIllustration'))by('installIllustration').hidden=p.platform!=='ios';
  if(by('installPlatform')){by('installPlatform').value=override;by('installDetected').textContent='Erkannt: '+p.label+(p.embedded?' · Möglicherweise innerhalb einer anderen App. Bitte im normalen Browser öffnen.':'');}
  by('installButton').hidden=p.platform==='ios'||!personal()||!pending||step>0;by('installButton').disabled=busy;
  by('installButton').textContent=!pending&&globalThis.H2OIdentity?.session?.()?'Anleitung zum Startsymbol':pending?'H₂O Portal installieren':'H₂O Portal auf dem Handy speichern';
  steps(values);
  if(by('installProgress')){by('installProgress').hidden=systemGuide;by('installProgress').textContent='Schritt '+(step+1)+' von '+values.length;Array.from(by('installSteps').children).forEach((item,index)=>item.hidden=!systemGuide&&index!==step);by('installBack').hidden=by('installNext').hidden=systemGuide;by('installBack').disabled=step===0;by('installNext').disabled=step===values.length-1;}
 }
 async function install(){
  if(busy||!personal())return false;busy=true;by('installButton').disabled=true;by('installStatus').textContent='';
  try{
   // Explicit click: persist the personal URL only locally, never in a manifest or network request.
   const personalURL=new URL(location.href);personalURL.search='';if(!globalThis.H2OIdentity?.session?.())await DeckelDevice.saveLink(personalURL.href);
   if(!pending){by('installStatus').textContent=(globalThis.H2OIdentity?.session?.()?'Du bist in diesem Browser angemeldet. ':'Dein Zugang ist auf diesem Handy gespeichert. ')+'Öffne jetzt in Chrome oder deinem Browser das Menü und wähle „Zum Startbildschirm hinzufügen“.';return false;}
   const prompt=pending;pending=null;await prompt.prompt();const choice=await prompt.userChoice;
   by('installStatus').textContent=choice.outcome==='accepted'?'Installation bestätigt. Öffne das H₂O Portal über das neue Symbol.':'Du kannst H₂O über das Browser-Menü hinzufügen.';
   return choice.outcome==='accepted';
  }catch{by('installStatus').textContent='Die Installation konnte nicht gestartet werden. Bitte das Browser-Menü verwenden.';return false;}
  finally{busy=false;refresh();}
 }
 addEventListener('beforeinstallprompt',event=>{if(standalone())return;event.preventDefault();pending=event;refresh();globalThis.H2OOnboarding?.refresh();});
 addEventListener('appinstalled',()=>{if(!personal())return;installed=true;pending=null;if(!globalThis.H2OIdentity?.session?.())DeckelDevice.saveLink(location.href.split('?')[0].split('#')[0]+location.hash).catch(()=>{});refresh();globalThis.H2OOnboarding?.refresh();});
 addEventListener('hashchange',refresh);
 by('installButton').onclick=install;
 if(by('installPlatform'))by('installPlatform').onchange=()=>{override=by('installPlatform').value;step=0;refresh();};
 function currentStep(){const p=profile();return {index:step,total:instructions(p).length,systemGuide:p.platform==='ios'};}
 function moveStep(direction){step=Math.max(0,Math.min(instructions(profile()).length-1,step+direction));refresh();}
 if(by('installBack'))by('installBack').onclick=()=>moveStep(-1);
 if(by('installNext'))by('installNext').onclick=()=>moveStep(1);
 window.DeckelInstall={refresh,profile,instructions,currentStep,moveStep,isStandalone:()=>native()||standalone(),canInstall:()=>Boolean(pending&&!busy&&!standalone()&&personal()),install};refresh();
})();
