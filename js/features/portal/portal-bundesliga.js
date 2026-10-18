/* Public league data is loaded only when requested, without portal credentials. */
(function(g){
 'use strict';
 const $=id=>document.getElementById('bundesliga-'+id),endpoint='https://api.openligadb.de/getbltable/bl1/';
 let busy=false,loaded=0,loadedSeason=null;
 function season(date=new Date()){const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric',month:'numeric'}).formatToParts(date),year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);return year-(month<7?1:0);}
 function rows(data){
  if(!Array.isArray(data)||data.length!==18)throw Error('Tabelle noch nicht vollständig verfügbar.');
  const ids=new Set();
  for(const team of data){if(!Number.isSafeInteger(team.teamInfoId)||ids.has(team.teamInfoId)||typeof team.teamName!=='string'||!team.teamName.trim()||!['points','matches','goalDiff'].every(k=>Number.isSafeInteger(team[k]))||team.matches<0||team.matches>34)throw Error('Tabellendaten konnten nicht geprüft werden.');ids.add(team.teamInfoId);}
  // Preserve the provider's ranking, including its tie-breakers.
  return data.map((team,index)=>[index+1,team.teamName,team.matches,team.goalDiff>0?'+'+team.goalDiff:team.goalDiff,team.points]);
 }
 async function load(force=false){
  const year=season();if(busy||(!force&&loadedSeason===year&&Date.now()-loaded<300000))return;
  busy=true;$('refresh').disabled=true;$('table').setAttribute('aria-busy','true');$('status').textContent='Tabelle wird geladen …';
  try{
   const response=await fetch(endpoint+year,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Tabelle derzeit nicht erreichbar.');
   const data=rows(await response.json()),fragment=document.createDocumentFragment();
   for(const values of data){const row=document.createElement('tr');for(const [i,value] of values.entries()){const cell=document.createElement(i===1?'th':'td');if(i===1)cell.scope='row';cell.textContent=String(value);row.append(cell);}fragment.append(row);}
   $('body').replaceChildren(fragment);loaded=Date.now();loadedSeason=year;$('table').hidden=false;$('season').textContent='Saison '+year+'/'+String(year+1).slice(-2);
   $('status').textContent='Abgerufen: '+new Date(loaded).toLocaleString('de-DE')+' · Keine Live-Tabelle.';
  }catch(error){if(loadedSeason!==year){$('table').hidden=true;loaded=0;loadedSeason=null;}$('status').textContent=(loaded?'Letzter Abruf: '+new Date(loaded).toLocaleString('de-DE')+'. Aktualisierung fehlgeschlagen. ':'Tabelle momentan nicht verfügbar. ')+'Bitte erneut laden.';}
  finally{busy=false;$('refresh').disabled=false;$('table').setAttribute('aria-busy','false');}
 }
 function init(){const panel=$('panel');if(!panel)return;panel.addEventListener('toggle',()=>{if(panel.open)load();});$('refresh').onclick=()=>load(true);g.addEventListener('portal-pagechange',event=>{if(event.detail.page==='deckel-more'&&panel.open)load();});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
