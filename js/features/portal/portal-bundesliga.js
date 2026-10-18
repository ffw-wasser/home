/* Public league data is loaded only when requested, without portal credentials. */
(function(g){
 'use strict';
 const $=id=>document.getElementById('bundesliga-'+id),endpoint='https://api.openligadb.de/getbltable/bl1/';
 let busy=false,loaded=0,loadedSeason=null;
 const matchEndpoint='https://api.openligadb.de/getmatchdata/',favoriteKey='portal-bundesliga-favorite';
 let active=false,timer=null,tickerBusy=false,controller=null,fixtures=[],fixturesAt=0,fixturesSeason=null,tickerAt=0,teams=[],favorite='',paintKey='';
 try{favorite=g.localStorage?.getItem(favoriteKey)||'';}catch{}
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
 function day(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
 function validMatches(data){
  if(!Array.isArray(data)||data.length>400)throw Error('Ungültige Spiele');
  const ids=new Set();for(const m of data){if(!Number.isSafeInteger(m.matchID)||ids.has(m.matchID)||!Number.isFinite(Date.parse(m.matchDateTimeUTC))||!['team1','team2'].every(k=>Number.isSafeInteger(m[k]?.teamId)&&typeof m[k].teamName==='string')||typeof m.matchIsFinished!=='boolean')throw Error('Ungültiges Spiel');ids.add(m.matchID);}return data;
 }
 function todays(data,now=Date.now()){return data.filter(m=>day(m.matchDateTimeUTC)===day(now)).sort((a,b)=>Date.parse(a.matchDateTimeUTC)-Date.parse(b.matchDateTimeUTC));}
 function score(match,now=Date.now()){
  if(Date.parse(match.matchDateTimeUTC)>now&&!match.matchIsFinished)return {value:'– : –',label:'Anstoß'};
  const results=Array.isArray(match.matchResults)?match.matchResults:[],result=results.find(r=>r.resultTypeID===2)||(!match.matchIsFinished?results.find(r=>r.resultTypeID===1):null);
  if(!result||![result.pointsTeam1,result.pointsTeam2].every(n=>Number.isSafeInteger(n)&&n>=0))return {value:'– : –',label:match.matchIsFinished?'Beendet · Ergebnis fehlt':'Noch keine verlässliche Ergebnismeldung'};
  return {value:result.pointsTeam1+' : '+result.pointsTeam2,label:match.matchIsFinished?'Endstand':result.resultTypeID===1?'Halbzeitstand laut Quelle':'Zwischenstand laut Quelle'};
 }
 function markFavorite(){
  $('body').querySelectorAll?.('tr').forEach((row,index)=>{row.classList.toggle('bundesliga-favorite',String(teams[index]?.teamInfoId)===favorite);});
 }
 function setTeams(data){teams=data;const select=$('favorite'),options=document.createDocumentFragment();const none=node('option','Kein Lieblingsverein');none.value='';options.append(none);for(const team of data){const option=node('option',team.teamName);option.value=String(team.teamInfoId);options.append(option);}select.replaceChildren(options);select.value=data.some(t=>String(t.teamInfoId)===favorite)?favorite:'';markFavorite();}
 function paintMatches(){
  const list=$('matches'),fragment=document.createDocumentFragment(),today=todays(fixtures),key=JSON.stringify([favorite,today,today.map(m=>score(m))]);if(key===paintKey)return;paintKey=key;
  if(!today.length)fragment.append(node('p','Heute sind keine Spiele der 1. Bundesliga angesetzt.'));
  for(const match of today){const card=node('article'),isFavorite=[match.team1.teamId,match.team2.teamId].some(id=>String(id)===favorite),result=score(match);card.className='bundesliga-match'+(isFavorite?' bundesliga-favorite':'');
   const time=node('p',new Date(match.matchDateTimeUTC).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'})+' Uhr · '+result.label);time.className='bundesliga-match-time';card.append(time,node('h4',(isFavorite?'★ ':'')+match.team1.teamName+' – '+match.team2.teamName));const number=node('strong',result.value);number.className='bundesliga-score';card.append(number);
   const goals=Array.isArray(match.goals)?match.goals.filter(goal=>Number.isSafeInteger(goal.matchMinute)&&goal.matchMinute>=0&&Number.isSafeInteger(goal.scoreTeam1)&&Number.isSafeInteger(goal.scoreTeam2)):[];
   if(goals.length){const details=node('details'),summary=node('summary','Tore ('+goals.length+')'),events=node('ol');details.append(summary);for(const goal of goals){events.append(node('li',goal.matchMinute+'′ · '+goal.scoreTeam1+':'+goal.scoreTeam2+(typeof goal.goalGetterName==='string'?' · '+goal.goalGetterName:'')+(goal.isOwnGoal?' (Eigentor)':'')+(goal.isPenalty?' (Elfmeter)':'')));}details.append(events);card.append(details);}fragment.append(card);
  }list.replaceChildren(fragment);
 }
 function visible(){return active&&!document.hidden;}
 function scheduleTicker(){clearTimeout(timer);if(visible())timer=setTimeout(()=>refreshTicker(),todays(fixtures).some(m=>!m.matchIsFinished)?60000:300000);}
 async function publicJSON(path,signal){const response=await fetch(matchEndpoint+path,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal});if(!response.ok)throw Error('Spiele nicht erreichbar');return response.json();}
 async function refreshTicker(force=false){
  if(!visible()||tickerBusy)return;tickerBusy=true;controller=new AbortController();const request=controller,timeout=setTimeout(()=>request.abort(),12000),year=season();$('ticker-refresh').disabled=true;
  if(!tickerAt)$('ticker-status').textContent='Spiele werden geladen …';
  try{
   let next;
   if(force||fixturesSeason!==year||Date.now()-fixturesAt>=300000){next=validMatches(await publicJSON('bl1/'+year,request.signal));if(!next.length)throw Error('Spielplan noch nicht verfügbar');}
   else{const today=todays(fixtures),updates=await Promise.all(today.map(m=>publicJSON(m.matchID,request.signal)));validMatches(updates);const byId=new Map(updates.map(m=>[m.matchID,m]));if(today.some(m=>!byId.has(m.matchID)))throw Error('Spieldaten unvollständig');next=fixtures.map(m=>byId.get(m.matchID)||m);}
   if(request.signal.aborted||!visible())return;
   if(force||fixturesSeason!==year||Date.now()-fixturesAt>=300000)fixturesAt=Date.now();fixtures=next;fixturesSeason=year;tickerAt=Date.now();paintMatches();
   $('ticker-status').textContent='Abgerufen: '+new Date(tickerAt).toLocaleTimeString('de-DE')+' · Ergebnisse können verzögert sein.';
  }catch(error){if(visible()){
   if(fixturesSeason!==year){fixtures=[];tickerAt=0;}
   if(tickerAt)paintMatches();else{paintKey='';$('matches').replaceChildren(document.createDocumentFragment());}
   $('ticker-status').textContent=(tickerAt?'Letzter erfolgreicher Abruf: '+new Date(tickerAt).toLocaleString('de-DE')+'. ':'')+'Aktualisierung fehlgeschlagen. Angaben möglicherweise veraltet. Bitte erneut laden.';
  }}finally{clearTimeout(timeout);if(controller===request)controller=null;tickerBusy=false;$('ticker-refresh').disabled=false;scheduleTicker();}
 }
 function stopTicker(){clearTimeout(timer);controller?.abort();}
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
   const tableData=await response.json(),data=rows(tableData),fragment=document.createDocumentFragment();
   for(const values of data){const row=document.createElement('tr');for(const [i,value] of values.entries()){const cell=document.createElement(i===1?'th':'td');if(i===1)cell.scope='row';cell.textContent=String(value);row.append(cell);}fragment.append(row);}
   $('body').replaceChildren(fragment);setTeams(tableData);loaded=Date.now();loadedSeason=year;$('table').hidden=false;$('season').textContent='Saison '+year+'/'+String(year+1).slice(-2);
   $('status').textContent='Abgerufen: '+new Date(loaded).toLocaleString('de-DE')+' · Keine Live-Tabelle.';
  }catch(error){if(loadedSeason!==year){$('table').hidden=true;loaded=0;loadedSeason=null;}$('status').textContent=(loaded?'Letzter Abruf: '+new Date(loaded).toLocaleString('de-DE')+'. Aktualisierung fehlgeschlagen. ':'Tabelle momentan nicht verfügbar. ')+'Bitte erneut laden.';}
  finally{busy=false;$('refresh').disabled=false;$('table').setAttribute('aria-busy','false');}
 }
 function init(){const panel=$('panel');if(!panel)return;
  $('refresh').onclick=()=>load(true);$('ticker-refresh').onclick=()=>refreshTicker(true);
  $('favorite').onchange=()=>{favorite=$('favorite').value;try{g.localStorage?.setItem(favoriteKey,favorite);}catch{}markFavorite();if(tickerAt)paintMatches();};
  g.addEventListener('portal-pagechange',event=>{active=event.detail.page==='more-bundesliga';if(active){load();refreshTicker();}else stopTicker();});
  document.addEventListener('visibilitychange',()=>{if(visible()){load();refreshTicker();}else stopTicker();});
  g.addEventListener('pagehide',stopTicker);g.addEventListener('pageshow',()=>{if(visible())refreshTicker();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
