/* Review/correct personal evidence through the existing authenticated administration. */
(function(g){
 'use strict';
 const labels={g262:'G26.2',g263:'G26.3',instruction:'Sicherheitsunterweisung',ffi:'FFI',driver:'Führerscheinkontrolle'};
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let root,content,status,loadButton,memberSelect,snapshot=null,memberId='',pending=null,busy=false,epoch=0,needsReload=false,dirty=false;
 function clear(){epoch++;snapshot=null;memberId='';pending=null;busy=false;needsReload=false;dirty=false;content?.replaceChildren();if(status)status.textContent='Mitglied oben auswählen und persönliche Portalnachweise laden.';if(loadButton)loadButton.disabled=false;}
 function admin(){if(!g.requireAdmin('settingsPortalView'))throw Error('Bitte die Verwaltung entsperren.');}
 async function request(path,data){
  admin();const c=await g.DrinksCentral.connection();if(!c)throw Error('Kontodienst nicht verbunden.');
  const result=await g.DrinksPush.request(c,'/admin/portal/'+path,{source:c.source,...data});
  admin();if(g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert. Bitte neu laden.');return result;
 }
 const stamp=entry=>(entry.source==='self'?'Eigenangabe':'Verwaltung')+(entry.status==='pending'?' · Bestätigung ausstehend':entry.status==='rejected'?' · Abgelehnt':'')+(entry.updatedAt?' · '+new Date(entry.updatedAt).toLocaleString('de-DE'):'');
 function controls(){if(loadButton)loadButton.disabled=busy||!!pending;for(const e of content.querySelectorAll('button,input'))e.disabled=busy||!!pending||needsReload;const retry=content.querySelector('[data-evidence-retry]');if(retry){retry.hidden=!pending;retry.disabled=busy||needsReload;}}
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
  try{const result=await request('evidence/review',job);if(version!==epoch)return;if(result.ok!==true||result.receipt!==job.requestId)throw Error('Speicherung nicht eindeutig bestätigt.');pending=null;dirty=false;snapshot=result;paint();status.textContent='Nachweisänderung gespeichert und protokolliert.';}
  catch(e){if(version===epoch){if([400,401,403,404,409].includes(e.status)){pending=null;needsReload=true;}status.textContent=e.message+(pending?' Speicherung unbestätigt. Bitte erneut prüfen.':' Bitte Nachweise neu laden.');}}
  finally{if(version===epoch){busy=false;controls();}}
 }
 function paint(){
  content.replaceChildren();if(!snapshot?.entries)return;
  for(const [field,label] of Object.entries(labels)){
   if(!(field==='driver'?snapshot.eligibility.driver:snapshot.eligibility.agt))continue;
   const entry=snapshot.entries[field],card=node('article');card.className='portal-evidence-review-card';
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
  status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  loadButton=node('button','Portalnachweise des ausgewählten Mitglieds laden');loadButton.type='button';loadButton.onclick=load;
  content=node('div');root.append(loadButton,status,content);view.append(root);clear();
  memberSelect.addEventListener('change',()=>{if(pending||busy||dirty&&!confirm('Ungespeicherte Nachweiskorrektur verwerfen?')){memberSelect.value=memberId;status.textContent='Bitte den laufenden Vorgang zuerst abwarten bzw. erneut prüfen.';return;}clear();});
  content.addEventListener('input',()=>{dirty=true;});
  content.addEventListener('change',()=>{dirty=true;});
  g.addEventListener('beforeunload',event=>{if(dirty||pending||busy){event.preventDefault();event.returnValue='';}});
 }
 function beforeView(view){if(view==='settingsPortalView')return true;if(busy||pending){status.textContent='Bitte die Nachweisänderung zuerst abwarten oder die Speicherung erneut prüfen.';return false;}if(dirty&&!confirm('Ungespeicherte Nachweiskorrektur verwerfen?'))return false;clear();return true;}
 g.PortalEvidenceAdmin={clear,beforeView,hasUnsaved:()=>dirty||!!pending||busy};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
