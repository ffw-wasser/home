const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes=new Map();class Node{constructor(){this.textContent='';this.disabled=false;this.children=[];}replaceChildren(){this.children=[];}append(n){this.children.push(n);}addEventListener(){}}
 const ids=['Status','Year','Beer','Wine','Total','Refresh','Months'];for(const id of ids)nodes.set('drinksStatistics'+id,new Node());const pending=[];
 const c=vm.createContext({Date,document:{readyState:'complete',getElementById:id=>nodes.get(id),createElement:()=>new Node()},DrinksStore:{sourceKey:()=> 'drive:root',consumption:year=>new Promise((resolve,reject)=>pending.push({year,resolve,reject}))},renderStatisticsYearSelect(){}});c.window=c;vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-statistics.js'),'utf8'),c);
 const data=(year,beer)=>({year,beer,wine:2,total:beer+2,months:[{month:1,beer,wine:2,total:beer+2}],years:['2026','2025'],sourceKey:'drive:root',name:'PRIVATE NAME',memberId:'PRIVATE-ID'});
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
