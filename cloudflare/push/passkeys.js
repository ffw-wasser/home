/* Shared WebAuthn identity; calendar sessions never confer portal authority. Private keys and biometric data never leave the authenticator. */
(function(g){
 'use strict';
 const RP='ffw-wasser.github.io',ORIGIN='https://ffw-wasser.github.io',TTL=300000;
 const fail=(message='Passkey konnte nicht bestätigt werden. Bitte erneut versuchen.',status=401)=>{throw Object.assign(Error(message),{status});};
 const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
 const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const schema=[
 'CREATE TABLE IF NOT EXISTS portal_identity_members (member TEXT PRIMARY KEY)',
 'CREATE TABLE IF NOT EXISTS portal_identity_grants (id TEXT PRIMARY KEY,alias TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS portal_identity_tickets (id TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,generation INTEGER NOT NULL,expires_at INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS portal_identity_sessions (token_hash TEXT PRIMARY KEY,alias TEXT NOT NULL,revision TEXT NOT NULL,credential TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)',
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
   ...['portal_identity_sessions','portal_identity_grants','portal_identity_tickets','portal_passkeys','portal_passkey_challenges','portal_browser_sessions','portal_browser_pairs'].map(t=>env.DB.prepare('DELETE FROM '+t+' WHERE alias=?').bind(record.alias))
  ]);return {ok:true};
 }
 // Only a fresh, independently approved WebAuthn assertion can issue a portal session.
 async function session(env,token){
  await g.PortalService.ready(env);
  if(!/^[\w-]{43}$/.test(token||''))return null;
  const row=await env.DB.prepare('SELECT s.* FROM portal_identity_sessions s JOIN portal_passkeys p ON p.id=s.credential AND p.alias=s.alias AND p.revision=s.revision JOIN portal_identity_grants g ON g.id=p.id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash('portal-session:'+token),Date.now()).first();
  if(!row)return null;
  return {row,record:await owner(env,row.alias,row.revision)};
 }
 async function authorize(env,data,auth,legacy){
  const active=await session(env,auth);
  if(active){if(active.record.alias!==data.alias||data.revision&&active.record.revision!==data.revision)fail();return active;}
  fail('Bitte mit deinem H₂O-Passkey anmelden.',401);
 }
 async function migrated(env,record){return !!await env.DB.prepare('SELECT member FROM portal_identity_members WHERE member=?').bind(record.memberId).first();}
 async function ticket(env,code){
  if(typeof code!=='string'||!/^[\w-]{43}$/.test(code))fail('Einmalige Freigabe der Verwaltung erforderlich.',403);
  const row=await env.DB.prepare('SELECT * FROM portal_identity_tickets WHERE id=? AND expires_at>?').bind(await hash('portal-ticket:'+code),Date.now()).first();
  if(!row||row.generation!==await generation(env,row.alias))fail('Freigabe abgelaufen oder bereits verwendet.',403);
  return {...row,record:await owner(env,row.alias,row.revision)};
 }
 function recent(active){if(!active||active.row.created_at<Date.now()-TTL)fail('Bitte für diese Sicherheitsänderung erneut mit Passkey anmelden.',401);}
 async function admin(env,data){
  const record=await owner(env,data.alias,data.revision);
  if(data.reset===true)await revoke(env,record); // Enrollment marker intentionally survives recovery.
  const code=random(),id=await hash('portal-ticket:'+code),expiresAt=Date.now()+10*60000,epoch=await generation(env,record.alias);
  await env.DB.batch([env.DB.prepare('DELETE FROM portal_identity_tickets WHERE alias=? OR expires_at<?').bind(record.alias,Date.now()),env.DB.prepare('INSERT INTO portal_identity_tickets(id,alias,revision,generation,expires_at) VALUES(?,?,?,?,?)').bind(id,record.alias,record.revision,epoch,expiresAt)]);
  return {code,expiresAt};
 }
 async function identity(path,data,env,auth){
  if(path==='portal/login/options')return challenge(env,'portal-login',await WebAuthnServer.generateAuthenticationOptions({rpID:RP,userVerification:'required'}));
  if(path==='portal/login/verify')return route('login/verify',data,env,null,true,null,auth);
  let active=await session(env,auth);
  if(path.startsWith('enroll/')){
   const approval=data.code?await ticket(env,data.code):null;
   if(!approval){recent(active);}
   const record=approval?.record||active.record;
   return route(path.replace('enroll/','register/'),data,env,record,false,{approval,active});
  }
  if(!active)fail('Sitzung abgelaufen. Bitte mit Passkey anmelden.',401);
  const {record,row}=active;
  if(data.alias&&data.alias!==record.alias)fail();
  if(path==='session')return {alias:record.alias,revision:record.revision,key:record.key,expiresAt:row.expires_at};
  if(path==='logout'){await env.DB.prepare('DELETE FROM portal_identity_sessions WHERE token_hash=?').bind(row.token_hash).run();return {ok:true};}
  if(path==='devices'){
   const keys=(await env.DB.prepare('SELECT p.id FROM portal_passkeys p JOIN portal_identity_grants g ON g.id=p.id WHERE p.alias=? AND p.revision=?').bind(record.alias,record.revision).all()).results;
   return {keys:keys.map(k=>({id:k.id,current:k.id===row.credential})),expiresAt:row.expires_at};
  }
  if(path==='sessions/revoke'){recent(active);await env.DB.batch([env.DB.prepare('DELETE FROM portal_identity_sessions WHERE alias=? AND token_hash<>?').bind(record.alias,row.token_hash),env.DB.prepare('DELETE FROM portal_browser_sessions WHERE alias=?').bind(record.alias)]);return {ok:true};}
  if(path==='remove'){
   recent(active);
   const id=data.credential;
   if(typeof id!=='string'||id===row.credential)fail('Den aktuell verwendeten Passkey bitte behalten. Bei Verlust hilft die Verwaltung.',400);
   await env.DB.batch([env.DB.prepare('DELETE FROM portal_passkeys WHERE id=? AND alias=?').bind(id,record.alias),env.DB.prepare('DELETE FROM portal_identity_grants WHERE id=? AND alias=?').bind(id,record.alias),env.DB.prepare('DELETE FROM portal_identity_sessions WHERE credential=? AND alias=?').bind(id,record.alias),env.DB.prepare('DELETE FROM portal_browser_sessions WHERE alias=?').bind(record.alias)]);
   return {ok:true};
  }
  fail('Nicht gefunden.',404);
 }
 async function route(path,data,env,record,portal=false,enrollment=null,replaceAuth=null){
  const W=WebAuthnServer;
  if(path==='status'){const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM portal_passkeys WHERE alias=? AND revision=?').bind(record.alias,record.revision).first();return {passkeys:row.n};}
  if(path==='revoke'){if(await migrated(env,record))fail('Passkeys bitte unter Konto → Sicherheit verwalten.',403);return revoke(env,record);}
  if(path==='register/options'){
   const rows=(await env.DB.prepare('SELECT id FROM portal_passkeys WHERE alias=? AND revision=?').bind(record.alias,record.revision).all()).results;
   if(rows.length>=5)fail('Bereits fünf Passkeys eingerichtet. Bei Bedarf Konto → Sicherheit öffnen.',429);
   const userID=bytes(await hash('passkey-user:'+record.alias+':'+record.revision));
   const options=await W.generateRegistrationOptions({rpName:'H₂O Portal',rpID:RP,userID,userName:'H₂O '+record.alias.slice(0,6),attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:rows.map(r=>({id:r.id})),authenticatorSelection:{residentKey:'required',userVerification:'required'}});
   return challenge(env,enrollment?'enroll:'+(enrollment.approval?.id||enrollment.active.row.token_hash):'register',options,record);
  }
  if(path==='register/verify'){
   const pending=await consume(env,data.id,enrollment?'enroll:'+(enrollment.approval?.id||enrollment.active.row.token_hash):'register',record);let result;
   try{result=await W.verifyRegistrationResponse({response:data.response,expectedChallenge:pending.challenge,expectedOrigin:ORIGIN,expectedRPID:RP,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});}catch{fail();}
   if(!result.verified||!result.registrationInfo)fail();
   const c=result.registrationInfo.credential;await owner(env,record.alias,record.revision);
   const guard=enrollment?.approval?' AND EXISTS(SELECT 1 FROM portal_identity_tickets WHERE id=? AND expires_at>?)':enrollment?' AND EXISTS(SELECT 1 FROM portal_identity_sessions WHERE token_hash=? AND expires_at>?)':'';
   const proof=enrollment?[enrollment.approval?.id||enrollment.active.row.token_hash,Date.now()]:[];
   const insert=env.DB.prepare('INSERT OR IGNORE INTO portal_passkeys(id,alias,revision,public_key,counter,user_id) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM portal_passkey_state WHERE alias=? AND generation=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?) AND (SELECT COUNT(*) FROM portal_passkeys WHERE alias=? AND revision=?)<5'+guard).bind(c.id,record.alias,record.revision,b64(c.publicKey),c.counter,b64(bytes(await hash('passkey-user:'+record.alias+':'+record.revision))),record.alias,pending.generation,record.alias,record.revision,record.alias,record.revision,...proof);
   const statements=[insert];
   if(enrollment){
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO portal_identity_grants(id,alias) SELECT ?,? WHERE EXISTS(SELECT 1 FROM portal_passkeys WHERE id=? AND alias=? AND public_key=?)'+guard).bind(c.id,record.alias,c.id,record.alias,b64(c.publicKey),...proof));
    if(enrollment.approval)statements.push(env.DB.prepare('DELETE FROM portal_identity_tickets WHERE id=? AND EXISTS(SELECT 1 FROM portal_identity_grants WHERE id=? AND alias=?)').bind(enrollment.approval.id,c.id,record.alias));
   }
   const inserted=await env.DB.batch(statements);
   if(!inserted[0].meta.changes)fail();return {ok:true};
  }
  if(path==='login/options')return challenge(env,'login',await W.generateAuthenticationOptions({rpID:RP,userVerification:'required'}));
  if(path==='login/verify'){
   const pending=await consume(env,data.id,portal?'portal-login':'login');
   if(typeof data.response?.id!=='string')fail();
   const row=await env.DB.prepare('SELECT * FROM portal_passkeys WHERE id=?').bind(data.response.id).first();if(!row)fail();
   if(data.response.response?.userHandle!==row.user_id)fail();
   await owner(env,row.alias,row.revision);let result;
   try{result=await W.verifyAuthenticationResponse({response:data.response,expectedChallenge:pending.challenge,expectedOrigin:ORIGIN,expectedRPID:RP,requireUserVerification:true,credential:{id:row.id,publicKey:bytes(row.public_key),counter:row.counter}});}catch{fail();}
   if(!result.verified)fail();
   if(portal)return issuePortal(env,row,result.authenticationInfo.newCounter,data,replaceAuth);
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
 async function issuePortal(env,key,newCounter,data,replaceAuth){
  const record=await owner(env,key.alias,key.revision),approval=data.code?await ticket(env,data.code):null;
  if(approval&&(approval.alias!==key.alias||approval.revision!==key.revision))fail('Freigabe gehört zu einem anderen Mitglied.',403);
  const grant=await env.DB.prepare('SELECT id FROM portal_identity_grants WHERE id=?').bind(key.id).first();
  if(!grant&&!approval)fail('Einmalige Portal-Freigabe durch die Verwaltung erforderlich. Bestehende Terminzugänge bleiben eingeschränkt.',403);
  const token=random(),tokenHash=await hash('portal-session:'+token),now=Date.now(),expiresAt=now+30*86400000;
  const permission=approval?'EXISTS(SELECT 1 FROM portal_identity_tickets WHERE id=? AND expires_at>?)':'EXISTS(SELECT 1 FROM portal_identity_grants WHERE id=?)';
  const args=approval?[approval.id,now]:[key.id];
  const guard='EXISTS(SELECT 1 FROM portal_passkeys WHERE id=? AND alias=? AND revision=? AND counter=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?) AND '+permission;
  const created='EXISTS(SELECT 1 FROM portal_identity_sessions WHERE token_hash=?)';
  // Rotate the caller's prior session only; other own devices stay signed in.
  let previous=null;try{previous=await session(env,replaceAuth);}catch{}
  const replace=previous?.record.alias===record.alias&&previous?.record.revision===record.revision?previous.row.token_hash:'';
  const statements=[env.DB.prepare('DELETE FROM portal_identity_sessions WHERE expires_at<? OR token_hash=?').bind(now,replace),
   env.DB.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) SELECT ?,?,?,?,?,? WHERE '+guard+' AND (SELECT COUNT(*) FROM portal_identity_sessions WHERE alias=?)<20').bind(tokenHash,key.alias,key.revision,key.id,now,expiresAt,key.id,key.alias,key.revision,key.counter,key.alias,key.revision,...args,key.alias),
   env.DB.prepare('UPDATE portal_passkeys SET counter=? WHERE id=? AND '+created).bind(newCounter,key.id,tokenHash),
   env.DB.prepare('INSERT OR IGNORE INTO portal_identity_grants(id,alias) SELECT ?,? WHERE '+created).bind(key.id,key.alias,tokenHash),
   env.DB.prepare('INSERT OR IGNORE INTO portal_identity_members(member) SELECT ? WHERE '+created).bind(record.memberId,tokenHash)];
  if(approval)statements.push(env.DB.prepare('DELETE FROM portal_identity_tickets WHERE id=? AND '+created).bind(approval.id,tokenHash));
  const results=await env.DB.batch(statements);if(!results[1].meta.changes)fail();
  return {token,alias:key.alias,revision:key.revision,expiresAt,scope:'portal'};
 }
 g.WhatsAppPasskeys={schema,limit,route,revoke,session,authorize,migrated,identity,admin};
})(globalThis);
