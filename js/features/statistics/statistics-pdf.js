/* Local PDF output of the displayed statistics. No print dialog or cloud request. */
(function(global){
  'use strict';
  const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#176b36';
  function collect(root,{exclude=''}={}){
    const blocks=[];
    function walk(node){
      if(!node||node.nodeType!==1||node.hidden||exclude&&node.matches(exclude))return;
      if(node.matches('details')&&!node.matches('.statistics-collapsible,#statisticsFurtherDetails,#statisticsFellowshipDetails,.participant-target-card')&&!node.querySelector('.metric-row,table,.participant-target-items'))return;
      if(node.matches('button,a,input,select,label,.statistics-print-header,.individual-print-header,.individual-statistics-controls,.individual-person-heading'))return;
      if(node.matches('.statistics-kpis,.individual-kpis')){
        blocks.push({kind:'kpis',items:[...node.children].map(item=>({label:text(item.querySelector('span')),value:text(item.querySelector('strong')),detail:[...item.querySelectorAll('small')].map(text).join(' · ')}))});return;
      }
      if(node.matches('.commander-readiness-item,.statistics-donut-layout')){
        const svg=node.querySelector('svg'),segments=[...svg.querySelectorAll('circle[stroke-dasharray]')].map(circle=>({percent:Number(circle.getAttribute('stroke-dasharray').split(' ')[0]),color:color(circle.getAttribute('stroke'))}));
        blocks.push({kind:'ring',label:text(node.querySelector('h4')),value:text(svg.querySelector('text')),segments,legend:[...node.querySelectorAll('.commander-status-legend span,.statistics-chart-legend>div')].map(item=>[...item.children].length>1?[...item.children].map(text).filter(Boolean).join(' '):text(item)),detail:text(node.querySelector('p'))});return;
      }
      if(node.matches('.commander-months')){
        blocks.push({kind:'months',items:[...node.children].map(month=>{const match=month.getAttribute('aria-label').match(/^(.*?): (\d+) Übungen, (\d+) Einsätze$/);return match?{label:match[1],drills:Number(match[2]),operations:Number(match[3])}:null;}).filter(Boolean)});return;
      }
      if(node.matches('.commander-month-legend'))return;
      if(node.matches('.commander-personnel-row,.statistics-bar-row,.commander-rank-row')){
        const rank=node.matches('.commander-rank-row'),label=rank?text(node.querySelector('.commander-rank-name')):text(node.querySelector(':scope>span'));
        const bar=node.querySelector('.commander-track>i,.commander-ranking-track>i,:scope>div>i');
        blocks.push({kind:'bar',label:rank?text(node.querySelector('.commander-rank-place'))+'. '+label:label,value:rank?[...node.querySelector('strong').children].map(text).join(' · '):text(node.querySelector('strong')),percent:Math.max(0,Math.min(100,parseFloat(bar?.style.width)||0))});return;
      }
      if(node.matches('.individual-clearance-heading')){blocks.push({kind:'heading',value:text(node.querySelector('h4'))},{kind:'paragraph',value:text(node.querySelector('[data-individual-clearance-status]'))});return;}
      if(node.matches('.metric-row,.individual-clearance-item,.participant-target-card,.individual-recent-row')){
        if(node.matches('.metric-row,.individual-clearance-item'))blocks.push({kind:'row',label:text(node.querySelector('span')),value:text(node.querySelector('strong'))});
        else if(node.matches('.participant-target-card')){blocks.push({kind:'paragraph',value:[...node.querySelectorAll('summary strong,summary span,summary>b,.participant-target-items>div')].map(item=>item.matches('.participant-target-items>div')?[...item.children].map(text).join(' / '):text(item)).join(' · ')});}else blocks.push({kind:'paragraph',value:[...node.children].map(text).join(' · ')});
        return;
      }
      if(node.matches('table')){
        blocks.push({kind:'table',headers:[...node.querySelectorAll('thead th')].map(text),rows:[...node.querySelectorAll('tbody tr')].map(row=>[...row.children].map(text))});return;
      }
      if(node.matches('h3,h4,h5')){blocks.push({kind:'heading',value:text(node)});return;}
      if(node.matches('p,.statistics-note')){if(text(node))blocks.push({kind:'paragraph',value:text(node)});return;}
      if(node.matches('summary')){
        if(!node.parentElement.matches('.statistics-collapsible,#statisticsFurtherDetails,#statisticsFellowshipDetails')&&text(node))blocks.push({kind:'heading',value:text(node)});
        return;
      }
      if(node.matches('.statistics-collapsible'))blocks.push({kind:'heading',value:text(node.querySelector(':scope>summary>span'))});
      for(const child of node.children)walk(child);
    }
    walk(root);return blocks;
  }
  function annual(view,year){
    const find=selector=>view.querySelector(selector),sections=[];
    for(const [title,selectors] of [['Feuerwehr',[':scope>.statistics-kpis','#statisticsCommanderDashboard']],['Weitere Feuerwehr-Auswertungen',['#statisticsFurtherDetails']],['Kameradschaftspflege',['#statisticsFellowshipDetails']]]){
      const blocks=selectors.flatMap(selector=>collect(find(selector),{exclude:'.individual-statistics-panel'}));
      if(blocks.length)sections.push({title,blocks});
    }
    return {title:'Jahresstatistik '+year,subtitle:text(find('#statisticsPeriod')),sections};
  }
  function individual(preview,year,name){return {title:'Teilnehmerstatistik '+year,subtitle:name+' · '+text(preview.querySelector('#individualStatisticsPeriod')),sections:[{title:name,blocks:collect(preview)}]};}
  async function create(model,library=global.PDFLib){
    if(!library?.PDFDocument)throw Error('Das PDF-Modul ist nicht geladen. Bitte die App aktualisieren.');
    const {PDFDocument,StandardFonts,rgb}=library,pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.setTitle(model.title);pdf.setAuthor('Feuerwehr Wasser');pdf.setSubject(model.subtitle||'Statistik');
    const W=515,L=40,B=48,ink=rgb(.10,.18,.15),green=rgb(.09,.42,.21),muted=rgb(.25,.34,.30),pale=rgb(.90,.94,.91),line=rgb(.80,.85,.82);
    const clean=value=>[...String(value??'').replace(/[–—−]/g,'-').replace(/[\u00a0\u202f]/g,' ').replace(/[\r\n\t]+/g,' ').replace(/→/g,'>')].map(char=>{try{regular.encodeText(char);return char;}catch{const plain=char.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');try{regular.encodeText(plain);return plain;}catch{return '?';}}}).join('');
    const face=heavy=>heavy?bold:regular;
    const wrap=(value,width,size=9,heavy=false)=>{
      const font=face(heavy),words=clean(value).split(/\s+/),lines=[];let current='';
      for(const word of words){
        if(font.widthOfTextAtSize((current?current+' ':'')+word,size)<=width){current+=(current?' ':'')+word;continue;}
        if(current){lines.push(current);current='';}
        for(const char of word){if(current&&font.widthOfTextAtSize(current+char,size)>width){lines.push(current);current='';}current+=char;}
      }
      if(current||!lines.length)lines.push(current);return lines;
    };
    let page,y=0;
    const draw=(value,x,top,size=9,heavy=false,tone=ink)=>page.drawText(clean(value),{x,y:top-size,size,font:face(heavy),color:tone});
    function next(){page=pdf.addPage([595,842]);y=802;draw('FEUERWEHR WASSER',L,y,13,true,green);y-=22;draw(model.title,L,y,11,true);y-=21;page.drawLine({start:{x:L,y},end:{x:L+W,y},thickness:1,color:green});y-=18;}
    const ensure=height=>{if(y-height<B)next();};
    const paragraph=(value,size=9)=>{for(const item of wrap(value,W,size)){ensure(size+7);draw(item,L,y,size,false,muted);y-=size+4;}y-=6;};
    const heading=(value,major=false)=>{ensure(major?190:175);y-=major?12:5;for(const item of wrap(value,W,major?16:11,true)){draw(item,L,y,major?16:11,true,green);y-=major?22:16;}y-=5;};
    function cells(values,widths,heavy=false,background=false){
      const lines=values.map((value,i)=>wrap(value,widths[i]-14,8,heavy)),height=Math.max(1,...lines.map(v=>v.length))*11+12;ensure(height);
      if(background)page.drawRectangle({x:L,y:y-height,width:W,height,color:pale});
      let x=L;lines.forEach((items,i)=>{items.forEach((item,j)=>draw(item,x+7,y-5-j*11,8,heavy));x+=widths[i];});
      y-=height;page.drawLine({start:{x:L,y},end:{x:L+W,y},thickness:.4,color:line});return height;
    }
    next();paragraph(model.subtitle||'');
    for(const section of model.sections){
      heading(section.title,true);
      for(const block of section.blocks){
        if(block.kind==='heading'){if(block.value!==section.title)heading(block.value);}
        else if(block.kind==='paragraph')paragraph(block.value);
        else if(block.kind==='row')cells([block.label,block.value],[W*.55,W*.45],false,true);
        else if(block.kind==='bar'){
          const labels=wrap(block.label,W-130,9,true),values=wrap(block.value,115,9,true),height=Math.max(labels.length,values.length)*12+22;ensure(height);
          labels.forEach((value,index)=>draw(value,L,y-index*12,9,true));values.forEach((value,index)=>draw(value,L+W-115,y-index*12,9,true));
          const bottom=y-height+9;page.drawRectangle({x:L,y:bottom,width:W,height:7,color:pale});if(block.percent>0)page.drawRectangle({x:L,y:bottom,width:W*block.percent/100,height:7,color:green});y-=height+6;
        }else if(block.kind==='kpis'){
          for(let start=0;start<block.items.length;start+=(block.items.length===4?4:3)){
            const columns=block.items.length===4?4:3,items=block.items.slice(start,start+columns),width=(W-(columns-1)*10)/columns,prepared=items.map(item=>({label:wrap(item.label,width-16,8,true),value:wrap(item.value,width-16,17,true),detail:wrap(item.detail,width-16,8)})),height=Math.max(...prepared.map(item=>item.label.length*11+item.value.length*20+item.detail.length*11+26));ensure(height+10);
            prepared.forEach((item,index)=>{const x=L+index*(width+10);page.drawRectangle({x,y:y-height,width,height,color:pale});let top=y-8;item.label.forEach(value=>{draw(value,x+8,top,8,true);top-=11;});top-=5;item.value.forEach(value=>{draw(value,x+8,top,17,true,green);top-=20;});item.detail.forEach(value=>{draw(value,x+8,top,8,false,muted);top-=11;});});y-=height+12;
          }
        }else if(block.kind==='ring'){
          const legend=block.legend.map((value,index)=>({lines:wrap(value,W-145,9),color:block.segments[index]?.color||'#667680'})),detail=wrap(block.detail||'',W-145,9),height=Math.max(110,(legend.reduce((sum,item)=>sum+item.lines.length,0)+detail.length)*13+25);ensure(height);
          if(block.label){draw(block.label,L,y,10,true);y-=18;}
          const cx=L+50,cy=y-40,radius=33;
          const tone=hex=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
          for(let i=0;i<180;i++){const a=(90-i*2)*Math.PI/180,b=(90-(i+1)*2)*Math.PI/180,percent=i/180*100;let offset=0,hex='#e0e7e4';for(const segment of block.segments){if(percent>=offset&&percent<offset+segment.percent){hex=segment.color;break;}offset+=segment.percent;}page.drawLine({start:{x:cx+Math.cos(a)*radius,y:cy+Math.sin(a)*radius},end:{x:cx+Math.cos(b)*radius,y:cy+Math.sin(b)*radius},thickness:10,lineCap:1,color:tone(hex)});}
          const value=clean(block.value),size=value.length>7?11:16;draw(value,cx-bold.widthOfTextAtSize(value,size)/2,cy+size/2,size,true,green);
          let top=y;for(const item of legend){page.drawCircle({x:L+125,y:top-5,size:3,color:tone(item.color)});for(const value of item.lines){draw(value,L+137,top,9);top-=13;}}for(const value of detail){draw(value,L+137,top,9,false,muted);top-=13;}y-=height;
        }else if(block.kind==='months'){
          ensure(148);const max=Math.max(1,...block.items.flatMap(item=>[item.drills,item.operations])),width=W/12,baseline=y-90;
          block.items.forEach((item,index)=>{const x=L+index*width;for(const [n,value] of [item.drills,item.operations].entries())page.drawRectangle({x:x+8+n*10,y:baseline,width:8,height:value/max*70,color:n?rgb(.14,.43,.64):green});draw(item.label,x+5,baseline-7,8);if(item.drills||item.operations)draw(item.drills+' / '+item.operations,x+4,baseline-21,8);});draw('Grün: Übungen · Blau: Einsätze',L,baseline-40,9,false,muted);y-=148;
        }else if(block.kind==='table'){
          if(!block.rows.length){paragraph('Keine Monatswerte geladen.');continue;}
          const count=Math.max(block.headers.length,...block.rows.map(row=>row.length)),widths=Array(count).fill(W/count);ensure(60);cells(block.headers,widths,true,true);
          block.rows.forEach((row,index)=>{const height=Math.max(...row.map(value=>wrap(value,W/count-14,8).length))*11+12;if(y-height<B){next();cells(block.headers,widths,true,true);}cells(row,widths,false,index%2===0);});y-=12;
        }
      }
    }
    pdf.getPages().forEach((item,index)=>{item.drawText('Feuerwehr Wasser · '+(index+1)+' / '+pdf.getPageCount(),{x:L,y:25,size:8,font:regular,color:muted});});
    return new Blob([await pdf.save()],{type:'application/pdf'});
  }
  let dialog,objectUrl='',generation=0;
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='statisticsPdfDialog';dialog.className='statistics-pdf-dialog';dialog.setAttribute('aria-labelledby','statisticsPdfDialogTitle');
    dialog.innerHTML='<h2 id="statisticsPdfDialogTitle">Statistik als PDF</h2><p data-pdf-status role="status" aria-live="polite"></p><div class="statistics-pdf-actions" hidden><a class="primary-button" data-pdf-open target="_blank" rel="noopener">PDF öffnen</a><a class="outline-button" data-pdf-save>PDF speichern</a></div><button class="secondary-button" type="button" data-pdf-close>Schließen</button>';
    dialog.querySelector('[data-pdf-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>generation++);document.body.append(dialog);return dialog;
  }
  async function open(model,filename){
    const view=ensureDialog(),request=++generation,status=view.querySelector('[data-pdf-status]'),actions=view.querySelector('.statistics-pdf-actions');actions.hidden=true;status.textContent='PDF wird erstellt …';if(!view.open)view.showModal();
    try{
      const blob=await create(model);if(request!==generation)return null;
      const url=URL.createObjectURL(blob);if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=url;
      view.querySelector('[data-pdf-open]').href=url;const save=view.querySelector('[data-pdf-save]');save.href=url;save.download=filename;actions.hidden=false;status.textContent='PDF ist fertig. Du kannst sie öffnen oder auf dem Gerät speichern.';return blob;
    }catch(error){if(request===generation)status.textContent='PDF konnte nicht erstellt werden. '+(error.message||'Bitte erneut versuchen.');return null;}
  }
  global.StatisticsPdf={annual,individual,collect,create,open};
})(globalThis);
