/* Independent read-only calendar. Never reads or changes the attendance selection. */
(function(g){
 'use strict';
 const host=()=>document.getElementById('calendar-sidebar'),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},wide=()=>g.matchMedia('(min-width:1000px)').matches;
 let generation=0,source='',loadedAt=0,pending=false;
 const day=ms=>g.YearPlan.dayKey(ms),active=()=>wide()&&!document.getElementById('attendanceView')?.hidden&&document.getElementById('attendanceView').classList.contains('workflow-stage-1')&&typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady();
 function clear(){generation++;source='';loadedAt=0;pending=false;host()?.replaceChildren();if(host())host().hidden=true;}
 async function refresh(){
  if(!host())return;if(!active()){clear();return;}const key=g.DrinksStore.sourceKey();if(source&&key!==source)clear();if(pending||Date.now()-loadedAt<300000)return;
  const epoch=++generation;source=key;pending=true;host().hidden=false;host().replaceChildren(node('h2','Kalender'),node('p','Kalender wird geladen …'));
  const current=()=>epoch===generation&&active()&&source===g.DrinksStore.sourceKey();
  try{
   const c=await g.DrinksCentral.connection();if(!current())return;if(!c||c.source!==source)throw Error('Bitte Gerätehaus-Verbindung prüfen.');const year=Number(day(Date.now()).slice(0,4)),cal=await g.DrinksPush.request(c,'/admin/portal/year',{source:c.source,year},35000);if(!current())return;
   if(cal.year!==year||!Array.isArray(cal.events))throw Error('Kalender bitte aktualisieren.');host().replaceChildren(node('h2','Kalender '+year),node('small','Nur zur Information · Alle Termine'));if(cal.stale)host().append(node('p','Veralteter Kalenderstand.'));const scroll=node('div');scroll.className='calendar-sidebar-scroll';host().append(scroll);const today=day(Date.now());let target;
   const indexed=new Map();for(const e of cal.events){if(!Number.isFinite(e.start)||!Number.isFinite(e.end))continue;const from=day(e.start),to=day(Math.max(e.start,e.end-1));for(let t=Math.max(Date.parse(from+'T12:00Z'),Date.UTC(year,0,1,12));t<=Math.min(Date.parse(to+'T12:00Z'),Date.UTC(year,11,31,12));t+=86400000){const key=new Date(t).toISOString().slice(0,10);if(!indexed.has(key))indexed.set(key,[]);indexed.get(key).push(e);}}
   for(let month=0;month<12;month++){const section=node('section'),heading=node('h3',new Intl.DateTimeFormat('de-DE',{month:'long',timeZone:'UTC'}).format(Date.UTC(year,month,15)));section.append(heading);scroll.append(section);if(month===Number(today.slice(5,7))-1)target=section;
    for(let d=1;d<=new Date(Date.UTC(year,month+1,0)).getUTCDate();d++){const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),stamp=Date.parse(key+'T12:00Z'),row=node('div');row.className='calendar-sidebar-day';if(new Date(stamp).getUTCDay()===0)row.classList.add('is-sunday');if(key===today)row.classList.add('is-today');row.append(node('strong',d+' '+new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'}).format(stamp)));
     const content=node('div');for(const holiday of g.SchoolHolidays.forDay(key)){row.classList.add('is-holiday');content.append(node('small',holiday.name));}for(const holiday of g.PublicHolidays.forDay(key)){const label=node('small',holiday.name);label.className='year-plan-public-holiday';content.append(label);}for(const e of indexed.get(key)||[]){const time=e.allDay?'Ganztägig':new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(e.start)+' Uhr',item=node('div'),style=g.CalendarPresentation.style(e,cal.colors);item.className='calendar-sidebar-event';item.style.borderColor=style.accent;item.style.background=style.background;item.append(node('strong',time+' · '+e.title));if(e.note)item.append(node('p',e.note));content.append(item);}row.append(content);section.append(row);}
   }loadedAt=Date.now();if(target)scroll.scrollTop=target.offsetTop;
  }catch(e){if(current())host().replaceChildren(node('h2','Kalender'),node('p',g.ConnectionStatus?.message(e)||e.message));}finally{if(epoch===generation)pending=false;}
 }
 g.CalendarSidebar={refresh,clear};g.addEventListener('resize',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);setInterval(()=>{if(source&&(!active()||source!==g.DrinksStore.sourceKey()))clear();},1000);document.addEventListener('DOMContentLoaded',refresh,{once:true});
})(globalThis);
