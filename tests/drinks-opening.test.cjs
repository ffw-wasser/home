const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/features/drinks/drinks.js'),'utf8');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
class Node{
  constructor(){this.children=[];this.dataset={};this.value='';this.hidden=false;this.textContent='';this.handlers={};this.classList={toggle(){},add(){}};this.style={setProperty(){}};}
  addEventListener(type,handler){this.handlers[type]=handler;}
  replaceChildren(){this.children=[];}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(){} focus(){} removeAttribute(){}
  querySelector(){return null;}
  querySelectorAll(){return [];}
}
async function fixture(){
  const nodes={};for(const match of html.matchAll(/id="([^"]+)"/g))nodes[match[1]]=new Node();
  const root=nodes.drinksView,person=new Node(),screens=['members','opening','pin','account'].map(value=>{const node=new Node();node.dataset.drScreen=value;return node;});
  root.querySelectorAll=selector=>selector==='[data-dr-screen]'?screens:selector==='[data-dr-person]'?[person]:selector==='[data-dr-member]'?nodes['dr-members'].children:[];
  let resolve,reject,reads=0;const read=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const account={pin:null,bookings:[]};
  const context=vm.createContext({console,innerHeight:844,setTimeout:()=>1,clearTimeout(){},
    byId:id=>nodes[id],showView(){root.hidden=false;return true;},showToast(){},
    oneDriveReadState:async()=>({members:[{id:'a',lastName:'Test',firstName:'Mitglied'}]}),
    document:{hidden:false,createElement:()=>new Node(),addEventListener(){}},
    DrinksModel:{PRICE:150,WINE_PRICE:300,pointText:()=>'0',today:()=>({count:0,beerCount:0,wineCount:0}),totals:()=>({balance:0,count:0})},
    DrinksStore:{cached:()=>account,rewards:async()=>null,list:async()=>[],read:()=>{reads++;return read;}},
    addEventListener(){},scrollTo(){}});
  context.window=context;vm.runInContext(source,context);await context.Drinks.open();
  const choose=()=>nodes['dr-members'].handlers.click({target:{closest:()=>({dataset:{drMember:'a'}})}});
  return {nodes,root,person,choose,resolve,reject,reads:()=>reads};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Namensauswahl zeigt sofort Ladeansicht und verhindert doppelte Abfragen',async()=>{
  const f=await fixture();f.choose();assert.equal(f.root.dataset.screen,'opening');assert.equal(f.person.textContent,'Test Mitglied');
  assert.equal(f.nodes['dr-mobile-open'].disabled,true);f.choose();assert.equal(f.reads(),1);
  f.resolve({pin:null,bookings:[]});await flush();assert.equal(f.root.dataset.screen,'account');assert.equal(f.nodes['dr-mobile-open'].disabled,false);
});
test('Geschütztes Konto öffnet nach dem Laden die PIN-Eingabe',async()=>{
  const f=await fixture();f.choose();f.resolve({pin:{hash:'fixture'},bookings:[]});await flush();assert.equal(f.root.dataset.screen,'pin');
});
test('Abruffehler führt zur Namensauswahl zurück und erklärt die erneute Auswahl',async()=>{
  const f=await fixture();f.choose();f.reject(new Error('OneDrive nicht erreichbar.'));await flush();
  assert.equal(f.root.dataset.screen,'members');assert.match(f.nodes['dr-status'].textContent,/erneut wählen/);assert.match(f.nodes['dr-error'].textContent,/OneDrive/);
});
