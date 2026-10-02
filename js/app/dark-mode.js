(function(){
  "use strict";
  const KEY="fw_v2_color_mode";
  const root=document.documentElement;
  function systemMode(){return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
  function preferred(){const saved=localStorage.getItem(KEY);return saved==="dark"||saved==="light"?saved:systemMode();}
  function apply(mode){
    root.dataset.theme=mode;root.style.colorScheme=mode;
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=mode==="dark"?"#111b20":"#c80000";
    const button=document.getElementById("colorModeToggle");
    if(button){const dark=mode==="dark";button.textContent=dark?"☀ Heller Modus":"◐ Dunkler Modus";button.setAttribute("aria-pressed",String(dark));button.title=dark?"Hellen Modus aktivieren":"Dunklen Modus aktivieren";}
  }
  function install(){
    apply(preferred());
    let button=document.getElementById("colorModeToggle");
    if(!button){button=document.createElement("button");button.id="colorModeToggle";button.type="button";button.className="color-mode-toggle";button.setAttribute("aria-label","Farbschema wechseln");button.addEventListener("click",()=>{const next=root.dataset.theme==="dark"?"light":"dark";localStorage.setItem(KEY,next);apply(next);});document.body.appendChild(button);}
    apply(root.dataset.theme||preferred());
  }
  apply(preferred());
  document.addEventListener("DOMContentLoaded",install,{once:true});
  if(document.readyState!=="loading")install();
})();
