const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const calls=[],job={alias:'a',revision:'r',id:'request',envelope:'{}'},record={alias:'a',revision:'r'},state={signedIn:true,publish:true,failApply:false},document={hidden:false,addEventListener(){}};
 const c=vm.createContext({document,addEventListener(){},setInterval(){},setTimeout(){},oneDriveSignedIn:()=>state.signedIn,
 DrinksStore:{sourceKey:()=> 'same-source',mobileIds:async()=>['member'],mobileFileName:async()=> 'file',readMobileFile:async()=>({data:record}),applyMobileCommand:async()=>{calls.push('apply');if(state.failApply)throw Object.assign(Error(),{code:state.failApply});}},
 DeckelCommands:{open:async()=>({kind:'cash'})},DrinksMobile:{publish:async()=>{calls.push('publish');return state.publish;}},
 DrinksPush:{config:async()=>({}),request:async(c,path,body)=>{calls.push(path);return path.endsWith('pending')?{commands:[job]}:(state.ack=body,{ok:true});}}
 });vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-phone-sync.js'),'utf8'),c);return {c,calls,state,document};
}
test('iPad bestätigt Handyauftrag erst nach Speicherung und Veröffentlichung',async()=>{
 const f=fixture();await f.c.DrinksPhoneSync.sync();assert.deepEqual(f.calls,['/admin/commands/pending','apply','publish','/admin/commands/ack']);assert.equal(f.state.ack.status,'done');
});
test('Fehlgeschlagene Veröffentlichung wird später mit demselben Auftrag wiederholt',async()=>{
 const f=fixture();f.state.publish=false;await f.c.DrinksPhoneSync.sync();assert.equal(f.state.ack,undefined);f.state.publish=true;await f.c.DrinksPhoneSync.sync();assert.equal(f.state.ack.status,'done');assert.equal(f.calls.filter(x=>x==='apply').length,2);
});
test('Punktekonflikt wird abgelehnt; vorübergehender Speicherfehler bleibt offen',async()=>{
 const f=fixture();f.state.failApply='pointsChanged';await f.c.DrinksPhoneSync.sync();assert.equal(f.state.ack.status,'rejected');assert.equal(f.state.ack.result,'pointsChanged');assert.ok(!f.calls.includes('publish'));
 const g=fixture();g.state.failApply='network';await g.c.DrinksPhoneSync.sync();assert.equal(g.state.ack,undefined);
});
test('Gesperrtes oder nicht angemeldetes iPad übernimmt keine Aufträge',async()=>{
 const f=fixture();f.document.hidden=true;await f.c.DrinksPhoneSync.sync();f.document.hidden=false;f.state.signedIn=false;await f.c.DrinksPhoneSync.sync();assert.deepEqual(f.calls,[]);
});
