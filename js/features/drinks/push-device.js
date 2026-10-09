/* Only on the member's own phone, after explicit opt-in. Never sent to a server. */
(function(global){
 'use strict';
 function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open('ffw-deckel-reminders',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 async function access(mode,value){const database=await db();try{return await new Promise((resolve,reject)=>{const tx=database.transaction('state',mode),store=tx.objectStore('state');let req;if(mode==='readonly')req=store.get('device');else req=value===null?store.delete('device'):store.put(value,'device');let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result||null);tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}finally{database.close();}}
 function safe(value){if(!value||typeof value.url!=='string')return null;try{const u=new URL(value.url),base=new URL('deckel.html',global.location.href);if(u.origin!==base.origin||u.pathname!==base.pathname||u.search)return null;const p=new URLSearchParams(u.hash.slice(1));if(!/^[a-f0-9]{32}$/.test(p.get('a')||'')||!/^[a-f0-9]{64}$/.test(p.get('k')||''))return null;return value;}catch{return null;}}
 global.DeckelDevice={read:async()=>safe(await access('readonly')),write:value=>{if(!safe(value))throw new Error('Ungültiger persönlicher Deckel.');return access('readwrite',value);},clear:()=>access('readwrite',null)};
})(globalThis);
