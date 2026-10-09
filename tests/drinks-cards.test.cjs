const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.handlers={};this.attributes={};this.classList={toggle(){},add(){}};this.style={setProperty(){}};}
  addEventListener(type,handler){this.handlers[type]=handler;}replaceChildren(){this.children=[];}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attributes[k]=v;}focus(){}removeAttribute(){}querySelector(){return null;}querySelectorAll(){return [];}
}
const descendants=n=>[n,...n.children.flatMap(descendants)];
const wait=async predicate=>{const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error('UI-Zustand nicht erreicht');await new Promise(resolve=>setTimeout(resolve,5));}};
async function fixture(options={}){
  const nodes={};for(const m of source('index.html').matchAll(/id="([^"]+)"/g))nodes[m[1]]=new Node();
  const root=nodes.drinksView,person=new Node(),screens=['members','opening','pin','account','amount','cash','paid','own-pin'].map(value=>{const n=new Node();n.dataset.drScreen=value;return n;});
  root.querySelectorAll=q=>q==='[data-dr-screen]'?screens:q==='[data-dr-person]'?[person]:[];
  let now=Date.parse('2026-10-09T11:30:00Z'),nextTimer=0;const timers=new Map(),documentEvents={},globalEvents={};
  class ClockDate extends Date{constructor(value){super(value===undefined?now:value);}static now(){return now;}}
  const context=vm.createContext({console,crypto:webcrypto,TextEncoder,Date:ClockDate,innerHeight:844,
    setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,until:now+delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
    byId:id=>nodes[id],showView(){root.hidden=false;return true;},showToast(){},
    oneDriveReadState:async()=>({members:[{id:'a',lastName:'Alpha',firstName:'Mitglied'},{id:'b',lastName:'Beta',firstName:'Mitglied'}]}),
    document:{hidden:false,createElement:tag=>new Node(tag),addEventListener:(name,fn)=>documentEvents[name]=fn},
    addEventListener:(name,fn)=>globalEvents[name]=fn,scrollTo(){}});
  context.window=context;vm.runInContext(source('js/features/drinks/drinks-model.js'),context);const M=context.DrinksModel;
  const accounts=new Map([['a',M.empty('a')],['b',M.empty('b')]]),cache=new Map(),books=[];
  if(options.pin)accounts.get('a').pin=await M.createPin('4826');if(options.secondPin)accounts.get('b').pin=await M.createPin('7391');
  if(options.balance)accounts.set('a',M.append(accounts.get('a'),{id:'drink-fixture-001',type:'drinks',count:5,cents:750,createdAt:'2026-10-09T11:00:00Z'}));
  const clone=x=>JSON.parse(JSON.stringify(x));for(const [id,a] of accounts)cache.set(id,clone(a));
  let fail=null,loseReply=false,gate=null,readCount=0;
  const S={cached:id=>clone(cache.get(id)||M.empty(id)),rewards:async()=>options.policy||null,cachedRewards:()=>options.policy||null,list:async()=>[],
    read:async id=>{readCount++;cache.set(id,clone(accounts.get(id)));return clone(accounts.get(id));},
    book:async(id,booking,sig)=>{books.push({id,booking:clone(booking),sig});if(gate){const g=gate;gate=null;await g;}if(fail){const e=fail;fail=null;throw e;}
      cache.set(id,clone(accounts.get(id)));if(JSON.stringify(accounts.get(id).pin)!==sig)throw Object.assign(new Error('PIN wurde geändert.'),{code:'pinChanged'});
      const value=options.policy?M.appendWithReward(accounts.get(id),booking,options.policy):M.append(accounts.get(id),booking);accounts.set(id,value);cache.set(id,clone(value));if(loseReply){loseReply=false;throw new Error('Antwort verloren');}return clone(value);}};
  context.DrinksStore=S;context.document.readyState='loading';vm.runInContext(source('js/features/drinks/drinks-rewards.js'),context);vm.runInContext(source('js/features/drinks/drinks.js'),context);await context.Drinks.open();
  const card=id=>nodes['dr-members'].children.find(n=>n.dataset.drCard===id);
  const button=(id,action)=>descendants(card(id)).find(n=>n.dataset.drCardAction===action);
  const click=(id,action)=>{const n=button(id,action);assert.ok(n&&!n.disabled,'Kartenaktion ist bedienbar: '+action);nodes['dr-members'].handlers.click({target:{closest:()=>n}});};
  const pin=value=>{nodes['dr-pin'].value=value;nodes['dr-pin-form'].handlers.submit({preventDefault(){}});};
  const status=id=>descendants(card(id)).find(n=>n.className==='dr-member-status').textContent;
  const lock=id=>descendants(card(id)).find(n=>n.className==='dr-member-lock').textContent;
  return {context,M,S,nodes,root,accounts,books,click,pin,status,lock,card,button,documentEvents,globalEvents,readCount:()=>readCount,
    failNext:e=>fail=e,loseReply:()=>loseReply=true,hold:()=>{let done;gate=new Promise(resolve=>done=resolve);return done;},
    advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.until<=now){timers.delete(id);t.fn();}}};
}
test('Karten zeigen Namen und Betrag; ein Tippen speichert ohne Kontowechsel',async()=>{
  const f=await fixture();assert.equal(f.nodes['dr-members'].children.length,2);f.click('a','add');
  assert.equal(f.root.dataset.screen,'members');await wait(()=>f.status('a')==='Gespeichert ✓');
  assert.equal(f.accounts.get('a').bookings.length,1);assert.equal(f.M.totals(f.accounts.get('a')).balance,150);assert.equal(f.books.length,1);
});
test('Drei schnelle Tipps werden genau dreimal gespeichert, auch bei unterschiedlichen Mitgliedern',async()=>{
  const f=await fixture(),release=f.hold();f.click('a','add');f.click('a','add');f.click('b','add');
  assert.match(f.status('a'),/2 Striche/);assert.equal(f.context.Drinks.beforeView('attendanceView'),false);
  release();await wait(()=>f.status('b')==='Gespeichert ✓');assert.equal(f.accounts.get('a').bookings.length,2);assert.equal(f.accounts.get('b').bookings.length,1);
  assert.equal(new Set(f.books.map(b=>b.booking.id)).size,3);assert.equal(f.context.Drinks.beforeView('attendanceView'),true);
});
test('PIN-Aktion bucht erst nach richtiger PIN und benötigt bei weiteren Tipps keine zweite PIN',async()=>{
  const f=await fixture({pin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.books.length,0);
  f.pin('0000');await wait(()=>f.nodes['dr-error'].textContent.includes('stimmt nicht'));assert.equal(f.books.length,0);
  f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.root.dataset.screen,'members');assert.equal(f.accounts.get('a').bookings.length,1);
  assert.match(f.lock('a'),/Entsperrt/);f.click('a','add');await wait(()=>f.accounts.get('a').bookings.length===2);
  await wait(()=>!f.button('a','account').disabled);f.advance(60001);assert.match(f.lock('a'),/PIN geschützt/);f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.accounts.get('a').bookings.length,2);
});
test('PIN-Abbruch verwirft die vorgemerkte Aktion; beim Verbergen werden Freigaben gesperrt',async()=>{
  const f=await fixture({pin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.nodes['dr-pin-back'].handlers.click();assert.equal(f.books.length,0);
  f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');
  f.context.document.hidden=true;f.documentEvents.visibilitychange();f.context.document.hidden=false;assert.match(f.lock('a'),/PIN geschützt/);
  f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.books.length,1);
});
test('Unklare Antwort wird mit derselben Buchungsnummer geprüft und nicht doppelt gebucht',async()=>{
  const f=await fixture();f.loseReply();f.click('a','add');await wait(()=>f.status('a').includes('nicht bestätigt'));
  assert.equal(f.accounts.get('a').bookings.length,1);assert.equal(f.context.Drinks.beforeView('attendanceView'),false);
  f.click('a','retry');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.accounts.get('a').bookings.length,1);
  assert.equal(f.books[0].booking.id,f.books[1].booking.id);
});
test('PIN-Änderung auf anderem Gerät erzwingt Freigabe der wartenden Buchung',async()=>{
  const f=await fixture();f.accounts.get('a').pin=await f.M.createPin('4826');f.click('a','add');await wait(()=>f.status('a').includes('nicht bestätigt'));assert.equal(f.accounts.get('a').bookings.length,0);
  f.click('a','retry');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.accounts.get('a').bookings.length,1);
  assert.equal(f.books[0].booking.id,f.books[1].booking.id);
});
test('Bezahlen erfordert PIN und Bestätigung; bloßes Öffnen erzeugt keine Zahlung',async()=>{
  const f=await fixture({pin:true,balance:true});f.click('a','pay');await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.books.length,0);
  f.pin('4826');await wait(()=>f.root.dataset.screen==='amount');assert.equal(f.books.length,0);f.nodes['dr-amount'].value='5,00';
  f.nodes['dr-pay-form'].handlers.submit({preventDefault(){}});await wait(()=>f.root.dataset.screen==='cash');assert.equal(f.books.length,0);
  f.nodes['dr-cash-confirm'].handlers.click();await wait(()=>f.root.dataset.screen==='paid');assert.equal(f.M.totals(f.accounts.get('a')).balance,250);
});
test('Wartende Tipps bleiben nach einem Verbindungsfehler erhalten und werden in Reihenfolge fortgesetzt',async()=>{
  const f=await fixture(),release=f.hold();f.failNext(new Error('Offline'));f.click('a','add');f.click('a','add');f.click('b','add');release();
  await wait(()=>f.status('a').includes('nicht bestätigt'));assert.equal(f.accounts.get('a').bookings.length,0);
  f.click('a','retry');await wait(()=>f.status('b')==='Gespeichert ✓');assert.equal(f.accounts.get('a').bookings.length,2);assert.equal(f.accounts.get('b').bookings.length,1);
  assert.equal(f.books[0].booking.id,f.books[1].booking.id);
});
test('Jede PIN-Karte hat eine eigene Frist; fremde Karten bleiben nach einem Ablauf freigegeben',async()=>{
  const f=await fixture({pin:true,secondPin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');await wait(()=>!f.button('a','account').disabled);
  f.advance(10000);f.click('b','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('7391');await wait(()=>f.status('b')==='Gespeichert ✓');await wait(()=>!f.button('b','account').disabled);
  f.advance(50001);assert.match(f.lock('a'),/PIN geschützt/);assert.match(f.lock('b'),/Entsperrt/);
});
test('Verbergen während des Speicherns entsperrt die PIN-Karte nach Abschluss nicht erneut',async()=>{
  const f=await fixture({pin:true}),release=f.hold();f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.books.length===1);
  f.context.document.hidden=true;f.documentEvents.visibilitychange();release();await wait(()=>f.status('a')==='Gespeichert ✓');f.context.document.hidden=false;
  assert.match(f.lock('a'),/PIN geschützt/);assert.equal(f.accounts.get('a').bookings.length,1);
});
test('Aktualisieren nach einer unklaren Speicherung erhält die Buchungsnummer und ermöglicht Wiederholung',async()=>{
  const f=await fixture();f.loseReply();f.click('a','add');await wait(()=>f.status('a').includes('nicht bestätigt'));
  await f.context.Drinks.open();assert.match(f.status('a'),/nicht bestätigt/);f.click('a','retry');await wait(()=>f.status('a')==='Gespeichert ✓');
  assert.equal(f.accounts.get('a').bookings.length,1);assert.equal(f.books[0].booking.id,f.books[1].booking.id);
});

test('Mitglied sammelt mehrere Striche mit Fassanzeige und speichert erst mit Fertig',async()=>{
  const f=await fixture();f.click('a','account');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-add'].disabled);
  for(let i=0;i<7;i++)f.nodes['dr-add'].handlers.click();assert.equal(f.books.length,0);
  assert.equal(f.nodes['dr-beers'].children.length,3);assert.equal(f.nodes['dr-beers'].children[0].className,'dr-keg');
  f.nodes['dr-minus'].handlers.click();assert.match(f.nodes['dr-draft-count'].textContent,/6 neue/);
  f.nodes['dr-save'].handlers.click();await wait(()=>f.root.dataset.screen==='members');assert.equal(f.books.length,1);assert.equal(f.books[0].booking.count,6);
});
test('Heutige Korrektur bleibt im Mitgliedsmenü; ungespeicherte Striche bleiben erhalten',async()=>{
  const f=await fixture({balance:true});f.click('a','account');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-add'].disabled);
  f.nodes['dr-add'].handlers.click();f.nodes['dr-today-undo'].handlers.click();await wait(()=>f.books.length===1&&!f.nodes['dr-add'].disabled);
  assert.equal(f.M.totals(f.accounts.get('a')).count,4);assert.match(f.nodes['dr-today-count'].textContent,/4 heute/);assert.match(f.nodes['dr-draft-count'].textContent,/1 neue/);
  assert.equal(f.root.dataset.screen,'account');f.nodes['dr-save'].handlers.click();await wait(()=>f.root.dataset.screen==='members');assert.equal(f.M.totals(f.accounts.get('a')).count,5);
});
test('Unklare Korrektur wird mit derselben Nummer erneut geprüft und nicht doppelt gerechnet',async()=>{
  const f=await fixture({balance:true,pin:true});f.click('a','account');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-add'].disabled);
  f.loseReply();f.nodes['dr-today-undo'].handlers.click();await wait(()=>f.nodes['dr-error'].textContent.includes('Antwort verloren'));
  assert.equal(f.nodes['dr-save'].disabled,true);assert.equal(f.context.Drinks.beforeView('attendanceView'),false);
  f.nodes['dr-today-undo'].handlers.click();await wait(()=>!f.nodes['dr-save'].disabled);assert.equal(f.books[0].booking.id,f.books[1].booking.id);assert.equal(f.M.totals(f.accounts.get('a')).count,4);
});

test('Bonusrest ist direkt auf Karten und im Konto sichtbar und berücksichtigt Teilzahlungen',async()=>{
  const policy={schemaVersion:1,id:'program-fixture',revision:'revision-fixture',startedAt:'2026-10-01T00:00:00Z',count:20,cents:300};
  const f=await fixture({policy,balance:true});const a=f.accounts.get('a');
  f.accounts.set('a',f.M.appendWithReward(a,{id:'payment-fixture',type:'payment',method:'cash',confirmation:'member',cents:500,createdAt:'2026-10-09T11:20:00Z'},policy));
  f.click('a','account');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-add'].disabled);
  assert.match(f.nodes['dr-bonus-text'].textContent,/25,00 €/);assert.match(f.nodes['dr-bonus-text'].textContent,/Teilzahlungen/);
  const cardBonus=descendants(f.card('a')).find(n=>n.className==='dr-member-bonus');assert.equal(cardBonus.hidden,false);assert.equal(cardBonus.textContent,f.nodes['dr-bonus-text'].textContent);
  f.nodes['dr-cancel'].handlers.click();f.accounts.set('a',f.M.appendWithReward(f.accounts.get('a'),{id:'payment-fixture-rest',type:'payment',method:'cash',confirmation:'member',cents:250,createdAt:'2026-10-09T11:25:00Z'},policy));
  f.click('a','account');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-add'].disabled);assert.match(f.nodes['dr-bonus-text'].textContent,/Noch 15 bezahlte Striche/);
});
test('PIN-Sperre verliert weder Sammelentwurf noch die Nummer einer unklaren Korrektur',async()=>{
  const f=await fixture({pin:true,balance:true});f.click('a','account');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-add'].disabled);
  f.nodes['dr-add'].handlers.click();f.loseReply();f.nodes['dr-today-undo'].handlers.click();await wait(()=>f.nodes['dr-error'].textContent.includes('Antwort verloren'));
  f.context.document.hidden=true;f.documentEvents.visibilitychange();f.context.document.hidden=false;assert.equal(f.root.dataset.screen,'pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-today-undo'].disabled);
  f.nodes['dr-today-undo'].handlers.click();await wait(()=>!f.nodes['dr-save'].disabled);assert.equal(f.books[0].booking.id,f.books[1].booking.id);assert.match(f.nodes['dr-draft-count'].textContent,/1 neue/);assert.equal(f.M.totals(f.accounts.get('a')).count,4);
});
