/* Privileged deletion is an audited cancellation; original ledger entries stay intact. */
(function(global){
  'use strict';
  const S=global.DrinksStore,M=global.DrinksModel,euro=c=>(c/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  let account=null,memberId='',source='',people=[],busy=false,pending=null,limit=100,generation=0;
  const el=id=>byId('dr-admin-'+id);
  const errorText=e=>e?.name==='TypeError'||e?.name==='AbortError'?'Die Verbindung konnte nicht bestätigt werden. Bitte denselben Vorgang erneut prüfen.':e.message||'Bitte erneut prüfen.';
  function controls(){for(const id of ['member','reason','checked'])el(id).disabled=busy||Boolean(pending);el('delete').disabled=busy;el('delete').textContent=busy?'Wird gespeichert …':pending?'Löschung erneut prüfen':'Buchung löschen';el('close').disabled=busy||Boolean(pending);}
  function lock(){generation++;account=null;people=[];memberId='';source='';el('member')?.replaceChildren();el('list')?.replaceChildren();el('person')&&(el('person').textContent='');el('preview')&&(el('preview').textContent='');el('reason')&&(el('reason').value='');el('checked')&&(el('checked').checked=false);el('dialog')?.close();}
  function beforeView(view){if(view==='settingsBookingsView'||view==='adminLoginView'||(!busy&&!pending))return true;showToast('Die Löschung bitte zuerst fertig speichern oder erneut prüfen.','error');return false;}
  function describe(b,count=b.count,cents=b.cents){return b.type==='drinks'?count+(b.drink==='wine'?(count===1?' Glas Wein':' Gläser Wein'):' Bier')+' · '+euro(cents):b.type==='payment'?(b.method==='cash'?'Barzahlung':'PayPal-Zahlung')+' · '+euro(cents):b.type==='payment-reversal'?'Admin: Zahlung gelöscht · '+euro(cents):b.type==='bonus'?'Automatische Getränkegutschrift · '+euro(cents):(b.confirmation==='admin'?'Admin-Löschung: ':'Rücknahme: ')+b.count+(b.drink==='wine'?' Wein':' Bier')+' · '+euro(cents);}
  async function load(){
    if(!requireAdmin('settingsBookingsView')||busy)return;const number=++generation;el('status').textContent='Mitglieder werden geladen …';
    try{const data=await oneDriveReadState();if(number!==generation||!adminUnlocked)return;people=data.members.map(p=>({id:String(p.id),name:[p.lastName,p.firstName].filter(Boolean).join(', ')})).sort((a,b)=>a.name.localeCompare(b.name,'de'));el('member').replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Mitglied auswählen';el('member').append(empty);for(const p of people){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;el('member').append(option);}el('status').textContent='Gespeicherte Getränke und Zahlungen ansehen und bei Bedarf löschen.';el('retry').hidden=!pending;if(pending)el('retry').textContent='Unbestätigte Löschung für '+pending.name+' erneut prüfen';}
    catch(error){if(number===generation)el('status').textContent=errorText(error);}
  }
  async function select(){
    if(!requireAdmin('settingsBookingsView')||busy||pending)return;const number=++generation,id=el('member').value;memberId=id;account=null;limit=100;el('list').replaceChildren();if(!id)return;el('status').textContent='Buchungen werden geladen …';
    try{const next=await S.read(id);if(number!==generation||!adminUnlocked)return;account=next;source=S.sourceKey();render();}
    catch(error){if(number===generation)el('status').textContent=errorText(error);}
  }
  function render(){
    el('list').replaceChildren();if(!account)return;const state=M.ledger(account),name=people.find(p=>p.id===memberId)?.name||'Mitglied';el('status').textContent=name+' · Schulden: '+euro(state.balance)+' · Getränkegutschrift: '+euro(state.credit);
    for(const b of account.bookings.slice().reverse().slice(0,limit)){
      const row=document.createElement('article');row.className='dr-admin-booking';const text=document.createElement('div'),title=document.createElement('strong'),date=document.createElement('small');title.textContent=describe(b);date.textContent=new Date(b.createdAt).toLocaleString('de-DE');text.append(title,date);row.append(text);
      const remaining=b.type==='drinks'?state.drinks.get(b.id)?.count:0,deleted=b.type==='drinks'?!remaining:b.type==='payment'?state.reversedPayments.has(b.id):false;
      if(deleted){const label=document.createElement('span');label.textContent='Gelöscht';row.append(label);row.classList.add('dr-voided');}
      else if(b.type==='drinks'||b.type==='payment'){if(b.type==='drinks'&&remaining!==b.count){const label=document.createElement('small');label.textContent='Noch '+remaining+' gespeichert';text.append(label);}const button=document.createElement('button');button.type='button';button.className='outline-button';button.textContent='Löschen';button.disabled=busy||Boolean(pending);button.onclick=()=>prepare(b.id);row.append(button);}
      else{const label=document.createElement('small');label.textContent=b.type==='bonus'?'Wird bei Löschung der zugehörigen Zahlung berücksichtigt.':'Nachweis der Korrektur';row.append(label);}
      el('list').append(row);
    }
    if(!account.bookings.length){const p=document.createElement('p');p.textContent='Noch keine Buchungen.';el('list').append(p);}el('more').hidden=account.bookings.length<=limit;el('more').disabled=busy||Boolean(pending);el('retry').hidden=!pending;
  }
  async function prepare(id){
    if(busy||pending||!requireAdmin('settingsBookingsView'))return;busy=true;controls();const selected=memberId;
    try{const next=await S.read(selected);if(!adminUnlocked)return;account=next;source=S.sourceKey();const b=account.bookings.find(b=>b.id===id),state=M.ledger(account);if(!b||b.type==='payment'&&state.reversedPayments.has(id)||b.type==='drinks'&&!state.drinks.get(id)?.count)throw new Error('Die Buchung wurde inzwischen gelöscht. Bitte neu laden.');
      const count=b.type==='drinks'?state.drinks.get(id).count:0;el('dialog').dataset.target=id;el('dialog').dataset.count=String(count);el('person').textContent=people.find(p=>p.id===selected)?.name||'Mitglied';el('preview').textContent=describe(b,count,b.type==='drinks'?count*M.unitPrice(b):b.cents)+' · '+new Date(b.createdAt).toLocaleString('de-DE');el('reason').value='Fehlerhafte Buchung';el('checked').checked=false;el('delete-status').textContent='';el('dialog').showModal();
    }catch(error){el('status').textContent=errorText(error);}finally{busy=false;controls();render();}
  }
  async function save(event){
    event?.preventDefault();if(busy||!requireAdmin('settingsBookingsView'))return;
    if(!pending){if(!el('checked').checked){el('delete-status').textContent='Bitte die Buchung prüfen und bestätigen.';return;}const reason=el('reason').value.trim();if(reason.length<3||reason.length>240){el('delete-status').textContent='Bitte einen Grund mit 3 bis 240 Zeichen eingeben.';return;}
      const targetId=el('dialog').dataset.target,target=account.bookings.find(b=>b.id===targetId),count=Number(el('dialog').dataset.count);if(!target)return;
      const entry={id:crypto.randomUUID(),type:target.type==='drinks'?'correction':'payment-reversal',targetId,confirmation:'admin',reason,cents:target.type==='drinks'?count*M.unitPrice(target):target.cents,createdAt:new Date().toISOString(),...(target.type==='drinks'?{count,...(target.drink==='wine'?{drink:'wine'}:{})}:{})};
      pending={memberId,entry,sourceKey:source,name:people.find(p=>p.id===memberId)?.name||'Mitglied'};
    }
    busy=true;controls();el('delete-status').textContent='Löschung wird gespeichert …';
    try{const saved=await S.adminDelete(pending.memberId,pending.entry,pending.sourceKey),id=pending.memberId;pending=null;if(!adminUnlocked)return;account=saved;memberId=id;el('dialog').close();render();showToast('Buchung gelöscht. Schulden, Gutschrift und Verbrauch wurden angepasst.');global.DrinksConsumption?.reset();}
    catch(error){if(['correctionChanged','adminChanged'].includes(error.code)){pending=null;el('delete-status').textContent='Buchung inzwischen geändert. Bitte schließen und neu auswählen.';}else el('delete-status').textContent=errorText(error)+' Bitte dieselbe Löschung erneut prüfen.';}
    finally{busy=false;controls();el('retry').hidden=!pending;}
  }
  function init(){
    const view=document.createElement('section');view.id='settingsBookingsView';view.className='view settings-subpage';view.hidden=true;view.innerHTML='<div class="screen-heading"><div><p class="eyebrow">Getränkeverwaltung</p><h2>Buchungen verwalten</h2><p>Gespeicherte Getränke und Zahlungen können nur hier durch die Verwaltung gelöscht werden. Korrekturen bleiben nachvollziehbar.</p></div><button class="outline-button" type="button" data-back>Zurück zur Getränkeverwaltung</button></div><label for="dr-admin-member">Mitglied</label><select id="dr-admin-member" class="text-input"></select><p id="dr-admin-status" role="status"></p><button id="dr-admin-retry" type="button" class="outline-button" hidden>Unbestätigte Löschung erneut prüfen</button><div id="dr-admin-list"></div><button id="dr-admin-more" class="outline-button" type="button" hidden>Weitere Buchungen anzeigen</button>';
    document.querySelector('main.app-shell').append(view);view.querySelector('[data-back]').onclick=()=>showView('settingsDrinksView');el('member').onchange=select;el('more').onclick=()=>{limit+=100;render();};el('retry').onclick=()=>{if(requireAdmin('settingsBookingsView'))save();};
    const dialog=document.createElement('dialog');dialog.id='dr-admin-dialog';dialog.className='ux-reminder-dialog';dialog.innerHTML='<form id="dr-admin-form"><h2>Buchung löschen?</h2><p id="dr-admin-person"></p><p id="dr-admin-preview"></p><p>Schulden und Getränkegutschrift werden angepasst. Bei einer Zahlung wird auch die zugehörige Bonusgutschrift zurückgenommen. Der Getränkeverbrauch zählt gelöschte Getränke nicht mehr.</p><label for="dr-admin-reason">Grund</label><input id="dr-admin-reason" class="text-input" maxlength="240" minlength="3" required><label class="admin-paypal-check"><input id="dr-admin-checked" type="checkbox" required> Buchung geprüft · Löschung bestätigen</label><p id="dr-admin-delete-status" role="status"></p><div class="ux-dialog-actions"><button id="dr-admin-delete" type="submit" class="primary-button">Buchung löschen</button><button id="dr-admin-close" type="button" class="outline-button">Abbrechen</button></div></form>';document.body.append(dialog);el('form').onsubmit=save;el('close').onclick=()=>{if(!busy&&!pending)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy||pending)event.preventDefault();});
    const button=document.createElement('button');button.className='primary-button';button.type='button';button.textContent='Buchungen öffnen';button.onclick=()=>{if(showView('settingsBookingsView')!==false)load();};byId('drinksSettingsBookingsCard').append(button);
  }
  global.DrinksAdminBookings={beforeView,lock};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
