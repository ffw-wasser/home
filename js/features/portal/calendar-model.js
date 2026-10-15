/* RFC 5545 calendar projection. Identity follows UID / original recurrence, never title. */
(function(g){
 'use strict';
 function parse(raw,now=Date.now()){
  if(typeof raw!=='string'||raw.length>2000000||!raw.trimStart().startsWith('BEGIN:VCALENDAR'))throw Error('Keine gültige iCal-Kalenderdatei.');
  const I=g.ICAL,root=new I.Component(I.parse(raw)),from=now-86400000,to=now+370*86400000,events=[],groups=new Map();let steps=0;
  I.TimezoneService.reset();
  for(const c of root.getAllSubcomponents('vtimezone'))I.TimezoneService.register(new I.Timezone(c));
  const components=root.getAllSubcomponents('vevent');if(components.length>10000)throw Error('Der Kalender enthält zu viele Einträge.');
  for(const c of components){const uid=c.getFirstPropertyValue('uid');if(!uid)throw Error('Kalendereintrag ohne feste Kennung.');if(!groups.has(uid))groups.set(uid,[]);groups.get(uid).push(c);}
  const timestamp=t=>{
   if(t.zone===I.Timezone.localTimezone){
    // Floating/date-only Google entries use the brigade's Berlin timezone.
    const wall=Date.UTC(t.year,t.month-1,t.day,t.hour||0,t.minute||0,t.second||0);let guess=wall;
    for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));guess=wall-(Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second)-guess);}return guess;
   }
   return t.toJSDate().getTime();
  };
  function add(uid,event,original,start,end,recurring){
   if(event.component.getFirstPropertyValue('status')==='CANCELLED')return;
   const ms=timestamp(start),finish=timestamp(end);if(!Number.isFinite(ms)||!Number.isFinite(finish))throw Error('Ungültige Terminzeit.');if(ms<from||ms>to)return;
   events.push({seriesKey:uid,birthdayHint:/geburtstag|birthday|🎂/i.test(String(event.summary||'')+' '+String(event.component.getFirstPropertyValue('categories')||'')),key:uid+(recurring?'\n'+original.toString():''),title:String(event.summary||'Termin').slice(0,240),location:String(event.location||'').slice(0,300),start:ms,end:finish,allDay:start.isDate});if(events.length>500)throw Error('Zu viele Termine im Vorschauzeitraum.');
  }
  for(const [uid,items] of groups){
   const main=items.find(c=>!c.hasProperty('recurrence-id'));
   if(!main){for(const c of items){const e=new I.Event(c);add(uid,e,e.recurrenceId,e.startDate,e.endDate,true);}continue;}
   const event=new I.Event(main),recurring=event.isRecurring();if(main.getFirstPropertyValue('status')==='CANCELLED')continue;
   for(const c of items.filter(c=>c!==main))event.relateException(new I.Event(c));
   if(!recurring){add(uid,event,event.startDate,event.startDate,event.endDate,false);continue;}
   const it=event.iterator();let occurrence;while((occurrence=it.next())){
    if(++steps>50000)throw Error('Die Terminserie ist zu umfangreich. Bitte Kalender eingrenzen.');
    if(timestamp(occurrence)>to+370*86400000)break;
    const details=event.getOccurrenceDetails(occurrence);add(uid,details.item,occurrence,details.startDate,details.endDate,true);
   }
  }
  const unique=new Map(events.map(e=>[e.key,e]));return [...unique.values()].sort((a,b)=>a.start-b.start);
 }
 g.PortalCalendar={parse};
})(globalThis);
