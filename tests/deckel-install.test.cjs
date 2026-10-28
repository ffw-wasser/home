const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
const personal='https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/deckel-daten&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64);
function fixture({ios=false,android=false,standalone=false,url=personal,storageFails=false,native=false,session=false}={}){
 const nodes={},events={},saved=[],actions=[];
 const node=()=>({hidden:false,disabled:false,textContent:'',children:[],replaceChildren(){this.children=[];},append(n){this.children.push(n);}});
 const u=new URL(url),ctx=vm.createContext({URL,URLSearchParams,Promise,location:{href:u.href,hash:u.hash},navigator:{userAgent:native?'iPhone H2ONative/1 iOS':ios?'iPhone':android?'Android':'Chrome',platform:'',standalone,serviceWorker:{register:async file=>actions.push(['register',file])}},matchMedia:()=>({matches:false}),
 document:{getElementById:id=>nodes[id]||(nodes[id]=node()),createElement:node},addEventListener:(name,fn)=>events[name]=fn,
 H2OIdentity:{session:()=>session?{token:'synthetic-session',alias:'a'.repeat(32)}:null},DeckelDevice:{saveLink:async link=>{actions.push(['save',link]);if(storageFails)throw Error('blocked');saved.push(link);}}});ctx.window=ctx;
 vm.runInContext(read('js/features/drinks/deckel-install.js'),ctx);return {ctx,nodes,events,saved,actions};
}
test('Geräte- und Browsererkennung unterscheidet Safari, Samsung, Chrome und eingebettete Ansichten',()=>{
 const f=fixture();
 for(const [ua,platform,browser,embedded] of [
  ['Mozilla/5.0 (iPhone) Version/26.0 Mobile Safari/604.1','ios','Safari',false],
  ['Mozilla/5.0 (Linux; Android 15) Chrome/140 SamsungBrowser/29.0 Safari/537.36','android','Samsung Internet',false],
  ['Mozilla/5.0 (Linux; Android 15; wv) Chrome/140 Safari/537.36','android','Chrome',true],
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/140 Safari/537.36 Edg/140','desktop','Edge',false]
 ]){f.ctx.navigator.userAgent=ua;const p=f.ctx.DeckelInstall.profile();assert.equal(p.platform,platform);assert.equal(p.browser,browser);assert.equal(p.embedded,embedded);}
});
test('iPhone-Home-App ohne Safari-Kennung ist kein eingebetteter Browser',()=>{
 const f=fixture({ios:true,standalone:true});f.ctx.navigator.userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
 const p=f.ctx.DeckelInstall.profile();assert.equal(p.browser,'Safari');assert.equal(p.embedded,false);assert.equal(f.ctx.DeckelInstall.isStandalone(),true);
 f.ctx.navigator.standalone=false;assert.equal(f.ctx.DeckelInstall.profile().embedded,true,'the same UA in a real embedded view still needs the browser handoff');
});
test('Erster QR-Aufruf zeigt Installation ohne selbstständig zu installieren, zu speichern oder Push zu erlauben',()=>{
 const f=fixture({android:true});assert.equal(f.nodes.installSection.hidden,false);assert.equal(f.nodes.deckelManifest,undefined);assert.equal(f.saved.length,0);
 let prompts=0,prevented=0;f.events.beforeinstallprompt({preventDefault:()=>prevented++,prompt:()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(prevented,1);assert.equal(prompts,0);assert.equal(f.nodes.installButton.textContent,'H₂O Portal installieren');
});
test('Android installiert nur nach Antippen und verwendet ohne Browserunterstützung die Menü-Anleitung',async()=>{
 for(const outcome of ['accepted','dismissed']){
  const f=fixture({android:true});let prompts=0;
  f.events.beforeinstallprompt({preventDefault(){},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome})});
  await f.nodes.installButton.onclick();
  assert.deepEqual(f.saved,[personal]);
  assert.equal(prompts,1);
  assert.match(f.nodes.installStatus.textContent,outcome==='accepted'?/bestätigt/:/später/);
 }
 const f=fixture({android:true});await f.nodes.installButton.onclick();
 assert.match(f.nodes.installStatus.textContent,/Chrome/);
 assert.deepEqual(f.saved,[personal]);
});
test('iPhone bekommt freiwillige Anleitung auch vor Anmeldung; installierter Start zeigt keine Aufforderung',()=>{
 const f=fixture({ios:true});assert.equal(f.nodes.installButton.hidden,true);assert.match(f.nodes.installSteps.children[1].textContent,/Home-Bildschirm/);assert.equal(f.saved.length,0);
 assert.equal(f.nodes.installSteps.children.length,3);assert.ok(f.nodes.installSteps.children.every(item=>!item.hidden),'all Safari actions remain visible before opening the system share menu');assert.equal(f.nodes.installBack.hidden,true);assert.equal(f.nodes.installNext.hidden,true);assert.equal(f.nodes.installProgress.hidden,true);assert.equal(f.ctx.DeckelInstall.currentStep().systemGuide,true);
 assert.equal(fixture({ios:true,standalone:true}).nodes.installSection.hidden,true);
 const publicEntry=fixture({url:'https://ffw-wasser.github.io/home/deckel.html'});assert.equal(publicEntry.nodes.installSection.hidden,false);assert.equal(publicEntry.nodes.installButton.hidden,true);assert.equal(publicEntry.saved.length,0);
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
  assert.equal(manifest.short_name,'H₂O Portal');assert.equal(manifest.display,'standalone');assert.ok(!JSON.stringify(manifest).includes('&k='));assert.ok(!JSON.stringify(manifest).includes('a'.repeat(32)));for(const key of ['id','start_url','scope'])if(manifest[key])assert.equal(new URL(manifest[key],personal).hash,'');
  for(const icon of manifest.icons){const data=fs.readFileSync(require.resolve('../'+icon.src.split('?')[0]));assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
  assert.ok(manifest.icons.some(icon=>icon.src.split('?')[0]==='assets/drinks/h2o-symbol-blue-192.png'));
 }
 assert.match(read('deckel.html'),/apple-touch-icon[^>]+h2o-symbol-blue-180\.png/);
});
test('Lokaler Installationslink bleibt erhalten wenn Push deaktiviert wird; fremde Adressen werden abgewiesen',async()=>{
 const state=new Map(),writes=[],ctx=vm.createContext({URL,URLSearchParams,Promise,location:{href:personal},indexedDB:{open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){const tx={objectStore:()=>({get(key){return perform(()=>state.get(key));},put(value,key){return perform(()=>{writes.push(key);state.set(key,value);});},delete(key){return perform(()=>state.delete(key));}})};function perform(fn){const request={};queueMicrotask(()=>{request.result=fn();request.onsuccess();tx.oncomplete();});return request;}return tx;}};req.onsuccess();});return req;}}});
 vm.runInContext(read('js/features/drinks/push-device.js'),ctx);const D=ctx.DeckelDevice;
 await D.saveLink(personal);await D.write({url:personal,capability:'fixture'});await D.clear();assert.equal(await D.read(),null);assert.equal(await D.readLink(),personal);assert.deepEqual(writes,['link','device']);
 assert.throws(()=>D.saveLink('https://evil.invalid/deckel.html'+new URL(personal).hash),/Ungültiger/);
});

test('Portalstart verändert vorhandene Push-Anmeldung nicht ohne Benutzeraktion',async()=>{
 const url=personal+'&p=https%3A%2F%2Ftest.account.workers.dev&c='+ 'x'.repeat(43),nodes={},events=[],state={saved:{url,alias:'a'.repeat(32),origin:'https://test.account.workers.dev',capability:'x'.repeat(43),endpoint:'https://push.fixture/device',registered:true},link:null};
 const node=()=>({hidden:false,disabled:false,textContent:'',setAttribute(){}}),c=vm.createContext({URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location:{hash:new URL(url).hash,href:url},document:{hidden:false,addEventListener(){},getElementById:id=>nodes[id]||(nodes[id]=node())},addEventListener(){},navigator:{userAgent:'Android',platform:'',serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>({unsubscribe:async()=>{events.push('unsubscribe');return true;}})}})}},matchMedia:()=>({matches:true}),Notification:{permission:'granted'},PushManager:{},DeckelDevice:{read:async()=>state.saved,saveLink:async value=>{events.push('saveLink');state.link=value;},clear:async()=>{events.push('clear');state.saved=null;}},fetch:async()=>({ok:true,json:async()=>({})})});c.window=c;
 vm.runInContext(read('js/features/drinks/deckel-push.js'),c);assert.ok(state.saved);assert.equal(state.link,null);assert.deepEqual(events,[]);assert.equal(nodes.pushEnable,undefined);
});

test('Android lädt das stabile Manifest, iOS und Desktop behalten das vorhandene',()=>{
 const html=read('deckel.html'),script=read('js/features/drinks/deckel-manifest.js');
 assert.match(html,/src="js\/features\/drinks\/deckel-manifest\.js/);
 assert.doesNotMatch(html,/<link[^>]+rel="manifest"/);
 const run=ua=>{const links=[],ctx={navigator:{userAgent:ua},document:{head:{appendChild:link=>links.push(link)},createElement:()=>({})}};vm.runInNewContext(script,ctx);return links;};
 assert.match(run('Android Chrome')[0].href,/deckel-android\.webmanifest/);
 assert.equal(run('iPhone Safari')[0].rel,'manifest');
 assert.match(run('Desktop Chrome')[0].href,/deckel\.webmanifest/);
});

test('Native App zeigt keinen zweiten Home-Bildschirm-Installationsschritt',()=>{
 const f=fixture({native:true});assert.equal(f.nodes.installSection.hidden,true);assert.equal(f.actions.length,0);assert.equal(f.saved.length,0);
});

test('Persönliche Anmeldung braucht zum Startsymbol keinen alten Link oder zusätzlichen Gerätespeicher',async()=>{
 const f=fixture({android:true,session:true,storageFails:true,url:'https://ffw-wasser.github.io/home/deckel.html'});
 assert.equal(f.nodes.installButton.hidden,true,'no redundant instruction button without native installation dialog');assert.equal(f.nodes.installButton.textContent,'Anleitung zum Startsymbol');
 await f.nodes.installButton.onclick();assert.deepEqual(f.saved,[]);assert.deepEqual(f.actions.filter(a=>a[0]==='save'),[]);
 assert.match(f.nodes.installStatus.textContent,/in diesem Browser angemeldet/);assert.doesNotMatch(f.nodes.installStatus.textContent,/gespeichert|Gerätespeicher/);
 f.events.appinstalled();await Promise.resolve();assert.equal(f.nodes.installSection.hidden,true);assert.deepEqual(f.saved,[]);
});
test('Noch installierte TestFlight-App erhält Browser-Umstiegshinweis ohne automatische Übertragung',()=>{
 const f=fixture({native:true,session:true});assert.equal(f.nodes.nativeRetired.hidden,false);assert.equal(f.nodes.installSection.hidden,true);assert.deepEqual(f.saved,[]);
});
