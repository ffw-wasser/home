'use strict';
const $=id=>document.getElementById(id),euro=c=>(c/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
let generation=0,lastUpdated='',hasData=false,currentAccess='',thanksTimer,currentRequest=null;
const thanked=new Set();
function hideThanks(){clearTimeout(thanksTimer);$('thanks').hidden=true;}
function showThanks(paid,alias){hideThanks();if(!paid){thanked.delete(alias);return;}if(thanked.has(alias))return;thanked.add(alias);$('thanks').hidden=false;thanksTimer=setTimeout(hideThanks,3000);}
function credentials(){const params=new URLSearchParams(location.hash.slice(1)),repo=params.get('r'),record={version:1,alias:params.get('a'),key:params.get('k')};if(!/^ffw-wasser\/[A-Za-z0-9_.-]+$/.test(repo)||repo==='ffw-wasser/home')throw new Error('Bitte deinen persönlichen QR-Code am Gerätehaus-iPad scannen.');DeckelCrypto.access(record);return {repo,record};}
function clear(){hideThanks();$('account').hidden=true;for(const id of ['balance','credit','bonus','updated'])$(id).textContent='';$('bookings').replaceChildren();$('paypal').removeAttribute('href');hasData=false;}
function loadError(error){if(error.name==='OperationError')return 'Dieser Zugang kann den aktuellen Deckel nicht öffnen. Bitte deinen QR-Code am Gerätehaus-iPad erneut scannen.';if(error.name==='AbortError')return 'Die Verbindung dauert zu lange. Bitte erneut aktualisieren.';if(error.name==='TypeError')return 'Keine Internetverbindung zum Deckel. Bitte Verbindung prüfen und erneut aktualisieren.';return error.message||'Keine Verbindung. Bitte erneut versuchen.';}
async function load(){
 const number=++generation;currentRequest?.abort();$('refresh').disabled=true;hideThanks();$('status').textContent=hasData?'Aktueller Stand wird geprüft …':'Dein Deckel wird geladen …';
 try{
  await globalThis.DeckelPush?.restore();globalThis.DeckelInstall?.refresh();const {repo,record}=credentials(),access=repo+':'+record.alias+':'+record.key;
  if(access!==currentAccess){clear();lastUpdated='';currentAccess=access;}
  const controller=new AbortController();currentRequest=controller;const timer=setTimeout(()=>controller.abort(),20000);let response,text;
  try{response=await fetch('https://raw.githubusercontent.com/'+repo+'/main/deckel/'+record.alias+'.json?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});if(response.ok)text=await response.text();}finally{clearTimeout(timer);if(currentRequest===controller)currentRequest=null;}
  if(!response.ok)throw new Error('Dein Deckel ist noch nicht verfügbar. Bitte am Gerätehaus-iPad aktualisieren.');
  if(text.length>8000)throw new Error('Die Deckel-Datei konnte nicht geprüft werden. Bitte erneut aktualisieren.');const data=await DeckelCrypto.open(JSON.parse(text),record);if(number!==generation||document.hidden)return;
  $('coaster').classList.toggle('is-paid',data.balance===0);$('balance').textContent=euro(data.balance);$('balanceLabel').textContent=data.balance===0?'Alles bezahlt':'Deine Schulden';showThanks(data.balance===0,record.alias);
  $('credit').hidden=data.credit===0;$('credit').textContent='Getränkegutschrift: '+euro(data.credit)+' · Für deine nächsten Getränke.';
  $('bonus').textContent=data.needed?'Noch '+euro(data.needed)+' bezahlen bis zu '+euro(data.bonusCents)+' Treuebonus.':'Bonusziel erreicht. Die nächste bestätigte Zahlung löst die Gutschrift aus.';
  $('paypal').hidden=data.balance<=0;$('payment-note').hidden=data.balance<=0;if(data.balance>0)$('paypal').href='https://paypal.me/FeuerwehrWasser/'+(data.balance/100).toFixed(2)+'EUR';
  $('bookings').replaceChildren();for(const b of data.bookings){const li=document.createElement('li'),drink=b.count+(b.drink==='wine'?(b.count===1?' Glas Wein':' Gläser Wein'):' Bier');li.textContent=(b.type==='drinks'?drink:b.type==='correction'?'Rücknahme: '+drink:b.type==='payment-reversal'?'Admin: Zahlung gelöscht':b.type==='bonus'?'Treuebonus · Gutschrift':b.method==='cash'?'Barzahlung bestätigt':'PayPal verbucht')+' · '+euro(b.cents)+(b.cancelled?' · gelöscht':'');const date=document.createElement('small');date.textContent=new Date(b.createdAt).toLocaleString('de-DE');li.append(date);$('bookings').append(li);}if(!data.bookings.length){const li=document.createElement('li');li.textContent='Noch keine Buchungen.';$('bookings').append(li);}
  $('updated').textContent='Übertragen vom Gerätehaus: '+new Date(data.updatedAt).toLocaleString('de-DE');$('account').hidden=false;hasData=true;$('status').textContent=lastUpdated===data.updatedAt?'Du siehst den zuletzt übertragenen Stand.':lastUpdated?'Dein Deckel wurde aktualisiert.':'';lastUpdated=data.updatedAt;globalThis.DeckelPush?.markRead();
 }catch(error){if(number!==generation||document.hidden)return;if(!hasData)clear();$('status').textContent=loadError(error)+(hasData?' Angezeigt bleibt der Stand vom '+new Date(lastUpdated).toLocaleString('de-DE')+'.':'');}
 finally{if(number===generation)$('refresh').disabled=false;}
}
$('refresh').onclick=load;
globalThis.addEventListener('hashchange',()=>{generation++;currentRequest?.abort();currentAccess='';lastUpdated='';clear();load();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;currentRequest?.abort();clear();$('refresh').disabled=false;}else load();});
globalThis.addEventListener('pageshow',event=>{if(event.persisted)load();});load();
