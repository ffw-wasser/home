/* Guided entry reuses identity controls and their existing security handlers. */
(function(g){
 'use strict';
 let dialog,content,title,progress,back,next,step='welcome',first=false,setupFinished=false,method='passkey',mounted=false,ticketFromQR=false;
 const homes=new Map(),$=id=>document.getElementById(id);
 const hasRelease=()=>/^[\w-]{43}$/.test($('identity-code')?.value.trim()||'');
 const order=['welcome','release','method','access','install','options','finish'];
 function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
 function restore(){for(const [item,home] of homes){home.after(item);home.remove();item.hidden=false;}homes.clear();}
 function place(id){const item=$(id);if(!item)return;if(!homes.has(item)){const home=document.createComment('onboarding home');item.before(home);homes.set(item,home);}item.hidden=false;content.append(item);return item;}
 function say(text){content.append(node('p',text));}
 function choice(text,action){const b=node('button',text);b.type='button';b.onclick=action;content.append(b);return b;}
 function go(value){step=value;render();}
 function close(){restore();dialog.close();g.H2OIdentity?.refresh();g.DeckelMobile?.jump('portal-section');}
 function render(){
  if(!mounted||!dialog.open)return;
  restore();content.replaceChildren();
  progress.textContent=first||setupFinished?'Schritt '+(order.indexOf(step)+1)+' von '+order.length:'Dein persönlicher Zugang';
  title.textContent={welcome:'Willkommen im H₂O Portal',release:'Freigabe der Verwaltung',method:'Anmeldung auswählen',access:method==='passkey'?'Mit Passkey fortfahren':'Mit Passwort fortfahren',install:'H₂O auf dem Home-Bildschirm',options:'Kalender & Benachrichtigungen',finish:'Alles bereit'}[step];
  back.hidden=step==='welcome';next.hidden=true;
  if(step==='welcome'){
   say('Ein Portal für iPhone, Android, iPad und PC.');
   choice('Bereits eingerichtet',()=>{first=false;go('method');});
   choice('Erstmals einrichten',()=>{first=true;go(hasRelease()?'method':'release');});
   choice('Zugang verloren',()=>{first=true;go(hasRelease()?'method':'release');});
   choice('Ausbildung & Hilfe ohne Anmeldung',()=>{close();$('portal-offline-open')?.click();});
  }else if(step==='release'){
   say('Bitte die Verwaltung um eine einmalige Freigabe bitten. Sie prüft deine Identität. Bei verlorenem Zugang lässt du den bisherigen Zugang sperren.');
   const setup=place('identity-setup');setup.open=true;
   next.hidden=false;next.textContent='Weiter';next.onclick=()=>{
    if(!/^[\w-]{43}$/.test($('identity-code').value.trim())){$('identity-message').textContent='Bitte die gültige Freigabe der Verwaltung eingeben.';return;}
    $('identity-message').textContent='';go('method');
   };
  }else if(step==='method'){
   if(first&&hasRelease()){
    say('Willkommen! Dein persönlicher Willkommenslink wurde übernommen. Du musst keinen Code eingeben. Wähle jetzt deine Anmeldeart.');
    const device=g.DeckelInstall?.profile();if(device){say('Erkannt: '+device.label+'. Nach der Anmeldung führen wir dich durch die passende Installation.');if(device.embedded){say('Bitte zuerst im normalen Browser öffnen: auf iPhone und iPad in Safari, auf Android etwa in Chrome. Die Freigabe bleibt im folgenden Link enthalten.');choice('Willkommenslink für den Browser kopieren',async()=>{const url=new URL('deckel.html',location.href);url.search='';url.hash='setup='+$('identity-code').value.trim();try{await navigator.clipboard.writeText(url.href);$('identity-message').textContent='Link kopiert. Im normalen Browser in die Adressleiste einfügen.';}catch{$('identity-message').textContent='Bitte die E-Mail erneut öffnen und den Willkommenslink über das Menü im Browser öffnen.';}});}}
   }
   choice('Passkey · Gesicht, Fingerabdruck oder Geräte-PIN',()=>{method='passkey';go('access');});
   choice('Benutzername und Passwort',()=>{method='password';go('access');});
   if(first&&hasRelease())choice('Andere Freigabe verwenden',()=>{ticketFromQR=false;$('identity-code').value='';$('identity-message').textContent='';go('release');});
  }else if(step==='access'){
   if(first){
    say('Die Freigabe wird erst beim erfolgreichen Einrichten verbraucht.');
    if(method==='passkey')place('identity-register');else place('identity-password-settings').open=true;
   }else if(method==='passkey')place('identity-login');else place('identity-password-login-form');
   choice('Zugang verloren?',()=>{first=true;go(hasRelease()?'method':'release');});
  }else if(step==='install'){
   g.DeckelInstall?.refresh();if($('installSection')?.hidden)say('Du kannst H₂O über dein vorhandenes App-Symbol oder direkt im Browser öffnen.');else place('installSection').open=true;
   next.hidden=false;next.textContent='Weiter / überspringen';next.onclick=()=>go('options');
  }else if(step==='options'){
   say('Benachrichtigungen kannst du freiwillig aktivieren. Auf dem iPhone öffnest du H₂O dafür zuerst über das Symbol auf dem Home-Bildschirm.');
   const push=$('portal-push-heading')?.closest('section');if(push)place(push.id||(push.id='onboarding-push-settings'));
   say('Dein persönliches H₂O-Kalenderabo findest du unter Konto & Sicherheit. Es enthält die für dich freigegebenen Termine. Für H₂O brauchst du kein Google-Konto.');
   next.hidden=false;next.textContent='Weiter / überspringen';next.onclick=()=>go('finish');
  }else{
   say('Deine Anmeldung ist eingerichtet. Öffne H₂O zum Prüfen über das neue Symbol. Falls du die Installation übersprungen hast, kannst du weiter im Browser arbeiten. Weitere Einstellungen und die Installationshilfe findest du unter Mehr → Konto & Sicherheit.');
   next.hidden=false;next.textContent='Zu den Terminen';next.onclick=close;
  }
  place('identity-message');title.focus();
 }
 function init(hasTicket){
  if(mounted||g.H2OIdentity?.session())return;
  mounted=true;dialog=node('dialog');dialog.id='h2o-onboarding';dialog.className='h2o-onboarding';dialog.setAttribute('aria-labelledby','h2o-onboarding-title');
  progress=node('p');progress.setAttribute('aria-live','polite');title=node('h2');title.id='h2o-onboarding-title';title.tabIndex=-1;content=node('div');
  const nav=node('nav');nav.setAttribute('aria-label','Einrichtung');back=node('button','Zurück');next=node('button','Weiter');back.type=next.type='button';
  back.onclick=()=>{if(step==='method')go(first&&!ticketFromQR?'release':'welcome');else if(step==='access')go('method');else if(step==='install')close();else go(order[Math.max(0,order.indexOf(step)-1)]);};
  nav.append(back,next);dialog.append(progress,title,content,nav);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.showModal();if(hasTicket&&hasRelease()){first=true;ticketFromQR=true;step='method';}render();
 }
 g.H2OOnboarding={init,refresh(){if(dialog?.open)render();},accessReady(){if(!dialog?.open)return;setupFinished=true;first=false;go('access');},signedIn(){if(!dialog?.open)return;if(first||setupFinished)go('install');else close();}};
})(globalThis);
