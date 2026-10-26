/* Public Motorola sheet, rendered locally with the shared PDF viewer. */
(function(g){
 'use strict';
 const $=id=>document.getElementById(id);let book=null,request=null,epoch=0;
 function close(){epoch++;request?.abort();request=null;book?.destroy();book=null;const dialog=$('training-reader');if(dialog?.open)dialog.close();if(dialog)dialog.hidden=true;}
 function state(value){$('training-page').value=value.pageNumber+' / '+value.pageCount;$('training-prev').disabled=value.pageNumber<=1;$('training-next').disabled=value.pageNumber>=value.pageCount;$('training-minus').disabled=value.zoom<=1.01;}
 async function open(){close();const version=epoch,dialog=$('training-reader');dialog.hidden=false;dialog.showModal();$('training-reader-status').textContent='Anleitung wird geöffnet …';
  try{request=new AbortController();const response=await fetch(new URL('assets/training/motorola-bw-2025.pdf',document.baseURI),{credentials:'omit',signal:request.signal});if(!response.ok)throw Error('PDF konnte nicht geladen werden.');const bytes=new Uint8Array(await response.arrayBuffer());if(version!==epoch)return;
   book=g.PlanZoom.create($('training-reader-map'),bytes,{pageNumber:2,label:'Motorola-Kurzanleitung Baden-Württemberg',onChange:state,onSwipe:direction=>turn(book.pageNumber+direction)});await book.ready;if(version===epoch)$('training-reader-status').textContent='Zwei Finger zum Zoomen · Wischen zum Blättern';
  }catch(e){if(version===epoch)$('training-reader-status').textContent='Anleitung noch nicht offline gespeichert. Bitte einmal online öffnen.';}
 }
 async function turn(number){if(!book)return;try{await book.goToPage(number);}catch{$('training-reader-status').textContent='Seite konnte nicht angezeigt werden.';}}
 function init(){document.querySelectorAll('[data-training-reader]').forEach(button=>button.addEventListener('click',open));$('training-reader-close')?.addEventListener('click',close);$('training-reader')?.addEventListener('close',()=>{if(!$('training-reader').hidden)close();});$('training-prev')?.addEventListener('click',()=>{if(book)turn(book.pageNumber-1);});$('training-next')?.addEventListener('click',()=>{if(book)turn(book.pageNumber+1);});$('training-plus')?.addEventListener('click',()=>book?.zoomIn());$('training-minus')?.addEventListener('click',()=>book?.zoomOut());$('training-fit')?.addEventListener('click',()=>book?.reset());g.addEventListener('portal-pagechange',event=>{if(event.detail?.page!=='radio-device')close();});g.addEventListener('pagehide',close);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
