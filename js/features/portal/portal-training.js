/* Protected training: authenticated service data, memory only, no public assets. */
(function(g){
'use strict';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let epoch=0,url='',busy=false,uploading=false,dialog=null;const originalSteps=[];
function clear(){
 epoch++;busy=false;if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null;}
 for(const {span,children} of originalSteps)span.replaceChildren(...children.map(n=>n.cloneNode(true)));
 $('radio-private-content')?.replaceChildren();if(url)URL.revokeObjectURL(url);url='';
 if($('radio-private-status'))$('radio-private-status').textContent='Nur für verifizierte Feuerwehrmitglieder. Bitte persönlich anmelden.';
 if($('radio-private-retry'))$('radio-private-retry').hidden=true;
}
function section(title){const card=node('section');card.className='training-card';card.append(node('h3',title));return card;}
async function load(){
 clear();if(!g.H2OPortal?.hasAccess()||g.H2OPortal.isFitnessTrainer?.())return;
 const current=epoch;busy=true;$('radio-private-status').textContent='Örtliche Unterlagen werden geschützt geladen …';
 try{
  const {material}=await g.H2OPortal.api('training');if(current!==epoch)return;
  if(!material||material.schemaVersion!==1||!Array.isArray(material.steps)||material.steps.length!==6||!Array.isArray(material.groups)||!Array.isArray(material.notes)||material.image?.mime!=='image/jpeg')throw Error('Die Funkunterlagen sind ungültig.');
  const raw=atob(material.image.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==material.image.sha256)throw Error('Die Anleitung konnte nicht geprüft werden.');if(current!==epoch)return;
  url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
  const content=$('radio-private-content');content.append(node('h3',material.title));
  originalSteps.forEach(({span,title},i)=>{const text=material.steps[i].trim();span.replaceChildren(node('strong',title),node('br'),document.createTextNode(text.startsWith(title)?text.slice(title.length).trim():text));});
  const groups=section('Funkgruppen im Überblick');for(const mode of ['TMO','DMO']){groups.append(node('h4',mode==='TMO'?'TMO · Netzbetrieb':'DMO · Einsatzstellenfunk'));const dl=node('dl');dl.className='radio-group-list';for(const group of material.groups.filter(v=>v.mode===mode)){const row=node('div');row.append(node('dt',group.code),node('dd',group.label));dl.append(row);}groups.append(dl);}content.append(groups);
  const notes=section('Örtliche Hinweise');for(const text of material.notes)notes.append(node('p',text));content.append(notes);
  const original=node('details');original.className='radio-original';original.append(node('summary','Kurzanleitung öffnen'));
  const image=node('img');image.src=url;image.alt='Geschützte örtliche MXP600-Kurzanleitung';original.append(image);
  const enlarge=node('button','Bild vergrößern');enlarge.type='button';enlarge.onclick=()=>{
   if(!url||current!==epoch)return;if(dialog)dialog.remove();dialog=node('dialog');dialog.className='radio-private-dialog';const close=node('button','Schließen');close.type='button';close.onclick=()=>dialog?.close();const full=node('img');full.src=url;full.alt=image.alt;dialog.append(close,full);document.body.append(dialog);dialog.showModal();
  };original.append(enlarge);content.append(original);$('radio-private-status').textContent='Nur für verifizierte Mitglieder · keine Offline-Ablage.';
 }catch(e){if(current===epoch){$('radio-private-status').textContent=e.message||'Unterlagen konnten nicht geladen werden.';$('radio-private-retry').hidden=false;}}
 finally{if(current===epoch)busy=false;}
}
async function upload(){
 if(uploading)return;if(typeof requireAdmin==='function'&&!requireAdmin('plansView'))return;
 const status=$('training-admin-status'),button=$('training-admin-upload'),input=$('training-admin-file');
 const assertAdmin=()=>{if(typeof adminUnlocked==='undefined'||!adminUnlocked||!g.oneDriveAdministrationReady?.())throw Error('Bitte Verwaltung entsperren und OneDrive verbinden.');};
 uploading=true;button.disabled=true;
 try{
  assertAdmin();const file=input.files?.[0];if(!file||file.size>740000)throw Error('Bitte ein gültiges privates Importpaket bis 740 KB wählen.');
  const material=JSON.parse(await file.text());assertAdmin();const c=await g.DrinksCentral.connection();assertAdmin();if(!c)throw Error('Bitte zuerst den zentralen Kontodienst verbinden.');
  const call=data=>{assertAdmin();return g.DrinksPush.request(c,'/admin/portal/training',{source:c.source,...data});};
  status.textContent='Unterlagen werden geschützt bereitgestellt …';const {version}=await call({});await call({material,expectedVersion:version});assertAdmin();input.value='';status.textContent='Funkunterlagen sind ausschließlich für verifizierte Feuerwehrmitglieder bereitgestellt.';
 }catch(e){status.textContent=e instanceof SyntaxError?'Das Importpaket ist kein gültiges JSON.':e.message;}
 finally{uploading=false;button.disabled=false;}
}
function init(){
 for(const span of document.querySelectorAll('#radio-device .radio-daily-steps li>span'))originalSteps.push({span,title:span.querySelector('strong').textContent,children:[...span.childNodes].map(n=>n.cloneNode(true))});
 $('radio-private-retry')?.addEventListener('click',()=>{if(!busy)load();});$('training-admin-upload')?.addEventListener('click',upload);
 g.addEventListener('portal-pagechange',event=>{if(event.detail?.page==='radio-device'&&$('radio-private'))load();else clear();});
 g.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else if($('portal-page-radio-device')&&!$('portal-page-radio-device').hidden)load();});
}
g.PortalTraining={clear};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
