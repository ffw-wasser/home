const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('native/shared/ios-entry.js','utf8');
function fixture({url='https://ffw-wasser.github.io/home/deckel.html',frame=false,missing=false}={}){
 const messages=[],buttons=[];let hidden=false,signedIn=false;
 const setup={closest:()=>hidden?{}:null,append:b=>buttons.push(b)};
 const context={location:new URL(url),document:{getElementById:id=>id==='identity-setup'?(missing?null:setup):buttons.find(b=>b.id===id),createElement:()=>({addEventListener(name,fn){this.click=fn;}})}};
 context.window=context;context.top=frame?{}:context;
 context.H2OIdentity={session:()=>signedIn?{token:'synthetic-not-transmitted'}:null};
 context.webkit={messageHandlers:{h2oInvitation:{postMessage:m=>messages.push(m)}}};
 vm.createContext(context);const run=()=>vm.runInContext(source,context);run();
 return {messages,buttons,run,hide:v=>hidden=v,signIn:v=>signedIn=v};
}
test('iOS invitation action sends only a scan request after a real signed-out click',()=>{
 const f=fixture();assert.equal(f.buttons.length,1);
 f.buttons[0].click({isTrusted:false});assert.equal(f.messages.length,0);
 f.buttons[0].click({isTrusted:true});assert.deepEqual(f.messages,['scan']);
 f.signIn(true);f.buttons[0].click({isTrusted:true});assert.equal(f.messages.length,1);
 f.signIn(false);f.hide(true);f.buttons[0].click({isTrusted:true});assert.equal(f.messages.length,1);
 f.hide(false);f.buttons[0].click({isTrusted:true});assert.deepEqual(f.messages,['scan','scan']);
 f.run();assert.equal(f.buttons.length,1);
});
test('iOS scanner is not injected into other origins, paths, frames or missing setup views',()=>{
 for(const options of [{url:'https://evil.example/home/deckel.html'},{url:'https://ffw-wasser.github.io/home/index.html'},{url:'http://ffw-wasser.github.io/home/deckel.html'},{frame:true},{missing:true}])assert.equal(fixture(options).buttons.length,0);
 assert.equal(fixture({url:'https://ffw-wasser.github.io/home/termin.html'}).buttons.length,1);
});
