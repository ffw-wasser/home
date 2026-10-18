const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/theater/theater-admin.js','utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(){
 const nodes=new Map(),messages=[],get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,setAttribute(){},classList:{toggle(){}},focus(){}});return nodes.get(id);};
 const c=vm.createContext({busy:false,loading:false,epoch:0,mode:'manage',dirty:false,current:null,draft:{items:[{id:'old'}]},selectedMember:'person',timer:null,
  $:get,document:{querySelector:()=>get('nav'),getElementById:get},window:{scrollTo(){}},clearTimeout(){},structuredClone,crypto:require('node:crypto').webcrypto,
  g:{TheaterImport:{read:async()=>[{id:'new'}]}},confirm:()=>true,message:m=>messages.push(m),controls(){},schedule(){},paintEditor(){},updateUnsaved(){},load(){},paintCash(){}});
 vm.runInContext(section(' async function run(',' async function load(')+section(' async function importCatalog(',' function openTab(')+section(' function edit(',' function paintCategoryColors(')+section(' function route(',' function lock(')+section(' function selectCash(',' function orderTime('),c);
 return {c,get,messages};
}
test('Laufende Schreibaktionen verhindern Seitenwechsel und Wechsel der Theateransicht',()=>{
 const f=fixture();f.c.busy=true;f.c.dirty=true;
 assert.equal(f.c.beforeView('eventsView'),false);
 assert.equal(f.c.setMode('cash'),false);
 assert.equal(f.c.dirty,true);assert.equal(f.c.mode,'manage');
 f.c.busy=false;f.c.confirm=()=>false;
 assert.equal(f.c.beforeView('eventsView'),false);assert.equal(f.c.setMode('stats'),false);
 assert.equal(f.c.selectedMember,'person');assert.equal(f.c.dirty,true);
 f.c.confirm=()=>true;assert.equal(f.c.beforeView('eventsView'),true);assert.equal(f.c.dirty,false);
});
test('Kassenkarten sind beim automatischen Lesen weiter antippbar, während Schreiben bleiben sie gesperrt',()=>{
 const f=fixture();f.c.loading=true;f.c.selectCash('new-person');assert.equal(f.c.selectedMember,'new-person');
 f.c.busy=true;f.c.selectCash('other');assert.equal(f.c.selectedMember,'new-person');
});
test('Abgelehnter und fehlgeschlagener Import verändern weder Artikelliste noch Speicherstatus',async()=>{
 for(const failure of [false,true]){
  const f=fixture(),original=f.c.draft.items;f.c.confirm=()=>false;
  if(failure)f.c.g.TheaterImport.read=async()=>{throw Error('Datei ungültig');};
  await f.c.importCatalog({target:{files:[{}]}});
  assert.equal(f.c.draft.items,original);assert.equal(f.c.dirty,false);assert.equal(f.c.busy,false);
 }
});
test('Import sperrt konkurrierende Aktionen und kennzeichnet erst die übernommene Vorschau als geändert',async()=>{
 const f=fixture();let resolve;f.c.g.TheaterImport.read=()=>new Promise(r=>resolve=r);
 const request=f.c.importCatalog({target:{files:[{}]}});
 assert.equal(f.c.busy,true);assert.equal(f.c.beforeView('eventsView'),false);
 resolve([{id:'imported'}]);await request;
 assert.equal(f.c.draft.items[0].id,'imported');assert.equal(f.c.dirty,true);assert.equal(f.c.busy,false);
});
test('Später Import darf nach Sperren der Verwaltung keinen anderen Entwurf überschreiben',async()=>{
 const f=fixture();let resolve;f.c.g.TheaterImport.read=()=>new Promise(r=>resolve=r);
 const request=f.c.importCatalog({target:{files:[{}]}});
 f.c.epoch++;f.c.draft={items:[{id:'other'}]};resolve([{id:'imported'}]);await request;
 assert.equal(f.c.draft.items[0].id,'other');assert.equal(f.c.dirty,false);
});
test('Auch die erste Veranstaltung ohne Vorjahr besitzt eine gültige Kennung',()=>{
 const f=fixture();f.c.edit();assert.match(f.c.draft.id,/^[A-Za-z0-9_-]{1,80}$/);assert.equal(f.c.draft.version,0);assert.equal(f.c.draft.open,false);
});
