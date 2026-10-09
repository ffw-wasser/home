const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
async function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(require.resolve('../cloudflare/push/schema.sql'),'utf8'));
 const prepare=sql=>{let values=[];const stmt={bind(...args){values=args;return stmt;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const value=db.prepare(sql).run(...values);return {meta:{changes:Number(value.changes)}};},sync(){return db.prepare(sql).run(...values);}};return stmt;};
 const DB={prepare,async batch(stmts){db.exec('BEGIN');try{const result=stmts.map(s=>s.sync());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const env={DB,ADMIN_TOKEN:'a'.repeat(64),INVITE_SECRET:'b'.repeat(64),VAPID_PRIVATE_JWK:JSON.stringify(await webcrypto.subtle.exportKey('jwk',keys.privateKey)),VAPID_PUBLIC_KEY:Buffer.from(await webcrypto.subtle.exportKey('raw',keys.publicKey)).toString('base64url')};
 const sends=[],clock={now:Date.now()},ctx=vm.createContext({crypto:webcrypto,TextEncoder,URL,Request,Response,AbortSignal,JSON,btoa,atob,Uint8Array,Date:class extends Date{static now(){return clock.now;}},fetch:async(url,options)=>{sends.push({url,options});return new Response(null,{status:ctx.pushStatus||201});}});
 vm.runInContext(fs.readFileSync(require.resolve('../cloudflare/push/worker.js'),'utf8').replace('export default {','globalThis.worker={'),ctx);
 async function call(path,data={},token=env.ADMIN_TOKEN,origin='https://ffw-wasser.github.io') {const r=await ctx.worker.fetch(new Request('https://test.account.workers.dev'+path,{method:path==='/health'?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(path==='/health'?{}:{body:JSON.stringify(data)})}),env);return {status:r.status,data:await r.json(),headers:r.headers};}
 const alias='1'.repeat(32),revision='revision-old-0001';return {db,env,ctx,clock,keys,sends,call,alias,revision};
}
test('Push: Geräte-Anmeldung erfordert den eingeschränkten Zugang; Admin-Endpunkte sind geschützt',async()=>{
 const f=await fixture(),{call,alias,revision}=f;
 assert.equal((await call('/admin/check',{},'wrong')).status,401);assert.equal((await call('/admin/check',{},f.env.ADMIN_TOKEN,'https://evil.invalid')).status,403);
 assert.equal((await call('/health')).data.publicKey,f.env.VAPID_PUBLIC_KEY);
 const access=await call('/admin/account',{alias,revision});assert.equal(access.status,200);assert.match(access.data.capability,/^[\w-]{43}$/);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture'},'wrong')).status,401);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://evil.invalid/fixture'},access.data.capability)).status,400);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com:444/fixture'},access.data.capability)).status,400);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture'},access.data.capability)).status,200);
 assert.equal((await call('/admin/status',{alias})).data.devices,1);f.db.close();
});
test('Manueller Versand: leere Payload, gültige VAPID-Signatur, Dublettenschutz und Cooldown',async()=>{
 const f=await fixture(),{call,alias,revision,sends}=f;const {data}=await call('/admin/account',{alias,revision});
 await call('/subscribe',{alias,endpoint:'https://web.push.apple.com/fixture'},data.capability);
 const request={alias,requestId:'request-00001'};const result=await call('/admin/send',request);assert.equal(result.data.accepted,1);assert.equal(sends.length,1);assert.equal(sends[0].options.body,null);assert.equal(sends[0].options.redirect,'error');
 const auth=sends[0].options.headers.Authorization;const token=auth.match(/^vapid t=([^,]+), k=/)[1],parts=token.split('.');const claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claims.aud,'https://web.push.apple.com');assert.equal(Buffer.from(parts[2],'base64url').length,64);assert.equal(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},f.keys.publicKey,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts.slice(0,2).join('.'))),true);
 assert.equal((await call('/admin/send',request)).data.duplicate,true);assert.equal(sends.length,1);assert.equal((await call('/admin/send',{alias,requestId:'request-00002'})).status,429);
 f.clock.now+=61000;f.ctx.pushStatus=410;const expired=await call('/admin/send',{alias,requestId:'request-00002'});assert.equal(expired.data.accepted,0);assert.equal((await call('/admin/status',{alias})).data.devices,0);f.db.close();
});
test('Rotation entfernt Geräte, sperrt alte Anmeldeberechtigungen und verhindert Rücksetzen alter Versionen',async()=>{
 const f=await fixture(),{call,alias,revision}=f;const old=(await call('/admin/account',{alias,revision})).data;await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture'},old.capability);
 const next=(await call('/admin/account',{alias,revision:'revision-new-0001'})).data;assert.notEqual(old.capability,next.capability);assert.equal(next.devices,0);
 assert.equal((await call('/admin/account',{alias,revision})).status,409);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture'},old.capability)).status,401);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture'},next.capability)).status,200);
 assert.equal((await call('/unsubscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture'},next.capability)).status,200);assert.equal((await call('/admin/status',{alias})).data.devices,0);f.db.close();
});
test('Höchstens fünf Geräte je Deckel; ein Handy wird nicht unbemerkt einem anderen Mitglied zugeordnet',async()=>{
 const f=await fixture(),{call,alias,revision}=f,cap=(await call('/admin/account',{alias,revision})).data.capability;
 for(let i=0;i<5;i++)assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture-'+i},cap)).status,200);
 assert.equal((await call('/subscribe',{alias,endpoint:'https://fcm.googleapis.com/fixture-6'},cap)).status,409);
 const other='2'.repeat(32),othercap=(await call('/admin/account',{alias:other,revision})).data.capability;assert.equal((await call('/subscribe',{alias:other,endpoint:'https://fcm.googleapis.com/fixture-1'},othercap)).status,409);f.db.close();
});
test('iPad: Admin-Zugang bleibt in OneDrive; bezahlter Deckel, fehlende Einrichtung und gesperrte Verwaltung senden nicht',async()=>{
 const files=new Map(),calls=[];let balance=300;
 const ctx=vm.createContext({URL,crypto:webcrypto,AbortController,setTimeout,clearTimeout,adminUnlocked:true,document:{readyState:'loading',addEventListener(){}},
  DrinksStore:{readMobileFile:async f=>files.get(f)||null,writeMobileFile:async(f,data)=>files.set(f,{data}),mobileFileName:async()=> 'handy-fixture.json',read:async()=>({balance})},DrinksModel:{totals:a=>a},DrinksMobile:{publish:async()=>true},fetch:async(url,o)=>{calls.push({url,options:o});return {ok:true,json:async()=>({publicKey:'B'.repeat(87),accepted:1,status:'accepted'})};}});
 vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-push.js'),'utf8'),ctx);const P=ctx.DrinksPush;
 await assert.rejects(P.send('member-name','request-001'),/verbinden/);await assert.rejects(P.connect('https://evil.invalid','a'.repeat(64)),/ungültig/);
 await P.connect('https://test.account.workers.dev','a'.repeat(64));assert.equal(files.get('push-verbindung.json').data.token,'a'.repeat(64));files.set('handy-fixture.json',{data:{alias:'1'.repeat(32),revision:'revision-0001',key:'c'.repeat(64)}});
 balance=0;await assert.rejects(P.send('member-name','request-001'),/bezahlt/);balance=300;await P.send('member-name','request-001');
 const send=calls.find(c=>c.url.endsWith('/admin/send'));assert.deepEqual(JSON.parse(send.options.body),{alias:'1'.repeat(32),requestId:'request-001'});assert.ok(!send.options.body.includes('member-name'));assert.ok(!send.options.body.includes('c'.repeat(64)));ctx.adminUnlocked=false;await assert.rejects(P.send('member-name','request-002'),/Administration/);
});
test('Service Worker zeigt einen neutralen Hinweis und holt den persönlichen Link ausschließlich aus lokalem Gerätespeicher',async()=>{
 const events={},shown=[],opened=[];const url='https://ffw-wasser.github.io/home/deckel.html#a='+ '1'.repeat(32)+'&k='+ 'a'.repeat(64);
 const ctx=vm.createContext({URL,Promise,importScripts:()=>{},DeckelDevice:{read:async()=>({url})},
  self:{registration:{scope:'https://ffw-wasser.github.io/home/',showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>[],openWindow:async u=>opened.push(u)},addEventListener:(name,fn)=>events[name]=fn}});
 vm.runInContext(fs.readFileSync(require.resolve('../service-worker.js'),'utf8'),ctx);let promise;
 events.push({waitUntil:p=>promise=p});await promise;assert.match(shown[0].options.body,/Dein Deckel/);assert.ok(!JSON.stringify(shown).includes('a'.repeat(64)));assert.equal(shown[0].options.data,undefined);
 events.notificationclick({notification:{close(){}},waitUntil:p=>promise=p});await promise;assert.deepEqual(opened,[url]);
});
