(function(global){"use strict";
 const HEADER=["Datum","Uhrzeit","Name","Terminart","Status","Funktion / Status","Thema"];
 function cell(value){return `"${String(value??"").replace(/"/g,'""')}"`;}
 function serialize(rows){return "\ufeff"+[HEADER.join(";"),...(rows||[]).map(row=>row.map(cell).join(";"))].join("\r\n");}
 function parse(content){const text=String(content||"").replace(/^\ufeff/,"");const result=[];let row=[],cellValue="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quoted&&next==='"'){cellValue+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===';'&&!quoted){row.push(cellValue);cellValue="";}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cellValue);if(row.some(v=>v!==""))result.push(row);row=[];cellValue="";}else cellValue+=ch;}row.push(cellValue);if(row.some(v=>v!==""))result.push(row);return result.slice(1).map(cols=>({date:cols[0]||"",time:cols[1]||"",name:cols[2]||"",sessionType:cols[3]||"",status:cols[4]||"",role:cols[5]||"",topic:cols[6]||""}));}
 const api=Object.freeze({HEADER,cell,serialize,parse});global.CsvEngine=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
