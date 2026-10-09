const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function fixture(){
 const events={},frames=[],classes=new Set(['app-starting']);let timer,cancelled=false,removed=false;
 const nodes={appStartupStatus:{},appStartupRetry:{hidden:true},protectedAppContent:{removeAttribute(name){this.removed=name;}},appStartup:{remove(){removed=true;}}};
 const c=vm.createContext({window:{addEventListener(type,handler){events[type]=handler;}},document:{getElementById:id=>nodes[id],documentElement:{classList:{remove:name=>classes.delete(name)}}},setTimeout(fn){timer=fn;return 1;},clearTimeout(){cancelled=true;},requestAnimationFrame:fn=>frames.push(fn),location:{reload(){}}});
 vm.runInContext(html.match(/<script id="app-startup-script">([\s\S]*?)<\/script>/)[1],c);
 return {events,nodes,classes,frames,timeout:()=>timer(),get removed(){return removed;},get cancelled(){return cancelled;},paint(){while(frames.length)frames.shift()();}};
}
test('Startansicht bleibt bis Laden und Layout abgeschlossen sind',()=>{
 const f=fixture();assert.equal(f.removed,false);f.events.load();assert.equal(f.removed,false);f.paint();assert.equal(f.removed,true);assert.equal(f.classes.has('app-starting'),false);assert.equal(f.cancelled,true);assert.equal(f.nodes.protectedAppContent.removed,'aria-busy');
});
test('Langsames Laden bietet Wiederholung und gibt die später fertige App frei',()=>{
 const f=fixture();f.timeout();assert.equal(f.nodes.appStartupRetry.hidden,false);assert.equal(f.removed,false);f.events.load();f.paint();assert.equal(f.removed,true);
});
test('Fehlende App-Datei gibt keine unvollständige Oberfläche frei',()=>{
 const f=fixture();f.events.error({target:{tagName:'SCRIPT'}});f.events.load();f.paint();assert.equal(f.removed,false);assert.equal(f.nodes.appStartupRetry.hidden,false);
});
test('Fehlendes Vorschaubild blockiert die Anwendung nicht',()=>{
 const f=fixture();f.events.error({target:{tagName:'LINK',rel:'preload'}});f.events.load();f.paint();assert.equal(f.removed,true);
});
