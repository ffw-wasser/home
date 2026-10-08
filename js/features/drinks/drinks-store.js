/* Nur OneDrive und Arbeitsspeicher. Keine Finanzdaten/PINs im Browser-Speicher. */
(function(global){
  'use strict';
  const M=global.DrinksModel, FOLDER='Getraenke';
  let contextKey='',cache=new Map(),generation=0;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const notFound=e=>e?.status===404;
  const conflict=e=>[409,412].includes(e?.status);
  const itemUrl=(root,id)=>`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(id)}`;
  function reset(){generation++;contextKey='';cache.clear();}
  async function context(create=false){
    if(!oneDriveSignedIn())throw new Error('Bitte OneDrive verbinden. Getränke werden nur dort gespeichert.');
    if(navigator.onLine===false)throw new Error('Offline. Bitte vor dem Buchen die Internetverbindung herstellen.');
    const root=await oneDriveResolveSharedRoot(),key=root.driveId+':'+root.id;
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
  async function fileName(memberId){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(memberId)));return 'konto-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+'.json';}
  async function readWithContext(ctx,memberId){
    assertCurrent(ctx);
    if(!ctx.folder)return {account:M.empty(memberId),item:null};
    const path=`${itemUrl(ctx.root,ctx.folder.id)}:/${await fileName(memberId)}`;
    for(let attempt=0;attempt<3;attempt++){
      let item;
      try{item=await(await odFetch(path+'?$select=id,eTag,file')).json();}catch(e){if(notFound(e))return {account:M.empty(memberId),item:null};throw e;}
      if(!item.file||!item.eTag)throw new Error('Die Getränkedatei besitzt keine gültige Dateiversion.');
      const data=await(await odFetch(itemUrl(ctx.root,item.id)+'/content',{cache:'no-store'})).json();
      const after=await(await odFetch(itemUrl(ctx.root,item.id)+'?$select=id,eTag')).json();
      assertCurrent(ctx);
      if(after.eTag!==item.eTag)continue;
      const account=M.validate(data,memberId);cache.set(String(memberId),{account:clone(account),eTag:item.eTag});return {account,item};
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
        else account=(await readWithContext(ctx,id)).account;
        assertCurrent(ctx);results.set(id,account);next.set(id,{account:clone(account),eTag:cache.get(id)?.eTag||entry?.eTag||''});
      }
    }));
    assertCurrent(ctx);cache=next;return memberIds.map(id=>results.get(String(id)));
  }
  async function mutate(memberId,change,expectedPin=null){
    const ctx=await context(true);
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
  async function book(memberId,booking,pinSignature){if(!pinSignature)throw new Error('Bitte mit deiner Getränke-PIN anmelden.');return mutate(memberId,a=>M.append(a,booking),pinSignature);}
  global.DrinksStore={read,list,cached,setPin,book,reset};
})(typeof window==='undefined'?globalThis:window);
