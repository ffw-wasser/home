// Deterministic, pinned WebAuthn dependency bundles plus existing global-scope modules.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sources=['js/vendor/ical.js','js/features/portal/regulations-model.js','js/features/portal/calendar-presentation.js','js/features/portal/calendar-model.js','js/features/drinks/drinks-model.js','js/features/drinks/deckel-crypto.js','js/features/drinks/deckel-commands.js','js/features/drinks/drinks-ledger-shared.js','js/features/drinks/drinks-quiz-model.js','cloudflare/push/central.js','cloudflare/push/challenge.js','js/features/portal/member-evidence.js','js/features/theater/theater-model.js','cloudflare/push/theater.js','cloudflare/push/passkeys.js','cloudflare/push/evidence.js','cloudflare/push/hydrants.js','cloudflare/push/google-calendar-colors.js','cloudflare/push/google-calendar-api.js','cloudflare/push/google-calendar-oauth.js','cloudflare/push/calendar-invitations.js','cloudflare/push/calendar-subscriptions.js','cloudflare/push/portal.js','cloudflare/push/worker.js'];
function build(){
const esbuild=require('esbuild');
const notices=fs.readFileSync(path.join(root,'docs/PASSKEY-THIRD-PARTY-LICENSES.txt'),'utf8').replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'');
const banner='/*!\n'+notices.replace(/\*\//g,'* /')+'\n*/\n';
const bundled=esbuild.buildSync({stdin:{contents:'export { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";',resolveDir:root},absWorkingDir:root,bundle:true,write:false,format:'iife',globalName:'WebAuthnServer',platform:'browser',target:'es2022',legalComments:'inline'}).outputFiles[0].text.replace(/[ \t]+$/gm,'');
const browser=esbuild.buildSync({stdin:{contents:'export { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";',resolveDir:root},absWorkingDir:root,bundle:true,write:false,format:'iife',globalName:'H2OPasskeys',platform:'browser',target:'es2022',legalComments:'inline'}).outputFiles[0].text.replace(/[ \t]+$/gm,'');

const source=banner+bundled+'\n'+sources.map(p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n')).join('\n');
const fingerprint=require('node:crypto').createHash('sha256').update(source).digest('hex');
return {worker:source.replace('__WORKER_SOURCE_SHA256__',fingerprint),browser:banner+browser};
}
module.exports={build};
if(require.main===module){const result=build();fs.writeFileSync(path.join(__dirname,'worker.bundle.js'),result.worker);fs.writeFileSync(path.join(root,'js/vendor/passkeys-browser.js'),result.browser);}
