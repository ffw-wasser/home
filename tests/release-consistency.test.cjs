const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('Release, geladene Dateien und Offline-Cache gehören zum selben Build',()=>{
 const release=JSON.parse(read('app-release.json'));
 const index=read('index.html');
 assert.ok(index.includes('name="app-version" content="'+release.version+'"'));
 assert.ok(index.includes('name="ffw-build" content="'+release.build+'"'));
 const context=vm.createContext({importScripts(){},self:{addEventListener(){}}});
 vm.runInContext(read('service-worker.js'),context);
 assert.equal(vm.runInContext('CACHE_NAME',context),'ffw-wasser-'+release.build);
 const core=Array.from(vm.runInContext('CORE',context));
 for(const name of ['index.html','deckel.html']){
  for(const match of read(name).matchAll(/(?:src|href)="([^"\s]+\?v=([^"\s]+))"/g)){
   assert.equal(match[2],release.build,match[1]);
   assert.ok(core.includes('./'+match[1]),'Datei fehlt im Offline-Cache: '+match[1]);
   assert.ok(fs.existsSync(path.join(root,match[1].split('?')[0])),match[1]);
  }
 }
 for(const entry of core.filter(x=>x.includes('?v=')))assert.ok(entry.endsWith('?v='+release.build),entry);
});
