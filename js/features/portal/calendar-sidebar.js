/* Independent read-only calendar. Never reads or changes the attendance selection. */
(function(g){
 'use strict';
 const host=()=>document.getElementById('calendar-sidebar'),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},wide=()=>g.matchMedia('(min-width:1000px)').matches;
 const dateLabel=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}),monthLabel=new Intl.DateTimeFormat('de-DE',{month:'long',timeZone:'UTC'}),weekdayLabel=new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'}),clockLabel=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});
 let generation=0,source='',loadedAt=0,pending=false,cached=null;
 const day=ms=>dateLabel.format(ms),authorized=()=>typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady(),active=()=>wide()&&!document.getElementById('attendanceView')?.hidden&&document.getElementById('attendanceView').classList.contains('workflow-stage-1')&&authorized();
 function hide(){host()?.replaceChildren();if(host())host().hidden=true;}
 function clear(){generation++;pending=false;hide();source='';loadedAt=0;cached=null;}
 function paint(cal,year){host().hidden=false;const header=node('div'),todayButton=node('button','Heute');header.className='calendar-sidebar-heading';todayButton.type='button';todayButton.className='outline-button';todayButton.setAttribute('aria-label','Heute · heutigen Tag anzeigen');header.append(node('h2','Kalender '+year),todayButton);host().replaceChildren(header,node('small','Nur zur Information · Alle Termine'));if(cal.stale)host().append(node('p','Veralteter Kalenderstand.'));const scroll=node('div');scroll.className='calendar-sidebar-scroll';host().append(scroll);const today=day(Date.now());
   const indexed=new Map();for(const e of cal.events){if(!Number.isFinite(e.start)||!Number.isFinite(e.end))continue;const from=day(e.start),to=day(Math.max(e.start,e.end-1));for(let t=Math.max(Date.parse(from+'T12:00Z'),Date.UTC(year,0,1,12));t<=Math.min(Date.parse(to+'T12:00Z'),Date.UTC(year,11,31,12));t+=86400000){const key=new Date(t).toISOString().slice(0,10);if(!indexed.has(key))indexed.set(key,[]);indexed.get(key).push(e);}}
   for(let month=0;month<12;month++){const section=node('section'),heading=node('h3',monthLabel.format(Date.UTC(year,month,15)));section.append(heading);scroll.append(section);
    for(let d=1;d<=new Date(Date.UTC(year,month+1,0)).getUTCDate();d++){const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),stamp=Date.parse(key+'T12:00Z'),row=node('div');row.className='calendar-sidebar-day';if(new Date(stamp).getUTCDay()===0)row.classList.add('is-sunday');if(key===today)row.classList.add('is-today');row.append(node('strong',d+' '+weekdayLabel.format(stamp)));
     const content=node('div');for(const holiday of g.SchoolHolidays.forDay(key)){row.classList.add('is-holiday');content.append(node('small',holiday.name));}for(const holiday of g.PublicHolidays.forDay(key)){const label=node('small',holiday.name);label.className='year-plan-public-holiday';content.append(label);}for(const e of indexed.get(key)||[]){const time=e.allDay?'Ganztägig':clockLabel.format(e.start)+' Uhr',item=node('div'),style=g.CalendarPresentation.style(e,cal.colors);item.className='calendar-sidebar-event';item.style.borderColor=style.accent;item.style.background=style.background;item.append(node('strong',time+' · '+e.title));if(e.note)item.append(node('p',e.note));content.append(item);}row.append(content);section.append(row);}
   }const jumpToCurrentMonth=()=>{const month=Number(day(Date.now()).slice(5,7))-1,section=scroll.querySelectorAll('section')[month];if(section)scroll.scrollTop=section.offsetTop;};todayButton.addEventListener('click',()=>{const row=scroll.querySelector('.is-today');if(!row)return;const heading=row.parentElement.querySelector('h3');scroll.scrollTop+=row.getBoundingClientRect().top-scroll.getBoundingClientRect().top-(heading?.getBoundingClientRect().height||0);});jumpToCurrentMonth();}
 async function refresh(){
  if(!host())return;
  if(!authorized()){clear();return;}
  if(!active()){hide();return;}
  const key=g.DrinksStore.sourceKey(),year=Number(day(Date.now()).slice(0,4));
  if(source&&key!==source)clear();source=key;
  if(cached&&cached.year!==year){cached=null;loadedAt=0;}
  // Retain authorized data only in memory across navigation, never on disk.
  // A known calendar appears immediately while an expired snapshot refreshes.
  if(cached&&host().hidden)paint(cached,year);
  if(pending){if(host().hidden){host().hidden=false;host().replaceChildren(node('h2','Kalender'),node('p','Kalender wird geladen …'));}return;}if(cached&&Date.now()-loadedAt<300000)return;
  const epoch=++generation;pending=true;host().hidden=false;
  if(!cached)host().replaceChildren(node('h2','Kalender'),node('p','Kalender wird geladen …'));
  const current=()=>epoch===generation&&authorized()&&source===g.DrinksStore.sourceKey();
  try{
   const c=await g.DrinksCentral.connection();if(!current())return;if(!c||c.source!==source)throw Object.assign(Error('Bitte Gerätehaus-Verbindung prüfen.'),{status:403});
   const cal=await g.DrinksPush.request(c,'/admin/portal/year',{source:c.source,year},35000);if(!current())return;
   if(cal.year!==year||!Array.isArray(cal.events))throw Error('Kalender bitte aktualisieren.');
   cached=cal;loadedAt=Date.now();if(active())paint(cal,year);
  }catch(e){if(current()&&[401,403].includes(Number(e.status))){clear();if(active()){host().hidden=false;host().replaceChildren(node('h2','Kalender'),node('p',g.ConnectionStatus?.message(e)||e.message));}}else if(current()&&active()){const message=node('p',g.ConnectionStatus?.message(e)||e.message);if(cached){message.className='calendar-sidebar-load-status';host().querySelector('.calendar-sidebar-load-status')?.remove();host().append(message);}else host().replaceChildren(node('h2','Kalender'),message);}}
  finally{if(epoch===generation)pending=false;}
 }
 g.CalendarSidebar={refresh,hide,clear};g.addEventListener('resize',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);setInterval(()=>{if(source&&(!authorized()||source!==g.DrinksStore.sourceKey()))clear();else if(source&&!active()&&!host()?.hidden)hide();},1000);document.addEventListener('DOMContentLoaded',refresh,{once:true});
})(globalThis);
