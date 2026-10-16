const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(events=[]){
 const nodes=new Map();class Node{constructor(){this.children=[];this.dataset={};this.hidden=false;}replaceChildren(...n){this.children=n;}append(...n){this.children.push(...n);}setAttribute(){}}
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const c=vm.createContext({document:{readyState:'complete',getElementById:get,createElement:()=>new Node()},addEventListener(){},sessionStorage:{setItem(){},getItem(){return null;}},H2OPortal:{api:async()=>({events})},Intl,confirm:()=>true});
 vm.runInContext(fs.readFileSync('js/features/theater/theater-model.js','utf8'),c);
 vm.runInContext(fs.readFileSync('js/features/theater/theater-phone.js','utf8'),c);
 return {get,load:()=>get('theater-phone-refresh').onclick()};
}
test('Leere Theaterliste bleibt auch beim wiederholten Laden ein gültiger Leerzustand',async()=>{
 const f=fixture();for(let n=0;n<2;n++){await f.load();assert.match(f.get('theater-phone-status').textContent,/keine Theater-Veranstaltung geöffnet/);assert.equal(f.get('theater-phone-confirm').disabled,true);}
});
test('Negative Handy-Auswahl wird sichtbar als Storno bezeichnet',async()=>{
 const f=fixture([{id:'test-event',version:1,title:'Testveranstaltung',items:[{id:'test-item',name:'Testartikel',category:'Getränke',cents:150,active:true}]}]);await f.load();
 f.get('theater-phone-items').children[1].children[0].onclick();
 const row=f.get('theater-phone-items').children[1];assert.equal(row.dataset.state,'cancellation');assert.match(row.children[1].children[1].textContent,/Storno: -1/);assert.equal(f.get('theater-phone-total').textContent,'Gesamt: -1,50 €');
});
test('Kassenmeldungen erreichen auch den Vollbildstatus',()=>{
 const source=fs.readFileSync('js/features/theater/theater-admin.js','utf8'),nodes={status:{},'manage-status':{},'cash-status':{}};
 const message=vm.runInNewContext(source.slice(source.indexOf(' function message('),source.indexOf(' function guard('))+';message',{$:id=>nodes[id]});
 message('Verbindung unterbrochen.');for(const node of Object.values(nodes))assert.equal(node.textContent,'Verbindung unterbrochen.');
});
