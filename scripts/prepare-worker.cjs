// Runs from the repository root or Cloudflare's cloudflare/push build directory.
// A failed check exits nonzero so Workers Builds never reaches its deploy step.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(args){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
if(Number(process.versions.node.split('.')[0])<24)throw Error('Für die Worker-Prüfung wird Node.js 24 oder neuer benötigt.');
const install=spawnSync('npm',['ci','--ignore-scripts'],{cwd:root,stdio:'inherit'});if(install.status!==0)process.exit(install.status||1);
run(['cloudflare/push/build.cjs']);
run(['--check','cloudflare/push/worker.bundle.js']);
const tests=fs.readdirSync(path.join(root,'tests')).filter(file=>file.endsWith('.test.cjs')).sort().map(file=>path.join('tests',file));
if(!tests.length)throw Error('Keine Tests gefunden. Veröffentlichung abgebrochen.');
run(['--test',...tests]);
console.log('Worker erstellt und alle Prüfungen erfolgreich. Bereit zur Veröffentlichung.');
