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
  const ctx=vm.createContext({crypto:webcrypto,TextEncoder,URL,console,navigator:{onLine:true},adminUnlocked:true,
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

test('Privater Handyzugang bleibt gehasht in OneDrive; falsche PIN-Sitzung und Konflikte werden abgelehnt',async()=>{
  const a=app();await a.S.setPin('member-a','1234');const signature=JSON.stringify((await a.S.read('member-a')).pin);
  const accountBefore=copy(a.S.cached('member-a'));
  const first=await a.S.createMobileAccess('member-a',signature,'https://deckel.example/');
  const credentials=JSON.parse(decodeURIComponent(new URL(first).hash.slice(1)));assert.match(credentials.token,/^[a-f0-9]{64}$/);
  const entry=[...a.files].find(([key])=>key.startsWith('zugang-'));assert.ok(entry);assert.equal(entry[1].data.memberId,'member-a');assert.equal(entry[1].data.token,undefined);assert.notEqual(entry[1].data.tokenHash,credentials.token);
  const oldRevision=entry[1].data.revision;await a.S.createMobileAccess('member-a',signature,'https://deckel.example/');assert.notEqual(a.files.get(entry[0]).data.revision,oldRevision);
  assert.deepEqual(copy(a.S.cached('member-a')),accountBefore);assert.equal(a.storageWrites.length,0);
  await assert.rejects(a.S.createMobileAccess('member-a','wrong','https://deckel.example/'),/erneut/);
  await assert.rejects(a.S.createMobileAccess('member-a',signature,'http://deckel.example/'),/Ungültige/);
  a.ctx.forceConflict=1;await assert.rejects(a.S.createMobileAccess('member-a',signature,'https://deckel.example/'),/gleichzeitig/);
});
