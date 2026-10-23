function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  const toast = byId("toast");
  toast.textContent = message;
  toast.className = `toast ${type} visible`;
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}
function closeCompactMenu() {
  const menu = byId("compactMenu");
  const toggle = byId("menuToggleButton");
  if (menu) menu.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}
function requireAdmin(target="settingsView",{allowDisconnected=false}={}) {
  if(!allowDisconnected&&(typeof oneDriveAdministrationReady!=="function"||!oneDriveAdministrationReady())){
    showToast("Bitte OneDrive verbinden und erfolgreich synchronisieren, bevor du diesen Verwaltungsbereich öffnest.","error");window.WorkflowUX?.connectionNotice();return false;
  }
  if(adminUnlocked&&checkAdminSession()){resetAdminTimeout();return true;}
  pendingSettingsTarget=target;
  byId("cloudSyncDialog")?.close();
  showView("adminLoginView");
  showToast("Zum Ändern bitte die Verwaltung entsperren.","error");
  return false;
}
function lockAdministration(){
  const theaterReturn=window.TheaterAdmin?.route?.();
  if(byId('pushAdminToken'))byId('pushAdminToken').value='';
  if(byId('deckel-token'))byId('deckel-token').value='';
  window.TheaterAdmin?.lock();window.PortalAdmin?.lock();window.DrinksAdminBookings?.lock();
  window.DrinksQuizQuestions?.lock();window.DrinksChallengeSettings?.lock();window.DrinksBirthdaySettings?.lock();
  adminUnlocked=false;if(typeof adminUnlockUntil!=='undefined')adminUnlockUntil=0;window.oneDriveCancelAdminReturn?.();clearTimeout(adminTimeoutId);adminTimeoutId=null;
  for(const id of ['settingsView','settingsOptionsView','settingsHistoryView','settingsStatisticsView','theaterView','settingsQuizQuestionsView','settingsBookingsView','settingsPushView','settingsDrinksView','settingsMembersView','settingsGoalsView','settingsSecurityView','settingsFilesView','settingsRemindersView','settingsRewardsView','settingsMobileView','settingsPortalView','settingsCalendarView']){
    if(byId(id)?.hidden===false){byId(id).hidden=true;pendingSettingsTarget=id==='theaterView'?(theaterReturn||'eventsView'):id;showView('adminLoginView');break;}
  }
  for(const id of ['reminderDraftDialog','adminPaypalDialog','cloudSyncDialog'])byId(id)?.close();
  renderOneDriveDialog?.();
}
function showView(viewId) {
  const requestedView=viewId;
  const theaterMode=({theaterCashView:"cash",theaterStatsView:"stats",theaterManageView:"manage"})[viewId];
  if(theaterMode)viewId="theaterView";
  if(["settingsView","settingsOptionsView","settingsHistoryView","settingsStatisticsView"].includes(viewId)&&!requireAdmin(requestedView,{allowDisconnected:true}))return false;
  if(["theaterView","settingsQuizQuestionsView","settingsBookingsView","settingsPushView","settingsDrinksView","settingsMembersView","settingsGoalsView","settingsSecurityView","settingsFilesView","settingsRemindersView","settingsRewardsView","settingsMobileView","settingsPortalView","settingsCalendarView"].includes(viewId)&&!requireAdmin(requestedView))return false;
  if(window.PortalEvidenceAdmin?.beforeView(viewId)===false)return false;
  if(window.PortalAdmin?.beforeView(viewId)===false)return false;
  if(window.TheaterAdmin?.beforeView(viewId)===false)return false;
  if(window.DrinksQuizQuestions?.beforeView(viewId)===false)return false;
  if(window.DrinksAdminBookings?.beforeView(viewId)===false)return false;
  if(window.DrinksChallengeSettings?.beforeView(viewId)===false)return false;
  if(window.DrinksBirthdaySettings?.beforeView(viewId)===false)return false;
  if(window.DrinksRewards?.beforeView(viewId)===false)return false;
  if(window.ArchiveCorrection?.beforeView(viewId)===false)return false;
  if(window.Usability?.beforeLeave(viewId)===false)return false;
  if(window.Drinks?.beforeView(viewId)===false)return false;
  if(theaterMode&&window.TheaterAdmin?.setMode(theaterMode)===false)return false;
  if(viewId==="drinksView")lockAdministration();
  clearTimeout(toastTimer);byId("toast")?.classList.remove("visible");
  closeCompactMenu();
  if(viewId!=="attendanceView")hideDocumentReportUi?.();
  document.querySelectorAll("main.app-shell > .view").forEach(view => view.hidden = view.id !== viewId);
  byId("drinksShortcut")?.classList.toggle("active",viewId==="drinksView");
  byId("attendanceTab").classList.toggle("active", viewId === "attendanceView");
  if(byId("adminTab"))byId("adminTab").classList.remove("active");if(byId("archiveTab"))byId("archiveTab").classList.remove("active");if(byId("historyTab"))byId("historyTab").classList.toggle("active",viewId==="settingsHistoryView");if(byId("statisticsTab"))byId("statisticsTab").classList.toggle("active",viewId==="settingsStatisticsView");if(byId("settingsTab"))byId("settingsTab").classList.toggle("active", viewId === "settingsView" || (viewId.startsWith("settings")&&!["settingsHistoryView","settingsStatisticsView"].includes(viewId)));if(byId("helpTab"))byId("helpTab").classList.toggle("active", viewId === "helpView");
  window.YearPlan?.afterView(viewId);
  for(const [id,active] of [["yearPlanTab",viewId==="yearPlanView"],["plansTab",viewId==="plansView"],["eventsTab",viewId==="eventsView"||viewId==="theaterView"]]){const tab=byId(id);tab?.classList.toggle("active",active);if(tab){if(active)tab.setAttribute("aria-current","page");else tab.removeAttribute("aria-current");}}
  if(viewId!=="yearPlanView")window.scrollTo({ top: 0, behavior: "smooth" });window.WorkflowUX?.afterView(viewId);
  if(viewId==="settingsView")window.SmartWorkflow?.settings();
  if(viewId==="theaterView")window.TheaterAdmin?.load();
  if(viewId==="settingsPortalView")window.PortalAdmin?.load();
  if(viewId==="settingsCalendarView"&&adminUnlocked&&oneDriveAdministrationReady())window.PortalAdmin?.loadCalendar();
  if(viewId==="settingsQuizQuestionsView")window.DrinksQuizQuestions?.load();
  return true;
}

function renderSessionType() {
  window.PortalAdmin?.refreshAttendance();
  const isSpecial = sessionType === "Sonderprobe";
  const isTraining = sessionType === "Unterricht";
  const isCommittee = sessionType === "Ausschuss Sitzung";
  const isOperation = sessionType === "Einsatz";
  byId("sessionTypes")?.querySelectorAll("[data-session-type]").forEach(button => {
    const selected = button.dataset.sessionType === sessionType;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const rolesPanel=byId("rolesPanel");if(rolesPanel)rolesPanel.hidden=true;
  const headerSessionType=byId("headerSessionType");if(headerSessionType)headerSessionType.textContent=sessionType;

  const sessionHint=byId("sessionHint");
  if(sessionHint)sessionHint.textContent=isSpecial
    ? "Personen markieren → Auswahl übernehmen."
    : isTraining
      ? "Personen markieren → Auswahl übernehmen."
      : isCommittee
        ? "Nur Ausschussmitglieder."
        : isOperation
          ? "Nur anwesende Einsatzkräfte erfassen."
        : "Personen markieren → Auswahl übernehmen.";
}
function chooseSessionType(type,{calendar=false}={}) {
  const validTypes=["Allgemeine Probe","Sonderprobe","Unterricht","Ausschuss Sitzung","Einsatz"];
  if(!validTypes.includes(type))return showToast("Unbekannte Terminart.","error");
  if(!calendar&&!currentSessionId&&!currentOperationId)window.PortalAdmin?.useSpontaneous?.();
  pendingSessionType=type;
  const sessionTypes=byId("sessionTypes");
  if(sessionTypes)sessionTypes.dataset.selectedSessionType=type;
  sessionTypes?.querySelectorAll("[data-session-type]").forEach(button=>{
    const selected=button.dataset.sessionType===type;
    button.classList.toggle("selected",selected);
    button.setAttribute("aria-pressed",String(selected));
  });
  const previewSpecial = type === "Sonderprobe";
  const previewTraining = type === "Unterricht";
  const previewCommittee = type === "Ausschuss Sitzung";
  const previewOperation = type === "Einsatz";
  const sessionHint=byId("sessionHint");
  if(sessionHint)sessionHint.textContent=previewSpecial
    ? "Personen markieren → Auswahl übernehmen."
    : previewTraining
      ? "Personen markieren → Auswahl übernehmen."
      : previewCommittee
        ? "Nur Ausschussmitglieder."
        : previewOperation
          ? "Nur anwesende Einsatzkräfte erfassen."
        : "Personen markieren → Auswahl übernehmen.";
  const next=byId("continueToAttendanceButton");
  if(next){next.disabled=false;next.textContent=`Weiter mit ${type}`;}
  const headerType=byId("headerProbeType");if(headerType)headerType.textContent=type;
  const summary=byId("headerProbeSummary");if(summary){summary.hidden=false;summary.classList.add("is-active","is-preview");}
  const stage2Type=byId("stage2Heading")?.querySelector("small");if(stage2Type)stage2Type.textContent=type;
  if(typeof syncAttendanceStart==="function")syncAttendanceStart();
}


