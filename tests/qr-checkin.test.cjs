const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/portal-fixture.cjs');
test('Anwesenheitscode: verschlüsselt, nur Administration löst auf, Ablauf und Sperre',async()=>{
 const f=await fixture();const issued=await f.call('checkin-code');assert.equal(issued.status,200,JSON.stringify(issued.value));const {code}=issued.value;
 assert.ok(code.startsWith('FFW-CHECKIN:1:'));assert.ok(!code.includes(f.people[0].memberId));
 assert.equal((await f.call('checkin-resolve',{code})).status,404);
 const resolved=await f.call('checkin-resolve',{code},null,true);assert.equal(resolved.status,200,JSON.stringify(resolved.value));assert.equal(resolved.value.memberId,f.people[0].memberId);
 assert.equal((await f.call('checkin-resolve',{code:code.slice(0,-4)+'AAAA'},null,true)).status,400);
 f.clock.now+=91000;assert.equal((await f.call('checkin-resolve',{code},null,true)).status,400);
 const next=(await f.call('checkin-code')).value.code;
 f.sql.prepare('DELETE FROM ledger_access WHERE alias=?').run(f.people[0].alias);
 assert.equal((await f.call('checkin-resolve',{code:next},null,true)).status,401);
});

test('Persönlicher verschlüsselter Code wird vom iPad-Decoder als QR erkannt',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),jsQR=require('jsqr'),context=vm.createContext({});vm.runInContext(fs.readFileSync('js/vendor/qrcode.js','utf8'),context);const f=await fixture(),code=(await f.call('checkin-code')).value.code,qr=context.qrcode(0,'M');qr.addData(code);qr.make();const count=qr.getModuleCount(),unit=4,size=(count+8)*unit,pixels=new Uint8ClampedArray(size*size*4).fill(255);for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))for(let y=0;y<unit;y++)for(let x=0;x<unit;x++){const i=(((r+4)*unit+y)*size+(c+4)*unit+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}assert.equal(jsQR(pixels,size,size).data,code);
});
