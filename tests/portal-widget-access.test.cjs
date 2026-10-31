const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/portal-member.js','utf8');
function fixture(status,{replaceAccess=false,network=false}={}){
 const messages=[],access={origin:'https://synthetic.invalid',capability:'synthetic',alias:'synthetic',revision:'synthetic'};
 const c=vm.createContext({access,AbortSignal,syncNativeWidget:value=>messages.push(value),fetch:async()=>{if(replaceAccess)c.access={...access};if(network)throw new TypeError('Load failed');return {ok:false,status,json:async()=>({error:'Synthetic failure'})};}});
 vm.runInContext(source.slice(source.indexOf(' async function api('),source.indexOf(' function controls(')),c);
 return {c,messages};
}
for(const status of [401,403])test('Widgetdaten bei erkanntem Zugriffsverlust löschen: '+status,async()=>{
 const f=fixture(status);await assert.rejects(f.c.api('reply'),e=>e.status===status);assert.deepEqual(f.messages,[null]);
});
for(const status of [409,503])test('Konflikt oder Dienstausfall löscht keinen bestätigten Widgetstand: '+status,async()=>{
 const f=fixture(status);await assert.rejects(f.c.api('reply'));assert.deepEqual(f.messages,[]);
});
test('Eine alte fehlgeschlagene Anfrage löscht keine neue Mitgliedersitzung',async()=>{
 const f=fixture(401,{replaceAccess:true});await assert.rejects(f.c.api('list'));assert.deepEqual(f.messages,[]);
});
test('Ein Netzfehler bewahrt den zeitlich begrenzten Widgetstand',async()=>{
 const f=fixture(0,{network:true});await assert.rejects(f.c.api('list'));assert.deepEqual(f.messages,[]);
});

test('Android widget bridge transfers only the authorized next event as JSON',()=>{
 const sent=[],next={title:'Synthetische Übung',start:123,end:456,status:'yes',location:'GH Wasser',clothing:'Einsatz',memberName:'PRIVATE',capability:'SECRET'};
 const c=vm.createContext({H2OWidget:{postMessage:raw=>sent.push(JSON.parse(raw))},eventSections:()=>({next})});
 vm.runInContext(source.slice(source.indexOf(' function syncNativeWidget('),source.indexOf(' function paint(')),c);
 c.syncNativeWidget({events:[next],stale:false,memberName:'PRIVATE',capability:'SECRET'});
 assert.deepEqual(sent,[{action:'update',stale:false,event:{title:next.title,start:123,end:456,allDay:false,location:'GH Wasser',clothing:'Einsatzkleidung',status:'yes'}}]);
 c.syncNativeWidget(null);assert.deepEqual(sent.at(-1),{action:'clear'});
 c.eventSections=()=>({next:null});c.syncNativeWidget({events:[],stale:true});assert.deepEqual(sent.at(-1),{action:'empty',stale:true});
 assert.doesNotMatch(JSON.stringify(sent),/PRIVATE|SECRET|capability|memberName/);
});
