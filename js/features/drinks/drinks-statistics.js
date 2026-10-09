/* Aggregate consumption only. No member names, IDs or individual amounts in the view. */
(function(global){
  'use strict';
  let generation=0,last=null,inFlight=null,knownYears=[];
  const el=id=>document.getElementById('drinksStatistics'+id);
  const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  function clear(){for(const id of ['Beer','Wine','Total'])if(el(id))el(id).textContent='–';el('Months')?.replaceChildren();}
  function reset(){generation++;last=null;knownYears=[];inFlight=null;clear();if(el('Status'))el('Status').textContent='Zum Laden des Getränkeverbrauchs bitte OneDrive verbinden.';}
  async function load(year){
    if(!el('Status'))return;
    year=String(year);if(inFlight?.year===year)return inFlight.promise;
    const number=++generation;if(last?.year!==year){last=null;clear();}el('Year').textContent=year;el('Status').textContent='Getränkeverbrauch wird geladen …';el('Refresh').disabled=true;
    const job={year,promise:null};inFlight=job;
    job.promise=(async()=>{try{
      const data=await global.DrinksStore.consumption(year);
      if(number!==generation||data.sourceKey!==global.DrinksStore.sourceKey())return;
      last={year,sourceKey:data.sourceKey,loadedAt:new Date().toLocaleString('de-DE')};knownYears=data.years;
      el('Beer').textContent=data.beer;el('Wine').textContent=data.wine;el('Total').textContent=data.total;el('Months').replaceChildren();
      for(const month of data.months){const row=document.createElement('tr');for(const value of [months[month.month-1],month.beer,month.wine,month.total]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}el('Months').append(row);}
      el('Status').textContent='Kalenderjahr '+year+' · Stand: '+last.loadedAt+(data.total?'':' · Noch keine Getränke gespeichert.');
      global.renderStatisticsYearSelect?.();
    }catch(error){if(number!==generation)return;
      if(last&&last.sourceKey!==global.DrinksStore.sourceKey()){last=null;clear();}
      const reason=error?.name==='TypeError'||error?.name==='AbortError'?'Internet- und OneDrive-Verbindung prüfen.':error.message||'Bitte erneut versuchen.';
      el('Status').textContent='Getränkeverbrauch konnte nicht aktualisiert werden. '+reason+(last?' Letzter geladener Stand: '+last.loadedAt+'.':'');
    }finally{if(inFlight===job)inFlight=null;if(number===generation)el('Refresh').disabled=false;}})();return job.promise;
  }
  global.DrinksConsumption={load,reset,years:()=>knownYears.slice()};
  function init(){el('Refresh')?.addEventListener('click',()=>load(el('Year').textContent||String(new Date().getFullYear())));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
