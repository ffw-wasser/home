/* Suchfilter bleiben im Arbeitsspeicher. Finanzdaten werden hier nicht verarbeitet. */
(function(){
  'use strict';
  let query='',mode='open',contextKey='';
  function matches(member,recorded){
    const key=ensureCurrentSessionId()+'|'+sessionType;
    if(key!==contextKey){contextKey=key;query='';mode='open';if(byId('attendanceSearch'))byId('attendanceSearch').value='';}
    const found=[member.firstName,member.lastName].join(' ').toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'));
    return found&&(mode==='all'||!recorded.has(nameForStorage(member))&&!recorded.has(nameForTile(member)));
  }
  function recordedCard(member,current){
    const entry=current.find(e=>[e.storedName,e.displayName].some(n=>n===nameForStorage(member)||n===nameForTile(member)));if(!entry)return '';
    const label=entry.role==='Orga'?'Organisation':entry.status;
    return `<article class="member-direct-card attendance-recorded"><strong class="member-name-two-lines"><span class="member-last-name">${escapeHtml(member.lastName)}</span><span class="member-first-name">${escapeHtml(member.firstName)}</span></strong><span>${escapeHtml(label)}</span><button type="button" class="outline-button" data-edit-entry="${escapeHtml(entry.id)}">Status ändern</button></article>`;
  }
  function storageStatus(){window.Usability?.attendanceState();}
  function refresh(count){
    document.querySelectorAll('[data-attendance-filter]').forEach(button=>{const selected=button.dataset.attendanceFilter===mode;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('primary-button',selected);});
    const status=byId('attendanceSearchStatus');if(status)status.textContent=count?`${count} Mitglied${count===1?'':'er'} angezeigt`:'Keine passenden Mitglieder.';
    storageStatus();
  }
  function init(){
    const target=byId('members');if(!target)return;
    const box=document.createElement('div');box.className='attendance-tools';box.innerHTML='<label for="attendanceSearch">Mitglied suchen<input id="attendanceSearch" class="text-input" type="search" autocomplete="off" placeholder="Vor- oder Nachname"></label><div class="attendance-filters" aria-label="Mitgliederfilter"><button type="button" class="outline-button" data-attendance-filter="open">Noch offen</button><button type="button" class="outline-button" data-attendance-filter="all">Alle Mitglieder</button></div><small id="attendanceSearchStatus" role="status"></small>';target.before(box);
    byId('attendanceSearch').addEventListener('input',event=>{query=event.target.value;renderMembers();});
    box.addEventListener('click',event=>{const button=event.target.closest('[data-attendance-filter]');if(button){mode=button.dataset.attendanceFilter;renderMembers();}});
    target.addEventListener('click',event=>{const button=event.target.closest('[data-edit-entry]');if(button)window.Usability?.editEntry(button.dataset.editEntry);});
    window.addEventListener('online',storageStatus);window.addEventListener('offline',storageStatus);renderMembers();
  }
  window.AttendanceSmart={matches,recordedCard,refresh,storageStatus};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
