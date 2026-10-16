const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/theater/theater-admin.js','utf8');
function fixture(){
 class Node{constructor(tag,text){this.tag=tag;this.textContent=text;this.children=[];this.dataset={};this.style={setProperty(){}};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}focus(){}scrollIntoView(){}querySelectorAll(selector){return this.children.flatMap(n=>[...(selector==='input'?n.tag==='input':selector==='button:not(:disabled)'?n.tag==='button'&&!n.disabled:n.className===selector.slice(1))?[n]:[],...n.querySelectorAll(selector)]);}querySelector(s){return this.querySelectorAll(s)[0];}}
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node('div'));return nodes.get(id);};
 const ctx=vm.createContext({node:(tag,text)=>new Node(tag,text),$:get,document:{querySelectorAll:()=>[]},crypto:require('node:crypto').webcrypto,draft:{items:[{id:'water',name:'Wasser',category:'Getränke',cents:200,active:true},{id:'food',name:'Brezel',category:'Essen',cents:150,active:true},{id:'juice',name:'Saft',category:'Getränke',cents:300,active:true}]},busy:false,loading:false,dirty:false,message(){}});
 vm.runInContext(fs.readFileSync('js/features/theater/theater-model.js','utf8'),ctx);ctx.M=ctx.TheaterModel;
 vm.runInContext(source.slice(source.indexOf(' function button('),source.indexOf(' function schedule('))+source.slice(source.indexOf(' function moveTarget('),source.indexOf(' // Reads never'))+source.slice(source.indexOf(' function paintCategoryColors('),source.indexOf(' async function save(')),ctx);
 vm.runInContext('paintEditor()',ctx);return {ctx,get,rows:()=>get('editor').querySelectorAll('.theater-edit-row')};
}
test('Verwaltung gruppiert Artikel und verschiebt sie nur innerhalb ihrer Rubrik',()=>{
 const f=fixture();assert.equal(f.get('editor').children.length,2);assert.deepEqual(f.get('editor').children.map(g=>g.dataset.category),['Getränke','Essen']);
 vm.runInContext('moveItem("juice",-1)',f.ctx);assert.deepEqual(Array.from(f.ctx.draft.items,p=>p.id),['juice','food','water']);assert.deepEqual(f.get('editor').children[0].children.slice(1).map(r=>r.dataset.itemId),['juice','water']);assert.equal(f.ctx.dirty,true);
 vm.runInContext('moveItem("juice",-1)',f.ctx);assert.equal(f.ctx.draft.items[0].id,'juice');
});
test('Rubrikwechsel erhält Eingaben und gruppenspezifisches Hinzufügen nutzt die gewählte Rubrik',()=>{
 const f=fixture(),row=f.rows().find(r=>r.dataset.itemId==='water'),inputs=row.querySelectorAll('input');inputs[2].value='2,80';inputs[2].oninput();inputs[1].value='Essen';inputs[1].oninput();inputs[1].onchange();
 assert.equal(f.ctx.draft.items[0].centsRaw,'2,80');const group=f.get('editor').children.find(g=>g.dataset.category==='Essen');assert.deepEqual(group.children.slice(1).map(r=>r.dataset.itemId),['water','food']);
 group.children[0].children[1].onclick();assert.equal(f.ctx.draft.items.at(-1).category,'Essen');assert.equal(f.ctx.draft.items.at(-1).name,'Neuer Artikel');
});

test('Gefäß und Gebinde bleiben beim Speichern im kompatiblen Artikelnamen erhalten',()=>{const f=fixture(),row=f.rows().find(r=>r.dataset.itemId==='water'),details=row.children.at(-1);const vessel=details.children[0].children[0],size=details.children[1].children[0];vessel.value='Flasche';vessel.onchange();size.value='0,5 l';size.oninput();assert.equal(f.ctx.draft.items[0].name,'Wasser · Flasche · 0,5 l');vm.runInContext('paintEditor()',f.ctx);const fresh=f.rows().find(r=>r.dataset.itemId==='water');assert.equal(fresh.children[0].children[0].value,'Wasser');assert.equal(fresh.children.at(-1).children[0].children[0].value,'Flasche');assert.equal(f.rows().find(r=>r.dataset.itemId==='food').children.some(n=>n.className==='theater-edit-serving'),false);});
