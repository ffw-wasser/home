const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),PDFLib=require('../js/vendor/pdf-lib.min.js'),fontkit=require('@pdf-lib/fontkit'),layout=require('../js/features/reports/operation-pdf-layout.js');
const assets={fontkit,regular:fs.readFileSync(require.resolve('../assets/fonts/DejaVuSans.ttf')),bold:fs.readFileSync(require.resolve('../assets/fonts/DejaVuSans-Bold.ttf'))};
test('Local operation PDF includes Unicode, every selected vehicle/device, 35 people and individual reserve times on exactly two pages',async()=>{
 const members=Array.from({length:35},(_,i)=>'Beispielperson '+i),value={date:'2026-11-13',type:'Technische Hilfe',powerOutage:true,location:'Wasser · Łukaszstraße',members,assignments:Object.fromEntries(members.map(name=>[name,'Reserve Gerätehaus'])),assignmentRoles:{[members[0]]:'GF'},reserveTimes:{[members[1]]:{from:'2026-11-13T23:45',to:'2026-11-14T00:30'}},reportVehicles:['EM 5/42 LF10','EM 5/47 TSF'],times:{alarm:'23:30',arrived:'23:45',ended:'00:45'},alarmMethods:['Sirene','Freitext'],deviceAmounts:{Wärmebildkamera:1},pipes:{description:'Vollständige Schlauchangaben'},situation:'Lagebericht '.repeat(100),actions:'Tätigkeiten '.repeat(100),agencies:['Polizei','Stadtwerke']};
 const captured=[],original=PDFLib.PDFPage.prototype.drawText;PDFLib.PDFPage.prototype.drawText=function(text,options){captured.push(text);return original.call(this,text,options);};
 let blob;try{blob=await layout.create(PDFLib,[],value,assets);}finally{PDFLib.PDFPage.prototype.drawText=original;}
 assert.equal((await PDFLib.PDFDocument.load(await blob.arrayBuffer())).getPageCount(),2);
 const text=captured.join(' ').replace(/\s+/g,' ');for(const token of [...members,'Łukaszstraße','EM 5/42 LF10','EM 5/47 TSF','Wärmebildkamera','13.11.2026 23:45 bis 14.11.2026 00:30','Stromausfall','Sirene; Freitext','Vollständige Schlauchangaben'])assert.ok(text.includes(token),token);
 assert.equal((text.match(/Lagebericht/g)||[]).length,100);assert.equal((text.match(/Tätigkeiten/g)||[]).length,100);
});
test('Local operation PDF rejects overflow rather than silently shortening any field or crew',async()=>{
 await assert.rejects(layout.create(PDFLib,[],{members:[],situation:'Text '.repeat(20000)},assets),/keine Angaben abgeschnitten/);
});
test('Local PDF wrap preserves an unbroken long word and paragraph boundaries',()=>{
 const font={widthOfTextAtSize:value=>value.length*5};const text='ABCDEFGHIJKLMNO';const wrapped=layout.lines(text,font,9,20);assert.equal(wrapped.join(''),text);assert.ok(wrapped.every(line=>line.length<=4));assert.equal(layout.lines('Erste\nZweite',font,9,100).length,2);
});
