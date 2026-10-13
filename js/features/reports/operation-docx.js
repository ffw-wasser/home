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
const reserveTimeText=(d,name)=>{const raw=d.reserveTimes?.[name];if(!raw?.from&&!raw?.to)return '';const v=effectiveReserveTime(d,name);if(!v.from||!v.to)return '';const minutes=Math.round((Date.parse(v.to)-Date.parse(v.from))/60000);if(!Number.isFinite(minutes)||minutes<=0)return '';const date=value=>{const [day,time]=value.split('T');return deDate(day)+' '+time;};return ' · '+date(v.from)+' bis '+date(v.to)+' ('+Math.floor(minutes/60)+' Std. '+minutes%60+' Min.)';};
const deDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:String(v||'')};
const has=(a,s)=>{const needle=String(s??'').trim().toLowerCase();return(a||[]).some(v=>String(v??'').trim().toLowerCase().includes(needle));};
async function create(d){let source;if(typeof root.OPERATION_DOCX_TEMPLATE_BASE64==='string'&&root.OPERATION_DOCX_TEMPLATE_BASE64.length>1000){const raw=atob(root.OPERATION_DOCX_TEMPLATE_BASE64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);source=bytes;}else{try{const r=await fetch('assets/templates/Einsatzbericht-Wordvorlage-Kreuze-FINAL.docx?v=20261001-001');if(!r.ok)throw new Error('Wordvorlage fehlt');source=await r.arrayBuffer();}catch(error){throw new Error('Die lokale Wordvorlage konnte nicht geladen werden.');}}const zip=await JSZip.loadAsync(source),f=zip.file('word/document.xml');let x=await f.async('string');
// Keep the vehicle block compact and restore the missing template heading.
x=x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g,table=>{
  if(!table.includes('{{VEH_1}}'))return table;
  const properties=table.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0]||'';
  const grid=table.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0]||'';
  const heading='<w:tr><w:tc><w:tcPr><w:gridSpan w:val="7"/><w:shd w:fill="E7E6E6"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Eingesetzte Fahrzeuge</w:t></w:r></w:p></w:tc></w:tr>';
  const row=(key,label)=>'<w:tr><w:tc><w:p><w:r><w:t>{{'+key+'}}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:gridSpan w:val="6"/></w:tcPr><w:p><w:r><w:t>'+label+'</w:t></w:r></w:p></w:tc></w:tr>';
  return '<w:tbl>'+properties+grid+heading+row('VEH_3','EM 5/42 LF10')+row('VEH_4','EM 5/47 TSF')+'</w:tbl>';
});
const usedVehicles=d.stationOnly?[]:[...new Set([...(d.reportVehicles||[]),...Object.values(d.assignments||{})])];
const q=n=>Number(d.deviceAmounts?.[n]||0)||'';
const vehicleOrder=['EM 5/42 LF10','EM 5/47 TSF'],groups={fahrzeuge:{},einsatzstelle:[],gh:[]};
(d.members||[]).forEach(n=>{
  const group=String(d.assignments?.[n]||'Ohne Zuordnung'),parts=String(n||'').trim().split(','),name=parts.length>1?[parts.slice(1).join(',').trim(),parts[0].trim()].filter(Boolean).join(' '):parts[0];
  const person={name,role:d.assignmentRoles?.[n]||'',time:''},low=group.toLowerCase();
  if(low.includes('reserve')&&(low.includes('gh')||low.includes('gerätehaus'))){person.time=reserveTimeText(d,n).replace(/^ · /,'');if(d.stationOnly&&person.role==='Gerätehausbesetzung')person.role='';groups.gh.push(person);}
  else if(low.includes('reserve'))groups.einsatzstelle.push(person);
  else(groups.fahrzeuge[group]??=[]).push(person);
});
const sortNames=a=>a.sort((a,b)=>a.name.localeCompare(b.name,'de'));
Object.values(groups.fahrzeuge).forEach(sortNames);sortNames(groups.einsatzstelle);sortNames(groups.gh);
const vehicleKeys=[...vehicleOrder.filter(v=>groups.fahrzeuge[v]),...Object.keys(groups.fahrzeuge).filter(v=>!vehicleOrder.includes(v)).sort((a,b)=>a.localeCompare(b,'de'))];
const memberRows=[...vehicleKeys.map(g=>[g,groups.fahrzeuge[g]]),...(groups.einsatzstelle.length?[['Reserve an Einsatzstelle',groups.einsatzstelle]]:[]),...(groups.gh.length?[[d.stationOnly?'Gerätehausbesetzung':'Reserve im GH',groups.gh]]:[])];
const memberText=memberRows.map(([label,people])=>label+': '+people.map(p=>p.name+(p.role?' ('+p.role+')':'')+(p.time?' · '+p.time:'')).join('; ')).join('\n');
const paragraph=(text,bold=false,keepNext=false)=>'<w:p><w:pPr><w:keepLines/>'+(keepNext?'<w:keepNext/>':'')+'<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/>'+(bold?'<w:b/>':'')+'</w:rPr><w:t xml:space="preserve">'+esc(text)+'</w:t></w:r></w:p>';
const cell=(content,width,span=1,fill='FFFFFF')=>'<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+'<w:shd w:fill="'+fill+'"/><w:vAlign w:val="center"/></w:tcPr>'+content+'</w:tc>';
const memberXml=memberRows.map(([label,people])=>{
  const roles=people.some(p=>p.role),width=roles?7400:10000;
  const border=['top','left','bottom','right','insideH','insideV'].map(edge=>'<w:'+edge+' w:val="single" w:sz="4" w:color="D9D9D9"/>').join('');
  const heading='<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>'+cell(paragraph(label,true,true),10000,roles?2:1,'E7E6E6')+'</w:tr>';
  const rows=people.map((p,index)=>'<w:tr><w:trPr><w:cantSplit/></w:trPr>'+cell(paragraph(p.name,true,Boolean(p.time))+(p.time?paragraph('Individuell: '+p.time):''),width,1,index%2?'F5F5F5':'FFFFFF')+(roles?cell(paragraph(p.role),2600,1,index%2?'F5F5F5':'FFFFFF'):'')+'</w:tr>').join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders>'+border+'</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="'+width+'"/>'+(roles?'<w:gridCol w:w="2600"/>':'')+'</w:tblGrid>'+heading+rows+'</w:tbl><w:p><w:pPr><w:spacing w:after="80"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>';
}).join('');
const vals={DATE:deDate(d.date),NUMBER:d.number,TYPE:d.powerOutage&&!/stromausfall/i.test(d.type||'')?[d.type,'Stromausfall'].filter(Boolean).join(' · '):d.type,LOCATION:d.location,LEADER:d.leader,ZVD:d.zvd,AFFECTED:d.affected,ADDRESS:d.affectedAddress,VEH_1:has(usedVehicles,'EM 1/10 KDOW')?'X':'',VEH_2:has(usedVehicles,'EM 1/11 ELW 1')?'X':'',VEH_3:(has(usedVehicles,'EM 5/42 LF10')||has(usedVehicles,'EM 5/23 TLF'))?'X':'',VEH_4:has(usedVehicles,'EM 5/47 TSF')?'X':'',VEH_5:has(usedVehicles,'EM 1/46 HLF 20')?'X':'',VEH_6:has(usedVehicles,'EM 1/33 DLK 23/12')?'X':'',VEH_7:has(usedVehicles,'EM 1/44 LF 20')?'X':'',VEH_8:has(usedVehicles,'EM 1/59 GW-Hygiene')?'X':'',ALARM_METHOD_1:has(d.alarmMethods,'schleife')?'X':'',ALARM_METHOD_2:has(d.alarmMethods,'telefon')?'X':'',ALARM_METHOD_3:has(d.alarmMethods,'funk')?'X':'',ALARM_METHOD_4:has(d.alarmMethods,'münd')?'X':'',ALARM_METHOD_5:has(d.alarmMethods,'selbst')?'X':'',TIME_ALARM:d.times?.alarm,TIME_DEPARTED:d.times?.departed,TIME_ARRIVED:d.times?.arrived,TIME_ENDED:d.times?.ended,TIME_RETURNED:d.times?.returned,PIPE_C:d.pipes?.c||'',PIPE_B:d.pipes?.b||'',PIPE_MONITOR:d.pipes?.monitor||'',PIPE_SMALL:d.pipes?.smallExtinguishers||'',WATER_TANK:has(d.waterSources,'tank')?'X':'',WATER_HYDRANT:has(d.waterSources,'hydrant')?'X':'',WATER_OPEN:has(d.waterSources,'offen')?'X':'',WATER_POND:has(d.waterSources,'löschteich')?'X':'',DEVICE_WBK:q('Wärmebildkamera'),DEVICE_PA:q('Pressluftatmer'),DEVICE_SAW:q('Kettensäge'),DEVICE_JUMP:q('Sprungpolster'),DEVICE_FAN:q('Belüftungsgerät'),DEVICE_POWER:q('Stromerzeuger'),DEVICE_PUMP:q('Tauchpumpe'),DEVICE_VAC:q('Wassersauger'),DEVICE_CUTTER:q('Rettungsschere'),DEVICE_SPREADER:q('Rettungsspreizer'),DEVICE_CYL:q('Rettungszylinder'),DEVICE_DOOR:q('Türöffnungswerkzeug'),DEVICE_OTHER:d.deviceOther,MEMBERS:memberText,MEMBER_COUNT:(d.members||[]).length,SITUATION:d.situation,ACTIONS:d.actions,PERSONS:d.persons,SPECIAL:d.special,AGENCIES:'',AGENCY_1:has(d.agencies,'Polizei')?'X':'',AGENCY_2:has(d.agencies,'Streifendienst')?'X':'',AGENCY_3:has(d.agencies,'KDD')?'X':'',AGENCY_4:has(d.agencies,'Kripo')?'X':'',AGENCY_5:has(d.agencies,'Bundespolizei')?'X':'',AGENCY_6:has(d.agencies,'Rettungsdienst')?'X':'',AGENCY_7:has(d.agencies,'RTW')?'X':'',AGENCY_8:has(d.agencies,'NEF')?'X':'',AGENCY_9:has(d.agencies,'KTW')?'X':'',AGENCY_10:has(d.agencies,'RTH')?'X':'',AGENCY_11:has(d.agencies,'DRK Ortsverein')?'X':'',AGENCY_12:has(d.agencies,'KBM')?'X':'',AGENCY_13:has(d.agencies,'Stadt Emmendingen')?'X':'',AGENCY_14:has(d.agencies,'Stadtwerke')?'X':'',AGENCY_15:has(d.agencies,'Netze BW')?'X':'',AGENCY_16:has(d.agencies,'Badenova')?'X':'',AGENCY_17:has(d.agencies,'THW')?'X':'',AGENCY_18:has(d.agencies,'DLRG')?'X':'',AGENCY_19:has(d.agencies,'Abschleppdienst')?'X':'',AGENCY_20:has(d.agencies,'Straßen-/Autobahnmeisterei')?'X':'',AGENCY_21:has(d.agencies,'DB-Notfallmanager')?'X':'',AGENCY_22:has(d.agencies,'Bestatter')?'X':'',AGENCY_23:has(d.agencies,'Weitere Feuerwehren')?'X':''};for(const[k,v]of Object.entries(vals)){if(k==='MEMBERS'){x=x.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>p.includes('{{MEMBERS}}')?memberXml:p);}else{x=x.split(`{{${k}}}`).join(esc(v));}}zip.file('word/document.xml',x);return new Blob([await zip.generateAsync({type:'uint8array'})],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
root.OperationDocx={create};
})(globalThis);
