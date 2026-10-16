const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../js/features/portal/member-evidence.js');
class Node{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=true;this.dataset={};this.value='';this.textContent='';}append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}replaceChildren(...nodes){this.children=nodes;this.firstChild=nodes[0];}setAttribute(){}removeAttribute(){}querySelector(){return new Node();}querySelectorAll(){return [];}}
function fixture(){
 const nodes=new Map(),events={},observers=[],typeClicks=[],requests=[],storage=new Map();let ready=false,publicGate=null,publicResolve;const publicStarted=new Promise(r=>publicResolve=r);
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};get('attendanceView').hidden=false;
 const start=Date.now()+3600000,privateCal={configured:true,stale:false,fetchedAt:Date.now(),events:[{id:'test-event',title:'Funkübung',sessionType:'Sonderprobe',attendanceType:'Sonderprobe',kind:'probe',approved:true,start,end:start+3600000}]};
 const publicCal=()=>({...privateCal,events:privateCal.events.map(e=>({...e,title:e.sessionType}))}),clone=v=>JSON.parse(JSON.stringify(v));
 const c=vm.createContext({console,Intl,Date,Promise,MemberEvidence:E,oneDriveStateConfirmed:false,oneDriveAdministrationReady:()=>ready,oneDriveReadState:async()=>({members:[]}),currentSessionId:'',currentOperationId:'',currentProbeDate:'',pendingMemberStatuses:new Map(),members:[],todayEntries:()=>[],byId:get,showToast(){},showView(){},requireAdmin:()=>true,localStorage:{getItem:k=>k==='h2o_calendar_public_origin'?'https://test.account.workers.dev/':null,setItem(){}},safeStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},DrinksCentral:{connection:async()=>({origin:'https://test.account.workers.dev/',source:'test-source'})},DrinksStore:{sourceKey:()=> 'test-source'},DrinksPush:{validOrigin:()=>true,request:async(_,path,data)=>{requests.push(path);if(path.endsWith('/list'))return clone(privateCal);if(path.endsWith('/replies'))return {event:clone(privateCal.events.find(e=>e.id===data.eventId)||privateCal.events[0]),replies:[],stale:false};return {evidenceVersion:1};}},document:{hidden:false,readyState:'loading',getElementById:get,createElement:tag=>new Node(tag),querySelector:s=>s.startsWith('#sessionTypes ')?{click:()=>typeClicks.push(s.match(/data-session-type="([^"]+)"/)[1])}:new Node(),querySelectorAll:()=>[],addEventListener:(key,fn)=>events['doc:'+key]=fn},addEventListener:(key,fn)=>events['window:'+key]=fn,MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(node){(this.nodes??=[]).push(node);}},queueMicrotask(){},setInterval(){},fetch:async()=>{publicResolve();if(publicGate)await publicGate;return {ok:true,json:async()=>clone(publicCal())};}});
 vm.runInContext(fs.readFileSync('js/features/portal/portal-admin.js','utf8'),c);
 return {c,get,events,observers,typeClicks,requests,privateCal,publicStarted,gate:p=>publicGate=p,init:()=>events['doc:DOMContentLoaded'](),login:()=>{ready=true;c.oneDriveStateConfirmed=true;return c.PortalAdmin.storageChanged();},label:()=>get('portal-calendar-pick').children[1]?.textContent};
}
test('Hauptansicht ersetzt neutrale Sonderprobe nach OneDrive-Bestätigung automatisch durch den richtigen Namen',async()=>{
 const f=fixture();await f.c.PortalAdmin.refreshAttendance(true);assert.match(f.label(),/Sonderprobe/);assert.ok(!f.label().includes('Sonderprobe · Sonderprobe'));assert.equal(f.requests.length,0);
 await f.login();assert.match(f.label(),/Funkübung · Sonderprobe/);assert.ok(f.requests.some(p=>p.endsWith('/replies')));
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
