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
  return {version:1,balance:totals.balance,credit:r.prepaid,pointUnits:r.pointUnits,thresholdCents:r.threshold,progressCents:r.progress,awardUnits:M.award(p),beerUnits:M.pointCost(p,'beer'),wineUnits:M.pointCost(p,'wine'),needed:r.needed,bonusCents:M.award(p),updatedAt:new Date().toISOString(),...(undo.count?{undo:{targetId:undo.targetId}}:{}),bookings:a.bookings.slice(-5).reverse().map(b=>({type:b.type,cents:b.cents,createdAt:b.createdAt,...((b.type==='payment'&&state.reversedPayments.has(b.id)||b.type==='bonus'&&state.reversedPayments.has(b.paymentId)||b.type==='drinks'&&state.drinks.get(b.id)?.count===0)?{cancelled:true}:{}),...(['drinks','correction'].includes(b.type)?{count:b.count,...(b.pointUnits?{pointUnits:b.pointUnits}:{}),...((b.drink==='wine'||b.type==='correction'&&a.bookings.find(t=>t.id===b.targetId)?.drink==='wine')?{drink:'wine'}:{})}:b.type==='payment'?{method:b.method}:{})}))};
 }
 g.DrinksLedger={apply,snapshot};
})(globalThis);
