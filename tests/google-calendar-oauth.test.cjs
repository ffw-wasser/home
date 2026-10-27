const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {fixture}=require('./helpers/portal-fixture.cjs');
const client='synthetic.apps.googleusercontent.com',secret='SYNTHETIC-CLIENT-SECRET',access='SYNTHETIC-GOOGLE-ACCESS-TOKEN',verifier='s'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url'),scope='https://www.googleapis.com/auth/calendar.events';
async function setup(){const f=await fixture();f.env.GOOGLE_CALENDAR_CLIENT_ID=client;f.env.GOOGLE_CALENDAR_CLIENT_SECRET=secret;const original=f.c.fetch;let used=false;f.requests=[];f.c.fetch=async(url,options)=>{if(url==='https://oauth2.googleapis.com/token'){if(options.redirect==='error')throw new TypeError('Invalid redirect value, must be follow or manual');f.requests.push({url,options});if(used)return new Response('',{status:400});used=true;return Response.json({token_type:'Bearer',scope,expires_in:3600,access_token:access,refresh_token:'NEVER_RETURN_THIS'});}return original(url,options);};return f;}
test('Google OAuth: only server-authorized administration starts; no credentials means unavailable',async()=>{
 const f=await fixture();assert.equal((await f.call('google-oauth/configuration',{},null,true)).value.configured,false);assert.equal((await f.call('google-oauth/start',{challenge},null,true)).status,503);
 const response=await f.c.worker.fetch(new Request('https://test.example/admin/portal/google-oauth/start',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io','Content-Type':'application/json'},body:JSON.stringify({source:'test-source',challenge})}),f.env);assert.equal(response.status,401);
});
test('Google OAuth: code flow, PKCE, fixed redirect, no offline consent or secret in URL',async()=>{
 const f=await setup(),start=await f.call('google-oauth/start',{challenge},null,true);assert.equal(start.status,200);const u=new URL(start.value.authorizationUrl);
 for(const [key,value] of [['response_type','code'],['code_challenge_method','S256'],['code_challenge',challenge],['access_type','online'],['redirect_uri','https://ffw-wasser.github.io/home/google-calendar-auth.html']])assert.equal(u.searchParams.get(key),value);
 assert.equal(u.searchParams.get('client_secret'),null);assert.equal(u.searchParams.get('state'),start.value.state);assert.equal(start.value.state.includes(verifier),false);
 const exchanged=await f.call('google-oauth/exchange',{code:'synthetic-code',state:start.value.state,verifier},null,true);assert.equal(exchanged.status,200,JSON.stringify(exchanged.value));assert.equal(exchanged.value.accessToken,access);assert.equal(exchanged.value.refresh_token,undefined);assert.equal(JSON.stringify(exchanged.value).includes(secret),false);
 const body=new URLSearchParams(f.requests[0].options.body);assert.equal(body.get('code_verifier'),verifier);assert.equal(body.get('client_secret'),secret);assert.equal(f.requests[0].options.redirect,'manual');
 assert.equal((await f.call('google-oauth/exchange',{code:'synthetic-code',state:start.value.state,verifier},null,true)).status,401,'provider code can be consumed only once');
});
test('Google OAuth: tampering, PKCE mismatch, source changes and expiry fail before token exchange',async()=>{
 const f=await setup(),start=(await f.call('google-oauth/start',{challenge},null,true)).value;
 for(const value of [{state:'tampered',verifier},{state:start.state,verifier:'x'.repeat(43)}])assert.equal((await f.call('google-oauth/exchange',{code:'synthetic-code',...value},null,true)).status,401);
 f.clock.now+=300001;assert.equal((await f.call('google-oauth/exchange',{code:'synthetic-code',state:start.state,verifier},null,true)).status,401);assert.equal(f.requests.length,0);
});

// Real provider outages must not collapse into the unrelated portal outage message.
test('Google OAuth: exchange network and response failures remain specific and secret-free',async()=>{
 for(const mode of ['network','body','null','server']){
  const f=await setup(),start=(await f.call('google-oauth/start',{challenge},null,true)).value;
  f.c.fetch=async()=>{if(mode==='network')throw Error(secret+' '+access);if(mode==='body')return new Response('invalid '+secret,{status:200});if(mode==='null')return Response.json(null);return new Response(secret,{status:503});};
  const result=await f.call('google-oauth/exchange',{code:'synthetic-code',state:start.state,verifier},null,true);
  assert.equal(result.status,503);assert.match(result.value.error,/G01/);assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(JSON.stringify(result).includes(access),false);
 }
});

test('Google OAuth: a redirect is rejected without forwarding client credentials',async()=>{
 const f=await setup(),start=(await f.call('google-oauth/start',{challenge},null,true)).value;let calls=0;
 f.c.fetch=async(url,options)=>{calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.redirect,'manual');return new Response(secret,{status:302,headers:{Location:'https://synthetic.example.invalid/token'}});};
 const result=await f.call('google-oauth/exchange',{code:'synthetic-code',state:start.state,verifier},null,true);
 assert.equal(result.status,503);assert.match(result.value.error,/Weiterleitung.*G01/);assert.equal(calls,1);assert.equal(JSON.stringify(result).includes(secret),false);
});
