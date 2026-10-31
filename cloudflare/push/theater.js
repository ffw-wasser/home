/* Immutable encrypted orders; reservations claim explicit order IDs in one D1 transaction. */
(function(g){
 'use strict';const M=g.TheaterModel,L=g.CentralLedger,readyDB=new WeakSet(),fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 async function ready(env){if(readyDB.has(env.DB))return;await env.DB.batch([
  'CREATE TABLE IF NOT EXISTS theater_events (id TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL,open INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS theater_orders (id TEXT PRIMARY KEY,event TEXT NOT NULL,member TEXT NOT NULL,payload TEXT NOT NULL,reservation TEXT,created_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS theater_orders_event ON theater_orders(event,member,reservation)',
  'CREATE TABLE IF NOT EXISTS theater_batches (id TEXT PRIMARY KEY,event TEXT NOT NULL,member TEXT NOT NULL,state TEXT NOT NULL,claim TEXT NOT NULL,created_at INTEGER NOT NULL)',
  "CREATE UNIQUE INDEX IF NOT EXISTS theater_one_reservation ON theater_batches(event,member) WHERE state='reserved'"
 ].map(q=>env.DB.prepare(q)));readyDB.add(env.DB);}
 async function event(env,id){const row=await env.DB.prepare('SELECT * FROM theater_events WHERE id=?').bind(id).first();return row?{...await L.open(env,row.payload,'theater-event:'+id),id,version:row.version}:null;}
 async function orders(env,id){const rows=(await env.DB.prepare("SELECT o.*,b.state FROM theater_orders o LEFT JOIN theater_batches b ON b.id=o.reservation WHERE o.event=? ORDER BY o.created_at,o.id").bind(id).all()).results;return Promise.all(rows.map(async r=>({...await L.open(env,r.payload,'theater-order:'+r.id),id:r.id,member:r.member,reservation:r.reservation,state:r.state||'open',createdAt:r.created_at})));}
 async function route(path,data,env,admin,record,roster){
  await ready(env);const action=path.split('/').pop();
  if(action==='events'){const rows=(await env.DB.prepare('SELECT id FROM theater_events'+(admin?'': ' WHERE open=1')+' ORDER BY id DESC').all()).results;return {events:await Promise.all(rows.map(r=>event(env,r.id)))};}
  if(!M.id(data.eventId))fail('Bitte eine Veranstaltung auswählen.',400);
  if(action==='save'){
   if(!admin)fail('Nur die Verwaltung darf Preise ändern.',403);let value;try{value=M.catalog(data.catalog);}catch(e){fail(e.message,400);}if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)fail('Version fehlt.',400);
   const payload=await L.seal(env,value,'theater-event:'+data.eventId),other="NOT EXISTS(SELECT 1 FROM theater_events WHERE open=1 AND id<>?)";
   const r=data.expectedVersion?await env.DB.prepare('UPDATE theater_events SET payload=?,version=version+1,open=? WHERE id=? AND version=?'+(value.open?' AND '+other:'')).bind(payload,+value.open,data.eventId,data.expectedVersion,...(value.open?[data.eventId]:[])).run():await env.DB.prepare('INSERT OR IGNORE INTO theater_events(id,payload,version,open) SELECT ?,?,1,?'+(value.open?' WHERE '+other:'')).bind(data.eventId,payload,+value.open,...(value.open?[data.eventId]:[])).run();
   if(!r.meta.changes)fail('Die Veranstaltung wurde inzwischen geändert oder eine andere Veranstaltung ist noch geöffnet. Bitte neu laden.');return {event:await event(env,data.eventId)};
  }
  if(action==='order'){
   if(admin)fail('Bestellungen bitte mit dem persönlichen Handyportal aufnehmen.',403);if(!M.id(data.requestId)||data.requestId.startsWith('cancel_'))fail('Bestellkennung fehlt.',400);
   const fingerprint=JSON.stringify({eventId:data.eventId,version:data.version,lines:data.lines}),old=await env.DB.prepare('SELECT * FROM theater_orders WHERE id=?').bind(data.requestId).first();
   if(old){const saved=await L.open(env,old.payload,'theater-order:'+old.id);if(old.member!==record.memberId||saved.fingerprint!==fingerprint)fail('Bestellkennung wurde bereits anders verwendet.');return {ok:true,id:old.id};}
   const current=await event(env,data.eventId);if(!current||!current.open)fail('Die Veranstaltung ist geschlossen.');if(current.version!==data.version)fail('Die Preisliste wurde geändert. Bitte neu laden und Bestellung prüfen.');
   let lines;try{lines=M.lines(current.items,data.lines);}catch(e){fail(e.message,400);}const name=roster?.members.find(m=>m.id===record.memberId)?.name;if(!name)fail('Mitglied ist nicht freigegeben.',403);
   const payload=await L.seal(env,{name,lines,fingerprint},'theater-order:'+data.requestId);
   const result=await env.DB.prepare('INSERT OR IGNORE INTO theater_orders(id,event,member,payload,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM theater_events WHERE id=? AND version=? AND open=1) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?)').bind(data.requestId,data.eventId,record.memberId,payload,Date.now(),data.eventId,data.version,record.alias,record.revision).run();
   if(!result.meta.changes){const duplicate=await env.DB.prepare('SELECT * FROM theater_orders WHERE id=?').bind(data.requestId).first();if(!duplicate||duplicate.member!==record.memberId||(await L.open(env,duplicate.payload,'theater-order:'+duplicate.id)).fingerprint!==fingerprint)fail('Bestellung nicht gespeichert. Preise oder Veranstaltung wurden geändert.');}return {ok:true,id:data.requestId};
  }
  if(!admin)fail('Nur die Kassenverwaltung darf diese Ansicht öffnen.',403);
  if(action==='list'){const current=await event(env,data.eventId);if(!current)fail('Veranstaltung nicht gefunden.',404);return {event:current,orders:await orders(env,data.eventId),servedAt:Date.now()};}
  if(action==='reset'){
   if(data.confirmation!=='ZURÜCKSETZEN'||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<1)fail('Zurücksetzen benötigt eine bestätigte aktuelle Veranstaltung.',400);
   const current=await event(env,data.eventId);if(!current)fail('Veranstaltung nicht gefunden.',404);
   if(current.version!==data.expectedVersion)fail('Die Veranstaltung wurde inzwischen geändert. Bitte neu laden.');
   // A unique encrypted reset marker gates all deletions within the same D1 transaction.
   // A concurrent reset or save cannot remove bookings without the successful versioned update.
   const payload=await L.seal(env,{title:current.title,open:false,items:current.items,resetNonce:crypto.randomUUID()},'theater-event:'+data.eventId);
   const guard='EXISTS(SELECT 1 FROM theater_events WHERE id=? AND version=? AND payload=? AND open=0)';
   const results=await env.DB.batch([
    env.DB.prepare('UPDATE theater_events SET payload=?,version=version+1,open=0 WHERE id=? AND version=?').bind(payload,data.eventId,data.expectedVersion),
    env.DB.prepare('DELETE FROM theater_orders WHERE event=? AND '+guard).bind(data.eventId,data.eventId,data.expectedVersion+1,payload),
    env.DB.prepare('DELETE FROM theater_batches WHERE event=? AND '+guard).bind(data.eventId,data.eventId,data.expectedVersion+1,payload)
   ]);
   if(!results[0].meta.changes)fail('Die Veranstaltung wurde zwischenzeitlich verändert. Bitte neu laden.');
   return {ok:true,event:await event(env,data.eventId),deleted:results[1].meta.changes};
  }
  if(action==='cancel'){
   if(!M.id(data.orderId))fail('Bestellkennung fehlt.',400);
   const original=await env.DB.prepare('SELECT * FROM theater_orders WHERE id=? AND event=?').bind(data.orderId,data.eventId).first();if(!original)fail('Bestellung nicht gefunden.',404);
   const saved=await L.open(env,original.payload,'theater-order:'+original.id);if(saved.cancels||saved.lines.some(p=>p.quantity<0))fail('Eine Korrekturbuchung kann nicht nochmals storniert werden.');
   // A deterministic primary key makes concurrent and retried cancellations idempotent.
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(original.id)),cancelId='cancel_'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   const payload=await L.seal(env,{name:saved.name,lines:saved.lines.map(p=>({...p,quantity:-p.quantity})),cancels:original.id,source:'cash'},'theater-order:'+cancelId);
   await env.DB.prepare('INSERT OR IGNORE INTO theater_orders(id,event,member,payload,created_at) VALUES(?,?,?,?,?)').bind(cancelId,data.eventId,original.member,payload,Date.now()).run();
   const stored=await env.DB.prepare('SELECT payload FROM theater_orders WHERE id=?').bind(cancelId).first();if((await L.open(env,stored.payload,'theater-order:'+cancelId)).cancels!==original.id)fail('Stornokennung bereits verwendet.');return {ok:true,id:cancelId};
  }
  if(!M.id(data.batchId))fail('Reservierungskennung fehlt.',400);
  if(action==='reserve'){
   const ids=data.orderIds;if(typeof data.memberId!=='string'||!Array.isArray(ids)||!ids.length||ids.length>60||new Set(ids).size!==ids.length||ids.some(v=>!M.id(v)))fail('Bitte 1 bis 60 offene Bestellungen auswählen.',400);
   const claim=JSON.stringify([data.eventId,data.memberId,[...ids].sort()]);
   const old=await env.DB.prepare('SELECT * FROM theater_batches WHERE id=?').bind(data.batchId).first();if(old){if(old.claim!==claim)fail('Reservierungskennung bereits verwendet.');return {ok:true,state:old.state};}
   const placeholders=ids.map(()=>'?').join(','),guard='EXISTS(SELECT 1 FROM theater_batches WHERE id=? AND claim=? AND state=\'reserved\')';
   const results=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO theater_batches(id,event,member,state,claim,created_at) SELECT ?,?,?,'reserved',?,? WHERE (SELECT COUNT(*) FROM theater_orders WHERE event=? AND member=? AND reservation IS NULL AND id IN ("+placeholders+'))=?').bind(data.batchId,data.eventId,data.memberId,claim,Date.now(),data.eventId,data.memberId,...ids,ids.length),
    env.DB.prepare('UPDATE theater_orders SET reservation=? WHERE reservation IS NULL AND event=? AND member=? AND id IN ('+placeholders+') AND '+guard).bind(data.batchId,data.eventId,data.memberId,...ids,data.batchId,claim)
   ]);if(!results[0].meta.changes){const existing=await env.DB.prepare('SELECT * FROM theater_batches WHERE id=?').bind(data.batchId).first();if(!existing||existing.claim!==claim)fail('Diese Karte wurde inzwischen reserviert oder geändert. Bitte aktualisieren.');}return {ok:true};
  }
  if(action==='complete'||action==='release'){
   const row=await env.DB.prepare('SELECT * FROM theater_batches WHERE id=? AND event=?').bind(data.batchId,data.eventId).first();if(!row)fail('Reservierung nicht gefunden.',404);const target=action==='complete'?'done':'released';if(row.state===target)return {ok:true};if(row.state!=='reserved')fail('Reservierung wurde bereits abgeschlossen oder freigegeben.');
   const statements=[];if(action==='release')statements.push(env.DB.prepare("UPDATE theater_orders SET reservation=NULL WHERE reservation=? AND EXISTS(SELECT 1 FROM theater_batches WHERE id=? AND state='reserved')").bind(data.batchId,data.batchId));statements.push(env.DB.prepare("UPDATE theater_batches SET state=? WHERE id=? AND state='reserved'").bind(target,data.batchId));const result=await env.DB.batch(statements);if(!result.at(-1).meta.changes)fail('Reservierung wurde gleichzeitig geändert. Bitte aktualisieren.');return {ok:true};
  }
  fail('Theater-Funktion nicht gefunden.',404);
 }
 g.TheaterService={route};
})(globalThis);
