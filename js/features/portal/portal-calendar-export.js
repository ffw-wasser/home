/* Calendar handoff contains only the displayed appointment, never access credentials. */
(function(g){
 'use strict';
 const day=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
 function validate(event){if(!event||!Number.isFinite(event.start)||!Number.isFinite(event.end)||event.end<=event.start||!/^[A-Za-z0-9_-]+$/.test(event.id||''))throw Error('Dieser Kalendertermin ist ungültig.');}
 function dayLink(event,nav={}){validate(event);const web='https://calendar.google.com/calendar/u/0/r/day/'+day(event.start).replaceAll('-','/');
  if(/iPhone|iPad|iPod/.test(nav.userAgent||'')||nav.platform==='MacIntel'&&nav.maxTouchPoints>1)return 'calshow:'+Math.floor((event.start-Date.UTC(2001,0,1))/1000);
  if(/Android/.test(nav.userAgent||''))return 'intent://com.android.calendar/time/'+Math.floor(event.start)+'#Intent;scheme=content;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(web)+';end';
  return web;
 }
 let dialog=null;
 function show(event){
  validate(event);if(!dialog){dialog=document.createElement('dialog');dialog.className='portal-calendar-dialog';dialog.setAttribute('aria-labelledby','portal-calendar-title');document.body.append(dialog);g.addEventListener('hashchange',()=>dialog.close());g.addEventListener('portal-pagechange',()=>dialog.close());}
  dialog.replaceChildren();
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const title=node('h2','Kalender'),name=node('p',event.title),open=node('a','Tag im Kalender öffnen'),note=node('p','Der Termin bleibt im abonnierten Feuerwehrkalender. Zu- und Absage erfolgen in H₂O. Den Kalender kannst du unter Daten und Sicherheit abonnieren.'),close=node('button','Schließen');title.id='portal-calendar-title';open.href=dayLink(event,navigator);open.rel='noopener noreferrer';if(open.href.startsWith('https:'))open.target='_blank';close.type='button';close.onclick=()=>dialog.close();note.className='portal-calendar-note';dialog.append(title,name,open,note,close);if(!dialog.open)dialog.showModal();
 }
 g.H2OCalendar={dayLink,show};if(typeof module!=='undefined'&&module.exports)module.exports=g.H2OCalendar;
})(globalThis);
