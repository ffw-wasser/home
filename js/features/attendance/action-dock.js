"use strict";
// One owner moves the original actions between the page and the device dock.
(() => {
  const homes = new Map(), docks = new Map();
  let scheduled = false;
  function layout() {
    const touch = navigator.maxTouchPoints > 0 || "ontouchend" in document;
    if (touch && matchMedia("(max-width: 600px)").matches) return "iphone";
    const tablet = navigator.maxTouchPoints > 1;
    const ipad = /iPad/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && tablet);
    return tablet && (ipad || (innerWidth >= 700 && innerWidth <= 1400)) ? "ipad" : "";
  }
  function remember(node) {
    if (node?.parentNode && !homes.has(node)) homes.set(node, {parent: node.parentNode, next: node.nextSibling});
  }
  function restore(node) {
    const home = homes.get(node);
    if (!home || node.parentNode === home.parent) return;
    if (home.next?.parentNode === home.parent) home.parent.insertBefore(node, home.next);
    else home.parent.appendChild(node);
  }
  function dockFor(mode) {
    let dock = docks.get(mode);
    if (dock?.isConnected) return dock;
    dock = document.createElement("div");
    dock.id = mode + "AttendanceActionDock";
    if (mode === "iphone") dock.className = "iphone-attendance-action-dock";
    dock.hidden = true;
    dock.setAttribute("aria-label", "Aktionen zur Anwesenheit");
    document.body.appendChild(dock);docks.set(mode, dock);
    return dock;
  }
  function setActive(mode, active) {
    const dock = docks.get(mode);
    if (dock && dock.hidden === active) dock.hidden = !active;
    const name = mode === "iphone" ? "iphone-action-dock-active" : "ipad-attendance-dock-active";
    const classes = document.documentElement.classList;
    if (classes.contains(name) !== active) classes.toggle(name, active);
  }
  function sync() {
    scheduled = false;
    const actions = [document.getElementById("saveButton"), document.getElementById("step3ActionArea")].filter(Boolean);
    actions.forEach(remember);
    const mode = layout(), view = document.getElementById("attendanceView"), workspace = document.getElementById("attendanceSelectionWorkspace");
    const visible = view && !view.hidden && getComputedStyle(view).display !== "none";
    const inStepTwo = visible && (view.classList.contains("workflow-stage-2") || (mode === "iphone" && workspace && !workspace.hidden && getComputedStyle(workspace).display !== "none"));
    if (mode) {
      const dock = dockFor(mode);
      actions.forEach(node => {if (node.parentNode !== dock) dock.appendChild(node);});
    } else actions.forEach(restore);
    for (const device of ["iphone", "ipad"]) setActive(device, device === mode && Boolean(inStepTwo));
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;requestAnimationFrame(sync);
  }
  document.addEventListener("DOMContentLoaded", schedule, {once: true});
  document.addEventListener("attendance:updated", schedule);
  document.addEventListener("click", schedule, true);
  document.addEventListener("change", schedule, true);
  addEventListener("resize", schedule, {passive: true});
  addEventListener("orientationchange", () => setTimeout(schedule, 150), {passive: true});
  new MutationObserver(schedule).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "disabled"]});
  if (document.readyState !== "loading") schedule();
})();
