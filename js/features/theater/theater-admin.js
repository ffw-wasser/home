(function(g){
 'use strict';const M=g.TheaterModel,$=id=>document.getElementById('theater-'+id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};let events=[],current=null,orders=[],busy=false,loading=false,timer=null,epoch=0,mode='manage',draft=null,dirty=false,connection=null,selectedMember=null;
 const stateName={open:'Noch offen',reserved:'In Kasseneingabe',done:'In Kasse erfasst'};
 let soundContext=null,soundEnabled=false,observedEventId=null,knownOrderIds=null;
 function soundControls(note=''){
  const toggle=$('sound'),status=$('sound-status');if(!toggle||!status)return;
  toggle.setAttribute('aria-pressed',String(soundEnabled));
  toggle.textContent=soundEnabled?'🔔 Ton ausschalten':'🔔 Ton einschalten';
  status.textContent=note||(soundEnabled?'Ton aktiv · Neue Bestellungen werden mit einem Signal gemeldet.':'Ton aus · Zum Einschalten einmal antippen.');
 }
 function playNewOrderTone(preview=false){
  if(!soundEnabled||document.hidden||document.getElementById('theaterView').hidden)return;
  if(!soundContext||soundContext.state!=='running'){soundEnabled=false;soundControls('Ton pausiert · Bitte erneut auf „Ton einschalten“ tippen.');return;}
  try{
   const start=soundContext.currentTime+0.02;
   for(const [index,frequency] of [880,1175,1480,880,1175,1480].entries()){
    const at=start+index*0.18,osc=soundContext.createOscillator(),volume=soundContext.createGain();
    osc.type='square';osc.frequency.setValueAtTime(frequency,at);
    volume.gain.setValueAtTime(0,at);
    volume.gain.linearRampToValueAtTime(0.27,at+0.012);
    volume.gain.setValueAtTime(0.27,at+0.115);
    volume.gain.linearRampToValueAtTime(0,at+0.155);
    osc.connect(volume);volume.connect(soundContext.destination);osc.start(at);osc.stop(at+0.165);
   }
   soundControls(preview?'✓ Testton abgespielt · Alarm ist aktiv.':'🔔 Neue Bestellung eingegangen!');
  }catch(e){soundEnabled=false;soundControls('Ton konnte nicht abgespielt werden. Bitte erneut einschalten.');}
 }
 function noticeIncomingOrders(eventId,next){
  const incoming=observedEventId===eventId&&knownOrderIds&&next.some(o=>!knownOrderIds.has(o.id)&&o.state==='open'&&!o.cancels&&o.lines?.some(line=>line.quantity>0));
  observedEventId=eventId;knownOrderIds=new Set(next.map(o=>o.id));
  if(incoming)playNewOrderTone();
 }
 async function toggleSound(){
  if(soundEnabled){soundEnabled=false;soundControls();return;}
  const Ctor=g.AudioContext||g.webkitAudioContext;
  if(!Ctor){soundControls('Dieses Gerät unterstützt keine Browser-Töne.');return;}
  try{
   if(!soundContext)soundContext=new Ctor();
   if(soundContext.state!=='running')await soundContext.resume();
   if(soundContext.state!=='running')throw Error('Audiowiedergabe nicht freigegeben.');
   soundEnabled=true;soundControls();playNewOrderTone(true);
  }catch(e){soundEnabled=false;soundControls('Ton blockiert · Bitte iPad-Lautstärke prüfen und erneut tippen.');}
 }

 function message(text){$('status').textContent=text;if($('manage-status'))$('manage-status').textContent=text;if($('cash-status'))$('cash-status').textContent=text;}
 function guard(){if(!g.requireAdmin('theaterView'))throw Error('Bitte Verwaltung entsperren.');}
 async function api(action,data={}){guard();const c=connection||await g.DrinksCentral.connection();if(!c)throw Error('Bitte zuerst den Kontodienst unter Getränkeverwaltung verbinden.');guard();connection=c;return g.DrinksPush.request(c,'/admin/portal/theater/'+action,{source:c.source,...data});}
 function button(label,fn){const b=node('button',label);b.type='button';b.onclick=fn;return b;}
 function schedule(){clearTimeout(timer);if(!document.getElementById('theaterView').hidden&&!document.hidden&&mode!=='manage')timer=setTimeout(()=>load(false),5000);}
 function moveTarget(id,direction){const items=draft?.items||[],from=items.findIndex(p=>p.id===id);if(from<0)return -1;for(let i=from+direction;i>=0&&i<items.length;i+=direction)if(items[i].category.trim()===items[from].category.trim())return i;return -1;}
 function controls(){for(const b of document.querySelectorAll('#theater-manage button,#theater-manage input,#theater-manage select,#theater-cards button,#theater-cash-detail button'))b.disabled=busy||!!b.dataset.moveItem&&moveTarget(b.dataset.moveItem,Number(b.dataset.direction))<0;$('refresh').disabled=busy||loading;$('event').disabled=busy||loading;}
 function moveItem(id,direction){if(busy)return;const to=moveTarget(id,direction);if(to<0)return;const from=draft.items.findIndex(p=>p.id===id);[draft.items[from],draft.items[to]]=[draft.items[to],draft.items[from]];dirty=true;paintEditor();const row=[...$('editor').querySelectorAll('.theater-edit-row')].find(r=>r.dataset.itemId===id);row?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest',behavior:'instant'});message('Reihenfolge geändert. Mit „Veranstaltung & Preisliste speichern“ auf die Handys übernehmen.');}
 // Reads never lock navigation or editing. A write invalidates older read responses.
 async function run(fn,{read=false}={}){if(busy||read&&loading)return;if(read)loading=true;else{epoch++;loading=false;busy=true;}const generation=epoch;controls();try{await fn(generation);}catch(e){if(generation===epoch)message(e.message);}finally{if(generation===epoch){if(read)loading=false;else busy=false;controls();schedule();}}}
 async function load(first=true){if(document.getElementById('theaterView').hidden||document.hidden)return;return run(async generation=>{if(first){connection=null;const r=await api('events');if(generation!==epoch)return;events=r.events;const selected=$('event').value||current?.id;const next=events.find(e=>e.id===selected)||events.find(e=>e.open)||events[0]||null;if(next?.id!==current?.id)selectedMember=null;current=next;paintSelect();}
  if(current){const r=await api('list',{eventId:current.id});if(generation!==epoch)return;current=r.event;orders=r.orders;noticeIncomingOrders(current.id,orders);paintCash();paintStats();message((current.open?'Geöffnet':'Geschlossen')+' · Stand '+new Date(r.servedAt).toLocaleTimeString('de-DE')+(mode==='manage'?'':' · Aktualisierung alle 5 Sekunden'));}else{orders=[];paintCash();paintStats();message('Noch keine Veranstaltung angelegt. Unter Verwaltung starten.');}if(mode==='manage'&&!dirty)edit();},{read:true});}
 function paintSelect(){const select=$('event');select.replaceChildren();for(const event of events){const opt=node('option',event.title+(event.open?' · geöffnet':''));opt.value=event.id;select.append(opt);}select.value=current?.id||'';}
 function lines(root,items){const list=node('ul');list.className='theater-lines';for(const p of items){const li=node('li');li.append(node('strong',p.quantity+' × '+p.name),node('span',M.money(p.quantity*p.cents)));list.append(li);}root.append(list,node('p','Summe: '+M.money(M.total(items))));}
 function selectCash(member){if(busy||loading)return;selectedMember=member;paintCash();$('cash-back')?.focus({preventScroll:true});}
 function orderTime(order){const raw=order?.createdAt;const time=typeof raw==='number'?raw:/^\d+$/.test(String(raw))?Number(raw):Date.parse(String(raw));return Number.isFinite(time)&&time>0?time:0;}
 function orderAge(time,now=Date.now()){if(!time)return 'Zeit unbekannt';const minutes=Math.max(0,Math.floor((now-time)/60000));if(minutes<1)return 'gerade eben';if(minutes<60)return 'vor '+minutes+' Min.';const hours=Math.floor(minutes/60);return hours<24?'vor '+hours+' Std.':'vor '+Math.floor(hours/24)+' Tagen';}
 function boardMembers(items){const people=new Map();for(const order of items){if(order.state!=='open'&&order.state!=='reserved')continue;const person=people.get(order.member)||{member:order.member,name:order.name||order.member,hasOpen:false,lastOpen:0,lastReserved:0};person.name=order.name||person.name;const time=orderTime(order);if(order.state==='open'){person.hasOpen=true;person.lastOpen=Math.max(person.lastOpen,time);}else person.lastReserved=Math.max(person.lastReserved,time);people.set(order.member,person);}return [...people.values()].sort((a,b)=>Number(b.hasOpen)-Number(a.hasOpen)||(a.hasOpen?b.lastOpen-a.lastOpen:a.lastReserved-b.lastReserved)||a.name.localeCompare(b.name,'de')).map(person=>person.member);}
 function paintCash(){
  const root=$('cards'),detail=$('cash-detail-content'),screen=$('cash-detail'),board=$('cash-board');
  root.replaceChildren();detail.replaceChildren();
  const members=boardMembers(orders);
  const eventName=$('cash-event-name');if(eventName)eventName.textContent=current?.title||'';const count=$('cash-count');if(count)count.textContent=members.length===0?'Keine offenen Karten':members.length+' offene Karte'+(members.length===1?'':'n');
  for(const member of members){
   const own=orders.filter(o=>o.member===member),open=own.filter(o=>o.state==='open'),reserved=own.filter(o=>o.state==='reserved');
   const name=own.at(-1).name,card=button(name,()=>selectCash(member));
   card.className='theater-board-card';card.dataset.member=member;card.dataset.state=open.length?'new':'reserved';
   card.replaceChildren();
   const flag=node('span',open.length?'● Neue Bestellung'+(open.length===1?'':'en'):'● In Kasseneingabe');flag.className='theater-board-flag';
   const label=node('strong',name);label.className='theater-board-name';
   const value=node('span',M.money(own.filter(o=>o.state==='open'||o.state==='reserved').reduce((sum,o)=>sum+M.total(o.lines),0)));value.className='theater-board-value';
   const latest=(open.length?open:reserved).reduce((time,order)=>Math.max(time,orderTime(order)),0);const age=node('span');age.className='theater-board-age';age.textContent=orderAge(latest);card.append(flag,label,value,age,node('span',open.length?(open.length+' offen'+(reserved.length?' · '+reserved.length+' reserviert':'')):(reserved.length+' reserviert')),node('span','Zur Kassenübertragung ›'));
   root.append(card);
  }
  if(!members.length)root.append(node('p',current?.open?'Noch keine offenen Bestellungen. Neue Karten erscheinen automatisch.':'Keine offenen Kassenkarten. Veranstaltung gegebenenfalls unter Verwaltung öffnen.'));
  if(selectedMember&&!members.includes(selectedMember))selectedMember=null;
  board.hidden=!!selectedMember;screen.hidden=!selectedMember;
  if(!selectedMember)return;
  const own=orders.filter(o=>o.member===selectedMember),open=own.filter(o=>o.state==='open'),reserved=own.filter(o=>o.state==='reserved');
  detail.append(node('h3',own.at(-1).name));const total=M.money(own.filter(o=>o.state==='open'||o.state==='reserved').reduce((sum,o)=>sum+M.total(o.lines),0));const summary=node('div');summary.className='theater-detail-total';summary.append(node('span','Gesamtbetrag offen / reserviert'),node('strong',total));detail.append(summary);
  if(reserved.length){
   const block=node('section');block.className='theater-reserved';block.append(node('h4','Für die Kasse bereit'));lines(block,M.summarize(reserved));
   block.append(button('✓ In Kasse übertragen',()=>mutate('complete',{batchId:reserved[0].reservation})),button('Reservierung freigeben',()=>mutate('release',{batchId:reserved[0].reservation})));
   detail.append(block);
  }
  if(open.length){
   const block=node('section');block.className='theater-new-order';block.append(node('h4',reserved.length?'Neu eingegangen':'Offene Bestellungen'));lines(block,M.summarize(open));
   block.append(node('p',open.length+' Bestellung(en) · zuletzt '+new Date(open.at(-1).createdAt).toLocaleTimeString('de-DE')));
   if(reserved.length)block.append(node('p','Diese neuen Bestellungen können nach Abschluss oder Freigabe des laufenden Pakets übernommen werden.'));
   else block.append(button('Für Kasse reservieren',()=>mutate('reserve',{batchId:crypto.randomUUID(),memberId:selectedMember,orderIds:open.slice(0,60).map(o=>o.id)})));
   if(open.length>60)block.append(node('p','Pro Paket werden die ältesten 60 Bestellungen reserviert.'));
   detail.append(block);
  }
  controls();
 }
 async function mutate(action,data){await run(async generation=>{await api(action,{eventId:current.id,...data});if(generation!==epoch)return;const r=await api('list',{eventId:current.id});if(generation!==epoch)return;orders=r.orders;noticeIncomingOrders(current.id,orders);if(action==='complete'||action==='release')selectedMember=null;paintCash();paintStats();message('✓ '+({reserve:'Bestellpaket reserviert. Neue Bestellungen laufen separat weiter.',complete:'Paket als in Kasse erfasst markiert.',release:'Reservierung freigegeben.'})[action]);});}
 function table(root,title,headers,rows){root.append(node('h3',title));const wrapper=node('div');wrapper.className='theater-table-scroll';const t=node('table'),head=node('thead'),tr=node('tr');for(const h of headers)tr.append(node('th',h));head.append(tr);t.append(head);const body=node('tbody');for(const row of rows){const r=node('tr');for(const value of row)r.append(node('td',value));body.append(r);}t.append(body);wrapper.append(t);root.append(wrapper);}
 function paintStats(){const root=$('stats-content');root.replaceChildren();const s=M.statistics(orders);root.append(node('h3',M.money(s.cents)+' Bestellwert'),node('p',s.count+' Buchungen, davon '+orders.filter(o=>o.lines.some(p=>p.quantity<0)).length+' Storno-/Korrekturbuchungen'));table(root,'Kassenstand',['Status','Bestellungen','Betrag'],['open','reserved','done'].map(state=>{const r=s.states.find(r=>r.name===state);return [stateName[state],r?.orders||0,M.money(r?.cents||0)];}));table(root,'Artikel',['Artikel','Rubrik','Menge','Betrag'],s.items.map(p=>[p.name,p.category,p.quantity,M.money(p.cents*p.quantity)]));const cats=new Map();for(const p of s.items){const r=cats.get(p.category)||{q:0,c:0};r.q+=p.quantity;r.c+=p.quantity*p.cents;cats.set(p.category,r);}table(root,'Rubriken',['Rubrik','Menge','Betrag'],[...cats].map(([k,v])=>[k,v.q,M.money(v.c)]));table(root,'Personen',['Name','Bestellungen','Betrag'],s.people.map(r=>[r.name,r.orders,M.money(r.cents)]));table(root,'Zeitverlauf (Europe/Berlin)',['Stunde','Bestellungen','Betrag'],s.hours.map(r=>[r.name,r.orders,M.money(r.cents)]));}
 function exportCSV(){if(!current){message('Bitte zuerst eine Veranstaltung auswählen.');return;}const rows=[['Veranstaltung','Bestellkennung','Zeit','Person','Status','Artikel','Rubrik','Menge','Einzelpreis EUR','Betrag EUR','Buchungsart','Storno zu Bestellung']];for(const o of orders)for(const p of o.lines)rows.push([current.title,o.id,new Date(o.createdAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}),o.name,stateName[o.state],p.name,p.category,p.quantity,(p.cents/100).toFixed(2).replace('.',','),(p.cents*p.quantity/100).toFixed(2).replace('.',','),o.cancels?'Storno Kasseneingabe':o.lines.some(p=>p.quantity<0)?'Korrektur Handy':'Bestellung',o.cancels||'']);const cell=v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='Theater-Auswertung.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function edit(fresh=false){draft=fresh?{id:crypto.randomUUID(),version:0,title:'Theaternachmittag '+new Date().getFullYear(),open:false,items:current?current.items.map(p=>({...p})):[]} :current?structuredClone(current):{id:crypto.randomUUID(),version:0,title:'Theaternachmittag '+new Date().getFullYear(),open:false,items:[]};dirty=fresh;$('title').value=draft.title;$('open').checked=draft.open;paintEditor();}
 function paintCategoryColors(){const root=$('category-colors');if(!root||!draft)return;root.replaceChildren();const categories=[...new Set(draft.items.map(p=>M.categoryName(p.category)).filter(Boolean))];if(!categories.length)return;root.append(node('h4','Rubrikfarben auf dem Handy'));for(const category of categories){const label=node('label',category),select=node('select');select.setAttribute('aria-label','Farbe für '+category);for(const [name,color] of M.palette){const option=node('option',name);option.value=color;select.append(option);}select.value=M.categoryColor(category,draft.items);label.style.setProperty('--category-color',select.value);select.onchange=()=>{if(busy)return;for(const item of draft.items)if(M.categoryName(item.category)===category)item.categoryColor=select.value;dirty=true;label.style.setProperty('--category-color',select.value);message('Rubrikfarbe geändert. Bitte Veranstaltung & Preisliste speichern.');};label.append(select);root.append(label);}}
 function paintEditor(){paintCategoryColors();const root=$('editor');root.replaceChildren();const categories=[...new Set(draft.items.map(p=>p.category))];$('categories').replaceChildren(...categories.map(c=>{const o=node('option');o.value=c;return o;}));for(const p of draft.items){const row=node('div');row.className='theater-edit-row';row.dataset.itemId=p.id;for(const [field,label,value,type] of [['name','Artikel',p.name,'text'],['category','Rubrik',p.category,'text'],['cents','Preis €',p.centsRaw??(p.cents/100).toFixed(2).replace('.',','),'text']]){const l=node('label',label),input=node('input');input.value=value;input.type=type;if(field==='category'){input.setAttribute('list','theater-categories');input.onchange=()=>{p.category=M.categoryName(input.value);input.value=p.category;p.categoryColor=M.categoryColor(p.category,draft.items.filter(q=>q!==p));paintCategoryColors();};}if(field==='cents')input.inputMode='decimal';input.oninput=()=>{dirty=true;if(field==='cents')p.centsRaw=input.value;else p[field]=input.value;if(field==='category')controls();};l.append(input);row.append(l);}const l=node('label','Aktiv'),check=node('input');check.type='checkbox';check.checked=p.active;check.onchange=()=>{dirty=true;p.active=check.checked;};l.append(check);const actions=node('div');actions.className='theater-item-actions';for(const [direction,label] of [[-1,'↑ Nach oben'],[1,'↓ Nach unten']]){const b=button(label,()=>moveItem(p.id,direction));b.dataset.moveItem=p.id;b.dataset.direction=String(direction);b.setAttribute('aria-label',p.name+' innerhalb der Rubrik '+(direction<0?'nach oben':'nach unten'));actions.append(b);}actions.append(button('Entfernen',()=>{draft.items=draft.items.filter(q=>q!==p);dirty=true;paintEditor();}));row.append(l,actions);root.append(row);}controls();}
 async function save(){await run(async generation=>{const catalog=M.catalog({title:$('title').value,open:$('open').checked,items:draft.items.map(p=>({...p,categoryColor:M.categoryColor(p.category,draft.items),cents:p.centsRaw===undefined?p.cents:M.price(p.centsRaw)}))});if(catalog.items.some(p=>p.category==='Noch zuordnen'))throw Error('Bitte allen importierten Artikeln eine Rubrik geben.');const r=await api('save',{eventId:draft.id,expectedVersion:draft.version,catalog});if(generation!==epoch)return;current=r.event;events=events.filter(e=>e.id!==current.id);events.unshift(current);paintSelect();dirty=false;edit();message(catalog.items.every(p=>r.event.items.find(q=>q.id===p.id)?.categoryColor===p.categoryColor)?'✓ Veranstaltung, Preisliste und Rubrikfarben gespeichert.':'Preisliste gespeichert. Rubrikfarben benötigen noch das aktuelle Cloudflare-Update; danach Farben erneut speichern.');});}
 async function resetEvent(){
  if(!current||dirty||busy||loading){message('Bitte zuerst alle Änderungen speichern und den aktuellen Datenstand laden.');return;}
  const name=current.title,amount=orders.length;
  if(!confirm('Alle '+amount+' Bestellungen und Kassenstände der Veranstaltung „'+name+'“ endgültig löschen? Die Preisliste bleibt erhalten; die Veranstaltung wird geschlossen. Vorher gegebenenfalls CSV exportieren.'))return;
  await run(async generation=>{
   const result=await api('reset',{eventId:current.id,expectedVersion:current.version,confirmation:'ZURÜCKSETZEN'});
   if(generation!==epoch)return;
   current=result.event;events=events.map(e=>e.id===current.id?current:e);orders=[];observedEventId=current.id;knownOrderIds=new Set();selectedMember=null;paintSelect();paintCash();paintStats();dirty=false;edit();
   message('✓ Theater-Bestellungen zurückgesetzt. Veranstaltung geschlossen; Preisliste erhalten.');
  });
 }
 function setMode(next){if(next!=='cash')selectedMember=null;if(mode==='manage'&&dirty&&next!=='manage'&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;mode=next;for(const name of ['cash','stats','manage']){$(name).hidden=name!==mode;document.querySelector('[data-theater-tab="'+name+'"]').setAttribute('aria-pressed',String(name===mode));}if(mode==='manage'){clearTimeout(timer);if(!dirty)edit();}else{dirty=false;load(false);}document.getElementById('theaterView').classList.toggle('theater-cash-fullscreen',mode==='cash');if(mode==='cash')window.scrollTo?.(0,0);}
 function lock(){epoch++;clearTimeout(timer);connection=null;events=[];current=null;orders=[];draft=null;dirty=false;busy=false;loading=false;selectedMember=null;observedEventId=null;knownOrderIds=null;soundEnabled=false;mode='manage';for(const name of ['cash','stats','manage']){$(name).hidden=name!=='manage';document.querySelector('[data-theater-tab="'+name+'"]').setAttribute('aria-pressed',String(name==='manage'));}document.getElementById('theaterView').classList.remove('theater-cash-fullscreen');soundContext?.suspend?.().catch(()=>{});soundControls();$('cards')?.replaceChildren();$('editor')?.replaceChildren();$('category-colors')?.replaceChildren();$('stats-content')?.replaceChildren();if($('title'))$('title').value='';$('event')?.replaceChildren();controls();}
 function init(){$('sound').onclick=toggleSound;$('cash-close').onclick=()=>setMode('manage');soundControls();$('refresh').onclick=()=>load(true);$('event').onchange=()=>{if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?')){$('event').value=current.id;return;}dirty=false;selectedMember=null;current=events.find(e=>e.id===$('event').value);load(false);};document.querySelectorAll('[data-theater-tab]').forEach(b=>b.onclick=()=>setMode(b.dataset.theaterTab));$('save').onclick=save;$('reset').onclick=resetEvent;$('cash-back').onclick=()=>{selectedMember=null;paintCash();};$('new').onclick=()=>{if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;edit(true);};$('add').onclick=()=>{draft.items.push({id:crypto.randomUUID(),name:'Neuer Artikel',category:'Getränke',cents:0,active:true});dirty=true;paintEditor();};$('title').oninput=$('open').onchange=()=>{dirty=true;};$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{dirty=true;const items=await g.TheaterImport.read(file);if(draft.items.length&&!confirm('Die aktuelle Artikelliste in der Vorschau ersetzen?'))return;draft.items=items;dirty=true;paintEditor();message(items.length+' Artikel eingelesen. Rubriken zuordnen, Preise prüfen und speichern.');}catch(e){message(e.message);}finally{$('import').value='';}};$('export').onclick=exportCSV;document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(!document.getElementById('theaterView').hidden)load(false);});new MutationObserver(()=>{if(document.getElementById('theaterView').hidden){clearTimeout(timer);if(mode==='cash')setMode('manage');}}).observe(document.getElementById('theaterView'),{attributes:true,attributeFilter:['hidden']});}
 g.TheaterAdmin={load,lock,beforeView:id=>id==='theaterView'||!dirty||confirm('Ungespeicherte Theater-Änderungen verwerfen?')&&(dirty=false,true)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
