/* Public PDFs open only on request, without sending portal credentials. */
(function(g){
'use strict';
const $=id=>document.getElementById(id),M=g.RegulationsModel;
let generation=0,adminGeneration=0,version=0,draft=[],saving=false,catalogue=[],book=null,currentItem=null,pdfRequest=null;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function closePdf(){
 generation++;const active=book;book=null;currentItem=null;const reader=$('regulations-reader');if(reader?.open)reader.close();if(reader)reader.hidden=true;
 if($('regulations-list'))$('regulations-list').hidden=false;if($('regulations-search-area'))$('regulations-search-area').hidden=false;
 pdfRequest?.abort();pdfRequest=null;try{active?.destroy();}catch{}
}
async function readPdf(item,signal){
 const files=M.bundledParts(item.url);if(!files)return g.H2OPortal.api('regulations/pdf',{url:item.url},{signal});
 const chunks=[];let size=0;
 for(const file of files){const response=await fetch(new URL(file,document.baseURI),{credentials:'omit',referrerPolicy:'no-referrer',signal});if(!response.ok)throw Error('Die Vorschrift konnte nicht geladen werden. Bitte erneut versuchen oder das Original öffnen.');const chunk=new Uint8Array(await response.arrayBuffer());size+=chunk.length;if(size>30*1024*1024)throw Error('Die PDF ist zu groß. Bitte das Original öffnen.');chunks.push(chunk);}
 const bytes=chunks.length===1?chunks[0]:new Uint8Array(size);if(chunks.length>1){let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}}
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Die PDF ist unvollständig. Bitte erneut laden.');return bytes;
}
function bookState(state){
 $('regulations-page').value=state.pageNumber;$('regulations-page').max=state.pageCount;$('regulations-pages').textContent='von '+state.pageCount;
 $('regulations-prev').disabled=state.pageNumber<=1;$('regulations-next').disabled=state.pageNumber>=state.pageCount;
 $('regulations-zoom-out').disabled=state.zoom<=1.01;$('regulations-zoom-in').disabled=state.zoom>=32;
}
async function turn(number){
 if(!book)return;const epoch=generation;
 try{await book.goToPage(number);}catch(e){if(epoch===generation)$('regulations-book-status').textContent='Seite konnte nicht geöffnet werden. Bitte erneut versuchen.';}
}
async function openPdf(item){
 const url=M.pdfUrl(item.url);if(!url)return;closePdf();currentItem=item;const epoch=generation;
 $('regulations-reader-title').textContent=item.label+' · '+item.title;$('regulations-original').href=url;
 $('regulations-list').hidden=true;$('regulations-search-area').hidden=true;$('regulations-reader').hidden=false;$('regulations-reader').showModal();
 $('regulations-book-status').textContent='Buch wird geladen …';$('regulations-book-tools').hidden=true;$('regulations-book-map').hidden=true;$('regulations-retry').hidden=true;
 try{
  const controller=new AbortController();pdfRequest=controller;const timeout=setTimeout(()=>controller.abort(),20000);let bytes;try{bytes=await readPdf(item,controller.signal);}finally{clearTimeout(timeout);if(pdfRequest===controller)pdfRequest=null;}if(epoch!==generation)return;
  book=g.PlanZoom.create($('regulations-book-map'),bytes,{label:item.label+' · '+item.title,onChange:bookState,onSwipe:direction=>turn(book.pageNumber+direction)});
  let renderTimer;try{await Promise.race([book.ready,new Promise((_,reject)=>{renderTimer=setTimeout(()=>reject(Error('Die Buchansicht braucht zu lange. Bitte erneut laden oder das Original öffnen.')),12000);})]);}finally{clearTimeout(renderTimer);}if(epoch!==generation)return;
  $('regulations-book-tools').hidden=false;$('regulations-book-status').textContent='Wischen zum Blättern · Mit zwei Fingern zoomen';$('regulations-book-map').focus({preventScroll:true});
 }catch(e){if(epoch!==generation)return;try{book?.destroy();}catch{}book=null;$('regulations-book-map').hidden=true;$('regulations-book-status').textContent='Das Buch konnte nicht geladen werden. '+(g.ConnectionStatus?.message(e)||e.message);$('regulations-retry').hidden=false;}
}
function render(items){
 catalogue=items;filter();
}
function filter(){
 const query=($('regulations-search').value||'').toLocaleLowerCase('de').trim().split(/\s+/).filter(Boolean),items=catalogue.filter(item=>query.every(word=>(item.label+' '+item.title).toLocaleLowerCase('de').includes(word)));
 $('regulations-search-status').textContent=query.length?items.length+' von '+catalogue.length+' Vorschriften gefunden.':'';
 const list=$('regulations-list');list.replaceChildren();
 if(!items.length){list.append(node('p',catalogue.length?'Keine passende Dienstvorschrift gefunden. Suchbegriff ändern oder das Suchfeld leeren.':'Noch keine Dienstvorschriften hinterlegt.'));return;}
 for(const item of items){const card=node('article'),label=node('p',item.label),title=node('h3',item.title),date=node('p','Quelle aktualisiert: '+item.sourceUpdated.split('-').reverse().join('.')),button=node('button','Als Buch öffnen');
  card.className='regulation-card';label.className='eyebrow';date.className='note';button.type='button';button.setAttribute('aria-label',item.label+' – '+item.title+' öffnen');button.addEventListener('click',()=>openPdf(item));card.append(label,title,date,button);list.append(card);
 }
}
async function load(){
 closePdf();const epoch=generation;render(M.defaults());$('regulations-status').textContent='Grundauswahl · lokal verfügbare FwDV';if(g.navigator?.onLine===false)return;
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
 $('regulations-original')?.addEventListener('click',closePdf);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&$('regulations-reader')?.open)closePdf();});
 $('regulations-reader')?.addEventListener('close',()=>{if(!$('regulations-reader').open&&!$('regulations-reader').hidden)closePdf();});
 $('regulations-prev')?.addEventListener('click',()=>turn(book.pageNumber-1));$('regulations-next')?.addEventListener('click',()=>turn(book.pageNumber+1));
 $('regulations-page')?.addEventListener('change',()=>turn($('regulations-page').value));
 $('regulations-zoom-in')?.addEventListener('click',()=>book?.zoomIn());$('regulations-zoom-out')?.addEventListener('click',()=>book?.zoomOut());$('regulations-zoom-fit')?.addEventListener('click',()=>book?.reset());
 $('regulations-retry')?.addEventListener('click',()=>{if(currentItem)openPdf(currentItem);});
 $('regulations-reader')?.addEventListener('keydown',event=>{if(!book||event.target.tagName==='INPUT')return;if(event.key==='PageDown'||event.key==='PageUp'){event.preventDefault();turn(book.pageNumber+(event.key==='PageDown'?1:-1));}});
 $('regulations-back')?.addEventListener('click',()=>{closePdf();$('regulations-list').querySelector('button')?.focus();});
 $('regulations-admin-load')?.addEventListener('click',adminLoad);$('regulations-admin-editor')?.addEventListener('submit',adminSave);
 $('regulations-admin-add')?.addEventListener('click',()=>{if(draft.length>=20)return;draft.push({id:crypto.randomUUID(),label:'',title:'',sourceUpdated:new Date().toISOString().slice(0,10),url:''});editor();});
 g.addEventListener('portal-pagechange',event=>{if(!$('more-regulations'))return;if(event.detail?.page==='more-regulations')load();else closePdf();});
 g.addEventListener('pagehide',closePdf);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
