const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function fixture(){const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob});for(const name of ['deckel-crypto','deckel-commands'])vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/'+name+'.js'),'utf8'),c);return c;}
test('Handyaufträge sind verschlüsselt und an Konto, Vorgang und Zweck gebunden',async()=>{
 const c=fixture(),r=c.DeckelCrypto.create(),id=webcrypto.randomUUID(),command={version:1,kind:'cash',cents:1000};
 const e=await c.DeckelCommands.seal(command,r,id);assert.equal(e.data.length,5484);assert.deepEqual(JSON.parse(JSON.stringify(await c.DeckelCommands.open(e,r,id))),command);
 await assert.rejects(c.DeckelCommands.open(e,r,webcrypto.randomUUID()));await assert.rejects(c.DeckelCommands.open(e,{...r,alias:'f'.repeat(32)},id));await assert.rejects(c.DeckelCommands.open(e,c.DeckelCrypto.create(),id));await assert.rejects(c.DeckelCrypto.open(e,r));
 const changed={...e,data:(e.data[0]==='A'?'B':'A')+e.data.slice(1)};await assert.rejects(c.DeckelCommands.open(changed,r,id));
 assert.notEqual((await c.DeckelCommands.seal(command,r,id)).iv,e.iv);
});
test('Handyaufträge erlauben nur begrenzte Mitgliedseingaben',()=>{
 const C=fixture().DeckelCommands;
 for(const command of [{version:1,kind:'admin'},{version:1,kind:'cash',cents:-100},{version:1,kind:'cash',cents:1.5},{version:1,kind:'drinks',entries:[]},{version:1,kind:'drinks',entries:Array(21).fill({drink:'beer'})},{version:1,kind:'drinks',entries:[{drink:'wine',pointUnits:-1}]},{version:1,kind:'undo',targetId:'x'}])assert.throws(()=>C.validate(command));
});
