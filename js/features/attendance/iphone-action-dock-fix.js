"use strict";
(() => {
  const isIPhoneWidth = () => matchMedia("(max-width: 600px)").matches && (navigator.maxTouchPoints > 0 || "ontouchend" in document);
  let dock = null;
  let scheduled = false;
  const homes = new Map();

  function remember(node) {
    if (node && !homes.has(node)) homes.set(node, { parent: node.parentNode, next: node.nextSibling });
  }

  function restore(node) {
    const home = homes.get(node);
    if (!node || !home?.parent || node.parentNode === home.parent) return;
    if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(node, home.next);
    else home.parent.appendChild(node);
  }

  function ensureDock() {
    if (dock?.isConnected) return dock;
    dock = document.createElement("div");
    dock.id = "iphoneAttendanceActionDock";
    dock.className = "iphone-attendance-action-dock";
    dock.hidden = true;
    dock.setAttribute("aria-label", "Aktionen in Schritt 2");
    document.body.appendChild(dock);
    return dock;
  }

  function inStepTwo() {
    const view = document.getElementById("attendanceView");
    const workspace = document.getElementById("attendanceSelectionWorkspace");
    if (!view || view.hidden || getComputedStyle(view).display === "none") return false;
    return view.classList.contains("workflow-stage-2") || (workspace && !workspace.hidden && getComputedStyle(workspace).display !== "none");
  }

  function sync() {
    scheduled = false;
    const save = document.getElementById("saveButton");
    const step = document.getElementById("step3ActionArea");
    remember(save);
    remember(step);

    if (!isIPhoneWidth()) {
      restore(save);
      restore(step);
      if (dock) dock.hidden = true;
      document.documentElement.classList.remove("iphone-action-dock-active");
      return;
    }

    const target = ensureDock();
    if (save && save.parentNode !== target) target.appendChild(save);
    if (step && step.parentNode !== target) target.appendChild(step);

    const active = inStepTwo();
    target.hidden = !active;
    document.documentElement.classList.toggle("iphone-action-dock-active", active);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener("DOMContentLoaded", schedule, { once: true });
  document.addEventListener("click", schedule, true);
  document.addEventListener("change", schedule, true);
  addEventListener("resize", schedule, { passive: true });
  addEventListener("orientationchange", () => setTimeout(schedule, 150), { passive: true });
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "disabled"] });
})();
