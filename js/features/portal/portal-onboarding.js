/* One task per screen; keep the existing identity controls and security handlers. */
(function(g){
 'use strict';
 let dialog,content,title,progress,back,next,later,step='welcome',first=false,setupFinished=false,method='passkey',mounted=false,ticketFromLink=false;
 const homes=new Map(),$=id=>document.getElementById(id);
 const hasRelease=()=>/^[\w-]{43}$/.test($('identity-code')?.value.trim()||'');
 function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
 function restore(){for(const [item,home] of homes){home.after(item);home.remove();item.hidden=false;}homes.clear();}
 function place(id){const item=$(id);if(!item)return;if(!homes.has(item)){const home=document.createComment('onboarding home');item.before(home);homes.set(item,home);}item.hidden=false;content.append(item);return item;}
 function say(text){content.append(node('p',text));}
 function choice(text,action,parent=content){const b=node('button',text);b.type='button';b.className='onboarding-secondary';b.onclick=action;parent.append(b);return b;}
 function help(){const details=node('details'),summary=node('summary','Brauchst du Hilfe?');details.append(summary);content.append(details);return details;}
 function go(value){step=value;render();}
 function close(){restore();dialog.close();g.H2OIdentity?.refresh();g.DeckelMobile?.jump('portal-section');}
 function release(){ticketFromLink=false;$('identity-code').value='';$('identity-message').textContent='';first=true;go('release');}
 function render(){
  if(!mounted||!dialog.open)return;
  restore();content.replaceChildren();dialog.dataset.step=step;
  progress.textContent=first||setupFinished?'Dein Zugang':'H₂O Portal';
  title.textContent={welcome:'Willkommen',release:'Einladung öffnen',method:first?'Zugang einrichten':'Anmelden',access:first?'Passwort wählen':'Jetzt anmelden',install:'App-Symbol hinzufügen',finish:'Fertig!'}[step];
  back.hidden=step==='welcome'||step==='finish'||step==='install'||step==='method'&&(first&&ticketFromLink||!first&&g.DeckelInstall?.isStandalone());next.hidden=later.hidden=true;
  if(step==='welcome'){
   say('Wie möchtest du starten?');
   const login=choice('Bereits eingerichtet',()=>{first=false;go('method');});login.className='';
   choice('Erstmals einrichten',()=>{first=true;go(hasRelease()?'method':'release');});
   const more=help();choice('Zugang verloren',release,more);choice('Ausbildung & Hilfe ohne Anmeldung',()=>{close();$('portal-offline-open')?.click();},more);
  }else if(step==='release'){
   say('Öffne den Einladungslink der Verwaltung. Oder gib deine Freigabe ein.');
   const label=node('label','Freigabe');label.htmlFor='identity-code';content.append(label);place('identity-code');
   next.hidden=false;next.textContent='Weiter';next.onclick=()=>{if(!hasRelease()){$('identity-message').textContent='Bitte die gültige Freigabe eingeben.';return;}$('identity-message').textContent='';go('method');};
  }else if(step==='method'){
   const device=g.DeckelInstall?.profile();
   if(first&&hasRelease()&&(device?.embedded||device?.platform==='ios'&&device.browser!=='Safari')){
    say(device.platform==='ios'?'Öffne die Einladung zuerst in Safari.':'Öffne die Einladung zuerst im normalen Browser.');
    const copy=choice('Einladungslink kopieren',async()=>{const url=new URL('deckel.html',location.href);url.search='';url.hash='setup='+$('identity-code').value.trim();try{await navigator.clipboard.writeText(url.href);$('identity-message').textContent='Kopiert. Im Browser einfügen.';}catch{$('identity-message').textContent='Öffne den Link über das Menü deiner E-Mail-App im Browser.';}});copy.className='';back.hidden=true;place('identity-message');title.focus();return;
   }
   say(first?'Nutze Gesicht, Fingerabdruck oder Geräte-PIN.':g.DeckelInstall?.isStandalone()?'Melde dich mit deinem vorhandenen Zugang an.':'Entsperre deinen Zugang mit deinem Gerät.');
   method='passkey';place(first?'identity-register':'identity-login').textContent=first?'Zugang einrichten':'Anmelden';
   choice('Benutzername und Passwort',()=>{method='password';go('access');});
   const more=help();if(first&&hasRelease())choice('Andere Freigabe verwenden',release,more);else{choice('Zugang verloren',release,more);if(!first){if(hasRelease())choice('Mit Einladung erstmals einrichten',()=>{first=true;ticketFromLink=true;go('method');},more);else choice('Erstmals einrichten',()=>{first=true;go('release');},more);}}
  }else if(step==='access'){
   if(first){say('Wähle deinen Benutzernamen und dein Passwort.');place('identity-password-set-form');}
   else if(method==='passkey'){say('Bestätige deinen neuen Zugang.');place('identity-login').textContent='Anmelden';}
   else{say('Gib deinen Benutzernamen und dein Passwort ein.');place('identity-password-login-form');}
   if(!setupFinished)choice('Andere Anmeldeart',()=>go('method'));
   choice('Zugang verloren?',release,help());
  }else if(step==='install'){
   g.DeckelInstall?.refresh();
   if($('installSection')?.hidden){say('H₂O ist bereit.');next.hidden=false;next.textContent='Weiter';next.onclick=()=>go('finish');}
   else{
    place('installSection').open=true;const state=g.DeckelInstall.currentStep();progress.textContent='App-Symbol · Schritt '+(state.index+1)+' von '+state.total;
    back.hidden=state.index===0;next.hidden=false;next.textContent=state.index===state.total-1?'Fertig':'Weiter';
    next.onclick=()=>{const current=g.DeckelInstall.currentStep();if(current.index===current.total-1)go('finish');else{g.DeckelInstall.moveStep(1);render();}};
   }
   later.hidden=false;later.textContent='Später · im Browser weiter';later.onclick=()=>go('finish');
  }else{
   say('Du kannst H₂O jetzt nutzen.');say('Mitteilungen und Kalenderabo findest du später unter Konto & Sicherheit.');
   next.hidden=false;next.textContent='H₂O öffnen';next.onclick=close;
  }
  place('identity-message');title.focus();
 }
 function init(hasTicket){
  if(mounted||g.H2OIdentity?.session())return;
  mounted=true;dialog=node('dialog');dialog.id='h2o-onboarding';dialog.className='h2o-onboarding';dialog.setAttribute('aria-labelledby','h2o-onboarding-title');
  progress=node('p');progress.className='onboarding-progress';progress.setAttribute('aria-live','polite');title=node('h2');title.id='h2o-onboarding-title';title.tabIndex=-1;content=node('div');
  const nav=node('nav');nav.setAttribute('aria-label','Einrichtung');back=node('button','Zurück');next=node('button','Weiter');later=node('button');later.className='onboarding-secondary';back.className='onboarding-secondary';back.type=next.type=later.type='button';
  back.onclick=()=>{if(step==='install'){g.DeckelInstall.moveStep(-1);render();}else if(step==='method')go(first&&!ticketFromLink?'release':'welcome');else if(step==='access')go('method');else go('welcome');};
  nav.append(back,next);dialog.append(progress,title,content,nav,later);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.showModal();if(g.DeckelInstall?.isStandalone()){first=false;step='method';}else if(hasTicket&&hasRelease()){first=true;ticketFromLink=true;step='method';}render();
 }
 g.H2OOnboarding={init,loginCode(){return dialog?.open?(first?$('identity-code').value.trim():''):null;},refresh(){if(dialog?.open)render();},accessReady(){if(!dialog?.open)return;setupFinished=true;first=false;go('access');},signedIn(){if(!dialog?.open)return;if(first||setupFinished){g.DeckelInstall.moveStep(-Infinity);go('install');}else close();}};
})(globalThis);
