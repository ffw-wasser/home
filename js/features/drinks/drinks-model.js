/* Getränkekonten: Cent-Beträge, unveränderliche Buchungen, persönliche PIN. */
(function(global){
  'use strict';
  const PRICE=150, ITERATIONS=150000;
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const bytes=value=>new Uint8Array(value.match(/../g).map(x=>parseInt(x,16)));
  function empty(memberId){return {schemaVersion:1,memberId:String(memberId),pin:null,bookings:[]};}
  function validate(account,memberId){
    if(!account||account.schemaVersion!==1||account.memberId!==String(memberId)||!Array.isArray(account.bookings))throw new Error('Das Getränkekonto ist nicht lesbar. Bitte die OneDrive-Datei prüfen.');
    if(account.pin!==null&&(!account.pin||account.pin.algorithm!=='PBKDF2-SHA256'||account.pin.iterations!==ITERATIONS||!/^[a-f0-9]{32}$/.test(account.pin.salt)||!/^[a-f0-9]{64}$/.test(account.pin.hash)))throw new Error('Die Getränke-PIN ist nicht lesbar.');
    const ids=new Set();let balance=0;
    for(const b of account.bookings){
      if(!b||typeof b.id!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(b.id)||ids.has(b.id)||!Number.isSafeInteger(b.cents)||b.cents<=0||!Number.isFinite(Date.parse(b.createdAt)))throw new Error('Eine Getränkebuchung ist ungültig.');
      ids.add(b.id);
      if(b.type==='drinks'&&Number.isSafeInteger(b.count)&&b.count>0&&b.cents===b.count*PRICE)balance+=b.cents;
      else if(b.type==='payment'&&['cash','paypal'].includes(b.method)&&b.confirmation==='member')balance-=b.cents;
      else throw new Error('Eine Getränkebuchung ist ungültig.');
      if(!Number.isSafeInteger(balance)||balance<0)throw new Error('Der Getränkestand ist ungültig. Bitte die OneDrive-Datei prüfen.');
    }
    return account;
  }
  function totals(account){return account.bookings.reduce((sum,b)=>({balance:sum.balance+(b.type==='drinks'?b.cents:-b.cents),count:sum.count+(b.type==='drinks'?b.count:0)}),{balance:0,count:0});}
  function append(account,booking){
    validate(account,account.memberId);
    const found=account.bookings.find(b=>b.id===booking.id);
    if(found){if(JSON.stringify(found)!==JSON.stringify(booking))throw new Error('Buchungsnummer bereits anders verwendet.');return account;}
    if(booking.type==='payment'&&booking.cents>totals(account).balance)throw Object.assign(new Error('Der offene Betrag wurde inzwischen geändert. Bitte den Zahlungsbetrag neu wählen.'),{code:'balanceChanged'});
    return validate({...account,bookings:[...account.bookings,{...booking}]},account.memberId);
  }
  async function derive(pin,salt){
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations:ITERATIONS,hash:'SHA-256'},key,256)));
  }
  async function createPin(pin){
    if(!/^\d{4}$/.test(pin))throw new Error('Bitte eine vierstellige PIN eingeben.');
    const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    return {algorithm:'PBKDF2-SHA256',iterations:ITERATIONS,salt,hash:await derive(pin,salt)};
  }
  async function verifyPin(pin,record){
    if(!/^\d{4}$/.test(pin)||!record)return false;
    const hash=await derive(pin,record.salt);let different=0;
    for(let i=0;i<hash.length;i++)different|=hash.charCodeAt(i)^record.hash.charCodeAt(i);
    return different===0;
  }
  function parseEuro(raw){const text=String(raw||'').trim().replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(text))return null;const cents=Math.round(Number(text)*100);return Number.isSafeInteger(cents)&&cents>0?cents:null;}
  function paypalUrl(cents){if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Ungültiger Zahlungsbetrag.');return 'https://paypal.me/FeuerwehrWasser/'+(cents/100).toFixed(2)+'EUR';}
  global.DrinksModel={PRICE,empty,validate,totals,append,createPin,verifyPin,parseEuro,paypalUrl};
})(typeof window==='undefined'?globalThis:window);
