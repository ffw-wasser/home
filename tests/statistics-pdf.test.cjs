const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),PDFLib=require('../js/vendor/pdf-lib.min.js');
function fixture(){const c=vm.createContext({Blob});vm.runInContext(fs.readFileSync('js/vendor/pdf-lib.min.js','utf8'),c);vm.runInContext(fs.readFileSync('js/features/statistics/statistics-pdf.js','utf8'),c);return c.StatisticsPdf;}
function content(doc){return doc.getPages().flatMap(page=>page.node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1'))).join(' ').replace(/<([0-9A-F]+)>/g,(_,hex)=>Buffer.from(hex,'hex').toString('latin1'));}
test('PDF enthält echte Seiten, Text und Vektorbalken; lange Daten werden umgebrochen',async()=>{
 const model={title:'Statistik 2026',subtitle:'Nur künstliche Testdaten',sections:[{title:'Feuerwehr',blocks:[{kind:'kpis',items:[{label:'Einsätze',value:'12',detail:'Jahr 2026'}]},{kind:'bar',label:'Brand',value:'12',percent:50},...Array.from({length:80},(_,i)=>({kind:'row',label:'Person '+i+' '+('LangerName'.repeat(8)),value:'Gültig bis 31.12.2030'})),{kind:'paragraph',value:'Schlauchtrupp ✓ Übung – Müller 🧯'},{kind:'table',headers:['Monat','Bier','Wein'],rows:Array.from({length:12},(_,i)=>[String(i+1),'12 / 18,00 €','2 / 6,00 €'])}]}]};
 const before=JSON.stringify(model),blob=await fixture().create(model),bytes=new Uint8Array(await blob.arrayBuffer()),doc=await PDFLib.PDFDocument.load(bytes);
 assert.equal(blob.type,'application/pdf');assert.equal(doc.getTitle(),'Statistik 2026');assert.ok(doc.getPageCount()>3);assert.equal(JSON.stringify(model),before,'renderer is read-only');
 const raw=content(doc);for(const value of ['Feuerwehr','Brand','Person 79','Gültig bis 31.12.2030','Monat','Müller'])assert.ok(raw.includes(value),value);assert.match(raw,/257\.5/,'50 percent bar is 257.5 pt wide');
 for(const page of doc.getPages()){assert.equal(page.getWidth(),595);assert.equal(page.getHeight(),842);}
});
test('Fehlendes PDF-Modul liefert einen verständlichen Fehler statt einer leeren Ausgabe',async()=>{await assert.rejects(()=>fixture().create({title:'Test',sections:[]},null),/PDF-Modul ist nicht geladen/);});

test('Mitglieder-PDF beginnt jede weitere Person auf einer neuen Seite und verbietet fremde Abzeichenquellen',async()=>{
 const model={kind:'members',title:'Mitgliederakten',sections:[{title:'Anna Muster',newPage:true,blocks:[{kind:'row',label:'Eintrittsdatum',value:'17.03.2001'},{kind:'insignia',src:'',label:'Ehrung',value:'Besonderer Dank',detail:'Verliehen am 01.05.2024'}]},{title:'Ben Beispiel',newPage:true,blocks:[{kind:'paragraph',value:'Weitere Person'}]}]};
 const doc=await PDFLib.PDFDocument.load(new Uint8Array(await (await fixture().create(model)).arrayBuffer()));
 assert.equal(doc.getPageCount(),2);const raw=content(doc);for(const value of ['Anna Muster','17.03.2001','Besonderer Dank','Ben Beispiel'])assert.ok(raw.includes(value),value);
 await assert.rejects(()=>fixture().create({kind:'members',title:'Test',sections:[{title:'Test',blocks:[{kind:'insignia',src:'https://example.com/private.png'}]}]}),/Ungültige Abzeichenquelle/);
});
