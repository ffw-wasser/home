const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
const personal='https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/deckel-daten&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64);
function fixture({ios=false,android=false,standalone=false,url=personal,storageFails=false}={}){
 const nodes={},events={},saved=[],actions=[];
 const node=()=>({hidden:false,disabled:false,textContent:'',children:[],replaceChildren(){this.children=[];},append(n){this.children.push(n);}});
 const u=new URL(url),ctx=vm.createContext({URL,URLSearchParams,Promise,location:{href:u.href,hash:u.hash},navigator:{userAgent:ios?'iPhone':android?'Android':'Chrome',platform:'',standalone,serviceWorker:{register:async file=>actions.push(['register',file])}},matchMedia:()=>({matches:false}),
 document:{getElementById:id=>nodes[id]||(nodes[id]=node()),createElement:node},addEventListener:(name,fn)=>events[name]=fn,
 DeckelDevice:{saveLink:async link=>{actions.push(['save',link]);if(storageFails)throw Error('blocked');saved.push(link);}}});ctx.window=ctx;
 vm.runInContext(read('js/features/drinks/deckel-install.js'),ctx);return {ctx,nodes,events,saved,actions};
}
test('Erster QR-Aufruf zeigt Installation ohne selbstständig zu installieren, zu speichern oder Push zu erlauben',()=>{
 const f=fixture({android:true});assert.equal(f.nodes.installSection.hidden,false);assert.equal(f.nodes.deckelManifest.href,'deckel-android.webmanifest');assert.equal(f.saved.length,0);
 let prompts=0,prevented=0;f.events.beforeinstallprompt({preventDefault:()=>prevented++,prompt:()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(prevented,1);assert.equal(prompts,0);assert.equal(f.nodes.installButton.textContent,'Deckel installieren');
});
test('Android-Klick speichert privaten Zugang lokal vor dem bestätigten Installationsdialog; Abbruch bietet Anleitung',async()=>{
 for(const outcome of ['accepted','dismissed']){
  const f=fixture({android:true});f.events.beforeinstallprompt({preventDefault(){},prompt:async()=>f.actions.push(['prompt']),userChoice:Promise.resolve({outcome})});
  await f.nodes.installButton.onclick();assert.deepEqual(f.saved,[personal]);assert.equal(f.actions[1][0],'save');assert.equal(f.actions[2][0],'prompt');
  assert.match(f.nodes.installStatus.textContent,outcome==='accepted'?/bestätigt/:/später/);
 }
 const f=fixture({android:true});await f.nodes.installButton.onclick();assert.match(f.nodes.installStatus.textContent,/Browser-Menü/);assert.deepEqual(f.saved,[personal]);
});
test('iPhone bekommt Home-Bildschirm-Anleitung; installierte App und ungültiger Link zeigen keine Aufforderung',()=>{
 const f=fixture({ios:true});assert.equal(f.nodes.installButton.hidden,true);assert.match(f.nodes.installSteps.children[1].textContent,/Home-Bildschirm/);assert.equal(f.saved.length,0);
 assert.equal(fixture({ios:true,standalone:true}).nodes.installSection.hidden,true);
 assert.equal(fixture({url:'https://ffw-wasser.github.io/home/deckel.html'}).nodes.installSection.hidden,true);
});
test('Abgelehnter Gerätespeicher öffnet keinen Installationsdialog; native Installation speichert nur nach Nutzeraktion',async()=>{
 const f=fixture({android:true,storageFails:true});let prompts=0;f.events.beforeinstallprompt({preventDefault(){},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
 await f.nodes.installButton.onclick();assert.equal(prompts,0);assert.equal(f.saved.length,0);assert.match(f.nodes.installStatus.textContent,/Gerätespeicher/);
 const g=fixture({android:true});g.events.appinstalled();await Promise.resolve();assert.deepEqual(g.saved,[personal]);assert.equal(g.nodes.installSection.hidden,true);
});
test('App-Manifeste und Icons enthalten keine persönlichen Zugänge; Android hat stabilen Start und iOS behält QR-Adresse',()=>{
 const ios=JSON.parse(read('deckel.webmanifest')),android=JSON.parse(read('deckel-android.webmanifest'));
 assert.equal(ios.start_url,undefined);assert.equal(android.start_url,'./deckel.html');
 for(const manifest of [ios,android]){
  assert.equal(manifest.short_name,'Mein Deckel');assert.equal(manifest.display,'standalone');assert.ok(!JSON.stringify(manifest).includes('&k='));assert.ok(!JSON.stringify(manifest).includes('a'.repeat(32)));for(const key of ['id','start_url','scope'])if(manifest[key])assert.equal(new URL(manifest[key],personal).hash,'');
  for(const icon of manifest.icons){const data=fs.readFileSync(require.resolve('../'+icon.src));assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
 }
 assert.match(read('deckel.html'),/apple-touch-icon[^>]+deckel-icon-180\.png/);
});
test('Lokaler Installationslink bleibt erhalten wenn Push deaktiviert wird; fremde Adressen werden abgewiesen',async()=>{
 const state=new Map(),writes=[],ctx=vm.createContext({URL,URLSearchParams,Promise,location:{href:personal},indexedDB:{open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){const tx={objectStore:()=>({get(key){return perform(()=>state.get(key));},put(value,key){return perform(()=>{writes.push(key);state.set(key,value);});},delete(key){return perform(()=>state.delete(key));}})};function perform(fn){const request={};queueMicrotask(()=>{request.result=fn();request.onsuccess();tx.oncomplete();});return request;}return tx;}};req.onsuccess();});return req;}}});
 vm.runInContext(read('js/features/drinks/push-device.js'),ctx);const D=ctx.DeckelDevice;
 await D.saveLink(personal);await D.write({url:personal,capability:'fixture'});await D.clear();assert.equal(await D.read(),null);assert.equal(await D.readLink(),personal);assert.deepEqual(writes,['link','device']);
 assert.throws(()=>D.saveLink('https://evil.invalid/deckel.html'+new URL(personal).hash),/Ungültiger/);
});
