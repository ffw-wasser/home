"use strict";
const QUALITY_SNAPSHOT_KEY="fw_v1_safety_snapshots";
function qualityNow(){return new Date().toISOString();}
function createSafetySnapshot(reason="Automatische Sicherung"){
  try{
    const data={};for(let i=0;i<safeStorage.length;i++){const key=safeStorage.key(i);if(key?.startsWith("fw_"))data[key]=safeStorage.getItem(key);}
    const list=JSON.parse(safeStorage.getItem(QUALITY_SNAPSHOT_KEY)||"[]");
    list.unshift({id:`snapshot-${Date.now()}`,createdAt:qualityNow(),reason,data});
    safeStorage.setItem(QUALITY_SNAPSHOT_KEY,JSON.stringify(list.slice(0,10)));return true;
  }catch(error){console.error("Sicherungspunkt konnte nicht erstellt werden",error);return false;}
}
function restoreLatestSafetySnapshot(){
  try{const list=JSON.parse(safeStorage.getItem(QUALITY_SNAPSHOT_KEY)||"[]"),latest=list[0];if(!latest)return showToast("Kein Sicherungspunkt vorhanden.","error");if(!confirm(`Sicherung vom ${new Date(latest.createdAt).toLocaleString("de-DE")} wiederherstellen?`))return;Object.entries(latest.data).forEach(([key,value])=>safeStorage.setItem(key,value));location.reload();}catch(error){showToast("Sicherung konnte nicht wiederhergestellt werden.","error");}
}
function qualityMinutes(value){if(!/^\d{2}:\d{2}$/.test(value||""))return null;const [h,m]=value.split(":").map(Number);return h*60+m;}
function validateOperationData(d){
  d=d||((typeof collectOperationData==="function")?collectOperationData():{})||{};
  d.members=Array.isArray(d.members)?d.members:[];
  d.assignments=d.assignments||{};
  d.assignmentRoles=d.assignmentRoles||{};
  d.times=d.times||{};
  const errors=[],warnings=[];if(!d?.date)errors.push("Datum fehlt.");if(!d?.type)errors.push("Einsatzart fehlt.");if(!d?.location)errors.push("Einsatzort fehlt.");if(!(d?.members||[]).length)errors.push("Keine Einsatzkräfte erfasst.");
  const groups=["EM 5/42 LF10","EM 5/47 TSF","Reserve Einsatzstelle","Reserve Gerätehaus"];
  (d?.members||[]).forEach(name=>{if(!groups.includes(d.assignments?.[name]))errors.push(`${operationProtocolName?.(name)||name}: keine Fahrzeug- oder Reservezuordnung.`);if((d.assignments?.[name]||"").startsWith("EM ")&&!d.assignmentRoles?.[name])errors.push(`${operationProtocolName?.(name)||name}: Fahrzeugfunktion fehlt.`);});
  for(const group of groups.slice(0,2)){const roles=(d.members||[]).filter(n=>d.assignments?.[n]===group).map(n=>d.assignmentRoles?.[n]).filter(Boolean);const duplicate=roles.find((role,i)=>roles.indexOf(role)!==i);if(duplicate)errors.push(`${group}: Funktion „${duplicate}“ ist mehrfach vergeben.`);}
  const order=["alarm","departed","arrived","ended","returned"].map(k=>qualityMinutes(d?.times?.[k]));if(order.some(v=>v===null))warnings.push("Mindestens eine Einsatzzeit fehlt oder ist ungültig.");else for(let i=1;i<order.length;i++){let current=order[i],previous=order[i-1];if(current<previous)current+=1440;if(current<previous){errors.push("Die Einsatzzeiten sind nicht chronologisch.");break;}}
  if(d?.atueUsed&&!d.atueDepartment&&!d.atuePerson)errors.push("ATÜ verwendet, aber keine verantwortliche Person gewählt.");
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
function validateProbeBeforeFinish(){
  const todayEntries=(entries||[]).filter(e=>e.date===today()),errors=[],warnings=[];if(!todayEntries.length)errors.push("Keine Teilnahmen erfasst.");const open=todayEntries.filter(e=>!["Anwesend","Entschuldigt","Fehlt","Betrifft nicht"].includes(e.status));if(open.length)errors.push(`${open.length} Teilnahme(n) ohne gültigen Status.`);if(todayEntries.filter(e=>e.status==="Anwesend").length===0)warnings.push("Keine anwesende Person erfasst.");return {errors,warnings};
}
function confirmQualityResult(result,label){const all=[...result.errors,...result.warnings];if(!all.length)return true;const text=`${label}\n\n${all.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\n${result.errors.length?"Abschluss ist nicht möglich.":"Trotz Warnung fortfahren?"}`;if(result.errors.length){alert(text);return false;}return confirm(text);}
function migrateArchiveSchema(){
  let changed=false;(csvArchive||[]).forEach(item=>{if(!item.id){item.id=makeId();changed=true;}if(!item.sessionType)item.sessionType=item.operationData?"Einsatz":"Probe";if(!item.schemaVersion){item.schemaVersion=3;changed=true;}if(!item.updatedAt){item.updatedAt=item.createdAt||qualityNow();changed=true;}});if(changed)saveArchive?.();
}

function updateQualityStatusCard(){
  const card=byId("qualityStatusCard"),button=byId("restoreSafetySnapshotMenuButton");
  if(button&&!button.dataset.bound){button.dataset.bound="1";button.addEventListener("click",restoreLatestSafetySnapshot);}
  if(card){const count=JSON.parse(safeStorage.getItem(QUALITY_SNAPSHOT_KEY)||"[]").length;card.querySelector("p").textContent=count?`Plausibilitätsprüfung aktiv · ${count} Sicherungspunkt${count===1?"":"e"} vorhanden.`:"Plausibilitätsprüfung aktiv · Noch kein Sicherungspunkt vorhanden.";}
}
function installDirectQualityGuards(){
  document.addEventListener("click",event=>{
    const probeButton=event.target.closest?.("#homeStageFinishButton");
    if(probeButton){const result=validateProbeBeforeFinish();if(!confirmQualityResult(result,"Plausibilitätsprüfung Probe")){event.preventDefault();event.stopImmediatePropagation();return;}createSafetySnapshot("Vor Probenabschluss");updateQualityStatusCard();}
    const operationButton=event.target.closest?.("#operationFinish");
    if(operationButton){const result=validateOperationData(collectOperationData());if(!confirmQualityResult(result,"Plausibilitätsprüfung Einsatz")){event.preventDefault();event.stopImmediatePropagation();return;}createSafetySnapshot("Vor Einsatzabschluss");updateQualityStatusCard();}
  },true);
}

function installQualityHooks(){
  migrateArchiveSchema();
  installDirectQualityGuards();
  updateQualityStatusCard();
  if(typeof requestCloseProbe==="function"){const original=requestCloseProbe;requestCloseProbe=function(){const result=validateProbeBeforeFinish();if(!confirmQualityResult(result,"Plausibilitätsprüfung Probe"))return;createSafetySnapshot("Vor Probenabschluss");return original.apply(this,arguments);};}
  if(typeof deleteArchiveItem==="function"){const original=deleteArchiveItem;deleteArchiveItem=async function(){createSafetySnapshot("Vor Löschen eines Archiveintrags");return original.apply(this,arguments);};}
  if(typeof importCompleteBackup==="function"){const original=importCompleteBackup;importCompleteBackup=async function(){createSafetySnapshot("Vor Wiederherstellung eines Komplett-Backups");return original.apply(this,arguments);};}
  const dataPanel=byId("backupLocationPanel")?.parentElement||byId("settingsFilesView")?.querySelector(".panel");if(dataPanel&&!byId("restoreSafetySnapshotButton")){const button=document.createElement("button");button.id="restoreSafetySnapshotButton";button.type="button";button.className="outline-button";button.textContent="Letzten automatischen Sicherungspunkt wiederherstellen";button.addEventListener("click",restoreLatestSafetySnapshot);dataPanel.appendChild(button);}
}
window.addEventListener("DOMContentLoaded",()=>setTimeout(installQualityHooks,0));
