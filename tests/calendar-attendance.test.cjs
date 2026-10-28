const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../js/features/portal/member-evidence.js');
class Node{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=true;this.dataset={};this.value='';this.textContent='';}append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}insertBefore(node,before){const index=this.children.indexOf(before);if(index<0)throw Error('Missing child');this.children.splice(index,0,node);return node;}replaceChildren(...nodes){this.children=nodes;this.firstChild=nodes[0];}get options(){return this.children;}setAttribute(){}removeAttribute(){}querySelector(){return new Node();}querySelectorAll(){return [];}}
const descendants=n=>n.children.flatMap(c=>[c,...descendants(c)]);
const type=card=>descendants(card).find(n=>n.tagName==='LABEL'&&n.textContent==='Terminart').children[0];
function fixture(){
 const nodes=new Map(),events={},intervals=[],microtasks=[],observers=[],typeClicks=[],requests=[],storage=new Map();let ready=false,publicGate=null,publicResolve;const publicStarted=new Promise(r=>publicResolve=r);
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};get('attendanceView').hidden=false;
 const start=Date.now()+3600000,privateCal={configured:true,stale:false,fetchedAt:Date.now(),events:[{id:'test-event',title:'Funkübung',sessionType:'Sonderprobe',attendanceType:'Sonderprobe',kind:'probe',approved:true,start,end:start+3600000}]};
 const publicCal=()=>({...privateCal,events:privateCal.events.map(e=>({...e,title:e.sessionType}))}),clone=v=>JSON.parse(JSON.stringify(v));
 const c=vm.createContext({console,Intl,Date,Promise,MemberEvidence:E,CalendarPresentation:{responseLink:id=>'https://calendar.example.test/response?event='+encodeURIComponent(id)},oneDriveStateConfirmed:false,oneDriveAdministrationReady:()=>ready,oneDriveReadState:async()=>({members:[]}),sessionType:'Sonderprobe',currentSessionId:'',currentOperationId:'',currentProbeDate:'',pendingMemberStatuses:new Map(),members:[],todayEntries:()=>[],byId:get,showToast(){},showView(){},requireAdmin:()=>true,localStorage:{getItem:k=>k==='h2o_calendar_public_origin'?'https://test.account.workers.dev/':null,setItem(){}},safeStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},DrinksCentral:{connection:async()=>({origin:'https://test.account.workers.dev/',source:'test-source'})},DrinksStore:{sourceKey:()=> 'test-source'},DrinksPush:{validOrigin:()=>true,request:async(_,path,data)=>{requests.push(path);if(path.endsWith('/list'))return clone(privateCal);if(path.endsWith('/replies'))return {event:clone(privateCal.events.find(e=>e.id===data.eventId)||privateCal.events[0]),replies:[],stale:false};return {evidenceVersion:1};}},document:{hidden:false,readyState:'loading',getElementById:get,createElement:tag=>new Node(tag),querySelector:s=>s.startsWith('#sessionTypes ')?{click:()=>typeClicks.push(s.match(/data-session-type="([^"]+)"/)[1])}:new Node(),querySelectorAll:()=>[],addEventListener:(key,fn)=>events['doc:'+key]=fn},addEventListener:(key,fn)=>events['window:'+key]=fn,MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(node){(this.nodes??=[]).push(node);}},queueMicrotask:fn=>microtasks.push(fn),setInterval:fn=>intervals.push(fn),fetch:async()=>{publicResolve();if(publicGate)await publicGate;return {ok:true,json:async()=>clone(publicCal())};}});
 vm.runInContext(fs.readFileSync('js/features/portal/portal-admin.js','utf8'),c);
 return {c,get,events,intervals,microtasks,observers,typeClicks,requests,privateCal,publicStarted,gate:p=>publicGate=p,init:()=>events['doc:DOMContentLoaded'](),login:()=>{ready=true;c.oneDriveStateConfirmed=true;return c.PortalAdmin.storageChanged();},label:()=>get('portal-calendar-pick').children[1]?.textContent};
}
test('Hauptansicht ersetzt neutrale Sonderprobe nach OneDrive-Bestätigung automatisch durch den richtigen Namen',async()=>{
 const f=fixture();await f.c.PortalAdmin.refreshAttendance(true);assert.match(f.label(),/Sonderprobe/);assert.ok(!f.label().includes('Sonderprobe · Sonderprobe'));assert.equal(f.requests.length,0);
 await f.login();assert.match(f.label(),/Funkübung · Sonderprobe/);assert.ok(f.requests.some(p=>p.endsWith('/replies')));
});
test('Öffentlicher Gerätehaus-Kalender zeigt ausgewählte Termine mit Kennzeichnung',async()=>{
 const f=fixture();f.privateCal.events[0].audienceRestricted=true;f.privateCal.events[0].recipientIds=['mitglied-1'];
 await f.c.PortalAdmin.refreshAttendance(true);assert.match(f.label(),/Sonderprobe · Nur ausgewählte Mitglieder/);
 await f.login();assert.match(f.label(),/Funkübung · Sonderprobe · Nur ausgewählte Mitglieder/);
});

test('Anmeldung während eines laufenden öffentlichen Abrufs verliert die automatische Aktualisierung nicht',async()=>{
 const f=fixture();let release;f.gate(new Promise(r=>release=r));const first=f.c.PortalAdmin.refreshAttendance(true);await f.publicStarted;await f.login();release();await first;assert.match(f.label(),/Funkübung · Sonderprobe/);
});
test('Zurückkehr zur Erfassung lädt Namens- und Terminartkorrekturen bei unveränderter Kalenderkennung',async()=>{
 const f=fixture();f.init();await f.login();f.privateCal.events[0].title='Fahrzeugkunde';f.privateCal.events[0].attendanceType='Unterricht';
 const observer=f.observers.find(o=>o.nodes.includes(f.get('attendanceView')));observer.fn();await new Promise(setImmediate);
 assert.match(f.label(),/Fahrzeugkunde · Sonderprobe/);assert.equal(f.typeClicks.at(-1),'Unterricht');
});
test('Automatische Aktualisierung behält spontane und bereits laufende Erfassungen bei',async()=>{
 const f=fixture();f.init();await f.login();f.get('portal-calendar-pick').value='';f.get('portal-calendar-pick').onchange();await f.c.PortalAdmin.refreshAttendance(true);assert.equal(f.get('portal-calendar-pick').value,'');
 f.get('portal-calendar-pick').value='test-event';f.get('portal-calendar-pick').onchange();f.c.currentSessionId='test-session';f.c.PortalAdmin.sessionStarted();const before=f.typeClicks.length;f.privateCal.events[0].attendanceType='Unterricht';await f.c.PortalAdmin.refreshAttendance(true);assert.equal(f.typeClicks.length,before);assert.equal(f.get('portal-calendar-pick').value,'test-event');
});

test('Automatisches Kalenderladen behält ungespeicherte Korrekturen',async()=>{
 const f=fixture();f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 const area=f.get('portal-admin-review-events'),card=area.children[0];assert.ok(card);const kind=type(card);kind.value='Allgemeine Probe';kind.onchange();
 const count=f.requests.length;const Base=Date;f.c.Date=class extends Base{static now(){return Base.now()+90000;}};f.intervals[0]();await new Promise(setImmediate);
 assert.equal(f.requests.length,count);assert.equal(area.children[0],card);assert.equal(kind.value,'Allgemeine Probe');assert.equal(card.dataset.state,'edited');
});
test('Während eines automatischen Abrufs begonnene Korrekturen werden ebenfalls erhalten',async()=>{
 const f=fixture();f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 const area=f.get('portal-admin-review-events'),card=area.children[0],kind=type(card),request=f.c.DrinksPush.request;let release,started;const gate=new Promise(r=>release=r),waiting=new Promise(r=>started=r);
 f.c.DrinksPush.request=async(...args)=>{if(args[1].endsWith('/list')){started();await gate;}return request(...args);};
 const Base=Date;f.c.Date=class extends Base{static now(){return Base.now()+90000;}};f.intervals[0]();await waiting;kind.value='Allgemeine Probe';kind.onchange();release();await new Promise(setImmediate);
 assert.equal(area.children[0],card);assert.equal(kind.value,'Allgemeine Probe');assert.equal(card.dataset.state,'edited');
});

test('Bewusst spontaner Termin bleibt nach automatischem Kalenderabruf ohne Kalenderbindung',async()=>{
 const f=fixture();await f.login();assert.equal(f.c.PortalAdmin.selectedEvent().title,'Funkübung');assert.equal(f.c.PortalAdmin.useSpontaneous(),true);assert.equal(f.c.PortalAdmin.selectedEvent(),null);
 await f.c.PortalAdmin.refreshAttendance(true);assert.equal(f.c.PortalAdmin.selectedEvent(),null);assert.equal(f.get('portal-calendar-pick').value,'');
});
test('Laufende Erfassung kann durch spontane Auswahl nicht vom Kalender getrennt werden',async()=>{
 const f=fixture();await f.login();f.c.currentSessionId='test-session';f.c.PortalAdmin.sessionStarted();assert.equal(f.c.PortalAdmin.useSpontaneous(),false);assert.equal(f.c.PortalAdmin.selectedEvent().id,'test-event');
});


test('Kalenderkarten öffnen ihre Bearbeitung erst auf Wunsch; Kleiderwechsel folgt Probe/Sonderprobe',async()=>{
 const f=fixture();f.init();await f.login();
 f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 const card=f.get('portal-admin-review-events').children[0];
 const kind=type(card);
 const edit=card.children.find(n=>n.className==='portal-review-edit-toggle');
 assert.ok(edit);assert.equal(card.children.find(n=>n.className==='portal-event-editor').hidden,true);
 edit.onclick();assert.equal(card.children.find(n=>n.className==='portal-event-editor').hidden,false);
 assert.equal(edit.attrs?.['aria-expanded']??edit.attributes?.['aria-expanded'],undefined);
 const clothingLabel=descendants(card).find(n=>n.tagName==='LABEL'&&n.textContent==='Kleidung');
 assert.ok(clothingLabel);
 const clothing=clothingLabel.children[0];
 assert.equal(kind.value,'Sonderprobe');
 kind.value='Allgemeine Probe';kind.onchange();
 assert.equal(clothing.value,'Einsatzkleidung');
 kind.value='Sonderprobe';kind.onchange();
 assert.equal(clothing.value,'Tagesdienst');
 assert.equal(card.dataset.state,'edited');
 const cancel=descendants(card).find(n=>n.tagName==='BUTTON'&&n.textContent==='Abbrechen');
 f.c.confirm=()=>false;cancel.onclick();assert.equal(card.children.find(n=>n.className==='portal-event-editor').hidden,false);assert.equal(card.dataset.state,'edited');
 f.c.confirm=()=>true;cancel.onclick();assert.equal(card.children.find(n=>n.className==='portal-event-editor').hidden,true);assert.equal(kind.value,'Sonderprobe');
 assert.notEqual(card.dataset.state,'edited','Bestätigtes Abbrechen stellt den gespeicherten Stand wieder her');
});

test('Identische automatische Kalender-Aktualisierung ersetzt keine angezeigten Karten',async()=>{
 const f=fixture();f.init();await f.login();
 f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 const area=f.get('portal-admin-review-events'),card=area.children[0];
 const Base=Date;f.c.Date=class extends Base{static now(){return Base.now()+90000;}};
 f.intervals[0]();await new Promise(setImmediate);
 assert.equal(area.children[0],card,'Keine springenden Eingabefelder bei unverändertem Kalender');
});

test('Sammelfreigabe darf nach Abbrechen der Vorschau keine Kalenderregeln schreiben',async()=>{
 const f=fixture();Object.assign(f.privateCal.events[0],{automatic:true,approved:false});f.init();await f.login();
 f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 let requested=false;f.c.confirm=()=>{requested=true;return false;};
 f.get('portal-admin-review-select').onclick();
 const selection=f.get('portal-admin-review-events').children[0].children.find(n=>n.className==='portal-release-selection').children[0];selection.checked=true;selection.onchange();
 const prior=f.requests.length;
 await f.get('portal-admin-review-auto').onclick();
 assert.equal(requested,true);assert.equal(f.requests.length,prior);
});

test('Kalenderverwaltung besitzt getrennte Bereiche, Suche und faltbare Verbindung',()=>{
 const html=fs.readFileSync('index.html','utf8'),section=html.slice(html.indexOf('id="settingsCalendarView"'),html.indexOf('id="adminLoginView"'));
 for(const id of ['portal-admin-review-search','portal-calendar-nav-events','portal-calendar-nav-groups','portal-calendar-nav-connection','portal-admin-review-filter','portal-admin-review-events'])assert.ok(section.includes('id="'+id+'"'),id);
 assert.match(section,/class="portal-calendar-technical"/);
 assert.ok(section.indexOf('portal-calendar-workspace')<section.indexOf('portal-calendar-technical'));
});


test('Gespeicherte normale Probe lässt sich öffnen und Mitglieder mit Suche korrigieren',async()=>{
 const f=fixture();
 const members=[{id:'mitglied-1',lastName:'Muster',firstName:'Anna'},{id:'mitglied-2',lastName:'Beispiel',firstName:'Bernd'},{id:'mitglied-3',lastName:'Müller',firstName:'Clara'}];
 f.c.oneDriveReadState=async()=>({members});
 Object.assign(f.privateCal,{recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1,rulesVersion:3});
 Object.assign(f.privateCal.events[0],{automatic:false,kind:'probe',sessionType:'Probe',attendanceType:'Allgemeine Probe',clothing:'Einsatzkleidung',location:'GH Wasser',recipientIds:['mitglied-1'],approved:true});
 f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;
 await f.c.PortalAdmin.loadCalendar();
 const cards=f.get('portal-admin-review-events').children,card=cards[0];
 assert.ok(!card.hidden,'Gespeicherte Proben sollen standardmäßig sichtbar sein');
 assert.equal(f.get('portal-admin-member').children.length,4,'Kalender lädt die Mitglieder unabhängig vom QR-Menü');
 const shortcut=card.children.find(n=>n.className==='portal-review-edit-toggle');
 assert.ok(shortcut,'Mitglieder ändern auf der normalen Probe');
 const summary=card.children.find(n=>n.className==='portal-review-audience');
 assert.match(summary.textContent,/Zugeordnete Mitglieder/);
 assert.match(card.children.find(n=>n.className==='portal-event-people').children[0].textContent,/Mitglieder \(1\)/);
 shortcut.onclick();
 const recipients=descendants(card).find(n=>n.className==='portal-recipient-choices');
 assert.ok(recipients);assert.equal(recipients.hidden,false);
 const exceptions=recipients.children.find(n=>n.className==='portal-recipient-exceptions'),mode=exceptions.children[1],count=recipients.children[1],search=exceptions.children[2],actions=exceptions.children[3],list=exceptions.children[5];
 assert.equal(mode.value,'selected');assert.match(count.textContent,/1 von 3/);
 assert.equal(list.children.length,3);
 search.value='müller';search.oninput();
 assert.equal(list.children[0].hidden,true);assert.equal(list.children[1].hidden,true);assert.equal(list.children[2].hidden,false);
 actions.children[0].onclick();
 assert.equal(list.children[2].children[0].checked,true);
 assert.equal(list.children[1].children[0].checked,false);
 assert.match(count.textContent,/2 von 3/);
 assert.equal(card.dataset.state,'edited');
 mode.value='all';mode.onchange();
 assert.equal(list.hidden,true);assert.match(count.textContent,/Alle Mitglieder/);
 mode.value='selected';mode.onchange();assert.equal(list.children[2].children[0].checked,true);
});

test('Normale Probe speichert korrigierte Empfänger ohne Terminartwechsel und bestätigt Antwort',async()=>{
 const f=fixture(),members=[{id:'one',lastName:'Muster',firstName:'Anna'},{id:'two',lastName:'Beispiel',firstName:'Bernd'}];
 f.c.oneDriveReadState=async()=>({members});
 Object.assign(f.privateCal,{recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1,rulesVersion:5});
 Object.assign(f.privateCal.events[0],{automatic:false,kind:'probe',sessionType:'Probe',attendanceType:'Allgemeine Probe',clothing:'Einsatzkleidung',location:'GH Wasser',recipientIds:['one'],approved:true});
 let payload=null;
 const original=f.c.DrinksPush.request;
 f.c.DrinksPush.request=async (connection,path,data)=>{
  if(!path.endsWith('/classify'))return original(connection,path,data);
  payload=data;f.privateCal.rulesVersion=6;
  Object.assign(f.privateCal.events[0],{kind:data.kind,sessionType:data.sessionType,attendanceType:data.attendanceType,location:data.location,clothing:data.clothing,recipientIds:data.recipientIds,approved:data.approved,automatic:false});
  return {recipientFeatureVersion:2,recipientIds:data.recipientIds,clothingVersion:1,locationVersion:1,attendanceTypeVersion:1};
 };
 f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;
 await f.c.PortalAdmin.loadCalendar();
 const card=f.get('portal-admin-review-events').children[0],shortcut=card.children.find(n=>n.className==='portal-review-edit-toggle');
 shortcut.onclick();
 const recipients=descendants(card).find(n=>n.className==='portal-recipient-choices'),list=recipients.children.find(n=>n.className==='portal-recipient-exceptions').children[5];
 list.children[1].children[0].checked=true;list.children[1].children[0].onchange();
 const save=descendants(card).find(n=>n.tagName==='BUTTON'&&n.textContent==='Speichern');
 assert.ok(save);
 await save.onclick();
 assert.equal(payload.kind,'probe');assert.equal(payload.sessionType,'Probe');assert.equal(payload.attendanceType,'Allgemeine Probe');
 assert.deepEqual(Array.from(payload.recipientIds),['one','two']);
 assert.equal(f.privateCal.events[0].approved,true);
});



test('Vergangene Termine fehlen in Verwaltung, Zählern und Sammelfreigabe; Quelldaten bleiben erhalten',async()=>{
 const f=fixture(),now=Date.now();
 Object.assign(f.privateCal,{recipientFeatureVersion:2,locationVersion:1,clothingVersion:1,attendanceTypeVersion:1,rulesVersion:2});
 Object.assign(f.privateCal.events[0],{
  id:'herbstfest-17-10-2026',title:'Herbstfest Sonderschule',
  start:now-86400000,end:now-82800000,
  kind:'probe',sessionType:'Sonderprobe',attendanceType:'Sonderprobe',
  approved:false,automatic:true,location:'GH Wasser'
 });
 f.init();await f.login();
 f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;
 await f.c.PortalAdmin.loadCalendar();
 assert.equal(f.get('portal-admin-review-events').children.length,0);
 assert.equal(f.get('portal-admin-review-all').textContent,'Alle (0)');
 assert.equal(f.get('portal-admin-review-toggle').textContent,'Zu prüfen (0)');
 assert.equal(f.get('portal-admin-review-auto').disabled,true,'Abgelaufene Termine dürfen keine Sammelfreigabe mehr auslösen.');
 assert.equal(f.privateCal.events.length,1,'Die Kalenderquelle wurde nicht gelöscht');
});

test('Laufende Termine bleiben bis zum exakten Ende sichtbar, auch ganztägig über den Zeitwechsel',async()=>{
 const f=fixture(),Base=Date;
 const now=Date.parse('2026-10-25T22:59:59Z');f.c.Date=class extends Base{static now(){return now;}};
 const template=f.privateCal.events[0];f.privateCal.events=[
  {...template,id:'ended',start:now-10000,end:now},
  {...template,id:'all-day',allDay:true,start:Date.parse('2026-10-24T22:00:00Z'),end:Date.parse('2026-10-25T23:00:00Z')},
  {...template,id:'ongoing',start:now-3600000,end:now+500},
  {...template,id:'future',start:now+3600000,end:now+7200000}
 ];
 f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 assert.deepEqual(Array.from(f.get('portal-admin-review-events').children,n=>n.dataset.eventId),['all-day','ongoing','future']);
 f.c.Date=class extends Base{static now(){return now+1000;}};f.intervals[0]();await new Promise(setImmediate);
 assert.deepEqual(Array.from(f.get('portal-admin-review-events').children).filter(n=>!n.hidden).map(n=>n.dataset.eventId),['future']);
 assert.equal(f.get('portal-admin-review-all').textContent,'Alle (1)');
});

test('Ablauf während Bearbeitung behält den Entwurf, sperrt Speichern und blendet nach Abbrechen aus',async()=>{
 const f=fixture(),Base=Date;f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 const card=f.get('portal-admin-review-events').children[0];card.children.find(n=>n.className==='portal-review-edit-toggle').onclick();
 const kind=type(card);kind.value='Allgemeine Probe';kind.onchange();
 f.c.Date=class extends Base{static now(){return f.privateCal.events[0].end;}};f.intervals[0]();await new Promise(setImmediate);
 assert.equal(card.hidden,false);assert.equal(kind.value,'Allgemeine Probe');assert.match(card.children.find(n=>n.className==='portal-event-feedback').textContent,/beendet/);
 const save=descendants(card).find(n=>n.tagName==='BUTTON'&&n.textContent==='Speichern');assert.equal(save.disabled,true);
 const prior=f.requests.length;await save.onclick();assert.equal(f.requests.length,prior,'Auch direkter Aufruf schreibt keinen beendeten Termin');
 f.c.confirm=()=>true;descendants(card).find(n=>n.tagName==='BUTTON'&&n.textContent==='Abbrechen').onclick();assert.equal(card.hidden,true);
});

test('Gespeicherte Termine ohne Freigabe bleiben zu prüfen; Suchfilter begrenzt die Sammelfreigabe',async()=>{
 const f=fixture();Object.assign(f.privateCal.events[0],{automatic:false,approved:false,recipientIds:['one']});
 f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 f.get('portal-admin-review-toggle').onclick();const card=f.get('portal-admin-review-events').children[0];assert.equal(card.hidden,false);assert.equal(f.get('portal-admin-review-toggle').textContent,'Zu prüfen (1)');
 f.get('portal-admin-review-select').onclick();const check=card.children.find(n=>n.className==='portal-release-selection').children[0];check.checked=true;check.onchange();assert.equal(f.get('portal-admin-review-auto').disabled,false);
 f.get('portal-admin-review-search').value='Kein Treffer';f.get('portal-admin-review-search').oninput();assert.equal(f.get('portal-admin-review-auto').disabled,true);
 let confirmed=false;f.c.confirm=()=>{confirmed=true;return true;};const prior=f.requests.length;await f.get('portal-admin-review-auto').onclick();assert.equal(confirmed,false);assert.equal(f.requests.length,prior);
});

test('Seitenwechsel fragt vor dem Verwerfen und Abbruch erhält den Kalenderentwurf',async()=>{
 const f=fixture();f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 const card=f.get('portal-admin-review-events').children[0];card.children.find(n=>n.className==='portal-review-edit-toggle').onclick();const kind=type(card);kind.value='Allgemeine Probe';kind.onchange();
 f.c.confirm=()=>false;assert.equal(f.c.PortalAdmin.beforeView('settingsView'),false);assert.equal(kind.value,'Allgemeine Probe');assert.equal(card.children.find(n=>n.className==='portal-event-editor').hidden,false);
 f.c.confirm=()=>true;assert.equal(f.c.PortalAdmin.beforeView('settingsView'),true);assert.equal(kind.value,'Sonderprobe');assert.equal(card.children.find(n=>n.className==='portal-event-editor').hidden,true);
});

test('Abbrechen zeigt den geladenen Kalendertermin sofort und lädt ohne Minutensperre nach',async()=>{
 const f=fixture();await f.login();f.c.currentSessionId='test-session';f.c.PortalAdmin.sessionStarted();
 f.c.PortalAdmin.discard();f.c.currentSessionId='';
 assert.equal(f.c.PortalAdmin.selectedEvent().id,'test-event');assert.equal(f.get('portal-calendar-pick').value,'test-event');
 const count=f.requests.filter(p=>p.endsWith('/list')).length;
 f.microtasks.pop()();await new Promise(setImmediate);
 assert.equal(f.requests.filter(p=>p.endsWith('/list')).length,count+1);
});
test('Nach Abbruch einer spontanen Erfassung erscheint der aktuelle Kalendertermin sofort wieder',async()=>{
 const f=fixture();await f.login();f.c.PortalAdmin.useSpontaneous();f.c.currentSessionId='spontan';
 assert.equal(f.c.PortalAdmin.selectedEvent(),null);f.c.PortalAdmin.discard();f.c.currentSessionId='';
 assert.equal(f.c.PortalAdmin.selectedEvent().id,'test-event');assert.equal(f.get('portal-calendar-pick').value,'test-event');
});
test('Abgelaufener Kalendertermin wird beim Abbrechen übersprungen',async()=>{
 const f=fixture();const first=f.privateCal.events[0];f.privateCal.events.push({...first,id:'next-event',start:first.end+10000,end:first.end+7200000});await f.login();
 const Base=Date;f.c.Date=class extends Base{static now(){return first.end+1000;}};
 f.c.PortalAdmin.discard();assert.equal(f.c.PortalAdmin.selectedEvent().id,'next-event');assert.equal(f.get('portal-calendar-pick').value,'next-event');
});
test('Ohne kommenden Termin bleibt der Kalender leer; Terminartwechsel behält die gewählte Bindung',async()=>{
 const f=fixture();await f.login();f.c.PortalAdmin.discard(true);assert.equal(f.c.PortalAdmin.selectedEvent().id,'test-event');assert.equal(f.microtasks.length,0);
 const Base=Date;f.c.Date=class extends Base{static now(){return f.privateCal.events[0].end+1;}};
 f.c.PortalAdmin.discard();assert.equal(f.c.PortalAdmin.selectedEvent(),null);assert.equal(f.get('portal-calendar-pick').value,'');
});

for(const reason of ['Sperren','Quellenwechsel'])test('Wartendes Speichern der Kalenderverbindung nach '+reason+' sendet keinen Auftrag',async()=>{
 const f=fixture();f.init();await f.login();f.get('attendanceView').hidden=true;f.get('settingsCalendarView').hidden=false;await f.c.PortalAdmin.loadCalendar();
 f.get('portal-admin-show-qr').classList={toggle(){}};
 let release,started;const pending=new Promise(r=>release=r),waiting=new Promise(r=>started=r);
 f.c.DrinksCentral.connection=async()=>{started();await pending;return {origin:'https://test.account.workers.dev/',source:f.c.DrinksStore.sourceKey()};};
 f.get('portal-admin-calendar').value='https://example.invalid/new.ics';f.get('portal-admin-hours').value='24';
 const saving=f.get('portal-admin-form').onsubmit({preventDefault(){}});await waiting;
 if(reason==='Sperren')f.c.PortalAdmin.lock();else f.c.DrinksStore.sourceKey=()=> 'different-source';
 release();await saving;
 assert.equal(f.requests.filter(p=>p.endsWith('/configure')).length,0);
 assert.equal(f.get('portal-calendar-administration').hidden,true);
});


test('Kalenderauswahl übernimmt Datum und Terminart, startet aber keine Erfassung',async()=>{
 const f=fixture();const original=f.privateCal.events[0],next={...original,id:'next-event',title:'Unterricht',attendanceType:'Unterricht',start:original.start+86400000,end:original.end+86400000};f.privateCal.events.push(next);await f.login();
 assert.equal(f.c.PortalAdmin.selectCalendarEvent(next.id),true);assert.equal(f.c.PortalAdmin.selectedEvent().id,next.id);assert.equal(f.c.PortalAdmin.isNextEvent(),false);assert.equal(f.typeClicks.at(-1),'Unterricht');assert.equal(f.c.currentProbeDate,new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(next.start));assert.equal(f.c.currentSessionId,'');assert.equal(f.c.currentOperationId,'');assert.equal(f.c.pendingMemberStatuses.size,0);
 assert.equal(f.c.PortalAdmin.selectCalendarEvent(original.id),true);assert.equal(f.c.PortalAdmin.isNextEvent(),true);
});
test('Kalenderwechsel schützt auch eine gerade gestartete Erfassung ohne Anwesenheiten',async()=>{
 const f=fixture(),original=f.privateCal.events[0];f.privateCal.events.push({...original,id:'next-event',start:original.start+86400000,end:original.end+86400000});f.init();await f.login();f.c.currentSessionId='just-started';f.c.PortalAdmin.sessionStarted();const date=f.c.currentProbeDate;
 assert.equal(f.c.PortalAdmin.selectCalendarEvent('next-event'),false);assert.equal(f.c.PortalAdmin.selectedEvent().id,original.id);assert.equal(f.get('portal-calendar-pick').value,original.id);assert.equal(f.c.currentProbeDate,date);assert.equal(f.c.currentSessionId,'just-started');
});
test('Nicht freigegebene, unbekannte und inzwischen beendete Termine bleiben ohne Auswahlwirkung',async()=>{
 const f=fixture(),original=f.privateCal.events[0];f.privateCal.events.push({...original,id:'not-approved',approved:false});await f.login();
 for(const id of ['not-approved','unknown']){assert.equal(f.c.PortalAdmin.selectCalendarEvent(id),false);assert.equal(f.c.PortalAdmin.selectedEvent().id,original.id);}
 const Base=Date;f.c.Date=class extends Base{static now(){return original.end;}};assert.equal(f.c.PortalAdmin.selectCalendarEvent(original.id),false);assert.equal(f.c.currentSessionId,'');
});

test('Geladene Empfänger und spätere Gruppenänderungen aktualisieren den Live-Zähler ohne Statusänderung',async()=>{
 const f=fixture(),seen=[];f.c.renderEntries=()=>seen.push(f.c.PortalAdmin.attendanceAudience());f.privateCal.events[0].recipientIds=['member-a'];await f.login();
 assert.deepEqual(Array.from(seen.at(-1).recipientIds),['member-a']);const before=seen.length;f.privateCal.events[0].recipientIds=['member-a','member-b'];await f.c.PortalAdmin.refreshAttendance(true);
 assert.ok(seen.length>before);assert.deepEqual(Array.from(seen.at(-1).recipientIds),['member-a','member-b']);
});
