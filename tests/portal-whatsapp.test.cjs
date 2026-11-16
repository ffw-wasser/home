const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/portal-member.js','utf8'),context=vm.createContext({Intl,Date,Number,encodeURIComponent});
vm.runInContext(source.slice(source.indexOf(' function whatsappTermLink('),source.indexOf(' function paint(')),context);
test('WhatsApp teilt Berliner Terminzeit und öffentlichen Link ohne persönliche Zugänge',()=>{
 const event={id:'a'.repeat(43),title:'Probe: Funk & Atemschutz',start:Date.UTC(2026,10,20,18,30),location:'GH Wasser',token:'secret-token',alias:'private-person',status:'excused',subscriptionUrl:'https://example.test/secret'};
 const url=new URL(context.whatsappTermLink(event)),text=url.searchParams.get('text');assert.equal(url.origin,'https://wa.me');assert.ok(text.startsWith('📣 *BITTE ABSTIMMEN*\n🚒 Feuerwehr Wasser · *'));assert.match(text,/20\.11\.2026.*19:30 Uhr/);assert.match(text,/Funk & Atemschutz/);assert.match(text,/📍 GH Wasser/);assert.ok(text.endsWith('https://ffw-wasser.github.io/home/termin.html?event='+event.id));assert.doesNotMatch(text,/secret|private-person|excused/);
});
test('Ganztägige Termine enthalten keine erfundene Uhrzeit; ungültige Links werden abgelehnt',()=>{
 const event={id:'b'.repeat(43),start:Date.UTC(2026,10,20),allDay:true};const text=new URL(context.whatsappTermLink(event)).searchParams.get('text');assert.match(text,/ganztägig/);assert.doesNotMatch(text,/Uhr/);assert.throws(()=>context.whatsappTermLink({...event,id:'?token=secret'}));
});
test('Teilen erscheint erst in geladener Rückmeldungsübersicht und ausschließlich für GF',async()=>{
 class Element{constructor(tag,text){this.tag=tag;this.textContent=text;this.children=[];this.dataset={};}append(...children){this.children.push(...children);}prepend(child){this.children.unshift(child);}replaceChildren(...children){this.children=children;}setAttribute(){}addEventListener(){}showModal(){this.open=true;}}
 for(const [leader,fitnessTrainer,allowed] of [[true,false,true],[false,false,false],[false,true,false],[true,true,false]]){
  const c=vm.createContext({Intl,Date,Number,encodeURIComponent,g:{},date:()=> 'Freitag · 19:30 Uhr',generation:1,latestResult:{leader,fitnessTrainer},overviewDialog:null,overviewRequest:0,node:(tag,text)=>new Element(tag,text),document:{body:new Element('body'),createElementNS:(_,tag)=>new Element(tag)},api:async()=>({members:[],event:{id:'a'.repeat(43),title:'Probe',start:Date.now()+86400000}})});
  vm.runInContext(source.slice(source.indexOf(' function whatsappTermLink('),source.indexOf(' function paint(')),c);
  vm.runInContext(source.slice(source.indexOf(' function closeOverview('),source.indexOf(' function responseBadge(')),c);
  await c.showOverview({id:'a'.repeat(43),title:'Probe',start:Date.now()+86400000});
  function find(n){return n.className==='portal-whatsapp-share'||n.children.some(find);}
  assert.equal(find(c.overviewDialog),allowed);
 }
 assert.doesNotMatch(source.slice(source.indexOf(' function paint('),source.indexOf(' function updateReplyCard(')),/whatsappShareButton|portal-whatsapp-share/);
});
