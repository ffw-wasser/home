/* Cloudflare Workers Free + D1 Free. Financial records are encrypted at rest. */
const ORIGIN='https://ffw-wasser.github.io',ALIAS=/^[a-f0-9]{32}$/,REV=/^[a-zA-Z0-9-]{8,80}$/;
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function hash(s){return b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
function endpoint(value){let u;try{u=new URL(value);}catch{throw new Error('Ungültige Geräte-Adresse.');}const h=u.hostname;const allowed=h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h==='push.services.mozilla.com'||/^[a-z0-9-]+\.push\.apple\.com$/.test(h)||h==='web.push.apple.com';if(u.protocol!=='https:'||!allowed||u.port||u.username||u.password||u.hash||value.length>2048)throw new Error('Geräte-Adresse wird nicht unterstützt.');return u.href;}
async function capability(env,alias,revision,purpose='push'){const key=await crypto.subtle.importKey('raw',enc.encode(env.INVITE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',key,enc.encode('deckel-'+purpose+'-v1:'+alias+':'+revision)));}
async function vapid(env,url){const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const token=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64(enc.encode(JSON.stringify({aud:new URL(url).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'https://ffw-wasser.github.io/home/'})));const signature=b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(token)));return 'vapid t='+token+'.'+signature+', k='+env.VAPID_PUBLIC_KEY;}
async function body(request){const raw=await request.text();if(raw.length>6000)throw new Error('Anfrage zu groß.');const data=JSON.parse(raw);if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Ungültige Anfrage.');return data;}
async function account(env,alias){return env.DB.prepare('SELECT alias, revision, last_sent FROM accounts WHERE alias=?').bind(alias).first();}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin===ORIGIN){headers['Access-Control-Allow-Origin']=ORIGIN;headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&origin!==ORIGIN)return reply({error:'Zugriff nicht erlaubt.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:origin===ORIGIN?204:403,headers});
  const path=new URL(request.url).pathname;
  try{
   if(!env.DB||!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<40||!env.INVITE_SECRET||env.INVITE_SECRET.length<40||!env.VAPID_PRIVATE_JWK||!env.VAPID_PUBLIC_KEY)return reply({error:'Versanddienst noch nicht eingerichtet.'},503);
   if(path==='/health'&&request.method==='GET'){await env.DB.prepare('SELECT alias FROM accounts LIMIT 1').first();await env.DB.prepare('SELECT id FROM commands LIMIT 1').first();await vapid(env,'https://web.push.apple.com/');if(globalThis.CentralLedger)await env.DB.prepare('SELECT id FROM ledger_meta LIMIT 1').first();return reply({version:1,commandsVersion:1,...(globalThis.CentralLedger?{centralVersion:1}:{}),publicKey:env.VAPID_PUBLIC_KEY});}
   if(request.method!=='POST')return reply({error:'Nicht gefunden.'},404);
   const admin=path.startsWith('/admin/');const auth=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
   if(admin&&!equal(auth,env.ADMIN_TOKEN))return reply({error:'Admin-Zugang ungültig.'},401);
   if(path==='/admin/check')return reply({version:1,publicKey:env.VAPID_PUBLIC_KEY});
   if(globalThis.CentralLedger&&(path.startsWith('/admin/central/')||path==='/central/snapshot'||path.startsWith('/commands/'))){
    const raw=await request.clone().text();if(raw.length>(admin?8000000:6000))return reply({error:'Anfrage zu groß.'},413);
    const value=JSON.parse(raw);
    try{const result=await globalThis.CentralLedger.route(path,value,env,auth,request.url);if(result!==null)return reply(result);}
    catch(error){return reply({error:error.status?error.message:'Kontodienst derzeit nicht erreichbar. Bitte denselben Vorgang erneut prüfen.'},error.status||503);}
   }
   const data=await body(request);
   if(path==='/admin/commands/pending'){
    const rows=(await env.DB.prepare("SELECT c.alias,c.revision,c.id,c.envelope,c.created_at FROM commands c JOIN accounts a ON a.alias=c.alias AND a.revision=c.revision WHERE c.status='pending' ORDER BY c.created_at,c.id LIMIT 20").all()).results;
    return reply({commands:rows});
   }
   if(!ALIAS.test(data.alias||''))return reply({error:'Kontokennung ungültig.'},400);
   if(path==='/admin/account'){
    if(!REV.test(data.revision||''))return reply({error:'Zugangsversion ungültig.'},400);
    // Rotating a member link also removes old push devices. Same revision is idempotent.
    await env.DB.batch([
     env.DB.prepare('INSERT OR IGNORE INTO retired(alias,revision) SELECT alias,revision FROM accounts WHERE alias=? AND revision<>? AND NOT EXISTS(SELECT 1 FROM retired WHERE alias=? AND revision=?)').bind(data.alias,data.revision,data.alias,data.revision),
     env.DB.prepare('DELETE FROM devices WHERE alias=? AND revision<>? AND NOT EXISTS(SELECT 1 FROM retired WHERE alias=? AND revision=?)').bind(data.alias,data.revision,data.alias,data.revision),
     env.DB.prepare('INSERT INTO accounts(alias,revision,last_sent) SELECT ?,?,0 WHERE NOT EXISTS(SELECT 1 FROM retired WHERE alias=? AND revision=?) ON CONFLICT(alias) DO UPDATE SET revision=excluded.revision').bind(data.alias,data.revision,data.alias,data.revision)
    ]);
    if((await account(env,data.alias))?.revision!==data.revision)return reply({error:'Dieser Handyzugang wurde bereits ersetzt. Bitte neu öffnen.'},409);
    const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM devices WHERE alias=? AND revision=?').bind(data.alias,data.revision).first();
    return reply({capability:await capability(env,data.alias,data.revision),actionCapability:await capability(env,data.alias,data.revision,'commands'),devices:row.count});
   }
   const record=await account(env,data.alias);if(!record)return reply({error:'Handyzugang noch nicht für Erinnerungen eingerichtet.'},404);
   if(path==='/commands/submit'||path==='/commands/status'||path==='/admin/commands/ack'){
    if(!REV.test(data.id||'')||data.revision!==record.revision)return reply({error:'Zugang oder Vorgang nicht mehr gültig.'},409);
    if(!admin&&!equal(auth,await capability(env,data.alias,record.revision,'commands')))return reply({error:'Buchungszugang ungültig. Deckel am iPad aktualisieren.'},401);
    const old=await env.DB.prepare('SELECT status,result,digest FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();
    if(path==='/commands/status')return old?reply({status:old.status,result:old.result}):reply({status:'missing'});
    if(path==='/admin/commands/ack'){
     if(!['done','rejected'].includes(data.status)||!['','invalid','expired','pointsChanged','correctionChanged','accessChanged'].includes(data.result||''))return reply({error:'Ungültiger Abschluss.'},400);
     await env.DB.prepare("UPDATE commands SET status=?,result=?,envelope='' WHERE alias=? AND revision=? AND id=? AND status='pending'").bind(data.status,data.result||'',data.alias,data.revision,data.id).run();return reply({ok:true});
    }
    const envelope=JSON.stringify(data.envelope);if(data.envelope?.version!==1||typeof data.envelope.iv!=='string'||data.envelope.iv.length!==16||typeof data.envelope.data!=='string'||data.envelope.data.length!==5484)return reply({error:'Ungültige verschlüsselte Buchung.'},400);
    const digest=await hash(envelope);if(old)return equal(digest,old.digest)?reply({status:old.status,result:old.result}):reply({error:'Vorgangsnummer bereits verwendet.'},409);
    const now=Date.now();const result=await env.DB.prepare("INSERT OR IGNORE INTO commands(alias,revision,id,envelope,digest,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM commands WHERE alias=? AND status='pending')<30 AND NOT EXISTS(SELECT 1 FROM commands WHERE alias=? AND created_at>?)").bind(data.alias,data.revision,data.id,envelope,digest,now,data.alias,data.alias,now-2000).run();
    if(!result.meta.changes)return reply({error:'Bitte kurz warten oder offene Vorgänge synchronisieren lassen.'},429);
    return reply({status:'pending'});
   }
   if(path==='/subscribe'||path==='/unsubscribe'){
    if(!equal(auth,await capability(env,data.alias,record.revision)))return reply({error:'Dieser Erinnerungszugang ist abgelaufen. Bitte den QR-Code erneut scannen.'},401);
    const url=endpoint(data.endpoint),id=await hash(url);
    if(path==='/unsubscribe'){await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(id,data.alias).run();return reply({ok:true});}
    const old=await env.DB.prepare('SELECT alias FROM devices WHERE id=?').bind(id).first();if(old&&old.alias!==data.alias)return reply({error:'Auf diesem Handy ist bereits ein anderes Konto verknüpft. Bitte dort zuerst Erinnerungen deaktivieren.'},409);
    const result=await env.DB.prepare('INSERT INTO devices(id,alias,revision,endpoint) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE alias=?)<5 ON CONFLICT(id) DO UPDATE SET revision=excluded.revision').bind(id,data.alias,record.revision,url,data.alias).run();
    if(!result.meta.changes&&!old)return reply({error:'Maximal fünf Geräte je Deckel. Bitte ein altes Gerät deaktivieren.'},409);
    return reply({ok:true});
   }
   if(path==='/admin/status'){const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM devices WHERE alias=? AND revision=?').bind(data.alias,record.revision).first();return reply({devices:row.count,lastSent:record.last_sent||null});}
   if(path==='/admin/send'){
    if(!REV.test(data.requestId||''))return reply({error:'Versandkennung ungültig.'},400);
    const previous=await env.DB.prepare('SELECT status, accepted, failed FROM sends WHERE id=? AND alias=?').bind(data.requestId,data.alias).first();if(previous)return reply({duplicate:true,...previous});
    const devices=(await env.DB.prepare('SELECT id,endpoint FROM devices WHERE alias=? AND revision=? LIMIT 5').bind(data.alias,record.revision).all()).results;
    if(!devices.length)return reply({error:'Das Mitglied hat noch keine Erinnerungen aktiviert.'},409);
    const now=Date.now();
    // Atomic cooldown. Only manual admin requests can reserve a send.
    const reserved=await env.DB.prepare('UPDATE accounts SET last_sent=? WHERE alias=? AND last_sent<?').bind(now,data.alias,now-60000).run();if(!reserved.meta.changes)return reply({error:'Bitte mindestens eine Minute bis zur nächsten Erinnerung warten.'},429);
    await env.DB.prepare("INSERT INTO sends(id,alias,status,accepted,failed,created_at) VALUES(?,?,'pending',0,0,?)").bind(data.requestId,data.alias,now).run();
    let accepted=0,failed=0;
    for(const device of devices){
     try{const url=endpoint(device.endpoint);const response=await fetch(url,{method:'POST',headers:{Authorization:await vapid(env,url),TTL:'86400',Urgency:'normal',Topic:'deckel-reminder'},body:null,redirect:'manual',signal:AbortSignal.timeout(8000)});
      if(response.ok)accepted++;else {
       failed++;
       // Only protocol errors, never endpoints, account IDs or credentials.
       let reason='';try{const error=await response.json();const known=['BadAuthorizationHeader','BadJwtToken','BadVapidPublicKey','BadTtl','BadTopic','BadUrgency','BadCryptoKey','BadEncryption','BadContentEncoding','BadRequest','PayloadTooLarge','ExpiredToken','Unregistered','NotFound','Forbidden','TooManyRequests'];if(known.includes(error.reason))reason=error.reason;}catch{}
       console.warn('Deckel-Push abgelehnt',JSON.stringify({httpStatus:response.status,...(reason?{reason}:{})}));
       if([404,410].includes(response.status))await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(device.id,data.alias).run();
      }
     }catch(error){
      failed++;
      const knownNames=['Error','TypeError','SyntaxError','DataError','OperationError','InvalidAccessError','NotSupportedError','TimeoutError','AbortError'];
      const message=String(error?.message||'');
      const reason=!/^B[A-Za-z0-9_-]{86}$/.test(env.VAPID_PUBLIC_KEY)?'public-key-format':
       /header/i.test(message)?'header':
       /JWK|key data|private key/i.test(message)?'signing-key':
       /timeout.*not a function/i.test(message)?'timeout-api':
       /network connection lost/i.test(message)?'connection-lost':
       /DNS|resolve hostname|name resolution/i.test(message)?'dns':
       /TLS|SSL|certificate/i.test(message)?'tls':
       /redirect/i.test(message)?'redirect':
       /fetch failed/i.test(message)?'fetch-failed':'unknown';
      console.warn('Deckel-Push Netzwerkfehler',JSON.stringify({code:['TimeoutError','AbortError'].includes(error?.name)?'timeout':'network',name:knownNames.includes(error?.name)?error.name:'unknown',reason}));
     }
    }
    const status=accepted?'accepted':'failed';await env.DB.prepare('UPDATE sends SET status=?,accepted=?,failed=? WHERE id=?').bind(status,accepted,failed,data.requestId).run();
    await env.DB.prepare('DELETE FROM sends WHERE created_at<?').bind(now-30*86400000).run();
    return reply({status,accepted,failed});
   }
   return reply({error:'Nicht gefunden.'},404);
  }catch(error){return reply({error:error.message?.startsWith('Ungültig')||error.message==='Geräte-Adresse wird nicht unterstützt.'?error.message:'Dienst derzeit nicht erreichbar. Bitte später erneut prüfen.'},400);}
 }
};
