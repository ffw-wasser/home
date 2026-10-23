/* Personal annual PDF: generated locally from the authorized, filtered view. */
(function(g){
 'use strict';
 async function build({year,months,note}){
  const {PDFDocument,StandardFonts,rgb}=g.PDFLib,pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  // Standard PDF fonts support German and Western European names. Unsupported
  // symbols become a readable question mark instead of breaking the export.
  const safe=value=>[...String(value||'').replace(/[\r\n\t]+/g,' ').replace(/[–—]/g,'-')].map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
  function wrap(value,size,width){
   const lines=[];let line='';
   for(const word of safe(value).split(/\s+/)){
    if(!word)continue;
    if(line&&regular.widthOfTextAtSize(line+' '+word,size)<=width){line+=' '+word;continue;}
    if(line){lines.push(line);line='';}
    for(const char of word){if(line&&regular.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}
   }
   if(line)lines.push(line);return lines;
  }
  const W=1190.55,H=841.89,M=28,gap=7,col=(W-M*2-gap*5)/6,pages=[];
  const text=(page,value,x,y,size=7.5,strong=false,color=rgb(.08,.18,.26))=>page.drawText(safe(value),{x,y,size,font:strong?bold:regular,color});
  for(let half=0;half<2;half++){
   const group=months.slice(half*6,half*6+6);let page,y;
   const begin=()=>{
    page=pdf.addPage([W,H]);pages.push(page);y=H-108;
    page.drawRectangle({x:M,y:H-65,width:W-2*M,height:37,color:rgb(.08,.21,.32)});
    text(page,'Jahresprobenplan '+year+' - Feuerwehr Wasser',M+12,H-51,18,true,rgb(1,1,1));
    text(page,'Persönlicher Jahresplan - '+(half?'Juli bis Dezember':'Januar bis Juni'),M,H-80,9);
    group.forEach((month,i)=>{const x=M+i*(col+gap);page.drawRectangle({x,y:y+3,width:col,height:20,color:rgb(.89,.94,.97)});text(page,month.title,x+5,y+9,10,true);});
   };
   begin();
   for(let day=0;day<31;day++){
    const cells=group.map(month=>{
     const row=month.days[day];if(!row)return null;
     const lines=[];
     for(const holiday of row.holidays)for(const line of wrap(holiday,6.5,col-39))lines.push({line,size:6.5,color:rgb(.44,.28,.12)});
     for(const event of row.events){for(const line of wrap(event.title,7.5,col-39))lines.push({line,size:7.5,color:event.birthday?rgb(.52,.13,.22):rgb(0,.31,.53)});for(const line of wrap(event.details,6.5,col-39))lines.push({line,size:6.5});}
     return {...row,lines};
    });
    // An exceptionally busy day continues on another page instead of clipping.
    let offset=0,total=Math.max(1,...cells.map(c=>c?.lines.length||0));
    while(offset<total){
     if(y<75)begin();
     const take=Math.min(total-offset,Math.max(1,Math.floor((y-58)/9))),height=Math.max(19,take*9+6);
     cells.forEach((cell,i)=>{if(!cell)return;const x=M+i*(col+gap),background=cell.birthday?rgb(1,.86,.88):cell.publicHoliday?rgb(.89,.96,.87):cell.holiday?rgb(1,.91,.82):cell.weekend?rgb(1,.97,.78):rgb(.98,.99,1);
      page.drawRectangle({x,y:y-height,width:col,height,color:background,borderColor:rgb(.79,.84,.87),borderWidth:.4});
      text(page,cell.date,x+3,y-11,7,true);
      cell.lines.slice(offset,offset+take).forEach((line,n)=>text(page,line.line,x+34,y-11-n*9,line.size,false,line.color));
     });y-=height;offset+=take;
    }
   }
  }
  pages.forEach((page,i)=>{text(page,'Gelb: Wochenende | Apricot: Ferien | Rosa: Geburtstag | Blau: Probe | Grün: Feiertag',M,36,7);text(page,'Seite '+(i+1)+' / '+pages.length,W-100,36,7);text(page,wrap(note,6,1000)[0]||'',M,24,6);});
  pdf.setTitle('Jahresprobenplan '+year);pdf.setAuthor('Feuerwehr Wasser');
  return {bytes:await pdf.save(),pageCount:pages.length};
 }
 let dialog,host,status,previous,next,counter,link,download,viewer,url='',bytes=null,pageCount=0,current=1,generation=0,valid=()=>false;
 const node=(tag,label)=>{const n=document.createElement(tag);if(label)n.textContent=label;return n;};
 function clear(){generation++;viewer?.destroy();viewer=null;bytes=null;if(url)URL.revokeObjectURL(url);url='';link?.removeAttribute('href');download?.removeAttribute('href');if(dialog?.open)dialog.close();}
 async function showPage(pageNumber){
  if(!valid()){clear();return;}
  const epoch=generation;current=pageNumber;viewer?.destroy();counter.textContent='Seite '+current+' / '+pageCount;previous.disabled=current===1;next.disabled=current===pageCount;
  status.textContent='Mit zwei Fingern zoomen und mit einem Finger verschieben.';
  try{viewer=g.PlanZoom.create(host,bytes,{pageNumber:current,label:'Jahresprobenplan'});await viewer.ready;}catch{if(epoch===generation)status.textContent='Vorschau nicht verfügbar. Bitte „PDF öffnen“ wählen.';}
 }
 function init(){
  if(dialog)return;
  dialog=node('dialog');dialog.className='year-plan-pdf-dialog';dialog.id='year-plan-pdf-dialog';dialog.setAttribute('aria-label','Jahresplan als PDF');
  const header=node('div'),title=node('h2','Jahresplan als PDF'),close=node('button','Schließen');header.className='year-plan-pdf-actions';close.type='button';close.onclick=clear;header.append(title,close);
  const actions=node('div');actions.className='year-plan-pdf-actions';previous=node('button','←');previous.type='button';previous.setAttribute('aria-label','Vorherige PDF-Seite');next=node('button','→');next.type='button';next.setAttribute('aria-label','Nächste PDF-Seite');counter=node('span');counter.setAttribute('aria-live','polite');link=node('a','PDF öffnen ↗');link.target='_blank';link.rel='noopener noreferrer';download=node('a','Speichern');actions.append(previous,counter,next,link,download);
  previous.onclick=()=>showPage(current-1);next.onclick=()=>showPage(current+1);status=node('p');status.setAttribute('role','status');host=node('div');host.className='plan-zoom year-plan-pdf-map';
  dialog.append(header,actions,status,host);document.body.append(dialog);dialog.addEventListener('close',()=>{if(url||bytes)clear();});dialog.addEventListener('cancel',clear);g.addEventListener('pagehide',clear);
 }
 async function open(model){
  clear();init();valid=model.isCurrent;if(!valid())return;const epoch=generation;
  link.hidden=download.hidden=true;previous.disabled=next.disabled=true;counter.textContent='';status.textContent='PDF wird erstellt …';dialog.showModal();
  try{const result=await build(model);if(epoch!==generation)return;if(!valid()){clear();return;}
   bytes=result.bytes;pageCount=result.pageCount;url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));link.href=download.href=url;download.download='Jahresprobenplan-'+model.year+'.pdf';link.hidden=download.hidden=false;await showPage(1);
  }catch(e){if(epoch===generation)status.textContent='PDF konnte nicht erstellt werden. Bitte erneut versuchen.';}
 }
 g.YearPlanPdf={build,open,clear};
})(globalThis);
