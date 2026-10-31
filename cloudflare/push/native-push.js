/* Native APNs transport. No member data is placed in lock-screen payloads. */
(function(g){
 'use strict';
 const token=value=>typeof value==='string'&&/^[a-f0-9]{32,512}$/.test(value)&&value.length%2===0;
 const endpoint=value=>token(value)?'https://api.push.apple.com/3/device/'+value:null;
 const isEndpoint=value=>typeof value==='string'&&value.startsWith('https://api.push.apple.com/3/device/')&&endpoint(value.slice(36))===value;
 const ready=env=>/^[A-Z0-9]{10}$/.test(env.H2O_APNS_KEY_ID||'')&&env.H2O_APNS_TEAM_ID==='VKL57X3H6F'&&typeof env.H2O_APNS_PRIVATE_KEY==='string'&&env.H2O_APNS_PRIVATE_KEY.includes('BEGIN PRIVATE KEY');
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
  if(!isEndpoint(url))throw Error('Ungültiges Apple-Mitteilungsgerät.');
  return fetch(url,{method:'POST',headers:{authorization:await authorization(env),'apns-topic':'de.feuerwehrwasser.h2o','apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(Date.now()/1000)+3600),'content-type':'application/json'},body:JSON.stringify({aps:{alert:{title:'H₂O · Feuerwehr Wasser',body:'Eine Mitteilung liegt vor. Bitte H₂O öffnen.'},sound:'default'}}),redirect:'error',signal:AbortSignal.timeout(8000)});
 }
 g.NativePush={endpoint,isEndpoint,ready,send};
})(globalThis);
