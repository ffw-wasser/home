(function(){
  "use strict";
  const KEY="fw_v1_color_mode";
  const root=document.documentElement;
  function preferred(){
    const saved=localStorage.getItem(KEY);
    if(saved==="dark"||saved==="light")return saved;
    return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  }
  function apply(mode){
    root.dataset.theme=mode;
    root.style.colorScheme=mode;
    const button=document.getElementById("colorModeToggle");
    if(button){button.textContent=mode==="dark"?"☀ Heller Modus":"◐ Dark Mode";button.setAttribute("aria-pressed",String(mode==="dark"));}
  }
  function install(){
    apply(preferred());
    if(document.getElementById("colorModeToggle"))return;
    const button=document.createElement("button");
    button.id="colorModeToggle";button.type="button";button.className="color-mode-toggle";
    button.setAttribute("aria-label","Darstellung zwischen hellem und dunklem Modus wechseln");
    button.addEventListener("click",()=>{const mode=root.dataset.theme==="dark"?"light":"dark";localStorage.setItem(KEY,mode);apply(mode);});
    document.body.appendChild(button);apply(root.dataset.theme||preferred());
  }
  document.addEventListener("DOMContentLoaded",install);
  if(document.readyState!=="loading")install();
})();
