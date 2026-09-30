// Kompatibilität: bestehende Datensätze mit früherem Statusnamen übernehmen.
(function migrateOrganisationToOrga(){
  if(typeof entries!=="undefined")entries.forEach(entry=>{if(entry.status==="Organisation")entry.status="Orga";if(entry.role==="Organisation")entry.role="Orga";});
  if(typeof csvArchive!=="undefined")csvArchive.forEach(item=>{if(typeof item.content==="string")item.content=item.content.replaceAll("Organisation","Orga");});
})();

let pendingSettingsTarget="";

function cleanLegacyShell(){
  [...document.body.childNodes].forEach(node=>{
    if(node.nodeType===Node.TEXT_NODE && /Anwesenheit\s*(?:1\.3|2\.0)/i.test(node.textContent||""))node.remove();
  });
  document.querySelectorAll("body *").forEach(element=>{
    if(element.children.length===0 && /^\s*Anwesenheit\s*(?:1\.3|2\.0)\s*$/i.test(element.textContent||""))element.remove();
  });
  const title=document.querySelector("#attendanceView .participant-title");if(title)title.hidden=true;
  const legacyHeader=byId("headerSessionType");if(legacyHeader){legacyHeader.hidden=true;legacyHeader.setAttribute("aria-hidden","true");}
  document.querySelectorAll(".header-session-type,[data-legacy-workflow-title]").forEach(element=>element.remove());
  document.querySelectorAll("body *").forEach(element=>{if(element.children.length===0&&/^\s*Taktik\s*&\s*Abschluss\s*$/i.test(element.textContent||""))element.remove();});
}

function removeTacticsMenuEntry(){
  const tacticsTab=byId("tacticsTab");
  if(tacticsTab)tacticsTab.remove();
  document.querySelectorAll("#compactMenu button,#compactMenu a").forEach(item=>{if(/^\s*Taktik\s*$/i.test(item.textContent||""))item.remove();});
}

function moveProbeStatusToHeader(){
  const brand=document.querySelector(".top-brand span");if(brand)brand.textContent="Feuerwehr Wasser";
  document.title="Feuerwehr Wasser";
  const homeButton=byId("attendanceTab");if(homeButton)homeButton.textContent="Home";
  const menuButton=byId("menuToggleButton");if(menuButton)menuButton.textContent="Menü";

  const original=byId("homeCurrentProbeStatus"),menu=byId("compactMenu");if(!original||!menu)return;
  original.hidden=true;
  if(byId("headerProbeSummary"))return;
  const summary=document.createElement("div");summary.id="headerProbeSummary";summary.className="header-probe-summary";
  summary.innerHTML=`<span class="header-probe-dot" aria-hidden="true"></span><span class="header-probe-type" id="headerProbeType">Keine laufende Probe</span><span class="header-probe-count"><strong id="headerPresentCount">0</strong> anwesend</span><span class="header-probe-count"><strong id="headerExcusedCount">0</strong> entschuldigt</span>`;
  const legacy=byId("headerSessionType");if(legacy)legacy.hidden=true;
  const nav=document.querySelector(".participant-nav");
  nav?.appendChild(summary);
  const sync=()=>{
    const previewType=byId("sessionTypes")?.dataset.selectedSessionType||pendingSessionType||"";
    byId("headerProbeType").textContent=homeFlowStage===1?(previewType||"Keine laufende Probe"):sessionType;
    byId("headerPresentCount").textContent=byId("todayCount")?.textContent||"0";
    byId("headerExcusedCount").textContent=byId("excusedCount")?.textContent||"0";
    const active=homeFlowStage>1||Boolean(previewType);
    summary.classList.toggle("is-active",active);
    summary.classList.toggle("is-preview",homeFlowStage===1&&Boolean(previewType));
    summary.hidden=!active;
  };
  new MutationObserver(sync).observe(original,{subtree:true,childList:true,characterData:true});
  window.syncHeaderProbeSummary=sync;sync();
}

function setupSinglePageHome(){
  setupUnifiedHomeWorkflow();
  const attendance=byId("attendanceView"),tactics=byId("tacticsView");
  if(attendance&&tactics&&tactics.parentElement!==attendance){tactics.classList.add("home-inline-tactics");tactics.hidden=true;attendance.appendChild(tactics);}
  tactics?.querySelectorAll("[data-home-button]").forEach(button=>button.remove());
}

function ensureSettingsNavigation(){
  const button=byId("settingsTab");
  const section=byId("settingsView");
  if(!button||!section)return;
  if(!button.dataset.bound){
    button.dataset.bound="true";
    button.addEventListener("click",()=>showView("settingsView"));
  }
  const home=section.querySelector("[data-settings-home]");
  if(home&&!home.dataset.bound){
    home.dataset.bound="true";
    home.addEventListener("click",()=>showView("attendanceView"));
  }
  section.querySelectorAll("[data-settings-page]").forEach(pageButton=>{
    if(pageButton.dataset.bound)return;
    pageButton.dataset.bound="true";
    pageButton.addEventListener("click",()=>{
      const target=pageButton.dataset.settingsPage;
      pendingSettingsTarget=target;
      if(pageButton.hasAttribute("data-protected")&&!adminUnlocked)return showView("adminLoginView");
      if(pageButton.hasAttribute("data-archive-protected")&&!adminUnlocked)return showView("archiveLoginView");
      showView(target);
      if(target==="settingsStatisticsView")renderStatistics();
      if(target==="settingsHistoryView")renderHistory();
      if(target==="settingsFilesView"){ensurePdfFolderControls();ensureArchiveStorageCenter();renderArchive();}
      pendingSettingsTarget="";
    });
  });
}
function restructureMainViews(){
  ensureSettingsNavigation();
  const attendance=byId("attendanceView"),admin=byId("adminView");
  const statusPanel=byId("todayCount")?.closest("article");
  if(statusPanel && attendance && !byId("homeCurrentProbeStatus")){
    const wrapper=document.createElement("section");wrapper.id="homeCurrentProbeStatus";wrapper.className="home-current-probe-status";
    wrapper.innerHTML=`<div class="home-status-heading"><div><p class="eyebrow">Laufende Probe</p><h3>Aktueller Probenstatus</h3></div></div>`;
    wrapper.appendChild(statusPanel);
    const sessionPanel=attendance.querySelector(".home-session-type-panel");sessionPanel?.insertAdjacentElement("afterend",wrapper);
    statusPanel.querySelector(".panel-heading")?.remove();
    const help=statusPanel.querySelector(".help-text");if(help)help.textContent="Live-Übersicht der aktuell erfassten Teilnahmen.";
  }
  const probeSection=byId("admin-probe");if(probeSection)probeSection.remove();
  const dataSection=byId("admin-data");
  if(dataSection){
    dataSection.querySelectorAll("article").forEach(article=>{if(!article.querySelector("#newPin")&&!article.querySelector("#repeatPin")&&!article.querySelector("#changePinButton"))article.remove();});
    const heading=dataSection.querySelector("header h3");if(heading)heading.textContent="Sicherheit";
    const description=dataSection.querySelector("header p");if(description)description.textContent="Admin-Passwort verwalten.";
  }
  const nav=admin?.querySelector(".admin-section-nav");if(nav)nav.innerHTML=`<a href="#admin-settings">1 · Funktionsziele</a><a href="#changePinButton">2 · Passwort ändern</a><a href="#admin-members">3 · Mitglieder</a>`;
  const intro=admin?.querySelector(".screen-heading h2");if(intro)intro.textContent="Administration";
  if(admin){
    const settingsSection=byId("admin-settings"),pinArticle=byId("changePinButton")?.closest("article");
    if(settingsSection&&pinArticle){
      let grid=settingsSection.querySelector(".admin-goal-pin-grid");
      if(!grid){grid=document.createElement("div");grid.className="admin-goal-pin-grid";[...settingsSection.querySelectorAll(":scope > article")].forEach(article=>grid.appendChild(article));settingsSection.appendChild(grid);}
      pinArticle.classList.add("admin-pin-card");grid.appendChild(pinArticle);if(dataSection)dataSection.hidden=true;
    }
    admin.querySelectorAll(".admin-card-number").forEach(badge=>badge.remove());
  }
  const sub=admin?.querySelector(".screen-heading .eyebrow");if(sub)sub.textContent="Mitglieder, Ziele und Sicherheit";
  ["adminView","statisticsView","archiveView"].forEach(id=>{const b=byId(id)?.querySelector("[data-home-button]");if(b)b.textContent="Zurück zu Einstellungen";});
}

function buildSettingsSubpages(){
  const main=document.querySelector("main.app-shell"),legacyAdmin=byId("adminView");
  const makePage=(id,title,description,node)=>{
    let page=byId(id);
    if(!page){page=document.createElement("section");page.id=id;page.className="view settings-subpage";page.hidden=true;page.innerHTML=`<div class="screen-heading"><div><p class="eyebrow">Einstellungen</p><h2>${title}</h2><p>${description}</p></div><button class="outline-button view-home-button" data-settings-back type="button">Zurück zu Einstellungen</button></div><div class="settings-subpage-content"></div>`;main.appendChild(page);page.querySelector("[data-settings-back]").addEventListener("click",()=>showView("settingsView"));}
    if(node)page.querySelector(".settings-subpage-content").appendChild(node);
    return page;
  };
  const members=byId("admin-members"),goals=byId("admin-settings"),pinArticle=byId("changePinButton")?.closest("article");
  if(pinArticle)pinArticle.remove();
  const membersPage=makePage("settingsMembersView","Mitglieder","Mitglieder, Funktionen und Berechtigungen verwalten.",members);
  const goalsPage=makePage("settingsGoalsView","Funktionsziele","Jährliche Mindestziele getrennt bearbeiten.",goals);
  makePage("settingsSecurityView","Sicherheit","Admin-Passwort für geschützte Bereiche ändern.",pinArticle);
  // Nummern aus der früheren Admin-Sammelansicht haben auf eigenständigen
  // Unterseiten keine Bedeutung mehr.
  [[membersPage,"4"],[goalsPage,"2"]].forEach(([page,legacyNumber])=>{
    page?.querySelectorAll(".step,.badge,.admin-card-number,.section-number").forEach(node=>{
      if(node.textContent.trim()===legacyNumber)node.remove();
    });
    page?.querySelectorAll("header span,header strong,header b").forEach(node=>{
      if(node.children.length===0&&node.textContent.trim()===legacyNumber)node.remove();
    });
  });
  const statistics=byId("statisticsView");if(statistics){statistics.id="settingsStatisticsView";statistics.classList.add("settings-subpage");}
  const history=byId("settingsHistoryView")||byId("historyView");if(history){history.id="settingsHistoryView";history.classList.add("settings-subpage");}
  const files=byId("settingsFilesView")||byId("archiveView");if(files){files.id="settingsFilesView";files.classList.add("settings-subpage");}
  [statistics,history,files].forEach(page=>{if(!page)return;const back=page.querySelector(".view-home-button,[data-home-button],[data-history-home]");if(back){back.textContent="Zurück zu Einstellungen";back.onclick=()=>showView("settingsView");}});
  legacyAdmin?.remove();
  document.querySelectorAll(".admin-section-nav,.admin-card-number").forEach(node=>node.remove());
  ensureArchiveStorageCenter();
  renderArchive();
  renderHistory();
  const filesTitle=byId("settingsFilesView")?.querySelector(".screen-heading h2");if(filesTitle)filesTitle.textContent="Speicherorte und Backups";
  const filesDescription=byId("settingsFilesView")?.querySelector(".screen-heading p:not(.eyebrow)");if(filesDescription)filesDescription.textContent="PDF-Speicherort und vollständige Datensicherungen verwalten.";
}

function updateHelpForCurrentFeatures(){
  const help=byId("helpView");if(!help)return;
  const sections=[...help.querySelectorAll(".help-section")];
  const completion=sections.find(section=>section.querySelector("h3")?.textContent.includes("Abschluss mit CSV und PDF"));
  if(completion) completion.innerHTML=`<h3>Probe in drei Schritten durchführen</h3><p><strong>Schritt 1:</strong> Terminart auswählen und „Weiter zu Schritt 2“ anklicken. <strong>Schritt 2:</strong> Über die Aktenreiter Anwesend, Entschuldigt und bei Sonderproben Betrifft nicht auswählen, Mitglieder markieren und speichern. „Anwesend“ ist voreingestellt. Mit „Weiter zu Schritt 3“ geht es weiter. <strong>Schritt 3:</strong> Bei einer Allgemeinen Probe erscheint die Taktik, bei Sonderprobe und Unterricht direkt der Abschluss. Beim Wechsel des Terminart werden Taktik und aktuelle Auswahl zurückgesetzt.</p><p>Der Kopfbereich zeigt nur während einer laufenden Probe die Terminart sowie die Anzahl anwesender und entschuldigter Personen. CSV, PDF und Archiv werden beim vollständigen Abschluss erzeugt beziehungsweise aktualisiert.</p>`;
  const archive=sections.find(section=>section.querySelector("h3")?.textContent.includes("Archiv und Backups"));
  if(archive) archive.innerHTML=`<h3>Archiv, Historie und Backups</h3><p>Der Menüpunkt „Historie“ zeigt abgeschlossene Probenberichte nach Kalenderjahr und Monat. Das aktuelle Jahr und der aktuelle Monat sind beim Öffnen aufgeklappt. Andere Jahres- und Monatsrubriken sind zunächst geschlossen und können über ihre Überschrift geöffnet werden. Innerhalb eines Monats stehen die Berichte nach Datum sortiert bereit. „PDF ansehen“ öffnet den jeweiligen Probenbericht. Im Bereich „Archiv & Backups“ ändert „Eintrag korrigieren“ Status oder Funktion einer Person in einer abgeschlossenen Probe. Dazu wird die Person aus einer Liste ausgewählt. Danach können Status und gegebenenfalls die Funktion angepasst werden. Die Änderung wird als neue Version dokumentiert und CSV sowie PDF werden erneut ausgegeben. Unter „Archiv & Backups“ werden die Speicherorte für CSV-Auswertungen, PDF-Berichte und Backups gemeinsam verwaltet. Jeder Dateityp kann einen eigenen Zielordner verwenden. Der neue Menüpunkt „Einstellungen“ dient als zentrale Übersicht und führt direkt zur Mitgliederverwaltung, zu den Funktionszielen, zum Passwort und zu den Speicherorten. Die eigentliche Administration enthält nur Mitglieder, jährliche Funktionsziele und das Passwort. Der aktuelle Probenstatus erscheint während einer laufenden Probe kompakt im Kopfbereich.</p>`;
  const statistics=sections.find(section=>section.querySelector("h3")?.textContent.includes("Statistik und Offline-Nutzung"));
  if(statistics) statistics.innerHTML=`<h3>Statistik, Kalenderjahr und Offline-Nutzung</h3><p>Die Statistik wertet automatisch nur das aktuelle Kalenderjahr aus. Mit dem Wechsel auf ein neues Jahr beginnt die Jahresstatistik neu. Berichte aus vergangenen Jahren bleiben in der Historie erhalten. Die getrennte Auswertung von Einsatzabteilung und Altersmannschaft bleibt bestehen. Nach einem Update die Web-App vollständig neu laden, damit der neue Offline-Cache aktiv wird.</p>`;
}
members = loadArray(KEYS.members, DEFAULT_MEMBERS);
entries = loadArray(KEYS.entries, []);
csvArchive = loadArray(KEYS.archive, []);

byId("sessionTypes")?.addEventListener("click", event => {
  const button=event.target.closest("[data-session-type]");
  if(!button)return;
  event.preventDefault();
  chooseSessionType(button.dataset.sessionType);
}, {capture:true});
byId("menuToggleButton").addEventListener("click", () => {
  const menu = byId("compactMenu");
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  byId("menuToggleButton").setAttribute("aria-expanded", String(willOpen));
});
byId("attendanceTab").addEventListener("click", () => {
  if(!requestReturnToHomeStage())return;
  showView("attendanceView");
  requestAnimationFrame(()=>byId("homeFlowProgress")?.scrollIntoView({behavior:"smooth",block:"start"}));
});
document.querySelectorAll("[data-home-button]").forEach(button => button.addEventListener("click", () => {const target=button.closest("#settingsView")?"attendanceView":"settingsView";if(target==="attendanceView"&&!requestReturnToHomeStage())return;showView(target);}));
byId("adminTab").addEventListener("click", () => showView(adminUnlocked ? "adminView" : "adminLoginView"));
byId("archiveTab").addEventListener("click", () => { if (adminUnlocked) { renderArchive(); showView("archiveView"); } else showView("archiveLoginView"); });
byId("helpTab")?.addEventListener("click", () => showView("helpView"));
byId("finalizeProbeButton").addEventListener("click", finalizeProbeFromTactics);
byId("finishAsSpecialButton")?.addEventListener("click",()=>finishTacticsAlternative("Sonderprobe"));
byId("finishAsTrainingButton")?.addEventListener("click",()=>finishTacticsAlternative("Unterricht"));
// Der zusätzliche Abbruchknopf ist redundant: Home und „Zurück zu Schritt 1“ übernehmen den Rückweg.
const cancelTacticsCloseButton=byId("cancelTacticsCloseButton");
if(cancelTacticsCloseButton)cancelTacticsCloseButton.remove();
byId("statisticsTab").addEventListener("click", () => { renderStatistics(); showView("statisticsView"); });
byId("statisticsPdfButton").addEventListener("click", exportStatisticsPdf);
byId("statisticsYearSelect").addEventListener("change",event=>{selectedStatisticsYear=event.target.value;renderStatistics();const selected=byId("individualMemberSelect").value;if(selected)renderIndividualStatistics(selected);});
byId("individualMemberSelect").addEventListener("change", event => renderIndividualStatistics(event.target.value));
byId("individualStatisticsPdfButton").addEventListener("click", exportIndividualStatisticsPdf);
byId("loginButton").addEventListener("click", login);
byId("archiveLoginButton").addEventListener("click", loginArchive);
byId("archivePin").addEventListener("keydown", event => { if (event.key === "Enter") loginArchive(); });
byId("cancelArchiveLoginButton").addEventListener("click", () => showView("attendanceView"));
byId("cancelLoginButton").addEventListener("click", () => showView("attendanceView"));
byId("adminPin").addEventListener("keydown", event => { if (event.key === "Enter") login(); });
byId("saveButton").addEventListener("click", saveAttendance);
byId("roleSaveButton").addEventListener("click", saveAttendance);
byId("backToMembersButton").addEventListener("click", backToMembers);
byId("changeStatusButton").addEventListener("click", backToMembers);
byId("resetTodayParticipantsButton").addEventListener("click", clearToday);
byId("exportResetButton").addEventListener("click", requestCloseProbe);
byId("addMemberButton").addEventListener("click", addMember);
byId("changePinButton").addEventListener("click", changePin);
byId("saveRoleTargetsButton").addEventListener("click", () => {
  const targets = {};
  byId("roleTargetInputs").querySelectorAll("[data-role-target]").forEach(input => {
    targets[input.dataset.roleTarget] = Math.max(0, Math.min(99, Number.parseInt(input.value, 10) || 0));
  });
  saveRoleTargets(targets);
  renderAdmin();
  showToast("Jährliche Funktionsziele wurden gespeichert.");
});
byId("chooseCsvFolderButton").addEventListener("click", chooseCsvFolder);
byId("clearCsvFolderButton").addEventListener("click", clearCsvFolder);
byId("chooseBackupFolderButton").addEventListener("click", chooseBackupFolder);
byId("clearBackupFolderButton").addEventListener("click", clearBackupFolder);
byId("newFirstName").addEventListener("keydown", event => { if (event.key === "Enter") addMember(); });
byId("members").addEventListener("click",event=>{const action=event.target.closest("[data-quick-member][data-quick-status]");if(action){event.preventDefault();saveQuickMemberStatus(action.dataset.quickMember,action.dataset.quickStatus);return;}const button=event.target.closest("[data-member]");if(button)chooseMember(button.dataset.member);});
byId("roles").addEventListener("click", event => { const button = event.target.closest("[data-role]"); if (button) chooseRole(button.dataset.role); });
byId("entries").addEventListener("click", event => { const button = event.target.closest("[data-entry]"); if (button) deleteEntry(button.dataset.entry); });
byId("exportCompleteBackupButton").addEventListener("click", exportCompleteBackup);
byId("importCompleteBackupButton").addEventListener("click", () => byId("completeBackupFileInput").click());
byId("completeBackupFileInput").addEventListener("change", event => { const file = event.target.files?.[0]; if (file) importCompleteBackup(file); });
byId("memberAdmin").addEventListener("click", event => {
  const save = event.target.closest("[data-save-member]");
  const remove = event.target.closest("[data-delete-member]");
  if (save) updateMember(save.dataset.saveMember, save.closest(".admin-row"));
  if (remove) deleteMember(remove.dataset.deleteMember);
});

renderSessionType();
renderMembers();
renderRoles();
renderEntries();
renderAdmin();
renderArchive();
updateSelection();
updateProbeWorkflow();
updatePrimaryAction();
ensureProbeTopicDialog();
ensureHistoryView();
ensureHistoryMenu();
ensurePdfFolderControls();
ensureArchiveStorageCenter();
restructureMainViews();
buildSettingsSubpages();
cleanLegacyShell();
setupSinglePageHome();
moveProbeStatusToHeader();
removeTacticsMenuEntry();
ensureStagedHomeFlow();
ensureRfidCsvImport();
updateHelpForCurrentFeatures();


(async function restoreCsvDirectory() {
  csvDirectoryHandle = await loadDirectoryHandle();
  backupDirectoryHandle = await loadBackupDirectoryHandle();
  pdfDirectoryHandle = await loadPdfDirectoryHandle();
  renderCsvFolderStatus();
  renderBackupFolderStatus();
  renderPdfFolderStatus();
  ensureArchiveStorageCenter();
  window.FFWReportImport?.bind();
  window.FFWReportImport?.updateHint();
})();


if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("service-worker.js").catch(() => {});
if (!safeStorage.persistent) {
  setTimeout(() => showToast("Safari erlaubt hier keine dauerhafte Speicherung. Die Sitzung funktioniert, Daten können nach dem Schließen verloren gehen.", "error"), 700);
}

/* Alte freistehende Versionsbezeichnungen entfernen, nicht umbenennen. */
function removeStandaloneAttendanceVersion(){
  if(!document.body)return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const remove=[];
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(/^\s*Anwesenheit\s*(?:1\.3|2\.0)\s*$/i.test(node.nodeValue||""))remove.push(node);
  }
  remove.forEach(node=>node.remove());
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",removeStandaloneAttendanceVersion,{once:true});
else removeStandaloneAttendanceVersion();


/* Sofortiger Seitenzugang ohne sichtbare Startseite vor der PIN-Eingabe. */
(function setupInitialPageAccess(){
  const unlockKey="fw_page_unlocked";
  const gate=byId("pageAccessGate");
  const form=byId("pageAccessForm");
  const input=byId("pageAccessPin");
  const error=byId("pageAccessError");
  const reveal=()=>{
    const content=byId("protectedAppContent");
    if(content){content.hidden=false;content.removeAttribute("aria-hidden");}
    gate?.remove();
    setTimeout(()=>{showBreathingClearanceWarnings();showDriverLicenseControlWarnings();},350);
    document.documentElement.classList.remove("page-access-pending");
    document.body.classList.remove("page-access-pending");
    byId("accessGateCriticalStyle")?.remove();
  };
  let alreadyUnlocked=false;
  try{alreadyUnlocked=sessionStorage.getItem(unlockKey)==="1";}catch(storageError){}
  if(alreadyUnlocked){reveal();return;}
  if(!gate||!form||!input){return;}
  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(input.value!==adminPassword()){
      if(error)error.hidden=false;
      input.select();
      return;
    }
    try{sessionStorage.setItem(unlockKey,"1");}catch(storageError){}
    input.value="";
    reveal();
  });
  const focusPinInput=()=>{
    input.readOnly=false;
    try{input.focus({preventScroll:true});}catch(focusError){input.focus();}
    try{input.setSelectionRange(input.value.length,input.value.length);}catch(selectionError){}
  };
  input.addEventListener("input",()=>{input.value=input.value.slice(0,64);if(error)error.hidden=true;});
  input.addEventListener("pointerdown",focusPinInput,{passive:true});
  input.addEventListener("touchend",focusPinInput,{passive:true});
  input.addEventListener("click",focusPinInput);
  document.querySelector('label[for="pageAccessPin"]')?.addEventListener("click",focusPinInput);
  gate.addEventListener("pageshow",focusPinInput);
  // Automatischer Fokus ist nur Komfort. Auf iPadOS öffnet sich die Tastatur
  // zuverlässig durch das direkte Antippen des sichtbaren PIN-Feldes.
  requestAnimationFrame(()=>{try{input.focus({preventScroll:true});}catch(focusError){}});
})();


/* Versionsanzeige der Fusszeile verbindlich setzen, auch bei altem HTML-Cache. */
// Einsatzstatistik wird getrennt durch statistics.js dargestellt.
function enforceFooterVersion(){
  const footer=document.querySelector(".app-footer");
  if(footer)footer.textContent="© 2026 Markus Bürklin · Feuerwehr Wasser 2.0 · Produktiv";
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enforceFooterVersion,{once:true});
else enforceFooterVersion();

function ensureSafetyInfoHub(){
 let button=byId("safetyInfoButton"),dialog=byId("safetyInfoDialog");
 if(!button){button=document.createElement("button");button.id="safetyInfoButton";button.type="button";button.className="safety-info-button";button.setAttribute("aria-label","Hinweise zu Atemschutz und Führerscheinkontrolle öffnen");button.innerHTML='<span aria-hidden="true">i</span><b id="safetyInfoCount">0</b>';button.hidden=true;(document.querySelector(".top-nav-actions")||document.querySelector(".top-nav")||document.body).appendChild(button);}
 if(!dialog){dialog=document.createElement("dialog");dialog.id="safetyInfoDialog";dialog.className="safety-info-dialog";dialog.innerHTML='<form method="dialog"><header><div><small>Sicherheitsinformationen</small><h2>Offene Hinweise</h2></div><button value="cancel" aria-label="Hinweise schließen">×</button></header><div id="safetyInfoContent"></div><footer><button value="cancel" class="primary-button">Schließen</button></footer></form>';document.body.appendChild(dialog);button.onclick=()=>dialog.showModal?.();}
 return {button,dialog};
}
function renderSafetyInfoHub(){
 const breathing=members.filter(member=>!member.ageDepartment&&["expired","soon"].includes(breathingClearanceState(member,systemToday()))),drivers=members.filter(member=>["missing","overdue","soon"].includes(driverLicenseControlDue(member,systemToday()))),hub=ensureSafetyInfoHub(),count=breathing.length+drivers.length;
 hub.button.hidden=count===0;byId("safetyInfoCount").textContent=String(count);hub.button.classList.toggle("has-critical",breathing.some(m=>breathingClearanceState(m,systemToday())==="expired")||drivers.some(m=>["missing","overdue"].includes(driverLicenseControlDue(m,systemToday()))));
 const row=(name,text,state)=>`<li class="safety-${state}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(text)}</span></li>`;
 const breathingRows=breathing.map(m=>row(nameForTile(m),breathingClearanceSummary(m),breathingClearanceState(m,systemToday()))).join("");
 const driverRows=drivers.map(m=>{const state=driverLicenseControlDue(m,systemToday());return row(nameForTile(m),state==="missing"?"Kontrolle fehlt":state==="overdue"?`fällig seit ${driverLicenseDueDate(m)}`:`fällig bis ${driverLicenseDueDate(m)}`,state);}).join("");
 byId("safetyInfoContent").innerHTML=`<section><h3>Atemschutz</h3>${breathingRows?`<ul>${breathingRows}</ul>`:"<p>Keine offenen Hinweise.</p>"}<button type="button" class="outline-button" data-safety-statistics>Details in der Statistik</button></section><section><h3>Führerscheinkontrolle</h3>${driverRows?`<ul>${driverRows}</ul>`:"<p>Keine offenen Hinweise.</p>"}<button type="button" class="outline-button" data-safety-members>Mitglieder verwalten</button></section>`;
 byId("safetyInfoContent").querySelector("[data-safety-statistics]").onclick=()=>{hub.dialog.close();renderStatistics();showView("settingsStatisticsView");};byId("safetyInfoContent").querySelector("[data-safety-members]").onclick=()=>{hub.dialog.close();showView("settingsMembersView");};
}
function showBreathingClearanceWarnings(){renderSafetyInfoHub();}
function showDriverLicenseControlWarnings(){renderSafetyInfoHub();}

function cleanupTemporaryBlobUiOnStartup(){
  document.querySelectorAll("#operationPdfPreviewDialog,.operation-pdf-preview-dialog,[data-blob-preview]").forEach(node=>{try{node.close?.();}catch(error){}node.remove();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",cleanupTemporaryBlobUiOnStartup,{once:true});else cleanupTemporaryBlobUiOnStartup();

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initCloudSync,{once:true});else initCloudSync();


requestAnimationFrame(()=>{for(const id of ["rolesPanel","attendanceStatusToolbar","floatingAttendanceStatusToolbar"]){const el=document.getElementById(id);if(el){el.hidden=true;el.style.setProperty("display","none","important");el.setAttribute("aria-hidden","true");}}});
