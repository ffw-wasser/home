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
 const c=vm.createContext({Date,Intl,URLSearchParams,location:{search},deepLinkDone:false,busy:false,pending:null,$:id=>find('portal-'+id),node:(tag,text)=>new Node(tag,text),document:{getElementById:find}});
 vm.runInContext(source.slice(source.indexOf(' const evidenceDate'),source.indexOf(' async function refreshEvidence')),c);
 vm.runInContext(source.slice(source.indexOf(' const date='),source.indexOf(' async function api')),c);
 vm.runInContext(source.slice(source.indexOf(' function responseBadge('),source.indexOf(' async function reply')),c);
 return {c,nodes,events};
}
const event=(id,start,status='open')=>({id,title:'Testtermin '+id,start,end:start+60000,status,sessionType:'Sonderprobe'});
test('Alle Termine bleiben unabhängig von der Antwort chronologisch; abgelaufene entfallen',()=>{
 const {c}=fixture(),now=Date.now(),list=[event('yes',now+30000,'yes'),event('later',now+50000),event('next',now+10000,'excused'),event('open',now+40000),event('old',now-90000)];
 const sections=c.eventSections(list,now);assert.equal(sections.next.id,'next');assert.deepEqual(Array.from(sections.ordered,e=>e.id),['next','yes','open','later']);assert.equal(list[0].id,'yes');
});
test('Zusage, Entschuldigung und erneutes Antippen verschieben oder verstecken keine Karte',()=>{
 const f=fixture(),now=Date.now(),result={events:[event('next',now+10000),event('reply',now+20000),event('later',now+30000)]};
 for(const answer of ['open','yes','excused','maybe','open']){result.events[1].status=answer;f.c.paint(result);const cards=f.events.querySelectorAll('article');assert.deepEqual(cards.map(c=>c.id),['portal-event-next','portal-event-reply','portal-event-later']);assert.equal(cards[1].dataset.status,answer);assert.equal(f.events.querySelectorAll('details').length,0);assert.equal(f.events.children[0].className,'portal-first-event');assert.equal(cards[1].querySelectorAll('button').filter(b=>b.dataset.reply).length,3);}
});
test('Erneutes Tippen nimmt nur die ausgewählte Antwort zurück und bietet keine eigene Zurücknehmen-Taste',()=>{
 const f=fixture(),e=event('reply',Date.now()+60000,'yes'),writes=[];f.c.reply=(ev,value)=>writes.push([ev.id,value]);
 const result={uncertainReplies:true,events:[e]};f.c.paint(result);
 let buttons=f.events.querySelector('article').querySelectorAll('button').filter(b=>b.dataset.reply);
 assert.deepEqual(buttons.map(b=>b.dataset.reply),['yes','excused','maybe']);
 buttons.find(b=>b.dataset.reply==='yes').onclick();
 buttons.find(b=>b.dataset.reply==='excused').onclick();
 e.status='maybe';f.c.paint(result);buttons=f.events.querySelector('article').querySelectorAll('button').filter(b=>b.dataset.reply);
 buttons.find(b=>b.dataset.reply==='maybe').onclick();
 assert.deepEqual(writes,[['reply','open'],['reply','excused'],['reply','open']]);
});
test('Benachrichtigungslink scrollt weiterhin direkt zum beantworteten Termin',()=>{
 const id='x'.repeat(43),f=fixture('?event='+id),now=Date.now();f.c.paint({events:[event('next',now+10000),event(id,now+20000,'yes')]});assert.equal(f.events.querySelectorAll('details').length,0);assert.equal(f.events.querySelectorAll('article')[1].scrolled,true);
});
test('Nur der erste Termin erhält eine Überschrift, unsichere Antwort bleibt als eigene Karte sichtbar',()=>{
 const f=fixture(),now=Date.now();f.c.paint({uncertainReplies:true,events:[event('next',now+10000,'maybe'),event('later',now+20000)]});
 assert.equal(f.events.querySelectorAll('h2').filter(n=>n.textContent==='Nächster Termin').length,1);assert.equal(f.events.children[0].children[0].className,'portal-next-heading');assert.equal(f.events.querySelector('article').querySelectorAll('span').some(n=>n.textContent==='Nächster Termin'),false);
 const card=f.events.querySelector('article');assert.equal(card.dataset.status,'maybe');assert.equal(card.querySelectorAll('strong').find(n=>n.className.startsWith('portal-answer')).textContent,'');assert.equal(card.querySelectorAll('button').find(b=>b.dataset.reply==='maybe').textContent,'Unsicher');
});
test('Kurze Beschriftung der Rückmeldeübersicht behält die Gruppenführer-Berechtigung',()=>{
 const f=fixture(),events=[event('next',Date.now()+10000)];f.c.paint({events,leader:false});assert.equal(f.events.querySelectorAll('details').length,0);
 f.c.paint({events,leader:true});assert.equal(f.events.querySelectorAll('button').find(n=>n.className==='portal-overview-open').textContent,'Rückmeldungen ansehen');
});

test('Nachweishinweis zeigt nur Handlungsbedarf und kennzeichnet einen nicht bestätigten Datenstand',()=>{
 const f=fixture(),box=f.nodes.get('portal-priority'),content=f.nodes.get('portal-priority-text');f.c.evidencePriority([{items:[{label:'G26.3',status:'valid',until:'2099-01-01'}]}]);assert.equal(box.hidden,true);
 f.c.evidencePriority([{items:[{label:'G26.3',status:'expired',until:'2020-01-01'},{label:'FFI',status:'missing'},{label:'Unterweisung AGT',status:'soon',until:'2026-11-01'}]}]);assert.equal(box.hidden,false);assert.equal(box.dataset.state,'expired');assert.equal(content.children.length,3);assert.match(content.children[0].textContent,/Abgelaufen/);assert.match(content.children[1].textContent,/fehlt/);assert.match(content.children[2].textContent,/Bald fällig/);
 f.c.evidencePriority([],'Stand nicht bestätigt');assert.equal(box.dataset.state,'unknown');assert.equal(content.children.length,1);assert.equal(content.children[0].textContent,'Stand nicht bestätigt');f.c.evidencePriority([]);assert.equal(box.hidden,true);assert.equal(content.children.length,0);
});
test('Laufende Termine zeigen keine wirkungslosen Rückmeldeaktionen mehr',()=>{const f=fixture(),now=Date.now();f.c.paint({events:[event('running',now-1000)]});assert.equal(f.events.querySelector('article').querySelectorAll('button').filter(b=>b.dataset.reply).length,0);assert.match(f.events.querySelectorAll('strong').find(n=>n.className.startsWith('portal-answer')).textContent,/geschlossen/);});

test('Fehlender Abgleich und Abruffehler werden im Überblick sichtbar, alte Nachweise bleiben beim Fehler erhalten',async()=>{
 const f=fixture();for(const id of ['portal-evidence','portal-evidence-status','portal-evidence-details'])f.nodes.set(id,new Node());
 f.c.generation=1;f.c.navigator={onLine:true};f.c.api=async()=>({evidence:null});
 vm.runInContext(source.slice(source.indexOf(' async function refreshEvidence'),source.indexOf(' async function refresh(')),f.c);
 await f.c.refreshEvidence(1);assert.equal(f.nodes.get('portal-priority').hidden,false);assert.match(f.nodes.get('portal-priority-text').children[0].textContent,/Mitgliederabgleich/);
 const previous=new Node('details');f.nodes.get('portal-evidence-details').append(previous);f.c.api=async()=>{throw Error('Offline');};await f.c.refreshEvidence(1);assert.equal(f.nodes.get('portal-evidence-details').children[0],previous);assert.equal(f.nodes.get('portal-priority').dataset.state,'unknown');assert.match(f.nodes.get('portal-evidence-status').textContent,/zuletzt geladene/);
});
test('Verspätete Nachweise eines alten Zugangs erscheinen nicht im neuen Überblick',async()=>{
 const f=fixture();for(const id of ['portal-evidence','portal-evidence-status','portal-evidence-details'])f.nodes.set(id,new Node());let release;f.c.generation=1;f.c.api=()=>new Promise(r=>release=r);
 vm.runInContext(source.slice(source.indexOf(' async function refreshEvidence'),source.indexOf(' async function refresh(')),f.c);
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

 const E=require('../js/features/portal/member-evidence.js');f.c.generation=1;f.c.g={MemberEvidence:E};f.c.api=async()=>({evidence:E.project({g263ValidUntil:'2035-12-31',machinistVehicles:['LF','TSF'],driverLicenseCheckedOn:'2019-01-01',driverLicenseIntervalMonths:12}),syncedAt:1792148400000});f.c.navigator={onLine:true};
 vm.runInContext(source.slice(source.indexOf(' async function refreshEvidence'),source.indexOf(' async function refresh(')),f.c);await f.c.refreshEvidence(1);
 assert.match(f.nodes.get('portal-evidence-status').textContent,/Datenstand: [^\n]+\nVorwarnung: 60 Tage\./);
 const area=f.nodes.get('portal-evidence-details'),sections=area.children.filter(n=>n.tagName==='section');assert.equal(sections.length,2);assert.equal(sections[0].dataset.group,'Führerscheinkontrolle');assert.equal(area.querySelectorAll('details').length,0);assert.equal(area.querySelectorAll('article').length,2);assert.ok(area.querySelectorAll('p').some(n=>n.textContent==='✓ G26.2 durch gültige G26.3 abgedeckt.'));
 const paragraphs=area.querySelectorAll('p').map(n=>n.textContent);assert.ok(paragraphs.some(t=>/Abgelaufen am 01.01.2020/.test(t)));assert.ok(paragraphs.some(t=>/Letzte Kontrolle: 01.01.2019/.test(t)));assert.ok(paragraphs.some(t=>/Kontrollintervall: 12 Monate/.test(t)));assert.ok(paragraphs.some(t=>/LF · TSF/.test(t)));assert.ok(paragraphs.some(t=>t.includes('keine zusätzliche G26.2 erforderlich.')));
 assert.ok(area.querySelectorAll('span').some(n=>n.textContent==='× Abgelaufen'));assert.ok(area.querySelectorAll('span').some(n=>n.textContent==='✓ Gültig'));assert.equal(sections[0].querySelectorAll('h4').length,0);assert.equal(f.nodes.get('portal-priority').dataset.state,'expired');
});

test('Terminkarte ordnet Thema vor Datum an und zeigt Ort und Kleidung kompakt',()=>{
 const f=fixture();f.c.paint({events:[{...event('test',Date.now()+60000),title:'Technische Hilfe',location:'GH Wasser',clothing:'Einsatz'}]});
 const info=f.events.querySelector('article').children[0];
 assert.equal(info.children[0].className,'portal-event-badges');assert.equal(info.children[1].tagName,'h3');assert.equal(info.children[1].textContent,'Technische Hilfe');assert.equal(info.children[2].className,'portal-event-date');
 const rows=info.querySelectorAll('p').filter(n=>n.className==='portal-event-meta');assert.deepEqual(rows.map(n=>n.children[1].textContent),['GH Wasser','Einsatzkleidung']);
});
test('Rückmeldungsdialog bleibt getrennt und verwirft verspätete Antworten nach Schließen',async()=>{
 const body=new Node(),make=(tag,text)=>{const n=new Node(tag,text);n.addEventListener=()=>{};n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;};return n;};
 let resolve;const c=vm.createContext({node:make,document:{body},generation:1,g:{},api:()=>new Promise(r=>resolve=r)});
 vm.runInContext(source.slice(source.indexOf(' let overviewDialog='),source.indexOf(' function paint(')),c);
 const first=c.showOverview({id:'test',title:'Testprobe'}),dialog=body.children[0];assert.equal(dialog.open,true);c.closeOverview();resolve({members:[{status:'yes',name:'Testperson'}]});await first;assert.equal(dialog.open,false);assert.equal(dialog.querySelectorAll('h3').length,0);
 const second=c.showOverview({id:'test',title:'Testprobe'});resolve({members:[{status:'yes',name:'Testperson'}]});await second;
 assert.equal(body.children.length,1);assert.equal(dialog.querySelectorAll('h3')[0].textContent,'Zugesagt (1)');assert.ok(dialog.querySelectorAll('p').some(n=>n.textContent==='Testperson'));
});

test('Ärztliche Untersuchungen erscheinen getrennt; gültige G26.3 erzeugt keinen zusätzlichen G26.2-Alarm',()=>{
 const f=fixture(),E=require('../js/features/portal/member-evidence.js'),now=Date.parse('2026-10-18T12:00:00Z');f.c.g={MemberEvidence:E};
 const e=E.project({breathingQualified:true,g263ValidUntil:'2027-10-31',agtInstructionValidUntil:'2027-01-01',ffiValidUntil:'2027-02-01'}),before=JSON.stringify(e),groups=f.c.evidenceGroups(e,now);
 assert.equal(groups[0].title,'Ärztliche Untersuchung');assert.equal(groups[0].items.length,2);
 assert.deepEqual(Array.from(groups[0].items,i=>i.label),['G26.2 – ohne Belastungstest','G26.3 – mit Belastungstest']);
 assert.equal(groups[0].items[0].status,'covered');assert.equal(groups[0].items[1].status,'valid');
 assert.match(groups[1].items[0].label,/Sicherheitsunterweisung/);assert.match(groups[1].items[1].label,/FitFirefighterIndex/);
 for(const item of groups[1].items){assert.match(item.description,/Emmendingen/);assert.match(item.description,/einmal jährlich/);}
 f.c.evidencePriority(groups);assert.equal(f.nodes.get('portal-priority').hidden,true);assert.equal(JSON.stringify(e),before);
});
test('G26.2 reicht weiterhin nicht für Atemschutz; optionale G26.3 erzeugt bei anderen keinen Fehlalarm',()=>{
 const f=fixture(),E=require('../js/features/portal/member-evidence.js'),now=Date.parse('2026-10-18T12:00:00Z');f.c.g={MemberEvidence:E};
 let groups=f.c.evidenceGroups(E.project({breathingQualified:true,g262ValidUntil:'2028-01-01'}),now);
 assert.equal(groups[0].status,'missing');assert.equal(groups[0].items[1].status,'missing');
 groups=f.c.evidenceGroups(E.project({breathingQualified:false,g262ValidUntil:'2028-01-01'}),now);
 assert.equal(groups[0].status,'valid');assert.equal(groups[0].items[1].status,'optional');f.c.evidencePriority(groups);assert.equal(f.nodes.get('portal-priority').hidden,true);
 groups=f.c.evidenceGroups(E.project({}),now);assert.equal(groups[0].items[0].status,'missing');assert.equal(groups[0].items[1].status,'optional');
});

test('Heutige Termine zeigen Heute und behalten Uhrzeit beziehungsweise ganztägig',()=>{
 const f=fixture(),Base=Date;f.c.Date=class extends Base{static now(){return Base.parse('2026-10-19T08:00:00Z');}};
 const today={...event('today',Date.parse('2026-10-19T17:00:00Z'))};f.c.paint({events:[today]});
 const when=f.events.querySelector('article').children[0].children[2];assert.match(when.children[0].children[0].children[0].textContent,/^Heute · /);assert.equal(f.events.querySelectorAll('strong').find(n=>n.className==='portal-event-clock').textContent,'19:00 Uhr');
 f.c.testEvent={...today,allDay:true};assert.equal(vm.runInContext('date(testEvent)',f.c),'Heute · ganztägig');
});
test('Heute richtet sich nach dem Berliner Kalendertag, auch über die UTC-Tagesgrenze',()=>{
 const f=fixture(),Base=Date;
 for(const [now,today,next] of [['2026-10-18T22:30:00Z','2026-10-19T21:30:00Z','2026-10-19T22:00:00Z'],['2026-12-18T23:30:00Z','2026-12-19T22:30:00Z','2026-12-19T23:00:00Z']]){
  f.c.Date=class extends Base{static now(){return Base.parse(now);}};
  assert.equal(f.c.eventDayLabel({start:Base.parse(today)}),'Heute');assert.notEqual(f.c.eventDayLabel({start:Base.parse(next)}),'Heute');
 }
});
test('Nach Tageswechsel zeigt derselbe Termin wieder sein Datum',()=>{
 const f=fixture(),Base=Date,termin={start:Base.parse('2026-10-19T17:00:00Z')};
 f.c.Date=class extends Base{static now(){return Base.parse('2026-10-19T20:00:00Z');}};assert.equal(f.c.eventDayLabel(termin),'Heute');
 f.c.Date=class extends Base{static now(){return Base.parse('2026-10-19T22:01:00Z');}};assert.match(f.c.eventDayLabel(termin),/19.10.2026/);
});


// Card text must not change the actual event, shared links or calendar export.
test('Terminkarten kürzen nur eine wiederholte Terminart vor dem Thema',()=>{
 const f=fixture();
 for(const [type,title,expected] of [
  ['Sonderprobe','Sonderprobe GF + Ausschuss','GF + Ausschuss'],
  ['Probe','Allgemeine Probe · Technische Hilfe','Technische Hilfe'],
  ['Sonderprobe','Sonderprobe – Sonderprobe: Atemschutz','Atemschutz'],
  ['Probe','Probe','Probe'],
  ['Probe','   ','Probe'],
  ['','   ','Termin'],
  ['Probe','Allgemeine Probe','Probe'],
  ['Probe','Probebetrieb der Pumpe','Probebetrieb der Pumpe'],
  ['Probe','Funkprobe und Nachbesprechung','Funkprobe und Nachbesprechung'],
  ['Unterricht','Unterricht: Funk','Funk'],
  ['Anderes','Probe: Funk','Probe: Funk']
 ]){const e={...event('topic',Date.now()+60000),sessionType:type,title};f.c.paint({events:[e]});assert.equal(f.events.querySelector('article').querySelector('h3').textContent,expected);assert.equal(e.title,title);}
 f.c.paint({events:[{...event('simple',Date.now()+60000),sessionType:'Probe',title:'Probe'}]});
 assert.equal(f.events.querySelectorAll('div').filter(n=>n.className==='portal-event-badges').length,1);
});


test('Wochenblatt markiert nur weitere persönliche Termine derselben Berliner Woche, auch am selben Tag',()=>{
 const {c}=fixture(),current=event('current',Date.parse('2026-10-25T09:00:00Z')),others=[current,event('same',Date.parse('2026-10-25T10:00:00Z')),event('monday',Date.parse('2026-10-18T22:30:00Z')),event('outside',Date.parse('2026-10-25T23:30:00Z'))],week=c.calendarWeek(current,others);
 assert.deepEqual(Array.from(week.days,d=>d.iso),['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']);assert.equal(week.days[6].selected,true);assert.equal(week.days[6].otherCount,1);assert.equal(week.days[0].otherCount,1);assert.equal(week.otherCount,2);assert.equal(c.calendarWeek(current,[current]).otherCount,0);
});
test('Wochenblatt bleibt am Jahreswechsel und beim Beginn der Sommerzeit korrekt',()=>{
 const {c}=fixture();for(const [stamp,first,last] of [['2027-01-01T09:00Z','2026-12-28','2027-01-03'],['2026-03-29T09:00Z','2026-03-23','2026-03-29']]){const e=event('test',Date.parse(stamp)),w=c.calendarWeek(e,[e]);assert.equal(w.days[0].iso,first);assert.equal(w.days[6].iso,last);assert.equal(w.days.filter(d=>d.selected).length,1);}
});


test('Zusage wird allein durch Auswahl angezeigt; die Uhrzeit bleibt die Startzeit der jeweiligen Karte',()=>{
 const f=fixture(),start=Date.now()+86400000,events=[event('one',start,'yes'),event('two',start+3*3600000,'excused')];f.c.paint({events});const cards=f.events.querySelectorAll('article');const rows=cards[0].querySelectorAll('p').filter(n=>n.className==='portal-event-meta'||n.className==='portal-event-meta portal-event-time');assert.equal(rows[0].children[1].textContent,'GH Wasser');assert.equal(rows[1].className,'portal-event-meta portal-event-time');assert.equal(cards[0].querySelectorAll('strong').find(n=>n.className==='portal-answer portal-answer-yes').textContent,'');for(let i=0;i<events.length;i++){const expected=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(events[i].start))+' Uhr';assert.equal(cards[i].querySelectorAll('strong').find(n=>n.className==='portal-event-clock').textContent,expected);}
});


test('Wochenblatt zeigt wieder den Wochenzeitraum und hebt genau einen Termintag ohne Zusatzbeschriftung hervor',()=>{
 const {c}=fixture(),current=event('current',Date.parse('2026-11-24T15:30:00Z'));
 const others=[current,event('monday',Date.parse('2026-11-23T18:00:00Z')),event('saturday',Date.parse('2026-11-28T18:00:00Z'))];
 for(const status of ['open','yes','excused','maybe']){
  current.status=status;const {day}=c.weekView(current,others),heading=day.children[0],cells=day.children[1].children;
  assert.equal(heading.textContent,c.calendarWeek(current,others).heading);
  assert.equal(heading.dataset.compact,c.calendarWeek(current,others).compact);
  assert.equal(cells.filter(cell=>cell.className.includes('is-event-day')).length,1);
  assert.equal(cells[1].querySelector('strong').textContent,'24');
  assert.equal(cells[1].children.length,2);assert.equal(day.querySelectorAll('span').some(n=>n.className==='portal-calendar-event-marker'),false);
  assert.equal(cells[0].children.length,2);assert.equal(cells[5].children.length,2);
 }
});


test('Monatsmarke zeigt den Berliner Monat des Termins, auch an Monatsgrenzen',()=>{
 const {c}=fixture();for(const [start,label] of [['2026-10-26T18:00:00Z','Okt'],['2026-10-31T23:30:00Z','Nov'],['2026-12-31T23:30:00Z','Jan']])assert.equal(c.eventMonthLabel(event('month',Date.parse(start))),label);
});

test('Terminmarkierung zählt nur angeforderte offene Antworten und verschwindet nach Bestätigung oder Terminbeginn',()=>{
 const f=fixture(),badge=new Node(),tile={attributes:{},setAttribute(k,v){this.attributes[k]=v;}};f.nodes.set('portal-response-count',badge);f.c.document.querySelector=()=>tile;
 const future=Date.now()+60000,events=[{...event('open',future),responseRequested:true},{...event('maybe',future,'maybe'),responseRequested:true},{...event('yes',future,'yes'),responseRequested:true},{...event('no',future,'excused'),responseRequested:true},{...event('not-requested',future),responseRequested:false},{...event('old-client',future)},{...event('started',Date.now()-1),responseRequested:true}];
 f.c.responseBadge(events);assert.equal(badge.hidden,false);assert.equal(badge.textContent,'2');assert.match(tile.attributes['aria-label'],/2 Rückmeldungen/);
 events[0].status='yes';f.c.responseBadge(events);assert.equal(badge.textContent,'1');assert.match(tile.attributes['aria-label'],/1 Rückmeldung offen/);
 events[1].status='excused';f.c.responseBadge(events);assert.equal(badge.hidden,true);assert.equal(tile.attributes['aria-label'],'Termine');
 events[0].status='open';f.c.responseBadge(events);assert.equal(badge.hidden,false);f.c.responseBadge();assert.equal(badge.hidden,true);assert.equal(badge.textContent,'');
});
