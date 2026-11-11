/* Protected training: authenticated service data, memory only, no public assets. */
(function(g){
'use strict';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let epoch=0,url='',busy=false,dialog=null,syncing=false,lastSync=0,syncSource='';const originalSteps=[],shells=new Map();const trainingPages=new Set(['more-training','training-breathing','breathing-basics','breathing-emergency','training-competition','competition-bronze','competition-silver','competition-gold','training-radio','radio-device','radio-status','radio-examples']);
function clear(){
 epoch++;busy=false;if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null;}
 originalSteps.length=0;for(const [id,shell] of shells){const page=$('portal-page-'+id);page?.replaceChildren(shell.cloneNode(true));}
 $('radio-private-content')?.replaceChildren();if(url)URL.revokeObjectURL(url);url='';
 if($('radio-private-status'))$('radio-private-status').textContent='Nur für verifizierte Feuerwehrmitglieder. Bitte persönlich anmelden.';
 if($('radio-private-retry'))$('radio-private-retry').hidden=true;
}
function section(title){const card=node('section');card.className='training-card';card.append(node('h3',title));return card;}
async function load(pageId='radio-device'){
 clear();const status=$('portal-page-'+pageId)?.querySelector('[role=status]');if(!g.H2OPortal?.hasAccess()||g.H2OPortal.isFitnessTrainer?.())return;
 const current=epoch;busy=true;if(status)status.textContent='Örtliche Unterlagen werden geschützt geladen …';
 try{
  const {material}=await g.H2OPortal.api('training');if(current!==epoch)return;
  if(!material||!material.library||material.schemaVersion!==1||!Array.isArray(material.steps)||material.steps.length!==6||!Array.isArray(material.groups)||!Array.isArray(material.notes)||material.image?.mime!=='image/jpeg')throw Error('Die Ausbildungsunterlagen werden noch vom Gerätehaus bereitgestellt. Bitte die Gerätehaus-App aktualisieren.');
  if(material.library){
   for(const [id,html] of Object.entries(material.library)){if(!trainingPages.has(id))continue;const page=$('portal-page-'+id);if(!page)continue;const parsed=new DOMParser().parseFromString(html,'text/html');
    for(const n of parsed.querySelectorAll('script,iframe,object,embed,form,base,meta,link'))n.remove();
    for(const n of parsed.querySelectorAll('*'))for(const a of [...n.attributes])if(/^on/i.test(a.name)||['srcdoc','action','formaction'].includes(a.name)||['href','src','xlink:href'].includes(a.name)&&(!/^(?:https:\/\/|assets\/|#)/.test(a.value)||/javascript:/i.test(a.value)))n.removeAttribute(a.name);
    page.replaceChildren(...[...parsed.body.childNodes].map(n=>document.importNode(n,true)));
   }
  }
  for(const span of document.querySelectorAll('#radio-device .radio-daily-steps li>span'))originalSteps.push({span,title:span.querySelector('strong').textContent,children:[...span.childNodes].map(n=>n.cloneNode(true))});
  const raw=atob(material.image.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==material.image.sha256)throw Error('Die Anleitung konnte nicht geprüft werden.');if(current!==epoch)return;
  url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
  const content=$('radio-private-content');$('radio-private')?.querySelector(':scope > h3')?.remove();
  const illustrations=document.querySelector('#radio-device .radio-illustrations'),captions=[...illustrations?.querySelectorAll('figcaption')||[]];
  const captionText=caption=>[...caption.childNodes].filter(n=>n.nodeName!=='STRONG'&&n.nodeName!=='BR').map(n=>n.textContent).join(' ').trim();
  const commonCaption=captions.length>1?captionText(captions[0]):'';
  if(commonCaption&&captions.every(caption=>captionText(caption)===commonCaption)){
   for(const caption of captions){const heading=caption.querySelector('strong');if(heading)caption.replaceChildren(heading);}
   const note=illustrations.parentElement.querySelector(':scope > .note')||node('p');note.classList.add('note');
   const context=note.textContent.trim().match(/^[^.!?]+[.!?]?/)?.[0]||'';note.textContent=[context,commonCaption].filter(Boolean).join(' ');illustrations.after(note);
  }
  originalSteps.forEach(({span,title},i)=>{const text=material.steps[i].trim();span.replaceChildren(node('strong',title),node('br'),document.createTextNode(text.startsWith(title)?text.slice(title.length).trim():text));});
  const groups=section('Funkgruppen im Überblick');for(const mode of ['TMO','DMO']){groups.append(node('h4',mode==='TMO'?'TMO · Netzbetrieb':'DMO · Einsatzstellenfunk'));const dl=node('dl');dl.className='radio-group-list';for(const group of material.groups.filter(v=>v.mode===mode)){const row=node('div');row.append(node('dt',group.code),node('dd',group.label));dl.append(row);}groups.append(dl);}content.append(groups);
  const normalize=text=>text.trim().replace(/\s+/g,' ').toLocaleLowerCase('de');
  const notes=section('Örtliche Hinweise'),seenNotes=new Set();for(const text of material.notes){const key=normalize(text);if(!key||seenNotes.has(key)||material.steps.some(step=>normalize(step).includes(key)))continue;seenNotes.add(key);notes.append(node('p',text));}if(notes.children.length>1)content.append(notes);
  const original=node('details');original.className='radio-original';original.append(node('summary','Kurzanleitung öffnen'));
  const image=node('img');image.src=url;image.alt='Geschützte örtliche MXP600-Kurzanleitung';original.append(image);
  const enlarge=node('button','Bild vergrößern');enlarge.type='button';enlarge.onclick=()=>{
   if(!url||current!==epoch)return;if(dialog)dialog.remove();dialog=node('dialog');dialog.className='radio-private-dialog';const close=node('button','Schließen');close.type='button';close.onclick=()=>dialog?.close();const full=node('img');full.src=url;full.alt=image.alt;dialog.append(close,full);document.body.append(dialog);dialog.showModal();
  };original.append(enlarge);
  const manuals=new Set();for(const link of document.querySelectorAll('#radio-device .training-source-card a, #radio-private .radio-manual-link a')){if(manuals.has(link.href))continue;manuals.add(link.href);const p=node('p');p.className='radio-manual-link';p.append(link);original.append(p);}
  document.querySelectorAll('#radio-device .training-source-card, #radio-private > .radio-manual-link').forEach(card=>card.remove());
  content.append(original);$('radio-private-status').textContent='Nur für verifizierte Mitglieder · keine Offline-Ablage.';
 }catch(e){if(current===epoch&&status){status.textContent=e.message||'Unterlagen konnten nicht geladen werden.';}}
 finally{if(current===epoch)busy=false;}
}
async function sync(){
 if(!g.oneDriveAdministrationReady?.()||!g.oneDriveReadTraining||syncing)return;
 const source=g.DrinksStore?.sourceKey();if(source===syncSource&&Date.now()-lastSync<300000)return;
 syncing=true;const status=$('training-admin-status');
 const current=()=>{if(!g.oneDriveAdministrationReady?.()||source!==g.DrinksStore?.sourceKey())throw Error('Verbindung wurde geändert.');};
 try{current();const material=await g.oneDriveReadTraining();current();material.edition=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(material)))),v=>v.toString(16).padStart(2,'0')).join('').slice(0,48);current();const c=await g.DrinksCentral.connection();current();if(!c)return;
  const call=data=>{current();return g.DrinksPush.request(c,'/admin/portal/training',{source:c.source,...data});};
  const saved=await call({});if(!saved.configured||saved.edition!==material.edition)await call({material,expectedVersion:saved.version});current();syncSource=source;lastSync=Date.now();if(status)status.textContent='Ausbildungsunterlagen automatisch geschützt bereitgestellt.';
 }catch(e){lastSync=Date.now()-240000;syncSource=source;if(status)status.textContent='Ausbildungsunterlagen werden beim nächsten Abgleich erneut geladen: '+e.message;}
 finally{syncing=false;}
}
function init(){
 for(const id of trainingPages){const page=$('portal-page-'+id);if(page?.firstElementChild)shells.set(id,page.firstElementChild.cloneNode(true));}
 g.addEventListener('portal-pagechange',event=>{if(trainingPages.has(event.detail?.page))load(event.detail.page);else clear();});
 g.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else{for(const id of trainingPages)if($('portal-page-'+id)&&!$('portal-page-'+id).hidden){load(id);break;}sync();}});
 sync();
}
g.PortalTraining={clear,sync};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
