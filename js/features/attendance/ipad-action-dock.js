(() => {
  const isIPadLayout = () => {
    const touch = navigator.maxTouchPoints > 1;
    const ipadUA = /iPad/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && touch);
    return touch && (ipadUA || (innerWidth >= 700 && innerWidth <= 1400));
  };

  let dock = null;
  let saveHome = null;
  let stepHome = null;
  let scheduled = false;


  function ensureDock() {
    if (dock?.isConnected) return dock;
    dock = document.createElement("div");
    dock.id = "ipadAttendanceActionDock";
    dock.hidden = true;
    dock.setAttribute("aria-label", "Aktionen zur Anwesenheit");
    document.body.appendChild(dock);
    return dock;
  }

  function rememberHomes(saveButton, stepArea) {
    if (!saveHome && saveButton?.parentNode) saveHome = { parent: saveButton.parentNode, next: saveButton.nextSibling };
    if (!stepHome && stepArea?.parentNode) stepHome = { parent: stepArea.parentNode, next: stepArea.nextSibling };
  }

  function restoreNode(node, home) {
    if (!node || !home?.parent || node.parentNode === home.parent) return;
    if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(node, home.next);
    else home.parent.appendChild(node);
  }

  function setActive(active) {
    if (dock && dock.hidden === active) dock.hidden = !active;
    const root = document.documentElement;
    if (root.classList.contains("ipad-attendance-dock-active") !== active) {
      root.classList.toggle("ipad-attendance-dock-active", active);
    }
  }

  function syncDock() {
    scheduled = false;
    const saveButton = document.getElementById("saveButton");
    const stepArea = document.getElementById("step3ActionArea");
    rememberHomes(saveButton, stepArea);

    const attendanceView = document.getElementById("attendanceView");
    const inStepTwo = Boolean(
      attendanceView &&
      attendanceView.classList.contains("workflow-stage-2") &&
      !attendanceView.hidden &&
      getComputedStyle(attendanceView).display !== "none"
    );

    if (!isIPadLayout()) {
      restoreNode(saveButton, saveHome);
      restoreNode(stepArea, stepHome);
      setActive(false);
      return;
    }

    const target = ensureDock();
    if (saveButton && saveButton.parentNode !== target) target.appendChild(saveButton);
    if (stepArea && stepArea.parentNode !== target) target.appendChild(stepArea);
    setActive(inStepTwo);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncDock);
  }

  addEventListener("resize", scheduleSync, { passive: true });
  addEventListener("orientationchange", () => setTimeout(scheduleSync, 150), { passive: true });
  document.addEventListener("DOMContentLoaded", scheduleSync, { once: true });
  document.addEventListener("attendance:updated", scheduleSync);
  new MutationObserver(scheduleSync).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});
})();
