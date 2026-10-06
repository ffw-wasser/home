"use strict";
(()=>{
  const root=document.documentElement;
  const isPassword=el=>el instanceof HTMLInputElement&&el.type==="password";
  const viewport=window.visualViewport;
  let active=null;
  function update(){
    const height=viewport?viewport.height:window.innerHeight;
    const top=viewport?viewport.offsetTop:0;
    root.style.setProperty("--ios-visual-height",`${Math.max(320,height)}px`);
    root.style.setProperty("--ios-visual-top",`${Math.max(0,top)}px`);
    if(!active)return;
    requestAnimationFrame(()=>active?.scrollIntoView({block:"center",inline:"nearest",behavior:"smooth"}));
  }
  function focusPassword(input){
    active=input;
    document.body.classList.add("ios-password-keyboard-open");
    const host=input.closest("dialog,[role=dialog],.page-access-gate-critical,.cloud-sync-dialog,.panel")||input.parentElement;
    host?.classList.add("ios-keyboard-host");
    update();
    setTimeout(update,80);
    setTimeout(update,320);
  }
  function blurPassword(input){
    setTimeout(()=>{
      if(isPassword(document.activeElement))return;
      active=null;
      document.body.classList.remove("ios-password-keyboard-open");
      input.closest(".ios-keyboard-host")?.classList.remove("ios-keyboard-host");
      root.style.removeProperty("--ios-visual-height");
      root.style.removeProperty("--ios-visual-top");
    },120);
  }
  document.addEventListener("focusin",e=>{if(isPassword(e.target))focusPassword(e.target);});
  document.addEventListener("focusout",e=>{if(isPassword(e.target))blurPassword(e.target);});
  viewport?.addEventListener("resize",update);
  viewport?.addEventListener("scroll",update);
})();
