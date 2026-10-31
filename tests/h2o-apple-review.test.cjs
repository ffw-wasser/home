'use strict';
// Tests exercise ONLY the self-contained review worker with fake, in-memory D1.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=fs.readFileSync(path.join(__dirname,'../cloudflare/review/worker.js'),'utf8');
const ROOT='https://h2o-apple-review.522dn4fc5f.workers.dev';
const CODE='SYNTHETIC_DEMO_TEST_ONLY_NOT_A_REAL_SECRET_123';
const KEY='SYNTHETIC_HMAC_TEST_KEY_NOT_A_REAL_SECRET_456';
const loaded=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){
  const rows=new Map();
  const DB={prepare(sql){
    if(sql.startsWith('SELECT'))return{all:async()=>({results:Array.from(rows,([event_id,status])=>({event_id,status}))})};
    if(sql.startsWith('INSERT'))return{bind(id,status,stamp){return{run:async()=>{rows.set(id,status)}}}};
    throw Error('unexpected SQL');
  }};
  return{DB,H2O_REVIEW_INVITE_CODE:CODE,H2O_REVIEW_SESSION_KEY:KEY,rows};
}
async function call(url,env,method='GET',body,token,origin=ROOT){
  const headers={};
  if(method==='POST'){headers['Content-Type']='application/json';headers.Origin=origin}
  if(token)headers.Authorization='Bearer '+token;
  const request=new Request(url.startsWith('https://')?url:ROOT+url,{method,headers,body:method==='POST'?JSON.stringify(body||{}):undefined});
  const worker=(await loaded).default;
  return worker.fetch(request,env);
}
async function login(env){
  const res=await call('/api/login',env,'POST',{code:CODE});
  assert.equal(res.status,200);
  return (await res.json()).token;
}
test('review worker requires exact isolated hostname and returns no secrets',async()=>{
  const env=fixture();
  const wrong=await call('https://ffw-wasser.github.io/home/deckel.html',env);
  assert.equal(wrong.status,403);
  const health=await call('/health',env);
  assert.equal(health.status,200);
  const data=await health.json();
  assert.deepEqual(data,{ok:true,environment:'synthetic-review',configured:true});
  assert.ok(!JSON.stringify(data).includes(CODE));
});
test('review page has restrictive CSP, synthetic label and no embedded credentials',async()=>{
  const res=await call('/home/deckel.html',fixture());
  assert.equal(res.status,200);
  const html=await res.text();
  const csp=res.headers.get('Content-Security-Policy');
  assert.ok(csp.includes("default-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("script-src 'nonce-"));
  assert.ok(html.includes('Apple-Prüfversion'));
  assert.ok(!html.includes(CODE));
  assert.ok(!html.includes('__NONCE__'));
});
test('unauthenticated requests and false QR code do not expose demo appointments',async()=>{
  const env=fixture();
  const denied=await call('/api/events',env,'POST',{});
  assert.equal(denied.status,401);
  const bad=await call('/api/login',env,'POST',{code:'an-invalid-code'});
  assert.equal(bad.status,401);
  const cors=await call('/api/login',env,'POST',{code:CODE},null,'https://another.example');
  assert.equal(cors.status,403);
  assert.equal(env.rows.size,0);
});
test('authorized review session returns only fake events and persists reply in demo D1',async()=>{
  const env=fixture();
  const token=await login(env);
  const list=await call('/api/events',env,'POST',{},token);
  assert.equal(list.status,200);
  const events=(await list.json()).events;
  assert.equal(events.length,3);
  assert.equal(events[0].id,'demo-probe');
  assert.equal(events[0].status,'open');
  assert.ok(events.every(e=>e.location==='Gerätehaus Wasser (Demo)'));
  const berlinHour = ms => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23'
  }).format(new Date(ms));
  assert.deepEqual(events.map(e => berlinHour(e.start)), ['18', '18', '17']);
  assert.ok(events.every(e => e.end - e.start === 2 * 3600000));
  const post=await call('/api/reply',env,'POST',{id:'demo-probe',status:'yes'},token);
  assert.equal(post.status,200);
  assert.equal((await post.json()).events[0].status,'yes');
  assert.equal(env.rows.get('demo-probe'),'yes');
  const malicious=await call('/api/reply',env,'POST',{id:'REAL_EVENT',status:'yes'},token);
  assert.equal(malicious.status,400);
  assert.equal(env.rows.size,1);
});
test('demo refuses to operate with missing review-only secrets',async()=>{
  const env=fixture();
  delete env.H2O_REVIEW_SESSION_KEY;
  const response=await call('/api/login',env,'POST',{code:CODE});
  assert.equal(response.status,503);
});
