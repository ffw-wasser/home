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
  // Ehrungen behalten type='award'; awardKind erhält die Zuordnung freier Ehrungen.
  const GROUPS=[...TYPES.slice(0,4),{key:'honor',label:'Ehrungen'},TYPES[4]];
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
      return {id:String(item.id||''),type:item.type,title,date,notes,...(item.type==='award'&&item.awardKind==='honor'?{awardKind:'honor'}:{})};
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
  const HONORS=[
    {title:'Feuerwehr-Ehrenzeichen Baden-Württemberg Bronze (15 Jahre)',asset:'honor-bw-bronze',aliases:['Feuerwehr-Ehrenzeichen Bronze','Feuerwehr-Ehrenzeichen in Bronze']},
    {title:'Feuerwehr-Ehrenzeichen Baden-Württemberg Silber (25 Jahre)',asset:'honor-bw-silver',aliases:['Feuerwehr-Ehrenzeichen Silber','Feuerwehr-Ehrenzeichen in Silber']},
    {title:'Feuerwehr-Ehrenzeichen Baden-Württemberg Gold (40 Jahre)',asset:'honor-bw-gold',aliases:['Feuerwehr-Ehrenzeichen Gold','Feuerwehr-Ehrenzeichen in Gold']},
    {title:'Feuerwehr-Ehrenzeichen Baden-Württemberg Gold in besonderer Ausführung (50 Jahre)',asset:'honor-bw-gold-50',aliases:['Feuerwehr-Ehrenzeichen Gold in besonderer Ausführung','Feuerwehr-Ehrenzeichen in Gold in besonderer Ausführung']},
    {title:'Feuerwehr-Ehrenzeichen Baden-Württemberg Sonderstufe',asset:'honor-bw-special',aliases:['Feuerwehr-Ehrenzeichen der Sonderstufe']},
    {title:'Deutsches Feuerwehr-Ehrenkreuz Bronze',asset:'honor-dfv-bronze',aliases:['Deutsches Feuerwehr-Ehrenkreuz in Bronze']},
    {title:'Deutsches Feuerwehr-Ehrenkreuz Silber',asset:'honor-dfv-silver',aliases:['Deutsches Feuerwehr-Ehrenkreuz in Silber']},
    {title:'Deutsches Feuerwehr-Ehrenkreuz Gold',asset:'honor-dfv-gold',aliases:['Deutsches Feuerwehr-Ehrenkreuz in Gold']},
    {title:'Ehrenmedaille des Landesfeuerwehrverbandes Baden-Württemberg Silber',asset:'honor-lfv-medal-silver',aliases:[]},
    {title:'Ehrenmedaille des Landesfeuerwehrverbandes Baden-Württemberg Gold',asset:'honor-lfv-medal-gold',aliases:[]},
    {title:'Ehrennadel des Landesfeuerwehrverbandes Baden-Württemberg Silber',asset:'honor-lfv-pin-silver',aliases:[]},
    {title:'Ehrennadel des Landesfeuerwehrverbandes Baden-Württemberg Gold',asset:'honor-lfv-pin-gold',aliases:[]},
    {title:'Albert-Bürger-Medaille des Landesfeuerwehrverbandes Baden-Württemberg',asset:'honor-lfv-albert',aliases:['Albert-Bürger-Medaille']}
  ];
  const normalizedTitle=value=>String(value||'').trim().toLocaleLowerCase('de').replace(/[–—]/g,'-').replace(/\s+/g,' ');
  const knownHonor=title=>HONORS.find(item=>[item.title,...item.aliases].some(value=>normalizedTitle(value)===normalizedTitle(title)));
  const isHonor=item=>item?.type==='award'&&(item.awardKind==='honor'||!!knownHonor(item.title)||/(?:ehren(?:zeichen|kreuz|medaille|nadel)|ehrung|verdienstmedaille|albert-bürger-medaille)/i.test(String(item.title||'')));
  const matchesGroup=(item,type)=>type==='honor'?isHonor(item):item.type===type&&(type!=='award'||!isHonor(item));
  const BLOCKED_TITLE=/(?:berufsfeuerwehr|beamten?(?:laufbahn|dienst|anwärter|ausbildung)?|beamtin|brandoberinspektor|brandinspektor|brandamtmann|brandamtsrat|brandoberamtsrat|brandreferendar|brandrat|brandoberrat|branddirektor|leitender branddirektor|feuerwehr(?:ober)?inspektor|feuerwehr(?:ober)?amtmann|hauptamtliche?r?|feuerwehrtechnischer dienst|laufbahnprüfung)/i;
  const keyOf=(type,title)=>type+'|'+String(title).trim().toLocaleLowerCase('de');
  function volunteerCatalogItem(type,title){
    if(!TYPES.some(item=>item.key===type)||typeof title!=='string')return false;
    const trimmed=title.trim();
    if(!trimmed||trimmed.length>120||BLOCKED_TITLE.test(trimmed))return false;
    return type!=='rank'||FF_RANKS.some(rank=>rank.toLocaleLowerCase('de')===trimmed.toLocaleLowerCase('de'));
  }
  function catalogEntries(catalog){
    return Array.isArray(catalog)?catalog.filter(item=>item&&volunteerCatalogItem(item.type,item.title)).map(item=>({type:item.type,title:item.title.trim(),...(item.type==='award'&&item.awardKind==='honor'?{awardKind:'honor'}:{})})):[];
  }
  function mergedCatalog(existing,people){
    const terms=new Map();
    const add=(type,title,awardKind)=>{if(volunteerCatalogItem(type,title)&&(!terms.has(keyOf(type,title))||awardKind==='honor'))terms.set(keyOf(type,title),{type,title:title.trim(),...(type==='award'&&awardKind==='honor'?{awardKind:'honor'}:{})});};
    for(const item of catalogEntries(existing))add(item.type,item.title,item.awardKind);
    if(Array.isArray(people))for(const person of people)for(const item of entries(person))add(item.type,item.title,item.awardKind);
    return [...terms.values()].slice(0,1000);
  }

  // Ausschließlich FF-BW-Bezeichnungen in der gemeinsamen Auswahlliste.
  function suggestions(type,people,catalog){
    if(!GROUPS.some(item=>item.key===type))return [];
    const storedType=type==='honor'?'award':type,entriesByKey=new Map();
    const add=(title,awardKind)=>{
      const item={type:storedType,title,awardKind};
      if(volunteerCatalogItem(storedType,title)&&matchesGroup(item,type)&&!entriesByKey.has(keyOf(storedType,title)))entriesByKey.set(keyOf(storedType,title),title.trim());
    };
    if(type==='rank')FF_RANKS.forEach(title=>add(title));
    if(type==='course')VOLUNTEER_COURSES.forEach(title=>add(title));
    if(type==='award')VOLUNTEER_AWARDS.forEach(title=>add(title));
    if(type==='honor')HONORS.forEach(item=>add(item.title,'honor'));
    const shared=catalog===undefined?(typeof careerCatalog!=='undefined'?careerCatalog:[]):catalog;
    catalogEntries(shared).filter(item=>item.type===storedType).forEach(item=>add(item.title,item.awardKind));
    if(Array.isArray(people))for(const person of people)for(const item of entries(person))if(item?.type===storedType)add(item.title,item.awardKind);
    return [...entriesByKey.values()].sort((a,b)=>a.localeCompare(b,'de')).slice(0,250);
  }
  function refreshSuggestions(el){
    const people=typeof members!=='undefined'?members:[];
    const type=el.querySelector('[name="type"]')?.value;
    const dateLabel=el.querySelector('[data-career-date-label]');if(dateLabel)dateLabel.textContent=type==='honor'?'Verleihungsdatum':'Datum der Erlangung';
    const list=el.querySelector('#memberCareerTitleSuggestions');
    if(list)list.innerHTML=suggestions(type,people).map(title=>'<option value="'+escape(title)+'"></option>').join('');
  }
  function currentRank(all){return all.filter(item=>item.type==='rank').slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.title||'Kein Dienstgrad hinterlegt';}
  const RANK_ASSETS=['trainee','firefighter','senior-firefighter','chief-firefighter','crew-chief','senior-crew-chief','chief-crew-chief','officer','senior-officer','chief-officer','leading-chief-officer'];
  function insigniaAsset(item){
    const title=String(item?.title||'').trim().toLocaleLowerCase('de');
    if(item?.type==='rank'){
      const index=FF_RANKS.findIndex(rank=>rank.toLocaleLowerCase('de')===title);
      return index<0?'':RANK_ASSETS[Math.floor(index/2)]+'.png';
    }
    if(item?.type==='award'){
      const honor=knownHonor(item.title);if(honor)return honor.asset+'.jpg';
      const match=/^(?:feuerwehr-)?leistungsabzeichen (bronze|silber|gold)$/.exec(title);
      if(match)return 'achievement-'+({bronze:'bronze',silber:'silver',gold:'gold'}[match[1]])+'.png';
      if(title==='leistungsspange der deutschen jugendfeuerwehr')return 'youth-clasp.png';
    }
    return '';
  }
  function insigniaHtml(item){
    const asset=insigniaAsset(item);
    return asset?'<img class="member-insignia member-insignia-'+(isHonor(item)?'honor':item.type)+'" src="assets/member-insignia/'+asset+'" alt="" aria-hidden="true" width="80" height="80">':'';
  }
  function honorsHtml(all){
    const attained=all.filter(item=>validDate(item.date)&&item.date<=new Date().toLocaleDateString('sv-SE'));
    const rank=attained.filter(item=>item.type==='rank').sort((a,b)=>b.date.localeCompare(a.date))[0];
    const awards=attained.filter(item=>matchesGroup(item,'award')).sort((a,b)=>b.date.localeCompare(a.date));
    const honors=attained.filter(isHonor).sort((a,b)=>b.date.localeCompare(a.date));
    if(!rank&&!awards.length&&!honors.length)return '';
    const tile=(item,label)=>'<div class="member-honor member-honor-'+item.type+'">'+insigniaHtml(item)+'<div><small>'+label+'</small><strong>'+escape(item.title)+'</strong><time datetime="'+escape(item.date)+'">'+(item.type==='rank'?'Seit ':isHonor(item)?'Verliehen am ':'Erworben am ')+formatDate(item.date)+'</time></div></div>';
    return '<section class="member-honors" aria-label="Dienstgrad, Leistungszeichen und Ehrungen">'+(rank?tile(rank,'Aktueller Dienstgrad'):'')+(awards.length?'<div class="member-honors-section"><h5>Leistungszeichen</h5><div class="member-honors-awards">'+awards.map(item=>tile(item,'Leistungszeichen')).join('')+'</div></div>':'')+(honors.length?'<div class="member-honors-section"><h5>Ehrungen</h5><div class="member-honors-awards">'+honors.map(item=>tile(item,'Ehrung')).join('')+'</div></div>':'')+'</section>';
  }
  function rowEntries(row){return validate(JSON.parse(row.querySelector('[data-career-json]').value||'[]'));}
  function formatDate(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return m?m[3]+'.'+m[2]+'.'+m[1]:escape(value);}
  function groupHtml(type,all){
    const list=all.map((item,index)=>({...item,index})).filter(item=>matchesGroup(item,type.key)).sort((a,b)=>b.date.localeCompare(a.date));
    return '<section class="career-category"><header class="career-category-heading"><h4>'+escape(type.label)+'</h4><button type="button" class="outline-button" data-career-add="'+type.key+'">+ Hinzufügen</button></header>'+
      (list.length?'<ul class="career-entry-list">'+list.map(item=>'<li class="career-entry"><div class="career-entry-icon" aria-hidden="true">'+(insigniaHtml(item)||(type.key==='rank'?'◆':['award','honor'].includes(type.key)?'★':'✓'))+'</div><div class="career-entry-text"><strong>'+escape(item.title)+'</strong><small>'+(isHonor(item)?'Verliehen am ':'Erworben am ')+formatDate(item.date)+'</small>'+(item.notes?'<p>'+escape(item.notes)+'</p>':'')+'</div><button type="button" class="career-edit-button" data-career-edit="'+item.index+'" aria-label="'+escape(item.title)+' bearbeiten">Bearbeiten</button><button type="button" class="career-delete-button" data-career-delete="'+item.index+'" aria-label="'+escape(item.title)+' entfernen">Entfernen</button></li>').join('')+'</ul>':'<p class="career-empty">Noch kein Eintrag hinterlegt.</p>')+'</section>';
  }
  function render(member){
    const all=entries(member);
    return '<section class="member-career-settings" aria-label="Ausbildung und Laufbahn">'+
      '<input type="hidden" data-career-json value="'+escape(JSON.stringify(all))+'">'+
      '<p class="record-section-intro">Lehrgänge, Fortbildungen, Beförderungen, Leistungszeichen, Ehrungen und freie Einträge mit Datum dokumentieren. Ehrungen nur nach tatsächlicher Verleihung eintragen. Der gemeinsame Auswahlkatalog enthält nur Bezeichnungen der Freiwilligen Feuerwehr Baden-Württemberg. Beamten- und Berufsfeuerwehr-Dienstgrade werden nicht angeboten. Individuelle Freitexte bleiben in der Personalakte möglich.</p>'+
      '<div class="career-groups">'+GROUPS.map(type=>groupHtml(type,all)).join('')+'</div></section>';
  }
  function summary(row){
    const all=rowEntries(row),rank=currentRank(all);
    const node=row.querySelector('[data-record-current-rank]');if(node)node.textContent=rank;
    const honors=row.querySelector('[data-record-honors]');if(honors)honors.innerHTML=honorsHtml(all);
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
    row.querySelector('.career-groups').innerHTML=GROUPS.map(type=>groupHtml(type,all)).join('');
    summary(row);
    row.querySelector('[data-career-json]').dispatchEvent(new Event('input',{bubbles:true}));
  }
  let activeRow=null,editIndex=-1;
  function dialog(){
    let el=document.getElementById('memberCareerDialog');if(el)return el;
    el=document.createElement('dialog');el.id='memberCareerDialog';el.className='member-career-dialog';
    el.innerHTML='<form id="memberCareerForm"><p class="eyebrow">Feuerwehrlaufbahn</p><h3 id="memberCareerHeading">Eintrag hinzufügen</h3><label>Bereich<select class="text-input" name="type" required>'+GROUPS.map(type=>'<option value="'+type.key+'">'+escape(type.label)+'</option>').join('')+'</select></label><label>Bezeichnung (Freitext oder vorhandene Auswahl)<input class="text-input" name="title" list="memberCareerTitleSuggestions" maxlength="120" required placeholder="z. B. Truppführer oder eigene Fortbildung"><datalist id="memberCareerTitleSuggestions"></datalist><small>Vorschläge stammen nur aus der Freiwilligen Feuerwehr; Berufsfeuerwehr- und Beamtenbezeichnungen werden nicht in den gemeinsamen Katalog übernommen.</small></label><label><span data-career-date-label>Datum der Erlangung</span><input class="text-input" type="date" name="date" required></label><label>Bemerkung (optional)<textarea class="text-input" name="notes" rows="2" maxlength="500" placeholder="z. B. Ausbildungsort oder Besonderheiten"></textarea></label><div class="career-dialog-actions"><button class="outline-button" type="button" data-career-cancel>Abbrechen</button><button class="primary-button" type="submit">Eintrag übernehmen</button></div></form>';
    document.body.append(el);
    el.querySelector('[name="type"]').addEventListener('change',()=>refreshSuggestions(el));
    el.querySelector('[data-career-cancel]').addEventListener('click',()=>el.close());
    el.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();if(!activeRow||!activeRow.isConnected)return el.close();
      try{
        const form=el.querySelector('form'),items=rowEntries(activeRow),item={
          id:editIndex>=0?items[editIndex].id:(global.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2)),
          type:form.elements.namedItem('type').value==='honor'?'award':form.elements.namedItem('type').value,
          ...(form.elements.namedItem('type').value==='honor'?{awardKind:'honor'}:{}),
          title:form.elements.namedItem('title').value.trim(),
          date:form.elements.namedItem('date').value,
          notes:form.elements.namedItem('notes').value.trim()
        };
        if(!volunteerCatalogItem(item.type,item.title))throw Error('Nur Bezeichnungen der ehrenamtlichen Freiwilligen Feuerwehr Baden-Württemberg sind zulässig. Dienstgrade bitte aus der vorgegebenen Auswahl übernehmen.');
        const canonical=suggestions(form.elements.namedItem('type').value,typeof members!=='undefined'?members:[]).find(title=>keyOf(item.type,title)===keyOf(item.type,item.title));
        if(canonical)item.title=canonical;
        if(items.some((existing,index)=>index!==editIndex&&keyOf(existing.type,existing.title)===keyOf(item.type,item.title)&&existing.date===item.date))throw Error('Dieser Laufbahneintrag ist mit demselben Erwerbsdatum bereits vorhanden.');
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
    form.elements.namedItem('type').value=item?(isHonor(item)?'honor':item.type):(type||'course');
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
  global.MemberCareer={isHonor,matchesGroup,insigniaAsset,insigniaHtml,honorsHtml,render,validate,summary,currentRank,entries,suggestions,volunteerCatalogItem,catalogEntries,mergedCatalog};
})(window);
