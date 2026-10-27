/* No external resources, storage or network calls on the OAuth callback page. */
(function(){
 'use strict';
 const query=new URLSearchParams(location.search),state=query.get('state'),code=query.get('code'),error=query.get('error');
 history.replaceState(null,'',location.pathname);
 const status=document.getElementById('google-callback-status');
 if(location.origin!=='https://ffw-wasser.github.io'||!state||state.length>4000||(!code&&!error)){
  status.textContent='Anmeldung konnte keinem H₂O-Fenster zugeordnet werden. Bitte dieses Fenster schließen und in H₂O erneut verbinden.';return;
 }
 const value={type:'h2o-google-oauth',state,code:code?.slice(0,2048)||null,error:error?'denied':null};
 if(/^[A-Za-z0-9_-]{43}\./.test(state)&&typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('h2o-google-'+state.slice(0,43));channel.postMessage(value);setTimeout(()=>channel.close(),500);}
 else if(!window.opener){status.textContent='Bitte dieses Fenster schließen und Google in einem aktuellen Safari- oder Chrome-Browser erneut verbinden.';return;}
 window.opener?.postMessage(value,'https://ffw-wasser.github.io');
 status.textContent='Du kannst dieses Fenster schließen und zu H₂O zurückkehren.';window.close();
})();
