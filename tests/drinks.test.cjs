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
  assert.equal([...files.values()].find(f=>f.data.memberId==='a').data.pin,null);assert.deepEqual(copy(migrated.bookings),before);assert.equal(M.rewardState(migrated,await S.rewards()).credit,300);
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
  const a=app(),p=await a.S.rewards();assert.equal(p.count,20);assert.equal(p.cents,300);
  const changed=await a.S.saveRewards(10,150,p.revision);
  assert.equal(changed.count,10);assert.equal(changed.cents,150);assert.equal(changed.id,p.id);assert.equal(changed.startedAt,p.startedAt);assert.notEqual(changed.revision,p.revision);
  assert.deepEqual(a.storageWrites,[]);assert.equal(a.files.size,1);
});
test('Bonus-Einstellungen verhindern ungültige Werte, unberechtigte und veraltete Änderungen',async()=>{
  const a=app(),p=await a.S.rewards();
  for(const [count,cents] of [[0,300],[1.5,300],[20,0],[20,301.5],[10001,300],[20,100001]])await assert.rejects(a.S.saveRewards(count,cents,p.revision),/ungültig/);
  a.ctx.adminUnlocked=false;await assert.rejects(a.S.saveRewards(10,150,p.revision),/Verwaltung/);a.ctx.adminUnlocked=true;
  await a.S.saveRewards(10,150,p.revision);await assert.rejects(a.S.saveRewards(30,450,p.revision),/inzwischen geändert/);
  assert.equal((await a.S.rewards()).count,10);
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
  account=await a.S.read('a');assert.equal(account.bookings.length,3);assert.equal(account.bookings.filter(b=>b.type==='bonus').length,1);assert.equal(a.M.rewardState(account,rewardPolicy()).credit,300);assert.deepEqual(a.storageWrites,[]);
});
test('Zwei gleichzeitige Teilzahlungen vergeben den erreichten Bonus genau einmal',async()=>{
  const a=app();configure(a);const account=await a.S.setPin('a','4826'),sig=JSON.stringify(account.pin);await a.S.book('a',drink('drink-0020',20),sig);
  await Promise.all([a.S.book('a',pay('payment-concurrent-a',1500),sig),a.S.book('a',pay('payment-concurrent-b',1500),sig)]);
  const saved=await a.S.read('a');assert.equal(a.M.totals(saved).balance,0);assert.equal(a.M.rewardState(saved,rewardPolicy()).credit,300);assert.equal(saved.bookings.filter(b=>b.type==='bonus').length,1);
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
  const a=app();a.ctx.loseReply=true;const p=await a.S.rewards();assert.equal(p.count,20);assert.equal(a.files.size,1);
  a.ctx.loseReply=true;const saved=await a.S.saveRewards(25,400,p.revision);assert.equal(saved.count,25);assert.equal((await a.S.rewards()).cents,400);
  a.ctx.navigator.onLine=false;await assert.rejects(a.S.saveRewards(10,150,saved.revision),/Offline/);assert.equal(a.files.get('bonus-einstellungen.json').data.count,25);
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
  account=await a.S.adminPaypalPayment('member-a',{...first,id:'paypal-admin-TXN000002'});assert.equal(a.M.totals(account).balance,0);assert.equal(a.M.rewardState(account,a.S.cachedRewards()).credit,300);
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
test('Korrektur bezahlter Striche gibt Guthaben zurück, ohne Zahlung oder Bonus zu ändern',()=>{
  const {M}=app(),p=rewardPolicy();let a=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);
  a=M.appendWithReward(a,pay('payment-0020',3000),p);const original=copy(a.bookings);
  a=M.appendWithReward(a,correction('drink-0020'),p);
  assert.deepEqual(copy(M.totals(a)),{balance:0,count:19});assert.equal(M.rewardState(a,p).credit,450);
  assert.equal(a.schemaVersion,3);assert.deepEqual(copy(a.bookings.slice(0,3)),original);
  a=M.appendWithReward(a,drink('drink-0021',3),p);assert.equal(M.rewardState(a,p).credit,0);assert.equal(M.totals(a).balance,0);
  assert.equal(a.bookings.filter(b=>b.type==='bonus').length,1);
});
test('Korrektur gibt verbrauchtes Bonusguthaben zurück und verrechnet gemischte Buchungen centgenau',()=>{
  const {M}=app(),p={...rewardPolicy(),cents:100};let a=M.appendWithReward(M.empty('a'),drink('drink-0020',20),p);
  a=M.appendWithReward(a,pay('payment-0020',3000),p);a=M.appendWithReward(a,drink('drink-0021',2),p);
  assert.equal(M.totals(a).balance,200);a=M.appendWithReward(a,correction('drink-0021'),p);
  assert.equal(M.totals(a).balance,50);assert.equal(M.rewardState(a,p).credit,0);
  a=M.appendWithReward(a,correction('drink-0021','correct-0002'),p);assert.equal(M.totals(a).balance,0);assert.equal(M.rewardState(a,p).credit,100);
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
