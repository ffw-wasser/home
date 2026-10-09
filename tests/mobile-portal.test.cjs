const test=require('node:test'),assert=require('node:assert/strict');
const {createServer,hash}=require('../backend/server.cjs');
const M=globalThis.DrinksModel;
test('Handy: eigener Deckel, PIN, Kontentrennung, Widerruf, CSRF und Ablauf',async t=>{
  const pin=await M.createPin('1234'),id='member-one',token='a'.repeat(64),revision='revision-1234';
  const files=new Map([
    ['zugang-'+hash(id)+'.json',{schemaVersion:1,memberId:id,tokenHash:hash(token),revision}],
    ['konto-'+hash(id)+'.json',{...M.empty(id),pin,bookings:[{id:'drink-0001',type:'drinks',count:2,cents:300,createdAt:'2026-10-08T12:00:00Z'}]}],
    ['bonus-einstellungen.json',{schemaVersion:1,id:'reward-12345',revision:'revision-12345',startedAt:'2026-10-01T00:00:00Z',count:20,cents:300}]
  ]);
  let clock=Date.now(),reads=[];const env={SESSION_SECRET:'x'.repeat(64),PUBLIC_ORIGIN:'https://deckel.example'};
  const server=createServer({env,secure:false,now:()=>clock,read:async name=>{reads.push(name);if(!files.has(name))throw Object.assign(new Error(),{status:401});return structuredClone(files.get(name));}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  const login=(data={},origin=env.PUBLIC_ORIGIN)=>fetch(base+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id,token,pin:'1234',...data})});
  assert.equal((await fetch(base+'/api/me')).status,401);
  assert.equal((await login({},'https://evil.example')).status,403);
  assert.equal((await login({token:'b'.repeat(64)})).status,401);
  assert.equal((await login({id:'member-two'})).status,401);
  assert.equal((await login({pin:'9999'})).status,401);
  const response=await login();assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  const mine=()=>fetch(base+'/api/me?id=member-two',{headers:{Cookie:cookie}});
  let result=await mine();assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
  const body=await result.json();assert.equal(body.balance,300);assert.equal(body.bookings.length,1);assert.equal(body.pin,undefined);assert.equal(body.memberId,undefined);assert.equal(body.tokenHash,undefined);
  assert.ok(reads.every(name=>!name.includes(hash('member-two'))||name.startsWith('zugang-')));
  files.get('konto-'+hash(id)+'.json').pin=await M.createPin('4321');assert.equal((await mine()).status,401);
  files.get('konto-'+hash(id)+'.json').pin=pin;
  files.get('zugang-'+hash(id)+'.json').revision='new-revision';assert.equal((await mine()).status,401);
  files.get('zugang-'+hash(id)+'.json').revision=revision;
  clock+=16*60000;assert.equal((await mine()).status,401);
  for(let i=0;i<5;i++)assert.equal((await login({pin:'9999'})).status,401);
  assert.equal((await login()).status,429);clock+=16*60000;assert.equal((await login()).status,200);
  assert.equal((await fetch(base+'/api/me',{headers:{Cookie:'deckel=broken.fake'}})).status,401);
  assert.equal((await fetch(base+'/../server.cjs')).status,404);
  assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:'x'.repeat(3000)})).status,413);
});
test('Ohne OneDrive-Konfiguration nur Status, keine Konten',async t=>{
  const server=createServer({env:{SESSION_SECRET:'x'.repeat(64)},secure:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;assert.deepEqual(await(await fetch(base+'/health')).json(),{status:'ok',configured:false});assert.equal((await fetch(base+'/api/me')).status,503);
});
