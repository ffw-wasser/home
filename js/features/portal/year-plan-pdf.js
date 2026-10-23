/* Personal annual PDF: generated locally from the authorized, filtered view. */
(function(g){
 'use strict';
 async function build({year,months,note,colors=g.CalendarPresentation?.defaults(),personal=true}){
  const {PDFDocument,StandardFonts,rgb}=g.PDFLib,pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  // Standard PDF fonts support German and Western European names. Unsupported
  // symbols become a readable question mark instead of breaking the export.
  const safe=value=>[...String(value||'').replace(/[\r\n\t]+/g,' ').replace(/[–—]/g,'-')].map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
  function wrap(value,size,width){
   const lines=[];let line='';
   for(const word of safe(value).split(/\s+/)){
    if(!word)continue;
    if(line&&bold.widthOfTextAtSize(line+' '+word,size)<=width){line+=' '+word;continue;}
    if(line){lines.push(line);line='';}
    for(const char of word){if(line&&regular.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}
   }
   if(line)lines.push(line);return lines;
  }
  const appendix=[],references=new Map();
  const color=hex=>{const values=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);return rgb(...values);};
  const W=1190.55,H=841.89,M=28,gap=7,col=(W-M*2-gap*5)/6,pages=[];
  const text=(page,value,x,y,size=7.5,strong=false,color=rgb(.08,.18,.26))=>page.drawText(safe(value),{x,y,size,font:strong?bold:regular,color});
  for(let half=0;half<2;half++){
   const group=months.slice(half*6,half*6+6);let page,y;
   const begin=()=>{
    page=pdf.addPage([W,H]);pages.push(page);y=H-108;
    page.drawRectangle({x:M,y:H-65,width:W-2*M,height:37,color:rgb(.08,.21,.32)});
    text(page,'Jahresprobenplan '+year+' - Feuerwehr Wasser',M+12,H-51,18,true,rgb(1,1,1));
    text(page,(personal?'Persönlicher Jahresplan - ':'Gesamtplan - ')+(half?'Juli bis Dezember':'Januar bis Juni'),M,H-80,9);
    group.forEach((month,i)=>{const x=M+i*(col+gap);page.drawRectangle({x,y:y+3,width:col,height:20,color:rgb(.91,.9,.9)});text(page,month.title,x+5,y+9,10,true);});
   };
   begin();
   for(let day=0;day<31;day++){
    const cells=group.map(month=>{
     const row=month.days[day];if(!row)return null;
     const lines=[];
     for(const holiday of row.holidays)for(const line of wrap(holiday,8,col-39))lines.push({line,size:8,strong:true,color:rgb(.22,.36,.2)});
     for(const event of row.events){const raw=colors?.[event.type]|| (event.birthday?'#AF526F':'#326A9B'),channels=raw.slice(1).match(/../g).map(v=>parseInt(v,16)),ink=rgb(...channels.map(v=>Math.min(v,175)/255)),background=rgb(...channels.map(v=>(229.5+v*.1)/255));let ref='';if(event.note&&event.note.length>100){const key=event.title+'|'+event.note;if(!references.has(key)){references.set(key,appendix.length+1);appendix.push({title:event.title,note:event.note});}ref=' ['+references.get(key)+']';}for(const line of wrap(event.title+ref,9,col-39))lines.push({line,size:9,strong:true,color:ink,background});for(const line of wrap(event.details,8,col-39))lines.push({line,size:8});if(event.note&&!ref)for(const line of wrap(event.note,8,col-39))lines.push({line,size:8});}
     return {...row,lines};
    });
    // An exceptionally busy day continues on another page instead of clipping.
    let offset=0,total=Math.max(1,...cells.map(c=>c?.lines.length||0));
    while(offset<total){
     if(y<75)begin();
     const take=Math.min(total-offset,Math.max(1,Math.floor((y-58)/11))),height=Math.max(18,take*11+6);
     cells.forEach((cell,i)=>{if(!cell)return;const x=M+i*(col+gap),background=cell.holiday?rgb(1,1,.8):cell.publicHoliday?rgb(.89,.96,.87):cell.sunday?rgb(1,.8,.6):rgb(1,1,1);
      page.drawRectangle({x,y:y-height,width:col,height,color:background,borderColor:rgb(.79,.84,.87),borderWidth:.4});
      text(page,cell.date,x+3,y-11,7,true);
      cell.lines.slice(offset,offset+take).forEach((line,n)=>{if(line.background){page.drawRectangle({x:x+32,y:y-14-n*11,width:col-33,height:11,color:line.background});page.drawRectangle({x:x+32,y:y-14-n*11,width:2,height:11,color:line.color});}text(page,line.line,x+36,y-11-n*11,line.size,line.strong,line.color);});
     });y-=height;offset+=take;
    }
   }
  }
  if(appendix.length){let page,y;const begin=()=>{page=pdf.addPage([W,H]);pages.push(page);text(page,'Zusatzinformationen zum Jahresplan '+year,M,H-46,18,true);y=H-80;};begin();for(let i=0;i<appendix.length;i++){const item=appendix[i],lines=[...wrap('['+(i+1)+'] '+item.title,11,W-2*M),...wrap(item.note,10,W-2*M)];for(let n=0;n<lines.length;n++){if(y<65)begin();text(page,lines[n],M,y,n===0?11:10,n===0);y-=15;}y-=14;}}
  pages.forEach((page,i)=>{text(page,'Hellgelb: Ferien | Apricot: Sonntag | Terminfarben nach Art | Feiertage mit Namen',M,36,7);text(page,'Seite '+(i+1)+' / '+pages.length,W-100,36,7);text(page,wrap(note,6,1000)[0]||'',M,24,6);});
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
