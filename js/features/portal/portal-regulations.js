/* Public PDFs open only on request, without sending portal credentials. */
(function(g){
'use strict';
const $=id=>document.getElementById(id),M=g.RegulationsModel;
let generation=0,adminGeneration=0,version=0,draft=[],saving=false,catalogue=[];
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function closePdf(){generation++;const frame=$('regulations-frame');frame?.removeAttribute('src');if($('regulations-reader'))$('regulations-reader').hidden=true;if($('regulations-list'))$('regulations-list').hidden=false;if($('regulations-search-area'))$('regulations-search-area').hidden=false;}
function openPdf(item){
 const url=M.pdfUrl(item.url);if(!url)return;
 $('regulations-reader-title').textContent=item.label+' · '+item.title;
 $('regulations-original').href=url;$('regulations-frame').src=url+'#view=FitH';
 $('regulations-list').hidden=true;$('regulations-search-area').hidden=true;$('regulations-reader').hidden=false;$('regulations-reader-title').focus({preventScroll:true});
 $('deckel-main').scrollTo({top:0,behavior:'instant'});
}
function render(items){
 catalogue=items;filter();
}
function filter(){
 const query=($('regulations-search').value||'').toLocaleLowerCase('de').trim().split(/\s+/).filter(Boolean),items=catalogue.filter(item=>query.every(word=>(item.label+' '+item.title).toLocaleLowerCase('de').includes(word)));
 $('regulations-search-status').textContent=query.length?items.length+' von '+catalogue.length+' Vorschriften gefunden.':'';
 const list=$('regulations-list');list.replaceChildren();
 if(!items.length){list.append(node('p',catalogue.length?'Keine passende Dienstvorschrift gefunden. Suchbegriff ändern oder das Suchfeld leeren.':'Noch keine Dienstvorschriften hinterlegt.'));return;}
 for(const item of items){const card=node('article'),label=node('p',item.label),title=node('h3',item.title),date=node('p','Quelle aktualisiert: '+item.sourceUpdated.split('-').reverse().join('.')),button=node('button','PDF öffnen');
  card.className='regulation-card';label.className='eyebrow';date.className='note';button.type='button';button.setAttribute('aria-label',item.label+' – '+item.title+' öffnen');button.addEventListener('click',()=>openPdf(item));card.append(label,title,date,button);list.append(card);
 }
}
async function load(){
 closePdf();const epoch=generation;render(M.defaults());$('regulations-status').textContent='Gespeicherte Auswahl wird geprüft …';
 try{const data=await g.H2OPortal.api('regulations');if(epoch!==generation)return;render(M.validate(data.items));$('regulations-status').textContent='Quelle: Landesfeuerwehrschule Baden-Württemberg. Die Datumsangabe bezeichnet die Aktualisierung der Quelle.';}
 catch(e){if(epoch===generation)$('regulations-status').textContent='Die gespeicherte Auswahl konnte nicht geladen werden. Angezeigt wird die Grundauswahl. '+(g.ConnectionStatus?.message(e)||e.message);}
}
function assertAdmin(){if(!g.requireAdmin('plansView'))throw Error('Bitte die Verwaltung entsperren.');}
async function adminRequest(data={}){
 assertAdmin();const c=await g.DrinksCentral.connection();assertAdmin();if(!c)throw Error('Bitte zuerst den bestehenden Kontodienst verbinden.');
 const result=await g.DrinksPush.request(c,'/admin/portal/regulations',{source:c.source,...data});assertAdmin();if(g.DrinksStore&&g.DrinksStore.sourceKey()!==c.source)throw Error('Mitgliederordner wurde geändert. Bitte erneut laden.');return result;
}
function editor(){
 const host=$('regulations-admin-items');host.replaceChildren();
 draft.forEach((item,index)=>{const card=node('fieldset'),legend=node('legend',item.label||'Neue Vorschrift');card.className='regulation-card';card.append(legend);
  for(const [key,label,type] of [['label','Kurzbezeichnung','text'],['title','Vollständiger Titel','text'],['sourceUpdated','Quelle aktualisiert am','date'],['url','Offizieller PDF-Link der Landesfeuerwehrschule','url']]){
   const wrapper=node('label',label),input=node('input');input.type=type;input.value=item[key];input.required=true;input.maxLength=key==='title'?180:key==='url'?500:40;input.addEventListener('input',()=>{item[key]=input.value;});wrapper.append(input);card.append(wrapper);
  }
  const actions=node('div');actions.className='regulation-actions';
  for(const [label,action,disabled] of [['Nach oben',()=>{[draft[index-1],draft[index]]=[draft[index],draft[index-1]];editor();},index===0],['Nach unten',()=>{[draft[index+1],draft[index]]=[draft[index],draft[index+1]];editor();},index===draft.length-1],['Entfernen',()=>{draft.splice(index,1);editor();},false]]){
   const button=node('button',label);button.type='button';button.className='outline-button';button.disabled=disabled;button.addEventListener('click',action);actions.append(button);
  }
  card.append(actions);host.append(card);
 });
}
async function adminLoad(){
 if(saving)return;
 const epoch=++adminGeneration;try{const data=await adminRequest();if(epoch!==adminGeneration)return;version=data.version;draft=M.validate(data.items);editor();$('regulations-admin-editor').hidden=false;$('regulations-admin-status').textContent='Auswahl geladen. Änderungen anschließend zentral speichern.';}
 catch(e){$('regulations-admin-status').textContent=g.ConnectionStatus?.message(e)||e.message;}
}
async function adminSave(event){
 event.preventDefault();if(saving)return;saving=true;$('regulations-admin-save').disabled=true;$('regulations-admin-editor').inert=true;$('regulations-admin-load').disabled=true;
 try{const items=M.validate(draft),data=await adminRequest({items,expectedVersion:version});version=data.version;$('regulations-admin-status').textContent='Dienstvorschriften und Reihenfolge zentral gespeichert.';}
 catch(e){$('regulations-admin-status').textContent=g.ConnectionStatus?.message(e)||e.message;}
 finally{saving=false;$('regulations-admin-save').disabled=false;$('regulations-admin-editor').inert=false;$('regulations-admin-load').disabled=false;}
}
function init(){
 $('regulations-search')?.addEventListener('input',filter);
 $('regulations-back')?.addEventListener('click',()=>{closePdf();$('regulations-list').querySelector('button')?.focus();});
 $('regulations-admin-load')?.addEventListener('click',adminLoad);$('regulations-admin-editor')?.addEventListener('submit',adminSave);
 $('regulations-admin-add')?.addEventListener('click',()=>{if(draft.length>=20)return;draft.push({id:crypto.randomUUID(),label:'',title:'',sourceUpdated:new Date().toISOString().slice(0,10),url:''});editor();});
 g.addEventListener('portal-pagechange',event=>{if(!$('more-regulations'))return;if(event.detail?.page==='more-regulations')load();else closePdf();});
 g.addEventListener('pagehide',closePdf);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
