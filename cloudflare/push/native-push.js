/* Native APNs and FCM transport. No member data is placed in lock-screen payloads. */
(function(g){
 'use strict';
 const token=value=>typeof value==='string'&&/^[a-f0-9]{32,512}$/.test(value)&&value.length%2===0;
 const fcmPrefix='https://fcm.googleapis.com/h2o-native/';
 const fcmToken=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{20,4096}$/.test(value);
 const endpoint=(value,platform='ios')=>platform==='android'?(fcmToken(value)?fcmPrefix+value:null):platform==='ios'&&token(value)?'https://api.push.apple.com/3/device/'+value:null;
 const isEndpoint=value=>typeof value==='string'&&((value.startsWith('https://api.push.apple.com/3/device/')&&endpoint(value.slice(36))===value)||(value.startsWith(fcmPrefix)&&endpoint(value.slice(fcmPrefix.length),'android')===value));
 const appleReady=env=>/^[A-Z0-9]{10}$/.test(env.H2O_APNS_KEY_ID||'')&&env.H2O_APNS_TEAM_ID==='VKL57X3H6F'&&typeof env.H2O_APNS_PRIVATE_KEY==='string'&&env.H2O_APNS_PRIVATE_KEY.includes('BEGIN PRIVATE KEY');
 function account(env){try{const a=JSON.parse(env.H2O_FCM_SERVICE_ACCOUNT||'null');return a&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(a.project_id)&&typeof a.client_email==='string'&&/^[a-zA-Z0-9._-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(a.client_email)&&typeof a.private_key==='string'&&a.private_key.includes('BEGIN PRIVATE KEY')&&(!a.token_uri||a.token_uri==='https://oauth2.googleapis.com/token')?a:null;}catch{return null;}}
 const ready=(env,platform='ios')=>platform==='android'?!!account(env):platform==='ios'&&appleReady(env);
 const bytes=new TextEncoder(),b64=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 let cached=null,pending=null;
 async function authorization(env){
  if(!ready(env))throw Error('Apple-Mitteilungsdienst noch nicht eingerichtet.');
  const id=env.H2O_APNS_TEAM_ID+':'+env.H2O_APNS_KEY_ID,now=Date.now();
  if(cached?.id===id&&now>=cached.createdAt&&now-cached.createdAt<45*60*1000)return cached.value;
  if(pending?.id===id)return pending.promise;
  const promise=mint(env).then(value=>{cached={id,createdAt:now,value};return value;}).finally(()=>{pending=null;});
  pending={id,promise};return promise;
 }
 async function mint(env){
  if(!ready(env))throw Error('Apple-Mitteilungsdienst noch nicht eingerichtet.');
  const pem=env.H2O_APNS_PRIVATE_KEY.replace(/-----[A-Z ]+-----/g,'').replace(/\s/g,''),data=Uint8Array.from(atob(pem),x=>x.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',data,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const jwt=b64(bytes.encode(JSON.stringify({alg:'ES256',kid:env.H2O_APNS_KEY_ID})))+'.'+b64(bytes.encode(JSON.stringify({iss:env.H2O_APNS_TEAM_ID,iat:Math.floor(Date.now()/1000)})));
  return 'bearer '+jwt+'.'+b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,bytes.encode(jwt)));
 }
 async function send(env,url){
  if(!isEndpoint(url))throw Error('Ungültiges Mitteilungsgerät.');
  if(url.startsWith(fcmPrefix))return sendAndroid(env,url.slice(fcmPrefix.length));
  return fetch(url,{method:'POST',headers:{authorization:await authorization(env),'apns-topic':'de.feuerwehrwasser.h2o','apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(Date.now()/1000)+3600),'content-type':'application/json'},body:JSON.stringify({aps:{alert:{title:'H₂O · Feuerwehr Wasser',body:'Eine Mitteilung liegt vor. Bitte H₂O öffnen.'},sound:'default'}}),redirect:'error',signal:AbortSignal.timeout(8000)});
 }
 let oauthCache=null,oauthPending=null;
 async function oauth(env){
  const a=account(env);if(!a)throw Error('Android-Mitteilungsdienst noch nicht eingerichtet.');
  const id=a.client_email+':'+a.private_key,now=Date.now();
  if(oauthCache?.id===id&&now>=oauthCache.createdAt&&now<oauthCache.expiresAt)return oauthCache.value;
  if(oauthPending?.id===id)return oauthPending.promise;
  const promise=(async()=>{
   const data=Uint8Array.from(atob(a.private_key.replace(/-----[A-Z ]+-----/g,'').replace(/\s/g,'')),x=>x.charCodeAt(0));
   const key=await crypto.subtle.importKey('pkcs8',data,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
   const issued=Math.floor(now/1000),jwt=b64(bytes.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+b64(bytes.encode(JSON.stringify({iss:a.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600})));
   const assertion=jwt+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes.encode(jwt)));
   const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('Android-Mitteilungsdienst konnte nicht bestätigt werden.');
   const result=await response.json();if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(result.expires_in)||result.expires_in<120)throw Error('Ungültige Dienstbestätigung.');
   oauthCache={id,createdAt:now,expiresAt:now+(Math.min(3600,result.expires_in)-60)*1000,value:result.access_token};return result.access_token;
  })().finally(()=>{oauthPending=null;});oauthPending={id,promise};return promise;
 }
 async function sendAndroid(env,deviceToken){
  const a=account(env);if(!a)throw Error('Android-Mitteilungsdienst noch nicht eingerichtet.');
  const response=await fetch('https://fcm.googleapis.com/v1/projects/'+a.project_id+'/messages:send',{method:'POST',headers:{authorization:'Bearer '+await oauth(env),'content-type':'application/json'},body:JSON.stringify({message:{token:deviceToken,data:{kind:'portal-reminder'},android:{priority:'high',ttl:'3600s'}}}),redirect:'error',signal:AbortSignal.timeout(8000)});
  if(response.status===404){const failure=await response.clone().json().catch(()=>null);return new Response(null,{status:failure?.error?.details?.some(d=>d.errorCode==='UNREGISTERED')?410:503});}
  return response;
 }
 g.NativePush={endpoint,isEndpoint,ready,send};
})(globalThis);
