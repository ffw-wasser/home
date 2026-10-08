const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const model=fs.readFileSync(require.resolve('../js/features/drinks/drinks-model.js'),'utf8');
const store=fs.readFileSync(require.resolve('../js/features/drinks/drinks-store.js'),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
const drink=(id='drink-0001',count=5)=>({id,type:'drinks',count,cents:count*150,createdAt:'2026-10-08T16:00:00Z'});
const pay=(id='payment-0001',cents=500,method='cash')=>({id,type:'payment',cents,method,confirmation:'member',createdAt:'2026-10-08T17:00:00Z'});
function app(){
  const files=new Map(),calls=[],storageWrites=[];let folder=true,tag=0;
  const ctx=vm.createContext({crypto:webcrypto,TextEncoder,console,navigator:{onLine:true},adminUnlocked:true,
    oneDriveSignedIn:()=>true,oneDriveResolveSharedRoot:async()=>({id:'root',driveId:'drive'}),
    localStorage:{setItem:(...args)=>storageWrites.push(args)},sessionStorage:{setItem:(...args)=>storageWrites.push(args)},
    odFetch:async(url,options={})=>{
      calls.push({url,options});const u=new URL(url),path=decodeURIComponent(u.pathname),method=options.method||'GET';
      const error=status=>{throw Object.assign(new Error('HTTP '+status),{status})};
      const reply=data=>({json:async()=>copy(data)});
      if(path.endsWith('/root:/Getraenke')){if(!folder)error(404);return reply({id:'folder',folder:{}});}
      if(path.endsWith('/root/children')&&method==='POST'){if(folder)error(409);folder=true;return reply({id:'folder',folder:{}});}
      if(path.endsWith('/folder/children'))return reply({value:[...files].map(([name,f])=>({name,id:'file-'+name,file:{},eTag:f.eTag}))});
      const named=path.match(/\/folder:\/([^/]+?)(?::\/content)?$/),identified=path.match(/\/file-([^/]+?)(?:\/content)?$/);
      const name=named?.[1]||identified?.[1];if(!name)throw new Error('Unerwarteter Abruf '+url);
      const existing=files.get(name);
      if(method==='PUT'){
        if(ctx.forceConflict){ctx.forceConflict--;error(412);}
        if(existing&&options.headers['If-Match']!==existing.eTag)error(412);
        if(!existing&&options.headers['If-Match']!=='"0"')error(412);
        const data=JSON.parse(options.body);files.set(name,{data,eTag:'"v'+(++tag)+'"'});
        if(ctx.loseReply){ctx.loseReply=false;throw new TypeError('Connection lost');}
        return reply({id:'file-'+name,eTag:files.get(name).eTag});
      }
      if(!existing)error(404);
      return reply(path.endsWith('/content')?existing.data:{id:'file-'+name,file:{},eTag:existing.eTag});
    }});
  vm.runInContext(model,ctx);vm.runInContext(store,ctx);
  return {ctx,M:ctx.DrinksModel,S:ctx.DrinksStore,files,calls,storageWrites,setFolder:v=>folder=v};
}
test('Striche in Cent, Teilzahlungen, vollständige Zahlung; gespeicherte Buchungen bleiben erhalten',()=>{
  const {M}=app(),start=M.empty('a');let a=M.append(start,drink());a=M.append(a,pay());
  assert.deepEqual(copy(M.totals(a)),{balance:250,count:5});a=M.append(a,pay('payment-0002',250,'paypal'));
  assert.equal(M.totals(a).balance,0);assert.equal(a.bookings.length,3);assert.equal(start.bookings.length,0);
  assert.throws(()=>M.append(a,pay('payment-0003',1)),/inzwischen geändert/);
});
test('Doppelte Buchungsnummer wird nur einmal gerechnet; abweichende Wiederverwendung abgelehnt',()=>{
  const {M}=app(),b=drink(),a=M.append(M.empty('a'),b);assert.equal(M.append(a,b),a);
  assert.throws(()=>M.append(a,drink(b.id,6)),/bereits anders/);
});
test('Beschädigte Daten, falscher Kontoinhaber, unbestätigte Zahlung und negative Werte werden abgelehnt',()=>{
  const {M}=app();for(const b of [{...drink(),cents:149},{...drink(),count:0},{...drink(),createdAt:'falsch'},{...pay(),confirmation:'automatic'}])assert.throws(()=>M.validate({...M.empty('a'),bookings:[b]},'a'));
  assert.throws(()=>M.validate(M.empty('b'),'a'));assert.throws(()=>M.validate({...M.empty('a'),bookings:[drink(),drink()]},'a'));
});
test('Euro-Eingabe und PayPal-Link haben genau den gewählten Betrag und keine Namen',()=>{
  const {M}=app();assert.equal(M.parseEuro('7,50'),750);assert.equal(M.parseEuro('0.01'),1);
  for(const raw of ['0','-1','1,501','1e4','NaN','1.234,50'])assert.equal(M.parseEuro(raw),null);
  assert.equal(M.paypalUrl(750),'https://paypal.me/FeuerwehrWasser/7.50EUR');assert.throws(()=>M.paypalUrl(0));
});
test('PIN wird gesalzen/abgeleitet, niemals im Klartext gespeichert; falsche PIN öffnet nicht',async()=>{
  const {M}=app(),pin=await M.createPin('4826');assert.equal(await M.verifyPin('4826',pin),true);assert.equal(await M.verifyPin('1234',pin),false);
  assert.equal(JSON.stringify(pin).includes('4826'),false);assert.notEqual((await M.createPin('4826')).salt,pin.salt);await assert.rejects(M.createPin('111'));
});
test('PIN-Verwaltung legt OneDrive-Ordner an und speichert ausschließlich dort',async()=>{
  const {S,M,setFolder,storageWrites,files}=app();setFolder(false);const a=await S.setPin('a','4826');assert.equal(await M.verifyPin('4826',a.pin),true);assert.equal(files.size,1);assert.deepEqual(storageWrites,[]);
});
test('PIN-Änderung erhält alle gebuchten Striche und Zahlungen',async()=>{
  const {S,M}=app();let a=await S.setPin('a','4826');a=await S.book('a',drink(),JSON.stringify(a.pin));a=await S.setPin('a','7519');assert.equal(M.totals(a).balance,750);assert.equal(await M.verifyPin('7519',a.pin),true);
});
test('Gleichzeitige Striche gehen nicht verloren; Versionskonflikte werden neu gelesen',async()=>{
  const {S,M}=app(),a=await S.setPin('a','4826'),sig=JSON.stringify(a.pin);
  await Promise.all([S.book('a',drink('drink-0001',2),sig),S.book('a',drink('drink-0002',3),sig)]);
  assert.deepEqual(copy(M.totals(await S.read('a'))),{balance:750,count:5});
});
test('Gleichzeitige Vollzahlungen können den Deckel nicht zweimal begleichen',async()=>{
  const {S,M}=app();let a=await S.setPin('a','4826');const sig=JSON.stringify(a.pin);await S.book('a',drink(),sig);
  const results=await Promise.allSettled([S.book('a',pay('payment-0001',750),sig),S.book('a',pay('payment-0002',750),sig)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(M.totals(await S.read('a')).balance,0);
});
test('Verlorene Schreibantwort wird nachgelesen und nicht doppelt gebucht',async()=>{
  const {ctx,S,M}=app(),a=await S.setPin('a','4826'),sig=JSON.stringify(a.pin);ctx.loseReply=true;const b=drink();await S.book('a',b,sig);await S.book('a',b,sig);assert.equal(M.totals(await S.read('a')).balance,750);
});
test('Dauerhafter Versionskonflikt endet begrenzt ohne Datenverlust',async()=>{
  const {ctx,S,M}=app(),a=await S.setPin('a','4826');ctx.forceConflict=5;await assert.rejects(S.book('a',drink(),JSON.stringify(a.pin)),/gleichzeitig geändert/);assert.equal(M.totals(await S.read('a')).balance,0);
});
test('Geänderte PIN sperrt eine bereits geöffnete Sitzung für neue Buchungen',async()=>{
  const {S}=app(),a=await S.setPin('a','4826');await S.setPin('a','7519');await assert.rejects(S.book('a',drink(),JSON.stringify(a.pin)),/PIN wurde geändert/);
});
test('Offline und ohne Administration werden weder PINs noch Buchungen gespeichert',async()=>{
  const {ctx,S,files}=app();ctx.adminUnlocked=false;await assert.rejects(S.setPin('a','4826'),/Administration/);ctx.adminUnlocked=true;ctx.navigator.onLine=false;await assert.rejects(S.setPin('a','4826'),/Offline/);assert.equal(files.size,0);
});
test('Liste nutzt unveränderte Dateiversionen; Abmelden entfernt Finanzdaten aus dem Arbeitsspeicher',async()=>{
  const {S,calls}=app(),a=await S.setPin('a','4826');await S.book('a',drink(),JSON.stringify(a.pin));await S.list(['a']);const before=calls.filter(c=>c.url.endsWith('/content')).length;await S.list(['a']);assert.equal(calls.filter(c=>c.url.endsWith('/content')).length,before);assert.equal(S.cached('a').bookings.length,1);S.reset();assert.equal(S.cached('a').bookings.length,0);
});
test('Ausgelieferter Code enthält lokale QR-Erzeugung, Fass ohne Legende und keine neue persönliche Browserspeicherung',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');const ui=fs.readFileSync(require.resolve('../js/features/drinks/drinks.js'),'utf8');
  assert.match(html,/id="drinksTab"/);assert.match(html,/Die größten Deckel/);assert.doesNotMatch(html,/1 Bierglas = 1 Strich/);assert.match(ui,/qrcode\(0,'M'\)/);
  for(const source of [model,store,ui])assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|safeStorage\.setItem|fetch\([^)]*(?:qr|paypal)/);
});
