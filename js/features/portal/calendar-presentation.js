/* Shared display metadata and public response links. No personal access credentials. */
(function(g){
 'use strict';
 const types=[['general','Allgemeine Probe','#326A9B'],['special','Sonderprobe','#82559C'],['lesson','Unterricht','#39765A'],['committee','Ausschusssitzung','#96652E'],['other','Weitere Termine','#566773'],['info','Kalenderinformation','#66717A'],['birthday','Geburtstag','#AF526F']].map(([id,label,color])=>({id,label,color}));
 const defaults=()=>Object.fromEntries(types.map(t=>[t.id,t.color]));
 function validate(colors){if(!colors||typeof colors!=='object'||Array.isArray(colors)||Object.keys(colors).length!==types.length||types.some(t=>!/^#[0-9a-f]{6}$/i.test(colors[t.id]||'')))throw Error('Bitte für jede Terminart eine gültige Farbe wählen.');return Object.fromEntries(types.map(t=>[t.id,colors[t.id].toUpperCase()]));}
 function key(e){return e.kind==='birthday'?'birthday':e.kind==='info'?'info':e.kind!=='probe'||e.attendanceType==='Fitness'?'other':e.attendanceType==='Unterricht'?'lesson':e.attendanceType==='Ausschuss Sitzung'?'committee':e.attendanceType==='Allgemeine Probe'?'general':e.attendanceType==='Sonderprobe'?'special':e.sessionType==='Probe'?'general':'special';}
 function style(e,colors=defaults()){
  const color=/^#[0-9a-f]{6}$/i.test(e.googleColor||'')?e.googleColor:colors[key(e)]||defaults()[key(e)],v=color.slice(1).match(/../g).map(s=>parseInt(s,16)),hex=values=>'#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
  return {accent:e.googleColor?color.toUpperCase():hex(v.map(n=>Math.min(n,175))),background:hex(v.map(n=>255*.9+n*.1)),text:'#18344C',label:e.attendanceType==='Fitness'?'Fitness':types.find(t=>t.id===key(e)).label};
 }
 function plain(value,max=4000){
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return String(value||'').replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,'').replace(/<\s*(?:br|\/p|\/div|\/li)\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,k)=>{if(k[0]!=='#')return entities[k.toLowerCase()]||all;const n=parseInt(k.slice(k[1]?.toLowerCase()==='x'?2:1),k[1]?.toLowerCase()==='x'?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').replace(/\r\n?/g,'\n').trim().slice(0,max);
 }
 // Optional, explicit Google description controls. Never infer control values from prose.
 function instructions(value){
  const fields={},issues=[],note=[];
  for(const line of plain(value).split('\n')){
   const match=/^\s*(Terminart|Gruppen?|Kleidung|Freigabe)\s*:\s*(.*?)\s*$/i.exec(line);
   if(!match){note.push(line);continue;}
   const key=/^gruppe/i.test(match[1])?'group':({terminart:'type',kleidung:'clothing',freigabe:'release'})[match[1].toLocaleLowerCase('de')];
   if(Object.hasOwn(fields,key))issues.push('Die Angabe '+match[1]+' ist mehrfach vorhanden.');
   fields[key]=match[2];if(!match[2])issues.push('Die Angabe '+match[1]+' ist leer.');
  }
  const names={'fitness':'Fitness','probe':'Allgemeine Probe','allgemeine probe':'Allgemeine Probe','sonderprobe':'Sonderprobe','unterricht':'Unterricht','ausschusssitzung':'Ausschuss Sitzung','ausschuss sitzung':'Ausschuss Sitzung','veranstaltung':'other','weitere termine':'other','sonstiges':'other','information':'info','info':'info'};
  if(fields.type!==undefined){const type=names[fields.type.toLocaleLowerCase('de')];if(!type)issues.push('Unbekannte Terminart: '+fields.type);fields.type=type||null;}
  if(fields.clothing?.length>120)issues.push('Kleidung darf höchstens 120 Zeichen enthalten.');
  if(fields.release!==undefined){const word=fields.release.toLocaleLowerCase('de');if(!['ja','nein'].includes(word))issues.push('Freigabe muss Ja oder Nein sein.');fields.release=word==='ja';}
  return {fields,issues,note:note.join('\n').trim()};
 }
 function responseLink(id){if(!/^[A-Za-z0-9_-]{43}$/.test(id||''))throw Error('Ungültiger Kalendertermin.');return 'https://ffw-wasser.github.io/home/termin.html?event='+id;}
 function withResponseLink(description,id){
  const url=responseLink(id),text=String(description||'');
  if(text.split(url).slice(1).some(rest=>!rest||/^[\s<>"']/.test(rest)))return text;
  // Prefix only. Google notes, HTML and add-on suffix markers stay byte-for-byte intact.
  const next=(/<[^>]+>/.test(text)?'<p>H₂O-Rückmeldung: <a href="'+url+'">Zu- oder absagen in H₂O</a></p>':'H₂O-Rückmeldung: '+url+'\n\n')+text;
  if(next.length>4000)throw Error('Die Google-Beschreibung ist für den zusätzlichen Rückmeldelink zu lang. Bitte dort zuerst Platz schaffen.');
  return next;
 }
 function reminderResult(result){
  let text=result.accepted+' Handy-Mitteilungen angenommen · '+result.failed+' fehlgeschlagen'+(result.remaining?' · Versand bitte fortsetzen.':'.');
  const labels={ios:'iPhone-App',android:'Android-App',web:'Web-App'},reasons={NotConfigured:'Mitteilungsdienst nicht eingerichtet',AuthorizationFailed:'Anmeldung beim Push-Dienst fehlgeschlagen',TimeoutError:'Zeitüberschreitung',AbortError:'Zeitüberschreitung',unknown:'Unbekannter Verbindungsfehler'};
  for(const failure of Array.isArray(result.failures)?result.failures:[]){
   if(!labels[failure.transport]||!Number.isSafeInteger(failure.count)||failure.count<1)continue;
   const code=failure.reason||failure.error,detail=[Number.isInteger(failure.httpStatus)?'HTTP '+failure.httpStatus:'',code?(reasons[code]||code):''].filter(Boolean).join(' · ');
   text+=' '+labels[failure.transport]+': '+(detail||'Versand fehlgeschlagen')+' ('+failure.count+' '+(failure.count===1?'Gerät':'Geräte')+').';
  }
  return text;
 }
 g.CalendarPresentation={reminderResult,responseLink,withResponseLink,types,defaults,validate,key,style,plain,instructions,isInfo:title=>/^\s*INFO\s*:/i.test(String(title||''))};
})(globalThis);
