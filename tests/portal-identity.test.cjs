const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/portal-fixture.cjs'),{passkey}=require('./helpers/passkey-authenticator.cjs');
async function request(f,path,data={},token=''){
 const response=await f.c.worker.fetch(new Request('https://test.example.workers.dev'+path,{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)}),f.env);return {status:response.status,value:await response.json()};
}
async function setup(){const f=await fixture();f.originalCall=f.call;f.call=(path,data={},token)=>token?request(f,'/portal/'+path,data,token):f.originalCall(path,data);return f;}
async function ticket(f,p=f.people[0],reset=false){const result=await f.originalCall('identity-ticket',{alias:p.alias,revision:p.revision,reset},null,true);assert.equal(result.status,200,JSON.stringify(result.value));return result.value.code;}
async function signin(f,p,code){return f.call('passkey/portal/login/verify',{...await p.login({portal:true}),...(code?{code}:{})});}
async function enrolled(){const f=await setup(),code=await ticket(f),p=await passkey(f,{register:'passkey/enroll',code}),login=await signin(f,p);assert.equal(login.status,200,JSON.stringify(login.value));return {f,p,s:login.value};}
const own=s=>({alias:s.alias,revision:s.revision});
test('Portal: old WhatsApp passkey/session and personal capability cannot mint portal authority',async()=>{
 const f=await setup(),p=await passkey(f),calendar=(await f.call('passkey/login/verify',await p.login())).value;
 assert.equal((await signin(f,p)).status,403);
 for(const path of ['passkey/session','passkey/enroll/options','passkey/devices','gf-breathing'])assert.equal((await request(f,'/portal/'+path,own(calendar),calendar.token)).status,401,path);
 assert.equal((await f.call('passkey/enroll/options')).status,401);
 assert.equal((await request(f,'/admin/portal/identity-ticket',{source:'test-source',...own(calendar)},calendar.token)).status,401);
 const code=await ticket(f),login=await signin(f,p,code);assert.equal(login.status,200);assert.equal(login.value.scope,'portal');
 assert.equal((await signin(f,p,code)).status,403,'ticket one-time');
 assert.equal((await request(f,'/portal/evidence',own(login.value),calendar.token)).status,401);
});
test('Portal: enrollment needs admin one-use ticket, binds member; cutover only after successful assertion',async()=>{
 const f=await setup(),code=await ticket(f),p=await passkey(f,{register:'passkey/enroll',code});
 assert.equal((await f.originalCall('list')).status,200,'legacy preserved until assertion');
 assert.equal((await f.call('passkey/enroll/options',{code})).status,403);
 const login=await signin(f,p);assert.equal(login.status,200);
 assert.equal((await f.originalCall('list')).status,401);
 const wrong=await ticket(f,f.people[1]);assert.equal((await signin(f,p,wrong)).status,403);
 const second=await signin(f,p);assert.equal(second.status,200,'multiple own browser sessions');
 const meta=await request(f,'/portal/passkey/session',{},second.value.token);assert.equal(meta.value.alias,f.people[0].alias);assert.equal(meta.value.key,f.people[0].key);
});
test('Portal: legacy read, commands, quiz and private APIs blocked after migration; scopes and data unchanged',async()=>{
 const {f,s}=await enrolled(),person=f.people[0];
 const proof=require('node:crypto').createHash('sha256').update('deckel-read/v1:'+person.alias+':'+person.key).digest('base64url');
 assert.equal((await request(f,'/central/snapshot',{alias:s.alias},proof)).status,401);
 const snap=await request(f,'/central/snapshot',{alias:s.alias},s.token);assert.equal(snap.status,200,JSON.stringify(snap.value));
 const opened=await f.c.DeckelCrypto.open(snap.value.envelope,person);assert.equal(opened.actions.capability,s.token);
 for(const path of ['list','evidence','gf-breathing','overview','contacts'])assert.equal((await f.originalCall(path)).status,401,path);
 for(const path of ['list','evidence','contacts'])assert.equal((await request(f,'/portal/'+path,own(s),s.token)).status,200,path);
 assert.equal((await request(f,'/central/snapshot',{alias:f.people[1].alias},s.token)).status,401);
 assert.equal((await request(f,'/admin/central/status',{source:'test-source'},s.token)).status,401);
 const commandAuth=await require('node:vm').runInContext('(env,r)=>capability(env,r.alias,r.revision,"commands")',f.c)(f.env,person);
 assert.equal((await request(f,'/commands/status',{...own(s),id:require('node:crypto').randomUUID()},commandAuth)).status,401);
 assert.equal((await request(f,'/challenge/solo-current',own(s),commandAuth)).status,401);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM commands').get().n,0);
});
test('Portal: real signatures, scope binding, replay, origin/RP-ID/UV and expiry',async()=>{
 const {f,p,s}=await enrolled();
 for(const bad of [{origin:'https://evil.example'},{flags:1},{rpHash:Buffer.alloc(32)},{tamper:true}])assert.equal((await f.call('passkey/portal/login/verify',await p.login({...bad,portal:true}))).status,401);
 assert.equal((await f.call('passkey/portal/login/verify',await p.login())).status,401,'calendar challenge cannot become portal challenge');
 const payload=await p.login({portal:true});assert.equal((await f.call('passkey/portal/login/verify',payload)).status,200);assert.equal((await f.call('passkey/portal/login/verify',payload)).status,401);
 const expired=await p.login({portal:true});f.clock.now+=300001;assert.equal((await f.call('passkey/portal/login/verify',expired)).status,401);
 assert.equal((await request(f,'/portal/passkey/enroll/options',{},s.token)).status,401,'security step-up required');
 f.clock.now+=31*86400000;assert.equal((await request(f,'/portal/list',own(s),s.token)).status,401);
});
test('Portal: GF role loss and removal apply to active sessions',async()=>{
 const {f,s}=await enrolled();
 assert.equal((await request(f,'/portal/gf-breathing',own(s),s.token)).status,200);
 await f.originalCall('roster',{members:f.people.map(p=>({id:p.memberId,name:'Test',leader:false}))},null,true);
 assert.equal((await request(f,'/portal/gf-breathing',own(s),s.token)).status,403);
 assert.equal((await request(f,'/portal/list',own(s),s.token)).status,200);
 await f.originalCall('roster',{members:f.people.slice(1).map(p=>({id:p.memberId,name:'Test',leader:false}))},null,true);
 assert.equal((await request(f,'/portal/list',own(s),s.token)).status,401);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_identity_sessions').get().n,0);
});
test('Portal: recovery invalidates all keys/sessions without reopening legacy access',async()=>{
 const {f,p,s}=await enrolled();const code=await ticket(f,f.people[0],true);
 assert.equal((await request(f,'/portal/list',own(s),s.token)).status,401);
 assert.equal((await signin(f,p)).status,401);
 assert.equal((await f.originalCall('list')).status,401,'no downgrade during recovery');
 const fresh=await passkey(f,{register:'passkey/enroll',code});assert.equal((await signin(f,fresh)).status,200);
});
test('Portal: key removal, logout and account rotation revoke server-side access',async()=>{
 const {f,p,s}=await enrolled(),second=await passkey(f,{register:'passkey/enroll',token:s.token}),s2=(await signin(f,second)).value;
 assert.equal((await request(f,'/portal/passkey/remove',{credential:p.response.id},s2.token)).status,200);
 assert.equal((await request(f,'/portal/list',own(s),s.token)).status,401);
 assert.equal((await request(f,'/portal/passkey/logout',{},s2.token)).status,200);
 assert.equal((await request(f,'/portal/list',own(s2),s2.token)).status,401);
 const s3=(await signin(f,second)).value;f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('new-revision',s3.alias);
 assert.equal((await request(f,'/portal/list',own(s3),s3.token)).status,401);
 assert.equal((await signin(f,second)).status,401);
});
test('Portal: expired ticket and failed transaction cannot consume admission or partially migrate',async()=>{
 const f=await setup(),code=await ticket(f);f.clock.now+=600001;assert.equal((await f.call('passkey/enroll/options',{code})).status,403);
 const fresh=await ticket(f),p=await passkey(f);f.failBatch();assert.equal((await signin(f,p,fresh)).status,503);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_identity_members').get().n,0);
 assert.equal((await signin(f,p,fresh)).status,200);
});
test('Portal: drinks/cash retain member assignment, encryption and idempotency',async()=>{
 const {f,s}=await enrolled(),person=f.people[0];
 for(const command of [{version:1,kind:'drinks',entries:[{drink:'beer'}],epoch:'0'},{version:1,kind:'cash',cents:150,epoch:'0'}]){
  f.clock.now+=2000;const id=require('node:crypto').randomUUID(),envelope=await f.c.DeckelCommands.seal(command,person,id),data={...own(s),id,envelope};
  const once=await request(f,'/commands/submit',data,s.token);assert.equal(once.status,200,JSON.stringify(once.value));assert.equal(once.value.status,'done');
  assert.deepEqual((await request(f,'/commands/submit',data,s.token)).value,once.value);
  assert.equal((await request(f,'/commands/submit',{...data,alias:f.people[1].alias,revision:f.people[1].revision},s.token)).status,401);
 }
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM commands').get().n,2);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM ledgers WHERE member<>?').get(person.memberId).n,0);
 const snapshot=await request(f,'/central/snapshot',{alias:s.alias},s.token),account=await f.c.DeckelCrypto.open(snapshot.value.envelope,person);assert.equal(account.balance,0);assert.equal(account.bookings.length,2);
});
test('Portal: security confirmation rotates only caller session; revoke others includes calendar',async()=>{
 const {f,p,s}=await enrolled(),other=(await signin(f,p)).value,calendar=(await f.call('passkey/login/verify',await p.login())).value;
 const renewed=await request(f,'/portal/passkey/portal/login/verify',await p.login({portal:true}),s.token);assert.equal(renewed.status,200);
 assert.equal((await request(f,'/portal/list',own(s),s.token)).status,401);
 assert.equal((await request(f,'/portal/list',own(other),other.token)).status,200);
 assert.equal((await request(f,'/portal/passkey/sessions/revoke',{},renewed.value.token)).status,200);
 for(const old of [other,calendar])assert.equal((await request(f,'/portal/list',own(old),old.token)).status,401);
 assert.equal((await request(f,'/portal/list',own(renewed.value),renewed.value.token)).status,200);
});
