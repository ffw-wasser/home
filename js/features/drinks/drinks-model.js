/* Getränkekonten: Cent-Beträge, unveränderliche Buchungen, persönliche PIN. */
(function(global){
  'use strict';
  const PRICE=150, WINE_PRICE=300, ITERATIONS=150000;
  // Fixed subpoint scale preserves old monetary bonus fractions exactly.
  // New earning thresholds are Euro payments; drink prices never determine them.
  const POINT_UNIT=150;
  const threshold=p=>p.schemaVersion===2?p.thresholdCents:p.count*PRICE;
  const award=p=>p.schemaVersion===2?p.awardUnits:p.cents;
  function pointCost(p,drink){return p?.schemaVersion===2?(drink==='wine'?p.wineUnits:p.beerUnits):POINT_UNIT;}
  const pointText=units=>(units/POINT_UNIT).toLocaleString('de-DE',{maximumFractionDigits:4});
  function rewardPolicy(p){validateRewardSettings(p);return p.schemaVersion===2?{...p}:{schemaVersion:2,id:p.id,revision:p.revision,startedAt:p.startedAt,thresholdCents:threshold(p),awardUnits:award(p),beerUnits:POINT_UNIT,wineUnits:POINT_UNIT};}
  const unitPrice=b=>b.drink==='wine'?WINE_PRICE:PRICE;
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const bytes=value=>new Uint8Array(value.match(/../g).map(x=>parseInt(x,16)));
  function empty(memberId){return {schemaVersion:1,memberId:String(memberId),pinChoiceVersion:1,pin:null,bookings:[]};}
  const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
  const day=value=>dayFormat.format(new Date(value));
  function correctionError(){return Object.assign(new Error('Dieser Eintrag kann nicht zurückgenommen werden: Er wurde bereits ganz oder teilweise bezahlt, verrechnet oder korrigiert. Bitte den aktuellen Stand prüfen.'),{code:'correctionChanged'});}
  function reduceUnpaid(s,cents,preferred=null,paid=true){
    const targets=preferred?[preferred,...Array.from(s.drinks.values()).filter(t=>t!==preferred)]:s.drinks.values();
    for(const target of targets){const used=Math.min(cents,target.unpaid);target.unpaid-=used;if(used&&paid)target.protected=true;cents-=used;if(!cents)break;}
  }
  function assertCorrectable(s,b){
    const target=s.drinks.get(b.targetId);
    if(!target||target.protected||target.unpaid!==target.count*unitPrice(target.booking)||day(target.booking.createdAt)!==day(b.createdAt))throw correctionError();
  }
  function consumeLegacy(s,units,kind){const allocations=[];for(const [id,lot] of s.legacyLots){if(!units)break;const used=Math.min(units,lot.remaining);lot.remaining-=used;lot[kind]+=used;units-=used;if(used)allocations.push({id,units:used});}return allocations;}
  function restoreLegacy(s,target,units){for(const a of target.rewardAlloc.slice().reverse()){const used=Math.min(units,a.units),lot=s.legacyLots.get(a.id);if(lot){lot.remaining+=used;lot.spent-=used;}a.units-=used;units-=used;if(!units)break;}}
  function reversePayment(s,b){
    const payment=s.payments.get(b.targetId),bonus=s.bonuses.get(b.targetId);
    if(!payment||s.reversedPayments.has(b.targetId)||b.cents!==payment.cents||Date.parse(b.createdAt)<Date.parse(payment.createdAt))throw Object.assign(new Error('Diese Zahlung wurde bereits gelöscht oder inzwischen geändert.'),{code:'adminChanged'});
    let debt;
    if(b.loyaltyVersion===2){
      if(bonus?.policy.schemaVersion===2)s.points-=bonus.cents;
      const lot=s.legacyLots.get(b.targetId);let extra=0;if(lot){s.credit-=lot.remaining;s.rewardCredit-=lot.remaining;s.points-=lot.redeemed;extra=lot.spent;lot.remaining=0;}
      const amount=payment.cents+extra,credit=Math.min(s.credit-s.rewardCredit,amount);s.credit-=credit;debt=amount-credit;s.balance+=debt;
    }else{
      if(bonus?.policy.schemaVersion===2)s.points-=bonus.cents;
      const amount=payment.cents+(bonus&&bonus.policy.schemaVersion!==2?bonus.cents:0),credit=Math.min(s.credit,amount);debt=amount-credit;s.credit-=credit;s.rewardCredit=Math.min(s.rewardCredit,s.credit);s.balance+=debt;
      const lot=s.legacyLots.get(b.targetId);if(lot)lot.remaining=0;
    }
    s.reversedPayments.add(b.targetId);
    let remaining=debt;for(const target of s.drinks.values()){if(target.booking.pointUnits)continue;const used=Math.min(remaining,target.count*unitPrice(target.booking)-target.unpaid);target.unpaid+=used;target.charged=Math.max(target.charged,target.unpaid);remaining-=used;if(!remaining)break;}
  }
  function applyEntry(s,b){
    if(b.type==='drinks'){
      const modern=b.loyaltyVersion===2,redeemed=b.pointUnits||0;
      if(redeemed){if(!modern||s.points+s.rewardCredit<redeemed)throw Object.assign(new Error('Die Treuepunkte reichen nicht mehr aus. Bitte Konto neu laden.'),{code:'pointsChanged'});const legacy=Math.min(s.rewardCredit,redeemed);consumeLegacy(s,legacy,'redeemed');s.rewardCredit-=legacy;s.credit-=legacy;s.points-=redeemed-legacy;}
      const used=redeemed?0:Math.min(modern?s.credit-s.rewardCredit:s.credit,b.cents),rewardUsed=modern?0:Math.min(s.rewardCredit,used);const rewardAlloc=consumeLegacy(s,rewardUsed,'spent');s.credit-=used;s.rewardCredit-=rewardUsed;s.balance+=redeemed?0:b.cents-used;s.count+=b.count;
      s.usages.set(b.id,used);
      s.drinks.set(b.id,{booking:b,count:b.count,charged:redeemed?0:b.cents-used,unpaid:redeemed?0:b.cents-used,protected:used>0||redeemed>0,rewardUsed,rewardAlloc,redeemed});
    }else if(b.type==='payment'){const paid=Math.min(s.balance,b.cents);s.balance-=paid;s.credit+=b.cents-paid;reduceUnpaid(s,paid);s.payments.set(b.id,b);}
    else if(b.type==='bonus'){if(b.policy.schemaVersion===2)s.points+=b.cents;else{s.credit+=b.cents;s.rewardCredit+=b.cents;s.legacyLots.set(b.paymentId,{remaining:b.cents,spent:0,redeemed:0});}s.bonuses.set(b.paymentId,b);}
    else if(b.type==='payment-reversal')reversePayment(s,b);
    else if(b.type==='correction'){
      const target=s.drinks.get(b.targetId);
      if(!target||!Number.isSafeInteger(b.count)||b.count<1||b.count>target.count||b.cents!==b.count*unitPrice(target.booking)||(b.drink||'beer')!==(target.booking.drink||'beer')||(b.confirmation!=='admin'&&day(target.booking.createdAt)!==day(b.createdAt))||Date.parse(b.createdAt)<Date.parse(target.booking.createdAt))throw correctionError();
      // Reverse the last units of this booking. Return consumed credit and any
      // amount already paid as credit; never alter payment or bonus entries.
      if(target.redeemed){const units=b.count*target.booking.pointUnits/target.booking.count;s.points+=units;target.redeemed-=units;target.count-=b.count;s.count-=b.count;return s;}
      const charged=Math.min(target.charged,b.cents),debt=Math.min(s.balance,charged);
      const rewardReturned=Math.min(target.rewardUsed,b.cents-charged);target.rewardUsed-=rewardReturned;restoreLegacy(s,target,rewardReturned);s.rewardCredit+=rewardReturned;
      s.balance-=debt;s.credit+=b.cents-debt;s.count-=b.count;
      // Preserve historical corrections. New corrections are separately restricted
      // to completely unpaid entries; old ledger files remain readable unchanged.
      const own=Math.min(target.unpaid,debt);target.unpaid-=own;reduceUnpaid(s,debt-own,null,true);
      target.count-=b.count;target.charged-=charged;
    }
    return s;
  }
  function state(){return {balance:0,count:0,credit:0,rewardCredit:0,points:0,legacyLots:new Map(),drinks:new Map(),usages:new Map(),payments:new Map(),bonuses:new Map(),reversedPayments:new Set()};}
  function validate(account,memberId){
    if(!account||![1,2,3,4,5,6,7].includes(account.schemaVersion)||account.memberId!==String(memberId)||!Array.isArray(account.bookings))throw new Error('Das Getränkekonto ist nicht lesbar. Bitte die aktuelle App-Version verwenden und den Speicher prüfen.');
    if(account.schemaVersion===7&&(!/^[-a-zA-Z0-9]{8,80}$/.test(account.resetEpoch||'')||!Number.isFinite(Date.parse(account.resetAt))))throw new Error('Der Kontoneustart ist ungültig.');
    if(account.pin!==null&&(!account.pin||account.pin.algorithm!=='PBKDF2-SHA256'||account.pin.iterations!==ITERATIONS||!/^[a-f0-9]{32}$/.test(account.pin.salt)||!/^[a-f0-9]{64}$/.test(account.pin.hash)))throw new Error('Die Getränke-PIN ist nicht lesbar.');
    const ids=new Set(),rewards=new Map(),rewardedPayments=new Set(),s=state();
    for(const b of account.bookings){
      if(account.resetAt&&Date.parse(b.createdAt)<=Date.parse(account.resetAt))throw Object.assign(new Error('Das Konto wurde zurückgesetzt. Bitte neu laden und die Eingabe erneut vornehmen.'),{code:'accessChanged'});
      if(!b||typeof b.id!=='string'||!/^[-a-zA-Z0-9]{8,150}$/.test(b.id)||ids.has(b.id)||!Number.isSafeInteger(b.cents)||b.cents<=0||!Number.isFinite(Date.parse(b.createdAt)))throw new Error('Eine Getränkebuchung ist ungültig.');
      ids.add(b.id);
      if((b.type==='correction'&&b.confirmation!==undefined||b.type==='payment-reversal')&&(account.schemaVersion<5||b.confirmation!=='admin'||typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.length>240))throw new Error('Eine Admin-Löschung ist ungültig.');
      if((b.loyaltyVersion!==undefined||b.pointUnits!==undefined||b.prepay!==undefined)&&account.schemaVersion<6)throw new Error('Die Treuepunkte-Buchung ist ungültig.');
      if(b.loyaltyVersion!==undefined&&(!['drinks','payment-reversal'].includes(b.type)||b.loyaltyVersion!==2)||b.pointUnits!==undefined&&(b.type!=='drinks'||b.loyaltyVersion!==2||!Number.isSafeInteger(b.pointUnits)||b.pointUnits<=0||b.pointUnits%b.count!==0)||b.prepay!==undefined&&(b.type!=='payment'||b.prepay!==true))throw new Error('Die Treuepunkte-Buchung ist ungültig.');
      if(b.type==='drinks'&&(b.drink===undefined||account.schemaVersion>=4&&['beer','wine'].includes(b.drink))&&Number.isSafeInteger(b.count)&&b.count>0&&b.cents===b.count*unitPrice(b)){}
      else if(b.type==='payment'&&['cash','paypal'].includes(b.method)&&(b.confirmation==='member'||(account.schemaVersion>=2&&b.method==='paypal'&&b.confirmation==='admin'))){}
      else if(b.type==='correction'&&account.schemaVersion>=3){}
      else if(b.type==='payment-reversal'&&account.schemaVersion>=5){const bonus=s.bonuses.get(b.targetId);if(bonus)rewards.set(bonus.policy.id,(rewards.get(bonus.policy.id)||0)-bonus.qualifyingCents);}
      else if(b.type==='bonus'&&account.schemaVersion>=2){
        const payment=account.bookings.find(p=>p.id===b.paymentId);
        if(!payment||payment.type!=='payment'||!ids.has(payment.id)||rewardedPayments.has(payment.id)||b.id!=='bonus-'+payment.id||b.createdAt!==payment.createdAt||!Number.isSafeInteger(b.cycles)||b.cycles<1)throw new Error('Eine Treuepunkte-Buchung ist ungültig.');
        validateRewardSettings(b.policy);
        if(b.cents!==b.cycles*award(b.policy)||b.qualifyingCents!==b.cycles*threshold(b.policy))throw new Error('Eine Treuepunkte-Buchung ist ungültig.');
        const key=b.policy.id,used=(rewards.get(key)||0)+b.qualifyingCents;
        const paid=account.bookings.filter(p=>ids.has(p.id)&&p.type==='payment'&&!s.reversedPayments.has(p.id)&&Date.parse(p.createdAt)>=Date.parse(b.policy.startedAt)).reduce((n,p)=>n+p.cents,0);
        if(used>paid)throw new Error('Eine Treuepunkte-Buchung ist nicht durch Zahlungen gedeckt.');
        rewards.set(key,used);rewardedPayments.add(payment.id);
      }
      else throw new Error('Eine Getränkebuchung ist ungültig.');
      applyEntry(s,b);
      if(!Number.isSafeInteger(s.balance)||s.balance<0||!Number.isSafeInteger(s.credit)||s.credit<0||!Number.isSafeInteger(s.count)||s.count<0||!Number.isSafeInteger(s.points)||!Number.isSafeInteger(s.rewardCredit)||s.rewardCredit<0||s.rewardCredit>s.credit)throw new Error('Der Getränkestand ist ungültig. Bitte die OneDrive-Datei prüfen.');
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
  function correctable(account,now=new Date().toISOString(),knownState=null){
    const entries=Array.from((knownState||ledger(account)).drinks.values()).filter(t=>t.count>0&&!t.protected&&t.unpaid===t.count*unitPrice(t.booking)&&day(t.booking.createdAt)===day(now));
    const target=entries.at(-1);
    return {count:entries.reduce((n,t)=>n+t.count,0),targetId:target?.booking.id||'',drink:target?.booking.drink||'beer',price:target?unitPrice(target.booking):PRICE,createdAt:target?.booking.createdAt||''};
  }
  function consumption(accounts,year){
    if(!/^\d{4}$/.test(String(year)))throw new Error('Bitte ein gültiges Kalenderjahr wählen.');
    const months=Array.from({length:12},(_,month)=>({month:month+1,beer:0,wine:0,total:0,beerCents:0,wineCents:0,totalCents:0,openCents:0})),years=new Set(),seen=new Set();let outstandingCents=0,prepaidCents=0;
    for(const account of accounts){validate(account,account.memberId);if(seen.has(account.memberId))throw new Error('Ein Getränkekonto wurde doppelt geladen.');seen.add(account.memberId);
      const state=ledger(account);outstandingCents+=state.balance;prepaidCents+=state.credit-state.rewardCredit;
      for(const entry of state.drinks.values()){
        const date=day(entry.booking.createdAt);years.add(date.slice(0,4));if(!entry.count||!date.startsWith(String(year)))continue;
        const month=months[Number(date.slice(5,7))-1];month[entry.booking.drink==='wine'?'wine':'beer']+=entry.count;month.total+=entry.count;month[entry.booking.drink==='wine'?'wineCents':'beerCents']+=entry.count*unitPrice(entry.booking);month.totalCents+=entry.count*unitPrice(entry.booking);month.openCents+=entry.unpaid;
      }
    }
    return {year:String(year),beer:months.reduce((n,m)=>n+m.beer,0),wine:months.reduce((n,m)=>n+m.wine,0),total:months.reduce((n,m)=>n+m.total,0),beerCents:months.reduce((n,m)=>n+m.beerCents,0),wineCents:months.reduce((n,m)=>n+m.wineCents,0),totalCents:months.reduce((n,m)=>n+m.totalCents,0),openCents:months.reduce((n,m)=>n+m.openCents,0),outstandingCents,prepaidCents,months,years:[...years].sort().reverse()};
  }
  function validateRewardSettings(p){
    const common=p&&[1,2].includes(p.schemaVersion)&&typeof p.id==='string'&&/^[-a-zA-Z0-9]{8,100}$/.test(p.id)&&typeof p.revision==='string'&&/^[-a-zA-Z0-9]{8,100}$/.test(p.revision)&&Number.isFinite(Date.parse(p.startedAt));
    const valid=common&&(p.schemaVersion===1?Number.isSafeInteger(p.count)&&p.count>=1&&p.count<=10000&&Number.isSafeInteger(p.cents)&&p.cents>=1&&p.cents<=100000:['thresholdCents','awardUnits','beerUnits','wineUnits'].every(k=>Number.isSafeInteger(p[k])&&p[k]>0&&p[k]<=1500000));
    if(!valid)throw new Error('Die Treuepunkte-Einstellungen sind ungültig. Bitte positive Geldbeträge und Punkte eingeben.');return p;
  }
  function rewardState(account,policy,knownState=null){
    const s=knownState||ledger(account),credit=s.credit,prepaid=s.credit-s.rewardCredit,pointUnits=s.points+s.rewardCredit;
    if(!policy)return {credit,prepaid,pointUnits,points:pointUnits/POINT_UNIT,progress:0,needed:0};validateRewardSettings(policy);
    const paid=account.bookings.filter(b=>b.type==='payment'&&!s.reversedPayments.has(b.id)&&Date.parse(b.createdAt)>=Date.parse(policy.startedAt)).reduce((n,b)=>n+b.cents,0);
    const used=account.bookings.filter(b=>b.type==='bonus'&&!s.reversedPayments.has(b.paymentId)&&b.policy.id===policy.id).reduce((n,b)=>n+b.qualifyingCents,0);
    const progress=Math.max(0,paid-used),goal=threshold(policy);
    return {credit,prepaid,pointUnits,points:pointUnits/POINT_UNIT,progress,needed:Math.max(0,goal-progress),threshold:goal,awardUnits:award(policy)};
  }
  function append(account,booking){
    validate(account,account.memberId);
    const found=account.bookings.find(b=>b.id===booking.id);
    if(found){if(JSON.stringify(found)!==JSON.stringify(booking))throw new Error('Buchungsnummer bereits anders verwendet.');return account;}
    if(booking.type==='correction'&&booking.confirmation!=='admin')assertCorrectable(ledger(account),booking);
    if(booking.type==='payment'&&!booking.prepay&&booking.cents>totals(account).balance)throw Object.assign(new Error('Der offene Betrag wurde inzwischen geändert. Bitte den Zahlungsbetrag neu wählen.'),{code:'balanceChanged'});
    return validate({...account,schemaVersion:Math.max(account.schemaVersion,booking.loyaltyVersion===2||booking.prepay?6:booking.type==='payment-reversal'||booking.type==='correction'&&booking.confirmation==='admin'?5:booking.drink?4:booking.type==='correction'?3:1),bookings:[...account.bookings,{...booking}]},account.memberId);
  }
  function appendMany(account,bookings){
    validate(account,account.memberId);
    if(!Array.isArray(bookings)||!bookings.length||bookings.length>1000||bookings.some(b=>!['drinks','correction'].includes(b?.type)||b.type==='correction'&&b.confirmation!==undefined))throw new Error('Ungültige Getränkesammlung.');
    const existing=new Map(account.bookings.map(b=>[b.id,b])),ids=new Set(),added=[],s=ledger(account);
    for(const b of bookings){
      if(ids.has(b.id))throw new Error('Doppelte Buchungsnummer in der Sammlung.');ids.add(b.id);
      const old=existing.get(b.id);if(old){if(JSON.stringify(old)!==JSON.stringify(b))throw new Error('Buchungsnummer bereits anders verwendet.');}else{if(b.type==='correction')assertCorrectable(s,b);applyEntry(s,b);added.push({...b});}
    }
    if(!added.length)return account;
    return validate({...account,schemaVersion:Math.max(2,account.schemaVersion,added.some(b=>b.loyaltyVersion===2)?6:added.some(b=>b.drink)?4:added.some(b=>b.type==='correction')?3:1),bookings:[...account.bookings,...added]},account.memberId);
  }
  function appendAdminMany(account,bookings){
    validate(account,account.memberId);
    if(!Array.isArray(bookings)||!bookings.length||bookings.length>1000||bookings.some(b=>!['correction','payment-reversal'].includes(b?.type)||b.confirmation!=='admin'))throw new Error('Ungültige Admin-Bereinigung.');
    const existing=new Map(account.bookings.map(b=>[b.id,b])),seen=new Set(),added=[],s=ledger(account);
    for(const b of bookings){if(seen.has(b.id))throw new Error('Doppelte Buchungsnummer.');seen.add(b.id);const old=existing.get(b.id);if(old){if(JSON.stringify(old)!==JSON.stringify(b))throw new Error('Buchungsnummer bereits anders verwendet.');}else{applyEntry(s,b);added.push({...b});}}
    return added.length?validate({...account,schemaVersion:Math.max(added.some(b=>b.loyaltyVersion===2)?6:5,account.schemaVersion),bookings:[...account.bookings,...added]},account.memberId):account;
  }
  function appendWithReward(account,booking,policy){
    validateRewardSettings(policy);
    // Both entries are one conditional OneDrive write; retries never grant twice.
    if(account.bookings.some(b=>b.id===booking.id))return append(account,booking);
    let next=append({...account,schemaVersion:Math.max(policy.schemaVersion===2?6:2,account.schemaVersion)},booking);
    if(booking.type!=='payment'||Date.parse(booking.createdAt)<Date.parse(policy.startedAt))return next;
    const state=rewardState(next,policy),cycles=Math.floor(state.progress/state.threshold);
    if(!cycles)return next;
    const bonus={id:'bonus-'+booking.id,type:'bonus',cents:cycles*award(policy),cycles,qualifyingCents:cycles*state.threshold,paymentId:booking.id,policy:{...policy},createdAt:booking.createdAt};
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
  global.DrinksModel={PRICE,WINE_PRICE,POINT_UNIT,pointCost,pointText,rewardPolicy,threshold,award,unitPrice,empty,validate,totals,today,correctable,consumption,day,ledger,append,appendMany,appendAdminMany,appendWithReward,rewardState,validateRewardSettings,createPin,verifyPin,parseEuro,paypalUrl};
})(typeof window==='undefined'?globalThis:window);
