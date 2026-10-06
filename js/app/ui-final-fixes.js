(() => {
  "use strict";
  const hideDateDeleteButtons = root => {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("button,input[type='button'],input[type='submit'],a[role='button']").forEach(element => {
      const label = String(element.textContent || element.value || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (label === "datum löschen" || label === "datum loeschen") {
        element.hidden = true;
        element.setAttribute("aria-hidden", "true");
        element.tabIndex = -1;
        element.classList.add("date-delete-control-hidden");
      }
    });
  };
  const start = () => {
    hideDateDeleteButtons(document);
    let scheduled = false;
    const observer = new MutationObserver(records => {
      if (scheduled) return;
      if (!records.some(record => record.addedNodes.length)) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        hideDateDeleteButtons(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
