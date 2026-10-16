const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/portal-member.js','utf8');
class Node{
 constructor(tag='div',text=''){this.tagName=tag;this.textContent=text;this.children=[];this.dataset={};this.open=false;this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
 querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tagName===tag?[n]:[]),...n.querySelectorAll(tag)]);}
 querySelector(tag){return this.querySelectorAll(tag)[0];}
}
function fixture(search=''){
 const nodes=new Map(),events=new Node(),find=id=>[events,...events.querySelectorAll('details'),...events.querySelectorAll('article')].find(n=>n.id===id)||nodes.get(id);
 for(const id of ['portal-events','portal-birthday','portal-priority','portal-priority-text'])nodes.set(id,id==='portal-events'?events:new Node());
 const c=vm.createContext({Date,Intl,URLSearchParams,location:{search},deepLinkDone:false,$:id=>find('portal-'+id),node:(tag,text)=>new Node(tag,text),document:{getElementById:find}});
 vm.runInContext(source.slice(source.indexOf(' const evidenceDate'),source.indexOf(' async function refreshEvidence')),c);
 vm.runInContext(source.slice(source.indexOf(' const date='),source.indexOf(' async function api')),c);
 vm.runInContext(source.slice(source.indexOf(' function paint('),source.indexOf(' async function reply')),c);
 return {c,nodes,events};
}
const event=(id,start,status='open')=>({id,title:'Testtermin '+id,start,end:start+60000,status,sessionType:'Sonderprobe'});
test('Nächster Termin bleibt zuerst, danach offene Rückmeldungen, dann beantwortete Termine',()=>{
 const {c}=fixture(),now=Date.now(),list=[event('yes',now+30000,'yes'),event('later',now+50000),event('next',now+10000,'excused'),event('open',now+40000),event('old',now-90000)];
 const sections=c.eventSections(list,now);assert.equal(sections.next.id,'next');assert.deepEqual(Array.from(sections.open,e=>e.id),['open','later']);assert.deepEqual(Array.from(sections.later,e=>e.id),['yes']);assert.equal(list[0].id,'yes');
});
test('Beantwortete Termine sind erreichbar und ihr aufgeklappter Zustand bleibt beim Neuladen erhalten',()=>{
 const f=fixture(),now=Date.now(),result={events:[event('next',now+10000),event('yes',now+20000,'yes')]};f.c.paint(result);
 assert.equal(f.events.querySelectorAll('article')[0].id,'portal-event-next');const later=f.events.querySelector('details');assert.equal(later.open,false);assert.equal(later.querySelector('article').id,'portal-event-yes');later.open=true;f.c.paint(result);assert.equal(f.events.querySelector('details').open,true);
 const cards=f.events.querySelectorAll('article');assert.equal(cards[0].querySelectorAll('button').length,2);assert.equal(cards[1].querySelectorAll('button').length,3);
});
test('Benachrichtigungslink öffnet auch eingeklappte beantwortete Termine',()=>{
 const id='x'.repeat(43),f=fixture('?event='+id),now=Date.now();f.c.paint({events:[event('next',now+10000),event(id,now+20000,'yes')]});assert.equal(f.events.querySelector('details').open,true);assert.equal(f.events.querySelectorAll('article')[1].scrolled,true);
});
test('Nachweishinweis zeigt nur Handlungsbedarf und kennzeichnet einen nicht bestätigten Datenstand',()=>{
 const f=fixture(),box=f.nodes.get('portal-priority'),content=f.nodes.get('portal-priority-text');f.c.evidencePriority([{items:[{label:'G26.3',status:'valid',until:'2099-01-01'}]}]);assert.equal(box.hidden,true);
 f.c.evidencePriority([{items:[{label:'G26.3',status:'expired',until:'2020-01-01'},{label:'FFI',status:'missing'},{label:'Unterweisung AGT',status:'soon',until:'2026-11-01'}]}]);assert.equal(box.hidden,false);assert.equal(box.dataset.state,'expired');assert.equal(content.children.length,3);assert.match(content.children[0].textContent,/Abgelaufen/);assert.match(content.children[1].textContent,/fehlt/);assert.match(content.children[2].textContent,/Bald fällig/);
 f.c.evidencePriority([],'Stand nicht bestätigt');assert.equal(box.dataset.state,'unknown');assert.equal(content.children.length,1);assert.equal(content.children[0].textContent,'Stand nicht bestätigt');f.c.evidencePriority([]);assert.equal(box.hidden,true);assert.equal(content.children.length,0);
});
test('Laufende Termine zeigen keine wirkungslosen Rückmeldeaktionen mehr',()=>{const f=fixture(),now=Date.now();f.c.paint({events:[event('running',now-1000)]});assert.equal(f.events.querySelector('article').querySelectorAll('button').length,0);assert.match(f.events.querySelector('strong').textContent,/geschlossen/);});

test('Fehlender Abgleich und Abruffehler werden im Überblick sichtbar, alte Nachweise bleiben beim Fehler erhalten',async()=>{
 const f=fixture();for(const id of ['portal-evidence','portal-evidence-status','portal-evidence-details'])f.nodes.set(id,new Node());
 f.c.generation=1;f.c.navigator={onLine:true};f.c.api=async()=>({evidence:null});
 vm.runInContext(source.slice(source.indexOf(' async function refreshEvidence'),source.indexOf(' async function refresh(){')),f.c);
 await f.c.refreshEvidence(1);assert.equal(f.nodes.get('portal-priority').hidden,false);assert.match(f.nodes.get('portal-priority-text').children[0].textContent,/Mitgliederabgleich/);
 const previous=new Node('details');f.nodes.get('portal-evidence-details').append(previous);f.c.api=async()=>{throw Error('Offline');};await f.c.refreshEvidence(1);assert.equal(f.nodes.get('portal-evidence-details').children[0],previous);assert.equal(f.nodes.get('portal-priority').dataset.state,'unknown');assert.match(f.nodes.get('portal-evidence-status').textContent,/zuletzt geladene/);
});
test('Verspätete Nachweise eines alten Zugangs erscheinen nicht im neuen Überblick',async()=>{
 const f=fixture();for(const id of ['portal-evidence','portal-evidence-status','portal-evidence-details'])f.nodes.set(id,new Node());let release;f.c.generation=1;f.c.api=()=>new Promise(r=>release=r);
 vm.runInContext(source.slice(source.indexOf(' async function refreshEvidence'),source.indexOf(' async function refresh(){')),f.c);
 const waiting=f.c.refreshEvidence(1);f.c.generation=2;f.c.evidencePriority([]);release({evidence:null});await waiting;assert.equal(f.nodes.get('portal-priority').hidden,true);assert.equal(f.nodes.get('portal-evidence-details').children.length,0);
});

test('Fällige Nachweise erhalten eine sichtbare Anzahl im Menü und einen verständlichen zugänglichen Titel',()=>{
 const f=fixture(),badge=new Node(),heading=new Node(),tab={attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}};
 f.nodes.set('portal-evidence-count',badge);f.nodes.set('portal-priority-heading',heading);f.c.document.querySelector=()=>tab;
 f.c.evidencePriority([{items:[{label:'FFI',status:'soon',until:'2026-11-01'},{label:'G26.3',status:'missing'}]}]);assert.equal(badge.hidden,false);assert.equal(badge.textContent,'2');assert.equal(badge.dataset.state,'missing');assert.equal(heading.textContent,'2 Nachweise prüfen');assert.match(tab.attributes['aria-label'],/2 Nachweise/);assert.match(f.nodes.get('portal-priority-text').children[0].textContent,/G26.3/);
 f.c.evidencePriority([],'Stand unbekannt');assert.equal(badge.textContent,'!');assert.match(heading.textContent,/nicht aktuell geprüft/);
 f.c.evidencePriority([]);assert.equal(badge.hidden,true);assert.equal(tab.attributes['aria-label'],undefined);
});
test('Nachweishinweis öffnet aus anderen Seiten die Nachweisseite und die betroffenen Details',()=>{
 const f=fixture(),calls=[],evidence=new Node('section'),details=new Node(),heading=new Node('h2'),urgent=new Node('section'),valid=new Node('section');urgent.dataset.state='missing';valid.dataset.state='valid';details.append(urgent,valid);details.querySelector=()=>urgent;
 f.nodes.set('portal-evidence',evidence);f.nodes.set('portal-evidence-details',details);f.nodes.set('portal-evidence-heading',heading);f.c.g={DeckelMobile:{jump:id=>calls.push(id)}};f.c.matchMedia=()=>({matches:true});f.c.openEvidence();assert.deepEqual(calls,['portal-evidence']);assert.equal(urgent.scrolled,true);assert.equal(heading.focused,true);
});

test('Automatische Aktualisierung läuft auch auf der eigenen Nachweisseite und pausiert auf dem Deckel',()=>{
 const views=new Map([['portal-page-terms',{hidden:true}],['portal-page-evidence',{hidden:false}]]);let scheduled=0;
 const c=vm.createContext({timer:null,visible:true,document:{hidden:false,getElementById:id=>views.get(id)},clearTimeout(){},refresh(){},setTimeout:(_,delay)=>{assert.equal(delay,60000);scheduled++;return scheduled;}});
 vm.runInContext(source.slice(source.indexOf(' function schedule()'),source.indexOf(' const evidenceDate')),c);c.schedule();assert.equal(scheduled,1);views.get('portal-page-evidence').hidden=true;c.schedule();assert.equal(scheduled,1);
});

test('Nachweise erscheinen vollständig als sichtbare Karten; fällige Gruppen stehen zuerst und Kontrollangaben bleiben erhalten',async()=>{
 const f=fixture();for(const id of ['portal-evidence','portal-evidence-status','portal-evidence-details'])f.nodes.set(id,new Node());
 const groups=[{title:'Arbeitsmedizinische Eignung',status:'valid',items:[{label:'G26.3 (ersetzt G26.2)',status:'valid',until:'2027-12-31',substitution:'Keine zusätzliche G26.2 erforderlich.'}]},{title:'Führerscheinkontrolle',status:'expired',vehicles:['LF','TSF'],items:[{label:'Führerscheinkontrolle',status:'expired',until:'2020-01-01',checkedOn:'2019-01-01',intervalMonths:12}]}];
 f.c.generation=1;f.c.g={MemberEvidence:{assess:()=>groups}};f.c.api=async()=>({evidence:{},syncedAt:1792148400000});f.c.navigator={onLine:true};
 vm.runInContext(source.slice(source.indexOf(' async function refreshEvidence'),source.indexOf(' async function refresh(){')),f.c);await f.c.refreshEvidence(1);
 const area=f.nodes.get('portal-evidence-details'),sections=area.children.filter(n=>n.tagName==='section');assert.equal(sections.length,2);assert.equal(sections[0].dataset.group,'Führerscheinkontrolle');assert.equal(area.querySelectorAll('details').length,0);assert.equal(area.querySelectorAll('article').length,2);
 const paragraphs=area.querySelectorAll('p').map(n=>n.textContent);assert.ok(paragraphs.some(t=>/Abgelaufen am 01.01.2020/.test(t)));assert.ok(paragraphs.some(t=>/Letzte Kontrolle: 01.01.2019/.test(t)));assert.ok(paragraphs.some(t=>/Kontrollintervall: 12 Monate/.test(t)));assert.ok(paragraphs.some(t=>/LF · TSF/.test(t)));assert.ok(paragraphs.includes('Keine zusätzliche G26.2 erforderlich.'));
 assert.ok(area.querySelectorAll('span').some(n=>n.textContent==='× Abgelaufen'));assert.ok(area.querySelectorAll('span').some(n=>n.textContent==='✓ Gültig'));assert.equal(sections[0].querySelectorAll('h4').length,0);assert.equal(f.nodes.get('portal-priority').dataset.state,'expired');
});
