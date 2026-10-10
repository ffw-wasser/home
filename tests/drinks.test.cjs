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
test('Zentrale Store-Anbindung bucht mit Version und ohne OneDrive-Konto-Schreibzugriff',async()=>{
 const {ctx,M,S,calls}=app();let account=M.empty('a'),version=0;
 const policy={schemaVersion:2,id:'policy-001',revision:'policy-001',startedAt:'2020-01-01T00:00:00Z',thresholdCents:3000,awardUnits:300,beerUnits:150,wineUnits:150};
 ctx.DrinksCentral={connection:async()=>({source:'drive:root'}),call:async(c,action,data)=>{if(action==='policy')return {policy};if(action==='read')return {account:copy(account),version};if(action==='write'){assert.equal(data.version,version);account=copy(data.account);return {version:++version};}if(action==='members')return {members:['a']};throw Error(action);}};
 const saved=await S.bookMany('a',[drink()],'null');assert.equal(M.totals(saved).balance,750);assert.equal(version,1);assert.equal((await S.list(['a']))[0].bookings.length,1);assert.equal((await S.consumption('2026')).beer,5);assert.equal(calls.filter(c=>c.options.method==='PUT').length,0);
});
test('Übernahme sichert vollständigen Bestand und sperrt alte Dateiversionen ohne Buchungsverlust',async()=>{
 const {S,files}=app();await S.book('a',drink(),'null');const before=await S.localMigrationSnapshot();assert.equal(before.entries.length,2);
 await S.writeBackup('sicherung-fixture.json',{accounts:before.entries},before.source);assert.ok(files.has('sicherung-fixture.json'));await S.lockMigrationSnapshot(before);
 const after=await S.localMigrationSnapshot();assert.ok(after.entries.every(e=>e.locked));assert.deepEqual(copy(after.entries.map(e=>e.account)),copy(before.entries.map(e=>e.account)));
 await assert.rejects(S.read('a'),/aktuelle App-Version/);await S.lockMigrationSnapshot(after);
});
test('Konflikte bei Übernahme und fehlende Administration verhindern Überschreiben',async()=>{
 const {ctx,S}=app();await S.book('a',drink(),'null');const before=await S.localMigrationSnapshot();ctx.forceConflict=1;await assert.rejects(S.lockMigrationSnapshot(before),/412/);assert.equal((await S.read('a')).bookings.length,1);ctx.adminUnlocked=false;await assert.rejects(S.writeBackup('sicherung-fixture.json',{},before.source),/Verwaltung/);
});
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

test('Mitglied ändert eigene PIN ohne Administration; offene Beträge und Buchungen bleiben erhalten',async()=>{
  const {ctx,M,S,storageWrites}=app();let a=await S.setPin('a','4826');
  a=await S.book('a',drink(),JSON.stringify(a.pin));a=await S.book('a',pay(),JSON.stringify(a.pin));
  ctx.adminUnlocked=false;
  await assert.rejects(S.changeOwnPin('a','0000','7391'),/aktuelle PIN/);
  const changed=await S.changeOwnPin('a','4826','7391');
  assert.equal(M.totals(changed).balance,250);assert.equal(changed.bookings.length,2);
  assert.equal(await M.verifyPin('7391',changed.pin),true);assert.equal(await M.verifyPin('4826',changed.pin),false);
  assert.deepEqual(storageWrites,[]);
});
test('Ohne PIN buchen, selbst eine PIN einrichten und mit aktueller PIN wieder entfernen',async()=>{
  const {ctx,M,S}=app();ctx.adminUnlocked=false;
  const first=await S.book('a',drink(),'null');assert.equal(first.pin,null);
  const protectedAccount=await S.changeOwnPin('a','','4826');
  assert.equal(await M.verifyPin('4826',protectedAccount.pin),true);
  await assert.rejects(S.book('a',drink('drink-0002'),'null'),/PIN wurde geändert/);
  await assert.rejects(S.changeOwnPin('a','0000',null),/aktuelle PIN/);
  const openAccount=await S.changeOwnPin('a','4826',null);
  assert.equal(openAccount.pin,null);assert.deepEqual(copy(openAccount.bookings),copy(first.bookings));
  await S.book('a',pay(),'null');assert.equal(M.totals(await S.read('a')).balance,250);
});
test('Alte Pflicht-PINs werden einmalig entfernt; Striche, Zahlungen und Guthaben bleiben exakt erhalten',async()=>{
  const {ctx,M,S,files}=app();configure({files});let a=await S.setPin('a','4826');
  a=await S.book('a',drink('drink-0020',20),JSON.stringify(a.pin));
  a=await S.book('a',pay('payment-0020',3000),JSON.stringify(a.pin));
  const file=[...files.values()].find(f=>f.data.memberId==='a');delete file.data.pinChoiceVersion;
  const before=copy(file.data.bookings);ctx.adminUnlocked=false;S.reset();
  const migrated=(await S.list(['a']))[0];assert.equal(migrated.pin,null);assert.equal(migrated.pinChoiceVersion,1);
  assert.equal([...files.values()].find(f=>f.data.memberId==='a').data.pin,null);assert.deepEqual(copy(migrated.bookings),before);assert.equal(M.rewardState(migrated,await S.rewards()).pointUnits,300);
  const chosen=await S.changeOwnPin('a','','7391');S.reset();await S.list(['a']);
  assert.equal(await M.verifyPin('7391',(await S.read('a')).pin),true);
  assert.deepEqual(copy(chosen.bookings),before);
});
test('PIN-Umstellung übersteht Versionskonflikt und verlorene Antwort ohne Buchungsverlust',async()=>{
  const {ctx,S,files}=app();let a=await S.setPin('a','4826');a=await S.book('a',drink(),JSON.stringify(a.pin));
  const file=[...files.values()].find(f=>f.data.memberId==='a');delete file.data.pinChoiceVersion;
  const before=copy(file.data.bookings);ctx.forceConflict=1;ctx.loseReply=true;S.reset();
  const migrated=await S.read('a');assert.equal(migrated.pin,null);assert.deepEqual(copy(migrated.bookings),before);
});
test('Offline werden alte PINs nicht verändert; fehlende Sitzung erlaubt keine Buchung',async()=>{
  const {ctx,S,files}=app();await S.setPin('a','4826');
  const file=[...files.values()].find(f=>f.data.memberId==='a');delete file.data.pinChoiceVersion;
  ctx.navigator.onLine=false;await assert.rejects(S.read('a'),/Offline/);assert.ok(file.data.pin);
  ctx.navigator.onLine=true;await assert.rejects(S.book('a',drink(),''),/Getränkekonto öffnen/);
});
test('PIN-Selbständerung verkraftet Konflikte und eine verlorene Schreibantwort ohne Buchungsverlust',async()=>{
  const {ctx,M,S}=app();let a=await S.setPin('a','4826');a=await S.book('a',drink(),JSON.stringify(a.pin));
  ctx.adminUnlocked=false;ctx.forceConflict=1;ctx.loseReply=true;
  const changed=await S.changeOwnPin('a','4826','7391');
  assert.equal(await M.verifyPin('7391',changed.pin),true);assert.equal(changed.bookings.length,1);
  await assert.rejects(S.book('a',drink('another-booking',1),JSON.stringify(a.pin)),/PIN wurde geändert/);
});
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
  const {ctx,S,M}=app(),a=await S.setPin('a','4826');await S.rewards();ctx.forceConflict=5;await assert.rejects(S.book('a',drink(),JSON.stringify(a.pin)),/gleichzeitig geändert/);assert.equal(M.totals(await S.read('a')).balance,0);
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
test('Unverändertes Konto öffnet nach frischer Versionsprüfung ohne erneuten Download',async()=>{
  const {S,calls}=app();const first=await S.book('a',drink(),'null');await S.list(['a']);
  const start=calls.length;const opened=await S.read('a'),requests=calls.slice(start);
  assert.equal(requests.filter(c=>c.url.endsWith('/content')).length,0);
  assert.equal(requests.filter(c=>c.url.includes('konto-')).length,1);
  assert.deepEqual(copy(opened),copy(first));opened.bookings.length=0;
  assert.equal((await S.read('a')).bookings.length,1);
});
test('Geänderte Dateiversion lädt aktuelle Buchungen und PIN; alte Sitzung bleibt gesperrt',async()=>{
  const {S,M,files,calls}=app();await S.book('a',drink(),'null');await S.list(['a']);
  const file=[...files.values()].find(f=>f.data.memberId==='a');file.data=M.append(file.data,drink('drink-0002',1));
  file.data.pin=await M.createPin('4826');file.eTag='"remote-change"';const start=calls.length;
  const opened=await S.read('a');assert.equal(opened.bookings.length,2);assert.ok(opened.pin);
  assert.equal(calls.slice(start).filter(c=>c.url.endsWith('/content')).length,1);
  await assert.rejects(S.book('a',drink('drink-0003',1),'null'),/PIN wurde geändert/);
});
test('Wartende Kartenbuchung darf nach einem OneDrive-Ordnerwechsel nicht in einen anderen Ordner schreiben',async()=>{
  const {ctx,S,calls}=app();await S.list(['a']);const source=S.sourceKey();assert.equal(source,'drive:root');
  ctx.oneDriveResolveSharedRoot=async()=>({id:'root',driveId:'other-drive'});const start=calls.length;
  await assert.rejects(S.book('a',drink(),'null',source),/ursprüngliche Verbindung/);
  assert.equal(calls.slice(start).filter(c=>c.options.method==='PUT').length,0);
  ctx.oneDriveResolveSharedRoot=async()=>({id:'root',driveId:'drive'});
  const saved=await S.book('a',drink(),'null',source);assert.equal(saved.bookings.length,1);
});
test('Ausgelieferter Code enthält lokale QR-Erzeugung, Fass ohne Legende und keine neue persönliche Browserspeicherung',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');const ui=fs.readFileSync(require.resolve('../js/features/drinks/drinks.js'),'utf8');
  assert.match(html,/id="drinksTab"/);assert.match(html,/Die größten Deckel/);assert.doesNotMatch(html,/1 Bierglas = 1 Strich/);assert.match(ui,/qrcode\(0,'M'\)/);
  for(const source of [model,store,ui])assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|safeStorage\.setItem|fetch\([^)]*(?:qr|paypal)/);
});

const rewardPolicy=(count=20,cents=300)=>({schemaVersion:1,id:'program-0001',revision:'revision-0001',startedAt:'2026-10-01T00:00:00Z',count,cents});
const configure=(a,policy=rewardPolicy())=>a.files.set('bonus-einstellungen.json',{data:copy(policy),eTag:'"config-1"'});
test('Bonus startet mit 20 Strichen und 3 Euro; Verwaltung ändert die Werte ausschließlich in OneDrive',async()=>{
  const a=app(),p=await a.S.rewards();assert.equal(p.thresholdCents,3000);assert.equal(p.awardUnits,300);
  const changed=await a.S.saveRewards(10,150,p.revision);
  assert.equal(changed.thresholdCents,1500);assert.equal(changed.awardUnits,150);assert.equal(changed.id,p.id);assert.equal(changed.startedAt,p.startedAt);assert.notEqual(changed.revision,p.revision);
  assert.deepEqual(a.storageWrites,[]);assert.equal(a.files.size,1);
});
test('Bonus-Einstellungen verhindern ungültige Werte, unberechtigte und veraltete Änderungen',async()=>{
  const a=app(),p=await a.S.rewards();
  for(const [count,cents] of [[0,300],[1.5,300],[20,0],[20,301.5],[10001,300],[20,100001]])await assert.rejects(a.S.saveRewards(count,cents,p.revision),/ungültig/);
  a.ctx.adminUnlocked=false;await assert.rejects(a.S.saveRewards(10,150,p.revision),/Verwaltung/);a.ctx.adminUnlocked=true;
  await a.S.saveRewards(10,150,p.revision);await assert.rejects(a.S.saveRewards(30,450,p.revision),/inzwischen geändert/);
  assert.equal((await a.S.rewards()).thresholdCents,1500);
});
test('Teilzahlungen zählen centgenau; der 20. bezahlte Strich erzeugt 3 Euro für weitere Getränke',()=>{
  const {M}=app(),p=rewardPolicy();let a=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);
  a=M.appendWithReward(a,pay('payment-0019',2850),p);assert.equal(M.rewardState(a,p).progress,2850);
  a=M.appendWithReward(a,pay('payment-part',149,'paypal'),p);assert.equal(M.rewardState(a,p).credit,0);
  a=M.appendWithReward(a,pay('payment-last',1),p);assert.equal(M.totals(a).balance,0);assert.equal(M.rewardState(a,p).credit,300);assert.equal(M.rewardState(a,p).progress,0);
  const before=a.bookings.length;a=M.appendWithReward(a,drink('drink-free-two',2),p);assert.equal(M.totals(a).balance,0);assert.equal(M.rewardState(a,p).credit,0);assert.equal(M.rewardState(a,p).progress,0);assert.equal(a.bookings.length,before+1);
  a=M.appendWithReward(a,drink('drink-next-one',1),p);a=M.appendWithReward(a,pay('payment-next',150),p);assert.equal(M.rewardState(a,p).progress,150);
});
test('Eine große Zahlung erhält mehrere Bonusstufen, Restfortschritt bleibt erhalten',()=>{
  const {M}=app(),p=rewardPolicy();let a=M.appendWithReward(M.empty('a'),drink('drink-many',45),p);a=M.appendWithReward(a,pay('payment-many',6750),p);
  assert.equal(M.rewardState(a,p).credit,600);assert.equal(M.rewardState(a,p).progress,750);assert.equal(a.bookings.at(-1).cycles,2);
});
test('Geänderte Bonuswerte erhalten Guthaben und Restfortschritt; Bonus verrechnet keine alten Schulden',()=>{
  const {M}=app(),p=rewardPolicy();let a=M.appendWithReward(M.empty('a'),drink('drink-fifty',50),p);a=M.appendWithReward(a,pay('payment-part1',3750),p);
  assert.equal(M.totals(a).balance,3750);assert.equal(M.rewardState(a,p).credit,300);
  const next={...p,count:10,cents:200,revision:'revision-0002'};a=M.appendWithReward(a,pay('payment-part2',750),next);
  assert.equal(M.totals(a).balance,3000);assert.equal(M.rewardState(a,next).credit,500);assert.equal(M.rewardState(a,next).progress,0);
  a=M.appendWithReward(a,drink('drink-use-credit',2),next);assert.equal(M.totals(a).balance,3000);assert.equal(M.rewardState(a,next).credit,200);
});
test('Bestehende Konten migrieren ohne rückwirkende Boni oder geänderte Altbuchungen',()=>{
  const {M}=app(),p=rewardPolicy();let a=M.append(M.empty('a'),{...drink('old-drink-0020',20),createdAt:'2025-01-01T00:00:00Z'});
  a=M.append(a,{...pay('old-payment-20',3000),createdAt:'2025-01-02T00:00:00Z'});const old=copy(a.bookings);
  a=M.appendWithReward(a,drink('new-drink-0020',20),p);a=M.appendWithReward(a,pay('new-payment-20',3000),p);
  assert.equal(a.schemaVersion,2);assert.deepEqual(copy(a.bookings.slice(0,2)),old);assert.equal(a.bookings.filter(b=>b.type==='bonus').length,1);assert.equal(M.rewardState(a,p).credit,300);
});
test('Aufgeteilte Bar- und PayPal-Zahlungen erzeugen denselben Bonus wie eine Gesamtzahlung',()=>{
  const {M}=app(),p=rewardPolicy();let split=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);let full=split;
  for(let i=0;i<20;i++)split=M.appendWithReward(split,pay('split-payment-'+String(i).padStart(2,'0'),150,i%2?'cash':'paypal'),p);
  full=M.appendWithReward(full,pay('payment-full',3000),p);assert.equal(M.rewardState(split,p).credit,M.rewardState(full,p).credit);assert.equal(split.bookings.filter(b=>b.type==='bonus').length,1);
});
test('Zahlung und Bonus bleiben atomar bei Versionskonflikt, verlorener Antwort und erneutem Klick',async()=>{
  const a=app();configure(a);let account=await a.S.setPin('a','4826');const sig=JSON.stringify(account.pin);await a.S.book('a',drink('drink-0020',20),sig);
  a.ctx.forceConflict=1;a.ctx.loseReply=true;const payment=pay('reward-payment-20',3000);await a.S.book('a',payment,sig);await a.S.book('a',payment,sig);
  account=await a.S.read('a');assert.equal(account.bookings.length,3);assert.equal(account.bookings.filter(b=>b.type==='bonus').length,1);assert.equal(a.M.rewardState(account,rewardPolicy()).pointUnits,300);assert.deepEqual(a.storageWrites,[]);
});
test('Zwei gleichzeitige Teilzahlungen vergeben den erreichten Bonus genau einmal',async()=>{
  const a=app();configure(a);const account=await a.S.setPin('a','4826'),sig=JSON.stringify(account.pin);await a.S.book('a',drink('drink-0020',20),sig);
  await Promise.all([a.S.book('a',pay('payment-concurrent-a',1500),sig),a.S.book('a',pay('payment-concurrent-b',1500),sig)]);
  const saved=await a.S.read('a');assert.equal(a.M.totals(saved).balance,0);assert.equal(a.M.rewardState(saved,rewardPolicy()).pointUnits,300);assert.equal(saved.bookings.filter(b=>b.type==='bonus').length,1);
});
test('Manipulierte, doppelte oder nicht gedeckte Bonusbuchungen werden abgelehnt',()=>{
  const {M}=app(),p=rewardPolicy();let a=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);a=M.appendWithReward(a,pay('payment-full',3000),p);
  for(const change of [{cents:301},{cycles:2,cents:600,qualifyingCents:6000},{paymentId:'missing-payment'},{policy:{...p,count:0}}]){
    const bad=copy(a);Object.assign(bad.bookings.at(-1),change);assert.throws(()=>M.validate(bad,'a'));
  }
  assert.throws(()=>M.validate({...a,bookings:[...a.bookings,a.bookings.at(-1)]},'a'));
});
test('Gleichzeitiger Bonusstart nutzt eine gemeinsame Regel; parallele Verwaltungsänderungen überschreiben sich nicht',async()=>{
  const a=app(),[one,two]=await Promise.all([a.S.rewards(),a.S.rewards()]);assert.equal(one.id,two.id);assert.equal(a.files.size,1);
  const results=await Promise.allSettled([a.S.saveRewards(10,150,one.revision),a.S.saveRewards(30,450,two.revision)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/inzwischen geändert/);
});
test('Verlorene Antwort beim Bonusstart und Speichern wird anhand der OneDrive-Version geprüft',async()=>{
  const a=app();a.ctx.loseReply=true;const p=await a.S.rewards();assert.equal(p.thresholdCents,3000);assert.equal(a.files.size,1);
  a.ctx.loseReply=true;const saved=await a.S.saveRewards(25,400,p.revision);assert.equal(saved.thresholdCents,3750);assert.equal((await a.S.rewards()).awardUnits,400);
  a.ctx.navigator.onLine=false;await assert.rejects(a.S.saveRewards(10,150,saved.revision),/Offline/);assert.equal(a.files.get('bonus-einstellungen.json').data.thresholdCents,3750);
});

test('Ein Fehler der optionalen Handy-Veröffentlichung macht eine bestätigte Buchung nicht rückgängig',async()=>{
  const a=app();await a.S.setPin('member-a','1234');const signature=JSON.stringify((await a.S.read('member-a')).pin);
  a.ctx.DrinksMobile={queue(){throw new Error('Publishing failed');}};
  const saved=await a.S.book('member-a',drink('drink-mobile-001',2),signature);assert.equal(a.M.totals(saved).balance,300);assert.equal((await a.S.read('member-a')).bookings.length,1);
});
test('Administration verbucht PayPal-Teilzahlungen ohne Mitglieder-PIN; Quittungscode verhindert doppelte Zahlung',async()=>{
  const a=app();let account=await a.S.setPin('member-a','1234');await a.S.book('member-a',drink('drinks-admin-001',20),JSON.stringify(account.pin));
  const first={...pay('paypal-admin-TXN000001',1500,'paypal'),confirmation:'admin',createdAt:new Date().toISOString()};
  a.ctx.adminUnlocked=false;await assert.rejects(a.S.adminPaypalPayment('member-a',first),/Administration/);a.ctx.adminUnlocked=true;
  a.ctx.forceConflict=1;a.ctx.loseReply=true;
  account=await a.S.adminPaypalPayment('member-a',first);assert.equal(a.M.totals(account).balance,1500);
  account=await a.S.adminPaypalPayment('member-a',{...first,createdAt:new Date(Date.now()+1000).toISOString()});assert.equal(a.M.totals(account).balance,1500);assert.equal(account.bookings.filter(b=>b.id===first.id).length,1);
  await assert.rejects(a.S.adminPaypalPayment('member-a',{...first,cents:1000}),/anderen Betrag/);
  await assert.rejects(a.S.adminPaypalPayment('member-a',{...first,id:'paypal-admin-TOOHIGH',cents:2000}),/offene Betrag/);
  account=await a.S.adminPaypalPayment('member-a',{...first,id:'paypal-admin-TXN000002'});assert.equal(a.M.totals(account).balance,0);assert.equal(a.M.rewardState(account,a.S.cachedRewards()).pointUnits,300);
  const ownSignature=JSON.stringify(account.pin);await assert.rejects(a.S.book('member-a',{...first,id:'paypal-admin-FORGED'},ownSignature),/Administration/);
  a.ctx.adminUnlocked=false;await assert.rejects(a.S.adminPaypalPayment('member-a',{...first,id:'paypal-admin-LOCKED'}),/Administration/);
});
test('Gleichzeitige PayPal-Vollzahlungen der Administration können ein Konto nicht doppelt begleichen',async()=>{
  const a=app(),account=await a.S.setPin('member-a','1234');await a.S.book('member-a',drink('drinks-admin-001',2),JSON.stringify(account.pin));
  const payment={...pay('paypal-admin-ONE',300,'paypal'),confirmation:'admin',createdAt:new Date().toISOString()};
  const results=await Promise.allSettled([a.S.adminPaypalPayment('member-a',payment),a.S.adminPaypalPayment('member-a',{...payment,id:'paypal-admin-TWO'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(a.M.totals(await a.S.read('member-a')).balance,0);
});

const correction=(targetId,id='correct-0001',count=1,createdAt='2026-10-08T18:00:00Z')=>({id,type:'correction',targetId,count,cents:count*150,createdAt});
test('Heutige Striche korrigieren erhält Originale und ist bei Wiederholung idempotent',()=>{
  const {M}=app(),original=M.append(M.empty('a'),drink()),entry=correction('drink-0001');
  const a=M.append(original,entry);assert.deepEqual(copy(M.totals(a)),{balance:600,count:4});assert.equal(a.schemaVersion,3);
  assert.deepEqual(copy(a.bookings[0]),copy(original.bookings[0]));assert.equal(M.append(a,entry),a);
  assert.equal(M.today(a,'2026-10-08T19:00:00Z').count,4);assert.equal(M.today(a,'2026-10-09T12:00:00Z').count,0);
  assert.throws(()=>M.append(a,correction('drink-0001','correct-0002',5)),/korrigiert/);
  assert.throws(()=>M.append(a,correction('drink-0001','correct-0003',1,'2026-10-09T12:00:00Z')),/korrigiert/);
});
test('Heutige Striche richten sich an Berliner Mitternacht und Sommerzeit',()=>{
  const {M}=app();let a=M.append(M.empty('a'),{...drink(),createdAt:'2026-10-08T22:10:00Z'});
  assert.equal(M.today(a,'2026-10-09T21:59:59Z').count,5);assert.equal(M.today(a,'2026-10-09T22:00:00Z').count,0);
  a=M.append(a,correction('drink-0001','correct-midnight',1,'2026-10-09T21:59:59Z'));assert.equal(M.totals(a).count,4);
  assert.equal(M.day('2026-01-08T23:10:00Z'),M.day('2026-01-09T12:00:00Z'));
});
test('Mitglieder können bezahlte Buchungen nicht zurücknehmen; alte Korrekturen bleiben unverändert lesbar',()=>{
 const {M}=app(),p=rewardPolicy();let a=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);a=M.appendWithReward(a,pay('payment-0020',3000),p);const original=copy(a);
 assert.throws(()=>M.appendWithReward(a,correction('drink-0020'),p),/bereits ganz oder teilweise bezahlt/);assert.deepEqual(copy(a),original);
 const historical={...a,schemaVersion:3,bookings:[...a.bookings,correction('drink-0020')]};M.validate(historical,'a');assert.equal(M.totals(historical).count,19);assert.equal(M.rewardState(historical,p).credit,450);
});
test('Teilweise bezahlte oder mit Bonus verrechnete Buchungen sind geschützt; unabhängige unbezahlte Einträge bleiben korrigierbar',()=>{
 const {M}=app(),p={...rewardPolicy(),cents:100};let a=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);a=M.appendWithReward(a,pay('payment-0020',3000),p);a=M.appendWithReward(a,drink('drink-0021',2),p);
 assert.throws(()=>M.append(a,correction('drink-0021')),/bereits ganz oder teilweise bezahlt/);
 a=M.append(a,drink('unpaid-new-beer',1));assert.equal(M.correctable(a,'2026-10-08T18:00:00Z').targetId,'unpaid-new-beer');a=M.append(a,correction('unpaid-new-beer'));assert.equal(M.totals(a).balance,200);
 let partial=M.append(M.empty('b'),drink('partial-drinks',5));partial=M.append(partial,pay('partial-payment',1));assert.throws(()=>M.append(partial,correction('partial-drinks')),/bereits ganz oder teilweise bezahlt/);
});
test('Korrektur in OneDrive übersteht verlorene Antwort, Konflikte und parallele Rücknahmen',async()=>{
  const a=app(),now=new Date().toISOString(),d={...drink('drink-today',1),createdAt:now};await a.S.book('a',d,'null');
  const c=correction(d.id,'correct-today',1,now);a.ctx.forceConflict=1;a.ctx.loseReply=true;
  const corrected=await a.S.book('a',c,'null');assert.equal(a.M.totals(corrected).count,0);
  await a.S.book('a',c,'null');assert.equal((await a.S.read('a')).bookings.length,2);
  await assert.rejects(a.S.book('a',correction(d.id,'correct-other',1,now),'null'),/korrigiert/);
  const yesterday=new Date(Date.now()-86400000).toISOString();await a.S.book('b',{...d,createdAt:yesterday},'null');
  await assert.rejects(a.S.book('b',correction(d.id,'correct-old',1,yesterday),'null'),/Nur heute/);
});
test('Gleichzeitige Korrekturen können denselben Strich nicht doppelt zurückgeben',async()=>{
  const a=app(),now=new Date().toISOString();await a.S.book('a',{...drink('drink-today',1),createdAt:now},'null');
  const results=await Promise.allSettled(['correct-first','correct-second'].map(id=>a.S.book('a',correction('drink-today',id,1,now),'null')));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(a.M.totals(await a.S.read('a')).balance,0);
});

const wine=(id='wine-booking-001',count=1,createdAt='2026-10-09T12:00:00Z')=>({id,type:'drinks',drink:'wine',count,cents:count*300,createdAt});
test('Wein kostet 3 Euro pro Glas; alte Buchungen behalten 1,50 Euro und bleiben unverändert',()=>{
 const {M}=app(),old=M.append(M.empty('a'),drink()),before=copy(old.bookings);
 const a=M.append(old,wine('wine-booking-001',2));assert.equal(a.schemaVersion,4);
 assert.deepEqual(copy(M.totals(a)),{balance:1350,count:7});assert.deepEqual(copy(a.bookings.slice(0,1)),before);
 for(const b of [{...wine(),cents:150},{...wine(),drink:'unknown'}, {...drink('invalid-beer-001'),cents:1500}])assert.throws(()=>M.append(old,b),/ungültig/);
});
test('Unbezahlter Wein wird centgenau korrigiert; bezahlter Wein bleibt für Mitglieder geschützt',()=>{
 const {M}=app(),p=rewardPolicy(2,300),a=M.append(M.empty('a'),wine()),c={id:'wine-correction-001',type:'correction',drink:'wine',targetId:'wine-booking-001',count:1,cents:300,createdAt:'2026-10-09T12:02:00Z'};
 assert.throws(()=>M.append(a,{...c,cents:150}),/korrigiert/);assert.throws(()=>M.append(a,{...c,drink:'beer'}),/korrigiert/);const corrected=M.append(a,c);assert.equal(M.totals(corrected).balance,0);assert.equal(M.append(corrected,c),corrected);
 const paid=M.appendWithReward(a,{...pay('wine-payment-001',300),createdAt:'2026-10-09T12:01:00Z'},p);assert.throws(()=>M.append(paid,c),/bereits ganz oder teilweise bezahlt/);assert.equal(M.rewardState(paid,p).credit,300);
});
test('Gemischte Sammlung wird in einem OneDrive-Schreibvorgang gespeichert; Wiederholung nach verlorener Antwort zählt einmal',async()=>{
 const {ctx,S,M,calls}=app(),entries=[drink('mixed-beer-001',5),wine('mixed-wine-001',2)];await S.rewards();const start=calls.length;
 ctx.loseReply=true;ctx.forceConflict=1;const a=await S.bookMany('a',entries,'null');assert.equal(M.totals(a).balance,1350);assert.equal(a.bookings.length,2);
 const writes=calls.slice(start).filter(c=>c.options.method==='PUT'&&c.options.body.includes('mixed-beer-001'));
 assert.ok(writes.length>=1);for(const write of writes)assert.equal(JSON.parse(write.options.body).bookings.length,2);
 await S.bookMany('a',entries,'null');assert.equal((await S.read('a')).bookings.length,2);
});
test('Ungültiger Wein und geänderte PIN speichern keinen Teil einer gemischten Sammlung',async()=>{
 const {S,M}=app();await assert.rejects(S.bookMany('a',[drink('atomic-beer-001',1),{...wine(),cents:150}],'null'),/ungültig/);
 assert.equal(M.totals(await S.read('a')).balance,0);const a=await S.setPin('a','4826');
 await assert.rejects(S.bookMany('a',[drink('atomic-beer-001',1),wine()],'null'),/PIN wurde geändert/);
 assert.equal(M.totals(await S.read('a')).balance,0);assert.ok(a.pin);
});
test('Weinzahlungen nutzen denselben Geldbetrag für Bonusfortschritt; Verbrauch allein gewährt keinen Bonus',()=>{
 const {M}=app(),p=rewardPolicy(2,300);let a=M.appendWithReward(M.empty('a'),wine(),p);
 assert.equal(M.rewardState(a,p).needed,300);assert.equal(M.rewardState(a,p).credit,0);
 a=M.appendWithReward(a,{...pay('wine-payment-bonus',300),createdAt:'2026-10-09T12:01:00Z'},p);
 assert.equal(a.bookings.filter(b=>b.type==='bonus').length,1);assert.equal(M.rewardState(a,p).credit,300);
});
test('OK-Sammlung erhält Reihenfolge und rechnet Bonusguthaben centgenau in einem Schreiben an',async()=>{
 const {M,S,calls}=app();const now=new Date().toISOString();await S.rewards();const policy=rewardPolicy(2,300);let a=M.appendWithReward(M.empty('a'),wine('order-paid-wine',1,now),policy);
 a=M.appendWithReward(a,{...pay('order-payment-001',300),createdAt:now},policy);
 // The pure model must apply existing credit once across the whole sequence.
 const entries=[{...drink('ordered-beer-001',1),createdAt:now},wine('ordered-wine-001',1,now),{...drink('ordered-beer-002',1),createdAt:now}];
 const next=M.appendMany(a,entries);assert.equal(M.totals(next).balance,300);assert.equal(M.rewardState(next,policy).credit,0);assert.deepEqual(copy(next.bookings.slice(-3)),entries);
 const before=calls.length;await S.bookMany('ordered-member',entries,'null');const writes=calls.slice(before).filter(c=>c.options.method==='PUT');assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0].options.body).bookings.length,3);
});
test('OK-Sammlung lehnt doppelte Nummern oder eine Zahlung ab, ohne gültige Teile zu übernehmen',()=>{
 const {M}=app(),a=M.empty('a'),entry=drink('batch-duplicate-001',1);
 assert.throws(()=>M.appendMany(a,[entry,entry]),/Doppelte/);assert.throws(()=>M.appendMany(a,[entry,pay()]),/Ungültige/);assert.equal(a.bookings.length,0);
});

const adminRemoval=(targetId,id='admin-removal-001',extra={})=>({id,type:'correction',targetId,count:1,cents:150,confirmation:'admin',reason:'Fehlerhafte Buchung',createdAt:'2026-10-09T18:00:00Z',...extra});
test('Verwaltung darf auch alte bezahlte Getränke löschen; Mitglieder können Admin-Löschungen nicht einschleusen',async()=>{
 const {S,M}=app();await S.book('a',drink('admin-paid-drink',1),'null');await S.book('a',pay('admin-paid-cash',150),'null');const entry=adminRemoval('admin-paid-drink');
 await assert.rejects(S.book('a',entry,'null'),/Administration/);await assert.rejects(S.bookMany('a',[entry],'null'),/Ungültige/);
 const next=await S.adminDelete('a',entry);assert.equal(next.schemaVersion,6);assert.equal(M.totals(next).count,0);assert.equal(M.rewardState(next,null).credit,150);assert.equal((await S.adminDelete('a',entry)).bookings.length,3);
});
test('Admin-Löschung verlangt Freigabe, Grund und ursprüngliche OneDrive-Quelle',async()=>{
 const {S,ctx}=app();await S.book('a',drink('admin-restricted-drink',1),'null');const entry=adminRemoval('admin-restricted-drink');ctx.adminUnlocked=false;await assert.rejects(S.adminDelete('a',entry),/Administration/);ctx.adminUnlocked=true;
 await assert.rejects(S.adminDelete('a',{...entry,reason:''}),/ungültig/);await assert.rejects(S.adminDelete('a',entry,'other:folder'),/vorherigen OneDrive/);assert.equal((await S.read('a')).bookings.length,1);
});
test('Admin-Zahlungslöschung nimmt Bonus zurück und funktioniert idempotent bei verlorener Antwort',async()=>{
 const {S,M,ctx}=app();await S.book('a',drink('admin-twenty-beer',20),'null');const now=new Date().toISOString();await S.book('a',{...pay('admin-full-payment',3000),createdAt:now},'null');
 const entry=adminRemoval('admin-full-payment','admin-payment-reversal',{type:'payment-reversal',cents:3000,createdAt:now});delete entry.count;ctx.loseReply=true;
 const next=await S.adminDelete('a',entry);assert.equal(M.totals(next).balance,3000);assert.equal(M.rewardState(next,S.cachedRewards()).credit,0);assert.equal(M.rewardState(next,S.cachedRewards()).progress,0);
 assert.equal((await S.adminDelete('a',entry)).bookings.length,4);await assert.rejects(S.adminDelete('a',{...entry,id:'second-payment-reversal'}),/bereits gelöscht/);
 await S.book('a',{...pay('replacement-payment',3000),createdAt:now},'null');const repaid=await S.read('a');assert.equal(M.rewardState(repaid,S.cachedRewards()).pointUnits,300);assert.equal(M.totals(repaid).balance,0);
});
test('Löschen einer bereits ausgegebenen Bonuszahlung stellt Schulden ohne negatives Guthaben wieder her',()=>{
 const {M}=app(),p=rewardPolicy(2,300);let a=M.append(M.empty('a'),wine('admin-funded-wine'));a=M.appendWithReward(a,{...pay('admin-funded-payment',300),createdAt:'2026-10-09T12:01:00Z'},p);a=M.append(a,wine('admin-credit-wine',1,'2026-10-09T12:02:00Z'));
 const reversal=adminRemoval('admin-funded-payment','admin-funded-reversal',{type:'payment-reversal',cents:300});delete reversal.count;a=M.append(a,reversal);assert.equal(M.totals(a).balance,600);assert.equal(M.rewardState(a,p).credit,0);assert.equal(M.rewardState(a,p).progress,0);
});
test('Getränk und Zahlung können in beiden Reihenfolgen gelöscht werden, ohne Schulden oder Gutschrift zu erfinden',()=>{
 const {M}=app();for(const reverseFirst of [true,false]){let a=M.append(M.empty('a'),drink('admin-order-drink',1));a=M.append(a,pay('admin-order-payment',150));const d=adminRemoval('admin-order-drink'),r=adminRemoval('admin-order-payment','admin-order-reversal',{type:'payment-reversal'});delete r.count;
 for(const b of reverseFirst?[r,d]:[d,r])a=M.append(a,b);assert.equal(M.totals(a).balance,0);assert.equal(M.totals(a).count,0);assert.equal(M.rewardState(a,null).credit,0);}
});
test('Verbrauch wird ohne Namen nach Berliner Kalenderjahr und Monat gesammelt; Zahlungen zählen nicht als Verbrauch',()=>{
 const {M}=app();let a=M.append(M.empty('member-private-a'),{...drink('stats-old-beer',2),createdAt:'2025-12-31T22:30:00Z'});a=M.append(a,{...drink('stats-new-beer',3),createdAt:'2025-12-31T23:30:00Z'});a=M.append(a,pay('stats-payment',150));a=M.append(a,adminRemoval('stats-new-beer'));
 const b=M.append(M.empty('member-private-b'),wine('stats-wine',2));const data=M.consumption([a,b],'2026');assert.equal(data.beer,2);assert.equal(data.wine,2);assert.equal(data.total,4);assert.equal(data.months[0].beer,2);assert.equal(data.months[9].wine,2);assert.equal(M.consumption([a,b],'2025').beer,2);assert.ok(!JSON.stringify(data).includes('member-private'));assert.ok(!JSON.stringify(data).includes('stats-new-beer'));
});
test('Verbrauch liest alle Kontodateien einschließlich früherer Mitglieder, ohne Konten oder PINs umzuschreiben',async()=>{
 const {S,M,calls,files}=app();await S.book('previous-member',drink('stats-previous-member',3),'null');await S.book('current-member',wine('stats-current-member',2),'null');const file=[...files.values()].find(f=>f.data.memberId==='previous-member');delete file.data.pinChoiceVersion;const before=JSON.stringify([...files]),start=calls.length;
 const data=await S.consumption('2026');assert.equal(data.beer,3);assert.equal(data.wine,2);assert.equal(JSON.stringify([...files]),before);assert.ok(calls.slice(start).every(c=>!c.options.method||c.options.method==='GET'));assert.ok(!JSON.stringify(data).includes('previous-member'));assert.equal(M.validate(file.data,'previous-member'),file.data);
});
test('Eine Zahlung zwischen Vormerkung und OK verhindert die gesamte Sammlung einer Rücknahme plus neuer Getränke',async()=>{
 const {S,M}=app(),now=new Date().toISOString(),d={...drink('batch-unpaid-drink',1),createdAt:now};await S.book('a',d,'null');await S.book('a',{...pay('batch-later-payment',150),createdAt:now},'null');const c=correction(d.id,'batch-correction',1,now);
 await assert.rejects(S.bookMany('a',[c,{...drink('batch-new-beer',1),createdAt:now}],'null'),/bereits ganz oder teilweise bezahlt/);assert.equal((await S.read('a')).bookings.length,2);assert.equal(M.totals(await S.read('a')).balance,0);
});

const pointsPolicy=()=>({schemaVersion:2,id:'points-policy-001',revision:'points-revision-001',startedAt:'2026-10-01T00:00:00Z',thresholdCents:1000,awardUnits:150,beerUnits:150,wineUnits:150});
const modernDrink=(id,kind='beer',pointUnits=0)=>({...drink(id,1),drink:kind,cents:kind==='wine'?300:150,loyaltyVersion:2,...(pointUnits?{pointUnits}:{}),createdAt:'2026-10-09T10:00:00Z'});
const deposit=(id,cents)=>({...pay(id,cents),prepay:true,createdAt:'2026-10-09T09:00:00Z'});
const reversal=(id,target,cents)=>({id,type:'payment-reversal',targetId:target,cents,loyaltyVersion:2,confirmation:'admin',reason:'Fehlerhafte Einzahlung',createdAt:'2026-10-10T10:00:00Z'});
test('Vorauszahlungen sind Geld, neue Treuepunkte getrennt; nur bestätigte Geldbeträge erreichen das Punkteziel',()=>{
 const {M}=app(),p=pointsPolicy();let a=M.appendWithReward(M.empty('a'),deposit('points-deposit-001',1500),p);let r=M.rewardState(a,p);assert.equal(r.prepaid,1500);assert.equal(r.pointUnits,150);assert.equal(r.progress,500);
 a=M.appendMany(a,[modernDrink('points-cash-wine','wine')]);r=M.rewardState(a,p);assert.equal(r.prepaid,1200);assert.equal(r.pointUnits,150);assert.equal(r.progress,500);assert.equal(M.totals(a).balance,0);
 a=M.appendMany(a,[modernDrink('points-free-wine','wine',150)]);r=M.rewardState(a,p);assert.equal(r.pointUnits,0);assert.equal(r.prepaid,1200);assert.equal(r.progress,500);assert.equal(M.totals(a).balance,0);assert.equal(M.totals(a).count,2);
 assert.throws(()=>M.appendMany(a,[modernDrink('points-insufficient','beer',150)]),/reichen nicht/);assert.equal(a.bookings.length,4);
});
test('Getränke ohne Geldzahlung vergeben keine Punkte; Teilzahlungen und verschiedene Getränke zählen den Geldbetrag',()=>{
 const {M}=app(),p=pointsPolicy();p.thresholdCents=450;let a=M.appendMany(M.empty('a'),[modernDrink('points-beer-first'),modernDrink('points-wine-next','wine')]);assert.equal(M.rewardState(a,p).pointUnits,0);
 a=M.appendWithReward(a,{...deposit('points-part-001',200),createdAt:'2026-10-09T11:00:00Z'},p);assert.equal(M.rewardState(a,p).needed,250);
 a=M.appendWithReward(a,{...deposit('points-part-002',250),createdAt:'2026-10-09T11:01:00Z'},p);assert.equal(M.rewardState(a,p).pointUnits,150);assert.equal(M.totals(a).balance,0);assert.equal(M.rewardState(a,p).prepaid,0);
});
test('Historische Bonuswerte bleiben centgenau lesbar; neue Getränke verrechnen sie nicht automatisch',()=>{
 const {M}=app(),p=rewardPolicy(2,300);let a=M.appendWithReward(M.append(M.empty('a'),drink('legacy-points-drink',2)),pay('legacy-points-pay',300),p);const old=copy(a.bookings);
 a=M.appendMany(a,[modernDrink('modern-no-auto-use')]);assert.equal(M.totals(a).balance,150);assert.equal(M.rewardState(a,null).pointUnits,300);assert.equal(M.rewardState(a,null).prepaid,0);assert.deepEqual(copy(a.bookings.slice(0,3)),old);
 a=M.appendMany(a,[modernDrink('modern-redeem-wine','wine',150)]);assert.equal(M.rewardState(a,null).pointUnits,150);assert.equal(M.totals(a).balance,150);
});
test('Teilweises Admin-Storno historisch mit Bonus bezahlter Sammelbuchungen gibt nur tatsächlich zurückgenommene Punkte zurück',()=>{
 const {M}=app(),p=rewardPolicy(2,300);let a=M.appendWithReward(M.append(M.empty('a'),drink('legacy-earn-first',2)),pay('legacy-earn-payment',300),p);a=M.append(a,drink('legacy-five-drinks',5));
 a=M.append(a,{...adminRemoval('legacy-five-drinks','legacy-return-last'),createdAt:'2026-10-10T10:00:00Z'});assert.equal(M.totals(a).balance,300);assert.equal(M.rewardState(a,null).pointUnits,0);
 a=M.append(a,{...adminRemoval('legacy-five-drinks','legacy-return-rest'),count:4,cents:600,createdAt:'2026-10-10T10:01:00Z'});assert.equal(M.totals(a).balance,0);assert.equal(M.rewardState(a,null).pointUnits,300);
});
test('Löschung einer punktgebenden Vorauszahlung nimmt Geld und Punkte getrennt zurück; eingelöste Punkte werden negativ',()=>{
 const {M}=app(),p=pointsPolicy();let a=M.appendWithReward(M.empty('a'),deposit('points-earned-deposit',1000),p);a=M.appendMany(a,[modernDrink('points-already-redeemed','wine',150),modernDrink('points-cash-consumed')]);
 a=M.append(a,reversal('points-payment-delete','points-earned-deposit',1000));assert.equal(M.totals(a).balance,150);assert.equal(M.rewardState(a,p).prepaid,0);assert.equal(M.rewardState(a,p).pointUnits,-150);
 a=M.append(a,{...adminRemoval('points-already-redeemed','points-drink-delete'),drink:'wine',cents:300,createdAt:'2026-10-10T10:01:00Z'});assert.equal(M.rewardState(a,p).pointUnits,0);assert.equal(M.totals(a).balance,150);
});
test('Historische Geldboni nach ausdrücklicher Punkteeinlösung werden bei Zahlungslöschung als Punkte zurückgenommen',()=>{
 const {M}=app(),p=rewardPolicy(2,300);let a=M.appendWithReward(M.append(M.empty('a'),drink('legacy-point-earn',2)),pay('legacy-point-payment',300),p);a=M.appendMany(a,[modernDrink('legacy-point-wine','wine',150)]);
 a=M.append(a,reversal('legacy-point-pay-delete','legacy-point-payment',300));assert.equal(M.totals(a).balance,300);assert.equal(M.rewardState(a,null).prepaid,0);assert.equal(M.rewardState(a,null).pointUnits,-150);
 a=M.append(a,{...adminRemoval('legacy-point-wine','legacy-point-wine-delete'),drink:'wine',cents:300,createdAt:'2026-10-10T10:01:00Z'});assert.equal(M.rewardState(a,null).pointUnits,0);
});
test('Admin kann Bier, Wein und Zahlung atomar bereinigen; verlorene Antwort wiederholt keine Stornos',async()=>{
 const {S,M,ctx}=app();await S.bookMany('a',[modernDrink('bulk-admin-beer'),modernDrink('bulk-admin-wine','wine')],'null');await S.book('a',{...deposit('bulk-admin-paid',450),createdAt:new Date().toISOString()},'null');
 const entries=[{...adminRemoval('bulk-admin-beer','bulk-admin-remove-beer'),createdAt:'2027-01-01T10:00:00Z'},{...adminRemoval('bulk-admin-wine','bulk-admin-remove-wine'),drink:'wine',cents:300,createdAt:'2027-01-01T10:00:00Z'}, {...reversal('bulk-admin-remove-payment','bulk-admin-paid',450),createdAt:'2027-01-01T10:00:00Z'}];ctx.loseReply=true;
 const a=await S.adminDelete('a',entries);assert.equal(M.totals(a).balance,0);assert.equal(M.totals(a).count,0);assert.equal(M.rewardState(a,null).prepaid,0);assert.equal((await S.adminDelete('a',entries)).bookings.length,6);
});
test('Eine ungültige Admin-Bereinigung übernimmt keine gültigen Teilstornos und benötigt Adminfreigabe',async()=>{
 const {S,M,ctx}=app();await S.bookMany('a',[modernDrink('bulk-invalid-beer')],'null');const before=copy((await S.read('a')).bookings);
 await assert.rejects(S.adminDelete('a',[adminRemoval('bulk-invalid-beer','bulk-valid-undo'),adminRemoval('missing-booking','bulk-invalid-undo')]),/zurückgenommen/);assert.deepEqual(copy((await S.read('a')).bookings),before);
 ctx.adminUnlocked=false;await assert.rejects(S.adminDelete('a',[adminRemoval('bulk-invalid-beer')]),/Administration/);assert.equal(M.totals(await S.read('a')).balance,150);
});
test('Parallele Einlösungen können dieselben Treuepunkte nicht doppelt ausgeben',async()=>{
 const {S,M}=app();let p=await S.rewards();p=await S.saveRewards({thresholdCents:1000,awardUnits:150,beerUnits:150,wineUnits:150},p.revision);await S.book('a',{...deposit('parallel-point-deposit',1000),createdAt:new Date().toISOString()},'null');
 const results=await Promise.allSettled([S.bookMany('a',[modernDrink('parallel-point-a','beer',150)],'null'),S.bookMany('a',[modernDrink('parallel-point-b','wine',150)],'null')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/reichen nicht/);assert.equal(M.rewardState(await S.read('a'),p).pointUnits,0);
});
test('Punktebedarf wird frisch geprüft; falscher Bedarf und Einstellungswechsel verhindern die gesamte Sammlung',async()=>{
 const {S,M}=app();let p=await S.rewards();p=await S.saveRewards({thresholdCents:1000,awardUnits:300,beerUnits:150,wineUnits:300},p.revision);await S.book('a',{...deposit('changed-point-deposit',1000),createdAt:new Date().toISOString()},'null');
 const before=copy((await S.read('a')).bookings);await assert.rejects(S.bookMany('a',[modernDrink('changed-point-cash'),modernDrink('changed-point-cheap-wine','wine',150)],'null'),/Einstellung wurde geändert/);assert.deepEqual(copy((await S.read('a')).bookings),before);
 await S.saveRewards({wineUnits:150},p.revision);const a=await S.bookMany('a',[modernDrink('changed-point-wine-correct','wine',150)],'null');assert.equal(M.rewardState(a,null).pointUnits,150);
});
test('Statistik summiert Getränkewerte und aktuelle offene Geldbeträge ohne Namen; Punkte und Vorauszahlungen sind keine Umsätze',()=>{
 const {M}=app(),p=pointsPolicy();let a=M.appendWithReward(M.empty('secret-member'),deposit('stats-money-first',1000),p);a=M.appendMany(a,[modernDrink('stats-free-wine','wine',150),modernDrink('stats-paid-beer')]);let b=M.appendMany(M.empty('private-second'),[modernDrink('stats-open-wine','wine')]);
 const stats=M.consumption([a,b],'2026');assert.equal(stats.beerCents,150);assert.equal(stats.wineCents,600);assert.equal(stats.totalCents,750);assert.equal(stats.openCents,300);assert.equal(stats.outstandingCents,300);assert.equal(stats.prepaidCents,850);assert.equal(stats.months[9].totalCents,750);assert.ok(!JSON.stringify(stats).includes('secret-member'));assert.ok(!JSON.stringify(stats).includes('private-second'));
});
test('Hintergrund-Lesen überspringt doppelte Dateimetadaten und legt keine Einstellungen an',async()=>{
 const {S,calls,files}=app();assert.equal(await S.previewRewards(),null);assert.equal(files.size,0);await S.bookMany('a',[modernDrink('prefetch-readonly-beer')],'null');S.reset();calls.length=0;await S.list(['a']);assert.equal(calls.filter(c=>c.options.method==='PUT').length,0);assert.equal(calls.filter(c=>c.url.includes('file-konto-')).length,2);
});
test('Gemischte Einzahlungen, Punktedrinks und Admin-Stornos erhalten Geld- und Punktebilanz über viele Reihenfolgen',()=>{
 const {M}=app(),p=pointsPolicy();let seed=701;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let round=0;round<5;round++){let a=M.empty('a');for(let step=0;step<60;step++){
   const s=M.ledger(a),prefix='random-'+round+'-'+step,action=rand(4),createdAt='2027-01-01T12:00:00Z';
   if(action===0)a=M.appendWithReward(a,{...deposit(prefix+'-deposit',rand(1000)+1),createdAt},p);
   else if(action===1){const kind=rand(2)?'beer':'wine',units=s.points>=150&&rand(2)?150:0;a=M.appendMany(a,[{...modernDrink(prefix+'-drink',kind,units),createdAt}]);}
   else if(action===2){const targets=[...s.drinks.values()].filter(t=>t.count);if(targets.length){const t=targets[rand(targets.length)];a=M.append(a,{...adminRemoval(t.booking.id,prefix+'-delete'),drink:t.booking.drink,cents:M.unitPrice(t.booking),createdAt});}}
   else {const payments=[...s.payments.values()].filter(b=>!s.reversedPayments.has(b.id));if(payments.length){const payment=payments[rand(payments.length)];a=M.append(a,{...reversal(prefix+'-reverse',payment.id,payment.cents),createdAt});}}
   const after=M.ledger(a),cashDrinks=[...after.drinks.values()].reduce((n,t)=>n+(t.booking.pointUnits?0:t.count*M.unitPrice(t.booking)),0),cashPaid=[...after.payments.values()].filter(b=>!after.reversedPayments.has(b.id)).reduce((n,b)=>n+b.cents,0),awarded=[...after.bonuses.values()].filter(b=>!after.reversedPayments.has(b.paymentId)).reduce((n,b)=>n+b.cents,0),spent=[...after.drinks.values()].reduce((n,t)=>n+t.redeemed,0);
   assert.equal(after.balance-(after.credit-after.rewardCredit),cashDrinks-cashPaid);assert.equal(after.points,awarded-spent);M.validate(a,'a');
 }}
});
test('Rücknahme einer Einzahlung ordnet offene Geldbeträge ausschließlich Geldgetränken zu',()=>{
 const {M}=app(),p=pointsPolicy();let a=M.appendWithReward(M.empty('a'),deposit('allocation-deposit',1000),p);a=M.appendMany(a,[modernDrink('allocation-free-wine','wine',150),modernDrink('allocation-cash-beer')]);a=M.append(a,reversal('allocation-delete-payment','allocation-deposit',1000));const state=M.ledger(a);assert.equal(state.drinks.get('allocation-free-wine').unpaid,0);assert.equal(state.drinks.get('allocation-cash-beer').unpaid,150);assert.equal(M.consumption([a],'2026').openCents,150);
});
test('Kleine historische Bonusbruchteile bleiben als Unterpunkte erhalten und werden bei neuen Getränken nicht gerundet oder automatisch genutzt',()=>{
 const {M}=app(),p=rewardPolicy(1,1);let a=M.appendWithReward(M.append(M.empty('a'),drink('tiny-legacy-drink',1)),pay('tiny-legacy-payment',150),p);assert.equal(M.rewardState(a,null).pointUnits,1);a=M.appendMany(a,[modernDrink('tiny-new-cash-drink')]);assert.equal(M.rewardState(a,null).pointUnits,1);assert.equal(M.rewardState(a,null).prepaid,0);assert.equal(M.totals(a).balance,150);
});

test('Frühere Teilzahlung lässt sich nicht mit ungedeckten Punkten stornieren; gemeinsame Bereinigung bleibt möglich',async()=>{
 const {S,M}=app();await S.rewards();const now=new Date().toISOString();await S.book('a',{...deposit('funding-first-payment',1500),createdAt:now},'null');await S.book('a',{...deposit('funding-second-payment',1500),createdAt:now},'null');
 const first={...reversal('funding-first-delete','funding-first-payment',1500),createdAt:new Date().toISOString()},second={...reversal('funding-second-delete','funding-second-payment',1500),createdAt:new Date().toISOString()};
 await assert.rejects(S.adminDelete('a',first),e=>e.code==='rewardFunding');const unchanged=await S.read('a');assert.equal(unchanged.bookings.length,3);assert.equal(M.rewardState(unchanged,S.cachedRewards()).points,2);
 const cleared=await S.adminDelete('a',[first,second]);assert.equal(M.rewardState(cleared,S.cachedRewards()).points,0);assert.equal(M.rewardState(cleared,S.cachedRewards()).prepaid,0);assert.equal((await S.adminDelete('a',[first,second])).bookings.length,5);
});

async function mobileFixture(){
 const a=app();configure(a);a.ctx.DeckelCommands={validate:c=>c};
 const record={version:1,alias:'1'.repeat(32),revision:'revision-phone-test',memberId:'a'};
 await a.S.writeMobileFile(await a.S.mobileFileName('a'),record);
 return {...a,job:()=>({id:webcrypto.randomUUID(),alias:record.alias,revision:record.revision,created_at:Date.now()})};
}
test('Handybuchung übersteht verlorene Antwort und Wiederholung ohne doppelte Striche oder Zahlungen',async()=>{
 const a=await mobileFixture(),{S,M,ctx,job}=a,j=job(),command={version:1,kind:'drinks',entries:[{drink:'beer'},{drink:'wine'}]};
 ctx.loseReply=true;await S.applyMobileCommand('a',j,command,S.sourceKey());await S.applyMobileCommand('a',j,command,S.sourceKey());
 assert.equal(M.totals(await S.read('a')).balance,450);assert.equal((await S.read('a')).bookings.length,2);
 const cash=job();await S.applyMobileCommand('a',cash,{version:1,kind:'cash',cents:1000},S.sourceKey());const before=copy(await S.read('a'));
 await S.applyMobileCommand('a',cash,{version:1,kind:'cash',cents:1000},S.sourceKey());assert.deepEqual(copy(await S.read('a')),before);
});
test('Handybuchung prüft aktuelle Treuepunkte und den persönlichen Zugang',async()=>{
 const {S,job}=await mobileFixture();
 await assert.rejects(S.applyMobileCommand('a',job(),{version:1,kind:'drinks',entries:[{drink:'beer',pointUnits:150}]},S.sourceKey()),e=>e.code==='pointsChanged');
 await assert.rejects(S.applyMobileCommand('a',{...job(),revision:'replaced-revision'},{version:1,kind:'cash',cents:100},S.sourceKey()),e=>e.code==='accessChanged');
 assert.equal((await S.read('a')).bookings.length,0);
});
test('Handyrücknahme ist einmalig und lehnt einen inzwischen bezahlten Eintrag ab',async()=>{
 const {S,M,job}=await mobileFixture(),j=job();
 await S.applyMobileCommand('a',j,{version:1,kind:'drinks',entries:[{drink:'beer'}]},S.sourceKey());
 const undo=job(),command={version:1,kind:'undo',targetId:'mobile-'+j.id+'-0'};
 await S.applyMobileCommand('a',undo,command,S.sourceKey());await S.applyMobileCommand('a',undo,command,S.sourceKey());assert.equal(M.totals(await S.read('a')).balance,0);
 const next=job();await S.applyMobileCommand('a',next,{version:1,kind:'drinks',entries:[{drink:'wine'}]},S.sourceKey());
 await S.applyMobileCommand('a',job(),{version:1,kind:'cash',cents:300},S.sourceKey());
 await assert.rejects(S.applyMobileCommand('a',job(),{version:1,kind:'undo',targetId:'mobile-'+next.id+'-0'},S.sourceKey()),e=>e.code==='correctionChanged');
});
