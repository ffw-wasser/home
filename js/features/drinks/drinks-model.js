/* Getränkekonten: Cent-Beträge, unveränderliche Buchungen, persönliche PIN. */
(function(global){
  'use strict';
  const PRICE=150, ITERATIONS=150000;
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const bytes=value=>new Uint8Array(value.match(/../g).map(x=>parseInt(x,16)));
  function empty(memberId){return {schemaVersion:1,memberId:String(memberId),pin:null,bookings:[]};}
  function validate(account,memberId){
    if(!account||![1,2].includes(account.schemaVersion)||account.memberId!==String(memberId)||!Array.isArray(account.bookings))throw new Error('Das Getränkekonto ist nicht lesbar. Bitte die OneDrive-Datei prüfen.');
    if(account.pin!==null&&(!account.pin||account.pin.algorithm!=='PBKDF2-SHA256'||account.pin.iterations!==ITERATIONS||!/^[a-f0-9]{32}$/.test(account.pin.salt)||!/^[a-f0-9]{64}$/.test(account.pin.hash)))throw new Error('Die Getränke-PIN ist nicht lesbar.');
    const ids=new Set(),rewards=new Map(),rewardedPayments=new Set();let balance=0,credit=0;
    for(const b of account.bookings){
      if(!b||typeof b.id!=='string'||!/^[-a-zA-Z0-9]{8,150}$/.test(b.id)||ids.has(b.id)||!Number.isSafeInteger(b.cents)||b.cents<=0||!Number.isFinite(Date.parse(b.createdAt)))throw new Error('Eine Getränkebuchung ist ungültig.');
      ids.add(b.id);
      if(b.type==='drinks'&&Number.isSafeInteger(b.count)&&b.count>0&&b.cents===b.count*PRICE){const used=Math.min(credit,b.cents);credit-=used;balance+=b.cents-used;}
      else if(b.type==='payment'&&['cash','paypal'].includes(b.method)&&b.confirmation==='member')balance-=b.cents;
      else if(b.type==='bonus'&&account.schemaVersion===2){
        const payment=account.bookings.find(p=>p.id===b.paymentId);
        if(!payment||payment.type!=='payment'||!ids.has(payment.id)||rewardedPayments.has(payment.id)||b.id!=='bonus-'+payment.id||b.createdAt!==payment.createdAt||!Number.isSafeInteger(b.cycles)||b.cycles<1)throw new Error('Eine Bonusbuchung ist ungültig.');
        validateRewardSettings(b.policy);
        if(b.cents!==b.cycles*b.policy.cents||b.qualifyingCents!==b.cycles*b.policy.count*PRICE)throw new Error('Eine Bonusbuchung ist ungültig.');
        const key=b.policy.id,used=(rewards.get(key)||0)+b.qualifyingCents;
        const paid=account.bookings.filter(p=>ids.has(p.id)&&p.type==='payment'&&Date.parse(p.createdAt)>=Date.parse(b.policy.startedAt)).reduce((n,p)=>n+p.cents,0);
        if(used>paid)throw new Error('Eine Bonusbuchung ist nicht durch Zahlungen gedeckt.');
        rewards.set(key,used);rewardedPayments.add(payment.id);credit+=b.cents;
      }
      else throw new Error('Eine Getränkebuchung ist ungültig.');
      if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(credit))throw new Error('Der Getränkestand ist ungültig. Bitte die OneDrive-Datei prüfen.');
    }
    return account;
  }
  function ledger(account){
    return account.bookings.reduce((s,b)=>{
      if(b.type==='drinks'){const used=Math.min(s.credit,b.cents);s.credit-=used;s.balance+=b.cents-used;s.count+=b.count;}
      else if(b.type==='payment')s.balance-=b.cents;
      else if(b.type==='bonus')s.credit+=b.cents;
      return s;
    },{balance:0,count:0,credit:0});
  }
  function totals(account){const {balance,count}=ledger(account);return {balance,count};}
  function validateRewardSettings(p){
    if(!p||p.schemaVersion!==1||typeof p.id!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(p.id)||typeof p.revision!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(p.revision)||!Number.isFinite(Date.parse(p.startedAt))||!Number.isSafeInteger(p.count)||p.count<1||p.count>10000||!Number.isSafeInteger(p.cents)||p.cents<1||p.cents>100000)throw new Error('Die Bonus-Einstellungen sind ungültig. Menge: 1 bis 10.000 Striche; Gutschrift: 0,01 bis 1.000 Euro.');
    return p;
  }
  function rewardState(account,policy){
    const credit=ledger(account).credit;if(!policy)return {credit,progress:0,needed:0};validateRewardSettings(policy);
    const paid=account.bookings.filter(b=>b.type==='payment'&&Date.parse(b.createdAt)>=Date.parse(policy.startedAt)).reduce((n,b)=>n+b.cents,0);
    const used=account.bookings.filter(b=>b.type==='bonus'&&b.policy.id===policy.id).reduce((n,b)=>n+b.qualifyingCents,0);
    const progress=Math.max(0,paid-used),threshold=policy.count*PRICE;
    return {credit,progress,needed:Math.max(0,threshold-progress),threshold};
  }
  function append(account,booking){
    validate(account,account.memberId);
    const found=account.bookings.find(b=>b.id===booking.id);
    if(found){if(JSON.stringify(found)!==JSON.stringify(booking))throw new Error('Buchungsnummer bereits anders verwendet.');return account;}
    if(booking.type==='payment'&&booking.cents>totals(account).balance)throw Object.assign(new Error('Der offene Betrag wurde inzwischen geändert. Bitte den Zahlungsbetrag neu wählen.'),{code:'balanceChanged'});
    return validate({...account,bookings:[...account.bookings,{...booking}]},account.memberId);
  }
  function appendWithReward(account,booking,policy){
    validateRewardSettings(policy);
    // Both entries are one conditional OneDrive write; retries never grant twice.
    if(account.bookings.some(b=>b.id===booking.id))return append(account,booking);
    let next=append({...account,schemaVersion:2},booking);
    if(booking.type!=='payment'||Date.parse(booking.createdAt)<Date.parse(policy.startedAt))return next;
    const state=rewardState(next,policy),cycles=Math.floor(state.progress/state.threshold);
    if(!cycles)return next;
    const bonus={id:'bonus-'+booking.id,type:'bonus',cents:cycles*policy.cents,cycles,qualifyingCents:cycles*state.threshold,paymentId:booking.id,policy:{...policy},createdAt:booking.createdAt};
    return validate({...next,bookings:[...next.bookings,bonus]},account.memberId);
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
  global.DrinksModel={PRICE,empty,validate,totals,append,appendWithReward,rewardState,validateRewardSettings,createPin,verifyPin,parseEuro,paypalUrl};
})(typeof window==='undefined'?globalThis:window);
