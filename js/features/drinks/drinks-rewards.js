/* Treuepunkte: bestätigte Geldzahlungen, ausdrücklich gegen Getränke einlösen. */
(function(){
  'use strict';
  let policy=null,dirty=false,busy=false;
  const M=DrinksModel,euro=c=>(c/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €',points=u=>M.pointText(u)+' '+(u===M.POINT_UNIT?'Treuepunkt':'Treuepunkte');
  function remainingText(state,p){return state.needed?`Noch ${euro(state.needed)} einzahlen bis zu ${points(M.award(p))}.`:'Ziel erreicht. Die nächste bestätigte Einzahlung vergibt die Treuepunkte.';}
  function beforeView(id){if(id==='settingsRewardsView'||byId('settingsRewardsView')?.hidden!==false||!dirty)return true;if(busy){showToast('Bitte die Speicherung der Treuepunkte-Einstellungen abwarten.','error');return false;}if(!confirm('Ungespeicherte Treuepunkte-Einstellungen verwerfen?'))return false;dirty=false;return true;}
  const description=p=>`${euro(M.threshold(p))} Einzahlung → ${points(M.award(p))}. Bier: ${M.pointText(M.pointCost(p,'beer'))} Punkte · Wein: ${M.pointText(M.pointCost(p,'wine'))} Punkte.`;
  async function load(force=false){
    if(!requireAdmin('settingsRewardsView')||busy||(!force&&dirty))return;if(force&&dirty&&!confirm('Eingaben verwerfen und neu aus OneDrive laden?'))return;
    const status=byId('bonusSettingsStatus');busy=true;byId('bonusSettingsSave').disabled=true;status.textContent='Treuepunkte-Einstellungen werden geladen …';
    try{const next=await DrinksStore.rewards();if(!adminUnlocked)return;policy=M.rewardPolicy(next);dirty=false;byId('bonusCount').value=(policy.thresholdCents/100).toFixed(2).replace('.',',');byId('bonusEuro').value=policy.awardUnits/M.POINT_UNIT;byId('bonusBeer').value=policy.beerUnits/M.POINT_UNIT;byId('bonusWine').value=policy.wineUnits/M.POINT_UNIT;status.textContent='In OneDrive gespeichert: '+description(policy);}
    catch(error){status.textContent=error.message||'Einstellungen konnten nicht geladen werden.';}finally{busy=false;byId('bonusSettingsSave').disabled=!policy;}
  }
  async function save(event){
    event.preventDefault();if(!requireAdmin('settingsRewardsView')||busy||!policy)return;const status=byId('bonusSettingsStatus');
    const settings={thresholdCents:M.parseEuro(byId('bonusCount').value),awardUnits:Number(byId('bonusEuro').value)*M.POINT_UNIT,beerUnits:Number(byId('bonusBeer').value)*M.POINT_UNIT,wineUnits:Number(byId('bonusWine').value)*M.POINT_UNIT};
    try{M.validateRewardSettings({...policy,...settings});}catch(error){status.textContent=error.message;return;}
    busy=true;byId('bonusSettingsSave').disabled=true;status.textContent='Treuepunkte-Einstellungen werden gespeichert …';
    try{policy=await DrinksStore.saveRewards(settings,policy.revision);dirty=false;status.textContent='In OneDrive gespeichert: '+description(policy);showToast('Treuepunkte gespeichert.');globalThis.Drinks?.updateCards?.();globalThis.DrinksMobile?.refreshAll().catch(()=>{});}
    catch(error){status.textContent=error.message||'Speicherung nicht bestätigt. Bitte erneut laden und prüfen.';}finally{busy=false;byId('bonusSettingsSave').disabled=false;}
  }
  function render(account){
    const p=DrinksStore.cachedRewards(),state=M.rewardState(account||M.empty(''),p);
    byId('dr-program').textContent=p?'Treuepunkte: '+description(p)+' Nur bestätigte Geldzahlungen zählen; Einlösen erzeugt keine neuen Punkte.':'Treuepunkte werden geladen …';
    const box=byId('dr-bonus');box.hidden=!account||!p;
    if(p){byId('dr-bonus-progress').max=state.threshold;byId('dr-bonus-progress').value=Math.min(state.progress,state.threshold);byId('dr-bonus-text').textContent=points(state.pointUnits)+' · '+remainingText(state,p);}
    byId('dr-credit').hidden=!state.prepaid;byId('dr-credit').textContent='Eingezahlter Betrag: '+euro(state.prepaid)+' · Für spätere Getränke.';return state;
  }
  function initialize(){
    const view=document.createElement('section');view.id='settingsRewardsView';view.className='view settings-subpage';view.hidden=true;
    view.innerHTML='<div class="screen-heading"><div><p class="eyebrow">Getränkeverwaltung</p><h2>Treuepunkte</h2><p>Geld einzahlen, Punkte sammeln und gegen Getränke einlösen.</p></div><button class="outline-button" type="button" data-back>Zurück zur Getränkeverwaltung</button></div><article class="panel ux-bonus-settings"><h3>Treuepunkte festlegen</h3><form id="bonusSettingsForm"><div class="dr-own-new-pair"><div><label for="bonusCount">Bestätigter Geldbetrag je Punktezuteilung · Euro</label><input id="bonusCount" class="text-input" type="text" inputmode="decimal" value="30,00" required></div><div><label for="bonusEuro">Treuepunkte je erreichtem Geldbetrag</label><input id="bonusEuro" class="text-input" type="number" min="0.01" step="any" value="2" required></div><div><label for="bonusBeer">Treuepunkte für 1 Bier</label><input id="bonusBeer" class="text-input" type="number" min="0.01" step="any" value="1" required></div><div><label for="bonusWine">Treuepunkte für 1 Glas Wein</label><input id="bonusWine" class="text-input" type="number" min="0.01" step="any" value="1" required></div></div><p>Nur tatsächlich bestätigte Bar- und PayPal-Einzahlungen zählen. Teilbeträge und Vorauszahlungen zählen mit. Getränke buchen oder Treuepunkte einlösen erzeugt keine neuen Punkte.</p><p>Mitglieder entscheiden auf ihrer Karte, wann sie Punkte gegen Bier oder Wein einlösen. Erst OK speichert die Einlösung. Änderungen gelten für die nächste Zahlung bzw. Einlösung; vorhandene Punkte und der erreichte Geldbetrag bleiben erhalten.</p><p>Frühere Bonuswerte werden wertgleich übernommen: 1,50 € entspricht 1 Treuepunkt. Bereits verrechnete Getränke bleiben unverändert. Bei Löschung einer punktgebenden Zahlung werden deren Punkte zurückgenommen; bereits eingelöste Punkte können dadurch einen negativen Punktestand ergeben.</p><div class="ux-dialog-actions"><button id="bonusSettingsSave" class="primary-button" type="submit" disabled>Treuepunkte speichern</button><button id="bonusSettingsReload" class="outline-button" type="button">Erneut laden</button></div></form><p id="bonusSettingsStatus" role="status">Standard: 30,00 € Einzahlung → 2 Treuepunkte. Ein Getränk benötigt 1 Punkt.</p></article>';
    document.querySelector('main.app-shell').append(view);view.querySelector('[data-back]').onclick=()=>showView('settingsDrinksView');byId('bonusSettingsForm').onsubmit=save;byId('bonusSettingsReload').onclick=()=>load(true);byId('bonusSettingsForm').oninput=()=>{dirty=true;byId('bonusSettingsStatus').textContent='Treuepunkte-Einstellungen noch nicht gespeichert.';};
    const button=document.createElement('button');button.className='primary-button';button.type='button';button.textContent='Treuepunkte öffnen';button.onclick=()=>{if(showView('settingsRewardsView')!==false)load();};byId('drinksSettingsRewardsCard').append(button);addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
  }
  window.DrinksRewards={load,beforeView,render,remainingText};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
