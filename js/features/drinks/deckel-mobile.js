/* Separate portal screens. Personal credentials remain in the URL fragment. */
(function(g){
 'use strict';const $=id=>document.getElementById(id),pages={'portal-section':'terms',account:'deckel','phone-menu':'drinks','portal-points':'points','deckel-more':'more'};let visible=false,current='portal-section';
 function paint(){ $('deckel-nav')?.querySelectorAll('[data-deckel-target]').forEach(button=>{if(button.dataset.deckelTarget===current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
 function sync(){for(const [id,page] of Object.entries(pages)){const wrapper=$('portal-page-'+page);if(wrapper)wrapper.hidden=!visible||id!==current;}paint();}
 function jump(id,remember=true){if(!visible||!pages[id])return;const target=$(id);if(!target)return;const changed=id!==current;current=id;
  if(changed&&remember&&g.history?.pushState)g.history.pushState({...g.history.state,portalPage:id},'');sync();if(target.tagName==='DETAILS')target.open=true;
  const wrapper=$('portal-page-'+pages[id]);if(wrapper){g.scrollTo?.({top:0,left:0,behavior:'instant'});wrapper.focus?.({preventScroll:true});}else if(!target.hidden){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.focus?.({preventScroll:true});}
  if(typeof g.CustomEvent==='function')g.dispatchEvent(new CustomEvent('portal-pagechange',{detail:{page:id}}));
 }
 function show(value){if(value&&g.history?.replaceState&&!pages[g.history.state?.portalPage])g.history.replaceState({...g.history.state,portalPage:current},'');visible=Boolean(value);if($('deckel-nav'))$('deckel-nav').hidden=!visible;sync();}
 function init(){const nav=$('deckel-nav');if(!nav)return;nav.querySelectorAll('[data-deckel-target]').forEach(button=>button.addEventListener('click',()=>jump(button.dataset.deckelTarget)));
  if(g.history?.replaceState)g.history.replaceState({...g.history.state,portalPage:current},'');
  g.addEventListener('popstate',event=>{if(pages[event.state?.portalPage])jump(event.state.portalPage,false);});
  g.addEventListener('hashchange',()=>{current='portal-section';sync();});
  document.addEventListener('focusin',e=>{if(e.target.matches?.('input,select,textarea'))document.body.classList.add('keyboard-open');});
  document.addEventListener('focusout',()=>{if(!document.activeElement?.matches?.('input,select,textarea'))document.body.classList.remove('keyboard-open');});
  let fullHeight=g.visualViewport?.height||g.innerHeight;g.visualViewport?.addEventListener('resize',()=>{const focused=document.activeElement?.matches?.('input,select,textarea');if(focused)document.body.classList.toggle('keyboard-open',g.visualViewport.height<fullHeight-100);else fullHeight=g.visualViewport.height;});
  sync();
 }
 g.DeckelMobile={show,jump,sync};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
