"use strict";
(() => {
  const root=document.documentElement,viewport=window.visualViewport;
  let active=null,host=null,raf=0;
  const isManagedInput=element=>!element?.readOnly&&!element?.disabled&&(
    element instanceof HTMLInputElement&&["text","search","email","tel","url","number","password"].includes(element.type)||element instanceof HTMLTextAreaElement);
  const isPassword=element=>element instanceof HTMLInputElement&&element.type==="password";
  function update(){
    const height=viewport?viewport.height:innerHeight,top=viewport?viewport.offsetTop:0;
    const keyboardHeight=Math.max(0,innerHeight-height-top);
    root.style.setProperty("--ios-visual-height",`${Math.max(120,height)}px`);
    root.style.setProperty("--ios-visual-top",`${Math.max(0,top)}px`);root.style.setProperty("--ios-keyboard-height",`${keyboardHeight}px`);
    document.body.classList.toggle("ios-keyboard-visible",keyboardHeight>120);
    if(!active)return;
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      if(!active?.isConnected)return;
      const bounds=active.getBoundingClientRect(),visibleTop=(viewport?.offsetTop||0)+12,visibleBottom=(viewport?.offsetTop||0)+(viewport?.height||innerHeight)-18;
      if(bounds.top<visibleTop||bounds.bottom>visibleBottom){
        active.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});
        const after=active.getBoundingClientRect();
        const delta=after.bottom>visibleBottom?after.bottom-visibleBottom:after.top<visibleTop?after.top-visibleTop:0;
        if(delta&&!active.closest('dialog'))window.scrollBy({top:delta,behavior:'instant'});
      }
    });
  }
  function open(input){
    active=input;host?.classList.remove("ios-keyboard-host");
    host=input.closest("dialog,[role=dialog],.page-access-gate-critical,.cloud-sync-dialog,.panel")||input.parentElement;
    host?.classList.add("ios-keyboard-host");document.body.classList.toggle("ios-password-keyboard-open",isPassword(input));document.body.classList.toggle("ios-input-keyboard-open",!isPassword(input));
    update();setTimeout(update,80);setTimeout(update,280);setTimeout(update,520);
  }
  function close(){
    setTimeout(()=>{
      if(isManagedInput(document.activeElement))return;
      active=null;host?.classList.remove("ios-keyboard-host");host=null;
      document.body.classList.remove("ios-password-keyboard-open","ios-input-keyboard-open","ios-keyboard-visible");
      root.style.removeProperty("--ios-visual-height");root.style.removeProperty("--ios-visual-top");root.style.removeProperty("--ios-keyboard-height");
    },140);
  }
  document.addEventListener("focusin",event=>{if(isManagedInput(event.target))open(event.target);});
  document.addEventListener("focusout",event=>{if(isManagedInput(event.target))close();});
  // A dialog may close while its textarea still owns focus in Safari.
  document.addEventListener("close",event=>{if(event.target===host){active?.blur();close();}},true);
  viewport?.addEventListener("resize",update,{passive:true});viewport?.addEventListener("scroll",update,{passive:true});
  addEventListener("orientationchange",()=>setTimeout(update,180),{passive:true});
})();
