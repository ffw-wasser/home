const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
const html=read('deckel.html'),css=read('css/features/deckel.css'),portalCss=read('css/features/portal.css'),view=read('js/features/drinks/deckel-view.js');
const start=html.indexOf('<article id="coaster"'),end=html.indexOf('</article>',start);
const face=html.slice(start,end);
test('Bierdeckel zeigt nur Status und Geldbetrag; Hilfetexte stehen außerhalb',()=>{
 assert.ok(start>=0&&end>start,'Bierdeckel gefunden');
 assert.match(face,/<p id="balanceLabel">Offen<\/p>/);
 assert.match(face,/<strong id="balance"><\/strong>/);
 for(const id of ['updated','thanks','deckel-quote'])assert.doesNotMatch(face,new RegExp('id="'+id+'"'),'kein '+id+' auf dem Deckel');
 assert.doesNotMatch(face,/deckel-brand|Feuerwehr Wasser/);
 for(const id of ['updated','thanks','deckel-quote','deckel-tap-hint'])assert.match(html.slice(end),new RegExp('id="'+id+'"'));
 assert.match(view,/data\.balance===0\?'Bezahlt':'Offen'/);
});
test('Sprüche bleiben unterhalb des Deckels, Betrag bleibt beim Antippen sichtbar',()=>{
 assert.match(html.slice(end),/<p id="deckel-quote"/);
 assert.doesNotMatch(view,/for\(const id of \['balance','balanceLabel','updated'\]\)\$\(id\)\.hidden=true/);
 assert.match(view,/\$\('coaster'\)\.setAttribute\?\.\('aria-describedby','updated deckel-tap-hint deckel-quote'\)/);
});
test('Portalnavigation hat fünf gleich große Kacheln und umbrechende Texte',()=>{
 const nav=html.slice(html.indexOf('<nav id="deckel-nav"'),html.indexOf('</nav>',html.indexOf('<nav id="deckel-nav"')));
 assert.equal((nav.match(/data-deckel-target=/g)||[]).length,5);
 assert.match(nav,/data-deckel-target="account" aria-label="Mein Deckel"/);
 assert.match(nav,/aria-label="Mein Deckel"><span aria-hidden="true">◉<\/span>Deckel/);
 assert.match(css,/\.deckel-nav\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 const match=portalCss.match(/\.deckel-nav button\{([^}]+)\}/);
 assert.ok(match,'Kachelformatierung');
 assert.match(match[1],/white-space:normal/);
 assert.match(match[1],/overflow-wrap:anywhere/);
 assert.match(match[1],/min-width:0/);
 assert.doesNotMatch(match[1],/white-space:nowrap/);
});
test('Navigations-IDs bleiben eindeutig und JS syntaktisch gültig',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 assert.doesNotThrow(()=>new (require('node:vm').Script)(view));
});
