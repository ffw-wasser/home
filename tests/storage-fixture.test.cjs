const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/storage-fixture.cjs');
test('Concurrent browser requests each receive their own unchanged 50-statement query budget',async t=>{
 const f=fixture(t);f.context.worker.fetch=async()=>{for(let i=0;i<40;i++)await f.env.DB.prepare('SELECT 1 AS value').first();return Response.json({ok:true});};
 const responses=await Promise.all(Array.from({length:4},()=>f.fetcher('https://test.account.workers.dev/storage/config')));assert.equal(responses.every(r=>r.ok),true);
});
test('A single request exceeding 50 statements still fails the budget assertion',async t=>{
 const f=fixture(t);f.context.worker.fetch=async()=>{for(let i=0;i<51;i++)await f.env.DB.prepare('SELECT 1 AS value').first();return Response.json({ok:true});};
 await assert.rejects(f.fetcher('https://test.account.workers.dev/storage/config'),/Free query budget: 51/);
});
test('Batch statements are included in the same per-request query budget',async t=>{
 const f=fixture(t);f.context.worker.fetch=async()=>{await f.env.DB.batch(Array.from({length:51},()=>f.env.DB.prepare('UPDATE accounts SET last_sent=last_sent')));return Response.json({ok:true});};
 await assert.rejects(f.fetcher('https://test.account.workers.dev/storage/config'),/Free query budget: 51/);
});
