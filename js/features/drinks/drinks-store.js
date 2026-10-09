/* Nur OneDrive und Arbeitsspeicher. Keine Finanzdaten/PINs im Browser-Speicher. */
(function(global){
  'use strict';
  const M=global.DrinksModel, FOLDER='Getraenke';
  let contextKey='',cache=new Map(),generation=0,rewardCache=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const notFound=e=>e?.status===404;
  const conflict=e=>[409,412].includes(e?.status);
  const itemUrl=(root,id)=>`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(id)}`;
  function reset(){generation++;contextKey='';cache.clear();rewardCache=null;}
  async function context(create=false,expectedSource=null){
    if(!oneDriveSignedIn())throw new Error('Bitte OneDrive verbinden. Getränke werden nur dort gespeichert.');
    if(navigator.onLine===false)throw new Error('Offline. Bitte vor dem Buchen die Internetverbindung herstellen.');
    const root=await oneDriveResolveSharedRoot(),key=root.driveId+':'+root.id;
    assertSource({key},expectedSource);
    if(contextKey!==key){reset();contextKey=key;}
    const gen=generation;
    let folder;
    try{folder=await (await odFetch(`${itemUrl(root,root.id)}:/${FOLDER}?$select=id,folder`)).json();}
    catch(e){
      if(!notFound(e))throw e;
      if(create){
        try{folder=await(await odFetch(`${itemUrl(root,root.id)}/children`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER,folder:{},'@microsoft.graph.conflictBehavior':'fail'})})).json();}
        catch(e){if(!conflict(e))throw e;folder=await(await odFetch(`${itemUrl(root,root.id)}:/${FOLDER}?$select=id,folder`)).json();}
      }
    }
    if(folder&&!folder.folder)throw new Error('Getraenke muss ein Ordner in OneDrive sein.');
    return {root,key,folder,gen};
  }
  function assertCurrent(ctx){if(ctx.gen!==generation||ctx.key!==contextKey||!oneDriveSignedIn())throw new Error('OneDrive-Verbindung geändert. Bitte das Getränkekonto erneut öffnen.');}
  function assertSource(ctx,expected){if(expected&&ctx.key!==expected)throw Object.assign(new Error('Diese Buchung gehört zum vorherigen OneDrive-Ordner. Bitte die ursprüngliche Verbindung wiederherstellen und erneut prüfen.'),{code:'contextChanged'});}
  const REWARDS_FILE='bonus-einstellungen.json';
  async function readRewards(ctx){
    const path=`${itemUrl(ctx.root,ctx.folder.id)}:/${REWARDS_FILE}`;
    for(let attempt=0;attempt<3;attempt++){
      let item;try{item=await(await odFetch(path+'?$select=id,eTag,file')).json();}catch(e){if(notFound(e))return null;throw e;}
      if(!item.file||!item.eTag)throw new Error('Die Treuepunkte-Einstellungen besitzen keine gültige Dateiversion.');
      const policy=M.validateRewardSettings(await(await odFetch(itemUrl(ctx.root,item.id)+'/content',{cache:'no-store'})).json());
      const after=await(await odFetch(itemUrl(ctx.root,item.id)+'?$select=id,eTag')).json();assertCurrent(ctx);
      if(after.eTag!==item.eTag)continue;
      rewardCache=clone(policy);return {policy,item};
    }
    throw new Error('Die Treuepunkte-Einstellungen werden gerade geändert. Bitte erneut laden.');
  }
  async function rewards(expectedSource=null){
    const ctx=await context(true,expectedSource);
    assertSource(ctx,expectedSource);
    for(let attempt=0;attempt<4;attempt++){
      const old=await readRewards(ctx);if(old)return clone(old.policy);
      const policy={schemaVersion:2,id:crypto.randomUUID(),revision:crypto.randomUUID(),startedAt:new Date().toISOString(),thresholdCents:3000,awardUnits:300,beerUnits:150,wineUnits:150};
      assertCurrent(ctx);
      try{await odFetch(`${itemUrl(ctx.root,ctx.folder.id)}:/${REWARDS_FILE}:/content`,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':'"0"'},body:JSON.stringify(policy)},false);assertCurrent(ctx);rewardCache=clone(policy);return policy;}
      catch(error){if(conflict(error))continue;const check=await readRewards(ctx).catch(()=>null);if(check)return clone(check.policy);throw error;}
    }
    throw new Error('Treuepunkte-Einstellungen konnten nicht angelegt werden. Bitte erneut versuchen.');
  }
  async function saveRewards(count,cents,expectedRevision){
    let settings=typeof count==='object'?count:null;if(settings)expectedRevision=cents;
    if(typeof adminUnlocked==='undefined'||!adminUnlocked)throw new Error('Bitte zuerst die Verwaltung entsperren.');
    const ctx=await context(true),old=await readRewards(ctx);
    if(!old||old.policy.revision!==expectedRevision)throw new Error('Die Treuepunkte-Einstellungen wurden inzwischen geändert. Bitte erneut laden.');
    if(!settings){M.validateRewardSettings({...old.policy,schemaVersion:1,count,cents});settings={thresholdCents:count*M.PRICE,awardUnits:cents};}
    const policy=M.validateRewardSettings(settings?{...M.rewardPolicy(old.policy),...settings,revision:crypto.randomUUID()}:{...old.policy,count,cents,revision:crypto.randomUUID()});
    if(!adminUnlocked)throw new Error('Die Verwaltung wurde gesperrt.');assertCurrent(ctx);
    try{await odFetch(itemUrl(ctx.root,old.item.id)+'/content',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':old.item.eTag},body:JSON.stringify(policy)},false);assertCurrent(ctx);rewardCache=clone(policy);return policy;}
    catch(error){const check=await readRewards(ctx).catch(()=>null);if(check?.policy.revision===policy.revision)return clone(check.policy);if(conflict(error))throw new Error('Die Treuepunkte-Einstellungen wurden inzwischen geändert. Bitte erneut laden.');throw error;}
  }
  async function previewRewards(){const ctx=await context();if(!ctx.folder)return null;return (await readRewards(ctx))?.policy||null;}
  const cachedRewards=()=>rewardCache?clone(rewardCache):null;
  async function fileName(memberId){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(memberId)));return 'konto-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+'.json';}
  async function readWithContext(ctx,memberId,listed=null){
    assertCurrent(ctx);
    if(!ctx.folder)return {account:M.empty(memberId),item:null};
    const path=`${itemUrl(ctx.root,ctx.folder.id)}:/${await fileName(memberId)}`;
    for(let attempt=0;attempt<3;attempt++){
      let item;
      try{item=attempt===0&&listed?listed:await(await odFetch(path+'?$select=id,eTag,file')).json();}catch(e){if(notFound(e))return {account:M.empty(memberId),item:null};throw e;}
      if(!item.file||!item.eTag)throw new Error('Die Getränkedatei besitzt keine gültige Dateiversion.');
      assertCurrent(ctx);
      const known=cache.get(String(memberId));
      // Dateiversion frisch prüfen; bereits geladene, unveränderte Konten nicht erneut herunterladen.
      if(known?.eTag===item.eTag&&known.account.pinChoiceVersion===1)return {account:clone(known.account),item};
      const data=await(await odFetch(itemUrl(ctx.root,item.id)+'/content',{cache:'no-store'})).json();
      const after=await(await odFetch(itemUrl(ctx.root,item.id)+'?$select=id,eTag')).json();
      assertCurrent(ctx);
      if(after.eTag!==item.eTag)continue;
      let account=M.validate(data,memberId);
      // Einmalige Umstellung: alte Pflicht-PINs entfernen, neue freiwillige PINs erhalten.
      if(account.pinChoiceVersion!==1){
        account={...account,pin:null,pinChoiceVersion:1};assertCurrent(ctx);
        try{
          const saved=await(await odFetch(itemUrl(ctx.root,item.id)+'/content',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':item.eTag},body:JSON.stringify(account)},false)).json();
          assertCurrent(ctx);item.eTag=saved.eTag||'';
        }catch(error){
          if(conflict(error))continue;
          // Bei verlorener Antwort erneut lesen; Buchungen niemals blind überschreiben.
          const check=await(await odFetch(itemUrl(ctx.root,item.id)+'/content',{cache:'no-store'})).json();
          if(check.pinChoiceVersion!==1)throw error;
          continue;
        }
      }
      cache.set(String(memberId),{account:clone(account),eTag:item.eTag});return {account,item};
    }
    throw new Error('Das Getränkekonto wird gerade geändert. Bitte erneut versuchen.');
  }
  async function read(memberId){const ctx=await context();return (await readWithContext(ctx,memberId)).account;}
  function cached(memberId){return cache.has(String(memberId))?clone(cache.get(String(memberId)).account):M.empty(memberId);}
  async function list(memberIds){
    const ctx=await context(),next=new Map();
    if(!ctx.folder){assertCurrent(ctx);cache=next;return memberIds.map(id=>M.empty(id));}
    const files=[];let url=itemUrl(ctx.root,ctx.folder.id)+'/children?$select=id,name,eTag,file';
    while(url){const data=await(await odFetch(url)).json();files.push(...(data.value||[]));url=data['@odata.nextLink'];}
    const remaining=memberIds.map(String),results=new Map();
    await Promise.all(Array.from({length:Math.min(4,remaining.length)},async()=>{
      while(remaining.length){
        const id=remaining.shift();
        const name=await fileName(id),entry=files.find(f=>f.file&&f.name===name),old=cache.get(id);
        let account;
        if(!entry)account=M.empty(id);
        else if(old?.eTag===entry.eTag)account=clone(old.account);
        else account=(await readWithContext(ctx,id,entry)).account;
        assertCurrent(ctx);results.set(id,account);next.set(id,{account:clone(account),eTag:cache.get(id)?.eTag||entry?.eTag||''});
      }
    }));
    assertCurrent(ctx);cache=next;return memberIds.map(id=>results.get(String(id)));
  }
  async function mutate(memberId,change,expectedPin=null,expectedSource=null){
    const ctx=await context(true,expectedSource);
    assertSource(ctx,expectedSource);
    for(let attempt=0;attempt<4;attempt++){
      const {account,item}=await readWithContext(ctx,memberId);
      if(expectedPin&&JSON.stringify(account.pin)!==expectedPin)throw Object.assign(new Error('Deine PIN wurde geändert. Bitte erneut anmelden.'),{code:'pinChanged'});
      const next=change(clone(account));M.validate(next,memberId);
      if(JSON.stringify(next)===JSON.stringify(account))return account;
      const url=item?itemUrl(ctx.root,item.id)+'/content':`${itemUrl(ctx.root,ctx.folder.id)}:/${await fileName(memberId)}:/content`;
      assertCurrent(ctx);
      try{
        const response=await odFetch(url,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':item?.eTag||'"0"'},body:JSON.stringify(next)},false);
        const saved=await response.json();assertCurrent(ctx);cache.set(String(memberId),{account:clone(next),eTag:saved.eTag||''});return next;
      }catch(error){
        if(conflict(error))continue;
        // Bei einer verlorenen Antwort prüfen, ob genau diese Änderung angekommen ist.
        // Kein blindes Wiederholen einer Zahlung mit einer neuen Buchungsnummer.
        try{const check=await readWithContext(ctx,memberId);if(JSON.stringify(change(clone(check.account)))===JSON.stringify(check.account))return check.account;}catch{}
        throw error;
      }
    }
    throw Object.assign(new Error('Das Konto wurde gleichzeitig geändert. Bitte erneut speichern.'),{code:'conflict'});
  }
  async function setPin(memberId,pin){if(typeof adminUnlocked==='undefined'||!adminUnlocked)throw new Error('Bitte zuerst die Administration entsperren.');const record=await M.createPin(pin);if(!adminUnlocked)throw new Error('Administration wurde gesperrt.');return mutate(memberId,a=>{if(!adminUnlocked)throw new Error('Administration wurde gesperrt.');return {...a,pin:record};});}
  async function changeOwnPin(memberId,currentPin,newPin){
    const account=await read(memberId);
    if(account.pin&&!await M.verifyPin(currentPin,account.pin))throw Object.assign(new Error('Die aktuelle PIN stimmt nicht.'),{code:'wrongPin'});
    const signature=JSON.stringify(account.pin),record=newPin===null?null:await M.createPin(newPin);
    return mutate(memberId,a=>({...a,pin:record}),signature);
  }
  async function book(memberId,booking,pinSignature,expectedSource=null){
    if(!pinSignature)throw new Error('Bitte zuerst dein Getränkekonto öffnen.');
    if(!['drinks','payment','correction'].includes(booking.type))throw new Error('Treuepunkte werden ausschließlich automatisch nach einer bestätigten Zahlung gebucht.');
    if(booking.type==='correction'&&booking.confirmation!==undefined)throw new Error('Bezahlte Buchungen dürfen nur durch die Administration gelöscht werden.');
    if(booking.type==='payment'&&(booking.confirmation!=='member'||booking.method!=='cash'))throw new Error('Diese Zahlung muss durch die Administration eingetragen werden.');
    const policy=M.rewardPolicy(await rewards(expectedSource)),account=await mutate(memberId,a=>{
      if(booking.pointUnits!==undefined&&!a.bookings.some(b=>b.id===booking.id)&&booking.pointUnits!==booking.count*M.pointCost(policy,booking.drink||'beer'))throw Object.assign(new Error('Treuepunkte-Einstellung geändert. Bitte neu vormerken.'),{code:'pointsChanged'});
      if(booking.type==='correction'&&!a.bookings.some(b=>b.id===booking.id)&&M.day(booking.createdAt)!==M.day(new Date().toISOString()))throw Object.assign(new Error('Nur heute gebuchte, vollständig unbezahlte Getränke können zurückgenommen werden.'),{code:'correctionChanged'});
      return M.appendWithReward(a,booking,policy);
    },pinSignature,expectedSource);
    // Publishing failure must never turn a confirmed ledger write into a failed payment.
    try{global.DrinksMobile?.queue(String(memberId));}catch{}return account;
  }
  async function bookMany(memberId,bookings,pinSignature,expectedSource=null){
    if(!pinSignature)throw new Error('Bitte zuerst dein Getränkekonto öffnen.');
    if(!Array.isArray(bookings)||!bookings.length||bookings.length>1000||bookings.some(b=>!['drinks','correction'].includes(b?.type)))throw new Error('Ungültige Getränkesammlung.');
    const policy=bookings.some(b=>b.pointUnits!==undefined)?M.rewardPolicy(await rewards(expectedSource)):null;
    const account=await mutate(memberId,a=>{
      for(const b of bookings)if(!a.bookings.some(old=>old.id===b.id)&&b.pointUnits!==undefined&&b.pointUnits!==b.count*M.pointCost(policy,b.drink||'beer'))throw Object.assign(new Error('Die Treuepunkte-Einstellung wurde geändert. Bitte die Einlösung neu vormerken.'),{code:'pointsChanged'});
      for(const b of bookings)if(b.type==='correction'&&!a.bookings.some(old=>old.id===b.id)&&M.day(b.createdAt)!==M.day(new Date().toISOString()))throw Object.assign(new Error('Die Rücknahme ist abgelaufen. Nur heutige, vollständig unbezahlte Getränke können zurückgenommen werden.'),{code:'correctionChanged'});
      return M.appendMany(a,bookings);
    },pinSignature,expectedSource);
    try{global.DrinksMobile?.queue(String(memberId));}catch{}return account;
  }
  async function adminPaypalPayment(memberId,booking){
    if(typeof adminUnlocked==='undefined'||!adminUnlocked)throw new Error('Bitte zuerst die Administration entsperren.');
    if(booking?.type!=='payment'||booking.method!=='paypal'||booking.confirmation!=='admin')throw new Error('Ungültiger PayPal-Eingang.');
    const policy=M.rewardPolicy(await rewards()),account=await mutate(memberId,a=>{
      if(!adminUnlocked)throw new Error('Administration wurde gesperrt.');
      const found=a.bookings.find(b=>b.id===booking.id);
      if(found){if(found.type==='payment'&&found.method==='paypal'&&found.confirmation==='admin'&&found.cents===booking.cents)return a;throw new Error('Dieser Zahlungscode wurde bereits mit einem anderen Betrag verwendet.');}
      return M.appendWithReward(a,booking,policy);
    });
    try{global.DrinksMobile?.queue(String(memberId));}catch{}return account;
  }
  async function adminDelete(memberId,booking,expectedSource=null){
    const admin=()=>{if(typeof adminUnlocked==='undefined'||!adminUnlocked)throw new Error('Bitte zuerst die Administration entsperren.');};admin();
    const entries=Array.isArray(booking)?booking:[booking];
    if(!entries.length||entries.length>1000||entries.some(b=>!['correction','payment-reversal'].includes(b?.type)||b.confirmation!=='admin'))throw new Error('Ungültige Admin-Löschung.');
    const account=await mutate(memberId,a=>{admin();return M.appendAdminMany(a,entries);},null,expectedSource);
    try{global.DrinksMobile?.queue(String(memberId));}catch{}return account;
  }
  function mobileName(value){if(value!=='handy-verbindung.json'&&value!=='push-verbindung.json'&&!/^handy-[a-f0-9]{64}\.json$/.test(value))throw new Error('Ungültige Zugangsdatei.');return value;}
  async function mobileFileName(id){return (await fileName(id)).replace('konto-','handy-');}
  async function readMobileFile(filename){
    mobileName(filename);const ctx=await context();if(!ctx.folder)return null;
    const path=`${itemUrl(ctx.root,ctx.folder.id)}:/${filename}`;
    for(let attempt=0;attempt<3;attempt++){
      let item;try{item=await(await odFetch(path+'?$select=id,eTag,file')).json();}catch(e){if(notFound(e))return null;throw e;}
      if(!item.file||!item.eTag)throw new Error('Die Zugangsdatei besitzt keine gültige Dateiversion.');
      const data=await(await odFetch(itemUrl(ctx.root,item.id)+'/content',{cache:'no-store'})).json();
      const after=await(await odFetch(itemUrl(ctx.root,item.id)+'?$select=eTag')).json();assertCurrent(ctx);if(after.eTag===item.eTag)return {data,item};
    }throw new Error('Zugang wird gerade geändert. Bitte erneut versuchen.');
  }
  async function writeMobileFile(filename,data,eTag){
    mobileName(filename);const ctx=await context(true);assertCurrent(ctx);
    try{await odFetch(`${itemUrl(ctx.root,ctx.folder.id)}:/${filename}:/content`,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':eTag||'"0"'},body:JSON.stringify(data)},false);assertCurrent(ctx);}
    catch(e){throw new Error(conflict(e)?'Zugang wurde gleichzeitig geändert. Bitte erneut öffnen.':'Speicherung des Zugangs nicht bestätigt. Bitte erneut öffnen.');}
  }
  async function mobileIds(){
    const ctx=await context();if(!ctx.folder)return [];
    const ids=[];let url=itemUrl(ctx.root,ctx.folder.id)+'/children?$select=name,file';
    while(url){const page=await(await odFetch(url)).json();assertCurrent(ctx);for(const file of page.value||[])if(file.file&&/^handy-[a-f0-9]{64}\.json$/.test(file.name)){const record=await readMobileFile(file.name);if(record?.data?.memberId)ids.push(String(record.data.memberId));}url=page['@odata.nextLink'];}
    return ids;
  }
  async function consumption(year){
    const ctx=await context(),accounts=[];if(!ctx.folder){assertCurrent(ctx);return {...M.consumption([],year),sourceKey:ctx.key};}
    const files=[];let url=itemUrl(ctx.root,ctx.folder.id)+'/children?$select=id,name,eTag,file';
    while(url){const page=await(await odFetch(url)).json();assertCurrent(ctx);files.push(...(page.value||[]).filter(f=>f.file&&/^konto-[a-f0-9]{64}\.json$/.test(f.name)));url=page['@odata.nextLink'];}
    await Promise.all(Array.from({length:Math.min(4,files.length)},async()=>{
      while(files.length){const file=files.shift();let stable=false;
        for(let attempt=0;attempt<3;attempt++){
          const before=await(await odFetch(itemUrl(ctx.root,file.id)+'?$select=id,eTag')).json();
          const data=await(await odFetch(itemUrl(ctx.root,file.id)+'/content',{cache:'no-store'})).json();
          const after=await(await odFetch(itemUrl(ctx.root,file.id)+'?$select=id,eTag')).json();assertCurrent(ctx);
          if(!before.eTag||after.eTag!==before.eTag)continue;
          M.validate(data,data.memberId);if(await fileName(data.memberId)!==file.name)throw new Error('Ein Getränkekonto ist nicht eindeutig zugeordnet.');
          accounts.push(data);stable=true;break;
        }
        if(!stable)throw new Error('Getränkekonten werden gerade geändert. Bitte erneut laden.');
      }
    }));
    assertCurrent(ctx);return {...M.consumption(accounts,year),sourceKey:ctx.key};
  }
  global.DrinksStore={read,list,cached,setPin,changeOwnPin,book,bookMany,adminPaypalPayment,adminDelete,consumption,reset,rewards,previewRewards,saveRewards,cachedRewards,readMobileFile,writeMobileFile,mobileFileName,mobileIds,sourceKey:()=>contextKey};
})(typeof window==='undefined'?globalThis:window);
