/* Synthetic, browser-local adapter for the actual member interface.
   This file is loaded ONLY by review.html. It provides no production entitlement. */
(function(g){
 'use strict';
 if(location.pathname!=='/home/review.html')throw Error('Demo ausschließlich auf der Prüfseite.');
 const publicFetch=g.fetch.bind(g);
 const apiOrigin='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev';
 const alias='d'.repeat(32),key='e'.repeat(64),token='D'.repeat(43),revision='demo-revision-1';
 const record={version:1,alias,key},session={scope:'portal',alias,revision,token,expiresAt:Date.now()+86400000,method:'password'};
 // Store only demo state in a dedicated session key; never read member storage.
 const stateKey='h2o-synthetic-review-v1',sessionStore=g.sessionStorage;
 let saved;try{saved=JSON.parse(sessionStore.getItem(stateKey)||'null');}catch{}
 const state=saved||{balance:450,credit:0,replies:{},entries:{},commands:{},deleted:false};
 function persist(){sessionStore.setItem(stateKey,JSON.stringify(state));}
 const memory=new Map();
 const storage={getItem:k=>memory.get(String(k))??null,setItem:(k,v)=>memory.set(String(k),String(v)),removeItem:k=>memory.delete(String(k)),clear:()=>memory.clear(),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}};
 Object.defineProperty(g,'localStorage',{value:storage});
 if(!state.deleted){storage.setItem('h2o-portal-identity-v1',JSON.stringify(session));storage.setItem('h2o-portal-identity-mode','1');storage.setItem('h2o_onboarding_complete','1');storage.setItem('h2o-first-options-v1:native:'+alias,'done');}
 const colors={general:'#326A9B',special:'#82559C',lesson:'#39765A',committee:'#96652E',other:'#566773',info:'#66717A',birthday:'#AF526F'};
 const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10);};
 function events(){return [['Probe · Fahrzeugkunde','probe','Probe',2,'Einsatzkleidung'],['Unterricht · Digitalfunk','lesson','Unterricht',6,'Tagesdienst'],['Sonderprobe · Wasserentnahme','special','Sonderprobe',13,'Einsatzkleidung']].map(([title,kind,sessionType,days,clothing],i)=>{const start=new Date();start.setDate(start.getDate()+days);start.setHours(19,30,0,0);const reply=state.replies[i]||{};return {id:String(i+1).repeat(43),seriesId:String(i+4).repeat(43),title:title+' (Demo)',start:+start,end:+start+7200000,location:'GH Wasser (Demo)',clothing,kind,sessionType,attendanceType:sessionType,approved:true,allDay:false,status:reply.status||'open',version:reply.version||0,description:'Erfundener Prüftermin.',note:'',displayVersion:0,calendarManaged:false,calendarLinkOnly:true,audienceRestricted:false};});}
 function list(){return {events:events(),configured:true,fetchedAt:Date.now(),stale:false,colors,colorVersion:0,rulesVersion:1,groupsVersion:1,displayFeatureVersion:1,memberName:'Alex Beispiel (Demo)',leader:true,uncertainReplies:true};}
 function evidence(){const approval={granted:state.g26===true,version:state.g26Version||0,textVersion:g.G26Consent.version,updatedAt:state.g26Updated||null,grantedAt:state.g26Updated||null};const entries={};for(const field of ['g262','g263','instruction','ffi','driver'])entries[field]=state.entries[field]||{version:0,source:'admin',status:'confirmed',checkedOn:day(-60),until:day(field==='g263'?40:250),updatedAt:Date.now()};return {consent:approval,evidence:{version:1,medical:{g262:approval.granted?entries.g262.until:'',g263:approval.granted?entries.g263.until:''},breathing:{g263:approval.granted?entries.g263.until:'',instruction:entries.instruction.until,ffi:entries.ffi.until},driver:{checkedOn:entries.driver.checkedOn,intervalMonths:12,vehicles:['LF']}},entries,eligibility:{agt:true,driver:true},syncedAt:Date.now(),servedAt:Date.now(),history:Object.entries(state.entries).map(([field,value])=>({field,...value}))};}
 const answer=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const denied=(message='In der Prüfdemo nicht verfügbar.')=>answer({error:message},403);
 const sessions=()=>({...session,...record,method:'password'});
 g.fetch=async function(input,options={}){
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
  // Only these existing public PDF files may leave the adapter; never forward credentials.
  if(url.origin===location.origin&&!url.search&&!url.hash&&/^\/home\/assets\/regulations\/fwdv-(?:003|007|010|100|002)\.pdf$/.test(url.pathname))return publicFetch(url.href,{credentials:'omit',referrerPolicy:'no-referrer',signal:options.signal});
  // All API requests terminate here. Unknown requests have no network fallback.
  if(url.origin!==apiOrigin)return denied('Externe Verbindungen sind in der Prüfdemo gesperrt.');
  let data;try{data=JSON.parse(options.body||'{}');}catch{return answer({error:'Ungültige Demo-Anfrage.'},400);}
  const path=url.pathname;
  if(path==='/portal/passkey/password/login'){if(state.deleted||data.username!=='demo'||data.password!=='demo')return denied('Demo-Anmeldung: Benutzername demo, Passwort demo.');return answer(session);}
  if(state.deleted)return answer({error:'Demo-Portal-Konto gelöscht. Mit „Demo zurücksetzen“ neu beginnen.'},401);
  if(path==='/portal/passkey/session')return answer(sessions());
  if(path==='/portal/passkey/password/confirm')return data.password==='demo'?answer(session):denied('Das Demopasswort lautet demo.');
  if(path==='/portal/passkey/account/delete'){if(data.confirm!==true)return denied();state.deleted=true;state.g26=false;state.replies={};persist();return answer({deleted:true});}
  if(path==='/portal/passkey/list')return answer({credentials:[],passkeys:[]});
  if(path==='/portal/passkey/logout'||path==='/portal/passkey/sessions/revoke')return answer({ok:true});
  if(path==='/central/snapshot'){const snapshot={version:1,balance:state.balance,credit:state.credit,needed:0,bonusCents:0,bookings:[],updatedAt:new Date().toISOString(),actions:{origin:apiOrigin,capability:token,revision,central:true},pointUnits:0,beerUnits:150,wineUnits:150};return answer({mode:'central',envelope:await g.DeckelCrypto.seal(snapshot,record)});}
  if(path==='/portal/list')return answer(list());
  if(path==='/portal/year')return answer({...list(),year:data.year,events:events().filter(e=>new Date(e.start).getFullYear()===data.year)});
  if(path==='/portal/reply'){const i=events().findIndex(e=>e.id===data.eventId);if(i<0||!['yes','excused','maybe','open'].includes(data.status))return denied();const version=(state.replies[i]?.version||0)+1;state.replies[i]={status:data.status,version};persist();return answer({ok:true,status:data.status,version});}
  if(path==='/portal/evidence/consent'){if(data.textVersion!==g.G26Consent.version||typeof data.granted!=='boolean'||data.expectedVersion!==(state.g26Version||0))return denied();state.g26=data.granted;state.g26Version=(state.g26Version||0)+1;state.g26Updated=Date.now();persist();return answer({ok:true,consent:evidence().consent});}
  if(path==='/portal/evidence')return answer(evidence());
  if(path==='/portal/evidence/report'){if(['g262','g263'].includes(data.field)&&state.g26!==true)return denied();if(!Object.hasOwn(evidence().entries,data.field)||data.responsibility!==true)return denied();const old=evidence().entries[data.field];state.entries[data.field]={version:old.version+1,source:'self',status:data.field==='driver'?'pending':'confirmed',checkedOn:data.checkedOn,until:data.validMonth?g.MemberEvidence.monthEnd(data.validMonth):g.MemberEvidence.due(data.checkedOn,12),controller:data.controller||'',updatedAt:Date.now()};persist();return answer({ok:true,receipt:data.requestId});}
  if(path==='/commands/status')return answer({status:state.commands[data.id]?'done':'missing'});
  if(path==='/commands/submit'){if(!state.commands[data.id]){const c=await g.DeckelCommands.open(data.envelope,record,data.id);if(c.kind==='drinks')state.balance+=c.entries.reduce((n,e)=>n+(e.drink==='wine'?300:150),0);else if(c.kind==='cash'){const paid=Math.min(state.balance,c.cents);state.balance-=paid;state.credit+=c.cents-paid;}else return denied();state.commands[data.id]=true;persist();}return answer({status:'done'});}
  if(path==='/portal/overview')return answer({stale:false,functionsVersion:1,members:[{name:'Alex Beispiel (Demo)',status:events().find(e=>e.id===data.eventId)?.status||'open',functions:['GF']},{name:'Chris Muster (Demo)',status:'yes',functions:['ATF']},{name:'Robin Beispiel (Demo)',status:'excused',functions:['Maschinist']}]});
  if(path==='/portal/remind')return answer({remindedAt:Date.now(),accepted:0,failed:0,remaining:0});
  if(path==='/portal/gf-breathing'&&state.g26!==true)return answer({people:[],uncertain:[{name:'Alex Beispiel (Demo)',reason:'g26-consent'}],stale:false,syncedAt:Date.now()});
  if(path==='/portal/gf-breathing')return answer({people:[{name:'Alex Beispiel (Demo)',status:'soon',items:[{label:'G26.3',status:'soon',until:day(40)},{label:'Unterweisung AGT',status:'valid',until:day(250)},{label:'FFI',status:'valid',until:day(250)}]}],uncertain:[],stale:false,syncedAt:Date.now()});
  if(path==='/portal/calendar-subscription')return denied('Die Demo legt kein echtes Kalenderabo an. Persönliche Kalender funktionieren nach der Mitgliederanmeldung.');
  if(path==='/portal/regulations')return answer({items:g.RegulationsModel.defaults().filter(i=>i.id!=='001'),version:0});
  if(path==='/portal/contacts')return answer({contacts:{sourceDate:'Prüfdemo',groups:[{id:'demo',title:'Ansprechpartner (Demo)',contacts:[{name:'Alex Beispiel (Demo)',role:'Verwaltung',email:'demo@example.invalid'}]}]}});
  if(path==='/portal/native-push')return answer({ready:false,registered:false});
  if(path==='/portal/theater/events')return answer({events:[{id:'demo-theater',title:'Theaterabend (Demo)',version:1,open:true,items:[{id:'water',name:'Mineralwasser (Demo)',cents:150,active:true,category:'Getränke',categoryColor:'#075baf'},{id:'meal',name:'Vesper (Demo)',cents:500,active:true,category:'Essen',categoryColor:'#176b36'}]}]});
  if(path==='/portal/theater/order')return answer({ok:true,id:data.requestId});
  if(path==='/portal/checkin-code')return answer({code:'FFW-CHECKIN:1:DEMO-NOT-A-MEMBER-CODE'});
  return denied();
 };
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('review-reset').onclick=()=>{sessionStore.removeItem(stateKey);location.reload();};
  // Do not let synthetic ledger amounts create real PayPal payment links.
  document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&/^(https?:|webcal:|mailto:|tel:)/.test(link.getAttribute('href')||'')&&!new URL(link.href).pathname.startsWith('/home/assets/training/')){event.preventDefault();alert('Prüfdemo: Keine Zahlung, Nachricht oder Kalenderinstallation wird ausgelöst.');}},true);
 });
})(globalThis);
