(function(global){"use strict";
 const HEADER=["Datum","Uhrzeit","Name","Terminart","Status","Funktion / Status","Thema"];
 function cell(value){return `"${String(value??"").replace(/"/g,'""')}"`;}
 function serialize(rows){return "\ufeff"+[HEADER.join(";"),...(rows||[]).map(row=>row.map(cell).join(";"))].join("\r\n");}
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
  return result.slice(1).map(cols=>Object.fromEntries(Object.entries(columns).map(([key,i])=>[key,i<0?"":cols[i]||""])));
 }
 const api=Object.freeze({HEADER,cell,serialize,parse});global.CsvEngine=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
