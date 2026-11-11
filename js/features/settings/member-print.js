/* Geschützter Druck der Feuerwehr-Personenakten.
   Ausschließlich lokal im Browser: keine Druckdaten an GitHub, externe Dienste oder Server.
   Keine PINs, Telefonnummern oder medizinischen Nachweisdaten im Ausdruck. */
(function(global){
  'use strict';
  const MATCH_TYPES=new Set(['course','training','rank']);
  const CAREER_TYPES=[
    ['course','Lehrgänge'],['training','Fortbildungen'],['rank','Dienstgrade'],
    ['award','Leistungsabzeichen & Leistungsspangen'],['other','Weitere Einträge']
  ];
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.slice(8,10)+'.'+value.slice(5,7)+'.'+value.slice(0,4):'–';
  const fullName=person=>[person.firstName,person.lastName].map(value=>String(value||'').trim()).filter(Boolean).join(' ')||'Unbenanntes Mitglied';
  const careerEntries=person=>Array.isArray(person?.careerEntries)?person.careerEntries.filter(item=>item&&typeof item==='object'):[];
  const yearOf=item=>typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)?Number(item.date.slice(0,4)):null;
  function matchedInYear(member,year){
    if(!Number.isInteger(year)||year<1900||year>9999)return [];
    return careerEntries(member).filter(item=>MATCH_TYPES.has(item.type)&&yearOf(item)===year).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.title).localeCompare(String(b.title),'de'));
  }
  function candidates(people,selection){
    const list=Array.isArray(people)?people:[];
    if(selection.mode==='selected')return list.filter(person=>String(person.id)===String(selection.memberId||''));
    // Eine reine Gast-/Trainerperson gilt nicht als Feuerwehrmitglied.
    const active=list.filter(person=>person.fitnessTrainer!==true);
    if(selection.mode==='all')return active.slice().sort((a,b)=>String(a.lastName||'').localeCompare(String(b.lastName||''),'de')||String(a.firstName||'').localeCompare(String(b.firstName||''),'de'));
    if(selection.mode==='year')return active.filter(person=>matchedInYear(person,Number(selection.year)).length>0)
      .sort((a,b)=>String(a.lastName||'').localeCompare(String(b.lastName||''),'de')||String(a.firstName||'').localeCompare(String(b.firstName||''),'de'));
    return [];
  }
  function currentRank(person){
    const rank=careerEntries(person).filter(item=>item.type==='rank'&&yearOf(item)!==null)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
    return rank?.title||'Nicht hinterlegt';
  }
  function functionsFor(person){
    const roles=Array.isArray(person.roles)?person.roles.map(x=>String(x).trim()).filter(Boolean):[];
    if(person.ageDepartment===true)return ['Altersabteilung'];
    const values=[];
    if(roles.includes('GF'))values.push('Gruppenführer');
    const map={'ATF':'Angriffstruppführer','ATM':'Angriffstruppmann','WTF':'Wassertruppführer','WTM':'Wassertruppmann','STF':'Schlauchtruppführer','STM':'Schlauchtruppmann','Melder':'Melder'};
    roles.forEach(role=>{if(map[role])values.push(map[role]);});
    if(roles.includes('Maschinist')||Array.isArray(person.machinistVehicles)&&person.machinistVehicles.length){
      const vehicles=Array.isArray(person.machinistVehicles)?person.machinistVehicles.filter(v=>v==='LF'||v==='TSF'):[];
      values.push('Maschinist'+(vehicles.length?' · '+vehicles.join(' / '):''));
    }
    if(person.committeeMember===true)values.push('Ausschuss');
    if(person.breathingQualified===true)values.push('Aktiver Atemschutz');
    if(person.fitnessTrainer===true)values.push('Fitness / Gast');
    return [...new Set(values)];
  }
  function rows(items,markYear){
    return '<table class="print-career-table"><thead><tr><th>Datum</th><th>Bezeichnung</th></tr></thead><tbody>'+
      items.map(item=>'<tr'+(markYear&&yearOf(item)===markYear?' class="is-year-match"':'')+'><td>'+formatDate(item.date)+'</td><td>'+escape(String(item.title||''))+(item.notes?'<div class="print-career-notes">'+escape(item.notes)+'</div>':'')+'</td></tr>').join('')+'</tbody></table>';
  }
  function oneRecord(person,option,number,total){
    const year=option.mode==='year'?Number(option.year):null;
    const all=careerEntries(person).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    const special=year?matchedInYear(person,year):[];
    const sections=CAREER_TYPES.map(([type,title])=>{
      const entries=all.filter(item=>item.type===type);
      if(!entries.length)return '';
      return '<section class="member-print-career-section"><h3>'+escape(title)+'</h3>'+rows(entries,year)+'</section>';
    }).join('');
    const functions=functionsFor(person);
    const label=person.ageDepartment?'Altersabteilung':person.fitnessTrainer?'Gast / Fitness':'Einsatzabteilung';
    const date=new Date().toLocaleDateString('de-DE');
    return '<article class="member-print-person" aria-label="Personalakte '+escape(fullName(person))+'">'+
      '<header class="member-print-top"><span>Feuerwehr Emmendingen · Abteilung Wasser</span><span>Interne Personalakte</span></header>'+
      '<div class="member-print-title"><div><p>Personalakte</p><h1>'+escape(fullName(person))+'</h1></div><span class="member-print-pagenum">'+number+' / '+total+'</span></div>'+
      (year?'<div class="member-print-year-label">Jahresauswahl '+year+' · Lehrgänge, Fortbildungen und Dienstgrade</div>':'')+
      '<section class="member-print-details"><h2>Stammdaten</h2><dl>'+
      '<div><dt>Nachname</dt><dd>'+escape(person.lastName||'–')+'</dd></div>'+
      '<div><dt>Vorname</dt><dd>'+escape(person.firstName||'–')+'</dd></div>'+
      '<div><dt>Abteilung</dt><dd>'+escape(label)+'</dd></div>'+
      '<div><dt>Aktueller Dienstgrad</dt><dd>'+escape(currentRank(person))+'</dd></div>'+
      '</dl></section>'+
      '<section class="member-print-function-section"><h2>Funktionen & Zugehörigkeit</h2><p>'+ (functions.length?functions.map(value=>'<span>'+escape(value)+'</span>').join(''):'Keine zusätzlichen Funktionen hinterlegt')+'</p></section>'+
      (special.length?'<section class="member-print-matches"><h2>Im Jahr '+year+' erreicht</h2>'+
        '<table><thead><tr><th>Datum</th><th>Art</th><th>Erworben</th></tr></thead><tbody>'+
        special.map(item=>'<tr><td>'+formatDate(item.date)+'</td><td>'+escape(CAREER_TYPES.find(([key])=>key===item.type)?.[1]||item.type)+'</td><td>'+escape(item.title||'')+'</td></tr>').join('')+
        '</tbody></table></section>':'')+
      '<section class="member-print-career"><h2>Ausbildung & Laufbahn</h2>'+(sections||'<p>Keine Laufbahneinträge hinterlegt.</p>')+'</section>'+
      '<footer class="member-print-footer">Interne Mitgliederverwaltung · Stand: '+escape(date)+' · Vertraulich behandeln</footer>'+
    '</article>';
  }
  function documentHtml(people,option){
    const selected=candidates(people,option);
    return selected.map((person,i)=>oneRecord(person,option,i+1,selected.length)).join('');
  }
  function getCurrentMemberId(){
    const box=document.getElementById('memberAdmin');
    return box?.querySelector('article.ux-member:not([hidden])')?.dataset.memberId||'';
  }
  function selectionFromForm(form){
    return {mode:form.querySelector('#memberPrintScope').value,year:Number(form.querySelector('#memberPrintYear').value),memberId:getCurrentMemberId()};
  }
  function updateForm(){
    const form=document.getElementById('memberPrintControls');if(!form)return;
    const selection=selectionFromForm(form),yearLabel=form.querySelector('[data-print-year-control]');
    yearLabel.hidden=selection.mode!=='year';
    const now=new Date().getFullYear(),validYear=Number.isInteger(selection.year)&&selection.year>=1900&&selection.year<=now;
    const all=typeof members!=='undefined'?members:[];
    const count=selection.mode==='year'&&!validYear?0:candidates(all,selection).length;
    const status=form.querySelector('#memberPrintResult');
    status.textContent=(selection.mode==='selected'?'Ausgewählte Person':selection.mode==='all'?'Alle Mitglieder':'Jahresauswahl '+(validYear?selection.year:'–'))+': '+count+' '+(count===1?'Person':'Personen')+' für den Druck.';
    form.querySelector('[data-print-submit]').disabled=!validYear&&selection.mode==='year'||count===0;
  }
  function printNow(){
    const form=document.getElementById('memberPrintControls');
    if(!form||typeof requireAdmin!=='function'||!requireAdmin('settingsMembersView'))return;
    if(global.Usability?.hasMemberDraft?.()){
      global.showToast?.('Bitte zuerst offene Mitgliederänderungen speichern oder verwerfen, damit der Ausdruck den gespeicherten Daten entspricht.','error');return;
    }
    const settings=selectionFromForm(form),yearNow=new Date().getFullYear();
    if(settings.mode==='year'&&(!Number.isInteger(settings.year)||settings.year<1900||settings.year>yearNow)){
      global.showToast?.('Bitte ein gültiges Jahr zwischen 1900 und '+yearNow+' eingeben.','error');return;
    }
    if(!['all','selected','year'].includes(settings.mode))return;
    const all=typeof members!=='undefined'?members:[];
    const list=candidates(all,settings);
    if(!list.length){global.showToast?.('Keine passenden Mitglieder mit gespeicherten Einträgen gefunden.','error');return;}
    const host=document.getElementById('memberPrintRoot')||document.createElement('div');
    host.id='memberPrintRoot';
    host.setAttribute('aria-label','Druckansicht der Mitgliederakten');
    host.innerHTML=documentHtml(all,settings);
    if(!host.isConnected)document.body.append(host);
    const cleanup=()=>{host.replaceChildren();global.removeEventListener('afterprint',cleanup);};
    global.addEventListener('afterprint',cleanup,{once:true});
    // Das native iPad-/Browser-Druckmenü erlaubt auch "Als PDF sichern".
    global.requestAnimationFrame?global.requestAnimationFrame(()=>global.print()):global.print();
  }
  function mount(){
    const target=document.getElementById('memberAdmin');
    if(!target||document.getElementById('memberPrintControls'))return;
    const controls=document.createElement('section');
    controls.id='memberPrintControls';controls.className='member-print-controls';
    controls.setAttribute('aria-label','Personenakten drucken');
    controls.innerHTML='<div class="member-print-control-title"><div><h4>Personenakten drucken</h4><p>Einzelne Akte, alle Mitglieder oder Personen mit Ausbildung beziehungsweise Beförderung in einem Jahr.</p></div><span aria-hidden="true">⎙</span></div>'+
      '<div class="member-print-fields"><label>Umfang<select id="memberPrintScope" class="text-input"><option value="selected">Ausgewählte Person</option><option value="all">Alle Mitglieder</option><option value="year">Lehrgang, Fortbildung oder Dienstgrad im Jahr</option></select></label>'+
      '<label data-print-year-control hidden>Jahr<input id="memberPrintYear" class="text-input" type="number" inputmode="numeric" min="1900" max="'+new Date().getFullYear()+'" step="1" value="'+new Date().getFullYear()+'"></label>'+
      '<button type="button" class="outline-button" data-print-submit> <span aria-hidden="true">⎙</span> Druckansicht / PDF</button></div>'+
      '<p id="memberPrintResult" role="status" aria-live="polite"></p><small>Nur im Verwaltungsbereich. Gedruckt werden gespeicherte Stammdaten, Funktionen und Laufbahneinträge – keine PINs, privaten Kontaktdaten oder medizinischen Nachweise. Die Daten bleiben lokal im Browser.</small>';
    target.before(controls);
    controls.querySelector('#memberPrintScope').addEventListener('change',updateForm);
    controls.querySelector('#memberPrintYear').addEventListener('input',updateForm);
    controls.querySelector('[data-print-submit]').addEventListener('click',printNow);
    target.addEventListener('click',event=>{if(event.target.closest('[data-record-choice]'))queueMicrotask(updateForm);});
    updateForm();
  }
  global.MemberRecordsPrint={candidates,matchedInYear,documentHtml,currentRank,functionsFor,printNow,mount,updateForm};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
    else mount();
  }
})(window);
