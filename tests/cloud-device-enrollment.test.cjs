const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const code=fs.readFileSync(require.resolve('../js/core/cloud-storage.js'),'utf8'),origin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',source='drive:root',sourceHash=createHash('sha256').update(source).digest('hex');
function fixture(){
 const storage=new Map(),pending=new Map(),requests=[];let grant,loseResponse=false;
 const memory=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Response,Headers,AbortSignal,Event,Date,URL,URLSearchParams,JSON,location:{hash:'',pathname:'/home/index.html',search:''},history:{replaceState(){}},localStorage:memory(storage),sessionStorage:memory(pending),navigator:{platform:'Synthetic'},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async(url,options)=>{
  const path=new URL(url).pathname,body=JSON.parse(options.body);requests.push({path,body,auth:options.headers.Authorization});
  if(path==='/storage/claim'){grant={source,sourceHash,run:'b'.repeat(64),deviceId:body.deviceId,expiresAt:Number.MAX_SAFE_INTEGER,permanent:true};if(loseResponse){loseResponse=false;throw new TypeError('Synthetic lost response');}return Response.json(grant);}
  if(path==='/storage/config')return Response.json(grant);throw Error('Unexpected endpoint '+path);
 }});vm.runInContext(code,c);return {c,storage,pending,requests,loseOnce(){loseResponse=true;}};
}
test('QR or copied pairing link creates a private device grant and reload verifies it',async()=>{
 const f=fixture();await f.c.CloudStorage.claim('https://ffw-wasser.github.io/home/index.html#pair='+'Z'.repeat(43));assert.equal(await f.c.CloudStorage.bootstrap(),true);assert.equal(f.c.CloudStorage.connected,true);
 assert.deepEqual(f.requests.map(x=>x.path),['/storage/claim','/storage/config']);assert.equal(f.requests[0].auth,'Bearer ');const stored=JSON.parse(f.storage.get('fw_cloud_device_v1'));assert.equal(stored.token.length,43);assert.equal(f.requests[1].auth,'Bearer '+stored.token);assert.equal(f.pending.size,0);assert.equal(stored.source,source);
 vm.runInContext(code,f.c);assert.equal(f.c.CloudStorage.connected,false);await f.c.CloudStorage.bootstrap();assert.equal(f.c.CloudStorage.connected,true);assert.equal(f.c.CloudStorage.deviceId,stored.deviceId);
});
test('Lost pairing response retries with the same device identity and private secret',async()=>{
 const f=fixture();f.loseOnce();await assert.rejects(f.c.CloudStorage.claim('Z'.repeat(43)),/lost response/);assert.equal(f.storage.size,0);assert.equal(f.pending.size,1);
 await f.c.CloudStorage.claim('Z'.repeat(43));await f.c.CloudStorage.bootstrap();assert.deepEqual(f.requests[0].body,f.requests[1].body);assert.equal(f.pending.size,0);assert.equal(f.c.CloudStorage.connected,true);
});
test('Unrelated links and malformed pairing codes never send requests or store a credential',async()=>{
 for(const value of ['short','https://other.invalid/home/index.html#pair='+'Z'.repeat(43),'https://ffw-wasser.github.io/home/deckel.html#pair='+'Z'.repeat(43)]){const f=fixture();await assert.rejects(f.c.CloudStorage.claim(value),/Kopplungscode/);assert.equal(f.requests.length,0);assert.equal(f.storage.size,0);}
});
