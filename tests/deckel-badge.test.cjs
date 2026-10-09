const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
function worker(navigator={}){
 const events={},shown=[],opened=[];
 const ctx=vm.createContext({URL,Promise,importScripts(){},DeckelDevice:{read:async()=>null},self:{navigator,
  registration:{scope:'https://ffw-wasser.github.io/home/',showNotification:async(title,options)=>shown.push({title,options})},
  clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)},addEventListener:(name,fn)=>events[name]=fn}});
 vm.runInContext(read('service-worker.js'),ctx);
 async function dispatch(name,extra={}){let pending;events[name]({...extra,waitUntil:value=>pending=value});await pending;}
 return {dispatch,shown,opened};
}
test('Neue Erinnerung zeigt 1; Tippen auf die Nachricht entfernt die Zahl und öffnet den Deckel',async()=>{
 const counts=[];let clears=0,closed=0;const f=worker({setAppBadge:async count=>counts.push(count),clearAppBadge:async()=>clears++});
 await f.dispatch('push');await f.dispatch('push');assert.deepEqual(counts,[1,1]);assert.equal(f.shown.length,2);
 assert.equal(f.shown[0].options.tag,'deckel-reminder');assert.ok(!JSON.stringify(f.shown).includes('balance'));
 await f.dispatch('notificationclick',{notification:{close:()=>closed++}});
 assert.equal(clears,1);assert.equal(closed,1);assert.deepEqual(f.opened,['https://ffw-wasser.github.io/home/deckel.html']);
});
test('Fehlende oder abgelehnte Badge-API verhindert weder Nachricht noch Öffnen',async()=>{
 for(const navigator of [{},{setAppBadge:async()=>{throw Error('blocked');},clearAppBadge:async()=>{throw Error('blocked');}}]){
  const f=worker(navigator);await f.dispatch('push');assert.equal(f.shown.length,1);
  await f.dispatch('notificationclick',{notification:{close(){}}});assert.equal(f.opened.length,1);
 }
});
function page({badgeFails=false,failedLoad=false,hidden=false}={}){
 const nodes=new Map(),closed=[],calls=[];let clears=0;
 const node=()=>({hidden:false,disabled:false,textContent:'',classList:{toggle(){}},replaceChildren(){},removeAttribute(){},append(){}});
 const url=new URL('https://ffw-wasser.github.io/home/deckel.html#r=ffw-wasser/deckel-daten&a='+ 'a'.repeat(32)+'&k='+ 'b'.repeat(64));
 const document={hidden,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,addEventListener(){}};
 const ctx=vm.createContext({console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Promise,location:{href:url.href,hash:url.hash},document,
  navigator:{clearAppBadge:async()=>{clears++;if(badgeFails)throw Error('blocked');},serviceWorker:{getRegistration:async()=>({getNotifications:async options=>{calls.push(options.tag);return [{close:()=>closed.push('deckel-reminder')}];}})}},
  DeckelDevice:{read:async()=>null},DeckelCrypto:{access(){},open:async()=>({balance:150,credit:0,needed:300,bonusCents:300,bookings:[],updatedAt:'2026-10-09T12:00:00Z'})},
  fetch:async()=>({ok:!failedLoad,text:async()=> '{}'}),addEventListener(){}});
 ctx.window=ctx;vm.runInContext(read('js/features/drinks/deckel-push.js'),ctx);
 return {ctx,nodes,closed,calls,get clears(){return clears;}};
}
test('Öffnen über das App-Symbol quittiert nur die Deckel-Erinnerung; verborgenes Fenster quittiert nichts',async()=>{
 const f=page();await f.ctx.DeckelPush.markRead();assert.equal(f.clears,1);assert.deepEqual(f.calls,['deckel-reminder']);assert.equal(f.closed.length,1);
 f.ctx.document.hidden=true;await f.ctx.DeckelPush.markRead();assert.equal(f.clears,1);assert.equal(f.closed.length,1);
 const blocked=page({badgeFails:true});await blocked.ctx.DeckelPush.markRead();assert.equal(blocked.closed.length,1);
});
test('Badge wird erst nach erfolgreichem Laden eines sichtbaren Deckels entfernt',async()=>{
 for(const options of [{},{failedLoad:true},{hidden:true}]){
  const f=page(options);vm.runInContext(read('js/features/drinks/deckel-view.js'),f.ctx);
  for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.clears,options.failedLoad||options.hidden?0:1);
  assert.equal(f.closed.length,options.failedLoad||options.hidden?0:1);
 }
});
