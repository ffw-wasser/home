const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(events=[],handler=null){
 const nodes=new Map();class Node{constructor(){this.children=[];this.dataset={};this.hidden=false;this.value='';this.attrs={};this.style={setProperty(){}};}replaceChildren(...n){this.children=n;}append(...n){this.children.push(...n);}setAttribute(k,v){this.attrs[k]=v;}scrollIntoView(){this.scrolled=true;}}
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
 row.children[0].onclick();row.children[0].onclick();assert.equal(row.children[0].children[2].textContent,'2 ×');
 f.get('theater-phone-search').value='essen';f.get('theater-phone-search').oninput();assert.equal(f.get('theater-phone-total').textContent,'Gesamt: 3,00 €');
 f.get('theater-phone-search').value='';f.get('theater-phone-search').oninput();row=card(f);row.children[1].onclick();row.children[1].onclick();row.children[1].onclick();assert.equal(f.get('theater-phone-total').textContent,'Gesamt: 0,00 €');
});
test('Storno erfordert eigenen Modus und lässt sich bis null zurücknehmen',async()=>{
 const f=fixture([catalog]);await f.load();f.get('theater-phone-mode').onclick();let row=card(f);row.children[0].onclick();assert.equal(row.dataset.state,'cancellation');assert.equal(f.get('theater-phone-total').textContent,'Storno gesamt: -1,50 €');
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
