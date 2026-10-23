/* Optional Google-owned, read-only colour bridge. Never affects audiences or approval. */
(function(g){
 'use strict';
 const cache=new WeakMap(),pending=new WeakMap(),hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 function validate(endpoint,secret){
  if(typeof endpoint!=='string'||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/.test(endpoint))throw Error('Bitte die bereitgestellte Google-Apps-Script-Web-App-Adresse eingeben.');
  if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(secret))throw Error('Bitte einen Zugangsschlüssel mit 32 bis 128 Zeichen eingeben.');
  return {endpoint,secret};
 }
 async function series(url,uid){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('h2o-series/v1:'+url+':'+uid));return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
 const day=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const eventKey=e=>e.seriesId+'|'+(e.allDay?'d'+day(e.start):'t'+e.start);
 async function read(env,config,events,ctx){
  if(!config?.googleColorBridge)return {status:'not-configured',colors:new Map()};
  let bridge;try{bridge=validate(config.googleColorBridge.endpoint,config.googleColorBridge.secret);}catch{return {status:'fallback',colors:new Map()};}
  const key=config.calendarUrl+'|'+bridge.endpoint+'|'+bridge.secret;
  if(!events.length)return {status:'configured',colors:new Map()};
  const from=Math.min(...events.map(e=>e.start))-86400000,to=Math.max(...events.map(e=>e.end))+86400000,old=cache.get(env.DB),now=Date.now();
  if(old?.key===key&&old.from<=from&&old.to>=to&&now-old.at<(old.status==='current'?300000:60000))return old;
  if(ctx?.waitUntil){
   // Optional colours must not delay personal appointments, even on a cold worker.
   ctx.waitUntil(read(env,config,events).catch(()=>{}));
   return old?.key===key&&old.from<=from&&old.to>=to?old:{status:'fallback',colors:new Map()};
  }
  if(pending.has(env.DB)){await pending.get(env.DB);return read(env,config,events);}
  const load=(async()=>{
   try{
    if(to-from>740*86400000)throw Error('Zeitraum zu groß.');
    const calendarId=decodeURIComponent(new URL(config.calendarUrl).pathname.split('/')[3]);
    const response=await fetch(bridge.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:bridge.secret,calendarId,from:new Date(from).toISOString(),to:new Date(to).toISOString()}),signal:AbortSignal.timeout(15000),redirect:'follow'});
    if(!response.ok||response.url&&!['script.google.com','script.googleusercontent.com'].includes(new URL(response.url).hostname))throw Error('Google-Farbabruf fehlgeschlagen.');
    const raw=await response.text();if(raw.length>2000000)throw Error('Google-Antwort zu groß.');const data=JSON.parse(raw);
    if(data.version!==1||data.calendarId!==calendarId||!Array.isArray(data.events)||data.events.length>5000)throw Error('Google-Farbantwort ungültig.');
    const colors=new Map(),ids=new Map();
    for(const item of data.events){
     if(typeof item.uid!=='string'||!item.uid||item.uid.length>500||!hex(item.color))throw Error('Google-Terminfarbe ungültig.');
     if(!ids.has(item.uid))ids.set(item.uid,await series(config.calendarUrl,item.uid));
     const when=typeof item.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.day)?'d'+item.day:Number.isFinite(item.start)?'t'+item.start:null;
     if(!when)throw Error('Google-Farbdatum ungültig.');
     colors.set(ids.get(item.uid)+'|'+when,{color:item.color.toUpperCase()});
    }
    const result={key,from,to,at:now,status:'current',colors};cache.set(env.DB,result);return result;
   }catch{
    // A failed colour service must never prevent calendar, approval or attendance access.
    const result={key,from,to,at:now,status:'fallback',colors:new Map()};cache.set(env.DB,result);return result;
   }
  })();pending.set(env.DB,load);try{return await load;}finally{pending.delete(env.DB);}
 }
 g.GoogleCalendarColors={read,validate,eventKey};
})(globalThis);
