/* Focused workflow feedback. Personal data stays in existing stores; no new persistence. */
(function(global){
 'use strict';
 const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 let packageFile=null,selectionUndo=null,selectionKey='',initialized=false,backupChecked=false,historyReturn=null;
 function connectionNotice(){
  const view=document.querySelector('main.app-shell > .view:not([hidden])');if(!view)return;
  let box=view.querySelector('.workflow-connection');
  if(!box){box=document.createElement('aside');box.className='workflow-connection';box.setAttribute('role','status');box.innerHTML='<p>Für diesen Verwaltungsbereich bitte OneDrive verbinden und erfolgreich synchronisieren.</p><button type="button" class="outline-button">OneDrive öffnen</button>';view.prepend(box);box.querySelector('button').onclick=()=>byId('cloudSyncButton')?.click();}
 }
 function storage(){
  if(!initialized)return;
  const state=getAppStorageState();
  document.querySelectorAll('.workflow-connection').forEach(box=>{box.hidden=oneDriveAdministrationReady();});
  document.querySelectorAll('#memberAdmin .ux-member:not([data-member-dirty]) .ux-member-status').forEach(node=>text(node,'Mitgliederdaten: '+state.text+' · '+(node.closest('[data-member-id]')?.dataset.pinOutcome||'PIN separat in OneDrive')));
  const button=byId('attendanceSyncAction');if(button){button.hidden=state.kind==='cloud';text(button,!navigator.onLine?'Offline · Verbindung prüfen':!oneDriveSignedIn()?'OneDrive verbinden':'Mit OneDrive synchronisieren');button.disabled=oneDriveBusy;}
  attendance();
 }
 function attendance(){
  if(!initialized)return;
  const key=(currentSessionId||currentOperationId||'')+'|'+sessionType;
  if(key!==selectionKey){selectionKey=key;selectionUndo=null;}
  const count=pendingMemberStatuses.size;
  text(byId('saveButton'),count?`${count} Markierung${count===1?'':'en'} übernehmen`:'Auswahl übernehmen');
  const undo=byId('attendanceUndo');if(undo)undo.hidden=!selectionUndo;
  const summary=byId('workflowSessionSummary');
  const running=Boolean(currentSessionId||currentOperationId);
  if(summary){summary.hidden=!running;text(summary.querySelector('p'),`${sessionType} · ${new Date(today()+'T12:00:00').toLocaleDateString('de-DE')} · ${todayEntries().length} Personen übernommen${count?' · '+count+' noch nicht übernommen':''}`);summary.querySelector('button').hidden=homeFlowStage!==1;}
 }
 function beforeSelection(){selectionKey=(currentSessionId||currentOperationId||'')+'|'+sessionType;selectionUndo=new Map(pendingMemberStatuses);}
 function clearSelectionUndo(){selectionUndo=null;}
 function undoSelection(){
  if(!selectionUndo)return;const snapshot=selectionUndo;selectionUndo=null;
  const recorded=new Set(todayEntries().flatMap(e=>[e.storedName,e.displayName]));pendingMemberStatuses.clear();
  snapshot.forEach((status,id)=>{const m=members.find(p=>p.id===id);if(m&&!recorded.has(nameForStorage(m))&&!recorded.has(nameForTile(m)))pendingMemberStatuses.set(id,status);});
  chosenMemberIds=new Set(pendingMemberStatuses.keys());renderMembers();updateSelection();updateProbeWorkflow();attendance();
 }
 function packageReady(name,blob,result){
  if(!['shared','downloaded'].includes(result))return;packageFile={name,blob,result};
  let box=byId('workflowPackageReceipt');if(!box){box=document.createElement('article');box.id='workflowPackageReceipt';box.className='panel workflow-package-receipt';box.innerHTML='<h3>Terminpaket erstellt</h3><p data-name></p><p data-status role="status"></p><div class="workflow-actions"><button type="button" class="primary-button" data-again>Erneut teilen / herunterladen</button><button type="button" class="outline-button" data-confirm>Ablage geprüft</button><button type="button" class="outline-button" data-dismiss>Schließen</button></div>';byId('attendanceView').prepend(box);
   box.querySelector('[data-again]').onclick=async()=>{if(!packageFile)return;const button=box.querySelector('[data-again]');button.disabled=true;try{await saveTerminPackage(packageFile.name,packageFile.blob);}finally{button.disabled=false;}};
   box.querySelector('[data-confirm]').onclick=()=>{text(box.querySelector('[data-status]'),'Ablage von dir bestätigt.');box.querySelector('[data-confirm]').hidden=true;};
   box.querySelector('[data-dismiss]').onclick=()=>{box.hidden=true;packageFile=null;};
  }
  box.hidden=false;box.querySelector('[data-confirm]').hidden=false;text(box.querySelector('[data-name]'),name);
  text(box.querySelector('[data-status]'),result==='shared'?'An den Teilen-Dialog übergeben. Bitte prüfen, ob die ZIP in deinem OneDrive-Ordner liegt.':'Download gestartet. Bitte die heruntergeladene ZIP in deinem OneDrive-Ordner ablegen.');
 }
 function afterView(view){if(view==='settingsHistoryView'&&historyReturn){const top=historyReturn;historyReturn=null;setTimeout(()=>window.scrollTo({top,left:0,behavior:'instant'}),0);}}
 function reset(){packageFile=null;selectionUndo=null;backupChecked=false;historyReturn=null;const receipt=byId('workflowPackageReceipt');if(receipt){receipt.hidden=true;receipt.querySelector('[data-name]').textContent='';}}
 function backupResult(name,payload,result){
  const scope=document.querySelector('.ux-backup-scope');if(!scope)return;
  let box=byId('workflowBackupResult');if(!box){box=document.createElement('aside');box.id='workflowBackupResult';box.className='workflow-session';box.innerHTML='<p role="status"></p><button type="button" class="outline-button">Sicherung und Ablage geprüft</button>';scope.append(box);box.querySelector('button').onclick=()=>{backupChecked=true;text(box.querySelector('p'),'Sicherung und Ablage von dir bestätigt. Getränkedaten bitte separat in OneDrive sichern.');};}
  backupChecked=false;text(box.querySelector('p'),name+' · '+payload.data.members.length+' Mitglieder · '+payload.data.csvArchive.length+' Berichte · '+(result==='saved'?'In gewähltem Ordner gespeichert.':result==='shared'?'An Teilen übergeben. Ablage bitte prüfen.':'Download gestartet. Ablage bitte prüfen.')+' Getränkedaten sind separat zu sichern.');
 }
 function init(){
  initialized=true;
  const view=byId('attendanceView'),summary=document.createElement('aside');summary.id='workflowSessionSummary';summary.className='workflow-session';summary.innerHTML='<p role="status"></p><button type="button" class="primary-button">Termin fortsetzen</button>';view.prepend(summary);
  summary.querySelector('button').onclick=()=>{setHomeFlowStage(2);showView('attendanceView');};
  const hint=byId('attendanceDraftStatus');if(hint){const actions=document.createElement('div');actions.className='workflow-actions';actions.innerHTML='<button id="attendanceUndo" type="button" class="outline-button" hidden>Letzte Markierung zurücknehmen</button><button id="attendanceSyncAction" type="button" class="outline-button">OneDrive verbinden</button>';hint.after(actions);byId('attendanceUndo').onclick=undoSelection;byId('attendanceSyncAction').onclick=()=>{if(!oneDriveSignedIn()||navigator.onLine===false)byId('cloudSyncButton')?.click();else syncOneDrive({manual:true,refreshHistory:false});};}
  const history=byId('historySearch')?.closest('.ux-search');if(history){const filters=document.createElement('div');filters.className='workflow-history-filters';filters.innerHTML='<label>Terminart<select id="historyTypeFilter" class="text-input"><option value="">Alle Terminarten</option>'+['Allgemeine Probe','Sonderprobe','Unterricht','Ausschuss Sitzung','Einsatz'].map(t=>`<option>${t}</option>`).join('')+'</select></label><label>Von<input id="historyFromFilter" class="text-input" type="date"></label><label>Bis<input id="historyToFilter" class="text-input" type="date"></label><button type="button" class="outline-button">Filter zurücksetzen</button>';history.append(filters);filters.onchange=()=>renderHistory();filters.querySelector('button').onclick=()=>{filters.querySelectorAll('input,select').forEach(n=>n.value='');byId('historySearch').value='';renderHistory();};}
  const names={'probeTypes':'Welche Terminarten finden statt?','probeTopics':'Welche Themen wurden behandelt?','topVisitors':'Wer nimmt am häufigsten teil?','breathingClearanceList':'Welche Atemschutznachweise laufen ab?'};
  for(const [id,title] of Object.entries(names)){const panel=byId(id)?.closest('article');const heading=panel?.querySelector('h3');if(heading)text(heading,title);const details=panel?.querySelector('details.statistics-collapsible summary span');if(details)text(details,title);}
  const backup=byId('settingsFilesView');if(backup){const title=backup.querySelector('h2');if(title)text(title,'Berichte und Sicherungen');}
  document.addEventListener('input',event=>{if(event.target.id==='probeDateInput')attendance();});
  document.addEventListener('change',event=>{if(event.target.id==='probeDateInput')attendance();});
  new MutationObserver(attendance).observe(view,{attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('click',event=>{if(event.target.closest('[data-history-pdf],[data-history-correct]'))historyReturn=window.scrollY;});document.addEventListener('close',event=>{if(['historyPdfPreviewDialog','archiveCorrectionDialog'].includes(event.target.id)&&byId('settingsHistoryView')?.hidden===false)afterView('settingsHistoryView');},true);
  global.addEventListener('online',storage);global.addEventListener('offline',storage);storage();
 }
 global.WorkflowUX={storage,attendance,beforeSelection,clearSelectionUndo,connectionNotice,packageReady,backupResult,afterView,reset,get backupChecked(){return backupChecked;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
