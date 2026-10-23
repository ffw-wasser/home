/* Dank auf dem iPad, Kontenübersicht und bestätigte PayPal-Zahlungen. */
(function(){
  'use strict';
  let timer,reminders=[],onDone=null,paypalRow=null,paypalPending=null,paypalBusy=false;
  function finishThanks(){clearTimeout(timer);const dialog=byId('drinksThanksDialog');if(dialog?.open)dialog.close();dialog?.remove();const fn=onDone;onDone=null;fn?.();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finishThanks();});
  const euro=c=>(c/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  function celebrate(bonus=0,done=null,options={}){
    let dialog=byId('drinksThanksDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='drinksThanksDialog';dialog.className='dr-thanks';
      dialog.innerHTML='<button type="button" class="outline-button" aria-label="Dankesnachricht schließen und weiter">Zurück zu Getränken</button><div class="dr-burst" aria-hidden="true"><img src="assets/drinks/bierfass.webp" alt=""><span class="dr-burst-pop"><svg viewBox="0 0 120 120" aria-hidden="true"><path fill="#e85c28" d="M60 3 70 30 93 12 88 41 117 40 97 61 116 84 87 83 91 113 68 93 57 118 48 91 22 110 29 82 2 78 24 60 5 38 34 38 28 10 51 30Z"/><path fill="#ffd65c" d="m60 25 9 24 23-8-15 20 19 18-27-4-9 23-8-24-25 9 15-22-18-15 26 2Z"/></svg></span>'+Array.from({length:16},(_,i)=>`<i style="--angle:${i*22.5}deg;--delay:${i%3*35}ms"></i>`).join('')+'</div><h2 data-thanks-title>Danke!</h2><p data-thanks-message>Dein Deckel ist bezahlt. 🍻</p><p data-thanks-bonus class="dr-credit" hidden></p><p class="dr-muted" data-thanks-status>Zahlung gespeichert.</p>';
      document.body.append(dialog);dialog.querySelector('button').onclick=finishThanks;dialog.addEventListener('cancel',event=>{event.preventDefault();finishThanks();});
    }
    const termin=options.kind==='termin';dialog.querySelector('button').hidden=termin;dialog.querySelector('[data-thanks-title]').textContent=termin?'Danke für deinen Einsatz!':'Danke!';dialog.querySelector('[data-thanks-message]').textContent=termin?'Termin abgeschlossen.':'Dein Deckel ist bezahlt. 🍻';dialog.querySelector('[data-thanks-status]').textContent=termin?(options.result==='saved'?'In OneDrive gespeichert.':options.result==='shared'?'Terminpaket an „In Dateien sichern“ übergeben.':'Terminpaket zum Download übergeben.'):'Zahlung gespeichert.';
    const message=dialog.querySelector('[data-thanks-bonus]');message.hidden=!bonus;message.textContent=bonus?'⭐ '+DrinksModel.pointText(bonus)+' neue Treuepunkte für deine nächsten Getränke!':'';
    onDone=done;clearTimeout(timer);dialog.showModal();timer=setTimeout(finishThanks,bonus?4500:3000);
  }
  async function load(){
    if(!requireAdmin('settingsRemindersView'))return;
    const view=byId('settingsRemindersView'),status=byId('remindersStatus'),list=byId('remindersList');
    status.textContent='Schulden werden geladen …';byId('remindersTotal').textContent='';byId('remindersRecent').replaceChildren();list.replaceChildren();reminders=[];
    try{
      const data=await oneDriveReadState();if(!adminUnlocked)return;
      if(!Array.isArray(data?.members))throw new Error('Mitgliederdatei nicht lesbar.');
      const people=data.members.map(p=>({id:String(p.id),name:[p.firstName,p.lastName].filter(Boolean).join(' ')}));
      await DrinksStore.list(people.map(p=>p.id));if(!adminUnlocked)return;
      reminders=people.map(p=>({...p,cents:DrinksModel.totals(DrinksStore.cached(p.id)).balance})).sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name,'de'));
      status.textContent=reminders.some(p=>p.cents>0)?`${reminders.filter(p=>p.cents>0).length} offene Deckel · Stand: ${new Date().toLocaleString('de-DE')}`:'Alle Deckel sind bezahlt.';
      const sum=reminders.reduce((n,row)=>n+row.cents,0);byId('remindersTotal').textContent='Schulden gesamt: '+euro(sum)+' · '+reminders.filter(p=>p.cents>0).length+' Deckel';
      const recent=people.flatMap(p=>(DrinksStore.cached(p.id)?.bookings||[]).filter(b=>b.type==='payment').map(b=>({...b,name:p.name}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
      const recentList=byId('remindersRecent');recentList.replaceChildren();for(const item of recent){const li=document.createElement('li');li.textContent=item.name+' · '+euro(item.cents)+' · '+(item.method==='cash'?'Bar':'PayPal verbucht')+' · '+new Date(item.createdAt).toLocaleString('de-DE');recentList.append(li);}if(!recent.length){const li=document.createElement('li');li.textContent='Noch keine bestätigten Zahlungen.';recentList.append(li);}
      renderReminders();
    }catch(error){status.textContent='Beträge konnten nicht geladen werden. '+error.message;}
  }
  function renderReminders(){
    const list=byId('remindersList');list.replaceChildren();const query=(byId('remindersSearch')?.value||'').trim().toLocaleLowerCase('de');const order=byId('remindersOrder')?.value||'amount';
    const shown=reminders.filter(row=>(byId('remindersAll')?.checked||row.cents>0)&&row.name.toLocaleLowerCase('de').includes(query)).sort((a,b)=>order==='name'?a.name.localeCompare(b.name,'de'):order==='small'?a.cents-b.cents:b.cents-a.cents);
    for(const row of shown){
        const article=document.createElement('article');article.className='ux-reminder-row';
        const name=document.createElement('strong');name.textContent=row.name;const amount=document.createElement('span');amount.textContent=euro(row.cents);
        const payment=document.createElement('button');payment.className='primary-button';payment.type='button';payment.textContent='PayPal-Eingang eintragen';payment.onclick=()=>openPaypal(row);
        article.dataset.reminderMember=row.id;article.append(name,amount,payment);list.append(article);
      }
    if(!shown.length){const empty=document.createElement('p');empty.textContent=reminders.length?'Kein passendes Mitglied gefunden.':'Keine offenen Deckel.';list.append(empty);}
  }
  function openPaypal(row){
    if(!requireAdmin('settingsRemindersView')||paypalBusy)return;
    if(paypalPending&&!confirm('Eine vorherige Zahlung hat einen unklaren Speicherstatus. Vor einer neuen Buchung den Kontoverlauf prüfen. Trotzdem eine neue Eingabe öffnen?'))return;
    let dialog=byId('adminPaypalDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='adminPaypalDialog';dialog.className='ux-reminder-dialog';
      dialog.innerHTML='<form id="adminPaypalForm"><h2>PayPal-Eingang eintragen</h2><p id="adminPaypalPerson"></p><p id="adminPaypalBalance"></p><label for="adminPaypalAmount">Tatsächlich erhalten · Euro</label><input id="adminPaypalAmount" class="text-input" inputmode="decimal" autocomplete="off" required><label for="adminPaypalReference">PayPal-Transaktionscode · optional</label><input id="adminPaypalReference" class="text-input" autocomplete="off" maxlength="80" placeholder="Aus der PayPal-Zahlung"><p>Nur einen in PayPal geprüften Eingang eintragen. Teil- und Vorauszahlungen sind möglich. Der Restbetrag bleibt für spätere Getränke erhalten. Der Zahlungscode verhindert ein erneutes Eintragen derselben Zahlung auf diesem Konto.</p><label class="admin-paypal-check"><input id="adminPaypalChecked" type="checkbox" required> Zahlung in PayPal erhalten und Mitglied geprüft</label><p id="adminPaypalStatus" role="status"></p><div class="ux-dialog-actions"><button id="adminPaypalSave" class="primary-button" type="submit">Zahlung eintragen</button><button id="adminPaypalClose" class="outline-button" type="button">Abbrechen</button></div></form>';
      document.body.append(dialog);byId('adminPaypalClose').onclick=()=>{if(paypalBusy)return;if(paypalPending&&!confirm('Der Speicherstatus ist noch unklar. Vor einer weiteren Buchung dieses Kontos bitte den Verlauf prüfen. Trotzdem schließen?'))return;paypalPending=null;dialog.close();};
      dialog.addEventListener('cancel',event=>{event.preventDefault();byId('adminPaypalClose').click();});byId('adminPaypalForm').onsubmit=savePaypal;
    }
    paypalRow=row;paypalPending=null;byId('adminPaypalPerson').textContent=row.name;byId('adminPaypalBalance').textContent='Aktuelle Schulden: '+euro(row.cents);byId('adminPaypalAmount').value=(row.cents/100).toFixed(2).replace('.',',');byId('adminPaypalReference').value='';byId('adminPaypalChecked').checked=false;byId('adminPaypalStatus').textContent='';paypalControls(false);dialog.showModal();
  }
  function paypalControls(busy){
    for(const id of ['adminPaypalAmount','adminPaypalReference','adminPaypalChecked'])byId(id).disabled=busy||Boolean(paypalPending);
    byId('adminPaypalClose').disabled=busy;byId('adminPaypalSave').disabled=busy;byId('adminPaypalSave').textContent=busy?'Wird gespeichert …':paypalPending?'Speicherung erneut prüfen':'Zahlung eintragen';
  }
  async function savePaypal(event){
    event.preventDefault();if(paypalBusy||!paypalRow||!adminUnlocked)return;
    const status=byId('adminPaypalStatus');
    if(!paypalPending){
      const cents=DrinksModel.parseEuro(byId('adminPaypalAmount').value),reference=byId('adminPaypalReference').value.trim().toUpperCase();
      if(!cents||cents>1000000){status.textContent='Bitte einen Betrag zwischen 0,01 € und 10.000,00 € eingeben.';return;}
      if(reference&&!/^[A-Z0-9-]{8,80}$/.test(reference)){status.textContent='Bitte den PayPal-Transaktionscode prüfen oder das Feld leer lassen.';return;}
      if(!byId('adminPaypalChecked').checked){status.textContent='Bitte zuerst Zahlungseingang und Mitglied prüfen.';return;}
      paypalPending={id:reference?'paypal-admin-'+reference:crypto.randomUUID(),type:'payment',method:'paypal',confirmation:'admin',prepay:true,cents,createdAt:new Date().toISOString()};
    }
    paypalBusy=true;paypalControls(true);status.textContent='Zahlung wird gespeichert …';
    try{
      const account=await DrinksStore.adminPaypalPayment(paypalRow.id,paypalPending),amount=paypalPending.cents;paypalPending=null;
      byId('adminPaypalDialog').close();showToast(euro(amount)+' PayPal-Eingang gespeichert. Verbleibende Schulden: '+euro(DrinksModel.totals(account).balance)+'.');await load();
    }catch(error){
      if(['balanceChanged','conflict'].includes(error.code)){paypalPending=null;const account=await DrinksStore.read(paypalRow.id).catch(()=>null);if(account){paypalRow.cents=DrinksModel.totals(account).balance;byId('adminPaypalBalance').textContent='Aktuelle Schulden: '+euro(paypalRow.cents);}}
      status.textContent=(error.message||'Speicherung nicht bestätigt.')+(paypalPending?' Dieselbe Zahlung über „Speicherung erneut prüfen“ prüfen.':'');
    }finally{paypalBusy=false;paypalControls(false);}
  }
  function initialize(){
    byId('drinksSettingsMembersButton').onclick=()=>showView('settingsMembersView');
    byId('settingsDrinksView').querySelector('[data-drinks-settings-back]').onclick=()=>showView('settingsView');
    const view=document.createElement('section');view.id='settingsRemindersView';view.className='view settings-subpage';view.hidden=true;
    view.innerHTML='<div class="screen-heading"><div><p class="eyebrow">Getränkeverwaltung</p><h2>Konten &amp; Zahlungen</h2><p>Offene Deckel ansehen und geprüfte PayPal-Eingänge eintragen.</p></div><button class="outline-button" data-back type="button">Zurück zur Getränkeverwaltung</button></div><button class="outline-button" type="button" id="refreshReminders">Beträge aktualisieren</button><p id="remindersStatus" role="status"></p><p id="remindersTotal" class="workflow-kpi"></p><div class="workflow-history-filters"><label>Mitglied suchen<input id="remindersSearch" class="text-input" type="search" placeholder="Vor- oder Nachname"></label><label>Sortieren<select id="remindersOrder" class="text-input"><option value="amount">Größter Betrag zuerst</option><option value="small">Kleinster Betrag zuerst</option><option value="name">Name</option></select></label></div><label><input id="remindersAll" type="checkbox"> Auch bezahlte Konten für Einzahlungen anzeigen</label><details class="workflow-recent"><summary>Zuletzt bestätigte Zahlungen</summary><ul id="remindersRecent"></ul></details><div id="remindersList"></div>';
    document.querySelector('main.app-shell').append(view);view.querySelector('[data-back]').onclick=()=>showView('settingsDrinksView');byId('refreshReminders').onclick=load;byId('remindersAll').onchange=renderReminders;byId('remindersSearch').oninput=renderReminders;byId('remindersOrder').onchange=renderReminders;
    const button=document.createElement('button');button.type='button';button.className='primary-button';button.textContent='Konten & Zahlungen öffnen';button.onclick=()=>{if(showView('settingsRemindersView')!==false)load();};byId('drinksSettingsPaymentsCard').append(button);
  }
  window.DrinksExtras={celebrate,dismiss:()=>{onDone=null;finishThanks();},loadReminders:load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
