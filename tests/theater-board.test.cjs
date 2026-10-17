const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const admin=fs.readFileSync('js/features/theater/theater-admin.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('css/features/theater.css','utf8');
const start=admin.indexOf(' function orderTime(');
const end=admin.indexOf(' function paintCash(){',start);
assert.ok(start>=0&&end>start,'Kassen-Hilfsfunktionen vorhanden');
const {orderTime,orderAge,boardMembers}=vm.runInNewContext(admin.slice(start,end)+';({orderTime,orderAge,boardMembers})',{Date,Math,Number,String,Map});
const now=Date.UTC(2026,9,16,20,0);
const order=(member,state,createdAt,name=member)=>({member,name,state,createdAt});
test('Neue Bestellungen kommen nach jüngster Eingangszeit zuerst, reservierte dahinter',()=>{
 const list=[order('old','open',now-30*60000),order('reserved','reserved',now-5*60000),order('new','open',now-60000),order('iso','open',new Date(now-10000).toISOString()),order('new','done',now+999999)];
 assert.deepEqual(Array.from(boardMembers(list)),['iso','new','old','reserved']);
});
test('Eine spätere neue Bestellung bringt denselben Mitgliedsdeckel nach vorne',()=>{
 const list=[order('alex','open',now-300000),order('bea','open',now-100000),order('alex','open',now-10000)];
 assert.deepEqual(Array.from(boardMembers(list)),['alex','bea']);
});
test('Zeitwerte als Millisekunden, Zahlentext und ISO werden korrekt erkannt',()=>{
 assert.equal(orderTime(order('a','open',now)),now);
 assert.equal(orderTime(order('a','open',String(now))),now);
 assert.equal(orderTime(order('a','open',new Date(now).toISOString())),now);
 assert.equal(orderTime(order('a','open',null)),0);
 assert.equal(orderAge(now-5*60000,now),'vor 5 Min.');
 assert.equal(orderAge(now-61*60000,now),'vor 1 Std.');
});
test('Kassen-Vollbild verdeckt bei ausgeblendeter Theateransicht keine App-Bereiche',()=>{
 assert.match(css,/#theaterView\.theater-cash-fullscreen\[hidden\]\s*\{\s*display:none!important/);
 assert.match(admin,/if\(mode==='cash'\)setMode\('manage'\)/);
});
test('Verwaltung enthält eindeutig zugeordnete Bedienfelder und Tonsteuerung',()=>{
 const panel=html.slice(html.indexOf('<article id="theater-manage"'),html.indexOf('</article>',html.indexOf('<article id="theater-manage"'))+10);
 for(const id of ['theater-save','theater-new','theater-sound','theater-reset','theater-title','theater-import']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' ist eindeutig');
  assert.ok(panel.includes('id="'+id+'"'),id+' in Verwaltung');
 }
 assert.equal((panel.match(/class="theater-manage-section"/g)||[]).length,4);
 assert.match(html,/data-theater-tab="manage" aria-pressed="true"/);
});
test('Geänderter Theater-JavaScript-Code ist syntaktisch gültig',()=>{
 assert.doesNotThrow(()=>new vm.Script(admin));
});

test('Kassenkarten behalten bei Live-Aktualisierung dieselben Schaltflächen und Positionen',()=>{
 class N{
  constructor(tag='div',txt=''){this.tagName=tag;this.textContent=txt;this.children=[];this.hidden=false;this.dataset={};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;this.redraws=(this.redraws||0)+1;}
  get firstChild(){return this.children[0];}
  querySelector(selector){return this.children.find(n=>selector==='.theater-board-card'&&n.className==='theater-board-card')||null;}
 }
 const els=new Map(),get=id=>{if(!els.has(id))els.set(id,new N());return els.get(id);};
 const fake=vm.createContext({Date,Math,Number,String,Map,JSON,orders:[
  {member:'a',name:'Person A',state:'open',createdAt:now-100000,lines:[{cents:150,quantity:1}]},
  {member:'b',name:'Person B',state:'open',createdAt:now-200000,lines:[{cents:200,quantity:1}]}
 ],current:{id:'event-1',title:'Theater',open:true},selectedMember:null,cashCards:new Map(),cashOrder:[],cashEventId:null,detailSignature:'',
 $:get,node:(tag,txt)=>new N(tag,txt),button:(txt,fn)=>{const n=new N('button',txt);n.onclick=fn;return n;},
 M:{money:n=>String(n)+' Cent',total:lines=>lines.reduce((total,line)=>total+line.cents*line.quantity,0)},
 controls(){},crypto:{randomUUID:()=> 'id'}});
 const start=admin.indexOf(' function selectCash('),end=admin.indexOf(' async function mutate(',start);
 assert.ok(start>0&&end>start);
 vm.runInContext(admin.slice(start,end)+';paintCash()',fake);
 const board=get('cards'),before=board.children.slice(),oldRedraws=board.redraws;
 vm.runInContext('paintCash()',fake);
 assert.equal(board.children[0],before[0]);assert.equal(board.children[1],before[1]);assert.equal(board.redraws,oldRedraws,'Identische Abfrage darf Karten nicht ersetzen');
 fake.orders.unshift({member:'c',name:'Person C',state:'open',createdAt:now,lines:[{cents:350,quantity:1}]});
 vm.runInContext('paintCash()',fake);
 assert.equal(board.children[0],before[0]);assert.equal(board.children[1],before[1]);assert.equal(board.children[2].dataset.member,'c');
 fake.orders.unshift({member:'a',name:'Person A',state:'open',createdAt:now+1000,lines:[{cents:150,quantity:1}]});
 vm.runInContext('paintCash()',fake);
 assert.equal(board.children[0],before[0]);
 assert.equal(board.children[1],before[1]);
 assert.equal(board.children[2].dataset.member,'c');
});
