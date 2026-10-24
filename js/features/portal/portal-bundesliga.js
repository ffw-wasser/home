/* Public football data: loaded only in the visible view, without portal credentials. */
(function(g){
 'use strict';
 const $=id=>document.getElementById('bundesliga-'+id),api='https://api.openligadb.de/',favoriteKey='portal-bundesliga-favorite';
 const competitions=[{key:'dfb',label:'DFB-Pokal',name:/^dfb[ -]?pokal(?: \d{4}\/\d{2,4})?$/i},{key:'ucl',label:'Champions League',name:/^(?:uefa )?champions league(?: \d{4}\/\d{2,4})?$/i},{key:'uel',label:'Europa League',name:/^(?:uefa )?europa league(?: \d{4}\/\d{2,4})?$/i},{key:'uecl',label:'Conference League',name:/^(?:uefa )?conference league(?: \d{4}\/\d{2,4})?$/i},{key:'BLSupercup',label:'Supercup',name:/^(?:franz-beckenbauer-supercup|dfl[ -]supercup|supercup)(?: \d{4}(?:\/\d{2,4})?)?$/i}];
 let active=false,busy=false,timer=null,controller=null,favorite='',teams=[],fixtures=[],cups=new Map(),catalog=null,catalogAt=0,yearLoaded=null,tableAt=0,fixturesAt=0,tab='today',selectedGroup='',defaultTab=true,paintKey='',refreshedAt=0,clubFavorite='';
 try{favorite=g.localStorage?.getItem(favoriteKey)||'';}catch{}
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
 function day(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
 function season(date=new Date()){const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric',month:'numeric'}).formatToParts(date),year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);return year-(month<7?1:0);}
 function validMatches(data){
  if(!Array.isArray(data)||data.length>1000)throw Error('Ungültige Spiele');
  const ids=new Set();for(const m of data){if(!Number.isSafeInteger(m.matchID)||ids.has(m.matchID)||!Number.isFinite(Date.parse(m.matchDateTimeUTC))||!['team1','team2'].every(k=>Number.isSafeInteger(m[k]?.teamId)&&typeof m[k].teamName==='string'&&m[k].teamName.trim())||typeof m.matchIsFinished!=='boolean')throw Error('Ungültiges Spiel');ids.add(m.matchID);}return data;
 }
 function todays(data,now=Date.now()){return data.filter(m=>day(m.matchDateTimeUTC)===day(now)).sort((a,b)=>Date.parse(a.matchDateTimeUTC)-Date.parse(b.matchDateTimeUTC));}
 function score(match,now=Date.now()){
  if(Date.parse(match.matchDateTimeUTC)>now&&!match.matchIsFinished)return {value:'– : –',label:'Anstoß'};
  const rank=r=>({AfterPenalties:4,AfterExtraTime:3,After90Minutes:2,HalfTime:1}[r.resultTypeKind]||({1:1,2:2,4:3,5:4}[r.resultTypeID]||0));
  const results=(Array.isArray(match.matchResults)?match.matchResults:[]).filter(r=>rank(r)>=(match.matchIsFinished?2:1)&&[r.pointsTeam1,r.pointsTeam2].every(n=>Number.isSafeInteger(n)&&n>=0)).sort((a,b)=>rank(b)-rank(a)),result=results[0];
  if(!result)return {value:'– : –',label:match.matchIsFinished?'Beendet · Ergebnis fehlt':'Ergebnismeldung ausstehend'};
  const level=rank(result),label=level===4?'Elfmeterschießen':level===3?'Nach Verlängerung':match.matchIsFinished?'Endstand':level===1?'Halbzeitstand laut Quelle':'Zwischenstand laut Quelle';
  return {value:result.pointsTeam1+' : '+result.pointsTeam2,label};
 }
 function rows(data){
  if(!Array.isArray(data)||data.length!==18)throw Error('Tabelle noch nicht vollständig verfügbar.');
  const ids=new Set();for(const team of data){if(!Number.isSafeInteger(team.teamInfoId)||ids.has(team.teamInfoId)||typeof team.teamName!=='string'||!team.teamName.trim()||!['points','matches','goalDiff'].every(k=>Number.isSafeInteger(team[k]))||team.matches<0||team.matches>34)throw Error('Tabellendaten konnten nicht geprüft werden.');ids.add(team.teamInfoId);}
  return data.map((team,index)=>[index+1,team.teamName,team.matches,team.goalDiff>0?'+'+team.goalDiff:team.goalDiff,team.points]);
 }
 function chooseLeague(data,competition,year){
  if(!Array.isArray(data)||data.length>5000)throw Error('Wettbewerbsverzeichnis ungültig');
  const eligible=data.filter(l=>l.sport?.sportId===1&&String(l.leagueSeason)===String(year)&&Number.isSafeInteger(l.leagueId)&&typeof l.leagueShortcut==='string'&&/^[a-z0-9_-]{1,40}$/i.test(l.leagueShortcut)&&typeof l.leagueName==='string'&&competition.name.test(l.leagueName.trim()));
  // Stable canonical shortcut first. Never combine competing community copies.
  return eligible.find(l=>l.leagueShortcut===competition.key)||(eligible.length===1?eligible[0]:null);
 }
 const isFavorite=m=>Boolean(favorite)&&[m.team1.teamId,m.team2.teamId].some(id=>String(id)===favorite);
 function allMatches(){const seen=new Set(),data=[...fixtures.map(m=>({...m,competition:'Bundesliga'}))];for(const c of competitions)for(const m of cups.get(c.key)?.matches||[])data.push({...m,competition:c.label});return data.filter(m=>{if(seen.has(m.matchID))return false;seen.add(m.matchID);return true;}).sort((a,b)=>Date.parse(a.matchDateTimeUTC)-Date.parse(b.matchDateTimeUTC)||a.matchID-b.matchID);}
 function matchCard(match,heading){
  const card=node('article'),result=score(match);card.className='bundesliga-match'+(isFavorite(match)?' bundesliga-favorite':'');
  if(heading){const title=node('h4',heading);title.className='bundesliga-match-heading';card.append(title);}
  const date=new Date(match.matchDateTimeUTC).toLocaleString('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),meta=node('p',match.competition+(match.group?.groupName?' · '+match.group.groupName:''));meta.className='bundesliga-match-time';
  card.append(meta);const line=node('div'),names=node('div'),number=node('strong',result.value);line.className='bundesliga-match-line';names.className='bundesliga-match-teams';names.append(node('span',match.team1.teamName),node('span',match.team2.teamName));number.className='bundesliga-score';line.append(names,number);card.append(line,node('p',date+' Uhr · '+result.label));
  const goals=Array.isArray(match.goals)?match.goals.filter(goal=>Number.isSafeInteger(goal.matchMinute)&&goal.matchMinute>=0&&Number.isSafeInteger(goal.scoreTeam1)&&Number.isSafeInteger(goal.scoreTeam2)):[];
  if(goals.length){const details=node('details'),summary=node('summary','Tore ('+goals.length+')'),events=node('ol');details.append(summary);for(const goal of goals)events.append(node('li',goal.matchMinute+'′ · '+goal.scoreTeam1+':'+goal.scoreTeam2+(typeof goal.goalGetterName==='string'?' · '+goal.goalGetterName:'')+(goal.isOwnGoal?' (Eigentor)':'')+(goal.isPenalty?' (Elfmeter)':'')));details.append(events);card.append(details);}return card;
 }
 function markFavorite(){$('body').querySelectorAll('tr').forEach((row,index)=>{row.classList.toggle('bundesliga-favorite',String(teams[index]?.teamInfoId)===favorite);});}
 function setTeams(data){teams=data;const select=$('favorite'),options=document.createDocumentFragment(),none=node('option','Lieblingsverein wählen');none.value='';options.append(none);for(const team of data){const option=node('option',team.teamName);option.value=String(team.teamInfoId);options.append(option);}select.replaceChildren(options);select.value=data.some(t=>String(t.teamInfoId)===favorite)?favorite:'';markFavorite();}
 function paintFavorite(){
  const host=$('club'),fragment=document.createDocumentFragment(),team=teams.find(t=>String(t.teamInfoId)===favorite);host.hidden=!favorite;const gamesOpen=clubFavorite===favorite&&host.querySelector?.('[data-club-games]')?.open,coverageOpen=clubFavorite===favorite&&host.querySelector?.('.bundesliga-coverage')?.open;clubFavorite=favorite;if(!favorite)return;
  fragment.append(node('h3',team?.teamName||'Mein Verein'));
  if(team)fragment.append(node('p','Platz '+(teams.indexOf(team)+1)+' · '+team.points+' Punkte · Bundesliga'));
  const matches=allMatches().filter(isFavorite),last=matches.filter(m=>m.matchIsFinished&&Date.parse(m.matchDateTimeUTC)<=Date.now()).at(-1),next=matches.find(m=>!m.matchIsFinished&&Date.parse(m.matchDateTimeUTC)>=Date.now()-6*3600000);
  if(next)fragment.append(matchCard(next,Date.parse(next.matchDateTimeUTC)<=Date.now()?'Aktuelles Spiel':'Nächstes gemeldetes Spiel'));else fragment.append(node('p','Kein kommendes Spiel gemeldet. Spielpläne und Auslosungen können noch fehlen.'));
  if(last){const line=node('div'),result=score(last);line.className='bundesliga-last';const label=node('div');label.append(node('strong','Letztes Ergebnis'),node('small',last.competition+' · '+new Date(last.matchDateTimeUTC).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})),node('span',last.team1.teamName+' – '+last.team2.teamName));line.append(label,node('strong',result.value+' · '+result.label));fragment.append(line);}
  const following=matches.filter(m=>!m.matchIsFinished&&m!==next&&Date.parse(m.matchDateTimeUTC)>Date.now());
  if(following.length){const details=node('details');details.setAttribute('data-club-games','');details.open=Boolean(gamesOpen);details.append(node('summary','Weitere Spiele ('+following.length+')'));for(const m of following)details.append(matchCard(m));fragment.append(details);}
  const details=node('details'),list=node('ul');details.className='bundesliga-coverage';details.open=Boolean(coverageOpen);details.append(node('summary','Wettbewerbe & Datenstand'));
  for(const c of competitions){const state=cups.get(c.key),matches=state?.matches?.filter(isFavorite)||[],status=state?.error?(state.at?'Letzter Stand · Aktualisierung fehlgeschlagen':'Daten derzeit nicht verfügbar'):state?.at?(matches.length?matches.length+' Spiele gemeldet':'Keine Spiele für deinen Verein gemeldet'):busy?'Wird geprüft …':'Noch nicht geladen';list.append(node('li',c.label+': '+status+(state?.at?' · '+new Date(state.at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'')));}
  details.append(list,node('p','Fehlende Einträge bedeuten weder Nichtteilnahme noch Ausscheiden. Es werden nur gemeldete Spiele angezeigt.'));fragment.append(details);host.replaceChildren(fragment);
 }
 function paintGroups(){const groups=new Map();for(const m of fixtures)if(Number.isSafeInteger(m.group?.groupOrderID))groups.set(String(m.group.groupOrderID),m.group.groupName||m.group.groupOrderID+'. Spieltag');const entries=[...groups].sort((a,b)=>Number(a[0])-Number(b[0]));if(!groups.has(selectedGroup)){const upcoming=fixtures.find(m=>!m.matchIsFinished&&Date.parse(m.matchDateTimeUTC)>Date.now()-6*3600000);selectedGroup=String(upcoming?.group?.groupOrderID||entries.at(-1)?.[0]||'');}const fragment=document.createDocumentFragment();for(const [value,label] of entries){const option=node('option',label);option.value=value;fragment.append(option);}$('matchday').replaceChildren(fragment);$('matchday').value=selectedGroup;$('matchday').disabled=!entries.length;const index=entries.findIndex(([key])=>key===selectedGroup);$('previous').disabled=index<=0;$('next').disabled=index<0||index>=entries.length-1;}
 function setTab(value){tab=value;for(const name of ['today','matchday','table']){$('view-'+name).hidden=name!==tab;$('tab-'+name).setAttribute('aria-pressed',String(name===tab));}}
 function paintMatches(){
  const today=todays(allMatches()).filter(m=>m.competition==='Bundesliga'||isFavorite(m));
  if(defaultTab&&fixturesAt){setTab(today.length?'today':'matchday');defaultTab=false;}
  const key=JSON.stringify([favorite,today,today.map(m=>score(m)),fixtures,selectedGroup]);if(key!==paintKey){paintKey=key;const fragment=document.createDocumentFragment();if(!today.length)fragment.append(node('p','Heute sind keine Spiele gemeldet. Unter „Spieltag“ findest du die Bundesliga-Begegnungen.'));for(const match of today)fragment.append(matchCard(match));$('matches').replaceChildren(fragment);paintGroups();const round=document.createDocumentFragment(),matches=fixtures.filter(m=>String(m.group?.groupOrderID)===selectedGroup);if(!matches.length)round.append(node('p','Spieltag noch nicht verfügbar.'));for(const match of matches)round.append(matchCard({...match,competition:'Bundesliga'}));$('round').replaceChildren(round);}paintFavorite();
 }
 function visible(){return active&&!document.hidden;}
 function stopTicker(){clearTimeout(timer);controller?.abort('hidden');paintAutoStatus();}
 function refreshInterval(){return todays(allMatches()).some(m=>(m.competition==='Bundesliga'||isFavorite(m))&&!m.matchIsFinished&&Date.parse(m.matchDateTimeUTC)<=Date.now())?60000:300000;}
 function paintAutoStatus(){$('auto-status').textContent=(visible()?(refreshInterval()===60000?'Spiele automatisch · jede Minute':'Automatisch · alle 5 Minuten'):'Automatik pausiert')+(refreshedAt?' · Stand '+new Date(refreshedAt).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}):'');}
 function scheduleTicker(){clearTimeout(timer);paintAutoStatus();if(visible())timer=setTimeout(()=>refreshAll(),refreshInterval());}
 async function publicJSON(path,signal){const response=await fetch(api+path,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal});if(!response.ok)throw Error('Daten nicht erreichbar');return response.json();}
 async function loadCups(year,signal,force){
  if(!favorite)return;
  if(!catalog||force||Date.now()-catalogAt>=12*3600000){try{const data=await publicJSON('getavailableleagues/'+year,signal);if(!Array.isArray(data))throw Error('Wettbewerbe ungültig');catalog=data;catalogAt=Date.now();}catch(error){for(const c of competitions)cups.set(c.key,{...cups.get(c.key),error:true});return;}}
  // Five independent cached competitions; no calls while the view is hidden.
  await Promise.all(competitions.map(async c=>{if(signal.aborted||!visible())return;const old=cups.get(c.key);if(!force&&old?.checkedAt&&Date.now()-old.checkedAt<300000)return;
   try{const league=chooseLeague(catalog,c,year);if(!league)throw Error('Kein eindeutiger Wettbewerb');const data=validMatches(await publicJSON('getmatchdata/'+encodeURIComponent(league.leagueShortcut)+'/'+year,signal));if(signal.aborted||!visible())return;cups.set(c.key,{matches:data,at:Date.now(),checkedAt:Date.now(),error:false});}
   catch(error){if(signal.aborted&&(!visible()||signal.reason==='hidden'))return;cups.set(c.key,{...old,checkedAt:Date.now(),error:true});}
  }));
 }
 async function loadTable(year,signal,force){
  if(!force&&tableAt&&Date.now()-tableAt<300000)return;
  $('table').setAttribute('aria-busy','true');
  try{const tableData=await publicJSON('getbltable/bl1/'+year,signal),data=rows(tableData);if(signal.aborted||!visible())return;const fragment=document.createDocumentFragment();for(const values of data){const row=node('tr');for(const [i,value] of values.entries()){const cell=node(i===1?'th':'td',value);if(i===1)cell.scope='row';row.append(cell);}fragment.append(row);}$('body').replaceChildren(fragment);setTeams(tableData);tableAt=Date.now();$('table').hidden=false;$('status').textContent='Tabelle: '+new Date(tableAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})+' · Keine Live-Tabelle.';}
  catch(error){if(visible()&&signal.reason!=='hidden')$('status').textContent=(tableAt?'Letzter Tabellenstand: '+new Date(tableAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})+'. Aktualisierung fehlgeschlagen.':'Tabelle momentan nicht verfügbar. Bitte erneut laden.');}
  finally{$('table').setAttribute('aria-busy','false');}
 }
 async function refreshAll(force=false){
  if(!visible()||busy)return;if(!force&&Date.now()-refreshedAt<60000&&(!favorite||cups.size)){paintMatches();scheduleTicker();return;}busy=true;controller=new AbortController();const request=controller,timeout=setTimeout(()=>request.abort(),25000),year=season();$('refresh').disabled=true;paintAutoStatus();
  if(yearLoaded!==year){fixtures=[];teams=[];cups.clear();catalog=null;catalogAt=0;fixturesAt=0;tableAt=0;yearLoaded=year;selectedGroup='';paintKey='';$('body').replaceChildren(document.createDocumentFragment());$('table').hidden=true;paintMatches();}
  $('season').textContent='Saison '+year+'/'+String(year+1).slice(-2);$('ticker-status').textContent='Spielstände werden aktualisiert …';
  const tableTask=loadTable(year,request.signal,force);
  try{
   if(force||!fixturesAt||Date.now()-fixturesAt>=300000){const data=validMatches(await publicJSON('getmatchdata/bl1/'+year,request.signal));if(!data.length)throw Error('Spielplan fehlt');if(request.signal.aborted||!visible())return;fixtures=data;fixturesAt=Date.now();}
   else{const updates=await Promise.all(todays(allMatches()).filter(m=>m.competition==='Bundesliga'||isFavorite(m)).filter(m=>!m.matchIsFinished&&Date.parse(m.matchDateTimeUTC)<=Date.now()).map(m=>publicJSON('getmatchdata/'+m.matchID,request.signal)));validMatches(updates);if(request.signal.aborted||!visible())return;const byId=new Map(updates.map(m=>[m.matchID,m]));fixtures=fixtures.map(m=>byId.get(m.matchID)||m);for(const state of cups.values())if(state.matches)state.matches=state.matches.map(m=>byId.get(m.matchID)||m);}
   paintMatches();await loadCups(year,request.signal,force);if(request.signal.aborted||!visible())return;paintMatches();refreshedAt=Date.now();$('ticker-status').textContent='Spiele: '+new Date().toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin'})+' · Ergebnisse können verzögert sein.';
  }catch(error){if(visible())$('ticker-status').textContent=(fixturesAt?'Letzter Spielplan: '+new Date(fixturesAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})+'. ':'')+'Aktualisierung fehlgeschlagen. Angaben möglicherweise veraltet. Bitte erneut laden.';}
  finally{await tableTask;if(visible()&&request.signal.aborted&&request.signal.reason!=='hidden')$('ticker-status').textContent='Aktualisierung dauert zu lange. Angaben möglicherweise veraltet. Bitte erneut laden.';clearTimeout(timeout);if(controller===request)controller=null;busy=false;$('refresh').disabled=false;if(visible()){paintFavorite();if(request.signal.reason==='hidden'||(favorite&&!cups.size&&!request.signal.aborted))refreshAll();else scheduleTicker();}}
 }
 function init(){if(!$('panel'))return;
  $('refresh').onclick=()=>refreshAll(true);
  $('favorite').onchange=()=>{favorite=$('favorite').value;try{g.localStorage?.setItem(favoriteKey,favorite);}catch{}markFavorite();paintKey='';paintMatches();refreshAll();};
  for(const name of ['today','matchday','table'])$('tab-'+name).onclick=()=>{defaultTab=false;setTab(name);};
  $('matchday').onchange=()=>{selectedGroup=$('matchday').value;paintKey='';paintMatches();};
  for(const [name,delta] of [['previous',-1],['next',1]])$(name).onclick=()=>{const select=$('matchday'),index=select.selectedIndex+delta;if(index>=0&&index<select.options.length){selectedGroup=select.options[index].value;paintKey='';paintMatches();}};
  g.addEventListener('portal-pagechange',event=>{active=event.detail.page==='more-bundesliga';if(active){defaultTab=true;refreshAll();}else stopTicker();});
  document.addEventListener('visibilitychange',()=>{if(visible())refreshAll();else stopTicker();});g.addEventListener('pagehide',stopTicker);g.addEventListener('pageshow',()=>{if(visible())refreshAll();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
