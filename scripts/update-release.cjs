// app-release.json ist die gemeinsame Quelle für Anzeige und Cache-Version.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));
if(!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.version)||!/^\d{8}\.\d+$/.test(release.build))throw Error('Ungültige Release-Version');
for(const name of ['index.html','deckel.html','service-worker.js']){
 const file=path.join(root,name);
 let source=fs.readFileSync(file,'utf8').replace(/\?v=[A-Za-z0-9._-]+/g,'?v='+release.build);
 if(name==='service-worker.js')source=source.replace(/const CACHE_NAME="[^"]+";/,'const CACHE_NAME="ffw-wasser-'+release.build+'";');
 if(name==='index.html'){
  source=source.replace(/<meta name="app-version" content="[^"]+">/,'<meta name="app-version" content="'+release.version+'">');
  source=source.replace(/<meta name="ffw-build" content="[^"]+"\/?\s*>/,'<meta name="ffw-build" content="'+release.build+'"/>');
  source=source.replace(/<footer class="app-footer">[^<]+<\/footer>/,'<footer class="app-footer">© 2026 Feuerwehr Wasser · Version '+release.version+'</footer>');
 }
 fs.writeFileSync(file,source);
}
