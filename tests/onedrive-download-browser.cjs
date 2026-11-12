// Browser CORS redirect failure with synthetic Microsoft responses, no real account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
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
  console.log('PASS browser download fallback including omitted projection annotations: failed Graph content redirect, authenticated metadata, simple signed GET, no credential forwarding, before/after version protection.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
