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
function requireAdmin(target="settingsView") {
  if(adminUnlocked){resetAdminTimeout();return true;}
  pendingSettingsTarget=target;
  byId("cloudSyncDialog")?.close();
  showView("adminLoginView");
  showToast("Zum Ändern bitte die Verwaltung entsperren.","error");
  return false;
}
function lockAdministration(){
  adminUnlocked=false;clearTimeout(adminTimeoutId);adminTimeoutId=null;
  for(const id of ['settingsMembersView','settingsGoalsView','settingsSecurityView','settingsFilesView','settingsRemindersView','settingsRewardsView']){
    if(byId(id)?.hidden===false){byId(id).hidden=true;pendingSettingsTarget=id;showView('adminLoginView');break;}
  }
  for(const id of ['reminderDraftDialog','cloudSyncDialog'])byId(id)?.close();
  renderOneDriveDialog?.();
}
function showView(viewId) {
  if(["settingsMembersView","settingsGoalsView","settingsSecurityView","settingsFilesView","settingsRemindersView","settingsRewardsView"].includes(viewId)&&!requireAdmin(viewId))return false;
  if(window.DrinksRewards?.beforeView(viewId)===false)return false;
  if(window.Usability?.beforeLeave(viewId)===false)return false;
  if(window.Drinks?.beforeView(viewId)===false)return false;
  if(viewId==="drinksView")lockAdministration();
  clearTimeout(toastTimer);byId("toast")?.classList.remove("visible");
  closeCompactMenu();
  if(viewId!=="attendanceView")hideDocumentReportUi?.();
  document.querySelectorAll("main.app-shell > .view").forEach(view => view.hidden = view.id !== viewId);
  byId("attendanceTab").classList.toggle("active", viewId === "attendanceView");
  if(byId("adminTab"))byId("adminTab").classList.remove("active");if(byId("archiveTab"))byId("archiveTab").classList.remove("active");if(byId("historyTab"))byId("historyTab").classList.toggle("active",viewId==="settingsHistoryView");if(byId("statisticsTab"))byId("statisticsTab").classList.toggle("active",viewId==="settingsStatisticsView");if(byId("settingsTab"))byId("settingsTab").classList.toggle("active", viewId === "settingsView" || (viewId.startsWith("settings")&&!["settingsHistoryView","settingsStatisticsView"].includes(viewId)));if(byId("helpTab"))byId("helpTab").classList.toggle("active", viewId === "helpView");
  window.scrollTo({ top: 0, behavior: "smooth" });
  return true;
}

function renderSessionType() {
  const isSpecial = sessionType === "Sonderprobe";
  const isTraining = sessionType === "Unterricht";
  const isCommittee = sessionType === "Ausschuss Sitzung";
  const isOperation = sessionType === "Einsatz";
  byId("sessionTypes")?.querySelectorAll("[data-session-type]").forEach(button => {
    const selected = button.dataset.sessionType === sessionType;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const rolesPanel=byId("rolesPanel");if(rolesPanel)rolesPanel.hidden=false;
  const headerSessionType=byId("headerSessionType");if(headerSessionType)headerSessionType.textContent=sessionType;

  const sessionHint=byId("sessionHint");
  if(sessionHint)sessionHint.textContent=isSpecial
    ? "Status „Anwesend“ oder „Betrifft nicht“ wählen, danach mehrere Mitglieder markieren und gemeinsam speichern."
    : isTraining
      ? "Status „Anwesend“ wählen, danach mehrere Mitglieder markieren und gemeinsam als Unterrichtsteilnehmer speichern."
      : isCommittee
        ? "Nur Mitglieder des Ausschusses werden angezeigt. Die Erfassung verhält sich wie beim Unterricht."
        : isOperation
          ? "Bei Einsätzen werden ausschließlich anwesende Einsatzkräfte erfasst. Mehrere Einsätze am selben Tag bleiben getrennt."
        : "Status bei den Personen markieren und anschließend Auswahl übernehmen. Funktionen werden beim Start der Taktik berechnet.";
}
function chooseSessionType(type) {
  const validTypes=["Allgemeine Probe","Sonderprobe","Unterricht","Ausschuss Sitzung","Einsatz"];
  if(!validTypes.includes(type))return showToast("Unbekannte Terminart.","error");
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
    ? "Status „Anwesend“ oder „Betrifft nicht“ wählen, danach mehrere Mitglieder markieren und gemeinsam speichern."
    : previewTraining
      ? "Status „Anwesend“ wählen, danach mehrere Mitglieder markieren und gemeinsam als Unterrichtsteilnehmer speichern."
      : previewCommittee
        ? "Nur Mitglieder des Ausschusses werden angezeigt. Die Erfassung verhält sich wie beim Unterricht."
        : previewOperation
          ? "Nur anwesende Einsatzkräfte markieren. Einsatzdaten werden in Schritt 3 erfasst."
        : "Status bei den Personen markieren und anschließend Auswahl übernehmen. Funktionen werden beim Start der Taktik berechnet.";
  const next=byId("continueToAttendanceButton");
  if(next){next.disabled=false;next.textContent=`Weiter mit ${type}`;}
  const headerType=byId("headerProbeType");if(headerType)headerType.textContent=type;
  const summary=byId("headerProbeSummary");if(summary){summary.hidden=false;summary.classList.add("is-active","is-preview");}
  const stage2Type=byId("stage2Heading")?.querySelector("small");if(stage2Type)stage2Type.textContent=type;
}
