const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/theater/theater-admin.js','utf8');
const segment=source.slice(source.indexOf(' let soundContext='),source.indexOf(' function message('));
function fixture(){
 const nodes=new Map([['sound',{textContent:'',setAttribute(name,value){this[name]=value;}}],['sound-status',{textContent:''}]]);
 const tones=[],audioInstances=[];
 class AudioContext{
  constructor(){this.state='suspended';this.currentTime=1;this.destination={};audioInstances.push(this);}
  async resume(){this.state='running';}
  suspend(){this.state='suspended';return Promise.resolve();}
  createOscillator(){const tone={type:'',frequency:{setValueAtTime(){}},connect(){},start(){tones.push(this);},stop(){}};return tone;}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}
 }
 const document={hidden:false,getElementById:id=>id==='theaterView'?{hidden:false}:null};
 const c=vm.createContext({g:{AudioContext},document,$:id=>nodes.get(id),Set});
 vm.runInContext(segment,c);
 return {c,nodes,tones,audioInstances,order:(id,quantity=1)=>({id,state:'open',lines:[{quantity}]})};
}
test('Ton wird erst per Schaltfläche freigeschaltet und spielt sechs gut hörbare Impulse',async()=>{
 const f=fixture();f.c.orders=[f.order('vorhanden')];
 vm.runInContext('noticeIncomingOrders("theater-A",orders)',f.c);
 assert.equal(f.tones.length,0);
 assert.equal(f.nodes.get('sound')['aria-pressed'],undefined);
 await vm.runInContext('toggleSound()',f.c);
 assert.equal(f.tones.length,6,'Das Einschalten spielt ein Testsignal');
 assert.equal(f.nodes.get('sound')['aria-pressed'],'true');
 assert.equal(f.audioInstances.length,1);
 await vm.runInContext('toggleSound()',f.c);
 assert.equal(f.nodes.get('sound')['aria-pressed'],'false');
 vm.runInContext('noticeIncomingOrders("theater-A",[...orders,{id:"aus",state:"open",lines:[{quantity:2}]}])',f.c);
 assert.equal(f.tones.length,6,'Bei ausgeschaltetem Ton bleibt es still');
});
test('Nur neue positive Bestellungen erzeugen Alarm; Polling-Duplikate und Eventwechsel nicht',async()=>{
 const f=fixture();f.c.orders=[f.order('alt')];
 vm.runInContext('noticeIncomingOrders("A",orders)',f.c);
 await vm.runInContext('toggleSound()',f.c);
 const baseline=f.tones.length;
 f.c.orders.push(f.order('neu'));
 vm.runInContext('noticeIncomingOrders("A",orders)',f.c);
 assert.equal(f.tones.length,baseline+6);
 vm.runInContext('noticeIncomingOrders("A",orders)',f.c);
 assert.equal(f.tones.length,baseline+6,'Polling ohne neue IDs ist still');
 f.c.orders.push(f.order('korrektur',-1));
 vm.runInContext('noticeIncomingOrders("A",orders)',f.c);
 assert.equal(f.tones.length,baseline+6,'Negative Korrekturbuchung ist keine neue Bestellung');
 f.c.orders.push({...f.order('storniert'),cancels:'alt'});
 vm.runInContext('noticeIncomingOrders("A",orders)',f.c);
 assert.equal(f.tones.length,baseline+6,'Stornobuchung löst keinen Alarm aus');
 vm.runInContext('noticeIncomingOrders("B",orders)',f.c);
 assert.equal(f.tones.length,baseline+6,'Andere Veranstaltung setzt die Basis zurück');
 f.c.orders.push(f.order('neu-B'));
 vm.runInContext('noticeIncomingOrders("B",orders)',f.c);
 assert.equal(f.tones.length,baseline+12);
 f.c.document.hidden=true;
 f.c.orders.push(f.order('im-Hintergrund'));
 vm.runInContext('noticeIncomingOrders("B",orders)',f.c);
 assert.equal(f.tones.length,baseline+12,'Bei nicht sichtbarer App kein unzulässiges Browseraudio');
});
test('Unterbrochene Audiowiedergabe erfordert erneute Nutzerinteraktion',async()=>{
 const f=fixture();await vm.runInContext('toggleSound()',f.c);f.audioInstances[0].state='suspended';
 vm.runInContext('playNewOrderTone()',f.c);
 assert.equal(f.nodes.get('sound')['aria-pressed'],'false');
 assert.match(f.nodes.get('sound-status').textContent,/erneut/);
 await vm.runInContext('toggleSound()',f.c);
 assert.equal(f.nodes.get('sound')['aria-pressed'],'true');
});
