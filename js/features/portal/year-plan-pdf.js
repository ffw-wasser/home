/* Shared A4 annual PDF layout; each authorized view supplies its own events. */
(function(g){
 'use strict';
 async function build({year,months,note,colors=g.CalendarPresentation?.defaults()}){
  const {PDFDocument,StandardFonts,rgb}=g.PDFLib,pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe=value=>[...String(value||'').replace(/[\r\n\t]+/g,' ').replace(/[–—]/g,'-')].map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
  function wrap(value,size,width){const lines=[];let line='';for(const word of safe(value).split(/\s+/)){if(!word)continue;if(line&&bold.widthOfTextAtSize(line+' '+word,size)<=width){line+=' '+word;continue;}if(line){lines.push(line);line='';}for(const char of word){if(line&&bold.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);return lines;}
  const compact=true,W=compact?841.89:1190.55,H=compact?595.28:841.89,M=compact?18:28,gap=compact?5:7,col=(W-M*2-gap*5)/6,offset=compact?25:36,width=col-offset-4,top=H-(compact?88:108),ink=rgb(.08,.18,.26),pages=[];
  let condensed=false,bottom=compact?66:62,available=top-bottom;
  const text=(page,value,x,y,size=8,strong=false,color=ink)=>page.drawText(safe(value),{x,y,size,font:strong?bold:regular,color});
  const palette=(raw,native=false)=>{const channels=raw.slice(1).match(/../g).map(v=>parseInt(v,16));return {color:native?ink:rgb(...channels.map(v=>Math.min(v,175)/255)),accent:native?rgb(...channels.map(v=>v/255)):null,background:rgb(...channels.map(v=>(229.5+v*.1)/255))};};
  const allEvents=months.flatMap(month=>month.days.flatMap(day=>day.events||[])),native=allEvents.some(event=>event.googleColor),types=g.CalendarPresentation?.types||[],used=new Map();
  if(native){for(const event of allEvents){const type=types.find(type=>type.id===(event.type||(event.birthday?'birthday':'other')))||types.find(type=>type.id==='other'),raw=event.googleColor||colors?.[type.id]||type.color,key=(event.googleColor?'google:':'app:')+raw.toUpperCase();if(!used.has(key))used.set(key,{raw,native:!!event.googleColor,labels:new Set()});used.get(key).labels.add(type.label);}}
  const combined=new Map();for(const entry of used.values()){const label=[...entry.labels].sort((a,b)=>a.localeCompare(b,'de')).join(' / ');if(!combined.has(label))combined.set(label,{label,swatches:[]});combined.get(label).swatches.push(palette(entry.raw,entry.native));}
  const legend=[{label:'Ferien',background:rgb(1,1,.8)},{label:'Sonntag',background:rgb(1,.8,.6)},{label:'Feiertag',background:rgb(.89,.96,.87)},...(native?[...combined.values()]:types.map(type=>({label:type.label,...palette(colors?.[type.id]||type.color)})))];
  const legendSlots=[];let legendX=M+40,legendRow=0;
  for(const entry of legend){const width=regular.widthOfTextAtSize(safe(entry.label),7.5)+(entry.swatches?.length||1)*15+12;if(legendX+width>W-M){legendX=M+40;legendRow++;}legendSlots.push({...entry,x:legendX,row:legendRow});legendX+=width;}
  bottom=Math.max(bottom,66+legendRow*13);available=top-bottom;
  const clipped=(value,size,width)=>{let s=safe(value);while(s&&bold.widthOfTextAtSize(s+' ...',size)>width)s=s.slice(0,-1);return s+' ...';};
  function rows(month,size,details,notes){return month.days.map(row=>{const lines=[];for(const holiday of (compact?row.compactHolidays??row.holidays:row.holidays)||[])for(const line of wrap(holiday,compact?6.8:8,width))lines.push({line,size:compact?6.8:8,strong:true,color:rgb(.22,.36,.2)});
   for(const event of row.events||[]){const raw=event.googleColor||colors?.[event.type]||(event.birthday?'#AF526F':'#326A9B'),{color,accent,background}=palette(raw,!!event.googleColor);for(const line of wrap(compact?String(event.title||'').replace(/^Ganztägig\s*[·-]\s*/,'').replace(/ Uhr\s*·/,' ·'):event.title,size,width))lines.push({line,size,strong:true,color,accent,background});if(details)for(const line of wrap(event.details,8,width))lines.push({line,size:8});if(notes&&event.note){const short=event.note.length>100?event.note.slice(0,97)+' ...':event.note;for(const line of wrap(short,8,width))lines.push({line,size:8});}}
   return {...row,lines};});}
  const height=(row,leading)=>Math.max(compact?11:18,row.lines.length*leading+(compact?4:6)),total=(data,leading)=>data.reduce((sum,row)=>sum+height(row,leading),0);
  for(let half=0;half<2;half++){
   const page=pdf.addPage([W,H]);pages.push(page);page.drawRectangle({x:M,y:H-65,width:W-2*M,height:37,color:rgb(.08,.21,.32)});page.drawRectangle({x:M,y:H-65,width:5,height:37,color:rgb(.75,.06,.09)});text(page,'Jahresprobenplan '+year+' - Feuerwehr Wasser',M+12,H-51,compact?16:18,true,rgb(1,1,1));if(!compact)text(page,'Persönlicher Jahresplan - '+(half?'Juli bis Dezember':'Januar bis Juni'),M,H-80,9);
   months.slice(half*6,half*6+6).forEach((month,i)=>{
    const x=M+i*(col+gap);page.drawRectangle({x,y:top+3,width:col,height:20,color:compact?rgb(.68,.06,.09):rgb(.91,.9,.9)});text(page,month.title,x+5,top+9,10,true,compact?rgb(1,1,1):ink);
    let leading=compact?9:11,data=rows(month,compact?8:9,!compact,!compact);if(compact&&month.days.some(row=>row.events?.some(event=>event.details||event.note)))condensed=true;
    if(total(data,leading)>available){data=rows(month,compact?8:9,!compact,false);condensed=true;}
    if(total(data,leading)>available){data=rows(month,compact?7.6:8.5,false,false);leading=compact?8.4:9.5;condensed=true;}
    if(total(data,leading)>available){
     // A fixed two-page overview stays legible even for excessive source data.
     // Explicit markers point to the complete authorized calendar instead of hiding truncation.
     const full=data.map(r=>r.lines),caps=full.map(lines=>Math.min(1,lines.length));const capped=()=>data.map((r,n)=>({...r,lines:full[n].slice(0,caps[n])}));data=capped();let changed=true;while(changed){changed=false;for(let n=0;n<caps.length;n++){if(caps[n]>=full[n].length)continue;caps[n]++;const next=capped();if(total(next,leading)<=available){data=next;changed=true;}else caps[n]--;}}
     data=data.map((r,n)=>{if(caps[n]>=full[n].length)return r;const lines=[...r.lines],last=lines.at(-1);if(last){const many=(r.events||[]).length>caps[n];lines[lines.length-1]={...last,line:many?(r.events.length+(compact?' Termine - im Kalender':' Termine - Details im Kalender')):clipped(last.line,last.size,width),size:many?7:last.size};}return {...r,lines};});condensed=true;
    }
    if((month.days||[]).some(r=>(r.events||[]).some(e=>(e.note||'').length>100)))condensed=true;
    const extra=Math.max(0,(available-total(data,leading))/Math.max(1,data.length));let y=top;
    for(const row of data){const h=height(row,leading)+extra,bg=row.holiday?rgb(1,1,.8):row.publicHoliday?rgb(.89,.96,.87):row.sunday?rgb(1,.8,.6):rgb(1,1,1);page.drawRectangle({x,y:y-h,width:col,height:h,color:bg,borderColor:rgb(.79,.84,.87),borderWidth:.4});text(page,row.date,x+3,y-(compact?9:11),compact?6.8:7,true);row.lines.forEach((line,n)=>{if(line.background){page.drawRectangle({x:x+offset-3,y:y-(compact?12:14)-n*leading,width:col-offset+2,height:leading,color:line.background});page.drawRectangle({x:x+offset-3,y:y-(compact?12:14)-n*leading,width:2,height:leading,color:line.accent||line.color});}text(page,line.line,x+offset,y-(compact?9:11)-n*leading,line.size,line.strong,line.color);});y-=h;}
   });
  }
  pages.forEach((page,i)=>{
   const topY=48+legendRow*13;text(page,'Farben:',M,topY,7.5,true);
   for(const entry of legendSlots){const y=topY-entry.row*13,swatches=entry.swatches||[entry];swatches.forEach((swatch,n)=>{const x=entry.x+n*15;page.drawRectangle({x,y:y-1,width:12,height:8,color:swatch.background,borderColor:rgb(.65,.7,.74),borderWidth:.4});if(swatch.color)page.drawRectangle({x,y:y-1,width:swatch.accent?12:3,height:8,color:swatch.accent||swatch.color});});text(page,entry.label,entry.x+swatches.length*15+1,y,7.5);}
   text(page,compact?'DIN A4 quer · Alle Tage · Zusatzangaben und umfangreiche Tage: vollständige Angaben im Kalender.':'Zwei-Seiten-Übersicht. Zusatzinfos und sehr umfangreiche Tage ggf. gekürzt; vollständige Angaben in der Kalenderansicht.',M,compact?18:30,compact?6.8:7);text(page,'Seite '+(i+1)+' / 2',W-78,compact?18:30,7);if(!compact)text(page,wrap(note,6,1000)[0]||'',M,18,6);
  });pdf.setTitle('Jahresprobenplan '+year);pdf.setAuthor('Feuerwehr Wasser');return {bytes:await pdf.save(),pageCount:2,condensed};
 }
 let dialog,host,status,previous,next,counter,link,download,viewer,url='',bytes=null,pageCount=0,current=1,generation=0,notice='',valid=()=>false;
 const node=(tag,label)=>{const n=document.createElement(tag);if(label)n.textContent=label;return n;};
 function clear(){notice='';generation++;viewer?.destroy();viewer=null;bytes=null;if(url)URL.revokeObjectURL(url);url='';link?.removeAttribute('href');download?.removeAttribute('href');if(dialog?.open)dialog.close();}
 async function showPage(pageNumber){
  if(!valid()){clear();return;}
  const epoch=generation;current=pageNumber;viewer?.destroy();counter.textContent='Seite '+current+' / '+pageCount;previous.disabled=current===1;next.disabled=current===pageCount;
  status.textContent=notice+'Mit zwei Fingern zoomen und mit einem Finger verschieben.';
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
   notice=result.condensed?'Zwei-Seiten-Übersicht: Zusatzangaben teilweise gekürzt. Vollständig in der Kalenderansicht. ':'';bytes=result.bytes;pageCount=result.pageCount;url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));link.href=download.href=url;download.download='Jahresprobenplan-'+model.year+'.pdf';link.hidden=download.hidden=false;await showPage(1);
  }catch(e){if(epoch===generation)status.textContent='PDF konnte nicht erstellt werden. Bitte erneut versuchen.';}
 }
 g.YearPlanPdf={build,open,clear};
})(globalThis);
