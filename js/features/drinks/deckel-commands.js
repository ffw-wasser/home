/* End-to-end encrypted phone requests; a separate purpose from balance snapshots. */
(function(g){
 'use strict';const enc=new TextEncoder(),dec=new TextDecoder(),hex=/^[a-f0-9]{64}$/,idPattern=/^[a-f0-9-]{36}$/;
 const bytes=s=>Uint8Array.from(s.match(/../g),x=>parseInt(x,16)),b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 function validate(c){
  if(c?.version!==1)throw Error('Ungültiger Handyauftrag.');
  if(c.kind==='drinks'){if(!Array.isArray(c.entries)||!c.entries.length||c.entries.length>20||c.entries.some(x=>!['beer','wine'].includes(x.drink)||x.pointUnits!==undefined&&(!Number.isSafeInteger(x.pointUnits)||x.pointUnits<=0||x.pointUnits>1500000)))throw Error('Ungültige Getränkesammlung.');}
  else if(c.kind==='cash'){if(!Number.isSafeInteger(c.cents)||c.cents<1||c.cents>1000000)throw Error('Ungültige Einzahlung.');}
  else if(c.kind==='undo'){if(!/^[-a-zA-Z0-9]{8,150}$/.test(c.targetId||''))throw Error('Ungültige Rücknahme.');}
  else throw Error('Ungültiger Handyauftrag.');return c;
 }
 function check(record,id){if(!/^[a-f0-9]{32}$/.test(record?.alias||'')||!hex.test(record?.key||'')||!idPattern.test(id))throw Error('Ungültiger Buchungszugang.');}
 async function seal(c,record,id){check(record,id);validate(c);const raw=enc.encode(JSON.stringify(c));if(raw.length>4096)throw Error('Zu viele Eingaben.');const plain=new Uint8Array(4096).fill(32);plain.set(raw);const iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',bytes(record.key),'AES-GCM',false,['encrypt']);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('deckel-command/v1/'+record.alias+'/'+id)},key,plain);return {version:1,iv:b64(iv),data:b64(data)};}
 async function open(e,record,id){check(record,id);if(e?.version!==1||typeof e.iv!=='string'||e.iv.length!==16||typeof e.data!=='string'||e.data.length!==5484)throw Error('Ungültiger Handyauftrag.');const iv=un64(e.iv),data=un64(e.data);if(iv.length!==12||data.length!==4112)throw Error('Ungültiger Handyauftrag.');const key=await crypto.subtle.importKey('raw',bytes(record.key),'AES-GCM',false,['decrypt']);return validate(JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode('deckel-command/v1/'+record.alias+'/'+id)},key,data))));}
 g.DeckelCommands={validate,seal,open};
})(globalThis);
