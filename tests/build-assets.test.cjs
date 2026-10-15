const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
test('Worker-Bundle entspricht sämtlichen Quellen und bewahrt Kalenderfunktionen beim Neubau',()=>{
 const paths=JSON.parse(read('cloudflare/push/build.cjs').match(/const sources=(\[[^;]+\]);/)[1].replace(/'/g,'"'));assert.equal(read('cloudflare/push/worker.bundle.js'),paths.map(read).join('\n'));
});
test('Öffentliche HTML-, CSS-, Manifest- und Dokumentverweise zeigen auf vorhandene lokale Dateien',()=>{
 const problems=[];let checked=0;
 function walk(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=path.posix.join(dir,entry.name);if(entry.isDirectory()){if(!entry.name.startsWith('.')&&!['tests','js','scripts'].includes(entry.name))walk(file);continue;}const ext=path.extname(file),s=read(file);let refs=[];if(ext==='.html')refs=[...s.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]);else if(ext==='.css')refs=[...s.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)].map(m=>m[1]);else if(ext==='.md')refs=[...s.matchAll(/\]\(([^\s)]+)\)/g)].map(m=>m[1]);else if(ext==='.webmanifest')refs=JSON.parse(s).icons.map(i=>i.src);for(const ref of refs){if(/^(?:[a-z]+:|\/\/|#|\/)/i.test(ref)||ref.includes('${'))continue;const target=decodeURIComponent(ref.split(/[?#]/)[0]);if(!target)continue;checked++;if(!fs.existsSync(path.resolve(root,path.dirname(file),target)))problems.push(file+' -> '+ref);}}}walk('');assert.deepEqual(problems,[]);assert.ok(checked>100);
});
