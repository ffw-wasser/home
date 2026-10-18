const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/features/portal/portal-bundesliga.js'),'utf8');
function fixture(){const nodes=new Map(),requests=[];let fail=false;const node=()=>({hidden:true,disabled:false,textContent:'',children:[],setAttribute(){},append(n){this.children.push(n);},replaceChildren(n){this.children=n.children;}});const data=Array.from({length:18},(_,i)=>({teamInfoId:i+1,teamName:'Testverein '+i,points:18-i,matches:6,goalDiff:9-i}));const c=vm.createContext({Intl,Date,AbortSignal,console,document:{readyState:'loading',addEventListener(){},getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,createDocumentFragment:node},fetch:async(url,options)=>{requests.push({url,options});if(fail)throw Error('offline');return {ok:true,json:async()=>data};}});vm.runInContext(source.replace(' function init(){',' globalThis.qa={season,rows,load}; function init(){'),c);return {c,nodes,requests,data,offline:()=>fail=true};}
test('Bundesliga-Saison wechselt am 1. Juli in deutscher Zeit',()=>{const {c}=fixture();assert.equal(c.qa.season(new Date('2026-06-30T21:59:00Z')),2025);assert.equal(c.qa.season(new Date('2026-06-30T22:00:00Z')),2026);});
test('Unvollständige oder doppelte Mannschaften werden nicht als gültige Tabelle angezeigt',()=>{const {c,data}=fixture();assert.equal(c.qa.rows(data).length,18);assert.throws(()=>c.qa.rows(data.slice(1)));data[1].teamInfoId=data[0].teamInfoId;assert.throws(()=>c.qa.rows(data));});
test('Tabelle lädt ohne Zugangsdaten, verhindert Doppelabrufe und behält bei Fehlern den gekennzeichneten letzten Stand',async()=>{const f=fixture();assert.equal(f.requests.length,0);await f.c.qa.load();assert.equal(f.nodes.get('bundesliga-body').children.length,18);assert.equal(f.requests[0].options.credentials,'omit');assert.equal(f.requests[0].options.referrerPolicy,'no-referrer');assert.match(f.requests[0].url,/^https:\/\/api.openligadb.de\/getbltable\/bl1\/\d{4}$/);await f.c.qa.load();assert.equal(f.requests.length,1);f.offline();await f.c.qa.load(true);assert.equal(f.nodes.get('bundesliga-table').hidden,false);assert.match(f.nodes.get('bundesliga-status').textContent,/Aktualisierung fehlgeschlagen/);assert.equal(f.nodes.get('bundesliga-refresh').disabled,false);});
function tickerFixture(){
 const nodes=new Map(),events={},timers=new Map(),requests=[];let counter=0,fail=false;
 const node=()=>({value:'',hidden:false,disabled:false,textContent:'',children:[],classList:{toggle(){}},setAttribute(){},querySelectorAll(){return this.children;},append(...items){this.children.push(...items);},replaceChildren(n){this.children=n.children;}});
 const match={matchID:101,matchDateTimeUTC:new Date().toISOString(),team1:{teamId:1,teamName:'Test Heim'},team2:{teamId:2,teamName:'Test Gast'},matchIsFinished:false,matchResults:[{resultTypeID:1,pointsTeam1:1,pointsTeam2:0}],goals:[]};
 const doc={hidden:false,readyState:'complete',addEventListener:(k,fn)=>events[k]=fn,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,createDocumentFragment:node};
 const ctx=vm.createContext({Intl,Date,AbortSignal,AbortController,console,document:doc,addEventListener:(k,fn)=>events[k]=fn,setTimeout:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),fetch:async(url,options)=>{requests.push({url,options});if(fail)throw Error('Offline');return {ok:true,json:async()=>url.endsWith('/101')?match:[match]};}});
 vm.runInContext(source.replace(' function init(){',' globalThis.qa={score,todays,validMatches,refreshTicker,stopTicker,activate:()=>active=true}; function init(){'),ctx);
 return {ctx,nodes,events,timers,requests,match,doc,offline:()=>fail=true};
}
test('Ticker unterscheidet Anstoß, Halbzeitstand und Endstand ohne erfundene Spielminute',()=>{
 const f=tickerFixture(),m=f.match;
 assert.equal(f.ctx.qa.score(m,Date.parse(m.matchDateTimeUTC)-1).label,'Anstoß');
 assert.equal(f.ctx.qa.score(m).label,'Halbzeitstand laut Quelle');m.matchIsFinished=true;
 assert.equal(f.ctx.qa.score(m).value,'– : –');m.matchResults.push({resultTypeID:2,pointsTeam1:2,pointsTeam2:1});
 assert.equal(f.ctx.qa.score(m).label,'Endstand');assert.equal(f.ctx.qa.score(m).value,'2 : 1');
});
test('Spiele heute verwendet deutsches Datum einschließlich Mitternachtsgrenze',()=>{
 const f=tickerFixture();f.match.matchDateTimeUTC='2026-10-18T22:15:00Z';
 assert.equal(f.ctx.qa.todays([f.match],Date.parse('2026-10-18T20:00:00Z')).length,0);
 assert.equal(f.ctx.qa.todays([f.match],Date.parse('2026-10-18T22:00:00Z')).length,1);
});
test('Ticker lädt nur sichtbar, fragt Einzelspiele nach und stoppt Timer beim Verlassen',async()=>{
 const f=tickerFixture();await f.ctx.qa.refreshTicker();assert.equal(f.requests.length,0);
 f.ctx.qa.activate();await f.ctx.qa.refreshTicker();assert.equal(f.requests.length,1);assert.match(f.requests[0].url,/bl1\/\d{4}$/);
 assert.equal([...f.timers.values()][0].ms,60000);const original=f.nodes.get('bundesliga-matches').children;
 await f.ctx.qa.refreshTicker();assert.match(f.requests[1].url,/\/101$/);assert.equal(f.nodes.get('bundesliga-matches').children,original,'Unveränderte Karten bleiben erhalten');
 f.offline();await f.ctx.qa.refreshTicker();assert.match(f.nodes.get('bundesliga-ticker-status').textContent,/möglicherweise veraltet/);
 f.events['portal-pagechange']({detail:{page:'deckel-more'}});assert.equal(f.timers.size,0);const count=f.requests.length;await f.ctx.qa.refreshTicker();assert.equal(f.requests.length,count);
});
test('Lieblingsverein wird in Spielkarten hervorgehoben',async()=>{
 const f=tickerFixture();f.ctx.qa.activate();await f.ctx.qa.refreshTicker();f.nodes.get('bundesliga-favorite').value='1';f.nodes.get('bundesliga-favorite').onchange();
 assert.match(f.nodes.get('bundesliga-matches').children[0].className,/bundesliga-favorite/);
 f.doc.hidden=true;f.events.visibilitychange();assert.equal(f.timers.size,0);
});
