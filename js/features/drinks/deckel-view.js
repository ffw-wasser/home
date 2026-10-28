'use strict';
const $=id=>document.getElementById(id),euro=c=>(c/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const pointText=u=>(u/150).toLocaleString('de-DE',{maximumFractionDigits:4});
let generation=0,lastUpdated='',hasData=false,loading=false,currentAccess='',thanksTimer,currentRequest=null,funTimer,quoteIndex=0;
const thanked=new Set();
function hideThanks(){clearTimeout(thanksTimer);$('thanks').hidden=true;}
function showThanks(paid,alias){hideThanks();if(!paid){thanked.delete(alias);return;}if(thanked.has(alias))return;thanked.add(alias);$('thanks').hidden=false;thanksTimer=setTimeout(hideThanks,3000);}
function enableNudge(enabled){$('coaster').setAttribute?.('aria-disabled',String(!enabled));$('coaster').tabIndex=enabled?0:-1;}
function resetNudge(){clearTimeout(funTimer);$('coaster').classList.toggle('is-nudged',false);$('coaster').classList.toggle('is-laughing',false);$('deckel-laugh').hidden=true;$('deckel-quote').hidden=true;$('deckel-quote').textContent='';$('coaster').setAttribute?.('aria-labelledby','balanceLabel balance');$('coaster').setAttribute?.('aria-describedby','updated deckel-tap-hint');}
function nudgeDeckel(){
 if(!hasData||loading||document.hidden)return;
 const sayings=[
 'Ich bin ein Bierdeckel. Kein Untersetzer für Ausreden.',
 'Ganz ruhig – ich wackle nur. Dein Kontostand bleibt gleich.',
 'Ich zähle mit. Fingerabdrücke kosten heute nichts.',
 'Ein kleiner Stups für dich. Eine große Runde für den Deckel.',
 'Bitte nicht knicken. Ich habe schon genug auf dem Deckel.',
 'Ich halte die Stellung. Auch ohne Fahrzeugbesetzung.',
 'Alarmstufe gemütlich: Der Deckel ist im Dienst.',
 'Ich bin rund. Deine Buchhaltung bleibt trotzdem gerade.',
 'Hier wird nichts gelöscht. Höchstens der Durst – nach Dienstschluss.',
 'Mein Löschmittel heute: ein freundlicher Blick.',
 'Anstupsen ist kostenlos. Das steht sogar auf meinem Deckel.',
 'Kein Funkloch hier. Ich habe deinen Finger empfangen.',
 'Lage stabil. Deckel kurz ins Wackeln geraten.',
 'Ich bin der einzige Stapel im Gerätehaus, der Sprüche klopft.',
 'Ich trage Verantwortung. Und gelegentlich ein Glas.',
 'Für einen Bierdeckel habe ich erstaunlich viel auf dem Schirm.',
 'Ich brauche keine Leiter. Ich liege schon richtig.',
 'Ein Deckel für alle Fälle. Außer für Marmeladengläser.',
 'Ich nehme alles auf meine Kappe. Die ist nur ziemlich flach.',
 'Wasser marsch? Für mich reicht ein trockener Tisch.',
 'Meine Lieblingsübung: ruhig liegen und mitdenken.',
 'Bitte Abstand halten. Ich bin gleich wieder rund.',
 'Ob Bier oder Wein: Ich verliere keinen Strich aus den Augen.',
 'Treue zahlt sich aus. Ich sammle lieber Punkte als Staub.',
 'Ich bin kein Orakel. Ich kenne nur deinen Deckel.',
 'Die Runde ist gesellig. Die Abrechnung bleibt sachlich.',
 'Mein Einsatzbericht: einmal angestupst, alles unverändert.',
 'So viel Aufmerksamkeit! Gleich werde ich eckig.',
 'Ich kann nichts dafür. Ich wurde so rund geboren.',
 'Feierabend für den Durst. Bereitschaft für den Deckel.'
 ];
 resetNudge();void $('coaster').offsetWidth;$('coaster').classList.toggle('is-nudged',true);$('coaster').classList.toggle('is-laughing',true);$('deckel-laugh').hidden=false;$('deckel-quote').hidden=false;$('deckel-quote').textContent=sayings[quoteIndex++%sayings.length];$('coaster').setAttribute?.('aria-describedby','updated deckel-tap-hint deckel-quote');funTimer=setTimeout(resetNudge,4000);
}
function credentials(){const identity=globalThis.H2OIdentity?.credentials();if(!identity)throw Object.assign(Error('Bitte mit deinem H₂O-Passkey oder Passwort anmelden.'),{status:401});return {repo:'portal',record:identity};}
function clear({preserveResources=false}={}){globalThis.H2OPortal?.clear();if(!preserveResources)globalThis.DeckelMobile?.show(false);globalThis.DeckelChallenge?.clear();resetNudge();enableNudge(false);hideThanks();$('account').hidden=true;for(const id of ['balance','credit','bonus','updated','points','points-use','stack-note'])$(id).textContent='';$('paypal').removeAttribute('href');hasData=false;}
function loadError(error){if(error.name==='OperationError')return 'Dieser Zugang kann den aktuellen Deckel nicht öffnen. Bitte deinen QR-Code am Gerätehaus-iPad erneut scannen.';if(error.name==='AbortError')return 'Die Verbindung dauert zu lange. Bitte erneut aktualisieren.';if(error.name==='TypeError')return 'Keine Internetverbindung zum Deckel. Bitte Verbindung prüfen und erneut aktualisieren.';return error.message||'Keine Verbindung. Bitte erneut versuchen.';}
async function load(options={}){
 if(options.checkUpdate!==false)globalThis.DeckelUpdate?.check();
 const number=++generation,startupToken=(!hasData||globalThis.DeckelStartup?.isActive?.())?globalThis.DeckelStartup?.begin():undefined;let startupPending=false;currentRequest?.abort();resetNudge();if($('deckel-load-retry'))$('deckel-load-retry').hidden=true;loading=true;$('status').setAttribute?.('data-state','loading');enableNudge(false);hideThanks();$('status').textContent=hasData?'Kontostand wird geprüft …':'Kontostand wird geladen …';
 try{
  if(globalThis.H2OIdentity?.onboarding())throw Error('Bitte unter Konto einen Passkey oder ein Passwort einrichten oder anmelden.');
  await globalThis.H2OIdentity?.prepare();globalThis.DeckelInstall?.refresh();
  if(!globalThis.H2OIdentity?.credentials())throw Object.assign(Error('Bitte mit deinem H₂O-Passkey oder Passwort anmelden.'),{status:401});
  globalThis.DeckelStartup?.stage(startupToken,'Dein Portal wird vorbereitet …');
  const {repo,record}=credentials(),access=repo+':'+record.alias+':'+record.key;
  if(access!==currentAccess){clear();lastUpdated='';currentAccess=access;}
  const controller=new AbortController();currentRequest=controller;const timer=setTimeout(()=>controller.abort(),20000);let response,text;
  try{const live=await globalThis.DeckelLive.load(record,controller.signal);response={ok:true};text=JSON.stringify(live);}finally{clearTimeout(timer);if(currentRequest===controller)currentRequest=null;}
  if(!response.ok)throw new Error('Dein Deckel ist noch nicht verfügbar. Bitte am Gerätehaus-iPad aktualisieren.');
  if(text.length>8000)throw new Error('Die Deckel-Datei konnte nicht geprüft werden. Bitte erneut aktualisieren.');const data=await DeckelCrypto.open(JSON.parse(text),record);if(number!==generation||document.hidden)return;
  const layers=data.balance?Math.min(5,Math.ceil(data.balance/1000)):0;$('deckel-stack').parentElement.style.setProperty('--stack-count',layers);$('deckel-stack').replaceChildren();for(let i=layers-1;i>=0;i--){const layer=document.createElement('span');layer.className='deckel-layer';layer.style.setProperty('--layer',i);$('deckel-stack').append(layer);}$('stack-note').textContent=layers?'Je höher der offene Betrag, desto höher der Stapel. Die Schichten sind symbolisch.':'';
  $('coaster').classList.toggle('is-paid',data.balance===0);$('balance').textContent=euro(data.balance);$('balanceLabel').textContent=data.balance===0?'Bezahlt':'Offen';showThanks(data.balance===0,record.alias);
  $('credit').hidden=data.pointUnits===undefined||data.credit===0;$('credit').textContent='Dein Guthaben: '+euro(data.credit)+' · Für die nächsten Getränke.';
  const units=data.pointUnits??0,award=data.awardUnits??data.bonusCents;$('points').textContent=data.pointUnits===undefined?'–':pointText(units);$('bonus').textContent=data.needed?'Noch '+euro(data.needed)+' Einzahlung bis zu '+pointText(award)+' weiteren Punkten.':'Ziel erreicht. Die nächste bestätigte Einzahlung vergibt neue Treuepunkte.';
  $('loyalty-progress').hidden=!data.thresholdCents;$('loyalty-progress').max=data.thresholdCents||1;$('loyalty-progress').value=Math.min(data.progressCents||0,data.thresholdCents||1);
  $('points-use').textContent=(data.pointUnits===undefined?'Treuepunkte und Einzahlungen werden beim nächsten Abgleich im Gerätehaus aktualisiert. ':'')+(units<0?'Bereits eingelöste Punkte wurden nach einer Zahlungslöschung zurückgenommen. Neue Punkte gleichen den Punktestand aus. ':'')+'Einlösen: Bier '+pointText(data.beerUnits??150)+((data.beerUnits??150)===150?' Punkt':' Punkte')+' · Wein '+pointText(data.wineUnits??150)+((data.wineUnits??150)===150?' Punkt.':' Punkte.');
  $('paypal').hidden=data.balance<=0;$('payment-note').hidden=data.balance<=0;$('payment-help').hidden=data.balance<=0;if(data.balance>0)$('paypal').href='https://paypal.me/FeuerwehrWasser/'+(data.balance/100).toFixed(2)+'EUR';
  $('updated').textContent=(data.actions?.central?'Aktueller Kontostand: ':'Übertragen vom Gerätehaus: ')+new Date(data.updatedAt).toLocaleString('de-DE');$('account').hidden=false;hasData=true;globalThis.DeckelMobile?.show(true,{resources:Boolean(globalThis.DeckelMobile?.isResources?.())});$('status').setAttribute?.('data-state','success');globalThis.DeckelActions?.render(data).catch(()=>{});globalThis.DeckelChallenge?.render(data).catch(()=>{});startupPending=true;const portalReady=globalThis.H2OPortal?.render(data,{onReady:()=>{if(number===generation)globalThis.DeckelStartup?.finish(startupToken);}});Promise.resolve(portalReady).catch(()=>{}).finally(()=>{if(number===generation)globalThis.DeckelStartup?.finish(startupToken);});$('status').textContent='';lastUpdated=data.updatedAt;globalThis.DeckelPush?.markRead();
 }catch(error){if(number!==generation||document.hidden)return;if(!hasData||error.status===401||error.status===403)clear({preserveResources:Boolean(globalThis.DeckelMobile?.isResources?.())});if(globalThis.H2OIdentity&&!hasData)document.getElementById('identity-account').open=true;$('status').setAttribute?.('data-state','error');if($('deckel-load-retry'))$('deckel-load-retry').hidden=[401,403].includes(error.status)||Boolean(globalThis.H2OIdentity?.onboarding());$('status').textContent=loadError(error)+(hasData?' Angezeigt bleibt der Stand vom '+new Date(lastUpdated).toLocaleString('de-DE')+'.':'');}
 finally{if(number===generation){loading=false;enableNudge(hasData&&!document.hidden);if(!startupPending)globalThis.DeckelStartup?.finish(startupToken);}}
}
$('coaster').onclick=nudgeDeckel;$('coaster').onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&!event.repeat){event.preventDefault();nudgeDeckel();}};globalThis.DeckelReload=load;load.isLoading=()=>loading;const refreshView=()=>globalThis.DeckelUpdate?.refresh?globalThis.DeckelUpdate.refresh():load();$('deckel-load-retry')?.addEventListener('click',refreshView);
globalThis.addEventListener('hashchange',()=>{generation++;currentRequest?.abort();currentAccess='';lastUpdated='';clear();load();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){globalThis.DeckelStartup?.begin();generation++;currentRequest?.abort();clear();loading=false;}else load();});
globalThis.addEventListener('pageshow',event=>{if(event.persisted)load();});load();
