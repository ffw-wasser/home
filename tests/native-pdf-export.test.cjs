const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('native/shared/pdf-export.js','utf8');
function fixture({url='https://ffw-wasser.github.io/home/deckel.html',frame=false,bridge=true,ios=false,type='application/pdf',data='%PDF-1.7\nsynthetic',failed=false}={}){
 const messages=[],alerts=[],fetches=[];let click;
 const location=new URL(url),context={URL,Blob,Response,AbortController,setTimeout,clearTimeout,location,alert:m=>alerts.push(m),document:{addEventListener:(name,fn)=>{click=fn;}},fetch:async(u,o)=>{fetches.push({url:u,options:o});return new Response(data,{status:failed?503:200,headers:{'content-type':type}});},FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:application/pdf;base64,'+Buffer.from(b).toString('base64');this.onload();});}}};
 context.window=context;context.top=frame?{}:context;
 if(bridge){if(ios)context.webkit={messageHandlers:{h2oPdf:{postMessage:value=>messages.push(value)}}};else context.H2OPdf={postMessage:value=>messages.push(JSON.parse(value))};}
 vm.createContext(context);vm.runInContext(source,context);
 async function send({href='blob:https://ffw-wasser.github.io/synthetic',name='Jahresplan-2026.pdf',trusted=true}={}){
  const anchor={href,download:name,setAttribute(){},removeAttribute(){}},event={isTrusted:trusted,button:0,target:{closest:()=>anchor},preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};
  if(click)await click(event);return event;
 }
 return {messages,alerts,fetches,send,installed:()=>Boolean(click)};
}
test('PDF wird nur nach Benutzerklick als begrenzte Nutzlast an Android/iOS übergeben',async()=>{
 for(const ios of [false,true]){const f=fixture({ios});assert.equal((await f.send()).prevented,true);assert.equal(f.messages.length,1);assert.equal(f.messages[0].name,'Jahresplan-2026.pdf');assert.equal(Buffer.from(f.messages[0].data,'base64').toString(),'%PDF-1.7\nsynthetic');assert.deepEqual(Object.keys(f.messages[0]).sort(),['data','mime','name']);assert.equal(f.fetches[0].options.credentials,'omit');}
});
test('Andere Ursprünge, Frames und programmatische Klicks bekommen keine Exportfreigabe',async()=>{
 for(const options of [{url:'https://evil.example/home/deckel.html'},{url:'https://ffw-wasser.github.io/home/index.html'},{frame:true},{bridge:false}])assert.equal(fixture(options).installed(),false);
 const f=fixture();await f.send({trusted:false});await f.send({href:'blob:https://evil.example/id'});await f.send({href:'https://ffw-wasser.github.io/private.pdf'});assert.equal((await f.send({name:'Feuerwehr-Termin.ics'})).prevented,undefined);assert.equal(f.messages.length,0);assert.equal(f.fetches.length,0);
});
test('HTML, ungültige PDF-Bytes, große Dateien und Lesefehler gelangen nicht in die native Freigabe',async()=>{
 for(const options of [{type:'text/html'},{data:'<html>not a PDF'},{data:new Uint8Array(10*1024*1024+1)},{failed:true}]){const f=fixture(options);await f.send();assert.equal(f.messages.length,0);assert.equal(f.alerts.length,1);}
});
test('Dateinamen werden vor der Übergabe begrenzt und können keine Dateipfade enthalten',async()=>{
 const f=fixture();await f.send({name:'../../geheim/plan.pdf'});assert.equal(f.messages.length,1);assert.doesNotMatch(f.messages[0].name,/[\\/]/);assert.match(f.messages[0].name,/^[A-Za-z0-9].*\.pdf$/);
});
