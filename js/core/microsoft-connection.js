/* Microsoft is used once to prove folder access, never as the live data store. */
(function(g){
 'use strict';
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',AUTH='https://login.microsoftonline.com/consumers/oauth2/v2.0',REDIRECT='https://ffw-wasser.github.io/home/',KEY='fw_microsoft_enrollment_pkce',SCOPE='https://graph.microsoft.com/Files.Read';
 const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
 const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
 async function request(path,data){
  const response=await fetch(ORIGIN+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Microsoft-Verbindung konnte nicht eingerichtet werden.');return value;
 }
 async function login(label='Microsoft-Verwaltungsgerät'){
  const cfg=await request('/storage/microsoft/config',{});
  if(!/^[a-f0-9-]{36}$/i.test(cfg.clientId))throw Error('Microsoft-Anmeldung noch nicht eingerichtet.');
  const verifier=random(),state=random(),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  sessionStorage.setItem(KEY,JSON.stringify({verifier,state,clientId:cfg.clientId,label,createdAt:Date.now()}));
  const url=new URL(AUTH+'/authorize');url.search=new URLSearchParams({client_id:cfg.clientId,response_type:'code',redirect_uri:REDIRECT,response_mode:'query',scope:SCOPE,code_challenge:challenge,code_challenge_method:'S256',state}).toString();location.assign(url.href);
 }
 async function finish(){
  const query=new URLSearchParams(location.search);if(!query.has('code')&&!query.has('error'))return false;
  let saved;try{saved=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
  // Remove OAuth response before any further request or application rendering.
  history.replaceState(null,'',location.pathname+location.hash);sessionStorage.removeItem(KEY);
  if(!saved||saved.state!==query.get('state')||!Number.isFinite(saved.createdAt)||saved.createdAt>Date.now()||Date.now()-saved.createdAt>10*60000)throw Error('Microsoft-Anmeldung abgelaufen oder ungültig. Bitte neu starten.');
  if(query.has('error'))throw Error('Microsoft-Anmeldung wurde nicht abgeschlossen. Bitte erneut anmelden.');
  const cfg=await request('/storage/microsoft/config',{});if(cfg.clientId!==saved.clientId)throw Error('Microsoft-Einrichtung wurde geändert. Bitte erneut anmelden.');
  const response=await fetch(AUTH+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:saved.clientId,grant_type:'authorization_code',code:query.get('code'),redirect_uri:REDIRECT,code_verifier:saved.verifier,scope:SCOPE}),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  const access=await response.json();if(!response.ok||!access.access_token)throw Error('Microsoft-Anmeldung fehlgeschlagen. Bitte erneut anmelden.');
  const value=await request('/storage/microsoft/enroll',{accessToken:access.access_token,deviceId:crypto.randomUUID(),token:random(),label:saved.label||'Microsoft-Verwaltungsgerät'});
  await g.CloudStorage.acceptMicrosoft(value);return true;
 }
 g.MicrosoftConnection={login,finish};
})(window);
