/* FCM HTTP v1. Only fixed Google endpoints; generic notifications, no member details. */
(function(g){
 'use strict';
 const prefix='https://fcm.googleapis.com/h2o/device/';
 const token=value=>typeof value==='string'&&/^[A-Za-z0-9_:-]{20,4096}$/.test(value);
 const endpoint=value=>token(value)?prefix+value:null;
 const isEndpoint=value=>typeof value==='string'&&value.startsWith(prefix)&&endpoint(value.slice(prefix.length))===value;
 function configuration(env){
  if(env.H2O_FCM_SERVICE_ACCOUNT_JSON===undefined)return env;
  try{
   const raw=env.H2O_FCM_SERVICE_ACCOUNT_JSON;
   if(typeof raw!=='string'||raw.length>20000) return {};
   const value=JSON.parse(raw);
   if(value?.type!=='service_account'||env.H2O_FCM_PROJECT_ID&&env.H2O_FCM_PROJECT_ID!==value.project_id)return {};
   // Only use these three fields. Never trust URLs or endpoints supplied by a key file.
   return {H2O_FCM_PROJECT_ID:value.project_id,H2O_FCM_CLIENT_EMAIL:value.client_email,H2O_FCM_PRIVATE_KEY:value.private_key};
  }catch{return {};}
 }
 const ready=source=>{const env=configuration(source);return/^[a-z][a-z0-9-]{4,62}$/.test(env.H2O_FCM_PROJECT_ID||'')&&/^[A-Za-z0-9._-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(env.H2O_FCM_CLIENT_EMAIL||'')&&typeof env.H2O_FCM_PRIVATE_KEY==='string'&&env.H2O_FCM_PRIVATE_KEY.includes('BEGIN PRIVATE KEY');};
 const bytes=new TextEncoder(),b64=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 let cached=null;
 async function authorization(env){
  if(!ready(env))throw Error('Android-Mitteilungsdienst noch nicht eingerichtet.');
  const now=Date.now(),id=env.H2O_FCM_PROJECT_ID+':'+env.H2O_FCM_CLIENT_EMAIL+':'+env.H2O_FCM_PRIVATE_KEY;
  if(cached?.id===id&&now>=cached.createdAt&&now<cached.expiresAt)return cached.value;
  const pem=env.H2O_FCM_PRIVATE_KEY.replace(/-----[A-Z ]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),x=>x.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const iat=Math.floor(now/1000),head=b64(bytes.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),body=b64(bytes.encode(JSON.stringify({iss:env.H2O_FCM_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600})));
  const jwt=head+'.'+body+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes.encode(head+'.'+body)));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}).toString(),redirect:'manual',signal:AbortSignal.timeout(8000)});
  const result=await response.json();
  if(!response.ok||typeof result.access_token!=='string'||!/^[A-Za-z0-9._~-]{20,4096}$/.test(result.access_token)||!Number.isFinite(result.expires_in)||result.expires_in<120)throw Error('Android-Mitteilungsdienst konnte sich nicht anmelden.');
  cached={id,createdAt:now,expiresAt:now+Math.min(result.expires_in-60,3300)*1000,value:'Bearer '+result.access_token};return cached.value;
 }
 async function send(source,url){
  const env=configuration(source);
  if(!isEndpoint(url))throw Error('Ungültiges Android-Mitteilungsgerät.');
  return fetch('https://fcm.googleapis.com/v1/projects/'+env.H2O_FCM_PROJECT_ID+'/messages:send',{method:'POST',headers:{authorization:await authorization(env),'content-type':'application/json'},body:JSON.stringify({message:{token:url.slice(prefix.length),data:{type:'portal-reminder'},android:{priority:'high',ttl:'3600s',collapse_key:'h2o-portal'}}}),redirect:'manual',signal:AbortSignal.timeout(8000)});
 }
 g.AndroidPush={endpoint,isEndpoint,ready,send};
})(globalThis);
