/* Private status only; names are joined in memory from the existing OneDrive roster. */
(function(g){
 'use strict';
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let epoch=0,busy=false,people=[],rows=[],loaded=false,snapshotSource=null;
 const el=id=>document.getElementById('portal-subscriptions-'+id);
 const stamp=value=>new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin'});
 function clear(){snapshotSource=null;epoch++;busy=false;people=[];rows=[];loaded=false;el('list')?.replaceChildren();if(el('status'))el('status').textContent='Übersicht noch nicht geladen.';if(el('refresh'))el('refresh').disabled=false;if(el('search'))el('search').value='';if(el('filter'))el('filter').value='all';}
 function paint(){
  const query=el('search').value.trim().toLocaleLowerCase('de'),filter=el('filter').value,host=el('list');host.replaceChildren();if(!loaded)return;
  const byId=new Map(rows.map(row=>[row.memberId,row]));let shown=0;
  for(const person of people){
   const row=byId.get(person.id),push=row?row.pushDevices>0:null,calendar=row?.calendarLastFetchedAt||null;
   if(query&&!person.name.toLocaleLowerCase('de').includes(query))continue;
   if(filter==='no-push'&&push!==false||filter==='no-calendar'&&(!row||calendar))continue;
   const card=node('article');card.className='portal-subscription-item';card.dataset.memberId=person.id;
   const name=node('h4',person.name),values=node('dl'),pushTerm=node('dt','Push-Mitteilungen'),pushValue=node('dd',push===null?'Status nicht verfügbar':push?'Angemeldet · '+row.pushDevices+' Gerät'+(row.pushDevices===1?'':'e'):'Nicht angemeldet'),calendarTerm=node('dt','Kalenderabo'),calendarValue=node('dd',!row?'Status nicht verfügbar':calendar?'Abgerufen · '+stamp(calendar):'Noch kein Abruf erfasst');
   pushValue.dataset.state=push===null?'unknown':push?'active':'inactive';calendarValue.dataset.state=!row?'unknown':calendar?'active':'unknown';values.append(pushTerm,pushValue,calendarTerm,calendarValue);card.append(name,values);host.append(card);shown++;
  }
  if(!shown)host.append(node('p','Keine Mitglieder für diese Auswahl.'));
 }
 async function load(){
  if(busy||!el('list')||document.getElementById('settingsPortalView').hidden)return;
  const version=++epoch;busy=true;loaded=false;rows=[];people=[];el('list').replaceChildren();el('refresh').disabled=true;el('status').textContent='Abo-Status wird geladen …';
  let source;
  const current=()=>{if(version!==epoch)return false;if(!g.requireAdmin('settingsPortalView'))throw Error('Bitte die Verwaltung entsperren.');if(!g.oneDriveAdministrationReady())throw Error('Bitte OneDrive verbinden.');if(source!==g.DrinksStore.sourceKey())throw Error('Mitgliederordner wurde geändert. Bitte neu laden.');return true;};
  try{
   if(!g.requireAdmin('settingsPortalView'))throw Error('Bitte die Verwaltung entsperren.');
   if(!g.oneDriveAdministrationReady())throw Error('Bitte OneDrive verbinden.');
   source=g.DrinksStore.sourceKey();snapshotSource=source;
   const [state,connection]=await Promise.all([g.oneDriveReadState(),g.DrinksCentral.connection()]);if(!current())return;
   if(!connection||connection.source!==source)throw Error('Kontodienst nicht mit diesem Mitgliederordner verbunden.');
   const result=await g.DrinksPush.request(connection,'/admin/portal/subscriptions',{source});if(!current())return;
   if(result.version!==1||result.source!==source||!Number.isFinite(result.checkedAt)||!Array.isArray(result.members)||result.members.some(row=>typeof row.memberId!=='string'||!Number.isInteger(row.pushDevices)||row.pushDevices<0||row.calendarLastFetchedAt!==null&&(!Number.isFinite(row.calendarLastFetchedAt)||row.calendarLastFetchedAt<=0))||new Set(result.members.map(row=>row.memberId)).size!==result.members.length)throw Error('Abo-Status konnte nicht vollständig bestätigt werden.');
   people=(state.members||[]).map(person=>({id:String(person.id),name:[person.lastName,person.firstName].filter(Boolean).join(' ')})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
   rows=result.members;loaded=true;paint();const known=new Map(rows.map(row=>[row.memberId,row])),visible=people.map(person=>known.get(person.id)),pushCount=visible.filter(row=>row?.pushDevices>0).length,calendarCount=visible.filter(row=>row?.calendarLastFetchedAt).length,missing=visible.filter(row=>!row).length;
   el('status').textContent=people.length+' Mitglieder · Push angemeldet: '+pushCount+' · Kalender abgerufen: '+calendarCount+' · Stand: '+stamp(result.checkedAt)+(missing?' · '+missing+' Status nicht verfügbar. Mitgliederabgleich prüfen.':'');
  }catch(error){if(version===epoch){loaded=false;rows=[];people=[];el('list').replaceChildren();el('status').textContent='Übersicht nicht geladen. '+(error.status===404?'Bitte den aktuellen Cloudflare-Dienst veröffentlichen.':error.message);}}
  finally{if(version===epoch){busy=false;el('refresh').disabled=false;}}
 }
 function init(){if(!el('refresh'))return;el('refresh').onclick=load;el('search').oninput=paint;el('filter').onchange=paint;}
 g.PortalSubscriptionAdmin={load,clear,storageChanged:()=>{if(!g.oneDriveAdministrationReady()||snapshotSource!==null&&snapshotSource!==g.DrinksStore.sourceKey())clear();}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
