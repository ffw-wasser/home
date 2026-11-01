const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync('cloudflare/push/android-push.js','utf8');
function fixture({oauthStatus=200,messageStatus=200}={}){const requests=[],c=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,URLSearchParams,Date,atob,btoa,AbortSignal,fetch:async(url,options)=>{if(options.redirect==='error')throw TypeError('Workers does not implement redirect mode error');assert.equal(options.redirect,'manual','never follow redirects with server credentials');requests.push({url,options});return new Response(url.includes('oauth2')?JSON.stringify({access_token:'synthetic_access_token_123456789',expires_in:3600}):'{}',{status:url.includes('oauth2')?oauthStatus:messageStatus,headers:{'content-type':'application/json',Location:'https://evil.invalid'}});}});vm.runInContext(source,c);return {api:c.AndroidPush,requests};}
test('Android FCM rejects arbitrary URLs and remains unavailable before configuration',async()=>{
 const {api,requests}=fixture(),url=api.endpoint('synthetic-token-123456789');assert.equal(api.isEndpoint(url),true);
 for(const value of [url+'?secret=1',url+'#fragment',url.replace('googleapis.com','evil.invalid'),url.replace('https:','http:')])assert.equal(api.isEndpoint(value),false);
 assert.equal(api.endpoint(''),null);assert.equal(api.endpoint('a'.repeat(4097)),null);assert.equal(api.ready({}),false);await assert.rejects(api.send({},url));assert.equal(requests.length,0);
});
test('FCM uses signed server OAuth, fixed Google origins and no private lockscreen data',async()=>{
 const {api,requests}=fixture(),keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pem=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64'),env={H2O_FCM_PROJECT_ID:'synthetic-h2o',H2O_FCM_CLIENT_EMAIL:'sender@synthetic-h2o.iam.gserviceaccount.com',H2O_FCM_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+pem+'\n-----END PRIVATE KEY-----'};
 assert.equal(api.ready(env),true);const jsonEnv={H2O_FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:env.H2O_FCM_PROJECT_ID,client_email:env.H2O_FCM_CLIENT_EMAIL,private_key:env.H2O_FCM_PRIVATE_KEY,token_uri:'https://evil.invalid'})};await api.send(jsonEnv,api.endpoint('synthetic-token-123456789'));await api.send(env,api.endpoint('synthetic-token-987654321'));
 assert.equal(requests.length,3,'OAuth access token reused');assert.equal(requests[0].url,'https://oauth2.googleapis.com/token');
 const jwt=new URLSearchParams(requests[0].options.body).get('assertion').split('.');assert.equal(await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(jwt[2],'base64url'),Buffer.from(jwt[0]+'.'+jwt[1])),true);
 const claims=JSON.parse(Buffer.from(jwt[1],'base64url'));assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');
 const sent=requests[1];assert.equal(sent.url,'https://fcm.googleapis.com/v1/projects/synthetic-h2o/messages:send');assert.equal(sent.options.redirect,'manual');
 const payload=JSON.parse(sent.options.body);assert.deepEqual(payload.message.data,{type:'portal-reminder'});assert.equal(payload.message.notification,undefined,'service checks local opt-in before displaying');assert.doesNotMatch(sent.options.body,/memberId|eventId|password|capability|calendar|G26/);
});
for(const stage of ['oauth','message'])test('FCM does not follow a redirect during '+stage,async()=>{
 const f=fixture(stage==='oauth'?{oauthStatus:302}:{messageStatus:302}),keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']),pem=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64'),env={H2O_FCM_PROJECT_ID:'synthetic-h2o',H2O_FCM_CLIENT_EMAIL:'sender@synthetic-h2o.iam.gserviceaccount.com',H2O_FCM_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+pem+'\n-----END PRIVATE KEY-----'};
 const send=f.api.send(env,f.api.endpoint('synthetic-token-123456789'));
 if(stage==='oauth'){await assert.rejects(send,/konnte sich nicht anmelden/);assert.equal(f.requests.length,1);}else{const response=await send;assert.equal(response.status,302);assert.equal(response.ok,false);assert.equal(f.requests.length,2);}
 assert.ok(f.requests.every(request=>new URL(request.url).hostname.endsWith('googleapis.com')));
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

test('Single JSON secret validates service account type and fails closed before any request',async()=>{
 const {api,requests}=fixture(),value={type:'service_account',project_id:'synthetic-h2o',client_email:'sender@synthetic-h2o.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY----- synthetic',token_uri:'https://evil.invalid'};
 const env={H2O_FCM_SERVICE_ACCOUNT_JSON:JSON.stringify(value)};assert.equal(api.ready(env),true);
 for(const raw of ['invalid','null',JSON.stringify({...value,type:'authorized_user'}),'x'.repeat(20001)]){
  const bad={...env,H2O_FCM_SERVICE_ACCOUNT_JSON:raw,H2O_FCM_PROJECT_ID:value.project_id,H2O_FCM_CLIENT_EMAIL:value.client_email,H2O_FCM_PRIVATE_KEY:value.private_key};assert.equal(api.ready(bad),false);await assert.rejects(api.send(bad,api.endpoint('synthetic-token-123456789')));
 }
 assert.equal(api.ready({...env,H2O_FCM_PROJECT_ID:'different-project'}),false);assert.equal(requests.length,0);
});
