/* Publishing credentials and member keys stay in private OneDrive files and RAM. */
(function(global){
  'use strict';
  const S=global.DrinksStore,M=global.DrinksModel,C=global.DeckelCrypto;
  let pending=new Set(),working=false,lastStatus=new Map();
  const linkCache=new Map();
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
    const totals=M.totals(account),reward=M.rewardState(account,policy),state=M.ledger(account);
    return {version:1,balance:totals.balance,credit:reward.prepaid,pointUnits:reward.pointUnits,thresholdCents:reward.threshold,progressCents:reward.progress,awardUnits:M.award(policy),beerUnits:M.pointCost(policy,'beer'),wineUnits:M.pointCost(policy,'wine'),needed:reward.needed,bonusCents:M.award(policy),updatedAt:new Date().toISOString(),bookings:account.bookings.slice(-5).reverse().map(b=>({type:b.type,cents:b.cents,createdAt:b.createdAt,...(b.type==='challenge'?{direction:b.direction,code:b.code}:{}),...(b.type==='challenge-reward'?{month:b.month,score:b.score}:{}),...(b.type==='birthday-reward'?{year:b.year}:{}),...((b.type==='payment'&&state.reversedPayments.has(b.id)||b.type==='bonus'&&state.reversedPayments.has(b.paymentId)||b.type==='drinks'&&state.drinks.get(b.id)?.count===0)?{cancelled:true}:{}),...(['drinks','correction'].includes(b.type)?{count:b.count,...(b.pointUnits?{pointUnits:b.pointUnits}:{}),...((b.drink==='wine'||b.type==='correction'&&account.bookings.find(t=>t.id===b.targetId)?.drink==='wine')?{drink:'wine'}:{})}:b.type==='payment'?{method:b.method}:{})}))};
  }
  async function publish(id,prepared=null){
    const central=await global.DrinksCentral?.connection();if(central){const saved=await S.readMobileFile(await S.mobileFileName(id));if(!saved)return false;const record=C.access(saved.data);if(record.memberId!==String(id))throw Error('Handyzugang gehört zu einem anderen Konto.');await global.DrinksCentral.register(central,record);setStatus(id,'Handyansicht ist direkt mit dem Getränkekonto verbunden.');return true;}
    const connection=prepared?.connection||await config();if(!connection)return false;
    const filename=prepared?.filename||await S.mobileFileName(id),path='/contents/deckel/';
    for(let attempt=0;attempt<3;attempt++){
      const saved=attempt===0&&prepared?.record?{data:prepared.record}:await S.readMobileFile(filename);if(!saved)return false;
      const record=C.access(saved.data);if(record.memberId!==id)throw new Error('Handyzugang gehört zu einem anderen Konto.');
      const [previous,account,policy]=await Promise.all([gh(connection,path+record.alias+'.json?ref=main').catch(error=>{if(error.status!==404)throw error;return null;}),S.read(id),S.rewards()]);
      const data=snapshot(account,policy);const access=await global.DrinksPush?.actions?.(record).catch(()=>null);if(access?.actionCapability)data.actions={origin:access.origin,capability:access.actionCapability,revision:record.revision};const undo=M.correctable(account);if(undo.count)data.undo={targetId:undo.targetId};
      const envelope=await C.seal(data,record),check=await S.readMobileFile(filename);
      if(check?.data.revision!==record.revision)continue;
      try{
        await gh(connection,path+record.alias+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update encrypted deckel snapshot',branch:'main',content:btoa(JSON.stringify(envelope)),...(previous?{sha:previous.sha}:{})})});
        const after=await S.readMobileFile(filename);if(after?.data.revision!==record.revision)continue;
        setStatus(id,'Handyansicht aktualisiert · '+new Date(data.updatedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'. Auf dem Handy kann die Aktualisierung einige Minuten dauern.');return true;
      }catch(error){if(![409,422].includes(error.status))throw error;}
    }throw new Error('Handyansicht wird gleichzeitig geändert. Bitte erneut aktualisieren.');
  }
  function queue(id){pending.add(String(id));setStatus(String(id),'Handyansicht wird aktualisiert …');flush();}
  async function flush(){if(working)return;working=true;try{while(pending.size){const id=pending.values().next().value;pending.delete(id);try{if(!await publish(id))setStatus(id,'Noch kein Handyzugang eingerichtet.');}catch{setStatus(id,'Buchungen gespeichert. Die Handyansicht ist noch nicht aktualisiert. Bitte erneut aktualisieren.');}}}finally{working=false;}}
  async function link(id,signature,rotate=false){
    const [connection,account,filename]=await Promise.all([config(),S.read(id),S.mobileFileName(id)]);
    if(!connection)throw new Error('Die Handyansicht muss zuerst unter Einstellungen → Getränkeverwaltung → Handy-Deckel eingerichtet werden.');
    if(!signature||JSON.stringify(account.pin)!==signature)throw Object.assign(new Error('PIN-Status geändert. Bitte dein Getränkekonto erneut öffnen.'),{code:'pinChanged'});
    const sourceKey=S.sourceKey?.()||'',old=await S.readMobileFile(filename);let record=old?.data;
    const created=!record||rotate;
    if(created){record={...C.create(),memberId:id,revision:crypto.randomUUID()};if(old)record.alias=C.access(old.data).alias;await S.writeMobileFile(filename,record,old?.item?.eTag);linkCache.delete(String(id));}
    C.access(record);if(record.memberId!==id)throw new Error('Handyzugang gehört zu einem anderen Konto.');
    const known=linkCache.get(String(id));let url;
    if(!created&&known?.revision===record.revision&&known.key===record.key&&known.sourceKey===sourceKey&&known.until>Date.now())url=new URL(known.url);
    else{
      if(created&&!await publish(id,{connection,filename,record}))throw new Error('Die Handyansicht konnte nicht veröffentlicht werden.');
      url=new URL('deckel.html',location.href);url.search='';url.hash=new URLSearchParams({r:connection.repo,a:record.alias,k:record.key}).toString();
    }
    // Fresh authority and key checks also apply when the QR URL is reused from RAM.
    const [current,check]=await Promise.all([S.readMobileFile(filename),S.read(id)]);
    if(current?.data.revision!==record.revision||current.data.key!==record.key||current.data.alias!==record.alias||S.sourceKey&&S.sourceKey()!==sourceKey)throw new Error('Der Zugang oder die OneDrive-Verbindung wurde gerade geändert. Bitte erneut öffnen.');
    if(JSON.stringify(check.pin)!==signature)throw Object.assign(new Error('Bitte erneut mit deiner PIN anmelden.'),{code:'pinChanged'});
    linkCache.set(String(id),{revision:record.revision,key:record.key,sourceKey,url:url.href,until:Date.now()+300000});
    if(!created)queue(id);return url.href;
  }
  async function preparePortalAccess(id,isCurrent=()=>true){
    id=String(id);
    const guard=()=>{if(!isCurrent()||!requireAdmin('settingsPortalView')||!adminUnlocked)throw Error('Freigabe wurde geändert. Bitte das Mitglied erneut auswählen.');};
    guard();const connection=await global.DrinksCentral.connection();guard();
    if(!connection)throw Error('Bitte den zentralen Kontodienst verbinden.');
    const source=connection.source,current=()=>{guard();if(S.sourceKey()!==source)throw Error('Der Datenordner wurde geändert. Bitte erneut öffnen.');};
    current();const filename=await S.mobileFileName(id),saved=await S.readMobileFile(filename);current();
    const record=saved?.data||{...C.create(),memberId:id,revision:crypto.randomUUID()};
    C.access(record);if(record.memberId!==id)throw Error('Handyzugang gehört zu einem anderen Konto.');
    if(!saved){await S.writeMobileFile(filename,record);current();}
    // Passkey enrollment uses the central service, without publishing a legacy
    // GitHub snapshot or creating a permanent link containing the member key.
    await global.DrinksCentral.register(connection,record);current();
    const confirmed=await S.readMobileFile(filename);current();
    if(confirmed?.data.alias!==record.alias||confirmed.data.revision!==record.revision||confirmed.data.key!==record.key||confirmed.data.memberId!==id)throw Error('Der Zugang wurde gerade geändert. Bitte erneut öffnen.');
    return record;
  }
  async function adminLink(id){
    if(!requireAdmin('settingsPortalView'))throw Error('Bitte die Administration entsperren.');
    const account=await S.read(String(id));if(!adminUnlocked)throw Error('Administration wurde gesperrt.');
    const url=await link(String(id),JSON.stringify(account.pin));if(!adminUnlocked)throw Error('Administration wurde gesperrt.');return url;
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
  global.DrinksMobile={link,adminLink,preparePortalAccess,queue,refreshAll,publish,connect,status:id=>lastStatus.get(id)||'',snapshot};
})(typeof window==='undefined'?globalThis:window);
