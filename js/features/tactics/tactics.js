let tacticsClosingPending = false;
let currentTacticsAssignments = new Map();
let currentTacticsSlots = [];
let tacticsDragSource = null;
let currentAtueMember = null;
let tacticsChangeSlots = [];
const GROUP_ROLES = TacticsEngine.GROUP_ROLES;
const STAFF_ROLES = TacticsEngine.STAFF_ROLES;
function tacticsPresentMembers() {
  const names = new Set(todayEntries().filter(entry => entry.status === "Anwesend" && entry.role !== "Orga").flatMap(entry => [entry.storedName, entry.displayName].filter(Boolean)));
  return members.filter(member => !member.ageDepartment && (names.has(nameForStorage(member)) || names.has(nameForTile(member))));
}
function tacticsYearRoleCounts() {
  const year=String(today()).slice(0,4), counts=new Map();
  statisticsArchiveData().filter(data => String(data.rows[0]?.date || data.item.createdAt || "").startsWith(year)).flatMap(data => data.rows).filter(row => row.status === "Anwesend").forEach(row => {
    statisticsRolesFromValue(row.role).forEach(role=>{const key=`${row.name}|||${role}`;counts.set(key,(counts.get(key)||0)+1);});
  });
  return counts;
}
function canDriveVehicle(member, vehicle) {
  return TacticsEngine.canDriveVehicle(member, vehicle);
}
function roleProgress(member, role, counts, targets) {
  const target=targets[role]||0, actual=counts.get(`${nameForStorage(member)}|||${role}`)||0;
  return {target,actual,remaining:Math.max(0,target-actual)};
}
function assignableRolesForTactics(member){
  const roles=getMemberRoles(member);
  // Ohne geplanten Atemschutzeinsatz sind AT und WT normale taktische
  // Funktionen. Deshalb dürfen alle anwesenden Einsatzkräfte dort eingesetzt
  // werden, auch ohne aktive Atemschutzfreigabe.
  return breathingProtectionPlanned?roles:[...new Set([...roles,"ATF","ATM","WTF","WTM"])];
}
function personRoleOptions(member, counts, targets) {
  return assignableRolesForTactics(member).map(role => {
    const progress=roleProgress(member,role,counts,targets);
    const vehicleFit=role!=="Maschinist" || canDriveVehicle(member,"LF10") || canDriveVehicle(member,"TSF");
    return {role,...progress,vehicleFit,score:(progress.remaining*1000)+(progress.target>0?100:0)-progress.actual};
  }).filter(option => option.vehicleFit).sort((a,b)=>b.score-a.score || a.role.localeCompare(b.role,"de"));
}
function preferredRoleForPerson(member, counts, targets) { return personRoleOptions(member,counts,targets)[0] || null; }
function buildPersonRecommendations(present, counts, targets) {
  return present.map(member => ({member, preferred:preferredRoleForPerson(member,counts,targets), options:personRoleOptions(member,counts,targets)})).sort((a,b) => (b.preferred?.remaining||0)-(a.preferred?.remaining||0) || nameForTile(a.member).localeCompare(nameForTile(b.member),"de"));
}
function breathingRoleAllowed(member,role){return !BREATHING_ROLES.has(role)||!breathingProtectionPlanned||hasValidBreathingClearance(member,today());}
function assignmentPriority(roles) {
  const ordered = ["GF", "Maschinist", "ATF", "ATM", "WTF", "WTM", "STF", "STM", "Melder"];
  return ordered.filter(role => roles.includes(role));
}
function assignVehicleFromPeople(people, roles, vehicle) {
  const assignments = new Map();
  assignmentPriority(roles).forEach(role => {
    const candidates=people.filter(person => !person.assigned && person.options.some(option => option.role===role) && breathingRoleAllowed(person.member,role) && (role!=="Maschinist" || canDriveVehicle(person.member,vehicle)));
    candidates.sort((a,b) => {
      const ao=a.options.find(option=>option.role===role), bo=b.options.find(option=>option.role===role);
      const ap=a.preferred?.role===role?5000:0, bp=b.preferred?.role===role?5000:0;
      if(role==="Maschinist" && vehicle==="TSF") {
        const ats=(a.member.machinistVehicles||[]).includes("TSF") && !(a.member.machinistVehicles||[]).includes("LF")?7000:0;
        const bts=(b.member.machinistVehicles||[]).includes("TSF") && !(b.member.machinistVehicles||[]).includes("LF")?7000:0;
        if(bts!==ats)return bts-ats;
      }
      return (bp+bo.score)-(ap+ao.score) || nameForTile(a.member).localeCompare(nameForTile(b.member),"de");
    });
    const selected=candidates[0]||null;
    if(selected) selected.assigned={vehicle,role};
    assignments.set(role, selected?.member || null);
  });
  return roles.map(role => ({ role, member: assignments.get(role) || null }));
}
function vehicleHasMinimumUnit(slots) {
  const filled=new Set(slots.filter(slot=>slot.member).map(slot=>slot.role));
  const completeTeam=(filled.has("ATF")&&filled.has("ATM")) || (filled.has("WTF")&&filled.has("WTM")) || (filled.has("STF")&&filled.has("STM"));
  return filled.has("GF") && filled.has("Maschinist") && completeTeam;
}
function returnVehicleCrewToPool(people, crew) {
  crew.filter(item=>item.member).forEach(item=>{const person=people.find(entry=>entry.member.id===item.member.id);if(person)person.assigned=null;});
}
function protectCriticalVehicleSlots(slots) {
  const criticalOrder = [
    { vehicle:"LF10", role:"GF" }, { vehicle:"LF10", role:"Maschinist" },
    { vehicle:"TSF", role:"GF" }, { vehicle:"TSF", role:"Maschinist" }
  ];
  criticalOrder.forEach(targetKey => {
    const target=slots.find(slot=>slot.vehicle===targetKey.vehicle && slot.role===targetKey.role);
    if(!target || target.member) return;
    const candidates=slots.filter(source => source.vehicle===targetKey.vehicle && source.member && source.role!=="Maschinist" && source.role!=="GF" && memberMayFillSlot(source.member,targetKey.vehicle,targetKey.role));
    candidates.sort((a,b) => {
      if(targetKey.role==="Maschinist" && targetKey.vehicle==="TSF") {
        const av=(a.member.machinistVehicles||[]), bv=(b.member.machinistVehicles||[]);
        const aOnly=av.includes("TSF")&&!av.includes("LF")?0:1, bOnly=bv.includes("TSF")&&!bv.includes("LF")?0:1;
        if(aOnly!==bOnly) return aOnly-bOnly;
      }
      const sacrificePriority={STM:0,STF:0,Melder:1,WTM:2,WTF:2,ATM:3,ATF:3};
      return (sacrificePriority[a.role]??99)-(sacrificePriority[b.role]??99);
    });
    const source=candidates[0];
    if(source){ target.member=source.member; source.member=null; }
  });
  return slots;
}
function assignmentReason(member, role) {
  if (!member) return "Position noch offen";
  const progress = roleProgress(member, role, tacticsYearRoleCounts(), getRoleTargets());
  if (progress.remaining > 0) return `Jahresziel: Funktion noch ${progress.remaining}-mal offen`;
  if (progress.actual === 0) return "Funktion bisher noch nicht ausgeübt";
  return `Ausgleich: Funktion bisher ${progress.actual}-mal übernommen`;
}
function crewHtml(crew, vehicle) { return crew.map(item => `<div class="crew-position ${item.member?"crew-filled crew-draggable":"crew-open"}" data-drop-vehicle="${vehicle}" data-drop-role="${item.role}" ${item.member?`draggable="true" data-drag-member="${escapeHtml(item.member.id)}"`:""}><span>${escapeHtml(item.role)}</span><strong>${item.member?escapeHtml(nameForTile(item.member)):"nicht besetzt"}</strong><small>${escapeHtml(assignmentReason(item.member,item.role))}</small></div>`).join(""); }
function ensureTacticsChangePanel(){
  let panel=byId("tacticsChangePanel");if(panel)return panel;
  panel=document.createElement("article");panel.id="tacticsChangePanel";panel.className="panel tactics-change-panel";panel.hidden=true;
  panel.innerHTML=`<div class="panel-heading"><span class="step yellow">2</span><div><h3>Zweite Fahrzeugbesetzung</h3><small>Kopie der ersten Füllung für einen Funktionswechsel während der Probe</small></div><button type="button" class="outline-button" id="removeTacticsChange">Entfernen</button></div><p class="tactics-change-hint">Bei einer Auswahl wird die gewählte Person mit der bisher hier eingeteilten Person getauscht. Dadurch bleibt jede Person nur einmal eingeteilt.</p><div class="tactics-change-grid" id="tacticsChangeGrid"></div>`;
  const reserve=byId("reserveCrew")?.closest(".tactics-reserve"),education=byId("tacticsEducation");
  if(reserve)reserve.insertAdjacentElement("afterend",panel);else if(education)education.insertAdjacentElement("beforebegin",panel);else byId("tacticsView")?.appendChild(panel);
  panel.querySelector("#removeTacticsChange").onclick=()=>{tacticsChangeSlots=[];panel.hidden=true;rebuildTacticsAssignmentsFromSlots();};
  panel.addEventListener("change",event=>{const select=event.target.closest("[data-change-slot]");if(!select)return;swapTacticsChangeMember(Number(select.dataset.changeSlot),select.value);});
  return panel;
}
function createTacticsChange(){
  if(!currentTacticsSlots.some(slot=>slot.member))return showToast("Bitte zuerst die erste Fahrzeugbesetzung erstellen.","error");
  tacticsChangeSlots=currentTacticsSlots.map(slot=>({vehicle:slot.vehicle,role:slot.role,member:slot.member||null}));
  renderTacticsChange();rebuildTacticsAssignmentsFromSlots();setTimeout(()=>byId("tacticsChangePanel")?.scrollIntoView({behavior:"smooth",block:"start"}),0);
}
function renderTacticsChange(){
  const panel=ensureTacticsChangePanel(),grid=byId("tacticsChangeGrid");panel.hidden=!tacticsChangeSlots.length;if(!tacticsChangeSlots.length||!grid)return;
  const people=tacticsPresentMembers().slice().sort((a,b)=>nameForTile(a).localeCompare(nameForTile(b),"de"));
  const vehicleHtml=vehicle=>{const slots=tacticsChangeSlots.map((slot,index)=>({...slot,index})).filter(slot=>slot.vehicle===vehicle);if(!slots.length)return"";return `<section class="tactics-change-vehicle"><h4>${escapeHtml(vehicle)}</h4><div class="tactics-change-slots">${slots.map(slot=>`<label class="tactics-change-slot"><span>${escapeHtml(slot.role)}</span><select data-change-slot="${slot.index}"><option value="">nicht besetzt</option>${people.map(person=>`<option value="${escapeHtml(person.id)}" ${slot.member?.id===person.id?"selected":""}>${escapeHtml(nameForTile(person))}</option>`).join("")}</select><small>${slot.member?"Aus erster Füllung übernommen":"Position offen"}</small></label>`).join("")}</div></section>`;};
  grid.innerHTML=vehicleHtml("LF10")+vehicleHtml("TSF");
}
function swapTacticsChangeMember(slotIndex,memberId){
  const target=tacticsChangeSlots[slotIndex];if(!target)return;const next=memberId?members.find(member=>member.id===memberId):null;
  if(next&&!memberMayFillSlot(next,target.vehicle,target.role)){renderTacticsChange();return showToast(deniedTacticsSlotMessage(next,target.vehicle,target.role),"error");}
  const source=next?tacticsChangeSlots.find(slot=>slot.member?.id===next.id):null,previous=target.member;target.member=next||null;if(source&&source!==target)source.member=previous||null;renderTacticsChange();rebuildTacticsAssignmentsFromSlots();
}
function tacticsRolesForMember(member){const first=currentTacticsSlots.find(slot=>slot.member?.id===member.id),second=tacticsChangeSlots.find(slot=>slot.member?.id===member.id),label=slot=>slot?`${slot.vehicle} ${slot.role}`:"Reserve";return tacticsChangeSlots.length?`1. Füllung: ${label(first)} | 2. Füllung: ${label(second)}`:label(first);}
function rebuildTacticsAssignmentsFromSlots() {
  currentTacticsAssignments = new Map(tacticsPresentMembers().map(member=>{const first=currentTacticsSlots.find(slot=>slot.member?.id===member.id),second=tacticsChangeSlots.find(slot=>slot.member?.id===member.id);return [nameForStorage(member),{vehicle:first?.vehicle||"",role:first?.role||"",roleLabel:tacticsRolesForMember(member),secondVehicle:second?.vehicle||"",secondRole:second?.role||""}];}));
}
function memberMayFillSlot(member, vehicle, role) {
  if(!member||!vehicle||!role)return false;
  if(role==="Maschinist")return canDriveVehicle(member,vehicle);
  if(role==="ATÜ")return Boolean(member.atueQualified);
  if(!assignableRolesForTactics(member).includes(role))return false;
  // Nur bei aktiviertem Kästchen wird für AT/WT eine gültige
  // Atemschutzfreigabe verlangt.
  return breathingRoleAllowed(member,role);
}
function deniedTacticsSlotMessage(member, vehicle, role) {
  return "Diese Position konnte nicht übernommen werden.";
}
function hasTacticalUnit(slots) {
  const filled=new Set(slots.filter(slot=>slot.member).map(slot=>slot.role));
  const hasLeader=filled.has("GF");
  const hasDriver=filled.has("Maschinist");
  const hasAttackTeam=filled.has("ATF") && filled.has("ATM");
  const hasWaterTeam=filled.has("WTF") && filled.has("WTM");
  const hasHoseTeam=filled.has("STF") && filled.has("STM");
  return hasLeader && hasDriver && (hasAttackTeam || hasWaterTeam || hasHoseTeam);
}
function updateVehicleCardStatus(crewId, slots) {
  const card=byId(crewId).closest(".tactics-vehicle");
  const full=slots.length>0 && slots.every(slot=>slot.member);
  card?.classList.toggle("vehicle-fully-staffed", full);
  card?.classList.toggle("tactical-unit-ready", !full && hasTacticalUnit(slots));
}
function updateTacticalUnitCards(group, staff) {
  updateVehicleCardStatus("groupCrew", group);
  updateVehicleCardStatus("staffCrew", staff);
}
function unitStrengthLabel(slots) {
  const filled = slots.filter(slot => slot.member).length;
  const hasLeader = slots.some(slot => slot.role === "GF" && slot.member);
  if (!hasLeader || filled < 4) return "keine Einheit";
  return `1/${filled - 1}`;
}
function unitStrengthDetail(slots, fullValue) {
  const filled=slots.filter(slot=>slot.member).length, hasLeader=slots.some(slot=>slot.role==="GF"&&slot.member);
  if(!hasLeader) return "Gruppenführer fehlt";
  if(filled<4) return `Noch ${4-filled} Kraft/Kräfte bis zur kleinsten Einheit 1/3`;
  const label=`1/${filled-1}`;
  if(label===fullValue) return `${fullValue} · ${fullValue==="1/5"?"Staffel":"Gruppe"} vollständig`;
  const missing=slots.filter(slot=>!slot.member).map(slot=>slot.role);
  return `${label} · offen: ${missing.join(", ")}`;
}
function currentTacticsRecommendationText() {
  return TacticsEngine.recommendationText(sessionType,currentTacticsSlots);
}
function updateTacticsRecommendationAfterManualChange() {
  const box=byId("tacticsRecommendation");
  if(box) box.innerHTML=`<strong>Empfehlung</strong><p>${escapeHtml(currentTacticsRecommendationText())}</p>`;
}
function renderAtueSlot(){const slot=byId("atueSlot");if(!slot)return;const card=slot.closest("#tacticsAtue");if(card)card.hidden=false;if(!breathingProtectionPlanned)currentAtueMember=null;slot.classList.toggle("crew-filled",Boolean(currentAtueMember));slot.classList.toggle("crew-open",!currentAtueMember);slot.classList.toggle("crew-draggable",Boolean(currentAtueMember));if(currentAtueMember){slot.draggable=true;slot.dataset.dragMember=currentAtueMember.id;}else{slot.draggable=false;delete slot.dataset.dragMember;}slot.querySelector("strong").textContent=currentAtueMember?nameForTile(currentAtueMember):"nicht besetzt";slot.querySelector("small").textContent=currentAtueMember?"Manuell eingeteilte Atemschutzüberwachung":"Geeignete übrige Person manuell als ATÜ einteilen.";}

function ensureTacticsSideLayout(){
  const vehicles=document.querySelector("#tacticsView .tactics-vehicles");
  const reserve=document.querySelector("#tacticsView .tactics-reserve");
  if(!vehicles||!reserve)return;
  if(reserve.parentElement!==vehicles)vehicles.appendChild(reserve);
  vehicles.classList.add("tactics-three-column-layout");
  reserve.classList.add("tactics-reserve-side");
}

function refreshTacticsManualView() {
  ensureTacticsSideLayout();
  const group=currentTacticsSlots.filter(slot=>slot.vehicle==="LF10"), staff=currentTacticsSlots.filter(slot=>slot.vehicle==="TSF");
  byId("groupCrew").innerHTML=crewHtml(group,"LF10"); byId("staffCrew").innerHTML=crewHtml(staff,"TSF");
  byId("groupFillBadge").textContent=unitStrengthLabel(group); byId("staffFillBadge").textContent=unitStrengthLabel(staff); byId("groupStrengthDetail").textContent=unitStrengthDetail(group,"1/8"); byId("staffStrengthDetail").textContent=unitStrengthDetail(staff,"1/5");
  updateTacticalUnitCards(group, staff);
  const assignedIds=new Set(currentTacticsSlots.filter(x=>x.member).map(x=>x.member.id));
  const reserve=tacticsPresentMembers().filter(member=>!assignedIds.has(member.id)&&member.id!==currentAtueMember?.id);
  const organizers=todayEntries().filter(entry=>entry.status==="Anwesend"&&entry.role==="Orga");
  const organizerNames=[...new Set(organizers.map(entry=>entry.displayName||entry.storedName||entry.name).filter(Boolean))];
  const reserveMarkup=reserve.map(member=>`<span draggable="true" data-drag-member="${escapeHtml(member.id)}">${escapeHtml(nameForTile(member))} · Reserve</span>`).join("");
  const organizerMarkup=organizerNames.map(name=>`<span class="tactics-organizer-entry">${escapeHtml(name)} · Orga</span>`).join("");
  byId("reserveCrew").innerHTML=reserveMarkup+organizerMarkup;byId("reserveCount").textContent=reserve.length+organizerNames.length;byId("reserveEmpty").hidden=reserve.length+organizerNames.length>0;
  rebuildTacticsAssignmentsFromSlots();
  renderAtueSlot();
}
function findTacticsMember(id){return members.find(member=>member.id===id)||null;}
function manualMoveTacticsMember(memberId,targetVehicle,targetRole){
  const member=findTacticsMember(memberId); if(!member)return;
  if(targetVehicle==="ATUE"){if(!breathingProtectionPlanned)return showToast("Bitte zuerst Atemschutz für diese Probe aktivieren.","error");if(!member.atueQualified)return showToast("Diese Person ist nicht für die Atemschutzüberwachung freigeschaltet.","error");const source=currentTacticsSlots.find(slot=>slot.member?.id===memberId);if(source)source.member=null;const displaced=currentAtueMember;currentAtueMember=member;if(displaced&&source)source.member=displaced;refreshTacticsManualView();updateTacticsRecommendationAfterManualChange();return;}
  if(BREATHING_ROLES.has(targetRole)&&breathingProtectionPlanned&&!hasValidBreathingClearance(member,today())){const state=breathingClearanceState(member,today()),label=state==="expired"?`am ${member.breathingClearanceUntil} abgelaufen`:"nicht gültig hinterlegt";if(!confirm(`Warnung: Die Atemschutzfreigabe von ${nameForTile(member)} ist ${label}. Trotzdem manuell auf ${targetRole} setzen?`))return;}
  if(currentAtueMember?.id===memberId)currentAtueMember=null;
  if(targetVehicle!=="RESERVE"&&!memberMayFillSlot(member,targetVehicle,targetRole))return showToast(deniedTacticsSlotMessage(member,targetVehicle,targetRole),"error");
  const source=currentTacticsSlots.find(slot=>slot.member?.id===memberId)||null;
  if(targetVehicle==="RESERVE"){if(source)source.member=null;refreshTacticsManualView();updateTacticsRecommendationAfterManualChange();return;}
  const target=currentTacticsSlots.find(slot=>slot.vehicle===targetVehicle&&slot.role===targetRole); if(!target)return;
  const displaced=target.member;
  if(source&&displaced&&!memberMayFillSlot(displaced,source.vehicle,source.role))return showToast(deniedTacticsSlotMessage(displaced,source.vehicle,source.role),"error");
  target.member=member; if(source)source.member=displaced||null;
  refreshTacticsManualView();
  updateTacticsRecommendationAfterManualChange();
}
function initializeTacticsDragDrop(){
  ensureTacticsSideLayout();
  const view=byId("tacticsView");
  view.addEventListener("dragstart",e=>{const el=e.target.closest("[data-drag-member]");if(!el)return;tacticsDragSource=el.dataset.dragMember;el.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",tacticsDragSource);});
  view.addEventListener("dragend",e=>{e.target.closest("[data-drag-member]")?.classList.remove("dragging");view.querySelectorAll(".drag-over").forEach(el=>el.classList.remove("drag-over"));tacticsDragSource=null;});
  view.addEventListener("dragover",e=>{const target=e.target.closest("[data-drop-vehicle],#reserveCrew");if(!target)return;e.preventDefault();target.classList.add("drag-over");});
  view.addEventListener("dragleave",e=>e.target.closest("[data-drop-vehicle],#reserveCrew")?.classList.remove("drag-over"));
  view.addEventListener("drop",e=>{const target=e.target.closest("[data-drop-vehicle],#reserveCrew");if(!target)return;e.preventDefault();target.classList.remove("drag-over");const id=e.dataTransfer.getData("text/plain")||tacticsDragSource;if(!id)return;if(target.id==="reserveCrew")manualMoveTacticsMember(id,"RESERVE","");else manualMoveTacticsMember(id,target.dataset.dropVehicle,target.dataset.dropRole);});
}
function canKeepCurrentTactics(present) {
  if(!currentTacticsSlots.length) return false;
  const presentIds=new Set(present.map(member=>member.id));
  return currentTacticsSlots.filter(slot=>slot.member).every(slot=>presentIds.has(slot.member.id));
}
function fillOpenSlotsWithoutReordering(people) {
  const assignedIds=new Set(currentTacticsSlots.filter(slot=>slot.member).map(slot=>slot.member.id));
  people.forEach(person=>{person.assigned=assignedIds.has(person.member.id)?{locked:true}:null;});
  const fillVehicle=(vehicle, allowStart) => {
    const slots=currentTacticsSlots.filter(slot=>slot.vehicle===vehicle);
    const alreadyActive=slots.some(slot=>slot.member);
    if(!alreadyActive && !allowStart) return;
    assignmentPriority(slots.map(slot=>slot.role)).forEach(role=>{
      const slot=slots.find(item=>item.role===role);
      if(!slot || slot.member) return;
      const candidates=people.filter(person=>!person.assigned && person.options.some(option=>option.role===role) && breathingRoleAllowed(person.member,role) && (role!=="Maschinist"||canDriveVehicle(person.member,vehicle)));
      candidates.sort((a,b)=>{
        const ao=a.options.find(option=>option.role===role),bo=b.options.find(option=>option.role===role);
        return bo.score-ao.score || nameForTile(a.member).localeCompare(nameForTile(b.member),"de");
      });
      const selected=candidates[0];
      if(selected){slot.member=selected.member;selected.assigned={vehicle,role};}
    });
  };
  fillVehicle("LF10",true);
  const lfFull=currentTacticsSlots.filter(slot=>slot.vehicle==="LF10").every(slot=>slot.member);
  fillVehicle("TSF",lfFull && currentTacticsSlots.some(slot=>slot.vehicle==="TSF"&&slot.member));
}
function vehicleIsFullyStaffed(vehicle){
  const slots=currentTacticsSlots.filter(slot=>slot.vehicle===vehicle);
  return slots.length>0 && slots.every(slot=>slot.member);
}
function vehicleHasCompleteStaffel(vehicle){
  return TacticsEngine.vehicleHasCompleteStaffel(currentTacticsSlots,vehicle);
}
function hasCompleteStaffelOnAnyVehicle(){
  return TacticsEngine.hasCompleteStaffelOnAnyVehicle(currentTacticsSlots);
}
function updateTacticsAlternatives(){
  const education=byId("tacticsEducation");
  if(!education)return;
  const show=TacticsEngine.shouldShowAlternative(sessionType,currentTacticsSlots);
  education.hidden=!show;
  const text=byId("tacticsAlternativeText");
  if(text&&show)text.textContent="Auf keinem Fahrzeug kann eine vollständige Staffel 1/5 besetzt werden. Die Probe kann als Sonderprobe oder als Unterricht abgeschlossen werden.";
}

function tacticsPresentationCard(vehicle,title,roles){
 const slots=currentTacticsSlots.filter(slot=>slot.vehicle===vehicle);
 return `<section class="tactics-presentation-vehicle"><header><span>${escapeHtml(vehicle)}</span><h3>${escapeHtml(title)}</h3></header><div class="tactics-presentation-slots">${roles.map(role=>{const slot=slots.find(item=>item.role===role),name=slot?.member?nameForTile(slot.member):"nicht besetzt";return `<div class="tactics-presentation-slot${slot?.member?" filled":" open"}"><b>${escapeHtml(role)}</b><strong>${escapeHtml(name)}</strong></div>`;}).join("")}</div></section>`;
}
function openTacticsPresentation(){
 if(sessionType!=="Allgemeine Probe")return;
 document.querySelectorAll("#tacticsPresentationDialog").forEach(node=>node.remove());
 const dialog=document.createElement("dialog");dialog.id="tacticsPresentationDialog";dialog.className="tactics-presentation-dialog";
 const assignedIds=new Set(currentTacticsSlots.filter(slot=>slot.member).map(slot=>slot.member.id));
 const reserve=tacticsPresentMembers().filter(member=>!assignedIds.has(member.id)&&member.id!==currentAtueMember?.id);
 const atueMarkup=currentAtueMember?`<span>${escapeHtml(nameForTile(currentAtueMember))} · ATÜ</span>`:"";
 const reserveMarkup=reserve.map(member=>`<span>${escapeHtml(nameForTile(member))}</span>`).join("");
 dialog.innerHTML=`<div class="tactics-presentation-shell"><header><div><small>Allgemeine Probe</small><h2>Mannschaftseinteilung</h2></div><button type="button" data-close-presentation aria-label="Vorschau schließen">×</button></header><main>${tacticsPresentationCard("LF10","Gruppenbesetzung",GROUP_ROLES)}${tacticsPresentationCard("TSF","Staffelbesetzung",STAFF_ROLES)}</main>${reserve.length||currentAtueMember?`<footer><b>Weitere Anwesende</b><div class="tactics-presentation-additional">${reserveMarkup}${atueMarkup}</div></footer>`:""}</div>`;
 document.body.appendChild(dialog);dialog.querySelector("[data-close-presentation]").onclick=()=>dialog.close();dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener("close",()=>dialog.remove(),{once:true});dialog.showModal();
}

function renderTactics() {
  breathingProtectionPlanned=Boolean(byId("breathingProtectionPlanned")?.checked);
  const present=tacticsPresentMembers(), counts=tacticsYearRoleCounts(), targets=getRoleTargets();
  const people=buildPersonRecommendations(present,counts,targets);
  let group=[], staff=[], recommendation="";
  if(canKeepCurrentTactics(present)) {
    fillOpenSlotsWithoutReordering(people);
    refreshTacticsManualView();
    byId("tacticsSummary").textContent=`${present.length} anwesende Einsatzkräfte · ${sessionType}`;const presentationButton=byId("openTacticsPresentation");if(presentationButton)presentationButton.hidden=sessionType!=="Allgemeine Probe";
    byId("tacticsRecommendation").innerHTML=`<strong>Empfehlung</strong><p>Bestehende Fahrzeugbesetzung beibehalten. Nachzügler werden nur auf noch freie, passende Positionen gesetzt; bereits zugeteilte Personen werden nicht umgesetzt.</p>`;
    updateTacticsAlternatives();
    return;
  }
  if(present.length>=9) {
    group=assignVehicleFromPeople(people,GROUP_ROLES,"LF10");
    const remaining=people.filter(person=>!person.assigned).length;
    if(remaining>=4) {
      const proposedStaff=assignVehicleFromPeople(people,STAFF_ROLES,"TSF");
      if(vehicleHasMinimumUnit(proposedStaff)) staff=proposedStaff;
      else returnVehicleCrewToPool(people,proposedStaff);
    }
    recommendation=staff.length
      ? "Das LF10 ist als Gruppe 1/8 besetzt. Das TSF fährt zusätzlich, weil aus den übrigen Kräften mindestens eine eigenständige Einheit 1/3 gebildet werden kann."
      : "Das LF10 wird zuerst bis zur Gruppe 1/8 gefüllt. Das TSF bleibt stehen, solange aus den übrigen Kräften keine zusätzliche Einheit 1/3 möglich ist.";
  } else if(present.length>=4) {
    group=assignVehicleFromPeople(people,GROUP_ROLES,"LF10");
    group=protectCriticalVehicleSlots(group.map(item=>({vehicle:"LF10",role:item.role,member:item.member}))).map(item=>({role:item.role,member:item.member}));
    recommendation=vehicleHasMinimumUnit(group)
      ? present.length>=6
        ? "Das LF10 wird als Staffel beziehungsweise Teilgruppe besetzt. Das TSF bleibt stehen, bis das LF10 zur Gruppe 1/8 aufgefüllt ist."
        : "Das LF10 wird als kleinste taktische Einheit ab 1/3 besetzt. Das TSF bleibt stehen."
      : "Auf dem LF10 kann keine einsatzfähige Einheit 1/3 gebildet werden. Unterricht oder angepasste Ausbildung durchführen.";
  } else recommendation="Keine kleinste Einheit 1/3 möglich. Unterricht oder angepasste Ausbildung durchführen.";
  if(!group.length)group=GROUP_ROLES.map(role=>({role,member:null}));
  if(!staff.length)staff=STAFF_ROLES.map(role=>({role,member:null}));
  if(!breathingProtectionPlanned)currentAtueMember=null;
  currentTacticsSlots=protectCriticalVehicleSlots([...group.map(item=>({vehicle:"LF10",role:item.role,member:item.member})),...staff.map(item=>({vehicle:"TSF",role:item.role,member:item.member}))]);
  refreshTacticsManualView();
  byId("tacticsSummary").textContent=`${present.length} anwesende Einsatzkräfte · ${sessionType}`;const presentationButton=byId("openTacticsPresentation");if(presentationButton)presentationButton.hidden=sessionType!=="Allgemeine Probe";
  if(sessionType==="Allgemeine Probe" && !hasCompleteStaffelOnAnyVehicle()) recommendation="Auf keinem Fahrzeug kann eine vollständige Staffel 1/5 besetzt werden. Als Alternative stehen Sonderprobe oder Unterricht zur Auswahl.";
  byId("tacticsRecommendation").innerHTML=`<strong>Empfehlung</strong><p>${escapeHtml(recommendation)}</p>`;
  updateTacticsAlternatives();
}
function openTactics(forClosing=false){tacticsClosingPending=forClosing;renderTactics();const actions=byId("tacticsCloseActions");actions.hidden=!forClosing;if(forClosing&&!byId("addTacticsChangeButton")){const button=document.createElement("button");button.type="button";button.id="addTacticsChangeButton";button.className="outline-button";button.textContent="Zweite Füllung anlegen";button.onclick=createTacticsChange;actions.prepend(button);}byId("tacticsView").hidden=false;showView("attendanceView");setTimeout(()=>byId("tacticsView")?.scrollIntoView({behavior:"smooth",block:"start"}),0);}
function lfWaterTeamComplete() {
  const lf=currentTacticsSlots.filter(slot=>slot.vehicle==="LF10");
  return Boolean(lf.find(slot=>slot.role==="WTF"&&slot.member) && lf.find(slot=>slot.role==="WTM"&&slot.member));
}
function convertCurrentProbeToSpecial() {
  sessionType="Sonderprobe";
  entries=entries.map(entry=>entry.sessionId!==ensureCurrentSessionId()?entry:{...entry,sessionType:"Sonderprobe",role:entry.role==="Orga"?"Orga":"",status:entry.status==="Anwesend"?"Anwesend":entry.status});
  saveEntries(); renderSessionType();
}
function convertCurrentProbeToTraining(){
  sessionType="Unterricht";
  entries=entries.map(entry=>entry.sessionId!==ensureCurrentSessionId()?entry:{...entry,sessionType:"Unterricht",role:entry.role==="Orga"?"Orga":entry.status==="Anwesend"?"Unterricht":""});
  saveEntries();renderSessionType();renderEntries();updatePrimaryAction();window.syncHeaderProbeSummary?.();
}
async function finishTacticsAlternative(type){
  if(!tacticsClosingPending)return;
  if(type==="Unterricht")convertCurrentProbeToTraining();
  else convertCurrentProbeToSpecial();
  tacticsClosingPending=false;
  const actions=byId("tacticsCloseActions");if(actions)actions.hidden=true;
  const view=byId("tacticsView");if(view)view.hidden=true;
  showView("attendanceView");
  await closeDay(currentClosingTopic);
}
function applyCalculatedTacticsFunctions() {
  entries = entries.map(entry => {
    if (entry.sessionId !== ensureCurrentSessionId() || entry.status !== "Anwesend") return entry;
    if (entry.role === "Orga") return entry;
    if(breathingProtectionPlanned&&currentAtueMember && (entry.storedName===nameForStorage(currentAtueMember)||entry.displayName===nameForTile(currentAtueMember)))return {...entry,role:"ATÜ"};
    const assignment = currentTacticsAssignments.get(entry.storedName);
    return assignment ? { ...entry, role:assignment.role||"Reserve", vehicle:assignment.vehicle, tacticsRoleLabel:assignment.roleLabel, secondVehicle:assignment.secondVehicle, secondRole:assignment.secondRole } : { ...entry, role:"Reserve" };
  });
  saveEntries();
}
async function finalizeProbeFromTactics(){
  if(!tacticsClosingPending)return;
  if(sessionType==="Allgemeine Probe" && !hasCompleteStaffelOnAnyVehicle()){
    updateTacticsAlternatives();
    showToast("Auf keinem Fahrzeug ist eine vollständige Staffel 1/5 besetzbar. Bitte Sonderprobe oder Unterricht als alternative Durchführung auswählen.","error");
    byId("tacticsEducation")?.scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  applyCalculatedTacticsFunctions();
  tacticsClosingPending=false;
  const actions=byId("tacticsCloseActions");if(actions)actions.hidden=true;
  const view=byId("tacticsView");if(view)view.hidden=true;
  showView("attendanceView");
  await closeDay(currentClosingTopic);
}

byId("breathingProtectionPlanned")?.addEventListener("change",event=>{breathingProtectionPlanned=event.target.checked;if(!breathingProtectionPlanned)currentAtueMember=null;currentTacticsSlots=[];tacticsChangeSlots=[];currentTacticsAssignments=new Map();renderTactics();});
initializeTacticsDragDrop();

byId("openTacticsPresentation")?.addEventListener("click",openTacticsPresentation);
