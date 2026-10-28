const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
const read=(f,url,method='GET')=>f.c.worker.fetch(new Request(url,{method}),f.env);
const overview=async f=>{const r=await f.call('subscriptions',{},null,true);assert.equal(r.status,200);return r.value;};
const person=(value,id)=>value.members.find(row=>row.memberId===id);
test('Aboübersicht erfordert Server-Admin und korrekte Quelle; gibt nur Status und keine Namen oder Geheimnisse aus',async()=>{
 const f=await fixture(),url=(await f.call('calendar-subscription')).value.subscriptionUrl;
 assert.equal((await f.call('subscriptions')).status,404);
 assert.equal((await f.call('subscriptions',{source:'wrong-source'},null,true)).status,409);
 const response=await f.c.worker.fetch(new Request('https://test.example/admin/portal/subscriptions',{method:'POST',headers:{Authorization:'Bearer wrong','Content-Type':'application/json'},body:JSON.stringify({source:'test-source'})}),f.env);assert.equal(response.status,401);
 const value=await overview(f);assert.equal(value.members.length,5);assert.equal(value.source,'test-source');assert.ok(value.members.every(row=>row.pushDevices===0&&row.calendarLastFetchedAt===null));
 assert.deepEqual(Object.keys(value.members[0]).sort(),['calendarLastFetchedAt','memberId','pushDevices']);assert.ok(!JSON.stringify(value).includes(url));assert.doesNotMatch(JSON.stringify(value),/Testperson|token_hash|endpoint|revision|capability/);
});
test('Nur aktuelle Push-Revisionen zählen; fehlende und entfernte Zugänge werden nicht als aktiv angezeigt',async()=>{
 const f=await fixture(),p=f.people[0];
 for(const [id,revision] of [['one',p.revision],['two',p.revision],['stale','old-revision']])f.sql.prepare('INSERT INTO devices(id,alias,revision,endpoint) VALUES(?,?,?,?)').run(id,p.alias,revision,'https://fcm.googleapis.com/'+id);
 assert.equal(person(await overview(f),p.memberId).pushDevices,2);
 f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('new-revision',p.alias);assert.equal(person(await overview(f),p.memberId).pushDevices,0);
 await f.call('roster',{members:f.people.slice(1).map(p=>({id:p.memberId,name:'Synthetic',leader:false}))},null,true);assert.equal(person(await overview(f),p.memberId),undefined);
});
test('Link erstellen, HEAD und fehlgeschlagene Abrufe gelten nicht als Kalenderabo; GET erfasst nur den letzten Erfolg verschlüsselt',async()=>{
 const f=await fixture(),p=f.people[0],url=(await f.call('calendar-subscription')).value.subscriptionUrl;
 assert.equal(person(await overview(f),p.memberId).calendarLastFetchedAt,null);
 assert.equal((await read(f,url,'HEAD')).status,200);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_usage').get().n,0);
 assert.equal((await read(f,url)).status,200);assert.equal(person(await overview(f),p.memberId).calendarLastFetchedAt,f.clock.now);
 const usage=f.sql.prepare('SELECT * FROM portal_calendar_usage').get();assert.ok(!usage.payload.includes(String(f.clock.now)));assert.ok(!usage.payload.includes('tokenHash'));
 f.clock.now+=3600000;f.offline(true);assert.equal((await read(f,url)).status,503);assert.notEqual(person(await overview(f),p.memberId).calendarLastFetchedAt,f.clock.now);
 f.offline(false);assert.equal((await read(f,url)).status,200);assert.equal(person(await overview(f),p.memberId).calendarLastFetchedAt,f.clock.now);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_usage').get().n,1);
});
test('Linkwechsel, Kontowiederherstellung, Quellwechsel und Mitgliederaustritt entfernen oder entwerten den Abrufstatus',async()=>{
 for(const mode of ['reset','recover','source','remove']){
  const f=await fixture(),p=f.people[0],sub=(await f.call('calendar-subscription')).value;await read(f,sub.subscriptionUrl);
  if(mode==='reset'){await f.call('calendar-subscription',{reset:true,expectedVersion:sub.version});assert.equal(person(await overview(f),p.memberId).calendarLastFetchedAt,null);}
  if(mode==='recover'){await f.c.WhatsAppPasskeys.revoke(f.env,p);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_usage').get().n,0);assert.equal(person(await overview(f),p.memberId).calendarLastFetchedAt,null);}
  if(mode==='source'){f.sql.prepare('UPDATE ledger_meta SET source=?').run('other-source');const r=await f.call('subscriptions',{source:'other-source'},null,true);assert.equal(r.status,200);assert.equal(person(r.value,p.memberId).calendarLastFetchedAt,null);}
  if(mode==='remove'){await f.call('roster',{members:f.people.slice(1).map(p=>({id:p.memberId,name:'Synthetic',leader:false}))},null,true);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_calendar_usage').get().n,0);}
 }
});
test('Ein zurückgesetzter Link während eines langsamen Abrufs erzeugt keinen bestätigten Status',async()=>{
 const f=await fixture(),sub=(await f.call('calendar-subscription')).value;f.clock.now+=3600000;
 let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r),prior=f.c.fetch;
 f.c.fetch=async(...args)=>{if(String(args[0]).startsWith('https://calendar.google.com/')){started();await gate;}return prior(...args);};
 const pending=read(f,sub.subscriptionUrl);await ready;await f.call('calendar-subscription',{reset:true,expectedVersion:sub.version});release();assert.equal((await pending).status,404);assert.equal(person(await overview(f),f.people[0].memberId).calendarLastFetchedAt,null);
});
test('Eine Störung der Statusspeicherung blockiert keinen gültigen Kalenderabruf',async()=>{
 const f=await fixture(),sub=(await f.call('calendar-subscription')).value,prepare=f.DB.prepare;
 f.DB.prepare=query=>{if(query.startsWith('INSERT INTO portal_calendar_usage'))throw Error('synthetic metadata storage failure');return prepare(query);};
 const response=await read(f,sub.subscriptionUrl);assert.equal(response.status,200);assert.match(await response.text(),/BEGIN:VCALENDAR/);assert.equal(person(await overview(f),f.people[0].memberId).calendarLastFetchedAt,null);
});
