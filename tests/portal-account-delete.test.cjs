const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
const remove=f=>f.call('passkey/account/delete',{confirm:true});
const count=(f,table,where='',...args)=>f.sql.prepare('SELECT COUNT(*) n FROM '+table+(where?' WHERE '+where:'')).get(...args).n;
test('Kontolöschung entfernt persönliche Zugänge und Eingaben, behält Verwaltungsdaten und fremde Konten',async()=>{
 const f=await fixture(),p=f.people[0],other=f.people[1];
 const event=(await f.call('list',{},null,true)).value.events[0];
 const subscription=(await f.call('calendar-subscription')).value.subscriptionUrl;assert.ok(subscription);
 const ticket=(await f.call('identity-ticket',p,null,true)).value.code;
 f.sql.prepare('INSERT INTO devices VALUES(?,?,?,?)').run('own-device',p.alias,p.revision,'synthetic-endpoint');f.sql.prepare('INSERT INTO portal_devices VALUES(?)').run('own-device');
 f.sql.prepare('INSERT INTO portal_replies(event,member,payload) VALUES(?,?,?)').run(event.id,p.memberId,'synthetic-reply');
 f.sql.prepare('INSERT INTO ledgers(member,payload) VALUES(?,?)').run(p.memberId,'retained-ledger');
 f.sql.prepare('INSERT INTO portal_evidence_entries VALUES(?,?,?,?)').run(p.memberId,'g263',1,'retained-evidence');
 f.sql.prepare('INSERT INTO portal_evidence_audit VALUES(?,?,?,?)').run(p.memberId,'audit-1','retained-audit',f.clock.now);
 const roster=f.sql.prepare('SELECT payload FROM portal_roster').get().payload;
 assert.equal((await remove(f)).status,200);
 for(const table of ['accounts','ledger_access','portal_passkeys','portal_identity_sessions','devices'])assert.equal(count(f,table,'alias=?',p.alias),0,table);
 for(const table of ['portal_replies','portal_calendar_subscriptions','portal_calendar_usage'])assert.equal(count(f,table,'member=?',p.memberId),0,table);
 assert.equal(count(f,'portal_devices'),0);assert.equal(count(f,'portal_passkey_challenges'),0);
 assert.equal(f.sql.prepare('SELECT payload FROM ledgers WHERE member=?').get(p.memberId).payload,'retained-ledger');
 assert.equal(count(f,'portal_evidence_entries'),1);assert.equal(count(f,'portal_evidence_audit'),1);assert.equal(f.sql.prepare('SELECT payload FROM portal_roster').get().payload,roster);
 assert.equal(count(f,'retired','alias=? AND revision=?',p.alias,p.revision),1);
 assert.equal((await f.call('list')).status,401);assert.equal((await f.call('list',{},other)).status,200);
 assert.equal((await f.call('passkey/enroll/options',{code:ticket})).status,403);
 assert.equal((await f.c.worker.fetch(new Request(subscription),f.env)).status,404);
 assert.equal((await remove(f)).status,401);
});
test('Löschung erfordert Bestätigung und eine frische persönliche Anmeldung',async()=>{
 const f=await fixture();assert.equal((await f.call('passkey/account/delete')).status,400);
 f.clock.now+=300001;assert.equal((await remove(f)).status,401);assert.equal(count(f,'accounts'),5);
});
test('Datenbankfehler rollen die gesamte Löschung zurück',async()=>{
 const f=await fixture(),p=f.people[0];f.failBatch();assert.equal((await remove(f)).status,503);
 assert.equal(count(f,'accounts'),5);assert.equal(count(f,'retired'),0);assert.equal(count(f,'portal_passkey_challenges'),0);assert.equal((await f.call('list')).status,200);
 assert.equal((await remove(f)).status,200);assert.equal(count(f,'accounts','alias=?',p.alias),0);
});
test('Widerruf oder Datenänderung unmittelbar vor der Transaktion verhindert jede Löschung',async()=>{
 for(const mutation of [f=>f.sql.exec('DELETE FROM portal_identity_sessions'),f=>f.sql.exec('UPDATE ledger_meta SET seq=seq+1')]){
  const f=await fixture(),batch=f.DB.batch;f.DB.batch=async statements=>{mutation(f);return batch(statements);};
  assert.equal((await remove(f)).status,409);assert.equal(count(f,'accounts'),5);assert.equal(count(f,'retired'),0);assert.equal(count(f,'portal_passkeys'),5);
 }
});
test('Alle eigenen Zugangskennungen werden gelöscht, andere Mitglieder bleiben bestehen',async()=>{
 const f=await fixture(),p=f.people[0],second=f.people[1];
 const record={...second,memberId:p.memberId};f.sql.prepare('UPDATE ledger_access SET payload=? WHERE alias=?').run(await f.L.seal(f.env,record,'access:'+second.alias),second.alias);
 assert.equal((await remove(f)).status,200);assert.equal(count(f,'accounts'),3);assert.equal(count(f,'retired'),2);assert.equal((await f.call('list',{},second)).status,401);assert.equal((await f.call('list',{},f.people[2])).status,200);
});

test('Eine bereits laufende Rückmeldung kann das gelöschte Konto nicht wieder befüllen',async()=>{
 const f=await fixture(),event=(await f.call('list')).value.events[0],prepare=f.DB.prepare;let release,entered;
 const paused=new Promise(resolve=>entered=resolve),continueWrite=new Promise(resolve=>release=resolve);
 f.DB.prepare=query=>{const statement=prepare(query);if(query.startsWith('INSERT OR IGNORE INTO portal_replies')){const run=statement.run;statement.run=async function(){entered();await continueWrite;return run.call(this);};}return statement;};
 const pending=f.call('reply',{eventId:event.id,status:'yes',expectedVersion:0,requestId:require('node:crypto').randomUUID()});
 await paused;assert.equal((await remove(f)).status,200);release();assert.equal((await pending).status,409);assert.equal(count(f,'portal_replies'),0);
});
