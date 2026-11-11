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
  // Gleiche Datenbasis wie die bestehende Statistik: abgeschlossene Berichte aus der Historie.
  // Ein nicht dokumentierter Einsatz ist KEINE unentschuldigte Fehlzeit.
  const DRILL_TYPES=new Set(['Allgemeine Probe','Probe','Sonderprobe','Unterricht']);
  const ATTENDANCE_STATES=new Set(['Anwesend','Entschuldigt','Fehlt']);
  const normalizedName=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').toLocaleLowerCase('de-DE');
  const namesOf=person=>new Set([
    String(person.lastName||'')+', '+String(person.firstName||''),
    String(person.firstName||'')+' '+String(person.lastName||''),
    String(person.lastName||'')+' '+String(person.firstName||'')
  ].map(normalizedName));
  function rowForPerson(data,person,roster){
    const nameKeys=namesOf(person),unique=Array.isArray(roster)&&roster.filter(other=>[...namesOf(other)].some(name=>nameKeys.has(name))).length===1;
    return unique?(data.rows||[]).find(row=>nameKeys.has(normalizedName(row.name))):null;
  }
  function isOperation(data){
    return data.operation===true||Boolean(data.item?.operationData)||
      String(data.item?.sessionType||'').trim()==='Einsatz'||
      String(data.rows?.[0]?.sessionType||'').trim()==='Einsatz';
  }
  function isDrill(data){return DRILL_TYPES.has(String(data.rows?.[0]?.sessionType||data.item?.sessionType||'').trim());}
  function participation(person,history,roster,year=null){
    const operations={present:0,other:0,total:0};
    const drills={present:0,excused:0,missing:0,total:0};
    const events=Array.isArray(history)?history:[];
    for(const data of events){
      if(!data||!Array.isArray(data.rows))continue;
      const date=String(data.date||data.item?.operationData?.date||data.rows[0]?.date||'');
      if(year!==null&&date.slice(0,4)!==String(year))continue;
      const row=rowForPerson(data,person,roster);
      if(isOperation(data)){
        operations.total++;
        if(row&&row.status==='Anwesend')operations.present++;
        else operations.other++;
      }else if(isDrill(data)){
        // „Betrifft nicht“, leere Status und nicht zugeordnete Personen werden ausgeschlossen.
        // Das entspricht der normalen Teilnahmequote der bestehenden Statistik.
        if(!row||!ATTENDANCE_STATES.has(row.status))continue;
        if(row.status==='Anwesend')drills.present++;
        else if(row.status==='Entschuldigt')drills.excused++;
        else drills.missing++;
        drills.total++;
      }
    }
    return {drills,operations};
  }
  function ringSvg(values,total,label){
    const colors=['#2f7950','#d8a13c','#a4434d'];
    const circumference=2*Math.PI*44;
    let offset=0;
    const segments=values.map((value,i)=>{
      const fraction=total?value/total:0;
      if(!fraction)return '';
      const length=fraction*circumference;
      const segment='<circle cx="60" cy="60" r="44" fill="none" stroke="'+colors[i]+'" stroke-width="15" stroke-dasharray="'+length.toFixed(5)+' '+(circumference-length).toFixed(5)+'" stroke-dashoffset="'+(-offset).toFixed(5)+'" transform="rotate(-90 60 60)"/>';
      offset+=length;return segment;
    }).join('');
    const percent=total?Math.round(values[0]/total*100)+' %':'–';
    return '<svg viewBox="0 0 120 120" class="member-print-ring" role="img" aria-label="'+escape(label)+': '+(total?values.join(', ')+' von '+total:'keine Daten')+'"><circle cx="60" cy="60" r="44" fill="none" stroke="#e4e9ec" stroke-width="15"/>'+segments+'<text x="60" y="65" text-anchor="middle" font-size="17" font-weight="700" fill="#163044">'+percent+'</text></svg>';
  }
  function chartCard(title,counts,legend,note){
    const total=counts.reduce((sum,value)=>sum+value,0);
    return '<div class="member-print-chart"><h3>'+escape(title)+'</h3><div class="member-print-chart-main">'+ringSvg(counts,total,title)+
      '<div class="member-print-legend">'+legend.map((label,i)=>'<div><i class="member-print-key member-print-key-'+i+'" aria-hidden="true"></i><span>'+escape(label)+'</span><b>'+counts[i]+'</b></div>').join('')+'</div></div>'+
      '<p>'+escape(total?note:'Noch keine auswertbaren Berichte vorhanden.')+'</p></div>';
  }
  function participationHtml(person,history,roster,year){
    const stats=participation(person,history,roster,year);
    const d=stats.drills,o=stats.operations;
    return '<section class="member-print-participation"><h2>Probe- und Einsatzteilnahme</h2>'+
      '<p class="member-print-participation-period">'+(year!==null?'Kalenderjahr '+year:'Alle verfügbaren abgeschlossenen Berichte')+'</p>'+
      '<div class="member-print-chart-grid">'+
      chartCard('Proben & Unterricht',[d.present,d.excused,d.missing],['Anwesend','Entschuldigt','Fehlt'],
        d.total+' betreffende Termine · „Betrifft nicht“ ausgeschlossen')+
      chartCard('Einsätze',[o.present,o.other],['Teilgenommen','Nicht als Teilnehmer erfasst'],
        o.total+' dokumentierte Einsätze · Keine Aussage über Entschuldigung oder Dienstpflicht')+
      '</div></section>';
  }
  function rows(items,markYear){
    return '<table class="print-career-table"><thead><tr><th>Datum</th><th>Bezeichnung</th></tr></thead><tbody>'+
      items.map(item=>'<tr'+(markYear&&yearOf(item)===markYear?' class="is-year-match"':'')+'><td>'+formatDate(item.date)+'</td><td>'+escape(String(item.title||''))+(item.notes?'<div class="print-career-notes">'+escape(item.notes)+'</div>':'')+'</td></tr>').join('')+'</tbody></table>';
  }
  function oneRecord(person,option,number,total,history,roster){
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
      participationHtml(person,history,roster,year)+
      (special.length?'<section class="member-print-matches"><h2>Im Jahr '+year+' erreicht</h2>'+
        '<table><thead><tr><th>Datum</th><th>Art</th><th>Erworben</th></tr></thead><tbody>'+
        special.map(item=>'<tr><td>'+formatDate(item.date)+'</td><td>'+escape(CAREER_TYPES.find(([key])=>key===item.type)?.[1]||item.type)+'</td><td>'+escape(item.title||'')+'</td></tr>').join('')+
        '</tbody></table></section>':'')+
      '<section class="member-print-career"><h2>Ausbildung & Laufbahn</h2>'+(sections||'<p>Keine Laufbahneinträge hinterlegt.</p>')+'</section>'+
      '<footer class="member-print-footer">Interne Mitgliederverwaltung · Stand: '+escape(date)+' · Vertraulich behandeln</footer>'+
    '</article>';
  }
  function documentHtml(people,option,history=[]){
    const selected=candidates(people,option);
    return selected.map((person,i)=>oneRecord(person,option,i+1,selected.length,history,people)).join('');
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
    const history=typeof statisticsArchiveData==='function'?statisticsArchiveData():[];
    host.innerHTML=documentHtml(all,settings,history);
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
  global.MemberRecordsPrint={candidates,matchedInYear,documentHtml,currentRank,functionsFor,participation,participationHtml,printNow,mount,updateForm};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
    else mount();
  }
})(window);
