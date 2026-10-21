const assert=require('node:assert/strict');
async function passkey(f,{register='passkey/register',code,token}={}){
 const {encodeCBOR}=require('@levischuck/tiny-cbor'),{generateKeyPairSync}=require('node:crypto');
 const keys=generateKeyPairSync('rsa',{modulusLength:2048}),jwk=keys.publicKey.export({format:'jwk'}),id=require('node:crypto').randomBytes(32),b64=x=>Buffer.from(x).toString('base64url');
 const pub=new Map([[1,3],[3,-257],[-1,new Uint8Array(Buffer.from(jwk.n,'base64url'))],[-2,new Uint8Array(Buffer.from(jwk.e,'base64url'))]]);
 const rp=require('node:crypto').createHash('sha256').update('ffw-wasser.github.io').digest();
 const client=(type,challenge,origin='https://ffw-wasser.github.io')=>Buffer.from(JSON.stringify({type,challenge,origin,crossOrigin:false}));
 const call=async(path,data,auth)=>{if(register==='passkey/register'&&path.startsWith(register+'/')){try{return {status:200,value:await f.c.WhatsAppPasskeys.route(path.slice(8),data||{},f.env,f.people[0])};}catch(e){return {status:e.status||500,value:{error:e.message}};}}return f.call(path,data,auth);};
 const start=await call(register+'/options',code?{code}:{},token);assert.equal(start.status,200,JSON.stringify(start.value));
 const auth=Buffer.concat([rp,Buffer.from([0x45]),Buffer.alloc(4),Buffer.alloc(16),Buffer.from([0,id.length]),id,Buffer.from(encodeCBOR(pub))]);
 const response={id:b64(id),rawId:b64(id),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:b64(client('webauthn.create',start.value.options.challenge)),attestationObject:b64(encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',new Uint8Array(auth)]])))}};
 const verified=await call(register+'/verify',{id:start.value.id,response,...(code?{code}:{})},token);assert.equal(verified.status,200,JSON.stringify(verified.value));
 const login=async({origin,flags=5,rpHash=rp,tamper=false,portal=false}={})=>{
  const challenge=portal?await f.call('passkey/portal/login/options'):{value:await f.c.WhatsAppPasskeys.route('login/options',{},f.env)},data=client('webauthn.get',challenge.value.options.challenge,origin),auth=Buffer.concat([rpHash,Buffer.from([flags]),Buffer.alloc(4)]);
  const signed=Buffer.concat([auth,require('node:crypto').createHash('sha256').update(data).digest()]);
  const sig=require('node:crypto').sign('sha256',signed,keys.privateKey);if(tamper)sig[10]^=1;
  return {id:challenge.value.id,response:{id:b64(id),rawId:b64(id),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:b64(data),authenticatorData:b64(auth),signature:b64(sig),userHandle:start.value.options.user.id}}};
 };
 return {login,start,response};
}
module.exports={passkey};
