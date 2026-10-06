(function(){
  "use strict";
  let pendingType="";
  function byId(id){return document.getElementById(id)}
  function ensureContinueButton(){
    const panel=document.querySelector("#attendanceView .home-session-type-panel");
    const types=byId("sessionTypes");
    if(!panel||!types||byId("continueToAttendanceButton"))return;
    const button=document.createElement("button");
    button.id="continueToAttendanceButton";
    button.type="button";
    button.className="primary-button session-continue-button";
    button.textContent="Weiter mit Schritt 2";
    button.disabled=true;
    panel.appendChild(button);
    button.addEventListener("click",function(){
      if(!pendingType)return;
      if(typeof globalThis.chooseSessionType==="function") globalThis.chooseSessionType(pendingType);
      else {
        globalThis.sessionType=pendingType;
        if(typeof globalThis.setHomeFlowStage==="function") globalThis.setHomeFlowStage(2);
        globalThis.renderMembers?.(); globalThis.renderEntries?.(); globalThis.updateSelection?.();
      }
    });
  }
  function selectOnly(button){
    pendingType=button.dataset.sessionType||button.textContent.trim();
    document.querySelectorAll("#sessionTypes [data-session-type]").forEach(function(item){
      const on=item===button; item.classList.toggle("selected",on); item.setAttribute("aria-pressed",String(on));
    });
    const hint=byId("sessionHint"); if(hint)hint.textContent=pendingType+" ausgewählt. Mit dem Button zu Schritt 2 wechseln.";
    const next=byId("continueToAttendanceButton"); if(next){next.disabled=false;next.textContent="Weiter mit Schritt 2: "+pendingType;}
  }
  document.addEventListener("click",function(event){
    const typeButton=event.target.closest("#sessionTypes [data-session-type]");
    if(typeButton){event.preventDefault();event.stopImmediatePropagation();selectOnly(typeButton);return;}
    const step3=event.target.closest("#exportResetButton, #step3ActionArea button");
    if(step3 && globalThis.pendingMemberStatuses?.size && typeof globalThis.commitPendingMemberStatuses==="function"){
      globalThis.commitPendingMemberStatuses();
      globalThis.renderEntries?.(); globalThis.renderMembers?.(); globalThis.updateSelection?.();
    }
  },true);
  function init(){
    ensureContinueButton();
    const workspace=byId("attendanceSelectionWorkspace");
    if(typeof globalThis.setHomeFlowStage==="function")globalThis.setHomeFlowStage(1);
    else if(workspace){workspace.hidden=true;workspace.style.display="none";}
    document.querySelectorAll("#sessionTypes [data-session-type]").forEach(function(b){b.classList.remove("selected");b.setAttribute("aria-pressed","false")});
    const hint=byId("sessionHint");if(hint)hint.textContent="Terminart auswählen und anschließend mit dem Button zu Schritt 2 wechseln.";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
