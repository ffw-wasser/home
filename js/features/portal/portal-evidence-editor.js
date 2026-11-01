/* Personal evidence entry. The Worker owns eligibility, intervals and write permissions. */
(function(g){
 'use strict';
 const labels={g262:'G26.2',g263:'G26.3',instruction:'Sicherheitsunterweisung',ffi:'FFI',driver:'Führerscheinkontrolle'};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 let snapshot=null,editing=false,pending=null,busy=false,epoch=0;
 const date=value=>value?new Date(value+'T12:00:00Z').toLocaleDateString('de-DE'):'';
 function source(entry){if(!entry)return 'Verwaltung';const name=entry.source==='self'?'Eigenangabe':'Verwaltung';return name+(entry.status==='pending'?' · Bestätigung ausstehend':entry.status==='rejected'?' · abgelehnt':'')+(entry.updatedAt?' · '+new Date(entry.updatedAt).toLocaleString('de-DE'):'');}
 function clear(){epoch++;snapshot=null;editing=false;pending=null;busy=false;}
 function consent(result,root){
  const model=g.G26Consent,approval=result.consent;
  if(!model)return;
  const granted=approval?.granted===true&&approval.textVersion===model.version;
  const section=node(granted?'details':'section');section.className='portal-evidence-editor';section.id='g26-consent';section.append(node(granted?'summary':'h3',model.title+(granted?' · bestätigt':'')),node('p','Freiwillig: G26-Fristen anzeigen und den Nachweisstatus berechtigten Führungskräften bereitstellen. Keine Befunde oder Diagnosen.'));const explanation=node(granted?'div':'details');if(!granted)explanation.append(node('summary','Datennutzung und Widerruf'));explanation.append(node('p',model.controller),node('p',model.text),node('p',model.notice));section.append(explanation);
  const policy=node('a','Datenschutzhinweise');policy.href='privacy.html';policy.target='_blank';policy.rel='noopener noreferrer';explanation.append(policy);
  const status=node('p');status.setAttribute('role','status');
  if(!approval||approval.textVersion!==model.version){section.append(node('p','Die Einwilligung benötigt das aktuelle Portal-Update. G26-Fristen werden bis dahin nicht angezeigt.'));root.append(section);return;}
  const button=node('button',granted?'G26-Einwilligung widerrufen':'Einwilligung speichern');button.type='button';button.id='g26-consent-save';let checkbox;
  if(!granted){const label=node('label');checkbox=node('input');checkbox.type='checkbox';checkbox.id='g26-consent-check';checkbox.checked=false;label.append(checkbox,node('span',model.label));section.append(label);button.disabled=true;checkbox.onchange=()=>button.disabled=!checkbox.checked;}
  else section.append(node('p','Einwilligung erteilt am '+new Date(approval.grantedAt||approval.updatedAt).toLocaleString('de-DE')));
  button.onclick=async()=>{if(busy||editing||pending){status.textContent='Bitte zuerst offene Nachweiseingaben speichern oder abbrechen.';return;}if(!granted&&!checkbox.checked)return;busy=true;button.disabled=true;if(checkbox)checkbox.disabled=true;status.textContent=granted?'Widerruf wird gespeichert …':'Einwilligung wird gespeichert …';try{const reply=await g.H2OPortal.api('evidence/consent',{granted:!granted,textVersion:model.version,expectedVersion:approval.version});if(reply.ok!==true||reply.consent?.granted!==!granted)throw Error('Einwilligung nicht eindeutig bestätigt. Bitte neu laden.');busy=false;await g.H2OPortal.refreshEvidence();}catch(e){status.textContent=e.message;button.disabled=false;if(checkbox)checkbox.disabled=false;}finally{busy=false;}};
  section.append(button,status);root.append(section);
 }
 function render(result,root){
  snapshot=result;
  if(!result.entries||!result.eligibility)return;
  const fields=Object.keys(labels).filter(field=>!['g262','g263'].includes(field)||result.consent?.granted===true&&result.consent.textVersion===g.G26Consent?.version).filter(field=>field==='driver'?result.eligibility.driver:result.eligibility.agt);
  if(!fields.length)return;
  const section=node('section');section.className='portal-evidence-editor';section.append(node('h3','Nachweise selbst aktualisieren'),node('p','Trage nur tatsächlich erbrachte Nachweise ein. Eigenangaben bleiben erkennbar. Eine Führerscheinkontrolle gilt erst nach Bestätigung durch die Verwaltung als kontrolliert.'));
  const slot=node('div');slot.className='evidence-edit-slot';
  for(const field of fields){const button=node('button',labels[field]+' aktualisieren');button.type='button';button.className='secondary';button.onclick=()=>open(field,slot);section.append(button);}
  section.append(slot);root.append(section);
  if(result.history?.length){const history=node('details');history.className='portal-evidence-history';history.append(node('summary','Änderungsverlauf (letzte 30 Änderungen)'));for(const entry of result.history){const p=node('p',(labels[entry.field]||entry.field)+' · '+source(entry)+' · Nachweis vom '+date(entry.checkedOn)+(entry.until?' · gültig bis '+date(entry.until):'')+(entry.controller?' · Kontrolle: '+entry.controller:''));history.append(p);}root.append(history);}
 }
 function open(field,slot){
  if(busy||pending)return;
  if(editing&&!confirm('Die noch nicht gespeicherte Nachweiseingabe verwerfen?'))return;
  editing=true;slot.replaceChildren();
  const entry=snapshot.entries[field],form=node('form');form.dataset.evidenceField=field;
  form.append(node('h4',labels[field]+' aktualisieren'));
  if(entry.status==='pending')form.append(node('p','Gemeldete Kontrolle vom '+date(entry.checkedOn)+(entry.controller?' · '+entry.controller:'')+' wartet auf Bestätigung.'));
  const add=(text,type,id,value='')=>{const label=node('label',text),input=node('input');input.type=type;input.id='self-evidence-'+id;input.name=id;input.value=value;label.htmlFor=input.id;label.append(input);form.append(label);return input;};
  const checked=add('Tatsächlich durchgeführt am','date','checkedOn',entry.checkedOn||'');checked.required=true;checked.max=g.MemberEvidence.day(Date.now());checked.min='2000-01-01';
  const medical=field==='g262'||field==='g263';
  const until=medical?add('Dokumentiert gültig bis (Monat/Jahr)','month','validMonth',g.MemberEvidence.monthInput(entry.until)):null;if(until)until.required=true;
  if(field==='ffi'||field==='instruction')form.append(node('p','Die nächste Fälligkeit wird nach 12 Monaten berechnet.'));
  const controller=field==='driver'?add('Kontrollperson (optional)','text','controller',entry.controller):null;if(controller)controller.maxLength=80;
  const confirm=add('Ich bestätige, dass ich den Nachweis tatsächlich erbracht habe und meine Angaben richtig sind.','checkbox','responsibility');confirm.required=true;
  const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const save=node('button','Eigenangabe speichern');save.type='submit';
  const cancel=node('button','Abbrechen');cancel.type='button';cancel.className='secondary';
  cancel.onclick=()=>{if(busy||pending)return;editing=false;slot.replaceChildren();void g.H2OPortal.refreshEvidence();};
  const controls=()=>{for(const input of form.querySelectorAll('input'))input.disabled=busy||!!pending;save.disabled=busy;save.textContent=pending?'Speicherung erneut prüfen':'Eigenangabe speichern';cancel.disabled=busy||!!pending;};
  form.onsubmit=async event=>{
   event.preventDefault();if(busy||!pending&&!form.reportValidity())return;
   if(!pending)pending={field,checkedOn:checked.value,...(until?{validMonth:until.value}:{}),...(controller?{controller:controller.value.trim()}:{}),responsibility:confirm.checked,expectedVersion:entry.version,requestId:crypto.randomUUID()};
   const generation=epoch,job=pending;busy=true;controls();status.textContent='Eigenangabe wird gespeichert …';const globalStatus=document.getElementById('portal-evidence-status');if(globalStatus)globalStatus.textContent=status.textContent;
   try{
    const response=await g.H2OPortal.api('evidence/report',job);
    if(generation!==epoch)return;
    if(response.ok!==true||response.receipt!==job.requestId)throw Error('Speicherung nicht eindeutig bestätigt.');
    pending=null;editing=false;busy=false;await g.H2OPortal.refreshEvidence();
    const output=document.getElementById('portal-evidence-status');if(output)output.textContent=field==='driver'?'Eigenangabe gespeichert. Die Führerscheinkontrolle wartet auf Bestätigung durch die Verwaltung.':'Eigenangabe gespeichert. Dein Status wurde aktualisiert.';
   }catch(error){if(generation===epoch){if([400,401,403,404,409,429].includes(error.status))pending=null;status.textContent=error.message+(pending?' Speicherung noch nicht bestätigt. Bitte dieselbe Speicherung erneut prüfen.':' Bitte abbrechen, den Status neu laden und die Angaben prüfen.');if(globalStatus)globalStatus.textContent=status.textContent;}}
   finally{if(generation===epoch){busy=false;controls();}}
  };
  form.append(status,save,cancel);slot.append(form);checked.focus();
 }
 g.PortalEvidenceEditor={render,consent,source,clear,hasUnsaved:()=>editing||!!pending||busy};
 g.addEventListener('beforeunload',event=>{if(editing||pending||busy){event.preventDefault();event.returnValue='';}});
})(globalThis);
