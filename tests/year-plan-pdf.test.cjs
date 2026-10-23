const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),PDFLib=require('../js/vendor/pdf-lib.min.js');
function fixture(){const c=vm.createContext({setTimeout,Uint8Array,ArrayBuffer});vm.runInContext(fs.readFileSync('js/vendor/pdf-lib.min.js','utf8'),c);vm.runInContext(fs.readFileSync('js/features/portal/calendar-presentation.js','utf8'),c);vm.runInContext(fs.readFileSync('js/features/portal/year-plan-pdf.js','utf8'),c);return c.YearPlanPdf;}
const months=()=>Array.from({length:12},(_,month)=>({title:new Intl.DateTimeFormat('de-DE',{month:'long'}).format(new Date(2026,month,1)),days:Array.from({length:new Date(2026,month+1,0).getDate()},(_,i)=>({date:(i+1)+' Mo',holidays:[],events:[],weekend:false,holiday:false,birthday:false}))}));
test('Jahres-PDF umfasst beide Halbjahre als echte A3-Seiten',async()=>{
 const result=await fixture().build({year:2026,months:months(),note:'Synthetische Testdaten'}),doc=await PDFLib.PDFDocument.load(result.bytes);
 assert.equal(result.pageCount,2);assert.equal(doc.getPageCount(),2);assert.equal(doc.getTitle(),'Jahresprobenplan 2026');
 assert.ok(Math.abs(doc.getPage(0).getWidth()-1190.55)<.1);assert.ok(Math.abs(doc.getPage(0).getHeight()-841.89)<.1);
});
test('Auch überfüllte Tage bleiben auf zwei Seiten mit ausdrücklicher Kürzungsmarkierung',async()=>{
 const data=months();data[0].days[0].events=Array.from({length:160},(_,i)=>({title:'Probe '+i+' Überprüfung Atemschutzgeräteträger '+('Langwort'.repeat(8))+' 🚒',details:'Gerätehaus Wasser · Einsatzkleidung'}));
 const result=await fixture().build({year:2026,months:data,note:'Nur Testdaten'}),doc=await PDFLib.PDFDocument.load(result.bytes);
 assert.equal(result.pageCount,2);assert.equal(result.condensed,true);assert.equal(doc.getPageCount(),result.pageCount);
});

test('Lange Zusatzinfos erzeugen keinen zusätzlichen PDF-Anhang',async()=>{
 const data=months();data[0].days[1].events=[{title:'INFO: Mehrtägige Zusatzinfo',type:'info',note:'Lange wichtige Information. '.repeat(180),details:''}];const result=await fixture().build({year:2026,months:data,note:'Test',personal:false}),doc=await PDFLib.PDFDocument.load(result.bytes);assert.equal(result.pageCount,2);assert.equal(result.condensed,true);assert.equal(doc.getPageCount(),result.pageCount);
});

test('Beide PDF-Fußleisten erklären alle Farben und verwenden die konfigurierte Terminfarbe',async()=>{const api=fixture(),result=await api.build({year:2026,months:months(),colors:{general:'#000000'},note:'Test'}),doc=await PDFLib.PDFDocument.load(result.bytes);for(const page of doc.getPages()){const contents=page.node.Contents(),streams=contents.asArray().map(ref=>doc.context.lookup(ref)),raw=streams.map(stream=>Buffer.from(PDFLib.decodePDFRawStream(stream).decode()).toString('latin1')).join(' ');for(const label of ['Farben:','Ferien','Sonntag','Feiertag','Allgemeine Probe','Sonderprobe','Unterricht','Ausschusssitzung','Weitere Termine','Kalenderinformation','Geburtstag'])assert.ok(raw.includes(Buffer.from(label,'latin1').toString('hex').toUpperCase()),label);assert.match(raw,/0 0 0 rg/,'configured black color is used in legend even without events');}assert.equal(doc.getPageCount(),2);});
