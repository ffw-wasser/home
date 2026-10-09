/* Gleichwertige Touch- und Tastaturbedienung neben Drag & Drop. */
(function(){
  'use strict';
  let selected='',undo=null,sessionKey='';
  function initialize(){
    const view=byId('tacticsView');if(!view)return;
    const tools=document.createElement('div');tools.className='ux-tactics-tools';tools.innerHTML='<p role="status" id="tacticsTouchStatus">Person antippen, dann Zielplatz antippen. Besetzte Plätze werden getauscht.</p><button class="outline-button" type="button" id="tacticsTouchCancel" hidden>Auswahl aufheben</button><button class="outline-button" type="button" id="tacticsTouchUndo" hidden>Letzte Änderung zurücknehmen</button>';view.prepend(tools);
    function annotate(){
      const key=currentSessionId||currentOperationId||'';if(key!==sessionKey){sessionKey=key;selected='';undo=null;}
      view.querySelectorAll('[data-drag-member],[data-drop-vehicle],#reserveCrew').forEach(node=>{
        node.setAttribute('tabindex','0');node.setAttribute('role','button');
        node.setAttribute('aria-label',node.dataset.dragMember?`${node.textContent.trim()} auswählen oder als Ziel wählen`:node.id==='reserveCrew'?'In die Reserve verschieben':`${node.dataset.dropRole} auf ${node.dataset.dropVehicle} als Ziel wählen`);
        node.classList.toggle('ux-tactics-selected',Boolean(selected)&&node.dataset.dragMember===selected);
        if(node.dataset.dropVehicle||node.id==='reserveCrew'){
          const member=findTacticsMember(selected),source=currentTacticsSlots.find(slot=>slot.member?.id===selected),vehicle=node.dataset.dropVehicle,role=node.dataset.dropRole;
          const displaced=currentTacticsSlots.find(slot=>slot.vehicle===vehicle&&slot.role===role)?.member;
          const allowed=Boolean(member)&&(node.id==='reserveCrew'||vehicle==='ATUE'?node.id==='reserveCrew'||breathingProtectionPlanned&&member.atueQualified:memberMayFillSlot(member,vehicle,role)&&(!source||!displaced||memberMayFillSlot(displaced,source.vehicle,source.role)));
          node.classList.toggle('workflow-tactics-target',Boolean(selected)&&Boolean(allowed));
          node.classList.toggle('workflow-tactics-unavailable',Boolean(selected)&&!allowed);
        }
      });
      byId('tacticsTouchCancel').hidden=!selected;byId('tacticsTouchUndo').hidden=!undo;
    }
    function clear(){selected='';byId('tacticsTouchStatus').textContent='Person antippen, dann Zielplatz antippen. Besetzte Plätze werden getauscht.';annotate();}
    function activate(event){
      const target=event.target.closest('[data-drop-vehicle],[data-drag-member],#reserveCrew');if(!target)return;
      if(!selected){if(!target.dataset.dragMember)return;selected=target.dataset.dragMember;byId('tacticsTouchStatus').textContent=`${nameForTile(findTacticsMember(selected))}: Zielplatz oder Reserve antippen.`;annotate();return;}
      if(target.dataset.dragMember===selected){clear();return;}
      const snapshot={slots:currentTacticsSlots.map(slot=>({...slot})),atue:currentAtueMember};
      const vehicle=target.id==='reserveCrew'||!target.dataset.dropVehicle?'RESERVE':target.dataset.dropVehicle;
      const signature=()=>JSON.stringify([currentTacticsSlots.map(s=>[s.vehicle,s.role,s.member?.id]),currentAtueMember?.id]);
      const moving=findTacticsMember(selected),displaced=target.dataset.dragMember?findTacticsMember(target.dataset.dragMember):null;const before=signature();manualMoveTacticsMember(selected,vehicle,target.dataset.dropRole||'');
      if(before!==signature()){undo=snapshot;clear();byId('tacticsTouchStatus').textContent=displaced?nameForTile(moving)+' und '+nameForTile(displaced)+' getauscht. Rücknahme ist möglich.':nameForTile(moving)+' auf '+(vehicle==='RESERVE'?'Reserve':vehicle+' '+(target.dataset.dropRole||''))+' verschoben. Rücknahme ist möglich.';annotate();}
    }
    view.addEventListener('click',activate);
    view.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('[data-drop-vehicle],[data-drag-member],#reserveCrew')){event.preventDefault();activate(event);}});
    byId('tacticsTouchCancel').onclick=clear;
    byId('tacticsTouchUndo').onclick=()=>{if(!undo)return;currentTacticsSlots=undo.slots;currentAtueMember=undo.atue;undo=null;refreshTacticsManualView();updateTacticsRecommendationAfterManualChange();clear();showToast('Letzte manuelle Änderung zurückgenommen.');};
    view.addEventListener('dragstart',()=>{selected='';undo=null;annotate();});
    new MutationObserver(annotate).observe(view,{childList:true,subtree:true});annotate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
