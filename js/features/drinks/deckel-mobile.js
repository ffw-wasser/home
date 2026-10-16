/* Separate portal screens. Personal credentials remain in the URL fragment. */
(function(g){
 'use strict';const $=id=>document.getElementById(id),pages={'portal-section':'terms','portal-evidence':'evidence',account:'deckel','portal-points':'points','deckel-more':'more'};let visible=false,current='portal-section',gesture=null;
 function paint(){ $('deckel-nav')?.querySelectorAll('[data-deckel-target]').forEach(button=>{if(button.dataset.deckelTarget===current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
 function sync(){gesture=null;for(const [id,page] of Object.entries(pages)){const wrapper=$('portal-page-'+page);if(wrapper)wrapper.hidden=!visible||id!==current;}paint();}
 function jump(id,remember=true){if(id==='phone-menu')id='account';if(!visible||!pages[id])return;const target=$(id);if(!target)return;const changed=id!==current;current=id;
  if(changed&&remember&&g.history?.pushState)g.history.pushState({...g.history.state,portalPage:id},'');sync();if(target.tagName==='DETAILS')target.open=true;
  const wrapper=$('portal-page-'+pages[id]);if(wrapper){const scroller=$('deckel-main');if(scroller?.scrollTo)scroller.scrollTo({top:0,left:0,behavior:'instant'});else g.scrollTo?.({top:0,left:0,behavior:'instant'});wrapper.focus?.({preventScroll:true});}else if(!target.hidden){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.focus?.({preventScroll:true});}
  if(typeof g.CustomEvent==='function')g.dispatchEvent(new CustomEvent('portal-pagechange',{detail:{page:id}}));
 }
 function show(value){if(value&&g.history?.replaceState&&!pages[g.history.state?.portalPage])g.history.replaceState({...g.history.state,portalPage:current},'');visible=Boolean(value);if($('deckel-nav'))$('deckel-nav').hidden=!visible;sync();}
 function init(){const nav=$('deckel-nav');if(!nav)return;nav.querySelectorAll('[data-deckel-target]').forEach(button=>button.addEventListener('click',()=>jump(button.dataset.deckelTarget)));
  const main=$('deckel-main');
  main?.addEventListener('pointerdown',event=>{
   gesture=null;
   if(!visible||event.pointerType!=='touch'||!event.isPrimary||event.clientX<24||event.clientX>g.innerWidth-24)return;
   if(event.target?.closest?.('button,a,input,select,textarea,summary,[role="button"],[role="slider"],[contenteditable]:not([contenteditable="false"]),[data-no-swipe]')||document.activeElement?.matches?.('input,select,textarea')||g.getSelection?.()?.isCollapsed===false)return;
   for(let el=event.target;el&&el!==main;el=el.parentElement)if(el.scrollWidth>el.clientWidth+2&&/auto|scroll/.test(g.getComputedStyle?.(el).overflowX||''))return;
   gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp,page:current};
  });
  main?.addEventListener('pointermove',event=>{if(gesture&&event.pointerId===gesture.id&&Math.abs(event.clientY-gesture.y)>35)gesture=null;});
  main?.addEventListener('pointercancel',()=>{gesture=null;});
  main?.addEventListener('pointerup',event=>{
   const start=gesture;gesture=null;if(!start||event.pointerId!==start.id||!visible||start.page!==current)return;
   const dx=event.clientX-start.x,dy=event.clientY-start.y,elapsed=event.timeStamp-start.time;
   if(Math.abs(dx)<70||Math.abs(dy)>35||Math.abs(dx)<Math.abs(dy)*2||elapsed<0||elapsed>800)return;
   const order=Object.keys(pages),next=order[order.indexOf(current)+(dx<0?1:-1)];if(next)jump(next);
  });
  if(g.history?.replaceState)g.history.replaceState({...g.history.state,portalPage:current},'');
  g.addEventListener('popstate',event=>{if(pages[event.state?.portalPage]||event.state?.portalPage==='phone-menu')jump(event.state.portalPage,false);});
  g.addEventListener('hashchange',()=>{current='portal-section';sync();});
  let fullHeight=g.visualViewport?.height||g.innerHeight;
  function fitKeyboard(){
   const focused=document.activeElement?.matches?.('input,select,textarea'),height=g.visualViewport?.height||g.innerHeight;
   const keyboard=Boolean(focused&&height<fullHeight-100);
   document.body.classList.toggle('keyboard-open',keyboard);
   if(keyboard)document.documentElement?.style.setProperty('--portal-viewport-height',height+'px');
   else{document.documentElement?.style.removeProperty('--portal-viewport-height');if(!focused)fullHeight=height;}
  }
  document.addEventListener('focusin',fitKeyboard);
  document.addEventListener('focusout',()=>{if(!document.activeElement?.matches?.('input,select,textarea')){document.body.classList.remove('keyboard-open');document.documentElement?.style.removeProperty('--portal-viewport-height');}});
  g.visualViewport?.addEventListener('resize',fitKeyboard);
  sync();
 }
 g.DeckelMobile={show,jump,sync};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
