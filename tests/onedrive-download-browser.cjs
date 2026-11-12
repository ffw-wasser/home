// Browser CORS redirect failure with synthetic Microsoft responses, no real account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),http=require('node:http');
(async()=>{
 const browser=await (process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});
 try{
  for(const signedHost of ['synthetic.files.1drv.com','my.microsoftpersonalcontent.com'])for(const projected of [true,false]){
  const page=await browser.newPage(),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const graph='https://graph.microsoft.com/v1.0/drives/synthetic/items/state',signed='https://'+signedHost+'/download?temporary=synthetic';
  const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'authorization,if-match'};
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());requests.push({url:u.href,method:req.method(),headers:req.headers()});
   if(u.origin==='https://ffw-wasser.github.io'){
    if(u.pathname.endsWith('/onedrive-sync.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.resolve(__dirname,'../js/core/onedrive-sync.js'),'utf8')});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><script src="/home/js/core/onedrive-sync.js"></script>'});
   }
   if(u.origin==='https://graph.microsoft.com'){
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    assert.equal(req.headers().authorization,'Bearer synthetic-token');
    // Simulate the browser rejecting the preflighted Graph /content redirect.
    if(u.pathname.endsWith('/content'))return route.abort('failed');
    return route.fulfill({contentType:'application/json',headers:cors,body:JSON.stringify(projected&&u.search?{id:'state',eTag:'v1'}:{id:'state',eTag:'v1',file:{},'@microsoft.graph.downloadUrl':signed})});
   }
   if(u.href===signed){
    assert.equal(req.method(),'GET');for(const key of ['authorization','if-match','cookie'])assert.equal(req.headers()[key],undefined,key+' must not reach download host');
    return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({members:[],entries:[],synthetic:true})});
   }
   return route.abort();
  });
  await page.goto('https://ffw-wasser.github.io/home/download-test.html');
  const data=await page.evaluate(async address=>{oneDriveAccessToken=async()=> 'synthetic-token';return (await odFetch(address+'/content',{headers:{'If-Match':'v1'}})).json();},graph);
  assert.equal(data.synthetic,true);assert.deepEqual(errors,[]);
  assert.equal(requests.filter(r=>r.url===signed).length,1);
  assert.equal(requests.filter(r=>r.url.startsWith(graph+'?')&&r.method==='GET').length,2);
  assert.equal(await page.evaluate(()=>localStorage.length),0,'signed URLs and credentials are not persisted');
  await page.close();
  }
  // Redirect requests are not re-intercepted by Playwright routes. Use real
  // loopback servers so native fetch and CORS process every redirect hop.
  const calls=[],servers=[];
  const serve=handler=>new Promise(resolve=>{const server=http.createServer(handler);server.listen(0,'127.0.0.1',()=>{servers.push(server);resolve('http://127.0.0.1:'+server.address().port);});});
  try{
   const finalOrigin=await serve((req,res)=>{calls.push({hop:'final',headers:req.headers});res.writeHead(200,{'access-control-allow-origin':'*','content-type':'application/json'});res.end(JSON.stringify({synthetic:true}));});
   const downloadOrigin=await serve((req,res)=>{calls.push({hop:'redirect',headers:req.headers});res.writeHead(302,{'access-control-allow-origin':'*',location:finalOrigin+'/blob?temporary=synthetic'});res.end();});
   const appOrigin=await serve((req,res)=>{if(req.url==='/sync.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(fs.readFileSync(path.resolve(__dirname,'../js/core/onedrive-sync.js'),'utf8'));}else{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><script src="/sync.js"></script>');}});
   for(const policy of ['error','follow']){
    calls.length=0;const page=await browser.newPage();page.setDefaultTimeout(10000);
    const graph='https://graph.microsoft.com/v1.0/drives/synthetic/items/state';
    await page.route('https://graph.microsoft.com/**',async route=>{
     if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'authorization,if-match'}});
     if(new URL(route.request().url()).pathname.endsWith('/content'))return route.abort('failed');
     return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({id:'state',eTag:'v1','@microsoft.graph.downloadUrl':downloadOrigin+'/download?temporary=synthetic'})});
    });
    await page.context().addCookies([{name:"synthetic-cookie",value:"must-not-forward",url:downloadOrigin}]);
    await page.goto(appOrigin);
    const result=await page.evaluate(async ({origins,graph,policy})=>{
     // Only these known loopback fixture origins bypass the production host
     // allowlist. Microsoft host/HTTPS rules remain covered above and in units.
     const validate=odValidateDownloadUrl;odValidateDownloadUrl=u=>origins.includes(u.origin)?u:validate(u);
     oneDriveAccessToken=async()=> 'synthetic-token';
     if(policy==='error'){const original=fetch;globalThis.fetch=(url,options)=>original(url,origins.some(origin=>String(url).startsWith(origin+'/'))?{...options,redirect:'error'}:options);}
     try{return {data:await (await odFetch(graph+'/content',{headers:{'If-Match':'v1'}})).json()};}catch(error){return {error:error.name};}
    },{origins:[downloadOrigin,finalOrigin],graph,policy});
    if(policy==='error'){assert.equal(result.error,'TypeError');assert.deepEqual(calls.map(c=>c.hop),['redirect']);}
    else{assert.equal(result.data.synthetic,true);assert.deepEqual(calls.map(c=>c.hop),['redirect','final']);}
    for(const call of calls)for(const key of ['authorization','if-match','cookie','referer'])assert.equal(call.headers[key],undefined,key+' must not reach '+call.hop);
    await page.close();
   }
  }finally{for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
  console.log('PASS browser download fallback including omitted projection annotations: failed Graph content redirect, authenticated metadata, simple signed GET, no credential forwarding, before/after version protection.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
