// Copy the pinned browser-only PDF renderer. Document bytes never enter this build.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),pkg=require('../node_modules/pdfjs-dist/package.json'),target=path.join(root,'js/vendor/pdfjs');
fs.mkdirSync(target,{recursive:true});
for(const [source,name] of [['build/pdf.min.mjs',`pdf-${pkg.version}.min.mjs`],['build/pdf.worker.min.mjs',`pdf.worker-${pkg.version}.min.mjs`],['LICENSE','LICENSE']])fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist',source),path.join(target,name));
