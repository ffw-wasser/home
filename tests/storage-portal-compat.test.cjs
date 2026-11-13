const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID,randomBytes}=require('node:crypto'),{fixture}=require('./helpers/portal-fixture.cjs');
const sha=value=>createHash('sha256').update(value).digest('hex');
test('Production storage devices preserve existing personal capabilities, calendar event IDs and member sessions',async()=>{
 const f=await fixture();try{
  for(const name of ['storage-migration.sql','storage-state.sql','storage-files.sql','storage-runtime.sql'])f.sql.exec(fs.readFileSync(path.join(__dirname,'../cloudflare/push',name),'utf8'));
  const source=f.sql.prepare('SELECT source FROM ledger_meta WHERE id=1').get().source,sourceHash=sha(source),run=sha('synthetic production run'),now=f.clock.now;
  f.sql.prepare("INSERT INTO storage_migrations(id,source_hash,manifest,state,created_at,verified_at) VALUES(?,?,?,'verified',?,?)").run(run,sourceHash,'synthetic manifest',now,now);
  const payload=await f.L.seal(f.env,{members:[],entries:[]},'storage-state/v1:'+run);f.sql.prepare('INSERT INTO storage_states VALUES(?,?,?,1,?)').run(run,sourceHash,payload,now);f.sql.prepare('INSERT INTO storage_runtime VALUES(1,?,?,1,?)').run(run,sourceHash,now);
  async function api(endpoint,data,token){const r=await f.c.worker.fetch(new Request('https://test.account.workers.dev'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)}),f.env);return {status:r.status,value:await r.json()};}
  const device={deviceId:randomUUID(),token:randomBytes(32).toString('base64url'),label:'Synthetic storage administrator',expiresAt:now+86400000,access:'application-admin'};
  assert.equal((await api('/admin/storage-state/pair',{run,source:sourceHash,...device},f.env.ADMIN_TOKEN)).status,200);
  const record=f.people[0],data={alias:record.alias,revision:record.revision},old=await api('/admin/account',data,f.env.ADMIN_TOKEN),migrated=await api('/admin/account',data,device.token);
  assert.equal(old.status,200);assert.equal(migrated.status,200);assert.equal(migrated.value.capability,old.value.capability);assert.equal(migrated.value.actionCapability,old.value.actionCapability);
  const before=await api('/admin/portal/list',{source},f.env.ADMIN_TOKEN),after=await api('/admin/portal/list',{source},device.token);assert.equal(after.status,200);assert.deepEqual(after.value.events.map(event=>event.id),before.value.events.map(event=>event.id));
  assert.equal((await f.call('list')).status,200,'existing member credential still works');
  assert.equal((await api('/admin/storage-runtime/revoke',{deviceId:device.deviceId},f.env.ADMIN_TOKEN)).status,200);assert.equal((await api('/admin/portal/list',{source},device.token)).status,401);assert.equal((await f.call('list')).status,200,'revoking an admin device does not revoke member access');
 }finally{f.sql.close();}
});
