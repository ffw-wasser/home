// Produces the single file used by the dashboard and Wrangler. No dependencies.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sources=['js/features/drinks/drinks-model.js','js/features/drinks/deckel-crypto.js','js/features/drinks/deckel-commands.js','js/features/drinks/drinks-ledger-shared.js','cloudflare/push/central.js','cloudflare/push/worker.js'];
fs.writeFileSync(path.join(__dirname,'worker.bundle.js'),sources.map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n'));
