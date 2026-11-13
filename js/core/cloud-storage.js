/* Authenticated Cloudflare storage. Legacy item URLs are local identifiers, never HTTP requests. */
(function(g){
 'use strict';
 const ORIGIN='https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev',KEY='fw_cloud_device_v1',utf=new TextEncoder(),decoder=new TextDecoder();
 let session=null,verified=false,legacy=[],booting=null,renewing=null;const paths=new Map();
 const fail=(message,status=409)=>Object.assign(Error(message),{status});
 const b64=bytes=>btoa(Array.from(bytes,x=>String.fromCharCode(x)).join('')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const token=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
 async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?utf.encode(value):value)),x=>x.toString(16).padStart(2,'0')).join('');}
 function valid(value){return value&&value.origin===ORIGIN&&/^[A-Za-z0-9_-]{43}$/.test(value.token||'')&&/^[a-f0-9]{64}$/.test(value.run||'')&&/^[a-f0-9]{64}$/.test(value.sourceHash||'')&&typeof value.source==='string'&&value.source.length<=500&&value.source.includes(':')&&typeof value.deviceId==='string';}
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(valid(saved))session=saved;}catch{}
 function store(value){if(!valid(value))throw fail('Ungültiger Gerätezugang.',401);session=value;localStorage.setItem(KEY,JSON.stringify(value));}
 async function call(path,data={},options={}){
  if(!/^\/(?:admin\/|storage\/|storage-state\/)/.test(path))throw fail('Ungültiger Dienstpfad.',400);
  const auth=options.token??session?.token;if(!auth&&path!=='/storage/claim')throw fail('Bitte dieses Verwaltungsgerät verbinden.',401);
  const headers={Authorization:'Bearer '+(auth||''),'Content-Type':options.bytes===undefined?'application/json':'application/octet-stream'};
  const metadata=JSON.stringify(data);let body=metadata;
  if(options.bytes!==undefined){const header=utf.encode(metadata+'\n'),bytes=new Uint8Array(options.bytes);body=new Uint8Array(header.length+bytes.length);body.set(header);body.set(bytes,header.length);}
  const response=await fetch(ORIGIN+path,{method:'POST',headers,body,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
  if(!response.ok){let error;try{error=await response.json();}catch{}if(response.status===401&&auth===session?.token){verified=false;g.dispatchEvent?.(new Event('h2o-storage-lock'));}throw fail(error?.error||'Cloudflare hat den Vorgang nicht bestätigt (HTTP '+response.status+').',response.status);}
  return options.binary?new Uint8Array(await response.arrayBuffer()):await response.json();
 }
 function scoped(data={}){if(!session)throw fail('Gerät nicht verbunden.',401);return {source:session.sourceHash,run:session.run,...data};}
 async function claim(value){
  let ticket=String(value||'').trim();if(ticket.startsWith('https://')){let url;try{url=new URL(ticket);}catch{throw fail('Ungültiger Kopplungscode.',400);}if(url.origin!=='https://ffw-wasser.github.io'||url.pathname!=='/home/index.html')throw fail('Ungültiger Kopplungscode.',400);ticket=new URLSearchParams(url.hash.slice(1)).get('pair')||'';}
  if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw fail('Ungültiger Kopplungscode.',400);
  const pendingKey='fw_cloud_pair_pending';let old;try{old=JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch{}
  const pending=old?.ticket===ticket&&/^[A-Za-z0-9_-]{43}$/.test(old.token||'')?old:{ticket,deviceId:crypto.randomUUID(),token:token(),label:'Verwaltungsgerät · '+(navigator.platform||'Browser')};sessionStorage.setItem(pendingKey,JSON.stringify(pending));const result=await call('/storage/claim',pending,{token:''});store({origin:ORIGIN,...result,token:pending.token});sessionStorage.removeItem(pendingKey);return true;
 }
 async function bootstrap(){
  if(booting)return booting;
  booting=(async()=>{
   const fragment=new URLSearchParams(location.hash.slice(1)),encoded=fragment.get('cloudDevice'),ticket=fragment.get('pair');
   if(encoded||ticket){fragment.delete('cloudDevice');fragment.delete('pair');history.replaceState(null,'',location.pathname+location.search+(fragment.toString()?'#'+fragment:''));}
   if(encoded){let value;try{value=JSON.parse(decoder.decode(Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));}catch{throw fail('Der Gerätezugang konnte nicht gelesen werden.',401);}if(!valid(value))throw fail('Ungültiger Gerätezugang.',401);session=value;}
   if(ticket)await claim(ticket);
   if(!session)return false;
   const value=await call('/storage/config');store({origin:ORIGIN,...value,token:session.token});verified=true;await ensureFresh();return true;
  })().finally(()=>{booting=null;});return booting;
 }
 async function ensureFresh(){if(!session||!verified)return false;if(session.permanent||session.expiresAt-Date.now()>=7*86400000)return true;if(!renewing)renewing=call('/storage/renew').then(value=>store({origin:ORIGIN,...value,token:session.token})).finally(()=>{renewing=null;});await renewing;return true;}
 function root(){if(!session)throw fail('Gerät nicht verbunden.',401);const index=session.source.indexOf(':');return {driveId:session.source.slice(0,index),id:session.source.slice(index+1),name:'Webseite'};}
 async function adminRequest(path,data={}){if(!verified)throw fail('Gerät nicht verbunden.',401);return call(path,{source:session.source,...data});}
 async function readState(){const result=await call('/storage-state/read',scoped());legacy=Array.isArray(result.value.legacyArchive)?result.value.legacyArchive:Array.isArray(result.value.csvArchive)?result.value.csvArchive:[];return result;}
 async function writeState(value,expectedVersion,operationId=crypto.randomUUID()){const data={...value,schemaVersion:4,legacyArchive:Array.isArray(value.legacyArchive)?value.legacyArchive:legacy};delete data.csvArchive;const result=await call('/storage-state/write',scoped({value:data,expectedVersion,operationId}));legacy=data.legacyArchive;return result;}
 const remember=value=>{if(value?.id&&typeof value.path==='string')paths.set(value.id,value.path);return value;};
 async function stat(pathOrId,{id=false}={}){return remember(await call('/admin/storage-files/stat',scoped(id?{id:pathOrId}:{path:pathOrId})));}
 async function list(path=''){const result=await call('/admin/storage-files/list',scoped({path}));result.items.forEach(remember);return result.items;}
 const readFile=(path,version)=>call('/admin/storage-files/read',scoped({path,...(version===undefined?{}:{version})}),{binary:true});
 const writeFile=(path,bytes,expectedVersion,operationId=crypto.randomUUID())=>call('/admin/storage-files/write',scoped({path,expectedVersion,operationId}),{bytes});
 const mkdir=(path,expectedVersion=0)=>call('/admin/storage-files/mkdir',scoped({path,expectedVersion,operationId:crypto.randomUUID()}));
 const remove=(path,expectedVersion)=>call('/admin/storage-files/delete',scoped({path,expectedVersion,operationId:crypto.randomUUID()}));
 async function ensureFolder(path){let parent='';for(const part of path.split('/').filter(Boolean)){parent=parent?parent+'/'+part:part;try{const found=await stat(parent);if(found.kind!=='folder')throw fail('Der Speicherpfad ist kein Ordner.');}catch(error){if(error.status!==404)throw error;try{await mkdir(parent);}catch(race){if(race.status!==409)throw race;const found=await stat(parent);if(found.kind!=='folder')throw race;}}}return stat(path);}
 async function walk(path='Berichte',depth=0){if(depth>32)throw fail('Die Ordnerstruktur ist zu tief.');let children;try{children=await list(path);}catch(error){if(error.status===404)return [];throw error;}const files=[];for(const child of children){if(child.kind==='folder')files.push(...await walk(child.path,depth+1));else files.push(child);}return files;}
 async function pathFor(id){if(id===root().id)return '';if(id==='h2o-state')return 'feuerwehr-wasser-daten.json';if(paths.has(id))return paths.get(id);return (await stat(id,{id:true})).path;}
 const item=value=>({id:value.id,name:value.name,size:value.size||0,lastModifiedDateTime:value.modifiedAt,eTag:'"f-'+value.version+'"',...(value.kind==='folder'?{folder:{}}:{file:{}})});
 const version=tag=>{const match=/^"?(?:[sfc]-)?(\d+)"?$/.exec(tag||'');if(!match)throw fail('Die Dateiversion fehlt oder ist ungültig.',412);return Number(match[1]);};
 function control(path){if(path==='Getraenke/push-verbindung.json')return {version:1,origin:ORIGIN,token:session.token};if(path==='Getraenke/konten-zentrale.json')return {version:1,source:session.source,state:'active'};return null;}
 async function graphFetch(address,options={}){
  const url=new URL(address),match=/^\/([^/]+)\/items\/([^/:]+)(.*)$/.exec(url.pathname);
  if(url.protocol!=='h2o-storage:'||url.hostname!=='drives'||!match||decodeURIComponent(match[1])!==root().driveId)throw fail('Ungültiger Speicherzugriff.',400);
  let path=await pathFor(decodeURIComponent(match[2])),suffix=match[3];
  if(suffix.startsWith(':/')){const end=suffix.lastIndexOf(':/');const relative=end>1?suffix.slice(2,end):suffix.slice(2).replace(/:$/,'');path=[path,relative.split('/').map(decodeURIComponent).join('/')].filter(Boolean).join('/');suffix=end>1?suffix.slice(end+1):'';}
  const method=String(options.method||'GET').toUpperCase(),headers=new Headers(options.headers||{}),isState=path==='feuerwehr-wasser-daten.json',special=control(path),json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  if(method==='GET'){
   if(suffix==='/children')return json({value:(await list(path)).map(item)});
   if(!path)return json({...root(),folder:{}});
   if(isState){const state=await readState();return suffix==='/content'?json(state.value):json({id:'h2o-state',name:path,file:{},eTag:'"s-'+state.version+'"'});}
   if(special){const id='h2o-control-'+(path.includes('push-')?'push':'central');paths.set(id,path);return suffix==='/content'?json(special):json({id,name:path.split('/').pop(),file:{},eTag:'"c-1"'});}
   const metadata=await stat(path);if(headers.has('If-Match')&&version(headers.get('If-Match'))!==metadata.version)throw fail('Die Datei wurde gleichzeitig geändert.',412);
   return suffix==='/content'?new Response(await readFile(path,metadata.version),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, no-store'}}):json(item(metadata));
  }
  if(method==='POST'&&suffix==='/children'){const data=JSON.parse(options.body);if(!data.folder||typeof data.name!=='string'||/[\\/]/.test(data.name))throw fail('Ungültiger Ordner.',400);const child=[path,data.name].filter(Boolean).join('/');await mkdir(child);return json(item(await stat(child)));}
  if(method==='PUT'&&suffix==='/content'){
   if(special){if(path==='Getraenke/konten-zentrale.json'){const data=JSON.parse(options.body);if(data.source===session.source&&data.state==='active')return json({id:'h2o-control-central',eTag:'"c-1"'});}throw fail('Verbindungen werden über die Geräteverwaltung eingerichtet.',403);}
   let expected;if(headers.has('If-Match'))expected=version(headers.get('If-Match'));else{try{expected=(await stat(path)).version;}catch(error){if(error.status!==404)throw error;expected=0;}}
   if(isState){await writeState(JSON.parse(options.body),expected);return json({id:'h2o-state'});}
   const bytes=typeof options.body==='string'?utf.encode(options.body):options.body?.arrayBuffer?new Uint8Array(await options.body.arrayBuffer()):new Uint8Array(options.body);
   await writeFile(path,bytes,expected);return json(item(await stat(path)));
  }
  if(method==='DELETE'){const metadata=await stat(path),expected=headers.has('If-Match')?version(headers.get('If-Match')):metadata.version;await remove(path,expected);return new Response(null,{status:204});}
  throw fail('Dieser Speicherzugriff wird nicht unterstützt.',405);
 }
 async function enrollFolder(files,label){
  // Folder selection exposes local file handles; read only the two known
  // connection files. Never read or upload the remaining file contents.
  const selected=[...files].filter(file=>{const parts=String(file.webkitRelativePath||'').split('/'),relative=parts.slice(1).join('/');return ['Getraenke/push-verbindung.json','Getraenke/konten-zentrale.json'].includes(relative)||(parts[0]==='Getraenke'&&['push-verbindung.json','konten-zentrale.json'].includes(relative));});
  if(selected.length!==2||new Set(selected.map(file=>file.name)).size!==2)throw fail('Bitte den gemeinsamen Ordner Webseite auswählen. Darin müssen die Verbindungsdateien unter Getraenke liegen.',400);
  return enrollFiles(selected,label);
 }
 async function enrollFiles(files,label){
  const selected=[...files],entries=new Map(selected.map(file=>[file.name,file]));if(selected.length!==2||entries.size!==2||!entries.has('push-verbindung.json')||!entries.has('konten-zentrale.json'))throw fail('Bitte push-verbindung.json und konten-zentrale.json gemeinsam auswählen.',400);
  let connection,central;try{connection=JSON.parse(await entries.get('push-verbindung.json').text());central=JSON.parse(await entries.get('konten-zentrale.json').text());}catch{throw fail('Die Verbindungsdateien konnten nicht gelesen werden. Bitte OneDrive vollständig herunterladen lassen und erneut auswählen.',400);}
  if(connection.origin!==ORIGIN||!/^[a-f0-9]{64}$/.test(connection.token||'')||typeof central.source!=='string')throw fail('Die Verbindungsdateien sind nicht gültig.',400);
  const status=await call('/admin/storage-runtime/status',{}, {token:connection.token});if(!status.active||await digest(central.source)!==status.source)throw fail('Die produktive Datenübernahme ist noch nicht abgeschlossen.');
  const record={source:status.source,run:status.run,deviceId:crypto.randomUUID(),token:token(),label:label||'Verwaltungsgerät',expiresAt:status.serverTime?status.serverTime+30*86400000:Date.now()+29*86400000,access:'application-admin'};
  await call('/admin/storage-state/pair',record,{token:connection.token});session={origin:ORIGIN,run:status.run,source:central.source,sourceHash:status.source,deviceId:record.deviceId,token:record.token,expiresAt:record.expiresAt};await bootstrap();
 }
 async function logout(){try{if(session)await call('/storage/logout');}finally{verified=false;session=null;legacy=[];localStorage.removeItem(KEY);paths.clear();g.dispatchEvent?.(new Event('h2o-storage-lock'));}}
 async function pairDialog(){
  if(typeof requireAdmin==='function'&&!requireAdmin('settingsPushView'))return;
  const clock=await call('/storage/config'),ticket=token(),expiresAt=(clock.serverTime||Date.now())+5*60000;await adminRequest('/admin/storage-runtime/pairing',{ticket,expiresAt});
  let dialog=document.getElementById('cloudPairDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='cloudPairDialog';dialog.className='cloud-sync-dialog';dialog.innerHTML='<div class="cloud-sync-shell"><header><h2>Verwaltungsgerät koppeln</h2><button type="button" aria-label="Schließen">×</button></header><div class="cloud-sync-body"><p>Für das Gerätehaus und berechtigte Verwaltungsgeräte. Der Code ist einmalig und fünf Minuten gültig.</p><div id="cloudPairQR"></div><button id="cloudPairCopy" type="button" class="outline-button">Kopplungslink kopieren</button><p>Mit der Kamera des neuen Geräts scannen. Persönliche Mitgliederzugänge werden weiterhin unter H₂O Portal eingerichtet.</p></div></div>';dialog.querySelector('button').onclick=()=>dialog.close();document.body.append(dialog);}
  const link='https://ffw-wasser.github.io/home/index.html#pair='+ticket,qr=qrcode(0,'M');qr.addData(link);qr.make();const canvas=document.createElement('canvas'),unit=5,quiet=4,count=qr.getModuleCount();canvas.width=canvas.height=(count+quiet*2)*unit;canvas.style.maxWidth='100%';canvas.setAttribute('aria-label','Einmaliger Kopplungscode für ein Verwaltungsgerät');const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))ctx.fillRect((x+quiet)*unit,(y+quiet)*unit,unit,unit);document.getElementById('cloudPairQR').replaceChildren(canvas);document.getElementById('cloudPairCopy').onclick=async()=>{try{await navigator.clipboard.writeText(link);document.getElementById('cloudPairCopy').textContent='Kopplungslink kopiert';}catch{let input=dialog.querySelector('[data-pair-fallback]');if(!input){input=document.createElement('input');input.dataset.pairFallback='';input.className='text-input';input.readOnly=true;document.getElementById('cloudPairCopy').after(input);}input.value=link;input.select();document.getElementById('cloudPairCopy').textContent='Markierten Link kopieren';}};document.getElementById('cloudPairCopy').textContent='Kopplungslink kopieren';dialog.querySelector('[data-pair-fallback]')?.remove();dialog.showModal();
 }
 g.CloudStorage={bootstrap,claim,ensureFresh,call,adminRequest,readState,writeState,root,stat,list,readFile,writeFile,ensureFolder,walk,graphFetch,enrollFiles,enrollFolder,logout,pairDialog,digest,get connected(){return verified&&Boolean(session)&&session.expiresAt>Date.now();},get source(){return session?.source||'';},get sourceHash(){return session?.sourceHash||'';},get deviceId(){return session?.deviceId||'';},get expiresAt(){return session?.expiresAt||0;},get legacyArchive(){return legacy;},config(){if(!session)throw fail('Gerät nicht verbunden.',401);return {version:1,origin:ORIGIN,token:session.token,source:session.source,run:session.run,sourceHash:session.sourceHash,deviceId:session.deviceId,expiresAt:session.expiresAt,permanent:session.permanent===true};}};
})(globalThis);
