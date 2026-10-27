/* Review/correct personal evidence through the existing authenticated administration. */
(function(g){
 'use strict';
 const labels={g262:'G26.2',g263:'G26.3',instruction:'Sicherheitsunterweisung',ffi:'FFI',driver:'Führerscheinkontrolle'};
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let root,content,status,loadButton,memberSelect,overviewRoot,overviewHeading,overviewStatus,overviewList,overviewButton,overviewEpoch=0,overviewBusy=false,snapshot=null,memberId='',pending=null,busy=false,epoch=0,needsReload=false,dirty=false;
 function clearMember(){epoch++;snapshot=null;memberId='';pending=null;busy=false;needsReload=false;dirty=false;content?.replaceChildren();if(status)status.textContent='Mitglied oben auswählen und persönliche Portalnachweise laden.';if(loadButton)loadButton.disabled=false;}
 function clear(){clearMember();overviewEpoch++;overviewBusy=false;overviewList?.replaceChildren();if(overviewHeading)overviewHeading.textContent='Ungeprüfte Nachweisänderungen';if(overviewStatus)overviewStatus.textContent='Die Übersicht wird beim Öffnen geladen.';if(overviewButton)overviewButton.disabled=false;}
 function admin(){if(!g.requireAdmin('settingsPortalView'))throw Error('Bitte die Verwaltung entsperren.');}
 async function request(path,data){
  admin();const c=await g.DrinksCentral.connection();if(!c)throw Error('Kontodienst nicht verbunden.');
  const result=await g.DrinksPush.request(c,'/admin/portal/'+path,{source:c.source,...data});
  admin();if(g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert. Bitte neu laden.');return result;
 }
 const stamp=entry=>(entry.source==='self'?'Eigenangabe':'Verwaltung')+(entry.status==='pending'?' · Bestätigung ausstehend':entry.status==='rejected'?' · Abgelehnt':'')+(entry.updatedAt?' · '+new Date(entry.updatedAt).toLocaleString('de-DE'):'');
 function controls(){if(loadButton)loadButton.disabled=busy||!!pending;if(overviewButton)overviewButton.disabled=overviewBusy||busy||!!pending;for(const button of overviewList?.querySelectorAll('button')||[])button.disabled=busy||!!pending;for(const e of content.querySelectorAll('button,input'))e.disabled=busy||!!pending||needsReload;const retry=content.querySelector('[data-evidence-retry]');if(retry){retry.hidden=!pending;retry.disabled=busy||needsReload;}}
 const displayDate=value=>value?new Date(value+'T12:00:00Z').toLocaleDateString('de-DE'):'nicht hinterlegt';
 async function openOverviewItem(item){
  if(busy||pending)return;
  if(dirty&&!confirm('Ungespeicherte Nachweiskorrektur verwerfen?'))return;
  clearMember();
  if(!Array.from(memberSelect.options).some(option=>option.value===item.memberId)){
   const option=node('option',item.name);option.value=item.memberId;memberSelect.append(option);
  }
  memberSelect.value=item.memberId;
  await load();
  const heading=content.querySelector('[data-evidence-field="'+item.field+'"] h4');
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.parentElement.scrollIntoView({block:'start'});}
 }
 async function loadOverview(){
  if(!overviewRoot||document.getElementById('settingsPortalView').hidden)return;
  const version=++overviewEpoch;overviewBusy=true;overviewList.replaceChildren();overviewHeading.textContent='Ungeprüfte Nachweisänderungen';overviewStatus.textContent='Nachweisänderungen werden geladen …';controls();
  try{
   const result=await request('evidence/overview',{});
   if(version!==overviewEpoch)return;
   if(!Array.isArray(result.items)||result.items.some(item=>!Object.hasOwn(labels,item.field)||typeof item.memberId!=='string'||typeof item.name!=='string'))throw Error('Nachweisübersicht konnte nicht vollständig geladen werden.');
   overviewHeading.textContent='Ungeprüfte Nachweisänderungen ('+result.items.length+')';
   overviewStatus.textContent=result.items.length?result.items.length+' Änderungen von '+result.memberCount+' Mitglied'+(result.memberCount===1?'':'ern')+' · Stand: '+new Date(result.servedAt).toLocaleString('de-DE'):'Keine ungeprüften Nachweisänderungen vorhanden.';
   for(const item of result.items){
    const card=node('article'),body=node('div');card.className='portal-evidence-overview-item';
    body.append(node('h4',item.name+' · '+labels[item.field]),node('p','Nachweis vom '+displayDate(item.checkedOn)+(item.until?' · gemeldet gültig bis '+displayDate(item.until):'')),node('p',(item.field==='driver'?'Bisher bestätigte Kontrolle: ':'Bisher bestätigt gültig bis: ')+displayDate(item.confirmedValue)),node('p','Eigenangabe · '+new Date(item.updatedAt).toLocaleString('de-DE')));
    const button=node('button','Prüfen');button.type='button';button.className='outline-button';button.setAttribute('aria-label',item.name+' · '+labels[item.field]+' prüfen');button.onclick=()=>openOverviewItem(item);
    card.append(body,button);overviewList.append(card);
   }
  }catch(error){if(version===overviewEpoch){overviewList.replaceChildren();overviewStatus.textContent='Übersicht nicht geladen. '+(error.status===404?'Für die Übersicht bitte den aktuellen Anmeldedienst veröffentlichen.':error.message);}}
  finally{if(version===overviewEpoch){overviewBusy=false;controls();}}
 }
 async function load(){
  if(busy||pending)return;if(dirty&&!confirm('Ungespeicherte Nachweiskorrektur verwerfen und neu laden?'))return;const id=memberSelect.value;if(!id){status.textContent='Bitte oben ein Mitglied auswählen.';return;}
  const version=++epoch;memberId=id;busy=true;controls();status.textContent='Portalnachweise werden geladen …';
  try{const result=await request('evidence',{memberId:id});if(version!==epoch)return;snapshot=result;needsReload=false;dirty=false;paint();status.textContent='Eigenangaben bleiben im Portal erhalten. Führerscheinkontrollen erst nach tatsächlicher Prüfung bestätigen.';}
  catch(e){if(version===epoch)status.textContent=e.message;}
  finally{if(version===epoch){busy=false;controls();}}
 }
 async function submit(field,action,values={}){
  if(busy||needsReload)return;
  if(!pending)pending={memberId,field,action,...values,expectedVersion:snapshot.entries[field].version,requestId:crypto.randomUUID()};
  const version=epoch,job=pending;busy=true;controls();status.textContent='Nachweisänderung wird gespeichert …';
  try{const result=await request('evidence/review',job);if(version!==epoch)return;if(result.ok!==true||result.receipt!==job.requestId)throw Error('Speicherung nicht eindeutig bestätigt.');pending=null;dirty=false;snapshot=result;paint();status.textContent='Nachweisänderung gespeichert und protokolliert.';await loadOverview();}
  catch(e){if(version===epoch){if([400,401,403,404,409].includes(e.status)){pending=null;needsReload=true;}status.textContent=e.message+(pending?' Speicherung unbestätigt. Bitte erneut prüfen.':' Bitte Nachweise neu laden.');}}
  finally{if(version===epoch){busy=false;controls();}}
 }
 function paint(){
  content.replaceChildren();if(!snapshot?.entries)return;
  for(const [field,label] of Object.entries(labels)){
   if(!(field==='driver'?snapshot.eligibility.driver:snapshot.eligibility.agt))continue;
   const entry=snapshot.entries[field],card=node('article');card.className='portal-evidence-review-card';card.dataset.evidenceField=field;
   card.append(node('h4',label),node('p',stamp(entry)));
   const current=field==='driver'?snapshot.evidence?.driver?.checkedOn:field==='g262'||field==='g263'?snapshot.evidence?.medical?.[field]:snapshot.evidence?.breathing?.[field];
   card.append(node('p',(field==='driver'?'Bestätigte Kontrolle: ':'Aktuell gültig bis: ')+(current||'nicht hinterlegt')));
   if(entry.checkedOn)card.append(node('p','Gemeldeter Nachweis vom '+entry.checkedOn+(entry.controller?' · Kontrollperson: '+entry.controller:'')));
   if(entry.source==='self'&&['pending','reported'].includes(entry.status)){
    const approve=node('button','Nach Prüfung bestätigen');approve.type='button';approve.onclick=()=>submit(field,'confirm');
    const reject=node('button','Eigenangabe ablehnen');reject.type='button';reject.className='outline-button';reject.onclick=()=>{if(confirm('Diese Eigenangabe ablehnen? Der bisherige Verwaltungseintrag bleibt maßgeblich.'))submit(field,'reject');};
    card.append(approve,reject);
   }
   const details=node('details');details.append(node('summary','Nachweis korrigieren'));
   const form=node('form'),add=(text,type,name,value='')=>{const label=node('label',text),input=node('input');input.name=name;input.type=type;input.value=value;label.append(input);form.append(label);return input;};
   const checked=add('Tatsächlich durchgeführt am','date','checkedOn',entry.checkedOn||(field==='driver'?current:'')||'');checked.required=true;checked.max=g.MemberEvidence.day(Date.now());checked.min='2000-01-01';
   const month=['g262','g263'].includes(field)?add('Dokumentiert gültig bis','month','validMonth',g.MemberEvidence.monthInput(entry.until)):null;if(month)month.required=true;
   const controller=field==='driver'?add('Kontrollperson (optional)','text','controller',entry.controller):null;if(controller)controller.maxLength=80;
   const save=node('button','Korrektur speichern');save.type='submit';form.onsubmit=event=>{event.preventDefault();if(form.reportValidity())submit(field,'correct',{checkedOn:checked.value,...(month?{validMonth:month.value}:{}),...(controller?{controller:controller.value.trim()}:{} )});};
   form.append(save);details.append(form);card.append(details);content.append(card);
  }
  const retry=node('button','Speicherung erneut prüfen');retry.type='button';retry.dataset.evidenceRetry='1';retry.hidden=true;retry.onclick=()=>submit();content.append(retry);
  if(snapshot.history?.length){const history=node('details');history.append(node('summary','Änderungsverlauf (letzte 30 Änderungen)'));for(const entry of snapshot.history)history.append(node('p',(labels[entry.field]||entry.field)+' · '+stamp(entry)+' · Nachweis '+entry.checkedOn+(entry.until?' · gültig bis '+entry.until:'')));content.append(history);}
 }
 function init(){
  memberSelect=document.getElementById('portal-admin-member');const view=document.getElementById('settingsPortalView');if(!memberSelect||!view)return;
  root=node('section');root.className='panel portal-evidence-admin';root.id='portal-evidence-admin';root.append(node('h3','Persönliche Nachweise prüfen'));
  overviewRoot=node('section');overviewRoot.className='panel portal-evidence-admin portal-evidence-overview';overviewRoot.id='portal-evidence-overview';overviewHeading=node('h3','Ungeprüfte Nachweisänderungen');overviewStatus=node('p');overviewStatus.setAttribute('role','status');overviewStatus.setAttribute('aria-live','polite');overviewButton=node('button','Übersicht aktualisieren');overviewButton.type='button';overviewButton.className='outline-button';overviewButton.onclick=loadOverview;overviewList=node('div');overviewList.className='portal-evidence-overview-list';overviewRoot.append(overviewHeading,node('p','Eigenangaben aller Mitglieder zu Atemschutz und Führerscheinkontrollen. „Prüfen“ öffnet den aktuellen Nachweis des Mitglieds.'),overviewButton,overviewStatus,overviewList);view.querySelector('.screen-heading').after(overviewRoot);
  status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  loadButton=node('button','Portalnachweise des ausgewählten Mitglieds laden');loadButton.type='button';loadButton.onclick=load;
  content=node('div');root.append(loadButton,status,content);view.append(root);clear();
  memberSelect.addEventListener('change',()=>{if(pending||busy||dirty&&!confirm('Ungespeicherte Nachweiskorrektur verwerfen?')){memberSelect.value=memberId;status.textContent='Bitte den laufenden Vorgang zuerst abwarten bzw. erneut prüfen.';return;}clearMember();});
  content.addEventListener('input',()=>{dirty=true;});
  content.addEventListener('change',()=>{dirty=true;});
  g.addEventListener('beforeunload',event=>{if(dirty||pending||busy){event.preventDefault();event.returnValue='';}});
 }
 function beforeView(view){if(view==='settingsPortalView')return true;if(busy||pending){status.textContent='Bitte die Nachweisänderung zuerst abwarten oder die Speicherung erneut prüfen.';return false;}if(dirty&&!confirm('Ungespeicherte Nachweiskorrektur verwerfen?'))return false;clear();return true;}
 g.PortalEvidenceAdmin={clear,beforeView,loadOverview,hasUnsaved:()=>dirty||!!pending||busy};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
