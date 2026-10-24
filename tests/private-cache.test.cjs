const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../service-worker.js'), 'utf8');
const root = 'https://ffw-wasser.github.io/home/';

test('Originalbilder der Anleitung sind nach Abruf offline verfügbar, autorisierte Daten bleiben außerhalb', async () => {
  const w=worker(),names=Object.keys(JSON.parse(fs.readFileSync(require.resolve('../assets/help/guide/screens.json'),'utf8')));
  for(const name of names){const url=root+'assets/help/guide/'+name+'.jpg';await w.request(url);assert.ok(w.writes.some(key=>key===url||key.url===url));const privateRequest=worker();assert.equal(await privateRequest.request(url,{auth:true}),undefined);assert.equal(privateRequest.writes.length,0);}
  const image={ok:true,type:'basic'},offline=worker({offline:true,cached:image});assert.equal(await offline.request(root+'assets/help/guide/h2o-termine.jpg'),image);
  const untouched=worker();assert.equal(await untouched.request(root+'assets/help/guide/private-record.json'),undefined);assert.equal(untouched.writes.length,0);
});

function worker({offline = false, responseOk = true, cached = undefined} = {}) {
  const events = {}, writes = [], reads = [], deleted = [], precached = [];
  const context = vm.createContext({URL, Promise, importScripts:()=>{},
    self: {registration: {scope: root}, clients: {claim: async () => {}}, skipWaiting: async () => {}, addEventListener: (name, fn) => events[name] = fn},
    caches: {keys: async () => ['ffw-wasser-final-v8-1-pending-lock-20261006', 'other-app-cache', 'ffw-wasser-topics-private-cache-20261008', 'ffw-wasser-age-statistics-20261008', 'ffw-wasser-report-dates-statistics-20261008', 'ffw-wasser-plausibility-cleanup-20261008', 'ffw-wasser-onedrive-resilience-20261008'], delete: async key => deleted.push(key), open: async () => ({addAll: async urls => precached.push(...urls), put: async (key, response) => writes.push(key), match: async key => {reads.push(key); return cached;}})},
    fetch: async request => {if (offline) throw new Error('offline'); return {ok: responseOk, type: 'basic', url: request.url, clone(){return this;}};}
  });
  vm.runInContext(source, context);
  const request = (url, options = {}) => {
    let result;
    events.fetch({request: {url, method: options.method || 'GET', mode: options.mode || 'cors', headers: {has: name => options.auth && name === 'Authorization'}}, respondWith: p => result = p});
    return result;
  };
  return {events, request, writes, reads, deleted, precached};
}

test('OneDrive, OAuth und persönliche Dateien gelangen nicht in den Cache', () => {
  const w = worker();
  for (const url of ['https://graph.microsoft.com/v1.0/me/drive/items/x/content', 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', root + 'feuerwehr-wasser-daten.json', root + 'Berichte/sonderprobe.zip', root + 'Berichte/bericht.pdf']) {
    assert.equal(w.request(url), undefined);
  }
  assert.equal(w.request(root + 'js/core/config.js', {auth: true}), undefined);
  assert.equal(w.request(root + 'js/core/config.js', {method: 'PUT'}), undefined);
  assert.deepEqual(w.writes, []);
});

test('Öffentliche App-Dateien und bereinigte Navigation sind offline verfügbar', async () => {
  const w = worker();
  await w.request(root + 'js/core/config.js?v=test');
  await w.request(root + '?code=private-code&state=private-state', {mode: 'navigate'});
  assert.equal(w.writes.length, 2);
  assert.equal(w.writes[1], root + 'index.html');
  const cached = {ok: true};
  const offline = worker({offline: true, cached});
  assert.equal(await offline.request(root, {mode: 'navigate'}), cached);
});

test('Fehlende Skripte bekommen kein HTML als Ersatz; HTTP-Fehler werden nicht gespeichert', async () => {
  const offline = worker({offline: true});
  await assert.rejects(offline.request(root + 'js/missing.js'), /offline/);
  assert.deepEqual(offline.reads.map(key => typeof key === 'string' ? key : key.url), [root + 'js/missing.js']);
  const failed = worker({responseOk: false});
  await failed.request(root + 'js/missing.js');
  assert.deepEqual(failed.writes, []);
});

test('Update entfernt alte OneDrive-haltige App-Caches', async () => {
  const w = worker();
  let activation;
  w.events.activate({waitUntil: p => activation = p});
  await activation;
  assert.deepEqual(w.deleted, ['ffw-wasser-final-v8-1-pending-lock-20261006', 'ffw-wasser-topics-private-cache-20261008', 'ffw-wasser-age-statistics-20261008', 'ffw-wasser-report-dates-statistics-20261008', 'ffw-wasser-plausibility-cleanup-20261008', 'ffw-wasser-onedrive-resilience-20261008']);
});

test('Startseite öffnet ohne Passwort und verändert keine Nutzdaten', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../js/app/app.js'), 'utf8');
  assert.match(html, /<div id="protectedAppContent"(?:\s+[^>]*)?>/);
  assert.doesNotMatch(html, /pageAccessGate|pageAccessForm|page-access-pending/);
  assert.doesNotMatch(app, /setupInitialPageAccess|fw_page_unlocked/);
  assert.match(app, /members = loadArray\(KEYS.members, DEFAULT_MEMBERS\)/);
});


test('Offline-Installation lädt aktuelle Symbole und spart historische Grafiken sowie Einrichtungsdateien aus',async()=>{
 const w=worker();let installation;
 w.events.install({waitUntil:task=>installation=task});await installation;
 assert.ok(w.precached.some(url=>url.includes('h2o-symbol-white-96.png')));
 for(const size of [180,192,512])assert.ok(w.precached.some(url=>url.includes('h2o-symbol-blue-'+size+'.png')));
 assert.ok(w.precached.some(url=>url.startsWith('./index.html')));assert.ok(w.precached.includes('./deckel.html'));
 for(const old of ['deckel-home-v2-','deckel-icon-','ffw-header.svg','docs/google-calendar-colors/'])assert.equal(w.precached.some(url=>url.includes(old)),false,old);
});
