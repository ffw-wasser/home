/* Getränke auf dem gemeinsamen iPad. PINs/Buchungen werden nur in OneDrive gespeichert. */
(function(global){
  'use strict';
  const M=global.DrinksModel,S=global.DrinksStore;
  const euro=cents=>(cents/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  let root,people=[],account=null,memberId='',signature='',draft=0,method='cash',payment=0,pending=null,busy=false,loaded=false,currentScreen='members',lockAfterRun=false,bookedNotice='',timer,attempts=new Map(),openNumber=0;
  const el=id=>byId('dr-'+id);
  const name=id=>people.find(p=>p.id===id)?.name||'Mitglied';
  const message=text=>{if(el('error'))el('error').textContent=text||'';};
  function screen(value){currentScreen=value;root.dataset.screen=value;root.querySelectorAll('[data-dr-screen]').forEach(e=>e.hidden=e.dataset.drScreen!==value);message('');touch();}
  function lockAccount(){
    clearTimeout(timer);if(!memberId||root.hidden)return;
    if(busy){lockAfterRun=true;return;}
    signature='';if(el('mobile-qr')){el('mobile-qr').width=1;el('mobile-qr').height=1;}clearPinInputs();el('pin').value='';updatePinDots();screen('pin');
    message(pending?'Konto gesperrt. Nach deiner PIN-Eingabe dieselbe Buchung erneut prüfen.':draft?'Konto gesperrt. Deine '+draft+' ungespeicherten Striche bleiben bis zum Neuladen erhalten. PIN eingeben, um fortzufahren.':'Konto gesperrt. Bitte deine PIN erneut eingeben.');
  }
  function touch(){clearTimeout(timer);if(memberId&&signature&&!busy)timer=setTimeout(lockAccount,60000);}
  function clearPinInputs(){for(const id of ['own-current','own-new','own-repeat'])if(el(id))el(id).value='';}
  function resetSession(){clearTimeout(timer);if(el('mobile-qr')){el('mobile-qr').width=1;el('mobile-qr').height=1;}memberId='';account=null;signature='';draft=0;payment=0;pending=null;bookedNotice='';if(el('pin'))el('pin').value='';clearPinInputs();updatePinDots();}
  function reset(){openNumber++;loaded=false;people=[];resetSession();S.reset();if(root){renderPeople();renderRanking();screen('members');el('status').textContent='Bitte OneDrive verbinden und Getränke neu öffnen.';}}
  function beforeView(view){
    if(!root||root.hidden||view==='drinksView')return true;
    if(busy||pending){showToast('Die Getränkebuchung bitte zuerst fertig speichern oder erneut prüfen.','error');return false;}
    const pinDraft=['own-current','own-new','own-repeat'].some(id=>el(id)?.value);
    if((draft||pinDraft)&&!confirm('Striche oder PIN-Eingaben sind noch nicht gespeichert. Verwerfen und Getränke verlassen?'))return false;
    resetSession();return true;
  }
  function renderPeople(){
    const container=el('members');container.replaceChildren();const query=el('search').value.toLocaleLowerCase('de-DE');
    for(const p of people.filter(p=>p.name.toLocaleLowerCase('de-DE').includes(query))){const button=document.createElement('button');button.type='button';button.dataset.drMember=p.id;button.textContent=p.name;button.disabled=!loaded||busy;container.append(button);}
    if(!container.children.length){const p=document.createElement('p');p.textContent=people.length?'Kein Mitglied gefunden. Suche nach Vor- oder Nachname.':loaded?'Noch keine Mitglieder vorhanden. Namen unter Einstellungen → Mitglieder anlegen.':'Mitglieder werden aus OneDrive geladen.';container.append(p);}
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
    const totals=account?M.totals(account):{balance:0,count:0};const reward=global.DrinksRewards?.render(account,draft)||{credit:0};const projected=totals.balance+Math.max(0,draft*M.PRICE-reward.credit);root.querySelectorAll('[data-dr-person]').forEach(e=>e.textContent=name(memberId));
    renderRecent();root.querySelectorAll('[data-dr-booked-notice]').forEach(node=>{node.hidden=!bookedNotice;node.textContent=bookedNotice;});el('dock-summary').textContent=draft+' neue Striche · Danach offen: '+euro(projected);
    el('balance').textContent=euro(totals.balance);el('count').textContent=totals.count+' bisher gebuchte Getränke';el('draft-count').textContent=draft+' neue Striche'+(draft?' · Noch nicht gespeichert':'');el('draft-amount').textContent=euro(draft*M.PRICE);el('total').textContent=euro(projected);
    const beerRow=el('beers');beerRow.replaceChildren();
    for(let i=0;i<Math.floor(draft/5);i++){const image=document.createElement('img');image.className='dr-keg';image.src='assets/drinks/bierfass.webp';image.alt='';beerRow.append(image);}
    for(let i=0;i<draft%5;i++){const glass=document.createElement('span');glass.textContent='🍺';beerRow.append(glass);}
    if(animate)beerRow.lastElementChild?.classList.add('dr-beer-pop');
    el('partial').disabled=busy||Boolean(pending)||projected<=0;root.querySelectorAll('[data-dr-digit],[data-dr-method],[data-dr-edit-amount]').forEach(b=>b.disabled=busy||Boolean(pending));
    el('minus').disabled=busy||Boolean(pending)||!draft;el('reset').disabled=busy||Boolean(pending)||!draft;el('add').disabled=busy||Boolean(pending);el('save').disabled=busy;el('cancel').disabled=busy||Boolean(pending);
    root.querySelectorAll('[data-dr-pay]').forEach(b=>{b.disabled=busy||Boolean(pending)||projected<=0;b.textContent=(draft?'Speichern & ':'')+(b.dataset.drPay==='cash'?'alles bar':'alles per PayPal');});
    root.querySelectorAll('[data-dr-payment]').forEach(e=>e.textContent=euro(payment));
    root.querySelectorAll('[data-dr-rest]').forEach(e=>e.textContent='Danach bleiben '+euro(Math.max(0,totals.balance-payment))+' offen.');
    el('paypal-change').disabled=busy||Boolean(pending);el('pin-back').disabled=busy||Boolean(pending);el('available').textContent=euro(totals.balance);
    root.querySelectorAll('[data-dr-amount]').forEach(b=>b.disabled=busy||totals.balance<=0||(b.dataset.drAmount!=='all'&&Number(b.dataset.drAmount)>totals.balance));
    el('cash-confirm').disabled=busy;el('paypal-confirm').disabled=busy;el('pay-submit').disabled=busy;
    el('cash-cancel').disabled=busy||Boolean(pending);el('paypal-cancel').disabled=busy||Boolean(pending);el('refresh').disabled=busy;
    if(el('mobile-open'))el('mobile-open').disabled=busy||Boolean(pending);
    el('own-open').disabled=busy||Boolean(pending);el('own-save').disabled=busy;el('own-back').disabled=busy;
    el('save').textContent=pending?.type==='drinks'?'Speicherung erneut prüfen':busy?'Wird gespeichert …':draft?'Fertig · '+draft+' Strich'+(draft===1?'':'e')+' speichern':'Fertig';
    for(const id of ['cash-confirm','paypal-confirm'])el(id).textContent=pending?.type==='payment'?'Speicherung erneut prüfen':id==='cash-confirm'?'Geld in die Kasse gelegt':'Zahlung durchgeführt';
    root.querySelectorAll('[data-dr-member]').forEach(button=>button.disabled=busy||!loaded);
    renderRanking();touch();
  }
  async function run(action){if(busy)return;busy=true;message('');render();try{await action();}catch(error){
    if(['pinChanged','balanceChanged','conflict'].includes(error.code)||[400,403,404].includes(error.status))pending=null;
    if(error.code==='pinChanged'){signature='';screen('pin');el('pin').value='';}
    if(error.code==='balanceChanged'){account=await S.read(memberId).catch(()=>account);payment=0;screen('account');}
    message(error.message||'OneDrive ist nicht erreichbar. Bitte erneut versuchen.');
  }finally{busy=false;render();if(lockAfterRun){lockAfterRun=false;lockAccount();}}}
  async function open(){
    if(busy||pending){showToast('Die aktuelle Buchung bitte zuerst fertig speichern.','error');return;}
    if(draft&&!confirm('Neue Striche verwerfen und zur Namensauswahl zurückkehren?'))return;
    if(showView('drinksView')===false)return;resetSession();screen('members');el('search').value='';loaded=false;renderPeople();renderRanking();el('status').textContent='Mitglieder und Getränkekonten werden aus OneDrive geladen …';
    const number=++openNumber;
    await run(async()=>{
      const data=await oneDriveReadState();
      if(!data||!Array.isArray(data.members))throw new Error('Die Mitgliederdatei in OneDrive ist nicht lesbar.');
      const next=data.members.map(p=>({id:String(p.id||''),name:[p.lastName,p.firstName].filter(Boolean).join(', ')}));
      if(next.some(p=>!p.id||!p.name)||new Set(next.map(p=>p.id)).size!==next.length)throw new Error('Die Mitglieder benötigen eindeutige Kennungen und Namen.');
      await S.rewards();await S.list(next.map(p=>p.id));if(number!==openNumber)return;
      people=next.sort((a,b)=>a.name.localeCompare(b.name,'de'));loaded=true;renderPeople();el('status').textContent='Aktuell aus OneDrive geladen.';renderRanking();
    });
    if(!loaded)el('status').textContent='Getränke konnten nicht geladen werden. OneDrive-Verbindung prüfen und aktualisieren.';
    renderPeople();
  }
  async function commitDraft(){
    if(!draft&&!pending)return 0;
    const count=pending?.count||draft;
    if(pending&&pending.type!=='drinks')throw new Error('Bitte zuerst die Zahlung fertig speichern.');
    if(!pending)pending={id:crypto.randomUUID(),type:'drinks',count:draft,cents:draft*M.PRICE,createdAt:new Date().toISOString()};
    account=await S.book(memberId,pending,signature);pending=null;draft=0;return count;
  }
  function amountScreen(){
    el('payment-title').textContent='Teilbetrag bezahlen';el('pay-submit').textContent=method==='cash'?'Weiter zur Bestätigung':'Zahlungslink anzeigen';
    root.querySelectorAll('[data-dr-method]').forEach(b=>{b.classList.toggle('dr-primary',b.dataset.drMethod===method);b.setAttribute('aria-pressed',String(b.dataset.drMethod===method));});
    screen('amount');
  }
  async function beginPayment(value,partial=false){
    const count=await commitDraft();if(count)bookedNotice=count+' neue Strich'+(count===1?' ist':'e sind')+' in OneDrive gespeichert. Sie bleiben auch bei Abbruch der Zahlung gebucht.';
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
    const bookingId=pending.id;account=await S.book(memberId,pending,signature);pending=null;
    const bonus=account.bookings.find(b=>b.type==='bonus'&&b.paymentId===bookingId)?.cents||0;el('paid-bonus').hidden=!bonus;el('paid-bonus').textContent=bonus?'Treuebonus erreicht: '+euro(bonus)+' Guthaben für deine nächsten Getränke!':'';
    el('paid-method').textContent=method==='cash'?'Bar · vom Mitglied bestätigt':'PayPal · vom Mitglied bestätigt';el('paid-balance').textContent=euro(M.totals(account).balance);screen('paid');if(M.totals(account).balance===0)global.DrinksExtras?.celebrate(bonus,()=>{if(currentScreen==='paid'&&!root.hidden&&!busy)finishSession();});
  }
  function adminFields(member){return `<fieldset class="dr-pin-editor"><legend>Getränke-PIN</legend><p>Die PIN wird separat gespeichert. Sie ist kein Teil von „Mitglied speichern“.</p><label>Neue persönliche PIN<input type="password" inputmode="numeric" minlength="4" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" data-dr-new-pin placeholder="4 Ziffern"></label><button type="button" class="outline-button" data-dr-save-pin="${escapeHtml(member.id)}">PIN in OneDrive speichern</button><span data-dr-pin-status aria-live="polite">PIN-Status beim Öffnen aus OneDrive laden.</span></fieldset>`;}
  async function saveAdminPin(button){
    if(!adminUnlocked)return showToast('Bitte zuerst die Administration entsperren.','error');
    const box=button.closest('.dr-pin-editor'),input=box.querySelector('[data-dr-new-pin]'),status=box.querySelector('[data-dr-pin-status]'),pin=input.value;
    if(!/^\d{4}$/.test(pin)){status.textContent='Bitte vier Ziffern eingeben.';input.focus();return;}
    button.disabled=true;input.value='';delete box.dataset.dirty;status.textContent='PIN wird in OneDrive gespeichert …';
    try{await S.setPin(button.dataset.drSavePin,pin);status.textContent='PIN in OneDrive gespeichert.';showToast('Getränke-PIN gespeichert.');}
    catch(error){status.textContent=error.message||'PIN konnte nicht gespeichert werden. Bitte erneut eingeben.';}
    finally{button.disabled=false;}
  }
  function finishSession(){resetSession();screen('members');render();renderPeople();window.scrollTo({top:0,behavior:'smooth'});}
  function updatePinDots(){const length=el('pin')?.value.length||0;root?.querySelectorAll('.dr-pin-dot').forEach((node,i)=>node.classList.toggle('is-filled',i<length));if(el('pin-progress'))el('pin-progress').textContent=length+' von 4 Ziffern eingegeben';}
  function submitPin(){
    if(busy||currentScreen!=='pin')return;const pin=el('pin').value;if(!/^\d{4}$/.test(pin))return;el('pin').value='';updatePinDots();
    run(async()=>{
      const blocked=attempts.get(memberId);if(blocked?.until>Date.now())throw new Error('Zu viele PIN-Versuche. Bitte eine Minute warten.');
      account=await S.read(memberId);if(!account.pin)throw new Error('Deine Getränke-PIN ist noch nicht eingerichtet. Bitte die Mitgliederverwaltung ansprechen.');
      if(!await M.verifyPin(pin,account.pin)){const count=(blocked?.count||0)+1;attempts.set(memberId,{count:count>=5?0:count,until:count>=5?Date.now()+60000:0});throw new Error('Die PIN stimmt nicht.');}
      attempts.delete(memberId);signature=JSON.stringify(account.pin);screen(pending?.type==='payment'?method:'account');
    });
  }
  function renderRecent(){
    const list=el('recent');if(!list)return;list.replaceChildren();
    let credit=0;const rows=[];
    for(const b of account?.bookings||[]){
      const used=b.type==='drinks'?Math.min(credit,b.cents):0;if(b.type==='bonus')credit+=b.cents;if(b.type==='drinks')credit-=used;
      rows.push({booking:b,text:b.type==='drinks'?b.count+' Strich'+(b.count===1?'':'e')+' · '+euro(b.cents)+(used?' · '+euro(used)+' aus Guthaben':''):b.type==='bonus'?'Treuebonus · +'+euro(b.cents)+' Guthaben':(b.method==='cash'?'Barzahlung':'PayPal bestätigt')+' · '+euro(b.cents)});
    }
    for(const row of rows.slice(-5).reverse()){const li=document.createElement('li'),title=document.createElement('strong'),date=document.createElement('small');title.textContent=row.text;date.textContent=new Date(row.booking.createdAt).toLocaleString('de-DE');li.append(title,date);list.append(li);}
    if(!list.children.length){const li=document.createElement('li');li.textContent='Noch keine Buchungen vorhanden.';list.append(li);}
  }
  function init(){
    root=byId('drinksView');if(!root)return;
    byId('drinksTab').addEventListener('click',open);byId('drinksShortcut').addEventListener('click',open);el('home').addEventListener('click',()=>showView('attendanceView'));el('refresh').addEventListener('click',open);
    el('search').addEventListener('input',renderPeople);root.addEventListener('pointerdown',touch,{passive:true});root.addEventListener('input',touch);
    el('members').addEventListener('click',event=>{const button=event.target.closest('[data-dr-member]');if(!button||busy||!loaded)return;memberId=button.dataset.drMember;draft=0;account=null;signature='';el('pin').value='';render();screen('pin');el('pin').focus();});
    el('pin-form').addEventListener('submit',event=>{event.preventDefault();submitPin();});
    el('pin').addEventListener('input',()=>{updatePinDots();if(/^\d{4}$/.test(el('pin').value))queueMicrotask(submitPin);});
    el('keypad').addEventListener('click',event=>{
      const button=event.target.closest('[data-dr-digit]');if(!button||busy)return;
      const value=button.dataset.drDigit,input=el('pin');input.value=value==='clear'?'':value==='back'?input.value.slice(0,-1):(input.value+value).slice(0,4);
      updatePinDots();if(/^\d{4}$/.test(input.value))submitPin();
    });
    el('pin-back').addEventListener('click',()=>{if(busy||pending)return;if(draft&&!confirm('Deine '+draft+' neuen Striche sind noch nicht gespeichert. Verwerfen und einen anderen Namen wählen?'))return;finishSession();});
    el('add').addEventListener('click',()=>{if(busy||pending)return;draft++;render(true);});
    el('minus').addEventListener('click',()=>{if(busy||pending)return;draft=Math.max(0,draft-1);render();});
    el('reset').addEventListener('click',()=>{if(busy||pending)return;draft=0;render();});
    el('save').addEventListener('click',()=>run(async()=>{const count=await commitDraft();finishSession();if(count)showToast(count+' Strich'+(count===1?'':'e')+' in OneDrive gespeichert.');else showToast('Getränkekonto geschlossen.');}));
    el('cancel').addEventListener('click',()=>{if(busy||pending)return;if(draft&&!confirm('Neue Striche verwerfen? Bereits gebuchte Beträge bleiben erhalten.'))return;resetSession();screen('members');});
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
    el('cash-confirm').addEventListener('click',()=>run(confirmPayment));el('paypal-confirm').addEventListener('click',()=>run(confirmPayment));
    root.querySelectorAll('[data-dr-back-account]').forEach(b=>b.addEventListener('click',()=>{if(busy||pending)return;payment=0;render();screen('account');}));
    el('paid-next').addEventListener('click',finishSession);el('paid-account').addEventListener('click',()=>screen('account'));
    el('mobile-open').hidden=!global.DRINKS_MOBILE_ORIGIN;
    el('mobile-open').addEventListener('click',()=>{
      if(busy||pending||!signature||!global.DRINKS_MOBILE_ORIGIN)return;
      if(!confirm('Einen neuen privaten Handyzugang erstellen? Ein bisheriger Link wird dadurch ungültig. Deine ungespeicherten Striche bleiben erhalten.'))return;
      run(async()=>{
        const url=await S.createMobileAccess(memberId,signature,global.DRINKS_MOBILE_ORIGIN);
        const qr=qrcode(0,'M');qr.addData(url);qr.make();
        const canvas=el('mobile-qr'),count=qr.getModuleCount(),unit=6,quiet=4;canvas.width=canvas.height=(count+quiet*2)*unit;
        const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#111';
        for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))context.fillRect((c+quiet)*unit,(r+quiet)*unit,unit,unit);
        screen('mobile');
      });
    });
    el('mobile-back').addEventListener('click',()=>{el('mobile-qr').width=1;el('mobile-qr').height=1;screen('account');});
    el('own-open').addEventListener('click',()=>{if(busy||pending)return;clearPinInputs();screen('own-pin');el('own-current').focus();});
    el('own-back').addEventListener('click',()=>{clearPinInputs();screen('account');});
    el('own-form').addEventListener('submit',event=>{
      event.preventDefault();const oldPin=el('own-current').value,newPin=el('own-new').value;
      if(!/^\d{4}$/.test(newPin)){message('Die neue PIN muss genau vier Ziffern enthalten.');return;}
      if(newPin!==el('own-repeat').value){message('Die beiden neuen PIN-Eingaben stimmen nicht überein.');return;}
      clearPinInputs();run(async()=>{
        if(!signature)throw new Error('Bitte zuerst dein Getränkekonto öffnen.');
        try{account=await S.changeOwnPin(memberId,oldPin,newPin);signature=JSON.stringify(account.pin);screen('account');message('Deine neue PIN ist in OneDrive gespeichert.');}
        catch(error){if(error.code==='wrongPin')throw error;throw new Error((error.message||'PIN-Änderung nicht bestätigt.')+' Bei unklarer Speicherung das Konto erneut öffnen und die neue PIN prüfen.');}
      });
    });
    byId('memberAdmin').addEventListener('click',event=>{const button=event.target.closest('[data-dr-save-pin]');if(button)saveAdminPin(button);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)lockAccount();});
    global.addEventListener('offline',()=>{if(!root.hidden)message(pending?'Keine Verbindung. Der Speicherstatus ist unklar. Verbindung herstellen und Speicherung erneut prüfen.':'Keine Verbindung. Neue Striche sind noch nicht gespeichert. Verbindung herstellen und erneut speichern.');});
    global.addEventListener('beforeunload',event=>{if(draft||pending||busy){event.preventDefault();event.returnValue='';}});
    const dockViewport=()=>{const v=global.visualViewport;root.style.setProperty('--dr-keyboard-offset',(v?Math.max(0,innerHeight-v.height-v.offsetTop):0)+'px');};global.visualViewport?.addEventListener('resize',dockViewport);global.visualViewport?.addEventListener('scroll',dockViewport);dockViewport();
    render();
  }
  async function loadPinStatus(row){
    const box=row.querySelector('.dr-pin-editor'),status=box?.querySelector('[data-dr-pin-status]');if(!status)return;
    status.textContent='PIN-Status wird aus OneDrive geladen …';
    try{const data=await S.read(row.dataset.memberId);if(!box.isConnected||box.dataset.dirty)return;status.textContent=data.pin?'PIN eingerichtet. Ein neuer Wert ersetzt sie.':'Noch keine Getränke-PIN eingerichtet.';}
    catch(error){if(box.isConnected)status.textContent='PIN-Status nicht geladen. '+(error.message||'OneDrive-Verbindung prüfen.');}
  }
  global.Drinks={open,reset,beforeView,adminFields,loadPinStatus,lock:lockAccount};
  // Der vollständige Getränke-Bereich steht vor diesem Script bereits im DOM.
  // Den Direktzugang sofort binden, auch wenn weitere Scripts noch laden.
  if(byId('drinksView'))init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})(window);
