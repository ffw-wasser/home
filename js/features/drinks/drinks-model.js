/* Getränkekonten: Cent-Beträge, unveränderliche Buchungen, persönliche PIN. */
(function(global){
  'use strict';
  const PRICE=150, WINE_PRICE=300, ITERATIONS=150000;
  const unitPrice=b=>b.drink==='wine'?WINE_PRICE:PRICE;
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const bytes=value=>new Uint8Array(value.match(/../g).map(x=>parseInt(x,16)));
  function empty(memberId){return {schemaVersion:1,memberId:String(memberId),pinChoiceVersion:1,pin:null,bookings:[]};}
  const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
  const day=value=>dayFormat.format(new Date(value));
  function correctionError(){return Object.assign(new Error('Diese heutigen Striche wurden inzwischen korrigiert. Bitte den aktuellen Stand prüfen.'),{code:'correctionChanged'});}
  function applyEntry(s,b){
    if(b.type==='drinks'){
      const used=Math.min(s.credit,b.cents);s.credit-=used;s.balance+=b.cents-used;s.count+=b.count;
      s.usages.set(b.id,used);
      s.drinks.set(b.id,{booking:b,count:b.count,charged:b.cents-used});
    }else if(b.type==='payment')s.balance-=b.cents;
    else if(b.type==='bonus')s.credit+=b.cents;
    else if(b.type==='correction'){
      const target=s.drinks.get(b.targetId);
      if(!target||!Number.isSafeInteger(b.count)||b.count<1||b.count>target.count||b.cents!==b.count*unitPrice(target.booking)||(b.drink||'beer')!==(target.booking.drink||'beer')||day(target.booking.createdAt)!==day(b.createdAt)||Date.parse(b.createdAt)<Date.parse(target.booking.createdAt))throw correctionError();
      // Reverse the last units of this booking. Return consumed credit and any
      // amount already paid as credit; never alter payment or bonus entries.
      const charged=Math.min(target.charged,b.cents),debt=Math.min(s.balance,charged);
      s.balance-=debt;s.credit+=b.cents-debt;s.count-=b.count;
      target.count-=b.count;target.charged-=charged;
    }
    return s;
  }
  function state(){return {balance:0,count:0,credit:0,drinks:new Map(),usages:new Map()};}
  function validate(account,memberId){
    if(!account||![1,2,3,4].includes(account.schemaVersion)||account.memberId!==String(memberId)||!Array.isArray(account.bookings))throw new Error('Das Getränkekonto ist nicht lesbar. Bitte die OneDrive-Datei prüfen.');
    if(account.pin!==null&&(!account.pin||account.pin.algorithm!=='PBKDF2-SHA256'||account.pin.iterations!==ITERATIONS||!/^[a-f0-9]{32}$/.test(account.pin.salt)||!/^[a-f0-9]{64}$/.test(account.pin.hash)))throw new Error('Die Getränke-PIN ist nicht lesbar.');
    const ids=new Set(),rewards=new Map(),rewardedPayments=new Set(),s=state();
    for(const b of account.bookings){
      if(!b||typeof b.id!=='string'||!/^[-a-zA-Z0-9]{8,150}$/.test(b.id)||ids.has(b.id)||!Number.isSafeInteger(b.cents)||b.cents<=0||!Number.isFinite(Date.parse(b.createdAt)))throw new Error('Eine Getränkebuchung ist ungültig.');
      ids.add(b.id);
      if(b.type==='drinks'&&(b.drink===undefined||account.schemaVersion>=4&&['beer','wine'].includes(b.drink))&&Number.isSafeInteger(b.count)&&b.count>0&&b.cents===b.count*unitPrice(b)){}
      else if(b.type==='payment'&&['cash','paypal'].includes(b.method)&&(b.confirmation==='member'||(account.schemaVersion>=2&&b.method==='paypal'&&b.confirmation==='admin'))){}
      else if(b.type==='correction'&&account.schemaVersion>=3){}
      else if(b.type==='bonus'&&account.schemaVersion>=2){
        const payment=account.bookings.find(p=>p.id===b.paymentId);
        if(!payment||payment.type!=='payment'||!ids.has(payment.id)||rewardedPayments.has(payment.id)||b.id!=='bonus-'+payment.id||b.createdAt!==payment.createdAt||!Number.isSafeInteger(b.cycles)||b.cycles<1)throw new Error('Eine Bonusbuchung ist ungültig.');
        validateRewardSettings(b.policy);
        if(b.cents!==b.cycles*b.policy.cents||b.qualifyingCents!==b.cycles*b.policy.count*PRICE)throw new Error('Eine Bonusbuchung ist ungültig.');
        const key=b.policy.id,used=(rewards.get(key)||0)+b.qualifyingCents;
        const paid=account.bookings.filter(p=>ids.has(p.id)&&p.type==='payment'&&Date.parse(p.createdAt)>=Date.parse(b.policy.startedAt)).reduce((n,p)=>n+p.cents,0);
        if(used>paid)throw new Error('Eine Bonusbuchung ist nicht durch Zahlungen gedeckt.');
        rewards.set(key,used);rewardedPayments.add(payment.id);
      }
      else throw new Error('Eine Getränkebuchung ist ungültig.');
      applyEntry(s,b);
      if(!Number.isSafeInteger(s.balance)||s.balance<0||!Number.isSafeInteger(s.credit)||s.credit<0||!Number.isSafeInteger(s.count)||s.count<0)throw new Error('Der Getränkestand ist ungültig. Bitte die OneDrive-Datei prüfen.');
    }
    return account;
  }
  function ledger(account){
    return account.bookings.reduce(applyEntry,state());
  }
  function today(account,now=new Date().toISOString()){
    const entries=Array.from(ledger(account).drinks.values()).filter(t=>t.count>0&&day(t.booking.createdAt)===day(now));
    return {count:entries.reduce((n,t)=>n+t.count,0),beerCount:entries.filter(t=>t.booking.drink!=='wine').reduce((n,t)=>n+t.count,0),wineCount:entries.filter(t=>t.booking.drink==='wine').reduce((n,t)=>n+t.count,0),targetId:entries.at(-1)?.booking.id||'',drink:entries.at(-1)?.booking.drink||'beer',price:entries.length?unitPrice(entries.at(-1).booking):PRICE};
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
    return validate({...account,schemaVersion:Math.max(account.schemaVersion,booking.drink?4:booking.type==='correction'?3:1),bookings:[...account.bookings,{...booking}]},account.memberId);
  }
  function appendMany(account,bookings){
    validate(account,account.memberId);
    if(!Array.isArray(bookings)||!bookings.length||bookings.length>1000||bookings.some(b=>b?.type!=='drinks'))throw new Error('Ungültige Getränkesammlung.');
    const existing=new Map(account.bookings.map(b=>[b.id,b])),ids=new Set(),added=[];
    for(const b of bookings){
      if(ids.has(b.id))throw new Error('Doppelte Buchungsnummer in der Sammlung.');ids.add(b.id);
      const old=existing.get(b.id);if(old){if(JSON.stringify(old)!==JSON.stringify(b))throw new Error('Buchungsnummer bereits anders verwendet.');}else added.push({...b});
    }
    if(!added.length)return account;
    return validate({...account,schemaVersion:Math.max(2,account.schemaVersion,added.some(b=>b.drink)?4:1),bookings:[...account.bookings,...added]},account.memberId);
  }
  function appendWithReward(account,booking,policy){
    validateRewardSettings(policy);
    // Both entries are one conditional OneDrive write; retries never grant twice.
    if(account.bookings.some(b=>b.id===booking.id))return append(account,booking);
    let next=append({...account,schemaVersion:Math.max(2,account.schemaVersion)},booking);
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
  global.DrinksModel={PRICE,WINE_PRICE,unitPrice,empty,validate,totals,today,day,ledger,append,appendMany,appendWithReward,rewardState,validateRewardSettings,createPin,verifyPin,parseEuro,paypalUrl};
})(typeof window==='undefined'?globalThis:window);
