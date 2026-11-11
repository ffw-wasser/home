/* Persönliche Laufbahn: Bestandteil der geschützten Mitglieder-Stammdaten, keine öffentliche Ablage. */
(function(global){
  'use strict';
  const TYPES=[
    {key:'course',label:'Lehrgänge'},
    {key:'training',label:'Fortbildungen'},
    {key:'rank',label:'Dienstgrade'},
    {key:'award',label:'Leistungsabzeichen & Leistungsspangen'},
    {key:'other',label:'Weitere Einträge (Freitext)'}
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

  // Ausschließlich Dienstgrade der ehrenamtlichen Freiwilligen Feuerwehr BW.
  // Nicht mit Dienstbezeichnungen des feuerwehrtechnischen Beamten-/Hauptamts verwechseln.
  const FF_RANKS=[
    'Feuerwehrmann im Praktikum','Feuerwehrfrau im Praktikum',
    'Feuerwehrmann','Feuerwehrfrau',
    'Oberfeuerwehrmann','Oberfeuerwehrfrau',
    'Hauptfeuerwehrmann','Hauptfeuerwehrfrau',
    'Löschmeister','Löschmeisterin',
    'Oberlöschmeister','Oberlöschmeisterin',
    'Hauptlöschmeister','Hauptlöschmeisterin',
    'Brandmeister','Brandmeisterin',
    'Oberbrandmeister','Oberbrandmeisterin',
    'Hauptbrandmeister','Hauptbrandmeisterin',
    'Leitender Hauptbrandmeister','Leitende Hauptbrandmeisterin'
  ];
  const VOLUNTEER_COURSES=['Truppmann Teil 1','Truppmann Teil 2','Truppführer','Sprechfunker','Atemschutzgeräteträger','Maschinist','Gruppenführer','Zugführer'];
  const VOLUNTEER_AWARDS=['Feuerwehr-Leistungsabzeichen Bronze','Feuerwehr-Leistungsabzeichen Silber','Feuerwehr-Leistungsabzeichen Gold','Leistungsspange der Deutschen Jugendfeuerwehr'];
  const BLOCKED_TITLE=/(?:berufsfeuerwehr|beamten?(?:laufbahn|dienst|anwärter|ausbildung)?|beamtin|brandoberinspektor|brandinspektor|brandamtmann|brandamtsrat|brandoberamtsrat|brandreferendar|brandrat|brandoberrat|branddirektor|leitender branddirektor|feuerwehr(?:ober)?inspektor|feuerwehr(?:ober)?amtmann|hauptamtliche?r?|feuerwehrtechnischer dienst|laufbahnprüfung)/i;
  const keyOf=(type,title)=>type+'|'+String(title).trim().toLocaleLowerCase('de');
  function volunteerCatalogItem(type,title){
    if(!TYPES.some(item=>item.key===type)||typeof title!=='string')return false;
    const trimmed=title.trim();
    if(!trimmed||trimmed.length>120||BLOCKED_TITLE.test(trimmed))return false;
    return type!=='rank'||FF_RANKS.some(rank=>rank.toLocaleLowerCase('de')===trimmed.toLocaleLowerCase('de'));
  }
  function catalogEntries(catalog){
    return Array.isArray(catalog)?catalog.filter(item=>item&&volunteerCatalogItem(item.type,item.title)).map(item=>({type:item.type,title:item.title.trim()})):[];
  }
  function mergedCatalog(existing,people){
    const terms=new Map();
    const add=(type,title)=>{if(volunteerCatalogItem(type,title)&&!terms.has(keyOf(type,title)))terms.set(keyOf(type,title),{type,title:title.trim()});};
    for(const item of catalogEntries(existing))add(item.type,item.title);
    if(Array.isArray(people))for(const person of people)for(const item of entries(person))add(item.type,item.title);
    return [...terms.values()].slice(0,1000);
  }

  // Ausschließlich FF-BW-Bezeichnungen in der gemeinsamen Auswahlliste.
  function suggestions(type,people,catalog){
    if(!TYPES.some(item=>item.key===type))return [];
    const entriesByKey=new Map();
    const add=title=>{
      if(volunteerCatalogItem(type,title)&&!entriesByKey.has(keyOf(type,title)))entriesByKey.set(keyOf(type,title),title.trim());
    };
    if(type==='rank')FF_RANKS.forEach(add);
    if(type==='course')VOLUNTEER_COURSES.forEach(add);
    if(type==='award')VOLUNTEER_AWARDS.forEach(add);
    const shared=catalog===undefined?(typeof careerCatalog!=='undefined'?careerCatalog:[]):catalog;
    catalogEntries(shared).filter(item=>item.type===type).forEach(item=>add(item.title));
    if(Array.isArray(people))for(const person of people)for(const item of entries(person))if(item?.type===type)add(item.title);
    return [...entriesByKey.values()].sort((a,b)=>a.localeCompare(b,'de')).slice(0,250);
  }
  function refreshSuggestions(el){
    const people=typeof members!=='undefined'?members:[];
    const type=el.querySelector('[name="type"]')?.value;
    const list=el.querySelector('#memberCareerTitleSuggestions');
    if(list)list.innerHTML=suggestions(type,people).map(title=>'<option value="'+escape(title)+'"></option>').join('');
  }
  function currentRank(all){return all.filter(item=>item.type==='rank').slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.title||'Kein Dienstgrad hinterlegt';}
  function rowEntries(row){return validate(JSON.parse(row.querySelector('[data-career-json]').value||'[]'));}
  function formatDate(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return m?m[3]+'.'+m[2]+'.'+m[1]:escape(value);}
  function groupHtml(type,all){
    const list=all.map((item,index)=>({...item,index})).filter(item=>item.type===type.key).sort((a,b)=>b.date.localeCompare(a.date));
    return '<section class="career-category"><header class="career-category-heading"><h4>'+escape(type.label)+'</h4><button type="button" class="outline-button" data-career-add="'+type.key+'">+ Hinzufügen</button></header>'+
      (list.length?'<ul class="career-entry-list">'+list.map(item=>'<li class="career-entry"><div class="career-entry-icon" aria-hidden="true">'+(type.key==='rank'?'◆':type.key==='award'?'★':'✓')+'</div><div class="career-entry-text"><strong>'+escape(item.title)+'</strong><small>Erworben am '+formatDate(item.date)+'</small>'+(item.notes?'<p>'+escape(item.notes)+'</p>':'')+'</div><button type="button" class="career-edit-button" data-career-edit="'+item.index+'" aria-label="'+escape(item.title)+' bearbeiten">Bearbeiten</button><button type="button" class="career-delete-button" data-career-delete="'+item.index+'" aria-label="'+escape(item.title)+' entfernen">Entfernen</button></li>').join('')+'</ul>':'<p class="career-empty">Noch kein Eintrag hinterlegt.</p>')+'</section>';
  }
  function render(member){
    const all=entries(member);
    return '<section class="member-career-settings" aria-label="Ausbildung und Laufbahn">'+
      '<input type="hidden" data-career-json value="'+escape(JSON.stringify(all))+'">'+
      '<p class="record-section-intro">Lehrgänge, Fortbildungen, Beförderungen, Abzeichen und freie Einträge mit Erwerbsdatum dokumentieren. Der gemeinsame Auswahlkatalog enthält nur Bezeichnungen der Freiwilligen Feuerwehr Baden-Württemberg. Beamten- und Berufsfeuerwehr-Dienstgrade werden nicht angeboten. Individuelle Freitexte bleiben in der Personalakte möglich.</p>'+
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
    el.innerHTML='<form id="memberCareerForm"><p class="eyebrow">Feuerwehrlaufbahn</p><h3 id="memberCareerHeading">Eintrag hinzufügen</h3><label>Bereich<select class="text-input" name="type" required>'+TYPES.map(type=>'<option value="'+type.key+'">'+escape(type.label)+'</option>').join('')+'</select></label><label>Bezeichnung (Freitext oder vorhandene Auswahl)<input class="text-input" name="title" list="memberCareerTitleSuggestions" maxlength="120" required placeholder="z. B. Truppführer oder eigene Fortbildung"><datalist id="memberCareerTitleSuggestions"></datalist><small>Vorschläge stammen nur aus der Freiwilligen Feuerwehr; Berufsfeuerwehr- und Beamtenbezeichnungen werden nicht in den gemeinsamen Katalog übernommen.</small></label><label>Datum der Erlangung<input class="text-input" type="date" name="date" required></label><label>Bemerkung (optional)<textarea class="text-input" name="notes" rows="2" maxlength="500" placeholder="z. B. Ausbildungsort oder Besonderheiten"></textarea></label><div class="career-dialog-actions"><button class="outline-button" type="button" data-career-cancel>Abbrechen</button><button class="primary-button" type="submit">Eintrag übernehmen</button></div></form>';
    document.body.append(el);
    el.querySelector('[name="type"]').addEventListener('change',()=>refreshSuggestions(el));
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
    refreshSuggestions(el);
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
  global.MemberCareer={render,validate,summary,currentRank,entries,suggestions,volunteerCatalogItem,catalogEntries,mergedCatalog};
})(window);
