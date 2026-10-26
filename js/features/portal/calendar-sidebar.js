/* Calendar overview and explicit event selection; starting attendance stays a separate action. */
(function(g){
 'use strict';
 const host=()=>document.getElementById('calendar-sidebar'),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const dateLabel=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}),monthLabel=new Intl.DateTimeFormat('de-DE',{month:'long',timeZone:'UTC'}),weekdayLabel=new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'}),clockLabel=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});
 let expanded=false;
 let generation=0,source='',loadedAt=0,pending=false,cached=null,refreshRequested=false,latestTiming={},timings=[];
 const now=()=>g.performance?.now?.()??Date.now();
 function recordTiming(values){latestTiming={...latestTiming,...values};timings.push({...latestTiming});if(timings.length>20)timings.shift();}
 function status(message,retry=false){
  if(!host()||host().hidden)return;let box=host().querySelector('.calendar-sidebar-load-status');
  if(!box){box=node('div');box.className='calendar-sidebar-load-status';box.setAttribute('role','status');const header=host().querySelector('.calendar-sidebar-heading');if(header)header.insertBefore(box,header.querySelector('button'));else host().append(box);}
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
 const day=ms=>dateLabel.format(ms),authorized=()=>typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady(),active=()=>!document.getElementById('attendanceView')?.hidden&&document.getElementById('attendanceView').classList.contains('workflow-stage-1')&&authorized();
 function fitExpanded(){
  const box=host();if(!expanded||!box||box.hidden)return;
  const nav=document.querySelector('.top-nav'),bounds=document.getElementById('attendanceView').getBoundingClientRect();
  box.style.setProperty('--calendar-expanded-top',Math.max(8,(nav?.getBoundingClientRect().bottom||0)+8)+'px');
  box.style.setProperty('--calendar-expanded-left',Math.max(8,bounds.left)+'px');
  box.style.setProperty('--calendar-expanded-right',Math.max(8,g.innerWidth-bounds.right)+'px');
 }
 function hide(){expanded=false;host()?.classList.remove('is-expanded');host()?.replaceChildren();if(host())host().hidden=true;}
 function clear(){generation++;pending=false;hide();source='';loadedAt=0;cached=null;refreshRequested=false;latestTiming={};timings=[];}
 function paint(cal,year){const renderStarted=now();host().hidden=false;const header=node('div'),todayButton=node('button','Heute');header.className='calendar-sidebar-heading';todayButton.type='button';todayButton.className='outline-button';todayButton.setAttribute('aria-label','Heute · heutigen Tag anzeigen');const expandButton=node('button'),expandIcon=node('span'),expandLabel=node('span','Kalender vergrößern');expandButton.type='button';expandButton.className='calendar-expand';expandIcon.className='calendar-expand-icon';expandIcon.setAttribute('aria-hidden','true');expandButton.append(expandIcon,expandLabel);expandButton.setAttribute('aria-expanded',String(expanded));expandButton.setAttribute('aria-label',expanded?'Kalender zuklappen':'Kalender vergrößern');header.append(node('h2','Kalender '+year),todayButton,expandButton);host().replaceChildren(header);if(cal.stale&&!cal.refreshing)host().append(node('p','Veralteter Kalenderstand.'));const scroll=node('div');scroll.className='calendar-sidebar-scroll';scroll.id='calendar-sidebar-months';expandButton.setAttribute('aria-controls',scroll.id);host().append(scroll);const today=day(Date.now()),firstMonth=Number(today.slice(5,7))-1,lastYear=new Date(Date.UTC(year,firstMonth+2,1)).getUTCFullYear(),fromMonth=Date.UTC(year,firstMonth,1,12),toMonth=Date.UTC(year,firstMonth+3,0,12);header.querySelector('h2').textContent='Kalender '+year+(lastYear!==year?' / '+lastYear:'');
   const indexed=new Map();for(const e of cal.events){if(!Number.isFinite(e.start)||!Number.isFinite(e.end))continue;const from=day(e.start),to=day(Math.max(e.start,e.end-1));for(let t=Math.max(Date.parse(from+'T12:00Z'),fromMonth);t<=Math.min(Date.parse(to+'T12:00Z'),toMonth);t+=86400000){const key=new Date(t).toISOString().slice(0,10);if(!indexed.has(key))indexed.set(key,[]);indexed.get(key).push(e);}}
   const indexedAt=now();for(let offset=0;offset<3;offset++){const stamp=new Date(Date.UTC(year,firstMonth+offset,15)),month=stamp.getUTCMonth(),monthYear=stamp.getUTCFullYear(),section=node('section'),heading=node('h3',monthLabel.format(stamp)+(monthYear!==year?' '+monthYear:''));section.setAttribute('aria-label',monthLabel.format(stamp)+' '+monthYear);section.append(heading);scroll.append(section);
    for(let d=1;d<=new Date(Date.UTC(monthYear,month+1,0)).getUTCDate();d++){const key=monthYear+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),stamp=Date.parse(key+'T12:00Z'),row=node('div');row.className='calendar-sidebar-day';if(new Date(stamp).getUTCDay()===0)row.classList.add('is-sunday');if(key===today)row.classList.add('is-today');row.append(node('strong',d+' '+weekdayLabel.format(stamp)));
     const content=node('div');for(const holiday of g.SchoolHolidays.forDay(key)){row.classList.add('is-holiday');content.append(node('small',holiday.name));}for(const holiday of g.PublicHolidays.forDay(key)){const label=node('small',holiday.name);label.className='year-plan-public-holiday';content.append(label);}for(const e of indexed.get(key)||[]){const time=e.allDay?'Ganztägig':clockLabel.format(e.start)+' Uhr',selectable=e.approved===true&&e.kind==='probe'&&e.end>Date.now()&&!cal.stale,item=node(selectable?'button':'div'),style=g.CalendarPresentation.style(e,cal.colors);item.className='calendar-sidebar-event';if(selectable){item.type='button';item.dataset.calendarEvent=e.id;item.onclick=()=>{if(!active()||source!==g.DrinksStore.sourceKey())return;if(g.PortalAdmin?.selectCalendarEvent(e.id)){expanded=false;layout();focusToday();document.getElementById('continueToAttendanceButton')?.focus();}};}item.style.borderColor=style.accent;item.style.background=style.background;item.append(node('strong',time+' · '+e.title));if(e.note)item.append(node('p',e.note));content.append(item);}row.append(content);section.append(row);}
   }const months=[...scroll.querySelectorAll('section')];
   function layout(){host().classList.toggle('is-expanded',expanded);fitExpanded();expandIcon.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="'+(expanded?'M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5':'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5')+'"/></svg>';expandLabel.textContent=expanded?'Zuklappen':'Kalender vergrößern';expandButton.setAttribute('aria-expanded',String(expanded));expandButton.setAttribute('aria-label',expanded?'Kalender zuklappen':'Kalender vergrößern');expandButton.title=expanded?'Kalender zuklappen':'Kalender vergrößern';months.forEach(section=>{section.tabIndex=expanded?0:-1;section.scrollTop=0;});scroll.scrollTop=0;}
   function focusToday(){const row=scroll.querySelector('.is-today');if(!row)return;const container=expanded&&g.matchMedia('(min-width:761px)').matches?row.parentElement:scroll,heading=row.parentElement.querySelector('h3');container.scrollTop+=row.getBoundingClientRect().top-container.getBoundingClientRect().top-(heading?.getBoundingClientRect().height||0);}
   expandButton.onclick=()=>{expanded=!expanded;layout();focusToday();};todayButton.onclick=focusToday;layout();focusToday();syncSelection();recordTiming({indexMs:Math.round(indexedAt-renderStarted),renderMs:Math.round(now()-indexedAt)});status(cal.loading?'Termine werden geladen …':stand()+(cal.refreshing?' · Wird aktualisiert …':cal.stale?' · Aktualisierung nicht bestätigt':''));}
 function syncSelection(){
  const selected=g.PortalAdmin?.selectedEvent?.()?.id;
  host()?.querySelectorAll('[data-calendar-event]').forEach(button=>{const active=button.dataset.calendarEvent===selected;button.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));});
 }
 async function refresh(){
  if(!host())return;fitExpanded();
  if(!authorized()){clear();return;}
  if(!active()){hide();return;}
  const key=g.DrinksStore.sourceKey(),monthKey=day(Date.now()).slice(0,7),year=Number(monthKey.slice(0,4)),lastYear=new Date(Date.UTC(year,Number(monthKey.slice(5,7))+1,1)).getUTCFullYear();
  if(source&&key!==source)clear();source=key;
  if(cached&&cached.monthKey!==monthKey){cached=null;loadedAt=0;}
  // Retain authorized data only in memory across navigation, never on disk.
  // A known calendar appears immediately while an expired snapshot refreshes.
  if(cached&&host().hidden)paint(cached,year);
  if(pending){if(host().hidden)paint({year,events:[],loading:true},year);if(cached)status(stand()+' · Wird aktualisiert …');return;}if(cached&&!refreshRequested&&Date.now()-loadedAt<300000){status(stand()+(cached.refreshing?' · Wird aktualisiert …':cached.stale?' · Aktualisierung nicht bestätigt':''),cached.stale&&!cached.refreshing);return;}
  const epoch=++generation;pending=true;refreshRequested=false;host().hidden=false;
  if(!cached)paint({year,events:[],loading:true},year);
  else status(stand()+' · Wird aktualisiert …');
  const requestStarted=now();latestTiming={};
  const current=()=>epoch===generation&&authorized()&&source===g.DrinksStore.sourceKey()&&day(Date.now()).slice(0,7)===monthKey;
  try{
   const c=await g.DrinksCentral.connection();
   // Resolving the device connection initializes DrinksStore on a cold start.
   // Adopt only that first source; a known source change or cleared generation
   // must still discard the response, including after logout.
   if(!key&&!source&&epoch===generation&&authorized()&&c?.source&&c.source===g.DrinksStore.sourceKey())source=c.source;
   if(!current())return;if(!c||c.source!==source)throw Object.assign(Error('Bitte Gerätehaus-Verbindung prüfen.'),{status:403});
   const years=lastYear===year?[year]:[year,lastYear],read=background=>Promise.all(years.map(year=>g.DrinksPush.request(c,'/admin/portal/year',{source:c.source,year,background},35000)));
   let snapshots=await read(true);
   for(let pass=0;pass<2;pass++){
    if(!current())return;
    if(snapshots.some((cal,i)=>cal.year!==years[i]||!Array.isArray(cal.events)))throw Error('Kalender bitte aktualisieren.');
    const unique=new Map();for(const cal of snapshots)for(const event of cal.events)unique.set(JSON.stringify([event.id||event.title,event.start,event.end]),event);
    const cal={...snapshots[0],monthKey,events:[...unique.values()],stale:snapshots.some(cal=>cal.stale),refreshing:snapshots.some(cal=>cal.refreshing)};
    latestTiming.fetchMs=Math.round(now()-requestStarted);
    cached=cal;loadedAt=Date.now();if(active())paint(cal,year);
    if(!cal.refreshing||pass===1)break;
    // One joined refresh, not repeated polling; the shown snapshot remains visible.
    snapshots=await read(false);
   }
  }catch(e){if(current()&&[401,403].includes(Number(e.status))){clear();if(active()){host().hidden=false;host().replaceChildren(node('h2','Kalender'),node('p',g.ConnectionStatus?.message(e)||e.message));}}else if(current()&&active()){if(cached)cached.refreshing=false;const message=node('p',g.ConnectionStatus?.message(e)||e.message);if(!cached)host().replaceChildren(node('h2','Kalender'));status((cached?stand()+' · ':'')+message.textContent,true);}}
  finally{if(epoch===generation){pending=false;if(active()&&cached&&!host().querySelector('.calendar-sidebar-load-status'))status(stand());}}
 }
 g.CalendarSidebar={refresh,hide,clear,syncSelection,diagnostics:()=>timings.map(t=>({...t}))};g.addEventListener('resize',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(cached&&active())paint(cached,cached.year);refresh();}});setInterval(refresh,60000);setInterval(()=>{if(source&&(!authorized()||source!==g.DrinksStore.sourceKey()))clear();else if(source&&!active()&&!host()?.hidden)hide();},1000);document.addEventListener('DOMContentLoaded',()=>{mountDiagnostics();const nav=document.querySelector('.top-nav');if(nav&&g.ResizeObserver)new ResizeObserver(fitExpanded).observe(nav);g.visualViewport?.addEventListener('resize',fitExpanded);refresh();},{once:true});
})(globalThis);
