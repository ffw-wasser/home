'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('deckel.html','utf8'),mobile=fs.readFileSync('js/features/drinks/deckel-mobile.js','utf8'),css=fs.readFileSync('css/features/deckel.css','utf8');
test('Mehr bietet Wasserentnahme und ordnet Hilfe bewusst ganz unten an',()=>{
 const more=html.split('<div id="portal-page-more"')[1].split('<div id="portal-page-more-water"')[0];
 const expected=['more-water','theater-phone-open','more-security','portal-more-breathing-tile','more-bundesliga','more-help'];
 const actual=[...more.matchAll(/<button\b([^>]*)class="portal-more-tile[^"]*"([^>]*)>/g)].map(m=>((m[1]+' '+m[2]).match(/(?:data-more-target|id)="([^"]+)"/)||[])[1]);
 assert.deepEqual(actual,expected);
 assert.match(mobile,/'more-water':'more-water'/);
 assert.match(mobile,/'more-water':'Wasserentnahme Elz'/);
 assert.match(more,/<strong>Elz-Pegel<\/strong><span(?: class="portal-tile-description")?>Ist-Abfluss &amp; Entnahmegrenze<\/span>/);
});
test('Wasserentnahme nennt Schwelle einschließlich Gleichheit und Vortagesabfluss, ohne Live-Wert vorzutäuschen',()=>{
 const panel=html.split('<div id="portal-page-more-water"')[1].split('<div id="portal-page-more-bundesliga"')[0];
 assert.match(panel,/≤ 1,58 <small>m³\/s<\/small>/);
 assert.match(panel,/1,58 m³\/s oder weniger/);
 assert.match(panel,/Tagesmittel am Vortag/);
 assert.match(panel,/Der aktuelle Messwert und der Wasserstand sind hierfür nicht maßgeblich/);
 assert.match(panel,/keinen Live-Messwert/);
 assert.match(panel,/Abfluss und Tagesmittelwert auf NIZ öffnen/);
 assert.match(panel,/NIZ-Tagesmittelwert des Vortags/);
 assert.match(panel,/niz\.baden-wuerttemberg\.de\/oberflaechengewaesser\/abfluss-wasserstand\?id=00300&amp;view=6/);
 assert.match(panel,/target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"/);
 assert.match(panel,/Landratsamt Emmendingen/);
 assert.match(panel,/data-more-target="deckel-more"/);
});
