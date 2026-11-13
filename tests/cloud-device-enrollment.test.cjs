const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const code=fs.readFileSync(require.resolve('../js/core/cloud-storage.js'),'utf8'),origin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',master='a'.repeat(64),source='drive:root',sourceHash=createHash('sha256').update(source).digest('hex');
function fixture({active=true,hash=sourceHash}={}){
 const storage=new Map(),requests=[];let granted;
 const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Response,Headers,AbortSignal,Event,Date,URL,URLSearchParams,JSON,location:{hash:'',pathname:'/home/index.html',search:''},history:{replaceState(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{},navigator:{},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async(url,options)=>{const path=new URL(url).pathname,body=JSON.parse(options.body);requests.push({path,body,auth:options.headers.Authorization});let result;if(path==='/admin/storage-runtime/status')result={active,source:hash,run:'b'.repeat(64),serverTime:Date.now()};else if(path==='/admin/storage-state/pair'){granted=body;result={ok:true};}else if(path==='/storage/config')result={source,sourceHash,run:granted.run,deviceId:granted.deviceId,expiresAt:granted.expiresAt};else throw Error('Unexpected endpoint '+path);return Response.json(result);}});vm.runInContext(code,c);
 let reads=[];const file=(name,value,relative='Webseite/Getraenke/'+name)=>({name,webkitRelativePath:relative,text:async()=>{reads.push(relative);return typeof value==='string'?value:JSON.stringify(value);}});
 return {c,storage,requests,reads,file,files:()=>[file('push-verbindung.json',{origin,token:master}),file('konten-zentrale.json',{source,state:'active'})]};
}
test('Selecting the shared folder reads only the two connection files and stores an individual device credential',async()=>{
 const f=fixture(),files=f.files();files.push(f.file('private.json',{must:'never be read'},'Webseite/Privat/private.json'),f.file('push-verbindung.json','invalid','Webseite/Backups/Getraenke/push-verbindung.json'));
 await f.c.CloudStorage.enrollFolder(files);assert.equal(f.c.CloudStorage.connected,true);assert.equal(f.reads.length,2);assert.equal(f.requests.filter(r=>r.path==='/admin/storage-state/pair').length,1);assert.equal(f.requests.some(r=>/migration|activate|storage-state\/write|storage-files/.test(r.path)),false);const stored=f.storage.get('fw_cloud_device_v1');assert.equal(stored.includes(master),false);assert.match(JSON.parse(stored).token,/^[A-Za-z0-9_-]{43}$/);assert.equal(f.requests.find(r=>r.path==='/storage/config').auth,'Bearer '+JSON.parse(stored).token);
});
test('The Getraenke subfolder also works without searching for two individual files',async()=>{
 const f=fixture(),files=f.files();files.forEach(x=>x.webkitRelativePath='Getraenke/'+x.name);await f.c.CloudStorage.enrollFolder(files);assert.equal(f.c.CloudStorage.connected,true);
});
test('A missing or ambiguous folder does not transmit credentials or read unrelated files',async()=>{
 for(const duplicate of [false,true]){const f=fixture(),files=f.files();if(duplicate)files.push(files[0]);else files.pop();await assert.rejects(f.c.CloudStorage.enrollFolder(files),/gemeinsamen Ordner Webseite/);assert.equal(f.requests.length,0);assert.equal(f.reads.length,0);}
});
test('Malformed local credentials never appear in an error message',async()=>{
 const f=fixture(),files=f.files();files[0]=f.file('push-verbindung.json','{"token":"'+master);await assert.rejects(f.c.CloudStorage.enrollFolder(files),e=>!e.message.includes(master)&&/nicht gelesen/.test(e.message));assert.equal(f.requests.length,0);
});
test('Folder access grants no device before activation or for a different source',async()=>{
 for(const options of [{active:false},{hash:'f'.repeat(64)}]){const f=fixture(options);await assert.rejects(f.c.CloudStorage.enrollFolder(f.files()),/Datenübernahme/);assert.equal(f.requests.length,1);assert.equal(f.storage.size,0);}
});
