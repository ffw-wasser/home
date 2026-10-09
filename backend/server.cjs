'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
require('../js/features/drinks/drinks-model.js');
const M=globalThis.DrinksModel;
const hash=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const fail=status=>Object.assign(new Error('Zugriff nicht möglich.'),{status});
function graphReader(env,fetcher=fetch){
  let access='',expiry=0,refresh=env.MS_REFRESH_TOKEN,refreshing;
  async function token(){
    if(Date.now()<expiry)return access;
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      const body=new URLSearchParams({client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:refresh,scope:'https://graph.microsoft.com/Files.Read offline_access'});
      const response=await fetcher('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',body,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw fail(503);
      const data=await response.json();if(!data.access_token)throw fail(503);
      access=data.access_token;refresh=data.refresh_token||refresh;expiry=Date.now()+Math.max(0,(data.expires_in-60))*1000;return access;
    })();try{return await refreshing;}finally{refreshing=null;}
  }
  return async filename=>{
    const base='https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(env.OD_DRIVE_ID)+'/items/'+encodeURIComponent(env.OD_DRINKS_FOLDER_ID);
    const headers={Authorization:'Bearer '+await token()};
    // Read metadata, download, then recheck the revision to avoid mixing writes.
    for(let attempt=0;attempt<3;attempt++){
      const meta=await fetcher(base+':/'+filename+'?$select=id,eTag,file',{headers,signal:AbortSignal.timeout(15000)});
      if(!meta.ok)throw fail(meta.status===404?401:503);
      const item=await meta.json();if(!item.file||!item.eTag)throw fail(503);
      const url='https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(env.OD_DRIVE_ID)+'/items/'+encodeURIComponent(item.id);
      // Graph redirects /content to its short-lived download URL. Never forward a bearer token there.
      const content=await fetcher(url+'/content',{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
      let downloaded=content;
      if(content.status===302){const location=new URL(content.headers.get('location'));if(location.protocol!=='https:')throw fail(503);downloaded=await fetcher(location,{signal:AbortSignal.timeout(15000)});}
      if(!downloaded.ok)throw fail(503);const data=await downloaded.json();
      const check=await fetcher(url+'?$select=eTag',{headers,signal:AbortSignal.timeout(15000)});
      if(!check.ok)throw fail(503);if((await check.json()).eTag===item.eTag)return data;
    }throw fail(503);
  };
}
function createServer({env=process.env,read,now=Date.now,secure=true}={}){
  const configured=Boolean(read)||['MS_CLIENT_ID','MS_CLIENT_SECRET','MS_REFRESH_TOKEN','OD_DRIVE_ID','OD_DRINKS_FOLDER_ID'].every(k=>env[k]);
  const secret=env.SESSION_SECRET;
  if(!secret||secret.length<32)throw new Error('SESSION_SECRET mit mindestens 32 Zeichen erforderlich.');
  read=read||graphReader(env);
  const limits=new Map();
  const sign=value=>createHmac('sha256',secret).update(value).digest('base64url');
  function rate(key){
    const time=now();for(const [k,v]of limits)if(time>v.until)limits.delete(k);
    if(limits.size>=10000&&!limits.has(key))throw fail(429);
    const value=limits.get(key)||{count:0,until:time+15*60000};if(++value.count>5)throw fail(429);limits.set(key,value);
  }
  async function account(id,revision){
    if(typeof id!=='string'||!id.length||id.length>150)throw fail(401);
    const suffix=hash(id)+'.json',access=await read('zugang-'+suffix);
    if(access.schemaVersion!==1||access.memberId!==id||!same(access.revision,revision)||!/^\w{64}$/.test(access.tokenHash))throw fail(401);
    const data=M.validate(await read('konto-'+suffix),id);if(!data.pin)throw fail(401);
    return {access,data};
  }
  function session(req){
    const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('deckel='));
    if(!cookie)throw fail(401);const [payload,signature]=cookie.slice(7).split('.');if(!payload||!signature||!same(sign(payload),signature))throw fail(401);
    let value;try{value=JSON.parse(Buffer.from(payload,'base64url'));}catch{throw fail(401);}
    if(!Number.isFinite(value.exp)||value.exp<=now())throw fail(401);return value;
  }
  async function body(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>2048)throw fail(413);parts.push(part);}try{return JSON.parse(Buffer.concat(parts));}catch{throw fail(400);}}
  const cookie=value=>'deckel='+value+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(value?'900':'0')+(secure?'; Secure':'');
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    function json(status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
    try{
      const route=req.url.split('?')[0];
      if(req.method==='GET'&&route==='/health')return json(200,{status:'ok',configured});
      if(req.method==='GET'&&route==='/bierfass.webp'){res.setHeader('Content-Type','image/webp');return res.end(fs.readFileSync(path.join(__dirname,'../assets/drinks/bierfass.webp')));}
      const assets={'/':'index.html','/portal.js':'portal.js','/portal.css':'portal.css'};
      if(req.method==='GET'&&assets[route]){res.setHeader('Content-Type',route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(fs.readFileSync(path.join(__dirname,'public',assets[route])));}
      if(req.method==='POST'){
        const origin=env.PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL;
        if(!origin||req.headers.origin!==origin)throw fail(403);
        if(req.headers['content-type']?.split(';')[0]!=='application/json')throw fail(415);
      }
      if(req.method==='POST'&&route==='/api/logout'){res.setHeader('Set-Cookie',cookie(''));return json(200,{ok:true});}
      if(!configured)throw fail(503);
      if(req.method==='POST'&&route==='/api/login'){
        const input=await body(req);
        if(typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token)||typeof input.id!=='string'||input.id.length>150||!/^\d{4}$/.test(input.pin))throw fail(401);
        const suffix=hash(input.id)+'.json',access=await read('zugang-'+suffix);
        if(!same(access.tokenHash,hash(input.token)))throw fail(401);
        rate(access.tokenHash);
        const result=await account(input.id,access.revision);
        if(!await M.verifyPin(input.pin,result.data.pin))throw fail(401);
        const payload=Buffer.from(JSON.stringify({id:input.id,revision:access.revision,pin:hash(JSON.stringify(result.data.pin)),exp:now()+15*60000})).toString('base64url');
        res.setHeader('Set-Cookie',cookie(payload+'.'+sign(payload)));return json(200,{ok:true});
      }
      if(req.method==='GET'&&route==='/api/me'){
        const auth=session(req),{data}=await account(auth.id,auth.revision);
        if(!same(auth.pin,hash(JSON.stringify(data.pin))))throw fail(401);
        const policy=M.validateRewardSettings(await read('bonus-einstellungen.json'));
        const totals=M.totals(data),reward=M.rewardState(data,policy);
        return json(200,{balance:totals.balance,credit:reward.credit,bonus:{needed:reward.needed,cents:policy.cents},bookings:data.bookings.slice(-5).reverse().map(b=>({type:b.type,cents:b.cents,count:b.count,method:b.method,createdAt:b.createdAt})),updatedAt:new Date(now()).toISOString()});
      }
      throw fail(404);
    }catch(error){const status=error.status||503;json(status,{error:status===429?'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.':status===401?'Link oder PIN ungültig. Bitte erneut anmelden.':status===503?'Dein Konto konnte gerade nicht geladen werden. Bitte später erneut versuchen.':'Zugriff nicht möglich.'});}
  });
}
if(require.main===module){const server=createServer();server.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Mein Deckel gestartet.'));}
module.exports={createServer,graphReader,hash};
