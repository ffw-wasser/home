/* Google authority is per administrator/browser, memory-only and separate from H2O. */
(function(g){
 'use strict';
 let access=null,pending=null,host=null,request=null,epoch=0,config=null,connecting=false;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 function cleanup(){if(!pending)return;removeEventListener('message',pending.receive);pending.channel?.close();clearTimeout(pending.timer);clearTimeout(pending.closedTimer);clearInterval(pending.closed);pending.popup.close();pending=null;connecting=false;}
 function clear(){epoch++;access=null;cleanup();host?.remove();host=null;request=null;config=null;}
 function token(){if(!access||access.expiresAt<=Date.now()){access=null;throw Error('Bitte Google Kalender erneut verbinden.');}return access.accessToken;}
 async function api(action,data={}){if(!request)throw Error('Kalenderverwaltung bitte neu öffnen.');try{return await request('google-api/'+action,{...data,googleAccessToken:token()});}catch(error){if(error.status===401)access=null;throw error;}}
 function paint(message){if(!host)return;host.replaceChildren();const heading=node('h3','Google Kalender gemeinsam bearbeiten'),info=node('p','Jede Verwaltungsperson verbindet ihr eigenes Google-Konto. Martin bleibt Eigentümer und muss dem zweiten Konto „Änderungen an Terminen vornehmen“ erlauben. Normale Mitglieder brauchen keine Google-Anmeldung.');host.append(heading,info);
  const status=node('p',message||(access?'Google Kalender verbunden. Die Verbindung gilt bis zum Schließen oder Ablauf der Sitzung.':config?.configured?'Verbinde dein berechtigtes Google-Konto.':'Die Verwaltung muss die Google-Anbindung noch einrichten. Der bestehende Kalender funktioniert weiter.'));status.setAttribute('role','status');host.append(status);
  const connect=node('button',access?'Google-Konto wechseln':'Google Kalender verbinden');connect.type='button';connect.className='primary-button';connect.disabled=connecting||!config?.configured;connect.onclick=()=>connectGoogle(status);host.append(connect);
  if(access){const end=node('button','Google-Verbindung auf diesem Gerät beenden');end.type='button';end.className='outline-button';end.onclick=()=>{access=null;paint('Google-Verbindung auf diesem Gerät beendet. Die Freigabe in deinem Google-Konto kannst du dort separat widerrufen.');};host.append(end);}
 }
 async function connectGoogle(status){
  if(connecting)return;
  const popup=g.open('about:blank','h2o-google-oauth','width=560,height=720');if(!popup){status.textContent='Bitte das Anmeldefenster für H₂O erlauben und erneut verbinden.';return;}
  connecting=true;const version=epoch;let verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
  try{
   const challenge=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),start=await request('google-oauth/start',{challenge});if(version!==epoch){popup.close();return;}
   const target=new URL(start.authorizationUrl);if(target.origin!=='https://accounts.google.com'||target.pathname!=='/o/oauth2/v2/auth'||!start.state)throw Error('Google-Anmeldeziel nicht bestätigt.');
   const receive=async event=>{
    if(event.origin!=='https://ffw-wasser.github.io'||event.source!==popup||event.data?.type!=='h2o-google-oauth'||event.data.state!==start.state)return;
    if(!pending||pending.popup!==popup)return;const code=event.data.code,error=event.data.error;cleanup();
    try{if(error||typeof code!=='string'||!code)throw Error('Die Google-Freigabe wurde abgebrochen.');const value=await request('google-oauth/exchange',{state:start.state,code,verifier});verifier='';if(version!==epoch)return;access=value;const google=await api('status');if(version!==epoch)return;paint(['writer','owner'].includes(google.accessRole)?'Google Kalender verbunden · Bearbeitung erlaubt.':'Google Kalender verbunden · nur Leserechte. Martin muss die Bearbeitung noch erlauben.');}
    catch(e){verifier='';if(version===epoch){access=null;paint(e.message);}}
   };
   pending={popup,receive,timer:setTimeout(()=>{verifier='';cleanup();paint('Google-Anmeldung abgelaufen. Bitte erneut verbinden.');},300000),closed:setInterval(()=>{if(popup.closed){clearInterval(pending.closed);pending.closedTimer=setTimeout(()=>{if(pending?.popup!==popup)return;verifier='';cleanup();paint('Google-Anmeldefenster geschlossen. Du kannst erneut verbinden.');},1000);}},500)};
   if(typeof BroadcastChannel==='function'&&/^[A-Za-z0-9_-]{43}$/.test(start.channel||'')){pending.channel=new BroadcastChannel('h2o-google-'+start.channel);pending.channel.onmessage=event=>receive({origin:location.origin,source:popup,data:event.data});}
   addEventListener('message',receive);popup.location.href=target.href;paint('Bitte die Anmeldung und Kalenderfreigabe im Google-Fenster bestätigen.');
  }catch(e){verifier='';popup.close();connecting=false;paint(e.message);}
 }
 async function mount(send){
  request=send;const version=epoch;if(!host){host=node('section');host.id='portal-google-connection';host.className='panel';document.getElementById('portal-calendar-connection')?.append(host);}
  try{config=await send('google-oauth/configuration');if(version!==epoch)return;paint();}catch(e){if(version===epoch)paint(e.message);}
 }
 g.GoogleCalendarAdmin={mount,clear,api,connected:()=>!!access&&access.expiresAt>Date.now()};
})(globalThis);
