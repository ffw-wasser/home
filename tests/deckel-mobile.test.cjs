const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
class Node{constructor(tag='div'){this.tagName=tag.toUpperCase();this.hidden=false;this.disabled=false;this.value='';this.checked=false;this.dataset={};this.attributes={};this.children=[];this.textContent='';this.classList={add(){},remove(){},toggle(){}};}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}append(n){this.children.push(n);}replaceChildren(){this.children=[];}addEventListener(k,fn){this[k]=fn;}showModal(){this.open=true;}close(){this.open=false;}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}querySelectorAll(){return [];}getBoundingClientRect(){return {top:1000};}}
function nodes(){const result={};for(const [,id] of read('deckel.html').matchAll(/id="([^"]+)"/g))result[id]=new Node();return result;}
async function fixture(){const dom=nodes(),events={},requests=[],saved=new Map();let unavailable=false;const ctx=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,URL,URLSearchParams,AbortSignal,location:{hash:'#r=ffw-wasser/test&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64)},confirm:()=>true,setTimeout:()=>1,clearTimeout(){},addEventListener:(key,fn)=>events[key]=fn,document:{hidden:false,readyState:'loading',getElementById:id=>dom[id],createElement:tag=>new Node(tag),addEventListener:(key,fn)=>events[key]=fn},DeckelDevice:{readCommand:async alias=>saved.get(alias)||null,saveCommand:async(alias,job)=>saved.set(alias,job)},fetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push({url,body});if(unavailable)throw Error('Offline');return {ok:true,json:async()=>({status:url.endsWith('/commands/status')?'missing':'done'})};}});for(const name of ['deckel-commands','deckel-actions'])vm.runInContext(read('js/features/drinks/'+name+'.js'),ctx);events.DOMContentLoaded();const data={pointUnits:300,beerUnits:150,wineUnits:150,actions:{origin:'https://test.account.workers.dev',capability:'a'.repeat(43),revision:'revision-test-001',central:true,epoch:'0'}};await ctx.DeckelActions.render(data);return {ctx,dom,requests,saved,data,offline:value=>unavailable=value};}
const flush=()=>new Promise(r=>setImmediate(r));
test('Jedes neue Öffnen startet bei Termine, eine laufende Aktualisierung bleibt in der gewählten Ansicht',()=>{
 const dom=nodes(),history={state:{portalPage:'account'},replaceState(s){this.state=s;},pushState(s){this.state=s;}};
 const ctx=vm.createContext({history,innerWidth:390,innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);
 assert.equal(dom['portal-page-terms'].hidden,false);assert.equal(history.state.portalPage,'portal-section');
 ctx.DeckelMobile.jump('portal-evidence');ctx.DeckelMobile.show(true);
 assert.equal(dom['portal-page-evidence'].hidden,false,'Aktualisieren darf die Ansicht nicht wechseln');
 ctx.DeckelMobile.show(false);ctx.DeckelMobile.show(true);
 assert.equal(dom['portal-page-terms'].hidden,false);assert.equal(dom['portal-page-evidence'].hidden,true);
 assert.equal(history.state.portalPage,'portal-section');
});
test('Elz-Infoseite öffnet als Mehr-Unterseite und Browser-Zurück führt zur Kachelübersicht',()=>{
 const dom=nodes(),events={},history={state:{},replaceState(s){this.state=s;},pushState(s){this.state=s;}};
 const ctx=vm.createContext({history,innerWidth:390,innerHeight:844,addEventListener:(k,f)=>events[k]=f,document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);
 ctx.DeckelMobile.jump('deckel-more');ctx.DeckelMobile.jump('more-water');
 assert.equal(dom['portal-page-more-water'].hidden,false);assert.equal(dom['portal-page-more'].hidden,true);
 assert.equal(dom['portal-menu-title'].textContent,'Wasserentnahme Elz');assert.equal(history.state.portalPage,'more-water');
 assert.equal(dom['portal-page-more-water'].focused,true);assert.equal(dom['deckel-nav'].hidden,false);
 ctx.DeckelMobile.show(true);assert.equal(dom['portal-page-more-water'].hidden,false);
 events.popstate({state:{portalPage:'deckel-more'}});
 assert.equal(dom['portal-page-more'].hidden,false);assert.equal(dom['portal-page-more-water'].hidden,true);
 assert.equal(dom['portal-menu-title'].textContent,'Mehr');
});
test('Theater öffnet separat, blendet Portalnavigation aus und schließt erst nach Bestätigung',()=>{const dom=nodes(),history={state:{},replaceState(s){this.state=s;},pushState(s){this.state=s;}},events={};let accepted=false,asks=0;const ctx=vm.createContext({history,innerWidth:390,innerHeight:844,TheaterPhone:{beforeLeave:()=>{asks++;return accepted;}},addEventListener:(k,f)=>events[k]=f,document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);ctx.DeckelMobile.jump('deckel-more');ctx.DeckelMobile.jump('theater-phone-section');assert.equal(dom['portal-page-theater'].hidden,false);assert.equal(dom['portal-page-more'].hidden,true);assert.equal(dom['deckel-nav'].hidden,true);assert.equal(ctx.DeckelMobile.jump('deckel-more'),false);assert.equal(dom['portal-page-theater'].hidden,false);accepted=true;ctx.DeckelMobile.jump('deckel-more');assert.equal(asks,2);assert.equal(dom['portal-page-more'].hidden,false);assert.equal(dom['deckel-nav'].hidden,false);});
test('Wischen wechselt Menüs; Scrollen, Bedienelemente, Randgesten und Mehrfinger bleiben unberührt',()=>{
 const dom=nodes(),history={state:{},replaceState(s){this.state=s;},pushState(s){this.state=s;}},ctx=vm.createContext({history,innerWidth:390,innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);const main=dom['deckel-main'],base={pointerId:1,pointerType:'touch',isPrimary:true,clientX:250,clientY:200,timeStamp:0,target:{closest:()=>null}};
 function swipe(overrides={},end={}){main.pointerdown({...base,...overrides});main.pointerup({...base,clientX:100,timeStamp:200,...end});}
 swipe();assert.equal(dom['portal-page-evidence'].hidden,false);assert.equal(history.state.portalPage,'portal-evidence');
 swipe({clientX:100},{clientX:250});assert.equal(dom['portal-page-terms'].hidden,false);
 for(const start of [{pointerType:'mouse'},{clientX:10},{isPrimary:false},{target:{closest:()=>true}}]){swipe(start);assert.equal(dom['portal-page-terms'].hidden,false);}
 for(const end of [{clientY:420},{clientX:230},{timeStamp:1400}]){swipe({},end);assert.equal(dom['portal-page-terms'].hidden,false);}
 main.pointerdown(base);main.pointerdown({...base,isPrimary:false,pointerId:2});main.pointerup({...base,clientX:100,timeStamp:200});assert.equal(dom['portal-page-terms'].hidden,false);
 main.pointerdown(base);main.pointermove({...base,clientY:240});main.pointerup({...base,clientX:100,timeStamp:200});assert.equal(dom['portal-page-terms'].hidden,false);
 ctx.DeckelMobile.jump('deckel-more');swipe();assert.equal(dom['portal-page-more'].hidden,false);
});
test('Kurzer Wisch wechselt sofort genau eine Seite; Gegenbewegung ändert die Richtung nicht und löst keinen Klick aus',()=>{
 const dom=nodes(),ctx=vm.createContext({innerWidth:390,innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);
 const main=dom['deckel-main'],base={pointerId:1,pointerType:'touch',isPrimary:true,clientX:220,clientY:200,timeStamp:0,target:{closest:()=>null}};
 main.pointerdown(base);main.pointermove({...base,clientX:195,timeStamp:40});main.pointermove({...base,clientX:168,clientY:220,timeStamp:80});assert.equal(dom['portal-page-evidence'].hidden,false,'Wechsel bereits vor Loslassen');
 main.pointermove({...base,clientX:320,timeStamp:140});main.pointerup({...base,clientX:330,timeStamp:160});assert.equal(dom['portal-page-evidence'].hidden,false,'kein zweiter oder rückwärtiger Wechsel');let prevented=false,stopped=false;main.click({preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});assert.equal(prevented,true);assert.equal(stopped,true);
 main.pointerdown(base);main.pointermove({...base,clientX:195,timeStamp:30});main.pointerup({...base,clientX:300,timeStamp:80});assert.equal(dom['portal-page-evidence'].hidden,false,'Umkehr vor Auslösung wird verworfen');
 main.pointerdown(base);main.pointerup({...base,timeStamp:100});main.click({preventDefault(){throw Error('Normaler Tap blockiert');}});
});
test('Mobile Sammlung zeigt Betrag und Punkte vor dem Speichern und erlaubt Korrektur',async()=>{const f=await fixture();assert.equal(f.dom['phone-order'].hidden,false);f.dom['phone-beer'].onclick();f.dom['phone-wine'].onclick();f.dom['phone-points-beer'].onclick();assert.match(f.dom['phone-summary'].textContent,/3 Getränke/);assert.match(f.dom['phone-summary'].textContent,/4,50/);assert.match(f.dom['phone-summary'].textContent,/1 Punkt/);assert.equal(f.requests.length,0);f.dom['phone-minus-beer'].onclick();assert.match(f.dom['phone-summary'].textContent,/2 Getränke/);assert.ok(!f.dom['phone-summary'].textContent.includes('Punkte'));await f.dom['phone-save'].onclick();await flush();await flush();assert.equal(f.requests.filter(x=>x.url.endsWith('/commands/submit')).length,1);assert.equal(f.dom['phone-order'].hidden,false);assert.match(f.dom['phone-status'].textContent,/Gespeichert/);});
test('Offline-Vorgang bleibt gespeichert, Wiederholung sendet dieselbe ID',async()=>{const f=await fixture();f.offline(true);f.dom['phone-beer'].onclick();await f.dom['phone-save'].onclick();await flush();const job=f.saved.get('a'.repeat(32));assert.ok(job);assert.equal(f.dom['phone-save'].disabled,true);assert.equal(f.dom['phone-order'].hidden,false);assert.match(f.dom['phone-summary'].textContent,/nicht erneut/);f.offline(false);await f.dom['phone-retry'].onclick();assert.ok(f.requests.every(r=>r.body.id===job.id));assert.equal(f.saved.get('a'.repeat(32)),null);});
test('Ungültige Barzahlung wird vor dem Absenden erklärt, vorhandene Getränkesammlung blockiert Barzahlung',async()=>{const f=await fixture();f.dom['phone-cash-confirm'].checked=true;for(const value of ['0','0,001','10000,01']){f.dom['phone-amount'].value=value;f.dom['phone-cash-form'].onsubmit({preventDefault(){}});assert.equal(f.requests.length,0);}f.dom['phone-beer'].onclick();f.dom['phone-amount'].value='10,00';f.dom['phone-cash-form'].onsubmit({preventDefault(){}});assert.equal(f.requests.length,0);assert.equal(f.dom['phone-cash-submit'].disabled,true);});
test('Seitennavigation erhält den privaten Zugang und zeigt ausschließlich die gewählte Ansicht',()=>{const dom=nodes(),buttons=['account','phone-menu','deckel-more'].map(id=>{const n=new Node('button');n.dataset.deckelTarget=id;return n;});dom['deckel-nav'].querySelectorAll=()=>buttons;dom['deckel-more'].tagName='SECTION';const hash='#r=ffw-wasser/test&a=private&k=private',ctx=vm.createContext({location:{hash},matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>{fn();return 1;},innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);ctx.DeckelMobile.jump('phone-menu');assert.equal(dom['portal-page-deckel'].hidden,false);assert.equal(buttons[0].attributes['aria-current'],'page');buttons[2].click();assert.equal(ctx.location.hash,hash);assert.equal(dom['deckel-more'].open,undefined);assert.equal(dom['portal-page-more'].focused,true);assert.equal(dom['portal-page-more'].hidden,false);assert.equal(dom['portal-page-terms'].hidden,true);assert.equal(dom['portal-page-deckel'].hidden,true);assert.equal(buttons[2].attributes['aria-current'],'page');ctx.DeckelMobile.show(false);assert.equal(dom['deckel-nav'].hidden,true);});

test('Bestätigte Barzahlung leert Betrag und Bestätigung, damit dieselbe Einzahlung nicht versehentlich wiederholt wird',async()=>{const f=await fixture();f.dom['phone-amount'].value='10,00';f.dom['phone-cash-confirm'].checked=true;await f.dom['phone-cash-form'].onsubmit({preventDefault(){}});assert.equal(f.requests.filter(r=>r.url.endsWith('/commands/submit')).length,1);assert.equal(f.dom['phone-amount'].value,'');assert.equal(f.dom['phone-cash-confirm'].checked,false);assert.match(f.dom['phone-status'].textContent,/Gespeichert/);});

test('Punktetasten bleiben bei fehlendem oder zu geringem Punktestand gesperrt',async()=>{const f=await fixture();await f.ctx.DeckelActions.render({...f.data,pointUnits:undefined});assert.equal(f.dom['phone-points-beer'].disabled,true);assert.equal(f.dom['phone-points-wine'].disabled,true);await f.ctx.DeckelActions.render({...f.data,pointUnits:150});f.dom['phone-points-beer'].onclick();assert.equal(f.dom['phone-points-beer'].disabled,true);assert.equal(f.dom['phone-points-wine'].disabled,true);assert.match(f.dom['phone-summary'].textContent,/1 Getränk/);});

test('Menüwechsel scrollt den Inhaltsbereich, während die Navigation ihren eigenen Platz behält',()=>{
 const dom=nodes(),scrolls=[],windowScrolls=[];dom['deckel-nav'].querySelectorAll=()=>[];dom['deckel-main'].scrollTo=options=>scrolls.push(options.top);
 const ctx=vm.createContext({innerHeight:844,scrollTo:options=>windowScrolls.push(options),addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);ctx.DeckelMobile.jump('account');assert.deepEqual(scrolls,[0]);assert.equal(windowScrolls.length,0);assert.equal(dom['portal-page-deckel'].hidden,false);assert.equal(dom['deckel-nav'].hidden,false);
});
test('Bildschirmtastatur verkleinert den Inhaltsbereich; nach Schließen kehrt die normale Höhe zurück',()=>{
 const dom=nodes(),events={},classes=new Set(),properties=new Map(),viewport={height:844,addEventListener:(key,fn)=>events['viewport:'+key]=fn};let focused=false;
 dom['deckel-nav'].querySelectorAll=()=>[];const document={readyState:'complete',activeElement:{matches:()=>focused},body:{classList:{toggle:(key,value)=>value?classes.add(key):classes.delete(key),remove:key=>classes.delete(key)}},documentElement:{style:{setProperty:(key,value)=>properties.set(key,value),removeProperty:key=>properties.delete(key)}},getElementById:id=>dom[id],addEventListener:(key,fn)=>events[key]=fn};
 const ctx=vm.createContext({innerHeight:844,visualViewport:viewport,addEventListener(){},document});vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);
 focused=true;events.focusin();viewport.height=420;events['viewport:resize']();assert.equal(classes.has('keyboard-open'),true);assert.equal(properties.get('--portal-viewport-height'),'420px');
 focused=false;viewport.height=844;events['viewport:resize']();assert.equal(classes.has('keyboard-open'),false);assert.equal(properties.has('--portal-viewport-height'),false);
});

test('Meine Nachweise öffnet eine eigene Seite und erhält den privaten Zugang beim Wechsel zum Deckel',()=>{
 const dom=nodes(),buttons=['portal-section','portal-evidence','account','portal-points','deckel-more'].map(id=>{const n=new Node('button');n.dataset.deckelTarget=id;return n;});dom['deckel-nav'].querySelectorAll=()=>buttons;
 const hash='#test-private-access',ctx=vm.createContext({location:{hash},innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);ctx.DeckelMobile.jump('portal-evidence');assert.equal(dom['portal-page-evidence'].hidden,false);assert.equal(dom['portal-page-terms'].hidden,true);assert.equal(dom['portal-page-deckel'].hidden,true);assert.equal(buttons[1].attributes['aria-current'],'page');assert.equal(dom['portal-page-evidence'].focused,true);
 ctx.DeckelMobile.jump('account');assert.equal(dom['portal-page-evidence'].hidden,true);assert.equal(dom['portal-page-deckel'].hidden,false);assert.equal(ctx.location.hash,hash);
});

test('Monats-Challenge hat eigene Ansicht mit Zurück-Taste ohne Veränderung des privaten Zugangs',()=>{
 const dom=nodes(),history={state:{},replaceState(s){this.state=s;},pushState(s){this.state=s;}};
 const hash='#r=ffw-wasser/test&a=private&k=private';
 const ctx=vm.createContext({location:{hash},history,innerWidth:390,innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);
 ctx.DeckelMobile.show(true);
 ctx.DeckelMobile.jump('portal-points');
 dom['challenge-open'].click();
 assert.equal(dom['portal-page-challenge'].hidden,false);
 assert.equal(dom['portal-page-points'].hidden,true);
 assert.equal(dom['deckel-nav'].hidden,true);
 assert.equal(history.state.portalPage,'portal-challenge');
 assert.equal(ctx.location.hash,hash);
 dom['challenge-back'].click();
 assert.equal(dom['portal-page-challenge'].hidden,true);
 assert.equal(dom['portal-page-points'].hidden,false);
 assert.equal(dom['deckel-nav'].hidden,false);
});

test('Sortenweise Minus-Tasten erhalten andere Getränke und geben vorgemerkte Punkte frei',async()=>{
 const f=await fixture();
 f.dom['phone-beer'].onclick();f.dom['phone-wine'].onclick();f.dom['phone-points-beer'].onclick();
 assert.equal(f.dom['phone-count-beer'].textContent,'2');assert.equal(f.dom['phone-count-wine'].textContent,'1');
 f.dom['phone-minus-beer'].onclick();
 assert.equal(f.dom['phone-count-beer'].textContent,'1');assert.equal(f.dom['phone-count-wine'].textContent,'1');
 assert.match(f.dom['phone-summary'].textContent,/4,50/);assert.doesNotMatch(f.dom['phone-summary'].textContent,/Punkt/);
 f.dom['phone-minus-wine'].onclick();f.dom['phone-minus-wine'].onclick();
 assert.equal(f.dom['phone-count-wine'].textContent,'0');assert.equal(f.dom['phone-minus-wine'].disabled,true);
 assert.equal(f.dom['phone-count-beer'].textContent,'1');assert.match(f.dom['phone-summary'].textContent,/1,50/);
 assert.equal(f.requests.length,0);
});
test('Mengenänderungen bleiben während unbestätigter Übertragung gesperrt',async()=>{
 const f=await fixture();f.dom['phone-beer'].onclick();f.offline(true);
 const saving=f.dom['phone-save'].onclick();
 f.dom['phone-minus-beer'].onclick();assert.equal(f.dom['phone-count-beer'].textContent,'1');
 await saving;await flush();
 assert.equal(f.dom['phone-minus-beer'].disabled,true);assert.equal(f.dom['phone-minus-wine'].disabled,true);
 assert.equal(f.dom['phone-beer'].disabled,true);assert.equal(f.dom['phone-retry'].hidden,false);
 assert.equal(f.dom['phone-order'].hidden,false);
});

test('Android-Fensterresize hält Eingaben sichtbar und verwechselt Querformat oder Zoom nicht mit Tastatur',()=>{
 const dom=nodes(),events={},classes=new Set(),properties=new Map();let scrolled=0,focused=false;
 const viewport={height:800,scale:1,offsetTop:0,addEventListener:(key,fn)=>events['viewport:'+key]=fn};
 const active={matches:()=>focused,getBoundingClientRect:()=>({top:650,bottom:700}),scrollIntoView:()=>scrolled++};
 dom['deckel-nav'].querySelectorAll=()=>[];
 const document={readyState:'complete',activeElement:active,body:{classList:{toggle:(key,value)=>value?classes.add(key):classes.delete(key)}},documentElement:{style:{setProperty:(key,value)=>properties.set(key,value),removeProperty:key=>properties.delete(key)}},getElementById:id=>dom[id],addEventListener:(key,fn)=>events[key]=fn};
 const ctx=vm.createContext({innerWidth:390,innerHeight:800,visualViewport:viewport,addEventListener:(key,fn)=>events['window:'+key]=fn,document});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);
 focused=true;viewport.height=400;events['window:resize']();
 assert.equal(classes.has('keyboard-open'),true);assert.equal(properties.get('--portal-viewport-height'),'400px');assert.equal(scrolled,1);
 focused=false;viewport.height=800;events.focusout();assert.equal(classes.has('keyboard-open'),false);
 focused=true;viewport.scale=2;viewport.height=400;events['viewport:resize']();assert.equal(classes.has('keyboard-open'),false);assert.equal(scrolled,1);
 viewport.scale=1;ctx.innerWidth=800;ctx.innerHeight=390;viewport.height=390;events['window:resize']();
 assert.equal(classes.has('keyboard-open'),false);assert.equal(properties.has('--portal-viewport-height'),false);
});

test('Mehr-Kacheln öffnen eigene Rubriken und Rückkehr hält Mehr im Menü ausgewählt',()=>{
 const dom=nodes(),events={},history=[],button=new Node('button');button.dataset.deckelTarget='deckel-more';
 dom['deckel-nav'].querySelectorAll=()=>[button];
 const ctx=vm.createContext({innerHeight:844,history:{state:{},replaceState(){},pushState:state=>history.push(state.portalPage)},addEventListener:(key,fn)=>events[key]=fn,document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);
 for(const target of ['more-bundesliga','more-bookings','more-reminders','more-help']){
  ctx.DeckelMobile.jump('deckel-more');ctx.DeckelMobile.jump(target);
  assert.equal(dom['portal-page-'+target].hidden,false);assert.equal(dom['portal-page-more'].hidden,true);
  assert.equal(button.attributes['aria-current'],'page');assert.equal(history.at(-1),target);
  events.popstate({state:{portalPage:'deckel-more'}});
  assert.equal(dom['portal-page-more'].hidden,false);assert.equal(dom['portal-page-'+target].hidden,true);
 }
});

test('Cash öffnet ein eigenes Fenster; Schließen sendet keine Zahlung',async()=>{const f=await fixture();f.dom['phone-cash-open'].onclick();assert.equal(f.dom['phone-cash-dialog'].open,true);assert.equal(f.dom['phone-amount'].focused,true);f.dom['phone-amount'].value='10,00';f.dom['phone-cash-close'].onclick();assert.equal(f.dom['phone-cash-dialog'].open,false);assert.equal(f.requests.length,0);assert.equal(f.dom['phone-amount'].value,'10,00');});
test('Cash erklärt vorgemerkte Getränke und schließt erst nach bestätigter Einzahlung',async()=>{const f=await fixture();f.dom['phone-beer'].onclick();f.dom['phone-cash-open'].onclick();assert.match(f.dom['phone-cash-state'].textContent,/Getränke speichern/);assert.equal(f.dom['phone-cash-submit'].disabled,true);f.dom['phone-cash-close'].onclick();f.dom['phone-minus-beer'].onclick();f.dom['phone-cash-open'].onclick();f.dom['phone-amount'].value='10,00';f.dom['phone-cash-confirm'].checked=true;await f.dom['phone-cash-form'].onsubmit({preventDefault(){}});assert.equal(f.dom['phone-cash-dialog'].open,false);assert.equal(f.requests.filter(r=>r.url.endsWith('/commands/submit')).length,1);});

test('Cash bleibt bei fehlender Verbindung offen und prüft beim Wiederholen denselben Vorgang',async()=>{const f=await fixture();f.dom['phone-cash-open'].onclick();f.offline(true);f.dom['phone-amount'].value='5,00';f.dom['phone-cash-confirm'].checked=true;await f.dom['phone-cash-form'].onsubmit({preventDefault(){}});assert.equal(f.dom['phone-cash-dialog'].open,true);assert.match(f.dom['phone-cash-state'].textContent,/Offline/);assert.equal(f.dom['phone-cash-retry'].hidden,false);const job=f.saved.get('a'.repeat(32));f.offline(false);await f.dom['phone-cash-retry'].onclick();assert.ok(f.requests.every(r=>r.body.id===job.id));assert.equal(f.dom['phone-cash-dialog'].open,false);});

test('Kopfbereich zeigt die gewählte Rubrik bei Menüwechsel, Unterseite und Aktualisierung',()=>{
 const dom=nodes(),ctx=vm.createContext({innerWidth:390,innerHeight:844,addEventListener(){},document:{readyState:'complete',body:new Node(),getElementById:id=>dom[id],addEventListener(){}}});
 vm.runInContext(read('js/features/drinks/deckel-mobile.js'),ctx);ctx.DeckelMobile.show(true);
 assert.equal(dom['portal-menu-title'].textContent,'Termine');
 for(const [id,title] of [['account','Mein Deckel'],['portal-evidence','Nachweise'],['portal-points','Treuepunkte'],['deckel-more','Mehr'],['more-bookings','Buchungen'],['more-help','Hilfe'],['portal-challenge','Monats-Challenge']]){ctx.DeckelMobile.jump(id);assert.equal(dom['portal-menu-title'].textContent,title);ctx.DeckelMobile.show(true);assert.equal(dom['portal-menu-title'].textContent,title);}
 ctx.DeckelMobile.show(false);assert.equal(dom['portal-menu-title'].textContent,'H₂O Portal');ctx.DeckelMobile.show(true);assert.equal(dom['portal-menu-title'].textContent,'Termine');
});
