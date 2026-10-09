/* Gemeinsame Bedienhilfen. Keine PINs oder Getränkebuchungen im Gerätespeicher. */
(function(){
  'use strict';
  let ready=false,memberQuery='',openMemberId='',lastHistoryLoad='',historyMessage='';
  const dirtyRows=()=>[...document.querySelectorAll('#memberAdmin [data-member-dirty],#memberAdmin .dr-pin-editor[data-dirty]')];
  function beforeLeave(view){
    if(view==='settingsMembersView'||byId('settingsMembersView')?.hidden!==false||!dirtyRows().length)return true;
    if(!confirm('Ungespeicherte Mitgliederdaten oder PIN-Eingaben verwerfen und diese Seite verlassen?'))return false;
    dirtyRows().forEach(row=>{delete row.dataset.memberDirty;delete row.dataset.dirty;});renderAdmin();return true;
  }
  function savedMember(row){delete row.dataset.memberDirty;}
  function attendanceState(){
    const hint=byId('attendanceDraftStatus');if(!hint)return;
    const count=pendingMemberStatuses.size;
    hint.textContent=count?`${count} Änderung${count===1?'':'en'} noch nicht übernommen`:`${todayEntries().length} Anmeldung${todayEntries().length===1?'':'en'} für diesen Termin übernommen`;
    const cloud=document.createElement('small');cloud.id='attendanceCloudStatus';cloud.textContent=(count?'Letzter übernommener Stand: ':'')+getAppStorageState().text;hint.append(cloud);
    hint.classList.toggle('is-pending',count>0);
  }
  function filterMembers(){
    const query=memberQuery.trim().toLocaleLowerCase('de');let count=0;
    document.querySelectorAll('#memberAdmin details[data-member-id]').forEach(row=>{row.hidden=!row.querySelector('summary').textContent.toLocaleLowerCase('de').includes(query);if(!row.hidden)count++;});
    byId('memberSearchStatus').textContent=count?`${count} Mitglied${count===1?'':'er'} gefunden`:'Kein Mitglied gefunden. Suche nach Vor- oder Nachname.';
  }
  function renderMemberList(){
    if(!ready)return;
    const box=byId('memberAdmin');
    if(!byId('memberSearch')){
      const search=document.createElement('div');search.className='ux-search';
      search.innerHTML='<label for="memberSearch">Mitglied suchen</label><input id="memberSearch" class="text-input" type="search" placeholder="Vor- oder Nachname" autocomplete="off"><p id="memberSearchStatus" role="status"></p>';
      box.before(search);byId('memberSearch').value=memberQuery;
      byId('memberSearch').addEventListener('input',event=>{memberQuery=event.target.value;filterMembers();});
    }
    box.querySelectorAll('article.admin-row').forEach(article=>{
      const id=article.querySelector('[data-save-member]').dataset.saveMember,header=article.querySelector('.member-card-header');
      const row=document.createElement('details');row.className='admin-row member-card ux-member';row.dataset.memberId=id;
      const summary=document.createElement('summary');summary.innerHTML=header.innerHTML+'<span class="ux-member-open">Bearbeiten</span>';
      header.remove();row.append(summary);while(article.firstChild)row.append(article.firstChild);article.replaceWith(row);
      row.querySelector('[data-save-member]').textContent='Mitglied speichern';
      const dirty=document.createElement('p');dirty.className='ux-member-status';dirty.setAttribute('role','status');dirty.textContent='Mitgliederdaten gespeichert · PIN separat speichern';row.querySelector('.member-card-actions').before(dirty);
      // Names are the quick edit. Qualifications remain grouped inside native disclosures.
      const roles=row.querySelector('.member-role-editor'),safety=row.querySelector('.member-safety-settings');
      for(const [node,title] of [[roles,'Funktionen und Fahrberechtigungen'],[safety,'Nachweise und Atemschutz']]){
        if(!node)continue;const details=document.createElement('details');details.className='ux-member-section';details.innerHTML=`<summary>${title}</summary>`;node.before(details);details.append(node);
      }
      row.addEventListener('input',event=>{
        const pin=event.target.closest('.dr-pin-editor');if(pin){pin.dataset.dirty=event.target.value?'1':'';if(!event.target.value)delete pin.dataset.dirty;pin.querySelector('[data-dr-pin-status]').textContent=event.target.value?'PIN noch nicht gespeichert. „PIN in OneDrive speichern“ antippen.':'PIN wird separat gespeichert.';}
        else {row.dataset.memberDirty='1';dirty.textContent='Mitgliederdaten noch nicht gespeichert';}
      });
      row.open=id===openMemberId;
      row.addEventListener('toggle',()=>{
        if(!row.isConnected)return;
        if(!row.open){if(openMemberId===id)openMemberId='';return;}
        openMemberId=id;
        box.querySelectorAll('details.ux-member[open]').forEach(other=>{if(other!==row)other.open=false;});
        window.Drinks?.loadPinStatus(row);
      });
    });
    filterMembers();
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
      currentTacticsSlots=[];currentAtueMember=null;saveEntries();renderEntries();renderMembers();updateSelection();dialog.close();showToast('Status gespeichert. Die Taktik wird beim nächsten Öffnen neu berechnet.');
    };dialog.showModal();
  }
  function initialize(){
    ready=true;
    // Keep reports in the menu instead of behind a configuration page.
    for(const [id,text,fn] of [['historyTab','Historie',()=>{renderHistory();showView('settingsHistoryView');window.loadOneDriveHistory?.();}],['statisticsTab','Statistik',()=>{renderStatistics();showView('settingsStatisticsView');}]]){
      let button=byId(id);if(!button){button=document.createElement('button');button.id=id;button.type='button';button.className='compact-menu-button';byId('settingsTab').before(button);}
      const clean=button.cloneNode(true);button.replaceWith(clean);clean.textContent=text;clean.onclick=fn;
    }
    for(const id of ['drinksTab','historyTab','statisticsTab','settingsTab','helpTab'])byId('compactMenu').append(byId(id));
    const hint=document.createElement('p');hint.id='attendanceDraftStatus';hint.className='ux-save-status';hint.setAttribute('role','status');byId('members')?.before(hint);attendanceState();
    const actions=document.createElement('details');actions.className='ux-other-actions';actions.innerHTML='<summary>Weitere Aktionen</summary><button class="danger-button" type="button" id="discardCurrentSessionButton">Termin verwerfen</button>';
    const reset=byId('resetTodayParticipantsButton');if(reset){reset.before(actions);actions.append(reset);}else byId('attendanceView').append(actions);
    byId('discardCurrentSessionButton').onclick=()=>{if(discardCurrentAttendanceSession())showView('attendanceView');};
    byId('entries').addEventListener('click',event=>{const button=event.target.closest('[data-edit-entry]');if(button)entryEditor(button.dataset.editEntry);});
    // Accessible full status names are generated at the same time as the member tiles.
    const labelButtons=()=>byId('members')?.querySelectorAll('[data-quick-status]').forEach(button=>{
      const member=members.find(p=>p.id===button.dataset.quickMember);button.setAttribute('aria-label',`${member?nameForTile(member):'Mitglied'} als ${button.dataset.quickStatus} markieren`);
    });labelButtons();new MutationObserver(labelButtons).observe(byId('members'),{childList:true,subtree:true});
    const view=byId('settingsHistoryView'),search=document.createElement('div');search.className='ux-search';search.innerHTML='<label for="historySearch">Bericht suchen</label><input id="historySearch" class="text-input" type="search" autocomplete="off" placeholder="Thema, Datum oder Einsatzart">';view.querySelector('.history-reports')?.prepend(search);byId('historySearch').oninput=renderHistory;
    const backup=document.createElement('section');backup.className='ux-backup-scope';backup.innerHTML='<h3>Was wird gesichert?</h3><p><strong>App-Daten sichern:</strong> Mitglieder, Ziele, Tagesdaten, Archiv und gespeicherte Dokumente. Getränkekonten, Getränke-PINs und das lokale Admin-Passwort sind nicht enthalten.</p><details><summary>Getränkedaten sichern und wiederherstellen</summary><p>In OneDrive den gesamten Unterordner <strong>Getraenke</strong> einschließlich aller Kontodateien kopieren oder herunterladen. Zur Wiederherstellung die gesicherten Dateien in diesen Ordner zurückkopieren. Mitgliederkennungen müssen erhalten bleiben. Vor dem Ersetzen keine Buchungen durchführen.</p><p>Diese Dateien enthalten persönliche Kontodaten und PIN-Ableitungen. Sie bleiben bei der getrennten OneDrive-Sicherung.</p></details><p><strong>Terminpaket:</strong> ein Termin mit CSV und PDF, gegebenenfalls Zusatzdokument. Automatische Sicherungspunkte sichern den lokalen App-Zustand vor bestimmten Änderungen.</p>';byId('exportCompleteBackupButton').closest('article')?.prepend(backup);
    byId('exportCompleteBackupButton').textContent='App-Daten sichern';byId('importCompleteBackupButton').textContent='App-Datensicherung wiederherstellen';
    renderMemberList();statistics();historyStatus();
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&adminUnlocked)lockAdministration();});
    window.addEventListener('beforeunload',event=>{if(dirtyRows().length||pendingMemberStatuses.size){event.preventDefault();event.returnValue='';}});
  }
  window.Usability={beforeLeave,savedMember,hasMemberDraft:()=>dirtyRows().length>0,attendanceState,editEntry:entryEditor,members:renderMemberList,statistics,historyStatus};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
