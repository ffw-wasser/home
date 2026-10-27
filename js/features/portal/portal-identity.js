/* One portal identity shared with termin.html. No biometric data or private keys. */
(function(g){
 'use strict';
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',STORAGE='h2o-portal-identity-v1';
 let current=null,record=null,busy=false;
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
 function supported(){if(!g.H2OPasskeys?.browserSupportsWebAuthn())throw Error('Bitte in Safari oder Chrome öffnen. Im WhatsApp-Menü „Im Browser öffnen“ wählen.');}
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
 function setPortalVisible(visible){const panel=el('panel'),target=el(visible?'security-slot':'entry');if(panel&&target&&panel.parentElement!==target){target.append(panel);el('account').open=true;}const install=document.getElementById('installSection');if(install&&target&&install.parentElement!==target)target.append(install);g.DeckelInstall?.refresh();}
 function setMemberName(name){const member=el('member');if(member){member.textContent=name?'Angemeldet als '+name:'';member.hidden=!name;}}
 function paint(){
  if(!el('state'))return;
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
  whatsappSettings();document.getElementById('identity-whatsapp-settings')?.load?.();
 }
 async function run(action){if(busy)return;if(g.PortalEvidenceEditor?.hasUnsaved?.())return void(el('message').textContent='Bitte die Nachweiseingabe zuerst speichern oder abbrechen.');if(g.DeckelActions?.hasUnsaved?.())return void(el('message').textContent='Bitte zuerst offene Getränkeeingaben abschließen.');busy=true;try{el('message').textContent='Bitte am Gerät bestätigen …';await action();paint();}catch(e){el('message').textContent=e.name==='NotAllowedError'?'Abgebrochen oder kein passender Passkey verfügbar. Bitte erneut versuchen oder die Verwaltung um eine Freigabe bitten.':e.message;}finally{busy=false;}}
 async function devices(){const value=await post('devices');el('list').replaceChildren();for(const [i,key] of value.keys.entries()){const row=document.createElement('p');row.textContent='Passkey '+(i+1)+(key.current?' · aktuell verwendet':'');if(!key.current){const button=document.createElement('button');button.type='button';button.textContent='Sperren';button.onclick=()=>run(async()=>{await login();await post('remove',{credential:key.id});await devices();el('message').textContent='Passkey und zugehörige Sitzungen gesperrt.';await g.DeckelReload?.();});row.append(' ',button);}el('list').append(row);}}
 function whatsappSettings(){
  const slot=el('security-slot');if(!slot||document.getElementById('identity-whatsapp-settings'))return;
  const section=document.createElement('section');section.id='identity-whatsapp-settings';section.style.cssText='padding:16px;margin:16px 0;border:1px solid #b8cbd4;border-radius:14px';
  const heading=document.createElement('h3');heading.textContent='WhatsApp-Erinnerungen';
  const phoneLabel=document.createElement('label');phoneLabel.textContent='Meine Handynummer';phoneLabel.style.cssText='display:block;margin:12px 0';
  const phone=document.createElement('input');phone.type='tel';phone.placeholder='+49 170 1234567';phone.autocomplete='tel';phone.style.cssText='display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:6px';phoneLabel.append(phone);
  const consent=document.createElement('label');consent.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 0;cursor:pointer';
  const check=document.createElement('input');check.type='checkbox';check.style.cssText='appearance:auto!important;-webkit-appearance:checkbox!important;width:24px;height:24px;flex:none';
  const caption=document.createElement('span');caption.textContent='Persönliche WhatsApp-Erinnerungen erlauben';consent.append(check,caption);
  const info=document.createElement('p');info.textContent='Nur für passende Termine ohne verbindliche Rückmeldung. Du kannst die Freigabe jederzeit widerrufen und deine Nummer entfernen.';
  const status=document.createElement('p');status.setAttribute('role','status');
  const save=document.createElement('button');save.type='button';save.textContent='WhatsApp-Einstellungen speichern';save.className='primary-button';
  async function request(data){const session=g.H2OIdentity?.session(),c=g.H2OIdentity?.credentials();if(!session||!c)throw Error('Bitte zuerst anmelden.');const response=await fetch(ORIGIN+'/portal/whatsapp-preference',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:JSON.stringify({alias:session.alias,revision:session.revision,...data}),cache:'no-store',credentials:'omit'});const value=await response.json();if(!response.ok)throw Error(value.error||'Speichern fehlgeschlagen.');return value;}
  save.onclick=async()=>{save.disabled=true;status.textContent='Speichert …';try{const value=await request({phone:phone.value,allowed:check.checked});phone.value=value.phone;check.checked=value.allowed;status.textContent='WhatsApp-Einstellungen gespeichert.';}catch(e){status.textContent=e.message;}finally{save.disabled=false;}};
  section.append(heading,phoneLabel,consent,info,save,status);slot.append(section);
  section.load=async()=>{section.hidden=!(current&&record);if(section.hidden)return;status.textContent='Lädt …';try{const value=await request({});phone.value=value.phone||'';check.checked=value.allowed===true;status.textContent='';}catch(e){status.textContent=e.message;}};
  section.load();
 }
 function init(){if(!el('login'))return;paint();if(setupCode){el('code').value=setupCode;el('code').closest('details').open=true;el('account').open=true;el('intro').textContent='Deine persönliche Freigabe ist eingetragen. Wähle „Passkey einrichten“ oder öffne „Zugang mit Passwort einrichten“. Danach kannst du dich mit diesem Zugang anmelden.';}
  el('password-login-form').onsubmit=event=>{event.preventDefault();const name=el('username').value,password=el('login-password').value;el('login-password').value='';void run(async()=>{await loginPassword(name,password);el('message').textContent='';el('account').open=false;await g.DeckelReload?.();});};
  el('password-set-form').onsubmit=event=>{event.preventDefault();const username=el('new-username').value,password=el('new-password').value,repeat=el('repeat-password').value,confirmation=el('change-password').value,code=el('code').value.trim();el('new-password').value=el('repeat-password').value=el('change-password').value='';void run(async()=>{if(password!==repeat)throw Error('Die beiden neuen Passwörter stimmen nicht überein.');const wasPassword=current?.method==='password';if(current&&!code)await login(undefined,confirmation);await post('password/set',{username,password,...(code?{code}:{})});el('code').value='';el('password-settings').open=false;if(wasPassword){save(null);await g.DeckelReload?.();}el('message').textContent='Passwort gespeichert. Jetzt mit Benutzername und Passwort anmelden.';});};
  el('login').onclick=()=>run(async()=>{await login(el('code').value.trim());el('code').value='';el('message').textContent='';el('account').open=false;await g.DeckelReload?.();});
  el('register').onclick=()=>run(async()=>{const code=el('code').value.trim();if(!code&&current)await login();await register(code);el('code').value='';el('message').textContent=current?'Weiterer Passkey gespeichert. Du bleibst angemeldet.':'Passkey gespeichert. Jetzt „Mit Passkey anmelden“ wählen, um das Portal zu öffnen.';if(current)await g.DeckelReload?.();});
  el('devices').onclick=()=>run(async()=>{await devices();el('message').textContent='Ein synchronisierter Passkey kann auf mehreren eigenen Geräten liegen. Bei Geräteverlust auch das Apple-/Google-Konto absichern.';});
  el('revoke-sessions').onclick=()=>run(async()=>{await login();await post('sessions/revoke');el('message').textContent='Alle anderen Portal- und Termin-Sitzungen wurden abgemeldet.';await g.DeckelReload?.();});
  el('logout').onclick=()=>run(async()=>{await post('logout');save(null);history.replaceState(null,'',location.pathname+location.search);await g.DeckelDevice?.clearLink?.();location.reload();});
 }
 g.H2OIdentity={setMemberName,setPortalVisible,onboarding:()=>!!setupCode&&!read(),usesPortal:()=>true,forget:()=>save(null),prepare,login,loginPassword,session:()=>current||read(),credentials:()=>record,post};
 g.addEventListener('storage',event=>{if(event.key===STORAGE)location.reload();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
