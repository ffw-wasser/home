const test=require('node:test'),assert=require('node:assert/strict'),Calendar=require('../js/features/portal/portal-calendar-export.js');
const event={id:'test-event_123',title:'Übung, Wasser; Süd',location:'Gerätehaus\nWasser',start:Date.parse('2026-10-25T08:00:00Z'),end:Date.parse('2026-10-25T10:00:00Z')};
test('Tageslinks verwenden ausschließlich Datum; iPhone, iPad, Android und Desktop werden unterschieden',()=>{assert.equal(Calendar.dayLink(event,{userAgent:'iPhone'}),'calshow:'+((event.start-Date.UTC(2001,0,1))/1000));assert.match(Calendar.dayLink(event,{platform:'MacIntel',maxTouchPoints:5}),/^calshow:/);assert.match(Calendar.dayLink(event,{userAgent:'Android'}),/^intent:\/\/com.android.calendar\/time\/1792915200000#Intent;/);assert.equal(Calendar.dayLink(event,{}),'https://calendar.google.com/calendar/u/0/r/day/2026/10/25');assert.throws(()=>Calendar.dayLink({...event,id:'evil\nFIELD:value'}));assert.equal(Calendar.createIcs,undefined,'individual ICS import is retired');assert.throws(()=>Calendar.dayLink({...event,end:event.start},{}));});
test('Android-App übergibt beim Klick nur den Zeitstempel und unterdrückt die Webnavigation',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),sent=[];
 function node(tag){return {tag,children:[],append(...items){this.children.push(...items);},setAttribute(){},replaceChildren(){this.children=[];},showModal(){this.open=true;},close(){this.open=false;}};}
 const body=node('body'),context={Intl,Date,navigator:{userAgent:'Android'},H2OCalendarDay:{postMessage:value=>sent.push(value)},addEventListener(){},document:{body,createElement:node}};
 vm.runInNewContext(fs.readFileSync('js/features/portal/portal-calendar-export.js','utf8'),context);
 context.H2OCalendar.show(event);const link=body.children[0].children.find(n=>n.tag==='a');let prevented=false;link.onclick({preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.deepEqual(sent,[String(event.start)]);assert.equal(sent[0].includes(event.title),false);
});
