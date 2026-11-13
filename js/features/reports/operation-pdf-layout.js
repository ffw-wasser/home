(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OperationPdfLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/[\t\u00a0]/g,' ').trim();
 const dateDE=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return m?`${m[3]}.${m[2]}.${m[1]}`:clean(value);};
 function lines(text,font,size,width){
  const result=[];
  for(const paragraph of clean(text).split('\n')){
   let line='';
   for(const word of paragraph.split(/ +/).filter(Boolean)){
    const candidate=line?line+' '+word:word;
    if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
    if(line){result.push(line);line='';}
    if(font.widthOfTextAtSize(word,size)<=width){line=word;continue;}
    for(const char of word){if(font.widthOfTextAtSize(line+char,size)>width&&line){result.push(line);line='';}line+=char;}
   }
   result.push(line);
  }
  return result;
 }
 const list=value=>(Array.isArray(value)?value:[]).map(clean).filter(Boolean).join('; ');
 function reserve(d,name){
  const value=d.reserveTimes?.[name];if(!value?.from&&!value?.to)return '';
  const stamps={};let day=0,previous='';for(const key of ['alarm','departed','arrived','ended']){const time=d.times?.[key];if(!/^\d{2}:\d{2}$/.test(time||'')||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))continue;if(previous&&time<previous)day++;const date=new Date(d.date+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+day);stamps[key]=date.toISOString().slice(0,10)+'T'+time;previous=time;}
  const show=stamp=>{const [date,time]=String(stamp||'').split('T');return dateDE(date)+(time?' '+time:'');};
  const from=value.from||stamps.arrived,to=value.to||stamps.ended,minutes=Math.round((Date.parse(to)-Date.parse(from))/60000),duration=Number.isFinite(minutes)&&minutes>=0?' ('+Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+' h)':'';
  return ' · '+show(from)+' bis '+show(to)+duration;
 }
 function crew(d){const groups=new Map();for(const name of d.members||[]){const group=d.assignments?.[name]||'Ohne Zuordnung';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(clean(name)+(d.assignmentRoles?.[name]?' ('+clean(d.assignmentRoles[name])+')':'')+reserve(d,name));}return [...groups].map(([group,people])=>group+': '+people.join('; ')).join('\n');}
 async function create(PDFLib,_templates,d,assets){
  if(!assets?.fontkit||!assets.regular||!assets.bold)throw new Error('Die lokalen PDF-Schriften fehlen. Bitte die Anwendung aktualisieren.');
  const {PDFDocument,rgb}=PDFLib,pdf=await PDFDocument.create();pdf.registerFontkit(assets.fontkit);
  const regular=await pdf.embedFont(assets.regular,{subset:true}),bold=await pdf.embedFont(assets.bold,{subset:true}),characters=new Set(regular.getCharacterSet());
  for(const char of JSON.stringify(d))if(char>=' '&&!characters.has(char.codePointAt(0)))throw new Error('Die PDF-Schrift unterstützt das Zeichen „'+char+'“ nicht. Die Eingaben bleiben erhalten.');
  const vehicles=d.stationOnly?'Keine · Gerätehausbesetzung':list([...new Set([...(d.reportVehicles||[]),...Object.values(d.assignments||{}).filter(value=>/^EM /.test(value))])]);
  const amounts=Object.entries(d.deviceAmounts||{}).filter(([,amount])=>Number(amount)>0).map(([name,amount])=>amount+' × '+name);
  for(const name of d.devices||[])if(!(name in (d.deviceAmounts||{})))amounts.push(name);
  const sections1=[['Alarmierung',list(d.alarmMethods)],['Zeiten', [['Alarm',d.times?.alarm],['Ausgerückt',d.times?.departed],['Einsatzstelle',d.times?.arrived],['Einsatzende',d.times?.ended],['Eingerückt',d.times?.returned]].map(([label,time])=>label+': '+(time||'offen')).join(' · ')],['Eingesetzte Fahrzeuge',vehicles],['Rohre / Schlauchmaterial',[d.pipes?.c?'C-Rohre: '+d.pipes.c:'',d.pipes?.b?'B-Rohre: '+d.pipes.b:'',d.pipes?.monitor?'Wasserwerfer: '+d.pipes.monitor:'',d.pipes?.smallExtinguishers?'Kleinlöschgeräte: '+d.pipes.smallExtinguishers:'',d.pipes?.description].filter(Boolean).join('; ')],['Wasserentnahme',list(d.waterSources)],['Geräte / Sonstiges',[amounts.join('; '),d.deviceOther].filter(Boolean).join('; ')],['Ölbindemittel / Betriebsstoffe',d.oil?.description],['Mannschaft · '+(d.members||[]).length+' Einsatzkräfte',crew(d)]];
  const sections2=[['Lage beim Eintreffen',d.situation],['Verlauf der Tätigkeit',d.actions],['Personen / Menschenrettung / Verletzungen',d.persons],['Besondere Vorkommnisse',d.special],['Anwesende Behörden und Organisationen',list(d.agencies)]];
  const fields=[['Einsatznummer',d.number],['Einsatzart',clean(d.type)+(d.powerOutage&&!/stromausfall/i.test(d.type||'')?' · Stromausfall':'')],['Einsatzstelle',d.location],['Einsatzleiter',d.leader],['ZvD',d.zvd],['Verursacher / Geschädigte',d.affected],['Anschrift',d.affectedAddress]];
  const impossible=regular.widthOfTextAtSize([...fields,...sections1,...sections2].map(([,value])=>clean(value).replace(/\n/g,' ')).join(' '),7)>2*658/10*491;
  if(impossible)throw new Error('Das Einsatzprotokoll passt nicht auf zwei Seiten. Es wurden keine Angaben abgeschnitten; die Eingaben bleiben erhalten.');
  let layout;
  for(let size=9;size>=7;size-=0.25){
   const plan=blocks=>blocks.map(([title,text])=>({title,lines:lines(text||'—',regular,size,491)}));
   const first=plan(sections1),second=plan(sections2),fieldPlan=fields.map(([title,text])=>({title,lines:lines(text||'—',regular,size,355)})),step=size+3;
   const height=blocks=>blocks.reduce((sum,block)=>sum+20+block.lines.length*step+7,0);
   const fieldHeight=fieldPlan.reduce((sum,field)=>sum+Math.max(17,field.lines.length*step+4),0);
   if(fieldHeight+height(first)<=658&&height(second)<=658){layout={size,step,first,second,fieldPlan};break;}
  }
  if(!layout)throw new Error('Das Einsatzprotokoll passt vollständig nicht auf zwei Seiten. Bitte sehr lange Berichtstexte kürzen. Es wurden keine Angaben abgeschnitten; die Eingaben bleiben erhalten.');
  const text=(page,value,x,y,size,font=regular)=>page.drawText(clean(value),{x,y,size,font,color:rgb(0,0,0)});
  const header=(page,number)=>{page.drawRectangle({x:48,y:778,width:499,height:25,color:rgb(.9,.9,.9)});text(page,'EINSATZBERICHT Feuerwehr Emmendingen',56,786,13,bold);text(page,'Feuerwehr Emmendingen, Abt. Wasser',48,754,9);text(page,'Datum: '+dateDE(d.date),415,754,9);text(page,'Seite '+number+' / 2',493,35,8);};
  const render=(page,blocks,start)=>{let y=start;for(const block of blocks){page.drawRectangle({x:48,y:y-16,width:499,height:18,color:rgb(.93,.93,.93)});text(page,block.title,52,y-11,9,bold);y-=20;for(const line of block.lines){text(page,line,52,y-layout.size,layout.size);y-=layout.step;}y-=7;}return y;};
  const first=pdf.addPage([595,842]),second=pdf.addPage([595,842]);header(first,1);header(second,2);let y=730;
  for(const field of layout.fieldPlan){text(first,field.title+':',48,y-layout.size,Math.min(layout.size,8),bold);for(let i=0;i<field.lines.length;i++)text(first,field.lines[i],188,y-layout.size-i*layout.step,layout.size);y-=Math.max(17,field.lines.length*layout.step+4);}
  render(first,layout.first,y);render(second,layout.second,730);text(second,'Emmendingen, '+dateDE(d.date),48,53,9);
  return new Blob([await pdf.save()],{type:'application/pdf'});
 }
 return {create,dateDE,lines,reserve};
});
