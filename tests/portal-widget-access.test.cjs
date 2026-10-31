const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/portal-member.js','utf8');
function fixture(status,{replaceAccess=false,network=false,background=false,otherIdentity=false}={}){
 const messages=[],access={origin:'https://synthetic.invalid',capability:'synthetic',alias:'synthetic',revision:'synthetic'};
 const c=vm.createContext({access,AbortSignal,H2OIdentity:{session:()=>({...access,...(otherIdentity?{alias:'other-identity'}:{})})},syncNativeWidget:value=>messages.push(value),fetch:async()=>{if(replaceAccess)c.access={...access};if(background)c.access=null;if(network)throw new TypeError('Load failed');return {ok:false,status,json:async()=>({error:'Synthetic failure'})};}});
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

for(const status of [401,403])test('Zugriffsverlust nach Home-Wechsel löscht den Stand derselben Identität: '+status,async()=>{
 const f=fixture(status,{background:true});await assert.rejects(f.c.api('list'));assert.deepEqual(f.messages,[null]);
});
test('Verspäteter Zugriffsverlust überschreibt keine andere Identität im Hintergrund',async()=>{
 const f=fixture(401,{background:true,otherIdentity:true});await assert.rejects(f.c.api('list'));assert.deepEqual(f.messages,[]);
});
