/* Member evidence overlay and encrypted audit trail. Server-owned eligibility and dates. */
(function(g){
 'use strict';
 const E=g.MemberEvidence,L=g.CentralLedger;
 const fields=['g262','g263','instruction','ffi','driver'];
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 const schema=[
  'CREATE TABLE IF NOT EXISTS portal_evidence_entries(member TEXT NOT NULL,field TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(member,field))',
  'CREATE TABLE IF NOT EXISTS portal_evidence_audit(member TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(member,id))'
 ];
 const allowed=(member,field,source)=>field==='driver'?!!member?.evidence?.driver:source==='member-checkbox'&&member?.agt===true&&!!member?.evidence?.breathing;
 function baseValue(member,field){
  if(field==='driver')return member?.evidence?.driver?.checkedOn||'';
  if(field==='g263')return member?.evidence?.breathing?.g263??member?.evidence?.medical?.g263??'';
  if(field==='g262')return member?.evidence?.medical?.g262||'';
  return member?.evidence?.breathing?.[field]||'';
 }
 function revisions(member,old){return Object.fromEntries(fields.map(field=>{
  const changed=old&&(baseValue(member,field)!==baseValue(old,field)||(field==='driver'?JSON.stringify(member.evidence?.driver?.vehicles)!==JSON.stringify(old.evidence?.driver?.vehicles):Boolean(member.agt)!==Boolean(old.agt)));
  return [field,(old?.evidenceRevisions?.[field]||1)+(changed?1:0)];
 }));}
 async function rows(env,member){return (await env.DB.prepare('SELECT member,field,version,payload FROM portal_evidence_entries'+(member?' WHERE member=?':'')).bind(...(member?[member]:[])).all()).results;}
 async function view(env,member,roster,providedRows){
  const evidence=member?.evidence?E.validate(member.evidence):null,entries={},eligibility={agt:roster?.agtSource==='member-checkbox'&&member?.agt===true,driver:!!evidence?.driver};
  const latest=providedRows||await rows(env,member.id);
  for(const field of fields){
   const row=latest.find(r=>r.member===member.id&&r.field===field),entry=row?await L.open(env,row.payload,'evidence:'+member.id+':'+field):null;
   const active=entry&&entry.baseRevision===(member.evidenceRevisions?.[field]||1)&&allowed(member,field,roster?.agtSource);
   entries[field]={version:row?.version||0,source:active?entry.source:'admin',status:active?entry.status:'confirmed',checkedOn:active?entry.checkedOn:'',until:active?entry.until:baseValue(member,field),controller:active?entry.controller:'',updatedAt:active?entry.updatedAt:member.evidenceUpdatedAt||null};
   if(!active||!evidence)continue;
   const value=entry.status==='rejected'||field==='driver'&&entry.status!=='confirmed'?entry.confirmedValue||baseValue(member,field):field==='driver'?entry.checkedOn:entry.until;
   if(field==='driver'){if(evidence.driver)evidence.driver.checkedOn=value;}
   else if(field==='g262')evidence.medical.g262=value;
   else if(field==='g263'){evidence.medical.g263=value;if(evidence.breathing)evidence.breathing.g263=value;}
   else if(evidence.breathing)evidence.breathing[field]=value;
  }
  return {evidence,entries,eligibility,syncedAt:member.evidenceUpdatedAt||null,servedAt:Date.now()};
 }
 async function history(env,member){
  const records=(await env.DB.prepare('SELECT payload FROM portal_evidence_audit WHERE member=? ORDER BY created_at DESC,id DESC LIMIT 30').bind(member).all()).results;
  return Promise.all(records.map(async row=>{const e=await L.open(env,row.payload,'evidence-audit:'+member);return {field:e.field,source:e.entry.source,status:e.entry.status,checkedOn:e.entry.checkedOn,until:e.entry.until,controller:e.entry.controller,updatedAt:e.entry.updatedAt};}));
 }
 async function read(env,member,roster){if(!member)fail('Mitglied nicht mehr freigegeben.',403);return {...await view(env,member,roster),history:await history(env,member.id)};}
 async function overview(env,roster){
  if(!Array.isArray(roster?.members))fail('Mitglieder sind noch nicht mit dem Portal abgeglichen.',503);
  const members=new Map(roster.members.map(member=>[member.id,member])),items=[];
  for(const row of await rows(env)){
   const member=members.get(row.member);
   if(!member||!fields.includes(row.field)||!allowed(member,row.field,roster.agtSource))continue;
   const entry=await L.open(env,row.payload,'evidence:'+member.id+':'+row.field);
   if(entry.baseRevision!==(member.evidenceRevisions?.[row.field]||1)||entry.source!=='self'||!['pending','reported'].includes(entry.status))continue;
   items.push({memberId:member.id,name:member.name,field:row.field,version:row.version,status:entry.status,checkedOn:entry.checkedOn,until:entry.until,updatedAt:entry.updatedAt,confirmedValue:entry.confirmedValue||baseValue(member,row.field)});
  }
  items.sort((a,b)=>b.updatedAt-a.updatedAt||a.name.localeCompare(b.name,'de')||a.field.localeCompare(b.field));
  return {items,count:items.length,memberCount:new Set(items.map(item=>item.memberId)).size,servedAt:Date.now()};
 }
 function dates(data,field){
  const checkedOn=E.date(data.checkedOn),today=E.day(Date.now());
  if(!checkedOn||checkedOn>today||checkedOn<'2000-01-01')fail('Bitte das tatsächliche Nachweisdatum eintragen; kein zukünftiges Datum.');
  let until=field==='driver'?'':E.due(checkedOn,12);
  if(field==='g262'||field==='g263'){
   until=E.monthEnd(data.validMonth);
   if(!until||until<checkedOn||until>E.monthEnd(E.due(checkedOn,36).slice(0,7)))fail('Bitte die dokumentierte Gültigkeit als Monat/Jahr eintragen (höchstens 36 Monate).');
  }
  if(data.controller!==undefined&&typeof data.controller!=='string')fail('Ungültige Kontrollperson.');
  const controller=field==='driver'?(data.controller||'').trim():'';
  if(controller.length>80||/[\x00-\x1f<>]/.test(controller))fail('Bitte eine kurze gültige Angabe zur Kontrollperson eintragen.');
  return {checkedOn,until,controller};
 }
 async function write(env,member,roster,data,admin,meta){
  if(!member)fail('Mitglied nicht mehr freigegeben.',403);
  const field=data.field;
  if(!fields.includes(field)||!allowed(member,field,roster.agtSource))fail('Dieser Nachweis ist für das Mitglied nicht zur Eingabe freigegeben.',403);
  const allowedKeys=['alias','revision','source','memberId','field','requestId','expectedVersion','action','checkedOn','validMonth','controller','responsibility'];
  if(Object.keys(data).some(k=>!allowedKeys.includes(k)))fail('Nicht unterstützte Nachweisangabe.');
  if(!admin&&Object.hasOwn(data,'memberId'))fail('Es können nur eigene Nachweise geändert werden.',403);
  if(typeof data.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestId)||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Ungültige Speichernummer oder Nachweisversion.');
  const action=admin?data.action:'report';
  if(admin&&!['confirm','reject','correct'].includes(action)||!admin&&(data.action&&data.action!=='report'||data.responsibility!==true))fail('Bitte die Richtigkeit der eigenen Angaben bestätigen.');
  const signature=JSON.stringify({field,action,expectedVersion:data.expectedVersion,checkedOn:data.checkedOn||'',validMonth:data.validMonth||'',controller:data.controller||'',responsibility:!admin});
  const previous=await env.DB.prepare('SELECT payload FROM portal_evidence_audit WHERE member=? AND id=?').bind(member.id,data.requestId).first();
  if(previous){const saved=await L.open(env,previous.payload,'evidence-audit:'+member.id);if(saved.signature!==signature||saved.entry.source!==(admin?'admin':'self'))fail('Diese Speichernummer gehört zu einer anderen Änderung.',409);return {ok:true,receipt:data.requestId,...await read(env,member,roster)};}
  if(!admin){const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM portal_evidence_audit WHERE member=? AND created_at>?').bind(member.id,Date.now()-86400000).first();if(count.total>=20)fail('Zu viele Nachweisänderungen. Bitte später erneut versuchen oder die Verwaltung kontaktieren.',429);}
  const row=await env.DB.prepare('SELECT member,field,version,payload FROM portal_evidence_entries WHERE member=? AND field=?').bind(member.id,field).first();
  if((row?.version||0)!==data.expectedVersion)fail('Der Nachweis wurde inzwischen geändert. Bitte neu laden und die aktuelle Angabe prüfen.',409);
  const old=row?await L.open(env,row.payload,'evidence:'+member.id+':'+field):null;
  let value;
  if(admin&&action!=='correct'){
   if(!old||old.baseRevision!==(member.evidenceRevisions?.[field]||1)||old.source!=='self'||old.status==='rejected')fail('Keine aktuelle Eigenangabe zur Bestätigung vorhanden.',409);
   value={checkedOn:old.checkedOn,until:old.until,controller:old.controller};
  }else value=dates(data,field);
  const entry={...value,source:admin?'admin':'self',status:admin?action==='reject'?'rejected':'confirmed':field==='driver'?'pending':'reported',updatedAt:Date.now(),baseRevision:member.evidenceRevisions?.[field]||1};
  entry.confirmedValue=admin&&action!=='reject'?(field==='driver'?entry.checkedOn:entry.until):old?.baseRevision===entry.baseRevision?old.confirmedValue||baseValue(member,field):baseValue(member,field);
  const payload=await L.seal(env,entry,'evidence:'+member.id+':'+field),audit=await L.seal(env,{field,entry,before:old||{source:'admin',until:baseValue(member,field)},signature},'evidence-audit:'+member.id);
  const guard='EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state=\'active\') AND EXISTS(SELECT 1 FROM portal_roster WHERE id=1 AND payload=?)';
  const original=await env.DB.prepare('SELECT payload FROM portal_roster WHERE id=1').first();
  // The roster used for authorization must still match the current stored snapshot.
  const actual=await L.open(env,original.payload,'portal-roster');
  if(JSON.stringify(actual)!==JSON.stringify(roster))fail('Mitgliederfreigabe wurde geändert. Bitte neu laden.',409);
  const next=data.expectedVersion+1;
  const statements=[env.DB.prepare('INSERT INTO portal_evidence_entries(member,field,version,payload) SELECT ?,?,?,? WHERE '+guard+(row?' AND EXISTS(SELECT 1 FROM portal_evidence_entries WHERE member=? AND field=? AND version=?)':' AND NOT EXISTS(SELECT 1 FROM portal_evidence_entries WHERE member=? AND field=?)')+' ON CONFLICT(member,field) DO UPDATE SET version=excluded.version,payload=excluded.payload').bind(member.id,field,next,payload,meta.seq,original.payload,member.id,field,...(row?[data.expectedVersion]:[])),
   env.DB.prepare('INSERT INTO portal_evidence_audit(member,id,payload,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM portal_evidence_entries WHERE member=? AND field=? AND payload=?)').bind(member.id,data.requestId,audit,entry.updatedAt,member.id,field,payload)];
  const result=await env.DB.batch(statements);
  if(!result[0].meta.changes)fail('Nachweis oder Mitgliederfreigabe wurde gleichzeitig geändert. Bitte neu laden.',409);
  return {ok:true,receipt:data.requestId,...await read(env,member,roster)};
 }
 g.PortalEvidence={schema,fields,revisions,rows,view,read,overview,write};
})(globalThis);
