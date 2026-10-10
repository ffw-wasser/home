const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
async function fixture(){
 const db=new DatabaseSync(':memory:');for(const name of ['schema.sql','central.sql'])db.exec(fs.readFileSync(require.resolve('../cloudflare/push/'+name),'utf8'));
 let queries=0,beforeBatch=null;
 const prepare=sql=>{let values=[];const run=()=>{if(++queries>50)throw Error('Free query limit');return db.prepare(sql);};const stmt={bind(...args){values=args;return stmt;},async first(){return run().get(...values)||null;},async all(){return {results:run().all(...values)};},async run(){return {meta:{changes:Number(run().run(...values).changes)}};},sync(){return run().run(...values);}};return stmt;};
 const DB={prepare,async batch(statements){if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn();}db.exec('BEGIN');try{const r=statements.map(s=>s.sync());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,ADMIN_TOKEN:'a'.repeat(64),INVITE_SECRET:'b'.repeat(64),VAPID_PRIVATE_JWK:'{}',VAPID_PUBLIC_KEY:'key'};
 const ctx=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,URL,Request,Response,AbortSignal,btoa,atob,Uint8Array,Date});
 for(const name of ['drinks-model','deckel-crypto','deckel-commands','drinks-ledger-shared'])vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/'+name+'.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../cloudflare/push/central.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(require.resolve('../cloudflare/push/worker.js'),'utf8').replace('export default {','globalThis.worker={'),ctx);
 const source='drive:root',record={version:1,alias:'1'.repeat(32),revision:'revision-0001',key:'c'.repeat(64),memberId:'member-1'},policy={schemaVersion:2,id:'policy-0001',revision:'policy-0001',startedAt:'2020-01-01T00:00:00Z',thresholdCents:3000,awardUnits:300,beerUnits:150,wineUnits:150};
 async function call(path,data={},token=env.ADMIN_TOKEN){queries=0;const r=await ctx.worker.fetch(new Request('https://test.account.workers.dev'+path,{method:'POST',headers:{Origin:'https://ffw-wasser.github.io',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({source,...data})}),env);return {status:r.status,data:await r.json(),queries};}
 const admin=(action,data={})=>call('/admin/central/'+action,data);
 async function start(count=1){assert.equal((await admin('start',{policy})).status,200);for(let i=1;i<=count;i++){const a=ctx.DrinksModel.append(ctx.DrinksModel.empty('member-'+i),{id:'drink-0001',type:'drinks',count:2,cents:300,createdAt:'2026-10-01T10:00:00Z'});assert.equal((await admin('import',{account:a})).status,200);}await call('/admin/account',record);await admin('access',{record});assert.equal((await admin('activate',{count,backup:'sicherung-migration.json'})).status,200);}
 async function command(c,id=webcrypto.randomUUID()){const cap=(await call('/admin/account',record)).data.actionCapability,envelope=await ctx.DeckelCommands.seal({version:1,...c},record,id);return {body:{alias:record.alias,revision:record.revision,id,envelope},cap};}
 return {db,ctx,record,policy,source,env,call,admin,start,command,race:fn=>beforeBatch=fn};
}
test('Central: access control, source binding, encrypted persistence and unchanged imports',async()=>{
 const f=await fixture();assert.equal((await f.call('/admin/central/status',{},'wrong')).status,401);assert.equal((await f.call('/central/snapshot',{alias:f.record.alias},'wrong')).data.mode,'legacy');await f.start();
 assert.equal((await f.admin('read',{memberId:'member-1',source:'wrong'})).status,409);
 const a=(await f.admin('read',{memberId:'member-1'})).data.account;assert.equal(f.ctx.DrinksModel.totals(a).balance,300);
 assert.ok(!f.db.prepare('SELECT payload FROM ledgers').get().payload.includes('drink-0001'));
 assert.equal((await f.admin('import',{account:a})).status,409);
 assert.equal((await f.call('/central/snapshot',{alias:f.record.alias},'wrong')).status,401);
 const proof=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('deckel-read/v1:'+f.record.alias+':'+f.record.key))).toString('base64url');
 const r=await f.call('/central/snapshot',{alias:f.record.alias},proof);assert.equal(r.status,200);const snapshot=await f.ctx.DeckelCrypto.open(r.data.envelope,f.record);assert.equal(snapshot.balance,300);assert.equal(snapshot.actions.central,true);f.db.close();
});
test('Central: phone booking without iPad, repeat delivery and altered reuse',async()=>{
 const f=await fixture();await f.start();const job=await f.command({kind:'drinks',entries:[{drink:'wine'}]});
 assert.equal((await f.call('/commands/submit',job.body,job.cap)).data.status,'done');assert.equal((await f.call('/commands/submit',job.body,job.cap)).data.status,'done');
 assert.equal((await f.admin('read',{memberId:'member-1'})).data.account.bookings.length,2);
 const altered=await f.command({kind:'drinks',entries:[{drink:'beer'}]},job.body.id);assert.equal((await f.call('/commands/submit',altered.body,altered.cap)).status,409);
 const row=f.db.prepare('SELECT status,envelope FROM commands').get();assert.equal(row.status,'done');assert.equal(row.envelope,'');f.db.close();
});
test('Central: cash earns points exactly once and insufficient points reject without balance changes',async()=>{
 const f=await fixture();await f.start();let job=await f.command({kind:'cash',cents:3000});assert.equal((await f.call('/commands/submit',job.body,job.cap)).data.status,'done');
 assert.equal((await f.call('/commands/submit',job.body,job.cap)).data.status,'done');let a=(await f.admin('read',{memberId:'member-1'})).data.account;assert.equal(f.ctx.DrinksModel.rewardState(a,f.policy).pointUnits,300);assert.equal(a.bookings.filter(b=>b.type==='bonus').length,1);
 f.db.exec('UPDATE commands SET created_at=0');job=await f.command({kind:'drinks',entries:[{drink:'beer',pointUnits:150},{drink:'wine',pointUnits:150},{drink:'beer',pointUnits:150}]});
 const r=await f.call('/commands/submit',job.body,job.cap);assert.equal(r.data.status,'rejected');assert.equal(r.data.result,'pointsChanged');assert.equal((await f.admin('read',{memberId:'member-1'})).data.account.bookings.length,a.bookings.length);f.db.close();
});
test('Central: stale writes never overwrite a concurrent booking',async()=>{
 const f=await fixture();await f.start();const old=(await f.admin('read',{memberId:'member-1'})).data,job=await f.command({kind:'drinks',entries:[{drink:'wine'}]});await f.call('/commands/submit',job.body,job.cap);
 assert.equal((await f.admin('write',{memberId:'member-1',version:old.version,account:old.account})).status,409);
 f.race(()=>f.db.exec('UPDATE ledger_meta SET seq=seq+1'));const fresh=(await f.admin('read',{memberId:'member-1'})).data;assert.equal((await f.admin('write',{memberId:'member-1',version:fresh.version,account:fresh.account})).status,409);f.db.close();
});
test('Central: reset is atomic, repeat-safe and rejects old queued phone entries',async()=>{
 const f=await fixture();await f.start(3);const id=webcrypto.randomUUID(),seq=(await f.admin('status')).data.seq;
 for(const memberId of ['member-1','member-2'])assert.equal((await f.admin('reset-stage',{memberId,id,seq})).status,200);
 const request={id,seq,members:['member-1','member-2'],backup:'sicherung-reset.json'};
 assert.equal((await f.admin('reset',request)).status,200);assert.equal((await f.admin('reset',request)).data.duplicate,true);
 for(const memberId of request.members)assert.equal((await f.admin('read',{memberId})).data.account.bookings.length,0);
 assert.equal((await f.admin('read',{memberId:'member-3'})).data.account.bookings.length,1);
 const job=await f.command({kind:'cash',cents:3000});const r=await f.call('/commands/submit',job.body,job.cap);assert.equal(r.data.status,'rejected');assert.equal(r.data.result,'accessChanged');
 f.db.exec('UPDATE commands SET created_at=0');await new Promise(r=>setTimeout(r,5));const newjob=await f.command({kind:'drinks',entries:[{drink:'beer'}],epoch:id});assert.equal((await f.call('/commands/submit',newjob.body,newjob.cap)).data.status,'done');f.db.close();
});
test('Central: concurrent write after backup aborts whole reset; 60 accounts fit Free query budget',async()=>{
 const f=await fixture();await f.start(60);const id=webcrypto.randomUUID(),seq=(await f.admin('status')).data.seq,members=Array.from({length:60},(_,i)=>'member-'+(i+1));
 for(const memberId of members)assert.equal((await f.admin('reset-stage',{id,seq,memberId})).status,200);
 f.race(()=>f.db.exec('UPDATE ledger_meta SET seq=seq+1'));assert.equal((await f.admin('reset',{id,seq,members,backup:'sicherung-reset.json'})).status,409);
 for(const memberId of members)assert.equal((await f.admin('read',{memberId})).data.account.bookings.length,1);
 const nextSeq=(await f.admin('status')).data.seq;for(const memberId of members)await f.admin('reset-stage',{id,seq:nextSeq,memberId});const done=await f.admin('reset',{id,seq:nextSeq,members,backup:'sicherung-new.json'});assert.equal(done.status,200);assert.ok(done.queries<15);f.db.close();
});
test('Central client: migration, backups and reset use the real service contract',async()=>{
 const f=await fixture(),files=new Map(),backups=[],events=[];let locked=false,connected=false;
 f.ctx.adminUnlocked=true;
 const original=f.ctx.DrinksModel.append(f.ctx.DrinksModel.empty('member-1'),{id:'drink-0001',type:'drinks',count:2,cents:300,createdAt:'2026-10-01T10:00:00Z'});
 f.ctx.DrinksStore={sourceKey:()=>connected?f.source:'',readMobileFile:async name=>{connected=true;return name.startsWith('handy-member')?{data:f.record}:files.get(name)||null;},writeMobileFile:async(name,data)=>{events.push('marker:'+data.state);files.set(name,{data});},mobileIds:async()=>['member-1'],mobileFileName:async()=> 'handy-member.json',localMigrationSnapshot:async()=>({source:f.source,policy:f.policy,entries:[{name:'bonus-einstellungen.json',account:f.policy,locked},{name:'konto-member.json',account:original,locked}]}),writeBackup:async(name,data,source)=>{assert.equal(source,f.source);events.push('backup');backups.push(data);return name;},lockMigrationSnapshot:async()=>{events.push('lock');locked=true;},reset:()=>{}};
 f.ctx.DrinksPush={config:async()=>{connected=true;return {origin:'https://test.account.workers.dev',token:f.env.ADMIN_TOKEN};},request:async(c,path,data)=>{const r=await f.call(path,data,c.token);if(r.status!==200)throw Object.assign(Error(r.data.error),{status:r.status});return r.data;}};
 vm.runInContext(fs.readFileSync(require.resolve('../js/features/drinks/drinks-central.js'),'utf8'),f.ctx);
 const result=await f.ctx.DrinksCentral.migrate();assert.match(result,/abgeschlossen/);assert.equal(files.get('konten-zentrale.json').data.state,'active');assert.equal(backups[0].accounts[0].bookings.length,1);assert.deepEqual(events,['backup','marker:preparing','lock','marker:active']);
 const plan=await f.ctx.DrinksCentral.prepareReset('all');assert.equal(backups.length,2);assert.equal((await f.admin('read',{memberId:'member-1'})).data.account.bookings.length,1);assert.equal(await f.ctx.DrinksCentral.executeReset(plan),1);assert.equal((await f.admin('read',{memberId:'member-1'})).data.account.bookings.length,0);f.db.close();
});
