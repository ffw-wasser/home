/* Narrow, revocable access for the Google Calendar sidebar: read names and create groups only. */
(function(g){
 'use strict';
 const L=g.CentralLedger,fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const schema=[
  'CREATE TABLE IF NOT EXISTS portal_google_group_access (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS portal_google_group_receipts (connection TEXT NOT NULL,request TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(connection,request))'
 ];
 const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google-group-access:'+value))),n=>n.toString(16).padStart(2,'0')).join('');
 const open=(env,row)=>row?L.open(env,row.payload,'google-group-access:'+row.id):null;
 async function calendar(env){const c=await g.PortalService.config(env);if(!c)return null;return decodeURIComponent(new URL(c.calendarUrl).pathname.split('/')[3]);}
 async function state(env){const rows=(await env.DB.prepare('SELECT * FROM portal_google_group_access ORDER BY id').all()).results,connections=[];for(const row of rows){const value=await open(env,row);connections.push({id:row.id,label:value.label,version:row.version});}return {configured:!!await calendar(env),connections};}
 async function admin(env,data,source){
  if(data.revoke!==undefined){if(typeof data.revoke!=='string'||!Number.isSafeInteger(data.expectedVersion))fail('Ungültige Verbindung.',400);const row=await env.DB.prepare('SELECT * FROM portal_google_group_access WHERE id=?').bind(data.revoke).first();if(row&&row.version!==data.expectedVersion)fail('Die Verbindung wurde geändert. Bitte neu laden.');await env.DB.batch([env.DB.prepare('DELETE FROM portal_google_group_receipts WHERE connection=? AND EXISTS(SELECT 1 FROM portal_google_group_access WHERE id=? AND version=?)').bind(data.revoke,data.revoke,data.expectedVersion),env.DB.prepare('DELETE FROM portal_google_group_access WHERE id=? AND version=?').bind(data.revoke,data.expectedVersion)]);return {ok:true,...await state(env)};}
  if(data.create===true){
   const label=typeof data.label==='string'?data.label.trim():'';if(!label||label.length>80||/[<>\x00-\x1f]/.test(label)||! /^[A-Za-z0-9_-]{8,80}$/.test(data.requestId||''))fail('Bitte eine Bezeichnung für die Google-Verbindung eingeben.',400);
   const calendarId=await calendar(env);if(!calendarId)fail('Bitte zuerst den Feuerwehrkalender verbinden.',400);
   const row=await env.DB.prepare('SELECT * FROM portal_google_group_access WHERE id=?').bind(data.requestId).first();if(row){const value=await open(env,row);if(value.source!==source||value.calendarId!==calendarId||value.label!==label)fail('Die Vorgangskennung wurde bereits anders verwendet.');return {ok:true,token:value.token,id:row.id,...await state(env)};}
   const token=random(),payload=await L.seal(env,{token,label,source,calendarId},'google-group-access:'+data.requestId);
   const saved=await env.DB.prepare("INSERT OR IGNORE INTO portal_google_group_access(id,token_hash,payload) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM portal_google_group_access)<8 AND EXISTS(SELECT 1 FROM ledger_meta WHERE source=? AND state='active')").bind(data.requestId,await digest(token),payload,source).run();if(!saved.meta.changes)fail('Höchstens acht Verbindungen. Bitte Liste neu laden und nicht mehr benötigte Verbindungen trennen.');return {ok:true,token,id:data.requestId,...await state(env)};
  }
  return state(env);
 }
 async function authorize(env,token,calendarId,source){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))fail('Google-Gruppenverbindung nicht autorisiert.',401);
  const row=await env.DB.prepare('SELECT * FROM portal_google_group_access WHERE token_hash=?').bind(await digest(token)).first(),value=await open(env,row);if(!value||value.source!==source||value.calendarId!==calendarId||await calendar(env)!==calendarId)fail('Google-Gruppenverbindung nicht autorisiert.',401);return row;
 }
 async function route(env,data,token,source){
  const connection=await authorize(env,token,data.calendarId,source),current=await g.PortalService.groupData(env);
  if(data.action==='read')return {ok:true,groups:current.groups.filter(group=>group.enabled).map(group=>group.name),version:current.version,rosterRevision:await digest(current.rosterPayload||''),rosterUpdatedAt:current.rosterUpdatedAt,members:current.members.map(({id,name})=>({id,name}))};
  if(data.action!=='create')fail('Diese Verbindung erlaubt nur das Lesen der Gruppenauswahl und das Anlegen neuer Gruppen.',403);
  const name=typeof data.name==='string'?data.name.trim():'',ids=data.memberIds;
  if(!name||name.length>80||/[;<>\x00-\x1f\x7f]/.test(name)||!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||id.length>200)||! /^[A-Za-z0-9_-]{8,80}$/.test(data.requestId||''))fail('Bitte einen gültigen Gruppennamen und mindestens ein Mitglied auswählen.',400);
  const members=[...ids].sort(),receipt=await env.DB.prepare('SELECT payload FROM portal_google_group_receipts WHERE connection=? AND request=?').bind(connection.id,data.requestId).first();
  if(receipt){const value=await L.open(env,receipt.payload,'google-group-receipt:'+connection.id+':'+data.requestId);if(value.name!==name||JSON.stringify(value.memberIds)!==JSON.stringify(members))fail('Die Vorgangskennung wurde bereits für eine andere Gruppe verwendet.');if(!current.groups.some(group=>group.id===value.id))fail('Die Gruppe wurde inzwischen entfernt. Bitte neu laden.');return {ok:true,group:{id:value.id,name:value.name},version:current.version};}
  if(data.expectedVersion!==current.version||data.expectedRosterUpdatedAt!==current.rosterUpdatedAt||data.expectedRosterRevision!==await digest(current.rosterPayload||''))fail('Gruppen oder Mitglieder wurden inzwischen geändert. Bitte neu laden.');
  if(members.some(id=>!current.members.some(member=>member.id===id)))fail('Ein ausgewähltes Mitglied ist nicht mehr vorhanden. Bitte neu laden.',400);
  if(!current.rosterPayload)fail('Bitte zuerst die Mitglieder synchronisieren.',400);
  const group={id:'google-'+(await digest(connection.id+':'+data.requestId)).slice(0,32),name,source:'manual',memberIds:members,keywords:[],enabled:true,general:false};let groups;try{groups=g.PortalGroups.validate([...current.groups,group]);}catch(e){fail(e.message,400);}
  const payload=await L.seal(env,{groups},'portal-groups'),proof=await L.seal(env,{id:group.id,name,memberIds:members},'google-group-receipt:'+connection.id+':'+data.requestId);
  const guard="EXISTS(SELECT 1 FROM portal_google_group_access WHERE id=? AND token_hash=?) AND EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?) AND EXISTS(SELECT 1 FROM ledger_meta WHERE source=? AND state='active')";
  const write=current.version?env.DB.prepare('UPDATE portal_groups SET payload=?,version=version+1 WHERE id=1 AND version=? AND '+guard).bind(payload,current.version,connection.id,connection.token_hash,current.rosterPayload,source):env.DB.prepare('INSERT OR IGNORE INTO portal_groups(id,payload) SELECT 1,? WHERE '+guard).bind(payload,connection.id,connection.token_hash,current.rosterPayload,source);
  const result=await env.DB.batch([write,env.DB.prepare('INSERT OR IGNORE INTO portal_google_group_receipts(connection,request,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM portal_groups WHERE id=1 AND payload=?)').bind(connection.id,data.requestId,proof,payload)]);if(!result[0].meta.changes)fail('Gruppen, Mitglieder oder Verbindung wurden gleichzeitig geändert. Bitte neu laden.');
  return {ok:true,group:{id:group.id,name},version:current.version+1};
 }
 g.CalendarGroupAccess={schema,admin,route};
})(globalThis);
