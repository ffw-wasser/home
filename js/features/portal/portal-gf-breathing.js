/* Read-only GF overview: Worker authorizes every request. No persistent storage. */
(function(g){
 'use strict';
 const $=part=>document.getElementById('gf-breathing-'+part);
 const node=(tag,value)=>{const item=document.createElement(tag);if(value!==undefined)item.textContent=value;return item;};
 let generation=0,snapshot=null,active='all',query='',busy=false;
 const states={valid:'✓ Vollständig',soon:'◷ Bald fällig',check:'! Nachweis prüfen'};
 const labels={'G26.3':'G26.3 – ärztliche Eignung','Unterweisung AGT':'AGT-Unterweisung','FFI':'FFI – Atemschutznachweis'};
 const date=v=>v?v.slice(5,7)+'/'+v.slice(0,4):'';
 const reason=i=>i.status==='missing'?'nicht hinterlegt':i.status==='expired'?'abgelaufen · '+date(i.until):i.status==='soon'?'bald fällig · '+date(i.until):'gültig bis '+date(i.until);
 function clear(){
  generation++;snapshot=null;active='all';query='';busy=false;
  if($('data'))$('data').hidden=true;
  if($('members'))$('members').replaceChildren();
  if($('search'))$('search').value='';
  if($('status')){$('status').textContent='Beim Öffnen werden die Nachweise geprüft.';$('status').dataset.stale='false';}
  if($('synced'))$('synced').textContent='';
  if($('refresh'))$('refresh').disabled=false;
 }
 function render(){
  if(!snapshot)return;
  const all=snapshot.people,counts={all:all.length,valid:0,soon:0,check:0};
  for(const p of all)counts[p.status]++;
  for(const key of Object.keys(counts))$(key).textContent=counts[key];
  document.querySelectorAll('[data-gf-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gfFilter===active)));
  const root=$('members');root.replaceChildren();
  const weight={check:0,soon:1,valid:2};
  let visible=0;
  for(const p of [...all].sort((a,b)=>weight[a.status]-weight[b.status]||a.name.localeCompare(b.name,'de'))){
   if(active!=='all'&&p.status!==active||query&&!p.name.toLocaleLowerCase('de').includes(query))continue;
   visible++;
   const details=node('details'),summary=node('summary');
   details.className='gf-breathing-person';details.dataset.status=p.status;
   const issues=p.items.filter(i=>i.status==='missing'||i.status==='expired');
   const coming=p.items.filter(i=>i.status==='soon');
   const summaryText=issues.length===1?labels[issues[0].label]+': '+reason(issues[0]):issues.length>1?issues.length+' Nachweise prüfen':coming.length===1?labels[coming[0].label]+': '+reason(coming[0]):coming.length>1?coming.length+' Nachweise bald fällig':states.valid;
   summary.append(node('strong',p.name),node('small',summaryText));
   details.append(summary);
   const list=node('ul');
   for(const i of p.items){
    const row=node('li');row.append(node('strong',labels[i.label]||i.label),node('span',' · '+reason(i)));list.append(row);
   }
   details.append(list);root.append(details);
  }
  if(!visible)root.append(node('p','Keine Mitglieder gefunden.'));
  const rest=$('uncertain');rest.replaceChildren();
  if(snapshot.uncertain.length){
   rest.hidden=false;
   rest.append(node('strong','AGT-Zuordnung prüfen ('+snapshot.uncertain.length+')'),node('p','Bitte die AGT-Zuordnung in der Mitgliederverwaltung prüfen: '+snapshot.uncertain.map(x=>x.name).join(' · ')+'.'));
  }else rest.hidden=true;
 }
 async function refresh(){
  if(busy)return;
  const id=++generation;busy=true;
  $('refresh').disabled=true;$('data').hidden=true;
  $('status').textContent='Nachweise werden aktualisiert …';
  try{
   const data=await g.H2OPortal.api('gf-breathing');
   if(id!==generation)return;
   if(!Array.isArray(data.people)||!Array.isArray(data.uncertain)||typeof data.stale!=='boolean'||data.people.some(x=>!['valid','soon','check'].includes(x.status)||!Array.isArray(x.items)))throw Error('Der Dienst liefert keine vollständige Nachweisübersicht.');
   snapshot=data;
   $('data').hidden=false;
   $('synced').textContent='Letzter Mitgliederabgleich: '+(data.syncedAt?new Date(data.syncedAt).toLocaleString('de-DE'):'Unbekannt');
   $('status').dataset.stale=String(data.stale);
   $('status').textContent=data.stale?'⚠ Datenstand nicht aktuell. Bitte vor einem Einsatz die Nachweise überprüfen.':'Nachweise abgeglichen. Die tatsächliche Einsatzfähigkeit ist gesondert zu prüfen.';
   render();
  }catch(e){
   if(id===generation){
    snapshot=null;$('data').hidden=true;
    $('status').dataset.stale='true';
    $('status').textContent='Nachweise nicht verlässlich verfügbar. '+(e.status===403?'Keine Berechtigung für diese Übersicht.':e.message||'Erneut versuchen.');
    if(e.status===403){const tile=document.getElementById('portal-more-breathing-tile');if(tile)tile.hidden=true;}
   }
  }finally{if(id===generation){busy=false;$('refresh').disabled=false;}}
 }
 function init(){
  document.querySelectorAll('[data-gf-filter]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.gfFilter;render();}));
  $('search')?.addEventListener('input',()=>{query=$('search').value.trim().toLocaleLowerCase('de');render();});
  $('refresh')?.addEventListener('click',refresh);
  g.addEventListener('portal-pagechange',event=>{if(event.detail.page==='more-breathing')void refresh();else{generation++;snapshot=null;busy=false;if($('data'))$('data').hidden=true;if($('refresh'))$('refresh').disabled=false;}});
  g.addEventListener('hashchange',clear);
 }
 g.H2OGFBreathing={clear};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
