/* Treuebonus: gemeinsame Einstellungen und persönliche Fortschrittsanzeige. */
(function(){
  'use strict';
  let policy=null,dirty=false,busy=false;
  const euro=c=>(c/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  function remainingText(state,p){
    if(!state.needed)return 'Bonusziel erreicht. Die nächste bestätigte Zahlung löst den Bonus aus.';
    return state.needed%DrinksModel.PRICE===0?`Noch ${state.needed/DrinksModel.PRICE} bezahlte Striche (${euro(state.needed)}) bis zum nächsten Bonus: ${euro(p.cents)}.`:`Noch ${euro(state.needed)} bezahlen bis zum nächsten Bonus: ${euro(p.cents)}. Teilzahlungen zählen mit.`;
  }
  function beforeView(id){
    if(id==='settingsRewardsView'||byId('settingsRewardsView')?.hidden!==false||!dirty)return true;
    if(busy){showToast('Bitte die Speicherung der Bonus-Einstellungen abwarten.','error');return false;}
    if(!confirm('Ungespeicherte Bonus-Einstellungen verwerfen?'))return false;
    dirty=false;return true;
  }
  async function load(force=false){
    if(!requireAdmin('settingsRewardsView')||busy||(!force&&dirty))return;
    if(force&&dirty&&!confirm('Bonus-Eingaben verwerfen und neu aus OneDrive laden?'))return;
    const status=byId('bonusSettingsStatus');busy=true;byId('bonusSettingsSave').disabled=true;status.textContent='Bonus-Einstellungen werden aus OneDrive geladen …';
    try{
      const next=await DrinksStore.rewards();if(!adminUnlocked)return;
      policy=next;dirty=false;byId('bonusCount').value=policy.count;byId('bonusEuro').value=(policy.cents/100).toFixed(2).replace('.',',');
      status.textContent=`In OneDrive gespeichert: ${policy.count} bezahlte Striche → ${euro(policy.cents)} Getränkegutschrift.`;
    }catch(error){status.textContent=error.message||'Einstellungen konnten nicht geladen werden.';}
    finally{busy=false;byId('bonusSettingsSave').disabled=!policy;}
  }
  async function save(event){
    event.preventDefault();if(!requireAdmin('settingsRewardsView')||busy||!policy)return;
    const count=Number(byId('bonusCount').value),cents=DrinksModel.parseEuro(byId('bonusEuro').value),status=byId('bonusSettingsStatus');
    try{DrinksModel.validateRewardSettings({...policy,count,cents});}catch(error){status.textContent=error.message;return;}
    busy=true;byId('bonusSettingsSave').disabled=true;status.textContent='Einstellungen werden in OneDrive gespeichert …';
    try{
      policy=await DrinksStore.saveRewards(count,cents,policy.revision);dirty=false;
      status.textContent=`In OneDrive gespeichert: ${policy.count} bezahlte Striche → ${euro(policy.cents)} Getränkegutschrift.`;
      showToast('Getränke-Bonus gespeichert.');globalThis.DrinksMobile?.refreshAll().catch(()=>{});
    }catch(error){status.textContent=error.message||'Speicherung nicht bestätigt. Bitte erneut laden und prüfen.';}
    finally{busy=false;byId('bonusSettingsSave').disabled=false;}
  }
  function render(account,draft,wineDraft=0){
    const p=DrinksStore.cachedRewards(),state=DrinksModel.rewardState(account||DrinksModel.empty(''),p);
    byId('dr-program').textContent=p?`Treuebonus: ${p.count} bezahlte Striche → ${euro(p.cents)} Getränkegutschrift · Wein zählt wie zwei Striche`:'Treuebonus wird aus OneDrive geladen …';
    const box=byId('dr-bonus');box.hidden=!account||!p;
    if(p){
      byId('dr-bonus-progress').max=state.threshold;byId('dr-bonus-progress').value=Math.min(state.progress,state.threshold);
      byId('dr-bonus-text').textContent=remainingText(state,p);
    }
    byId('dr-credit').hidden=!state.credit;byId('dr-credit').textContent=`Deine Getränkegutschrift: ${euro(state.credit)} · Wird für neue Striche genutzt.`;
    const used=Math.min(state.credit,(draft*DrinksModel.PRICE+wineDraft*DrinksModel.WINE_PRICE));byId('dr-draft-credit').hidden=!used;byId('dr-draft-credit').textContent=`Davon werden ${euro(used)} mit deiner Gutschrift bezahlt.`;
    return state;
  }
  function initialize(){
    const view=document.createElement('section');view.id='settingsRewardsView';view.className='view settings-subpage';view.hidden=true;
    view.innerHTML='<div class="screen-heading"><div><p class="eyebrow">Getränkeverwaltung</p><h2>Getränke-Bonus</h2><p>Eintragen, bezahlen und Getränkegutschrift sammeln.</p></div><button class="outline-button" type="button" data-back>Zurück zur Getränkeverwaltung</button></div><article class="panel ux-bonus-settings"><h3>Treuebonus festlegen</h3><form id="bonusSettingsForm"><div class="dr-own-new-pair"><div><label for="bonusCount">Nach wie vielen bezahlten Strichen?</label><input id="bonusCount" class="text-input" type="number" inputmode="numeric" min="1" max="10000" step="1" value="20" required></div><div><label for="bonusEuro">Gutschrift in Euro</label><input id="bonusEuro" class="text-input" type="text" inputmode="decimal" value="3,00" required></div></div><p>Ein bezahlter Strich entspricht 1,50 €. Ein bezahlter Wein für 3,00 € zählt wie zwei Striche. Teilzahlungen zählen anteilig. Bonusgutschrift zählt nicht erneut als Zahlung.</p><p>Der Bonus gilt für weitere Getränke und wird automatisch verrechnet. Änderungen gelten ab der nächsten Zahlung; bisheriger Fortschritt und vorhandene Gutschriften bleiben erhalten.</p><p>Gezählt werden bestätigte Zahlungen seit dem Start des Treuebonus. Frühere Zahlungen werden nicht nachträglich belohnt.</p><div class="ux-dialog-actions"><button id="bonusSettingsSave" class="primary-button" type="submit" disabled>Bonus in OneDrive speichern</button><button id="bonusSettingsReload" class="outline-button" type="button">Erneut laden</button></div></form><p id="bonusSettingsStatus" role="status">Standard: 20 bezahlte Striche → 3,00 € Getränkegutschrift.</p></article>';
    document.querySelector('main.app-shell').append(view);view.querySelector('[data-back]').onclick=()=>showView('settingsDrinksView');byId('bonusSettingsForm').onsubmit=save;byId('bonusSettingsReload').onclick=()=>load(true);
    byId('bonusSettingsForm').oninput=()=>{dirty=true;byId('bonusSettingsStatus').textContent='Bonus-Einstellungen noch nicht gespeichert.';};
    const button=document.createElement('button');button.className='primary-button';button.type='button';button.textContent='Bonus öffnen';button.onclick=()=>{if(showView('settingsRewardsView')!==false)load();};byId('drinksSettingsRewardsCard').append(button);
    addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
  }
  window.DrinksRewards={load,beforeView,render,remainingText};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
