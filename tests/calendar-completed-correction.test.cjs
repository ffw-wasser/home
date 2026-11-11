const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/history/archive.js','utf8');
const start=source.indexOf('function calendarArchiveStatus(event,reports){');
const end=source.indexOf('async function persistArchiveCorrection(item,rows,correctedDate)',start);
assert.ok(start>=0&&end>start,'Calendar correction route exists');
function fixture(items,options={}){
 const calls=[];let unlocked=options.unlocked!==false,currentSource='original';const now=Date.parse('2026-11-11T10:00:00Z'),event={id:'calendar-event-1',title:'Funkübung',kind:'probe',approved:true,completedAt:now,start:Date.parse('2026-11-10T19:00:00Z'),sessionType:'Sonderprobe',attendanceType:'Sonderprobe'};
 const context={Date,Intl,console,csvArchive:items,adminUnlocked:unlocked,checkAdminSession:()=>unlocked,requireAdmin:()=>{calls.push(['pin',unlocked]);return unlocked;},oneDriveAdministrationReady:()=>options.access!==false,oneDriveSignedIn:()=>options.access!==false,window:{DrinksStore:{sourceKey:()=>currentSource},loadOneDriveHistory:async()=>{calls.push(['load']);return options.load!==false;}},showToast:(...args)=>calls.push(['toast',...args]),confirm:message=>{calls.push(['confirm',message]);return options.confirm!==false;},showView:id=>calls.push(['view',id]),correctArchiveItem:id=>calls.push(['correct',id]),historyDateFromItem:item=>item.date,historyDisplayTitle:item=>item.topic||'Probe'};
 context.window.window=context.window;vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {context,calls,event,unlock:()=>{unlocked=true;context.adminUnlocked=true;},changeSource:()=>{currentSource='changed';},lock:()=>{unlocked=false;context.adminUnlocked=false;}};
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

test('Kalenderkorrektur verlangt das Verwaltungspasswort vor dem OneDrive-Abruf',async()=>{
 const f=fixture([{id:'right',calendarEventId:'calendar-event-1',date:'2026-11-10',sessionType:'Sonderprobe'}],{unlocked:false});
 assert.equal(await f.context.window.openCompletedCalendarEvent(f.event),false);
 assert.equal(f.calls.some(c=>c[0]==='load'||c[0]==='correct'),false);
 assert.deepEqual(f.calls.filter(c=>c[0]==='pin'),[['pin',false]]);
 f.unlock();
 assert.equal(f.context.resumePendingCalendarCorrection(),true);
 await new Promise(setImmediate);
 assert.deepEqual(f.calls.filter(c=>c[0]==='correct'),[['correct','right']]);
 assert.equal(f.calls.filter(c=>c[0]==='load').length,1);
});
test('PIN-Abbruch verwirft die vorgemerkte Korrektur',async()=>{
 const f=fixture([{id:'right',calendarEventId:'calendar-event-1',date:'2026-11-10',sessionType:'Sonderprobe'}],{unlocked:false});
 await f.context.window.openCompletedCalendarEvent(f.event);
 f.context.cancelPendingCalendarCorrection();f.unlock();
 assert.equal(f.context.resumePendingCalendarCorrection(),false);
 assert.equal(f.calls.some(c=>c[0]==='load'||c[0]==='correct'),false);
});
test('Gerätehaus-Quellenwechsel verwirft die vorgemerkte Korrektur',async()=>{
 const f=fixture([{id:'right',calendarEventId:'calendar-event-1',date:'2026-11-10',sessionType:'Sonderprobe'}],{unlocked:false});
 await f.context.window.openCompletedCalendarEvent(f.event);
 f.changeSource();f.unlock();
 assert.equal(f.context.resumePendingCalendarCorrection(),false);
 assert.equal(f.calls.some(c=>c[0]==='load'||c[0]==='correct'),false);
});

for(const reason of ['source','lock'])test('Laufender Historienabruf bricht bei '+reason+' ohne Berichtöffnung ab',async()=>{
 const f=fixture([{id:'right',calendarEventId:'calendar-event-1',date:'2026-11-10',sessionType:'Sonderprobe'}]);
 let finish;f.context.window.loadOneDriveHistory=()=>new Promise(resolve=>{finish=resolve;});
 const opening=f.context.window.openCompletedCalendarEvent(f.event);
 if(reason==='source')f.changeSource();else f.lock();
 finish(true);assert.equal(await opening,false);
 assert.equal(f.calls.some(c=>c[0]==='correct'),false);
});
test('Abgelaufene vorgemerkte Kalenderkorrektur wird nach PIN nicht fortgesetzt',async()=>{
 const f=fixture([],{unlocked:false});await f.context.window.openCompletedCalendarEvent(f.event);
 vm.runInContext('pendingCalendarCorrection.createdAt-=300001',f.context);f.unlock();
 assert.equal(f.context.resumePendingCalendarCorrection(),false);
 assert.equal(f.calls.some(c=>c[0]==='load'||c[0]==='correct'),false);
});

test('Originalbericht ohne Kalender-Abschlussmarkierung wird als abgeschlossen erkannt',()=>{
 const f=fixture([{id:'right',calendarEventId:'calendar-event-1',date:'2026-11-10',sessionType:'Sonderprobe'}]);
 assert.equal(f.context.calendarArchiveStatus({...f.event,completedAt:null},f.context.csvArchive),'completed');
});
test('Ohne Historienprüfung darf ein alter Termin nicht als offen gelten',()=>{
 const f=fixture([]);
 assert.equal(f.context.calendarArchiveStatus({...f.event,completedAt:null},null),'unknown');
 assert.equal(f.context.calendarArchiveStatus({...f.event,completedAt:null},[]),'open');
});
test('Nicht eindeutig zuordenbare alte Berichte sperren Nachtragen',()=>{
 const f=fixture([{id:'legacy',date:'2026-11-10',sessionType:'Unterricht',content:'x'}]);
 assert.equal(f.context.calendarArchiveStatus({...f.event,completedAt:null},f.context.csvArchive),'review');
});
