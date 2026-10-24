/* Focused workflow feedback; drafts belong to the attendance controller. */
(function(global){
 'use strict';
 const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 let selectionUndo=null,selectionKey='',initialized=false,backupChecked=false,historyReturn=null;
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
  const recorded=todayEntries().length;
  const hasProgress=recorded>0||count>0||Boolean(currentClosingTopic)||Boolean(typeof currentOperationDraft!=='undefined'&&currentOperationDraft)||Boolean(typeof pendingDocumentReport!=='undefined'&&pendingDocumentReport?.pageCount);
  const hero=byId('attendanceStartCard'),cancel=byId('cancelCurrentTermButton');
  const view=byId('attendanceView');if(summary&&view){const progress=byId('homeFlowProgress');if(progress&&progress.nextElementSibling!==summary)progress.after(summary);else if(!progress&&summary.parentElement!==view)view.prepend(summary);}
  if(hero&&cancel){const host=homeFlowStage===1?byId('attendanceStartActions'):summary?.querySelector('.workflow-actions');if(host&&cancel.parentElement!==host)host.appendChild(cancel);cancel.hidden=!running;}
  if(summary){summary.hidden=!running||Boolean(hero)&&homeFlowStage===1;text(summary.querySelector('p'),`${sessionType} · ${new Date(today()+'T12:00:00').toLocaleDateString('de-DE')} · ${recorded} Personen übernommen${count?' · '+count+' noch nicht übernommen':''}`);summary.querySelector('button').hidden=homeFlowStage!==1;}
 }
 function beforeSelection(){selectionKey=(currentSessionId||currentOperationId||'')+'|'+sessionType;selectionUndo=new Map(pendingMemberStatuses);}
 function clearSelectionUndo(){selectionUndo=null;}
 function undoSelection(){
  if(!selectionUndo)return;const snapshot=selectionUndo;selectionUndo=null;
  const recorded=new Set(todayEntries().flatMap(e=>[e.storedName,e.displayName]));pendingMemberStatuses.clear();
  snapshot.forEach((status,id)=>{const m=members.find(p=>p.id===id);if(m&&!recorded.has(nameForStorage(m))&&!recorded.has(nameForTile(m)))pendingMemberStatuses.set(id,status);});
  chosenMemberIds=new Set(pendingMemberStatuses.keys());renderMembers();updateSelection();updateProbeWorkflow();attendance();
 }
 function terminCompleted(result){byId('workflowPackageReceipt')?.remove();const toast=byId('toast');if(toast){toast.classList.remove('visible');toast.textContent='';}global.DrinksExtras?.celebrate(0,null,{kind:'termin',result});}
 function afterView(view){if(view==='settingsHistoryView'&&historyReturn){const top=historyReturn;historyReturn=null;setTimeout(()=>window.scrollTo({top,left:0,behavior:'instant'}),0);}}
 function reset(){selectionUndo=null;backupChecked=false;historyReturn=null;const receipt=byId('workflowPackageReceipt');if(receipt){receipt.hidden=true;receipt.querySelector('[data-name]').textContent='';}}
 function backupResult(name,payload,result){
  const scope=document.querySelector('.ux-backup-scope');if(!scope)return;
  let box=byId('workflowBackupResult');if(!box){box=document.createElement('aside');box.id='workflowBackupResult';box.className='workflow-session';box.innerHTML='<p role="status"></p><button type="button" class="outline-button">Sicherung und Ablage geprüft</button>';scope.append(box);box.querySelector('button').onclick=()=>{backupChecked=true;text(box.querySelector('p'),'Sicherung und Ablage von dir bestätigt. Getränkedaten bitte separat in OneDrive sichern.');};}
  backupChecked=false;text(box.querySelector('p'),name+' · '+payload.data.members.length+' Mitglieder · '+payload.data.csvArchive.length+' Berichte · '+(result==='saved'?'In gewähltem Ordner gespeichert.':result==='shared'?'An Teilen übergeben. Ablage bitte prüfen.':'Download gestartet. Ablage bitte prüfen.')+' Getränkedaten sind separat zu sichern.');
 }
 function init(){
  initialized=true;
  const view=byId('attendanceView'),summary=document.createElement('aside');summary.id='workflowSessionSummary';summary.className='workflow-session';summary.innerHTML='<p role="status"></p><div class="workflow-actions"><button type="button" class="primary-button">Termin fortsetzen</button><button type="button" class="term-cancel-button" id="cancelCurrentTermButton"><span aria-hidden="true">×</span><span>Termin abbrechen</span></button></div>';view.prepend(summary);
  summary.querySelector('button').onclick=()=>{setHomeFlowStage(2);showView('attendanceView');};
  byId('cancelCurrentTermButton').onclick=()=>{if(discardCurrentAttendanceSession()){showView('attendanceView');attendance();}};
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
 global.WorkflowUX={storage,attendance,beforeSelection,clearSelectionUndo,connectionNotice,terminCompleted,backupResult,afterView,reset,get backupChecked(){return backupChecked;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
