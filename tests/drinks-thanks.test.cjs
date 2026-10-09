const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes=new Map(),events={},timers=new Map();let now=0,next=0;
 const ctx=vm.createContext({byId:id=>nodes.get(id),setTimeout:(fn,delay)=>{timers.set(++next,{fn,at:now+delay});return next;},clearTimeout:id=>timers.delete(id),document:{hidden:false,readyState:'loading',addEventListener:(name,fn)=>events[name]=fn,body:{append:node=>nodes.set(node.id,node)},createElement:()=>({open:false,children:{button:{},'[data-thanks-bonus]':{}},handlers:{},querySelector(selector){return this.children[selector];},addEventListener(name,fn){this.handlers[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},remove(){nodes.delete(this.id);}})}});ctx.window=ctx;
 vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-extras.js'),'utf8'),ctx);
 return {ctx,events,timers,dialog:()=>nodes.get('drinksThanksDialog'),advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
}
test('Dankesymbol verschwindet nach 3 Sekunden selbstständig und beendet die Mitgliedssitzung einmal',()=>{
 const f=fixture();let returned=0;f.ctx.DrinksExtras.celebrate(0,()=>returned++);assert.equal(f.dialog().open,true);f.advance(2999);assert.equal(returned,0);
 f.advance(1);assert.equal(returned,1);assert.equal(f.dialog(),undefined);f.advance(10000);assert.equal(returned,1);
});
test('Bonus bleibt 4,5 Sekunden lesbar; Fertig schließt vorher und verhindert eine zweite Rückkehr',()=>{
 const f=fixture();let returned=0;f.ctx.DrinksExtras.celebrate(300,()=>returned++);const dialog=f.dialog();assert.match(dialog.children['[data-thanks-bonus]'].textContent,/3,00/);
 f.advance(3000);assert.equal(returned,0);dialog.children.button.onclick();assert.equal(returned,1);assert.equal(f.dialog(),undefined);f.advance(10000);assert.equal(returned,1);
});
test('Verbergen der App schließt den Dank; neuer Dank erhält einen neuen Timer ohne alte Rückkehr',()=>{
 const f=fixture();let old=0,current=0;f.ctx.DrinksExtras.celebrate(0,()=>old++);f.advance(1000);f.ctx.DrinksExtras.celebrate(0,()=>current++);
 f.advance(2000);assert.equal(old,0);assert.equal(current,0);f.ctx.document.hidden=true;f.events.visibilitychange();assert.equal(current,1);assert.equal(f.dialog(),undefined);f.advance(10000);assert.equal(current,1);
});
test('Explizites Beenden entfernt Animation und Timer ohne den alten Abschluss erneut aufzurufen',()=>{
 const f=fixture();let returned=0;f.ctx.DrinksExtras.celebrate(0,()=>returned++);f.ctx.DrinksExtras.dismiss();
 assert.equal(f.dialog(),undefined);assert.equal(returned,0);f.advance(10000);assert.equal(returned,0);
});
