/* WhatsApp-only WebAuthn. Private keys and biometric data never leave the authenticator. */
(function(g){
 'use strict';
 const RP='ffw-wasser.github.io',ORIGIN='https://ffw-wasser.github.io',TTL=300000;
 const fail=(message='Passkey konnte nicht bestätigt werden. Bitte erneut versuchen.',status=401)=>{throw Object.assign(Error(message),{status});};
 const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
 const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const schema=[
 'CREATE TABLE IF NOT EXISTS portal_passkey_state (alias TEXT PRIMARY KEY,generation INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS portal_passkeys (id TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,public_key TEXT NOT NULL,counter INTEGER NOT NULL,user_id TEXT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS portal_passkeys_alias ON portal_passkeys(alias,revision)',
 'CREATE TABLE IF NOT EXISTS portal_passkey_challenges (id TEXT PRIMARY KEY,challenge TEXT NOT NULL,kind TEXT NOT NULL,alias TEXT NOT NULL,revision TEXT NOT NULL,generation INTEGER NOT NULL,expires_at INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS portal_passkey_limits (id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)'
 ];
 async function limit(env,key){
  const now=Date.now(),id=await hash('passkey-rate:'+env.INVITE_SECRET+':'+key+':'+Math.floor(now/TTL));
  await env.DB.prepare('DELETE FROM portal_passkey_limits WHERE expires_at<?').bind(now).run();
  const row=await env.DB.prepare('INSERT INTO portal_passkey_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,now+TTL).first();
  if(row.count>30)fail('Zu viele Versuche. Bitte in fünf Minuten erneut versuchen.',429);
 }
 async function generation(env,alias){await env.DB.prepare('INSERT OR IGNORE INTO portal_passkey_state(alias,generation) VALUES(?,0)').bind(alias).run();return (await env.DB.prepare('SELECT generation FROM portal_passkey_state WHERE alias=?').bind(alias).first()).generation;}
 async function challenge(env,kind,options,record){
  const id=random(),now=Date.now(),epoch=record?await generation(env,record.alias):0;
  await env.DB.prepare('DELETE FROM portal_passkey_challenges WHERE expires_at<?').bind(now).run();
  await env.DB.prepare('INSERT INTO portal_passkey_challenges(id,challenge,kind,alias,revision,generation,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,options.challenge,kind,record?.alias||'',record?.revision||'',epoch,now+TTL).run();
  return {id,options};
 }
 async function consume(env,id,kind,record){
  if(typeof id!=='string'||!/^[\w-]{43}$/.test(id))fail();
  const row=await env.DB.prepare('DELETE FROM portal_passkey_challenges WHERE id=? AND kind=? AND expires_at>? RETURNING *').bind(id,kind,Date.now()).first();
  if(!row||record&&(row.alias!==record.alias||row.revision!==record.revision||row.generation!==await generation(env,record.alias)))fail();
  return row;
 }
 async function owner(env,alias,revision){
  const row=await env.DB.prepare('SELECT a.* FROM ledger_access a JOIN accounts c ON c.alias=a.alias AND c.revision=a.revision WHERE a.alias=? AND a.revision=?').bind(alias,revision).first();
  if(!row)fail();
  const record=await g.CentralLedger.open(env,row.payload,'access:'+alias);
  await g.PortalService.assertMember(env,record);
  return record;
 }
 async function revoke(env,record){
  await env.DB.batch([
   env.DB.prepare('INSERT INTO portal_passkey_state(alias,generation) VALUES(?,1) ON CONFLICT(alias) DO UPDATE SET generation=generation+1').bind(record.alias),
   ...['portal_passkeys','portal_passkey_challenges','portal_browser_sessions','portal_browser_pairs'].map(t=>env.DB.prepare('DELETE FROM '+t+' WHERE alias=?').bind(record.alias))
  ]);return {ok:true};
 }
 async function route(path,data,env,record){
  const W=WebAuthnServer;
  if(path==='status'){const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM portal_passkeys WHERE alias=? AND revision=?').bind(record.alias,record.revision).first();return {passkeys:row.n};}
  if(path==='revoke')return revoke(env,record);
  if(path==='register/options'){
   const rows=(await env.DB.prepare('SELECT id FROM portal_passkeys WHERE alias=? AND revision=?').bind(record.alias,record.revision).all()).results;
   if(rows.length>=5)fail('Bereits fünf Passkeys eingerichtet. Bei Bedarf den WhatsApp-Zugang zurücksetzen.',429);
   const userID=bytes(await hash('passkey-user:'+record.alias+':'+record.revision));
   const options=await W.generateRegistrationOptions({rpName:'H₂O WhatsApp-Termine',rpID:RP,userID,userName:'H₂O '+record.alias.slice(0,6),attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:rows.map(r=>({id:r.id})),authenticatorSelection:{residentKey:'required',userVerification:'required'}});
   return challenge(env,'register',options,record);
  }
  if(path==='register/verify'){
   const pending=await consume(env,data.id,'register',record);let result;
   try{result=await W.verifyRegistrationResponse({response:data.response,expectedChallenge:pending.challenge,expectedOrigin:ORIGIN,expectedRPID:RP,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});}catch{fail();}
   if(!result.verified||!result.registrationInfo)fail();
   const c=result.registrationInfo.credential;await owner(env,record.alias,record.revision);
   const inserted=await env.DB.prepare('INSERT OR IGNORE INTO portal_passkeys(id,alias,revision,public_key,counter,user_id) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM portal_passkey_state WHERE alias=? AND generation=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?) AND (SELECT COUNT(*) FROM portal_passkeys WHERE alias=? AND revision=?)<5').bind(c.id,record.alias,record.revision,b64(c.publicKey),c.counter,b64(bytes(await hash('passkey-user:'+record.alias+':'+record.revision))),record.alias,pending.generation,record.alias,record.revision,record.alias,record.revision).run();
   if(!inserted.meta.changes)fail();return {ok:true};
  }
  if(path==='login/options')return challenge(env,'login',await W.generateAuthenticationOptions({rpID:RP,userVerification:'required'}));
  if(path==='login/verify'){
   const pending=await consume(env,data.id,'login');
   if(typeof data.response?.id!=='string')fail();
   const row=await env.DB.prepare('SELECT * FROM portal_passkeys WHERE id=?').bind(data.response.id).first();if(!row)fail();
   if(data.response.response?.userHandle!==row.user_id)fail();
   await owner(env,row.alias,row.revision);let result;
   try{result=await W.verifyAuthenticationResponse({response:data.response,expectedChallenge:pending.challenge,expectedOrigin:ORIGIN,expectedRPID:RP,requireUserVerification:true,credential:{id:row.id,publicKey:bytes(row.public_key),counter:row.counter}});}catch{fail();}
   if(!result.verified)fail();
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),expiresAt=Date.now()+90*86400000;
   await env.DB.prepare('DELETE FROM portal_browser_sessions WHERE expires_at<?').bind(Date.now()).run();
   // Atomic counter CAS + session insert; reset/removal/rotation cannot resurrect credentials.
   const guard='EXISTS(SELECT 1 FROM portal_passkeys WHERE id=? AND alias=? AND revision=? AND counter=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?)';
   const resultDB=await env.DB.batch([
    env.DB.prepare('INSERT INTO portal_browser_sessions(token_hash,alias,revision,expires_at) SELECT ?,?,?,? WHERE '+guard+' AND (SELECT COUNT(*) FROM portal_browser_sessions WHERE alias=?)<10').bind(await hash('h2o-browser-session:'+token),row.alias,row.revision,expiresAt,row.id,row.alias,row.revision,row.counter,row.alias,row.revision,row.alias),
    env.DB.prepare('UPDATE portal_passkeys SET counter=? WHERE id=? AND counter=?').bind(result.authenticationInfo.newCounter,row.id,row.counter)
   ]);
   if(!resultDB[0].meta.changes)fail('Anmeldung nicht bestätigt. Bitte WhatsApp-Zugang in H₂O prüfen.',401);
   return {token,alias:row.alias,revision:row.revision,expiresAt};
  }
  fail('Nicht gefunden.',404);
 }
 g.WhatsAppPasskeys={schema,limit,route,revoke};
})(globalThis);
