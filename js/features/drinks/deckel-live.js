/* The personal link is the read credential; it never leaves the URL fragment. */
(function(g){
 'use strict';const origin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
 async function load(record,signal){
  const token=g.H2OIdentity?.session()?.token;if(!token)throw Object.assign(Error('Bitte mit deinem H₂O-Passkey oder Passwort anmelden.'),{status:401});
  const response=await fetch(origin+'/central/snapshot',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({alias:record.alias}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal});
  const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Der aktuelle Kontostand ist nicht erreichbar.'),{status:response.status});if(value.mode==='legacy')throw Error('Der Kontodienst ist derzeit nicht verfügbar.');if(value.mode!=='central'||!value.envelope)throw Error('Der Kontostand konnte nicht geprüft werden.');return value.envelope;
 }
 g.DeckelLive={load};
})(globalThis);
