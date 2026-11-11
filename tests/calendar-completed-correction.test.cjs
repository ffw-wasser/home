const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/history/archive.js','utf8');
const start=source.indexOf('let completedCalendarCorrectionOpening=false;');
const end=source.indexOf('function pairedArchiveFileNames(item)',start);
assert.ok(start>=0&&end>start,'Calendar correction route exists');
function fixture(items,options={}){
 const calls=[],now=Date.parse('2026-11-11T10:00:00Z'),event={id:'calendar-event-1',title:'Funkübung',kind:'probe',approved:true,completedAt:now,start:Date.parse('2026-11-10T19:00:00Z'),sessionType:'Sonderprobe',attendanceType:'Sonderprobe'};
 const context={Date,Intl,console,csvArchive:items,oneDriveAdministrationReady:()=>options.access!==false,oneDriveSignedIn:()=>options.access!==false,window:{loadOneDriveHistory:async()=>options.load!==false},showToast:(...args)=>calls.push(['toast',...args]),confirm:message=>{calls.push(['confirm',message]);return options.confirm!==false;},showView:id=>calls.push(['view',id]),correctArchiveItem:id=>calls.push(['correct',id]),historyDateFromItem:item=>item.date,historyDisplayTitle:item=>item.topic||'Probe'};
 context.window.window=context.window;vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {context,calls,event};
}
test('Abgeschlossener Kalendertermin öffnet den exakt verknüpften Originalbericht',async()=>{
 const f=fixture([{id:'wrong',calendarEventId:'other',calendarEventStart:1,date:'2026-11-10',sessionType:'Sonderprobe'},{id:'right',calendarEventId:'calendar-event-1',calendarEventStart:Date.parse('2026-11-10T19:00:00Z'),date:'2026-11-10',sessionType:'Sonderprobe'}]);
 assert.equal(await f.context.window.openCompletedCalendarEvent(f.event),true);
 assert.deepEqual(f.calls.filter(c=>c[0]==='correct'),[['correct','right']]);
 assert.equal(f.calls.some(c=>c[0]==='confirm'),false);
});
test('Älterer Bericht ohne Kalender-ID wird nur mit eindeutiger bestätigter Zuordnung korrigiert',async()=>{
 const f=fixture([{id:'legacy',date:'2026-11-10',sessionType:'Sonderprobe',topic:'Funkübung'}]);
 assert.equal(await f.context.window.openCompletedCalendarEvent(f.event),true);
 assert.equal(f.calls.filter(c=>c[0]==='confirm').length,1);
 assert.deepEqual(f.calls.filter(c=>c[0]==='correct'),[['correct','legacy']]);
});
test('Mehrdeutige alte Berichte öffnen nur die Historie und erzeugen keine Erfassung',async()=>{
 const f=fixture([{id:'a',date:'2026-11-10',sessionType:'Sonderprobe'},{id:'b',date:'2026-11-10',sessionType:'Sonderprobe'}]);
 assert.equal(await f.context.window.openCompletedCalendarEvent(f.event),false);
 assert.equal(f.calls.some(c=>c[0]==='correct'),false);
 assert.equal(f.calls.some(c=>c[0]==='view'&&c[1]==='settingsHistoryView'),true);
});
test('Ohne aktuelle OneDrive-Historie erfolgt keine automatische Korrektur',async()=>{
 const f=fixture([{id:'a',date:'2026-11-10',sessionType:'Sonderprobe'}],{load:false});
 assert.equal(await f.context.window.openCompletedCalendarEvent(f.event),false);
 assert.equal(f.calls.some(c=>c[0]==='correct'),false);
});
