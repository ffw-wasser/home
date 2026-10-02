(function(){
  "use strict";
  const roleTypes=new Set(["Allgemeine Probe","Einsatz"]);
  const relevant=row=>roleTypes.has(String(row?.sessionType||"").trim());

  if(typeof globalThis.statisticsAssignmentCount==="function"){
    const original=globalThis.statisticsAssignmentCount;
    globalThis.statisticsAssignmentCount=rows=>original((rows||[]).filter(relevant));
  }
  if(typeof globalThis.renderStatisticsCharts==="function"){
    const original=globalThis.renderStatisticsCharts;
    globalThis.renderStatisticsCharts=function(yearData,presentRows){
      return original.call(this,yearData,(presentRows||[]).filter(relevant));
    };
  }
  if(typeof globalThis.renderIndividualStatisticsCharts==="function"){
    const original=globalThis.renderIndividualStatisticsCharts;
    globalThis.renderIndividualStatisticsCharts=function(rows){
      return original.call(this,(rows||[]).filter(row=>!row?.role||relevant(row)));
    };
  }
  globalThis.statisticsRoleDataIsRelevant=relevant;

  function updateQualityExplanation(){
    const view=document.getElementById("settingsStatisticsView")||document.getElementById("statisticsView");
    if(!view)return;
    const candidates=[...view.querySelectorAll("h3,h4,summary span")];
    const heading=candidates.find(node=>/datenqualität/i.test(node.textContent||""));
    const panel=heading?.closest("article,.panel,details");
    if(!panel||panel.querySelector(".role-quality-scope-note"))return;
    const note=document.createElement("p");
    note.className="help-text role-quality-scope-note";
    note.textContent="Funktionsangaben werden nur bei Allgemeiner Probe und Einsatz bewertet. Unterricht, Sonderprobe und Ausschusssitzung besitzen keine auswertbare Teilnehmerfunktion.";
    const body=panel.querySelector(".statistics-collapsible-body")||panel;
    body.prepend(note);
  }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(updateQualityExplanation,100));
  document.addEventListener("click",event=>{
    if(event.target.closest("#settingsStatisticsView,#statisticsView"))setTimeout(updateQualityExplanation,50);
  });
})();
