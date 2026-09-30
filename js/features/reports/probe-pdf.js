function pdfEscape(value){return String(value??"").replace(/[\\()]/g,"\\$&").replace(/[\r\n]+/g," ");}
function pdfLatin1(value){return String(value??"").replace(/[–—]/g,"-").replace(/„|“/g,'"').replace(/’/g,"'").replace(/[^\x20-\xFF]/g,"?");}
function probePdfBlob(rows, sessionType, counts, topic="", reportDate=today()){
  const report=ReportEngine.model({rows,sessionType,counts,topic,date:reportDate});
  rows=report.rows; sessionType=report.sessionType; counts=report.counts; topic=report.topic; reportDate=report.date;
  const includeFunction=sessionType==="Allgemeine Probe"||sessionType==="Einsatz";
  // Funktionswechsel benötigen zwei sichtbare Zeilen pro Person. Weniger
  // Tabellenzeilen pro Seite schaffen dafür ausreichend vertikalen Platz.
  const pageRows=24, pages=[];
  for(let i=0;i<rows.length;i+=pageRows)pages.push(rows.slice(i,i+pageRows));
  if(!pages.length)pages.push([]);
  const objects=[null], add=v=>(objects.push(v),objects.length-1);
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds=[], contentIds=[];
  pages.forEach(()=>{pageIds.push(add(''));contentIds.push(add(''));});
  const pagesId=add('');
  pages.forEach((page,pi)=>{
    const ops=['0.08 0.10 0.09 rg']; const t=(x,y,size,text,b=false)=>ops.push(`BT /${b?'F2':'F1'} ${size} Tf ${x} ${y} Td (${pdfEscape(pdfLatin1(text))}) Tj ET`);
    ops.push('0.06 0.24 0.12 rg 36 792 523 32 re f'); ops.push('1 1 1 rg'); t(48,803,16,'Feuerwehr Wasser - Probenbericht',true); ops.push('0.08 0.10 0.09 rg');
    t(36,770,10,`Datum: ${reportDate}    Terminart: ${sessionType}`,true);
    t(36,753,9,`Thema: ${String(topic||"-").slice(0,90)}`,true);
    t(36,738,9,`Anwesend: ${counts.present}    Entschuldigt: ${counts.excused}    Fehlt: ${counts.missing}    Betrifft nicht: ${counts.notApplicable}`);
    ops.push('0.30 0.40 0.50 rg 36 708 523 22 re f');
    ops.push('0 0 0 rg'); (includeFunction?[['Zeit',42],['Name',88],['Status',300],['Funktion',390]]:[['Zeit',42],['Name',100],['Status',430]]).forEach(([v,x])=>t(x,715,9,v,true));
    let y=688;
    page.forEach((row,idx)=>{
      const roleText=includeFunction?String(row.role||'-'):"",roleParts=roleText.includes(' | ')?roleText.split(/\s*\|\s*/,2):[roleText];
      const firstRole=roleParts[0],secondRole=roleParts[1]||"";
      const rowHeight=includeFunction&&secondRole?28:23,baseY=y-(includeFunction&&secondRole?1:4);
      if(idx%2){ops.push(`0.72 0.79 0.84 rg 36 ${y-rowHeight+7} 523 ${rowHeight} re f`);}else{ops.push(`0.84 0.88 0.91 rg 36 ${y-rowHeight+7} 523 ${rowHeight} re f`);} ops.push('0 0 0 rg');
      t(42,baseY,8,row.time||''); t(includeFunction?88:100,baseY,8,String(row.name).slice(0,includeFunction?36:52)); t(includeFunction?300:430,baseY,8,row.status);
      if(includeFunction)t(390,baseY+(secondRole?4:0),7.2,firstRole);
      if(includeFunction&&secondRole)t(390,baseY-8,7.2,secondRole,true);
      ops.push(`0.25 0.34 0.42 RG 36 ${y-rowHeight+5} m 559 ${y-rowHeight+5} l S`); y-=rowHeight;
    });
    t(36,28,8,`Seite ${pi+1} von ${pages.length} | Automatisch erzeugter Probenbericht`);
    const stream=ops.join('\n'); objects[contentIds[pi]]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageIds[pi]]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${contentIds[pi]} 0 R >>`;
  });
  objects[pagesId]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf='%PDF-1.4\n%âãÏÓ\n', offsets=[0];
  for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;
  return new Blob([bytes],{type:'application/pdf'});
}
async function saveBlobToSelectedFolder(fileName,blob){
  if(pdfDirectoryHandle && await savePdfToSelectedFolder(fileName,blob))return true;
  if(!csvDirectoryHandle)return false;
  try{const permission=await ensureDirectoryWritePermission(csvDirectoryHandle);if(!permission)return false;const handle=await csvDirectoryHandle.getFileHandle(fileName,{create:true});const writable=await handle.createWritable();await writable.write(blob);await writable.close();return true;}catch(e){return false;}
}
function downloadBlob(fileName,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
