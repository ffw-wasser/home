const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const events={},frames=new Map(),timers=[];let sequence=0,scrolls=0;
 const classes={add(){},remove(){},toggle(){}},style={setProperty(){},removeProperty(){}};
 class Input{constructor(){this.type='number';this.isConnected=true;this.parentElement={classList:classes};}closest(){return null;}getBoundingClientRect(){return {top:-100,bottom:-60};}scrollIntoView(){scrolls++;}}
 class Textarea{}
 const document={activeElement:null,documentElement:{style},body:{classList:classes},addEventListener:(name,fn)=>events[name]=fn};
 const c=vm.createContext({document,HTMLInputElement:Input,HTMLTextAreaElement:Textarea,innerHeight:800,addEventListener(){},requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>timers.push({fn,ms})});c.window=c;c.visualViewport={height:600,offsetTop:0,addEventListener(){}};c.scrollBy=()=>scrolls++;
 vm.runInContext(fs.readFileSync('js/core/keyboard.js','utf8'),c);
 return {document,events,Input,scrolls:()=>scrolls,frames:()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();},timer:ms=>{for(const item of timers.filter(t=>t.ms===ms))item.fn();}};
}
test('Tastaturhilfe scrollt keine verlassenen Eingaben nach Heute oder Monatswechsel zurück',()=>{
 const f=fixture(),input=new f.Input();f.document.activeElement=input;f.events.focusin({target:input});
 f.document.activeElement={tagName:'BUTTON'};f.events.focusout({target:input});
 f.frames();f.timer(80);f.frames();assert.equal(f.scrolls(),0,'neither a pending frame nor the 80ms update may scroll the old input');
 f.timer(140);f.timer(280);f.timer(520);f.frames();assert.equal(f.scrolls(),0);
});
test('Tastaturhilfe hält eine weiterhin fokussierte Eingabe sichtbar',()=>{
 const f=fixture(),input=new f.Input();f.document.activeElement=input;f.events.focusin({target:input});f.frames();assert.ok(f.scrolls()>0);
});
