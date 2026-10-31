const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
function fixture(reply){const sent=[],c=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,Date,atob,btoa,AbortSignal,URLSearchParams,Response,fetch:async(url,options)=>{sent.push({url,options});return reply?reply(url,options):new Response(null,{status:200});}});vm.runInContext(fs.readFileSync('cloudflare/push/native-push.js','utf8'),c);return {api:c.NativePush,sent};}
test('APNs accepts only canonical production Apple device endpoints',()=>{
 const f=fixture(),url=f.api.endpoint('a'.repeat(64));assert.equal(f.api.isEndpoint(url),true);
 for(const address of [url+'?x=1',url+'#x',url.replace('api.push.apple.com','api.push.apple.com.evil.test'),url.replace('https:','http:'),url.replace('/3/device/','/other/')])assert.equal(f.api.isEndpoint(address),false);
 assert.equal(f.api.endpoint('not-a-device'),null);
});

const serviceAccount=privateKey=>({project_id:'synthetic-h2o',client_email:'h2o@synthetic-h2o.iam.gserviceaccount.com',private_key:privateKey,token_uri:'https://oauth2.googleapis.com/token'});
test('Android accepts only bounded canonical FCM tokens and fixed OAuth destinations',async()=>{
 const f=fixture(),token='synthetic_token:'.repeat(10),url=f.api.endpoint(token,'android');
 assert.equal(f.api.isEndpoint(url),true);assert.equal(f.api.endpoint(token),null);
 for(const invalid of [url+'?a=b',url+'#secret',url.replace('googleapis.com','googleapis.com.evil.test'),url.replace('https:','http:')])assert.equal(f.api.isEndpoint(invalid),false);
 for(const value of ['short','x'.repeat(4097),'a'.repeat(64)+'/path'])assert.equal(f.api.endpoint(value,'android'),null);
 const account=serviceAccount('-----BEGIN PRIVATE KEY----- synthetic');
 assert.equal(f.api.ready({H2O_FCM_SERVICE_ACCOUNT:JSON.stringify(account)},'android'),true);
 for(const change of [{token_uri:'https://evil.test/token'},{project_id:'../../evil'},{client_email:'evil@example.test'}])assert.equal(f.api.ready({H2O_FCM_SERVICE_ACCOUNT:JSON.stringify({...account,...change})},'android'),false);
 await assert.rejects(f.api.send({},url));assert.equal(f.sent.length,0);
});
test('FCM uses a signed short-lived OAuth assertion and data-only generic delivery',async()=>{
 const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)),env={H2O_FCM_SERVICE_ACCOUNT:JSON.stringify(serviceAccount('-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----'))};
 const f=fixture(async url=>url==='https://oauth2.googleapis.com/token'?Response.json({access_token:'synthetic-oauth',expires_in:3600}):Response.json({name:'synthetic-message'})),device='synthetic_token:'.repeat(10);
 await f.api.send(env,f.api.endpoint(device,'android'));await f.api.send(env,f.api.endpoint(device,'android'));
 assert.equal(f.sent.length,3);const parts=f.sent[0].options.body.get('assertion').split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
 assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.equal(claims.exp-claims.iat,3600);assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');
 assert.equal(await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(parts[2],'base64url'),Buffer.from(parts[0]+'.'+parts[1])),true);
 const delivery=f.sent[1];assert.equal(delivery.url,'https://fcm.googleapis.com/v1/projects/synthetic-h2o/messages:send');assert.equal(delivery.options.headers.authorization,'Bearer synthetic-oauth');
 assert.deepEqual(JSON.parse(delivery.options.body),{message:{token:device,data:{kind:'portal-reminder'},android:{priority:'high',ttl:'3600s'}}});
 assert.doesNotMatch(delivery.options.body,/memberId|eventId|capability|password|notification|calendar/);
});
test('Android registrations enforce ownership, five-device limit and membership revision',async()=>{
 const f=await portalFixture(),data={platform:'android',deviceToken:'synthetic-token-'.repeat(10)};
 assert.equal((await f.call('native-push',{...data,action:'subscribe'})).status,503);
 f.env.H2O_FCM_SERVICE_ACCOUNT=JSON.stringify(serviceAccount('-----BEGIN PRIVATE KEY----- synthetic'));
 assert.equal((await f.call('native-push',{...data,action:'subscribe'})).value.registered,true);
 assert.equal((await f.call('native-push',{...data,action:'subscribe'},f.people[1])).status,409);
 assert.equal((await f.call('native-push',{...data,action:'unsubscribe'},f.people[1])).value.registered,false);
 assert.equal((await f.call('native-push',{...data,action:'status'})).value.registered,true);
 for(let i=0;i<4;i++)assert.equal((await f.call('native-push',{...data,deviceToken:data.deviceToken+i,action:'subscribe'})).value.registered,true);
 assert.equal((await f.call('native-push',{...data,deviceToken:data.deviceToken+'sixth',action:'subscribe'})).status,409);
 assert.equal((await f.call('native-push',{...data,action:'unsubscribe'})).value.registered,false);
 f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('changed-revision',f.people[0].alias);
 assert.equal((await f.call('native-push',{...data,action:'subscribe'})).status,401);
});

test('FCM removes only an explicitly unregistered device, not a missing project',async()=>{
 const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)),env={H2O_FCM_SERVICE_ACCOUNT:JSON.stringify(serviceAccount('-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----'))};
 for(const [details,status] of [[[{errorCode:'UNREGISTERED'}],410],[[],503]]){
  const f=fixture(async url=>url==='https://oauth2.googleapis.com/token'?Response.json({access_token:'synthetic-oauth',expires_in:3600}):Response.json({error:{details}},{status:404}));
  assert.equal((await f.api.send(env,f.api.endpoint('synthetic_token:'.repeat(10),'android'))).status,status);
 }
});
test('APNs requires configured Apple signing data and never sends before setup',async()=>{
 const f=fixture();assert.equal(f.api.ready({}),false);await assert.rejects(f.api.send({},f.api.endpoint('a'.repeat(64))));assert.equal(f.sent.length,0);
});
test('APNs signs the expected team and topic and sends no member or event details',async()=>{
 const f=fixture(),keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),der=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)),env={H2O_APNS_TEAM_ID:'VKL57X3H6F',H2O_APNS_KEY_ID:'SYNTHKEY01',H2O_APNS_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----'};
 assert.equal(f.api.ready(env),true);await f.api.send(env,f.api.endpoint('a'.repeat(64)));const {options}=f.sent[0],parts=options.headers.authorization.slice(7).split('.');
 assert.equal(JSON.parse(Buffer.from(parts[0],'base64url')).kid,'SYNTHKEY01');assert.equal(JSON.parse(Buffer.from(parts[1],'base64url')).iss,'VKL57X3H6F');
 assert.equal(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},keys.publicKey,Buffer.from(parts[2],'base64url'),Buffer.from(parts[0]+'.'+parts[1])),true);
 assert.equal(options.headers['apns-topic'],'de.feuerwehrwasser.h2o');assert.equal(options.headers['apns-push-type'],'alert');
 const payload=JSON.parse(options.body);assert.deepEqual(Object.keys(payload),['aps']);assert.doesNotMatch(options.body,/memberId|eventId|capability|password|calendar/);
});

const {fixture:portalFixture}=require('./helpers/portal-fixture.cjs');
test('Native registration requires current membership, respects ownership and revocation',async()=>{
 const f=await portalFixture(),deviceToken='b'.repeat(64),configured={H2O_APNS_TEAM_ID:'VKL57X3H6F',H2O_APNS_KEY_ID:'SYNTHKEY01',H2O_APNS_PRIVATE_KEY:'-----BEGIN PRIVATE KEY----- synthetic'};
 assert.equal((await f.call('native-push',{action:'subscribe',deviceToken})).status,503);Object.assign(f.env,configured);
 assert.equal((await f.call('native-push',{action:'subscribe',deviceToken})).value.registered,true);
 assert.equal((await f.call('native-push',{action:'subscribe',deviceToken},f.people[1])).status,409);
 assert.equal((await f.call('native-push',{action:'unsubscribe',deviceToken},f.people[1])).value.registered,false);
 assert.equal((await f.call('native-push',{action:'status',deviceToken})).value.registered,true);
 assert.equal((await f.call('native-push',{action:'unsubscribe',deviceToken})).value.registered,false);
 f.sql.prepare('UPDATE accounts SET revision=? WHERE alias=?').run('changed-revision',f.people[0].alias);
 assert.equal((await f.call('native-push',{action:'subscribe',deviceToken})).status,401);
});
