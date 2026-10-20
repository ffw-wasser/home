"use strict";
let currentOperationId=safeStorage.getItem("fw_v1_current_operation_id")||"";
let currentOperationDraft=null,editingOperationArchiveId="",operationAssignmentGroup="EM 5/42 LF10",operationAssignments={},operationAssignmentRoles={};
const OP_REPORT_VEHICLES=["EM 5/42 LF10","EM 5/47 TSF"],OP_VEHICLES=["EM 5/47 TSF","EM 5/42 LF10"],OP_VEHICLE_CAPACITY=Object.freeze({"EM 5/47 TSF":7,"EM 5/42 LF10":9});
const OP_DEVICES=["Wärmebildkamera","Pressluftatmer","Kettensäge","Sprungpolster","Belüftungsgerät","Stromerzeuger","Tauchpumpe","Wassersauger","Rettungsschere","Rettungsspreizer","Rettungszylinder","Türöffnungswerkzeug"];
const OP_ROLE_ORDER=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM","STF","STM","Melder"]),OP_AGENCIES=["Polizei","Streifendienst","KDD","Kripo","Bundespolizei","Rettungsdienst","RTW","NEF","KTW","RTH","DRK Ortsverein","KBM","Stadt Emmendingen","Stadtwerke","Netze BW","Badenova","THW","DLRG","Abschleppdienst","Straßen-/Autobahnmeisterei","DB-Notfallmanager","Bestatter","Weitere Feuerwehren"];
// Gerätehausbesetzung uses the existing Gerätehaus time/report grouping.
function operationStationOnly(){return Boolean(restoreOperationDraft()?.stationOnly);}
function assignOperationStationCrew(){
  operationAssignments={};operationAssignmentRoles={};
  operationNames().forEach(name=>{operationAssignments[name]='Reserve Gerätehaus';operationAssignmentRoles[name]='Gerätehausbesetzung';});
}
function setOperationStationOnly(enabled){
  const draft={...(restoreOperationDraft()||{}),stationOnly:Boolean(enabled)};
  if(enabled){
    assignOperationStationCrew();draft.reportVehicles=[];
    if(!draft.type)draft.type='Gerätehausbesetzung';
    if(!draft.location)draft.location='Gerätehaus Wasser';
  }else{
    operationAssignments={};operationAssignmentRoles={};
    if(draft.type==='Gerätehausbesetzung')draft.type='';
    if(draft.location==='Gerätehaus Wasser')draft.location='';
  }
  draft.assignments={...operationAssignments};draft.assignmentRoles={...operationAssignmentRoles};
  persistOperationDraft(draft);renderOperationAssignmentStep();
}
function operationRoleRank(r){const i=OP_ROLE_ORDER.indexOf(String(r||""));return i<0?99:i}function operationSortNames(n,r){return[...n].sort((a,b)=>operationRoleRank(r?.[a])-operationRoleRank(r?.[b])||operationProtocolName(a).localeCompare(operationProtocolName(b),"de"))}
window.__ffwFinishOperation=async e=>{e?.preventDefault?.();e?.stopPropagation?.();try{if(typeof window.finishOperationZip!=="function")throw Error("Einsatzabschluss-Modul ist nicht geladen");await window.finishOperationZip()}catch(x){console.error(x);showToast?.(`Einsatz konnte nicht abgeschlossen werden: ${x?.message||"unbekannter Fehler"}`,"error")}return false};
function operationSessionKey(){return currentOperationId||""}
function operationDraftStorageKey(){return currentOperationId?`fw_v1_operation_draft_${currentOperationId}`:""}
function persistOperationDraft(data){if(!data||typeof data!=="object")return;currentOperationDraft=data;const key=operationDraftStorageKey();if(key)try{safeStorage.setItem(key,JSON.stringify(data));}catch(error){console.warn("Einsatzbericht konnte nicht lokal gesichert werden",error);}}
function restoreOperationDraft(){if(currentOperationDraft)return currentOperationDraft;const key=operationDraftStorageKey(),raw=key?safeStorage.getItem(key):"";if(!raw)return null;try{currentOperationDraft=JSON.parse(raw);return currentOperationDraft;}catch(error){console.warn("Gesicherter Einsatzbericht konnte nicht gelesen werden",error);return null;}}function startOperationSession(){if(currentOperationId&&entries.some(e=>e.operationId===currentOperationId))return;operationAssignments={};operationAssignmentRoles={};currentOperationId=`op-${today()}-${Date.now()}-${Math.random().toString(16).slice(2)}`;safeStorage.setItem("fw_v1_current_operation_id",currentOperationId);currentOperationDraft=null}function operationEntries(){return entries.filter(e=>e.operationId===currentOperationId)}function operationNames(){return operationEntries().filter(e=>e.status==="Anwesend").map(e=>e.storedName||e.displayName)}function operationProtocolName(v){const n=String(v||"").trim();if(!n.includes(","))return n;const[l,...f]=n.split(",");return[f.join(",").trim(),l.trim()].filter(Boolean).join(" ")}
function operationValue(id){return String(byId(id)?.value||"").trim()}function checkedValues(name){return[...document.querySelectorAll(`#operationReportForm input[name="${name}"]:checked`)].map(x=>x.value)}
function ensureOperationForm(){let s=byId("operationReportForm");if(s)return s;s=document.createElement("section");s.id="operationReportForm";s.className="panel operation-report-form";s.hidden=true;const checks=(a,n)=>a.map(v=>`<label class="operation-check"><input type="checkbox" name="${n}" value="${escapeHtml(v)}"><span>${escapeHtml(v)}</span></label>`).join("");const deviceInputs=OP_DEVICES.map(v=>`<label class="operation-device-amount"><span>${escapeHtml(v)}</span><input type="number" name="opDeviceAmount" data-device="${escapeHtml(v)}" min="0" max="99" step="1" inputmode="numeric" placeholder="0" aria-label="Stückzahl ${escapeHtml(v)}"></label>`).join("");s.innerHTML=`<div class="flow-stage-heading"><span>4</span><div><strong>Einsatzbericht erfassen</strong><small>Bekannte Berichtsdaten eintragen. Fehlende Angaben können später ergänzt werden. Die Zuordnung der Einsatzkräfte muss gültig sein.</small></div></div><div class="operation-draft-hint"><strong>Praxisnah erfassen</strong><span>Am Einsatztag nur bekannte Informationen eintragen. Fehlende Zeiten und Berichtsteile später im Archiv ergänzen.</span></div><datalist id="opTypeSuggestions"><option value="Brandeinsatz"><option value="Technische Hilfeleistung"><option value="Unwettereinsatz"><option value="Wasserschaden"><option value="Brandmeldeanlage"><option value="Stromausfall"><option value="Sonstiger Einsatz"></datalist><div class="operation-grid"><label>Einsatzdatum<input id="opDate" type="date"></label><label>Einsatznummer<input id="opNumber"></label><label>Einsatzart<input id="opType" list="opTypeSuggestions" placeholder="z. B. Brand, Hilfeleistung, Unwetter"></label><label class="operation-check"><input id="opPowerOutage" type="checkbox"><span>Stromausfall</span></label><label>Einsatzstelle<input id="opLocation" placeholder="Ort oder Straßenabschnitt"></label><label>Einsatzleiter<input id="opLeader"></label><label>ZvD<input id="opZvd"></label><label>Verursacher / Geschädigte<input id="opAffected"></label><label>Anschrift<input id="opAffectedAddress"></label></div><fieldset><legend>Eingesetzte Fahrzeuge</legend><p class="operation-time-order">Für jedes beteiligte Fahrzeug ein Kreuz setzen.</p><div class="operation-check-grid">${checks(OP_REPORT_VEHICLES,"opReportVehicles")}</div></fieldset><fieldset><legend>Zeiten</legend><p class="operation-time-order">Reihenfolge: Alarm → Ausgerückt → Einsatzstelle → Einsatzende → Eingerückt. Ein Tageswechsel wird automatisch berücksichtigt.</p><div class="operation-grid"><label>Alarm<input id="opAlarm" type="time"></label><label>Ausgerückt<input id="opDeparted" type="time"></label><label>An Einsatzstelle<input id="opArrived" type="time"></label><label>Einsatzende<input id="opEnded" type="time"></label><label>Eingerückt<input id="opReturned" type="time"></label></div></fieldset><fieldset><legend>Bericht</legend><label>Lage beim Eintreffen<textarea id="opSituation" placeholder="Kurze sachliche Beschreibung, kann später ergänzt werden"></textarea></label><label>Verlauf der Tätigkeit<textarea id="opActions" placeholder="Maßnahmen stichpunktartig oder als Freitext"></textarea></label><label>Personalangaben / Menschenrettung / Verletzungen<textarea id="opPersons"></textarea></label><label>Besondere Vorkommnisse<textarea id="opSpecial"></textarea></label></fieldset><fieldset><legend>Einsatzmittel und Zusammenarbeit</legend><div class="operation-resource-grid"><section><h4>Eingesetzte Geräte</h4><p class="help-text">Stückzahl eintragen. Nicht eingesetzte Geräte bleiben bei 0.</p><div class="operation-device-grid">${deviceInputs}</div><label>Sonstige Geräte / Hinweise<input id="opDeviceOther" placeholder="z. B. Schnellangriff"></label></section><section><h4>Weitere Stellen</h4><div class="operation-check-grid">${checks(OP_AGENCIES,"opAgencies")}</div></section></div><div class="operation-grid"><label>Wasserentnahmestellen<input id="opWaterSources" placeholder="z. B. Hydrant, offenes Gewässer"></label><label>Schlauchmaterial<input id="opPipes" placeholder="z. B. 8 B, 6 C"></label><label>Ölbindemittel / Betriebsstoffe<input id="opOil" placeholder="Art und Menge"></label><label>Alarmierungswege<input id="opAlarmMethods" placeholder="z. B. Melder, Sirene"></label></div></fieldset><div id="operationValidation" hidden></div><div class="operation-actions"><button class="outline-button" id="operationBack" type="button">Zurück</button><button class="primary-button" id="operationFinish" type="button" onclick="return window.__ffwFinishOperation(event)">Einsatz abschließen · Terminpaket</button></div>`;byId("attendanceView").appendChild(s);byId("operationBack").onclick=()=>showOperationForm();return s}
function operationReserveDuration(value){
  const from=Date.parse(value?.from||''),to=Date.parse(value?.to||'');
  return Number.isFinite(from)&&Number.isFinite(to)&&to>from?Math.round((to-from)/60000):null;
}
function operationEffectiveReserveTime(d,name){
  const value=d.reserveTimes?.[name]||{},date=String(d.date||''),stamps={};
  let offset=0,previous=null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(date))for(const key of ['alarm','departed','arrived','ended']){
    const time=d.times?.[key]||'';if(!/^\d{2}:\d{2}$/.test(time))continue;
    if(previous!==null&&time<previous)offset++;
    const day=new Date(date+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+offset);
    stamps[key]=day.toISOString().slice(0,10)+'T'+time;previous=time;
  }
  return {from:value.from||stamps.arrived||'',to:value.to||stamps.ended||''};
}
function operationReportType(d){return d.powerOutage&&!/stromausfall/i.test(d.type||'')?[d.type,'Stromausfall'].filter(Boolean).join(' · '):d.type||'';}
function populateOperationReserveTimes(d){
  let section=byId('opReserveTimes');if(!section){section=document.createElement('fieldset');section.id='opReserveTimes';byId('operationReportForm').querySelector('.operation-actions').before(section);}
  const names=operationNames().filter(name=>operationAssignments[name]==='Reserve Gerätehaus');section.hidden=!names.length;
  section.innerHTML='<legend>Reserve Gerätehaus · Zeiten je Person</legend><p>Leer lassen: Die Einsatzzeit oben (An Einsatzstelle bis Einsatzende) gilt für die Person. Nur abweichende Zeiten hier eintragen.</p>'+names.map((name,index)=>{const value=d.reserveTimes?.[name]||{};return '<div class="operation-reserve-time" data-reserve-name="'+escapeHtml(name)+'"><strong>'+escapeHtml(operationProtocolName(name))+'</strong><label for="reserve-from-'+index+'">Beginn<input id="reserve-from-'+index+'" data-reserve-from type="datetime-local" value="'+escapeHtml(value.from||'')+'"></label><label for="reserve-to-'+index+'">Ende<input id="reserve-to-'+index+'" data-reserve-to type="datetime-local" value="'+escapeHtml(value.to||'')+'"></label></div>';}).join('');
}
function collectOperationData(){const list=id=>operationValue(id).split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean),amount=id=>Math.max(0,Number.parseInt(operationValue(id),10)||0);const deviceAmounts={};document.querySelectorAll('#operationReportForm input[name="opDeviceAmount"]').forEach(input=>{const value=Math.max(0,Number.parseInt(input.value,10)||0);if(value)deviceAmounts[input.dataset.device]=value;});const reserveTimes={};document.querySelectorAll("#opReserveTimes [data-reserve-name]").forEach(row=>{if(operationAssignments[row.dataset.reserveName]==='Reserve Gerätehaus')reserveTimes[row.dataset.reserveName]={from:row.querySelector("[data-reserve-from]").value,to:row.querySelector("[data-reserve-to]").value};});const devices=Object.keys(deviceAmounts);return{powerOutage:Boolean(byId("opPowerOutage")?.checked),stationOnly:operationStationOnly(),reserveTimes,id:currentOperationId,date:operationValue("opDate")||today(),number:operationValue("opNumber"),type:operationValue("opType"),location:operationValue("opLocation"),leader:operationValue("opLeader"),zvd:operationValue("opZvd"),affected:operationValue("opAffected"),affectedAddress:operationValue("opAffectedAddress"),times:{alarm:operationValue("opAlarm"),departed:operationValue("opDeparted"),arrived:operationValue("opArrived"),ended:operationValue("opEnded"),returned:operationValue("opReturned")},reportVehicles:operationStationOnly()?[]:[...new Set([...checkedValues("opReportVehicles"),...Object.values(operationAssignments||{}).map(v=>v==="EM 5/23 TLF"?"EM 5/42 LF10":v).filter(v=>OP_REPORT_VEHICLES.includes(v))])],assignments:{...operationAssignments},assignmentRoles:{...operationAssignmentRoles},situation:operationValue("opSituation"),actions:operationValue("opActions"),persons:operationValue("opPersons"),special:operationValue("opSpecial"),members:operationNames(),devices,deviceAmounts,deviceOther:operationValue("opDeviceOther"),pipes:{c:amount("opPipeC"),b:amount("opPipeB"),monitor:amount("opPipeMonitor"),smallExtinguishers:amount("opSmallExt"),description:operationValue("opPipes")},waterSources:list("opWaterSources"),oil:{description:operationValue("opOil")},agencies:checkedValues("opAgencies"),alarmMethods:list("opAlarmMethods")}}
function validateOperation(d){d=d||collectOperationData();const warnings=[],errors=validateOperationAssignments();if(d.stationOnly){if((d.reportVehicles||[]).length)errors.push("Bei Gerätehausbesetzung dürfen keine Fahrzeuge eingesetzt werden.");for(const name of d.members||[])if(d.assignments?.[name]!=="Reserve Gerätehaus")errors.push(operationProtocolName(name)+": Bitte dem Gerätehaus zuordnen.");}for(const name of d.members||[]){if(d.assignments?.[name]==='Reserve Gerätehaus'&&operationReserveDuration(operationEffectiveReserveTime(d,name))===null)errors.push(operationProtocolName(name)+': Bitte oben die Einsatzzeit oder eigene Zeiten mit einem späteren Ende eintragen.');}if(!d.date)errors.push("Einsatzdatum fehlt.");if(!d.members?.length)errors.push("Keine Einsatzkräfte zugeordnet.");if(!d.members?.length)warnings.push("Noch keine Einsatzkräfte zugeordnet.");if(!d.type)warnings.push("Einsatzart kann später ergänzt werden.");if(!d.location)warnings.push("Einsatzstelle kann später ergänzt werden.");if(!d.times?.alarm)warnings.push("Alarmzeit ist noch offen.");if(!d.situation)warnings.push("Lage beim Eintreffen ist noch offen.");if(!d.actions)warnings.push("Verlauf der Tätigkeit ist noch offen.");const sequence=[["alarm","Alarm"],["departed","Ausgerückt"],["arrived","Einsatzstelle"],["ended","Einsatzende"],["returned","Eingerückt"]],minutes=value=>{const m=String(value||"").match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;};let previous=null;sequence.forEach(([key,label])=>{let current=minutes(d.times?.[key]);if(current===null)return;if(previous!==null){while(current<previous)current+=1440;const gap=current-previous;if(gap>720)warnings.push(`Der Abstand vor „${label}“ beträgt mehr als 12 Stunden. Uhrzeit oder Tageswechsel bitte prüfen.`);}previous=current;});if(!d.stationOnly&&!d.times?.returned)warnings.push("Einrückzeit ist noch offen und kann nachgetragen werden.");return{errors:[...new Set(errors)],warnings:[...new Set(warnings)]}}

function populateOperationForm(d){if(!d)return;populateOperationReserveTimes(d);
  const stationOnly=Boolean(d.stationOnly);
  byId('opPowerOutage').checked=Boolean(d.powerOutage)||/stromausfall/i.test(d.type||'');
  byId('opAlarm').parentElement.firstChild.textContent='Alarm';
  document.querySelectorAll('input[name="opReportVehicles"]').forEach(input=>{input.disabled=stationOnly;input.closest('fieldset').hidden=stationOnly;});
  ['opAlarm','opDeparted','opArrived','opEnded','opReturned'].forEach(id=>{const input=byId(id);if(input){input.disabled=false;input.closest('label').hidden=false;}});
  byId('opAlarm').closest('fieldset').querySelector('.operation-time-order').textContent=stationOnly?'Für die Gerätehausbesetzung gilt An Einsatzstelle bis Einsatzende. Abweichende Zeiten können unten je Person eingetragen werden.':'Reihenfolge: Alarm → Ausgerückt → Einsatzstelle → Einsatzende → Eingerückt. Ein Tageswechsel wird automatisch berücksichtigt.';
  byId('opReserveTimes').querySelector('legend').textContent=stationOnly?'Gerätehausbesetzung · Zeiten je Person':'Reserve Gerätehaus · Zeiten je Person';
  const set=(id,v)=>{const el=byId(id);if(el)el.value=v||""};set("opDate",d.date||today());set("opNumber",d.number);set("opType",d.stationOnly&&d.type==="Gerätehausbesetzung · Stromausfall"?"Gerätehausbesetzung":d.type);set("opLocation",d.location);set("opLeader",d.leader);set("opZvd",d.zvd);set("opAffected",d.affected);set("opAffectedAddress",d.affectedAddress);set("opAlarm",d.times?.alarm);set("opDeparted",d.times?.departed);set("opArrived",d.times?.arrived);set("opEnded",d.times?.ended);set("opReturned",d.times?.returned);set("opSituation",d.situation);set("opActions",d.actions);set("opPersons",d.persons);set("opSpecial",d.special);document.querySelectorAll('input[name="opReportVehicles"]').forEach(input=>input.checked=(d.reportVehicles||[]).includes(input.value)||Object.values(operationAssignments).includes(input.value));set("opWaterSources",(d.waterSources||[]).join(", "));set("opPipeC",d.pipes?.c||"");set("opPipeB",d.pipes?.b||"");set("opPipeMonitor",d.pipes?.monitor||"");set("opSmallExt",d.pipes?.smallExtinguishers||"");set("opPipes",d.pipes?.description||"");set("opDeviceOther",d.deviceOther||"");set("opOil",d.oil?.description||"");set("opAlarmMethods",(d.alarmMethods||[]).join(", "));document.querySelectorAll('#operationReportForm input[name="opAgencies"]').forEach(input=>{input.checked=(d.agencies||[]).includes(input.value);});document.querySelectorAll('#operationReportForm input[name="opDeviceAmount"]').forEach(input=>{input.value=d.deviceAmounts?.[input.dataset.device]||((d.devices||[]).includes(input.dataset.device)?1:"");});}
function openOperationReportForm(){
  const assignmentStep=byId("operationAssignmentStep");
  if(assignmentStep){assignmentStep.hidden=true;assignmentStep.style.display="none";assignmentStep.setAttribute("aria-hidden","true");}
  const form=ensureOperationForm();
  form.hidden=false;form.style.display="block";form.removeAttribute("aria-hidden");
  window.SmartWorkflow?.operationForm?.();
  populateOperationForm(restoreOperationDraft()||{date:today()});
  syncHomeFlowProgress?.(4);
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
    const capacity=OP_VEHICLE_CAPACITY[group]||0;
    if(capacity&&assigned.length>capacity)errors.push(`${group}: ${assigned.length} Personen überschreiten die Kapazität von ${capacity}.`);
    if(!assigned.some(name=>operationAssignmentRoles[name]==="GF"))errors.push(`${group}: Ein Gruppenführer mit Funktion GF fehlt.`);
    if(!assigned.some(name=>operationAssignmentRoles[name]==="Maschinist"))errors.push(`${group}: Ein geeigneter Maschinist fehlt.`);
  }
  return [...new Set(errors)];
}
function autoAssignOperationCrew(){
  if(operationStationOnly()){assignOperationStationCrew();renderOperationAssignmentStep();return;}
  const names=operationNames();operationAssignments={};operationAssignmentRoles={};
  const remaining=[...names];
  const take=(group,role,predicate=()=>true)=>{const capacity=OP_VEHICLE_CAPACITY[group]||0,occupied=Object.values(operationAssignments).filter(value=>value===group).length;if(capacity&&occupied>=capacity)return false;const index=remaining.findIndex(name=>predicate(operationMemberForName(name))&&operationRolesForName(name,group).includes(role)&&!operationRoleOwner(group,role,name));if(index<0)return false;const name=remaining.splice(index,1)[0];operationAssignments[name]=group;operationAssignmentRoles[name]=role;return true;};
  const fillVehicle=(group,capacity)=>{
    const required=['GF','Maschinist','ATF','ATM','WTF','WTM'],matched=new Map();
    // Match the whole Staffel before committing anyone to this vehicle.
    // Reassign flexible members so they do not block a scarce qualification.
    const match=(role,seen)=>{
      for(const name of remaining){
        if(seen.has(name)||!operationRolesForName(name,group).includes(role))continue;
        seen.add(name);
        if(!matched.has(name)||match(matched.get(name),seen)){matched.set(name,role);return true;}
      }
      return false;
    };
    if(!required.every(role=>match(role,new Set())))return false;
    for(const [name,role] of matched){remaining.splice(remaining.indexOf(name),1);operationAssignments[name]=group;operationAssignmentRoles[name]=role;}
    for(const role of OP_ROLE_ORDER.filter(value=>!required.includes(value))){if(Object.values(operationAssignments).filter(value=>value===group).length>=capacity)break;take(group,role);}
    return true;
  };
  fillVehicle('EM 5/42 LF10',OP_VEHICLE_CAPACITY['EM 5/42 LF10']);
  fillVehicle('EM 5/47 TSF',OP_VEHICLE_CAPACITY['EM 5/47 TSF']);
  remaining.forEach(name=>{operationAssignments[name]="Reserve Einsatzstelle";operationAssignmentRoles[name]="Reserve";});
  renderOperationAssignmentStep();
  const errors=validateOperationAssignments();
  const empty=operationVehicleGroups().filter(group=>!Object.values(operationAssignments).includes(group));
  if(!errors.length&&empty.length){showToast(empty.length===2?'Keine vollständige Staffel möglich. Beide Fahrzeuge bleiben unbesetzt; alle Kräfte sind in der Reserve.':empty[0]+': Keine vollständige Staffel möglich. Das Fahrzeug bleibt unbesetzt; übrige Kräfte sind in der Reserve.','warning');return;}
  showToast(errors.length?"Vorschlag erstellt. Bitte die rot markierten Hinweise prüfen.":"Plausibler Besetzungsvorschlag wurde erstellt.",errors.length?"error":"success");
}
function operationBaseRolesForName(name){
  const member=operationMemberForName(name),roles=member?[...new Set(getMemberRoles(member).filter(Boolean))]:[];
  if(member?.machinistVehicles?.length&&!roles.includes("Maschinist"))roles.push("Maschinist");
  return OP_ROLE_ORDER.filter(role=>roles.includes(role));
}
function operationAllowedGroupsForRole(name,role){
  const member=operationMemberForName(name),vehicles=Array.isArray(member?.machinistVehicles)?member.machinistVehicles:[];
  if(role==="Maschinist")return [vehicles.includes("LF")?"EM 5/42 LF10":"",vehicles.includes("TSF")||vehicles.includes("LF")?"EM 5/47 TSF":"","Reserve Einsatzstelle","Reserve Gerätehaus"].filter(Boolean);
  return ["EM 5/42 LF10","EM 5/47 TSF","Reserve Einsatzstelle","Reserve Gerätehaus"];
}
function operationAssignmentControls(name){
  const group=operationAssignments[name]||"",role=operationAssignmentRoles[name]||"",baseRoles=operationBaseRolesForName(name),roles=baseRoles.filter(value=>value===role||!group||!operationRoleOwner(group,value,name)),groups=operationAllowedGroupsForRole(name,role);
  const roleOptions=['<option value="">Zuerst Funktion wählen</option>',...roles.map(value=>`<option value="${escapeHtml(value)}" ${role===value?"selected":""}>${escapeHtml(value)}</option>`)].join("");
  const groupOptions=['<option value="">Danach Fahrzeug / Reserve wählen</option>',...groups.map(value=>`<option value="${escapeHtml(value)}" ${group===value?"selected":""}>${escapeHtml(value)}</option>`)].join("");
  const complete=Boolean(group&&role);
  return `<article class="operation-person-chip ${complete?"is-complete":"is-open"}"><div class="operation-person-name"><i aria-hidden="true">${complete?"✓":"1"}</i><strong title="${escapeHtml(operationProtocolName(name))}">${escapeHtml(operationProtocolName(name))}</strong></div><label class="operation-role-field"><span>1 · Funktion</span><select aria-label="Funktion für ${escapeHtml(operationProtocolName(name))}" data-assignment-name="${escapeHtml(name)}" data-assignment-field="role">${roleOptions}</select></label><label class="operation-group-field"><span>2 · Fahrzeug / Reserve</span><select aria-label="Fahrzeug oder Reserve für ${escapeHtml(operationProtocolName(name))}" data-assignment-name="${escapeHtml(name)}" data-assignment-field="group" ${role?"":"disabled"}>${groupOptions}</select></label></article>`;
}
function operationVehicleOverview(group,title,image){
  const names=operationNames().filter(name=>operationAssignments[name]===group),roles=new Map(names.map(name=>[operationAssignmentRoles[name],name])),hasGf=roles.has("GF"),hasMa=roles.has("Maschinist"),capacity=OP_VEHICLE_CAPACITY[group]||0;
  return `<article class="operation-vehicle-board ${hasGf&&hasMa?"is-ready":"needs-crew"}" data-operation-board="${escapeHtml(group)}"><div class="operation-vehicle-image"><img src="${image}" alt="${escapeHtml(title)}"><span>${names.length} / ${capacity}</span></div><header><div><small>${escapeHtml(group)}</small><h3>${escapeHtml(title)}</h3></div><div class="operation-readiness"><i class="${hasGf?"ok":"missing"}" title="Gruppenführer">GF ${hasGf?"✓":"!"}</i><i class="${hasMa?"ok":"missing"}" title="Maschinist">MA ${hasMa?"✓":"!"}</i></div></header><div class="operation-board-people">${names.length?names.sort((a,b)=>operationRoleRank(operationAssignmentRoles[a])-operationRoleRank(operationAssignmentRoles[b])).map(operationAssignmentControls).join(""):'<p class="operation-board-empty"><strong>Fahrzeug noch leer</strong><span>Personen über „Zuordnung“ hierher verschieben.</span></p>'}</div></article>`;
}
function operationStationOverview(selected){
  return `<article class="operation-vehicle-board operation-station-board ${selected?'is-ready':''}"><button type="button" class="operation-station-only" aria-pressed="${selected}" aria-label="Gerätehaus besetzen"><div class="operation-vehicle-image"><img src="taktik-geraetehaus.svg" alt="Symbolbild eines Feuerwehrgerätehauses"><span>${selected?'✓ Ausgewählt':'Auswählen'}</span></div><header><div><small>Alle anwesenden Kräfte · ohne Fahrzeug</small><h3>Gerätehaus besetzen</h3></div></header></button></article>`;
}
function operationReserveOverview(){
  const names=operationNames().filter(name=>String(operationAssignments[name]||"").startsWith("Reserve"));
  return `<article class="operation-reserve-board" data-operation-board="Reserve"><header><div><small>Weitere Kräfte</small><h3>Reserve</h3></div><strong>${names.length}</strong></header><div class="operation-board-people">${names.length?names.map(operationAssignmentControls).join(""):'<p class="operation-board-empty">Noch keine Reserve zugeordnet.</p>'}</div></article>`;
}
function operationUnassignedOverview(){
  const names=operationNames().filter(name=>!operationAssignments[name]).sort((a,b)=>operationProtocolName(a).localeCompare(operationProtocolName(b),"de"));
  return `<article class="operation-unassigned-board" data-operation-board="Offen"><header><div><small>Noch offen</small><h3>Nicht zugeordnet</h3></div><strong>${names.length}</strong></header><div class="operation-board-people">${names.length?names.map(operationAssignmentControls).join(""):'<p class="operation-board-empty">Alle Einsatzkräfte sind einem Bereich zugeordnet.</p>'}</div></article>`;
}
function ensureOperationAssignmentStep(){
  let section=byId("operationAssignmentStep");
  if(section)return section;
  section=document.createElement("section");section.id="operationAssignmentStep";section.className="panel operation-assignment-step";
  section.innerHTML='<div class="flow-stage-heading"><span>3</span><div><strong>Fahrzeuge besetzen</strong><small>Zuerst die Funktion festlegen. Danach wird die Person einem passenden Fahrzeug oder der Reserve zugeordnet.</small></div><div class="operation-heading-actions"><button type="button" class="outline-button operation-clear-assign">Zurücksetzen</button><button type="button" class="primary-button operation-auto-assign">Smart-Vorschlag</button></div></div><div class="operation-assignment-guide"><span><b>1</b> Funktion wählen</span><span><b>2</b> Fahrzeug oder Reserve wählen</span><span><b>3</b> Besetzung prüfen</span></div><div class="operation-vehicle-overview"></div><button type="button" class="outline-button operation-attendance-back">← Personen korrigieren · Schritt 2</button><div class="operation-assignment-footer"><span></span><button type="button" class="primary-button">Weiter zum Einsatzbericht</button></div>';
  byId("attendanceView").appendChild(section);
  section.querySelector(".operation-vehicle-overview").addEventListener("change",event=>{
    const select=event.target.closest("select[data-assignment-name]");if(!select)return;
    const name=select.dataset.assignmentName;
    if(select.dataset.assignmentField==="role"){
      const nextRole=select.value,currentGroup=operationAssignments[name]||"";
      operationAssignmentRoles[name]=nextRole;
      if(!nextRole){operationAssignments[name]="";}
      else if(currentGroup&&!operationAllowedGroupsForRole(name,nextRole).includes(currentGroup)){operationAssignments[name]="";showToast("Die bisherige Fahrzeugzuordnung passt nicht zur gewählten Funktion und wurde entfernt.","error");}
      else if(currentGroup&&operationVehicleGroups().includes(currentGroup)){
        const owner=operationRoleOwner(currentGroup,nextRole,name);
        if(owner){operationAssignments[name]="";showToast(`${nextRole} ist auf ${currentGroup} bereits durch ${operationProtocolName(owner)} besetzt. Bitte ein anderes Fahrzeug wählen.`,"error");}
      }
    }else if(select.dataset.assignmentField==="group"){
      const nextGroup=select.value,role=operationAssignmentRoles[name]||"",owner=operationRoleOwner(nextGroup,role,name);
      const occupied=operationNames().filter(other=>other!==name&&operationAssignments[other]===nextGroup).length,capacity=OP_VEHICLE_CAPACITY[nextGroup]||0;
      if(nextGroup&&operationVehicleGroups().includes(nextGroup)&&owner){operationAssignments[name]="";showToast(`${role} ist auf ${nextGroup} bereits durch ${operationProtocolName(owner)} besetzt.`,"error");}
      else if(nextGroup&&capacity&&occupied>=capacity){operationAssignments[name]="";showToast(`${nextGroup} ist mit ${capacity} Personen vollständig besetzt. Eine Überbesetzung ist nicht möglich.`,"error");}
      else operationAssignments[name]=nextGroup;
    }
    renderOperationAssignmentStep();
  });
  section.querySelector('.operation-vehicle-overview').addEventListener('click',event=>{
    if(event.target.closest('.operation-station-only'))setOperationStationOnly(!operationStationOnly());
  });
  section.querySelector(".operation-attendance-back").onclick=showOperationAttendance;
  section.querySelector(".operation-auto-assign").onclick=autoAssignOperationCrew;
  section.querySelector(".operation-clear-assign").onclick=()=>{operationAssignments={};operationAssignmentRoles={};renderOperationAssignmentStep();showToast("Zuordnung wurde zurückgesetzt.");};
  section.querySelector(".operation-assignment-footer button").onclick=openOperationReportForm;
  return section;
}
function renderOperationAssignmentStep(){
  const section=ensureOperationAssignmentStep(),names=operationNames(),stationOnly=operationStationOnly();
  const activeNames=new Set(names);
  for(const name of Object.keys(operationAssignments))if(!activeNames.has(name))delete operationAssignments[name];
  for(const name of Object.keys(operationAssignmentRoles))if(!activeNames.has(name))delete operationAssignmentRoles[name];
  if(stationOnly)assignOperationStationCrew();
  section.querySelector('.flow-stage-heading strong').textContent=stationOnly?'Gerätehaus besetzen':'Fahrzeuge besetzen';
  section.querySelector('.flow-stage-heading small').textContent=stationOnly?'Alle anwesenden Kräfte besetzen das Gerätehaus. Es wird kein Fahrzeug eingesetzt.':'Zuerst die Funktion festlegen. Danach wird die Person einem passenden Fahrzeug oder der Reserve zugeordnet.';
  section.querySelector('.operation-assignment-guide').hidden=stationOnly;
  section.querySelector('.operation-heading-actions').hidden=stationOnly;
  section.querySelector(".operation-vehicle-overview").innerHTML=operationStationOverview(stationOnly)+(stationOnly?`<article class="operation-reserve-board"><header><h3>Gerätehausbesetzung</h3><strong>${names.length}</strong></header><div class="operation-board-people">${names.map(name=>`<p>${escapeHtml(operationProtocolName(name))}</p>`).join("")||"<p>Noch keine Einsatzkräfte anwesend.</p>"}</div></article>`:operationUnassignedOverview()+operationVehicleOverview("EM 5/42 LF10","LF10","taktik-lf10.webp")+operationVehicleOverview("EM 5/47 TSF","TSF","taktik-tsf.webp")+operationReserveOverview());
  const complete=names.filter(name=>operationAssignments[name]&&operationAssignmentRoles[name]).length,errors=validateOperationAssignments();
  const footer=section.querySelector(".operation-assignment-footer"),status=footer.querySelector("span");
  status.innerHTML=`<strong>${complete} von ${names.length} vollständig zugeordnet</strong>${errors.length?`<small>${escapeHtml(errors[0])}${errors.length>1?` · ${errors.length-1} weiterer Hinweis${errors.length===2?"":"e"}`:""}</small>`:"<small>Zuordnung ist gültig.</small>"}`;
  footer.classList.toggle("has-errors",errors.length>0);
  footer.querySelector("button").disabled=!names.length||errors.length>0;
}
function showOperationAttendance(){
  setHomeFlowStage(2);
  renderSessionType();renderRoles();renderEntries();renderMembers();updateSelection();updateProbeWorkflow();
  const dateInput=byId("probeDateInput");if(dateInput)dateInput.value=today();
  requestAnimationFrame(()=>(byId("homeFlowProgress")||byId("attendanceSelectionWorkspace"))?.scrollIntoView({behavior:"smooth",block:"start"}));
}
function showOperationForm(){const f=byId("operationReportForm");if(f&&!f.hidden){try{persistOperationDraft(collectOperationData());}catch(error){console.warn("Einsatzbericht konnte beim Zurückgehen nicht zwischengespeichert werden",error);}f.hidden=true;f.style.display="none";f.setAttribute("aria-hidden","true");}const s=ensureOperationAssignmentStep();s.hidden=false;s.style.display="block";s.removeAttribute("aria-hidden");renderOperationAssignmentStep();syncHomeFlowProgress?.(3);window.SmartWorkflow?.operationForm?.();requestAnimationFrame(()=>requestAnimationFrame(()=>s.scrollIntoView({behavior:"smooth",block:"start"})))}
function operationPdfEscape(v){return pdfEscape(pdfLatin1(String(v||"")))}function opPdfBytes(v){const t=String(v??""),b=new Uint8Array(t.length);for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i)&255;return b}function opConcatBytes(p){const l=p.reduce((s,x)=>s+x.length,0),r=new Uint8Array(l);let o=0;for(const x of p){r.set(x,o);o+=x.length}return r}
async function operationDocxBlob(d,options){d=d||collectOperationData();if(!window.OperationDocx)throw new Error("Word-Modul ist nicht geladen");return window.OperationDocx.create(d,options);}
async function operationPdfBlob(d){
  d=d||collectOperationData();
  const safeTime=String(d.times?.alarm||"Einsatz").replace(":","-");
  const name=`FFW-Wasser_${d.date||today()}_${safeTime}.docx`;
  if(typeof oneDriveConvertDocxToPdf!=="function")throw new Error("Die PDF-Erstellung über die Word-Vorlage ist nicht verfügbar.");
  if(!globalThis.PDFLib?.PDFDocument)throw new Error("Die Seitenprüfung des Einsatzprotokolls ist nicht verfügbar.");
  for(const compactCrew of [false,true]){
    const docx=await operationDocxBlob(d,{compactCrew});
    const blob=await oneDriveConvertDocxToPdf(docx,name);
    const pdf=await PDFLib.PDFDocument.load(await blob.arrayBuffer());
    if(pdf.getPageCount()<=2)return blob;
    if(compactCrew)throw new Error(`Das Einsatzprotokoll würde ${pdf.getPageCount()} Seiten umfassen. Erlaubt sind maximal zwei Seiten. Bitte sehr lange Berichtstexte kürzen. Bei außergewöhnlich großer Mannschaft bitte die Verwaltung informieren. Es wurden keine Angaben abgeschnitten.`);
  }
}

async function showOperationPdfPreview(blob,fileName,onConfirm){
  if(!(blob instanceof Blob)||blob.type!=="application/pdf"||!blob.size)throw new Error("PDF-Vorschau konnte nicht erstellt werden");
  document.querySelectorAll("#operationPdfPreviewDialog,.operation-pdf-preview-dialog").forEach(node=>{try{node.close?.();}catch(error){}node.remove();});
  const previewUrl=URL.createObjectURL(blob),dialog=document.createElement("dialog");
  dialog.id="operationPdfPreviewDialog";dialog.className="operation-pdf-preview-dialog";
  dialog.innerHTML=`<div class="operation-preview-shell"><header><div><small>Einsatzprotokoll prüfen</small><h2>PDF-Vorschau</h2><p>${escapeHtml(fileName)}</p></div><a class="secondary" href="${previewUrl}" target="_blank" rel="noopener">PDF groß öffnen</a></header><div class="operation-preview-check"><strong>Bitte vor dem Abschluss prüfen:</strong><span>Namen und Funktionen</span><span>Fahrzeugzuordnung</span><span>Positionen und Seitenumbrüche</span></div><div class="operation-preview-frame-wrap"><iframe title="PDF-Vorschau des Einsatzprotokolls" src="${previewUrl}#toolbar=1&navpanes=0&view=FitH"></iframe></div><footer><button type="button" class="secondary operation-preview-back">Zurück zum Protokoll</button><button type="button" class="primary operation-preview-confirm">Geprüft, Terminpaket speichern</button></footer></div>`;
  document.body.appendChild(dialog);
  return await new Promise(resolve=>{
    let finished=false;
    const cleanup=result=>{if(finished)return;finished=true;try{dialog.close();}catch(error){}dialog.remove();URL.revokeObjectURL(previewUrl);resolve(result);};
    dialog.querySelector(".operation-preview-back").onclick=()=>cleanup(false);
    dialog.querySelector(".operation-preview-confirm").onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.textContent="Terminpaket wird gespeichert ...";try{const result=await onConfirm();cleanup(Boolean(result));}catch(error){button.disabled=false;button.textContent="Geprüft, Terminpaket speichern";showToast?.(`Terminpaket konnte nicht gespeichert werden: ${error?.message||"Unbekannter Fehler"}`,"error");}};
    dialog.addEventListener("cancel",event=>{event.preventDefault();cleanup(false);});
    if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
  });
}
function operationCsv(d){d=d||collectOperationData();const h=["Datum","Alarmzeit","Ausgerückt","Einsatzstelle erreicht","Einsatzende","Eingerückt","Einsatznummer","Einsatzart","Einsatzstelle","Einsatzleiter","ZvD","Name","Fahrzeug / Reserve","Funktion","Lage beim Eintreffen","Verlauf der Tätigkeit","Personal / Menschenrettung / Verletzungen","Besondere Vorkommnisse","Geräte mit Stückzahlen","Sonstige Geräte","Wasserentnahmestellen","Rohre / Schlauchmaterial","Ölbindemittel / Betriebsstoffe","Weitere Stellen","Alarmierungswege","Reserve Gerätehaus Beginn","Reserve Gerätehaus Ende","Reserve Gerätehaus Minuten"];const common=[d.date,d.times?.alarm||"",d.times?.departed||"",d.times?.arrived||"",d.times?.ended||"",d.times?.returned||"",d.number||"",operationReportType(d),d.location||"",d.leader||"",d.zvd||""];const deviceText=Object.entries(d.deviceAmounts||{}).map(([name,count])=>`${count} × ${name}`).join(", ");const pipeText=[[d.pipes?.c,"C-Rohre"],[d.pipes?.b,"B-Rohre"],[d.pipes?.monitor,"Wasserwerfer"],[d.pipes?.smallExtinguishers,"Kleinlöschgeräte"]].filter(([count])=>Number(count)>0).map(([count,name])=>`${count} × ${name}`).concat(d.pipes?.description?[d.pipes.description]:[]).join(", ");const details=[d.situation||"",d.actions||"",d.persons||"",d.special||"",deviceText,d.deviceOther||"",(d.waterSources||[]).join(", "),pipeText,d.oil?.description||"",(d.agencies||[]).join(", "),(d.alarmMethods||[]).join(", ")];const rows=(d.members||[]).map(n=>[...common,operationProtocolName(n),d.assignments?.[n]||"",d.assignmentRoles?.[n]||"",...details,...(d.assignments?.[n]==="Reserve Gerätehaus"?[operationEffectiveReserveTime(d,n).from,operationEffectiveReserveTime(d,n).to,operationReserveDuration(operationEffectiveReserveTime(d,n))??""]:["","",""])]);return '\ufeff'+[h,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n')}
async function finishOperation(){return window.finishOperationZip?.()}function resetOperationState(){const draftKey=operationDraftStorageKey();if(draftKey){try{localStorage.removeItem(draftKey)}catch(error){}try{sessionStorage.removeItem(draftKey)}catch(error){}}try{safeStorage.setItem("fw_v1_current_operation_id","")}catch(error){try{localStorage.setItem("fw_v1_current_operation_id","")}catch(innerError){}}currentOperationId="";currentOperationDraft=null;editingOperationArchiveId="";byId("operationReportForm")?.remove();byId("operationAssignmentStep")?.remove()}
function operationStatisticsData(y){return csvArchive.filter(i=>i.sessionType==="Einsatz"&&String(i.operationData?.date||i.createdAt).startsWith(y))}function renderOperationStatistics(){}function ensureOperationStatisticsPanel(){}function editArchivedOperation(id){if(!requireAdmin("settingsHistoryView"))return;const item=csvArchive.find(entry=>entry.id===id);if(!item?.operationData)return showToast("Für diesen Einsatz fehlen strukturierte Korrekturdaten.","error");const d=structuredClone?structuredClone(item.operationData):JSON.parse(JSON.stringify(item.operationData));editingOperationArchiveId=item.id;currentOperationId=d.id||`op-edit-${Date.now()}`;safeStorage.setItem("fw_v1_current_operation_id",currentOperationId);currentOperationDraft=d;operationAssignments={...(d.assignments||{})};operationAssignmentRoles={...(d.assignmentRoles||{})};entries=entries.filter(e=>e.operationId!==currentOperationId);(d.members||[]).forEach((name,index)=>entries.push({id:`edit-${currentOperationId}-${index}`,date:d.date||today(),time:d.times?.alarm||"",storedName:name,displayName:operationProtocolName(name),status:"Anwesend",role:d.assignmentRoles?.[name]||"",sessionType:"Einsatz",operationId:currentOperationId}));saveEntries();sessionType="Einsatz";currentProbeDate=d.date||systemToday();
byId("operationReportForm")?.remove();byId("operationAssignmentStep")?.remove();
chosenMemberIds.clear();pendingMemberStatuses.clear();chosenMemberId="";chosenRole="Anwesend";
showView("attendanceView");showOperationAttendance();showToast("Einsatz zur Korrektur geladen. Personen in Schritt 2 bearbeiten, anschließend Zuordnung und Bericht prüfen.");}

let operationDraftSaveTimer=0;function scheduleOperationDraftSave(){clearTimeout(operationDraftSaveTimer);operationDraftSaveTimer=setTimeout(()=>{const form=byId("operationReportForm");if(!form||form.hidden)return;try{persistOperationDraft(collectOperationData());}catch(error){console.warn("Automatische Sicherung des Einsatzberichts fehlgeschlagen",error);}},120);}document.addEventListener("input",event=>{if(event.target?.closest?.("#operationReportForm"))scheduleOperationDraftSave();});document.addEventListener("change",event=>{if(event.target?.closest?.("#operationReportForm"))scheduleOperationDraftSave();});


