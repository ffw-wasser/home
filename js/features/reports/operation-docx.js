(function(root){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function effectiveReserveTime(d,name){
  const value=d.reserveTimes?.[name]||{},date=String(d.date||''),stamps={};
  let offset=0,previous=null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(date))for(const key of ['alarm','departed','arrived','ended']){
    const time=d.times?.[key]||'';if(!/^\d{2}:\d{2}$/.test(time))continue;
    if(previous!==null&&time<previous)offset++;
    const day=new Date(date+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+offset);
    stamps[key]=day.toISOString().slice(0,10)+'T'+time;previous=time;
  }
  return {from:value.from||stamps.arrived||'',to:value.to||stamps.ended||''};
}
const reserveTimeText=(d,name)=>{const raw=d.reserveTimes?.[name];if(!raw?.from&&!raw?.to)return '';const v=effectiveReserveTime(d,name);if(!v.from||!v.to)return '';const defaults=effectiveReserveTime({...d,reserveTimes:{}},name);if(v.from===defaults.from&&v.to===defaults.to)return '';const minutes=Math.round((Date.parse(v.to)-Date.parse(v.from))/60000);if(!Number.isFinite(minutes)||minutes<=0)return '';const date=value=>{const [day,time]=value.split('T');return deDate(day)+' '+time;};return ' · '+date(v.from)+' bis '+date(v.to)+' ('+Math.floor(minutes/60)+' Std. '+minutes%60+' Min.)';};
const deDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:String(v||'')};
const has=(a,s)=>{const needle=String(s??'').trim().toLowerCase();return(a||[]).some(v=>String(v??'').trim().toLowerCase().includes(needle));};
async function create(d,{compactCrew=false}={}){let source;if(typeof root.OPERATION_DOCX_TEMPLATE_BASE64==='string'&&root.OPERATION_DOCX_TEMPLATE_BASE64.length>1000){const raw=atob(root.OPERATION_DOCX_TEMPLATE_BASE64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);source=bytes;}else{try{const r=await fetch('assets/templates/Einsatzbericht-Wordvorlage-Kreuze-FINAL.docx?v=20261001-001');if(!r.ok)throw new Error('Wordvorlage fehlt');source=await r.arrayBuffer();}catch(error){throw new Error('Die lokale Wordvorlage konnte nicht geladen werden.');}}const zip=await JSZip.loadAsync(source),f=zip.file('word/document.xml');let x=await f.async('string');
// Keep the vehicle block compact and restore the missing template heading.
x=x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g,table=>{
  if(!table.includes('{{VEH_1}}'))return table;
  const properties=table.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0]||'';
  const grid=table.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0]||'';
  const heading='<w:tr><w:tc><w:tcPr><w:gridSpan w:val="7"/><w:shd w:fill="E7E6E6"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Eingesetzte Fahrzeuge</w:t></w:r></w:p></w:tc></w:tr>';
  const row=(key,label)=>'<w:tr><w:tc><w:p><w:r><w:t>{{'+key+'}}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:gridSpan w:val="6"/></w:tcPr><w:p><w:r><w:t>'+label+'</w:t></w:r></w:p></w:tc></w:tr>';
  return '<w:tbl>'+properties+grid+heading+row('VEH_3','EM 5/42 LF10')+row('VEH_4','EM 5/47 TSF')+'</w:tbl>';
});
// Preserve every entered method, including Sirene and freely entered details.
const alarmMethods=(Array.isArray(d.alarmMethods)?d.alarmMethods:[]).map(value=>String(value||'').trim()).filter(Boolean);
const alarmVia=words=>alarmMethods.some(value=>words.some(word=>value.toLocaleLowerCase('de').includes(word)));
if(alarmMethods.length)x=x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g,table=>{
  if(!table.includes('{{ALARM_METHOD_1}}'))return table;
  const row='<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:gridSpan w:val="6"/></w:tcPr><w:p><w:pPr><w:spacing w:after="60" w:before="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Alarmierungswege: </w:t></w:r><w:r><w:t>{{ALARM_METHOD_TEXT}}</w:t></w:r></w:p></w:tc></w:tr>';
  return table.replace('</w:tbl>',row+'</w:tbl>');
});
const detailRow=(label,value,columns)=>'<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:gridSpan w:val="'+columns+'"/></w:tcPr><w:p><w:pPr><w:spacing w:after="60" w:before="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">'+esc(label)+': </w:t></w:r><w:r><w:t>'+esc(value)+'</w:t></w:r></w:p></w:tc></w:tr>';
x=x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g,table=>{
  let rows='';
  if(table.includes('{{PIPE_C}}')){
    if(d.pipes?.description)rows+=detailRow('Schlauchmaterial',d.pipes.description,5);
    if(d.waterSources?.length)rows+=detailRow('Wasserentnahmestellen',d.waterSources.join(', '),5);
  }
  if(table.replace(/<[^>]+>/g,'').includes('bei Öleinsätzen')&&d.oil?.description)rows+=detailRow('Ölbindemittel / Betriebsstoffe',d.oil.description,5);
  return rows?table.replace('</w:tbl>',rows+'</w:tbl>'):table;
});

x=x.replace(/<w:tbl[ >][\s\S]*?<\/w:tbl>/g,table=>table.includes('Atemschutzüberwachung')?'':table);
const usedVehicles=d.stationOnly?[]:[...new Set([...(d.reportVehicles||[]),...Object.values(d.assignments||{})])];
const q=n=>Number(d.deviceAmounts?.[n]||0)||'';
const vehicleOrder=['EM 5/42 LF10','EM 5/47 TSF'],groups={fahrzeuge:{},einsatzstelle:[],gh:[]};
(d.members||[]).forEach(n=>{
  const group=String(d.assignments?.[n]||'Ohne Zuordnung'),parts=String(n||'').trim().split(','),name=parts.length>1?[parts.slice(1).join(',').trim(),parts[0].trim()].filter(Boolean).join(' '):parts[0];
  const person={name,role:d.assignmentRoles?.[n]||'',time:reserveTimeText(d,n).replace(/^ · /,'')},low=group.toLowerCase();
  if(low.includes('reserve')&&(low.includes('gh')||low.includes('gerätehaus'))){if(person.role==='Gerätehausbesetzung')person.role='';groups.gh.push(person);}
  else if(low.includes('reserve')){if(person.role==='Reserve')person.role='';groups.einsatzstelle.push(person);}
  else(groups.fahrzeuge[group]??=[]).push(person);
});
const sortNames=a=>a.sort((a,b)=>a.name.localeCompare(b.name,'de'));
Object.values(groups.fahrzeuge).forEach(sortNames);sortNames(groups.einsatzstelle);sortNames(groups.gh);
const vehicleKeys=[...vehicleOrder.filter(v=>groups.fahrzeuge[v]),...Object.keys(groups.fahrzeuge).filter(v=>!vehicleOrder.includes(v)).sort((a,b)=>a.localeCompare(b,'de'))];
const memberRows=[...vehicleKeys.map(g=>[g,groups.fahrzeuge[g]]),...(groups.einsatzstelle.length?[['Reserve an Einsatzstelle',groups.einsatzstelle]]:[]),...(groups.gh.length?[[d.stationOnly?'Gerätehausbesetzung':'Reserve im GH',groups.gh]]:[])];
const memberText=memberRows.map(([label,people])=>label+': '+people.map(p=>p.name+(p.role?' ('+p.role+')':'')+(p.time?' · '+p.time:'')).join('; ')).join('\n');
// Only the crew area changes: use two or three person columns, or four in the compact retry.
const columns=compactCrew&&(d.members||[]).length>30?4:(d.members||[]).length>18?3:2;
const width=Math.floor(10000/columns),nameSize=compactCrew?16:columns===3?16:18;
const timeSize=compactCrew?13:14;
const paragraph=(text,bold=false,size=nameSize,keepNext=false)=>'<w:p><w:pPr><w:keepLines/>'+(keepNext?'<w:keepNext/>':'')+'<w:spacing w:before="0" w:after="0" w:line="'+(size+(compactCrew?0:2))*10+'" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="'+size+'"/><w:szCs w:val="'+size+'"/>'+(bold?'<w:b/>':'')+'</w:rPr><w:t xml:space="preserve">'+esc(text)+'</w:t></w:r></w:p>';
const cell=(content,span=1,fill='FFFFFF')=>'<w:tc><w:tcPr><w:tcW w:w="'+width*span+'" w:type="dxa"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+'<w:shd w:fill="'+fill+'"/><w:vAlign w:val="top"/></w:tcPr>'+content+'</w:tc>';
const border=['top','left','bottom','right','insideH','insideV'].map(edge=>'<w:'+edge+' w:val="single" w:sz="4" w:color="D9D9D9"/>').join('');
const compactTime=value=>{
  const match=value.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}) bis (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}) \((\d+) Std\. (\d+) Min\.\)$/);
  if(!match)return value;
  const [,day,month,year,from,endDay,endMonth,endYear,to,hours,minutes]=match;
  const start=year+'-'+month+'-'+day,end=endYear+'-'+endMonth+'-'+endDay;
  const days=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);
  const duration=hours+':'+minutes.padStart(2,'0')+' h';
  if(start===d.date&&days>=0&&days<=1)return from+' - '+to+(days?' (+1 Tag)':'')+' · '+duration;
  const stamp=(day,month,year,time)=>day+'.'+month+'.'+(year===String(d.date||'').slice(0,4)?' ':year+' ')+time;
  return stamp(day,month,year,from)+' - '+stamp(endDay,endMonth,endYear,to)+' · '+duration;
};
const memberXml=memberRows.map(([label,people])=>{
  const commonTime=people.length>1&&people[0].time&&people.every(p=>p.time===people[0].time)?people[0].time:'';
  const heading='<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>'+cell(paragraph(label+' · '+people.length,true,compactCrew?16:18,true)+(commonTime?paragraph('Zeiten dieser Gruppe: '+compactTime(commonTime),false,timeSize,true):''),columns,'E7E6E6')+'</w:tr>';
  let rows='';
  for(let start=0;start<people.length;start+=columns){
    let cells='';
    for(let col=0;col<columns;col++){
      const p=people[start+col];
      const content=p?paragraph(p.name+(p.role?' ('+p.role+')':''),false)+(p.time&&!commonTime?paragraph(compactTime(p.time),false,timeSize):''):paragraph('');
      cells+=cell(content,1,Math.floor(start/columns)%2?'F5F5F5':'FFFFFF');
    }
    rows+='<w:tr><w:trPr><w:cantSplit/></w:trPr>'+cells+'</w:tr>';
  }
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders>'+border+'</w:tblBorders><w:tblCellMar><w:top w:w="'+(compactCrew?0:10)+'" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:bottom w:w="'+(compactCrew?0:10)+'" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+Array.from({length:columns},()=>'<w:gridCol w:w="'+width+'"/>').join('')+'</w:tblGrid>'+heading+rows+'</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="'+(compactCrew?10:20)+'" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>';
}).join('');
// Reclaim blank padding inside the crew area; preserve the existing page break.
// The blank line preceding the crew heading also belongs to this area.
const paragraphs=[...x.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)],crewHeading=paragraphs.findIndex(m=>m[0].replace(/<[^>]+>/g,'').includes('Mannschaftsstärke'));
if(crewHeading>0){const previous=paragraphs[crewHeading-1],heading=paragraphs[crewHeading];if(!previous[0].replace(/<[^>]+>/g,'').trim()&&!/<w:(?:br|drawing|pict)\b/.test(previous[0])&&!x.slice(previous.index+previous[0].length,heading.index).trim())x=x.slice(0,previous.index)+x.slice(previous.index+previous[0].length);}
let inCrewArea=false;
x=x.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>{
  if(p.replace(/<[^>]+>/g,'').includes('Mannschaftsstärke'))return p.replace('w:line="360"','w:line="240"').replace('</w:p>','<w:r><w:rPr><w:b/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve"> Gesamt: {{MEMBER_COUNT}}</w:t></w:r></w:p>');
  if(p.includes('{{MEMBERS}}')){inCrewArea=true;return p;}
  if(!inCrewArea)return p;
  if(/w:type="page"|<w:pageBreakBefore|Lage und Zustand/.test(p)){inCrewArea=false;return p;}
  if(!p.replace(/<[^>]+>/g,'').trim()&&!/<w:(?:br|drawing|pict)\b/.test(p))return '';
  return p.includes('{{MEMBER_COUNT}}')?'':p;
});
// Keep the narrative sections on the original second page.
x=x.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>p.includes('Lage und Zustand')&&!p.includes('<w:pageBreakBefore')?p.replace('<w:pPr>','<w:pPr><w:pageBreakBefore/>'):p);
const vals={DATE:deDate(d.date),NUMBER:d.number,TYPE:d.powerOutage&&!/stromausfall/i.test(d.type||'')?[d.type,'Stromausfall'].filter(Boolean).join(' · '):d.type,LOCATION:d.location,LEADER:d.leader,ZVD:d.zvd,AFFECTED:d.affected,ADDRESS:d.affectedAddress,VEH_1:has(usedVehicles,'EM 1/10 KDOW')?'X':'',VEH_2:has(usedVehicles,'EM 1/11 ELW 1')?'X':'',VEH_3:(has(usedVehicles,'EM 5/42 LF10')||has(usedVehicles,'EM 5/23 TLF'))?'X':'',VEH_4:has(usedVehicles,'EM 5/47 TSF')?'X':'',VEH_5:has(usedVehicles,'EM 1/46 HLF 20')?'X':'',VEH_6:has(usedVehicles,'EM 1/33 DLK 23/12')?'X':'',VEH_7:has(usedVehicles,'EM 1/44 LF 20')?'X':'',VEH_8:has(usedVehicles,'EM 1/59 GW-Hygiene')?'X':'',ALARM_METHOD_TEXT:alarmMethods.join(', '),ALARM_METHOD_1:alarmVia(['schleife','melder','pager'])?'X':'',ALARM_METHOD_2:alarmVia(['telefon'])?'X':'',ALARM_METHOD_3:alarmVia(['funk'])?'X':'',ALARM_METHOD_4:alarmVia(['münd','muend'])?'X':'',ALARM_METHOD_5:alarmVia(['selbst'])?'X':'',TIME_ALARM:d.times?.alarm,TIME_DEPARTED:d.times?.departed,TIME_ARRIVED:d.times?.arrived,TIME_ENDED:d.times?.ended,TIME_RETURNED:d.times?.returned,PIPE_C:d.pipes?.c||'',PIPE_B:d.pipes?.b||'',PIPE_MONITOR:d.pipes?.monitor||'',PIPE_SMALL:d.pipes?.smallExtinguishers||'',WATER_TANK:has(d.waterSources,'tank')?'X':'',WATER_HYDRANT:has(d.waterSources,'hydrant')?'X':'',WATER_OPEN:has(d.waterSources,'offen')?'X':'',WATER_POND:has(d.waterSources,'löschteich')?'X':'',DEVICE_WBK:q('Wärmebildkamera'),DEVICE_PA:q('Pressluftatmer'),DEVICE_SAW:q('Kettensäge'),DEVICE_JUMP:q('Sprungpolster'),DEVICE_FAN:q('Belüftungsgerät'),DEVICE_POWER:q('Stromerzeuger'),DEVICE_PUMP:q('Tauchpumpe'),DEVICE_VAC:q('Wassersauger'),DEVICE_CUTTER:q('Rettungsschere'),DEVICE_SPREADER:q('Rettungsspreizer'),DEVICE_CYL:q('Rettungszylinder'),DEVICE_DOOR:q('Türöffnungswerkzeug'),DEVICE_OTHER:d.deviceOther,MEMBERS:memberText,MEMBER_COUNT:(d.members||[]).length,SITUATION:d.situation,ACTIONS:d.actions,PERSONS:d.persons,SPECIAL:d.special,AGENCIES:'',AGENCY_1:has(d.agencies,'Polizei')?'X':'',AGENCY_2:has(d.agencies,'Streifendienst')?'X':'',AGENCY_3:has(d.agencies,'KDD')?'X':'',AGENCY_4:has(d.agencies,'Kripo')?'X':'',AGENCY_5:has(d.agencies,'Bundespolizei')?'X':'',AGENCY_6:has(d.agencies,'Rettungsdienst')?'X':'',AGENCY_7:has(d.agencies,'RTW')?'X':'',AGENCY_8:has(d.agencies,'NEF')?'X':'',AGENCY_9:has(d.agencies,'KTW')?'X':'',AGENCY_10:has(d.agencies,'RTH')?'X':'',AGENCY_11:has(d.agencies,'DRK Ortsverein')?'X':'',AGENCY_12:has(d.agencies,'KBM')?'X':'',AGENCY_13:has(d.agencies,'Stadt Emmendingen')?'X':'',AGENCY_14:has(d.agencies,'Stadtwerke')?'X':'',AGENCY_15:has(d.agencies,'Netze BW')?'X':'',AGENCY_16:has(d.agencies,'Badenova')?'X':'',AGENCY_17:has(d.agencies,'THW')?'X':'',AGENCY_18:has(d.agencies,'DLRG')?'X':'',AGENCY_19:has(d.agencies,'Abschleppdienst')?'X':'',AGENCY_20:has(d.agencies,'Straßen-/Autobahnmeisterei')?'X':'',AGENCY_21:has(d.agencies,'DB-Notfallmanager')?'X':'',AGENCY_22:has(d.agencies,'Bestatter')?'X':'',AGENCY_23:has(d.agencies,'Weitere Feuerwehren')?'X':''};for(const[k,v]of Object.entries(vals)){if(k==='MEMBERS'){x=x.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>p.includes('{{MEMBERS}}')?memberXml:p);}else{x=x.split(`{{${k}}}`).join(esc(v));}}zip.file('word/document.xml',x);return new Blob([await zip.generateAsync({type:'uint8array'})],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
root.OperationDocx={create};
})(globalThis);

