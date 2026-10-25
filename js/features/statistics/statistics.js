let selectedStatisticsYear=String(new Date().getFullYear());
function availableStatisticsYears(){const years=new Set([String(new Date().getFullYear()),...(globalThis.DrinksConsumption?.years()||[])]);statisticsArchiveData().forEach(data=>{const year=data.date.slice(0,4);if(/^\d{4}$/.test(year))years.add(year);});return [...years].sort((a,b)=>b.localeCompare(a));}
function renderStatisticsYearSelect(){const select=byId("statisticsYearSelect");if(!select)return;const years=availableStatisticsYears();if(!years.includes(selectedStatisticsYear))selectedStatisticsYear=years[0];select.innerHTML=years.map(year=>`<option value="${year}"${year===selectedStatisticsYear?" selected":""}>${year}</option>`).join("");}
function parseCsvRows(content) { return CsvEngine.parse(content); }
function statisticsRolesFromValue(value){
  const text=String(value||"").trim();if(!text)return [];
  const parts=/\b[12]\. Füllung:/.test(text)?text.split(/\s*\|\s*/):[text];
  const roles=[];
  parts.forEach(part=>{
    let role=part.replace(/^\s*[12]\. Füllung:\s*/i,"").replace(/^(?:LF10|TSF)\s+/i,"").trim();
    if(!role||role==="Reserve")return;
    role=normalizeStatisticsRole(role);
    if(AVAILABLE_ROLES.includes(role)&&!roles.includes(role))roles.push(role);
  });
  return roles;
}
function statisticsRoleRelevant(row){return new Set(["Allgemeine Probe","Einsatz"]).has(String(row?.sessionType||"").trim());}
function statisticsAssignmentCount(rows){return rows.filter(row=>row.status==="Anwesend"&&statisticsRoleRelevant(row)).reduce((sum,row)=>sum+statisticsRolesFromValue(row.role).length,0);}

function statisticsParseCsvMatrix(content){
  const source=String(content||"").replace(/^\uFEFF/,"");
  const matrix=[];let row=[],cell="",quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;}
    else if(ch==='"')quoted=!quoted;
    else if(ch===';'&&!quoted){row.push(cell);cell="";}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(value=>value!==""))matrix.push(row);row=[];cell="";}
    else cell+=ch;
  }
  row.push(cell);if(row.some(value=>value!==""))matrix.push(row);return matrix;
}
function statisticsOperationRowsFromCsv(item){
  const matrix=statisticsParseCsvMatrix(item?.content||"");
  if(matrix.length<2)return [];
  const headers=matrix[0].map(value=>String(value||"").trim().toLocaleLowerCase("de-DE"));
  const index=name=>headers.indexOf(String(name).toLocaleLowerCase("de-DE"));
  if(index("Einsatzart")<0&&index("Alarmzeit")<0)return [];
  const value=(row,name)=>{const i=index(name);return i>=0?String(row[i]||"").trim():"";};
  return matrix.slice(1).map(row=>{
    const name=value(row,"Name");
    const type=value(row,"Einsatzart")||String(item?.operationData?.type||"").trim()||"Einsatz";
    const location=value(row,"Einsatzstelle")||String(item?.operationData?.location||"").trim();
    return {date:value(row,"Datum")||String(item?.operationData?.date||item?.createdAt||"").slice(0,10),time:value(row,"Alarmzeit")||String(item?.operationData?.times?.alarm||""),name,sessionType:"Einsatz",status:"Anwesend",role:value(row,"Funktion"),topic:[type,location].filter(Boolean).join(" · "),vehicle:value(row,"Fahrzeug / Reserve"),operationId:item?.operationData?.id||item?.id||""};
  }).filter(row=>row.name);
}
function statisticsOperationRows(item){
  const data=item?.operationData;
  if(String(item?.sessionType||"").trim()!=="Einsatz"&&!data)return statisticsOperationRowsFromCsv(item);
  const members=[...new Set(Array.isArray(data?.members)?data.members:[])];
  if(!members.length)return statisticsOperationRowsFromCsv(item);
  const date=String(data.date||item.createdAt||"").slice(0,10);
  const time=String(data.times?.alarm||"");
  const topic=[data.type,data.location].filter(Boolean).join(" · ")||item.topic||"Einsatz";
  const assignments=data.assignments||{},roles=data.assignmentRoles||{};
  return members.map(name=>{
    const normalizedName=String(name||"").trim();
    const role=String(roles[normalizedName]||"");
    return {date,time,name:normalizedName,sessionType:"Einsatz",status:"Anwesend",role,topic,vehicle:assignments[normalizedName]||"",operationId:data.id||item.id||""};
  }).filter(row=>row.name);
}
function statisticsOperationLabel(data){
  const structured=String(data?.item?.operationData?.type||"").trim();
  if(structured)return structured;
  const topic=String(data?.item?.topic||data?.rows?.[0]?.topic||"").trim();
  return topic?topic.split(" · ")[0]:"Einsatz";
}
function statisticsOperationTypeEntries(yearData){
  const grouped=new Map();
  yearData.filter(statisticsIsOperation).forEach(data=>{
    const label=statisticsOperationLabel(data).normalize("NFC").trim().replace(/\s+/g," ")||"Einsatz",key=label.toLocaleLowerCase("de-DE");
    const item=grouped.get(key)||{label,count:0};item.count++;grouped.set(key,item);
  });
  return [...grouped.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"de-DE")).map(item=>[item.label,item.count]);
}

function statisticsIsOperation(data){
  const item=data?.item||data||{};
  const rowType=data?.rows?.[0]?.sessionType||"";
  return data?.operation===true||Boolean(item.operationData)||String(item.sessionType||"").trim()==="Einsatz"||String(rowType).trim()==="Einsatz";
}
function statisticsIsFellowship(data){
  if(statisticsIsOperation(data))return false;
  const type=String(data?.rows?.[0]?.sessionType||data?.item?.sessionType||"").trim().toLocaleLowerCase("de-DE");
  return type==="veranstaltung"||type==="kameradschaftspflege";
}
function renderFellowshipStatistics(yearData){
  const root=byId("statisticsFellowshipEvents");if(!root)return;
  const events=yearData.filter(statisticsIsFellowship),grouped=new Map();
  events.forEach(data=>{const label=String(data.item.topic||data.rows[0]?.topic||"Veranstaltung").normalize("NFC").trim().replace(/\s+/g," ")||"Veranstaltung",key=label.toLocaleLowerCase("de-DE"),entry=grouped.get(key)||{label,count:0};entry.count++;grouped.set(key,entry);});
  const participations=events.reduce((sum,data)=>sum+new Set(data.rows.filter(row=>row.status==="Anwesend").map(row=>statisticsMemberNameKey(row.name))).size,0);
  root.querySelector("[data-fellowship-summary]").textContent=`${events.length} Veranstaltung${events.length===1?"":"en"} · ${participations} Teilnahmen`;
  root.querySelector("[data-fellowship-chart]").innerHTML=events.length?renderBarChart([...grouped.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"de")).map(item=>[item.label,item.count]),"Veranstaltungen nach Thema","#65439b"):'<p class="empty-state">Keine abgeschlossenen Veranstaltungsberichte im gewählten Jahr geladen.</p>';
}
function statisticsArchiveData() {
  return csvArchive.map(item => {
    const operationRows=statisticsOperationRows(item);
    const rows=operationRows.length?operationRows:parseCsvRows(item.content);
    const headers=statisticsParseCsvMatrix(item.content)[0]||[];
    const operation=statisticsIsOperation({item,rows})||headers.some(value=>["einsatzart","alarmzeit"].includes(String(value).trim().toLocaleLowerCase("de-DE")));
    const date=[item.operationData?.date,...rows.map(row=>row.date),item.originalReportDate,item.createdAt].map(CsvEngine.normalizeDate).find(Boolean)||"";
    return {item,date,operation,rows:rows.filter(row=>String(row.name||"").trim()).map(row=>({...row,date:CsvEngine.normalizeDate(row.date)||date,name:String(row.name).trim()}))};
  }).filter(data => data.rows.length||data.operation);
}
function statisticsMemberNameKey(value){
  return String(value||"").normalize("NFC").trim().replace(/\s+/g," ").replace(/\s*,\s*/g,", ").toLocaleLowerCase("de-DE");
}
function statisticsMemberNames(member){
  return new Set([nameForStorage(member),nameForTile(member),`${member.firstName} ${member.lastName}`,`${member.lastName} ${member.firstName}`].map(statisticsMemberNameKey));
}
function statisticsRowMatchesMember(row,member){
  const key=statisticsMemberNameKey(row.name);
  return key!==""&&statisticsMemberNames(member).has(key)&&members.filter(item=>statisticsMemberNames(item).has(key)).length===1;
}
function statisticsAgeEvents(yearData){
  return yearData.filter(data=>!statisticsIsOperation(data)&&!statisticsIsFellowship(data)&&(data.rows[0]?.sessionType||data.item.sessionType||"")!=="Ausschuss Sitzung");
}
function statisticsAgeRows(yearData,ageMembers=members.filter(member=>member.ageDepartment)){
  return statisticsAgeEvents(yearData).flatMap(data=>ageMembers.flatMap(member=>{
    const existing=data.rows.find(row=>statisticsRowMatchesMember(row,member));
    // Ein ausdrücklich nicht betreffender Termin zählt nicht als Fehlzeit.
    if(existing?.status==="Betrifft nicht")return [];
    if(existing)return [{...existing,name:nameForStorage(member)}];
    return [{date:data.rows[0]?.date||String(data.item.createdAt||"").slice(0,10),time:"",name:nameForStorage(member),sessionType:data.rows[0]?.sessionType||data.item.sessionType||"",status:"Fehlt",role:"",topic:data.item.topic||data.rows[0]?.topic||""}];
  }));
}
const STATISTICS_FUNCTION_GROUPS=Object.freeze([
  {label:"Gruppenführer",roles:["GF"]}, {label:"Maschinisten",roles:["Maschinist"]},
  {label:"Melder",roles:["Melder"]}, {label:"Angriffstrupp",roles:["ATF","ATM"],breathing:true},
  {label:"Wassertrupp",roles:["WTF","WTM"],breathing:true}, {label:"Schlauchtrupp",roles:["STF","STM"]}
]);
function statisticsIsDrill(data){return ["Allgemeine Probe","Probe","Sonderprobe","Unterricht"].includes(data.rows[0]?.sessionType||data.item.sessionType);}
function statisticsParticipation(yearData,roster=members){
  const active=roster.filter(member=>!member.ageDepartment),drills=yearData.filter(statisticsIsDrill),rows=[];
  const people=active.map(member=>{
    const relevant=drills.flatMap(data=>{
      const row=data.rows.find(row=>statisticsRowMatchesMember(row,member));
      return row&&["Anwesend","Entschuldigt","Fehlt"].includes(row.status)?[row]:[];
    });
    rows.push(...relevant);
    const present=relevant.filter(row=>row.status==="Anwesend"),organization=present.filter(row=>row.role==="Orga").length;
    return {name:nameForStorage(member),count:present.length,relevant:relevant.length,organization,operational:present.length-organization,percent:relevant.length?present.length/relevant.length*100:0};
  });
  return {active,drills,rows,people,present:rows.filter(row=>row.status==="Anwesend").length,excused:rows.filter(row=>row.status==="Entschuldigt").length,missing:rows.filter(row=>row.status==="Fehlt").length};
}
function statisticsCurrentReadiness(roster=members,date=MemberEvidence.day(Date.now())){
  const active=roster.filter(member=>!member.ageDepartment),valid=state=>["valid","soon"].includes(state);
  const breathing=[],drivers=[];
  active.forEach(member=>{
    const groups=MemberEvidence.assess(MemberEvidence.project(member),Date.parse(date+"T12:00:00Z"));
    for(const [title,target] of [["Atemschutz",breathing],["Führerscheinkontrolle",drivers]]){
      const group=groups.find(group=>group.title===title);
      if(group)target.push({member,state:group.status,items:group.items});
    }
  });
  const summarize=items=>({items,total:items.length,eligible:items.filter(item=>valid(item.state)).length,...Object.fromEntries(["valid","soon","expired","missing"].map(state=>[state,items.filter(item=>item.state===state).length]))});
  const breathingIds=new Set(breathing.filter(item=>valid(item.state)).map(item=>item.member)),driverIds=new Set(drivers.filter(item=>valid(item.state)).map(item=>item.member));
  const crew=STATISTICS_FUNCTION_GROUPS.map(group=>({label:group.label,count:active.filter(member=>getMemberRoles(member).some(role=>group.roles.includes(role))&&(!group.breathing||breathingIds.has(member))&&(!group.roles.includes("Maschinist")||driverIds.has(member))).length}));
  return {date,active:active.length,breathing:summarize(breathing),drivers:summarize(drivers),crew};
}
function statisticsFunctionTargets(yearData,active,targets){
  return active.flatMap(member=>{
    const counts=new Map();
    yearData.forEach(data=>{const row=data.rows.find(row=>row.status==="Anwesend"&&statisticsRowMatchesMember(row,member));if(row&&statisticsRoleRelevant(row))statisticsRolesFromValue(row.role).forEach(role=>counts.set(role,(counts.get(role)||0)+1));});
    return getMemberRoles(member).filter(role=>targets[role]>0).map(role=>{const actual=counts.get(role)||0,target=targets[role];return {memberKey:member.id||member,name:nameForStorage(member),role,target,actual,remaining:Math.max(0,target-actual)};});
  });
}
function statisticsGoalGroups(targetRows){
  return STATISTICS_FUNCTION_GROUPS.map(group=>{
    const byPerson=new Map();targetRows.filter(row=>group.roles.includes(row.role)).forEach(row=>{if(!byPerson.has(row.memberKey))byPerson.set(row.memberKey,[]);byPerson.get(row.memberKey).push(row);});
    return {label:group.label,total:byPerson.size,complete:[...byPerson.values()].filter(rows=>rows.every(row=>row.remaining===0)).length};
  }).filter(group=>group.total>0);
}
function statisticsStatusRing(summary,label,{attendance=false}={}){
  const states=[["valid","#176b36",attendance?"Dabei":"Gültig"],["soon","#96620c",attendance?"Entschuldigt":"Bald fällig"],["expired","#a02c38",attendance?"Fehlt":"Abgelaufen"],["missing","#667680","Fehlt"]];
  const value=summary.total?(attendance?`${(summary.eligible/summary.total*100).toLocaleString("de-DE",{maximumFractionDigits:1})} %`:`${summary.eligible}/${summary.total}`):"–";
  const description=attendance?`${summary.valid} anwesend, ${summary.soon} entschuldigt, ${summary.expired} fehlt`:`${summary.eligible} von ${summary.total} aktuell gültig, ${summary.soon} bald fällig, ${summary.expired} abgelaufen, ${summary.missing} fehlen`;
  let offset=0;
  const marks=states.map(([state,color])=>{const length=summary.total?summary[state]/summary.total*100:0;const mark=length?`<circle cx="60" cy="60" r="47" pathLength="100" fill="none" stroke="${color}" stroke-width="15" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`:"";offset+=length;return mark;}).join("");
  return `<div class="commander-readiness-item">${attendance?"":`<h4>${escapeHtml(label)}</h4>`}<svg class="commander-ring" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(label)}: ${description}"><circle cx="60" cy="60" r="47" fill="none" stroke="#e0e7e4" stroke-width="15"/>${marks}<text x="60" y="65" text-anchor="middle" class="commander-ring-value">${value}</text></svg><p>${summary.total?(attendance?"Anwesend":"Aktuell gültig"):(attendance?"Noch keine betreffenden Übungen":"Keine Personen zugeordnet")}</p><div class="commander-status-legend">${states.filter(([state])=>summary[state]>0).map(([state,color,title])=>`<span><i style="background:${color}" aria-hidden="true"></i>${title} ${summary[state]}</span>`).join("")}</div></div>`;
}
function statisticsPersonnelBars(items,total,goals=false){
  if(!items.length)return `<p class="empty-state">${goals?"Noch keine persönlichen Funktionsziele eingestellt.":"Keine aktiven Mitglieder vorhanden."}</p>`;
  return `<div class="commander-personnel-bars">${items.map(item=>{
    const value=goals?item.complete:item.count,max=goals?item.total:total,percent=max?value/max*100:0;
    return `<div class="commander-personnel-row"><span>${escapeHtml(item.label)}</span><div class="commander-track" aria-hidden="true"><i style="width:${percent}%"></i></div><strong>${goals?`${value} / ${max}`:value}</strong></div>`;
  }).join("")}</div>`;
}
function statisticsActivityChart(yearData){
  const months=Array.from({length:12},()=>({drills:0,operations:0})),labels=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  yearData.forEach(data=>{const month=Number(data.date.slice(5,7))-1;if(month<0||month>11)return;if(statisticsIsOperation(data))months[month].operations++;else if(statisticsIsDrill(data))months[month].drills++;});
  if(!months.some(month=>month.drills||month.operations))return '<p class="empty-state">Keine Übungen oder Einsätze im gewählten Jahr.</p>';
  const max=Math.max(1,...months.flatMap(month=>[month.drills,month.operations]));
  return `<div class="commander-months">${months.map((month,index)=>`<div class="commander-month" aria-label="${labels[index]}: ${month.drills} Übungen, ${month.operations} Einsätze"><div class="commander-month-bars" aria-hidden="true"><i style="height:${month.drills/max*100}%"></i><i style="height:${month.operations/max*100}%"></i></div><span>${labels[index]}</span><small>${month.drills||month.operations?`${month.drills} · ${month.operations}`:""}</small></div>`).join("")}</div><p class="commander-month-legend"><span><i aria-hidden="true"></i>Übungen</span><span><i aria-hidden="true"></i>Einsätze</span></p>`;
}
function renderCommanderStatistics(yearData,participation,targetRows){
  // Lightweight unit fixtures can render existing fields without constructing the UI.
  if(typeof document.createElement!=="function")return;
  const view=byId("settingsStatisticsView")||byId("statisticsView");if(!view)return;
  let dashboard=byId("statisticsCommanderDashboard");
  if(!dashboard){
    dashboard=document.createElement("div");dashboard.id="statisticsCommanderDashboard";dashboard.className="commander-dashboard";
    dashboard.innerHTML=`<article class="panel commander-readiness"><h3>Tauglichkeit · Nachweisstand heute</h3><p class="commander-asof"></p><div class="commander-readiness-grid" data-command-readiness></div><details><summary>Prüfkriterien &amp; offene Nachweise</summary><p>AT: G26.3, FFI und Unterweisung. Maschinisten: zugeordnete Fahrzeuge und gültige Führerscheinkontrolle. Bald fällige Nachweise zählen bis zum Ablauf als gültig. Die dokumentierten Nachweise ersetzen keine persönliche Einsatzfreigabe.</p><div data-command-evidence></div></details></article><div class="commander-chart-pair"><article class="panel"><h3>Aktivitäten je Monat</h3><div data-command-months></div></article><article class="panel"><h3>Übungsbeteiligung</h3><div data-command-attendance></div><p class="help-text">Nur jeweils betreffende Mitglieder der Einsatzabteilung</p></article></div><article class="panel commander-operation-types"><h3>Einsätze nach Art</h3><div data-command-operation-types></div><p class="help-text" data-command-operation-average></p></article><article class="panel commander-crew"><h3>Mögliche Funktionsbesetzung · heute</h3><p class="help-text" data-command-roster></p><div data-command-crew></div><details><summary>Wie wird gezählt?</summary><p>Es zählen die hinterlegten Funktionen der aktiven Mitglieder. Angriffstrupp und Wassertrupp werden hier mit gültigen Atemschutznachweisen gezählt, Maschinisten mit gültiger Führerscheinkontrolle. Pro Trupp wird jede Person nur einmal gezählt. Mehrfachqualifikationen können in mehreren Balken erscheinen. Die Werte zeigen Personen aus der gesamten Mannschaft, keine gleichzeitige Fahrzeugbesetzung oder aktuelle Anwesenheit.</p></details></article><div data-command-ranking></div><article class="panel commander-goals"><h3>Persönliche Funktionsziele erreicht</h3><div data-command-goals></div><p class="help-text">Personen mit allen eingestellten Jahreszielen der jeweiligen Funktionsgruppe</p></article>`;
    view.querySelector(":scope > .statistics-kpis").after(dashboard);
  }
  const readiness=statisticsCurrentReadiness();
  dashboard.querySelector(".commander-asof").textContent=`Stand ${formatDisplayDate(readiness.date)} · heutige Mitgliederdaten`;
  dashboard.querySelector("[data-command-readiness]").innerHTML=statisticsStatusRing(readiness.breathing,"Atemschutzträger (AT)")+statisticsStatusRing(readiness.drivers,"Maschinisten");
  const labels={soon:"Bald fällig",expired:"Abgelaufen",missing:"Nicht dokumentiert"};
  dashboard.querySelector("[data-command-evidence]").innerHTML=[["Atemschutz",readiness.breathing],["Maschinisten",readiness.drivers]].map(([label,summary])=>`<section><h4>${label}</h4>${summary.items.filter(item=>item.state!=="valid").map(item=>renderMetric("",nameForTile(item.member),labels[item.state],item.state==="expired"?"red":item.state==="soon"?"gold":"gray")).join("")||'<p>Keine offenen Nachweise.</p>'}</section>`).join("");
  dashboard.querySelector("[data-command-months]").innerHTML=statisticsActivityChart(yearData);
  const operationTypes=statisticsOperationTypeEntries(yearData),operationCount=operationTypes.reduce((sum,[,count])=>sum+count,0);
  dashboard.querySelector("[data-command-operation-types]").innerHTML=operationCount?statisticsPersonnelBars(operationTypes.map(([label,count])=>({label,count})),operationCount):'<p class="empty-state">Keine Einsätze im gewählten Jahr.</p>';
  const operations=yearData.filter(statisticsIsOperation),participations=operations.reduce((sum,data)=>sum+new Set(data.rows.filter(row=>row.status==="Anwesend").map(row=>statisticsMemberNameKey(row.name))).size,0);
  dashboard.querySelector("[data-command-operation-average]").textContent=operations.length?`Ø ${(participations/operations.length).toLocaleString("de-DE",{maximumFractionDigits:1})} Teilnehmende je Einsatz`:"";
  const status={total:participation.rows.length,eligible:participation.present,valid:participation.present,soon:participation.excused,expired:participation.missing,missing:0};
  dashboard.querySelector("[data-command-attendance]").innerHTML=statisticsStatusRing(status,"Teilnahme",{attendance:true});
  dashboard.querySelector("[data-command-roster]").textContent=`Personen aus ${readiness.active} Aktiven · AT/WT mit Atemschutz`;
  dashboard.querySelector("[data-command-crew]").innerHTML=statisticsPersonnelBars(readiness.active?readiness.crew:[],readiness.active);
  dashboard.querySelector("[data-command-goals]").innerHTML=statisticsPersonnelBars(statisticsGoalGroups(targetRows),0,true);
  const ranking=byId("topVisitors")?.closest("article");
  if(ranking){
    const collapsed=ranking.querySelector(":scope > .statistics-collapsible");
    if(collapsed){const body=collapsed.querySelector(".statistics-collapsible-body");ranking.replaceChildren(...body.childNodes);delete ranking.dataset.collapsibleBound;}
    let heading=ranking.querySelector("h3");if(!heading){heading=document.createElement("h3");ranking.prepend(heading);}
    ranking.classList.add("commander-ranking");heading.textContent="Bestenliste · Übungsbeteiligung";
    dashboard.querySelector("[data-command-ranking]").append(ranking);
  }
}
function renderMetric(containerId, label, value, tone = "neutral") {
  return `<div class="metric-row metric-${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}
const STATISTICS_TYPE_COLORS=Object.freeze({
  "Allgemeine Probe":"#176b36",
  "Sonderprobe":"#2477bd",
  "Unterricht":"#65439b",
  "Ausschuss Sitzung":"#4d5d65",
  "Einsatz":"#d97706",
  "Unbekannt":"#7b8790"
});
const STATISTICS_CHART_COLORS=["#176b36","#2477bd","#65439b","#4d5d65","#d97706","#13899a","#b38b12","#7b8790"];
function statisticsTypeColor(name,index=0){return STATISTICS_TYPE_COLORS[name]||STATISTICS_CHART_COLORS[index%STATISTICS_CHART_COLORS.length];}
function statisticsChartEntries(map){return [...map.entries()].filter(([,value])=>Number(value)>0).sort((a,b)=>b[1]-a[1]);}
function renderDonutChart(entries,label){
  const data=entries.filter(([,value])=>Number(value)>0),total=data.reduce((sum,[,value])=>sum+Number(value),0);
  if(!total)return `<p class="empty-state">Keine Daten vorhanden.</p>`;
  let offset=0;const circles=data.map(([name,value],index)=>{const amount=Number(value),length=amount/total*100,start=offset,color=statisticsTypeColor(name,index);offset+=length;return `<circle cx="60" cy="60" r="48" pathLength="100" fill="none" stroke="${color}" stroke-width="22" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-start}" transform="rotate(-90 60 60)"><title>${escapeHtml(name)}: ${amount}</title></circle>`;}).join("");
  return `<div class="statistics-donut-layout"><svg class="statistics-donut" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(label)}">${circles}<circle cx="60" cy="60" r="34" fill="#fff"></circle><text x="60" y="57" text-anchor="middle" class="donut-total">${total}</text><text x="60" y="71" text-anchor="middle" class="donut-caption">gesamt</text></svg><div class="statistics-chart-legend">${data.map(([name,value],index)=>`<div><i style="--chart-color:${statisticsTypeColor(name,index)}"></i><span>${escapeHtml(name)}</span><strong>${value}</strong></div>`).join("")}</div></div>`;
}
function renderBarChart(entries,label,color="#2477bd"){
  const data=entries.filter(([,value])=>Number(value)>0),max=Math.max(1,...data.map(([,value])=>Number(value)));
  if(!data.length)return `<p class="empty-state">Keine Daten vorhanden.</p>`;
  return `<div class="statistics-bars" role="img" aria-label="${escapeHtml(label)}">${data.map(([name,value])=>`<div class="statistics-bar-row"><span>${escapeHtml(name)}</span><div><i style="width:${Math.max(3,Number(value)/max*100)}%;background:${color}"></i></div><strong>${value}</strong></div>`).join("")}</div>`;
}
function ensureStatisticsCharts(){
  const view=byId("settingsStatisticsView")||byId("statisticsView"),grid=view?.querySelector(".statistics-grid");
  if(grid&&!byId("statisticsVisualDashboard")){const panel=document.createElement("article");panel.id="statisticsVisualDashboard";panel.className="panel statistics-panel statistics-visual-dashboard";panel.innerHTML=`<div class="panel-heading"><h3>Ausgeübte Funktionen</h3></div><p class="help-text">Tatsächliche Einteilungen bei allgemeinen Proben und Einsätzen</p><div data-chart-roles></div>`;grid.prepend(panel);}
}
function renderStatisticsCharts(yearData,presentRows){
  ensureStatisticsCharts();
  const roles=new Map();presentRows.filter(statisticsRoleRelevant).forEach(row=>statisticsRolesFromValue(row.role).forEach(role=>roles.set(role,(roles.get(role)||0)+1)));
  const panel=byId("statisticsVisualDashboard");if(panel)panel.querySelector("[data-chart-roles]").innerHTML=renderBarChart(statisticsChartEntries(roles),"Tatsächliche Funktionsausübungen bei Proben und Einsätzen","#176b36");
}
function ensureOperationStatisticsSections(){
  const individual=byId("individualStatisticsPreview");
  if(individual&&!byId("individualOperationStatistics")){
    const panel=document.createElement("section");panel.id="individualOperationStatistics";panel.className="individual-statistics-section individual-operation-statistics";
    panel.innerHTML=`<h4>Persönliche Einsatzstatistik</h4><div class="statistics-kpis"><div class="stat-kpi"><span>Einsätze</span><strong data-individual-operation-count>0</strong></div><div class="stat-kpi"><span>Funktionen</span><strong data-individual-operation-roles>0</strong></div></div><div class="metric-list" data-individual-operation-functions></div><p class="empty-state" data-individual-operation-empty>Keine Einsatzteilnahme im gewählten Jahr.</p>`;
    const recent=byId("individualRecentVisits")?.closest(".individual-statistics-section,section");
    if(recent)recent.insertAdjacentElement("beforebegin",panel);else individual.appendChild(panel);
  }
}
function renderIndividualOperationStatistics(rows){
  ensureOperationStatisticsSections();
  const operations=rows.filter(row=>row.sessionType==="Einsatz"&&row.status==="Anwesend");
  const unique=new Set(operations.map(row=>row.operationId||`${row.date}|${row.topic}`));
  const roles=new Map();operations.forEach(row=>{if(row.role)roles.set(row.role,(roles.get(row.role)||0)+1);});
  const panel=byId("individualOperationStatistics");if(!panel)return;
  panel.querySelector("[data-individual-operation-count]").textContent=unique.size;
  panel.querySelector("[data-individual-operation-roles]").textContent=[...roles.values()].reduce((sum,value)=>sum+value,0);
  panel.querySelector("[data-individual-operation-functions]").innerHTML=[...roles.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>renderMetric("",name,count,"red")).join("");
  panel.querySelector("[data-individual-operation-empty]").hidden=operations.length>0;
}
function makeStatisticsPanelCollapsible(panel,title){
  if(!panel||panel.dataset.collapsibleBound)return;
  panel.dataset.collapsibleBound="true";
  const heading=panel.querySelector(":scope > .panel-heading");
  const details=document.createElement("details");
  details.className="statistics-collapsible";
  const summary=document.createElement("summary");
  summary.innerHTML=`<span>${escapeHtml(title)}</span><i aria-hidden="true"></i>`;
  const titleId=heading?.querySelector("h3[id]")?.id;
  if(titleId)summary.querySelector("span").id=titleId;
  const consumptionYear=heading?.querySelector("#drinksStatisticsYear");
  if(consumptionYear)summary.querySelector("span").append(" · ",consumptionYear);
  const body=document.createElement("div");
  body.className="statistics-collapsible-body";
  [...panel.children].forEach(child=>{if(child!==heading)body.appendChild(child);});
  if(heading)heading.remove();
  details.append(summary,body);
  panel.appendChild(details);
}
function ensureCollapsedStatisticsPanels(){
  const breathingPanel=document.querySelector(".breathing-statistics-panel");
  const driverPanel=byId("driverLicenseStatisticsPanel");
  const openFunctionsPanel=byId("openFunctions")?.closest("article");
  makeStatisticsPanelCollapsible(breathingPanel,"Atemschutz je Mitglied");
  makeStatisticsPanelCollapsible(driverPanel,"Führerschein je Maschinist");
  makeStatisticsPanelCollapsible(openFunctionsPanel,"Offene Funktionsziele");
  const view=byId("settingsStatisticsView")||byId("statisticsView");
  for(const [panel,title] of [[byId("statisticsVisualDashboard"),"Ausgeübte Funktionen"],[byId("probeTypes")?.closest("article"),"Terminarten"],[byId("probeTopics")?.closest("article"),"Ausbildungsthemen"],[view?.querySelector(".individual-statistics-panel"),"Teilnehmerstatistik"],[view?.querySelector(".age-statistics-section"),"Altersabteilung"]])makeStatisticsPanelCollapsible(panel,title);
  if(driverPanel&&openFunctionsPanel&&driverPanel.parentElement&&!openFunctionsPanel.closest(".commander-goals")){
    driverPanel.insertAdjacentElement("afterend",openFunctionsPanel);
  }
}
function arrangeStatisticsPage(){
  const view=byId("settingsStatisticsView")||byId("statisticsView");
  const grid=view?.querySelector(".statistics-grid");
  if(!grid)return;
  const ordered=[
    byId("statisticsVisualDashboard"),
    byId("probeTypes")?.closest("article"),
    byId("probeTopics")?.closest("article")
  ].filter(Boolean);
  ordered.forEach(node=>grid.appendChild(node));
  const dashboard=byId("statisticsCommanderDashboard");if(!dashboard)return;
  const targets=byId("openFunctions")?.closest("article");
  if(targets)dashboard.querySelector(".commander-goals").append(targets);
  let additional=byId("statisticsAdditionalTopics");
  if(!additional){additional=document.createElement("div");additional.id="statisticsAdditionalTopics";additional.className="statistics-additional-topics";dashboard.after(additional);}
  let further=byId("statisticsFurtherDetails");
  if(!further){further=document.createElement("details");further.id="statisticsFurtherDetails";further.className="panel commander-further";further.innerHTML='<summary>Weitere Feuerwehr-Auswertungen</summary><div class="commander-further-content"></div>';additional.append(further);}
  const content=further.querySelector(".commander-further-content");
  for(const node of [view.querySelector(".individual-statistics-panel"),grid,view.querySelector(".breathing-statistics-panel"),byId("driverLicenseStatisticsPanel"),view.querySelector(".age-statistics-section"),view.querySelector(".statistics-note")])if(node)content.append(node);
  let fellowship=byId("statisticsFellowshipDetails");
  if(!fellowship){fellowship=document.createElement("details");fellowship.id="statisticsFellowshipDetails";fellowship.className="panel commander-further";fellowship.innerHTML='<summary>Kameradschaftspflege</summary><div class="commander-fellowship-content"></div>';additional.append(fellowship);}
  let events=byId("statisticsFellowshipEvents");if(!events){events=document.createElement("section");events.id="statisticsFellowshipEvents";events.innerHTML='<h3>Veranstaltungen</h3><p data-fellowship-summary></p><div data-fellowship-chart></div><button class="outline-button" type="button">Veranstaltungen öffnen</button>';events.querySelector("button").addEventListener("click",()=>showView("eventsView"));fellowship.querySelector(".commander-fellowship-content").prepend(events);}
  const drinks=view.querySelector(".drinks-consumption-panel");if(drinks)fellowship.querySelector(".commander-fellowship-content").append(drinks);
}
function renderStatistics({refreshDrinks=true}={}) {
  renderStatisticsYearSelect();
  populateIndividualMemberSelect();
  const year = selectedStatisticsYear || String(new Date().getFullYear());
  if(refreshDrinks)globalThis.DrinksConsumption?.load(year);
  const all = statisticsArchiveData();
  const yearData = all.filter(data => data.date.startsWith(year));
  const participation=statisticsParticipation(yearData);
  const probeYearData=yearData.filter(data=>!statisticsIsOperation(data)),allYearRows=probeYearData.flatMap(data=>data.rows),presentYearRows=allYearRows.filter(row=>row.status==="Anwesend"),assignmentTotal=statisticsAssignmentCount(presentYearRows),changedRows=presentYearRows.filter(row=>/2\. Füllung:/.test(row.role||""));
  renderStatisticsCharts(yearData,yearData.flatMap(data=>data.rows).filter(row=>row.status==="Anwesend"));
  const activeMembers = participation.active;
  const ageMembers = members.filter(member => member.ageDepartment);
  // In der AS-Statistik nur Personen anzeigen, bei denen Atemschutz
  // tatsächlich hinterlegt beziehungsweise vorgesehen ist. Nicht eingesetzte
  // Personen ohne Atemschutzbezug werden nicht als "nicht dokumentiert" geführt.
  const breathingStates=members.filter(member=>!member.ageDepartment&&isAtmOrAtgQualified(member)).map(member=>({member,state:breathingClearanceState(member,systemToday())}));
  const clearanceLabel={valid:"Gültig bis",soon:"Fällig bis",expired:"Überfällig seit",none:"Nicht dokumentiert"};
  const clearanceTone={valid:"green",soon:"gold",expired:"red",none:"gray"},clearanceOrder={expired:0,none:1,soon:2,valid:3};
  byId("breathingClearanceList").innerHTML=breathingStates.sort((a,b)=>clearanceOrder[a.state]-clearanceOrder[b.state]||nameForTile(a.member).localeCompare(nameForTile(b.member),"de")).map(item=>renderMetric("",nameForTile(item.member),item.state==="none"?clearanceLabel[item.state]:`${clearanceLabel[item.state]} ${breathingClearanceDates(item.member).filter(Boolean).sort()[0]||""}`,clearanceTone[item.state])).join("");
  const rows = probeYearData.flatMap(data => data.rows);
  const eligibleRows = participation.rows;
  const presentRows = eligibleRows.filter(row => row.status === "Anwesend");
  const excusedRows = eligibleRows.filter(row => row.status === "Entschuldigt");
  const missingRows = eligibleRows.filter(row => row.status === "Fehlt");
  const attendanceRate = eligibleRows.length ? (presentRows.length / eligibleRows.length * 100) : null;
  byId("yearAttendanceRate").textContent = attendanceRate === null ? "–" : `${attendanceRate.toFixed(1).replace(".", ",")} %`;
  byId("yearAttendanceDetail").textContent = `${presentRows.length} Anwesenheiten bei ${eligibleRows.length} möglichen Personenteilnahmen`;
  byId("teamStrength").textContent = activeMembers.length;
  byId("teamStrengthDetail").textContent = `Einsatzabteilung`;
  byId("yearProbeCount").textContent = participation.drills.length;
  byId("yearProbeDetail").textContent = `Probe · Sonderprobe · Unterricht`;
  const annualOperationCount=yearData.filter(statisticsIsOperation).length;
  byId("averageAttendance").textContent = annualOperationCount;
  byId("averageAttendanceDetail").textContent = annualOperationCount===1?"Einsatz im gewählten Kalenderjahr":"Einsätze im gewählten Kalenderjahr";
  const ageEligibleEvents=statisticsAgeEvents(probeYearData);
  const ageRows=statisticsAgeRows(probeYearData,ageMembers);
  const agePresentRows = ageRows.filter(row => row.status === "Anwesend");
  const ageExcusedRows = ageRows.filter(row => row.status === "Entschuldigt");
  const ageMissingRows = ageRows.filter(row => row.status === "Fehlt");
  const ageRate = ageRows.length ? agePresentRows.length / ageRows.length * 100 : null;
  byId("ageTeamStrength").textContent = ageMembers.length;
  byId("ageAttendanceRate").textContent = ageRate === null ? "–" : `${ageRate.toFixed(1).replace(".", ",")} %`;
  byId("ageAttendanceDetail").textContent = ageRows.length ? `${agePresentRows.length} anwesend von ${ageRows.length} möglichen Teilnahmen` : "Noch keine Teilnahmen";
  byId("ageAverageAttendance").textContent = ageEligibleEvents.length ? (agePresentRows.length / ageEligibleEvents.length).toFixed(1).replace(".", ",") : "–";
  byId("ageStatusDetail").textContent = `${ageExcusedRows.length} entschuldigt · ${ageMissingRows.length} fehlt`;
  const ageVisits = new Map(ageMembers.map(member => [nameForStorage(member), 0]));
  agePresentRows.forEach(row => { if (ageVisits.has(row.name)) ageVisits.set(row.name, ageVisits.get(row.name) + 1); });
  byId("ageAttendanceRanking").innerHTML = [...ageVisits.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],"de")).map(([name,count],index)=>renderMetric("", `${index+1}. ${name}`, `${count} Teilnahme${count===1?"":"n"}`, count>0?"good":"neutral")).join("");
  byId("ageAttendanceEmpty").hidden = ageMembers.length > 0;
  const dates = yearData.map(data => data.date).filter(Boolean).sort();
  byId("statisticsPeriod").textContent = yearData.length ? `Auswertung ${year}${dates.length ? ` · ${formatDisplayDate(dates[0])}${dates[0]===dates[dates.length-1]?"":` bis ${formatDisplayDate(dates[dates.length-1])}`}` : ""}` : `Noch keine abgeschlossenen Berichte für ${year} geladen.`;

  const memberStats=participation.people;
  const ranked=memberStats.filter(item=>item.count>0).sort((a,b)=>b.percent-a.percent||b.count-a.count||a.name.localeCompare(b.name,"de")).slice(0,5);
  let previousKey="",competitionRank=0;
  ranked.forEach((item,index)=>{const key=`${item.percent.toFixed(6)}|${item.count}`;if(key !== previousKey) competitionRank=index+1;item.rank=competitionRank;previousKey=key;});
  const top=byId("topVisitors");
  top.innerHTML=ranked.map(item=>`<div class="commander-rank-row"><span class="commander-rank-place" aria-label="Platz ${item.rank}">${item.rank}</span><span class="commander-rank-name">${escapeHtml(item.name)}<i class="commander-ranking-track" aria-hidden="true"><i style="width:${item.percent}%"></i></i></span><strong><span>${item.count} / ${item.relevant}</span><small>${item.percent.toFixed(1).replace(".",",")} %</small></strong></div>`).join("");
  byId("topVisitorsEmpty").hidden = ranked.length > 0;

  const targets = getRoleTargets();
  const targetRows = statisticsFunctionTargets(yearData,activeMembers,targets);
  const openTargets = targetRows.filter(item => item.remaining > 0).sort((a,b) => a.name.localeCompare(b.name,"de") || b.remaining-a.remaining || a.role.localeCompare(b.role,"de"));
  const groupedTargets = new Map();
  openTargets.forEach(item => {
    if (!groupedTargets.has(item.name)) groupedTargets.set(item.name, []);
    groupedTargets.get(item.name).push(item);
  });
  const openBox = byId("openFunctions");
  openBox.innerHTML = [...groupedTargets.entries()].map(([name, items]) => {
    const totalRemaining = items.reduce((sum, item) => sum + item.remaining, 0);
    return `<details class="participant-target-card"><summary><div><strong>${escapeHtml(name)}</strong><span>${items.length} offene${items.length === 1 ? "s" : ""} Funktionsziel${items.length === 1 ? "" : "e"}</span></div><b>noch ${totalRemaining}</b><i aria-hidden="true"></i></summary><div class="participant-target-items">${items.map(item => `<div><span>${escapeHtml(item.role)}</span><small>${item.actual} / ${item.target}</small><strong>noch ${item.remaining}</strong></div>`).join("")}</div></details>`;
  }).join("");
  byId("openFunctionsEmpty").hidden = groupedTargets.size > 0;

  const nonOperationYearData=probeYearData.filter(data=>!statisticsIsFellowship(data));
  const types = new Map(); nonOperationYearData.forEach(data => { const type=data.rows[0]?.sessionType || data.item.sessionType || "Unbekannt"; types.set(type,(types.get(type)||0)+1); });
  byId("probeTypes").innerHTML = [...types.entries()].sort((a,b)=>b[1]-a[1]).map(([type,count]) => renderMetric("",type,count,"blue")).join("");
  byId("probeTypesEmpty").hidden = types.size > 0;

  const topics = new Map();
  nonOperationYearData.forEach(data => {
    const topic = String(data.item.topic || data.rows[0]?.topic || "").trim();
    if (topic) topics.set(topic, (topics.get(topic) || 0) + 1);
  });
  byId("probeTopics").innerHTML = [...topics.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],"de")).map(([topic,count]) => renderMetric("",topic,count,"gold")).join("");
  byId("probeTopicsEmpty").hidden = topics.size > 0;
  renderDriverLicenseStatistics();
  renderCommanderStatistics(yearData,participation,targetRows);
  arrangeStatisticsPage();
  renderFellowshipStatistics(yearData);
  ensureCollapsedStatisticsPanels();
  window.SmartWorkflow?.statistics?.();
  if(byId("individualMemberSelect").value)renderIndividualStatistics(byId("individualMemberSelect").value);
}


function ensureDriverLicenseStatisticsPanel(){
  let panel=byId("driverLicenseStatisticsPanel");
  if(panel)return panel;
  const breathing=byId("breathingClearanceList")?.closest("article,.panel");
  if(!breathing)return null;
  panel=document.createElement("article");
  panel.id="driverLicenseStatisticsPanel";
  panel.className="panel statistics-panel driver-license-statistics-panel";
  panel.innerHTML=`<div class="panel-heading"><span class="step yellow">FS</span><h3>Führerscheinkontrollen</h3></div><div class="metric-list" data-driver-list></div>`;
  breathing.insertAdjacentElement("afterend",panel);
  return panel;
}
function renderDriverLicenseStatistics(){
  const panel=ensureDriverLicenseStatisticsPanel();if(!panel)return;
  const items=members.filter(member=>!member.ageDepartment&&Array.isArray(member.machinistVehicles)&&member.machinistVehicles.length).map(member=>({member,state:driverLicenseControlDue(member,systemToday())}));
  const order={overdue:0,missing:1,soon:2,valid:3},tone={overdue:"red",missing:"gray",soon:"gold",valid:"green"};
  panel.querySelector("[data-driver-list]").innerHTML=items.sort((a,b)=>order[a.state]-order[b.state]||nameForTile(a.member).localeCompare(nameForTile(b.member),"de")).map(item=>{const date=driverLicenseDueDate(item.member);const label=item.state==="missing"?"Nicht dokumentiert":item.state==="overdue"?`Überfällig seit ${date}`:item.state==="soon"?`Fällig bis ${date}`:`Gültig bis ${date}`;return renderMetric("",nameForTile(item.member),label,tone[item.state]);}).join("");
}

function exportStatisticsPdf() {
  if(!globalThis.StatisticsPdf){showToast("PDF-Modul ist nicht geladen. Bitte die App aktualisieren.","error");return;}
  renderStatistics({refreshDrinks:false});
  const view=byId("settingsStatisticsView")||byId("statisticsView");
  return StatisticsPdf.open(StatisticsPdf.annual(view,selectedStatisticsYear),`Feuerwehr-Wasser_Statistik_${selectedStatisticsYear}.pdf`);
}

function normalizeStatisticsRole(role) {
  return String(role || "").startsWith("Maschinist") ? "Maschinist" : String(role || "");
}
function populateIndividualMemberSelect() {
  const select = byId("individualMemberSelect");
  const current = select.value;
  const groups=[["Einsatzabteilung",members.filter(member=>!member.ageDepartment)],["Alterskameraden",members.filter(member=>member.ageDepartment)]];
  select.innerHTML = `<option value="">Bitte auswählen</option>${groups.filter(([,items])=>items.length).map(([label,items])=>`<optgroup label="${label}">${items.map(member=>`<option value="${escapeHtml(member.id)}">${escapeHtml(nameForTile(member))}</option>`).join("")}</optgroup>`).join("")}`;
  if (members.some(member => member.id === current)) select.value = current;
}
function ensureIndividualBreathingClearancePanel(){
  const preview=byId("individualStatisticsPreview");
  if(!preview)return null;
  let panel=byId("individualBreathingClearancePanel");
  if(panel)return panel;
  panel=document.createElement("section");
  panel.id="individualBreathingClearancePanel";
  panel.className="individual-statistics-section individual-breathing-clearance-panel";
  panel.innerHTML=`<div class="individual-clearance-heading"><div><h4>Atemschutzfreigabe</h4><p>Die Freigabe wird nur erteilt, wenn alle drei Nachweise gültig sind.</p></div><strong data-individual-clearance-status></strong></div><div class="individual-clearance-grid" data-individual-clearance-items></div>`;
  const operationPanel=byId("individualOperationStatistics");
  if(operationPanel)operationPanel.insertAdjacentElement("afterend",panel);else preview.appendChild(panel);
  return panel;
}
function renderIndividualBreathingClearance(member){
  const panel=ensureIndividualBreathingClearancePanel();if(!panel)return;
  panel.hidden=member.ageDepartment||!isAtmOrAtgQualified(member);if(panel.hidden)return;
  const today=systemToday(),state=breathingClearanceState(member,today),valid=hasValidBreathingClearance(member,today);
  const items=MemberEvidence.breathingAssessment(member,today).items;
  const status=panel.querySelector("[data-individual-clearance-status]");
  status.textContent=valid?"Freigabe erteilt":"Freigabe nicht erteilt";
  status.className=valid?"is-valid":"is-blocked";
  panel.dataset.state=state;
  panel.querySelector("[data-individual-clearance-items]").innerHTML=items.map(item=>{
    const label=item.label,date=item.until,itemState=item.status;
    const text=!date?"Nicht hinterlegt":`${itemState==="expired"?"Abgelaufen":"Gültig bis"} ${formatDisplayDate(date)}`;
    return `<div class="individual-clearance-item ${itemState}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`;
  }).join("");
}
function renderIndividualStatistics(memberId) {
  const preview = byId("individualStatisticsPreview");
  const button = byId("individualStatisticsPdfButton");
  const member = members.find(item => item.id === memberId);
  if (!member) { preview.hidden = true; button.disabled = true; return; }
  const year = selectedStatisticsYear || String(new Date().getFullYear());
  const yearData = statisticsArchiveData().filter(data => data.date.startsWith(year));
  const personalEvents=member.ageDepartment?statisticsAgeEvents(yearData):yearData;
  const rows = member.ageDepartment?statisticsAgeRows(yearData,[member]):yearData.flatMap(data => data.rows).filter(row => statisticsRowMatchesMember(row,member));
  const present = rows.filter(row => row.status === "Anwesend");
  const excused = rows.filter(row => row.status === "Entschuldigt");
  const missing = rows.filter(row => row.status === "Fehlt");
  const total = present.length + excused.length + missing.length;
  const rate = total ? present.length / total * 100 : null;
  byId("individualMemberName").textContent = nameForTile(member);
  renderIndividualBreathingClearance(member);
  byId("individualStatisticsPeriod").textContent = member.ageDepartment?`Altersmannschaft · Kalenderjahr ${year} · ${personalEvents.length} Übungen / Unterricht`:`Kalenderjahr ${year} · ${yearData.filter(data=>(data.rows[0]?.sessionType||data.item.sessionType)!=="Einsatz").length} Übungen / Sitzungen · ${yearData.filter(data=>(data.rows[0]?.sessionType||data.item.sessionType)==="Einsatz").length} Einsätze`;
  byId("individualAttendanceRate").textContent = rate === null ? "–" : `${rate.toFixed(1).replace(".", ",")} %`;
  byId("individualAttendanceDetail").textContent = total ? `${present.length} von ${total} möglichen Teilnahmen` : "Noch keine Daten";
  byId("individualPresentCount").textContent = present.length;
  byId("individualExcusedCount").textContent = excused.length;
  byId("individualMissingCount").textContent = missing.length;

  const usage = new Map();
  if(!member.ageDepartment)present.forEach(row => statisticsRolesFromValue(row.role).forEach(role => usage.set(role,(usage.get(role)||0)+1)));
  const usageRows = [...usage.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],"de"));
  byId("individualRoleUsage").innerHTML = usageRows.length?renderBarChart(usageRows,"Persönliche Funktionsausübungen","#65439b"):"";
  byId("individualRoleUsageEmpty").hidden = usageRows.length > 0;

  const targets = getRoleTargets();
  const targetRows = (member.ageDepartment?[]:getMemberRoles(member)).map(role => ({ role, target: targets[role] || 0, actual: usage.get(role) || 0 })).filter(item => item.target > 0);
  byId("individualRoleTargets").innerHTML = targetRows.map(item => {
    const remaining = Math.max(0, item.target-item.actual);
    const tone = remaining ? "gold" : "green";
    return `<div class="metric-row metric-${tone}"><span>${escapeHtml(item.role)}</span><strong>${item.actual} / ${item.target}${remaining ? ` · noch ${remaining}` : " · erreicht"}</strong></div>`;
  }).join("");
  byId("individualRoleTargetsEmpty").hidden = targetRows.length > 0;

  renderIndividualOperationStatistics(rows);
  ["individualRoleTargets","individualRoleUsage"].forEach(id=>{const section=byId(id)?.closest("section");if(section)section.hidden=Boolean(member.ageDepartment);});
  const operationPanel=byId("individualOperationStatistics");if(operationPanel)operationPanel.hidden=Boolean(member.ageDepartment);

  const types = new Map();
  rows.forEach(row => types.set(row.sessionType || "Unbekannt", (types.get(row.sessionType || "Unbekannt") || 0) + 1));
  byId("individualProbeTypes").innerHTML = types.size?renderDonutChart(statisticsChartEntries(types),"Persönliche Termine nach Art"):"";
  byId("individualProbeTypesEmpty").hidden = types.size > 0;

  const recent = rows
    .filter(row => row.status === "Anwesend" || row.status === "Entschuldigt")
    .sort((a,b) => String(b.date).localeCompare(String(a.date)) || String(b.time).localeCompare(String(a.time)))
    .slice(0,10);
  byId("individualRecentVisits").innerHTML = recent.map(row => `<div class="individual-recent-row"><span>${escapeHtml(formatDisplayDate(row.date))}${row.time ? ` · ${escapeHtml(row.time)}` : ""}</span><strong>${escapeHtml(row.status)}</strong><small>${escapeHtml(row.sessionType || "Probe")}${row.topic ? ` · ${escapeHtml(row.topic)}` : ""}${row.role ? ` · ${escapeHtml(row.role)}` : ""}</small></div>`).join("");
  byId("individualRecentVisitsEmpty").hidden = recent.length > 0;

  preview.hidden = false; button.disabled = false;
}
function exportIndividualStatisticsPdf() {
  const memberId = byId("individualMemberSelect").value;
  const member = members.find(item => item.id === memberId);
  if (!member) return;
  renderIndividualStatistics(memberId);
  if(!globalThis.StatisticsPdf){showToast("PDF-Modul ist nicht geladen. Bitte die App aktualisieren.","error");return;}
  return StatisticsPdf.open(StatisticsPdf.individual(byId("individualStatisticsPreview"),selectedStatisticsYear,nameForTile(member)),`Feuerwehr-Wasser_${nameForTile(member).replace(/[^a-zA-Z0-9ÄÖÜäöüß]+/g,"-")}_Statistik_${selectedStatisticsYear}.pdf`);
}
