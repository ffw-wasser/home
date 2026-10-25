const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes=new Map();class Node{constructor(){this.textContent='';this.disabled=false;this.children=[];}replaceChildren(){this.children=[];}append(n){this.children.push(n);}addEventListener(){}}
 const ids=['Status','Year','Beer','Wine','Total','Refresh','Months','BeerCents','WineCents','TotalCents','OpenCents','OutstandingCents','PrepaidCents','PaymentPoints','ChallengePoints','EarnedPoints','RedeemedPoints','CurrentPoints','PointMonths'];for(const id of ids)nodes.set('drinksStatistics'+id,new Node());const pending=[];
 const c=vm.createContext({Date,document:{readyState:'complete',getElementById:id=>nodes.get(id),createElement:()=>new Node()},DrinksStore:{sourceKey:()=> 'drive:root',consumption:year=>new Promise((resolve,reject)=>pending.push({year,resolve,reject}))},renderStatisticsYearSelect(){}});c.window=c;vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-model.js'),'utf8'),c);vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-statistics.js'),'utf8'),c);
 const data=(year,beer)=>({year,beer,wine:2,total:beer+2,beerCents:beer*150,wineCents:600,totalCents:beer*150+600,openCents:200,outstandingCents:450,prepaidCents:100,paymentPointUnits:300,challengePointUnits:600,earnedPointUnits:900,redeemedPointUnits:150,currentPointUnits:-150,months:[{month:1,beer,wine:2,total:beer+2,paymentPointUnits:300,challengePointUnits:600,earnedPointUnits:900,redeemedPointUnits:150}],years:['2026','2025'],sourceKey:'drive:root',name:'PRIVATE NAME',memberId:'PRIVATE-ID'});
 return {c,nodes,pending,data};
}
test('Verbrauchsanzeige enthält nur Mengen und Monate und verwirft verspätete Antworten des vorherigen Jahres',async()=>{
 const f=fixture(),a=f.c.DrinksConsumption.load('2026'),b=f.c.DrinksConsumption.load('2025');f.pending[1].resolve(f.data('2025',4));await b;f.pending[0].resolve(f.data('2026',99));await a;
 assert.equal(f.nodes.get('drinksStatisticsBeer').textContent,4);assert.equal(f.nodes.get('drinksStatisticsYear').textContent,'2025');const text=[...f.nodes.values()].map(n=>n.textContent).join(' ')+JSON.stringify(f.nodes.get('drinksStatisticsMonths').children);assert.ok(!text.includes('PRIVATE'));assert.match(text,/Januar/);
});
test('Statistik behält beim Abruffehler den letzten gleichen Jahresstand; Abmelden entfernt ihn und verwirft laufende Antworten',async()=>{
 const f=fixture(),first=f.c.DrinksConsumption.load('2026');f.pending[0].resolve(f.data('2026',10));await first;const refresh=f.c.DrinksConsumption.load('2026');assert.equal(f.nodes.get('drinksStatisticsBeer').textContent,10);f.pending[1].reject(new TypeError('Failed to fetch'));await refresh;assert.match(f.nodes.get('drinksStatisticsStatus').textContent,/Letzter geladener Stand/);
 const later=f.c.DrinksConsumption.load('2026');f.c.DrinksConsumption.reset();f.pending[2].resolve(f.data('2026',123));await later;assert.equal(f.nodes.get('drinksStatisticsBeer').textContent,'–');assert.equal(f.nodes.get('drinksStatisticsMonths').children.length,0);
});
test('Anonyme Statistik zeigt Bier und Wein in Euro und trennt Jahresreste von aktuellen Gesamtschulden',async()=>{
 const f=fixture(),load=f.c.DrinksConsumption.load('2026');f.pending[0].resolve(f.data('2026',4));await load;assert.match(f.nodes.get('drinksStatisticsBeerCents').textContent,/6,00/);assert.match(f.nodes.get('drinksStatisticsWineCents').textContent,/6,00/);assert.match(f.nodes.get('drinksStatisticsTotalCents').textContent,/12,00/);assert.match(f.nodes.get('drinksStatisticsOpenCents').textContent,/2,00/);assert.match(f.nodes.get('drinksStatisticsOutstandingCents').textContent,/4,50/);
});

test('Treuepunkte werden ohne Euro und Namen angezeigt; Abmelden leert auch die Monatsübersicht',async()=>{const f=fixture(),load=f.c.DrinksConsumption.load('2026');f.pending[0].resolve(f.data('2026',0));await load;for(const [id,value] of [['PaymentPoints','2'],['ChallengePoints','4'],['EarnedPoints','6'],['RedeemedPoints','1'],['CurrentPoints','-1']])assert.equal(f.nodes.get('drinksStatistics'+id).textContent,value);assert.equal(f.nodes.get('drinksStatisticsPointMonths').children[0].children[2].textContent,'4');f.c.DrinksConsumption.reset();assert.equal(f.nodes.get('drinksStatisticsCurrentPoints').textContent,'–');assert.equal(f.nodes.get('drinksStatisticsPointMonths').children.length,0);});

function printFixture(){
 const details=[{open:false},{open:true}],events={},classes=new Set(),options=[];let prints=0,loads=0;
 const source=fs.readFileSync(require.resolve('../js/features/statistics/statistics.js'),'utf8'),fn=source.slice(source.indexOf('function exportStatisticsPdf()'),source.indexOf('function normalizeStatisticsRole'));
 const c=vm.createContext({renderStatistics:value=>options.push(value),selectedStatisticsYear:'2026',DrinksConsumption:{load(){loads++;return new Promise(()=>{});}},showToast(message){c.error=message;},document:{title:'Original',querySelectorAll:()=>details,body:{classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}}},window:{addEventListener:(id,fn)=>events[id]=fn,removeEventListener:(id,fn)=>{if(events[id]===fn)delete events[id];},print(){prints++;assert.ok(details.every(d=>d.open));}},setTimeout(){throw Error('Print must not use a timer');}});
 vm.runInContext(fn,c);return {c,details,events,classes,options,prints:()=>prints,loads:()=>loads};
}
test('Statistik-PDF öffnet synchron ohne Cloud-Abruf und stellt Aufklappzustände erst nach Druckende wieder her',()=>{
 const f=printFixture();assert.equal(f.c.exportStatisticsPdf(),true);assert.equal(f.prints(),1);assert.equal(f.loads(),0);assert.equal(f.options[0].refreshDrinks,false);assert.ok(f.classes.has('printing-statistics'));
 assert.equal(f.c.document.title,'Feuerwehr-Wasser_Statistik_2026');const cleanup=f.events.afterprint;cleanup();assert.equal(f.details[0].open,false);assert.equal(f.details[1].open,true);assert.equal(f.c.document.title,'Original');assert.equal(f.classes.size,0);
 f.details[0].open=true;cleanup();assert.equal(f.details[0].open,true,'duplicate cleanup cannot close subsequently opened details');
});
test('Statistik-PDF räumt fehlgeschlagenen Druck auf und kann danach erneut gestartet werden',()=>{
 const f=printFixture(),print=f.c.window.print;f.c.window.print=()=>{throw Error('Print unavailable');};assert.equal(f.c.exportStatisticsPdf(),false);assert.match(f.c.error,/Druckdialog/);assert.equal(f.c.document.title,'Original');assert.equal(f.details[0].open,false);assert.equal(f.classes.size,0);assert.equal(f.events.afterprint,undefined);
 f.c.window.print=print;assert.equal(f.c.exportStatisticsPdf(),true);assert.equal(f.prints(),1);f.events.afterprint();
});
test('Ein erneuter PDF-Aufruf übernimmt keine Drucktitel oder offenen Zustände des vorherigen Aufrufs',()=>{
 const f=printFixture();f.c.exportStatisticsPdf();f.c.exportStatisticsPdf();assert.equal(f.prints(),2);f.events.afterprint();assert.equal(f.c.document.title,'Original');assert.equal(f.details[0].open,false);assert.equal(f.details[1].open,true);
});
