const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync('cloudflare/push/android-push.js','utf8');
function fixture(){const requests=[],c=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,URLSearchParams,Date,atob,btoa,AbortSignal,fetch:async(url,options)=>{requests.push({url,options});return new Response(url.includes('oauth2')?JSON.stringify({access_token:'synthetic_access_token_123456789',expires_in:3600}):'{}',{status:200,headers:{'content-type':'application/json'}});}});vm.runInContext(source,c);return {api:c.AndroidPush,requests};}
test('Android FCM rejects arbitrary URLs and remains unavailable before configuration',async()=>{
 const {api,requests}=fixture(),url=api.endpoint('synthetic-token-123456789');assert.equal(api.isEndpoint(url),true);
 for(const value of [url+'?secret=1',url+'#fragment',url.replace('googleapis.com','evil.invalid'),url.replace('https:','http:')])assert.equal(api.isEndpoint(value),false);
 assert.equal(api.endpoint(''),null);assert.equal(api.endpoint('a'.repeat(4097)),null);assert.equal(api.ready({}),false);await assert.rejects(api.send({},url));assert.equal(requests.length,0);
});
test('FCM uses signed server OAuth, fixed Google origins and no private lockscreen data',async()=>{
 const {api,requests}=fixture(),keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pem=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64'),env={H2O_FCM_PROJECT_ID:'synthetic-h2o',H2O_FCM_CLIENT_EMAIL:'sender@synthetic-h2o.iam.gserviceaccount.com',H2O_FCM_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+pem+'\n-----END PRIVATE KEY-----'};
 assert.equal(api.ready(env),true);await api.send(env,api.endpoint('synthetic-token-123456789'));await api.send(env,api.endpoint('synthetic-token-987654321'));
 assert.equal(requests.length,3,'OAuth access token reused');assert.equal(requests[0].url,'https://oauth2.googleapis.com/token');
 const jwt=new URLSearchParams(requests[0].options.body).get('assertion').split('.');assert.equal(await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(jwt[2],'base64url'),Buffer.from(jwt[0]+'.'+jwt[1])),true);
 const claims=JSON.parse(Buffer.from(jwt[1],'base64url'));assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');
 const sent=requests[1];assert.equal(sent.url,'https://fcm.googleapis.com/v1/projects/synthetic-h2o/messages:send');assert.equal(sent.options.redirect,'error');
 const payload=JSON.parse(sent.options.body);assert.deepEqual(payload.message.data,{type:'portal-reminder'});assert.equal(payload.message.notification,undefined,'service checks local opt-in before displaying');assert.doesNotMatch(sent.options.body,/memberId|eventId|password|capability|calendar|G26/);
});
const {fixture:portalFixture}=require('./helpers/portal-fixture.cjs');
test('Android registration enforces independent readiness, ownership, five devices and revocation',async()=>{
 const f=await portalFixture(),data={platform:'android',action:'subscribe',deviceToken:'synthetic-device-token-123456789'};
 assert.equal((await f.call('native-push',data)).status,503);
 Object.assign(f.env,{H2O_FCM_PROJECT_ID:'synthetic-h2o',H2O_FCM_CLIENT_EMAIL:'sender@synthetic-h2o.iam.gserviceaccount.com',H2O_FCM_PRIVATE_KEY:'-----BEGIN PRIVATE KEY----- synthetic'});
 assert.equal((await f.call('native-push',data)).value.registered,true);
 assert.equal((await f.call('native-push',data,f.people[1])).status,409);
 assert.equal((await f.call('native-push',{...data,action:'unsubscribe'},f.people[1])).value.registered,false);
 assert.equal((await f.call('native-push',{...data,action:'status'})).value.registered,true);
 assert.equal((await f.call('native-push',{action:'status'})).value.ready,false,'Android configuration does not enable Apple');
 for(let n=1;n<5;n++)assert.equal((await f.call('native-push',{...data,deviceToken:data.deviceToken+n})).value.registered,true);
 assert.equal((await f.call('native-push',{...data,deviceToken:data.deviceToken+'six'})).status,409);
 assert.equal((await f.call('native-push',{...data,action:'unsubscribe'})).value.registered,false);
 assert.equal((await f.call('native-push',{...data,platform:'unknown'})).status,400);
 f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('revoked',f.people[0].alias);
 assert.equal((await f.call('native-push',data)).status,401);
});
test('Android document adapter only exposes bridges in trusted top-level portal pages',()=>{
 const source=fs.readFileSync('native/shared/android-entry.js','utf8');
 function run({origin='https://ffw-wasser.github.io',pathname='/home/deckel.html',frame=false}={}){const sent=[],events=[],c={location:{origin,pathname},H2OWidget:{postMessage:v=>sent.push(JSON.parse(v))},H2ONotifications:{postMessage:v=>sent.push(JSON.parse(v))},dispatchEvent:v=>events.push(v),CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}};c.window=c;c.top=frame?{}:c;vm.runInNewContext(source,c);return {c,sent,events};}
 for(const options of [{origin:'https://evil.invalid'},{pathname:'/home/privacy.html'},{frame:true}])assert.equal(run(options).c.webkit,undefined);
 const f=run();f.c.webkit.messageHandlers.h2oWidget.postMessage({action:'clear'});assert.deepEqual(f.sent,[{action:'clear'}]);f.c.H2ONotifications.onmessage({data:JSON.stringify({id:'synthetic',permission:'granted'})});assert.equal(f.events[0].type,'h2o-native-notifications');
});
