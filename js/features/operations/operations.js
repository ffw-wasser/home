"use strict";
let currentOperationId=safeStorage.getItem("fw_v1_current_operation_id")||"";
let currentOperationDraft=null,editingOperationArchiveId="",operationAssignmentGroup="EM 5/42 LF10",operationAssignments={},operationAssignmentRoles={};
const OP_VEHICLES=["EM 5/47 TSF","EM 5/42 LF10"],OP_VEHICLE_CAPACITY=Object.freeze({"EM 5/47 TSF":7,"EM 5/42 LF10":9});
const OP_DEVICES=["Wärmebildkamera","Pressluftatmer","Kettensäge","Sprungpolster","Belüftungsgerät","Stromerzeuger","Tauchpumpe","Wassersauger","Rettungsschere","Rettungsspreizer","Rettungszylinder","Türöffnungswerkzeug"];
const OP_ROLE_ORDER=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM","STF","STM","Melder"]),OP_AGENCIES=["Polizei","Streifendienst","KDD","Kripo","Bundespolizei","Rettungsdienst","RTW","NEF","KTW","RTH","DRK Ortsverein","KBM","Stadt Emmendingen","Stadtwerke","Netze BW","Badenova","THW","DLRG","Abschleppdienst","Straßen-/Autobahnmeisterei","DB-Notfallmanager","Bestatter","Weitere Feuerwehren"];
function operationRoleRank(r){const i=OP_ROLE_ORDER.indexOf(String(r||""));return i<0?99:i}function operationSortNames(n,r){return[...n].sort((a,b)=>operationRoleRank(r?.[a])-operationRoleRank(r?.[b])||operationProtocolName(a).localeCompare(operationProtocolName(b),"de"))}
window.__ffwFinishOperation=async e=>{e?.preventDefault?.();e?.stopPropagation?.();try{if(typeof window.finishOperationZip!=="function")throw Error("Einsatzabschluss-Modul ist nicht geladen");await window.finishOperationZip()}catch(x){console.error(x);showToast?.(`Einsatz konnte nicht abgeschlossen werden: ${x?.message||"unbekannter Fehler"}`,"error")}return false};
function operationSessionKey(){return currentOperationId||""}function startOperationSession(){if(currentOperationId&&entries.some(e=>e.operationId===currentOperationId))return;operationAssignments={};operationAssignmentRoles={};currentOperationId=`op-${today()}-${Date.now()}-${Math.random().toString(16).slice(2)}`;safeStorage.setItem("fw_v1_current_operation_id",currentOperationId);currentOperationDraft=null}function operationEntries(){return entries.filter(e=>e.operationId===currentOperationId)}function operationNames(){return operationEntries().filter(e=>e.status==="Anwesend").map(e=>e.storedName||e.displayName)}function operationProtocolName(v){const n=String(v||"").trim();if(!n.includes(","))return n;const[l,...f]=n.split(",");return[f.join(",").trim(),l.trim()].filter(Boolean).join(" ")}
function operationValue(id){return String(byId(id)?.value||"").trim()}function checkedValues(name){return[...document.querySelectorAll(`#operationReportForm input[name="${name}"]:checked`)].map(x=>x.value)}
function ensureOperationForm(){let s=byId("operationReportForm");if(s)return s;s=document.createElement("section");s.id="operationReportForm";s.className="panel operation-report-form";s.hidden=true;const checks=(a,n)=>a.map(v=>`<label class="operation-check"><input type="checkbox" name="${n}" value="${escapeHtml(v)}"><span>${escapeHtml(v)}</span></label>`).join("");s.innerHTML=`<div class="flow-stage-heading"><span>4</span><div><strong>Einsatzbericht erfassen</strong><small>Mehrere Einsätze am selben Tag werden getrennt gespeichert.</small></div></div><div class="operation-grid"><label>Einsatzdatum<input id="opDate" type="date"></label><label>Einsatznummer<input id="opNumber"></label><label>Einsatzart *<input id="opType"></label><label>Einsatzstelle *<input id="opLocation"></label><label>Einsatzleiter<input id="opLeader"></label><label>ZvD<input id="opZvd"></label></div><fieldset><legend>Zeiten</legend><div class="operation-grid"><label>Alarm *<input id="opAlarm" type="time"></label><label>Ausgerückt<input id="opDeparted" type="time"></label><label>Einsatzstelle<input id="opArrived" type="time"></label><label>Einsatzende<input id="opEnded" type="time"></label><label>Eingerückt<input id="opReturned" type="time"></label></div></fieldset><fieldset><legend>Bericht</legend><label>Lage beim Eintreffen *<textarea id="opSituation"></textarea></label><label>Verlauf der Tätigkeit *<textarea id="opActions"></textarea></label><label>Besondere Vorkommnisse<textarea id="opSpecial"></textarea></label></fieldset><fieldset><legend>Einsatzmittel und Zusammenarbeit</legend><div class="operation-resource-grid"><section><h4>Geräte</h4><div class="operation-check-grid">${checks(OP_DEVICES,"opDevices")}</div></section><section><h4>Weitere Stellen</h4><div class="operation-check-grid">${checks(OP_AGENCIES,"opAgencies")}</div></section></div><div class="operation-grid"><label>Wasserentnahmestellen<input id="opWaterSources" placeholder="z. B. Hydrant, offenes Gewässer"></label><label>Schlauchmaterial<input id="opPipes" placeholder="z. B. 8 B, 6 C"></label><label>Ölbindemittel / Betriebsstoffe<input id="opOil" placeholder="Art und Menge"></label><label>Alarmierungswege<input id="opAlarmMethods" placeholder="z. B. Melder, Sirene"></label></div></fieldset><fieldset><legend>Atemschutz</legend><label class="operation-check"><input id="opAtueUsed" type="checkbox"><span>Atemschutzüberwachung wurde durchgeführt</span></label><label class="operation-check"><input id="opAtueDepartment" type="checkbox"><span>Abteilung Emmendingen durchgeführt</span></label><label id="opAtuePersonLabel">ATÜ-Person<select id="opAtuePerson"><option value="">Bitte auswählen</option></select></label><p class="operation-field-hint">Ein Foto des Berichts ist optional.</p></fieldset><div id="operationValidation" hidden></div><div class="operation-actions"><button class="outline-button" id="operationBack" type="button">Zurück</button><button class="primary-button" id="operationFinish" type="button" onclick="return window.__ffwFinishOperation(event)">Einsatz abschließen · Terminpaket</button></div>`;byId("attendanceView").appendChild(s);byId("operationBack").onclick=()=>showOperationForm();const sync=()=>{const used=byId("opAtueUsed")?.checked,department=byId("opAtueDepartment")?.checked,p=byId("opAtuePerson");if(p){p.disabled=department;if(department)p.value=""}byId("opAtuePersonLabel").hidden=department;if(!used||department){resetDocumentReportState();hideDocumentReportUi?.()}else if(String(p?.value||"").trim()&&!documentReportReady)showDocumentReportPanel()};byId("opAtueUsed").onchange=sync;byId("opAtueDepartment").onchange=e=>{if(e.target.checked)byId("opAtueUsed").checked=true;sync()};byId("opAtuePerson").onchange=sync;return s}
function collectOperationData(){const list=id=>operationValue(id).split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean);return{id:currentOperationId,date:operationValue("opDate")||today(),number:operationValue("opNumber"),type:operationValue("opType"),location:operationValue("opLocation"),leader:operationValue("opLeader"),zvd:operationValue("opZvd"),times:{alarm:operationValue("opAlarm"),departed:operationValue("opDeparted"),arrived:operationValue("opArrived"),ended:operationValue("opEnded"),returned:operationValue("opReturned")},assignments:{...operationAssignments},assignmentRoles:{...operationAssignmentRoles},situation:operationValue("opSituation"),actions:operationValue("opActions"),special:operationValue("opSpecial"),atueUsed:Boolean(byId("opAtueUsed")?.checked),atueDepartment:Boolean(byId("opAtueDepartment")?.checked),atuePerson:operationValue("opAtuePerson"),members:operationNames(),devices:checkedValues("opDevices"),deviceAmounts:{},pipes:{description:operationValue("opPipes")},waterSources:list("opWaterSources"),oil:{description:operationValue("opOil")},agencies:checkedValues("opAgencies"),alarmMethods:list("opAlarmMethods")}}
function validateOperation(d){d=d||collectOperationData();const errors=[...validateOperationAssignments()];if(!d.members?.length)errors.push("Mindestens eine anwesende Einsatzkraft ist erforderlich.");if(!d.type)errors.push("Einsatzart fehlt.");if(!d.location)errors.push("Einsatzstelle fehlt.");if(!d.times?.alarm)errors.push("Alarmzeit fehlt.");if(!d.situation)errors.push("Lage beim Eintreffen fehlt.");if(!d.actions)errors.push("Verlauf der Tätigkeit fehlt.");if(d.atueUsed&&!d.atueDepartment&&!d.atuePerson)errors.push("Bei Atemschutzüberwachung muss eine ATÜ-Person ausgewählt werden.");return{errors,warnings:[]}}
function populateOperationForm(d){if(!d)return;const set=(id,v)=>{const el=byId(id);if(el)el.value=v||""};set("opDate",d.date||today());set("opNumber",d.number);set("opType",d.type);set("opLocation",d.location);set("opLeader",d.leader);set("opZvd",d.zvd);set("opAlarm",d.times?.alarm);set("opDeparted",d.times?.departed);set("opArrived",d.times?.arrived);set("opEnded",d.times?.ended);set("opReturned",d.times?.returned);set("opSituation",d.situation);set("opActions",d.actions);set("opSpecial",d.special);set("opAtuePerson",d.atuePerson);set("opWaterSources",(d.waterSources||[]).join(", "));set("opPipes",d.pipes?.description||"");set("opOil",d.oil?.description||"");set("opAlarmMethods",(d.alarmMethods||[]).join(", "));if(byId("opAtueUsed"))byId("opAtueUsed").checked=Boolean(d.atueUsed);if(byId("opAtueDepartment"))byId("opAtueDepartment").checked=Boolean(d.atueDepartment);document.querySelectorAll('#operationReportForm input[name="opDevices"],#operationReportForm input[name="opAgencies"]').forEach(input=>{const values=input.name==="opDevices"?(d.devices||[]):(d.agencies||[]);input.checked=values.includes(input.value);});}
function openOperationReportForm(){
  const assignmentStep=byId("operationAssignmentStep");
  if(assignmentStep)assignmentStep.hidden=true;
  const form=ensureOperationForm();
  form.hidden=false;
  const personSelect=byId("opAtuePerson");
  personSelect.innerHTML='<option value="">Bitte auswählen</option>'+members.filter(member=>!member.ageDepartment&&member.atueQualified).map(member=>`<option>${escapeHtml(nameForTile(member))}</option>`).join("");
  populateOperationForm(currentOperationDraft||{date:today()});
  requestAnimationFrame(function(){form.scrollIntoView({behavior:"smooth",block:"start"});});
}
function operationMemberForName(name){return members.find(member=>nameForStorage(member)===name||nameForTile(member)===name||operationProtocolName(nameForStorage(member))===operationProtocolName(name))||null}
function operationRolesForName(name,group){
  if(String(group||"").startsWith("Reserve"))return ["Reserve"];
  const member=operationMemberForName(name),roles=member?[...new Set(getMemberRoles(member).filter(Boolean))]:[];
  const vehicles=Array.isArray(member?.machinistVehicles)?member.machinistVehicles:[];
  const machinistAllowed=group==="EM 5/42 LF10"?vehicles.includes("LF"):group==="EM 5/47 TSF"?(vehicles.includes("TSF")||vehicles.includes("LF")):vehicles.length>0;
  if(machinistAllowed&&!roles.includes("Maschinist"))roles.push("Maschinist");
  if(!machinistAllowed){const index=roles.indexOf("Maschinist");if(index>=0)roles.splice(index,1);}
  return OP_ROLE_ORDER.filter(role=>roles.includes(role));
}
function operationVehicleGroups(){return ["EM 5/42 LF10","EM 5/47 TSF"]}
function operationRoleOwner(group,role,exceptName=""){return operationNames().find(name=>name!==exceptName&&operationAssignments[name]===group&&operationAssignmentRoles[name]===role)||""}
function validateOperationAssignments(){
  const names=operationNames(),errors=[];
  for(const name of names){
    const group=operationAssignments[name],role=operationAssignmentRoles[name];
    if(!group||!role){errors.push(`${operationProtocolName(name)} ist nicht vollständig zugeordnet.`);continue;}
    if(operationVehicleGroups().includes(group)){
      if(!operationRolesForName(name,group).includes(role))errors.push(`${operationProtocolName(name)} ist für ${role} auf ${group} nicht freigegeben.`);
      const owner=operationRoleOwner(group,role,name);if(owner)errors.push(`${role} ist auf ${group} doppelt besetzt.`);
    }
  }
  for(const group of operationVehicleGroups()){
    const assigned=names.filter(name=>operationAssignments[name]===group);
    if(!assigned.length)continue;
    if(!assigned.some(name=>operationAssignmentRoles[name]==="GF"))errors.push(`${group}: Ein Gruppenführer mit Funktion GF fehlt.`);
    if(!assigned.some(name=>operationAssignmentRoles[name]==="Maschinist"))errors.push(`${group}: Ein geeigneter Maschinist fehlt.`);
  }
  return [...new Set(errors)];
}
function autoAssignOperationCrew(){
  const names=operationNames();operationAssignments={};operationAssignmentRoles={};
  const remaining=[...names];
  const take=(group,role,predicate=()=>true)=>{const index=remaining.findIndex(name=>predicate(operationMemberForName(name))&&operationRolesForName(name,group).includes(role)&&!operationRoleOwner(group,role,name));if(index<0)return false;const name=remaining.splice(index,1)[0];operationAssignments[name]=group;operationAssignmentRoles[name]=role;return true;};
  const fillVehicle=(group,capacity)=>{
    take(group,"GF",member=>getMemberRoles(member).includes("GF"));
    take(group,"Maschinist",member=>operationRolesForName(nameForStorage(member),group).includes("Maschinist"));
    for(const role of OP_ROLE_ORDER.filter(value=>value!=="GF"&&value!=="Maschinist")){if(Object.values(operationAssignments).filter(value=>value===group).length>=capacity)break;take(group,role);}
  };
  fillVehicle("EM 5/42 LF10",OP_VEHICLE_CAPACITY["EM 5/42 LF10"]);
  if(remaining.length>=2)fillVehicle("EM 5/47 TSF",OP_VEHICLE_CAPACITY["EM 5/47 TSF"]);
  remaining.forEach(name=>{operationAssignments[name]="Reserve Einsatzstelle";operationAssignmentRoles[name]="Reserve";});
  renderOperationAssignmentStep();
  const errors=validateOperationAssignments();showToast(errors.length?"Vorschlag erstellt. Bitte die rot markierten Hinweise prüfen.":"Plausibler Besetzungsvorschlag wurde erstellt.",errors.length?"error":"success");
}
function operationVehicleOverview(group,title,image){
  const names=operationNames().filter(name=>operationAssignments[name]===group),roles=new Map(names.map(name=>[operationAssignmentRoles[name],name])),hasGf=roles.has("GF"),hasMa=roles.has("Maschinist"),capacity=OP_VEHICLE_CAPACITY[group]||0;
  return `<article class="operation-vehicle-board ${hasGf&&hasMa?"is-ready":"needs-crew"}"><div class="operation-vehicle-image"><img src="${image}" alt="${escapeHtml(title)}"><span>${names.length} / ${capacity}</span></div><header><div><small>${escapeHtml(group)}</small><h3>${escapeHtml(title)}</h3></div><div class="operation-readiness"><i class="${hasGf?"ok":"missing"}">GF</i><i class="${hasMa?"ok":"missing"}">MA</i></div></header><div class="operation-crew-pills">${names.length?names.sort((a,b)=>operationRoleRank(operationAssignmentRoles[a])-operationRoleRank(operationAssignmentRoles[b])).map(name=>`<span><b>${escapeHtml(operationAssignmentRoles[name])}</b>${escapeHtml(operationProtocolName(name))}</span>`).join(""):'<p>Noch keine Einsatzkraft zugeordnet.</p>'}</div></article>`;
}
function operationReserveOverview(){const names=operationNames().filter(name=>String(operationAssignments[name]||"").startsWith("Reserve"));return `<article class="operation-reserve-board"><header><div><small>Weitere Kräfte</small><h3>Reserve</h3></div><strong>${names.length}</strong></header><div>${names.length?names.map(name=>`<span>${escapeHtml(operationProtocolName(name))}<small>${escapeHtml(operationAssignments[name])}</small></span>`).join(""):'<p>Noch keine Reserve zugeordnet.</p>'}</div></article>`;}
function ensureOperationAssignmentStep(){
  let section=byId("operationAssignmentStep");
  if(section)return section;
  section=document.createElement("section");section.id="operationAssignmentStep";section.className="panel operation-assignment-step";
  section.innerHTML='<div class="flow-stage-heading"><span>3</span><div><strong>Einsatzkräfte und Funktionen zuordnen</strong><small>Fahrzeuge visuell besetzen, Funktionen prüfen und Reserve festlegen.</small></div><button type="button" class="outline-button operation-auto-assign">Smart-Vorschlag erstellen</button></div><div class="operation-vehicle-overview"></div><div class="operation-assignment-subheading"><div><small>Mannschaft</small><h3>Personen zuordnen</h3></div><span>Änderungen werden oben sofort sichtbar.</span></div><div class="operation-assignment-members"></div><div class="operation-assignment-footer"><span></span><button type="button" class="primary-button">Weiter zum Einsatzbericht</button></div>';
  byId("attendanceView").appendChild(section);
  section.querySelector(".operation-assignment-members").addEventListener("change",event=>{
    const select=event.target.closest("select[data-assignment-name]");if(!select)return;
    const name=select.dataset.assignmentName;
    if(select.dataset.assignmentField==="group"){
      operationAssignments[name]=select.value;
      const allowed=operationRolesForName(name,select.value);
      if(!allowed.includes(operationAssignmentRoles[name]))operationAssignmentRoles[name]=allowed.length===1?allowed[0]:"";
    }else if(select.dataset.assignmentField==="role"){
      const group=operationAssignments[name],role=select.value,owner=operationRoleOwner(group,role,name);
      if(role&&operationVehicleGroups().includes(group)&&owner){
        operationAssignmentRoles[name]="";
        showToast(`${role} ist auf ${group} bereits durch ${operationProtocolName(owner)} besetzt.`,"error");
      }else operationAssignmentRoles[name]=role;
    }
    renderOperationAssignmentStep();
  });
  section.querySelector(".operation-auto-assign").onclick=autoAssignOperationCrew;
  section.querySelector(".operation-assignment-footer button").onclick=openOperationReportForm;
  return section;
}
function renderOperationAssignmentStep(){
  const section=ensureOperationAssignmentStep(),names=operationNames(),groups=["EM 5/42 LF10","EM 5/47 TSF","Reserve Einsatzstelle","Reserve Gerätehaus"];
  section.querySelector(".operation-vehicle-overview").innerHTML=operationVehicleOverview("EM 5/42 LF10","LF10","taktik-lf10.png")+operationVehicleOverview("EM 5/47 TSF","TSF","taktik-tsf.png")+operationReserveOverview();
  section.querySelector(".operation-assignment-members").innerHTML=names.map(name=>{
    const group=operationAssignments[name]||"",allRoles=operationRolesForName(name,group),role=operationAssignmentRoles[name]||"",roles=allRoles.filter(value=>value===role||!operationRoleOwner(group,value,name));
    const groupOptions=['<option value="">Fahrzeug / Reserve wählen</option>',...groups.map(value=>`<option value="${escapeHtml(value)}" ${group===value?"selected":""}>${escapeHtml(value)}</option>`)].join("");
    const roleOptions=['<option value="">Funktion wählen</option>',...roles.map(value=>`<option value="${escapeHtml(value)}" ${role===value?"selected":""}>${escapeHtml(value)}</option>`)].join("");
    return `<article class="operation-assignment-card"><strong>${escapeHtml(operationProtocolName(name))}</strong><label><span>Fahrzeug / Reserve</span><select data-assignment-name="${escapeHtml(name)}" data-assignment-field="group">${groupOptions}</select></label><label><span>Funktion</span><select data-assignment-name="${escapeHtml(name)}" data-assignment-field="role" ${group?"":"disabled"}>${roleOptions}</select></label></article>`;
  }).join("");
  const complete=names.filter(name=>operationAssignments[name]&&operationAssignmentRoles[name]).length,errors=validateOperationAssignments();
  const footer=section.querySelector(".operation-assignment-footer"),status=footer.querySelector("span");
  status.innerHTML=`<strong>${complete} von ${names.length} vollständig zugeordnet</strong>${errors.length?`<small>${escapeHtml(errors[0])}${errors.length>1?` · ${errors.length-1} weiterer Hinweis${errors.length===2?"":"e"}`:""}</small>`:"<small>Besetzung ist gültig.</small>"}`;
  footer.classList.toggle("has-errors",errors.length>0);
  footer.querySelector("button").disabled=!names.length||errors.length>0;
}

function showOperationForm(){const f=byId("operationReportForm");if(f)f.hidden=true;const s=ensureOperationAssignmentStep();s.hidden=false;renderOperationAssignmentStep()}
function operationPdfEscape(v){return pdfEscape(pdfLatin1(String(v||"")))}function opPdfBytes(v){const t=String(v??""),b=new Uint8Array(t.length);for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i)&255;return b}function opConcatBytes(p){const l=p.reduce((s,x)=>s+x.length,0),r=new Uint8Array(l);let o=0;for(const x of p){r.set(x,o);o+=x.length}return r}
async function operationPdfBlob(d){d=d||collectOperationData();const rows=(d.members||[]).map(n=>({time:d.times?.alarm||"",name:operationProtocolName(n),status:"Anwesend",role:d.assignmentRoles?.[n]||d.assignments?.[n]||""}));return probePdfBlob(rows,"Einsatz",{present:rows.length,excused:0,missing:0,notApplicable:0},`${d.type||"Einsatz"} · ${d.location||""}`,d.date||today())}
async function showOperationPdfPreview(b,n,f){return Boolean(await f())}function operationCsv(d){d=d||collectOperationData();const h=["Datum","Alarmzeit","Ausgerückt","Einsatzstelle erreicht","Einsatzende","Eingerückt","Einsatznummer","Einsatzart","Einsatzstelle","Einsatzleiter","ZvD","Name","Fahrzeug / Reserve","Funktion","Lage beim Eintreffen","Verlauf der Tätigkeit","Besondere Vorkommnisse","Geräte","Wasserentnahmestellen","Schlauchmaterial","Ölbindemittel / Betriebsstoffe","Weitere Stellen","Alarmierungswege","Atemschutzüberwachung","ATÜ durch Abteilung Emmendingen","ATÜ-Person"];const common=[d.date,d.times?.alarm||"",d.times?.departed||"",d.times?.arrived||"",d.times?.ended||"",d.times?.returned||"",d.number||"",d.type||"",d.location||"",d.leader||"",d.zvd||""];const details=[d.situation||"",d.actions||"",d.special||"",(d.devices||[]).join(", "),(d.waterSources||[]).join(", "),d.pipes?.description||"",d.oil?.description||"",(d.agencies||[]).join(", "),(d.alarmMethods||[]).join(", "),d.atueUsed?"Ja":"Nein",d.atueDepartment?"Ja":"Nein",d.atuePerson||""];const rows=(d.members||[]).map(n=>[...common,operationProtocolName(n),d.assignments?.[n]||"",d.assignmentRoles?.[n]||"",...details]);return '\ufeff'+[h,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n')}
async function finishOperation(){return window.finishOperationZip?.()}function resetOperationState(){safeStorage.setItem("fw_v1_current_operation_id","");currentOperationId="";currentOperationDraft=null;editingOperationArchiveId="";byId("operationReportForm")?.remove();byId("operationAssignmentStep")?.remove()}
function operationStatisticsData(y){return csvArchive.filter(i=>i.sessionType==="Einsatz"&&String(i.operationData?.date||i.createdAt).startsWith(y))}function renderOperationStatistics(){}function ensureOperationStatisticsPanel(){}function editArchivedOperation(id){const item=csvArchive.find(entry=>entry.id===id);if(!item?.operationData)return showToast("Für diesen Einsatz fehlen strukturierte Korrekturdaten.","error");const d=structuredClone?structuredClone(item.operationData):JSON.parse(JSON.stringify(item.operationData));editingOperationArchiveId=item.id;currentOperationId=d.id||`op-edit-${Date.now()}`;safeStorage.setItem("fw_v1_current_operation_id",currentOperationId);currentOperationDraft=d;operationAssignments={...(d.assignments||{})};operationAssignmentRoles={...(d.assignmentRoles||{})};entries=entries.filter(e=>e.operationId!==currentOperationId);(d.members||[]).forEach((name,index)=>entries.push({id:`edit-${currentOperationId}-${index}`,date:d.date||today(),time:d.times?.alarm||"",storedName:name,displayName:operationProtocolName(name),status:"Anwesend",role:d.assignmentRoles?.[name]||"",sessionType:"Einsatz",operationId:currentOperationId}));saveEntries();sessionType="Einsatz";setHomeFlowStage(3);showView("attendanceView");showOperationForm();showToast("Einsatz wurde zur Korrektur geladen.");}
