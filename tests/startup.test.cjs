const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function fixture(){
 const events={},frames=[],classes=new Set(['app-starting']);let timer,cancelled=false,removed=false,clicks=0;
 const nodes={appStartupStatus:{},appStartupProgress:{dataset:{}},appStartupRetry:{hidden:true},appStartupConnect:{hidden:true},cloudSyncButton:{click(){clicks++;}},protectedAppContent:{setAttribute(){},removeAttribute(name){this.removed=name;}},appStartup:{hidden:false}};
 const c=vm.createContext({window:{addEventListener(type,handler){events[type]=handler;}},document:{getElementById:id=>nodes[id],documentElement:{classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}}},setTimeout(fn){timer=fn;return 1;},clearTimeout(){cancelled=true;},requestAnimationFrame:fn=>frames.push(fn),location:{reload(){}}});
 vm.runInContext(html.match(/<script id="app-startup-script">([\s\S]*?)<\/script>/)[1],c);
 return {update:state=>c.window.AppStartup.update(state),get clicks(){return clicks;},events,nodes,classes,frames,timeout:()=>timer(),get removed(){return nodes.appStartup.hidden;},get cancelled(){return cancelled;},paint(){while(frames.length)frames.shift()();}};
}
test('Startansicht bleibt bis Laden und Layout abgeschlossen sind',()=>{
 const f=fixture();assert.equal(f.removed,false);f.events.load();assert.equal(f.removed,false);f.paint();assert.equal(f.removed,false);f.update({ready:true});assert.equal(f.removed,true);assert.equal(f.classes.has('app-starting'),false);assert.equal(f.cancelled,true);assert.equal(f.nodes.protectedAppContent.removed,'aria-busy');
});
test('Langsames Laden bietet Wiederholung und gibt die später fertige App frei',()=>{
 const f=fixture();f.timeout();assert.equal(f.nodes.appStartupRetry.hidden,false);assert.equal(f.removed,false);f.events.load();f.paint();assert.equal(f.removed,false);f.update({ready:true});assert.equal(f.removed,true);
});
test('Fehlende App-Datei gibt keine unvollständige Oberfläche frei',()=>{
 const f=fixture();f.events.error({target:{tagName:'SCRIPT'}});f.events.load();f.paint();assert.equal(f.removed,false);assert.equal(f.nodes.appStartupRetry.hidden,false);
});
test('Fehlendes Vorschaubild blockiert die Anwendung nicht',()=>{
 const f=fixture();f.events.error({target:{tagName:'LINK',rel:'preload'}});f.events.load();f.paint();assert.equal(f.removed,false);f.update({ready:true});assert.equal(f.removed,true);
});


test('Dateien geladen, aber OneDrive noch nicht synchronisiert: Wappen bleibt',()=>{
 const f=fixture();f.events.load();f.paint();assert.equal(f.removed,false);f.update({ready:false,signed:true,busy:true});assert.match(f.nodes.appStartupStatus.textContent,/synchronisiert/);assert.equal(f.classes.has('app-starting'),true);
});
test('Frühe Synchronisation wartet auf alle Programmdateien',()=>{
 const f=fixture();f.update({ready:true});assert.equal(f.removed,false);f.events.load();f.paint();assert.equal(f.removed,true);
});
test('Fehler und fehlende Anmeldung behalten den erreichbaren OneDrive-Zugang',()=>{
 const f=fixture();f.events.load();f.paint();f.update({ready:false,signed:false});assert.match(f.nodes.appStartupStatus.textContent,/verbinden/);assert.equal(f.nodes.appStartupConnect.hidden,false);f.nodes.appStartupConnect.onclick();assert.equal(f.clicks,1);f.update({ready:false,error:true});assert.match(f.nodes.appStartupStatus.textContent,/erneut versuchen/);assert.equal(f.removed,false);
});
test('Abmeldung sperrt eine zuvor freigegebene Oberfläche wieder',()=>{
 const f=fixture();f.events.load();f.paint();f.update({ready:true});assert.equal(f.removed,true);f.update({ready:false});assert.equal(f.removed,false);assert.equal(f.classes.has('app-starting'),true);
});

test('Ladebalken zeigt Aktivität mit aktuellem Schritt und stoppt bei Fehler oder Offline',()=>{
 const f=fixture();f.events.load();f.paint();
 for(const stage of ['OneDrive-Anmeldung wird geprüft …','Gemeinsame Daten werden synchronisiert …','Berichte und Historie werden geladen …']){
  f.update({ready:false,signed:true,busy:true,stage});assert.equal(f.nodes.appStartupStatus.textContent,stage);assert.equal(f.nodes.appStartupProgress.dataset.active,'true');assert.equal(f.removed,false);
 }
 f.update({ready:false,signed:true,error:true});assert.equal(f.nodes.appStartupProgress.dataset.active,'false');assert.match(f.nodes.appStartupStatus.textContent,/erneut versuchen/);
 f.update({ready:false,signed:true,offline:true});assert.match(f.nodes.appStartupStatus.textContent,/Internetverbindung/);assert.equal(f.nodes.appStartupProgress.dataset.active,'false');
 f.update({ready:false,signed:true,needsLogin:true});assert.match(f.nodes.appStartupStatus.textContent,/Anmeldung bestätigen/);
});
