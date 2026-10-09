/* Getränke auf dem gemeinsamen iPad. PINs/Buchungen werden nur in OneDrive gespeichert. */
(function(global){
  'use strict';
  const M=global.DrinksModel,S=global.DrinksStore;
  const euro=cents=>(cents/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  let root,people=[],account=null,memberId='',signature='',draft=0,wineDraft=0,method='cash',payment=0,pending=null,busy=false,pinChecking=false,loaded=false,currentScreen='members',lockAfterRun=false,bookedNotice='',timer,attempts=new Map(),openNumber=0;
  let cardIntent=null,cardQueue=[],cardWorking=false,cardError=null,cardNotices=new Map(),cardSessions=new Map(),cardNodes=new Map(),sessionTimer;
  let accountSource='',paidTimer,draftOrder=[];
  const cardDrafts=new Map();let confirmRequested=false;
  const stagedCount=()=>Array.from(cardDrafts.values()).reduce((n,d)=>n+d.entries.length,0);
  function appendGlasses(row,beer,wine,limit=Infinity){
    row.replaceChildren();
    for(const [kind,count] of [['beer',beer],['wine',wine]]){
      for(let i=0;i<Math.min(limit,Math.floor(count/5));i++){const img=document.createElement('img');img.className=kind==='wine'?'dr-keg dr-wine-keg':'dr-keg';img.src='assets/drinks/bierfass.webp';img.alt=kind==='wine'?'Weinfass · 5 Gläser':'Bierfass · 5 Striche';row.append(img);}
      if(Math.floor(count/5)>limit){const more=document.createElement('small');more.className='dr-glasses-more';more.textContent='+'+(Math.floor(count/5)-limit)+(kind==='wine'?' Weinfässer':' Bierfässer');row.append(more);}
      for(let i=0;i<count%5;i++){const glass=document.createElement('span');glass.textContent=kind==='wine'?'🍷':'🍺';glass.setAttribute('aria-hidden','true');row.append(glass);}
    }
  }
  const draftCount=()=>draft+wineDraft;
  const draftCents=()=>draft*M.PRICE+wineDraft*M.WINE_PRICE;
  const draftText=()=>wineDraft?`${draft} Bierstriche · ${wineDraft} Wein`:`${draft} neue Striche`;
  const el=id=>byId('dr-'+id);
  const name=id=>people.find(p=>p.id===id)?.name||'Mitglied';
  const message=text=>{if(el('error'))el('error').textContent=text||'';};
  function screen(value){if(value!=='paid')clearTimeout(paidTimer);root.querySelector('.dr-account-tools')?.removeAttribute('open');currentScreen=value;root.dataset.screen=value;root.querySelectorAll('[data-dr-screen]').forEach(e=>e.hidden=e.dataset.drScreen!==value);message('');touch();}
  function lockAccount(all=true){
    if(all)clearCardSessions();else{cardSessions.delete(memberId);renderCards();}clearTimeout(timer);if(!memberId||root.hidden)return;
    if(busy){lockAfterRun=true;return;}
    if(!account?.pin){clearMobileQr();clearPinInputs();return;}
    signature='';clearMobileQr();clearPinInputs();el('pin').value='';updatePinDots();screen('pin');
    message(pending?'Konto gesperrt. Nach deiner PIN-Eingabe dieselbe Buchung erneut prüfen.':draftCount()?'Konto gesperrt. Deine '+draftCount()+' ungespeicherten Getränke bleiben bis zum Neuladen erhalten. PIN eingeben, um fortzufahren.':'Konto gesperrt. Bitte deine PIN erneut eingeben.');
  }
  function touch(){clearTimeout(timer);if(memberId&&signature&&account?.pin&&!busy){rememberCardSession(memberId,account,signature);timer=setTimeout(()=>lockAccount(false),60000);}}
  function clearPinInputs(){for(const id of ['own-current','own-new','own-repeat'])if(el(id))el(id).value='';}
  function clearMobileQr(){if(el('mobile-qr')){el('mobile-qr').width=1;el('mobile-qr').height=1;}}
  function resetSession(){clearTimeout(paidTimer);global.DrinksExtras?.dismiss?.();cardIntent=null;clearTimeout(timer);clearMobileQr();memberId='';account=null;signature='';draft=0;wineDraft=0;draftOrder=[];payment=0;pending=null;bookedNotice='';if(el('pin'))el('pin').value='';clearPinInputs();setPinChecking(false);}
  function reset(){cardDrafts.clear();confirmRequested=false;clearCardSessions();cardNotices.clear();openNumber++;loaded=false;people=[];resetSession();S.reset();if(root){renderPeople();renderRanking();screen('members');el('status').textContent='Bitte OneDrive verbinden und Getränke neu öffnen.';}}
  function beforeView(view){
    if(!root||root.hidden||view==='drinksView')return true;
    if(busy||pending||cardQueue.length){showToast('Die Getränkebuchung bitte zuerst fertig speichern oder erneut prüfen.','error');return false;}
    const pinDraft=['own-current','own-new','own-repeat'].some(id=>el(id)?.value);
    if((draftCount()||stagedCount()||pinDraft)&&!confirm('Striche oder PIN-Eingaben sind noch nicht gespeichert. Verwerfen und Getränke verlassen?'))return false;
    cardDrafts.clear();clearCardSessions();resetSession();return true;
  }
  function clearCardSessions(){clearTimeout(sessionTimer);cardSessions.clear();renderCards();}
  function cardUnlocked(id,value){const session=cardSessions.get(id);return !value.pin||Boolean(session&&session.until>Date.now()&&session.signature===JSON.stringify(value.pin));}
  function rememberCardSession(id,value,sig){
    if(!value.pin){cardSessions.delete(id);return;}
    if(document.hidden||root.hidden||lockAfterRun)return;
    cardSessions.set(id,{signature:sig,until:Date.now()+60000});scheduleCardLocks();
  }
  function scheduleCardLocks(){
    clearTimeout(sessionTimer);const until=Math.min(...Array.from(cardSessions.values(),s=>s.until));
    if(!Number.isFinite(until))return;
    sessionTimer=setTimeout(()=>{for(const [id,s] of cardSessions)if(s.until<=Date.now())cardSessions.delete(id);renderCards();scheduleCardLocks();},Math.max(1,until-Date.now()));
  }
  function renderPeople(){
    const container=el('members');container.replaceChildren();cardNodes.clear();const query=el('search').value.toLocaleLowerCase('de-DE');
    for(const p of people.filter(p=>p.name.toLocaleLowerCase('de-DE').includes(query))){
      const card=document.createElement('article');card.className='dr-member-card';card.dataset.drCard=p.id;
      const heading=document.createElement('div');heading.className='dr-member-heading';
      const title=document.createElement('h3');title.textContent=p.name;
      const more=document.createElement('button');more.type='button';more.className='dr-member-more';more.dataset.drMember=p.id;more.dataset.drCardAction='account';more.textContent='⋯';more.setAttribute('aria-label','Mein Konto von '+p.name);heading.append(title,more);
      const label=document.createElement('span');label.className='dr-muted';label.textContent='Schulden';
      const balance=document.createElement('strong');balance.className='dr-member-balance';
      const credit=document.createElement('small');credit.className='dr-member-credit';
      const bonus=document.createElement('p');bonus.className='dr-member-bonus';
      const progress=document.createElement('progress');progress.className='dr-member-progress';progress.setAttribute('aria-label','Fortschritt zum nächsten Treuebonus');
      const todayLabel=document.createElement('small');todayLabel.className='dr-member-today-label';
      const glasses=document.createElement('div');glasses.className='dr-member-glasses';
      const draftLabel=document.createElement('p');draftLabel.className='dr-member-draft-label';
      const draftGlasses=document.createElement('div');draftGlasses.className='dr-member-glasses dr-member-staged';
      const undo=document.createElement('button');undo.type='button';undo.className='dr-member-undo';undo.dataset.drMember=p.id;undo.dataset.drCardAction='undo';
      const lock=document.createElement('span');lock.className='dr-member-lock';
      const actions=document.createElement('div');actions.className='dr-member-actions';
      const add=document.createElement('button');add.type='button';add.className='dr-primary';add.dataset.drMember=p.id;add.dataset.drCardAction='add';add.textContent='🍺 +1 Strich · 1,50 €';add.setAttribute('aria-label','Ein Getränk für '+p.name+' buchen');
      const pay=document.createElement('button');pay.type='button';pay.dataset.drMember=p.id;pay.dataset.drCardAction='pay';pay.textContent='Bezahlen';pay.setAttribute('aria-label','Deckel von '+p.name+' bezahlen');const wine=document.createElement('button');wine.type='button';wine.className='dr-wine';wine.dataset.drMember=p.id;wine.dataset.drCardAction='wine';wine.textContent='🍷 +1 Wein · 3,00 €';wine.setAttribute('aria-label','Ein Glas Wein für '+p.name+' buchen');actions.append(add,wine,pay);
      const status=document.createElement('p');status.className='dr-member-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      const retry=document.createElement('button');retry.type='button';retry.className='dr-member-retry';retry.dataset.drMember=p.id;retry.dataset.drCardAction='retry';retry.textContent='Speicherung erneut prüfen';retry.hidden=true;
      card.append(heading,label,balance,credit,bonus,progress,todayLabel,glasses,lock,actions,draftLabel,draftGlasses,undo,status,retry);container.append(card);cardNodes.set(p.id,{card,balance,credit,bonus,progress,todayLabel,glasses,draftLabel,draftGlasses,undo,lock,add,wine,pay,more,status,retry});
    }
    if(!container.children.length){const p=document.createElement('p');p.textContent=people.length?'Kein Mitglied gefunden. Suche nach Vor- oder Nachname.':loaded?'Noch keine Mitglieder vorhanden. Namen unter Einstellungen → Mitglieder anlegen.':'Mitglieder werden aus OneDrive geladen.';container.append(p);}
    renderCards();
  }
  function renderCards(){
    for(const [id,n] of cardNodes){
      const value=S.cached(id),unlocked=cardUnlocked(id,value),balance=M.totals(value).balance;
      n.balance.textContent=euro(balance);const credit=M.rewardState?.(value,S.cachedRewards?.()).credit||0;n.credit.hidden=!credit;n.credit.textContent=credit?'Gutschrift: '+euro(credit):'';
      const policy=S.cachedRewards?.(),reward=policy?M.rewardState(value,policy):null;n.bonus.hidden=n.progress.hidden=!reward;
      if(reward){n.bonus.textContent=global.DrinksRewards?.remainingText(reward,policy)||'Noch '+euro(reward.needed)+' bis zum nächsten Bonus.';n.progress.max=reward.threshold;n.progress.value=Math.min(reward.progress,reward.threshold);}
      const today=M.today(value);n.todayLabel.hidden=n.glasses.hidden=!today.count;n.todayLabel.textContent='Heute gebucht: '+today.beerCount+' Bierstriche · '+today.wineCount+' Wein';n.glasses.replaceChildren();n.glasses.setAttribute('aria-label',n.todayLabel.textContent);
      appendGlasses(n.glasses,today.beerCount,today.wineCount,3);
      const staged=cardDrafts.get(id),entries=staged?.entries||[],beer=entries.filter(x=>x==='beer').length,wine=entries.length-beer,cents=beer*M.PRICE+wine*M.WINE_PRICE;
      n.draftLabel.hidden=n.draftGlasses.hidden=!entries.length;n.draftLabel.textContent=entries.length?`Vorgemerkt: ${beer} Bier · ${wine} Wein · ${euro(cents)}. Schulden nach OK: ${euro(balance+Math.max(0,cents-credit))}`:'';
      appendGlasses(n.draftGlasses,beer,wine,3);n.draftGlasses.setAttribute('aria-label',n.draftLabel.textContent);
      n.undo.hidden=!today.count&&!entries.length;n.undo.textContent='Eintrag rückgängig machen';n.undo.disabled=!loaded||busy||Boolean(pending)||Boolean(cardQueue.length);
      n.lock.hidden=!value.pin;n.lock.textContent=value.pin?(unlocked?'🔓 Entsperrt':'🔒 PIN geschützt'):'';
      const queued=cardQueue.filter(q=>q.memberId===id).reduce((n,q)=>n+q.bookings.length,0),failed=Boolean(cardError&&cardQueue[0]?.memberId===id);
      n.card.dataset.saving=String(Boolean(queued&&!failed));n.card.dataset.failed=String(failed);
      n.status.textContent=failed?'Speicherung nicht bestätigt. '+cardError.message:queued?queued+' Getränk'+(queued===1?' wird':'e werden')+' gespeichert …':entries.length?'Noch nicht gespeichert. Mit OK bestätigen.':cardNotices.get(id)||'';
      n.retry.hidden=!failed;n.retry.disabled=busy;n.retry.textContent=cardError?.code==='pinChanged'?'Mit PIN entsperren & erneut prüfen':'Speicherung erneut prüfen';
      n.add.disabled=!loaded||busy||Boolean(cardError)||Boolean(pending)||Boolean(cardQueue.length);
      n.wine.disabled=n.add.disabled;
      n.pay.disabled=!loaded||busy||Boolean(pending)||Boolean(cardQueue.length)||Boolean(stagedCount())||balance<=0;
      n.more.disabled=!loaded||busy||Boolean(pending)||Boolean(cardQueue.length)||Boolean(stagedCount());
    }
  }
  function queueDrink(id,sig,wine=false){
    let staged=cardDrafts.get(id);if(!staged){staged={entries:[],signature:sig,sourceKey:S.sourceKey?.()||''};cardDrafts.set(id,staged);}
    if(staged.entries.length>=1000){showToast('Bitte diese Sammlung zuerst mit OK speichern.','error');return;}
    staged.signature=sig;staged.entries.push(wine?'wine':'beer');render();
  }
  function undoStaged(id){const staged=cardDrafts.get(id);if(!staged?.entries.length)return false;staged.entries.pop();if(!staged.entries.length)cardDrafts.delete(id);render();return true;}
  function confirmCards(){
    if(busy||pending||cardQueue.length||!stagedCount())return;
    for(const [id] of cardDrafts){const value=S.cached(id);if(!cardUnlocked(id,value)){selectCard(id,'confirm');return;}}
    const createdAt=new Date().toISOString();
    for(const [id,staged] of cardDrafts){const bookings=staged.entries.map(drink=>({id:crypto.randomUUID(),type:'drinks',count:1,...(drink==='wine'?{drink:'wine'}:{}),cents:drink==='wine'?M.WINE_PRICE:M.PRICE,createdAt}));cardQueue.push({memberId:id,signature:staged.signature,sourceKey:staged.sourceKey,bookings});}
    render();flushCards();
  }
  async function flushCards(){
    if(busy||cardWorking||cardError||!cardQueue.length)return;
    cardWorking=true;busy=true;render();
    try{
      while(cardQueue.length){
        const next=cardQueue[0];
        try{
          const saved=await S.bookMany(next.memberId,next.bookings,next.signature,next.sourceKey);
          cardQueue.shift();cardDrafts.delete(next.memberId);cardNotices.set(next.memberId,'Gespeichert ✓');rememberCardSession(next.memberId,saved,next.signature);
          if(memberId===next.memberId)account=saved;renderCards();
        }catch(error){cardError=error;if(error.code==='pinChanged')cardSessions.delete(next.memberId);break;}
      }
    }finally{cardWorking=false;busy=false;render();if(lockAfterRun){lockAfterRun=false;lockAccount();}}
  }
  function returnToCards(){resetSession();screen('members');renderCards();}
  async function performCardIntent(){
    const intent=cardIntent;cardIntent=null;if(!intent){screen(pending?.type==='payment'?method:'account');return;}
    const id=memberId,sig=signature;
    if(['add','wine'].includes(intent.action)){returnToCards();queueDrink(id,sig,intent.action==='wine');}
    else if(intent.action==='confirm'){if(cardDrafts.has(id))cardDrafts.get(id).signature=sig;returnToCards();confirmRequested=true;}
    else if(intent.action==='retry'){if(cardQueue[0]?.memberId!==id)throw new Error('Bitte die ausstehende Buchung erneut prüfen.');cardQueue[0].signature=sig;cardError=null;returnToCards();}
    else if(intent.action==='undo'){if(cardDrafts.has(id))cardDrafts.get(id).signature=sig;if(undoStaged(id)){returnToCards();return;}screen('account');await undoToday();cardNotices.set(id,'Heutiges Getränk korrigiert ✓');returnToCards();}
    else if(intent.action==='pay')await beginPayment('cash',true);
    else screen('account');
  }
  function selectCard(id,action='account'){
    if(!loaded||pending||busy)return;
    if(action==='undo'&&!cardQueue.length&&cardUnlocked(id,S.cached(id))&&undoStaged(id))return;
    if(['add','wine'].includes(action)&&!cardError){
      const value=S.cached(id);if(cardUnlocked(id,value)){queueDrink(id,JSON.stringify(value.pin),action==='wine');return;}
    }
    if(cardQueue.length&&action!=='retry')return;
    memberId=id;draft=0;wineDraft=0;draftOrder=[];account=null;signature='';el('pin').value='';cardIntent={action};screen('opening');
    run(async()=>{account=await S.read(id);accountSource=S.sourceKey?.()||'';if(account.pin&&!cardUnlocked(id,account)){screen('pin');}else{signature=JSON.stringify(account.pin);rememberCardSession(id,account,signature);await performCardIntent();}el('status').textContent='Aktuell aus OneDrive geladen.';}).then(()=>{if(currentScreen==='pin')el('pin').focus();});
  }
  function renderRanking(){
    const list=el('ranking');list.replaceChildren();
    if(!loaded){const p=document.createElement('li');p.textContent='Wird aus OneDrive geladen …';list.append(p);return;}
    const ranked=people.map(p=>({...p,balance:M.totals(S.cached(p.id)).balance})).filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance||a.name.localeCompare(b.name,'de')).slice(0,3);
    if(!ranked.length){const p=document.createElement('li');p.textContent='Alle Deckel bezahlt. Prost! 🍻';list.append(p);return;}
    ranked.forEach((p,index)=>{
      const row=document.createElement('li');row.className='dr-rank-row';
      const medal=document.createElement('span');medal.className='dr-medal';medal.textContent=['🥇','🥈','🥉'][index];medal.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.className='dr-rank-name';label.textContent=p.name;
      const amount=document.createElement('strong');amount.className='dr-rank-money';amount.textContent=euro(p.balance);
      const track=document.createElement('span');track.className='dr-rank-track';track.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.className='dr-rank-fill';fill.style.width=(p.balance/ranked[0].balance*100)+'%';track.append(fill);
      row.append(medal,label,amount,track);list.append(row);
    });
  }
  function render(animate=false){
    const totals=account?M.totals(account):{balance:0,count:0};const reward=global.DrinksRewards?.render(account,draft,wineDraft)||{credit:0};const projected=totals.balance+Math.max(0,draftCents()-reward.credit);root.querySelectorAll('[data-dr-person]').forEach(e=>e.textContent=name(memberId));
    if(el('mobile-status'))el('mobile-status').textContent=global.DrinksMobile?.status(memberId)||'';
    for(const id of ['mobile-open','mobile-back','mobile-refresh','mobile-rotate'])if(el(id))el(id).disabled=busy||Boolean(pending);
    renderRecent();root.querySelectorAll('[data-dr-booked-notice]').forEach(node=>{node.hidden=!bookedNotice;node.textContent=bookedNotice;});el('dock-summary').textContent=draftCount()?draftText()+' · Noch nicht gespeichert · Danach offen: '+euro(projected):'Gespeicherter Deckel: '+euro(totals.balance);
    if(el('mobile-retry')){el('mobile-retry').hidden=!global.DrinksMobile?.status(memberId).includes('noch nicht aktualisiert');el('mobile-retry').disabled=busy||Boolean(pending);}
    el('balance').textContent=euro(totals.balance);el('count').textContent=totals.count+' bisher gebuchte Getränke';el('draft-count').textContent=draftText()+(draftCount()?' · Noch nicht gespeichert':'');el('draft-amount').textContent=euro(draftCents());el('total').textContent=euro(projected);
    const beerRow=el('beers');appendGlasses(beerRow,draft,wineDraft);
    if(animate)beerRow.lastElementChild?.classList.add('dr-beer-pop');
    const today=account&&M.today?M.today(account):{count:0};
    if(el('today-count'))el('today-count').textContent=today.count+' heute gespeicherte Getränke';
    if(el('today-undo')){el('today-undo').disabled=busy||Boolean(pending&&pending.type!=='correction')||(!today.count&&!pending);el('today-undo').textContent=pending?.type==='correction'?'Korrektur erneut prüfen':'Eintrag rückgängig machen';}
    el('partial').disabled=busy||Boolean(pending)||Boolean(draftCount())||projected<=0;root.querySelectorAll('[data-dr-digit],[data-dr-method],[data-dr-edit-amount]').forEach(b=>b.disabled=busy||Boolean(pending));
    el('minus').disabled=busy||Boolean(pending)||!draftCount();el('reset').disabled=busy||Boolean(pending)||!draftCount();el('add').disabled=busy||Boolean(pending);if(el('wine-add'))el('wine-add').disabled=busy||Boolean(pending);if(el('wine-minus'))el('wine-minus').disabled=busy||Boolean(pending)||!wineDraft;el('save').disabled=busy||pending?.type==='correction';el('cancel').disabled=busy||Boolean(pending);
    root.querySelectorAll('[data-dr-pay]').forEach(b=>{b.disabled=busy||Boolean(pending)||Boolean(draftCount())||projected<=0;b.textContent=(b.dataset.drPay==='cash'?'alles bar':'alles per PayPal');});
    root.querySelectorAll('[data-dr-payment]').forEach(e=>e.textContent=euro(payment));
    root.querySelectorAll('[data-dr-rest]').forEach(e=>e.textContent='Danach bleiben '+euro(Math.max(0,totals.balance-payment))+' offen.');
    el('paypal-change').disabled=busy||Boolean(pending);el('pin').disabled=busy;el('pin-back').disabled=busy||Boolean(pending);el('available').textContent=euro(totals.balance);
    root.querySelectorAll('[data-dr-amount]').forEach(b=>b.disabled=busy||totals.balance<=0||(b.dataset.drAmount!=='all'&&Number(b.dataset.drAmount)>totals.balance));
    el('cash-confirm').disabled=busy;el('paypal-confirm').disabled=busy;el('pay-submit').disabled=busy;
    el('cash-cancel').disabled=busy||Boolean(pending);el('paypal-cancel').disabled=busy||Boolean(pending);el('refresh').disabled=busy;
    el('own-open').disabled=busy||Boolean(pending);el('own-save').disabled=busy;el('own-back').disabled=busy;el('own-remove').disabled=busy;
    const protectedAccount=Boolean(account?.pin);
    el('own-open').textContent=protectedAccount?'Meine PIN verwalten':'PIN freiwillig einrichten';
    el('own-title').textContent=protectedAccount?'Meine PIN verwalten':'PIN freiwillig einrichten';
    el('own-current-row').hidden=!protectedAccount;el('own-current').required=protectedAccount;
    el('own-remove').hidden=!protectedAccount;
    el('save').textContent=pending?.type==='drinks'?'Speicherung erneut prüfen':busy?'Wird gespeichert …':draftCount()?'OK · '+draftCount()+' Getränke speichern':'Zurück zu Getränkekarten';
    el('cash-confirm').textContent=pending?.type==='payment'?'Speicherung erneut prüfen':'Geld in die Kasse gelegt';el('paypal-confirm').textContent='Fertig · Eingang wird geprüft';
    renderCards();
    const stagedTotal=stagedCount();if(el('main-confirm')){el('main-confirm').hidden=!stagedTotal&&!cardQueue.length;el('main-summary').textContent=cardError?'Speicherung nicht bestätigt. Bitte auf der betroffenen Karte erneut prüfen.':cardQueue.length?'Einträge werden gespeichert …':stagedTotal+' Einträge für '+cardDrafts.size+' Mitglied'+(cardDrafts.size===1?'':'er')+' · Noch nicht gespeichert';el('confirm').disabled=busy||Boolean(pending)||Boolean(cardQueue.length)||!stagedTotal;el('confirm').textContent=busy?'Wird gespeichert …':'OK · Einträge speichern';}
    if(currentScreen==='members')renderRanking();touch();
  }
  async function run(action){if(busy)return;busy=true;message('');render();try{await action();}catch(error){
    if(currentScreen==='opening'){screen('members');el('status').textContent='Konto konnte nicht geöffnet werden. Bitte deinen Namen erneut wählen.';}
    if(['balanceChanged','correctionChanged','conflict'].includes(error.code)||[400,403,404].includes(error.status))pending=null;
    if(error.code==='pinChanged'){signature='';el('pin').value='';account=await S.read(memberId).catch(()=>account);if(account?.pin)screen('pin');else{signature=JSON.stringify(null);screen('account');}}
    if(error.code==='balanceChanged'){account=await S.read(memberId).catch(()=>account);payment=0;screen('account');}
    if(error.code==='correctionChanged'){account=await S.read(memberId).catch(()=>account);screen('account');}
    message(error.message||'OneDrive ist nicht erreichbar. Bitte erneut versuchen.');
  }finally{busy=false;render();if(lockAfterRun){lockAfterRun=false;lockAccount();}flushCards();if(confirmRequested){confirmRequested=false;confirmCards();}}}
  async function open(){
    if(busy||pending||(cardQueue.length&&!cardError)){showToast('Die aktuelle Buchung bitte zuerst fertig speichern.','error');return;}
    if((draftCount()||stagedCount())&&!confirm('Neue Einträge verwerfen und zur Namensauswahl zurückkehren?'))return;
    if(showView('drinksView')===false)return;cardDrafts.clear();clearCardSessions();cardNotices.clear();resetSession();screen('members');el('search').value='';loaded=false;renderPeople();renderRanking();el('status').textContent='Mitglieder und Getränkekonten werden aus OneDrive geladen …';
    const number=++openNumber;
    await run(async()=>{
      const data=await oneDriveReadState();
      if(!data||!Array.isArray(data.members))throw new Error('Die Mitgliederdatei in OneDrive ist nicht lesbar.');
      const next=data.members.map(p=>({id:String(p.id||''),name:[p.lastName,p.firstName].filter(Boolean).join(', ')}));
      if(next.some(p=>!p.id||!p.name)||new Set(next.map(p=>p.id)).size!==next.length)throw new Error('Die Mitglieder benötigen eindeutige Kennungen und Namen.');
      await S.rewards();await S.list(next.map(p=>p.id));if(number!==openNumber)return;
      global.DrinksMobile?.refreshAll().catch(()=>{});people=next.sort((a,b)=>a.name.localeCompare(b.name,'de'));loaded=true;renderPeople();el('status').textContent='Aktuell aus OneDrive geladen.';renderRanking();
    });
    if(!loaded)el('status').textContent='Getränke konnten nicht geladen werden. OneDrive-Verbindung prüfen und aktualisieren.';
    renderPeople();
  }
  async function commitDraft(){
    if(!draftCount()&&!pending)return 0;
    const count=pending?.count||draftCount();
    if(pending&&pending.type!=='drinks')throw new Error('Bitte zuerst die Zahlung fertig speichern.');
    if(!pending){const createdAt=new Date().toISOString();pending={type:'drinks',count:draftCount(),bookings:draftOrder.map(drink=>({id:crypto.randomUUID(),type:'drinks',count:1,...(drink==='wine'?{drink:'wine'}:{}),cents:drink==='wine'?M.WINE_PRICE:M.PRICE,createdAt}))};}
    account=await S.bookMany(memberId,pending.bookings,signature,accountSource);pending=null;draft=0;wineDraft=0;draftOrder=[];return count;
  }
  async function undoToday(){
    if(!signature||!account)throw new Error('Bitte zuerst dein Getränkekonto öffnen.');
    if(!pending){const target=M.today(account);if(!target.count)throw new Error('Heute sind keine Striche mehr zurückzunehmen.');pending={id:crypto.randomUUID(),type:'correction',targetId:target.targetId,count:1,...(target.drink==='wine'?{drink:'wine'}:{}),cents:target.price,createdAt:new Date().toISOString()};}
    if(pending.type!=='correction')throw new Error('Bitte zuerst die ausstehende Buchung speichern.');
    account=await S.book(memberId,pending,signature,accountSource);pending=null;bookedNotice='Ein heutiges Getränk wurde zurückgenommen und in OneDrive gespeichert.';showToast('Heutiges Getränk korrigiert.');
  }
  function amountScreen(){
    el('payment-title').textContent='Teilbetrag bezahlen';el('pay-submit').textContent=method==='cash'?'Weiter zur Bestätigung':'Zahlungslink anzeigen';
    root.querySelectorAll('[data-dr-method]').forEach(b=>{b.classList.toggle('dr-primary',b.dataset.drMethod===method);b.setAttribute('aria-pressed',String(b.dataset.drMethod===method));});
    screen('amount');
  }
  async function beginPayment(value,partial=false){
    if(draftCount())throw new Error('Bitte neue Einträge zuerst mit OK bestätigen.');
    account=await S.read(memberId);if(JSON.stringify(account.pin)!==signature)throw Object.assign(new Error('Deine PIN wurde geändert. Bitte erneut anmelden.'),{code:'pinChanged'});
    const balance=M.totals(account).balance;if(balance<=0)throw new Error('Dein Deckel ist bereits bezahlt.');
    method=value;payment=partial?0:balance;el('amount').value=(balance/100).toFixed(2).replace('.',',');
    if(partial)amountScreen();else {if(method==='paypal')showPaypal();screen(method);}
  }
  function showPaypal(){
    const url=M.paypalUrl(payment),qr=qrcode(0,'M');qr.addData(url);qr.make();
    const canvas=el('qr'),count=qr.getModuleCount(),unit=8,quiet=4;canvas.width=canvas.height=(count+quiet*2)*unit;
    const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#000000';
    for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))context.fillRect((c+quiet)*unit,(r+quiet)*unit,unit,unit);
    el('paypal-link').href=url;el('paypal-link').textContent='Auf diesem Gerät öffnen';
  }
  async function confirmPayment(){
    if(!payment||!signature)throw new Error('Bitte einen Zahlungsbetrag wählen.');
    if(!pending)pending={id:crypto.randomUUID(),type:'payment',cents:payment,method,confirmation:'member',createdAt:new Date().toISOString()};
    if(pending.type!=='payment')throw new Error('Bitte zuerst die Striche speichern.');
    const bookingId=pending.id;account=await S.book(memberId,pending,signature,accountSource);pending=null;
    const bonus=account.bookings.find(b=>b.type==='bonus'&&b.paymentId===bookingId)?.cents||0;el('paid-bonus').hidden=!bonus;el('paid-bonus').textContent=bonus?'Treuebonus erreicht: '+euro(bonus)+' Gutschrift für deine nächsten Getränke!':'';
    el('paid-method').textContent=method==='cash'?'Bar · vom Mitglied bestätigt':'PayPal · vom Mitglied bestätigt';el('paid-balance').textContent=euro(M.totals(account).balance);screen('paid');if(M.totals(account).balance===0){
      const paidMember=memberId;
      const finishPaid=()=>{if(currentScreen!=='paid'||memberId!==paidMember)return;if(busy){paidTimer=setTimeout(finishPaid,50);return;}finishSession();};
      // The confirmed-payment flow owns its timeout even if the animation cannot run.
      paidTimer=setTimeout(finishPaid,bonus?4500:3000);
      try{global.DrinksExtras?.celebrate(bonus,finishPaid);}catch{}
    }
  }
  function adminFields(member){return `<fieldset class="dr-pin-editor"><legend>Getränke-PIN</legend><p>Die Getränke-PIN ist freiwillig. Mitglieder können sie unter „Mein Konto“ selbst einrichten oder entfernen.</p><label>Neue persönliche PIN<input type="password" inputmode="numeric" minlength="4" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" data-dr-new-pin placeholder="4 Ziffern"></label><button type="button" class="outline-button" data-dr-save-pin="${escapeHtml(member.id)}">PIN in OneDrive speichern</button><span data-dr-pin-status aria-live="polite">PIN-Status beim Öffnen aus OneDrive laden.</span></fieldset>`;}
  async function saveAdminPin(button){
    if(!adminUnlocked)return showToast('Bitte zuerst die Administration entsperren.','error');
    const box=button.closest('.dr-pin-editor'),input=box.querySelector('[data-dr-new-pin]'),status=box.querySelector('[data-dr-pin-status]'),pin=input.value;
    if(!/^\d{4}$/.test(pin)){status.textContent='Bitte vier Ziffern eingeben.';input.focus();return;}
    button.disabled=true;input.value='';delete box.dataset.dirty;status.textContent='PIN wird in OneDrive gespeichert …';
    try{await S.setPin(button.dataset.drSavePin,pin);status.textContent='PIN in OneDrive gespeichert.';showToast('Getränke-PIN gespeichert.');return true;}
    catch(error){status.textContent=error.message||'PIN konnte nicht gespeichert werden. Bitte erneut eingeben.';return false;}
    finally{button.disabled=false;}
  }
  function finishSession(){resetSession();screen('members');render();renderPeople();window.scrollTo({top:0,behavior:'smooth'});}
  function updatePinDots(){const length=pinChecking?4:(el('pin')?.value.length||0);root?.querySelectorAll('.dr-pin-dot').forEach((node,i)=>node.classList.toggle('is-filled',i<length));if(el('pin-progress'))el('pin-progress').textContent=pinChecking?'Vier Ziffern eingegeben. PIN wird geprüft.':length+' von 4 Ziffern eingegeben';}
  function setPinChecking(value){
    pinChecking=Boolean(value);
    if(el('pin-check-status'))el('pin-check-status').hidden=!pinChecking;
    if(el('keypad'))el('keypad').setAttribute('aria-busy',String(pinChecking));
    updatePinDots();
  }
  function submitPin(){
    if(busy||pinChecking||currentScreen!=='pin')return;
    const pin=el('pin').value;if(!/^\d{4}$/.test(pin))return;
    // PIN sofort aus dem Eingabefeld entfernen; vier Punkte während der Prüfung beibehalten.
    el('pin').value='';setPinChecking(true);
    run(async()=>{
      const blocked=attempts.get(memberId);if(blocked?.until>Date.now())throw new Error('Zu viele PIN-Versuche. Bitte eine Minute warten.');
      account=await S.read(memberId);
      if(account.pin&&!await M.verifyPin(pin,account.pin)){const count=(blocked?.count||0)+1;attempts.set(memberId,{count:count>=5?0:count,until:count>=5?Date.now()+60000:0});throw new Error('Die PIN stimmt nicht.');}
      attempts.delete(memberId);signature=JSON.stringify(account.pin);rememberCardSession(memberId,account,signature);await performCardIntent();
    }).finally(()=>setPinChecking(false));
  }
  function renderRecent(){
    const list=el('recent');if(!list)return;list.replaceChildren();
    let credit=0;const rows=[],usages=account&&M.ledger?M.ledger(account).usages:null;
    for(const b of account?.bookings||[]){
      const used=b.type==='drinks'?(usages?usages.get(b.id):Math.min(credit,b.cents)):0;if(b.type==='bonus')credit+=b.cents;if(b.type==='drinks')credit-=used;
      rows.push({booking:b,text:b.type==='drinks'?b.count+(b.drink==='wine'?' Glas Wein':' Strich'+(b.count===1?'':'e'))+' · '+euro(b.cents)+(used?' · '+euro(used)+' aus Gutschrift':''):b.type==='correction'?'Korrektur · −'+b.count+(b.drink==='wine'?' Glas Wein':' Strich'+(b.count===1?'':'e'))+' · '+euro(b.cents):b.type==='bonus'?'Treuebonus · +'+euro(b.cents)+' Gutschrift':(b.method==='cash'?'Barzahlung':'PayPal bestätigt')+' · '+euro(b.cents)});
    }
    for(const row of rows.slice(-5).reverse()){const li=document.createElement('li'),title=document.createElement('strong'),date=document.createElement('small');title.textContent=row.text;date.textContent=new Date(row.booking.createdAt).toLocaleString('de-DE');li.append(title,date);list.append(li);}
    if(!list.children.length){const li=document.createElement('li');li.textContent='Noch keine Buchungen vorhanden.';list.append(li);}
  }
  function init(){
    root=byId('drinksView');if(!root)return;
    byId('drinksTab').addEventListener('click',open);byId('drinksShortcut').addEventListener('click',open);el('home').addEventListener('click',()=>showView('attendanceView'));el('refresh').addEventListener('click',open);
    el('mobile-retry')?.addEventListener('click',()=>run(()=>global.DrinksMobile.publish(memberId)));
    el('confirm')?.addEventListener('click',confirmCards);
    el('search').addEventListener('input',renderPeople);root.addEventListener('pointerdown',touch,{passive:true});root.addEventListener('input',touch);
    el('members').addEventListener('click',event=>{const button=event.target.closest('[data-dr-member]');if(button)selectCard(button.dataset.drMember,button.dataset.drCardAction||'account');});
    el('pin-form').addEventListener('submit',event=>{event.preventDefault();submitPin();});
    el('pin').addEventListener('input',()=>{updatePinDots();if(/^\d{4}$/.test(el('pin').value))queueMicrotask(submitPin);});
    el('keypad').addEventListener('click',event=>{
      const button=event.target.closest('[data-dr-digit]');if(!button||busy)return;
      const value=button.dataset.drDigit,input=el('pin');input.value=value==='clear'?'':value==='back'?input.value.slice(0,-1):(input.value+value).slice(0,4);
      updatePinDots();if(/^\d{4}$/.test(input.value))submitPin();
    });
    el('pin-back').addEventListener('click',()=>{if(busy||pending)return;if(draftCount()&&!confirm('Deine '+draftCount()+' neuen Getränke sind noch nicht gespeichert. Verwerfen und einen anderen Namen wählen?'))return;finishSession();});
    el('add').addEventListener('click',()=>{if(busy||pending)return;draft++;draftOrder.push('beer');render(true);});
    el('wine-add')?.addEventListener('click',()=>{if(busy||pending)return;wineDraft++;draftOrder.push('wine');render(true);});
    el('minus').addEventListener('click',()=>{if(busy||pending)return;const last=draftOrder.pop();if(last==='wine')wineDraft--;else if(last)draft--;render();});
    el('reset').addEventListener('click',()=>{if(busy||pending)return;draft=0;wineDraft=0;draftOrder=[];render();});
    el('today-undo')?.addEventListener('click',()=>run(undoToday));
    el('save').addEventListener('click',()=>run(async()=>{const count=await commitDraft();finishSession();if(count)showToast(count+' Getränk'+(count===1?'':'e')+' in OneDrive gespeichert.');else showToast('Getränkekarten geöffnet.');}));
    el('cancel').addEventListener('click',()=>{if(busy||pending)return;if((draftCount()||stagedCount())&&!confirm('Neue Einträge verwerfen? Bereits gebuchte Beträge bleiben erhalten.'))return;resetSession();screen('members');});
    root.querySelectorAll('[data-dr-pay]').forEach(b=>b.addEventListener('click',()=>run(()=>beginPayment(b.dataset.drPay))));
    el('partial').addEventListener('click',()=>run(()=>beginPayment('cash',true)));
    root.querySelectorAll('[data-dr-method]').forEach(b=>b.addEventListener('click',()=>{if(busy||pending)return;method=b.dataset.drMethod;amountScreen();}));
    root.querySelectorAll('[data-dr-amount]').forEach(b=>b.addEventListener('click',()=>{const max=M.totals(account).balance,value=b.dataset.drAmount==='all'?max:Math.min(Number(b.dataset.drAmount),max);el('amount').value=(value/100).toFixed(2).replace('.',',');}));
    el('pay-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
      const cents=M.parseEuro(el('amount').value);account=await S.read(memberId);
      if(!cents||cents>M.totals(account).balance)throw new Error('Bitte einen Betrag zwischen 0,01 € und '+euro(M.totals(account).balance)+' eingeben.');
      payment=cents;if(method==='paypal')showPaypal();screen(method);
    });});
    root.querySelectorAll('[data-dr-edit-amount]').forEach(b=>b.addEventListener('click',()=>{if(busy||pending)return;el('amount').value=(payment/100).toFixed(2).replace('.',',');amountScreen();}));
    el('cash-confirm').addEventListener('click',()=>run(confirmPayment));el('paypal-confirm').addEventListener('click',()=>{if(busy||pending)return;finishSession();showToast('Die Verwaltung trägt den geprüften PayPal-Eingang ein.');});
    root.querySelectorAll('[data-dr-back-account]').forEach(b=>b.addEventListener('click',()=>{if(busy||pending)return;payment=0;returnToCards();}));
    el('paid-next').addEventListener('click',finishSession);el('paid-account').addEventListener('click',()=>screen('account'));
    const showMobile=rotate=>run(async()=>{
      if(!signature)throw new Error('Bitte erneut mit deiner PIN anmelden.');
      clearMobileQr();screen('mobile');el('mobile-status').textContent='Dein QR-Code wird vorbereitet …';const url=await global.DrinksMobile.link(memberId,signature,rotate);
      const qr=qrcode(0,'M');qr.addData(url);qr.make();const canvas=el('mobile-qr'),count=qr.getModuleCount(),unit=6,quiet=4;canvas.width=canvas.height=(count+quiet*2)*unit;
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#111';
      for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))context.fillRect((c+quiet)*unit,(r+quiet)*unit,unit,unit);
      screen('mobile');el('mobile-status').textContent=global.DrinksMobile.status(memberId)||'QR-Code bereit. Mit der Handykamera scannen.';
    });
    el('mobile-open').addEventListener('click',()=>{if(!busy&&!pending)showMobile(false);});
    el('mobile-back').addEventListener('click',()=>{if(busy)return;clearMobileQr();screen('account');});
    el('mobile-refresh').addEventListener('click',()=>{if(!busy&&!pending)showMobile(false);});
    el('mobile-rotate').addEventListener('click',()=>{if(!busy&&!pending&&confirm('Neuen Handyzugang erstellen? Der alte Link kann zukünftige Kontostände nicht mehr öffnen. Bereits gelesene Daten und alte GitHub-Versionen bleiben erhalten.'))showMobile(true);});
    document.addEventListener('deckel-status',event=>{if(event.detail.id===memberId&&el('mobile-status'))el('mobile-status').textContent=event.detail.text;});
    el('own-open').addEventListener('click',()=>{if(busy||pending)return;clearPinInputs();screen('own-pin');el(account?.pin?'own-current':'own-new').focus();});
    el('own-back').addEventListener('click',()=>{clearPinInputs();screen('account');});
    el('own-form').addEventListener('submit',event=>{
      event.preventDefault();const oldPin=el('own-current').value,newPin=el('own-new').value;
      if(!/^\d{4}$/.test(newPin)){message('Die neue PIN muss genau vier Ziffern enthalten.');return;}
      if(newPin!==el('own-repeat').value){message('Die beiden neuen PIN-Eingaben stimmen nicht überein.');return;}
      clearPinInputs();run(async()=>{
        if(!signature)throw new Error('Bitte zuerst dein Getränkekonto öffnen.');
        try{account=await S.changeOwnPin(memberId,oldPin,newPin);signature=JSON.stringify(account.pin);rememberCardSession(memberId,account,signature);screen('account');message('Deine neue PIN ist in OneDrive gespeichert.');}
        catch(error){if(error.code==='wrongPin')throw error;throw new Error((error.message||'PIN-Änderung nicht bestätigt.')+' Bei unklarer Speicherung das Konto erneut öffnen und die neue PIN prüfen.');}
      });
    });
    el('own-remove').addEventListener('click',()=>{
      if(busy||pending)return;const oldPin=el('own-current').value;
      if(!/^\d{4}$/.test(oldPin)){message('Zum Entfernen bitte deine aktuelle PIN eingeben.');el('own-current').focus();return;}
      clearPinInputs();run(async()=>{if(!signature)throw new Error('Bitte zuerst dein Getränkekonto öffnen.');account=await S.changeOwnPin(memberId,oldPin,null);cardSessions.delete(memberId);signature=JSON.stringify(null);screen('account');message('PIN entfernt. Du kannst deine Getränkekarte jetzt ohne PIN öffnen.');});
    });
    byId('memberAdmin').addEventListener('click',event=>{const button=event.target.closest('[data-dr-save-pin]');if(button)saveAdminPin(button);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)lockAccount();});
    global.addEventListener('offline',()=>{if(!root.hidden)message(pending?'Keine Verbindung. Der Speicherstatus ist unklar. Verbindung herstellen und Speicherung erneut prüfen.':'Keine Verbindung. Neue Striche sind noch nicht gespeichert. Verbindung herstellen und erneut speichern.');});
    global.addEventListener('beforeunload',event=>{if(draftCount()||stagedCount()||pending||busy||cardQueue.length){event.preventDefault();event.returnValue='';}});
    const dockViewport=()=>{const v=global.visualViewport;root.style.setProperty('--dr-keyboard-offset',(v?Math.max(0,innerHeight-v.height-v.offsetTop):0)+'px');};global.visualViewport?.addEventListener('resize',dockViewport);global.visualViewport?.addEventListener('scroll',dockViewport);dockViewport();
    render();
  }
  async function loadPinStatus(row){
    const box=row.querySelector('.dr-pin-editor'),status=box?.querySelector('[data-dr-pin-status]');if(!status)return;
    status.textContent='PIN-Status wird aus OneDrive geladen …';
    try{const data=await S.read(row.dataset.memberId);if(!box.isConnected||box.dataset.dirty)return;status.textContent=data.pin?'Freiwillige PIN eingerichtet. Ein neuer Wert ersetzt sie.':'Ohne PIN nutzbar. Das Mitglied kann selbst eine PIN einrichten.';}
    catch(error){if(box.isConnected)status.textContent='PIN-Status nicht geladen. '+(error.message||'OneDrive-Verbindung prüfen.');}
  }
  global.Drinks={open,reset,beforeView,adminFields,loadPinStatus,lock:lockAccount,saveAdminPin};
  // Der vollständige Getränke-Bereich steht vor diesem Script bereits im DOM.
  // Den Direktzugang sofort binden, auch wenn weitere Scripts noch laden.
  if(byId('drinksView'))init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})(window);
