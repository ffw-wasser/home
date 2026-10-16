(function(g){
 'use strict';const M=g.TheaterModel,$=id=>document.getElementById('theater-phone-'+id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};let event=null,counts={},pending=null,busy=false,key='',epoch=0,cancellation=false;
 function status(text){$('status').textContent=text;}
 function remember(){try{sessionStorage.setItem(key,JSON.stringify({event,counts,pending,cancellation}));}catch{throw Error('Bestellung kann auf diesem Handy nicht zwischengespeichert werden. Bitte Speicherzugriff erlauben.');}}
 function connect(access){const next=access.origin+':'+access.alias+':'+access.revision;if(key==='theater:'+next)return;clear();key='theater:'+next;try{const old=JSON.parse(sessionStorage.getItem(key)||'null');if(old){event=old.event;counts=old.counts||{};pending=old.pending;cancellation=old.cancellation===true||Object.values(counts).some(n=>n<0);}}catch{}paint();if(!document.getElementById('portal-page-theater').hidden)load();}
 function clear(){epoch++;event=null;counts={};pending=null;busy=false;key='';cancellation=false;if($('search'))$('search').value='';if($('items'))paint();}
 function selection(){return Object.values(counts).some(n=>n!==0);}
 function summary(){
  $('title').textContent=event?.title||'Theater';$('confirm').textContent=pending?'Übertragung erneut prüfen':cancellation?'Storno senden':'Bestellung senden';
  $('confirm').disabled=busy||!event||(!pending&&!selection());$('refresh').disabled=busy||!!pending;
  $('mode').disabled=busy||!!pending;$('mode').setAttribute('aria-pressed',String(cancellation));$('mode').textContent=cancellation?'Storno an':'Storno';
  $('mode-note').textContent=cancellation?'Storno aktiv: Artikel antippen, um eine Rückgabe vorzumerken. Minus nimmt sie wieder zurück.':'';
  $('mode-note').dataset.state=cancellation?'cancellation':'normal';
  $('total').textContent=(cancellation?'Storno gesamt: ':'Gesamt: ')+M.money(event?event.items.reduce((n,p)=>n+p.cents*(counts[p.id]||0),0):0);
 }
 function changeMode(){if(busy||pending)return;if(selection()){status('Bitte zuerst die aktuelle Auswahl senden oder mit Minus auf null setzen. Danach kannst du den Modus wechseln.');return;}cancellation=!cancellation;paint();try{remember();}catch(e){status(e.message);}}
 function paint(){
  const root=$('items'),nav=$('categories');if(!root)return;root.replaceChildren();nav.replaceChildren();summary();
  if(!event)return;const query=String($('search').value||'').trim().toLocaleLowerCase('de');
  const active=event.items.filter(p=>p.active),categories=[...new Set(active.map(p=>M.categoryName(p.category)))];let shown=0;
  for(const [index,category] of categories.entries()){
   const items=active.filter(p=>M.categoryName(p.category)===category&&(!query||(p.name+' '+category).toLocaleLowerCase('de').includes(query)));if(!items.length)continue;shown+=items.length;
   const color=M.categoryColor(category,event.items),section=node('section'),heading=node('h3',category),grid=node('div'),tab=node('button',category);
   section.className='theater-product-group';section.id='theater-product-group-'+index;section.style.setProperty('--category-color',color);grid.className='theater-product-grid';
   tab.type='button';tab.style.setProperty('--category-color',color);tab.setAttribute('aria-controls',section.id);tab.onclick=()=>section.scrollIntoView({block:'start',behavior:'auto'});nav.append(tab);section.append(heading,grid);
   for(const p of items){
    const card=node('div'),add=node('button'),minus=node('button','−'),quantity=node('span'),price=node('span',M.money(p.cents)),name=node('strong',p.name);
    card.className='theater-product';card.dataset.item=p.id;add.type=minus.type='button';add.className='theater-product-add';minus.className='theater-product-minus';price.className='theater-product-price';quantity.className='theater-product-quantity';quantity.setAttribute('aria-live','polite');
    add.append(name,price,quantity);card.append(add,minus);grid.append(card);
    const update=()=>{const q=counts[p.id]||0;card.dataset.state=q<0?'cancellation':q>0?'selected':'empty';quantity.textContent=q<0?'Storno: '+Math.abs(q):q+' ×';minus.disabled=busy||!!pending||q===0;add.disabled=busy||!!pending||Math.abs(q)>=99;add.setAttribute('aria-label',p.name+', '+M.money(p.cents)+(cancellation?', ein Stück stornieren':', ein Stück hinzufügen'));minus.setAttribute('aria-label',p.name+': ein vorgemerktes Stück zurücknehmen');};
    const change=remove=>{if(busy||pending)return;const q=counts[p.id]||0,direction=q?Math.sign(q):(cancellation?-1:1);counts[p.id]=remove?q-Math.sign(q):Math.max(-99,Math.min(99,q+direction));if(!counts[p.id])delete counts[p.id];update();summary();try{remember();}catch(e){status(e.message);}};
    add.onclick=()=>change(false);minus.onclick=()=>change(true);update();
   }root.append(section);
  }
  if(!shown)root.append(node('p',query?'Keine passenden Artikel. Bitte Suche ändern.':'Keine aktiven Artikel vorhanden.'));
 }
 async function load(){if(busy||pending)return;const generation=epoch;busy=true;$('refresh').hidden=true;paint();status('Preisliste wird geladen …');try{const result=await g.H2OPortal.api('theater/events');if(generation!==epoch)return;const next=result.events[0]||null;if(next?.id!==event?.id)counts={};else if(next&&event&&next.version!==event.version){counts=Object.fromEntries(Object.entries(counts).filter(([id])=>next.items.some(p=>p.id===id&&p.active)));}const changed=event&&next&&event.version!==next.version;event=next;remember();status(event?(changed?'Preisliste geändert. Bitte Auswahl und Summe prüfen.':''):'Zurzeit ist keine Theater-Veranstaltung geöffnet.');}catch(e){if(generation===epoch){$('refresh').hidden=false;status(e.message+' Bitte erneut laden.');}}finally{if(generation===epoch){busy=false;paint();}}}
 async function submit(){if(busy||!event)return;const generation=epoch;if(!pending){const lines=Object.entries(counts).filter(([,q])=>q!==0).map(([id,quantity])=>({id,quantity}));if(!lines.length)return;if(lines.some(p=>p.quantity<0)&&!confirm('Minusmengen als Storno senden?\n'+lines.filter(p=>p.quantity<0).map(p=>p.quantity+' × '+event.items.find(i=>i.id===p.id).name).join('\n')))return;pending={eventId:event.id,version:event.version,requestId:crypto.randomUUID(),lines};try{remember();}catch(e){pending=null;status(e.message);return;}}busy=true;paint();status('Bestellung wird übertragen …');try{const result=await g.H2OPortal.api('theater/order',pending);if(generation!==epoch)return;if(result.ok!==true||result.id!==pending.requestId)throw Error('Übertragung nicht eindeutig bestätigt.');pending=null;counts={};cancellation=false;$('search').value='';remember();status('✓ Bestellung ist am iPad angekommen. Nächsten Gast aufnehmen.');}catch(e){if(generation===epoch){$('refresh').hidden=!!pending;if([400,401,403,409].includes(e.status)){pending=null;$('refresh').hidden=false;try{remember();}catch{}}status(e.message+(pending?' Bitte „Übertragung erneut prüfen“ wählen.':' Bitte erneut laden.'));}}finally{if(generation===epoch){busy=false;paint();}}}
 function init(){$('search').oninput=paint;$('mode').onclick=changeMode;$('refresh').onclick=load;$('confirm').onclick=submit;$('open').onclick=()=>g.DeckelMobile.jump('theater-phone-section');$('close').onclick=()=>g.DeckelMobile.jump('deckel-more');g.addEventListener('portal-pagechange',e=>{if(e.detail.page==='theater-phone-section'){if(pending){paint();status('Eine Übertragung ist noch unbestätigt. Bitte erneut prüfen.');}else load();}});g.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});}
 g.TheaterPhone={connect,clear,beforeLeave:()=>confirm('Bestellansicht wirklich schließen? Deine aktuelle Auswahl und eine ausstehende Übertragung bleiben erhalten.'),hasUnsaved:()=>!!pending||Object.values(counts).some(n=>n!==0)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
