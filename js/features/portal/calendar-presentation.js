/* Shared display metadata only. Never used for attendance, bonuses or audiences. */
(function(g){
 'use strict';
 const types=[['general','Allgemeine Probe','#326A9B'],['special','Sonderprobe','#82559C'],['lesson','Unterricht','#39765A'],['committee','Ausschusssitzung','#96652E'],['other','Weitere Termine','#566773'],['info','Kalenderinformation','#66717A'],['birthday','Geburtstag','#AF526F']].map(([id,label,color])=>({id,label,color}));
 const defaults=()=>Object.fromEntries(types.map(t=>[t.id,t.color]));
 function validate(colors){if(!colors||typeof colors!=='object'||Array.isArray(colors)||Object.keys(colors).length!==types.length||types.some(t=>!/^#[0-9a-f]{6}$/i.test(colors[t.id]||'')))throw Error('Bitte für jede Terminart eine gültige Farbe wählen.');return Object.fromEntries(types.map(t=>[t.id,colors[t.id].toUpperCase()]));}
 function key(e){return e.kind==='birthday'?'birthday':e.kind==='info'?'info':e.kind!=='probe'?'other':e.attendanceType==='Unterricht'?'lesson':e.attendanceType==='Ausschuss Sitzung'?'committee':e.attendanceType==='Allgemeine Probe'?'general':e.attendanceType==='Sonderprobe'?'special':e.sessionType==='Probe'?'general':'special';}
 function style(e,colors=defaults()){
  const color=colors[key(e)]||defaults()[key(e)],v=color.slice(1).match(/../g).map(s=>parseInt(s,16)),hex=values=>'#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
  return {accent:hex(v.map(n=>Math.min(n,175))),background:hex(v.map(n=>255*.9+n*.1)),text:'#18344C',label:types.find(t=>t.id===key(e)).label};
 }
 function plain(value,max=4000){
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return String(value||'').replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,'').replace(/<\s*(?:br|\/p|\/div|\/li)\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,k)=>{if(k[0]!=='#')return entities[k.toLowerCase()]||all;const n=parseInt(k.slice(k[1]?.toLowerCase()==='x'?2:1),k[1]?.toLowerCase()==='x'?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').replace(/\r\n?/g,'\n').trim().slice(0,max);
 }
 g.CalendarPresentation={types,defaults,validate,key,style,plain,isInfo:title=>/^\s*INFO\s*:/i.test(String(title||''))};
})(globalThis);
