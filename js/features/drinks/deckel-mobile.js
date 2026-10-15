/* Local navigation only. The fragment contains the private access credentials. */
(function(g){
 'use strict';const $=id=>document.getElementById(id);let visible=false;
 function paint(id){$('deckel-nav')?.querySelectorAll('[data-deckel-target]').forEach(button=>{if(button.dataset.deckelTarget===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
 function jump(id){const target=$(id);if(!visible||!target||target.hidden)return;if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.focus?.({preventScroll:true});paint(id);}
 function show(value){visible=Boolean(value);if($('deckel-nav'))$('deckel-nav').hidden=!visible;}
 function init(){const nav=$('deckel-nav');if(!nav)return;nav.querySelectorAll('[data-deckel-target]').forEach(button=>button.addEventListener('click',()=>jump(button.dataset.deckelTarget)));
  document.addEventListener('focusin',e=>{if(e.target.matches?.('input,select,textarea'))document.body.classList.add('keyboard-open');});
  document.addEventListener('focusout',()=>{if(!document.activeElement?.matches?.('input,select,textarea'))document.body.classList.remove('keyboard-open');});
  let fullHeight=g.visualViewport?.height||g.innerHeight;g.visualViewport?.addEventListener('resize',()=>{const focused=document.activeElement?.matches?.('input,select,textarea');if(focused)document.body.classList.toggle('keyboard-open',g.visualViewport.height<fullHeight-100);else fullHeight=g.visualViewport.height;});
  let frame=0;g.addEventListener('scroll',()=>{if(frame||!visible)return;frame=requestAnimationFrame(()=>{frame=0;let current='account';for(const id of ['phone-menu','deckel-more','portal-section']){const target=$(id);if(target&&!target.hidden&&target.getBoundingClientRect().top<innerHeight*.4)current=id;}paint(current);});},{passive:true});
 }
 g.DeckelMobile={show,jump};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
