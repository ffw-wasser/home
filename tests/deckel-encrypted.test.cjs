const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
function app(){
  const files=new Map(),publicFiles=new Map(),calls=[],ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,btoa,atob,AbortSignal,AbortController,setTimeout,clearTimeout,Date,location:{href:'https://ffw-wasser.github.io/home/'},adminUnlocked:true,
    document:{readyState:'loading',addEventListener(){},dispatchEvent(){}},CustomEvent:class{constructor(name,options){this.detail=options.detail}},
    fetch:async(url,options={})=>{calls.push({url,options});const u=new URL(url);if(u.pathname==='/repos/ffw-wasser/deckel-daten')return {ok:true,json:async()=>({private:false,default_branch:'main'})};const name=u.pathname.split('/contents/')[1];const old=publicFiles.get(name);if(options.method==='PUT'){if(ctx.failWrite)return {ok:false,status:403};const body=JSON.parse(options.body);if(old&&body.sha!==old.sha)return {ok:false,status:409};const saved={sha:crypto.randomUUID(),content:body.content};publicFiles.set(name,saved);return {ok:true,json:async()=>saved};}return old?{ok:true,json:async()=>old}:{ok:false,status:404};},
    DrinksStore:{readMobileFile:async name=>files.has(name)?structuredClone(files.get(name)):null,writeMobileFile:async(name,data,eTag)=>{const old=files.get(name);if(old&&old.item.eTag!==eTag)throw new Error('conflict');files.set(name,{data:structuredClone(data),item:{eTag:crypto.randomUUID()}});},mobileFileName:async id=>'handy-'+id+'.json',mobileIds:async()=>[],read:async()=>ctx.account,rewards:async()=>ctx.policy}
  });
  for(const name of ['drinks-model.js','deckel-crypto.js','drinks-mobile.js'])vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/'+name),'utf8'),ctx);
  ctx.account={...ctx.DrinksModel.empty('member-test'),pin:{algorithm:'PBKDF2-SHA256',iterations:150000,salt:'a'.repeat(32),hash:'b'.repeat(64)},bookings:[{id:'drink-0001',type:'drinks',count:5,cents:750,createdAt:'2026-10-09T06:00:00Z'}]};
  ctx.policy={schemaVersion:1,id:'reward-0001',revision:'revision-0001',startedAt:'2026-10-01T00:00:00Z',count:20,cents:300};return {ctx,files,publicFiles,calls};
}
test('AES-GCM: richtiger Schlüssel, feste Größe, frische Nonce, fremder Schlüssel und Manipulation',async()=>{
  const {ctx}=app(),C=ctx.DeckelCrypto,record=C.create(),data=ctx.DrinksMobile.snapshot(ctx.account,ctx.policy);
  const first=await C.seal(data,record),second=await C.seal(data,record);assert.notEqual(first.iv,second.iv);assert.equal(atob(first.data).length,4112);assert.equal((await C.open(first,record)).balance,750);
  await assert.rejects(C.open(first,{...record,key:'c'.repeat(64)}));await assert.rejects(C.open(first,{...record,alias:'d'.repeat(32)}));
  const changed=atob(first.data);await assert.rejects(C.open({...first,data:btoa(String.fromCharCode(changed.charCodeAt(0)^1)+changed.slice(1))},record));
  assert.ok(!JSON.stringify(data).includes('member-test'));assert.equal(data.pin,undefined);assert.equal(data.bookings[0].id,undefined);
});
test('QR bleibt stabil, Rotation schützt neue Stände; nur verschlüsselte Daten werden an GitHub gesendet',async()=>{
  const {ctx,files,publicFiles,calls}=app(),D=ctx.DrinksMobile;
  await D.connect('ffw-wasser/deckel-daten','github_pat_fixture');
  assert.equal(files.get('handy-verbindung.json').data.token,'github_pat_fixture');
  const signature=JSON.stringify(ctx.account.pin),first=await D.link('member-test',signature),second=await D.link('member-test',signature);assert.equal(first,second);
  assert.equal(new URL(first).search,'');assert.ok(!first.includes('member-test'));assert.ok(!first.includes('github_pat'));
  const params=new URLSearchParams(new URL(first).hash.slice(1)),record={version:1,alias:params.get('a'),key:params.get('k')};
  const envelope=JSON.parse(atob(publicFiles.get('deckel/'+record.alias+'.json').content));assert.equal((await ctx.DeckelCrypto.open(envelope,record)).balance,750);
  for(const call of calls.filter(c=>c.options.method==='PUT')){assert.ok(!call.options.body.includes('member-test'));assert.ok(!call.options.body.includes(record.key));assert.ok(!call.options.body.includes('github_pat'));const decoded=atob(JSON.parse(call.options.body).content);assert.ok(!decoded.includes('balance'));assert.equal(JSON.parse(decoded).pin,undefined);assert.equal(JSON.parse(decoded).balance,undefined);}
  const next=await D.link('member-test',signature,true);assert.notEqual(first,next);
  const current=JSON.parse(atob(publicFiles.get('deckel/'+record.alias+'.json').content));await assert.rejects(ctx.DeckelCrypto.open(current,record));
  await assert.rejects(D.link('member-test','wrong'),/PIN/);
  ctx.failWrite=true;await assert.rejects(D.publish('member-test'),/Schreibrechte/);assert.equal(ctx.DrinksModel.totals(ctx.account).balance,750);
});
test('Veröffentlichung braucht Administration und verweigert das Code-Repository',async()=>{
  const {ctx}=app();ctx.adminUnlocked=false;await assert.rejects(ctx.DrinksMobile.connect('ffw-wasser/deckel-daten','github_pat_fixture'),/Administration/);ctx.adminUnlocked=true;await assert.rejects(ctx.DrinksMobile.connect('ffw-wasser/home','github_pat_fixture'),/ungültig/);await assert.rejects(ctx.DrinksMobile.connect('evil.example/repo','github_pat_fixture'),/ungültig/);
});
test('Handy-Deckel funktioniert ohne PIN und verweigert veralteten PIN-Status',async()=>{
  const {ctx,publicFiles}=app(),D=ctx.DrinksMobile;
  await D.connect('ffw-wasser/deckel-daten','github_pat_fixture');ctx.account.pin=null;
  const link=await D.link('member-test','null'),params=new URLSearchParams(new URL(link).hash.slice(1));
  const record={version:1,alias:params.get('a'),key:params.get('k')};
  const envelope=JSON.parse(atob(publicFiles.get('deckel/'+record.alias+'.json').content));
  assert.equal((await ctx.DeckelCrypto.open(envelope,record)).balance,750);
  await assert.rejects(D.link('member-test',''),/PIN/);
  ctx.account.pin=await ctx.DrinksModel.createPin('4826');await assert.rejects(D.link('member-test','null'),/PIN/);
});

test('Handy-Deckel veröffentlicht und entschlüsselt Korrekturen mit aktualisiertem Kontostand',async()=>{
  const {ctx}=app(),M=ctx.DrinksModel;ctx.account=M.append(ctx.account,{id:'correction-mobile',type:'correction',targetId:'drink-0001',count:1,cents:150,createdAt:'2026-10-09T12:00:00Z'});
  const record=ctx.DeckelCrypto.create(),snapshot=ctx.DrinksMobile.snapshot(ctx.account,ctx.policy);
  const envelope=await ctx.DeckelCrypto.seal(snapshot,record),opened=await ctx.DeckelCrypto.open(envelope,record);
  assert.equal(opened.balance,600);assert.equal(opened.bookings[0].type,'correction');assert.equal(opened.bookings[0].count,1);
});

test('Verschlüsselte Handyansicht benennt Wein und Weinkorrektur ohne Buchungskennungen',async()=>{
 const {ctx}=app(),M=ctx.DrinksModel,C=ctx.DeckelCrypto;
 ctx.account=M.append(ctx.account,{id:'wine-mobile-001',type:'drinks',drink:'wine',count:2,cents:600,createdAt:'2026-10-09T12:00:00Z'});
 ctx.account=M.append(ctx.account,{id:'wine-mobile-correction',type:'correction',drink:'wine',targetId:'wine-mobile-001',count:1,cents:300,createdAt:'2026-10-09T12:01:00Z'});
 const record=C.create(),snapshot=ctx.DrinksMobile.snapshot(ctx.account,ctx.policy),result=await C.open(await C.seal(snapshot,record),record);
 assert.equal(result.balance,1050);assert.equal(result.bookings[0].drink,'wine');assert.equal(result.bookings[1].drink,'wine');assert.ok(!JSON.stringify(result).includes('wine-mobile-001'));
});
test('Bestehender QR wartet nicht auf erneute Veröffentlichung und verwendet den geprüften Erinnerungszugang erneut',async()=>{
 const {ctx}=app(),D=ctx.DrinksMobile;let preparations=0;ctx.DrinksPush={prepare:async()=>{preparations++;return {origin:'https://test.account.workers.dev',capability:'x'.repeat(43)};}};
 await D.connect('ffw-wasser/deckel-daten','github_pat_fixture');const sig=JSON.stringify(ctx.account.pin),first=await D.link('member-test',sig);
 const original=ctx.fetch;let release;const hold=new Promise(resolve=>release=resolve);ctx.fetch=async(url,options)=>{if(options?.method==='PUT'&&url.includes('/deckel/'))await hold;return original(url,options);};
 try{const second=await Promise.race([D.link('member-test',sig),new Promise((_,reject)=>setTimeout(()=>reject(Error('QR waited for publishing')),500))]);assert.equal(second,first);assert.equal(preparations,1);}finally{release();}
 await new Promise(resolve=>setTimeout(resolve,10));
});
test('QR aus dem Arbeitsspeicher prüft PIN und Schlüssel erneut; gleichzeitiger Zugangswechsel gibt keinen veralteten QR frei',async()=>{
 const {ctx,files}=app(),D=ctx.DrinksMobile;await D.connect('ffw-wasser/deckel-daten','github_pat_fixture');const sig=JSON.stringify(ctx.account.pin);
 await D.link('member-test',sig);ctx.account.pin=await ctx.DrinksModel.createPin('7519');await assert.rejects(D.link('member-test',sig),/PIN/);
 const signature=JSON.stringify(ctx.account.pin);ctx.DrinksPush={prepare:async()=>{const saved=files.get('handy-member-test.json');saved.data.revision='other-revision';saved.data.key='c'.repeat(64);return null;}};
 await assert.rejects(D.link('member-test',signature,true),/gerade geändert/);
});
