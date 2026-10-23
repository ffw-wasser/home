/* A read-only annual projection of the existing Google calendar. Private data stays in memory. */
(function(g){
 'use strict';
 const portal=Boolean(document.getElementById('more-year-plan'));
 const $=id=>document.getElementById('year-plan-'+id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const format=(ms,options)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',...options}).format(new Date(ms));
 const dayKey=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
 let year=Number(dayKey(Date.now()).slice(0,4)),events=[],generation=0,privateData=false,loaded=false,source='',message='',colors=g.CalendarPresentation.defaults();
 function authorized(){return portal?g.H2OPortal?.hasAccess()===true:typeof oneDriveAdministrationReady==='function'&&oneDriveAdministrationReady();}
 function accessCurrent(){return authorized()&&(portal||source===g.DrinksStore.sourceKey());}
 function render(){
  if(!$('months'))return;
  g.YearPlanPdf?.clear();$('print').disabled=!loaded||!privateData;
  $('heading-year').textContent=year;$('year').value=year;$('prev').disabled=year<=2000;$('next').disabled=year>=2100;
  $('birthdays').disabled=!privateData;
  $('status').textContent=message;
  $('holiday-status').textContent=g.SchoolHolidays.complete(year)?'Landesweite Ferien für '+year+' vollständig erfasst.':'Für '+year+' liegen keine vollständigen Feriendaten vor. Einzelne bekannte Zeiträume werden angezeigt.';
  const today=dayKey(Date.now()),filter=$('filter').value,showBirthdays=$('birthdays').checked&&privateData;
  const visible=events.filter(e=>e.kind==='birthday'?showBirthdays:filter==='all'||e.kind===filter);
  const next=events.filter(e=>e.kind==='probe'&&e.end>Date.now()).sort((a,b)=>a.start-b.start)[0];
  // Index each event once; mobile must not format every event for every day.
  const byDay=new Map(),first=year+'-01-01',last=year+'-12-31';
  for(const event of visible){
   const starts=dayKey(event.start),ends=dayKey(Math.max(event.start,event.end-1));
   const from=starts<first?first:starts,to=ends>last?last:ends;
   const time=event.allDay?'Ganztägig':format(event.start,{hour:'2-digit',minute:'2-digit'})+' Uhr';
   for(let stamp=Date.parse(from+'T12:00:00Z');Number.isFinite(stamp)&&stamp<=Date.parse(to+'T12:00:00Z');stamp+=86400000){
    const key=new Date(stamp).toISOString().slice(0,10);if(!byDay.has(key))byDay.set(key,[]);byDay.get(key).push({event,starts,time});
   }
  }
  $('months').replaceChildren();
  for(let half=0;half<2;half++){
   const grid=node('div');grid.className='year-plan-half';$('months').append(grid);
   for(let month=half*6;month<half*6+6;month++){
    const prefix=year+'-'+String(month+1).padStart(2,'0'),card=node('section');card.className='year-plan-month';card.id='year-plan-month-'+month;
    const current=prefix===today.slice(0,7);if(current)card.classList.add('is-current');
    const heading=node('h2',format(Date.UTC(year,month,15),{month:'long'})+(current?' · aktuell':''));card.append(heading);grid.append(card);
    const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    for(let day=1;day<=days;day++){
     const key=prefix+'-'+String(day).padStart(2,'0'),noon=Date.parse(key+'T12:00:00Z'),row=node('div');row.className='year-plan-day';
     if(new Date(noon).getUTCDay()===0)row.classList.add('is-sunday');if(key===today)row.classList.add('is-today');
     const date=node('span',day+' '+format(noon,{weekday:'short'}));date.className='year-plan-date';const content=node('div');row.append(date,content);card.append(row);
     if($('holidays').checked)for(const holiday of g.SchoolHolidays.forDay(key)){row.classList.add('is-holiday');if(holiday.start===key||key===year+'-01-01'){const label=node('small',holiday.name);label.className='year-plan-holiday';label.dataset.holidayStart='true';content.append(label);}}
     for(const holiday of g.PublicHolidays.forDay(key)){row.classList.add('is-public-holiday');const label=node('small',holiday.name);label.className='year-plan-public-holiday';content.append(label);}
     for(const {event:e,starts,time:clock} of byDay.get(key)||[]){
      const details=node('details');details.className='year-plan-event '+(e.kind==='birthday'?'is-birthday':e.kind==='probe'?'is-probe':'is-other');
      const time=e.allDay?'Ganztägig':starts<key?'Fortsetzung':clock;
      const style=g.CalendarPresentation.style(e,colors);details.style.setProperty('--event-accent',style.accent);details.style.setProperty('--event-bg',style.background);details.dataset.eventType=g.CalendarPresentation.key(e);details.dataset.googleColor=e.googleColor||'';
      const summary=node('summary',(e.kind==='birthday'?'🎂 ':'')+time+' · '+e.title);details.append(summary);
      if(e.id===next?.id){details.classList.add('is-next');summary.append(node('small',' · Nächster Termin'));}
      if(e.kind!=='birthday'){for(const value of [e.location,e.clothing,e.note].filter(Boolean))details.append(node('p',value));}details.dataset.note=e.note||'';
      content.append(details);
     }
    }
   }
  }
 }
 function updateToolsOffset(){
  if(portal)return;const controls=document.querySelector('#yearPlanView>.year-plan-controls'),nav=document.querySelector('.top-nav');
  if(controls&&nav){const position=getComputedStyle(nav).position,offset=['sticky','fixed'].includes(position)?nav.getBoundingClientRect().height:0;controls.style.setProperty('--year-plan-nav-height',offset+'px');}
 }
 function jump(month=Number($('month')?.value||0)){
  updateToolsOffset();const epoch=generation,selected=year;
  requestAnimationFrame(()=>{if(epoch!==generation||selected!==year||document.getElementById(portal?'portal-page-more-year-plan':'yearPlanView')?.hidden)return;if($('month'))$('month').value=month;const card=document.getElementById('year-plan-month-'+month);if(card){const tools=document.querySelector(portal?'#more-year-plan>.year-plan-controls':'#yearPlanView>.year-plan-controls'),offset=portal?0:parseFloat(getComputedStyle(tools).top)||0;card.style.scrollMarginTop=(tools.getBoundingClientRect().height+offset+(portal?32:16))+'px';}card?.scrollIntoView({block:'start',behavior:'auto'});});
 }
 async function load(scroll=false){
  if(scroll){const today=dayKey(Date.now());year=Number(today.slice(0,4));if($('month'))$('month').value=Number(today.slice(5,7))-1;}
  const epoch=++generation,selected=year;events=[];privateData=false;loaded=false;message='Jahresplan wird geladen …';render();
  jump();
  try{
   const privateAccess=authorized();let result;
   if(portal){
    if(!privateAccess)throw Error('Bitte mit deinem persönlichen H₂O-Zugang anmelden.');
    result=await g.H2OPortal.api('year',{year:selected});
    if(epoch!==generation)return;if(!authorized())throw Error('Der Portalzugang wurde gesperrt.');
   }else{
    if(!privateAccess)throw Error('Bitte die vorhandene OneDrive-Verbindung des Gerätehauses herstellen und den Jahresplan aktualisieren. Eine Verwaltungs-PIN ist nicht erforderlich.');
    const c=await g.DrinksCentral.connection();if(!c)throw Error('Bitte den Kontodienst verbinden.');source=g.DrinksStore.sourceKey();
    if(c.source!==source)throw Error('Der Datenordner wurde gewechselt.');
    // This read-only view uses the configured device connection independently
    // of the administration PIN. Never fall back to the reduced public feed.
    for(let attempt=0;attempt<2;attempt++){
     if(epoch!==generation)return;
     if(!authorized()||source!==g.DrinksStore.sourceKey())throw Error('Die Gerätehaus-Verbindung oder der Datenordner wurde geändert. Bitte erneut laden.');
     try{result=await g.DrinksPush.request(c,'/admin/portal/year',{source:c.source,year:selected},35000);break;}
     catch(e){const network=e instanceof TypeError||['AbortError','TimeoutError'].includes(e?.name)||/load failed|failed to fetch|networkerror|network request failed/i.test(e?.message||'');if(attempt||!network)throw e;}
    }
    if(epoch!==generation)return;if(!authorized()||source!==g.DrinksStore.sourceKey())throw Error('Die Gerätehaus-Verbindung oder der Datenordner wurde geändert. Bitte erneut laden.');
   }
   if(epoch!==generation)return;
   if(result.year!==selected||!Array.isArray(result.events))throw Error('Für den Jahresplan bitte den aktualisierten Kalenderdienst bereitstellen.');
   colors=result.colors||g.CalendarPresentation.defaults();events=result.events.filter(e=>Number.isFinite(e.start)&&Number.isFinite(e.end));privateData=privateAccess;loaded=true;
   message=!result.configured?'Google-Kalender noch nicht eingerichtet.':(result.stale?'Kalenderstand veraltet. ':'')+(portal?'Deine freigegebenen Proben, Kalenderinformationen und dein Geburtstag. ':'Vollständiger Jahresplan für das Gerätehaus. ')+(result.fetchedAt?'Stand: '+format(result.fetchedAt,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'');
   render();jump();
  }catch(e){if(epoch!==generation)return;events=[];privateData=false;message=g.ConnectionStatus?.message(e)||e.message;render();jump();}
 }
 function lock(){generation++;events=[];privateData=false;loaded=false;source='';message=portal?'Bitte den persönlichen Portalzugang erneut öffnen.':'Bitte den Jahresplan über die Gerätehaus-Verbindung erneut laden.';render();}
 function afterView(view){
  const settings=document.getElementById('settingsView'),tab=document.getElementById('settingsTab');
  if(tab){const active=view.startsWith('settings')||view==='adminLoginView';tab.classList.toggle('active',active);if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
  if(view==='attendanceView')g.CalendarSidebar?.refresh();else g.CalendarSidebar?.hide();
  if(view==='yearPlanView')load(true);
  else if(privateData||message==='Jahresplan wird geladen …')lock();
 }
 function init(){
  if(!$('months'))return;
  if(!portal){const nav=document.querySelector('.top-nav');if(nav&&typeof ResizeObserver==='function')new ResizeObserver(updateToolsOffset).observe(nav);g.addEventListener('resize',updateToolsOffset);updateToolsOffset();document.getElementById('yearPlanTab').onclick=()=>showView('yearPlanView');document.getElementById('plansTab').onclick=()=>showView('plansView');}
  const change=next=>{if(!Number.isInteger(next)||next<2000||next>2100){$('year').value=year;return;}year=next;load();};
  $('prev').onclick=()=>change(year-1);$('next').onclick=()=>change(year+1);$('year').onchange=()=>change(Number($('year').value));
  $('today').onclick=()=>{const today=dayKey(Date.now()),currentYear=Number(today.slice(0,4)),month=Number(today.slice(5,7))-1;if(year!==currentYear){load(true);return;}jump(month);};$('reload').onclick=()=>load();
  $('print').textContent='Als PDF ansehen';$('print').onclick=()=>{
   if(privateData&&!accessCurrent())return lock();
   if(!loaded||!privateData)return;
   const epoch=generation,months=[...$('months').querySelectorAll('.year-plan-month')].map(month=>({title:month.querySelector('h2').textContent.replace(' · aktuell',''),days:[...month.querySelectorAll('.year-plan-day')].map(row=>({date:row.querySelector('.year-plan-date').textContent,sunday:row.classList.contains('is-sunday'),holiday:row.classList.contains('is-holiday'),publicHoliday:row.classList.contains('is-public-holiday'),birthday:Boolean(row.querySelector('.is-birthday')),holidays:[...row.querySelectorAll('.year-plan-holiday,.year-plan-public-holiday')].map(n=>n.textContent),compactHolidays:[...row.querySelectorAll('.year-plan-public-holiday,.year-plan-holiday[data-holiday-start="true"]')].map(n=>n.textContent),events:[...row.querySelectorAll('.year-plan-event')].map(event=>({title:event.querySelector('summary').firstChild.textContent.replace('🎂 ',''),details:[...event.querySelectorAll('p')].map(n=>n.textContent).filter(t=>t!==event.dataset.note).join(' · '),note:event.dataset.note||'',type:event.dataset.eventType,googleColor:event.dataset.googleColor,birthday:event.classList.contains('is-birthday')}))}))}));
   g.YearPlanPdf.open({year,months,colors,isCurrent:()=>epoch===generation&&loaded&&privateData&&accessCurrent()});
  };
  for(const id of ['filter','birthdays','holidays'])$(id).onchange=()=>{if(privateData&&!accessCurrent())return lock();render();};
  const monthLabel=node('label','Monat '),monthSelect=node('select');monthLabel.className='year-plan-month-jump';monthSelect.id='year-plan-month';monthSelect.setAttribute('aria-label','Zum Monat springen');
  for(let month=0;month<12;month++){const option=node('option',format(Date.UTC(2026,month,15),{month:'long'}));option.value=month;monthSelect.append(option);}monthSelect.value=Number(dayKey(Date.now()).slice(5,7))-1;monthLabel.append(monthSelect);$('today').before(monthLabel);
  monthSelect.onchange=()=>jump(Number(monthSelect.value));
  if(portal){
   $('reload').setAttribute('aria-label','Jahresplan aktualisieren');$('print').textContent='Als PDF ansehen';
   // The personal portal has its own authentication and scrolling lifecycle.
   g.addEventListener('portal-pagechange',e=>{if(e.detail?.page==='more-year-plan')load(true);else if(privateData||message==='Jahresplan wird geladen …')lock();});
   const other=$('filter').querySelector('option[value="other"]');if(other)other.remove();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&privateData&&!accessCurrent())lock();});
  setInterval(()=>{if(privateData&&!accessCurrent())lock();},1000);
  let printClosed=[];
  g.addEventListener('beforeprint',()=>{if(privateData&&!accessCurrent())lock();printClosed=[...document.querySelectorAll('.year-plan details:not([open])')];for(const detail of printClosed)detail.open=true;});
  g.addEventListener('afterprint',()=>{for(const detail of printClosed)detail.open=false;printClosed=[];});
  if(portal){render();return;}
  // Existing pages remain the owners of their editing and unsaved-change checks.
  const nav=(pages)=>{for(const [id] of pages){const page=document.getElementById(id);if(!page)continue;const tabs=node('nav');tabs.className='administration-tabs';tabs.setAttribute('aria-label','Verwaltungsbereiche');for(const [target,label] of pages){const button=node('button',label);button.type='button';button.className='outline-button';button.setAttribute('aria-pressed',String(target===id));button.onclick=()=>{if(showView(target)&&target==='settingsStatisticsView')renderStatistics();if(target==='settingsHistoryView'){renderHistory();g.loadOneDriveHistory?.();}};tabs.append(button);}page.prepend(tabs);}};
  nav([['settingsHistoryView','Berichte'],['settingsStatisticsView','Statistik']]);
  nav([['settingsOptionsView','Einstellungen'],['settingsSecurityView','Sicherheit'],['settingsFilesView','Datensicherung']]);
  const help=document.getElementById('helpView');if(help){const back=node('button','← Zum Termin');back.type='button';back.className='outline-button';back.onclick=()=>showView('attendanceView');help.prepend(back);}
  render();
 }
 if(portal)g.PortalYearPlan={load,lock,dayKey};else g.YearPlan={load,lock,afterView,dayKey};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
