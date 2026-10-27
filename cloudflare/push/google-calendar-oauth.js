/* Administration-only Google Authorization Code + PKCE. No refresh token storage. */
(function(g){
 'use strict';
 const redirect='https://ffw-wasser.github.io/home/google-calendar-auth.html',scope='https://www.googleapis.com/auth/calendar.events';
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 const b64=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const digest=async value=>b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 function configured(env){return typeof env.GOOGLE_CALENDAR_CLIENT_ID==='string'&&/^[a-zA-Z0-9_.-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CALENDAR_CLIENT_ID)&&typeof env.GOOGLE_CALENDAR_CLIENT_SECRET==='string'&&env.GOOGLE_CALENDAR_CLIENT_SECRET.length>=10;}
 async function route(action,data,env,source){
  if(action==='configuration')return {configured:configured(env),redirect,scope};
  if(!configured(env))fail('Die Google-Verbindung muss zuerst durch die Verwaltung eingerichtet werden.',503);
  if(action==='start'){
   if(!/^[A-Za-z0-9_-]{43}$/.test(data.challenge||''))fail('Ungültige Google-Anmeldeanfrage.');
   const channel=b64(crypto.getRandomValues(new Uint8Array(32))),state=channel+'.'+await g.CentralLedger.seal(env,{source,challenge:data.challenge,expiresAt:Date.now()+300000,nonce:channel},'google-calendar-oauth-state');
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');for(const [key,value] of Object.entries({client_id:env.GOOGLE_CALENDAR_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope,state,code_challenge:data.challenge,code_challenge_method:'S256',access_type:'online',prompt:'select_account'}))url.searchParams.set(key,value);
   return {authorizationUrl:url.href,state,channel};
  }
  if(action!=='exchange')fail('Nicht gefunden.',404);
  if(typeof data.state!=='string'||data.state.length>4000||typeof data.code!=='string'||!data.code||data.code.length>2048||! /^[A-Za-z0-9._~-]{43,128}$/.test(data.verifier||''))fail('Google-Anmeldeantwort ungültig.');
  let state;try{state=await g.CentralLedger.open(env,data.state.slice(44),'google-calendar-oauth-state');}catch{fail('Google-Anmeldung konnte nicht zugeordnet werden.',401);}
  if(!/^[A-Za-z0-9_-]{43}\./.test(data.state)||!state||state.nonce!==data.state.slice(0,43)||state.source!==source||!Number.isFinite(state.expiresAt)||state.expiresAt<=Date.now()||state.expiresAt>Date.now()+300000||state.challenge!==await digest(data.verifier))fail('Google-Anmeldung abgelaufen oder nicht diesem Gerät zugeordnet.',401);
  let response;try{response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CALENDAR_CLIENT_ID,client_secret:env.GOOGLE_CALENDAR_CLIENT_SECRET,grant_type:'authorization_code',code:data.code,code_verifier:data.verifier,redirect_uri:redirect}).toString(),redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{fail('Google-Anmeldedienst nicht erreichbar (G01). Bitte erneut verbinden.',503);}
  // Workers supports manual/follow only. Never forward client credentials to a redirect.
  if(response.status>=300&&response.status<400)fail('Google-Anmeldedienst antwortete mit einer nicht erlaubten Weiterleitung (G01).',503);
  if(response.status>=500||response.status===429)fail('Google-Anmeldedienst vorübergehend nicht verfügbar (G01). Bitte später erneut verbinden.',503);
  if(!response.ok)fail('Google-Anmeldung nicht bestätigt. Bitte erneut verbinden.',401);
  let value;try{value=await response.json();}catch{fail('Google-Anmeldedienst lieferte keine gültige Antwort (G01). Bitte erneut verbinden.',503);}
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Google-Anmeldedienst lieferte keine gültige Antwort (G01). Bitte erneut verbinden.',503);
  const expires=Number(value.expires_in);
  if(value.token_type!=='Bearer'||typeof value.access_token!=='string'||value.access_token.length<20||value.access_token.length>4096||!Number.isFinite(expires)||expires<=0||expires>86400||!String(value.scope||'').split(' ').includes(scope))fail('Google hat die benötigte Kalenderfreigabe nicht bestätigt.',403);
  // Google authorization codes are bound to PKCE and single-use. Keep only this
  // short-lived access token in the requesting administrator's browser memory.
  return {accessToken:value.access_token,expiresAt:Date.now()+expires*1000};
 }
 g.GoogleCalendarOAuth={route};
})(globalThis);
