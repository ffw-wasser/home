/* Status of the retired invitation bridge. No enrollment or invitation setup. */
(function(g){
 'use strict';let epoch=0;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function clear(){epoch++;document.getElementById('calendar-invitations-connection')?.replaceChildren();}
 async function render(request){
  const host=document.getElementById('calendar-invitations-connection');if(!host)return;const generation=epoch,value=await request('calendar-invitations');if(generation!==epoch)return;
  const detail=node('details'),heading=node('summary','Kalenderabo mit H₂O-Antwortlink');detail.className='calendar-google-help';detail.open=true;
  detail.append(heading,node('p','Alle Termine bleiben im bestehenden Google-Kalenderabo. Unter Termine den Rückmeldelink in Google ergänzen oder kopieren. Erst „Rückmeldung anfordern“ schaltet Antworten frei und startet bestätigte Handy-Mitteilungen. Die vorhandene Push-Freigabe reicht aus.'));
  if(value.remainingInvitations)detail.append(node('p',value.remainingInvitations+' alte persönliche Einladungen werden beim nächsten erfolgreichen Abgleich zurückgezogen. Das bestehende Google-Skript bis dahin weiterlaufen lassen. Der Kalenderanbieter kann Absagemeldungen anzeigen. Antworten und Berichte bleiben erhalten.'));
  else detail.append(node('p','Keine alten persönlichen Einladungen mehr offen. Eine Einladungsanbindung und Kalenderadressen werden nicht mehr benötigt. Ein früherer Trigger h2oSyncInvitations kann im betreffenden Google-Skript entfernt werden.'));
  const refresh=node('button','Bereinigungsstatus aktualisieren');refresh.type='button';refresh.className='outline-button';refresh.onclick=()=>render(request);detail.append(refresh);host.replaceChildren(detail);
 }
 g.CalendarInvitationsAdmin={render,clear};
})(globalThis);
