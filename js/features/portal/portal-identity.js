/* One portal identity shared with termin.html. No biometric data or private keys. */
(function(g){
 'use strict';
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',STORAGE='h2o-portal-identity-v1';
 let current=null,record=null,busy=false;
 const setupCode=(()=>{const m=/^#setup=([\w-]{43})$/.exec(location.hash);if(m||/(?:^#|&)[rak]=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);return m?.[1]||'';})();
 function read(){try{const s=JSON.parse(localStorage.getItem(STORAGE));return s?.scope==='portal'&&/^[\w-]{43}$/.test(s.token)&&/^[a-f0-9]{32}$/.test(s.alias)&&s.expiresAt>Date.now()?s:null;}catch{return null;}}
 function save(s){if(s){localStorage.setItem(STORAGE,JSON.stringify(s));localStorage.setItem('h2o-portal-identity-mode','1');}else localStorage.removeItem(STORAGE);current=s;record=null;}
 async function post(path,data={},token=current?.token||read()?.token){
  const response=await fetch(ORIGIN+'/portal/passkey/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Anmeldung nicht bestätigt.'),{status:response.status});return value;
 }
 async function prepare(){
  current=read();record=null;
  if(!current)return null;
  try{const value=await post('session');if(value.alias!==current.alias||value.revision!==current.revision||!/^[a-f0-9]{64}$/.test(value.key))throw Error('Mitgliederzuordnung nicht bestätigt.');record={version:1,alias:value.alias,key:value.key};paint();return record;}
  catch(e){if(e.status===401||e.status===403){save(null);paint();}throw e;}
 }
 function supported(){if(!g.H2OPasskeys?.browserSupportsWebAuthn())throw Error('Bitte in Safari oder Chrome öffnen. Im WhatsApp-Menü „Im Browser öffnen“ wählen.');}
 async function login(code){
  const expected=current||read();
  supported();const request=await post('portal/login/options',{},null),response=await g.H2OPasskeys.startAuthentication({optionsJSON:request.options});
  const value=await post('portal/login/verify',{id:request.id,response,...(code?{code}:{})});
  if(value.scope!=='portal'||!/^[\w-]{43}$/.test(value.token)||!/^[a-f0-9]{32}$/.test(value.alias)||value.expiresAt<=Date.now())throw Error('Anmeldung nicht bestätigt.');
  if(expected&&expected.alias!==value.alias)throw Error('Ein anderer Passkey wurde ausgewählt. Bitte den Passkey des angemeldeten Mitglieds wählen oder zuerst abmelden.');
  save(value);await prepare();if(location.pathname.endsWith('/deckel.html'))history.replaceState(null,'',location.pathname+location.search);return value;
 }
 async function register(code){
  supported();const data=code?{code}:{};
  const request=await post('enroll/options',data),response=await g.H2OPasskeys.startRegistration({optionsJSON:request.options});
  await post('enroll/verify',{...data,id:request.id,response});
 }
 const el=id=>document.getElementById('identity-'+id);
 function setPortalVisible(visible){const panel=el('panel'),target=el(visible?'security-slot':'entry');if(panel&&target&&panel.parentElement!==target){target.append(panel);el('account').open=true;}}
 function paint(){if(!el('state'))return;el('state').textContent=current?'Mit Passkey angemeldet':'Persönlich anmelden';el('login').textContent=current?'Anmeldung erneut bestätigen':'Mit Passkey anmelden';el('logout').hidden=!current;el('devices').hidden=!current;el('revoke-sessions').hidden=!current;el('register').textContent=current?'Weiteren Passkey hinzufügen':'Passkey einrichten';}
 async function run(action){if(busy)return;if(g.DeckelActions?.hasUnsaved?.())return void(el('message').textContent='Bitte zuerst offene Getränkeeingaben abschließen.');busy=true;try{el('message').textContent='Bitte am Gerät bestätigen …';await action();paint();}catch(e){el('message').textContent=e.name==='NotAllowedError'?'Abgebrochen oder kein passender Passkey verfügbar. Bitte erneut versuchen oder die Verwaltung um eine Freigabe bitten.':e.message;}finally{busy=false;}}
 async function devices(){const value=await post('devices');el('list').replaceChildren();for(const [i,key] of value.keys.entries()){const row=document.createElement('p');row.textContent='Passkey '+(i+1)+(key.current?' · aktuell verwendet':'');if(!key.current){const button=document.createElement('button');button.type='button';button.textContent='Sperren';button.onclick=()=>run(async()=>{await login();await post('remove',{credential:key.id});await devices();el('message').textContent='Passkey und zugehörige Sitzungen gesperrt.';await g.DeckelReload?.();});row.append(' ',button);}el('list').append(row);}}
 function init(){if(!el('login'))return;paint();if(setupCode){el('code').value=setupCode;el('code').closest('details').open=true;el('account').open=true;}
  el('login').onclick=()=>run(async()=>{await login(el('code').value.trim());el('code').value='';el('message').textContent='Angemeldet. Dieser Passkey gilt auch für WhatsApp-Terminlinks.';el('account').open=false;await g.DeckelReload?.();});
  el('register').onclick=()=>run(async()=>{const code=el('code').value.trim();if(!code&&current)await login();await register(code);el('code').value='';el('message').textContent='Passkey gespeichert. Jetzt „Mit Passkey anmelden“ wählen, um das Portal zu öffnen.';});
  el('devices').onclick=()=>run(async()=>{await devices();el('message').textContent='Ein synchronisierter Passkey kann auf mehreren eigenen Geräten liegen. Bei Geräteverlust auch das Apple-/Google-Konto absichern.';});
  el('revoke-sessions').onclick=()=>run(async()=>{await login();await post('sessions/revoke');el('message').textContent='Alle anderen Portal- und Termin-Sitzungen wurden abgemeldet.';await g.DeckelReload?.();});
  el('logout').onclick=()=>run(async()=>{await post('logout');save(null);history.replaceState(null,'',location.pathname+location.search);await g.DeckelDevice?.clearLink?.();location.reload();});
 }
 g.H2OIdentity={setPortalVisible,onboarding:()=>!!setupCode&&!read(),usesPortal:()=>true,forget:()=>save(null),prepare,login,session:()=>current||read(),credentials:()=>record,post};
 g.addEventListener('storage',event=>{if(event.key===STORAGE)location.reload();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
