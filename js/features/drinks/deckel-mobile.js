/* Separate portal screens. Personal credentials remain in the URL fragment. */
(function(g){
 'use strict';const $=id=>document.getElementById(id),pages={'portal-section':'terms','portal-evidence':'evidence',account:'deckel','portal-points':'points','portal-challenge':'challenge','deckel-more':'more','more-bundesliga':'more-bundesliga','more-bookings':'more-bookings','more-reminders':'more-reminders','more-help':'more-help','theater-phone-section':'theater'};let visible=false,current='portal-section',gesture=null;
 const titles={'portal-section':'Termine','portal-evidence':'Nachweise',account:'Mein Deckel','portal-points':'Treuepunkte','portal-challenge':'Monats-Challenge','deckel-more':'Mehr','more-bundesliga':'1. Bundesliga','more-bookings':'Buchungen','more-reminders':'Erinnerungen','more-help':'Hilfe','theater-phone-section':'Theater'};
 function paint(){const heading=$('portal-menu-title');if(heading)heading.textContent=visible?titles[current]:'H₂O Portal'; $('deckel-nav')?.querySelectorAll('[data-deckel-target]').forEach(button=>{if(button.dataset.deckelTarget===(current.startsWith('more-')?'deckel-more':current))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
 function sync(){gesture=null;for(const [id,page] of Object.entries(pages)){const wrapper=$('portal-page-'+page);if(wrapper)wrapper.hidden=!visible||id!==current;}document.body?.classList?.toggle('theater-mode',visible&&current==='theater-phone-section');if($('deckel-nav'))$('deckel-nav').hidden=!visible||current==='theater-phone-section'||current==='portal-challenge';paint();}
 function jump(id,remember=true){if(id==='phone-menu')id='account';if(!visible||!pages[id])return;const target=$(id);if(!target)return;const changed=id!==current;if(changed&&current==='theater-phone-section'&&g.TheaterPhone?.beforeLeave?.()===false)return false;current=id;
  if(changed&&remember&&g.history?.pushState)g.history.pushState({...g.history.state,portalPage:id},'');sync();if(target.tagName==='DETAILS')target.open=true;
  const wrapper=$('portal-page-'+pages[id]);if(wrapper){const scroller=$('deckel-main');if(scroller?.scrollTo)scroller.scrollTo({top:0,left:0,behavior:'instant'});else g.scrollTo?.({top:0,left:0,behavior:'instant'});wrapper.focus?.({preventScroll:true});}else if(!target.hidden){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.focus?.({preventScroll:true});}
  if(typeof g.CustomEvent==='function')g.dispatchEvent(new CustomEvent('portal-pagechange',{detail:{page:id}}));
 }
 function show(value){if(value&&!visible){current='portal-section';if(g.history?.replaceState)g.history.replaceState({...g.history.state,portalPage:current},'');}visible=Boolean(value);if($('deckel-nav'))$('deckel-nav').hidden=!visible;sync();}
 function init(){const nav=$('deckel-nav');if(!nav)return;nav.querySelectorAll('[data-deckel-target]').forEach(button=>button.addEventListener('click',()=>jump(button.dataset.deckelTarget)));
  $('challenge-open')?.addEventListener('click',()=>jump('portal-challenge'));
  $('challenge-back')?.addEventListener('click',()=>jump('portal-points'));
  const main=$('deckel-main');main?.querySelectorAll('[data-more-target]').forEach(button=>button.addEventListener('click',()=>jump(button.dataset.moreTarget)));let suppressClickUntil=0;
  main?.addEventListener('pointerdown',event=>{
   gesture=null;suppressClickUntil=0;
   if(!visible||(current==='theater-phone-section'||current==='portal-challenge'||current.startsWith('more-'))||event.pointerType!=='touch'||!event.isPrimary||event.clientX<32||event.clientX>g.innerWidth-32)return;
   if(event.target?.closest?.('input,select,textarea,[role="slider"],[contenteditable]:not([contenteditable="false"]),[data-no-swipe]')||document.activeElement?.matches?.('input,select,textarea')||g.getSelection?.()?.isCollapsed===false)return;
   for(let el=event.target;el&&el!==main;el=el.parentElement)if(el.scrollWidth>el.clientWidth+2&&/auto|scroll/.test(g.getComputedStyle?.(el).overflowX||''))return;
   gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp,page:current,direction:0};
  });
  function move(event){
   const start=gesture;if(!start||event.pointerId!==start.id||!visible||start.page!==current)return;
   const dx=event.clientX-start.x,dy=event.clientY-start.y,x=Math.abs(dx),y=Math.abs(dy),elapsed=event.timeStamp-start.time;
   if(elapsed<0||elapsed>1200){gesture=null;return;}
   if(!start.direction){if(Math.max(x,y)<12)return;if(y>x*1.25){gesture=null;return;}if(x<y*1.25)return;start.direction=Math.sign(dx);}
   // Lock the initial direction. Reversing a gesture must never change the page backwards.
   if(dx*start.direction<0){gesture=null;return;}
   if(x<48||x<y*1.25)return;
   gesture=null;suppressClickUntil=Date.now()+1500;
   const order=Object.keys(pages).filter(id=>!['theater-phone-section','portal-challenge'].includes(id)&&!id.startsWith('more-')),next=order[order.indexOf(start.page)+(start.direction<0?1:-1)];if(next)jump(next);
  }
  main?.addEventListener('pointermove',move);
  main?.addEventListener('pointercancel',()=>{gesture=null;});
  main?.addEventListener('pointerup',event=>{move(event);gesture=null;});
  // A swipe starting on a reply/date button must not activate that button on release.
  main?.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){suppressClickUntil=0;event.preventDefault();event.stopImmediatePropagation();}},true);
  if(g.history?.replaceState)g.history.replaceState({...g.history.state,portalPage:current},'');
  g.addEventListener('popstate',event=>{if(pages[event.state?.portalPage]||event.state?.portalPage==='phone-menu'){if(jump(event.state.portalPage,false)===false)g.history?.pushState({...g.history.state,portalPage:current},'');}});
  g.addEventListener('hashchange',()=>{current='portal-section';sync();});
  let fullHeight=g.visualViewport?.height||g.innerHeight,fullWidth=g.innerWidth;
  function fitKeyboard(){
   const viewport=g.visualViewport;
   // Pinch zoom is not a keyboard resize. Keep native magnification available.
   if(viewport?.scale&&Math.abs(viewport.scale-1)>.05)return;
   const active=document.activeElement,focused=active?.matches?.('input,select,textarea'),height=viewport?.height||g.innerHeight;
   if(!Number.isFinite(height)||height<=0)return;
   if(g.innerWidth!==fullWidth){fullWidth=g.innerWidth;fullHeight=Math.max(height,g.innerHeight||height);}
   const keyboard=Boolean(focused&&height<fullHeight-100);
   document.body.classList.toggle('keyboard-open',keyboard);
   if(keyboard){
    document.documentElement?.style.setProperty('--portal-viewport-height',height+'px');
    const bounds=active?.getBoundingClientRect?.(),top=viewport?.offsetTop||0;
    if(bounds&&(bounds.top<top+12||bounds.bottom>top+height-12))active.scrollIntoView?.({block:'center',inline:'nearest',behavior:'instant'});
   }else{document.documentElement?.style.removeProperty('--portal-viewport-height');if(!focused)fullHeight=height;}
  }
  document.addEventListener('focusin',fitKeyboard);
  document.addEventListener('focusout',()=>{
   // Wait until focus has reached the next field before restoring the menu.
   if(g.requestAnimationFrame)g.requestAnimationFrame(fitKeyboard);else fitKeyboard();
  });
  g.visualViewport?.addEventListener('resize',fitKeyboard);
  g.addEventListener('resize',fitKeyboard);
  sync();
 }
 g.DeckelMobile={show,jump,sync};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
