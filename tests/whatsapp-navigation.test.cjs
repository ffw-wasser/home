const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
class Node {
 constructor(){this.hidden=false;this.disabled=false;this.href='';this.textContent='';this.value='';this.events={};}
 addEventListener(name,fn){this.events[name]=fn;}
 querySelectorAll(){return [];}
 removeAttribute(name){delete this[name];}
 setAttribute(name,value){this[name]=value;}
}
const elements=html=>Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new Node()]));
test('WhatsApp-Verbindung: die H2O-App bleibt offen und kann privaten Link nur kopieren',async()=>{
 const html=read('deckel.html'),dom=elements(html),copied=[];
 assert.match(html,/Benachrichtigungen & WhatsApp/);
 assert.doesNotMatch(html,/id="portal-browser-open"/,'kein Link, der die installierte App verlässt');
 const link='https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/test&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64);
 const apiCalls=[];
 const c=vm.createContext({
   console,URL,AbortSignal,location:{href:link,hash:link.split('#')[1],search:''},
   document:{hidden:false,readyState:'complete',getElementById:id=>dom[id],addEventListener(){}},
   navigator:{clipboard:{writeText:async value=>copied.push(value)}},
   DeckelDevice:{read:async()=>null,readLink:async()=>null},
   H2OPortal:{api:async path=>{apiCalls.push(path);return {code:'B'.repeat(24),expiresAt:Date.now()+300000};}},
   fetch:async()=>({ok:true,json:async()=>({browserPairVersion:1})})
 });
 vm.runInContext(read('js/features/drinks/deckel-push.js'),c);
 await c.DeckelPush.render({alias:'a'.repeat(32),revision:'revision-test',origin:'https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev'});
 await dom['portal-browser-start'].onclick();
 assert.deepEqual(apiCalls,['browser/start']);
 assert.equal(dom['portal-browser-link-box'].hidden,false);
 await dom['portal-browser-copy'].onclick();
 assert.equal(copied.length,1);
 assert.equal(copied[0],'https://ffw-wasser.github.io/home/termin.html#pair='+'b'.repeat(24));
 assert.ok(!copied[0].includes('ffw-wasser/test')&&!copied[0].includes('&k='));
});
function responseContext({standalone=false,from='',historyLength=1,savedURL=null}={}){
 const dom=elements(read('termin.html')),assigned=[],back=[];
 const location={href:'https://ffw-wasser.github.io/home/termin.html',origin:'https://ffw-wasser.github.io',pathname:'/home/termin.html',search:'',hash:'',assign:url=>assigned.push(url)};
 const history={length:historyLength,replaceState(){},back:()=>back.push(true)};
 const c=vm.createContext({
  console,URL,URLSearchParams,Intl,Date,location,history,
  navigator:{standalone},
  document:{referrer:from,getElementById:id=>dom[id],createElement:()=>new Node()},
  matchMedia:()=>({matches:standalone}),localStorage:{getItem:()=>null,removeItem(){}},
  DeckelDevice:{read:async()=>savedURL?{url:savedURL}:null,readLink:async()=>null},
  confirm:()=>true,
  crypto:{randomUUID:()=> 'request-test-id'},
  setTimeout:()=>1,clearTimeout(){}
 });
 vm.runInContext(read('js/features/portal/portal-whatsapp.js'),c);
 return {dom,assigned,back};
}
test('Zurück: installierte H2O-App wird nur mit gespeichertem privaten Link geöffnet',async()=>{
 const personal='https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/test&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64);
 const run=responseContext({standalone:true,savedURL:personal});
 await run.dom['back-to-h2o'].events.click();
 assert.deepEqual(run.assigned,[personal]);assert.equal(run.back.length,0);
});
test('Zurück: gültige Verlaufshistorie funktioniert; sonst erfolgt keine QR-Umleitung',async()=>{
 const from=responseContext({from:'https://ffw-wasser.github.io/home/deckel.html',historyLength:3});
 await from.dom['back-to-h2o'].events.click();
 assert.equal(from.back.length,1);
 const unknown=responseContext({});
 await unknown.dom['back-to-h2o'].events.click();
 assert.equal(unknown.assigned.length,0);
 assert.equal(unknown.back.length,0);
 assert.match(unknown.dom['back-to-h2o-status'].textContent,/Home-Bildschirm/);
});
