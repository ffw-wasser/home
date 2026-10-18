/* Alle Mitglieder mit ihrem aktuellen Erfassungsstatus direkt anzeigen. */
(function(){
  'use strict';
  function matches(){return true;}
  function recordedCard(member,current){
    const entry=current.find(e=>[e.storedName,e.displayName].some(n=>n===nameForStorage(member)||n===nameForTile(member)));if(!entry)return '';
    const label=entry.role==='Orga'?'Organisation':entry.status;
    return `<article class="member-direct-card attendance-recorded"><strong class="member-name-two-lines"><span class="member-last-name">${escapeHtml(member.lastName)}</span><span class="member-first-name">${escapeHtml(member.firstName)}</span></strong><span>${escapeHtml(label)}</span><button type="button" class="outline-button" data-edit-entry="${escapeHtml(entry.id)}">Status ändern</button></article>`;
  }
  function storageStatus(){window.Usability?.attendanceState();}
  function refresh(count){
    storageStatus();
  }
  function init(){
    const target=byId('members');if(!target)return;
    target.addEventListener('click',event=>{const button=event.target.closest('[data-edit-entry]');if(button)window.Usability?.editEntry(button.dataset.editEntry);});
    window.addEventListener('online',storageStatus);window.addEventListener('offline',storageStatus);renderMembers();
  }
  window.AttendanceSmart={matches,recordedCard,refresh,storageStatus};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
