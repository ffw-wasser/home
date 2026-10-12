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
  function reduceUnpaid(s,cents,preferred=null,paid=true,challenge=false){
    const targets=preferred?[preferred,...Array.from(s.drinks.values()).filter(t=>t!==preferred)]:s.drinks.values();
    for(const target of targets){const used=Math.min(cents,target.unpaid);target.unpaid-=used;if(used&&paid)target.protected=true;if(used&&challenge)target.challengeProtected=true;cents-=used;if(!cents)break;}
    return cents;
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
    let remaining=debt;for(const target of s.drinks.values()){if(target.booking.pointUnits)continue;const used=Math.min(remaining,target.count*unitPrice(target.booking)-target.unpaid);target.unpaid+=used;target.charged=Math.max(target.charged,target.unpaid);remaining-=used;if(!remaining)break;}s.challengeDebt+=remaining;
  }
  function applyEntry(s,b){
    if(b.type==='drinks'){
      const modern=b.loyaltyVersion===2,redeemed=b.pointUnits||0;
      if(redeemed){if(!modern||s.points+s.rewardCredit<redeemed)throw Object.assign(new Error('Die Treuepunkte reichen nicht mehr aus. Bitte Konto neu laden.'),{code:'pointsChanged'});const legacy=Math.min(s.rewardCredit,redeemed);consumeLegacy(s,legacy,'redeemed');s.rewardCredit-=legacy;s.credit-=legacy;s.points-=redeemed-legacy;}
      const used=redeemed?0:Math.min(modern?s.credit-s.rewardCredit:s.credit,b.cents),rewardUsed=modern?0:Math.min(s.rewardCredit,used);const rewardAlloc=consumeLegacy(s,rewardUsed,'spent');s.credit-=used;s.rewardCredit-=rewardUsed;s.balance+=redeemed?0:b.cents-used;s.count+=b.count;
      s.usages.set(b.id,used);
      s.drinks.set(b.id,{booking:b,count:b.count,charged:redeemed?0:b.cents-used,unpaid:redeemed?0:b.cents-used,protected:used>0||redeemed>0,rewardUsed,rewardAlloc,redeemed});
    }else if(b.type==='payment'){const paid=Math.min(s.balance,b.cents);s.balance-=paid;s.credit+=b.cents-paid;const remaining=reduceUnpaid(s,paid);s.challengeDebt=Math.max(0,s.challengeDebt-remaining);s.payments.set(b.id,b);}
    else if(b.type==='challenge'){
      if(b.direction==='in'){s.balance+=b.cents;s.challengeDebt+=b.cents;}
      else{if(b.cents>s.balance)throw Error('Challenge-Gewinn übersteigt die Schulden.');s.balance-=b.cents;const used=Math.min(s.challengeDebt,b.cents);s.challengeDebt-=used;reduceUnpaid(s,b.cents-used,null,true,true);}
    }
    else if(b.type==='bonus'){if(b.policy.schemaVersion===2)s.points+=b.cents;else{s.credit+=b.cents;s.rewardCredit+=b.cents;s.legacyLots.set(b.paymentId,{remaining:b.cents,spent:0,redeemed:0});}s.bonuses.set(b.paymentId,b);}
    else if(b.type==='payment-reversal')reversePayment(s,b);
    else if(b.type==='correction'){
      const target=s.drinks.get(b.targetId);
      if(target?.challengeProtected)throw Object.assign(Error('Dieser Getränke-Eintrag wurde mit einer gemeinsamen Challenge verrechnet und kann nicht einzeln gelöscht werden.'),{code:'challengeLinked'});
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
  function state(){return {balance:0,count:0,credit:0,rewardCredit:0,points:0,challengeDebt:0,legacyLots:new Map(),drinks:new Map(),usages:new Map(),payments:new Map(),bonuses:new Map(),reversedPayments:new Set()};}
  function validate(account,memberId){
    if(!account||![1,2,3,4,5,6,7,8].includes(account.schemaVersion)||account.memberId!==String(memberId)||!Array.isArray(account.bookings))throw new Error('Das Getränkekonto ist nicht lesbar. Bitte die aktuelle App-Version verwenden und den Speicher prüfen.');
    if((account.schemaVersion===7||account.resetEpoch!==undefined||account.resetAt!==undefined)&&(!/^[-a-zA-Z0-9]{8,80}$/.test(account.resetEpoch||'')||!Number.isFinite(Date.parse(account.resetAt))))throw new Error('Der Kontoneustart ist ungültig.');
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
      else if(b.type==='challenge'&&account.schemaVersion>=8&&b.confirmation==='challenge'&&['in','out'].includes(b.direction)&&/^[a-f0-9-]{36}$/.test(b.gameId||'')&&b.id==='challenge-'+b.gameId&&/^[A-F0-9]{8}$/.test(b.code||'')&&Number.isSafeInteger(b.score)&&b.score>=0&&b.score<=7){}
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
    if(booking.type==='challenge')throw Error('Challenge-Buchungen entstehen ausschließlich im Spieldienst.');
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
  function appendChallenge(account,booking){
    validate(account,account.memberId);if(booking.type!=='challenge')throw Error('Ungültige Challenge-Buchung.');const old=account.bookings.find(b=>b.id===booking.id);
    if(old){if(JSON.stringify(old)!==JSON.stringify(booking))throw Error('Challenge bereits anders gebucht.');return account;}
    return validate({...account,schemaVersion:8,bookings:[...account.bookings,{...booking}]},account.memberId);
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
  global.DrinksModel={PRICE,WINE_PRICE,POINT_UNIT,pointCost,pointText,rewardPolicy,threshold,award,unitPrice,empty,validate,totals,today,correctable,consumption,day,ledger,append,appendMany,appendAdminMany,appendChallenge,appendWithReward,rewardState,validateRewardSettings,createPin,verifyPin,parseEuro,paypalUrl};
})(typeof window==='undefined'?globalThis:window);

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
    for(const b of data.bookings)if(b.pointUnits!==undefined&&(!Number.isSafeInteger(b.pointUnits)||b.pointUnits<=0||b.type!=='drinks')||b.cancelled!==undefined&&typeof b.cancelled!=='boolean'||b.drink!==undefined&&!['beer','wine'].includes(b.drink)||!['drinks','payment','bonus','correction','payment-reversal','challenge'].includes(b.type)||!Number.isSafeInteger(b.cents)||b.cents<=0||!Number.isFinite(Date.parse(b.createdAt))||(['drinks','correction'].includes(b.type)&&(!Number.isSafeInteger(b.count)||b.count<1))||(b.type==='payment'&&!['cash','paypal'].includes(b.method))||(b.type==='challenge'&&(!['in','out'].includes(b.direction)||!/^[A-F0-9]{8}$/.test(b.code||''))))throw new Error('Ungültige Buchung.');
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

/* End-to-end encrypted phone requests; a separate purpose from balance snapshots. */
(function(g){
 'use strict';const enc=new TextEncoder(),dec=new TextDecoder(),hex=/^[a-f0-9]{64}$/,idPattern=/^[a-f0-9-]{36}$/;
 const bytes=s=>Uint8Array.from(s.match(/../g),x=>parseInt(x,16)),b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 function validate(c){
  if(c?.version!==1)throw Error('Ungültiger Handyauftrag.');
  if(c.kind==='drinks'){if(!Array.isArray(c.entries)||!c.entries.length||c.entries.length>20||c.entries.some(x=>!['beer','wine'].includes(x.drink)||x.pointUnits!==undefined&&(!Number.isSafeInteger(x.pointUnits)||x.pointUnits<=0||x.pointUnits>1500000)))throw Error('Ungültige Getränkesammlung.');}
  else if(c.kind==='cash'){if(!Number.isSafeInteger(c.cents)||c.cents<1||c.cents>1000000)throw Error('Ungültige Einzahlung.');}
  else if(c.kind==='undo'){if(!/^[-a-zA-Z0-9]{8,150}$/.test(c.targetId||''))throw Error('Ungültige Rücknahme.');}
  else throw Error('Ungültiger Handyauftrag.');return c;
 }
 function check(record,id){if(!/^[a-f0-9]{32}$/.test(record?.alias||'')||!hex.test(record?.key||'')||!idPattern.test(id))throw Error('Ungültiger Buchungszugang.');}
 async function seal(c,record,id){check(record,id);validate(c);const raw=enc.encode(JSON.stringify(c));if(raw.length>4096)throw Error('Zu viele Eingaben.');const plain=new Uint8Array(4096).fill(32);plain.set(raw);const iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',bytes(record.key),'AES-GCM',false,['encrypt']);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('deckel-command/v1/'+record.alias+'/'+id)},key,plain);return {version:1,iv:b64(iv),data:b64(data)};}
 async function open(e,record,id){check(record,id);if(e?.version!==1||typeof e.iv!=='string'||e.iv.length!==16||typeof e.data!=='string'||e.data.length!==5484)throw Error('Ungültiger Handyauftrag.');const iv=un64(e.iv),data=un64(e.data);if(iv.length!==12||data.length!==4112)throw Error('Ungültiger Handyauftrag.');const key=await crypto.subtle.importKey('raw',bytes(record.key),'AES-GCM',false,['decrypt']);return validate(JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode('deckel-command/v1/'+record.alias+'/'+id)},key,data))));}
 g.DeckelCommands={validate,seal,open};
})(globalThis);

/* One set of financial rules for the iPad and the free central service. */
(function(g){
 'use strict';const M=g.DrinksModel;
 function apply(a,job,c,policy){
  g.DeckelCommands.validate(c);
  if((c.epoch||'0')!==(a.resetEpoch||'0'))throw Object.assign(Error('Das Konto wurde zurückgesetzt. Bitte neu laden.'),{code:'accessChanged'});
  const createdAt=new Date(job.created_at).toISOString(),prefix='mobile-'+job.id;
  if(c.kind==='drinks'){
   const entries=c.entries.map((x,i)=>({id:prefix+'-'+i,type:'drinks',count:1,drink:x.drink,cents:M.unitPrice(x),loyaltyVersion:2,...(x.pointUnits?{pointUnits:x.pointUnits}:{}),createdAt}));
   for(const b of entries)if(!a.bookings.some(x=>x.id===b.id)&&b.pointUnits&&b.pointUnits!==M.pointCost(policy,b.drink))throw Object.assign(Error('Punktekosten geändert.'),{code:'pointsChanged'});
   const needed=entries.filter(b=>!a.bookings.some(x=>x.id===b.id)).reduce((n,b)=>n+(b.pointUnits||0),0);
   if(needed>M.rewardState(a,policy).pointUnits)throw Object.assign(Error('Treuepunkte inzwischen verwendet.'),{code:'pointsChanged'});
   return M.appendMany(a,entries);
  }
  if(c.kind==='cash')return M.appendWithReward(a,{id:prefix,type:'payment',cents:c.cents,method:'cash',confirmation:'member',prepay:true,createdAt},policy);
  const old=a.bookings.find(b=>b.id===prefix);if(old){if(old.type!=='correction'||old.targetId!==c.targetId)throw Error('Vorgangsnummer bereits verwendet.');return a;}
  const target=M.correctable(a),original=a.bookings.find(b=>b.id===c.targetId);
  if(!original||target.targetId!==c.targetId||M.day(original.createdAt)!==M.day(new Date().toISOString()))throw Object.assign(Error('Eintrag inzwischen geändert.'),{code:'correctionChanged'});
  return M.append(a,{id:prefix,type:'correction',targetId:c.targetId,count:1,cents:target.price,drink:target.drink,createdAt});
 }
 function snapshot(a,p){
  const totals=M.totals(a),r=M.rewardState(a,p),state=M.ledger(a),undo=M.correctable(a);
  return {version:1,balance:totals.balance,credit:r.prepaid,pointUnits:r.pointUnits,thresholdCents:r.threshold,progressCents:r.progress,awardUnits:M.award(p),beerUnits:M.pointCost(p,'beer'),wineUnits:M.pointCost(p,'wine'),needed:r.needed,bonusCents:M.award(p),updatedAt:new Date().toISOString(),...(undo.count?{undo:{targetId:undo.targetId}}:{}),bookings:a.bookings.slice(-5).reverse().map(b=>({type:b.type,cents:b.cents,createdAt:b.createdAt,...(b.type==='challenge'?{direction:b.direction,code:b.code}:{}),...((b.type==='payment'&&state.reversedPayments.has(b.id)||b.type==='bonus'&&state.reversedPayments.has(b.paymentId)||b.type==='drinks'&&state.drinks.get(b.id)?.count===0)?{cancelled:true}:{}),...(['drinks','correction'].includes(b.type)?{count:b.count,...(b.pointUnits?{pointUnits:b.pointUnits}:{}),...((b.drink==='wine'||b.type==='correction'&&a.bookings.find(t=>t.id===b.targetId)?.drink==='wine')?{drink:'wine'}:{})}:b.type==='payment'?{method:b.method}:{})}))};
 }
 g.DrinksLedger={apply,snapshot};
})(globalThis);

/* Private question bank. Public code contains no questions or solution keys. */
(function(global){
  'use strict';
  const uuid=value=>typeof value==='string'&&/^[-a-zA-Z0-9]{8,150}$/.test(value);
  const text=(value,max,label,required=true)=>{if(typeof value!=='string'||value.length>max||required&&!value.trim())throw Error(label+' fehlt oder ist zu lang.');return value;};
  function question(q){
    if(!q||!uuid(q.id)||!Number.isSafeInteger(q.version)||q.version<1||typeof q.active!=='boolean'||!Number.isFinite(Date.parse(q.updatedAt)))throw Error('Eine Frage ist nicht lesbar.');
    text(q.category,80,'Kategorie');text(q.text,800,'Frage');text(q.explanation,2000,'Erklärung',false);text(q.source,500,'Quelle / Stand',false);
    if(!Array.isArray(q.answers)||q.answers.length!==4)throw Error('Bitte vier Antwortmöglichkeiten angeben.');
    q.answers.forEach(a=>text(a,300,'Antwort'));if(new Set(q.answers.map(a=>a.trim().normalize('NFC').toLocaleLowerCase('de-DE'))).size!==4)throw Error('Die vier Antworten müssen unterschiedlich sein.');
    if(!Number.isSafeInteger(q.correct)||q.correct<0||q.correct>3)throw Error('Bitte die richtige Antwort auswählen.');
    return {id:q.id,version:q.version,category:q.category,text:q.text,answers:q.answers.slice(),correct:q.correct,explanation:q.explanation,source:q.source,active:q.active,updatedAt:q.updatedAt};
  }
  function validate(bank){
    if(!bank||bank.schemaVersion!==1||!uuid(bank.revision)||!Number.isFinite(Date.parse(bank.updatedAt))||!Array.isArray(bank.questions)||bank.questions.length>1000)throw Error('Die Fragenbank ist nicht lesbar.');
    const questions=bank.questions.map(question);if(new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('Eine Frage ist doppelt vorhanden.');
    return {schemaVersion:1,revision:bank.revision,updatedAt:bank.updatedAt,questions};
  }
  function empty(){return {schemaVersion:1,revision:null,updatedAt:null,questions:[]};}
  function prepare(bank,input,id=null){
    if(bank.revision!==null)validate(bank);
    const old=id?bank.questions.find(q=>q.id===id):null;if(id&&!old)throw Error('Die Frage wurde inzwischen entfernt. Bitte neu laden.');
    const now=new Date().toISOString(),q=question({id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,category:input.category.trim(),text:input.text.trim(),answers:input.answers.map(a=>a.trim()),correct:input.correct,explanation:input.explanation.trim(),source:input.source.trim(),active:input.active,updatedAt:now});
    return validate({schemaVersion:1,revision:crypto.randomUUID(),updatedAt:now,questions:old?bank.questions.map(x=>x.id===old.id?q:x):[...bank.questions,q]});
  }
  function remove(bank,id){validate(bank);if(!bank.questions.some(q=>q.id===id))throw Error('Die Frage wurde bereits entfernt. Bitte neu laden.');return validate({...bank,revision:crypto.randomUUID(),updatedAt:new Date().toISOString(),questions:bank.questions.filter(q=>q.id!==id)});}
  function importQuestions(bank,data){
    if(bank.revision!==null)validate(bank);
    if(!data||data.schemaVersion!==1||!Array.isArray(data.questions)||!data.questions.length||data.questions.length>1000)throw Error('Keine gültige Fragen-Importdatei.');
    const incoming=data.questions.map(question),key=q=>(q.category+'\n'+q.text).trim().normalize('NFC').toLocaleLowerCase('de-DE'),seen=new Set(bank.questions.map(key)),now=new Date().toISOString(),added=[];
    for(const q of incoming){if(seen.has(key(q)))continue;seen.add(key(q));added.push({...q,id:crypto.randomUUID(),version:1,active:false,updatedAt:now});}
    if(bank.questions.length+added.length>1000)throw Error('Die Fragenbank darf höchstens 1000 Fragen enthalten.');
    return {added:added.length,skipped:incoming.length-added.length,bank:added.length?validate({schemaVersion:1,revision:crypto.randomUUID(),updatedAt:now,questions:[...bank.questions,...added]}):bank};
  }
  global.DrinksQuizModel={question,validate,empty,prepare,remove,importQuestions};
})(typeof window==='undefined'?globalThis:window);

/* No public questions or solution keys. Equal-score winners share only real debt. */
(function(g){
 'use strict';
 function allocate(total,caps){
  const values=caps.map(()=>0);let left=total,remaining=caps.map((_,i)=>i);
  while(left&&remaining.length){const share=Math.floor(left/remaining.length),extra=left%remaining.length;let used=0;for(let j=0;j<remaining.length;j++){const i=remaining[j],n=Math.min(caps[i]-values[i],share+(j<extra?1:0));values[i]+=n;used+=n;}left-=used;remaining=remaining.filter(i=>values[i]<caps[i]);if(!used)break;}
  return values;
 }
 function settle(players,questions,stake){
  if(!Array.isArray(players)||players.length<2||players.length>20||new Set(players.map(p=>p.alias)).size!==players.length||!Array.isArray(questions)||questions.length!==7||!Number.isSafeInteger(stake)||stake<1||stake>100000)throw Error('Ungültige Spielrunde.');
  const sorted=players.slice().sort((a,b)=>a.alias.localeCompare(b.alias));
  const result=sorted.map(p=>{if(!Number.isSafeInteger(p.debt)||p.debt<0||!Array.isArray(p.answers)||p.answers.length!==7||p.answers.some(a=>!Number.isSafeInteger(a)||a<0||a>3))throw Error('Die Runde ist noch nicht vollständig.');return {alias:p.alias,score:p.answers.filter((a,i)=>a===questions[i].correct).length,delta:0};});
  const best=Math.max(...result.map(p=>p.score)),winners=result.filter(p=>p.score===best),losers=result.filter(p=>p.score!==best);
  if(!losers.length)return result;
  const caps=winners.map(p=>sorted.find(x=>x.alias===p.alias).debt),pot=Math.min(stake*losers.length,caps.reduce((a,b)=>a+b,0)),gains=allocate(pot,caps),losses=allocate(pot,losers.map(()=>stake));
  winners.forEach((p,i)=>p.delta=-gains[i]);losers.forEach((p,i)=>p.delta=losses[i]);return result;
 }
 g.DeckelChallengeRules={settle,allocate};
})(globalThis);

/* Encrypted authoritative ledger. All mutations share a D1 transaction/revision. */
(function(g){
 'use strict';const M=g.DrinksModel,C=g.DeckelCrypto,utf=new TextEncoder(),dec=new TextDecoder();
 const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
 const meta=env=>env.DB.prepare('SELECT * FROM ledger_meta WHERE id=1').first();
 async function cryptKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf.encode('ffw-ledger-at-rest/v1:'+env.INVITE_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
 async function seal(env,value,purpose){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf.encode(purpose)},await cryptKey(env),utf.encode(JSON.stringify(value))));return JSON.stringify({iv:Array.from(iv),data:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))});}
 async function open(env,payload,purpose){const e=JSON.parse(payload);return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(e.iv),additionalData:utf.encode(purpose)},await cryptKey(env),Uint8Array.from(atob(e.data),c=>c.charCodeAt(0)))));}
 function member(id){if(typeof id!=='string'||!id.length||id.length>200)fail('Ungültige Mitgliederkennung.',400);return id;}
 async function read(env,id){member(id);const row=await env.DB.prepare('SELECT * FROM ledgers WHERE member=?').bind(id).first();return row?{account:M.validate(await open(env,row.payload,'ledger:'+id),id),version:row.version}:{account:M.empty(id),version:0};}
 function source(m,data){if(!m||m.source!==data.source)fail('Dieser Dienst gehört zu einem anderen OneDrive-Ordner.');}
 function active(m){if(m?.state!=='active')fail('Die Kontenübernahme ist noch nicht abgeschlossen.');}
 const tick=(env,seq)=>env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=?').bind(seq);
 async function save(env,m,id,a,version,extras=[]){
  M.validate(a,id);const payload=await seal(env,a,'ledger:'+id);
  const q=env.DB.prepare("INSERT INTO ledgers(member,payload,version) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state='active') AND ?=0 ON CONFLICT(member) DO NOTHING").bind(id,payload,m.seq,version);
  const update=env.DB.prepare("UPDATE ledgers SET payload=?,version=version+1 WHERE member=? AND version=? AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state='active')").bind(payload,id,version,m.seq);
  // The marker payload is unique; acknowledgements and the sequence tick run only
  // if this exact CAS succeeded, in the same transaction.
  const guard='EXISTS(SELECT 1 FROM ledgers WHERE member=? AND payload=?)';
  const statements=[version?update:q,...extras.map(fn=>fn(guard,id,payload)),env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND '+guard).bind(m.seq,id,payload)];
  await env.DB.batch(statements);
  const check=await env.DB.prepare('SELECT payload,version FROM ledgers WHERE member=?').bind(id).first();
  if(check?.payload!==payload)fail('Das Konto wurde gleichzeitig geändert. Bitte erneut prüfen.');
  return {version:check.version};
 }
 async function process(env,data){
  const receipt=await env.DB.prepare('SELECT * FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();
  if(!receipt)return {status:'missing'};if(receipt.status!=='pending')return {status:receipt.status,result:receipt.result};
  for(let attempt=0;attempt<4;attempt++){
   const m=await meta(env);active(m);
   const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(data.alias,data.revision).first();
   if(!row)fail('Handyzugang muss in der Verwaltung aktualisiert werden.');
   const record=await open(env,row.payload,'access:'+data.alias),current=await read(env,record.memberId);
   let next,rejection='';
   try{const command=await g.DeckelCommands.open(JSON.parse(receipt.envelope),record,data.id);next=g.DrinksLedger.apply(current.account,receipt,command,M.rewardPolicy(await open(env,m.policy,'policy')));}
   catch(e){rejection=['pointsChanged','correctionChanged','accessChanged'].includes(e.code)?e.code:'invalid';}
   if(rejection){
    await env.DB.prepare("UPDATE commands SET status='rejected',result=?,envelope='' WHERE alias=? AND revision=? AND id=? AND status='pending' AND EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=?)").bind(rejection,data.alias,data.revision,data.id,m.seq).run();
    const check=await env.DB.prepare('SELECT status,result FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();if(check.status!=='pending')return check;continue;
   }
   try{await save(env,m,record.memberId,next,current.version,[(guard,id,payload)=>env.DB.prepare("UPDATE commands SET status='done',result='',envelope='' WHERE alias=? AND revision=? AND id=? AND status='pending' AND "+guard).bind(data.alias,data.revision,data.id,id,payload)]);return {status:'done',result:''};}
   catch(e){if(e.status!==409)throw e;const done=await env.DB.prepare('SELECT status,result FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();if(done.status!=='pending')return done;}
  }
  return {status:'pending'};
 }
 async function route(path,data,env,auth,url){
  let m=await meta(env);
  if(path==='/central/snapshot'){
   if(m?.state!=='active')return {mode:'legacy'};
   const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=?').bind(data.alias||'').first();if(!row)fail('Handyzugang noch nicht übernommen. Bitte die Verwaltung informieren.',404);
   const record=await open(env,row.payload,'access:'+data.alias);
   if(!equal(auth,await hash('deckel-read/v1:'+record.alias+':'+record.key)))fail('Handyzugang ungültig.',401);
   const current=await read(env,record.memberId),p=M.rewardPolicy(await open(env,m.policy,'policy')),snapshot=g.DrinksLedger.snapshot(current.account,p);
   snapshot.actions={origin:new URL(url).origin,revision:record.revision,capability:await capability(env,record.alias,record.revision,'commands'),central:true,epoch:current.account.resetEpoch||'0',...(await g.DeckelChallengeService?.ready(env)?{challengeVersion:1}:{})};
   return {mode:'central',envelope:await C.seal(snapshot,record)};
  }
  if(path.startsWith('/commands/')&&m?.state==='active'){
   if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||'')||!/^[a-f0-9-]{36}$/.test(data.id||''))fail('Ungültiger Auftrag.',400);
   const row=await env.DB.prepare('SELECT revision FROM ledger_access WHERE alias=?').bind(data.alias).first();
   if(!row||row.revision!==data.revision||!equal(auth,await capability(env,data.alias,row.revision,'commands')))fail('Buchungszugang ersetzt. Bitte neu laden.',401);
   if(path==='/commands/status')return process(env,data);
   if(path!=='/commands/submit')fail('Nicht gefunden.',404);
   const envelope=JSON.stringify(data.envelope);if(data.envelope?.version!==1||data.envelope.iv?.length!==16||data.envelope.data?.length!==5484)fail('Ungültige verschlüsselte Buchung.',400);
   const digest=await hash(envelope),old=await env.DB.prepare('SELECT digest FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();
   if(old&&old.digest!==digest)fail('Vorgangsnummer bereits verwendet.');
   if(!old){const now=Date.now();await env.DB.prepare("INSERT OR IGNORE INTO commands(alias,revision,id,envelope,digest,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM commands WHERE alias=? AND status='pending')<30 AND NOT EXISTS(SELECT 1 FROM commands WHERE alias=? AND created_at>?)").bind(data.alias,data.revision,data.id,envelope,digest,now,data.alias,data.alias,now-1000).run();const found=await env.DB.prepare('SELECT digest FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();if(!found)fail('Bitte kurz warten und denselben Vorgang erneut prüfen.',429);if(found.digest!==digest)fail('Vorgangsnummer bereits verwendet.');}
   return process(env,data);
  }
  if(!path.startsWith('/admin/central/'))return null;
  if(path==='/admin/central/status')return {version:1,state:m?.state||'unconfigured',source:m?.source||null,seq:m?.seq||0};
  if(path==='/admin/central/start'){
   if(typeof data.source!=='string'||!data.source||data.source.length>500)fail('Ungültiger Datenordner.',400);
   const policy=M.validateRewardSettings(data.policy);
   await env.DB.prepare("INSERT OR IGNORE INTO ledger_meta(id,source,state,seq,policy) VALUES(1,?,'staging',0,?)").bind(data.source,await seal(env,policy,'policy')).run();m=await meta(env);source(m,data);if(m.state==='staging')await env.DB.prepare("UPDATE ledger_meta SET policy=? WHERE id=1 AND state='staging'").bind(await seal(env,policy,'policy')).run();return {state:m.state};
  }
  source(m,data);
  if(path==='/admin/central/import'){
   if(m.state!=='staging')fail('Die Übernahme wurde bereits abgeschlossen.');
   const a=M.validate(data.account,member(data.account?.memberId)),payload=await seal(env,a,'ledger:'+a.memberId);
   await env.DB.prepare("INSERT INTO ledgers(member,payload,version) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE state='staging') ON CONFLICT(member) DO UPDATE SET payload=excluded.payload,version=ledgers.version+1 WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE state='staging')").bind(a.memberId,payload).run();return {ok:true};
  }
  if(path==='/admin/central/access'){
   const r=C.access(data.record);member(r.memberId);if(!REV.test(r.revision||''))fail('Ungültige Zugangsversion.',400);
   const old=await account(env,r.alias);if(old?.revision!==r.revision)fail('Handyzugang zuerst beim Dienst anmelden.');
   const existing=await env.DB.prepare('SELECT payload FROM ledger_access WHERE alias=?').bind(r.alias).first();if(existing&&JSON.stringify(await open(env,existing.payload,'access:'+r.alias))===JSON.stringify(r))return {ok:true};
   const payload=await seal(env,r,'access:'+r.alias);
   await env.DB.batch([env.DB.prepare('INSERT INTO ledger_access(alias,revision,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE seq=?) AND EXISTS(SELECT 1 FROM accounts WHERE alias=? AND revision=?) ON CONFLICT(alias) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').bind(r.alias,r.revision,payload,m.seq,r.alias,r.revision),tick(env,m.seq)]);
   if((await env.DB.prepare('SELECT payload FROM ledger_access WHERE alias=?').bind(r.alias).first())?.payload!==payload)fail('Zugang wurde gleichzeitig geändert.');return {ok:true};
  }
  if(path==='/admin/central/activate'){
   const count=(await env.DB.prepare('SELECT COUNT(*) AS n FROM ledgers').first()).n;
   if(!Number.isInteger(data.count)||count!==data.count||typeof data.backup!=='string'||!data.backup.startsWith('sicherung-'))fail('Übernahme oder Sicherung unvollständig.');
   await env.DB.prepare("UPDATE ledger_meta SET state='active',seq=seq+1 WHERE id=1 AND state='staging'").run();return {state:'active'};
  }
  active(m);
  if(path==='/admin/central/members')return {members:(await env.DB.prepare('SELECT member FROM ledgers ORDER BY member').all()).results.map(r=>r.member),seq:m.seq};
  if(path==='/admin/central/read')return {...await read(env,member(data.memberId)),seq:m.seq};
  if(path==='/admin/central/policy')return {policy:await open(env,m.policy,'policy'),seq:m.seq};
  if(path==='/admin/central/policy-write'){
   const p=M.validateRewardSettings(data.policy),old=await open(env,m.policy,'policy');if(old.revision!==data.expectedRevision)fail('Treuepunkte-Einstellungen wurden geändert.');
   const result=await env.DB.prepare('UPDATE ledger_meta SET policy=?,seq=seq+1 WHERE id=1 AND seq=?').bind(await seal(env,p,'policy'),m.seq).run();if(!result.meta.changes)fail('Konten wurden gleichzeitig geändert.');return {ok:true};
  }
  if(path==='/admin/central/write'){
   const a=M.validate(data.account,member(data.memberId)),current=await read(env,data.memberId);
   if(current.version!==data.version)fail('Das Konto wurde gleichzeitig geändert.');
   const additions=a.bookings.slice(current.account.bookings.length),policy=await open(env,m.policy,'policy');
   if(additions.some(b=>b.type==='challenge'))fail('Challenge-Buchungen müssen gemeinsam durch den Spieldienst erfolgen.',400);
   if((data.policyRevision&&data.policyRevision!==policy.revision)||(!data.policyRevision&&additions.some(b=>b.type==='payment'||b.type==='bonus'||b.pointUnits)))fail('Die Treuepunkte-Einstellungen wurden geändert. Bitte neu laden.');
   // Ordinary writes must preserve the reset barrier and every existing entry.
   if((a.resetEpoch||'0')!==(current.account.resetEpoch||'0')||a.resetAt!==current.account.resetAt||JSON.stringify(a.bookings.slice(0,current.account.bookings.length))!==JSON.stringify(current.account.bookings))fail('Bestehende Buchungen dürfen nur über Zurücksetzen entfernt werden.');
   return save(env,m,data.memberId,a,data.version);
  }
  if(path==='/admin/central/reset-stage'){
   if(!REV.test(data.id||'')||data.seq!==m.seq)fail('Seit der Sicherung wurde gebucht. Bitte neu sichern.');
   const id=member(data.memberId),current=await read(env,id);if(!current.version)fail('Konto nicht gefunden.');
   const next={...M.empty(id),schemaVersion:7,pin:current.account.pin,resetEpoch:data.id,resetAt:new Date().toISOString()};
   await env.DB.prepare('INSERT INTO ledger_reset_items(reset_id,member,payload,seq) VALUES(?,?,?,?) ON CONFLICT(reset_id,member) DO UPDATE SET payload=excluded.payload,seq=excluded.seq').bind(data.id,id,await seal(env,next,'ledger:'+id),m.seq).run();return {ok:true};
  }
  if(path==='/admin/central/reset'){
   if(!REV.test(data.id||'')||!/^sicherung-[a-z0-9-]+\.json$/.test(data.backup||'')||!Array.isArray(data.members)||!data.members.length||new Set(data.members).size!==data.members.length||data.members.length>500)fail('Ungültiges Zurücksetzen.',400);
   const previous=await env.DB.prepare('SELECT id FROM ledger_resets WHERE id=?').bind(data.id).first();if(previous)return {ok:true,duplicate:true};
   if(data.seq!==m.seq)fail('Seit der Sicherung wurde gebucht. Bitte neu sichern und bestätigen.');
   const staged=(await env.DB.prepare('SELECT member,seq FROM ledger_reset_items WHERE reset_id=?').bind(data.id).all()).results;
   if(staged.length!==data.members.length||staged.some(r=>r.seq!==m.seq||!data.members.includes(r.member)))fail('Reset-Vorbereitung unvollständig.');
   await env.DB.batch([
    env.DB.prepare('UPDATE ledgers SET payload=(SELECT payload FROM ledger_reset_items WHERE reset_id=? AND member=ledgers.member),version=version+1 WHERE member IN(SELECT member FROM ledger_reset_items WHERE reset_id=?) AND EXISTS(SELECT 1 FROM ledger_meta WHERE seq=?)').bind(data.id,data.id,m.seq),
    env.DB.prepare('INSERT INTO ledger_resets(id,backup,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE seq=?)').bind(data.id,data.backup,Date.now(),m.seq),tick(env,m.seq)
   ]);
   if(!await env.DB.prepare('SELECT id FROM ledger_resets WHERE id=?').bind(data.id).first())fail('Seit der Sicherung wurde gebucht. Es wurde nichts zurückgesetzt.');return {ok:true};
  }
  fail('Nicht gefunden.',404);
 }
 g.CentralLedger={route,meta,source,active,read,seal,open};
})(globalThis);

/* Private question snapshots and atomic, zero-sum multiplayer settlement. */
(function(g){
 'use strict';const L=g.CentralLedger,M=g.DrinksModel,Q=g.DrinksQuizModel,R=g.DeckelChallengeRules;
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v),fail=(s,status=409,code='rejected')=>{throw Object.assign(Error(s),{status,code});},copy=v=>JSON.parse(JSON.stringify(v)),checks=new WeakMap();
 async function ready(env){const old=checks.get(env.DB);if(old&&old.until>Date.now())return old.ready;let ok=false;try{await env.DB.prepare('SELECT id FROM challenge_pool LIMIT 1').first();await env.DB.prepare('SELECT id FROM challenge_games LIMIT 1').first();ok=true;}catch{}checks.set(env.DB,{ready:ok,until:Date.now()+(ok?60000:5000)});return ok;}
 async function actor(env,data,auth){
  if(!ALIAS.test(data.alias||'')||!REV.test(data.revision||''))fail('Ungültiger Handyzugang.',400);
  const row=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(data.alias,data.revision).first(),current=await env.DB.prepare('SELECT revision FROM accounts WHERE alias=?').bind(data.alias).first();
  if(!row||current?.revision!==data.revision||!equal(auth,await capability(env,data.alias,data.revision,'commands')))fail('Handyzugang wurde geändert. Bitte Deckel aktualisieren.',401);
  return L.open(env,row.payload,'access:'+data.alias);
 }
 async function pool(env){const row=await env.DB.prepare('SELECT * FROM challenge_pool WHERE id=1').first();return row?{value:await L.open(env,row.payload,'challenge-pool'),version:row.version}:null;}
 const name=v=>{if(typeof v!=='string'||!v.trim()||v.length>40)fail('Bitte einen Spielnamen mit höchstens 40 Zeichen eingeben.',400);return v.trim();};
 function shuffled(values){const a=values.slice();for(let i=a.length-1;i>0;i--){const limit=Math.floor(0x100000000/(i+1))*(i+1);let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
 function select(questions){return shuffled(questions).slice(0,7).map(q=>{const order=shuffled([0,1,2,3]);return {...q,answers:order.map(i=>q.answers[i]),correct:order.indexOf(q.correct)};});}
 async function game(env,data){
  let row;if(uuid(data.gameId))row=await env.DB.prepare('SELECT * FROM challenge_games WHERE id=?').bind(data.gameId).first();else if(/^[A-F0-9]{8}$/.test(data.code||''))row=await env.DB.prepare('SELECT * FROM challenge_games WHERE code=?').bind(data.code).first();else fail('Bitte einen gültigen Spielcode eingeben.',400);
  if(!row)fail('Runde nicht gefunden. Bitte den Spielcode prüfen.',404);return {row,value:await L.open(env,row.payload,'challenge:'+row.id)};
 }
 function view(game,alias){
  const me=game.players.find(p=>p.alias===alias),done=game.status==='done';
  return {version:1,gameId:game.id,code:game.code,status:game.status,stakeCents:game.stakeCents,expiresAt:game.expiresAt,isHost:game.host===alias,reason:game.reason||'',players:game.players.map(p=>({name:p.name,me:p.alias===alias,host:p.alias===game.host,progress:p.answers.length,...(done?{score:p.score,delta:p.delta}:{} )})),...(me&&game.status==='running'&&me.answers.length<7?{question:{index:me.answers.length,category:game.questions[me.answers.length].category,text:game.questions[me.answers.length].text,answers:game.questions[me.answers.length].answers}}:{}),...(done&&me?{review:game.questions.map((q,i)=>({text:q.text,answers:q.answers,correct:q.correct,selected:me.answers[i],explanation:q.explanation,source:q.source}))}:{})};
 }
 // The first CAS verifies ALL affected ledger versions before changing anything.
 // All later statements are guarded by its unique encrypted marker in one batch.
 async function commit(env,meta,row,next,accounts=[]){
  const payload=await L.seal(env,next,'challenge:'+next.id),clauses=['EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state=\'active\')'],params=[meta.seq];
  for(const a of accounts){clauses.push('EXISTS(SELECT 1 FROM ledgers WHERE member=? AND version=?)');params.push(a.id,a.version);}
  const first=env.DB.prepare('UPDATE challenge_games SET payload=?,version=version+1,updated_at=? WHERE id=? AND version=? AND '+clauses.join(' AND ')).bind(payload,Date.now(),next.id,row.version,...params),guard='EXISTS(SELECT 1 FROM challenge_games WHERE id=? AND payload=?)',statements=[first];
  for(const a of accounts)statements.push(env.DB.prepare('UPDATE ledgers SET payload=?,version=version+1 WHERE member=? AND '+guard).bind(await L.seal(env,a.account,'ledger:'+a.id),a.id,next.id,payload));
  statements.push(env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND '+guard).bind(meta.seq,next.id,payload));
  const results=await env.DB.batch(statements);if(!results[0].meta.changes)fail('Die Runde oder ein Konto wurde gleichzeitig geändert. Bitte denselben Vorgang erneut prüfen.',409,'retry');
 }
 async function settlement(env,next){
  const accounts=[];for(const p of next.players){
   const access=await env.DB.prepare('SELECT * FROM ledger_access WHERE alias=? AND revision=?').bind(p.alias,p.revision).first(),current=await env.DB.prepare('SELECT revision FROM accounts WHERE alias=?').bind(p.alias).first();
   if(!access||current?.revision!==p.revision){next.status='cancelled';next.reason='Ein Handyzugang wurde geändert. Es wurde nichts übertragen.';return [];}
   const r=await L.open(env,access.payload,'access:'+p.alias),a=await L.read(env,p.memberId);
   if(r.memberId!==p.memberId||!a.version||(a.account.resetEpoch||'0')!==p.epoch){next.status='cancelled';next.reason='Ein Konto wurde zurückgesetzt oder geändert. Es wurde nichts übertragen.';return [];}
   accounts.push({id:p.memberId,version:a.version,account:a.account});
  }
  const deltas=R.settle(next.players.map((p,i)=>({...p,debt:M.totals(accounts[i].account).balance})),next.questions,next.stakeCents),createdAt=new Date().toISOString();
  for(let i=0;i<next.players.length;i++){const p=next.players[i],result=deltas.find(r=>r.alias===p.alias);p.score=result.score;p.delta=result.delta;if(result.delta)accounts[i].account=M.appendChallenge(accounts[i].account,{id:'challenge-'+next.id,type:'challenge',gameId:next.id,code:next.code,confirmation:'challenge',direction:result.delta>0?'in':'out',cents:Math.abs(result.delta),score:result.score,createdAt});}
  next.status='done';next.completedAt=createdAt;return accounts;
 }
 async function route(path,data,env,auth){
  if(!await ready(env))fail('Die Challenge benötigt das Worker-Update und challenge.sql in der bestehenden D1-Datenbank.',503);
  const meta=await L.meta(env);L.active(meta);
  if(path.startsWith('/admin/challenge/')){
   L.source(meta,data);const old=await pool(env);
   if(path==='/admin/challenge/status')return {version:1,revision:old?.value.revision||null,count:old?.value.questions.length||0};
   if(path!=='/admin/challenge/publish')fail('Nicht gefunden.',404);
   if(!REV.test(data.revision||'')||!Array.isArray(data.questions)||data.questions.length>1000)fail('Ungültige Fragenbank.',400);
   let questions;try{questions=data.questions.map(Q.question).filter(q=>q.active);if(new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('Doppelte Fragen.');}catch{fail('Die Fragenbank ist nicht gültig.',400);}
   const value={revision:data.revision,questions};if(old?.value.revision===value.revision){if(JSON.stringify(old.value)!==JSON.stringify(value))fail('Diese Fragenversion wurde bereits anders verwendet.');return {ok:true,count:questions.length};}
   if((old?.value.revision||null)!==data.expectedRevision)fail('Der veröffentlichte Fragenstand wurde geändert. Bitte erneut prüfen.');
   const payload=await L.seal(env,value,'challenge-pool');let result;
   if(old)result=await env.DB.prepare('UPDATE challenge_pool SET payload=?,version=version+1 WHERE id=1 AND version=?').bind(payload,old.version).run();else result=await env.DB.prepare('INSERT OR IGNORE INTO challenge_pool(id,payload) VALUES(1,?)').bind(payload).run();
   if(!result.meta.changes)fail('Der Fragenstand wurde gleichzeitig geändert. Bitte erneut prüfen.');return {ok:true,count:questions.length};
  }
  const record=await actor(env,data,auth),action=path.slice('/challenge/'.length);
  if(!['create','preview','join','get','start','answer','cancel'].includes(action))fail('Nicht gefunden.',404);
  const digest=await hash(JSON.stringify({...data,action}));
  if(action==='create'){
   if(!uuid(data.id)||!Number.isSafeInteger(data.stakeCents)||data.stakeCents<1||data.stakeCents>100000||data.confirmedCents!==data.stakeCents)fail('Einsatz bitte ausdrücklich bestätigen: 0,01 bis 1000 Euro.',400);
   const previous=await env.DB.prepare('SELECT * FROM challenge_games WHERE id=?').bind(data.id).first();
   if(previous){const old=await L.open(env,previous.payload,'challenge:'+data.id);if(old.host!==record.alias||old.operations[data.id]!==digest)fail('Die Vorgangsnummer wurde bereits anders verwendet.');return view(old,record.alias);}
   const published=await pool(env);if(!published||published.value.questions.length<7)fail('Die Verwaltung muss mindestens sieben geprüfte Fragen für die Challenge veröffentlichen.');
   const a=await L.read(env,record.memberId);if(!a.version)fail('Das Getränkekonto ist noch nicht aktiv.');
   const next={id:data.id,code:crypto.randomUUID().slice(0,8).toUpperCase(),status:'lobby',host:record.alias,stakeCents:data.stakeCents,createdAt:Date.now(),expiresAt:Date.now()+86400000,poolRevision:published.value.revision,questions:select(published.value.questions),players:[{alias:record.alias,revision:record.revision,memberId:record.memberId,epoch:a.account.resetEpoch||'0',name:name(data.name),answers:[]}],operations:{[data.id]:digest}};
   const payload=await L.seal(env,next,'challenge:'+next.id),results=await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO challenge_games(id,code,payload,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM ledger_meta WHERE id=1 AND seq=? AND state=\'active\')').bind(next.id,next.code,payload,Date.now(),meta.seq),env.DB.prepare('UPDATE ledger_meta SET seq=seq+1 WHERE id=1 AND seq=? AND EXISTS(SELECT 1 FROM challenge_games WHERE id=? AND payload=?)').bind(meta.seq,next.id,payload)]);
   if(!results[0].meta.changes)fail('Die Runde konnte noch nicht bestätigt werden. Bitte denselben Vorgang erneut prüfen.',409,'retry');return view(next,record.alias);
  }
  const found=await game(env,data),old=found.value,me=old.players.find(p=>p.alias===record.alias);
  if(action==='preview')return {version:1,gameId:old.id,code:old.code,status:old.status,stakeCents:old.stakeCents,joined:Boolean(me&&me.revision===record.revision),players:old.players.map(p=>({name:p.name})),expiresAt:old.expiresAt};
  if(action!=='join'&&(!me||me.revision!==record.revision))fail('Du gehörst nicht mit diesem Zugang zu dieser Runde.',403);
  if(action==='get'){
   if(['lobby','running'].includes(old.status)&&old.expiresAt<Date.now()){const next={...old,status:'cancelled',reason:'Zeit abgelaufen. Es wurde nichts übertragen.'};await commit(env,meta,found.row,next);return view(next,record.alias);}return view(old,record.alias);
  }
  if(!uuid(data.id))fail('Ungültige Vorgangsnummer.',400);
  if(old.operations[data.id]){if(old.operations[data.id]!==digest)fail('Die Vorgangsnummer wurde bereits anders verwendet.');return view(old,record.alias);}
  if(!['lobby','running'].includes(old.status)||old.expiresAt<Date.now())fail('Diese Runde ist beendet oder abgelaufen. Bitte aktualisieren.');
  const next=copy(old);next.operations[data.id]=digest;let affected=[];
  if(action==='join'){
   if(old.status!=='lobby'||old.players.length>=20)fail('Die Runde ist bereits gestartet oder voll.');
   if(old.players.some(p=>p.memberId===record.memberId))fail('Dieses Mitglied ist bereits in der Runde.');
   if(data.confirmedCents!==old.stakeCents)fail('Bitte den angezeigten Einsatz ausdrücklich bestätigen.',400);
   const a=await L.read(env,record.memberId);if(!a.version)fail('Das Getränkekonto ist noch nicht aktiv.');const nickname=name(data.name);if(old.players.some(p=>p.name.toLocaleLowerCase('de-DE')===nickname.toLocaleLowerCase('de-DE')))fail('Diesen Spielnamen gibt es bereits. Bitte einen anderen wählen.');
   next.players.push({alias:record.alias,revision:record.revision,memberId:record.memberId,epoch:a.account.resetEpoch||'0',name:nickname,answers:[]});
  }else if(action==='start'){
   if(old.host!==record.alias||old.status!=='lobby'||old.players.length<2)fail('Nur der Gastgeber startet mit mindestens zwei Teilnehmern.');next.status='running';next.expiresAt=Date.now()+30*60000;
  }else if(action==='cancel'){
   next.status='cancelled';next.reason='Die Runde wurde abgebrochen. Es wurde nichts übertragen.';
  }else if(action==='answer'){
   const player=next.players.find(p=>p.alias===record.alias);if(old.status!=='running'||data.index!==player.answers.length||data.index>=7||!Number.isSafeInteger(data.answer)||data.answer<0||data.answer>3)fail('Diese Antwort gehört nicht zur aktuellen Frage. Bitte aktualisieren.');
   player.answers.push(data.answer);if(next.players.every(p=>p.answers.length===7))affected=await settlement(env,next);
  }
  await commit(env,meta,found.row,next,affected);return view(next,record.alias);
 }
 g.DeckelChallengeService={route,ready,view,commit,settlement};
})(globalThis);

/* Cloudflare Workers Free + D1 Free. Financial records are encrypted at rest. */
const ORIGIN='https://ffw-wasser.github.io',ALIAS=/^[a-f0-9]{32}$/,REV=/^[a-zA-Z0-9-]{8,80}$/;
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function hash(s){return b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
function endpoint(value){let u;try{u=new URL(value);}catch{throw new Error('Ungültige Geräte-Adresse.');}const h=u.hostname;const allowed=h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h==='push.services.mozilla.com'||/^[a-z0-9-]+\.push\.apple\.com$/.test(h)||h==='web.push.apple.com';if(u.protocol!=='https:'||!allowed||u.port||u.username||u.password||u.hash||value.length>2048)throw new Error('Geräte-Adresse wird nicht unterstützt.');return u.href;}
async function capability(env,alias,revision,purpose='push'){const key=await crypto.subtle.importKey('raw',enc.encode(env.INVITE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',key,enc.encode('deckel-'+purpose+'-v1:'+alias+':'+revision)));}
async function vapid(env,url){const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const token=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64(enc.encode(JSON.stringify({aud:new URL(url).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'https://ffw-wasser.github.io/home/'})));const signature=b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(token)));return 'vapid t='+token+'.'+signature+', k='+env.VAPID_PUBLIC_KEY;}
async function body(request){const raw=await request.text();if(raw.length>6000)throw new Error('Anfrage zu groß.');const data=JSON.parse(raw);if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Ungültige Anfrage.');return data;}
async function account(env,alias){return env.DB.prepare('SELECT alias, revision, last_sent FROM accounts WHERE alias=?').bind(alias).first();}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin===ORIGIN){headers['Access-Control-Allow-Origin']=ORIGIN;headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&origin!==ORIGIN)return reply({error:'Zugriff nicht erlaubt.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:origin===ORIGIN?204:403,headers});
  const path=new URL(request.url).pathname;
  try{
   if(!env.DB||!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<40||!env.INVITE_SECRET||env.INVITE_SECRET.length<40||!env.VAPID_PRIVATE_JWK||!env.VAPID_PUBLIC_KEY)return reply({error:'Versanddienst noch nicht eingerichtet.'},503);
   if(path==='/health'&&request.method==='GET'){await env.DB.prepare('SELECT alias FROM accounts LIMIT 1').first();await env.DB.prepare('SELECT id FROM commands LIMIT 1').first();await vapid(env,'https://web.push.apple.com/');if(globalThis.CentralLedger)await env.DB.prepare('SELECT id FROM ledger_meta LIMIT 1').first();return reply({version:1,commandsVersion:1,...(globalThis.CentralLedger?{centralVersion:1}:{}),...(await globalThis.DeckelChallengeService?.ready(env)?{challengeVersion:1}:{}),publicKey:env.VAPID_PUBLIC_KEY});}
   if(request.method!=='POST')return reply({error:'Nicht gefunden.'},404);
   const admin=path.startsWith('/admin/');const auth=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
   if(admin&&!equal(auth,env.ADMIN_TOKEN))return reply({error:'Admin-Zugang ungültig.'},401);
   if(path==='/admin/check')return reply({version:1,publicKey:env.VAPID_PUBLIC_KEY});
   if(globalThis.DeckelChallengeService&&(path.startsWith('/challenge/')||path.startsWith('/admin/challenge/'))){
    const raw=await request.text();if(raw.length>(admin?8000000:6000))return reply({error:'Anfrage zu groß.'},413);
    try{const value=JSON.parse(raw);if(!value||Array.isArray(value)||typeof value!=='object')return reply({error:'Ungültige Anfrage.'},400);return reply(await globalThis.DeckelChallengeService.route(path,value,env,auth));}
    catch(error){return reply({error:error.status?error.message:'Challenge derzeit nicht bestätigt. Bitte denselben Vorgang erneut prüfen.',code:error.status?(error.code==='retry'?'retry':'rejected'):'uncertain'},error.status||503);}
   }
   if(globalThis.CentralLedger&&(path.startsWith('/admin/central/')||path==='/central/snapshot'||path.startsWith('/commands/'))){
    const raw=await request.clone().text();if(raw.length>(admin?8000000:6000))return reply({error:'Anfrage zu groß.'},413);
    const value=JSON.parse(raw);
    try{const result=await globalThis.CentralLedger.route(path,value,env,auth,request.url);if(result!==null)return reply(result);}
    catch(error){return reply({error:error.status?error.message:'Kontodienst derzeit nicht erreichbar. Bitte denselben Vorgang erneut prüfen.'},error.status||503);}
   }
   const data=await body(request);
   if(path==='/admin/commands/pending'){
    const rows=(await env.DB.prepare("SELECT c.alias,c.revision,c.id,c.envelope,c.created_at FROM commands c JOIN accounts a ON a.alias=c.alias AND a.revision=c.revision WHERE c.status='pending' ORDER BY c.created_at,c.id LIMIT 20").all()).results;
    return reply({commands:rows});
   }
   if(!ALIAS.test(data.alias||''))return reply({error:'Kontokennung ungültig.'},400);
   if(path==='/admin/account'){
    if(!REV.test(data.revision||''))return reply({error:'Zugangsversion ungültig.'},400);
    // Rotating a member link also removes old push devices. Same revision is idempotent.
    await env.DB.batch([
     env.DB.prepare('INSERT OR IGNORE INTO retired(alias,revision) SELECT alias,revision FROM accounts WHERE alias=? AND revision<>? AND NOT EXISTS(SELECT 1 FROM retired WHERE alias=? AND revision=?)').bind(data.alias,data.revision,data.alias,data.revision),
     env.DB.prepare('DELETE FROM devices WHERE alias=? AND revision<>? AND NOT EXISTS(SELECT 1 FROM retired WHERE alias=? AND revision=?)').bind(data.alias,data.revision,data.alias,data.revision),
     env.DB.prepare('INSERT INTO accounts(alias,revision,last_sent) SELECT ?,?,0 WHERE NOT EXISTS(SELECT 1 FROM retired WHERE alias=? AND revision=?) ON CONFLICT(alias) DO UPDATE SET revision=excluded.revision').bind(data.alias,data.revision,data.alias,data.revision)
    ]);
    if((await account(env,data.alias))?.revision!==data.revision)return reply({error:'Dieser Handyzugang wurde bereits ersetzt. Bitte neu öffnen.'},409);
    const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM devices WHERE alias=? AND revision=?').bind(data.alias,data.revision).first();
    return reply({capability:await capability(env,data.alias,data.revision),actionCapability:await capability(env,data.alias,data.revision,'commands'),devices:row.count});
   }
   const record=await account(env,data.alias);if(!record)return reply({error:'Handyzugang noch nicht für Erinnerungen eingerichtet.'},404);
   if(path==='/commands/submit'||path==='/commands/status'||path==='/admin/commands/ack'){
    if(!REV.test(data.id||'')||data.revision!==record.revision)return reply({error:'Zugang oder Vorgang nicht mehr gültig.'},409);
    if(!admin&&!equal(auth,await capability(env,data.alias,record.revision,'commands')))return reply({error:'Buchungszugang ungültig. Deckel am iPad aktualisieren.'},401);
    const old=await env.DB.prepare('SELECT status,result,digest FROM commands WHERE alias=? AND revision=? AND id=?').bind(data.alias,data.revision,data.id).first();
    if(path==='/commands/status')return old?reply({status:old.status,result:old.result}):reply({status:'missing'});
    if(path==='/admin/commands/ack'){
     if(!['done','rejected'].includes(data.status)||!['','invalid','expired','pointsChanged','correctionChanged','accessChanged'].includes(data.result||''))return reply({error:'Ungültiger Abschluss.'},400);
     await env.DB.prepare("UPDATE commands SET status=?,result=?,envelope='' WHERE alias=? AND revision=? AND id=? AND status='pending'").bind(data.status,data.result||'',data.alias,data.revision,data.id).run();return reply({ok:true});
    }
    const envelope=JSON.stringify(data.envelope);if(data.envelope?.version!==1||typeof data.envelope.iv!=='string'||data.envelope.iv.length!==16||typeof data.envelope.data!=='string'||data.envelope.data.length!==5484)return reply({error:'Ungültige verschlüsselte Buchung.'},400);
    const digest=await hash(envelope);if(old)return equal(digest,old.digest)?reply({status:old.status,result:old.result}):reply({error:'Vorgangsnummer bereits verwendet.'},409);
    const now=Date.now();const result=await env.DB.prepare("INSERT OR IGNORE INTO commands(alias,revision,id,envelope,digest,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM commands WHERE alias=? AND status='pending')<30 AND NOT EXISTS(SELECT 1 FROM commands WHERE alias=? AND created_at>?)").bind(data.alias,data.revision,data.id,envelope,digest,now,data.alias,data.alias,now-2000).run();
    if(!result.meta.changes)return reply({error:'Bitte kurz warten oder offene Vorgänge synchronisieren lassen.'},429);
    return reply({status:'pending'});
   }
   if(path==='/subscribe'||path==='/unsubscribe'){
    if(!equal(auth,await capability(env,data.alias,record.revision)))return reply({error:'Dieser Erinnerungszugang ist abgelaufen. Bitte den QR-Code erneut scannen.'},401);
    const url=endpoint(data.endpoint),id=await hash(url);
    if(path==='/unsubscribe'){await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(id,data.alias).run();return reply({ok:true});}
    const old=await env.DB.prepare('SELECT alias FROM devices WHERE id=?').bind(id).first();if(old&&old.alias!==data.alias)return reply({error:'Auf diesem Handy ist bereits ein anderes Konto verknüpft. Bitte dort zuerst Erinnerungen deaktivieren.'},409);
    const result=await env.DB.prepare('INSERT INTO devices(id,alias,revision,endpoint) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE alias=?)<5 ON CONFLICT(id) DO UPDATE SET revision=excluded.revision').bind(id,data.alias,record.revision,url,data.alias).run();
    if(!result.meta.changes&&!old)return reply({error:'Maximal fünf Geräte je Deckel. Bitte ein altes Gerät deaktivieren.'},409);
    return reply({ok:true});
   }
   if(path==='/admin/status'){const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM devices WHERE alias=? AND revision=?').bind(data.alias,record.revision).first();return reply({devices:row.count,lastSent:record.last_sent||null});}
   if(path==='/admin/send'){
    if(!REV.test(data.requestId||''))return reply({error:'Versandkennung ungültig.'},400);
    const previous=await env.DB.prepare('SELECT status, accepted, failed FROM sends WHERE id=? AND alias=?').bind(data.requestId,data.alias).first();if(previous)return reply({duplicate:true,...previous});
    const devices=(await env.DB.prepare('SELECT id,endpoint FROM devices WHERE alias=? AND revision=? LIMIT 5').bind(data.alias,record.revision).all()).results;
    if(!devices.length)return reply({error:'Das Mitglied hat noch keine Erinnerungen aktiviert.'},409);
    const now=Date.now();
    // Atomic cooldown. Only manual admin requests can reserve a send.
    const reserved=await env.DB.prepare('UPDATE accounts SET last_sent=? WHERE alias=? AND last_sent<?').bind(now,data.alias,now-60000).run();if(!reserved.meta.changes)return reply({error:'Bitte mindestens eine Minute bis zur nächsten Erinnerung warten.'},429);
    await env.DB.prepare("INSERT INTO sends(id,alias,status,accepted,failed,created_at) VALUES(?,?,'pending',0,0,?)").bind(data.requestId,data.alias,now).run();
    let accepted=0,failed=0;
    for(const device of devices){
     try{const url=endpoint(device.endpoint);const response=await fetch(url,{method:'POST',headers:{Authorization:await vapid(env,url),TTL:'86400',Urgency:'normal',Topic:'deckel-reminder'},body:null,redirect:'manual',signal:AbortSignal.timeout(8000)});
      if(response.ok)accepted++;else {
       failed++;
       // Only protocol errors, never endpoints, account IDs or credentials.
       let reason='';try{const error=await response.json();const known=['BadAuthorizationHeader','BadJwtToken','BadVapidPublicKey','BadTtl','BadTopic','BadUrgency','BadCryptoKey','BadEncryption','BadContentEncoding','BadRequest','PayloadTooLarge','ExpiredToken','Unregistered','NotFound','Forbidden','TooManyRequests'];if(known.includes(error.reason))reason=error.reason;}catch{}
       console.warn('Deckel-Push abgelehnt',JSON.stringify({httpStatus:response.status,...(reason?{reason}:{})}));
       if([404,410].includes(response.status))await env.DB.prepare('DELETE FROM devices WHERE id=? AND alias=?').bind(device.id,data.alias).run();
      }
     }catch(error){
      failed++;
      const knownNames=['Error','TypeError','SyntaxError','DataError','OperationError','InvalidAccessError','NotSupportedError','TimeoutError','AbortError'];
      const message=String(error?.message||'');
      const reason=!/^B[A-Za-z0-9_-]{86}$/.test(env.VAPID_PUBLIC_KEY)?'public-key-format':
       /header/i.test(message)?'header':
       /JWK|key data|private key/i.test(message)?'signing-key':
       /timeout.*not a function/i.test(message)?'timeout-api':
       /network connection lost/i.test(message)?'connection-lost':
       /DNS|resolve hostname|name resolution/i.test(message)?'dns':
       /TLS|SSL|certificate/i.test(message)?'tls':
       /redirect/i.test(message)?'redirect':
       /fetch failed/i.test(message)?'fetch-failed':'unknown';
      console.warn('Deckel-Push Netzwerkfehler',JSON.stringify({code:['TimeoutError','AbortError'].includes(error?.name)?'timeout':'network',name:knownNames.includes(error?.name)?error.name:'unknown',reason}));
     }
    }
    const status=accepted?'accepted':'failed';await env.DB.prepare('UPDATE sends SET status=?,accepted=?,failed=? WHERE id=?').bind(status,accepted,failed,data.requestId).run();
    await env.DB.prepare('DELETE FROM sends WHERE created_at<?').bind(now-30*86400000).run();
    return reply({status,accepted,failed});
   }
   return reply({error:'Nicht gefunden.'},404);
  }catch(error){return reply({error:error.message?.startsWith('Ungültig')||error.message==='Geräte-Adresse wird nicht unterstützt.'?error.message:'Dienst derzeit nicht erreichbar. Bitte später erneut prüfen.'},400);}
 }
};
