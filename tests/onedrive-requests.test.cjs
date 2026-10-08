const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../js/core/onedrive-sync.js'), 'utf8');
function app(respond, {expired = false} = {}) {
  let now = Date.now();
  const token = {access_token:'initial', refresh_token:'refresh', obtained_at:expired ? 0 : now, expires_in:3600};
  const store = new Map([['fw_onedrive_tokens',JSON.stringify(token)]]), calls = [], waits = [];
  const context = vm.createContext({window:{},Headers,URLSearchParams,
    navigator:{onLine:true},Date:class extends Date {static now(){return now;}},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    setTimeout(fn,ms){waits.push(ms);now+=ms;queueMicrotask(fn);},clearTimeout(){},
    fetch:async (url,options)=>{calls.push({url,options});return respond(url,options,calls.length);}});
  vm.runInContext(source,context);
  return {context,calls,waits,store};
}
const response = (status, headers = {}, body = {}) => new Response(JSON.stringify(body), {status,headers});
const url = 'https://graph.microsoft.com/v1.0/drives/test/items/test/children';

test('Vorübergehende Netzwerkfehler bei GET werden mit wachsender Pause wiederholt', async()=>{
  let count=0;
  const {context,calls,waits}=app(()=>{if(++count<3)throw new TypeError('Failed to fetch');return response(200);});
  assert.equal((await context.odFetch(url)).status,200);
  assert.equal(calls.length,3);assert.deepEqual(waits,[1000,2000]);
});

for(const status of [429,502,503,504])test(`GET nach HTTP ${status} hält Retry-After ein und kann sich erholen`,async()=>{
  let count=0;
  const {context,calls,waits}=app(()=>++count===1?response(status,{'Retry-After':'2'}):response(200));
  assert.equal((await context.odFetch(url)).status,200);
  assert.equal(calls.length,2);assert.deepEqual(waits,[2000]);
});

test('Dauerhafte Drosselung endet nach vier Versuchen und bewahrt Status/Fehlercode',async()=>{
  const {context,calls}=app(()=>response(429,{'Retry-After':'1'},{error:{code:'activityLimitReached'}}));
  await assert.rejects(context.odFetch(url),e=>e.status===429&&e.code==='activityLimitReached');
  assert.equal(calls.length,4);
});

test('403/404 werden nicht wiederholt und enthalten keine Rohantwort im Fehlertext',async()=>{
  for(const status of [403,404]){
    const {context,calls}=app(()=>response(status,{}, {error:{code:'itemNotFound',message:'private-url-and-personal-data'}}));
    await assert.rejects(context.odFetch(url),e=>e.status===status&&!e.message.includes('private-url'));
    assert.equal(calls.length,1);
  }
});

test('Abgebrochene Abrufe und POST-Netzwerkfehler werden nicht wiederholt',async()=>{
  for(const options of [{}, {method:'POST',body:'test'}]){
    const error=options.method?new TypeError('network'):Object.assign(new Error('cancelled'),{name:'AbortError'});
    const {context,calls}=app(()=>{throw error;});
    await assert.rejects(context.odFetch(url,options));assert.equal(calls.length,1);
  }
});

test('POST nach 503 wird nicht wiederholt; ein abgelehntes 429 darf erneut gesendet werden',async()=>{
  for(const status of [503,429]){
    let count=0;
    const {context,calls}=app(()=>++count===1?response(status,{'Retry-After':'1'}):response(200));
    if(status===503)await assert.rejects(context.odFetch(url,{method:'POST'}));
    else assert.equal((await context.odFetch(url,{method:'POST'})).status,200);
    assert.equal(calls.length,status===503?1:2);
  }
});

test('Gleichzeitige Abrufe teilen die Erneuerung eines abgelaufenen Tokens',async()=>{
  let refreshes=0;
  const {context}=app(async (u,options)=>{
    if(u.includes('/token')){refreshes++;await Promise.resolve();return response(200,{}, {access_token:'fresh',refresh_token:'next',expires_in:3600});}
    assert.equal(options.headers.get('Authorization'),'Bearer fresh');return response(200);
  },{expired:true});
  await Promise.all([context.odFetch(url),context.odFetch(url)]);
  assert.equal(refreshes,1);
});

test('401 erneuert Token einmal, anschließend wird der GET erneut ausgeführt',async()=>{
  let refreshes=0;
  const {context,calls}=app((u,options)=>{
    if(u.includes('/token')){refreshes++;return response(200,{}, {access_token:'fresh',expires_in:3600});}
    return response(options.headers.get('Authorization')==='Bearer fresh'?200:401);
  });
  assert.equal((await context.odFetch(url)).status,200);assert.equal(refreshes,1);assert.equal(calls.length,3);
});

test('Weitere 401 nach Token-Erneuerung enden ohne Endlosschleife',async()=>{
  const {context,calls}=app(u=>u.includes('/token')?response(200,{}, {access_token:'fresh',expires_in:3600}):response(401));
  await assert.rejects(context.odFetch(url),e=>e.status===401);assert.equal(calls.length,3);
});

test('Abmeldung während Token-Erneuerung stellt die Anmeldung nicht wieder her',async()=>{
  let release;
  const wait=new Promise(resolve=>release=resolve);
  const {context,store}=app(async()=>{await wait;return response(200,{}, {access_token:'fresh',expires_in:3600});},{expired:true});
  const load=context.oneDriveAccessToken();store.delete('fw_onedrive_tokens');release();
  await assert.rejects(load,/geändert/);assert.equal(store.has('fw_onedrive_tokens'),false);
});

test('Retry-After kann ein HTTP-Datum sein; deaktivierte Wiederholung bleibt deaktiviert',async()=>{
  const {context}=app(()=>response(200));
  const now=vm.runInContext('Date.now()',context);
  const delay=context.odRetryDelay(response(503,{'Retry-After':new Date(now+5000).toUTCString()}),0);
  assert.ok(delay>4000&&delay<=5000);
  const b=app(()=>response(503));await assert.rejects(b.context.odFetch(url,{},false));assert.equal(b.calls.length,1);
});
