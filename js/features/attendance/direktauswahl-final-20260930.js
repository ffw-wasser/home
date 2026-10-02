const pendingMemberStatuses=new Map();
function renderMembers() {
  members = sortMembers(members);
  const current = todayEntries();
  const recordedNames = new Set(current.flatMap(entry => [entry.storedName, entry.displayName].filter(Boolean)));
  const eligibleMembers = sessionType === "Ausschuss Sitzung"
    ? members.filter(member => member.committeeMember)
    : sessionType === "Einsatz"
      ? members.filter(member => !member.ageDepartment)
      : members;
  const availableMembers = eligibleMembers.filter(member => !recordedNames.has(nameForStorage(member)) && !recordedNames.has(nameForTile(member)));
  if (!availableMembers.some(member => member.id === chosenMemberId)) chosenMemberId = "";
  chosenMemberIds = new Set([...chosenMemberIds].filter(id => availableMembers.some(member => member.id === id)));
  const multiMode = (sessionType === "Allgemeine Probe" && (chosenRole === "Anwesend" || chosenRole === "Entschuldigt" || chosenRole === "Orga")) ||
    (sessionType === "Sonderprobe" && (chosenRole === "Anwesend" || chosenRole === "Entschuldigt" || chosenRole === "Betrifft nicht")) ||
    ((sessionType === "Unterricht" || sessionType === "Ausschuss Sitzung") && (chosenRole === "Anwesend" || chosenRole === "Entschuldigt")) ||
    (sessionType === "Einsatz" && chosenRole === "Anwesend");
  const renderMemberButton = member => {
    const recorded = recordedNames.has(nameForStorage(member)) || recordedNames.has(nameForTile(member));
    if(recorded) return "";
    const selected = multiMode ? chosenMemberIds.has(member.id) : member.id === chosenMemberId;
    const organizationSelected = selected && chosenRole === "Orga";
    const extra=sessionType==="Sonderprobe"?`<button type="button" class="member-status-action status-na ${pendingMemberStatuses.get(member.id)==="Betrifft nicht"?"selected":""}" aria-pressed="${pendingMemberStatuses.get(member.id)==="Betrifft nicht"}" data-quick-status="Betrifft nicht" data-quick-member="${escapeHtml(member.id)}"><span class="status-icon">−</span></button>`:sessionType==="Allgemeine Probe"?`<button type="button" class="member-status-action status-orga ${pendingMemberStatuses.get(member.id)==="Orga"?"selected":""}" aria-pressed="${pendingMemberStatuses.get(member.id)==="Orga"}" data-quick-status="Orga" data-quick-member="${escapeHtml(member.id)}"><span class="status-icon">O</span></button>`:"";
    const excused=sessionType==="Einsatz"?"":`<button type="button" class="member-status-action status-excused ${pendingMemberStatuses.get(member.id)==="Entschuldigt"?"selected":""}" aria-pressed="${pendingMemberStatuses.get(member.id)==="Entschuldigt"}" data-quick-status="Entschuldigt" data-quick-member="${escapeHtml(member.id)}"><span class="status-icon">E</span></button>`;
    return `<article class="member-direct-card ${member.ageDepartment ? "age-member-card" : ""} "><strong>${escapeHtml(nameForTile(member))}</strong><div class="member-direct-actions"><button type="button" class="member-status-action status-present ${pendingMemberStatuses.get(member.id)==="Anwesend"?"selected":""}" aria-pressed="${pendingMemberStatuses.get(member.id)==="Anwesend"}" data-quick-status="Anwesend" data-quick-member="${escapeHtml(member.id)}"><span class="status-icon">✓</span></button>${excused}${extra}</div></article>`;
  };
  const activeMembers = (sessionType === "Ausschuss Sitzung" ? members.filter(member => member.committeeMember) : members).filter(member => !member.ageDepartment && !recordedNames.has(nameForStorage(member)) && !recordedNames.has(nameForTile(member)));
  const ageMembers = (sessionType === "Ausschuss Sitzung" || sessionType === "Einsatz") ? [] : members.filter(member => member.ageDepartment && !recordedNames.has(nameForStorage(member)) && !recordedNames.has(nameForTile(member)));
  const legendItems=sessionType==="Einsatz"
    ? `<span><b class="legend-a">✓</b>Anwesend</span>`
    : sessionType==="Allgemeine Probe"
      ? `<span><b class="legend-a">✓</b>Anwesend</span><span><b class="legend-e">E</b>Entschuldigt</span><span><b class="legend-o">O</b>Organisation</span>`
      : sessionType==="Sonderprobe"
        ? `<span><b class="legend-a">✓</b>Anwesend</span><span><b class="legend-e">E</b>Entschuldigt</span><span><b class="legend-na">−</b>Betrifft nicht</span>`
        : `<span><b class="legend-a">✓</b>Anwesend</span><span><b class="legend-e">E</b>Entschuldigt</span>`;
  let headingLegend=byId("stage2StatusLegend");
  if(!headingLegend && byId("stage2Heading")){
    headingLegend=document.createElement("aside");
    headingLegend.id="stage2StatusLegend";
    headingLegend.className="member-status-legend member-status-legend-heading";
    headingLegend.setAttribute("aria-label","Legende der Statusabkürzungen");
    const dateControl=byId("probeDateInput")?.closest("label");
    byId("stage2Heading").insertBefore(headingLegend,dateControl||null);
  }
  if(headingLegend) headingLegend.innerHTML=`<strong>Legende</strong>${legendItems}`;
  const sections = [
    `<section class="member-section member-section-active"><div class="member-section-heading"><h4>Einsatzabteilung</h4><span>${activeMembers.length}</span></div><div class="member-subgrid">${activeMembers.map(renderMemberButton).join("")}</div></section>`,
    ageMembers.length ? `<section class="member-section member-section-age"><div class="member-section-heading"><h4>Alterskameraden</h4><span>${ageMembers.length}</span></div><p>Anwesende Mitglieder auswählen. Nicht ausgewählte Mitglieder werden beim Abschluss als „Fehlt“ gewertet.</p><div class="member-subgrid">${ageMembers.map(renderMemberButton).join("")}</div></section>` : ""
  ];
  byId("members").innerHTML = sections.join("");
  byId("memberCount").textContent = multiMode ? `${chosenMemberIds.size} ausgewählt · ${availableMembers.length} offen` : `${availableMembers.length} offen`;
}
function updatePrimaryAction() {
  const button=byId("exportResetButton"),count=todayEntries().length,hasEntries=count>0;
  if(!button)return;
  button.textContent=hasEntries?`Weiter zu Schritt 3 · ${count} ${count===1?"Person":"Personen"} erfasst →`:"Weiter zu Schritt 3 →";
  button.disabled=!hasEntries;
  button.title=hasEntries?(sessionType==="Allgemeine Probe"?"Taktik öffnen und Probe abschließen":"Probe abschließen"):"Mindestens eine Teilnahme erfassen";
  const summary=byId("step3ActionSummary");
  if(summary)summary.textContent=hasEntries?`${count} ${count===1?"Teilnahme":"Teilnahmen"} gespeichert.`:"Noch keine Teilnahme gespeichert.";
}
function backToMembers() {
  chosenMemberId = "";
  chosenMemberIds.clear();
  chosenRole = "";
  renderMembers();
  renderRoles();
  updateSelection();
  updateProbeWorkflow();
}

function updateSelection() {
  const selected = members.find(member => member.id === chosenMemberId);
  const isStandard = sessionType === "Allgemeine Probe";
  const isSpecial = sessionType === "Sonderprobe";
  const isTraining = sessionType === "Unterricht";
  const isCommittee = sessionType === "Ausschuss Sitzung";
  const isOperation = sessionType === "Einsatz";
  const multiMode = (isStandard && (chosenRole === "Anwesend" || chosenRole === "Entschuldigt" || chosenRole === "Orga")) ||
    (isSpecial && (chosenRole === "Anwesend" || chosenRole === "Entschuldigt" || chosenRole === "Betrifft nicht")) ||
    ((isTraining || isCommittee) && (chosenRole === "Anwesend" || chosenRole === "Entschuldigt")) ||
    (sessionType === "Einsatz" && chosenRole === "Anwesend");
  const selectedMemberLabel=byId("selectedMember");
  if(selectedMemberLabel)selectedMemberLabel.textContent = multiMode
    ? (chosenMemberIds.size ? `${chosenMemberIds.size} Mitglieder ausgewählt` : "Noch keine Mitglieder gewählt")
    : (selected ? nameForTile(selected) : "Nicht gewählt");

  const selectedMultiMembers = sortMembers(members.filter(member => chosenMemberIds.has(member.id)));
  if(byId("participantOverview"))byId("participantOverview").hidden = !multiMode || chosenMemberIds.size === 0;
  if(byId("participantCount"))byId("participantCount").textContent = selectedMultiMembers.length;
  if(byId("participantList"))byId("participantList").innerHTML = selectedMultiMembers.length ? selectedMultiMembers.map(member => `<li>${escapeHtml(nameForTile(member))}</li>`).join("") : "<li>Noch keine Mitglieder ausgewählt</li>";
  document.querySelector(".current-selection")?.classList.toggle("training-selection", isTraining);
  if(byId("saveButton"))byId("saveButton").textContent=`Auswahl übernehmen (${pendingMemberStatuses.size})`;
  if(byId("saveButton"))byId("saveButton").disabled=pendingMemberStatuses.size===0;
  if(byId("roleSaveButton"))byId("roleSaveButton").disabled = !(sessionType === "Allgemeine Probe" && selected && chosenRole);
  updateProbeWorkflow();
}
function ensureCurrentSessionId(){
  if(sessionType==="Einsatz")return currentOperationId||"";
  if(!currentSessionId){currentSessionId=safeStorage.getItem("fw_v1_current_session_id")||"";}
  return currentSessionId;
}
function startAttendanceSession(){
  currentSessionId=`session-${today()}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  safeStorage.setItem("fw_v1_current_session_id",currentSessionId);
  return currentSessionId;
}
function todayEntries() {
  if(sessionType==="Einsatz")return entries.filter(entry=>entry.operationId===currentOperationId);
  const id=ensureCurrentSessionId();
  if(id)return entries.filter(entry=>entry.sessionId===id);
  return entries.filter(entry=>entry.date===today()&&!entry.operationId&&!entry.sessionId);
}
function renderEntries() {
  const current = todayEntries();
  byId("entries").innerHTML = current.map(entry => `
    <tr>
      <td>${escapeHtml(entry.time)}</td>
      <td><strong>${escapeHtml(entry.displayName)}</strong></td>
      <td>${escapeHtml(entry.role === "Orga" ? "Organisation" : ((entry.status === "Entschuldigt" || entry.status === "Betrifft nicht") ? entry.status : entry.role))}</td>
      <td><button type="button" class="delete-entry" data-entry="${escapeHtml(entry.id)}" aria-label="Anmeldung löschen">✕</button></td>
    </tr>`).join("");
  const presentCount = current.filter(entry => entry.status === "Anwesend").length;
  const excusedCount = current.filter(entry => entry.status === "Entschuldigt").length;
  const recordedNames = new Set(current.flatMap(entry => [entry.storedName, entry.displayName].filter(Boolean)));
  const missingCount = members.filter(member => !member.ageDepartment && !recordedNames.has(nameForStorage(member)) && !recordedNames.has(nameForTile(member))).length;
  byId("entryCount").textContent = current.length;
  byId("todayCount").textContent = presentCount;
  byId("excusedCount").textContent = excusedCount;
  byId("missingCount").textContent = missingCount;
  byId("emptyEntries").hidden = current.length > 0;
}
function renderAdmin() {
  members = sortMembers(members);
  byId("adminMemberCount").textContent = members.length;
  byId("exportResetButton").disabled = todayEntries().length === 0;
  const targets = getRoleTargets();
  const targetBox = byId("roleTargetInputs");
  if (targetBox) targetBox.innerHTML = ROLE_GROUPS.map(group => `<fieldset class="role-target-group role-theme-${group.key}"><legend>${escapeHtml(group.title)}</legend>${group.roles.map(role => `<label><span>${escapeHtml(role)}</span><input type="number" min="0" max="99" step="1" inputmode="numeric" data-role-target="${escapeHtml(role)}" value="${targets[role]}"><small>× pro Jahr</small></label>`).join("")}</fieldset>`).join("");
  if (byId("roleTargetsStatus")) byId("roleTargetsStatus").textContent = "0 = kein Jahresziel";
  const renderMemberCard = (member, index) => {
    const memberRoles = getMemberRoles(member);
    const roleGroups = ROLE_GROUPS.map(group => `<fieldset class="admin-role-group role-theme-${group.key}"><legend>${escapeHtml(group.title)}</legend><div class="admin-role-options">${group.roles.map(role => `<label class="role-checkbox"><input type="checkbox" data-member-role="${escapeHtml(role)}" ${memberRoles.includes(role) ? "checked" : ""}><span>${escapeHtml(role)}</span></label>`).join("")}</div></fieldset>`).join("");
    const machinistVehicles = Array.isArray(member.machinistVehicles) ? member.machinistVehicles : [];
    const vehicleOptions = member.ageDepartment ? "" : `<fieldset class="admin-role-group role-theme-vehicles machinist-vehicle-group"><legend>Maschinistenberechtigung</legend><p>LF10 und/oder TSF auswählen. Dadurch wird die Person automatisch als Maschinist freigeschaltet.</p><div class="admin-role-options"><label class="role-checkbox"><input type="checkbox" data-machinist-vehicle="LF" ${machinistVehicles.includes("LF") ? "checked" : ""}><span>LF</span></label><label class="role-checkbox"><input type="checkbox" data-machinist-vehicle="TSF" ${machinistVehicles.includes("TSF") ? "checked" : ""}><span>TSF</span></label></div><div class="driver-license-control"><label><span>Letzte Führerscheinkontrolle</span><input type="date" data-driver-license-checked value="${escapeHtml(member.driverLicenseCheckedOn||"")}"></label><small>${member.driverLicenseCheckedOn?`Nächste Kontrolle bis ${escapeHtml(driverLicenseDueDate(member))}`:"Bei Maschinisten jährlich dokumentieren."}</small></div></fieldset>`;
    return `<article class="admin-row member-card member-card-${index % 3}"><header class="member-card-header"><span class="member-card-number">${index + 1}</span><strong>${escapeHtml(nameForTile(member))}</strong>${member.ageDepartment ? '<span class="age-department-badge">Altersabteilung</span>' : ''}</header><div class="member-name-fields"><label><span>Nachname</span><input class="text-input" data-last-name value="${escapeHtml(member.lastName)}"></label><label><span>Vorname</span><input class="text-input" data-first-name value="${escapeHtml(member.firstName)}"></label></div><label class="age-department-toggle"><input type="checkbox" data-age-department ${member.ageDepartment ? "checked" : ""}><span><strong>Altersabteilung</strong><small>Kennzeichnet die Person als Mitglied der Altersmannschaft; die Anwesenheit wird bei der Erfassung separat ausgewählt.</small></span></label><label class="committee-member-toggle"><input type="checkbox" data-committee-member ${member.committeeMember ? "checked" : ""}><span><strong>Mitglied des Ausschusses</strong><small>Wird bei der Terminart Ausschuss Sitzung zur Auswahl angeboten.</small></span></label><div class="member-safety-settings"><label class="atue-member-toggle"><input type="checkbox" data-atue-qualified ${member.atueQualified ? "checked" : ""}><span><strong>Atemschutzüberwachung (ATÜ)</strong><small>Darf den separaten ATÜ-Platz übernehmen.</small></span></label><fieldset class="admin-role-group breathing-clearance-card"><legend>Atemschutzfreigabe</legend><p>Die Freigabe gilt nur, wenn alle drei Nachweise gültig sind.</p><div class="breathing-clearance-grid"><label><span>G26.3 gültig bis</span><input class="text-input" type="date" data-g263-valid-until value="${escapeHtml(member.g263ValidUntil||member.breathingClearanceUntil||"")}"></label><label><span>Unterweisung AGT gültig bis</span><input class="text-input" type="date" data-agt-instruction-valid-until value="${escapeHtml(member.agtInstructionValidUntil||"")}"></label><label><span>FFI gültig bis</span><input class="text-input" type="date" data-ffi-valid-until value="${escapeHtml(member.ffiValidUntil||"")}"></label></div><div class="breathing-clearance-result ${hasValidBreathingClearance(member,systemToday())?"is-valid":"is-blocked"}"><strong>${hasValidBreathingClearance(member,systemToday())?"Freigabe erteilt":"Freigabe nicht erteilt"}</strong><small>${escapeHtml(breathingClearanceSummary(member))}</small></div></fieldset></div>${member.ageDepartment ? '<div class="age-no-role-note">Für Mitglieder der Altersabteilung ist keine Funktionsauswahl erforderlich.</div>' : `<div class="member-role-editor">${roleGroups}${vehicleOptions}</div>`}<div class="member-card-actions"><button type="button" class="admin-save" data-save-member="${escapeHtml(member.id)}">Einstellungen speichern</button><button type="button" class="danger-button" data-delete-member="${escapeHtml(member.id)}">Mitglied löschen</button></div></article>`;
  };
  const activeMembers = members.filter(member => !member.ageDepartment);
  const ageMembers = members.filter(member => member.ageDepartment);
  byId("memberAdmin").innerHTML = `<section class="admin-department admin-department-active"><div class="admin-department-heading"><h4>Einsatzabteilung</h4><span>${activeMembers.length}</span></div>${activeMembers.map((member, index) => renderMemberCard(member, index)).join("")}</section>${ageMembers.length ? `<section class="admin-department admin-department-age"><div class="admin-department-heading"><h4>Alterskameraden</h4><span>${ageMembers.length}</span></div>${ageMembers.map((member, index) => renderMemberCard(member, activeMembers.length + index)).join("")}</section>` : ""}`;
}
function saveAgeDepartmentAttendance(member) {
  if (!member || !member.ageDepartment) return false;
  const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  entries.unshift({
    id: makeId(), date: today(), time,
    displayName: nameForTile(member), storedName: nameForStorage(member),
    role: "", status: "Anwesend", sessionType, sessionId:ensureCurrentSessionId()
  });
  saveEntries();
  chosenMemberId = "";
  chosenMemberIds.clear();
  chosenRole = "";
  renderMembers(); renderRoles(); renderEntries(); renderAdmin(); updateSelection(); updateProbeWorkflow();
  showToast(`${nameForTile(member)} wurde als anwesend gespeichert.`);
  return true;
}
function saveDirectGeneralAttendance(member, status = "Anwesend") {
  if (!member || member.ageDepartment) return false;
  const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  entries.unshift({ id: makeId(), date: today(), time, displayName: nameForTile(member), storedName: nameForStorage(member), role: "", status, sessionType, sessionId:ensureCurrentSessionId() });
  saveEntries(); chosenMemberId = ""; chosenMemberIds.clear(); chosenRole = "";
  renderMembers(); renderRoles(); renderEntries(); renderAdmin(); updateSelection(); updateProbeWorkflow();
  showToast(`${nameForTile(member)} wurde als ${status.toLowerCase()} gespeichert. Die Funktion wird beim Start der Probe berechnet.`);
  return true;
}
function saveQuickMemberStatus(id,status){
  const member=members.find(item=>item.id===id);if(!member)return false;
  const already=todayEntries().some(entry=>entry.storedName===nameForStorage(member)||entry.displayName===nameForTile(member));if(already)return false;
  const allowed=sessionType==="Einsatz"?["Anwesend"]:sessionType==="Allgemeine Probe"?["Anwesend","Entschuldigt","Orga"]:sessionType==="Sonderprobe"?["Anwesend","Entschuldigt","Betrifft nicht"]:["Anwesend","Entschuldigt"];
  if(!allowed.includes(status))return false;
  if(pendingMemberStatuses.get(id)===status)pendingMemberStatuses.delete(id);else pendingMemberStatuses.set(id,status);
  chosenMemberIds=new Set(pendingMemberStatuses.keys());
  renderMembers();updateSelection();updateProbeWorkflow();
  return true;
}
function commitPendingMemberStatuses(){
  if(!pendingMemberStatuses.size)return false;
  const time=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),isOperation=sessionType==="Einsatz";
  let count=0;
  pendingMemberStatuses.forEach((status,id)=>{const member=members.find(item=>item.id===id);if(!member)return;entries.unshift({id:makeId(),date:today(),time,displayName:nameForTile(member),storedName:nameForStorage(member),role:status==="Orga"?"Orga":sessionType==="Ausschuss Sitzung"&&status==="Anwesend"?"Ausschuss Sitzung":sessionType==="Unterricht"&&status==="Anwesend"?"Unterricht":"",status:status==="Orga"?"Anwesend":status,sessionType,sessionId:isOperation?"":ensureCurrentSessionId(),operationId:isOperation?currentOperationId:""});count++;});
  saveEntries();pendingMemberStatuses.clear();chosenMemberIds.clear();chosenMemberId="";
  renderMembers();renderEntries();renderAdmin();updateSelection();updateProbeWorkflow();updatePrimaryAction();
  requestAnimationFrame(()=>{
    const target=document.querySelector("#members .member-section-active .member-section-heading") || document.querySelector("#members .member-section-active") || byId("members");
    if(!target)return;
    const headerHeight=document.querySelector(".participant-command-header")?.getBoundingClientRect().height||0;
    const top=window.scrollY+target.getBoundingClientRect().top-headerHeight-12;
    window.scrollTo({top:Math.max(0,top),left:0,behavior:"smooth"});
  });
  showToast(`${count} Personen wurden übernommen.`);return true;
}
function chooseMember(id) {
  const clickedMember=members.find(member=>member.id===id);
  if(!clickedMember || !chosenRole) return;
  const allowed=(sessionType==="Allgemeine Probe" && ["Anwesend","Entschuldigt","Orga"].includes(chosenRole)) ||
    (sessionType==="Sonderprobe" && ["Anwesend","Entschuldigt","Betrifft nicht"].includes(chosenRole)) ||
    ((sessionType==="Unterricht" || sessionType==="Ausschuss Sitzung") && ["Anwesend","Entschuldigt"].includes(chosenRole)) ||
    (sessionType==="Einsatz" && chosenRole==="Anwesend");
  if(!allowed) return;
  if(chosenMemberIds.has(id)) chosenMemberIds.delete(id); else chosenMemberIds.add(id);
  chosenMemberId="";
  renderMembers(); updateSelection(); updateProbeWorkflow();
}
function chooseRole(role) {
  chosenRole=role;
  chosenMemberId="";
  chosenMemberIds.clear();
  renderMembers(); renderRoles(); updateSelection(); updateProbeWorkflow();
}
function saveAttendance() {
  if(pendingMemberStatuses.size){commitPendingMemberStatuses();return;} 
  const isStandard = sessionType === "Allgemeine Probe";
  const isSpecial = sessionType === "Sonderprobe";
  const isTraining = sessionType === "Unterricht";
  const isCommittee = sessionType === "Ausschuss Sitzung";
  const isOperation = sessionType === "Einsatz";
  const allowedStatuses = isStandard
    ? ["Anwesend", "Entschuldigt", "Orga"]
    : isSpecial
      ? ["Anwesend", "Entschuldigt", "Betrifft nicht"]
      : (isTraining || isCommittee)
        ? ["Anwesend", "Entschuldigt"]
        : isOperation ? ["Anwesend"] : [];

  // Robuster Abgleich: interne Auswahl und sichtbar markierte Karten zusammenführen.
  document.querySelectorAll('#members .choice-button.selected[data-member]').forEach(button => {
    if (button.dataset.member) chosenMemberIds.add(button.dataset.member);
  });

  const now = new Date();
  const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const selectedMembers = members.filter(member => chosenMemberIds.has(member.id));

  if (allowedStatuses.includes(chosenRole) && selectedMembers.length) {
    selectedMembers.forEach(member => entries.unshift({
      id: makeId(),
      date: today(),
      time,
      displayName: nameForTile(member),
      storedName: nameForStorage(member),
      role: isStandard && chosenRole === "Orga"
        ? "Orga"
        : (isCommittee && chosenRole === "Anwesend" ? "Ausschuss Sitzung" : (isTraining && chosenRole === "Anwesend" ? "Unterricht" : "")),
      status: chosenRole === "Orga" ? "Anwesend" : chosenRole,
      sessionType,
      sessionId: isOperation ? "" : ensureCurrentSessionId(),
      operationId: isOperation ? currentOperationId : ""
    }));
    saveEntries();
    const count = selectedMembers.length;
    const savedRole = chosenRole;
    chosenMemberIds.clear();
    chosenMemberId = "";
    renderMembers();
    renderRoles();
    renderEntries();
    renderAdmin();
    updateSelection();
    updateProbeWorkflow();
    showToast(`${count} Personen wurden als „${savedRole}“ übernommen. Weitere Personen können markiert oder der Status kann geändert werden.`);
    const remainingMembers = members.some(member => !member.ageDepartment && !todayEntries().some(entry => entry.storedName === nameForStorage(member) || entry.displayName === nameForTile(member)));
    if (remainingMembers) requestAnimationFrame(() => {
      const statusTabs = byId("attendanceStatusToolbar");
      const fallback = byId("memberStepTitle")?.closest(".panel") || byId("members");
      const target = statusTabs || fallback;
      if (!target) return;
      const headerOffset = Math.max(96, document.querySelector(".site-header")?.getBoundingClientRect().height || 0);
      const targetTop = window.scrollY + target.getBoundingClientRect().top - headerOffset - 12;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      statusTabs?.querySelector("[data-role].selected")?.focus({ preventScroll: true });
    });
    return;
  }

  const selected = members.find(member => member.id === chosenMemberId);
  if (isStandard || isSpecial || isTraining || isCommittee || isOperation) {
    return showToast(chosenRole
      ? "Bitte mindestens ein Mitglied auswählen."
      : "Bitte zuerst einen Status auswählen.", "error");
  }
  if (!selected || !chosenRole) return showToast("Bitte Mitglied und Funktion auswählen.", "error");
  const isExcused = chosenRole === "Entschuldigt";
  entries.unshift({
    id: makeId(), date: today(), time,
    displayName: nameForTile(selected), storedName: nameForStorage(selected),
    role: isExcused ? "" : chosenRole,
    status: isExcused ? "Entschuldigt" : "Anwesend",
    sessionType, sessionId:ensureCurrentSessionId()
  });
  saveEntries();
  chosenMemberId = "";
  chosenMemberIds.clear();
  chosenRole = "";
  renderMembers();
  renderRoles();
  renderEntries();
  updateSelection();
  updateProbeWorkflow();
  renderAdmin();
  showToast(`${nameForTile(selected)} wurde gespeichert. Mitglied und Funktion wurden zurückgesetzt.`);
}
function deleteEntry(id) {
  const entry=entries.find(item=>item.id===id);
  if(!entry)return showToast("Die Anmeldung wurde nicht gefunden.","error");
  const name=entry.displayName||entry.storedName||"diese Person";
  if(!confirm(`Anmeldung von ${name} wirklich aus der heutigen Liste entfernen?`))return;
  entries=entries.filter(item=>item.id!==id);
  saveEntries();
  chosenMemberId="";
  chosenMemberIds.delete(entry.memberId||"");
  renderEntries();
  renderMembers();
  renderRoles();
  renderAdmin();
  updateSelection();
  updateProbeWorkflow();
  updatePrimaryAction();
  showToast(`${name} wurde aus den heutigen Anmeldungen entfernt.`);
}
function clearToday() {
  if (!todayEntries().length) return showToast("Für heute sind keine Anmeldungen vorhanden.", "error");
  if (!confirm("Alle heutigen Anmeldungen zurücksetzen? Mitglieder, Einstellungen und Archiv bleiben erhalten.")) return;
  const sessionId=ensureCurrentSessionId();
  entries = sessionType === "Einsatz"
    ? entries.filter(entry => entry.operationId !== currentOperationId)
    : entries.filter(entry => entry.sessionId !== sessionId);
  chosenMemberId = "";
  chosenMemberIds.clear();
  chosenRole = "";
  saveEntries();
  renderMembers();
  renderRoles();
  renderEntries();
  renderAdmin();
  updateSelection();
  updateProbeWorkflow();
  showToast("Alle heutigen Teilnehmer wurden zurückgesetzt und können neu eingetragen werden.");
}

function setupUnifiedHomeWorkflow(){
  removeLegacyStatusRails();
  if(!chosenRole) chosenRole="Anwesend";
  const input=document.querySelector("#attendanceView .input-column"),roles=byId("rolesPanel"),members=document.querySelector("#attendanceView .members-panel");
  if(input&&roles&&members){
    let workspace=byId("attendanceSelectionWorkspace");
    if(!workspace){workspace=document.createElement("div");workspace.id="attendanceSelectionWorkspace";workspace.className="attendance-selection-workspace";input.insertBefore(workspace,input.firstChild);}
    workspace.appendChild(members);
    roles.hidden=true;roles.style.setProperty("display","none","important");roles.setAttribute("aria-hidden","true");
    members.hidden=false;members.classList.add("inline-members-panel","orga-sheet");
    roles.querySelector(".panel-heading")?.remove();
    byId("roleSelectionHint")?.remove();
  }
  byId("backToMembersButton")?.remove();byId("changeStatusButton")?.remove();
}
function removeLegacyStatusRails(){
  byId("attendanceStatusToolbar")?.remove();
  byId("floatingAttendanceStatusToolbar")?.remove();
  const panel=byId("rolesPanel");if(panel){panel.hidden=true;panel.style.setProperty("display","none","important");panel.setAttribute("aria-hidden","true");}
}
function updateProbeWorkflow(){
  const standard=sessionType==="Allgemeine Probe",special=sessionType==="Sonderprobe",training=sessionType==="Unterricht",committee=sessionType==="Ausschuss Sitzung",operation=sessionType==="Einsatz";
  const hasStatus=Boolean(chosenRole);
  const membersPanel=document.querySelector(".members-panel"),rolesPanel=byId("rolesPanel");
  if(membersPanel)membersPanel.hidden=false;if(rolesPanel){rolesPanel.hidden=true;rolesPanel.style.setProperty("display","none","important");rolesPanel.setAttribute("aria-hidden","true");}
  if(byId("selectedStatusBar"))byId("selectedStatusBar").hidden=true;
  if(byId("saveButton")){byId("saveButton").hidden=false;byId("saveButton").disabled=pendingMemberStatuses.size===0;byId("saveButton").textContent=`Auswahl übernehmen (${pendingMemberStatuses.size})`;}
  if(byId("batchSelectionHint"))byId("batchSelectionHint").hidden=true;
  if(byId("participantOverview"))byId("participantOverview").hidden=chosenMemberIds.size===0;
  if(byId("roleSaveButton"))byId("roleSaveButton").hidden=true;
  if(byId("memberStepTitle"))byId("memberStepTitle").textContent=committee?"Mitglieder des Ausschusses markieren":operation?"Anwesende Einsatzkräfte markieren":standard?"Personen markieren":training?"Teilnehmende markieren":"Personen markieren";
  if(byId("memberStepNumber"))byId("memberStepNumber").textContent="2";
  if(byId("roleStepNumber"))byId("roleStepNumber").textContent="1";
  if(byId("roleStepEyebrow"))byId("roleStepEyebrow").textContent="Status direkt auswählen";
  if(byId("roleMemberName"))byId("roleMemberName").textContent=operation?"Einsatz: nur Anwesend":standard?"Anwesend, Entschuldigt oder Orga":special?"Anwesend, Entschuldigt oder Betrifft nicht":committee?"Ausschuss Sitzung: Anwesend oder Entschuldigt":"Anwesend oder Entschuldigt";
  if(byId("roleSelectionHint"))byId("roleSelectionHint").textContent="Der ausgewählte Status bleibt aktiv. Zum Wechsel einfach einen anderen Status antippen.";
  updatePrimaryAction();
}

function renderRoles(){
  removeLegacyStatusRails();
  const statuses=sessionType==="Einsatz"?["Anwesend"]:sessionType==="Allgemeine Probe"?["Anwesend","Entschuldigt","Orga"]:sessionType==="Sonderprobe"?["Anwesend","Entschuldigt","Betrifft nicht"]:["Anwesend","Entschuldigt"];
  if(!statuses.includes(chosenRole)) chosenRole="Anwesend";
  const workspace=byId("attendanceSelectionWorkspace"),sheet=document.querySelector(".orga-sheet");
  const statusClass=chosenRole==="Entschuldigt"?"status-excused":chosenRole==="Betrifft nicht"?"status-not-applicable":chosenRole==="Orga"?"status-organization":"status-present";
  [workspace,sheet].filter(Boolean).forEach(element=>{
    element.classList.remove("status-present","status-excused","status-not-applicable","status-organization");
    element.classList.add(statusClass);
  });
  removeLegacyStatusRails();
}
function syncFloatingAttendanceStatusToolbar(){ removeLegacyStatusRails(); }
function updateFloatingAttendanceStatusToolbar(){ removeLegacyStatusRails(); }
if(!window.__floatingAttendanceStatusBound){
  window.__floatingAttendanceStatusBound=true;
  window.addEventListener("scroll",updateFloatingAttendanceStatusToolbar,{passive:true});
  window.addEventListener("resize",updateFloatingAttendanceStatusToolbar,{passive:true});
  window.visualViewport?.addEventListener("scroll",updateFloatingAttendanceStatusToolbar,{passive:true});
  window.visualViewport?.addEventListener("resize",updateFloatingAttendanceStatusToolbar,{passive:true});
}

function resetAttendanceForReturnToHome(){
  const currentEntries=todayEntries();
  if(!currentEntries.length)return true;
  if(!confirm("Beim Wechsel zu Schritt 1 oder Home werden alle aktuell erfassten Anwesenden zurückgesetzt. Wirklich fortfahren?"))return false;
  const sessionId=ensureCurrentSessionId(),operationId=currentOperationId;
  entries=sessionType==="Einsatz"&&operationId
    ? entries.filter(entry=>entry.operationId!==operationId)
    : entries.filter(entry=>entry.sessionId!==sessionId);
  chosenMemberId="";chosenMemberIds.clear();chosenRole="";pendingMemberStatuses.clear();
  saveEntries();
  resetDocumentReportState?.();
  if(sessionType==="Einsatz")resetOperationState?.();
  renderEntries();renderMembers();renderRoles();renderAdmin();updateSelection();updateProbeWorkflow();updatePrimaryAction();
  showToast("Alle erfassten Anwesenden wurden zurückgesetzt.");
  return true;
}
function requestReturnToHomeStage(){
  if(!resetAttendanceForReturnToHome())return false;
  setHomeFlowStage(1);
  return true;
}
function setHomeFlowStage(stage){
  // Schritt 1 verhält sich wie Home: Bereits erfasste Anwesenheiten werden
  // nach Bestätigung vollständig zurückgesetzt, unabhängig von der Terminart.
  if(stage===1&&homeFlowStage!==1&&todayEntries().length){
    if(!resetAttendanceForReturnToHome())return false;
  }
  homeFlowStage=stage;
  const attendanceView=byId("attendanceView");
  attendanceView?.classList.toggle("workflow-stage-1",stage===1);
  attendanceView?.classList.toggle("workflow-stage-2",stage===2);
  attendanceView?.classList.toggle("workflow-stage-3",stage===3);
  const sessionPanel=document.querySelector("#attendanceView .home-session-type-panel");
  const workspace=byId("attendanceSelectionWorkspace");
  const attendanceLayout=document.querySelector("#attendanceView>.attendance-layout");
  const tactics=byId("tacticsView");
  const finish=byId("homeStageFinish");
  const step3Action=byId("step3ActionArea");

  const applyVisibility=(element,visible,display)=>{
    if(!element)return;
    element.hidden=!visible;
    element.style.removeProperty("display");
    element.style.removeProperty("visibility");
    element.style.removeProperty("opacity");
    element.style.removeProperty("pointer-events");
    if(visible){element.style.display=display;element.removeAttribute("aria-hidden");}
    else{element.style.display="none";element.setAttribute("aria-hidden","true");}
  };

  applyVisibility(sessionPanel,stage===1,"block");
  applyVisibility(attendanceLayout,stage===2,"grid");
  applyVisibility(workspace,stage===2,"grid");
  applyVisibility(byId("rfidCsvImport"),stage===2,"block");
  applyVisibility(byId("attendanceStatusToolbar"),false,"none");
  applyVisibility(finish,false,"block");
  applyVisibility(step3Action,stage===2,"block");
  const operationAssignment=byId("operationAssignmentStep");
  applyVisibility(operationAssignment,stage===3&&sessionType==="Einsatz","block");
  applyVisibility(byId("operationReportForm"),false,"block");
  applyVisibility(tactics,stage===3&&sessionType==="Allgemeine Probe","block");
  document.querySelectorAll("#attendanceView .flow-stage-2-support").forEach(element=>applyVisibility(element,stage===2,""));
  // Der Dokumentbereich ist Bestandteil von Schritt 3. Beim Wechsel zu Home,
  // Schritt 1 oder Schritt 2 wird nur die Oberfläche geschlossen; bereits
  // geladene Seiten bleiben für die Rückkehr zu Schritt 3 im Arbeitsspeicher.
  if(stage!==3)hideDocumentReportUi?.();
  else syncDocumentReportVisibility?.(stage);

  if(stage===1){
    if(!todayEntries().length)currentProbeDate=systemToday();
    pendingSessionType="";
    if(byId("sessionTypes"))delete byId("sessionTypes").dataset.selectedSessionType;
    byId("sessionTypes")?.querySelectorAll("[data-session-type]").forEach(button=>{
      button.classList.remove("selected");button.setAttribute("aria-pressed","false");
    });
    const next=byId("continueToAttendanceButton");
    if(next){next.disabled=true;next.textContent="Weiter zu Schritt 2";}
    window.__sessionTypeTransitionRunning=false;
    window.syncHeaderProbeSummary?.();
  }

  if(stage===3&&sessionType==="Einsatz"){showOperationForm();}
  if(stage===3&&sessionType==="Allgemeine Probe"){
    tacticsClosingPending=true;renderTactics();byId("tacticsCloseActions").hidden=false;
    requestAnimationFrame(()=>{
      const target=byId("tacticsView");if(!target)return;
      const navHeight=document.querySelector(".top-nav")?.getBoundingClientRect().height||0;
      const progressHeight=byId("homeFlowProgress")?.getBoundingClientRect().height||0;
      const top=window.scrollY+target.getBoundingClientRect().top-navHeight-progressHeight-12;
      window.scrollTo({top:Math.max(0,top),left:0,behavior:"smooth"});
      target.setAttribute("tabindex","-1");target.focus({preventScroll:true});
    });
  }
  updatePrimaryAction();
  window.syncHeaderProbeSummary?.();
  syncHomeFlowProgress(stage);
}

function continueToAttendance(){
  if(window.__sessionTypeTransitionRunning)return;
  const selectedButton=byId("sessionTypes")?.querySelector("[data-session-type].selected,[data-session-type][aria-pressed='true']");
  const type=pendingSessionType||byId("sessionTypes")?.dataset.selectedSessionType||selectedButton?.dataset.sessionType||"";
  if(!type)return showToast("Bitte zuerst eine Terminart auswählen.","error");
  window.__sessionTypeTransitionRunning=true;
  sessionType=type;
  // Jeder Termin erhält eine eigene ID. Andere Termine desselben Tages bleiben erhalten.
  if(sessionType!=="Einsatz")startAttendanceSession();
  resetDocumentReportState?.();
  currentClosingTopic="";
  if(sessionType==="Einsatz")startOperationSession();
  chosenMemberId="";chosenMemberIds.clear();chosenRole="Anwesend";
  tacticsClosingPending=false;currentTacticsAssignments=new Map();currentTacticsSlots=[];tacticsDragSource=null;currentAtueMember=null;breathingProtectionPlanned=false;

  setHomeFlowStage(2);
  // Schritt 2 beginnt immer am oberen Rand der Ansicht, unabhängig von der
  // vorherigen Scrollposition in Schritt 1.
  window.scrollTo({top:0,left:0,behavior:"instant"});
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"instant"}));

  const renderErrors=[];
  const safeRender=(name,fn)=>{
    try{fn();}
    catch(error){renderErrors.push(name);console.error(`${name} fehlgeschlagen`,error);}
  };
  safeRender("Terminart",renderSessionType);
  safeRender("Mitglieder",renderMembers);
  safeRender("Statusreiter",renderRoles);
  safeRender("Anmeldungen",renderEntries);
  safeRender("Auswahl",updateSelection);
  safeRender("Arbeitsablauf",updateProbeWorkflow);
  const label=byId("stage2Heading")?.querySelector("small");if(label)label.textContent=sessionType;
  window.syncHeaderProbeSummary?.();

  const workspace=byId("attendanceSelectionWorkspace");
  if(workspace){
    workspace.hidden=false;
    workspace.style.removeProperty("display");
    workspace.style.display="grid";
    workspace.removeAttribute("aria-hidden");
    requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  if(renderErrors.length)showToast(`Schritt 2 geöffnet. Nicht geladen: ${renderErrors.join(", ")}.`,"error");
  window.__sessionTypeTransitionRunning=false;
}

function syncHomeFlowProgress(stage=homeFlowStage){
 const progress=byId("homeFlowProgress");if(!progress)return;
 const operation=sessionType==="Einsatz",current=operation&&byId("operationReportForm")&&!byId("operationReportForm").hidden?4:stage;
 const steps=operation?[[1,"Terminart"],[2,"Anwesenheit"],[3,"Zuordnung"],[4,"Einsatzbericht"]]:[[1,"Terminart"],[2,"Anwesenheit"],[3,"Abschluss"]];
 progress.innerHTML=steps.map(([number,label],index)=>`${index?"<i></i>":""}<button type="button" data-flow-indicator="${number}"><b>${number}</b><span>${label}</span></button>`).join("");
 progress.dataset.currentStage=String(current);
 progress.querySelectorAll("[data-flow-indicator]").forEach(item=>{const number=Number(item.dataset.flowIndicator),isCurrent=number===current;item.classList.toggle("current",isCurrent);item.classList.toggle("completed",number<current);item.classList.toggle("upcoming",number>current);if(isCurrent)item.setAttribute("aria-current","step");else item.removeAttribute("aria-current");item.disabled=number>current;});
}

function ensureStagedHomeFlow(){
  const attendance=byId("attendanceView"),workspace=byId("attendanceSelectionWorkspace"),sessionPanel=attendance?.querySelector(".home-session-type-panel");
  if(!attendance||!workspace||!sessionPanel)return;
  sessionPanel.classList.add("home-flow-card","home-flow-stage-1");
  // Abstand unter der gruenen Kartenlinie direkt setzen. setProperty mit important
  // verhindert, dass spaetere Wartungs-CSS-Regeln die Position wieder hochziehen.
  sessionPanel.style.setProperty("padding-top","34px","important");
  const sessionHeading=sessionPanel.querySelector(":scope > .panel-heading");
  if(sessionHeading){
    sessionHeading.style.setProperty("position","static","important");
    sessionHeading.style.setProperty("inset","auto","important");
    sessionHeading.style.setProperty("top","auto","important");
    sessionHeading.style.setProperty("margin","0 0 14px","important");
    sessionHeading.style.setProperty("transform","none","important");
  }
  if(!byId("homeFlowProgress")){
    const progress=document.createElement("nav");progress.id="homeFlowProgress";progress.className="home-flow-progress";progress.setAttribute("aria-label","Terminablauf");sessionPanel.parentElement.insertBefore(progress,sessionPanel);
    progress.addEventListener("click",event=>{const button=event.target.closest("[data-flow-indicator]");if(!button||button.disabled)return;const number=Number(button.dataset.flowIndicator);if(number===1){if(!requestReturnToHomeStage())return;requestAnimationFrame(()=>sessionPanel.scrollIntoView({behavior:"smooth",block:"start"}));}else if(number===2){setHomeFlowStage(2);requestAnimationFrame(()=>(byId("homeFlowProgress")||workspace)?.scrollIntoView({behavior:"smooth",block:"start"}));}else if(number===3&&sessionType==="Einsatz"){ensureOperationForm?.().setAttribute("hidden","");showOperationForm?.();syncHomeFlowProgress(3);}else if(number===4&&sessionType==="Einsatz"){if(!operationNames?.().length)return;openOperationReportForm?.();syncHomeFlowProgress(4);}});
  }
  syncHomeFlowProgress(homeFlowStage);

  const title=sessionPanel.querySelector("h2,h3");if(title)title.textContent="Terminart auswählen";
  const hint=byId("sessionHint");if(hint)hint.textContent="Terminart auswählen und anschließend zu Schritt 2 wechseln.";
  if(!byId("continueToAttendanceButton")){
    const actions=document.createElement("div");actions.className="session-continue-actions";
    actions.innerHTML=`<button id="continueToAttendanceButton" class="primary-button" type="button" disabled>Weiter zu Schritt 2</button>`;
    sessionPanel.appendChild(actions);
    byId("continueToAttendanceButton").addEventListener("click",continueToAttendance);
  }
  const step=sessionPanel.querySelector(".step");if(step)step.textContent="1";
  workspace.classList.add("home-flow-card","home-flow-stage-2");
  if(!byId("stage2Heading")){const h=document.createElement("div");h.id="stage2Heading";h.className="flow-stage-heading";workspace.prepend(h);}
  const stage2Heading=byId("stage2Heading");if(stage2Heading)stage2Heading.innerHTML=`<span>2</span><div><strong>Anwesenheit erfassen</strong><small>${escapeHtml(sessionType)}</small></div>`;
  if(stage2Heading&&!byId("probeDateInput")){const dateWrap=document.createElement("label");dateWrap.className="probe-date-control";dateWrap.innerHTML=`<span>Probetermin</span><input id="probeDateInput" type="date" value="${escapeHtml(today())}" max="${escapeHtml(systemToday())}">`;stage2Heading.appendChild(dateWrap);byId("probeDateInput").addEventListener("change",event=>{if(todayEntries().length){event.target.value=currentProbeDate;return showToast("Das Datum kann nach der ersten Anmeldung nicht mehr geändert werden.","error");}currentProbeDate=event.target.value||systemToday();renderEntries();renderMembers();updatePrimaryAction();});}

  const step3ActionButton=byId("exportResetButton");
  if(step3ActionButton){
    let step3Action=byId("step3ActionArea");
    if(!step3Action){
      step3Action=document.createElement("section");
      step3Action.id="step3ActionArea";
      step3Action.className="step-3-action-area";
      step3Action.innerHTML=`<div class="step3-action-copy"><strong>Anwesenheit vollständig?</strong><span id="step3ActionSummary">Noch keine Teilnahme gespeichert.</span><small>Die Einträge können über Schritt 2 später erneut bearbeitet werden.</small></div>`;
    }
    step3ActionButton.textContent="Weiter zu Schritt 3";
    step3ActionButton.classList.add("step-3-action-button");
    step3Action.appendChild(step3ActionButton);
    const actionColumn=document.querySelector("#attendanceView .action-column");
    const entriesPanel=byId("entries")?.closest("article,section,.panel");
    if(actionColumn&&entriesPanel){
      entriesPanel.insertAdjacentElement("afterend",step3Action);
      step3Action.classList.add("step-3-action-side");
    }else workspace.appendChild(step3Action);
    step3Action.hidden=homeFlowStage!==2;
    step3Action.setAttribute("aria-hidden",String(homeFlowStage!==2));
  }
  const entriesPanel=byId("entries")?.closest("article,section,.panel");if(entriesPanel){entriesPanel.classList.add("flow-stage-2-support","today-entries-panel");
    const controls=byId("saveButton")?.closest(".batch-selection-controls");
    if(controls&&!byId("desktopSaveButtonDock")){const dock=document.createElement("div");dock.id="desktopSaveButtonDock";dock.className="desktop-save-button-dock flow-stage-2-support";entriesPanel.insertAdjacentElement("beforebegin",dock);dock.appendChild(controls);}else if(controls&&byId("desktopSaveButtonDock")?.nextElementSibling!==entriesPanel){entriesPanel.insertAdjacentElement("beforebegin",byId("desktopSaveButtonDock"));}
  }
  const resetPanel=byId("resetTodayParticipantsButton")?.closest("article,section,.panel");if(resetPanel)resetPanel.classList.add("flow-stage-2-support");
  if(!byId("homeStageFinish")){
    const finish=document.createElement("section");finish.id="homeStageFinish";finish.className="panel home-stage-finish";finish.hidden=true;
    finish.innerHTML=`<div class="flow-stage-heading"><span>3</span><div><strong>Probe abschließen</strong><small id="homeStageFinishType"></small></div></div><p>Die Anwesenheit ist abgeschlossen. Thema eintragen und Bericht erzeugen.</p><button class="primary-button" id="homeStageFinishButton" type="button">Probe abschließen · CSV + PDF</button>`;
    attendance.appendChild(finish);byId("homeStageFinishButton").addEventListener("click",requestCloseProbe);
  }
  const step3Button=byId("exportResetButton");
  if(step3Button&&!step3Button.dataset.step3Bound){
    step3Button.dataset.step3Bound="true";
    step3Button.addEventListener("click",event=>{
      if(homeFlowStage!==2)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!todayEntries().length)return showToast("Bitte mindestens eine Teilnahme erfassen.","error");
      if(sessionType==="Einsatz"){
        setHomeFlowStage(3);
        return;
      }
      requestCloseProbe();
    },true);
  }
  setHomeFlowStage(1);
}

/* Version 2.0: optionaler RFID-CSV-Import */
let pendingRfidImport=[];
function normalizeRfidValue(value){return String(value||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");}
function parseRfidCsv(text){
  const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2)throw new Error("Die CSV enthält keine Datensätze.");
  const delimiter=(lines[0].match(/;/g)||[]).length>=(lines[0].match(/,/g)||[]).length?";":",";
  const split=line=>{const out=[];let cell="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){out.push(cell.trim());cell="";}else cell+=ch;}out.push(cell.trim());return out;};
  const headers=split(lines[0]).map(normalizeRfidValue);
  const find=(names)=>headers.findIndex(h=>names.includes(h));
  const indexes={rfid:find(["rfid","rfidid","chip","chipid","kartenid","kartennummer","tag","uid","transponder"]),name:find(["name","vollstandigername","mitglied","person"]),first:find(["vorname","firstname","givenname"]),last:find(["nachname","lastname","surname","familienname"]),time:find(["uhrzeit","zeit","time","anmeldezeit","timestamp"])};
  if(indexes.rfid<0&&indexes.name<0&&(indexes.first<0||indexes.last<0))throw new Error("Keine RFID- oder Namensspalte erkannt.");
  return lines.slice(1).map((line,row)=>{const cells=split(line);return{row:row+2,rfid:indexes.rfid>=0?cells[indexes.rfid]:"",name:indexes.name>=0?cells[indexes.name]:[indexes.first>=0?cells[indexes.first]:"",indexes.last>=0?cells[indexes.last]:""].filter(Boolean).join(" "),time:indexes.time>=0?cells[indexes.time]:""};}).filter(item=>item.rfid||item.name);
}
function matchRfidMember(item){
  const tag=normalizeRfidValue(item.rfid),name=normalizeRfidValue(item.name);
  if(tag){const byTag=members.filter(m=>normalizeRfidValue(m.rfid||m.rfidId||m.cardId)===tag);if(byTag.length===1)return byTag[0];}
  if(name){const byName=members.filter(m=>[nameForTile(m),nameForStorage(m),`${m.firstName||""} ${m.lastName||""}`,`${m.lastName||""} ${m.firstName||""}`].some(v=>normalizeRfidValue(v)===name));if(byName.length===1)return byName[0];}
  return null;
}
function ensureRfidCsvImport(){
  if(byId("rfidCsvImport")||!byId("attendanceView"))return;
  const panel=document.createElement("article");panel.id="rfidCsvImport";panel.className="rfid-import-card";
  panel.hidden=homeFlowStage!==2;
  panel.setAttribute("aria-hidden",homeFlowStage===2?"false":"true");
  panel.innerHTML=`<div class="rfid-import-copy"><strong>RFID-CSV importieren</strong><small>Optional: externe Anmeldungen übernehmen</small></div><div class="rfid-import-actions"><input id="rfidCsvFile" type="file" accept=".csv,text/csv" hidden><button id="rfidCsvChoose" class="outline-button" type="button">CSV auswählen</button></div><div id="rfidCsvPreview" class="rfid-import-preview" hidden></div>`;
  const workspace=byId("attendanceSelectionWorkspace")||byId("attendanceView").querySelector(".view-content")||byId("attendanceView");
  workspace.insertAdjacentElement("beforebegin",panel);
  byId("rfidCsvChoose").addEventListener("click",()=>byId("rfidCsvFile").click());
  byId("rfidCsvFile").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const rows=parseRfidCsv(await file.text()),recorded=new Set(todayEntries().flatMap(e=>[normalizeRfidValue(e.storedName),normalizeRfidValue(e.displayName)])),seen=new Set();pendingRfidImport=rows.map(row=>{const member=matchRfidMember(row);const key=member?normalizeRfidValue(nameForStorage(member)):"";let state="unknown";if(member){state=recorded.has(key)||seen.has(key)?"duplicate":"ready";seen.add(key);}return{...row,member,state};});const ready=pendingRfidImport.filter(x=>x.state==="ready"),unknown=pendingRfidImport.filter(x=>x.state==="unknown"),duplicate=pendingRfidImport.filter(x=>x.state==="duplicate");const preview=byId("rfidCsvPreview");preview.hidden=false;preview.innerHTML=`<strong>Vorschau</strong><p>${ready.length} bereit · ${unknown.length} unbekannt · ${duplicate.length} bereits erfasst/doppelt</p>${unknown.length?`<details><summary>Unbekannte Datensätze anzeigen</summary><ul>${unknown.map(x=>`<li>Zeile ${x.row}: ${escapeHtml(x.name||x.rfid||"Ohne Kennung")}</li>`).join("")}</ul></details>`:""}<div class="rfid-import-actions"><button id="rfidCsvApply" class="primary-button" type="button" ${ready.length?"":"disabled"}>${ready.length} Anwesenheiten übernehmen</button><button id="rfidCsvCancel" class="outline-button" type="button">Abbrechen</button></div>`;byId("rfidCsvCancel").onclick=()=>{preview.hidden=true;preview.innerHTML="";pendingRfidImport=[];event.target.value="";};byId("rfidCsvApply").onclick=()=>applyRfidCsvImport();}catch(error){showToast(error.message||"Die RFID-CSV konnte nicht gelesen werden.","error");}finally{event.target.value="";}});
}
function applyRfidCsvImport(){
  const ready=pendingRfidImport.filter(x=>x.state==="ready"&&x.member);if(!ready.length)return;
  ready.forEach(item=>entries.unshift({id:makeId(),date:today(),time:/^\d{1,2}:\d{2}/.test(item.time)?item.time.slice(0,5):new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),displayName:nameForTile(item.member),storedName:nameForStorage(item.member),role:"",status:"Anwesend",sessionType,sessionId:ensureCurrentSessionId(),source:"RFID-CSV"}));
  saveEntries();renderEntries();renderMembers();updateSelection();updateProbeWorkflow();
  const preview=byId("rfidCsvPreview");if(preview){preview.hidden=true;preview.innerHTML="";}pendingRfidImport=[];showToast(`${ready.length} RFID-Anwesenheit${ready.length===1?"":"en"} übernommen.`);
}
