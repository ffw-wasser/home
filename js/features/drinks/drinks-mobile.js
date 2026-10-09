/* Publishing credentials and member keys stay in private OneDrive files and RAM. */
(function(global){
  'use strict';
  const S=global.DrinksStore,M=global.DrinksModel,C=global.DeckelCrypto;
  let pending=new Set(),working=false,lastStatus=new Map();
  const repoValid=repo=>/^ffw-wasser\/[A-Za-z0-9_.-]+$/.test(repo)&&repo!=='ffw-wasser/home';
  const setStatus=(id,text)=>{lastStatus.set(id,text);document.dispatchEvent(new CustomEvent('deckel-status',{detail:{id,text}}));};
  async function gh(config,path,options={}){
    if(!repoValid(config.repo)||!/^github_pat_[A-Za-z0-9_]+$/.test(config.token))throw new Error('GitHub-Verbindung ungültig.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let response;
    try{response=await fetch('https://api.github.com/repos/'+config.repo+path,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+config.token,...options.headers},cache:'no-store',signal:controller.signal,redirect:'error'});
    if(!response.ok)throw Object.assign(new Error(response.status===401||response.status===403?'GitHub-Zugang abgelaufen oder ohne Schreibrechte. Bitte in der Verwaltung prüfen.':'Handyansicht konnte nicht veröffentlicht werden. Bitte später erneut versuchen.'),{status:response.status});
    return await response.json();}finally{clearTimeout(timer);}
  }
  async function config(){const value=await S.readMobileFile('handy-verbindung.json');return value?.data||null;}
  function snapshot(account,policy){
    const totals=M.totals(account),reward=M.rewardState(account,policy);
    return {version:1,balance:totals.balance,credit:reward.credit,needed:reward.needed,bonusCents:policy.cents,updatedAt:new Date().toISOString(),bookings:account.bookings.slice(-5).reverse().map(b=>({type:b.type,cents:b.cents,createdAt:b.createdAt,...(b.type==='drinks'?{count:b.count}:b.type==='payment'?{method:b.method}:{})}))};
  }
  async function publish(id){
    const connection=await config();if(!connection)return false;
    const filename=await S.mobileFileName(id),path='/contents/deckel/';
    for(let attempt=0;attempt<3;attempt++){
      const saved=await S.readMobileFile(filename);if(!saved)return false;
      const record=C.access(saved.data);if(record.memberId!==id)throw new Error('Handyzugang gehört zu einem anderen Konto.');
      let previous;try{previous=await gh(connection,path+record.alias+'.json?ref=main');}catch(error){if(error.status!==404)throw error;}
      const account=await S.read(id),policy=await S.rewards(),data=snapshot(account,policy);
      const envelope=await C.seal(data,record),check=await S.readMobileFile(filename);
      if(check?.data.revision!==record.revision)continue;
      try{
        await gh(connection,path+record.alias+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update encrypted deckel snapshot',branch:'main',content:btoa(JSON.stringify(envelope)),...(previous?{sha:previous.sha}:{})})});
        const after=await S.readMobileFile(filename);if(after?.data.revision!==record.revision)continue;
        setStatus(id,'Handyansicht veröffentlicht · '+new Date(data.updatedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'. Auf dem Handy kann die Aktualisierung einige Minuten dauern.');return true;
      }catch(error){if(![409,422].includes(error.status))throw error;}
    }throw new Error('Handyansicht wird gleichzeitig geändert. Bitte erneut aktualisieren.');
  }
  function queue(id){pending.add(String(id));setStatus(String(id),'Handyansicht wird aktualisiert …');flush();}
  async function flush(){if(working)return;working=true;try{while(pending.size){const id=pending.values().next().value;pending.delete(id);try{if(!await publish(id))setStatus(id,'Noch kein Handyzugang eingerichtet.');}catch{setStatus(id,'In OneDrive gespeichert. Die Handyansicht ist noch nicht aktualisiert. Bitte „Handyansicht aktualisieren“ wählen.');}}}finally{working=false;}}
  async function link(id,signature,rotate=false){
    const connection=await config();if(!connection)throw new Error('Die Handyansicht muss zuerst unter Einstellungen → Handy-Deckel eingerichtet werden.');
    const account=await S.read(id);if(!signature||!account.pin||JSON.stringify(account.pin)!==signature)throw Object.assign(new Error('Bitte erneut mit deiner PIN anmelden.'),{code:'pinChanged'});
    const filename=await S.mobileFileName(id),old=await S.readMobileFile(filename);
    let record=old?.data;
    if(!record||rotate){record={...C.create(),memberId:id,revision:crypto.randomUUID()};if(old)record.alias=C.access(old.data).alias;await S.writeMobileFile(filename,record,old?.item?.eTag);}
    C.access(record);if(record.memberId!==id)throw new Error('Handyzugang gehört zu einem anderen Konto.');
    const check=await S.read(id);if(JSON.stringify(check.pin)!==signature)throw Object.assign(new Error('Bitte erneut mit deiner PIN anmelden.'),{code:'pinChanged'});
    if(!await publish(id))throw new Error('Die Handyansicht konnte nicht veröffentlicht werden.');
    const current=await S.readMobileFile(filename);if(current?.data.revision!==record.revision)throw new Error('Der Zugang wurde gerade geändert. Bitte erneut öffnen.');
    const url=new URL('deckel.html',location.href);url.search='';url.hash=new URLSearchParams({r:connection.repo,a:record.alias,k:record.key}).toString();return url.href;
  }
  async function connect(repo,token){
    if(!adminUnlocked)throw new Error('Bitte zuerst die Administration entsperren.');
    const connection={version:1,repo:repo.trim(),token:token.trim()},info=await gh(connection,'');
    if(info.private||info.default_branch!=='main')throw new Error('Bitte ein separates öffentliches Repository mit Hauptzweig „main“ verwenden.');
    const old=await S.readMobileFile('handy-verbindung.json');if(old&&old.data.repo!==connection.repo)throw new Error('Das bestehende Daten-Repository darf nicht gewechselt werden: Persönliche Links würden ungültig.');
    if(!adminUnlocked)throw new Error('Administration wurde gesperrt.');
    let file;try{file=await gh(connection,'/contents/deckel/.publication-check.json?ref=main');}catch(e){if(e.status!==404)throw e;}
    await gh(connection,'/contents/deckel/.publication-check.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Check deckel publishing access',branch:'main',content:btoa('{"version":1}'),...(file?{sha:file.sha}:{})})});
    if(!adminUnlocked)throw new Error('Administration wurde gesperrt.');
    await S.writeMobileFile('handy-verbindung.json',connection,old?.item?.eTag);return connection.repo;
  }
  async function refreshAll(){const ids=await S.mobileIds();for(const id of ids)queue(id);return ids.length;}
  function init(){
    const view=document.createElement('section');view.id='settingsMobileView';view.className='view settings-view';view.hidden=true;
    view.innerHTML='<div class="screen-heading"><div><p class="eyebrow">Getränkeverwaltung</p><h2>Handy-Deckel</h2></div><button class="outline-button" type="button" data-back>Zurück zur Getränkeverwaltung</button></div><article class="panel"><h3>Automatische Veröffentlichung einrichten</h3><p>Nur verschlüsselte Kontostände werden veröffentlicht. Namen, Mitgliederkennungen, PINs und Schlüssel bleiben in OneDrive.</p><ol><li>Ein separates öffentliches GitHub-Repository „deckel-daten“ mit README und Hauptzweig „main“ anlegen.</li><li>Einen Fine-grained Token nur für dieses Repository erstellen: Contents → Read and write. Keine weiteren Schreibrechte vergeben.</li><li>Repository und Token hier eintragen. Der Token bleibt in einer privaten OneDrive-Datei; niemals im Chat senden.</li></ol><p><a href="https://github.com/new" target="_blank" rel="noopener noreferrer">Daten-Repository anlegen</a> · <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">GitHub-Zugang erstellen</a></p><form id="deckel-connect"><label for="deckel-repo">Daten-Repository</label><input id="deckel-repo" class="text-input" value="ffw-wasser/deckel-daten" required autocomplete="off"><label for="deckel-token">Fine-grained Token</label><input id="deckel-token" class="text-input" type="password" required autocomplete="off" spellcheck="false"><button class="primary-button" type="submit">Verbindung prüfen und in OneDrive speichern</button></form><p id="deckel-setup-status" role="status"></p><button id="deckel-sync-all" type="button">Alle Handyansichten aktualisieren</button><p>Nach Strichen und Zahlungen wird automatisch veröffentlicht, solange das iPad online ist und OneDrive verbunden bleibt. Beim Öffnen der Getränke wird eine fehlgeschlagene Aktualisierung erneut versucht. Die Homepage zeigt den letzten veröffentlichten Stand. Öffentliche GitHub-Versionen bleiben im Verlauf erhalten; ein neuer Link schützt zukünftige Aktualisierungen.</p></article>';
    new MutationObserver(()=>{if(view.hidden)byId('deckel-token').value='';}).observe(view,{attributes:true,attributeFilter:['hidden']});
    document.querySelector('main.app-shell').append(view);view.querySelector('[data-back]').onclick=()=>{byId('deckel-token').value='';showView('settingsDrinksView');};
    const button=document.createElement('button');button.className='primary-button';button.type='button';button.textContent='Handy-Deckel öffnen';button.onclick=()=>{if(requireAdmin('settingsMobileView'))showView('settingsMobileView');};byId('drinksSettingsMobileCard').append(button);
    byId('deckel-connect').onsubmit=async event=>{event.preventDefault();if(!adminUnlocked)return;const button=event.submitter||byId('deckel-connect').querySelector('button'),token=byId('deckel-token').value;byId('deckel-token').value='';button.disabled=true;byId('deckel-setup-status').textContent='Verbindung wird geprüft …';try{const repo=await connect(byId('deckel-repo').value,token);byId('deckel-setup-status').textContent='Verbunden: '+repo+'. Mitglieder können jetzt ihren QR-Code öffnen.';}catch(e){byId('deckel-setup-status').textContent=e.message;}finally{button.disabled=false;}};
    byId('deckel-sync-all').onclick=async()=>{if(!adminUnlocked)return;try{const count=await refreshAll();byId('deckel-setup-status').textContent=count+' Handyansichten zur Veröffentlichung vorgemerkt.';}catch{byId('deckel-setup-status').textContent='OneDrive-Verbindung prüfen und erneut versuchen.';}};
  }
  global.DrinksMobile={link,queue,refreshAll,publish,connect,status:id=>lastStatus.get(id)||'',snapshot};
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
})(typeof window==='undefined'?globalThis:window);
