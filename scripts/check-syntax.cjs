// Validate every application, worker, test and maintenance script without executing it.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=['service-worker.js'];
function collect(folder){for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){const name=path.join(folder,entry.name);if(entry.isDirectory())collect(name);else if(/\.(?:c|m)?js$/.test(name))files.push(name);}}
for(const folder of ['js','cloudflare','scripts','tests'])collect(folder);
let failed=0;
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});if(result.status!==0){failed++;process.stderr.write(file+'\n'+(result.stderr||String(result.error||'Syntaxprüfung fehlgeschlagen')));}}
console.log(files.length+' JavaScript-Dateien geprüft, '+failed+' Fehler.');
if(failed)process.exitCode=1;
