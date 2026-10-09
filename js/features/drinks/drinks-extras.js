/* Dank auf dem iPad und vom Verwalter vorbereitete Erinnerungstexte. */
(function(){
  'use strict';
  let timer,reminders=[],onDone=null;
  function finishThanks(){clearTimeout(timer);const dialog=byId('drinksThanksDialog');dialog?.close();const fn=onDone;onDone=null;fn?.();}
  const euro=c=>(c/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  function celebrate(bonus=0,done=null){
    let dialog=byId('drinksThanksDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='drinksThanksDialog';dialog.className='dr-thanks';
      dialog.innerHTML='<button type="button" class="outline-button" aria-label="Dankesnachricht schließen und weiter">Fertig</button><div class="dr-burst" aria-hidden="true"><img src="assets/drinks/bierfass.webp" alt=""><span class="dr-burst-pop"><svg viewBox="0 0 120 120" aria-hidden="true"><path fill="#e85c28" d="M60 3 70 30 93 12 88 41 117 40 97 61 116 84 87 83 91 113 68 93 57 118 48 91 22 110 29 82 2 78 24 60 5 38 34 38 28 10 51 30Z"/><path fill="#ffd65c" d="m60 25 9 24 23-8-15 20 19 18-27-4-9 23-8-24-25 9 15-22-18-15 26 2Z"/></svg></span>'+Array.from({length:16},(_,i)=>`<i style="--angle:${i*22.5}deg;--delay:${i%3*35}ms"></i>`).join('')+'</div><h2>Danke!</h2><p>Dein Deckel ist bezahlt. 🍻</p><p data-thanks-bonus class="dr-credit" hidden></p><p class="dr-muted">Zahlung in OneDrive gespeichert.</p>';
      document.body.append(dialog);dialog.querySelector('button').onclick=finishThanks;dialog.addEventListener('cancel',event=>{event.preventDefault();finishThanks();});
    }
    const message=dialog.querySelector('[data-thanks-bonus]');message.hidden=!bonus;message.textContent=bonus?'Treuebonus: '+euro(bonus)+' für deine nächsten Getränke!':'';
    onDone=done;clearTimeout(timer);dialog.showModal();timer=setTimeout(finishThanks,5500);
  }
  function text(row){return `Hallo ${row.name},\n\nauf deinem Getränkedeckel bei der Feuerwehr Wasser sind aktuell ${euro(row.cents)} offen. Du kannst den Betrag im Gerätehaus bar oder per PayPal begleichen.\n\nPayPal: ${DrinksModel.paypalUrl(row.cents)}\nNach der PayPal-Zahlung bitte den tatsächlich gezahlten Betrag in der Getränke-Strichliste bestätigen.\n\nVielen Dank!\nFeuerwehr Wasser`;}
  async function load(){
    if(!requireAdmin('settingsRemindersView'))return;
    const view=byId('settingsRemindersView'),status=byId('remindersStatus'),list=byId('remindersList');
    status.textContent='Offene Beträge werden aus OneDrive geladen …';list.replaceChildren();reminders=[];
    try{
      const data=await oneDriveReadState();if(!adminUnlocked)return;
      if(!Array.isArray(data?.members))throw new Error('Mitgliederdatei nicht lesbar.');
      const people=data.members.map(p=>({id:String(p.id),name:[p.firstName,p.lastName].filter(Boolean).join(' ')}));
      await DrinksStore.list(people.map(p=>p.id));if(!adminUnlocked)return;
      reminders=people.map(p=>({...p,cents:DrinksModel.totals(DrinksStore.cached(p.id)).balance})).filter(p=>p.cents>0).sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name,'de'));
      status.textContent=reminders.length?`${reminders.length} offene Deckel · Stand: ${new Date().toLocaleString('de-DE')}`:'Alle Deckel sind bezahlt.';
      for(const row of reminders){
        const article=document.createElement('article');article.className='ux-reminder-row';
        const name=document.createElement('strong');name.textContent=row.name;const amount=document.createElement('span');amount.textContent=euro(row.cents);
        const button=document.createElement('button');button.className='outline-button';button.type='button';button.textContent='Erinnerung vorbereiten';button.onclick=()=>prepare(row);
        article.append(name,amount,button);list.append(article);
      }
    }catch(error){status.textContent='Beträge konnten nicht geladen werden. '+error.message;}
  }
  function prepare(row){
    if(!requireAdmin('settingsRemindersView'))return;
    let dialog=byId('reminderDraftDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='reminderDraftDialog';dialog.className='ux-reminder-dialog';dialog.innerHTML='<h2>Erinnerung vorbereiten</h2><p>Text prüfen und bei Bedarf selbst weitergeben.</p><label for="reminderDraftText">Nachricht</label><textarea id="reminderDraftText" rows="12" readonly></textarea><p id="reminderCopyStatus" role="status"></p><div class="ux-dialog-actions"><button class="outline-button" type="button" data-copy>Text kopieren</button><button class="outline-button" type="button" data-close>Schließen</button></div>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-copy]').onclick=async()=>{if(!requireAdmin('settingsRemindersView'))return;const input=byId('reminderDraftText');try{await navigator.clipboard.writeText(input.value);byId('reminderCopyStatus').textContent='Text kopiert.';}catch(error){input.select();byId('reminderCopyStatus').textContent='Text markieren und mit der Kopierfunktion des Geräts übernehmen.';}};}
    byId('reminderDraftText').value=text(row);byId('reminderCopyStatus').textContent='';dialog.showModal();
  }
  function initialize(){
    const view=document.createElement('section');view.id='settingsRemindersView';view.className='view settings-subpage';view.hidden=true;
    view.innerHTML='<div class="screen-heading"><div><p class="eyebrow">Getränkeverwaltung</p><h2>Offene Deckel erinnern</h2><p>Aktuelle offene Beträge ansehen und Erinnerungstexte kopieren.</p></div><button class="outline-button" data-back type="button">Zurück zu Einstellungen</button></div><button class="outline-button" type="button" id="refreshReminders">Beträge aktualisieren</button><p id="remindersStatus" role="status"></p><div id="remindersList"></div>';
    document.querySelector('main.app-shell').append(view);view.querySelector('[data-back]').onclick=()=>showView('settingsView');byId('refreshReminders').onclick=load;
    const button=document.createElement('button');button.type='button';button.className='settings-menu-card';button.innerHTML='<strong>Offene Deckel erinnern</strong><span>Erinnerungen für Mitglieder vorbereiten</span>';button.onclick=()=>{if(showView('settingsRemindersView')!==false)load();};byId('settingsView').querySelector('.settings-menu-grid-management').append(button);
  }
  window.DrinksExtras={celebrate,loadReminders:load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
