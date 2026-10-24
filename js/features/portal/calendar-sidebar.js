/* Independent read-only calendar. Never reads or changes the attendance selection. */
(function(g){
 'use strict';
 const host=()=>document.getElementById('calendar-sidebar'),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},wide=()=>g.matchMedia('(min-width:1000px)').matches;
 const dateLabel=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}),monthLabel=new Intl.DateTimeFormat('de-DE',{month:'long',timeZone:'UTC'}),weekdayLabel=new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'}),clockLabel=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});
 let expanded=false,firstMonth=0;
 let generation=0,source='',loadedAt=0,pending=false,cached=null,refreshRequested=false,latestTiming={},timings=[];
 const now=()=>g.performance?.now?.()??Date.now();
 function recordTiming(values){latestTiming={...latestTiming,...values};timings.push({...latestTiming});if(timings.length>20)timings.shift();}
 function status(message,retry=false){
  if(!host()||host().hidden)return;let box=host().querySelector('.calendar-sidebar-load-status');
  if(!box){box=node('div');box.className='calendar-sidebar-load-status';box.setAttribute('role','status');host().querySelector('.calendar-sidebar-heading')?.after(box);if(!box.parentElement)host().append(box);}
  box.replaceChildren(node('small',message));if(retry){const button=node('button','Erneut laden');button.type='button';button.className='outline-button';button.onclick=()=>{refreshRequested=true;refresh();};box.append(button);}
 }
 function stand(){return loadedAt?'Stand '+new Date(Number(cached?.fetchedAt)||loadedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'';}
 function mountDiagnostics(){
  const help=document.querySelector('#helpView .guide-support>div')||document.getElementById('helpView');if(!help||document.getElementById('calendar-load-help'))return;
  const box=node('details');box.id='calendar-load-help';box.className='guide-diagnostics';box.append(node('summary','Kalender-Ladezeit prüfen'),node('p','Die letzte Messung bleibt auf diesem Gerät und enthält keine Termin- oder Mitgliederdaten.'));
  const output=node('p'),button=node('button','Messung anzeigen');output.setAttribute('role','status');button.type='button';button.className='outline-button';
  button.onclick=()=>{const t=[...timings].reverse().find(t=>Number.isFinite(t.fetchMs));output.textContent=t?'Letzter Kalenderabruf: '+(t.fetchMs/1000).toLocaleString('de-DE',{maximumFractionDigits:2})+' Sekunden · Aufbereitung: '+t.indexMs+' ms · Darstellung: '+t.renderMs+' ms.':'Noch keine Messung. Öffne zuerst die Kalenderübersicht auf der Gerätehaus-Startseite.';};
  box.append(button,output);help.append(box);
 }
 const day=ms=>dateLabel.format(ms),authorized=()=>typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady(),active=()=>wide()&&!document.getElementById('attendanceView')?.hidden&&document.getElementById('attendanceView').classList.contains('workflow-stage-1')&&authorized();
 function fitExpanded(){
  const box=host();if(!expanded||!box||box.hidden)return;
  const nav=document.querySelector('.top-nav'),bounds=box.parentElement.getBoundingClientRect();
  box.style.setProperty('--calendar-expanded-top',Math.max(8,(nav?.getBoundingClientRect().bottom||0)+8)+'px');
  box.style.setProperty('--calendar-expanded-left',Math.max(8,bounds.left)+'px');
  box.style.setProperty('--calendar-expanded-right',Math.max(8,g.innerWidth-bounds.right)+'px');
 }
 function hide(){expanded=false;host()?.classList.remove('is-expanded');host()?.replaceChildren();if(host())host().hidden=true;}
 function clear(){generation++;pending=false;hide();source='';loadedAt=0;cached=null;refreshRequested=false;latestTiming={};timings=[];}
 function paint(cal,year){const renderStarted=now();host().hidden=false;const header=node('div'),todayButton=node('button','Heute');header.className='calendar-sidebar-heading';todayButton.type='button';todayButton.className='outline-button';todayButton.setAttribute('aria-label','Heute · heutigen Tag anzeigen');const expandButton=node('button',expanded?'←':'→');expandButton.type='button';expandButton.className='outline-button calendar-expand';expandButton.setAttribute('aria-expanded',String(expanded));expandButton.setAttribute('aria-label',expanded?'Kalender zuklappen':'Kalender auf volle Breite erweitern');header.append(node('h2','Kalender '+year),todayButton,expandButton);host().replaceChildren(header,node('small','Nur zur Information · Alle Termine'));if(cal.stale)host().append(node('p','Veralteter Kalenderstand.'));const scroll=node('div');scroll.className='calendar-sidebar-scroll';scroll.id='calendar-sidebar-months';expandButton.setAttribute('aria-controls',scroll.id);host().append(scroll);const today=day(Date.now());
   const indexed=new Map();for(const e of cal.events){if(!Number.isFinite(e.start)||!Number.isFinite(e.end))continue;const from=day(e.start),to=day(Math.max(e.start,e.end-1));for(let t=Math.max(Date.parse(from+'T12:00Z'),Date.UTC(year,0,1,12));t<=Math.min(Date.parse(to+'T12:00Z'),Date.UTC(year,11,31,12));t+=86400000){const key=new Date(t).toISOString().slice(0,10);if(!indexed.has(key))indexed.set(key,[]);indexed.get(key).push(e);}}
   const indexedAt=now();for(let month=0;month<12;month++){const section=node('section'),heading=node('h3',monthLabel.format(Date.UTC(year,month,15)));section.setAttribute('aria-label',heading.textContent+' '+year);section.append(heading);scroll.append(section);
    for(let d=1;d<=new Date(Date.UTC(year,month+1,0)).getUTCDate();d++){const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),stamp=Date.parse(key+'T12:00Z'),row=node('div');row.className='calendar-sidebar-day';if(new Date(stamp).getUTCDay()===0)row.classList.add('is-sunday');if(key===today)row.classList.add('is-today');row.append(node('strong',d+' '+weekdayLabel.format(stamp)));
     const content=node('div');for(const holiday of g.SchoolHolidays.forDay(key)){row.classList.add('is-holiday');content.append(node('small',holiday.name));}for(const holiday of g.PublicHolidays.forDay(key)){const label=node('small',holiday.name);label.className='year-plan-public-holiday';content.append(label);}for(const e of indexed.get(key)||[]){const time=e.allDay?'Ganztägig':clockLabel.format(e.start)+' Uhr',item=node('div'),style=g.CalendarPresentation.style(e,cal.colors);item.className='calendar-sidebar-event';item.style.borderColor=style.accent;item.style.background=style.background;item.append(node('strong',time+' · '+e.title));if(e.note)item.append(node('p',e.note));content.append(item);}row.append(content);section.append(row);}
   }const months=[...scroll.querySelectorAll('section')],currentMonth=()=>Number(day(Date.now()).slice(5,7))-1;
   const navigation=node('div');navigation.className='calendar-month-navigation';const previous=node('button','←'),range=node('strong'),next=node('button','→');for(const [button,label] of [[previous,'Vorherige Monate'],[next,'Nächste Monate']]){button.type='button';button.className='outline-button';button.setAttribute('aria-label',label);}range.setAttribute('aria-live','polite');navigation.append(previous,range,next);scroll.before(navigation);
   function layout(){host().classList.toggle('is-expanded',expanded);fitExpanded();expandButton.textContent=expanded?'←':'→';expandButton.setAttribute('aria-expanded',String(expanded));expandButton.setAttribute('aria-label',expanded?'Kalender zuklappen':'Kalender auf volle Breite erweitern');navigation.hidden=!expanded;months.forEach((section,i)=>{section.hidden=expanded&&(i<firstMonth||i>firstMonth+2);section.tabIndex=expanded?0:-1;section.scrollTop=0;});scroll.scrollTop=0;previous.disabled=firstMonth===0;next.disabled=firstMonth===9;range.textContent=monthLabel.format(Date.UTC(year,firstMonth,15))+' – '+monthLabel.format(Date.UTC(year,firstMonth+2,15));}
   function focusToday(){const row=scroll.querySelector('.is-today');if(!row)return;if(expanded){firstMonth=Math.min(9,currentMonth());layout();}const container=expanded?row.parentElement:scroll,heading=row.parentElement.querySelector('h3');container.scrollTop+=row.getBoundingClientRect().top-container.getBoundingClientRect().top-(heading?.getBoundingClientRect().height||0);}
   expandButton.onclick=()=>{expanded=!expanded;layout();focusToday();};todayButton.onclick=focusToday;previous.onclick=()=>{firstMonth=Math.max(0,firstMonth-1);layout();};next.onclick=()=>{firstMonth=Math.min(9,firstMonth+1);layout();};layout();focusToday();recordTiming({indexMs:Math.round(indexedAt-renderStarted),renderMs:Math.round(now()-indexedAt)});status(stand()+(cal.stale?' · Aktualisierung nicht bestätigt':''));}
 async function refresh(){
  if(!host())return;fitExpanded();
  if(!authorized()){clear();return;}
  if(!active()){hide();return;}
  const key=g.DrinksStore.sourceKey(),year=Number(day(Date.now()).slice(0,4));
  if(source&&key!==source)clear();source=key;
  if(cached&&cached.year!==year){cached=null;loadedAt=0;}
  // Retain authorized data only in memory across navigation, never on disk.
  // A known calendar appears immediately while an expired snapshot refreshes.
  if(cached&&host().hidden)paint(cached,year);
  if(pending){if(host().hidden){host().hidden=false;host().replaceChildren(node('h2','Kalender'),node('p','Kalender wird geladen …'));}if(cached)status(stand()+' · Wird aktualisiert …');return;}if(cached&&!refreshRequested&&Date.now()-loadedAt<300000){status(stand());return;}
  const epoch=++generation;pending=true;refreshRequested=false;host().hidden=false;
  if(!cached)host().replaceChildren(node('h2','Kalender'),node('p','Kalender wird geladen …'));
  else status(stand()+' · Wird aktualisiert …');
  const requestStarted=now();latestTiming={};
  const current=()=>epoch===generation&&authorized()&&source===g.DrinksStore.sourceKey();
  try{
   const c=await g.DrinksCentral.connection();if(!current())return;if(!c||c.source!==source)throw Object.assign(Error('Bitte Gerätehaus-Verbindung prüfen.'),{status:403});
   const cal=await g.DrinksPush.request(c,'/admin/portal/year',{source:c.source,year},35000);if(!current())return;
   latestTiming.fetchMs=Math.round(now()-requestStarted);
   if(cal.year!==year||!Array.isArray(cal.events))throw Error('Kalender bitte aktualisieren.');
   cached=cal;loadedAt=Date.now();if(active())paint(cal,year);
  }catch(e){if(current()&&[401,403].includes(Number(e.status))){clear();if(active()){host().hidden=false;host().replaceChildren(node('h2','Kalender'),node('p',g.ConnectionStatus?.message(e)||e.message));}}else if(current()&&active()){const message=node('p',g.ConnectionStatus?.message(e)||e.message);if(!cached)host().replaceChildren(node('h2','Kalender'));status((cached?stand()+' · ':'')+message.textContent,true);}}
  finally{if(epoch===generation){pending=false;if(active()&&cached&&!host().querySelector('.calendar-sidebar-load-status'))status(stand());}}
 }
 g.CalendarSidebar={refresh,hide,clear,diagnostics:()=>timings.map(t=>({...t}))};g.addEventListener('resize',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(cached&&active())paint(cached,cached.year);refresh();}});setInterval(refresh,60000);setInterval(()=>{if(source&&(!authorized()||source!==g.DrinksStore.sourceKey()))clear();else if(source&&!active()&&!host()?.hidden)hide();},1000);document.addEventListener('DOMContentLoaded',()=>{mountDiagnostics();const nav=document.querySelector('.top-nav');if(nav&&g.ResizeObserver)new ResizeObserver(fitExpanded).observe(nav);g.visualViewport?.addEventListener('resize',fitExpanded);refresh();},{once:true});
})(globalThis);
