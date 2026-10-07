let selectedStatisticsYear=String(new Date().getFullYear());
function availableStatisticsYears(){const years=new Set([String(new Date().getFullYear())]);statisticsArchiveData().forEach(data=>{const year=String(data.rows[0]?.date||data.item.createdAt||"").slice(0,4);if(/^\d{4}$/.test(year))years.add(year);});return [...years].sort((a,b)=>b.localeCompare(a));}
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
  if(String(item?.sessionType||"").trim()!=="Einsatz"&&!data)return [];
  const members=[...new Set(Array.isArray(data?.members)?data.members:[])];
  if(!members.length)return statisticsOperationRowsFromCsv(item);
  const date=String(data.date||item.createdAt||"").slice(0,10);
  const time=String(data.times?.alarm||"");
  const topic=[data.type,data.location].filter(Boolean).join(" · ")||item.topic||"Einsatz";
  const assignments=data.assignments||{},roles=data.assignmentRoles||{};
  const atueName=String(data.atuePerson||"").trim();
  return members.map(name=>{
    const normalizedName=String(name||"").trim();
    const role=String(roles[normalizedName]||(atueName&&normalizedName===atueName?"ATÜ":""));
    return {date,time,name:normalizedName,sessionType:"Einsatz",status:"Anwesend",role,topic,vehicle:assignments[normalizedName]||"",operationId:data.id||item.id||""};
  }).filter(row=>row.name);
}
function statisticsOperationLabel(data){
  const structured=String(data?.item?.operationData?.type||"").trim();
  if(structured)return structured;
  const topic=String(data?.item?.topic||data?.rows?.[0]?.topic||"").trim();
  return topic?topic.split(" · ")[0]:"Einsatz";
}

function statisticsIsOperation(data){
  const item=data?.item||data||{};
  const rowType=data?.rows?.[0]?.sessionType||"";
  return Boolean(item.operationData)||String(item.sessionType||"").trim()==="Einsatz"||String(rowType).trim()==="Einsatz";
}
function statisticsArchiveData() {
  return csvArchive.map(item => {
    const operationRows=statisticsOperationRows(item);
    return {item,rows:operationRows.length?operationRows:parseCsvRows(item.content)};
  }).filter(data => data.rows.length);
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
function renderMonthlyColumns(rows,label){
  const types=["Allgemeine Probe","Sonderprobe","Unterricht","Ausschuss Sitzung","Einsatz"],monthly=Object.fromEntries(types.map(type=>[type,Array(12).fill(0)])),seen=new Set();
  rows.forEach(data=>{const date=String(data.rows[0]?.date||data.item.createdAt||""),month=Number(date.slice(5,7))-1;if(month<0||month>11)return;const key=data.item.id||`${date}|${data.item.topic||""}`;if(seen.has(key))return;seen.add(key);const type=data.rows[0]?.sessionType||data.item.sessionType||"Unbekannt";if(!monthly[type])monthly[type]=Array(12).fill(0);monthly[type][month]++;});
  const totals=Array.from({length:12},(_,month)=>Object.values(monthly).reduce((sum,values)=>sum+(values[month]||0),0)),max=Math.max(1,...totals),months=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  const activeTypes=Object.keys(monthly).filter(type=>monthly[type].some(Boolean));
  return `<div class="statistics-monthly-chart" role="img" aria-label="${escapeHtml(label)}"><div class="monthly-columns monthly-stacked-columns">${months.map((month,index)=>`<div class="monthly-group"><div class="monthly-stack" title="${month}: ${totals[index]} Aktivitäten">${activeTypes.map((type,typeIndex)=>monthly[type][index]?`<i style="height:${monthly[type][index]/max*100}%;background:${statisticsTypeColor(type,typeIndex)}"><span class="sr-only">${escapeHtml(type)}: ${monthly[type][index]}</span></i>`:"").join("")}</div><span>${month}</span></div>`).join("")}</div><div class="statistics-inline-legend">${activeTypes.map((type,index)=>`<span><i style="background:${statisticsTypeColor(type,index)}"></i>${escapeHtml(type)}</span>`).join("")}</div></div>`;
}
function ensureStatisticsCharts(){
  const view=byId("settingsStatisticsView")||byId("statisticsView"),grid=view?.querySelector(".statistics-grid");
  if(grid&&!byId("statisticsVisualDashboard")){const panel=document.createElement("article");panel.id="statisticsVisualDashboard";panel.className="panel statistics-panel statistics-visual-dashboard";panel.innerHTML=`<div class="panel-heading"><span class="step blue">D</span><h3>Grafische Jahresübersicht</h3></div><div class="statistics-chart-grid"><section><h4>Übungen und Sitzungen</h4><div data-chart-types></div></section><section class="statistics-operation-chart"><h4>Einsätze</h4><div data-chart-operations></div></section><section class="chart-wide"><h4>Proben je Monat</h4><div data-chart-months></div></section><section class="chart-wide"><h4>Funktionsverteilung</h4><div data-chart-roles></div></section></div>`;grid.prepend(panel);}
  const preview=byId("individualStatisticsPreview");
  if(preview&&!byId("individualVisualDashboard")){const panel=document.createElement("section");panel.id="individualVisualDashboard";panel.className="individual-statistics-section individual-visual-dashboard";panel.innerHTML=`<h4>Grafische Übersicht</h4><div class="statistics-chart-grid"><section><h5>Aktivitäten und Einsätze</h5><div data-individual-chart-types></div></section><section><h5>Funktionen</h5><div data-individual-chart-roles></div></section></div>`;preview.prepend(panel);}
}
function renderStatisticsCharts(yearData,presentRows){
  ensureStatisticsCharts();
  const types=new Map(),operationTypes=new Map(),roles=new Map();yearData.filter(data=>!statisticsIsOperation(data)).forEach(data=>{const type=data.rows[0]?.sessionType||data.item.sessionType||"Unbekannt";types.set(type,(types.get(type)||0)+1);});yearData.filter(statisticsIsOperation).forEach(data=>{const type=statisticsOperationLabel(data);operationTypes.set(type,(operationTypes.get(type)||0)+1);});presentRows.filter(statisticsRoleRelevant).forEach(row=>statisticsRolesFromValue(row.role).forEach(role=>roles.set(role,(roles.get(role)||0)+1)));
  const panel=byId("statisticsVisualDashboard");if(!panel)return;panel.querySelector("[data-chart-types]").innerHTML=renderDonutChart(statisticsChartEntries(types),"Verteilung der Übungen und Sitzungen");panel.querySelector("[data-chart-operations]").innerHTML=renderDonutChart(statisticsChartEntries(operationTypes),"Verteilung der Einsätze");panel.querySelector("[data-chart-months]").innerHTML=renderMonthlyColumns(yearData.filter(data=>!statisticsIsOperation(data)),"Proben und Sitzungen je Monat");panel.querySelector("[data-chart-roles]").innerHTML=renderBarChart(statisticsChartEntries(roles),"Verteilung der Funktionen aus Proben und Einsätzen","#176b36");
}
function renderIndividualStatisticsCharts(rows){
  ensureStatisticsCharts();const types=new Map(),roles=new Map();rows.forEach(row=>{types.set(row.sessionType||"Unbekannt",(types.get(row.sessionType||"Unbekannt")||0)+1);if(statisticsRoleRelevant(row))statisticsRolesFromValue(row.role).forEach(role=>roles.set(role,(roles.get(role)||0)+1));});const panel=byId("individualVisualDashboard");if(!panel)return;panel.querySelector("[data-individual-chart-types]").innerHTML=renderDonutChart(statisticsChartEntries(types),"Persönliche Aktivitäten und Einsätze");panel.querySelector("[data-individual-chart-roles]").innerHTML=renderBarChart(statisticsChartEntries(roles),"Persönliche Funktionsverteilung","#65439b");
}
function ensureOperationStatisticsSections(){
  const view=byId("settingsStatisticsView")||byId("statisticsView");
  const grid=view?.querySelector(".statistics-grid");
  if(grid&&!byId("statisticsOperationSummary")){
    const panel=document.createElement("article");panel.id="statisticsOperationSummary";panel.className="panel statistics-panel operation-statistics-summary";
    panel.innerHTML=`<div class="panel-heading"><span class="step operation-step">E</span><h3>Einsatzstatistik</h3></div><div class="statistics-kpis operation-statistics-kpis"><div><span>Einsätze</span><strong data-operation-count>0</strong></div><div><span>Ø Teilnehmer</span><strong data-operation-participations>0</strong></div><div><span>mit ATÜ</span><strong data-operation-atue>0</strong></div></div><h4>Einsatzarten</h4><div class="metric-list" data-operation-types></div><p class="empty-state" data-operation-empty>Keine Einsätze im gewählten Jahr.</p>`;
    grid.prepend(panel);
  }
  const individual=byId("individualStatisticsPreview");
  if(individual&&!byId("individualOperationStatistics")){
    const panel=document.createElement("section");panel.id="individualOperationStatistics";panel.className="individual-statistics-section individual-operation-statistics";
    panel.innerHTML=`<h4>Persönliche Einsatzstatistik</h4><div class="statistics-kpis"><div><span>Einsätze</span><strong data-individual-operation-count>0</strong></div><div><span>Funktionen</span><strong data-individual-operation-roles>0</strong></div><div><span>ATÜ</span><strong data-individual-operation-atue>0</strong></div></div><div class="metric-list" data-individual-operation-functions></div><p class="empty-state" data-individual-operation-empty>Keine Einsatzteilnahme im gewählten Jahr.</p>`;
    const recent=byId("individualRecentVisits")?.closest(".individual-statistics-section,section");
    if(recent)recent.insertAdjacentElement("beforebegin",panel);else individual.appendChild(panel);
  }
}
function renderSeparatedOperationStatistics(yearData){
  ensureOperationStatisticsSections();
  const operations=yearData.filter(statisticsIsOperation);
  const rows=operations.flatMap(data=>data.rows).filter(row=>row.status==="Anwesend");
  const types=new Map();operations.forEach(data=>{const label=statisticsOperationLabel(data);types.set(label,(types.get(label)||0)+1);});
  const panel=byId("statisticsOperationSummary");if(!panel)return;
  panel.querySelector("[data-operation-count]").textContent=operations.length;
  panel.querySelector("[data-operation-participations]").textContent=operations.length?(rows.length/operations.length).toFixed(1).replace(".",","):"–";
  panel.querySelector("[data-operation-atue]").textContent=operations.filter(data=>data.item.operationData?.atueUsed).length;
  panel.querySelector("[data-operation-types]").innerHTML=[...types.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>renderMetric("",name,count,"red")).join("");
  panel.querySelector("[data-operation-empty]").hidden=operations.length>0;
}
function renderIndividualOperationStatistics(rows){
  ensureOperationStatisticsSections();
  const operations=rows.filter(row=>row.sessionType==="Einsatz"&&row.status==="Anwesend");
  const unique=new Set(operations.map(row=>row.operationId||`${row.date}|${row.topic}`));
  const roles=new Map();operations.forEach(row=>{if(row.role)roles.set(row.role,(roles.get(row.role)||0)+1);});
  const panel=byId("individualOperationStatistics");if(!panel)return;
  panel.querySelector("[data-individual-operation-count]").textContent=unique.size;
  panel.querySelector("[data-individual-operation-roles]").textContent=[...roles.values()].reduce((sum,value)=>sum+value,0);
  panel.querySelector("[data-individual-operation-atue]").textContent=operations.filter(row=>row.role==="ATÜ").length;
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
  summary.innerHTML=`<span>${escapeHtml(title)}</span><small>Antippen zum Öffnen</small><i aria-hidden="true"></i>`;
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
  makeStatisticsPanelCollapsible(breathingPanel,"Atemschutzkontrollen");
  makeStatisticsPanelCollapsible(driverPanel,"Führerscheinkontrollen");
  makeStatisticsPanelCollapsible(openFunctionsPanel,"Offene Funktionsziele");
  if(driverPanel&&openFunctionsPanel&&driverPanel.parentElement){
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
    byId("probeTopics")?.closest("article"),
    byId("statisticsOperationSummary"),
    byId("topVisitors")?.closest("article")
  ].filter(Boolean);
  ordered.forEach(node=>grid.appendChild(node));
}
function renderStatistics() {
  renderStatisticsYearSelect();
  populateIndividualMemberSelect();
  const year = selectedStatisticsYear || String(new Date().getFullYear());
  const all = statisticsArchiveData();
  const yearData = all.filter(data => String(data.rows[0]?.date || data.item.createdAt || "").startsWith(year));
  const probeYearData=yearData.filter(data=>!statisticsIsOperation(data)),allYearRows=probeYearData.flatMap(data=>data.rows),presentYearRows=allYearRows.filter(row=>row.status==="Anwesend"),assignmentTotal=statisticsAssignmentCount(presentYearRows),changedRows=presentYearRows.filter(row=>/2\. Füllung:/.test(row.role||""));
  renderSeparatedOperationStatistics(yearData);
  renderStatisticsCharts(yearData,yearData.flatMap(data=>data.rows).filter(row=>row.status==="Anwesend"));
  const activeMembers = members.filter(member => !member.ageDepartment);
  const ageMembers = members.filter(member => member.ageDepartment);
  // In der AS-Statistik nur Personen anzeigen, bei denen Atemschutz
  // tatsächlich hinterlegt beziehungsweise vorgesehen ist. Nicht eingesetzte
  // Personen ohne Atemschutzbezug werden nicht als "nicht dokumentiert" geführt.
  const breathingStates=members.filter(member=>!member.ageDepartment&&isAtmOrAtgQualified(member)).map(member=>({member,state:breathingClearanceState(member,systemToday())}));
  const bcCounts=Object.fromEntries(["valid","soon","expired","none"].map(state=>[state,breathingStates.filter(item=>item.state===state).length]));
  byId("breathingValidCount").textContent=bcCounts.valid;byId("breathingSoonCount").textContent=bcCounts.soon;byId("breathingExpiredCount").textContent=bcCounts.expired;byId("breathingNoneCount").textContent=bcCounts.none;
  const clearanceLabel={valid:"Gültig bis",soon:"Fällig bis",expired:"Überfällig seit",none:"Nicht dokumentiert"};
  const clearanceTone={valid:"green",soon:"gold",expired:"red",none:"gray"},clearanceOrder={expired:0,none:1,soon:2,valid:3};
  byId("breathingClearanceList").innerHTML=breathingStates.sort((a,b)=>clearanceOrder[a.state]-clearanceOrder[b.state]||nameForTile(a.member).localeCompare(nameForTile(b.member),"de")).map(item=>renderMetric("",nameForTile(item.member),item.state==="none"?clearanceLabel[item.state]:`${clearanceLabel[item.state]} ${item.member.breathingClearanceUntil}`,clearanceTone[item.state])).join("");
  const rows = probeYearData.flatMap(data => data.rows);
  const eligibleRows = rows.filter(row => row.status !== "Betrifft nicht" && activeMembers.some(member => nameForStorage(member) === row.name || nameForTile(member) === row.name));
  const presentRows = eligibleRows.filter(row => row.status === "Anwesend");
  const excusedRows = eligibleRows.filter(row => row.status === "Entschuldigt");
  const missingRows = eligibleRows.filter(row => row.status === "Fehlt");
  const attendanceRate = eligibleRows.length ? (presentRows.length / eligibleRows.length * 100) : null;
  byId("yearAttendanceRate").textContent = attendanceRate === null ? "–" : `${attendanceRate.toFixed(1).replace(".", ",")} %`;
  byId("yearAttendanceDetail").textContent = `${presentRows.length} Anwesenheiten bei ${eligibleRows.length} möglichen Personenteilnahmen`;
  byId("teamStrength").textContent = activeMembers.length;
  byId("teamStrengthDetail").textContent = `${activeMembers.length} aktive Mitglieder`;
  byId("yearProbeCount").textContent = probeYearData.length;
  byId("yearProbeDetail").textContent = `${probeYearData.length} Proben / Sitzungen · ${yearData.filter(statisticsIsOperation).length} Einsätze separat`;
  const annualOperationCount=yearData.filter(statisticsIsOperation).length;
  byId("averageAttendance").textContent = annualOperationCount;
  byId("averageAttendanceDetail").textContent = annualOperationCount===1?"Einsatz im gewählten Kalenderjahr":"Einsätze im gewählten Kalenderjahr";
  const ageEligibleEvents=probeYearData.filter(data=>{
    const type=data.rows[0]?.sessionType||data.item.sessionType||"";
    return type!=="Einsatz"&&type!=="Ausschuss Sitzung";
  });
  const ageRows=ageEligibleEvents.flatMap(data=>{
    const date=data.rows[0]?.date||String(data.item.createdAt||"").slice(0,10),type=data.rows[0]?.sessionType||data.item.sessionType||"";
    return ageMembers.map(member=>{
      const names=[nameForStorage(member),nameForTile(member)];
      const existing=data.rows.find(row=>names.includes(row.name));
      if(existing&&existing.status!=="Betrifft nicht")return existing;
      return {date,time:"",name:nameForStorage(member),sessionType:type,status:"Fehlt",role:"",topic:data.item.topic||data.rows[0]?.topic||""};
    });
  });
  const agePresentRows = ageRows.filter(row => row.status === "Anwesend");
  const ageExcusedRows = ageRows.filter(row => row.status === "Entschuldigt");
  const ageMissingRows = ageRows.filter(row => row.status === "Fehlt");
  const ageRate = ageRows.length ? agePresentRows.length / ageRows.length * 100 : null;
  byId("ageTeamStrength").textContent = ageMembers.length;
  byId("ageAttendanceRate").textContent = ageRate === null ? "–" : `${ageRate.toFixed(1).replace(".", ",")} %`;
  byId("ageAttendanceDetail").textContent = ageRows.length ? `${agePresentRows.length} anwesend von ${ageRows.length} möglichen Teilnahmen` : "Noch keine Teilnahmen";
  byId("ageAverageAttendance").textContent = ageEligibleEvents.length ? (agePresentRows.length / ageEligibleEvents.length).toFixed(1).replace(".", ",") : "–";
  byId("agePresentCount").textContent = ageEligibleEvents.length ? (agePresentRows.length / ageEligibleEvents.length).toFixed(1).replace(".", ",") : "–";
  byId("ageStatusDetail").textContent = `${ageExcusedRows.length} entschuldigt · ${ageMissingRows.length} fehlt`;
  const ageVisits = new Map(ageMembers.map(member => [nameForStorage(member), 0]));
  agePresentRows.forEach(row => { if (ageVisits.has(row.name)) ageVisits.set(row.name, ageVisits.get(row.name) + 1); });
  byId("ageAttendanceRanking").innerHTML = [...ageVisits.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],"de")).map(([name,count],index)=>renderMetric("", `${index+1}. ${name}`, `${count} Teilnahme${count===1?"":"n"}`, count>0?"good":"neutral")).join("");
  byId("ageAttendanceEmpty").hidden = ageMembers.length > 0;
  const dates = probeYearData.map(data => data.rows[0]?.date).filter(Boolean).sort();
  byId("statisticsPeriod").textContent = probeYearData.length ? `Auswertung ${year}${dates.length ? ` · ${dates[0]} bis ${dates[dates.length - 1]}` : ""}` : `Noch kein abgeschlossener Termin für ${year} im lokalen Archiv.`;

  const memberStats=activeMembers.map(member=>{
    const names=new Set([nameForStorage(member),nameForTile(member)]);
    const personalRows=rows.filter(row=>names.has(row.name));
    const relevant=personalRows.filter(row=>row.status !== "Betrifft nicht");
    const present=relevant.filter(row=>row.status === "Anwesend");
    const organization=present.filter(row=>row.role === "Orga").length;
    return {name:nameForStorage(member),count:present.length,relevant:relevant.length,organization,operational:present.length-organization,percent:relevant.length?present.length/relevant.length*100:0};
  });
  const ranked=memberStats.filter(item=>item.count>0).sort((a,b)=>b.percent-a.percent||b.count-a.count||a.name.localeCompare(b.name,"de")).slice(0,5);
  let previousKey="",competitionRank=0;
  ranked.forEach((item,index)=>{const key=`${item.percent.toFixed(6)}|${item.count}`;if(key !== previousKey) competitionRank=index+1;item.rank=competitionRank;previousKey=key;});
  const medals={1:"🥇",2:"🥈",3:"🥉"},medalClasses={1:"ranking-gold",2:"ranking-silver",3:"ranking-bronze"};
  const top=byId("topVisitors");
  top.innerHTML=ranked.map(item=>{const pc=`${item.percent.toFixed(1).replace(".",",")} %`;const medal=medals[item.rank]?`<span class="ranking-trophy ${medalClasses[item.rank]}" aria-label="Platz ${item.rank}">${medals[item.rank]}</span>`:"";return `<div class="ranking-row ${medalClasses[item.rank]||""}"><span class="ranking-position">${item.rank}</span>${medal}<span class="ranking-name">${escapeHtml(item.name)}<small>Teilnahme ${item.operational} · Orga ${item.organization}</small></span><strong><span>${item.count} / ${item.relevant}</span><small>${pc} der betreffenden Proben</small></strong></div>`;}).join("");
  byId("topVisitorsEmpty").hidden = ranked.length > 0;

  const targets = getRoleTargets();
  const actualCounts = new Map();
  presentRows.forEach(row => statisticsRolesFromValue(row.role).forEach(role => {
    const key = `${row.name}|||${role}`;
    actualCounts.set(key, (actualCounts.get(key) || 0) + 1);
  }));
  const targetRows = [];
  activeMembers.forEach(member => {
    const name = nameForStorage(member);
    getMemberRoles(member).forEach(role => {
      const target = targets[role] || 0;
      if (target <= 0) return;
      const actual = actualCounts.get(`${name}|||${role}`) || 0;
      const remaining = Math.max(0, target - actual);
      targetRows.push({ name, role, target, actual, remaining });
    });
  });
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

  const nonOperationYearData=probeYearData;
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
  arrangeStatisticsPage();
  ensureCollapsedStatisticsPanels();
  window.SmartWorkflow?.statistics?.();
}


function ensureDriverLicenseStatisticsPanel(){
  let panel=byId("driverLicenseStatisticsPanel");
  if(panel)return panel;
  const breathing=byId("breathingClearanceList")?.closest("article,.panel");
  if(!breathing)return null;
  panel=document.createElement("article");
  panel.id="driverLicenseStatisticsPanel";
  panel.className="panel statistics-panel driver-license-statistics-panel";
  panel.innerHTML=`<div class="panel-heading"><span class="step yellow">FS</span><h3>Führerscheinkontrollen</h3></div><div class="statistics-kpis"><div><span>Gültig</span><strong data-driver-valid>0</strong></div><div><span>Bald fällig</span><strong data-driver-soon>0</strong></div><div><span>Überfällig</span><strong data-driver-overdue>0</strong></div><div><span>Nicht dokumentiert</span><strong data-driver-missing>0</strong></div></div><div class="metric-list" data-driver-list></div>`;
  breathing.insertAdjacentElement("afterend",panel);
  return panel;
}
function renderDriverLicenseStatistics(){
  const panel=ensureDriverLicenseStatisticsPanel();if(!panel)return;
  const items=members.filter(member=>!member.ageDepartment&&Array.isArray(member.machinistVehicles)&&member.machinistVehicles.length).map(member=>({member,state:driverLicenseControlDue(member,systemToday())}));
  const count=state=>items.filter(item=>item.state===state).length;
  panel.querySelector("[data-driver-valid]").textContent=count("valid");
  panel.querySelector("[data-driver-soon]").textContent=count("soon");
  panel.querySelector("[data-driver-overdue]").textContent=count("overdue");
  panel.querySelector("[data-driver-missing]").textContent=count("missing");
  const order={overdue:0,missing:1,soon:2,valid:3},tone={overdue:"red",missing:"gray",soon:"gold",valid:"green"};
  panel.querySelector("[data-driver-list]").innerHTML=items.sort((a,b)=>order[a.state]-order[b.state]||nameForTile(a.member).localeCompare(nameForTile(b.member),"de")).map(item=>{const date=driverLicenseDueDate(item.member);const label=item.state==="missing"?"Nicht dokumentiert":item.state==="overdue"?`Überfällig seit ${date}`:item.state==="soon"?`Fällig bis ${date}`:`Gültig bis ${date}`;return renderMetric("",nameForTile(item.member),label,tone[item.state]);}).join("");
}

function exportStatisticsPdf() {
  renderStatistics();
  const originalTitle = document.title;
  const year = selectedStatisticsYear;
  document.title = `Feuerwehr-Wasser_Statistik_${year}`;
  document.body.classList.add("printing-statistics");
  const cleanup = () => {
    document.body.classList.remove("printing-statistics");
    document.title = originalTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);
  }, 100);
}

function normalizeStatisticsRole(role) {
  return String(role || "").startsWith("Maschinist") ? "Maschinist" : String(role || "");
}
function populateIndividualMemberSelect() {
  const select = byId("individualMemberSelect");
  const current = select.value;
  const activeMembers = members.filter(member => !member.ageDepartment);
  select.innerHTML = `<option value="">Bitte auswählen</option>${activeMembers.map(member => `<option value="${escapeHtml(member.id)}">${escapeHtml(nameForTile(member))}</option>`).join("")}`;
  if (activeMembers.some(member => member.id === current)) select.value = current;
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
  panel.hidden=!isAtmOrAtgQualified(member);if(panel.hidden)return;
  const today=systemToday(),state=breathingClearanceState(member,today),valid=hasValidBreathingClearance(member,today);
  const items=[
    ["G26.3",member.g263ValidUntil||member.breathingClearanceUntil||""],
    ["Unterweisung AGT",member.agtInstructionValidUntil||""],
    ["FFI",member.ffiValidUntil||""]
  ];
  const status=panel.querySelector("[data-individual-clearance-status]");
  status.textContent=valid?"Freigabe erteilt":"Freigabe nicht erteilt";
  status.className=valid?"is-valid":"is-blocked";
  panel.dataset.state=state;
  panel.querySelector("[data-individual-clearance-items]").innerHTML=items.map(([label,date])=>{
    const itemState=!date?"missing":date<today?"expired":date<=new Date(new Date(today+"T12:00:00").setDate(new Date(today+"T12:00:00").getDate()+60)).toLocaleDateString("sv-SE")?"soon":"valid";
    const text=!date?"Nicht hinterlegt":`${itemState==="expired"?"Abgelaufen":"Gültig bis"} ${formatDisplayDate(date)}`;
    return `<div class="individual-clearance-item ${itemState}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`;
  }).join("");
}
function renderIndividualStatistics(memberId) {
  const preview = byId("individualStatisticsPreview");
  const button = byId("individualStatisticsPdfButton");
  const member = members.find(item => item.id === memberId && !item.ageDepartment);
  if (!member) { preview.hidden = true; button.disabled = true; return; }
  const year = selectedStatisticsYear || String(new Date().getFullYear());
  const yearData = statisticsArchiveData().filter(data => String(data.rows[0]?.date || data.item.createdAt || "").startsWith(year));
  const names = new Set([nameForStorage(member), nameForTile(member)]);
  const rows = yearData.flatMap(data => data.rows).filter(row => names.has(row.name));
  const present = rows.filter(row => row.status === "Anwesend");
  const excused = rows.filter(row => row.status === "Entschuldigt");
  const missing = rows.filter(row => row.status === "Fehlt");
  const total = present.length + excused.length + missing.length;
  const rate = total ? present.length / total * 100 : null;
  byId("individualMemberName").textContent = nameForTile(member);
  renderIndividualBreathingClearance(member);
  byId("individualStatisticsPeriod").textContent = `Kalenderjahr ${year} · ${yearData.filter(data=>(data.rows[0]?.sessionType||data.item.sessionType)!=="Einsatz").length} Übungen / Sitzungen · ${yearData.filter(data=>(data.rows[0]?.sessionType||data.item.sessionType)==="Einsatz").length} Einsätze`;
  byId("individualAttendanceRate").textContent = rate === null ? "–" : `${rate.toFixed(1).replace(".", ",")} %`;
  byId("individualAttendanceDetail").textContent = total ? `${present.length} von ${total} möglichen Teilnahmen` : "Noch keine Daten";
  byId("individualPresentCount").textContent = present.length;
  byId("individualExcusedCount").textContent = excused.length;
  byId("individualMissingCount").textContent = missing.length;

  const usage = new Map();
  present.forEach(row => statisticsRolesFromValue(row.role).forEach(role => usage.set(role,(usage.get(role)||0)+1)));
  const usageRows = [...usage.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],"de"));
  byId("individualRoleUsage").innerHTML = usageRows.map(([role,count]) => renderMetric("",role,count,"blue")).join("");
  byId("individualRoleUsageEmpty").hidden = usageRows.length > 0;

  const targets = getRoleTargets();
  const targetRows = getMemberRoles(member).map(role => ({ role, target: targets[role] || 0, actual: usage.get(role) || 0 })).filter(item => item.target > 0);
  byId("individualRoleTargets").innerHTML = targetRows.map(item => {
    const remaining = Math.max(0, item.target-item.actual);
    const tone = remaining ? "gold" : "green";
    return `<div class="metric-row metric-${tone}"><span>${escapeHtml(item.role)}</span><strong>${item.actual} / ${item.target}${remaining ? ` · noch ${remaining}` : " · erreicht"}</strong></div>`;
  }).join("");
  byId("individualRoleTargetsEmpty").hidden = targetRows.length > 0;

  renderIndividualOperationStatistics(rows);
  renderIndividualStatisticsCharts(rows);

  const types = new Map();
  rows.forEach(row => types.set(row.sessionType || "Unbekannt", (types.get(row.sessionType || "Unbekannt") || 0) + 1));
  byId("individualProbeTypes").innerHTML = [...types.entries()].sort((a,b)=>b[1]-a[1]).map(([type,count]) => renderMetric("",type,count,"blue")).join("");
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
  const originalTitle = document.title;
  document.title = `Feuerwehr-Wasser_${nameForTile(member).replace(/[^a-zA-Z0-9ÄÖÜäöüß]+/g,"-")}_Statistik_${selectedStatisticsYear}`;
  document.body.classList.add("printing-individual-statistics");
  const cleanup = () => { document.body.classList.remove("printing-individual-statistics"); document.title = originalTitle; window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => { window.print(); setTimeout(cleanup,1500); },100);
}
