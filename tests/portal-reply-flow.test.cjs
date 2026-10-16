const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync('js/features/portal/portal-member.js','utf8');
function fixture(){const status={textContent:''},event={id:'test-event',status:'open',version:0},jobs=[];let resolve,reject,paints=0;
 const c=vm.createContext({busy:false,pending:null,generation:1,loaded:true,latestResult:{events:[event]},crypto:webcrypto,g:{},$:()=>status,controls(){},schedule(){},paint(){paints++;},api:(_,job)=>{jobs.push(job);return new Promise((yes,no)=>{resolve=yes;reject=no;});}});
 vm.runInContext(source.slice(source.indexOf(' async function reply('),source.indexOf(' function clear(')),c);return {c,event,status,jobs,paintCount:()=>paints,save:()=>resolve({ok:true,status:jobs.at(-1).status,version:jobs.at(-1).expectedVersion+1}),fail:e=>reject(e)};
}
test('Schneller Antwortwechsel sendet während des Speicherns keine konkurrierenden Aufträge und nutzt bestätigte Versionen',async()=>{
 const f=fixture();for(const value of ['maybe','yes','excused','maybe','open']){const before=f.jobs.length,p=f.c.reply(f.event,value);await f.c.reply(f.event,'yes');assert.equal(f.jobs.length,before+1);assert.equal(f.jobs.at(-1).expectedVersion,before);assert.equal(f.c.busy,true);f.save();await p;assert.equal(f.event.status,value);assert.equal(f.event.version,before+1);assert.equal(f.c.pending,null);assert.match(f.status.textContent,/gespeichert/);}
 assert.equal(f.paintCount(),5);await f.c.reply(f.event,'open');assert.equal(f.jobs.length,5);
});
test('Verlorene Speicherantwort behält denselben Auftrag; kein gespeicherter Status wird vorgetäuscht',async()=>{
 const f=fixture(),p=f.c.reply(f.event,'maybe');f.fail(new TypeError('Load failed'));await p;assert.equal(f.event.status,'open');assert.equal(f.paintCount(),0);assert.match(f.status.textContent,/nicht bestätigt/);const job=f.c.pending;await f.c.reply(f.event,'yes');assert.equal(f.jobs.length,1);const retry=f.c.retry();assert.equal(f.jobs[1],job);f.save();await retry;assert.equal(f.event.status,'maybe');assert.equal(f.c.pending,null);
});
test('Versionskonflikt bleibt sichtbar und lädt nicht automatisch über die Fehlermeldung hinweg',async()=>{
 const f=fixture(),p=f.c.reply(f.event,'maybe');f.fail(Object.assign(Error('Inzwischen geändert.'),{status:409}));await p;assert.equal(f.c.pending,null);assert.match(f.status.textContent,/Inzwischen geändert.*aktualisieren/);assert.equal(f.event.status,'open');assert.equal(f.paintCount(),0);
});
