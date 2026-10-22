const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/portal/portal-member.js','utf8');
const shareSource=source.slice(source.indexOf(' async function shareEvent('),source.indexOf(' async function showOverview('));
test('Termin teilen enthält hinterlegte Kleidung in Teilen-Menü, Zwischenablage und Kopierdialog',async()=>{
 for(const channel of ['share','clipboard','prompt'])for(const [clothing,expected] of [['Einsatzkleidung','Einsatzkleidung'],['Einsatz','Einsatzkleidung'],['Tagdienst','Tagesdienst'],['Uniform','Uniform'],['T-Shirt / Fest, dunkle Hose','T-Shirt / Fest, dunkle Hose']]){
  let sent;
  const navigator=channel==='share'?{share:async value=>{sent=value.text+'\n'+value.url;}}:channel==='clipboard'?{clipboard:{writeText:async value=>{sent=value;}}}:{};
  const c=vm.createContext({URL,Intl,Date,navigator,location:{href:'https://example.test/home/deckel.html#private-account'},prompt:(_,value)=>{sent=value;}});
  vm.runInContext(shareSource,c);
  await c.shareEvent({id:'public-event',title:'Testprobe',sessionType:'Probe',start:Date.parse('2030-10-22T17:00:00Z'),location:'GH Wasser',clothing},{});
  assert.ok(sent.includes('\n👕 Kleidung: '+expected+'\n'),channel+': '+clothing);
  assert.ok(sent.includes('Probe · Testprobe'));assert.ok(sent.includes('📍 GH Wasser'));
  assert.ok(sent.includes('https://example.test/home/termin.html?event=public-event'));
  assert.ok(!sent.includes('private-account'));
 }
});
test('Termin ohne Kleidungsangabe teilt keine leere Kleidungszeile',async()=>{
 for(const clothing of [undefined,null,'','   ']){
  let sent;
  const c=vm.createContext({URL,Intl,Date,navigator:{share:async value=>{sent=value.text;}},location:{href:'https://example.test/deckel.html'}});
  vm.runInContext(shareSource,c);
  await c.shareEvent({id:'event',title:'Testtermin',start:Date.parse('2030-10-22T17:00:00Z'),clothing},{});
  assert.ok(!sent.includes('👕'));assert.ok(!sent.includes('undefined'));assert.ok(!sent.includes('null'));
 }
});
