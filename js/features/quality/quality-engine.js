"use strict";
const QUALITY_SNAPSHOT_KEY="fw_v1_safety_snapshots";
function qualityNow(){return new Date().toISOString();}
function createSafetySnapshot(reason="Automatische Sicherung"){
  try{
    const data={};for(let i=0;i<safeStorage.length;i++){const key=safeStorage.key(i);if(key?.startsWith("fw_")&&key!==QUALITY_SNAPSHOT_KEY&&!/^fw_onedrive_(?:tokens|pkce)$/.test(key))data[key]=safeStorage.getItem(key);}
    const list=JSON.parse(safeStorage.getItem(QUALITY_SNAPSHOT_KEY)||"[]");
    list.unshift({id:`snapshot-${Date.now()}`,createdAt:qualityNow(),reason,data});
    safeStorage.setItem(QUALITY_SNAPSHOT_KEY,JSON.stringify(list.slice(0,10)));return true;
  }catch(error){console.error("Sicherungspunkt konnte nicht erstellt werden",error);return false;}
}
function restoreLatestSafetySnapshot(){
  if(!requireAdmin("settingsFilesView"))return;
  try{const list=JSON.parse(safeStorage.getItem(QUALITY_SNAPSHOT_KEY)||"[]"),latest=list[0];if(!latest)return showToast("Kein Sicherungspunkt vorhanden.","error");if(!confirm(`Sicherung vom ${new Date(latest.createdAt).toLocaleString("de-DE")} wiederherstellen?`))return;Object.entries(latest.data).forEach(([key,value])=>safeStorage.setItem(key,value));location.reload();}catch(error){showToast("Sicherung konnte nicht wiederhergestellt werden.","error");}
}
function qualityMinutes(value){if(!/^\d{2}:\d{2}$/.test(value||""))return null;const [h,m]=value.split(":").map(Number);return h*60+m;}
function validateOperationData(d){return validateOperation(d);}
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
    if(operationButton){createSafetySnapshot("Vor Einsatzabschluss");updateQualityStatusCard();}
  },true);
}

function installQualityHooks(){
  migrateArchiveSchema();
  installDirectQualityGuards();
  updateQualityStatusCard();
  if(typeof requestCloseProbe==="function"){const original=requestCloseProbe;requestCloseProbe=function(){const result=validateProbeBeforeFinish();if(!confirmQualityResult(result,"Plausibilitätsprüfung Probe"))return;createSafetySnapshot("Vor Probenabschluss");return original.apply(this,arguments);};}
  if(typeof deleteArchiveItem==="function"){const original=deleteArchiveItem;deleteArchiveItem=async function(){if(!requireAdmin("settingsHistoryView"))return;createSafetySnapshot("Vor Löschen eines Archiveintrags");return original.apply(this,arguments);};}
  if(typeof importCompleteBackup==="function"){const original=importCompleteBackup;importCompleteBackup=async function(){if(!requireAdmin("settingsFilesView"))return;createSafetySnapshot("Vor Wiederherstellung eines Komplett-Backups");return original.apply(this,arguments);};}
  const dataPanel=byId("backupLocationPanel")?.parentElement||byId("settingsFilesView")?.querySelector(".panel");if(dataPanel&&!byId("restoreSafetySnapshotButton")){const button=document.createElement("button");button.id="restoreSafetySnapshotButton";button.type="button";button.className="outline-button";button.textContent="Letzten automatischen Sicherungspunkt wiederherstellen";button.addEventListener("click",restoreLatestSafetySnapshot);dataPanel.appendChild(button);}
}
window.addEventListener("DOMContentLoaded",()=>setTimeout(installQualityHooks,0));
