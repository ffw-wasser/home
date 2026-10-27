/* One portal identity shared with termin.html. No biometric data or private keys. */
(function(g){
 'use strict';
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',STORAGE='h2o-portal-identity-v1';
 let current=null,record=null,busy=false,calendarConfirmRouted=false;
 let calendarConfirmation=(()=>{const url=new URL(location.href),token=url.searchParams.get('calendarConfirm');if(!/^[a-f0-9]{64}$/.test(token||''))return '';url.searchParams.delete('calendarConfirm');history.replaceState(null,'',url.pathname+url.search+url.hash);return token;})();
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
 function setPortalVisible(visible){const panel=el('panel'),target=el(visible?'security-slot':'entry');if(panel&&target&&panel.parentElement!==target){target.append(panel);el('account').open=!visible||!(current&&record);}const install=document.getElementById('installSection');if(install&&target&&install.parentElement!==target)target.append(install);g.DeckelInstall?.refresh();if(visible&&current&&record&&calendarConfirmation&&!calendarConfirmRouted){calendarConfirmRouted=true;g.DeckelMobile?.jump('more-security');}}
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
  const heading=document.createElement('h3');heading.textContent='Kalendereinladungen';
  const intro=document.createElement('p');intro.textContent='Freigegebene Termine in deinem Google-, Apple- oder Outlook-Kalender erhalten und dort zu- oder absagen.';
  const state=document.createElement('p');state.setAttribute('role','status');
  const form=document.createElement('form'),label=document.createElement('label'),address=document.createElement('input');address.type='email';address.autocomplete='email';address.maxLength=254;address.required=true;address.setAttribute('aria-label','Meine Kalender-E-Mail-Adresse');label.textContent='Meine Kalender-E-Mail-Adresse';label.append(address);
  const consent=document.createElement('label'),allowed=document.createElement('input');consent.className='portal-calendar-consent';allowed.type='checkbox';allowed.required=true;consent.append(allowed,document.createTextNode('Kalendereinladungen und Antwortabgleich über Google erlauben'));
  const help=document.createElement('details'),summary=document.createElement('summary'),info=document.createElement('p');summary.textContent='So funktioniert die Kalenderanbindung';info.textContent='Freiwillig. Bestätige deine Adresse über den Link in der E-Mail. Danach kommen Einladungen nur für deine freigegebenen Termine. Google verarbeitet die Einladungen und Antworten; andere Mitgliedsadressen stehen nicht darin. Während eine Einladung aktiv ist, antworte im Kalender. Änderungen werden regelmäßig übernommen. Eine bestehende H₂O-Antwort bleibt bis zu deiner ersten Kalenderantwort erhalten. Abgelaufene Einladungen werden nach Terminende entfernt; dein Kalenderanbieter kann dafür eine Absagemeldung anzeigen. Du kannst die Anbindung jederzeit beenden. Zukünftige Einladungen werden beim nächsten erfolgreichen Abgleich abgesagt.';help.append(summary,info);
  const options=document.createElement('details'),optionsTitle=document.createElement('summary');options.className='portal-setting-options';optionsTitle.textContent='Kalenderadresse hinterlegen';options.append(optionsTitle);
  const save=document.createElement('button');save.type='submit';save.className='primary-button';save.textContent='Bestätigungs-E-Mail anfordern';
  const stop=document.createElement('button');stop.type='button';stop.className='secondary';stop.textContent='Kalenderanbindung beenden';stop.hidden=true;
  const confirmAddress=document.createElement('button');confirmAddress.type='button';confirmAddress.className='primary-button';confirmAddress.textContent='Kalenderadresse bestätigen';confirmAddress.hidden=true;
  const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary';refresh.textContent='Status aktualisieren';
  const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.className='portal-setting-feedback';
  let version=0,owner='',loading=false,dirty=false,known=false,lastLoad=0,verifiedAddress='';
  async function request(data){const session=g.H2OIdentity?.session();if(!session||!g.H2OIdentity?.credentials())throw Error('Bitte zuerst persönlich anmelden.');const response=await fetch(ORIGIN+'/portal/calendar-preference',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:JSON.stringify({alias:session.alias,revision:session.revision,...data}),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Die Kalenderanbindung wurde nicht bestätigt.');return value;}
  function show(value){version=value.version;known=true;address.value=value.email||'';allowed.checked=value.allowed===true;stop.hidden=!value.allowed;verifiedAddress=value.verified?value.email:'';options.hidden=!value.configured&&!value.allowed;options.open=!value.allowed;optionsTitle.textContent=value.allowed?'Adresse ändern oder trennen':'Kalenderadresse hinterlegen';confirmAddress.hidden=!calendarConfirmation||!value.pending;save.disabled=!value.configured;address.disabled=allowed.disabled=!value.configured;state.textContent=!value.configured?'Die Verwaltung richtet Kalendereinladungen noch ein.':value.verified?'Verbunden · '+value.email:value.pending?'Bitte den Link in der Bestätigungs-E-Mail öffnen. Der Versand erfolgt beim nächsten Abgleich.':value.allowed?'Bitte die Kalenderadresse erneut bestätigen lassen.':'Noch nicht verbunden';save.textContent='Bestätigungs-E-Mail anfordern';save.disabled=save.disabled||!!verifiedAddress;dirty=false;}
  async function action(data,message){save.disabled=stop.disabled=confirmAddress.disabled=true;try{const value=await request({...data,expectedVersion:version});show(value);feedback.textContent=message;}catch(e){feedback.textContent=e.message;}finally{save.disabled=!known||address.disabled||!!verifiedAddress&&address.value.trim().toLowerCase()===verifiedAddress;stop.disabled=confirmAddress.disabled=false;}}
  form.addEventListener('input',()=>{dirty=true;save.disabled=address.disabled||!!verifiedAddress&&address.value.trim().toLowerCase()===verifiedAddress;});form.onsubmit=event=>{event.preventDefault();if(!known)return;void action({email:address.value.trim(),allowed:allowed.checked},'Bestätigung angefordert. Bitte die E-Mail abwarten und den Link öffnen.');};
  stop.onclick=()=>{if(!confirm('Kalenderanbindung beenden? Weitere Einladungen und der Antwortimport stoppen. Zukünftige Einladungen werden beim nächsten erfolgreichen Abgleich abgesagt.'))return;void action({allowed:false},'Kalenderanbindung beendet. Du kannst wieder in H₂O antworten.');};
  confirmAddress.onclick=async()=>{if(!calendarConfirmation)return;await action({confirm:calendarConfirmation},'Kalenderadresse bestätigt. Deine freigegebenen Termine werden automatisch eingeladen.');if(state.textContent.startsWith('Verbunden')){calendarConfirmation='';confirmAddress.hidden=true;}};
  refresh.onclick=()=>section.load(true);
  form.append(label,consent,save);options.append(form,stop,refresh);section.append(heading,intro,state,confirmAddress,options,help,feedback);host.insertBefore(section,host.querySelector('.portal-notification-settings'));
  section.load=async force=>{const key=current&&record?current.alias+':'+current.revision:'';section.hidden=!key;if(!key){owner='';known=false;address.value='';allowed.checked=false;dirty=false;return;}if(loading||dirty&&!force||key===owner&&!force&&Date.now()-lastLoad<30000)return;if(dirty&&force&&!confirm('Ungespeicherte Kalenderadresse verwerfen?'))return;loading=true;save.disabled=true;try{const value=await request({});if(current?.alias+':'+current?.revision!==key)return;owner=key;lastLoad=Date.now();show(value);feedback.textContent=calendarConfirmation&&!value.pending&&!value.verified?'Für diesen Bestätigungslink bitte mit dem zugehörigen H₂O-Konto anmelden.':'';}catch(e){known=false;feedback.textContent=e.message;}finally{loading=false;}};
  g.addEventListener('portal-pagechange',event=>{if(event.detail?.page==='more-security')section.load();});
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
