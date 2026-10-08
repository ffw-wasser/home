(function(global){"use strict";
 const HEADER=["Datum","Uhrzeit","Name","Terminart","Status","Funktion / Status","Thema"];
 function cell(value){return `"${String(value??"").replace(/"/g,'""')}"`;}
 function serialize(rows){return "\ufeff"+[HEADER.join(";"),...(rows||[]).map(row=>row.map(cell).join(";"))].join("\r\n");}
 function normalizeDate(value){
  const raw=String(value||"").trim();
  let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/),parts;
  if(match)parts=[Number(match[1]),Number(match[2]),Number(match[3])];
  else{match=raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:$|\s)/);if(match)parts=[Number(match[3]),Number(match[2]),Number(match[1])];}
  if(!parts)return "";
  const [year,month,day]=parts,date=new Date(0);date.setUTCFullYear(year,month-1,day);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return "";
  return `${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
 }
 function parse(content){
  const text=String(content||"").replace(/^\ufeff/,"");
  const result=[];let row=[],cellValue="",quoted=false;
  for(let i=0;i<text.length;i++){
   const ch=text[i],next=text[i+1];
   if(ch==='"'&&quoted&&next==='"'){cellValue+='"';i++;}
   else if(ch==='"')quoted=!quoted;
   else if(ch===';'&&!quoted){row.push(cellValue);cellValue="";}
   else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cellValue);if(row.some(v=>v!==""))result.push(row);row=[];cellValue="";}
   else cellValue+=ch;
  }
  row.push(cellValue);if(row.some(v=>v!==""))result.push(row);
  // Sonderprobe, Unterricht und Ausschusssitzung haben keine Funktionsspalte.
  // Spalten anhand der Überschrift lesen, damit auch bestehende ZIPs stimmen.
  const headers=(result[0]||[]).map(value=>value.trim().toLocaleLowerCase("de-DE"));
  const index=(...names)=>headers.findIndex(header=>names.some(name=>header===name.toLocaleLowerCase("de-DE")));
  const columns={date:index("Datum"),time:index("Uhrzeit"),name:index("Name"),sessionType:index("Terminart"),status:index("Status"),role:index("Funktion / Status","Funktion/Status","Funktion"),topic:index("Thema")};
  return result.slice(1).map(cols=>{
   const row=Object.fromEntries(Object.entries(columns).map(([key,i])=>[key,i<0?"":cols[i]||""]));
   for(const key of ["date","time","name","sessionType","status","role"])row[key]=String(row[key]).trim();
   row.date=normalizeDate(row.date)||row.date;
   const status=["Anwesend","Entschuldigt","Fehlt","Betrifft nicht"].find(value=>value.toLocaleLowerCase("de-DE")===row.status.replace(/\s+/g," ").toLocaleLowerCase("de-DE"));
   if(status)row.status=status;
   return row;
  });
 }
 const api=Object.freeze({HEADER,cell,serialize,parse,normalizeDate});global.CsvEngine=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
