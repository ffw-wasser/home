/* One portal identity shared with termin.html. No biometric data or private keys. */
(function(g){
 'use strict';
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',STORAGE='h2o-portal-identity-v1';
 let current=null,record=null,busy=false;
 // Retired confirmation links contain a former one-use secret: erase it without enrolling an address.
 {const url=new URL(location.href);if(url.searchParams.has('calendarConfirm')){url.searchParams.delete('calendarConfirm');history.replaceState(null,'',url.pathname+url.search+url.hash);}}
 const setupCode=(()=>{const m=/^#setup=([\w-]{43})$/.exec(location.hash);if(m||/(?:^#|&)[rak]=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);return m?.[1]||'';})();
 function read(){try{const s=JSON.parse(localStorage.getItem(STORAGE));return s?.scope==='portal'&&/^[\w-]{43}$/.test(s.token)&&/^[a-f0-9]{32}$/.test(s.alias)&&s.expiresAt>Date.now()?s:null;}catch{return null;}}
 function save(s){for(const id of ['login-password','new-password','repeat-password','confirm-password','change-password'])if(el(id))el(id).value='';if(s){localStorage.setItem(STORAGE,JSON.stringify(s));localStorage.setItem('h2o-portal-identity-mode','1');}else localStorage.removeItem(STORAGE);current=s;record=null;el('list')?.replaceChildren();setMemberName('');}
 async function post(path,data={},token=current?.token||read()?.token){
  const response=await fetch(ORIGIN+'/portal/passkey/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Anmeldung nicht bestätigt.'),{status:response.status});return value;
 }
 async function prepare(){
  current=read();record=null;
  if(!current)return null;
  try{const value=await post('session');if(value.alias!==current.alias||value.revision!==current.revision||!/^[a-f0-9]{64}$/.test(value.key))throw Error('Mitgliederzuordnung nicht bestätigt.');record={version:1,alias:value.alias,key:value.key};paint();return record;}
  catch(e){if(e.status===401||e.status===403)save(null);paint();throw e;}
 }
 function supported(){if(!g.H2OPasskeys?.browserSupportsWebAuthn())throw Error('Bitte in Safari oder Chrome öffnen. Bitte den normalen Browser verwenden.');}
 async function login(code,confirmation){
  const expected=current||read();
  if(!code&&expected?.method==='password'){const input=el('confirm-password'),password=confirmation??input?.value??'';if(input)input.value='';if(!password)throw Error('Bitte unter Konto dein aktuelles Passwort zur Bestätigung eingeben.');return accept(await post('password/confirm',{password}));}
  supported();const request=await post('portal/login/options',{},null),response=await g.H2OPasskeys.startAuthentication({optionsJSON:request.options});
  const value=await post('portal/login/verify',{id:request.id,response,...(code?{code}:{})});
  if(value.scope!=='portal'||!/^[\w-]{43}$/.test(value.token)||!/^[a-f0-9]{32}$/.test(value.alias)||value.expiresAt<=Date.now())throw Error('Anmeldung nicht bestätigt.');
  if(expected&&expected.alias!==value.alias)throw Error('Ein anderer Passkey wurde ausgewählt. Bitte den Passkey des angemeldeten Mitglieds wählen oder zuerst abmelden.');
  return accept(value);
 }
 async function accept(value){
  if(value.scope!=='portal'||!/^[\w-]{43}$/.test(value.token)||!/^[a-f0-9]{32}$/.test(value.alias)||value.expiresAt<=Date.now())throw Error('Anmeldung nicht bestätigt.');
  const expected=current||read();if(expected&&expected.alias!==value.alias)throw Error('Bitte vor einem Mitgliederwechsel zuerst abmelden.');
  save(value);await prepare();if(location.pathname.endsWith('/deckel.html'))history.replaceState(null,'',location.pathname+location.search);return value;
 }
 async function loginPassword(username,password){return accept(await post('password/login',{username,password}));}
 async function register(code){
  supported();const data=code?{code}:{};
  const request=await post('enroll/options',data),response=await g.H2OPasskeys.startRegistration({optionsJSON:request.options});
  await post('enroll/verify',{...data,id:request.id,response});
 }
 const el=id=>document.getElementById('identity-'+id);
 function setPortalVisible(visible){const panel=el('panel'),target=el(visible?'security-slot':'entry');if(panel&&target&&panel.parentElement!==target){target.append(panel);el('account').open=!visible||!(current&&record);}const install=document.getElementById('installSection');if(install&&target&&install.parentElement!==target)target.append(install);g.DeckelInstall?.refresh();}
 function setMemberName(name){const member=el('member');if(member){member.textContent=name?'Angemeldet als '+name:'';member.hidden=!name;}}
 function paint(){
  if(!el('state'))return;
  g.H2OOnboarding?.refresh();
  const signedIn=!!(current&&record);
  el('state').textContent=signedIn?(current.method==='password'?'Mit Passwort angemeldet':'Mit Passkey angemeldet'):'Persönlich anmelden';
  el('state').dataset.active=String(signedIn);
  for(const id of ['login','intro','setup','password-login-form'])el(id).hidden=signedIn;
  for(const id of ['logout','devices','revoke-sessions','session-actions','passkeys-heading'])el(id).hidden=!signedIn;
  el('password-confirmation').hidden=el('password-change-confirmation').hidden=!(signedIn&&current.method==='password');
  el('password-settings-title').textContent=signedIn?'Passwort einrichten oder ändern':'Zugang mit Passwort einrichten';
  el('register').textContent=signedIn?'Weiteren Passkey hinzufügen':'Passkey einrichten';
  if(signedIn){el('setup').open=false;el('code').value='';}
  else{setMemberName('');el('list').replaceChildren();}
  calendarSettings();document.getElementById('identity-calendar-settings')?.load?.();
 }
 async function run(action){if(busy)return;if(g.PortalEvidenceEditor?.hasUnsaved?.())return void(el('message').textContent='Bitte die Nachweiseingabe zuerst speichern oder abbrechen.');if(g.DeckelActions?.hasUnsaved?.())return void(el('message').textContent='Bitte zuerst offene Getränkeeingaben abschließen.');busy=true;try{el('message').textContent='Bitte am Gerät bestätigen …';await action();paint();}catch(e){el('message').textContent=e.name==='NotAllowedError'?'Abgebrochen oder kein passender Passkey verfügbar. Bitte erneut versuchen oder die Verwaltung um eine Freigabe bitten.':e.message;}finally{busy=false;}}
 async function devices(){const value=await post('devices');el('list').replaceChildren();for(const [i,key] of value.keys.entries()){const row=document.createElement('p');row.textContent='Passkey '+(i+1)+(key.current?' · aktuell verwendet':'');if(!key.current){const button=document.createElement('button');button.type='button';button.textContent='Sperren';button.onclick=()=>run(async()=>{await login();await post('remove',{credential:key.id});await devices();el('message').textContent='Passkey und zugehörige Sitzungen gesperrt.';await g.DeckelReload?.();});row.append(' ',button);}el('list').append(row);}}
 function calendarSettings(){
  const host=document.getElementById('more-security');if(!host||document.getElementById('identity-calendar-settings'))return;
  const section=document.createElement('section');section.id='identity-calendar-settings';section.className='portal-setting';
  const heading=document.createElement('h3');heading.textContent='Meine Feuerwehrtermine';
  const intro=document.createElement('p');intro.textContent='Dein persönliches Abo enthält nur die kommenden Termine, die dir in H₂O angezeigt werden.';
  const subscribe=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Feuerwehrkalender abonnieren';subscribe.hidden=true;subscribe.append(summary);
  const apple=document.createElement('a');apple.className='button secondary';apple.textContent='In Apple Kalender abonnieren';apple.referrerPolicy='no-referrer';
  const google=document.createElement('a');google.className='button secondary';google.textContent='In Google Kalender abonnieren';google.target='_blank';google.rel='noopener noreferrer';google.referrerPolicy='no-referrer';
  const copy=document.createElement('button');copy.type='button';copy.className='secondary';copy.textContent='Abo-Link kopieren';
  const help=document.createElement('p');help.textContent='Einmal in deiner Kalender-App bestätigen. Google bei Bedarf am Computer: Weitere Kalender → + → Per URL. Ein bisheriges Hauptkalender-Abo entfernen, wenn du nur deine Termine sehen möchtest.';
  const address=document.createElement('input');address.type='url';address.readOnly=true;address.hidden=true;address.setAttribute('aria-label','Persönlicher Kalender-Abo-Link');
  const note=document.createElement('p');note.textContent='Persönlicher Link – nicht weitergeben. Jeder Termin enthält „H₂O-Rückmeldung“ zur Zu- und Absage.';
  const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='Persönlichen Abo-Link zurücksetzen';
  subscribe.append(apple,google,copy,help,address,note,reset);
  const state=document.createElement('p');state.setAttribute('role','status');state.textContent='Kalenderabo wird geladen …';
  const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Kalenderabo erneut laden';retry.hidden=true;
  const feedback=document.createElement('p');feedback.setAttribute('role','status');let owner='',loading=false,version=0,subscriptionUrl='';
  function clearSubscription(){subscriptionUrl='';subscribe.hidden=true;subscribe.open=false;apple.removeAttribute('href');google.removeAttribute('href');address.value='';address.hidden=true;}
  function setSubscription(value){
   clearSubscription();if(!value){state.textContent='Der Feuerwehrkalender ist noch nicht hinterlegt. Bitte die Verwaltung ansprechen.';return;}
   const url=new URL(value);if(url.origin!==ORIGIN||!/^\/calendar\/member\/[A-Za-z0-9_-]{43}\.ics$/.test(url.pathname)||url.search||url.hash||url.username||url.password)throw Error('Der Kalender-Abo-Link ist ungültig. Bitte die Verwaltung ansprechen.');
   subscriptionUrl=url.href;apple.href=url.href.replace(/^https:/,'webcal:');
   // Subscribe to the personal read-only feed; the master Google calendar stays private to configuration.
   google.href='https://calendar.google.com/calendar/r?cid='+encodeURIComponent(subscriptionUrl);
   address.value=subscriptionUrl;subscribe.hidden=false;state.textContent='';
  }
  async function request(data={}){const session=g.H2OIdentity?.session();if(!session||!g.H2OIdentity?.credentials())throw Error('Bitte zuerst persönlich anmelden.');const response=await fetch(ORIGIN+'/portal/calendar-subscription',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:JSON.stringify({alias:session.alias,revision:session.revision,...data}),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Kalenderstatus nicht bestätigt.');return value;}
  section.load=async force=>{const key=current&&record?current.alias+':'+current.revision:'';section.hidden=!key;if(!key){owner='';clearSubscription();feedback.textContent='';return;}if(loading||owner===key&&!force)return;loading=true;retry.hidden=true;state.textContent='Kalenderabo wird geladen …';try{const value=await request();if(current?.alias+':'+current?.revision!==key)return;setSubscription(value.subscriptionUrl);version=value.version;owner=key;feedback.textContent='';}catch(e){clearSubscription();state.textContent=e.message;retry.hidden=false;}finally{loading=false;}};
  reset.onclick=async()=>{if(!confirm('Persönlichen Abo-Link zurücksetzen? Der bisherige Link wird ungültig. Danach den neuen Link in deiner Kalender-App abonnieren und das alte Abo entfernen. Bereits gespeicherte Kalenderdaten werden dadurch nicht vom Gerät gelöscht.'))return;const key=current?.alias+':'+current?.revision;reset.disabled=true;try{const value=await request({reset:true,expectedVersion:version});if(current?.alias+':'+current?.revision!==key)return;setSubscription(value.subscriptionUrl);version=value.version;feedback.textContent='Neuer Abo-Link erstellt. Bitte neu abonnieren und das bisherige Abo entfernen.';}catch(e){feedback.textContent=e.message;}finally{reset.disabled=false;}};
  retry.onclick=()=>section.load(true);
  copy.onclick=async()=>{if(!subscriptionUrl)return;try{await navigator.clipboard.writeText(subscriptionUrl);address.hidden=true;feedback.textContent='Abo-Link kopiert. In deiner Kalender-App als Kalenderabonnement hinzufügen.';}catch{address.hidden=false;address.focus();address.select();feedback.textContent='Bitte den markierten Abo-Link kopieren und in deiner Kalender-App als Kalenderabonnement hinzufügen.';}};
  section.append(heading,intro,subscribe,state,retry,feedback);host.insertBefore(section,host.querySelector('.portal-notification-settings'));
  g.addEventListener('portal-pagechange',event=>{if(event.detail?.page==='more-security')section.load(true);});
 }
 function init(){if(!el('login'))return;paint();if(setupCode){el('code').value=setupCode;el('code').closest('details').open=true;el('account').open=true;}g.H2OOnboarding?.init(!!setupCode);
  el('password-login-form').onsubmit=event=>{event.preventDefault();const name=el('username').value,password=el('login-password').value;el('login-password').value='';void run(async()=>{await loginPassword(name,password);el('message').textContent='';el('account').open=false;g.H2OOnboarding?.signedIn();await g.DeckelReload?.();});};
  el('password-set-form').onsubmit=event=>{event.preventDefault();const username=el('new-username').value,password=el('new-password').value,repeat=el('repeat-password').value,confirmation=el('change-password').value,code=el('code').value.trim();el('new-password').value=el('repeat-password').value=el('change-password').value='';void run(async()=>{if(password!==repeat)throw Error('Die beiden neuen Passwörter stimmen nicht überein.');const wasPassword=current?.method==='password';if(current&&!code)await login(undefined,confirmation);await post('password/set',{username,password,...(code?{code}:{})});el('code').value='';el('password-settings').open=false;if(wasPassword){save(null);await g.DeckelReload?.();}el('message').textContent='Passwort gespeichert. Jetzt mit Benutzername und Passwort anmelden.';g.H2OOnboarding?.accessReady();});};
  el('login').onclick=()=>run(async()=>{await login(el('code').value.trim());el('code').value='';el('message').textContent='';el('account').open=false;g.H2OOnboarding?.signedIn();await g.DeckelReload?.();});
  el('register').onclick=()=>run(async()=>{const code=el('code').value.trim();if(!code&&current)await login();await register(code);el('code').value='';el('message').textContent=current?'Weiterer Passkey gespeichert. Du bleibst angemeldet.':'Passkey gespeichert. Jetzt „Mit Passkey anmelden“ wählen, um das Portal zu öffnen.';g.H2OOnboarding?.accessReady();if(current)await g.DeckelReload?.();});
  el('devices').onclick=()=>run(async()=>{await devices();el('message').textContent='Ein synchronisierter Passkey kann auf mehreren eigenen Geräten liegen. Bei Geräteverlust auch das Apple-/Google-Konto absichern.';});
  el('revoke-sessions').onclick=()=>run(async()=>{await login();await post('sessions/revoke');el('message').textContent='Alle anderen Portal- und Termin-Sitzungen wurden abgemeldet.';await g.DeckelReload?.();});
  el('logout').onclick=()=>run(async()=>{await post('logout');save(null);history.replaceState(null,'',location.pathname+location.search);await g.DeckelDevice?.clearLink?.();location.reload();});
 }
 g.H2OIdentity={refresh:paint,setMemberName,setPortalVisible,onboarding:()=>!!setupCode&&!read(),usesPortal:()=>true,forget:()=>save(null),prepare,login,loginPassword,session:()=>current||read(),credentials:()=>record,post};
 g.addEventListener('storage',event=>{if(event.key===STORAGE)location.reload();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
