const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(events=[],handler=null){
 const nodes=new Map();class Node{constructor(){this.children=[];this.dataset={};this.hidden=false;this.value='';this.attrs={};this.style={setProperty(){}};}replaceChildren(...n){this.children=n;}append(...n){this.children.push(...n);}insertBefore(n,b){this.children.splice(this.children.indexOf(b),0,n);}setAttribute(k,v){this.attrs[k]=v;}scrollIntoView(){this.scrolled=true;}}
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const c=vm.createContext({document:{readyState:'complete',getElementById:get,createElement:()=>new Node()},addEventListener(){},sessionStorage:{setItem(){},getItem(){return null;}},H2OPortal:{api:async(path,data)=>handler?handler(path,data):({events})},crypto:require('node:crypto').webcrypto,Intl,confirm:()=>true});
 vm.runInContext(fs.readFileSync('js/features/theater/theater-model.js','utf8'),c);
 vm.runInContext(fs.readFileSync('js/features/theater/theater-phone.js','utf8'),c);
 return {get,load:()=>get('theater-phone-refresh').onclick()};
}
test('Leere Theaterliste bleibt auch beim wiederholten Laden ein gültiger Leerzustand',async()=>{
 const f=fixture();for(let n=0;n<2;n++){await f.load();assert.match(f.get('theater-phone-status').textContent,/keine Theater-Veranstaltung geöffnet/);assert.equal(f.get('theater-phone-confirm').disabled,true);}
});
const catalog={id:'test-event',version:1,title:'Testveranstaltung',items:[{id:'test-item',name:'Testartikel',category:'Getränke',cents:150,active:true},{id:'food',name:'Testessen',category:'Essen',cents:500,active:true}]};
const card=f=>f.get('theater-phone-items').children[0].children[1].children[0];
test('Kachel addiert, Minus stoppt bei null, Suche erhält die Menge',async()=>{
 const f=fixture([catalog]);await f.load();let row=card(f);assert.equal(row.children[1].disabled,true);row.children[1].onclick();assert.equal(row.dataset.state,'empty');
 row.children[0].onclick();row.children[0].onclick();assert.equal(row.children[0].children[3].textContent,'2 ×');
 f.get('theater-phone-search').value='essen';f.get('theater-phone-search').oninput();assert.equal(f.get('theater-phone-total').textContent,'2 Artikel · 3,00 €');
 f.get('theater-phone-search').value='';f.get('theater-phone-search').oninput();row=card(f);row.children[1].onclick();row.children[1].onclick();row.children[1].onclick();assert.equal(f.get('theater-phone-total').textContent,'Gesamt: 0,00 €');
});
test('Storno erfordert eigenen Modus und lässt sich bis null zurücknehmen',async()=>{
 const f=fixture([catalog]);await f.load();f.get('theater-phone-mode').onclick();let row=card(f);row.children[0].onclick();assert.equal(row.dataset.state,'cancellation');assert.equal(f.get('theater-phone-total').textContent,'Storno · 1 Artikel · -1,50 €');
 f.get('theater-phone-mode').onclick();assert.equal(f.get('theater-phone-mode').attrs['aria-pressed'],'true');assert.match(f.get('theater-phone-status').textContent,/zuerst die aktuelle Auswahl/);
 row.children[1].onclick();f.get('theater-phone-mode').onclick();assert.equal(f.get('theater-phone-mode').attrs['aria-pressed'],'false');
});
test('Unklare Übertragung sperrt Kacheln und wiederholt dieselbe Bestellkennung',async()=>{
 const requests=[];const f=fixture([catalog],async(path,data)=>{if(path==='theater/events')return {events:[catalog]};requests.push(data);if(requests.length===1)throw Error('Verbindung unterbrochen');return {ok:true,id:data.requestId};});
 await f.load();card(f).children[0].onclick();await f.get('theater-phone-confirm').onclick();assert.equal(card(f).children[0].disabled,true);assert.equal(f.get('theater-phone-mode').disabled,true);
 await f.get('theater-phone-confirm').onclick();assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(f.get('theater-phone-total').textContent,'Gesamt: 0,00 €');
});
test('Kassenmeldungen erreichen auch den Vollbildstatus',()=>{
 const source=fs.readFileSync('js/features/theater/theater-admin.js','utf8'),nodes={status:{},'manage-status':{},'cash-status':{}};
 const message=vm.runInNewContext(source.slice(source.indexOf(' function message('),source.indexOf(' function guard('))+';message',{$:id=>nodes[id]});
 message('Verbindung unterbrochen.');for(const node of Object.values(nodes))assert.equal(node.textContent,'Verbindung unterbrochen.');
});

test('Leere Karten zeigen weder Menge noch Minus; Leeren entfernt nur die ungesendete Auswahl',async()=>{
 const f=fixture([catalog]);await f.load();let row=card(f);
 assert.equal(row.children[1].hidden,true);assert.equal(row.children[0].children[3].hidden,true);assert.equal(f.get('theater-phone-discard').hidden,true);
 row.children[0].onclick();row.children[0].onclick();assert.equal(row.children[1].hidden,false);assert.equal(row.children[0].children[3].hidden,false);assert.equal(f.get('theater-phone-total').textContent,'2 Artikel · 3,00 €');
 f.get('theater-phone-discard').onclick();row=card(f);assert.equal(row.dataset.state,'empty');assert.equal(f.get('theater-phone-confirm').disabled,true);assert.equal(f.get('theater-phone-discard').hidden,true);
});
test('Unbestätigte Bestellung kann auch durch direkten Aufruf nicht geleert werden',async()=>{
 const f=fixture([catalog],async(path)=>{if(path==='theater/events')return {events:[catalog]};throw Error('Offline');});await f.load();card(f).children[0].onclick();await f.get('theater-phone-confirm').onclick();
 assert.equal(f.get('theater-phone-discard').hidden,true);f.get('theater-phone-discard').onclick();assert.equal(f.get('theater-phone-total').textContent,'1 Artikel · 1,50 €');assert.equal(f.get('theater-phone-confirm').textContent,'Übertragung erneut prüfen');
});

test('Getränkekarte trennt Artikel, Gefäß und Größe; Essen hat keine Gebindezeile',async()=>{const f=fixture([{...catalog,items:[{...catalog.items[0],name:'Testwasser · Flasche · 0,5 l'},catalog.items[1]]}]);await f.load();const drink=card(f).children[0];assert.equal(drink.children[0].children[0].textContent,'Testwasser');assert.equal(drink.children[1].textContent,'Flasche · 0,5 l');const food=f.get('theater-phone-items').children[1].children[1].children[0].children[0];assert.equal(food.children.length,3);});

test('Mobile Bestellübersicht korrigiert die Mengen vor dem Absenden',async()=>{
 const f=fixture([catalog]);await f.load();
 assert.equal(f.get('theater-phone-selection').hidden,true);
 card(f).children[0].onclick();card(f).children[0].onclick();
 assert.equal(f.get('theater-phone-selection').hidden,false);
 assert.equal(f.get('theater-phone-selection-count').textContent,'2 Artikel');
 let row=f.get('theater-phone-selection-items').children[0];
 assert.equal(row.children[1].children[1].textContent,'2 ×');
 row.children[1].children[0].onclick();
 assert.equal(f.get('theater-phone-total').textContent,'1 Artikel · 1,50 €');
 row=f.get('theater-phone-selection-items').children[0];
 row.children[1].children[2].onclick();
 assert.equal(f.get('theater-phone-total').textContent,'2 Artikel · 3,00 €');
 row=f.get('theater-phone-selection-items').children[0];
 row.children[1].children[0].onclick();
 f.get('theater-phone-selection-items').children[0].children[1].children[0].onclick();
 assert.equal(f.get('theater-phone-selection').hidden,true);
 assert.equal(f.get('theater-phone-confirm').disabled,true);
});
