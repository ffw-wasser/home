// Derive the isolated review screen from the actual member UI, never a second UI implementation.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'deckel.html'),'utf8');
html=html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]+">/,`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' blob:; font-src 'self' blob:; frame-src blob:; worker-src 'self' blob:; base-uri 'none'; form-action 'none'">`);
// No update, install, production IndexedDB or service worker lifecycle in the demo.
html=html.replace(/<script[^>]+src="(?:js\/core\/app-release|js\/features\/drinks\/(?:deckel-manifest|deckel-install|push-device))\.js[^>]*><\/script>/g,'');
html=html.replace(/<script[^>]+src="js\/features\/portal\/portal-onboarding\.js[^>]*><\/script>/g,'');
html=html.replace('<title>','<script src="native/review/portal-demo.js"></script><link rel="stylesheet" href="native/review/portal-demo.css"><title>Demo · ');
html=html.replace(/(<body[^>]*>)/,'$1<aside id="review-banner" role="note"><strong>Apple-Prüfdemo · nur erfundene Daten</strong><button id="review-reset" type="button">Demo zurücksetzen</button></aside>');
html=html.replace(/<script src="js\/features\/drinks\/deckel-view\.js[^>]*><\/script>/,'<script src="native/review/device-memory.js" defer></script>$&');
const target=path.join(root,'review.html');
if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==html)throw Error('Review portal differs from actual member UI. Run node scripts/build-review-portal.cjs.');}else fs.writeFileSync(target,html);
