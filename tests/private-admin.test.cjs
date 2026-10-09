const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(require.resolve('../'+p),'utf8');
function storage(values={}){const m=new Map(Object.entries(values));return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('Auch entsperrte Verwaltung benötigt bestätigtes OneDrive; Einrichtung bleibt erreichbar',()=>{
 const c=vm.createContext({adminUnlocked:true,oneDriveAdministrationReady:()=>false,resetAdminTimeout(){},window:{}});vm.runInContext(read('js/core/ui.js'),c);c.showToast=()=>{};
 assert.equal(c.requireAdmin('settingsMembersView'),false);assert.equal(c.requireAdmin('settingsView',{allowDisconnected:true}),true);
 c.oneDriveAdministrationReady=()=>true;assert.equal(c.requireAdmin('settingsMembersView'),true);
});
test('Verspätete Graph-Antwort wird nach Abmelden verworfen',async()=>{
 let release;const localStorage=storage({fw_onedrive_tokens:JSON.stringify({access_token:'test',obtained_at:Date.now(),expires_in:3600})});
 const c=vm.createContext({localStorage,sessionStorage:storage(),window:{},navigator:{onLine:true},Headers,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:()=>new Promise(resolve=>release=resolve)});vm.runInContext(read('js/core/onedrive-sync.js'),c);
 vm.runInContext('oneDriveAccessConfirmed=true',c);assert.equal(c.oneDriveAdministrationReady(),true);
 const pending=c.odFetch('https://graph.microsoft.com/v1.0/test');await new Promise(resolve=>setImmediate(resolve));c.endOneDriveSession();release(new Response('{}'));
 await assert.rejects(pending,/Anmeldung wurde beendet/);assert.equal(c.oneDriveAdministrationReady(),false);assert.equal(localStorage.getItem('fw_onedrive_tokens'),null);
});
function privacy(accepted=true){
 const local=storage({fw_v5_members:'private',fw_v1_safety_snapshots:'private',fw_v1_operation_draft_1:'private',fw_v6_password:'password',fw_onedrive_client_id:'client',fw_onedrive_shared_folder_url:'folder'}),session=storage({fw_private:'private'}),deleted=[];let ended=0,reloaded=0;
 const nodes=new Map([['privacyCleanupStatus',{}],['privacyCleanupRetry',{}]]);const main={hidden:false};
 const c=vm.createContext({window:{},members:[{id:'private'}],entries:[{id:'private'}],csvArchive:[{}],adminUnlocked:true,pendingSettingsTarget:'private',chosenMemberId:'private',chosenMemberIds:new Set(['private']),oneDriveLocalRevision:2,oneDriveSyncedRevision:1,confirm:()=>accepted,endOneDriveSession:()=>ended++,safeStorage:local,localStorage:local,sessionStorage:session,setTimeout,clearTimeout,location:{reload:()=>reloaded++},byId:id=>nodes.get(id),document:{readyState:'complete',querySelector:()=>main,querySelectorAll:()=>[],body:{append:node=>nodes.set(node.id,node)},createElement:()=>({setAttribute(){}})},indexedDB:{deleteDatabase:name=>{deleted.push(name);const req={};queueMicrotask(()=>req.onsuccess());return req;}}});vm.runInContext(read('js/core/privacy.js'),c);return {c,local,session,deleted,main,get ended(){return ended},get reloaded(){return reloaded}};
}
test('Abmelden entfernt personenbezogenen Speicher und Berichte, erhält Einrichtung und Passwort',async()=>{
 const f=privacy();assert.equal(await f.c.window.AppPrivacy.logout(),true);
 for(const k of ['fw_v5_members','fw_v1_safety_snapshots','fw_v1_operation_draft_1'])assert.equal(f.local.getItem(k),null);
 assert.equal(f.session.length,0);assert.equal(f.local.getItem('fw_v6_password'),'password');assert.equal(f.local.getItem('fw_onedrive_client_id'),'client');assert.equal(f.local.getItem('fw_onedrive_shared_folder_url'),'folder');
 assert.equal(f.c.members.length,0);assert.equal(f.c.entries.length,0);assert.equal(f.c.adminUnlocked,false);assert.equal(f.deleted.length,4);assert.equal(f.ended,1);assert.equal(f.reloaded,1);assert.equal(f.main.hidden,true);
});
test('Abbrechen bewahrt ungespeicherte Daten und Anmeldung',async()=>{const f=privacy(false);assert.equal(await f.c.window.AppPrivacy.logout(),false);assert.equal(f.c.members.length,1);assert.equal(f.ended,0);assert.equal(f.deleted.length,0);});
