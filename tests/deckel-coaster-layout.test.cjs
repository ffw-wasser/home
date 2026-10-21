const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
const html=read('deckel.html'),css=read('css/features/deckel.css'),portalCss=read('css/features/portal.css'),view=read('js/features/drinks/deckel-view.js');
const start=html.indexOf('<article id="coaster"'),end=html.indexOf('</article>',start);
const face=html.slice(start,end);
test('Flacher Bierdeckel und Betrag stehen getrennt; Hilfetexte bleiben außerhalb',()=>{
 assert.ok(start>=0&&end>start,'Bierdeckel gefunden');
 assert.doesNotMatch(face,/id="(?:balance|balanceLabel)"/);
 assert.match(html.slice(end),/<div class="deckel-balance-info"><p id="balanceLabel">Offen<\/p><strong id="balance"><\/strong>/);
 assert.match(css,/aspect-ratio:1\.85;min-height:0/);
 assert.doesNotMatch(css,/min-height:(?:230|205)px/);
 for(const id of ['updated','thanks','deckel-quote'])assert.doesNotMatch(face,new RegExp('id="'+id+'"'),'kein '+id+' auf dem Deckel');
 assert.match(face,/FEUERWEHR WASSER/);
 assert.match(face,/preserveAspectRatio="none"/);
 for(const id of ['updated','thanks','deckel-quote','deckel-tap-hint'])assert.match(html.slice(end),new RegExp('id="'+id+'"'));
 assert.match(view,/data\.balance===0\?'Bezahlt':'Offen'/);
});
test('Sprüche bleiben unterhalb des Deckels, Betrag bleibt beim Antippen sichtbar',()=>{
 assert.match(html.slice(end),/<p id="deckel-quote"/);
 assert.doesNotMatch(view,/for\(const id of \['balance','balanceLabel','updated'\]\)\$\(id\)\.hidden=true/);
 assert.match(view,/\$\('coaster'\)\.setAttribute\?\.\('aria-describedby','updated deckel-tap-hint deckel-quote'\)/);
});
test('Portalnavigation bleibt erreichbar und erweitert sich bei verschobenen Kacheln horizontal',()=>{
 const nav=html.slice(html.indexOf('<nav id="deckel-nav"'),html.indexOf('</nav>',html.indexOf('<nav id="deckel-nav"')));
 assert.equal((nav.match(/data-deckel-target=/g)||[]).length,5);
 assert.match(nav,/data-deckel-target="account" aria-label="Mein Deckel"/);
 assert.match(nav,/aria-label="Mein Deckel"><span class="portal-nav-symbol" aria-hidden="true">◉<\/span><strong>Deckel<\/strong>/);
 assert.match(nav,/data-portal-pinned="more"/);
 assert.match(portalCss,/\.deckel-nav\{[^}]*overflow-x:auto/);
 const match=portalCss.match(/\.deckel-nav button\{([^}]+)\}/);
 assert.ok(match,'Kachelformatierung');
 assert.match(match[1],/white-space:normal/);
 assert.match(match[1],/overflow-wrap:anywhere/);
 assert.match(match[1],/min-width:68px/);
 assert.doesNotMatch(match[1],/white-space:nowrap/);
});
test('Navigations-IDs bleiben eindeutig und JS syntaktisch gültig',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 assert.doesNotThrow(()=>new (require('node:vm').Script)(view));
});
