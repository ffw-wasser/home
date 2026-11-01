const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
function fixture({status=200}={}){const sent=[],c=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,Date,atob,btoa,AbortSignal,fetch:async(url,options)=>{if(options.redirect==='error')throw TypeError('Workers does not implement redirect mode error');assert.equal(options.redirect,'manual','never follow redirects with provider authorization');sent.push({url,options});return new Response(null,{status,headers:status===302?{Location:'https://evil.invalid'}:{}});}});vm.runInContext(fs.readFileSync('cloudflare/push/native-push.js','utf8'),c);return {api:c.NativePush,sent};}
test('APNs accepts only canonical production Apple device endpoints',()=>{
 const f=fixture(),url=f.api.endpoint('a'.repeat(64));assert.equal(f.api.isEndpoint(url),true);
 for(const address of [url+'?x=1',url+'#x',url.replace('api.push.apple.com','api.push.apple.com.evil.test'),url.replace('https:','http:'),url.replace('/3/device/','/other/')])assert.equal(f.api.isEndpoint(address),false);
 assert.equal(f.api.endpoint('not-a-device'),null);
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
test('APNs returns a redirect as a failed response without forwarding authorization',async()=>{
 const f=fixture({status:302}),keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),der=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey)),env={H2O_APNS_TEAM_ID:'VKL57X3H6F',H2O_APNS_KEY_ID:'SYNTHKEY01',H2O_APNS_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----'};
 const response=await f.api.send(env,f.api.endpoint('a'.repeat(64)));assert.equal(response.ok,false);assert.equal(response.status,302);assert.equal(f.sent.length,1);assert.match(f.sent[0].url,/^https:\/\/api\.push\.apple\.com\//);
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
