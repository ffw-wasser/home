const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/portal-fixture.cjs');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const policy={schemaVersion:2,id:'paused-policy',revision:'paused-v1',startedAt:'2026-01-01T00:00:00Z',thresholdCents:1000,awardUnits:150,beerUnits:150,wineUnits:150};
const deposit=id=>({id,type:'payment',cents:1000,method:'cash',confirmation:'member',prepay:true,createdAt:'2026-10-29T10:00:00Z'});
test('Shipped pause preserves historical points and money; payments earn nothing and new redemptions fail',()=>{
 const c=vm.createContext({});vm.runInContext(read('js/features/drinks/drinks-model.js'),c);const M=c.DrinksModel;
 let a=M.appendWithReward(M.empty('synthetic'),deposit('prior-payment'),policy);const before=JSON.stringify(a),points=M.rewardState(a,policy).pointUnits;
 vm.runInContext(read('js/core/optional-features.js'),c);
 assert.equal(c.H2OFeatures.rewards,false);assert.equal(c.H2OFeatures.challenge,false);assert.equal(JSON.stringify(M.validate(a,'synthetic')),before);
 a=M.appendWithReward(a,deposit('paused-payment'),policy);assert.equal(a.bookings.filter(b=>b.type==='bonus').length,1);assert.equal(M.rewardState(a,policy).pointUnits,points);assert.equal(M.rewardState(a,policy).prepaid,2000);
 const drink={id:'paused-drink',type:'drinks',count:1,drink:'beer',cents:150,loyaltyVersion:2,createdAt:'2026-10-29T10:01:00Z'};
 a=M.appendMany(a,[drink]);assert.equal(M.rewardState(a,policy).prepaid,1850);assert.equal(M.rewardState(a,policy).pointUnits,points);assert.equal(M.totals(a).balance,0);
 assert.throws(()=>M.appendMany(a,[{...drink,id:'forbidden-redemption',pointUnits:150}]),/pausiert/);
 assert.throws(()=>M.append(a,{...drink,id:'forbidden-legacy',loyaltyVersion:undefined}),/pausiert/);
 assert.equal(JSON.stringify(a.bookings.slice(0,2)),JSON.stringify(JSON.parse(before).bookings));
 assert.equal(JSON.stringify(M.appendWithReward(a,deposit('paused-payment'),policy)),JSON.stringify(a));
});
test('Production Worker blocks challenge and bonus policy writes and does not award birthdays',async()=>{
 const f=await fixture({now:Date.parse('2026-06-15T12:00:00Z'),features:null});assert.equal(f.c.H2OFeatures.rewards,false);
 const count=()=>f.sql.prepare('SELECT COUNT(*) n FROM ledgers').get().n;
 const initial=count();
 const r=await f.c.worker.fetch(new Request('https://test.example/challenge/solo-create',{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+f.env.ADMIN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({alias:f.people[0].alias,revision:f.people[0].revision})}),f.env);
 assert.equal(r.status,409);assert.match((await r.json()).error,/pausiert/);assert.equal(count(),initial);assert.equal(await f.c.DeckelChallengeService.ready(f.env),false);
 assert.equal((await f.call('birthday-policy',{revision:'synthetic',awardUnits:150},null,true)).status,409);
 f.raw('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-birthday\r\nDTSTART:20260615T100000Z\r\nDTEND:20260615T110000Z\r\nSUMMARY:Geburtstag Testperson 1\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');f.clock.now+=301000;await f.c.PortalService.scheduled(f.env);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM portal_birthdays').get().n,0);assert.equal(count(),initial);
});
test('All shipped entry points load the same pause policy before their business modules',()=>{
 for(const page of ['index.html','deckel.html']){const source=read(page);assert.ok(source.indexOf('js/core/optional-features.js')<source.indexOf(page==='index.html'?'js/features/drinks/drinks-model.js':'js/features/drinks/deckel-view.js'));}
 assert.match(read('cloudflare/push/build.cjs'),/const sources=\['js\/core\/optional-features.js'/);
 assert.match(read('service-worker.js'),/\.\/js\/core\/optional-features.js/);
 assert.match(read('index.html'),/id="settingsBacklogView"/);assert.match(read('docs/BACKLOG.md'),/Keine rückwirkende Vergabe/);
});
