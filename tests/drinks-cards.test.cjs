const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.handlers={};this.attributes={};this.classList={toggle(){},add(){}};this.style={setProperty(){}};}
  addEventListener(type,handler){this.handlers[type]=handler;}replaceChildren(){this.children=[];}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attributes[k]=v;}focus(){this.focused=true;}scrollIntoView(options){this.scrolled=options;}removeAttribute(){}querySelector(){return null;}querySelectorAll(){return [];}
}
const descendants=n=>[n,...n.children.flatMap(descendants)];
const wait=async predicate=>{const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error('UI-Zustand nicht erreicht');await new Promise(resolve=>setTimeout(resolve,5));}};
async function fixture(options={}){
  const nodes={};for(const m of source('index.html').matchAll(/id="([^"]+)"/g))nodes[m[1]]=new Node();
  const root=nodes.drinksView,person=new Node(),screens=['members','opening','pin','account','payment','amount','cash','paid','own-pin','mobile'].map(value=>{const n=new Node();n.dataset.drScreen=value;return n;});
  root.querySelectorAll=q=>q==='[data-dr-screen]'?screens:q==='[data-dr-person]'?[person]:[];
  let now=Date.parse('2026-10-09T11:30:00Z'),nextTimer=0;const timers=new Map(),documentEvents={},globalEvents={};
  class ClockDate extends Date{constructor(value){super(value===undefined?now:value);}static now(){return now;}}
  const context=vm.createContext({console,crypto:webcrypto,TextEncoder,Date:ClockDate,innerHeight:844,
    setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,until:now+delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
    confirm:()=>allowDiscard,byId:id=>nodes[id],showView(){root.hidden=false;return true;},showToast(){},
    oneDriveReadState:async()=>({members:[{id:'a',lastName:'Alpha',firstName:'Mitglied'},{id:'b',lastName:'Beta',firstName:'Mitglied'}]}),
    document:{hidden:false,createElement:tag=>new Node(tag),addEventListener:(name,fn)=>documentEvents[name]=fn},
    addEventListener:(name,fn)=>globalEvents[name]=fn,scrollTo(){}});
  context.window=context;vm.runInContext(source('js/features/drinks/drinks-model.js'),context);const M=context.DrinksModel;
  const accounts=new Map([['a',M.empty('a')],['b',M.empty('b')]]),cache=new Map(),books=[];
  if(options.pin)accounts.get('a').pin=await M.createPin('4826');if(options.secondPin)accounts.get('b').pin=await M.createPin('7391');
  if(options.balance)accounts.set('a',M.append(accounts.get('a'),{id:'drink-fixture-001',type:'drinks',count:5,cents:750,createdAt:'2026-10-09T11:00:00Z'}));
  if(options.prepaid){accounts.set('a',M.appendWithReward(accounts.get('a'),{id:'fixture-prepaid-payment',type:'payment',cents:options.prepaid,method:'cash',confirmation:'member',prepay:true,createdAt:'2026-10-09T10:00:00Z'},options.policy));}
  const clone=x=>JSON.parse(JSON.stringify(x));for(const [id,a] of accounts)cache.set(id,clone(a));
  let fail=null,failMember='',loseReply=false,gate=null,readCount=0,allowDiscard=true;const writes=[];
  const S={cached:id=>clone(cache.get(id)||M.empty(id)),rewards:async()=>options.policy||null,cachedRewards:()=>options.policy||null,list:async()=>[],
    read:async id=>{readCount++;cache.set(id,clone(accounts.get(id)));return clone(accounts.get(id));},
    book:async(id,booking,sig)=>{books.push({id,booking:clone(booking),sig});if(gate){const g=gate;gate=null;await g;}if(fail){const e=fail;fail=null;throw e;}
      cache.set(id,clone(accounts.get(id)));if(JSON.stringify(accounts.get(id).pin)!==sig)throw Object.assign(new Error('PIN wurde geändert.'),{code:'pinChanged'});
      const value=options.policy?M.appendWithReward(accounts.get(id),booking,options.policy):M.append(accounts.get(id),booking);accounts.set(id,value);cache.set(id,clone(value));if(loseReply){loseReply=false;throw new Error('Antwort verloren');}return clone(value);}};
  S.bookMany=async(id,entries,sig)=>{
    writes.push({id,entries:clone(entries)});for(const booking of entries)books.push({id,booking:clone(booking),sig});
    if(gate){const g=gate;gate=null;await g;}if(fail){const e=fail;fail=null;throw e;}if(id===failMember){failMember='';throw Error('Offline');}
    cache.set(id,clone(accounts.get(id)));if(JSON.stringify(accounts.get(id).pin)!==sig)throw Object.assign(new Error('PIN wurde geändert.'),{code:'pinChanged'});
    const value=M.appendMany(accounts.get(id),entries);accounts.set(id,value);cache.set(id,clone(value));if(loseReply){loseReply=false;throw Error('Antwort verloren');}return clone(value);
  };
  context.DrinksStore=S;context.document.readyState='loading';vm.runInContext(source('js/features/drinks/drinks-rewards.js'),context);vm.runInContext(source('js/features/drinks/drinks.js'),context);await context.Drinks.open();
  const card=id=>nodes['dr-members'].children.find(n=>n.dataset.drCard===id);
  const button=(id,action)=>descendants(card(id)).find(n=>n.dataset.drCardAction===action);
  const click=(id,action)=>{const n=button(id,action);assert.ok(n&&!n.disabled,'Kartenaktion ist bedienbar: '+action);nodes['dr-members'].handlers.click({target:{closest:()=>n}});};
  const pin=value=>{nodes['dr-pin'].value=value;nodes['dr-pin-form'].handlers.submit({preventDefault(){}});};
  const status=id=>descendants(card(id)).find(n=>n.className==='dr-member-status').textContent;
  const lock=id=>descendants(card(id)).find(n=>n.className==='dr-member-lock').textContent;
  const menu=async id=>{const tile=nodes['dr-directory'].children.find(n=>n.dataset.drMember===id);assert.ok(tile&&!tile.disabled);nodes['dr-directory'].handlers.click({target:{closest:()=>tile}});await wait(()=>root.dataset.memberMenu==='true'&&root.dataset.screen==='members'&&!button(id,'add').disabled);};
  return {menu,writes,confirm(){assert.equal(nodes['dr-confirm'].disabled,false);nodes['dr-confirm'].handlers.click();},discardAllowed(value){allowDiscard=value;},failMember:id=>failMember=id,context,M,S,nodes,root,accounts,books,click,pin,status,lock,card,button,documentEvents,globalEvents,readCount:()=>readCount,
    failNext:e=>fail=e,loseReply:()=>loseReply=true,hold:()=>{let done;gate=new Promise(resolve=>done=resolve);return done;},
    advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.until<=now){timers.delete(id);t.fn();}}};
}
test('Hauptmaske sammelt alle Einträge und überträgt pro Mitglied erst nach OK',async()=>{
 const f=await fixture();f.click('a','add');f.click('a','wine');f.click('a','add');f.click('b','wine');
 assert.equal(f.writes.length,0);assert.equal(f.books.length,0);assert.match(f.nodes['dr-main-summary'].textContent,/4 Änderungen für 2/);
 assert.equal(f.nodes['dr-main-confirm'].hidden,false);assert.equal(f.button('a','pay').disabled,true);
 f.confirm();await wait(()=>f.status('b')==='Gespeichert ✓');assert.equal(f.writes.length,2);assert.equal(f.writes[0].entries.length,3);
 assert.deepEqual(f.writes[0].entries.map(b=>b.drink||'beer'),['beer','wine','beer']);assert.equal(f.M.totals(f.accounts.get('a')).balance,600);assert.equal(f.M.totals(f.accounts.get('b')).balance,300);assert.equal(f.nodes['dr-main-confirm'].hidden,true);
});
test('Eintrag rückgängig machen entfernt die letzte vorgemerkte Eingabe, unabhängig von Getränketyp',async()=>{
 const f=await fixture();f.click('a','add');f.click('a','wine');f.click('a','add');f.click('a','undo');
 assert.match(f.nodes['dr-main-summary'].textContent,/2 Änderungen/);assert.equal(f.writes.length,0);f.click('a','undo');f.confirm();await wait(()=>f.status('a')==='Gespeichert ✓');
 assert.equal(f.writes[0].entries.length,1);assert.equal(f.M.totals(f.accounts.get('a')).balance,150);
});
test('Fünf Weingläser werden zu einem Weinfass und fünf Bierstriche zu einem Bierfass',async()=>{
 const f=await fixture();for(let i=0;i<5;i++)f.click('a','add');for(let i=0;i<6;i++)f.click('a','wine');
 const staged=descendants(f.card('a')).find(n=>n.className?.includes('dr-member-staged'));assert.equal(staged.children.length,2);
 assert.equal(staged.children[0].children[1].alt,'Bierfass · 5 Bier');assert.equal(staged.children[1].children[1].alt,'Weinfass · 5 Gläser');assert.equal(staged.children[1].children[2].textContent,'🍷');
 f.confirm();await wait(()=>f.status('a')==='Gespeichert ✓');const saved=descendants(f.card('a')).find(n=>n.className==='dr-member-glasses');assert.equal(saved,undefined);assert.equal(f.M.totals(f.accounts.get('a')).balance,2550);
});
test('Freiwillige PIN schützt Vormerkung und OK; abgelaufene Freigabe wird vor Übertragung erneut verlangt',async()=>{
 const f=await fixture({pin:true});f.click('a','wine');await wait(()=>f.root.dataset.screen==='pin');f.pin('0000');await wait(()=>f.nodes['dr-error'].textContent.includes('stimmt nicht'));
 assert.equal(f.writes.length,0);f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);assert.equal(f.writes.length,0);
 f.advance(60001);f.confirm();await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.writes.length,0);f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.M.totals(f.accounts.get('a')).balance,300);
});
test('Abbruch einer PIN-Eingabe übernimmt nichts und erhält bereits vorgemerkte Einträge',async()=>{
 const f=await fixture({pin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.nodes['dr-pin-back'].handlers.click();assert.equal(f.nodes['dr-main-confirm'].hidden,true);
 f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);
 f.advance(60001);f.confirm();await wait(()=>f.root.dataset.screen==='pin');f.nodes['dr-pin-back'].handlers.click();assert.match(f.nodes['dr-main-summary'].textContent,/1 Änderung/);assert.equal(f.writes.length,0);
});
test('Mehrere gesperrte Mitglieder werden vor dem gemeinsamen OK nacheinander freigegeben',async()=>{
 const f=await fixture({pin:true,secondPin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);
 f.click('b','wine');await wait(()=>f.root.dataset.screen==='pin');f.pin('7391');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);
 f.advance(60001);f.confirm();await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='pin'&&!f.nodes['dr-pin'].disabled);assert.equal(f.writes.length,0);
 f.pin('7391');await wait(()=>f.status('b')==='Gespeichert ✓');assert.equal(f.writes.length,2);
});
test('Verlorene OK-Antwort wird mit denselben Nummern geprüft, ohne Doppelbuchung oder Rücknahme unklarer Einträge',async()=>{
 const f=await fixture();f.click('a','add');f.click('a','wine');f.loseReply();f.confirm();await wait(()=>f.status('a').includes('nicht bestätigt'));
 assert.equal(f.M.totals(f.accounts.get('a')).balance,450);assert.equal(f.button('a','undo').disabled,true);assert.equal(f.context.Drinks.beforeView('attendanceView'),false);
 f.click('a','retry');await wait(()=>f.status('a')==='Gespeichert ✓');assert.deepEqual(f.writes[0].entries,f.writes[1].entries);assert.equal(f.accounts.get('a').bookings.length,2);
});
test('Teilweise erfolgreicher Gesamtabschluss wiederholt nur unbestätigte Mitglieder',async()=>{
 const f=await fixture();f.click('a','add');f.click('b','wine');f.failMember('b');f.confirm();await wait(()=>f.status('b').includes('nicht bestätigt'));
 assert.equal(f.accounts.get('a').bookings.length,1);assert.equal(f.accounts.get('b').bookings.length,0);f.click('b','retry');await wait(()=>f.status('b')==='Gespeichert ✓');
 assert.deepEqual(f.writes.map(w=>w.id),['a','b','b']);assert.deepEqual(f.writes[1].entries,f.writes[2].entries);assert.equal(f.M.totals(f.accounts.get('a')).balance,150);
});
test('PIN-Änderung während einer Vormerkung verlangt neue Freigabe bei derselben wartenden Sammlung',async()=>{
 const f=await fixture();f.click('a','wine');f.accounts.get('a').pin=await f.M.createPin('4826');f.confirm();await wait(()=>f.status('a').includes('nicht bestätigt'));
 assert.equal(f.accounts.get('a').bookings.length,0);f.click('a','retry');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');assert.deepEqual(f.writes[0].entries,f.writes[1].entries);
});
test('Verbergen beim Speichern entsperrt keine PIN-Karte nach dem Abschluss',async()=>{
 const f=await fixture({pin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);
 const release=f.hold();f.confirm();await wait(()=>f.writes.length===1);f.context.document.hidden=true;f.documentEvents.visibilitychange();release();await wait(()=>f.status('a')==='Gespeichert ✓');assert.match(f.lock('a'),/Zugang mit PIN/);
});
test('Aktualisieren bei unklarem OK behält die Buchungsnummern für die Prüfung',async()=>{
 const f=await fixture();f.click('a','add');f.loseReply();f.confirm();await wait(()=>f.status('a').includes('nicht bestätigt'));await f.context.Drinks.open();
 f.click('a','retry');await wait(()=>f.status('a')==='Gespeichert ✓');assert.deepEqual(f.writes[0].entries,f.writes[1].entries);assert.equal(f.accounts.get('a').bookings.length,1);
});
test('Gespeicherte unbezahlte Tippfehler werden vorgemerkt und erst mit OK zurückgenommen',async()=>{
 const f=await fixture();f.click('a','wine');f.click('a','add');f.confirm();await wait(()=>f.status('a')==='Gespeichert ✓');await wait(()=>!f.button('a','undo').disabled);
 f.click('a','undo');await wait(()=>f.root.dataset.screen==='members'&&!f.button('a','undo').disabled);assert.equal(f.accounts.get('a').bookings.length,2);assert.equal(f.writes.length,1);assert.match(f.nodes['dr-main-summary'].textContent,/1 Änderung/);
 f.click('a','undo');await wait(()=>f.nodes['dr-main-summary'].textContent.includes('2 Änderungen'));assert.equal(f.accounts.get('a').bookings.length,2);
 f.confirm();await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.accounts.get('a').bookings.length,4);assert.equal(f.writes[1].entries[0].cents,150);assert.equal(f.writes[1].entries[1].cents,300);assert.equal(f.M.totals(f.accounts.get('a')).balance,0);
});
test('Verwerfen einer vorgemerkten Rücknahme verändert keine gespeicherte Buchung',async()=>{
 const f=await fixture({balance:true});f.click('a','undo');await wait(()=>f.root.dataset.screen==='members'&&!f.button('a','discard').disabled);f.click('a','discard');await wait(()=>f.nodes['dr-main-confirm'].hidden);
 assert.equal(f.writes.length,0);assert.equal(f.M.totals(f.accounts.get('a')).balance,750);
});
test('Konto zeigt Buchungen und Zugänge; Erfassung erfolgt ausschließlich auf der Hauptseite',async()=>{
 const f=await fixture();f.click('a','account');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-cancel'].disabled);
 assert.equal(f.nodes['dr-add'],undefined);assert.equal(f.nodes['dr-save'],undefined);assert.equal(f.nodes['dr-minus'],undefined);f.nodes['dr-cancel'].handlers.click();assert.equal(f.root.dataset.screen,'members');f.click('a','add');assert.equal(f.writes.length,0);
});
test('Ablehnen von Verwerfen erhält vorgemerkte Einträge beim Verlassen und Aktualisieren',async()=>{
 const f=await fixture();f.click('a','wine');f.discardAllowed(false);assert.equal(f.context.Drinks.beforeView('attendanceView'),false);await f.context.Drinks.open();assert.equal(f.writes.length,0);
 assert.match(f.nodes['dr-main-summary'].textContent,/1 Änderung/);f.confirm();await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.M.totals(f.accounts.get('a')).balance,300);
});
async function payFixtureInFull(f){f.click('a','pay');await wait(()=>f.root.dataset.screen==='payment'&&!f.nodes['dr-cash-all'].disabled);f.nodes['dr-cash-all'].handlers.click();await wait(()=>f.root.dataset.screen==='paid'&&!f.nodes['dr-cash-confirm'].disabled);}
test('Vollzahlung kehrt nach 3 Sekunden zurück, selbst bei fehlender Dankesanimation',async()=>{
 const f=await fixture({balance:true});await payFixtureInFull(f);f.advance(3000);assert.equal(f.root.dataset.screen,'members');assert.equal(f.M.totals(f.accounts.get('a')).balance,0);
});
test('Treuebonus zählt ausschließlich tatsächliche Zahlungen, keine vorgemerkten Getränke',async()=>{
 const policy={schemaVersion:1,id:'program-fixture',revision:'revision-fixture',startedAt:'2026-10-01T00:00:00Z',count:20,cents:300},f=await fixture({balance:true,policy});
 const bonus=()=>descendants(f.card('a')).find(n=>n.className==='dr-member-bonus').textContent;f.click('a','wine');assert.match(bonus(),/30,00/);f.click('a','undo');f.click('a','pay');await wait(()=>f.root.dataset.screen==='payment'&&!f.nodes['dr-partial'].disabled);f.nodes['dr-partial'].handlers.click();await wait(()=>f.root.dataset.screen==='amount');
 f.nodes['dr-amount'].value='5,00';f.nodes['dr-pay-form'].handlers.submit({preventDefault(){}});await wait(()=>f.root.dataset.screen==='cash');f.nodes['dr-cash-confirm'].handlers.click();await wait(()=>f.root.dataset.screen==='paid');
 assert.equal(f.M.totals(f.accounts.get('a')).balance,250);f.nodes['dr-paid-next'].handlers.click();assert.match(bonus(),/25,00/);
});
test('Bezahlung eines PIN-Kontos verlangt PIN und Bestätigung und schreibt erst nach Geld-in-Kasse',async()=>{
 const f=await fixture({balance:true,pin:true});f.click('a','pay');await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.books.length,0);
 f.pin('4826');await wait(()=>f.root.dataset.screen==='payment'&&!f.nodes['dr-partial'].disabled);assert.equal(f.books.length,0);f.nodes['dr-partial'].handlers.click();await wait(()=>f.root.dataset.screen==='amount');f.nodes['dr-amount'].value='5,00';f.nodes['dr-pay-form'].handlers.submit({preventDefault(){}});await wait(()=>f.root.dataset.screen==='cash');assert.equal(f.books.length,0);
 f.nodes['dr-cash-confirm'].handlers.click();await wait(()=>f.root.dataset.screen==='paid');assert.equal(f.M.totals(f.accounts.get('a')).balance,250);
});
test('Handy-QR zeigt sofort Vorbereitung an und wird erst nach geprüftem Zugang gezeichnet',async()=>{
 const f=await fixture();f.click('a','account');await wait(()=>f.root.dataset.screen==='account'&&!f.nodes['dr-mobile-open'].disabled);
 let ready;const link=new Promise(resolve=>ready=resolve);f.context.DrinksMobile={link:async()=>link,status:()=>''};
 f.context.qrcode=()=>({addData(){},make(){},getModuleCount:()=>21,isDark:()=>false});f.nodes['dr-mobile-qr'].getContext=()=>({fillRect(){}});
 f.nodes['dr-mobile-open'].handlers.click();assert.equal(f.root.dataset.screen,'mobile');assert.equal(f.nodes['dr-mobile-qr'].width,1);assert.match(f.nodes['dr-mobile-status'].textContent,/vorbereitet/);
 ready('https://example.invalid/deckel');await wait(()=>f.nodes['dr-mobile-qr'].width>1);assert.equal(f.root.dataset.screen,'mobile');
});
test('Abgelaufene PIN schützt auch das Rückgängigmachen vorgemerkter Einträge',async()=>{
 const f=await fixture({pin:true});f.click('a','wine');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);
 f.advance(60001);f.click('a','undo');await wait(()=>f.root.dataset.screen==='pin');assert.match(f.nodes['dr-main-summary'].textContent,/1 Änderung/);assert.equal(f.writes.length,0);
 f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-pin'].disabled);assert.equal(f.nodes['dr-main-confirm'].hidden,true);assert.equal(f.writes.length,0);
});

test('Eine gleichzeitige Zahlung verhindert die zuvor vorgemerkte Rücknahme, ohne neue Getränke mitzuschreiben',async()=>{
 const f=await fixture({balance:true});f.click('a','undo');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-confirm'].disabled);f.click('a','wine');
 f.accounts.set('a',f.M.append(f.accounts.get('a'),{id:'simultaneous-payment',type:'payment',method:'cash',confirmation:'member',cents:750,createdAt:'2026-10-09T11:30:00Z'}));
 f.confirm();await wait(()=>f.status('a').includes('bereits ganz oder teilweise bezahlt'));assert.equal(f.accounts.get('a').bookings.length,2);assert.equal(f.M.totals(f.accounts.get('a')).balance,0);
 assert.equal(f.button('a','discard').disabled,false);f.click('a','discard');await wait(()=>f.nodes['dr-main-confirm'].hidden);assert.equal(f.accounts.get('a').bookings.length,2);
});
test('Vollständig bezahlte Karten bieten keine Rücknahme gespeicherter Getränke an',async()=>{
 const f=await fixture({balance:true});await payFixtureInFull(f);f.nodes['dr-paid-next'].handlers.click();assert.equal(f.button('a','undo').hidden,true);f.click('a','add');assert.equal(f.button('a','undo').hidden,false);f.click('a','undo');assert.equal(f.button('a','undo').hidden,true);assert.equal(f.accounts.get('a').bookings.length,2);
});
test('Vorgemerkte anzeigen macht Änderungen hinter einer Namenssuche sichtbar',async()=>{
 const f=await fixture();f.click('a','wine');f.nodes['dr-search'].value='Beta';f.nodes['dr-search'].handlers.input();assert.equal(f.card('a'),undefined);assert.ok(f.card('b'));
 f.nodes['dr-staged-only'].handlers.click();assert.equal(f.nodes['dr-search'].value,'');assert.ok(f.card('a'));assert.equal(f.card('b'),undefined);assert.match(f.nodes['dr-main-details'].children[0].textContent,/Alpha.*Glas Wein/);
 f.click('a','undo');assert.equal(f.nodes['dr-main-confirm'].hidden,true);assert.equal(f.nodes['dr-members'].children[0].textContent,'Keine passenden Vormerkungen.');
});
const newPointsPolicy={schemaVersion:2,id:'ui-points-program',revision:'ui-points-revision',startedAt:'2026-10-01T00:00:00Z',thresholdCents:1000,awardUnits:150,beerUnits:150,wineUnits:150};
test('Karten zeigen Punkte getrennt vom eingezahlten Betrag; ausdrückliche Einlösung ist erst mit OK gespeichert',async()=>{
 const f=await fixture({policy:newPointsPolicy,prepaid:1000});const points=descendants(f.card('a')).find(n=>n.className==='dr-member-points');assert.match(points.textContent,/1 Treuepunkt/);assert.match(descendants(f.card('a')).find(n=>n.className==='dr-member-credit').textContent,/10,00/);
 f.click('a','points-wine');assert.equal(f.writes.length,0);assert.match(f.nodes['dr-main-summary'].textContent,/1 Änderung/);assert.equal(f.button('a','points-beer').disabled,true);assert.equal(f.M.rewardState(f.accounts.get('a'),newPointsPolicy).pointUnits,150);
 f.confirm();await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.writes[0].entries[0].pointUnits,150);assert.equal(f.M.totals(f.accounts.get('a')).balance,0);assert.equal(f.M.rewardState(f.accounts.get('a'),newPointsPolicy).pointUnits,0);assert.equal(f.M.rewardState(f.accounts.get('a'),newPointsPolicy).prepaid,1000);assert.equal(f.button('a','undo').hidden,true);
});
test('Geld einzahlen funktioniert bei null Schulden und bestätigt freie Vorauszahlung erst nach Geld-in-Kasse',async()=>{
 const f=await fixture({policy:newPointsPolicy});assert.equal(f.button('a','pay').disabled,true);f.click('a','deposit');await wait(()=>f.root.dataset.screen==='amount'&&!f.nodes['dr-pay-submit'].disabled);f.nodes['dr-amount'].value='20,00';f.nodes['dr-pay-form'].handlers.submit({preventDefault(){}});await wait(()=>f.root.dataset.screen==='cash');assert.equal(f.books.length,0);f.nodes['dr-cash-confirm'].handlers.click();await wait(()=>f.root.dataset.screen==='paid');assert.equal(f.books[0].booking.prepay,true);assert.equal(f.M.rewardState(f.accounts.get('a'),newPointsPolicy).prepaid,2000);assert.equal(f.M.rewardState(f.accounts.get('a'),newPointsPolicy).pointUnits,300);
});
test('Vormerkung und Rücknahme einer Punkteeinlösung verändern den Bestand vor OK nicht',async()=>{
 const f=await fixture({policy:newPointsPolicy,prepaid:1000});f.click('a','points-beer');f.click('a','undo');assert.equal(f.writes.length,0);assert.equal(f.nodes['dr-main-confirm'].hidden,true);assert.equal(f.M.rewardState(f.accounts.get('a'),newPointsPolicy).pointUnits,150);assert.equal(f.button('a','points-wine').disabled,false);
});
test('Im Hintergrund vorbereitete Karten öffnen ohne erneutes Laden aller Mitglieder und Konten',async()=>{
 const f=await fixture({policy:newPointsPolicy});let reads=0,lists=0;f.context.oneDriveSignedIn=()=>true;f.context.oneDriveReadState=async()=>{reads++;return {members:[{id:'a',lastName:'Alpha',firstName:'Mitglied'},{id:'b',lastName:'Beta',firstName:'Mitglied'}]};};f.S.previewRewards=async()=>newPointsPolicy;f.S.list=async()=>{lists++;};f.S.sourceKey=()=> 'drive:root';await f.context.Drinks.preload();assert.equal(reads,1);assert.equal(lists,0);await f.context.Drinks.open();assert.equal(reads,1);assert.equal(lists,0);f.click('a','account');await wait(()=>f.root.dataset.screen==='account');assert.ok(f.readCount()>0,'Einzelkonto wird für Änderungen weiterhin frisch geprüft');
});

test('Karten-OK speichert nur die ausgewählte Karte und hält deren Fokus',async()=>{
 const f=await fixture();f.click('a','add');f.click('b','wine');await f.menu('a');f.click('a','save');await wait(()=>f.status('a')==='Gespeichert ✓');
 assert.equal(f.accounts.get('a').bookings.length,1);assert.equal(f.accounts.get('b').bookings.length,0);assert.match(f.status('b'),/Noch nicht gespeichert/);assert.equal(f.card('a').focused,true);assert.equal(f.card('a').scrolled.block,'start');
});
test('Karten-OK behält seine Auswahl nach abgelaufener PIN',async()=>{
 const f=await fixture({pin:true});f.click('a','add');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>!f.nodes['dr-confirm'].disabled);f.click('b','wine');f.advance(60001);f.click('a','save');await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.accounts.get('b').bookings.length,0);
});
test('Nach Karten-OK bleibt eine zuvor gefilterte Karte sichtbar',async()=>{
 const f=await fixture();f.click('a','wine');f.nodes['dr-staged-only'].handlers.click();await f.menu('a');f.click('a','save');await wait(()=>f.status('a')==='Gespeichert ✓');assert.ok(f.card('a'));assert.equal(f.card('a').focused,true);
});

test('Übersicht zeigt Namenskarten; persönliches Menü enthält nur das gewählte Mitglied',async()=>{
 const f=await fixture();assert.equal(f.nodes['dr-directory'].children.length,2);assert.equal(f.nodes['dr-members'].hidden,true);assert.equal(f.card('a').hidden,true);
 await f.menu('a');assert.equal(f.nodes['dr-directory'].hidden,true);assert.equal(f.card('a').hidden,false);assert.equal(f.card('b').hidden,true);f.click('a','wine');assert.equal(f.nodes['dr-main-confirm'].hidden,true);f.click('a','save');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.card('a').hidden,false);
 f.nodes['dr-all-members'].handlers.click();assert.equal(f.nodes['dr-directory'].hidden,false);assert.equal(f.nodes['dr-members'].hidden,true);assert.equal(f.nodes['dr-directory'].children[0].focused,true);
});
test('Zurück zur Namensübersicht erhält ungespeicherte Eingaben und kennzeichnet das Mitglied',async()=>{
 const f=await fixture();await f.menu('a');f.click('a','add');f.nodes['dr-all-members'].handlers.click();assert.equal(f.writes.length,0);assert.equal(f.nodes['dr-directory'].children[0].dataset.draft,'true');await f.menu('a');assert.match(f.status('a'),/Noch nicht gespeichert/);f.click('a','save');await wait(()=>f.status('a')==='Gespeichert ✓');assert.equal(f.accounts.get('a').bookings.length,1);
});

test('Namensübersicht benötigt keinen Abruf aller Getränkekonten',async()=>{
 const f=await fixture();let lists=0;f.S.list=async()=>{lists++;throw Error('Sammelabruf darf das Öffnen nicht blockieren');};await f.context.Drinks.open();assert.equal(lists,0);await f.menu('a');assert.ok(f.readCount()>0);assert.equal(lists,0);
});
test('Fremde Vormerkungen blockieren die Einzahlung im eigenen Menü nicht',async()=>{
 const f=await fixture();await f.menu('a');f.click('a','add');f.nodes['dr-all-members'].handlers.click();await f.menu('b');assert.equal(f.button('b','deposit').disabled,false);f.click('b','deposit');await wait(()=>f.root.dataset.screen==='amount');assert.equal(f.accounts.get('a').bookings.length,0);
});

test('Freiwillige PIN schützt das Eingabemenü und sperrt nach Inaktivität oder Hintergrund erneut',async()=>{
 const f=await fixture({pin:true});const tile=f.nodes['dr-directory'].children[0];f.nodes['dr-directory'].handlers.click({target:{closest:()=>tile}});await wait(()=>f.root.dataset.screen==='pin');assert.equal(f.card('a').hidden,true);
 f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-pin'].disabled);assert.equal(f.card('a').hidden,false);f.advance(60001);assert.equal(f.root.dataset.screen,'pin');
 f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-pin'].disabled);f.context.document.hidden=true;f.documentEvents.visibilitychange();assert.equal(f.root.dataset.screen,'pin');
});

test('PIN-Abbruch nach abgelaufener Freigabe führt zur Namensübersicht, nicht in die geschützte Karte',async()=>{
 const f=await fixture({pin:true});const tile=f.nodes['dr-directory'].children[0];f.nodes['dr-directory'].handlers.click({target:{closest:()=>tile}});await wait(()=>f.root.dataset.screen==='pin');f.pin('4826');await wait(()=>f.root.dataset.screen==='members'&&!f.nodes['dr-pin'].disabled);f.advance(60001);assert.equal(f.root.dataset.screen,'pin');f.nodes['dr-pin-back'].handlers.click();assert.equal(f.nodes['dr-directory'].hidden,false);assert.equal(f.card('a').hidden,true);assert.equal(f.root.dataset.memberMenu,'false');
});
