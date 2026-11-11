const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/calendar-google-admin.js','utf8');
const tick=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
class Node{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.disabled=false;this.value='';}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 insertBefore(node,before){node.parent=this;this.children.splice(this.children.indexOf(before),0,node);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 setAttribute(){}addEventListener(){}showModal(){}focus(){}
 get elements(){return this.children.flatMap(n=>[...(['input','textarea','button'].includes(n.tag)?[n]:[]),...n.elements]);}
 all(){return [this,...this.children.flatMap(n=>n.all())];}
}
async function fixture(){
 const mutation=deferred(),imported=deferred(),requests=[],body=new Node('body'),clears=[],reloads=[],event={id:'synthetic-google-event',etag:'"v1"',summary:'Synthetic exercise',description:'',location:'GH Wasser',start:{dateTime:'2026-11-12T18:00:00Z'},end:{dateTime:'2026-11-12T20:00:00Z'}};
 const c=vm.createContext({Date,URL,location:{href:'https://synthetic.invalid/index.html'},epoch:1,editor:null,editing:false,saving:false,access:{expiresAt:Date.now()+60000},role:'writer',node:(tag,text)=>new Node(tag,text),localTime:value=>value.slice(0,16),document:{body},g:{confirm:()=>true,PortalAdmin:{calendarEventDeleted:()=>clears.push(true)},CalendarSidebar:{clear:()=>clears.push(true)}},api:async action=>{if(action==='resolve')return {event};requests.push(action);return mutation.promise;},request:async(path,data)=>{requests.push({path,data});return imported.promise;}});
 vm.runInContext(source.slice(source.indexOf(' function cancel()'),source.indexOf(' function button('))+source.slice(source.indexOf(' async function openEditor('),source.indexOf(' async function mount(')),c);
 await c.openEditor({id:'synthetic-h2o-event'},snapshot=>reloads.push(snapshot));
 const dialog=c.editor,button=text=>dialog.all().find(n=>n.tag==='button'&&n.textContent===text),statusNode=dialog.children.find(n=>n.tag==='p'&&n.textContent===''),status=()=>statusNode;
 return {c,mutation,imported,requests,clears,reloads,dialog,button,status};
}
test('Google-Löschung bestätigt erst nach Google, entsperrt aber vor dem langsamen Kalenderimport',async()=>{
 const f=await fixture(),deleting=f.button('Google-Termin löschen').onclick();
 assert.equal(f.c.saving,true);assert.equal(f.button('Schließen').disabled,true);assert.equal(f.requests.length,1);assert.equal(f.status().textContent.includes('in Google Kalender gelöscht.'),false);
 f.mutation.resolve({ok:true});await deleting;
 assert.equal(f.c.saving,false);assert.equal(f.button('Schließen').disabled,false);assert.match(f.status().textContent,/in Google Kalender gelöscht.*Hintergrund/);
 assert.equal(f.clears.length,1);assert.equal(f.requests.length,2);assert.equal(f.requests[1].data.force,true);assert.equal(f.reloads.length,0);
 const fresh={stale:false,events:[]};f.imported.resolve(fresh);await tick();assert.equal(f.reloads[0],fresh,'die Ansicht verwendet den bestätigten Import ohne einen zweiten Listenabruf');
});
test('Bestätigte Löschung lässt sich vor Ende des Imports schließen; späterer Fehler wird abgefangen',async()=>{
 const f=await fixture(),deleting=f.button('Google-Termin löschen').onclick();f.mutation.resolve({ok:true});await deleting;
 f.button('Schließen').onclick();assert.equal(f.c.editor,null);assert.equal(f.dialog.parent.children.includes(f.dialog),false);
 f.imported.reject(Error('Synthetischer Importfehler'));await tick();assert.equal(f.c.saving,false);assert.equal(f.reloads.length,0);
});
test('Fehlgeschlagene Google-Löschung bleibt im Editor korrigierbar und startet keinen Import',async()=>{
 const f=await fixture(),deleting=f.button('Google-Termin löschen').onclick();f.mutation.reject(Error('Synthetisch: Löschung abgewiesen'));await deleting;
 assert.equal(f.c.saving,false);assert.equal(f.button('Google-Termin löschen').disabled,false);assert.equal(f.requests.length,1);assert.equal(f.clears.length,0);assert.match(f.status().textContent,/Löschung abgewiesen/);
});
test('Verwaltungssperre während des Hintergrundimports verhindert eine spätere Anzeigeaktualisierung',async()=>{
 const f=await fixture(),deleting=f.button('Google-Termin löschen').onclick();f.mutation.resolve({ok:true});await deleting;
 f.c.epoch++;f.imported.resolve({stale:false,events:[]});await tick();assert.equal(f.reloads.length,0);
});

test('Importfehler widerruft keine bestätigte Google-Löschung und bietet keine zweite Löschung an',async()=>{
 const f=await fixture(),deleting=f.button('Google-Termin löschen').onclick();f.mutation.resolve({ok:true});await deleting;
 f.imported.reject(Error('Synthetischer Importfehler'));await tick();assert.match(f.status().textContent,/in Google Kalender gelöscht.*nicht aktualisiert/);
 assert.equal(f.button('Google-Termin löschen'),undefined);assert.equal(f.button('Schließen').disabled,false);assert.equal(f.requests.filter(r=>r==='delete').length,1);
});

test('Hintergrundaktualisierung der Kalenderverwaltung bewahrt neu geöffnete oder bearbeitete Karten',async()=>{
 const admin=fs.readFileSync('js/features/portal/portal-admin.js','utf8');
 for(const dirty of ['groupsDirty','reviewEdited','reviewOpen','groupEditing','google']){
  const c=vm.createContext({reviewControls(){},g:{CalendarDisplayAdmin:{dirty:()=>false},GoogleCalendarAdmin:{dirty:()=>dirty==='google'}},groupsDirty:dirty==='groupsDirty',reviewEdited:new Set(dirty==='reviewEdited'?['synthetic']:[]),reviewOpen:new Set(dirty==='reviewOpen'?['synthetic']:[]),groupEditing:dirty==='groupEditing'?'synthetic':null});
  vm.runInContext(admin.slice(admin.indexOf(' async function reviewCalendar('),admin.indexOf(' let invitationTimer=')),c);
  await c.reviewCalendar({snapshot:{events:[]},preserveEdits:true});
 }
});
