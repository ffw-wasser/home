const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/install.js'),'utf8');
async function route(config,device='desktop',failed=false){
 const nodes=new Map(),destinations=[],requests=[];
 const sandbox={URL,navigator:{userAgent:device==='android'?'Android':device==='apple'?'iPhone':'Desktop',platform:device==='ipad'?'MacIntel':'',maxTouchPoints:device==='ipad'?5:0},
  document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true});return nodes.get(id);}},
  location:{href:'https://synthetic.example/install.html?member=private#setup=private',replace:url=>destinations.push(url)},
  fetch:async(url,options)=>{requests.push({url,options});return {ok:!failed,json:async()=>config};}};
 vm.runInNewContext(source,sandbox);await new Promise(resolve=>setImmediate(resolve));return {nodes,destinations,requests};
}
const ios='https://apps.apple.com/de/app/h2o-portal/id1234567890',android='https://play.google.com/apps/internaltest/1234567890';
test('Phone routing uses approved exact store URLs without forwarding member information',async()=>{
 for(const [device,target] of [['apple',ios],['ipad',ios],['android',android],['desktop',null]]){
  const r=await route({ios,android},device);assert.deepEqual(r.destinations,target?[target]:[]);
  assert.equal(r.requests[0].url,'native/store/install-links.json');assert.equal(r.requests[0].options.credentials,'omit');
  assert.equal(r.nodes.get('apple-store').href,ios);assert.equal(r.nodes.get('android-store').href,android);
 }
});
test('Unapproved store destinations, embedded secrets and malformed links stay unavailable',async()=>{
 for(const value of ['https://evil.example/install','https://play.google.com.evil.example/apps/internaltest/123','http://play.google.com/apps/internaltest/123','https://user:secret@play.google.com/apps/internaltest/123','https://play.google.com:444/apps/internaltest/123',android+'?token=private',android+'#setup=private','javascript:alert(1)',null]){
  const r=await route({ios:value,android:value},'android');assert.deepEqual(r.destinations,[]);assert.equal(r.nodes.get('android-store')?.href,undefined);
 }
 const pending=await route({ios:null,android},'apple');assert.deepEqual(pending.destinations,[]);assert.equal(pending.nodes.get('apple-store')?.href,undefined);
 const failed=await route({},'android',true);assert.deepEqual(failed.destinations,[]);assert.match(failed.nodes.get('install-state').textContent,/nicht verfügbar/);
 const beta='https://testflight.apple.com/join/Ab12Cd34';assert.deepEqual((await route({ios:beta},'apple')).destinations,[beta]);
});
