/* Private PDF view. Document bytes only live in memory for the current view. */
(function(g){
'use strict';
const $=id=>document.getElementById(id),MAX=8*1024*1024;
let generation=0,url='',busy=false,syncing=false,ipadGeneration=0,ipadUrl='';
const hex=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
function clear(){
 generation++;busy=false;
 const frame=$('hydrants-frame');if(frame){frame.removeAttribute('src');frame.hidden=true;}
 const link=$('hydrants-open');if(link){link.hidden=true;link.removeAttribute('href');}
 if(url)URL.revokeObjectURL(url);url='';
 if($('hydrants-state'))$('hydrants-state').textContent='';
 if($('hydrants-load'))$('hydrants-load').disabled=false;
}
async function load(){
 if(busy)return;clear();busy=true;const epoch=generation,status=$('hydrants-state'),button=$('hydrants-load');button.disabled=true;status.textContent='Hydrantenplan wird geschützt geladen …';
 try{
  const {plan}=await g.H2OPortal.api('hydrants/info');if(epoch!==generation)return;
  if(!plan||!Number.isInteger(plan.size)||plan.size<5||plan.size>MAX||plan.chunkSize!==196608||plan.parts!==Math.ceil(plan.size/plan.chunkSize)||!/^[a-f0-9]{64}$/.test(plan.sha256))throw Error('Die Plandaten sind ungültig.');
  const bytes=new Uint8Array(plan.size);
  for(let part=0;part<plan.parts;part++){
   const data=await g.H2OPortal.api('hydrants/part',{version:plan.version,part});if(epoch!==generation)return;
   const expected=Math.min(plan.chunkSize,plan.size-part*plan.chunkSize);
   if(typeof data.bytes!=='string'||data.bytes.length>262144)throw Error('Planabschnitt ungültig.');
   const raw=atob(data.bytes);if(raw.length!==expected)throw Error('Planabschnitt unvollständig.');
   bytes.set(Uint8Array.from(raw,c=>c.charCodeAt(0)),part*plan.chunkSize);status.textContent='Hydrantenplan wird geladen … '+Math.round((part+1)/plan.parts*100)+' %';
  }
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||hex(await crypto.subtle.digest('SHA-256',bytes))!==plan.sha256)throw Error('Der Plan konnte nicht vollständig geprüft werden. Bitte erneut laden.');
  if(epoch!==generation)return;
  url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  $('hydrants-frame').src=url+'#view=FitH';$('hydrants-frame').hidden=false;$('hydrants-open').href=url;$('hydrants-open').hidden=false;
  status.textContent='Hydrantenplan Wasser · Abgeglichen am '+new Date(plan.updatedAt).toLocaleString('de-DE');
 }catch(e){if(epoch===generation)status.textContent=g.ConnectionStatus?.message(e)||e.message;}
 finally{if(epoch===generation){busy=false;button.disabled=false;}}
}
function clearIpad(){
 ipadGeneration++;const frame=$('hydrants-ipad-frame'),link=$('hydrants-ipad-large'),dialog=$('hydrants-ipad-dialog');
 frame?.removeAttribute('src');link?.removeAttribute('href');if(ipadUrl)URL.revokeObjectURL(ipadUrl);ipadUrl='';if(dialog?.open)dialog.close();
 if($('hydrants-ipad-open'))$('hydrants-ipad-open').disabled=false;
 if($('hydrants-ipad-state'))$('hydrants-ipad-state').textContent='';
}
async function viewIpad(){
 clearIpad();const epoch=ipadGeneration,status=$('hydrants-ipad-state'),button=$('hydrants-ipad-open');button.disabled=true;status.textContent='Hydrantenplan wird aus OneDrive geladen …';
 try{
  const bytes=await g.oneDriveReadHydrants();if(epoch!==ipadGeneration)return;
  ipadUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('hydrants-ipad-frame').src=ipadUrl+'#view=FitH';$('hydrants-ipad-large').href=ipadUrl;
  $('hydrants-ipad-dialog').showModal();status.textContent='';
 }catch(e){if(epoch===ipadGeneration)status.textContent=g.ConnectionStatus?.message(e)||e.message;}
 finally{if(epoch===ipadGeneration)button.disabled=false;}
}
async function sync(){
 if(syncing)return;
 if(typeof requireAdmin==='function'&&!requireAdmin('helpView'))return;
 const status=$('hydrants-admin-state'),button=$('hydrants-sync');syncing=true;button.disabled=true;
 const assertAdmin=()=>{if(typeof adminUnlocked==='undefined'||!adminUnlocked||!g.oneDriveAdministrationReady?.())throw Error('Bitte Verwaltung entsperren und OneDrive verbinden.');};
 try{
  assertAdmin();status.textContent='PDF wird aus OneDrive geladen …';
  const bytes=await g.oneDriveReadHydrants();assertAdmin();const c=await g.DrinksCentral.connection();assertAdmin();
  if(!c)throw Error('Bitte zuerst den zentralen Kontodienst verbinden.');
  const call=(action,data={})=>{assertAdmin();return g.DrinksPush.request(c,'/admin/portal/hydrants/'+action,{source:c.source,...data});};
  const sha256=hex(await crypto.subtle.digest('SHA-256',bytes)),{plan}=await call('begin',{size:bytes.length,sha256});
  for(let part=0;part<plan.parts;part++){
   const chunk=bytes.subarray(part*plan.chunkSize,Math.min(bytes.length,(part+1)*plan.chunkSize));let raw='';for(let offset=0;offset<chunk.length;offset+=8192)raw+=String.fromCharCode(...chunk.subarray(offset,offset+8192));
   await call('chunk',{version:plan.version,part,bytes:btoa(raw)});status.textContent='Verschlüsselte Bereitstellung … '+Math.round((part+1)/plan.parts*100)+' %';
  }
  await call('publish',{version:plan.version});assertAdmin();status.textContent='Hydrantenplan ist für angemeldete Mitglieder bereitgestellt.';
 }catch(e){status.textContent=g.ConnectionStatus?.message(e)||e.message;}
 finally{syncing=false;button.disabled=false;}
}
function init(){
 $('hydrants-ipad-open')?.addEventListener('click',viewIpad);$('hydrants-ipad-close')?.addEventListener('click',clearIpad);$('hydrants-ipad-dialog')?.addEventListener('close',()=>{if(ipadUrl)clearIpad();});
 $('hydrants-load')?.addEventListener('click',load);$('hydrants-sync')?.addEventListener('click',sync);
 g.addEventListener('portal-pagechange',event=>{if(event.detail?.page==='more-hydrants')load();else clear();});
 g.addEventListener('pagehide',()=>{clear();clearIpad();});
}
g.PortalHydrantsView={clear,clearIpad};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
