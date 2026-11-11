/* Persönliche Laufbahn: Bestandteil der geschützten Mitglieder-Stammdaten, keine öffentliche Ablage. */
(function(global){
  'use strict';
  const TYPES=[
    {key:'course',label:'Lehrgänge'},
    {key:'training',label:'Fortbildungen'},
    {key:'rank',label:'Dienstgrade'},
    {key:'award',label:'Leistungsabzeichen & Leistungsspangen'}
  ];
  const escape=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const validDate=value=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
    const date=new Date(value+'T12:00:00Z');
    return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
  };
  function validate(raw){
    if(!Array.isArray(raw)||raw.length>250)throw Error('Die Laufbahn enthält zu viele oder ungültige Einträge.');
    return raw.map(item=>{
      if(!item||!TYPES.some(type=>type.key===item.type))throw Error('Unbekannte Laufbahn-Kategorie.');
      const title=String(item.title||'').trim(),date=String(item.date||''),notes=String(item.notes||'').trim();
      if(!title||title.length>120)throw Error('Bitte eine Bezeichnung mit maximal 120 Zeichen eintragen.');
      if(!validDate(date)||date>new Date().toLocaleDateString('sv-SE'))throw Error('Bitte ein gültiges, nicht zukünftiges Erwerbsdatum eintragen.');
      if(notes.length>500)throw Error('Die Bemerkung darf höchstens 500 Zeichen lang sein.');
      return {id:String(item.id||''),type:item.type,title,date,notes};
    });
  }
  function entries(member){return Array.isArray(member&&member.careerEntries)?member.careerEntries:[];}
  function currentRank(all){return all.filter(item=>item.type==='rank').slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.title||'Kein Dienstgrad hinterlegt';}
  function rowEntries(row){return validate(JSON.parse(row.querySelector('[data-career-json]').value||'[]'));}
  function formatDate(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return m?m[3]+'.'+m[2]+'.'+m[1]:value;}
  function groupHtml(type,all){
    const list=all.map((item,index)=>({...item,index})).filter(item=>item.type===type.key).sort((a,b)=>b.date.localeCompare(a.date));
    return '<section class="career-category"><header class="career-category-heading"><h4>'+escape(type.label)+'</h4><button type="button" class="outline-button" data-career-add="'+type.key+'">+ Hinzufügen</button></header>'+
      (list.length?'<ul class="career-entry-list">'+list.map(item=>'<li class="career-entry"><div class="career-entry-icon" aria-hidden="true">'+(type.key==='rank'?'◆':type.key==='award'?'★':'✓')+'</div><div class="career-entry-text"><strong>'+escape(item.title)+'</strong><small>Erworben am '+formatDate(item.date)+'</small>'+(item.notes?'<p>'+escape(item.notes)+'</p>':'')+'</div><button type="button" class="career-edit-button" data-career-edit="'+item.index+'" aria-label="'+escape(item.title)+' bearbeiten">Bearbeiten</button><button type="button" class="career-delete-button" data-career-delete="'+item.index+'" aria-label="'+escape(item.title)+' entfernen">Entfernen</button></li>').join('')+'</ul>':'<p class="career-empty">Noch kein Eintrag hinterlegt.</p>')+'</section>';
  }
  function render(member){
    const all=entries(member);
    return '<section class="member-career-settings" aria-label="Ausbildung und Laufbahn">'+
      '<input type="hidden" data-career-json value="'+escape(JSON.stringify(all))+'">'+
      '<p class="record-section-intro">Lehrgänge, Fortbildungen, Beförderungen und Abzeichen mit Erwerbsdatum dauerhaft dokumentieren. Alle Änderungen werden zusammen mit den Mitgliederdaten gespeichert.</p>'+
      '<div class="career-groups">'+TYPES.map(type=>groupHtml(type,all)).join('')+'</div></section>';
  }
  function summary(row){
    const all=rowEntries(row),rank=currentRank(all);
    const node=row.querySelector('[data-record-current-rank]');if(node)node.textContent=rank;
    const count=row.querySelector('[data-record-qualification-count]');if(count)count.textContent=all.filter(item=>item.type==='course'||item.type==='training').length;
    const awards=row.querySelector('[data-record-awards-count]');if(awards)awards.textContent=all.filter(item=>item.type==='award').length;
    const preview=row.querySelector('[data-record-career-preview]');
    if(preview){
      const recent=all.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
      preview.innerHTML=recent.length?recent.map(item=>'<div class="career-preview-item"><span>'+escape(item.title)+'</span><time datetime="'+item.date+'">'+formatDate(item.date)+'</time></div>').join(''):'<p class="career-empty">Noch keine Qualifikationen oder Beförderungen eingetragen.</p>';
    }
  }
  function update(row,all){
    all=validate(all);
    row.querySelector('[data-career-json]').value=JSON.stringify(all);
    row.querySelector('.career-groups').innerHTML=TYPES.map(type=>groupHtml(type,all)).join('');
    summary(row);
    row.querySelector('[data-career-json]').dispatchEvent(new Event('input',{bubbles:true}));
  }
  let activeRow=null,editIndex=-1;
  function dialog(){
    let el=document.getElementById('memberCareerDialog');if(el)return el;
    el=document.createElement('dialog');el.id='memberCareerDialog';el.className='member-career-dialog';
    el.innerHTML='<form id="memberCareerForm"><p class="eyebrow">Feuerwehrlaufbahn</p><h3 id="memberCareerHeading">Eintrag hinzufügen</h3><label>Bereich<select class="text-input" name="type" required>'+TYPES.map(type=>'<option value="'+type.key+'">'+escape(type.label)+'</option>').join('')+'</select></label><label>Lehrgang, Dienstgrad oder Auszeichnung<input class="text-input" name="title" maxlength="120" required placeholder="z. B. Truppführer oder Leistungsabzeichen Bronze"></label><label>Datum der Erlangung<input class="text-input" type="date" name="date" required></label><label>Bemerkung (optional)<textarea class="text-input" name="notes" rows="2" maxlength="500" placeholder="z. B. Ausbildungsort oder Besonderheiten"></textarea></label><div class="career-dialog-actions"><button class="outline-button" type="button" data-career-cancel>Abbrechen</button><button class="primary-button" type="submit">Eintrag übernehmen</button></div></form>';
    document.body.append(el);
    el.querySelector('[data-career-cancel]').addEventListener('click',()=>el.close());
    el.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();if(!activeRow||!activeRow.isConnected)return el.close();
      try{
        const form=el.querySelector('form'),items=rowEntries(activeRow),item={
          id:editIndex>=0?items[editIndex].id:(global.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2)),
          type:form.elements.namedItem('type').value,
          title:form.elements.namedItem('title').value.trim(),
          date:form.elements.namedItem('date').value,
          notes:form.elements.namedItem('notes').value.trim()
        };
        if(editIndex>=0)items[editIndex]=item;else items.push(item);
        update(activeRow,items);el.close();
      }catch(error){global.showToast?.(error.message||'Eintrag konnte nicht übernommen werden.','error');}
    });
    return el;
  }
  function open(row,type,index){
    const el=dialog(),all=rowEntries(row),item=index>=0?all[index]:null,form=el.querySelector('form');
    activeRow=row;editIndex=index;
    el.querySelector('#memberCareerHeading').textContent=item?'Eintrag bearbeiten':'Eintrag hinzufügen';
    form.elements.namedItem('type').value=item?.type||type||'course';
    form.elements.namedItem('title').value=item?.title||'';
    form.elements.namedItem('date').value=item?.date||'';
    form.elements.namedItem('notes').value=item?.notes||'';
    el.showModal();
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-career-add],[data-career-edit],[data-career-delete]');
    if(!trigger)return;
    const row=trigger.closest('#memberAdmin .ux-member');if(!row)return;
    if(trigger.hasAttribute('data-career-add')){open(row,trigger.dataset.careerAdd,-1);return;}
    const index=Number(trigger.dataset.careerEdit??trigger.dataset.careerDelete);
    if(!Number.isInteger(index)||index<0||index>=rowEntries(row).length)return;
    if(trigger.hasAttribute('data-career-edit')){open(row,'',index);return;}
    const all=rowEntries(row),item=all[index];
    if(confirm('„'+item.title+'“ wirklich aus der Laufbahn entfernen?')){all.splice(index,1);update(row,all);}
  });
  global.MemberCareer={render,validate,summary,currentRank,entries};
})(window);
