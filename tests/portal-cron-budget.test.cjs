const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/portal-fixture.cjs');

test('Cron: no birthday database reads when there is no assigned birthday today',async()=>{
 const f=await fixture({now:Date.parse('2026-10-22T10:00:00Z')});
 const prepare=f.DB.prepare;let reads=0;
 f.DB.prepare=function(query){reads++;return prepare.call(this,query);};
 assert.equal(await f.c.PortalService.awardBirthdays(f.env,{events:[{kind:'probe',start:f.clock.now},{kind:'birthday',memberId:null,start:f.clock.now},{kind:'birthday',memberId:f.people[0].memberId,start:f.clock.now+86400000}]}),0);
 assert.equal(reads,0,'irrelevant birthdays must not load roster, rules, policy or reward markers');
});

test('Cron: reuse one Berlin date formatter across events and invocations',async()=>{
 const f=await fixture({now:Date.parse('2026-10-24T22:30:00Z')});let constructions=0;
 f.c.Intl={DateTimeFormat:function(...args){constructions++;return new Intl.DateTimeFormat(...args);}};
 const cal={events:Array.from({length:200},()=>({kind:'birthday',memberId:f.people[0].memberId,start:f.clock.now+3*86400000}))};
 assert.equal(await f.c.PortalService.awardBirthdays(f.env,cal),0);
 f.clock.now+=86400000;
 assert.equal(await f.c.PortalService.awardBirthdays(f.env,cal),0);
 assert.equal(constructions,1,'formatter must not be reconstructed for every calendar event');
});

test('Cron: a fresh cached calendar reuses configuration already read in this invocation',async()=>{
 const f=await fixture();const prepare=f.DB.prepare;let configReads=0;
 f.DB.prepare=function(query){if(query==='SELECT * FROM portal_config WHERE id=1')configReads++;return prepare.call(this,query);};
 await f.c.PortalService.scheduled(f.env);
 assert.equal(configReads,1);
});
