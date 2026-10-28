/* Calendar handoff contains only the displayed appointment, never access credentials. */
(function(g){
 'use strict';
 const utc=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const day=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
 const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 function fold(line){let result='',part='',length=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(length+size>75){result+=part+'\r\n';part=' ';length=1;}part+=ch;length+=size;}return result+part;}
 function validate(event){if(!event||!Number.isFinite(event.start)||!Number.isFinite(event.end)||event.end<=event.start||!/^[A-Za-z0-9_-]+$/.test(event.id||''))throw Error('Dieser Termin kann nicht in den Kalender übernommen werden.');}
 function createIcs(event,now=Date.now()){
  validate(event);const dates=event.allDay?['DTSTART;VALUE=DATE:'+day(event.start).replaceAll('-',''),'DTEND;VALUE=DATE:'+day(event.end).replaceAll('-','')]:['DTSTART:'+utc(event.start),'DTEND:'+utc(event.end)];
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Feuerwehr Wasser//H2O Portal//DE','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+event.id+'@h2o.feuerwehr-wasser','DTSTAMP:'+utc(now),...dates,'SUMMARY:'+escape(event.title),'LOCATION:'+escape(event.location),'DESCRIPTION:Aus dem H₂O Portal übernommen. Änderungen bitte im Portal prüfen.','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
 }
 function dayLink(event,nav={}){validate(event);const web='https://calendar.google.com/calendar/u/0/r/day/'+day(event.start).replaceAll('-','/');
  if(/iPhone|iPad|iPod/.test(nav.userAgent||'')||nav.platform==='MacIntel'&&nav.maxTouchPoints>1)return 'calshow:'+Math.floor((event.start-Date.UTC(2001,0,1))/1000);
  if(/Android/.test(nav.userAgent||''))return 'intent://com.android.calendar/time/'+Math.floor(event.start)+'#Intent;scheme=content;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(web)+';end';
  return web;
 }
 let dialog=null,fileUrl=null;
 function show(event){
  validate(event);if(!dialog){dialog=document.createElement('dialog');dialog.className='portal-calendar-dialog';dialog.setAttribute('aria-labelledby','portal-calendar-title');document.body.append(dialog);g.addEventListener('hashchange',()=>dialog.close());g.addEventListener('portal-pagechange',()=>dialog.close());}
  if(fileUrl)URL.revokeObjectURL(fileUrl);fileUrl=event.calendarManaged||event.calendarLinkOnly?null:URL.createObjectURL(new Blob([createIcs(event)],{type:'text/calendar;charset=utf-8'}));dialog.replaceChildren();
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const title=node('h2','Kalender'),name=node('p',event.title),open=node('a','Tag im Kalender öffnen'),add=node('a','Termin übernehmen'),note=node('p','Den Termin anschließend in deiner Kalender-App bestätigen. Übernommene Termine werden bei Änderungen im Portal nicht automatisch angepasst.'),close=node('button','Schließen');title.id='portal-calendar-title';open.href=dayLink(event,navigator);open.rel='noopener noreferrer';if(open.href.startsWith('https:'))open.target='_blank';add.hidden=event.calendarManaged===true||event.calendarLinkOnly===true;if(event.calendarLinkOnly)note.textContent='Der Termin bleibt im abonnierten Feuerwehrkalender. Zu- und Absage erfolgen über den H₂O-Link; keine zusätzliche Kalenderdatei importieren.';if(event.calendarManaged)note.textContent='Für diesen Termin erhältst du bereits eine persönliche Einladung. Bitte diese Einladung im Kalender beantworten; keine zusätzliche Kalenderdatei importieren.';add.href=fileUrl||'';add.download='Feuerwehr-Termin.ics';add.type='text/calendar';add.setAttribute('aria-label','Termin übernehmen – Kalenderdatei öffnen');close.type='button';close.onclick=()=>dialog.close();note.className='portal-calendar-note';dialog.append(title,name,open,add,note,close);if(!dialog.open)dialog.showModal();
 }
 g.H2OCalendar={createIcs,dayLink,show};if(typeof module!=='undefined'&&module.exports)module.exports=g.H2OCalendar;
})(globalThis);
