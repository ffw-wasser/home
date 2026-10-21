// Produces the single file used by the dashboard and Wrangler. No dependencies.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sources=['js/vendor/ical.js','js/features/portal/calendar-model.js','js/features/drinks/drinks-model.js','js/features/drinks/deckel-crypto.js','js/features/drinks/deckel-commands.js','js/features/drinks/drinks-ledger-shared.js','js/features/drinks/drinks-quiz-model.js','cloudflare/push/central.js','cloudflare/push/challenge.js','js/features/portal/member-evidence.js','js/features/theater/theater-model.js','cloudflare/push/theater.js','cloudflare/push/portal.js','cloudflare/push/worker.js'];
const source=sources.map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const fingerprint=require('node:crypto').createHash('sha256').update(source).digest('hex');
fs.writeFileSync(path.join(__dirname,'worker.bundle.js'),source.replace('__WORKER_SOURCE_SHA256__',fingerprint));
