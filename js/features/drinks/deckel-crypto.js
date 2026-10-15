/* Public code, private keys: 256-bit AES-GCM, a fresh nonce for every snapshot. */
(function(global){
  'use strict';
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const bytes=value=>Uint8Array.from(value.match(/../g)||[],b=>parseInt(b,16));
  const b64=value=>btoa(String.fromCharCode(...value));
  const unb64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  function access(value){if(value?.version!==1||!/^\w{32}$/.test(value.alias)||!/^[a-f0-9]{64}$/.test(value.key)||!/^[a-f0-9]{32}$/.test(value.alias))throw new Error('Ungültiger Handyzugang.');return value;}
  function validate(data){
    if(data.actions&&(!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(data.actions.origin)||!/^[A-Za-z0-9_-]{43}$/.test(data.actions.capability)||!/^[a-zA-Z0-9-]{8,80}$/.test(data.actions.revision)))throw new Error('Ungültiger Buchungszugang.');
    if(data.undo&&!/^[-a-zA-Z0-9]{8,150}$/.test(data.undo.targetId))throw new Error('Ungültige Rücknahme.');
    if(data?.version!==1||!['balance','credit','needed','bonusCents'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0)||!Number.isFinite(Date.parse(data.updatedAt))||!Array.isArray(data.bookings)||data.bookings.length>5)throw new Error('Ungültiger Kontostand.');
    if(data.progressCents!==undefined&&(!Number.isSafeInteger(data.progressCents)||data.progressCents<0))throw new Error('Ungültiger Fortschritt.');
    if(data.pointUnits!==undefined&&!Number.isSafeInteger(data.pointUnits)||['thresholdCents','awardUnits','beerUnits','wineUnits'].some(k=>data[k]!==undefined&&(!Number.isSafeInteger(data[k])||data[k]<=0)))throw new Error('Ungültige Treuepunkte.');
    for(const b of data.bookings)if(b.pointUnits!==undefined&&(!Number.isSafeInteger(b.pointUnits)||b.pointUnits<=0||b.type!=='drinks')||b.cancelled!==undefined&&typeof b.cancelled!=='boolean'||b.drink!==undefined&&!['beer','wine'].includes(b.drink)||!['drinks','payment','bonus','correction','payment-reversal','challenge','challenge-reward','birthday-reward'].includes(b.type)||!Number.isSafeInteger(b.cents)||b.cents<=0||!Number.isFinite(Date.parse(b.createdAt))||(['drinks','correction'].includes(b.type)&&(!Number.isSafeInteger(b.count)||b.count<1))||(b.type==='payment'&&!['cash','paypal'].includes(b.method))||(b.type==='challenge'&&(!['in','out'].includes(b.direction)||!/^[A-F0-9]{8}$/.test(b.code||''))))throw new Error('Ungültige Buchung.');
    for(const b of data.bookings)if(b.type==='challenge-reward'&&(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month||'')||!Number.isSafeInteger(b.score)||b.score<5||b.score>7||b.cents>15000||b.cents%150))throw new Error('Ungültiger Monatsbonus.');
    for(const b of data.bookings)if(b.type==='birthday-reward'&&(!Number.isInteger(b.year)||b.year<2026||b.year>9999||b.cents>15000||b.cents%150))throw new Error('Ungültiger Geburtstagsbonus.');
    return data;
  }
  function create(){return {version:1,alias:hex(crypto.getRandomValues(new Uint8Array(16))),key:hex(crypto.getRandomValues(new Uint8Array(32)))};}
  async function seal(data,record){
    access(record);validate(data);const raw=encoder.encode(JSON.stringify(data));if(raw.length>4096)throw new Error('Kontostand zu groß.');
    const padded=new Uint8Array(4096).fill(32);padded.set(raw);
    const iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',bytes(record.key),'AES-GCM',false,['encrypt']);
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('deckel/v1/'+record.alias)},key,padded);
    return {version:1,iv:b64(iv),data:b64(new Uint8Array(encrypted))};
  }
  async function open(envelope,record){
    access(record);if(envelope?.version!==1||typeof envelope.iv!=='string'||typeof envelope.data!=='string'||envelope.iv.length!==16||envelope.data.length>6000)throw new Error('Ungültige Datei.');
    const iv=unb64(envelope.iv),cipher=unb64(envelope.data);if(iv.length!==12||cipher.length!==4112)throw new Error('Ungültige Datei.');
    const key=await crypto.subtle.importKey('raw',bytes(record.key),'AES-GCM',false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode('deckel/v1/'+record.alias)},key,cipher);
    return validate(JSON.parse(decoder.decode(plain)));
  }
  global.DeckelCrypto={create,access,validate,seal,open};
})(typeof window==='undefined'?globalThis:window);
