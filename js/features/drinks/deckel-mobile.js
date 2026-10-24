/* Separate portal screens. Personal credentials remain in the URL fragment. */
(function(g){
 'use strict';const $=id=>document.getElementById(id),pages={'portal-section':'terms','portal-evidence':'evidence',account:'deckel','portal-points':'points','portal-challenge':'challenge','deckel-more':'more','more-bundesliga':'more-bundesliga','more-hydrants':'more-hydrants','more-year-plan':'more-year-plan','more-water':'more-water','more-security':'more-security','more-breathing':'more-breathing','more-help':'more-help','theater-phone-section':'theater'},layoutKey='h2o_portal_layout_v1',maxMainTiles=4,defaultLayout={main:['portal-section','portal-evidence','account','portal-points'],more:['more-year-plan','more-breathing','more-hydrants','more-water','more-help','theater-phone-section','more-bundesliga','more-security']};let visible=false,current='portal-section',gesture=null,layout={main:[...defaultLayout.main],more:[...defaultLayout.more]},selectedTile='',longPress=null;
 const titles={'portal-section':'Termine','portal-evidence':'Nachweise',account:'Mein Deckel','portal-points':'Treuepunkte','portal-challenge':'Monats-Challenge','deckel-more':'Mehr','more-bundesliga':'Bundesliga & Pokal','more-hydrants':'Hydrantenplan','more-year-plan':'Jahresplan','more-water':'Wasserentnahme Elz','more-security':'Konto & Sicherheit','more-breathing':'Atemschutz','more-help':'Infos','theater-phone-section':'Theater'};
 function paint(){const heading=$('portal-menu-title');if(heading)heading.textContent=visible?titles[current]:'H₂O Portal'; $('deckel-nav')?.querySelectorAll('[data-deckel-target]').forEach(button=>{if(button.dataset.deckelTarget===(layout.main.includes(current)?current:current==='portal-challenge'?'portal-points':'deckel-more'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
 function sync(){gesture=null;if($('portal-checkin-dock'))$('portal-checkin-dock').hidden=!visible||current!=='portal-section';for(const [id,page] of Object.entries(pages)){const wrapper=$('portal-page-'+page);if(wrapper){wrapper.hidden=!visible||id!==current;for(const back of wrapper.querySelectorAll?.('.portal-more-back')||[])back.hidden=layout.main.includes(id);}}document.body?.classList?.toggle('theater-mode',visible&&current==='theater-phone-section');if($('deckel-nav'))$('deckel-nav').hidden=!visible||current==='theater-phone-section'||current==='portal-challenge';paint();}
 function jump(id,remember=true){if(id==='phone-menu')id='account';if(!visible||!pages[id])return;const target=$(id);if(!target)return;const changed=id!==current;if(changed&&current==='theater-phone-section'&&g.TheaterPhone?.beforeLeave?.()===false)return false;current=id;
  if(changed&&remember&&g.history?.pushState)g.history.pushState({...g.history.state,portalPage:id},'');sync();if(target.tagName==='DETAILS')target.open=true;
  const wrapper=$('portal-page-'+pages[id]);if(wrapper){const scroller=$('deckel-main');if(scroller?.scrollTo)scroller.scrollTo({top:0,left:0,behavior:'instant'});else g.scrollTo?.({top:0,left:0,behavior:'instant'});wrapper.focus?.({preventScroll:true});}else if(!target.hidden){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.focus?.({preventScroll:true});}
  if(typeof g.CustomEvent==='function')g.dispatchEvent(new CustomEvent('portal-pagechange',{detail:{page:id}}));
 }
 function show(value){if(value&&!visible){current='portal-section';if(g.history?.replaceState)g.history.replaceState({...g.history.state,portalPage:current},'');}visible=Boolean(value);g.H2OIdentity?.setPortalVisible?.(visible);if($('deckel-nav'))$('deckel-nav').hidden=!visible;sync();}
 function init(){const nav=$('deckel-nav');if(!nav)return;const main=$('deckel-main'),grid=$('portal-more-grid'),dialog=$('portal-layout-dialog'),selector=$('portal-layout-item'),layoutStatus=$('portal-layout-status');
  function getTiles(){return [...(main?.querySelectorAll('[data-portal-tile]')||[]),...(nav.querySelectorAll('[data-portal-tile]')||[]),...(grid?.querySelectorAll('[data-portal-tile]')||[])].filter((item,index,list)=>list.indexOf(item)===index);}
  function saveLayout(){try{const storage=typeof safeStorage!=='undefined'?safeStorage:g.localStorage;storage?.setItem(layoutKey,JSON.stringify(layout));if(layoutStatus)layoutStatus.textContent='Anordnung auf diesem Gerät gespeichert.';}catch{if(layoutStatus)layoutStatus.textContent='Anordnung gilt bis zum Schließen dieser Sitzung.';}}
  function loadLayout(){try{const storage=typeof safeStorage!=='undefined'?safeStorage:g.localStorage,stored=JSON.parse(storage?.getItem(layoutKey)||'null');if(stored&&Array.isArray(stored.main)&&Array.isArray(stored.more)){if(JSON.stringify(stored.main)===JSON.stringify(defaultLayout.main)&&JSON.stringify(stored.more)===JSON.stringify(['more-year-plan','more-hydrants','more-water','theater-phone-section','more-security','more-breathing','more-bundesliga','more-help'])){saveLayout();return;}const known=new Set([...defaultLayout.main,...defaultLayout.more]),seen=new Set(),unique=ids=>ids.filter(id=>known.has(id)&&!seen.has(id)&&seen.add(id));layout={main:unique(stored.main),more:unique(stored.more)};for(const id of known)if(!seen.has(id))layout.more.push(id);}}catch{}}
  function syncSelector(){if(!selector)return;const all=[...layout.main,...layout.more],old=selector.value;selector.replaceChildren();for(const id of all){const tile=getTiles().find(item=>item.dataset.portalTile===id);if(!tile)continue;const option=document.createElement('option');option.value=id;option.textContent=tile.dataset.portalTitle||id;selector.append(option);}selectedTile=all.includes(old)?old:(all.includes(selectedTile)?selectedTile:all[0]||'');selector.value=selectedTile;updateLayoutControls();}
  function updateLayoutControls(){const list=layout.main.includes(selectedTile)?layout.main:layout.more,index=list.indexOf(selectedTile),move=$('portal-layout-transfer'),where=$('portal-layout-location');if(where)where.textContent=layout.main.includes(selectedTile)?'Hauptnavigation':'Mehr';if(move)move.textContent=layout.main.includes(selectedTile)?'In „Mehr“ verschieben':(layout.main.length>=maxMainTiles?'Nach unten holen · letzte Kachel nach Mehr':'In Hauptnavigation verschieben');const earlier=$('portal-layout-earlier'),later=$('portal-layout-later');if(earlier)earlier.disabled=index<=0;if(later)later.disabled=index<0||index>=list.length-1;}
  function applyLayout(){if(layout.main.length>maxMainTiles){layout.more.unshift(...layout.main.splice(maxMainTiles));saveLayout();}for(const [group,parent] of [['main',nav],['more',grid]])for(const id of layout[group]){const tile=getTiles().find(item=>item.dataset.portalTile===id);if(!tile)continue;if(group==='main'){tile.dataset.portalCompact='true';tile.dataset.deckelTarget=id;delete tile.dataset.moreTarget;tile.classList?.remove('portal-more-tile');parent.append(tile);}else{delete tile.dataset.deckelTarget;tile.dataset.portalCompact=defaultLayout.main.includes(id)?'true':'false';if(id!=='theater-phone-section')tile.dataset.moreTarget=id;tile.classList?.add('portal-more-tile');parent.append(tile);}}const pinned=nav.querySelector?.('[data-portal-pinned="more"]');if(pinned)nav.append(pinned);const empty=$('portal-more-empty');if(empty)empty.hidden=layout.more.length>0;syncSelector();sync();}
  function openLayout(id){selectedTile=id||selectedTile;applyLayout();syncSelector();if(dialog?.showModal&&!dialog.open)dialog.showModal();}
  function moveSelected(direction){const source=layout.main.includes(selectedTile)?layout.main:layout.more,index=source.indexOf(selectedTile),next=index+direction;if(index<0||next<0||next>=source.length)return;source.splice(index,1);source.splice(next,0,selectedTile);applyLayout();saveLayout();selectedTile=source[next];syncSelector();}
  function makeMainRoom(id){if(!layout.main.includes(id)&&layout.main.length>=maxMainTiles)layout.more.unshift(layout.main.pop());}
  function transferSelected(){if(!layout.main.includes(selectedTile))makeMainRoom(selectedTile);const source=layout.main.includes(selectedTile)?layout.main:layout.more,target=source===layout.main?layout.more:layout.main;source.splice(source.indexOf(selectedTile),1);target.push(selectedTile);applyLayout();saveLayout();syncSelector();}
  loadLayout();applyLayout();
  nav.addEventListener('click',event=>{const button=event.target?.closest?.('[data-deckel-target]');if(button&&nav.contains(button))jump(button.dataset.deckelTarget);});
  main?.addEventListener('click',event=>{const button=event.target?.closest?.('[data-more-target]');if(button&&main.contains(button))jump(button.dataset.moreTarget);});
  $('portal-layout-open')?.addEventListener('click',()=>openLayout());$('portal-layout-close')?.addEventListener('click',()=>dialog?.close());selector?.addEventListener('change',()=>{selectedTile=selector.value;updateLayoutControls();});$('portal-layout-earlier')?.addEventListener('click',()=>moveSelected(-1));$('portal-layout-later')?.addEventListener('click',()=>moveSelected(1));$('portal-layout-transfer')?.addEventListener('click',transferSelected);const resetLayout=()=>{layout={main:[...defaultLayout.main],more:[...defaultLayout.more]};saveLayout();applyLayout();if(layoutStatus)layoutStatus.textContent='Standardanordnung wiederhergestellt.';};$('portal-layout-reset')?.addEventListener('click',resetLayout);$('portal-layout-reset-main')?.addEventListener('click',resetLayout);
  let dragState=null;
  function clearDropPreview(){for(const surface of [main,nav])surface?.querySelectorAll('.portal-drop-before,.portal-drop-after').forEach(item=>item.classList.remove('portal-drop-before','portal-drop-after'));}
  function dropPreview(event){if(!dragState)return;clearDropPreview();const under=document.elementFromPoint?.(event.clientX,event.clientY),container=under?.closest?.('#deckel-nav, #portal-more-grid');if(!container||container===nav&&under?.dataset?.portalPinned){dragState.targetGroup='';dragState.beforeId='';return;}const over=under?.closest?.('[data-portal-tile]');if(over===dragState.tile){dragState.targetGroup='';dragState.beforeId='';return;}dragState.targetGroup=container===nav?'main':'more';dragState.beforeId=over?.dataset?.portalTile||'';dragState.after=Boolean(over&&((dragState.targetGroup==='main'?event.clientX-over.getBoundingClientRect().left:event.clientY-over.getBoundingClientRect().top)>(dragState.targetGroup==='main'?over.getBoundingClientRect().width:over.getBoundingClientRect().height)/2));if(over)over.classList?.add(dragState.after?'portal-drop-after':'portal-drop-before');}
  function finishDrag(cancel=false){clearDropPreview();if(!dragState)return;const state=dragState;dragState=null;document.body?.classList?.remove('portal-drag-active');state.tile.classList?.remove('portal-tile-dragging','portal-drop-before','portal-drop-after');if(state.tile.style)state.tile.style.touchAction='';if(cancel||!state.targetGroup){return;}if(state.targetGroup==='main')makeMainRoom(state.tile.dataset.portalTile);const from=layout.main.includes(state.tile.dataset.portalTile)?layout.main:layout.more,to=state.targetGroup==='main'?layout.main:layout.more;from.splice(from.indexOf(state.tile.dataset.portalTile),1);let index=state.beforeId?to.indexOf(state.beforeId):-1;if(index<0)index=to.length;else if(state.after)index++;to.splice(index,0,state.tile.dataset.portalTile);selectedTile=state.tile.dataset.portalTile;applyLayout();saveLayout();}
  const pressStart=event=>{const tile=event.target?.closest?.('[data-portal-tile]');if(!tile||!visible||event.button>0)return;if(longPress)clearTimeout(longPress.timer);longPress={tile,x:event.clientX,y:event.clientY,last:event,timer:setTimeout(()=>{const point=longPress?.last||event;gesture=null;dragState={tile,targetGroup:'',beforeId:'',after:false};document.body?.classList?.add('portal-drag-active');tile.classList?.add('portal-tile-dragging');if(tile.style)tile.style.touchAction='none';try{tile.setPointerCapture?.(event.pointerId);}catch{}tile.dataset.suppressClick='1';setTimeout(()=>delete tile.dataset.suppressClick,1200);longPress=null;dropPreview(point);},520)};};
  const pressMove=event=>{if(dragState){dropPreview(event);return;}if(!longPress)return;longPress.last=event;if(Math.hypot(event.clientX-longPress.x,event.clientY-longPress.y)>10){clearTimeout(longPress.timer);longPress=null;}};
  const pressEnd=event=>{if(longPress){clearTimeout(longPress.timer);longPress=null;}if(dragState){dropPreview(event);finishDrag(false);}};
  for(const surface of [main,nav].filter(Boolean)){surface.addEventListener('pointerdown',pressStart);surface.addEventListener('pointermove',pressMove);surface.addEventListener('pointerup',pressEnd);surface.addEventListener('pointercancel',()=>{if(longPress)clearTimeout(longPress.timer);longPress=null;finishDrag(true);});surface.addEventListener('contextmenu',event=>{const tile=event.target?.closest?.('[data-portal-tile]');if(tile){event.preventDefault();if(!dragState)openLayout(tile.dataset.portalTile);}});surface.addEventListener('click',event=>{const tile=event.target?.closest?.('[data-portal-tile]');if(tile?.dataset.suppressClick){delete tile.dataset.suppressClick;event.preventDefault();event.stopImmediatePropagation();}},true);surface.addEventListener('touchmove',event=>{if(dragState)event.preventDefault();},{passive:false});}
  $('challenge-open')?.addEventListener('click',()=>jump('portal-challenge'));
  $('challenge-back')?.addEventListener('click',()=>jump('portal-points'));
  function swipeOrder(){return [...layout.main.filter(id=>pages[id]&&id!=='theater-phone-section'),'deckel-more'];}
  let suppressClickUntil=0;
  main?.addEventListener('pointerdown',event=>{
   gesture=null;suppressClickUntil=0;
   if(!visible||dragState||!swipeOrder().includes(current)||event.pointerType!=='touch'||!event.isPrimary||event.clientX<32||event.clientX>g.innerWidth-32)return;
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
   const order=swipeOrder(),next=order[order.indexOf(start.page)+(start.direction<0?1:-1)];if(next)jump(next);
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
