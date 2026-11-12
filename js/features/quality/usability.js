/* Gemeinsame Bedienhilfen. Keine PINs oder Getränkebuchungen im Gerätespeicher. */
(function(){
  'use strict';
  let memberSaving=false,memberSaveMessage='',ready=false,memberQuery='',openMemberId='',lastHistoryLoad='',historyMessage='';
  const dirtyRows=()=>[...document.querySelectorAll('#memberAdmin [data-member-dirty],#memberAdmin .dr-pin-editor[data-dirty]')];
  function beforeLeave(view){
    if(memberSaving){showToast('Bitte die gemeinsame Speicherung abwarten.','error');return false;}
    if(view==='settingsMembersView'||byId('settingsMembersView')?.hidden!==false||!dirtyRows().length)return true;
    if(!confirm('Ungespeicherte Mitgliederdaten oder PIN-Eingaben verwerfen und diese Seite verlassen?'))return false;
    dirtyRows().forEach(row=>{delete row.dataset.memberDirty;delete row.dataset.dirty;});renderAdmin();return true;
  }
  function savedMember(row){delete row.dataset.memberDirty;const status=row.querySelector('.ux-member-status');if(status)status.textContent='Mitgliederdaten: '+getAppStorageState().text;refreshMemberSaveState();}
  function attendanceState(){
    const hint=byId('attendanceDraftStatus');if(!hint)return;
    const count=pendingMemberStatuses.size;
    hint.textContent=count?`${count} Änderung${count===1?'':'en'} noch nicht übernommen`:`${todayEntries().length} Anmeldung${todayEntries().length===1?'':'en'} für diesen Termin übernommen`;
    const cloud=document.createElement('small');cloud.id='attendanceCloudStatus';cloud.textContent=(count?'Letzter übernommener Stand: ':'')+getAppStorageState().text;hint.append(cloud);
    if(typeof attendanceDraftOutcome!=='undefined'&&attendanceDraftOutcome){const draft=document.createElement('small');draft.textContent=attendanceDraftOutcome;hint.append(draft);}
    hint.classList.toggle('is-pending',count>0);
    const options=byId('attendanceOptions'),warning=getAppStorageState().kind==='error'||typeof attendanceDraftOutcome!=='undefined'&&/konnte nicht|nur für diese Browsersitzung/.test(attendanceDraftOutcome);
    if(options){options.querySelector('summary').textContent=warning?'Details & Aktionen · Speicherung prüfen':'Details & Aktionen';if(warning)options.open=true;}
    window.WorkflowUX?.attendance();
  }
  function filterMembers(){
    const box=byId('memberAdmin'),query=memberQuery.trim().toLocaleLowerCase('de');
    let count=0,first='';
    box.querySelectorAll('[data-record-choice]').forEach(button=>{
      const match=button.textContent.toLocaleLowerCase('de').includes(query);
      button.hidden=!match;
      if(match){count++;if(!first)first=button.dataset.recordChoice;}
    });
    const status=byId('memberSearchStatus');
    if(status)status.textContent=count?count+' Mitglied'+(count===1?'':'er')+' gefunden':'Kein Mitglied gefunden.';
    if(first&&!box.querySelector('[data-record-choice].is-selected:not([hidden])'))selectRecord(first);
    if(!count)box.querySelectorAll('article.ux-member').forEach(row=>row.hidden=true);
  }
  function setActiveTab(row,tab){
    if(!row)return;
    const available=[...row.querySelectorAll('[data-record-panel]')].map(node=>node.dataset.recordPanel);
    if(!available.includes(tab))tab='overview';
    row.dataset.activeRecordTab=tab;
    row.querySelectorAll('[data-record-tab]').forEach(button=>{
      const active=button.dataset.recordTab===tab;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
    row.querySelectorAll('[data-record-panel]').forEach(panel=>panel.hidden=panel.dataset.recordPanel!==tab);
  }
  function selectRecord(id){
    const box=byId('memberAdmin');
    const former=box.querySelector('article.ux-member:not([hidden])');
    const previousTab=former?.dataset.activeRecordTab||'overview';
    const member=box.querySelectorAll('article.ux-member');
    const row=[...member].find(item=>item.dataset.memberId===id);
    if(!row)return;
    openMemberId=id;
    member.forEach(item=>item.hidden=item!==row);
    box.querySelectorAll('[data-record-choice]').forEach(button=>{
      const selected=button.dataset.recordChoice===id;
      button.classList.toggle('is-selected',selected);
      button.setAttribute('aria-current',selected?'true':'false');
    });
    setActiveTab(row,former===row?previousTab:'overview');
    window.Drinks?.loadPinStatus(row);
  }
  function renderMemberList(){
    if(!ready)return;
    const box=byId('memberAdmin'),rows=[...box.querySelectorAll('article.admin-row[data-member-id]')];
    if(!rows.length)return;
    byId('memberSearch')?.closest('.ux-search')?.remove();
    const shell=document.createElement('div');shell.className='person-record-layout';
    const sidebar=document.createElement('aside');sidebar.className='person-record-sidebar';sidebar.setAttribute('aria-label','Mitglieder auswählen');
    const main=document.createElement('div');main.className='person-record-main';
    const heading=document.createElement('div');heading.className='person-record-sidebar-heading';
    heading.innerHTML='<h4>Personenakten</h4><span>'+rows.length+'</span>';sidebar.append(heading);
    const search=document.createElement('div');search.className='ux-search';
    search.innerHTML='<label for="memberSearch">Mitglied suchen</label><input id="memberSearch" class="text-input" type="search" placeholder="Vor- oder Nachname" autocomplete="off"><p id="memberSearchStatus" role="status"></p>';
    sidebar.append(search);search.querySelector('input').value=memberQuery;
    search.querySelector('input').addEventListener('input',event=>{memberQuery=event.target.value;filterMembers();});
    let lastDepartment='';
    rows.forEach(article=>{
      const id=article.dataset.memberId,member=members.find(person=>person.id===id);
      if(!member)return;
      const department=member.ageDepartment?'Alterskameraden':'Einsatzabteilung';
      if(department!==lastDepartment){const caption=document.createElement('p');caption.className='person-record-category';caption.textContent=department;sidebar.append(caption);lastDepartment=department;}
      const button=document.createElement('button');button.type='button';button.className='person-record-person';button.dataset.recordChoice=id;
      const initials=(String(member.firstName||'').charAt(0)+String(member.lastName||'').charAt(0)).toLocaleUpperCase('de');
      button.innerHTML='<span class="person-record-avatar" aria-hidden="true">'+escapeHtml(initials)+'</span><span class="person-record-person-name">'+escapeHtml(nameForTile(member))+'</span><span class="person-record-person-arrow" aria-hidden="true">›</span>';
      sidebar.append(button);
      const header=article.querySelector('.member-card-header');header?.remove();
      article.classList.add('ux-member','person-record-card');
      article.setAttribute('aria-label','Personalakte '+nameForTile(member));
      const hero=document.createElement('header');hero.className='person-record-hero';
      hero.innerHTML='<div class="person-record-hero-icon" aria-hidden="true">FW</div><div class="person-record-hero-text"><p class="eyebrow">Feuerwehr Wasser · Personalakte</p><h3 class="person-record-title">'+escapeHtml(nameForTile(member))+'</h3><div class="person-record-hero-meta"><span class="person-record-badge">'+(member.ageDepartment?'Altersabteilung':member.fitnessTrainer?'Gast / Fitnesstrainer':'Einsatzabteilung')+'</span><span data-record-current-rank>Kein Dienstgrad hinterlegt</span></div></div>';
      const tabs=document.createElement('nav');tabs.className='person-record-tabs';tabs.setAttribute('aria-label','Bereiche der Personalakte');
      const tabList=[['overview','Übersicht'],['master','Stammdaten'],['career','Laufbahn & Ausbildung'],['roles','Berechtigungen'],['evidence','Nachweise'],['account','Konto & Getränke']];
      tabs.innerHTML=tabList.map(pair=>'<button type="button" role="tab" data-record-tab="'+pair[0]+'">'+pair[1]+'</button>').join('');
      const panels={};
      tabList.forEach(pair=>{const panel=document.createElement('section');panel.className='person-record-panel';panel.dataset.recordPanel=pair[0];panel.setAttribute('role','tabpanel');panel.hidden=true;const title=document.createElement('h4');title.className='person-record-panel-title';title.textContent=pair[1];panel.append(title);panels[pair[0]]=panel;});
      panels.overview.insertAdjacentHTML('beforeend','<p class="record-section-intro">Persönliche Funktionen und Ausbildung auf einen Blick. Alle Einträge können in den jeweiligen Bereichen gepflegt werden.</p><div data-record-honors></div><div class="person-record-metrics"><div><span>Lehrgänge & Fortbildungen</span><strong data-record-qualification-count>0</strong></div><div><span>Abzeichen & Ehrungen</span><strong data-record-awards-count>0</strong></div></div><h5>Letzte Laufbahneinträge</h5><div data-record-career-preview></div>');
      const move=(selector,to)=>{const node=article.querySelector(':scope > '+selector);if(node)panels[to].append(node);};
      move('.member-name-fields','master');
      move('.age-department-toggle','roles');
      move('.committee-member-toggle','roles');
      move('.committee-member-toggle','roles');
      move('.member-role-editor','roles');
      move('.age-no-role-note','roles');
      move('.member-safety-settings','evidence');
      move('.member-career-settings','career');
      move('.member-whatsapp-settings','account');
      const actions=article.querySelector(':scope > .member-card-actions');actions?.remove();
      // Dynamisch ergänzte Getränkefelder bleiben unverändert und behalten ihre Ereignisse.
      [...article.children].forEach(node=>panels.account.append(node));
      if(actions)panels.master.append(actions);
      article.append(hero,tabs,...tabList.map(pair=>panels[pair[0]]));
      const dirty=document.createElement('p');dirty.className='ux-member-status';dirty.setAttribute('role','status');dirty.textContent='Mitgliederdaten: '+getAppStorageState().text+' · PIN separat in OneDrive';panels.master.append(dirty);
      article.addEventListener('input',event=>{
        const pin=event.target.closest('.dr-pin-editor');
        if(pin){
          pin.dataset.dirty=event.target.value?'1':'';
          if(!event.target.value)delete pin.dataset.dirty;
          const pinStatus=pin.querySelector('[data-dr-pin-status]');
          if(pinStatus)pinStatus.textContent=event.target.value?'PIN noch nicht gespeichert. „Alle Änderungen speichern“ übernimmt auch die PIN.':'PIN wird separat gespeichert.';
        }else{
          article.dataset.memberDirty='1';
          dirty.textContent='Ungespeicherte Änderungen · oben „Alle Änderungen speichern“ wählen';
          const first=article.querySelector('[data-first-name]')?.value||'',last=article.querySelector('[data-last-name]')?.value||'';
          article.querySelector('.person-record-title').textContent=(first+' '+last).trim();
          button.querySelector('.person-record-person-name').textContent=(first+' '+last).trim();
        }
        memberSaveMessage='';refreshMemberSaveState();
      });
      window.MemberCareer?.summary(article);
      main.append(article);
    });
    box.replaceChildren(shell);shell.append(sidebar,main);
    if(!box.dataset.personRecordBound){
      box.dataset.personRecordBound='1';
      box.addEventListener('click',event=>{
        const choice=event.target.closest('[data-record-choice]');
        if(choice){selectRecord(choice.dataset.recordChoice);return;}
        const tab=event.target.closest('[data-record-tab]');if(tab)setActiveTab(tab.closest('.ux-member'),tab.dataset.recordTab);
      });
    }
    ensureMemberSaveBar();
    const current=rows.some(row=>row.dataset.memberId===openMemberId)?openMemberId:rows[0].dataset.memberId;
    selectRecord(current);filterMembers();refreshMemberSaveState();
    window.MemberRecordsPrint?.updateForm();
  }
  function changedMemberRows(){
    return [...byId('memberAdmin').querySelectorAll('[data-member-id]')].filter(row=>row.hasAttribute('data-member-dirty')||row.querySelector('.dr-pin-editor[data-dirty]'));
  }
  function refreshMemberSaveState(){
    const count=changedMemberRows().length,button=byId('membersSaveAll'),discard=byId('membersDiscardAll'),status=byId('membersSaveStatus');
    if(!button)return;
    button.textContent=memberSaving?'Änderungen werden gespeichert …':'Alle Änderungen speichern'+(count?' ('+count+')':'');
    button.disabled=memberSaving||!count;discard.disabled=memberSaving||!count;
    document.querySelectorAll('#memberAdmin article.ux-member').forEach(row=>{
      const pending=row.hasAttribute('data-member-dirty')||Boolean(row.querySelector('.dr-pin-editor[data-dirty]'));
      const nav=[...byId('memberAdmin').querySelectorAll('[data-record-choice]')].find(item=>item.dataset.recordChoice===row.dataset.memberId);
      nav?.classList.toggle('is-pending',pending);
      if(nav)nav.title=pending?'Ungespeicherte Änderungen':'Personalakte öffnen';
    });
    status.textContent=memberSaving?'Bitte die Speicherung abwarten.':memberSaveMessage||(count?count+' Mitglied'+(count===1?'':'er')+' mit offenen Änderungen.':'Keine offenen Änderungen.');
  }
  function ensureMemberSaveBar(){
    if(byId('membersSaveBar'))return;
    const bar=document.createElement('section');bar.id='membersSaveBar';bar.className='member-save-bar';bar.setAttribute('aria-label','Mitglieder gemeinsam speichern');
    bar.innerHTML='<p id="membersSaveStatus" role="status" aria-live="polite"></p><div><button id="membersSaveAll" type="button" class="primary-button">Alle Änderungen speichern</button><button id="membersDiscardAll" type="button" class="outline-button">Änderungen verwerfen</button></div>';
    byId('memberAdmin').before(bar);
    byId('membersSaveAll').onclick=()=>saveMemberRows(changedMemberRows());
    byId('membersDiscardAll').onclick=()=>{
      if(memberSaving||!requireAdmin('settingsMembersView')||!confirm('Alle noch nicht gespeicherten Mitgliederänderungen und PIN-Eingaben verwerfen?'))return;
      dirtyRows().forEach(row=>{delete row.dataset.memberDirty;delete row.dataset.dirty;});
      memberSaveMessage='Offene Änderungen verworfen.';renderAdmin();
    };
  }
  async function saveMemberRows(rows){
    if(memberSaving||!rows.length||!requireAdmin('settingsMembersView'))return;
    const jobs=rows.map(row=>({row,id:row.dataset.memberId,pin:row.querySelector('[data-dr-new-pin]')?.value||''}));
    for(const job of jobs){
      if(job.pin&&!/^\d{4}$/.test(job.pin)){
        job.row.open=true;job.row.querySelector('[data-dr-pin-status]').textContent='Bitte vier Ziffern eingeben.';
        job.row.querySelector('[data-dr-new-pin]').focus();return;
      }
    }
    const dataJobs=jobs.filter(job=>job.row.hasAttribute('data-member-dirty'));
    // Validate every row before committing member data or any independent PIN write.
    for(const job of dataJobs){try{prepareMemberUpdate(job.id,job.row);}catch(error){selectRecord(job.id);setActiveTab(job.row,/Laufbahn|Erwerbsdatum|Bezeichnung/.test(error.message)?'career':/Führerschein|Maschinist/.test(error.message)?'roles':'evidence');showToast(error.message,'error');job.row.scrollIntoView({block:'center'});return;}}
    const box=byId('memberAdmin');memberSaving=true;box.inert=true;refreshMemberSaveState();
    let pinFailed=0,completed=false;
    try{
      if(!updateMembers(dataJobs))return;
      for(const job of jobs){
        if(!job.pin)continue;
        const button=job.row.querySelector('[data-dr-save-pin]');
        const saved=await window.Drinks.saveAdminPin(button);
        job.row.dataset.pinOutcome=saved?'PIN in OneDrive gespeichert':'PIN nicht gespeichert · bitte erneut eingeben';
        if(!saved)pinFailed++;
        job.row.querySelector('.ux-member-status').textContent='Mitgliederdaten: '+getAppStorageState().text+' · '+job.row.dataset.pinOutcome;
      }
      memberSaveMessage=(dataJobs.length?dataJobs.length+' Mitglied'+(dataJobs.length===1?'':'er')+' auf diesem Gerät gespeichert. OneDrive-Synchronisierung folgt. ':'')+(pinFailed?pinFailed+' PIN nicht gespeichert. Bitte erneut eingeben.':jobs.some(job=>job.pin)?'PIN-Eingaben in OneDrive gespeichert.':'');
      completed=true;
    }catch(error){
      memberSaveMessage='Speicherung nicht abgeschlossen. Bitte die Angaben und den Speicherstatus prüfen.';showToast(error.message||memberSaveMessage,'error');
    }finally{
      memberSaving=false;box.inert=false;
      // Keep per-member results visible; a later list refresh still respects other drafts.
      if(completed&&!pinFailed&&!dirtyRows().length)renderAdmin();
      refreshMemberSaveState();
    }
  }
  function historyStatus(text,last){
    if(text!==undefined)historyMessage=text;if(last)lastHistoryLoad=last;
    for(const id of ['settingsHistoryView','settingsStatisticsView']){
      const view=byId(id);if(!view)continue;
      let box=view.querySelector('.ux-history-status');
      if(!box){box=document.createElement('div');box.className='ux-history-status';box.innerHTML='<p role="status"></p><button class="outline-button" type="button">Erneut laden</button>';view.querySelector('.screen-heading')?.after(box);box.querySelector('button').onclick=()=>window.loadOneDriveHistory?.({manual:true});}
      box.querySelector('p').textContent=[lastHistoryLoad?'Stand: '+new Date(lastHistoryLoad).toLocaleString('de-DE'):'Noch kein OneDrive-Abruf in dieser Sitzung abgeschlossen.',historyMessage].filter(Boolean).join(' · ');
      box.classList.toggle('is-error',Boolean(window.oneDriveHistoryLastError));
    }
  }
  function statistics(){
    const grid=byId('settingsStatisticsView')?.querySelector('.statistics-grid');if(!grid)return;
    [...grid.children].forEach((panel,index)=>{
      if(index===0||panel.id==='statisticsVisualDashboard'||panel.id==='smartDataQualityPanel'||panel.dataset.collapsibleBound)return;
      const title=panel.querySelector('h3')?.textContent;if(!title)return;
      makeStatisticsPanelCollapsible(panel,title);
    });
  }
  function entryEditor(id){
    const entry=todayEntries().find(e=>e.id===id);if(!entry)return;
    let dialog=byId('entryStatusDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='entryStatusDialog';dialog.innerHTML='<form><h2>Status ändern</h2><p data-entry-person></p><label for="entryStatusSelect">Status</label><select id="entryStatusSelect" class="text-input"></select><div class="ux-dialog-actions"><button type="button" class="outline-button" data-entry-cancel>Abbrechen</button><button type="submit" class="primary-button">Status speichern</button></div></form>';document.body.append(dialog);dialog.querySelector('[data-entry-cancel]').onclick=()=>dialog.close();}
    const options=sessionType==='Einsatz'?['Anwesend']:sessionType==='Allgemeine Probe'?['Anwesend','Entschuldigt','Orga']:sessionType==='Sonderprobe'?['Anwesend','Entschuldigt','Betrifft nicht']:['Anwesend','Entschuldigt'];
    dialog.querySelector('[data-entry-person]').textContent=entry.displayName;
    byId('entryStatusSelect').innerHTML=options.map(s=>`<option>${s}</option>`).join('');byId('entryStatusSelect').value=entry.role==='Orga'?'Orga':entry.status;
    dialog.querySelector('form').onsubmit=event=>{
      event.preventDefault();const value=byId('entryStatusSelect').value;entry.status=value==='Orga'?'Anwesend':value;
      entry.role=value==='Orga'?'Orga':value!=='Anwesend'?'':sessionType==='Unterricht'?'Unterricht':sessionType==='Ausschuss Sitzung'?'Ausschuss Sitzung':entry.role==='Orga'?'':entry.role;
      currentTacticsSlots=[];saveEntries();renderEntries();renderMembers();updateSelection();dialog.close();showToast('Status gespeichert. Die Taktik wird beim nächsten Öffnen neu berechnet.');
    };dialog.showModal();
  }
  function initialize(){
    ready=true;
    const hint=document.createElement('p');hint.id='attendanceDraftStatus';hint.className='ux-save-status';hint.setAttribute('role','status');if(byId('attendanceOptionsBody'))byId('attendanceOptionsBody').append(hint);else byId('members')?.before(hint);attendanceState();
    const actions=document.createElement('details');actions.className='ux-other-actions';actions.innerHTML='<summary>Weitere Aktionen</summary>';
    const reset=byId('resetTodayParticipantsButton');if(reset){const explanation=reset.closest('.today-reset-area')?.querySelector('small');reset.before(actions);actions.append(reset);if(explanation)actions.append(explanation);}else byId('attendanceView').append(actions);
    byId('entries').addEventListener('click',event=>{const button=event.target.closest('[data-edit-entry]');if(button)entryEditor(button.dataset.editEntry);});
    // Accessible full status names are generated at the same time as the member tiles.
    const labelButtons=()=>byId('members')?.querySelectorAll('[data-quick-status]').forEach(button=>{
      const member=members.find(p=>p.id===button.dataset.quickMember);button.setAttribute('aria-label',`${member?nameForTile(member):'Mitglied'} als ${button.dataset.quickStatus} markieren`);
    });labelButtons();new MutationObserver(labelButtons).observe(byId('members'),{childList:true,subtree:true});
    const view=byId('settingsHistoryView'),search=document.createElement('div');search.className='ux-search';search.innerHTML='<label for="historySearch">Bericht suchen</label><input id="historySearch" class="text-input" type="search" autocomplete="off" placeholder="Thema, Datum oder Einsatzart">';view.querySelector('.history-reports')?.prepend(search);byId('historySearch').oninput=renderHistory;
    const backup=document.createElement('section');backup.className='ux-backup-scope';backup.innerHTML='<details><summary>Was enthält die Sicherung?</summary><p>Mitglieder, Ziele, laufende Tagesdaten, Historie und gespeicherte Dokumente. Das Admin-Passwort ist nicht enthalten. Bei aktiver zentraler Kontenführung wird eine zusätzliche geprüfte OneDrive-Sicherung der Getränkekonten erstellt und in der App-Datei vermerkt.</p><p>Die Getränkesicherung und lokale Sicherungspunkte liegen ebenfalls hier. Sie wird beim Einlesen einer App-Datei nicht automatisch zurückgespielt.</p></details>';byId('exportCompleteBackupButton').closest('article')?.prepend(backup);
    byId('exportCompleteBackupButton').textContent='App-Daten sichern';byId('importCompleteBackupButton').textContent='App-Datensicherung wiederherstellen';
    renderMemberList();statistics();historyStatus();

    window.addEventListener('beforeunload',event=>{if(memberSaving||dirtyRows().length||pendingMemberStatuses.size){event.preventDefault();event.returnValue='';}});
  }
  window.Usability={beforeLeave,savedMember,hasMemberDraft:()=>memberSaving||dirtyRows().length>0,attendanceState,editEntry:entryEditor,members:renderMemberList,memberSaveState:refreshMemberSaveState,statistics,historyStatus};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
