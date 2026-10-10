/* The personal link is the read credential; it never leaves the URL fragment. */
(function(g){
 'use strict';const origin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
 async function load(record,signal){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('deckel-read/v1:'+record.alias+':'+record.key)),proof=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const response=await fetch(origin+'/central/snapshot',{method:'POST',headers:{Authorization:'Bearer '+proof,'Content-Type':'application/json'},body:JSON.stringify({alias:record.alias}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Der aktuelle Kontostand ist nicht erreichbar.');if(value.mode==='legacy')return null;if(value.mode!=='central'||!value.envelope)throw Error('Der Kontostand konnte nicht geprüft werden.');return value.envelope;
 }
 g.DeckelLive={load};
})(globalThis);
