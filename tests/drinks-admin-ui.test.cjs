const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const read=name=>fs.readFileSync(require.resolve('../js/features/drinks/'+name),'utf8');
async function fixture(){
 const nodes=new Map();
 class Node{constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.open=false;this.checked=false;this.classList={add(){}};}set innerHTML(value){for(const m of value.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Node());}append(...values){for(const n of values){this.children.push(n);if(n.id)nodes.set(n.id,n);}}replaceChildren(){this.children=[];}querySelector(){return new Node();}addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}}
 const main=new Node(),body=new Node(),calls=[];nodes.set('drinksSettingsBookingsCard',new Node());let account,fail=false;
 const c=vm.createContext({console,Date,crypto:webcrypto,TextEncoder,adminUnlocked:true,byId:id=>nodes.get(id),requireAdmin:()=>c.adminUnlocked,showView:()=>c.adminUnlocked,showToast(){},oneDriveReadState:async()=>({members:[{id:'private-member',firstName:'Privater',lastName:'Name'}]}),document:{readyState:'complete',createElement:tag=>new Node(tag),querySelector:()=>main,body}});c.window=c;vm.runInContext(read('drinks-model.js'),c);const M=c.DrinksModel;
 account=M.append(M.empty('private-member'),{id:'private-wine-entry',type:'drinks',drink:'wine',count:1,cents:300,createdAt:'2026-10-09T10:00:00Z'});account=M.append(account,{id:'private-cash-entry',type:'payment',method:'cash',confirmation:'member',cents:300,createdAt:'2026-10-09T10:01:00Z'});
 c.DrinksStore={read:async()=>structuredClone(account),sourceKey:()=> 'drive:root',adminDelete:async(id,entry,source)=>{if(!c.adminUnlocked)throw Error('Administration gesperrt');calls.push({id,entry:structuredClone(entry),source});account=M.append(account,entry);if(fail){fail=false;throw new TypeError('Connection lost');}return structuredClone(account);}};
 vm.runInContext(read('drinks-bookings-admin.js'),c);await nodes.get('drinksSettingsBookingsCard').children[0].onclick();nodes.get('dr-admin-member').value='private-member';await nodes.get('dr-admin-member').onchange();
 return {c,nodes,calls,account:()=>account,failNext:()=>fail=true};
}
test('Admin-Löschen zeigt geprüfte Buchung, verlangt Bestätigung und prüft verlorene Antwort mit derselben Nummer',async()=>{
 const f=await fixture(),list=f.nodes.get('dr-admin-list');const row=list.children.find(n=>n.children[0].children[0].textContent.startsWith('1 Glas Wein'));await row.children.at(-1).onclick();assert.equal(f.nodes.get('dr-admin-dialog').open,true);assert.match(f.nodes.get('dr-admin-preview').textContent,/3,00/);
 const form=f.nodes.get('dr-admin-form');await form.onsubmit({preventDefault(){}});assert.equal(f.calls.length,0);f.nodes.get('dr-admin-checked').checked=true;f.failNext();await form.onsubmit({preventDefault(){}});
 assert.equal(f.calls.length,1);assert.equal(f.nodes.get('dr-admin-close').disabled,true);assert.equal(f.nodes.get('dr-admin-member').disabled,true);assert.match(f.nodes.get('dr-admin-delete-status').textContent,/denselben Vorgang/);
 await form.onsubmit({preventDefault(){}});assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(f.calls[0].source,'drive:root');assert.equal(f.account().bookings.length,3);assert.equal(f.nodes.get('dr-admin-dialog').open,false);assert.equal(f.c.DrinksModel.totals(f.account()).count,0);
});
test('Admin-Sperre entfernt Buchungsanzeige und Dialogdaten und verhindert erneute Löschung',async()=>{
 const f=await fixture(),row=f.nodes.get('dr-admin-list').children[0];await row.children.at(-1).onclick();f.c.adminUnlocked=false;f.c.DrinksAdminBookings.lock();assert.equal(f.nodes.get('dr-admin-dialog').open,false);assert.equal(f.nodes.get('dr-admin-list').children.length,0);assert.equal(f.nodes.get('dr-admin-person').textContent,'');assert.equal(f.nodes.get('dr-admin-reason').value,'');
 f.nodes.get('dr-admin-checked').checked=true;await f.nodes.get('dr-admin-form').onsubmit({preventDefault(){}});assert.equal(f.calls.length,0);
});
