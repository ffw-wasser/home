const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/portal-fixture.cjs');
const PASSWORD='Test-only lange Passphrase 2026!';
async function request(f,path,data={},token='',ip='192.0.2.10'){
 const response=await f.c.worker.fetch(new Request('https://test.example/portal/passkey/'+path,{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+token,'Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify(data)}),f.env);return {status:response.status,value:await response.json()};
}
async function setup(){const f=await fixture({authenticated:false});f.env.H2O_PASSWORD_PEPPER='SYNTHETIC-ONLY-PASSWORD-PEPPER-'.padEnd(64,'p');const original=f.call;f.call=(path,data={},token,...rest)=>typeof token==='string'?request(f,path.replace(/^passkey\//,''),data,token):original(path,data,token,...rest);return f;}
async function ticket(f,index=0,reset=false){const p=f.people[index],r=await f.call('identity-ticket',{alias:p.alias,revision:p.revision,reset},null,true);assert.equal(r.status,200);return r.value.code;}
async function set(f,code,username='test.user',password=PASSWORD,token=''){return request(f,'password/set',{code,username,password},token);}
async function login(f,username='test.user',password=PASSWORD,token='',ip){return request(f,'password/login',{username,password},token,ip);}
async function enrolled(){const f=await setup();assert.equal((await set(f,await ticket(f))).status,200);const r=await login(f);assert.equal(r.status,200,JSON.stringify(r));return {f,s:r.value};}
const own=s=>({alias:s.alias,revision:s.revision});
async function list(f,s){const r=await f.c.worker.fetch(new Request('https://test.example/portal/list',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify(own(s))}),f.env);return r.status;}
test('Password: invite-only setup consumes approval once; plaintext and username are absent from D1',async()=>{
 const f=await setup(),code=await ticket(f);assert.equal((await set(f,'')).status,401);assert.equal((await set(f,code)).status,200);assert.equal((await set(f,code)).status,403);
 const row=f.sql.prepare('SELECT * FROM portal_passwords').get();assert.equal(row.alias,f.people[0].alias);assert.notEqual(row.verifier,PASSWORD);assert.equal(row.verifier.length,43);assert.equal(row.salt.length,43);assert.equal(JSON.stringify(row).includes('test.user'),false);assert.equal(JSON.stringify(row).includes(PASSWORD),false);
 const r=await login(f,' TEST.USER ');assert.equal(r.status,200);assert.equal(r.value.method,'password');assert.equal(await list(f,r.value),200);assert.equal((await f.call('list')).status,401,'legacy capability stays blocked');
 const session=await request(f,'session',{},r.value.token);assert.equal(session.value.method,'password');assert.equal(session.value.key,f.people[0].key);
});
test('Password: wrong/unknown inputs have same response, cannot cross member or admin boundaries',async()=>{
 const {f,s}=await enrolled();const wrong=await login(f,'test.user','wrong-password-is-long'),unknown=await login(f,'unknown.user','wrong-password-is-long');assert.equal(wrong.status,401);assert.deepEqual(wrong,unknown);assert.equal((await login(f,'test.user','short')).status,401);
 assert.equal(await list(f,{...s,alias:f.people[1].alias,revision:f.people[1].revision}),401);
 assert.equal((await request(f,'password/set',{username:'other',password:PASSWORD},'untrusted')).status,401);
});
test('Password: independent devices persist; login confirmation rotates caller; logout is individual',async()=>{
 const {f,s}=await enrolled(),second=(await login(f)).value;
 const confirmed=await request(f,'password/confirm',{password:PASSWORD},s.token);assert.equal(confirmed.status,200);assert.equal(await list(f,s),401);assert.equal(await list(f,second),200);
 assert.equal((await request(f,'logout',{},confirmed.value.token)).status,200);assert.equal(await list(f,confirmed.value),401);assert.equal(await list(f,second),200);
});
test('Password: password change needs recent authentication, invalidates old sessions and old password',async()=>{
 const {f,s}=await enrolled();f.clock.now+=300001;
 assert.equal((await set(f,'','test.user','New synthetic passphrase!',s.token)).status,401);
 const confirmed=await request(f,'password/confirm',{password:PASSWORD},s.token);assert.equal(confirmed.status,200);
 assert.equal((await set(f,'','test.user','New synthetic passphrase!',confirmed.value.token)).status,200);
 assert.equal(await list(f,confirmed.value),401);assert.equal((await login(f)).status,401);assert.equal((await login(f,'test.user','New synthetic passphrase!')).status,200);
});
test('Password: recovery, expired ticket, member removal and revision rotation cannot resurrect access',async()=>{
 const {f,s}=await enrolled(),code=await ticket(f,0,true);assert.equal(await list(f,s),401);assert.equal((await login(f)).status,401);
 assert.equal((await set(f,code)).status,200);const fresh=(await login(f)).value;f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('changed-revision',fresh.alias);assert.equal(await list(f,fresh),401);assert.equal((await login(f)).status,401);
 const f2=await setup(),expired=await ticket(f2);f2.clock.now+=30*60000+1;assert.equal((await set(f2,expired)).status,403);
 const {f:f3,s:s3}=await enrolled();await f3.call('roster',{members:f3.people.slice(1).map(p=>({id:p.memberId,name:'Synthetic',leader:false}))},null,true);assert.equal(await list(f3,s3),401);assert.equal(f3.sql.prepare('SELECT COUNT(*) AS n FROM portal_passwords').get().n,0);
});
test('Password: input policy, duplicate names, fail-closed missing pepper and failed batch',async()=>{
 const f=await setup(),code=await ticket(f);
 for(const [name,password] of [['../bad',PASSWORD],['ok.user',''],['ok.user',null],['ok.user','x'.repeat(129)]])assert.equal((await set(f,code,name,password)).status,400);
 assert.equal((await set(f,code)).status,200);
 const second=await ticket(f,1);assert.equal((await set(f,second)).status,409);assert.equal((await set(f,second,'second.user')).status,200);
 const third=await ticket(f,2);f.failBatch();assert.equal((await set(f,third,'third.user')).status,503);assert.equal((await set(f,third,'third.user')).status,200);
 delete f.env.H2O_PASSWORD_PEPPER;assert.equal((await login(f)).status,503);assert.equal((await set(f,await ticket(f,3),'fourth.user')).status,503);
});
test('Password: limits include username across distributed clients; expired session and revocation fail closed',async()=>{
 const {f,s}=await enrolled();for(let i=0;i<9;i++)assert.equal((await login(f,'test.user','incorrect long password','',`192.0.2.${20+i}`)).status,401);
 assert.equal((await login(f,'test.user',PASSWORD,'','192.0.2.88')).status,429);
 f.clock.now+=300001;const second=(await login(f)).value;const recent=(await request(f,'password/confirm',{password:PASSWORD},s.token)).value;
 assert.equal((await request(f,'sessions/revoke',{},recent.token)).status,200);assert.equal(await list(f,second),401);assert.equal(await list(f,recent),200);
 f.clock.now+=31*86400000;assert.equal(await list(f,recent),401);
});
test('Password: passkeys remain usable and password member can add a passkey with fresh confirmation',async()=>{
 const {f,s}=await enrolled(),{passkey}=require('./helpers/passkey-authenticator.cjs');
 const p=await passkey(f,{register:'passkey/enroll',token:s.token});const signed=await request(f,'portal/login/verify',await p.login({portal:true}));assert.equal(signed.status,200);assert.equal(await list(f,s),200);
 assert.equal((await set(f,'','test.user','Replacement test passphrase!',signed.value.token)).status,200);assert.equal(await list(f,s),401);assert.equal(await list(f,signed.value),200);
});
test('Password: concurrent admin reset cannot be undone by an in-flight enrollment; runtime KDF ceiling respected',async()=>{
 const f=await setup(),code=await ticket(f),native=f.c.crypto;let resume,started;
 const wait=new Promise(resolve=>resume=resolve),entered=new Promise(resolve=>started=resolve);
 f.c.crypto={getRandomValues:v=>native.getRandomValues(v),subtle:new Proxy(native.subtle,{get(target,property){if(property==='deriveBits')return async(params,...args)=>{assert.ok(params.iterations<=100000);started();await wait;return target.deriveBits(params,...args);};const value=target[property];return typeof value==='function'?value.bind(target):value;}})};
 const saving=set(f,code);await entered;await ticket(f,0,true);resume();assert.equal((await saving).status,403);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM portal_passwords').get().n,0);
});

 test('Password: freely chosen short and repeated passwords work without composition rules',async()=>{
 for(const password of ['a','1234','111111111111111','passwortpasswort',' ']){
  const f=await setup(),code=await ticket(f);assert.equal((await set(f,code,'free.user',password)).status,200);assert.equal((await login(f,'free.user',password)).status,200);
 }
});

test('Password: member approval remains valid after 29 minutes',async()=>{
 const f=await setup(),code=await ticket(f);f.clock.now+=29*60000;assert.equal((await set(f,code)).status,200);
});
